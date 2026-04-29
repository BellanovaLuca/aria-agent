import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { apiGet, apiPost, apiPut, apiDelete } from '../hooks/useApi'
import { StatusBadge } from '../components/StatusBadge'
import { Avatar } from '../components/Avatar'
import { ScrollToTop } from '../components/ScrollToTop'
import { fmtTs } from '../utils'
import type { User, ToastItem } from '../types'

type Status = 'active' | 'locked'

interface Props {
  addToast: (type: ToastItem['type'], msg: string) => void
  onUserCountChange?: (count: number) => void
}

function IcSearch() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="13" height="13"><circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l3 3"/></svg>
}
function IcPlus() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><path d="M8 2v12M2 8h12"/></svg>
}
function IcTrash() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M2 4h12M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l.8 9.5a.5.5 0 0 0 .5.5h7.4a.5.5 0 0 0 .5-.5L13 4"/></svg>
}
function IcRefresh() {
  return <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
}
function IcClose() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><path d="M3 3l10 10M13 3L3 13"/></svg>
}

function CustomSelect({ value, onChange, options, container }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  container?: Element | null
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 6, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        style={{
          width: '100%', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
          background: 'var(--surface2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'border-color .15s', outline: 'none', boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-glow)' }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = '' }}
      >
        <span>{selected?.label}</span>
        <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"
          style={{ color: 'var(--text3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
          <path d="M2 5l6 6 6-6H2z"/>
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            zIndex: 9999,
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,.55)',
            animation: 'callPanelIn .14s cubic-bezier(.16,1,.3,1)',
          }}
        >
          {options.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                width: '100%', padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                background: opt.value === value ? 'var(--accent-dim)' : 'transparent',
                color: opt.value === value ? 'var(--accent)' : 'var(--text)',
                fontSize: 13, fontFamily: 'var(--font)', border: 'none',
                borderBottom: i < options.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'background .1s',
              }}
              onMouseEnter={(e) => { if (opt.value !== value) e.currentTarget.style.background = 'var(--surface3)' }}
              onMouseLeave={(e) => { if (opt.value !== value) e.currentTarget.style.background = 'transparent' }}
            >
              {opt.label}
              {opt.value === value && (
                <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                  <path d="M13.707 3.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L6 9.586l6.293-6.293a1 1 0 011.414 0z"/>
                </svg>
              )}
            </button>
          ))}
        </div>,
        container ?? document.body
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13, outline: 'none',
  fontFamily: 'var(--font)', transition: 'border-color .15s',
  boxSizing: 'border-box',
}

const USER_PAGE_SIZE = 10

export function Admin({ addToast, onUserCountChange }: Props) {
  const [users, setUsers]         = useState<User[]>([])
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving]       = useState<Set<string>>(new Set())
  const [userPage, setUserPage]   = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const [newUser, setNewUser] = useState({ username: '', email: '', full_name: '', status: 'active' as Status })
  const [adding, setAdding]   = useState(false)

  const [showSimulate, setShowSimulate] = useState(false)
  const [simUser, setSimUser]           = useState('')
  const [simulating, setSimulating]     = useState(false)

  const dialogRef = useRef<HTMLDialogElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const loadUsers = useCallback(async (spinner = true) => {
    if (spinner) setLoading(true)
    setLoadError(null)
    try {
      const u = await apiGet<User[]>('/api/users')
      setUsers(u ?? [])
      onUserCountChange?.((u ?? []).length)
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      if (spinner) setLoading(false)
    }
  }, [onUserCountChange])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadUsers(false), new Promise(r => setTimeout(r, 600))])
    setRefreshing(false)
  }, [loadUsers])

  useEffect(() => { loadUsers() }, [loadUsers])

  useEffect(() => {
    if (showModal) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [showModal])

  const toggleStatus = async (u: User) => {
    const next: Status = u.status === 'active' ? 'locked' : 'active'
    setSaving(p => new Set(p).add(u.username))
    try {
      await apiPut(`/api/users/${u.username}`, { status: next })
      addToast('success', `Stato di ${u.username} aggiornato.`)
      loadUsers(false)
    } catch (e: unknown) {
      addToast('error', `Errore: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(p => { const s = new Set(p); s.delete(u.username); return s })
    }
  }

  const handleDelete = async (username: string) => {
    if (!confirm(`Eliminare l'utente "${username}"?\nQuesta azione non è reversibile.`)) return
    try {
      await apiDelete(`/api/users/${username}`)
      addToast('success', `Utente ${username} eliminato.`)
      setUserPage(0)
      loadUsers(false)
    } catch (e: unknown) {
      addToast('error', `Errore: ${e instanceof Error ? e.message : e}`)
    }
  }

  const handleSimulate = async () => {
    if (!simUser.trim()) { addToast('error', 'Inserisci l\'account da resettare.'); return }
    setSimulating(true)
    try {
      await apiPost('/email/inbox', {
        from_address: `${simUser.trim()}@example.com`,
        to_address: 'agent@password-reset.local',
        subject: `Reset password per ${simUser.trim()}`,
        body: `Richiedo il reset della password per l'account: ${simUser.trim()}`,
      })
      addToast('success', `Email di reset inviata per "${simUser.trim()}".`)
      setShowSimulate(false)
      setSimUser('')
    } catch (e: unknown) {
      addToast('error', `Errore: ${e instanceof Error ? e.message : e}`)
    } finally {
      setSimulating(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUser.username || !newUser.email || !newUser.full_name) {
      addToast('error', 'Compila tutti i campi obbligatori.')
      return
    }
    setAdding(true)
    try {
      await apiPost('/api/users', newUser)
      addToast('success', `Utente '${newUser.username}' creato con successo.`)
      setNewUser({ username: '', email: '', full_name: '', status: 'active' })
      setShowModal(false)
      loadUsers(false)
    } catch (e: unknown) {
      addToast('error', `Errore: ${e instanceof Error ? e.message : e}`)
    } finally {
      setAdding(false)
    }
  }

  const filteredUsers = nameFilter.trim()
    ? users.filter(u =>
        u.full_name.toLowerCase().includes(nameFilter.toLowerCase()) ||
        u.username.toLowerCase().includes(nameFilter.toLowerCase())
      )
    : users
  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USER_PAGE_SIZE))
  const pagedUsers = filteredUsers.slice(userPage * USER_PAGE_SIZE, (userPage + 1) * USER_PAGE_SIZE)

  return (
    <div ref={scrollRef} className="fade-in" style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Utenti</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>Gestisci gli account del sistema</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleRefresh} disabled={refreshing} aria-label="Aggiorna"
            style={{ color: 'var(--text2)', padding: 7, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: refreshing ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}
            onMouseEnter={(e) => { if (!refreshing) e.currentTarget.style.borderColor = 'var(--border2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <span style={{ display: 'flex' }} className={refreshing ? 'animate-spin' : ''}>
              <IcRefresh />
            </span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 8,
              background: 'var(--accent)', border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 4px 14px var(--accent-glow)',
              transition: 'opacity .15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <IcPlus /> Nuovo utente
          </button>
        </div>
      </div>

      {/* Users list */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', flexShrink: 0 }}>
            Utenti ({nameFilter ? `${filteredUsers.length} / ${users.length}` : users.length})
          </span>
          <div style={{ position: 'relative', maxWidth: 240, flex: 1 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', display: 'flex', pointerEvents: 'none' }}>
              <IcSearch />
            </span>
            <input
              value={nameFilter}
              onChange={(e) => { setNameFilter(e.target.value); setUserPage(0) }}
              placeholder="Cerca per nome o username…"
              style={{
                width: '100%', padding: '6px 10px 6px 30px',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 7, color: 'var(--text)', fontSize: 13, outline: 'none',
                fontFamily: 'var(--font)', boxSizing: 'border-box', transition: 'border-color .15s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', gap: 12 }}>
            <div className="w-5 h-5 border-2 border-gh-blue border-t-transparent rounded-full animate-spin" />
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>Caricamento…</span>
          </div>
        ) : loadError ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 8 }}>Impossibile caricare gli utenti</div>
            <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 16 }}>{loadError}</div>
            <button onClick={() => loadUsers()}
              style={{ padding: '6px 14px', borderRadius: 7, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ↺ Riprova
            </button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
            {users.length === 0 ? (
              <>Nessun utente trovato.{' '}
                <button onClick={() => setShowModal(true)}
                  style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                  Crea il primo utente
                </button>
              </>
            ) : (
              <>Nessun risultato per &ldquo;{nameFilter}&rdquo;.{' '}
                <button onClick={() => setNameFilter('')}
                  style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                  Rimuovi filtro
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {pagedUsers.map((u) => (
              <div key={u.username}
                style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14, transition: 'background .12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <Avatar name={u.full_name} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: 4 }}>
                    <StatusBadge type={u.status === 'active' ? 'active' : 'locked'} />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 3 }}>{u.full_name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)', fontWeight: 500 }}>{u.username}</span>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{u.email}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 3, display: 'flex', gap: 16 }}>
                    <span>Creato: {fmtTs(u.created_at, true)}</span>
                    {u.last_reset && <span>Ultimo reset: {fmtTs(u.last_reset)}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {saving.has(u.username) ? (
                    <div style={{ width: 88, display: 'flex', justifyContent: 'center' }}>
                      <div className="w-4 h-4 border-2 border-gh-blue border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleStatus(u)}
                      style={{
                        width: 88, padding: '7px 0', borderRadius: 7,
                        fontSize: 12, fontWeight: 600, textAlign: 'center',
                        cursor: 'pointer', transition: 'background .15s, color .15s',
                        background: 'var(--accent-dim)',
                        border: '1px solid var(--accent-glow)',
                        color: 'var(--accent)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)' }}
                      title={u.status === 'active' ? 'Clicca per bloccare' : 'Clicca per attivare'}
                    >
                      {u.status === 'active' ? 'Blocca' : 'Attiva'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(u.username)}
                    aria-label={`Elimina ${u.username}`}
                    style={{
                      padding: 7, borderRadius: 7,
                      background: 'var(--danger-dim)', border: '1px solid #f8717140',
                      color: 'var(--danger)', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', transition: 'background .15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8717130' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--danger-dim)' }}
                  >
                    <IcTrash />
                  </button>
                </div>
              </div>
            ))}

            {totalUserPages > 1 && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {userPage * USER_PAGE_SIZE + 1}–{Math.min((userPage + 1) * USER_PAGE_SIZE, users.length)} di {users.length}
                </span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button onClick={() => setUserPage(p => Math.max(0, p - 1))} disabled={userPage === 0}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: userPage === 0 ? 'var(--text3)' : 'var(--text)', fontSize: 12, cursor: userPage === 0 ? 'not-allowed' : 'pointer' }}>
                    ← Prec
                  </button>
                  <span style={{ padding: '5px 12px', fontSize: 12, color: 'var(--text2)' }}>{userPage + 1} / {totalUserPages}</span>
                  <button onClick={() => setUserPage(p => Math.min(totalUserPages - 1, p + 1))} disabled={userPage >= totalUserPages - 1}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: userPage >= totalUserPages - 1 ? 'var(--text3)' : 'var(--text)', fontSize: 12, cursor: userPage >= totalUserPages - 1 ? 'not-allowed' : 'pointer' }}>
                    Succ →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Simulate email modal */}
      {showSimulate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSimulate(false) }}
        >
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border2)',
            borderRadius: 16, padding: 28, width: 360, maxWidth: '92vw',
            boxShadow: '0 24px 80px rgba(0,0,0,.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Simula email di reset</h3>
              <button
                onClick={() => setShowSimulate(false)}
                style={{ color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
                aria-label="Chiudi"
              >
                <IcClose />
              </button>
            </div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontWeight: 500 }}>
              Account da resettare
            </label>
            <input
              value={simUser}
              onChange={(e) => setSimUser(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSimulate() }}
              placeholder="es. mario.rossi"
              autoFocus
              style={{ ...inputStyle, marginBottom: 20 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            <button
              onClick={handleSimulate}
              disabled={simulating}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8,
                background: 'var(--accent)', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: simulating ? 'not-allowed' : 'pointer',
                opacity: simulating ? 0.65 : 1,
                boxShadow: '0 4px 14px var(--accent-glow)',
                transition: 'opacity .15s',
              }}
              onMouseEnter={(e) => { if (!simulating) e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={(e) => { if (!simulating) e.currentTarget.style.opacity = simulating ? '0.65' : '1' }}
            >
              {simulating ? 'Invio in corso…' : 'Invia email di reset'}
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      <dialog
        ref={dialogRef}
        onClick={(e) => { if (e.target === dialogRef.current) setShowModal(false) }}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border2)',
          borderRadius: 16, padding: 0, width: 460, maxWidth: '92vw',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          color: 'var(--text)',
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Nuovo utente</span>
          <button
            type="button"
            onClick={() => setShowModal(false)}
            style={{ padding: 6, borderRadius: 6, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)' }}
            aria-label="Chiudi"
          >
            <IcClose />
          </button>
        </div>
        <form onSubmit={handleAddUser} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {([
            { id: 'dlg-username', label: 'Username', key: 'username', type: 'text', placeholder: 'mario.rossi' },
            { id: 'dlg-email',    label: 'Email',    key: 'email',    type: 'email', placeholder: 'mario.rossi@azienda.it' },
            { id: 'dlg-name',     label: 'Nome completo', key: 'full_name', type: 'text', placeholder: 'Mario Rossi' },
          ] as const).map(({ id, label, key, type, placeholder }) => (
            <div key={id}>
              <label htmlFor={id} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</label>
              <input
                id={id} type={type} placeholder={placeholder}
                autoComplete="off" spellCheck={false}
                value={newUser[key]}
                onChange={(e) => setNewUser(p => ({ ...p, [key]: e.target.value }))}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Stato</label>
            <CustomSelect
              value={newUser.status}
              onChange={(v) => setNewUser(p => ({ ...p, status: v as Status }))}
              options={[
                { value: 'active', label: 'Attivo' },
                { value: 'locked', label: 'Bloccato' },
              ]}
              container={dialogRef.current}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={() => setShowModal(false)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'border-color .15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              Annulla
            </button>
            <button type="submit" disabled={adding}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', opacity: adding ? 0.6 : 1, boxShadow: '0 4px 14px var(--accent-glow)', transition: 'opacity .15s' }}
              onMouseEnter={(e) => { if (!adding) e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={(e) => { if (!adding) e.currentTarget.style.opacity = '1' }}
            >
              {adding ? 'Creazione…' : 'Crea utente'}
            </button>
          </div>
        </form>
      </dialog>
      <ScrollToTop containerRef={scrollRef} />
    </div>
  )
}
