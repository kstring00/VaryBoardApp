import copy from "@/content/app-copy.json";

/**
 * App copy that Eric reviews (content/app-copy.json, reviewedByEric per string).
 * t("commit.statement", { days: 4, anchor: "after coffee" })
 */
export type CopyKey = keyof typeof copy;

export function t(key: CopyKey, vars: Record<string, string | number> = {}): string {
  return copy[key].text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}
