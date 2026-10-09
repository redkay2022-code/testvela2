import { useEffect, useState } from 'react';
import { Copy, Check, Wallet, X, QrCode, Zap, ShieldCheck, CreditCard } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from './ui/button';
import { convert } from '@/lib/currency';
import './checkout.css';

/**
 * USDT-only escrow networks. `ready:false` means the platform address is still a placeholder:
 * wallet auto-pay stays disabled so no buyer can send real funds to an unowned address.
 */
export const cryptoNetworks = [
  { id: 'USDT-TRC20', label: 'USDT (TRC-20)', chain: 'TRON 네트워크', address: 'TDmP3UVG9QZkWGWzSKrGJWh8wz9kdGEb6E', unit: 'USDT', usd: 1, kind: 'tron', token: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6, ready: true, gas: '약 1–15 TRX (에너지)' },
  { id: 'USDT-ERC20', label: 'USDT (ERC-20)', chain: 'Ethereum 네트워크', address: '0x54212Ae966af6521514A890d665a1A8747f7b3a1', unit: 'USDT', usd: 1, kind: 'evm', chainId: 1, native: 'ETH', token: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, ready: true, gas: '' },
  { id: 'USDT-POLYGON', label: 'USDT (Polygon)', chain: 'Polygon 네트워크', address: '0x54212Ae966af6521514A890d665a1A8747f7b3a1', unit: 'USDT', usd: 1, kind: 'evm', chainId: 137, native: 'POL', token: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, ready: true, gas: '' },
  { id: 'USDT-BEP20', label: 'USDT (BEP-20)', chain: 'BNB Smart Chain', address: '0x54212Ae966af6521514A890d665a1A8747f7b3a1', unit: 'USDT', usd: 1, kind: 'evm', chainId: 56, native: 'BNB', token: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, ready: true, gas: '' },
] as const;
export type CryptoNetwork = typeof cryptoNetworks[number]['id'];
type Net = typeof cryptoNetworks[number];

export function CryptoNetworkPicker({ value, onChange }: { value: CryptoNetwork; onChange: (v: CryptoNetwork) => void }) {
  return <label className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">송금 네트워크<select aria-label="USDT 네트워크 선택" className="form-input min-w-0 flex-1 py-2" value={value} onChange={e => { const selected = cryptoNetworks.find(n => n.id === e.target.value); if (selected) onChange(selected.id); }}>{cryptoNetworks.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label>;
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
  return <div className="payment-copy"><p className="text-[10px] text-muted-foreground">{label}</p><div className="payment-copy-line"><code data-no-translate>{value}</code>
    <Button type="button" variant="ghost" size="icon" aria-label={ok ? '복사됨' : button} title={ok ? '복사됨' : button} onClick={async () => { try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); } catch { setOk(false); } }}>{ok ? <Check size={14} /> : <Copy size={14} />}</Button></div></div>;
}

/** MoonPay buy URL sending USDT (TRC-20) to the platform escrow address. */
export function moonpayUrl(usd: number, address: string) {
  const q = new URLSearchParams({ currencyCode: 'usdt_trx', baseCurrencyCode: 'usd', baseCurrencyAmount: usd.toFixed(2), walletAddress: address });
  return `https://buy.moonpay.com/?${q}`;
}

/**
 * Buyer-first trust copy shown at the top of every payment surface. `data-no-translate` keeps it
 * verbatim in all UI languages. Every claim stays inside what the platform actually does — no card
 * or bank storage, escrow released only on buyer approval, USDT settlement. It deliberately makes no
 * anonymity, KYC-free, or surveillance/tax-evasion promise: card on-ramps run identity checks and
 * public ledgers are traceable, so such wording would mislead buyers and create legal exposure.
 */
export const trustTitle = '🛡️ VELA Customer Safety First Payment System';
export const trustPillars = [
  ['🔒 100% Privacy & Financial Data Protection', 'VELA never stores your credit card, bank, or personal financial details. Every payment session is end-to-end encrypted, and your information is never sold or shared.'],
  ['💎 Scam Protection & 100% Escrow Guarantee', 'Your payment is locked in VELA’s neutral smart escrow and released to the seller only after you receive, inspect, and approve your luxury item. If it does not match the description, full refund protection applies.'],
  ['🌐 Secure USDT Crypto Settlement', 'Every order settles seamlessly in USDT — no card details change hands, no bank intermediary, and confirmation reaches buyer and seller anywhere in the world within minutes.'],
] as const;

export function TrustBanner() {
  return <section className="payment-trust" aria-label="결제 보안 보장" data-no-translate>
    <h3 className="payment-trust-title">{trustTitle}</h3>
    <ul>{trustPillars.map(([t, d]) => <li key={t}><span><strong>{t}</strong><span>{d}</span></span></li>)}</ul>
  </section>;
}

function CardPay({ usd, amount, onSubmit }: { usd: number; amount: string; onSubmit: (tx: string) => void }) {
  const trc = cryptoNetworks[0];
  const [opened, setOpened] = useState(false);
  return <div className="mt-4">
    <div className="border-b border-border pb-3 text-sm"><p className="font-semibold text-primary" data-no-translate>${usd.toFixed(2)} USD → ≈ {amount} USDT</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">카드·Apple Pay 제공 여부는 국가와 기기에 따라 다릅니다. 수수료·본인 확인·최종 수령액은 MoonPay에서 확인하세요. 실제 VELA 입금액이 결제 금액과 일치해야 합니다.</p></div>
    <Button type="button" variant="gold" className="mt-4 w-full" onClick={() => { window.open(moonpayUrl(usd, trc.address), '_blank', 'noopener,noreferrer'); setOpened(true); }}><CreditCard size={16} />카드로 결제하고 USDT 자동 송금</Button>
    {opened && <><p className="mt-2 text-[11px] text-muted-foreground">새 창이 열리지 않았다면 팝업을 허용해 주세요. 입금은 관리자가 별도로 확인합니다.</p><Button type="button" variant="goldOutline" className="mt-2 w-full" onClick={() => onSubmit('')}>송금 완료 · 입금 확인 요청</Button></>}
  </div>;
}

export type CryptoPaymentTab = 'direct' | 'card' | 'auto';

export const cryptoPaymentTabs = [
  { id: 'direct', label: 'USDT 직접 송금', description: 'QR·입금 주소' },
  { id: 'card', label: '카드·Apple Pay', description: 'MoonPay에서 USDT 구매' },
  { id: 'auto', label: '지갑 자동 연결', description: 'MetaMask·TronLink' },
] as const;

export function CryptoPaymentTabs({ value, onChange, compact = false }: { value: CryptoPaymentTab; onChange: (tab: CryptoPaymentTab) => void; compact?: boolean }) {
  const icons = { direct: QrCode, card: CreditCard, auto: Zap } as const;
  return <div role="tablist" aria-label="결제 방법" className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
    {cryptoPaymentTabs.map(({ id, label, description }) => {
      const Icon = icons[id];
      return <Button key={id} type="button" role="tab" aria-selected={value === id} variant={value === id ? 'gold' : 'ghost'} onClick={() => onChange(id)} className="h-auto min-h-11 flex-col gap-1 whitespace-normal px-1 py-2 text-center text-[10px] leading-tight sm:text-xs">
        <span className="inline-flex items-center justify-center gap-1"><Icon size={13} />{label}</span>
        {!compact && <span className={value === id ? 'text-primary-foreground/80' : 'text-muted-foreground'}>{description}</span>}
      </Button>;
    })}
  </div>;
}

export function CryptoDepositDialog({ network, usd, initialTab = 'direct', onClose, onSubmit, onNetwork }: { network: CryptoNetwork; usd: number; initialTab?: CryptoPaymentTab; onClose: () => void; onSubmit: (txid: string) => void; onNetwork?: (n: CryptoNetwork) => void }) {
  const n = cryptoNetworks.find(x => x.id === network) ?? cryptoNetworks[0];
  const [tab, setTab] = useState<CryptoPaymentTab>(initialTab);
  const amount = convert(usd, 'USD').toFixed(2);
  return <div role="dialog" aria-modal="true" aria-label="USDT 결제" className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-3 sm:items-center">
    <div className="payment-surface">
      <div className="payment-heading"><h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="text-primary" size={18} />안전 에스크로 결제</h2><Button type="button" variant="ghost" size="icon" aria-label="닫기" onClick={onClose}><X /></Button></div>
      <div className="payment-content">
      <TrustBanner />
      <div className="payment-amount"><span className="text-xs text-muted-foreground">총 결제 금액<br/><span data-no-translate>≈ ${usd.toFixed(2)} USD</span></span><strong data-no-translate>{amount} USDT</strong></div>
      <CryptoPaymentTabs compact value={tab} onChange={id => { setTab(id); if (id === 'card') onNetwork?.('USDT-TRC20'); }} />
      {tab !== 'card' && onNetwork && <CryptoNetworkPicker value={network} onChange={onNetwork} />}
      {tab === 'card' ? <CardPay usd={usd} amount={amount} onSubmit={onSubmit} /> : tab === 'auto' ? <AutoPay key={n.id} n={n} amount={amount} onPaid={onSubmit} /> : <DirectPay key={n.id} n={n} amount={amount} onSubmit={onSubmit} />}
      {tab !== 'card' && <p className="mt-3 text-[11px] text-destructive">송금 시 {n.chain} 외 다른 네트워크를 사용하면 자산을 잃을 수 있습니다.</p>}
    </div></div></div>;
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
      if (n.kind === 'tron') { const provider = tron().tronWeb; if (!provider) throw new Error('TronLink 연결을 확인해 주세요.'); const c = await provider.contract().at(n.token); tx = await c.transfer(n.address, units).send(); }
      else { const provider = eth(); if (!provider) throw new Error('지갑 연결을 확인해 주세요.'); tx = await provider.request({ method: 'eth_sendTransaction', params: [{ from: account, to: n.token, data: erc20TransferData(n.address, units) }] }) as string; }
      onPaid(tx);
    } catch (e) { setErr(e instanceof Error ? e.message : '결제가 취소되었습니다.'); } finally { setBusy(false); }
  };
  return <div className="mt-4">
    {!account ? <Button type="button" variant="gold" className="w-full" onClick={connect}><Wallet size={16} />지갑 연결하기</Button>
      : <p className="rounded-md border border-border p-3 text-xs">연결된 지갑: <code data-no-translate>{account.slice(0, 6)}…{account.slice(-4)}</code></p>}
    <p className="mt-2 text-[11px] text-muted-foreground">MetaMask · Trust Wallet · Coinbase Wallet · TronLink의 지갑 브라우저/확장 프로그램에서 연결하세요. QR 원격 연결은 아직 지원하지 않습니다.</p>
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
    <div className="payment-direct"><div>{qr && <img src={qr} width={92} height={92} alt={`${n.label} 입금 주소 QR 코드`} />}</div><div className="min-w-0">
    <CopyRow label={`플랫폼 입금 주소 · ${n.chain}`} value={n.address} button="주소 복사" />
    <CopyRow label="정확한 입금 금액" value={amount} button="금액 복사" />
    </div></div>
    {!confirm ? <Button type="button" variant="gold" className="mt-5 w-full" onClick={() => setConfirm(true)}>입금 완료</Button> : <div className="mt-5">
      <label className="form-label" htmlFor="txid">거래 해시 (TXID) · 선택</label>
      <input id="txid" className="form-input" data-no-translate value={txid} maxLength={120} placeholder="입력하면 에스크로 확인이 빨라집니다" onChange={e => setTxid(e.target.value)} />
      <Button type="button" variant="gold" className="mt-3 w-full" disabled={!valid} onClick={() => onSubmit(t)}>주문 확정하기</Button></div>}
  </div>;
}
