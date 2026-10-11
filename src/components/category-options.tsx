import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type CategoryRow = Database['public']['Tables']['categories']['Row'];
export const categoriesQueryKey = ['categories'] as const;

/** Categories are managed by admins in the database (public read). */
export function useCategories() {
  return useQuery({ queryKey: categoriesQueryKey, staleTime: 60_000, queryFn: async () => {
    const { data, error } = await supabase.from('categories').select('*').order('sort_order').order('name');
    if (error) throw error;
    return data;
  } });
}

/** <option> groups: each top-level category with its sub-categories. Keeps the current value selectable even if it was removed. */
export function CategoryOptions({ current, fallback }: { current?: string | undefined; fallback: readonly string[] }) {
  const { data } = useCategories();
  const rows = data ?? [];
  const parents = rows.filter(r => !r.parent_id);
  const groups = parents.map(p => ({ p, kids: rows.filter(r => r.parent_id === p.id) })).filter(g => g.kids.length);
  const names = new Set(rows.filter(r => r.parent_id).map(r => r.name));
  const extra = [...new Set([...(rows.length ? [] : fallback), ...(current && !names.has(current) ? [current] : [])])];
  return <>
    {extra.map(c => <option key={`x-${c}`} value={c}>{c}</option>)}
    {groups.map(g => <optgroup key={g.p.id} label={g.p.name}>{g.kids.map(k => <option key={k.id} value={k.name}>{k.name}</option>)}</optgroup>)}
  </>;
}
