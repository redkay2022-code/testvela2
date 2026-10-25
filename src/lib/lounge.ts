/** Lounge = short videos (video, title and text only) that only sellers can publish. They are stored as normal posts flagged with specs.lounge. */
export const LOUNGE_CATEGORY = 'lounge';
export const LOUNGE_MAX_SECONDS = 600;
export const LOUNGE_MAX_BYTES = 1024 * 1024 * 1024;
export const isLoungePost = (post: { source?: { specs?: unknown } | null }): boolean => {
  const specs = post.source?.specs;
  return Boolean(specs && typeof specs === 'object' && !Array.isArray(specs) && (specs as Record<string, unknown>)['lounge'] === true);
};
export const loungeTooLong = (seconds: number): boolean => !Number.isFinite(seconds) || seconds > LOUNGE_MAX_SECONDS + 0.05;
