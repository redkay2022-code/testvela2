// Locally synthesized BGM / SFX (no remote audio assets) and audio helpers for the video editor.
export type BgmId = 'noir' | 'gala' | 'velvet';
export type SfxType = 'tick' | 'unbox' | 'chime';
export const bgmPresets: Record<BgmId, { label: string; bpm: number; root: number }> = {
  noir: { label: 'Midnight Noir · 90 BPM', bpm: 90, root: 55 },
  gala: { label: 'Gala Pulse · 112 BPM', bpm: 112, root: 65.41 },
  velvet: { label: 'Velvet Ambient · 72 BPM', bpm: 72, root: 49 },
};
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
  const rate = 44100, ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(rate * Math.max(0.5, duration))), rate);
  const master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
  if (bgm) {
    const { bpm, root } = bgmPresets[bgm], step = 60 / bpm, bus = ctx.createGain(); bus.gain.value = bgmVolume; bus.connect(master);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bgm === 'gala' ? 1800 : 900; lp.connect(bus);
    const chord = bgm === 'velvet' ? [1, 1.5, 2.378] : [1, 1.189, 1.498, 2];
    chord.forEach(m => [-4, 4].forEach(det => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = root * 2 * m; o.detune.value = det; g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.035, 1.5); g.gain.setValueAtTime(0.035, Math.max(1.6, duration - 1)); g.gain.linearRampToValueAtTime(0, duration); o.connect(g).connect(lp); o.start(0); o.stop(duration); }));
    beatTimes(bpm, duration).forEach((t, i) => {
      if (bgm !== 'velvet' || i % 2 === 0) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.connect(g).connect(bus); o.start(t); o.stop(t + 0.3); }
      if (bgm !== 'velvet') { const h = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), ht = t + step / 2; h.buffer = noiseBuffer(ctx, 0.05); f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(0.12, ht); g.gain.exponentialRampToValueAtTime(0.001, ht + 0.05); h.connect(f).connect(g).connect(bus); h.start(ht); }
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
