// 세션 핸들러가 실행 쪽에 묻는 훅 (0324 F4 · EP-21 · AC19′ · AC43). 데이터 호스트 조립이 세션 핸들러에
// 넘긴다. 요청 종류마다 에이전트 호스트를 확보할지가 다르다:
//
// - 바쁨 판정 · 활동 조회 · 런타임 폐기: `request` — 에이전트 호스트가 없으면 띄우지 않고 쉬는 상태로
//   본다(세션을 열거나 지우기만 해도 에이전트 호스트가 뜨면 안 된다). 폐기는 실패해도 DB 변경을 막지
//   않는다 — 폐기할 런타임이 없다는 뜻이다.
// - 갱신의 원본 읽기: `requestEnsured` — 하네스 어댑터가 읽으므로 없으면 띄워 달라고 한다. 확보가
//   실패하면 원본 읽기 없이 DB 본문으로 끝난다(EP-21 `peer.unavailable` 분기).

import type { ChatActivitySnapshot } from '../../../shared/ipc'
import { refreshNativeHistory } from '../../features/history/native-sync'
import type { DbQueries } from '../../infra/db'
import type { SessionDisposeHooks } from '../handlers/session'
import type { AgentLink } from './agent-link'

export interface SessionHooksDeps {
  link: Pick<AgentLink, 'request' | 'requestEnsured'>
  db: DbQueries
  // 그 세션의 저장 쪽 상태(백그라운드 기록 보류)를 잊는다.
  forgetSession(sessionId: string): void
}

// 에이전트 호스트가 없을 때의 활동 상태.
export const IDLE_ACTIVITY = { busy: false } as unknown as ChatActivitySnapshot

export function createSessionHooks(
  deps: SessionHooksDeps
): Required<Omit<SessionDisposeHooks, 'historyIndex'>> {
  const { link, db } = deps
  const isBusy = (sessionId: string): Promise<boolean> =>
    link.request('sessionBusy', sessionId).catch(() => false)
  return {
    isSessionBusy: isBusy,
    onSessionDisposed: async (sessionId) => {
      deps.forgetSession(sessionId)
      await link.request('discardSession', sessionId).catch(() => undefined)
    },
    getActivity: (sessionId) =>
      link.request('sessionActivity', sessionId).catch(() => IDLE_ACTIVITY),
    refreshHistory: (sessionId) =>
      refreshNativeHistory(sessionId, {
        db,
        isBusy: () => isBusy(sessionId),
        read: async () =>
          (await link.requestEnsured('readNativeHistory', sessionId)) ?? { status: 'unchanged' }
      })
  }
}
