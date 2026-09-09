import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { basenameForDisplay } from '../../../../../../shared/path-basename'
import { fileApi } from '../../../../shared/api/ipc'
import { useChatBusy, useChatSession, useChatStore } from '../../store/chatStore'
import { useDirectoryPicker } from '../../hooks/useDirectoryPicker'
import { SectionPlaceholder, TileSection } from './TaskTileSections'

export function TaskContextContent(): React.JSX.Element {
  const { tr } = useI18n()
  const directories = useChatSession((s) => s.extraDirs)
  const sessionId = useChatSession((s) => s.sessionId)
  const activeKey = useChatStore((s) => s.activeKey)
  const busy = useChatBusy()
  const picker = useDirectoryPicker(true)
  const mounted = useRef(true)
  const opening = useRef(false)
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const [openFailure, setOpenFailure] = useState<{ key: string; path: string } | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const openDirectory = async (path: string): Promise<void> => {
    if (!sessionId || opening.current) return
    const current = (): boolean => {
      const state = useChatStore.getState()
      return (
        mounted.current &&
        state.activeKey === activeKey &&
        state.sessions[activeKey]?.session.sessionId === sessionId
      )
    }
    if (!current()) return
    opening.current = true
    setOpeningPath(path)
    setOpenFailure(null)
    try {
      await fileApi.openPath({ path, mode: 'directory', sessionId })
    } catch {
      if (current()) setOpenFailure({ key: activeKey, path })
    } finally {
      opening.current = false
      if (mounted.current) setOpeningPath(null)
    }
  }
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
          {openFailure?.key === activeKey && (
            <p role="alert" className="px-4 pt-2 text-footnote text-rust">
              {basenameForDisplay(openFailure.path)}: {tr('chat.taskTile.directoryOpenFailed')}
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
            <button
              key={directory}
              type="button"
              disabled={!sessionId || openingPath !== null}
              aria-busy={openingPath === directory}
              aria-label={tr('chat.taskTile.openDirectory', {
                name: basenameForDisplay(directory)
              })}
              onClick={() => void openDirectory(directory)}
              data-surface="context-directory"
              title={tr('chat.taskTile.allowedDirectory', { path: directory })}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-footnote text-ink2 hover:bg-fill-uncontained-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="folder" size={14} className="shrink-0" />
              <span className="min-w-0 truncate">{basenameForDisplay(directory)}</span>
            </button>
          ))}
        </div>
      ) : (
        <SectionPlaceholder icon="doc" descKey="chat.taskTile.sections.contextDesc" />
      )}
    </TileSection>
  )
}
