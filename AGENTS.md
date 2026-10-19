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
- External tool catalog and demo tools share `src/lib/tool-catalog.ts`; demos are explicitly labeled and never claim real account connectivity (why: unconfigured provider OAuth must not expose or fabricate personal data).
- Guest chat uses `/guest` with local conversation IDs and storage per Bot; transport maps these IDs to `threadId: guest`, while private thread reads/writes require a verified bearer token (why: independent local histories must not weaken cloud-history ownership).
- Bot presence is a browser-local, account-scoped registry keyed by source thread and creation-message ID, with a separate persisted conversationId for dedicated cloud chats allocated on first opening; guest Bot conversations use deterministic local IDs (why: source creation requests must not duplicate identities or mix independent chats after refresh).
- Cat avatar IDs and role categories are separate types; a shared breed catalog drives new/edit pickers and bundled images (why: expanding avatar choices must not change Bot roles or invalidate previous selections).
- Attachments use AI SDK file parts with inline validated image/PDF data and text extraction before model conversion; pending first sends serialize the complete payload (why: all conversation entry paths must retain attachments without fetching arbitrary URLs).
- Image creation is an AI-selected generate_image task rendered by the client through a dedicated passthrough SSE image route; completed tool outputs retain the image while model replay strips image bytes (why: previews must not block chat headers or inflate subsequent tool context).
