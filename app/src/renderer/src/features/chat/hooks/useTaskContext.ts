import { useEffect, useMemo, useRef, useState } from 'react'
import { i18n } from '../../../shared/i18n'
import { reportError } from '../../../shared/errors'
import { basenameForDisplay } from '../../../../../shared/path-basename'
import { fileApi } from '../../../shared/api/ipc'
import { useChatBusy, useChatSession, useChatStore } from '../store/chatStore'
import { useDirectoryPicker } from './useDirectoryPicker'
import { createTaskContextSourceSelector, taskContextDirectories } from '../lib/taskContext'

export function useTaskContext(): {
  directories: ReturnType<typeof taskContextDirectories>
  sources: ReturnType<ReturnType<typeof createTaskContextSourceSelector>>
  sessionId: string | null
  activeKey: string
  busy: boolean
  picker: ReturnType<typeof useDirectoryPicker>
  openingPath: string | null
  openContextPath: (path: string, mode: 'directory' | 'file') => Promise<void>
} {
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
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const openContextPath = async (path: string, mode: 'directory' | 'file'): Promise<void> => {
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
    try {
      if (mode === 'directory') await fileApi.openPath({ path, mode, sessionId })
      else {
        const result = await fileApi.openContextFile({ path, sessionId })
        if (result.outcome === 'missing')
          reportError({
            event: 'files.context-open.missing',
            scope: 'files',
            title: 'fileUnavailable',
            detail: `${basenameForDisplay(path)}: ${i18n.t('chat.taskTile.sourceMissing')}`
          })
      }
    } catch (error) {
      // 0242 ΔV2 (D-011) — 열기를 요청한 사용자에게 사유를 toast 로 알린다(패널 안 alert 없음).
      reportError({
        event: 'files.context-open.failed',
        scope: 'files',
        title: 'openFailed',
        error,
        detail: `${basenameForDisplay(path)}: ${i18n.t(
          mode === 'directory'
            ? 'chat.taskTile.directoryOpenFailed'
            : 'chat.taskTile.sourceOpenFailed'
        )}`,
        data: { mode }
      })
    } finally {
      opening.current = false
      if (mounted.current) setOpeningPath(null)
    }
  }
  return { directories, sources, sessionId, activeKey, busy, picker, openingPath, openContextPath }
}
