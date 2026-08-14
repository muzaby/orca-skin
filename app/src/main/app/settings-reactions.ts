// 설정 변경 → 파생 상태 재방송 (0187).
//
// ── 왜 IPC 핸들러가 아닌가 ───────────────────────────────────────────────────
// `settings:set` 은 도메인을 모르는 범용 핸들러다. 거기에 `if (key === 'authBypass')` 를 쌓으면
// 핸들러가 provider 플랫폼과 사용량 tracker 를 알아야 하고, **파생 설정이 늘 때마다 같은 누락이
// 반복된다** — 실제로 두 번 다 사후에 붙었다(0181 우회 토글이 재시작 전까지 안 먹었고, 0186
// 전역 한도가 다음 턴까지 옛 퍼센트를 보여줬다). 배선은 컴포지션 루트의 일이다.
//
// ── 왜 bootstrap 인라인이 아닌가 ────────────────────────────────────────────
// `bootstrap.ts` 는 electron 을 물어 vitest 대상이 아니다(`features/usage/jobs.ts` 가 같은 이유로
// 분리돼 있다). 여기 두면 "그 키가 바뀌면 정말 다시 미는가" 를 사람 실기 없이 단언할 수 있다 —
// 조용히 실패하는 종류의 회귀라 그 단언이 중요하다.

export interface SettingsPatchSource {
  onPatch(listener: (next: unknown, changedKeys: readonly string[]) => void): void
}

export interface SettingsReactionDeps {
  // 연결 상태 전체를 다시 미는 컴포지션 루트의 closure (0188). 구 구현은 `providers.state()`
  // 와 broadcast 를 따로 받아 여기서 이었는데, 그러면 이 모듈이 gate·view 조립 순서를 알아야
  // 했다. 지금은 "다시 밀어라" 한 마디만 안다.
  pushConnectionState?: () => void
  // 사용량 뷰의 소유자.
  cost: { recordAndBroadcast(): void }
}

export function registerSettingsReactions(
  settings: SettingsPatchSource,
  deps: SettingsReactionDeps
): void {
  settings.onPatch((_next, changedKeys) => {
    // 게이트 우회(dev)는 **게이트 판정의 입력**이다 — 설정만 바꾸고 끝내면 화면이 재시작
    // 전까지 옛 판정에 머문다(0181).
    if (changedKeys.includes('authBypass')) deps.pushConnectionState?.()
    // 전역 월 한도는 **사용량 뷰의 입력**(`budget`·`pct`)이다 — 설정만 바꾸고 끝내면 도넛이
    // 다음 턴 종료(=다음 delta)까지 옛 한도의 퍼센트를 보여준다(0186).
    if (changedKeys.includes('spendingLimitUsd')) {
      deps.cost.recordAndBroadcast()
    }
  })
}
