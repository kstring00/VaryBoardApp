import { notFound } from "next/navigation";

/** Any unknown /app/... path renders the in-app 404 (with the tab bar). */
export default function CatchAll() {
  notFound();
}
