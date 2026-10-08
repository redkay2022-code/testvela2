import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { MessageCircle, Send } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { addComment, getComments } from '@/lib/market.functions';
import { BuyerBadge } from './reputation';
import { timeAgo } from '@/lib/i18n';
export function ProductComments({postId,user,requestAuth,composerOnly=false,qna=false,composerFirst=false,live=false}:{postId:string;user:User|null;requestAuth:()=>void;composerOnly?:boolean;qna?:boolean;composerFirst?:boolean;live?:boolean}) {
 const read=useServerFn(getComments),write=useServerFn(addComment),client=useQueryClient();
 const {data:comments,error,isPending}=useQuery({queryKey:['comments',postId],queryFn:()=>read({data:{postId}}),refetchInterval:live?5000:false});
 const [body,setBody]=useState(''),[pending,setPending]=useState(false),[message,setMessage]=useState('');
 const discussion=<><h3 className="flex items-center gap-2 text-sm"><MessageCircle size={15}/>{qna?'상품 Q&A':'댓글'} · {comments?.length || 0}</h3>{error?<p className="mt-4 text-xs text-destructive">댓글을 불러오지 못했습니다.</p>:isPending?<p className="mt-4 text-xs text-muted-foreground">댓글 불러오는 중…</p>:comments?.length?comments.map(comment=><div key={comment.id} className="mt-4"><div className="review-author text-xs"><span data-no-translate>{comment.creator}</span><BuyerBadge compact/>{comment.created_at&&<time className="ml-2 text-muted-foreground" dateTime={comment.created_at}>{timeAgo(comment.created_at)}</time>}</div><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{comment.body}</p></div>):<p className="mt-4 text-xs text-muted-foreground">아직 댓글이 없습니다.</p>}</>;
 const composer=<form className={composerOnly?"shorts-comment-form":"mt-5 flex gap-2"} onSubmit={async e=>{e.preventDefault();if(!user){requestAuth();return;}if(!body.trim()||pending)return;setPending(true);setMessage('');try{await write({data:{postId,body}});setBody('');await client.invalidateQueries({queryKey:['comments',postId]});}catch{setMessage('댓글을 저장하지 못했습니다. 다시 시도해 주세요.');}finally{setPending(false);}}}><input aria-label={qna?'상품 질문 입력':composerOnly?'숏폼 댓글 입력':'댓글 입력'} placeholder={qna?'상품에 대해 질문해 주세요…':'댓글 남기기…'} className="form-input min-w-0" value={body} onChange={e=>setBody(e.target.value)} maxLength={1000}/><Button type="submit" variant="gold" size="icon" aria-label={qna?'질문 등록':'댓글 보내기'} disabled={pending}><Send/></Button></form>;
 return <section className={composerOnly?'shorts-comment-composer':composerFirst?'shorts-live-comments':'mt-6 border-t border-border pt-5'}>{composerFirst||composerOnly?composer:null}{!composerOnly&&discussion}{!composerFirst&&!composerOnly?composer:null}{message&&<p role="alert" className="mt-3 text-xs text-destructive">{message}</p>}</section>;
}
