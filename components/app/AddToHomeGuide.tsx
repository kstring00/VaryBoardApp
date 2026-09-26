import { t } from "@/lib/copy";

/** One-time guide for iPhone: web push only works once the app is on the Home Screen. */
export function AddToHomeGuide({ onDone }: { onDone: () => void }) {
  return (
    <section aria-labelledby="a2hs-h" className="card p-5">
      <h2 id="a2hs-h" className="text-2xl">
        {t("a2hs.title")}
      </h2>
      <p className="mt-2">{t("a2hs.why")}</p>
      <ol className="mt-4 space-y-4">
        <li className="flex items-center gap-4">
          {/* The Safari share icon: a square with an arrow out of the top. */}
          <svg viewBox="0 0 40 40" className="h-12 w-12 shrink-0 rounded-xl bg-mint-wash p-2 text-teal" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 15H11a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V17a2 2 0 0 0-2-2h-3" />
            <path d="M20 24V5M14 11l6-6 6 6" />
          </svg>
          <span>1. {t("a2hs.step1")}</span>
        </li>
        <li className="flex items-center gap-4">
          <svg viewBox="0 0 40 40" className="h-12 w-12 shrink-0 rounded-xl bg-mint-wash p-2 text-teal" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
            <rect x="7" y="7" width="26" height="26" rx="6" />
            <path d="M20 14v12M14 20h12" />
          </svg>
          <span>2. {t("a2hs.step2")}</span>
        </li>
        <li className="flex items-center gap-4">
          <svg viewBox="0 0 40 40" className="h-12 w-12 shrink-0 rounded-xl bg-mint-wash p-2" aria-hidden="true">
            <rect x="12" y="6" width="7" height="28" rx="2.5" className="fill-teal" />
            <rect x="22" y="6" width="7" height="28" rx="2.5" className="fill-teal" />
          </svg>
          <span>3. {t("a2hs.step3")}</span>
        </li>
      </ol>
      <button type="button" className="btn btn-primary mt-6 w-full" onClick={onDone}>
        {t("a2hs.done")}
      </button>
    </section>
  );
}
