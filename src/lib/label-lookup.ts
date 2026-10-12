/** Pure dictionary lookup for static UI labels: the translation for the active language, or the original text when it is missing. */
export function labelFor(dict: Record<string, string> | undefined, text: string, fallback?: Record<string, string>): string {
  const hit = dict?.[text] || fallback?.[text];
  return typeof hit === 'string' && hit ? hit : text;
}
