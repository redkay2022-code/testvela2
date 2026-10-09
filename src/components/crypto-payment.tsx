import { useEffect, useState } from 'react';
import { Copy, Check, Wallet, X, QrCode, Zap, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from './ui/button';
import { convert } from '@/lib/currency';

/**
 * USDT-only escrow networks. `ready:false` means the platform address is still a placeholder:
 * wallet auto-pay stays disabled so no buyer can send real funds to an unowned address.
 */
export const cryptoNetworks = [
  { id: 'USDT-TRC20', label: 'USDT (TRC-20)', chain: 'TRON 네트워크', address: 'TSampleVelaEscrowTrc20AddressXXXXXX', unit: 'USDT', usd: 1, kind: 'tron', token: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6, ready: false, gas: '약 1–15 TRX (에너지)' },
  { id: 'USDT-ERC20', label: 'USDT (ERC-20)', chain: 'Ethereum 네트워크', address: '0xSampleVelaEscrowErc20Address0000000000', unit: 'USDT', usd: 1, kind: 'evm', chainId: 1, native: 'ETH', token: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, ready: false, gas: '' },
  { id: 'USDT-POLYGON', label: 'USDT (Polygon)', chain: 'Polygon 네트워크', address: '0xSampleVelaEscrowPolygonAddress00000000', unit: 'USDT', usd: 1, kind: 'evm', chainId: 137, native: 'POL', token: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, ready: false, gas: '' },
  { id: 'USDT-BEP20', label: 'USDT (BEP-20)', chain: 'BNB Smart Chain', address: '0xSampleVelaEscrowBep20Address0000000000', unit: 'USDT', usd: 1, kind: 'evm', chainId: 56, native: 'BNB', token: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, ready: false, gas: '' },
] as const;
export type CryptoNetwork = typeof cryptoNetworks[number]['id'];
type Net = typeof cryptoNetworks[number];

export function CryptoNetworkPicker({ value, onChange }: { value: CryptoNetwork; onChange: (v: CryptoNetwork) => void }) {
  return <fieldset className="mt-6"><legend className="text-sm font-semibold">USDT 네트워크 선택</legend>
    <div className="mt-3 grid grid-cols-2 gap-2">{cryptoNetworks.map(n => <label key={n.id} className={`flex cursor-pointer flex-col gap-0.5 rounded-md border p-3 text-xs ${value === n.id ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
      <span className="flex items-center gap-2"><input type="radio" name="crypto" className="accent-primary" checked={value === n.id} onChange={() => onChange(n.id)} /><strong>{n.label}</strong></span><span className="pl-5 text-[11px] opacity-80">{n.chain}</span></label>)}</div>
    <p className="mt-2 text-xs text-muted-foreground">USDT 전용 결제입니다. 신용카드·계좌이체는 지원하지 않습니다.</p></fieldset>;
}

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
type Tron = { defaultAddress?: { base58?: string }; contract: () => { at: (a: string) => Promise<{ transfer: (to: string, v: string) => { send: () => Promise<string> } }> } };
const eth = () => (globalThis as unknown as { ethereum?: Eth }).ethereum;
const tron = () => (globalThis as unknown as { tronWeb?: Tron; tronLink?: { request: (a: { method: string }) => Promise<unknown> } });

/** Integer token units as decimal string, avoiding float drift. */
export function toUnits(amount: string, decimals: number) {
  const [w, f = ''] = amount.split('.');
  return (BigInt(w || '0') * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0')).toString();
}
/** ERC-20 transfer(address,uint256) calldata. */
export function erc20TransferData(to: string, units: string) {
  return '0xa9059cbb' + to.toLowerCase().replace(/^0x/, '').padStart(64, '0') + BigInt(units).toString(16).padStart(64, '0');
}

function CopyRow({ label, value, button }: { label: string; value: string; button: string }) {
  const [ok, setOk] = useState(false);
  return <div className="mt-3"><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-background/60 p-3"><code className="min-w-0 flex-1 break-all text-xs" data-no-translate>{value}</code>
    <Button type="button" variant="goldOutline" size="sm" onClick={() => { void navigator.clipboard?.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); }}>{ok ? <Check size={14} /> : <Copy size={14} />}{ok ? '복사됨' : button}</Button></div></div>;
}

export function CryptoDepositDialog({ network, usd, onClose, onSubmit, onNetwork }: { network: CryptoNetwork; usd: number; onClose: () => void; onSubmit: (txid: string) => void; onNetwork?: (n: CryptoNetwork) => void }) {
  const n = cryptoNetworks.find(x => x.id === network)! as Net;
  const [tab, setTab] = useState<'auto' | 'direct'>('auto');
  const amount = convert(usd, 'USD').toFixed(2);
  return <div role="dialog" aria-modal="true" aria-label="USDT 결제" className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-3 sm:items-center">
    <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-xl border border-primary/40 bg-card p-5 shadow-2xl">
      <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="text-primary" size={18} />USDT 에스크로 결제</h2><Button type="button" variant="ghost" size="icon" aria-label="닫기" onClick={onClose}><X /></Button></div>
      <div className="mt-3 rounded-lg border border-primary/30 bg-background/50 p-3 text-center"><p className="text-xs text-muted-foreground">결제 금액</p><p className="mt-1 text-2xl font-semibold text-primary" data-no-translate>{amount} USDT</p><p className="text-xs text-muted-foreground">≈ ${usd.toFixed(2)}</p></div>
      <div role="tablist" className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
        <button type="button" role="tab" aria-selected={tab === 'auto'} onClick={() => setTab('auto')} className={`rounded-md px-2 py-2 text-xs ${tab === 'auto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><Zap size={13} className="mr-1 inline" />자동 지갑 연결 결제<span className="block text-[10px] opacity-80">추천</span></button>
        <button type="button" role="tab" aria-selected={tab === 'direct'} onClick={() => setTab('direct')} className={`rounded-md px-2 py-2 text-xs ${tab === 'direct' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><QrCode size={13} className="mr-1 inline" />지갑 주소 직접 입금<span className="block text-[10px] opacity-80">QR · 주소 복사</span></button>
      </div>
      {onNetwork && <div className="mt-4 grid grid-cols-2 gap-2">{cryptoNetworks.map(x => <button type="button" key={x.id} onClick={() => onNetwork(x.id)} className={`rounded-md border p-2 text-left text-xs ${x.id === network ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}><strong className="block">{x.label}</strong><span className="text-[10px]">{x.chain}</span></button>)}</div>}
      {tab === 'auto' ? <AutoPay key={n.id} n={n} amount={amount} onPaid={onSubmit} /> : <DirectPay key={n.id} n={n} amount={amount} onSubmit={onSubmit} />}
      <p className="mt-4 text-xs text-destructive">반드시 선택한 네트워크({n.chain})로 보내주세요. 다른 네트워크로 보내면 자산을 잃을 수 있습니다.</p>
    </div></div>;
}

function AutoPay({ n, amount, onPaid }: { n: Net; amount: string; onPaid: (tx: string) => void }) {
  const [account, setAccount] = useState(''), [gas, setGas] = useState<string>(n.gas), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const connect = async () => {
    setErr('');
    try {
      if (n.kind === 'tron') { const t = tron(); await t.tronLink?.request({ method: 'tron_requestAccounts' }); const a = t.tronWeb?.defaultAddress?.base58; if (!a) throw new Error('TronLink 또는 Trust Wallet(TRON) 지갑을 열어 주세요.'); setAccount(a); return; }
      const p = eth(); if (!p) throw new Error('지갑을 찾을 수 없습니다. MetaMask·Trust Wallet·Coinbase Wallet 앱의 브라우저에서 열어 주세요.');
      const [a = ''] = await p.request({ method: 'eth_requestAccounts' }) as string[];
      try { await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + n.chainId.toString(16) }] }); } catch { throw new Error(`지갑에서 ${n.chain}으로 전환해 주세요.`); }
      setAccount(a);
      const price = BigInt(await p.request({ method: 'eth_gasPrice' }) as string);
      setGas(`약 ${(Number(price * 65000n) / 1e18).toFixed(6)} ${n.native}`);
    } catch (e) { setErr(e instanceof Error ? e.message : '지갑 연결에 실패했습니다.'); }
  };
  const pay = async () => {
    setBusy(true); setErr('');
    try {
      const units = toUnits(amount, n.decimals);
      let tx: string;
      if (n.kind === 'tron') { const c = await tron().tronWeb!.contract().at(n.token); tx = await c.transfer(n.address, units).send(); }
      else tx = await eth()!.request({ method: 'eth_sendTransaction', params: [{ from: account, to: n.token, data: erc20TransferData(n.address, units) }] }) as string;
      onPaid(tx);
    } catch (e) { setErr(e instanceof Error ? e.message : '결제가 취소되었습니다.'); } finally { setBusy(false); }
  };
  return <div className="mt-4">
    {!account ? <Button type="button" variant="gold" className="w-full" onClick={connect}><Wallet size={16} />지갑 연결하기</Button>
      : <p className="rounded-md border border-border p-3 text-xs">연결된 지갑: <code data-no-translate>{account.slice(0, 6)}…{account.slice(-4)}</code></p>}
    <p className="mt-2 text-[11px] text-muted-foreground">MetaMask · Trust Wallet · Coinbase Wallet · TronLink 지원</p>
    <dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><dt className="text-muted-foreground">총 결제 금액</dt><dd className="font-semibold text-primary" data-no-translate>{amount} USDT</dd></div>
      <div className="flex justify-between"><dt className="text-muted-foreground">네트워크 가스비 (예상)</dt><dd data-no-translate>{gas || '지갑 연결 후 표시'}</dd></div></dl>
    {!n.ready && <p className="mt-3 rounded-md border border-primary/30 p-2 text-xs text-muted-foreground">플랫폼 입금 지갑이 아직 등록되지 않아 자동 결제는 오픈 준비 중입니다.</p>}
    {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
    <Button type="button" variant="gold" className="mt-4 w-full" disabled={!account || busy || !n.ready} onClick={pay}>{busy ? '지갑에서 승인 대기 중…' : 'USDT 결제 승인'}</Button>
  </div>;
}

function DirectPay({ n, amount, onSubmit }: { n: Net; amount: string; onSubmit: (tx: string) => void }) {
  const [qr, setQr] = useState(''), [confirm, setConfirm] = useState(false), [txid, setTxid] = useState('');
  useEffect(() => { void QRCode.toDataURL(n.address, { margin: 1, width: 220, color: { dark: '#0D0D0F', light: '#F5E7B8' } }).then(setQr); }, [n.address]);
  const t = txid.trim(), valid = !t || /^(0x)?[A-Za-z0-9]{20,100}$/.test(t);
  return <div className="mt-4">
    <div className="flex justify-center">{qr && <img src={qr} width={190} height={190} alt={`${n.label} 입금 주소 QR 코드`} className="rounded-lg border border-primary/40" />}</div>
    <CopyRow label={`플랫폼 입금 주소 · ${n.chain}`} value={n.address} button="주소 복사" />
    <CopyRow label="정확한 입금 금액" value={amount} button="금액 복사" />
    {!confirm ? <Button type="button" variant="gold" className="mt-5 w-full" onClick={() => setConfirm(true)}>입금 완료</Button> : <div className="mt-5">
      <label className="form-label" htmlFor="txid">거래 해시 (TXID) · 선택</label>
      <input id="txid" className="form-input" data-no-translate value={txid} maxLength={120} placeholder="입력하면 에스크로 확인이 빨라집니다" onChange={e => setTxid(e.target.value)} />
      <Button type="button" variant="gold" className="mt-3 w-full" disabled={!valid} onClick={() => onSubmit(t)}>주문 확정하기</Button></div>}
  </div>;
}
