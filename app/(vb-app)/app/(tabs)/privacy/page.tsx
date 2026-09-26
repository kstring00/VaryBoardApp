import type { Metadata } from "next";
import { brand } from "@/content/site";
import { t } from "@/lib/copy";

export const metadata: Metadata = {
  title: "App privacy",
  description: "What the Vary Board app keeps on your phone, what it sends, and how reminders work.",
};

/** App privacy notice. The site's full privacy policy (thevaryboard.com/privacy) should carry the same points. */
export default function PrivacyPage() {
  return (
    <>
      <h1 className="mt-2 text-4xl">App privacy</h1>
      <p className="mt-2 text-muted">Last updated {new Date(2026, 8, 26).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>
      <div className="mt-6 space-y-5 text-lg">
        <section>
          <h2 className="text-2xl">On your phone only</h2>
          <p className="mt-2">Your first name, next appointment, notes for your therapist, the reasons you skip an exercise, your reminder time and your settings stay on this phone. They are never sent to us or to your therapist. The progress summary PDF is made on the phone too.</p>
        </section>
        <section>
          <h2 className="text-2xl">Sent to your therapist</h2>
          <p className="mt-2">When you have a therapist&rsquo;s code, the app sends: the code, which exercises you did, skipped or made easier, when, and whether movement felt easier, the same or harder. That is all. No name, email, date of birth or health details.</p>
        </section>
        <section>
          <h2 className="text-2xl">Anonymous device number</h2>
          <p className="mt-2">{t("privacy.deviceLine")} It lets your sessions be counted once, even if your phone was offline.</p>
        </section>
        <section>
          <h2 className="text-2xl">Reminders</h2>
          <p className="mt-2">{t("privacy.pushLine")} Reminders are never used for marketing.</p>
        </section>
        <section>
          <h2 className="text-2xl">Clinicians</h2>
          <p className="mt-2">Clinicians sign in with their work email. Patients never create an account.</p>
        </section>
        <section>
          <h2 className="text-2xl">Analytics</h2>
          <p className="mt-2">We count page views with Vercel Analytics, without program codes or query strings. No other trackers.</p>
        </section>
        <p>
          Full privacy policy:{" "}
          <a href={brand.privacyUrl} className="text-teal underline">
            {brand.domain}/privacy
          </a>
          . Questions: <a href={brand.phoneHref} className="text-teal underline">{brand.phone}</a>.
        </p>
      </div>
    </>
  );
}
