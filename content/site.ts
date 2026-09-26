/**
 * Site facts the app shows. Mirrors the confirmed values in the marketing site's
 * `varyboard/content/facts.ts` (single source of truth there). When this app is merged into
 * the site repo, delete this file and import from `@/content/facts` instead.
 *
 * Rules (same as the site)
 *  - No invented headshots: `eric.portrait` stays null until a real photo exists.
 *  - Wellness language only. Movements and effort, never outcomes.
 */
export const brand = {
  name: "The Vary Board",
  appName: "Vary Board",
  domain: "thevaryboard.com",
  siteUrl: "https://thevaryboard.com",
  privacyUrl: "https://thevaryboard.com/privacy",
  termsUrl: "https://thevaryboard.com/terms",
  contactUrl: "https://thevaryboard.com/contact",
  phone: "888-597-7591",
  phoneHref: "tel:+18885977591",
  email: "info@varysystems.com",
  legalName: "Vary Systems",
} as const;

export const eric = {
  name: "Dr. Eric Santiago",
  credentials: "PT, DPT",
  role: "Physical therapist and owner of Trinity Physical Therapy, Houston",
  /** Real portrait only. Null renders initials, never a generated face. */
  portrait: null as string | null,
} as const;

export const discounts = {
  heroesLine: "10% off for veterans, active duty and first responders.",
} as const;

/** The only approved VA wording. Never say "free". */
export const vaLine = "Veterans: through the VA, the Vary Board may be covered when your provider finds it medically necessary.";

export const disclaimer = "Consult your physician or physical therapist before starting any exercise program.";

export const phiWarning = "Do not enter patient names or health details.";
