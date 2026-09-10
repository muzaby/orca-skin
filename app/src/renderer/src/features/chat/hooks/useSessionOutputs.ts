import { useEffect } from 'react'
import type { ArtifactRef } from '../../../../../shared/artifacts'
import { useChatSession } from '../store/chatStore'
import { acquireArtifacts, refreshArtifactList, useArtifactStore } from '../store/artifactStore'

const EMPTY_OUTPUTS: ArtifactRef[] = []

export function useSessionOutputs(): {
  sessionId: string | null
  entry: ReturnType<typeof useArtifactStore.getState>['sessions'][string] | undefined
  list: ArtifactRef[]
} {
  const sessionId = useChatSession((session) => session.sessionId)
  const entry = useArtifactStore((state) => (sessionId ? state.sessions[sessionId] : undefined))
  useEffect(() => {
    if (!sessionId) return
    const release = acquireArtifacts(sessionId, [], true)
    if (!useArtifactStore.getState().sessions[sessionId]?.listLoading)
      void refreshArtifactList(sessionId)
    return release
  }, [sessionId])
  return { sessionId, entry, list: entry?.list ?? EMPTY_OUTPUTS }
}
