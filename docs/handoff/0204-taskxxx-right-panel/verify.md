# Verify — 0204-taskxxx-right-panel

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

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

## 판정

**FAIL.** REQUIRED pair 19 중 **VP-08 이 PAIR_FAIL** 이다 — 채널 종료로 정착한 background 작업이 `실패` 가 아니라 `중단됨` 그룹에 들어가고, 행 문구가 **`사용자에 의해 중단됨`** 이라 원인을 거짓 진술한다(AC21 위반). 나머지 18 pair 와 gate 4종은 PASS, PLAN_GAP 0. 다음 주체는 구현자다.

---

## 0. 기준선 / plan 변경 확인

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

## 1. Product & UX / ACTIVE Decision 요약

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

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 대체로 명시적 | 중단 요청 실패가 reject → 화면 사유. 구 코드는 무음 반환이었다 |
| false success 가능성 | **1건** | 채널 종료가 "사용자가 중단함" 으로 보인다 → D1 |
| partial failure/rollback | 안전 | 요청 실패 시 `stoppedSubagents`·`blockedSubagents` 롤백 확인(테스트) |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | 1건 | 명세 §2 "실패 상태로 정착 + 실행 세션 종료" → 실제는 중단 상태 + 사용자 중단 문구(D1·D4) |
| 증상만 제거하고 상태가 남았는가 | 아니오 | 정착이 transcript 파트를 실제로 바꾼다 |
| 최적화가 잃은 재검증/취소/만료 관측 | 없음 | 새 캐시 0 · `useMemo` 의존성에 `stopping` 포함 확인 |
| 출력/요청 worst-case 상한 | 유계 | `structuredOutput` 은 Task 6종 한정, `TaskListOutput` 이 최대. 신규 네트워크 요청 0 |

## 3. 역방향 탐색

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

## 4. 기존 테스트 / semantic 검증 확인

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

## 5. V-pair closeout — `UT → IT → ST → AT`

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

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| SDK `Task*Output` | `task-tool.ts` 가 SDK `sdk-tools.d.ts` 필드만 좁혀 읽음 | 성공/실패/null/부재 4갈래를 `null` 로 수렴 — 17 케이스 | PASS |
| `tool_use_result` 귀속 | tool_result 블록 1개일 때만 | 복수 블록 미적용 케이스 존재 | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 강제 지점 재측정: **19**(구현자 보고 18) — §5 표.
- 내역 합 = 총계: `1+1+1+1+2+3+3+1+1+1+4 = 19` ✓ (구현자 산식은 같은 내역에서 18 을 적었다)
- AC 합계 재측정: `21+3+1 = 25` ✓
- 0건 게이트의 정당한 예외 보존: `rg TaskOutput app/src/main` → 1행이 남으나 **주석**이다(polling 금지를 설명하는 문장) — 코드 참조 0 이 주장의 실체다.
- 상한: `structuredOutput` 최대치는 `TaskListOutput` — Task 수 × 약 200B. 신규 네트워크 요청 0.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 시각(AC25) | raw 색 0건·그룹 순서·아이콘 분기 exhaustive | 첨부 양식 대조, 라이트/다크 | 디버그 패널 → mock `agent_task_board` → 작업 타일 |
| 2세션(AC20) | fold 입력 격리(전역 참조 0) | 세션 전환 중 갱신 | 세션 A 에서 mock 실행 → B 로 이동 → A 복귀 |
| 턴-후 갱신(AC11) | 경로 diff 0줄 | 실제 CLI 백그라운드 진행 | 실환경 Task 실행 후 턴 종료 관측 |
| CLI 가 TaskXXX 를 실제로 부르는가 | mock 으로 렌더 경로 독립 검증 | 실 CLI 관측 | 실환경 대화에서 목록이 차는지 |

## 9. 게이트 재실행

- 실제 실행 명령: `cd app && npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check`
- **관측한 실행 산출**: lint `0 error / 1 warning` · typecheck 출력 0줄 · vitest `235파일 / 2413케이스 / 실패 0` · inventory 3줄 ok
- `npm test` 사용: 안 함. DB 스위트는 `npm rebuild better-sqlite3`(Node ABI) 후 일반 vitest 로 돌아갔다 — 구현자가 ABI 를 맞춰둔 상태를 그대로 썼다.
- 환경 기인 실패 분리: `chat-turn.continuity.test.ts` 로드 실패 = `Electron failed to install correctly`(ELECTRON_SKIP_BINARY_DOWNLOAD 설치). **stash 후 기준선 재현으로 확인** — 변경 무관.
- **게이트가 작업 트리를 바꿨는가**: `npm run lint` 는 `--fix` 지만 실행 후 `git status --short` **빈 출력** — 트리 변화 0.
- **검증 중 실행한 명령의 잔여물**: probe 테스트 1개를 `app/src/probe.test.ts` 에 임시 생성 후 **삭제 확인**(`git status` 빈 출력). `node_modules` 는 커밋 대상 아님.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료 |
| AC ↔ production path | 25행 1:1 대조 완료, 1건 ❌ |
| 레이어/계약/링크 | boundaries·inventory 통과 |
| AGENTS 위생 | 해당 없음(AGENTS 미변경) |
| 제품 의도 | D-004 가 명세 §2 보다 좁다는 사실은 사용자 확정 사항 — 재론 없음 |
| UI 시각 품질 | 로직 기계 검증, 시각은 **사람** |
| 신규 의존성 / merge | 신규 의존성 0. merge 는 **사람** |

## 11. Repository operation checks

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

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| EP-07 지점 2→3 정정 제안 | **타당** — 실측으로 확인 | 다음 설계 턴에서 §10 정정 |
| `structuredOutput` 이름이 기존 capability 플래그와 겹침 | 타당 | D7(NEXT_HANDOFF) |
| `parts.ts` 결과맵 3벌 → 1벌 통합(선조치) | **타당** — 동작 무변화, 기존 테스트 green | 유지 |
| mock 시나리오 개수를 제목에서 제거(선조치) | 타당 — 저장소 원칙과 같은 축 | 유지 |
| 중단 흐름을 `features/chat/` 로 이동(설계 대비 차이) | 타당 — 4축 재유도 완료 | 유지 |
| AC21 을 ⚠️ 로 자기보고 | **부정확** — 실제는 ❌ | D1 |

## Review Signals — 사실만

- 이전 라운드와 동일/유사 증상인지: r1 이라 해당 없음.
- 관련 plan 지침/AC 가 있었는지: **있었다** — AC21 이 "`실패` 로 정착" 을 명시했고 §7 검증 수단도 "기존 `settleDeadBackgroundTasks` 회귀 UT + 파생 UT" 로 적었다. 구현자가 **파생 UT 를 만들지 않고** "경로 무변경" 으로 대체한 것이 누락 지점이다.
- 사용자 결정 변경 근거: D-012→D-014 는 사용자 `/handoff-impl` 명시 호출로 성립.
- 반복된 검증 환경 한계: `chat-turn.continuity.test.ts` 가 electron 바이너리를 요구해 이 환경에서 로드 실패(기준선 동일).
- 자기 검증 한계: 설계·구현·검증이 같은 에이전트다. 기준선 커밋 분리와 변이 재실행으로 완화했으나 **독립성은 구조적으로 제한된다** — 시각 5항목과 실환경 CLI 관측은 사람 몫으로 남는다.
