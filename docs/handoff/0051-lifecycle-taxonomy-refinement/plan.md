# Plan — 0051-lifecycle-taxonomy-refinement

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0050 의 라이프사이클·오케스트레이션 설계를 **용어·축 관점에서 정제**하는 *문서 전용* 핸드오프다. 0050 가 구조(코드)를 다뤘다면, 0051 은 그 위의 **개념 SSOT**(용어 3분리 + 2축 모델 + 택소노미 교정)를 확정한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0051-lifecycle-taxonomy-refinement` |
| 작성자 | Claude Code |
| 일자 | 2026-06-29 |
| 매핑 | PHASES 행(문서·미승격 후보) / PR (요청 시) |
| 상태 | DRAFT → READY → (비기능=Claude 직접 impl) |
| 구현 주체 | **Claude** (문서 정제 — 비기능) |
| 선행 | `0050-lifecycle-orchestration-redesign`(설계 정본) + 라이브 세션 정제 대화(2026-06-29) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "라이프사이클/오케스트레이션 범위를 세션 안에 두는 게 맞지 않나" → 용어·축 정제 대화 후 "직전에 계획했던 plan을 실행하라". | 라이브 세션(2026-06-29) |
| 명시 결정 | ① '세션' 용어가 과부하 → **Orca Session / SessionRuntime / SDK resume context** 3분리. ② 동시성(cap/LRU/idle-close)은 *자원 라이프사이클*이지 오케스트레이션 아님. ③ 2축(세로 소유/라이프사이클 + 가로 턴/이벤트/권한 파이프라인) + 누락된 TurnCoordinator. | 라이브 세션 정제 대화 |
| 명시 결정 | 범위 = **문서 확정만**(코드 미변경). 모듈명 충돌 = **문서만 정제, 출시된 `orchestration/` 코드명 유지**(코드 리팩터는 별도 핸드오프). | 라이브 세션(2026-06-29, 기본값 채택) |
| 추론 의도 | 이 정제가 후속 P1(TurnCoordinator 1급화·steer/queue)·Future(continuity·knowledge curation) 작업의 1차 출처가 되어야 한다. | 설계자 해석 |

## Context (왜)

0050 가 SessionRuntime·상태머신·recovery 를 코드로 추출했지만, 그 설계서(`orca_lifecycle_orchestration_design_draft_ko.md`)는 (a) '세션' 한 단어로 *대화 기록*과 *실행 컨텍스트*를 뭉쳐 부르고, (b) 결정 ⑭ 에서 "세션 간 동시성"을 오케스트레이션으로 분류해 같은 레지스트리를 §2(리소스)와 §3(오케스트레이션)에 **이중 청구**한다. 라이브 세션에서 이를 풀어:

- **3엔티티 분리**로 과부하 해소 → 동시성이 세는 유닛이 *SessionRuntime*(자원)임이 자명해져 §2/§3 이중 청구가 닫힌다.
- **2축 모델**로 0050 가 그리지 못한 가로축(턴/이벤트/권한 파이프라인)과 그 구동체 **TurnCoordinator**(현 `InflightTurn`/`send.ts`)를 1급화.
- DB=*기록*의 진실로 한정(라이브 모델 컨텍스트는 SDK resume context, 무손실 재현 불가 → resume 실패 시 reseed≠recovery).
- handoff/fork/knowledge curation 을 **Conversation Continuity** 서비스 층(Future)으로 분리하고 경계(별도 평가 세션·Runtime close ≠ Conversation close)를 미리 못 박는다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 설계 정본 — 결정 ⑭(오케스트레이션 스코프 = 세션 간 동시성 + 워크플로), §2 결정 ①②(registry·IdleCloseTimer=라이프사이클), §3 element3(동시성=오케스트레이션) **이중 청구** | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md`(§2·§3·§5.4 ⑭) |
| GLOSSARY 가 `Session`을 "대화 컨텍스트 + 어댑터 발급 ID + jsonl 동기화"로 뭉침 | `@docs/GLOSSARY.md` §1 `Session` 행 |
| GLOSSARY §3 가 `Conversation`/`Thread` 금지 → 신규 용어는 `Session` 유지 + `SessionRuntime`/`SDK resume context` 추가로 우회 | `@docs/GLOSSARY.md` §3 |
| 코드: SessionRuntime(휘발 핸들·상태 SSOT) 이미 존재, registry/timers/recovery 도 lifecycle 모듈에 | `app/src/main/lifecycle/{session-runtime,session-state,timers,recovery}.ts` (0050 구현, 본 브랜치에선 구현 커밋 제거·`origin/0049-…` 보존) |
| 출시된 `orchestration/concurrency.ts` 모듈명이 교정 택소노미(동시성=라이프사이클)와 충돌 → 문서만 정제·코드명 유지(결정 2) | 0050 plan.md 인수 #10 · `app/src/main/orchestration/` |
| 델타는 DB 비영속(settled parts만) → 가로축 "EventStore append"는 리듀서(=Coordinator) 경유 | `@docs/GLOSSARY.md` §1 `Delta` 행 |
| dangling tool 마감은 0050 P0(이미 구현, `{reason:'aborted'}`) — 가로축 복구 경로 | `app/src/main/lifecycle/recovery.ts` · 0050 plan §D |
| 권한 = `canUseTool` 재진입 콜백(파이프라인 단계 아님), PermissionBridge 1급 이벤트 | `@docs/arch/backend/provider-runtime.md` §3 · `app/src/main/adapters/claude.ts`(makeCanUseTool) |

## 인수 기준 (Acceptance Criteria)

1. **GLOSSARY 3분리.** `Session` 정의를 *Orca Session(대화 기록)* 으로 좁히고, 표제어 **SessionRuntime**·**SDK resume context** 를 신규 추가. §3 에 "Session=Orca Session 만, SDK 측은 context 로 호칭" 보강. (`Conversation`/`Thread` 금지 유지.)
2. **결정 ⑭ 교정.** 설계서 §5.4 결정 ⑭ 를 "오케스트레이션 스코프 = 다중턴/세션 워크플로(handoff)만"으로 좁히고, "세션 간 동시성"은 §2 리소스/프로세스 라이프사이클로 귀속 표기 + 출시 `orchestration/` 코드명과의 분기 메모(결정 2).
3. **2축 모델 절 신설.** 설계서에 3엔티티(포함관계·카디널리티) + 세로축(층·유닛, TurnCoordinator 포함) + 가로축(stream→reduce→persist∥forward + 권한 재진입) + Conversation Continuity/Knowledge Curation(Future 서비스 층) + DB-진실 한정(reseed≠recovery) + Staging(P0 출시분/P1/Future) 을 담은 절 추가.
4. **provider-runtime cross-ref.** `provider-runtime.md` 에 TurnCoordinator(가로축 구동체)·"persist=main-side·renderer 비의존" 포인터 1건(설계서 신설 절 링크).
5. **INDEX/문서 정합.** INDEX 에 0051 행 추가(plan/READY→비기능 Claude 직접 impl). 3엔티티 용어가 GLOSSARY↔설계서↔provider-runtime 에서 일치(grep 모순 0). 한국어·표 위주 컨벤션 유지.

## 범위 / 비범위

- **범위**: 문서 4건(GLOSSARY·설계서·provider-runtime·INDEX) 정제. 개념 SSOT 확정.
- **비범위(후속 핸드오프)**: 코드 변경 일체 — TurnCoordinator 1급화(P1)·`orchestration/`→supervision 코드 리네임·steer/queue·Persistent runtime·IdleCloseTimer 구현·Conversation Continuity/Knowledge Curation 구현(Future). 0050 코드(본 브랜치 제거분)의 재적용/PR 여부도 별개.

## 설계 (안착할 통합 모델)

### 3엔티티 (포함관계)
```
Orca Session  ── 대화 기록의 진실(DB=궁극 SSOT). 영속·무자원. CRUD 단위.
  └ SessionRuntime  ── Orca Session 실행용 일시적 핸들. 휘발·유자원(서브프로세스). 상태 cold/idle/busy/interrupting/closed.
      └ SDK resume context  ── SDK query/resume 외부 binding(jsonl). 손실적(compaction)·발산 가능. 대화의 진실 아님.
```
- 카디널리티: Orca Session : SessionRuntime = 1:N(open→idle-close→reopen). DB=*기록* 진실 / 라이브 모델 컨텍스트=SDK resume context(무손실 재현 불가). resume 실패 시 DB 이어가기 = **reseed/bootstrap**(복구 아님).

### 세로축 (소유/라이프사이클) — 유닛
App Lifecycle(앱) · Session/Event Store(Orca Session) · Runtime **Supervisor**/Registry(SessionRuntime 집합: cap/LRU/busy 보호=자원) · **TurnCoordinator**(턴: 스트림 소비→델타 리듀스→권한 중계→persist∥forward) · SessionRuntime(단일 실행·상태 SSOT·timers·admission) · SDK Adapter(정규화·canUseTool bridge) · SDK(loop/tool/subagent/compaction).

### 가로축 (턴 파이프라인)
`입력→admission→acquire→send→query →(SDK)→ normalize → [Coordinator] reduce(settled parts만) → { persist(main-side·renderer 무관) ∥ forward(best-effort) }`. 권한은 단계가 아니라 **canUseTool 재진입 콜백**(query 정지→승인 왕복→복귀). terminal(result→telemetry)=busy→idle + close 트리거.

### Conversation Continuity / Knowledge Curation (Future 서비스 층)
handoff·fork·DB reseed·conversation close/archive 시 평가·요약→**Orca 전용 knowledge artifact / KB entry**(memory.md 아님). 불변식: **Runtime close ≠ Conversation close**; **1 Orca Session : ≤1 user-facing SessionRuntime**; 평가·요약은 원 세션 visible runtime 오염 없이 **별도 internal evaluation session(ownerless system runtime, `runCompletion` 류)**에서. 평가 런타임의 cap 회계 포함 여부는 P1 경계.

### Staging
- **P0(0050 출시분)**: 3엔티티 개념·OneShot SessionRuntime·상태 SSOT·StallTimer 분리·**dangling 마감(DB-only)**·PermissionBridge/canUseTool(승인=P0 제약된 mid-turn 입력).
- **P1**: TurnCoordinator 1급화·Persistent·steer/queue·IdleCloseTimer·Supervisor cap/LRU·idempotent close 단일경로(self-idle vs LRU).
- **Future**: handoff/fork·DB reseed·internal evaluation session 평가·요약·knowledge artifact/KB·lineage 영속.

### 재사용/참조
설계서 정본 §1·§2·§3·§5.4 · GLOSSARY §1/§3 · provider-runtime §2/§3 · 기준자 2편.

## 파생 UX / 엣지케이스
N/A (문서 전용 — 코드/런타임 동작 무변경).

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| 교정 택소노미가 출시 `orchestration/` 코드명과 분기 | 결정 2: 문서만 정제·코드명 유지·분기 메모. 코드 리네임은 별도 핸드오프(AGENTS.md 원칙 4: 문서↔코드 충돌=사용자 결정). |
| 설계서 채택 결정(⑭) 변경 | 라이브 세션에서 사용자 직접 합의(원칙 3 준수). |
| GLOSSARY 금지어(Conversation/Thread) 저촉 | 신규 용어는 `Session` 유지 + `SessionRuntime`/`SDK resume context` 추가 — 금지어 미사용. |

- 단독 결정 금지 항목: 코드 리네임·0050 재적용·PR 생성은 사용자 결정.

## 영향 받는 파일
- `docs/GLOSSARY.md`(§1 3분리·§3 보강), `docs/etc/orca_lifecycle_orchestration_design_draft_ko.md`(⑭ 교정·정제 절 신설), `docs/arch/backend/provider-runtime.md`(TurnCoordinator 포인터), `docs/handoff/INDEX.md`(0051 행).

## 참고 문서
- `docs/etc/orca_lifecycle_orchestration_design_draft_ko.md`(설계 정본) · `docs/handoff/0050-lifecycle-orchestration-redesign/plan.md` · `docs/etc/{lifecycle_management,orchestration_report}_ko.md` · `docs/GLOSSARY.md` · `docs/arch/backend/provider-runtime.md`.

## 게이트
- 앱 게이트 N/A(문서 전용). 정합성: 3엔티티 용어 grep 교차(모순 0)·링크·한국어 컨벤션.

## 설계 self-review 체크리스트 (READY 전)
- [x] 사용자 의도 — 라이브 세션 출처 인용, 추론 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`@docs/…`·`파일:라인`).
- [x] 인수 기준 — 5개 번호·검증 가능.
- [x] 의존 기술 — 문서 전용, 신규 의존성 0.
- [x] 파생 UX — N/A 명시(코드 무변경).
- [x] 리스크 — 코드명 분기·결정 변경·금지어 저촉을 완화책과 함께, 단독 결정 금지 항목 분리.

---

> **[구현자 기입]** 비기능=Claude 직접 구현. 아래는 문서 편집 후 기입.

## [구현자 기입] 구현 체크리스트
- [x] GLOSSARY §1 3분리 + §3 보강
- [x] 설계서 결정 ⑭ 교정 + 2축 정제 절 신설
- [x] provider-runtime TurnCoordinator 포인터
- [x] INDEX 0051 행

## [구현자 기입] 구현 보고
| 항목 | 내용 |
|---|---|
| 변경 파일 | `docs/GLOSSARY.md`, `docs/etc/orca_lifecycle_orchestration_design_draft_ko.md`, `docs/arch/backend/provider-runtime.md`, `docs/handoff/INDEX.md`, `docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md` |
| 실행 명령 | 문서 전용 — 앱 게이트 N/A. 3엔티티 용어 grep 교차 확인. |
| 게이트 결과 | N/A(문서). 정합성 grep ✅ |
| 블로커 / 역질문 | 없음. 코드 리네임·0050 재적용·PR 은 사용자 결정(비범위). |
| 대상 커밋 | (push 후 기재) |
