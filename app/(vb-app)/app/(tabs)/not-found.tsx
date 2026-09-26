import Link from "next/link";

export default function AppNotFound() {
  return (
    <>
      <h1 className="mt-6 text-4xl">We can&rsquo;t find that page</h1>
      <p className="mt-3 text-lg">The link may be old, or the page has moved.</p>
      <Link href="/app" className="btn btn-primary mt-6 w-full">
        Back to Today
      </Link>
    </>
  );
}
