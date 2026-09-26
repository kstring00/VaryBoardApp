import type { Metadata } from "next";
import { Suspense } from "react";
import { CareView } from "@/components/app/CareView";
import { EricCredit } from "@/components/app/EricCredit";
import { PhoneIcon } from "@/components/app/icons";
import { brand, discounts, disclaimer, vaLine } from "@/content/site";

export const metadata: Metadata = {
  title: "Care",
  description: "Your therapist's code, your clinic's contact details, your next appointment and notes for your therapist, plus Vary Board support.",
};

export default function CarePage() {
  const year = new Date().getFullYear();
  return (
    <>
      <h1 className="mt-2 text-4xl">Care</h1>
      <p className="mt-2 text-muted">Your care team, your next visit, and a real person when you need one.</p>
      <Suspense fallback={<div className="mt-6 h-96" />}>
        <CareView />
      </Suspense>

      <section aria-labelledby="support-h" className="card mt-5 p-5">
        <h2 id="support-h" className="text-2xl">
          Vary Board support
        </h2>
        <p className="mt-1 text-muted">Questions about the board itself. A person answers, not a chatbot.</p>
        <a href={brand.phoneHref} className="btn btn-secondary mt-4 w-full">
          <PhoneIcon /> Call {brand.phone}
        </a>
        <ul className="mt-4 space-y-2">
          <li>
            <a href={brand.siteUrl} className="text-teal underline">
              {brand.domain}
            </a>
          </li>
          <li>
            <a href={`mailto:${brand.email}`} className="text-teal underline">
              {brand.email}
            </a>
          </li>
        </ul>
        <p className="mt-4">{discounts.heroesLine}</p>
        <p className="mt-2">{vaLine}</p>
        <EricCredit className="mt-5" />
      </section>

      <p className="mt-6 text-sm text-muted">{disclaimer}</p>
      <nav aria-label="Legal" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <a href={brand.privacyUrl} className="text-teal underline">
          Privacy policy
        </a>
        <a href={brand.termsUrl} className="text-teal underline">
          Terms
        </a>
        <a href={brand.siteUrl} className="text-muted underline">
          Shop
        </a>
      </nav>
      <p className="mt-3 text-sm text-muted">
        © {year} {brand.legalName}
      </p>
    </>
  );
}
