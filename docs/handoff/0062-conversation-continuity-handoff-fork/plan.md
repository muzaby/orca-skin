# Plan — 0062-conversation-continuity-handoff-fork

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0051 §A.4 **Conversation Continuity / Knowledge Curation**(Future 서비스 층) 의 잔여 구현 중 **handoff·fork 를 우선** 착지시키는 설계다. 0051 P0/P1 은 0052~0061 에서 전부 PASS 했고, `orchestration/` 이름은 0061 이 이 서비스용으로 예약해 두었다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0062-conversation-continuity-handoff-fork` |
| 작성자 | Claude Code |
| 일자 | 2026-07-02 |
| 매핑 | PHASES 행(Future Continuity 착수) / PR (요청 시) |
| 상태 | DRAFT → **READY** |
| 구현 주체 | **Codex** (기능 구현) |
| 선행 | `0050`(P0) · `0052~0061`(P1 전부 PASS) · 설계서 §A.4/§A.5 |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 51 구현" 중 잔여(§A.4 Continuity)에서 **handoff/fork 우선 구현**. | 라이브 세션(2026-07-02) |
| 명시 요구 | **handoff 배선** = 컨텍스트 사용 경고 시 컴포저에서 팝오버되는 경고창에 액션. 요약본은 **배경·컨텍스트·목표·드러난/잠재/미해결 이슈** 포함. | 라이브 세션 |
| 명시 요구 | **fork 배선** = 에이전트 답변 호버 시 뜨는 아이콘에 **분기 아이콘** 추가. | 라이브 세션 |
| 명시 요구 | 두 항목 모두 **버튼 클릭 = 뷰(DOM)만 생성**, DB·런타임 미생성. **보내기 확정 시에만** lazy 로 자원(DB 포함)을 순차 셋업하고 요약본(handoff)이 함께 주입·전송. **입력 전 취소 = 완전 no-op**("사용 안 함"). | 라이브 세션 |
| 명시 결정 | fork 컨텍스트 전달 = **SDK 네이티브 `forkSession`** 참조(`agent-sdk/sessions.md`). | 라이브 세션(사용자 지정) |
| 추론 의도 | 이 착지가 `orchestration/` 을 진짜 오케스트레이션(세션 간 인과 엮기)으로 재생성하는 첫 서비스이며, 후속 continuity(reseed·knowledge artifact)의 토대가 된다. | 설계자 해석 |

## Context (왜)

0051 §A.2 는 **오케스트레이션에 남는 유일한 것 = "Orca Session 을 가로질러 인과적으로 엮기" = handoff/fork/continuity** 로 좁혔고(동시성/자원은 라이프사이클), 0061 이 `src/main/orchestration/` 을 비우며 **이 이름을 Future continuity 서비스용으로 예약**했다(`app/src/main/AGENTS.md`). 지금 그 예약된 슬롯에 첫 서비스를 채운다.

- **handoff** = 컨텍스트 소진/과업 전환 시, 원 대화를 요약해 새 Orca Session 의 시드로 넘겨 대화를 잇는다(**요약 압축 = lossy**).
- **fork** = 원본을 잃지 않고 대체 방향을 시도(**SDK 네이티브 fork = 전체 맥락 lossless**).
- 두 기능의 공통 토대 = **DB lineage 영속화** + **파라미터화된 new-chat draft** + (handoff 만) **ownerless evaluation session**.

**핵심 불변식(§A.4)**: Runtime close ≠ Conversation close · 1 Orca Session : ≤1 user-facing SessionRuntime · 평가/요약은 원 대화를 오염시키지 않는 별도 ownerless 런타임에서. 여기에 사용자 요구로 **버튼 클릭 = DOM draft 뷰만, 물질화는 첫 보내기 확정에만**(취소=no-op)을 더한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 0051 P0/P1 전부 PASS, 잔여=§A.4 Continuity(코드 0). `orchestration/` 이름 예약. | `@docs/handoff/INDEX.md`(0061 행) · `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A.4/§A.5` · `app/src/main/AGENTS.md` |
| **SDK 네이티브 fork**: `query({ resume, forkSession:true })` → 원 이력 복사 새 세션, **모델이 전체 맥락 보유**, 새 `session_id` 는 `system/init` 에서 발급, 원본 불변. | `@docs/spec/claude/agent-sdk/sessions.md`(§대체 방안을 탐색하기 위해 포크하기) |
| 어댑터가 이미 `resume: sessionId` 를 query 옵션에 배선 → `forkSession` 을 나란히 추가만 하면 됨. `sessionId` 는 init(=session.updated)에서 갱신. | `app/src/main/adapters/claude.ts:286` · `:270-271` |
| **ownerless completion primitive 존재**: `RuntimeTitleAdapter.complete()` → `runCompletion()`. 선례 소비자 `TitleGenerator`(fire-and-forget·AbortController·30s·graceful degrade, **Supervisor 우회 = 원 대화 미오염**). | `app/src/main/adapters/claude.ts:204` · `app/src/main/lifecycle/ports.ts:32` · `app/src/main/ipc/chat/title-generation.ts` |
| `sessions` 테이블에 **lineage 컬럼 없음**. 세션행은 첫 턴 persist 시 **lazy 생성**(`insertSession`). | `app/src/main/db/migrations/0001_initial.sql` · `app/src/main/db/types.ts:23,142` · `app/src/main/ipc/chat/persist.ts:124` |
| fork display 복사 원본 = `db.loadParts(sessionId)`(message_idx→part_idx 정렬). 빈 세션은 `sessionLoad` 가 `null` 반환(→ 빈 세션행 조기생성 회피 근거). | `app/src/main/ipc/handlers/session.ts:33-36` · `app/src/main/db/types.ts:177` |
| **컨텍스트 경고 신호 존재**: `nearCompaction(used, window)`(유효 한계 = window−33k 의 83.5%). handoff 배선점. | `app/src/renderer/src/features/chat/lib/contextWindow.ts:16` |
| **호버 액션 배선점**: 에이전트 턴 메타(복사/시간)는 `AssistantTurn`/`MessageMeta` 가 턴 단위 렌더(본문 `AssistantMessage` 아님). 분기 아이콘은 여기. | `app/src/renderer/src/features/chat/components/transcript/AssistantMessage.tsx:15` (주석) · `.../AssistantTurn.tsx` · `.../MessageMeta.tsx` |
| 마이그레이션 규약 `NNNN_<name>.sql`·vite `?raw`·**머지분 수정 금지·새 파일만**. `foreign_keys=ON`. | `@app/AGENTS.md`(DB 정책) |
| main 레이어 DAG: 서비스=L1 domain(`orchestration/`), 핸들러=L3 ipc. 구체 engine 리터럴은 adapters/컴포지션 루트만(백엔드 중립, 0016). | `@app/src/main/AGENTS.md` |
| IPC 채널 총 40 → 변경 시 `IPC_CONTRACT.md` 동시 갱신(§6). | `@docs/IPC_CONTRACT.md` |

## 인수 기준 (Acceptance Criteria)

1. **`orchestration/` L1 재생성** — `orchestration/{evaluation-session,fork,handoff}.ts` 신설, 백엔드 중립(구체 engine 리터럴 0), `npm run lint` boundaries(L1↔L3) 위반 0·`import/no-cycle` 0.
2. **EvaluationSession primitive** — `TitleGenerator` 패턴 일반화(ownerless·`adapter.complete` 1-shot·AbortController+timeout·graceful degrade·**Supervisor cap 미회계**). 구조화 요약 프롬프트(**배경/컨텍스트/목표/드러난·잠재·미해결 이슈**). 단위테스트(프롬프트 조립·실패 degrade·cap 미회계).
3. **DB lineage** — `NNNN_session_lineage.sql`(`session_lineage`: child_session_id PK·parent_session_id·relation('handoff'|'fork')·fork_point_message_idx nullable·created_at, FK CASCADE) + `db/queries.ts` `insertLineage`/`getLineage`/`copyMessagesToSession(src,dst)` + 회귀 테스트.
4. **fork (SDK 위임)** — 에이전트 답변 호버에 **분기 아이콘**. 클릭 시 **DB·런타임 미생성**(캐시된 소스 transcript 를 draft 뷰에 읽기전용 표시). 보내기 시 어댑터 `forkSession`(=`resume: forkFrom` + `forkSession:true`) → SDK 새 id → 그 id 로 lazy 세션행 + `copyMessagesToSession`(display) + lineage(`fork`) + 첫 턴. **v1 = 전체 대화 분기**(SDK 는 전체 이력 fork). 미전송 draft 폐기 시 영속 0.
5. **handoff** — 컴포저 컨텍스트 경고 팝오버(`nearCompaction` 신호)에 "핸드오프" 액션. 클릭 시 `orchestration:summarizeForHandoff(sessionId)` → 요약을 컴포저 **편집가능 draft 로 스테이징** + 메타 `{handoffFrom}`. **DB·런타임 미생성.** 사용자 편집/추가 후 보내기 시 요약+입력 주입 전송 → lazy 세션행 + lineage(`handoff`). 미전송 draft 폐기 시 영속 0.
6. **IPC + 어댑터** — 신규 채널 `orchestration:summarizeForHandoff`(1) + `chat:send` 페이로드 `forkFrom?`/`handoffFrom?` 확장 + `TurnRequest.fork?` → `claude.ts` query `forkSession` 배선. `IPC_CONTRACT.md`·zod 동기화(채널 수 갱신).
7. **불변식 4종** — ① Runtime close ≠ Conversation close ② 1 Session : ≤1 user runtime ③ 요약=별도 ownerless EvaluationSession ④ 버튼 클릭=DOM draft 뷰만·물질화=첫 보내기 확정에만(취소=no-op) — 문서화 + 코드 반영. 게이트 lint/typecheck/test green.

## 범위 / 비범위

- **범위**: handoff + fork + 공통 토대(orchestration/ 재생성 · lineage DB · EvaluationSession) + 위 UX 배선(경고 팝오버 액션 · 호버 분기 아이콘 · 파라미터화 draft).
- **비범위(로드맵 후속 핸드오프)**: DB reseed cold-fallback(resume 실패 재구성, §A.5 Future) · 대화 종료/archive 평가 hook · knowledge artifact/KB entry store · lineage 시각화 UI · fork **점-분기**(특정 메시지 절단 — SDK 미지원) · evaluation-session cap 회계 재검토(현 미회계 채택).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **SDK `forkSession` 옵션**(이미 SDK 계약에 존재, `sessions.md`) — fork 컨텍스트를 SDK 에 위임(하네스=SDK 원칙). 어댑터 `resume` 배선(`claude.ts:286`) 재사용.
- **`adapter.complete`/`runCompletion`**(handoff 요약) — 기존 어댑터 표면.
- **기존 new-chat lazy draft 흐름**(`NEW_CHAT_KEY` draft → `persist.ts` 첫 턴 lazy `insertSession`) 을 파라미터화 확장.
- 전제: Orca sessionId = SDK session_id(같은 id 로 resume, `app/AGENTS.md` DB 정책). fork 는 SDK 가 **새 id** 를 발급 → 그 id 가 새 Orca Session id.
- **신규 의존성 0** — fork=SDK 옵션, 요약=기존 complete, 복사=기존 DB. (없음.)

## 설계

### A) `orchestration/` L1 서비스 층 (백엔드 중립)
- `orchestration/evaluation-session.ts` — **하중 primitive**. ownerless system runtime: 세션 히스토리 → 구조화 요약 프롬프트(배경/컨텍스트/목표/이슈) → `adapter.complete()` 1-shot, AbortController+timeout, 실패=graceful degrade. **Supervisor/SessionRuntime 우회**(원 대화 미오염) → §A.4 cap-회계 OQ 를 **미회계**로 해소(근거=`TitleGenerator` 선례가 이미 Supervisor 밖). handoff 전용.
- `orchestration/fork.ts` — **SDK 네이티브 fork 위임**. 보내기 시 어댑터 `query({ resume: sourceSessionId, forkSession:true })` → 모델 전체맥락 보유, SDK 새 id 발급. Orca 측 = (a) `copyMessagesToSession`(display/record) + (b) lineage(`fork`). 수동 reseed 불필요.
- `orchestration/handoff.ts` — fork 와 **다른 메커니즘**(요약 lossy). `EvaluationSession` 요약 → fresh 세션 + 요약 시드(첫 user 메시지) + lineage(`handoff`).

### B) DB lineage
- 신규 `session_lineage`(전용 테이블 — hot `sessions` 행 미오염). `insertLineage`/`getLineage`/`copyMessagesToSession`.

### C) IPC + 어댑터
- `orchestration:summarizeForHandoff(sessionId) → text`(pre-send, handoff 만).
- `chat:send` 페이로드 `forkFrom?`·`handoffFrom?` 추가(lineage/fork 트리거). fork 는 별도 pre-send 채널 불필요.
- `TurnRequest.fork?: boolean` → `claude.ts` query `forkSession`(현 `resume` 배선 옆).
- **보내기 순차 셋업**: `forkFrom` → 어댑터 fork query → SDK 새 id → lazy 세션행 + display 복사 + lineage. `handoffFrom` → fresh 세션(요약=첫 메시지) + lineage.

### D) 렌더러 (view-only draft → 보내기에 물질화)
- **handoff**: 컴포저 경고 팝오버(`nearCompaction`·TelemetryPanel/도넛 근처)에 액션 → `summarizeForHandoff` → new-chat draft 뷰 + 요약 프리필 + `{handoffFrom}`. DB·런타임 미생성.
- **fork**: `AssistantTurn`/`MessageMeta` 호버에 분기 아이콘 → 소스 in-memory parts 를 draft 뷰에 읽기전용 표시 + `{forkFrom}`. DB·런타임 미생성.
- 공통: 클릭=DOM draft 뷰만. DB·lineage·(fork)복사·SessionRuntime 은 첫 보내기 확정에만 lazy. **취소=no-op**(draft 뷰만 제거·영속 0).

### 재사용/경계
SDK `forkSession`(`sessions.md`) · 어댑터 `resume`(`claude.ts:286`) · `adapter.complete`/`TitleGenerator`(handoff) · `db.loadParts`/`insertSession`/마이그 패턴 · `contextWindow.nearCompaction` · 기존 `chat:send`/new-chat draft · `Supervisor.startNew`. 서비스=L1·핸들러=L3·어댑터 중립. **EvaluationSession=handoff 전용**(fork 는 LLM 무관).

### 구현 순서 권고 (staging)
foundation(lineage DB + 파라미터화 draft) → **fork**(SDK forkSession + display 복사, LLM 무관·저위험) → **handoff**(EvaluationSession 요약 + 컴포저 스테이징 + 경고 팝오버 배선).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **로딩**: handoff 요약 생성 중 팝오버/컴포저 로딩 상태(수 초 소요) + 취소 가능. 요약 실패 → 빈 draft + 토스트(graceful degrade).
- **취소/변심**: draft 뷰 생성 후 미입력 이탈 → draft 폐기(DB·런타임·텔레메트리 흔적 0). 다른 세션 전환/새 draft 시작 시 이전 미전송 draft 정리.
- **동시성/멀티세션**: fork/handoff draft 는 기존 멀티세션 draft(`chatStore.sessions` Record)와 동거. 소스 세션이 실행 중이어도 fork draft 생성은 무관(원본 불변, SDK fork 보장).
- **fork 경계**: SDK forkSession 은 전체 이력 fork(v1). display 복사도 소스 전체. 미완료 도구/부분 턴이 소스에 있으면 복사본도 그 상태(SDK 가 fork 시 처리; Orca display 는 `loadParts` 그대로).
- **테마/접근성**: 분기 아이콘 = 기존 호버 아이콘 톤/키보드 접근성 관례(복사 버튼) 따름. 경고 팝오버 액션 = 기존 팝오버 a11y 관례.
- **세션 재진입**: 물질화된 fork/handoff 세션은 일반 세션처럼 `sessionLoad`(복사/시드 메시지 표시). lineage 는 v1 표시 안 함(비범위).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **렌더러 "이력 있는 draft 뷰"** = 새 상태 변종(기존 빈 new-chat draft 보다 큼) — 최대 작업량 | fork draft 는 소스 캐시 parts 를 읽기전용 clone 으로 draft 엔트리에 실음. persist 무관(전송 전). 구현자 우선 리스크로 표기. |
| **handoff 요약 비용·지연** — 전체맥락 completion | 로딩/취소 UX + 모델 선택(OQ). 실패 degrade. |
| **fork 지점 정밀도** — SDK forkSession=전체 이력 | v1=전체분기(아이콘은 affordance). 점-분기(절단)는 SDK 미지원 → 비범위/후속. |
| **보내기 순차 셋업 부분 실패**(④런타임 실패 후 ①DB 행 존재) | 첫 턴 실패이므로 기존 new-chat 첫턴 에러 경로(0033/0038) 흡수. |
| Orca id ↔ SDK fork 새 id 정합 | fork 는 SDK init 새 id 를 새 Orca id 로 채택(첫 보내기에 물질화 — lazy 와 정합). resume 은 forkFrom(소스) 로만. |

- **단독 결정 금지 항목(Open Question)** → 사용자:
  - handoff 요약 **모델 선택**(저가 haiku vs 상위 모델·비용).
  - fork **점-분기** 지원 여부(후속·SDK 제약).
  - evaluation-session **cap 회계**(현 미회계 채택 — 재검토 시).

## 영향 받는 파일

- **신규(main L1)**: `app/src/main/orchestration/{evaluation-session,fork,handoff}.ts`(+ `.test.ts`).
- **신규(DB)**: `app/src/main/db/migrations/NNNN_session_lineage.sql`. **수정**: `app/src/main/db/queries.ts`·`db/types.ts`.
- **수정(IPC L3)**: `app/src/main/ipc/chat/{send,persist}.ts`(forkFrom/handoffFrom 물질화)·`ipc/handlers/` 또는 `ipc/chat/`(summarizeForHandoff 핸들러)·`src/shared/{ipc,protocol}.ts`(채널·zod).
- **수정(어댑터 L2)**: `app/src/main/adapters/claude.ts`(forkSession)·어댑터 타입(`TurnRequest.fork`).
- **수정(렌더러)**: `features/chat/components/composer/*`(경고 팝오버 액션)·`features/chat/components/transcript/{AssistantTurn,MessageMeta}.tsx`(분기 아이콘)·`features/chat/store/chatStore.ts`(파라미터화 draft·forkFrom/handoffFrom 메타)·아이콘.
- **문서**: `docs/IPC_CONTRACT.md`·`docs/GLOSSARY.md`(lineage/handoff/fork 용어 정합)·설계서 §A.4(착지 포인터).

## 참고 문서
- `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A.4/§A.5` · `@docs/spec/claude/agent-sdk/sessions.md` · `@docs/GLOSSARY.md` · `@docs/IPC_CONTRACT.md`(§6 변경 절차) · `@app/src/main/AGENTS.md`.

## 게이트
- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: EvaluationSession(프롬프트 조립·degrade·cap 미회계) · `session_lineage` queries(insert/get/copy) 회귀 · fork 물질화(forkSession 옵션 배선) · IPC zod 스키마.

## 설계 self-review 체크리스트 (READY 전)
- [x] 사용자 의도 — 라이브 세션 요구(UX 배선·타이밍·취소=no-op·SDK fork 지정)를 출처로 인용, 추론 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`@docs/…`·`파일:라인`·SDK 미러).
- [x] 인수 기준 — 7개 번호·검증 가능.
- [x] 의존 기술 — SDK forkSession·complete·기존 draft 흐름 식별, 신규 의존성 0 명시.
- [x] 파생 UX — 로딩/취소/동시성/fork 경계/테마·a11y/재진입 펼침.
- [x] 리스크 — draft 뷰 상태·요약 비용·fork 정밀도·부분 실패·id 정합 + Open Question(모델·점분기·cap) 분리.
