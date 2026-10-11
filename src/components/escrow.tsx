import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ReviewModal } from './customer-reviews';
import { Camera, Check, Lock, MapPin, Package, ShieldCheck, Truck, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dollars } from '@/lib/luxury-market';
import { escrowSteps, QC_MAX, QC_MIN, qcAreas, stageLabel, stepIndex, validQcCount, type EscrowStage } from '@/lib/escrow';
import { useMarketPreview, type PreviewOrder, type QcMedia } from './market-preview';
import { LiveOrderBoard } from './live-orders';

export function EscrowTimeline({stage,preview=false}:{stage?:EscrowStage;preview?:boolean}){
 const active=stage?stepIndex(stage):-1, done=stage==='delivered';
 return <ol className={`escrow-steps ${preview?'is-preview':''}`} aria-label="Order timeline">{escrowSteps.map((s,i)=><li key={s.en} className={i<active||done?'done':i===active?'active':''} aria-current={i===active?'step':undefined}><span className="escrow-dot">{i<active||done?<Check size={11}/>:i+1}</span><strong>{s.en}</strong><small>{s.ko}</small></li>)}</ol>;
}

export function EscrowGuarantee(){
 return <section className="escrow-card" aria-label="Escrow protection"><div className="escrow-card-head"><span className="escrow-shield"><ShieldCheck size={20}/></span><div><strong>100% Escrow Protection</strong><p>Payment is held safely by VELA until the buyer confirms final delivery after receiving the item.</p></div></div><EscrowTimeline preview/><p className="escrow-fine"><Lock size={11}/> Preview flow · payment processing is not connected yet.</p></section>;
}

function useFiles(){
 const [files,setFiles]=useState<QcMedia[]>([]);
 const add=(list:FileList|null)=>{if(!list)return;const next=[...list].filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/')).map(f=>({url:URL.createObjectURL(f),type:f.type.startsWith('video/')?'video' as const:'image' as const,name:f.name}));setFiles(prev=>[...prev,...next]);};
 return {files,add,remove:(i:number)=>setFiles(prev=>prev.filter((_,j)=>j!==i)),reset:()=>setFiles([])};
}
function MediaGrid({media}:{media:QcMedia[]}){
 const [open,setOpen]=useState<number|null>(null);
 return <><div className="qc-grid">{media.map((m,i)=><button type="button" key={m.url} onClick={()=>setOpen(i)} aria-label={`Open QC file ${i+1}`}>{m.type==='video'?<video src={m.url} muted playsInline preload="metadata"/>:<img src={m.url} alt={`QC inspection ${i+1}`}/>}<span>{i+1}</span></button>)}</div>
 {open!==null&&media[open]&&<div className="qc-lightbox" role="dialog" aria-label="QC file"><Button variant="ghost" size="icon" aria-label="Close" onClick={()=>setOpen(null)}><X/></Button>{media[open]!.type==='video'?<video src={media[open]!.url} controls autoPlay playsInline/>:<img src={media[open]!.url} alt={`QC inspection ${open+1}`}/>}<p>{open+1} / {media.length}</p></div>}</>;
}

function OrderHead({o}:{o:PreviewOrder}){return <div className="escrow-order-head">{o.image?<img src={o.image} width={52} height={52} alt=""/>:<Package className="text-primary"/>}<div><span className="lux-eyebrow">{o.id}</span><strong>{o.title}</strong><small>{stageLabel(o.stage)}</small></div><div className="text-right"><strong>{dollars(o.amount)}</strong><small className={o.released?'text-primary':''}><Lock size={10} className="mr-1 inline"/>{o.released?'Released to seller':'Held in escrow'}</small></div></div>;}

function RequestDialog({o,close}:{o:PreviewOrder;close:()=>void}){
 const p=useMarketPreview();const [areas,setAreas]=useState<string[]>([]);const [note,setNote]=useState('');
 return <div className="qc-request" role="dialog" aria-label="Request additional photos"><h3>Request Additional Photos · 추가 사진 요청</h3><p>Select the areas that need extra photos or videos.</p><div className="qc-areas">{qcAreas.map(a=><button type="button" key={a} aria-pressed={areas.includes(a)} className={areas.includes(a)?'active':''} onClick={()=>setAreas(prev=>prev.includes(a)?prev.filter(x=>x!==a):[...prev,a])}>{a}</button>)}</div><label className="form-label" htmlFor={`note-${o.id}`}>Note (optional)</label><textarea id={`note-${o.id}`} className="form-input" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Please show lume in full darkness"/><div className="escrow-actions"><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="gold" disabled={!areas.length} onClick={()=>{p.requestPhotos(o.id,areas,note.trim());close();}}>Send request</Button></div></div>;
}

export function BuyerOrderBoard(){
 const p=useMarketPreview();const [asking,setAsking]=useState<string|null>(null);const [reviewing,setReviewing]=useState<string|null>(null);const navigate=useNavigate();
 if(!p.orders.length)return <p className="py-10 text-center text-muted-foreground">No orders yet.</p>;
 return <div className="escrow-board"><LiveOrderBoard as="buyer"/><p className="sample-notice">Sample escrow orders · no real payment is held</p>{p.orders.map(o=><article className="escrow-order" key={o.id}><OrderHead o={o}/><EscrowTimeline stage={o.stage}/>
  {o.notices[0]&&<p className="escrow-notice" role="status">{o.notices[0]}</p>}
  {o.stage==='qc_requested'&&o.request&&<p className="escrow-wait">Waiting for the seller to upload supplementary photos: {o.request.areas.join(', ')}{o.request.note?` — “${o.request.note}”`:''}</p>}
  {o.qcMedia.length>0&&['qc_done','qc_requested'].includes(o.stage)&&<><h4 className="escrow-sub"><Camera size={14}/> Seller QC gallery · {o.qcMedia.length} files</h4><MediaGrid media={o.qcMedia}/></>}
  {o.stage==='qc_done'&&(asking===o.id?<RequestDialog o={o} close={()=>setAsking(null)}/>:<div className="escrow-actions"><Button variant="gold" onClick={()=>p.setStage(o.id,'shipping_prep','QC approved by buyer · seller preparing shipment')}><Check/>Approve QC (OK) · 검수 승인</Button><Button variant="goldOutline" onClick={()=>setAsking(o.id)}><Camera/>Request Additional Photos · 추가 사진 요청</Button></div>)}
  {o.tracking&&<div className="tracking-widget"><Truck className="text-primary"/><div><span>Courier</span><strong>{o.tracking.courier}</strong></div><div><span>Tracking number</span><strong>{o.tracking.number}</strong></div><div><span><MapPin size={10} className="inline"/> Current location</span><strong>{o.tracking.location}</strong></div><small>Seller-entered sample status · live courier feed not connected</small></div>}
  {o.stage==='shipped'&&<Button variant="gold" className="w-full" onClick={()=>{p.confirmDelivery(o.id);setReviewing(o.id);}}><ShieldCheck/>Confirm Delivery · 수령 확인 및 구매 확정</Button>}
  {o.stage==='delivered'&&<p className="escrow-done"><Check size={14}/> Purchase confirmed · escrow released to the seller (sample).</p>}
  {o.stage==='delivered'&&!o.reviewed&&<Button variant="goldOutline" className="mt-3 w-full" onClick={()=>setReviewing(o.id)}>리뷰 쓰기</Button>}
 </article>)}{reviewing&&<ReviewModal orderId={reviewing} close={()=>setReviewing(null)} requestAuth={()=>void navigate({to:'.',search:(prev:Record<string,unknown>)=>({...prev,auth:true})} as never)}/>}</div>;
}

function QcUpload({o,supplement}:{o:PreviewOrder;supplement:boolean}){
 const p=useMarketPreview();const f=useFiles();
 const ok=supplement?f.files.length>=1&&f.files.length<=10:validQcCount(f.files.length);
 return <div className="qc-upload"><label className="qc-drop"><Upload size={18}/><span>{supplement?`Upload supplementary photos/videos for: ${o.request?.areas.join(', ')}`:`Upload ${QC_MIN}–${QC_MAX} seller-taken QC photos & videos`}</span><input type="file" accept="image/*,video/*" multiple onChange={e=>{f.add(e.target.files);e.target.value='';}}/></label>
  <p className={`qc-count ${ok?'ok':''}`}>{f.files.length} selected {supplement?'(1–10)':`· required ${QC_MIN}–${QC_MAX}`}</p>
  {f.files.length>0&&<div className="qc-grid">{f.files.map((m,i)=><div key={m.url} className="qc-thumb">{m.type==='video'?<video src={m.url} muted playsInline/>:<img src={m.url} alt={m.name}/>}<button type="button" aria-label={`Remove ${m.name}`} onClick={()=>f.remove(i)}><X size={12}/></button></div>)}</div>}
  <Button variant="gold" disabled={!ok} onClick={()=>{p.submitQc(o.id,f.files);f.reset();}}><Check/>{supplement?'Re-submit for approval':'Mark QC Completed & notify buyer'}</Button></div>;
}
function ShipForm({o}:{o:PreviewOrder}){
 const p=useMarketPreview();const [courier,setCourier]=useState('SF Express');const [number,setNumber]=useState('');const [location,setLocation]=useState('Origin facility · Shenzhen');
 return <form className="ship-form" onSubmit={e=>{e.preventDefault();p.ship(o.id,{courier,number:number.trim(),location:location.trim()});}}><select className="form-input" value={courier} onChange={e=>setCourier(e.target.value)} aria-label="Courier">{['SF Express','EMS','DHL Express','FedEx','CJ Logistics'].map(c=><option key={c}>{c}</option>)}</select><input className="form-input" required maxLength={40} pattern="[A-Za-z0-9\-]{6,40}" value={number} onChange={e=>setNumber(e.target.value)} placeholder="Tracking number" aria-label="Tracking number"/><input className="form-input" required maxLength={80} value={location} onChange={e=>setLocation(e.target.value)} aria-label="Current location"/><Button variant="gold" type="submit"><Truck/>Mark Shipped</Button></form>;
}
function LocationUpdate({o}:{o:PreviewOrder}){const p=useMarketPreview();const [v,setV]=useState('');return <form className="ship-form" onSubmit={e=>{e.preventDefault();if(o.tracking&&v.trim())p.ship(o.id,{...o.tracking,location:v.trim()});setV('');}}><input className="form-input" maxLength={80} value={v} onChange={e=>setV(e.target.value)} placeholder="Update current location" aria-label="Update current location"/><Button variant="goldOutline" type="submit"><MapPin/>Update</Button></form>;}

export function SellerOrderControl(){
 const p=useMarketPreview();
 return <div className="escrow-board">{p.orders.map(o=><article className="escrow-order" key={o.id}><OrderHead o={o}/><EscrowTimeline stage={o.stage}/>
  {o.stage==='placed'&&<Button variant="gold" onClick={()=>p.setStage(o.id,'preparing','Seller is preparing your product')}>Start Preparing Product</Button>}
  {o.stage==='preparing'&&<Button variant="gold" onClick={()=>p.setStage(o.id,'qc','Seller started QC inspection')}>Start QC Inspection</Button>}
  {o.stage==='qc'&&<QcUpload o={o} supplement={false}/>}
  {o.stage==='qc_requested'&&<QcUpload o={o} supplement/>}
  {o.stage==='qc_done'&&<p className="escrow-wait">{`Waiting for buyer QC approval (${o.qcMedia.length} files sent).`}</p>}
  {o.stage==='shipping_prep'&&<ShipForm o={o}/>}
  {o.stage==='shipped'&&<><p className="escrow-wait">Shipped · awaiting buyer delivery confirmation to release escrow.</p><LocationUpdate o={o}/></>}
  {o.stage==='delivered'&&<p className="escrow-done"><Check size={14}/> Escrow released · {dollars(o.amount)} (sample)</p>}
 </article>)}</div>;
}
