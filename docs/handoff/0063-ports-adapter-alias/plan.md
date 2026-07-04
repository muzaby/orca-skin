# Plan — 0063-ports-adapter-alias

> 0062 후속(비기능 = Claude 직접 plan→impl→verify). `contracts/ports.ts` 의 `Runtime*` 타입이 adapters 의 ports&adapters 정본(`LiveTurn`·`SessionAdapter`·`CompleteRequest`)을 구조적으로 재선언하던 중복을 제거한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0063-ports-adapter-alias` |
| 작성자 | Claude Code |
| 일자 | 2026-07-04 |
| 구현 주체 | Claude (비기능) |
| 매핑 | 0062 이연 항목(비-AC) 정리 / PHASES |

## 배경 / 의도

0062 는 `contracts/ports.ts` 의 `Runtime*` 표면 중복 통합을 "의미적 타입 변경 리스크"로 이연했다. 조사 결과: 중복 중 상당수가 **순수 재선언**(같은 필드를 두 번 씀)이나, `RuntimeLiveTurn`(=`LiveTurn`+거버넌스 훅)과 `RuntimeSessionAdapter`(=`SessionAdapter` 의 **턴 실행 부분집합**)는 **의미가 있는 구분**이다. 후자를 정확히 보존하면서 재선언 본문만 제거한다.

## 인수 기준

1. `contracts/ports.ts` 가 `LiveTurn`·`SessionAdapter`·`CompleteRequest` 필드를 재선언하지 않는다(adapters/types 를 alias/extends 로 재사용).
2. `RuntimeLiveTurn` = `LiveTurn` + 거버넌스 훅(`markAborted?`·`cancelled?`·`timedOut?`) — raw `LiveTurn` 대입 가능(선택 필드).
3. `RuntimeSessionAdapter` 는 **턴 실행 부분집합**(`id`·`complete`·`sendMessage`·`classifyError`)만 요구 — 설치 수명주기(`describe`·`isInstalled`·`install`) 비의존(Interface Segregation 보존, mock 4-메서드 어댑터 여전히 만족).
4. `SessionRuntime.live` 는 raw `LiveTurn` 타입(거버넌스 3종은 SessionRuntime 자신이 소유).
5. 게이트 lint/typecheck(node+web+test)/test/build green, 동작·IPC·renderer diff 0.

## 설계

- `RuntimeLiveTurn extends LiveTurn { markAborted?; cancelled?; timedOut? }`.
- `RuntimeCompleteRequest = CompleteRequest`, `RuntimeTitleAdapter = Pick<SessionAdapter,'id'|'complete'>`, `RuntimeSessionAdapter = Pick<SessionAdapter,'id'|'complete'|'sendMessage'|'classifyError'>`.
- `ManagedRuntime extends RuntimeLiveTurn` (state·reusable 추가) — 유지.
- `session-runtime.ts`: `this.live: RuntimeLiveTurn` → `LiveTurn`(raw 핸들 정확화).
- contracts→adapters 는 boundaries 허용, import/no-cycle 무순환(adapters 는 contracts 미참조).

## 리스크

- 되돌리기 쉬움(타입 alias). 유일 리스크=Interface Segregation 파괴였고 typecheck(session-runtime.test mock)로 즉시 검출→`Pick` 부분집합으로 해소(구현 중 확인).

---

> **[구현자 기입]**

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `contracts/ports.ts`(51→34 LoC) · `features/sessions/session-runtime.ts`(live 타입) |
| 게이트 | lint ✅ / typecheck ✅ / test **640** ✅ / build ✅ |
| 발견/대응 | `RuntimeSessionAdapter = SessionAdapter`(전체) 로 잡았다가 `session-runtime.test` mock(4-메서드)이 `describe/isInstalled/install` 누락으로 typecheck 실패 → **narrower port** 임이 드러나 `Pick<…4종>` 로 정정. 인수 3(Interface Segregation)이 이 검출로 확증됨. |
| 커밋 | `b57e7ae` |
