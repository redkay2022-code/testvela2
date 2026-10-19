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
- Share guarded brand/spec forms and spec keys/units across create/edit for consistent details.
- Validated TanStack search drives UI layers; Back unwinds one. No invented brand affiliations.
- Public feed uses Query/server loaders; SSR needs no login.
- Scope checkout CSS and selectors to the shared payment dialog.
- Cloud writes use owner-scoped policies and caller identity.
- Bundle editorial media and icons locally; uploaded private storage media are served with signed URLs after matching published post paths.
- Use manifest-only home-screen support; no service worker without an offline request.
- Isolate demo role previews and commerce/moderation actions in a shared React provider; they never grant Cloud privileges or change production rows.
- Share photo/Shorts detail content; product Q&A uses authenticated post comments and validated detailTab for Back navigation, separate from simulated commerce.
- Shorts use /shorts/$id with validated nested sheets; swipes replace the ID so Back exits rather than replaying swipes.
- Shared pure reputation functions/local SVG badges use trusted roles; editorial metrics stay sample-only and unknown live sellers stay unbadged.
- Buyer tiers are trusted, never inferred from client orders/metadata; default to Member.
- Storefronts/reviews share canonical feed seller identity with slug-insensitive keys; never attribute sample reputation/reviews to another seller.
- Public seller directory groups visible listings by stable seller identity; URL filters and no invented metrics.
- Share Story tag validation across create/edit; store specs.storySubcategory and use URL feed IDs to reuse public filtering.
- Use insuredPurchase with the purchase insurance selection for detail/checkout totals; forward choices via validated search and never store buyer choices on listings.
- Store item/box prices in USD; display via src/lib/currency formatMoney for consistent totals/fees.
- Latest locale wins; seller cards/menus/notices use reactive Tx/tx with whole-sentence parameters. Native notranslate allows app translation; data-i18n-skip protects output/identities. Cache USD rates server-side.
- Phone/password auth uses server-side peppered SHA-256; only a unique phone hash and synthetic email are stored, never raw numbers; no OAuth.
- Trusted roles use user_roles/has_role(); applications contain system_code/nickname only and approvals require admin verification.
- Listings store photos in media_urls and one optional video in video_url; selectors append media and use VideoStartPreview posters to preserve edits and avoid black previews.
- Real orders, QC media and the buyer/seller QC board live in Cloud (orders, order_qc_media, order_messages, private qc-media bucket); a database trigger enforces role-based stage changes and the 9-photo + 1-video QC minimum so clients cannot skip steps. Live courier status comes from 17TRACK via a cached authenticated server function (TRACK17_API_KEY).
- Help/privacy are public; settings use URL tabs. Presentation: src/components/AGENTS.md.
- USDT display estimates parity; stored prices/networks stay unchanged.
- Database SEED catalog is Seller → Store → Product, extending posts with store_id/product_status/inventory/data_source and product_images/product_qc. DB triggers own stock/status and sync legacy status; restrictive RLS hides inactive-store products.
- Categories live in public.categories (admin-managed parent/child rows); forms render them via CategoryOptions and posts keep the category name, so renames also update posts. Video uploads auto-generate a JPEG frame into posts.thumbnail_url in the browser so feeds never load video just for a cover.
- Shorts share seller controls: hybrid details use /post/$id; video-only uses URL sheets and ProductComments. Posters are not photos. Leaf head() sets share metadata.
- Media self-heals via src/lib/media-refresh.ts. Comments use scoped profile RPCs and authorized signed avatars; no private fields.
- VELA Points are a platform-wide ledger (point_transactions) driven by orders triggers and SECURITY DEFINER RPCs; clients only read, so balances can't be forged.

- Seller pages share trusted queries; studioTab limits scrolling. PullToRefresh invalidates active queries from top-only document/nested gestures. discoveryListings excludes sold stock only from discovery, retaining storefront history.

- My VELA uses trusted roles and owner activity; buyer order links use validated orderId/orderView and the buyer board, never Seller Studio. Purchase cards show order seller identity and latest seller message; messages opens the existing order conversation, not general chat.
- Seller translations reset on edit.

- Payment verification stays separate from escrow; triggers sync private notices/transactions and dashboards use role-scoped reads.

- Store content shares owner-scoped actions/validation: Profile Settings edits introductions, Store Manager edits notices, public storefronts only read. Keep order history separate from active QC/logistics.
