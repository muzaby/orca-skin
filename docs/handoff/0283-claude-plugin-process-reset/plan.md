# Plan — 0283-claude-plugin-process-reset

## 메타

| 항목 | 값 |
|---|---|
| slug | `0283-claude-plugin-process-reset` |
| 작성자 | Claude Code |
| 일자 | 2026-10-24 |
| 매핑 | — |
| 상태 | IMPL_DONE (ΔV2 r2 · 독립 검증 대기) |
| V mode | `Delta V` |
| 기준 V | `0282-plugin-catalog-native-sync` 유효 V(`V1 + ΔV1 + ΔV2 + ΔV3 + ΔV5 + ΔV6`)`@28d25d35` |
| 이번 V revision | `ΔV2` — 확인 대화상자 경로·운반 항 재고정, 문서 gate 분리, 종료 실패 전용 제목(verify r1 G1·G2·N1·N2). `ΔV1` = 0282 D-008 대체 |
| 유효 V | `0282@28d25d35 + 0283 ΔV1@d69b4c54 + ΔV2` |

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
| D-010 | 일부 Claude 프로세스 종료가 실패하면 전용 오류 제목 `claudeSessionsCloseFailed`(ko "일부 Claude 세션을 닫지 못했습니다" · en "Could not close some Claude sessions")로 보고한다 | 저장은 성공했는데 "변경 사항을 저장하지 못했습니다"로 읽힌다 | 사용자 Q3(ΔV2) | ACTIVE | — |
| D-011 | 확인 대화상자 [변경]은 기본 확정 버튼이다(`danger` 없음) | 0282 r1 패턴 그대로 | 사용자 Q4(ΔV2) | ACTIVE | D-003 보완 |

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

- AC 총수: **9**. ΔV2가 AC2~AC4를 AC2′~AC4′로 대체하고 AC10을 더한다(총 10) — ΔV2-4 절.

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

> EP-01은 ΔV2 EP-01′(자리 23 + 운영 gate G-DOC 3)가 대체한다 — ΔV2-7 절.

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

# ΔV2 — 확인 대화상자 경로와 운반 항 재고정 · 문서 gate 분리 · 종료 실패 전용 제목 (2026-10-24)

판정: **READY**. verify r1 RETURN_TO_PLAN의 G1·G2를 닫는다. D1~D5는 기존 pair에 귀속된 구현 의무이며, 이번 revision은 그 운반 항을 EP-01′에 좌표와 함께 고정하고 등록 변이로 올린다. verify r1 N1·N2는 사용자 결정 D-010·D-011로 닫는다.

## ΔV2-1. 사실 (Orca `aff17235`)

| 사실 | 근거 |
|---|---|
| ΔV1 좌표로 잠기지 않은 운반 항 8개가 관측됐다 | `verify.md` §4 고장 이력 X1·X18·X19·X20·X25·X27·X29·X30 |
| 확인 대화상자는 셸에 1회 마운트된 host가 store를 구독해 렌더한다. [변경]=onConfirm+close, [취소]·배경=close | `ConfirmDialogHost.tsx:9-31` · `Modal.tsx:57·107-121` |
| host를 렌더하는 테스트가 없다 | `rg -l ConfirmDialogHost app/src -g '*.test.*'` → 1건, `automaticFeedDebug.integration.test.ts:51`이 `() => null`로 mock |
| view 상호작용 테스트는 실제 i18n으로 view를 렌더하고 confirm store를 정리한다 | `ExtensionsCatalogView.interaction.test.ts:19` `i18n.t` · `:95-97` |
| fake DOM 하네스는 portal을 그대로 렌더한다 | `renderHarness.testfixture.ts:326-327` |
| view는 hook `toggle`을 그대로 넘기고 CustomizeList가 2인자로 부른다 | `ExtensionsCatalogView.tsx:164` · `CustomizeList.tsx:116` |
| CustomizeList 클릭 테스트는 요청을 정확히 단언한다(`confirmed` 부재) | `useNativeMcpCatalog.test.ts:'renders native plugin capabilities and updates the actual row through its toggle'` |
| ko는 `_other`만 고른다. ko `_one`은 키 parity용 같은 문구 사본이다 | `ko.ts:896-901` 선례 |
| `extension-catalog.test.ts`는 실제 `handle` 래퍼(zod safeParse)를 거친다 | `handle.ts:31-32` · 테스트 `:11-17` electron mock |
| 오류 보고 관측 선례는 `errorReportHub.publish` spy다 | `updater.report.test.ts:21` |
| 유휴 풀 close는 `runtime.close()`의 throw를 그대로 올리고, 실행기가 대상별로 잡는다 | `runtime-pool.ts:85-90` · `claude-processes.ts:89-95` |
| 오류 제목은 닫힌 목록이고 ko·en 문구가 `satisfies Record<AppErrorTitle, string>`이다 | `app-error.ts:2-24` · `ko.ts:575-598` · `en.ts:571-594` |
| 제목 목록 전체의 문구 존재를 단언하는 테스트는 없다 | `rg -l APP_ERROR_TITLES app/src` → `app-error.ts` 1건 |
| 세션 전체 중단 fixture는 실제 handler·queue·activity와 mock `sendChatEvent`를 쓴다 | `post-turn.schedules.test.ts:115-126·155-162` |
| 문서 drift 게이트는 기준선에서 이미 red라 oracle로 쓸 수 없다 | `drift-check.sh check` → 단언 불일치 60 · 표식 잔류 9 |

## ΔV2-2. Decision

§3 Decision Ledger에 D-010·D-011을 추가했다(verify r1 N1·N2).

- 사용자 질문 원문: Q3 "토스트 제목을 어떻게 할까요?" → "전용 제목 신설"(제시 예 "일부 Claude 세션을 닫지 못했습니다"). Q4 "[변경] 버튼을 빨간 경고(danger) 스타일로 할까요?" → "기본 스타일 유지".
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0. D-010↔AC10, D-011↔AC2′, D-003↔AC2′~AC4′, D-007↔AC4′. 나머지 D-001~D-009 ↔ ΔV1 AC 대응은 그대로다.

## ΔV2-3. Product 변경

§5 상태표에 한 행을 더한다. 나머지 행은 같다.

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 종료 중 일부 프로세스 close 실패 | 나머지는 계속 닫는다. 선택은 이미 저장됐다 | 오류 토스트 "일부 Claude 세션을 닫지 못했습니다". 행은 새 값 |

## ΔV2-4. Acceptance — AC2′·AC3′·AC4′(대체) · AC10(신규)

| R | AT / AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-02 | AT-02 / **AC2′** (AC2 대체) | AC2 동작 + 사용자가 보는 대화상자는 제목 "Claude 세션 종료", 본문에 동작 중 세션 수 N, [변경](기본 버튼)·[취소]다. en은 N=1 단수·N≥2 복수 문장이다 | bootstrap(AC2 그대로) · 렌더: view + host 실제 렌더·실제 i18n, ko N=2 · en N=1·N=2 본문, 버튼 텍스트, 확정 버튼 `danger` 아님(store request `danger` 미지정) | view 스위치 → hook → store → host → ModalActions |
| R-02 | AT-02 / **AC3′** (AC3 대체) | [취소] 버튼 또는 배경 클릭이면 IPC 재호출이 없고 행·선택·프로세스가 그대로다 | 같은 렌더에서 [취소] 클릭·배경 클릭 각각 → 요청 수 불변 · 행 유지 | host `onCancel`·Modal `onClose` |
| R-02 | AT-02 / **AC4′** (AC4 대체) | AC4 동작 + [변경] 버튼 클릭이 `confirmed: true` 재요청을 만든다. `confirmed`는 `true`나 부재만 받고 `false`는 거절한다. main은 판정부터 종료까지 다른 작업에 양보하지 않는다 | 렌더: [변경] 클릭 → 요청 `confirmed: true` · 행 갱신 · handler: `confirmed:false` reject·계획 0 · 순서 탐침 `[plan, save, close, intruder]` · bootstrap(AC4 그대로) | host `handleConfirm` → hook 재호출 → schema → handler |
| R-01 | AT-01 / **AC10** | 종료 대상 하나의 close가 실패해도 나머지 대상을 닫고 결과는 `applied`다. 실패는 D-010 제목으로 대상당 1회 보고한다 | bootstrap: Claude 유휴 2(cwd 다름) 중 첫 대상 close throw → 둘째 close 1 · `applied` · `errorReportHub.publish` `claudeSessionsCloseFailed` 1회 · 저장값 | handler → 실행기 → `failed` → `reportError` |

- AC 총수: 9 → 10 (AC2~AC4 대체, AC10 추가). AC9(사람 실기)는 그대로다.

## ΔV2-5. Delta V

| Node | 레벨 | 계약 | provenance | 대체 |
|---|---|---|---|---|
| R-01′ / AT-01′ | R / AT | AC1·AC6·AC8·AC10 | CHANGED | R-01 |
| R-02′ / AT-02′ | R / AT | AC2′~AC4′·AC5 | CHANGED | R-02 |
| AR-01′ / IT-01′ | AR / IT | 조립에 실패 보고 제목 D-010 포함 | CHANGED | AR-01 |
| AR-02′ / IT-02′ | AR / IT | view 진입 → hook → store → host → ModalActions → 재호출/닫기 | CHANGED | AR-02 |

| Pair | left ↔ right | requiredness | production path | 직접 oracle 좌표 | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01′ | R-01′ ↔ AT-01′ | REQUIRED (VP-01 대체) | view → CustomizeList → hook → api → preload → handler → 계획 → 저장 → 종료 → 다음 Query | T-list · T-hook-idle · T-pre · T-boot-idle · N-fail · VP-03 좌표 | M1·M2(승계) · M24 | EP-01′ S1~S5·S7·S12~S18·S23 |
| VP-02′ | R-02′ ↔ AT-02′ | REQUIRED (VP-02 대체) | handler(동작 중) → confirm → host → 취소/변경 → 재호출 → 종료 | T-boot-ask · N-host · N-host-en · N-sync · N-false · T-pre | M3~M6(승계) · M14 · M15 · M23 | EP-01′ S1~S11·S14 |
| VP-04′ | AR-01′ ↔ IT-01′ | REQUIRED (VP-04 대체) | `Bootstrap.register` → port 조립 → handler | T-boot-* 4건 · N-fail | M8·M9(승계) · M18 · M18b | EP-01′ S12·S16·S18·S23 |
| VP-05′ | AR-02′ ↔ IT-02′ | REQUIRED (VP-05 대체) | view → CustomizeList → hook → store → host → ModalActions → 재호출 / 닫기 | N-host · N-host-en · T-hook-confirm · T-hook-oc · T-list | M5a·M5b(승계) · M16 · M17 · M20 · M21 · M22 | EP-01′ S5~S11 |
| VP-R5′ | 0151 ↔ ST | REGRESSION (VP-R5 대체) | Composer [세션 전체 중단] → `chatDiscardSession` → 공유 함수 → 요청 창 emit | N-discard · T-discard · `pending-message-queue.test.ts` `discardSubmitted (OQ1 — 세션 전체 중단)` | M19 | EP-01′ S21·S22 |

- 그대로인 pair: VP-03·VP-06·VP-07·VP-08·VP-R1~R4는 ΔV1 행 그대로다. §10 열의 EP-01 자리 이름만 EP-01′로 읽는다(P9→S20, P10→S21·S22, P14→S17·S18, P15→S19, P7→S14·S15).
- `SUPERSEDED` 이관:
  - VP-01 → VP-01′: M1·M2 승계. P13(문서)은 운영 gate G-DOC로 옮긴다.
  - VP-02 → VP-02′: M3~M6 승계. D1(X25)→M14, D2(X18)→M15를 등록한다.
  - VP-04 → VP-04′: M8·M9 승계. D4(X1)→M18을 등록하고 제목 항 M18b를 더한다.
  - VP-05 → VP-05′: M5 승계. store 직접 호출 좌표(T-hook-confirm)는 hook 판정 항만 덮는다. D3(X19·X20)→M16·M17, G2(X29·X30)→M20·M21을 등록한다.
  - VP-R5 → VP-R5′: D5(X27)→M19를 등록한다.
  - AC2·AC3·AC4 → AC2′·AC3′·AC4′. EP-01 → EP-01′.
- 적대 증거 선택 이유: M14~M24는 verify r1에서 전체 스위트를 통과한 고장 또는 그 형제 자리다. 방향(제거)과 자리(맞바꿈)를 둘 다 등록한다.

### 좌표 표

| 좌표 | 파일:테스트 | 진입 · 구별 입력 · 관측 |
|---|---|---|
| T-boot-idle · T-boot-ask · T-boot-save · T-boot-oc | `bootstrap.native-history.test.ts` 기존 4건(`'closes every idle Claude process…'` · `'asks before closing busy Claude sessions…'` · `'keeps every Claude process when the Claude plugin choice cannot be saved'` · `'applies OpenCode MCP toggles…'`) | ΔV1 그대로 |
| T-ec | `extension-catalog.test.ts:'reads native defaults without copying them…'` | ΔV1 그대로 |
| T-pre | `preload/index.test.ts:'carries explicit global extension scope and choices across renderer API and preload'` | ΔV1 그대로 |
| T-hook-idle · T-hook-confirm · T-hook-oc | `useNativeMcpCatalog.test.ts` 기존 3건 | ΔV1 그대로 |
| T-list | `useNativeMcpCatalog.test.ts:'renders native plugin capabilities and updates the actual row through its toggle'` | CustomizeList 클릭 → 요청 정확 일치(`confirmed` 부재) |
| T-cp · T-nh · T-sup · T-discard · T-res | `claude-processes.test.ts` 13건 · `native-history.test.ts:'does not close or replace an occupied session'` · `supervisor.test.ts` 2건+기존 · `discard.test.ts` · `resources.test.ts` 키·플레이스홀더 | ΔV1 그대로 |
| **N-sync** (신규) | `extension-catalog.test.ts` `'saves and closes in the same synchronous section as the busy check'` | 실제 `handle` 래퍼 · fake `processes.plan`이 `queueMicrotask(() => order.push('intruder'))` 예약 뒤 busy 0·대상 1 반환 · `control.setGlobal` spy·`close` spy가 순서 기록 · 관측 `['plan','save','close','intruder']` |
| **N-false** (신규) | `extension-catalog.test.ts` `'rejects confirmed: false before planning or saving'` | `{…, confirmed: false}` → reject · `plan` 0 · 저장값 불변. 같은 요청 `confirmed: true`는 `applied`(구별 대조) |
| **N-host** (신규) | `ExtensionsCatalogView.interaction.test.ts` `'confirms a busy Claude plugin change through the shared dialog'` | `ExtensionsCatalogView`와 `ConfirmDialogHost`를 함께 렌더, ko · Claude 플러그인 스위치 클릭, write = confirm(sessions 2) · 관측: 제목 "Claude 세션 종료" · 본문 "2개" 포함 · 버튼 "변경"·"취소" · request `danger` 미지정 → [취소] 클릭: write 1·행 on → 다시 클릭 → 배경 클릭: write 2·행 on → 다시 클릭 → [변경] 클릭: 마지막 write `confirmed: true` · 행 off |
| **N-host-en** (신규) | 같은 파일 `'renders the Claude close dialog in English with singular and plural counts'` | `i18n.changeLanguage('en')`(끝에 ko 복원) · sessions 1 → 본문 "1 Claude session is" 시작 · sessions 2 → "2 Claude sessions are" 시작 · 제목 "Close Claude sessions" · 버튼 "Change" |
| **N-fail** (신규) | `bootstrap.native-history.test.ts` `'keeps closing Claude processes after one close fails and reports it once with the dedicated title'` | Claude 유휴 2(`claude-A`·`claude-B`, 먼저 넣은 쪽 `close()` throw) · `vi.spyOn(errorReportHub, 'publish')` · 관측: 다른 대상 closed 1 · `applied` · publish 1회 title `claudeSessionsCloseFailed` · 저장값 |
| **N-titles** (신규) | `resources.test.ts` `'has a non-empty toast title for every app error title in each locale'` | `APP_ERROR_TITLES` 전수 × ko·en `errors.toast` 비어 있지 않은 문자열 |
| **N-discard** (신규) | `post-turn.schedules.test.ts`(같은 fixture) `'returns residual submissions to the requesting window when the session is discarded'` | fixture queue에 's1' 예약 enqueue·reserveHeld·commit · `activity.setResidualAttempts('s1', [attempt])` · `chatDiscardSession`을 `{ sender: owner }`로 호출 · 관측 `sendChatEvent`가 `(owner, { type: 'message.cancelled', sessionId: 's1', ids: [id] })` 1회 |

### 등록 변이 (ΔV2 신규)

| ID | 자리 | 종류 | 바꾼 내용 | 잡아야 할 좌표 |
|---|---|---|---|---|
| M14 | `extension-catalog.ts:56` 뒤 · `:60` 뒤 | 뒤집기 | `await Promise.resolve()` 삽입 — 자리마다 1회씩 따로 심는다 | N-sync |
| M15 | `protocol.ts:767` | 다른 값 | `z.literal(true)` → `z.boolean()` | N-false |
| M16 | `ko.ts:625·627` · `en.ts:621·623` | 제거 | 본문 `{{count}}` 4곳(자리마다 1회) | N-host · N-host-en |
| M17 | `en.ts:621·623` | 맞바꿈 | `_one` ↔ `_other` 본문 | N-host-en |
| M18 | `bootstrap.ts:1249-1255` | 빈 값 | `failed: () => {}` | N-fail |
| M18b | `bootstrap.ts:1253` | 다른 값 | 제목 `claudeSessionsCloseFailed` → `saveFailed` | N-fail |
| M19 | `chat-turn/index.ts:177` | 빈 값 | 요청 창 emit → `void e` | N-discard |
| M20 | `ConfirmDialogHost.tsx:16` | 제거 | `request.onConfirm()` | N-host |
| M21 | `ConfirmDialogHost.tsx:28` | 맞바꿈 | `onCancel={close}` → `{handleConfirm}` | N-host |
| M22 | `ConfirmDialogHost.tsx:24` | 맞바꿈 | `onClose={close}` → `{handleConfirm}` | N-host |
| M23 | `ExtensionsCatalogView.tsx:164` | 호출 대체 | `(b, r) => nativeMcp.toggle(b, r, true)` | N-host |
| M24 | `CustomizeList.tsx:116` | 다른 값 | `onNativeToggle?.(backend, resource, true as never)` | T-list |

## ΔV2-6. Technical Design

| 변경 파일 | 변경 내용 |
|---|---|
| `shared/app-error.ts` | `APP_ERROR_TITLES`에 `'claudeSessionsCloseFailed'` 추가 |
| `i18n/resources/ko.ts`·`en.ts` | `errors.toast.claudeSessionsCloseFailed` — ko "일부 Claude 세션을 닫지 못했습니다" · en "Could not close some Claude sessions" |
| `app/bootstrap.ts:1253` | `title: 'saveFailed'` → `title: 'claudeSessionsCloseFailed'` |
| 테스트 | 좌표 표의 신규 7건(N-sync·N-false·N-host·N-host-en·N-fail·N-titles·N-discard) |

- 그 밖의 production 코드는 바뀌지 않는다. D1·D2·D3·D5·G2는 잠금(테스트) 의무다.
- `ConfirmDialogHost`는 공용 컴포넌트라 이번에 고치지 않는다. N-host가 이 handoff의 경로로 그 배선을 잠근다.
- 레이어: 신규 테스트는 기존 파일에 둔다. renderer 테스트가 `shared/app-error`를 import하는 것은 `shared` 하향 의존이다.

## ΔV2-7. 강제 지점 (§10 ΔV2 — EP-01 대체)

| V node / pair | 계약 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|
| EP-01′ · VP-01′·02′·04′·05′·R5′ + VP-03·06·07·08·R1 | Claude 플러그인 토글 = (동작 중이면 공용 대화상자로 확인) → 저장 → 모든 Claude 프로세스 종료 → 실패 보고. 확인 계약 union | 아래 자리표 **23** | ①②③ (아래) — `aff17235` 출력 고정 | 끈 플러그인이 실행 중 세션에 남음 · 확인 없이 응답이 끊김 · 대화상자가 N·버튼을 잘못 보임 · OpenCode 세션이 닫힘 · 저장 실패인데 세션이 닫힘 · 종료 실패가 조용함 |
| G-DOC (운영 gate) | 문서 계약 동기화 | D1 `IPC_CONTRACT.md:193` · D2 `:197` · D3 `adapters.md:69` — **3** | ④ (아래) | 문서가 옛 "실행 중 Query 유지"를 말하거나 확인 계약을 빠뜨림 |
| EP-10′ | ΔV1 그대로 | ΔV1 그대로 | ΔV1 그대로 | ΔV1 그대로 |

**자리 검색 명령**

- ① 계약·종료 식별자: `rg -n "extensionSetEnabled|setGlobalExtension|SetGlobalNativeResource|control\.setGlobal|chatDiscardSession|discardRuntime\(|discardLease|closeAllLeaseRuntimes|registerExtensionCatalogHandlers\(|createClaudeProcessReset|planClaudeProcesses|discardSessionWork|sessionActivityBusy|claudeClose" app/src/main app/src/shared app/src/preload app/src/renderer/src --glob '!*.test.ts' --glob '!*.test.tsx'` → **62줄** = 자리 46줄 + 제외 16줄.
- ② 대화상자·진입 경로(path 파일 6개 전체): `rg -n "onNativeToggle|nativeMcp\.toggle|openConfirmDialog|useConfirmStore|request\.onConfirm|onConfirm|onCancel|onClose=|confirmLabel|cancelLabel" app/src/renderer/src/features/skills/components/customize/{ExtensionsCatalogView,CustomizeList}.tsx app/src/renderer/src/features/skills/hooks/useNativeMcpCatalog.ts app/src/renderer/src/shared/ui/{confirmDialogStore.ts,ConfirmDialogHost.tsx,Modal.tsx}` → **43줄** = 자리 21줄(`useNativeMcpCatalog.ts:96`은 ①과 중복) + 제외 22줄.
- ③ 실패 보고 제목: `rg -n "claude-processes\.close-failed|claudeSessionsCloseFailed|export const APP_ERROR_TITLES" app/src --glob '!*.test.*'` → **2줄**(`bootstrap.ts:1251` · `app-error.ts:2`). 구현 뒤 `claudeSessionsCloseFailed` 4파일(app-error·bootstrap·ko·en).
- ④ G-DOC: 음성 `rg -n "Query는 자기 상태를 유지" docs/arch docs/IPC_CONTRACT.md` → 0 · 양성 `rg -c "SetGlobalNativeResourceResult" docs/IPC_CONTRACT.md` ≥1 · `rg -c "confirmed\?: true" docs/IPC_CONTRACT.md` ≥1 · `rg -c "토글 시 실행 중인 Claude 프로세스를 닫" docs/IPC_CONTRACT.md` ≥1 · `rg -c "전역 토글이 실행 중인 Claude 프로세스를 모두 닫" docs/arch/backend/adapters.md` ≥1. `aff17235`: 0·1·1·1·1, `d69b4c54` 음성 1.

**자리표 (EP-01′ 23)** — 운반 항마다 좌표를 둔다. 한 자리의 항이 하나라도 열리면 그 자리는 닫히지 않은 것이다.

| 자리 | 위치 (① ② ③ 적중 줄) | 운반 항 → 좌표 |
|---|---|---|
| S1 | `shared/protocol.ts:765-768` (①765) | `confirmed` 운반 → T-boot-ask · `true`/부재만 → N-false |
| S2 | `shared/native-resources.ts:63-70` (①63·68) | 타입 전용. 요청·결과 값 → T-pre · T-boot-ask `toEqual(confirm)` |
| S3 | `preload/index.ts:294-297` (①4줄) | 요청·결과 통과 → T-pre |
| S4 | `renderer/shared/api/ipc.ts:223-225` (①3줄) | 요청·결과 통과 → T-pre |
| S5 | `useNativeMcpCatalog.ts:82-104` (①90·94·95·96 · ②93·96·97·98) | `confirmed` spread → T-hook-confirm · 판별 → T-hook-idle·T-hook-confirm · title/message(count)/labels → N-host · onConfirm `true` → N-host |
| S6 | `ExtensionsCatalogView.tsx:164` (②) | `nativeMcp.toggle` 그대로 전달 → N-host |
| S7 | `CustomizeList.tsx:116` (②) | 2인자(`confirmed` 부재) → T-list |
| S8 | `confirmDialogStore.ts:22-31` (②22·29·30) | request 저장·비움 → N-host |
| S9 | `ConfirmDialogHost.tsx:9-31` (②8줄) | title·message 렌더 · handleConfirm · onCancel · onClose · labels → N-host |
| S10 | `Modal.tsx:107-121` (②111·112·117·120) | 버튼 → onCancel·onConfirm · 라벨 → N-host |
| S11 | `ko.ts:623-628` · `en.ts:619-624` (①8줄) | 키·플레이스홀더 parity → T-res · `{{count}}` → N-host·N-host-en · en `_one`/`_other` → N-host-en · 제목·확정 라벨 → N-host·N-host-en |
| S12 | `extension-catalog.ts:19` (①) | `processes` port → T-ec · T-boot-* |
| S13 | `extension-catalog.ts:41-45` (①42·43·45) | 스키마 경유 등록 → T-boot-ask · N-false |
| S14 | `extension-catalog.ts:53-61` (①60) | 분기 → T-boot-oc · busy·confirmed 판정 → T-boot-ask · sessions → T-boot-ask · 저장→종료 순서 → T-boot-save · close 호출 → T-boot-idle · 동기 구간 → N-sync |
| S15 | `extension-catalog.ts:62-64` (①64) | 그 밖 분기 저장·종료 없음 → T-boot-oc |
| S16 | `bootstrap.ts:1236-1257` (①1236·1238·1244 · ③1251) | supervisor → T-boot-* · backendOf → T-boot-idle · activity → T-boot-ask · discardSession·방송 → T-boot-ask · failed·제목 → N-fail |
| S17 | `claude-processes.ts:35-61` (①35·57) | backend 필터·closing·dedupe·lease busy·runtime busy·busy 수 → T-cp |
| S18 | `claude-processes.ts:68-97` (①68·72·81·91) | 계획 입력 · dispatch · 실패 뒤 계속 → T-cp dispatch · N-fail |
| S19 | `session-activity-busy.ts:5-15` · `native-history.ts:7·9·30` (①2줄) | 8신호 → T-cp 신호 단독 · 재수출 → T-nh |
| S20 | `supervisor.ts:291-307` (①291·293·299) | lease 분기 · closing · child abort · close · 알림 → T-sup |
| S21 | `chat-turn/discard.ts:22-38` (①22·32) | residual 비움 · abort → discardRuntime 순서 · emit → T-discard |
| S22 | `chat-turn/index.ts:175-178` (①175·176) | sessionId → `post-turn.schedules.test.ts` discard 케이스 · 요청 창 emit → N-discard |
| S23 | `app-error.ts` 목록 · ko·en `errors.toast` (③ `app-error.ts:2` · 신설 3) | 제목 멤버 → N-fail · 문구 → N-titles |

**제외 줄**

- ① 16: import 9(`bootstrap.ts:82·83` · `chat-turn/index.ts:42` · `claude-processes.ts:5` · `extension-catalog.ts:6·11` · `preload/index.ts:10·11` · `renderer/shared/api/ipc.ts:11`) · 앱 종료 `bootstrap.ts:921`·`supervisor.ts:309` · 세션 삭제 hook `bootstrap.ts:1202` · Composer 중단 invoke `preload/index.ts:183`(0151 불변) · 채널 상수 `shared/ipc.ts:44·97` · port 타입 `discard.ts:15`.
- ② 22: import 2(`ConfirmDialogHost.tsx:2` · `useNativeMcpCatalog.ts:3`) · 다른 모달 onClose 6(`ExtensionsCatalogView.tsx:196·251·257·262·265·270`) · prop 분해·타입 8(`Modal.tsx:91-94·99-102`) · CustomizeList prop 2(`:29·42`) · store 주석·타입 4(`confirmDialogStore.ts:4·10·11·13`).
- 분모: EP-01′ 23 · G-DOC 3 · EP-10′ 29. 대체된 분모: ΔV1 EP-01 16.

## ΔV2-8. Gate

| Gate | 변경 | 증거 / 명령 |
|---|---|---|
| G-DOC (신규) | 문서 자리를 pair 분모에서 떼어 운영 gate로 둔다 | ④ 다섯 명령. 등록 변이 MD1 `adapters.md:69`에 옛 문장 복원 → 음성 1 · MD2 `IPC_CONTRACT.md:193`에서 `SetGlobalNativeResourceResult` 삭제 → 양성 0 |
| 관련 vitest | 대상 추가 | ΔV1 §19 목록 + `src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.interaction.test.ts`(이미 `features/skills`에 포함) |
| 나머지 | ΔV1 그대로 | lint · typecheck · doc-inventory · CI · trailer |

## ΔV2 정합성 검토

- ACTIVE 결정 ↔ AC: 충돌 0 — D-010↔AC10 · D-011↔AC2′ · D-007↔AC4′ 동기 구간 · D-003↔AC2′~AC4′.
- 같은 대상 대조: AC3′ "배경 클릭"과 S9 onClose·M22가 같은 배선을 가리킨다. AC10 "대상당 1회"와 `claude-processes.ts:89-95` try/catch가 일치한다.
- 인용 실재: 기존 좌표 14종을 `rg -F`로 확인했다(각 1파일). 신규 좌표는 테스트명이 계약이 아니라 진입·입력·관측이 계약이다.
- self-review(ΔV2):
  - CHANGED 노드 4개 각각 같은 레벨 REQUIRED pair가 있다. VP-R5′는 REGRESSION.
  - EP-01′ 23자리를 검색 ①②③ `aff17235` 출력으로 고정했고 제외 줄을 전수 적었다. 문서 3자리는 G-DOC로 옮겼다.
  - 자리마다 운반 항을 나눠 좌표를 붙였다. 신규 좌표 7건은 실행 구간에 해당 자리를 넣고 구별 값(N 1·2, 언어 ko·en, 버튼 3종, 대상 2 중 1 실패)을 준다.
  - verify r1 못 잡음 8건을 등록 변이 M14~M22로 올렸고 형제 자리 M23·M24를 더했다.
  - 사람 실기는 AC9 그대로다. 대화상자 문구·N·버튼 배선은 기계 검증으로 내렸다.
  - 신규 의존성 0. production 변경은 오류 제목 1개(3파일)다.

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰 (r1)

판정: plan을 계약대로 수행했다. `PLAN_GAP` 0 · 설계 대비 차이 3(아래 구현 보고) · 제품 결정 변경 0.

| 항목 | 판단 | 관측 |
|---|---|---|
| 동기 구간 | 성립 | `extension-catalog.ts:56-61` — `plan()`부터 `close()`까지 `await` 없음. `await`는 앞의 `read`와 뒤의 응답 조립뿐 |
| 저장→종료 순서 | 성립 | `extensionControl.setGlobal`은 저장 실패 시 동기 throw하고 메모리 값을 바꾸지 않는다(`extension-control.ts:17-21`) |
| 인용 기존 테스트 실재 | 3/3 | `post-turn.schedules.test.ts` discard 케이스 · `supervisor.test.ts:'active lease discard…'` · `preload/index.test.ts:'carries explicit…'` 모두 존재·통과 |
| residual 신호 입력 | plan §11 보강 필요 없음 | `residualCount`는 queue의 open 배치와 attempt id 교집합이라(`session-activity-projector.ts:213-215`) bootstrap 테스트는 실제 queue에 예약을 심어 만든다 |

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

| V-pair | 불변식 | §10이 적은 지점 | 닫은 수 / 전체 | 자리별 직접 oracle 좌표 | 이번 턴 관측값 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01~08·R1·R5 | Claude 플러그인 토글 = (동작 중이면 확인) → 저장 → 모든 Claude 프로세스 종료 | EP-01 P1~P16 | 13/16 | P1=`bootstrap.native-history.test.ts:'asks before closing busy Claude sessions…'`(confirmed 왕복, S1 red) · P2·P3·P4=`preload/index.test.ts:'carries explicit global extension scope…'`(confirm·applied 두 형상과 `confirmed` 운반) · P5=`useNativeMcpCatalog.test.ts` 신규 3건 · P6·P7·P8=bootstrap 신규 4건 · P9=`supervisor.test.ts:'discards a session-less lease…'` · P10=`chat-turn/discard.test.ts:'returns residual submissions…'`+`post-turn.schedules.test.ts` discard 케이스 · P14=`claude-processes.test.ts` 13건+bootstrap · P15=`claude-processes.test.ts:'counts %s alone…'`·`native-history.test.ts:'does not close or replace an occupied session'` · P16=`resources.test.ts:'ko↔en 리프 키 집합 일치'`·`'보간 플레이스홀더({{x}}) 일치'` | M1~M13·S1 전부 red(잠금 표) | P11·P12·P13 문서 3자리 — 문구 갱신은 `rg`로 관측(아래)했으나 내용을 red로 만드는 gate 좌표가 없다 |
| VP-R4 | Orca는 OpenCode 플러그인을 제어하지 않는다 | EP-10′ R1~R29 | 29/29 | `gate:` EP-10′ 음성 검색 · `ExtensionsCatalogView.interaction.test.ts:'shows OpenCode plugin rows as fixed native state and sends no toggle'` | 술어 0건 · `nativeFileMutations` 0건 · G01 삽입 시 1건 → 원복 0건 | 없음 |

- **자리 재계수(EP-01 ①):** 구현 후 같은 검색 → **28줄** = P1 1 · P2 1 · P3 3(`preload/index.ts:294·295·297`, 반환 타입 줄바꿈) · P4 3 · P5 1 · P6 1 · P7 2(`extension-catalog.ts:60·64`) · P8 1 · P9 1 · P10 3(`chat-turn/index.ts:175` · `discard.ts:15·32`, 본문 이동) · P11 1 + 제외 10(§10 목록과 같은 대상, 줄 번호만 이동 — `extension-catalog.ts:42·43` 등록 · `:6` import 포함).
- **차집합:** 분류 스크립트(`ep01.py`, 세션 scratchpad) → `search lines 28 classified 28 · unclassified [] · missing []`. 첫 실행에서 `:63`/`:64` 어긋남 1건을 잡아 고쳤다(lint의 줄바꿈 이동).
- **문서 자리(② · P11~P13):** `IPC_CONTRACT.md:193`에 `confirmed?: true`·`SetGlobalNativeResourceResult` 기재 · `:197`·`adapters.md:69` 새 문구 `rg` 2건. 옛 문구 "이미 실행 중인 Query는 자기 상태를 유지" 0건.
- **신설 3자리(③):** P14 `app/claude-processes.ts` · P15 `app/session-activity-busy.ts`+`native-history.ts:7-9` 재수출 · P16 `ko.ts`·`en.ts` `claudeClose*` 4키.
- **분모 검산:** EP-01 13 + 문서 3(남김) = 16 · EP-10′ 29.

### V-pair 자기확인 (r1)

| Pair | requiredness | 자기 상태 | 직접 oracle / 관측 | 선택 적대 증거 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | bootstrap `'closes every idle Claude process…'`: Claude 유휴 2(cwd A·B) close `[1,1]`, OpenCode 0, `applied`, 저장값 · renderer `'applies a Claude plugin change without a dialog…'`: 대화상자 null, 행 갱신 | M1·M2 red |
| VP-02 | REQUIRED | SELF_PASS | bootstrap `'asks before…'`: 대상 3·동작 중 2 → `sessions: 2`, close 0, 저장값 undefined · renderer `'confirms before…'`: 제목·본문(2)·라벨·취소 후 호출 1·변경 후 `confirmed:true` | M3·M4·M5·M6 red |
| VP-03 | REQUIRED | SELF_BLOCKED — 환경 | discard 단위·bootstrap `message.cancelled ['m-A']`·supervisor `'creates a new runtime after an idle runtime is discarded'`·`adapter.fork.test.ts` 통과. `adapter.native-plugins.test.ts:'persists both plugin states… cold resumes…'`는 이 환경(linux)에서 기준선과 같이 red — CI windows 대기 | M7 red |
| VP-04 | REQUIRED | SELF_PASS | bootstrap 4건 실제 supervisor·activity·queue · `'keeps every Claude process when the Claude plugin choice cannot be saved'`: reject·close 0·child 미중단 | M8·M9 red |
| VP-05 | REQUIRED | SELF_PASS | renderer `'never opens the Claude dialog for OpenCode MCP toggles'`: store null, 요청에 `confirmed` 없음 | not selected |
| VP-06 | REQUIRED | SELF_PASS | `claude-processes.test.ts`: 신호 11행 단독 → busy 1 · 복합 → 대상 4·busy 3(dedupe·backend 미기재 lease·closing·OpenCode 제외) · dispatch·실패 후 계속 | M10a~h·M11·M12 red |
| VP-07 | REQUIRED | SELF_PASS | supervisor `'discards a session-less lease…'`: abort·close 1·closing·알림 1 · 기존 `'active lease discard…'` 통과 | not selected |
| VP-08 | REQUIRED | SELF_PASS | `discard.test.ts`: residual 비움 → abort → discardRuntime → discardSubmitted 순서·emit ids `[m1,m2,m3]` · `post-turn.schedules` discard 통과 | not selected |
| VP-R1 | REGRESSION | SELF_PASS | bootstrap `'applies OpenCode MCP toggles without confirmation or closing any runtime'` · 0282 `restores global choices…` 통과 | M13 red |
| VP-R2 | REGRESSION | SELF_PASS | 0282 `applies nav plugin choices…`·`carries catalog changes…`·`applies current global plugin choices… live queries keep theirs` 통과 | not selected |
| VP-R3 | REGRESSION | SELF_PASS | 0282 `restores global choices through production Bootstrap…` 통과(응답 형상만 바뀜) | not selected |
| VP-R4 | REGRESSION | SELF_PASS | EP-10′ 0건 · view 고정 행 테스트 통과 | G01 잡음 |
| VP-R5 | REGRESSION | SELF_PASS | `discard.test.ts` · `pending-message-queue.test.ts` `discardSubmitted` describe 통과 | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

변이 실행: 아래 9 스위트(216케이스)에 변이 하나씩 심고 원복(스크립트 `mut.py`, 세션 scratchpad). 원복 후 `git diff` 변이 잔여 0.

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 |
|---|---|---|---|---|---|
| M1 | `extension-catalog.ts:61` | 제거 | `processes.close(plan.targets)` 삭제 | 잡음(3) | bootstrap `closes every idle…`·`asks before…` · `extension-catalog.test.ts` |
| M2 | `claude-processes.ts` lease·runtime 필터 | 맞바꿈 | `'claude'` → `'opencode'` 2곳 | 잡음(15) | bootstrap 2 · `claude-processes.test.ts` 다수 |
| M3 | `extension-catalog.ts:57` | 제거 | `&& !request.confirmed` 삭제 | 잡음(2) | bootstrap `asks before…`·`keeps every…` |
| M4 | 같은 줄 | 다른 값 | `busy > 0` → `busy >= 0` | 잡음(5) | bootstrap `closes every idle…` 외 0282 3건 |
| M5 | `useNativeMcpCatalog.ts` 요청 | 제거 | `confirmed` 전달 삭제 | 잡음(1) | `confirms before closing busy Claude sessions…` |
| M6 | `extension-catalog.ts:58` | 다른 값 | `sessions: plan.targets.length` | 잡음(1) | bootstrap `asks before…` |
| M7 | `discard.ts` emit | 제거 | `message.cancelled` emit 삭제 | 잡음(2) | `discard.test.ts` · bootstrap `asks before…` |
| M8 | `bootstrap.ts` activity 주입 | 고정값 | 항상 유휴 snapshot | 잡음(1) | bootstrap `asks before…` |
| M9 | `extension-catalog.ts:60-61` | 뒤집기 | close를 저장 앞으로 | 잡음(1) | bootstrap `keeps every Claude process…` |
| M10a~h | `session-activity-busy.ts` 8신호 | 제거 | 신호 하나씩 삭제(8회) | 8/8 잡음(각 2~4) | `claude-processes.test.ts:'counts <신호> alone…'` · `native-history.test.ts:'does not close or replace an occupied session'` |
| M11 | `claude-processes.ts` lease 대상 | 다른 값 | lease `busy: true` → `false` | 잡음(4) | `counts lease alone…`·복합·dispatch · bootstrap `asks before…` |
| M12 | `claude-processes.ts` runtime | 제거 | `responding` 신호 삭제 | 잡음(2) | `counts responding alone…`·dispatch |
| M13 | `extension-catalog.ts:53` | 고정값 | Claude 플러그인 조건 → `true` | 잡음(1) | bootstrap `applies OpenCode MCP toggles…` |
| G01 | `opencode/v1/global-plugins.ts:1` | 제거의 역 | `nativeFileMutations` import 재삽입 | 잡음 | EP-10′ 음성 검색 0 → 1 → 원복 0 |
| S1 | `protocol.ts:767` | 빈 값 | 스키마가 `confirmed`를 버림(`transform(() => undefined)`) | 잡음(2) | bootstrap `asks before…`·`keeps every…` |

- 검산: 선택 증거 21(M1~M9 9 · M10 8 · M11~M13 3 · G01 1) · 인용 변이 0(파생 이슈 없음) · 새 oracle 1(S1 — 스키마 edge 민감도) = 실행 변이 22(표 15행, M10a~h 8회를 한 행). 잡음 22 · 못 잡음 0 · 동치 0.
- 덮개 회귀: 이전 라운드 없음 — 해당 없음.

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판단 | 관측 |
|---|---|---|
| 새 문구에 소비자가 있는가 | 있음 | `claudeClose*` 4키 → `openConfirmDialog` → 공용 `ConfirmDialogHost`. ko `_one`/`_other` 같은 문장, en 단·복수 문장 분리 |
| 실패가 "아무 일도 안 일어남"인가 | 아님 | 저장 실패 → 기존 `skills.native.toggle-failed` 토스트(`reports a choice write failure once…` 통과) · 종료 일부 실패 → main `reportError` |
| 늦은 응답이 화면을 되돌리는가 | 아님 | `confirm` 응답은 행을 바꾸지 않고, `applied`만 기존 version 검사로 반영 |
| [변경]이 그 사이 바뀐 행을 쓰는가 | 대화상자를 연 시점의 `resource`로 재요청 — 목표 값(`!enabled`)은 사용자가 누른 값 그대로 | `onConfirm: () => void toggle(backend, resource, true)` |
| 상태표 7행 | 전부 경로 있음 | 유휴만(AC1) · 동작 중(AC2) · 취소(AC3) · 변경(AC4) · 다음 메시지(AC6) · 저장 실패(AC8) · OpenCode(AC7) |
| 파생 — 범위 밖, 결정권자 몫 | 보고만 | ① 종료 일부 실패 토스트 제목이 `saveFailed` — 저장은 성공했는데 "저장 실패"로 읽힌다. ② 대화상자 확정 버튼이 `danger` 스타일이 아니다(r1 패턴 그대로). 응답 중단을 승인하는 동작이라 빨간 버튼 여부는 제품 결정 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| 문제 | 처리 | 근거 |
|---|---|---|
| DB 행이 없는 유휴 runtime은 backend를 알 수 없어 닫지 않는다 | 보고만 | `backendOf`가 `undefined` → 대상 아님(`claude-processes.ts`). 세션 삭제 hook이 먼저 `discardRuntime`하므로(`bootstrap.ts:1202`) 실제로는 드묾 |
| closing lease의 runtime 항목을 다시 세면 N이 부풀고 이미 닫히는 세션을 두 번 닫는다 | 선조치 | lease 세션 ID를 먼저 `seen`에 넣어 runtime 항목에서 뺐다. 복합 테스트의 `claude-closing`(responding true)이 대상·N에서 빠짐을 단언 |
| `discardRuntime` lease 분기를 `discardLease`로 옮기며 알림 키 | 동작 불변 | 알림 키를 closing 전 `logicalKey`로 고정. 기존 `'active lease discard…'` 통과 |
| 다중 저장소 쓰기(설정 → 프로세스) | plan §13대로 | 저장 실패 시 종료 0(AC8, M9 red) |
| 동시성: 판정 후 새 턴 | 동기 구간 | plan·close 사이 `await` 0(설계 리뷰 1행) |

## [구현자 기입] 구현 보고 (r1)

- 구현 주체: Claude(사용자가 `/handoff-impl 283`으로 직접 요청). 대상 커밋: `(r1 구현 — 좌표는 INDEX)`.
- 설계 대비 차이 3:
  1. **테스트 이름 분할** — plan의 `'counts each busy signal once and ignores idle Claude, OpenCode and closing entries'`(신호 표 포함)를 신호 단독 표 `it.each('counts %s alone as one busy Claude session')` 11행과 같은 이름의 복합 테스트로 나눴다. 만료·공유·재진입 축 해당 없음(테스트 구성만 다름).
  2. **closing lease 제외 범위** — §11 ②의 "남은 runtime 항목"에서 closing lease의 세션도 뺐다(위 잠재 문제 2행).
  3. **en 문구** — plan의 "session is (sessions are)"를 `_one`·`_other` 두 문장으로 나눴다.
- AC 표:

| AC | 결과 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | bootstrap `'closes every idle Claude process…'` close `[1,1,0]`·`applied`·저장값 |
| AC2 | ✅ | bootstrap `sessions: 2`·close 0 · renderer store 제목·`claudeCloseBody(2)`·라벨 |
| AC3 | ✅ | renderer 취소 뒤 호출 1·행 `enabled: true` 유지 |
| AC4 | ✅ | renderer 3번째 호출 `confirmed: true`·행 갱신 · bootstrap child abort·close `[1,1,1,0,0]`·`message.cancelled ['m-A']` |
| AC5 | ✅ | `claude-processes.test.ts` 신호 11행 단독 busy 1 · 무신호 유휴 |
| AC6 | ⚠️ | supervisor discard 뒤 factory 1회 · `adapter.fork` resume 통과. cold resume flag 좌표는 linux에서 기준선과 같이 red — CI windows 대기 |
| AC7 | ✅ | bootstrap OpenCode MCP 토글 close 0·`applied` |
| AC8 | ✅ | bootstrap 저장 throw → reject·close 0 |
| AC9 | ⚠️ | 사람 실기(Windows) 대기 |

- 검산: ✅ 7 · ⚠️ 2 · ❌ 0 = 총 9.
- 관측한 게이트 산출:
  - `npm run lint`: 0 error · 2 warning(`react-hooks/incompatible-library`, 이번 변경 밖 파일).
  - `npm run typecheck`: `error TS` 0건(3구성).
  - §19 vitest 집합: 134파일 1509케이스 중 8 red — 전부 `adapters/claude/{adapter.native-plugins,native-resources,project-reconciliation}.test.ts`, `git stash` 기준선에서도 같은 8건(Windows 전용 동작, "이 플러그인은 프로젝트별 제어를 지원하지 않습니다").
  - 전체 `vitest run`: 830파일 7995케이스 중 17 red = 위 8 + `opencode/v1/adapter{.instances,}.test.ts`·`composer-catalog.test.ts` 9(`C:/` 경로 전제). 기준선에서도 9건 동일. 환경: `node node_modules/electron/install.js` + `npm rebuild better-sqlite3`로 DB 스위트까지 실행.
  - `node scripts/check-doc-inventory.mjs --check`: generated·prose·links ok.
  - EP-10′ 음성 검색: 0건.

## [구현자 기입] Review Signals — 사실만 (r1)

- 라운드·라벨: 1라운드 `r1`(첫 impl 턴).
- 이전 라운드와 같은 축: 해당 없음(첫 구현).
- plan 지침: §11 ②가 closing lease의 runtime 항목 처리를 명시하지 않았다 — 구현에서 제외로 정했고 테스트로 고정했다.
- 반복 환경 한계: Windows 전용 Claude 플러그인 스위트와 `C:/` 경로 스위트가 linux에서 기준선 red(17건). AC6의 cold resume flag 좌표가 그중 하나라 CI windows가 필요하다.

---


## [구현자 기입] 설계 리뷰 (r2)

판정: ΔV2를 수행했다. 기준 V는 `0282@28d25d35 + 0283 ΔV1 + ΔV2`, 선택 집합은 REQUIRED 8 + REGRESSION 5다. 규범 행 변경·신규 의존성·남은 PLAN_GAP은 없다.

| 항목 | 판단 | 이번 턴 관측 |
|---|---|---|
| D1~D5의 공통 불변식 | 결과를 운반하는 각 항을 실제 소비 경로에서 관측한다 | N-sync·N-false·N-host·N-host-en·N-fail·N-discard 실행, 인용 X1·X18·X19·X20·X25·X27·X29·X30 검출 |
| G1 | 설계 정정 적용 | 문서 3자리는 G-DOC로 검사, MD1 옛 문장 복원·MD2 응답 타입 삭제 모두 검출 |
| G2 | 설계 정정 적용 | view→CustomizeList→hook→실제 confirm store→host→ModalActions 진입, M20~M24 검출 |
| D-010·D-011 | 사용자 결정 반영 | N-fail에서 전용 제목 1회, N-host에서 `danger` 미지정과 [변경] 확인 |
| 테스트 환경 대체 | 구현 세부 | 기존 fake DOM의 React hooks와 Zustand React binding만 대체. `createStore`·initializer·action·subscribe·host·Modal은 실제 코드 |

## [구현자 기입] 강제 지점 전수 (§10 대조) (r2)

좌표 약어는 ΔV2-5 좌표 표를 따른다. 아래 각 행은 이번 최종 gate 실행 집합에 포함됐다.

| V-pair | 불변식 | §10이 적은 지점 | 닫은 수 / 전체 | 자리별 직접 oracle 좌표 | 이번 턴 관측값 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01′·02′ | 확인 계약 운반·검증 | S1~S4 | 4/4 | S1=N-false·T-boot-ask; S2~S4=T-pre | false reject·plan/save/close 0, true applied; preload confirmed·confirm/applied 왕복 | 없음 |
| VP-01′·02′·05′ | 요청·확인·취소의 실제 배선 | S5~S10 | 6/6 | S5=T-hook-confirm·N-host; S6=N-host; S7=T-list; S8~S10=N-host | 최초 confirmed 부재, 취소/배경 뒤 write 1/2, 확정 뒤 write 4·confirmed true·행 off | 없음 |
| VP-02′·05′ | 언어별 수·라벨 | S11 | 1/1 | N-host·N-host-en·T-res | ko 2개, en 단수 1·복수 2; M16 4자리·M17 검출 | 없음 |
| VP-01′·02′·04′·R1 | port·스키마·분기·저장/종료 동기 순서 | S12~S15 | 4/4 | S12=T-ec·T-boot-*; S13=N-false; S14=N-sync·T-boot-idle/ask/save; S15=T-boot-oc | `[plan,save,close,intruder]`, 저장 throw 시 close 0, OpenCode close 0 | 없음 |
| VP-01′·04′·06 | 대상·조립·실패 격리 | S16~S18 | 3/3 | S16=T-boot-*·N-fail; S17=T-cp; S18=T-cp dispatch·N-fail | 대상 3·busy 2, backend/activity/discard/failed 변이 검출, 첫 close 실패 뒤 두 번째 close 1 | 없음 |
| VP-06·07 | activity 판정·lease 폐기 | S19~S20 | 2/2 | S19=T-cp 신호 단독·T-nh; S20=T-sup | 신호 제거 M10a~h·M11a/b·M12, 재수출 X21, abort/알림 X15~17 검출 | 없음 |
| VP-03·08·R5′ | 중단·초안 복원·요청 창 전달 | S21~S22 | 2/2 | S21=T-discard; S22=N-discard·post-turn discard 케이스 | residual 비움→abort→discardRuntime→submitted, owner에 message.cancelled 1회 | 없음 |
| VP-01′·04′ | 종료 실패 제목 | S23 | 1/1 | N-fail·N-titles | publish 1회·전용 제목, APP_ERROR_TITLES×ko/en 비어 있지 않은 문구·번역 일치 | 없음 |
| VP-R4 | OpenCode 플러그인 제어 부재 | EP-10′ R1~R29 | 29/29 | EP-10′ 음성 검색·view `shows OpenCode plugin rows as fixed native state and sends no toggle` | 검색 0→G01 import 1→원복 0; 고정 행 클릭 write 0 | 없음 |
| 운영 G-DOC | 현재 문서 계약 | D1~D3 | 3/3 | ΔV2-7 검색 ④ 다섯 명령 | `[0,1,1,1,1]`; MD1 `[1,1,1,1,1]`, MD2 `[0,0,1,1,1]`, 원복 | 없음 |

- 자리 재계수: ① 62줄(제외 16), ② 43줄(제외 22). 고정 목록에 분류되지 않은 적중·누락 제외 좌표 모두 `[]`; 설계 기준선과 줄 번호를 제외한 적중 내용의 양방향 차집합도 `[]`.
- ③ 실패 제목 검색은 `app-error.ts`·bootstrap·ko·en에서 제목 4자리와 기존 목록/event 선언을 확인했다. S23은 N-titles·N-fail 좌표로 닫았다.
- 분모 검산: EP-01′ 23/23 + EP-10′ 29/29, 별도 운영 G-DOC 3/3. ΔV1의 문서 포함 16자리와 직접 합산하지 않는다.

### V-pair 자기확인 (r2)

| Pair | requiredness | 자기 상태 | 직접 oracle / 관측 | 선택 적대 증거 |
|---|---|---|---|---|
| VP-01′ | REQUIRED | SELF_PASS | T-list·T-hook-idle·T-pre·T-boot-idle·N-fail·VP-03: close [1,1,0], applied, 새 Query | M1·M2a/b·M24 검출 |
| VP-02′ | REQUIRED | SELF_PASS | T-boot-ask·N-host·N-host-en·N-sync·N-false·T-pre: busy 2, confirmed true 왕복, 실제 버튼 | M3~M6·M14a/b·M15·M23 검출 |
| VP-03 | REQUIRED | SELF_PASS | T-discard·T-boot-ask·supervisor `creates a new runtime after an idle runtime is discarded`·adapter cold resume/fork | M7 검출 |
| VP-04′ | REQUIRED | SELF_PASS | T-boot-*·N-fail: backend/activity/discard/report 조립, 저장 실패 close 0 | M8·M9·M18·M18b 검출 |
| VP-05′ | REQUIRED | SELF_PASS | N-host·N-host-en·T-hook-confirm/oc·T-list: store와 host 실제 실행 | M5a/b·M16 4곳·M17·M20~22 검출 |
| VP-06 | REQUIRED | SELF_PASS | T-cp 신호 단독·복합·dispatch·T-nh | M10a~h·M11a/b·M12 검출 |
| VP-07 | REQUIRED | SELF_PASS | T-sup session-less lease·active lease: child abort, runtime close 1, 알림 | 직접 oracle; X15~17 회귀 검출 |
| VP-08 | REQUIRED | SELF_PASS | T-discard·post-turn discard: 복원 ids·중단 순서 | 직접 oracle; X14 회귀 검출 |
| VP-R1 | REGRESSION | SELF_PASS | T-boot-oc·`restores global choices through production Bootstrap…`: OpenCode 종료 0 | M13 검출 |
| VP-R2 | REGRESSION | SELF_PASS | `applies nav plugin choices…`·`carries catalog changes…`·`applies current global plugin choices…`: 새 Query flag | not selected — 기존 행동 좌표 재실행 |
| VP-R3 | REGRESSION | SELF_PASS | `restores global choices through production Bootstrap…`: 저장 후 재시작 복원 | not selected — 기존 행동 좌표 재실행 |
| VP-R4 | REGRESSION | SELF_PASS | EP-10′ 0건·view 고정 행 | G01 검출 |
| VP-R5′ | REGRESSION | SELF_PASS | N-discard·T-discard·pending-message-queue `discardSubmitted`: 요청 owner 복원 | M19 검출 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

판정: 등록·인용·기존 회귀 변이를 한 번에 하나씩 심었다. 각 실행은 표의 테스트 파일 집합만 사용했고 assertion 실패를 확인한 뒤 원본 바이트를 복구했다. 코드·문서 고장 주입 62회 중 검출 61, 동치 1(P0), 미해결 미검출 0이다.

| ID | 자리 | 종류 / 바꾼 내용 | 결과 | 잡은 테스트 / 관측 |
|---|---|---|---|---|
| M1 | `app/handlers/extension-catalog.ts` | 종료 호출 제거 | 잡음 5/22 | `Claude plugin toggle closes running Claude processes closes every idle Claude process on a Claude…` |
| M2a | `app/claude-processes.ts` | lease backend 맞바꿈 | 잡음 3/13 | `planClaudeProcesses counts lease alone as one busy Claude session` |
| M2b | `app/claude-processes.ts` | runtime backend 맞바꿈 | 잡음 12/13 | `planClaudeProcesses counts responding alone as one busy Claude session` |
| M3 | `app/handlers/extension-catalog.ts` | confirmed 조건 제거 | 잡음 2/18 | `Claude plugin toggle closes running Claude processes asks before closing busy Claude sessions and…` |
| M4 | `app/handlers/extension-catalog.ts` | busy >= 0 | 잡음 5/18 | `carries catalog changes through the real bootstrap registry into every new SDK query` |
| M5a | `features/skills/hooks/useNativeMcpCatalog.ts` | confirmed 요청 항 제거 | 잡음 2/15 | `confirms before closing busy Claude sessions and applies only after the change is confirmed` |
| M5b | `features/skills/hooks/useNativeMcpCatalog.ts` | onConfirm true 제거 | 잡음 2/15 | `confirms before closing busy Claude sessions and applies only after the change is confirmed` |
| M6 | `app/handlers/extension-catalog.ts` | sessions를 전체 대상 수로 | 잡음 1/18 | `Claude plugin toggle closes running Claude processes asks before closing busy Claude sessions and…` |
| M7 | `app/chat-turn/discard.ts` | 복원 emit 제거 | 잡음 2/19 | `Claude plugin toggle closes running Claude processes asks before closing busy Claude sessions and…` |
| P0-residual-only | `app/bootstrap.ts` | 조립 activity의 residualCount만 0 | 동치 — green 18/18 | 아래 P0 근거 |
| M8 | `app/bootstrap.ts` | activity를 항상 유휴로 | 잡음 1/18 | `Claude plugin toggle closes running Claude processes asks before closing busy Claude sessions and…` |
| M9 | `app/handlers/extension-catalog.ts` | 종료를 저장 앞으로 | 잡음 1/18 | `Claude plugin toggle closes running Claude processes keeps every Claude process when the Claude p…` |
| M10a | `app/session-activity-busy.ts` | 신호 하나 제거 | 잡음 4/33 | `planClaudeProcesses counts foreground preparing alone as one busy Claude session` |
| M10b | `app/session-activity-busy.ts` | 신호 하나 제거 | 잡음 2/33 | `planClaudeProcesses counts transport listening alone as one busy Claude session` |
| M10c | `app/session-activity-busy.ts` | 신호 하나 제거 | 잡음 2/33 | `planClaudeProcesses counts queued alone as one busy Claude session` |
| M10d | `app/session-activity-busy.ts` | 신호 하나 제거 | 잡음 2/33 | `planClaudeProcesses counts delivery pending alone as one busy Claude session` |
| M10e | `app/session-activity-busy.ts` | 신호 하나 제거 | 잡음 2/33 | `planClaudeProcesses counts residual alone as one busy Claude session` |
| M10f | `app/session-activity-busy.ts` | 신호 하나 제거 | 잡음 2/33 | `planClaudeProcesses counts background task alone as one busy Claude session` |
| M10g | `app/session-activity-busy.ts` | 신호 하나 제거 | 잡음 2/33 | `planClaudeProcesses counts pending session wakeup alone as one busy Claude session` |
| M10h | `app/session-activity-busy.ts` | 신호 하나 제거 | 잡음 2/33 | `planClaudeProcesses counts session schedules alone as one busy Claude session` |
| M11a | `app/claude-processes.ts` | 세션 lease busy false | 잡음 2/13 | `planClaudeProcesses counts lease alone as one busy Claude session` |
| M11b | `app/claude-processes.ts` | 세션 없는 lease busy false | 잡음 2/13 | `planClaudeProcesses counts each busy signal once and ignores idle Claude, OpenCode and closing en…` |
| M12 | `app/claude-processes.ts` | responding 제거 | 잡음 2/13 | `planClaudeProcesses counts responding alone as one busy Claude session` |
| M13 | `app/handlers/extension-catalog.ts` | Claude 분기 true | 잡음 1/18 | `Claude plugin toggle closes running Claude processes applies OpenCode MCP toggles without confirm…` |
| S1 | `shared/protocol.ts` | confirmed를 undefined로 | 잡음 2/18 | `Claude plugin toggle closes running Claude processes asks before closing busy Claude sessions and…` |
| M14a_X25 | `app/handlers/extension-catalog.ts` | plan 뒤 await 삽입 | 잡음 1/4 | `saves and closes in the same synchronous section as the busy check` |
| M14b | `app/handlers/extension-catalog.ts` | save 뒤 await 삽입 | 잡음 1/4 | `saves and closes in the same synchronous section as the busy check` |
| M15_X18 | `shared/protocol.ts` | literal(true)→boolean | 잡음 1/4 | `rejects confirmed: false before planning or saving` |
| M16_ko_one | `shared/i18n/resources/ko.ts` | 해당 locale·복수형 count 제거 | 잡음 1/14 | `i18n resources 보간 플레이스홀더({{x}}) 일치` |
| M16_ko_other | `shared/i18n/resources/ko.ts` | 해당 locale·복수형 count 제거 | 잡음 2/14 | `i18n resources 보간 플레이스홀더({{x}}) 일치` |
| M16_en_one | `shared/i18n/resources/en.ts` | 해당 locale·복수형 count 제거 | 잡음 2/14 | `i18n resources 보간 플레이스홀더({{x}}) 일치` |
| M16_en_other | `shared/i18n/resources/en.ts` | 해당 locale·복수형 count 제거 | 잡음 2/14 | `i18n resources 보간 플레이스홀더({{x}}) 일치` |
| M17_X19 | `shared/i18n/resources/en.ts` | en 단수/복수 맞바꿈 | 잡음 1/9 | `renders the Claude close dialog in English with singular and plural counts` |
| M18_X1 | `app/bootstrap.ts` | failed no-op | 잡음 1/18 | `Claude plugin toggle closes running Claude processes keeps closing Claude processes after one clo…` |
| M18b | `app/bootstrap.ts` | 제목 saveFailed | 잡음 1/18 | `Claude plugin toggle closes running Claude processes keeps closing Claude processes after one clo…` |
| M19_X27 | `app/chat-turn/index.ts` | 요청 창 emit no-op | 잡음 1/31 | `0243 interruption delivery through real runtime and handlers returns residual submissions to the …` |
| M20_X29 | `shared/ui/ConfirmDialogHost.tsx` | onConfirm 제거 | 잡음 1/9 | `confirms a busy Claude plugin change through the shared dialog` |
| M21_X30 | `shared/ui/ConfirmDialogHost.tsx` | 취소→확정 | 잡음 2/9 | `confirms a busy Claude plugin change through the shared dialog` |
| M22 | `shared/ui/ConfirmDialogHost.tsx` | 배경→확정 | 잡음 1/9 | `confirms a busy Claude plugin change through the shared dialog` |
| M23 | `features/skills/components/customize/ExtensionsCatalogView.tsx` | view가 confirmed true 전달 | 잡음 2/9 | `confirms a busy Claude plugin change through the shared dialog` |
| M24 | `features/skills/components/customize/CustomizeList.tsx` | list가 세 번째 인자 true 전달 | 잡음 1/6 | `renders native plugin capabilities and updates the actual row through its toggle` |
| X2 | `app/bootstrap.ts` | backendOf 항상 claude | 잡음 2/18 | `Claude plugin toggle closes running Claude processes closes every idle Claude process on a Claude…` |
| X3 | `app/bootstrap.ts` | 방송 no-op | 잡음 1/18 | `Claude plugin toggle closes running Claude processes asks before closing busy Claude sessions and…` |
| X4 | `app/bootstrap.ts` | discardSession→discardRuntime | 잡음 1/18 | `Claude plugin toggle closes running Claude processes asks before closing busy Claude sessions and…` |
| X5 | `app/claude-processes.ts` | dispatch 조건 반전 | 잡음 1/13 | `createClaudeProcessReset dispatches session targets to session discard and session-less leases to…` |
| X6 | `app/claude-processes.ts` | closing 제외 제거 | 잡음 1/13 | `planClaudeProcesses counts each busy signal once and ignores idle Claude, OpenCode and closing en…` |
| X7 | `app/claude-processes.ts` | seen 등록 제거 | 잡음 2/13 | `planClaudeProcesses counts lease alone as one busy Claude session` |
| X8 | `app/claude-processes.ts` | busy=전체 대상 수 | 잡음 2/13 | `planClaudeProcesses counts each busy signal once and ignores idle Claude, OpenCode and closing en…` |
| X9 | `app/claude-processes.ts` | 보고 대신 throw | 잡음 1/13 | `createClaudeProcessReset dispatches session targets to session discard and session-less leases to…` |
| X10 | `features/skills/hooks/useNativeMcpCatalog.ts` | hook 제목/본문 맞바꿈 | 잡음 1/6 | `confirms before closing busy Claude sessions and applies only after the change is confirmed` |
| X11 | `features/skills/hooks/useNativeMcpCatalog.ts` | 확정/취소 라벨 맞바꿈 | 잡음 1/6 | `confirms before closing busy Claude sessions and applies only after the change is confirmed` |
| X12 | `features/skills/hooks/useNativeMcpCatalog.ts` | count=1 | 잡음 3/15 | `confirms before closing busy Claude sessions and applies only after the change is confirmed` |
| X14 | `app/chat-turn/discard.ts` | abort/discard 순서 반전 | 잡음 1/1 | `returns residual submissions, aborts the turn and discards the runtime` |
| X15 | `features/sessions/supervisor.ts` | emitLease 제거 | 잡음 1/21 | `RuntimeSupervisor resource governance (0055) discards a session-less lease by aborting its child …` |
| X16 | `features/sessions/supervisor.ts` | child abort 제거 | 잡음 2/21 | `RuntimeSupervisor resource governance (0055) active lease discard는 child를 abort하고 runtime을 닫은 채 신…` |
| X17 | `features/sessions/supervisor.ts` | lease 분기 제거 | 잡음 2/39 | `Claude plugin toggle closes running Claude processes asks before closing busy Claude sessions and…` |
| X21 | `app/native-history.ts` | nativeHistoryBusy 항상 false | 잡음 9/20 | `native history composition does not close or replace an occupied session: {"foreground":"preparing"}` |
| X20 | `shared/i18n/resources/ko.ts, shared/i18n/resources/en.ts` | ko/en 본문 네 곳 count 동시 제거 | 잡음 2/9 | `confirms a busy Claude plugin change through the shared dialog` |
| K1-host-slots | `shared/ui/ConfirmDialogHost.tsx` | host 제목/본문 슬롯 맞바꿈 | 잡음 2/9 | `confirms a busy Claude plugin change through the shared dialog` |
| G01 | `opencode/v1/global-plugins.ts` | nativeFileMutations import 삽입 | 잡음 | EP-10′ 0→1→원복 0 |
| MD1 | `docs/arch/backend/adapters.md` | 옛 Query 유지 문장 복원 | 잡음 | G-DOC 음성 0→1→원복 0 |
| MD2 | `docs/IPC_CONTRACT.md` | 결과 타입 이름 삭제 | 잡음 | G-DOC 양성 1→0→원복 1 |

- P0 동치 근거: `pending-message-queue.ts:421-437`의 residual 메시지 집합은 deliveryPending의 open 배치 부분집합이다. production projector가 만드는 snapshot은 residual>0이면 deliveryPending>0이므로 residual만 0으로 바꿔도 동작 중 boolean은 같다; bootstrap 18/18 green으로 확인했다. 전체 activity 유휴 변이 M8은 red이고 순수 함수의 residual 단독 입력 M10e도 red다.
- r1 미검출 8건: X1→M18, X18→M15, X19→M17, X20→동명 동시 제거, X25→M14a, X27→M19, X29→M20, X30→M21. 모두 이번에 assertion red다.
- r1 검출 41건은 M1~M13 자리별·S1·G01 및 X2~X17·X21의 해당 행으로 재실행했다. 덮개 회귀 0; 동일 관측을 인용 ID와 등록 ID로 중복 집계하지 않는다.
- 잠금 분모: 선택 증거 43(ΔV1 24+G01, ΔV2 16+MD1/MD2) · 중복 제거 후 인용/기존 회귀 17(r1 검출 X 16+동시 X20) · 새 슬롯 oracle 1(K1) = 필수 61행. 별도 동치 탐침 P0 1행을 더해 실제 표 62행이며 검출 61·동치 1이다.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판단 | 이번 턴 관측 |
|---|---|---|
| 실패 문구의 소비자 | 전용 제목으로 도달 | N-fail publish `claudeSessionsCloseFailed` 1회, N-titles ko/en 정확한 문구 |
| [취소]/배경 닫기 | 선택 불변 | N-host 각각 write 1/2 유지·스위치 on·dialog null |
| [변경] | 확인 재요청 후 적용 | N-host write 4번째 confirmed true·스위치 off·dialog null |
| 다국어·버튼 | 기존 공용 UI 재사용 | ConfirmDialogHost·ModalActions 실제 렌더, ko 2·en 1/2, danger 미지정 |
| 늦은 응답·없는 DB 행 | 기존 N3·N4 유지 | 이번 production diff는 제목만 변경; 해당 정책 변경 없음 |
| 시각 인수 | 미확인 | AC9 실제 Windows /context·white/dark는 사람 실기 대기 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| 문제 | 처리 | 근거 |
|---|---|---|
| fake DOM에서 Zustand 기본 React binding은 렌더되지 않음 | 선조치 — 기존 테스트 패턴 적용 | 실제 createStore에 fake useSyncExternalStore만 연결; 최초 실행 useCallback 오류 뒤 N-host green |
| 제목/본문을 전체 dialog 텍스트로만 보면 host 슬롯 맞바꿈을 구별 못함 | 선조치 | 제목 span·본문 p를 따로 관측, K1-host-slots 2 assertion red |
| ko `_one`은 실행 언어에서 선택되지 않음 | 역할 구분 | ko one count 제거는 T-res parity로, 실제 ko other/en one/other는 host로 검출 |
| 로컬 문서 gate가 임시 외부 저장소까지 순회 | 환경 분리 | .tmp/opencode-dev·app/.temp/opencode의 기존 링크 10건, Git 추적 사본+현재 변경에서는 inventory/prose/links green |
| residual-only 탐침이 green | 동치 판정 | P0 코드 부분집합 근거·18/18 확인, 위 잠금 표 참조 |

## [구현자 기입] 구현 보고 (r2)

구현 주체는 Codex다. production 변경은 오류 제목 목록·bootstrap 보고·ko/en 문구이며, 신규 행동 테스트 7건을 기존 5파일에 추가했다. 설계 대비 차이는 테스트 환경의 Zustand binding 대체와 host 슬롯 구별 단언 보강뿐이다(만료·공유·재진입 정책 변경 없음).

| AC | 결과 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | T-boot-idle close [1,1,0]·applied·저장값 |
| AC2′ | ✅ | T-boot-ask sessions 2, N-host ko 2·N-host-en 단수/복수·라벨·danger 미지정 |
| AC3′ | ✅ | N-host 취소·배경 클릭 각각 IPC 증가 없음·행 on |
| AC4′ | ✅ | N-host confirmed true·행 off, N-false false reject, N-sync 동기 순서, T-boot-ask abort·복원 |
| AC5 | ✅ | T-cp 11 단독 입력·복합·M10a~h/M11a/b/M12 검출 |
| AC6 | ✅ | supervisor 새 factory·adapter cold resume flag/fork 테스트, Windows 실행 |
| AC7 | ✅ | T-boot-oc applied·모든 close 0 |
| AC8 | ✅ | T-boot-save throw·close 0 |
| AC9 | ⚠️ | 실제 CLI /context·white/dark 사람 실기 대기 |
| AC10 | ✅ | N-fail 첫 close throw·둘째 close 1·applied·전용 제목 publish 1·저장값 |

합계: ✅ 9 · ⚠️ 1 · ❌ 0 = 총 10. ΔV1 총 9에서 ΔV2 AC10이 추가됐다.

| 운영 gate | 관측 산출 |
|---|---|
| lint | 0 error · 기존 incompatible-library warning 2건. autofix 변경은 host 테스트 줄바꿈뿐 |
| typecheck | node/web/test 3구성 통과 · error TS 0 |
| 관련 vitest | 134파일 1,516케이스 통과(파일·테스트 ID로 두 실행 병합). plain Node 1,490 pass·19 fail·7 pending은 SQLite ABI 140/127 차이; 해당 DB 7파일은 Electron Node 모드 28/28 통과로 대체 |
| doc-inventory | 추적 사본+현재 변경 generated/prose/links 통과; 작업 폴더 외부 임시 자료 10링크는 환경 한계 |
| test-budgets·migration | 16 real-git suites, migration sync/no-copies/append-only 통과 |
| EP-10′·G-DOC | 0건·[0,1,1,1,1], G01·MD1·MD2 검출 후 원복 |
| CI gate | PR [#512](https://github.com/muzaby/orca-skin/pull/512)의 구현 push에서 실행. 원격 결과는 PR Checks가 정본 |
| 메시지 버스 | INDEX impl/IMPL_DONE·다음 Claude, plan 메타 일치. 커밋 후 `git log -1 --format='%(trailers:only=true)'`로 trailer 검산 |

- 최종 실행: ΔV1 §19 vitest 목록에 `src/main/features/chat/pending-message-queue.test.ts`를 더하고 `--maxWorkers=4`로 실행했다.
- DB 재실행: `ELECTRON_RUN_AS_NODE=1`에서 `electron.exe node_modules/vitest/vitest.mjs run --maxWorkers=1`을 사용했다. 대상은 `chat-turn.continuity.test.ts`와 `chat-turn/{background.integration,context-usage,native-session,project-binding,worktree-bind,worktree-recover}.test.ts`이며 ABI 재빌드는 하지 않았다.
- 신규 테스트 7개 이름을 최종 JSON 결과에서 다시 찾아 모두 `passed`임을 확인했다. 본문 AC 표 ✅ 9개·전체 10개를 별도로 세어 trailer `9/10`과 대조한다.

## [구현자 기입] Review Signals — 사실만 (r2)

- 라운드·라벨: verify r1 RETURN_TO_PLAN 후 첫 구현 `r2`; 다음은 Claude 독립 검증이다.
- 같은 축: r1의 운반 항·실제 소비자 관측 공백을 닫았다. 공용 host를 통과하는 N-host와 실패 보고 N-fail이 추가됐다.
- plan 지침: ΔV2가 S1~S23·N-*·M14~M24를 고정했으며 구현 중 규범 정정은 필요 없었다.
- 환경: Windows 로컬 실행으로 r1 Linux의 cold resume 한계를 재검사했다. 임시 외부 저장소 문서 링크는 추적 사본 검사로 분리했다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| G1 | EP-01 문서 자리 P11~P13에 oracle이 없다. VP-01 §10 열이 P13을 담아 VP-01이 닫히지 않는다 | §10 EP-01 · VP-01 | 문서 oracle 등록(drift-check DA 행·`gate:` 검색 등) 또는 pair 분모에서 분리 | PLAN_GAP | open — verify r1 |
| G2 | VP-05·AC3 path의 `ConfirmDialogHost.tsx:16·28`(onConfirm·취소 배선)이 EP-01 목록 밖이다. 고장 X29·X30 못 잡음 | §10 EP-01 · VP-05 · AC3 | 자리·oracle 추가. 구현은 X29·X30을 잡는 좌표 | PLAN_GAP | open — verify r1 |
| D1 | D-007 동기 구간 미잠금 — `extension-catalog.ts:56` `plan()` 뒤 `await` 삽입(X25)이 전체 스위트 green | D-007 · VP-02 · P7 | 판정~종료 사이에 끼어든 작업을 관측하는 좌표 | BLOCKING | open — verify r1 |
| D2 | `confirmed` `false` 거절 미잠금 — `protocol.ts:767` `z.boolean()`(X18) green | §10 주석 · VP-02 · P1 | 스키마 거절 좌표 | BLOCKING | open — verify r1 |
| D3 | 대화상자 본문 리소스 미잠금 — `{{count}}` 제거(X20)·en `_one`↔`_other` 맞바꿈(X19) green | AC2 · VP-05 · P16 | 실제 리소스로 count 보간·복수형 관측 | BLOCKING | open — verify r1 |
| D4 | 종료 일부 실패 보고 배선 미잠금 — `bootstrap.ts:1249` `failed: () => {}`(X1) green | plan §13 · VP-04 · P8 | bootstrap에서 close 실패 → reportError 관측 | BLOCKING | open — verify r1 |
| D5 | Composer [세션 전체 중단]의 요청 창 `message.cancelled` 미잠금 — `chat-turn/index.ts:177` emit 제거(X27) green. AS-IS에도 같은 공백 | VP-R5 · P10 | handler 경유 residual 복원 emit 관측 | BLOCKING | open — verify r1 |
| N1 | 일부 종료 실패 토스트 제목 `saveFailed` — 저장은 성공 | Product/UX 파생 | 사람 결정 | NON_BLOCKING | open |
| N2 | 확정 버튼 비`danger`. store 주석은 파괴적 액션에 `danger: true` | D-003 | 사람 결정 | NON_BLOCKING | open |
| N3 | `confirm` 응답이 `mounted`·version을 보지 않는다(`useNativeMcpCatalog.ts:92`) | 비귀속 | 기록 | NON_BLOCKING | open |
| N4 | DB 행 없는 유휴 runtime은 닫지 않는다(구현자 보고) | 비귀속 | 기록 | NON_BLOCKING | open |
