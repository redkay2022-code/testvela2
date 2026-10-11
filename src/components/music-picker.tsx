import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Music, Pause, Play, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { searchJamendo, type JamendoTrack } from '@/lib/jamendo.functions';

export type SelectedMusic = { music_track_id: string; music_title: string; music_artist: string; music_audio_url: string; music_license_url: string };
const TAGS = ['pop', 'rock', 'electronic', 'ambient', 'cinematic', 'happy', 'calm'];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function MusicPicker({ onSelect, onClose }: { onSelect: (m: SelectedMusic) => void; onClose: () => void }) {
  const search = useServerFn(searchJamendo);
  const [q, setQ] = useState(''), [tag, setTag] = useState(''), [offset, setOffset] = useState(0);
  const [tracks, setTracks] = useState<JamendoTrack[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const run = async (query: string, t: string, off: number) => {
    setLoading(true); setError('');
    const r = await search({ data: { search: query, tags: t, offset: off } }).catch(() => ({ tracks: [], error: '음악을 불러오지 못했습니다.' }));
    setTracks(off ? (p) => [...p, ...r.tracks] : r.tracks); setError(r.error ?? ''); setOffset(off); setLoading(false);
  };
  useEffect(() => { void run('', '', 0); return () => audio.current?.pause(); }, []);
  const toggle = (t: JamendoTrack) => {
    if (playing === t.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause(); audio.current = new Audio(t.audio); audio.current.onended = () => setPlaying(null);
    void audio.current.play().catch(() => setError('미리듣기를 재생할 수 없습니다.')); setPlaying(t.id);
  };
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-background/80" role="dialog" aria-label="음악 추가">
    <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Music size={18} className="text-primary" />음악 추가</h2><Button type="button" variant="ghost" size="icon" aria-label="닫기" onClick={onClose}><X /></Button></div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void run(q, tag, 0); }}><input className="form-input !mt-0" placeholder="곡명, 아티스트 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="음악 검색" /><Button type="submit" size="icon" aria-label="검색"><Search /></Button></form>
      <div className="mt-3 flex flex-wrap gap-2">{TAGS.map((t) => <Button key={t} type="button" size="sm" variant={tag === t ? 'gold' : 'goldOutline'} aria-pressed={tag === t} onClick={() => { const n = tag === t ? '' : t; setTag(n); void run(q, n, 0); }}>{t}</Button>)}</div>
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
      <ul className="mt-3 flex-1 space-y-2 overflow-y-auto" data-no-translate>{tracks.map((t) => <li key={t.id} className="flex items-center gap-3 rounded-md border border-border p-2">
        {t.image && <img src={t.image} alt="" className="size-10 rounded object-cover" />}
        <div className="min-w-0 flex-1"><p className="truncate text-sm">{t.name}</p><p className="truncate text-xs text-muted-foreground">{t.artist_name} · {fmt(t.duration)}</p></div>
        <Button type="button" size="icon" variant="ghost" aria-label={playing === t.id ? '정지' : '미리듣기'} onClick={() => toggle(t)}>{playing === t.id ? <Pause /> : <Play />}</Button>
        <Button type="button" size="sm" variant="gold" onClick={() => { audio.current?.pause(); onSelect({ music_track_id: t.id, music_title: t.name, music_artist: t.artist_name, music_audio_url: t.audio, music_license_url: t.license_ccurl }); }}>선택</Button>
      </li>)}</ul>
      {!loading && !error && !tracks.length && <p className="py-6 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</p>}
      {tracks.length >= offset + 20 && <Button type="button" variant="ghost" className="mt-2" disabled={loading} onClick={() => void run(q, tag, offset + 20)}>{loading ? '불러오는 중…' : '더 보기'}</Button>}
      {loading && !tracks.length && <p className="py-6 text-center text-sm text-muted-foreground">불러오는 중…</p>}
    </div>
  </div>;
}
