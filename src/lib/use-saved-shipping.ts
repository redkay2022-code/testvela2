import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeShipping, type ShippingInput } from './shipping';

export const emptyShipping: ShippingInput = { recipient: '', phone: '', line1: '', line2: '', city: '', state: '', postal: '', country: '' };

/** The signed-in buyer's saved shipping address (one per account), reused at checkout. */
export function useSavedShipping() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['saved-shipping'],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from('saved_shipping').select('shipping').eq('user_id', u.user.id).maybeSingle();
      return data ? { ...emptyShipping, ...(data.shipping as Partial<ShippingInput>) } : null;
    },
  });
  const save = async (s: ShippingInput) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error('로그인이 필요합니다.');
    const shipping = normalizeShipping(s);
    const { error } = await supabase.from('saved_shipping').upsert({ user_id: u.user.id, shipping, updated_at: new Date().toISOString() });
    if (error) throw error;
    qc.setQueryData(['saved-shipping'], shipping);
  };
  return { saved: q.data ?? null, loading: q.isLoading, save };
}
