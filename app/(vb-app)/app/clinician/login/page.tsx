import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MagicLinkForm } from "@/components/clinician/MagicLinkForm";
import { getClinician } from "@/lib/clinician";
import { demoBackend, hasSupabase } from "@/lib/env";
import { demoSignIn } from "../actions";

export const metadata: Metadata = { title: "Clinician sign-in", description: "Sign in with a magic link to build Vary Board programs and see adherence for your codes." };

export default async function LoginPage({ searchParams }: PageProps<"/app/clinician/login">) {
  if (await getClinician()) redirect("/app/clinician");
  const { error } = await searchParams;
  return (
    <>
      <h1 className="text-4xl">Clinician sign-in</h1>
      <p className="mt-3 text-lg">Build a program from the Vary Board library, give your patient a 6-character code, and see how their sessions go.</p>
      {error === "link" && (
        <p role="alert" className="mt-4 rounded-xl bg-warn-bg p-3 text-warn-ink">
          That sign-in link has expired or was already used. Request a new one below.
        </p>
      )}
      {hasSupabase ? (
        <MagicLinkForm />
      ) : demoBackend ? (
        <form action={demoSignIn} className="card mt-6 p-5">
          <p className="font-semibold">Local demo mode</p>
          <p className="mt-1 text-muted">Supabase is not configured, so clinician data lives in this server&rsquo;s memory and resets on restart. Magic-link sign-in turns on when the Supabase keys are set.</p>
          <button type="submit" className="btn btn-primary mt-4 w-full">
            Continue as the test clinician
          </button>
        </form>
      ) : (
        <p className="card mt-6 p-5">Clinician sign-in is not configured on this deployment yet. It needs the Supabase keys (see README).</p>
      )}
    </>
  );
}
