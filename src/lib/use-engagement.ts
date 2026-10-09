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
  const mutation=useMutation({mutationFn:async(id:string)=>{
    if(!uid) throw new Error('로그인 후 좋아요를 남길 수 있습니다.');
    const result=likedIds.has(id)?await supabase.from('likes').delete().eq('user_id',uid).eq('post_id',id):await supabase.from('likes').insert({user_id:uid,post_id:id});
    if(result.error) throw result.error;
  },onSuccess:()=>client.invalidateQueries({queryKey:['my-likes',uid]}),onError:()=>toast.error(uid?'좋아요를 변경하지 못했습니다.':'로그인 후 좋아요를 남길 수 있습니다.')});
  return {likedIds,toggleLike:mutation.mutate,busy:mutation.isPending};
}