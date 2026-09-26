import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/clinician/ProfileForm";
import { getClinician } from "@/lib/clinician";

export const metadata: Metadata = { title: "Your clinician profile", description: "Your name and clinic, shown on the program handouts you print." };

export default async function ProfilePage() {
  const c = await getClinician();
  if (!c) redirect("/app/clinician/login");
  return (
    <>
      <h1 className="text-4xl">Your clinician profile</h1>
      <p className="mt-2 text-lg">Shown on the handouts you print. Your own details only, never a patient&rsquo;s.</p>
      <ProfileForm displayName={c.displayName ?? ""} clinicName={c.clinicName ?? ""} />
    </>
  );
}
