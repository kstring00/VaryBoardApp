import { eric } from "@/content/site";

/** Eric's name and credentials from the site's confirmed facts. Initials, never an invented headshot. */
export function EricCredit({ className = "" }: { className?: string }) {
  const initials = eric.name.replace(/^Dr\.\s*/, "").split(" ").map((w) => w[0]).join("");
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal font-display text-lg text-white">
        {initials}
      </span>
      <p className="text-sm text-muted">
        The Vary Board was designed by{" "}
        <span className="font-semibold text-ink">
          {eric.name}, {eric.credentials}
        </span>
        , {eric.role.charAt(0).toLowerCase() + eric.role.slice(1)}.
      </p>
    </div>
  );
}
