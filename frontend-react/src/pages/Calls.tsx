import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { apiGet } from '../hooks/useApi'
import { toYMD } from '../utils'
import { DatePicker } from '../components/DatePicker'
import type { TranscriptMeta, ToastItem } from '../types'

function parseLabel(label: string): { date: string; caller: string } {
  const parts = label.split('—').map(p => p.trim())
  return { date: parts[1] ?? '', caller: parts[2] ?? '' }
}

interface ChatLine { speaker: 'agent' | 'user'; text: string }

function parseChat(raw: string): ChatLine[] {
  const lines: ChatLine[] = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('AGENTE:')) {
      const text = line.slice(7).trim()
      if (text && !text.includes('<ctrl')) lines.push({ speaker: 'agent', text })
    } else if (line.startsWith('UTENTE:')) {
      const text = line.slice(7).trim()
      if (text) lines.push({ speaker: 'user', text })
    }
  }
  return lines
}

function IcRefresh() {
  return <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
}
function IcPhone() {
  return <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
}
function IcWeb() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <circle cx="12" cy="12" r="9"/>
      <path d="M2 12h20"/>
      <path d="M12 3c-2.5 2.8-4 5.8-4 9s1.5 6.2 4 9"/>
      <path d="M12 3c2.5 2.8 4 5.8 4 9s-1.5 6.2-4 9"/>
    </svg>
  )
}
function IcChevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
    </svg>
  )
}

interface Props {
  addToast: (type: ToastItem['type'], msg: string) => void
}

const PAGE_SIZE = 8

export function Calls({ addToast }: Props) {
  const [transcripts, setTranscripts] = useState<TranscriptMeta[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [cache, setCache]       = useState<Record<string, string>>({})
  const [fetching, setFetching] = useState<Set<string>>(new Set())
  const [page, setPage]         = useState(0)
  const [dateFilter, setDateFilter] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const list = await apiGet<TranscriptMeta[]>('/transcripts')
      setTranscripts(list ?? [])
    } catch { setTranscripts([]) }
    finally { if (showSpinner) setLoading(false) }
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([load(false), new Promise(r => setTimeout(r, 600))])
    setRefreshing(false)
  }, [load])

  useEffect(() => { load() }, [load])

  const toggleExpand = async (filename: string) => {
    if (expanded === filename) { setExpanded(null); return }
    setExpanded(filename)
    if (!cache[filename] && !fetching.has(filename)) {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setFetching(p => new Set(p).add(filename))
      try {
        const res = await fetch(`/transcripts/${encodeURIComponent(filename)}`, { signal: ctrl.signal })
        const text = await res.text()
        setCache(p => ({ ...p, [filename]: text }))
      } catch (err) {
        if (!(err instanceof Error) || err.name !== 'AbortError')
          addToast('error', 'Impossibile caricare la trascrizione.')
      } finally {
        setFetching(p => { const s = new Set(p); s.delete(filename); return s })
      }
    }
  }

  const isPhone = (label: string) => label.startsWith('📞') || !label.startsWith('🌐')

  const transcriptIndexMap = useMemo(() => {
    const m = new Map<string, number>()
    transcripts.forEach((t, i) => m.set(t.filename, i))
    return m
  }, [transcripts])

  const filtered = useMemo(() =>
    dateFilter
      ? transcripts.filter(t => toYMD(t.timestamp) === dateFilter)
      : transcripts,
    [transcripts, dateFilter]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="fade-in" style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <div style={{ flexShrink: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Chiamate con Sofia</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Registrazioni e log delle sessioni vocali</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 200 }}>
            <DatePicker value={dateFilter} onChange={(v) => { setDateFilter(v); setPage(0) }} placeholder="Filtra per data…" />
          </div>
          <button onClick={handleRefresh} disabled={refreshing} aria-label="Aggiorna"
            style={{ color: 'var(--text2)', padding: 7, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: refreshing ? 'default' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
            onMouseEnter={(e) => { if (!refreshing) e.currentTarget.style.borderColor = 'var(--border2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <span style={{ display: 'flex' }} className={refreshing ? 'animate-spin' : ''}>
              <IcRefresh />
            </span>
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)' }}>
          Trascrizioni ({filtered.length}{dateFilter ? ` / ${transcripts.length}` : ''})
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', gap: 12 }}>
            <div className="w-5 h-5 border-2 border-gh-blue border-t-transparent rounded-full animate-spin" />
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>Caricamento…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
            {dateFilter ? 'Nessuna chiamata in questa data.' : 'Nessuna trascrizione disponibile. Le chiamate vengono salvate automaticamente.'}
            {dateFilter && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setDateFilter('')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font)' }}>
                  Rimuovi filtro
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {paged.map((t) => {
              const open = expanded === t.filename
              const phone = isPhone(t.label)
              const content = cache[t.filename]
              const isFetching = fetching.has(t.filename)
              const lines = content ? parseChat(content) : []
              const { date, caller } = parseLabel(t.label)
              const callerLabel = caller || (phone ? 'Chiamata anonima' : 'Sessione web')
              const globalIdx = transcriptIndexMap.get(t.filename) ?? 0
              const num = transcripts.length - globalIdx

              return (
                <div key={t.filename} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Row */}
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => toggleExpand(t.filename)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(t.filename) } }}
                    style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', transition: 'background .12s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        background: 'var(--accent-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent)',
                      }}>
                        {phone ? <IcPhone /> : <IcWeb />}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3, color: 'var(--text)' }}>
                          Trascrizione #{num}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 1 }}>{callerLabel}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{date}</div>
                      </div>
                    </div>
                    <div style={{ paddingTop: 3, color: 'var(--accent)' }}>
                      <IcChevron open={open} />
                    </div>
                  </div>

                  {/* Expanded transcript */}
                  {open && (
                    <div style={{ padding: '20px 20px 20px 70px', animation: 'fadeIn .2s ease' }}>
                      {isFetching ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0', color: 'var(--text3)', fontSize: 13 }}>
                          <div className="w-4 h-4 border-2 border-gh-blue border-t-transparent rounded-full animate-spin" />
                          Caricamento trascrizione…
                        </div>
                      ) : (
                        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                          {lines.length === 0 ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                              Nessun dialogo disponibile.
                            </div>
                          ) : lines.map((line, j) => (
                            <div key={j} style={{
                              padding: '12px 16px',
                              borderBottom: j < lines.length - 1 ? '1px solid var(--border)' : 'none',
                              display: 'flex', gap: 12, alignItems: 'flex-start',
                            }}>
                              <div style={{
                                width: 6, height: 6, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                                background: line.speaker === 'agent' ? 'var(--accent)' : 'var(--success)',
                                boxShadow: `0 0 4px ${line.speaker === 'agent' ? 'var(--accent)' : 'var(--success)'}`,
                              }} />
                              <div>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                                  textTransform: 'uppercase',
                                  color: line.speaker === 'agent' ? 'var(--accent)' : 'var(--success)',
                                  marginRight: 8,
                                }}>
                                  {line.speaker === 'agent' ? 'Sofia' : 'Utente'}
                                </span>
                                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{line.text}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Pagination */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} di {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: page === 0 ? 'var(--text3)' : 'var(--text)', fontSize: 12, cursor: page === 0 ? 'not-allowed' : 'pointer' }}>← Prec</button>
                <span style={{ padding: '5px 12px', fontSize: 12, color: 'var(--text2)' }}>{page + 1} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: page >= totalPages - 1 ? 'var(--text3)' : 'var(--text)', fontSize: 12, cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer' }}>Succ →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
