# Plan — 0070-drop-hook-wire-tap

> 0069 후속 정리(`/simplify`). 0068 이 심은 wire 계측 중 목적이 종결된 훅 tap 제거. 비기능(정리) = Claude 직접 plan→impl→verify.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0070-drop-hook-wire-tap` |
| 작성자 | Claude Code |
| 일자 | 2026-07-05 |
| 매핑 | PHASES 행 (0068·0069 후속 정리) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify` — "bugfix 해결 과정의 실험적 구현을 제거하라 / 반드시 필요한 코드만 남겨라 / 구조적 결함을 없애라" (핸드오프 0066~0069 범위) | 라이브 세션(2026-07-05) |
| 추론 의도 | 목적이 종결된 *일회성 실측 장치* 를 제거하되, 아직 열린 검증에 쓰이는 진단은 남긴다 | (추론 — "필요한 코드만" 의 경계) |

## Context (왜)

0068 은 echo↔훅 Open Question 판정을 위해 **wire 계측 2점**을 심었다: ① coordinator 의 `input.echo` 로그, ② `makeHookWireTap()` — `UserPromptSubmit`/`PostToolBatch` 훅에 관측 콜백을 달아 발화 여부·payload 키·순서를 로깅. 이 tap 의 판정 목적은 둘뿐이었다: (a) push 프롬프트에 `UserPromptSubmit` 이 발화하는가, (b) 훅↔echo↔스트림 순서.

**0069 가 이 OQ 를 종결**했다(`0069/plan.md` 자료조사: "UserPromptSubmit hook input keys = … uuid 부재, 발화 위치 session.updated 이전", verify: "0068 OQ … 본 구현으로 종결"). tap 의 두 질문이 모두 확정됐으므로 tap 은 목적을 다한 실험 잔재다. 그런데도 **매 턴 세션 hook 설정에 콜백을 등록**한다(0068 리스크 표: "훅 tap 이 모든 턴에 등록됨").

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| tap 은 관측 전용 — 항상 `{}` 반환, 판정/주입 무개입 | `adapters/claude-adapt.ts:161` (제거 전) |
| tap 의 유일 소비처는 claude.ts 어댑터 배선 1곳 — 테스트/타 모듈 참조 0 | grep `makeHookWireTap` → `claude.ts:38·349` 뿐 |
| tap 제거 후 `wireLog` import 는 claude-adapt 에서 고아 | `claude-adapt.ts:33` |
| `HookCallback` 타입은 tap 외 3곳에서 계속 사용 — import 유지 | `claude-adapt.ts:143·225·332` |
| `input.echo` 로그는 renderer 미전달이라 일반 `[wire]` 스트림에 미포착 — steer echo 진단의 유일 창 | `turn-coordinator.ts:208-211`, 0069 실기 회귀 대기 목록 "steer echo 승격" |
| `wire-log.ts` 모듈은 send.ts(0025 디버그 패널)가 계속 소비 | `infra/ipc/send.ts:14·20` |

## 인수 기준 (Acceptance Criteria)

1. `makeHookWireTap` 함수(claude-adapt) + 어댑터 배선(claude.ts import·`mergeHooks` 인자) 제거.
2. 고아가 된 `wireLog` import(claude-adapt) 제거. `HookCallback` import 는 잔존 사용처 때문에 유지.
3. 동작 불변 — tap 은 관측 전용(`{}` 반환)이라 훅 병합 결과·턴 동작에 영향 0.
4. 남길 것 불변: `input.echo` 로그(steer echo 진단)·`wire-log.ts`·0025 디버그 패널 토글.
5. 게이트: lint 0 · typecheck 3종 0 · vitest(영향 스위트 green) · 신규 의존성·IPC·renderer 변경 0.

## 범위 / 비범위

- **범위**: `adapters/claude-adapt.ts`·`adapters/claude.ts`.
- **비범위**: `input.echo` 로그 제거(진단 가치·열린 검증), `wire-log.ts` 인라인 되돌리기(send.ts 소비 중).

## 설계

- claude-adapt: `makeHookWireTap` 함수 블록 + `wireLog` import 삭제.
- claude.ts: import 목록에서 `makeHookWireTap` 제거 + `withPostCompactHook(mergeHooks(…, makeHookWireTap()))` 의 마지막 인자·주석 제거.

## 리스크 / 트레이드오프

| 리스크 | 완화책 |
|---|---|
| 훅 발화 재관측이 향후 필요해질 수 있음 | git 이력에 tap 구현 보존 — 필요 시 되살림. 현 시점 두 판정 질문은 확정 종결(0069). |

## 영향 받는 파일

- `app/src/main/adapters/claude-adapt.ts`
- `app/src/main/adapters/claude.ts`

## 게이트

- `cd app && npm run lint && npm run typecheck && npx vitest run && npm run build`

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — `/simplify` 인용, 남김/제거 경계 추론 표기.
- [x] 자료조사 — 소비처·고아 import·잔존 사용처 grep 근거.
- [x] 인수 기준 — 5건, 검증 가능.
- [x] 의존 기술 — 신규 의존성 0.
- [x] 리스크 — 재관측 필요 시 git 복원.

---

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `adapters/claude-adapt.ts`(tap 함수+`wireLog` import 제거) · `adapters/claude.ts`(import·배선 제거) |
| 게이트 결과 | lint ✅ 0 / typecheck ✅ 3종 0 / test ✅ 영향 스위트 59/59(claude-adapt·turn-coordinator) — DB 3스위트 실패는 사전존재 better-sqlite3 ABI(NODE_MODULE_VERSION 140↔127, dev 앱 바이너리 잠금) 로 본 변경 무관 |
| 블로커 / 역질문 | 없음 |
