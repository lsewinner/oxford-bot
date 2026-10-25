import { describe, expect, it } from "vitest";
import { canSubmitToSquare, filterSquareBots, type SquareBot } from "@/lib/bot-square";

const bot = (o: Partial<SquareBot>): SquareBot => ({ token: "t", name: "Cat", kind: "general", breed: null, intro: "", category: "productivity", creatorName: "", official: false, ...o });

describe("Bot Square rules", () => {
  it("only paid members may submit for review", () => {
    expect(canSubmitToSquare(false)).toBe(false);
    expect(canSubmitToSquare(true)).toBe(true);
  });
  it("filters by category and search text", () => {
    const list = [bot({ token: "a", name: "Coder", category: "coding" }), bot({ token: "b", name: "Mailer", category: "writing", intro: "drafts emails" })];
    expect(filterSquareBots(list, "coding", "").map(b => b.token)).toEqual(["a"]);
    expect(filterSquareBots(list, "all", "emails").map(b => b.token)).toEqual(["b"]);
  });
});
