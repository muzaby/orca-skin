# Verify — 0231-background-task-conformance

> 라운드 판정을 시간 역순으로 둔다. r1 원문은 아래 `# r1 — FAIL (보존)`에 그대로 두고 재서술하지 않는다.

# r2 — PASS

## 메타

| 항목 | 값 |
|---|---|
| slug | `0231-background-task-conformance` |
| 검증자 | Claude Code |
| 일자 | 2026-09-16 |
| 대상 커밋/range | `09590f2..947dd9e` (r2 구현 `947dd9e`) |
| 구현 전 plan 기준 | `d38730b` (V1 설계) |
| V mode / 유효 V | Baseline V: V1 |
| 검증 기준 plan revision | `d38730b:V1` |
| 라운드 | 2 |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니다 — 설계·구현 Codex(`Agent: codex`), 검증 Claude Code |

> 실행 트리는 HEAD `66f73a4`다(0233·0234·0235 포함). 0231 production 표면과 겹치는 이후 변경은
> `claude.ts`(agentSpawnEnv 추가)·`send.ts`(extensionProfile 위치 이동) 둘뿐이고 background lane은 건드리지 않았다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예. 메타 `상태` 1줄(`verify/FAIL (r1)` → `impl/IMPL_DONE (r2)`)과 `[구현자 기입] … r2` 7절 138줄 추가.
- **기준선이 diff로 성립하는가**: 예. `git diff d38730b 947dd9e -- plan.md`의 `-` 줄은 메타 2줄과 r1 이전 자리표시자뿐이고 §3·§7·§7-A·§10에는 `-` 줄이 0건이다.
- Decision Ledger 변경: 없음(D-01~D-10 전건 `d38730b` 소유).
- Product/UX Contract 변경: 없음.
- AC 변경: 없음. AC1~AC24 원문은 `d38730b:…/plan.md §7`.
- V node/pair·requiredness·§10·oracle 변경: 없음. REQUIRED 31 + REGRESSION 1, EP-01~EP-12 분모 61.
- 채점에 사용할 원 기준: `d38730b`의 §3·§7·§7-A·§10 — r1과 같다.

### Plan validity

r1 §0의 `Plan validity` 6행을 그대로 승계한다 — 규범 행이 r1 이후 바뀌지 않았음을 위에서 diff로 확인했다.

- root PLAN_GAP과 영향 pair: 없음. r1의 root `PAIR_FAIL` 4건은 기준 누락이 아니라 산출 누락이었고 이번 라운드가 그 산출을 만들었다.

## 1. Product & UX / ACTIVE Decision 요약

r2는 production 코드를 0줄 바꿨다(`git show --name-only 947dd9e | grep ^app/` = 테스트 4파일). 따라서 r1 §1의 Decision ↔ production path 대조가 그대로 유효하고, 이번 라운드가 새로 닫는 것은 **D-09**(조건부 기능의 가용성·선언 검증·실기 결과 별도 기록) 하나다.

| Decision | 기대 결과 | 이번 라운드의 실제 경로 |
|---|---|---|
| D-09 | 가용성·선언 검증·실기를 별도 기록 | 가용성 = `sdk-evidence.md` "Monitor는 이 fixture의 init에 없었다" |
| D-09 | 〃 | 선언 검증 = 신규 3파일이 실제 `ClaudeBackgroundMapper`→`BackgroundController`/`BackgroundTaskTracker`를 지난다 |
| D-09 | 〃 | 실기 = `sdk-evidence.md` "미검증 경계" 문단이 원격 worker·Monitor·분리 Skill을 미검증으로 유지 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| production 동작 변경 | 없음 | r2 diff의 `app/**`는 `*.test.ts` 4파일뿐 — r1 §2의 7행이 그대로 유효 |
| 테스트가 production symbol을 부르는가 | 예 | 세 신규 파일 모두 `ClaudeBackgroundMapper`를 import해 `mapper.map(raw, …)`로 들어간다; 동명 로컬 재구현 0건 |
| 계약을 넘어선 발명 | 없음 | `background.workflow-remote.test.ts:277` 주석이 SDK union에 `blocked`가 없음을 적고 `pending`+raw 보존으로 대신한다 |
| 선언 출처 표기 | 있다 | `background.skill.test.ts:81-83`이 `background:true`를 첨부 SKILL-DETACHED 계약으로 명시(exported 타입 아님) |
| false success 가능성 | 막았다 | `does not interpret task-like text or metadata in an ordinary MCP result` — `_meta.task_id`·본문 문자열로 task를 만들지 않는다 |
| 문서 변경의 사실성 | 참 | `background-tasks.md:19` "renderer에는 …버튼이나 출력 viewer가 없다" ↔ `rg 'stopAllBackgroundTasks|readBackgroundOutput' src/renderer` = `shared/api/ipc.ts` 래퍼 2건뿐, 컴포넌트 호출 0 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 09590f2..947dd9e
# → 변경된 소스 파일이 없습니다 (루트: app/src)
```

스크립트가 후보를 0건으로 돌린 이유는 r2가 production 파일을 바꾸지 않았기 때문이다. r1이 찾은 표면을 HEAD에서 다시 셌다.

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `backgroundPresentation.ts` 죽은 표면 | **축소** | r1 "4함수 소비처 0" → HEAD는 `backgroundTaskStatus`·`canStopBackgroundTask`가 `CanonicalBackgroundContent.tsx:12`에 배선. 나머지 4 export는 여전히 0 → D4 |
| `parts.ts:316 settlementMessage` | 유지 | 생산 1 + 테스트 2, `.tsx` 소비처 0 → D4 |
| 신규 IPC 채널 renderer 소비 | 유지 | main 등록 5/5(`chat-turn/background.ts:56~68`), renderer 호출 0 → D5(문서 반영됨) |
| `coerceStoppedToolCompletion` | 유지 | 프로덕션 호출자 0, 테스트 3파일 참조 → D6 |
| 신규 테스트 파일의 미사용 헬퍼 | 0건 | eslint `--no-cache` error 0 |
| 형제 정책 비대칭 | 0건 | 세 신규 파일이 `Monitor`·`Workflow`·`Agent`/`Task`·`Skill`·`mcp__*` 다섯 분기를 모두 지난다 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: 예. r1이 센 4파일이 HEAD에서도 통과한다.
- structural proxy만으로 통과시킨 AC: 없음.
- **선택된 적대 증거 재측정** — 등록 변이 2(M-5·M-6) + 인용 변이 5(M-23·M-24·M-25·M-26·M-12) + 새 oracle 1(실행 파일 차집합) = 구현자 표 8행. 그중 **변이 7건 전건 재현 red**, 새 oracle 1건은 아래 §7에서 엄격화 재측정.
- **이전 라운드 대조** — r1이 red로 관측한 7변이(M-5·M-6·M-7·M-8·M-9·M-11·M-22)를 이번에 다시 실행해 **전건 red**. `red → green` 덮개 회귀 **0건**.
- **자기검증 분모** — 구현자 ≠ 검증자. 그래도 구현 보고가 이름을 대지 않은 축 **5건**(N-1~N-5)을 신설해 전건 red를 확인했다.
- 일반 hunk 자동 확장: 0건.

각 행은 `./node_modules/.bin/vitest run --maxWorkers=4` **전체 스위트**(527파일)로 측정했다. 재현 스크립트·치환문은 `/tmp/mut/muts*.json` 형식과 같고 적용 후 원본 바이트를 복원했다(`git status --short` 공백).

| 변이 | 대상 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M-5 — `send.ts:506` `onProviderEvent` 배선 삭제 | 전체 | red | **red** 1케이스 | `VP-A1 등록 변이` |
| M-6 — controller `provider.message` 차단 삭제 | 전체 | red | **red** 12케이스 | `VP-A1 등록 변이` |
| M-7 — `included`↔`excluded` 맞바꿈 | 전체 | red | **red** 4케이스 | 검증자 신설(r1) |
| M-8 — 최초 terminal 보존 줄 삭제 | 전체 | red | **red** 3케이스 | 검증자 신설(r1) |
| M-9 — `seenEvents` dedupe 조기 반환 삭제 | 전체 | red | **red** 1케이스 | 검증자 신설(r1) |
| M-11 — `checkedOpen` realpath 봉쇄 삭제 | 전체 | red | **red** 1케이스 | 검증자 신설(r1) |
| M-22 — `post-turn.ts:111` `haveTasks=false` | 전체 | red | **red** 1케이스 | 검증자 신설(r1) |
| M-12 — `runtimeFor` 세대·연결 가드 삭제 | 전체 | **green(오라클 공백)** | **red** 8케이스 | `D7 인용 변이` — 닫힘 |
| M-23 — Monitor 분기 무력화 | 전체 | **green** | **red** 2케이스 | `D1 인용 변이` — 닫힘 |
| M-24 — Workflow mode 파생 제거 | 전체 | **green** | **red** 4케이스 | `D2 인용 변이` — 닫힘 |
| M-25 — 분리 Skill background 분기 무력화 | 전체 | **green** | **red** 4케이스 | `D3 인용 변이` — 닫힘 |
| M-26 — Agent/Task remote mode·taskId 제거 | 전체 | **green** | **red** 3케이스 | `D2 인용 변이` — 닫힘 |
| N-1 — Monitor `mode` 파생만 제거(taskId 유지) | 전체 | 미실행 | **red** 2케이스 | 검증자 신설 · 같은 계약을 더 좁은 지점에서 |
| N-2 — Skill `background === true` → `!== undefined` | 전체 | 미실행 | **red** 1케이스(`flag (false)`) | 검증자 신설 · 형제 슬롯 |
| N-3 — Workflow `taskId`↔`runId` 맞바꿈 | 전체 | 미실행 | **red** 4케이스 | 검증자 신설 · 형제 슬롯 |
| N-4 — Agent `agentId` ← `description` | 전체 | 미실행 | **red** 6케이스 | 검증자 신설 · 형제 지점 |
| N-5 — reducer `awaitingTask`의 mode 기반 항 삭제 | 전체 | 미실행 | **red** 1케이스 | 검증자 신설 · mapper 아닌 seam |

- 동작 보존 추출 라운드인가: 아니오 — 테스트 추가 라운드라 hunk 되돌림 문제가 없다.
- 소거 변이의 잔여물 수렴: 해당 없음 — 17건 전부 **단언 실패**로 red였고 typecheck/구문 오류로 멈춘 행이 없다(실패 이름을 §4 표의 케이스 수로 확인).
- 형제 슬롯 맞바꿈 변이: N-2·N-3이 그 형태다. 소거가 아니라 **값 맞바꿈**에서도 red이므로 존재만 보는 단언이 아니다.
- `N회` 기준의 실제 관측 주체: `stops the linked Monitor task by taskId…`가 `f.stopTask.mock.calls`를 `[[taskId]]`로 단언한다.
- 순서 기준의 관측 훅: `links Monitor receipt before task edges…`가 receipt → `task_started` → snapshot 순서를 각 단계 상태값으로 관측한다.

## 5. V-pair closeout — `UT → IT → ST → AT`

이번 라운드 실행 범위: r1의 root `PAIR_FAIL` 4(VP-R19~R22)와 D7이 닿는 VP-R8, 그리고 영향 판정을 위해 **유효 V 전건 + 운영 gate 전건**을 다시 실행했다(전체 스위트가 모든 pair의 증거를 담기 때문이다).

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 |
|---|---|---|---|---|---|
| VP-M1·M2 | MD ↔ UT | REQUIRED | **PASS** | M-7·M-8·M-9·M-11 전건 red | reducer·output reader / EP-02·03·10·11 |
| VP-A1 | AR-1 ↔ IT-1 | REQUIRED | **PASS** | 등록 변이 M-5·M-6 red | map→routeBatch→journal/relay / EP-01·06·07·12 |
| VP-A2·A3 | AR ↔ IT | REQUIRED | **PASS** | DB·승인·입력 스위트 통과(전체 실패 0) | migration→writer→IPC / EP-07·08·09·10 |
| VP-S1·S2 | SD ↔ ST | REQUIRED | **PASS** | M-22 red; `background-controller.test.ts` 16케이스 | pump→post-turn, 카드→IPC→DB/SDK/fs / EP-04·05·09 |
| VP-R1~R18 | R ↔ AT | REQUIRED | **PASS** | 아래 AC 표. VP-R8은 M-12 red로 보강 | §7 각 행 |
| **VP-R19** | R-19 ↔ AT-19 / AT | REQUIRED | **PASS** | `background.monitor.test.ts` 8케이스; M-23·N-1 red | Monitor 반환/이벤트→canonical / EP-01·02·06·10 |
| **VP-R20** | R-20 ↔ AT-20 / AT | REQUIRED | **PASS** | `background.workflow-remote.test.ts` 11케이스; M-24·N-3 red | Workflow 결과→call/task graph / EP-01·02·05·11 |
| **VP-R21** | R-21 ↔ AT-21 / AT | REQUIRED | **PASS** | `background.skill.test.ts` 7케이스; M-25·N-2·N-5 red | Skill/MCP 봉투→call/task refs / EP-01·02·07·10 |
| **VP-R22** | R-22 ↔ AT-22 / AT | REQUIRED | **PASS** | `retains %s remote history and ambient records…` 2케이스; M-26·N-4 red | 원격/ambient→state→UI / EP-01·02·05·06·11 |
| VP-R23·R24 | R ↔ AT | REQUIRED | **PASS** | r1 증거 좌표 참조 — r2가 해당 경로를 바꾸지 않았고 전체 스위트 실패 0 | bundle/SDK init·bus→writer→reload |
| VP-REG | R-REG ↔ AT-REG | REGRESSION | **PASS** | 전체 527파일 4856케이스 실패 0 | 기존 parts/taskBoard/artifacts / EP-02·11·12 |

- root `PAIR_FAIL`: **없음**. r1의 4건이 전부 닫혔다.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair: `background.workflow-remote.test.ts`가 VP-R20(Workflow)과 VP-R22(remote/ambient)를 함께 닫는다 — 앞은 시작·자식·재실행, 뒤는 원격 수명이라 판정 범위가 다르다.

### AT / AC 세부와 합계

AC1~AC18·AC23·AC24의 ✅ 근거는 r1 §5의 AC 표가 갖는다 — r2가 그 경로를 바꾸지 않았고 전체 스위트가 실패 0이라 재서술하지 않는다. 이번 라운드가 등급을 바꾼 행만 적는다.

| AT / AC | 제품/동작 기준 | r1 | r2 | 검증 증거 |
|---|---|---|---|---|
| AC8 | 실제 taskId+세대로 대상만 중단 | ✅ | ✅ | `rejects stop for a recorded task` 6케이스(양쪽 세대에 같은 ID 실재) + `stops the current recorded task even when history has the same task ID`; M-12 red |
| **AC19** | Monitor 종류·진행·timeout·persistent·출력·중단 해석 | ❌ | **⚠️** | command·WebSocket 2종, `tool_progress`+`task_progress`, `timeoutMs` 경과에도 `running` 유지, `persistent+timeoutMs:0`, `output_file`→`controller.read`, stop ACK→`stopped`. 실기는 미노출 |
| **AC20** | async_launched+error는 시작 실패, taskId/runId/내부 agent 분리 | ⚠️ | ⚠️ | `mode` 파생이 닫혔다 — M-24·N-3 red. 실제 child/stop/resume 배포는 미검증 |
| **AC21** | 분리 Skill/MCP 명시 연결, resourceLinks/_meta 보존 | ⚠️ | ⚠️ | `background` 플래그 3값·중복 링크 1회·`_meta` 비이전이 닫혔다 — M-25·N-2 red. 실제 분리 Skill은 미검증 |
| **AC22** | remote/ambient 기록, 배지 필터·수명 분리 | ⚠️ | ⚠️ | 두 생산자의 `remote`와 원격 taskId가 닫혔다 — M-26·N-4 red. 실제 원격 worker 수명은 미검증 |

- **합계 재측정**: `✅ 20 · ⚠️ 4 · ❌ 0 = 총 24`. 분모는 §7의 AC1~AC24를 직접 셌다.
- **자기보고 대조**: 구현 보고 `✅20 · ⚠️4 · ❌0 = 24` — 등급·사유 모두 일치. r1이 지적한 "⚠️ 사유 축 하나 누락"이 이번 라운드에 선언/실기 두 축으로 갈렸다.
- **합계 사본 대조**: 본문 `20/24` ↔ trailer `Criteria-Met: 20/24` ↔ INDEX 비고 `AC ✅20·⚠️4` — 세 사본 일치.
- ⚠️ 4행이 PASS를 막지 않는 근거: plan §6이 "실제 실기는 별도 증거 단계", §7-A 배포 gate가 "실기 미측정은 지원 완료 미선언"을 요구하고 VP-R19~R22 oracle이 "선언 기반 fixture와 **가용 환경별** 실제 동작 결과를 분리"다. 세 요구가 모두 충족됐다.

### pair별 plan §10 강제 지점 분모

r2가 production 지점을 바꾸지 않았으므로 r1의 12행 재열거(61/61)를 승계하고, **구현자가 이번에 새로 주장한 `60 + 대체 1` 분해만 독립 재측정**했다.

| EP | plan 분모 | 이번 재측정 | 결과 |
|---|---|---|---|
| EP-09 | 5 | 5/5 — `chat-turn/background.ts:56·59·62·65·68` 5 handler | PASS |
| EP-11 | 6 | **5 적용 + 1 대체** — `backgroundStore.ts`·`BackgroundTaskGroup.tsx`·`CanonicalBackgroundContent.tsx`·개별 stop(`CanonicalBackgroundContent.tsx:247`)·`ko.ts` i18n 5지점 실재, output viewer는 HEAD에 없음(0232 D-14) | PASS(대체 명시) |
| 그 외 10 EP | 50 | r1 재열거 좌표 참조 — 해당 파일들이 r2·이후 커밋에서 바뀌지 않았다 | PASS |

- 전수 합계: `61 = 60 적용 + 1 대체`. 구현자 자기보고와 일치하며 r1의 `61/61`과 모순되지 않는다(r1은 구현 커밋 시점, r2는 HEAD 기준).
- 표에 없는데 같은 불변식이 필요한 지점: 없음.
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 이유 | 결과 | 관측한 실행 산출 |
|---|---|---|---|
| 정적 | main 테스트 변경 | **PASS** | `npm run typecheck` 3구성 error 0 · `eslint --no-cache ./src ./scripts` error 0 / warning 1(기존 `useTranscriptVirtualizer.ts:22`) |
| 동작 | reducer·mapper·controller 경계 | **PASS** | `vitest run --maxWorkers=4` **527파일 · 4856케이스**, 실패 0(526 passed·1 skipped 파일 / 4853 passed·3 skipped 케이스), exit 0 |
| DB | migration 변경 없음, 회귀만 | **PASS** | `check-migrations-appendonly` — 27 migrations, dir == `migrate.ts`, 1218 파일 스캔 |
| 문서 | `docs/arch/backend/background-tasks.md` 1줄 추가 | **PASS** | `check-doc-inventory --check` — 9 items · 98 channels · 상대 링크 전건 해석 |
| 메시지 버스 | plan/impl 커밋·INDEX | **PASS** | `git log -1 --format='%(trailers:only=true)' 947dd9e` = 6키 전건 반환 |
| 배포 | SDK/CLI·Windows 두 셸 | **PASS(범위 한정)** | r2는 CLI를 재실행하지 않았다. `sdk-evidence.md` "미검증 경계" 문단이 Monitor·원격 worker·분리 Skill을 미검증으로 유지 — 이 gate의 요구는 "미측정을 지원 완료로 선언하지 않음"이고 충족됐다 |
| 스크립트 | 위생 스크립트 회귀 | **PASS** | `node --test scripts/*.test.mjs` — 16 suites · 119 pass · 0 fail |
| 예산 | 실-git 스위트 | **PASS** | `check-test-budgets` — 11 real-git suites ok |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `MonitorInput`/`MonitorOutput` (`sdk-tools`) | `tsconfig.test.json` typecheck error 0 | `command`·`ws` 두 입력 형태와 `timeoutMs`·`persistent`가 상태로 관측됨 | PASS |
| `SDKTaskStartedMessage` 등 4 wire 타입 | `satisfies` 주석으로 고정 | 실제 mapper가 소비 — M-23 red가 소비 사실을 증명 | PASS |
| `AgentOutput`/`WorkflowOutput` | `satisfies` | `status` 3값 → `mode` 3값 대응이 red로 잠김 | PASS |
| `docs/arch/backend/background-tasks.md` | inventory gate | 추가 문장이 코드와 일치(§2) | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- **구현자 신설 oracle의 엄격화 재측정**: 구현자는 "vitest include와 같은 rg 목록 514파일, 누락 0"을 주장했다. 판정 기준을 한 단계 엄격하게 바꿔(파일 목록 대조 → **확장자 차집합까지**) 다시 쟀다 — `find src -name '*.test.ts'` **527** = `vitest list --filesOnly` **527**, `*.test.tsx` **0**, `*.spec.*` **0**. include 패턴이 조용히 버리는 파일이 없으므로 그 `누락 0`은 전수를 뜻한다.
- AC 분모 24 직접 재측정 일치(§5).
- §10 분모 61 재측정 일치, 내역 `60 + 1 대체` 합이 총계와 같다.
- migration 수 27 — 디렉토리와 `migrate.ts` import 대조로 확인.
- 0건 게이트: eslint error 0은 warning 1을 지우지 않는다(기존 항목이 그대로 출력된다).
- 상한: r2가 출력 경로를 바꾸지 않아 r1의 read 64KiB/snapshot 16MiB 실측이 유효하다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

r1 §8이 "첫 칸이 빈 이유가 사람 실기가 아니다"라고 적은 네 행의 첫 칸이 이번에 채워졌다.

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| Monitor 해석 | command·WebSocket·진행·timeout·persistent·출력·중단 7축 | Monitor를 노출하는 CLI에서의 실제 동작 1건 | Monitor 노출 배포로 command/WebSocket/persistent 실행 |
| Workflow child/stop/resume | 시작 실패·mode·자식 종료·run 재사용·잔여 | 실제 Workflow 배포 실행 | 배포 환경 로그 |
| 분리 Skill / 외부 MCP 자동 background | `background` 3값·명시 연결·MCP 링크/메타 | 실제 분리 Skill 실행 | 배포 환경 로그 |
| 원격 worker 잔여 수명 | remote mode·로컬 종료 후 terminal 미확정·ambient 분리 | 원격 worker 종료 후 잔여 관측 | 배포 환경 로그 |

## 9. 게이트 재실행

- 실제 실행 명령: `npm run typecheck` · `eslint --no-cache ./src ./scripts` · `./node_modules/.bin/vitest run --maxWorkers=4` · `node --test scripts/*.test.mjs` · `check-doc-inventory --check` · `check-migrations-appendonly` · `check-test-budgets`.
- **관측한 실행 산출**: §5 운영 gate 표에 명령별 파일 수·케이스 수·error/warning 수를 적었다. exit code만 옮긴 행은 없다.
- `npm test`를 썼는가: 아니다. `node scripts/ensure-sqlite-abi.mjs node`로 바인딩만 Node ABI로 맞추고 `vitest`를 직접 호출했다.
- 환경 기인 실패 분리: 최초 실행 red 29파일·179케이스는 전부 `Module did not self-register: better_sqlite3.node` — `postinstall`이 Electron ABI로 빌드한 결과다. ABI 전환 뒤 같은 명령이 527파일 전건 green. egress 403 없음.
- **게이트가 작업 트리를 바꿨는가**: 없음. `npm run lint`(`--fix`)를 쓰지 않고 `eslint --no-cache`를 직접 호출했고 실행 후 `git status --short`가 공백이다.
- **검증 중 실행한 명령이 남긴 잔여물**: 추적 파일 0(`git status --short --untracked-files=all` 공백). `node_modules`의 `better_sqlite3.node`는 Node ABI로 남았다 — 이 컨테이너 한정이며 `npm run prebuild`가 Electron ABI로 되돌린다.
- 변이 복원: 17건 전건 원본 바이트 복원(스크립트가 복원 후 바이트 동일성을 assert).

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트/스크립트 | 실행·산출 관측 | — | 완료 |
| AC ↔ production path | 24행 대조 + 변이 17건 | — | 완료 |
| 레이어/계약/문서 | 기계 검증 | — | 완료 |
| 조건부 SDK 기능의 **선언 fixture** | **완료** | — | r1 FAIL 원인 해소 |
| 조건부 SDK 기능의 **실기** | 불가(SDK init에 미노출) | 실행 환경 제공 | 대기 — PASS를 막지 않는다 |

## 11. Repository operation checks

### AGENTS.md 위생

- `AGENTS.md` 변경 없음 — 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: 이번 턴에 `verify` / `PASS` / `d38730b`·`36308ef`·`947dd9e`로 갱신, 다음 주체 `사람`(조건부 실기 4건).
- 「다음 주체」 칸: 하나(`사람`).
- **대상 커밋 좌표 교정**: 구현자가 남긴 `06c320b`·`4f4c5c8`는 이 저장소에 없다(`git cat-file -t` 전건 `Not a valid object name`). 실제 좌표로 교체했다 → D9.
- 비고 5줄 이내: 예.
- archive 이동: **하지 않는다** — 조건부 실기 4건이 남아 0229·0232 선례대로 실기 뒤에 옮긴다.

### Commit / reference 정합성

- trailer 허용값: `Agent: codex` · `Handoff: docs/handoff/0231-background-task-conformance/` · `Status: implemented` · `Criteria-Met: 20/24` · `Criteria-Pending: AC19-22 conditional deployment evidence only` · `Verified-By: pending` (6키) — root `AGENTS.md` 표와 일치.
- trailer 파싱: `git log -1 --format='%(trailers:only=true)' 947dd9e`가 5키를 그대로 반환.
- 인용 커밋 해시 실재: **아니다** — INDEX·r1 verify가 적은 `06c320b`·`4f4c5c8`·`53f7602`가 전부 없다. 보드의 다른 행(`aa55dbc`·`4ae1cfa`·`f7afca5`…)도 같다 → D9.
- 재구현 라운드 `[구현자 기입]` 7필드: **7/7 존재**(설계 리뷰 · 강제 지점 전수와 V-pair 자기확인 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 + 대응 · 구현 보고 · Review Signals). 산문으로 접힌 필드 0.
- 잠금 표 분모 검산: 구현자 `선택 2 + 인용 5 + 새 oracle 1 = 8행`을 독립 재계산 — D1(M-23)·D2(M-24·M-26)·D3(M-25)·D7(M-12) = 인용 5, VP-A1 등록 2, 차집합 oracle 1. 표 행 수 8과 일치.
- reference/script: `r2-evidence.json` 신설, `plan.md` r2 절과 INDEX 비고에서 참조 — 링크 gate 통과.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "VP-R19~R22는 배포 실기 때문에 `SELF_BLOCKED` 유지" | 타당하고 보수적 | 검증자는 pair oracle 기준으로 `PASS`, AC 등급은 ⚠️ 유지 |
| "Skill `background:true`는 첨부 계약 fixture이며 exported 타입이 아니다" | 타당 | 테스트 주석에 출처가 있고 없는 타입을 발명하지 않았다 |
| "원61책임 = 현재60 + 0232대체1" | 타당 | EP-09·EP-11 독립 재열거로 확인(§5) |
| "전체 실행 워커 종료 timeout 뒤 12파일 재실행" | 이 환경에서는 재현 안 됨 | HEAD 전체 실행이 exit 0 — Windows 부하 특성으로 분리 |
| "회귀 보고 파일 제외 probe"를 잠금 표 8행에 포함 | 타당하나 변이가 아님 | §7에서 엄격화 재측정으로 별도 검증 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | r1 BLOCKING — Monitor fixture 0건 | AC19 / VP-R19 | **CLOSED** | — | M-23·N-1 red로 닫힘 |
| D2 | r1 BLOCKING — Workflow/Agent mode·원격 taskId 미관측 | AC20·AC22 / VP-R20·R22 | **CLOSED** | — | M-24·M-26·N-3·N-4 red로 닫힘 |
| D3 | r1 BLOCKING — 분리 Skill background 분기 미관측 | AC21 / VP-R21 | **CLOSED** | — | M-25·N-2·N-5 red로 닫힘 |
| D7 | r1 NON_BLOCKING — stale stop이 `unknown task` 분기로 통과 | AC8 / VP-R8 | **CLOSED** | — | 양쪽 세대에 같은 ID 실재시킨 6케이스 + M-12 red |
| D4 | `backgroundPresentation.ts` 6 export 중 4가 소비처 0, `settlementMessage` 소비처 0 | 0232 D-13·D-14 결과 | NON_BLOCKING | — | 기록. r1 대비 2 export가 배선됨 |
| D5 | `chatStopAllBackgroundTasks`·`chatReadBackgroundOutput` renderer 호출 0 | 0232 D-07·D-14 결과 | NON_BLOCKING | — | 문서 반영 완료(`background-tasks.md:19`). 코드 정리는 후속 |
| D6 | `coerceStoppedToolCompletion` 항등 함수 잔여 | D-06 의도 | NON_BLOCKING | — | 기록 |
| D8 | §10 EP-07의 `recordProviderEvent` ↔ 구현 `persistProviderEvent` 이름 불일치 | 문서 | NON_BLOCKING | — | 설계 — 다음 plan 갱신 |
| **D9** | INDEX·r1 verify가 인용한 커밋 좌표가 저장소에 없다. 0231만이 아니라 보드 전 행이 그렇다 | 메시지 버스 | NON_BLOCKING | — | 이번 턴에 0231 행만 실제 좌표로 교정. 원인은 상류 rebase(`d38730b` author 09-12 / commit 09-14) |
| **D10** | `infra/loopback-callback.test.ts > 타임아웃은 LoopbackCancelledError 로 끝난다`가 전체 병렬 실행 17회 중 2회 실패. 기준 실행과 단독 재실행(6케이스)은 green | 비귀속 — 0231 경로 아님 | NEXT_HANDOFF | — | 실제 타이머에 의존하는 케이스라 부하에서 흔들린다. fake timer 전환 후보 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음. r1의 root 4건이 전부 닫혔고 이전 red 변이 7건의 덮개 회귀도 0이다.
- 관련 plan 지침/AC의 존재 여부: 있었다. r1이 인용한 §7-A oracle("선언 기반 fixture와 가용 환경별 실제 동작 결과를 분리")을 이번 라운드가 앞쪽 절반까지 산출했다.
- 사용자 결정 변경 근거: 없음. Decision Ledger 무변경.
- 반복된 검증 환경 한계: 배포 축 하나. SDK init 도구 목록에 Monitor가 없어 실기가 이 환경에서 불가하다 — r1과 같은 한계이고 이번 판정의 원인은 아니다.
- 라운드 수: 2 — `handoff-review` 트리거(3 초과)에 해당하지 않는다.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED **31 PASS** · REGRESSION **1 PASS** · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision 충족: D-01~D-10 전건. r1이 미충족으로 적은 D-09가 선언 검증 산출로 닫혔다
- AC 충족: ✅20 · ⚠️4 · ❌0 = 24 (자기보고와 등급·사유 모두 일치)
- §10 강제 지점: `61 = 60 적용 + 1 대체`(0232 D-14) — 자기보고와 일치
- 현재 변경 운영 gate: 8종 PASS
- 적대 증거: 17변이 전건 red(이전 라운드 red 7건 재현 + 인용 5 + 검증자 신설 5). 덮개 회귀 0
- NON_BLOCKING: 5건(D4·D5·D6·D8·D9) · NEXT_HANDOFF: 1건(D10) · CLOSED: 4건(D1·D2·D3·D7)
- repository operation checks: trailer 6키 파싱, 좌표 3건 교정, INDEX 갱신 완료
- 남은 사람 확인: 조건부 SDK 기능 4종의 **배포 실기**(§8) — archive 이동은 그 뒤다
- 다음 단계: 사람이 실기를 수행하면 archive history로 이동한다

---

# r1 — FAIL (보존)

## 메타

| 항목 | 값 |
|---|---|
| slug | `0231-background-task-conformance` |
| 검증자 | Claude Code |
| 일자 | 2026-09-13 |
| 대상 커밋/range | `53f7602..4f4c5c8` (구현 `4f4c5c8`) |
| 구현 전 plan 기준 | `06c320b` (V1 설계) |
| V mode / 유효 V | Baseline V: V1 |
| 검증 기준 plan revision | `06c320b:V1` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니다 — 설계·구현 Codex, 검증 Claude Code. |

> 실행 트리는 HEAD `aa55dbc`다(0232 r1·r2 포함). 0231 고유 pair는 0232가 바꾸지 않은 main/shared 경로에 있고,
> 0232가 제거한 renderer 소비처는 §13 D4·D5로 분리했다.

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예. 메타 `상태` 1줄 + `[구현자 기입]` 자리표시자 31줄을 실제 보고 126줄로 교체. `diagnosis.md`는 대조표 23줄.
- **기준선이 diff로 성립하는가**: 예. 규범 행은 설계 커밋 `06c320b`에만 있다. 구현 커밋의 `-` 줄은 전부 `구현 전`·`미측정` 자리표시자다.
- Decision Ledger 변경: 없음(D-01~D-10 전건 설계 커밋 소유).
- Product/UX Contract 변경: 없음.
- AC 변경: 없음. AC1~AC24 원문은 `06c320b:…/plan.md §7`.
- V node/pair·requiredness·§10·oracle 변경: 없음. REQUIRED 31 + REGRESSION 1, EP-01~EP-12 분모 61.
- 채점에 사용할 원 기준: `06c320b`의 §3·§7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 상속 기준 없음 → Baseline V1 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-1~24↔AT, SD-1·2↔ST, AR-1~3↔IT, MD-1·2↔UT 전부 REQUIRED |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | `R-REG ↔ AT-REG`가 기존 main/child/TaskXXX/일반 산출물을 REGRESSION으로 명시 |
| pair별 path·§10 전수·직접 oracle | 유효 | 각 pair가 production path·EP 목록·직접 oracle을 가짐 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | VP-A1만 `required — callback 소거·raw relay 유출 변이`, 나머지는 `not selected` + 이유 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §7-A 운영 gate 표 6종(정적·동작·DB·문서·메시지 버스·배포) |

- root PLAN_GAP과 영향 pair: 없음. 아래 §13의 실패는 전부 **명시된 oracle이 산출되지 않은 구현 측 결함**이지 기준 누락이 아니다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-05 | taskId·agentId·toolUseId·runId·세대 분리 | `shared/background-task.ts:211` `backgroundKey(generation,id)` — 호출 키와 작업 키가 별도 |
| D-06 | ACK·timeout·snapshot 제외로 종료를 합성하지 않음 | `settle.ts:113` `hasCanonical` 조기 반환 · `subagent-settlement.ts:101` coercion 무력화 · `turn-coordinator.ts:449` live-set 정착 제거 |
| D-07 | raw는 앱 DB 한정 | `background-controller.ts:72` `provider.message` relay 차단 · `background-task-queries.ts:37` `event_type <> 'provider.message'` |
| D-08 | 참조 ID·세대 검증 후 64KiB 이하 증분 읽기 | `background-output.ts:76` `Buffer.alloc(Math.min(65_536,…))` |
| D-10 | 상태 이벤트는 pump 독점 전달 | `session-runtime.ts:657` `routeProviderEvents` → `delegate.onProviderEvent` |

### end-to-end 흐름

```text
SDK 메시지 → claude-map/claude-background (canonical + provider.message)
  → SessionRuntime.routeProviderEvents (frame/draining 이전, 독점)
  → BackgroundController.observe → HistoryWriter.persistProviderEvent(journal)
  → commit 후에만 tracker.observe + sanitized relay(chatBackgroundEvent)
  → renderer backgroundStore → 카드/상태
  ↘ 카드 stop → preload → controller.runtimeFor(세대·연결 검증) → SDK stopTask
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 안전 | journal insert가 throw하면 `routeProviderEvents`가 잡아 `Provider event observation failed`로 채널만 종료하고 원본 payload를 전파하지 않는다(`session-runtime.ts:665`) |
| false success 가능성 | 막았다 | `stopAll`이 `{residualTaskIds, unknown}`을 반환하고 무조건 성공 Promise가 아니다(`background-controller.ts:255`) |
| partial failure/rollback | 처리 | snapshot 확보 후 journal 실패 시 고아 snapshot 삭제 + terminal 보존(`removes an orphan snapshot if its journal insert fails…`) |
| Product/UX의 A가 아닌 B | 아니다 | 종료 근거·live 소속·stop 확인이 별도 필드로 남는다(`BackgroundTaskRecord.terminalEvidence`·`liveMembership`·`stop`) |
| 증상만 제거했는가 | 아니다 | watchdog/coercion을 끄면서 canonical 근거를 대체 경로로 세웠다 |
| 최적화가 잃은 관측 | 없음 | dedupe는 `동일 UUID+동일 payload`만 억제하고 수정 payload는 별도 row |
| 출력/요청 worst-case 상한 | 유계 | read 64KiB/회, snapshot 16MiB 상한 + `partial:true`·확보분 sha256 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 53f7602..4f4c5c8
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `settleTaskSubset` 미사용 export | 정상 | 정의 파일 내부 `settle.ts:117`이 호출. 스크립트가 정의 파일을 분모에서 제외한 오탐 |
| `backgroundEventKey`·`backgroundJournalKey` 미사용 | 정상 | 같은 파일 내부 소비(`background-task.ts:320`·`background-task-queries.ts:51`) |
| `coerceStoppedToolCompletion` 테스트 전용 | **의도 + 잔여** | D-06으로 무력화되어 현재 항등 함수이며 프로덕션 호출자 0. 테스트 4참조만 남았다 → D6 |
| `backgroundPresentation.ts` 4함수 | **죽은 표면** | HEAD에서 프로덕션 소비처 0 — 0232 D-13·D-14가 카드 결과 본문과 출력 viewer를 제거했다 → D4 |
| `parts.ts:316 settlementMessage` | **죽은 파생** | 생산만 있고 `.tsx` 소비처 0 → D4 |
| 형제 정책 비대칭 | 0건 | 스크립트 출력 "(없음)" |
| 신규 IPC 채널의 소비처 | **2건 미배선** | `chatStopAllBackgroundTasks`·`chatReadBackgroundOutput`은 main 등록·preload 노출까지 있으나 renderer 호출 0 → D5 |
| producer ↔ consumer 파생 불일치 | **4건** | Monitor·Workflow mode·Agent remote·분리 Skill background — 생산만 있고 어떤 oracle도 관측하지 않는다 → D1~D3, §5 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: 예. `background-tasks`·`stop-subagent`·`subagent-settlement`·`parts.stale-async` 4파일 전건 실재하고 이번 트리에서 통과.
- structural proxy만으로 통과시킨 AC: 없음 — 이 plan은 전 pair에서 상태·값 직접 관측을 골랐다.
- **선택된 적대 증거 재측정** — VP-A1 등록 변이 2건 중 검출 **2** · 미검출 **0**. 검증자 신설 축 **9건** 중 검출 **5** · **미검출 4**(전부 §13의 root 실패 근거). 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1이므로 해당 없음(덮개 회귀 0).
- **자기검증 분모**: 해당 없음(구현자 ≠ 검증자).

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M-5 — `send.ts:503`의 `onProviderEvent` 배선 삭제 | chat-turn.runtime-tools·background.integration | 구현자 red | **red** (`VP-A1 routes the actual send request provider callback…`) | `VP-A1 등록 변이` |
| M-6 — controller의 `provider.message` relay 차단 삭제 | background-controller | 구현자 red | **red** (`…never relays raw`) | `VP-A1 등록 변이` |
| M-7 — snapshot의 `included`/`excluded` 형제 슬롯 맞바꿈 | shared·controller·store 20파일 | 미실행 | **red** (2케이스) | 검증자 신설 · VP-M1/VP-R4 |
| M-8 — `mergeTask`의 최초 terminal 보존 줄 삭제 | 같음 | 미실행 | **red** (`keeps terminal evidence through delayed start and conflicting completion`) | 검증자 신설 · VP-M1/VP-R5 |
| M-9 — `seenEvents` dedupe 조기 반환 삭제 | 같음 | 미실행 | **red** (`deduplicates identical UUID/payload…`) | 검증자 신설 · VP-M1/VP-R6 |
| M-11 — `checkedOpen`의 realpath 봉쇄 검사 삭제 | background-output | 미실행 | **red** (`rejects false, URI, sibling prefix, traversal and junction escapes…`) | 검증자 신설 · VP-M2/VP-R16 |
| M-22 — `post-turn.ts:111` `haveTasks`를 `false`로 고정 | chat-turn 27파일 | 미실행 | **red** (`예약 없이 백그라운드 작업만 기다려도 ready이며 즉시 재개한다`) | 검증자 신설 · VP-S1/VP-R7 |
| M-10 — `checkedOpen`의 `ref.canRead === false` 가드 삭제 | background-output·controller | 미실행 | **green — 결함 아님** | 같은 규칙이 3층(`read():110`·`checkedOpen`·`outputDenied():421)에 있어 한 층을 빼도 동작이 같다 |
| M-12 — `runtimeFor`의 세대·연결 가드 삭제 | controller·promotion | 미실행 | **green → 오라클 공백** | 프로덕션은 정상(검증자 probe: g1 작업 실재 상태에서 stale 요청 거부·`stopTask` 0회, 같은 probe는 M-12에서 red). 기존 테스트가 `unknown task` 분기로 통과 → D7 |
| M-23 — `claude-background.ts:396` Monitor 분기 무력화 | **전체 511파일** | 미실행 | **green** | VP-R19 root — §5 |
| M-24 — Workflow `remote_launched→remote`·`async_launched→background` 제거 | main·shared·renderer chat 476파일 | 미실행 | **green** | VP-R20·R22 root — §5 |
| M-25 — 분리 Skill `background===true → mode` 분기 무력화 | 같음 476파일 | 미실행 | **green** | VP-R21 root — §5 |
| M-26 — Agent/Task `remote_launched→remote` + 원격 taskId 제거 | 같음 476파일 | 미실행 | **green** | VP-R22 root — §5 |

- 동작 보존 추출 라운드인가: 아니오 — 신규 기능 라운드라 hunk 되돌림 문제는 없다.
- 소거 변이의 잔여물 수렴: M-25 1차 시도는 `else if` 닫는 괄호까지 지워 컴파일이 깨졌다. 술어만 바꾸는 형태로 다시 심어 **동작 축에서** 측정했다(476파일 green).
- 형제 슬롯 맞바꿈 변이: M-7 — live snapshot의 `included`↔`excluded`를 맞바꿔 red 확인.
- `N회` 기준의 실제 관측 주체: stop-all 재확인 3회·2초 한도는 `returns unresolved tasks after bounded stop-all…`이 fake timer로 6초를 진행시켜 `stopTask` 호출 횟수를 센다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 |
|---|---|---|---|---|---|
| VP-M1 | MD-1 ↔ UT-1 / UT | REQUIRED | **PASS** | `background-task.test.ts` 12케이스; M-7·M-8·M-9 red | canonical event → reducer / EP-02·03 |
| VP-M2 | MD-2 ↔ UT-2 / UT | REQUIRED | **PASS** | `background-output.test.ts` 6케이스; M-11 red | outputId → bounded reader / EP-10·11 |
| VP-A1 | AR-1 ↔ IT-1 / IT | REQUIRED | **PASS** | 등록 변이 M-5·M-6 전건 red | map→routeBatch→journal/relay / EP-01·06·07·12 |
| VP-A2 | AR-2 ↔ IT-2 / IT | REQUIRED | **PASS** | `background-task-queries.test.ts`·`writer.background.test.ts`·`migrate.test.ts` 통과, 0027 CASCADE·UNIQUE 실재 | migration→writer→state IPC / EP-07·09·10 |
| VP-A3 | AR-3 ↔ IT-3 / IT | REQUIRED | **PASS** | `approval.identity.test.ts`(electron 설치 후 재실행 통과)·`claude-map.background-metadata.test.ts` 5케이스 | callback/receipt/stats 경계 / EP-01·06·08·12 |
| VP-S1 | SD-1 ↔ ST-1 / ST | REQUIRED | **PASS** | `background.integration.test.ts`; M-22 red | query→pump→post-turn / EP-01·03·04·06·08 |
| VP-S2 | SD-2 ↔ ST-2 / ST | REQUIRED | **PASS** | `background-controller.test.ts` 9케이스(stop ACK·stop-all·orphan snapshot·복원) | 카드→IPC→DB/SDK/fs→reload / EP-05·07·09·10·11 |
| VP-R1~R18 | R ↔ AT | REQUIRED | **PASS** | 아래 AC 표 | §7 각 행 |
| **VP-R19** | R-19 ↔ AT-19 / AT | REQUIRED | **PAIR_FAIL** | Monitor 분기(`claude-background.ts:396`)를 통째로 무력화해도 **전체 511파일 4745케이스 green**(M-23). `rg Monitor app/src --glob '*.test.ts'` = 0건 | Monitor 반환/이벤트→canonical / EP-01·02·06·10 |
| **VP-R20** | R-20 ↔ AT-20 / AT | REQUIRED | **PAIR_FAIL** | 시작 실패 절은 닫혔다(`does not invent Agent taskId or accept Workflow launch errors`). `mode`·원격 파생은 제거해도 476파일 green(M-24) | Workflow 결과→call/task graph / EP-01·02·05·11 |
| **VP-R21** | R-21 ↔ AT-21 / AT | REQUIRED | **PAIR_FAIL** | MCP `resourceLinks`/`resource_links`는 닫혔다(`CanonicalBackgroundContent.render.test.ts:258·264`). 분리 Skill `background` 분기는 무력화해도 476파일 green(M-25) | Skill/MCP 봉투→call/task refs / EP-01·02·07·10 |
| **VP-R22** | R-22 ↔ AT-22 / AT | REQUIRED | **PAIR_FAIL** | ambient는 닫혔다(mapper→`background-tasks.ts:198` count 제외→카드 라벨). `remote` 기록은 두 생산자 모두 무력화해도 green(M-24·M-26) | 원격/ambient→state→UI / EP-01·02·05·06·11 |
| VP-R23·R24 | R ↔ AT | REQUIRED | **PASS** | `records installed SDK and actual bundled CLI identity on initialization`; `writer.background.test.ts` 재로드·CASCADE | bundle/SDK init·bus→writer→reload |
| VP-REG | R-REG ↔ AT-REG | REGRESSION | **PASS** | 전체 스위트 실패 0, TaskXXX·일반 산출물·0230 회귀 포함 | 기존 parts/taskBoard/artifacts / EP-02·11·12 |

- root `PAIR_FAIL`: **VP-R19 · VP-R20 · VP-R21 · VP-R22**. 네 pair는 공통 원인 하나가 아니라 각각 다른 production 분기가 어떤 oracle에도 닿지 않는다.
- 종속 `BLOCKED_BY`: 없음 — 하위 UT/IT/ST pair는 독립 판정으로 전건 PASS다.
- 하나의 증거가 함께 닫은 pair: `background-task.test.ts`가 VP-M1(UT)과 VP-R4·R5·R6(AT)을 함께 닫는다 — UT는 reducer 불변식, AT는 사용자 관측 결과라 판정 범위가 다르다.
- 이번 라운드 실행 범위: 최초 검증 — REQUIRED 31 + REGRESSION 1 전건 + 운영 gate 6종.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 |
|---|---|---|---|
| AC1 | 실제 반환·시작·snapshot으로 실행 모드 표시, ID 분리 | ✅ | `keeps no-task-id Agent launch as a call and binds only explicit toolUseId` |
| AC2 | completed content·통계·모델 보존, 재호출이 이전 결과를 지우지 않음 | ✅ | `keeps model content and complete structured Agent/Bash results independently` |
| AC3 | Bash·PowerShell 동시 활성, 원래 이름 보존 | ✅ | `claude.ts` disallowedTools에서 Bash 제거 + 구현자 Windows 실기 9조합 기록 |
| AC4 | 첫 snapshot부터 taskId 전체 집합 교체 | ✅ | `creates snapshot-only tasks, replaces membership without guessing termination`; M-7 red |
| AC5 | killed/completed/failed patch만으로 종료 확인 | ✅ | `keeps terminal evidence through delayed start and conflicting completion`; M-8 red |
| AC6 | 동일 UUID+payload 멱등, 수정 payload 보강 | ✅ | `deduplicates identical UUID/payload but accepts amended payload and zero values`; M-9 red |
| AC7 | 메인 result 뒤에도 소비 유지 | ✅ | `예약 없이 백그라운드 작업만 기다려도 ready이며 즉시 재개한다`; M-22 red |
| AC8 | 실제 taskId+세대로 대상만 중단 | ✅ | `bounds a stop request whose SDK never acknowledges it` · `turns an individual stop ACK without terminal evidence into an explicit unconfirmed state` |
| AC9 | 전체 중단이 입력 차단 + 제한 재확인 | ✅ | `returns unresolved tasks after bounded stop-all and releases the input gate`(main 경로). renderer 진입점은 0232 D-07이 제거 → D5 |
| AC10 | still_queued 입력 재전송 금지 | ✅ | `retains input UUID arrays and queued count on result` + `claude-input-receipts.test.ts` |
| AC11 | requestId·toolUseID·agentID로 승인 귀속 | ✅ | `approval.identity.test.ts`(3케이스) |
| AC12 | 중첩 부모 연결과 main 분리 | ✅ | `routes child text and thinking deltas to their parent tool` · `routes child thinking without replacing main context usage` |
| AC13 | heartbeat가 retry를 해제하지 않음 | ✅ | `keeps retry across heartbeats and preserves zero elapsed time` |
| AC14 | 재연결=재동기화, 새 CLI=새 세대 | ✅ | `reinitialize requires a fresh snapshot to restore connected state` · `resets live on new generation and ignores old replay currentness` |
| AC15 | 출력 참조·완료 snapshot 보존, 접근 실패 구분 | ✅ | `background-output.test.ts` 6케이스 + `never lets historical output capture take ownership of the current generation` |
| AC16 | main 소유 참조의 허용 루트 실제 경로만 읽기 | ✅ | `rejects false, URI, sibling prefix, traversal and junction escapes; missing is explicit`; M-11 red |
| AC17 | progress·최종 통계 각각 snapshot, 누적 구분 | ✅ | `accounts query cumulative cost and model usage as deltas and resets with a new query` |
| AC18 | TaskXXX 체크리스트와 background 분리 | ✅ | `taskBoard.test.ts` + canonical 경로 분리, 전체 스위트 실패 0 |
| **AC19** | 제공되는 Monitor 종류·진행·timeout·persistent·출력·중단 해석 | **❌** | production 분기는 있으나 어떤 oracle도 관측하지 않는다(M-23: 전체 4745케이스 green). 실기도 미노출(`sdk-lifecycle-evidence.json:10` "Monitor absent from observed init tool list") |
| **AC20** | async_launched+error는 시작 실패, taskId/runId/내부 agent 분리 | **⚠️** | 시작 실패 절 ✅. `mode` 파생(원격/백그라운드)은 미관측(M-24 green) |
| **AC21** | 분리 Skill/MCP 명시 연결, resourceLinks/_meta 보존 | **⚠️** | MCP 링크 절 ✅. 분리 Skill 자동 background 절 미관측(M-25 green) |
| **AC22** | remote/ambient 기록, 배지 필터·수명 분리 | **⚠️** | ambient 절 ✅. remote 기록은 두 생산자 모두 미관측(M-24·M-26 green) |
| AC23 | SDK/CLI 선언·실제 버전·미검증 목록 기록 | ✅ | `records installed SDK and actual bundled CLI identity on initialization` + `sdk-evidence.md`의 미검증 목록 |
| AC24 | 기존 대화·산출물·격리 보존, raw는 DB 한정 | ✅ | `…never relays raw`; M-6 red. `background-task-queries.ts:37`이 relay 질의에서 `provider.message` 제외 |

- **합계 재측정**: `✅ 20 · ⚠️ 3 · ❌ 1 = 총 24`(분모는 §7의 AC1~AC24를 직접 셈).
- **자기보고 대조**: 구현 보고 `✅20 · ⚠️4 = 24`, trailer `Criteria-Met: 20/24` + `Criteria-Pending: AC19-22`. **총계는 일치하지만 분류 근거가 다르다** — 자기보고의 ⚠️ 사유는 "실제 배포 실기 미검증" 한 축이고, 재측정 결과 AC19~22는 **선언 기반 fixture 자체가 없어** 기계 검증 가능한 절반도 열려 있다.
- **합계 사본 대조**: 본문 24 ↔ trailer `20/24` ↔ INDEX 비고 "AC 20/24" — 수치는 일치.

### pair별 plan §10 강제 지점 분모

| EP | plan 분모 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| EP-01 | 5 | 5/5 — `claude.ts` query 옵션·세대 / `claude-map.ts` system / assistant·user / tool_progress / init·retire | PASS |
| EP-02 | 6 | 6/6 — `background-task.ts`의 call·task·snapshot·connection·dedupe + `parts.ts` child projection | PASS |
| EP-03 | 5 | 5/5 — `background-tasks.ts` observe·getState·count·hasPending·retire | PASS |
| EP-04 | 3 | 3/3 — activity projector · `post-turn.ts:111` · continuation 수신 | PASS |
| EP-05 | 5 | 5/5 — `stop-subagent` · `settleTaskSubset` · `settleTrackedTasks` · `coerceStoppedToolCompletion` · coordinator. 뒤 두 지점은 **무력화 형태로 닫혔다**(D-06) | PASS |
| EP-06 | 6 | 6/6 — `routeBatch` · retire · TurnRequest · send · continuation · 입력 UUID | PASS |
| EP-07 | 6 | 6/6 — 0027 migration·등록 / queries / **writer(`persistProviderEvent`)** / 복원 / sanitized relay / CASCADE. **이름이 plan과 다르다** → D8 | PASS(계약) |
| EP-08 | 4 | 4/4 — permission callback · requester · broker · Ask 매칭 | PASS |
| EP-09 | 5 | 5/5 — schema · preload · handler(`chat-turn/background.ts:56~68` 5채널) · stop 대상 lookup · output ref lookup | PASS |
| EP-10 | 5 | 5/5 — policy realpath · bounded reader · cursor · snapshot/hash · canRead/URI | PASS |
| EP-11 | 6 | 6/6 — 구현 커밋 시점 기준. HEAD에서는 출력 viewer 1지점이 0232 D-14로 제거됨 → D5 | PASS(커밋 시점) |
| EP-12 | 5 | 5/5 — usage baseline · bootstrap · TaskXXX · 0230 산출물 · 문서 | PASS |

- 전수 합계 독립 재측정: `5+6+5+3+5+6+6+4+5+5+6+5 = 61`. 자기보고 61/61 — 일치.
- 표에 없는데 같은 불변식이 필요한 지점: 없음.
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 이유 | 결과 | 증거 |
|---|---|---|---|
| 정적 | main/preload/renderer/shared 변경 | **PASS** | typecheck 3구성 error 0 · eslint error 0 / warning 1(기존) |
| 동작 | reducer·pump·DB·출력·renderer 경계 | **PASS** | `vitest run --maxWorkers=4` 510파일·4745케이스 통과, 실패 0 |
| DB | migration 0027 추가 | **PASS** | `check-migrations-appendonly.mjs` — 27 migrations, dir == migrate.ts |
| 문서 | IPC·arch 계약 | **PASS** | `check-doc-inventory.mjs --check` — 9 items·98 channels, 상대 링크 전건 |
| 메시지 버스 | plan/impl 별도 커밋·INDEX | **PASS** | `git diff --check` 통과, trailer 6키 파싱 |
| 배포 | SDK/CLI·Windows 두 셸 | **PASS(범위 한정)** | `sdk-evidence.md`·`sdk-lifecycle-evidence.json`에 실행 로그와 **미검증 목록**이 함께 있다. 이 gate는 "미측정을 지원 완료로 선언하지 않음"을 요구하고 그 요구는 충족됐다 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `ProviderMessageBatch.providerEvents` 별도 lane | typecheck | `events`에 provider.message가 섞이지 않음 — relay 차단 테스트가 publish 1회를 단언 | PASS |
| `background_task_events` 스키마 | 실제 SQLite 실행 | CASCADE + `UNIQUE(session_id,generation,event_key)` DDL 실재 | PASS |
| 5개 신규 IPC 채널 | zod 스키마 + preload | main 등록 5/5. renderer 소비 3/5 → D5 | 부분 |
| `docs/IPC_CONTRACT.md`·`docs/arch/backend/background-tasks.md` | inventory gate | 채널 98개 수치가 코드와 일치 | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- §10 분모 61 재측정 일치(§5).
- AC 분모 24 직접 재측정 일치, 등급 분류는 불일치(§5).
- migration 수 27 — `check-migrations-appendonly`가 디렉토리와 `migrate.ts` import를 대조.
- 0건 게이트: raw 비노출은 `publish` 호출 횟수 1을 단언하는 양성/음성 짝이라 "0건"이 전수를 뜻한다.
- 출력 상한 실측: read 1회 ≤ 64KiB(`Buffer.alloc(Math.min(65_536, max(1,maxBytes)))`), snapshot ≤ 16MiB + `partial` 표기. IPC 스키마가 `maxBytes 1…65536`을 강제.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| Monitor 해석 | **없음** — 그러나 사람 몫이 아니다. `claude-background.ts`는 순수 매퍼라 합성 payload fixture로 전부 관측 가능하다(Workflow가 이미 그 형태) | 실제 Monitor 노출 환경에서의 동작 1건 | Monitor를 노출하는 CLI로 command/WebSocket/persistent 실행 |
| Workflow child/stop/resume | 시작 실패·receipt 절 | 실제 Workflow 배포 실행 | 배포 환경 로그 |
| 분리 Skill / 외부 MCP 자동 background | MCP 링크 절 | 실제 분리 Skill 실행 | 배포 환경 로그 |
| 원격 worker 잔여 수명 | ambient 절 | 원격 worker 종료 후 잔여 관측 | 배포 환경 로그 |

> 위 4행의 **첫 칸이 비어 있는 이유가 "사람 실기"가 아니다.** 선언 기반 fixture는 이 환경에서 만들 수 있고, plan의 oracle도 그것을 요구한다.

## 9. 게이트 재실행

- 실제 실행 명령: `npm run typecheck` · `eslint --no-cache ./src ./scripts` · `vitest run --maxWorkers=4` · `node --test scripts/*.test.mjs` · `check-doc-inventory --check` · `check-migrations-appendonly` · `check-test-budgets`.
- **관측한 실행 산출**: typecheck 3구성 error 0 · eslint error 0/warning 1 · vitest 510파일 4745케이스 통과(1 skip 파일·3 skip 케이스) · scripts 116케이스 · inventory 9 items·98 channels · migrations 27 · budgets 11 suites.
- `npm test`를 썼는가: 아니다. DB 스위트는 `npm rebuild better-sqlite3`(Node ABI)로 바인딩만 만들고 `vitest`를 직접 호출했다.
- 환경 기인 실패 분리: 최초 실행 red 7파일 = `Electron failed to install correctly`. `node node_modules/electron/install.js` 뒤 7파일 28케이스 전건 통과. egress 403 없음.
- **게이트가 작업 트리를 바꿨는가**: 없음(`--fix` 없는 eslint 직접 호출).
- **검증 중 남긴 잔여물**: 없음. 변이 13건 복원, probe 2파일 삭제, `git status --short` 공백.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트 | 실행·산출 관측 | — | 완료 |
| AC ↔ production path | 24행 대조 + 변이 13건 | — | 완료, 4행 미충족 |
| 레이어/계약/문서 | 기계 검증 | — | 완료 |
| 조건부 SDK 기능의 **실기** | 불가(미노출) | 실행 환경 제공 | 대기 |
| 조건부 SDK 기능의 **선언 fixture** | **가능** | — | **미산출 → FAIL 원인** |

## 11. Repository operation checks

### AGENTS.md 위생

- `AGENTS.md` 변경 없음 — 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: 이번 턴에 `verify` / `FAIL` / `06c320b`(설계) · `4f4c5c8`(r1)로 갱신, 다음 주체 `Codex`.
- 「다음 주체」 칸: 하나(`Codex`).
- 대상 커밋 좌표 기입: `git cat-file -t 4f4c5c8`·`06c320b` 전건 `commit`.
- 비고 5줄 이내: 예.
- archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- trailer 허용값: `Agent: codex` · `Status: implemented` · `Criteria-Met: 20/24` · `Criteria-Pending: AC19-22 conditional deployment evidence` · `Verified-By: pending` — 표와 일치.
- trailer 파싱: `git log -1 --format='%(trailers:only=true)' 4f4c5c8` = 6키 전건 반환.
- 인용 커밋 해시 실재: `06c320b`·`4f4c5c8` 전건 `commit`.
- reference/script: `sdk-evidence.md`·`sdk-evidence.json`·`sdk-lifecycle-evidence.json`·`smoke-background-sdk.mjs` 신설, plan·0230 plan에서 참조 — 링크 gate 통과.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "retire는 이전 source/token을 캡처 후 무효화하고 종료 관측을 동기 전달" | 타당 | `session-runtime.ts` retire 경로 확인, observer 예외는 sanitized 오류로 봉쇄 |
| "실제 SDK task_started에는 status가 없다 → mapper 통합 RED 후 수정" | 타당 | 선언에 맞춘 수정이며 AC1·AC4 행동으로 관측됨 |
| AC19~22 ⚠️ 사유를 "실제 배포 실기 대기"로만 적음 | **불충분** | 선언 기반 fixture도 없다(§5). 사유 축이 하나 빠졌다 |
| EP-05의 두 지점을 "무력화"로 닫음 | 타당 | D-06이 요구한 방향. 단 항등 함수 잔여는 D6 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | Monitor 분기(`claude-background.ts:396`)를 무력화해도 전체 4745케이스가 green. 테스트·스크립트 어디에도 `Monitor` fixture가 없다 | AC19 / VP-R19 | **BLOCKING** | root VP-R19 | 구현 — 선언 기반 Monitor payload fixture(종류·진행·timeout·persistent·출력·중단) |
| D2 | Workflow·Agent 두 생산자의 `remote_launched→mode:'remote'`·`async_launched→mode:'background'`와 원격 taskId 파생을 제거해도 476파일 green | AC20·AC22 / VP-R20·VP-R22 | **BLOCKING** | root VP-R20·VP-R22 | 구현 — 두 생산자의 mode 파생과 원격 기록 fixture |
| D3 | 분리 Skill `background===true → mode:'background'` 분기를 무력화해도 476파일 green | AC21 / VP-R21 | **BLOCKING** | root VP-R21 | 구현 — 분리 Skill 자동 background fixture |
| D4 | `backgroundPresentation.ts` 4함수와 `parts.ts:316 settlementMessage`가 HEAD에서 프로덕션 소비처 0 | 비귀속 — 0232 D-13·D-14의 결과 | NON_BLOCKING | — | 기록. 0232 후속 정리 후보 |
| D5 | `chatStopAllBackgroundTasks`·`chatReadBackgroundOutput`이 main 등록·preload 노출까지 있으나 renderer 호출 0. AC9의 "전체 중단"·AC15/16의 출력 열람은 HEAD에 사용자 진입점이 없다 | 0232 D-07·D-14가 제거 | NON_BLOCKING | — | 기록 + `docs/arch/backend/background-tasks.md`에 현재 상태 반영 후보 |
| D6 | `coerceStoppedToolCompletion`이 인자를 쓰지 않는 항등 함수로 남아 테스트 4참조만 갖는다 | D-06 의도 | NON_BLOCKING | — | 기록. 제거 여부는 후속 |
| D7 | `background-controller.test.ts`의 "rejects stale generations" 단언이 `unknown task` 분기로 통과해 세대·연결 가드를 잠그지 않는다. 프로덕션 동작은 정상(검증자 probe로 확인) | AC8 / VP-R8 | NON_BLOCKING | — | 구현 — 옛 세대에 **실재하는** 작업으로 stale stop 케이스 추가 |
| D8 | plan §10 EP-07과 "IPC/영속의 구체 계약"이 `HistoryWriter.recordProviderEvent`라고 적었으나 구현 이름은 `persistProviderEvent`다. 계약 의미(세션 row 전 버퍼링·commit 후 state/relay)는 일치 | 문서 | NON_BLOCKING | — | 설계 — 다음 plan 갱신 때 이름 정정 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음(r1).
- 관련 plan 지침/AC의 존재 여부: 있었다. §7-A가 VP-R19~R22의 oracle을 "선언 기반 fixture와 가용 환경별 실제 동작 결과를 **분리**"로 적었고, 산출된 것은 뒤쪽(실기 미검증 기록)뿐이다.
- 사용자 결정 변경 근거: D-04(Bash 활성화)는 §2에 사용자 응답 출처가 있다.
- 반복된 검증 환경 한계: 없음 — 이 환경은 egress가 열려 전체 스위트·DB·Electron 로딩이 전부 실행됐다. 남은 한계는 SDK가 Monitor/Workflow child/원격 worker를 노출하지 않는 **배포 축 하나**다.

## 15. 결론

- 상태: **FAIL**
- pair 결과: REQUIRED **27 PASS** · root **PAIR_FAIL 4**(VP-R19·R20·R21·R22) · BLOCKED_BY 0 · REGRESSION 1 PASS
- PLAN_GAP: 없음 — 기준은 충분하고 그 기준이 요구한 oracle이 산출되지 않았다
- Product/UX 및 ACTIVE Decision 충족: D-01~D-10 중 D-09("조건부 기능은 가용성·선언 검증·실기 결과를 별도 기록")만 미충족 — 선언 검증이 없다
- AC 충족: ✅20 · ⚠️3 · ❌1 = 24 (자기보고 총계와 일치, 등급 사유는 불일치)
- §10 강제 지점: 독립 재열거 **61/61** 일치
- 현재 변경 운영 gate: 6종 PASS
- NON_BLOCKING: 5건(D4~D8) · NEXT_HANDOFF: 없음
- repository operation checks: trailer 6키 파싱, 좌표 2건 실재, INDEX 갱신 완료
- 남은 사람 확인: 조건부 기능 4종의 **실기**(§8) — 이번 FAIL의 원인은 아니다
- 다음 단계: 구현자가 D1~D3의 선언 기반 fixture를 만들어 r2로 돌린다. D7도 같은 라운드에서 닫기를 권한다
