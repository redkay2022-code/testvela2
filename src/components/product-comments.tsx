import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { MessageCircle, Send } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { addComment, getComments } from '@/lib/market.functions';
export function ProductComments({postId,user,requestAuth}:{postId:string;user:User|null;requestAuth:()=>void}) {
 const read=useServerFn(getComments),write=useServerFn(addComment),client=useQueryClient();
 const {data:comments,error}=useQuery({queryKey:['comments',postId],queryFn:()=>read({data:{postId}})});
 const [body,setBody]=useState(''),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 return <section className="mt-6 border-t border-border pt-5"><h3 className="flex items-center gap-2 text-sm"><MessageCircle size={15}/>Comments · {comments?.length || 0}</h3>{error?<p className="mt-4 text-xs text-destructive">Comments could not load.</p>:comments?.map(comment=><div key={comment.id} className="mt-4"><p className="text-xs">{comment.creator}</p><p className="mt-1 break-words text-sm text-muted-foreground">{comment.body}</p></div>)}<form className="mt-5 flex gap-2" onSubmit={async e=>{e.preventDefault();if(!user){requestAuth();return;}if(!body.trim()||pending)return;setPending(true);setMessage('');try{await write({data:{postId,body}});setBody('');await client.invalidateQueries({queryKey:['comments',postId]});}catch{setMessage('Your comment could not be saved. Please try again.');}finally{setPending(false);}}}><input aria-label="Product comment" placeholder="Join the conversation…" className="form-input" value={body} onChange={e=>setBody(e.target.value)} maxLength={1000}/><Button type="submit" variant="gold" size="icon" aria-label="Send comment" disabled={pending}><Send/></Button></form>{message&&<p role="alert" className="mt-3 text-xs text-destructive">{message}</p>}</section>;
}
