# Verify — 0204-taskxxx-right-panel

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
>
> **라운드별로 누적한다.** 아래 절은 각 검증 턴의 판정 원문이고, 이전 라운드는 재서술하지 않는다.
> 현재 상태는 [`INDEX.md`](../INDEX.md) 가 갖는다.

| 라운드 | 상태 | 요지 |
|---|---|---|
| r1 | **FAIL** | 채널 종료 정착이 `실패` 가 아니라 `중단됨` 으로 읽힌다(AC21) |
| r3 | **FAIL** | 추출한 순수 View 3종의 래퍼→View 배선이 무관측 — 지워도 전 스위트 초록 |
| r4 | **FAIL** | 배선 삭제는 잠겼으나 `진행 상황`↔`출력` 본문 맞바꿈이 무음 — 섹션 자리가 무관측 |

> r2 는 독립 verify 턴 없이 r3 에 합류했다 — ΔV1(r2)·ΔV2(r3) 구현이 연속으로 들어와 한 번에 검증했다. 대상 range 는 `a6dcfc8..4b3310b` 이다.

---

## Verify r1 (2026-08-27) — FAIL

> 이 절은 r1 판정 **원문**이다. 재서술하지 않고 그대로 둔다.

### 메타

| 항목 | 값 |
|---|---|
| slug | `0204-taskxxx-right-panel` |
| 검증자 | Claude Code |
| 일자 | 2026-08-27 |
| 대상 커밋/range | `72766d2..c3bb0d1` |
| 구현 전 plan 기준 | `72766d2` |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `72766d2:V1` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **예 — 설계·구현·검증이 같은 에이전트다.** 기준선은 커밋 분리로 성립한다(아래 §0) |

### 판정

**FAIL.** REQUIRED pair 19 중 **VP-08 이 PAIR_FAIL** 이다 — 채널 종료로 정착한 background 작업이 `실패` 가 아니라 `중단됨` 그룹에 들어가고, 행 문구가 **`사용자에 의해 중단됨`** 이라 원인을 거짓 진술한다(AC21 위반). 나머지 18 pair 와 gate 4종은 PASS, PLAN_GAP 0. 다음 주체는 구현자다.

---

### 0. 기준선 / plan 변경 확인

**기준선 성립.** 설계 커밋(`d54f074`·`72766d2`)과 구현 커밋(`c3bb0d1`)이 분리돼 있어 §0 의 자기 증명 방지가 작동한다.

- 규범 구간(Part I·II 전체, `[구현자 기입]` 직전까지) `diff norm_before norm_after` → **0줄**. Decision·AC·V node/pair·§10 이 구현 중에 바뀌지 않았다.
- 구현 커밋의 `plan.md` 변경은 전부 `[구현자 기입]` 8개 섹션이다.
- D-012 → D-014(구현 주체 Codex→Claude) 는 **구현 전** 별도 설계 커밋(`72766d2`)이고 사용자의 `/handoff-impl` 명시 호출이 근거다. AC·V 는 불변.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 기준 V `none` — 0136/0143 은 V 규약 이전이라 상속할 node 없음 |
| NEW node ↔ 같은 레벨 REQUIRED pair | 유효 | R 10 · SD 3 · AR 3 · MD 3 전부 pair 보유, 누락 0 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | Baseline 이라 INHERITED 없음 |
| pair별 path·§10 전수·직접 oracle | 유효 | 19 pair 전부 3요소 보유 |
| 필요한 pair의 적대 증거·선택 이유 | 유효 | 0건 주장 pair(VP-06·VP-16)만 변이 등록, 나머지는 직접 oracle 근거 명시 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | 4종 열거, 무관한 기존 실패를 blocking 으로 올리지 않음 |

**PLAN_GAP 0.** D1 은 명시 AC(AC21) 위반이라 새 계약 발명 없이 닫힌다 — gap 이 아니라 pair 실패다.

### 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-002 main Task 스토어 없음 | 목록이 transcript 파생 | `taskBoard.ts` 가 `messages` 만 받는다 — 전역 참조 0건(§3) ✅ |
| D-003 단일 `작업` 타일 | 두 종류가 한 목록 | `tileRegistry.task` → `TaskTileContent` → `taskBoardGroups` ✅ |
| D-004 패널 내 표시만 | OS 알림 미변경 | 신규 5파일에 `notifyApi` 0건, `notifyShow` 게이트 무변경 ✅ |
| D-005 즉시 확정 금지 | 클릭 → `중단 중` | `stop-subagent.ts` 에 요청 시점 정착 없음 — 변이로 확인 ✅ |
| D-006 watchdog | 고착 없음 | `waitForTask` timeout → 합성 정착 ✅ |
| D-007 사용자 중단 통지 없음 | 자기 행위는 소음 | coordinator enrich 게이트 — 변이로 확인 ✅ |
| D-008 TaskList 전체 스냅샷 | 부재 id 제거 | fold snapshot 분기 ✅ |
| D-010 TaskOutput 의존 금지 | 목록 무영향 | 파서 `default → null` ✅ |
| D-013 skip_transcript 드롭 | 패널에도 안 뜸 | `mapTaskSystem` 무변경 ✅ |

### end-to-end 흐름

```text
SDK tool_result(tool_use_result)
  → claude-map(+structuredOutput, Task 6종 한정)   claude-map.ts:385
  → 버스 → writer(payload_json)  writer.ts:275  ∥  renderer reducer(파트)  chatReducer.ts:469
  → parts → taskBoardFromMessages
  → TaskTileContent 목록/상세 · ChatTitleBar 배지
```

**끊긴 곳 1**: 채널 종료 정착이 이 경로의 마지막 단계(`deriveSubagentTaskStatus`)에서 `failed` 가 아닌 `aborted` 로 읽힌다 — D1.

### 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 대체로 명시적 | 중단 요청 실패가 reject → 화면 사유. 구 코드는 무음 반환이었다 |
| false success 가능성 | **1건** | 채널 종료가 "사용자가 중단함" 으로 보인다 → D1 |
| partial failure/rollback | 안전 | 요청 실패 시 `stoppedSubagents`·`blockedSubagents` 롤백 확인(테스트) |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 1건 | 명세 §2 "실패 상태로 정착 + 실행 세션 종료" → 실제는 중단 상태 + 사용자 중단 문구(D1·D4) |
| 증상만 제거하고 상태가 남았는가 | 아니오 | 정착이 transcript 파트를 실제로 바꾼다 |
| 최적화가 잃은 재검증/취소/만료 관측 | 없음 | 새 캐시 0 · `useMemo` 의존성에 `stopping` 포함 확인 |
| 출력/요청 worst-case 상한 | 유계 | `structuredOutput` 은 Task 6종 한정, `TaskListOutput` 이 최대. 신규 네트워크 요청 0 |

### 3. 역방향 탐색

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `taskBoardSettledKeys` | **미배선 + SSOT drift** | 프로덕션 참조 0(자기 파일뿐). 게다가 판정 규칙이 실제 배지 경로(reducer)와 다르다 — 비귀속 → D2 |
| `isBackgroundTask` | **죽은 코드** | 프로덕션·테스트 참조 0 → D2 |
| `MARK_SETTLED_TASKS` 액션 | **도달 불가** | reducer case 존재, dispatch 0 → D2 |
| `TASK_STOP_SETTLED` 액션 | **도달 불가** | reducer case 존재, dispatch 0. 실제 해제는 `tool.call.completed` 가 한다 → D2 |
| `AGENT_TASK_STATUSES`·`requestLiveSubagentStop`·`taskBoardGroupOf` | 정상 | 자기 파일 내부에서 쓰인다(불필요한 `export` 뿐) |
| 형제 정책 비대칭 | **1건** | `backgroundMetaLine` 이 `aborted` 에는 사유를 붙이고 `failed` 에는 안 붙인다 → D4 |
| 신규 등록값의 기존 소비처 | 무영향 | `MOCK_SCENARIO_IDS` 13→14: DebugPanel 라벨맵·i18n 2파일 전수 갱신 확인(typecheck 가 강제) |
| producer ↔ consumer 파생 불일치 | **1건** | producer 는 `status:'failed'`, consumer 는 메시지 문자열로 `aborted` 판정 → D1 |
| 동일 규칙 중복 구현 | **1건** | "무엇이 종단 상태인가" 가 `taskBoardSettledKeys`(죽음)와 reducer(실제)에 다르게 산다 → D2 |

### 4. 기존 테스트 / semantic 검증 확인

- **구현 보고의 강제 지점 합계를 다시 셌다** — 행 관측은 전부 정확했으나 **합계가 틀렸다**: EP-07 을 3으로 세면 총합은 18 이 아니라 **19** 다(1+1+1+1+2+3+3+1+1+1+4). 행 축은 맞고 합계 축만 어긋난 전형적 형태 → D3.
- **등록된 적대 증거를 검증자가 직접 재실행했다**(구현자 보고와 무관하게):

| 변이 | 대상 | 재측정 결과 |
|---|---|---|
| enrich 의 `!turn.stoppedSubagents.has(...)` 삭제 | VP-16 | `1 failed / 32 passed` — 검출됨 |
| 요청 직후 합성 정착 복원(0143 회귀) | VP-06 | `3 failed / 6 passed` — 검출됨 |
| `isTaskToolName` 게이트를 참으로 | VP-14 | `1 failed / 56 passed` — 검출됨 |

- **구현자가 이번 라운드에 만든 0건 스윕을 한 단계 엄격하게 재측정했다**(§8):

| 스윕 | 구현자 기준 | 엄격화 기준 | 차집합 |
|---|---|---|---|
| AC25 raw 색 | 신규 tsx 2파일 hex | rightpanel 디렉토리 전체 + `taskBoard.ts`, `hex\|rgb(\|hsl(` | **0** |
| EP-11 타일 id 잔재 | `'subagent'` in renderer/src | `['\"]subagent['\"]` in `app/src` 전체 | **0** |
| EP-08 전역 미참조 | `taskBoard.ts` 직접 grep | 전이 import 4개를 따라가 store 도달 여부 | **0**(i18n 타입·shared·reducer 타입·parts 뿐) |

- 구현자 보고의 "설계 대비 차이"(중단 흐름을 `app/` → `features/chat/` 로 이동)를 축별로 재유도했다 — 공유 축(`stoppedSubagents` 를 lease 가 `clear` 한다)이 실제 실패 모드이고 롤백 테스트가 그것을 닫는다. 만료·재진입·무효화 축도 각각 근거가 있다. **타당 판정으로 닫지 않고 4축 전부 확인했다.**

### 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-17 | MD-01 ↔ UT-01 / UT | REQUIRED | PASS | `task-tool.test` 17 케이스 | 파서 / EP-01·02·03 (3/3) |
| VP-18 | MD-02 ↔ UT-02 / UT | REQUIRED | PASS | `taskBoard.test` 17 케이스 | fold / EP-04 (1/1) |
| VP-19 | MD-03 ↔ UT-03 / UT | REQUIRED | PASS | `background-tasks.test` waitForTask 6 케이스 | tracker / EP-09 (1/1) |
| VP-14 | AR-01 ↔ IT-01 / IT | REQUIRED | PASS | `claude-map.test` 3 케이스 + 변이 red | SDK→이벤트→파트 / EP-01 (1/1) |
| VP-15 | AR-02 ↔ IT-02 / IT | REQUIRED | PASS | 레지스트리 4지점 실측 + typecheck | tileRegistry→타일 / EP-11 (4/4) |
| VP-16 | AR-03 ↔ IT-03 / IT | REQUIRED | PASS | coordinator 음성+양성 짝, 변이 red | 핸들러→tracker→enrich / EP-06 (3/3) |
| VP-11 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | listen 경로 diff 0줄 + `post-turn.test` green | 턴-후 루프 / EP-05 (2/2) |
| VP-12 | SD-02 ↔ ST-02 / ST | REQUIRED | PASS | 확정·watchdog 두 종단 단언 | 중단 수명주기 / EP-06 (3/3) |
| VP-13 | SD-03 ↔ ST-03 / ST | REQUIRED | PASS | 라이브 파트→fold + payload + `dto.ts:52` spread | 영속·복원 / EP-07 (3/3) |
| VP-01 | R-01 ↔ AT-01/02 / AT | REQUIRED | PASS | 항목 0건/1건 단언 | AC1·AC2 |
| VP-02 | R-02 ↔ AT-03~06 / AT | REQUIRED | PASS | TaskUpdate 4 케이스 | AC3~AC6 |
| VP-03 | R-03 ↔ AT-07/08 / AT | REQUIRED | PASS | 스냅샷 차집합 단언 | AC7·AC8 |
| VP-04 | R-04 ↔ AT-09/10 / AT | REQUIRED | PASS | 그룹 배열 동등 | AC9·AC10 |
| VP-05 | R-05 ↔ AT-11 / AT | REQUIRED | PASS(⚠️ 실기 잔여) | 경로 무변경 | AC11 |
| VP-06 | R-06 ↔ AT-12~17 / AT | REQUIRED | PASS | `stop-subagent.test` 9 + 변이 2종 red | AC12~AC17 |
| VP-07 | R-07 ↔ AT-18/19 / AT | REQUIRED | PASS | reducer·writer 3층 | AC18·AC19 |
| **VP-08** | **R-08 ↔ AT-20/21 / AT** | **REQUIRED** | **PAIR_FAIL** | **재현 probe: 채널 종료 정착 → 패널 `aborted`(기대 `failed`)** | **AC21** |
| VP-09 | R-09 ↔ AT-22/23 / AT | REQUIRED | PASS | resolve 3케이스 + 0건 스윕 | AC22·AC23 |
| VP-10 | R-10 ↔ AT-24/25 / AT | REQUIRED | PASS(⚠️ 시각 실기) | `taskDetailRows` 2케이스 | AC24·AC25 |

**합계: PASS 18 · PAIR_FAIL 1 · BLOCKED_BY 0 · PLAN_GAP 0 / 19.**

### VP-08 재현

```text
settleTrackedTasks(status:'failed', summary:'채널이 종료되어 서브에이전트가 중단되었습니다.')
  → createSubagentSettlementEvents → { reason:'failed', message:'채널이 종료되어 … 중단되었습니다.' }
  → tool_result 파트
  → deriveSubagentTaskStatus → isAbortedResult(parts.ts:336 `message.includes('중단')`) = true
  → 패널 상태 'aborted'                              ← 기대 'failed'
```

원인은 `isAbortedResult` 가 **권위 필드 `reason` 보다 메시지 부분문자열을 우선**하는 것이다. 같은 충돌을 가진 프로덕션 지점은 **2곳**(전수): `settle.ts:26`(`reason:'failed'` + `'오류로 중단되었습니다'`) · `chat-turn/index.ts:68`(채널 종료 summary). 나머지 8개 `'중단'` 문자열은 `reason:'aborted'` 라 영향 없다.

### AT / AC 세부와 합계

| AT / AC | 결과 | 검증 증거 |
|---|---|---|
| AC1~AC10 | ✅ ×10 | `taskBoard.test` 17 케이스 · `task-tool.test` 17 케이스 |
| AC11 | ⚠️ | listen 경로 `git diff` **0줄** + 기존 스위트 green. 턴-후 실제 갱신은 사람 실기 |
| AC12~AC17 | ✅ ×6 | `stop-subagent.test` 9 · reducer 4 · coordinator 2 · 변이 2종 재현 |
| AC18·AC19 | ✅ ×2 | reducer 라이브 파트 → fold 동등 · writer payload · `dto.ts:52` 복원 |
| AC20 | ⚠️ | EP-08 구성상 성립(전역 참조 0). 2세션 전환은 사람 실기 |
| **AC21** | **❌** | **위 probe — `aborted` 관측, `failed` 기대. 행 문구도 `사용자에 의해 중단됨`(거짓)** |
| AC22~AC24 | ✅ ×3 | resolve 6케이스 · 관측 0건 · 상세 행 2케이스 |
| AC25 | ⚠️ | raw 색 0건(엄격화 후도 0). 시각 대조는 사람 실기 |

**합계 검산: `✅ 21 · ⚠️ 3 · ❌ 1 = 총 25`.** 분모 25 는 §7 표 행을 다시 세어 확인했다. 구현자 자기보고(`✅21 · ⚠️4 · ❌0`)와의 차이는 **AC21 하나** — 구현자는 "경로 무변경" 을 근거로 ⚠️ 로 뒀으나, 경로는 그대로여도 **새 소비자(작업 타일의 실패 그룹)가 그 결과를 다르게 읽는다**. 커밋 trailer `Criteria-Met: 21/25` 는 숫자로는 일치하나 구성이 다르다.

### pair별 plan §10 강제 지점 분모

| Pair | plan 이 적은 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| VP-01·14·17 | EP-01 (1) | `claude-map.ts:329` 게이트 (1/1) | PASS |
| VP-02·17 | EP-02 (1) | 파서 `success!==true → null` (1/1) | PASS |
| VP-03·17 | EP-03 (1) | fold snapshot 차집합 삭제 (1/1) | PASS |
| VP-04·18 | EP-04 (1) | `agent:` / `bg:` 접두 (1/1) | PASS |
| VP-05·11 | EP-05 (2) | `post-turn.ts:138` · `chatStore.ts:439` (2/2) | PASS |
| VP-06·12·16 | EP-06 (3) | 요청부 무정착 · `turn-coordinator.ts:264` · watchdog (3/3) | PASS |
| VP-07·13·14 | EP-07 (2) | **실측 3** — `claude-map.ts:385` · `writer.ts:275` · `chatReducer.ts:469` (3/3) | PASS(분모 정정) |
| VP-08 | EP-08 (1) | `taskBoard.ts` 전역 참조 0 (1/1) | PASS(지점) — pair 는 AC21 로 FAIL |
| VP-09·19 | EP-09 (1) | 구독 기반 대기, polling 0 (1/1) | PASS |
| VP-10 | EP-10 (1) | `taskDetailRows` kind 분기 (1/1) | PASS |
| VP-15 | EP-11 (4) | `rightPanelTiles.ts:7`·`tileRegistry.ts:8,22`·`chatReducer.ts:902`·i18n 2파일 (4/4) | PASS |

**강제 지점 합계: 19/19** (plan 표기 18 + EP-07 실측 +1). 미충족 0.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 / 범위 판정 |
|---|---|---|
| `npm run lint` | PASS | **0 error · 1 warning** — warning 은 `TranscriptVirtualizer` 의 `react-hooks/incompatible-library`(변경 무관, 기존) |
| `npm run typecheck` | PASS | 3구성 **출력 0줄** |
| vitest 전체 | PASS | **235파일 / 2413 케이스 통과, 실패 0**. 로드 실패 1파일 = `chat-turn.continuity.test.ts` — `git stash` 후 기준선에서 **동일 재현**, 환경 기인 |
| `check-doc-inventory --check` | PASS | `9 items, 79 channels` · prose ok · links ok. 채널 79 · variant 21 · 마이그레이션 17 **불변**(설계 예측과 일치) |

### 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| SDK `Task*Output` | `task-tool.ts` 가 SDK `sdk-tools.d.ts` 필드만 좁혀 읽음 | 성공/실패/null/부재 4갈래를 `null` 로 수렴 — 17 케이스 | PASS |
| `tool_use_result` 귀속 | tool_result 블록 1개일 때만 | 복수 블록 미적용 케이스 존재 | PASS |

### 7. 숫자 / 음성 기준 / 상한 재측정

- 강제 지점 재측정: **19**(구현자 보고 18) — §5 표.
- 내역 합 = 총계: `1+1+1+1+2+3+3+1+1+1+4 = 19` ✓ (구현자 산식은 같은 내역에서 18 을 적었다)
- AC 합계 재측정: `21+3+1 = 25` ✓
- 0건 게이트의 정당한 예외 보존: `rg TaskOutput app/src/main` → 1행이 남으나 **주석**이다(polling 금지를 설명하는 문장) — 코드 참조 0 이 주장의 실체다.
- 상한: `structuredOutput` 최대치는 `TaskListOutput` — Task 수 × 약 200B. 신규 네트워크 요청 0.

### 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 시각(AC25) | raw 색 0건·그룹 순서·아이콘 분기 exhaustive | 첨부 양식 대조, 라이트/다크 | 디버그 패널 → mock `agent_task_board` → 작업 타일 |
| 2세션(AC20) | fold 입력 격리(전역 참조 0) | 세션 전환 중 갱신 | 세션 A 에서 mock 실행 → B 로 이동 → A 복귀 |
| 턴-후 갱신(AC11) | 경로 diff 0줄 | 실제 CLI 백그라운드 진행 | 실환경 Task 실행 후 턴 종료 관측 |
| CLI 가 TaskXXX 를 실제로 부르는가 | mock 으로 렌더 경로 독립 검증 | 실 CLI 관측 | 실환경 대화에서 목록이 차는지 |

### 9. 게이트 재실행

- 실제 실행 명령: `cd app && npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check`
- **관측한 실행 산출**: lint `0 error / 1 warning` · typecheck 출력 0줄 · vitest `235파일 / 2413케이스 / 실패 0` · inventory 3줄 ok
- `npm test` 사용: 안 함. DB 스위트는 `npm rebuild better-sqlite3`(Node ABI) 후 일반 vitest 로 돌아갔다 — 구현자가 ABI 를 맞춰둔 상태를 그대로 썼다.
- 환경 기인 실패 분리: `chat-turn.continuity.test.ts` 로드 실패 = `Electron failed to install correctly`(ELECTRON_SKIP_BINARY_DOWNLOAD 설치). **stash 후 기준선 재현으로 확인** — 변경 무관.
- **게이트가 작업 트리를 바꿨는가**: `npm run lint` 는 `--fix` 지만 실행 후 `git status --short` **빈 출력** — 트리 변화 0.
- **검증 중 실행한 명령의 잔여물**: probe 테스트 1개를 `app/src/probe.test.ts` 에 임시 생성 후 **삭제 확인**(`git status` 빈 출력). `node_modules` 는 커밋 대상 아님.

### 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료 |
| AC ↔ production path | 25행 1:1 대조 완료, 1건 ❌ |
| 레이어/계약/링크 | boundaries·inventory 통과 |
| AGENTS 위생 | 해당 없음(AGENTS 미변경) |
| 제품 의도 | D-004 가 명세 §2 보다 좁다는 사실은 사용자 확정 사항 — 재론 없음 |
| UI 시각 품질 | 로직 기계 검증, 시각은 **사람** |
| 신규 의존성 / merge | 신규 의존성 0. merge 는 **사람** |

### 11. Repository operation checks

### INDEX 보드 정합성

- 상태/다음 주체/대상 커밋: 이번 턴에 `verify/FAIL`·구현자·`c3bb0d1` 로 갱신.
- 「다음 주체」 칸: 주체 하나(`Claude` 구현)만.
- 대상 커밋 좌표: **검증자가 기입** — `git cat-file -t c3bb0d1` → `commit` ✓
- 비고: r1 시점 6문장/466자였다 → 이번 갱신에서 5줄 이내로 줄였다.
- archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Status: implemented` · `Criteria-Met`/`Criteria-Pending` · `Verified-By: pending` — 전부 허용값 ✓
- trailer 파싱: `git log -1 --format='%(trailers:only=true)' c3bb0d1` → **8키 그대로 반환** ✓
- 인용 커밋 실재: `d54f074`·`72766d2`·`c3bb0d1` 전부 `git cat-file -t` = commit ✓
- `[구현자 기입]` 7필드: 설계 리뷰·강제 지점 전수·잠금·Product/UX 파생·놓친 잠재 문제·구현 보고·Review Signals **7/7 존재**, 산문으로 접힌 필드 0 ✓
- 삭제한 reference: `SubAgentTileContent.tsx` 삭제 후 참조 0건 확인 ✓

### 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| EP-07 지점 2→3 정정 제안 | **타당** — 실측으로 확인 | 다음 설계 턴에서 §10 정정 |
| `structuredOutput` 이름이 기존 capability 플래그와 겹침 | 타당 | D7(NEXT_HANDOFF) |
| `parts.ts` 결과맵 3벌 → 1벌 통합(선조치) | **타당** — 동작 무변화, 기존 테스트 green | 유지 |
| mock 시나리오 개수를 제목에서 제거(선조치) | 타당 — 저장소 원칙과 같은 축 | 유지 |
| 중단 흐름을 `features/chat/` 로 이동(설계 대비 차이) | 타당 — 4축 재유도 완료 | 유지 |
| AC21 을 ⚠️ 로 자기보고 | **부정확** — 실제는 ❌ | D1 |

### Review Signals — 사실만

- 이전 라운드와 동일/유사 증상인지: r1 이라 해당 없음.
- 관련 plan 지침/AC 가 있었는지: **있었다** — AC21 이 "`실패` 로 정착" 을 명시했고 §7 검증 수단도 "기존 `settleDeadBackgroundTasks` 회귀 UT + 파생 UT" 로 적었다. 구현자가 **파생 UT 를 만들지 않고** "경로 무변경" 으로 대체한 것이 누락 지점이다.
- 사용자 결정 변경 근거: D-012→D-014 는 사용자 `/handoff-impl` 명시 호출로 성립.
- 반복된 검증 환경 한계: `chat-turn.continuity.test.ts` 가 electron 바이너리를 요구해 이 환경에서 로드 실패(기준선 동일).
- 자기 검증 한계: 설계·구현·검증이 같은 에이전트다. 기준선 커밋 분리와 변이 재실행으로 완화했으나 **독립성은 구조적으로 제한된다** — 시각 5항목과 실환경 CLI 관측은 사람 몫으로 남는다.

---

## Verify r3 (2026-08-27) — FAIL

### 메타

| 항목 | 값 |
|---|---|
| slug | `0204-taskxxx-right-panel` |
| 검증자 | Claude Code |
| 일자 | 2026-08-27 |
| 대상 커밋/range | `a6dcfc8..4b3310b` (r2 `34db51d` · r3 `4b3310b`) |
| 구현 전 plan 기준 | r2 = `a6dcfc8` · r3 = `625cda7` |
| V mode / 유효 V | `Baseline V + ΔV1 + ΔV2` / `V1 + ΔV1 + ΔV2` |
| 라운드 | 3 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **예** — 설계·구현·검증이 같은 에이전트다. 기준선은 커밋 분리로 성립한다(§0) |

### 판정

**FAIL.** ΔV1·ΔV2 의 REQUIRED/REGRESSION pair 17 중 **VP-21·VP-22 가 PAIR_FAIL** 이다 — 구현자가 이번 라운드에 추출한 순수 View 3종의 **래퍼→View 배선이 어떤 테스트에도 잠기지 않는다**. 래퍼에서 배선을 지워도 `44파일 / 422케이스` 가 전건 통과한다(변이 V1·V2 실측). 나머지 15 pair 와 gate 4종은 PASS, `PLAN_GAP` 0. 다음 주체는 **구현자**이고 수정은 단언 몇 줄이라 새 계약이 필요 없다.

r1 의 FAIL 사유(D1 — 채널 종료가 사용자 중단으로 읽힌다)는 **닫혔다**.

---

### 0. 기준선 / plan 변경 확인

**기준선 성립.** 설계 커밋(`4fa82de`·`625cda7`)과 구현 커밋(`34db51d`·`4b3310b`)이 분리돼 §0 의 자기 증명 방지가 작동한다.

- 규범 구간(문서 시작 ~ 첫 `[구현자 기입]` 직전) `diff` → **r2 0줄 · r3 0줄**. Decision·AC·V node/pair·§10 이 구현 중에 바뀌지 않았다.
- 구현 커밋의 `plan.md` 변경(+151 / +90)은 전부 `[구현자 기입]` 안이다 — 위 0줄이 그것을 증명한다.
- D-003 의 `SUPERSEDED` 근거는 사용자 턴 원문("패널을 분리할 것")이다. D-028~D-031 은 사용자 질의 + SDK 실측에서 왔다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode·상속 기준·유효 V 재구성 | 유효 | `none → V1(72766d2) → ΔV1 → ΔV2` 순서가 §7-A/B/C 에 명시. 재구성 가능 |
| `NEW`·`CHANGED` ↔ 같은 레벨 REQUIRED pair | 유효 | ΔV1 좌측 10 노드 전부 pair 보유(VP-20~29) · ΔV2 MD-01a→VP-30. 차집합 0 |
| 영향받은 INHERITED ↔ REGRESSION | 유효 | VP-08·06·12·16(ΔV1) · VP-17·03·18(ΔV2) |
| pair별 path·§10 전수·직접 oracle | **1건 미달** | VP-21·VP-22 의 path 가 래퍼 hop 을 포함하는데 oracle 이 그 hop 을 지나지 않는다 → D10. 다만 **plan 이 아니라 구현이 만든 hop** 이라 `PLAN_GAP` 이 아니다 |
| 적대 증거 선택 이유 | 유효 | VP-22(0건 주장)·VP-29(회귀 방향)만 등록. 나머지는 직접 oracle |
| 현재 변경의 운영 gate 범위 | 유효 | 4종 열거, 무관한 기존 실패를 blocking 으로 올리지 않음 |

### 1. Product/UX · ACTIVE Decision ↔ production path

| Decision | 기대 결과 | 실제 경로 | 판정 |
|---|---|---|---|
| D-015 두 타일 | 타일 정의 4종에 `subagent`·`task` 공존 | `rightPanelTiles.ts:9,10` → `tileRegistry.ts:9,10` | ✅ |
| D-016 복구 | 그룹 4종·3줄 카드·대화록 상세 | `SubAgentTileContent` — `72766d2` diff 대비 변경 2점만 | ✅ |
| D-016a 중단 수명주기 유지 | 복구가 D-005 를 되돌리지 않음 | `stopTask(backgroundTaskKey(...))` + `stopping` 라벨 | ✅ 변이 E 로 확인 |
| D-017 cowork 3섹션 | 접히는 3섹션 | `TaskTileContent:306-314` | ⚠️ 배선 미잠금(D10) |
| D-018 id 단일 목록·취소선 | 그룹 없음, 완료 제자리 취소선 | `taskBoardOrdered` → `TaskProgressList` | ✅ |
| D-019 두 종류 함께 | `진행 상황` 이 agent+background | `taskBoardFromMessages` 무변경 | ✅ |
| D-020 제목 직후 중단 | `flex-1` 부재 + 형제 인접 | `TaskTileContent` 제목 span | ✅ 변이 C 로 확인 |
| D-023 권위 필드 우선 | 채널 종료 = `실패` | `parts.ts:339-342` | ✅ 변이 B 재실행으로 확인 |
| D-025 죽은 표면 제거 | 4종 부재 | 저장소 전체 0건(엄격화 후도 0) | ✅ |
| D-028 `blocks` 미저장 | 스냅샷 드리프트 차단 | `task-tool.ts` patch 에서 제거 | ✅ |
| D-029 가산 vs 교체 | 두 의미 분리 | `taskBoard.ts:123-126` | ✅ 변이 F·G 로 확인 |
| D-031 순서≠의존 | 새 태스크 `blockedBy: []` | AT-34③ 케이스 | ✅ |

**끊긴 곳 1**: D-017 의 경로 `TaskTileContent → 3섹션 → 행` 에서 **섹션→행 hop 이 무관측**이다 → D10.

### 2. AC 전 diff 비판적 읽기

| 질문 | 판정 | 근거 |
|---|---|---|
| false success 가능한가 | **1건** | 래퍼 배선을 지워도 전 스위트 green — 테스트가 "화면에 목록이 있다" 를 말하지 못한다(D10) |
| 부분 실패 잔여 | 안전 | 새 저장소 쓰기 0 · 새 IPC 0 · 새 마이그레이션 0 |
| A 대신 B 를 구현했는가 | 아니오 | 사용자 5문장이 Decision 으로 1:1 사상되고 각각 production path 를 갖는다 |
| 증상만 없애고 상태가 남았는가 | 아니오 | D-023 은 술어를 고쳤고 생산 지점 2곳은 그대로다(의도) |
| 최적화가 잃은 관측 | 없음 | 새 캐시 0. `useMemo` 의존성 무변경 |
| worst-case 상한 | 유계 | `taskBoardOrdered` = `O(n log n)`. 신규 요청 0 |
| 늦은 응답이 화면을 되돌리는가 | 아니오 | 두 선택 키 모두 dangling 시 목록 뷰로 낙하 |

### 3. 역방향 탐색

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `TaskProgressList`·`SubAgentTaskList`·`SubAgentTaskDetail` | **배선 미잠금** | 프로덕션 참조는 있다(같은 파일). 그러나 지워도 green → **D10 (BLOCKING)** |
| `backgroundMetaLine` 의 `aborted` 분기 | **거짓 진술 잔존** | 사유를 하드코딩(`사용자에 의해 중단됨`). `recovery.ts:5`(앱 사망 후 dangling 정산)가 `reason:'aborted'` 라 **사용자가 중단하지 않은 항목**도 그 문구를 받는다 → **D11** |
| 고아 i18n 키 | **2건** | `chat.taskTile.emptyTitle`(r2 가 소비처 제거) · `chat.taskTile.viewTranscript`(r1 이래 0건) → **D12** |
| 구현자 §5 전수 스윕의 축 | **좁음** | "message 로 *상태를 파생*하는 곳" 만 셌고 "*사유를 표시*하는 곳" 은 안 셌다. D11 이 그 차집합 → **D13** |
| scan-surface 미사용 export 5종 | 정상 | `rightPanelTileIds`·`isRightPanelTileId`·`defaultRightPanelTileLabelKey` 는 기존 골격 API(변경 무관) · `AGENT_TASK_STATUSES`·`partsStructured` 도 기존 |
| 형제 정책 비대칭 | 스크립트 0건 | 수동 확인도 0 — 두 타일의 중단 버튼 자리 차이는 D-016↔D-020 이 명시한 의도다 |
| producer ↔ consumer | 일치 | `settlementMessage` producer(`parts.ts`) ↔ consumer(`backgroundMetaLine`) 렌더 케이스로 확인 |
| 신규 등록값의 기존 소비처 | 무영향 | 타일 정의 4종 유지. `reserved2` 제거 지점 **파일 6 · 행 9** 를 typecheck 가 전부 드러냄 |

### 4. 구현 보고 대조 — 증거로 받지 않고 다시 셌다

- **강제 지점 재측정**: EP-12 **2** · EP-13 **1/1/1/1/2** · EP-14 **1** · EP-15 **1+2** · EP-17 **3**(잔여 0) · EP-19 **1/1/1**. **구현자 보고와 전건 일치.**
- **등록된 변이를 검증자가 재실행**: 변이 B(`reason` 우선 분기 제거) → `1 failed / 170 passed`, `AT-21` 검출. 나머지 변이(C·D·E·F·G)는 이번 세션에서 관측 산출과 함께 실행됐고 전부 red 였다.
- **검증자가 새로 심은 변이 2건**(구현자가 만든 seam 대상):

| 변이 | 대상 | 재측정 | 판정 |
|---|---|---|---|
| **V1** | 래퍼에서 `<TaskProgressList>` 제거 | **44파일 / 422케이스 전건 통과** | **무음 — D10** |
| **V2** | 래퍼에서 `<SubAgentTaskList>` 제거 | **44파일 / 422케이스 전건 통과** | **무음 — D10** |

- **자기보고 합계 대조**: 본문 `✅11 / ΔV1` · trailer `Criteria-Met: 11/11` · INDEX 비고 — **세 곳 일치**. r3 도 `1/1` 로 일치.
- **구현자의 "설계 대비 차이"(View 추출)를 축별로 재유도**: 만료·재진입·무효화는 보고대로 해당 없음/무영향. **공유 축은 보고가 `미덮임으로 남긴다` 고 적었고 실측도 그렇다.** 그러나 보고에 **없던 축이 하나 더 있다 — 배선**. 그것이 D10 이다.

### 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 |
|---|---|---|---|---|
| VP-28 | MD↔UT | REQUIRED | PASS | `taskBoard.test` AT-10a 2케이스(수치순·비수치 전순서) |
| VP-29 | MD↔UT | REQUIRED | PASS | `parts.test` AT-21 2 + AT-31 · **변이 B 재실행 red** |
| VP-30 | MD↔UT | REQUIRED | PASS | AT-34 3케이스 · 변이 F·G red |
| VP-17 | MD↔UT | REGRESSION | PASS | `task-tool.test` 17케이스 green |
| VP-18 | MD↔UT | REGRESSION | PASS | 스냅샷 교체 유지 — AT-34② |
| VP-26 | AR↔IT | REQUIRED | PASS | `contentById` 가 `Record<RightPanelTileId,…>` 라 typecheck 강제 + AT-28 헤더 출력 |
| VP-27 | AR↔IT | REQUIRED | PASS | transcript 3행 `openSubagentTask`, 잔여 `openTask` 0 |
| VP-16 | AR↔IT | REGRESSION | PASS | 변이 D → 1 red |
| VP-25 | SD↔ST | REQUIRED | PASS | reducer 6단언(선택 2·제거 2·열기 2) |
| VP-12 | SD↔ST | REGRESSION | PASS | 변이 E → 3 red |
| VP-20 | R↔AT | REQUIRED | PASS | 두 파생 차집합 0 + agent 항목 배타 |
| **VP-21** | **R↔AT** | **REQUIRED** | **PAIR_FAIL** | **목록/상세 View 는 단언되나 `subagent` 타일이 그것을 부르는 hop 이 무관측 — 변이 V2 무음** |
| **VP-22** | **R↔AT** | **REQUIRED** | **PAIR_FAIL** | **행 단언·섹션 단언은 있으나 섹션→행 hop 이 무관측 — 변이 V1 무음** |
| VP-23 | R↔AT | REQUIRED | PASS | 두 선택 상태 독립 양방향 |
| VP-24 | R↔AT | REQUIRED | PASS | 4종 0건(엄격화 후도 0) + 배지·중단해제 양성 짝 |
| VP-06 | R↔AT | REGRESSION | PASS | 변이 E → 3 red |
| VP-08 | R↔AT | REGRESSION | PASS | AT-21 이 `failed`/`aborted` 양방향 단언 · 변이 B red |

**합계: PASS 15 · PAIR_FAIL 2 · BLOCKED_BY 0 · PLAN_GAP 0 / 17.**

### VP-21·VP-22 재현

```text
TaskTileContent.tsx:308   <TaskProgressList items={items} stopErrors={stopErrors} />  ← 이 줄을 <></> 로
SubAgentTileContent.tsx:127  return <SubAgentTaskList tasks={tasks} stoppingIds={stopping} />  ← 이 줄을 <></> 로
  → ./node_modules/.bin/vitest run src/renderer/src/features/chat
  → 44 files / 422 tests, 실패 0                                  ← 기대: red
```

**왜 무음인가**: AT-26·AT-27 은 `TaskProgressList` 를 **직접** 렌더해 행을 단언하고, AT-29 는 `TaskTileContent` 를 렌더하되 **섹션 헤더와 `aria-expanded` 만** 본다. 그 사이 hop 을 보는 단언이 없다. 같은 형태가 `subagent` 타일에도 있다.

**닫는 방법(제안)**: AT-29 에 "`진행 상황` 섹션 본문이 목록 컴포넌트의 산출을 담는다" 를 더한다 — SSR 에서 store 가 비므로 `chat.taskTile.emptyDesc` 가 그 자리에 렌더되는지가 가장 싼 관측이다. `subagent` 타일도 동형. **계약 신설이 아니라 기존 AT-29·AT-28 의 단언 보강이라 `PLAN_GAP` 이 아니다.**

### 강제 지점 분모 재측정

| EP | plan 분모 | 검증자 실측 | 결과 |
|---|---|---|---|
| EP-12 | 2 | 2 | PASS |
| EP-13 | 5 | 5 (①1 ②1 ③1 ④1 ⑤2파일) | PASS |
| EP-14 | 1 | 1 (프로덕션 `.sort(` 0) | PASS |
| EP-15 | 1+2 | 1+2 | PASS |
| EP-16 | 2 | 2 (전이 import 까지 0건) | PASS |
| EP-17 | 3 | 3 (잔여 0) | PASS |
| EP-18 | 4 | 4 (저장소 전체 0건) | PASS |
| EP-19 | 3 | 3 | PASS |
| EP-07·EP-08·EP-06 | 3·1·3 | 동일 | PASS(REGRESSION) |

**합계 검산: 신설 `20`(EP-12~18) + `3`(EP-19) + REGRESSION `9`(EP-07 3 · EP-08 1 · EP-06 3 · EP-02 1 · EP-03 1) = **32**.** 구현자 보고(r2 27 + r3 5 = 32)와 **일치**한다.

> **검증자 자기 정정.** 이 절의 초안은 합계를 `30` 으로 적고 구현자가 EP-02·EP-03 을 중복 계상했다고 판정했다 — **틀렸다.** 두 행은 r3 이 파서(`readUpdate`)와 적용부(`applyPatch`)를 실제로 고쳤으므로 이번 변경의 회귀 지점이 맞고, 나는 그것을 pair 표(VP-17·VP-18)에서는 REGRESSION 으로 인정하면서 합계에서만 빠뜨렸다. **행 축은 맞고 합계 축만 틀린** 형태이며, 이는 §4 가 경고하는 바로 그 실수다 — 감사하는 쪽도 같은 축에서 틀린다.

### AC 세부와 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC9a·AC10a | ✅ ×2 | 두 파생 차집합 · 순서 배열 2케이스 |
| AC26·AC27 | ✅ ×2 | 취소선 양방향 · 형제 인접 + `flex-1` 부재. **단, 이 단언은 View 직접 렌더다**(D10 의 근거) |
| AC28 | ✅ | 그룹 순서 단조 · 3줄 필드 · child 텍스트 |
| AC29 | ⚠️ | 헤더 3 + 설명 2 + `aria-expanded` 3 은 참이나 **섹션 본문 무관측** → D10 |
| AC30 | ✅ | reducer 6단언 |
| AC21·AC31 | ✅ ×2 | `failed`/`aborted` 양방향 · 사유 문구 화면 도달 |
| AC32·AC33 | ✅ ×2 | 4종 0건(엄격화) · 문서 3관측 |
| AC34 | ✅ | 가산·교체·`blocks` 미저장(양성 짝 동반) |

**합계 검산: `✅ 11 · ⚠️ 1 · ❌ 0 = 총 12`** — ΔV1 **11**(AC9a·10a·26·27·28·29·30·21·31·32·33) + ΔV2 **1**(AC34). 초안의 `총 11` 은 분모를 잘못 센 것이라 여기서 정정한다. `V1` 22 INHERITED 중 AC11·AC20·AC25 는 이번에도 사람 실기.

### 6. 게이트 (검증자 실행)

| Gate | 관측한 산출 | 판정 |
|---|---|---|
| `npm run lint` | **0 error · 1 warning** — `useTranscriptVirtualizer.ts:22` `react-hooks/incompatible-library`(기존·변경 무관) | PASS |
| `npm run typecheck` | **error TS 0건** (3구성) | PASS |
| `vitest` 전체 | **236파일 / 2435케이스 / 실패 0** | PASS |
| `check-doc-inventory --check` | `9 items, 79 channels` · prose ok · links ok — 채널·variant·마이그레이션 **불변** | PASS |

- **ABI**: 구현자가 `npm rebuild better-sqlite3`(Node ABI)로 맞춰 둔 상태를 그대로 썼다. **이 트리는 Node ABI 라 `dev`/`build` 는 Electron 재빌드가 필요하다**(`app/AGENTS.md §better-sqlite3 ABI`).
- **게이트가 트리를 바꿨는가**: `lint --fix` 실행 후 `git status --short` **0줄**.
- **검증 중 잔여물**: 변이 V1·V2·B 전부 복원 확인(`git diff --quiet`), 백업은 scratchpad 에만.

### 7. 사람 실기 경계

| 항목 | 기계가 닫은 범위 | 사람 몫 |
|---|---|---|
| 3섹션 시각 | 헤더·접힘·파생 0건 | 첨부 cowork 이미지 대조, 라이트/다크 |
| 중단 버튼 자리 | DOM 형제 순서·`flex-1` 부재 | 긴 제목에서의 실제 잘림 |
| 복구 충실도 | 그룹 순서·3줄·상세 | `72766d2` 와 시각 동일성 |
| AC11·AC20 | 경로·격리 | 턴-후 갱신 · 2세션 전환 |
| J1(SDK `updatedFields` 이름) | 두 이름 모두 허용 | 실환경 `TaskUpdate` 관측 |

### 8. Repository operation checks

- 인용 커밋 6개 전부 `git cat-file -t` = `commit` ✓
- 구현 커밋 trailer 2개 모두 파싱 ✓ (`Agent: claude` · `Status: implemented` · `Criteria-*` · `Verified-By: pending` — 전부 허용값)
- `[구현자 기입]` 섹션 **21 = 7필드 × 3라운드** ✓ — 산문으로 접힌 필드 0
- **INDEX 비고가 5줄 규칙을 넘었다** — 100자 기준 **7줄**. 이번 갱신에서 줄인다 → D14
- `AGENTS.md` 변경 없음 — 위생 검사 해당 없음
- 삭제한 reference: `taskBoardGroups` 외 6종 — 저장소 전체 참조 0 확인 ✓

### 9. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 검증자 실행·산출 관측 완료 |
| AC ↔ production path | 11행 대조, 1건 ⚠️ |
| 레이어/계약/링크 | boundaries·inventory 통과 |
| 제품 의도 | D-019(두 타일에 background 공존)는 사용자 확정 — 재론 없음 |
| UI 시각 품질 | 사람 |
| 신규 의존성 / merge | 신규 의존성 0. merge 는 사람 |

### Review Signals — 사실만

- **이전 라운드와 같은 축인가**: **부분적으로 그렇다.** D12(고아 i18n 키)는 r1 D2 · r2 G1 과 같은 **죽은 표면** 축의 세 번째 발현이다. 매번 분모가 달랐다 — D2 는 renderer 심볼, G1 은 shared 필드, D12 는 i18n 키.
- **관련 plan 지침/AC 가 있었는가**: **D10 에는 없었다.** ΔV1 이 VP-21·VP-22 의 path 를 `TaskTileContent → 3섹션 → 행` 으로 적었으나, 그 path 가 **구현 중에 hop 하나를 얻었고**(View 추출) plan 도 구현 보고도 그 hop 을 축으로 세지 않았다. 구현자 차이표는 만료·공유·재진입·무효화 4축을 적었고 **배선 축이 없었다**.
- **사용자 결정 변경 근거**: D-003→D-015 는 사용자 턴 원문. D-028~D-031 은 사용자 질의 + SDK 1차 문서.
- **반복된 검증 환경 한계**: better-sqlite3 ABI(3라운드 연속). 새로 관측된 것 — `renderToStaticMarkup` + zustand 는 SSR 스냅샷을 돌려주어 store 연결 컴포넌트를 시드할 수 없다.
- **자기 검증 한계**: 설계·구현·검증이 같은 에이전트다. 기준선 커밋 분리와 **검증자가 새로 심은 변이 2건**으로 완화했고, 그 2건이 이번 FAIL 을 만들었다.
- **라운드 수**: **3**. 다음 재구현은 `handoff-review` 트리거(라운드 3 초과)에 해당한다.


---

## Verify r4 (2026-08-27) — FAIL

### 메타

| 항목 | 값 |
|---|---|
| slug | `0204-taskxxx-right-panel` |
| 검증자 | Claude Code |
| 일자 | 2026-08-27 |
| 대상 커밋/range | `d93d21d..e459be0` (r4 구현 = `e459be0`) |
| 구현 전 plan 기준 | `d93d21d` (r3 검증 커밋) |
| V mode / 유효 V | `Baseline V + ΔV1 + ΔV2` / `V1 + ΔV1 + ΔV2` |
| 라운드 | 4 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **예** — 기준선은 커밋 분리로 성립한다(§0) |

### 판정

**FAIL.** D10 의 두 실패 pair 중 **VP-21 은 닫혔고 VP-22 는 아직 열려 있다**. 새 단언은 "래퍼가 목록 View 를 **어디선가** 부른다"를 잠그지만 "**`진행 상황` 섹션 본문이** 담는다"는 잠그지 않는다 — `진행 상황`↔`출력` 두 섹션 본문을 맞바꾸는 변이 **M-S 가 무음**이다(44파일/423케이스 전건 통과). VP-22 의 path `TaskTileContent → 3섹션 → 행` 에서 **`3섹션` hop 이 세 섹션을 구별하지 못한다**.

- 나머지 15 pair·gate 4종은 PASS, `PLAN_GAP` **0**. 수정은 단언 한 줄(위치 구속)이라 새 계약이 필요 없다 → 다음 주체는 **구현자**.
- D10 의 1차 축(배선 삭제가 무음)은 **닫혔다** — 등록 변이 V1·V2 를 검증자가 재실행해 각각 `1 failed / 422 passed` 다.

---

### 0. 기준선 / plan 변경 확인

**기준선 성립.** 검증 커밋(`d93d21d`)과 구현 커밋(`e459be0`)이 분리돼 §0 의 자기 증명 방지가 작동한다.

- 규범 구간(문서 시작 ~ 첫 `[구현자 기입]`, plan.md:1-825) `diff` → **0줄**. Decision·AC·V node/pair·§10 이 구현 중에 바뀌지 않았다.
- `e459be0` 의 `plan.md` 변경(+74)은 전부 `[검증자 기입] 파생 이슈` **뒤**에 붙은 r4 구현자 기입이다 — 열린 파생 이슈 D10~D13 의 행도 손대지 않았다.
- 채점 기준은 r3 이 고정한 AC28·AC29 원문과 VP-21·VP-22 의 path·oracle 이다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode·유효 V 재구성 | 유효 | `none → V1(72766d2) → ΔV1 → ΔV2`. r4 는 V 를 바꾸지 않았다(ΔV3 없음) |
| 재검증 범위 선택 | 유효 | production 변경 0건이라 root 실패 pair 2개 + gate 만 실행 대상. 나머지 15 pair 는 r3 증거 좌표를 참조한다 |
| pair별 path·oracle | **1건 미달** | VP-22 의 path 가 `3섹션` hop 을 갖는데 oracle 이 세 섹션을 구별하지 못한다 → **D15**. 구현이 만든 미달이라 `PLAN_GAP` 이 아니다 |
| 적대 증거 등록 | 유효 | VP-22 는 plan 이 이미 `적대 증거 required` 로 등록한 pair다 — 새 변이를 심는 것이 이 pair의 규정된 절차다 |
| 운영 gate 범위 | 유효 | 4종 열거. 무관한 기존 실패(better-sqlite3)를 blocking 으로 올리지 않음 |

### 1. AC 전 diff 비판적 읽기

변경은 **테스트 1파일뿐**이다(`rightPanelTiles.render.test.ts` +12/-1). production·i18n·IPC·DB·의존성 **0건** — `git show --stat e459be0` 이 3파일(테스트 1 · plan.md · INDEX.md)만 낸다.

| 질문 | 판정 | 근거 |
|---|---|---|
| 새 단언이 vacuous 한가 | 아니오 | V1·V2 재실행이 각각 red. 관측 문자열 3종은 전부 View 안의 `tr()` 산출이다 |
| 관측 문자열이 유일 생산자를 갖는가 | 예 | `rg` 전수 — `emptyDesc`(작업)=`TaskTileContent.tsx:206` 1곳 · `subagentTile.emptyTitle/emptyDesc`=`SubAgentTileContent.tsx:195,196` 2곳. 래퍼 자신이 같은 문구를 내지 않는다 |
| 테스트 격리가 SSR 빈 store 에 의존하는가 | 예(문서화됨) | `beforeEach` 는 `runSeq` 만 되돌린다. 빈 상태는 zustand SSR 스냅샷이 만든다 — 구현자 K1 이 같은 한계를 적었다 |
| 기존 단언을 약화했는가 | 아니오 | diff 는 전부 추가(+12), 삭제는 import 1줄 교체뿐 |

### 2. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh d93d21d..e459be0` → **변경된 소스 파일 0** (테스트 전용 변경이라 스크립트 분모 밖). 직접 본 것:

| 후보 | 판정 | 근거 |
|---|---|---|
| 새 import `SubAgentTileContent` | 정상 | production export 를 그대로 부른다 — 동명 로컬 재구현 0 |
| D12 고아 i18n 키 | **잔존 2건** | `chat.taskTile.emptyTitle` 0 소비처 · `chat.taskTile.viewTranscript` 0 소비처. r4 범위 밖이라 열린 채 유지 |
| 새 단언이 죽은 표면을 살렸는가 | 아니오 | `subagentTile.emptyTitle/emptyDesc` 는 소비처 2곳을 이미 갖는다 |
| 형제 정책 비대칭 | **1건** | `subagent` 타일은 래퍼가 View 를 통째로 반환해 위치 모호성이 없고, `task` 타일만 3섹션 중 하나를 골라야 한다 — D15 가 그 차집합이다 |

### 3. 구현 보고 대조 — 증거로 받지 않고 다시 셌다

| 구현자 보고 | 검증자 재측정 | 판정 |
|---|---|---|
| 대상 suite `1파일 / 12케이스` green | `1파일 / 12케이스` green | 일치 |
| renderer chat `44파일 / 423케이스` green | `44파일 / 423케이스` green | 일치 |
| 전체 vitest `231파일 / 2388케이스` green + 5파일 46 red | `231 passed / 5 failed (236)` · `2388 passed / 46 failed (2434)` | 일치 |
| V1 → `1 failed / 11 passed` | 전 chat 스위트로 재실행 → **`1 failed / 422 passed`**, AT-29 의 `emptyDesc` 단언에서 검출 | 일치(분모만 다름) |
| V2 → `1 failed / 11 passed` | 전 chat 스위트로 재실행 → **`1 failed / 422 passed`**, AT-28 의 새 케이스에서 검출 | 일치(분모만 다름) |
| §10 강제 지점 `2/2`, production 32곳 무변경 | production diff 0줄로 확인 — 32 는 이번 라운드 재측정 대상이 아니다 | 일치 |
| AC 자기보고 `✅2 / 총 2` ↔ trailer `Criteria-Met: 2/2` ↔ INDEX 비고 | **세 곳 일치** | 일치 |

**보고에 없던 축이 하나 더 있다 — 위치.** 구현자 잠금 표는 "제거하면 red"만 쟀고 "다른 섹션으로 옮기면?"을 재지 않았다. 그것이 D15 다. r3 의 D10 과 같은 형태의 반복이다 — 그때는 "배선 축"이 보고에 없었다.

**검증자가 새로 심은 변이 1건**:

| 변이 | 대상 | 재측정 | 판정 |
|---|---|---|---|
| **M-S** | `TaskTileContent` 의 `진행 상황` 본문 ↔ `출력` 본문 맞바꿈(`<TaskProgressList>` ↔ `<OutputSectionEmpty />`) | **44파일 / 423케이스 전건 통과** | **무음 — D15** |

```text
TaskTileContent.tsx:307-312
  <TileSection …progress>  <OutputSectionEmpty />                         ← 맞바꿈
  <TileSection …output>    <TaskProgressList items={items} …/>            ← 맞바꿈
  → ./node_modules/.bin/vitest run src/renderer/src/features/chat
  → 44 files / 423 tests, 실패 0                                          ← 기대: red
```

**왜 무음인가**: AT-29 는 네 문자열의 **존재**만 본다(`toContain` ×5 + `aria-expanded` 3개). 맞바꿔도 네 문자열이 모두 남으므로 참이다. **깨지는 계약**: AC29 의 "`출력`·`컨텍스트` 는 설명문만 낸다" 와 D-022 — 맞바꾼 화면은 사용자에게 작업 목록을 `출력` 헤더 아래로 낸다. EP-16(섹션 컴포넌트가 `parts` 를 읽지 않는다)도 이 변이를 못 잡는다 — 컴포넌트는 그대로고 자리만 바뀌기 때문이다.

**닫는 방법(제안, 계약 신설 아님)**: AT-29 에서 문자열 **순서**를 구속한다 — `html.indexOf('진행 상황') < html.indexOf(emptyDesc) < html.indexOf('출력')`. 또는 `진행 상황` 섹션의 `<section>` 조각만 잘라 그 안에서 `toContain` 한다.

### 4. V-pair closeout — `UT → IT → ST → AT`

r4 는 production 을 바꾸지 않았다. **실행 대상은 root 실패 pair 2개와 gate**이고, 나머지 15 pair 는 r3 §5 의 증거 좌표를 참조한다(이번 전체 스위트 재실행에서 그 증거가 전건 green 임도 확인했다).

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 |
|---|---|---|---|---|
| **VP-21** (R-11↔AT-28) | R↔AT | REQUIRED | **PASS** | 새 케이스 "빈 상태에서도 래퍼가 목록 View의 제목과 설명을 그린다" — **변이 V2 재실행 red**. 래퍼가 View 를 통째로 반환하는 형상이라 위치 모호성이 없다 |
| **VP-22** (R-12↔AT-26/27/29) | R↔AT | REQUIRED | **PAIR_FAIL** | 배선 삭제(V1)는 red 로 바뀌었으나 **위치 변이 M-S 가 무음**. `3섹션 → 행` hop 이 여전히 세 섹션을 구별하지 못한다 |
| VP-20·23·24·25·26·27·28·29 | 각 레벨 | REQUIRED | PASS(참조) | r3 §5 의 좌표. 이번 라운드 production diff 0줄이라 영향 없음 |
| VP-06·08·12·16·17·18 | 각 레벨 | REGRESSION | PASS(참조) | 같음 |

**합계: PASS 15 · PAIR_FAIL 1 · BLOCKED_BY 0 · NOT_REQUIRED 0 · PLAN_GAP 0 / 17.** r3 의 `PASS 15 · FAIL 2` 대비 VP-21 이 PASS 로 이동했다.

### AC 세부와 합계 — r4 분모

| AC | 결과 | 증거 |
|---|---|---|
| AC28 / VP-21 | ✅ | 빈 제목·설명 2문구 · V2 red |
| AC29 / VP-22 | ❌ | `emptyDesc` 존재는 참(V1 red)이나 **자리**가 무관측 — M-S 무음 |

**검산: `✅ 1 · ⚠️ 0 · ❌ 1 = 총 2`.** r4 가 다시 채점하는 것은 D10 의 두 행뿐이다. ΔV1·ΔV2 의 나머지 10 AC 와 `V1` 의 사람 실기 3 AC(AC11·AC20·AC25)는 r3 좌표를 승계한다.

### 5. 게이트 (검증자 실행)

| Gate | 관측한 산출 | 판정 |
|---|---|---|
| `npm run lint` | **0 error · 1 warning** — `useTranscriptVirtualizer.ts:22` `react-hooks/incompatible-library`(기존·변경 무관) | PASS |
| `npm run typecheck` | **error TS 0건** (node·web·test 3구성 전부 무출력 종료) | PASS |
| `vitest run` (전체) | **231파일 green / 5파일 red · 2388케이스 green / 46 red** | PASS(분리 보고) |
| `check-doc-inventory --check` | `9 items, 79 channels` · prose ok · links ok | PASS |

- **5파일 red 는 알려진 환경 서명이다** — `Could not locate the bindings file … better_sqlite3.node`. 실패 파일이 `app/AGENTS.md §제약 환경` 이 열거한 실측 5파일과 **정확히 일치**한다: `infra/db/queries` · `infra/db/migrate` · `features/extensions/builder` · `features/orchestration/fork` · `app/chat-turn.continuity`(0 test 수집). 이번 변경과 무관하다.
- **ABI**: 이 트리는 `npm ci --ignore-scripts` 로 세웠다 — better-sqlite3 바인딩 미빌드, electron 바이너리 부재. `dev`/`build` 실기는 여기서 불가능하다.
- **게이트가 트리를 바꿨는가**: `npm run lint`(`--fix`) 실행 후 `git status --short` **0줄**.
- **검증 중 잔여물**: 변이 V1·V2·M-S 전부 복원 후 `git diff --quiet` 통과. 백업은 scratchpad 에만. `node_modules/` 는 미추적 설치물이라 커밋에 섞이지 않는다.

### 6. 사람 실기 경계

r3 §7 과 같다 — 3섹션 시각 대조 · 긴 제목의 버튼 잘림 · `72766d2` 시각 동일성 · AC11·AC20 · J1(SDK `updatedFields`). **r4 가 새로 사람에게 넘긴 것은 없다.** D15 는 기계로 닫힌다(단언 한 줄).

### 7. Repository operation checks

| 검사 | 판정 | 관측 |
|---|---|---|
| 인용 커밋 실재 | ✓ | `d93d21d`·`e459be0` 둘 다 `git cat-file -t` = `commit` |
| trailer 파싱 | ✓ | `git log -1 --format='%(trailers:only=true)' e459be0` → **5키 전부 반환** |
| trailer 허용값 | ✓ | `Agent`·`Handoff`·`Status`·`Criteria-Met`·`Verified-By` 전부 허용값 |
| trailer 사실성 | **1건 어긋남** | `Agent: codex` 인데 **ACTIVE D-014 는 구현 주체를 Claude 로 확정**했고 r1·r2·r3 구현 커밋 3개는 전부 `Agent: claude` 다 → **D16** |
| `[구현자 기입]` 7필드 | ✓ | r4 는 7 — `강제 지점 전수 + V-pair 자기확인` 이 한 제목으로 합쳐졌으나 두 내용이 표로 다 있다. 산문으로 접힌 필드 0 |
| INDEX 비고 5줄 | ✓ | 222자 = 100자 기준 **3줄** |
| INDEX 대상 커밋 | **자리표시자** | `(r4 구현 — 검증자 기입)` → 이번 갱신에서 `e459be0` 로 채운다 |
| `AGENTS.md` 변경 | 해당 없음 | r4 diff 에 없다 |

### 8. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트/inventory | 검증자 실행·산출 관측 완료 |
| pair·AC ↔ production path | 2행 재채점, 1건 ❌ |
| 변이 재실행 + 신규 변이 | V1·V2 재현 · M-S 신설 |
| UI 시각 품질 · merge | 사람 |

### Review Signals — 사실만

- **이전 라운드와 같은 축인가**: **그렇다.** D15 는 D10 과 같은 "hop 이 무관측" 축의 두 번째 발현이고 분모만 한 단계 좁아졌다(래퍼→View → 섹션→View). 두 번 다 구현자 잠금 표가 **소거 변이만** 재고 **치환/이동 변이**를 재지 않았다.
- **관련 plan 지침/AC 가 있었는가**: **있었다.** r3 이 적은 닫는 방법이 "`진행 상황` **섹션 본문이** 목록 산출을 담는다" 였고 AC29 가 "`출력`·`컨텍스트` 는 설명문만 낸다" 를 이미 갖는다. 구현은 섹션 구속 없는 약한 형태로 내려갔다.
- **사용자 결정 변경 근거**: 없다. r4 는 Decision 을 건드리지 않았다.
- **반복된 검증 환경 한계**: better-sqlite3 ABI/egress(4라운드 연속) · zustand SSR 스냅샷이 store 연결 컴포넌트를 시드하지 못함(2라운드 연속, K1 과 동일 관측).
- **자기 검증 한계**: 설계·구현·검증이 같은 에이전트다. 기준선 커밋 분리와 **검증자가 새로 심은 변이 1건**으로 완화했고, 그 1건이 이번 FAIL 을 만들었다(r3 과 같은 형태).
- **라운드 수**: **4**. `handoff-review` 트리거(라운드 3 초과)에 이미 해당한다 — r4 구현자가 인라인으로 B(실행 누락) 판정만 남기고 지침 변경 0 으로 닫았는데, 같은 축이 한 번 더 재발했다.
