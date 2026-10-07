import { useState } from 'react';
import { Copy, Check, Bitcoin, X } from 'lucide-react';
import { Button } from './ui/button';
import { convert } from '@/lib/currency';

/** Crypto is the only accepted payment method. Replace with the real escrow wallets before launch. */
export const cryptoNetworks = [
  { id: 'USDT-TRC20', label: 'USDT (TRC-20)', address: 'TSampleVelaEscrowTrc20AddressXXXXXX', unit: 'USDT', usd: 1 },
  { id: 'USDT-ERC20', label: 'USDT (ERC-20)', address: '0xSampleVelaEscrowErc20Address0000000000', unit: 'USDT', usd: 1 },
  { id: 'BTC', label: 'Bitcoin (BTC)', address: 'bc1qsamplevelaescrowbtcaddress0000000', unit: 'BTC', usd: 65000 },
  { id: 'ETH', label: 'Ethereum (ETH)', address: '0xSampleVelaEscrowEthAddress000000000000', unit: 'ETH', usd: 3200 },
] as const;
export type CryptoNetwork = typeof cryptoNetworks[number]['id'];

export function CryptoNetworkPicker({ value, onChange }: { value: CryptoNetwork; onChange: (v: CryptoNetwork) => void }) {
  return <fieldset className="mt-6"><legend className="text-sm font-semibold">결제 수단 · 암호화폐 전용</legend>
    <div className="mt-3 grid grid-cols-2 gap-2">{cryptoNetworks.map(n => <label key={n.id} className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-xs ${value === n.id ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
      <input type="radio" name="crypto" className="accent-primary" checked={value === n.id} onChange={() => onChange(n.id)} />{n.label}</label>)}</div>
    <p className="mt-2 text-xs text-muted-foreground">신용카드·계좌이체·일반 결제는 지원하지 않습니다.</p></fieldset>;
}

export function CryptoDepositDialog({ network, usd, onClose, onSubmit }: { network: CryptoNetwork; usd: number; onClose: () => void; onSubmit: (txid: string) => void }) {
  const n = cryptoNetworks.find(x => x.id === network)!;
  const [copied, setCopied] = useState(false), [txid, setTxid] = useState('');
  const amount = (convert(usd, 'USD') / n.usd).toFixed(n.usd === 1 ? 2 : 6);
  const valid = /^(0x)?[A-Za-z0-9]{20,100}$/.test(txid.trim());
  return <div role="dialog" aria-modal="true" aria-label="암호화폐 입금" className="fixed inset-0 z-[100] flex items-end justify-center bg-background/80 p-4 sm:items-center">
    <div className="w-full max-w-md rounded-lg border border-primary/40 bg-card p-5">
      <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Bitcoin className="text-primary" size={18}/>에스크로 입금 주소</h2><Button variant="ghost" size="icon" aria-label="닫기" onClick={onClose}><X/></Button></div>
      <p className="mt-3 text-xs text-muted-foreground">아래 주소로 정확한 금액을 보내주세요. 구매 확정 전까지 VELA 에스크로가 보관합니다.</p>
      <p className="mt-4 text-sm">네트워크: <strong className="text-primary">{n.label}</strong></p>
      <p className="mt-1 text-sm">보낼 금액: <strong className="text-primary">{amount} {n.unit}</strong> <span className="text-xs text-muted-foreground">(≈ ${usd.toFixed(2)})</span></p>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-border p-3"><code className="min-w-0 flex-1 break-all text-xs" data-no-translate>{n.address}</code>
        <Button variant="ghost" size="icon" aria-label="주소 복사" onClick={() => { void navigator.clipboard?.writeText(n.address); setCopied(true); }}>{copied ? <Check/> : <Copy/>}</Button></div>
      <p className="mt-2 text-xs text-destructive">다른 네트워크로 보내면 자산을 잃을 수 있습니다.</p>
      <label className="form-label" htmlFor="txid">거래 ID (TXID)</label>
      <input id="txid" className="form-input" data-no-translate value={txid} maxLength={120} placeholder="송금 후 TXID를 붙여 넣으세요" onChange={e => setTxid(e.target.value)} />
      <Button variant="gold" className="mt-4 w-full" disabled={!valid} onClick={() => onSubmit(txid.trim())}>TXID 제출하고 주문하기</Button>
    </div></div>;
}
