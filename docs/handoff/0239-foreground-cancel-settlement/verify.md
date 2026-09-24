# Verify — 0239-foreground-cancel-settlement

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

# r1 검증 (r1.2 + r1.3 구현)

## 메타

| 항목 | 값 |
|---|---|
| slug | `0239-foreground-cancel-settlement` |
| 검증자 | Claude Code |
| 일자 | 2026-09-24 |
| 대상 커밋/range | `cb5d828..598d30b` — 구현 `2b37105`(r1.2 main·shared, Claude) · `598d30b`(r1.3 renderer·패널·문서, Codex) |
| 구현 전 plan 기준 | `f93c771`(ΔV1 rev.4) — `2b37105`는 rev.3 `05bf53f` 위에서 구현 |
| V mode / 유효 V | `Delta V` / `V1 rev.2(d47f88b) + ΔV1 rev.1~4(4c6bcab·aa73e99·05bf53f·f93c771)` |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | **부분 해당** — V1·ΔV1 rev.1~3 설계와 r1.2 main/shared 구현이 Claude(다른 세션)다. 보고가 이름을 대지 않은 독립 변이 15축을 §4에 넣었다 |

## 0. 기준선 / plan 변경 확인

- ✅ 기준선이 diff로 성립한다 — 규범 행(Decision·AC·V·§10)은 설계 커밋 6개에만 있고 구현 커밋 2개는 plan 규범 행을 바꾸지 않았다.
  - `git diff f93c771 598d30b -- plan.md`: hunk 2개 = 메타 `상태` 1줄 + 하단 `r1.3 [구현자 기입]` 추가(`@@ -918,6 +918,145`).
  - `2b37105`는 plan.md를 건드리지 않았다(`git show --stat`: INDEX·inventory·app만).
- Decision Ledger·Product/UX·AC: 구현 커밋에서 변경 없음. AC 총수 18 유지.
- ⚠️ ΔV1 rev.4(`f93c771`, Δ12·VP-21·EP-06 ②c)는 **구현자(Codex)가 작성한 설계 커밋**이다(`Agent: codex`·`Status: designed`). 별도 커밋이라 §0 잠금은 성립하고, 내용을 독립 감사했다 — 아래 plan validity 마지막 행. 절차 사실은 §14에 둔다.
- 채점 기준: V1 §7 + ΔV1 대체 행(AC3 rev.2·AC5·AC10 rev.3·AC18 rev.3) + Δ11-4 §10 + Δ12.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 기준 V1 rev.2 `d47f88b` 실재, ΔV1 rev.1~4 커밋 전부 `git cat-file -t` = commit |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | AR-05·MD-07(VP-19·20), MD-02(VP-14 rev.2), AT-02·AT-04·MD-04·MD-05·AR-04·SD-01(rev.3 행), MD-08(VP-21) |
| INHERITED ↔ REGRESSION | 해당 없음 | r1이 production을 바꾸지 않아 V1 pair 전부가 REQUIRED(Δ6) |
| pair path·§10 전수·oracle | 유효 | rev.3에서 EP-04·06을 불변식 주어로 재집계(Δ11-1), rev.4가 EP-06 ②c 생산자 추가 |
| 선택 적대 증거 | 유효 | 등록 변이 38종이 자리까지 명시됨(VP-02 6 · 03 1 · 04 3 · 06 4 · 07 1 · 10 1 · 12 3 · 13 1 · 14 3 · 15 1 · 16 5 · 17 8 · 19/20 1) |
| SUPERSEDED 이관 | 유효 | Δ6·Δ11-5 이관표 — 버린 증거 0 |
| 운영 gate | 유효 | V1 §7-A 4종 + §19 스위트 |
| rev.4(Δ12) 내용 감사 | 유효 | 생산자 `background-task.ts:415`가 태스크 생산자 `mergeTask`의 `Math.max` 의미와 같다. D-003·AC14 문장 불변, 필드·저장 형상 불변. 독립 변이 U7(§4)이 red |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001·D-004 | 결과 없는 도구는 terminal 전 `실행되지 않음` | claude-map `telemetry`/`error` → `TurnCoordinator` `settleOrphanToolRuns(no_result)`(`turn-coordinator.ts:398-405`, `commitConsumed` 앞) → bus → writer·relay → `toolRunOutcome` → ToolCard |
| D-006 | 철회 신호는 열린 도구만 | `model_refusal_fallback`/`supersedes` → `tool.call.retracted` → coordinator `:352-355` 흡수 → `orphanToolRunIds` `openToolRuns ∩ only` |
| D-002·D-008·D-009 | SDK 사유를 실패와 구분 | `readToolResultMeta` → `nonExecution` → writer payload → `resultMap`(`parseNonExecution`) → `toolRunOutcome` → 13자리 |
| D-003·D-010·D-012·D-016 | 패널 카드 표시만 파생 | provider lane → `backgroundTaskDisplay`/`backgroundCallDisplay` → 그룹·라벨·경과·Stop·지우기 |
| D-005·D-011 | 포그라운드는 대기 아님 | `isForegroundTask` → `backgroundPending` → `tracker.hasPending` → post-turn `:109`·Stop `index.ts:168` |
| D-013·D-014·D-015 | 입력 경로 불변 · 값 비교 · 부모 무관 정착 | 입력 경로 diff 0 · `resultEquals` + `nonExecutionEquals` · `orphanToolRunIds` |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | ✅ | `error`는 claude-map이 `result` 에서만 낸다(`claude-map.ts:806-818`) — 비terminal `error`로 실행 중 도구를 닫는 경로 없음 |
| false success | ✅ | host 정착은 `isError:true`+`nonExecution`이라 `completed`로 보이지 않는다. 늦은 실제 결과는 DB upsert·`resultMap` last-wins(AC5 통합 `late-result`) |
| partial failure | ✅ | 정착 emit 은 기존 스트림 이벤트와 같은 팬아웃. `openToolRuns.delete`로 `telemetry`→`error` 이중 terminal에도 1회 |
| A 대신 B | ✅ | Q1~Q3 결과(실행되지 않음·사유 포함·호출 결과 표시)와 일치. `failed` 도구 문구가 완료 시제 → `실패`로 바뀐 것은 AC10 rev.3 요구 |
| 증상만 제거 | ✅ | pending 판정 자체가 바뀌어 post-turn `break`·Stop 체인 종료(AC12 하네스) |
| 잃은 관측 | ✅ | 정본 status·terminalEvidence 불변(AC16) — 표시만 파생 |
| worst-case 상한 | ✅ | 정착 수 ≤ 열린 도구 수, `toolRunIdsByMessageUuid` 2048 상한(`claude-map.ts:116`·상한 테스트) |
| retracted 이벤트 누출 | ✅ | `claudeToNormalized` 소비자는 `claude.ts:651` 하나 → session-runtime frame/unframed → coordinator만. 버스·relay 부재 테스트 `turn-coordinator.test.ts:1412-1413` |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh cb5d828..598d30b` — 대상 25파일.

| 후보 | 판정 | 근거 |
|---|---|---|
| `orphanToolRunIds` 테스트 전용 | 정상 | 같은 파일 `settleOrphanToolRuns`가 호출(`settle.ts:124-139`), export는 UT용 |
| `isAbortedResult` 프로덕션 0 | 정상 | `toolRunOutcome`(같은 파일)으로 흡수 — 파일 내부 호출 유지 |
| 그 밖 1a·1b·2 항목 | 비귀속 | 0239 이전부터 있던 심볼(`partsStructured`·`RETRY_BACKOFF_MS` 등) |
| 형제 정책 비대칭 | 없음 | 스크립트 3) 0건 |
| transcript 조인 키 순서 | NON_BLOCKING D2 | 패널 `call?.toolUseId ?? task.toolUseId`(`CanonicalBackgroundContent.tsx:113`) ↔ 지우기 `task.toolUseId ?? call?.toolUseId`(`backgroundStore.ts:75`) |
| `tool.call.retracted` 새 variant의 기존 소비처 | 무영향 | coordinator 흡수 뒤 `continue`. session-runtime `cliBusy`는 refusal 배치에서 true가 되지만 그 배치는 턴 중간이다 |

## 4. 적대 증거 재측정

### 등록 변이 38종 — 구현자 스크립트 재실행

`cd app && node ../docs/handoff/0239-foreground-cancel-settlement/evidence/r1.3-mutations.cjs` → **`Mutations: 38/38`**, 각 변이 뒤 원본 복구(`git status` 무변경).

| 변이 묶음 | pair | 이번 실패 케이스 수 | 결과 |
|---|---|---|---|
| 02-1·6·8·10·11·12 | VP-02 | 2·2·2·4·2·6 | red |
| 03-pending-foreground | VP-03/08/11 | 4 | red |
| 04-1·2·5 | VP-04 | 1·4·1 | red |
| 06-1·2·3·4 | VP-06 | 5·2·1·1 | red |
| 07-retract-closed-id | VP-07 | 1 | red |
| 10-writer-omit-meta | VP-10 | 1 | red |
| 12-1·2·3 | VP-12 | 1·1·1 | red |
| 13-interrupted-cancelled | VP-13 | 2 | red |
| 14-1·2·3 | VP-14 | 2·1·2 | red |
| 15-exclude-all-unknown | VP-15 | 5 | red |
| 16-record ×5 | VP-16 | TS2741 각 1 | red |
| 17 ×8 | VP-17 | 1·2·4·6·2·2·2·2 | red |
| 19-20-result-equality (M1) | VP-19/20 | 5 | red |

- 이전 라운드 red 변이: r1은 production 변이 0(PG-01 재현만) — PG-01 3축은 M1과 `nonExecution.test.ts:86` 3형으로 다시 red. 덮개 회귀 0.
- 등록 ⑫ "meta 판독 제거"를 구현자 스크립트는 `nonExecution = undefined`(meta+transcript 동시 제거)로 심었다 — 정확한 등록형은 U15로 별도 재현.

### 독립 변이 15축 — 구현 보고에 없던 지점

스크립트 `/tmp/…/verify-mutations.cjs`(원문은 이 절의 표가 재현 정보를 담는다). 각 변이 단독 적용 → `tsc` → 넓은 스위트(main 4경로·`src/shared`·renderer chat 중 해당분) → 복구.

| 변이 | 귀속 | tsc | 스위트 | 결과 |
|---|---|---:|---|---|
| U1 coordinator가 `hasCanonical` 무시(정본 없어도 `getState`) | VP-06/14 · EP-02 실패 의미 | 0 | 55파일 588 | **red 1** — coordinator `정본이 없으면 부모 있는 실행은 두고…` |
| U2 `isForegroundTask`에서 `liveMembership!=='included'` 절 제거 | VP-03/15 형제 절 | 0 | 295파일 2560 | **green** — 등가 변이(D3) |
| U3 `isForegroundTask`에서 `!backgroundObserved` 절 제거 | VP-03/15 형제 절 | 0 | 295파일 2560 | **red 1** — `task_updated is_backgrounded:true 승격…` |
| U4 claude-map `supersedes` 철회 제거 | VP-07/18 형제 진입점 | 0 | 55파일 588 | **red 1** |
| U5 claude-map `model_refusal_fallback` → `[]` | VP-07/18 형제 진입점 | 0 | 55파일 588 | **red 2** |
| U6 dismiss 가드를 옛 규칙(`running`이면 유지)으로 | VP-12 EP-06 ⑥a | 0 | 195파일 1541 | **red 2** — `clears returned foreground…`·`clears dead nonremote…` |
| U7 호출 `lastSeenAt` 생산자를 옛 값 유지로 | VP-21 EP-06 ②c | 0 | 240파일 1972 | **red 4** |
| U8 중단 버튼의 `!terminal` 가드 제거 | VP-04 EP-06 ③ | 0 | 195파일 1541 | **red 1** — `…no stop control` |
| U9 `resultMap`의 `nonExecution` 복사 제거 | VP-10 EP-01 ⑧ | 1 | 250파일 2129 | **red 27** |
| U10 reducer append의 `nonExecution` 제거 | VP-10 EP-01 ⑥ | 0 | 250파일 2129 | **red 9** — live↔LOAD_SESSION 동치 포함 |
| U11 claude-map tool_result의 `nonExecution` 제거 | VP-09 EP-01 ① | 1 | 250파일 2129 | **red 4** |
| U12 host 정착의 `nonExecution` 제거 | VP-01/09 EP-01 ② | 0 | 250파일 2129 | **red 11** |
| U13 `backgroundCallDisplay`의 transcript 조인 규칙 자체 제거 | VP-12/17 규칙 | 0 | 195파일 1541 | **green** — D1 |
| U14 `backgroundTaskDisplay`의 부모 반환 규칙 자체 제거 | VP-04/17 규칙 | 8 | 195파일 1541 | **red 6** |
| U15 등록 ⑫ 정확형 — `readToolResultMeta(call.meta)` 판독만 제거 | VP-02 ⑫ | 1 | 195파일 1541 | **red 6** |

- 15축 중 red 13 · green 2. U2는 reducer가 `included`를 줄 때 같은 항목에 `backgroundObserved:true`를 함께 쓰므로(`background-task.ts:372-393`) production 경로에서 구별 불가능한 등가 변이다.
- U13 green은 결함이 아니다 — 임시 프로브(taskless `Bash` 호출 + 일반 `{reason:'aborted'}`·성공 transcript 결과)가 현재 코드에서 `aborted`·`completed` settled로 통과하고 U13 적용 시 red였다(프로브는 실행 후 삭제). AC15 테스트는 host 정착 입력만 쓰고 그 입력은 앞의 `nonExecution` 분기가 받는다 — 일반 결과 분기를 잠그는 테스트가 없다(D1).

- 자리 미지정 등록 변이: 없음 — 38종 모두 자리가 적혀 있다.
- 형제 슬롯 맞바꿈: VP-02 `rejected↔cancelled` 3자리(①⑥⑧)+⑪, VP-13 `interrupted↔cancelled` — 전부 red.
- 순서 기준 관측 훅: coordinator 하네스의 버스 forwarded 배열(`turn-coordinator.test.ts:1299-1358`).

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | 결과 | 직접 증거 | 선택 증거 |
|---|---|---|---|---|
| VP-13 | MD-01↔UT-01 | PASS | `tool-outcome.test.ts` `nonExecutionOutcome` it.each | 13 red |
| VP-14 (rev.2) | MD-02↔UT-02 | PASS | `settle.test.ts` 정본 유무 2형 + coordinator AC3 경로 2케이스 | 14-1·2·3 red · U1 red |
| VP-15 | MD-03↔UT-03 | PASS | `background-task.test.ts` backgroundPending 6케이스 | 15 red · U3 red |
| VP-16 (rev.3) | MD-04↔UT-04 | PASS | Record 5곳 typecheck | 16 ×5 TS2741 |
| VP-17 (rev.3) | MD-05↔UT-05 | PASS | `canonicalBackground.settlement.test.ts` 우선순위·세대·원격·시각 | 17 ×8 red · U14 red · U13 green(D1, 동작은 프로브로 직접 확인) |
| VP-18 | MD-06↔UT-06 | PASS | `claude-map.test.ts` 철회 5케이스(매핑·미지 uuid·1회·tool_use 없음·상한) | not selected — U4·U5 red·red |
| VP-20 | MD-07↔UT-07 | PASS | `nonExecution.test.ts:86-148` 3형·같은 값 identity·ask | M1 red |
| VP-21 | MD-08↔UT-08 | PASS | `background-task.test.ts` first=1000·last=7000 + 패널 6초 | not selected — U7 red |
| VP-09 | AR-01↔IT-01 | PASS | typecheck 3구성 + mapper·settle 이벤트 형상 | not selected — U11·U12 red·red |
| VP-10 | AR-02↔IT-02 | PASS | `settlement.integration.test.ts` 5형 SQLite writer→reader→LOAD_SESSION 동치 | 10 red · U9·U10 red·red |
| VP-11 | AR-03↔IT-03 | PASS | tracker `hasPending`→post-turn·Stop 두 소비자 값 | VP-03 공유 red |
| VP-12 (rev.3) | AR-04↔IT-04 | PASS | 패널 렌더 `joins host settlement into taskless calls…` · clear 테스트 | 12-1·2·3 red · U6 red |
| VP-19 | AR-05↔IT-05 | PASS | `nonExecution.test.ts` RECV_EVENT 뒤 3형 transcript·Work 최종 결과 | M1 red |
| VP-06 (rev.3) | SD-01↔ST-01 | PASS | 버스 순서 `[started, completed:no_result, telemetry\|error]` 3경로 + steer `error`에서 `message.committed` 앞 | 06 ×4 red |
| VP-07 | SD-02↔ST-02 | PASS | coordinator AC4: 열린 a 정착·완료 b 불변·버스/DB에 retracted 부재 | 07 red |
| VP-08 | SD-03↔ST-03 | PASS | `post-turn.schedules.test.ts` AC12 4케이스(break·ready 대조·Stop 종료·Stop 유지 대조) | VP-03 공유 red |
| VP-01 (ΔV1) | R-01↔AT-01 | PASS | AC1~AC6 아래 | not selected |
| VP-02 (rev.3) | R-02↔AT-02 | PASS | AC7~AC10 아래 | 02 ×6 red · U15 red |
| VP-03 | R-03↔AT-03 | PASS | AC11·AC12 | 03 red |
| VP-04 (rev.3·rev.4) | R-04↔AT-04 | PASS | AC14~AC16·AC18 | 04 ×3 red · U8·U14 red·red |
| VP-05 (rev.3) | R-05↔AT-05 | PASS | AC13 로그 스파이 · AC17 문서 5·inventory `--check` | not selected |

- root `PAIR_FAIL`: 없음. `BLOCKED_BY`: 없음. 최초 검증이라 유효 V 21 pair 전건 실행.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | `turn-coordinator.test.ts:1299` 버스 순서 · `openToolRuns` 비움 |
| AC2 | ✅ | 같은 케이스의 `error`·합성 terminal 형(`:1326`·`:1331`) · steer `error` `:1334-1358` |
| AC3 (rev.2) | ✅ | `settle.test.ts` 5형 + coordinator AC3 경로 2케이스(`:1360`·`:1384`) |
| AC4 | ✅ | claude-map 철회 5케이스 · coordinator AC4(`:1395-1413`) |
| AC5 (ΔV1) | ✅ | `settlement.integration` `late-result` DB 단일 row · `nonExecution.test.ts` 3형 두 소비자 |
| AC6 | ✅ | `nonExecution.render.test.ts:30` host 2형 live/load 라벨·spinner 부재 |
| AC7 | ✅ | claude-map 5케이스(일치·불일치·배열 아님·빈 문자열·다중 결과) |
| AC8 | ✅ | `settlement.integration` 5형 · `nonExecution.test.ts:56` live↔LOAD_SESSION |
| AC9 | ✅ | `tool-outcome.test.ts` it.each + 기존 `deriveSubagentTaskStatus` running/completed/failed/aborted |
| AC10 (rev.3) | ✅ | `nonExecution.render.test.ts:71` 표면별 4분류 · `:165` failed 빨강 · Record 5곳 typecheck |
| AC11 | ✅ | `background-task.test.ts` 6케이스 |
| AC12 | ✅ | `post-turn.schedules.test.ts` 4케이스 · Stop 뒤 `after stop` 전달 |
| AC13 | ✅ | 같은 파일 AC12·AC13 케이스 — 로그 `haveTasks`=false, `taskCount` 별도 |
| AC14 | ✅ | `canonicalBackground.settlement.test.ts:80`·`:96` · 패널 렌더 `renders returned foreground work…`(6초·Stop 부재) · `:205` clear |
| AC15 | ✅ | `:162` 조인·선택 해제 · 패널 렌더 taskless host 정착 |
| AC16 | ✅ | `:80` 정본 status·terminalEvidence 불변 단언 |
| AC17 | ✅ | 문서 5곳 diff · `check-doc-inventory.mjs --check` 통과 |
| AC18 (rev.3) | ✅ | `:114` old-generation·terminated · `:136` 현재 connected · `:144` awaitingTask·remote · `:213` 지우기 |

- **합계 재측정**: ✅ 18 · ⚠️ 0 · ❌ 0 = 총 18. 자기보고 18/18과 일치.
- **합계 사본 대조**: plan 본문 18/18 ↔ `598d30b` trailer `Criteria-Met: 18/18` ↔ INDEX 비고 `18/18` — 일치.

### §10 강제 지점 분모 — 독립 재열거

| EP | plan 자리 | 재측정 | 방법 |
|---|---|---:|---|
| EP-01 | 8 | 8/8 | ①claude-map `:624-629` ②settle `:127-139` ③`ipc.ts:640` ④`ipc.ts:1476` ⑤writer `:445` ⑥reducer `:984` ⑦`ToolCall.result` `:81` ⑧`resultMap` `:219-223` — U9·U10·U11·U12로 ①②⑥⑧ 개별 확인 |
| EP-02 | 3 | 3/3 | `turn-coordinator.ts:398`(telemetry·error) · `:544`(합성) |
| EP-03 | 4 | 4/4 | `rememberToolRuns` · refusal 분기 · supersedes 선두 · coordinator `:352` |
| EP-04 | 13 | 13/13 | `git grep -n isError HEAD -- src/renderer/src ':!*.test.*'` 20줄 재분류 — 표시 판정 인라인 잔존 0(남은 줄은 `outcome` 파생·복사·비교·TaskXXX 관측 입력) |
| EP-05 | 4 | 4/4 | `backgroundPending` · `hasPending`(`background-tasks.ts:61-64` 위임) · post-turn `:109` · Stop `index.ts:168` |
| EP-06 | 14 | 14/14 | 구현자 audit 179행 − 분류 = `[]` 재실행 · U6·U8·U13·U14로 ⑥a·③·규칙 자리 개별 확인 |
| EP-07 | 15×2 | 30/30 | `git diff … ko.ts`·`en.ts` 추가 줄 각 15 |
| EP-08 | 5 | 5/5 | IPC_CONTRACT·provider-runtime·background-tasks·rendering diff + inventory `--check` |
| EP-09 | 1 | 1/1 | `post-turn.ts:109`·`:127` 같은 `haveTasks` |
| EP-10 | 3 | 3/3 | `resultEquals` · `AssistantMessage` · Work projector — M1 red |

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| lint | PASS | 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts:22`). 실행 후 `git status` 무변경 |
| typecheck | PASS | node·web·test 3구성, `error TS` 0 |
| 관련 테스트 §19 | PASS | 207파일 · 1800 통과 · 0 실패 · 0 skip(Node ABI `npm rebuild better-sqlite3` 후) |
| 문서 인벤토리 | PASS | 생성 후 diff 없음, `--check` prose·links ok |
| message-bus | PASS | 구현 3커밋 trailer 파싱 확인(§11) |

- 첫 실행은 DB 6파일 22 실패 — `better_sqlite3.node` 미빌드(ELECTRON_SKIP 설치)였고 Node ABI 재빌드 후 0 실패. 변경 무관 환경 한계.

## 8. 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 새 라벨 3종 두 테마 | SSR 라벨·`text-ink3`/`text-bad` 클래스 | light/dark에서 ToolCard·Work 타임라인·작업 패널의 `거부됨·취소됨·실행되지 않음·종료 확인 불가` 1회 |
| 실제 SDK 폐기 경로 | fixture 기반 mapper→DB→렌더 | 사내 프록시 스트리밍 폴백에서 spinner가 `실행되지 않음`으로 정착하는지(선택) |

## 11. Repository operation checks

- INDEX: 상태 `impl/IMPL_DONE`·다음 주체 Claude(검증) — 실제와 일치. 대상 커밋 자리표시자를 이번 턴에 `2b37105`·`f93c771`·`598d30b`로 기입(`git cat-file -t` = commit).
- trailer: `2b37105`(claude·partial·8/18·pending) · `f93c771`(codex·designed) · `598d30b`(codex·implemented·18/18·pending) — 3건 모두 파싱, 허용값.
- r1.3 `[구현자 기입]` 7필드 전수 존재.
- AGENTS 변경 없음.

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | 정본 반환 없는 호출 카드의 **일반 transcript 결과**(nonExecution 없음, 예: Stop `aborted` 합성·성공 결과) 분기가 테스트로 잠기지 않는다 — U13 green. 동작은 프로브로 정상 확인 | VP-12/17 · AC15 — plan이 지정한 oracle(host 정착 입력)은 충족 | NON_BLOCKING | 다음 턴에서 `backgroundCallDisplay` 일반 결과 2형 단언 추가 권장 |
| D2 | transcript 조인 키 순서 비대칭 — 패널 `call?.toolUseId ?? task.toolUseId` ↔ 지우기 `task.toolUseId ?? call?.toolUseId`. 호출 레코드가 task의 `toolUseId` 키로 존재하면 같은 값이라 실경로 차이 미관측 | EP-06 ①a ↔ ⑤a | NON_BLOCKING | 한 헬퍼로 통일 권장 |
| D3 | `isForegroundTask`의 `liveMembership!=='included'` 절이 reducer 경로에서 중복(U2 등가 변이) | VP-15 | NON_BLOCKING | 방어 절로 유지 가능 — 기록만 |
| D4 | r1.3 V-pair 자기확인의 VP-18 행이 "post-turn 로그"로 적혀 있다 — VP-18은 claude-map 철회 매핑(MD-06) | 구현 보고 정확성 | NON_BLOCKING | 기록만. 본 verify는 claude-map 5케이스·U4·U5로 판정 |
| D5 | ΔV1 rev.4 설계를 구현자가 작성했고 INDEX가 `plan/DRAFT`를 거치지 않았다. r1.2는 `[구현자 기입]` 없음 | 절차(§14) | NON_BLOCKING | review 신호로만 남김. rev.4 내용은 §0에서 독립 감사 유효 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: PG-01(비교 경계)·PG-02(생산자 누락) 모두 "소비자만 센 분모" 축이다. rev.3이 주어로 재집계했지만 시각 생산자는 rev.4에서야 보였다.
- 설계 주체: ΔV1 rev.4(`f93c771`)는 구현자(Codex)가 handoff-plan으로 전환해 별도 설계 커밋으로 작성했다. `docs/handoff/AGENTS.md §2`의 "PLAN_GAP으로 설계자에게 돌린다"와 다른 경로이며 INDEX가 `plan/DRAFT`를 거치지 않았다.
- r1.2(`2b37105`, Claude 부분 구현) 턴은 plan에 `[구현자 기입]`을 남기지 않았고 r1.3 기입이 선행 검토로 흡수했다([r1.3-review](evidence/r1.3-review.md)).
- 반복 환경 한계: `ELECTRON_SKIP_BINARY_DOWNLOAD` 설치 뒤 DB 스위트는 `npm rebuild better-sqlite3`가 필요했다.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED 21/21 PASS · root PAIR_FAIL 0 · BLOCKED_BY 0 · PLAN_GAP 0
- AC: ✅ 18 · ⚠️ 0 · ❌ 0 = 18 — 자기보고·trailer·INDEX 사본 일치
- 적대 증거: 등록 38/38 red · 독립 15축 red 13 · green 2(U2 등가, U13 → D1 동작 직접 확인)
- 운영 gate: lint 0 error · typecheck 0 · 관련 207파일 1800 통과 · inventory `--check` 통과 · trailer 파싱 3/3
- NON_BLOCKING: D1~D5. NEXT_HANDOFF 후보는 plan 비범위 A1·A3·A4·A6·A7 그대로
- 남은 사람 확인: 새 라벨 3종 + `종료 확인 불가`의 두 테마 시각(§8). 확인 뒤 INDEX 행 archive 이동
