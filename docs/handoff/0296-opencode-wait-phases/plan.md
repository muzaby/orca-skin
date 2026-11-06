# Plan — 0296-opencode-wait-phases

## 메타

| 항목 | 값 |
|---|---|
| slug | `0296-opencode-wait-phases` |
| 작성자 | Claude Code (설계) · argon (구현) |
| 일자 | 2026-11-05 |
| 매핑 | 브랜치 `ccr-90fb2d84-yf9ksk` |
| 상태 | READY (ΔV1) |
| V mode | `Delta V` |
| 기준 V | `0296:V1@13db37e` — 이 plan의 V1(`git cat-file -t` = commit, `main` 조상). V1의 INHERITED 회귀 출처는 `main@16a1ee8` |
| 이번 V revision | `ΔV1` — r1 verify RETURN_TO_PLAN 정정(2026-11-06) |
| 유효 V | `V1 + ΔV1` — ΔV1 절이 충돌하는 V1 행을 대체 |
| 기준 커밋 | V1 설계 `13db37e` · r1 구현 `c598077`·`dbef1b7`·`aa46653` · r1 verify `16fb6dd`(전부 `git cat-file -t` = commit). 좌표 정본은 INDEX |

> **ΔV1(2026-11-06, r1 verify RETURN_TO_PLAN)**: D-011~D-013을 더한다. AC1·AC4·AC5·AC7을 AC1′·AC4′·AC5′·AC7′가, §10 EP-01(12자리)을 EP-01′(11자리)가, EP-02(7자리)를 EP-02′(10자리)가, MD-01 규칙 칸을 MD-01′가 대체한다. EP-04 a2·a3·a7, EP-05 r7의 직접 oracle을 정정하고 운영 gate 1행을 더한다. 등록 변이 N1~N13을 더한다. 정본은 아래 ΔV1 절이다.

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: OpenCode 세션의 첫 턴은 응답까지 오래 걸리는데, 스피너 옆 문구는 `응답 준비 중…`(짧음) 뒤 곧바로 `생각 중`이 된다. 서버 기동·프로젝트 초기화·세션 생성·MCP 대기·모델 첫 응답 대기가 전부 `생각 중`으로 보여 무엇을 기다리는지 알 수 없다.
- 완료 후 달라지는 것: Orca가 실제로 지나는 대기 단계의 이름이 스피너 옆에 차례로 보이고, 첫 모델 출력부터 기존 `생각 중`이 된다.
- 성공을 사용자 관점에서 한 문장으로: "OpenCode가 지금 무엇을 준비하고 있는지 문구로 보이고, 생각 중이라는 말은 모델이 실제로 출력을 시작한 뒤에만 보인다."

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "오픈코드 컴포저로 세션 시작시, 첫 턴의 답변이 준비되기까지 많은 시간이 소요된다. 사용자 경험에 좋지 않은 영향을 막기위해 스피너 옆에 표시되는 상태 안내에 대해 상태를 더 세분화하라. 오픈코드의 경우 준비 중 외에 상태 표현이 더 필요하다. 후보를 먼저 확인받고 plan문서를 작성하자." | 라이브 세션 2026-11-05 첫 턴 |
| 명시 결정 1 | 단계 구성 = "6단계 (권장)" (서버 시작 / 프로젝트 불러오기 / 세션 생성 / MCP 연결 대기 / 요청 전송 / 모델 응답 대기, 미리보기 문구 그대로) | 라이브 세션 질문 1 |
| 명시 결정 2 | 추가 상태 = "재시도 대기", "이전 대화 확인". "첫 응답 이후 세분화"는 선택하지 않음 | 라이브 세션 질문 2 |
| 명시 결정 3 | 이후 턴 = "모든 턴에 적용 (권장)" | 라이브 세션 질문 3 |
| 추론 의도 | 대기 시간 단축이 아니라 **대기 표시**가 요구다 — 사용자 문장이 "상태 안내 … 세분화"를 지정 | 명시 요구 문장 |
| 추론 의도 | Claude 하네스는 범위 밖 — "오픈코드의 경우" | 명시 요구 문장 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | OpenCode 대기 단계 문구 6종: `OpenCode 서버를 시작하는 중…` · `프로젝트를 불러오는 중…` · `세션을 만드는 중…` · `MCP 연결을 기다리는 중…` · `요청을 보내는 중…` · `모델 응답을 기다리는 중…` → 첫 응답 조각부터 `생각 중` | 사용자 선택 "6단계 (권장)" — 미리보기 문구 원문 | 질문 1 | ACTIVE | — |
| D-002 | 재시도 대기 문구 `재시도 대기 중 ({{attempt}}번째)…` — OpenCode가 provider 오류로 재시도할 때 | 사용자 선택 "재시도 대기" | 질문 2 | ACTIVE | — |
| D-003 | 꺼진 세션을 다시 열어 보낼 때 이력 확인 구간 문구 `이전 대화를 확인하는 중…` | 사용자 선택 "이전 대화 확인" — "'응답 준비 중…' 대신" | 질문 2 | ACTIVE | — |
| D-004 | 첫 응답 조각 이후의 `생각 중`은 세분화하지 않는다 | 사용자가 "첫 응답 이후 세분화"를 선택하지 않음 | 질문 2 | ACTIVE | — |
| D-005 | 모든 턴에 적용 — 이후 턴은 실제로 거치는 `MCP 연결 대기 → 요청 전송 → 모델 응답 대기`만 보인다. 재시도 대기도 모든 턴 | 사용자 선택 "모든 턴에 적용 (권장)" | 질문 3 | ACTIVE | — |
| D-006 | 실제로 거치는 단계만 보인다. 이미 켜진 서버를 재사용하면 서버 시작 단계는 건너뛴다 | 질문 1의 전제("실제로 거치는 단계만 보이며, 이미 켜진 서버를 재사용하면 서버 시작 단계는 건너뜁니다")를 사용자가 승인 | 질문 1 | ACTIVE | — |
| D-007 | Claude 하네스의 표시는 바꾸지 않는다 | "오픈코드의 경우" | 명시 요구 | ACTIVE | — |
| D-008 | 단계는 main이 실제 경계를 지날 때만 바뀐다. 경과 시간으로 단계를 추측하지 않는다 | 거짓 진행 금지 — 0211 D-003과 같은 원칙(`chatReducer.ts:350` 주석) | 설계 해석 | ACTIVE | — |
| D-009 | Orca 쪽 준비 구간(lease 획득 ~ OpenCode 채널의 첫 단계)은 기존 문구 `응답 준비 중…`으로 잇는다 | 채널 시작 전 틈에 `생각 중`이 끼면 D-001의 "첫 응답 조각부터 생각 중"을 어긴다 | 설계 해석 | ACTIVE | — |
| D-010 | 채널 대기 단계(서버~재시도)는 격리 준비 단계 문구보다 우선한다. `응답 준비 중`·`이전 대화 확인`은 격리 준비 단계보다 뒤다 | 격리 준비 문구는 `session.updated`까지 남는데(`chatReducer.ts:350-352`), 채널 단계는 구조상 격리 준비가 끝난 뒤에만 온다 | 설계 해석 | ACTIVE | — |
| D-011 | r1 verify 확장 후보 3건을 모두 채택한다. ① `promote`는 승격 전 단계를 새 키로 옮긴다 ② `clear`·`dispose`는 단계 Map을 비운다 ③ retry `attempt`가 1 이상 정수가 아니면 1로 운반한다 | ①은 실제 경로에 있다 — 새 세션 단계가 `queueKey`로 기록된 뒤 `session.updated` rekey(`turn-coordinator.ts:469`)로 승격되고, 옮기지 않으면 다음 전이까지 `생각 중`이 보여 D-001·D-009를 어긴다. ②는 `promote`가 `cleared`를 풀고(`session-activity-projector.ts:120`) `current()`가 dispose 뒤에도 Map을 읽어 관측된다. ③은 코드에 있는 분기다 | 설계 해석(r1 verify 창 안) | ACTIVE | — |
| D-012 | 채널 `run()` catch의 `waitPhase.end()`(V1 c11)를 지운다. 비움은 finally(c12) 한 곳이 맡는다 | catch(`channel.ts:452-465`)에는 await가 없고 finally 첫 문장이 `end()`(`:468`)라 두 호출이 같은 동기 구간에 있다. projector는 microtask로 flush(`session-activity-projector.ts:187-196`)하므로 스냅샷은 어느 쪽이든 오류 publish 뒤에 나간다 — 단독 제거 변이 c11이 green(r1 verify) | 설계 해석 | ACTIVE | — |
| D-013 | `PendingAssistantStatus` memo deps는 렌더 테스트가 아니라 `react-hooks/exhaustive-deps` 경고 0 gate로 잠근다 | 렌더러 vitest는 `environment: 'node'`(`vitest.config.ts:8`)이고 렌더 테스트는 `react-dom/server` 정적 렌더라 재렌더가 없다. jsdom·testing-library는 미설치이며 신규 의존성은 사용자 승인 대상이다(`app/AGENTS.md §의존성 정책`). 측정: 기준 경고 0, deps 제거 변이에서 1 | 설계 해석 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-010(신규 handoff).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 해당 없음(신규).
- **ΔV1(2026-11-06)**: D-011~D-013 추가(설계 해석 — 사용자 결정 변경 없음). 대체된 결정 0. `ACTIVE 결정 ↔ AC` 대조: 충돌 0 — D-011①↔AC1′(새 세션 단계 연속)·D-011②↔AC7′·D-011③↔AC4′·D-012↔AC7′(I5·I6·I7이 c12만으로 닫힘)·D-013↔VP-13 gate. D-007(Claude 불변)은 a2 정정이 OpenCode 어댑터 플래그만 단언해 유지된다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC1·AC8, D-002↔AC4·AC8, D-003↔AC5·AC8, D-004↔AC6, D-005↔AC3·AC4, D-006↔AC2, D-007↔AC11, D-008↔AC1~AC5(경계 이벤트 입력만), D-009↔AC1(첫 값 `preparing`), D-010↔AC9.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 요구는 대기 **표시**다. 대기 시간 원인(서버별 SSE·cold resume 이중 시작)은 별도 개선 제안으로 비범위 | `docs/etc/study/opencode/startup-performance-analysis.md` §10 P0·P1 |
| 이미 기존 코드가 충족하는가 | 아니오 — `preparing`은 lease 준비뿐이고 lease 활성화 뒤 OpenCode 연결 전체가 `streaming`(=`생각 중`) | `session-activity-projector.ts:15-18` · `runtime-entry.ts:60` · `registries/status.ts` `statusStreamingLabel` |
| 더 작은 해법이 있는가 | renderer가 경과 시간으로 문구를 바꾸는 방법은 D-008 위반(실제와 다른 진행) | D-008 |
| 선행 자료의 주장을 코드와 대조했는가 | 분석 문서의 단계 목록 중 채널이 관측 가능한 경계만 채택. 서버 시작 여부는 pool만 알아 observer가 필요 | `server.ts:206-255` `acquire` · `channel.ts:325-360` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 0211 EP-03 "준비 단계가 모든 것을 이긴다"와 D-010이 부분 충돌 → 채널 단계에 한해 순위 변경(§16) | `activityLabel.ts:53-55` |

- 사용자에게 올릴 결정: 없음(질문 3개로 닫음).
- 코드 조사로 닫은 사실: OpenCode `session.status.retry.attempt`는 1부터 증가(`opencode@v1.19.0 packages/opencode/src/session/retry.ts:81` `attempt - 1` 지수) · 재시도 뒤 시도마다 `busy`를 다시 보낸다(`processor.ts:653`).

## 5. 동작 / 사용자 흐름

```text
[새 세션, 서버 꺼짐] 전송
  → 응답 준비 중…                 (Orca 준비: lease·설정 해석·확장 배포)
  → OpenCode 서버를 시작하는 중…   (버전 확인·spawn·health·이벤트 연결)
  → 프로젝트를 불러오는 중…        (config·플러그인·MCP 활성화)
  → 세션을 만드는 중…              (session.create)
  → MCP 연결을 기다리는 중…        (제출 전 MCP 게이트)
  → 요청을 보내는 중…              (명령·카탈로그 확인 + promptAsync)
  → 모델 응답을 기다리는 중…       (요청 수락 ~ 첫 모델 출력)
  → 생각 중                        (첫 모델 출력부터, 기존)
  ↘ 재시도 대기 중 (n번째)…        (OpenCode retry 상태 동안, 끝나면 모델 응답 대기 또는 생각 중으로 복귀)
[서버 켜짐] 같은 흐름에서 서버 시작 단계만 없다
[이후 턴] MCP 연결 대기 → 요청 전송 → 모델 응답 대기 → 생각 중
[꺼진 세션 재개] 이전 대화를 확인하는 중… → 응답 준비 중… → 서버 시작 … (세션 생성 단계 없음)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 새 chain lease 획득(OpenCode) | main이 대기 단계 `preparing` 기록 | `응답 준비 중…` |
| 이력 확인 시작/끝(재개, 런타임 없음) | `history` → 끝나면 `preparing` | `이전 대화를 확인하는 중…` → `응답 준비 중…` |
| 서버 pool이 새 서버를 시작하거나 시작 중인 서버에 합류 | `server` | `OpenCode 서버를 시작하는 중…` |
| 첫 SSE 이벤트 수신 | `project` | `프로젝트를 불러오는 중…` |
| 새 세션 생성 직전 | `session` | `세션을 만드는 중…` |
| 제출 MCP 게이트 진입 | `mcp` | `MCP 연결을 기다리는 중…` |
| 제출 본문 시작 | `send` | `요청을 보내는 중…` |
| prompt 수락(`send`일 때만) | `model` | `모델 응답을 기다리는 중…` |
| root `session.status: retry` | `retry(attempt)` | `재시도 대기 중 (n번째)…` |
| retry 중 root `busy` | 출력 전이면 `model`, 출력 뒤면 비움 | 모델 응답 대기 / `생각 중` |
| 첫 모델 출력 이벤트 | 비움 | `생각 중` |
| 응답 종료·오류·중단·채널 종료·chain 종료 | 비움 | 기존 종료/대기 표시 |

### 파생 UX / 엣지케이스

- loading / empty / error: 오류로 끝나면 단계를 비우고 기존 오류 배너가 보인다. 단계 문구가 오류 뒤에 남지 않는다(AC7).
- cancel / retry / close / restart: 중단·채널 종료 시 비움. Orca 재시도(`RetryStatus` 배너, `turn.retrying`)는 변경하지 않는다.
- concurrency / multi-session: 단계는 세션별 활동 스냅샷에 있다. 다른 세션 화면에 섞이지 않는다.
- a11y: `aria-live` 라벨이 단계 문구를 읽는다(기존 `accessibleLabel` 조합). 경과 초·활동 사실은 그대로 붙는다.
- 짧은 단계: 같은 tick 안의 연속 전이는 projector가 한 스냅샷으로 합친다. 대기가 없는 단계는 보이지 않을 수 있다(D-006과 일치).

## 6. 범위 / 비범위

- **범위**: OpenCode 세션의 스피너 옆 상태 문구, 그 문구를 만드는 main 신호(활동 스냅샷 `waitPhase`), 계약 문서.
- **비범위**: 대기 시간 단축 · Claude 표시(D-007) · 첫 출력 이후 세분화(D-004) · 서브에이전트(child session) 재시도 · nav 사이드바 스피너 · Orca 재시도 배너.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 대기 원인 개선(SSE broker·cold resume lease 인계) | 아니오 — 표시 계약과 독립 | 분석 문서 P0/P1, 후속 |
| 스냅샷 필드 이름 `waitPhase` | 아니오 — main·renderer 동일 빌드 내부 IPC, 미영속 | 이번에 확정 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 서버가 꺼진 새 OpenCode 세션 첫 턴은 대기 단계를 `preparing → server → project → session → mcp → send → model → 비움` 순서로 지난다 | IT-02(실제 pool)·IT-01(cold)에서 `onWaitPhase` 호출 순서 배열 일치 + IT-03 `preparing`이 `acquireTurnRuntime` 앞 | `chat:send` → `handleChatSend` → 채널 `run()` → `onWaitPhase` |
| R-01 | AT-01 / AC2 | 이미 켜진 서버를 재사용하면 `server`가 없다 | IT-01 warm: 배열에 `server` 0 · UT-04 S3 | `servers.acquire` 정착 entry 합류 |
| R-01 | AT-01 / AC6 | 첫 모델 출력 이벤트(5종)에서 단계를 비운다 | UT-01 R8a(5종 각각) · IT-01 배열 끝 `null`이 text 출력 이벤트 publish 이전 | 채널 이벤트 루프 → `observe` |
| R-02 | AT-02 / AC3 | 같은 채널의 다음 턴은 `mcp → send → model → 비움` | IT-01 pushTurn 배열 · ST-01 `send` 게이트 중 `current().waitPhase.kind === 'send'` | `pushTurn` → `submit` |
| R-03 | AT-03 / AC4 | root `retry(attempt)` 동안 `retry` 단계(attempt 운반), `busy`에서 출력 전이면 `model`, 출력 뒤면 비움 | UT-01 R7a~R7e · IT-01 retry 배열 `[…, model, {retry,1}, model, null]` | SSE `session.status` → `status()` |
| R-04 | AT-04 / AC5 | 런타임 없는 재개에서 이력 확인 동안 `history`, 끝나면(성공·실패) `preparing` | native-session 테스트: readHistory 대기 중 호출 `[true]`, 거부 후에도 `[true,false]` · 런타임 살아 있으면 0회 · IT-03 true→`history`, false→`preparing` | `resolveTurn` → `prepareNativeSession` |
| R-05 | AT-05 / AC9 | 격리 준비 단계(`prepareStep`)는 `preparing`·`history`보다 우선, 채널 단계는 `prepareStep`보다 우선 | UT-02 L4·L5·L6 | `PendingAssistantStatus` → `deriveActivityLabel` |
| R-05 | AT-05 / AC10 | 단계가 있어도 활동 사실(입력 대기 등)과 경과 시간은 그대로 보인다 | UT-02 L7 facts 유지 · IT-04 렌더 텍스트에 `입력 대기 1건` 포함 | StatusLine |
| R-05 | AT-05 / AC12 | foreground가 `idle`(대기·ready·예약 대기)이면 단계를 표시하지 않고 기존 대기 문구 | UT-02 L3 · UT-03 P5 | projector `compute` · `deriveActivityLabel` |
| R-05 | AT-05 / AC13 | 진행 중 세션을 다시 열면 스냅샷의 단계가 복원되고, 낮은 revision은 무시된다 | IT-04 LOAD_SESSION 두 분기 · revision 가드 케이스 | `sessions DTO activity` → reducer |
| R-06 | AT-06 / AC11 | Claude 세션은 단계 신호가 0이고 표시가 그대로다(무작위 동사·`응답 준비 중…`) | IT-03 `reportsWaitPhases` 없는 adapter → `setWaitPhase` 비-null 호출 0 · REGRESSION VP-22 | `handleChatSend` |
| R-07 | AT-07 / AC8 | 단계 문구는 D-001~D-003 원문 그대로(ko), en 대응 문구, `preparing`은 기존 `chat.activity.preparing` | UT-02 `waitPhaseLabel` 9종 키 · IT-04 ko 렌더 9종 텍스트 원문 일치 · i18n 파리티 테스트 | StatusLine `tr` |
| R-08 | AT-08 / AC7 | 응답 종료·오류·중단·chain 종료 뒤 단계가 남지 않고, 다음 턴이 이전 단계를 보이지 않는다 | ST-01 종료 뒤 `waitPhase` 부재 · 오류(config 실패)·`close()` 뒤 부재 · IT-03 finally `null` | 채널 `end()` · `send.ts` finally |
| R-09 | AT-09 / AC14 | `IPC_CONTRACT.md` `chat.activity` 행이 `waitPhase` 필드와 의미를 적는다 | `rg -n "waitPhase" docs/IPC_CONTRACT.md` ≥1 · doc inventory `--check` exit 0 | 문서 |
| R-10 | AT-10 / AC15 | 실제 Windows OpenCode에서 cold 새 세션·warm·재개·이후 턴의 문구 진행을 눈으로 확인 | 사람 실기 §19 | Electron 실행 |

### AC 검증 주의사항

- 기존 테스트 재사용: `StatusLine.harness.test.ts` 'preserves Claude verbs and OpenCode preparation and scheduled waiting labels'(존재 확인, `:51`) · `activityLabel.test.ts` '격리 준비 단계 우선 (EP-03)' 3케이스(`:178-201`) · `turn-coordinator.test.ts` `:1085`·`:1103`·`:1132` · `adapter.startup.test.ts` 7케이스(`:175`~`:395`).
- 사람 실기 항목: 실제 OpenCode 서버 기동 시간·Windows 렌더 프레임만 남긴다. 순서·문구·우선순위는 전부 자동 테스트다.
- 순서 기준의 관측 지점: 채널은 `onWaitPhase` sink를 동기 호출한다 — 테스트는 sink 호출 배열로 순서를 본다. projector는 microtask로 합치므로 순서 단언에 쓰지 않는다(ST-01은 게이트로 멈춘 시점의 `current()`만 본다).

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 V 없음(신규 동작) → Baseline V. 기존 동작은 `INHERITED` + `REGRESSION`으로만 둔다.
- 기준 V 상속 근거: 없음. INHERITED 출처 = `main@16a1ee8`의 기존 테스트.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-10 | R | §7 각 행 | NEW | — |
| AT-01~AT-10 | AT | §7 검증 수단 칸 | NEW | — |
| R-0211 | R | 격리 준비 단계 문구 우선(무작위 동사·사실보다) | INHERITED | `main@16a1ee8` `activityLabel.test.ts` '격리 준비 단계 우선 (EP-03)' |
| R-0167 | R | 활동 사실 조합·무활동 임계·foreground 미적용 | INHERITED | `main@16a1ee8` `activityLabel.test.ts` '사실 조합'·'표시 순서'·'상태' describe |
| R-0262 | R | OpenCode 격자 스피너·`생각 중`·Claude 동사 | INHERITED | `main@16a1ee8` `StatusLine.harness.test.ts` 2케이스 |
| AR-0275 | AR | OpenCode 시작 요청 순서·공유 구독 | INHERITED | `main@16a1ee8` `adapter.startup.test.ts` 7케이스 |
| MD-0069 | MD | 첫 모델 출력 = 턴-시작 배치 소비 | INHERITED | `main@16a1ee8` `turn-coordinator.test.ts:1085·1103·1132` |
| SD-01 | SD | §5 상태와 전이 — 기록 → 전이 → 비움 → 다음 턴 | NEW | — |
| ST-01 | ST | §11 ST-01 | NEW | — |
| AR-01 | AR | §10 EP-01·EP-02 채널 → 요청 콜백 → projector → 스냅샷 | NEW | — |
| AR-02 | AR | §10 EP-03 서버 pool observer | NEW | — |
| AR-03 | AR | §10 EP-04 app 계층 producer(`preparing`·`history`·finally) | NEW | — |
| AR-04 | AR | §10 EP-05 renderer 소비 edge | NEW | — |
| IT-01~IT-04 | IT | §11 | NEW | — |
| MD-01 | MD | §10 EP-01 `OpenCodeWaitPhase` 상태 기계 | NEW | — |
| MD-02 | MD | §10 EP-06 라벨 우선순위·문구 키 | NEW | — |
| MD-03 | MD | §10 EP-02 projector `setWaitPhase`·비교·idle 억제 | NEW | — |
| MD-04 | MD | §10 EP-03 pool `serverStarting` 호출 규칙 | NEW | — |
| MD-05 | MD | §10 EP-07 모델 출력 이벤트 SSOT | NEW | — |
| UT-01~UT-05 | UT | §11 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `handleChatSend` → `setWaitPhase(preparing)` → `acquireTurnRuntime` → `coordinator.run` → `openCodeChannel.run` → `connect(observer)` → `servers.acquire` → SSE → `prepare` → `session.create` → `submit` → `promptAsync` → 출력 | IT-02 cold 배열 · IT-01 cold/warm 배열 · IT-03 순서 · UT-01 R8a | not selected — 배열 일치가 자리·순서를 직접 본다 | EP-01 (12) · EP-03 (7) · EP-04 (a3) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `pushTurn` → `submit` → `admitting` → `sending` → `accepted` → 출력 | IT-01 pushTurn 배열 · ST-01 `send` 게이트 | not selected | EP-01 (c4·c5·c6·c9) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | SSE root `session.status` → `status()` → sink | UT-01 R7a~R7e · IT-01 retry 배열 | not selected | EP-01 (c8) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `resolveTurn` → `onNativeHistory(true)` → `prepareNativeSession` → finally `onNativeHistory(false)` → send.ts 매핑 | `native-session.test.ts` 신규 3케이스 · IT-03 매핑 | not selected | EP-04 (a4·a5·a6) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | 스냅샷 → reducer → `useChatActivity` → `PendingAssistantStatus` → `deriveActivityLabel` → StatusLine | UT-02 L3~L7 · UT-03 P5 · IT-04 hydrate·revision·facts 렌더 | required — 자리 불변식: M-05a `prepareStep` 판정을 `waitPhase` 판정보다 먼저(순위 맞바꿈) → L6 red | EP-05 (10) · EP-06 (3) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | Claude adapter → `handleChatSend` | IT-03 Claude 케이스(비-null `setWaitPhase` 0) | required — 0건 성질. M-06a: send.ts `reportsWaitPhases` 게이트 제거 → red | EP-04 (a1·a3·a4) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | `waitPhaseLabel` → `tr` → ko/en 리소스 | UT-02 키 9종 · IT-04 ko 텍스트 9종 · `resources.test.ts` 파리티 | not selected | EP-06 (3) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | SD-01과 같은 경로의 종료 분기 | ST-01 · IT-01 오류·close 케이스 · IT-03 finally | VP-09 변이 공유 | EP-01 (c10·c11·c12) · EP-04 (a7) |
| VP-09 | SD-01 ↔ ST-01 | REQUIRED | 실제 pool·adapter·`buildTurnRequest`·`SessionRuntime`·`SessionActivityProjector` 한 시퀀스: 1턴(project 게이트) → 종료 → 2턴(send 게이트) → 종료 | ST-01: 게이트 시점 `current(key).waitPhase.kind` = `project`/`send`, 종료 뒤 부재 | required — 수명 불변식. M-09a: 채널 finally `end()` 제거 + 출력 비움(c9) 제거 동시 → 종료 뒤 잔존 red | EP-01 (c9·c10·c12) · EP-02 (t3·t4·t5) |
| VP-10 | AR-01 ↔ IT-01 | REQUIRED | 채널 → `req.onWaitPhase` | IT-01 `adapter.startup.test.ts` 신규 describe 'wait phases' 6케이스 | required — 자리 순서. M-10a: c2(`connected`)와 c3(`creatingSession`) 맞바꿈 → cold 배열 red | EP-01 (12) · EP-02 (t1·t2) |
| VP-11 | AR-02 ↔ IT-02 | REQUIRED | 실제 `OpenCodeServerPool`(spawn mock) → `serverStarting` → adapter `client` → 채널 | IT-02 `opencode-runtime.test.ts` 신규 케이스: 첫 턴 배열에 `server`, 같은 runtime 다음 턴에 없음 | not selected | EP-03 (7) |
| VP-12 | AR-03 ↔ IT-03 | REQUIRED | `handleChatSend` → `reportWaitPhase` → `activity.setWaitPhase` | IT-03 `send.wait-phase.test.ts` 신규 5케이스 | VP-06 M-06a 공유 | EP-04 (7) |
| VP-13 | AR-04 ↔ IT-04 | REQUIRED | `RECV_EVENT chat.activity`/`LOAD_SESSION` → state → store selector → `PendingAssistantStatus` 렌더 | IT-04 `statusLine.waitPhase.test.ts` 신규 | required — 운반 edge: M-13a: `PendingAssistantStatus` activityView에서 `waitPhase` 제거 → 렌더 red | EP-05 (10) |
| VP-14 | MD-01 ↔ UT-01 | REQUIRED | 순수 | UT-01 `wait-phase.test.ts` R1~R11 | not selected — 표 단언 | EP-01 |
| VP-15 | MD-02 ↔ UT-02 | REQUIRED | 순수 | UT-02 `activityLabel.test.ts` 신규 describe L1~L7 + `waitPhaseLabel` | VP-05 M-05a 공유 | EP-06 |
| VP-16 | MD-03 ↔ UT-03 | REQUIRED | `setWaitPhase` → `recompute` → `flushOne` → `emit` | UT-03 `session-activity-projector.test.ts` 신규 P1~P8 | required — "같으면 내지 않는다" 0건 성질. M-16a: `sameActivity` waitPhase 비교 제거 → P8 red · M-16b: `setWaitPhase` 동치 조기 반환 제거 → P2 red | EP-02 (t4·t5·t6) |
| VP-17 | MD-04 ↔ UT-04 | REQUIRED | `ServerPool.acquire` | UT-04 `server.test.ts` 신규 S1~S5 | not selected | EP-03 (s1·s2·s3) |
| VP-18 | MD-05 ↔ UT-05 | REQUIRED | `isModelOutputEvent` → coordinator 소비 · 채널 비움 | UT-01 R8a · REGRESSION VP-24 | required — SSOT. M-18a: 공유 집합에서 `tool.call.started` 제거 → UT-01 R8a(tool) red | EP-07 (3) |
| VP-19 | R-09 ↔ AT-09 | REQUIRED | 문서 | `rg` + doc inventory gate | not selected | EP-08 (3) |
| VP-20 | R-0211 ↔ AT(기존) | REGRESSION | `deriveActivityLabel` prepareStep 분기 | '격리 준비 단계 우선 (EP-03)' 3케이스 green | not selected | EP-06 |
| VP-21 | R-0167 ↔ AT(기존) | REGRESSION | `deriveActivityLabel` facts·status | `activityLabel.test.ts` 기존 describe 3개 green | not selected | EP-06 |
| VP-22 | R-0262 ↔ AT(기존) | REGRESSION | StatusLine OpenCode/Claude | `StatusLine.harness.test.ts` 2케이스 green | not selected | EP-05 (r10) |
| VP-23 | AR-0275 ↔ IT(기존) | REGRESSION | OpenCode 시작 요청 순서 | `adapter.startup.test.ts` 기존 7케이스 green | not selected | EP-01 |
| VP-24 | MD-0069 ↔ UT(기존) | REGRESSION | coordinator 첫 모델 출력 소비 | `turn-coordinator.test.ts:1085·1103·1132` green | not selected | EP-07 (e2) |
| VP-25 | R-10 ↔ AT-10 | REQUIRED | Electron 실행 | §19 실기 기록 | not selected — 사람 실기 | 0 + 이유: 시각·실제 서버 |

`§10 강제 지점 전수`의 N은 자리 수다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/src/**` 수정(boundaries 포함) | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error만 blocking |
| 관련 vitest(비-DB) | 수정 모듈 | §19 목록, `./node_modules/.bin/vitest run <files>` | 같음 |
| test budget | 신규 테스트 파일이 시간 값을 쓴다 | `cd app && node scripts/check-test-budgets.mjs` | 신규·수정 테스트의 위반만 |
| doc inventory | `docs/IPC_CONTRACT.md`·`docs/arch/**` 수정 | `cd app && node scripts/check-doc-inventory.mjs --check` | 같음 |
| message-bus | 설계·구현·검증 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

## ΔV1 — r1 verify RETURN_TO_PLAN 정정 (2026-11-06)

**수정 필요.** r1 verify([`verify.md`](verify.md))는 gate PASS, 제품 결함 재현 0이었다. 그러나 고장 62건 중 16건이 green이었다(이행 8건 · 확장 3 · 동치 3). ΔV1은 다음을 한다.

- 확장 3건을 D-011로 채택한다.
- 동치 사본 c11을 D-012로 지운다.
- 이행 결함 자리마다 구별 입력을 oracle 칸에 적는다.

production 변경은 c11 삭제 1줄뿐이다. 나머지는 테스트 공백이다.

| 발견(verify 파생 #) | 근거 | 정정 |
|---|---|---|
| #1 c12 단독 제거 green · c11 중복 | 터미널 오류 `return`(`channel.ts:432`)은 c10·c11을 건너뛴다. c11·c12는 같은 동기 구간이다 | D-012 · EP-01′ c12 oracle I7 · N1 |
| #2 c10 제거 green | 출력 전 중단 → finish 분기 입력 없음 | EP-01′ c10 oracle I8 · N2 |
| #3 c7 제거 green | `session.command` 경로 입력 없음 | EP-01′ c7 oracle I9 · N3 |
| #4 c8 root 판정 제거 green | 자식 세션 retry 입력 없음 | AC4′ · EP-01′ c8 oracle I10 · N4 |
| #5 a2 제거 green | IT-03은 가짜 어댑터 플래그만 주입한다. 귀속은 verify의 VP-06이 아니라 VP-01·VP-12다 — Claude 경로와 무관 | EP-04 a2 oracle(IT-02) · N5 |
| #6 a3·a7 키 맞바꿈 green | A1~A4가 단계 값만 단언하고 키는 보지 않는다 | AC5′·AC7′ · EP-04 a3·a7 oracle(A4 키·A6) · N6·N7 |
| #7 r7 memo deps 제거 green | 정적 렌더라 재렌더 없음 | D-013 · 운영 gate `hooks-deps` · N8 |
| #8 MD-01 `accepted` 비-send 가드 제거 green | 규칙 칸 분기에 UT-01 입력 없음 | MD-01′ · UT-01 R6c·R6d · N9 |
| #9~#11 확장(promote·clear·attempt) | 시도한 고장 promote·clear·X2 | D-011 · EP-02′ t8~t10 · MD-01′ · UT-01 R7g·R7h · UT-03 P9~P11 · N10a·N10b·N11~N13 |

### ΔV1 계약과 V 증분

| Node / Pair | provenance / requiredness | 대체·상속 범위 | 등록 변이 |
|---|---|---|---|
| AT-01 / VP-01 | CHANGED(검증 수단) / REQUIRED | AC1 → AC1′ | N3 · N5 · N6 |
| AT-03 / VP-03 | CHANGED / REQUIRED | AC4 → AC4′ — 자식 retry 무표시·attempt 정규화를 동작 기준에 올린다 | N4 · N10a · N10b |
| AT-04 / VP-04 | CHANGED(검증 수단) / REQUIRED | AC5 → AC5′ | N6 · N7 |
| AT-08 / VP-08 · ST-01 / VP-09 | CHANGED(검증 수단) / REQUIRED | AC7 → AC7′ | N1 · N2 · N7 |
| AR-01 / VP-10 | CHANGED / REQUIRED | EP-01 → EP-01′(11자리) · IT-01 I7~I10 | N1~N4 |
| AR-03 / VP-12 | CHANGED(oracle) / REQUIRED | EP-04 a2·a3·a7 oracle | N5~N7 |
| AR-04 / VP-13 · R-05 / VP-05 | CHANGED(oracle) / REQUIRED | EP-05 r7 oracle → gate `hooks-deps` | N8 |
| MD-01 / VP-14 | CHANGED / REQUIRED | MD-01 규칙 → MD-01′ · UT-01 R6c·R6d·R7g·R7h | N9 · N10a · N10b |
| MD-03 / VP-16 | CHANGED / REQUIRED | EP-02 → EP-02′(10자리) · UT-03 P9~P11 | N11 · N12 · N13 |
| VP-02·06·07·11·15·17~24 | INHERITED / REQUIRED·REGRESSION 그대로 | r1 verify PASS — 좌표는 `verify.md` §5 | V1 그대로 |
| VP-25 | INHERITED / REQUIRED | 사람 실기 그대로 | — |

- `SUPERSEDED` 이관: AC1·AC4·AC5·AC7은 문장을 그대로 승계하고 검증 수단만 넓힌다(AC4′는 동작 기준 2항 추가). EP-01·EP-02·MD-01 규칙의 V1 등록 변이(M-05a~M-18a)는 그대로 유효하다. M-09a는 c11이 사라져도 정의(c9+c12 동시 제거)가 같다. 폐기 0.
- 레벨 판정: 새 계약 edge는 없다. D-011①②는 MD-03 내부 상태, ③은 MD-01 규칙, D-012는 EP-01 자리 1개 삭제다.
- 유효 pair는 VP-01~VP-25 그대로이고 AC는 15개다(4행 대체, 총수 불변).

### 대체 AC (ΔV1)

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1′ | AC1 그대로 — 서버가 꺼진 새 OpenCode 세션 첫 턴은 `preparing → server → project → session → mcp → send → model → 비움` | AC1 수단 그대로에 세 가지를 더한다. ① IT-01 I9: 슬래시 명령 턴도 `send → model → 비움`이고 `/session/<id>/command` POST가 1회 ② IT-02: 실제 `createOpenCodeAdapter(…)`의 `reportsWaitPhases === true` ③ UT-03 P9: 승격 전 단계가 새 키에서 보인다 | AC1 경로 + `session.command` 분기 + 큐 rekey → projector `promote` |
| R-03 | AT-03 / AC4′ | AC4 그대로에 두 항을 더한다. ① 자식 세션(`sessionID ≠ root`)의 `retry`는 단계를 바꾸지 않는다 ② `attempt`가 1 이상 정수가 아니면 1로 보인다 | AC4 수단 그대로 + IT-01 I10(자식 retry → 배열에 `retry` 0, 형제 I4는 root retry 1) + UT-01 R7g·R7h | SSE `session.status` → c8 root 판정 → `status()` |
| R-04 | AT-04 / AC5′ | AC5 그대로 — 런타임 없는 재개에서 이력 확인 동안 `history`, 끝나면 `preparing` | AC5 수단 그대로 + IT-03 A4가 단계 값과 함께 **모든 `setWaitPhase` 첫 인자 = `'session-1'`**(재개 키 = `payload.sessionId`)을 단언 | `resolveTurn` → `onNativeHistory` → `reportWaitPhase` 키 |
| R-08 | AT-08 / AC7′ | AC7 그대로 — 응답 종료·오류·중단·chain 종료 뒤 단계가 남지 않고, 다음 턴이 이전 단계를 보이지 않는다 | AC7 수단 그대로 + IT-01 I7(터미널 오류 `return` 경로) + I8(출력 전 중단 → finish, 채널이 열린 채로 `null`) + IT-03 A6(실행 중 확정된 `dbSessionId` 키로 chain 끝 `null`) + UT-03 P10·P11(clear·dispose 뒤 잔여 0) | 채널 finish·finally · `send.ts` 바깥 finally · projector `clear`·`dispose` |

- AC 게이트 재확인: 행동 단언은 sink 배열·`setWaitPhase` 인자(키·값)·요청 경로 수·스냅샷 `waitPhase` 유무다.
- 음성 단언은 양성과 짝이다 — I10(자식 retry 0)은 I4(root retry 1)와, P10·P11(잔여 0)은 P1(설정 시 emit 1)과 같은 파일에서 본다.
- I9는 명령 요청 1회를 함께 단언한다 — 그렇지 않으면 prompt 경로로 새도 배열이 같다.

### MD-01′ 규칙 (MD-01 규칙 칸 대체)

| 호출 | 규칙 | UT-01 입력 |
|---|---|---|
| serverStarting · connected · creatingSession · admitting | V1 그대로(`server`·`project`·`session`·`mcp`) | R1~R4 |
| sending | `send` + 출력 플래그 초기화 | R5·R6a |
| accepted | 현재가 `send`이고 출력 전일 때만 `model`. **그 밖(현재 `null`·`project`·`retry`, 또는 출력 뒤)은 무동작** | R6a(send→model) · R6b(출력 뒤) · **R6c**(현재 `project`) · **R6d**(현재 `retry`) |
| status(retry) | `retry(attempt)`. **`attempt`가 1 이상 정수가 아니면 1** | R7a · R7e · **R7g**(attempt 0) · **R7h**(attempt 2.5) |
| status(busy) | 현재가 `retry`일 때만: 출력 전 `model` / 출력 뒤 `null` | R7b · R7c · R7d(현재 `send` → 무동작) |
| status(idle) | 무시 | R7f |
| observe | 모델 출력 포함이면 `null` + 출력 플래그 | R8a(5종) · R8b(비출력) |
| end | `null` | R9 |
| 공통 | 초기값 `null`, 같은 값 재호출 없음, sink 없으면 무동작 | R10 · R11 |

신규 UT-01 입력:

| ID | 입력(호출 순서) | 기대 sink 호출 |
|---|---|---|
| R6c | `connected()`, `accepted()` | `[{project}]` |
| R6d | `sending()`, `status(retry 1)`, `accepted()` | `[{send}, {retry,1}]` |
| R7g | `status({type:'retry', attempt:0, message:'x', next:1})` | `[{retry,1}]` |
| R7h | `status({type:'retry', attempt:2.5, message:'x', next:1})` | `[{retry,1}]` |

### ΔV1 §10

| pair | 계약 | 언제 강제 (자리 목록 = 분모) | 자리 검색 → N | 실패 의미 |
|---|---|---|---|---|
| VP-14·VP-10·VP-01~03·VP-08·VP-09 | **EP-01′** 채널 경계 호출 | 아래 EP-01′ 11자리 | V1 EP-01 검색 그대로 → **11**(c11 삭제 뒤) | V1 그대로 |
| VP-10·VP-16·VP-09 | **EP-02′** 운반·저장 | 아래 EP-02′ 10자리 | V1 EP-02 검색 그대로 — 출력 줄은 t1~t10 중 하나(주석·타입 import 제외) | V1 그대로 + t8 누락 시 승격 순간 `생각 중` · t9·t10 누락 시 해제된 세션·종료 뒤 옛 단계 |

- 분모: EP-01′ 11 + EP-02′ 10 + EP-03 7 + EP-04 7 + EP-05 10 + EP-06 3 + EP-07 3 + EP-08 3 = **54**(V1 52 − 1 + 3).
- 선언 경계(V1 6건)는 그대로다. "child session retry는 표시하지 않는다"는 이제 AC4′의 동작 기준이다 — 경계가 아니라 I10이 잠근다.

#### EP-01′ — 채널 경계 호출 (11, EP-01 대체)

줄은 `aa46653` 기준이고, c11 삭제 뒤의 줄 이동은 허용한다.

| # | 자리 | 규칙 | 직접 oracle 좌표 | 출처 |
|---|---|---|---|---|
| c1 | `channel.ts:333` | V1 그대로 | IT-01 I1 | INHERITED |
| c2 | `:350` | V1 그대로 | IT-01 I1~I4 · M-10a | INHERITED |
| c3 | `:357` | V1 그대로 | IT-01 I1·I2 | INHERITED |
| c4 | `:149` | V1 그대로 | IT-01 I1~I3 | INHERITED |
| c5 | `:163` | V1 그대로 | IT-01 I1~I3 | INHERITED |
| c6 | `:295` | V1 그대로 | IT-01 I1~I4 | INHERITED |
| c7 | `:271` | `session.command` dispatch 직후 `accepted()` | **IT-01 I9** | CHANGED(oracle) |
| c8 | `:426-427` | **root** `session.status`만 `status()`로 | IT-01 I4(root) + **I10**(자식) | CHANGED(oracle) |
| c9 | `:429` | V1 그대로 | M-09a · UT-01 R8a 경유 IT-01 I1 | INHERITED |
| c10 | `:443` | finish 분기 `end()` | **IT-01 I8** | CHANGED(oracle) |
| c12 | `:468` | `run()` finally `end()` — catch·터미널 `return`·`closed` 경로 공통 | IT-01 I5·I6 + **I7** | CHANGED(oracle) |

신규 IT-01 입력은 `adapter.startup.test.ts`의 `describe('wait phases')`, `waitPhaseFixture`에 둔다.

| ID | 입력 | 기대 |
|---|---|---|
| I7 터미널 오류 | `onPrompt`가 root `session.error`(`error.name ≠ 'MessageAbortedError'`)를 송출 | frame에 `error` 이벤트, `phases.at(-1) === null` |
| I8 출력 전 중단 | `onPrompt` 무송출 → `phases`에 `model` 도달 → `live.interrupt()` → fixture `emit(root session.idle)` | frame에 `turn.aborted`, `live.close()` **전에** `phases.at(-1) === null` |
| I9 명령 | `/command`가 `native:review`를 돌려주는 fixture에서 text `'/native:review now'` | `phases`가 `[server, project, session, mcp, send, model, null]`, `/session/<id>/command` POST 1회 · `/prompt_async` 0회 |
| I10 자식 retry | `onPrompt`가 `session.status{sessionID:'child-1', retry 1}`을 먼저 송출한 뒤 root 출력·idle | `phases`에 `kind:'retry'` 0 · 배열 = I1과 같은 7원소 |

#### EP-02′ — 운반·저장 (10, EP-02 대체)

| # | 자리 | 규칙 | 직접 oracle 좌표 | 출처 |
|---|---|---|---|---|
| t1 | `turn.ts:216` | V1 그대로 | (타입) — 운반은 t2·t3 좌표가 닫는다 | INHERITED |
| t2 | `channel.ts:31` | V1 그대로 | IT-01 I1 | INHERITED |
| t3 | `turn-request.ts:71,132-133` | V1 그대로 | IT-02 · ST-01 | INHERITED |
| t4 | `session-activity-projector.ts:40,93-99` | `setWaitPhase` 저장(canonicalKey·cleared/disposed 무시·동치 조기 반환) | UT-03 P1·P2·P6·P7 · M-16b | INHERITED |
| t5 | `:247-248` | V1 그대로 | UT-03 P5 | INHERITED |
| t6 | `:275`(+`sameWaitPhase` `:259-263`) | V1 그대로 | UT-03 P3·P8 · M-16a | INHERITED |
| t7 | `ipc.ts:1705` | V1 그대로 | (타입) — 운반은 ST-01 | INHERITED |
| t8 | `:139-141` `promote` | 원천 키의 단계를 대상 키로 옮기고 원천을 지운다 | **UT-03 P9** | NEW |
| t9 | `:154` `clear` | 단계 Map에서 지운다 | **UT-03 P10** | NEW |
| t10 | `:170` `dispose` | 단계 Map을 비운다 | **UT-03 P11** | NEW |

신규 UT-03 입력(lease stub의 foreground는 `streaming`):

| ID | 입력 | 기대 |
|---|---|---|
| P9 | `setWaitPhase('client-1',{session})` → `promote('client-1','s1')` | `current('s1').waitPhase.kind === 'session'` |
| P10 | `setWaitPhase('s1',{model})` → `clear('s1')` → `promote('client-2','s1')` | `current('s1').waitPhase` 부재 |
| P11 | `setWaitPhase('s1',{model})` → `dispose()` | `current('s1').waitPhase` 부재 |

#### EP-04·EP-05 oracle 정정

| 자리 | 규칙(V1 그대로) | 정정한 직접 oracle 좌표 |
|---|---|---|
| a2 `adapter.ts:33` | `OpenCodeAdapter.reportsWaitPhases = true` | IT-02(`opencode-runtime.test.ts`)에서 실제 `createOpenCodeAdapter(…)` 결과의 `reportsWaitPhases === true`. 이 플래그가 켜졌을 때의 gate 동작은 IT-03 A1이 맡는다(edge 대응: 실제 어댑터 → 플래그 / 플래그 → `preparing`) |
| a3 `send.ts:254-260` 키 | `leaderTurn?.dbSessionId ?? payload.sessionId ?? provisionalKey` | 분기별 입력: 새 세션 → A1 `preparing` 키 `'new:1'` · 재개 → A4 모든 호출 키 `'session-1'` |
| a7 `send.ts:740` 키 | 같은 키 식 | 분기별 입력: 새 세션 미확정 → A2·A3 마지막 `null` 키 `'new:1'` · 재개 → A4 `'session-1'` · **A6**: 새 세션에서 `runTurnWithContinuations` mock이 `turn.dbSessionId = 's-new'`로 확정 → `preparing` 키 `'new:1'`, 마지막 `null` 키 `'s-new'` |
| r7 `PendingAssistantStatus.tsx:18,29` | `activityView`에 `waitPhase` + memo deps | 렌더는 IT-04 그대로(M-13a). deps는 `gate:hooks-deps`(아래) |

### ΔV1 운영 gate (V1 표에 추가)

| Gate | 적용 이유 | 명령 | 실패 범위 |
|---|---|---|---|
| hooks-deps | EP-05 r7 memo deps(D-013) — `npm run lint`는 warning을 exit 0으로 낸다 | `cd app && ./node_modules/.bin/eslint --no-fix --max-warnings 0 src/renderer/src/features/chat/components/transcript/PendingAssistantStatus.tsx` | exit ≠ 0이면 blocking. 측정(`aa46653`): 기준 exit 0 · N8 적용 시 exit 1 |

### ΔV1 등록 변이

| ID | 자리 | 종류 | 바꾼 내용 | 잡아야 할 oracle |
|---|---|---|---|---|
| N1 | `channel.ts` finally `waitPhase.end()` | 제거 | finally 첫 문장 삭제 | IT-01 I5·I6·I7 |
| N2 | `channel.ts:443` | 제거 | finish 분기 `waitPhase.end()` 삭제 | IT-01 I8 |
| N3 | `channel.ts:271` | 제거 | command 경로 `waitPhase.accepted()` 삭제 | IT-01 I9 |
| N4 | `channel.ts:426` | 제거 | `&& event.properties.sessionID === sessionId` 삭제 | IT-01 I10 |
| N5 | `adapter.ts:33` | 제거 | `readonly reportsWaitPhases = true as const` 삭제 | IT-02 플래그 단언 |
| N6 | `send.ts:256` | 다른 값 | 키 식 → `provisionalKey` | IT-03 A4 |
| N7 | `send.ts:740` | 다른 값 | 키 식 → `provisionalKey` | IT-03 A4·A6 |
| N8 | `PendingAssistantStatus.tsx:29` | 제거 | deps의 `activity.activityWaitPhase,` 삭제 | `gate:hooks-deps` |
| N9 | `wait-phase.ts` `accepted` | 제거 | `this.current?.kind !== 'send' \|\|` 삭제 | UT-01 R6c·R6d |
| N10a | `wait-phase.ts` `status` | 다른 값 | 폴백 `: 1` → `: 0` | UT-01 R7g |
| N10b | `wait-phase.ts` `status` | 제거 | `Number.isInteger(status.attempt) &&` 삭제 | UT-01 R7h |
| N11 | `projector.ts:140` | 제거 | `if (waitPhase) this.waitPhases.set(target, waitPhase)` 삭제 | UT-03 P9 |
| N12 | `projector.ts:154` | 제거 | `clear`의 `this.waitPhases.delete(sessionId)` 삭제 | UT-03 P10 |
| N13 | `projector.ts:170` | 제거 | `dispose`의 `this.waitPhases.clear()` 삭제 | UT-03 P11 |

### ΔV1 구현 지시

| 대상 | 변경 |
|---|---|
| `channel.ts` | catch의 `waitPhase.end()` 1줄 삭제(D-012) — 그 밖 production 변경 없음 |
| `wait-phase.test.ts` | R6c·R6d·R7g·R7h |
| `adapter.startup.test.ts` `describe('wait phases')` | I7~I10 |
| `opencode-runtime.test.ts` IT-02 | 실제 어댑터 `reportsWaitPhases === true` |
| `send.wait-phase.test.ts` | A1~A4에 키 단언, A6 신규 |
| `session-activity-projector.test.ts` | P9~P11 |
| gate | `hooks-deps` 실행 결과를 `[구현자 기입] 구현 보고`에 |
| 기록 | `[구현자 기입]` r2 절 — 강제 지점 표는 54자리 전부, 등록 변이 N1~N13 + V1 M-* 결과, EP-01′ 검색 11줄 차집합 |

### ΔV1 self-review

- D-011~D-013을 ACTIVE로 더했다. 대체한 결정은 없다. `ACTIVE 결정 ↔ AC` 대조는 §3 갱신 메모에 적었다(충돌 0).
- 확장 후보 3건은 모두 채택했다(경계 0). 지금이 verify 1회째 뒤라 창 안이다.
- 이행 결함 8건은 oracle 칸에 입력을 적어 구현자가 발명할 것을 없앴다. 원인은 V1 plan의 입력 칸이 규칙·자리 칸보다 좁았던 것이다(c7·c8·c10·c12·a3·a7·MD-01 accepted).
- 대체 AC 4행은 AC 게이트를 다시 통과했다. 행동 단언·검증 수단·도달 경로가 있고, 음성 단언(I10·P10·P11)은 양성 짝(I4·P1)과 같은 파일에 있다. I9는 경로 요청 수를 함께 본다.
- 자리 목록을 다시 셌다. EP-01 검색은 `aa46653`에서 12줄이고 c11 삭제 뒤 11이다. EP-02 검색 출력은 t1~t10에 모두 귀속된다(projector `:40·93-99·139-141·154·170·247-248·275`). 차집합은 0이다.
- 측정한 것: c11 단독 제거 green(r1 verify), `hooks-deps` 기준 0 → N8 1(이번 턴 실행). N1~N7·N9~N13의 red는 구현 뒤 측정 대상이다.
- 사람 실기(§19)는 그대로다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| foreground는 lease가 `preparing`이면 `preparing`, 활성 child가 있고 transport가 `ready`가 아니면 `streaming` | `app/src/main/features/chat/session-activity-projector.ts:10-18` |
| lease 활성화는 채널 생성보다 앞이다(`acquireTurnRuntime` 안 `activateChain`, 채널은 `coordinator.run` → `runtime.send`에서 생성) | `app/src/main/app/chat-turn/runtime-entry.ts:60` · `send.ts:413` · `post-turn.ts:92` |
| OpenCode streaming 라벨은 고정 `chat.activity.thinking`(`생각 중`) | `renderer/.../harnesses/registries/status.ts` `statusStreamingLabel` |
| 채널 `run()` 순서: `connect()` → `events()` 첫 이벤트(15초 제한) → `prepare()` → `session.create`(새 세션) → `submit()` → 이벤트 루프 | `app/src/main/adapters/opencode/v1/channel.ts:325-378` |
| `connect()` = `adapter.client()`: 리소스 스캔·MCP bridge → `servers.acquire` → `contexts.acquire` | `adapter.ts:116-195` |
| pool은 같은 key의 `ready` promise를 공유한다. 시작 여부는 pool만 안다 | `server.ts:206-255` |
| 첫 제출은 이벤트 루프 진입 전에 끝난다(`await submit(req, true)`) — 첫 턴의 수락은 항상 출력 관측보다 먼저 | `channel.ts:373` |
| `submit()`은 `mcpControl`이 있으면 MCP 게이트(제거 필수·멘션 대기·그 외 2초 한도)를 거친다. directory state는 `mcpControl`을 항상 만든다 | `channel.ts:141-153` · `mcp-control.ts:178-215` · `session-context.ts:182-191` |
| 재개 시 런타임이 없으면 `prepareNativeSession`이 lease `preparing` 안에서 `readHistory`(OpenCode는 서버 기동 포함)를 한다 | `resolve-turn.ts:125-149` · `native-session.ts:21` |
| 새 세션 활동 키 = `provisionalKey`(lease key `client:` id). session 확정 시 queue `rekey` → projector alias | `admission.ts:101-108` · `session-activity-projector.ts:104-140` |
| 요청 콜백 → projector 패턴이 이미 있다(`onSessionSchedules` → `setSchedules`) | `turn-request.ts:129-130` |
| 격리 준비 단계는 모든 라벨을 이긴다(0211 EP-03) | `activityLabel.ts:53-55` |
| 외부 SDK: `SessionStatus = idle \| retry{attempt,message,action?,next} \| busy` | `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:504-521`(1.18.27) |
| OpenCode retry: `attempt` 1부터, 시도마다 `busy` 재설정 | `opencode v1.19.0 packages/opencode/src/session/processor.ts:653,676-686` · `retry.ts:81` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `servers.acquire` 호출부 | `rg -n "servers\.acquire" app/src/main/adapters/opencode -g '!*.test.ts'` | 1 | `adapter.ts:156` 한 곳 — observer 전달 자리 |
| `this.client(` 호출부 | `rg -n "this\.client\(" app/src/main/adapters/opencode/v1/adapter.ts` | 5 | prepareComposer·complete·recoverSession·sendMessage·readHistory. observer는 sendMessage만 |
| `ChatActivitySnapshot` 필드 소비처(main) | `rg -n "activity\.(foreground\|transport)" app/src/main -g '!*.test.ts'` | 2 | `project-resource-sync.ts:41`·`session-activity-busy.ts:7` — 새 선택 필드 무영향 |
| renderer 활동 필드 복사 지점 | `rg -n "activityForeground" app/src/renderer/src/features/chat -g '!*.test.ts'` | 7 | 선언·초기값·`chat.activity`·LOAD_SESSION 2분기·selector·`PendingAssistantStatus` — EP-05 자리와 대응 |
| 모델 출력 이벤트 집합 정의 | `rg -n "MODEL_OUTPUT_EVENTS" app/src -g '!*.test.ts'` | 2 | 정의 `turn-coordinator.ts:43` + 사용 `:406` |
| 새 이름 충돌 | `rg -n "[Ww]aitPhase" app/src` | 0 | `waitPhase` 계열 이름 미사용 확인(`phase`는 109줄 사용 중이라 피함) |
| `coordinator.run` 호출부 | `rg -n "coordinator\.run" app/src/main/app/chat-turn/post-turn.ts` | 3 | 최초·listen·continuation — 모두 `handleChatSend` finally 안 |

### 수치 / 전칭 표현 검산

- "lease 활성화 뒤 OpenCode 연결 전체가 `생각 중`": 활성화(`runtime-entry.ts:60`)와 채널 `connect()`(`channel.ts:325`) 사이에 foreground를 바꾸는 코드 0 — `setTransport` 호출은 `post-turn.ts:64·76`의 listen 단계뿐.
- "mcpControl은 항상 있다": `session-context.ts:182` 생성식에 조건 없음 — `rg -n "mcpControl: new OpenCodeMcpControl" app/src/main/adapters/opencode/v1/session-context.ts` 1건.
- 문서 앵커: `docs/handoff/AGENTS.md §공통 V 추적 프로토콜`·`§판정 범위와 운영 gate`·`§INDEX.md 운영` 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`.
- 현재 책임 소유자: 라벨 = renderer `deriveActivityLabel`(foreground·facts·prepareStep), foreground = projector(lease·transport).
- 흐름: `chat:send` → lease `preparing`(`응답 준비 중…`) → 활성화 → foreground `streaming` → OpenCode 채널이 서버·프로젝트·세션·MCP·전송·모델 대기를 수행하는 동안 `생각 중`.
- 문제의 직접 원인: 채널 내부 경계를 main 활동 스냅샷에 올리는 신호가 없다.

```text
handleChatSend ─ lease preparing ─▶ projector(foreground=preparing) ─▶ "응답 준비 중…"
      └ activateChain ─▶ projector(foreground=streaming) ─▶ "생각 중"
            └ openCodeChannel.run: connect·SSE·prepare·create·submit·대기  (화면 신호 없음)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`~`AR-04`.
- 변경 후 책임 소유자: 채널 단계 = `OpenCodeWaitPhase`(adapter, 순수) · Orca 준비 단계 = `handleChatSend`(app) · 저장·억제·비교 = projector · 표시 우선순위 = `deriveActivityLabel`.
- 흐름: producer가 `ChatWaitPhase | null`을 projector에 기록 → 스냅샷 `waitPhase`(foreground ≠ idle일 때만) → reducer `activityWaitPhase` → StatusLine 문구.
- 정리 경로: 채널이 출력·종료·오류·finally에서 비우고, `handleChatSend` finally가 chain 끝에서 한 번 더 비운다.

```text
handleChatSend ─ setWaitPhase(preparing) ─┐   resolveTurn ─ onNativeHistory → history/preparing ─┐
openCodeChannel ─ OpenCodeWaitPhase ─ req.onWaitPhase ─ buildTurnRequest ─┴─▶ projector.setWaitPhase
   (pool observer.serverStarting → server)                                   └▶ chat.activity{waitPhase}
                                                                               └▶ reducer activityWaitPhase
                                                                                  └▶ PendingAssistantStatus → StatusLine
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 채널 단계 신호 없음 | `OpenCodeWaitPhase`가 채널 경계를 단계로 바꾼다 | D-001·D-008 | MD-01 / VP-14 · `wait-phase.ts` |
| data/control flow | 스냅샷 = lease·queue·background·transport·예약 | + `waitPhase`(선택) | 라벨에 단계 운반 | AR-01 / VP-10·VP-16 · projector |
| state/contract | `ChatActivitySnapshot` 고정 필드 | `waitPhase?: ChatWaitPhase` · `TurnRequest.onWaitPhase?` · `SessionAdapter.reportsWaitPhases?` · `OpenCodeServer.acquire(…, observer?)` | 생산자·소비자 계약 | AR-01~AR-03 / VP-10~VP-12 |
| 라벨 규칙 | prepareStep > status | prepareStep > {preparing,history} · 채널 단계 > prepareStep · 단계 > status | D-010 | MD-02 / VP-15·VP-05 |
| error/lifecycle | 해당 없음 | 출력·종료·오류·close·chain finally에서 비움 | AC7 | SD-01 / VP-09 |
| 모델 출력 판정 | coordinator 내부 상수 | `shared/model-output.ts` SSOT를 coordinator·채널이 공유 | 같은 규칙 두 레이어 | MD-05 / VP-18 |
| test seam | 해당 없음 | 순수 `wait-phase.ts` · sink 호출 배열 · ST 게이트 | 순서 관측 | VP-10·VP-09 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/ipc.ts` | `ChatWaitPhase` 타입·`CHAT_WAIT_PHASE_KINDS` · 스냅샷 필드 | — | main·renderer |
| `shared/model-output.ts`(신규) | 모델 출력 이벤트 집합 SSOT | `{type}` → boolean | coordinator · `wait-phase.ts` |
| `adapters/opencode/v1/wait-phase.ts`(신규) | 채널 경계 → 단계 상태 기계, 같은 값 중복 억제 | 메서드 호출 → sink | `channel.ts` |
| `adapters/opencode/v1/channel.ts` | 경계마다 상태 기계 호출 | — | adapter |
| `adapters/opencode/v1/server.ts` | 새 서버 시작·시작 중 합류 시 `observer.serverStarting()` | acquire 4번째 인자 | adapter `client()` |
| `app/chat-turn/send.ts`·`resolve-turn.ts`·`turn-request.ts` | Orca 준비 단계 기록·이력 확인 단계·요청 콜백 배선·chain 끝 비움 | `activity.setWaitPhase` | — |
| `features/chat/session-activity-projector.ts` | 저장·동치 억제·foreground idle 억제·alias | `setWaitPhase(key, phase\|null)` | app |
| renderer `chatReducer`·`chatStore`·`PendingAssistantStatus` | 운반 | 스냅샷 → `activityWaitPhase` | — |
| renderer `lib/activityLabel.ts` | 우선순위·문구 키 | `ActivityView.waitPhase` → `ActivityLabelModel.waitPhase` · `waitPhaseLabel()` | StatusLine |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01·AR-01 / VP-14·VP-10·VP-01~03·VP-08 | **EP-01** 채널 경계 호출 12자리: c1 `run()` connect 인자 `serverStarting: () => waitPhase.serverStarting()` · c2 첫 SSE 이벤트 직후 `connected()` · c3 `if (!sessionId)` 생성 직전 `creatingSession()` · c4 `submit()` mcpControl 분기 `admitting()` · c5 `submitPrepared()` 첫 문장 `sending()` · c6 `promptAsync` resolve 직후 `accepted()` · c7 `session.command` dispatch 직후 `accepted()` · c8 루프 root `session.status` → `status(…)` · c9 루프 publish 전 `observe(mapped.events)` · c10 루프 finish 분기 `end()` · c11 `run()` catch `end()` · c12 `run()` finally `end()` | `wait-phase.ts` | `channel.ts` | 채널 수명 | `rg -n "waitPhase\.(serverStarting\|connected\|creatingSession\|admitting\|sending\|accepted\|status\|observe\|end)\(" app/src/main/adapters/opencode/v1/channel.ts` → 12 | 자리 하나가 빠지면 그 단계가 안 보이거나(c1~c7) 이전 단계가 남는다(c9~c12) |
| MD-01 / VP-14 | **규칙**: serverStarting→`server` · connected→`project` · creatingSession→`session` · admitting→`mcp` · sending→`send`(출력 플래그 초기화) · accepted→현재가 `send`일 때만 `model` · status(retry)→`retry(attempt)` · status(busy)→현재가 `retry`일 때만 출력 전 `model`/출력 뒤 `null` · status(idle)→무시 · observe(모델 출력 포함)→`null`+출력 플래그 · end→`null` · 초기값 `null`, 같은 값(kind·attempt, `null` 포함)은 sink 재호출 없음 · sink 없으면 무동작 | `wait-phase.ts` | — | 호출마다 | (규칙 칸 — 분기 입력은 §11 UT-01 표) | 분기 오판 시 거짓 단계(예: retry 중 `model`) |
| AR-01·MD-03 / VP-10·VP-16·VP-09 | **EP-02** 운반 7자리: t1 `adapters/common/turn.ts` `TurnRequest.onWaitPhase?` · t2 `channel.ts` `new OpenCodeWaitPhase(req.onWaitPhase)` · t3 `turn-request.ts` `onWaitPhase: (phase) => activity.setWaitPhase(getActiveTurn().dbSessionId ?? queueKey, phase)` · t4 projector `setWaitPhase()` 저장(동치 조기 반환·`cleared`/disposed 무시·canonicalKey) · t5 projector `compute()` `waitPhase`(foreground ≠ idle일 때만) · t6 projector `sameActivity()` kind·attempt 비교 · t7 `shared/ipc.ts` `ChatActivitySnapshot.waitPhase?` | projector | adapter·app·features | 단계 변경마다 | `rg -n "onWaitPhase\|setWaitPhase\|waitPhases\|waitPhase" app/src/main/adapters/common/turn.ts app/src/main/app/chat-turn/turn-request.ts app/src/main/features/chat/session-activity-projector.ts app/src/shared/ipc.ts` + `rg -n "new OpenCodeWaitPhase" app/src/main/adapters/opencode/v1/channel.ts` → 출력 줄은 t1~t7 중 하나(주석·타입 import 제외) | 한 자리라도 빠지면 스냅샷에 단계가 없거나(t1~t5·t7) 바뀐 단계가 방출되지 않는다(t6) |
| AR-02·MD-04 / VP-11·VP-17 | **EP-03** observer 7자리: s1 `server.ts` `acquire` 새 entry 분기 `observer?.serverStarting()` · s2 기존 entry 미정착 합류 `observer?.serverStarting()` · s3 entry `readySettled = true`(ready resolve) · s4 `implementation.ts` `OpenCodeServer.acquire` 4번째 인자 타입 · s5 `adapter.ts` `client()` → `servers.acquire(…, observer)` · s6 `adapter.ts` `sendMessage` connect → `this.client(…, observer)` · s7 `channel.ts` `connect` 파라미터 타입 | `server.ts` | pool·adapter | acquire마다 | `rg -n "serverStarting\|readySettled" app/src/main/adapters/opencode/implementation.ts app/src/main/adapters/opencode/v1/server.ts app/src/main/adapters/opencode/v1/adapter.ts app/src/main/adapters/opencode/v1/channel.ts` → s1~s7 + c1 | s1·s2 누락 시 cold에서 `server` 미표시, s3 누락 시 warm에서 거짓 `server` |
| AR-03 / VP-12·VP-04·VP-06·VP-08 | **EP-04** app 7자리: a1 `adapters/common/types.ts` `SessionAdapter.reportsWaitPhases?: true` · a2 `OpenCodeAdapter.reportsWaitPhases = true` · a3 `send.ts` try 첫 문장 `reportWaitPhase({ kind: 'preparing' })`(lease 획득 뒤, `reportsWaitPhases === true`일 때만) · a4 `send.ts` → `resolveTurn(…, { onNativeHistory })`: true→`history`, false→`preparing` · a5 `resolve-turn.ts` `prepareNativeSession` 직전 `onNativeHistory?.(true)` · a6 같은 블록 finally `onNativeHistory?.(false)` · a7 `send.ts` 바깥 finally `activity.setWaitPhase(leaderTurn?.dbSessionId ?? payload.sessionId ?? provisionalKey, null)`(무조건) | `send.ts` | app | chain 시작·이력 확인·chain 끝 | `rg -n "reportsWaitPhases\|reportWaitPhase\|onNativeHistory\|setWaitPhase" app/src/main/adapters/common/types.ts app/src/main/contracts/ports.ts app/src/main/adapters/opencode/v1/adapter.ts app/src/main/app/chat-turn/send.ts app/src/main/app/chat-turn/resolve-turn.ts` → a1~a7(+`RuntimeSessionAdapter` Pick에 필요하면 그 1줄) | a3 누락 시 채널 시작 전 틈에 `생각 중`(D-009), a3 게이트 누락 시 Claude 스냅샷에 단계(D-007), a6 누락 시 이력 실패 뒤 `history` 잔존, a7 누락 시 조기 종료 뒤 잔존 |
| AR-04 / VP-13·VP-05 | **EP-05** renderer 10자리: r1 `ChatState.activityWaitPhase` 선언 · r2 `initialChatState` `null` · r3 `chat.activity` case `ev.waitPhase ?? null` · r4 LOAD_SESSION preserve 분기 `state.activityWaitPhase` · r5 LOAD_SESSION snapshot 분기 `activity.waitPhase ?? null` · r6 `useChatActivity` Pick·selector · r7 `PendingAssistantStatus` activityView `waitPhase`(+memo deps) · r8 `ActivityView` Pick `'waitPhase'` · r9 `deriveActivityLabel` `activity.waitPhase` 판독 · r10 공통 StatusLine `label.waitPhase` 분기 | reducer | renderer | 스냅샷 수신·세션 로드·렌더 | `rg -n "activityWaitPhase\|waitPhase" app/src/renderer/src/features/chat -g '!*.test.ts'` → r1~r10 + EP-06 자리 | 운반 자리 하나가 빠지면 main이 보낸 단계가 화면에 안 닿는다 |
| MD-02 / VP-15·VP-05·VP-07 | **EP-06** 표시 3자리: w1 `deriveActivityLabel` 우선순위(규칙 아래) · w2 `waitPhaseLabel(phase)`: `preparing`→`chat.activity.preparing`, 그 외→`harness.waitPhase.<kind>`, retry→`{attempt}` · w3 i18n `harness.waitPhase` ko·en 8키(history·server·project·session·mcp·send·model·retry) | `activityLabel.ts` · resources | renderer | 렌더 | `rg -n "waitPhaseLabel\|harness\.waitPhase\|waitPhase: \{" app/src/renderer/src` → w1~w3 | 문구·키 어긋남은 파리티 테스트·IT-04 red |
| MD-02 / VP-15 | **규칙**(w1): `activity.foreground === 'idle'`이면 단계 무시 · `prepareStep` 있고 단계가 없거나 `preparing`/`history`면 `{status:'preparing', facts:[], prepareStep}`(기존) · `prepareStep` 있어도 채널 단계면 단계 우선(`prepareStep` 생략, facts 계산) · 단계 있으면 `waitPhase` 실음 + 기존 status·facts 유지 · 단계 없으면 기존 파생 | `activityLabel.ts` | — | 렌더마다 | (규칙 칸 — 입력은 UT-02 표) | 우선순위 오판 시 격리 세션에서 단계 미표시 또는 거짓 대기 |
| MD-05 / VP-18·VP-24 | **EP-07** SSOT 3자리: e1 `shared/model-output.ts` `MODEL_OUTPUT_EVENT_TYPES`(`message.delta`·`message.reasoning.delta`·`message.reasoning`·`message.completed`·`tool.call.started`) + `isModelOutputEvent` · e2 `turn-coordinator.ts` 소비 판정이 `isModelOutputEvent` 사용 · e3 `wait-phase.ts` `observe`가 `isModelOutputEvent` 사용 | `shared/model-output.ts` | — | 이벤트마다 | `rg -n "MODEL_OUTPUT_EVENT\|isModelOutputEvent" app/src/main app/src/shared -g '!*.test.ts'` → e1~e3 · `rg -n "MODEL_OUTPUT_EVENTS" app/src` → 0 | 사본이 생기면 두 판정이 갈린다 |
| R-09 / VP-19 | **EP-08** 문서 3자리: d1 `docs/IPC_CONTRACT.md` `chat.activity` 행 · d2 `docs/arch/backend/provider-runtime.md` '활동 스냅샷' 항목 1문장 · d3 `docs/arch/frontend/ux-domains.md` §1.3 표 1행 | 문서 | 구현자 | 커밋 | `rg -n "waitPhase" docs/IPC_CONTRACT.md docs/arch/backend/provider-runtime.md` → d1·d2 · `rg -n "모델 응답을 기다리는" docs/arch/frontend/ux-domains.md` → d3 | 계약 드리프트 |

- 자리 목록은 그 검색 출력과 차집합 0이어야 한다. 출력에 목록 밖 운반 자리가 나오면 `PLAN_GAP`(목록 미고정)이다.
- **선언 경계**:
  - 같은 microtask 안의 연속 전이는 projector가 하나로 합쳐 중간 단계가 화면에 안 나올 수 있다 — `recompute`가 `queueMicrotask`로 flush(`session-activity-projector.ts:168-182`).
  - 첫 모델 출력 이벤트와 단계 비움 스냅샷은 서로 다른 IPC 메시지라 도착 순서가 뒤바뀌면 한 프레임 동안 출력과 `모델 응답을 기다리는 중…`이 함께 보일 수 있다.
  - 응답 중 즉시 보내기(steer)로 `pushTurn`이 들어오면 출력 중에도 `mcp`→`send`→`model`이 잠시 보인다 — 다음 모델 출력에서 비워진다.
  - child session(서브에이전트) `retry`는 표시하지 않는다(root만, c8).
  - `요청을 보내는 중…`은 슬래시 명령 목록 준비(최대 30초)·명시 agent/variant 카탈로그 확인을 포함한다(`channel.ts:162-190`).
  - 재개 시 이력 확인이 서버를 내렸다가 채널이 다시 시작하는 이중 시작은 그대로이며 화면은 `history` 뒤 `server`를 다시 보인다(분석 문서 §4).
- 열린 입력 집합: 해당 없음(단계 종류는 `CHAT_WAIT_PHASE_KINDS` 유한 집합).
- 같은 규칙이 여러 레이어에: 모델 출력 판정은 EP-07 SSOT. 단계 종류는 `shared/ipc.ts` 한 곳.
- `실패 의미`의 "다른 게이트가 막는다": 없음.
- 선택적 필드: `waitPhase` 부재 = 단계 없음. `onWaitPhase`·`reportsWaitPhases`·`observer` 부재 = 기능 미사용(fail-closed — Claude 불변).
- 외부 SDK 경계: `session.status.properties.status`를 `SessionStatus` 그대로 받는다. `retry.attempt`만 운반하고 `message`·`action`·`next`는 쓰지 않는다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` | 계약 | `CHAT_WAIT_PHASE_KINDS`, `ChatWaitPhase = { kind: Exclude<…,'retry'> } \| { kind: 'retry'; attempt: number }`, `ChatActivitySnapshot.waitPhase?` | 타입 |
| `app/src/shared/model-output.ts`(신규) | SSOT | 상수·판정 함수 | UT-01 R8a |
| `app/src/main/features/chat/turn-coordinator.ts` | 소비 판정 | 지역 `MODEL_OUTPUT_EVENTS` 삭제, `isModelOutputEvent` 사용 | REGRESSION VP-24 |
| `app/src/main/adapters/opencode/v1/wait-phase.ts`(신규) | 상태 기계 | §10 규칙. electron·SDK 런타임 import 없음(SDK는 type import만) | UT-01 |
| `app/src/main/adapters/opencode/v1/channel.ts` | 호출 | EP-01 12자리 + t2 · connect 파라미터에 observer | IT-01 |
| `app/src/main/adapters/opencode/v1/server.ts` · `../implementation.ts` | observer | EP-03 s1~s4 | UT-04 · IT-02 |
| `app/src/main/adapters/opencode/v1/adapter.ts` | 전달 | `client(…, snapshot, observer?)` · sendMessage connect · `reportsWaitPhases = true as const` | IT-01·IT-02 |
| `app/src/main/adapters/common/turn.ts` · `types.ts` | 포트 | `onWaitPhase?` · `reportsWaitPhases?` | 타입 |
| `app/src/main/features/chat/session-activity-projector.ts` | 저장·억제 | `waitPhases` Map · `setWaitPhase` · `compute`·`sameActivity` · `promote`·`clear`·`dispose`에 Map 반영 | UT-03 |
| `app/src/main/app/chat-turn/turn-request.ts` | 배선 | t3 | IT-02 |
| `app/src/main/app/chat-turn/resolve-turn.ts` | 이력 단계 | `resolveTurn` 6번째 인자 `{ onNativeHistory? }` · a5·a6 | native-session 테스트 |
| `app/src/main/app/chat-turn/send.ts` | Orca 단계 | a3·a4·a7 | IT-03 |
| renderer `reducer/chatReducer.ts` · `store/chatStore.ts` · `components/transcript/PendingAssistantStatus.tsx` | 운반 | EP-05 r1~r7 | IT-04 |
| renderer `lib/activityLabel.ts` | 규칙 | r8·r9·w1·w2 | UT-02 |
| renderer `harnesses/common/transcript/StatusLine.tsx` | 표시 | r10: `prepareStep` → 단계 → status 순 문구 | IT-04 |
| renderer `shared/i18n/resources/ko.ts`·`en.ts` | 문구 | w3 | 파리티 |

### 신규·변경 테스트

**UT-01 `adapters/opencode/v1/wait-phase.test.ts`** — 규칙 칸 ↔ 입력 1:1

| ID | 입력(호출 순서) | 기대 sink 호출 |
|---|---|---|
| R1 | `serverStarting()` | `[{server}]` |
| R2 | `connected()` | `[{project}]` |
| R3 | `creatingSession()` | `[{session}]` |
| R4 | `admitting()` | `[{mcp}]` |
| R5 | `observe([delta])`, `sending()`, `accepted()` | `[{send}, {model}]` — 초기값 `null`이라 첫 observe는 무호출, 출력 플래그가 `sending`에서 초기화되어 `model` 도달 |
| R6a | `sending()`, `accepted()` | `[{send},{model}]` |
| R6b | `sending()`, `observe([delta])`, `accepted()` | `[{send}, null]` (accepted 무동작) |
| R7a | `status({type:'retry',attempt:2,message:'x',next:1})` | `[{retry,2}]` |
| R7b | `sending()`,`accepted()`,`status(retry 1)`,`status({type:'busy'})` | `[send, model, {retry,1}, model]` |
| R7c | `sending()`,`accepted()`,`observe([delta])`,`status(retry 1)`,`status(busy)` | `[send, model, null, {retry,1}, null]` |
| R7d | `sending()`,`status(busy)` | `[{send}]` |
| R7e | `status(retry 1)`,`status(retry 2)` | 두 호출, attempt 1·2 |
| R7f | `sending()`,`status({type:'idle'})` | `[{send}]` |
| R8a | `sending()` 뒤 `observe([e])` — e ∈ `message.delta`·`message.reasoning.delta`·`message.reasoning`·`message.completed`·`tool.call.started` 각각 | 각 케이스 끝 `null` |
| R8b | `sending()`,`observe([session.updated, telemetry])` | `[{send}]` |
| R9 | `connected()`,`end()` | `[{project}, null]` |
| R10 | `connected()`,`connected()` | `[{project}]` 1회 |
| R11 | sink `undefined`로 생성 후 전 메서드 호출 | throw 없음 |

**UT-02 `renderer/.../lib/activityLabel.test.ts`** 신규 describe '대기 단계 (0296)'

| ID | 입력 | 기대 |
|---|---|---|
| L1 | foreground `streaming`, waitPhase `{server}` | `waitPhase.kind='server'`, status `streaming` |
| L2 | foreground `preparing`, waitPhase `{history}` | `waitPhase.kind='history'`, status `preparing` |
| L3 | foreground `idle`, listening true, waitPhase `{model}` | waitPhase 없음, status `waiting` |
| L4 | prepareStep `branch`, waitPhase `{preparing}` | prepareStep `branch`, waitPhase 없음 |
| L5 | prepareStep `branch`, waitPhase `{history}` | prepareStep `branch`, waitPhase 없음 |
| L6 | prepareStep `session`, waitPhase `{server}`, queuedCount 1 | waitPhase `server`, prepareStep 없음, facts `[queued 1]` |
| L7 | foreground `streaming`, waitPhase `{model}`, queuedCount 1 | facts `[queued 1]` 유지 |
| K1 | `waitPhaseLabel` — 9 kind 각각 | `preparing`→`chat.activity.preparing`, 나머지 `harness.waitPhase.<kind>`, retry params `{attempt:3}` |

**UT-03 `features/chat/session-activity-projector.test.ts`** 신규 P1~P8 — lease 소스 stub(foreground 반환값 제어).

| ID | 입력 | 기대 |
|---|---|---|
| P1 | foreground `streaming`, `setWaitPhase(k,{server})` | emit 1회, `waitPhase.kind='server'` |
| P2 | P1 뒤 같은 값 재설정 | 추가 emit 0, revision 불변 |
| P3 | `{retry,1}` → `{retry,2}` | emit, attempt 2 |
| P4 | `setWaitPhase(k,null)` | emit, `waitPhase` 부재 |
| P5 | foreground `idle` + `{model}` | 스냅샷 `waitPhase` 부재 |
| P6 | `promote('client-1','s1')` 뒤 `setWaitPhase('client-1',{send})` | `current('s1').waitPhase.kind='send'` |
| P7 | `clear('s1')` 뒤 `setWaitPhase('s1',{send})` | emit 0 |
| P8 | `{project}` → `{session}`(다른 필드 동일) | emit — `sameActivity`가 kind를 본다 |

**UT-04 `adapters/opencode/v1/server.test.ts`** 신규 S1~S5(기존 spawn mock 하네스)

| ID | 입력 | 기대 |
|---|---|---|
| S1 | 빈 pool `acquire(…, observer)` | `serverStarting` 1회 |
| S2 | 시작 미완료 중 같은 key 두 번째 `acquire(…, observer2)` | `observer2.serverStarting` 1회 |
| S3 | ready 뒤 같은 key `acquire(…, observer3)` | 0회 |
| S4 | 시작 실패(exit) 뒤 같은 key 재acquire | 다시 1회 |
| S5 | observer 없이 acquire | throw 없음 |

**IT-01 `adapters/opencode/v1/adapter.startup.test.ts`** 신규 describe 'wait phases' — fixture `acquire(config, env, cwd, observer)`가 cold 플래그면 `observer?.serverStarting()` 호출, `send()`가 `onWaitPhase` spy를 받는다.

| ID | 입력 | 기대 배열(kind, 비움=null) |
|---|---|---|
| I1 cold | cold 플래그 | `[server, project, session, mcp, send, model, null]` |
| I2 warm | 플래그 없음 | `[project, session, mcp, send, model, null]` |
| I3 다음 턴 | I2 뒤 `pushTurn` | 두 번째 구간 `[mcp, send, model, null]` |
| I4 retry | prompt 처리기가 text 전에 root `session.status retry(1)`·`busy` 송출 | `[…, model, {retry,1}, model, null]` |
| I5 오류 | `/config` 500 | 마지막 `null`, error 이벤트 |
| I6 close | `/config` 게이트 중 `live.close()` | 마지막 `null` |

**IT-02 `app/chat-turn/opencode-runtime.test.ts`** 신규 케이스 — 실제 `OpenCodeServerPool`(spawn mock)·`createOpenCodeAdapter`·`buildTurnRequest`(activity = `{ setWaitPhase: vi.fn() }`)·`SessionRuntime`: 첫 턴 `setWaitPhase` 인자 배열 `[server, project, session, mcp, send, model, null]`(키 = queueKey 또는 확정 sessionId), 같은 runtime 두 번째 턴에 `server` 0.

**IT-03 `app/chat-turn/send.wait-phase.test.ts`**(신규, `send.worktree.test.ts` 하네스 구성)

| ID | 입력 | 기대 |
|---|---|---|
| A1 | adapter `{id:'opencode', reportsWaitPhases:true}` 새 세션 | `setWaitPhase(provisionalKey,{preparing})`가 `acquireTurnRuntime` mock 호출보다 앞 |
| A2 | A1 정상 종료 | 마지막 호출 `setWaitPhase(…, null)` |
| A3 | `acquireTurnRuntime` reject | 마지막 호출 `null` |
| A4 | `resolveTurn` mock이 `options.onNativeHistory(true)`·`(false)` 호출 | `[preparing, history, preparing, …, null]` |
| A5 | adapter `reportsWaitPhases` 없음(Claude) | 비-null `setWaitPhase` 호출 0 |

**native-session.test.ts** 신규 3케이스(실제 `resolveTurn`): readHistory 게이트 중 `onNativeHistory` 호출 `[true]` → 해제 뒤 `[true,false]` · readHistory reject여도 `[true,false]` · `supervisor.peekRuntime` 있음 → 0회.

**ST-01 `app/chat-turn/opencode-runtime.test.ts`** 신규 케이스 — IT-02 구성에 실제 `SessionActivityProjector`(queue = 실제 `PendingMessageQueue`, backgroundTasks·leases stub — foreground `streaming`). `/config` 게이트 중 `current(key).waitPhase.kind === 'project'` → 해제 → 턴 종료 뒤 `waitPhase` 부재 → 두 번째 턴 `prompt_async` 게이트 중 `'send'` → 종료 뒤 부재 → 세 번째 턴 게이트 중 `close()` 뒤 부재.

**IT-04 `renderer/.../components/statusLine.waitPhase.test.ts`**(신규, `statusLine.background.test.ts` 구성): `chatReducer(initialChatState, RECV_EVENT chat.activity{revision 1, foreground 'streaming', waitPhase k})`를 store에 넣고 backend `opencode`로 `PendingAssistantStatus` 렌더 → `[aria-live]` 텍스트가 9 kind 각각의 ko 원문(D-001~D-003, `preparing`은 `응답 준비 중…`, retry attempt 2는 `재시도 대기 중 (2번째)…`) · queuedCount 1이면 `입력 대기 1건` 함께 · revision 1 뒤 revision 1 다른 단계 → 무시 · `LOAD_SESSION` activity `waitPhase {model}` → `activityWaitPhase` · preserve 분기 → 기존 값 유지.

### 테스트 가능성

- electron 의존 분리: `wait-phase.ts`는 순수(SDK type import만). projector는 기존처럼 electron 없음.
- 기존 메커니즘 재사용: `onSessionSchedules` → `setSchedules`와 같은 형상(요청 콜백 → projector). 시점도 같다(채널 수명 동안 최초 요청 클로저).
- 순서 관측: 채널 sink 동기 호출 배열(IT-01·IT-02), app은 `setWaitPhase` mock 호출과 `acquireTurnRuntime` mock의 `invocationCallOrder` 비교(IT-03).

## 12. End-to-end 영향

### producer → consumer

```text
OpenCodeWaitPhase / handleChatSend → projector.setWaitPhase → chat.activity{waitPhase} → reducer activityWaitPhase → deriveActivityLabel → StatusLine
```

- producer 기준: 단계는 경계 통과 사실이다(D-008). 같은 값은 다시 보내지 않는다.
- consumer 파생 규칙: foreground ≠ idle일 때만 표시, `prepareStep`과의 순위는 §10 w1.
- 파생 합성값 우회: 없음 — renderer는 단계를 만들지 않고 스냅샷 값만 읽는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `project-resource-sync.ts:41` · `session-activity-busy.ts:7` | foreground·transport만 읽음 — 무영향. 단계 변경으로 emit이 늘어 `activityChanged()` 호출이 턴당 수 회 증가 | AC12 |
| bootstrap `emit` → `resourceActivityChanged()` | 같은 이유로 호출 증가(멱등 갱신) | §14 |
| 세션 목록 DTO `activity`(`current()`) | 단계 포함 — hydrate 복원 | AC13 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: chain lease 획득 직후 `preparing`(OpenCode만). 채널 생성 시 `OpenCodeWaitPhase` 1개(채널 수명).
- 취소/중단: 사용자 중단 → 응답 idle 또는 `turn.aborted` → c10/c11/c12. chain 중단 → a7.
- 종료/quit/crash/renderer-gone: 채널 `close()` → `run()` finally c12. projector `dispose()`가 Map을 비운다.
- retry/timeout/partial failure: OpenCode retry는 단계, 이벤트 연결 시간 초과·준비 실패는 catch c11.
- cleanup/rollback: 비움은 멱등(동치면 무동작).
- 다중 저장소 쓰기: 해당 없음(projector 메모리 1곳). 문서 산출물의 판정 사본은 이 `plan.md` + `INDEX.md` 행 2곳이다.

## 14. 성능 / 상한 / 최적화

- 새 출력: 턴당 단계 전이 ≤ 8 + 2 × OpenCode 재시도 횟수. 스냅샷 방출은 전이 수 이하(동치 억제·microtask 합침).
- 새 요청 수: 0(네트워크 없음).
- 캐시/호출 축소: 없음.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port: 없음. `OpenCodeServer`는 앱 내부 포트이고 4번째 인자는 선택이라 기존 테스트 fixture 구현이 그대로 대입된다(typecheck).
- 구현 문서: `docs/IPC_CONTRACT.md` `chat.activity` 행(d1).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0211 EP-03 준비 단계가 모든 것을 이긴다 | `activityLabel.ts:53-55` 주석 | §10 w1 규칙 | 변경 — 채널 단계에 한해 순위 역전(D-010). 기존 3케이스는 유지(VP-20) |
| 0211 D-003 경과 시간으로 단계를 추측하지 않는다 | `chatReducer.ts:350-351` 주석 | D-008 | 유지 |
| 0167 foreground 구간에는 무활동 라벨을 붙이지 않는다 | `activityLabel.ts:81-83` | §10 w1 "단계 있으면 기존 status 유지" | 유지 |
| 0262 D-014 OpenCode 격자 스피너 | `StatusLine.tsx` 헤더 | §11 StatusLine | 유지(스피너 무변경) |
| 0069 첫 모델 출력 = 소비 증거 | `turn-coordinator.ts:245-252` 주석 | EP-07 | 유지 — 상수 위치만 이동 |
| main 레이어: feature 교차 import 금지·하향 의존 | `app/src/main/AGENTS.md` | §9 책임 표 | 유지 — adapter는 shared만, app이 projector 주입 |
| `inflight`는 renderer 소유, 스냅샷 foreground는 라벨 전용 | `chatReducer.ts:1239-1242` | EP-05 | 유지 — 단계도 라벨 전용 |
| 문서에 코드 수치 금지 | `docs/AGENTS.md` 작성 규칙 2 | EP-08 | 유지 — 문서에 단계 개수를 쓰지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| `server` 문구에 "OpenCode"가 들어가 다른 하네스가 이 단계를 쓰면 문구가 틀린다 | 현재 생산자는 OpenCode뿐(`reportsWaitPhases`). 다른 하네스가 쓰면 그 handoff가 문구를 정한다 |
| 단계 방출 증가로 `resourceActivityChanged` 호출 증가 | 턴당 한 자릿수(§14). 멱등 |
| warm 서버 판정 오류로 거짓 `server` | s3 `readySettled` + UT-04 S3 |

- 되돌리기 어려운 결정: 없음(내부 IPC, 미영속).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/ipc.ts` · `app/src/shared/model-output.ts`(신규)
- `app/src/main/adapters/common/{turn,types}.ts` · `app/src/main/contracts/ports.ts`(Pick 필요 시)
- `app/src/main/adapters/opencode/implementation.ts` · `app/src/main/adapters/opencode/v1/{adapter,channel,server,wait-phase}.ts`
- `app/src/main/features/chat/{session-activity-projector,turn-coordinator}.ts`
- `app/src/main/app/chat-turn/{send,resolve-turn,turn-request}.ts`
- `app/src/renderer/src/features/chat/{reducer/chatReducer.ts,store/chatStore.ts,components/transcript/PendingAssistantStatus.tsx,lib/activityLabel.ts,harnesses/common/transcript/StatusLine.tsx}`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- 테스트: §11 목록
- `docs/IPC_CONTRACT.md` · `docs/arch/backend/provider-runtime.md` · `docs/arch/frontend/ux-domains.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md`(boundaries) · `app/src/renderer/AGENTS.md`.
- ABI/네트워크: 대상 테스트는 비-DB — `pretest` 우회 직접 실행.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/main/adapters/opencode/v1/wait-phase.test.ts src/main/adapters/opencode/v1/server.test.ts src/main/adapters/opencode/v1/adapter.startup.test.ts src/main/app/chat-turn/opencode-runtime.test.ts src/main/app/chat-turn/send.wait-phase.test.ts src/main/app/chat-turn/native-session.test.ts src/main/features/chat/session-activity-projector.test.ts src/main/features/chat/turn-coordinator.test.ts src/renderer/src/features/chat/lib/activityLabel.test.ts src/renderer/src/features/chat/components/statusLine.waitPhase.test.ts src/renderer/src/features/chat/components/StatusLine.harness.test.ts src/renderer/src/shared/i18n/resources/resources.test.ts`.
- 추가: `node scripts/check-test-budgets.mjs` · `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기(AC15, Windows 실제 OpenCode 1.x): ① 서버가 꺼진 상태에서 OpenCode Composer로 새 세션 전송 → 문구가 `응답 준비 중… → OpenCode 서버를 시작하는 중… → 프로젝트를 불러오는 중… → … → 생각 중`으로 진행 ② 같은 세션 두 번째 메시지 → 서버·프로젝트·세션 단계 없음 ③ 앱 재시작 뒤 기존 세션에 전송 → `이전 대화를 확인하는 중…` 표시 ④ Claude 세션 전송 → 기존 동사 유지.

## READY self-review

- [x] Decision Ledger가 세 질문의 답과 설계 해석을 ACTIVE로 보존한다 — D-001~D-010.
- [x] Part I만으로 완료 상태가 설명된다 — §1·§5 흐름.
- [x] 조건절 원문 보존 — "'응답 준비 중…' 대신"(D-003)·"실제로 거치는 단계만"(D-006)·"오픈코드의 경우"(D-007).
- [x] 사용자 결정과 조사 사실 구분 — §4 하단.
- [x] 수치·전칭 실측 — §8 전수 조사 7행, 검산 3행.
- [x] 저장소 규칙·후보 표 확인 — INDEX 후보 표 1행(0262 종료 이관)은 이번 파일과 겹치는 항목 없음(`0262 plan.md:4017` 목록 확인).
- [x] 각 AC가 행동 단언·검증·도달 경로를 가진다 — §7 15행.
- [x] Baseline V, 모든 NEW node에 REQUIRED pair — VP-01~VP-19·VP-25.
- [x] 영향받은 INHERITED는 REGRESSION — VP-20~VP-24.
- [x] pair별 path·§10 분모·좌표 — §7-A·§10·§11.
- [x] 규칙 칸 분기 ↔ 입력 칸 — MD-01 규칙 12분기 ↔ UT-01 R1~R11(R7a~f·R8a 5종), MD-02 규칙 5분기 ↔ UT-02 L1~L7.
- [x] 선언 경계 6건, 열린 입력 집합 해당 없음.
- [x] 운영 gate 5행.
- [x] 사람 실기는 실제 서버·시각만.
- [x] semantic 목표를 배열·텍스트로 직접 단언(structural proxy 아님).
- [x] "X가 쓰인다" 불변식의 장치 방향 — M-06a·M-13a·M-18a는 제거 시 red, M-10a·M-05a는 맞바꿈 시 red.
- [x] 배타 상태는 discriminated union(`ChatWaitPhase`).
- [x] 참조 구현 없음.
- [x] 신규 모듈의 레이어·강제 지점·seam — §9 책임 표·§11.
- [x] producer/consumer end-to-end — §12.
- [x] worst-case — §14.
- [x] 본문 전체를 Ledger와 교차검증 — §3 갱신 메모 대조 결과.
- [x] 산출물 문장 규칙.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: D-001~D-010 Decision Ledger, V1 pair registry(VP-01~VP-25), §10 EP-01~EP-08(47자리 + 규칙 2칸) 및 §11 구현·테스트 설계 전체가 현재 코드베이스와 일치하여 그대로 진행했다.
- 이견 / 현실성 문제: `send.ts:69`에서 `adapter`가 `SessionAdapter | MockAdapter | null`로 추론되어 `activeAdapter.reportsWaitPhases` 접근 시 `MockAdapter`(`implements SessionAdapter`, 선택 필드 미선언)에서 TS2339가 나므로 `let adapter: SessionAdapter | null`로 넓혔다(`MockAdapter`는 `SessionAdapter`에 대입 가능).
- ACTIVE Decision과 충돌하는 설계 발견: 해당 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 · VP-02 · VP-03 · VP-08 · VP-09 · VP-10 · VP-14 · VP-23 | **EP-01** 채널 경계 호출 12자리 + MD-01 규칙 12분기 | c1~c12 (12자리) + MD-01 규칙 12분기 | 12/12 + 12/12 | `git grep -n -E "waitPhase\.(serverStarting\|connected\|creatingSession\|admitting\|sending\|accepted\|status\|observe\|end)\(" -- app/src/main/adapters/opencode/v1/channel.ts` → 12줄(c1 `:333`, c2 `:350`, c3 `:357`, c4 `:149`, c5 `:163`, c6 `:295`, c7 `:271`, c8 `:427`, c9 `:429`, c10 `:443`, c11 `:453`, c12 `:468`, 차집합 0) · UT-01(`wait-phase.test.ts` R1~R11 18케이스) · IT-01(`adapter.startup.test.ts` I1~I6) · ST-01(`opencode-runtime.test.ts:414`) | `ChatWaitPhase \| null` (`server`, `project`, `session`, `mcp`, `send`, `model`, `{retry,1}`, `{retry,2}`, `null`) → `phases` 배열·`projector.current('s1').waitPhase` | 0 |
| VP-09 · VP-10 · VP-16 | **EP-02** 운반 7자리 (`t1`~`t7`) | t1 `turn.ts` · t2 `channel.ts` · t3 `turn-request.ts` · t4 projector `setWaitPhase` · t5 `compute` · t6 `sameActivity` · t7 `shared/ipc.ts` (7자리) | 7/7 | `git grep -n -E "onWaitPhase\|setWaitPhase\|waitPhases\|waitPhase" -- app/src/main/adapters/common/turn.ts app/src/main/app/chat-turn/turn-request.ts app/src/main/features/chat/session-activity-projector.ts app/src/shared/ipc.ts` + `git grep -n -E "new OpenCodeWaitPhase" -- app/src/main/adapters/opencode/v1/channel.ts` → t1 `turn.ts:216`, t2 `channel.ts:31`, t3 `turn-request.ts:71,132-133`, t4 `session-activity-projector.ts:40,93-101,139-141,154,170`, t5 `:247-249`, t6 `:259-263,275`, t7 `ipc.ts:1705` (차집합 0) · UT-03(`session-activity-projector.test.ts` P1~P8) · ST-01 | `phase` (`{server}`, `{retry,1}`, `{retry,2}`, `{send}`, `{project}`, `{session}`, `null`) → `emit` 스냅샷·`current(key).waitPhase` | 0 |
| VP-01 · VP-11 · VP-17 | **EP-03** observer 7자리 (`s1`~`s7`) | s1 새 entry · s2 미정착 합류 · s3 `readySettled = true` · s4 `implementation.ts` · s5 `adapter.ts` `client()` · s6 `adapter.ts` `sendMessage` · s7 `channel.ts` `connect` (7자리) | 7/7 | `git grep -n -E "serverStarting\|readySettled" -- app/src/main/adapters/opencode/implementation.ts app/src/main/adapters/opencode/v1/server.ts app/src/main/adapters/opencode/v1/adapter.ts app/src/main/adapters/opencode/v1/channel.ts` → s1 `server.ts:233`, s2 `:248-249`, s3 `:86,226,238`, s4 `implementation.ts:18`, s5 `adapter.ts:122,162`, s6 `adapter.ts:340,346`, s7 `channel.ts:24,333` (차집합 0) · UT-04(`server.test.ts` S1~S5) · IT-02(`opencode-runtime.test.ts:384`) | `observer.serverStarting()` 호출 횟수(cold=1, 합류=1, warm=0, 실패 후 재시도=1) · `setWaitPhase` 첫 원소 `{kind:'server'}` | 0 |
| VP-01 · VP-04 · VP-06 · VP-08 · VP-12 | **EP-04** app 7자리 (`a1`~`a7`) | a1 `types.ts` · a2 `adapter.ts` · a3 `send.ts` 시작 `preparing` · a4 `send.ts` `onNativeHistory` 매핑 · a5 `resolve-turn.ts` `onNativeHistory(true)` · a6 finally `(false)` · a7 `send.ts` 바깥 finally `null` (7자리) | 7/7 | `git grep -n -E "reportsWaitPhases\|reportWaitPhase\|onNativeHistory\|setWaitPhase" -- app/src/main/adapters/common/types.ts app/src/main/contracts/ports.ts app/src/main/adapters/opencode/v1/adapter.ts app/src/main/app/chat-turn/send.ts app/src/main/app/chat-turn/resolve-turn.ts` → a1 `types.ts:103`, a2 `adapter.ts:33`, a3 `send.ts:254-260`, a4 `send.ts:269-273`, a5 `resolve-turn.ts:68,133`, a6 `resolve-turn.ts:155`, a7 `send.ts:740` (차집합 0) · IT-03(`send.wait-phase.test.ts` A1~A5) · `native-session.test.ts:523,548,579` | `preparing` · `history` · `null` (`invocationCallOrder`, `[true, false]`, Claude 비-null 0건) | 0 |
| VP-05 · VP-13 · VP-22 | **EP-05** renderer 10자리 (`r1`~`r10`) | r1 `ChatState` · r2 `initialChatState` · r3 `chat.activity` · r4 LOAD_SESSION preserve · r5 LOAD_SESSION snapshot · r6 `useChatActivity` · r7 `PendingAssistantStatus` · r8 `ActivityView` · r9 `deriveActivityLabel` · r10 `StatusLine` (10자리) | 10/10 | `git grep -n -E "activityWaitPhase\|waitPhase" -- app/src/renderer/src/features/chat ":(exclude)*.test.ts"` → r1 `chatReducer.ts:335`, r2 `:519`, r3 `:1251`, r4 `:1538`, r5 `:1552`, r6 `chatStore.ts:2271,2285`, r7 `PendingAssistantStatus.tsx:18,29`, r8 `activityLabel.ts:39,45`, r9 `:59,61,84`, r10 `StatusLine.tsx:12,113` (차집합 0) · IT-04(`statusLine.waitPhase.test.ts`) · `StatusLine.harness.test.ts` | `activityWaitPhase` → `activityView.waitPhase` → `label.waitPhase` → `[aria-live]` DOM 텍스트 | 0 |
| VP-05 · VP-07 · VP-15 · VP-20 · VP-21 | **EP-06** 표시 3자리 (`w1`~`w3`) + MD-02 규칙 5분기 | w1 우선순위 · w2 `waitPhaseLabel` · w3 `ko.ts`/`en.ts` 8키 (3자리) + MD-02 규칙 5분기 | 3/3 + 5/5 | `git grep -n -E "waitPhaseLabel\|harness\.waitPhase\|waitPhase: \{" -- app/src/renderer/src ":(exclude)*.test.ts"` → w1 `activityLabel.ts:59-84`, w2 `activityLabel.ts:89-106`, w3 `ko.ts:499-508` · `en.ts:495-504` (차집합 0) · UT-02(`activityLabel.test.ts` L1~L7·K1) · IT-04 · `resources.test.ts` | 9개 `kind` 각각의 i18n 키·한국어 문자열·`prepareStep` 우선순위 분기 | 0 |
| VP-18 · VP-24 | **EP-07** SSOT 3자리 (`e1`~`e3`) | e1 `shared/model-output.ts` · e2 `turn-coordinator.ts` · e3 `wait-phase.ts` (3자리) | 3/3 | `git grep -n -E "MODEL_OUTPUT_EVENT\|isModelOutputEvent" -- app/src/main app/src/shared ":(exclude)*.test.ts"` → e1 `shared/model-output.ts:1,9,11-12`, e2 `turn-coordinator.ts:14,395`, e3 `wait-phase.ts:3,55` (차집합 0) · `git grep -n -E "MODEL_OUTPUT_EVENTS" -- app/src` → 0줄 · UT-01 R8a · `turn-coordinator.test.ts` | 5종 이벤트(`message.delta`, `message.reasoning.delta`, `message.reasoning`, `message.completed`, `tool.call.started`) → `true` | 0 |
| VP-19 | **EP-08** 문서 3자리 (`d1`~`d3`) | d1 `docs/IPC_CONTRACT.md` · d2 `docs/arch/backend/provider-runtime.md` · d3 `docs/arch/frontend/ux-domains.md` (3자리) | 3/3 | `git grep -n -E "waitPhase" -- docs/IPC_CONTRACT.md docs/arch/backend/provider-runtime.md` → `IPC_CONTRACT.md:594`, `provider-runtime.md:93` · `git grep -n -E "모델 응답을 기다리는" -- docs/arch/frontend/ux-domains.md` → `ux-domains.md:42` · `check-doc-inventory.mjs --check` exit 0 | 문서 계약 설명 일치, 코드 수치 재서술 0건 | 0 |

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | `SELF_PASS` | `opencode-runtime.test.ts:384` (IT-02) · `adapter.startup.test.ts:537` (IT-01 I1/I2) · `send.wait-phase.test.ts:169` (IT-03 A1~A3) · `wait-phase.test.ts:138` (UT-01 R8a) | not selected |
| VP-02 | REQUIRED | `SELF_PASS` | `adapter.startup.test.ts:590` (IT-01 I3) · `opencode-runtime.test.ts:439` (ST-01 2턴) | not selected |
| VP-03 | REQUIRED | `SELF_PASS` | `wait-phase.test.ts:72` (UT-01 R7a~R7f) · `adapter.startup.test.ts:606` (IT-01 I4) | not selected |
| VP-04 | REQUIRED | `SELF_PASS` | `native-session.test.ts:523,548,579` · `send.wait-phase.test.ts:219` (IT-03 A4) | not selected |
| VP-05 | REQUIRED | `SELF_PASS` | `activityLabel.test.ts:251` (UT-02 L1~L7) · `session-activity-projector.test.ts:396` (UT-03 P5) · `statusLine.waitPhase.test.ts:67,98,124` (IT-04) | `M-05a` red (`activityLabel.test.ts` 1 failed, exit 1) |
| VP-06 | REQUIRED | `SELF_PASS` | `send.wait-phase.test.ts:250` (IT-03 A5 Claude) | `M-06a` red (`send.wait-phase.test.ts` 1 failed, exit 1) |
| VP-07 | REQUIRED | `SELF_PASS` | `activityLabel.test.ts:334` (UT-02 K1) · `statusLine.waitPhase.test.ts:40` (IT-04 9종 ko) · `resources.test.ts` (7 passed) | not selected |
| VP-08 | REQUIRED | `SELF_PASS` | `opencode-runtime.test.ts:414` (ST-01) · `adapter.startup.test.ts:669` (IT-01 I5/I6) · `send.wait-phase.test.ts:169` (IT-03 A2/A3) | `M-09a` 공유 red (`opencode-runtime.test.ts` 1 failed, exit 1) |
| VP-09 | REQUIRED | `SELF_PASS` | `opencode-runtime.test.ts:414` (ST-01 1~3턴 시퀀스) | `M-09a` red (`opencode-runtime.test.ts` 1 failed, exit 1) |
| VP-10 | REQUIRED | `SELF_PASS` | `adapter.startup.test.ts:535` (IT-01 describe 'wait phases') | `M-10a` red (`adapter.startup.test.ts` 3 failed, exit 1) |
| VP-11 | REQUIRED | `SELF_PASS` | `opencode-runtime.test.ts:384` (IT-02 1턴 `server` 포함·2턴 미포함) | not selected |
| VP-12 | REQUIRED | `SELF_PASS` | `send.wait-phase.test.ts:168` (IT-03 A1~A5) | `M-06a` 공유 red (`send.wait-phase.test.ts` 1 failed, exit 1) |
| VP-13 | REQUIRED | `SELF_PASS` | `statusLine.waitPhase.test.ts:39` (IT-04) | `M-13a` red (`statusLine.waitPhase.test.ts` 2 failed, exit 1) |
| VP-14 | REQUIRED | `SELF_PASS` | `wait-phase.test.ts:15` (UT-01 R1~R11 18케이스) | not selected |
| VP-15 | REQUIRED | `SELF_PASS` | `activityLabel.test.ts:251` (UT-02 L1~L7 + K1) | `M-05a` 공유 red (`activityLabel.test.ts` 1 failed, exit 1) |
| VP-16 | REQUIRED | `SELF_PASS` | `session-activity-projector.test.ts:352` (UT-03 P1~P8) | `M-16a` red (3 failed, exit 1) · `M-16b` red (1 failed, exit 1) |
| VP-17 | REQUIRED | `SELF_PASS` | `server.test.ts:819` (UT-04 S1~S5) | not selected |
| VP-18 | REQUIRED | `SELF_PASS` | `wait-phase.test.ts:138` (UT-01 R8a) · `turn-coordinator.test.ts` (77 passed) | `M-18a` red (`wait-phase.test.ts` 1 failed, exit 1) |
| VP-19 | REQUIRED | `SELF_PASS` | `IPC_CONTRACT.md:594` · `provider-runtime.md:93` · `ux-domains.md:42` · `check-doc-inventory.mjs --check` exit 0 | not selected |
| VP-20 | REGRESSION | `SELF_PASS` | `activityLabel.test.ts:183` ('격리 준비 단계 우선 (EP-03)' 3케이스 passed) | not selected |
| VP-21 | REGRESSION | `SELF_PASS` | `activityLabel.test.ts` (기존 describe 3개 포함 26 passed) | not selected |
| VP-22 | REGRESSION | `SELF_PASS` | `StatusLine.harness.test.ts` (2 passed) | not selected |
| VP-23 | REGRESSION | `SELF_PASS` | `adapter.startup.test.ts` (기존 7케이스 포함 10 passed) | not selected |
| VP-24 | REGRESSION | `SELF_PASS` | `turn-coordinator.test.ts` (77 passed) | not selected |
| VP-25 | REQUIRED | `SELF_BLOCKED` | §19 사람 실기 시나리오 4건 (Windows 실제 OpenCode 1.x 서버 기동·시각 확인 대기) | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `M-05a`: `activityLabel.ts`에서 `prepareStep` 판정의 `!isChannelWaitPhase` 가드를 제거해 순위 맞바꿈 | VP-05 · VP-15 선택 증거 | 최초 | `activityLabel.test.ts` L6 1케이스 실패 (`1 failed \| 25 passed`) | `red (기대 일치)` |
| `M-06a`: `send.ts` `reportWaitPhase`에서 `if (activeAdapter.reportsWaitPhases !== true) return` 게이트 제거 | VP-06 · VP-12 선택 증거 | 최초 | `send.wait-phase.test.ts` A5 1케이스 실패 (`1 failed \| 3 passed`) | `red (기대 일치)` |
| `M-09a`: `channel.ts`에서 `waitPhase.observe(mapped.events)`(c9)와 finally `waitPhase.end()`(c12) 동시 제거 | VP-08 · VP-09 선택 증거 | 최초 | `opencode-runtime.test.ts` ST-01 1케이스 실패 (`1 failed \| 7 passed`) | `red (기대 일치)` |
| `M-10a`: `channel.ts`에서 c2(`waitPhase.connected()`)와 c3(`waitPhase.creatingSession()`) 호출 위치 맞바꿈 | VP-10 선택 증거 | 최초 | `adapter.startup.test.ts` I1/I2/I4 3케이스 실패 (`3 failed \| 7 passed`) | `red (기대 일치)` |
| `M-13a`: `PendingAssistantStatus.tsx` `activityView`에서 `waitPhase` 전달 제거 | VP-13 선택 증거 | 최초 | `statusLine.waitPhase.test.ts` 2케이스 실패 (`2 failed \| 1 passed`) | `red (기대 일치)` |
| `M-16a`: `session-activity-projector.ts` `sameActivity`에서 `sameWaitPhase` 비교 제거 | VP-16 선택 증거 | 최초 | `session-activity-projector.test.ts` P4/P8 등 3케이스 실패 (`3 failed \| 14 passed`) | `red (기대 일치)` |
| `M-16b`: `session-activity-projector.ts` `setWaitPhase`에서 `if (sameWaitPhase(previous, phase)) return` 동치 조기 반환 제거 | VP-16 선택 증거 | 최초 | `session-activity-projector.test.ts` P2 1케이스 실패 (`1 failed \| 16 passed`) | `red (기대 일치)` |
| `M-18a`: `shared/model-output.ts` `MODEL_OUTPUT_EVENT_TYPES`에서 `'tool.call.started'` 제거 | VP-18 선택 증거 | 최초 | `wait-phase.test.ts` R8a 1케이스 실패 (`1 failed \| 17 passed`) | `red (기대 일치)` |
| 열거 sweep: `CHAT_WAIT_PHASE_KINDS` 9개 원소(`preparing`, `history`, `server`, `project`, `session`, `mcp`, `send`, `model`, `retry`) 전수 | §4 열거 sweep | 최초 | UT-02 K1(`activityLabel.test.ts:334`) · IT-04(`statusLine.waitPhase.test.ts:40`) 9종 전수 단언 통과, `M-13a` 변이 시 red | `9/9 잠금 확인` |
| 열거 sweep: `MODEL_OUTPUT_EVENT_TYPES` 5개 원소 전수 | §4 열거 sweep | 최초 | UT-01 R8a(`wait-phase.test.ts:138`) 5종 전수 단언 통과, `M-18a` 변이 시 red | `5/5 잠금 확인` |

검산: `선택 증거 8 · 인용 변이 0 · 새 oracle 0 · sweep 2 = 표 행 10`.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| OpenCode 스트리밍 중 즉시 보내기(steer)로 `pushTurn`이 호출될 때 잠시 `mcp → send → model` 문구가 보였다가 다음 모델 출력에서 해제되는 동작이 자연스러운가 | 설계 내 수용 (§10 선언 경계 3번째 항목에 이미 명시) | 추가 변경 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `send.ts`의 `adapter` 지역 변수가 `SessionAdapter \| MockAdapter \| null`로 추론되어 `activeAdapter.reportsWaitPhases` 접근 시 `MockAdapter`에서 TS2339 발생 | `send.ts:70`에서 `let adapter: SessionAdapter \| null`로 명시(`MockAdapter implements SessionAdapter`이므로 타입 안전하게 단일화) | `npm run typecheck` (`typecheck:node`·`typecheck:web`·`typecheck:test`) exit 0 |
| 2 | `send.harness.test.ts`처럼 `deps.activity`를 생략하거나 `reportsWaitPhases`가 없는 어댑터에서 `resolveTurn` 5-인자 일치를 단언하는 기존 테스트가 `r1` CI에서 실패 | `send.ts:256,740`·`turn-request.ts:133`에서 `activity?.setWaitPhase?.(...)`로 방어하고, `send.ts:269`에서 `activeAdapter.reportsWaitPhases === true`일 때만 `resolveTurn` 6번째 인자 `{ onNativeHistory }`를 전달 | `send.harness.test.ts` (14 passed) · `send.wait-phase.test.ts` (4 passed) · `M-06a` red |
| 3 | `adapter.test.ts:730`·`native-history.test.ts:546`이 `servers.acquire(config, env, cwd)` 3-인자 호출을 단언하는데 `observer`가 `undefined`일 때도 4번째 인자 `undefined`가 전달되어 `r1` CI에서 실패 | `channel.ts:333`에서 `req.onWaitPhase`가 있을 때만 observer 객체를 넘기고, `adapter.ts:162`에서 `...(observer ? [observer] : [])`로 `observer` 부재 시 3-인자 호출 유지 | `adapter.test.ts` (27 passed) · `native-history.test.ts` (35 passed) · 전체 561개 테스트 파일(5,257케이스) green |
| 4 | `activityLabel.ts:63` 주석의 `Orca 측 준비` 표현이 `product-identity.test.ts:92`(`/\bOrca\b/` renderer prod 전수 음성 스윕)에 걸려 `r1.2` CI에서 실패 | `activityLabel.ts:63` 주석을 `앱 측 준비`로 정정 | `product-identity.test.ts` (34 passed) · `activityLabel.test.ts` (26 passed) |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 작성 에이전트 | `argon` |
| 변경 파일 | 프로덕션 21파일: `app/src/shared/{ipc,model-output}.ts`, `app/src/main/adapters/common/{turn,types}.ts`, `app/src/main/adapters/opencode/implementation.ts`, `app/src/main/adapters/opencode/v1/{adapter,channel,server,wait-phase}.ts`, `app/src/main/features/chat/{session-activity-projector,turn-coordinator}.ts`, `app/src/main/app/chat-turn/{resolve-turn,send,turn-request}.ts`, `app/src/renderer/src/features/chat/{reducer/chatReducer.ts,store/chatStore.ts,components/transcript/PendingAssistantStatus.tsx,lib/activityLabel.ts,harnesses/common/transcript/StatusLine.tsx}`, `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts` · 테스트 9파일: `wait-phase.test.ts`, `server.test.ts`, `adapter.startup.test.ts`, `opencode-runtime.test.ts`, `send.wait-phase.test.ts`, `native-session.test.ts`, `session-activity-projector.test.ts`, `activityLabel.test.ts`, `statusLine.waitPhase.test.ts` · 문서 3파일: `docs/IPC_CONTRACT.md`, `docs/arch/backend/provider-runtime.md`, `docs/arch/frontend/ux-domains.md` (+ `plan.md`, `INDEX.md`) |
| 실행 명령 | 1) `cd app && ./node_modules/.bin/vitest run src/main/adapters src/main/app src/main/features/chat src/renderer/src/features/chat src/shared`<br>2) `$env:PYTHONUTF8 = "1"; python -X utf8 .agents/skills/handoff-verify/scripts/mutate.py <scratch>/mutations.jsonl --cwd app`<br>3) `cd app && npm run lint && npm run typecheck && node scripts/check-test-budgets.mjs && node scripts/check-doc-inventory.mjs --check` |
| 관측한 게이트 산출 | 1) vitest §19 대상 12파일(`227 passed`) + 인접 전체 561파일(`5,257 passed`, 0 failed)<br>2) `mutate.py` 8/8 `red (기대 일치)` + `# 원복 확인: 모든 파일 원문 그대로`<br>3) `lint` exit 0 (0 errors, 기존 warning 2), `typecheck` (`node`·`web`·`test`) exit 0, `check-test-budgets.mjs` exit 0 (`16 real-git suites ok · all budget sites scaled`), `check-doc-inventory.mjs --check` exit 0 (`9 items, 117 channels`) |
| V-pair 자기확인 | 총 25 pair 중 `SELF_PASS` 24건(`VP-01`~`VP-24`), `SELF_BLOCKED` 1건(`VP-25` Windows 실제 OpenCode 실기) |
| 강제 지점 전수 | EP-01(12/12) · EP-02(7/7) · EP-03(7/7) · EP-04(7/7) · EP-05(10/10) · EP-06(3/3) · EP-07(3/3) · EP-08(3/3) — 52/52 자리(§10 검색 명령 차집합 0) + MD-01(12/12)·MD-02(5/5) 규칙 분기 전수 |
| AC 자기보고 | - **AC1** ✅: `opencode-runtime.test.ts:384`(IT-02), `adapter.startup.test.ts:537`(IT-01 I1), `send.wait-phase.test.ts:169`(IT-03 A1), `wait-phase.test.ts:138`(UT-01 R8a) 통과<br>- **AC2** ✅: `server.test.ts:819`(UT-04 S1~S5), `opencode-runtime.test.ts:396`(IT-02 2턴 `server` 0회), `adapter.startup.test.ts:569`(IT-01 I2) 통과<br>- **AC3** ✅: `adapter.startup.test.ts:590`(IT-01 I3 `pushTurn` `[mcp, send, model, null]`), `opencode-runtime.test.ts:439`(ST-01 2턴) 통과<br>- **AC4** ✅: `wait-phase.test.ts:72`(UT-01 R7a~R7f), `adapter.startup.test.ts:606`(IT-01 I4) 통과<br>- **AC5** ✅: `native-session.test.ts:523,548,579`(3케이스), `send.wait-phase.test.ts:219`(IT-03 A4) 통과<br>- **AC6** ✅: `activityLabel.test.ts:251`(UT-02 L4~L6), `activityLabel.test.ts:183`(REGRESSION VP-20) 통과<br>- **AC7** ✅: `opencode-runtime.test.ts:414`(ST-01), `adapter.startup.test.ts:669`(IT-01 I5/I6), `send.wait-phase.test.ts:169`(IT-03 A2/A3) 통과<br>- **AC8** ✅: `activityLabel.test.ts:320`(UT-02 L7), `statusLine.waitPhase.test.ts:67`(IT-04 queuedCount=1) 통과<br>- **AC9** ✅: `send.wait-phase.test.ts:250`(IT-03 A5 Claude 비-null 0건), `StatusLine.harness.test.ts`(2 passed) 통과<br>- **AC10** ✅: `activityLabel.test.ts:334`(UT-02 K1), `statusLine.waitPhase.test.ts:40`(IT-04 9종 ko), `resources.test.ts`(7 passed) 통과<br>- **AC11** ✅: `wait-phase.test.ts:138`(UT-01 R8a), `turn-coordinator.test.ts`(77 passed), `git grep -n -E "MODEL_OUTPUT_EVENTS" -- app/src` 0건 확인<br>- **AC12** ✅: `session-activity-projector.test.ts:352`(UT-03 P1~P8) 통과<br>- **AC13** ✅: `statusLine.waitPhase.test.ts:98,124`(IT-04 revision 무시·LOAD_SESSION hydrate/preserve) 통과<br>- **AC14** ✅: `IPC_CONTRACT.md:594`, `provider-runtime.md:93`, `ux-domains.md:42` 반영 + `check-doc-inventory.mjs --check` exit 0<br>- **AC15** ⚠️: Windows 실제 OpenCode 1.x 실기 시각 확인 대기 |
| 합계 검산 | `✅ 14 · ⚠️ 1 · ❌ 0 = 총 15` |
| 블로커 / 역질문 | 없음 (AC15 사람 실기만 대기) |
| 대상 커밋 | `(r1·r1.2·r1.3 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 작성 에이전트: `argon`.
- 라운드 및 턴 라벨: `r1.3` (`r1`·`r1.2` 원격 CI `Test` 스텝 실패 보완).
- 이전 라운드 반복 축 여부: 해당 없음 (`r1` 내 CI 보완 턴).
- plan 지침·AC 누락 여부: 없음 (D-001~D-010 및 §10 EP-01~EP-08 52자리 전수가 코드와 1:1 대응).
- 환경 한계: `native-session.test.ts`는 파일 최상단 `beforeEach`에서 `better-sqlite3` 인메모리 DB를 생성하므로 `node scripts/ensure-sqlite-abi.mjs node`로 Node ABI 보장 후 실행하여 16/16 green을 확인했고, Windows에서 `mutate.py` 실행 시 `cp949` 기본 인코딩 오류를 피하기 위해 `PYTHONUTF8=1`(`python -X utf8`)을 지정했다. 모든 신규·수정 테스트는 실제 호스트/로컬 환경에 의존하지 않고 가상(in-memory/mock) 픽스처 입력과 기대 결과만 단언한다. AC15는 실제 OpenCode 1.x 프로세스·화면 시각 확인 항목이라 `SELF_BLOCKED`(`⚠️`)로 분리했다.

---

## [검증자 기입] 파생 이슈

| # | 출처 | 발견 분류 | 내용 | disposition |
|---|---|---|---|---|
| 1 | VP-08·09 · §10 c12·c11 | 이행 | 터미널 오류 `return` 경로에서 finally `end()` 단독 제거를 못 잡음 · c11 중복 | BLOCKING |
| 2 | VP-01·08 · §10 c10 | 이행 | 출력 없이 finish(중단)한 뒤 단계 비움 입력 없음 | BLOCKING |
| 3 | VP-01·10 · §10 c7 | 이행 | `session.command` 경로 `accepted()` 미잠금 | BLOCKING |
| 4 | VP-03 · §10 c8 | 이행 | 자식 세션 retry 입력 없음(root 판정) | BLOCKING |
| 5 | VP-06 · §10 a2 | 이행 | 실제 `OpenCodeAdapter.reportsWaitPhases` 관측 좌표 없음 | BLOCKING |
| 6 | VP-09·12 · §10 a3·a7 | 이행 | 재개 세션 키(`dbSessionId`·`payload.sessionId`) 분기 입력 없음 | BLOCKING |
| 7 | VP-05·13 · §10 r7 | 이행 | memo deps — 재렌더로 단계만 바뀌는 케이스 없음 | BLOCKING |
| 8 | VP-14 · MD-01 규칙 | 이행 | `accepted`는 현재가 `send`일 때만 — 비-send 입력 없음 | BLOCKING |
| 9 | VP-16 · promote | 확장 | `promote`가 승격 전 단계를 새 키로 옮기는지 | PLAN_GAP |
| 10 | VP-16 · clear | 확장 | `clear` 후 Map 잔여(관측 동일) | PLAN_GAP |
| 11 | VP-14 · status | 확장 | 비정상 `retry.attempt` 폴백 | PLAN_GAP |

- ΔV1 처리(2026-11-06): #1~#8은 BLOCKING 그대로 — ΔV1이 자리별 입력(I7~I10 · A4 키·A6 · IT-02 플래그 · `hooks-deps` · R6c·R6d)을 oracle 칸에 적었고 구현자가 r2에서 닫는다. #1의 c11은 D-012로 삭제한다. #9~#11은 D-011로 채택했다(P9~P11 · R7g·R7h) — PLAN_GAP 해소.
- r2 구현 결과(2026-11-06): #1~#11 전건 `closed` (D-012로 c11 삭제, N1~N13 14종 변이 전부 `red (기대 일치)`, V1 M-* 8종 유지 `red`).

---

## [구현자 기입] 설계 리뷰 (r2)

- 동의 / 그대로 진행: ΔV1(D-011~D-013, AC1′·AC4′·AC5′·AC7′, EP-01′ 11자리 · EP-02′ 10자리 · MD-01′ 규칙, 등록 변이 N1~N13, 운영 gate `hooks-deps`) 전체가 현재 코드베이스와 일치하여 그대로 진행했다.
- 이견 / 현실성 문제: 해당 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 해당 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조 · r2)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 · VP-02 · VP-03 · VP-08 · VP-09 · VP-10 · VP-14 · VP-23 | **EP-01′** 채널 경계 호출 11자리 (`c1`~`c10`, `c12`) + **MD-01′** 규칙 16분기 | c1 `channel.ts:333` · c2 `:350` · c3 `:357` · c4 `:149` · c5 `:163` · c6 `:295` · c7 `:271` · c8 `:426-427` · c9 `:429` · c10 `:443` · c12 `:467` (11자리) + MD-01′ 규칙 16분기 | 11/11 + 16/16 | `git grep -n -E "waitPhase\.(serverStarting\|connected\|creatingSession\|admitting\|sending\|accepted\|status\|observe\|end)\(" -- app/src/main/adapters/opencode/v1/channel.ts` → 11줄(c1 `:333`, c2 `:350`, c3 `:357`, c4 `:149`, c5 `:163`, c6 `:295`, c7 `:271`, c8 `:427`, c9 `:429`, c10 `:443`, c12 `:467`, 차집합 0) · UT-01(`wait-phase.test.ts` R1~R11 + R6c·R6d·R7g·R7h 22케이스) · IT-01(`adapter.startup.test.ts` I1~I10) · ST-01(`opencode-runtime.test.ts:415`) | `ChatWaitPhase \| null` (`server`, `project`, `session`, `mcp`, `send`, `model`, `{retry,1}`, `{retry,2}`, `null`) · 자식 retry(`child-1`) 무시 · 명령 POST 1회 | 0 |
| VP-09 · VP-10 · VP-16 | **EP-02′** 운반·저장 10자리 (`t1`~`t10`) | t1 `turn.ts` · t2 `channel.ts` · t3 `turn-request.ts` · t4 projector `setWaitPhase` · t5 `compute` · t6 `sameActivity` · t7 `shared/ipc.ts` · t8 `promote` · t9 `clear` · t10 `dispose` (10자리) | 10/10 | `git grep -n -E "onWaitPhase\|setWaitPhase\|waitPhases\|waitPhase" -- app/src/main/adapters/common/turn.ts app/src/main/app/chat-turn/turn-request.ts app/src/main/features/chat/session-activity-projector.ts app/src/shared/ipc.ts` + `git grep -n -E "new OpenCodeWaitPhase" -- app/src/main/adapters/opencode/v1/channel.ts` → t1 `turn.ts:216`, t2 `channel.ts:31`, t3 `turn-request.ts:71,132-133`, t4 `session-activity-projector.ts:40,93-101`, t5 `:247-249`, t6 `:259-263,275`, t7 `ipc.ts:1705`, t8 `projector.ts:139-141`, t9 `:154`, t10 `:170` (차집합 0) · UT-03(`session-activity-projector.test.ts` P1~P11) · ST-01 | `phase` (`{server}`, `{retry,1}`, `{retry,2}`, `{send}`, `{project}`, `{session}`, `{model}`, `null`) → `emit` 스냅샷·`current(key).waitPhase` (`promote` 이전, `clear`·`dispose` 삭제) | 0 |
| VP-01 · VP-11 · VP-17 | **EP-03** observer 7자리 (`s1`~`s7`) | s1 새 entry · s2 미정착 합류 · s3 `readySettled = true` · s4 `implementation.ts` · s5 `adapter.ts` `client()` · s6 `adapter.ts` `sendMessage` · s7 `channel.ts` `connect` (7자리) | 7/7 | `git grep -n -E "serverStarting\|readySettled" -- app/src/main/adapters/opencode/implementation.ts app/src/main/adapters/opencode/v1/server.ts app/src/main/adapters/opencode/v1/adapter.ts app/src/main/adapters/opencode/v1/channel.ts` → s1 `server.ts:233`, s2 `:248-249`, s3 `:86,226,238`, s4 `implementation.ts:18`, s5 `adapter.ts:122,162`, s6 `adapter.ts:340,346`, s7 `channel.ts:24,333` (차집합 0) · UT-04(`server.test.ts:819` S1~S5) · IT-02(`opencode-runtime.test.ts:389`) | `observer.serverStarting()` 호출 횟수(cold=1, 합류=1, warm=0, 실패 후 재시도=1) · `setWaitPhase` 첫 원소 `{kind:'server'}` | 0 |
| VP-01 · VP-04 · VP-06 · VP-08 · VP-12 | **EP-04** app 7자리 (`a1`~`a7`) | a1 `types.ts` · a2 `adapter.ts` · a3 `send.ts` 시작 `preparing` · a4 `send.ts` `onNativeHistory` 매핑 · a5 `resolve-turn.ts` `onNativeHistory(true)` · a6 finally `(false)` · a7 `send.ts` 바깥 finally `null` (7자리) | 7/7 | `git grep -n -E "reportsWaitPhases\|reportWaitPhase\|onNativeHistory\|setWaitPhase" -- app/src/main/adapters/common/types.ts app/src/main/contracts/ports.ts app/src/main/adapters/opencode/v1/adapter.ts app/src/main/app/chat-turn/send.ts app/src/main/app/chat-turn/resolve-turn.ts` → a1 `types.ts:103`, a2 `adapter.ts:33`, a3 `send.ts:254-260`, a4 `send.ts:269-273`, a5 `resolve-turn.ts:68,133`, a6 `resolve-turn.ts:155`, a7 `send.ts:740` (차집합 0) · IT-02(`opencode-runtime.test.ts:391` `adapter.reportsWaitPhases === true`) · IT-03(`send.wait-phase.test.ts` A1~A6) · `native-session.test.ts:523,548,579` | 키 분기(`'new:1'`, `'session-1'`, `'s-new'`) · 단계(`preparing`, `history`, `null`) · 실제 `OpenCodeAdapter.reportsWaitPhases === true` · Claude 비-null 0건 | 0 |
| VP-05 · VP-13 · VP-22 | **EP-05** renderer 10자리 (`r1`~`r10`) | r1 `ChatState` · r2 `initialChatState` · r3 `chat.activity` · r4 LOAD_SESSION preserve · r5 LOAD_SESSION snapshot · r6 `useChatActivity` · r7 `PendingAssistantStatus`(+memo deps) · r8 `ActivityView` · r9 `deriveActivityLabel` · r10 `StatusLine` (10자리) | 10/10 | `git grep -n -E "activityWaitPhase\|waitPhase" -- app/src/renderer/src/features/chat ":(exclude)*.test.ts"` → r1 `chatReducer.ts:335`, r2 `:519`, r3 `:1251`, r4 `:1538`, r5 `:1552`, r6 `chatStore.ts:2271,2285`, r7 `PendingAssistantStatus.tsx:18,29`, r8 `activityLabel.ts:39,45`, r9 `:59,61,84`, r10 `StatusLine.tsx:12,113` (차집합 0) · IT-04(`statusLine.waitPhase.test.ts`) · `StatusLine.harness.test.ts` · `gate:hooks-deps` (`eslint --no-fix --max-warnings 0 PendingAssistantStatus.tsx` exit 0) | `activityWaitPhase` → `activityView.waitPhase`(deps 잠금) → `label.waitPhase` → `[aria-live]` DOM 텍스트 | 0 |
| VP-05 · VP-07 · VP-15 · VP-20 · VP-21 | **EP-06** 표시 3자리 (`w1`~`w3`) + MD-02 규칙 5분기 | w1 우선순위 · w2 `waitPhaseLabel` · w3 `ko.ts`/`en.ts` 8키 (3자리) + MD-02 규칙 5분기 | 3/3 + 5/5 | `git grep -n -E "waitPhaseLabel\|harness\.waitPhase\|waitPhase: \{" -- app/src/renderer/src ":(exclude)*.test.ts"` → w1 `activityLabel.ts:59-84`, w2 `activityLabel.ts:89-106`, w3 `ko.ts:499-508` · `en.ts:495-504` (차집합 0) · UT-02(`activityLabel.test.ts:251` L1~L7·K1) · IT-04 · `resources.test.ts` | 9개 `kind` 각각의 i18n 키·한국어 문자열·`prepareStep` 우선순위 분기 | 0 |
| VP-18 · VP-24 | **EP-07** SSOT 3자리 (`e1`~`e3`) | e1 `shared/model-output.ts` · e2 `turn-coordinator.ts` · e3 `wait-phase.ts` (3자리) | 3/3 | `git grep -n -E "MODEL_OUTPUT_EVENT\|isModelOutputEvent" -- app/src/main app/src/shared ":(exclude)*.test.ts"` → e1 `shared/model-output.ts:1,9,11-12`, e2 `turn-coordinator.ts:14,395`, e3 `wait-phase.ts:3,55` (차집합 0) · `git grep -n -E "MODEL_OUTPUT_EVENTS" -- app/src` → 0줄 · UT-01 R8a · `turn-coordinator.test.ts` | 5종 이벤트(`message.delta`, `message.reasoning.delta`, `message.reasoning`, `message.completed`, `tool.call.started`) → `true` | 0 |
| VP-19 | **EP-08** 문서 3자리 (`d1`~`d3`) | d1 `docs/IPC_CONTRACT.md` · d2 `docs/arch/backend/provider-runtime.md` · d3 `docs/arch/frontend/ux-domains.md` (3자리) | 3/3 | `git grep -n -E "waitPhase" -- docs/IPC_CONTRACT.md docs/arch/backend/provider-runtime.md` → `IPC_CONTRACT.md:594`, `provider-runtime.md:93` · `git grep -n -E "모델 응답을 기다리는" -- docs/arch/frontend/ux-domains.md` → `ux-domains.md:42` · `check-doc-inventory.mjs --check` exit 0 | 문서 계약 설명 일치, 코드 수치 재서술 0건 | 0 |

**V-pair 자기확인 (r2)**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | `SELF_PASS` | `opencode-runtime.test.ts:389` (IT-02 배열 + `adapter.reportsWaitPhases`) · `adapter.startup.test.ts:544,791` (IT-01 I1/I2/I9) · `send.wait-phase.test.ts:175,207` (IT-03 A1~A4) · `wait-phase.test.ts:169` (UT-01 R8a) | `N3` red · `N5` red · `N6` red |
| VP-02 | REQUIRED | `SELF_PASS` | `adapter.startup.test.ts:591` (IT-01 I3) · `opencode-runtime.test.ts:445` (ST-01 2턴) | not selected (r1 PASS 승계) |
| VP-03 | REQUIRED | `SELF_PASS` | `wait-phase.test.ts:89` (UT-01 R7a~R7h) · `adapter.startup.test.ts:602,826` (IT-01 I4 root / I10 child) | `N4` red · `N10a` red · `N10b` red |
| VP-04 | REQUIRED | `SELF_PASS` | `native-session.test.ts:523,548,579` · `send.wait-phase.test.ts:207,280` (IT-03 A4 키 `'session-1'` · A6 `'s-new'`) | `N6` red · `N7` red |
| VP-05 | REQUIRED | `SELF_PASS` | `activityLabel.test.ts:251` (UT-02 L1~L7) · `session-activity-projector.test.ts:288` (UT-03 P5) · `statusLine.waitPhase.test.ts:67,98,124` (IT-04) · `gate:hooks-deps` | `M-05a` red · `N8` red (`hooks-deps` exit 1) |
| VP-06 | REQUIRED | `SELF_PASS` | `send.wait-phase.test.ts:248` (IT-03 A5 Claude) | `M-06a` red (r1 PASS 승계) |
| VP-07 | REQUIRED | `SELF_PASS` | `activityLabel.test.ts:334` (UT-02 K1) · `statusLine.waitPhase.test.ts:40` (IT-04 9종 ko) · `resources.test.ts` (7 passed) | not selected (r1 PASS 승계) |
| VP-08 | REQUIRED | `SELF_PASS` | `opencode-runtime.test.ts:415` (ST-01) · `adapter.startup.test.ts:665,716,749` (IT-01 I5~I8) · `send.wait-phase.test.ts:175,280` (IT-03 A2/A3/A6) · `session-activity-projector.test.ts:352,363` (UT-03 P10/P11) | `M-09a` red · `N1` red · `N2` red · `N7` red |
| VP-09 | REQUIRED | `SELF_PASS` | `opencode-runtime.test.ts:415` (ST-01 1~3턴 시퀀스) · `adapter.startup.test.ts:716,749` (IT-01 I7/I8) · `send.wait-phase.test.ts:280` (IT-03 A6) | `M-09a` red · `N1` red · `N2` red · `N7` red |
| VP-10 | REQUIRED | `SELF_PASS` | `adapter.startup.test.ts:431` (IT-01 I1~I10) | `M-10a` red · `N1`~`N4` red |
| VP-11 | REQUIRED | `SELF_PASS` | `opencode-runtime.test.ts:389` (IT-02 1턴 `server` 포함·2턴 미포함) | not selected (r1 PASS 승계) |
| VP-12 | REQUIRED | `SELF_PASS` | `opencode-runtime.test.ts:391` (IT-02 `reportsWaitPhases`) · `send.wait-phase.test.ts:175` (IT-03 A1~A6) | `M-06a` red · `N5`~`N7` red |
| VP-13 | REQUIRED | `SELF_PASS` | `statusLine.waitPhase.test.ts:39` (IT-04) · `gate:hooks-deps` | `M-13a` red · `N8` red (`hooks-deps` exit 1) |
| VP-14 | REQUIRED | `SELF_PASS` | `wait-phase.test.ts:17` (UT-01 R1~R11 + R6c·R6d·R7g·R7h 22케이스) | `N9` red · `N10a` red · `N10b` red |
| VP-15 | REQUIRED | `SELF_PASS` | `activityLabel.test.ts:251` (UT-02 L1~L7 + K1) | `M-05a` red (r1 PASS 승계) |
| VP-16 | REQUIRED | `SELF_PASS` | `session-activity-projector.test.ts:239` (UT-03 P1~P11) | `M-16a` red · `M-16b` red · `N11`~`N13` red |
| VP-17 | REQUIRED | `SELF_PASS` | `server.test.ts:819` (UT-04 S1~S5) | not selected (r1 PASS 승계) |
| VP-18 | REQUIRED | `SELF_PASS` | `wait-phase.test.ts:169` (UT-01 R8a) · `turn-coordinator.test.ts` (77 passed) | `M-18a` red (r1 PASS 승계) |
| VP-19 | REQUIRED | `SELF_PASS` | `IPC_CONTRACT.md:594` · `provider-runtime.md:93` · `ux-domains.md:42` · `check-doc-inventory.mjs --check` exit 0 | not selected (r1 PASS 승계) |
| VP-20 | REGRESSION | `SELF_PASS` | `activityLabel.test.ts:183` ('격리 준비 단계 우선 (EP-03)' 3케이스 passed) | not selected |
| VP-21 | REGRESSION | `SELF_PASS` | `activityLabel.test.ts` (기존 describe 3개 포함 26 passed) | not selected |
| VP-22 | REGRESSION | `SELF_PASS` | `StatusLine.harness.test.ts` (2 passed) | not selected |
| VP-23 | REGRESSION | `SELF_PASS` | `adapter.startup.test.ts` (기존 7케이스 포함 14 passed) | not selected |
| VP-24 | REGRESSION | `SELF_PASS` | `turn-coordinator.test.ts` (77 passed) | not selected |
| VP-25 | REQUIRED | `SELF_BLOCKED` | §19 사람 실기 시나리오 4건 (Windows 실제 OpenCode 1.x 서버 기동·시각 확인 대기) | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `N1`: `channel.ts:467` finally 첫 문장 `waitPhase.end()` 제거 | ΔV1 등록 변이 · 파생 #1 | `못 잡음` (M-09a2) | `adapter.startup.test.ts` I5/I7 2케이스 실패 (`2 failed \| 12 passed`) | `red (기대 일치)` |
| `N2`: `channel.ts:443` finish 분기 `waitPhase.end()` 제거 | ΔV1 등록 변이 · 파생 #2 | `못 잡음` (c10) | `adapter.startup.test.ts` I8 1케이스 실패 (`1 failed \| 13 passed`) | `red (기대 일치)` |
| `N3`: `channel.ts:271` command 경로 `waitPhase.accepted()` 제거 | ΔV1 등록 변이 · 파생 #3 | `못 잡음` (c7) | `adapter.startup.test.ts` I9 1케이스 실패 (`1 failed \| 13 passed`) | `red (기대 일치)` |
| `N4`: `channel.ts:426` `&& event.properties.sessionID === sessionId` 제거 | ΔV1 등록 변이 · 파생 #4 | `못 잡음` (X3) | `adapter.startup.test.ts` I10 1케이스 실패 (`1 failed \| 13 passed`) | `red (기대 일치)` |
| `N5`: `adapter.ts:33` `readonly reportsWaitPhases = true as const` 제거 | ΔV1 등록 변이 · 파생 #5 | `못 잡음` (a2) | `opencode-runtime.test.ts` IT-02 1케이스 실패 (`1 failed \| 7 passed`) | `red (기대 일치)` |
| `N6`: `send.ts:256` `reportWaitPhase` 키 식 → `provisionalKey` | ΔV1 등록 변이 · 파생 #6 | `못 잡음` (a3key) | `send.wait-phase.test.ts` A4 1케이스 실패 (`1 failed \| 4 passed`) | `red (기대 일치)` |
| `N7`: `send.ts:740` 바깥 finally 키 식 → `provisionalKey` | ΔV1 등록 변이 · 파생 #6 | `못 잡음` (a7key) | `send.wait-phase.test.ts` A4/A6 2케이스 실패 (`2 failed \| 3 passed`) | `red (기대 일치)` |
| `N8`: `PendingAssistantStatus.tsx:29` deps에서 `activity.activityWaitPhase,` 제거 | ΔV1 등록 변이 · 파생 #7 | `못 잡음` (r7deps) | `gate:hooks-deps` (`eslint --no-fix --max-warnings 0 PendingAssistantStatus.tsx`) `ESLint found too many warnings (maximum: 0)` | `red (기대 일치)` |
| `N9`: `wait-phase.ts:39` `accepted`에서 `this.current?.kind !== 'send' \|\|` 제거 | ΔV1 등록 변이 · 파생 #8 | `못 잡음` (X4) | `wait-phase.test.ts` R6c/R6d 2케이스 실패 (`2 failed \| 20 passed`) | `red (기대 일치)` |
| `N10a`: `wait-phase.ts:45` `status` attempt 폴백 `: 1` → `: 0` | ΔV1 등록 변이 · 파생 #11 | `못 잡음` (X2) | `wait-phase.test.ts` R7g/R7h 2케이스 실패 (`2 failed \| 20 passed`) | `red (기대 일치)` |
| `N10b`: `wait-phase.ts:45` `status`에서 `Number.isInteger(status.attempt) &&` 제거 | ΔV1 등록 변이 · 파생 #11 | 신규 | `wait-phase.test.ts` R7h 1케이스 실패 (`1 failed \| 21 passed`) | `red (기대 일치)` |
| `N11`: `session-activity-projector.ts:140` `promote`에서 `if (waitPhase) this.waitPhases.set(target, waitPhase)` 제거 | ΔV1 등록 변이 · 파생 #9 | `못 잡음` (promote) | `session-activity-projector.test.ts` P9 1케이스 실패 (`1 failed \| 19 passed`) | `red (기대 일치)` |
| `N12`: `session-activity-projector.ts:154` `clear`에서 `this.waitPhases.delete(sessionId)` 제거 | ΔV1 등록 변이 · 파생 #10 | `못 잡음` (clear) | `session-activity-projector.test.ts` P10 1케이스 실패 (`1 failed \| 19 passed`) | `red (기대 일치)` |
| `N13`: `session-activity-projector.ts:170` `dispose`에서 `this.waitPhases.clear()` 제거 | ΔV1 등록 변이 · 파생 #10 | 신규 | `session-activity-projector.test.ts` P11 1케이스 실패 (`1 failed \| 19 passed`) | `red (기대 일치)` |
| `M-05a`: `activityLabel.ts:65`에서 `!isChannelWaitPhase` 가드 제거 | V1 선택 증거 (VP-05·15) | `red` | `activityLabel.test.ts` L6 1케이스 실패 (`1 failed \| 25 passed`) | `red (기대 일치)` |
| `M-06a`: `send.ts:255`에서 `if (activeAdapter.reportsWaitPhases !== true) return` 제거 | V1 선택 증거 (VP-06·12) | `red` | `send.wait-phase.test.ts` A5 1케이스 실패 (`1 failed \| 4 passed`) | `red (기대 일치)` |
| `M-09a`: `channel.ts:429`에서 `waitPhase.observe(mapped.events)` 제거 | V1 선택 증거 (VP-08·09) | `red` | `adapter.startup.test.ts`·`opencode-runtime.test.ts` 1케이스 실패 (`1 failed \| 21 passed`) | `red (기대 일치)` |
| `M-10a`: `channel.ts:350,357`에서 `connected()`와 `creatingSession()` 맞바꿈 | V1 선택 증거 (VP-10) | `red` | `adapter.startup.test.ts` I1/I2/I4/I9/I10 5케이스 실패 (`5 failed \| 9 passed`) | `red (기대 일치)` |
| `M-13a`: `PendingAssistantStatus.tsx:18` `activityView`에서 `waitPhase` 전달 제거 | V1 선택 증거 (VP-13) | `red` | `statusLine.waitPhase.test.ts` 2케이스 실패 (`2 failed \| 1 passed`) | `red (기대 일치)` |
| `M-16a`: `session-activity-projector.ts:275` `sameActivity`에서 `sameWaitPhase` 비교 제거 | V1 선택 증거 (VP-16) | `red` | `session-activity-projector.test.ts` P4/P8 등 3케이스 실패 (`3 failed \| 17 passed`) | `red (기대 일치)` |
| `M-16b`: `session-activity-projector.ts:97` `setWaitPhase`에서 동치 조기 반환 제거 | V1 선택 증거 (VP-16) | `red` | `session-activity-projector.test.ts` P2 1케이스 실패 (`1 failed \| 19 passed`) | `red (기대 일치)` |
| `M-18a`: `shared/model-output.ts:6`에서 `'tool.call.started'` 제거 | V1 선택 증거 (VP-18) | `red` | `wait-phase.test.ts` R8a 1케이스 실패 (`1 failed \| 21 passed`) | `red (기대 일치)` |
| 열거 sweep: ΔV1 변경·신규 자리(EP-01′ `c7`·`c8`·`c10`·`c12`, EP-02′ `t8`~`t10`, EP-04 `a2`·`a3`·`a7`, EP-05 `r7`, MD-01′ `accepted`·`status`) 전수 | §3 열거 원문 sweep | `못 잡음` 13 | 위 `N1`~`N13` 14종 변이 및 UT-01 R6c/R6d/R7g/R7h · IT-01 I7~I10 · IT-02 · IT-03 A4/A6 · UT-03 P9~P11 전수 통과 | `14/14 잠금 확인` |

검산: `선택 증거 8 · 인용 변이 14 · 새 oracle 0 · sweep 1 = 표 행 23`.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| D-012로 `channel.ts` catch의 `waitPhase.end()`(c11)를 삭제해도 오류 발생 시 화면에 대기 단계가 남지 않는가 | 설계 내 수용 (catch에 `await`가 없고 곧바로 동기 실행되는 finally `waitPhase.end()`(c12)가 단계를 비우며 projector는 microtask로 합쳐 방출하므로 관측 동일 — I5/I7에서 확인) | 추가 변경 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `send.wait-phase.test.ts`에서 `mocks.runTurnWithContinuations = vi.fn(async () => undefined)`로 선언하면 0-인자 시그니처로 추론되어 A6의 `mockImplementationOnce(async (_deps, turn) => ...)`에서 `typecheck:test` TS2345 발생 | `vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined)`로 시그니처를 명시하고 A6 콜백에서 `(turn as { dbSessionId: string \| null }).dbSessionId = 's-new'`로 정정 | `npm run typecheck` (`typecheck:node`·`typecheck:web`·`typecheck:test`) exit 0 · `send.wait-phase.test.ts` 5/5 passed |

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 작성 에이전트 | `codex` |
| 변경 파일 | 프로덕션 1파일: `app/src/main/adapters/opencode/v1/channel.ts` (catch 내 `waitPhase.end()` 1줄 삭제) · 테스트 5파일: `app/src/main/adapters/opencode/v1/wait-phase.test.ts` (R6c·R6d·R7g·R7h), `app/src/main/adapters/opencode/v1/adapter.startup.test.ts` (I7~I10), `app/src/main/app/chat-turn/opencode-runtime.test.ts` (IT-02 `adapter.reportsWaitPhases`), `app/src/main/app/chat-turn/send.wait-phase.test.ts` (A4 키 단언 · A6), `app/src/main/features/chat/session-activity-projector.test.ts` (P9~P11) (+ `plan.md`, `INDEX.md`) |
| 실행 명령 | 1) `cd app && npm run lint && npm run typecheck`<br>2) `cd app && node ./node_modules/eslint/bin/eslint.js --no-fix --max-warnings 0 src/renderer/src/features/chat/components/transcript/PendingAssistantStatus.tsx`<br>3) `cd app && node scripts/check-test-budgets.mjs && node scripts/check-doc-inventory.mjs --check`<br>4) `cd app && node ./node_modules/vitest/vitest.mjs run src/main/adapters/opencode/v1/wait-phase.test.ts src/main/adapters/opencode/v1/server.test.ts src/main/adapters/opencode/v1/adapter.startup.test.ts src/main/app/chat-turn/opencode-runtime.test.ts src/main/app/chat-turn/send.wait-phase.test.ts src/main/app/chat-turn/native-session.test.ts src/main/features/chat/session-activity-projector.test.ts src/main/features/chat/turn-coordinator.test.ts src/renderer/src/features/chat/lib/activityLabel.test.ts src/renderer/src/features/chat/components/statusLine.waitPhase.test.ts src/renderer/src/features/chat/components/StatusLine.harness.test.ts src/renderer/src/shared/i18n/resources/resources.test.ts`<br>5) `$env:PYTHONUTF8 = "1"; python -X utf8 .agents/skills/handoff-verify/scripts/mutate.py <scratch>/mutations-dv1.jsonl --cwd app` |
| 관측한 게이트 산출 | 1) `lint` exit 0 (0 errors, 기존 warning 2), `typecheck` (`node`·`web`·`test`) exit 0<br>2) `hooks-deps` (`eslint --no-fix --max-warnings 0 PendingAssistantStatus.tsx`) exit 0 (0 warnings), `N8` 변이 시 exit 1 (`ESLint found too many warnings (maximum: 0)`)<br>3) `check-test-budgets.mjs` exit 0 (`16 real-git suites ok · all budget sites scaled`), `check-doc-inventory.mjs --check` exit 0 (`9 items, 117 channels`)<br>4) vitest §19 대상 12파일(`239 passed`, 0 failed)<br>5) `mutate.py` 22/22 (`N1`~`N13` 14건 + `M-*` 8건) 전부 `red (기대 일치)` + `# 원복 확인: 모든 파일 원문 그대로` |
| V-pair 자기확인 | 총 25 pair 중 `SELF_PASS` 24건(`VP-01`~`VP-24`), `SELF_BLOCKED` 1건(`VP-25` Windows 실제 OpenCode 실기) |
| 강제 지점 전수 | EP-01′(11/11) · EP-02′(10/10) · EP-03(7/7) · EP-04(7/7) · EP-05(10/10) · EP-06(3/3) · EP-07(3/3) · EP-08(3/3) — 54/54 자리(§10 검색 명령 차집합 0) + MD-01′(16/16)·MD-02(5/5) 규칙 분기 전수 |
| AC 자기보고 | - **AC1′** ✅: `opencode-runtime.test.ts:389`(IT-02 배열 + `adapter.reportsWaitPhases === true`), `adapter.startup.test.ts:544,791`(IT-01 I1 · I9 슬래시 명령 `/session/s1/command` POST 1회·`/prompt_async` 0회), `send.wait-phase.test.ts:175`(IT-03 A1), `session-activity-projector.test.ts:342`(UT-03 P9 `promote` 이전), `wait-phase.test.ts:169`(UT-01 R8a) 통과<br>- **AC2** ✅: `server.test.ts:819`(UT-04 S1~S5), `opencode-runtime.test.ts:407`(IT-02 2턴 `server` 0회), `adapter.startup.test.ts:571`(IT-01 I2) 통과<br>- **AC3** ✅: `adapter.startup.test.ts:591`(IT-01 I3 `pushTurn` `[mcp, send, model, null]`), `opencode-runtime.test.ts:445`(ST-01 2턴) 통과<br>- **AC4′** ✅: `wait-phase.test.ts:89`(UT-01 R7a~R7h — attempt 0·2.5 → 1 정규화 포함), `adapter.startup.test.ts:602,826`(IT-01 I4 root retry 1 · I10 자식 `child-1` retry 0) 통과<br>- **AC5′** ✅: `native-session.test.ts:523,548,579`(3케이스), `send.wait-phase.test.ts:207`(IT-03 A4 모든 `setWaitPhase` 첫 인자 = `'session-1'`) 통과<br>- **AC6** ✅: `wait-phase.test.ts:169`(UT-01 R8a 5종), `adapter.startup.test.ts:544`(IT-01 I1) 통과<br>- **AC7′** ✅: `opencode-runtime.test.ts:415`(ST-01), `adapter.startup.test.ts:665,716,749`(IT-01 I5~I8 — I7 터미널 오류 `return`, I8 출력 전 중단 finish), `send.wait-phase.test.ts:175,280`(IT-03 A2/A3 · A6 확정 `s-new` 키로 `null`), `session-activity-projector.test.ts:352,363`(UT-03 P10 `clear` · P11 `dispose`) 통과<br>- **AC8** ✅: `activityLabel.test.ts:334`(UT-02 K1 9종), `statusLine.waitPhase.test.ts:40`(IT-04 9종 ko 원문), `resources.test.ts`(7 passed) 통과<br>- **AC9** ✅: `activityLabel.test.ts:251`(UT-02 L4~L6), `activityLabel.test.ts:183`(REGRESSION VP-20) 통과<br>- **AC10** ✅: `activityLabel.test.ts:320`(UT-02 L7), `statusLine.waitPhase.test.ts:67`(IT-04 queuedCount=1 `입력 대기 1건`) 통과<br>- **AC11** ✅: `send.wait-phase.test.ts:248`(IT-03 A5 Claude 비-null 0건), `StatusLine.harness.test.ts`(2 passed) 통과<br>- **AC12** ✅: `activityLabel.test.ts:276`(UT-02 L3), `session-activity-projector.test.ts:288`(UT-03 P5) 통과<br>- **AC13** ✅: `statusLine.waitPhase.test.ts:98,124`(IT-04 revision 무시·LOAD_SESSION hydrate/preserve) 통과<br>- **AC14** ✅: `IPC_CONTRACT.md:594`, `provider-runtime.md:93`, `ux-domains.md:42` 반영 + `check-doc-inventory.mjs --check` exit 0<br>- **AC15** ⚠️: Windows 실제 OpenCode 1.x 실기 시각 확인 대기 |
| 합계 검산 | `✅ 14 · ⚠️ 1 · ❌ 0 = 총 15` (ΔV1에서 AC1·4·5·7이 AC1′·4′·5′·7′로 대체되어 총수 15 불변) |
| 블로커 / 역질문 | 없음 (AC15 사람 실기만 대기) |
| 대상 커밋 | `(r2 구현 — 검증자 기입)` |

## [구현자 기입] Review Signals — 사실만 (r2)

- 작성 에이전트: `codex`.
- 라운드 및 턴 라벨: `r2` (r1 verify `RETURN_TO_PLAN` → ΔV1 설계 후 첫 구현 턴).
- 이전 라운드 반복 축 여부: r1 verify가 지적한 정리 경로 겹침(c11·c12)과 분기/운반 값 입력 공백(I7~I10, A4 키·A6, R6c·R6d·R7g·R7h, P9~P11, `hooks-deps`)을 ΔV1 명세에 따라 전수 잠갔다(`N1`~`N13` 14종 + `M-*` 8종 전부 red).
- plan 지침·AC 누락 여부: 없음 (ΔV1 54자리와 MD-01′·MD-02 규칙 분기가 코드·테스트와 1:1 대응).
- 환경 한계: Windows PowerShell 환경에서 `mutate.py`의 `subprocess.run(..., shell=True)`가 `.bin/vitest` 래퍼 실행 시 `cp949` 출력을 내어 UTF-8 디코딩 오류가 발생하므로, spec의 oracle 명령을 `node ./node_modules/vitest/vitest.mjs ...` 및 `node ./node_modules/eslint/bin/eslint.js ...`로 지정해 실행했다. AC15는 실제 OpenCode 1.x 서버 기동·시각 확인 항목이라 `SELF_BLOCKED`(`⚠️`)로 분리했다.
