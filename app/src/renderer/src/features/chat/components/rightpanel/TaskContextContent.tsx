import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { basenameForDisplay } from '../../../../../../shared/path-basename'
import { useChatBusy, useChatSession } from '../../store/chatStore'
import { useDirectoryPicker } from '../../hooks/useDirectoryPicker'
import { SectionPlaceholder, TileSection } from './TaskTileSections'

export function TaskContextContent(): React.JSX.Element {
  const { tr } = useI18n()
  const directories = useChatSession((s) => s.extraDirs)
  const busy = useChatBusy()
  const picker = useDirectoryPicker(true)
  return (
    <TileSection
      titleKey="chat.taskTile.sections.context"
      status={
        <>
          {picker.picking && (
            <p role="status" className="px-4 pt-2 text-caption text-ink3">
              {tr('chat.taskTile.directoryPicking')}
            </p>
          )}
          {picker.errorKey && (
            <p role="alert" className="px-4 pt-2 text-footnote text-rust">
              {tr(picker.errorKey)}
            </p>
          )}
        </>
      }
      actions={
        <Button
          iconOnly
          size="small"
          disabled={picker.disabled}
          onClick={() => void picker.pick()}
          aria-label={tr('chat.taskTile.addDirectory')}
          title={tr(busy ? 'chat.taskTile.directoryBusy' : 'chat.taskTile.addDirectory')}
        >
          <span className="relative flex">
            <Icon name="folder" size={18} />
            <span
              aria-hidden
              className="absolute -bottom-px -right-px flex h-2.5 w-2.5 items-center justify-center bg-panel"
            >
              <Icon name="plus" size={10} />
            </span>
          </span>
        </Button>
      }
    >
      {directories.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-4 pt-2">
          {directories.map((directory) => (
            <span
              key={directory}
              data-surface="context-directory"
              title={tr('chat.taskTile.allowedDirectory', { path: directory })}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-footnote text-ink2"
            >
              <Icon name="folder" size={14} className="shrink-0" />
              <span className="min-w-0 truncate">{basenameForDisplay(directory)}</span>
            </span>
          ))}
        </div>
      ) : (
        <SectionPlaceholder icon="doc" descKey="chat.taskTile.sections.contextDesc" />
      )}
    </TileSection>
  )
}
