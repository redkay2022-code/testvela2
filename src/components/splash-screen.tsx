import { useEffect, useState } from 'react'
import logo from '@/assets/vela-splash-logo.png'

/** Brand splash shown on first app open per session; rendered on SSR so it covers the first paint. */
export function SplashScreen() {
  const [phase, setPhase] = useState<'show' | 'fade' | 'gone'>('show')

  useEffect(() => {
    if (sessionStorage.getItem('vela-splash-seen')) { setPhase('gone'); return }
    sessionStorage.setItem('vela-splash-seen', '1')
    const t1 = setTimeout(() => setPhase('fade'), 1400)
    const t2 = setTimeout(() => setPhase('gone'), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (phase === 'gone') return null
  return (
    <div
      aria-hidden
      translate="no"
      className="notranslate fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#02060e] transition-opacity duration-500"
      style={{ opacity: phase === 'fade' ? 0 : 1 }}
    >
      <img src={logo} alt="VELA" className="w-40 h-auto select-none" draggable={false} />
      <div className="mt-6 h-px w-16 bg-gradient-to-r from-transparent via-primary to-transparent" />
      <p
        className="mt-4 text-[13px] uppercase text-primary"
        style={{
          fontFamily: '"Didot", "Bodoni 72", "Bodoni MT", "Playfair Display", "Times New Roman", "Noto Serif", serif',
          letterSpacing: '0.32em',
          fontWeight: 400,
        }}
      >
        Trusted Maker Marketplace
      </p>
    </div>
  )
}
