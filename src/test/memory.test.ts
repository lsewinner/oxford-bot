import { describe, expect, it } from "vitest";
import { buildMemoryContext } from "@/lib/memory";

describe("memory context", () => {
  it("is empty when nothing is published", () => {
    expect(buildMemoryContext({})).toBe("");
  });
  it("places core identity before knowledge", () => {
    const out = buildMemoryContext({ knowledge: "价格 $25", identity: "我是 Oxford" });
    expect(out.indexOf("核心身份")).toBeLessThan(out.indexOf("知识库"));
    expect(out).toContain("我是 Oxford");
    expect(out).toContain("价格 $25");
  });
});
