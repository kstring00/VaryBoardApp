import { getQuickWorkouts } from "@/lib/workouts";

/** Quick workouts for Today (gated), so the static Today page stays fresh after Eric reviews. */
export const revalidate = 300;

export async function GET() {
  return Response.json(await getQuickWorkouts());
}
