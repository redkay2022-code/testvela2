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
- Use validated TanStack search for UI layers; Back unwinds one layer. Match aliases without invented affiliations.
- Public feed uses a TanStack Query/server loader; SSR never requires login.
- Scope checkout CSS locally; selectors live only in the shared payment dialog to avoid duplicates.
- Cloud writes use owner-scoped policies and caller identity.
- Bundle editorial media and icons locally; uploaded private storage media are served with signed URLs after matching published post paths.
- Use manifest-only home-screen support; no service worker without an offline request.
- Isolate demo role previews and commerce/moderation actions in a shared React provider; they never grant Cloud privileges or change production rows.
- Share photo/Shorts detail content; product Q&A uses authenticated post comments and validated detailTab for Back navigation, separate from simulated commerce.
- Shorts use /shorts/$id with validated nested sheets; swipes replace the ID so Back exits rather than replaying swipes.
- Derive seller reputation and account badges with shared pure functions and local SVG emblems; account badges use trusted roles, not URL view state; keep editorial metrics sample-only and leave unknown live sellers unbadged until trusted approval data exists.
- Buyer membership is an explicit trusted tier, not inferred from client orders or metadata; use baseline Member when no earned membership is available.
- Resolve storefronts from public feed rows by seller identity, creator name and slug-insensitive keys; reviews share that canonical identity so 구매처 opens the correct store. Never attribute sample reputation or reviews to another seller.
- Build the public seller directory from visible feed listings grouped by stable seller identity; directory filters use validated URL search state and unknown live metrics remain unavailable.
- Use insuredPurchase for mandatory delivery insurance and checkout totals; calculate on the seller item price, excluding the optional box, to keep displayed and submitted totals consistent.
- Store all prices (item and Full Set Box) in base USD and convert only at display via src/lib/currency formatMoney; one stored currency keeps totals and fees consistent.
- Translate commerce with src/lib/i18n t() and UI with src/locales via src/lib/dom-translate; the shared locale provider detects device language/currency. Cache live USD rates server-side with fixed fallbacks.
- Phone/password auth uses server-side peppered SHA-256; only a unique phone hash and synthetic email are stored, never raw numbers; no OAuth.
- Trusted roles use user_roles/has_role(); applications contain system_code/nickname only and approvals require admin verification.
- Listings store photos in media_urls and one optional video in video_url; selectors append media and use VideoStartPreview posters to preserve edits and avoid black previews.
- Real orders, QC media and the buyer/seller QC board live in Cloud (orders, order_qc_media, order_messages, private qc-media bucket); a database trigger enforces role-based stage changes and the 9-photo + 1-video QC minimum so clients cannot skip steps. Live courier status comes from 17TRACK via a cached authenticated server function (TRACK17_API_KEY).
- Help/privacy are public; settings use URL tabs. Presentation: src/components/AGENTS.md.
- USDT display estimates parity; stored prices/networks stay unchanged.
- Seed stores/products live in the database (data_source SEED), not local arrays. Catalog is Seller → Store → Product: products extend `posts` (store_id, product_status, inventory, data_source) with `product_images`/`product_qc`; a DB trigger owns status/stock transitions and syncs legacy `status`, so existing feed/search/buy code keeps reading `posts`. Inactive stores hide their products via a restrictive RLS policy.
- Categories live in public.categories (admin-managed parent/child rows); forms render them via CategoryOptions and posts keep the category name, so renames also update posts. Video uploads auto-generate a JPEG frame into posts.thumbnail_url in the browser so feeds never load video just for a cover.
- Shorts share seller controls: hybrid details use /post/$id; video-only uses URL sheets and ProductComments. Posters are not photos. Leaf head() sets share metadata.
- Media self-heals via src/lib/media-refresh.ts. Comments use scoped profile RPCs and authorized signed avatars; no private fields.
- VELA Points are a platform-wide ledger (point_transactions) driven by orders triggers and SECURITY DEFINER RPCs; clients only read, so balances can't be forged.

- Seller pages share trusted queries; studioTab limits scrolling. PullToRefresh invalidates active queries from top-only document/nested gestures. discoveryListings excludes sold stock only from discovery, retaining storefront history.

- Customer activity uses validated customerTab/orderId/orderView and authorized live orders/QC/messages; share owner likes and account-keyed local saves. Feed counters are owner reaction state, never static base_likes or cart rows as global totals.
