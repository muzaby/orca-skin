# Verify — 0320-scheduled-tasks

> 절차 정본 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업 규칙 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0320-scheduled-tasks` |
| 검증자 | Claude Code |
| 일자 | 2026-11-16 |
| 대상 커밋/range | `8c3dbe2^..8eed0a5` — 구현 `3ac26fb`(r1) · `67d2514`(r1.2) · `50a27cd`(r1.3) · `8eed0a5`(r1.4). 코드(`app/`)는 `HEAD`와 `8eed0a5`가 같다(`git diff --stat 8eed0a5 HEAD -- app` 빈 출력) |
| 구현 전 plan 기준 | 구현 커밋마다 직전 설계 커밋: `d324a9f`(V1) · `9b6685a`(ΔV1) · `9cf2a6c`(ΔV2) · `c7a9b4e`(ΔV3) |
| V mode / 유효 V | `Baseline V: V1` / `V1 + ΔV1 + ΔV2 + ΔV3` |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** |
| 확장 창 | verify 1회째 — 창 안. 사용자 요구 변경 ΔV1~ΔV3은 이번이 첫 verify라 같은 창 |
| 독립 축(⑥) | 4축·변이 17 + 실제 프로세스 재현 2 — ① 값 형태(`text.trim`, `exitCode 0 ∧ timedOut`) ② 실제 프로세스로 제한 시간 재현 ③ 호출 대체(`startCron`→`intervalHandle`) ④ ΔV3 패널 본문(메타·토글·메뉴·`onOpenSession`) |
| 열거 sweep(⑦) | 범위 = §10 자리 전부(EP-1~7) + 등록 변이(VP-06·07·20) + ΔV3 path edge. **ΔV1·ΔV2 path edge(AC26~30) 변이는 이번 턴에 돌리지 못했다** — §4. 변이 98 · 못 잡음 19(분류 §4) |
| 발견 분류 | 이행 4 · 현재 1 · 확장 3(막음 3 — 창 안) · 경계 1 · 동치 1 · 비귀속 0 |
| 구현 주체·문맥 | Claude 구현 · Claude 설계 · Claude 검증 — 같은 에이전트라 plan validity는 자기 설계 감사다. 독립성은 ⑥의 실제 프로세스·다른 입력 축이 맡았다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋 4개가 `plan.md`를 바꿨다 — 전부 `[구현자 기입]` 추가(`git show --stat`: +138·+92·+91·+86줄). 규범 행(Decision·AC·V node/pair·§10) 변경은 `3ac26fb`의 V1 정정이 아니라 별도 설계 커밋 `d324a9f`에 있다.
- 기준선이 diff로 성립하는가: **예** — 설계 커밋(`8c3dbe2`·`d324a9f`·`9b6685a`·`9cf2a6c`·`c7a9b4e`)과 구현 커밋이 분리돼 있다.
- Decision Ledger·Product/UX·AC·V·§10: 구현 커밋에서 변경 없음. 채점 기준은 현재 plan의 AC1~AC34.
- 창 밖 ΔV 새 열거 항목: 해당 없음(1회째).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode·상속 | 유효 | Baseline V1 + 순서대로 ΔV1~3, 각 ΔV는 §20·21·22에 NEW/CHANGED/INHERITED |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | R-07~09 ↔ VP-21·23·26, MD-09 ↔ VP-22 등 |
| INHERITED ↔ REGRESSION | 유효 | VP-02·19·25·27 |
| §10 자리 목록(검색 재실행 차집합) | 유효 | EP-3 5줄(2줄은 내부 호출)·EP-5·EP-7(5줄 → 7자리)·EP-4·EP-6 재실행 — 목록과 차집합 ∅. EP-8 8식 전부 0줄 |
| 적대 증거 선택 이유 | 유효 | VP-06·07·20만 선택, 나머지 직접 oracle |
| `SUPERSEDED` 이관 | 해당 없음 | — |
| 운영 gate | 유효 | §7-A 표 + 각 ΔV는 "V1 §19와 같다" |
| **VP-26 oracle 좌표** | **좌표 불일치** | plan §22 VP-26이 `scheduleDetail.render.test.ts`(신규)·`schedulesScreen.render.test.ts` 신규 케이스를 적었으나 둘 다 없고 구현자가 `schedulesScreen.detail.test.ts`를 만들었다. 구현자 교체는 D5에서 이행 결함으로 다룬다 |

- root PLAN_GAP: 확장 3건(E1~E3, §13) — 설계자가 채택 또는 경계 선언.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-005·D-006 | 프롬프트 작업은 저장된 설정으로 새 대화, 보던 대화 불변 | `ScheduledTaskRunner.execute` → `PromptRelay.request` → `oo:schedule:promptStart` → `relayScheduledPrompt` → `chatActions.startDetachedChat` → `chat:send` |
| D-007 | shell은 PowerShell(win32)/`/bin/sh`, 폴더 cwd, 꼬리·종료 코드 | `execute` → `runShellCommand` |
| D-008·D-015 | 켜기/끄기·편집·삭제·지금 실행·이력을 우측 패널에서도 | `SchedulesScreen` → `DetailSidePane` → `ScheduleDetail` → 콜백 |
| D-011~D-014 | 모달 배치·칩·메뉴·아이콘 | `ScheduleTaskModal` → `MenuChip`·`ProjectPickerChip` |

## 2. 구현 결과 비판적 검토

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | **결함 1** | shell 제한 시간: `sh -c "sleep 4; echo x"`에 `timeoutMs=300` → 실제 4007ms 뒤 종료(고아 자식이 파이프를 잡아 `close`가 늦다). D4 |
| false success 가능성 | **결함 1** | `trap 'exit 0' TERM; sleep 5 & wait` + 300ms 제한 → `{"exitCode":0,"timedOut":true}`. runner의 `ok` 식 `&& !timedOut` 항이 이를 `실패`로 가르지만 그 항을 지워도 75케이스 green(W11). D3 |
| partial failure | 양호 | `create`의 sync 실패 → 저장 남고 방송은 한다(`service.ts` `synced` finally), 다음 부팅 복원이 재시도. plan §13 허용 |
| Product/UX의 A 대신 B | 해당 없음 | — |
| 증상만 제거 | 해당 없음 | — |
| 재검증·취소 관측 손실 | **결함 1** | 삭제 시 실행 중단(`service.delete` → `runner.cancel`) 배선을 지워도 green(V07). D1 |
| 출력·요청 worst-case | 유지 | 64KB × 50건 · `list`는 `lastRun` 출력 제외(`service.view` `listRuns(id,1,false)`) · 상한 수식은 plan §14와 코드 일치 |
| 지금 실행 `started:false` | ⚠️ 구현자 보고와 같음 | `schedulesActions.runNow`는 결과를 돌려주고 화면이 표시하지 않는다 — 메뉴가 `running`이면 비활성이라 창이 좁다. 보고만 |

## 3. 역방향 탐색

`scan-surface.sh 8c3dbe2^..8eed0a5`:

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 값 export 6(`CHAT_WAIT_PHASE_KINDS`·`WORKTREE_PREPARE_STEPS`·`AgentKindSchema`·`DiffRequirementAnchorSchema`·`GitDiffPathSchema`·`GitDirtyResolutionSchema`) | 비귀속 | 이번 handoff 파일(`scheduled-tasks`·`schedules`)이 아니다 |
| 미사용 타입 export 17 | 정상 | 예약 작업 쪽 7건은 시그니처용 타입 |
| 테스트 전용 참조(`shellInvocation`·`relayScheduledPrompt`·`executionPermissionModes`·`triggerFromForm`·`TriggerSpecSchema` 등) | 정상 | 같은 파일 안에서 production이 쓰거나(`shellInvocation` ← `runShellCommand`, `TriggerSpecSchema` ← 스키마 합성), 훅이 호출한다. 단 `executionPermissionModes`는 production 호출 0 — `ExecutionSettingsPicker`가 다른 경로로 권한 목록을 만든다면 죽은 export. 이번엔 `rg executionPermissionModes app/src`로 확인하지 못했다 → 못 본 것 |
| 형제 정책 비대칭 | 없음 | 스크립트 0건 |
| 신규 레지스트리 값의 기존 소비처 | 무영향 | `Scheduler`는 `startCron`만 바뀌었고 기존 13케이스 green |
| producer ↔ consumer | 일치 | `SCHEDULE_RUN_ERROR` 9종 ↔ `runErrorKey` 9종(`runHistory.render.test.ts:'사유 코드 전부에 문구가 있다'`) |
| 동일 규칙 중복 | SSOT 유지 | `isValidTrigger` 한 곳이 zod·폼·타이머에 공유(EP-2 3자리) |

## 4. 기존 테스트 / semantic 검증 확인

- plan 인용 좌표 실재: `lifecycle`·`runner.test`·`prompt-relay.test`·`handlers/scheduled-tasks.test`·`shell-runner.test`·`cron.test`·`scheduled-task-queries.test`·`chatStore.detached.test`·`useScheduledPromptRelay.test`·`executionSettings.test`·`navItems.test`·`taskActions.test` 실재. **`scheduleDetail.render.test.ts`(VP-26)는 없음**.
- 핵심 입력·분기: 위 파일을 이번 gate 집합 안에서 실행해 통과(§9).
- structural proxy만으로 통과한 AC: AC24 — 8식 0줄 + 양성 좌표 짝(`cron.test`·`lifecycle`·`chatStore.detached`·`executionSettings`)이 실재하고 통과.
- **등록 변이 재측정**: VP-06(`start` 복원·`enabled` 뒤집기 → V02·V01 red) · VP-07(`permissionMode`·`providerKey` → V45·R02·R03·R05·R07 red) · VP-20(`newChatGate` 뒤집기 → R01 red 19건). 6/6 검출, 일반 hunk 자동 확장 0.
- **③** 직전 `못 잡음`·`동치`: 없음(첫 verify). **④** 이전 라운드 red 재실행: verify 이력 없어 해당 없음. 구현자 sweep spec(S01~S94·D01~·E01~·V01~)은 plan에 요약만 있고 spec 파일이 저장소에 없어 그대로 재실행할 수 없었다 — 아래 변이는 내가 §10 자리·path edge에서 새로 만든 것.
- **⑥ 독립 축**: 4축(메타). 발견: 이행 2(D3·D5) · 현재 1(D4) · 확장 3 · 경계 1 · 동치 2.
- **⑦ 열거 sweep**: §10 자리 — EP-1 ②(V47·48)·③(V45·V10·V46)·④(R07)·⑤(R02·R03)·①(R05·R06) · EP-2 ①(V57)·②(V10)·③(R06) · EP-3 5(V02~V06) · EP-4 2(V12·V13) · EP-5 10(V14~V24) · EP-6 4항(V31~V36·W01~W04) · EP-7 7(V40~V44). **ΔV1·ΔV2(AC26~30) path edge는 돌리지 못했다**(모달 배치·칩·`ProjectMenuPanel`·코드 아이콘).

**고장 이력** — 하네스 `mutate.py`로 98건. spec은 이 턴의 scratchpad(`spec.jsonl`·`spec2.jsonl`·`spec3.jsonl`). 실행 뒤 `git status` 빈 출력(원복 확인).

| ID | 파일(함수) | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 / 근거 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|
| V01·V02·V03·V04·V05·V06·V08·V09·V10·V11 | `service.ts` `sync`·`start`·`create`·`update`·`setEnabled`·`delete`·`dispose` | 제거·뒤집기·고정값 | `enabled` 조건 · start 복원 · 각 쓰기의 `synced` · `stop` · 옛 타이머 정지 · dispose 루프 · `triggerToCron`→`'0 * * * *'` · `reconcileStaleRuns` | 잡음 10 | `scheduled-tasks.lifecycle.test.ts`(1~4건씩) | ①⑦ EP-3·EP-2② | — |
| **V07** | `service.ts:delete` | 제거 | `this.deps.runner.cancel(id)` 삭제 | **못 잡음** | 75케이스 green | ⑦ EP-5⑩ | **이행** D1 |
| V12·V13 | `runner.ts:fire` | 뒤집기·고정값 | origin 가지 맞바꿈 · 겹침 가드 제거 | 잡음 2 | `runner.test.ts` | ⑦ EP-4 | — |
| V14·V15·V16·V17·V21·V22·V23·V24·V26·V27·V29·V30 | `runner.ts` `execute`·`abort`·`finishRun`·`reconcile`·`dispose` | 고정값·제거·맞바꿈 | 성공 판정 · `result.error` · `timeout`↔`nonZeroExit` · `sessionId` · stale 정리 · dispose abort · cancel 제거 · cancel↔appQuit 맞바꿈(⑤) · disposed 가드 · `runId` 비교 · projectMissing · projectNoFolder | 잡음 12 | `runner.test.ts` | ①⑤⑦ EP-5 | — |
| V18·V19·V20 | `prompt-relay.ts` | 제거·맞바꿈 | 보고 오류 · noWindow→cancelled · reportTimeout→noWindow | 잡음 3 | `prompt-relay.test.ts` | ⑦ EP-5④~⑦ | — |
| **V28** | `prompt-relay.ts:request` | 제거 | `if (signal.aborted) return reject(...)` 삭제 | 못 잡음 | `execute`가 `fire` 동기 호출 안에서 `startPrompt`를 부르므로 신호는 그 시점에 항상 미중단 — 도달 불가 | ⑥ | **동치**(코드 근거) |
| V31·V32·V33·V34·V36·V38·V39·W01~W04·W12 | `shell-runner.ts`·`runner.ts` | 제거·다른 값 | cwd · 제한 시간 · 출력 상한 · `-NoProfile` · `truncated` · 주입 상한 · `code ?? 0` · 명령/인자 | 잡음 13 | `shell-runner.test.ts`·`runner.test.ts` | ⑦ EP-6 | — |
| **V35** | `shell-runner.ts:POWERSHELL_UTF8` | 제거 | UTF-8 고정 접두사 삭제 | **못 잡음** | win32 케이스가 `args.slice(0, 3)`만 단언(`shell-runner.test.ts:44`) | ⑦ EP-6 | **이행** D2 |
| **V37** | `shell-runner.ts` | 제거 | 이미 중단된 신호 즉시 kill 삭제 | 못 잡음 | 동기 호출 구간이라 도달 불가 | ⑥ | **동치** |
| **W11** | `runner.ts:execute` | 제거 | `ok` 식에서 `&& !result.timedOut` 삭제 | **못 잡음** | 75케이스 green. 실제 프로세스 재현 §2 | ⑥ | **이행** D3 |
| V40·V41·V42·V43·V44 | `service.ts`·`runner.ts` | 제거 | 5개 `onChanged` 자리 | 잡음 5 | `lifecycle`·`runner.test` | ⑦ EP-7 | — |
| V45·W10·W06·W07·W08·W05 | `runner.ts`·`prompt-relay.ts`·`service.ts` | 다른 값·맞바꿈 | `permissionMode` · `projectId` · 세션 id · skipped 사유 · origin 고정 · `runNow`가 sync | 잡음 6 | `runner.test`·`prompt-relay.test`·`lifecycle` | ①⑦ EP-1·4 | — |
| **V46** | `runner.ts:execute` | 다른 값 | `text`를 `.trim()`해 넘김 | 못 잡음 | 입력 text에 앞뒤 공백이 없음. 단 `chatStore.startDetachedChat`가 이미 `trim` | ⑥ | **확장** E1 |
| V47~V52 | `scheduled-task-queries.ts` | 제거·고정값 | insert·update의 `action_json` · `project_id` · 보존 `LIMIT` · `finishRun`의 `status='running'` · `toTask` 필터 | 잡음 6 | `scheduled-task-queries.test.ts` | ⑦ EP-1② | — |
| V53·V54 | `cron.ts:startCron` | 고정값 | `stop`·`nextRun` | 잡음 2 | `cron.test.ts` | VP-18 | — |
| **V55** | `scheduler.ts:schedule` | 호출 대체 | cron 가지가 `intervalHandle(60000,…)`을 부름 | 못 잡음 | `registers a cron schedule and exposes nextRun`은 `nextRun` Date 여부만 | ⑥ | **확장** E3 |
| V56·V57·V58·V59·V60 | `shared/scheduled-tasks.ts`·`handlers/scheduled-tasks.ts` | 제거·호출 대체 | 요일 정렬 · 중복 검사 · update→create · runNow→listRuns · report 무시 | 잡음 5 | `shared/scheduled-tasks.test.ts`·`handlers/scheduled-tasks.test.ts` | ⑦ | — |
| V61·V62 | `bootstrap.ts` | 제거·맞바꿈 | `service.start()` · `dispose`↔`stopAll` 순서 | 잡음 2 | `bootstrap.opencode-warmup.test.ts` | VP-09 | — |
| R01~R11·W09 | `chatStore.ts`·`scheduleForm.ts`·`useScheduledPromptRelay.ts`·`taskActions.ts`·`schedulesStore.ts`·`navItems.ts` | 뒤집기·다른 값 | `newChatGate` · `permissionMode`·`providerKey` · `trim` 제거 · 폼 설정·트리거 검증 · 훅 `effort`·`runId` · 삭제 id · `revision` · nav 활성 · `activeKey` 변경 | 잡음 12 | 각 스위트(1~19건) | ①⑦ | — |
| D01·D02 | `SchedulesScreen.tsx` | 제거 | 같은 행 재클릭 닫기 · `onClose` | 잡음 2 | `schedulesScreen.detail.test.ts` | ⑦ ΔV3 | — |
| **D03·D04·D05·X06** | `SchedulesScreen.tsx`·`ScheduleDetail.tsx` | 다른 값·고정값 | 패널의 `지금 실행`·`삭제`·`편집` 콜백 인자/대상 · `지금 실행` 비활성 | 못 잡음 4 | 125·181케이스 green | ⑥ | **확장** E2 |
| **D06·X05** | `SchedulesScreen.tsx`·`ScheduleDetail.tsx` | 고정값·뒤집기 | `inert` · 패널 토글 `on` 표시 | 못 잡음 2 | green | ⑥ | **확장** E2 |
| **X01·X02·X03·X04** | `ScheduleDetail.tsx` | 빈 값·고정값 | 트리거 요약 · 프로젝트 이름 · 다음 실행 · `실행 중` 문구 | 못 잡음 4 | 181케이스 green | ⑥ | **이행** D5 |
| **X08** | `ScheduleDetail.tsx` | 호출 대체 | 이력의 `onOpenSession`을 빈 함수로 | 못 잡음 | green | ⑥ | **이행** D5 |
| X07 | `ScheduleDetail.tsx` | 고정값 | shell 명령 `font-mono`→`font-sans` | 못 잡음 | 시각 클래스 | ⑥ | 경계(AC34 실기 · 시각 품질) |

- 검산: 시도 98 = 잡음 79 · 못 잡음 19. 못 잡음 19의 분류: 이행 8(V07·V35·W11·X01~X04·X08) · 확장 8(V46·V55·D03·D04·D05·X06·D06·X05) · 동치 2(V28·V37) · 경계 1(X07). 현재 결함 D4는 변이가 아니라 실제 프로세스 실행으로 찾았다.
- 동작 보존 추출 라운드: 아니오.
- 소거 변이의 잔여물: 제거 변이는 `vitest`가 타입 진단을 하지 않아 잔여물 0 확인을 하지 않았다. 변이가 green인 행은 잔여물이 판정에 영향이 없다(green은 잠금 부재).
- 형제 슬롯 맞바꿈(⑤): `abort`의 `cancelled`↔`appQuit`(V24 red) · `timeout`↔`nonZeroExit`(V16 red) · origin 맞바꿈(V12·W08 red) · `providerKey`↔`modelFamily`(R03 red). 7개 형제 쌍 중 4쌍. 나머지(권한 모드 값끼리)는 R02가 대신한다.
- `N회` 기준: `runShell` 호출 수는 `runner.test` 주입 함수의 호출 횟수. 순서: bootstrap은 `scheduled.events` 배열.

## 5. V-pair closeout

| Pair | 레벨 | req | 결과 | 직접 검증 증거 | path / §10 |
|---|---|---|---|---|---|
| VP-18 | MD-06 ↔ UT | REQUIRED | PASS | `cron.test.ts` · V53·V54 red | `startCron` / 0 |
| VP-19 | MD-07 ↔ UT | REQUIRED | PASS | `executionSettings.test.ts`(§9 통과) | — / 0 |
| VP-12 | MD-02 ↔ UT | REQUIRED | **PAIR_FAIL** | `shell-runner.test.ts` — V35 못 잡음(AC14 UTF-8). 실제 프로세스 재현 4007ms>300ms(D4) | EP-6 4항 중 인자 1항 미잠금 |
| VP-13 | MD-03 ↔ UT | REQUIRED | **PAIR_FAIL** | `runner.test.ts` — W11 못 잡음(AC15 규칙 칸 `timedOut` 분기) | EP-4 2/2 · EP-5 10/10 중 ① 규칙 분기 입력 부재 |
| VP-14 | MD-04 ↔ UT | REQUIRED | PASS | `chatStore.detached.test.ts` · R01~R04·W09 red | EP-1 ⑤ |
| VP-15·VP-16 | MD-05·MD-01 ↔ UT | REQUIRED | PASS | `scheduleForm.test.ts` · `shared/scheduled-tasks.test.ts` · R05·R06·V56·V57 red | EP-2 3/3 |
| VP-10 | AR-03 ↔ IT | REQUIRED | PASS | `scheduled-task-queries.test.ts`(Node ABI 실행 — 20케이스 중 이 파일 10) · V47~V52 red | EP-1② |
| VP-17 | AR-05 ↔ IT | REQUIRED | PASS(기존 케이스 green) | `scheduler.test.ts` 13/13 · V55 못 잡음 = E3 확장 | 0 |
| VP-08 | AR-01 ↔ IT | REQUIRED | PASS | `handlers/scheduled-tasks.test.ts` · V58~V60 red | EP-2·7 |
| VP-09 | AR-02 ↔ IT | REQUIRED | PASS | `bootstrap.opencode-warmup.test.ts` · V61·V62 red · 조립 인자(`projects` 등)는 선언 경계 3 | EP-3① |
| VP-11 | AR-04 ↔ IT | REQUIRED | PASS | `SchedulesPage.render.test.ts` green | — |
| VP-06 | SD-01 ↔ ST | REQUIRED | **PAIR_FAIL** | lifecycle — V01~V06·V08~V11 red 10/10, **V07 green**(삭제→cancel 배선) | EP-3 5/5 · EP-5⑩ edge 미잠금 |
| VP-07 | SD-02 ↔ ST | REQUIRED | PASS | 4자리 등록 변이 + `trim`(V46)은 확장 | EP-1 5/5 |
| VP-03·VP-04·VP-01·VP-02·VP-05 | AT | REQUIRED | 아래 AC 표 | — | — |
| VP-20 | MD-08 ↔ UT | REGRESSION | PASS | `chatStore.test.ts` · R01 red 19 | 0 |
| VP-21·VP-22 | R-07·MD-09 | REQUIRED | **판정 보류** | 이번 턴에 변이를 돌리지 못했다. 기존 3케이스 + 7케이스 green(§9)만 확인 | 0 — 못 본 것 |
| VP-23·VP-24·VP-25 | R-08 ↔ AT·UT | REQUIRED·REGRESSION | **판정 보류** | `projectPickerChip.test.ts`·`executionSettingsPicker.render.test.ts`·`project-picker` 21케이스 green. 변이 미실행 | 0 — 못 본 것 |
| VP-26 | R-09 ↔ AT | REQUIRED | **PAIR_FAIL** | 패널 본문(메타·`onOpenSession`) 8변이 green · 계획된 oracle 파일 없음 | 0 |
| VP-27 | 스킬 탭 패널 | REGRESSION | PASS | `ExtensionsCatalogView.interaction.test.ts` 12 green · 구현자 V10·V11은 재실행하지 않음 | 0 |

- root `PAIR_FAIL`: VP-06(D1) · VP-12(D2·D4) · VP-13(D3) · VP-26(D5). 종속 `BLOCKED_BY` 없음 — 각 pair를 다른 경로로 독립 판정했다.
- **판정 보류 4건(VP-21~25)은 PASS가 아니다.** 다음 verify(2회째)가 변이로 닫는다.
- 좌표의 실행 구간: lifecycle은 `createScheduledTasks`를 그대로 지나 실제 croner·인메모리 저장소까지 간다. 단 `bootstrap.ts`가 조립에 넘기는 인자(`projects`·`runShell`·`sendPromptStart`)는 `bootstrap.opencode-warmup.test.ts`가 조립 모듈을 mock하므로 구간 밖 — 선언 경계 3.

### AT / AC 세부와 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1~AC13·AC16~AC22 | ✅ | pair 좌표 green + 위 변이. AC22 = `check-doc-inventory --check` + `ipc-documentation.test.ts` |
| AC14 | ❌ | V35 — "UTF-8 출력 고정 + 명령" 중 UTF-8 접두가 단언 밖 |
| AC15 | ❌ | W11 · D4 |
| AC24·AC25 | ✅ | EP-8 8식 재실행 0줄 · 가드 4종 |
| AC26~AC30 | ✅(구현자 보고 인정 — 변이 미실행) | 기존 케이스 green. **이번 턴은 독립 증명 못 함** |
| AC32 | ❌ | X01~X04·X08 — 패널의 메타·이력 대화 열기가 단언 밖 |
| AC33 | ✅ | `ExtensionsCatalogView.interaction.test.ts` |
| AC23·AC27·AC31·AC34 | ⚠️ | 사람 실기 |

- **합계 재측정**: `✅ 27 · ⚠️ 4 · ❌ 3 = 총 34` — 자기보고 `30/34`와 불일치(AC14·AC15·AC32가 ❌).
- **합계 사본 대조**: 커밋 trailer `Criteria-Met: 30/34`(8eed0a5) ↔ 본문 `30/34` 일치, 단 verify가 이를 뒤집는다.

### pair별 plan §10 강제 지점 분모

| Pair | §10 목록 | 확인 · 좌표 | 목록 밖 발견 | 결과 |
|---|---|---|---|---|
| VP-07 EP-1 | 5자리 | ①②③④⑤ 변이 red(V47·48·V45·R07·R02·R03·R05) | `text.trim` 변형(V46) → E1 | PASS |
| VP-16 EP-2 | 3자리 | ①V57 ②V10 ③R06 red | 없음 | PASS |
| VP-06 EP-3 | 5자리 | ①V02 ②V03 ③V04 ④V05 ⑤V06 red | 없음 | PASS |
| VP-13 EP-4 | 2분기 | V12·V13 red | 없음 | PASS |
| VP-13 EP-5 | 10자리 | ①V14 ②V15 ③V16 ④V17 ⑤V18 ⑥V19 ⑦V20 ⑧V21 ⑨V22 red · **⑩ cancel의 호출 edge(`service.delete`)는 V07 green** | D1 | PAIR_FAIL |
| VP-12 EP-6 | 4항 | cwd V31 · 제한 시간 V32 · 상한 V33 · 인자 V34 red · **UTF-8 접두 V35 green** | D2 | PAIR_FAIL |
| VP-08 EP-7 | 7자리 | V40~V44 red(5줄 → 7자리) | 없음 | PASS |

- 목록 밖 같은 불변식 지점: EP-5 ①의 `ok` 식 `timedOut` 항(W11) — 규칙 칸 분기, 이행.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| 가드 4종 | PASS | migrations(append-only 체크는 `no previous v* tag — skipped`, sync·no-copies ok) · doc-inventory `generated doc ok (9 items, 123 channels)`·prose·links ok · product-naming `OK — 2287파일` · test-budgets `all budget sites scaled` |
| lint · typecheck | PASS | `eslint .`(`--fix` 없이) `0 errors, 2 warnings`(`Timeline`·`useTranscriptVirtualizer`, 손대지 않은 파일) · `npm run typecheck` 3구성 error 0 |
| 전체 vitest | PASS(기준선 분리) | 969파일 중 9파일 실패 · 22케이스(전부 `adapters/claude|opencode`·`composer-*`·`session-resources.claude-assembly`). **변경 전 트리 `d324a9f`에서 같은 9파일을 돌려 같은 9파일·22케이스**(차집합 ∅). 환경 원인 = Linux 경로·플랫폼 전용 단언. 이번 변경 파일의 규칙 가드(`[test-pools]`) 실패 0 |
| 스크립트 테스트 | PASS | `node --test scripts/*.test.mjs` 868/868 |
| DB 스위트(VP-10) | PASS | `npm rebuild better-sqlite3`로 Node ABI 빌드 후 `scheduled-task-queries.test.ts` 통과(변이 oracle 20케이스 중) |
| trailer | PASS | `git log -1 --format='%(trailers:only=true)' 8eed0a5` → `Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By` 파싱 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `oo:schedule:*` 채널·`IPC_CONTRACT.md` | `ipc-documentation.test.ts` green | handlers 테스트 | PASS |

## 7. 숫자 / 음성 기준 / 상한

- EP-8 8식 재실행: ① `orca:schedule|window\.orca` 0 · ② `SchedulerPort|scheduledTaskJobKey` 0 · ③ `unregister`(scheduler) 0 · ④ `ports.ts`·`registry.ts` 없음 · ⑤ `shared/scheduled-tasks`(infra/shell) 0 · ⑥ `detachedStarts|settleDetachedStart` 0 · ⑦ `0034_scheduled_tasks.sql` 없음 · ⑧ `0287-scheduled-tasks` 없음.
- 상한: `limits.ts` 5개 상수 — 값 변이(20→21 등)는 테스트가 그 상수를 import하는 설계라 관측 불가(plan §7 "AC 검증 주의사항"과 일치). 실측으로 보면 shell 제한 시간은 **상수보다 늦게 끝날 수 있다**(D4).

## 8. 사람 실기로 남는 것

| 항목 | 기계 검증 | 남은 실기 |
|---|---|---|
| AC23 | shell 인자·cwd·꼬리, 릴레이 전 구간(주입 fake) | 실제 `powershell.exe`·실제 하네스 프롬프트 1회 |
| AC27·AC31·AC34 | 렌더 구조 | white/dark·칩 너비·패널 크기 조절·펼치기·Esc(`ownerDocument.querySelector`가 fake DOM에서 안 돼 자동 불가) |

## 9. 게이트 재실행

- 환경: 이 컨테이너에 `app/node_modules`가 없어 `npm ci --ignore-scripts` 뒤 `npm rebuild better-sqlite3`·`node node_modules/electron/install.js`로 네이티브를 만들었다. 이 명령이 작업 트리에 남긴 것은 `.gitignore` 대상 `node_modules`뿐(`git status --short` 빈 출력).
- 실행: `./node_modules/.bin/vitest run`(필터 없음) — **969파일 중 956 pass · 9 fail · 4 skip / 9186케이스 중 9152 pass · 22 fail · 1 expected fail · 11 skip**. 첫 실행(네이티브 미빌드)은 69파일 실패였고 환경 서명(`Electron failed to install`·`compiled against a different Node.js`) 때문이라 재빌드 뒤 다시 돌렸다.
- `npm test`는 쓰지 않았다(`pretest` ABI 전환 불필요 — 이 컨테이너는 이미 Node ABI).
- 작업 트리: `eslint`는 `--fix` 없이 돌렸고 변이 하네스는 매번 원복을 확인했다(`# 원복 확인: 모든 파일 원문 그대로`).
- 잔여물: 검증용 worktree `/tmp/claude-0/base`는 제거했다.

## 10. 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/자동 테스트 | 에이전트 실행 — §5 |
| AC ↔ production path | 위 AC 표 |
| 제품 의도·시각 품질 | 사람 — AC23·27·31·34 |

## 11. Repository operation checks

- `AGENTS.md`: `app/AGENTS.md`·`app/src/main/AGENTS.md`가 features/infra 행과 "사용자 예약 작업" 절만 추가. 비밀·일회성 정보 없음, 부모-자식 충돌 없음, 새 `AGENTS.md` 없음.
- INDEX: 이번 턴에 `verify/RETURN_TO_PLAN`·다음 주체 `Claude`(설계)·라운드 2로 갱신한다. 비고 5줄 이내.
- 대상 커밋 좌표: `git cat-file -t` — `3ac26fb`·`67d2514`·`50a27cd`·`8eed0a5`·`8c3dbe2`·`d324a9f`·`9b6685a`·`9cf2a6c`·`c7a9b4e` 전부 `commit`. **`main` 조상 여부는 확인하지 못했다** — 이 clone에 `origin/main` 참조가 없고(`git branch -a`: `feat/0320-scheduled-tasks`·`ccr-562e99bf-c0gy6r`뿐) 해당 커밋은 두 브랜치에만 있다. 좌표는 브랜치 해시이고 병합(rebase) 뒤 교정이 필요하다.
- trailer: 4개 구현 커밋 모두 허용값. `8eed0a5`는 파싱 확인. 본문은 `Co-Authored-By: Claude Opus 5.5` 줄을 같은 trailer 블록에 둔다.
- 구현자 `[구현자 기입]` 7필드: r1·r1.2·r1.3·r1.4 각각 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금(sweep 포함)·Product/UX 파생 검토·놓친 잠재 문제·구현 보고·Review Signals 존재. 강제 지점 표는 ΔV pair에서 `0`이라 자리 행이 없다(§10이 0자리).

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 판단 | 반영 |
|---|---|---|
| r1.4 "덮개 회귀: 해당 없음 — 행 아래 펼침에는 잠금 테스트가 없었다" | 타당 | 단 새 패널의 본문도 같은 이유로 잠금이 얇다 — D5 |
| r1.4 "Esc 닫기는 fake DOM 한계로 AC34 실기" | 타당(선언 경계) | — |
| 구현 보고 "unit 풀 실패 0 · io 44파일은 sqlite 바이너리 잠김" | 환경 한계로 인정 | 이번 턴은 Node ABI를 직접 빌드해 io 풀까지 통과 확인 |
| `r1` "`node --test` 5건 실패 — Node 22.15.1의 `.ts` 직접 import" | 이번 환경(22.23.4)에서는 868/868 | 환경 차이 |

## 13. Finding disposition / 파생 이슈

| # | finding | 분류 · 근거 | 귀속 | disposition | root / pair | 후속 |
|---|---|---|---|---|---|---|
| D1 | 삭제 시 실행 중단 — `service.delete`가 `runner.cancel`을 부르는 edge가 어느 좌표에도 없다(V07 green) | **이행** — §10 EP-5 ⑩ "`cancel`(삭제)" · Part I §5 "삭제 확인 → … 진행 중 실행 중단"·"실행 중인 작업을 삭제 → 실행 중단". `runner.test`는 `runner.cancel`을 직접 불러 호출 edge가 실행 구간 밖 | VP-06·VP-13 | **BLOCKING** | VP-06 | 구현: 실행 중 작업을 `service.delete`로 지우면 `runShell`의 signal이 중단되고 이력 행이 정리되는 lifecycle 케이스 |
| D2 | win32 인자의 UTF-8 출력 고정이 미잠금(V35 green) | **이행** — AC14 "`-Command <UTF-8 출력 고정 + 명령>`" · EP-6 "파일+인자(플랫폼)". `shell-runner.test.ts:44`는 앞 3인자만 단언 | VP-12 | **BLOCKING** | VP-12 | 구현: 마지막 인자가 UTF-8 접두 + 명령 전체임을 단언 |
| D3 | 제한 시간을 넘고도 종료 코드 0이면 `성공`이 될 수 있는 분기가 미잠금(W11 green). 실제 프로세스로 `{"exitCode":0,"timedOut":true}` 재현 | **이행** — AC15 "제한 시간을 넘으면 종료시키고 `실패: 제한 시간 초과`" 규칙 칸의 분기. 입력 칸에 `timedOut ∧ exitCode 0`이 없다 | VP-13 | **BLOCKING** | VP-13 | 구현: 그 입력으로 `error`·`timeout` 단언 |
| D4 | 제한 시간이 지나도 실행이 끝나지 않는다 — `sh -c "sleep 4; echo x"`, `timeoutMs=300` → **4007ms**. `kill()`이 셸만 죽이고 고아 자식이 파이프를 잡아 `close`가 지연. 600초 명령이면 이력이 `실행 중`으로 남고 `지금 실행`이 막힌다 | **현재 결함** — AC15·D-007. 재현: `node --experimental-strip-types t2.mts`(주입 spawn 없이 `runShellCommand` 직접 호출) | VP-12 | **BLOCKING** | VP-12 | 구현 세부(프로세스 그룹 종료 또는 `exit` 시점에 결과 확정) — 계약 정정 불필요. Windows는 `powershell.exe`의 자식 프로세스가 같은 모양일 수 있으나 이번 턴에 못 봤다 |
| D5 | 우측 패널 본문이 미잠금 — 트리거·프로젝트·다음 실행·`실행 중` 문구·이력의 `대화 열기` 전달(X01~X04·X08 green). plan이 적은 oracle `scheduleDetail.render.test.ts`·`schedulesScreen.render.test.ts` 신규 케이스가 없다 | **이행** — AC32 "그 작업의 메타·명령·실행 이력을 보인다" · AC18 "대화 열기" · VP-26 oracle 좌표 | VP-26 | **BLOCKING** | VP-26 | 구현: 패널 본문을 렌더해 메타 4칸·이력 영역·`onOpenSession` 인자를 단언 |
| E1 | `text`가 전송 payload까지 "변형 없이" 간다는 EP-1 문장과 production이 어긋난다 — `startDetachedChat`이 `trim`한다(일반 `send`와 같은 규칙) | **확장** — EP-1 ③ 자리의 `text.trim()` 변이(V46)가 green. 동작은 제품 허용 범위 | EP-1 | **PLAN_GAP** | — | 설계자: `trim`을 EP-1 계약에 넣거나 "공백 정리는 `startDetachedChat`이 한다"를 경계로 선언 |
| E2 | 패널의 지금 실행·편집·삭제 콜백 대상과 토글 표시, `inert`가 미잠금(D03·D04·D05·D06·X05·X06). plan §22는 "D-008이 패널 안에서도 유지된다"고만 썼고 선언 경계 5는 `ScheduleRow`만 가리킨다 | **확장** — 동작은 맞다(코드 읽기). 열거 밖 | VP-26 | **PLAN_GAP** | — | 설계자: 패널 메뉴·토글 배선을 REQUIRED 입력으로 채택하거나 선언 경계 5를 `ScheduleDetail`로 확장 |
| E3 | `Scheduler`의 cron 가지가 `startCron` 대신 interval 핸들을 불러도 기존 케이스가 green(V55) | **확장** — VP-17 oracle이 `nextRun`의 Date 여부만 본다 | VP-17 | **PLAN_GAP** | — | 설계자: cron 식 일치 단언을 채택하거나 경계 선언 |
| N1 | `V28`·`V37`(이미 중단된 신호 가드 2개)는 도달 불가 — `fire` 동기 구간에서 `startPrompt`·`runShell`이 불린다 | 동치 | — | NON_BLOCKING | — | 기록 |
| N2 | `ScheduleDetail` shell 명령의 `font-mono` 클래스(X07) | 경계 — 시각 품질은 AC34 실기 | AC34 | NON_BLOCKING | — | — |

> 새 handoff 후보 표로 간 항목: 없음(1회째, 창 안).

## 14. Review Signals — 사실만

- 이전 라운드와 같은 증상: 첫 verify. 같은 에이전트(Claude)가 설계·구현·검증을 맡았다.
- 관련 plan 지침: VP-26은 "`scheduleDetail.render.test.ts` 신규"를 적었으나 구현이 다른 파일명으로 갔고 plan에 되먹임이 없다(`[구현자 기입] 설계 대비 명시적 차이: 없음`). 구현자 자기 sweep(V01~V11)은 패널 쪽 4자리(토글 값·닫기·명령·이력 id)만 심었다.
- 사용자 결정 변경 근거: D-011~D-015는 각각 사용자 턴 인용이 plan에 있다.
- 반복된 환경 한계: 구현자 보고는 "sqlite 바이너리 잠김"으로 io 44파일을 건너뛴 채 IMPL_DONE을 적었다(r1.3·r1.4). 이 컨테이너에서는 `npm rebuild better-sqlite3`로 해결돼 io 풀까지 통과했다.
- 독립 축(⑥) 발견: 이행 2(W11·X계열) · 현재 1(D4) · 확장 3 · 경계 1 · 동치 2.

## 15. 결론

- 상태: **RETURN_TO_PLAN**. 막는 발견(이행 4·현재 1)과 `PLAN_GAP` 3건(E1~E3)이 함께 있어 설계자가 먼저다.
- verify 횟수: 1회째 — 확장 창 안(ΔV1~3도 같은 창).
- pair 결과: PASS 13 · root PAIR_FAIL 4(VP-06·12·13·26) · 판정 보류 4(VP-21~25 — 변이 미실행, **PASS 아님**) · BLOCKED_BY 0.
- Product/UX·ACTIVE Decision: D-005~D-008·D-015는 D1~D5를 제외하고 충족. D-011~D-014는 기존 케이스 green까지만 확인.
- AC: `✅ 27 · ⚠️ 4 · ❌ 3 = 총 34`.
- 운영 gate: 위 표 전부 PASS(전체 vitest는 변경 전과 같은 9파일·22케이스 기준선).
- 못 본 것: ① ΔV1·ΔV2 path edge 변이(VP-21~25) ② 구현자 sweep spec 재실행 — spec이 저장소에 없다 ③ Windows `powershell.exe` 실제 실행 ④ 화면(white/dark·크기 조절·Esc) ⑤ `executionPermissionModes` production 호출 여부.
- 다음 단계: 설계자가 E1~E3를 채택하거나 경계로 선언하고 VP-21~25 판정 보류 범위를 이번 변경 범위로 확정한다. 이어서 구현자가 D1~D5를 닫는다(D3은 입력 추가, D1·D2·D5는 테스트 추가, D4는 코드 수정). 규범 행 정정은 구현과 다른 커밋.

---

# 라운드 2 — verify 2회째

## 메타 (r2)

| 항목 | 값 |
|---|---|
| 상태 | **RETURN_TO_PLAN** — 막는 이행·현재 결함 0, 신규 확장 후보 4건(E4~E7)이 창 안(2회째)이라 `PLAN_GAP` |
| 대상 | 구현 `81146d7`(r2) — 기준선 `ebfdf37`(ΔV4 설계, 설계·구현 커밋 분리). `git diff --stat 8eed0a5 81146d7` = 12파일. 검증 트리는 `345be89`(0322 트레이, 이 handoff 파일과 교집합 0) |
| 유효 V | `V1 + ΔV1~ΔV4` |
| 확장 창 | verify 2회째 — 창 안. 이번 설계 턴이 열거를 늘릴 수 있는 **마지막** 턴(plan 동결, `docs/handoff/AGENTS.md` §판정 범위) |
| 독립 축(⑥) | ① 실제 프로세스 6형태(A1~A6) ② ΔV1·ΔV2 path edge 변이 35(r1 보류분) ③ `shell-runner.ts` diff 자리 변이 18(규칙 칸 분기 sweep) |
| 구현 주체·문맥 | Claude 구현·설계·검증 동일 에이전트 — 독립성은 ⑥의 실제 프로세스·r1이 못 돈 축이 맡는다 |

## 1. r1 BLOCKING·채택 확장 재판정 (③ — 직전 `못 잡음`·`동치` 행)

| 이슈 | 인용 변이 | r1 | r2 재실행 | 판정 |
|---|---|---|---|---|
| D1 | V07 `service.delete`의 `runner.cancel` 제거 | 못 잡음 | red | **closed** |
| D2 | V35 UTF-8 접두 제거 | 못 잡음 | red | **closed** |
| D3 | W11 `!timedOut` 제거 | 못 잡음 | red | **closed** |
| D4 | 실제 프로세스 `sh -c "sleep 4; echo x"` 300ms | 4007ms | A1~A4 아래 | **closed** |
| D5 | X01·X02·X03·X04·X04b·X08(+X09·X10 신규) | 못 잡음 | 전부 red | **closed** |
| E1 | V46 runner `text.trim()` + 새 E1-4(훅)·E1-5(`startDetachedChat` trim 제거) | 못 잡음 | red 3 | **closed** |
| E2 | D03~D06·X05·X06 → EP-9 21자리 R1~R6·P1~P6·S1~S9 | 못 잡음 | 21자리 변이 전부 red(S3 두 항 포함) | **closed** |
| E3 | V55 cron → interval | 못 잡음 | red | **closed** |
| 동치 V28·V37 | — | green | green 그대로 | 동치 유지 — 호출이 `fire` 동기 구간 안이라 신호가 미중단(`prompt-relay.ts`·`shell-runner.ts`) |
| 경계 X07 | — | green | (제외 — 경계 행) | — |

- EP-9 자리 검색 재실행: `rg -n "onRunNow\(|onEdit\(|onDelete\(|onSetEnabled\(|setEditing\(|disabled=\{task\.running\}|on=\{task\.enabled\}|inert=" --glob '!*.test.ts'` → 24줄 = 21 + 제외 3(`SchedulesScreen.tsx:97`·`:128`·`:176`). 차집합 ∅.

## 2. D4 — 실제 프로세스 재현 (⑥, 구현자가 시험한 형태 밖)

`node --experimental-strip-types t6.mts`(`runShellCommand` 직접 호출, 주입 spawn 없음):

| 형태 | 실측 | 판정 |
|---|---|---|
| A1 셸은 곧 끝나고 손자가 파이프 보유(`sleep 30 & echo $!`, 400ms) | 401ms · `{exitCode:0,timedOut:true}` · 손자 종료 | 통과. 이 상태가 W11 입력이고 runner가 `실패`로 가른다(W11 red) |
| A2 `abort` 신호 + 손자(300ms) | 301ms · `exitCode:null` · 손자 종료 | 통과 |
| A3 제한 시간 직전 출력 | `START` 보존 · 401ms | 통과 |
| A4 정상 종료 `exit 3` | 2ms · `exitCode:3` | 통과 |
| A5 `setsid`로 그룹 탈출한 손자 | 401ms로 끝나지만 **손자는 살아 있음** | 그룹 종료의 한계. 실행은 제한 시간에 끝난다(D4 계약 충족) — 확장 E7 |
| A6 `trap "exit 0" TERM` | 400ms · `exitCode:null` | 통과 |

## 3. 고장 이력 (r2) — 하네스 `mutate.py`, 실행 후 매번 `원복 확인`·`git status` 빈 출력

시도 94(유효) = 잡음 68 · 못 잡음 26. 무효 1(O5 — 변이가 구문 오류). spec은 scratchpad `spec1~5.jsonl`.

| 묶음 | 시도 | 잡음 | 못 잡음 | 분류 |
|---|---|---|---|---|
| r1 못 잡음 재실행 + EP-9 21자리 + D5 + K1~K5 (spec1·5) | 41 | 40 | **K5** | K5 → 동치 |
| ΔV1·ΔV2 path edge (spec2) | 34 | 17 | 17 — **M3·M4·M5·M8·T1~T4·Q2~Q5**(입력→폼 배선 12) · **M10·M11**(저장) · **M7·N6·O6**(문구) | 확장 E4·E5·E6 |
| `shell-runner.ts` diff 자리 sweep (spec3) | 18 | 10 | **S1·S2·S4·S6·S8·S9**(+V28·V37 동치) | 확장 E7 |
| E1 ④·⑤ 위치 | 2 | 2 | 0 | — |

| ID | 파일(자리) | 바꾼 내용 | 결과 | 분류 |
|---|---|---|---|---|
| K5 | `shell-runner.ts:kill` | `killRequested` 조기 반환 제거 | green | **동치** — `done()`이 타이머·abort 리스너를 지우고(`:117-119`) 둘째 `process.kill(-pid)`는 `ESRCH`를 삼키고 `child.kill()`이 죽은 자식에 무해. 도달 창은 종료 요청과 `exit` 사이뿐 |
| M3·M4·M5·M8 | `ScheduleTaskModal.tsx` | 프로젝트·실행 설정·종류 토글·본문의 `onChange` 인자 비움/맞바꿈 | green | 확장 E4 |
| T1~T4 | `TriggerFields.tsx` | 주기·요일·시각·요일 토글의 `onPick`/`onChange` 비움 | green | 확장 E4 |
| Q2~Q5 | `ExecutionSettingsPicker.tsx` | 권한·노력·종류·모델 선택의 `onChange` 인자 | green | 확장 E4 |
| M10 | `ScheduleTaskModal.tsx:save` | `onSubmit(result.request)` 제거 | green | 확장 E5 |
| M11 | 같은 곳 | 저장 실패 `setFailed(true)` 제거 | green | 확장 E5 (Part I §5 `저장 실패는 모달을 닫지 않고 문구를 띄운다`) |
| M7·N6·O6 | `ScheduleTaskModal`·`ProjectMenuPanel`·`ProjectPickerChip` | 프로젝트 없음 안내·검색 0건 문구·`title` 툴팁 | green | 확장 E6 (문구 3) |
| S2 | `shell-runner.ts:killProcessTree` | `SIGKILL`→`SIGTERM` | green | 확장 E7 — 실제 테스트 자손은 `sleep`이라 TERM에도 죽는다 |
| S8·S9 | `shell-runner.ts:done` | abort 리스너 제거·`clearTimeout` 제거 | green | 확장 E7 — S9는 정상 종료 뒤 남은 타이머가 만료 시 `process.kill(-pid)`를 부른다(pid 재사용 시 남의 그룹). r2 이전에는 죽은 자식에 `kill()`이라 무해했다 |
| S1·S4·S6 | `shell-runner.ts` | `windowsHide`·`taskkill /T /F`·`error` 폴백 | green | 확장 E7 — win32 경로, 이 환경에서 못 돈다 |
| V28·V37 | r1 동치 행 | — | green | 동치 유지 |
| 잡음 대표 | S3(트리 폴백 `child.kill()`)·S5(win32 분기 뒤집기)·S7(`timedOut=true`)·V31~V34·V36·V39·V39b | — | red | 열거 원문 sweep(EP-6 4항·규칙 칸) 전부 red |

- 소거 변이 잔여물: 제거 변이는 vitest가 타입 진단을 하지 않아 판정에 영향이 없다(green은 잠금 부재).
- 형제 슬롯 맞바꿈(⑤): `taskkill` ↔ `process.kill`(S5 red) · `SIGKILL`↔`SIGTERM`(S2 green) · 행 vs 패널 콜백(R·P 쌍 전부 red).

## 4. V-pair closeout (r2)

| Pair | 결과 | 직접 oracle 좌표 · 근거 |
|---|---|---|
| VP-06 | PASS | `scheduled-tasks.lifecycle.test.ts:'실행 중인 작업을 지우면…'` — V07 red |
| VP-12 | PASS | `shell-runner.test.ts` + `shell-runner.process.test.ts`(io) — V35·V31~V34·V36·K1~K4 red. win32 `taskkill`은 이 환경 밖(E7) |
| VP-13 | PASS | `runner.test.ts` — W11·V46 red |
| VP-07′ | PASS | ③④⑤ 3자리 E1-4·E1-5·V46 red, ①② 변이 유지 |
| VP-17′ | PASS | `scheduler.test.ts:'cron 스케줄의 다음 실행은…'` — V55 red |
| VP-26′ | PASS(AT 기계분) · AC34 사람 | EP-9 21자리·D5 8변이 전부 red |
| VP-21·VP-22 | PASS | AC26 순서·`aria-label`·요일 묶음 — M1·M2·M9 red |
| VP-23·VP-24·VP-25 | PASS | AC28~30 — N1~N5·N7·N8·O1~O4·Q1·Q6 red. 단 입력 배선은 E4 |
| VP-27 | PASS(기존 케이스 green) | `ExtensionsCatalogView.interaction.test.ts` — 이번 턴 변이는 돌리지 않았다 |
| 그 밖 V1 pair | PASS | 전체 vitest 통과분 + r1 좌표 — r1 `잡음` 79행 spec이 저장소에 없어 그대로 재실행하지 못했고, 위 94변이가 같은 자리들(EP-1·3·4·5·6)을 새로 심었다 |

- **합계 재측정**: `✅ 31 · ⚠️ 4 · ❌ 0 = 총 35` — 구현 보고·trailer `31/35`와 일치. ⚠️ = AC23·27·31·34(사람 실기).

## 5. gate (r2) — 검증 트리 `345be89`

| Gate | 결과 | 관측 |
|---|---|---|
| 가드 4종 | PASS | migrations(`no previous v* tag` skip) · doc-inventory `9 items, 123 channels`·prose·links ok · product-naming `OK — 2290파일` · test-budgets `18 real-git suites ok` |
| lint · typecheck | PASS | `eslint .`(`--fix` 없음) 0 errors · 2 warnings(손대지 않은 2파일) · `tsc` 3구성 error TS 0 |
| 전체 vitest(필터 없음, Node ABI) | PASS(기준선 분리) | 971파일 중 9 fail · 958 pass · 4 skip / 9220케이스 중 22 fail · 9186 pass. 실패 9파일 = r1이 `d324a9f`에서 잰 기준선과 동일(`adapters/claude/*` 3 · `adapters/opencode/v1/*` 3 · `composer-catalog` · `composer-preparation-service` · `session-resources.claude-assembly`), 이번 diff 파일과 교집합 0, 환경 원인 = Linux 경로 전용 단언. `[test-pools]` 0건 |
| `node --test scripts/*.test.mjs` | PASS | 868/868 |
| io 풀 | PASS | `shell-runner.process.test.ts`(실제 `/bin/sh`) 포함 통과 — `npm ci`+`npm rebuild better-sqlite3`로 Node ABI 빌드 |
| trailer | PASS | `git log -1 --format='%(trailers:only=true)' 81146d7` → `Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By` 파싱 |

## 6. Repository operation checks (r2)

- 대상 커밋: `81146d7` `git cat-file -t` = `commit`. **`main` 조상 여부는 확인하지 못했다** — 이 clone에 `origin/main`이 없다(`git merge-base --is-ancestor`가 `Not a valid object name origin/main`). 좌표는 브랜치 해시(`feat/0320-scheduled-tasks`·`ccr-…`)다.
- `docs/arch/backend/security.md` 1줄(셸과 자손 종료) 갱신 — 현재 상태 서술, 이력 표기 없음.
- `[구현자 기입] (r2)` 7필드 존재, 강제 지점 표는 pair별 §10 자리 전부와 `남긴 곳` 포함.
- INDEX 행 갱신: `verify/RETURN_TO_PLAN`·다음 주체 Claude(설계)·라운드 3. 비고 5줄 이내.

## 7. Finding disposition (r2)

| # | finding | 분류 · 근거 | disposition |
|---|---|---|---|
| D1~D5 | r1 BLOCKING 5 | §1 표 인용 변이 전부 red · D4 실제 프로세스 통과 | **closed** |
| E1~E3 | r1 채택 확장 3 | §1 표 | **closed** |
| E4 | ΔV1·ΔV2 모달·트리거·실행 설정의 입력 → 폼 배선 12변이 green(M3·M4·M5·M8·T1~T4·Q2~Q5). AC3·AC4·AC28 검증 수단이 정적 렌더·순수 함수라 클릭 경로가 어디에도 없다 | **확장** — 열거 원문(AC3 "종류 전환 전후 필드", AC4 "순수 함수", AC28 "칩 수")은 위반 아님 | **PLAN_GAP** — 설계자: EP-9처럼 자리 목록으로 채택하거나 경계 선언 |
| E5 | 모달 `저장`이 `onSubmit(result.request)`를 부르는지, 실패 시 모달이 열린 채 문구를 띄우는지(M10·M11) 미잠금 | **확장** — Part I §5 문장이 있으나 AC·§10에 열거되지 않음. 코드는 계약대로 | **PLAN_GAP** |
| E6 | 안내·0건·툴팁 문구 3자리(M7·N6·O6) | **확장** — 문구 수준 | **PLAN_GAP** — 경계 선언 권고(시각·문구는 AC27·31 실기) |
| E7 | 종료 구현의 세부: ① `SIGKILL` 세기(S2) ② 정상 종료 뒤 타이머·abort 리스너 정리(S8·S9 — pid 재사용 시 남의 프로세스 그룹 위험) ③ win32 `taskkill` 3자리(S1·S4·S6) ④ `setsid` 탈출 손자(A5) | **확장** — D4 계약("제한 시간 안에 끝낸다")은 충족. 새 표면 ②는 r2가 `child.kill()`→`process.kill(-pid)`로 바꾸며 위험이 커진 자리 | **PLAN_GAP** — 설계자: ①② 채택(입력: TERM 무시 자손·정상 종료 뒤 타이머 미발화), ③은 CI(windows-latest) 위임을 경계로 선언, ④는 경계 |
| N | A5·K5 | 동치/경계 | NON_BLOCKING |

> 새 handoff 후보 표로 간 항목: 없음(창 안).

## 8. 못 본 것

① Windows `powershell.exe`·`taskkill /T /F` 실행(S4·S6, CI 몫) ② VP-27 스킬 탭 패널 변이 ③ r1 `잡음` 79행 spec 그대로 재실행(spec이 저장소에 없다 — 위 94변이로 대체) ④ 화면(white/dark·크기 조절·Esc, AC27·31·34) ⑤ `main` 조상 여부.

## 9. Review Signals — 사실만

- 같은 증상 반복: r1 D1~D5는 전부 닫혔다. r2 신규 확장 4건은 r1이 판정 보류한 ΔV1·ΔV2 축(VP-21~25) 변이를 이번에 처음 돌려 나왔다 — 구현자 sweep은 EP-9 21자리·verify r1 98행·D4 27행만 심었고 ΔV1·ΔV2 path edge 변이는 없다.
- 설계 지침: ΔV1·ΔV2의 VP-21~25 oracle은 정적 렌더·기존 테스트 이관이라 입력 배선을 열거하지 않았다.
- 반복된 환경 한계: Windows 경로 CI 몫(r1과 같음).
- 독립 축(⑥) 발견: 확장 4 · 동치 1 · 이행 0 · 현재 0.

## 10. 결론

- 상태: **RETURN_TO_PLAN** — 이행·현재 결함 0. 신규 확장 후보 E4~E7이 창 안이라 설계자가 먼저(이번이 열거를 늘릴 수 있는 마지막 설계 턴).
- verify 횟수: 2회째.
- pair: PASS 전부(VP-26′ AT의 사람 몫 AC34 제외) · root PAIR_FAIL 0 · BLOCKED_BY 0.
- AC: `✅ 31 · ⚠️ 4 · ❌ 0 = 총 35`.
- 운영 gate: 전부 PASS(전체 vitest는 기준선 동일 9파일·22케이스).
- 다음 단계: 설계자가 E4~E7을 항목마다 채택 또는 경계 선언. 채택분만 구현 r3가 닫고, 경계 선언만이면 구현 없이 verify 3회째로 간다(창 밖 — 이행·현재 결함 0이면 PASS 가능).


---

# 라운드 3 — verify 3회째

## 메타 (r3)

| 항목 | 값 |
|---|---|
| 상태 | **PASS (기계 범위)** — 이행·현재 결함 0 · 창 밖(3회째)이라 확장 후보는 `NEXT_HANDOFF`. AC23·27·31·34는 사람 실기 |
| 대상 | 구현 `f9c5ac0`(r3, 테스트 7파일·prod 0) — 기준선 `55a9a0f`(ΔV5 설계, 설계·구현 분리 커밋). `git diff --stat 55a9a0f..f9c5ac0 -- app` = 7파일 |
| 유효 V | `V1 + ΔV1~ΔV5` |
| 확장 창 | verify 3회째 — **창 밖**. 새 열거 출처 확인: ΔV5는 r2 확장 후보 채택(출처 = 사용자 결정 아님·plan 정합) — 이번 verify가 새 열거를 판정에 쓰지 않는다 |
| 독립 축(⑥) | 구현자 47행과 다른 형태의 변이 37행(인자 비움 대신 값 대체·`busy` 가드·win32 pid 없음·사전 abort·실제 `Q1b` 조건) |
| 구현 주체·문맥 | Claude 설계·구현·검증 동일 — 독립성은 ⑥ 몫 |

## 1. plan validity · 기준선

- `git diff 55a9a0f..f9c5ac0 -- docs/handoff/0320-scheduled-tasks/plan.md` 변경은 `[구현자 기입] (r3)` 추가뿐 — AC·Decision·§10 규범 행 변경 0.
- EP-10(19자리)·EP-11(5)·EP-12(4+5)·EP-13(8) 자리 검색 재실행 → 22(=19+3)·5·4+5·9(=8+1)줄, 목록과 차집합 ∅. `PLAN_GAP` 0.
- 구현 보고 "win32 테스트는 unit 풀"(§24와 다름): `app/AGENTS.md` exe 대체 규칙과 맞고 규범 행 영향 0 — 수용.

## 2. 하한 ③ — r2 채택 `못 잡음` 원문 형태 재실행

M3·M4·M5·M8·T1~T4·Q2~Q5·M10·M11·M7·N6·O6·S1(두 자리)·S2·S4·S6·S8·S9 = **전부 red**(`r3.tsv`·`r3b.jsonl`, 실행 후 `git status` 빈 출력). r2 동치 K5·V28·V37은 제외(동치 유지).

## 3. 고장 이력 (r3) — 시도 37 = 잡음 33 · 못 잡음 4

| 묶음 | 시도 | 잡음 | 못 잡음 |
|---|---|---|---|
| EP-10 A·B (F0~F6 맞바꿈·빈 값, T1~T4, Q1·Q1b·Q2~Q5) | 22 | 22 | 0 |
| EP-11 V1·V3·M10·M11 | 4 | 4 | 0 |
| EP-12 M7·M7b·N6·N6b·O6 | 5 | 5 | 0 |
| EP-13 S1·S1b·S2·S4·S6·S8·S9·K8 | 8 | 8 | 0 |
| 독립 축 | 4 | 0 | N-b1 · K5 · K9 · K10 |

| ID | 자리 | 바꾼 내용 | 결과 | 분류 |
|---|---|---|---|---|
| N-b1 | `ScheduleTaskModal.tsx:save` | `|| busy` 제거 | green | **확장** — 열거 밖. 확인 버튼이 `canSave`로 비활성이라 사용자 경로 재현 없음 |
| K5 | `shell-runner.ts:kill` | `killRequested` 제거 | green | **동치**(r2와 같음 — `done()`이 정리, 둘째 `process.kill`은 `ESRCH` 삼킴) |
| K9 | `shell-runner.ts:killProcessTree` | win32 분기에서 `pid != null` 제거 | green | **확장** — EP-13 K8은 POSIX 무 pid만 열거 |
| K10 | `shell-runner.ts:runShellCommand` | 이미 중단된 신호 `if (...aborted) kill()` 제거 | green | **확장** — EP-13 K6은 리스너 해제만 열거. 사전 중단 입력 없음 |

## 4. V-pair closeout (r3)

| Pair | 결과 | 직접 oracle 좌표 |
|---|---|---|
| VP-02′ | PASS | `scheduleTaskModal.interaction.test.ts` — EP-10 A 12·EP-12 A 4자리 변이 red |
| VP-23′ | PASS | `executionSettingsPicker.interaction.test.ts` · `projectPickerChip.test.ts` — EP-10 B 5·EP-12 B 5 red |
| VP-11′ | PASS | `SchedulesPage.render.test.ts:'프로젝트·실행 설정 칩의 선택이…'`(G1·G2는 구현자 sweep red, 이번 턴 개별 변이는 안 돌림 — 관측 범위 한계) |
| VP-03′ | PASS | `scheduleTaskModal.interaction.test.ts` `저장` 2케이스 — V1·V3·M10·M11 red |
| VP-12′ | PASS | `shell-runner.test.ts`·`.win32.test.ts`·`.process.test.ts` — EP-13 K1~K8 red |
| VP-04 · 그 밖 ΔV1~ΔV4 pair | PASS | 전체 vitest 통과분(prod diff 0) |
| VP-26′ | PASS(AT 기계분) · AC34 사람 | — |

- 합계 재측정: ✅ 35 · ⚠️ 4 · ❌ 0 = 총 39 — 구현 보고·trailer `35/39`와 일치. ⚠️ = AC23·27·31·34.

## 5. gate (r3) — 검증 트리 `f9c5ac0`

| Gate | 관측 |
|---|---|
| 가드 4종 | migrations `no-copies ok`(append-only `no previous v* tag` skip) · doc-inventory prose·links ok · product-naming `OK — 2293파일` · test-budgets `18 real-git suites ok` |
| lint · typecheck | `eslint .` 0 errors·2 warnings(손대지 않은 파일) · `tsc` error TS 0 |
| 전체 vitest(필터 없음, Node ABI) | 974파일 중 9 fail·961 pass·4 skip / 9247케이스 중 22 fail·9213 pass. 실패 9파일 = r2 기준선과 동일 집합(adapters/claude 3·opencode/v1 3·composer-catalog·composer-preparation-service·session-resources.claude-assembly), 이번 diff와 교집합 0, 환경 원인 = Linux 경로 단언. `[test-pools]` 0건. 미처리 거부 1건도 기준선 파일(`native-resources.test.ts`) |
| `node --test scripts/*.test.mjs` | 868 pass / 0 fail |
| 변이 후 트리 | `git status --short` 빈 출력 |

## 6. Repository operation checks (r3)

- trailer: `git log -1 --format='%(trailers:only=true)' f9c5ac0` → `Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By` 파싱.
- `f9c5ac0` `git cat-file -t` = commit. **`origin/main` 조상 아님**(`merge-base --is-ancestor` 실패) — 브랜치 `ccr-7a11a678-uq140g` 해시, `main` 병합 전.
- `[구현자 기입] (r3)` 7필드 존재, 강제 지점 표는 자리 전부(41/41)와 `남긴 곳` 포함. prod·AGENTS.md 변경 0.

## 7. Finding disposition (r3)

| # | finding | 분류 | disposition |
|---|---|---|---|
| E4~E7 | r2 채택 확장 | §2 원문 형태 전부 red | **closed** |
| N-b1 · K9 · K10 | 독립 축 `못 잡음` 3 | 확장(열거 밖) | `NEXT_HANDOFF(확장)` — 후보 표 1행 |
| 경계 | `setsid` 탈출 손자 · win32 실제 `taskkill` 효과 | plan §24 선언 경계 | 판정 영향 없음 |

## 8. 못 본 것

① Windows 실제 `powershell.exe`·`taskkill` 실행(CI 몫) ② G1·G2 개별 변이(구현자 sweep 47/47에 의존) ③ VP-27 스킬 탭 패널 변이 ④ 화면(AC23·27·31·34 사람 실기) ⑤ `main` 조상 여부(미병합).

## 9. Review Signals — 사실만

- r1 이행 4·현재 1 → r2 이행·현재 0 → r3 이행·현재 0. 확장 후보는 r1 3·r2 4(전부 채택)·r3 3(창 밖 이관).
- 독립 축(⑥) 발견: 확장 3 · 동치 1 · 이행 0 · 현재 0.
- 반복 환경 한계: Windows 경로 CI 몫(r1·r2와 같음).

## 10. 결론

- 상태: **PASS (기계 범위)** — 막는 발견 0, 모든 REQUIRED·REGRESSION pair PASS, 운영 gate 기준선 동일. verify 3회째.
- 남은 것: AC23·27·31·34 사람 실기(UI 시각·Windows) · 새 handoff 후보 1행(N-b1·K9·K10).
