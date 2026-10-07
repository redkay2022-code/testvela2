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

## Application architecture
- Use TanStack Router and validated URL search state for tabs, drawers, and dialogs; the platform requires this router and browser back should unwind UI state.
- Load the public feed through TanStack Query with a server-function loader; public SSR must never require an account.
- Keep marketplace data in Cloud with owner-scoped write policies; authenticated writes must use the caller's identity.
- Bundle editorial media and icons locally; uploaded private storage media are served with signed URLs after matching published post paths.
- Use manifest-only home-screen support; no offline service worker unless offline operation is explicitly requested.
- Isolate demo role previews and commerce/moderation actions in a shared React provider; they never grant Cloud privileges or change production rows.
- Adapt existing editorial post IDs into a local luxury-watch sample collection without overwriting owner content; server-loaded published posts remain the source for real uploads.
- Keep live account comments separate from simulated shopping state; reuse authenticated server functions for persistent comment writes.
- Represent the Shorts player and its nested sheets in URL search state; replacing only the active short keeps swipe navigation out of the back stack.
- Keep full-screen search in validated URL search state and reuse the public feed data so device back dismisses search without a separate data source.
- Derive seller reputation with shared pure threshold functions and local SVG emblems; keep editorial metrics sample-only and leave unknown live sellers unbadged until trusted approval data exists.
- Buyer membership is an explicit trusted tier, not inferred from client orders or metadata; use baseline Member when no earned membership is available.

- Keep Shorts inspection lightboxing in validated URL search state above the sheet; preserve original uploaded image URLs and unwind browser back one layer at a time.
- Resolve storefronts from the selected seller identity using public feed rows; never display sample reputation or reviews as another seller’s data.
