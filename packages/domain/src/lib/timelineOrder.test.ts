import { describe, expect, it } from "vitest";
import { resolveEpisodeShotOrder } from "./timelineOrder.js";

describe("resolveEpisodeShotOrder", () => {
  it("keeps the natural order when no shot has a manual override", () => {
    const shots = [{ id: "a", timelineOrder: null }, { id: "b", timelineOrder: null }];
    expect(resolveEpisodeShotOrder(shots)).toEqual(shots);
  });

  it("keeps the natural order when only some shots have a manual override (never a partial reorder)", () => {
    const shots = [{ id: "a", timelineOrder: 1 }, { id: "b", timelineOrder: null }, { id: "c", timelineOrder: 0 }];
    expect(resolveEpisodeShotOrder(shots)).toEqual(shots);
  });

  it("sorts by timelineOrder once every shot has one set", () => {
    const shots = [
      { id: "a", timelineOrder: 2 },
      { id: "b", timelineOrder: 0 },
      { id: "c", timelineOrder: 1 },
    ];
    expect(resolveEpisodeShotOrder(shots).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("returns an empty array unchanged", () => {
    expect(resolveEpisodeShotOrder([])).toEqual([]);
  });
});
