export type EscrowStage='placed'|'preparing'|'qc'|'qc_done'|'qc_requested'|'shipping_prep'|'shipped'|'delivered';
export const escrowSteps=[
 {en:'Pending Escrow / Payment Confirmed',ko:'결제 완료 및 에스크로 보관'},
 {en:'Preparing Product',ko:'제품 준비'},
 {en:'QC Inspecting',ko:'셀러 검수 중'},
 {en:'QC Completed',ko:'검수 완료 & 승인 대기'},
 {en:'Preparing Shipment',ko:'배송 준비'},
 {en:'Shipped',ko:'발송 완료 & 실시간 트래킹'},
] as const;
export const QC_MIN=9, QC_MAX=19;
export const qcAreas=['Dial','Movement','Lume Test','Clasp','Case Back','Bezel','Crown','Bracelet'];
/** Zero-based index of the active step in the 6-step timeline. */
export function stepIndex(stage:EscrowStage){return ({placed:0,preparing:1,qc:2,qc_requested:2,qc_done:3,shipping_prep:4,shipped:5,delivered:5} as const)[stage];}
export function stageLabel(stage:EscrowStage){if(stage==='qc_requested')return 'QC Photo Requested · 추가 사진 요청';if(stage==='delivered')return 'Delivered · 구매 확정';const s=escrowSteps[stepIndex(stage)];return `${s.en} · ${s.ko}`;}
export function validQcCount(n:number){return n>=QC_MIN&&n<=QC_MAX;}
