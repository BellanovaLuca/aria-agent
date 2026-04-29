import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { MetricCard } from '../components/MetricCard'
import { StatusBadge } from '../components/StatusBadge'
import { ScrollToTop } from '../components/ScrollToTop'
import { apiGet, apiDelete } from '../hooks/useApi'
import { fmtTs } from '../utils'
import type { ResetHistoryEntry, ToastItem } from '../types'

/* ── Custom SVG Charts ───────────────────────────────────────────────────── */

function DonutChart({ phone, email, total }: { phone: number; email: number; total: number }) {
  const r = 72, cx = 96, cy = 96, stroke = 20
  const circ = 2 * Math.PI * r
  const phoneRatio = total > 0 ? phone / total : 0
  const emailRatio = total > 0 ? email / total : 0
  const gap = 4
  const phoneDash = Math.max(0, circ * phoneRatio - gap)
  const emailDash = Math.max(0, circ * emailRatio - gap)
  const phoneOffset = -circ * 0.25
  const emailOffset = -(circ * 0.25) - phoneDash - gap

  const svgRef = useRef<SVGSVGElement>(null)
  const dragState = useRef<{ startAngle: number; baseRotation: number } | null>(null)
  const rotRef = useRef(0)
  const [rotation, setRotation] = useState(0)
  const [dragging, setDragging] = useState(false)

  const getAngle = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (192 / rect.width) - cx
    const y = (e.clientY - rect.top) * (192 / rect.height) - cy
    return Math.atan2(y, x) * 180 / Math.PI
  }

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    e.preventDefault()
    dragState.current = { startAngle: getAngle(e), baseRotation: rotRef.current }
    setDragging(true)

    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return
      const rot = dragState.current.baseRotation + (getAngle(ev) - dragState.current.startAngle)
      rotRef.current = rot
      setRotation(rot)
    }
    const onUp = () => {
      dragState.current = null
      rotRef.current = 0
      setRotation(0)
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div role="img" aria-label={`Distribuzione canali: ${phone} telefono, ${email} email, ${total} totali`}
      style={{ display: 'flex', alignItems: 'center', gap: 40, width: '100%', justifyContent: 'center' }}>
      <svg ref={svgRef} width="192" height="192" viewBox="0 0 192 192"
        style={{ flexShrink: 0, cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        onMouseDown={onMouseDown}
        aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
        <g style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transformBox: 'view-box' as const,
          transition: dragging ? 'none' : 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}>
          {phoneDash > 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
              strokeDasharray={`${phoneDash} ${circ}`} strokeDashoffset={phoneOffset} strokeLinecap="round" />
          )}
          {emailDash > 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
              strokeDasharray={`${emailDash} ${circ}`} strokeDashoffset={emailOffset} strokeLinecap="round" strokeOpacity={0.4} />
          )}
        </g>
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text)" fontSize="26" fontWeight="700" fontFamily="DM Sans">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text2)" fontSize="12" fontFamily="DM Sans">totale</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          { label: 'Telefono', val: phone, color: 'var(--accent)', opacity: 1 },
          { label: 'Email',    val: email, color: 'var(--accent)', opacity: 0.4 },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, opacity: item.opacity, boxShadow: `0 0 8px ${item.color}`, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{item.label}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginLeft: 4 }}>{item.val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChartSVG({
  data,
  onFilterClick,
  activeChannel,
}: {
  data: Array<{ label: string; ok: number; fail: number }>
  onFilterClick?: (channel: 'voice' | 'email') => void
  activeChannel?: 'voice' | 'email' | null
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const max = Math.max(...data.map(d => Math.max(d.ok, d.fail)), 1)
  const h = 120, barW = 38, gap = 16, groupGap = 60
  const totalW = data.length * (2 * barW + gap + groupGap)

  const channelOf = (label: string): 'voice' | 'email' => label === 'Telefono' ? 'voice' : 'email'

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const hoveredData = hovered ? data.find(d => d.label === hovered) ?? null : null

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}
      role="img" aria-label="Esito per canale: successi e fallimenti telefono ed email">
      <svg width="100%" height={h + 56} viewBox={`0 0 ${totalW + 40} ${h + 56}`}
        preserveAspectRatio="xMidYMid meet" aria-hidden="true"
        onMouseMove={handleMouseMove}>
        {data.map((d, i) => {
          const x = 20 + i * (2 * barW + gap + groupGap)
          const okH = max > 0 ? d.ok / max * h : 0
          const failH = max > 0 ? d.fail / max * h : 0
          const isHov = hovered === d.label
          const channel = channelOf(d.label)
          const isActive = activeChannel === channel
          return (
            <g key={d.label}
              onMouseEnter={() => setHovered(d.label)}
              onMouseLeave={() => { setHovered(null); setMousePos(null) }}
              onClick={() => onFilterClick?.(channel)}
              style={{ cursor: onFilterClick ? 'pointer' : 'default' }}
            >
              <rect x={x - 6} y={0} width={2 * barW + gap + 12} height={h + 4} fill="transparent" />
              <rect x={x} y={h - okH} width={barW} height={Math.max(okH, 0)} rx={4}
                fill="#6ee7b7" opacity={isHov || isActive ? 1 : 0.75} style={{ transition: 'opacity .15s' }} />
              <rect x={x + barW + gap} y={h - failH} width={barW} height={Math.max(failH, 0)} rx={4}
                fill="#fca5a5" opacity={isHov || isActive ? 1 : 0.75} style={{ transition: 'opacity .15s' }} />
              <text x={x + barW + gap / 2} y={h + 32} textAnchor="middle"
                fill={isActive ? 'var(--accent)' : 'var(--text2)'}
                fontSize="12" fontWeight={isActive ? '700' : '400'} fontFamily="DM Sans">
                {d.label}
              </text>
            </g>
          )
        })}
        <line x1={20} y1={h} x2={totalW + 20} y2={h} stroke="var(--border)" strokeWidth="1" />
      </svg>

      {/* Floating tooltip */}
      {hoveredData && mousePos && (() => {
        const tot = hoveredData.ok + hoveredData.fail
        const okPct  = tot > 0 ? Math.round(hoveredData.ok   / tot * 100) : 0
        const failPct = tot > 0 ? Math.round(hoveredData.fail / tot * 100) : 0
        const flipX = mousePos.x > 160
        return (
          <div style={{
            position: 'absolute',
            left: flipX ? mousePos.x - 154 : mousePos.x + 12,
            top: Math.max(0, mousePos.y - 20),
            background: 'var(--surface2)',
            border: '1px solid var(--border2)',
            borderRadius: 8,
            padding: '10px 12px',
            pointerEvents: 'none',
            zIndex: 10,
            width: 142,
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {hoveredData.label}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: '#6ee7b7' }}>Successi</span>
              <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>
                {hoveredData.ok} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{okPct}%</span>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#fca5a5' }}>Falliti</span>
              <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>
                {hoveredData.fail} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>{failPct}%</span>
              </span>
            </div>
            {onFilterClick && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text3)' }}>
                Clic per filtrare
              </div>
            )}
          </div>
        )
      })()}

      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        {[{ c: '#6ee7b7', l: 'Successo' }, { c: '#fca5a5', l: 'Fallito' }].map(x => (
          <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} />
            {x.l}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Btn helpers ─────────────────────────────────────────────────────────── */

const btnDanger: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', borderRadius: 8,
  border: '1px solid var(--border2)', color: 'var(--danger)',
  fontSize: 13, fontWeight: 500, background: 'var(--danger-dim)',
  transition: 'background .15s, border-color .15s', cursor: 'pointer',
}
const btnSecondary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)', color: 'var(--text2)',
  fontSize: 13, fontWeight: 500, background: 'var(--surface2)',
  transition: 'border-color .15s', cursor: 'pointer',
}

/* ── Trash icon ─────────────────────────────────────────────────────────── */
function IcTrash() {
  return <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
}
function IcRefresh() {
  return <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
}

/* ── Component ───────────────────────────────────────────────────────────── */

interface Props {
  addToast: (type: ToastItem['type'], msg: string) => void
}

const PAGE_SIZE = 10

export function Dashboard({ addToast }: Props) {
  const [history, setHistory] = useState<ResetHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [histPage, setHistPage] = useState(0)
  const [activeFilter, setActiveFilter] = useState<'voice' | 'email' | 'success' | 'fail' | null>(null)
  const timer = useRef<ReturnType<typeof setInterval>>()
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const h = await apiGet<ResetHistoryEntry[]>('/api/reset-history')
      setHistory(h ?? [])
    } catch { /* silent */ }
    finally { if (showSpinner) setLoading(false) }
  }, [])

  useEffect(() => {
    load(true)
    timer.current = setInterval(() => load(false), 30_000)
    return () => clearInterval(timer.current)
  }, [load])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([load(false), new Promise(r => setTimeout(r, 600))])
    setRefreshing(false)
  }, [load])

  const handleClear = async () => {
    if (!confirm('Azzerare tutta la cronologia dei reset?')) return
    try {
      await apiDelete('/api/reset-history')
      setHistory([])
      setHistPage(0)
      addToast('success', 'Cronologia azzerata.')
    } catch (e: unknown) {
      addToast('error', `Errore: ${e instanceof Error ? e.message : e}`)
    }
  }

  const { total, voice, email, success, fail, barData, reversedHistory } = useMemo(() => {
    let voice = 0, email = 0, success = 0
    let voiceOk = 0, voiceFail = 0, emailOk = 0, emailFail = 0
    for (const e of history) {
      if (e.channel === 'voice') { voice++; e.success ? voiceOk++ : voiceFail++ }
      else                       { email++; e.success ? emailOk++ : emailFail++ }
      if (e.success) success++
    }
    return {
      total: history.length,
      voice, email, success,
      fail: history.length - success,
      barData: [
        { label: 'Telefono', ok: voiceOk, fail: voiceFail },
        { label: 'Email',    ok: emailOk, fail: emailFail },
      ],
      reversedHistory: [...history].reverse(),
    }
  }, [history])

  useEffect(() => { setHistPage(0) }, [activeFilter])

  const drillFiltered = useMemo(() => {
    if (!activeFilter) return reversedHistory
    return reversedHistory.filter(e => {
      if (activeFilter === 'voice')   return e.channel === 'voice'
      if (activeFilter === 'email')   return e.channel === 'email'
      if (activeFilter === 'success') return e.success
      if (activeFilter === 'fail')    return !e.success
      return true
    })
  }, [reversedHistory, activeFilter])

  const totalPages = Math.max(1, Math.ceil(drillFiltered.length / PAGE_SIZE))
  const pagedHistory = useMemo(
    () => drillFiltered.slice(histPage * PAGE_SIZE, (histPage + 1) * PAGE_SIZE),
    [drillFiltered, histPage]
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, gap: 12 }}>
      <div className="w-5 h-5 border-2 border-gh-blue border-t-transparent rounded-full animate-spin" />
      <span style={{ color: 'var(--text3)', fontSize: 14 }}>Caricamento…</span>
    </div>
  )

  return (
    <div ref={scrollRef} className="fade-in" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflowY: 'auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Monitoraggio Reset Password</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Monitoraggio in tempo reale</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...btnSecondary, cursor: refreshing ? 'default' : 'pointer' }} onClick={handleRefresh} disabled={refreshing} aria-label="Aggiorna"
            onMouseEnter={(e) => { if (!refreshing) e.currentTarget.style.borderColor = 'var(--border2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <span style={{ display: 'flex' }} className={refreshing ? 'animate-spin' : ''}>
              <IcRefresh />
            </span>
          </button>
          <button style={btnDanger} onClick={handleClear}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8717130' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--danger-dim)' }}
          >
            <IcTrash /> Azzera cronologia
          </button>
        </div>
      </div>

      {/* ── Metrics ── */}
      <div style={{ display: 'flex', gap: 12 }}>
        <MetricCard label="Totale Richieste" value={total}
          sub={`${total} operazioni totali`}
          color="var(--text)" glow="var(--accent)"
          onClick={() => setActiveFilter(null)}
          icon={<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 3a1 1 0 011-1h5a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm9 0a1 1 0 011-1h5a1 1 0 011 1v2a1 1 0 01-1 1h-5a1 1 0 01-1-1V3zm0 6a1 1 0 011-1h5a1 1 0 011 1v8a1 1 0 01-1 1h-5a1 1 0 01-1-1V9zM2 13a1 1 0 011-1h5a1 1 0 011 1v4a1 1 0 01-1 1H3a1 1 0 01-1-1v-4z"/></svg>}
        />
        <MetricCard label="Via Telefono" value={voice}
          sub={total > 0 ? `${Math.round(voice / total * 100)}% del totale` : '—'}
          color="var(--accent)" glow="var(--accent)"
          onClick={() => setActiveFilter(f => f === 'voice' ? null : 'voice')}
          active={activeFilter === 'voice'}
          icon={<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>}
        />
        <MetricCard label="Via Email" value={email}
          sub={total > 0 ? `${Math.round(email / total * 100)}% del totale` : '—'}
          color="var(--accent)" glow="var(--accent)"
          onClick={() => setActiveFilter(f => f === 'email' ? null : 'email')}
          active={activeFilter === 'email'}
          icon={<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>}
        />
        <MetricCard label="Successi" value={success}
          sub={total > 0 ? `${Math.round(success / total * 100)}% success rate` : '—'}
          color="var(--success)" glow="var(--success)"
          onClick={() => setActiveFilter(f => f === 'success' ? null : 'success')}
          active={activeFilter === 'success'}
          icon={<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
        />
        <MetricCard label="Falliti" value={fail}
          sub={total > 0 ? `${Math.round(fail / total * 100)}% error rate` : '—'}
          color="var(--danger)" glow="var(--danger)"
          onClick={() => setActiveFilter(f => f === 'fail' ? null : 'fail')}
          active={activeFilter === 'fail'}
          icon={<span style={{ fontSize: 13, fontWeight: 700 }}>✕</span>}
        />
      </div>

      {/* ── Charts ── */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 20 }}>
              Distribuzione per canale
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <DonutChart phone={voice} email={email} total={total} />
            </div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 16 }}>
              Esito per canale
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <BarChartSVG
                data={barData}
                onFilterClick={(ch) => setActiveFilter(f => f === ch ? null : ch)}
                activeChannel={activeFilter === 'voice' ? 'voice' : activeFilter === 'email' ? 'email' : null}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── History table ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)' }}>
              Cronologia Reset
            </span>
            {activeFilter && (
              <button onClick={() => setActiveFilter(null)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '2px 8px 2px 10px', borderRadius: 20,
                background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                lineHeight: 1.6,
              }}>
                {{ voice: 'Telefono', email: 'Email', success: 'Successi', fail: 'Falliti' }[activeFilter]}
                <span style={{ fontSize: 13, lineHeight: 1 }}>×</span>
              </button>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {activeFilter ? `${drillFiltered.length} / ${total}` : total} voci
          </span>
        </div>

        {history.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
            Nessun reset effettuato ancora.
          </div>
        ) : (
          <>
            {/* table rows — scroll internally above a max height */}
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Timestamp', 'Canale', 'Username', 'Esito', 'Messaggio'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedHistory.map((e, i) => (
                    <tr key={e.id ?? i} style={{ borderBottom: '1px solid var(--border)', transition: 'background .12s' }}
                      onMouseEnter={(el) => { el.currentTarget.style.background = 'var(--surface2)' }}
                      onMouseLeave={(el) => { el.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {fmtTs(e.requested_at)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span title={e.channel === 'voice' ? 'Telefono' : 'Email'} style={{ display: 'inline-flex', color: 'var(--text2)' }}>
                          {e.channel === 'voice'
                            ? <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                            : <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                          }
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>{e.username}</td>
                      <td style={{ padding: '12px 16px' }}><StatusBadge type={e.success ? 'success' : 'error'} /></td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text2)' }}>{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* pagination — always visible below the table */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {histPage * PAGE_SIZE + 1}–{Math.min((histPage + 1) * PAGE_SIZE, drillFiltered.length)} di {drillFiltered.length}
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {[
                  { label: '← Prec', disabled: histPage === 0, onClick: () => setHistPage(p => p - 1) },
                  { label: 'Succ →', disabled: histPage >= totalPages - 1, onClick: () => setHistPage(p => p + 1) },
                ].map(b => (
                  <button key={b.label} onClick={b.onClick} disabled={b.disabled} style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'var(--surface2)', color: b.disabled ? 'var(--text3)' : 'var(--text)',
                    fontSize: 12, cursor: b.disabled ? 'not-allowed' : 'pointer',
                  }}>{b.label}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <ScrollToTop containerRef={scrollRef} />
    </div>
  )
}
