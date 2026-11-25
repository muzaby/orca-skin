import type { ReactNode } from 'react'
import type { PanelKind } from '../../../../../../../shared/history-panels/rows'
import { useI18n } from '../../../../../shared/i18n'
import { useTileHistoryPages } from '../../../store/chatStore'
import type { RightPanelTileId } from '../../../lib/rightPanelTiles'

export function HistoryPanelBoundary({
  id,
  backend,
  children
}: {
  id: RightPanelTileId
  backend: string
  children?: ReactNode
}): React.JSX.Element {
  const { tr } = useI18n()
  const kinds: PanelKind[] =
    id === 'source'
      ? ['sources']
      : id === 'process'
        ? ['processes']
        : id === 'subagent'
          ? ['agents']
          : id === 'task'
            ? backend === 'opencode'
              ? ['agents', 'processes', 'sources']
              : ['tasks', 'sources']
            : ['tasks']
  const { pages, store } = useTileHistoryPages(kinds)
  if (!store) return <>{children}</>
  const failed = kinds.filter((kind) => pages[kind].state === 'failed')
  if (failed.length)
    return (
      <div role="alert" className="p-3 text-footnote">
        {tr('chat.historyPanel.failed')}{' '}
        <button type="button" onClick={() => failed.forEach((kind) => void store.read(kind))}>
          {tr('chat.historyPanel.retry')}
        </button>
      </div>
    )
  if (kinds.some((kind) => !pages[kind].rows.length && pages[kind].state !== 'ready'))
    return (
      <div role="status" className="p-3 text-footnote">
        {tr('chat.historyPanel.loading')}
      </div>
    )
  const more = kinds.filter((kind) => pages[kind].next)
  const loadMore = (): void => {
    for (const kind of more) void store.read(kind, true)
  }
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onScrollCapture={(event) => {
        const el = event.target as HTMLElement
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) loadMore()
      }}
    >
      {children}
      {more.length > 0 && (
        <button type="button" onClick={loadMore}>
          {tr('chat.historyPanel.more')}
        </button>
      )}
    </div>
  )
}
