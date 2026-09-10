import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { basenameForDisplay } from '../../../../../../shared/path-basename'
import { fileApi } from '../../../../shared/api/ipc'
import { useChatBusy, useChatSession, useChatStore } from '../../store/chatStore'
import { useDirectoryPicker } from '../../hooks/useDirectoryPicker'
import { SectionPlaceholder, TileSection } from './TaskTileSections'
import { createTaskContextSourceSelector, taskContextDirectories } from '../../lib/taskContext'

export function TaskContextContent(): React.JSX.Element {
  const { tr } = useI18n()
  const cwd = useChatSession((s) => s.cwd)
  const extraDirs = useChatSession((s) => s.extraDirs)
  const messages = useChatSession((s) => s.messages)
  const [selectSources] = useState(createTaskContextSourceSelector)
  const directories = useMemo(() => taskContextDirectories(cwd, extraDirs), [cwd, extraDirs])
  const sources = useMemo(() => selectSources(messages), [selectSources, messages])
  const sessionId = useChatSession((s) => s.sessionId)
  const activeKey = useChatStore((s) => s.activeKey)
  const busy = useChatBusy()
  const picker = useDirectoryPicker(true)
  const mounted = useRef(true)
  const opening = useRef(false)
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const [openFailure, setOpenFailure] = useState<{
    key: string
    path: string
    mode: 'directory' | 'reveal'
  } | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const openContextPath = async (path: string, mode: 'directory' | 'reveal'): Promise<void> => {
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
      await fileApi.openPath({ path, mode, sessionId })
    } catch {
      if (current()) setOpenFailure({ key: activeKey, path, mode })
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
          {picker.errorKey && (
            <p role="alert" className="px-4 pt-2 text-footnote text-rust">
              {tr(picker.errorKey)}
            </p>
          )}
          {openFailure?.key === activeKey && (
            <p role="alert" className="px-4 pt-2 text-footnote text-rust">
              {basenameForDisplay(openFailure.path)}:{' '}
              {tr(
                openFailure.mode === 'directory'
                  ? 'chat.taskTile.directoryOpenFailed'
                  : 'chat.taskTile.sourceOpenFailed'
              )}
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
          {directories.map(({ path: directory, working }) => (
            <button
              key={directory}
              type="button"
              disabled={!sessionId || openingPath !== null}
              aria-busy={openingPath === directory}
              aria-label={tr('chat.taskTile.openDirectory', {
                name: basenameForDisplay(directory)
              })}
              onClick={() => void openContextPath(directory, 'directory')}
              data-surface="context-directory"
              title={tr(
                working ? 'chat.taskTile.workingDirectory' : 'chat.taskTile.allowedDirectory',
                { path: directory }
              )}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-footnote text-ink2 hover:bg-fill-uncontained-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="folder" size={14} className="shrink-0" />
              <span className="min-w-0 truncate">{basenameForDisplay(directory)}</span>
            </button>
          ))}
        </div>
      ) : sources.length === 0 ? (
        <SectionPlaceholder icon="doc" descKey="chat.taskTile.sections.contextDesc" />
      ) : null}
      {sources.length > 0 && (
        <div className="px-4 pt-3">
          <p className="mb-2 text-caption text-ink3">{tr('chat.taskTile.sourceHeading')}</p>
          <ul className="flex flex-col gap-1">
            {sources.map((source) => (
              <li
                key={
                  source.kind === 'web'
                    ? source.url
                    : source.kind === 'attachment'
                      ? source.attachmentId
                      : source.path
                }
              >
                {source.kind !== 'web' ? (
                  <button
                    type="button"
                    disabled={!sessionId || !source.path || openingPath !== null}
                    aria-busy={!!source.path && openingPath === source.path}
                    aria-label={tr('chat.taskTile.openSourceFile', {
                      name:
                        source.kind === 'attachment' ? source.name : basenameForDisplay(source.path)
                    })}
                    title={source.path ?? (source.kind === 'attachment' ? source.name : undefined)}
                    onClick={() => {
                      if (source.path) void openContextPath(source.path, 'reveal')
                    }}
                    data-surface={
                      source.kind === 'attachment'
                        ? 'context-attachment-source'
                        : 'context-file-source'
                    }
                    className="flex w-full min-w-0 items-center gap-2 rounded-r4 py-1 text-left text-footnote text-ink2 hover:bg-fill-uncontained-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon
                      name={source.kind === 'attachment' && source.image ? 'cam' : 'doc'}
                      size={14}
                      className="shrink-0"
                    />
                    <span className="min-w-0 truncate">
                      {source.kind === 'attachment' ? source.name : source.path}
                    </span>
                  </button>
                ) : (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={source.url}
                    data-surface="context-web-source"
                    onClick={(event) => {
                      const state = useChatStore.getState()
                      if (
                        state.activeKey !== activeKey ||
                        state.sessions[activeKey]?.session.sessionId !== sessionId
                      )
                        event.preventDefault()
                    }}
                    className="flex min-w-0 items-center gap-2 rounded-r4 py-1 text-footnote text-ink2 hover:bg-fill-uncontained-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <Icon name="globe" size={14} className="shrink-0" />
                    <span className="min-w-0 truncate">{source.title}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </TileSection>
  )
}
