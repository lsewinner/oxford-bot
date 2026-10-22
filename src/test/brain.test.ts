import { describe, expect, it } from "vitest";
import { BRAIN_FREE_DOCS, BRAIN_PRO_DOCS, buildBrainContext, chunkText } from "@/lib/brain";

describe("smart brain", () => {
  it("free accounts hold 3 documents, Pro 100", () => {
    expect(BRAIN_FREE_DOCS).toBe(3);
    expect(BRAIN_PRO_DOCS).toBe(100);
  });
  it("chunks long text completely with bounded size", () => {
    const text = "段落内容。".repeat(1000);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.length <= 1200)).toBe(true);
    expect(chunks.at(-1)!.endsWith("。")).toBe(true);
  });
  it("drops low-similarity hits", () => {
    expect(buildBrainContext([{ title: "a", content: "x", similarity: 0.2 }])).toBe("");
    expect(buildBrainContext([{ title: "合同", content: "x", similarity: 0.8 }])).toContain("《合同》");
  });
});
