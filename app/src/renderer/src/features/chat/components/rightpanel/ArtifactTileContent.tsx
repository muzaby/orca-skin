import { useEffect, useMemo, useState } from 'react'
import { useChatSession } from '../../store/chatStore'
import { acquireArtifacts, refreshArtifactList, useArtifactStore } from '../../store/artifactStore'
import { ArtifactCards } from '../ArtifactCard'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import type { ArtifactRef } from '../../../../../../shared/artifacts'

const EMPTY: ArtifactRef[] = []
export function ArtifactTileContent(): React.JSX.Element {
  const { tr } = useI18n()
  const sessionId = useChatSession((session) => session.sessionId)
  const entry = useArtifactStore((state) => (sessionId ? state.sessions[sessionId] : undefined))
  const [limit, setLimit] = useState(50)
  const [previousSession, setPreviousSession] = useState(sessionId)
  if (previousSession !== sessionId) {
    setPreviousSession(sessionId)
    setLimit(50)
  }
  const list = entry?.list ?? EMPTY
  const visible = useMemo(() => list.slice(0, limit), [list, limit])
  useEffect(() => {
    if (!sessionId) return
    const release = acquireArtifacts(sessionId, [], true)
    void refreshArtifactList(sessionId)
    return release
  }, [sessionId])
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
      <div className="flex justify-end">
        <Button
          size="small"
          disabled={!sessionId || entry?.listLoading}
          onClick={() => {
            if (sessionId) void refreshArtifactList(sessionId)
          }}
        >
          {tr('chat.artifacts.refresh')}
        </Button>
      </div>
      {entry?.listLoading && (
        <p role="status" className="text-caption text-ink2">
          {tr('chat.artifacts.loading')}
        </p>
      )}
      {entry?.listError && (
        <p role="status" className="text-caption text-ink2">
          {tr('chat.artifacts.listFailed')}
        </p>
      )}
      {!entry?.listLoading && !entry?.listError && list.length === 0 && (
        <p className="text-caption text-ink2">{tr('chat.artifacts.empty')}</p>
      )}
      <ArtifactCards artifacts={visible} saveArtifacts={list} />
      {limit < list.length && (
        <Button size="small" onClick={() => setLimit((count) => count + 50)}>
          {tr('common.more')}
        </Button>
      )}
    </div>
  )
}
