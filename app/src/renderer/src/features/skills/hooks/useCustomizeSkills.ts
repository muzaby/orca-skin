import { useCallback, useEffect, useState } from 'react'
import type {
  AuthorSkillRequest,
  SetSkillEnabledRequest,
  SkillInfo,
  SkillTargetRequest,
  UploadSkillRequest
} from '../../../../../shared/ipc'
import { skillApi } from '../../../shared/api/ipc'

export interface UseCustomizeSkills {
  list: SkillInfo[]
  loading: boolean
  refresh: () => Promise<void>
  author: (req: AuthorSkillRequest) => Promise<void>
  upload: (req: UploadSkillRequest) => Promise<void>
  setEnabled: (req: SetSkillEnabledRequest) => Promise<void>
  open: (req: SkillTargetRequest) => Promise<void>
  showInFolder: (req: SkillTargetRequest) => Promise<void>
  remove: (req: SkillTargetRequest) => Promise<void>
}

export function useCustomizeSkills(): UseCustomizeSkills {
  const [list, setList] = useState<SkillInfo[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const items = await skillApi.list()
    setList(items)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    skillApi
      .list()
      .then((items) => {
        if (!cancelled) setList(items)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const author = useCallback(async (req: AuthorSkillRequest) => {
    setList(await skillApi.author(req))
  }, [])

  const upload = useCallback(async (req: UploadSkillRequest) => {
    setList(await skillApi.upload(req))
  }, [])

  const setEnabled = useCallback(async (req: SetSkillEnabledRequest) => {
    setList(await skillApi.setEnabled(req))
  }, [])

  const open = useCallback(async (req: SkillTargetRequest) => {
    await skillApi.open(req)
  }, [])

  const showInFolder = useCallback(async (req: SkillTargetRequest) => {
    await skillApi.showInFolder(req)
  }, [])

  const remove = useCallback(async (req: SkillTargetRequest) => {
    setList(await skillApi.remove(req))
  }, [])

  return { list, loading, refresh, author, upload, setEnabled, open, showInFolder, remove }
}
