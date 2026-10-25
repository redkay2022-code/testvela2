import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useServerFn } from '@tanstack/react-start';
import { ArrowDown, ArrowUp, Captions, Image as ImageIcon, Loader2, Music, Palette, Pause, Play, Plus, Scissors, Tag, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_VIDEO_SECONDS } from '@/lib/listing-media';
import { MusicPicker, QuickMusicList, type SelectedMusic } from './music-picker';
import { editorFonts, ensureEditorFonts, fontStack, loadFontForCanvas } from '@/lib/editor-fonts';
import { beatTimes, bgmCredit, bgmPresets, preloadBgm, clipsToWavBase64, renderSoundtrack, snapToBeat, type BgmId, type SfxType } from '@/lib/video-audio';
import { transcribeVideoAudio } from '@/lib/video-captions.functions';

export type VideoTag = { postId: string; title: string; at: number };
type Clip = { id: string; file: File; url: string; duration: number; start: number; end: number };
type TextLayer = { id: string; text: string; start: number; end: number; style: TextStyle; x: number; y: number; size: number; font: string };
type Caption = { start: number; end: number; text: string };
type TextStyle = 'gold-serif' | 'spec' | 'minimal';
type FilterId = 'none' | 'bright' | 'dark' | 'metal' | 'cinema';
type Layer = 'clips' | 'text' | 'music' | 'filter' | 'tags' | 'cover';

export const luxuryFilters: Record<FilterId, { label: string; css: string; vignette: boolean }> = {
  none: { label: '원본', css: 'none', vignette: false },
  bright: { label: 'Bright Clean', css: 'brightness(1.08) contrast(1.04) saturate(1.05)', vignette: false },
  dark: { label: 'Dark Luxury', css: 'contrast(1.18) brightness(0.86) saturate(0.85) sepia(0.12)', vignette: true },
  metal: { label: 'Metallic Gloss', css: 'contrast(1.14) brightness(1.06) saturate(0.7)', vignette: false },
  cinema: { label: 'Cinematic Contrast', css: 'contrast(1.32) saturate(1.08) brightness(0.94)', vignette: true },
};
const textStyles: Record<TextStyle, string> = { 'gold-serif': '골드 세리프', spec: '스펙 라벨', minimal: '미니멀' };
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const uid = () => crypto.randomUUID();
const readDuration = (url: string) => new Promise<number>((res, rej) => { const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.onloadedmetadata = () => { if (Number.isFinite(v.duration)) return res(v.duration); v.ondurationchange = () => { if (Number.isFinite(v.duration)) res(v.duration); }; v.currentTime = 1e7; }; v.onerror = () => rej(new Error('영상을 읽을 수 없어요.')); v.src = url; });

/** Full-screen seller video editor: trims/orders clips, crops 9:16, adds BGM/SFX, captions, text, filters and product tags, then exports one file. */
export function VideoEditor({ file, catalog, onDone, onCancel, music, onMusicChange, maxSeconds }: { maxSeconds?: number | undefined; file: File; catalog: { id: string; title: string }[]; onDone: (r: { file: File; tags: VideoTag[]; cover?: Blob }) => void; onCancel: () => void; music?: SelectedMusic | null; onMusicChange?: (m: SelectedMusic | null) => void }) {
  const LIMIT = maxSeconds ?? MAX_VIDEO_SECONDS, long = LIMIT > MAX_VIDEO_SECONDS; // 스토리는 10분까지
  const [pickerOpen, setPickerOpen] = useState(false); const musicAudio = useRef<HTMLAudioElement | null>(null);
  const transcribe = useServerFn(transcribeVideoAudio);
  const [clips, setClips] = useState<Clip[]>([]);
  const [layer, setLayer] = useState<Layer>('clips');
  const [vertical, setVertical] = useState(true); const [cropX, setCropX] = useState(50);
  const [filter, setFilter] = useState<FilterId>('none');
  const [texts, setTexts] = useState<TextLayer[]>([]); const [captions, setCaptions] = useState<Caption[]>([]); const [showCaptions, setShowCaptions] = useState(true);
  const [bgm, setBgm] = useState<BgmId | null>(null); const [bgmVol, setBgmVol] = useState(0.6); const [beatSync, setBeatSync] = useState(true); const [origVol, setOrigVol] = useState(1); const [origOff, setOrigOff] = useState(false);
  const effVol = origOff ? 0 : origVol;
  const [limitPopup, setLimitPopup] = useState(false); const limitShown = useRef(false);
  const [sfx, setSfx] = useState<{ id: string; type: SfxType; at: number }[]>([]);
  const [tags, setTags] = useState<{ id: string; postId: string; title: string; at: number }[]>([]);
  const [t, setT] = useState(0); const [playing, setPlaying] = useState(false);
  /* 썸네일: 영상 위에서 장면을 고르거나(coverAt), 사진을 직접 첨부(coverPhoto). 둘 다 없으면 자동. */
  const [coverAt, setCoverAt] = useState<number | null>(null); const [coverPhoto, setCoverPhoto] = useState<File | null>(null); const [coverPreview, setCoverPreview] = useState('');
  useEffect(() => { if (!coverPhoto) { setCoverPreview(''); return; } const u = URL.createObjectURL(coverPhoto); setCoverPreview(u); return () => URL.revokeObjectURL(u); }, [coverPhoto]);
  useEffect(() => { const a = musicAudio.current; if (!a) return; if (playing) { void a.play().catch(() => undefined); } else a.pause(); }, [playing, music?.music_audio_url]);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [draft, setDraft] = useState({ text: '', style: 'gold-serif' as TextStyle, font: '' }); const [tagPick, setTagPick] = useState(catalog[0]?.id ?? '');
  const stageRef = useRef<HTMLDivElement>(null); const dragText = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null); const audioCtx = useRef<AudioContext | null>(null); const audioSrc = useRef<AudioBufferSourceNode | null>(null);
  const soundtrack = useRef<AudioBuffer | null>(null); const tRef = useRef(0); const raf = useRef(0);

  const addFile = async (f: File) => { const url = URL.createObjectURL(f); try { const duration = await readDuration(url); setClips(c => [...c, { id: uid(), file: f, url, duration, start: 0, end: duration }]); } catch (e) { URL.revokeObjectURL(url); setErr(e instanceof Error ? e.message : '영상을 읽을 수 없어요.'); } };
  const loaded = useRef(false);
  useEffect(() => { if (!loaded.current) { loaded.current = true; void addFile(file); } return () => { cancelAnimationFrame(raf.current); audioSrc.current?.stop(); void audioCtx.current?.close(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clips.forEach(c => URL.revokeObjectURL(c.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = clips.reduce((s, c) => s + (c.end - c.start), 0);
  useEffect(() => { ensureEditorFonts(); }, []);
  useEffect(() => { if (videoRef.current) videoRef.current.volume = effVol; }, [effVol, clips.length]);
  /* Past 30 seconds the editor cannot continue: show the notice once each time the total crosses the limit. */
  useEffect(() => { if (total > LIMIT + 0.05) { if (!limitShown.current) { limitShown.current = true; setLimitPopup(true); } } else limitShown.current = false; }, [total]);
  /* Keeps the first 30 seconds in order; later clips are removed. */
  const fitToLimit = () => { let left = LIMIT; setClips(cs => cs.flatMap(c => { if (left <= 0.05) return []; const len = Math.min(c.end - c.start, left); left -= len; return [{ ...c, end: c.start + len }]; })); setLimitPopup(false); };
  const bpm = bgm ? bgmPresets[bgm]!.bpm : 0;
  const snap = (x: number) => Math.max(0, Math.min(total, bgm && beatSync ? snapToBeat(x, bpm) : x));
  const locate = (time: number) => { let acc = 0; for (let i = 0; i < clips.length; i++) { const c = clips[i]!, len = c.end - c.start; if (time < acc + len || i === clips.length - 1) return { i, local: c.start + Math.min(len, Math.max(0, time - acc)) }; acc += len; } return { i: 0, local: 0 }; };
  const sfxKey = JSON.stringify(sfx.map(s => [s.type, s.at]));
  useEffect(() => { let off = false; if (!bgm || total <= 0) { soundtrack.current = null; try { audioSrc.current?.stop(); } catch { /* stopped */ } audioSrc.current = null; return; } const timer = setTimeout(() => void renderSoundtrack(total, bgm, bgmVol, sfx).then(b => { if (off) return; soundtrack.current = b; const ac = audioCtx.current; if (audioSrc.current && ac) { try { audioSrc.current.stop(); } catch { /* stopped */ } const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0, Math.min(tRef.current, b.duration)); audioSrc.current = s; } }), 200); return () => { off = true; clearTimeout(timer); }; }, [total, bgm, bgmVol, sfxKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const seek = (time: number) => { const clamped = Math.max(0, Math.min(total, time)); tRef.current = clamped; setT(clamped); const v = videoRef.current; if (!v || !clips.length) return; const { i, local } = locate(clamped); const c = clips[i]!; if (v.dataset['clip'] !== c.id) { v.src = c.url; v.dataset['clip'] = c.id; } v.currentTime = local; };
  useEffect(() => { if (clips.length) seek(Math.min(tRef.current, total)); }, [clips]); // eslint-disable-line react-hooks/exhaustive-deps
  const stop = () => { setPlaying(false); cancelAnimationFrame(raf.current); videoRef.current?.pause(); try { audioSrc.current?.stop(); } catch { /* already stopped */ } audioSrc.current = null; };
  const play = async () => {
    const v = videoRef.current; if (!v || !clips.length) return;
    if (tRef.current >= total - 0.05) seek(0);
    audioCtx.current ??= new AudioContext(); const ac = audioCtx.current; await ac.resume();
    if (soundtrack.current) { const s = ac.createBufferSource(); s.buffer = soundtrack.current; s.connect(ac.destination); s.start(0, tRef.current); audioSrc.current = s; }
    v.volume = effVol; await v.play().catch(() => undefined); setPlaying(true);
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
  const autoCaptions = async (toEnglish = false) => {
    setBusy(toEnglish ? 'captions-en' : 'captions'); setErr('');
    try { const wav = await clipsToWavBase64(clips); const list = await transcribe({ data: { wav, duration: total, toEnglish } }); setCaptions(list); if (!list.length) setErr('영상에서 말소리를 찾지 못했어요.'); }
    catch (e) { setErr(e instanceof Error ? e.message : '자막을 만들지 못했어요.'); } finally { setBusy(''); }
  };
  const activeTexts = texts.filter(x => t >= x.start && t <= x.end);
  /* Text can be dragged anywhere on the preview; the position is stored as a % of the frame so the export matches. */
  const startDrag = (e: ReactPointerEvent<HTMLDivElement>, id: string) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); dragText.current = id; };
  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => { const id = dragText.current, box = stageRef.current?.getBoundingClientRect(); if (!id || !box || !box.width || !box.height) return; const x = Math.min(95, Math.max(5, ((e.clientX - box.left) / box.width) * 100)), y = Math.min(95, Math.max(5, ((e.clientY - box.top) / box.height) * 100)); setTexts(ts => ts.map(k => k.id === id ? { ...k, x: +x.toFixed(1), y: +y.toFixed(1) } : k)); };
  const endDrag = () => { dragText.current = null; };
  const activeCaption = showCaptions ? captions.find(c => t >= c.start && t <= c.end) : undefined;
  const activeTags = tags.filter(x => t >= x.at && t <= x.at + 2.5);
  const beats = useMemo(() => bgm && beatSync ? beatTimes(bpm, total) : [], [bgm, beatSync, bpm, total]);

  const exportVideo = async () => {
    if (total > LIMIT + 0.05) return setErr(long ? '전체 길이를 10분 이하로 줄여 주세요.' : '전체 길이를 1분 이하로 줄여 주세요.');
    stop(); setBusy('export'); setErr('');
    try {
      const first = clips[0]!; const probe = document.createElement('video'); probe.src = first.url; probe.muted = true; await new Promise(r => { probe.onloadedmetadata = r; });
      const W = vertical ? 720 : Math.min(960, probe.videoWidth || 960), H = vertical ? 1280 : Math.round(W * ((probe.videoHeight || 720) / (probe.videoWidth || 1280)));
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; const ctx = canvas.getContext('2d')!;
      const css = getComputedStyle(document.documentElement); const gold = css.getPropertyValue('--primary').trim() || 'goldenrod'; const fg = css.getPropertyValue('--foreground').trim() || 'white'; const shade = css.getPropertyValue('--background').trim() || 'black';
      const v = document.createElement('video'); v.playsInline = true; v.crossOrigin = 'anonymous';
      const ac = new AudioContext(); const dest = ac.createMediaStreamDestination(); const og = ac.createGain(); og.gain.value = effVol; ac.createMediaElementSource(v).connect(og).connect(dest);
      const stream = canvas.captureStream(30); dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
      const mime = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(Math.min(2_500_000, W * H * 2.4)), audioBitsPerSecond: 96_000 }); const chunks: Blob[] = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      const done = new Promise<void>(r => { rec.onstop = () => r(); });
      const drawFrame = (time: number) => {
        ctx.filter = luxuryFilters[filter].css; ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
        const vw = v.videoWidth || W, vh = v.videoHeight || H, scale = Math.max(W / vw, H / vh), dw = vw * scale, dh = vh * scale;
        ctx.drawImage(v, (W - dw) * (cropX / 100), (H - dh) / 2, dw, dh); ctx.filter = 'none';
        if (luxuryFilters[filter].vignette) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'transparent'); g.addColorStop(1, shade); ctx.globalAlpha = 0.7; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        texts.filter(x => time >= x.start && time <= x.end).forEach(x => {
          const cx = W * (x.x / 100), cy = H * (x.y / 100), k = x.size, own = fontStack(x.font);
          if (x.style === 'gold-serif') { ctx.font = `600 ${Math.round(W * 0.07 * k)}px ${own ?? '"Noto Serif CJK KR", "Songti SC", serif'}`; ctx.fillStyle = gold; ctx.shadowColor = shade; ctx.shadowBlur = 12; ctx.fillText(x.text.toUpperCase(), cx, cy, W * 0.92); }
          else if (x.style === 'spec') { ctx.font = `500 ${Math.round(W * 0.04 * k)}px ${own ?? 'ui-monospace, monospace'}`; ctx.fillStyle = fg; ctx.shadowColor = shade; ctx.shadowBlur = 8; ctx.fillText(x.text, cx, cy, W * 0.92); ctx.fillStyle = gold; ctx.fillRect(cx - W * 0.15 * k, cy + W * 0.03 * k, W * 0.3 * k, 2); }
          else { ctx.font = `500 ${Math.round(W * 0.05 * k)}px ${own ?? 'system-ui, sans-serif'}`; ctx.fillStyle = fg; ctx.shadowColor = shade; ctx.shadowBlur = 8; ctx.fillText(x.text, cx, cy, W * 0.92); }
          ctx.shadowBlur = 0;
        });
        ctx.textBaseline = 'alphabetic';
        const cap = showCaptions ? captions.find(c => time >= c.start && time <= c.end) : undefined;
        if (cap) { ctx.font = `500 ${Math.round(W * 0.045)}px system-ui, sans-serif`; const tw = ctx.measureText(cap.text).width; ctx.globalAlpha = 0.6; ctx.fillStyle = shade; ctx.fillRect(W / 2 - tw / 2 - 16, H * 0.8 - W * 0.05, tw + 32, W * 0.07); ctx.globalAlpha = 1; ctx.fillStyle = fg; ctx.fillText(cap.text, W / 2, H * 0.8); }
      };
      await Promise.all([...new Set(texts.filter(x => x.font).map(x => x.font))].map(f => loadFontForCanvas(f, texts.map(x => x.text).join(''))));
      await ac.resume(); rec.start(250);
      if (soundtrack.current) { const s = ac.createBufferSource(); s.buffer = soundtrack.current; s.connect(dest); s.start(); }
      let acc = 0; const shot: { p: Promise<Blob | null> | null } = { p: null };
      const shoot = () => { shot.p = new Promise<Blob | null>(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.85)); };
      for (const c of clips) {
        v.src = c.url; await new Promise(r => { v.onloadeddata = r; }); v.currentTime = c.start; await new Promise(r => { v.onseeked = r; });
        await v.play();
        await new Promise<void>(r => { const loop = () => { const local = v.currentTime; drawFrame(acc + local - c.start); setT(acc + local - c.start); if (coverAt !== null && !shot.p && acc + local - c.start >= coverAt - 0.02) shoot(); if (local >= c.end - 0.02 || v.ended) { v.pause(); r(); } else requestAnimationFrame(loop); }; loop(); });
        acc += c.end - c.start;
      }
      if (coverAt !== null && !shot.p) shoot();
      rec.stop(); await done; await ac.close();
      const cover: Blob | undefined = coverPhoto ?? (shot.p ? (await shot.p) ?? undefined : undefined);
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      onDone({ file: new File(chunks, `vela-edit-${Date.now()}.${ext}`, { type: mime.split(';')[0] ?? 'video/webm' }), tags: tags.map(({ postId, title, at }) => ({ postId, title, at: +at.toFixed(2) })), ...(cover ? { cover } : {}) });
    } catch (e) { setErr(e instanceof Error ? e.message : '영상을 만들지 못했어요.'); } finally { setBusy(''); }
  };

  const layers: [Layer, string, typeof Scissors][] = [['clips', '자르기·순서', Scissors], ['music', '음악 추가', Music], ['filter', '필터', Palette], ['tags', '상품 태그', Tag], ['cover', '썸네일', ImageIcon]];
  return createPortal(<div role="dialog" aria-modal="true" aria-label="영상 편집" className="video-editor" data-no-translate>
    <header className="video-editor-head"><Button variant="ghost" size="icon" aria-label="편집 취소" onClick={onCancel} disabled={busy === 'export'}><X/></Button><h2>영상 편집</h2><Button variant="gold" size="sm" disabled={!clips.length || !!busy} onClick={() => { if (total > LIMIT + 0.05) { setLimitPopup(true); return; } void exportVideo(); }}>{busy === 'export' ? <><Loader2 className="animate-spin"/>만드는 중…</> : '편집 완료'}</Button></header>
    <div className="video-editor-body">
      <div ref={stageRef} className={`video-editor-stage ${vertical ? 'is-vertical' : ''}`}>
        <video ref={videoRef} playsInline className="video-editor-video" style={{ filter: luxuryFilters[filter].css, objectPosition: `${cropX}% 50%` }} onLoadedData={() => videoRef.current && (videoRef.current.volume = effVol)}/>
        {luxuryFilters[filter].vignette && <div className="video-editor-vignette"/>}
        {activeTexts.map(x => <div key={x.id} className={`video-text-layer text-${x.style}`} role="button" tabIndex={0} aria-label={`텍스트 이동: ${x.text}`} style={{ left: `${x.x}%`, top: `${x.y}%`, right: 'auto', width: 'max-content', maxWidth: '92%', transform: `translate(-50%,-50%) scale(${x.size})`, fontFamily: fontStack(x.font) ?? undefined, pointerEvents: 'auto', touchAction: 'none', cursor: 'grab' }} onPointerDown={e => startDrag(e, x.id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>{x.text}</div>)}
        {clips.length > 0 && <button type="button" className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1 text-[11px] text-foreground" aria-pressed={origOff} onClick={() => setOrigOff(o => !o)}>{origOff ? <VolumeX size={13}/> : <Volume2 size={13}/>}{origOff ? '원래 소리 꺼짐' : '원래 소리 켜짐'}</button>}
        {activeCaption && <div className="video-caption-layer">{activeCaption.text}</div>}
        {activeTags.map(x => <div key={x.id} className="video-tag-pin"><Tag size={12}/>{x.title}</div>)}
        {busy === 'export' && <div className="video-editor-busy"><Loader2 className="animate-spin"/>{`영상 내보내는 중 · ${fmt(t)} / ${fmt(total)}`}</div>}
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
        <span className={`video-timeline-time ${total > LIMIT + 0.05 ? 'text-destructive' : ''}`}>{fmt(t)} / {fmt(total)}</span>
      </div>
      {err && <p role="alert" className="px-4 text-xs text-destructive">{err}</p>}
      <nav className="video-editor-layers" aria-label="편집 레이어">{layers.map(([id, label, Icon]) => <button key={id} type="button" aria-pressed={layer === id} className={layer === id ? 'active' : ''} onClick={() => setLayer(id)}><Icon size={16}/>{label}</button>)}</nav>
      <section className="video-editor-panel">
        {layer === 'clips' && <>
          <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant={vertical ? 'gold' : 'goldOutline'} onClick={() => setVertical(true)}>9:16 쇼츠</Button><Button size="sm" variant={!vertical ? 'gold' : 'goldOutline'} onClick={() => setVertical(false)}>원본 비율</Button>
            <label className="ml-auto flex cursor-pointer items-center gap-1 text-xs text-primary"><Plus size={14}/>클립 추가<input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addFile(f); }}/></label></div>
          {vertical && <label className="editor-row">자르기 위치(좌우)<input type="range" min={0} max={100} value={cropX} onChange={e => setCropX(Number(e.target.value))}/></label>}
          {total > LIMIT + 0.05 && <p className="text-xs text-destructive">{long ? '전체 길이가 10분을 넘어요. 클립 구간을 줄여 주세요.' : '전체 길이가 1분을 넘어요. 클립 구간을 줄여 주세요.'}</p>}
          {clips.map((c, i) => <div key={c.id} className="editor-card"><div className="flex items-center gap-2 text-xs"><strong>{`클립 ${i + 1}`}</strong><span className="text-muted-foreground">{fmt(c.start)} – {fmt(c.end)} {`(${(c.end - c.start).toFixed(1)}초)`}</span><span className="ml-auto flex gap-1"><Button size="icon" variant="ghost" className="size-7" aria-label="앞으로" disabled={i === 0} onClick={() => moveClip(c.id, -1)}><ArrowUp/></Button><Button size="icon" variant="ghost" className="size-7" aria-label="뒤로" disabled={i === clips.length - 1} onClick={() => moveClip(c.id, 1)}><ArrowDown/></Button><Button size="icon" variant="ghost" className="size-7" aria-label="클립 삭제" disabled={clips.length === 1} onClick={() => setClips(cs => cs.filter(x => x.id !== c.id))}><Trash2/></Button></span></div>
            <div className="trim-range" style={{ ['--s' as string]: `${(c.start / c.duration) * 100}%`, ['--e' as string]: `${(c.end / c.duration) * 100}%` }}><div className="trim-track"/><input type="range" aria-label="시작 지점" min={0} max={c.duration} step={0.1} value={c.start} onChange={e => updateClip(c.id, { start: Math.min(Number(e.target.value), c.end - 0.5) })}/><input type="range" aria-label="끝 지점" min={0} max={c.duration} step={0.1} value={c.end} onChange={e => updateClip(c.id, { end: Math.max(Number(e.target.value), c.start + 0.5) })}/></div>
            <div className="flex justify-between text-[11px] text-muted-foreground"><span>0:00</span><span>{fmt(c.duration)}</span></div></div>)}
        </>}
        {layer === 'text' && <>
          <div className="editor-card"><div className="flex flex-wrap items-center gap-2"><Captions size={16} className="text-primary"/><strong className="text-sm">자동 자막</strong><div className="ml-auto flex gap-1"><Button size="sm" variant="goldOutline" disabled={!!busy || !clips.length} onClick={() => void autoCaptions()}>{busy === 'captions' ? <><Loader2 className="animate-spin"/>생성 중…</> : captions.length ? '다시 생성' : '원어 자막'}</Button><Button size="sm" variant="goldOutline" disabled={!!busy || !clips.length} onClick={() => void autoCaptions(true)}>{busy === 'captions-en' ? <><Loader2 className="animate-spin"/>번역 중…</> : '영어 자막 (中→EN)'}</Button></div></div>
            {captions.length > 0 && <><label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={showCaptions} onChange={e => setShowCaptions(e.target.checked)}/>자막 표시</label><div className="mt-2 grid max-h-40 gap-1 overflow-y-auto">{captions.map((c, i) => <div key={i} className="flex items-center gap-2 text-xs"><span className="w-16 shrink-0 text-muted-foreground">{fmt(c.start)}</span><input className="form-input !mt-0 !py-1 text-xs" value={c.text} maxLength={80} onChange={e => setCaptions(cs => cs.map((x, k) => k === i ? { ...x, text: e.target.value } : x))}/></div>)}</div></>}</div>
          <div className="editor-card"><strong className="text-sm">스펙 텍스트 추가</strong><input className="form-input" placeholder="예: VS3235 · 41MM · 904L" maxLength={40} value={draft.text} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))}/>
            <div className="mt-2 flex flex-wrap gap-2">{(Object.keys(textStyles) as TextStyle[]).map(s => <button key={s} type="button" className={`editor-chip text-${s} ${draft.style === s ? 'active' : ''}`} onClick={() => setDraft(d => ({ ...d, style: s }))}>{textStyles[s]}</button>)}</div>
            <p className="mt-3 text-[11px] text-muted-foreground">글꼴 (무료 폰트 · 눌러서 선택)</p>
            <div className="mt-1 grid max-h-44 grid-cols-2 gap-2 overflow-y-auto" role="listbox" aria-label="글꼴 선택"><button type="button" role="option" aria-selected={!draft.font} className={`editor-chip ${!draft.font ? 'active' : ''}`} onClick={() => setDraft(d => ({ ...d, font: '' }))}>기본 글꼴</button>{editorFonts.map(f => <button key={f.id} type="button" role="option" aria-selected={draft.font === f.id} className={`editor-chip ${draft.font === f.id ? 'active' : ''}`} style={{ fontFamily: fontStack(f.id) ?? undefined }} onClick={() => setDraft(d => ({ ...d, font: f.id }))}>{f.group === 'ko' ? `${f.label} 가나다` : f.label}</button>)}</div>
            <Button size="sm" variant="gold" className="mt-2" disabled={!draft.text.trim()} onClick={() => { const start = snap(t); setTexts(ts => [...ts, { id: uid(), text: draft.text.trim(), style: draft.style, start, end: Math.min(total, start + 3), x: 50, y: 22, size: 1, font: draft.font }]); setDraft(d => ({ ...d, text: '' })); }}>{`현재 위치(${fmt(snap(t))})에 추가`}</Button></div>
          {texts.map(x => <div key={x.id} className="editor-card text-xs"><div className="flex items-center gap-2"><strong className="truncate">{x.text}</strong><span className="text-muted-foreground">{textStyles[x.style]}</span><Button size="icon" variant="ghost" className="ml-auto size-7" aria-label="텍스트 삭제" onClick={() => setTexts(ts => ts.filter(y => y.id !== x.id))}><Trash2/></Button></div>
            <label className="editor-row">{`시작 ${fmt(x.start)}`}<input type="range" min={0} max={total} step={0.1} value={x.start} onChange={e => setTexts(ts => ts.map(y => y.id === x.id ? { ...y, start: snap(Number(e.target.value)), end: Math.max(y.end, snap(Number(e.target.value)) + 0.5) } : y))}/></label>
            <label className="editor-row">{`끝 ${fmt(x.end)}`}<input type="range" min={0} max={total} step={0.1} value={x.end} onChange={e => setTexts(ts => ts.map(y => y.id === x.id ? { ...y, end: Math.max(y.start + 0.5, Number(e.target.value)) } : y))}/></label>
            <label className="editor-row">세로 위치<input type="range" min={5} max={95} value={x.y} onChange={e => setTexts(ts => ts.map(y => y.id === x.id ? { ...y, y: Number(e.target.value) } : y))}/></label>
            <label className="editor-row">가로 위치<input type="range" min={5} max={95} value={x.x} onChange={e => setTexts(ts => ts.map(y => y.id === x.id ? { ...y, x: Number(e.target.value) } : y))}/></label>
            <label className="editor-row">{`크기 ${x.size.toFixed(1)}배`}<input type="range" min={0.5} max={2.5} step={0.1} value={x.size} onChange={e => setTexts(ts => ts.map(y => y.id === x.id ? { ...y, size: Number(e.target.value) } : y))}/></label>
            <label className="editor-row">글꼴<select className="form-input !mt-0 !py-1 text-xs" value={x.font} onChange={e => setTexts(ts => ts.map(y => y.id === x.id ? { ...y, font: e.target.value } : y))}><option value="">기본 글꼴</option>{editorFonts.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
            <div className="mt-2 flex items-center gap-2"><Button size="sm" variant="goldOutline" onClick={() => { stop(); seek(x.start + 0.05); }}>화면에서 위치 조정</Button><span className="text-[11px] text-muted-foreground">미리보기의 글자를 손가락이나 마우스로 끌어 움직여요.</span></div></div>)}
        </>}
        {layer === 'music' && <>
          <div className="editor-card"><div className="flex flex-wrap items-center gap-2"><Music size={16} className="text-primary"/><strong className="text-sm">배경 음악</strong><Button size="sm" variant="goldOutline" className="ml-auto" disabled={!onMusicChange} onClick={() => setPickerOpen(true)}>온라인 음악 더 찾기</Button></div>
            {music && <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" data-no-translate>♪ {music.music_title} - {music.music_artist}<Button size="icon" variant="ghost" className="ml-auto size-7" aria-label="음악 제거" onClick={() => onMusicChange?.(null)}><Trash2/></Button></div>}
            {onMusicChange ? <div className="mt-3"><QuickMusicList selectedId={music?.music_track_id} onSelect={m => onMusicChange(m)}/></div> : <p className="mt-2 text-xs text-muted-foreground">이 화면에서는 배경 음악을 추가할 수 없어요.</p>}</div>
          {pickerOpen && onMusicChange && <MusicPicker onClose={() => setPickerOpen(false)} onSelect={m => { onMusicChange(m); setPickerOpen(false); }}/>}
          <div className="editor-card"><div className="flex items-center gap-2"><strong className="text-sm">원래 소리</strong><Button size="sm" variant={origOff ? 'gold' : 'goldOutline'} className="ml-auto" aria-pressed={origOff} onClick={() => setOrigOff(o => !o)}>{origOff ? <><VolumeX/>원래 소리 켜기</> : <><Volume2/>원래 소리 켜짐</>}</Button></div>
            <label className="editor-row">원본 소리 크기<input type="range" min={0} max={1} step={0.05} disabled={origOff} value={origVol} onChange={e => setOrigVol(Number(e.target.value))}/></label></div>
        </>}
        {layer === 'filter' && <div className="grid grid-cols-2 gap-2">{(Object.keys(luxuryFilters) as FilterId[]).map(f => <button key={f} type="button" className={`editor-option ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}><span className="editor-swatch" style={{ filter: luxuryFilters[f].css }}/>{luxuryFilters[f].label}</button>)}</div>}
        {layer === 'cover' && <div className="editor-card grid gap-3">
          <strong className="text-sm">썸네일 고르기</strong>
          <p className="text-xs leading-5 text-muted-foreground">아래 막대를 좌우로 밀어 썸네일로 쓸 장면을 고르거나, 사진을 직접 첨부하세요. 고르지 않으면 자동으로 정해져요.</p>
          <input type="range" className="w-full accent-primary" aria-label="썸네일 장면 선택" min={0} max={Math.max(total, 0.1)} step={0.05} value={Math.min(coverAt ?? t, Math.max(total, 0.1))} disabled={!clips.length || !!busy} onChange={e => { const v = Number(e.target.value); stop(); seek(v); setCoverAt(v); setCoverPhoto(null); }}/>
          <p className="text-xs text-muted-foreground" aria-live="polite">{coverPhoto ? `첨부한 사진을 썸네일로 사용: ${coverPhoto.name}` : coverAt === null ? '자동 (영상 첫 장면 근처)' : `선택한 장면: ${fmt(coverAt)}`}</p>
          {coverPreview && <img src={coverPreview} alt="첨부한 썸네일 미리보기" className="h-28 w-auto rounded-md object-cover"/>}
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="goldOutline"><label className="cursor-pointer"><ImageIcon size={14}/>사진 첨부<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (!/^image\//.test(f.type)) { setErr('사진 파일(JPG·PNG·WEBP)을 선택해 주세요.'); return; } if (f.size > 10 * 1024 * 1024) { setErr('사진은 10MB 이하만 올릴 수 있어요.'); return; } setErr(''); setCoverPhoto(f); setCoverAt(null); }}/></label></Button>
            <Button size="sm" variant="ghost" disabled={coverAt === null && !coverPhoto} onClick={() => { setCoverAt(null); setCoverPhoto(null); }}>자동으로 되돌리기</Button>
          </div>
        </div>}
        {layer === 'tags' && <>
          {catalog.length ? <div className="editor-card"><strong className="text-sm">VELA 상품 태그</strong><select aria-label="태그할 상품" className="form-input" value={tagPick} onChange={e => setTagPick(e.target.value)}>{catalog.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            <Button size="sm" variant="gold" className="mt-2" disabled={!tagPick} onClick={() => { const item = catalog.find(c => c.id === tagPick); if (item) setTags(ts => [...ts, { id: uid(), postId: item.id, title: item.title, at: snap(t) }]); }}>{`현재 위치(${fmt(snap(t))})에 태그`}</Button></div>
            : <p className="text-xs text-muted-foreground">태그할 수 있는 내 상품이 아직 없어요. 상품을 먼저 게시하면 영상에 연결할 수 있어요.</p>}
          {tags.map(x => <div key={x.id} className="editor-card flex items-center gap-2 text-xs"><Tag size={14} className="text-primary"/><span className="truncate">{x.title}</span><span className="text-muted-foreground">{fmt(x.at)}</span><Button size="icon" variant="ghost" className="ml-auto size-7" aria-label="태그 삭제" onClick={() => setTags(ts => ts.filter(y => y.id !== x.id))}><Trash2/></Button></div>)}
        </>}
      </section>
    </div>
    {music && <audio ref={musicAudio} src={music.music_audio_url} loop preload="auto" />}
    {limitPopup && <div role="alertdialog" aria-modal="true" aria-label="영상 길이 제한" className="fixed inset-0 z-[140] grid place-items-center bg-background/80 p-6"><div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 text-center"><h3 className="text-base font-semibold">{long ? '영상은 10분 이내로만 올릴 수 있어요' : '영상은 1분 이내로만 올릴 수 있어요'}</h3><p className="mt-2 text-sm text-muted-foreground">{long ? `현재 길이는 ${total.toFixed(1)}초입니다. 10분 이내로 편집해 주세요.` : `현재 길이는 ${total.toFixed(1)}초입니다. 1분 이내로 편집해 주세요.`}</p><div className="mt-4 grid gap-2"><Button variant="gold" onClick={fitToLimit}>{long ? '앞 10분만 사용하기' : '앞 1분만 사용하기'}</Button><Button variant="goldOutline" onClick={() => setLimitPopup(false)}>직접 편집하기</Button></div></div></div>}
  </div>, document.body);
}
