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
- Represent Shorts in the /shorts/$id leaf route with nested sheets in validated search state; replace the active ID during vertical swipes so browser back exits instead of replaying swipe history.
- Keep full-screen search in validated URL search state and reuse the public feed data so device back dismisses search without a separate data source.
- Derive seller reputation with shared pure threshold functions and local SVG emblems; keep editorial metrics sample-only and leave unknown live sellers unbadged until trusted approval data exists.
- Buyer membership is an explicit trusted tier, not inferred from client orders or metadata; use baseline Member when no earned membership is available.

- Keep Shorts inspection lightboxing in validated URL search state above the sheet; preserve original uploaded image URLs and unwind browser back one layer at a time.
- Resolve storefronts from the selected seller identity using public feed rows; never display sample reputation or reviews as another seller’s data.

- Keep Home sub-topic selection in validated URL search state and filter the existing public feed; message navigation opens the existing isolated sample conversation without inventing unread data.
- Keep the category picker and selected filter in validated URL search state; match multilingual category/brand aliases against existing listing content without inventing brand affiliations for editorial samples.
- Build the public seller directory from visible feed listings grouped by stable seller identity; directory filters use validated URL search state and unknown live metrics remain unavailable.
- Store all prices (item and Full Set Box) in base USD and convert only at display via src/lib/currency formatMoney; one stored currency keeps totals and fees consistent.
