import { describe, expect, it } from "vitest";
import { bullPriorityFor } from "./index.js";

describe("bullPriorityFor", () => {
  it("orders priorities so HIGHEST sorts before LOW", () => {
    expect(bullPriorityFor("HIGHEST")).toBeLessThan(bullPriorityFor("HIGH"));
    expect(bullPriorityFor("HIGH")).toBeLessThan(bullPriorityFor("NORMAL"));
    expect(bullPriorityFor("NORMAL")).toBeLessThan(bullPriorityFor("LOW"));
  });
});
