// 실행 쪽의 작업 폴더 해석 (0324 EP-16). 프로젝트의 폴더는 DB 에 있어 데이터 호스트에 묻고, 프로젝트
// 미소속의 기본 폴더는 실행 쪽이 안다. 턴 조립의 순수 함수들은 동기 조회 함수를 받으므로, 필요한
// 프로젝트를 먼저 한 번에 물어 둔 조회 함수를 만들어 넘긴다.

import type { AgentContext } from '../context'

export type WorkspaceLookup = (projectId?: string | null) => string

export async function workspaceLookup(
  ctx: Pick<AgentContext, 'data' | 'defaultCwd'>,
  projectIds: ReadonlyArray<string | null | undefined>
): Promise<WorkspaceLookup> {
  const ids = [...new Set(projectIds.filter((id): id is string => !!id))]
  const paths = new Map<string, string>()
  if (ids.length > 0) {
    for (const [id, path] of await ctx.data.query.workspacePaths(ids)) {
      if (id !== null) paths.set(id, path)
    }
  }
  return (projectId) => {
    if (!projectId) return ctx.defaultCwd()
    const path = paths.get(projectId)
    // 물어 두지 않은 프로젝트를 기본 폴더로 답하면 다른 폴더에서 턴이 돈다.
    if (path === undefined) throw new Error(`작업 폴더를 미리 조회하지 않은 프로젝트: ${projectId}`)
    return path
  }
}
