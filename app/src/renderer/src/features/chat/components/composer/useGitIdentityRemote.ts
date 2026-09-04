import { useEffect, useState } from 'react'
import { gitApi } from '../../../../shared/api/ipc'

export interface GitIdentityRemote {
  phase: 'loading' | 'ready' | 'unavailable' | 'error'
  url: string | null
}

/** 메뉴가 닫히거나 cwd가 바뀐 뒤에는 이전 응답을 전달하지 않는다. */
export function queryGitIdentityRemote(
  cwd: string,
  load: (cwd: string) => Promise<{ githubUrl?: string | null }>,
  onResult: (result: GitIdentityRemote) => void
): () => void {
  let live = true
  void Promise.resolve()
    .then(() => load(cwd))
    .then(
      (status) => {
        if (!live) return
        onResult(
          status.githubUrl
            ? { phase: 'ready', url: status.githubUrl }
            : { phase: 'unavailable', url: null }
        )
      },
      () => {
        if (live) onResult({ phase: 'error', url: null })
      }
    )
  return () => {
    live = false
  }
}

export function useGitIdentityRemote(
  cwd: string | null | undefined,
  menuEpoch: number | undefined,
  fallbackUrl: string | null
): GitIdentityRemote {
  const key = cwd && menuEpoch !== undefined ? JSON.stringify([cwd, menuEpoch]) : null
  const [result, setResult] = useState<{ key: string; remote: GitIdentityRemote } | null>(null)
  useEffect(() => {
    if (!cwd || key === null) return
    return queryGitIdentityRemote(
      cwd,
      (directory) => gitApi.status(directory),
      (remote) => setResult({ key, remote })
    )
  }, [cwd, key])
  if (key === null) return { phase: fallbackUrl ? 'ready' : 'unavailable', url: fallbackUrl }
  return result?.key === key ? result.remote : { phase: 'loading', url: null }
}
