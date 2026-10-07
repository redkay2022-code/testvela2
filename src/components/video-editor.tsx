import { useEffect, useMemo, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ArrowDown, ArrowUp, Captions, Loader2, Music, Palette, Pause, Play, Plus, Scissors, Tag, Trash2, Type, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_VIDEO_SECONDS } from '@/lib/listing-media';
import { beatTimes, bgmPresets, clipsToWavBase64, renderSoundtrack, sfxPresets, snapToBeat, type BgmId, type SfxType } from '@/lib/video-audio';
import { transcribeVideoAudio } from '@/lib/video-captions.functions';

export type VideoTag = { postId: string; title: string; at: number };
type Clip = { id: string; file: File; url: string; duration: number; start: number; end: number };
type TextLayer = { id: string; text: string; start: number; end: number; style: TextStyle; y: number };
type Caption = { start: number; end: number; text: string };
type TextStyle = 'gold-serif' | 'spec' | 'minimal';
type FilterId = 'none' | 'dark' | 'metal' | 'cinema';
type Layer = 'clips' | 'text' | 'music' | 'filter' | 'tags';

export const luxuryFilters: Record<FilterId, { label: string; css: string; vignette: boolean }> = {
  none: { label: '원본', css: 'none', vignette: false },
  dark: { label: 'Dark Luxury', css: 'contrast(1.18) brightness(0.86) saturate(0.85) sepia(0.12)', vignette: true },
  metal: { label: 'Metallic Gloss', css: 'contrast(1.14) brightness(1.06) saturate(0.7)', vignette: false },
  cinema: { label: 'Cinematic Contrast', css: 'contrast(1.32) saturate(1.08) brightness(0.94)', vignette: true },
};
const textStyles: Record<TextStyle, string> = { 'gold-serif': '골드 세리프', spec: '스펙 라벨', minimal: '미니멀' };
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const uid = () => crypto.randomUUID();
const readDuration = (url: string) => new Promise<number>((res, rej) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res(v.duration); v.onerror = () => rej(new Error('영상을 읽을 수 없어요.')); v.src = url; });

/** Full-screen seller video editor: trims/orders clips, crops 9:16, adds BGM/SFX, captions, text, filters and product tags, then exports one file. */
export function VideoEditor({ file, catalog, onDone, onCancel }: { file: File; catalog: { id: string; title: string }[]; onDone: (r: { file: File; tags: VideoTag[] }) => void; onCancel: () => void }) {
  const transcribe = useServerFn(transcribeVideoAudio);
  const [clips, setClips] = useState<Clip[]>([]);
  const [layer, setLayer] = useState<Layer>('clips');
  const [vertical, setVertical] = useState(true); const [cropX, setCropX] = useState(50);
  const [filter, setFilter] = useState<FilterId>('dark');
  const [texts, setTexts] = useState<TextLayer[]>([]); const [captions, setCaptions] = useState<Caption[]>([]); const [showCaptions, setShowCaptions] = useState(true);
  const [bgm, setBgm] = useState<BgmId | null>(null); const [bgmVol, setBgmVol] = useState(0.6); const [beatSync, setBeatSync] = useState(true); const [origVol, setOrigVol] = useState(1);
  const [sfx, setSfx] = useState<{ id: string; type: SfxType; at: number }[]>([]);
  const [tags, setTags] = useState<{ id: string; postId: string; title: string; at: number }[]>([]);
  const [t, setT] = useState(0); const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [draft, setDraft] = useState({ text: '', style: 'gold-serif' as TextStyle }); const [tagPick, setTagPick] = useState(catalog[0]?.id ?? '');
  const videoRef = useRef<HTMLVideoElement>(null); const audioCtx = useRef<AudioContext | null>(null); const audioSrc = useRef<AudioBufferSourceNode | null>(null);
  const soundtrack = useRef<AudioBuffer | null>(null); const tRef = useRef(0); const raf = useRef(0);

  const addFile = async (f: File) => { const url = URL.createObjectURL(f); try { const duration = await readDuration(url); setClips(c => [...c, { id: uid(), file: f, url, duration, start: 0, end: Math.min(duration, MAX_VIDEO_SECONDS) }]); } catch (e) { URL.revokeObjectURL(url); setErr(e instanceof Error ? e.message : '영상을 읽을 수 없어요.'); } };
  useEffect(() => { void addFile(file); return () => { cancelAnimationFrame(raf.current); audioSrc.current?.stop(); void audioCtx.current?.close(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clips.forEach(c => URL.revokeObjectURL(c.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = clips.reduce((s, c) => s + (c.end - c.start), 0);
  const bpm = bgm ? bgmPresets[bgm].bpm : 0;
  const snap = (x: number) => Math.max(0, Math.min(total, bgm && beatSync ? snapToBeat(x, bpm) : x));
  const locate = (time: number) => { let acc = 0; for (let i = 0; i < clips.length; i++) { const c = clips[i]!, len = c.end - c.start; if (time < acc + len || i === clips.length - 1) return { i, local: c.start + Math.min(len, Math.max(0, time - acc)) }; acc += len; } return { i: 0, local: 0 }; };
  const sfxKey = JSON.stringify(sfx.map(s => [s.type, s.at]));
  useEffect(() => { let off = false; void renderSoundtrack(total, bgm, bgmVol, sfx).then(b => { if (!off) soundtrack.current = b; }); return () => { off = true; }; }, [total, bgm, bgmVol, sfxKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const seek = (time: number) => { const clamped = Math.max(0, Math.min(total, time)); tRef.current = clamped; setT(clamped); const v = videoRef.current; if (!v || !clips.length) return; const { i, local } = locate(clamped); const c = clips[i]!; if (v.dataset['clip'] !== c.id) { v.src = c.url; v.dataset['clip'] = c.id; } v.currentTime = local; };
  useEffect(() => { if (clips.length) seek(Math.min(tRef.current, total)); }, [clips]); // eslint-disable-line react-hooks/exhaustive-deps
  const stop = () => { setPlaying(false); cancelAnimationFrame(raf.current); videoRef.current?.pause(); try { audioSrc.current?.stop(); } catch { /* already stopped */ } audioSrc.current = null; };
  const play = async () => {
    const v = videoRef.current; if (!v || !clips.length) return;
    if (tRef.current >= total - 0.05) seek(0);
    audioCtx.current ??= new AudioContext(); const ac = audioCtx.current; await ac.resume();
    if (soundtrack.current) { const s = ac.createBufferSource(); s.buffer = soundtrack.current; s.connect(ac.destination); s.start(0, tRef.current); audioSrc.current = s; }
    v.volume = origVol; await v.play().catch(() => undefined); setPlaying(true);
    const tick = () => {
      const { i } = locate(tRef.current); const c = clips[i]!; let acc = 0; for (let k = 0; k < i; k++) acc += clips[k]!.end - clips[k]!.start;
      if (v.currentTime >= c.end - 0.03) { if (i >= clips.length - 1) { stop(); seek(total); return; } seek(acc + (c.end - c.start) + 0.001); void v.play(); }
      else { tRef.current = acc + (v.currentTime - c.start); setT(tRef.current); }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const updateClip = (id: string, patch: Partial<Clip>) => setClips(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  const moveClip = (id: string, d: number) => setClips(cs => { const i = cs.findIndex(c => c.id === id), j = i + d; if (j < 0 || j >= cs.length) return cs; const n = [...cs]; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const autoCaptions = async () => {
    setBusy('captions'); setErr('');
    try { const wav = await clipsToWavBase64(clips); const list = await transcribe({ data: { wav, duration: total } }); setCaptions(list); if (!list.length) setErr('영상에서 말소리를 찾지 못했어요.'); }
    catch (e) { setErr(e instanceof Error ? e.message : '자막을 만들지 못했어요.'); } finally { setBusy(''); }
  };
  const activeTexts = texts.filter(x => t >= x.start && t <= x.end);
  const activeCaption = showCaptions ? captions.find(c => t >= c.start && t <= c.end) : undefined;
  const activeTags = tags.filter(x => t >= x.at && t <= x.at + 2.5);
  const beats = useMemo(() => bgm && beatSync ? beatTimes(bpm, total) : [], [bgm, beatSync, bpm, total]);

  const exportVideo = async () => {
    if (total > MAX_VIDEO_SECONDS + 0.05) return setErr('전체 길이를 30초 이하로 줄여 주세요.');
    stop(); setBusy('export'); setErr('');
    try {
      const first = clips[0]!; const probe = document.createElement('video'); probe.src = first.url; probe.muted = true; await new Promise(r => { probe.onloadedmetadata = r; });
      const W = vertical ? 720 : Math.min(1280, probe.videoWidth || 1280), H = vertical ? 1280 : Math.round(W * ((probe.videoHeight || 720) / (probe.videoWidth || 1280)));
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; const ctx = canvas.getContext('2d')!;
      const css = getComputedStyle(document.documentElement); const gold = css.getPropertyValue('--primary').trim() || 'goldenrod'; const fg = css.getPropertyValue('--foreground').trim() || 'white'; const shade = css.getPropertyValue('--background').trim() || 'black';
      const v = document.createElement('video'); v.playsInline = true; v.crossOrigin = 'anonymous';
      const ac = new AudioContext(); const dest = ac.createMediaStreamDestination(); const og = ac.createGain(); og.gain.value = origVol; ac.createMediaElementSource(v).connect(og).connect(dest);
      const stream = canvas.captureStream(30); dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
      const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 }); const chunks: Blob[] = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      const done = new Promise<void>(r => { rec.onstop = () => r(); });
      const drawFrame = (time: number) => {
        ctx.filter = luxuryFilters[filter].css; ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
        const vw = v.videoWidth || W, vh = v.videoHeight || H, scale = Math.max(W / vw, H / vh), dw = vw * scale, dh = vh * scale;
        ctx.drawImage(v, (W - dw) * (cropX / 100), (H - dh) / 2, dw, dh); ctx.filter = 'none';
        if (luxuryFilters[filter].vignette) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'transparent'); g.addColorStop(1, shade); ctx.globalAlpha = 0.7; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
        ctx.textAlign = 'center';
        texts.filter(x => time >= x.start && time <= x.end).forEach(x => {
          const y = H * (x.y / 100);
          if (x.style === 'gold-serif') { ctx.font = `600 ${Math.round(W * 0.07)}px "Noto Serif CJK KR", "Songti SC", serif`; ctx.fillStyle = gold; ctx.shadowColor = shade; ctx.shadowBlur = 12; ctx.fillText(x.text.toUpperCase(), W / 2, y); }
          else if (x.style === 'spec') { ctx.font = `500 ${Math.round(W * 0.04)}px ui-monospace, monospace`; ctx.fillStyle = fg; ctx.shadowBlur = 8; ctx.fillText(x.text, W / 2, y); ctx.fillStyle = gold; ctx.fillRect(W * 0.35, y + W * 0.02, W * 0.3, 2); }
          else { ctx.font = `500 ${Math.round(W * 0.05)}px system-ui, sans-serif`; ctx.fillStyle = fg; ctx.shadowBlur = 8; ctx.fillText(x.text, W / 2, y); }
          ctx.shadowBlur = 0;
        });
        const cap = showCaptions ? captions.find(c => time >= c.start && time <= c.end) : undefined;
        if (cap) { ctx.font = `500 ${Math.round(W * 0.045)}px system-ui, sans-serif`; const tw = ctx.measureText(cap.text).width; ctx.globalAlpha = 0.6; ctx.fillStyle = shade; ctx.fillRect(W / 2 - tw / 2 - 16, H * 0.8 - W * 0.05, tw + 32, W * 0.07); ctx.globalAlpha = 1; ctx.fillStyle = fg; ctx.fillText(cap.text, W / 2, H * 0.8); }
      };
      await ac.resume(); rec.start(250);
      if (soundtrack.current) { const s = ac.createBufferSource(); s.buffer = soundtrack.current; s.connect(dest); s.start(); }
      let acc = 0;
      for (const c of clips) {
        v.src = c.url; await new Promise(r => { v.onloadeddata = r; }); v.currentTime = c.start; await new Promise(r => { v.onseeked = r; });
        await v.play();
        await new Promise<void>(r => { const loop = () => { const local = v.currentTime; drawFrame(acc + local - c.start); setT(acc + local - c.start); if (local >= c.end - 0.02 || v.ended) { v.pause(); r(); } else requestAnimationFrame(loop); }; loop(); });
        acc += c.end - c.start;
      }
      rec.stop(); await done; await ac.close();
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      onDone({ file: new File(chunks, `vela-edit-${Date.now()}.${ext}`, { type: mime.split(';')[0] ?? 'video/webm' }), tags: tags.map(({ postId, title, at }) => ({ postId, title, at: +at.toFixed(2) })) });
    } catch (e) { setErr(e instanceof Error ? e.message : '영상을 만들지 못했어요.'); } finally { setBusy(''); }
  };

  const layers: [Layer, string, typeof Scissors][] = [['clips', '자르기·순서', Scissors], ['text', '텍스트·자막', Type], ['music', '음악·효과음', Music], ['filter', '필터', Palette], ['tags', '상품 태그', Tag]];
  return <div role="dialog" aria-modal="true" aria-label="영상 편집" className="video-editor">
    <header className="video-editor-head"><Button variant="ghost" size="icon" aria-label="편집 취소" onClick={onCancel} disabled={busy === 'export'}><X/></Button><h2>영상 편집</h2><Button variant="gold" size="sm" disabled={!clips.length || !!busy || total > MAX_VIDEO_SECONDS + 0.05} onClick={() => void exportVideo()}>{busy === 'export' ? <><Loader2 className="animate-spin"/>만드는 중…</> : '편집 완료'}</Button></header>
    <div className="video-editor-body">
      <div className={`video-editor-stage ${vertical ? 'is-vertical' : ''}`}>
        <video ref={videoRef} playsInline className="video-editor-video" style={{ filter: luxuryFilters[filter].css, objectPosition: `${cropX}% 50%` }} onLoadedData={() => videoRef.current && (videoRef.current.volume = origVol)}/>
        {luxuryFilters[filter].vignette && <div className="video-editor-vignette"/>}
        {activeTexts.map(x => <div key={x.id} className={`video-text-layer text-${x.style}`} style={{ top: `${x.y}%` }}>{x.text}</div>)}
        {activeCaption && <div className="video-caption-layer">{activeCaption.text}</div>}
        {activeTags.map(x => <div key={x.id} className="video-tag-pin"><Tag size={12}/>{x.title}</div>)}
        {busy === 'export' && <div className="video-editor-busy"><Loader2 className="animate-spin"/>영상 내보내는 중 · {fmt(t)} / {fmt(total)}</div>}
      </div>
      <div className="video-editor-timeline">
        <Button variant="goldOutline" size="icon" aria-label={playing ? '일시정지' : '재생'} onClick={() => playing ? stop() : void play()} disabled={!clips.length || !!busy}>{playing ? <Pause/> : <Play/>}</Button>
        <div className="video-timeline-track">
          <div className="video-timeline-clips">{clips.map(c => <span key={c.id} style={{ flex: c.end - c.start }}/>)}</div>
          {beats.map(b => <i key={b} className="beat" style={{ left: `${(b / Math.max(total, 0.01)) * 100}%` }}/>)}
          {texts.map(x => <i key={x.id} className="mark text" style={{ left: `${(x.start / Math.max(total, 0.01)) * 100}%` }}/>)}
          {tags.map(x => <i key={x.id} className="mark tag" style={{ left: `${(x.at / Math.max(total, 0.01)) * 100}%` }}/>)}
          {sfx.map(x => <i key={x.id} className="mark sfx" style={{ left: `${(x.at / Math.max(total, 0.01)) * 100}%` }}/>)}
          <input type="range" aria-label="타임라인 탐색" min={0} max={Math.max(total, 0.1)} step={0.05} value={t} onChange={e => { stop(); seek(Number(e.target.value)); }}/>
        </div>
        <span className={`video-timeline-time ${total > MAX_VIDEO_SECONDS + 0.05 ? 'text-destructive' : ''}`}>{fmt(t)} / {fmt(total)}</span>
      </div>
      {err && <p role="alert" className="px-4 text-xs text-destructive">{err}</p>}
      <nav className="video-editor-layers" aria-label="편집 레이어">{layers.map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={layer === id} className={layer === id ? 'active' : ''} onClick={() => setLayer(id)}><Icon size={16}/>{label}</button>)}</nav>
      <section className="video-editor-panel">
        {layer === 'clips' && <>
          <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant={vertical ? 'gold' : 'goldOutline'} onClick={() => setVertical(true)}>9:16 쇼츠</Button><Button size="sm" variant={!vertical ? 'gold' : 'goldOutline'} onClick={() => setVertical(false)}>원본 비율</Button>
            <label className="ml-auto flex cursor-pointer items-center gap-1 text-xs text-primary"><Plus size={14}/>클립 추가<input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addFile(f); }}/></label></div>
          {vertical && <label className="editor-row">자르기 위치(좌우)<input type="range" min={0} max={100} value={cropX} onChange={e => setCropX(Number(e.target.value))}/></label>}
          {total > MAX_VIDEO_SECONDS + 0.05 && <p className="text-xs text-destructive">전체 길이가 30초를 넘어요. 클립 구간을 줄여 주세요.</p>}
          {clips.map((c, i) => <div key={c.id} className="editor-card"><div className="flex items-center gap-2 text-xs"><strong>클립 {i + 1}</strong><span className="text-muted-foreground">{fmt(c.start)} – {fmt(c.end)} ({(c.end - c.start).toFixed(1)}초)</span><span className="ml-auto flex gap-1"><Button size="icon" variant="ghost" className="size-7" aria-label="앞으로" disabled={i === 0} onClick={() => moveClip(c.id, -1)}><ArrowUp/></Button><Button size="icon" variant="ghost" className="size-7" aria-label="뒤로" disabled={i === clips.length - 1} onClick={() => moveClip(c.id, 1)}><ArrowDown/></Button><Button size="icon" variant="ghost" className="size-7" aria-label="클립 삭제" disabled={clips.length === 1} onClick={() => setClips(cs => cs.filter(x => x.id !== c.id))}><Trash2/></Button></span></div>
            <label className="editor-row">시작<input type="range" min={0} max={c.duration} step={0.1} value={c.start} onChange={e => updateClip(c.id, { start: Math.min(Number(e.target.value), c.end - 0.5) })}/></label>
            <label className="editor-row">끝<input type="range" min={0} max={c.duration} step={0.1} value={c.end} onChange={e => updateClip(c.id, { end: Math.max(Number(e.target.value), c.start + 0.5) })}/></label></div>)}
        </>}
        {layer === 'text' && <>
          <div className="editor-card"><div className="flex items-center gap-2"><Captions size={16} className="text-primary"/><strong className="text-sm">자동 자막</strong><Button size="sm" variant="goldOutline" className="ml-auto" disabled={!!busy || !clips.length} onClick={() => void autoCaptions()}>{busy === 'captions' ? <><Loader2 className="animate-spin"/>생성 중…</> : captions.length ? '다시 생성' : '음성에서 자막 만들기'}</Button></div>
            {captions.length > 0 && <><label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={showCaptions} onChange={e => setShowCaptions(e.target.checked)}/>자막 표시</label><div className="mt-2 grid max-h-40 gap-1 overflow-y-auto">{captions.map((c, i) => <div key={i} className="flex items-center gap-2 text-xs"><span className="w-16 shrink-0 text-muted-foreground">{fmt(c.start)}</span><input className="form-input !mt-0 !py-1 text-xs" value={c.text} maxLength={80} onChange={e => setCaptions(cs => cs.map((x, k) => k === i ? { ...x, text: e.target.value } : x))}/></div>)}</div></>}</div>
          <div className="editor-card"><strong className="text-sm">스펙 텍스트 추가</strong><input className="form-input" placeholder="예: VS3235 · 41MM · 904L" maxLength={40} value={draft.text} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))}/>
            <div className="mt-2 flex flex-wrap gap-2">{(Object.keys(textStyles) as TextStyle[]).map(s => <button key={s} type="button" className={`editor-chip text-${s} ${draft.style === s ? 'active' : ''}`} onClick={() => setDraft(d => ({ ...d, style: s }))}>{textStyles[s]}</button>)}</div>
            <Button size="sm" variant="gold" className="mt-2" disabled={!draft.text.trim()} onClick={() => { const start = snap(t); setTexts(ts => [...ts, { id: uid(), text: draft.text.trim(), style: draft.style, start, end: Math.min(total, start + 3), y: 22 }]); setDraft(d => ({ ...d, text: '' })); }}>현재 위치({fmt(snap(t))})에 추가</Button></div>
          {texts.map(x => <div key={x.id} className="editor-card text-xs"><div className="flex items-center gap-2"><strong className="truncate">{x.text}</strong><span className="text-muted-foreground">{textStyles[x.style]}</span><Button size="icon" variant="ghost" className="ml-auto size-7" aria-label="텍스트 삭제" onClick={() => setTexts(ts => ts.filter(y => y.id !== x.id))}><Trash2/></Button></div>
            <label className="editor-row">시작 {fmt(x.start)}<input type="range" min={0} max={total} step={0.1} value={x.start} onChange={e => setTexts(ts => ts.map(y => y.id === x.id ? { ...y, start: snap(Number(e.target.value)), end: Math.max(y.end, snap(Number(e.target.value)) + 0.5) } : y))}/></label>
            <label className="editor-row">끝 {fmt(x.end)}<input type="range" min={0} max={total} step={0.1} value={x.end} onChange={e => setTexts(ts => ts.map(y => y.id === x.id ? { ...y, end: Math.max(y.start + 0.5, Number(e.target.value)) } : y))}/></label>
            <label className="editor-row">세로 위치<input type="range" min={8} max={90} value={x.y} onChange={e => setTexts(ts => ts.map(y => y.id === x.id ? { ...y, y: Number(e.target.value) } : y))}/></label></div>)}
        </>}
        {layer === 'music' && <>
          <div className="grid gap-2">{([null, ...Object.keys(bgmPresets)] as (BgmId | null)[]).map(id => <button key={id ?? 'none'} type="button" className={`editor-option ${bgm === id ? 'active' : ''}`} onClick={() => setBgm(id)}><Music size={14}/>{id ? bgmPresets[id].label : '배경음악 없음'}</button>)}</div>
          {bgm && <><label className="editor-row">음악 볼륨<input type="range" min={0} max={1} step={0.05} value={bgmVol} onChange={e => setBgmVol(Number(e.target.value))}/></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={beatSync} onChange={e => setBeatSync(e.target.checked)}/>비트 싱크 · 텍스트·태그·효과음을 박자에 맞춰 배치</label></>}
          <label className="editor-row">원본 소리<input type="range" min={0} max={1} step={0.05} value={origVol} onChange={e => { setOrigVol(Number(e.target.value)); if (videoRef.current) videoRef.current.volume = Number(e.target.value); }}/></label>
          <div className="editor-card"><strong className="text-sm">럭셔리 효과음</strong><div className="mt-2 flex flex-wrap gap-2">{(Object.keys(sfxPresets) as SfxType[]).map(s => <Button key={s} size="sm" variant="goldOutline" onClick={() => setSfx(x => [...x, { id: uid(), type: s, at: snap(t) }])}>+ {sfxPresets[s].label}</Button>)}</div>
            {sfx.map(x => <div key={x.id} className="mt-2 flex items-center gap-2 text-xs"><span>{sfxPresets[x.type].label}</span><span className="text-muted-foreground">{fmt(x.at)}</span><Button size="icon" variant="ghost" className="ml-auto size-7" aria-label="효과음 삭제" onClick={() => setSfx(s => s.filter(y => y.id !== x.id))}><Trash2/></Button></div>)}</div>
        </>}
        {layer === 'filter' && <div className="grid grid-cols-2 gap-2">{(Object.keys(luxuryFilters) as FilterId[]).map(f => <button key={f} type="button" className={`editor-option ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}><span className="editor-swatch" style={{ filter: luxuryFilters[f].css }}/>{luxuryFilters[f].label}</button>)}</div>}
        {layer === 'tags' && <>
          {catalog.length ? <div className="editor-card"><strong className="text-sm">VELA 상품 태그</strong><select aria-label="태그할 상품" className="form-input" value={tagPick} onChange={e => setTagPick(e.target.value)}>{catalog.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            <Button size="sm" variant="gold" className="mt-2" disabled={!tagPick} onClick={() => { const item = catalog.find(c => c.id === tagPick); if (item) setTags(ts => [...ts, { id: uid(), postId: item.id, title: item.title, at: snap(t) }]); }}>현재 위치({fmt(snap(t))})에 태그</Button></div>
            : <p className="text-xs text-muted-foreground">태그할 수 있는 내 상품이 아직 없어요. 상품을 먼저 게시하면 영상에 연결할 수 있어요.</p>}
          {tags.map(x => <div key={x.id} className="editor-card flex items-center gap-2 text-xs"><Tag size={14} className="text-primary"/><span className="truncate">{x.title}</span><span className="text-muted-foreground">{fmt(x.at)}</span><Button size="icon" variant="ghost" className="ml-auto size-7" aria-label="태그 삭제" onClick={() => setTags(ts => ts.filter(y => y.id !== x.id))}><Trash2/></Button></div>)}
        </>}
      </section>
    </div>
  </div>;
}
