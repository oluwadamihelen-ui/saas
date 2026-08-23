import { describe, expect, it } from "vitest";
import { isPublicationPubliclyVisible } from "./publicationVisibility.js";

describe("isPublicationPubliclyVisible", () => {
  it("is visible only when PUBLIC and APPROVED", () => {
    expect(isPublicationPubliclyVisible({ visibility: "PUBLIC", moderationStatus: "APPROVED" })).toBe(true);
  });

  it("is not visible while pending review, even if PUBLIC", () => {
    expect(isPublicationPubliclyVisible({ visibility: "PUBLIC", moderationStatus: "PENDING" })).toBe(false);
  });

  it("is not visible once rejected, even if PUBLIC", () => {
    expect(isPublicationPubliclyVisible({ visibility: "PUBLIC", moderationStatus: "REJECTED" })).toBe(false);
  });

  it("is not visible when unpublished, even if somehow approved", () => {
    expect(isPublicationPubliclyVisible({ visibility: "PRIVATE", moderationStatus: "APPROVED" })).toBe(false);
  });
});
