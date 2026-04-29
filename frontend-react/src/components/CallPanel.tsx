import { useState, useEffect, useRef } from 'react'
import { Room, RoomEvent, Track } from 'livekit-client'

type CallState = 'idle' | 'ready' | 'connecting' | 'active' | 'error'
type AgentStatus = 'waiting' | 'online'

const BARS = [0.32, 0.52, 0.72, 0.90, 1.0, 0.95, 0.75, 0.55, 0.35]

function MicIcon({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10a7 7 0 0 0 14 0"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="9"  y1="22" x2="15" y2="22"/>
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8" fill="none"/>
      <rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="white"/>
    </svg>
  )
}

function Waveform({ active }: { active: boolean }) {
  const baseH = 44
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 4, height: baseH + 16,
    }}>
      {BARS.map((scale, i) => (
        <div key={i} style={{
          width: 5,
          height: baseH * scale,
          borderRadius: 3,
          background: 'var(--accent)',
          transformOrigin: 'center',
          transform: active ? undefined : 'scaleY(0.2)',
          boxShadow: active ? '0 0 8px var(--accent-glow)' : 'none',
          animation: active
            ? `waveBar ${0.55 + (i % 4) * 0.13}s ease-in-out ${i * 0.065}s infinite`
            : 'none',
          transition: 'transform .35s ease, box-shadow .3s ease',
        }} />
      ))}
    </div>
  )
}

export function CallPanel() {
  const [state, setState]           = useState<CallState>('idle')
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('waiting')
  const [errorMsg, setErrorMsg]     = useState('')
  const roomRef  = useRef<Room | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  /* ── LiveKit helpers ── */
  const cleanup = () => {
    audioRef.current?.pause()
    audioRef.current = null
    roomRef.current  = null
    setAgentStatus('waiting')
    setState('idle')
  }

  const startCall = async () => {
    setState('connecting')
    setErrorMsg('')
    setAgentStatus('waiting')

    let tokenData: { token: string; url: string }
    try {
      const resp = await fetch('/token')
      if (!resp.ok) throw new Error(await resp.text())
      tokenData = await resp.json()
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Errore di rete')
      setState('error')
      return
    }

    const room = new Room()
    roomRef.current = room

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach() as HTMLAudioElement
        el.autoplay = true
        document.body.appendChild(el)
        audioRef.current = el
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach()
      audioRef.current?.remove()
      audioRef.current = null
    })

    room.on(RoomEvent.Disconnected, () => cleanup())

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (participant.isAgent) setAgentStatus('online')
    })

    try {
      await room.connect(tokenData.url, tokenData.token)
      await room.localParticipant.setMicrophoneEnabled(true)
      setState('active')
      const alreadyOnline = [...room.remoteParticipants.values()].some(p => p.isAgent)
      if (alreadyOnline) setAgentStatus('online')
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Connessione fallita')
      setState('error')
      roomRef.current = null
    }
  }

  const endCall = async () => {
    await roomRef.current?.disconnect()
    cleanup()
  }

  useEffect(() => () => { roomRef.current?.disconnect() }, [])

  /* ── Derived ── */
  const panelOpen = state !== 'idle'
  const isActive  = state === 'active'

  const statusText =
    state === 'connecting' ? 'Connessione in corso…' :
    state === 'error'      ? 'Connessione fallita'   :
    isActive && agentStatus === 'online' ? 'In ascolto…' :
    isActive ? 'In attesa di Sofia…' :
    'Assistente AI vocale'

  const statusColor =
    state === 'error' ? '#ef4444' :
    isActive && agentStatus === 'online' ? '#22c55e' :
    isActive ? '#fbbf24' :
    '#9ca3af'

  const quoteText =
    isActive && agentStatus === 'online'
      ? '"Ciao, sono Sofia. Come posso aiutarti?"'
      : isActive
        ? 'In attesa che Sofia entri in linea…'
        : state === 'error'
          ? errorMsg || 'Si è verificato un errore.'
          : 'Avvia la chiamata per parlare con Sofia'

  return (
    <>
      {/* ── Panel ── */}
      {panelOpen && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 50,
          width: 316,
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,.38), 0 4px 16px rgba(0,0,0,.18)',
          overflow: 'hidden',
          animation: 'callPanelIn .22s cubic-bezier(.16,1,.3,1)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>

          {/* Avatar + status */}
          <div style={{ padding: '26px 24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
              boxShadow: isActive && agentStatus === 'online'
                ? '0 0 0 5px rgba(164,144,255,.18), 0 0 24px rgba(164,144,255,.35)'
                : 'none',
              transition: 'box-shadow .5s ease',
            }}>
              <MicIcon size={22} />
            </div>

            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 5 }}>
              Sofia
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: statusColor, fontWeight: 500 }}>
              {isActive && (
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: statusColor,
                  boxShadow: `0 0 6px ${statusColor}`,
                  animation: agentStatus === 'online' ? 'fabPulse 2s ease-in-out infinite' : 'none',
                }} />
              )}
              {statusText}
            </div>
          </div>

          {/* Waveform */}
          <div style={{ padding: '0 24px 4px' }}>
            <Waveform active={isActive && agentStatus === 'online'} />
          </div>

          {/* Quote / info */}
          <div style={{
            padding: '6px 28px 20px',
            fontSize: 13.5, color: state === 'error' ? '#ef4444' : '#6b7280',
            textAlign: 'center', lineHeight: 1.55,
            fontStyle: isActive && agentStatus === 'online' ? 'italic' : 'normal',
            minHeight: 56,
          }}>
            {quoteText}
          </div>

          {/* Action button */}
          <div style={{ padding: '0 20px 22px' }}>
            {(state === 'ready' || state === 'error') ? (
              <button
                onClick={startCall}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12,
                  background: 'var(--accent)', border: 'none',
                  color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 4px 16px var(--accent-glow)', letterSpacing: 0.2,
                  transition: 'opacity .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
              >
                {state === 'error' ? 'Riprova' : 'Avvia chiamata'}
              </button>
            ) : state === 'connecting' ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 0', color: '#9ca3af', fontSize: 13 }}>
                <div className="w-4 h-4 border-2 border-gh-blue border-t-transparent rounded-full animate-spin" />
                Connessione in corso…
              </div>
            ) : (
              <button
                onClick={endCall}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12,
                  background: 'transparent', border: '1.5px solid #fca5a5',
                  color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  transition: 'background .15s, color .15s, border-color .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#ef4444' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#fca5a5' }}
              >
                Termina chiamata
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <button
        onClick={
          state === 'idle'       ? () => setState('ready') :
          state === 'active'     ? endCall :
          state === 'connecting' ? () => { roomRef.current?.disconnect(); cleanup() } :
          ()                      => setState('idle')
        }
        aria-label={isActive ? 'Termina chiamata' : 'Avvia chiamata con Sofia'}
        title={isActive ? 'Termina chiamata' : 'Chiama Sofia'}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 51,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: isActive ? '#ef4444' : 'linear-gradient(135deg, var(--accent), #c084fc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          animation: isActive ? 'fabPulse 1.8s ease-in-out infinite' : 'none',
          boxShadow: isActive ? '0 0 0 3px rgba(239,68,68,.25), 0 4px 16px rgba(239,68,68,.5)' : '0 4px 20px var(--accent-glow)',
          transition: 'background .3s, box-shadow .3s, transform .15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        {isActive ? <StopIcon /> : <MicIcon size={20} />}
      </button>
    </>
  )
}
