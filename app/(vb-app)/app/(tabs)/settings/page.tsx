import type { Metadata } from "next";
import Link from "next/link";
import { ReminderSettings } from "@/components/app/ReminderSettings";
import { SettingsView } from "@/components/app/SettingsView";

export const metadata: Metadata = {
  title: "Your details and settings",
  description: "Your first name, text size, motion, board model, seated versions and spoken cues. Everything here stays on this phone.",
};

export default function SettingsPage() {
  return (
    <>
      <h1 className="mt-2 text-4xl">Your details &amp; settings</h1>
      <p className="mt-2 text-muted">Everything on this page stays on this phone.</p>
      <div className="mt-6">
        <ReminderSettings />
      </div>
      <SettingsView />
      <p className="mt-5 text-center">
        <Link href="/app/privacy" className="text-teal underline">
          What the app stores, and where
        </Link>
      </p>
      <section aria-labelledby="clin-h" className="card mt-5 p-5">
        <h2 id="clin-h" className="text-2xl">
          For clinicians
        </h2>
        <p className="mt-1">Build a program from the Vary Board library and give your patient a code.</p>
        <Link href="/app/clinician" className="btn btn-secondary mt-4 w-full">
          Clinician sign-in
        </Link>
      </section>
    </>
  );
}
