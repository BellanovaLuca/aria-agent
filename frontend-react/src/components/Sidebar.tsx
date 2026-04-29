import { useState, useEffect, useRef } from 'react'
import type { Page } from '../types'

interface Props {
  current: Page
  onNavigate: (page: Page) => void
  isDark: boolean
  onThemeToggle: () => void
  userCount: number
  onTweaks: (rect: DOMRect) => void
}

/* ── Icons (filled, matching design) ────────────────────────────────────── */

function IcDashboard() {
  return <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path d="M2 3a1 1 0 011-1h5a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm9 0a1 1 0 011-1h5a1 1 0 011 1v2a1 1 0 01-1 1h-5a1 1 0 01-1-1V3zm0 6a1 1 0 011-1h5a1 1 0 011 1v8a1 1 0 01-1 1h-5a1 1 0 01-1-1V9zM2 13a1 1 0 011-1h5a1 1 0 011 1v4a1 1 0 01-1 1H3a1 1 0 01-1-1v-4z"/></svg>
}
function IcKey() {
  return <svg viewBox="0 0 20 20" fill="currentColor" width="17" height="17"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd"/></svg>
}
function IcEmail() {
  return <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
}
function IcPhone() {
  return <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
}
function IcUsers() {
  return <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
}
function IcChevronDown({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
    </svg>
  )
}
function IcSun() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-4 h-4"><circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>
}
function IcMoon() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-4 h-4"><path d="M13.5 9.5A5.5 5.5 0 0 1 7 3a5.5 5.5 0 1 0 6.5 6.5z"/></svg>
}
function IcPanelClose() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="1.5" y="2" width="13" height="12" rx="1.75"/><path d="M5.5 2V14"/></svg>
}
function IcSliders() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M2 4h12M2 8h12M2 12h12"/><circle cx="5" cy="4" r="1.5" fill="currentColor" stroke="none"/><circle cx="11" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="7" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>
}

/* ── NavItem ─────────────────────────────────────────────────────────────── */

function NavItem({
  page, label, icon, isActive, isCollapsed, badge, onNavigate
}: {
  page: Page; label: string; icon: React.ReactNode; isActive: boolean
  isCollapsed: boolean; badge?: number; onNavigate: (p: Page) => void
}) {
  const baseStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: isCollapsed ? '9px 0' : '9px 10px',
    justifyContent: isCollapsed ? 'center' : undefined,
    borderRadius: 8,
    background: isActive ? 'var(--accent-dim)' : 'transparent',
    color: isActive ? 'var(--accent)' : 'var(--text2)',
    fontSize: 15,
    fontWeight: isActive ? 600 : 400,
    border: isActive ? '1px solid var(--accent-glow)' : '1px solid transparent',
    transition: 'background .12s, color .12s, border-color .12s',
    cursor: 'pointer',
    marginBottom: 2,
    position: 'relative',
  }
  return (
    <button
      style={baseStyle}
      onClick={() => onNavigate(page)}
      aria-current={isActive ? 'page' : undefined}
      title={isCollapsed ? label : undefined}
      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' } }}
    >
      {icon}
      {!isCollapsed && <span className="flex-1 truncate text-left">{label}</span>}
      {!isCollapsed && badge != null && badge > 0 && (
        <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
          {badge}
        </span>
      )}
    </button>
  )
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

const RESET_PAGES: Page[] = ['dashboard', 'email']
const MIN_W = 180, MAX_W = 420, DEFAULT_W = 280

export function Sidebar({ current, onNavigate, isDark, onThemeToggle, userCount, onTweaks }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(() =>
    localStorage.getItem('aria-sidebar-collapsed') === 'true'
  )
  const [resetOpen, setResetOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_W)
  const [dragging, setDragging]     = useState(false)
  const [handleHover, setHandleHover] = useState(false)
  const widthRef = useRef(sidebarWidth)

  useEffect(() => {
    localStorage.setItem('aria-sidebar-collapsed', String(isCollapsed))
  }, [isCollapsed])

  useEffect(() => {
    widthRef.current = sidebarWidth
  }, [sidebarWidth])

  useEffect(() => {
    const w = isCollapsed ? 62 : sidebarWidth
    document.documentElement.style.setProperty('--sidebar-w', `${w}px`)
  }, [isCollapsed, sidebarWidth])

  useEffect(() => {
    if (RESET_PAGES.includes(current)) setResetOpen(true)
  }, [current])

  const handleDragStart = (e: React.MouseEvent) => {
    if (isCollapsed) return
    e.preventDefault()
    const startX = e.clientX
    const startW = widthRef.current
    setDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      const w = Math.min(MAX_W, Math.max(MIN_W, startW + ev.clientX - startX))
      widthRef.current = w
      setSidebarWidth(w)
    }
    const onUp = () => {
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const isResetActive = RESET_PAGES.includes(current)

  return (
    <aside
      style={{
        width: isCollapsed ? 62 : sidebarWidth,
        flexShrink: 0,
        position: 'relative',
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '0 0 16px',
        transition: dragging ? 'none' : 'width .2s ease-in-out',
        overflow: 'hidden',
      }}
      aria-label="Navigazione principale"
    >
      {/* ── Logo header ── */}
      {isCollapsed ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 12px' }}>
          <button
            onClick={() => setIsCollapsed(false)}
            aria-label="Espandi sidebar"
            title="Espandi sidebar"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent), #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 800, color: 'white',
              boxShadow: '0 4px 14px var(--accent-glow)',
              cursor: 'pointer', border: 'none',
            }}
          >
            A
          </button>
        </div>
      ) : (
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent), #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 800, color: 'white',
              boxShadow: '0 4px 14px var(--accent-glow)', flexShrink: 0,
            }}>
              A
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, color: 'var(--text)' }}>Aria</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, letterSpacing: 0.3 }}>Assistente AI</div>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              aria-label="Comprimi sidebar"
              title="Comprimi sidebar"
              style={{ color: 'var(--text3)', padding: 6, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
            >
              <IcPanelClose />
            </button>
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>

        {/* Reset Password group */}
        <div style={{ marginBottom: 4 }}>
          {!isCollapsed && (
            <button
              onClick={() => setResetOpen(o => !o)}
              aria-expanded={resetOpen}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 10px', borderRadius: 8,
                color: 'var(--text2)', fontSize: 14, fontWeight: 600, letterSpacing: 0.3,
                cursor: 'pointer', border: 'none', background: 'transparent', transition: 'color .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text2)' }}
            >
              <span>Reset Password</span>
              <IcChevronDown open={resetOpen} />
            </button>
          )}

          {/* Sub-items */}
          {(isCollapsed || resetOpen) && (
            <div>
              {[
                { page: 'dashboard' as Page, label: 'Dashboard', icon: isCollapsed ? <IcKey /> : <IcDashboard /> },
                { page: 'email' as Page, label: 'Email', icon: <IcEmail /> },
              ].map(({ page, label, icon }) => {
                const active = current === page
                return isCollapsed ? (
                  <button
                    key={page}
                    onClick={() => onNavigate(page)}
                    title={label}
                    style={{
                      width: '100%', display: 'flex', justifyContent: 'center',
                      padding: '9px 0', borderRadius: 8, marginBottom: 2,
                      background: active ? 'var(--accent-dim)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text2)',
                      border: active ? '1px solid var(--accent-glow)' : '1px solid transparent',
                      cursor: 'pointer', transition: 'all .12s',
                    }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' } }}
                  >
                    {icon}
                  </button>
                ) : (
                  <button
                    key={page}
                    onClick={() => onNavigate(page)}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 10px 8px 20px', borderRadius: 8, marginBottom: 2,
                      background: active ? 'var(--accent-dim)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text2)',
                      fontSize: 15, fontWeight: active ? 600 : 400,
                      border: active ? '1px solid var(--accent-glow)' : '1px solid transparent',
                      transition: 'background .12s, color .12s, border-color .12s', cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' } }}
                    onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' } }}
                  >
                    {icon}
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* + Nuovo modulo */}
          {!isCollapsed && (
            <button
              disabled
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 20px', borderRadius: 8,
                color: 'var(--text3)', fontSize: 14, fontWeight: 400,
                cursor: 'pointer', border: '1px solid transparent', background: 'transparent',
                opacity: 0.6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
            >
              + Nuovo modulo
            </button>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '8px 4px 8px' }} />

        {/* Chiamate */}
        <NavItem page="calls" label="Chiamate" icon={<IcPhone />}
          isActive={current === 'calls'} isCollapsed={isCollapsed} onNavigate={onNavigate} />

        {/* Utenti */}
        <NavItem page="admin" label="Utenti" icon={<IcUsers />}
          isActive={current === 'admin'} isCollapsed={isCollapsed} badge={userCount} onNavigate={onNavigate} />
      </nav>

      {/* ── Footer ── */}
      <div style={{ padding: '14px 16px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 9, height: 9, borderRadius: '50%',
            background: 'var(--success)', boxShadow: '0 0 6px var(--success)',
            flexShrink: 0,
          }} className="animate-pulse-dot" />
          {!isCollapsed && (
            <span style={{ fontSize: 14, color: 'var(--text3)' }}>Online</span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              onClick={(e) => onTweaks(e.currentTarget.getBoundingClientRect())}
              aria-label="Tweaks"
              title="Tweaks"
              style={{
                color: 'var(--text3)', padding: 6,
                borderRadius: 7, border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer', transition: 'border-color .12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}
            >
              <IcSliders />
            </button>
            <button
              onClick={onThemeToggle}
              aria-label={isDark ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
              title={isDark ? 'Tema chiaro' : 'Tema scuro'}
              style={{
                color: 'var(--text3)', padding: 6,
                borderRadius: 7, border: '1px solid var(--border)',
                background: 'transparent', cursor: 'pointer', transition: 'border-color .12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text3)' }}
            >
              {isDark ? <IcSun /> : <IcMoon />}
            </button>
          </div>
        </div>
      </div>
      {/* ── Resize handle ── */}
      {!isCollapsed && (
        <div
          onMouseDown={handleDragStart}
          onMouseEnter={() => setHandleHover(true)}
          onMouseLeave={() => setHandleHover(false)}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 10 }}
        >
          <div style={{
            position: 'absolute', right: 1, top: 0, bottom: 0, width: 2, borderRadius: 1,
            background: 'var(--accent)',
            opacity: handleHover || dragging ? 0.55 : 0,
            transition: 'opacity .15s',
          }} />
        </div>
      )}
    </aside>
  )
}
