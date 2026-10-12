export type PostTranslation = { title: string; description: string; specs: Record<string, string> };

/** Seller-written spec fields worth translating; numeric/unit fields stay as entered. */
export const translatableSpecKeys = ['brand', 'model', 'material', 'movement', 'glass', 'factory', 'additionalDetails'] as const;

/** Merges a translation over the original specs, keeping untranslated keys. */
export function mergeSpecs(original: unknown, translated: Record<string, string> | undefined): unknown {
  if (!translated || !original || typeof original !== 'object' || Array.isArray(original)) return original;
  return { ...(original as Record<string, unknown>), ...translated };
}
