# Plan — 0069-turn-open-consume-on-response

> 0068 wire 실측 후속(사용자 확정 "a로 진행", 2026-07-05). 비기능(정밀 보강) = Claude 직접 plan→impl→verify.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0069-turn-open-consume-on-response` |
| 작성자 | Claude Code |
| 일자 | 2026-07-05 |
| 매핑 | PHASES 행 (0067·0068 후속) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 훅 라이프사이클 기준으로 "echo 재확인은 과한 장치" — flush/consumed 판정을 훅·라이프사이클 지점으로 단순화하자는 검토 의견 → 제안 3안 중 **"(a) 턴-시작 배치=응답 시작 소비·steer=echo 유지 보강을 바로 구현"을 확정** | 라이브 세션(2026-07-05) "a로 진행" |
| 추론 의도 | echo 를 전면 제거하는 것이 아니라, echo 가 실제로 잉여인 경계(턴-시작)에서만 제거 — steer 의 echo 필요성(uuid 상관·판정-후)은 실측 논의로 합의됨 | (추론 — (a) 안의 정의 자체가 이 경계를 담음) |

## Context (왜)

0068 wire 실측이 확정한 사실: ① UserPromptSubmit 은 push 프롬프트에도 발화하나 **input 에 uuid 가 없고**(keys 실측) `session.updated` **이전에 발화**(새 세션 rekey 전 — 훅-커밋 불가 케이스), ② `input.echo` 는 uuid 를 보존하나 **모델 출력 시작 이후**(reasoning 델타 도중)에 도착한다. ②에서 좁은 창이 남는다 — 첫 *영속* 어시스턴트 파트(도구-first 턴의 `tool.call.started` 등)가 echo 를 앞지르면 DB 가 `[assistant][user][assistant]` 로 기록된다(라이브는 0068 낙관 커밋이라 무관, 재로드 한정).

해소 원리: **턴을 연 배치(프렐류드+프롬프트)는 응답 시작 자체가 소비의 증거다** — 모델이 출력을 냈다는 것은 그 입력을 봤다는 뜻이고, CLI 는 턴 시작에 프렐류드+프롬프트를 coalesce 소비한다(0067 명세 C9). 반면 steer(mid-turn 주입)는 "응답 진행 중"이 소비 증거가 못 되므로(D2 — 모델이 못 본 텍스트를 committed 로 굳히지 않는다) echo 가 유일한 정밀 신호로 유지된다. 이는 사용자의 "echo 과잉" 직관의 타당한 절반(턴-시작에선 echo 가 실제 잉여)을 코드로 수용하고, 0068 verify 의 Open Question(커밋 신호 echo→훅 교체)을 닫는다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| UserPromptSubmit hook input keys = `session_id·transcript_path·cwd·permission_mode·hook_event_name·prompt` — uuid 부재, 발화 위치 `session.updated` 이전 | 사용자 wire 로그(2026-07-05, 0068 계측) |
| `input.echo` 는 reasoning 델타 도중 도착, uuid=큐 아이템 id 보존, 직후 `message.committed` | 사용자 wire 로그(동일) |
| 커밋 앵커 = echo 뒤 첫 비-echo 이벤트(전 이벤트 직전 `commitConsumed`) — reasoning 유무와 무관 | `turn-coordinator.ts:190·246·260` |
| 델타(transient)는 미영속 — DB 정렬 위험은 첫 영속 파트(`message.reasoning`·`tool.call.started`·`message.completed`)가 echo 를 앞지르는 경우뿐 | `features/history/writer.ts` persist switch |
| 턴-시작 uuid 는 이미 코디네이터 입력에 있다 — `TurnRequest.promptUuid`(아이템 배치)·`preludes[].uuid`(이월 배치) | `adapters/turn.ts:141-145` · `app/chat-turn.ts:594-603` |
| `markConsumed` 는 미소비(!consumed) 배치만 매칭 — 늦은 echo 는 이미 소비된 배치에 매칭 실패로 무해(이중 커밋 구조적 불가) | `pending-message-queue.ts:166-183` |
| 기존 steer 테스트의 REQUEST 는 promptUuid 없음 — 게이트 flush 배치는 턴-시작 집합에 안 들어 D2 회귀 없음 | `turn-coordinator.test.ts:33·244-274` |

## 인수 기준 (Acceptance Criteria)

1. **턴-시작 소비**: `request.promptUuid` + `request.preludes[].uuid` 배치는 프레임의 **첫 모델 출력 이벤트**(`message.delta`·`message.reasoning.delta`·`message.reasoning`·`message.completed`·`tool.call.started`)에서 echo 없이 소비 확정되고, 같은 이벤트의 persist *직전* 에 커밋된다(user row 가 항상 첫 영속 어시스턴트 파트보다 앞 — 도구-first 재로드 정렬 창 소멸).
2. **무출력 보호**: 모델 출력 없이 끝난 턴(즉시 telemetry·에러)은 소비하지 않는다 — 미소비 배치는 respawn 이월(takeForRespawn) 대상으로 잔존(D2 보존).
3. **늦은 echo 무해**: 이미 소비된 턴-시작 배치에 도착하는 echo 는 매칭 실패로 무시 — 이중 커밋 0.
4. **steer 불변**: mid-turn 게이트 flush(flushHeld) 배치는 모델 출력으로 소비되지 않는다 — echo 가 유일한 신호(기존 D1·D2 테스트 전부 green).
5. **게이트**: lint 0 · typecheck 3종 0 · vitest 전체 green(신규 테스트 포함) · build green. 신규 의존성·IPC·renderer 변경 0.

## 범위 / 비범위

- **범위**: `turn-coordinator.ts`(소비 앵커) + 큐/턴 주석 갱신 + 테스트.
- **비범위**: echo 관측 자체의 제거(steer 커밋 신호로 유지 — 본 결정으로 0068 OQ 종결), UserPromptSubmit 프레임-오픈 배선(0067 ⚠️ 별건), renderer.

## 설계

- `turn-coordinator.ts` 모듈 상수 `MODEL_OUTPUT_EVENTS`(위 5종). `run()` 서두에서 `turnOpenUuids = [...preludes uuid, promptUuid]` 수집, 이벤트 루프에서 echo 처리 다음·`commitConsumed` **이전**에 `!turnOpenConsumed && turn.dbSessionId && MODEL_OUTPUT_EVENTS.has(ev.type)` 이면 각 uuid 를 `markConsumed` — 직후의 기존 `commitConsumed` 가 같은 이벤트 persist 전에 user row 를 커밋한다(신규 커밋 경로 0 — 소비 *판정* 만 추가).
- dbSessionId·큐 rekey 는 `session.updated` 이터레이션에서 완료되고 모델 출력은 그 뒤에 오므로 키 정합이 보장된다(0068 실측 순서: init → 출력).
- 부수 이득: echo 를 방출하지 않는 mock 어댑터 턴도 user row 영속이 성립하게 된다.

## 파생 UX / 엣지케이스

- 취소·스폰 실패로 출력 0 → AC2 (잔존·이월). 자동 연속 턴 → 같은 run() 경로라 동일 적용. pushTurn(채널 생존) 프레임 → session.updated 없이 첫 출력이 앵커(dbSessionId 기설정). 서브에이전트 child 출력(parentToolRunId)은 부모 `tool.call.started`(집합 포함)보다 늦어 앵커 누락 없음.

## 리스크 / 트레이드오프

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| "출력 시작=소비"가 프롬프트 *폐기* 케이스(상속 훅 block)와 겹치면 — block 되면 모델 출력 자체가 그 프롬프트에 대한 응답이 아닐 수 있음 | block 시 CLI 는 해당 턴 출력을 내지 않거나(shouldQuery:false) 다른 입력 없이는 출력이 없다 — 출력이 있다는 것 자체가 이번 턴 입력 소비의 증거라는 C9 전제 유지. 잔여 의심은 실기 회귀로 관찰(사람 확인 대기) |

## 영향 받는 파일

- `app/src/main/features/chat/turn-coordinator.ts` (+ test)
- `app/src/main/features/chat/pending-message-queue.ts` (주석)
- `app/src/main/adapters/turn.ts` (주석)

## 게이트

- `cd app && npm run lint && npm run typecheck && npx vitest run && npm run build`

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — "a로 진행" 확정 인용, 경계(턴-시작 vs steer) 추론 표기.
- [x] 자료조사 — wire 실측·코드 라인 레퍼런스.
- [x] 인수 기준 — 5건, 검증 가능.
- [x] 의존 기술 — 신규 의존성 0.
- [x] 파생 UX — 무출력·자동 연속·pushTurn·서브에이전트 엣지.
- [x] 리스크 — block 겹침 케이스 완화 명시.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 전 항목. 소비 *판정* 만 추가하고 커밋 경로(commitConsumed·drainConsumedBatches)는 재사용 — 신규 상태 머신 0.
- 확인 사항: 기존 continuity 통합테스트(echo 시나리오)가 무수정 green — echo 경로와의 공존이 회귀 없이 성립함을 확인.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | dev 앱 실행 중 better-sqlite3 `.node` 가 잠겨(EBUSY) Node ABI 재빌드 불가 — DB 테스트 게이트 차단 | ✅ 잠긴 140 바이너리를 rename(실행 앱은 열린 핸들 유지) 후 127 재설치로 우회. **dev 앱 재시작 시 사용자는 `npm run postinstall`(install-app-deps) 필요** — 0019(test-abi-green, plan READY 방치) 구현 필요성 재확인 | 본 세션 게이트 로그 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `features/chat/turn-coordinator.ts`(+test 6건) · `features/chat/pending-message-queue.ts`(주석) · `adapters/turn.ts`(주석) |
| 게이트 결과 | lint ✅ 0 / typecheck ✅ 3종 0 / test ✅ **693/693 (88파일)** / build ✅ exit 0 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | 구현 커밋(본 파일과 동일 커밋) |
