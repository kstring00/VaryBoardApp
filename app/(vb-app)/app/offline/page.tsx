import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline", description: "You are offline. Your plan and sessions still work on this phone." };

/** Served by the service worker when a page is not cached and there is no connection. */
export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-4xl">You&rsquo;re offline</h1>
      <p className="mt-3 text-lg">Your plan and today&rsquo;s session still work on this phone. Sessions you finish are saved and sync when you are back online.</p>
      <Link href="/app" className="btn btn-primary mt-6 w-full">
        Go to Today
      </Link>
    </main>
  );
}
