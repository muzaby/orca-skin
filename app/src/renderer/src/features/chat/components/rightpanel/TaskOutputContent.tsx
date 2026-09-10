import { useMemo, useState } from 'react'
import { refreshArtifactList } from '../../store/artifactStore'
import { useSessionOutputs } from '../../hooks/useSessionOutputs'
import { ArtifactCards } from '../ArtifactCards'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { SectionPlaceholder, TileSection } from './TaskTileSections'

export function TaskOutputContent(): React.JSX.Element {
  const { tr } = useI18n()
  const { sessionId, entry, list } = useSessionOutputs()
  const [limit, setLimit] = useState(50)
  const [previousSession, setPreviousSession] = useState(sessionId)
  if (previousSession !== sessionId) {
    setPreviousSession(sessionId)
    setLimit(50)
  }
  const visible = useMemo(() => list.slice(0, limit), [list, limit])
  return (
    <TileSection titleKey="chat.taskTile.sections.output" count={list.length || undefined}>
      <div className="flex flex-col gap-2">
        {entry?.listError && (
          <div className="flex justify-end px-4">
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
        )}
        {entry?.listLoading && (
          <p role="status" className="px-4 text-caption text-ink2">
            {tr('chat.artifacts.loading')}
          </p>
        )}
        {entry?.listError && (
          <p role="status" className="px-4 text-caption text-ink2">
            {tr('chat.artifacts.listFailed')}
          </p>
        )}
        {!entry?.listLoading && !entry?.listError && list.length === 0 && (
          <SectionPlaceholder icon="chart" descKey="chat.taskTile.sections.outputDesc" />
        )}
        <div className="px-2">
          <ArtifactCards artifacts={visible} saveArtifacts={list} variant="list" />
        </div>
        {limit < list.length && (
          <Button size="small" onClick={() => setLimit((count) => count + 50)}>
            {tr('common.more')}
          </Button>
        )}
      </div>
    </TileSection>
  )
}
