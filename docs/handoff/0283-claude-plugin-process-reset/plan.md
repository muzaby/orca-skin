# Plan — 0283-claude-plugin-process-reset

## 메타

| 항목 | 값 |
|---|---|
| slug | `0283-claude-plugin-process-reset` |
| 작성자 | Claude Code |
| 일자 | 2026-10-24 |
| 매핑 | — |
| 상태 | READY |
| V mode | `Delta V` |
| 기준 V | `0282-plugin-catalog-native-sync` 유효 V(`V1 + ΔV1 + ΔV2 + ΔV3 + ΔV5 + ΔV6`)`@28d25d35` |
| 이번 V revision | `ΔV1` — 0282 D-008(실행 중 Query 유지)을 "실행 중 Claude 프로세스 종료"로 대체 |
| 유효 V | `0282@28d25d35 + 0283 ΔV1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: nav `/plugins`에서 Claude 네이티브 플러그인을 켜고 꺼도 이미 떠 있는 Claude 프로세스에는 적용되지 않는다. 새 세션(새 프로세스)에서만 적용된다.
- 완료 후 달라지는 것: 토글하는 순간 실행 중인 Claude 프로세스를 모두 닫는다. 모든 Claude 세션은 다음 메시지부터 새 프로세스에서 새 선택으로 실행된다. 동작 중인 세션이 있으면 먼저 확인을 받는다.
- 성공을 사용자 관점에서 한 문장으로: "플러그인을 끄면 어느 Claude 세션에서든 다음 메시지부터 그 플러그인이 없다."

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Context 확인했다. 클로드 네이티브 플러그인 변경시 모든 세션(프로세스)를 종료해야 겠다. 네이티브 플러그인 on/off 시 실행중인 세션에 대해서는 적용이 안되며, 새 세션(프로세스 재시작)에서만 적용되고있다." | 2026-10-24 세션 |
| 명시 요구 | "클로드 네이티브 플러그인 On/off 시 실행중인 프로세스를 모두 종료하여야 한다. 어시스턴트 턴이 동작중인 세션이 있는 경우 한 번 더 확인하는 안내 모달을 보여줘야 한다(기구현된 것이 있음). 없는 경우 세션(프로세스)를 모두 닫도록" | 같은 세션 |
| 사용자 답변 Q1 | "기구현된 모달" = r1의 OpenCode 재시작 확인 모달 패턴 재사용 — 공용 확인 대화상자, 세션 수 N 안내, [변경]/[취소], 취소하면 토글 미변경 | AskUserQuestion |
| 사용자 답변 Q2 | "동작 중" 기준에 백그라운드 작업(턴이 끝난 뒤에도 도는 서브에이전트·백그라운드 명령)을 포함 | AskUserQuestion |
| 추론 의도 | 대기·전달 대기·미소비 제출 메시지, 예약 깨움·세션 예약 반복도 프로세스와 함께 사라지므로 "동작 중"이다 | Q2의 이유("함께 죽는 작업을 모르는 채 잃지 않는다") |
| 추론 의도 | 닫힌 세션의 대화는 남고 다음 메시지가 새 프로세스로 이어간다 | "세션(프로세스)를 닫도록" — 대화 삭제 요구 없음 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | nav의 Claude 플러그인 전역 on/off는 앱 전체(모든 경로·프로젝트)의 실행 중 Claude 프로세스를 모두 닫는다. 세션·대화 이력은 남고 다음 메시지는 새 프로세스에서 새 선택으로 같은 대화를 이어간다 | "On/off 시 실행중인 프로세스를 모두 종료하여야 한다" | 사용자 | ACTIVE | 0282 D-008 대체 |
| D-002 | 동작 중인 Claude 세션이 하나라도 있으면 먼저 확인 대화상자를 띄우고 승인 후 실행한다. 없으면 확인 없이 바로 닫는다 | "동작중인 세션이 있는 경우 한 번 더 확인 … 없는 경우 … 모두 닫도록" | 사용자 | ACTIVE | — |
| D-003 | 확인 대화상자는 0282 r1 OpenCode 재시작 확인 패턴을 쓴다: 공용 확인 대화상자, 동작 중 세션 수 N, [변경]/[취소]. [취소]면 선택·프로세스 모두 그대로다 | "그 패턴 재사용" | Q1 | ACTIVE | 0282 D-015 형상 재사용(대상만 Claude) |
| D-004 | "동작 중"에는 응답 중인 턴과 백그라운드 작업(서브에이전트·백그라운드 명령)을 포함한다 | "백그라운드 작업 포함" | Q2 | ACTIVE | — |
| D-005 | "동작 중" 판정은 기존 세션 activity 기준(`nativeHistoryBusy`)에 lease 존재와 응답 중 표시를 더한 것이다. 대기·전달 대기·미소비 제출 메시지·예약 깨움·세션 예약 반복을 포함한다 | 프로세스와 함께 사라지는 작업이다 | 추론 — D-004 파생 | ACTIVE | — |
| D-006 | 닫을 때 진행 중 턴은 중단되고, 대기·미소비 제출 메시지는 Composer 초안으로 돌아온다 — 기존 "세션 전체 중단"(0151)과 같은 의미다 | 승인한 중단에 새 의미를 만들지 않는다 | 추론 — D-001·D-002 파생 | ACTIVE | — |
| D-007 | `orca:extensions:setEnabled`는 Claude 플러그인 요청에 한해 `confirmed?: true`를 받고 `{status:'applied', resources}` 또는 `{status:'confirm', reason:'claude-processes', sessions}`를 돌려준다. 확인 판정과 종료는 main이 한 동기 구간에서 한다 | renderer가 먼저 세고 따로 호출하면 그 사이 시작된 턴이 확인 없이 끊긴다 | 추론 — D-002·D-003 파생 | ACTIVE | 0282 D-032 대체(Claude 플러그인 한정) |
| D-008 | OpenCode MCP 전역 토글은 현행 유지 — 확인 없음, 프로세스 종료 없음, 새 directory부터 SDK 적용 | 요구 대상이 Claude 플러그인 | 0282 D-034 | ACTIVE(유지) | — |
| D-009 | 우측 패널의 Claude 프로젝트 플러그인 토글은 현행 유지(유휴일 때 실행 중 Query 재로드) | 요구 대상이 nav 전역 토글 | 0282 D-036 | ACTIVE(유지) | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-009.
- 변경된 결정: 0282 D-008 → D-001(사용자 변경). 0282 D-032 → D-007(Claude 플러그인 한정).
- 기존 ACTIVE 중 유지: 0282 D-006·D-011·D-033·D-034·D-036.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC1·AC6, D-002↔AC1·AC2, D-003↔AC2·AC3, D-004·D-005↔AC5, D-006↔AC4, D-007↔AC2·AC4, D-008↔AC7, D-009↔(AC 없음 — 경로를 건드리지 않음을 §16에서 확인), 0282 D-033↔AC8.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | 전역 선택은 Query 생성 때만 읽는다(`adapter.ts:444`). 살아 있는 Query는 자기 flag를 유지한다(0282 D-008) |
| 이미 기존 코드가 충족하는가 | 아니오 | setEnabled는 저장만 하고 런타임에 손대지 않는다(`extension-catalog.ts:45`) |
| 더 작은 해법이 있는가 | 검토 후 기각 | 실행 중 Query에 `applyFlagSettings`+`reloadPlugins`로 바로 적용하는 경로가 있으나 Windows 전용이고 유휴일 때만 된다(`native-resources.ts:39-40·152`). 동작 중 세션은 어차피 남는다. 사용자가 종료를 명시했다 |
| 선행 자료의 주장을 코드와 대조했는가 | 대조함 | "기구현 모달"은 현재 코드에 없다 — 0282 r1 OpenCode 재시작 확인 모달은 ΔV5에서 삭제됐다(`c1481dad:useNativeMcpCatalog.ts:95-104`). 공용 `openConfirmDialog`는 남아 있다(`confirmDialogStore.ts:29`) |
| ACTIVE 결정과 충돌하는가 | 0282 D-008·D-032와 충돌 → 사용자 변경으로 대체 | §3 |

- 사용자에게 올릴 결정: 없음(Q1·Q2로 닫음).
- 코드 조사로 닫은 사실: 종료·중단 프리미티브, 동작 중 판정, 런타임 열거, 패널 갱신 신호(§8).

## 5. 동작 / 사용자 흐름

```text
/plugins에서 Claude 플러그인 토글
  → main: Claude 런타임 열거 + 동작 중 판정 (한 동기 구간)
  → 동작 중 0개: 선택 저장 → 모든 Claude 프로세스 종료 → 행 갱신
  → 동작 중 N개: 확인 대화상자 "…N개…" [변경]/[취소]
       [취소] → 아무것도 바뀌지 않음
       [변경] → 재요청(confirmed) → 선택 저장 → 진행 턴 중단 + 모든 Claude 프로세스 종료 → 행 갱신
  ↘ 선택 저장 실패 → 프로세스 유지, 기존 오류 토스트
닫힌 세션에서 다음 메시지 → 새 프로세스가 같은 대화를 이어감(새 선택 적용)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 유휴 Claude 세션만 있음 → 토글 | 저장 → 유휴 Claude 프로세스 전부 종료 | 대화상자 없음. 행이 바뀐다. 세션 화면은 그대로 |
| 응답 중 세션이 있음 → 토글 | 판정만 하고 저장·종료 없음 | 확인 대화상자(N) |
| 대화상자 [취소] | 없음 | 행·세션 그대로 |
| 대화상자 [변경] | 저장 → 진행 턴 중단 → 전부 종료 | 응답이 "중단"으로 끝나고, 보내지 못한 메시지는 Composer 초안으로 돌아온다 |
| 닫힌 세션에서 다음 메시지 | 새 Query(resume) | 같은 대화가 이어지고 끈 플러그인은 없다 |
| 저장 실패 | 종료 없음 | 기존 저장 실패 토스트, 행은 이전 값 |
| OpenCode MCP 토글 | 현행 | 대화상자 없음, 어떤 세션도 닫히지 않음 |

### 파생 UX / 엣지케이스

- loading/empty/error: 저장 실패는 기존 `skills.native.toggle-failed` 토스트를 그대로 쓴다.
- cancel/retry: 대화상자 [취소]는 IPC를 다시 부르지 않는다.
- concurrency: 대화상자가 열린 동안 다른 세션이 시작되거나 끝나도 [변경] 시점에 다시 열거해 그때의 Claude 프로세스를 모두 닫는다. N은 대화상자를 연 시점의 값이다.
- multi-window: 다른 창의 세션도 대상이다. 초안 복원 이벤트는 모든 창에 방송한다.
- 새 채팅의 첫 턴(세션 ID 확정 전): lease 단위로 중단·종료한다. 동작 중으로 센다.
- theme/a11y: 공용 `ConfirmDialogHost`를 그대로 쓰므로 새 시각 요소가 없다.

## 6. 범위 / 비범위

- **범위**: nav Claude 플러그인 전역 토글의 프로세스 종료·확인. 확인 결과 IPC 계약. 판정 함수 공유. 문서 정정.
- **비범위**: OpenCode MCP·OpenCode 플러그인 토글(D-008, 0282 D-030), 우측 패널 프로젝트 토글(D-009), 자동 제목 생성 등 세션 밖 단발 Query.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 닫힌 세션을 즉시 다시 띄우기 | 아니오 | 하지 않음 — 다음 메시지에서 lazy spawn |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / **AC1** | 동작 중 Claude 세션이 없을 때 Claude 플러그인 토글은 확인 없이 선택을 저장하고, 그 순간의 Claude 유휴 런타임(서로 다른 경로·프로젝트 포함)을 모두 닫는다. OpenCode 런타임은 닫지 않는다. 결과는 `{status:'applied'}` | production `Bootstrap.register` + 실제 supervisor·activity에 Claude 유휴 2개(경로 다름)·OpenCode 유휴 1개 → handler → close 횟수·결과·저장값 | renderer toggle → preload → `extensionSetEnabled` → 계획 → 저장 → 종료 |
| R-02 | AT-02 / **AC2** | 동작 중 Claude 세션이 1개 이상이면 저장·종료 없이 `{status:'confirm', reason:'claude-processes', sessions:N}`를 돌려주고 renderer는 공용 확인 대화상자(제목·N이 든 본문·[변경]·[취소])를 띄운다. N은 동작 중인 Claude 세션 수다(유휴·OpenCode 제외) | bootstrap: 대상 3개 중 동작 중 2개 → `sessions: 2`, close 0, 저장값 불변 · renderer: confirm store의 제목·본문(count)·라벨 | 같은 경로 + `openConfirmDialog` |
| R-02 | AT-02 / **AC3** | [취소]면 IPC 재호출이 없고 행·선택·프로세스가 그대로다 | renderer: 닫기 후 호출 1회·행 불변 | `ConfirmDialogHost` 닫기 |
| R-02 | AT-02 / **AC4** | [변경]이면 `confirmed: true`로 다시 호출하고, main은 그 시점의 Claude 세션 전부를 닫은 뒤 `applied`를 돌려준다. 진행 턴은 중단되고, 미소비 제출 메시지는 `message.cancelled`로 방송된다 | renderer: 두 번째 호출 `confirmed:true`·행 갱신 · bootstrap: confirmed 호출 → 진행 child abort·close 1회씩·`message.cancelled` ids | 같은 경로 + 세션 전체 중단 경로 |
| R-02 | AT-02 / **AC5** | 다음 중 하나라도 해당하면 동작 중이다: Claude lease(준비·응답·연속 턴·수신 대기), `runtime.responding`, activity의 `foreground≠idle`·`transport=listening`·queued·deliveryPending·residual·backgroundTask·pendingSessionWakeup·sessionSchedules. 모두 아니면 유휴다 | 순수 계획 함수: 신호마다 단독 입력 → 동작 중 1 · 전부 없음 → 0 | 계획 함수 ← supervisor·activity |
| R-01 | AT-01 / **AC6** | 닫힌 Claude 세션의 다음 메시지는 새 런타임을 만들어 같은 대화를 resume하고 새 선택의 `@inline` flag를 싣는다 | supervisor: discard 뒤 `acquireRuntime`가 factory 호출 · adapter: cold resume의 resume·flag | `chat:send` → `acquireRuntime` → `ClaudeAdapter.sendMessage` |
| R-03 | AT-03 / **AC7** | OpenCode MCP 전역 토글은 OpenCode 세션이 동작 중이어도 확인 없이 `applied`이고 어떤 런타임도 닫지 않는다(회귀) | bootstrap: OpenCode 동작 중 lease + 유휴 Claude → OpenCode MCP 토글 → close 0 | handler OpenCode 분기 |
| R-01 | AT-01 / **AC8** | 선택 저장이 실패하면 어떤 프로세스도 닫지 않고 오류를 그대로 던진다(renderer는 기존 저장 실패 토스트) | bootstrap: 저장 port가 throw → handler reject · close 0 | 저장 → 종료 순서 |
| R-01·R-02 | AT-04 / **AC9** | 사람 실기(Windows): 응답 중 세션 1·유휴 세션 1에서 superpowers off → 대화상자 → [변경] → 두 세션 모두 다음 메시지 뒤 `/context`에 superpowers 없음. [취소]면 그대로. 유휴만 있으면 대화상자 없이 같은 결과. white/dark에서 대화상자 확인 | 실제 앱 | 실제 CLI·창 |

- AC 총수: **9**.

### AC 검증 주의사항

- 기존 테스트 재사용 확인: `post-turn.schedules.test.ts:'%s closes the active response exactly once'`의 `discard` 케이스가 `chatDiscardSession` handler를 지난다(`:563-590`). `supervisor.test.ts:'active lease discard는 child를 abort하고 runtime을 닫은 채 신규 acquire를 차단한다'`가 있다(`:227`). `preload/index.test.ts:'carries explicit global extension scope and choices across renderer API and preload'`가 setEnabled 왕복을 본다(`:45-63`).
- 사람 실기: 실제 CLI의 `/context`와 창 시각만이다. 판정·열거·순서는 AC1~AC8이 기계로 잠근다.
- N 기준: 대상 수와 동작 중 수가 다르게 나오도록 bootstrap 입력을 대상 3·동작 중 2로 둔다.

## 7-A. V / Trace Matrix

- V mode 판정: Delta V — 0282 V의 Claude 전역 선택 경로를 일부 바꾼다.
- 기준 V 상속 근거: `0282-plugin-catalog-native-sync` 유효 V`@28d25d35`(`git cat-file -t` = commit).
- `SUPERSEDED` 이관: 0282 SD-02/VP-10의 "실행 중 Query 유지" 제품 주장 → 0283 VP-03. 0282 VP-10의 adapter 좌표(`applies current global plugin choices to every new query while live queries keep theirs`)와 C1·C41 변이는 어댑터가 살아 있는 Query를 제자리에서 바꾸지 않는다는 회귀로 VP-R2에 남긴다.
- 변경이 시작되는 수준: R.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 / AT-01 | R / AT | 토글 = 모든 Claude 프로세스 종료·다음 턴 새 선택(AC1·AC6·AC8) | CHANGED | 0282 R-03(0282 AC8의 "살아 있는 Query는 바뀌지 않는다" 대체) |
| R-02 / AT-02 | R / AT | 동작 중 확인(AC2~AC5) | NEW | — |
| R-03 / AT-03 | R / AT | OpenCode MCP 토글 현행(AC7) | INHERITED | 0282 R-09 |
| AT-04 | AT | 사람 실기(AC9) | NEW | — |
| SD-01 / ST-01 | SD / ST | 토글 → 중단·종료 → 초안 복원 → 다음 턴 새 런타임 | CHANGED | 0282 SD-02 |
| AR-01 / IT-01 | AR / IT | handler ↔ Claude 프로세스 port ↔ supervisor·activity·대기열·DB(bootstrap 조립) | NEW | — |
| AR-02 / IT-02 | AR / IT | renderer hook ↔ 확인 결과 ↔ 공용 확인 대화상자 | NEW | — |
| MD-01 / UT-01 | MD / UT | 계획 함수(대상 선택·동작 중 판정) + 공유 판정 함수 | NEW | `native-history.ts:8` 판정 이동 |
| MD-02 / UT-02 | MD / UT | supervisor lease 단위 폐기 | NEW | `supervisor.ts:291` 분해 |
| MD-03 / UT-03 | MD / UT | 세션 전체 중단 본문 추출(공유 함수) | NEW | `chat-turn/index.ts:174-192` 이동 |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle 좌표 | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | toggle → preload → handler → 계획 → 저장 → 종료 → 다음 Query | toggle→IPC: 신규 `useNativeMcpCatalog.test.ts:'applies a Claude plugin change without a dialog when no Claude session is busy'` · IPC: `preload/index.test.ts:'carries explicit global extension scope and choices across renderer API and preload'`(갱신 — `confirmed`·`status` 왕복) · handler→종료: 신규 `bootstrap.native-history.test.ts:'closes every idle Claude process on a Claude plugin toggle without confirmation and leaves OpenCode running'` · 종료→다음 Query: VP-03 좌표 | required — M1 handler의 종료 호출 제거 · M2 계획의 backend 필터를 opencode로 맞바꿈 | EP-01 P1~P8·P13·P14 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | toggle → handler(동작 중) → confirm → 대화상자 → 취소/변경 → 재호출 → 종료 | handler: 신규 `bootstrap.native-history.test.ts:'asks before closing busy Claude sessions and closes every Claude process only after confirmation'` · renderer: 신규 `useNativeMcpCatalog.test.ts:'confirms before closing busy Claude sessions and applies only after the change is confirmed'` · IPC: VP-01 preload 좌표 | required — M3 `!request.confirmed` 조건 제거 · M4 `busy > 0` → `busy >= 0` · M5 renderer 재호출의 `confirmed` 생략 · M6 `sessions`를 대상 수로 | EP-01 P1~P8·P16 |
| VP-03 | SD-01 ↔ ST-01 | REQUIRED | 확인된 종료 → 진행 턴 중단 → 미소비 제출 초안 복원 → 런타임 종료 → 다음 `acquireRuntime` → 새 Query resume | 신규 `chat-turn/discard.test.ts:'returns residual submissions, aborts the turn and discards the runtime'` · VP-02 bootstrap 좌표(`message.cancelled` 방송) · 신규 `supervisor.test.ts:'creates a new runtime after an idle runtime is discarded'` · 기존 `adapter.native-plugins.test.ts:'persists both plugin states across follow-up turns, new adapters and cold resumes over provider defaults'`(win32) · 기존 `adapter.fork.test.ts:'forkFrom 부재 시 기존 resume 경로 무회귀(forkSession 미주입)'` | required — M7 공유 함수에서 `discardSubmitted` 방송 제거 | EP-01 P9·P10·P14 |
| VP-04 | AR-01 ↔ IT-01 | REQUIRED | `Bootstrap.register` → port 조립(supervisor·activity·DB·대기열·방송) → handler | VP-01·VP-02 bootstrap 좌표 · 신규 `bootstrap.native-history.test.ts:'keeps every Claude process when the Claude plugin choice cannot be saved'` | required — M8 bootstrap의 activity 주입을 항상 유휴 snapshot으로 · M9 저장보다 종료를 먼저 | EP-01 P6~P8·P14 |
| VP-05 | AR-02 ↔ IT-02 | REQUIRED | hook toggle → 결과 판별 → `openConfirmDialog` → onConfirm 재호출 / 닫기 | VP-01·VP-02 renderer 좌표 · 신규 `useNativeMcpCatalog.test.ts:'never opens the Claude dialog for OpenCode MCP toggles'` | not selected — 호출 인자·store 상태 직접 관측 | EP-01 P3~P5·P16 |
| VP-06 | MD-01 ↔ UT-01 | REQUIRED | supervisor 열거·activity → 계획 → 대상·동작 중 수 | 신규 `claude-processes.test.ts:'counts each busy signal once and ignores idle Claude, OpenCode and closing entries'`(신호 10개 단독 표 — foreground는 preparing·streaming 두 값 · dedupe · backend 미기재 lease) · 신규 `'dispatches session targets to session discard and session-less leases to lease discard and continues after a failure'` · 기존 `native-history.test.ts`(이동한 판정 회귀) | required — M10 판정 신호 8개를 하나씩 제거 · M11 lease 존재 신호 제거 · M12 `responding` 신호 제거 | EP-01 P14·P15 |
| VP-07 | MD-02 ↔ UT-02 | REQUIRED | `discardLease(leaseId)` → closing → child abort → runtime close → 알림 | 신규 `supervisor.test.ts:'discards a session-less lease by aborting its child and closing its runtime'` · 기존 `'active lease discard는 child를 abort하고 runtime을 닫은 채 신규 acquire를 차단한다'` | not selected — abort·close 직접 관측 | EP-01 P9 |
| VP-08 | MD-03 ↔ UT-03 | REQUIRED | `discardSessionWork(sessionId, emit)` → residual 비움 → turn abort → `discardRuntime` → `discardSubmitted` → emit | VP-03 discard 좌표 · 기존 `post-turn.schedules.test.ts:'%s closes the active response exactly once'`(`discard` 케이스, handler 경유) | not selected — 직접 관측 | EP-01 P10 |
| VP-R1 | R-03 ↔ AT-03 | REGRESSION | OpenCode MCP 토글 → handler → control → 다음 directory | 신규 `bootstrap.native-history.test.ts:'applies OpenCode MCP toggles without confirmation or closing any runtime'` · 0282 `restores global choices through production Bootstrap into catalogs, new Claude queries and OpenCode directories` | required — M13 handler의 Claude 플러그인 조건을 `true`로 | EP-01 P7 |
| VP-R2 | 0282 R-03 ↔ AT-03 | REGRESSION | 초안·새 Query의 Claude flag(0282 VP-09·VP-10 adapter 부분) | 0282 `applies nav plugin choices to draft and stored-session commands and resources` · `carries catalog changes through the real bootstrap registry into every new SDK query` · `applies current global plugin choices to every new query while live queries keep theirs`(win32) | not selected — 0282 변이 C30~C43 승계 | 0282 EP-02 |
| VP-R3 | 0282 AR-08 ↔ IT-08 | REGRESSION | 저장 → 재시작 복원(0282 VP-37) | 0282 `restores global choices through production Bootstrap…`(handler 결과 형상만 바뀜) | not selected | 0282 EP-11 |
| VP-R4 | 0282 R-06 ↔ AT-07 | REGRESSION | OpenCode 플러그인 고정 행·제어 없음(0282 VP-18″) | `ExtensionsCatalogView.interaction.test.ts:'shows OpenCode plugin rows as fixed native state and sends no toggle'` · `gate:` EP-10′ 음성 검색 0건 | required — EP-10′ 술어에 `nativeFileMutations` import 재삽입(0282 G01 승계) | EP-10′ |
| VP-R5 | 0151 세션 전체 중단 ↔ ST | REGRESSION | Composer [세션 전체 중단] → `chatDiscardSession` → 공유 함수 | VP-08 좌표 · `pending-message-queue.test.ts` `discardSubmitted (OQ1 — 세션 전체 중단)` describe | not selected | EP-01 P10 |

- 적대 증거 선택 이유: VP-01·VP-02·VP-04는 "종료가 일어난다/확인이 먼저다/순서" 같은 배선·순서 주장이라 제거·뒤집기에 반응해야 한다. VP-06은 판정 신호 하나가 빠지면 그 작업이 확인 없이 죽는 전수 주장이다.

### 현재 변경의 운영 gate

| Gate | 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app 정적 | `app/**` 변경 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 만든 error |
| 관련 vitest | 변경 스위트 | `./node_modules/.bin/vitest run` — §19 목록 | 신규·변경 테스트 실패, DB·win32 환경 실패는 기준선과 분리 |
| 문서 인벤토리 | IPC 계약·arch 문서 변경 | `node scripts/check-doc-inventory.mjs --check` | 수치 재서술·깨진 링크 |
| CI `gate` | PR 통합 | `.github/workflows/ci.yml` windows | win32 전용 스위트 포함 |
| trailer | 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 전역 선택은 Query 생성 때만 읽는다 | `adapters/claude/adapter.ts:444` |
| setEnabled는 capability 재검증 뒤 저장만 하고 `NativeResources`를 돌려준다 | `app/handlers/extension-catalog.ts:34-48` |
| 세션 단위 폐기: active lease면 closing + child abort + runtime close, 아니면 유휴 풀에서 close | `features/sessions/supervisor.ts:291-301` |
| 세션 전체 중단 handler: residual 비움 → turn abort → `discardRuntime` → `discardSubmitted` → `message.cancelled` | `app/chat-turn/index.ts:174-192` |
| 종료 시 lease cleanup이 held를 초안으로 되돌린다(세션 ID가 있을 때 `message.cancelled`) | `app/chat-turn/send.ts:726-741` |
| lease는 `backend`를 가진다. 생성 지점은 1곳이고 `backend`를 채운다 | `session-chain-lease.ts:20` · `send.ts:214-216` |
| 유휴 풀 항목에는 backend가 없다. 세션 행의 `backend`로 가른다 | `supervisor.ts:106-118` · `bootstrap.ts:1094` `ctx.db.getSessionById` |
| 동작 중 판정 함수가 둘이다: `nativeHistoryBusy`(listening·schedules 포함), `projectResourcesIdle`(responding 포함, listening·schedules 없음) | `app/native-history.ts:8-19` · `app/project-resource-sync.ts:34-47` |
| lease가 살아 있으면 생성 중으로 본다(업데이트 게이트) | `features/sessions/restart-gate.ts:16-24` |
| 런타임 종료는 `background.connection: terminated`를 내고 renderer 패널이 그 세대를 버리고 다시 읽는다 | `session-runtime.ts:808-822` · `nativeResourceState.ts:319` |
| 공용 확인 대화상자 | `shared/ui/confirmDialogStore.ts:29` · `ConfirmDialogHost.tsx` |
| r1 확인 패턴(삭제됨) | `c1481dad:app/src/main/app/handlers/extension-catalog.ts:54-74` · `c1481dad:…/useNativeMcpCatalog.ts:73-121` |
| `native-history.ts`는 harness registry·resolve-turn을 import한다 — 순수 판정만 쓰려면 별도 파일이 필요하다 | `native-history.ts:1-6` · `resolve-turn.ts:7-34` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| setEnabled·폐기·카탈로그 배선 자리 | EP-01 검색 명령(§10) | 25줄 | 자리 11 + 제외 10줄 |
| Claude 적용 시점 문서 서술 | `rg -n "이미 실행 중인 Query는 자기 상태를 유지\|Claude plugin은 새 Query마다" docs/arch docs/IPC_CONTRACT.md` | 2 | `IPC_CONTRACT.md:197` · `adapters.md:69` |
| 판정 함수 소비처 | `rg -n "nativeHistoryBusy\|projectResourcesIdle\|deriveLeaseGateState" app/src/main --glob '!*.test.ts'` | 11줄 | app 판정은 `native-history.ts:8·40`. OpenCode `native-history.ts`의 동명 함수는 다른 대상(메시지 목록) |

### 수치 / 전칭 표현 검산

- "lease 생성 지점 1곳": `rg -n "acquireChain\(" app/src/main --glob '!*.test.ts' --glob '!**/supervisor.ts'` → `send.ts:214` 1건.
- 문서 앵커·기존 테스트 케이스 존재: §7 주의사항의 3건을 grep으로 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

- 관련 V node: 0282 SD-02, AR-08.
- 책임: handler는 선택 저장만 한다. 살아 있는 Query는 종료·축출·재시작까지 옛 flag를 쓴다.

```text
toggle → setGlobalExtension → extensionSetEnabled
  → read → canToggle 재검증 → control.setGlobal(저장)
  → NativeResources
(실행 중 Claude Query: 변화 없음)
```

### TO-BE

- 관련 V node: SD-01, AR-01, AR-02, MD-01~03.
- 책임: handler가 Claude 플러그인 요청에 한해 Claude 프로세스 port로 계획·종료한다. 판정은 순수 계획 함수, 세션 폐기는 공유 함수가 갖는다.

```text
toggle(confirmed?) → setGlobalExtension → extensionSetEnabled
  → read → canToggle 재검증
  → [Claude 플러그인]  plan = processes.plan()          ┐ 동기 구간
       busy > 0 && !confirmed → {confirm, sessions}     │ (await 없음)
       else control.setGlobal → processes.close(plan)   ┘
  → [그 밖]           control.setGlobal
  → {applied, resources: await read()}
renderer: confirm → openConfirmDialog → onConfirm → toggle(…, true)
close(plan): 세션 대상 → discardSessionWork(id, broadcastChatEvent)
             세션 없는 lease → supervisor.discardLease(leaseId)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 |
|---|---|---|---|---|
| 책임 | handler = 저장 | handler = 계획·확인·저장·종료 | D-001·D-002 | AR-01 / VP-04 |
| control flow | 저장 후 반환 | 동기 구간에서 판정→저장→종료 | D-007 race 제거 | SD-01 / VP-02·03 |
| 계약 | 응답 `NativeResources` | 응답 union, 요청 `confirmed?` | D-007 | AR-02 / VP-05 · P1~P4 |
| 판정 | 두 함수 산재 | `sessionActivityBusy` 한 곳 + lease·responding | D-005 SSOT | MD-01 / VP-06 |
| 폐기 | handler 안 인라인 · 세션 ID 필수 | 공유 함수 · lease 단위 폐기 추가 | 새 채팅 첫 턴 | MD-02·03 / VP-07·08 |
| 관측점 | — | bootstrap 실제 supervisor·activity · renderer confirm store | 실행 구간 확보 | VP-01·02·04·05 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 호출 |
|---|---|---|---|
| `app/session-activity-busy.ts`(신규, 순수) | activity 동작 중 판정 | `ChatActivitySnapshot` → boolean | `native-history.ts` · `claude-processes.ts` |
| `app/claude-processes.ts`(신규, electron import 없음) | `planClaudeProcesses` 순수 계획 + `createClaudeProcessReset` 실행기 | 주입 port → `{targets, busy}` / close | handler · bootstrap |
| `features/sessions/supervisor.ts` | `discardLease(leaseId)` 추가, `discardRuntime`이 재사용 | leaseId → boolean | 실행기 · 기존 호출자 |
| `app/chat-turn/discard.ts`(신규) | `discardSessionWork` — 세션 전체 중단 본문 | deps · sessionId · emit | `chatDiscardSession` · 실행기 |
| `app/handlers/extension-catalog.ts` | 분기·확인·순서 | 요청 → union | IPC |
| renderer `useNativeMcpCatalog.ts` | 결과 판별·대화상자·재호출 | union → 행/대화상자 | `ExtensionsCatalogView` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 · VP-01~08·R1·R5 | Claude 플러그인 토글 = (동작 중이면 확인) → 저장 → 모든 Claude 프로세스 종료. 확인 계약 union | `shared/native-resources.ts` 타입 · handler 분기 | main·preload·renderer | P1 `shared/protocol.ts:765` `confirmed` · P2 `shared/native-resources.ts:63` 요청·결과 타입 · P3 `preload/index.ts:293-294` · P4 `renderer/src/shared/api/ipc.ts:222-224` · P5 `useNativeMcpCatalog.ts:82` 결과 판별·대화상자 · P6 `handlers/extension-catalog.ts:15` port 주입 · P7 `extension-catalog.ts:45` 분기·순서 · P8 `bootstrap.ts:1234` 조립 · P9 `supervisor.ts:291` lease 폐기 분해 · P10 `chat-turn/index.ts:174·180` 본문 추출 · P11 `docs/IPC_CONTRACT.md:193` · P12 `docs/IPC_CONTRACT.md:197` · P13 `docs/arch/backend/adapters.md:69` · P14 신설 `app/claude-processes.ts` · P15 신설 `app/session-activity-busy.ts`(+`native-history.ts:8·40`) · P16 i18n `ko.ts`·`en.ts` `chat.nativeResources.claudeClose*` — **16** | ① `rg -n "extensionSetEnabled\|setGlobalExtension\|SetGlobalNativeResource\b\|SetGlobalNativeResourceSchema\|control\.setGlobal\|chatDiscardSession\|discardRuntime\(\|closeAllLeaseRuntimes\|registerExtensionCatalogHandlers\(" app/src/main app/src/shared app/src/preload app/src/renderer/src docs/IPC_CONTRACT.md docs/arch --glob '!*.test.ts' --glob '!*.test.tsx'` → `28d25d35`에서 25줄 = P1 1·P2 1·P3 2·P4 3·P5 1·P6 1·P7 1·P8 1·P9 1·P10 2·P11 1 + 제외 10(`preload/index.ts:10` import·`:182` 세션 중단 호출 불변 · `shared/ipc.ts:44·97` 채널 상수 불변 · `supervisor.ts:303` 종료 시 전 backend close 불변 · `bootstrap.ts:919` 앱 종료 · `:1200` 세션 삭제 hook · `extension-catalog.ts:6` import · `:35·36` 등록 불변) ② 문서 검색(§8) → P12·P13 2줄 ③ P14~P16은 신설 | 끈 플러그인이 실행 중 세션에 남음 · 확인 없이 응답이 끊김 · OpenCode 세션이 닫힘 · 저장 실패인데 세션이 닫힘 |
| EP-10′ · VP-R4 | Orca는 OpenCode 플러그인을 제어하지 않는다(0282 EP-10 승계) | 0282 EP-10 | main·renderer | 0282 EP-10 R1~R29 그대로 | 0282 EP-10 음성 게이트 술어에서 `SetGlobalNativeResourceResult`·`confirmed\?: true`·`confirmed: z\.literal`·`request\.confirmed` 4개를 뺀 술어 → 0건. 나머지 술어(`openCodeSessions`·`restartTitle` 등)는 유지 | 이 4개는 이제 Claude 확인 계약 이름이다. OpenCode 쪽 확인 부재는 VP-R1이 행동으로 잠근다 |

- 같은 규칙의 SSOT: activity 동작 중 판정은 `sessionActivityBusy` 하나다. `native-history.ts`는 이를 import해 기존 이름 `nativeHistoryBusy`로 다시 내보낸다. `projectResourcesIdle`은 범위가 달라(프로젝트 리소스 재조정) 이번에 합치지 않는다.
- "다른 게이트가 막는다" 서술: 해당 없음.
- 선택적 필드: `confirmed`는 `true` 또는 부재만 허용한다(`z.literal(true).optional()`). `false`는 스키마 거절이다.
- 동기 구간: `plan()`부터 `close()`까지 사이에 `await`를 두지 않는다. 확인 판정 뒤 새 턴이 끼어들 수 없게 하는 유일한 장치다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `shared/native-resources.ts` | 계약 | `SetGlobalNativeResource`에 `confirmed?: true`. `SetGlobalNativeResourceResult = {status:'applied'; resources: NativeResources} \| {status:'confirm'; reason:'claude-processes'; sessions: number}` | 타입 |
| `shared/protocol.ts:765` | 스키마 | `confirmed: z.literal(true).optional()` | 스키마 단위 |
| `app/session-activity-busy.ts`(신규) | 판정 SSOT | `native-history.ts:8-19` 본문을 `sessionActivityBusy`로 이동 | 기존 `native-history.test.ts` |
| `app/native-history.ts` | 소비 | import + `export { sessionActivityBusy as nativeHistoryBusy }` | 기존 |
| `app/claude-processes.ts`(신규) | 계획·실행 | `planClaudeProcesses({leases, runtimes, backendOf, activity})`: ① `backend ?? backendOf(sessionId)`가 `'claude'`이고 `kind !== 'closing'`인 lease → 동작 중 대상 ② 남은 runtime 항목 중 `backendOf(sessionId) === 'claude'` → `responding === true \|\| sessionActivityBusy(activity(sessionId))`면 동작 중 ③ sessionId로 중복 제거. `createClaudeProcessReset(deps)` → `{ plan(), close(targets) }`. close는 세션 대상에 `deps.discardSession(id)`, 세션 없는 lease에 `deps.supervisor.discardLease(leaseId)`. 대상마다 try/catch → `deps.failed(error)` 후 계속 | 순수 단위 |
| `features/sessions/supervisor.ts` | lease 폐기 | `discardLease(leaseId): boolean` 신설. `discardRuntime`의 lease 분기는 이를 부른다(동작 불변) | 단위 |
| `app/chat-turn/discard.ts`(신규) | 세션 전체 중단 | `discardSessionWork({activity, supervisor, pendingMessages}, sessionId, emit)` — `index.ts:175-191` 본문 이동 | 단위(가짜 deps) |
| `app/chat-turn/index.ts:174` | handler | `discardSessionWork(deps, req.sessionId, (e) => sendChatEvent(event.sender, e))` | 기존 handler 테스트 |
| `app/handlers/extension-catalog.ts` | 분기 | `registerExtensionCatalogHandlers(control, processes)` — `processes` 필수. Claude 플러그인이면 §9 TO-BE 순서. 반환 union | bootstrap 통합 |
| `app/bootstrap.ts:1234` | 조립 | `createClaudeProcessReset({ supervisor, backendOf: (id) => ctx.db.getSessionById(id)?.backend, activity: (id) => activity.current(id), discardSession: (id) => discardSessionWork({activity, supervisor, pendingMessages}, id, broadcastChatEvent), failed: reportError(...) })` 주입 | bootstrap 통합 |
| `preload/index.ts:293` · `renderer/src/shared/api/ipc.ts:222` | 형상 | 반환 `Promise<SetGlobalNativeResourceResult>` | preload 왕복 |
| `features/skills/hooks/useNativeMcpCatalog.ts` | UI | `toggle(backend, resource, confirmed?: true)`. `confirm` → `openConfirmDialog({ title: tr('chat.nativeResources.claudeCloseTitle'), message: tr('chat.nativeResources.claudeCloseBody', { count: value.sessions }), confirmLabel: tr('chat.nativeResources.claudeCloseConfirm'), cancelLabel: tr('common.cancel'), onConfirm: () => void toggle(backend, resource, true) })`. `applied` → `accept(backend, value.resources)` | renderer 하네스 |
| `i18n/resources/ko.ts`·`en.ts` | 문구 | `chat.nativeResources.claudeCloseTitle` "Claude 세션 종료" / "Close Claude sessions" · `claudeCloseBody_one`·`_other` "응답 중이거나 작업이 진행 중인 Claude 세션이 {{count}}개 있습니다. 플러그인 변경을 적용하려면 실행 중인 Claude 세션을 모두 종료합니다. 진행 중인 응답과 백그라운드 작업은 중단됩니다." / "{{count}} Claude session is (sessions are) responding or running work. Applying this plugin change closes every running Claude session, and responses and background work in progress will stop." · `claudeCloseConfirm` "변경" / "Change" | `resources.test.ts` |
| `docs/IPC_CONTRACT.md:193·197` · `docs/arch/backend/adapters.md:69` | 문서 | 요청·응답 union과 확인 의미, "실행 중 Query 유지" → "토글 시 실행 중 Claude 프로세스 종료" | inventory gate |

### 테스트 가능성

- 순수 seam: `claude-processes.ts`·`session-activity-busy.ts`는 electron·DB·harness registry를 import하지 않는다.
- 기존 메커니즘 재사용 적합성: `discardRuntime`은 세션 ID가 있는 대상에만 맞다 → 새 채팅 첫 턴용 `discardLease`를 더한다. 세션 전체 중단 본문은 `event.sender` 대신 `emit`을 받게 해 방송에도 쓴다.
- bootstrap 통합 테스트는 `register()`가 돌려주는 실제 `supervisor`·`activity`를 쓴다(`bootstrap.native-history.test.ts:189-229`). 대상은 `supervisor.acquireChain`+`activateChain`(lease)과 `releaseRuntime`(유휴 풀)로 심고, residual은 `activity.setResidualAttempts`로, backend는 `ctx.db.getSessionById` 대체로 준다. 저장 실패는 `SettingsStore.setNativeExtensionChoices`를 throw로 바꾼다.
- 구별 값: 대상 3(lease 동작 중 1 · residual 유휴 풀 1 · 순수 유휴 1)·동작 중 2 · OpenCode lease 1·유휴 1 · 서로 다른 cwd 2.

## 12. End-to-end 영향

```text
renderer toggle → preload invoke → handler → plan/close → supervisor·대기열 → background.connection terminated → 패널 재조회
                                                     ↘ message.cancelled 방송 → Composer 초안
```

- producer 기준: main만 동작 중 수를 센다. renderer는 수를 표시만 한다.
- consumer 파생 규칙: `status`로만 분기한다. renderer가 동작 중 여부를 따로 계산하지 않는다.

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| `useNativeMcpCatalog.toggle` | 응답 형상 변경 | AC2~AC4 |
| `extension-catalog.test.ts`·`preload/index.test.ts`·0282 bootstrap 테스트 | 응답이 union으로 바뀜 — 단언 갱신 | AC1·AC7 |
| `chatDiscardSession` | 본문 이동 | VP-R5 |

## 13. Lifecycle / 오류 / 정리

- 시작: 사용자 토글.
- 취소: 대화상자 [취소] → 아무 IPC 없음.
- 종료 중: 진행 child abort → 턴 `turn.aborted` 1회(VP-R5 회귀) → lease cleanup이 held 초안 복원.
- 부분 실패: 대상 하나의 close가 던져도 나머지를 닫고 `failed`로 보고한다. 저장은 이미 끝난 상태다.
- **다중 저장소 쓰기**: ① 설정 저장 ② 프로세스 종료.
  - ①이 실패하면 ②를 하지 않는다 → 선택·프로세스 모두 이전(AC8).
  - ① 뒤 앱이 죽으면 프로세스도 함께 죽는다 → 재시작 뒤 새 선택.
  - ② 일부 실패 → 그 프로세스만 옛 flag로 남고 보고된다. 허용(다음 축출·재시작에서 회복).
  - ②를 ①보다 먼저 하면 저장 실패 때 세션만 끊긴다 → 금지(M9).

## 14. 성능 / 상한 / 최적화

- 종료 대상 상한 = 실행 중 Claude lease 수 + 유휴 풀(cap, `bootstrap` 주입). 각 close는 동기다.
- 새 요청 수: 토글 1회당 IPC 최대 2회(확인 + 재호출).

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음(앱 내부 IPC). `IPC_CONTRACT.md:193` 행만 갱신한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0282 D-008 실행 중 Query 유지 | 0282 plan §3 | §3 D-001 | 변경(사용자) |
| 0282 D-032 setEnabled 원형 | 0282 plan §3 | §3 D-007 · §11 계약 | 변경(Claude 플러그인 한정) |
| 0282 D-034 OpenCode MCP 토글 | 0282 plan §3 | §6 비범위 · AC7 | 유지 |
| 0282 D-036 프로젝트 토글 | 0282 plan §3 | §6 비범위 | 유지 — 우측 패널 경로 미변경 |
| 0282 D-033 재시작 유지 | 0282 plan §3 | AC8 · VP-R3 | 유지 — 저장이 종료보다 먼저 |
| 0151 세션 전체 중단 | `chat-turn/index.ts:170-173` 주석 | §11 discard 추출 | 유지 — 의미 불변, 호출자 추가 |
| 0166 lease = 생성 중 | `restart-gate.ts:16` | AC5 lease 신호 | 유지 |
| `src/main` DAG(app → features) | `app/src/main/AGENTS.md` | 신규 파일 모두 `app/`·`features/sessions` | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 승인 뒤 다른 창의 응답도 끊긴다 | 의도(D-001). 대화상자 본문이 "모두 종료"를 말한다 |
| 대화상자를 연 뒤 새로 시작된 세션도 [변경] 때 끊긴다 | 승인 범위를 "실행 중인 Claude 세션 모두"로 안내한다 |
| 확인 계약 이름이 0282 EP-10 음성 게이트 술어와 겹친다 | EP-10′로 술어 4개를 빼고 OpenCode 쪽은 행동 테스트(VP-R1)로 잠근다 |

- 되돌리기 어려운 결정: 없음(내부 IPC).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{native-resources,protocol}.ts`
- `app/src/main/app/{claude-processes,session-activity-busy,native-history,bootstrap}.ts` · `app/src/main/app/chat-turn/{discard,index}.ts` · `app/src/main/app/handlers/extension-catalog.ts` · `app/src/main/features/sessions/supervisor.ts`
- `app/src/preload/index.ts` · `app/src/renderer/src/shared/api/ipc.ts` · `app/src/renderer/src/features/skills/hooks/useNativeMcpCatalog.ts` · `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md` · `docs/arch/backend/adapters.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/main/app/claude-processes.test.ts src/main/app/native-history.test.ts src/main/app/chat-turn src/main/app/bootstrap.native-history.test.ts src/main/app/handlers/extension-catalog.test.ts src/main/features/sessions src/main/adapters/claude src/preload src/renderer/src/features/skills src/renderer/src/shared/i18n`.
- 문서: `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: AC9.

## READY self-review

- 결정: D-001~D-009 출처·상태 기록. 0282 D-008·D-032 대체를 명시했다.
- Part I만으로 완료 상태가 읽힌다(§5 상태표 7행).
- 사용자 원문 2건과 답변 2건을 인용했다. "모든 세션(프로세스)"를 대화 삭제로 해석하지 않았다.
- 사실 13행에 `파일:줄`을 붙였고 "생성 지점 1곳"을 검색으로 확인했다.
- AC 9건에 동작·수단·경로가 있다. AC9만 사람 실기다.
- Delta V: NEW 노드 R-02·AR-01·AR-02·MD-01~03, CHANGED R-01·SD-01에 같은 레벨 REQUIRED pair가 있다. 영향받은 상속 노드 5개는 REGRESSION이다.
- EP-01 16자리를 검색 출력 25줄로 고정했다(자리 11 + 제외 10줄 + 문서 2 + 신설 3).
- 적대 증거는 VP-01·02·03·04·06·R1·R4에서 선택했다(M1~M13 + 0282 G01).
- 동기 구간·저장→종료 순서·N과 대상 수 구별을 장치로 잠근다(M3·M6·M9).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

## [구현자 기입] 강제 지점 전수 (§10 대조)

## [구현자 기입] 이번 라운드 수정의 잠금

## [구현자 기입] Product/UX 파생 검토

## [구현자 기입] 놓친 잠재 문제 + 대응

## [구현자 기입] 구현 보고

## [구현자 기입] Review Signals — 사실만

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
