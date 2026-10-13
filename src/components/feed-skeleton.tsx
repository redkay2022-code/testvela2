/** Shown right away while a page's data is loading, so the screen is never blank. No text, so it needs no translation. */
const heights = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]', 'aspect-[3/4]', 'aspect-[5/6]', 'aspect-square'];
export function FeedSkeleton() {
  return <main className="lux-shell" aria-busy="true" aria-live="polite">
    <div className="lux-waterfall red-home-waterfall">
      {[0, 1].map(column => <div className="lux-column" key={column}>
        {heights.map((h, i) => <article className="lux-post" key={i}>
          <div className={`${h} w-full animate-pulse rounded-xl bg-muted`} />
          <div className="mt-2 space-y-2"><div className="h-3 w-4/5 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div>
        </article>)}
      </div>)}
    </div>
  </main>;
}
