import { useMemo } from 'react'
import { formatElapsed, useElapsed } from '../../../../shared/ui/elapsed'
import { useI18n } from '../../../../shared/i18n'
import {
  chatActions,
  useChatAwaitingBackground,
  useChatSession,
  useSubagentMetaMap
} from '../../store/chatStore'
import { deriveBackgroundRun } from '../../lib/backgroundRun'
import { TranscriptActionRow } from './TranscriptActionRow'

// 백그라운드 실행 줄(0231 D-101) — 어시스턴트 턴이 **종료로 보이는 동안** 마지막 턴 아래에 서서
// "이 작업이 N분째 돌고 있다" 를 말한다. 그 전까지 이 구간(`transport==='ready'`)에는 표시가
// 아예 없었다: spark 라인은 `pending` 게이트 안에만 서고 그 값이 `ready` 를 제외한다.
//
// **스피너가 아니다.** `SparkSpinner` 를 쓰지 않고 `StatusLine` 도 부르지 않는다 — 0208 D-002 는
// 스피너가 세 소비처에 분기 없이 같은 것을 주도록 잠갔고, 여기에 variant 를 만들면 그 계약이
// 깨진다. 표시 조건(`sessionAwaitingBackground`)이 `sessionResponding` 과 배타라 스피너와 이 줄이
// 한 화면에 함께 서지 않는다(§10 EP-206).
//
// 클릭은 **목록**을 연다(D-105). 개별 상세가 아닌 이유는 두 가지다: 이 줄은 N건의 요약이라 열
// 상세가 하나로 정해지지 않고, 셸 작업은 하위 대화록이 없다(0230 R-03).
//
// a11y: 행 셸이 `role="button"` 과 키보드 계약을 갖는다. `aria-live` 는 걸지 않는다 — `StatusLine`
// 과 배타라 동시 낭독은 불가능하고, 초당 갱신되는 경과에 live 를 걸면 스크린리더가 계속 끊긴다.
export function BackgroundRunRow(): React.JSX.Element | null {
  const { tr } = useI18n()
  const awaiting = useChatAwaitingBackground()
  const count = useChatSession((s) => s.activityBackgroundTaskCount)
  const listenStartedAt = useChatSession((s) => s.listenStartedAt)
  const subagentMeta = useSubagentMetaMap()
  // 앵커는 listen 구간의 기존 것을 재사용한다(§14) — 이 줄이 자기 틱을 새로 만들지 않는다.
  const elapsedSec = useElapsed(awaiting ? listenStartedAt : null)
  const model = useMemo(
    () =>
      deriveBackgroundRun({
        backgroundTaskCount: count,
        elapsedSeconds: listenStartedAt === null ? null : elapsedSec,
        subagentMeta
      }),
    [count, listenStartedAt, elapsedSec, subagentMeta]
  )
  if (!awaiting || model === null) return null

  const facts = [
    tr('chat.backgroundRun.count', { count: model.count }),
    model.elapsedSeconds !== undefined ? formatElapsed(model.elapsedSeconds) : null,
    // 재시도는 요약을 이긴다 — 파생이 이미 하나만 싣는다(`backgroundRun.ts`).
    model.retry
      ? tr('chat.backgroundRun.retrying', {
          attempt: model.retry.attempt,
          max: model.retry.maxRetries
        })
      : model.summary
  ].filter((value): value is string => typeof value === 'string' && value !== '')

  return (
    <TranscriptActionRow
      groupClassName="group/bgrun"
      onActivate={() => chatActions.openBackgroundTaskList()}
    >
      <span className="shrink-0 group-hover/bgrun:text-t9">{facts[0]}</span>
      {facts.length > 1 && (
        <span className="min-w-0 truncate group-hover/bgrun:text-t9">
          {facts.slice(1).join(' · ')}
        </span>
      )}
    </TranscriptActionRow>
  )
}
