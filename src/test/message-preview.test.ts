import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { messagePreview } from "@/lib/message-preview";

const text = (t: string): UIMessage => ({ id: "m", role: "assistant", parts: [{ type: "text", text: t }] });

describe("messagePreview", () => {
  it("returns the text of the latest message", () => {
    expect(messagePreview([text("第一条"), text("最新的回复")])).toBe("最新的回复");
  });

  it("trims surrounding whitespace", () => {
    expect(messagePreview([text("  你好  ")])) .toBe("你好");
  });

  it("falls back to a media label when the latest message has no text", () => {
    const message: UIMessage = { id: "m", role: "assistant", parts: [{ type: "file", mediaType: "image/png", url: "data:x" } as UIMessage["parts"][number]] };
    expect(messagePreview([message])).toBe("[图片/文件]");
  });

  it("returns empty for an empty conversation", () => {
    expect(messagePreview([])).toBe("");
  });
});
