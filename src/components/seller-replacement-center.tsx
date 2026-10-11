import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import type { User } from '@supabase/supabase-js';
import { RefreshCw, Upload, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { saveReplacement } from '@/lib/seller-workflows.functions';
import { useSellerWorkflows } from '@/lib/use-seller-workflows';
import { Button } from './ui/button';
export function SellerReplacementCenter({user}:{user:User}) {
 const q=useSellerWorkflows(user.id),reported=(q.data?.orders??[]).filter(o=>o.dispute_open);
 return <section className="seller-section"><h2 className="flex items-center gap-2"><RefreshCw className="size-5 text-primary"/>초기불량/교환 센터</h2><p className="mb-4 text-sm text-muted-foreground">불량 확인 시 동일 상품의 새 제품으로 1:1 교환 · 교환품 출고 전 QC 필수</p>{reported.length?reported.map(o=><ReplacementForm key={o.id} user={user} orderId={o.id} title={o.title} orderNo={o.order_no} current={q.data?.replacements.find(r=>r.order_id===o.id)} onSaved={()=>void q.refetch()}/>):<p className="seller-empty">접수된 불량·분쟁 주문이 없습니다.</p>}</section>;
}
function ReplacementForm({user,orderId,title,orderNo,current,onSaved}:{user:User;orderId:string;title:string;orderNo:string;current:{reason:string;status:string;tracking_number:string|null}|undefined;onSaved:()=>void}) {
 const save=useServerFn(saveReplacement),[reason,setReason]=useState(current?.reason??''),[courier,setCourier]=useState(''),[tracking,setTracking]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[files,setFiles]=useState<File[]>([]);
 const perform=async(ship:boolean)=>{setBusy(true);setMessage('');try{
  if(ship&&files.length){
   if(files.filter(f=>f.type.startsWith('image/')).length<9||files.filter(f=>f.type.startsWith('video/')).length<1)throw new Error('QC 사진 9장과 영상 1개를 선택해 주세요.');
   const {data:existing,error:readError}=await supabase.from('order_qc_media').select('round').eq('order_id',orderId);if(readError)throw new Error('QC 자료를 확인하지 못했습니다.');
   const round=Math.max(1,...(existing??[]).map(m=>m.round))+1;
   for(const file of files){const ext=file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g,'')??'bin',path=`${orderId}/${crypto.randomUUID()}.${ext}`;
    const {error:uploadError}=await supabase.storage.from('qc-media').upload(path,file);if(uploadError)throw new Error('교환품 QC 업로드에 실패했습니다.');
    const {error:insertError}=await supabase.from('order_qc_media').insert({order_id:orderId,uploader_id:user.id,path,kind:file.type.startsWith('image/')?'image':'video',round});if(insertError)throw new Error('QC 자료 저장에 실패했습니다.');
   }
  }
  await save({data:{orderId,reason,...(ship?{courier,tracking}:{})}});setFiles([]);setMessage(ship?'새 제품 발송이 저장되었습니다.':'새 제품 교환 준비가 저장되었습니다.');onSaved();
 }catch(e){setMessage(e instanceof Error?e.message:'교환 처리를 저장하지 못했습니다.');}finally{setBusy(false);}};
 return <article className="seller-replacement"><div className="flex flex-wrap justify-between gap-2"><strong>{title}</strong><span className="text-xs text-primary">{current?.status==='shipped'?'교환품 발송 완료':current?'교환품 준비 중':'불량·분쟁 접수'}</span></div><small className="text-muted-foreground">{orderNo}</small>{current?.status==='shipped'?<p className="mt-3 text-sm">송장번호: {current.tracking_number}</p>:<><textarea className="form-input my-3" aria-label="교환 사유" placeholder="확인된 불량 및 교환 사유" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/><Button variant="goldOutline" disabled={busy||reason.trim().length<2} onClick={()=>void perform(false)}><RefreshCw/>새 제품 교환 준비</Button><div className="mt-5 grid gap-3"><label className="flex cursor-pointer items-center gap-2 text-sm text-primary"><Upload className="size-4"/>교환품 QC 사진 9장 + 영상 1개<input className="sr-only" type="file" multiple accept="image/*,video/*" onChange={e=>setFiles(Array.from(e.target.files??[]))}/></label><span className="text-xs text-muted-foreground">{`사진 ${files.filter(f=>f.type.startsWith('image/')).length}장 · 영상 ${files.filter(f=>f.type.startsWith('video/')).length}개`}</span><input className="form-input" aria-label="교환 택배사" placeholder="택배사" value={courier} onChange={e=>setCourier(e.target.value)}/><input className="form-input" aria-label="교환 송장번호" placeholder="교환품 송장번호" value={tracking} onChange={e=>setTracking(e.target.value)}/><Button variant="gold" disabled={busy||!current||!tracking||!courier} onClick={()=>void perform(true)}><Truck/>새 제품 발송 등록</Button></div></>}{message&&<p role="status" className="mt-3 text-sm text-primary">{message}</p>}</article>;
}