# Plan — 0071-backend-arch-runtime-doc-sync

> 백엔드 아키텍처 문서(overview·runtime-ipc)를 0062(main 구조 재편)·0066~0070(런타임 재작업) 코드 현실에 재동기화하고, 이를 참조하는 문서(채널 수·inflight 모델)를 함께 갱신한다. 비기능(문서) = Claude 직접 plan→impl→verify.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0071-backend-arch-runtime-doc-sync` |
| 작성자 | Claude Code |
| 일자 | 2026-07-05 |
| 매핑 | PHASES 행 (문서 정합 — 0062·0066~0070 사후 정식화) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "① 백엔드 아키텍처 문서를 업데이트하라 ② 그 문서를 참조하는 관련 문서들을 업데이트하라" | 라이브 세션(2026-07-05) |
| 추론 의도 | 문서가 코드와 드리프트했다 — 목표는 "현재 코드에 맞춰 정합화"(새 설계가 아니라 사후 정식화) | (추론 — "업데이트"의 기준을 arch AGENTS "코드 우선"으로 해석) |

## Context (왜)

`arch/backend/runtime-ipc.md` §1~§2 와 `overview.md` §3 은 **더 이상 존재하지 않는 구조·모델**을 기술한다:
- **동시성**: "단일 inflight(`ChatState.inflight: boolean`)" + `pendingUserText` in `router.ts` — 실제로는 멀티세션(세션별 SessionRuntime) + **세션별 pending message queue** + 장수명 세션 채널(0066·0067)로 대체됨.
- **조립기**: `CapabilityBuilder.build()` — 실제 이름은 `ExtensionBuilder`(features/extensions/builder.ts).
- **프로세스 트리**: overview §3 은 구 평면 레이아웃(`ipc/`·`adapters/`·`config/`·`db/`·`mcp/` 등)을 그린다 — 실제는 0062 재편으로 `app/·contracts/·adapters/·features/·infra/` 5-슬라이스.
- **채널 수**: runtime-ipc "총 31 채널·12 도메인", 참조 문서(`docs/AGENTS.md`)는 "40 채널", 프론트 `ux-domains.md` 는 "31 채널" — SSOT(`IPC_CONTRACT.md`)는 **53 채널·17 도메인**.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| main 은 feature 수직 슬라이스 + adapters + infra + app 컴포지션 루트로 재편(0062) | `@app/src/main/AGENTS.md` (레이어 DAG·매핑표) |
| 모든 사용자 프롬프트가 세션별 pending message queue 경유 — held→flushed→consumed 수명 | `app/src/main/features/chat/pending-message-queue.ts:43-63` |
| consumed 신호 2종(0069): 턴-시작 배치=첫 모델 출력, steer 배치=CLI user echo | `pending-message-queue.ts:51-58`, `features/chat/turn-coordinator.ts:28-38` (`MODEL_OUTPUT_EVENTS`) |
| 커밋(user row·preview·renderer 승격)=echo 관측 단일 경로 `message.committed`, send 시점 선영속 없음 | `@docs/IPC_CONTRACT.md §2.1` (chat:send), `pending-message-queue.ts` header |
| 장수명 세션 채널: persistent+pushTurn 어댑터=단일 채널 pump 가 스트림을 프레임(1프레임=1턴)으로 절단, terminal 은 프레임만 닫고 채널 유지 | `features/sessions/session-runtime.ts:12-16,74-78` |
| SessionRuntime close 정책: persistent(장수명) vs oneshot(mock=턴-스코프) | `session-runtime.ts:12-16`, `contracts/session-state.ts:1` (state: cold/live/busy/interrupting/error/closed) |
| RuntimeSupervisor 가 SessionRuntime 집합 소유(registry+idle pool), turn teardown(release) ≠ runtime close(releaseRuntime) | `features/sessions/supervisor.ts:1-15,103-134` |
| idle 풀 LRU 축출, 기본 cap 5(bootstrap 주입), IdleCloseTimer 폐기(0067) — 세션 수명=프로그램 종료 or LRU | `features/sessions/runtime-pool.ts:1-9`, `runtime-cap-policy.ts:22-30`, `supervisor.ts:8-9` |
| cap count 대상=active+idle runtime population, eviction victim=idle only | `runtime-cap-policy.ts:2-10`, `supervisor.ts:11-15` |
| ActiveTurnTracker=프로젝트별 active turn 회계(IPC concurrency 도메인) — runtime cap 과 별개 | `supervisor.ts:12-15`, `turn-coordinator.ts:65-70` |
| TurnCoordinator: 한 SessionRuntime 스트림 소비→턴-로컬 reduce→2 병렬 sink(persist∥forward), retry(MAX 2, backoff [1s,2s])·stall·settle 소유 | `turn-coordinator.ts:1-10,25-27` |
| 단일 턴 이벤트 파이프라인: `bus.emit('turn.event')` 단일 팬아웃, 구독 순서 usage→history→title→relay(bootstrap SSOT) | `@app/src/main/AGENTS.md` (§단일 턴 이벤트 파이프라인), `contracts/bus-events.ts:1-15`, `infra/bus/index.ts:22` (TypedBus) |
| chat 도메인 채널 5(send·event·cancel·stopSubagent·steerCancel), send=모든 프롬프트 단일 입구 | `@docs/IPC_CONTRACT.md §2·§2.1` |
| invoke 등록은 `infra/ipc/handle.ts` 헬퍼 경유(safeParse + 실패정책 reject\|fallback) | `@docs/IPC_CONTRACT.md §1`, `app/src/main/infra/ipc/handle.ts` |
| main→renderer push 헬퍼: `sendChatEvent`(wire 로그 포함)·broadcastConcurrency·sendInstallStatus·broadcastSessionTitle | `app/src/main/infra/ipc/send.ts:19-38` |
| SSOT 채널 총계 = 53 채널·17 도메인 | `@docs/IPC_CONTRACT.md §2:23-25` |
| 어댑터 파일명: `claude.ts`(구 claude-code.ts)·`claude-map.ts`·`claude-adapt.ts`, 조립기=`ExtensionBuilder` | `ls app/src/main/adapters`, `features/extensions/builder.ts:15` |

## 인수 기준 (Acceptance Criteria)

1. **runtime-ipc.md §1(동시성)** 재작성: "단일 inflight" 폐기 → 멀티세션 + 세션별 pending message queue(held/flushed/consumed) + 장수명 세션 채널(프레임) + RuntimeSupervisor(registry+idle pool, cap/LRU) + TurnCoordinator(2 sink·retry·settle) + ActiveTurnTracker. `pendingUserText`/`CapabilityBuilder` 리터럴 제거. 커밋=echo 관측 단일 경로 명시.
2. **runtime-ipc.md §2(IPC 핸들러)** 갱신: "총 31 채널·12 도메인" → SSOT 인용("총계는 IPC_CONTRACT §2 SSOT — 현재 53 채널·17 도메인"), 등록 패턴 코드샘플을 `infra/ipc/handle.ts` 헬퍼 + 버스 팬아웃으로 교체(구 `CapabilityBuilder.build()` 인라인 샘플 제거).
3. **overview.md §3(프로세스 트리)** 재작성: 5-슬라이스 레이아웃(`app/·contracts/·adapters/·features/·infra/`)으로 교체, §3.1 부트 시퀀스를 Bootstrap·버스 구독 순서 포함해 정정. `capabilities/`·구 `ipc/` 평면 트리 제거.
4. **overview.md §2·§4** 갱신: §2 stack 표 최종 날짜·SDK/어댑터 파일명(`claude.ts`) 정정, §4 상태표에서 멀티세션/pending queue/장수명 채널을 완료로 반영, "구 CapabilityBuilder" 표기 정합.
5. **adapters.md·terms.md**: `CapabilityBuilder` → `ExtensionBuilder`(경로 `features/extensions/builder.ts`) 정합(구명 병기).
6. **참조 문서 갱신**: `docs/AGENTS.md`(40→53 채널·도메인 목록)·`ARCHITECTURE.md`(adapters 설명의 CapabilityBuilder·날짜)·`arch/frontend/ux-domains.md`(31→SSOT 인용)·`arch/frontend/overview.md`+`TRD.md`(단일 inflight → 멀티세션/pending queue anchor 정정).
7. 게이트: 문서 전용(코드 게이트 N/A) — 정합성 grep(구 리터럴 잔존 0: `단일 inflight`·`pendingUserText`·`CapabilityBuilder`·`총 31 채널`·`40 채널`) + 링크 유효성 + 한국어 톤 유지.

## 범위 / 비범위

- **범위**: `arch/backend/{overview,runtime-ipc,adapters,terms}.md` + 참조 문서 `docs/AGENTS.md`·`ARCHITECTURE.md`·`arch/frontend/{overview,ux-domains}.md`·`TRD.md`(§10 anchor 문단).
- **비범위**:
  - `IPC_CONTRACT.md`(이미 SSOT 로 53 채널 최신) — 인용만.
  - `provider-runtime.md`·`standardization.md`·`persistence.md`·`security.md` 본문(런타임 재작업과 직접 드리프트 없음) — 링크/교차참조만 확인.
  - **코드 정리**(문서 아님): `app/src/main/` 최상위에 남은 빈/레거시 디렉토리(`ipc/chat`·`orchestration`)는 AGENTS.md 5-슬라이스 규약 위반 후보 — **본 핸드오프 비범위, 별도 정리 핸드오프 후보로 보고**.

## 의존 기술 / 전제

- 신규 의존성 **0**(문서 편집). 코드 변경 **0**.
- 전제: `IPC_CONTRACT.md` 의 53 채널·17 도메인이 채널 총계의 SSOT — 백엔드 arch 문서는 총계를 **재서술하지 않고 인용**한다(드리프트 방지).

## 설계

- **총계 비복제 원칙**: runtime-ipc §2 와 ux-domains 는 절대 수치를 박지 않고 "IPC_CONTRACT §2 가 SSOT" 로 위임 + 현재값 괄호 병기(갱신 지점 1곳화). overview §4 상태표는 존치(코드 상태 성격).
- **구조 트리(overview §3)**: `src/main/AGENTS.md` 레이어 매핑표를 정본으로 삼아 사본이 아니라 *요약 + 링크*. 드리프트 최소화를 위해 파일 열거는 슬라이스 대표 모듈만.
- **동시성(runtime-ipc §1)**: pending-message-queue.ts 헤더 주석 + session-runtime.ts 헤더를 근거로 held/flushed/consumed·프레임·persistent/oneshot·supervisor·cap 을 표로 정리. 코드가 정본임을 상단 배너로 유지.

## 파생 UX / 엣지케이스

- N/A (문서 작업 — 런타임 UX 없음). 단 문서 간 **교차 링크 유효성**(상대경로)·**구 §번호 매핑표**(ARCHITECTURE §3) 정합은 확인 대상.

## 리스크 / 트레이드오프

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 문서에 절대 채널 수를 재기입하면 다음 채널 변경에서 또 드리프트 | SSOT(IPC_CONTRACT) 인용 + 괄호 현재값으로 갱신 지점 1곳화 |
| overview §3 트리를 상세 복제하면 코드/AGENTS 와 3중 드리프트 | 대표 모듈만 + `src/main/AGENTS.md` 링크 위임 |
| 런타임 모델을 과하게 상술하면 코드 변경마다 문서 부채 | "코드 우선" 배너 유지 + 개념/불변식 위주(라인 수 나열 지양) |

- 되돌리기 어려운 결정: 없음(문서, git 복원 가능).
- **단독 결정 금지 항목**: 없음 — 새 설계가 아니라 기존 코드/확정 핸드오프(0062·0066~0070)의 사후 정식화. Open Question 을 새로 열지 않는다.

## 영향 받는 파일

- `docs/arch/backend/overview.md` · `runtime-ipc.md` · `adapters.md` · `terms.md`
- `docs/ARCHITECTURE.md` · `docs/AGENTS.md`
- `docs/arch/frontend/overview.md` · `ux-domains.md`
- `docs/TRD.md` (단일 inflight anchor 문단)

## 참고 문서

- `@app/src/main/AGENTS.md`(레이어 DAG·버스 파이프라인) · `@docs/IPC_CONTRACT.md §2`(채널 SSOT)
- 코드 정본: `features/chat/pending-message-queue.ts`·`turn-coordinator.ts` · `features/sessions/{session-runtime,supervisor,runtime-pool}.ts`

## 게이트

- 문서 전용 — 코드 게이트 N/A. 대체 검증: 구 리터럴 잔존 grep 0 + 상대링크 유효 + 채널 총계 SSOT 인용 정합.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 2-part 요구 인용, "정합화" 기준 추론 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인`·`@docs/…` 레퍼런스.
- [x] 인수 기준 — 7건, grep 으로 검증 가능.
- [x] 의존 기술 — 신규 의존성/코드 변경 0.
- [x] 파생 UX — N/A(문서) 명시, 링크 정합만.
- [x] 리스크 — 드리프트 재발 완화(SSOT 인용) 적시, Open Question 신설 없음.

---

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **백엔드 arch**: `arch/backend/runtime-ipc.md`(§1 동시성 재작성·§2 IPC+버스 파이프라인)·`overview.md`(§3 5-슬라이스 트리·§3.1 부트·§4 상태표·헤더)·`adapters.md`(§1.4 ExtensionBuilder 개명·§1.3/§3 참조·제목)·`terms.md`(ExtensionBuilder 항). **참조 문서**: `docs/AGENTS.md`(40→53 채널)·`ARCHITECTURE.md`(adapters 설명)·`arch/frontend/ux-domains.md`(§3.4 채널 SSOT+링크)·`TRD.md`(§10 멀티세션 anchor) |
| 게이트 결과 | 문서 전용(코드 게이트 N/A). 정합 grep: 활성 문서에서 `단일 inflight`·`총 31/40 채널`·`pendingUserText`·§1.4 `CapabilityBuilder` 잔존 0(broader claude-code/ChatEvent 개명은 비범위·후속). 링크: `../../IPC_CONTRACT.md`·`app/src/main/AGENTS.md`·overview §5 spec 링크 유효 |
| 놓친 잠재 문제(선조치 경계) | ⚠️ **보고만**: ① `app/src/main/` 최상위 빈 레거시 디렉토리 `ipc/`·`ipc/chat/`·`orchestration/`(0062 잔재 — 5-슬라이스 규약 위반) = **코드 정리, 별도 핸드오프 후보**. ② adapters.md §1.2/§1.3/§1.5·`claude-code-spec.md`·`GLOSSARY.md`·`PRD.md`·`provider-runtime.md` 의 `claude-code.ts`/`ClaudeCodeAdapter`/`ChatEvent`/`OrcaCapabilities` 잔존 = 저장소 전역 개명(0016·0027) 미완 = **naming-consistency 후속 핸드오프 후보**. 둘 다 본 핸드오프 비범위(구조/런타임 정합에 집중). |
| 블로커 / 역질문 | 없음 |
