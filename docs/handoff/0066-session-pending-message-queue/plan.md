# Plan — 0066-session-pending-message-queue

> 브랜치 `claude/handoff-59-steer-queue-kavl7q` 마이그레이션 판정 + 세션별 **pending message queue** 개념 도입 리팩토링. 비기능 = Claude 직접 구현(plan → impl → verify).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0066-session-pending-message-queue` |
| 작성자 | Claude Code |
| 일자 | 2026-07-04 |
| 매핑 | PHASES 후속 승격 |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | `claude/handoff-59-steer-queue-kavl7q` 를 현 main 에 마이그레이션 | 라이브 세션 요청(2026-07-04) |
| 명시 요구 2 | 불만족 코드 과감히 제거, 요구사항 만족하는 효과적 코드만 대상 | 〃 |
| 명시 요구 3 | 오버엔지니어링 회피 — simple is best | 〃 |
| 명시 요구 4 | **세션별 pending message queue 개념 도입** — 일반 메시지와 steer 메시지의 통로. 사용자 턴=일반 메시지 즉시 커밋, 어시스턴트 턴=예약 메시지(steer, PostToolBatch 에 커밋) | 〃 |
| 명시 요구 5 | 큐는 renderer 가 간접 관찰 가능, steer 는 flush 전까지 취소 가능 | 〃 |
| 추론 의도 A | 요구 4·5 는 *이미 main 에 착지한* steer 구현(0059/0060 D1~D5)의 **개념적 일원화·리네임**을 뜻한다 — 물리적 코드 이식이 아니라(아래 조사: 이식 대상 0) 흩어진 steer 어휘를 "세션 pending message 통로" 1급 개념으로 승격 | 추론(조사 §1 근거) |
| 추론 의도 B | "PostToolBatch 에 커밋" = 게이트 훅에서 stdin **flush**(주입). 커밋(DB 영속) 자체는 echo 관측 시점 — 0060 D1 설계 유지가 사용자 의도("취소는 flush 전까지")와 정합 | 추론(0060 D3 취소 창 정의와 일치) |

## Context (왜)

0059(steer 피드백 큐)·0060(flush 경계 + 파생 D1~D5)은 구(pre-0062) 구조 브랜치에서 진행됐고, 사용자는 그 후속으로 브랜치를 현 main(0062 feature-slice 구조)에 이식하며 개념 정리를 요구했다. 조사 결과 **코드 이식은 이미 완료** 상태다 — 남은 실작업은 (a) steer 전용 어휘로 남은 큐를 "세션별 pending message queue" 개념으로 일반화하고, (b) 라운드를 거치며 남은 데드 코드·예약 seam 을 제거하는 것.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **§1 마이그레이션은 완료 상태.** 대상 브랜치의 merge-base 이후 4 커밋(aaa868d·90e49f5·bd2dbcc·917b613)은 전부 main 에 patch-equivalent 로 재착지됨(`git cherry main <branch>` 전건 `-`; main 측 대응 커밋 16c2c62·7d7cfe3·646f26b·e0f9305). 브랜치가 못 가진 후속(D3·D4 impl `55b5127`, D5 `a115bc1`)까지 main 이 앞서 있고, 0062 재구조화로 `features/chat/` 에 배치됨 | `git cherry` 실행 결과(verify 에 재현 명령 수록) · `git log main --grep steer` |
| §2 현행 큐: `SteerQueue` — held(취소 가능) → flushed(PostToolBatch 게이트 `flushHeld`, stdin 주입) → consumed(echo 관측 `markConsumed`) → `drainConsumed`(턴 중 커밋) / `drainForFlush`(다음 send 이월 전량 회수). 세션 키 단위 | `app/src/main/features/chat/steer-queue.ts` |
| §3 일반 메시지 경로: `chat:send` 가 이월 pending 을 `drainForFlush` 로 회수해 새 user row *앞에* 영속 + 프롬프트 병합 — 큐와의 상호작용이 ad-hoc 블록으로 존재(개념 미명명) | `app/src/main/app/chat-turn.ts:412-441` |
| §4 renderer 간접 관찰: `steer.queued/flushed/cancelled` 이벤트 → `pendingSteer` 상태 + send 시점 carryover 로컬 커밋. 취소는 held 만(`cancel` 이 held 컬렉션만 봄) — **요구 5 는 현행 충족** | `chatStore.ts:351-378,509-520` · `steer-queue.ts:54-64` |
| §5 데드 코드: `SteerQueue.hasConsumed` — prod 참조 0(테스트만) | `rg hasConsumed app/src` |
| §6 예약 seam 데드: `AdmissionDecision` 의 `queue`/`steer` kind(0056 framework-only) — 기본 정책이 반환하지 않고, enact 분기는 reject 와 동일 에러만 발신. 실체는 explicit `chat:steer`(0059 설계전환) + 본 큐가 대체 — seam 존치는 오버엔지니어링(요구 3) | `admission-policy.ts:16-18` · `chat-turn.ts:177-191` · INDEX 0059 "AC5 설계전환" |
| §7 어댑터 경계 어휘 `takeSteerFlush`·`SteerFlushBatch`·IPC `steer.*` 는 경계에선 정확한 말(스티어링 주입/관찰) — 0061 F2 선례(경계 어휘 보존, 내부 식별자만 리네임) 준용 | `adapters/turn.ts` · `0061` INDEX 행 |

## 인수 기준 (Acceptance Criteria)

1. **마이그레이션 판정**: 대상 브랜치 4 커밋의 main patch-equivalence 를 verify 에 증거(`git cherry` 출력)로 기록 — 추가 코드 이식 0 건 확정.
2. **개념 승격**: `features/chat/steer-queue.ts` → `pending-message-queue.ts`, `SteerQueue` → `PendingMessageQueue`, `SteerQueueItem` → `PendingMessage`. 모듈 헤더에 통로 개념 명문화 — *세션별 pending message queue = 사용자발 메시지의 단일 스테이징 통로. 사용자 턴(세션 idle): 일반 메시지는 머물 이유가 없어 즉시 커밋(이월 pending 이 있으면 먼저 drain·커밋). 어시스턴트 턴(inflight): 예약(held) → PostToolBatch 게이트 flush → echo 커밋.*
3. **API 정리**: `drainForFlush` → `drainAll` 리네임(의미: 턴 밖 전량 회수 = 사용자 턴 진입 시 이월 커밋), 데드 `hasConsumed` 제거. `rg "drainForFlush|hasConsumed|SteerQueue" app/src` 0건.
4. **의존부 리네임**: `ChatDeps.steerQueue`·`TurnCoordinatorDeps.steerQueue` → `pendingMessages`(타입 `PendingMessageQueue`), bootstrap 생성부 포함. held/flushed/consumed 수명·echo 매칭·carryover 동작은 **무변경**(동작 보존 리팩토링).
5. **예약 seam 제거**: `AdmissionDecision` = `accept | reject` 로 축소, `enactAdmissionDecision` 데드 분기 제거, admission 테스트 정합. admission 의 "후속 steer/queue 정책 교체" 주석도 현실(본 큐가 그 실체)로 갱신.
6. **경계 무변경**: IPC 채널/이벤트(`steer.*`)·preload·renderer·DB diff 0. `takeSteerFlush`·`SteerFlushBatch` 어댑터 경계 어휘 보존(조사 §7).
7. **게이트**: `npm run lint` / `typecheck`(node+web+test) / `npm test` green, boundaries 위반 0, 신규 의존성 0.
8. **문서 정합**: `app/src/main/AGENTS.md` 등 steer-queue 파일명 참조 갱신(있으면), INDEX·PHASES 승격.

## 범위 / 비범위

- **범위**: main 프로세스 내부 리네임·데드코드 제거·주석 개념 명문화, 그에 따른 테스트 파일 정합.
- **비범위**: IPC 채널 통합(chat:send/steer 단일화 — 첨부·모델 등 턴-시작 전용 페이로드와 결이 달라 현행 2채널 유지가 단순), inflight 중 `chat:send` 를 예약으로 전환(admission reject 유지 — 중복 send 는 race 가드가 옳음), renderer `pendingSteer` 어휘 변경, 새 기능 0.

## 의존 기술 / 전제

- 기존 모듈만: `PendingMessageQueue`(구 SteerQueue)·`TurnCoordinator`·`chat-turn`·`bootstrap`·admission 3종. 신규 의존성 0, SDK 무변경.
- 전제: 0060 D1~D5 동작(게이트 훅 flush·echo 커밋·carryover)은 검증 PASS 상태 — 본 작업은 동작 보존.

## 설계

- **리네임 축**: 파일/클래스/아이템 타입/의존 필드명 + 관련 주석의 SteerQueue 참조. 어댑터·IPC 경계 어휘는 보존(0061 F2 선례).
- **개념 주석(요구 4·5 의 문서화)**: 큐 모듈 헤더가 두 커밋 경로를 1급으로 서술 — ① 사용자 턴 경로: `chat:send` 가 `drainAll` 로 이월 pending 을 먼저 커밋(새 user row 앞 영속+프롬프트 병합) 후 새 메시지 즉시 커밋 ② 어시스턴트 턴 경로: `chat:steer` → held(취소 창 100%) → `flushHeld`(PostToolBatch) → `markConsumed`(echo) → `drainConsumed` 커밋. renderer 관찰 표면(steer.* 이벤트)과 취소 규칙(held 한정)도 헤더에 명시.
- **admission 축소**: `AdmissionDecision` 2-kind 화 → `enactAdmissionDecision` 이 boolean 반환 단순 함수로. 정책 인터페이스(`AdmissionPolicy`)는 유지(메커니즘/정책 분리 자체는 유효).

## 리스크 / 트레이드오프

- 리네임 범위가 테스트 4~5 파일에 걸침 — 순수 식별자 치환이라 회귀 위험 낮음, 게이트로 확인.
- `AdmissionDecision` kind 축소는 0056 의 "예약 seam" 을 폐기하는 결정 — 근거: 그 seam 이 예약한 미래(steer/queue enactment)가 0059/0060 에서 *다른 형태*(explicit chat:steer + 본 큐)로 이미 실현됨. 되돌리기 쉬움(2 kind 재추가).

## 설계 self-review 체크리스트

- [x] 의도 분리(명시/추론) 기재 — 추론 A·B 표기
- [x] 조사 레퍼런스 전건 명시(코드 라인·git 명령)
- [x] 인수 기준 번호화·검증 가능
- [x] 신규 의존성 0 — 승인 불요
- [x] Open Question 해당 없음(PRD §11/TRD §15 무관 — 내부 리팩토링)

## [구현자 기입]

### 설계 리뷰

- 설계대로 구현. AC6(경계 무변경)은 커밋 대상 11파일이 전부 `src/main/**` 임으로 구조적으로 보장.

### 놓친 잠재 문제 + 대응

- ✅ Windows Git Bash `sed` 가 한글 패턴 2건 치환 실패 → ASCII 토큰(`SteerQueue`)만으로 재치환 후 `rg` 0건 재검.
- ✅ 워킹트리 대량 `M` 은 CRLF 노이즈(`--ignore-cr-at-eol` 실변경 0) — 커밋 대상을 명시 경로로 한정해 오염 방지.

### 변경 파일 / 게이트 결과

- 변경: `pending-message-queue.{ts,test.ts}`(구 steer-queue rename) · `turn-coordinator.{ts,test.ts}` · `chat-turn.ts` · `bootstrap.ts` · `admission-policy.ts` · `admission-controller.test.ts` · adapters 주석 3건(`claude.ts`·`streaming-input.ts`·`turn.ts`).
- 게이트: lint ✅ · typecheck(node+web+test) ✅ · test **678 passed (90 files)** ✅. 신규 의존성 0.
