<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Chat streaming lives in `src/routes/api/chat.ts` → `src/lib/ai/chat.server.ts`; it verifies the caller's bearer token and thread ownership itself and persists messages server-side (why: API routes bypass the route auth gate).
- Threads are DB-backed with per-thread URLs `/chat/$threadId` under `_authenticated`; messages store AI SDK ids in `ui_id`, never in uuid columns (why: SDK ids are not UUIDs).
- PWA is manifest-only (no service worker) (why: installability without stale-cache risk in preview).
- The first message from `/chat` is handed to the thread page through sessionStorage and must be sent from a macrotask (`setTimeout(..., 0)`) after mount, never synchronously inside the mount effect (why: the chat store drops a send issued before its first dispatch, silently losing the user's first question; `src/test/chat-first-message.test.tsx` guards this).
- Web search citations: the model cites sources as markdown links; `ChatMessage` in `src/components/chat/chat-window.tsx` merges text-cited link domains with `source-url` parts into one deduped list and renders matching links as numbered superscript badges via a Streamdown `components.a` override (why: the model does not reliably emit literal [n] markers, and badges/cards must share one numbering).
- Chat response headers must never wait for gateway run-ID discovery or acquire a replacement stream reader; forward the original body and attach diagnostics only when already available (why: diagnostic metadata must not block first output, errors, or cancellation).
