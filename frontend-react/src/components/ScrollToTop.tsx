import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function ScrollToTop({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => setVisible(el.scrollTop > 220)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [containerRef])

  return createPortal(
    <button
      onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Torna in cima"
      title="Torna in cima"
      style={{
        position: 'fixed',
        bottom: 28,
        left: 'calc(var(--sidebar-w, 280px) + 16px)',
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'var(--accent)',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: hovered ? '0 4px 16px var(--accent-glow)' : 'none',
        zIndex: 9999,
        opacity: visible ? (hovered ? 1 : 0.35) : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.85)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.2s ease, transform 0.22s ease, left 0.2s ease-in-out, box-shadow 0.2s ease',
      }}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"/>
      </svg>
    </button>,
    document.body
  )
}
