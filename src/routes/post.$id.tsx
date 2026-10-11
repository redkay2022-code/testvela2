import { createFileRoute } from '@tanstack/react-router';
import { LuxuryMarketplace } from '@/components/luxury-marketplace';
import { marketSearch, postsQuery } from '@/lib/market';

const SITE = 'https://velamarket.lovable.app';

export const Route = createFileRoute('/post/$id')({
  validateSearch: marketSearch,
  loader: async ({ context, params }) => {
    const posts = await context.queryClient.ensureQueryData(postsQuery);
    const post = posts.find(p => p.id === params.id);
    if (!post) return { title: null, description: null, image: null };
    const img = [post.thumbnail_url, ...post.media_urls].find(u => typeof u === 'string' && u.startsWith('https://')) ?? null;
    return { title: post.title, description: (post.description || `${post.creator} · VELA`).slice(0, 160), image: img };
  },
  head: ({ params, loaderData }) => {
    const title = loaderData?.title ? `${loaderData.title} · VELA` : 'Product · VELA';
    const description = loaderData?.description || 'Discover this listing on VELA marketplace.';
    const url = `${SITE}/post/${params.id}`;
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'product' },
        { property: 'og:url', content: url },
        { name: 'twitter:card', content: 'summary_large_image' },
        ...(loaderData?.image ? [{ property: 'og:image', content: loaderData.image }, { name: 'twitter:image', content: loaderData.image }] : []),
        ...(!loaderData?.title ? [{ name: 'robots', content: 'noindex' }] : []),
      ],
      links: [{ rel: 'canonical', href: url }],
    };
  },
  errorComponent: () => <div className="lux-empty">This listing could not load. Please try again.</div>,
  component: PostRoute,
});
function PostRoute() { const { id } = Route.useParams(); return <LuxuryMarketplace mode="home" postId={id} />; }
