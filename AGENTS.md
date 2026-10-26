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
