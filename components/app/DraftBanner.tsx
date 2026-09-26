import { showDrafts } from "@/lib/content-gate";

/** Shown wherever draft (unreviewed) movements are visible. The live app never shows them. */
export function DraftBanner() {
  if (!showDrafts()) return null;
  return (
    <p role="note" className="no-print bg-warn-bg px-4 py-2 text-center text-sm font-medium text-warn-ink">
      Preview: includes draft movements Dr. Eric has not reviewed. The live app hides them.
    </p>
  );
}
