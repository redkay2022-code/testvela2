import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useEngagement() {
  const client = useQueryClient();
  const user = useQuery({queryKey:['auth-user'],queryFn:async()=>(await supabase.auth.getUser()).data.user});
  const uid = user.data?.id;
  const likes = useQuery({queryKey:['my-likes',uid],enabled:Boolean(uid),queryFn:async()=>{
    if (!uid) return [];
    const {data,error}=await supabase.from('likes').select('post_id').eq('user_id',uid);
    if(error) throw error;
    return data ?? [];
  }});
  const likedIds = new Set(likes.data?.map(row=>row.post_id));
  const key=['my-likes',uid] as const;
  const mutation=useMutation({mutationFn:async({id,liked}:{id:string;liked:boolean})=>{
    if(!uid) throw new Error('로그인 후 좋아요를 남길 수 있습니다.');
    const result=liked?await supabase.from('likes').delete().eq('user_id',uid).eq('post_id',id):await supabase.from('likes').insert({user_id:uid,post_id:id});
    if(result.error&&result.error.code!=='23505') throw result.error;
  },
  /* Instant UI: flip the heart immediately, roll back only if the server refuses. */
  onMutate:async({id,liked})=>{
    await client.cancelQueries({queryKey:key});
    const prev=client.getQueryData<{post_id:string}[]>(key);
    client.setQueryData<{post_id:string}[]>(key,old=>liked?(old??[]).filter(r=>r.post_id!==id):[...(old??[]),{post_id:id}]);
    return {prev};
  },
  onError:(_e,_v,ctx)=>{if(ctx?.prev)client.setQueryData(key,ctx.prev);toast.error(uid?'좋아요를 변경하지 못했습니다.':'로그인 후 좋아요를 남길 수 있습니다.');},
  onSettled:()=>{void client.invalidateQueries({queryKey:key});}});
  const toggleLike=(id:string)=>mutation.mutate({id,liked:likedIds.has(id)});
  return {likedIds,toggleLike,busy:false};
}
