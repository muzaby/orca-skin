import type { ReactNode } from 'react'
import { Card } from '../primitives/Card'
import { Icon, type IconName } from '../primitives/Icon'

export interface ApprovalGateProps {
  /** Body of the prompt — supports inline markup. v5 uses a bold path / link inside. */
  children: ReactNode
  /** Optional leading icon (default: folder). */
  icon?: IconName
  allowLabel?: string
  denyLabel?: string
  /** Keyboard hint glyph for allow / deny (shown as .kbd chip). */
  allowKey?: string
  denyKey?: string
  onAllow?: () => void
  onDeny?: () => void
}

/** ApprovalGate — folder access prompt + schedule creation prompt.
 *  Outer is Card(surface=paper, bordered, elevation=sm, radius=md, padding=14).
 *  Buttons always right-aligned with a .kbd shortcut chip per DESIGN.md §6.1. */
export function ApprovalGate({
  children,
  icon = 'folder',
  allowLabel = '허용',
  denyLabel = '거부',
  allowKey = 'Enter',
  denyKey = 'Esc',
  onAllow,
  onDeny
}: ApprovalGateProps): React.JSX.Element {
  return (
    <Card surface="paper" bordered elevation="sm" radius="md" padding={14}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Icon name={icon} size={16} color="var(--ink-3)" style={{ marginTop: 2, flex: '0 0 auto' }} />
        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{children}</div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="ghost-btn" style={{ display: 'flex', alignItems: 'center', gap: 7 }} onClick={onDeny}>
          {denyLabel} <span className="kbd">{denyKey}</span>
        </button>
        <button type="button" className="primary-btn" style={{ display: 'flex', alignItems: 'center', gap: 7 }} onClick={onAllow}>
          {allowLabel}{' '}
          <span className="kbd" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: 0 }}>
            {allowKey}
          </span>
        </button>
      </div>
    </Card>
  )
}
