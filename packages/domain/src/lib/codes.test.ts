import { describe, expect, it } from "vitest";
import { makeEntityCode, slugFragment } from "./codes.js";

describe("slugFragment", () => {
  it("takes the first letters of a name, uppercased", () => {
    expect(slugFragment("Maren Cole")).toBe("MAR");
  });

  it("strips non-letters", () => {
    expect(slugFragment("Dr. Oz")).toBe("DRO");
  });

  it("pads short names to the requested length", () => {
    expect(slugFragment("Al")).toBe("ALX");
  });

  it("falls back to XXX when a name has no letters at all", () => {
    expect(slugFragment("123")).toBe("XXX");
  });
});

describe("makeEntityCode", () => {
  it("builds a spec-shaped code like CHAR-MAR-01", () => {
    expect(makeEntityCode("CHAR", "Maren Cole", 1)).toBe("CHAR-MAR-01");
  });

  it("zero-pads the index to two digits", () => {
    expect(makeEntityCode("LOC", "Hospital", 3)).toBe("LOC-HOS-03");
  });
});
