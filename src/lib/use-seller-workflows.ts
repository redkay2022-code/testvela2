import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { getSellerWorkflows } from './seller-workflows.functions';
export type SellerActivity = { products: { id: string; title: string; likes: number; saves: number }[]; followers: { id: string; nickname: string; created_at: string }[]; comments: { id: string; post_id: string; title: string; creator: string; body: string; created_at: string }[] };
export function useSellerWorkflows(userId: string) {
  const read = useServerFn(getSellerWorkflows), client = useQueryClient();
  const query = useQuery({ queryKey: ['seller-workflows', userId], queryFn: () => read(), refetchInterval: 15000 });
  useEffect(() => {
    const channel = supabase.channel(`seller-workflows-${userId}-${crypto.randomUUID()}`);
    for (const table of ['orders','order_messages','payment_transactions','likes','cart_items','seller_follows','comments','order_replacements']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { void client.invalidateQueries({ queryKey: ['seller-workflows', userId] }); void client.invalidateQueries({ queryKey: ['studio-tier', userId] }); });
    channel.subscribe(); return () => { void supabase.removeChannel(channel); };
  }, [userId, client]);
  return { ...query, activity: query.data?.activity as SellerActivity | undefined };
}