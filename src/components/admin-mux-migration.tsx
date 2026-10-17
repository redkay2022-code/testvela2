import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Film } from 'lucide-react';
import { Button } from './ui/button';
import { migrateVideosToMux, muxMigrationStatus } from '@/lib/mux-migrate.functions';

/** Admin card: moves videos uploaded before the Mux integration to Mux, 10 at a time, until none are left. */
export function AdminMuxMigration() {
  const qc = useQueryClient();
  const readStatus = useServerFn(muxMigrationStatus);
  const migrate = useServerFn(migrateVideosToMux);
  const status = useQuery({ queryKey: ['mux-migration-status'], queryFn: () => readStatus(), refetchInterval: 15_000 });
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState('');

  const run = async () => {
    if (running) return;
    setRunning(true); setLog('');
    let total = 0;
    const errors: string[] = [];
    try {
      for (let round = 0; round < 50; round++) {
        const r = await migrate({ data: { limit: 10 } });
        total += r.sent; errors.push(...r.errors);
        setLog(`Mux로 보낸 영상 ${total}개 · 남은 영상 ${r.left}개`);
        if (r.left === 0 || r.sent === 0) break;
      }
      setLog(prev => `${prev}${errors.length ? ` · 실패 ${errors.length}개 (${errors.slice(0, 3).join(', ')})` : ''} · 변환이 끝나면 영상이 자동으로 교체돼요.`);
    } catch (e) {
      setLog(e instanceof Error ? e.message : '이전하지 못했어요.');
    } finally {
      setRunning(false);
      void qc.invalidateQueries({ queryKey: ['mux-migration-status'] });
    }
  };

  const s = status.data;
  return <section className="management-row" lang="ko" data-no-translate aria-label="기존 영상 Mux 이전">
    <Film className="text-primary"/>
    <div>
      <strong>기존 영상 Mux 이전</strong>
      <small>{status.isLoading ? '확인 중…' : status.isError ? '상태를 불러오지 못했어요.' : s ? `이전할 영상 ${s.left}개 · 변환 중 ${s.processing}개${s.failed ? ` · 변환 실패 ${s.failed}개` : ''}` : ''}</small>
      <small>변환이 끝날 때까지 기존 영상이 그대로 재생되고, 원본 파일은 삭제하지 않아요.</small>
      {s && !s.configured && <small>Mux 시크릿이 설정되지 않았어요.</small>}
      {log && <small>{log}</small>}
    </div>
    <Button variant="goldOutline" disabled={running || !s?.configured || !s?.left} onClick={() => void run()}>{running ? '이전 중…' : '이전 시작'}</Button>
  </section>;
}
