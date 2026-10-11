// Real BGM: royalty-free tracks by Kevin MacLeod (incompetech.com), CC BY 4.0. Each file is trimmed to start exactly on beat 1.
import t0 from '@/assets/music/local-forecast-elevator.mp3.asset.json';
import t1 from '@/assets/music/smooth-lovin.mp3.asset.json';
import t3 from '@/assets/music/lobby-time.mp3.asset.json';
import t4 from '@/assets/music/bit-shift.mp3.asset.json';
import t5 from '@/assets/music/cipher.mp3.asset.json';
import t6 from '@/assets/music/funkorama.mp3.asset.json';
import t7 from '@/assets/music/inspired.mp3.asset.json';
import t8 from '@/assets/music/carefree.mp3.asset.json';
import t9 from '@/assets/music/easy-lemon.mp3.asset.json';
import t10 from '@/assets/music/airport-lounge.mp3.asset.json';
import t11 from '@/assets/music/backbay-lounge.mp3.asset.json';
import t12 from '@/assets/music/dreamer.mp3.asset.json';
import t13 from '@/assets/music/deliberate-thought.mp3.asset.json';
import t14 from '@/assets/music/cool-vibes.mp3.asset.json';
import t15 from '@/assets/music/groove-grove.mp3.asset.json';
import t16 from '@/assets/music/spy-glass.mp3.asset.json';
import t17 from '@/assets/music/impact-prelude.mp3.asset.json';
import t18 from '@/assets/music/overcast.mp3.asset.json';
import t19 from '@/assets/music/daily-beetle.mp3.asset.json';
import t20 from '@/assets/music/sovereign.mp3.asset.json';
import t21 from '@/assets/music/chill-wave.mp3.asset.json';
import t22 from '@/assets/music/arcadia.mp3.asset.json';
import t23 from '@/assets/music/ice-flow.mp3.asset.json';
import t24 from '@/assets/music/electro-cabello.mp3.asset.json';
import t25 from '@/assets/music/dances-and-dames.mp3.asset.json';
import t26 from '@/assets/music/aitech.mp3.asset.json';
import t27 from '@/assets/music/werq.mp3.asset.json';
import t28 from '@/assets/music/george-street-shuffle.mp3.asset.json';
import t29 from '@/assets/music/jazz-brunch.mp3.asset.json';
/** offset = measured position (s) of beat 1 inside the file; the editor's beat grid starts there. */
type Bgm = { label: string; title: string; bpm: number; url: string; feel: string; offset: number };
const t = (title: string, bpm: number, url: string, feel: string, offset: number): Bgm => ({ label: `${title} · ${Math.round(bpm)} BPM`, title, bpm, url, feel, offset });
export const bgmPresets: Record<string, Bgm> = {
  'local-forecast-elevator': t("Local Forecast - Elevator", 82, t0.url, "Bouncy, Bright, Grooving", 0.7039),
  'smooth-lovin': t("Smooth Lovin", 75, t1.url, "Grooving, Calming, Relaxed", 0.7706),
  'lobby-time': t("Lobby Time", 128, t3.url, "Calming, Grooving, Relaxed", 0.4412),
  'bit-shift': t("Bit Shift", 130, t4.url, "Bouncy, Bright, Grooving", 0.2932),
  'cipher': t("Cipher", 150, t5.url, "Bright, Grooving, Uplifting", 0.3715),
  'funkorama': t("Funkorama", 101, t6.url, "Grooving, Uplifting", 0.5645),
  'inspired': t("Inspired", 120, t7.url, "Bright, Relaxed, Calming, Uplifting", 0.4717),
  'carefree': t("Carefree", 96, t8.url, "Bouncy, Bright, Calming, Uplifting", 0.5936),
  'easy-lemon': t("Easy Lemon", 82, t9.url, "Bright, Calming, Relaxed", 0.7155),
  'airport-lounge': t("Airport Lounge", 129.77, t10.url, "Bouncy, Calming, Relaxed", 0.045),
  'backbay-lounge': t("Backbay Lounge", 120, t11.url, "Bright, Grooving, Relaxed", 0.4731),
  'dreamer': t("Dreamer", 100, t12.url, "Calming, Relaxed", 0.5732),
  'deliberate-thought': t("Deliberate Thought", 69, t13.url, "Calming, Relaxed", 0.8403),
  'cool-vibes': t("Cool Vibes", 83, t14.url, "Calming, Relaxed", 0.698),
  'groove-grove': t("Groove Grove", 70, t15.url, "Calming, Grooving, Mysterious, Relaxed", 0.6124),
  'spy-glass': t("Spy Glass", 110, t16.url, "Grooving, Mysterious", 0.5152),
  'impact-prelude': t("Impact Prelude", 80, t17.url, "Calming, Grooving, Mysterious", 0.3454),
  'overcast': t("Overcast", 120, t18.url, "Bouncy, Bright, Grooving", 0.4717),
  'daily-beetle': t("Daily Beetle", 100, t19.url, "Calming, Bouncy", 0.3875),
  'sovereign': t("Sovereign", 109.33, t20.url, "Dark, Calming", 0.5471),
  'chill-wave': t("Chill Wave", 100, t21.url, "Grooving, Relaxed", 0.2902),
  'arcadia': t("Arcadia", 79.84, t22.url, "Eerie, Epic, Mysterious, Mystical, Unnerving, Uplifting", 0.6908),
  'ice-flow': t("Ice Flow", 70, t23.url, "Grooving, Intense", 0.8272),
  'electro-cabello': t("Electro Cabello", 117, t24.url, "Bouncy, Grooving", 0.4804),
  'dances-and-dames': t("Dances and Dames", 120, t25.url, "Grooving, Mysterious, Suspenseful", 0.4702),
  'aitech': t("Aitech", 105, t26.url, "Grooving, Bright", 0.5399),
  'werq': t("Werq", 125, t27.url, "Bright, Grooving, Relaxed", 0.4484),
  'george-street-shuffle': t("George Street Shuffle", 76.5, t28.url, "Bouncy, Grooving, Relaxed", 0.2249),
  'jazz-brunch': t("Jazz Brunch", 100, t29.url, "Bright, Grooving, Relaxed", 0.5703),
};
export const bgmCredit = 'Music: Kevin MacLeod (incompetech.com) · CC BY 4.0';
export type BgmId = keyof typeof bgmPresets;
export type SfxType = 'tick' | 'unbox' | 'chime';
export const sfxPresets: Record<SfxType, { label: string; length: number }> = {
  tick: { label: '시계 초침 소리', length: 2 },
  unbox: { label: '언박싱 소리', length: 1.2 },
  chime: { label: '럭셔리 차임', length: 2.4 },
};
export const beatTimes = (bpm: number, duration: number) => { const step = 60 / bpm; const out: number[] = []; for (let t = 0; t <= duration + 1e-6; t += step) out.push(+t.toFixed(3)); return out; };
export const snapToBeat = (t: number, bpm: number) => { const step = 60 / bpm; return Math.round(t / step) * step; };

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b;
}
function scheduleSfx(ctx: BaseAudioContext, out: AudioNode, type: SfxType, at: number) {
  if (type === 'tick') {
    for (let i = 0; i < 8; i++) { const t = at + i * 0.25, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = i % 2 ? 3200 : 2600; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03); o.connect(g).connect(out); o.start(t); o.stop(t + 0.04); }
  } else if (type === 'unbox') {
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuffer(ctx, 0.8); f.type = 'bandpass'; f.frequency.setValueAtTime(400, at); f.frequency.exponentialRampToValueAtTime(3000, at + 0.6); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.35, at + 0.3); g.gain.exponentialRampToValueAtTime(0.001, at + 0.75); n.connect(f).connect(g).connect(out); n.start(at);
    const o = ctx.createOscillator(), g2 = ctx.createGain(); o.frequency.setValueAtTime(120, at + 0.8); o.frequency.exponentialRampToValueAtTime(45, at + 1.1); g2.gain.setValueAtTime(0.6, at + 0.8); g2.gain.exponentialRampToValueAtTime(0.001, at + 1.15); o.connect(g2).connect(out); o.start(at + 0.8); o.stop(at + 1.2);
  } else {
    [880, 1318.5, 1760, 2637].forEach((fr, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = fr; g.gain.setValueAtTime(0.18 / (i + 1), at); g.gain.exponentialRampToValueAtTime(0.0005, at + 2.3); o.connect(g).connect(out); o.start(at); o.stop(at + 2.4); });
  }
}
/** Decoded track cache so switching music never re-downloads. */
const decoded = new Map<string, Promise<AudioBuffer>>();
const loadTrack = (url: string) => { let p = decoded.get(url); if (!p) { p = fetch(url).then(r => { if (!r.ok) throw new Error('음원을 불러오지 못했습니다.'); return r.arrayBuffer(); }).then(b => new OfflineAudioContext(2, 1, 44100).decodeAudioData(b)); p.catch(() => decoded.delete(url)); decoded.set(url, p); } return p; };
export const preloadBgm = (id: BgmId) => { void loadTrack(bgmPresets[id]!.url).catch(() => undefined); };
/** Whole-bar loop length so a looped track keeps the beat grid intact. */
export const loopLength = (bpm: number, bufferSeconds: number) => { const bar = (60 / bpm) * 4; return Math.max(bar, Math.floor(bufferSeconds / bar) * bar); };
/** Renders the real BGM track (beat 1 at t=0) + SFX into one buffer exactly `duration` seconds long. */
export async function renderSoundtrack(duration: number, bgm: BgmId | null, bgmVolume: number, sfx: { type: SfxType; at: number }[]) {
  const rate = 44100, len = Math.max(1, Math.round(rate * Math.max(0.5, duration))), ctx = new OfflineAudioContext(2, len, rate);
  const master = ctx.createGain(); master.connect(ctx.destination);
  if (bgm) {
    const p = bgmPresets[bgm]!, buf = await loadTrack(p.url), src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; const loop = loopLength(p.bpm, buf.duration - p.offset - 2.5); if (duration > loop) { src.loop = true; src.loopStart = p.offset; src.loopEnd = p.offset + loop; }
    const fade = Math.min(1, duration / 4); g.gain.setValueAtTime(bgmVolume, 0); g.gain.setValueAtTime(bgmVolume, Math.max(0, duration - fade)); g.gain.linearRampToValueAtTime(0, duration);
    src.connect(g).connect(master); src.start(0, p.offset); src.stop(duration);
  }
  sfx.forEach(s => scheduleSfx(ctx, master, s.type, s.at));
  return ctx.startRendering();
}
/** Mono 16 kHz WAV (base64) of trimmed clip segments, for caption transcription. */
export async function clipsToWavBase64(clips: { file: File; start: number; end: number }[]) {
  const rate = 16000, total = clips.reduce((s, c) => s + (c.end - c.start), 0);
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil(total * rate)), rate);
  let offset = 0;
  for (const c of clips) {
    try { const buf = await new AudioContext().decodeAudioData(await c.file.arrayBuffer()); const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(offset, c.start, c.end - c.start); } catch { /* clip without audio */ }
    offset += c.end - c.start;
  }
  const data = (await ctx.startRendering()).getChannelData(0);
  const bytes = new ArrayBuffer(44 + data.length * 2), v = new DataView(bytes);
  const w = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + data.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i]!)) * 0x7fff, true);
  let bin = ''; const u8 = new Uint8Array(bytes); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
