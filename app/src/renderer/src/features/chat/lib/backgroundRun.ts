// 백그라운드 실행 줄 모델 파생(0231 MD-101, D-101) — **순수 함수**.
//
// 이 줄은 "클로드는 답을 마쳤고 이 작업이 N분째 돌고 있다" 를 말한다. 스피너가 아니고
// (0208 D-002 — 스피너는 세 소비처가 분기 없이 같은 것을 받는다) `sessionResponding` 과
// 배타라 한 화면에 둘이 서지 않는다(§10 EP-206).
//
// i18n 은 여기서 하지 않는다 — **키 + 값**만 돌려주고 번역은 컴포넌트가 한다.
//
// 요약 선택 규칙: **정착하지 않은(status 미설정) 엔트리 중 가장 늦게 시작한 것**의 `summary`.
// `subagentMeta` 는 세션의 태스크 수만큼이라(파트 수가 아니다) 이 순회는 O(태스크)다 — 실행 줄이
// 전체 파트를 다시 접지 않게 하려는 것이 이 규칙의 이유다(§14).
//
// 재시도는 요약을 **이긴다**. `heartbeat` 만 반복되는 동안 해제되지 않아야 하는 상태라(AT-102)
// 다른 문구가 그 자리를 덮으면 사용자는 재시도 중인 줄 모른다.

export interface BackgroundRunMetaLike {
  status?: 'completed' | 'failed' | 'stopped'
  startedAtMs?: number
  summary?: string
  retry?: { attempt: number; maxRetries: number; errorCategory: string }
}

export interface BackgroundRunModel {
  /** 실행 중이라고 말할 작업 수 — main 의 배지 세기(런치 영수증 관측분, D-104). */
  count: number
  /** 경과 초. 앵커가 없으면 생략한다(§9 데이터 표). */
  elapsedSeconds?: number
  /** 최신 한 줄 요약. 재시도 중이면 싣지 않는다 — `retry` 가 그 자리를 갖는다. */
  summary?: string
  /** 재시도 대기. 요약보다 우선한다. */
  retry?: { attempt: number; maxRetries: number }
}

export function deriveBackgroundRun(args: {
  backgroundTaskCount: number
  /** listen 구간 앵커(`listenStartedAt`). 없으면 경과를 생략한다. */
  elapsedSeconds: number | null
  subagentMeta: Readonly<Record<string, BackgroundRunMetaLike>>
}): BackgroundRunModel | null {
  if (args.backgroundTaskCount <= 0) return null
  let newest: BackgroundRunMetaLike | undefined
  let newestRetry: BackgroundRunMetaLike | undefined
  for (const meta of Object.values(args.subagentMeta)) {
    // 정착한 작업은 실행 줄의 사실이 아니다 — 그 자리는 완료 통지 행이 갖는다.
    if (meta.status !== undefined) continue
    if (meta.retry !== undefined && isNewer(meta, newestRetry)) newestRetry = meta
    if (meta.summary !== undefined && isNewer(meta, newest)) newest = meta
  }
  const retry = newestRetry?.retry
  return {
    count: args.backgroundTaskCount,
    ...(args.elapsedSeconds !== null ? { elapsedSeconds: args.elapsedSeconds } : {}),
    ...(retry !== undefined
      ? { retry: { attempt: retry.attempt, maxRetries: retry.maxRetries } }
      : newest?.summary !== undefined
        ? { summary: newest.summary }
        : {})
  }
}

// 앵커가 없는 엔트리는 가장 오래된 것으로 본다 — 없는 시각을 `Date.now()` 로 채우면 순서가
// 조회 시점에 따라 뒤집힌다.
function isNewer(a: BackgroundRunMetaLike, b: BackgroundRunMetaLike | undefined): boolean {
  if (b === undefined) return true
  return (a.startedAtMs ?? 0) >= (b.startedAtMs ?? 0)
}
