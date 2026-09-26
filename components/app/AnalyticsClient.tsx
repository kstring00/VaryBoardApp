"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Vercel Analytics only (no third-party trackers). Page views are stripped of query strings
 * and program codes, so nothing links a view to a program.
 */
function scrub(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/^\/app\/clinician\/(?!new$|login$|profile$|anchors$)[^/]+/, "/app/clinician/[code]");
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export function AnalyticsClient() {
  return <Analytics beforeSend={scrub} />;
}
