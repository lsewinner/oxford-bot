import { describe, expect, it } from "vitest";
import { isWrite, validateOperation } from "@/lib/connections/catalog";
import { callWithPersonalToken } from "@/lib/connections/personal-token.server";

const page = "1234567890abcdef1234567890abcdef";
describe("Notion connection", () => {
  it("writes need confirmation", () => {
    expect(isWrite("append")).toBe(true);
    expect(isWrite("create_page")).toBe(true);
    expect(isWrite("search")).toBe(false);
  });
  it("reading requires a page id", () => {
    expect(() => validateOperation("notion", { operation: "read" })).toThrow();
    expect(() => validateOperation("notion", { operation: "read", id: page })).not.toThrow();
  });
  it("blocks deleting pages", async () => {
    await expect(callWithPersonalToken("notion", "ntn_x", `/blocks/${page}`, { method: "DELETE" })).rejects.toThrow();
  });
});
