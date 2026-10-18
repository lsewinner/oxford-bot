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
