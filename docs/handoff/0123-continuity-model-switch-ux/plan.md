# Plan — 0123-continuity-model-switch-ux

> 사용자 버그 리포트 4건(2026-07-17 라이브 세션) — 대화중 모델 변경 미반영 안내 · mock 핸드오프/분기 연속성 단절 · 핸드오프 새 세션의 컨텍스트 경고 잔존 · 세션 오픈 구간 보내기 버튼 inflight 표시. 비기능(버그수정·UX 정정) = Claude 직접 plan→impl→verify (0121·0122 선례).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0123-continuity-model-switch-ux` |
| 작성자 | Claude Code |
| 일자 | 2026-07-17 |
| 매핑 | PHASES 행 / PR (설계 PR 은 본 브랜치) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | "대화중 모델을 변경했을 시도했는데, 다음턴에 변경할 수 있다고만 안내되고 있음. 사용자 턴에 다시 확인해도 다음턴에 변경된다고만 답변함" | 라이브 세션 요청 (2026-07-17) |
| 명시 요구 2 | "mock 으로 context 사용량을 70% 이상으로 설정하고 핸드오프/분기 진행 시 대화가 이어지지 않는다. 기존 세션이 닫히지 않은 상태라서 영향을 주고 있는것인지?" | 라이브 세션 요청 |
| 명시 요구 3 | "context 사이즈가 빨간색 표시일때, 핸드오프로 새 세션이 열렸을때에도 빨간색으로 유지됨. 새 세션으로 간주돼야 함 → 도넛 표시 x, 컨텍스트 경고 x" | 라이브 세션 요청 |
| 명시 요구 4 | "세션이 새로 열리는 경우 (첫 메시지 보내기, 핸드오프+compact), 사용자 턴이 시작되기 전까지 보내기 버튼이 inflight 애니메이션 처리되어야 함" | 라이브 세션 요청 |
| 추론 의도 A | 요구 1 의 "안내"는 Orca UI 카피가 아니라 **어시스턴트 응답 텍스트**로 추정 — renderer i18n 카탈로그에 해당 문구("턴")가 0건이다(아래 자료조사 R1). 즉 "모델이 실제로 안 바뀌었거나, 모델 자신이 전환 사실을 모른다"는 문제로 해석한다. | 추론 (자료조사 R1 근거) |
| 추론 의도 B | 요구 3 의 "새 세션 간주"는 **핸드오프(요약 계승)** 에 한정하고, **분기(fork)** 는 원본 컨텍스트를 그대로 갖고 시작하므로 도넛 승계(0064 의도)가 유지된다고 해석한다. | 추론 → OQ2 로 사용자 확인 |
| 추론 의도 C | 요구 4 의 "inflight 애니메이션"은 세션 오픈 구간(아직 취소도 입력도 의미 없는 창)에 컴포저 액션 버튼이 "작업 중" 시각 상태를 보여야 한다는 요구로 해석 — 형태(스피너)는 기존 관용구 채택을 기본값으로 한다. | 추론 → OQ3 |

## Context (왜)

0064(fork/handoff) + 0067(장수명 채널) + 0118/0119(provider 경계) 이후 세션 연속성 UX 를 mock 으로 검증하던 사용자가 4건의 결함을 보고했다. 공통 축은 **"세션이 새로 열리는 경계"에서의 상태 정합**이다: (1) 라이브 채널 위 모델 전환의 실효성, (2) mock 어댑터의 continuity 충실도(핸드오프/분기 시뮬레이션 부재), (3) 핸드오프 도착 세션의 컨텍스트 텔레메트리 리셋, (4) 세션 오픈 구간의 컴포저 피드백.

## 자료조사 (Research)

### R1 — 모델 변경 경로 (요구 1)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| renderer i18n 에 "다음 턴에 변경" 류 카피가 없다 — ko.ts 에 "턴" 자체가 0건. UI 는 그런 안내를 만들지 않는다 → 안내 출처는 어시스턴트 응답(추론 A)일 가능성이 높다 | `app/src/renderer/src/shared/i18n/resources/ko.ts` grep("턴"=0건, "다음"=무관 6건) |
| 모델 선택은 턴 단위 전송 — 매 send 페이로드에 `providerKey`/`modelFamily` 가 실린다 | `app/src/renderer/src/features/chat/store/chatStore.ts:600-601` |
| main 은 턴마다 모델을 재해석해 `TurnRequest.model` 로 싣는다 | `app/src/main/app/chat-turn.ts:137-145,658` |
| 장수명 채널 생존 시 후속 턴은 `pushTurn` 으로 이어붙고, `req.model` 이 있으면 push 전에 `handle.setModel(model)` 라이브 적용한다 | `app/src/main/features/sessions/session-runtime.ts:151-161` · `app/src/main/adapters/claude.ts:448-456` |
| **자동 연속 턴(0067 AC7)은 원 턴의 request 를 스프레드 복사한다 — `model: resolved.model` 이 구 값 그대로 이월된다.** busy 중 모델을 바꾸고 steer 를 예약한 경우, 턴 종료 후 자동 연속 턴은 사용자가 바꾼 모델을 반영하지 않는다 (확정 코드 결함 후보) | `app/src/main/app/chat-turn.ts:679-715` (`contRequest = { ...request, … }` — model 미갱신) |
| steer 게이트 flush(진행 턴 내 주입)는 텍스트만 나른다 — 진행 중 턴의 모델은 불변(0119 설계와 정합, 결함 아님) | `app/src/main/app/chat-turn.ts:665-666` · `app/src/main/adapters/streaming-input.ts` |
| provider *경계를 넘는* 변경은 0118 이 채널 respawn 으로 해결했고, 0119 가 busy 중 steer 를 차단한다 — 본 건은 **같은 provider 내 모델 전환**의 라이브 채널 실효성 문제 | `docs/handoff/INDEX.md` 0118·0119 행 |
| 트랜스크립트/팝오버 어디에도 "이번 턴이 실제 실행된 모델"을 표시하지 않는다 — 사용자가 확인할 길이 어시스턴트에게 묻는 것뿐이고, 모델은 자기 정체를 시스템 프롬프트 이상으로 모른다 | `app/src/renderer/src/features/chat/components/transcript/MessageMeta.tsx:14-49` (모델 표시 없음) · telemetry 에는 `model` 필드 존재(`app/src/renderer/src/features/chat/lib/telemetry.ts`) |

### R2 — 핸드오프/분기 흐름 + mock 충실도 (요구 2)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 핸드오프 = 즉시 물질화: draft 엔트리(inflight=true) + `handoffFrom` send(text 는 main 이 `/compact [핸드오프]…` 자동 메시지로 대체) | `app/src/renderer/src/features/chat/store/chatStore.ts:818-862` · `app/src/main/features/orchestration/handoff.ts:11-22` · `app/src/main/app/chat-turn.ts:377-379` |
| 분기 = draft 프리필(이력 clone + fork_boundary 합성) 후 첫 send 에서 물질화(`forkFrom`), main 이 DB 복사 + lineage | `chatStore.ts:775-812` · `app/src/main/features/orchestration/fork.ts:19-47` |
| handoff mid-turn 가드 `supervisor.hasSession(handoffFrom)` 은 **진행 중 턴 레지스트리** 기준이다 — 턴 종료 `finally` 에서 `supervisor.release(turn)` 로 해제되므로, idle 세션(장수명 채널 생존 포함)은 가드에 걸리지 않는다. "기존 세션이 안 닫혀서 가드가 오발화"하는 구조는 아니다 (재현으로 최종 확정 필요) | `app/src/main/app/chat-turn.ts:343-353,716-723` · `app/src/main/features/sessions/session-registry.ts:13-15` · `supervisor.ts:103-110` |
| idle persistent 런타임은 레지스트리가 아닌 **pool** 에 세션 키로 보존된다(수명 = 종료/LRU) — mock 은 `pushTurn` 미구현이라 턴-스코프 소비(채널 자체가 없음) | `app/src/main/features/sessions/supervisor.ts:112-134` · `session-runtime.ts:172-183,185-205` · `app/src/main/adapters/mock.ts:39-61` |
| **mock 어댑터는 continuity 를 전혀 시뮬레이션하지 않는다**: `TurnRequest.forkFrom`/핸드오프 자동 메시지를 무시하고 현재 시나리오를 그대로 재생한다. `session.compacted` 를 내는 시나리오 스텝도 없다 → mock 환경에서 핸드오프 도착 세션은 "압축 경계 + 요약" 없이 일반 시나리오 응답만 받는다 = "대화가 이어지지 않는다" | `app/src/main/adapters/mock.ts:39-51` (`req.sessionId ?? randomUUID()`, forkFrom 미참조) · `mock-scenarios.ts:41-73` (compacted 스텝 부재) |
| mock telemetry 는 **전역 디버그 상태의 `contextUsageRatio` 를 세션 구분 없이** 보고한다 — 핸드오프 도착 세션의 첫 턴도 70%+ 로 보고돼 빨간 상태가 재생된다 | `app/src/main/adapters/mock-scenarios.ts:569-571,660-683` · `app/src/main/app/bootstrap.ts:89-94` (싱글턴) |

### R3 — 컨텍스트 도넛/경고 상태 (요구 3)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 도넛/경고 소스는 세션별 `lastTelemetry` 파생 — `contextTokens/contextWindowFor` 비율로 warn(0.6)/danger(0.85 또는 nearCompaction) 판정. `lastTelemetry` 부재 시 도넛·경고 모두 비표시(요구 3 의 "새 세션" 상태와 동형) | `app/src/renderer/src/features/chat/components/Composer.tsx:210-226,636-641` · `lib/contextWindow.ts` · `lib/telemetry.ts` |
| handoff draft 는 `lastTelemetry` 를 승계하지 않는다(fork 만 명시 승계) — 도착 직후 빨간 표시가 남는 건 승계가 아니라 **도착 세션 첫 턴(자동 /compact)의 telemetry 재시드** 때문 | `chatStore.ts:756-812` (fork 승계는 785행, handoff 는 없음) |
| reducer 는 `session.compacted` 에서 `lastTelemetry` 를 지우지만, 이어지는 같은 턴의 `telemetry` 가 `contextTokens>0` 이면 다시 채운다 | `app/src/renderer/src/features/chat/reducer/chatReducer.ts:406-421,423-438` |
| 실환경(claude)은 압축 턴 telemetry 를 이미 보정한다: compact 경계에서 스냅샷 무효화 + `post_tokens`/요약 크기 근사(0064 r5·0065 r2) → 실환경 잔존의 1차 용의자는 아님. **mock 은 이 보정에 대응하는 시뮬레이션이 없어** 전역 ratio 를 그대로 내보낸다(R2 마지막 행) | `app/src/main/adapters/claude-map.ts:169-194,401-427` |

### R4 — 세션 오픈 구간의 컴포저 버튼 (요구 4)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 현재 버튼 상태 2종뿐: inflight(빈 draft)=정지 버튼(`stop` 아이콘, `disabled={!canAbort}`), 그 외=보내기(`enter` 아이콘). "작업 중" 애니메이션 상태는 없다 | `app/src/renderer/src/features/chat/components/Composer.tsx:354-356,556-586` |
| 새 채팅 첫 전송은 낙관 `BEGIN_TURN` 으로 즉시 inflight, 핸드오프는 draft 를 `inflight: true` 로 시드 — 두 경우 모두 "세션 오픈 구간"은 `sessionId == null && inflight`(+ 승격 후에는 자동 /compact 턴 종료까지)로 식별 가능 | `chatStore.ts:493-556,844-861` |
| 스피너 관용구가 이미 있다: `animate-spin` + `motion-reduce:animate-none`(BootScreen·LoginView·FileAutocomplete) — 신규 CSS/의존성 없이 재사용 가능 | `app/src/renderer/src/app/boot/BootScreen.tsx:37` · `features/login/components/LoginView.tsx:47` |
| 취소 배선: `cancel()` 은 sessionId 부재 시 IPC 없이 로컬 상태만 정리(새-채팅 큐 항목은 큐 제거) — 오픈 구간의 "중단" 의미가 약하므로 애니메이션 상태로 대체해도 기능 상실이 작다. 단 실환경 첫 턴(스폰 후 스트리밍)은 sessionId 발급(session.updated) 후 중단 가능해져야 한다 | `chatStore.ts:650-670` |

## 인수 기준 (Acceptance Criteria)

> A=모델 변경, B=continuity 단절, C=컨텍스트 경고 리셋, D=오픈 구간 버튼.

1. **(A) 유휴 세션 모델 전환 실효**: 같은 provider 내에서 모델 A→B 로 바꾼 뒤 보낸 다음 사용자 턴이 **B 로 실행**된다 — 장수명 채널 생존(pushTurn) 경로 포함. 증거 = 그 턴 `telemetry` 의 `model`/`modelUsage` 키(와이어 로그 또는 mock 대체 불가 항목은 실기 검증 표에 명시).
2. **(A) 자동 연속 턴 모델 최신화**: busy 중 모델 A→B 변경(동일 provider) + steer 예약 → 턴 종료 후 자동 연속 턴(0067 AC7)이 **B** 를 싣는다. `chat-turn.ts` 연속 턴 조립이 이월 시점의 최신 선택(payload 재해석 또는 동등 수단)을 반영하고, 회귀 테스트가 있다.
3. **(A) 실행 모델 가시화**: 사용자가 어시스턴트에게 묻지 않고도 "직전 턴이 실제 실행된 모델"을 UI 에서 확인할 수 있다(기존 텔레메트리 팝오버(UsagePanel)의 model 표기 활용 또는 동등 표면 — 신규 표면 최소화). "다음턴 안내" 재현 결과(안내 출처가 어시스턴트 발화인지)를 verify 에 증거로 기록한다.
4. **(B) mock 핸드오프 연속성**: mock 활성 + `contextUsageRatio ≥ 0.7` 에서 핸드오프 실행 시 도착 세션에 ① 자동 메시지 user 버블(echo) ② `session.compacted` 경계 구분선 ③ 요약 assistant 메시지가 순서대로 표시되고, **이후 사용자 send 가 정상 응답**을 받는다(대화 계속).
5. **(B) mock 분기 연속성**: 같은 조건에서 분기 실행 시 이력 프리필 + `fork_boundary` 구분선이 유지되고 이후 send 가 정상 응답을 받는다.
6. **(B) 소스 세션 생존 영향 판정**: "기존 세션이 닫히지 않은 상태" 가 핸드오프/분기를 막지 않음을 검증으로 확정한다 — idle(비진행) 소스 세션에서 핸드오프가 mid-turn 가드(`chat-turn.ts:345`)에 걸리지 않고, 진행 중일 때만 기존 에러로 거부됨을 테스트/재현 증거로 기록. 실환경 소스 채널 생존 중 forkSession resume 정합은 "사람 실기 대기"로 분리.
7. **(C) 핸드오프 도착 세션 = 새 세션 취급**: 도넛이 빨간(danger) 상태에서 핸드오프로 열린 새 세션은 **도착 직후 도넛·경고등(pill)·상태 팝오버 진입점이 비표시**다(`lastTelemetry` 미시드). mock ratio 70~90% 설정에서도 동일. 이후 도착 세션의 **압축 후/실측 telemetry** 부터 정상 갱신된다(영구 숨김 아님).
8. **(C) 압축 턴 재시드 방지**: 핸드오프 자동 `/compact` 턴(및 세션 내 수동 /compact)의 telemetry 가 압축 *전* 규모로 도넛을 되돌리지 않는다 — mock 이 압축 후 근사값(claude-map 0065 보정과 동형의 축소 값)을 내도록 시뮬레이션하고, reducer 경로는 기존 `session.compacted` → telemetry 순서에서 회귀 테스트로 고정한다.
9. **(D) 오픈 구간 inflight 애니메이션**: (a) 새 채팅/분기 draft 첫 전송 후, (b) 핸드오프 클릭 후 — **사용자가 다시 입력 가능해질 때까지**(해당 턴 종료) 컴포저 액션 버튼이 "작업 중" 애니메이션 상태를 보인다. 기존 `animate-spin` 관용구 + `motion-reduce` 폴백, 시맨틱 토큰 준수. 세션 확정(session.updated) 후 중단 가능 시점부터는 기존 정지 버튼 동작이 유지된다.
10. **(D) 상태 전이 무결**: 오픈 구간 종료(telemetry/turn.aborted/error) 시 버튼이 보내기 상태로 복귀하고, 전송 실패(invoke 거부) 시에도 고착되지 않는다.
11. **게이트**: `cd app && npm run lint && npm run typecheck && npm test` 통과(egress 차단 시 DB 스위트 베이스라인 분리 보고 규칙 준수) + 레이어 경계 위반 0 + 신규 의존성 0.
12. **문서 동기**: IPC 채널 표면 무변경 확인(변경 시 `docs/IPC_CONTRACT.md` 동시 갱신). mock 시나리오 규약 변경은 `docs/arch/backend/provider-runtime.md` 해당 절(있으면) 갱신.

## 범위 / 비범위

- **범위**: renderer(`features/chat` store/reducer/Composer) · main(`app/chat-turn.ts` 연속 턴 모델, `adapters/mock*.ts` continuity 시뮬레이션) · 관련 단위 테스트.
- **비범위**:
  - 실환경(claude) 핸드오프의 forkSession resume 정합 실기 — 사람 실기 항목(AC6 후단).
  - fork 도넛 승계 정책 변경(OQ2 — 기본값: 현행 유지).
  - provider *경계를 넘는* 모델 전환(0118/0119 소관 — 회귀만 확인).
  - 세션별 mock ratio 분리 같은 디버그 패널 확장(전역 ratio 유지, 압축 시뮬레이션으로만 대응).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `mock-scenarios.ts` 스텝 DSL(emit/delay/telemetry) · `chatReducer` `session.compacted`/`telemetry` 경로 · `animate-spin` 관용구 · `UsagePanel` telemetry 표시.
- 전제 1: 어댑터 `LiveTurn.setModel`(SDK `Query.setModel`)이 라이브 채널에서 실효한다 — AC1 재현에서 확인하고, 실효하지 않으면(SDK 제약) respawn 폴백(0118 `teardownChannel` 재사용)으로 설계를 조정한다(구현 중 판정, 인수 기준 불변).
- 전제 2: mock 의 continuity 시뮬레이션은 `TurnRequest.forkFrom` 유무로 핸드오프/분기 도착 턴을 식별할 수 있다(`mock.ts` 가 `req.forkFrom`·`req.text` 의 `/compact [핸드오프]` 프리픽스를 참조 — 템플릿 문자열은 `orchestration/handoff.ts` 단일 출처라 프리픽스 상수 공유 필요 시 contracts/shared 로 승격하지 않고 **어댑터가 `/compact` 프리픽스만 인지**하는 최소 결합으로 한다).
- **신규 의존성: 없음.**

## 설계

### A. 모델 변경 실효 (AC1~3)

1. **재현 먼저**: 같은 provider 모델 2개 구성 → 유휴 세션에서 전환 → 와이어 로그(`ORCA_WIRE_LOG`)로 `setModel` 제어 요청/이후 assistant message 의 model 을 확인. "다음턴 안내"가 어시스턴트 발화임을 확정(추론 A 검증).
2. **자동 연속 턴 수정**(확정 결함 후보): `chat-turn.ts` 연속 루프에서 `contRequest` 조립 시 모델을 재해석한다 — 연속 턴 진입 시점의 세션 최신 선택은 renderer 가 보낸 마지막 payload 가 아니라 held 배치에 없으므로, **최소 수정**은 steer 예약 payload 의 `providerKey/modelFamily` 를 pendingMessages 항목에 동반 저장하지 않고, `permissionModes.setMode` 대칭의 세션 모델 SSOT 를 새로 만들지 않는 선에서: send 핸들러가 세션별 마지막 선택(providerKey/modelFamily)을 관리하는 기존 구조(`resolveModelForTurn` 입력)를 연속 턴에서 재호출한다. 구현 중 실측으로 최소 침습 지점을 확정하고 plan 대비 이탈은 `[구현자 기입]` 에 보고.
3. **가시화**: `UsagePanel`(도넛 팝오버) 의 telemetry 표시에 실행 모델이 이미 노출되는지 확인, 없으면 model 행 추가(카피 ko/en 동시).

### B. mock continuity 시뮬레이션 (AC4~6)

- `MockAdapter.sendMessage` 가 `req.forkFrom` 존재 + text 가 `/compact` 로 시작하면 **핸드오프 도착 시나리오**를 합성 재생: `session.updated` → `session.compacted`(pre/post tokens 포함) → 요약 `message.completed` → **압축 후 근사 telemetry**(ratio 무관 소값 — claude-map 0065 보정과 동형). `forkFrom` 만 있으면(분기) 기존 시나리오 재생 유지(이력은 main DB 복사가 담당).
- 시나리오 스크립트는 `mock-scenarios.ts` 에 `handoffArrivalFragment()` 로 추가(스텝 DSL 재사용, 단위 테스트 동반).
- idle 소스 + 핸드오프 정상 / 진행 중 소스 + 핸드오프 거부(기존 에러)를 mock 로 재현해 AC6 증거 확보.

### C. 도넛/경고 리셋 (AC7~8)

- **도착 직후**: handoff draft 는 이미 `lastTelemetry` 미승계(R3) — 잔존의 실원인인 "도착 턴 telemetry 재시드"를 B 의 압축 후 근사 telemetry 로 해소한다(mock). 실환경은 claude-map 보정이 기존 커버(R3).
- **이중 방어(renderer)**: `chatReducer` 에 "같은 턴에서 `session.compacted` 를 지난 뒤 도착한 telemetry 는 `lastTelemetry` 재시드를 스킵(비용 누산은 유지)" 게이트를 추가할지 구현 중 판단 — post_tokens 실측이 이미 축소값이면 불필요하므로, **mock/실환경 모두 근사가 도착하는 현 구조를 깨지 않는 범위**에서만. 채택 시 reducer 테스트 고정.
- 경고등 pill·상태 팝오버는 `conversationStatusModel`(Composer) 이 `lastTelemetry` 파생이므로 별도 수정 불요 — telemetry 정합만 맞으면 자동으로 비표시/갱신된다.

### D. 오픈 구간 버튼 (AC9~10)

- 판정을 순수 함수로 추출: `sessionOpeningInflight({ sessionId, inflight, handoffFrom, … })` — (a) `sessionId == null && inflight`(새 채팅/분기 첫 턴·핸드오프 물질화 직후) (b) 핸드오프 도착 자동 턴(승격 후 sessionId 확정, 첫 사용자 입력 가능 전) 은 `inflight && 사용자 메시지가 자동 메시지뿐` 등 상태 파생으로 식별 — 정확한 판정식은 구현에서 확정하되 단위 테스트로 고정.
- Composer 버튼 분기 확장: 오픈 구간 = 스피너 상태(비활성, `animate-spin`+`motion-reduce:animate-none`), 그 외 기존 정지/보내기 유지. `data-behavior="action:opening"` 류 DOM 마커는 dom-architecture 규약대로 data-attribute 로.
- 레이어: 판정 함수는 `features/chat/lib/`, UI 는 `features/chat/components/Composer.tsx` — 경계 이동 없음.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **오픈 구간 중 에러/중단**: 핸드오프 자동 턴이 error/turn.aborted 로 끝나면 스피너 해제 + 기존 에러 카드/게이트 해제(releaseNewChatGate) 경로 유지(AC10).
- **멀티세션**: 오픈 구간 판정·도넛 리셋은 엔트리(키) 단위 — 비활성 세션의 백그라운드 핸드오프 턴이 활성 화면의 버튼/도넛을 오염하지 않아야 한다(기존 키 라우팅 유지 확인).
- **연속 핸드오프**: 도착 세션에서 곧바로 재핸드오프(사용자 턴 <2 가드에 걸림) — 기존 가드 유지, 본 건 비변경.
- **모델 전환 + effort/권한모드**: 연속 턴 모델 재해석 시 effort·permissionMode 는 기존 이월 규칙 유지(모델만 최신화) — 과수정 금지.
- **테마/모션**: 스피너는 currentColor 기반 토큰 사용, `motion-reduce` 폴백(정적 표시) 필수. 접근성: 버튼 `aria-label` 을 "세션 준비 중" 류 카피(ko/en 동시 추가)로 교체.
- **mock off(실환경) 회귀**: mock 시뮬레이션 추가가 실 어댑터 경로에 영향 0 — `mock.ts`/`mock-scenarios.ts` 한정 확인.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 요구 1 의 근인이 SDK(라이브 setModel 미실효)면 앱 측 수정만으로 해결 불가 | 전제 1 의 respawn 폴백(0118 `teardownChannel` 재사용) — 채널 콜드 스타트 비용은 모델 전환 턴 1회 한정 |
| "다음턴 안내"가 순수 모델 발화(실제로는 전환 성공)일 가능성 | AC3 의 가시화가 본질 대응 — 사용자가 어시스턴트 발화 대신 UI 로 확인. verify 에 재현 증거 기록 |
| mock 핸드오프 시뮬레이션이 실 SDK 동작(포크된 컨텍스트·압축 요약)과 드리프트 | mock 은 이벤트 *형태* 충실도만 보장(요약 내용은 고정 문안) — 실환경 검증 항목은 사람 실기로 분리(검증 책임 분리표) |
| reducer telemetry 게이트(이중 방어) 과적용 시 정상 턴 도넛 미갱신 | 채택 시 "compact 경계를 지난 같은 턴" 한정 + 회귀 테스트. 불필요하면 미채택(구현자 판단 보고) |
| 연속 턴 모델 재해석이 0067 자동 연속 불변식(fork/프렐류드 미계승)과 얽힘 | 모델 필드만 갱신, 나머지 이월 규칙 불변 — `chat-turn.continuity` 테스트 확장으로 고정 |
| 오픈 구간 판정식이 스트리밍 상태 경합(승격 전 이벤트 폴백 라우팅)과 어긋날 수 있음 | 순수 함수 + 단위 테스트, CDP mock 실기로 시각 확인(메모리 노트의 무인 검증 경로) |

- 되돌리기 어려운 결정: 없음(전부 renderer/mock/조립 수준 — 스키마·IPC·DB 무변경).
- **단독 결정 금지 항목(Open Question)** → 사용자에게:
  - **OQ1 (요구 1 재현 정보)**: "다음턴에 변경된다"는 안내를 본 위치가 ① 어시스턴트 응답 버블인지 ② 다른 UI 인지, 당시 전환이 같은 provider 내 모델 간이었는지 확인 부탁. (설계는 ① + 동일 provider 가정으로 진행 — 다르면 조사 재개)
  - **OQ2 (fork 도넛)**: 분기(fork)는 원본 컨텍스트를 그대로 갖고 시작하므로 도넛 승계(0064 의도)를 유지하는 게 기본값 — 핸드오프만 리셋. 동의?
  - **OQ3 (애니메이션 형태)**: 오픈 구간 버튼은 기존 스피너 관용구(`animate-spin` 링)를 기본값으로 함. 다른 시각(펄스 등) 원하면 지정.

## 영향 받는 파일

- `app/src/main/app/chat-turn.ts` — 자동 연속 턴 모델 재해석(A2).
- `app/src/main/adapters/mock.ts` · `mock-scenarios.ts` (+ 테스트) — continuity 시뮬레이션(B·C).
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` (+ parts 테스트) — (조건부) compact 후 telemetry 게이트(C).
- `app/src/renderer/src/features/chat/lib/` — 오픈 구간 판정 순수 함수(D, 신규 소파일).
- `app/src/renderer/src/features/chat/components/Composer.tsx` · `features/chat/components/UsagePanel.tsx` — 버튼 상태(D)·실행 모델 표기(A3).
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` — 신규 카피(aria/모델 행).

## 참고 문서

- `docs/handoff/0064-*`(continuity 설계) · `0067-*`(장수명 채널·자동 연속 턴) · `0118-provider-boundary-respawn` · `0119-busy-steer-provider-gate` · `0122-*`(상태 팝오버).
- `docs/IPC_CONTRACT.md` — 채널 무변경 확인용.
- `docs/arch/frontend/state.md` §1.4 (chat store) · `docs/arch/frontend/dom-architecture.md` (data-behavior 마커).

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (egress 차단 환경은 순수 스위트 + 베이스라인 분리 보고).
- 신규 테스트 요구: ① `chat-turn.continuity` 연속 턴 모델 최신화 ② mock handoff arrival 시나리오(`mock-scenarios.test.ts`/`mock.test.ts`) ③ (채택 시) reducer compact-후-telemetry 게이트 ④ 오픈 구간 판정 순수 함수.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 4건을 라이브 세션 요청으로 인용했고, 추론 A~C 를 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 코드 `파일:라인`/문서 레퍼런스를 붙였고, 미확정 사항(안내 출처·setModel 실효)은 추론/전제/OQ 로 분리했다.
- [x] 인수 기준 — 12개 번호, R1~R4 조사에 근거, 기계 검증 가능 항목과 사람 실기 항목을 구분했다.
- [x] 의존 기술 — SDK setModel 실효를 전제 1 로 명시(폴백 포함), 신규 의존성 없음.
- [x] 파생 UX — 에러/멀티세션/모션·접근성/실환경 회귀를 펼쳤다.
- [x] 리스크 — SDK 제약·mock 드리프트·게이트 과적용을 적고, OQ 3건을 사용자로 분리했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 직접). 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다.

## [구현자 기입] 설계 리뷰 (비판적)

- 기존 설계는 busy 중 모델 변경만 후속 턴에 반영하는 방향이어서, 권한·effort 등 Composer 선택이 메시지와 분리되는 시간차 버그를 남길 수 있었다. 사용자 정정에 따라 텍스트·첨부와 `providerKey/modelFamily/permissionMode/effort` 전체를 메시지별로 스냅샷하고 main 이 해석한 실제 모델 id 도 함께 보존했다.
- 기존 0119 renderer provider 차단은 새 정책(경계 메시지도 queue 로 수리)과 정면 충돌했다. renderer 의 차단·`turnProviderKey` 상태·전용 카피/테스트를 제거하고, 실제 실행 모델과 런타임 capability 를 아는 main 으로 분류 책임을 모았다.
- 단순히 "마지막 모델"만 읽으면 먼저 queue 된 메시지를 취소하거나 설정을 되돌린 뒤 후속 메시지가 steer 로 앞질러 갈 수 있다. 첫 queue 판정이 세션별 sticky barrier 를 만들고, 원인 메시지 단건 취소 뒤에도 assistant 턴 종료 전까지 유지되도록 했다.
- provider 와 effort 는 spawn-bound, 같은 provider 의 모델과 permission 은 live-mutable 이라는 차이를 분리했다. provider/effort 경계는 채널 teardown+resume, 모델은 기존 `pushTurn.setModel`, permission 은 즉시 라이브 적용과 후속 요청 스냅샷을 함께 사용한다.
- mock 이 `/compact` 문자열을 추측하는 설계는 명령 문구 변경과 사용자 수동 compact 를 혼동한다. 내부 `continuityKind` 계약을 추가해 handoff 만 명시적으로 축소 telemetry 시나리오를 선택하게 했다.
- 핸드오프 후 telemetry 자체를 숨기는 것은 사용자 정정과 반대다. compact 후 작은 telemetry 를 도넛/일반 UsagePanel 에 유지하고, 기존 안전 상태 파생이 경고 pill·상태 팝오버만 자연히 숨기게 했다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | handoff 는 `session.updated`가 compact 턴 종료보다 먼저 와 일반 `sessionId == null` 판정만으로는 스피너가 너무 일찍 끝남 | `handoffFrom + 자동 user 턴 1개 이하`를 별도 오픈 상태로 판정 | `sessionOpening.test.ts` |
| 2 | 스피너 버튼만 비활성화해도 Enter 키가 submit 경로를 우회할 수 있음 | `submit()` 자체에 `sessionOpening` 가드 추가 | `Composer.tsx` |
| 3 | 선택 모델명과 provider 가 보고한 실제 실행 모델이 다를 수 있음 | UsagePanel 은 오직 `telemetry.model`만 표시하고 선택값/modelUsage 첫 키를 폴백으로 쓰지 않음 | `UsagePanel.tsx` |
| 4 | 전역 mock ratio 70~90%가 handoff 직후에도 빨간 경고를 재시드함 | handoff 시나리오가 compact `postTokens=9k`와 동일한 9k telemetry 를 명시 | `mock-scenarios.test.ts` |

## [구현자 기입] 구현 체크리스트

- [ ] A1 실 Claude 와이어 로그 증거 — 코드/자동 테스트 완료, 검증 턴 실기 책임으로 분리
- [x] A2 연속 턴 전체 선택 재해석 + queue/barrier 테스트
- [x] A3 실행 모델 가시화(`telemetry.model` 단일 소스)
- [x] B mock continuity 명시 시뮬레이션 + 테스트
- [x] C compact 후 축소 telemetry·도넛 유지·안전 상태 파생 정합
- [x] D 오픈 구간 버튼 상태 + 판정 함수 테스트 + Enter 우회 가드
- [x] 자동 게이트
- [ ] CDP mock 시각 확인 — 검증 턴/사람 확인 책임

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `adapters/{turn,mock,mock-scenarios}.ts`, `app/chat-turn.ts`, `contracts/turn.ts`, `features/chat/{pending-message-queue,selection-boundary}.ts` 및 테스트. renderer: `Composer.tsx`, `UsagePanel.tsx`, `sessionOpening.ts`, chat store/reducer의 0119 gate 제거·대체 테스트, ko/en. 문서: `docs/IPC_CONTRACT.md`. |
| 실행 명령 | `npm run lint`; `npm run typecheck`; 관련 Vitest 78개; `npm test`(sandbox 실패 원인 분리 후 권한 환경 재실행) |
| 게이트 결과 | lint 오류 0(기존 React Compiler 경고 1), typecheck node/web/test 통과, Vitest **942/942**, scripts **25/25**. 신규 의존성·IPC 채널·DB 변경 없음. |
| 블로커 / 역질문 | 구현 블로커 없음. 실 Claude 동일-provider 모델 전환 와이어 로그와 CDP 시각 확인은 검증 책임으로 남김. |
| 대상 커밋 | `4f1d4b4` |

## [구현자 기입] r2 실환경 모델 전환 교정

### 비판적 재검토

- r1은 Claude SDK의 `setModel()` 성공 응답을 실제 추론 모델 전환의 보증으로 취급했다. 사용자가 제공한 실측에서는 Haiku 선택과 응답 문구에도 불구하고 root assistant telemetry가 Sonnet을 보고했으므로 이 전제는 폐기했다.
- 모델과 effort를 채널 생성 시 고정되는 binding으로 승격했다. 둘 중 하나가 달라지면 기존 persistent channel을 teardown하고 동일 provider session을 resume하여 새 설정으로 spawn한다. permission은 SDK가 지원하는 live 변경으로 유지한다.
- busy queue를 먼저 flush한 뒤 채널을 폐기하면 아직 소비되지 않은 입력을 잃을 수 있다. 따라서 마지막 메시지의 선택 스냅샷으로 경계를 판정하고 채널을 먼저 폐기한 뒤, queue를 `takeForRespawn()`으로 회수하여 마지막 메시지를 prompt, 앞선 메시지를 prelude로 재구성한다.
- `modelUsage`의 첫 키는 과금 집계일 뿐 현재 root assistant의 실행 모델을 보장하지 않는다. root assistant `message.model`을 `telemetry.model`의 SSOT로 사용하고, child tool assistant 모델은 덮어쓰지 않으며 result 경계마다 상태를 초기화한다.
- 요청 모델과 provider가 보고한 실제 모델이 다르면 응답은 그대로 보존하되 `model.mismatch` wire 진단을 남긴다. bare alias(`haiku`)와 full id(`claude-haiku-4-5-20251001`)는 같은 모델로 비교한다.

### 구현 체크리스트 r2

- [x] SDK live `setModel` 경로 제거
- [x] model/effort 변경 시 teardown + 동일 세션 resume
- [x] busy queue 회수 순서에서 메시지 유실 방지
- [x] root assistant 실제 모델을 telemetry SSOT로 사용
- [x] 요청/실행 모델 불일치 wire 경고
- [x] 동일 binding 재사용·model/effort 변경 respawn·telemetry 매핑 단위 테스트
- [ ] AC1 실 Claude Sonnet→Haiku 와이어 로그 재검증

### 구현 보고 r2

| 항목 | 내용 |
|---|---|
| 변경 파일 | `session-runtime.ts`, `chat-turn.ts`, Claude adapter 계약/구현, `claude-map.ts`, `selection-boundary.ts`, `turn-coordinator.ts`, `ipc.ts` 및 관련 테스트 총 20개 파일 |
| 실행 명령 | `npm run lint`; `npm run typecheck`; 관련 Vitest 10개 파일; `npm test`; `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint 오류 0(기존 React Compiler 경고 1), typecheck node/web/test 통과, 관련 Vitest **106/106**, scripts **25/25**. 전체 Vitest는 **911/949** 통과, 실패 38건은 모두 설치된 `better-sqlite3` Electron ABI 140과 Node ABI 127 불일치로 분리 확인했다. |
| 블로커 / 검증 대기 | 구현 블로커 없음. 외부 API 비용이 드는 실 Claude Sonnet→Haiku 호출은 검증 턴에서 와이어 로그의 root assistant model과 telemetry model 일치를 확인해야 한다. |
| 대상 커밋 | `d61c4e2` |
