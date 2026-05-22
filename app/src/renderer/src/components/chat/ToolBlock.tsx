import type { ReactNode } from 'react'
import { Card } from '../primitives/Card'
import { Icon } from '../primitives/Icon'
import { ToolStatusIcon, type ToolStatus } from '../primitives/ToolStatusIcon'

export interface ToolBlockProps {
  title: ReactNode
  status?: ToolStatus
  collapsible?: boolean
  opened?: boolean
  children?: ReactNode
}

/** ToolBlock — collapsed header (status icon + title + chevron) with optional
 *  code body. v5 renders the body in a paper-2 monospace block. */
export function ToolBlock({
  title,
  status = 'done',
  collapsible = true,
  opened = true,
  children
}: ToolBlockProps): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--ink-3)',
          fontSize: 12.5
        }}
      >
        <ToolStatusIcon status={status} />
        <span>{title}</span>
        {collapsible && <Icon name="chevronD" size={12} color="var(--ink-4)" />}
      </div>
      {opened && children && (
        <Card
          surface="paper-2"
          radius="md"
          padding={16}
          style={{
            marginTop: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 12.5,
            color: 'var(--ink-2)',
            lineHeight: 1.65,
            overflow: 'auto',
            maxWidth: '100%'
          }}
        >
          {children}
        </Card>
      )}
    </div>
  )
}

/** Bash — command-line code block (paper-2, mono, `bash` label). */
export function Bash({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <Card
      surface="paper-2"
      radius="md"
      padding={[12, 16]}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        color: 'var(--ink-2)',
        lineHeight: 1.7
      }}
    >
      <div style={{ color: 'var(--ink-4)', fontSize: 11.5, marginBottom: 6 }}>bash</div>
      <div style={{ color: 'var(--ink)' }}>{children}</div>
    </Card>
  )
}

/** Completed tag — `✓ 완료` chip used at the end of a tool sequence. */
export function CompletedTag({ children = '완료' }: { children?: ReactNode }): React.JSX.Element {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)', fontSize: 12.5 }}>
      <Icon name="checkCircle" size={14} color="var(--ink-3)" />
      {children}
    </div>
  )
}

/** Per-message footer with copy / thumbs up / thumbs down quick actions. */
export function MsgFooter(): React.JSX.Element {
  return (
    <div style={{ marginLeft: 36, display: 'flex', gap: 4, color: 'var(--ink-4)' }}>
      <button type="button" className="tb-icon-btn" style={{ width: 26, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center' }}>
        <Icon name="copy" size={14} />
      </button>
      <button type="button" className="tb-icon-btn" style={{ width: 26, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center' }}>
        <Icon name="thumbUp" size={14} />
      </button>
      <button type="button" className="tb-icon-btn" style={{ width: 26, height: 26, borderRadius: 6, display: 'grid', placeItems: 'center' }}>
        <Icon name="thumbDown" size={14} />
      </button>
    </div>
  )
}
