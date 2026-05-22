import type { CSSProperties, ReactNode } from 'react'
import { Sparkle } from '../primitives/Icon'

export type MessageRole = 'user' | 'assistant'

export interface MessageBubbleProps {
  role: MessageRole
  /** Sparkle avatar busy spin (assistant only). */
  busy?: boolean
  /** Show / hide the leading avatar (assistant only). Default true. */
  avatar?: boolean
  children?: ReactNode
}

/** MessageBubble — UserMsg (right-aligned, paper bubble) or
 *  ClaudeMsg (left-aligned, sparkle avatar, no bubble background). */
export function MessageBubble({
  role,
  busy,
  avatar = true,
  children
}: MessageBubbleProps): React.JSX.Element {
  if (role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            maxWidth: '76%',
            padding: '10px 16px',
            background: 'rgba(0,0,0,.045)',
            borderRadius: 14,
            fontSize: 14,
            color: 'var(--ink)',
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap'
          }}
        >
          {children}
        </div>
      </div>
    )
  }
  const avatarStyle: CSSProperties = {
    marginTop: 4,
    flex: '0 0 auto',
    opacity: busy ? 0.8 : 1,
    animation: busy ? 'spin 1.4s linear infinite' : 'none'
  }
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {avatar ? <Sparkle size={22} style={avatarStyle} /> : <div style={{ width: 22, flex: '0 0 auto' }} />}
      <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>{children}</div>
    </div>
  )
}
