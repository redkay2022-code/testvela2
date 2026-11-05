import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { tx } from '@/lib/dom-translate'

const SEEN_KEY = 'vela-first-notice-seen'

/** 브라우저 탭을 연 첫 방문에만 잠깐 보이는 안내(스플래시가 끝난 뒤). 5초 뒤 자동으로 닫히고, 한 번 본 뒤에는 다시 뜨지 않는다. */
export function FirstVisitNotice() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let seen = false
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; sessionStorage.setItem(SEEN_KEY, '1') } catch { /* 저장소를 못 쓰면 그냥 한 번 보여준다 */ }
    if (seen) return
    const show = setTimeout(() => setOpen(true), 2100)
    const hide = setTimeout(() => setOpen(false), 2100 + 5500)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [])

  if (!open) return null
  return (
    <div role="status" className="fixed inset-x-0 top-4 z-[9998] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg border border-primary/40 bg-card px-4 py-3 text-sm shadow-lg">
        <p className="flex-1 leading-snug">{tx('첫 접속 시 연결이 다소 지연될 수 있습니다. 양해 부탁드립니다.')}</p>
        <button type="button" aria-label={tx('닫기')} className="mt-0.5 shrink-0 text-muted-foreground" onClick={() => setOpen(false)}><X size={16} aria-hidden /></button>
      </div>
    </div>
  )
}
