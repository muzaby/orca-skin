import type { ReactNode } from 'react'
import { Icon } from '../primitives/Icon'

export interface ModalShellProps {
  children: ReactNode
  width?: number
  onClose?: () => void
}

/** ModalShell — fixed scrim + centered paper card. Click on scrim closes;
 *  click inside content does not bubble. mFade / mPop animations defined in
 *  app.css (used by future modal mount transitions). */
export function ModalShell({ children, width = 520, onClose }: ModalShellProps): React.JSX.Element {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(28, 24, 16, 0.32)',
        display: 'grid',
        placeItems: 'center',
        animation: 'mFade 0.18s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: '92vw',
          background: 'var(--paper)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          animation: 'mPop 0.2s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** Back button used in sub-modals (ModalNewProject* variants). */
export function ModalBack({ onBack }: { onBack?: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onBack}
      style={{
        marginBottom: 10,
        padding: 4,
        color: 'var(--ink-3)',
        background: 'transparent',
        border: 0,
        cursor: 'pointer'
      }}
    >
      <Icon name="arrowL" size={18} />
    </button>
  )
}

/** "메모리 꺼짐" chip shown in the bottom-left of new-project modals. */
export function MemoryChip(): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-3)' }}>
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '1.4px solid var(--ink-4)',
          display: 'inline-grid',
          placeItems: 'center'
        }}
      >
        <span style={{ width: 6, height: 1.4, background: 'var(--ink-4)' }} />
      </span>
      메모리 꺼짐
    </span>
  )
}
