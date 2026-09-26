"use client";

import { useRouter } from "next/navigation";
import { getHabit, setProgram } from "@/lib/client/store";
import type { PatientProgram } from "@/lib/types";

export function UseStarterButton({ program }: { program: PatientProgram }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-secondary mt-5 w-full"
      onClick={() => {
        setProgram(program);
        router.push(getHabit()?.programCode === program.code ? "/app/plan" : "/app/start");
      }}
    >
      Use this plan
    </button>
  );
}
