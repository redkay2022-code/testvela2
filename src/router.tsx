import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { FeedSkeleton } from "./components/feed-skeleton";
import { initPerf } from "./lib/perf";

export const getRouter = () => {
  initPerf();
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Show a skeleton right away (after 100 ms) instead of a blank page while a route loads its data.
    defaultPendingComponent: FeedSkeleton,
    defaultPendingMs: 100,
    defaultPendingMinMs: 200,
  });

  return router;
};
