// 서브에이전트 wire 형태 술어 (L0 — 양 프로세스 안전, 런타임 의존 0).

import { isRecord } from './obj'

// 값이 백그라운드 런치 영수증({ status:'async_launched', agentId, … })인가.
//
// run_in_background 로 띄운 서브에이전트의 Agent tool_result 는 즉시 이 성공 페이로드를 돌려주고
// (SDK AgentOutput), 진짜 종료(완료/실패/중지)는 나중에 task_notification 으로 온다. 따라서 이
// 임시 결과는 "완료" 가 아니라 "실행 중" 으로 취급해야 한다 — main 은 추적 해제를 미루고,
// renderer 는 행을 실행 중으로 렌더한다.
//
// 0149: 이 리터럴을 main tracker · renderer parts 두 곳(+parts 내부 인라인 사본)이 각자 재판별해
// CLI 가 status 를 바꾸면 세 곳이 함께 어긋날 수 있었다. 프로세스 경계를 넘는 wire 상수라
// shared 가 단일 소유한다.
export function isAsyncLaunchedPayload(value: unknown): boolean {
  return isRecord(value) && value.status === 'async_launched'
}
