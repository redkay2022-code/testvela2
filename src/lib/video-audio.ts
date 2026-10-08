// Locally synthesized BGM / SFX (no remote audio assets) and audio helpers for the video editor.
type Bgm = { label: string; bpm: number; root: number; wave: OscillatorType; cutoff: number; chord: number[]; kick: 'four' | 'half' | 'none' | 'trap'; hat: boolean; arp: boolean };
const M = [1, 1.189, 1.498, 2], MAJ = [1, 1.26, 1.498, 2], SUS = [1, 1.335, 1.498, 2], OPEN = [1, 1.5, 2.378], JAZZ = [1, 1.26, 1.498, 1.888];
const b = (label: string, bpm: number, root: number, wave: OscillatorType, cutoff: number, chord: number[], kick: Bgm['kick'], hat: boolean, arp: boolean): Bgm => ({ label: `${label} · ${bpm} BPM`, bpm, root, wave, cutoff, chord, kick, hat, arp });
export const bgmPresets: Record<string, Bgm> = {
  noir: b('Midnight Noir', 90, 55, 'sawtooth', 900, M, 'four', true, false),
  gala: b('Gala Pulse', 112, 65.41, 'sawtooth', 1800, M, 'four', true, false),
  velvet: b('Velvet Ambient', 72, 49, 'sawtooth', 900, OPEN, 'half', false, false),
  geneva: b('Geneva Morning', 96, 65.41, 'triangle', 2400, MAJ, 'half', false, true),
  monaco: b('Monaco Nights', 124, 55, 'sawtooth', 2200, M, 'four', true, true),
  swiss: b('Swiss Precision', 120, 61.74, 'square', 1500, SUS, 'four', true, true),
  marble: b('Marble Hall', 66, 43.65, 'sine', 1200, OPEN, 'none', false, false),
  cognac: b('Cognac Lounge', 84, 58.27, 'triangle', 1600, JAZZ, 'half', true, false),
  diamond: b('Diamond Rain', 100, 73.42, 'sine', 3000, MAJ, 'none', false, true),
  tourbillon: b('Tourbillon', 128, 51.91, 'sawtooth', 2600, M, 'four', true, true),
  silk: b('Silk Road', 78, 46.25, 'triangle', 1100, SUS, 'half', false, true),
  onyx: b('Onyx Trap', 140, 41.2, 'square', 900, M, 'trap', true, false),
  riviera: b('Riviera Sun', 110, 69.3, 'triangle', 2800, MAJ, 'four', true, true),
  cathedral: b('Golden Cathedral', 60, 41.2, 'sawtooth', 700, OPEN, 'none', false, false),
  carbon: b('Carbon Drive', 132, 49, 'square', 1900, SUS, 'four', true, false),
  pearl: b('Pearl Lullaby', 70, 82.41, 'sine', 2000, MAJ, 'none', false, true),
  tokyo: b('Tokyo Drift', 118, 55, 'sawtooth', 2400, M, 'four', true, true),
  saphir: b('Sapphire Glass', 92, 61.74, 'sine', 2600, SUS, 'half', false, true),
  boardroom: b('Boardroom', 104, 58.27, 'triangle', 1700, MAJ, 'four', false, false),
  smoke: b('Smoke & Mirrors', 80, 46.25, 'sawtooth', 800, JAZZ, 'half', true, false),
  aurora: b('Aurora', 76, 65.41, 'sine', 1800, OPEN, 'none', false, true),
  chrono: b('Chronograph', 126, 61.74, 'square', 2100, M, 'four', true, true),
  velour: b('Velour R&B', 88, 51.91, 'triangle', 1300, JAZZ, 'trap', true, false),
  atelier: b('Atelier Piano', 74, 65.41, 'triangle', 2200, MAJ, 'none', false, true),
  shanghai: b('Shanghai Skyline', 108, 55, 'sawtooth', 2000, SUS, 'four', true, true),
  regal: b('Regal Strings', 64, 49, 'sawtooth', 1000, MAJ, 'half', false, false),
  neon: b('Neon Boulevard', 122, 69.3, 'square', 2600, M, 'four', true, true),
  obsidian: b('Obsidian Bass', 136, 36.71, 'sawtooth', 600, M, 'trap', true, false),
  champagne: b('Champagne Toast', 116, 73.42, 'triangle', 3000, MAJ, 'four', true, true),
  horizon: b('Silent Horizon', 68, 43.65, 'sine', 900, SUS, 'none', false, false),
};
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
/** Renders BGM + SFX into one buffer for preview and export. */
export async function renderSoundtrack(duration: number, bgm: BgmId | null, bgmVolume: number, sfx: { type: SfxType; at: number }[]) {
  const rate = 22050, ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(rate * Math.max(0.5, duration))), rate);
  const master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
  if (bgm) {
    const p = bgmPresets[bgm]!, { bpm, root } = p, step = 60 / bpm, bus = ctx.createGain(); bus.gain.value = bgmVolume; bus.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.cutoff; lp.connect(bus);
    const lvl = p.wave === 'sine' ? 0.07 : p.wave === 'triangle' ? 0.055 : 0.035;
    p.chord.forEach(m => [-4, 4].forEach(det => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = p.wave; o.frequency.value = root * 2 * m; o.detune.value = det; g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(lvl, 1.5); g.gain.setValueAtTime(lvl, Math.max(1.6, duration - 1)); g.gain.linearRampToValueAtTime(0, duration); o.connect(g).connect(lp); o.start(0); o.stop(duration); }));
    beatTimes(bpm, duration).forEach((t, i) => {
      const kick = p.kick === 'four' || (p.kick === 'half' && i % 2 === 0) || (p.kick === 'trap' && (i % 4 === 0 || i % 8 === 3));
      if (kick) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.3); }
      if (p.hat) { const hits = p.kick === 'trap' ? [0.25, 0.5, 0.75] : [0.5]; hits.forEach(fr => { const h = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), ht = t + step * fr; h.buffer = noiseBuffer(ctx, 0.05); f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.1, ht); g.gain.exponentialRampToValueAtTime(0.001, ht + 0.05); h.connect(f).connect(g).connect(bus); h.start(ht); }); }
      if (p.arp) { const n = p.chord[i % p.chord.length]!, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = root * 8 * n; g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.9); o.connect(g).connect(bus); o.start(t); o.stop(t + step); }
    });
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
