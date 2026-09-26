import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-4xl">Page not found</h1>
      <p className="mt-3 text-lg">This address is not part of the Vary Board app.</p>
      <Link href="/app" className="btn btn-primary mt-6 w-full">
        Open the app
      </Link>
    </main>
  );
}
