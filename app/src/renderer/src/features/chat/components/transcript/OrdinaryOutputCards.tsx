import { useMemo } from 'react'
import { ArtifactCards } from '../ArtifactCards'
import { useSessionOutputs } from '../../hooks/useSessionOutputs'
import { refreshArtifactList } from '../../store/artifactStore'
import { Button } from '../../../../shared/ui/Button'
import { useI18n } from '../../../../shared/i18n'
import { useChatSession } from '../../store/chatStore'
import { partsArtifacts } from '../../lib/parts'

// The persisted latest-output list has session ownership, not message ownership.
// Keep these cards at the transcript end rather than guessing a turn from timestamps.
export function OrdinaryOutputCards(): React.JSX.Element | null {
  const { sessionId, list, entry } = useSessionOutputs()
  const messages = useChatSession((session) => session.messages)
  const { tr } = useI18n()
  const files = useMemo(() => {
    const attached = new Set(
      messages.flatMap((message) =>
        partsArtifacts(message.parts).map((artifact) => artifact.publicationId)
      )
    )
    return list.filter((file) => file.category === 'file' && !attached.has(file.publicationId))
  }, [list, messages])
  if (!files.length && !entry?.listError) return null
  return (
    <div data-transcript-outputs="" className="flex min-w-0 flex-col gap-2 pb-5">
      <ArtifactCards artifacts={files} />
      {entry?.listError && (
        <div className="flex items-center gap-2 text-caption text-ink2" role="status">
          {tr('chat.artifacts.listFailed')}
          <Button
            size="small"
            disabled={entry.listLoading}
            onClick={() => {
              if (sessionId) void refreshArtifactList(sessionId)
            }}
          >
            {tr('chat.artifacts.refresh')}
          </Button>
        </div>
      )}
    </div>
  )
}
