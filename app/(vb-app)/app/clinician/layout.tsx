import type { Metadata } from "next";
import Link from "next/link";
import { HexMark } from "@/components/HexMark";
import { getClinician } from "@/lib/clinician";
import { signOut } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ClinicianLayout({ children }: { children: React.ReactNode }) {
  const c = await getClinician();
  return (
    <>
      <header className="no-print border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/app/clinician" className="flex min-h-12 items-center gap-2 font-display text-xl font-semibold text-ink no-underline">
            <HexMark className="h-8 w-8" />
            <span className="hidden sm:inline">Vary Board</span> <span className="font-sans text-base font-normal text-muted">Clinician</span>
          </Link>
          {c && (
            <form action={signOut}>
              <button type="submit" className="btn btn-quiet">
                Sign out
              </button>
            </form>
          )}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        {children}
      </main>
    </>
  );
}
