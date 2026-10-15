import { useTaskContext } from '../../../hooks/useTaskContext'
import { useI18n } from '../../../../../shared/i18n'
import { Icon } from '../../../../../shared/ui/Icon'
import { basenameForDisplay } from '../../../../../../../shared/path-basename'
import { useChatStore } from '../../../store/chatStore'
import { PanelRow } from './chrome'
import { hasPanelSources } from './model'

export function OpenCodeSources({
  full = false,
  onShowAll
}: {
  full?: boolean
  onShowAll?: (origin: HTMLElement) => void
}): React.JSX.Element | null {
  const { tr } = useI18n()
  const context = useTaskContext()
  const { directories, sources, sessionId, activeKey, picker, openingPath, openContextPath } =
    context
  const items = [
    ...directories.map((directory) => ({ kind: 'directory' as const, ...directory })),
    ...sources
  ]
  if (!full && !hasPanelSources(directories, sources)) return null
  return (
    <section
      data-component="opencode-sources"
      className={full ? '' : 'mt-3 border-t border-oc-border pt-3'}
    >
      <div className="mb-2 flex items-center justify-between text-caption text-oc-muted">
        <span>{tr('chat.opencode.panel.sources')}</span>
        <button
          type="button"
          disabled={picker.disabled}
          onClick={() => void picker.pick()}
          aria-label={tr('chat.taskTile.addDirectory')}
          title={tr('chat.taskTile.addDirectory')}
          className="rounded p-1 outline-none ring-focus disabled:opacity-40"
        >
          <Icon name="plus" size={16} />
        </button>
      </div>
      {picker.errorKey && (
        <p role="alert" className="text-caption text-oc-bad">
          {tr(picker.errorKey)}
        </p>
      )}
      {items.length === 0 && (
        <p className="py-2 text-caption text-oc-faint">
          {tr('chat.taskTile.sections.contextDesc')}
        </p>
      )}
      {(full ? items : items.slice(0, 3)).map((source) =>
        source.kind === 'web' ? (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.url}
            onClick={(event) => {
              if (useChatStore.getState().activeKey !== activeKey) event.preventDefault()
            }}
            className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2 text-footnote text-oc-muted outline-none hover:bg-oc-layer-2 ring-focus"
          >
            <Icon name="globe" size={16} />
            <span className="truncate">{source.title}</span>
          </a>
        ) : (
          <PanelRow
            key={
              source.kind === 'attachment' ? source.attachmentId : `${source.kind}:${source.path}`
            }
            icon={
              source.kind === 'directory'
                ? 'folder'
                : source.kind === 'attachment' && source.image
                  ? 'cam'
                  : 'doc'
            }
            disabled={!sessionId || !source.path || openingPath !== null}
            title={source.path ?? (source.kind === 'attachment' ? source.name : '')}
            onClick={() => {
              if (source.path)
                void openContextPath(
                  source.path,
                  source.kind === 'directory' ? 'directory' : 'file'
                )
            }}
          >
            {source.kind === 'attachment' ? source.name : basenameForDisplay(source.path)}
          </PanelRow>
        )
      )}
      {!full && items.length > 0 && (
        <PanelRow
          icon="kebab"
          focusKey="sources"
          onClick={(event) => onShowAll?.(event.currentTarget)}
        >
          {tr('chat.opencode.panel.showAll')}
        </PanelRow>
      )}
    </section>
  )
}
