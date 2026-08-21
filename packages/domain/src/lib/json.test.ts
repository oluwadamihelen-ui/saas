import { describe, expect, it } from "vitest";
import { extractJson } from "./json.js";

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in prose", () => {
    const text = 'Sure, here is the story bible:\n{"logline": "x"}\nLet me know if you want changes.';
    expect(extractJson<{ logline: string }>(text)).toEqual({ logline: "x" });
  });

  it("parses JSON inside a markdown fence", () => {
    const text = '```json\n{"a": [1,2,3]}\n```';
    expect(extractJson<{ a: number[] }>(text)).toEqual({ a: [1, 2, 3] });
  });

  it("handles nested braces correctly", () => {
    const text = '{"a": {"b": {"c": 1}}}';
    expect(extractJson(text)).toEqual({ a: { b: { c: 1 } } });
  });

  it("throws a descriptive error when no JSON is present", () => {
    expect(() => extractJson("no json here")).toThrow(/No JSON/);
  });
});
