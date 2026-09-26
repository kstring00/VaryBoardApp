-- Vary Board App v3: adherence design.
--   movements ......... easier_alternative_id ("Make it easier" target), seated_alternative_id
--   programs .......... therapist_note (120 chars max, shown under the patient's session card)
--   exercise_events ... one row per exercise done / skipped / made easier, inserted the moment it
--                       happens on the device; client_event_id makes offline retries idempotent
--   push_subscriptions  web-push reminders: a device id, the browser's push endpoint and keys,
--                       a local time and time zone. No names, no health data. Only the server
--                       (service role) reads it; devices write it through two narrow RPCs.
-- completion_items (added in v1 for per-exercise status) is superseded by exercise_events.

-- ---------------------------------------------------------------------------------------------
-- Movements: alternatives
-- ---------------------------------------------------------------------------------------------
alter table public.movements add column if not exists seated_alternative_id uuid references public.movements (id) on delete set null;
alter table public.movements add column if not exists easier_alternative_id uuid references public.movements (id) on delete set null;
alter table public.movements add constraint movements_easier_not_self check (easier_alternative_id is null or easier_alternative_id <> id);
comment on column public.movements.easier_alternative_id is 'What "Make it easier" swaps in, in place, during a session.';

-- ---------------------------------------------------------------------------------------------
-- Programs: therapist note
-- ---------------------------------------------------------------------------------------------
-- A short instruction from the therapist ("Keep the band light this week"). Same spirit as the
-- label rules: no emails, no name titles, no long digit runs or dates.
create or replace function public.note_is_safe(t text)
returns boolean
language sql
immutable
as $$
  select t is null or (
    position('@' in t) = 0
    and t !~ '[0-9]{4,}'
    and t !~ '[0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{2,4}'
    and t !~* '(^|[^a-z])(mr|mrs|ms|miss|mx)([^a-z]|$)'
  )
$$;

alter table public.programs add column therapist_note text;
alter table public.programs add column note_updated_at timestamptz;
alter table public.programs add constraint programs_therapist_note_length check (char_length(therapist_note) <= 120);
alter table public.programs add constraint programs_therapist_note_safe check (public.note_is_safe(therapist_note));
comment on column public.programs.therapist_note is 'Shown to the patient under the session card. Never a patient name or health detail.';

create or replace function public.programs_note_touch()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.therapist_note is not null then new.note_updated_at := now(); end if;
  elsif new.therapist_note is distinct from old.therapist_note then
    new.note_updated_at := case when new.therapist_note is null then null else now() end;
  end if;
  return new;
end;
$$;
create trigger programs_note_touch before insert or update on public.programs
  for each row execute function public.programs_note_touch();

grant insert (therapist_note), update (therapist_note) on public.programs to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Exercise events
-- ---------------------------------------------------------------------------------------------
create table public.exercise_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id uuid not null unique,
  program_code char(6) not null references public.programs (code),
  device_id uuid not null,
  session_block_id uuid not null references public.session_blocks (id),
  event text not null check (event in ('done', 'skipped', 'made_easier')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
comment on table public.exercise_events is 'Insert-only from patient devices. client_event_id is generated on the device so an offline retry never creates a duplicate.';
create index exercise_events_code_occurred_idx on public.exercise_events (program_code, occurred_at);

-- Spec index for completions (replaces the v1 descending one; a btree scans both ways).
drop index if exists public.completions_code_idx;
create index completions_code_completed_idx on public.completions (program_code, completed_at);

-- An event is accepted for an active code, an exercise of that program, and a plausible time
-- (up to 30 days old for devices that were offline a long time; never in the future).
create or replace function public.exercise_event_is_valid(p_code text, p_session_block_id uuid, p_occurred_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_occurred_at between now() - interval '30 days' and now() + interval '10 minutes'
    and exists (
      select 1 from public.programs p
      join public.program_sessions ps on ps.program_id = p.id
      join public.session_blocks b on b.program_session_id = ps.id
      where p.code = p_code and not p.archived and b.id = p_session_block_id
    );
$$;

alter table public.exercise_events enable row level security;
revoke all on public.exercise_events from anon, authenticated;
grant insert on public.exercise_events to anon, authenticated;
grant select on public.exercise_events to authenticated;
create policy "log an event for an active code" on public.exercise_events for insert to anon, authenticated
  with check (public.exercise_event_is_valid(program_code, session_block_id, occurred_at));
create policy "clinician reads events for own codes" on public.exercise_events for select to authenticated
  using (exists (select 1 from public.programs p where p.code = program_code and p.clinician_id = auth.uid()));

-- Superseded by exercise_events.
drop table public.completion_items;
drop function if exists public.completion_item_is_valid(uuid, uuid);

-- ---------------------------------------------------------------------------------------------
-- Push subscriptions (reminders)
-- ---------------------------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1024),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  reminder_local_time time not null,
  timezone text not null check (char_length(timezone) <= 64),
  -- ISO weekdays the patient committed to (1 = Monday ... 7 = Sunday).
  reminder_days smallint[] not null default '{1,2,3,4,5,6,7}' check (cardinality(reminder_days) between 1 and 7 and reminder_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  active boolean not null default true,
  -- Server bookkeeping: the local date of the last reminder sent (one per day at most).
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.push_subscriptions is 'Web-push reminders. No names or health data. Read only by the server (service role); devices write through save_push_subscription / set_push_active.';
create index push_subscriptions_active_idx on public.push_subscriptions (active) where active;

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
-- No policies: nobody but the service role (which bypasses RLS) can read or write the table directly.

-- Save (or move to this device) the subscription for a browser push endpoint.
create or replace function public.save_push_subscription(p_device_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_time time, p_timezone text, p_days smallint[])
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown time zone' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (device_id, endpoint, p256dh, auth, reminder_local_time, timezone, reminder_days, active)
  values (p_device_id, p_endpoint, p_p256dh, p_auth, p_time, p_timezone, coalesce(p_days, '{1,2,3,4,5,6,7}'), true)
  on conflict (endpoint) do update set
    device_id = excluded.device_id, p256dh = excluded.p256dh, auth = excluded.auth,
    reminder_local_time = excluded.reminder_local_time, timezone = excluded.timezone,
    reminder_days = excluded.reminder_days, active = true, updated_at = now();
end;
$$;

-- Turn reminders on or off. Needs both the device id and the endpoint to match.
create or replace function public.set_push_active(p_device_id uuid, p_endpoint text, p_active boolean)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  with u as (
    update public.push_subscriptions set active = p_active, updated_at = now()
    where device_id = p_device_id and endpoint = p_endpoint
    returning 1
  )
  select exists (select 1 from u);
$$;

-- ---------------------------------------------------------------------------------------------
-- RPC updates
-- ---------------------------------------------------------------------------------------------

-- get_program: now also returns the therapist note and who assigned the plan.
create or replace function public.get_program(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code', p.code,
    'is_starter', p.clinician_id is null,
    'name', p.name,
    'clinic_name', p.clinic_name,
    'clinic_phone', p.clinic_phone,
    'assigned_by', c.display_name,
    'therapist_note', p.therapist_note,
    'note_updated_at', p.note_updated_at,
    'reviewed_by_eric', p.reviewed_by_eric,
    'days_per_week', p.days_per_week,
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ps.id, 'name', ps.name, 'sort', ps.sort, 'est_minutes', ps.est_minutes,
        'blocks', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', b.id, 'movement_id', b.movement_id, 'sort', b.sort, 'sets', b.sets, 'reps', b.reps,
            'hold_seconds', b.hold_seconds, 'band_color', b.band_color, 'anchor', b.anchor
          ) order by b.sort, b.id)
          from public.session_blocks b where b.program_session_id = ps.id
        ), '[]'::jsonb)
      ) order by ps.sort, ps.id)
      from public.program_sessions ps where ps.program_id = p.id
    ), '[]'::jsonb)
  )
  from public.programs p
  left join public.clinicians c on c.id = p.clinician_id
  where p.code = upper(btrim(p_code)) and not p.archived;
$$;

-- create_program: takes the therapist note; sessions hold at most 6 exercises (short sessions).
drop function public.create_program(text, text, text, int, jsonb);
create or replace function public.create_program(p_name text, p_clinic_name text, p_clinic_phone text, p_days_per_week int, p_sessions jsonb, p_therapist_note text default null)
returns text
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  new_program uuid;
  new_code text;
  new_session uuid;
  s record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create a program' using errcode = '42501';
  end if;
  if jsonb_typeof(p_sessions) <> 'array' or jsonb_array_length(p_sessions) = 0 or jsonb_array_length(p_sessions) > 7 then
    raise exception 'A program needs 1 to 7 sessions' using errcode = '22023';
  end if;

  insert into public.programs (clinician_id, name, clinic_name, clinic_phone, days_per_week, therapist_note)
  values (auth.uid(), btrim(p_name), nullif(btrim(p_clinic_name), ''), nullif(btrim(p_clinic_phone), ''), p_days_per_week, nullif(btrim(p_therapist_note), ''))
  returning id, code into new_program, new_code;

  for s in select value, ordinality from jsonb_array_elements(p_sessions) with ordinality loop
    if jsonb_typeof(s.value -> 'blocks') <> 'array' or jsonb_array_length(s.value -> 'blocks') = 0 or jsonb_array_length(s.value -> 'blocks') > 6 then
      raise exception 'Each session needs 1 to 6 exercises' using errcode = '22023';
    end if;
    insert into public.program_sessions (program_id, name, sort, est_minutes)
    values (new_program, btrim(s.value ->> 'name'), s.ordinality, nullif(s.value ->> 'est_minutes', '')::int)
    returning id into new_session;

    insert into public.session_blocks (program_session_id, movement_id, sort, sets, reps, hold_seconds, band_color, anchor)
    select new_session,
           (b.value ->> 'movement_id')::uuid,
           b.ordinality::int,
           nullif(b.value ->> 'sets', '')::int,
           nullif(b.value ->> 'reps', '')::int,
           nullif(b.value ->> 'hold_seconds', '')::int,
           nullif(btrim(b.value ->> 'band_color'), ''),
           case when jsonb_typeof(b.value -> 'anchor') = 'object' then b.value -> 'anchor' end
    from jsonb_array_elements(s.value -> 'blocks') with ordinality as b(value, ordinality);
  end loop;

  return new_code;
end;
$$;

-- Grants (Supabase's default privileges grant execute to anon/authenticated explicitly).
revoke execute on function public.create_program(text, text, text, int, jsonb, text), public.exercise_event_is_valid(text, uuid, timestamptz),
  public.save_push_subscription(uuid, text, text, text, time, text, smallint[]), public.set_push_active(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.create_program(text, text, text, int, jsonb, text) to authenticated;
grant execute on function public.exercise_event_is_valid(text, uuid, timestamptz) to anon, authenticated;
grant execute on function public.save_push_subscription(uuid, text, text, text, time, text, smallint[]), public.set_push_active(uuid, text, boolean) to anon, authenticated;
