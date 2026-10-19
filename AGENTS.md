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

- Subdirectories may have their own AGENTS.md; read it before changing files there.
- Chat streaming lives in `src/routes/api/chat.ts` → `src/lib/ai/chat.server.ts`; it verifies the caller's bearer token and thread ownership itself and persists messages server-side (why: API routes bypass the route auth gate).
- Threads are DB-backed with per-thread URLs `/chat/$threadId` under `_authenticated`; messages store AI SDK ids in `ui_id`, never in uuid columns (why: SDK ids are not UUIDs).
- PWA uses only a manifest (why: avoid stale preview caches).
- Desktop installation uses a shared root-mounted prompt provider with browser-native prompts and manual Safari guidance, never an app-shell worker (why: capture early install events and keep previews cache-safe).
- Do not override Vite’s Rolldown version (why: incompatible versions break diagram initialization).
- First sends use sessionStorage and post-mount `setTimeout(..., 0)`, never synchronous effects (why: early sends disappear; chat-first-message tests guard this).
- ChatMessage dedupes citation domains and source-url parts; Streamdown links and cards share superscript numbering (why: models do not reliably emit numbered citations).
- Chat response headers must never wait for gateway run-ID discovery or acquire a replacement stream reader; forward the original body and attach diagnostics only when already available (why: diagnostic metadata must not block first output, errors, or cancellation).
- External tool catalog and demo tools share `src/lib/tool-catalog.ts`; demos are explicitly labeled and never claim real account connectivity (why: unconfigured provider OAuth must not expose or fabricate personal data).
- Real provider writes are immutable server-side proposals claimed atomically by the owning user's confirmation; result cards read persisted action outcomes after refresh (why: model requests are not user approval, and repeated clicks must not repeat writes).
- Guest chat uses `/guest` with local conversation IDs and storage per Bot; transport maps these IDs to `threadId: guest`, while private thread reads/writes require a verified bearer token (why: independent local histories must not weaken cloud-history ownership).
- Bot presence uses an account-scoped local registry keyed by source thread/message; explicit overrides beat history parsing and scope changes remount state. Dedicated chats persist conversationId; renames update it (or threadId) through owner RLS; guest IDs are deterministic (why: preserve edits and account isolation).
- Cat avatar IDs and role categories are separate types; a shared breed catalog drives new/edit pickers and bundled images (why: expanding avatar choices must not change Bot roles or invalidate previous selections).
- Attachments use AI SDK file parts with inline validated image/PDF data and text extraction before model conversion; pending first sends serialize the complete payload (why: all conversation entry paths must retain attachments without fetching arbitrary URLs).
- Image creation is an AI-selected generate_image task rendered by the client through a dedicated passthrough SSE image route; completed tool outputs retain the image while model replay strips image bytes (why: previews must not block chat headers or inflate subsequent tool context).
- Public shares are revocable server-created snapshots of owner-read messages; the public reader exposes only text, completed generated images and sources, never private thread rows or tool actions (why: sharing must not weaken account isolation or publish subsequent messages).
- Query options shared by route loaders and components live outside route modules (why: route code splitting must not depend on unexported shared declarations).
- Conversation exports use the same safe snapshot serializer; image regeneration replaces both prompt and image only after completion and keeps the last successful image on failure (why: downloads stay predictable and failed redraws cannot destroy existing results).

- Both Bot sidebars share BotListLabel and botListRowClass; actions sit outside label flow (why: keep names and times aligned).

- Bot personas/preferences extend the scoped registry and are validated at chat entry; they never grant access (why: preserve identity and authorization).
- Deep Think uses the existing model and public reasoning summaries only (why: retain model selection and reasoning privacy).
- Trends use fixed server-side GitHub Trending/Hacker News feeds and the current composer (why: preserve active-Bot context).
- Nickname and compact avatar use authenticated owner metadata updates, never roles (why: sync identity without new tables).
- Pro access: `subscriptions` rows are written only by the signed Stripe webhook; server checks use `has_active_subscription` with the environment derived from the build's client token, and gated server paths (chat Deep Think/persona, connection starts) re-check Pro (why: client gates are UX only).
- Admin console `/admin` is gated by `user_roles` + `has_role`; privileged reads/writes run in `src/lib/admin.functions.ts` via supabaseAdmin only after that check, and every action writes `admin_audit_log` (why: client gates are UX only).
- Daily message quotas are consumed atomically by the `consume_daily_message` RPC in chat.server; admin overrides, bans and granted Pro live in `account_controls`, and `has_active_subscription` also honors granted Pro (why: one server-side source of truth for limits and Pro).
