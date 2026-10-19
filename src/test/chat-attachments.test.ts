import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { parsePendingInput, prepareAttachments, validateAttachments } from "@/lib/chat-attachments";

describe("multimodal attachments", () => {
  const message = (mediaType: string, url: string): UIMessage[] => [{ id: "upload", role: "user", parts: [{ type: "file", mediaType, url }] }];
  it.each(["image/png", "image/jpeg", "application/pdf", "text/plain"])("accepts inline %s uploads", (type) => {
    expect(() => validateAttachments(message(type, `data:${type};base64,YQ==`))).not.toThrow();
  });
  it("rejects external or local URLs rather than fetching private addresses", () => {
    expect(() => validateAttachments(message("image/png", "http://localhost/private"))).toThrow();
    expect(() => validateAttachments(message("image/png", "blob:local"))).toThrow();
  });
  it("rejects unsupported executable uploads", () => {
    expect(() => validateAttachments(message("application/x-executable", "data:application/x-executable;base64,YQ=="))).toThrow();
  });
  it("retains attachment-only first sends", () => {
    const input = { text: "", files: [{ type: "file", mediaType: "application/pdf", url: "data:application/pdf;base64,YQ==" }] };
    expect(parsePendingInput(JSON.stringify(input))).toEqual(input);
  });
  it("normalizes markdown uploads to readable text without losing bytes", async () => {
    expect(await prepareAttachments([{ type: "file", mediaType: "", filename: "note.md", url: "data:;base64,YQ==" }])).toEqual([{ type: "file", mediaType: "text/plain", filename: "note.md", url: "data:text/plain;base64,YQ==" }]);
  });
});