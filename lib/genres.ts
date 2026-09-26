import type { GenreSlug } from "@/lib/types";

/** Display names for genre chips (the fixed six; the database holds the same). */
export const GENRE_NAMES: Record<GenreSlug, string> = {
  climb: "Climb",
  strengthen: "Strengthen",
  stretch: "Stretch",
  loosen: "Loosen",
  steady: "Steady",
  rise: "Rise",
};
