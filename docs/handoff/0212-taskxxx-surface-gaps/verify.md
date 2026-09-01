# Verify — 0212-taskxxx-surface-gaps

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 설계 기준의 정본은 [`plan.md`](plan.md) — 본 문서는 그 규범 행을 재서술하지 않고 판정과 관측만 적는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0212-taskxxx-surface-gaps` |
| 검증자 | Claude Code |
| 일자 | 2026-09-02 |
| 대상 커밋/range | `e38f545e..73e29690` (구현 `4a64a8ab` + lint 정규화 `73e29690`) |
| 구현 전 plan 기준 | `e38f545e` |
| V mode / 유효 V | `Baseline V: V1` (상속 없음) |
| 검증 기준 plan revision | `e38f545e:V1` |
| 라운드 | 1 |
| 상태 | **FAIL + PLAN_GAP → RETURN_TO_PLAN** |
| 자기 검증 여부 | **설계·구현·검증이 모두 Claude Code다.** §4에 구현 보고가 이름을 대지 않은 적대 축 **3건**(MV-1·MV-2·MV-3)을 넣었고 셋 다 green 이었다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 했다 — `4a64a8ab` 의 hunk 는 `@@ -643,80 +643,124 @@` **1개**이고 전부 `[구현자 기입]` 이하다.
- **기준선이 diff로 성립하는가**: 예 — 설계 커밋(`cc69700f`·`e38f545e`)과 구현 커밋(`4a64a8ab`)이 갈려 있다.
- Decision Ledger 변경: **없음** — D-001~D-025 행이 impl diff 밖이다.
- Product/UX Contract 변경: **없음** — §5·§6 이 impl diff 밖이다.
- AC 변경: **없음** — §7 AC1~AC26 이 impl diff 밖이다. 분모 26 불변.
- V node/pair·requiredness·§10·oracle 변경: **없음** — §7-A·§10 이 impl diff 밖이다.
- 채점에 사용할 원 기준: `e38f545e` 시점의 §3·§5·§7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | `기준 V: none` 과 근거(§7-A 첫 줄 — 0204 V 에 대응 노드 없는 R 4건)가 있다 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01~07·SD-01~04·AR-01~04·MD-01~04 = 19 NEW node, REQUIRED pair 16 이 전건 커버 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | R-90→VP-14 · R-91→VP-10 · R-92→VP-19 · MD-90→VP-07 = 4/4 |
| pair별 path·§10 전수·직접 oracle | 유효 | 20 pair 전건이 세 칸을 갖는다 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | VP-03·VP-04(형제 맞바꿈) · VP-15(`paused` 항 제거) 3건에 이유가 있다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §7-A 표 5행 + 알려진 기준선(git/worktree flaky) 분리가 있다 |
| **AC21 ↔ 상속 계약 0204 AT-31** | **PLAN_GAP** | 두 행이 정착 `message` 한 자리를 두고 반대를 요구한다 — 아래 D4 |

- V 도입 전 plan 인가: 아니오 — 합성 매핑 불필요.
- root PLAN_GAP: **D4** — 영향 pair VP-12(AR-03 ↔ AT-20·21).

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-003·D-005 | `tools` 부재는 안내 없음, 미포함만 안내 | `claude-map.ts` init → `session.updated.patch.agentTools` → reducer → `TaskProgressList` — 배선 확인 |
| D-006·D-007 | 표시 제목만 현재진행형, `aria-label` 은 `subject` | `taskBoard.agentItem` → `TaskRow` 188·218 — 배선 확인 |
| D-009·D-010 | `addBlocks` 역방향 가산, 대상 없으면 무시 | `readUpdate` → `applyReverseBlocks` (fold 호출 1지점) — 배선 확인 |
| D-011·D-012 | 레벨 REPLACE + 첫 payload 기준선, watchdog 유지 | `mapBackgroundTasksChanged` → coordinator → `applyLiveSet` → `settleTaskSubset` — **배선은 있으나 잠금 0**(D2) |
| D-014·D-015·D-022 | `paused` 는 라이브·중단 가능, `killed` 는 `stopped` 동형 | `mapTaskUpdated` → store transient → `backgroundBoardStatus` → 두 타일 — 배선 확인 |
| D-025 | 전용 본문은 할 일 목록 4종만 | `registry.ts` match → `TaskToolBody` — **배선은 있으나 잠금 0**(D1) |
| D-020·D-021 | 단건 전환만, foreground 행에만 | store → `chatApi` → preload → `chatBackgroundSubagent` → `turn.live.backgroundTask` — **main 구간 잠금 0**(D3) |

### end-to-end 흐름

```text
SDK(init·task_updated·background_tasks_changed)
  → claude-map 정규화            [잠김 — claude-map.test.ts 18케이스]
  → bus → coordinator/tracker    [부분 — tracker 순수부만 잠김, 조인 미잠금]
  → reducer/store transient      [잠김 — chatReducer.task.test.ts · chatStore.subagentControl.test.ts]
  → taskBoard 파생               [잠김 — taskBoard.test.ts]
  → 두 타일 + transcript          [부분 — 타일 잠김, transcript 레지스트리 미잠금]
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 타당 | 전환 실패는 reject → `TASK_BACKGROUND_FAILED` → 버튼 복구 + 사유 줄. `false` 반환도 throw 로 접는다(`chat-turn/index.ts:212`) |
| false success 가능성 | **있다 — 검증 층에서** | 세 seam(레지스트리·coordinator·main 핸들러)이 통째로 사라져도 게이트가 전건 초록이다(§4 MV-1·MV-3) |
| partial failure/rollback | 해당 없음 | DB 마이그레이션 0 · 파일 쓰기 0 · 상태는 전부 프로세스 내 메모리 |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 아니오 | §5 상태표 14행이 코드 분기와 1:1 대응한다 |
| 증상만 제거하고 상태가 남았는가 | 아니오 | `settleTaskSubset` 이 id별 `tracker.settled` 를 부른다 — 추적 잔여 0 |
| 최적화가 잃은 관측 | 없음 | 새 캐시·스냅샷 0 |
| 출력/요청 worst-case 상한 | 무증가 | 신규 요청 0(전부 수신 방향) · `toolUseIds` 는 집합 연산에만 쓰인다 |
| `settleTrackedTasks` 동작 변화 | 무해 | 루프가 id별 `settled()` 를 추가로 부른다 — `waitForTask` 가 더 일찍 풀릴 뿐 정착 쌍/순서는 같다 |

## 3. 역방향 탐색

`scan-surface.sh` 는 이 환경에 `rg` 가 없어 실행되지 않았다(`rg(ripgrep) 가 필요합니다`). 대신 신규 export 14종을 `grep -rn … --include=*.ts --include=*.tsx | grep -v '\.test\.'` 로 전수 대조했다.

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export | **0건** | 14종 전부 production 참조 ≥1 |
| `resetLevel` | 정상 | production 호출자는 같은 클래스의 `clear` 1곳 — 주석이 그 설계를 적는다 |
| 테스트 전용 참조 | 0건 | `TaskToolBody`·`isTaskListToolName` 도 `registry.ts` 참조를 갖는다(다만 그 참조를 지켜보는 테스트가 없다 — D1) |
| 형제 정책 비대칭 | **해소** | `backgroundMetaLine` 의 `aborted`/`failed` 두 분기가 이제 같은 규칙(생산자 문장 우선)을 쓴다 |
| 신규 등록값의 기존 소비처 | 무영향 | `subagent.backgroundSet` 을 store 가 명시적으로 무시한다(`chatStore.ts:562`) — 미처리 variant 폴백이 아니라 선언된 무시다 |
| producer ↔ consumer 파생 불일치 | 없음 | `cause` 를 생산(`subagent-settlement.ts`)·소비(`parts.ts settlementMessageFromCall`) 양쪽에서 확인 |
| 동일 규칙 중복 구현 | SSOT 유지 | 도구 이름 리터럴은 `task-tool.ts` 1곳 · 표시 상태는 `backgroundBoardStatus` 1곳 |
| 죽은 i18n 키 | **1건** | `chat.taskTool.fetched`(ko·en) 소비처 0 — D8 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트 케이스 실제 존재: `stop-subagent.test.ts` **9케이스** 실재하고 전건 green(AT-17·R-92 회귀 대상).
- structural proxy 만으로 semantic 목표를 통과시킨 AC: **3건** — AC14·AC22·AC25(§5).
- **선택된 적대 증거 재측정**: 구현 보고의 표 행 4건(M1·M2·M11·M13)을 **검증자가 다시 심어** 전건 red 를 재현했다. 미검출 0 · 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1 이라 해당 없음 — 덮개 회귀 판정 불가.
- **자기검증 분모**: 구현자 = 검증자다. 보고에 없던 축 **3건**(MV-1 레지스트리 배선 소거 · MV-2 같은 지점의 술어 확장 · MV-3 coordinator 조인 소거)을 만들었고 **셋 다 green** 이었다.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 — `agentItem` 의 `title`↔`subject` 맞바꿈 | `vitest run src/renderer/src/features/chat` | 해당 없음 | **RED 3** | VP-03·VP-04 등록 변이 |
| M2 — `canStopBackgroundStatus` 에서 `paused` 항 제거 | 같은 스위트 | 해당 없음 | **RED 4** | VP-15 등록 변이 |
| M11 — `check-doc-inventory.mjs` 진입 가드를 깨진 형태로 복원 | `node --test scripts/check-doc-inventory.test.mjs` | 해당 없음 | **RED 1** | 이번 턴 신설 배선 oracle |
| M13 — `stopped` 정착에서 `cause` 제거 | `vitest run src/main/features/chat` | 해당 없음 | **RED 1** | 이번 턴 신설 배선 oracle |
| **MV-1** — `registry.ts` 의 `task_list` 등록 블록 **전체 삭제** | 전체(`src/shared src/renderer src/main`) | — | **GREEN 277파일 2779케이스** | 검증자 신설 축 → D1 |
| **MV-2** — 같은 지점의 match 를 `isTaskToolName`(6종)으로 확장 | `task-tool` + transcript + rightpanel | — | **GREEN 6파일 87케이스** | 검증자 신설 축 → D1 |
| **MV-3** — `turn-coordinator.ts` 의 `subagent.backgroundSet` 블록 **전체 삭제** | `src/main src/renderer/src/features/chat` | — | **GREEN 229파일 2410케이스** | 검증자 신설 축 → D2 |

- 동작 보존 추출 라운드인가: 아니오 — 신규 기능 추가다.
- **소거 변이의 잔여물 수렴**: MV-1 은 미사용 import 2개까지 치워 **typecheck 3구성 0진단 · eslint 0출력**에서 green 을 얻었다. MV-3 도 미사용 import 를 치워 **typecheck 0진단 · eslint 0 error(prettier warning 1건만)** 에서 green 이었다 — 두 변이 모두 잔여물이 만든 red 가 아니다.
- 형제 슬롯 맞바꿈 변이: M1(`title`↔`subject`) 1쌍, RED 3 로 검출.
- `N회` 기준의 실제 관측 주체: AT-25 의 "1회" 는 `harness.backgroundSubagent`(renderer 경계)에서만 관측된다 — 계약이 지정한 `backgroundTask(toolUseId)` 포트에서는 관측되지 않는다(D3).
- 순서 기준의 관측 훅: AT-15 의 첫 payload 순번은 `background-tasks.test.ts` 가 tracker 에 직접 순차 주입해 관측한다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-05 | MD-01 ↔ AT-09 / UT | REQUIRED | **PASS** | `task-tool.test.ts` 별칭 케이스 | args → `readCreate`/`readUpdate` / EP-03 2/2 |
| VP-06 | R-03 ↔ AT-10·11·12 / UT | REQUIRED | **PASS** | `taskBoard.test.ts` 4케이스 | fold → `blockedBy` / EP-04 1/1 |
| VP-07 | MD-90 ↔ AT-13 / UT | REGRESSION | **PASS** | `taskBoard.test.ts` 스냅샷 케이스 | `TaskList` → 전체 교체 / EP-04 1/1 |
| VP-14 | R-90 ↔ 0204 AT-10a / UT | REGRESSION | **PASS** | `taskBoard.test.ts` 순서 단언 green | 같은 fold / EP-04 1/1 |
| VP-03 | R-02 ↔ AT-05·06·07 / UT | REQUIRED | **PASS** | M1 → RED 3 | fold → `title` / EP-03·EP-05 2/2 |
| VP-20 | MD-04 ↔ AT-23·24 / UT | REQUIRED | **PASS** | `taskBoard.test.ts` 술어 4케이스 | 순수 반환 / EP-13 1/1 |
| VP-01 | R-01 ↔ AT-01·02·03 / AT | REQUIRED | **PASS** | 렌더 5케이스 + `claude-map.test.ts` 4케이스 | init → 빈 상태 / EP-01·EP-02 2/2 |
| VP-02 | SD-01 ↔ AT-04 / ST | REQUIRED | **PASS** | `chatReducer.task.test.ts` 3케이스 | 2차 `session.updated` / EP-02 1/1 |
| VP-04 | MD-03 ↔ AT-08 / UT | REQUIRED | **PASS** | M1 → RED 3(같은 변이가 두 pair 를 잡는다) | store → `aria-label` / EP-05 1/1 |
| VP-09 | AR-02 ↔ AT-16 / IT | REQUIRED | **PASS** | `claude-map.test.ts` 매핑 4케이스 | `task_id` → `toolUseIds` / EP-06 1/1 |
| VP-10 | R-91 ↔ AT-17 / ST | REGRESSION | **PASS** | `stop-subagent.test.ts` 9케이스 green, 파일 무변경 | watchdog 정착 / EP-08 0/0 |
| VP-11 | R-05 ↔ AT-18·19 / AT | REQUIRED | **PASS** | 렌더 두 타일 각각 + M2 → RED 4 | `task_updated` → 두 타일 / EP-09·EP-10 2/2 |
| VP-12 | AR-03 ↔ AT-20·21 / IT | REQUIRED | **PASS**(gap 동반) | `claude-map.test.ts` + M13 → RED 1 + 렌더 2케이스 | 정규화 → 정착 → 행 / EP-09 1/1 |
| VP-15 | SD-03 ↔ AT-18·19 / ST | REQUIRED | **PASS** | M2 → RED 4 | `paused` 진입/이탈 / EP-10 1/1 |
| VP-16 | R-07 ↔ AT-23·24 / AT | REQUIRED | **PASS** | 렌더 두 타일 각각 6케이스 | 관측 → 술어 → 버튼 / EP-12·EP-13 2/2 |
| VP-18 | SD-04 ↔ AT-26 / ST | REQUIRED | **PASS** | `chatStore.subagentControl.test.ts` reject 케이스 | reject → 복구 / EP-14 1/1 |
| VP-19 | R-92 ↔ 중단 실패 복구 / ST | REGRESSION | **PASS** | `stop-subagent.test.ts` 복구 2케이스 green | throw → 되돌림 / EP-08 0/0 |
| **VP-08** | R-04 ↔ AT-14·15 / IT | REQUIRED | **PAIR_FAIL** | MV-3 green — 조인 삭제에 침묵 | coordinator 구간 미도달 / EP-06·EP-07 **1/2 잠김** |
| **VP-13** | R-06 ↔ AT-22 / AT | REQUIRED | **PAIR_FAIL** | MV-1·MV-2 green — 등록 삭제·6종 확장에 침묵 | `registry.ts` match 미도달 / EP-11 **1/2 잠김** |
| **VP-17** | AR-04 ↔ AT-25 / IT | REQUIRED | **PAIR_FAIL** | 포트 호출을 관측하는 테스트 0건 | `session-runtime → backgroundTask` 미도달 / EP-14 **1/2 잠김** |

- root `PAIR_FAIL`: **VP-08 · VP-13 · VP-17** — 셋은 독립 지점이라 서로 종속이 아니다.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair: M1 이 VP-03·VP-04 를, M2 가 VP-11·VP-15 를 함께 잡는다 — 각 pair 의 판정 범위는 자기 oracle 로 따로 확인했다.
- 이번 라운드 실행 범위: **최초 검증** — 유효 V의 REQUIRED 16 + REGRESSION 4 전건 + 운영 gate 5종.

### AT / AC 세부와 합계

| AT / AC | 결과 | 검증 증거 |
|---|---|---|
| AT-01 / AC1 | ✅ | 렌더 — `agentTools:['TaskCreate','Bash']` → 안내 부재 + 빈 상태 문구 존재 |
| AT-02 / AC2 | ✅ | 렌더 — 안내 문구 + `2.1.100` 동시 존재 |
| AT-03 / AC3 | ✅ | 렌더 `agentTools:null` + `claude-map.test.ts` "tools 부재는 키를 싣지 않는다" |
| AT-04 / AC4 | ✅ | reducer — `{model}` patch 후 `agentTools` 보존 |
| AT-05 / AC5 | ✅ | `taskBoard.test.ts` + M1 RED |
| AT-06 / AC6 | ✅ | `taskBoard.test.ts` completed → subject |
| AT-07 / AC7 | ✅ | `taskBoard.test.ts` activeForm 부재 |
| AT-08 / AC8 | ✅ | 렌더 `aria-label="테스트 작성 상세 보기"` + M1 RED |
| AT-09 / AC9 | ✅ | `task-tool.test.ts` `active_form` 별칭 |
| AT-10 / AC10 | ✅ | `taskBoard.test.ts` 역방향 가산 |
| AT-11 / AC11 | ✅ | `taskBoard.test.ts` 유령 행 방지 |
| AT-12 / AC12 | ✅ | `taskBoard.test.ts` 자기 간선 |
| AT-13 / AC13 | ✅ | `taskBoard.test.ts` 스냅샷 교체 |
| AT-14 / AC14 | **❌** | 정착을 관측하는 테스트 0건 — MV-3 로 조인을 지워도 2410케이스 green |
| AT-15 / AC15 | ⚠️ | `background-tasks.test.ts` 가 tracker 반환만 잠근다 — 소비자 배선은 D2 와 같은 root |
| AT-16 / AC16 | ✅ | `claude-map.test.ts` 미매핑 드롭 |
| AT-17 / AC17 | ✅ | `stop-subagent.test.ts` 9케이스 green, 파일 무변경 |
| AT-18 / AC18 | ✅ | 렌더 두 타일 + M2 RED 4 |
| AT-19 / AC19 | ✅ | 렌더 — 해제 후 `animate-spin` 복귀 + 버튼 존치 |
| AT-20 / AC20 | ✅ | `claude-map.test.ts` `killed`→`stopped` |
| AT-21 / AC21 | ✅ | `subagent-settlement.test.ts` 3케이스 + M13 RED + 렌더 2케이스 (**규범 행 부재 — D4**) |
| AT-22 / AC22 | **❌** | `TaskToolBody` 를 직접 부르는 렌더 테스트뿐 — 레지스트리 경유·6종 대조 단언 0건, MV-1·MV-2 green |
| AT-23 / AC23 | ✅ | 렌더 두 타일 전환 버튼 존재 |
| AT-24 / AC24 | ✅ | 렌더 두 타일 — 버튼 부재 + 중단 버튼 존재(양성 항) |
| AT-25 / AC25 | **❌** | renderer hop 만 관측 — `backgroundTask(toolUseId)` 포트 호출 단언 0건(D3) |
| AT-26 / AC26 | ✅ | `chatStore.subagentControl.test.ts` reject → 표식 복구 + 사유 |

- **합계 재측정**: `✅ 22 · ⚠️ 1 · ❌ 3 = 총 26`(분모 = §7 AC1~AC26, 직접 셈). 자기보고는 `✅25 · ⚠️1 · ❌0` — **불일치 3건**(AC14·AC22·AC25).
- **합계 사본 대조**: 본문 22 ↔ 커밋 trailer `Criteria-Met: 25/26`(두 커밋 동일) ↔ INDEX 비고 `✅25 ⚠️1 ❌0` — **자기보고 3사본은 서로 일치**하고 검증 재측정과 갈린다.

### pair별 plan §10 강제 지점 분모

| Pair | 계약 | plan 이 적은 지점 | 코드에서 확인 | 잠금 확인 | 결과 |
|---|---|---|---|---|---|
| VP-01·02 | `agentTools` 부재/병합 | EP-01·EP-02 (2) | 2/2 | 2/2 | PASS |
| VP-05 | `activeForm` 입력 전용+별칭 | EP-03 (1) | 2/2 사이트 | 2/2 | PASS |
| VP-06·07·14 | 역방향 가산 규칙 | EP-04 (1) | 1/1 | 1/1 | PASS |
| VP-03·04 | `title`/`subject` 분리 | EP-05 (1) | `agentItem` 1 + aria 사이트 **4**(신규 2 포함) | 4/4 | PASS |
| VP-08·09 | 매핑분만 싣기 / 첫 payload 기준선 | EP-06·EP-07 (2) | 2/2 | **1/2** — coordinator 조인 미잠금 | **PAIR_FAIL** |
| VP-10·19 | watchdog 불변 | EP-08 (1) | 0/0(무변경이 계약) | 0/0 | PASS |
| VP-11·12 | `killed`/`paused` 정규화 | EP-09 (1) | 1/1 | 1/1 | PASS |
| VP-11·15 | `paused` 중단 허용, 두 타일 | EP-10 (1) | 술어 1 + 도달 **3**(227·364·313) | 3/3 | PASS |
| VP-13 | 4종 부분집합 SSOT | EP-11 (1) | 상수 1 + 레지스트리 match 1 = 2 | **1/2** — match 미잠금 | **PAIR_FAIL** |
| VP-16·17 | 전환 버튼 두 타일 | EP-12 (1) | 3/3 | 3/3 | PASS |
| VP-16·20 | 전환 술어 3조건 | EP-13 (1) | 1/1 | 1/1 | PASS |
| VP-17·18 | 단건 전환·실패 비삼킴 | EP-14 (1) | 핸들러 1 + store 액션 1 = 2 | **1/2** — 핸들러 미잠금 | **PAIR_FAIL** |

- **강제 지점 전수 재측정**: EP-01~EP-14 **14/14 가 코드에 존재**한다(구현자 보고와 일치). 그 중 **11 지점만 잠금이 있다** — 코드 존재와 잠금을 가른 것이 이번 판정의 축이다.
- 표에 없는데 같은 불변식이 필요한 지점: 구현자가 2건(`subagent-settlement` 의 `stopped` 분기 · `backgroundMetaLine` 의 `aborted` 분기)을 찾아 닫았다 — 검증자도 재확인했고, 그 계약의 규범 행이 없는 것이 D4 다.
- `실패 의미` 가 "다른 게이트가 막는다" 인 행: **0건**(plan §10 이 스스로 그렇게 적었고 실제로 없다).

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| `npm run typecheck`(node·web·test) | **PASS** | exit 0 · 진단 출력 **0줄** |
| `npm run lint` | **PASS** | **0 error / 1 warning** — 기존분 `useTranscriptVirtualizer.ts:22` |
| `vitest run src/shared src/renderer src/main` | **PASS** | **277파일 2779케이스 전건 pass** |
| `node --test scripts/*.test.mjs` | **PASS** | **61 pass / 0 fail** (8 suites) |
| `node scripts/check-doc-inventory.mjs --check` | **PASS** | `generated doc ok (9 items, 80 channels)` · `prose ok` · `links ok` |
| `docs/IPC_CONTRACT.md` 동커밋 갱신 | **PASS** | 신규 채널 1행 + `session.updated`·`subagent.task` 확장 + `subagent.backgroundSet` 신규 행 |

> 게이트는 전건 PASS 다. **FAIL 판정은 gate 가 아니라 pair 에서 나온다** — 게이트 초록이 세 seam 의 무잠금을 가린 것이 이번 라운드의 사실이다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| SDK `init.tools` / `claude_code_version` | `asStringList` 가 비문자열 원소 섞이면 전체 폐기 | `undefined`=판정 불가 · 미포함=기능 없음 — AC3·AC2 가 각각 잠금 | PASS |
| SDK `task_updated.patch` | 6종 status 를 3갈래로 분기 | `completed·failed·pending` 은 정착 안 함 — 케이스 존재 | PASS |
| SDK `background_tasks_changed.tasks` | 배열 아니면 드롭, 빈 배열은 유효 레벨 | 첫 payload 기준선 — tracker 케이스 존재 | PASS |
| `chatBackgroundSubagent` wire | `BackgroundSubagentSchema` zod 2필드 | `false` → reject — **핸들러를 부르는 테스트 0건** | **PAIR_FAIL**(D3) |

## 7. 숫자 / 음성 기준 / 상한 재측정

- **변경 파일 수**: 실측 **41**(`docs/handoff/**` 2 제외, 총 43). 자기보고 **40** — 불일치.
- **내역 합**: 실측 main **10** · renderer **17** · shared 4 · preload 1 · scripts 6 · docs 3 = **41**. 자기보고 내역(main 8 · renderer 13 · shared 4 · preload 1 · scripts 6 · docs 3 · 신규 3)은 합이 38 로 자기 총계 40 과도 맞지 않는다.
- 신규 파일: **3** — 자기보고와 일치(`taskSurface0212.render.test.ts` · `TaskToolBody.tsx` · `chatStore.subagentControl.test.ts`).
- 0건 게이트의 정당한 예외 보존: `check-doc-inventory --check` 는 이번 변경분(79→80 채널 · 21→22 variant)만 반영했고 기존 항목을 지우지 않았다.
- 출력/요청 상한: 신규 요청 **0** — 이번 변경은 전부 수신 방향이다.
- **P2 oracle 엄격화**: "출력이 비어 있지 않다" 를 "본문 로직에 도달했다" 로 한 단계 좁히면 차집합 **1/5** — `ensure-sqlite-abi.mjs --check` 는 target 인자가 없어 `parseArgs` 가 throw 하고 catch 분기만 출력한다. 가드 자체는 5/5 잠긴다(M11 로 확인) — D9.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| main 핸들러 `chatBackgroundSubagent` | 없음 | **없다 — 사람 실기 대상이 아니다** | `vi.mock('electron')` 로 `ipcMain.handle` 을 맵에 포획하는 선례가 **7건** 있고 그중 `src/main/app/chat-turn.runtime-tools.test.ts` 는 **같은 모듈**(`registerChatHandlers`)을 그 방식으로 이미 부른다 |
| `paused` 상태에서 `stopTask` 실제 거동 | 실패 경로(reject → 복구)는 잠김 | **SDK 실거동 1건** | 실제 CLI 로 `paused` 태스크를 중단해 SDK 가 수락하는지 관측(plan §17 미검증 가정) |

> plan §7 은 "사람 실기 항목 없음" 이었다. 위 두 번째 행은 plan §17 이 스스로 `미검증 가정 1건` 으로 적은 것이라 새 요구가 아니다.

## 9. 게이트 재실행

- 실제 실행 명령:
  - `npm run typecheck`
  - `node node_modules/vitest/vitest.mjs run src/shared src/renderer src/main`
  - `node --test scripts/*.test.mjs`
  - `node scripts/check-doc-inventory.mjs --check`
  - `npm run lint`
- **관측한 실행 산출**: typecheck 진단 **0줄** · vitest **277파일 2779케이스 pass** · scripts **61 pass 0 fail** · doc-inventory 3줄 ok · eslint **0 error 1 warning**.
- `npm test` 미사용 — DB 동작을 검증할 이유가 없어 `pretest` 의 ABI 전환을 일으키지 않았다(`app/AGENTS.md` 게이트 가이드).
- ABI 전환/egress 403: **발생 0**.
- **게이트가 작업 트리를 바꿨는가**: `npm run lint` 는 `--fix` 를 달고 있어 쓰기 가능하지만 실행 후 `git status --porcelain` 이 **비었다** — 검증자가 고친 코드를 검증자가 채점한 자리가 없다.
- **검증 중 실행한 명령이 남긴 잔여물**: 없음 — 변이 7건은 전부 `git checkout --` 로 되돌렸고 최종 `git status --porcelain` 이 비었다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트 | 에이전트 실행 — 산출을 §9 에 관측으로 적었다 |
| AC ↔ production path 1:1 | 에이전트 — 26행 전건 대조, 3건 불일치 |
| 레이어/계약/문서 형식·링크 | 에이전트 — `check-doc-inventory links ok` · 신규 핸들러가 `app/` 컴포지션 루트 안(기존 `chatStopSubagent` 와 같은 파일) |
| 제품 의도 / Open Question | **사람** — D4 의 `cause` 키를 지속 계약으로 승격할지(§13) |
| UI/UX 시각 품질 | 신규 레이아웃 0 — 시각 실기 없음 |
| 신규 의존성 / PR merge | 신규 의존성 **0**. PR 은 미개설 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 변경에 `AGENTS.md` 수정 **0건** — 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체: `impl / IMPL_DONE (V1 r1) / Claude(r1 검증)` — 실제 상태와 일치했다.
- 「다음 주체」 칸이 주체 하나만 담는가: 예.
- **대상 커밋 좌표 기입(검증자 몫)**: 자리표시자 `(r1 구현 — 검증자 기입)` 를 `4a64a8ab`·`73e29690` 으로 채웠다. `git cat-file -t` 로 둘 다 `commit` 확인.
- **비고 5줄 이내**: **위반** — r1 구현자 비고가 **924자**(≈110자 기준 10줄)였다. 이번 턴에 5줄 이내로 교체했다 — D5.
- PASS 시 archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Handoff:` · `Status: implemented` · `Criteria-Met` · `Criteria-Pending` · `Verified-By: pending` — root `AGENTS.md` 표와 일치.
- **trailer 실제 파싱**: `git log -1 --format='%(trailers:only=true)' 4a64a8ab` → **6키 반환**, `73e29690` → **5키 반환**. 0건 없음.
- 인용된 커밋 해시 실재: `4a64a8ab`·`73e29690`·`cc69700f`·`e38f545e` 전건 `commit`.
- **`[구현자 기입]` 필드 전수**: 7필드(설계 리뷰 · 강제 지점 전수 · V-pair 자기확인 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals) **전부 표 형태로 존재**. 산문으로 접힌 필드 0.
- 이동/삭제한 reference·script: 0건.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| P1 — AC21 ↔ 0204 AT-31 충돌을 `cause` 키 분리로 해소, "규범 승격 필요" | **타당하고 필요하다.** 0204 D11 이 같은 자리를 `open` 으로 남기며 **"규범 정정이 선행"** 이라 적었다(0204 plan:1226) | **PLAN_GAP D4** — 설계자가 §10 행 + V node 를 만든다 |
| P2 — CLI 5종 진입 가드가 Windows 에서 본문을 안 돌린다, 선조치 | **타당하고 존치한다.** `check-doc-inventory` 는 plan §7-A 가 이번 변경의 필수 gate 로 지정했고, 그 게이트가 실제로 돌기 전에는 인벤토리 PASS 가 무의미했다. 5개는 같은 한 줄의 사본이라 함께 고치는 것이 옳다 | 존치 · 오라클 강화는 D9 |
| P3 — 레벨 REPLACE 정착 문구가 §5 상태 전이표에 행이 없다 | 타당 | D4 와 같은 설계 턴에서 함께 처리 |
| P4 — `errorMessage` 를 wire 에서 제거, `is_backgrounded` 는 소비자 신설 | 타당 — 죽은 표면을 만들지 않았고 소비처를 확인했다 | 기록 |
| 설계 대비 차이 ③ — `RenderableKind` 에 `task_list` 신설 + `rendering.md §1.6` 갱신 | 타당 — taxonomy 정본을 같이 고쳤다 | 기록 |
| AC25 ⚠️ 사유 "저장소에 `vi.mock('electron')` 선례 0건" | **사실이 아니다** — 7건이 실재하고 그중 하나는 같은 `registerChatHandlers` 를 그 방식으로 부른다 | **D3** — 사람 실기가 아니라 미작성이다 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | 전용 본문이 **레지스트리를 경유해** 붙는지 보는 단언이 0건이다. 등록 블록을 통째로 지워도 277파일 2779케이스·typecheck·eslint 가 전부 초록(MV-1)이고, match 를 6종으로 넓혀 `TaskOutput`/`TaskStop` 이 빈 전용 본문을 받게 해도 초록이다(MV-2) — EP-11 이 금지한 바로 그 상태다. AC22 의 "6종 전량 대조" 단언은 어디에도 없다 | VP-13 · AC22 · §10 EP-11 | **BLOCKING** | root VP-13 | 구현 — `registry.test.ts` 에 `TaskCreate/TaskGet/TaskUpdate/TaskList → task_list` 와 `TaskOutput/TaskStop → generic` 을 넣는다 |
| D2 | 레벨 신호가 **정착을 일으키는지** 보는 단언이 0건이다. `turn-coordinator.ts` 의 `subagent.backgroundSet` 블록을 통째로 지워도 229파일 2410케이스가 초록(MV-3)이다. `applyLiveSet` 은 판정만 하고 정착은 호출부가 하는데 그 호출부가 잠기지 않았다 — AT-14 의 "빠진 항목이 정착 상태" 가 미관측이다 | VP-08 · AC14 · §10 EP-06·EP-07 | **BLOCKING** | root VP-08 | 구현 — `turn-coordinator.test.ts` 에 두 payload 주입 후 `settleTaskSubset` 대상·`stopLive:false` 를 단언 |
| D3 | 전환 요청이 **포트까지** 가는지 보는 단언이 0건이다. AT-25 의 oracle 은 `backgroundTask(toolUseId)` 호출의 인자와 횟수인데 관측은 renderer 경계에서 끝난다. 구현자가 든 사유("`vi.mock('electron')` 선례 0건")는 거짓이다 — 선례 7건, 그중 `chat-turn.runtime-tools.test.ts` 가 같은 `registerChatHandlers` 를 그 방식으로 부른다 | VP-17 · AC25 · §10 EP-14 | **BLOCKING** | root VP-17 | 구현 — 같은 하네스로 핸들러를 불러 `turn.live.backgroundTask('use1')` 1회와 `false`→reject 를 단언 |
| D4 | 중단 정착의 사유를 어느 키가 나르는지에 **규범 행이 없다.** AC21(`patch.error` 가 사유로 보인다)과 상속 계약 0204 AT-31(중단 행은 `사용자에 의해 중단됨`)이 정착 `message` 한 자리를 두고 반대를 요구했고, 구현자가 `cause` 키를 **발명해** 둘을 성립시켰다. 0204 D11 이 같은 자리를 `open` 으로 두며 "D-024 가 `aborted` 분기를 정본으로 삼았으므로 규범 정정이 선행" 이라 적었다 | VP-12 · AC21 · 0204 D-024/D11 | **PLAN_GAP** | 영향 VP-12 | **설계자** — Decision 신설 + §10 행(`cause`=SDK 사유 / `message`=UI 기본) + P3 의 레벨 REPLACE 문구를 §5 상태표에 추가 |
| D5 | INDEX r1 비고가 **924자(≈10줄)** 로 5줄 상한을 넘었다 | `docs/handoff/AGENTS.md §산출물 문장 규칙 3` | NON_BLOCKING | — | 이번 턴에 검증자가 5줄로 교체 — 처리 완료 |
| D6 | 구현 보고의 변경 파일 수가 실측과 갈린다 — 보고 40, 실측 **41**. 내역도 main 8↔**10** · renderer 13↔**17** 이고 보고 내역 합(38)이 보고 총계(40)와도 맞지 않는다 | 구현 보고 정확도 | NON_BLOCKING | — | 다음 라운드 보고에서 정정 |
| D7 | §10 대조표 EP-10 행이 "도달 경로 **2**" 라 쓰고 같은 칸이 좌표 **3개**를 연다. 좌표도 변경 전 줄번호다(182·289·258 → 실제 227·364·313) | 구현 보고 정확도 | NON_BLOCKING | — | 다음 라운드 보고에서 정정 |
| D8 | `chat.taskTool.fetched`(ko·en)의 소비처가 0이다 — `KIND_KEY` 는 `created·upserted·removed·snapshot` 4키만 쓴다 | 죽은 표면 | NON_BLOCKING | — | 제거하거나 `TaskGet` 본문에 소비처를 만든다 |
| D9 | P2 의 신설 oracle 은 "출력이 비어 있지 않다" 다. `ensure-sqlite-abi.mjs --check` 는 target 인자가 없어 `parseArgs` 가 throw 하고 catch 만 출력하므로, 그 스크립트에 대해서는 `runCli` 본문이 깨져도 통과한다(5중 1) | 이번 턴 신설 oracle | NON_BLOCKING | — | 스크립트별로 유효 인자를 주거나 기대 출력 접두(`[sqlite-abi]`)를 단언 |
| D10 | P2 가 0212 범위 밖 스크립트 4종(`check-migrations-appendonly`·`validate-release-version`·`validate-dist`·`ensure-sqlite-abi`)을 함께 고쳤다 | 범위 | NON_BLOCKING(존치 판정) | — | 별도 handoff 로 빼지 않는다 — 5개가 같은 한 줄의 사본이고 그중 하나가 이번 변경의 필수 gate 다 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: r1 이라 이전 라운드 없음. 다만 **0204 D11 이 `open` 으로 남긴 자리를 0212 가 규범 행 없이 닫았다** — 두 handoff 에 걸친 같은 축이다.
- 관련 plan 지침/AC 의 존재 여부: **있었다.** VP-08·VP-13·VP-17 은 셋 다 `production path` 칸에 미도달 구간(coordinator · registry match · session-runtime)을 명시했고, plan §7 은 AT-22 에 "6종 전량 대조", AT-25 에 "그 id 로 1회" 를 적었다. 규범이 빠진 것이 아니라 증거가 그 지점에 닿지 않았다.
- 사용자 결정 변경 근거: 없음 — ACTIVE Decision 25건 전건 유지, SUPERSEDED 0.
- 반복된 검증 환경 한계: `rg` 부재로 `scan-surface.sh` 미실행(수동 grep 으로 대체) · `.bin/vitest` shim 이 Win32 실행 파일이 아니라 `node node_modules/vitest/vitest.mjs` 로 호출.

## 15. 결론

- 상태: **FAIL + PLAN_GAP → `verify/RETURN_TO_PLAN`**. 다음 주체는 **설계자**다(`docs/handoff/AGENTS.md` — FAIL 과 PLAN_GAP 이 함께 있으면 planner 가 먼저다).
- pair 결과: REQUIRED/REGRESSION **PASS 17** · root **PAIR_FAIL 3**(VP-08·VP-13·VP-17) · BLOCKED_BY 0.
- PLAN_GAP: **D4** — 중단 사유의 키 분리에 Decision·§10 행·V node 가 없다. 영향 pair VP-12.
- Product/UX 및 ACTIVE Decision 충족: D-001~D-025 중 **충돌 0**. 구현이 Decision 을 어긴 자리는 없다 — 못 미친 것은 증거다.
- AC 충족: **✅22 · ⚠️1 · ❌3 / 26**(자기보고 ✅25 ⚠️1 ❌0 과 3건 불일치).
- 현재 변경 운영 gate: **6종 전건 PASS**(typecheck 0진단 · lint 0 error · vitest 277/2779 · scripts 61/61 · doc-inventory ok · IPC_CONTRACT 동커밋).
- NON_BLOCKING: D5(처리 완료) · D6 · D7 · D8 · D9 · D10. NEXT_HANDOFF: 없음.
- repository operation checks: trailer 파싱 6키/5키 정상 · 인용 해시 4건 실재 · `[구현자 기입]` 7필드 전수 · INDEX 비고 상한 위반을 이번 턴에 교정 · 대상 커밋 좌표 기입 완료.
- 남은 사람 확인: `paused` 상태의 `stopTask` SDK 실거동 1건(plan §17 이 스스로 적은 미검증 가정).
- 다음 단계: **설계자가 D4 의 규범 행을 새 Delta V 로 정정해 `plan/READY` 로 돌린 뒤**, 구현자가 D1·D2·D3 의 세 seam 에 오라클을 만든다. 코드 수정은 필요하지 않을 수 있다 — 세 finding 은 전부 "동작이 틀렸다" 가 아니라 "그 지점을 보는 눈이 없다" 다.
