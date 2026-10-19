import { queryOptions } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { botsFromMessages, type BotEntry } from "@/lib/bot-presence";

export type Thread = { id: string; title: string; updated_at: string };

export const threadsQuery = () =>
  queryOptions({
    queryKey: ["threads"],
    queryFn: async (): Promise<Thread[]> => {
      const { data, error } = await supabase
        .from("threads")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const messagesQuery = (threadId: string) =>
  queryOptions({
    queryKey: ["messages", threadId],
    staleTime: Infinity,
    queryFn: async (): Promise<{ exists: boolean; messages: UIMessage[] }> => {
      const { data: thread, error: tErr } = await supabase
        .from("threads")
        .select("id")
        .eq("id", threadId)
        .maybeSingle();
      if (tErr) throw tErr;
      if (!thread) return { exists: false, messages: [] };
      const { data, error } = await supabase
        .from("messages")
        .select("ui_id, role, parts")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return {
        exists: true,
        messages: (data ?? []).map((m) => ({
          id: m.ui_id,
          role: m.role as UIMessage["role"],
          parts: (m.parts ?? []) as UIMessage["parts"],
        })),
      };
    },
  });

export type ThreadPreviewRow = { thread_id: string; preview: string; role: string; updated_at: string };
export type ThreadPreview = { preview: string; updatedAt: string };

export const threadPreviewsQuery = (threadIds: string[]) =>
  queryOptions({
    queryKey: ["thread-previews", threadIds],
    staleTime: 10_000,
    queryFn: async (): Promise<Record<string, ThreadPreview>> => {
      if (threadIds.length === 0) return {};
      const { data, error } = await supabase.rpc("thread_previews", { p_thread_ids: threadIds });
      if (error) throw error;
      return ((data ?? []) as ThreadPreviewRow[]).reduce<Record<string, ThreadPreview>>((acc, row) => {
        acc[row.thread_id] = { preview: row.preview, updatedAt: row.updated_at };
        return acc;
      }, {});
    },
  });

export const botHistoryQuery = (userId: string) => queryOptions({
  queryKey: ["bot-history", userId],
  queryFn: async () => {
    const { data, error } = await supabase.from("messages").select("thread_id, ui_id, role, parts").eq("role", "user").order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).flatMap((message) => botsFromMessages(message.thread_id, [{ id: message.ui_id, role: "user", parts: (message.parts ?? []) as UIMessage["parts"] }]));
  },
});

export async function createThread(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("未登录");
  const { data, error } = await supabase
    .from("threads")
    .insert({ user_id: u.user.id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export const pendingKey = (id: string) => `oxford:pending:${id}`;

export async function renameBotThread(entry: BotEntry, name: string): Promise<void> {
  const threadId = entry.conversationId ?? entry.threadId;
  if (!threadId || threadId === "guest" || threadId.startsWith("guest:")) return;
  // Owner-scoped thread policies enforce access through the authenticated browser client.
  const { error } = await supabase.from("threads").update({ title: name.trim() }).eq("id", threadId).select("id").single();
  if (error) throw error;
}
