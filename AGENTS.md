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
- Phone authentication uses managed Auth OTP calls; classify failures without exposing provider payloads and bind verification to the successfully requested number (why: actionable errors without bypassing SMS verification or leaking credentials).
- Auth emails use six scaffolded templates and managed /lovable/email/auth handlers; preserve SDK verification and entities v4 aliases (why: secure, compatible sending).
- Chat route → `ai/chat.server.ts` verifies bearer/ownership and persists messages. `ai/provider.server.ts` selects OpenAI key, then Anthropic key, then Gateway; no failure fallback; image/voice routing stays separate (why: protect accounts, keys and spending).
- Threads are DB-backed with per-thread URLs `/chat/$threadId` under `_authenticated`; messages store AI SDK ids in `ui_id`, never in uuid columns (why: SDK ids are not UUIDs).
- PWA is manifest-only; desktop install uses a root-mounted prompt provider and Safari guidance, never a service worker (why: early install events, cache-safe previews).
- Do not override Vite’s Rolldown version (why: incompatible versions break diagram initialization).
- First sends use sessionStorage and post-mount `setTimeout(..., 0)`, never synchronous effects (why: early sends disappear; chat-first-message tests guard this).
- Chat responses forward the body immediately; never wait on run-ID discovery or re-read the stream (why: no blocked output/cancel).
- External tool catalog and demo tools share `src/lib/tool-catalog.ts`; demos are explicitly labeled and never claim real account connectivity (why: unconfigured provider OAuth must not expose or fabricate personal data).
- Real provider writes are immutable server-side proposals claimed atomically by the owning user's confirmation; result cards read persisted action outcomes after refresh (why: model requests are not user approval, and repeated clicks must not repeat writes).
- Guest chat uses `/guest` with local conversation IDs and storage per Bot; transport maps these IDs to `threadId: guest`, while private thread reads/writes require a verified bearer token (why: independent local histories must not weaken cloud-history ownership).
- Bot presence: account-scoped local registry keyed by source thread/message; overrides beat history parsing; renames go through owner RLS; guest IDs deterministic (why: preserve edits and isolation).
- Attachments: AI SDK file parts with inline validated image/PDF data, text extracted before model conversion; pending first sends serialize the full payload (why: keep attachments on every entry path, never fetch arbitrary URLs).
- Image creation is an AI-selected generate_image task rendered by the client through a dedicated passthrough SSE image route; completed tool outputs retain the image while model replay strips image bytes (why: previews must not block chat headers or inflate subsequent tool context).
- Public shares are revocable server-created snapshots of owner-read messages; the public reader exposes only text, completed generated images and sources, never private thread rows or tool actions (why: sharing must not weaken account isolation or publish subsequent messages).
- Bot shares: writes via server fns only (persona kept only for Pro owners); public reads via security-definer RPCs; chat loads trial personas from botShare server-side; featuring is admin-only (why: no forged personas).
- Query options shared by route loaders and components live outside route modules (why: route code splitting must not depend on unexported shared declarations).
- Exports reuse the safe snapshot serializer; image regeneration swaps prompt+image only on success (why: predictable downloads, no lost images).


- Bot personas/preferences extend the scoped registry and are validated at chat entry; they never grant access (why: preserve identity and authorization).
- Deep Think uses the existing model and public reasoning summaries only (why: retain model selection and reasoning privacy).
- Trends use fixed server-side GitHub Trending/Hacker News feeds and the current composer (why: preserve active-Bot context).
- Nickname and compact avatar use authenticated owner metadata updates, never roles (why: sync identity without new tables).
- Pro access: `subscriptions` rows are written only by the signed Stripe webhook; server checks use `has_active_subscription` with the environment derived from the build's client token, and gated server paths (chat Deep Think/persona, connection starts) re-check Pro (why: client gates are UX only).
- Paid plan tiers use stable price lookup keys in shared plan helpers and quota RPCs; existing active paid subscriptions manage changes through the billing portal, never a second checkout (why: consistent test/live entitlements and no duplicate subscriptions).
- Admin `/admin`: `has_role` check before supabaseAdmin in admin.functions; actions audited. Quotas via `consume_daily_message` RPC; overrides/bans/granted Pro in `account_controls`, honored by `has_active_subscription` (why: server is the only source of truth).
- Memory center: admin-only versions, one published per kind, injected server-side before Bot context.
- Connection eligibility and OAuth/rotation rules live in src/lib/connections/AGENTS.md; callbacks verify the caller before saving (why: prevent credential theft).

- Smart Brain: docs embedded server-side into service-role-only brain_chunks, searched by match_brain_chunks with the verified userId, injected as reference data (why: no cross-account reads, no injected instructions).
- Workflows use the current composer and pending handoff, owner-only credential-free metadata, bounded service tools and existing write confirmations (why: preserve Bot context, isolation and approval).
- Daily briefings: hourly managed cron → /api/public/cron/briefing; CAS-claim the user's local date, bounded batch, AI 402/403/429 breaker; read-only, saved Telegram target is standing consent (why: no double or silent writes).
- Meeting Copilot: segmented recordings to /api/transcribe, strict-JSON summaries, dispatch via a new chat's confirmations, Brain saves via ingestBrainText (why: upload limits, no silent writes).
- Live voice: /api/live (server.ts + live-vite-plugin) relays to Gateway in live-relay.server.ts; app.start token is verified before the paid session; Brain tool uses only that userId (why: server-side keys, isolated knowledge).
- China fallback: chat models are wrapped by `withRegionFallback` (provider.server.ts) and switch to the domestic model only on an explicit region refusal — Qwen (`DASHSCOPE_API_KEY`) for quick answers, DeepSeek reasoner (`DEEPSEEK_API_KEY`, tools stripped) for Deep Think; Live voice falls back client-side to turn-based STT → /api/voice-reply → TTS (why: domestic users keep working without hiding auth/quota/outage errors).
- Browser backend calls are rewritten by src/lib/backend-proxy.ts to the same-origin forwarder /api/public/sb/* (fixed host, auth/rest/storage/functions only) (why: mainland China networks cannot reliably reach the backend host directly).

- Real AI tool descriptions use exhaustive per-provider guidance in ai/tool-guidance.ts; only the selected service's instructions accompany its tool, while execution and confirmation boundaries remain unchanged (why: avoid repeating the entire service manual for every connected tool).
- Voice transcribe/speech try direct OpenAI first and switch once to the Gateway on a 403 region refusal or network failure; remaining 403s return a Chinese message (why: users in restricted regions keep voice without raw provider errors).
- Public market quotes (Yahoo chart API, fixed host) and render_chart are built-in chat tools available to guests; the client renders their outputs as cards, and Excel is converted to CSV text in the browser (why: no account needed, model only sees text).
- UI language: src/lib/i18n.tsx LangProvider (saved choice > browser) keys its subtree on language; screens wrap Chinese phrases in tz(), English lives in i18n-en.ts with Chinese fallback; chat sends `lang` for the English reply style (why: one locale source).
