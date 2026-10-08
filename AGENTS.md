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
- Use TanStack Router and validated URL search state for tabs, drawers, dialogs, search, lightboxes and feed/category/collection filters, filtering the existing public feed; browser back unwinds one UI layer at a time. Match category/brand aliases against listing content without inventing affiliations.
- Load the public feed through TanStack Query with a server-function loader; public SSR must never require an account.
- Keep marketplace data in Cloud with owner-scoped write policies; authenticated writes must use the caller's identity.
- Bundle editorial media and icons locally; uploaded private storage media are served with signed URLs after matching published post paths.
- Use manifest-only home-screen support; no offline service worker unless offline operation is explicitly requested.
- Isolate demo role previews and commerce/moderation actions in a shared React provider; they never grant Cloud privileges or change production rows.
- Share photo/Shorts detail content; product Q&A uses authenticated post comments and validated detailTab for Back navigation, separate from simulated commerce.
- Represent Shorts in the /shorts/$id leaf route with nested sheets in validated search state; replace the active ID during vertical swipes so browser back exits instead of replaying swipe history.
- Derive seller reputation and account badges with shared pure functions and local SVG emblems; account badges use trusted roles, not URL view state; keep editorial metrics sample-only and leave unknown live sellers unbadged until trusted approval data exists.
- Buyer membership is an explicit trusted tier, not inferred from client orders or metadata; use baseline Member when no earned membership is available.
- Resolve storefronts from public feed rows by seller identity, creator name and slug-insensitive keys; reviews share that canonical identity so 구매처 opens the correct store. Never attribute sample reputation or reviews to another seller.
- Build the public seller directory from visible feed listings grouped by stable seller identity; directory filters use validated URL search state and unknown live metrics remain unavailable.
- Use insuredPurchase for mandatory delivery insurance and checkout totals; calculate on the seller item price, excluding the optional box, to keep displayed and submitted totals consistent.
- Store all prices (item and Full Set Box) in base USD and convert only at display via src/lib/currency formatMoney; one stored currency keeps totals and fees consistent.
- Translate commerce with src/lib/i18n t() and UI with src/locales via src/lib/dom-translate; the shared locale provider detects device language/currency. Cache live USD rates server-side with fixed fallbacks.
- Accounts use phone + password via src/lib/phone-auth.functions.ts: the phone is peppered-SHA-256 hashed server-side and only the hash (public.profiles.phone_hash, also the synthetic auth email) is stored, enforcing one account per phone; no social/OAuth sign-in.
- Real roles live in public.user_roles checked via has_role(); seller applications carry only system_code + nickname and approvals go through admin-verified server functions in src/lib/seller-accounts.functions.ts.
- Listings store photos in media_urls and one optional video in video_url; selectors append media and use VideoStartPreview posters to preserve edits and avoid black previews.
- Real orders, QC media and the buyer/seller QC board live in Cloud (orders, order_qc_media, order_messages, private qc-media bucket); a database trigger enforces role-based stage changes and the 9-photo + 1-video QC minimum so clients cannot skip steps. Live courier status comes from 17TRACK via a cached authenticated server function (TRACK17_API_KEY).
- Help/privacy are public; settings use URL tabs. Presentation: src/components/AGENTS.md.
- USDT display estimates parity; stored prices/networks stay unchanged.
- Seed stores/products live in the database (data_source SEED), not local arrays. Catalog is Seller → Store → Product: products extend `posts` (store_id, product_status, inventory, data_source) with `product_images`/`product_qc`; a DB trigger owns status/stock transitions and syncs legacy `status`, so existing feed/search/buy code keeps reading `posts`. Inactive stores hide their products via a restrictive RLS policy.
- Categories live in public.categories (admin-managed parent/child rows); forms render them via CategoryOptions and posts keep the category name, so renames also update posts. Video uploads auto-generate a JPEG frame into posts.thumbnail_url in the browser so feeds never load video just for a cover.
- Details at /post/$id, Shorts at /shorts/$id (?post= redirects); leaf head() sets per-post title/image for share previews.
- Media self-heals via src/lib/media-refresh.ts.
- VELA Points are a platform-wide ledger (point_transactions) driven by orders triggers and SECURITY DEFINER RPCs; clients only read, so balances can't be forged.

- Seller pages share trusted queries; studioTab URL state separates details to limit scrolling.
