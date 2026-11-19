import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { tx } from '@/lib/dom-translate'

const SEEN_KEY = 'vela-first-notice-seen'
const SNOOZE_KEY = 'vela-first-notice-snooze-until'
const DAY_MS = 24 * 60 * 60 * 1000
export const TELEGRAM_HELP_URL = 'https://t.me/velamarket_official'

const readSnooze = () => { try { return Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now() } catch { return false } }
const writeSnooze = (on: boolean) => { try { if (on) window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + DAY_MS)); else window.localStorage.removeItem(SNOOZE_KEY) } catch { /* 저장소를 못 쓰면 무시 */ } }

/** 브라우저 탭을 연 첫 방문에만 보이는 안내(스플래시가 끝난 뒤). 접속 지연 안내와 텔레그램 도움말 링크를 함께 보여주고,
 *  "하루 동안 보지 않기"를 체크하면 24시간 동안 다시 뜨지 않는다. 직접 닫을 때까지 유지된다. */
export function FirstVisitNotice() {
  const [open, setOpen] = useState(false)
  const [hideDay, setHideDay] = useState(false)

  useEffect(() => {
    if (readSnooze()) return
    let seen = false
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; sessionStorage.setItem(SEEN_KEY, '1') } catch { /* 저장소를 못 쓰면 그냥 한 번 보여준다 */ }
    if (seen) return
    const show = setTimeout(() => setOpen(true), 2100)
    return () => clearTimeout(show)
  }, [])

  if (!open) return null
  return (
    <div role="status" className="fixed inset-x-0 top-4 z-[9998] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto max-w-sm rounded-lg border border-primary/40 bg-card px-4 py-3 text-sm shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2 leading-snug">
            <p>{tx('첫 접속 시 연결이 다소 지연될 수 있습니다. 양해 부탁드립니다.')}</p>
            <p>{tx('홈페이지 접속에 문제가 있으면 텔레그램 공식 채널로 바로 연결하세요.')}</p>
            <a href={TELEGRAM_HELP_URL} target="_blank" rel="noopener noreferrer" className="inline-block break-all font-medium text-primary underline underline-offset-2">{TELEGRAM_HELP_URL}</a>
          </div>
          <button type="button" aria-label={tx('닫기')} className="mt-0.5 shrink-0 text-muted-foreground" onClick={() => setOpen(false)}><X size={16} aria-hidden /></button>
        </div>
        <label className="mt-3 flex min-h-8 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={hideDay} onChange={e => { setHideDay(e.target.checked); writeSnooze(e.target.checked) }} />
          {tx('하루 동안 보지 않기')}
        </label>
      </div>
    </div>
  )
}
