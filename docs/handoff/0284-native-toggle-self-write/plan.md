# Plan — 0284-native-toggle-self-write

## 메타

| 항목 | 값 |
|---|---|
| slug | `0284-native-toggle-self-write` |
| 작성자 | Claude Code |
| 일자 | 2026-10-25 |
| 매핑 | 0279 D9(파일 임계영역) 후속 버그수정 — 구현 주체 Claude(비기능) |
| 상태 | IMPL_DONE (r2) |
| V mode | `Baseline V` |
| 기준 V | `none` — 0279 V는 상속하지 않고 영향 경로를 REGRESSION pair로 다시 닫는다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 상태 패널에서 Claude 네이티브 플러그인 두 개를 연달아 토글하면 두 번째가 `이 항목은 프로젝트별 제어를 지원하지 않습니다.`로 실패한다. 한 개만 토글해도 완료 시점에 목록 전체가 잠깐 다른 표시로 바뀌었다가 돌아온다.
- 완료 후 달라지는 것: 겹친 토글은 순서대로 모두 적용되고, 토글 완료가 다른 항목의 표시를 흔들지 않는다.
- 성공을 사용자 관점에서 한 문장으로: "두 플러그인을 빠르게 연달아 꺼도 둘 다 꺼지고, 목록은 내가 누른 항목만 바뀐다."

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "상태 패널에서 네이티브 플러그인을 동시에 두 개 항목을 토글할떄 나중에 토글 시도한 작업이 실패하여 아래와 같은 에러메시지를 출력하고 있다. 동시 (비동기) 적용을 시도할때 차례대로 임계영역을 설정하던지 하여 순차적용되도록 하라(이것은 지난 핸드오프에 요청했던 것이었음. 구현이 올바로 됐는지 검토하라)." | 2026-10-25 세션 |
| 명시 요구 | "또한 적용이 완료될때 상태 패널의 항목 전체에 플리커 현상이 발생하고 있음 (전체 항목 회색공 전환표시 후 연결상태 업데이트 됨). 플리커없이 자연스럽게 변경되도록 하라." | 같은 세션 |
| 명시 결정 | 이 버그는 기능 묶음(0285)과 분리한 별도 handoff로 Claude가 구현한다 | AskUserQuestion "버그만 분리" |
| 추론 의도 | 외부 편집(Orca 밖에서 바뀐 설정)이 아직 적용되지 않았을 때 읽기 전용으로 보이는 기존 안전 동작은 유지한다 | 요구는 Orca 자신의 토글에 한정; 0279 계약 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 같은 프로젝트에서 겹친 토글은 요청 순서대로 모두 적용한다. 두 번째 요청은 첫 요청이 만든 설정 파일 변경 때문에 거절되지 않는다 | "순차적용되도록 하라" | 사용자 | ACTIVE | 0279 D9 보완 |
| D-002 | Orca가 실행 중 Query에 직접 적용하고 저장한 변경(자기 쓰기)은 그 런타임에 "이미 적용됨"으로 인정한다. 감시자가 그 파일 변경을 다시 "미적용 설정"으로 표시하지 않는다 | 두 번째 실패와 플리커의 공통 원인(§4) | 추론 — 코드 조사 | ACTIVE | — |
| D-003 | 같은 프로젝트 범위의 변경이 진행 중일 때 감시자 방송은 그 변경이 끝난 뒤에 나간다. 중간 상태를 방송하지 않는다 | "플리커없이 자연스럽게" | 사용자 + 추론 | ACTIVE | — |
| D-004 | Orca 밖에서 생긴 설정 변경(외부 편집)이 아직 적용되지 않은 동안의 읽기 전용 표시·토글 거절은 유지한다. 자기 쓰기와 같은 파일에 외부 편집이 섞였으면 외부 몫은 계속 미적용이다 | 0279 계약(`returns pending configuration as read-only…`) | 0279 | ACTIVE(유지) | — |
| D-005 | 이 handoff는 버그수정이며 구현 주체는 Claude다 | 저장소 분담 규칙 + 사용자 선택 | 사용자 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-005.
- 변경된 결정: 없음. 0279 D9(파일별 임계영역)는 유지되며 D-001이 그 위의 판정 경합을 닫는다.
- 기존 ACTIVE 중 유지: 0279 D9, 0283 D-009(우측 패널 프로젝트 토글은 유휴 Query 재로드 경로 유지).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC1, D-002↔AC1·AC4·AC5, D-003↔AC2·AC3, D-004↔AC5·AC6, D-005↔(구현 주체 — AC 없음).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 지난 handoff의 순차 적용이 구현됐는가 | **구현됨 — 큐는 정상**. 실패는 큐 뒤의 사전 판정이다 | 파일 임계영역 `infra/config/file-mutation.ts:12`·`plugin-state.ts:7`; 요청 큐 `native-resource-sharing.ts:36-44`(`sharing.run`), 같은 key를 sync도 사용(`bootstrap.ts:1091`) |
| 오류는 어디서 나는가 | 핸들러 사전 판정 | 빌드 산출 `out/main/index.js:11337` col 19 = `session-resources.ts:259` `throw new Error('이 항목은 프로젝트별 제어를…')` |
| 왜 두 번째만 실패하는가 | 첫 토글의 자기 쓰기가 감시자에서 "미적용 설정"이 됨 | 첫 토글이 `settings.local.json`을 쓴다(`adapter.ts:833-836`) → `watchFile` 250ms(`project-resource-sync.ts:143`) → 새 revision → `decorate`가 `applied≠revision`이면 **모든 항목** `canToggle:false`+`configurationPending`(`:97-108`) → 큐에서 기다리던 두 번째가 `canToggle` 검사에서 거절(`session-resources.ts:254-259`) |
| 플리커의 원인 | 같은 원인 — 감시자 방송이 미적용 상태를 먼저 내보낸 뒤 재조정 후 다시 방송 | `refresh`→`emit`(`:183`)은 큐 밖에서 실행, 재조정 `apply`(`:209-248`)는 그 뒤. 어댑터 재조정은 이미 맞는 상태라 SDK 호출 없이 `applied`(`project-reconciliation.ts:79-99`) |
| 세션이 응답 중이면 | 더 오래 지속됨 | `apply`는 모든 peer 유휴일 때만 진행(`:220`), `SessionRuntime.reconcileNativeResources`도 busy면 `pending`(`session-runtime.ts:928`) → 응답이 끝날 때까지 전체 읽기 전용 |
| 더 작은 해법 | 판정 완화(`canToggle` 검사 제거)는 기각 | D-004 외부 편집 보호가 함께 사라진다 |
| 회색 점의 정확한 경로 | 코드로 닫히지 않음 — 사람 실기로 확인 | `canToggle:false`는 토글을 숨기고 상태 점은 유지한다(`nativeResourcesMenu.ts:37`). 회색(`slate`)은 `configured`·`disabled` 상태(`nativeResourcesMenu.ts:70-75`)에서 나온다. 실기 AT-02가 판정한다 |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: 오류 발생 지점, 큐의 존재와 key 공유, 자기 쓰기 → pending 경로.

## 5. 동작 / 사용자 흐름

```text
플러그인 A 토글 → (A 처리 중) 플러그인 B 토글
  → A: Query 적용 → 파일 저장 → 이 런타임 "적용됨" 인정 → A 결과 방송
  → B: 큐에서 대기 → A 완료 후 판정 통과 → Query 적용 → 저장 → B 결과 방송
  → 감시자: A·B 쓰기 감지 → 변경 진행 중이면 대기 → 끝난 뒤 미적용 표시 없이 방송
  ↘ 외부 편집이 섞인 경우: 외부 몫만 미적용 → 기존 읽기 전용 → 유휴 재조정 후 해제
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| A 토글 | A만 busy, 큐 실행 | A 토글만 진행 표시 |
| A 진행 중 B 토글 | B는 같은 key 큐에서 대기 | A·B 토글 각각 진행 표시, 다른 항목 그대로 |
| A 완료 | 런타임 적용 인정 후 방송 | A만 새 상태. 다른 항목의 점·토글 불변 |
| 감시자가 A 쓰기 감지 | 진행 중 변경 뒤로 방송 | 미적용(읽기 전용) 표시 없음 |
| B 완료 | 같은 순서 | B만 새 상태, 오류 토스트 0 |
| 외부 편집 감지(유휴) | 기존 재조정 | 기존 동작(잠깐 읽기 전용 → 적용) |
| 외부 편집 감지(응답 중) | 기존 대기 | 응답 종료까지 읽기 전용(기존) |

### 파생 UX / 엣지케이스

- error: Query 적용·저장 실패는 기존 복원 경로(`native-resources.ts:173-186`)와 오류 토스트를 유지한다. 실패한 쓰기는 "적용됨"으로 인정하지 않는다.
- concurrency / multi-session: 같은 프로젝트의 peer 세션도 각자 자기 쓰기를 인정한다(`shareNativeResource`가 peer마다 `setNativeResource`). 토글 불가 peer는 미적용으로 남는다.
- keyboard / a11y / theme: 변경 없음.

## 6. 범위 / 비범위

- **범위**: Claude 프로젝트 플러그인 토글(우측 상태 패널)의 자기 쓰기 인정, 감시자 방송 직렬화.
- **비범위**: nav `/plugins` 전역 토글(0283 경로), OpenCode MCP 토글의 자기 쓰기 인정(공통 sync 방송 직렬화는 OpenCode에도 적용되지만 OpenCode 포트 구현은 하지 않음), 오류 문구 변경.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| OpenCode MCP 자기 쓰기 인정 | 아니오 — 선택 포트 | 재현 시 후속 handoff |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 같은 프로젝트에서 A 처리 중 B를 토글하면 두 요청이 순서대로 성공하고 둘 다 반영된다 | 실제 `ProjectResourceSync`+`createNativeResourceSharing`+핸들러 조립, 토글이 감시 파일을 쓰는 fake 런타임: 두 invoke 모두 resolve, 적용 순서 A→B, 최종 enabled 둘 다 반영 | renderer `toggle` → `orca:session:set-native-resource` → `sharing.run` → `shareNativeResource` |
| R-02 | AT-02 / AC2 | 한 토글 동안 방송·응답되는 모든 스냅숏에서 대상 외 항목의 `status`·`enabled`·`canToggle`이 바뀌지 않고 `configurationPending`이 없다 | 같은 조립에서 `sharing.changed`·sync `emit`·응답 값을 전부 기록해 단언 + **사람 실기**(Windows, 실제 Claude 세션에서 두 플러그인 연속 토글 — 회색 점 전환·오류 토스트 0) | 위 + `broadcastNativeResourcesChanged` |
| R-03 | AT-03 / AC3 | 변경이 큐에서 실행 중일 때 감시자가 파일 변경을 감지하면 방송은 그 변경이 끝난 뒤에 나간다 | sync 단위: 큐 작업을 잡아 둔 상태에서 감시 콜백 → `emit` 0회, 해제 후 1회 이상이며 첫 방송이 미적용 아님 | `refresh`·`apply` → `emit` |
| R-04 | AT-04 / AC4 | Claude 런타임은 자기 저장 직후 그 파일 revision을 "적용됨"으로 보고하고 sync는 그 runtime을 미적용으로 보지 않는다 | 실제 어댑터(`adapter.native-plugins` 픽스처, 임시 `settings.local.json`): `setNativeResource` 후 `nativeResourcesApplied(현재 revision)===true`; `SessionRuntime`이 같은 값을 전달 | adapter persist → reconciliation → `SessionRuntime` → sync |
| R-05 | AT-05 / AC5 | 자기 쓰기 전에 같은 파일에 외부 편집이 있었으면 외부 몫은 미적용으로 남고 유휴 재조정이 적용한다 | 재조정 단위: 외부 편집 → 자기 토글 → `covers(revision)===false`, 이후 `reconcile`이 외부 항목을 SDK에 적용 | reconciliation |
| R-06 | AT-06 / AC6 | 외부 편집 미적용 동안 읽기 전용 표시와 토글 거절은 그대로다 | 기존 `session-resources.test.ts:'returns pending configuration as read-only and refuses a stale toggle through the real IPC read'` · `project-reconciliation.test.ts:'shows external selection with actual status immediately, waits for idle, and never saves it back'` green | 기존 |
| R-07 | AT-07 / AC7 | 기존 sync 동작(공유 감시·busy 중 즉시 방송·idle 후 재조정·손상 파일 보존)이 유지된다 | 기존 `project-resource-sync.test.ts` 9건 green — 큐가 비어 있으면 방송이 지연되지 않는다 | 기존 |

### AC 검증 주의사항

- 기존 테스트 재사용: 인용한 케이스 존재를 `rg -n "^it\(" app/src/main/app/project-resource-sync.test.ts` → 9건, `session-resources.test.ts:53`, `project-reconciliation.test.ts:82`로 확인했다.
- 사람 실기 항목: AT-02 시각 판정만. 회색 점의 실제 SDK 중간 상태(재로드 중 MCP 상태 등)는 fake가 모형하지 않는다.
- 순서 기준(AC3): 관측 지점은 sync에 주입한 `run`의 hold promise와 `emit` 기록 순서다.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 명시 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 R-01 | NEW | — |
| R-02 | R | §7 R-02 | NEW | — |
| R-06 | R | §7 R-06 외부 편집 보호 | INHERITED | 0279 계약·기존 테스트 |
| AT-01·02·06 | AT | §7 | NEW / NEW / INHERITED | — |
| SD-01 | SD | §5·§9 변경 중 방송 직렬화 | NEW | — |
| SD-02 | SD | 기존 sync 수명주기(R-07) | INHERITED | `project-resource-sync.test.ts` |
| ST-01·02 | ST | §7 R-03 / R-07 | NEW / INHERITED | — |
| AR-01 | AR | §10 `nativeResourcesApplied` 포트 체인 | NEW | — |
| IT-01 | IT | §7 R-04 | NEW | — |
| MD-01 | MD | §10 reconciliation `acknowledge`/`covers` | NEW | — |
| UT-01 | UT | §7 R-05 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | invoke ×2 → handler `mutate` → `sharing.run` → `shareNativeResource` → `runtime.setNativeResource`(파일 쓰기) → handler 판정(`decorate`) | 신규 `app/handlers/session-resources.sync.test.ts:'applies overlapping project toggles in order without a self-write rejection'` — 두 결과·적용 순서·최종 파일 | required — EP-2 두 자리의 OR 제거(맵만 보기) 시 두 번째 reject | EP-2 (2) · EP-4 (3) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 위 + `sharing.changed` + sync `emit` | 같은 신규 파일 `'never publishes pending or neighbour changes while a toggle completes'` — 기록 스냅숏 전수 + 사람 실기 | not selected — 스냅숏 전수 직접 단언 | EP-3 (4) |
| VP-03 | SD-01 ↔ ST-01 | REQUIRED | watch 콜백 → `refresh` → `emit` → `run(key)` → broadcast | `app/project-resource-sync.test.ts` 신규 `'holds watcher broadcasts behind an in-flight project mutation'` | required — `refresh` 경로 emit을 큐 밖으로 되돌리면 hold 중 emit 1회로 red | EP-3 (4) |
| VP-04 | AR-01 ↔ IT-01 | REQUIRED | adapter persist 콜백 → `acknowledge` → `nativeResourcesApplied` → `SessionRuntime.nativeResourcesApplied` | `adapters/claude/adapter.native-plugins.test.ts` 신규 `'reports its own persisted plugin revision as applied'` · `features/sessions/session-runtime.test.ts` 신규 `'forwards applied native revision only for the live channel'` | required — persist 콜백의 `acknowledge` 호출 제거 시 red | EP-1 (1) · EP-4 (3) |
| VP-05 | MD-01 ↔ UT-01 | REQUIRED | `acknowledge(key, enabled)` → `covers(revision)` → `reconcile` | `adapters/claude/project-reconciliation.test.ts` 신규 `'acknowledges only its own persisted change and leaves external edits pending'` | required — `acknowledge`가 `applied=read()`를 무조건 대입하면 외부 편집 케이스 red | EP-1 (1) |
| VP-06 | R-06 ↔ AT-06 | REGRESSION | 기존 | `session-resources.test.ts:'returns pending configuration as read-only and refuses a stale toggle through the real IPC read'` · `project-reconciliation.test.ts:'shows external selection with actual status immediately, waits for idle, and never saves it back'` | not selected | 0 — 기존 경로 불변 |
| VP-07 | SD-02 ↔ ST-02 | REGRESSION | 기존 sync 수명주기 | `app/project-resource-sync.test.ts` 기존 9건 | not selected | EP-3 (4) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint·typecheck | `app/src/main/**` 수정 | `cd app && npm run lint && npm run typecheck` | 이번 변경 유발분 |
| 관련 vitest(비-DB) | 위 pair 좌표 | `./node_modules/.bin/vitest run src/main/app/project-resource-sync.test.ts src/main/app/handlers src/main/app/native-resource-sharing.test.ts src/main/adapters/claude src/main/features/sessions/session-runtime.test.ts` | 이번 변경 유발분 |
| 문서 인벤토리 | 문서 수정 시 | `node scripts/check-doc-inventory.mjs --check` | 이번 변경 유발분 |
| trailer 파싱 | 커밋 | `git log -1 --format='%(trailers:only=true)'` | 이번 커밋 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 핸들러는 큐 안에서 decorate된 현재 값으로 `canToggle`을 판정한다 | `app/handlers/session-resources.ts:242-259` |
| decorate는 runtime별 `applied` 맵만 보고 미적용이면 전 항목 `canToggle:false` | `app/project-resource-sync.ts:97-108` |
| 감시 방송(`refresh`→`emit`)은 큐 밖, 재조정(`apply`)만 `deps.run(key)` 안 | `:170-196`·`:226-240` |
| sync와 핸들러는 같은 key 큐를 공유한다 | `bootstrap.ts:1072`(key)·`:1091`(`run`), `session-resources.ts:243-262`(`scope`) |
| 어댑터 자기 저장은 reconciliation `applied`를 갱신하지 않는다 | `adapter.ts:827-847` |
| 어댑터 재조정은 busy면 SDK 호출 전에 `pending` | `project-reconciliation.ts:66-68`, `session-runtime.ts:928` |
| revision = 프로젝트 설정 데이터 digest | `project-settings.ts:123` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `applied` 판정 자리 | `rg -n "entry\.applied\.get\(" app/src/main/app/project-resource-sync.ts` | 2 | decorate(`:102`) · apply pending 필터(`:217`) |
| sync 방송 호출 | `rg -n "this\.emit\(" app/src/main/app/project-resource-sync.ts` | 4 | refresh 성공·실패(`:183`·`:188`) · apply 성공·실패(`:242`·`:245`) |
| decorate 소비 | `rg -n "\.decorate\(" app/src/main --glob '!**/*.test.ts'` | 3 | handler read(`:124`)·판정(`:247`)·sync emit(`:286`) |
| Claude 자기 저장 호출 | `rg -n "persistClaudePluginState\(" app/src/main --glob '!**/*.test.ts'` | 2 | 정의 1 + 호출 1(`adapter.ts:835`) |
| 재조정 포트 구현 | `rg -n "reconcileNativeResources" app/src/main --glob '!**/*.test.ts'` | 7 | 선언·Claude·OpenCode·SessionRuntime·sync |

### 수치 / 전칭 표현 검산

- "큐는 정상" 반례 검색: 같은 key 밖에서 판정하는 핸들러 경로 — `sessionSetNativeResource` 하나(`session-resources.ts:234`), `mutate`가 `sharing.run` 사용.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: §7 주의사항.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`
- 현재 책임 소유자: 적용 여부 = `ProjectResourceSync.entries[].applied`(재조정 결과만 기록).
- 현재 오류 경로: 자기 쓰기 → 감시 → 미적용 방송 → 재조정(유휴만) → 정상 방송.

```text
toggle A ─run(key)─▶ setNativeResource ─▶ resources.set ─▶ persist(settings.local.json)
watchFile ─▶ refresh ─▶ configuration=R1 ─▶ emit(큐 밖) ─▶ decorate: applied≠R1 → 전 항목 read-only
toggle B ─run(key)─▶ decorate: applied≠R1 ─▶ throw '프로젝트별 제어를 지원하지 않습니다'
apply(유휴) ─run(key)─▶ reconcile → applied=R1 ─▶ emit → 정상 표시
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`, `MD-01`
- 변경 후 책임 소유자: 적용 여부 = `applied` 맵 **또는** 런타임 자기 보고 `nativeResourcesApplied(revision)`.
- 유지: 큐·파일 임계영역·외부 편집 재조정·유휴 게이트.

```text
toggle A ─run(key)─▶ setNativeResource ─▶ persist ─▶ reconciliation.acknowledge(key, enabled)
watchFile ─▶ refresh ─▶ configuration=R1 ─▶ emit ─run(key) 대기─▶ decorate: runtime.covers(R1) → 정상
toggle B ─run(key)─▶ decorate: covers → 통과 ─▶ 적용 ─▶ acknowledge
apply ─▶ pending 필터: covers면 제외 → SDK 호출 없음
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 적용 여부 = 재조정 결과만 | + 런타임 자기 보고 | D-002 | AR-01 / VP-04 |
| data/control flow | 감시 방송 큐 밖 | 모든 sync 방송이 `run(key)` 뒤 | D-003 | SD-01 / VP-03 |
| state/contract | `LiveTurn`에 적용 질의 없음 | `nativeResourcesApplied?(revision): boolean` | D-002 | AR-01 / VP-04 |
| error/lifecycle | 실패 저장도 재조정 대상 | 실패 저장은 인정하지 않음(기존 복원) | D-002 조건 | MD-01 / VP-05 |
| test seam | 큐 없는 핸들러 테스트 | sync+sharing 조립 테스트 | AC1·AC2 | VP-01·02 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `adapters/claude/project-reconciliation.ts` (adapters) | 자기 저장 인정·revision 포함 판정 | `acknowledge(key, enabled)` / `covers(revision)` | Claude adapter |
| `adapters/claude/adapter.ts` | persist 성공 후 인정, 포트 노출 | `nativeResourcesApplied` | SessionRuntime |
| `features/sessions/session-runtime.ts` | live 채널 위임 | 같은 포트 | sync |
| `app/project-resource-sync.ts` (app) | 적용 판정 OR, 방송 직렬화 | — | bootstrap |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-04·05 (EP-1) | 성공한 자기 저장만 인정 | `ClaudeProjectReconciliation.acknowledge` | Claude adapter | `adapter.ts` persist 콜백 1자리 — `persistClaudePluginState` resolve 뒤 | `rg -n "persistClaudePluginState\(" app/src/main --glob '!**/*.test.ts'` → 호출 1 | 두 번째 토글 거절·플리커 재발 |
| AR-01 / VP-01 (EP-2) | 적용 판정 = `applied` 맵 OR `runtime.nativeResourcesApplied?.(revision)===true` | `project-resource-sync.ts` 단일 헬퍼 | sync | decorate(`:102`) · apply pending 필터(`:217`) — 2자리 | `rg -n "entry\.applied\.get\(" app/src/main/app/project-resource-sync.ts` → 2 | 한쪽만 고치면 표시 정상·재조정 중복 또는 그 반대 |
| SD-01 / VP-02·03·07 (EP-3) | sync 방송은 같은 key 큐 뒤 | `emit` 정의가 `deps.run(key, broadcast)` | sync | `this.emit(` 호출 4자리(`:183`·`:188`·`:242`·`:245`) — 정의 1곳에서 감싼다 | `rg -n "this\.emit\(" app/src/main/app/project-resource-sync.ts` → 4 | 변경 중 중간 상태 방송(플리커) |
| AR-01 / VP-04 (EP-4) | 포트 체인 | `adapters/common/types.ts` `LiveTurn` | adapter·runtime | 선언 1 · `SessionRuntime` 위임 1 · Claude adapter 구현 1 = 3자리 | `rg -n "nativeResourcesApplied" app/src/main --glob '!**/*.test.ts'` → 구현 후 선언·위임·구현 3 + 소비 헬퍼 1 | 위임 누락 시 sync가 항상 미적용 |

- 같은 규칙의 SSOT: 적용 판정은 sync의 private 헬퍼 하나(`appliedTo(entry, runtime, revision)`), 두 자리가 호출한다.
- 선택적 필드: `nativeResourcesApplied` 미구현(`undefined`)은 "모름 = 미적용"이다. OpenCode·mock은 기존 동작.
- **교착 금지**: `emit`은 `run(key)` 안에서 호출하지 않는다. 현재 호출 4자리 모두 `run` 밖(`apply`는 `await this.deps.run(...)` 종료 후 호출)이다. `run` 안에서 `entry.reading`을 await하는 코드도 만들지 않는다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/adapters/claude/project-reconciliation.ts` | 인정·포함 | `acknowledge(key, enabled)`: `applied.plugins[key]`를 저장한 값으로 접은 사본을 만들고, 새로 읽은 설정과 같은 digest면 `applied=read()`, 다르면 접은 사본만 보관(외부 몫 미적용). `covers(revision)`: `applied.revision===revision` | 순수 단위(임시 디렉토리) |
| `app/src/main/adapters/claude/adapter.ts` | 인정 호출·포트 | persist 콜백을 `persistClaudePluginState(...).then(() => projectResources.acknowledge(key, enabled))`로. 반환 객체에 `nativeResourcesApplied: (r) => projectResources.covers(r)` | `adapter.native-plugins.test.ts` |
| `app/src/main/adapters/common/types.ts` | 포트 | `LiveTurn.nativeResourcesApplied?(revision: string): boolean` | typecheck + IT |
| `app/src/main/features/sessions/session-runtime.ts` | 위임 | `nativeResourcesApplied(revision)`: `this.live?.nativeResourcesApplied?.(revision) === true` | `session-runtime.test.ts` |
| `app/src/main/app/project-resource-sync.ts` | 판정·직렬화 | `appliedTo` 헬퍼로 2자리 교체. 기존 `emit` 본문을 `broadcast`로 옮기고 `emit = (entry) => this.deps.run(entry.target.key, () => this.broadcast(entry))` | `project-resource-sync.test.ts`(주입 `run`) |
| `app/src/main/app/handlers/session-resources.sync.test.ts` (신규) | 조립 ST | 실제 `ProjectResourceSync`(주입 watch) + `createNativeResourceSharing` + 핸들러 + 임시 파일을 쓰는 fake 런타임 | — |

### 테스트 가능성

- electron 의존: 핸들러는 기존 테스트처럼 `vi.mock('electron')`. sync·reconciliation은 electron 무관.
- 기존 메커니즘 재사용: 큐(`sharing.run`)는 형상·시점이 맞다 — 핸들러와 sync가 이미 같은 key를 쓴다.
- 순서 관측: 주입 `run`에서 hold promise, `emit`·`changed` 기록 배열.

## 12. End-to-end 영향

```text
SDK reloadPlugins → resources.observePlugins → persist → acknowledge → covers
  → sync decorate/apply → broadcastNativeResourcesChanged → renderer NativeResourceState.accept
```

- producer 기준: 적용 여부는 실제 Query에 적용·저장까지 성공한 런타임만 주장한다.
- consumer 파생 규칙: renderer는 변경 없음 — 받는 스냅숏에서 미적용 표시가 사라질 뿐이다.

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| OpenCode MCP 토글·감시(같은 sync) | 방송이 같은 key 큐 뒤로 — 큐가 비면 즉시 | AC7 |
| 0283 전역 토글(프로세스 종료) | 경로 불변 | 해당 없음 |

## 13. Lifecycle / 오류 / 정리

- 실패: persist reject → `acknowledge` 미호출 → 기존 복원·오류.
- 런타임 교체: 새 runtime은 새 reconciliation(`applied`=생성 시 읽은 값)이라 인정이 넘어가지 않는다.
- **다중 저장소 쓰기**: SDK flag 층(메모리) + `settings.local.json`(파일). 순서와 실패 상태는 기존(`native-resources.ts:150-186` — SDK 적용 → 검증 → 저장, 실패 시 SDK 되돌림). 이번 변경은 저장 성공 뒤 메모리 인정만 더한다 — 인정 실패 상태는 없다(동기 대입). 산출 문서 사본은 `plan.md`·`INDEX.md` 두 곳이다.

## 14. 성능 / 상한 / 최적화

- 새 요청 수: 0. `covers`는 메모리 비교, `acknowledge`는 파일 1회 읽기(저장 직후).
- 방송 지연: 진행 중 변경 하나의 길이(SDK 재로드)만큼. 중복 방송은 기존과 같은 수.

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음 — 내부 포트.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 파일별 임계영역 | 0279 D9 | §4 | 유지 |
| 외부 편집 읽기 전용 | 0279·기존 테스트 | D-004 | 유지 |
| "Owns only observation and idle reconciliation. Never starts or discards a runtime." | `project-resource-sync.ts:47` 주석 | §11 | 유지 — 방송 직렬화는 관찰 책임 안 |
| 우측 패널 토글 = 유휴 Query 재로드 | 0283 D-009 | 범위 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| `emit`을 큐 뒤로 미루며 교착 | §10 교착 금지 규칙 + VP-03 테스트 |
| 접은 사본 digest가 실제 파일 표기(boolean vs 객체)와 달라 늘 미적용 | persist가 쓰는 값(`enabled` boolean) 그대로 접는다. IT VP-04가 실제 파일로 검증 |

- 되돌리기 어려운 결정: 없음. 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/adapters/claude/{project-reconciliation,adapter}.ts` · `adapters/common/types.ts` · `features/sessions/session-runtime.ts` · `app/project-resource-sync.ts` + 테스트
- `docs/arch/backend/adapters.md` 프로젝트 리소스 재조정 서술에 자기 저장 인정 한 줄(해당 절이 있으면)

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI` · `app/src/main/AGENTS.md`(레이어).
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트: §7-A gate 표의 vitest 명령.
- 사람 실기: AT-02(Windows, 실제 Claude 세션).

## READY self-review

- [x] Decision Ledger가 결정을 보존한다 — D-001~005, 0279 D9 유지.
- [x] Part I만으로 완료 상태가 이해된다.
- [x] "순차적용"·"플리커없이"를 재해석하지 않았다 — 큐 유지 + 판정 경합 제거.
- [x] AS-IS/TO-BE 같은 축, Delta → 파일·AC 추적.
- [x] 수치 실측 — §8 전수 표 5행.
- [x] 각 AC가 행동 단언·검증·경로를 가진다.
- [x] Baseline V, NEW node 전부 REQUIRED pair, 영향 INHERITED는 REGRESSION.
- [x] 자리별 좌표와 선택 적대 증거(VP-01·03·04·05) 등록.
- [x] 사람 실기는 시각(AT-02)만.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3에 적었다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: §11 설계 그대로 — `acknowledge`/`covers`, `nativeResourcesApplied` 포트 체인, `appliedTo` 헬퍼, `emit = run(key, broadcast)`.
- 이견 / 현실성 문제: 없음. `acknowledge`의 digest 비교를 위해 `project-settings.ts`의 digest를 모듈 함수 `claudeProjectSettingsRevision`으로 올리고 reader도 같은 함수를 쓴다(구현 세부 — 동치 리팩터).
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-04·05 | EP-1 성공 자기 저장만 인정 | persist 콜백 (1) | 1/1 | `rg -n "persistClaudePluginState\(" app/src/main --glob '!**/*.test.ts'` → 정의 1 + `adapter.ts:835` 1 · `adapter.native-plugins.test.ts:'reports its own persisted plugin revision as applied but not an external edit'` | key `frontend@market`·enabled `false`(초기 true와 구별) → 저장 후 `nativeResourcesApplied(own)===true`, 외부 편집 revision false | — |
| VP-01 | EP-2 적용 판정 OR | decorate · apply 필터 (2) | 2/2 | `rg -n "appliedTo\(" project-resource-sync.ts` → `:102`·`:217` · decorate → `session-resources.sync.test.ts:'applies overlapping project toggles in order without a self-write rejection'` · apply 필터 → `project-resource-sync.test.ts:'holds watcher broadcasts behind an in-flight project mutation'`(`reconcileNativeResources` 미호출 단언) | revision `own` vs 맵의 `initial` 구별 → 두 번째 토글 resolve / reconcile 호출 0 | — |
| VP-02·03·07 | EP-3 방송 직렬화 | `this.emit(` 4자리 | 1/4 좌표 · 4/4 정의 경유 | `rg -n "this\.emit\(" project-resource-sync.ts` → 4 · refresh 성공(`:183`) → `'holds watcher broadcasts behind an in-flight project mutation'` | 큐 hold 중 감시 콜백 → emit 0, 해제 후 ≥1·미적용 없음 | refresh 실패(`:188`)·apply 성공/실패(`:242`·`:245`) — 같은 `emit` 정의를 지나지만(코드 읽기) 자리별 직접 좌표 없음 |
| VP-04 | EP-4 포트 체인 | 선언·위임·구현 (3) | 3/3 | `rg -n "nativeResourcesApplied" app/src/main --glob '!**/*.test.ts'` → `types.ts:42`·`session-runtime.ts:942`·`adapter.ts:991` + 소비 `project-resource-sync.ts:253` · 위임 → `session-runtime.test.ts:'forwards applied native revision only for the live channel'` · 구현 → 위 adapter IT | `own`/`external` 구별, 채널 해제 후 false | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(r1).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `session-resources.sync.test.ts:'applies overlapping project toggles in order without a self-write rejection'` | M1 red 3건 |
| VP-02 | REQUIRED | SELF_PASS | `session-resources.sync.test.ts:'never publishes pending or neighbour changes while a toggle completes'` (+ AT-02 사람 실기 대기) | not selected |
| VP-03 | REQUIRED | SELF_PASS | `project-resource-sync.test.ts:'holds watcher broadcasts behind an in-flight project mutation'` | M2 red 1건 |
| VP-04 | REQUIRED | SELF_PASS | `adapter.native-plugins.test.ts:'reports its own persisted plugin revision as applied but not an external edit'` · `session-runtime.test.ts:'forwards applied native revision only for the live channel'` | M3 red 1건 |
| VP-05 | REQUIRED | SELF_PASS | `project-reconciliation.test.ts:'acknowledges only its own persisted change and leaves external edits pending'` | M4 red 1건 |
| VP-06 | REGRESSION | SELF_PASS | `session-resources.test.ts:'returns pending configuration as read-only and refuses a stale toggle through the real IPC read'` · `project-reconciliation.test.ts:'shows external selection with actual status immediately, waits for idle, and never saves it back'` green | not selected |
| VP-07 | REGRESSION | SELF_PASS | `project-resource-sync.test.ts` 기존 9건 green | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 `project-resource-sync.ts:253` — OR 제거(맵만) | VP-01 선택 증거 | 최초 | `applies overlapping…` · `never publishes…` · `holds watcher…` = 3 | 잠김 |
| M2 `project-resource-sync.ts` `emit` — `run` 없이 `broadcast` 직접 | VP-03 선택 증거 | 최초 | `holds watcher broadcasts…` = 1 | 잠김 |
| M3 `adapter.ts:837` — `acknowledge` 호출 제거 | VP-04 선택 증거 | 최초 | `reports its own persisted plugin revision…` = 1 | 잠김 |
| M4 `project-reconciliation.ts` — `applied = next ?? folded`(무조건 대입) | VP-05 선택 증거 | 최초 | `acknowledges only its own persisted change…` = 1 | 잠김 |

- **분모 검산**: `선택 증거 4 · 인용 변이 0 · 새 oracle 0(구조 proxy·전수 스윕 없음) = 표 행 4`.
- **덮개 회귀**: 해당 없음(r1).
- M1은 원래 버그 재현이다 — 수정 전 판정으로 두 번째 토글이 `프로젝트별 제어` 오류로 reject.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 새 문구 없음 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | persist 콜백이 `projectResources`(뒤에 선언된 `const`)를 호출 시점에 참조 — 콜백은 생성 후에만 실행되어 TDZ 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 신규 실패 경로 없음. persist 실패는 기존 복원(인정 안 함) | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 해당 없음 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 감시 방송이 변경 뒤로 밀려 최종 상태로만 도착 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | OpenCode MCP 토글도 같은 sync를 쓰지만 `nativeResourcesApplied` 미구현 — 자기 쓰기 미적용 표시는 OpenCode에 남을 수 있다 | ⚠️ 보고만(§6 비범위) | `opencode/v1/channel.ts:435` |
| 2 | `bootstrap.native-history.test.ts:'reads native configuration through the registered module using stored backend and cwd'` red | ⚠️ 보고만 — 변경 전 기준선에서도 같은 red(`git stash` 후 재실행 1 failed/18) | 이번 변경 무관 |

### 설계 대비 명시적 차이

- 없음.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `adapters/claude/{project-settings,project-reconciliation,adapter}.ts` · `adapters/common/types.ts` · `features/sessions/session-runtime.ts` · `app/project-resource-sync.ts` + 테스트 5파일(신규 `app/handlers/session-resources.sync.test.ts`) · `docs/arch/backend/adapters.md` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `vitest run src/main/app src/main/adapters/claude src/main/features/sessions` · `node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출** | lint 0 error · 2 warning(renderer 기존 `react-hooks/incompatible-library`) · typecheck exit 0 · vitest 185파일 1899케이스: 1896 pass · 2 skip · 1 fail(#2 기존 기준선) · doc-inventory ok |
| V-pair 자기확인 | SELF_PASS 7 / SELF_BLOCKED 0 |
| 강제 지점 전수 | 좌표로 닫은 자리 7/10 (EP-1 1/1 · EP-2 2/2 · EP-3 1/4 · EP-4 3/3), 남긴 곳 EP-3 3자리 |
| **AC 자기보고** | AC1 ✅ ST 1 · AC2 ⚠️ 기계 단언 ✅, 사람 실기 대기 · AC3 ✅ sync 테스트 · AC4 ✅ IT·위임 · AC5 ✅ UT · AC6 ✅ 기존 2건 green · AC7 ✅ 기존 9건 green |
| **합계 검산** | `✅ 6 · ⚠️ 1 · ❌ 0 = 총 7` |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 0279 D9(파일 임계영역)과 같은 기능 영역, 다른 축(판정 경합).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 0279 테스트는 sync 없이 핸들러 큐만 조립해 자기 쓰기 → 감시 경로를 실행하지 않았다(`session-resources.test.ts:797`).
- 반복해서 부딪히는 환경 한계: 없음.
- 현재 라운드·impl 턴: `r1`.

---

## [구현자 기입] 재구현 (r1.2) — 사용자 실기 지적

- **지적**: `npm run dev` 실기에서 연속 토글의 두 번째 거절과 토글 스위치 전체 사라짐이 그대로 재현.
- **불변식**: 런타임이 보증한 revision은 sync가 보는 **모든** revision(감시자가 아직 따라잡지 못한 직전 값 포함)에서 적용됨으로 남아야 한다.
- **원인(실측)**: 실제 adapter + 실제 `watchFile` 조립 재현에서 첫 토글 직후 sync entry = `configuration R0 · applied 맵 없음`. 토글 전에는 `covers(R0)`가 참이라 초기 재조정이 생략돼 맵에 R0가 남지 않았고, 저장 뒤 런타임은 R1만 보증 → 감시 폴링(250ms)이 R1을 읽기 전 판정이 R0를 미적용으로 봄.
- **r1 좌표가 놓친 이유**: ST fake가 저장 안에서 감시 콜백을 **동기**로 불러 production의 폴링 지연 분기를 실행하지 않았다(§공통 V — 주입 의존성이 production 분기를 건너뜀).

| 필드 | 내용 |
|---|---|
| 설계 리뷰 | 설계 유지 — `appliedTo`가 런타임 보증을 관측하는 즉시 맵에 기록(`project-resource-sync.ts` `appliedTo`). §10 EP-2 두 자리 그대로 |
| 강제 지점 전수 | EP-2 2/2 — decorate·apply 필터 모두 같은 헬퍼. 좌표 추가: `app/handlers/session-resources.claude-assembly.test.ts:'keeps every toggle while overlapping plugin toggles save through the real watcher'`(실제 `ClaudeAdapter`·실제 `watchFile`·실제 handler·sharing) |
| 이번 라운드 수정의 잠금 | M5 `appliedTo`의 `entry.applied.set` 제거 → 신규 assembly 테스트 red 1 · 기존 M1~M4는 r1 결과 유지(코드 경로 불변). 분모 `선택 증거 0 · 인용 변이 1(사용자 지적 재현) · 새 oracle 0 = 행 1` |
| Product/UX 파생 검토 | 새 문구 없음. 토글 사라짐·두 번째 거절이 같은 원인 — 사용자 관측 두 증상 모두 이 경로 |
| 놓친 잠재 문제 | r1 #1·#2 유지. 신규 없음 |
| 설계 대비 명시적 차이 | 없음 |
| 관측한 게이트 산출 | lint 0 error · 2 warning(기존) · typecheck 0 · vitest 186파일 1900케이스: 1897 pass · 2 skip · 1 fail(r1 #2 기존 기준선) |
| AC 자기보고 | AC1 ✅ assembly 테스트 · AC2 ⚠️ 사람 재실기 대기 · AC3~AC7 ✅ r1 좌표 green |
| 합계 검산 | `✅ 6 · ⚠️ 1 · ❌ 0 = 총 7` |
| 대상 커밋 | `(r1.2 구현 — 좌표는 INDEX)` |
| Review Signals | 같은 라운드 impl 턴 2(`r1.2`). r1 ST가 감시자를 동기 fake로 대체해 실제 타이밍을 실행하지 않았다 |

## [구현자 기입] 재구현 (r2) — verify r1 FAIL D1

- **지적**: [verify r1](verify.md) D1 — `emit` 정의의 `deps.run` 감싸기를 지워도(M2) 48케이스 green. 0288 r1.2 `0466f5c`가 watcher 성공 경로를 inline으로 옮겨 r1 좌표가 `emit`을 지나지 않게 됐다.
- **불변식**: 큐 밖에서 시작된 모든 방송은 `emit` 정의 한 곳을 지나 같은 key 큐 뒤에 선다 — 그 정의의 감싸기는 `emit`을 부르는 어느 경로로든 관측돼야 한다.

| 필드 | 내용 |
|---|---|
| 설계 리뷰 | 설계 유지 — production 코드 변경 없음. EP-3 계약 자리(정의 `project-resource-sync.ts:273`)를 잠그는 좌표만 추가 |
| 강제 지점 전수 | EP-3 `rg -n "this\.emit\(" project-resource-sync.ts` → 4(`:97` connectionsChanged · `:199` watcher 실패 · `:253`·`:256` apply). 네 호출 모두 정의 1곳을 지나므로 정의 자리 1/1을 새 좌표 `project-resource-sync.test.ts:'holds connection-change broadcasts behind an in-flight project mutation'`로 닫았다. watcher 성공 경로(`:186-193` inline)는 0288 CI3 좌표 `'holds watcher broadcasts behind an in-flight project mutation'`. 남긴 곳: 없음 |
| 이번 라운드 수정의 잠금 | 아래 표 |
| Product/UX 파생 검토 | 해당 없음 — 사용자 관측 동작 불변. 새 문구·상태 없음 |
| 놓친 잠재 문제 | `:199`·`:253`·`:256`에서 `emit` 대신 `broadcast`를 직접 부르도록 바꾸는 형제 회귀는 새 좌표가 보지 않는다(`:97`의 같은 맞바꿈 Y1만 red). 정의 자리 밖이라 보고만 — 필요하면 다음 설계가 호출 자리를 §10에 고정한다 |
| 설계 대비 명시적 차이 | 없음 |
| 관측한 게이트 산출 | typecheck node/web/test exit 0 · lint 0 error/2 warning(기존), 트리 변경은 이번 테스트 파일뿐 · plan 게이트 집합 95파일 1,166케이스: 1,153 pass/3 skip/10 fail — 10건 전부 Linux `win32` 게이트(`claude/native-resources.ts:39`) 기준선, win32 강제 미커밋 사본 4파일 22/22 green 후 삭제 |
| AC 자기보고 | AC1·AC3~AC7 ✅(AC3은 새 좌표로 다시 잠김) · AC2 ⚠️ 사람 재실기 대기 |
| 합계 검산 | `✅ 6 · ⚠️ 1 · ❌ 0 = 총 7` — 분모 변경 없음 |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |
| Review Signals | 라운드 2 첫 impl 턴(`r2`). 같은 EP-3 축이지만 원인은 후행 handoff의 장치 교체. 반복 환경 한계: Claude 플러그인 테스트가 Linux에서 `win32` 게이트로 red |

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M2 `:273` `emit`의 `deps.run` 제거 | D1 인용 변이 | r1 verify 못 잡음 0/48 | holds connection-change broadcasts … / 1 | 잠김 |
| Y1 `:97` `emit` → `broadcast` 직접 호출 | 새 oracle 형제 감도 | 신규 | 같음 / 1 | 잠김 |
| M1 `:266` 런타임 보증 OR 제거 | 덮개 회귀 확인 | r1 verify 잡음 | holds watcher broadcasts … / 1 | 유지 |
| CI3 `:186` watcher 읽기를 큐 밖 실행 | 0288 장치 재확인 | 0288 verify 잡음 | holds watcher broadcasts … / 1 | 유지 |

- 분모 검산: `선택 증거 0 · 인용 변이 1(M2) · 새 oracle 1(Y1) · 덮개 회귀 확인 2 = 행 4`. 원복 후 같은 파일 11/11 green.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | `emit` 정의(`project-resource-sync.ts:273`)의 큐 감싸기 제거(M2)를 잡는 테스트가 없다 — 0288 r1.2 `0466f5c`가 watcher 성공 경로를 inline으로 옮기며 r1 좌표가 `emit`을 지나지 않게 됨 | VP-03 EP-3 · r1 등록 변이 M2 | `connectionsChanged`(`:97`) 또는 apply 뒤 방송(`:253`)을 in-flight mutation hold 중 broadcast 0으로 단언 → M2 red | BLOCKING | 대응 — r2 새 좌표가 M2 red(검증 대기) |
| D2 | AC2 Windows 실제 세션 연속 토글 재실기 | VP-02 | 사람 실기 | 사람 실기 | open |
