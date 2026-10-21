import { describe, expect, it } from "vitest";
import { validateOperation } from "@/lib/connections/catalog";
import { callWithPersonalToken } from "@/lib/connections/personal-token.server";

const ref = "abcdefghijklmnopqrst";
describe("Supabase connection is read-only", () => {
  it("accepts read queries", () => {
    expect(() => validateOperation("supabase", { operation: "query", id: ref, query: "select 1" })).not.toThrow();
  });
  it("rejects write SQL", () => {
    expect(() => validateOperation("supabase", { operation: "query", id: ref, query: "delete from users" })).toThrow();
  });
  it("requires a project ref", () => {
    expect(() => validateOperation("supabase", { operation: "tables" })).toThrow();
  });
  it("blocks non read-only endpoints", async () => {
    await expect(callWithPersonalToken("supabase", "sbp_x", `/projects/${ref}/database/query`, { method: "POST" })).rejects.toThrow();
    await expect(callWithPersonalToken("supabase", "sbp_x", `/projects/${ref}`, { method: "DELETE" })).rejects.toThrow();
  });
});
