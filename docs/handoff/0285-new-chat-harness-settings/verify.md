# Verify — 0285-new-chat-harness-settings

## 메타

| 항목 | 값 |
|---|---|
| slug | `0285-new-chat-harness-settings` |
| 검증자 | Claude Code |
| 일자 | 2026-10-29 |
| 대상 커밋/range | `e9ec8df..2ab8851`. 판정은 HEAD `81153e2` 위에서 수행 |
| 구현 전 plan 기준 | V1 `e9ec8df` |
| V mode / 유효 V | Baseline V1 |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — AC5·AC10·AC16·AC18 사람 실기·시각 회귀 대기 |
| 자기 검증 여부 | 설계 Claude·구현 codex. 구현자 ≠ 검증자 |

## 0. 기준선 / 후행 정본

- 구현 커밋 `2ab8851`의 `plan.md` 변경은 메타 상태·`[구현자 기입]` 자리표시자뿐이다.
- 후행 영향: 0287이 `/new` 경로 선택을 `CwdButton` 직접 dialog에서 프로젝트 picker로 바꿨다(0287 D-005·D-007). 0285 VP-02의 lastCwd 저장(`chatStore.ts:rememberPendingCwd`)은 picker 선택 경로에서도 같은 함수를 지나며, 0287 AC14가 "lastCwd 저장 유지"를 회귀 계약으로 잡았다. 0285 VP-02는 현재 경로에서 채점했다.
- 0286이 랜딩 폭(720px)·공통 활자 CI 기대값을 0285 계약에 맞춰 보완했다(0286 C01~C03) — 같은 방향.

## 1. 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| lastCwd 유효성 | 정상 | `session-cwd.ts:8-10` 절대경로·디렉터리 stat, 실패 시 fallback. M2 red |
| 설정 병합이 형제를 지우는가 | 아니오 | `settings-store.ts:110` 하네스별 얕은 병합. M9 red |
| 자동 승인 범위 | 정상 | `channel.ts:388` permission만 `once`, question은 승인 흐름. M7·M8 red |
| 스타일 우선순위 | 정상 | `claude/adapter.ts:520-522` provider 설정 뒤 outputStyle. M6 red |

## 2. 고장 이력 (HEAD에 재적용)

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 |
|---|---|---|---|---|---|
| M2 | `session-cwd.ts:10` | 제거 | stat 검사 | 잡음 1/1 | returns the remembered work path only while it is a directory |
| M3 | `chatStore.ts:1221` | 제거 | cwdCache 갱신 | 잡음 3/5 | persists the picked work path … 외 2 |
| M4 | `GeneralTab.tsx:289` | 맞바꿈 | Claude 그룹에 OpenCode 로고 | 잡음 1/5 | shows Claude and OpenCode groups … |
| M5 | `claude/adapter.ts:1051` | 제거 | appliedOutputStyle 갱신 | 잡음 1/4 | applies a changed style once before the next turn input |
| M6 | `claude/adapter.ts:520` | 뒤집기 | provider 설정을 스타일 뒤에 병합 | 잡음 1/4 | starts new queries with the configured style … |
| M7 | `opencode/v1/channel.ts:390` | 다른 값 | once → always | 잡음 2/26 | auto-accepts permissions once … (lnx 사본) |
| M8 | `channel.ts:388` | 제거 | permission 종류 조건 | 잡음 1/26 | 같음 |
| M9 | `settings-store.ts:110` | 제거 | 기존 하네스 값 병합 | 잡음 1/15 | merges a partial harness preference without clearing siblings |
| M12 | `opencode/composer/Module.tsx:10` | 다른 값 | showGitRow true | 잡음 1/5 | renders the git row only for harnesses that allow it |

- 검산: 시도 9 = 잡음 9 · 못 잡음 0. 미재실행: M1(접힘 nav)·M10(instructions 기본값)·M11(OpenCode 활자) — 시도하지 않은 고장은 결함 아님.
- M7·M8은 `adapter.test.ts`가 `C:/` fixture로 Linux 기준선 red라 POSIX 경로 미커밋 사본으로 쟀다([0289 verify §4](../0289-opencode-runtime-retention/verify.md) 같은 방식).

## 3. V-pair closeout

| Pair | 결과 | 근거 |
|---|---|---|
| VP-09·10·11 (UT) | PASS | `typography`·`NewChatLandingPage.harness` green, M12 red |
| VP-07·08 (IT) | PASS | `settings-store`·`generalTab.render` green, M4·M9 red |
| VP-02·05·06 (ST) | PASS | `chatStore.lastCwd`·`adapter.output-style`·`adapter`(lnx) green, M2·M3·M5~M8 red |
| VP-01·03·04 (AT) | PASS(기계) | AC5·AC10 실기 대기 |
| VP-12 (REGRESSION) | PASS(기계) | Claude 랜딩·transcript 스위트 green, AC16·AC18 시각 대기 |

- AC 합계 재측정: ✅ 14 · ⚠️ 4(AC5·10·16·18) · ❌ 0 = 18. trailer `Criteria-Met: 14/18` 일치.

## 4. 게이트

[0289 verify §6](../0289-opencode-runtime-retention/verify.md) 같은 HEAD — typecheck·lint·inventory PASS, Windows CI success. trailer 2커밋 파싱 정상.

## 5. 파생 이슈

| # | 이슈 | 분류 |
|---|---|---|
| V1 | AC5·AC10·AC16·AC18 실기·시각 회귀 | 사람 실기 |
