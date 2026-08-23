import { describe, expect, it } from "vitest";
import { selectClipShots } from "./clipSelection.js";

describe("selectClipShots", () => {
  it("includes shots until the cumulative duration reaches the target", () => {
    const shots = [
      { id: "a", durationSeconds: 5 },
      { id: "b", durationSeconds: 5 },
      { id: "c", durationSeconds: 5 },
      { id: "d", durationSeconds: 5 },
    ];
    const selected = selectClipShots(shots, 12);
    expect(selected.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("includes every candidate when total duration never reaches the target", () => {
    const shots = [
      { id: "a", durationSeconds: 3 },
      { id: "b", durationSeconds: 3 },
    ];
    expect(selectClipShots(shots, 60).map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array for an empty candidate list", () => {
    expect(selectClipShots([], 30)).toEqual([]);
  });

  it("includes exactly one shot when it alone meets or exceeds the target", () => {
    const shots = [
      { id: "a", durationSeconds: 90 },
      { id: "b", durationSeconds: 5 },
    ];
    expect(selectClipShots(shots, 60).map((s) => s.id)).toEqual(["a"]);
  });

  it("preserves extra fields on the selected shots", () => {
    const shots = [{ id: "a", durationSeconds: 5, status: "READY" }];
    const selected = selectClipShots(shots, 10);
    expect(selected[0]?.status).toBe("READY");
  });

  it("preserves candidate order rather than sorting by duration", () => {
    const shots = [
      { id: "long", durationSeconds: 20 },
      { id: "short", durationSeconds: 5 },
    ];
    expect(selectClipShots(shots, 5).map((s) => s.id)).toEqual(["long"]);
  });
});
