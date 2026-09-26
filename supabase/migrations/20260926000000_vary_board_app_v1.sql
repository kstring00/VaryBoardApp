-- Vary Board App v1 schema.
--
-- Privacy (hard rule): no PHI on the server. Personalization (first name, appointment date,
-- notes, skip reasons) lives on the patient's device only. The server knows: a program code,
-- an anonymous device id, which exercises of a session were done / skipped / made easier,
-- when, and how movement felt (easier / same / harder).
-- Clinician-written labels (program and session names, clinic name) are validated to keep
-- emails, name titles and digit-heavy strings (phone numbers, dates of birth, record numbers)
-- out: see label_is_safe().
--
-- Access model
--   genres, movements ...................... public read; written from the dashboard only.
--   clinicians ............................. each clinician reads and writes only their own row.
--   programs, program_sessions, blocks ..... clinicians read/write only their own. Eric's starter
--                                            programs (clinician_id is null) are public.
--   completions, completion_items .......... insert-only for patient devices, only for an
--                                            active code. Clinicians read them only for their codes.
--   get_program(code) ...................... the one way a device reads a clinician's program.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- One anchor on the real board (mirrors lib/board/geometry.ts): sections 1-4 (4 = the XT's top
-- section), 19 rows per section, odd rows hold 2 anchors, even rows 3. Null = no anchor.
create or replace function public.valid_anchor(a jsonb)
returns boolean
language sql
immutable
as $$
  select a is null or a = 'null'::jsonb or (
    jsonb_typeof(a) = 'object'
    and coalesce((a ->> 'section') ~ '^[0-9]+$', false)
    and coalesce((a ->> 'row') ~ '^[0-9]+$', false)
    and coalesce((a ->> 'col') ~ '^[0-9]+$', false)
    and (a ->> 'section')::int between 1 and 4
    and (a ->> 'row')::int between 1 and 19
    and (a ->> 'col')::int between 1 and case when (a ->> 'row')::int % 2 = 1 then 2 else 3 end
  );
$$;

-- Clinician-written labels. Mirrors lib/labels.ts.
create or replace function public.label_is_safe(t text, max_len int)
returns boolean
language sql
immutable
as $$
  select t is not null
    and char_length(btrim(t)) between 1 and max_len
    and position('@' in t) = 0
    and char_length(regexp_replace(t, '[^0-9]', '', 'g')) <= 2
    and t !~* '(^|[^a-z])(mr|mrs|ms|miss|mx)([^a-z]|$)'
$$;

-- Six characters from an alphabet without look-alikes (no I, L, O, 0, 1).
create or replace function public.generate_program_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  bytes bytea;
begin
  loop
    bytes := gen_random_bytes(6);
    candidate := '';
    for i in 0..5 loop
      candidate := candidate || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.programs where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('climb', 'strengthen', 'stretch', 'loosen', 'steady', 'rise')),
  name text not null,
  clinical_name text not null,
  description text not null default '',
  sort int not null
);
comment on table public.genres is 'The six fixed genres. Never add or rename one.';

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  genre_id uuid not null references public.genres (id),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  level int not null default 1 check (level between 1 and 3),
  board_models text[] not null default '{vb,xt}' check (cardinality(board_models) > 0 and board_models <@ array['vb', 'xt']),
  needs_band boolean not null default false,
  needs_handrail boolean not null default false,
  needs_chair boolean not null default false,
  default_anchor jsonb check (public.valid_anchor(default_anchor)),
  seated_alternative_id uuid references public.movements (id) on delete set null,
  video_url text,
  poster_url text,
  cues text[] not null default '{}',
  safety_note text,
  default_sets int check (default_sets between 1 and 10),
  default_reps int check (default_reps between 1 and 50),
  default_hold_seconds int check (default_hold_seconds between 1 and 600),
  reviewed_by_eric boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seated_alternative_id is null or seated_alternative_id <> id)
);
comment on column public.movements.reviewed_by_eric is 'Production hides the movement until this is true. Flip it only after Eric has reviewed the video, cues and safety note.';
comment on column public.movements.default_anchor is 'Suggested anchor: {"section":2,"row":16,"col":2}. Section 1 = bottom, row 1 = bottom row, col 1 = left. Odd rows have 2 anchors, even rows 3.';
comment on column public.movements.seated_alternative_id is 'A chair-based version, offered to people who use a chair or wheelchair.';
comment on column public.movements.video_url is 'MP4 URL in Supabase Storage, or mux:<playback-id> when Mux is used. Portrait video preferred.';
create index movements_genre_idx on public.movements (genre_id);

create table public.clinicians (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  clinic_name text check (clinic_name is null or char_length(clinic_name) <= 80),
  created_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid references public.clinicians (id) on delete cascade,
  code char(6) not null unique default public.generate_program_code() check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (public.label_is_safe(name, 40)),
  clinic_name text check (clinic_name is null or public.label_is_safe(clinic_name, 80)),
  clinic_phone text check (clinic_phone is null or clinic_phone ~ '^[0-9+() .-]{7,20}$'),
  days_per_week int not null default 3 check (days_per_week between 1 and 7),
  reviewed_by_eric boolean not null default false,
  created_at timestamptz not null default now(),
  archived boolean not null default false
);
comment on column public.programs.clinician_id is 'Null for Eric-authored starter programs.';
comment on column public.programs.name is 'Shown to the patient. Never a patient name or health detail (enforced by label_is_safe).';
comment on column public.programs.reviewed_by_eric is 'Starter programs only (clinician_id is null): production shows a starter program only when true.';
create index programs_clinician_idx on public.programs (clinician_id);

create table public.program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  name text not null check (public.label_is_safe(name, 40)),
  sort int not null default 0,
  est_minutes int check (est_minutes between 1 and 180)
);
create index program_sessions_program_idx on public.program_sessions (program_id, sort);

create table public.session_blocks (
  id uuid primary key default gen_random_uuid(),
  program_session_id uuid not null references public.program_sessions (id) on delete cascade,
  movement_id uuid not null references public.movements (id),
  sort int not null default 0,
  sets int check (sets between 1 and 10),
  reps int check (reps between 1 and 50),
  hold_seconds int check (hold_seconds between 1 and 600),
  band_color text check (band_color is null or band_color ~ '^[A-Za-z][A-Za-z ]{0,15}$'),
  anchor jsonb check (public.valid_anchor(anchor)),
  check (reps is not null or hold_seconds is not null)
);
comment on column public.session_blocks.anchor is 'The therapist''s saved anchor for this exercise ("Your saved anchor" in the app).';
create index session_blocks_session_idx on public.session_blocks (program_session_id, sort);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  program_code char(6) not null references public.programs (code),
  device_id uuid not null,
  program_session_id uuid not null references public.program_sessions (id),
  completed_at timestamptz not null,
  feel int check (feel between 1 and 3),
  created_at timestamptz not null default now()
);
comment on table public.completions is 'Insert-only from patient devices. device_id is a random id stored on the device. feel: 1 easier, 2 same, 3 harder.';
create index completions_code_idx on public.completions (program_code, completed_at desc);

create table public.completion_items (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.completions (id) on delete cascade,
  session_block_id uuid not null references public.session_blocks (id),
  done boolean not null default false,
  eased boolean not null default false,
  seated boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.completion_items is 'Per exercise: done (false = skipped today), eased (patient tapped Make it easier), seated (patient used the seated alternative). Skip reasons stay on the device.';
create index completion_items_completion_idx on public.completion_items (completion_id);

-- Keep reviewed_at and updated_at honest when Eric flips the flag in the dashboard.
create or replace function public.movements_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.reviewed_by_eric and (tg_op = 'INSERT' or not old.reviewed_by_eric) and new.reviewed_at is null then
    new.reviewed_at := now();
  elsif not new.reviewed_by_eric then
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;
create trigger movements_touch before insert or update on public.movements
  for each row execute function public.movements_touch();

-- ---------------------------------------------------------------------------------------------
-- Security-definer checks used by RLS (they read rows the caller cannot see)
-- ---------------------------------------------------------------------------------------------

-- A completion is accepted for an active code and one of that program's sessions.
create or replace function public.completion_is_valid(p_code text, p_program_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.programs p
    join public.program_sessions ps on ps.program_id = p.id
    where p.code = p_code and not p.archived and ps.id = p_program_session_id
  );
$$;

-- An item is accepted only for a completion stored in the last two days, and only for an
-- exercise (block) of that completion's session.
create or replace function public.completion_item_is_valid(p_completion_id uuid, p_session_block_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.completions c
    join public.session_blocks b on b.program_session_id = c.program_session_id
    where c.id = p_completion_id and b.id = p_session_block_id and c.created_at > now() - interval '2 days'
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------------------------

-- The only way a patient device reads a program. Null for unknown or archived codes.
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
  where p.code = upper(btrim(p_code)) and not p.archived;
$$;

-- Creates a program, its sessions and their exercises in one transaction. Runs as the caller,
-- so RLS and the column grants apply.
--   p_sessions: [{ "name": "Shoulder mobility", "est_minutes": 15,
--                  "blocks": [{ "movement_id": "...", "sets": 2, "reps": 10, "hold_seconds": 5,
--                               "band_color": "Yellow", "anchor": {"section":2,"row":16,"col":2} }] }]
create or replace function public.create_program(p_name text, p_clinic_name text, p_clinic_phone text, p_days_per_week int, p_sessions jsonb)
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

  insert into public.programs (clinician_id, name, clinic_name, clinic_phone, days_per_week)
  values (auth.uid(), btrim(p_name), nullif(btrim(p_clinic_name), ''), nullif(btrim(p_clinic_phone), ''), p_days_per_week)
  returning id, code into new_program, new_code;

  for s in select value, ordinality from jsonb_array_elements(p_sessions) with ordinality loop
    if jsonb_typeof(s.value -> 'blocks') <> 'array' or jsonb_array_length(s.value -> 'blocks') = 0 or jsonb_array_length(s.value -> 'blocks') > 20 then
      raise exception 'Each session needs 1 to 20 exercises' using errcode = '22023';
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

-- Content gate for `pnpm content:audit`: published programs that use a movement Eric has not
-- reviewed. Published = not archived, and either a clinician program or a reviewed starter.
create or replace function public.content_audit()
returns table (program_code text, program_kind text, movement_slug text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.code::text, case when p.clinician_id is null then 'starter' else 'clinician' end, m.slug
  from public.programs p
  join public.program_sessions ps on ps.program_id = p.id
  join public.session_blocks b on b.program_session_id = ps.id
  join public.movements m on m.id = b.movement_id
  where not p.archived
    and (p.clinician_id is not null or p.reviewed_by_eric)
    and not m.reviewed_by_eric
  order by 1, 3;
$$;

-- ---------------------------------------------------------------------------------------------
-- Row-level security and grants
-- ---------------------------------------------------------------------------------------------

alter table public.genres enable row level security;
alter table public.movements enable row level security;
alter table public.clinicians enable row level security;
alter table public.programs enable row level security;
alter table public.program_sessions enable row level security;
alter table public.session_blocks enable row level security;
alter table public.completions enable row level security;
alter table public.completion_items enable row level security;

-- Supabase grants everything to the API roles by default. Start from nothing, then grant
-- exactly what each role needs.
revoke all on public.genres, public.movements, public.clinicians, public.programs, public.program_sessions,
  public.session_blocks, public.completions, public.completion_items from anon, authenticated;

grant select on public.genres, public.movements to anon, authenticated;
grant select, insert on public.clinicians to authenticated;
grant update (display_name, clinic_name) on public.clinicians to authenticated;
grant select on public.programs, public.program_sessions, public.session_blocks to anon, authenticated;
grant insert (clinician_id, name, clinic_name, clinic_phone, days_per_week) on public.programs to authenticated;
grant update (name, clinic_name, clinic_phone, days_per_week, archived) on public.programs to authenticated;
grant insert, update, delete on public.program_sessions, public.session_blocks to authenticated;
grant insert on public.completions, public.completion_items to anon, authenticated;
grant select on public.completions, public.completion_items to authenticated;

create policy "genres are public" on public.genres for select to anon, authenticated using (true);
create policy "movements are public" on public.movements for select to anon, authenticated using (true);

create policy "clinician reads own profile" on public.clinicians for select to authenticated
  using (id = auth.uid());
create policy "clinician creates own profile" on public.clinicians for insert to authenticated
  with check (id = auth.uid());
create policy "clinician updates own profile" on public.clinicians for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "starter programs are public" on public.programs for select to anon, authenticated
  using (clinician_id is null and not archived);
create policy "clinician reads own programs" on public.programs for select to authenticated
  using (clinician_id = auth.uid());
create policy "clinician creates own programs" on public.programs for insert to authenticated
  with check (clinician_id = auth.uid());
create policy "clinician updates own programs" on public.programs for update to authenticated
  using (clinician_id = auth.uid()) with check (clinician_id = auth.uid());

create policy "starter sessions are public" on public.program_sessions for select to anon, authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.clinician_id is null and not p.archived));
create policy "clinician manages own sessions" on public.program_sessions for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.clinician_id = auth.uid()))
  with check (exists (select 1 from public.programs p where p.id = program_id and p.clinician_id = auth.uid()));

create policy "starter blocks are public" on public.session_blocks for select to anon, authenticated
  using (exists (
    select 1 from public.program_sessions ps join public.programs p on p.id = ps.program_id
    where ps.id = program_session_id and p.clinician_id is null and not p.archived
  ));
create policy "clinician manages own blocks" on public.session_blocks for all to authenticated
  using (exists (
    select 1 from public.program_sessions ps join public.programs p on p.id = ps.program_id
    where ps.id = program_session_id and p.clinician_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.program_sessions ps join public.programs p on p.id = ps.program_id
    where ps.id = program_session_id and p.clinician_id = auth.uid()
  ));

create policy "log a completion for an active code" on public.completions for insert to anon, authenticated
  with check (public.completion_is_valid(program_code, program_session_id));
create policy "clinician reads completions for own codes" on public.completions for select to authenticated
  using (exists (select 1 from public.programs p where p.code = program_code and p.clinician_id = auth.uid()));

create policy "log an item for a recent completion" on public.completion_items for insert to anon, authenticated
  with check (public.completion_item_is_valid(completion_id, session_block_id));
create policy "clinician reads items for own codes" on public.completion_items for select to authenticated
  using (exists (
    select 1 from public.completions c join public.programs p on p.code = c.program_code
    where c.id = completion_id and p.clinician_id = auth.uid()
  ));

-- Functions: Supabase's default privileges grant execute to anon and authenticated explicitly,
-- so revoke from those roles as well as PUBLIC, then grant exactly what the app calls.
revoke execute on function public.generate_program_code(), public.completion_is_valid(text, uuid),
  public.completion_item_is_valid(uuid, uuid), public.get_program(text),
  public.create_program(text, text, text, int, jsonb), public.content_audit() from public, anon, authenticated;
grant execute on function public.completion_is_valid(text, uuid), public.completion_item_is_valid(uuid, uuid),
  public.get_program(text) to anon, authenticated;
grant execute on function public.create_program(text, text, text, int, jsonb), public.generate_program_code() to authenticated;
grant execute on function public.content_audit() to service_role;

-- ---------------------------------------------------------------------------------------------
-- Storage: public bucket for movement videos and posters (used when Mux is not configured).
-- Uploads happen from the dashboard or `pnpm video:upload` with the service role.
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('movement-media', 'movement-media', true)
    on conflict (id) do nothing;
  end if;
end;
$$;
