import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMessage = vi.fn();

// The chat store is the piece that drops a send issued inside the mount effect, so
// the hook is replaced with a spy: the test only observes when the hand-off dispatches.
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    sendMessage,
    status: "ready",
    stop: vi.fn(),
    regenerate: vi.fn(),
    error: undefined,
  }),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, DefaultChatTransport: class {} };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
    },
  },
}));

import { ChatWindow } from "@/components/chat/chat-window";
import { ModeProvider } from "@/components/chat/mode-context";
import { pendingKey } from "@/lib/chat-data";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("first message hand-off", () => {
  beforeEach(() => {
    sendMessage.mockClear();
    sessionStorage.clear();
  });

  it("dispatches the pending question exactly once, and not from the mount effect", async () => {
    sessionStorage.setItem(pendingKey("t1"), "你好，报上你的名字");

    render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider><ModeProvider>
          <ChatWindow threadId="t1" initialMessages={[]} />
        </ModeProvider></TooltipProvider>
      </QueryClientProvider>,
    );

    // A send issued synchronously during the effect flush never reaches the network.
    expect(sendMessage).not.toHaveBeenCalled();

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sendMessage).toHaveBeenCalledWith({ text: "你好，报上你的名字" });
    expect(sessionStorage.getItem(pendingKey("t1"))).toBeNull();
  });
  it("retains image and PDF attachments in the deferred first send", async () => {
    const input = { text: "分析附件", files: [
      { type: "file", mediaType: "image/png", url: "data:image/png;base64,YQ==", filename: "cat.png" },
      { type: "file", mediaType: "application/pdf", url: "data:application/pdf;base64,YQ==", filename: "report.pdf" },
    ] };
    sessionStorage.setItem(pendingKey("t2"), JSON.stringify(input));
    render(<QueryClientProvider client={new QueryClient()}><TooltipProvider><ModeProvider><ChatWindow threadId="t2" initialMessages={[]} /></ModeProvider></TooltipProvider></QueryClientProvider>);
    expect(sendMessage).not.toHaveBeenCalled();
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith(input));
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
