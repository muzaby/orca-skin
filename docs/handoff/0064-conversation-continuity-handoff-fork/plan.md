# Plan — 0064-conversation-continuity-handoff-fork

> **번호·경로 이력 (2026-07-04 포팅)**: 본 핸드오프는 브랜치 `claude/handoff-62-feedback-tp8t9j` 에서 번호 **0062** 로 설계·구현(r1~r5)됐으나, 그 사이 main 이 0062(`main-feature-slices` — main 프로세스 신구조 재편)·0063 을 선점해 **0064 로 재번호**하고 최종 상태(r5)를 신구조로 이식했다. 본문 속 구(pre-재편) 경로는 다음으로 읽는다: `db/` → `infra/db/` · `ipc/chat/persist.ts` → `features/history/writer.ts`(도착 물질화는 `ContinuityArrivalHook` 구조적 포트로 주입, 배선=`app/bootstrap.ts`) · `ipc/chat/send.ts` → `app/chat-turn.ts` · `orchestration/` → `features/orchestration/` · `lifecycle/turn-context.ts` → `contracts/turn.ts` · `TurnPersistence` → `HistoryWriter` · `InflightTurn` → `TurnContext`.
>
> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0051 §A.4 **Conversation Continuity / Knowledge Curation**(Future 서비스 층) 의 잔여 구현 중 **handoff·fork 를 우선** 착지시키는 설계다. 0051 P0/P1 은 0052~0061 에서 전부 PASS 했고, `orchestration/` 이름은 0061 이 이 서비스용으로 예약해 두었다.
>
> **개정 r2 (2026-07-02)**: 사용자 정정으로 **handoff 메커니즘을 전면 교체** — "출발 세션에서 요약 생성 → 컴포저 스테이징 → 주입" 방식 폐기, **hermes rebind 방식**(fork 로 전체 맥락 전달 + 도착 세션이 `/compact` 로 요약 생성) 채택. fork 설계는 무변경.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0064-conversation-continuity-handoff-fork` |
| 작성자 | Claude Code |
| 일자 | 2026-07-02 (r2 개정 동일) |
| 매핑 | PHASES 행(Future Continuity 착수) / PR (요청 시) |
| 상태 | DRAFT → READY → **READY (r2 개정)** |
| 구현 주체 | **Codex** (기능 구현) |
| 선행 | `0050`(P0) · `0052~0061`(P1 전부 PASS) · 설계서 §A.4/§A.5 |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 51 구현" 중 잔여(§A.4 Continuity)에서 **handoff/fork 우선 구현**. | 라이브 세션(2026-07-02) |
| ~~명시 요구~~ **(r2 폐기)** | ~~handoff 배선 = 컨텍스트 경고 팝오버 액션 → 요약(배경·컨텍스트·목표·이슈) 컴포저 스테이징~~ | 라이브 세션 → **r2 정정으로 supersede** |
| **명시 정정 (r2)** | **hermes-agent 동작방식 채택**: handoff 버튼 클릭 시 **새 세션이 즉시 생성**되고, **사용자 발화(핸드오프 사실 명시 + "이전 턴에서 뭐 했는지 요약하라" 프롬프트)가 자동생성되어 query 전송**. 자동생성 메시지 문안은 plan 확정 전 사용자에게 제안·승인. | 라이브 세션(2026-07-02, 정정) |
| **명시 확정 (r2)** | 자동생성 사용자 발화 앞에 **`/compact` 배치** — SDK 슬래시 명령으로 전송. | 라이브 세션(사용자 지정, `@docs/spec/claude/agent-sdk/slash-commands.md` 참조 지시) |
| **명시 확정 (r2)** | handoff 컨텍스트 전달도 **SDK `forkSession` 사용 확인**. | 라이브 세션(사용자 확인) |
| 명시 요구 | **fork 배선** = 에이전트 답변 호버 시 뜨는 아이콘에 **분기 아이콘** 추가. | 라이브 세션 |
| 명시 요구 (fork 한정, r2 조정) | fork 는 **버튼 클릭 = 뷰(DOM)만 생성**, 보내기 확정 시에만 lazy 물질화, 취소=no-op. **handoff 는 r2 정정으로 클릭=즉시 물질화**로 분리. | 라이브 세션 |
| 명시 결정 | fork 컨텍스트 전달 = **SDK 네이티브 `forkSession`** 참조(`agent-sdk/sessions.md`). | 라이브 세션(사용자 지정) |
| 추론 의도 | 이 착지가 `orchestration/` 을 진짜 오케스트레이션(세션 간 인과 엮기)으로 재생성하는 첫 서비스이며, 후속 continuity(reseed·knowledge artifact)의 토대가 된다. | 설계자 해석 |

## Context (왜)

0051 §A.2 는 **오케스트레이션에 남는 유일한 것 = "Orca Session 을 가로질러 인과적으로 엮기" = handoff/fork/continuity** 로 좁혔고(동시성/자원은 라이프사이클), 0061 이 `src/main/orchestration/` 을 비우며 **이 이름을 Future continuity 서비스용으로 예약**했다(`app/src/main/AGENTS.md`). 지금 그 예약된 슬롯에 첫 서비스를 채운다.

- **handoff (r2)** = 컨텍스트 소진/과업 전환 시 대화를 새 Orca Session 으로 잇는다. 메커니즘 = **fork(전체 맥락 lossless) + 도착 세션 첫 메시지로 `/compact`**(SDK 네이티브 압축이 지시문 구조대로 요약 → 도착 세션은 **요약된 작은 컨텍스트로 시작**). 요약 생성 주체 = 도착 세션(hermes rebind 계보), 요약 엔진 = Claude Code 네이티브 compaction — **Orca 자체 요약 파이프라인 불요**.
- **fork** = 원본을 잃지 않고 대체 방향을 시도(**SDK 네이티브 fork = 전체 맥락 lossless**).
- 두 기능의 공통 토대 = **DB lineage 영속화** + **SDK forkSession 어댑터 배선**.

**핵심 불변식(§A.4, r2 분리)**: Runtime close ≠ Conversation close · 1 Orca Session : ≤1 user-facing SessionRuntime · **fork 는** 버튼 클릭=DOM draft 뷰만·물질화=첫 보내기 확정에만(취소=no-op) · **handoff 는 클릭=즉시 물질화**(세션 생성+자동 query — 사용자 정정) · 실패 시 출발 세션 무변경(fork 특성상 자동 보장).

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 0051 P0/P1 전부 PASS, 잔여=§A.4 Continuity(코드 0). `orchestration/` 이름 예약. | `@docs/handoff/INDEX.md`(0061 행) · `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A.4/§A.5` · `app/src/main/AGENTS.md` |
| **SDK 네이티브 fork**: `query({ resume, forkSession:true })` → 원 이력 복사 새 세션, **모델이 전체 맥락 보유**, 새 `session_id` 는 `system/init` 에서 발급, 원본 불변. | `@docs/spec/claude/agent-sdk/sessions.md`(§대체 방안을 탐색하기 위해 포크하기) |
| **SDK 슬래시 명령**: 프롬프트 문자열에 포함해 일반 텍스트처럼 전송. `/compact` = 대화 기록 압축(중요 컨텍스트 보존 요약), 완료 시 `system/compact_boundary`(`compact_metadata.pre_tokens`/`trigger`) 발행. 사용 가능 명령은 `system/init.slash_commands` 에 나열. | `@docs/spec/claude/agent-sdk/slash-commands.md` |
| **`compact_boundary` 는 현재 어댑터가 드롭** — "Phase 3 미사용" 주석과 함께 빈 배열 반환. handoff 첫 턴 표시를 위해 정규화 필요. | `app/src/main/adapters/claude-map.ts:367` |
| 어댑터가 이미 `resume: sessionId` 를 query 옵션에 배선 → `forkSession` 을 나란히 추가만 하면 됨. `sessionId` 는 init(=session.updated)에서 갱신. | `app/src/main/adapters/claude.ts:286` · `:270-271` |
| `sessions` 테이블에 **lineage 컬럼 없음**. 세션행은 첫 턴 persist 시 **lazy 생성**(`insertSession`). | `app/src/main/db/migrations/0001_initial.sql` · `app/src/main/db/types.ts:23,142` · `app/src/main/ipc/chat/persist.ts:124` |
| fork display 복사 원본 = `db.loadParts(sessionId)`(message_idx→part_idx 정렬). 빈 세션은 `sessionLoad` 가 `null` 반환(→ 빈 세션행 조기생성 회피 근거). | `app/src/main/ipc/handlers/session.ts:33-36` · `app/src/main/db/types.ts:177` |
| **컨텍스트 경고 신호 존재**: `nearCompaction(used, window)`(유효 한계 = window−33k 의 83.5%). handoff 배선점. 컨텍스트 도넛 Tier2 팝오버 = `StatusPopover`(0006). | `app/src/renderer/src/features/chat/lib/contextWindow.ts:16` · `.../composer/StatusPopover.tsx` |
| **호버 액션 배선점**: 에이전트 턴 메타(복사/시간)는 `AssistantTurn`/`MessageMeta` 가 턴 단위 렌더(본문 `AssistantMessage` 아님). 분기 아이콘은 여기. | `app/src/renderer/src/features/chat/components/transcript/AssistantMessage.tsx:15` (주석) · `.../AssistantTurn.tsx` · `.../MessageMeta.tsx` |
| SDK 메시지 실측 도구: 디버그 패널 wire log 토글(`[wire] <type>` 터미널 출력). `/compact` 실행 시 실제 메시지 시퀀스(요약 텍스트가 어느 메시지에 실리는지) 확인용. | `@docs/handoff/INDEX.md`(0025 행) |
| 마이그레이션 규약 `NNNN_<name>.sql`·vite `?raw`·**머지분 수정 금지·새 파일만**. `foreign_keys=ON`. | `@app/AGENTS.md`(DB 정책) |
| main 레이어 DAG: 서비스=L1 domain(`orchestration/`), 핸들러=L3 ipc. 구체 engine 리터럴은 adapters/컴포지션 루트만(백엔드 중립, 0016). | `@app/src/main/AGENTS.md` |
| IPC 채널 총 40 → 변경 시 `IPC_CONTRACT.md` 동시 갱신(§6). | `@docs/IPC_CONTRACT.md` |
| (r1 이력) hermes handoff = rebind(전체 transcript 재로드) + 도착 에이전트가 첫 응답으로 요약 + 합성 지시문(`[...]` 마커·`{title}` 폴백). r2 가 이 계보를 채택. | `@docs/etc/study/hermes-agent/` · 사용자 제공 `/compact` 명세서(2026-07-02 첨부) |

## 자동생성 메시지 (확정 문안 — 사용자 승인, r2)

고정 템플릿(코드 하드코딩, main 단일 출처). 동적 값은 `{title}` 하나 — 출발 세션 제목, 없으면 session id 앞 8자 폴백(hermes `cli_title` 규칙 차용).

```
/compact [핸드오프] 이 세션은 이전 세션 "{title}"에서 핸드오프로 이어졌다.
이전 대화의 전체 이력이 이 세션의 컨텍스트에 로드되어 있다. 이전 대화에서
무엇을 했는지 다음 구조를 보존해 압축 요약하라: ① 배경·컨텍스트 ② 목표
③ 확정된 결정·제약 ④ 드러난/잠재/미해결 이슈 ⑤ 다음 단계(1개).
파일 경로·식별자·에러 메시지·확정 코드 조각·정확한 수치는 원문 그대로 보존한다.
```

- `/compact` 뒤 텍스트 = 압축 지시문(요약 구조 + verbatim 보존 규칙 — 사용자 확정 4항목 유지 + 결정·제약/다음 단계 보강).
- `[핸드오프]` 마커 = 사용자 발화가 아닌 시스템 생성임을 transcript 에서 식별(hermes `[...]` 마커 차용).

## 인수 기준 (Acceptance Criteria)

1. **`orchestration/` L1 재생성** — `orchestration/{fork,handoff}.ts` 신설, 백엔드 중립(구체 engine 리터럴 0), `npm run lint` boundaries(L1↔L3) 위반 0·`import/no-cycle` 0.
2. **handoff 자동 메시지 템플릿** — 위 확정 문안을 `handoff.ts` 의 순수 함수(`{title}` 보간 + id 폴백)로 구현, 단위 테스트(보간·폴백·`/compact` 접두 불변).
3. **DB lineage** — `NNNN_session_lineage.sql`(`session_lineage`: child_session_id PK·parent_session_id·relation('handoff'|'fork')·fork_point_message_idx nullable·created_at, FK CASCADE) + `db/queries.ts` `insertLineage`/`getLineage`/`copyMessagesToSession(src,dst)` + 회귀 테스트.
4. **fork (SDK 위임)** — 에이전트 답변 호버에 **분기 아이콘**. 클릭 시 **DB·런타임 미생성**(캐시된 소스 transcript 를 draft 뷰에 읽기전용 표시). 보내기 시 어댑터 `forkSession`(=`resume: forkFrom` + `forkSession:true`) → SDK 새 id → 그 id 로 lazy 세션행 + `copyMessagesToSession`(display) + lineage(`fork`) + 첫 턴. **v1 = 전체 대화 분기**(SDK 는 전체 이력 fork). 미전송 draft 폐기 시 영속 0.
5. **handoff (rebind 방식, r2)** — 핸드오프 액션 클릭 시 **즉시**: main 이 자동 메시지 조립(기준 2) → `forkSession` 첫 턴 전송(첫 프롬프트 = 자동 메시지) → SDK init 새 id 로 lazy 세션행 + lineage(`handoff`) → 렌더러 새 세션 전환, transcript = 자동 메시지 + 압축 결과. **display 복사 없음**(fork 와의 차이 — 모델 컨텍스트만 전체 이력 보유, 원문은 출발 세션에서 확인). 출발 세션 무변경.
6. **compact_boundary 정규화** — `system/compact_boundary` 를 NormalizedEvent 로 정규화(신규 variant 또는 status 계열)해 렌더러가 압축 완료를 표시. **구현 선행 작업**: wire log(0025)로 `/compact` 실측 메시지 시퀀스(요약 텍스트 위치 포함) 확인 후 variant 형태 확정, `IPC_CONTRACT.md` §3 동기화.
7. **IPC + 어댑터** — `chat:send` 페이로드 `forkFrom?`/`handoffFrom?` 확장 + `TurnRequest.fork?` → `claude.ts` query `forkSession` 배선. 신규 invoke 채널 0(총 40 유지). 자동 메시지 본문은 main 조립 — 렌더러 transcript 표시는 send ack 회신 또는 user-message 이벤트로(구현자 재량, 템플릿 단일 출처는 main). `IPC_CONTRACT.md`·zod 동기화.
8. **트리거/가드** — StatusPopover(컨텍스트 도넛)에 핸드오프 액션 **상시 노출** + `nearCompaction` 시 경고 강조. 가드 3종: mid-turn 거부(소스 세션 턴 진행 중이면 액션 비활성/거부) · 사용자 턴 2회 미만 세션 제외 · 중복 실행 방지(진행 중 재클릭 무시).
9. **불변식 + 게이트** — ① Runtime close ≠ Conversation close ② 1 Session : ≤1 user runtime ③ fork: 클릭=DOM draft 뷰만·물질화=첫 보내기(취소=no-op) ④ handoff: 클릭=즉시 물질화(사용자 정정) ⑤ 실패 시 출발 세션 무변경 — 문서화 + 코드 반영. 게이트 lint/typecheck/test green.

## 범위 / 비범위

- **범위**: handoff(rebind 방식) + fork + 공통 토대(orchestration/ 재생성 · lineage DB · forkSession 배선) + UX 배선(StatusPopover 상시 액션 + 경고 강조 · 호버 분기 아이콘 · fork draft 뷰) + compact_boundary 정규화.
- **비범위(로드맵 후속 핸드오프)**: DB reseed cold-fallback(resume 실패 재구성, §A.5 Future) · 대화 종료/archive 평가 hook · knowledge artifact/KB entry store · lineage 시각화 UI · fork **점-분기**(특정 메시지 절단 — SDK 미지원) · **Orca 자체 요약 파이프라인(EvaluationSession)** — r2 로 handoff 용도 소멸, 후속 continuity(archive 평가 등)에서 필요 시 재도입 · 컴포저 `/compact` 직접 입력 지원(사용자가 컴포저에 슬래시 명령을 치는 경로 — 별도 기능).

### r2 폐기 요소 (이력)

r1 설계의 다음 요소는 사용자 정정으로 폐기한다: EvaluationSession 요약 파이프라인(handoff 용도) · HD(Handoff Document) 스키마/검증/재생성 · `orchestration:summarizeForHandoff` IPC 채널 · 컴포저 요약 스테이징 · systemPromptAppend 주입. 첨부 `/compact` 명세서의 압축(HD) 계통(§5·§7·§8)은 "출발 세션에서 요약을 생성해야 하는 컨텍스트 고갈" 전제였으나, **fork + SDK 네이티브 `/compact`** 조합이 같은 목표(도착 세션의 컨텍스트 여유)를 SDK 기능으로 달성하므로 비채택. 명세서의 트리거(§6)·가드(§6.2)·실패 시 원 세션 보존(§9) 원칙만 채택.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **SDK `forkSession` 옵션**(`sessions.md`) — fork·handoff 공통 컨텍스트 전달(하네스=SDK 원칙). 어댑터 `resume` 배선(`claude.ts:286`) 재사용. **사용자 확인 완료(r2)**.
- **SDK `/compact` 슬래시 명령**(`slash-commands.md`) — 프롬프트 문자열로 전송, 네이티브 압축. **사용자 지정(r2)**.
- **기존 new-chat lazy draft 흐름**(`NEW_CHAT_KEY` draft → `persist.ts` 첫 턴 lazy `insertSession`) — fork 파라미터화 확장.
- 전제: Orca sessionId = SDK session_id. fork/handoff 는 SDK 가 **새 id** 를 발급 → 그 id 가 새 Orca Session id.
- 전제(구현 시 실측 확인): `/compact` 는 fork 된 새 세션의 첫 프롬프트로 유효하며 `compact_boundary` + 요약을 발행한다. 시퀀스 실측은 인수 기준 6 선행 작업.
- **신규 의존성 0** — fork/handoff=SDK 옵션+슬래시 명령, 복사=기존 DB.

## 설계

### A) `orchestration/` L1 서비스 층 (백엔드 중립)
- `orchestration/fork.ts` — **SDK 네이티브 fork 위임**. 보내기 시 어댑터 `query({ resume: sourceSessionId, forkSession:true })` → 모델 전체맥락 보유, SDK 새 id 발급. Orca 측 = (a) `copyMessagesToSession`(display/record) + (b) lineage(`fork`). 수동 reseed 불필요.
- `orchestration/handoff.ts` — **rebind 방식(r2)**. ① 자동 메시지 템플릿: 순수 함수 `buildHandoffMessage(title | null)` (확정 문안 + `{title}` 보간 + id 폴백 — 단위 테스트 대상) ② 물질화: fork 와 같은 `forkSession` 경로를 재사용하되 **display 복사 없음** + lineage(`handoff`) + 첫 프롬프트 = 자동 메시지. LLM 호출 로직 자체는 갖지 않는다(기존 턴 파이프라인이 실행).

### B) DB lineage
- 신규 `session_lineage`(전용 테이블 — hot `sessions` 행 미오염). `insertLineage`/`getLineage`/`copyMessagesToSession`.

### C) IPC + 어댑터
- `chat:send` 페이로드 `forkFrom?`·`handoffFrom?` 추가(lineage/fork 트리거). **신규 invoke 채널 0** — handoff 도 send 경로로 수렴(`handoffFrom` 존재 시 main 이 자동 메시지를 조립해 text 를 대체).
- `TurnRequest.fork?: boolean` → `claude.ts` query `forkSession`(현 `resume` 배선 옆).
- **compact_boundary**: `claude-map.ts` 의 드롭 지점(:367)에서 정규화 variant 로 승격. 형태(전용 variant vs status 계열)는 wire 실측 후 확정, `IPC_CONTRACT.md` §3 동기화.
- **보내기/클릭 순차 셋업**: fork → `forkFrom` 첫 보내기에 물질화(어댑터 fork query → SDK 새 id → lazy 세션행 + display 복사 + lineage). handoff → **클릭 즉시** 같은 경로 실행(자동 메시지·복사 없음·lineage `handoff`).

### D) 렌더러
- **handoff**: `StatusPopover`(컨텍스트 도넛 Tier2 팝오버)에 핸드오프 액션 **상시 노출**, `nearCompaction` 시 경고 강조(팝오버/도넛 warn 톤 재사용). 클릭 → 가드 통과 시 즉시 새 세션 생성·전환, transcript = 자동 메시지(+진행 표시) → 압축 완료 표시(compact_boundary) → 이후 일반 대화.
- **fork**: `AssistantTurn`/`MessageMeta` 호버에 분기 아이콘 → 소스 in-memory parts 를 draft 뷰에 읽기전용 표시 + `{forkFrom}`. DB·런타임 미생성, 보내기 확정에 물질화, 취소=no-op.

### 재사용/경계
SDK `forkSession`(`sessions.md`) · SDK `/compact`(`slash-commands.md`) · 어댑터 `resume`(`claude.ts:286`) · `db.loadParts`/`insertSession`/마이그 패턴 · `contextWindow.nearCompaction`/`StatusPopover` · 기존 `chat:send`/new-chat draft · 첫 턴 에러 경로(0033/0038). 서비스=L1·핸들러=L3·어댑터 중립.

### 구현 순서 권고 (staging)
foundation(lineage DB + forkSession 어댑터 배선) → **fork**(draft 뷰 + display 복사, LLM 무관·저위험) → **handoff**(wire 실측 → compact_boundary 정규화 → 자동 메시지 + StatusPopover 배선).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **handoff 진행 표시**: 클릭 직후 새 세션으로 전환되고 `/compact` 압축이 수 초 걸릴 수 있음 — 일반 턴 스트리밍 UI 로 흡수(자동 메시지가 user 메시지로 표시되고 응답 대기 인디케이터). 압축 완료 = compact_boundary 표시.
- **handoff 실패**: 첫 턴 실패 = 기존 new-chat 첫턴 에러 경로(0033/0038) 흡수. 출발 세션 무변경 — 사용자는 출발 세션에서 재시도 가능. 실패한 새 세션행은 첫 턴 persist 정책에 따름(lazy 라 부분 흔적 최소).
- **가드 UX**: 소스 세션 턴 진행 중 → 액션 비활성(툴팁 "응답 완료 후 시도"). 사용자 턴 2회 미만 → 액션 미노출 또는 비활성. 진행 중 재클릭 무시.
- **취소/변심 (fork)**: draft 뷰 생성 후 미입력 이탈 → draft 폐기(DB·런타임·텔레메트리 흔적 0). 다른 세션 전환/새 draft 시작 시 이전 미전송 draft 정리. **handoff 는 클릭=확정**이라 취소 개념 없음(가드가 사전 방어) — 실행 후 되돌리기는 출발 세션 복귀로 갈음.
- **동시성/멀티세션**: fork/handoff 로 생긴 세션은 기존 멀티세션 store(`chatStore.sessions` Record)와 동거. 소스 세션이 실행 중이면 handoff 는 가드로 거부, fork draft 생성은 무관(원본 불변).
- **fork 경계**: SDK forkSession 은 전체 이력 fork(v1). display 복사도 소스 전체. 미완료 도구/부분 턴이 소스에 있으면 복사본도 그 상태.
- **테마/접근성**: 분기 아이콘 = 기존 호버 아이콘 톤/키보드 접근성 관례(복사 버튼) 따름. StatusPopover 액션 = 기존 팝오버 a11y 관례.
- **세션 재진입**: 물질화된 fork/handoff 세션은 일반 세션처럼 `sessionLoad`. handoff 세션의 첫 메시지 = `[핸드오프]` 자동 메시지(시스템 생성임을 마커로 식별). lineage 는 v1 표시 안 함(비범위).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **`/compact` 의 fork 첫 프롬프트 동작 미실측** — 요약 텍스트가 어느 SDK 메시지에 실리는지, maxTurns/결과 시퀀스 불확실 | 인수 기준 6 선행 작업으로 wire log(0025) 실측 → variant 형태 확정 후 정규화. 실측 결과가 전제와 다르면(예: fork+즉시 compact 불가) 구현자는 ⚠️ 보고(선조치 불가 — 설계 변경 필요). |
| **렌더러 "이력 있는 draft 뷰"(fork)** = 새 상태 변종 — 최대 작업량 | fork draft 는 소스 캐시 parts 를 읽기전용 clone 으로 draft 엔트리에 실음. persist 무관(전송 전). 구현자 우선 리스크로 표기. |
| **handoff 클릭=즉시 실행** — 오클릭 시 세션이 하나 생김 | 가드(비활성 조건) + StatusPopover 액션은 팝오버 2단계 안(즉발 버튼이 최상위 UI 에 노출되지 않음). 생성된 세션은 일반 삭제 경로로 정리 가능. |
| **fork 지점 정밀도** — SDK forkSession=전체 이력 | v1=전체분기(아이콘은 affordance). 점-분기(절단)는 SDK 미지원 → 비범위/후속. |
| **보내기/클릭 순차 셋업 부분 실패** | 첫 턴 실패이므로 기존 new-chat 첫턴 에러 경로(0033/0038) 흡수. |
| Orca id ↔ SDK fork 새 id 정합 | fork/handoff 는 SDK init 새 id 를 새 Orca id 로 채택. resume 은 forkFrom/handoffFrom(소스) 로만. |

- **단독 결정 금지 항목(Open Question)** → 사용자:
  - fork **점-분기** 지원 여부(후속·SDK 제약).
  - handoff 후 **출발 세션 상태 표시**(lineage 배지·"핸드오프됨" 표기 등 — v1 미표시 채택, UI 후속).
  - ~~handoff 요약 모델 선택~~ (r2 소멸 — 요약 = 도착 세션 `/compact`, 별도 모델 없음.)

## 영향 받는 파일

- **신규(main L1)**: `app/src/main/orchestration/{fork,handoff}.ts`(+ `.test.ts`).
- **신규(DB)**: `app/src/main/db/migrations/NNNN_session_lineage.sql`. **수정**: `app/src/main/db/queries.ts`·`db/types.ts`.
- **수정(IPC L3)**: `app/src/main/ipc/chat/{send,persist}.ts`(forkFrom/handoffFrom 물질화·자동 메시지 조립)·`src/shared/{ipc,protocol}.ts`(페이로드·zod·compact variant).
- **수정(어댑터 L2)**: `app/src/main/adapters/claude.ts`(forkSession)·`claude-map.ts`(compact_boundary 정규화)·어댑터 타입(`TurnRequest.fork`).
- **수정(렌더러)**: `features/chat/components/composer/StatusPopover.tsx`(핸드오프 액션)·`features/chat/components/transcript/{AssistantTurn,MessageMeta}.tsx`(분기 아이콘)·`features/chat/store/chatStore.ts`(fork draft·handoff 세션 전환)·compact 표시 컴포넌트·아이콘.
- **문서**: `docs/IPC_CONTRACT.md`(§3 variant·send 페이로드)·`docs/GLOSSARY.md`(lineage/handoff/fork 용어 정합)·설계서 §A.4(착지 포인터).

## 참고 문서
- `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A.4/§A.5` · `@docs/spec/claude/agent-sdk/sessions.md` · `@docs/spec/claude/agent-sdk/slash-commands.md` · `@docs/GLOSSARY.md` · `@docs/IPC_CONTRACT.md`(§6 변경 절차) · `@app/src/main/AGENTS.md`.

## 게이트
- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `buildHandoffMessage`(보간·폴백·`/compact` 접두) · `session_lineage` queries(insert/get/copy) 회귀 · fork 물질화(forkSession 옵션 배선) · compact_boundary 정규화 · IPC zod 스키마.

## 설계 self-review 체크리스트 (READY 전)
- [x] 사용자 의도 — 라이브 세션 요구 + r2 정정(rebind 방식·/compact 접두·forkSession 확인·자동 메시지 승인)을 출처로 인용, supersede 이력 보존, 추론 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`@docs/…`·`파일:라인`·SDK 미러). `/compact` 동작·compact_boundary 드롭 지점 확인.
- [x] 인수 기준 — 9개 번호·검증 가능. 미실측 전제(compact 시퀀스)는 기준 6 선행 작업으로 명시.
- [x] 의존 기술 — SDK forkSession(`사용자 확인`)·`/compact`·기존 draft 흐름 식별, 신규 의존성 0 명시.
- [x] 파생 UX — 진행 표시/실패/가드/취소(fork·handoff 분리)/동시성/fork 경계/테마·a11y/재진입 펼침.
- [x] 리스크 — compact 미실측·draft 뷰 상태·즉시 실행 오클릭·fork 정밀도·부분 실패·id 정합 + Open Question(점분기·출발 세션 표시) 분리.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 구현 주체 = **Claude** (plan 상 Codex 였으나 사용자가 라이브 세션(2026-07-02)에서 Claude 직접 구현을 지시 — 핸드오프 절차·trailer 규약은 동일하게 준수).

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: rebind(fork + SDK `/compact`) 채택(§Context) — 자체 요약 파이프라인 전체가 SDK 기능 2개로 대체되어 유지보수 표면적이 최소다. 신규 invoke 채널 0(§C) · lazy 물질화 재사용(§C) 도 그대로 — 렌더러 `promotePendingNewChat`(chatStore.ts:234)의 draft re-key + activeKey 자동 전환이 이미 있어 "새 세션 전환" UX 는 신규 코드가 거의 없었다.
- **이견 1 — `TurnRequest.fork?: boolean` → `forkFrom?: string` 로 변경(§C 조정)**: boolean 이면 resume 대상(소스 id)을 `sessionId` 에 실어야 해서 send.ts 의 resume 분기(즉시 persistUserMessage·admission `hasSession`)가 오염된다. `sessionId=null`(새 세션 의미론 유지) + `forkFrom` 별도 필드가 기존 새-채팅 경로(admission `hasPending`·lazy insert·promote)를 무변경으로 재사용한다. 어댑터는 `resume: forkFrom ?? sessionId` + `forkSession: !!forkFrom`(`claude.ts:286`).
- **이견 2 — 자동 메시지 렌더러 표시 = `message.user` 에코 variant(§기준 7 "구현자 재량" 지점)**: user 메시지 에코 이벤트가 없고(일반 send 는 낙관 렌더) invoke ack 회신은 타이밍 불안정 → coordinator 가 `session.updated` promote 직후 1회 forward 하는 `message.user` variant 신설(steer.flushed 의 `APPEND_COMMITTED_USER_MESSAGE` 리듀서 재사용). 템플릿 단일 출처 = main(orchestration/handoff.ts) 유지.
- **이견 3 — "StatusPopover 상시 노출"(기준 8)의 실배선**: StatusPopover 는 warn/danger 에서만 존재한다(statusViewModel 이 safe→null, 0006 설계). "상시" 를 위해 **컨텍스트 도넛 Tier2 팝오버(TelemetryPanel Popover) 하단에 핸드오프 액션을 추가**(도넛 = 세션 수명 동안 표시)하고, StatusPopover(warn/danger)에도 같은 액션을 추가했다. `nearCompaction` 시 도넛 팝오버 버튼이 primary 로 강조된다.
- **우려(보류) — compact 요약 텍스트의 가시성 미보장(§리스크 1 연장)**: `/compact` 후 요약이 assistant 메시지로 스트리밍되는지 스펙이 명시하지 않는다. 방어: 오면 `message.completed` 로 자연 표시, 안 오면 compact 마커만 표시(어느 쪽이든 무결). 실기 확인은 verify 사람 검증으로 이관.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **cwd 계승 누락** — SDK 세션 파일은 `~/.claude/projects/<encoded-cwd>/` 에 저장돼 `resume`(forkSession) 탐색이 **cwd 에 묶인다**. 새-채팅 기본 cwd 로 fork 하면 소스 세션을 못 찾는다. | ✅ 구현함 — fork/handoff 는 출발 세션의 cwd·project·provider 를 main 이 계승(`send.ts` continuityMeta). | `@docs/spec/claude/agent-sdk/sessions.md`(Tip: 일치하지 않는 cwd) |
| 2 | **라우트 싱크가 fork draft 를 즉시 되돌림** — `/chat/<원본>` URL 에서 draft(sessionId=null)로 전환하면 `useChatRouteSync` 방향 1 이 원본을 재로드해 draft 를 덮는다. | ✅ 구현함 — draft 가드(forkFrom/handoffFrom 마커 시 skip) + 방향 2 arming 확장(마커 세션 승격 시 `/chat/<새 id>` 이동). | `useChatRouteSync.ts` |
| 3 | **wire 실측 불가** — 이 원격 환경이 중첩 claude 서브프로세스를 SIGKILL(스크립트 실측 실패). | ✅ 사용자 승인 하 방어 구현 — SDK **타이핑**(`sdk.d.ts` `SDKCompactBoundaryMessage`·`Options.forkSession`)으로 shape 확정(스펙 문서보다 강한 근거). 실기 시퀀스 확인은 verify 사람 검증 항목. | 사용자 결정(2026-07-02) |
| 4 | fork draft 전송이 새-채팅 슬롯(`__new__`)의 사용자 선택(모델/모드)을 리셋 | ✅ 구현함 — `__new__` 재생성은 activeKey 가 새-채팅 슬롯일 때만. | `chatStore.ts send()` |
| 5 | 기존 테스트가 compact_boundary **드롭**을 잠금(`claude-map.test.ts` "미사용 SDK 메시지") | ✅ 구현함 — 0064 가 의도적으로 바꾸는 동작이라 예시 subtype 을 `status` 로 교체. | 인수 기준 6 |
| 6 | **handoff 자동-title** — 도착 세션 title 이 자동 메시지 preview(`/compact [핸드오프]…`)로 초기화됨. 자동 제목 생성(0004)이 첫 턴 후 덮지만 그 사이 사이드바에 노출. | ⚠️ 보고만 — 표시 정책(예: `핸드오프: {원본 title}` 초기값)은 UX 결정. v1 은 기존 경로 유지. | 파생 UX §세션 재진입 |
| 7 | **compact 요약 가시성**(설계 리뷰 "우려" 참조) — 요약이 세션 파일에만 남고 스트림에 안 실릴 가능성. | ⚠️ 보고만 — 방어 구현 완료, 실기 판단 후 필요 시 후속(요약 파트 하이드레이션). | §리스크 1 |

## [구현자 기입] 구현 체크리스트

- [x] 기준 1 — `orchestration/{fork,handoff}.ts` L1 신설(순수 로직만·배선은 L3), 백엔드 리터럴 0, boundaries/no-cycle 통과
- [x] 기준 2 — `buildHandoffMessage` 순수 함수 + 단위 테스트 4(보간·폴백·`/compact [핸드오프]` 접두 불변·구조 지시)
- [x] 기준 3 — `0011_session_lineage.sql` + `insertLineage`(멱등)/`getLineage`/`copyMessagesToSession`(트랜잭션·idx 보존) + 회귀 테스트 4
- [x] 기준 4 — fork: MessageMeta 분기 아이콘(호버) → `startForkDraft`(DOM draft 뷰만·소스 transcript 읽기전용 프리필) → 첫 보내기 `forkFrom` 물질화(SDK 새 id → lazy 세션행+display 복사+lineage) · 미전송 draft prune(영속 0)
- [x] 기준 5 — handoff: `startHandoff` 클릭=즉시 물질화(자동 메시지 main 조립·display 복사 없음·lineage 'handoff') + `message.user` 에코 + 세션 자동 전환
- [x] 기준 6 — `system/compact_boundary` → `session.compacted` variant + `compact_boundary` 파트 영속 + `CompactBoundaryMarker` 구분선 렌더 (방어 구현 — 사용자 승인)
- [x] 기준 7 — `SendChatMessage.forkFrom/handoffFrom` + zod(상호배타·새 세션 전용·handoff text 생략) + `TurnRequest.forkFrom` → `claude.ts` forkSession. 신규 invoke 채널 0(총 40 유지)
- [x] 기준 8 — 핸드오프 액션: 도넛 Tier2 팝오버 상시 + StatusPopover(warn/danger) + `nearCompaction` 강조. 가드 3종(mid-turn 비활성/main 이중 방어 · 사용자 턴 2회 미만 · 재클릭 무시)
- [x] 기준 9 — 불변식 문서화(코드 주석) + 게이트 green

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **신규**: `orchestration/{fork,handoff}.ts(+test)` · `db/migrations/0011_session_lineage.sql` · `adapters/claude.fork.test.ts` · `transcript/CompactBoundaryMarker.tsx` / **수정(main)**: `db/{migrate,queries,types}.ts` · `extensions/types.ts` · `adapters/{claude,claude-map}.ts` · `lifecycle/{turn-context,turn-coordinator}.ts` · `ipc/chat/{send,persist}.ts` / **수정(shared)**: `ipc.ts` · `protocol.ts` / **수정(렌더러)**: `chatStore.ts` · `chatReducer.ts` · `lib/parts.ts` · `Composer.tsx` · `composer/StatusPopover.tsx` · `transcript/{AssistantMessage,AssistantTurn,MessageMeta}.tsx` · `app/hooks/useChatRouteSync.ts` · `shared/ui/Icon.tsx` |
| 실행 명령 | `cd app && npm run lint && npm run typecheck && npm test` |
| 게이트 결과 | lint ✅ / typecheck(node·web·test) ✅ / test ✅ **87 files · 645 passed** (원격 환경 특이사항: electron 바이너리 다운로드 403 → `path.txt` 스텁으로 모듈 로드 우회, 테스트는 electron API 를 mock 하므로 무영향 — base 커밋에서도 동일 실패 확인) |
| 블로커 / 역질문 | 없음. ⚠️ 2건(위 표 #6 title 초기값 · #7 요약 가시성)은 verify/사용자 판단 대기 |
| 대상 커밋 | `68ea320` (PR #182) |

## [구현자 기입] r2 — 실기 피드백 4건 반영 (2026-07-02, Claude)

사용자 실기 테스트 피드백과 대응:

| # | 피드백 | 진단 | 대응 |
|---|---|---|---|
| 1 | StatusPopover 액션 중복(compact 스텁·새 대화·핸드오프) | 문안 겹침 + 미구현 스텁 | **사용자 확정 반영**: "정리하고 새 대화 시작" 제거, warn=현재 세션에 `/compact` 사용자 턴 전송(스텁 실구현 — `chatActions.send('/compact')`, 기존 compact_boundary 정규화가 구분선 표시), danger=핸드오프 단일 권장 액션. `statusCopy/statusViewModel/StatusPopover` 재구성(`action: 'compact' \| 'handoff'`). |
| 2 | 핸드오프 클릭 시 멈춤·user 버블 미표시·**다른 세션 이동 불가** | ① r1 라우트 가드가 목적지 불문 모든 `/chat/:id` 로드 차단(확정) ② 렌더러 `receive()` 가 entry 없는 sessionId 이벤트를 **폐기** — 승격이 어긋나면 에코·에러·telemetry 전부 소실(빈 화면+고착, "user 버블도 안 보임" 증상과 일치) ③ 빈 draft 는 exchange 가 없어 `PendingAssistant` 미렌더(애니메이션 공백) ④ `startHandoff` 의 조용한 큐 대기 | ① 가드를 `urlSessionId === draft 소스` 로 한정 ② entry 없는 sessionId 이벤트를 pending draft 로 **폴백 라우팅**(+터미널 시 게이트 해제) ③ `inflight && exchanges===0` 이면 `PendingAssistant` 렌더 ④ 큐 대신 거부. **통합 테스트 신설**(`send.continuity.test.ts` — 실 DB+persist+coordinator 로 [session.updated→message.user→telemetry] 순서·lineage·복사 잠금). |
| 3 | fork 아이콘은 마지막 어시스턴트 턴에서만 | — | `TranscriptView(isLast)→Exchange(forkable)→AssistantTurn(마지막 턴)` 전파, memo 비교자 갱신. |
| 4 | 핸드오프 도착 세션에 원본 링크 안내 | — | `LineageBanner` 신설(타이틀바 아래): "이 세션은 '<원본>'에서 핸드오프로 이어졌습니다/분기되었습니다 — 원본 열기"(navigate). 라이브=draft 스냅샷, 재로드=`LoadedSession.lineage`(sessionLoad 가 `getLineage`+부모 title 포함, IPC_CONTRACT 동기화). |

- 게이트: lint/typecheck(3종)/test **647 passed** green. 신규 테스트 2파일(+2건 statusViewModel 재작성).
- 잔여 진단: 멈춤의 main-side 근본 원인(승격이 왜 어긋났는지)은 실기 wire 로그가 필요 — **재테스트 시 디버그 패널 "Wire 메시지" 토글(0025) 켜고 터미널 `[wire]` 시퀀스 확보 요청**. r2 견고화로 어긋나도 화면에 에러/진행이 표시된다.

## [구현자 기입] r3 — 실기 피드백 4건 (2026-07-02, Claude)

| # | 피드백 | 대응 |
|---|---|---|
| 1 | 텔레메트리 도넛 팝오버의 핸드오프 메뉴 제거 | 제거 — 핸드오프 진입점은 StatusPopover(danger) 단일화. **r1 인수 기준 8 의 "상시 노출" 폐기(사용자 피드백 supersede)**, `nearCompaction` 강조는 StatusPopover danger 가 담당. |
| 2 | compact 시작 시 user 버블 + 어시스턴트 자리 inflight 애니메이션 | r2 에서 구현됨(`message.user` 에코 + PendingAssistant 빈 상태 폴백) — r3 코드 변경 없음, 재테스트 확인 항목. |
| 3 | /compact 완료 후 결과 메시지 미출력 | **사용자 지정: PostCompact hook 활용**(hooks#postcompact). `withPostCompactHook`(claude-adapt) 이 사용자 hooks 조각과 병합된 어댑터 내부 PostCompact 콜백을 등록 — `compact_summary`(**manual 만**, auto 압축은 일반 턴 오염 방지 위해 제외)를 수집하고, `claude.ts events()` 가 SDK 메시지 경계마다 드레인해 **`message.completed`(assistant 메시지)로 승격** → 일반 persist(text 파트)·렌더(마크다운) 경로 재사용, [압축 구분선 → 요약 메시지] 순서. 단위 테스트 3건. |
| 4 | 클릭 즉시 새 세션 정체성 + nav `[분기]/[핸드오프] <원본 제목>` | `turn.initialTitle`(persist insertSession 오버라이드) + `titleGenerationStarted=true`(자동 제목 0004 억제 — 마커 유지, rename 가능) + 렌더러 draft title 즉시 설정(헤더 반영). nav 등장 시점은 사용자 동의대로 기존 정책(세션 id 발급 → promote → recentsEpoch) 유지. 통합 테스트에 제목 검증 추가. |

- 게이트: lint/typecheck(3종)/test **650 passed** green.
- 사람 재테스트 체크: ① 핸드오프 클릭 → 즉시 `[핸드오프] <원본>` 헤더 + 에코 버블 + 애니메이션 ② 압축 완료 → 구분선 + **요약 assistant 메시지** ③ nav 에 마커 제목 행 ④ 도넛 팝오버에 핸드오프 없음. ①이 여전히 실패하면 wire log(`[wire]`) 시퀀스 공유.

## [구현자 기입] r4 — 실기 피드백 4건 (2026-07-03, Claude)

> 이번 라운드는 CLI 번들 실측(원격 환경이 중첩 claude 실행을 차단해 실행 대신 **번들 문자열 분석** — `@anthropic-ai/claude-agent-sdk-linux-x64/claude` v0.3.143)으로 compact 내부 동작을 확정하고 반영했다.

| # | 피드백 | 진단 / 대응 |
|---|---|---|
| 1 | `/compact <지시문>` 이 빈 지시문과 결과가 비슷 — 작동하는지 의문 | **작동한다 — 단 加算(additive)이지 대체가 아니다(조사 결론, 코드 변경 없음).** CLI 번들 실측: `/compact` 명령의 `argumentHint` 가 `<optional custom summarization instructions>` 이고, 인자는 압축 프롬프트 말미에 `Additional Instructions:\n<인자>` 로 덧붙는다. 그런데 기본 압축 프롬프트가 **9개 섹션 구조(Primary Request/Key Concepts/Files/Errors/…) + `<analysis>`/`<summary>` 출력 형식을 강제**하므로, 우리 템플릿의 ①~⑤ 구조 요구는 기본 구조에 흡수돼 겉모습이 비슷해진다. verbatim 보존 지시(파일경로·에러 등)는 기본 프롬프트에도 이미 유사 조항이 있다. 템플릿(사용자 승인 문안)은 유지 — 구조 지시를 줄이고 도메인 컨텍스트(핸드오프 사실·원본 제목)만 남기는 축약은 사용자 결정 대상(Open Question 으로 등재). |
| 2 | user 버블이 compact 요약 **뒤에** 출력 — [user → inflight → 요약] 순서여야 함 | **에코 발행 시점을 SDK 이벤트 의존에서 분리.** r2/r3 은 coordinator 가 `session.updated`(init) 때 에코했는데, 실기에서 init 이 compact 이벤트보다 늦으면 요약이 pending draft 폴백 라우팅으로 먼저 붙고 에코가 뒤에 붙는 역순이 재현된다(r2 "승격 어긋남" 관측과 동일 계열). 수정: ① `send.ts` 가 수리 직후(턴 시작 전) `message.user`(sessionId 없음) 를 발행 — 렌더러 `receive()` 가 `pendingNewChatKey`(핸드오프 draft)로 라우팅해 **항상 첫 메시지로 커밋** ② coordinator 의 `session.updated` 에코 제거(`TurnContext.echoUserText` 폐기) ③ `claude.ts` 요약 드레인을 `ctx.sessionId` 확정 전엔 보류(미확정 sessionId 로 나가면 persist 가 드롭해 재로드 유실) ④ `NormalizedEvent.message.user.sessionId` optional + IPC_CONTRACT §3 갱신. 잠금: `chatStore.test.ts` 에코 순서 2건(병리적 init 지연 순서 포함) + `send.continuity.test.ts` 개정. |
| 3 | compact 출력에 `<analysis/><summary/>` XML 이 그대로 노출 — summary 만 표시 | CLI 실측: PostCompact hook 의 `compact_summary` 는 압축 응답 **원문 전체**(`<analysis>`+`<summary>`)다. 신규 순수 함수 `extractCompactSummary`(claude-adapt) — `<summary>` 내용만 추출, 태그 부재 시 analysis 블럭·잔여 태그 제거 폴백 — 를 `withPostCompactHook` 에 배선. 단위 테스트 4건. |
| 4 | fork 시 좌측 nav 에 orca 세션이 바로 추가돼야 함 | **continuity draft 를 nav '최근 대화' 에 즉시 노출.** DB 물질화는 SDK init id 발급에 묶여 있어(전제: Orca id = SDK id) 클릭 시점 DB 행 생성은 불가 — 대신 렌더러 draft 행을 DB 목록 위에 얹는다: `useContinuityDraftRows`/`useActiveContinuityDraftKey`(chat store, useShallow 인코딩 구독) → 셸(`useSessionHandlers`/`useSidebarSlots`)이 구조적 타입(`DraftSessionRow`)으로 매핑해 `SessionList` 에 주입(4-layer 경계 보존). 물질화(promote) 시 draft 행이 DB 행으로 자연 교체된다. **파생 정책 변경**: draft 가 nav 행이 된 이상 이탈-즉시-폐기(r1 파생 UX)는 행이 사라지는 착시를 낳아 폐기 — draft 는 이탈에도 생존하고, 폐기는 행 삭제(`discardContinuityDraft`, 활성이면 부모 복귀·pending 중 거부) 또는 같은 부모 재-fork 교체(`prune(parentId)`)로만. 취소=no-op(영속 흔적 0) 불변식은 유지. draft 행은 rename 불가(`SessionRow.renameable` — 마커 제목이 main `initialTitle` 소유라 draft rename 은 물질화 시 유실). 부모 행 클릭으로 draft 탈출(`loadSession` 직접 전환) 배선. 테스트 3건. |

- 게이트: lint/typecheck(3종)/test **659 passed** (88 파일, +9) green.
- Open Question(사용자): 핸드오프 템플릿 축약 여부(피드백 1 — 기본 압축 프롬프트가 구조를 강제하므로 ①~⑤ 지시는 사실상 중복. 축약하면 토큰 절약, 유지해도 무해).
- 사람 재테스트 체크: ① 핸드오프 클릭 → user 버블 먼저 + 아래 inflight 애니메이션 → 완료 시 그 자리에 **XML 없는 요약** ② fork 클릭 → nav 에 `[분기] <원본>` 행 즉시 표시(이탈해도 유지·행 삭제 가능) ③ 다른 세션 갔다가 draft 행 클릭 → draft 복귀.

## [구현자 기입] r5 — 실기 피드백 3건 (2026-07-03, Claude)

| # | 피드백 | 진단 / 대응 |
|---|---|---|
| 1 | compact 답변 완료 후 텔레메트리 도넛 미갱신 — 컨텍스트 경고가 압축 후에도 유지 | **압축 턴의 telemetry 가 압축 *전* 값을 실어 나감.** result.usage(와 경계 이전 assistant 스냅샷)의 컨텍스트 3종은 전체 이력이 실린 *요약 요청 입력*이라, 그대로 renderer `lastTelemetry` 를 덮어 도넛/경고가 압축 전 상태에 고착됐다(재로드도 turn_usage 최신 행이 같은 값). 수정(`claude-map.ts`): ① `compact_boundary` 에서 `ctx.compacted=true` + 경계 이전 `lastAssistantUsage` 스냅샷 무효화 ② result 시 경계 이후 실측 usage 가 없으면(manual `/compact`·핸드오프 도착) 컨텍스트 점유를 **요약 크기(출력 토큰)로 근사**(`inputTokens := outputTokens`, cache 2종 제거) — 다음 실제 턴이 실측으로 바로잡는다. 경계 이후 assistant usage 가 오면(auto 압축 후 턴 계속) 실측 스냅샷 우선. 비용·modelUsage 는 턴 누적 유지(원장 무손실) → persist `hasContextTokens` 게이트도 통과해 재로드 도넛까지 정합. 렌더러/IPC 변경 0. 단위 테스트 2건. **한계(graceful)**: outputTokens 미제공 시 컨텍스트 3종 전부 제거 → 도넛은 직전 값 유지(경고 지속) — 실기에서 result.usage.output_tokens 는 상시 제공되므로 실질 영향 없음. |
| 2 | fork/handoff 세션 창의 '원본 열기' 링크가 곧바로 동작 안 함 | **draft(파생 뷰) 위에서는 URL 이 이미 `/chat/<부모>`.** `navigate` 가 no-op 이고(같은 경로), 라우트 싱크 방향 1 의 draft 가드(`urlSessionId === draft 소스` skip)도 부모 재로드를 차단 — 물질화 후에야 동작하던 이유. 수정(`LineageBanner.tsx`): 사이드바 부모 행 클릭(r4 `useSessionHandlers`)과 동형으로 **draft 활성이면 `chatActions.loadSession(부모)` store 전환을 직접 수행** 후 navigate. draft 는 nav 행으로 생존(r4 정책 유지). |
| 3 | fork 세션에도 compact 구분선처럼 **'분기된 지점' +라인** 표시(핸드오프는 현행 유지) | **`fork_boundary` 파트 신설(compact_boundary 동형).** main: `materializeContinuityArrival` 이 fork display 복사 직후(새 발화 전 idx) 마커 메시지+파트를 영속 → 재로드 표시. 렌더러: `startForkDraft` 프리필 끝에 같은 마커를 합성(라이브 draft 도 즉시 표시, 위치 일치) + `messageSegments` `{kind:'fork'}` + `ForkBoundaryMarker`(구분선 "분기된 지점", fork 아이콘). handoff 는 display 복사가 없어 마커 미생성(현행 유지). 신규 이벤트/IPC 채널 0 · DB 스키마 변경 0(파트 type 은 자유 텍스트 컬럼). 테스트: fork/continuity 잠금 갱신 + segments/draft 프리필 3건. |

- 게이트: lint/typecheck(3종)/test **662 passed** (88 파일, +3) green. (환경: electron 바이너리 403 → r4 와 동일한 `path.txt` 스텁 우회, better-sqlite3 Node ABI 재빌드 — 0019 계열, 변경 무관.)
- 사람 재테스트 체크: ① 컨텍스트 가득 찬 세션에서 `/compact`(StatusPopover) 완료 → 도넛이 요약 크기 수준으로 즉시 하락 + 경고 해제, 재로드 후에도 유지 ② fork/handoff 직후 draft 상태에서 '원본 열기' 클릭 → 즉시 원본 전환(draft 는 nav 행 생존) ③ fork draft·물질화 후·재로드 모두 복사 이력 끝에 '분기된 지점' 구분선, 핸드오프 세션은 기존 그대로(압축 구분선만).
