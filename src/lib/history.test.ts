import assert from "node:assert/strict";
import { test } from "node:test";
import { newestThenChrono } from "./history";

function msgs(n: number, lastBody: string) {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${String(i + 1).padStart(4, "0")}`,
    createdAt: new Date(1_700_000_000_000 + i * 1000),
    body: i === n - 1 ? lastBody : "hello",
    direction: "in" as const,
  }));
}

test("latest inbound is kept in 81-, 100- and 1000-message threads", () => {
  for (const n of [81, 100, 1000]) {
    const window = newestThenChrono(msgs(n, "STOP"), 80);
    assert.equal(window.at(-1)?.body, "STOP");
    assert.equal(window.length, 80);
  }
});

test("equal timestamps sort stably by id", () => {
  const t = new Date("2026-09-05T12:00:00Z");
  const rows = [
    { id: "a", createdAt: t },
    { id: "c", createdAt: t },
    { id: "b", createdAt: t },
  ];
  const ordered = newestThenChrono(rows, 10);
  assert.deepEqual(
    ordered.map((r) => r.id),
    ["a", "b", "c"],
  );
});
