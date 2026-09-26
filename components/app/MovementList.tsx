"use client";

import Link from "next/link";
import { useState } from "react";
import { useSettings } from "@/lib/client/store";
import type { BoardModel, Movement } from "@/lib/types";

/** Filter by board model, level and band. Defaults to the board in Settings. */
export function MovementList({ movements }: { movements: Movement[] }) {
  const settings = useSettings();
  const [model, setModel] = useState<BoardModel | "all" | null>(null);
  const [level, setLevel] = useState<"all" | "1" | "2" | "3">("all");
  const [band, setBand] = useState<"all" | "band" | "none">("all");
  const m = model ?? settings.boardModel;
  const shown = movements.filter((x) => (m === "all" || x.boardModels.includes(m)) && (level === "all" || x.level === Number(level)) && (band === "all" || (band === "band") === x.needsBand));
  const sel = "field min-h-12 py-2";
  return (
    <>
      <div className="mt-6 grid grid-cols-3 gap-2">
        <label className="text-sm">
          <span className="label">Board</span>
          <select className={sel} value={m} onChange={(e) => setModel(e.target.value as BoardModel | "all")}>
            <option value="all">Any</option>
            <option value="vb">Vary Board</option>
            <option value="xt">XT</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Level</span>
          <select className={sel} value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            <option value="all">Any</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Band</span>
          <select className={sel} value={band} onChange={(e) => setBand(e.target.value as typeof band)}>
            <option value="all">Any</option>
            <option value="band">Band</option>
            <option value="none">No band</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">
        {shown.length} of {movements.length} shown
      </p>
      <ul className="mt-2 space-y-3">
        {shown.map((x) => (
          <li key={x.id}>
            <Link href={`/app/movement/${x.slug}`} className="card flex min-h-16 flex-col justify-center p-4 text-ink no-underline hover:bg-mint-wash">
              <span className="font-semibold">{x.name}</span>
              <span className="text-sm text-muted">
                Level {x.level}
                {x.needsBand ? " · band" : ""}
                {x.needsHandrail ? " · handrails" : ""}
                {x.needsChair ? " · chair" : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
