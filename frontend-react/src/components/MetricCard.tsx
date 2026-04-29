import { memo } from 'react'

interface Props {
  label: string
  value: number
  sub?: string
  color?: string
  glow?: string
  icon?: React.ReactNode
}

export const MetricCard = memo(function MetricCard({ label, value, sub, color = 'var(--text)', glow, icon }: Props) {
  return (
    <div
      className="relative overflow-hidden flex-1 min-w-0 cursor-default"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '18px 20px',
        transition: 'border-color .2s, box-shadow .2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = glow ?? 'var(--border2)'
        if (glow) e.currentTarget.style.boxShadow = `0 0 28px ${glow}28, 0 0 0 1px ${glow}1a`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {glow && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: -20, right: -20,
            width: 80, height: 80,
            borderRadius: '50%',
            background: glow,
            filter: 'blur(30px)',
            opacity: 0.35,
            transition: 'opacity .2s',
          }}
          aria-hidden="true"
        />
      )}
      <div className="flex justify-between items-start" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)' }}>
          {label}
        </span>
        {icon && <span style={{ color, opacity: 0.8 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{sub}</div>}
    </div>
  )
})
