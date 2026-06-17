# Verify — 0025-debug-wire-log-toggle

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0025-debug-wire-log-toggle` |
| 검증자 | Claude Code |
| 일자 | 2026-06-17 |
| 대상 커밋 | `878ef2b` |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

> plan 의 각 인수 기준을 1:1 로 대조. **증거**(`파일:라인`, 테스트 출력)를 첨부.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 디버그 패널 "Wire 메시지" 토글 추가, 기본 off | ✅ | `DebugPanel.tsx` — 컨텍스트 슬라이더 아래 `<PanelToggle label="Wire 메시지" value={state.wireLog} onChange={(wireLog) => setMock({ wireLog })} />`. 기본값 `useDebugMock.ts` `DEFAULT_DEBUG_MOCK.wireLog: false` + `router.ts` `debugMock.wireLog: false` |
| 2 | 토글 ON → `sendChatEvent` 가 모든 `NormalizedEvent` 를 `[wire] <type> …` 로 터미널 출력 | ✅ | `context.ts` — `sendChatEvent` 내 `if (wireLogEnabled) console.log('[wire]', ev.type, ev)`. 플래그는 `misc.ts` `debugSetMock` 핸들러가 `setWireLog(ctx.debugMock.wireLog)` 로 동기화 |
| 3 | 토글 OFF/기본 → 무출력, 프로덕션 항상 무출력 | ✅ | `wireLogEnabled` 기본 `false`; `setWireLog` 호출부(`misc.ts`)가 `if (import.meta.env.DEV)` 가드 내부 → 프로덕션 빌드에서 토글·setter 트리 셰이킹, 플래그 `false` 고정 |
| 4 | 기존 IPC 재사용 — 신규 채널 0 | ✅ | `debugGetMock`/`debugSetMock` 2채널 그대로(`misc.ts`), `CHANNELS` 무변경. 확장은 `DebugMockState`/`DebugMockPatchSchema` 필드 1개뿐 |
| 5 | 채팅 transcript/DB 무변경 | ✅ | `chatReducer`·`AppMessagePart`·`db/**` diff 0 — 변경은 `console.log` 부수효과 한정. 채팅 관련 파일 미수정 |
| 6 | 게이트 통과·레이어 경계 0·신규 의존성 0 | ✅ | 아래 §게이트. `context.ts`/`misc.ts` 동일 L3 ipc import, renderer 는 `features/debug`+`shared/ui` 재사용(역방향/cross-feature 0). `package.json` 무변경 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 typecheck/lint/test | ✅ 실행 + 출력 | — | PASS |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 첨부 | 이견 시 중재 | 6/6 충족 |
| 레이어 경계 위반 0 | ✅ lint boundaries | — | 위반 0 |
| 문서 형식/링크/한국어 | ✅ | — | OK |
| 신규 의존성·IPC 채널 무변경 | ✅ | — | 0 / 채널 2 유지 |
| **`npm run dev` 토글 ON/OFF 실기 동작(터미널 `[wire]` 출력)** | ✖ 코드 보조 | ✅ 결정 | 사람 확인 대기 |
| 제품 의도 부합(콘솔만·메인 터미널) | ✖ 보조 | ✅ 결정(AskUserQuestion 확정) | 확정 반영 |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck && npm run lint && npx vitest run src/main/adapters/mock.test.ts
  typecheck  → PASS (typecheck:node + typecheck:web + typecheck:test 3종 tsc --noEmit)
  lint       → PASS (eslint --cache --fix, boundaries 위반 0)
  test       → PASS (mock.test.ts 4/4) — DebugMockState 리터럴 wireLog 반영 후 green
```

> 전체 `npm test` 는 better-sqlite3 dual-ABI(0019 클래스)로 `db/queries.test.ts` 가 환경 의존 red 일 수 있으나 본 변경과 무관(디버그/콘솔 경로). 변경 직접 연관 스위트(`mock.test.ts`)는 green.

## 위생 검토 (AGENTS.md 변경 시)

- 본 작업은 `AGENTS.md` 미변경 — 핸드오프 문서(`plan.md`/`verify.md`/`INDEX.md`) + `PHASES.md` 만 추가/갱신.
- 키/토큰/이메일/IP 패턴: 신규 문서에 비밀 없음. 코드의 `console.log('[wire]', …)` 는 정규화 이벤트(provider 중립, 비밀 미포함 — 0016)만 출력.
- 변동성/일회성/장문 코드설명서 혼입: 없음(설계 결정·인수 기준 중심).

## PHASES.md 정합성

- 형식/PR#/커밋 기재 확인: `PHASES.md` 페이즈 표 말미에 1행 추가(PR #95, 커밋 `878ef2b`). INDEX `0025` 행과 대상 커밋 일치.

## 결론 / 다음 단계

- 상태: **PASS** (round 1). 인수 기준 6/6 충족, 게이트(typecheck/lint/관련 test) 통과, 레이어 경계 0, 신규 의존성·IPC 채널 무변경.
- `npm run dev` 토글 실기(터미널 `[wire]` 출력)는 **사람 확인 대기**(헤드리스 환경이라 GUI 미실행).
- Next-Action: none (사용자 실기 확인 후 PR #95 머지).
