import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fileApi } from '../../../shared/api/ipc'
import { reportError } from '../../../shared/errors'
import { chatActions } from '../store/chatStore'
import { projectForDirectory, type LandingProjects } from '../lib/landingProjectOptions'

export function useLandingProjectPicker(projects: LandingProjects): {
  select: (id: string) => boolean
  add: () => Promise<boolean>
  picking: boolean
} {
  const [picking, setPicking] = useState(false)
  const mounted = useRef(true)
  const busy = useRef(false)
  const latest = useRef(projects)
  useLayoutEffect(() => {
    latest.current = projects
  }, [projects])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const select = (id: string): boolean => {
    const target = chatActions.capturePendingProjectTarget()
    const item = latest.current.items.find((item) => item.id === id)
    return !!(
      target &&
      item?.cwd &&
      chatActions.selectPendingProject({ cwd: item.cwd, projectId: item.id }, target)
    )
  }

  const add = async (): Promise<boolean> => {
    const target = chatActions.capturePendingProjectTarget()
    if (!target || busy.current) return false
    busy.current = true
    setPicking(true)
    try {
      const cwd = await fileApi.pickDirectory()
      if (!mounted.current || !cwd) return false
      const project = projectForDirectory(latest.current.items, cwd)
      return chatActions.selectPendingProject({ cwd, projectId: project?.id ?? null }, target)
    } catch (error) {
      if (mounted.current)
        reportError({
          event: 'files.cwd-action.failed',
          scope: 'files',
          title: 'actionFailed',
          error
        })
      return false
    } finally {
      busy.current = false
      if (mounted.current) setPicking(false)
    }
  }
  return { select, add, picking }
}
