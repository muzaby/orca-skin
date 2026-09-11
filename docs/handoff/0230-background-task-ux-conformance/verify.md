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
