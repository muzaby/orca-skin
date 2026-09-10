import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type { ArtifactCatalogItem } from '../../../../../shared/artifacts'
import { useI18n } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { CatalogTabs } from '../../../shared/ui/CatalogTabs'
import { CatalogSearch } from '../../../shared/ui/CatalogSearch'
import { useCatalogSearch } from '../../../shared/hooks/useCatalogSearch'
import { ResizableSidePane } from '../../../shared/ui/ResizableSidePane'
import { openConfirmDialog } from '../../../shared/ui/confirmDialogStore'
import {
  filterArtifactCatalog,
  refreshArtifactCatalog,
  setCatalogArtifactPinned,
  trashCatalogArtifact,
  useArtifactCatalogStore,
  type ArtifactCatalogTab
} from '../store/artifactCatalogStore'
import { ArtifactCatalogRow } from './ArtifactCatalogRow'

export interface ArtifactsViewProps {
  onOpen: (item: ArtifactCatalogItem, origin: HTMLElement) => void
  onDeleted: (item: ArtifactCatalogItem) => void
  viewer?: ReactNode
  viewerExpanded?: boolean
  viewerWidth?: number
  onViewerWidthChange?: (width: number) => void
  viewerKey?: string
  selectedFileId?: string
}

export function ArtifactsView({
  onOpen,
  onDeleted,
  viewer,
  viewerExpanded = false,
  viewerWidth = 640,
  onViewerWidthChange,
  viewerKey = '',
  selectedFileId
}: ArtifactsViewProps): React.JSX.Element {
  const { tr } = useI18n()
  const { items, loading, error, busy } = useArtifactCatalogStore()
  const [tab, setTab] = useState<ArtifactCatalogTab>('all')
  const [query, setQuery] = useState('')
  const search = useCatalogSearch(() => setQuery(''))
  const id = useId()
  const visible = useMemo(() => filterArtifactCatalog(items, tab, query), [items, tab, query])
  useEffect(() => {
    void refreshArtifactCatalog()
    const refresh = (): void => {
      void refreshArtifactCatalog()
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  const deleteItem = (item: ArtifactCatalogItem): void => {
    openConfirmDialog({
      title: tr('chat.artifacts.trashTitle'),
      message: tr('chat.artifacts.trashMessage'),
      confirmLabel: tr('common.delete'),
      danger: true,
      onConfirm: () => {
        void trashCatalogArtifact(item).then((removed) => {
          if (removed) onDeleted(item)
        })
      }
    })
  }
  return (
    <section
      data-artifact-catalog=""
      data-side-pane-host=""
      className="relative flex min-h-0 min-w-0 flex-1 pb-2 pr-2"
    >
      <div
        inert={viewerExpanded}
        data-artifact-catalog-list=""
        className="@container/catalog min-h-0 min-w-0 flex-1 overflow-y-auto"
      >
        <div className={`mx-auto w-full max-w-[960px] pb-10 pt-10 ${viewer ? 'px-4' : 'px-8'}`}>
          <h1 className="m-0 font-serif text-[30px] font-medium tracking-[-0.02em] text-ink">
            {tr('artifactCatalog.title')}
            <span
              data-artifact-catalog-count=""
              className="ml-2.5 align-middle font-sans text-footnote font-normal tracking-normal text-ink3"
            >
              {tr('common.count', { count: items.length })}
            </span>
          </h1>
          <CatalogSearch
            id={id}
            label={tr('artifactCatalog.search')}
            placeholder={tr('artifactCatalog.searchPlaceholder')}
            value={query}
            onChange={setQuery}
            controls={search}
            toggleBehavior="catalog:search-toggle"
            inputMarker="data-artifact-catalog-search"
          >
            <CatalogTabs
              id={id}
              label={tr('artifactCatalog.tabs')}
              value={tab}
              items={(['all', 'pinned'] as const).map((value) => ({
                value,
                label: tr(`artifactCatalog.${value}`)
              }))}
              onChange={setTab}
              marker="data-catalog-tab"
            />
          </CatalogSearch>
          {error && (
            <div
              role="alert"
              className="mb-3 flex items-center gap-2 rounded-r4 bg-bg2 px-3 py-2 text-footnote text-ink2"
            >
              <span className="flex-1">{tr(`artifactCatalog.${error}Failed`)}</span>
              {error === 'load' && (
                <Button
                  size="small"
                  leadingIcon="refresh"
                  onClick={() => void refreshArtifactCatalog()}
                >
                  {tr('artifactCatalog.retry')}
                </Button>
              )}
            </div>
          )}
          <div
            role="tabpanel"
            id={`${id}-items`}
            aria-labelledby={`${id}-${tab}`}
            aria-busy={loading}
          >
            {loading && items.length === 0 ? (
              <p role="status" className="py-16 text-center text-footnote text-ink3">
                {tr('common.loading')}
              </p>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-ink3">
                <Icon name={query ? 'search' : tab === 'pinned' ? 'pin' : 'doc'} size={28} />
                <p role="status" className="text-footnote">
                  {tr(
                    query
                      ? 'artifactCatalog.noMatches'
                      : tab === 'pinned'
                        ? 'artifactCatalog.emptyPinned'
                        : 'artifactCatalog.empty'
                  )}
                </p>
              </div>
            ) : (
              <ul className="m-0 list-none divide-y divide-border p-0">
                {visible.map((item) => (
                  <ArtifactCatalogRow
                    key={item.artifactFileId}
                    item={item}
                    busy={!!busy[item.artifactFileId]}
                    selected={selectedFileId === item.artifactFileId}
                    onOpen={onOpen}
                    onPin={(entry) => {
                      void setCatalogArtifactPinned(entry, !entry.pinned)
                    }}
                    onDelete={deleteItem}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {viewer && (
        <ResizableSidePane
          expanded={viewerExpanded}
          lifecycleKey={viewerKey}
          width={viewerWidth}
          onWidthChange={onViewerWidthChange}
          label={tr('chat.rightpanel.panelResizeAria')}
          className="pt-2"
        >
          <div data-artifact-catalog-viewer="" className="flex min-h-0 flex-1 flex-col">
            {viewer}
          </div>
        </ResizableSidePane>
      )}
    </section>
  )
}
