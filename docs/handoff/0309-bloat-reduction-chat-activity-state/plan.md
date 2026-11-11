# Plan — 0309-bloat-reduction-chat-activity-state

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력은 [0305 감사](../0305-code-bloat-audit/audit.md) §3 후보 표 · §8 분해안 · §9 분할안 H-F와 [0308 plan](../0308-bloat-reduction-legacy-migration-and-output-store/plan.md) D-008이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0309-bloat-reduction-chat-activity-state` |
| 작성자 | Claude Code |
| 일자 | 2026-11-11 |
| 매핑 | 0305 분할안 H-F(C-24 2단계). H-F의 나머지 후보는 §4에서 제외 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0308 VP-10(`sessionListening`)은 같은 필드를 읽지만 다른 handoff의 V라 상속하지 않고 변이만 다시 등록한다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Claude (비기능 작업 — root `AGENTS.md` 협업 워크플로우) |
| 조사 기준 커밋 | `8c3fca9` (`git cat-file -t` → commit · PR 브랜치 좌표, `main` 조상 여부 미확인) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 대화 상태(`ChatState`)가 main이 보낸 활동 스냅샷 하나를 필드 8개로 풀어 들고, 같은 8필드를 세 곳에서 필드별로 옮겨 적는다. 읽는 쪽은 그 8필드를 다시 스냅샷 이름으로 되돌려 적는다.
- 완료 후 달라지는 것: 활동 스냅샷이 `activity` 객체 하나로 들어가고, 옮겨 적는 자리가 한 곳(`activityOf`)이 된다. 화면은 그대로다.
- 성공을 사용자 관점에서 한 문장으로: 응답 중·대기 중·유휴 표시와 중단·예약 동작이 지금과 같은 때에 바뀐다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "305 검토 결과에 맞춰 최적화를 이어서 작업하라. 현재 307, 308 핸드오프까지 진행됐다" | 라이브 세션 턴 1 |
| 명시 요구 | 0309 범위는 "H-F renderer 대화 상태" — 선택지 설명: "C-24 2단계(활동 8필드를 객체 하나로) · C-23(chatActions 한 줄 래퍼) · C-31(no-op case) · C-20~C-22. 감사 추정 절감 약 110줄, 위험 중간~높음 — 모든 화면이 이 상태를 읽습니다." | 질의 1 답 |
| 명시 요구 | C-07은 "죽은 것만 제거 승인" — 선택지 설명: "제품 코드 어디서도 불리지 않고 테스트만 부르는 함수는 그 테스트와 함께 지웁니다. 테스트 지원 파일(*.testlib.ts)과 의도된 seam(메모리 저장소 대역, 포크가 채우는 인증 spec 등)은 남기고 항목별 분류표를 plan에 적습니다." | 질의 1 답 |
| 상속 | 회귀 금지 · 판정 단위는 시나리오별 관측 동작 · 목표는 코드 감량 · 백그라운드/서브 에이전트 금지 · 단계마다 커밋 | 0305 plan D-003 · D-011 · D-006 · D-007 |
| 추론 의도 | 승인됐지만 이번 범위(H-F)에 없는 C-07은 다음 handoff(H-E)로 간다 — 범위 답과 승인 답을 둘 다 그대로 따른 해석(0307 D-003과 같은 처리) | 질의 1 두 답 |
| 추론 의도 | H-F 후보 가운데 재실측에서 테스트·채택 규칙이 그 구조를 잠근 것으로 드러난 항목은 뺀다 — 회귀 금지(상속)와 감량 목표(상속)를 둘 다 지키는 범위 | §4 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 이번 handoff는 0305 분할안 H-F를 다룬다 | "H-F renderer 대화 상태" | 질의 1 | ACTIVE | — |
| D-002 | C-07 제거를 승인한다 — 제품 코드에서 불리지 않고 테스트만 부르는 함수와 그 테스트. 테스트 지원 파일과 의도된 seam은 남긴다. 실행은 H-E handoff다 | "죽은 것만 제거 승인" · 범위 답에 H-E 없음 | 질의 1 · §2 추론 행 | ACTIVE | 0305 AC12의 C-07 미판정을 닫는다 |
| D-003 | 회귀 금지. 판정 단위는 시나리오별 관측 동작이고, 내부 구조에 묶인 테스트는 통합·삭제할 수 있다 | 0305 D-003 | 0305 plan §3 | ACTIVE | — |
| D-004 | 목표는 코드 감량이다. CI·가드·테스트 인프라를 따로 줄이지 않는다 | 0305 D-011 | 0305 plan §3 | ACTIVE | — |
| D-005 | 백그라운드·서브 에이전트를 쓰지 않는다. 단계마다 커밋을 남긴다 | 0305 D-006 · D-007 | 0305 plan §3 | ACTIVE | — |
| D-006 | 구현 대상은 C-24 2단계 하나다 — 활동 8필드를 `activity` 객체로 묶는다 | H-F 6후보 중 재실측에서 남은 것이 이것뿐이다(D-007~D-012) | 설계자 조사 | ACTIVE | 사용자가 되돌리면 ΔV |
| D-007 | C-24 3·4단계(git 리뷰·우측 패널 reducer 분리)를 하지 않는다 | `app/src/renderer/AGENTS.md` 분해 가이드가 `chatReducer`를 분해 예외로 적는다. 파일을 가르면 import·위임 줄만큼 순증한다(D-004) | 설계자 조사 | ACTIVE | — |
| D-008 | C-20(모듈 전역 상태·전 세션 순회 패치)을 하지 않는다 | 순회 3벌의 술어가 서로 다르고 `chatStore.availability.test.ts:45,94,120`이 그 차이를 잠근다. 술어를 두고 순회 틀만 합치면 순감이 약 12줄이다(§4) | 설계자 조사 | ACTIVE | — |
| D-009 | C-21(세션 열기 2단 조회)을 하지 않는다 | 2차 조회는 `app/AGENTS.md` DB 정책("캐시 재진입도 IPC로 native 이력을 확인")의 구현이고, 유효성 5조건은 `chatStore.native-history.test.ts:116,132,158,173,197,265`가 조건마다 잠근다 | 설계자 조사 | ACTIVE | — |
| D-010 | C-22(권한 모드 순번 2개)를 하지 않는다 | 순번 둘은 서로 다른 경쟁을 막는다 — `chatStore.permission.r4.test.ts:115`(앞선 main 패치가 최신 요청을 덮지 못함)·`:128`(늦은 실패가 main 확정 모드를 되돌리지 못함). 하나로 줄이면 둘 중 하나가 깨진다 | 설계자 조사 | ACTIVE | — |
| D-011 | C-23(`chatActions` 한 줄 래퍼)을 하지 않는다 | `docs/arch/frontend/state.md:90`이 컴포넌트 접근을 "안정 액션 묶음 `chatActions`"로 정한다. 래퍼를 걷으면 컴포넌트가 reducer 내부 액션(`RECV_EVENT`·`LOAD_SESSION`)까지 보낼 수 있게 되고, 테스트 81파일이 `chatActions`를 참조한다 | 설계자 조사 | ACTIVE | 채택 규칙 변경이라 사용자가 되돌리면 ΔV |
| D-012 | C-31(main 내부 이벤트 타입 분리)을 하지 않는다 | renderer의 no-op 두 자리는 `chatStore.schedules.test.ts:202`가 잠근 방어다. 타입을 좁히면 첫 단에서 오류 4건(`bootstrap.ts:987,1286` · `chat-turn/index.ts:177` · `send.ts:517`)이고 줄 수는 줄지 않는다 | 설계자 실측 | ACTIVE | 0308 D-008("측정하지 못했다")을 측정값으로 닫는다 |
| D-013 | `activity` 객체는 main 스냅샷의 필드 이름(`revision`·`foreground`·`transport`·`waitPhase`·`queuedCount`·`deliveryPendingCount`·`residualCount`·`backgroundTaskCount`)을 그대로 쓴다. 대기 단계가 없으면 `waitPhase` 키가 없다(지금은 `null`) | 읽는 쪽(`ActivityView`)이 이미 그 이름과 "없으면 키 없음"을 쓴다 — 이름을 맞추면 되돌려 적는 자리가 사라진다 | 설계자 판단 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-013.
- 변경된 결정: 0305 AC12의 C-07 "미판정" → D-002(승인). 0308 D-008의 근거 "측정하지 못했다" → D-012(측정).
- D-006~D-012는 사용자가 고른 묶음에서 후보를 뺀 설계자 판단이다. 묶음 6건(C-20·C-21·C-22·C-23·C-24·C-31) 중 남는 것은 C-24 2단계 1건이고, 완료 보고에서 사용자에게 알린다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0.
  - D-003 ↔ AC1·AC2: 두 행의 동작 기준이 "지금과 같다"이고 기대값은 변경 전 코드에서 얻는다(§7 주의사항).
  - D-004 ↔ AC4: prod 순감을 요구한다.
  - D-006 ↔ AC1~AC3: 세 행 모두 활동 필드만 다룬다 — `rg 'permission|loadSession|chatActions|session\.schedules' §7` → 0.
  - D-013 ↔ AC1·AC3: AC1이 필드 이름 8개와 `waitPhase` 부재를, AC3이 옛 이름 0건을 요구한다.
  - D-002 ↔ AC1~AC6: C-07을 지우라는 AC 없음(실행은 H-E).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | C-24 2단계는 타당 — 같은 8필드 복사가 세 벌이고 읽는 쪽이 이름을 되돌린다 | `chatReducer.ts:1256-1263` · `:1542-1549` · `:1555-1562` · `PendingAssistantStatus.tsx:17-22` |
| 이미 기존 코드가 충족하는가 | 아니오 | §8 전수 조사 — 76줄 |
| 더 작은 해법이 있는가 | 복사 세 벌만 함수로 뽑는 안은 타입·초기값·selector·소비 쪽 재매핑(약 30줄)을 남긴다 | §14 단계 지도 |
| 선행 자료의 주장을 코드와 대조했는가 | **전제 정정 5건** | 아래 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음 — 0167 AC6·0143 규칙은 그대로다 | §16 |

전제 정정(0305 감사 주장 ↔ 현재 코드):

| 후보 | 감사 주장 | 재실측 | 처리 |
|---|---|---|---|
| C-20 | 전 세션 순회 패치 3벌을 "보내지 않은 초안" 술어 하나로 합친다 | 술어가 다르다 — `applyHarnessAvailability`는 `inflight`·continuity 초안 제외(`chatStore.ts:201-207`), `seedLandingBackend`는 `harnessExplicitlySelected` 제외(`:237-240`), `seedLandingAgentKind`는 continuity 초안 포함(`:287`) | D-008 — 제외 |
| C-21 | 2차 조회가 화면에 주는 차이를 실측해 없으면 제거 | 2차 조회(`sessionApi.refresh`)가 native 이력 반영 경로다 — `chatStore.native-history.test.ts:78` "refreshes history without resetting model or panel state" | D-009 — 제외 |
| C-22 | 순번 2개를 요청 id 하나로 | `request`는 사용자 요청끼리, `settlement`는 main 확정과 늦은 실패 사이를 가른다(`chatStore.ts:1862,1873`) | D-010 — 제외 |
| C-23 | 한 줄 전달 45개를 호출부 직접 dispatch로(90줄) | 채택 규칙 변경이고 테스트 81파일이 걸린다 — `rg -l chatActions app/src/renderer -g '*.test.*' \| wc -l` | D-011 — 제외 |
| C-31 | renderer no-op case를 지운다 | store가 먼저 return해 reducer case는 prod에서 닿지 않지만, 두 자리 모두 테스트가 직접 넣어 잠근다(`chatStore.schedules.test.ts:205,211`) | D-012 — 제외 |

조사에서 새로 본 것(이번 범위 밖): 0307의 camera 제거 뒤 `renderer/src/shared/ui/BayerPattern.tsx`(78줄)·`Histogram.tsx`(47줄)의 참조가 0이다(`lens-exports.mjs` dead 목록). D-002와 함께 H-E로 간다.

- 사용자에게 올릴 결정: 없음(이번 턴 질의로 닫았다). 완료 보고에서 제외 5건과 D-011의 선택지(채택 규칙을 바꿔 래퍼를 걷을지)를 알린다.
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

UI 변화는 없다. 관측자는 앱 사용자(상태 줄·중단 버튼·입력 예약이 그대로다)다.

```text
[main이 chat.activity 스냅샷을 보냄 / 세션을 엶]
  → [renderer가 스냅샷 8필드를 activity 객체로 든다]
  → [상태 줄 · 중단 잔여 안내 · 입력 예약 · 폴더 변경 가드 · 즉시 보내기 버튼이 그 객체를 읽는다]
  ↘ [중단을 누르면 transport만 즉시 idle로 내려간다]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 더 새로운 `chat.activity` 도착(S-04·S-07) | `activity`를 그 스냅샷의 8필드로 바꾼다 | 상태 줄 문구·대기 건수가 지금과 같다 |
| 같거나 낮은 revision의 `chat.activity` | 상태를 바꾸지 않는다 | 낡은 스냅샷이 표시를 되감지 않는다 |
| 응답 중단(S-06) | `transport`만 `idle`로, 나머지 7필드는 그대로 | 대기 표시가 즉시 내려가고 대기 건수는 다음 스냅샷까지 남는다 |
| 세션 열기 — 저장된 스냅샷이 있다(S-11) | 스냅샷으로 `activity`·`inflight`·대기 앵커를 세운다 | 진행 중이던 세션을 다시 열면 진행 표시가 맞다 |
| 세션 열기 — 같은 세션의 더 새로운 라이브 스냅샷이 먼저 왔다 | 로컬 `activity`를 유지한다 | 표시가 되감기지 않는다 |
| 세션 열기 — 스냅샷이 없다 | `activity`는 초기값이다 | 유휴 표시 |
| 캐시된 세션 재열기(로컬 상태 보존) | `activity`를 건드리지 않는다 | 지금과 같다 |
| 응답 중 입력(S-07) | `transport !== 'idle'`이면 예약 | 지금과 같다 |
| 대기 버블의 즉시 보내기 | `foreground === 'streaming'`일 때만 버튼 | 지금과 같다 |

### 파생 UX / 엣지케이스

- loading / empty / error: 변화 없음.
- cancel / retry / close / restart: 위 표의 중단 행. 그 밖은 변화 없음.
- concurrency / multi-session: `activity`는 세션 엔트리마다 따로다 — 다른 세션의 스냅샷이 섞이지 않는다(`chatStore.schedules.test.ts:61`).
- 외부 소비자: 없음. IPC 스냅샷 형식(`shared/ipc.ts:1685`)은 그대로다.

## 6. 범위 / 비범위

- **범위**: C-24 2단계 — `ChatState`의 활동 8필드, 그 쓰기 3벌·초기값·selector·소비 3파일과 딸린 테스트 10파일.
- **비범위**: C-24 3·4단계(D-007) · C-20(D-008) · C-21(D-009) · C-22(D-010) · C-23(D-011) · C-31(D-012) · C-07과 고아 2파일(D-002, H-E) · `listenStartedAt`·`inflight`·`sessionSchedules`·`pendingSessionWakeup`(활동 스냅샷과 병합 규칙이 다른 필드) · 그 밖의 분할안 묶음.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| C-07 · 고아 2파일 | 아니오 | H-E handoff(승인됨) |
| C-23 | 아니오 | 채택 규칙 변경 여부를 사용자가 정하면 별도 handoff |
| C-20 · C-21 · C-22 · C-31 · C-24 3·4단계 | 아니오 | 0305 분할안에 남는다 — 사용자가 되돌리면 ΔV |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | 세션 상태는 활동 스냅샷을 `activity` 객체 하나로 든다. §5 표의 일곱 전이(새 스냅샷·낡은 스냅샷·중단·세 가지 세션 열기·캐시 재열기)에서 8필드가 지금과 같은 값이 된다 | `chatReducer.listen.test.ts` 기존 케이스 + 신규 3건(§7-A VP-01)이 전이마다 `activity`를 단언 | `chat:event` `chat.activity` · `session:load` → `chatReducer` |
| R-02 | AC2 | 채널 점유 판정 · 잔여 수 · 상태 줄 · 즉시 보내기 버튼이 `activity`에서 지금과 같은 값을 읽는다 | 소비 자리 4곳의 좌표(§7-A VP-02) — 실제 store로 렌더한 상태 줄 · 신규 잔여 수 케이스 · `ready` 3입력 | `ChatState.activity` → selector → `StatusLine`·`Composer`·`PendingSteerTurn`·전송/폴더 가드 |
| R-03 | AC3 | 옛 필드 이름 8개가 `app/src`에 없다 | EP-01 검색 0건 · typecheck 3종 | 해당 없음 |
| R-04 | AC4 | prod 코드가 순감한다. 테스트 순증은 신규 케이스 4건분이고 수치를 보고한다 | `git diff --numstat <설계 커밋>..HEAD -- app/src`를 prod/test로 갈라 합산 — prod < 0 | 해당 없음 |
| R-05 | AC5 | §19 게이트가 green이거나 실패가 기준선과 같은 환경 서명이다 | §19 명령 산출 | CI |
| R-06 | AC6 | 개발 빌드에서 응답 중·백그라운드 대기·중단·응답 중 입력 예약의 상태 줄과 버튼이 그대로다 | 사람 실기 — §19 | 실제 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: 인용한 케이스명은 이번 세션에 `rg`로 실재를 확인했다 — `chatReducer.listen.test.ts:25,47,61,110,127` · `statusLine.waitPhase.test.ts:50,65,121,153` · `statusLine.background.test.ts:120` · `chatStore.listen.test.ts:27,81,104` · `chatStore.schedules.test.ts:61` · `chatStore.sessionDirectory.test.ts:63` · `pendingSteerControls.test.ts:136`.
- 기대값의 출처: AC1·AC2의 "지금과 같다"는 변경 전 코드에서 얻는다 — 신규 케이스는 옛 필드 이름으로 먼저 써서 `8c3fca9`에서 green임을 확인한 뒤 새 이름으로 옮긴다.
- 사람 실기 항목: AC6. 시각 확인만 남긴다 — 판정 로직은 AC1·AC2가 기계로 본다.
- 총량/0건 기준: AC3의 불변식은 "옛 이름이 없다"라 음성 검색이 방향에 맞다. "새 객체가 쓰인다"는 AC1·AC2의 양성 단언이 짝이다.
- AC4의 test 조건: 신규 4건은 변경 전에 잠기지 않던 자리(형제 건수 맞바꿈·잔여 수 selector·스냅샷 없는 열기·캐시 재열기)를 잠근다. 순증이 60줄을 넘으면 사유를 보고한다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 코드 계약 V가 없다.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음. 0308 VP-10의 변이 (h)(i)(j)는 같은 식이 `activity.transport`로 옮겨 가므로 VP-02에 다시 등록한다.
- 변경이 시작되는 수준: Baseline이라 해당 없음. `SD↔ST`는 두지 않는다 — 수명주기·종단 경로가 바뀌지 않고 상태의 모양만 바뀐다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-06 | R | §7 각 행 | NEW | — |
| AT-01~AT-06 | AT | §7 검증 수단 칸 | NEW | — |
| MD-01 | MD | §10 활동 상태 저장 규칙(`activityOf` · reducer 4자리) | NEW | — |
| AR-01 | AR | §10 `ChatState.activity` → 소비 4자리 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01·MD-01 ↔ AT-01 | REQUIRED | `chat:event` `chat.activity` / `session:load` → `chatReducer` (`RECV_EVENT`·`CANCEL_CHAT`·`LOAD_SESSION`) → `activityOf` → `ChatState.activity` | §10 규칙 표 M1~M7의 좌표. 신규 3건(`chatReducer.listen.test.ts`): ① "스냅샷 8필드를 activity 로 옮긴다" — 8필드가 서로 다른 입력 → `toEqual` ② "스냅샷 없는 세션 로드는 activity 를 초기값으로 둔다" ③ "캐시 재열기는 activity 를 건드리지 않는다" | required — 형제 슬롯(숫자 4필드)·분기 맞바꿈. 변이: (a) `activityOf`의 `queuedCount`↔`deliveryPendingCount` 맞바꿈 → ① red (b) `activityOf`의 `waitPhase` 항 제거 → `statusLine.waitPhase.test.ts:153` red (c) `CANCEL_CHAT`의 `transport: 'idle'` 제거 → `:47` red (d) `LOAD_SESSION` 보존 분기를 스냅샷 분기와 맞바꿈 → `:110` red (e) revision 가드 `<=`를 `<`로 → `statusLine.waitPhase.test.ts:121` red | EP-01 쓰기 자리 (reducer 43줄) |
| VP-02 | R-02·AR-01 ↔ AT-02 | REQUIRED | `ChatState.activity` → ① `sessionListening`·`sessionBusy`·`sessionResponding` → 전송 예약·폴더 가드·busy ② `useChatResidualSteer` → `Composer` ③ `useChatActivity` → `PendingAssistantStatus` → `StatusLine` ④ `PendingSteerTurn` selector → `pendingSteerControls` | §10 규칙 표 C1~C4의 좌표. 신규 1건(`statusLine.waitPhase.test.ts`): ④ "잔여 수 selector 는 activity.residualCount 를 낸다" — `useChatResidualSteer`를 부르는 컴포넌트를 실제 store로 렌더, 입력 `residualCount: 2` · `queuedCount: 5` · `deliveryPendingCount: 3` → `2` | required — 형제 슬롯(`sessionListening`은 `!== 'idle'`, `sessionResponding`은 `=== 'listening'`; 건수 4필드). 변이: (f) `sessionListening`을 `=== 'listening'`으로 맞바꿈 → `chatStore.listen.test.ts:27` red (g) `useChatResidualSteer`를 `queuedCount`로 → ④ red (h) `useChatActivity`의 `listening`을 `false` 고정 → `statusLine.waitPhase.test.ts:50` red (i) `PendingSteerTurn` selector를 `'idle'` 고정 → `pendingSteerControls.test.ts:136` red (j) `useChatActivity`의 `queuedCount`↔`backgroundTaskCount` 맞바꿈 → `statusLine.background.test.ts:120` red | EP-01 읽기 자리 (store 18줄 · 소비 3파일 15줄) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 소스 트리 | `gate:rg` EP-01 명령 → 0줄 · `gate:npm run typecheck` | not selected — 삭제의 음성 검색이고 양성 짝이 VP-01·VP-02다 | EP-01 전체 (76줄) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/renderer/**` 수정 | §19 | 이번 변경이 만진 파일에서 난 실패와 기준선 밖 실패만 blocking |
| 테스트 풀·예산 가드 | 테스트 10파일을 수정한다 | `[test-pools]` · `node scripts/check-test-budgets.mjs` | 만진 파일의 위반만 blocking |
| 문서 인벤토리·이름 검사기 | 문서·이름을 바꾸지 않지만 CI 단계다 | `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` | 전부 blocking |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| main 스냅샷은 8필드 + 예약 2필드다 | `app/src/shared/ipc.ts:1685-1698` `ChatActivitySnapshot` |
| `ChatState`는 그 8필드를 `activity*` 접두 이름으로 푼다 | `chatReducer.ts:332-339` · 초기값 `:516-523` |
| 8필드 쓰기가 세 벌이다 | 라이브 `:1256-1263` · 로드 보존 `:1542-1549` · 로드 hydrate `:1555-1562` |
| 그 밖의 reducer 자리는 3줄이다 | revision 가드 `:1244` · 중단 `:1416` · 로드의 revision 비교 `:1453` |
| 캐시 재열기 분기는 `...state`에서 시작해 활동 필드를 쓰지 않는다 | `chatReducer.ts:1455-1487` |
| 스냅샷 없는 로드는 `...initialChatState`에서 시작한다 | `chatReducer.ts:1488-1489` · `:1568` `: {}` |
| 상태 줄이 받는 `ActivityView`는 스냅샷 이름 6개 + 예약 2개 + `listening`이다 | `lib/activityLabel.ts:42-52` |
| `PendingAssistantStatus`는 selector가 준 `activity*` 6필드를 `useMemo`로 스냅샷 이름에 되돌린다 | `PendingAssistantStatus.tsx:15-37` |
| `useChatActivity`는 `useShallow`로 6필드 + 예약 2 + 파생 `listening`을 고른다 | `chatStore.ts:2313-2338` |
| 상태 줄 테스트는 실제 store와 실제 `PendingAssistantStatus`로 렌더한다 | `statusLine.waitPhase.test.ts:38-46` · `statusLine.background.test.ts:120-136` |
| `useChatResidualSteer`의 소비자는 `Composer.tsx:130` 하나이고 Composer 테스트 3파일은 그 훅을 mock한다 | `rg -n useChatResidualSteer app/src/renderer` → 6줄 |
| `pendingSteerControls.test.ts`는 `useChatSession`을 mock해 selector에 `{activityForeground}`를 준다 | `:22-23` |
| 대기 단계가 없을 때의 값 `null`을 읽는 prod 자리는 `PendingAssistantStatus.tsx:18` 하나다(없으면 키를 뺀다) | `rg -n activityWaitPhase app/src -g '!*.test.*'` → 9줄 |
| lint는 rest 형제 무시를 켜지 않았다 — `{ type, sessionId, ...rest }` 꼴은 미사용 변수 오류다 | `rg -n "ignoreRestSiblings\|no-unused-vars" app/eslint.config.mjs` → 0 |
| 문서에 `activity*` 필드 이름은 없다 | `rg -n "activity(Transport\|Revision\|…)" docs/arch docs/*.md` → 0(스냅샷 표 `IPC_CONTRACT.md:588`만) |
| INDEX 후보 표의 0308 행(`sessionBusy` 소비처 3곳 미잠금)은 이번 파일과 겹치지만 승격 조건이 "사용자 요청"이다 — 이번 변경은 `sessionBusy`의 정의만 고치고 그 소비 자리(`chatStore.ts:1729,1765` 등)는 고치지 않는다 | `docs/handoff/INDEX.md` `## 새 handoff 후보` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 활동 필드 이름이 있는 prod 줄 | EP-01 명령(§10) | 76 | `chatReducer.ts` 43 · `chatStore.ts` 18 · `PendingAssistantStatus.tsx` 12 · `PendingSteerTurn.tsx` 2 · `pendingSteerControls.ts` 1 |
| reducer 43줄의 내역 | 줄 번호 대조 | 43 | 타입 8 · 초기값 8 · 라이브 쓰기 8 · 보존 복사 8 · hydrate 복사 8 · 가드/비교 2 · 중단 1 |
| store 18줄의 내역 | 줄 번호 대조 | 18 | 점유 술어 5(`:2285,2286,2289,2294,2295`) · 잔여 수 1(`:2310`) · selector 타입 6 · selector 본문 6 |
| 활동 필드 이름이 있는 테스트 줄 | 같은 술어, 테스트 glob | 46 | 10파일 — `chatReducer.listen` 22 · `statusLine.waitPhase` 9 · `statusLine.background` 3 · `chatStore.schedules` 3 · `chatStore.listen` 2 · `chatReducer.turnEnd` 2 · `pendingSteerControls` 2 · 그 밖 3파일 각 1 |
| `useChatActivity` 참조 | `rg -n useChatActivity app/src` | 4 | 정의 1 · 소비 1 · import 1 · 테스트 mock 1(`ChatTile.harness.test.ts:47`) |

### 수치 / 전칭 표현 검산

- 재측정 수치: 위 표. 76 = 43 + 18 + 12 + 2 + 1. 43 = 8×5 + 2 + 1. 18 = 5 + 1 + 6 + 6. 46 = 22 + 9 + 3 + 3 + 2 + 2 + 2 + 3.
- "하나뿐" 반례 검색: `useChatResidualSteer` 소비자 · `activityWaitPhase` null 소비 · `useChatActivity` 소비자를 각각 `rg`로 전수 확인했다(위 표).
- 문서 앵커 / 기존 테스트 케이스 존재 확인: §7 주의사항 1행 · `app/src/renderer/AGENTS.md` "단일 파일 분해 가이드"의 `chatReducer` 예외 문장 · `state.md:90`.
- 기준선 typecheck: `npm run typecheck` green(`8c3fca9`, 이번 세션).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: MD-01 · AR-01.
- reducer가 스냅샷을 접두 이름 8필드로 풀고, selector가 그중 6필드를 다시 고르고, 상태 줄 컴포넌트가 그 6필드를 스냅샷 이름으로 되돌린다.

```text
ChatActivitySnapshot{revision,foreground,transport,waitPhase?,…Count×4}
  ─ chatReducer ─ activityRevision · activityForeground · … (8필드, 쓰기 3벌)
  ─ useChatActivity ─ {activityForeground, …}(6필드 재선택)
  ─ PendingAssistantStatus(useMemo) ─ {foreground, waitPhase?, …}(이름 되돌림) ─ StatusLine
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 같은 노드.
- reducer가 스냅샷의 8필드를 `activityOf` 한 곳에서 골라 `activity`에 넣는다. selector는 `ActivityView`를 그대로 내고 컴포넌트는 그것을 넘긴다.

```text
ChatActivitySnapshot ─ activityOf ─ ChatState.activity{revision,foreground,transport,waitPhase?,…Count×4}
  ─ useChatActivity(useShallow) ─ ActivityView ─ PendingAssistantStatus ─ StatusLine
  ─ sessionListening · sessionResponding ─ activity.transport
  ─ useChatResidualSteer ─ activity.residualCount
  ─ PendingSteerTurn ─ activity.foreground
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 상태 모양 | 접두 이름 8필드 | `activity` 객체 1필드(스냅샷 이름) | 같은 묶음을 한 단위로 | MD-01 / VP-01 · `chatReducer.ts` |
| 스냅샷 → 상태 | 필드별 복사 2벌(라이브·hydrate) | `activityOf(snapshot)` 한 곳 | 복사 사본 제거 | MD-01 / VP-01 |
| 로드 보존 | 필드별 복사 1벌 | `activity: state.activity` | 객체 참조 하나 | MD-01 / VP-01 |
| 대기 단계 없음 | `activityWaitPhase: null` | `waitPhase` 키 없음 | 읽는 쪽 규약과 같게(D-013) | MD-01 / VP-01 변이 (b) |
| selector | 6필드 재선택 + 타입 `Pick` 8줄 | `ActivityView` 반환 | 이름 되돌림 제거 | AR-01 / VP-02 · `chatStore.ts` |
| 상태 줄 컴포넌트 | `useMemo` 재매핑 23줄 | selector 결과를 그대로 전달 | selector의 `useShallow`가 이미 같은 값에 같은 객체를 준다 | AR-01 / VP-02 · `PendingAssistantStatus.tsx` |
| 점유·잔여·즉시 보내기 | `s.activityTransport` 등 | `s.activity.transport` 등 | 이름만 | AR-01 / VP-02 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `reducer/chatReducer.ts` `activityOf` | 스냅샷에서 활동 8필드를 고른다(예약 2필드·`type`·`sessionId` 제외) | `ChatActivitySnapshot` → `ChatActivityState` | reducer 내부 2곳(라이브 · hydrate) |
| `store/chatStore.ts` selector | `activity`에서 점유·잔여·상태 줄 view를 낸다 | `ChatState` → boolean · number · `ActivityView` | 컴포넌트·store 내부 가드 |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01·AR-01 / VP-01~VP-03 — EP-01 | 세션의 활동 스냅샷 8필드 | `chatReducer.ts` `ChatState.activity` · `activityOf` | 구현자 | 76줄 5파일: `chatReducer.ts` 43(타입 `:332-339` · 초기값 `:516-523` · 가드 `:1244` · 라이브 쓰기 `:1256-1263` · 중단 `:1416` · 로드 비교 `:1453` · 보존 복사 `:1542-1549` · hydrate 복사 `:1555-1562`) · `chatStore.ts` 18(`:2285,2286,2289,2294,2295,2310,2315-2320,2328-2333`) · `PendingAssistantStatus.tsx` 12(`:17-22,28-33`) · `PendingSteerTurn.tsx` 2(`:23,36`) · `pendingSteerControls.ts` 1(`:18`) | `rg -n "activity(Transport\|Revision\|Foreground\|WaitPhase\|QueuedCount\|DeliveryPendingCount\|ResidualCount\|BackgroundTaskCount)\b" app/src -g '!*.test.*' -g '!*.testHarness.*' -g '!*.testfixture.*'` → 76줄 → 0줄 | 옛 이름이 남으면 typecheck red다(필드가 없다). 게이트가 green인 채로 남는 차이는 "새 객체에서 형제 필드를 잘못 읽음"이고 VP-01 (a)·VP-02 (g)(j)가 그 자리다 |

규칙 칸 ↔ UT 입력 칸:

| 규칙 | 분기 | 입력 | 기대 | 좌표 |
|---|---|---|---|---|
| M1 라이브 스냅샷 | revision이 더 크다 | 8필드가 서로 다른 스냅샷(revision 7 · `streaming` · `listening` · `{kind:'model'}` · 건수 4·2·1·3) | `activity`가 그 8필드와 같다 | VP-01 신규 ① |
| M2 | 대기 단계가 없는 스냅샷이 뒤따른다 | M1 뒤 `waitPhase` 없는 revision 8 | `activity.waitPhase`가 `undefined` | VP-01 신규 ①의 둘째 단언 |
| M3 | revision이 같거나 작다 | revision 1 뒤 revision 1(다른 `waitPhase`) | 상태 불변 | `statusLine.waitPhase.test.ts:121` |
| M4 중단 | `CANCEL_CHAT` | `listening` 스냅샷(건수 포함) 뒤 중단 | `transport`만 `idle`, 나머지 7필드 불변 | `chatReducer.listen.test.ts:47` + 7필드 `toEqual` 단언 추가 |
| M5 세션 로드 | 같은 세션 · 로컬 revision이 더 크다 | 로컬 5 · 로드 4 | 로컬 `activity` 유지 | `chatReducer.listen.test.ts:110` · `statusLine.waitPhase.test.ts:153` |
| M6 | 스냅샷이 있다(M5 아님) | revision 7 · 건수 서로 다름 | 스냅샷 8필드 · `inflight` · 대기 앵커 | `chatReducer.listen.test.ts:127`(8필드 `toEqual`로) |
| M7 | 스냅샷이 없다 | 다른 세션의 `listening` 상태에서 스냅샷 없는 세션 로드 | `activity`가 초기값과 같다 | VP-01 신규 ② |
| M8 | 캐시 재열기(`preserveLocalState` · 같은 세션) | 로컬 revision 5 · 로드 스냅샷 revision 9 | `activity`가 로컬 것 그대로(변경 전 동작) | VP-01 신규 ③ |
| C1 점유 | `transport` `idle` | `{transport:'idle'}` | `sessionBusy` false | `chatStore.listen.test.ts:104` |
| | `ready` | `{transport:'ready'}` | 점유 true · responding false · 전송이 예약 경로 · 폴더 변경 `busy` | `chatStore.listen.test.ts:27` · `chatStore.sessionDirectory.test.ts:63` |
| | `listening` | `{transport:'listening'}` | 점유 true · responding true | `chatStore.listen.test.ts:81` |
| C2 잔여 수 | `residualCount` | 2(형제 5·3) | 2 | VP-02 신규 ④ |
| C3 상태 줄 view | 6필드 + 예약 2 + `listening` | 실제 store 렌더 — `queuedCount 1`·`backgroundTaskCount 1`·`waitPhase` 9종·`ready`/`listening`/`idle` | 지금과 같은 문구 | `statusLine.background.test.ts:120` · `statusLine.waitPhase.test.ts:50,78,121` |
| C4 즉시 보내기 | `foreground` `streaming` / 그 밖 | mock store `{activity:{foreground}}` | 버튼 `send-now`+`cancel` / `cancel` | `pendingSteerControls.test.ts:136` |

- 자리 목록은 위 검색 출력과 차집합 0이다(이번 세션 실행 — §8 전수 조사).
- **선언 경계**:
  1. `useChatActivity`가 값이 같을 때 같은 객체를 돌려주는 성질(`useShallow`)은 테스트로 잠그지 않는다 — 변경 전에도 잠기지 않았고 관측 결과가 아니라 렌더 횟수다.
  2. `sessionBusy`를 부르는 가드 자리(`chatStore.ts`의 세션 로드·핸들러 가드)는 이번 변경이 고치지 않는다. 0308 후보 표 행 그대로다.
  3. `listenStartedAt`·`inflight`·`sessionSchedules`·`pendingSessionWakeup`은 `activity` 객체에 넣지 않는다 — 스냅샷과 병합 규칙이 다르다(`chatReducer.ts:1264-1269,1525-1535`).
  4. M8의 기대(재열기는 더 새 스냅샷도 반영하지 않는다)는 변경 전 동작의 고정이지 그 동작이 옳다는 판정이 아니다.
- 열린 입력 집합을 판정하는 산출물: 해당 없음 — 검사기를 만들지 않는다.
- 같은 규칙이 여러 레이어에 있는가: 스냅샷 → 상태는 `activityOf` 한 곳, 점유 파생은 `sessionListening` 한 곳.
- 선택적 필드의 의미: `waitPhase` 부재 = 대기 단계 없음. `ActivityView`·`deriveActivityLabel`이 이미 그 의미로 읽는다(`activityLabel.ts:59`).
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

커밋 단위는 하나다(D-005): **M1** 활동 상태 객체화(AC1~AC3).

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `reducer/chatReducer.ts` | 대화 상태 | `export type ChatActivityState = Pick<ChatActivitySnapshot, 8필드>` · `ChatState.activity` · 초기값 `IDLE_ACTIVITY` · `activityOf` · 쓰기 3벌을 `activity: activityOf(ev)` / `activity: state.activity` / `activity: activityOf(activity)`로 · 중단은 `activity: { ...state.activity, transport: 'idle' }` | `chatReducer.listen.test.ts` |
| `store/chatStore.ts` | 파생·selector | 점유 술어 3개의 `Pick`을 `'activity'`(+`'inflight'`)로 · `useChatResidualSteer` · `useChatActivity(): ActivityView`(`useShallow` 유지 — `revision`·`transport`를 뺀 6필드 + 예약 2 + `listening`) | `statusLine.*.test.ts` · `chatStore.listen.test.ts` |
| `components/transcript/PendingAssistantStatus.tsx` | 상태 줄 조립 | `useMemo` 재매핑 삭제 · `activity={useChatActivity()}` | `statusLine.*.test.ts` |
| `harnesses/common/transcript/PendingSteerTurn.tsx` · `pendingSteerControls.ts` | 즉시 보내기 | selector `s.activity.foreground` · 인자 타입 `ChatActivityState['foreground']` | `pendingSteerControls.test.ts` |
| 테스트 10파일 | — | 옛 이름을 새 경로로 · 부분 상태 입력은 `{ ...initialChatState.activity, transport: 'ready' }` 꼴 · 신규 4건 | — |

### 테스트 가능성

- 별도 순수 파일: 필요 없다 — reducer는 이미 순수 함수이고 테스트가 직접 부른다.
- 기존 메커니즘 재사용: `statusLine.waitPhase.test.ts`의 `renderStatusWithSession`(실제 store + SSR)을 신규 ④가 그대로 쓴다. 훅을 부르는 한 줄 컴포넌트를 테스트 안에 둔다.
- `activityOf`는 export하지 않는다 — reducer 진입(`RECV_EVENT`·`LOAD_SESSION`)으로 관측한다(C-07이 지우려는 "테스트만 쓰는 export"를 새로 만들지 않는다).
- 부분 상태를 받는 술어 테스트(`chatStore.listen.test.ts:65`)는 `{ inflight, activity: { transport } }`로 충분하도록 술어의 `Pick`을 `{ activity: Pick<ChatActivityState, 'transport'> }`로 좁힌다.

## 12. End-to-end 영향

### producer → consumer

```text
main SessionActivityProjector → chat:event(chat.activity) → chatReducer.activityOf → ChatState.activity → selector 4종 → StatusLine · Composer · PendingSteerTurn · 전송/폴더 가드
session:load(LoadedSession.activity) → chatReducer LOAD_SESSION → 같은 경로
```

- producer 기준: 변경 없음 — 스냅샷 형식은 main이 낸다(`shared/ipc.ts:1685`).
- consumer 파생 규칙: 점유 `transport !== 'idle'` · 응답 중 `inflight || transport === 'listening'`(0308 그대로).
- 파생 가능한 합성값이 정본을 우회하지 않는가: view의 `listening`은 selector가 매번 파생하고 저장하지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `initialChatState`를 펼쳐 쓰는 자리(새 대화·로드 시작·테스트 fixture) | `activity`가 공유 상수 객체를 가리킨다. reducer는 그 객체를 고치지 않고 새 객체로 바꾼다(M1·M4) | AC1 |
| `...state` 부분 갱신 자리 | 객체 참조가 그대로 넘어간다 | AC1 M8 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 엔트리 생성 시 `activity`는 `IDLE_ACTIVITY`다.
- 취소/중단: M4. `CANCEL_CHAT`은 새 객체를 만든다 — 공유 초기 객체를 고치지 않는다.
- 종료/quit/crash · retry/timeout: 변화 없음.
- cleanup/rollback: 해당 없음.
- **다중 저장소 쓰기**: 코드에는 없다. 산출 문서의 판정 사본은 `plan.md` 메타 · `INDEX.md` 행 둘이다.

## 14. 성능 / 상한 / 최적화

- 새 출력·요청: 없음.
- 구조적 목표: prod 순감(AC4). 단계 지도 — 타입 −7 · 초기값 −7(+상수 10) · 쓰기 3벌 −21 · `activityOf` +12 · selector −12 · `PendingAssistantStatus` −23. 합 약 −48. 추정이라 AC는 부호만 요구한다.
- 덜 하면서 잃는 부수 효과: `PendingAssistantStatus`의 `useMemo`가 없어진다. 같은 값에 같은 객체를 주는 일은 selector의 `useShallow`가 계속 한다(선언 경계 1). revision만 오른 스냅샷은 `activity` 객체를 새로 만들지만 view에는 revision이 없어 shallow 비교가 같다.

## 15. 외부 구현 포트 / 문서 계약

- 외부가 구현할 port/schema: 없음. IPC·preload·문서 계약 변경 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0167 AC6 "`listening`은 transport에서만 파생한다" | `chatReducer.ts:1245` 주석 | §12 consumer 파생 규칙 | 유지 |
| 0143 "`inflight`는 라이브 경로에서 renderer 소유 — 라이브 스냅샷이 덮지 않는다" | `chatReducer.ts:1250` 주석 · `chatReducer.listen.test.ts:94` | §10 선언 경계 3 | 유지 — `inflight`는 객체 밖 |
| 0308 MD-01 "채널 점유 = `activityTransport !== 'idle'`" | 0308 plan §10 EP-07 | AC2 C1 | 유지 — 읽는 경로만 `activity.transport` |
| "load 응답보다 최신 live revision이 먼저 오면 되감지 않는다" | `chatReducer.listen.test.ts:110` | AC1 M5 | 유지 |
| `chatReducer`는 단일 파일 분해의 예외 | `app/src/renderer/AGENTS.md` 단일 파일 분해 가이드 | D-007 | 준수 |
| 컴포넌트는 selector·`chatActions`로만 채팅 상태에 접근 | `docs/arch/frontend/state.md:90` | D-011 · §11 | 준수 — 컴포넌트는 selector만 고친다 |
| reducer·순수 변환기·파생 셀렉터는 단위 테스트와 함께 | `app/src/renderer/AGENTS.md` 테스트 | §7-A 신규 4건 | 준수 |
| 코드에서 셀 수 있는 수치를 문서에 적지 않는다 | `docs/AGENTS.md` 작성 규칙 2 | 문서 변경 없음 | 해당 없음 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 건수 4필드를 새 객체에서 맞바꿔 읽는다 | 신규 ①·④와 변이 (a)(g)(j) — 입력 건수가 서로 다르다 |
| `waitPhase` `null` → 부재 전환에서 `null`을 기대하는 자리가 남는다 | prod 소비 1곳(§8) · 테스트의 `toBeNull` 기대는 0(`rg -n "WaitPhase\)?\.toBeNull\|activityWaitPhase: null" app/src` → 초기값 1줄뿐) |
| 테스트 fixture를 옮기며 입력 의미가 바뀐다 | 필드 이름 대 필드 이름 1:1 이동만 한다. 신규 케이스는 옛 이름으로 먼저 green을 본다(§7 주의사항) |
| 감량이 작다(약 48줄) | H-F의 나머지는 테스트·채택 규칙이 잠근 구조다(§4). 완료 보고에 그대로 적는다 |

- 되돌리기 어려운 결정: 없음 — renderer 메모리 상태의 모양이고 저장·전송 형식이 아니다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` · `store/chatStore.ts` · `components/transcript/PendingAssistantStatus.tsx` · `harnesses/common/transcript/{PendingSteerTurn.tsx,pendingSteerControls.ts}`
- 테스트: `reducer/{chatReducer.listen,chatReducer.turnEnd}.test.ts` · `store/{chatStore.listen,chatStore.schedules,chatStore.sessionDirectory,chatStore.project-selection}.test.ts` · `components/{statusLine.waitPhase,statusLine.background}.test.ts` · `components/transcript/TurnOutputCards.test.ts` · `harnesses/common/transcript/pendingSteerControls.test.ts`
- 문서: 없음.

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` — better-sqlite3 ABI · 제약 환경 게이트 가이드, CI 표 · `app/src/renderer/AGENTS.md`.
- 환경 제약: 이 환경은 electron 바이너리가 없다(`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`). 0308 r1 verify의 기준선은 vitest 29파일·22케이스 실패(Electron 부재)이고 차집합으로 분리한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 가드 스크립트: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs`.
- 테스트: 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"`.
- 사람 실기(AC6): 개발 빌드에서 (a) 메시지 전송 → 상태 줄 "생각 중"·경과 시간 (b) 응답 중 입력 → 대기 버블과 "입력 대기 N건" (c) 백그라운드 작업이 도는 채 응답 종료 → 대기 표시 유지 (d) 중단 → 대기 표시가 즉시 내려감 (e) 진행 중 세션을 떠났다 돌아옴 → 진행 표시 유지.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-001~D-013, 0305 AC12·0308 D-008과의 관계 기입.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §5 상태 표 9행.
- [x] 조건절·이유절을 임의 재해석하지 않았다 — §2에 선택지 설명 원문 인용. 범위를 줄인 것은 D-006~D-012로 분리해 적었다.
- [x] 사용자에게 물을 제품 결정과 코드 조사로 닫을 사실을 구분했다 — 범위·C-07은 질의, 후보별 타당성은 조사.
- [x] 수치·전칭 표현·문서 앵커·기존 테스트 인용을 실측했다 — §8 검산.
- [x] 작업 관련 저장소 규칙과 겹치는 후보 표 행을 확인했다 — `renderer/AGENTS.md` 분해 예외 · `state.md:90` · lint rest 규칙 · 0308 후보 행(§8).
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다 — §7 6행.
- [x] Baseline V다 — 상속 기준 없음.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair가 있다 — R↔AT 3쌍, MD-01은 VP-01, AR-01은 VP-02.
- [x] 영향받은 INHERITED node 없음.
- [x] 각 pair가 경로·§10 분모·자리별 좌표를 갖고, 적대 증거는 형제 슬롯이 있는 VP-01·VP-02만 선택했다.
- [x] 규칙 칸 분기마다 입력이 있다 — §10 규칙 표 M1~M8 · C1~C4.
- [x] 선언 경계 4건을 근거와 함께 적었다. 새 검사기 없음.
- [x] 운영 gate 4행을 열거했다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — AC6은 시각 확인만.
- [x] semantic 목표를 structural proxy만으로 검증하지 않는다 — AC3 음성 검색의 양성 짝이 AC1·AC2다.
- [x] "X가 쓰인다" 불변식: 필드별 맞바꿈 변이 (a)(g)(j)와 분기 맞바꿈 (d)(f)로 잠근다.
- [x] 신규 계약 `ChatActivityState`·`activityOf`의 SSOT·강제 지점·seam이 있다 — §9 책임 표 · §11.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12.
- [x] one-way door 없음을 적었다 — §17.
- [x] 게이트 명령이 `app/AGENTS.md`와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다 — 충돌 0, 5행.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> 필드와 표의 열은 [`plan.template.md`](../../../.agents/skills/handoff-plan/plan.template.md)의 `[구현자 기입]` 절을 그대로 쓴다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
