# Verify — 0102-transcript-virtualization

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0102-transcript-virtualization` |
| 검증자 | Claude Code |
| 일자 | 2026-07-14 |
| 대상 커밋 | `621b5f2` |
| 라운드 | 1 |
| 상태 | PASS (게이트/구조) + 런타임 사람 확인 대기 (환경 제약) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| #1 TranscriptView 가 스크롤 프레임에 깨어남 | 타당 — 단 memo(exchangeEquals) 자식 bail 로 비용 한정. 0008 델타(커밋 불변) 자체는 유지 | 매트릭스 #2 |
| #2 head absolute → pb 로 간격 | 타당 — 측정 높이에 포함돼 정합 | 매트릭스 #3 근거 |
| #3 ⚠️ 바닥 드리프트(TanStack 기본 보정 의존) | 타당 — 기계 검증 불가, 사람 실기로 이관 | 책임 분리표 UI/UX 행 |
| 블로커: electron 403 런타임 불가 | 타당 — 0019 verify 선례 동일 제약 | 게이트/책임 분리 명시 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 화면 밖 exchange 언마운트 | ⏳ 사람 실기 | 코드상 `virtualItems`(overscan 6)만 렌더 — `TranscriptView.tsx:84-110`. 실 DOM 언마운트는 electron dev 필요 |
| 2 | tail 앵커/예약공간/바닥추적 = 0008 동일 | ⏳ 사람 실기 | **구조적 보존**: tail 비가상 렌더가 `reserve={anchored}`·`pending={inflight}`·`min-h-[50cqh]` 유지(`:113-126`), `useScrollAnchor` 무변경. 무점프 실측은 사람 |
| 3 | 위로 스크롤 시 과거 행 위치·높이 복원 | ⏳ 사람 실기 | `measureElement` 실측 + TanStack 기본 보정. 겹침/빈칸 육안 확인 필요 |
| 4 | "맨 아래로"(showJump)·pin 회귀 없음 | ⏳ 사람 실기 | `useScrollAnchor`·`onScroll`·`scrollRef` 계약 무변경(`:64-68`) |
| 5 | 긴 세션 렌더 비용 감소 실측 | ⏳ 사람 실기 | 가상화 구조 도입 완료. DOM 노드수/rAF 실측은 dev 필요 |
| 6 | 레이어 경계 0 · 게이트 통과 | ✅ | lint 0·typecheck 3종 0·renderer 243/243. `features/chat` 내부만(hooks/·components/) — 경계 무영향 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | lint 0(경고 1 수용)·typecheck 0·renderer 243/243 |
| 인수 기준 ↔ 코드 대조(구조) | ✅ | 이견 시 중재 | #6 ✅, #1~5 구조 확인 |
| 레이어 경계 위반 0 | ✅ | — | features/chat 내부 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | `@tanstack/react-virtual` 사용자 승인 완료 |
| **런타임 동작(언마운트·앵커·스크롤)** | ✖ 환경 제약(electron 403) | ✅ **실기** | **사람 확인 대기** (인수 1~5) |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ npm run lint            → exit 0 (경고 1: react-hooks/incompatible-library — TanStack↔React Compiler, 오류 아님)
$ npm run typecheck       → exit 0 (node/web/test 3종)
$ npx vitest run src/renderer → 29 files, 243/243 passed
```

> `npm run dev`/`build`·전체 `npm test`(better-sqlite3 네이티브) 는 electron 바이너리 egress 403(환경 제약, INDEX 0019 verify 동일 베이스라인)으로 실행 불가. 런타임/시각 검증은 사람 몫.

## 위생 검토 (문서 변경)

- `docs/TRD.md §2` transcript 가상화 행 추가 · `app/AGENTS.md` 채택 목록에 `@tanstack/react-virtual@3` 기재 — 키/토큰/PII 혼입 없음.

## PHASES.md 정합성

- 승격 시 PHASES 행 추가 예정. INDEX.md `0102` → verify 갱신.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계: "head 가상화 + tail 비가상" 이 0008 보존의 핵심 — 구조로 계약을 지켰으나, TanStack 기본 바닥보정에 의존하는 부분(R1/R4)은 이 환경에서 실측 불가.
- 구현: 코드/게이트 완결. React Compiler 경고는 수용(라이브러리 특성).
- 검증: **런타임 검증을 에이전트가 대신할 수 없음** — 인수 1~5 는 electron dev 실행이 있어야 판정 가능. 이 환경의 근본 제약이라 사람 실기가 유일 경로(FAIL 아님 — 코드 결함 없음, 환경 제약).

## 결론 / 다음 단계

- 상태: **게이트/구조 PASS**. 런타임/시각 검증은 사람 실기 대기(환경 electron 403). 코드 결함 없음 → 재구현(FAIL) 아님.
- 사람 확인 시 우선순위: (1) 새 전송 앵커 무점프, (2) 스트리밍 fill 무점프, (3) 위 스크롤 후 과거 행 정합, (4) 긴 세션 DOM 노드수 감소.
