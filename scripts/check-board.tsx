/**
 * pnpm check:board — the board drawing must match the real board.
 * Asserts the geometry (47 anchors per section in 19 rows of 2 and 3, 141 on the Vary Board,
 * 188 on the XT, one center screw per section, no overlapping openings, everything inside the
 * face) and then renders <BoardMap> itself and counts what it drew.
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { BoardMap } from "../components/BoardMap";
import {
  ANCHORS_PER_SECTION,
  LAYOUT,
  ROWS_PER_SECTION,
  SECTION,
  anchorsInRow,
  boardAnchors,
  sectionAnchors,
} from "../lib/board/geometry";

const failures: string[] = [];
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.error(`✗ ${name}\n  ${(e as Error).message.split("\n").join("\n  ")}`);
  }
}

check("section is 25 x 8 x 3 in", () => assert.deepEqual({ ...SECTION }, { heightIn: 25, widthIn: 8, depthIn: 3 }));
check("47 anchors per section", () => {
  assert.equal(ANCHORS_PER_SECTION, 47);
  for (let s = 1; s <= 4; s++) assert.equal(sectionAnchors(s).length, 47, `section ${s}`);
});
check("rows alternate 2 and 3 across", () => {
  const counts = Array.from({ length: ROWS_PER_SECTION }, (_, i) => anchorsInRow(i + 1));
  for (let i = 1; i < counts.length; i++) assert.notEqual(counts[i], counts[i - 1], `rows ${i} and ${i + 1}`);
  assert.deepEqual([...new Set(counts)].sort(), [2, 3]);
  assert.equal(counts.reduce((a, b) => a + b, 0), 47);
});
check("Vary Board has 141 anchors (3 sections)", () => assert.equal(boardAnchors("vb").length, 141));
check("Vary Board XT has 188 anchors (4 sections)", () => assert.equal(boardAnchors("xt").length, 188));
check("anchor ids are unique", () => {
  const ids = boardAnchors("xt").map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});
check("one center screw per section, at the section's center", () => {
  for (const model of ["vb", "xt"] as const) {
    const screws = boardAnchors(model).filter((a) => a.centerScrew);
    assert.equal(screws.length, model === "vb" ? 3 : 4);
    for (const s of screws) {
      assert.ok(Math.abs(s.x - SECTION.widthIn / 2) < 1e-9, "horizontally centered");
      assert.ok(Math.abs(s.y - ((s.section - 1) * SECTION.heightIn + SECTION.heightIn / 2)) < 1e-9, "vertically centered");
    }
  }
});
check("openings sit inside the face and never overlap", () => {
  const r = LAYOUT.hexRadiusIn;
  const h = (Math.sqrt(3) / 2) * r;
  const a = boardAnchors("xt");
  for (const p of a) {
    assert.ok(p.x - r > LAYOUT.railIn && p.x + r < SECTION.widthIn - LAYOUT.railIn, `${p.id} inside the rails`);
    const lo = (p.section - 1) * SECTION.heightIn;
    assert.ok(p.y - h > lo && p.y + h < lo + SECTION.heightIn, `${p.id} inside its section`);
  }
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) {
      const dx = Math.abs(a[i].x - a[j].x);
      const dy = Math.abs(a[i].y - a[j].y);
      assert.ok(dx >= 2 * r || dy >= 2 * h, `${a[i].id} overlaps ${a[j].id}`);
    }
});

for (const [model, anchors, screws] of [["vb", 141, 3], ["xt", 188, 4]] as const) {
  check(`<BoardMap model="${model}"> renders ${anchors} anchors and ${screws} center screws`, () => {
    const html = renderToStaticMarkup(<BoardMap model={model} litCells={[{ section: 2, row: 16, col: 2 }]} />);
    assert.equal((html.match(/data-anchor="/g) ?? []).length, anchors);
    assert.equal((html.match(/data-center-screw=""/g) ?? []).length, screws);
    assert.equal((html.match(/data-section="/g) ?? []).length, screws);
    assert.equal((html.match(/data-lit="true"/g) ?? []).length, 1);
    assert.ok(html.includes(`data-anchor-count="${anchors}"`));
  });
}

if (failures.length) {
  console.error(`\nBoard check failed (${failures.length}).`);
  process.exit(1);
}
console.log("\n✓ board geometry matches the spec");
