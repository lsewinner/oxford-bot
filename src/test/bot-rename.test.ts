import { beforeEach, describe, expect, it, vi } from "vitest";
import { renameBotThread } from "@/lib/chat-data";

const db = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: db.from } }));

describe("Bot name and associated cloud title", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.from.mockReturnValue(db); db.update.mockReturnValue(db); db.eq.mockReturnValue(db); db.select.mockReturnValue(db);
    db.single.mockResolvedValue({ data: { id: "dedicated" }, error: null });
  });
  const entry = { id: "source:mail", threadId: "source", messageId: "mail", conversationId: "dedicated", bot: { name: "邮件 Bot", kind: "mail" as const } };
  it("renames the dedicated conversation, not the shared source thread", async () => {
    await renameBotThread(entry, " 我的邮件猫 ");
    expect(db.from).toHaveBeenCalledWith("threads");
    expect(db.update).toHaveBeenCalledWith({ title: "我的邮件猫" });
    expect(db.eq).toHaveBeenCalledWith("id", "dedicated");
  });
  it("renames the source thread when no dedicated conversation exists", async () => {
    await renameBotThread({ ...entry, conversationId: undefined }, "邮件猫");
    expect(db.eq).toHaveBeenCalledWith("id", "source");
  });
  it("does not write guest conversations to cloud threads", async () => {
    await renameBotThread({ ...entry, threadId: "guest", conversationId: undefined }, "游客猫");
    expect(db.from).not.toHaveBeenCalled();
  });
  it("reports failed title writes instead of pretending synchronization succeeded", async () => {
    db.single.mockResolvedValue({ data: null, error: new Error("denied") });
    await expect(renameBotThread(entry, "猫")).rejects.toThrow("denied");
  });
});