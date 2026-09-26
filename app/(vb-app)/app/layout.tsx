import { DraftBanner } from "@/components/app/DraftBanner";

/** Everything under /app. (Served at app.thevaryboard.com later via a Vercel domain alias; see README.) */
export default function VbAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DraftBanner />
      {children}
    </>
  );
}
