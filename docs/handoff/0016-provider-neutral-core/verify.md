# Verify — 0016-provider-neutral-core

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 구현 주체 = Claude(비기능 직접 구현)라 plan→impl→verify 를 Claude 가 순차 수행.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0016-provider-neutral-core` |
| 검증자 | Claude Code |
| 일자 | 2026-06-14 |
| 대상 커밋 | `99469df` |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `provider` 필드를 모든 NormalizedEvent variant 에서 제거, 코어·렌더러 어디서도 `ev.provider` 미독 | ✅ | `shared/ipc.ts:198-272`(11 variant 전부 provider 없음). typecheck 통과 = `ev.provider` 사용처 0(있으면 컴파일 에러). |
| 2 | `claude-map.ts` 매퍼가 provider 미설정 | ✅ | `claude-map.ts`(session.updated·message.*·tool.*·telemetry 전부 provider 없음), `MapContext` 에서 `provider` 필드 제거(`claude-map.ts:20-22`). `claude-map.test.ts` 기대값 갱신. |
| 3 | send.ts error 이벤트·`makeClassifiedError` 가 리터럴 미사용, 어댑터 있으면 `adapter.id`·없으면 생략. `ClassifiedError.provider` optional | ✅ | `send.ts`: catch 블록 `classify(err, { provider: adapter.id, … })`(`send.ts:284`), 6 이벤트 provider 제거. `classifier.ts:13-16` `ClassifyContext.provider?`. `ipc.ts:128-134` `ClassifiedError.provider?`. |
| 4-bis | 세션-이전 에러(schema_validation·활성 백엔드 없음)는 이벤트·ClassifiedError 모두 provider 부재, 주석 명시 | ✅ | `send.ts` 첫 3 에러 분기 — provider 없음 + "세션-이전 에러(0016)" 주석. |
| 4 | persist `insertSession.backend` = 턴 어댑터 id, 합성 이벤트 provider 제거 | ✅ | `persist.ts:91` `backend: turn.titleAdapter.id`(+주석), `persist.ts:70-77` 합성 tool.call.completed provider 없음. |
| 5 | chatStore `lastBackend` 리터럴 제거, OQ7 주석 제거 | ✅ | `chatStore.ts:190-197` — `settingsApi.set({ lastSessionId })` 만, OQ7 주석 제거. backend store 소관으로 위임(레이어 경계상 chat→backend import 불가하므로 write 자체 제거; lastBackend 는 현재 read 0 = 무회귀). |
| 6 | 구체 provider 리터럴이 비-테스트 소스에서 adapters/capabilities/mock/router 밖 0 | ✅(carve-out) | 코어/오케스트레이터(`ipc/**`)·`shared/ipc.ts`(비-타입)·chat store grep 0. 잔존 분류는 아래 §불변식 grep. |
| 7 | IPC_CONTRACT 동기화 | ✅ | `IPC_CONTRACT.md` §3(공통필드 `sessionId`·provider 제거 노트) + §4(`ClassifiedError.provider?` optional + 세션-이전 부재). 채널 수 36 불변. |
| 8 | 게이트 통과 + 테스트 갱신 | ✅ | lint/typecheck/test(375)/build 전부 통과(아래). 갱신 테스트: claude-map·mock-scenarios·claude-classifier·permission-bridge·renderer chat 7파일. |

## 불변식 grep (인수 6 — 코어 스코프 0, 잔존 분류)

```
$ grep -rn "'claude-code'\|'opencode'" src/main/ipc src/shared/ipc.ts \
        src/renderer/src/features/chat/store --include="*.ts" | grep -v ".test."
src/main/ipc/router.ts:74,79,85   # 부팅 배선(컴포지션 루트, plan 명시 허용)
src/shared/ipc.ts:93,143          # Backend/ProviderId 타입 정의(리터럴 SSOT)
# send.ts / persist.ts / context.ts / chatStore.ts = 0
```

전체 비-테스트 잔존 = 모두 허용/carve-out:
- **허용(구조)**: `adapters/**`(claude-code·claude-adapt·mock·mock-scenarios), `capabilities/claude-probe.ts`, `deploy/conformance.ts`(엔진→conformance 레지스트리), `extensions/hooks.ts`(backendSpecific 타입), `router.ts`(부팅), `shared/ipc.ts`·`protocol.ts`(타입 정의).
- **carve-out(사용자 결정 — '기본 백엔드' Open Question)**: `renderer/features/backend/**`(backendStore·InstallerDialog), `chat/components/Composer.tsx`(adapter 폴백), `chat/reducer/chatReducer.ts:184`(state.backend — reducer 는 원래도 `ev.provider` 미독·하드코딩), `shared/ui/Avatar.tsx`(AvatarKind). 모두 이벤트 provider 태깅이 아닌 단일-백엔드 UI 가정.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 전부 PASS |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 |
| 레이어 경계 위반 0 | ✅ | — | lint boundaries PASS(chat→backend 미발생 — write 제거로 회피) |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT·plan 갱신 |
| 기준 6 carve-out 범위 | ✖ 보조 | ✅ 결정 | 사용자 "코어/오케스트레이터만" 결정 반영 |
| '기본 백엔드' Open Question | ✖ | ✅ | 렌더러 단일-백엔드 리터럴은 후속 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기(채팅 회귀) |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test && npm run build
lint       ✅ (eslint --cache --fix, error 0)
typecheck  ✅ (tsc node + web)
test       ✅ Test Files 50 passed / Tests 375 passed
build      ✅ electron-vite build (out/ 산출)
```

> better-sqlite3 네이티브 ABI: `postinstall`(electron-builder install-app-deps)이 Electron ABI 로 빌드해 vitest(Node)에서 `db/queries.test.ts` 9건이 self-register 실패한다(0007/0009/0010 동일 환경 이슈, 변경 무관). `npm rebuild better-sqlite3`(Node ABI)로 전체 375 green 확인.

## PHASES.md 정합성

- INDEX 0016 행 plan/READY → verify/PASS, 대상 커밋 `99469df` 기재.
- PHASES "구조 견고화(provider 중립)" 행 승격.

## 결론 / 다음 단계

- **상태: PASS** (인수 8/8 + 4-bis). PHASES 승격.
- 사람 확인 대기: 채팅 GUI 회귀(에러 카드·권한 카드·세션 생성 시 backend 표기) 시각 검증.
- 다음: 0017 (main 레이어 경계) 착수 — 선행(0016) 충족.
