// 에이전트 호스트가 데이터 호스트에 부탁하는 연산의 표 (0324 F2 · F4 · EP-16).
//
// 실행 쪽 코드의 DB 조회·기록은 이 표의 이름으로만 건너온다 — 표에 없는 `DbQueries` 메서드는 실행
// 쪽에서 부를 수 없다. 인자·결과는 구조화 복제가 되는 값(행·원시값)만 쓴다. 조회는 `data.query`,
// 기록은 `data.write` 로 간다.
//
// 한 연산은 데이터 호스트에서 한 번에(동기로) 끝난다 — 읽고-고쳐-쓰기를 실행 쪽에서 두 요청으로
// 나누면 사이에 다른 요청이 끼어든다. 그런 묶음은 여기서 한 연산으로 둔다.

import type {
  NativeHistoryCursor,
  NativeHistorySnapshot
} from '../../adapters/common/native-history'
import { recoverSessionHistory } from '../../features/chat/recovery'
import { readNativeHistoryPrevious } from '../../features/history/native-sync'
import { loadSession } from '../../features/history/reader'
import { getWorkspacePath } from '../../infra/config/paths'
import type { DbQueries } from '../../infra/db'

export interface DataOpsDeps {
  db: DbQueries
  // 프로젝트 미소속 세션의 기본 작업 폴더.
  defaultCwd(): string
}

// 하네스 원본 이력의 이전 스냅샷. 원본 레코드(`raw`)는 크고 드물게 쓰여 `nativeHistoryRaw` 로 따로 준다.
export interface NativeHistoryPreviousRow {
  snapshot: NativeHistorySnapshot
  cursor: NativeHistoryCursor | undefined
}

// 표의 타입은 구현에서 유도한다 — 따로 적으면 표와 타입이 갈린다.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createDataQueryOps(deps: DataOpsDeps) {
  const { db } = deps
  const cwdOf = (projectId: string | null | undefined): string =>
    getWorkspacePath(projectId ? db.getProject(projectId) : null, deps.defaultCwd())
  return {
    getSessionById: (id: string) => db.getSessionById(id),
    getProject: (id: string) => db.getProject(id),
    // 프로젝트마다의 작업 폴더. `null` 은 프로젝트 미소속(기본 작업 폴더)이다.
    workspacePaths: (projectIds: Array<string | null>): Array<[string | null, string]> =>
      projectIds.map((id) => [id, cwdOf(id)]),
    getProjectContextForSession: (sessionId: string) => db.getProjectContextForSession(sessionId),
    getTitleSource: (sessionId: string) => db.getTitleSource(sessionId),
    getManagedWorktreeBySession: (sessionId: string) => db.getManagedWorktreeBySession(sessionId),
    nativeRecovery: (sessionId: string) => db.nativeHistory?.recovery?.(sessionId),
    nativeObserve: (sessionId: string) => db.nativeHistory.observe(sessionId),
    nativeHistoryPrevious: (sessionId: string): NativeHistoryPreviousRow | undefined => {
      const previous = readNativeHistoryPrevious(db, sessionId)
      return previous && { snapshot: previous.snapshot, cursor: previous.cursor }
    },
    // 이전 스냅샷의 원본 레코드 — 이어 읽기가 성립할 때만 실행 쪽이 따로 묻는다.
    nativeHistoryRaw: (sessionId: string): unknown =>
      readNativeHistoryPrevious(db, sessionId)?.raw?.(),
    // 보관 대화 전체 — 원본이 사라진 세션의 복구 입력.
    loadSessionArchive: (sessionId: string) => loadSession(db, sessionId, cwdOf)
  }
}
export type DataQueryOps = ReturnType<typeof createDataQueryOps>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createDataWriteOps(deps: DataOpsDeps) {
  const { db } = deps
  return {
    updateSessionProviderKey: (
      id: string,
      providerKey: string | null,
      updatedAt: number,
      model: string | null
    ) => db.updateSessionProviderKey(id, providerKey, updatedAt, model),
    ensurePathProject: (row: Parameters<DbQueries['ensurePathProject']>[0]) =>
      db.ensurePathProject(row),
    updateSessionTitleAuto: (id: string, title: string, updatedAt: number) =>
      db.updateSessionTitleAuto(id, title, updatedAt),
    insertManagedWorktree: (row: Parameters<DbQueries['insertManagedWorktree']>[0]) =>
      db.insertManagedWorktree(row),
    deleteManagedWorktree: (id: string) => db.deleteManagedWorktree(id),
    updateSessionCwd: (sessionId: string, cwd: string, updatedAt: number) =>
      db.updateSessionCwd(sessionId, cwd, updatedAt),
    nativePrepareRecovery: (input: Parameters<DbQueries['nativeHistory']['prepareRecovery']>[0]) =>
      db.nativeHistory.prepareRecovery(input),
    nativeAcceptRecovery: (sessionId: string, nativeMessageId: string) =>
      db.nativeHistory.acceptRecovery(sessionId, nativeMessageId),
    nativeRecoveryPrompt: (sessionId: string, nativeMessageId: string, visibleText: string) =>
      db.nativeHistory.recoveryPrompt(sessionId, nativeMessageId, visibleText),
    // 쉬는 세션의 끊긴 도구 호출·미완료 메시지 정리. 진행 중인지는 실행 쪽이 먼저 본다.
    recoverSessionHistory: (sessionId: string): void => {
      recoverSessionHistory(db, { sessionId })
    }
  }
}
export type DataWriteOps = ReturnType<typeof createDataWriteOps>
