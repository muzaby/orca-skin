// 에이전트 호스트의 세션 메타 사본 (0324 EP-16′ · D-039).
//
// 세션 행은 데이터 호스트에 있다. 실행 쪽에는 동기로 판정해야 하는 자리가 있다 — 리소스 동기화의
// 대상 해석(`ProjectResourceSync` 는 lease·활동 통지에서 동기로 돈다)과 Claude 프로세스 리셋 계획
// ("계획과 닫기 사이에 await 가 없다"). 그 자리는 이 사본을 읽는다.
//
// 사본이 성립하는 조건: 이 호스트가 런타임이나 lease 를 가진 세션은 lease 가 바뀔 때마다
// (`track`) 데이터 호스트에서 다시 읽고, 값이 바뀌면 `changed` 로 동기 판정을 다시 돌린다.
// 동기 판정 직전에 비동기 구간이 있는 자리는 `refresh`/`ensure` 로 먼저 채운다.
// 늦게 도착한 응답은 같은 세션의 더 새 읽기를 덮지 않는다.

import { sameSessionBinding } from '../session-binding'

export interface SessionMetaRow {
  backend: string
  cwd: string | null
  project_id: string | null
}

export interface SessionMetaCache<R extends SessionMetaRow> {
  get(sessionId: string): R | undefined
  // 데이터 호스트에서 다시 읽어 사본을 고친다. 없는 세션이면 사본에서 지운다.
  refresh(sessionId: string): Promise<R | undefined>
  // 사본이 없는 세션만 읽는다 — 동기 판정 직전에 부른다.
  ensure(sessionIds: Iterable<string>): Promise<void>
  // 런타임·lease 를 가진 세션 집합이 바뀌었다. 새로 들어온 세션과 사본이 없는 세션을 읽는다.
  track(sessionIds: Iterable<string>): void
  forget(sessionId: string): void
}

export function createSessionMetaCache<R extends SessionMetaRow>(deps: {
  read(sessionId: string): Promise<R | null | undefined>
  // 사본이 바뀌었다(새로 생김·값이 다름·사라짐).
  changed(): void
  // 배경 읽기의 실패 — 사본은 그대로 둔다.
  failed?(error: unknown): void
}): SessionMetaCache<R> {
  const rows = new Map<string, R>()
  const sequence = new Map<string, number>()
  let tracked = new Set<string>()

  const refresh = async (sessionId: string): Promise<R | undefined> => {
    const mine = (sequence.get(sessionId) ?? 0) + 1
    sequence.set(sessionId, mine)
    const row = (await deps.read(sessionId)) ?? undefined
    // 그 사이 더 새 읽기가 시작됐거나 잊었다 — 이 응답은 사본을 고치지 않는다.
    if (sequence.get(sessionId) !== mine) return rows.get(sessionId)
    const before = rows.get(sessionId)
    if (row) rows.set(sessionId, row)
    else rows.delete(sessionId)
    if (!same(before, row)) deps.changed()
    return row
  }

  return {
    get: (sessionId) => rows.get(sessionId),
    refresh,
    async ensure(sessionIds) {
      await Promise.all(
        [...new Set(sessionIds)].filter((id) => !rows.has(id)).map((id) => refresh(id))
      )
    },
    track(sessionIds) {
      const next = new Set(sessionIds)
      for (const id of next) {
        if (tracked.has(id) && rows.has(id)) continue
        void refresh(id).catch((error: unknown) => deps.failed?.(error))
      }
      tracked = next
    },
    forget(sessionId) {
      rows.delete(sessionId)
      tracked.delete(sessionId)
      // 진행 중인 읽기가 잊은 세션을 되살리지 않게 순번을 올린다.
      sequence.set(sessionId, (sequence.get(sessionId) ?? 0) + 1)
    }
  }
}

function same(a: SessionMetaRow | undefined, b: SessionMetaRow | undefined): boolean {
  if (!a || !b) return a === b
  return sameSessionBinding(a, b)
}
