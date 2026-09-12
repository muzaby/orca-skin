# Verify — 0230-background-task-ux-conformance

> 검증 절차는 [`.agents/skills/handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0230-background-task-ux-conformance` |
| 검증자 | Claude Code |
| 일자 | 2026-09-11 |
| 대상 커밋/range | `3518999..3e676fa` |
| 구현 전 plan 기준 | `3518999` (EP-06 규범 정정) |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `3518999:V1` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **설계·구현·검증 동일 에이전트.** §4에 따라 구현 보고가 이름을 대지 않은 적대 축 3개를 추가했다 — M-V1(프로덕션 호출부 변이) · §10 분모 독립 재열거 · D3 실측 렌더. **그중 M-V1이 이번 FAIL의 근거다** |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — **삭제는 `| 상태 | **READY** |` 한 줄뿐**이다.
  `git diff 3518999..3e676fa -- .../plan.md | grep '^-'` → 1건.
- **기준선이 diff로 성립하는가**: 예. 규범 정정(`3518999`)이 구현(`3e676fa`)과 별도 커밋이다.
- Decision Ledger 변경: 없음(삭제 0건).
- Product/UX Contract 변경: 없음.
- AC 변경: 없음 — AT-01~AT-12 원문 그대로 채점했다.
- V node/pair·requiredness·§10·oracle 변경: 없음(구현 커밋 기준). `3518999`가 EP-06 술어와 지점
  목록을 바꿨고 그것이 채점 기준이다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 상속할 기존 V 없음(0212는 V 미작성) |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01~R-07·SD-01·AR-01~04·MD-01~02 전부 pair 보유 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | VP-12가 §0.10 회귀 대상을 받는다 |
| pair별 path·§10 전수·직접 oracle | **부분 — VP-02** | VP-02의 path는 `tool_result → tool.call.completed → 트래커`인데 oracle이 그 경로를 지나지 않는다(D1) |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 5 pair가 이유와 함께 선택 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | 5종, 무관한 기존 실패를 blocking으로 올리지 않았다 |

- root PLAN_GAP: **없음.** D1은 계획 누락이 아니라 **oracle이 선언한 경로를 지나지 않는 구현
  결함**이다 — plan은 path를 정확히 적었고 테스트가 그 path를 대신 재구현했다.

## 1. Product & UX / ACTIVE Decision

| Decision | 기대 결과 | 실제 production path | 판정 |
|---|---|---|---|
| D-004 도구 이름 > `task_type` | Monitor와 셸이 갈린다 | `claude-map.ts:159-163` → `taskKindFrom` | ✅ AT-02·Monitor 케이스 |
| D-005 이벤트 개명 없음 | `subagent.task` 유지 + 필드 추가 | `ipc.ts` union 그대로 | ✅ |
| D-006 정착 kind 게이트 | 셸 stdout 생존 | `subagent-settlement.ts:61-63` | ✅ AT-07·AT-08 |
| D-007 런치 영수증 확장 | 셸도 추적 유지 | `turn-coordinator.ts:522` | ⚠️ **코드는 맞으나 잠기지 않았다**(D1) |
| D-001·D-002 | 0231 소관 | — | 범위 밖 |

## 2. V-pair closeout (UT → IT → ST → AT)

| Pair | 레벨 | 판정 | 관측 |
|---|---|---|---|
| VP-10 | MD↔UT | PASS | 우선순위 5케이스 · M3 red 2건 |
| VP-11 | MD↔UT | PASS | fold 단독 · AT-05/AT-10 |
| VP-01 | R↔AT | PASS | `claudeToNormalized` 직접 호출 11케이스 |
| VP-08 | AR↔IT | PASS(대체 oracle) | plan은 store 흡수를 적었으나 실제 소비자는 tracker·settlement 3지점. 구현자 보고와 일치 |
| VP-09 | AR↔IT | PASS | 영속 파트만으로 카드 복원 · M5 red 3건 |
| VP-05 | R↔AT | PASS | 투영 4 + 렌더 2케이스 · AT-10 음성 |
| VP-03 | R↔AT | PASS | fold 6 + 렌더 10케이스 · M4 red 13건 · M6(형제) red |
| VP-06 | R↔AT | PASS | 조인 3케이스 |
| VP-04 | AR↔IT | PASS | 정착 5케이스 · M2 red 3 · M7(형제 반전) red 4 · M8 red |
| VP-12 | REGRESSION | PASS | 에이전트 카드·통지·정착 회귀 + 우측패널 295케이스 green |
| **VP-02** | **AR↔IT** | **PAIR_FAIL** | **D1 — 선언한 production path를 oracle이 지나지 않는다** |
| VP-07 | SD↔ST | `BLOCKED_BY:VP-02` | plan이 요구한 "fake 채널 1회 end-to-end"가 없다. 그 경로의 핵심이 VP-02의 호출부다 |

### VP-02 PAIR_FAIL 근거 (D1)

`shell-background.test.ts:18-24`가 코디네이터 분기를 **로컬 재구현**한다.

```ts
function applyToolCompletion(tracker, ev) {
  if (readLaunchReceipt(ev)) tracker.markAsyncLaunched(SESSION, ev.toolRunId)
  else tracker.settled(SESSION, ev.toolRunId)
}
```

프로덕션 호출부(`turn-coordinator.ts:522`)를 **구 술어로 되돌리는 변이**를 심었다. 이것은 0230이
고치려는 결함 자체(셸 영수증 무시 → 백그라운드 명령이 추적에서 빠짐)를 복원한다.

| 변이 | 결과 |
|---|---|
| `turn-coordinator.ts:522` 를 `isAsyncLaunchedPayload(ev.result)` 로 환원 | **전 스위트 4571케이스 green** |

구현자가 보고한 M1(`task-kind.ts` 술어 제거)은 red였지만, 그 red는 로컬 재구현이 같은 공유 함수를
부르기 때문이다 — 술어는 잠겼고 **배선은 잠기지 않았다**.

**환경 한계가 아니다.** `turn-coordinator.test.ts`는 fake runtime으로 이벤트를 흘리는 하네스를 이미
갖고 `tool.call.completed` 를 9회 사용한다 — 그 하네스에 셸 영수증 이벤트를 한 건 흘리면 닫힌다.

## 3. §10 강제 지점 독립 재열거

구현자 보고와 **별개로** 다시 셌다. 술어를 해법 이름이 아니라 불변식의 주어로 썼다.

| EP | 지점 | 재측정 | 일치 |
|---|---|---:|---|
| EP-01 부착 | `rg "taskKind !== undefined \? \{ taskKind \}" claude-map.ts` | 2 | ✅ |
| EP-02 호출 | `rg "taskKindFrom\(" src \| grep -v test \| grep -v "export function"` | 2 | ✅ |
| EP-03 강제 | `rg "readLaunchReceipt\(" …` | 1 | ✅ (지점은 맞고 **잠금이 없다** — D1) |
| EP-04 투영 | `rg "shellBackground \}" claude-map.ts` | 1 | ✅ |
| EP-05+07 술어 | `rg "isBackgroundTaskCall\(part, resultByRun\)" parts.ts` | 2 | ✅ (두 EP가 같은 집합) |
| EP-06 게이트 | `rg "settlementOverwritesOwnResult\(task\)"` | 1 | ✅ |
| EP-06 생산자 | `rg "phase: 'settled'" src/main \| grep -v test` → 4, 그중 mock 1 제외 = 3 리터럴 + 변수 경로 1 | 4 | ✅ |

**grep 술어의 사각을 따로 확인했다**: `const phase` 로 settled 를 내는 생산자는
`claude-map.ts:184-195` 하나뿐이다(`rg "const phase" src/main` → 1건). 구현자가 수기로 더한 그
1건이 실재하므로 분모 4는 옳다.

합계 재검산: `2+2+1+1+2+1+4 = 13`. 구현자 보고 `13/13` 과 일치한다.

## 4. 역방향 탐색 — 기준 밖 발견

| # | 발견 | 관측 | 분류 |
|---|---|---|---|
| D2 | `subagentTaskDescription` 이 0149가 없앤 O(전체 파트) 비용을 되살렸다 | `parts.ts:289` 가 `resultMap(messages.flatMap(...))` 를 **매 호출** 빌드한다. 바로 위 주석(`parts.ts:281-283`)이 그 비용을 없앤 이유를 적고 있다 — 함수 헤더와 본문이 서로 다른 말을 한다 | NON_BLOCKING |
| D3 | 셸 완료 통지를 누르면 상세가 stdout 을 "에이전트 답변" 자리에 그린다 | 실측 렌더: `<div …>RUN v4</div>` 만 나온다. 명령도 없고 `noChildActivity` 문구도 없다 | NON_BLOCKING |
| D4 | `settleSubagentTask` 의 `openToolRuns.delete(parentId)` 가 셸에서 실행되지 않는다 | 부모 이벤트를 안 내므로 루프가 안 돈다. 다만 셸은 자기 `tool_result` 에서 이미 삭제되므로 현재 경로에선 무해하다 | NON_BLOCKING |

D2는 고치기 쉽다 — `isBackgroundTaskCall` 은 그 `toolRunId` 의 결과 하나만 필요하다. Map 전체를
만들 필요가 없다.

## 5. 운영 gate — 관측한 산출

| Gate | 산출 | 판정 |
|---|---|---|
| vitest | **491파일 / 4571케이스 · 실패 0 · skip 3** | ✅ |
| 수집 오류 6파일 | `Electron failed to install correctly`. 변경 전 트리에서 **동일 6건**(`git stash` 후 측정) | 환경 — 변경 무관 |
| typecheck | `error TS` **0건** (3구성) | ✅ |
| lint | **0 error / 1 warning**(`useTranscriptVirtualizer.ts` — 미수정 파일) | ✅ |
| lint 후 트리 변화 | `git status --short` **0줄** — autofix가 검증 대상을 바꾸지 않았다 | ✅ |
| build | `electron-vite build` 3번들 성공 | ✅ |
| doc-inventory | 3검사 통과 | ✅ |
| 검증 잔여물 | D3 프로브 파일 제거 확인 — `git status` 0줄 | ✅ |

## 6. Repository operation checks

| 검사 | 판정 | 관측 |
|---|---|---|
| commit trailer 파싱 | ✅ | `git log -1 --format='%(trailers:only=true)' 3e676fa` → 7키 전부 반환 |
| trailer 허용값 | ✅ | `Agent: claude` · `Status: implemented` · `Verified-By: pending` |
| 규범 정정 커밋 분리 | ✅ | `3518999`(designed) ↔ `3e676fa`(implemented) |
| `[구현자 기입]` 7필드 | ✅ | 설계리뷰·강제지점·잠금·Product/UX·잠재문제·구현보고·ReviewSignals 전부 표로 존재 |
| INDEX 비고 5줄 | ✅ | 4줄 |
| 인용 커밋 실재 | ✅ | `git cat-file -t 5db40b0` → commit |
| IPC 계약 갱신 | ✅ | `IPC_CONTRACT.md` `subagent.task` 행에 `taskKind` |

**대상 커밋 좌표 기입**: INDEX 의 `(r1 구현 — 검증자 기입)` 을 `3e676fa` 로 채운다.

## 7. 판정

**FAIL** — VP-02가 `PAIR_FAIL`이고 VP-07이 그것에 종속된다. 나머지 10 pair와 운영 gate 7종은 PASS다.

코드 자체는 옳다. `turn-coordinator.ts:522` 는 올바른 술어를 부르고 있고, 결함은 **그 줄이 잠기지
않았다**는 것이다. 다음 라운드는 기능을 다시 만들지 않고 증거를 프로덕션 경로로 옮긴다.

## Review Signals — 사실만

- 이전 라운드와 동일/유사 증상인가: r1이라 해당 없음.
- 관련 plan 지침·AC가 있었는가: **있었다.** VP-02의 production path 칸이 `tool_result →
  tool.call.completed → BackgroundTaskTracker` 로 정확했다. 구현이 그 경로 대신 같은 형상의 로컬
  함수를 세웠고, 등록된 적대 증거(`술어를 좁히는 변이`)가 **공유 함수 쪽에서** red 를 내 통과했다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: electron 바이너리 egress 차단 — `npm test`·`npm run build` 의 pre 훅이
  막혀 `vitest`·`electron-vite build` 직접 호출로 우회했다. 0230 고유가 아니다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | 셸 런치 영수증 배선이 잠기지 않았다 — `turn-coordinator.ts:522` 를 구 술어로 되돌려도 4571케이스 green | verify r1 · **VP-02** · §10 EP-03 | `turn-coordinator.test.ts` 의 기존 fake runtime 하네스에 셸 영수증 `tool.call.completed` 를 흘려 `backgroundTasks.count()` 를 관측한다. 로컬 `applyToolCompletion` 재구현은 지운다 | **BLOCKING** | open |
| D2 | `subagentTaskDescription` 이 0149가 없앤 O(전체 파트) 비용을 되살렸다(`parts.ts:289`) | verify r1 · 역방향 | `isBackgroundTaskCall` 이 Map 대신 `(toolRunId) => result` 조회를 받게 좁힌다 — 통지 행은 결과 하나만 필요하다 | NON_BLOCKING | open |
| D3 | 셸 완료 통지 클릭 시 상세가 stdout 을 에이전트 답변 자리에 그린다(명령·맥락 없음) | verify r1 · 역방향 | 셸 작업은 상세 진입을 막거나 전용 상세를 준다. 카드에서 이미 막았으므로 통지 행도 같은 규칙이 맞다 | NON_BLOCKING | open |
| D4 | 셸 정착이 `openToolRuns.delete(parentId)` 를 지나지 않는다 | verify r1 · 역방향 | 현재 경로에선 `tool_result` 가 먼저 지우므로 무해하다. 정착이 결과보다 먼저 오는 순서에서만 문제가 된다 — 관측되면 그때 닫는다 | NON_BLOCKING | open |

---

# r2 — 라운드 2

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 일자 | 2026-09-12 |
| 대상 커밋/range | `3e676fa..355ab30` |
| 구현 전 plan 기준 | `3e676fa` (r1 구현) |
| V mode / 유효 V | `Baseline V: V1` — r2 는 V 를 바꾸지 않았다 |
| 라운드 | 2 |
| 상태 | **PASS** |
| 자기 검증 여부 | **설계·구현·검증 동일 에이전트.** §4에 따라 구현 보고가 이름을 대지 않은 적대 축 4개를 세웠다 — A1(같은 계약을 호출부에서) · A2(형제 조회 의미) · A3(EP-04 의 음성 절반) · VP-07 수명주기 프로브. **A2 가 이번 비차단 발견 D7 의 근거다** |

## 0. 기준선 / plan 변경 확인 (r2)

- 구현 커밋의 `plan.md` 삭제 줄: **1건** — `| 상태 | **impl/IMPL_DONE** (r1) |`.
  `git diff 3e676fa..355ab30 -- .../plan.md | grep -c '^-[^-]'` → 1.
- Decision Ledger · Product/UX Contract · AC · V node/pair · §10 · oracle: **변경 0**.
  AT-01~AT-12 원문 그대로 채점했다.
- 기준선이 diff 로 성립하는가: 예. `3518999`(규범) → `3e676fa`(r1) → `355ab30`(r2) 가 갈린다.
- 새 `PLAN_GAP`: 없음.

## 1. r1 root 결함의 종결 — D1

**PASS.** r1 의 `PAIR_FAIL`(VP-02) 근거였던 인용 변이가 이제 검출된다.

| 인용 변이 | r1 | r2 |
|---|---|---|
| `turn-coordinator.ts:522` → `readLaunchReceipt(ev)?.kind === 'agent-async'` | **green (4571 전건)** | **red 1** — `AT-03: backgroundTaskId 결과가 코디네이터를 지나도 추적이 줄지 않는다` |

r1 이 지적한 로컬 재구현(`applyToolCompletion`)은 사라졌고, 테스트가 프로덕션
`TurnCoordinator.run` 을 fake runtime 으로 실제로 돌린다(`shell-background.test.ts:22-68`).

## 2. 덮개 회귀 — r1 red 변이 전건 재실행

**red → green 0건.** r1 이 red 로 관측한 8변이를 전부 다시 심어 재측정했다.

| 변이 | r1 red | r2 red |
|---|---:|---:|
| M1 `task-kind.ts` 셸 영수증 분기 제거 | 1 | 1 |
| M2 정착 kind 게이트 제거 | 3 | 4 |
| M3 `taskKindFrom` 우선순위 뒤집기 | 2 | 2 |
| M4 `parts.ts` 포함 술어를 이름만으로 | 13 | 16 |
| M5 셸 투영 미부착 | 3 | 3 |
| M6 형제 맞바꿈 — 셸 카드에 에이전트 라벨 | 1 | 2 |
| M7 형제 맞바꿈 — 정착 게이트 반전 | 4 | 6 |
| M8 watchdog 정착에서 종류 제거 | 1 | 1 |

늘어난 넷(M2·M4·M6·M7)은 r2 가 같은 계약에 관측 지점을 더한 결과다. 구현 보고의 수치와
전건 일치한다.

r2 가 새로 등록한 배선 변이도 그대로 재현했다 — W1 1 · W2 2 · W3 1 · W4 4 · W5a 2 ·
W5b 4 · W5c 2 · W6 6 · W7 1. 보고와 전건 일치.

## 3. V-pair closeout (r2)

| Pair | 레벨 | 판정 | 관측 |
|---|---|---|---|
| VP-01 | R↔AT | PASS | `claude-map.taskKind` 11케이스 · M3 red 2 |
| VP-02 | AR↔IT | **PASS** | r1 root 종결(§1) · W1 red 1 · 음성 대조 red |
| VP-03 | R↔AT | PASS | M4 red 16 · M6 red 2 · W4 red 4 |
| VP-04 | AR↔IT | PASS | M2 red 4 · M7 red 6 · W3 red 1 · M8 red 1 |
| VP-05 | R↔AT | PASS | M5 red 3 · **A3(EP-04 음성 절반) red 3** |
| VP-06 | R↔AT | PASS | W5a/b/c red 2/4/2 · 실측 렌더(§5) |
| VP-07 | SD↔ST | **PASS** | 수명주기 프로브(§5) · 등록 적대증거(정착 누락) red 4 |
| VP-08 | AR↔IT | PASS | EP-01 부착 2지점 · W6 red 6 |
| VP-09 | AR↔IT | PASS | 영속 파트만으로 카드 복원 · M5 red 3 |
| VP-10 | MD↔UT | PASS | 우선순위 5케이스 · M3 red 2 |
| VP-11 | MD↔UT | PASS | fold 단독 · M4 red 16 |
| VP-12 | REGRESSION | PASS | 전 스위트 4578 green · 에이전트 통지 행이 어포던스를 유지한다(§5) |

`PASS 12 / PAIR_FAIL 0 / BLOCKED_BY 0`.

## 4. §10 강제 지점 독립 재열거 (r2)

**13/13 일치.** 구현자의 리터럴 grep 대신 **불변식의 주어**(호출부·이벤트 생산자)로 다시 세고
주석 줄을 제외했다 — 차집합 0.

| EP | 재열거 기준 | 지점 | 좌표 |
|---|---|---:|---|
| EP-01 | `subagent.task` 생산자 중 `taskKind` 부착 | 2 | `claude-map.ts:197`·`:324` |
| EP-02 | `taskKindFrom(` 호출부(정의 제외) | 2 | `claude-map.ts:165`·`:314` |
| EP-03 | `readLaunchReceipt(` 호출부(정의 제외) | 1 | `turn-coordinator.ts:522` |
| EP-04 | `readShellBackground(` 호출부(정의 제외) | 1 | `claude-map.ts:632` |
| EP-05+07 | `isBackgroundTaskCall(` 호출부(정의 제외) | 2 | `parts.ts:329`·`:397` |
| EP-06 게이트 | `settlementOverwritesOwnResult(` 호출부 | 1 | `subagent-settlement.ts:88` |
| EP-06 생산자 | `phase: 'settled'` 를 내는 프로덕션 생산자 | 4 | `claude-map.ts:184`(변수)·`:319` · `settle.ts:108` · `stop-subagent.ts:104` |

합계 `2+2+1+1+2+1+4 = 13`.

- **mock 제외의 근거를 확인했다**: `mock-scenarios.ts:276` 이 다섯 번째 `settled` 생산자이고
  종류를 싣지 않는다. mock 은 셸 백그라운드를 만들지 않으므로(투영 없음) 부모 결과 합성이
  종전 에이전트 경로대로 도는 것이 옳다 — 누락이 아니다.
- **`phase: 'updated'`·`'progress'` 생산자**(`claude-map.ts:338`·`:496`)는 정착이 아니라
  분모 밖이다.

## 5. 검증자 신설 적대 축 — 구현 보고에 없던 것

| 축 | 무엇을 다르게 깼나 | 결과 |
|---|---|---|
| A1 | 목록 fold 의 조회 콜백 배선(`parts.ts:397`)을 `() => undefined` 로 — 술어 본문이 아니라 **호출부**를 깬다 | **red 12** — 배선 잠김 |
| A2 | `findResult` 를 last-wins 로 뒤집어 `resultMap` 과 정렬 | **전 스위트 4578 green** — 잠금 없음(D7) |
| A3 | EP-04 의 음성 절반 — 투영 대신 raw `tool_use_result` 를 싣는다 | **red 3** — "raw 를 싣지 않는다" 도 잠김 |
| VP-07 프로브 | 추적기를 감싸 `started → 영수증 → 정착` 을 **한 코디네이터 실행**으로 흘리고 각 단계를 관측 | 아래 |

VP-07 프로브 관측(프로브 파일은 삭제, 트리 0줄 확인):

```text
started sh1 kind=shell count=1 kindOf=shell
markAsyncLaunched sh1 count=1 async=true
settled sh1 count=0
```

실측 렌더(같은 방식의 프로브) — 셸 통지 행과 에이전트 통지 행:

| 행 | `role="button"` | `tabindex` | `cursor-pointer` | 꺾쇠 |
|---|---|---|---|---|
| 셸(`PowerShell` + 영수증) | 없음 | 없음 | 없음 | 없음 |
| 에이전트(`Task`) | 있음 | `0` | 있음 | 있음 |

D3 는 닫혔고 VP-12 의 에이전트 경로는 그대로다.

## 6. 운영 gate — 관측한 산출 (r2)

| Gate | 산출 | 판정 |
|---|---|---|
| vitest | **492파일 / 4581케이스 — 4578 pass · 3 skip · 0 fail** | ✅ |
| 수집 오류 6파일 | 전부 `Electron failed to install correctly` — 변경 전과 동일 6건 | 환경 |
| typecheck | 3구성 exit 0 · `error TS` **0건** | ✅ |
| lint | **0 error / 1 warning**(`useTranscriptVirtualizer.ts` — 미수정 파일) | ✅ |
| lint(`--fix`) 후 트리 | `git status --short` **0줄** — 검증자 실행이 대상을 바꾸지 않았다 | ✅ |
| build | `electron-vite build` exit 0 · 3번들 | ✅ |
| doc-inventory | 3검사 통과(9 items · 92 channels) | ✅ |
| 검증 잔여물 | 프로브 2개 삭제 · 워크트리 1(저장소 자신) · `git status` 0줄 | ✅ |

## 7. Repository operation checks (r2)

| 검사 | 판정 | 관측 |
|---|---|---|
| trailer 파싱 | ✅ | `git log -1 --format='%(trailers:only=true)' 355ab30` → 7키 전부 반환 |
| trailer 허용값 | ✅ | `Agent: claude` · `Status: implemented` · `Criteria-Met: 12/12` · `Verified-By: pending` |
| 인용 커밋 실재 | ✅ | `5db40b0`·`3518999`·`3e676fa`·`355ab30` 전부 `commit` |
| `[구현자 기입]` 7필드 | ✅ | 설계리뷰·강제지점·잠금·Product/UX·잠재문제·구현보고·ReviewSignals 전부 표로 존재 |
| INDEX 비고 5줄 | ✅ | 4줄 |
| AGENTS.md 변경 | 해당 없음 | r2 는 건드리지 않았다 |
| 대상 커밋 좌표 | 기입 | INDEX 의 `(r2 구현 — 검증자 기입)` → `355ab30` |

## 8. 판정 (r2)

**PASS.** `REQUIRED` 11 · `REGRESSION` 1 전부 PASS, 운영 gate 5종 PASS, ACTIVE Decision
(D-004~D-007) 충족, `PLAN_GAP` 없음. 비차단 발견 5건은 아래 표에 두고 PASS 를 막지 않는다.

남은 사람 몫 1건: **Windows 실기.** 셸 백그라운드의 실제 SDK `tool_use_result` 가
`backgroundTaskId` 를 싣는다는 것이 이 handoff 전체의 전제인데, 스펙 문서 기준 추론이고
실제 페이로드를 관측한 적이 없다. 이 전제가 틀리면 12 pair 가 전부 옳아도 화면에 카드가 서지
않는다.

## Review Signals — 사실만 (r2)

- 이전 라운드와 동일/유사 증상인가: **아니다.** r1 의 root(`oracle 이 프로덕션 경로를 지나지
  않는다`)는 닫혔고, r2 의 발견 5건은 전부 비차단이며 다른 축이다.
- 관련 plan 지침·AC 가 있었는가: D6·D7 에는 없다 — 통지 행의 **종류 라벨**과 중복 결과의
  **조회 의미**는 §7 에도 §10 에도 행이 없다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: electron 바이너리 egress 차단(0230 고유 아님) · Windows 실기 불가.

---

## [검증자 기입] 파생 이슈 (r2)

r1 표의 상태는 그 자리에 둔다. 이번 라운드의 처분과 신규만 여기 적는다.

| # | 이슈 | 출처 | 처분 | 분류 |
|---|---|---|---|---|
| D1 | 셸 런치 영수증 배선이 잠기지 않았다 | verify r1 · VP-02 | **closed** — 인용 변이 W1 이 red 1 (§1) | — |
| D2 | `subagentTaskDescription` 이 O(전체 파트) 비용을 되살렸다 | verify r1 · 역방향 | **closed** — `grep -c "resultMap(messages.flatMap" parts.ts` → 0 | — |
| D3 | 셸 통지 행이 상세 진입 어포던스를 준다 | verify r1 · 역방향 | **closed** — 실측 렌더에 `role="button"`·꺾쇠 없음 (§5) | — |
| D4 | 셸 정착이 `openToolRuns.delete(parentId)` 를 지나지 않는다 | verify r1 · 역방향 | **open 유지** — 현재 경로에서 재현 불가. 정착이 결과보다 먼저 오는 순서가 생기면 그때 닫는다 | NON_BLOCKING |
| D5 | `subagentTaskDescription` 의 **프로덕션 참조가 0**이다 — 유일한 소비자였던 통지 행이 `subagentTaskJoin` 으로 옮겨갔고 래퍼만 남았다. 두 테스트 파일이 그것을 단언한다 | verify r2 · 역방향(`scan-surface` §2) | 래퍼를 지우고 두 테스트를 `subagentTaskJoin` 으로 옮긴다. AT-12 의 프로덕션 잠금은 `shellNoticeRow.render.test.ts` 가 이미 갖는다 | NON_BLOCKING |
| D6 | 셸 통지 행의 라벨이 `Agent "npx vitest run src/main" finished` 다 — `chat.subagentNotice.agentLine` 이 종류와 무관한 고정 문구다 | verify r2 · 실측 렌더 | 이 handoff 가 고치는 결함과 같은 부류지만 §6 범위는 "제목 조인 확장" 까지다. `joined.kind` 가 바로 그 자리에 있으므로 0231 이 한 줄로 닫는다 | NEXT_HANDOFF |
| D7 | `subagentTaskJoin.findResult` 는 **first-wins**, `resultMap` 은 **last-wins** 다. 같은 `toolRunId` 에 결과가 둘이면 통지 행과 타일이 갈린다 — reducer 는 `tool.call.completed` 마다 파트를 **append** 한다 | verify r2 · A2 | 종류 미확인 정착(EP-06 이 현행으로 남긴 경로)에서 타일은 카드를 잃고 통지 행은 남는다. A2(last-wins 로 정렬)가 전 스위트 green 이라 **어느 쪽도 잠기지 않았다**. 0233(상태 정확성)이 의미를 하나로 고정한다 | NON_BLOCKING |
| D8 | 비대화형이 된 셸 통지 행이 `group-hover/notice:text-t9` 를 유지한다 — 누를 수 없는 행이 hover 에 반응한다 | verify r2 · 실측 렌더 | 구현 보고의 "누를 수 있게 보이지 않는다" 는 role·포인터·꺾쇠까지만 참이다. hover 틴트는 남았다 | NON_BLOCKING |
| D9 | 구현 보고의 VP-07 자기확인이 "시작→영수증→정착이 **한 코디네이터 실행**을 지난다" 로 적혔으나 커밋된 스위트는 두 실행으로 갈라져 있고 `started` 는 추적기에 직접 심는다 | verify r2 · §5 | 검증자 프로브로 한 실행 전 구간을 관측해 동작은 확인했다(§5). 커밋된 증거에 그 케이스를 한 건 더한다 | NON_BLOCKING |
