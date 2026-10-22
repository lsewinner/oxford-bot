import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { BRIEFING_BATCH, isBriefingDue, localParts } from "@/lib/briefing";

export const Route = createFileRoute("/api/public/cron/briefing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runBriefing, BriefingAiError } = await import("@/lib/briefing.server");
        const now = new Date();
        const { data: rows, error } = await supabaseAdmin.from("briefing_settings").select("*").eq("enabled", true).neq("telegram_chat_id", "").limit(500);
        if (error) return Response.json({ error: "read failed" }, { status: 500 });
        const due = (rows ?? []).filter((r) => isBriefingDue(r, now)).slice(0, BRIEFING_BATCH);
        let sent = 0, failed = 0;
        for (const row of due) {
          const { date } = localParts(now, row.timezone);
          // Claim the day atomically so overlapping runs never double-send.
          let claim = supabaseAdmin.from("briefing_settings").update({ last_sent_on: date, last_run_at: now.toISOString() }).eq("user_id", row.user_id);
          claim = row.last_sent_on ? claim.eq("last_sent_on", row.last_sent_on) : claim.is("last_sent_on", null);
          const { data: claimed } = await claim.select("user_id").maybeSingle();
          if (!claimed) continue;
          try {
            await runBriefing(row, now);
            sent++;
            await supabaseAdmin.from("briefing_settings").update({ last_status: "sent", last_error: "" }).eq("user_id", row.user_id);
          } catch (e) {
            failed++;
            await supabaseAdmin.from("briefing_settings").update({ last_status: "error", last_error: e instanceof Error ? e.message.slice(0, 300) : "发送失败" }).eq("user_id", row.user_id);
            // Circuit breaker: stop the whole run on AI credit/policy/rate problems.
            if (e instanceof BriefingAiError && [402, 403, 429].includes(e.status)) break;
          }
        }
        return Response.json({ due: due.length, sent, failed });
      },
    },
  },
});
