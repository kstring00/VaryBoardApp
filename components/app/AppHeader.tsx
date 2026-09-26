import Link from "next/link";
import { HexMark } from "@/components/HexMark";
import { ProfileIcon } from "@/components/app/icons";

export function AppHeader() {
  return (
    <header className="no-print mx-auto flex max-w-xl items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-1">
      <Link href="/app" className="flex min-h-12 items-center gap-2 rounded-lg font-display text-xl font-semibold text-ink no-underline">
        <HexMark className="h-8 w-8" />
        Vary Board
      </Link>
      <Link href="/app/settings" aria-label="Your details and settings" className="flex h-12 w-12 items-center justify-center rounded-full text-teal hover:bg-mint-wash">
        <ProfileIcon className="h-7 w-7" />
      </Link>
    </header>
  );
}
