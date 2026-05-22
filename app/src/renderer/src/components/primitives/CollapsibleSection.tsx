import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'

export interface CollapsibleSectionProps {
  title: ReactNode
  initialOpen?: boolean
  /** Trailing slot in the header (e.g. action button). Rendered between title and chevron. */
  trailing?: ReactNode
  children?: ReactNode
}

/** CollapsibleSection — title row + chevron + body.
 *  Absorbed: RightPanel sections (진행 상황 / 작업 폴더 / 컨텍스트),
 *  Settings groups, Tweaks sections.
 *  Header chevron is decorative-and-clickable; whole header toggles. */
export function CollapsibleSection({
  title,
  initialOpen = true,
  trailing,
  children
}: CollapsibleSectionProps): React.JSX.Element {
  const [open, setOpen] = useState(initialOpen)
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="tb-icon-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          marginBottom: 12,
          padding: 0,
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          color: 'inherit'
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {trailing}
          <span
            style={{
              width: 24,
              height: 24,
              display: 'grid',
              placeItems: 'center',
              transition: 'transform 0.15s',
              transform: open ? 'rotate(0deg)' : 'rotate(-90deg)'
            }}
          >
            <Icon name="chevronD" size={14} color="var(--ink-3)" />
          </span>
        </span>
      </button>
      {open && children}
    </section>
  )
}
