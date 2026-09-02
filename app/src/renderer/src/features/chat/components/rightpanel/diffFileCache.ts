import type { GitDiffFileContent, GitDiffFileRequest } from '../../../../../../shared/ipc'
import type { GitPeekTarget } from '../../reducer/chatReducer'

export interface DiffPeekBodyRequest {
  key: string
  generation: number
}

/** Task 5도 현재 diff 본문과 응답 세대를 읽을 수 있도록 노출하는 안정된 화면 경계다. */
export interface DiffPeekBodyState extends DiffPeekBodyRequest {
  content: GitDiffFileContent | null
}

/** 현재 body의 identity는 active summary generation까지 포함한다. */
export function diffPeekBodyKey(
  cwd: string | null,
  sessionId: string | null,
  target: GitPeekTarget,
  summaryGeneration: number
): string {
  return JSON.stringify([cwd, sessionId, summaryGeneration, target.group, target.path])
}

/** 본문 IPC는 entry group과 무관한 Task-2 session-wide file contract다. */
export function diffPeekFileRequest(
  cwd: string,
  sessionId: string | null,
  target: GitPeekTarget
): GitDiffFileRequest {
  return { cwd, ...(sessionId ? { sessionId } : {}), path: target.path }
}

interface DiffPeekBodyRequestOwner {
  run(
    key: string,
    load: () => Promise<GitDiffFileContent>,
    onResult: (request: DiffPeekBodyRequest, content: GitDiffFileContent) => void,
    onError: (request: DiffPeekBodyRequest) => void
  ): DiffPeekBodyRequest
  invalidate(): void
}

/**
 * body 요청도 매번 세대를 전진시킨다. 같은 상대 경로라도 identity/peek가 바뀐 뒤의 늦은
 * 응답은 현재 cache에 닿지 못한다.
 */
export function createDiffPeekBodyRequestOwner(): DiffPeekBodyRequestOwner {
  let generation = 0
  return {
    run(key, load, onResult, onError) {
      const request = { key, generation: ++generation }
      void load()
        .then((content) => {
          if (request.generation === generation) onResult(request, content)
        })
        .catch(() => {
          if (request.generation === generation) onError(request)
        })
      return request
    },
    invalidate() {
      generation += 1
    }
  }
}
