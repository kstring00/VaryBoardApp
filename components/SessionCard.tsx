import Link from "next/link";
import { BoardMap } from "@/components/BoardMap";
import { ArrowIcon } from "@/components/app/icons";
import { exerciseCount, sessionMinutes } from "@/lib/program";
import type { PatientProgram, PlanSession } from "@/lib/types";

/**
 * "Your next session". Background: Eric's board photo under a soft plaster overlay when it
 * exists; until then the real-geometry board schematic (never an invented board).
 */
export function SessionCard({ program, session, photo, resume }: { program: PatientProgram; session: PlanSession; photo: string | null; resume?: { index: number; total: number } | null }) {
  const firstAnchor = session.blocks.find((b) => b.anchor)?.anchor ?? null;
  return (
    <section aria-labelledby="next-session-h" className="relative overflow-hidden rounded-2xl border border-line bg-mint-wash shadow-soft">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div aria-hidden="true" className="absolute right-4 top-5 opacity-90">
          <BoardMap model="vb" litCells={firstAnchor ? [firstAnchor] : []} crop={firstAnchor ? "lit" : 2} className="h-44 w-auto rounded-md" title="Vary Board" />
        </div>
      )}
      <div className={`relative p-5 ${photo ? "bg-plaster/85" : ""}`}>
        <p className="eyebrow">{resume ? "Pick up where you left off" : "Your next session"}</p>
        <h2 id="next-session-h" className="mt-1 max-w-[62%] text-3xl">
          {session.name}
        </h2>
        <p className="mt-2 max-w-[62%] text-lg font-medium">
          {sessionMinutes(session)} min • {exerciseCount(session)}
        </p>
        <p className="mt-1 max-w-[62%] text-muted">{resume ? `Exercise ${resume.index + 1} of ${resume.total} is next.` : program.isStarter ? "Starter plan from Dr. Eric" : "Assigned by your therapist"}</p>
        <Link href={`/app/session?s=${session.id}`} className="btn btn-primary mt-6 w-full">
          {resume ? "Resume session" : "Start session"} <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}
