import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useChatSession } from '../features/chat'
import { MailArchiveEvidenceViewer } from '../features/mail-archive/MailArchiveEvidenceViewer'
import { MarkdownInternalLinkContext } from '../shared/ui/markdown/internalLinkContext'
import { mailArchiveApi } from '../shared/api/ipc'
import type { ArchiveEvidenceResult } from '../../../shared/mail-archive-plugin'

export function MailArchiveEvidenceBridge({
  children
}: {
  children: ReactNode
}): React.JSX.Element {
  const sessionId = useChatSession((state) => state.sessionId)
  const [view, setView] = useState<{
    sessionId: string | null
    loading: boolean
    error: boolean
    result: ArchiveEvidenceResult | null
  } | null>(null)
  const epoch = useRef(0)
  const [seenSessionId, setSeenSessionId] = useState(sessionId)
  if (seenSessionId !== sessionId) {
    setSeenSessionId(sessionId)
    setView(null)
  }
  const origin = useRef<HTMLAnchorElement | null>(null)
  useEffect(() => {
    epoch.current++
    const invalidate = (): void => {
      epoch.current++
    }
    return invalidate
  }, [sessionId])
  const close = useCallback(() => {
    const request = ++epoch.current
    const link = origin.current
    setView(null)
    window.requestAnimationFrame(() => {
      if (epoch.current === request && link?.isConnected) link.focus({ preventScroll: true })
    })
  }, [])
  const open = useCallback(
    (href: string, element: HTMLAnchorElement): boolean => {
      if (!href.startsWith('#mail-evidence/')) return false
      const request = ++epoch.current
      origin.current = element
      setView({ sessionId, loading: !!sessionId, error: !sessionId, result: null })
      if (sessionId)
        void mailArchiveApi
          .resolveEvidence(sessionId, href.slice('#mail-evidence/'.length))
          .then((result) => {
            if (epoch.current === request)
              setView({ sessionId, loading: false, error: false, result })
          })
          .catch(() => {
            if (epoch.current === request)
              setView({ sessionId, loading: false, error: true, result: null })
          })
      return true
    },
    [sessionId]
  )
  return (
    <MarkdownInternalLinkContext.Provider value={open}>
      {children}
      {view && view.sessionId === sessionId && (
        <MailArchiveEvidenceViewer {...view} onClose={close} />
      )}
    </MarkdownInternalLinkContext.Provider>
  )
}
