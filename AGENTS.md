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

- Read subdirectory AGENTS.md files before editing there.
- Chat route → `ai/chat.server.ts` verifies bearer/ownership and persists messages. `ai/provider.server.ts` selects OpenAI key, then Anthropic key, then Gateway; no failure fallback; image/voice routing stays separate (why: protect accounts, keys and spending).
- Threads are DB-backed with per-thread URLs `/chat/$threadId` under `_authenticated`; messages store AI SDK ids in `ui_id`, never in uuid columns (why: SDK ids are not UUIDs).
- PWA uses only a manifest (why: avoid stale preview caches).
- Desktop installation uses a shared root-mounted prompt provider with browser-native prompts and manual Safari guidance, never an app-shell worker (why: capture early install events and keep previews cache-safe).
- Do not override Vite’s Rolldown version (why: incompatible versions break diagram initialization).
- First sends use sessionStorage and post-mount `setTimeout(..., 0)`, never synchronous effects (why: early sends disappear; chat-first-message tests guard this).
- ChatMessage dedupes citation domains and source-url parts; Streamdown links and cards share superscript numbering (why: models do not reliably emit numbered citations).
- Chat responses forward the original body immediately; never wait on run-ID discovery or re-read the stream (why: must not block output or cancellation).
- External tool catalog and demo tools share `src/lib/tool-catalog.ts`; demos are explicitly labeled and never claim real account connectivity (why: unconfigured provider OAuth must not expose or fabricate personal data).
- Real provider writes are immutable server-side proposals claimed atomically by the owning user's confirmation; result cards read persisted action outcomes after refresh (why: model requests are not user approval, and repeated clicks must not repeat writes).
- Guest chat uses `/guest` with local conversation IDs and storage per Bot; transport maps these IDs to `threadId: guest`, while private thread reads/writes require a verified bearer token (why: independent local histories must not weaken cloud-history ownership).
- Bot presence: account-scoped local registry keyed by source thread/message; overrides beat history parsing; renames go through owner RLS; guest IDs deterministic (why: preserve edits and isolation).
- Cat avatar IDs and role categories are separate types; a shared breed catalog drives new/edit pickers and bundled images (why: expanding avatar choices must not change Bot roles or invalidate previous selections).
- Attachments use AI SDK file parts with inline validated image/PDF data and text extraction before model conversion; pending first sends serialize the complete payload (why: all conversation entry paths must retain attachments without fetching arbitrary URLs).
- Image creation is an AI-selected generate_image task rendered by the client through a dedicated passthrough SSE image route; completed tool outputs retain the image while model replay strips image bytes (why: previews must not block chat headers or inflate subsequent tool context).
- Public shares are revocable server-created snapshots of owner-read messages; the public reader exposes only text, completed generated images and sources, never private thread rows or tool actions (why: sharing must not weaken account isolation or publish subsequent messages).
- Query options shared by route loaders and components live outside route modules (why: route code splitting must not depend on unexported shared declarations).
- Conversation exports use the same safe snapshot serializer; image regeneration replaces both prompt and image only after completion and keeps the last successful image on failure (why: downloads stay predictable and failed redraws cannot destroy existing results).

- Bot sidebars share BotListLabel/botListRowClass; actions outside label flow (why: aligned rows).

- Bot personas/preferences extend the scoped registry and are validated at chat entry; they never grant access (why: preserve identity and authorization).
- Deep Think uses the existing model and public reasoning summaries only (why: retain model selection and reasoning privacy).
- Trends use fixed server-side GitHub Trending/Hacker News feeds and the current composer (why: preserve active-Bot context).
- Nickname and compact avatar use authenticated owner metadata updates, never roles (why: sync identity without new tables).
- Pro access: `subscriptions` rows are written only by the signed Stripe webhook; server checks use `has_active_subscription` with the environment derived from the build's client token, and gated server paths (chat Deep Think/persona, connection starts) re-check Pro (why: client gates are UX only).
- Admin `/admin`: `has_role` check before supabaseAdmin in admin.functions; actions audited. Quotas via `consume_daily_message` RPC; overrides/bans/granted Pro in `account_controls`, honored by `has_active_subscription` (why: server is the only source of truth).
- Memory center: admin-only versions, one published per kind, injected server-side before Bot context.
- A provider stays in 工具与连接 only if a normal customer can connect it alone, in one step, with no signup wall, paid tier, or hand-built app; Feishu and Flomo were removed on this rule (why: if the owner cannot self-serve, customers cannot either).
- Airtable one-click authorization completes through authenticated opener server functions and a verified public callback; connection-specific credential/rotation rules live in src/lib/connections/AGENTS.md (why: public redirects must never save credentials for an unverified caller).

- Smart Brain (private RAG): user docs are chunked and embedded server-side into brain_chunks (service-role only, searched via match_brain_chunks with the verified userId) and injected into chat as reference data (why: private knowledge must never be readable across accounts or treated as instructions).
