import { describe, it, expect } from "vitest";
import { parseCsvRecords, rowsToCsv } from "@/lib/csv";

describe("parseCsvRecords", () => {
  it("lowercases headers and maps each row's values by column", () => {
    const { header, records } = parseCsvRecords("Name,Age\nAda,10\nChidi,12");
    expect(header).toEqual(["name", "age"]);
    expect(records).toEqual([{ name: "Ada", age: "10" }, { name: "Chidi", age: "12" }]);
  });

  it("handles a quoted field containing a comma and an escaped quote", () => {
    const { records } = parseCsvRecords('name,note\nAda,"Loves math, and science"\nChidi,"Said ""hi"""');
    expect(records[0].note).toBe("Loves math, and science");
    expect(records[1].note).toBe('Said "hi"');
  });

  it("fills a missing trailing column as an empty string rather than dropping it", () => {
    const { records } = parseCsvRecords("a,b,c\n1,2");
    expect(records[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("drops blank lines instead of treating them as empty records", () => {
    const { records } = parseCsvRecords("a,b\n1,2\n\n3,4\n");
    expect(records).toHaveLength(2);
  });

  it("returns no records for a header-only file", () => {
    expect(parseCsvRecords("a,b\n").records).toHaveLength(0);
  });
});

describe("rowsToCsv", () => {
  it("quotes a field only when it contains a comma, quote or newline", () => {
    const csv = rowsToCsv(["name", "note"], [["Ada", "plain"], ["Chidi", 'has, a comma'], ["Bola", 'has a "quote"']]);
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toBe("Ada,plain");
    expect(lines[2]).toBe('Chidi,"has, a comma"');
    expect(lines[3]).toBe('Bola,"has a ""quote"""');
  });

  it("round-trips through parseCsvRecords", () => {
    const csv = rowsToCsv(["name", "note"], [["Ada", "Loves, commas"], ["Chidi", 'Said "hi"']]);
    const { records } = parseCsvRecords(csv);
    expect(records).toEqual([{ name: "Ada", note: "Loves, commas" }, { name: "Chidi", note: 'Said "hi"' }]);
  });
});
