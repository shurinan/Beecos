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

## Architecture rules
- Data reads/writes go from the browser through the generated client with RLS (no server functions yet); why: all access is user-scoped and RLS enforces it.
- Signed-in pages live under `src/routes/_authenticated/`; auth state comes from the single `AuthProvider` in `src/lib/auth.tsx`; why: one auth listener avoids duplicate invalidation.
- Public city text always passes through `publicCity()` in `src/lib/location.ts` before it reaches a public page, JSON-LD or sitemap; why: old free-text values may hold a CEP or street address.
- `/sitemap.xml` reads open posts in its server handler with a publishable-key (anon) client, never the service key, and falls back to static routes on failure; why: the sitemap must only list what visitors can already see.
- Ad tags load and conversions send only through `src/lib/google-ads.ts`, gated by `src/lib/consent.ts` (single cookie banner, Consent Mode defaults as the first head script); why: one consent gate keeps refusals and Global Privacy Control effective everywhere.
- Internal edge functions (send-emails, send-push, cleanup-chat-files, referral-rewards) are started only through `public.call_internal_function`, which sends the `internal_secret` from `app_keys`; each function rejects requests without it. User-written text is passed through `safeUserText` before leaving by email or push; why: these jobs are public URLs and chat text must not become a phishing channel.
