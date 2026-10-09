import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Copy, Eye, ImagePlus, Pencil, Plus, Power, Star, Trash2, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { compressImage, LONG_CACHE } from '@/lib/image-compress';
import { useAdminPasswordGate } from './admin-password-gate';
import type { Database } from '@/integrations/supabase/types';
import { watchImages } from '@/lib/luxury-market';
import { uploadVideoThumbnail } from '@/lib/video-thumbnail';
import { CategoryOptions, categoriesQueryKey, useCategories, type CategoryRow } from './category-options';
import {
  availableQty, imageKinds, productCategories, productStatuses, publishBlockers, slugify, verificationStatuses, watchSpecFields,
  type ImageKind, type ProductStatus,
} from '@/lib/catalog';

type StoreRow = Database['public']['Tables']['stores']['Row'];
type PostRow = Database['public']['Tables']['posts']['Row'];
type Img = { path: string; kind: ImageKind };
export type CatalogSection = 'dashboard' | 'stores' | 'products' | 'categories' | 'inventory' | 'orders';

const fmtDate = (v: string) => new Date(v).toLocaleDateString('ko-KR');
const usd = (n: number | null) => (n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n));
const seedSrc = (token: string) => watchImages[Number(token.replace('seed:watch-', ''))] ?? watchImages[0] ?? '';

function useCatalog() {
  const stores = useQuery({ queryKey: ['admin-stores'], queryFn: async () => {
    const { data, error } = await supabase.from('stores').select('*').order('created_at');
    if (error) throw error; return data;
  } });
  const products = useQuery({ queryKey: ['admin-products'], queryFn: async () => {
    const { data, error } = await supabase.from('posts').select('*').order('updated_at', { ascending: false });
    if (error) throw error; return data;
  } });
  return { stores: stores.data ?? [], products: products.data ?? [], loading: stores.isLoading || products.isLoading, error: stores.error || products.error };
}

/** Resolves storage paths and bundled seed tokens to displayable URLs for the admin. */
function useMediaUrls(paths: string[]) {
  const key = paths.filter(p => p && !p.startsWith('seed:') && !p.startsWith('http')).sort().join('|');
  const { data } = useQuery({ queryKey: ['admin-media', key], enabled: Boolean(key), staleTime: 50 * 60_000, queryFn: async () => {
    const { data } = await supabase.storage.from('market-media').createSignedUrls(key.split('|'), 3600);
    return Object.fromEntries((data ?? []).map(d => [d.path, d.signedUrl]));
  } });
  return (p: string | null | undefined) => (!p ? '' : p.startsWith('seed:') ? seedSrc(p) : p.startsWith('http') ? p : data?.[p] ?? '');
}

async function uploadMedia(input: File, folder: string) {
  const file = input.type.startsWith('image/') ? await compressImage(input) : input;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('관리자 로그인이 필요합니다.');
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('market-media').upload(path, file, { contentType: file.type, cacheControl: LONG_CACHE });
  if (error) throw new Error('파일을 올리지 못했습니다.');
  return path;
}

function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all(['admin-stores', 'admin-products', 'posts', 'stores'].map(k => qc.invalidateQueries({ queryKey: [k] })));
}

export function AdminCatalog({ section, edit }: { section: CatalogSection; edit?: string | undefined }) {
  const c = useCatalog();
  if (c.error) return <div className="sample-notice mt-4">관리자 권한이 있는 계정으로 로그인해야 카탈로그를 관리할 수 있습니다.</div>;
  if (c.loading) return <p className="mt-6 text-sm text-muted-foreground">불러오는 중…</p>;
  if (section === 'stores') return edit ? <StoreForm id={edit} stores={c.stores} /> : <StoreList stores={c.stores} products={c.products} />;
  if (section === 'products') return edit ? <ProductForm id={edit} stores={c.stores} products={c.products} /> : <ProductList stores={c.stores} products={c.products} />;
  if (section === 'categories') return <Categories products={c.products} />;
  if (section === 'inventory') return <Inventory products={c.products} stores={c.stores} />;
  if (section === 'orders') return <div className="lux-empty mt-6"><h2>Orders · Coming Soon</h2><p>주문 관리는 다음 개발 단계에서 연결됩니다.</p></div>;
  const by = (s: string) => c.products.filter(p => p.product_status === s).length;
  return <div className="catalog mt-4">
    <div className="catalog-stats">
      {[['Stores', c.stores.length], ['Active stores', c.stores.filter(s => s.status === 'ACTIVE').length], ['Products', c.products.length], ['Published', by('PUBLISHED')], ['Draft / Ready', by('DRAFT') + by('READY')], ['Out of stock', by('OUT_OF_STOCK')], ['Archived', by('ARCHIVED')], ['Seed data', c.products.filter(p => p.data_source === 'SEED').length]].map(([l, v]) => <div key={String(l)}><span>{l}</span><strong>{v}</strong></div>)}
    </div>
    <div className="catalog-toolbar"><Button asChild variant="gold"><Link to="/admin" search={{ role: 'admin', section: 'stores', edit: 'new' }}><Plus />새 스토어</Link></Button><Button asChild variant="goldOutline"><Link to="/admin" search={{ role: 'admin', section: 'products', edit: 'new' }}><Plus />상품 등록</Link></Button></div>
  </div>;
}

function StoreList({ stores, products }: { stores: StoreRow[]; products: PostRow[] }) {
  const [q, setQ] = useState(''), [filter, setFilter] = useState('all');
  const refresh = useRefresh();
  const media = useMediaUrls(stores.map(s => s.avatar ?? ''));
  const rows = stores.filter(s => {
    const hay = `${s.store_name} ${s.id} ${s.slug} ${s.country} ${s.status}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    return filter === 'all' || (filter === 'active' && s.status === 'ACTIVE') || (filter === 'inactive' && s.status !== 'ACTIVE') || (filter === 'verified' && s.verification_status !== 'UNVERIFIED') || (filter === 'featured' && s.featured);
  });
  const setStatus = async (s: StoreRow, status: 'ACTIVE' | 'INACTIVE') => { await supabase.from('stores').update({ status, updated_at: new Date().toISOString() }).eq('id', s.id); await refresh(); };
  return <div className="catalog mt-4">
    <div className="section-heading"><h2>STORE MANAGEMENT</h2><span>{rows.length} / {stores.length}</span></div>
    <div className="catalog-toolbar">
      <input aria-label="스토어 검색" placeholder="Store name · ID · Country · Status" value={q} onChange={e => setQ(e.target.value)} />
      <select aria-label="스토어 필터" value={filter} onChange={e => setFilter(e.target.value)}>{[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive'], ['verified', 'Verified'], ['featured', 'Featured']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <Button asChild variant="gold" className="ml-auto"><Link to="/admin" search={{ role: 'admin', section: 'stores', edit: 'new' }}><Plus />Create Store</Link></Button>
    </div>
    <div className="catalog-scroll"><table className="catalog-table"><thead><tr><th></th><th>Store</th><th>Country</th><th>Status</th><th>Products</th><th>Featured</th><th>Source</th><th>Created</th><th>Actions</th></tr></thead><tbody>
      {rows.map(s => <tr key={s.id}>
        <td>{s.avatar ? <img src={media(s.avatar)} alt="" /> : <span className="catalog-pill">{s.store_name.slice(0, 2)}</span>}</td>
        <td data-no-translate><strong>{s.store_name}</strong><br /><small className="text-muted-foreground">@{s.slug} · {s.verification_status}</small></td>
        <td>{s.country || '—'}</td>
        <td><span className={`catalog-pill ${s.status === 'ACTIVE' ? 'on' : s.status === 'INACTIVE' ? 'warn' : ''}`}>{s.status}</span></td>
        <td>{products.filter(p => p.store_id === s.id).length}</td>
        <td>{s.featured ? <Star size={14} className="text-primary" /> : '—'}</td>
        <td><span className="catalog-pill">{s.data_source}</span></td>
        <td>{fmtDate(s.created_at)}</td>
        <td><div className="catalog-actions">
          <Button asChild variant="ghost" size="sm"><Link to="/store" search={{ seller: s.store_name }}><Eye />View</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/admin" search={{ role: 'admin', section: 'stores', edit: s.id }}><Pencil />Edit</Link></Button>
          {s.status === 'ACTIVE' ? <Button variant="ghost" size="sm" onClick={() => void setStatus(s, 'INACTIVE')}><Power />Deactivate</Button> : <Button variant="goldOutline" size="sm" onClick={() => void setStatus(s, 'ACTIVE')}><Power />Activate</Button>}
        </div></td>
      </tr>)}
    </tbody></table></div>
  </div>;
}

function MediaPicker({ label, value, onChange, folder }: { label: string; value: string | null; onChange: (p: string | null) => void; folder: string }) {
  const media = useMediaUrls(value ? [value] : []);
  const [busy, setBusy] = useState(false);
  return <label>{label}
    <div className="flex items-center gap-2">{value && <img src={media(value)} alt="" className="size-12 rounded-md object-cover" />}
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setBusy(true); try { onChange(await uploadMedia(f, folder)); } finally { setBusy(false); } }} />
      {value && <Button type="button" variant="ghost" size="icon" aria-label={`${label} 삭제`} onClick={() => onChange(null)}><Trash2 /></Button>}</div>
  </label>;
}

function StoreForm({ id, stores }: { id: string; stores: StoreRow[] }) {
  const existing = stores.find(s => s.id === id);
  const navigate = useNavigate(); const refresh = useRefresh();
  const [f, setF] = useState(() => ({
    store_name: existing?.store_name ?? '', slug: existing?.slug ?? '', logo: existing?.logo ?? null, cover_image: existing?.cover_image ?? null, avatar: existing?.avatar ?? null,
    description: existing?.description ?? '', country: existing?.country ?? '', city: existing?.city ?? '', specialties: existing?.specialties.join(', ') ?? '',
    shipping_regions: existing?.shipping_regions.join(', ') ?? '', shipping_information: existing?.shipping_information ?? '', response_time: existing?.response_time ?? '',
    verification_status: existing?.verification_status ?? 'UNVERIFIED', featured: existing?.featured ?? false,
  }));
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => setF(prev => ({ ...prev, [k]: v }));
  const list = (v: string) => v.split(',').map(x => x.trim()).filter(Boolean);
  const save = async (status: 'DRAFT' | 'ACTIVE' | 'INACTIVE') => {
    if (!f.store_name.trim()) return setMsg('스토어 이름을 입력해 주세요.');
    const slug = slugify(f.slug || f.store_name);
    if (!slug) return setMsg('영문/숫자 주소(slug)를 입력해 주세요.');
    setBusy(true); setMsg('');
    try {
      const row = { store_name: f.store_name.trim(), slug, logo: f.logo, cover_image: f.cover_image, avatar: f.avatar, description: f.description, country: f.country, city: f.city,
        specialties: list(f.specialties), shipping_regions: list(f.shipping_regions), shipping_information: f.shipping_information, response_time: f.response_time,
        verification_status: f.verification_status, featured: f.featured, status, updated_at: new Date().toISOString() };
      if (existing) {
        const { error } = await supabase.from('stores').update(row).eq('id', existing.id);
        if (error) throw error;
        if (existing.store_name !== row.store_name) await supabase.from('posts').update({ creator: row.store_name }).eq('store_id', existing.id);
      } else {
        // Every store is created together with its own seller record (Seller → Store).
        const { data: seller, error: se } = await supabase.from('sellers').insert({ seller_type: 'CURATED', status: 'ACTIVE', country: f.country }).select('id').single();
        if (se) throw se;
        const { data: created, error } = await supabase.from('stores').insert({ ...row, seller_id: seller.id, data_source: 'PRODUCTION' }).select('id').single();
        if (error) throw error;
        await refresh();
        return void navigate({ to: '/admin', search: { role: 'admin', section: 'stores', edit: created.id }, replace: true });
      }
      await refresh();
      setMsg(status === 'ACTIVE' ? '게시되었습니다. 고객 스토어 페이지에 표시됩니다.' : status === 'INACTIVE' ? '비활성화되었습니다. 고객 화면에서 숨겨집니다.' : '초안으로 저장되었습니다.');
    } catch (e) { setMsg(e instanceof Error && e.message.includes('duplicate') ? '이미 사용 중인 주소(slug)입니다.' : '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  return <form className="catalog-form mt-4" onSubmit={e => { e.preventDefault(); void save('ACTIVE'); }}>
    <div className="section-heading"><h2>{existing ? 'Edit Store' : 'Create Store'}</h2><span>{existing ? `${existing.status} · ${existing.data_source}` : 'Seller → Store 자동 연결'}</span></div>
    <fieldset><legend>STORE PROFILE</legend>
      <label>Store Name *<input value={f.store_name} onChange={e => set('store_name', e.target.value)} required /></label>
      <label>Username / Slug<input value={f.slug} placeholder={slugify(f.store_name)} onChange={e => set('slug', e.target.value)} /></label>
      <label className="wide">Description<textarea rows={3} value={f.description} onChange={e => set('description', e.target.value)} /></label>
      <MediaPicker label="Logo" value={f.logo} onChange={v => set('logo', v)} folder="stores" />
      <MediaPicker label="Cover Image" value={f.cover_image} onChange={v => set('cover_image', v)} folder="stores" />
      <MediaPicker label="Avatar" value={f.avatar} onChange={v => set('avatar', v)} folder="stores" />
    </fieldset>
    <fieldset><legend>LOCATION & SHIPPING</legend>
      <label>Country<input value={f.country} onChange={e => set('country', e.target.value)} /></label>
      <label>City<input value={f.city} onChange={e => set('city', e.target.value)} /></label>
      <label>Specialties (쉼표 구분)<input value={f.specialties} onChange={e => set('specialties', e.target.value)} /></label>
      <label>Shipping Regions (쉼표 구분)<input value={f.shipping_regions} onChange={e => set('shipping_regions', e.target.value)} /></label>
      <label className="wide">Shipping Information<textarea rows={2} value={f.shipping_information} onChange={e => set('shipping_information', e.target.value)} /></label>
      <label>Response Time<input value={f.response_time} placeholder="24h" onChange={e => set('response_time', e.target.value)} /></label>
    </fieldset>
    <fieldset><legend>STATUS</legend>
      <label>Verification Status<select value={f.verification_status} onChange={e => set('verification_status', e.target.value)}>{verificationStatuses.map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={f.featured} onChange={e => set('featured', e.target.checked)} />Featured</label>
    </fieldset>
    {msg && <p role="status" className="dashboard-message">{msg}</p>}
    <div className="catalog-toolbar">
      <Button type="button" variant="ghost" disabled={busy} onClick={() => void save('DRAFT')}>Save Draft</Button>
      <Button type="submit" variant="gold" disabled={busy}>Publish</Button>
      {existing && <Button type="button" variant="destructive" disabled={busy} onClick={() => void save('INACTIVE')}>Deactivate</Button>}
      <Button asChild variant="ghost" className="ml-auto"><Link to="/admin" search={{ role: 'admin', section: 'stores' }}>목록으로</Link></Button>
    </div>
  </form>;
}

const statusFilters = [['all', 'All'], ['DRAFT', 'Draft'], ['PUBLISHED', 'Published'], ['OUT_OF_STOCK', 'Out of Stock'], ['ARCHIVED', 'Archived']] as const;

function ProductList({ stores, products }: { stores: StoreRow[]; products: PostRow[] }) {
  const [q, setQ] = useState(''), [filter, setFilter] = useState('all'), [msg, setMsg] = useState('');
  const refresh = useRefresh();
  const storeName = (id: string | null) => stores.find(s => s.id === id)?.store_name ?? '—';
  const media = useMediaUrls(products.map(p => p.media_urls[0] ?? ''));
  const rows = products.filter(p => {
    const hay = `${p.title} ${p.brand} ${p.model} ${p.reference} ${storeName(p.store_id)} ${p.category}`.toLowerCase();
    return (!q || hay.includes(q.toLowerCase())) && (filter === 'all' || p.product_status === filter || (filter === 'DRAFT' && p.product_status === 'READY'));
  });
  const setStatus = async (p: PostRow, s: ProductStatus) => {
    if (s === 'PUBLISHED') {
      const missing = publishBlockers({ title: p.title, storeId: p.store_id, category: p.category, price: p.price, stock: p.stock_qty, hasMainImage: p.media_urls.length > 0 });
      if (missing.length) return setMsg(`게시하려면 필요: ${missing.join(', ')}`);
    }
    const { error } = await supabase.from('posts').update({ product_status: s }).eq('id', p.id);
    setMsg(error ? '변경하지 못했습니다.' : `${p.title} → ${s}`); await refresh();
  };
  const duplicate = async (p: PostRow) => {
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = p;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('posts').insert({ ...rest, user_id: p.user_id ?? user?.id ?? null, title: `${p.title} (copy)`, sku: p.sku ? `${p.sku}-COPY` : '', product_status: 'DRAFT', status: 'draft', featured: false, data_source: 'PRODUCTION' });
    setMsg(error ? '복제하지 못했습니다.' : '초안으로 복제했습니다.'); await refresh();
  };
  return <div className="catalog mt-4">
    <div className="section-heading"><h2>PRODUCT MANAGEMENT</h2><span>{rows.length} / {products.length}</span></div>
    <div className="catalog-toolbar">
      <input aria-label="상품 검색" placeholder="Name · Brand · Reference · Store · Category" value={q} onChange={e => setQ(e.target.value)} />
      <select aria-label="상품 상태 필터" value={filter} onChange={e => setFilter(e.target.value)}>{statusFilters.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <Button asChild variant="gold" className="ml-auto"><Link to="/admin" search={{ role: 'admin', section: 'products', edit: 'new' }}><Plus />Add Product</Link></Button>
    </div>
    {msg && <p role="status" className="dashboard-message">{msg}</p>}
    <div className="catalog-scroll"><table className="catalog-table"><thead><tr><th></th><th>Product</th><th>Brand</th><th>Store</th><th>Price</th><th>Stock</th><th>Status</th><th>Source</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
      {rows.map(p => <tr key={p.id}>
        <td>{p.media_urls[0] ? <img src={media(p.media_urls[0])} alt="" /> : '—'}</td>
        <td data-no-translate><strong>{p.title}</strong>{p.featured && <Star size={12} className="ml-1 inline text-primary" />}<br /><small className="text-muted-foreground">{p.reference || p.sku || p.id.slice(0, 8)}</small></td>
        <td>{p.brand || '—'}</td><td data-no-translate>{storeName(p.store_id)}</td><td>{usd(p.price)}</td>
        <td>{availableQty(p.stock_qty, p.reserved_qty)} / {p.stock_qty}</td>
        <td><span className={`catalog-pill ${p.product_status === 'PUBLISHED' ? 'on' : p.product_status === 'OUT_OF_STOCK' ? 'warn' : ''}`}>{p.product_status}</span></td>
        <td><span className="catalog-pill">{p.data_source}</span></td>
        <td>{fmtDate(p.updated_at || p.created_at)}</td>
        <td><div className="catalog-actions">
          <Button asChild variant="ghost" size="sm"><Link to="/admin" search={{ role: 'admin', section: 'products', edit: p.id }}><Pencil />Edit</Link></Button>
          <Button variant="ghost" size="sm" onClick={() => void duplicate(p)}><Copy />Duplicate</Button>
          {p.product_status === 'PUBLISHED' || p.product_status === 'OUT_OF_STOCK'
            ? <Button variant="ghost" size="sm" onClick={() => void setStatus(p, 'DRAFT')}>Unpublish</Button>
            : <Button variant="goldOutline" size="sm" onClick={() => void setStatus(p, 'PUBLISHED')}>Publish</Button>}
          {p.product_status !== 'ARCHIVED' && <Button variant="ghost" size="sm" onClick={() => void setStatus(p, 'ARCHIVED')}><Archive />Archive</Button>}
        </div></td>
      </tr>)}
    </tbody></table></div>
  </div>;
}

function ProductForm({ id, stores, products }: { id: string; stores: StoreRow[]; products: PostRow[] }) {
  const existing = products.find(p => p.id === id);
  const navigate = useNavigate(); const refresh = useRefresh();
  const specs0 = (existing?.specs ?? {}) as Record<string, string>;
  const [f, setF] = useState(() => ({
    store_id: existing?.store_id ?? '', title: existing?.title ?? '', brand: existing?.brand ?? '', model: existing?.model ?? '', reference: existing?.reference ?? '',
    category: existing?.category ?? '', subcategory: existing?.subcategory ?? '', description: existing?.description ?? '', price: existing?.price?.toString() ?? '',
    box_price: existing?.box_price?.toString() ?? '', sku: existing?.sku ?? '', stock_qty: String(existing?.stock_qty ?? 1), reserved_qty: String(existing?.reserved_qty ?? 0),
    low_stock_threshold: String(existing?.low_stock_threshold ?? 1), featured: existing?.featured ?? false, video_url: existing?.video_url ?? null,
  }));
  const [specs, setSpecs] = useState<Record<string, string>>(() => Object.fromEntries(watchSpecFields.map(([k]) => [k, typeof specs0[k] === 'string' ? specs0[k] : ''])));
  const [images, setImages] = useState<Img[]>(() => (existing?.media_urls ?? []).map((path, i) => ({ path, kind: i === 0 ? 'main' : 'gallery' })));
  const [qc, setQc] = useState({ qc_available: false, qc_video: null as string | null, inspection_notes: '', rate: '', amplitude: '', beat_error: '' });
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [drag, setDrag] = useState<number | null>(null), [thumb, setThumb] = useState<string | null>(existing?.thumbnail_url ?? null);
  const media = useMediaUrls(images.map(i => i.path));

  useEffect(() => {
    if (!existing) return;
    void supabase.from('product_images').select('path,kind,sort_order').eq('post_id', existing.id).order('sort_order').then(({ data }) => { if (data?.length) setImages(data.map(d => ({ path: d.path, kind: d.kind as ImageKind }))); });
    void supabase.from('product_qc').select('*').eq('post_id', existing.id).maybeSingle().then(({ data }) => {
      if (!data) return; const t = (data.timegrapher ?? {}) as Record<string, string>;
      setQc({ qc_available: data.qc_available, qc_video: data.qc_video, inspection_notes: data.inspection_notes, rate: t['rate'] ?? '', amplitude: t['amplitude'] ?? '', beat_error: t['beat_error'] ?? '' });
    });
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof f, v: unknown) => setF(prev => ({ ...prev, [k]: v }));
  const addFiles = async (files: FileList | null, kind: ImageKind) => {
    if (!files?.length) return; setBusy(true);
    try { const paths = await Promise.all([...files].map(file => uploadMedia(file, 'catalog'))); setImages(prev => [...prev, ...paths.map((path, i) => ({ path, kind: prev.length === 0 && i === 0 && kind === 'gallery' ? 'main' as const : kind }))]); }
    catch (e) { setMsg(e instanceof Error ? e.message : '업로드 실패'); } finally { setBusy(false); }
  };
  const setMain = (idx: number) => setImages(prev => prev.map((img, i) => ({ ...img, kind: i === idx ? 'main' : img.kind === 'main' ? 'gallery' : img.kind })));
  const move = (from: number, to: number) => setImages(prev => { const next = [...prev]; const [it] = next.splice(from, 1); if (it) next.splice(to, 0, it); return next; });
  const replace = async (idx: number, file: File | undefined) => { if (!file) return; const path = await uploadMedia(file, 'catalog'); setImages(prev => prev.map((img, i) => (i === idx ? { ...img, path } : img))); };

  const save = async (requested: ProductStatus) => {
    const price = f.price === '' ? null : Number(f.price), stock = Number(f.stock_qty), reserved = Number(f.reserved_qty || 0);
    const main = images.find(i => i.kind === 'main');
    if (!f.store_id) return setMsg('먼저 스토어를 선택해 주세요.');
    if (!f.title.trim()) return setMsg('상품명을 입력해 주세요.');
    if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(reserved) || reserved < 0) return setMsg('재고 수량을 확인해 주세요.');
    if (requested === 'PUBLISHED' || requested === 'READY') {
      const missing = publishBlockers({ title: f.title, storeId: f.store_id, category: f.category, price, stock, hasMainImage: Boolean(main) });
      if (missing.length) return setMsg(`필수 항목: ${missing.join(', ')}`);
    }
    setBusy(true); setMsg('');
    try {
      const store = stores.find(s => s.id === f.store_id);
      // Main image first; QC/movement inspection shots stay out of the customer gallery.
      const ordered = main ? [main, ...images.filter(i => i !== main)] : images;
      const gallery = ordered.filter(i => i.kind !== 'qc' && i.kind !== 'movement').map(i => i.path);
      const cleanSpecs = { ...(existing?.specs as Record<string, unknown> ?? {}), ...Object.fromEntries(Object.entries(specs).filter(([, v]) => v.trim())), brand: f.brand || undefined, model: f.model || undefined };
      const allSeed = [...gallery, ...(f.video_url ? [f.video_url] : [])].every(p => p.startsWith('seed:'));
      const row = {
        store_id: f.store_id, creator: store?.store_name ?? 'VELA', title: f.title.trim(), brand: f.brand, model: f.model, reference: f.reference, category: f.category || '기타',
        subcategory: f.subcategory, description: f.description, price, box_price: f.box_price === '' ? null : Number(f.box_price), currency: 'USD', sku: f.sku,
        stock_qty: stock, reserved_qty: reserved, low_stock_threshold: Number(f.low_stock_threshold || 0), featured: f.featured, specs: cleanSpecs,
        media_urls: gallery, video_url: f.video_url, thumbnail_url: f.video_url ? thumb : null, image_key: gallery.length && allSeed ? 'seed' : 'uploaded', product_status: requested,
      };
      let postId = existing?.id;
      if (existing) {
        const { error } = await supabase.from('posts').update(row).eq('id', existing.id); if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from('posts').insert({ ...row, user_id: user?.id ?? null, data_source: 'PRODUCTION' }).select('id').single(); if (error) throw error;
        postId = data.id;
      }
      if (!postId) throw new Error('missing id');
      await supabase.from('product_images').delete().eq('post_id', postId);
      if (ordered.length) { const { error } = await supabase.from('product_images').insert(ordered.map((img, i) => ({ post_id: postId, path: img.path, kind: img.kind, sort_order: i, is_main: img.kind === 'main' }))); if (error) throw error; }
      const { error: qe } = await supabase.from('product_qc').upsert({ post_id: postId, qc_available: qc.qc_available, qc_video: qc.qc_video, inspection_notes: qc.inspection_notes, timegrapher: { rate: qc.rate, amplitude: qc.amplitude, beat_error: qc.beat_error }, updated_at: new Date().toISOString() });
      if (qe) throw qe;
      await refresh();
      const { data: after } = await supabase.from('posts').select('product_status').eq('id', postId).single();
      setMsg(`저장되었습니다 · 상태: ${after?.product_status ?? requested}${after?.product_status === 'OUT_OF_STOCK' ? ' (재고 0 → 품절)' : ''}`);
      if (!existing) void navigate({ to: '/admin', search: { role: 'admin', section: 'products', edit: postId }, replace: true });
    } catch { setMsg('저장하지 못했습니다. 입력값과 관리자 권한을 확인해 주세요.'); }
    finally { setBusy(false); }
  };
  const available = availableQty(Number(f.stock_qty) || 0, Number(f.reserved_qty) || 0);
  const activeStores = useMemo(() => stores.filter(s => s.status !== 'INACTIVE' || s.id === f.store_id), [stores, f.store_id]);

  return <form className="catalog-form mt-4" onSubmit={e => { e.preventDefault(); void save('PUBLISHED'); }}>
    <div className="section-heading"><h2>{existing ? 'Edit Product' : 'Add Product'}</h2><span>{existing ? `${existing.product_status} · ${existing.data_source}` : 'Store → Info → Images → Specs → Pricing → Inventory → QC → Publish'}</span></div>
    <fieldset><legend>1 · SELECT STORE</legend>
      <label className="wide">Store *<select value={f.store_id} onChange={e => set('store_id', e.target.value)} required><option value="">스토어 선택…</option>{activeStores.map(s => <option key={s.id} value={s.id}>{s.store_name} · {s.status}</option>)}</select></label>
    </fieldset>
    <fieldset><legend>2 · PRODUCT INFORMATION</legend>
      <label>Product name *<input value={f.title} onChange={e => set('title', e.target.value)} required /></label>
      <label>Brand<input value={f.brand} onChange={e => set('brand', e.target.value)} /></label>
      <label>Model<input value={f.model} onChange={e => set('model', e.target.value)} /></label>
      <label>Reference number<input value={f.reference} onChange={e => set('reference', e.target.value)} /></label>
      <label>Category *<select value={f.category} onChange={e => set('category', e.target.value)}><option value="">선택…</option><CategoryOptions current={f.category} fallback={productCategories} /></select></label>
      <label>Subcategory<input value={f.subcategory} onChange={e => set('subcategory', e.target.value)} /></label>
      <label className="wide">Description<textarea rows={4} value={f.description} onChange={e => set('description', e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={f.featured} onChange={e => set('featured', e.target.checked)} />Featured product</label>
    </fieldset>
    <fieldset><legend>3 · IMAGES</legend>
      <div className="catalog-images">
        {images.map((img, i) => <div key={`${img.path}-${i}`} className={`catalog-image ${img.kind === 'main' ? 'main' : ''}`} draggable onDragStart={() => setDrag(i)} onDragOver={e => e.preventDefault()} onDrop={() => { if (drag !== null && drag !== i) move(drag, i); setDrag(null); }}>
          <img src={media(img.path)} alt={`이미지 ${i + 1}`} />
          <select aria-label="이미지 유형" value={img.kind} onChange={e => { const kind = e.target.value as ImageKind; if (kind === 'main') setMain(i); else setImages(prev => prev.map((x, j) => (j === i ? { ...x, kind } : x))); }}>{imageKinds.map(k => <option key={k} value={k}>{k}</option>)}</select>
          <div className="catalog-actions">
            {img.kind !== 'main' && <Button type="button" variant="ghost" size="sm" onClick={() => setMain(i)}><Star />Main</Button>}
            <label className="cursor-pointer text-xs"><Upload size={12} className="inline" /> 교체<input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => void replace(i, e.target.files?.[0])} /></label>
            <Button type="button" variant="ghost" size="icon" aria-label="이미지 삭제" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        </div>)}
        <label className="catalog-image grid place-items-center text-center"><ImagePlus />이미지 추가<input type="file" hidden multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => void addFiles(e.target.files, 'gallery')} /></label>
      </div>
      <p className="wide text-xs text-muted-foreground">끌어서 순서를 바꾸고, 대표(Main) 이미지를 하나 지정하세요. QC·Movement 이미지는 고객 갤러리에서 제외됩니다.</p>
      <label>Product video (선택)<input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; if (file) { setBusy(true); try { set('video_url', await uploadMedia(file, 'catalog')); const { data: { user } } = await supabase.auth.getUser(); setThumb(user ? await uploadVideoThumbnail(file, `${user.id}/catalog`) : null); } finally { setBusy(false); } } }} /></label>
      {f.video_url && <Button type="button" variant="ghost" size="sm" onClick={() => set('video_url', null)}><Trash2 />영상 제거</Button>}
    </fieldset>
    <fieldset><legend>4 · WATCH SPECIFICATIONS (선택)</legend>
      {watchSpecFields.map(([k, l]) => <label key={k}>{l}<input value={specs[k] ?? ''} onChange={e => setSpecs(prev => ({ ...prev, [k]: e.target.value }))} /></label>)}
    </fieldset>
    <fieldset><legend>5 · PRICING (USD)</legend>
      <label>Price *<input type="number" min={0} step="1" value={f.price} onChange={e => set('price', e.target.value)} /></label>
      <label>Currency<input value="USD" readOnly /></label>
      <label>Full Set Box price<input type="number" min={0} value={f.box_price} onChange={e => set('box_price', e.target.value)} /></label>
    </fieldset>
    <fieldset><legend>6 · INVENTORY</legend>
      <label>SKU<input value={f.sku} onChange={e => set('sku', e.target.value)} /></label>
      <label>Stock quantity *<input type="number" min={0} value={f.stock_qty} onChange={e => set('stock_qty', e.target.value)} /></label>
      <label>Reserved quantity<input type="number" min={0} value={f.reserved_qty} onChange={e => set('reserved_qty', e.target.value)} /></label>
      <label>Low stock threshold<input type="number" min={0} value={f.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} /></label>
      <label>Available quantity<input value={available} readOnly /></label>
    </fieldset>
    <fieldset><legend>7 · QC INFORMATION</legend>
      <label className="check"><input type="checkbox" checked={qc.qc_available} onChange={e => setQc(p => ({ ...p, qc_available: e.target.checked }))} />QC Available</label>
      <label>QC Video<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={async e => { const file = e.target.files?.[0]; if (file) { const path = await uploadMedia(file, 'qc'); setQc(p => ({ ...p, qc_video: path })); } }} />{qc.qc_video && <small>업로드됨</small>}</label>
      <label>QC / Movement images<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => void addFiles(e.target.files, 'qc')} /></label>
      <label>Timegrapher · Rate (s/d)<input value={qc.rate} onChange={e => setQc(p => ({ ...p, rate: e.target.value }))} /></label>
      <label>Amplitude (°)<input value={qc.amplitude} onChange={e => setQc(p => ({ ...p, amplitude: e.target.value }))} /></label>
      <label>Beat error (ms)<input value={qc.beat_error} onChange={e => setQc(p => ({ ...p, beat_error: e.target.value }))} /></label>
      <label className="wide">Inspection Notes<textarea rows={3} value={qc.inspection_notes} onChange={e => setQc(p => ({ ...p, inspection_notes: e.target.value }))} /></label>
    </fieldset>
    {msg && <p role="status" className="dashboard-message">{msg}</p>}
    <div className="catalog-toolbar">
      <Button type="button" variant="ghost" disabled={busy} onClick={() => void save('DRAFT')}>Save Draft</Button>
      <Button type="button" variant="goldOutline" disabled={busy} onClick={() => void save('READY')}>Mark Ready</Button>
      <Button type="submit" variant="gold" disabled={busy}>Publish</Button>
      {existing && (existing.product_status === 'PUBLISHED' || existing.product_status === 'OUT_OF_STOCK') && <Button type="button" variant="ghost" disabled={busy} onClick={() => void save('DRAFT')}>Unpublish</Button>}
      {existing && <Button type="button" variant="destructive" disabled={busy} onClick={() => void save('ARCHIVED')}><Archive />Archive</Button>}
      <Button asChild variant="ghost" className="ml-auto"><Link to="/admin" search={{ role: 'admin', section: 'products' }}>목록으로</Link></Button>
    </div>
  </form>;
}

function Categories({ products }: { products: PostRow[] }) {
  const gate = useAdminPasswordGate();
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useCategories();
  const [draft, setDraft] = useState({ name: '', parent_id: '', collection: 'watches' });
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const reload = () => qc.invalidateQueries({ queryKey: categoriesQueryKey });
  const count = (name: string, live = false) => products.filter(p => p.category === name && (!live || p.product_status === 'PUBLISHED' || p.product_status === 'OUT_OF_STOCK')).length;
  const parents = rows.filter(r => !r.parent_id);
  const add = async () => {
    const name = draft.name.trim(); if (!name) return;
    const parent = parents.find(p => p.id === draft.parent_id);
    const id = `${slugify(name) || 'cat'}-${crypto.randomUUID().slice(0, 6)}`;
    const siblings = rows.filter(r => (r.parent_id ?? '') === draft.parent_id).length;
    const { error } = await supabase.from('categories').insert({ id, name, parent_id: parent?.id ?? null, collection: parent?.collection ?? draft.collection, sort_order: siblings + 1 });
    setMsg(error ? '카테고리를 추가하지 못했습니다.' : `${name} 추가됨`); if (!error) setDraft(d => ({ ...d, name: '' })); await reload();
  };
  const rename = async (r: CategoryRow) => {
    const name = edits[r.id]?.trim(); if (!name || name === r.name) return;
    const { error } = await supabase.from('categories').update({ name }).eq('id', r.id);
    if (!error && r.parent_id) await supabase.from('posts').update({ category: name }).eq('category', r.name);
    setMsg(error ? '이름을 바꾸지 못했습니다.' : `${r.name} → ${name}`); setEdits(e => { const n = { ...e }; delete n[r.id]; return n; }); await reload(); await qc.invalidateQueries({ queryKey: ['admin-products'] });
  };
  const move = async (r: CategoryRow, dir: -1 | 1) => {
    const sib = rows.filter(x => x.parent_id === r.parent_id); const i = sib.findIndex(x => x.id === r.id); const other = sib[i + dir]; if (!other) return;
    await Promise.all([supabase.from('categories').update({ sort_order: other.sort_order }).eq('id', r.id), supabase.from('categories').update({ sort_order: r.sort_order }).eq('id', other.id)]);
    await reload();
  };
  const remove = async (r: CategoryRow) => {
    if (rows.some(x => x.parent_id === r.id)) { setMsg('하위 카테고리를 먼저 삭제해 주세요.'); return; }
    if (count(r.name)) { setMsg(`${r.name}에 상품 ${count(r.name)}개가 있어 삭제할 수 없습니다.`); return; }
    if (!(await gate.ask(`'${r.name}' 카테고리를 삭제합니다.`))) return;
    const { error } = await supabase.from('categories').delete().eq('id', r.id);
    setMsg(error ? '삭제하지 못했습니다.' : `${r.name} 삭제됨`); await reload();
  };
  const row = (r: CategoryRow, child: boolean) => <tr key={r.id}>
    <td style={{ paddingLeft: child ? 28 : undefined }}><input aria-label="카테고리 이름" value={edits[r.id] ?? r.name} onChange={e => setEdits(x => ({ ...x, [r.id]: e.target.value }))} onBlur={() => void rename(r)} onKeyDown={e => { if (e.key === 'Enter') void rename(r); }} /></td>
    <td>{child ? '하위' : '상위'}</td><td>{child ? count(r.name, true) : '—'}</td><td>{child ? count(r.name) : '—'}</td>
    <td className="whitespace-nowrap"><Button type="button" variant="ghost" size="sm" aria-label="위로" onClick={() => void move(r, -1)}>↑</Button><Button type="button" variant="ghost" size="sm" aria-label="아래로" onClick={() => void move(r, 1)}>↓</Button><Button type="button" variant="ghost" size="sm" aria-label="삭제" onClick={() => void remove(r)}><Trash2 /></Button></td>
  </tr>;
  return <>{gate.dialog}<div className="catalog mt-4"><div className="section-heading"><h2>CATEGORIES</h2><span>상위 · 하위 카테고리 관리</span></div>
    {msg && <p role="status" className="dashboard-message">{msg}</p>}
    <div className="catalog-toolbar flex flex-wrap gap-2">
      <input aria-label="새 카테고리 이름" placeholder="새 카테고리 이름" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
      <select aria-label="상위 카테고리" value={draft.parent_id} onChange={e => setDraft(d => ({ ...d, parent_id: e.target.value }))}><option value="">상위 카테고리로 추가</option>{parents.map(p => <option key={p.id} value={p.id}>{`${p.name}의 하위`}</option>)}</select>
      {!draft.parent_id && <select aria-label="컬렉션" value={draft.collection} onChange={e => setDraft(d => ({ ...d, collection: e.target.value }))}><option value="watches">Watches</option><option value="accessories">Accessories</option></select>}
      <Button type="button" variant="gold" onClick={() => void add()}><Plus />추가</Button>
    </div>
    {isLoading ? <p className="mt-4 text-sm text-muted-foreground">불러오는 중…</p> :
    <div className="catalog-scroll"><table className="catalog-table"><thead><tr><th>Category</th><th>Level</th><th>Published</th><th>Total</th><th></th></tr></thead><tbody>
      {parents.flatMap(p => [row(p, false), ...rows.filter(r => r.parent_id === p.id).map(r => row(r, true))])}
    </tbody></table></div>}
  </div></>;
}

function Inventory({ products, stores }: { products: PostRow[]; stores: StoreRow[] }) {
  const refresh = useRefresh();
  const [edits, setEdits] = useState<Record<string, { stock_qty: string; reserved_qty: string; low_stock_threshold: string }>>({});
  const [msg, setMsg] = useState('');
  const rows = products.filter(p => p.store_id && p.product_status !== 'ARCHIVED');
  const save = async (p: PostRow) => {
    const e = edits[p.id]; if (!e) return;
    const { error } = await supabase.from('posts').update({ stock_qty: Number(e.stock_qty), reserved_qty: Number(e.reserved_qty), low_stock_threshold: Number(e.low_stock_threshold) }).eq('id', p.id);
    setMsg(error ? '재고를 저장하지 못했습니다.' : `${p.title} 재고 저장됨`); setEdits(prev => { const n = { ...prev }; delete n[p.id]; return n; }); await refresh();
  };
  return <div className="catalog mt-4"><div className="section-heading"><h2>INVENTORY</h2><span>Available = Stock − Reserved</span></div>
    {msg && <p role="status" className="dashboard-message">{msg}</p>}
    <div className="catalog-scroll"><table className="catalog-table"><thead><tr><th>Product</th><th>Store</th><th>SKU</th><th>Stock</th><th>Reserved</th><th>Available</th><th>Low stock</th><th>Status</th><th></th></tr></thead><tbody>
      {rows.map(p => {
        const e = edits[p.id] ?? { stock_qty: String(p.stock_qty), reserved_qty: String(p.reserved_qty), low_stock_threshold: String(p.low_stock_threshold) };
        const avail = availableQty(Number(e.stock_qty) || 0, Number(e.reserved_qty) || 0);
        const upd = (k: keyof typeof e, v: string) => setEdits(prev => ({ ...prev, [p.id]: { ...e, [k]: v } }));
        return <tr key={p.id} className={avail <= p.low_stock_threshold ? 'catalog-low' : ''}>
          <td data-no-translate>{p.title}</td><td data-no-translate>{stores.find(s => s.id === p.store_id)?.store_name ?? '—'}</td><td>{p.sku || '—'}</td>
          <td><input aria-label="재고" type="number" min={0} className="w-20" value={e.stock_qty} onChange={ev => upd('stock_qty', ev.target.value)} /></td>
          <td><input aria-label="예약 수량" type="number" min={0} className="w-20" value={e.reserved_qty} onChange={ev => upd('reserved_qty', ev.target.value)} /></td>
          <td><strong>{avail}</strong></td>
          <td><input aria-label="부족 기준" type="number" min={0} className="w-16" value={e.low_stock_threshold} onChange={ev => upd('low_stock_threshold', ev.target.value)} /></td>
          <td><span className={`catalog-pill ${p.product_status === 'OUT_OF_STOCK' ? 'warn' : p.product_status === 'PUBLISHED' ? 'on' : ''}`}>{p.product_status}</span></td>
          <td>{edits[p.id] && <Button variant="goldOutline" size="sm" onClick={() => void save(p)}>저장</Button>}</td>
        </tr>;
      })}
    </tbody></table></div></div>;
}
