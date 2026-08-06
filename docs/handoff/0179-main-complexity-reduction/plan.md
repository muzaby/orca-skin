# Plan — 0179-main-complexity-reduction

## 메타

| 항목 | 값 |
|---|---|
| slug | `0179-main-complexity-reduction` |
| 작성자 | Claude Code |
| 일자 | 2026-08-06 |
| 매핑 | PHASES 신규 행 (PR 미정) |
| 상태 | DRAFT → **READY** |
| 구현 주체 | **Claude**(비기능 = 리팩토링 — plan→impl→verify 직접 수행, `docs/handoff/AGENTS.md` §역할 분담) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "main 복잡도 개선, 코드 간소화, tiny한 채팅 앱 구현 추구" / "과도한 아키텍처링, 어슬픈 플랫폼화로 인해 재사용성이 어려운 코드, 더이상 사용하지 않는 코드, 어설픈 재사용, 한쪽으로 몰아넣은 과한 책임 등을 개선한다" | 라이브 세션 요청 (2026-08-06, 영속 트랜스크립트 없음 — 원문 인용) |
| 명시 결정 ① | **인증/커넥터 플랫폼은 손대지 않는다** (`features/auth-platform`·`features/connectors`·`infra/auth`) | 라이브 세션 AskUserQuestion 응답 (2026-08-06) |
| 명시 결정 ② | 범위 = **main 프로세스만** (`src/main/`). renderer 리팩토링은 별도 | 동상 |
| 명시 결정 ③ | `handleChatSend` 는 **단계별 순수 함수로 분해** (책임의 `features/` 이관은 하지 않음) | 동상 |
| 추론 의도 | "tiny한 채팅 앱" = *줄 수를 줄이는 것 자체*보다 **한 파일/한 함수가 지는 책임을 사람이 한 번에 읽을 수 있는 크기로 되돌리는 것**. 결정 ①로 최대 삭감처가 범위 밖이 되었으므로, 이번 작업의 주된 산출은 삭감이 아니라 **분해와 테스트 가능성**이다 (추론) | 결정 ①②③의 조합에서 파생 |

## Context (왜)

`src/main/` 은 **prod 25,022줄 / 204파일**, **test 23,400줄 / 136파일** 이다(2026-08-06 실측).
0175~0178 이 인증 플랫폼 확장점을 접었지만 사용자가 지목한 네 증상은 그대로 남아 있다:

1. **한쪽으로 몰아넣은 과한 책임** — `app/chat-turn.ts` 는 1,383줄이고, 그중
   `registerChatHandlers` 가 **단일 함수 1,166줄**(`:217-1382`), 그 안의 `handleChatSend` 하나가
   **892줄**(`:356-1247`)이다. 검증·lease·continuity·turn 조립·respawn·큐 적재·승인 배선·
   `TurnRequest` 조립·턴-후 루프·정리 2단이 **한 클로저 스코프**에 있어 어떤 단계도 따로
   호출할 수 없다. `app/handlers/misc.ts` 는 347줄에 **26개 채널 / 10개 무관 도메인**
   (backend·agent·install·settings·skills·files·search·cost·notify·debug)을 담고 있다.
2. **아무도 안 쓰는 잔해** — `features/extensions/conformance.ts`(238줄)는 자기 테스트 외
   참조가 0이고, `features/providers/static/modules/_example/`(3파일)은 **어떤 import 도 없이
   typecheck 만 통과**한다. `features/usage/external-correction.ts` 는 "후속 핸드오프 구현 대기"
   라 적힌 no-op 이며 그 유일 소비점 `UsageTracker.remainingUsd()` 역시 **호출자가 0**이다.
3. **어설픈 재사용** — `features/usage/boundaries.ts`(4줄)·`features/scheduler/cron-validate.ts`
   (1줄)는 "무회귀" 목적의 re-export 껍데기다. 전자는 원본(`shared/time/clock.ts`)에 이미 같은
   테스트가 있는데도 자기 테스트를 따로 들고 있다.
4. **가짜 공개 표면** — 인증 스택을 뺀 `src/main` 의 export 중 **169개가 프로덕션 외부 참조 0**
   이고, 그중 **117개는 어디서도 참조되지 않는다**(나머지 52개는 테스트 전용 = 의도된 표면).
   대부분 모듈 내부 shape 인데 `export` 가 붙어 "이건 계약인가?" 를 매번 되묻게 한다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당** | 사용자가 든 네 증상이 전부 실측으로 재현됐다 — 892줄 단일 함수(`app/src/main/app/chat-turn.ts:356-1247`), 참조 0 파일 3종, re-export 셸 2종, 무참조 export 117건. 인상이 아니라 코드가 그렇다. |
| 이미 있는 것 아닌가 (기존 작업으로 충족되나) | **아니오 — 다만 중복 회피 필요** | 0092(`/simplify @app/src/main`)가 데드코드 6건·재사용 3건을 이미 정리했고 PASS 했다(`docs/handoff/INDEX.md` 0092 행). 그러나 ⓐ 0092 는 `chat-turn` 분해를 하지 않았고 ⓑ 이번 삭제 대상 3종은 **0092 이후(0157~0178)에 생긴 것**이다 — `conformance.ts` 는 0178 이 "제거했다" 고 INDEX 에 적었으나 파일이 남아 있다(문서가 코드보다 앞섬). |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **부분적으로 그렇고, 그래서 구조 변경을 최소화한다** | `chat-turn` 을 주석·구역 표시로만 정리하는 안을 따져봤다 — 읽기는 나아지지만 **판정 로직이 여전히 `sendChatEvent` 부작용과 한 스코프에 있어 테스트가 안 생긴다**. 반대로 책임을 `features/chat` 으로 이관하는 안은 slice 경계를 건드려 리스크가 크다. 사용자 결정 ③("단계별 순수 함수")이 정확히 그 중간이며, 이번 설계는 **`app/` 안에서만** 파일을 나눈다(레이어 이동 0). |
| 인용 자료가 요구를 부풀리지 않았나 | **부풀림은 없으나 문서 1건이 코드보다 앞서 있다** | `docs/handoff/INDEX.md` 의 0178 비고가 "manifest·ABI·**conformance** 제거" 라고 적었는데 `app/src/main/features/extensions/conformance.ts` 는 존재한다(다른 `conformance` — auth 하네스만 제거됐다). 수치는 전부 이번 세션에서 재측정했다. |
| 기존 채택 결정을 뒤집는가 | **2건 뒤집음, 나머지는 따름** | 아래 §기존 결정·규칙과의 관계. 뒤집는 것은 두 re-export 셸의 "무회귀 유지" 주석뿐이고, `app/AGENTS.md §에이전트 원칙 5`(400줄 초과 분해 검토)와 `src/main/AGENTS.md §작업 규칙`(4책임 이상이면 분해)은 오히려 **따르는** 쪽이다. |

### 요구에 대한 이견 (범위는 줄이지 않는다)

**이견 1 — "tiny" 목표 대비 이번 작업의 삭감폭은 작다.** 실측상 "어설픈 플랫폼화" 의 최대
덩어리는 인증/커넥터 스택이다: main 기준 prod 5,902 + test 7,416 ≈ **13,300줄**이고,
`methods/sso.ts:31` 의 `SSO_CONFIG = null` · `modules/confluence/servers.ts` 의
`CONFLUENCE_SERVERS = []` · `modules/usage/servers.ts` 의 `USAGE_CONNECTORS = []` 로
**기본 빌드에서 대상이 0개**라 실행 경로에 도달하지 않는다(credential 방식들은
`methods/credential.ts:62` 에서 `targets: ['connector']` 로 기본 등록되므로 대상 0 = binding 0).
즉 main prod 의 약 24%가 현재 동작하지 않는 코드다.

**사용자는 이를 "손대지 않는다" 로 결정했고, 그 결정을 그대로 따른다.** 범위를 임의로 넓히지
않는다. 다만 "main prod 의 24%가 그대로 남는다" 는 사실은 이번 작업의 결과 해석에 필요하므로
여기 기록한다 — 이번 삭감은 **prod 약 -450줄** 규모이며, 실질 산출은 삭감이 아니라 분해다.

- **사용자에게 올릴 것**(단독 결정 불가): **없음.** 신규 의존성 0, IPC 계약 무변경, DB 무변경,
  PRD §11 / TRD §15 Open Question 에 닿는 항목 0.

## 자료조사 (Research)

> 모든 수치는 **2026-08-06 이 세션에서 직접 측정**했다(승계 0건).

### 규모 실측

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `src/main` prod 25,022줄 / 204파일, test 23,400줄 / 136파일 | `find src/main -name '*.ts' ! -name '*.test.ts' \| xargs wc -l` (2026-08-06) |
| `app/chat-turn.ts` = 1,383줄. `registerChatHandlers` = `:217-1382`(1,166줄), `handleChatSend` = `:356-1247`(892줄) | `app/src/main/app/chat-turn.ts` |
| `app/handlers/misc.ts` = 347줄 / `CHANNELS.` 참조 26회 | `app/src/main/app/handlers/misc.ts`; `grep -c 'CHANNELS\.'` |
| IPC 채널 **총 82종** (문서·코드 동시 고정) | `app/src/shared/ipc-documentation.test.ts:9-22` — `expect(Object.values(CHANNELS)).toHaveLength(82)` + `docs/IPC_CONTRACT.md` 헤더 |
| 인증 스택 제외 `src/main` 의 외부 prod 참조 0 export = **169** (완전 무참조 **117** / 테스트 전용 **52**) | 이번 세션 인벤토리 스크립트 (§게이트에 재실행 명령) |

### 죽은 코드 — 전수 확인 (각 심볼을 `rg '\b<name>\b' src` 로 전수 검색)

| 대상 | 전수 결과 |
|---|---|
| `features/extensions/conformance.ts` (`StandardConformance`·`conformanceOf`) | `conformanceOf` 4건 = 자기 파일 + 자기 테스트뿐. `StandardConformance` 5건 = 전부 자기 파일. 프로덕션 참조 **0** |
| `features/providers/static/modules/_example/` (3파일) | `exampleUsageProviderModule` 3건 = 자기 파일 2 + `modules/index.ts` **주석** 1. 실 import **0** (`modules/index.ts:15` 는 활성화 예시 주석) |
| `features/usage/external-correction.ts` | 유일 소비자가 `tracker.ts:22` 기본 인자. 그 소비점 `UsageTracker.remainingUsd()`(`tracker.ts:27-32`)는 **호출자 0** — `rg 'remainingUsd'` 의 나머지 히트는 전부 `ExternalUsageReport.quota.remainingUsd`(다른 필드) |
| `contracts/ports.ts:21` `RuntimeCompleteRequest` | 전수 1건 = 정의뿐. `CompleteRequest` 의 순수 별칭 |
| `infra/config/paths.ts` `sourcesSettingsDir`·`distDir` | 각 1건 = 정의뿐 |
| `infra/config/orca-config.ts` `resetOrcaConfigForTest` | 1건 = 정의뿐 |
| `infra/config/crypto.ts:decrypt` · `paths.ts:{sourcesDir,sourcesMcpDir}` · `vars.ts:BINDING_RE` · `workspace-guard.ts:writeExceptionRoots` · `turn-coordinator.ts:{MAX_RETRIES,ActiveTurnGate}` · `engine-write.ts:{parseEngineKey,writeProviderSettings,mergeProviderEnv}` · `mcp-config.ts:ClaudeMcpSchema` · `streaming-input.ts:SessionInputStream` | 각 2~4건 = **정의 + 같은 파일 내부 사용**. 파일 밖 참조 0 → 삭제가 아니라 `export` 제거 대상 |

**유지 판정 2건** — `contracts/usage-report.ts:29` `UsageMapContext` 와
`contracts/usage-source.ts:34` `UsageSampleFailureReason` 은 외부 파일이 이름으로 부르지는
않지만 **같은 파일의 공개 계약 시그니처에 쓰인다**(`UsageSubscription.map(sample, ctx: UsageMapContext)`
`:44` / `UsageSample` 실패 분기 `:50`). `contracts/` 레이어는 정의상 타입 계약이므로 export 를
유지한다.

### 껍데기 재사용 — 전수 확인

| 대상 | 전수 결과 |
|---|---|
| `features/usage/boundaries.ts` (4줄) | importer 2건 = `tracker.ts:10` + `boundaries.test.ts:2`. 원본 `shared/time/clock.ts` 에 **동일 회귀가 이미 있다**(`shared/time/clock.test.ts:12` "boundaries — 로컬타임 day/week/month 시작 epoch ms") → 셸과 그 중복 테스트를 함께 제거 |
| `features/scheduler/cron-validate.ts` (1줄) | importer 2건 = `scheduler/index.ts:3`(배럴 re-export) + `scheduler.ts:5`. 원본은 `infra/cron`. 배럴이 내보내는 `assertValidCron`/`isValidCron` 의 외부 소비자는 **0** (`settings-store.ts:17` 은 `infra/cron` 을 직접 import) |

### 저장소 규칙 (설계 입력)

| 규칙 | 레퍼런스 |
|---|---|
| `boundaries/elements` 의 `{ type: 'app', pattern: 'src/main/app', **mode: 'folder'** }` — **하위 디렉토리를 포함**하므로 `app/chat-turn/` 신설은 레이어 분류를 바꾸지 않는다 | `app/eslint.config.mjs:120` |
| `import/no-cycle: ['error', {maxDepth: Infinity}]` — 분해로 생기는 모듈 간 순환은 lint error 로 잡힌다 | `app/eslint.config.mjs:134` |
| `no-console: 'error'` (main/shared) — 신규 모듈도 중앙 로거만 쓴다 | `app/eslint.config.mjs:133` |
| "400줄 초과면 분해를 검토한다" | `app/AGENTS.md §에이전트 원칙 5` |
| "모듈이 4책임 이상으로 비대해지면 slice 내부에서 응집 단위로 분해한다. 외부 import 가 많으면 배럴 re-export 로 무회귀 분해" | `app/src/main/AGENTS.md §작업 규칙` |
| `ipc-documentation.test.ts` 가 채널 수 82를 코드·문서 양쪽에서 하드코딩 — 4단계가 채널을 늘리거나 줄이면 즉시 red | `app/src/shared/ipc-documentation.test.ts:9-22` |
| 마이그레이션 append-only 가드 — 이번 작업은 DB 무변경이라 해당 없음 | `app/scripts/check-migrations-appendonly.mjs` |

### `handleChatSend` 단계 지도 (분해 설계의 근거)

`app/src/main/app/chat-turn.ts` 를 전수로 읽어 얻은 단계 경계다.

| 구간 | 책임 | 부작용 |
|---|---|---|
| `:357-392` | 진입 게이트 3종 — 스키마 실패 / 업데이트 설치 대기 / 활성 어댑터 부재 | 판정 + `sendChatEvent` |
| `:394-416` | 첨부 정규화 (busy 판정 **앞**, 0152 AC1) | I/O |
| `:418-467` | lease 키 파생 + CAS 획득 + busy 시 예약 위임 | 상태 변경 |
| `:480-510` | continuity(fork/handoff) 검증 게이트 | 판정 + `sendChatEvent` |
| `:512-551` | provider/env/session meta/continuity 언어·텍스트 해석 + dangling 복구 | I/O |
| `:553-616` | `TurnContext` 조립 + supervisor 등록 | 조립(순수) + 등록 |
| `:618-670` | runtime 획득·`activateChain`·respawn 판정·죽은 태스크 정착 | 상태 변경 |
| `:672-723` | 프렐류드/본 배치 큐 적재 + `message.queued` 발신 | 상태 변경 |
| `:725-748` | 확장 배포 보장 + owner-gone 리스너 | I/O |
| `:750-849` | coordinator 생성 + `requestApproval` 클로저(78줄) | 배선 |
| `:851-994` | `sendOwnership`·`reconcileInterrupt` + `TurnRequest` 조립(콜백 6종 포함, 98줄) | 조립 |
| `:996-1201` | `coordinator.run` + 턴-후 루프(listen / flush / break, 205줄) | 실행 |
| `:1202-1246` | `finally` 정리 2단(rollback·orphan·release) | 정리 |

**분해가 깨뜨리면 안 되는 불변식**(전부 코드 주석에 근거가 있다):

- 첨부 정규화는 **busy 판정보다 앞**이어야 한다 — 판정↔적재 사이에 `await` 가 생기면 예약이
  고아가 된다 (`chat-turn.ts:394-402`, 0152 AC1).
- lease CAS 직후 `leaderAdmittedAt` 고정 = 사용자 입력 순서 보존 (`:468-470`).
- `initialBatches` 는 `finally` 정리와 `canSubmitInitial`/`commitInitialSubmission` 이 **함께 보는
  가변 상태**다 (`:723`·`:943-980`·`:1231`) — 값 복사로 넘기면 롤백이 어긋난다.
- 승인·게이트 콜백은 고정 `turn` 이 아니라 **현재 활성 턴**(`activeTurn`)을 동적으로 읽는다
  (`:763-766`) — 값으로 캡처하면 연속 턴에서 깨진다.
- `endListenPhase()` 는 정상·break·중단·throw **전 경로**에서 호출돼야 한다 (`:1202-1205`).
- listen 요청은 **최소 리터럴 + `pickFrameDelegates` 전량**으로 조립한다 — 원 request 를 spread
  하면 base64 첨부가 listen phase 내내 살아남고, 위임을 절반만 실으면 배치가 `submitting` 에
  갇힌다 (`:1112-1128`, 0149·0166 D7).

### 안전망 (기존 통합 테스트)

| 파일 | 성격 |
|---|---|
| `app/src/main/app/chat-turn.runtime-tools.test.ts` (260줄) | `ipcMain.handle` 을 모킹해 `registerChatHandlers` 를 **실제로 구동**하고 turn request/post-turn step 을 관측. `:50` 에서 `from './chat-turn'` 로 import → 디렉토리화해도 경로가 그대로 해석된다 |
| `app/src/main/app/chat-turn.continuity.test.ts` (224줄) | 실 in-memory DB + 실 `HistoryWriter` 를 버스에 물린 fork/handoff 도착 통합 테스트 |
| `app/src/main/app/chat-turn-continuation.test.ts` | 자동 연속 턴 준비 로직 |

### 베이스라인 게이트 (2026-08-06 실측, 이 세션)

| 게이트 | 결과 |
|---|---|
| `npm run lint` | **0 error / 1 warning** (`useTranscriptVirtualizer.ts:22` react-compiler — 0102 베이스라인) |
| `npm run typecheck` | **3/3 통과** (node·web·test) |
| `vitest run` | **204 파일 / 1,892 테스트 전부 통과** |
| `node --test scripts/*.test.mjs` | **28/28 통과** |

> 이 환경은 egress 가 열려 있어 `npm ci` 의 Electron ABI rebuild 와 electron 바이너리 설치가
> 모두 성공했다(`node node_modules/electron/install.js`). `app/AGENTS.md` 가 경고하는 "403 차단"
> 상황이 **아니므로** DB 스위트를 red 베이스라인으로 분리 보고할 필요가 없다 — 전량 green 이
> 이번 작업의 비교 기준이다.

## 인수 기준 (Acceptance Criteria)

> 전 단계 공통 전제: **매 단계 커밋마다** lint 0 error · typecheck 3/3 · vitest 전량 green.

### 1단계 — 죽은 코드 제거

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| A1 | `features/extensions/conformance.ts`·`conformance.test.ts` 가 삭제되고 `rg 'conformanceOf\|StandardConformance' app/src` 가 **0건**을 반환하며, vitest 파일 수가 204 → **203** 으로 정확히 1 감소하고 나머지 전부 green | `vitest run` 파일 수 + `rg` 결과 (verify 가 실행) | **삭제 근거 = 프로덕션 경로 0** — 삭제 전 유일 참조가 자기 테스트임을 `rg` 로 전수 확인 |
| A2 | `_example/` 3파일 삭제 후 `materializeStaticProviderSettings()` 가 여전히 `{created: []}` 를 돌려주고 부트 provider-scaffold 단계가 정상 완료한다 | `app/src/main/features/providers/static/index.test.ts` (기존, 무수정 통과) | `app/bootstrap.ts:456` provider-scaffold 부트 단계 → `materializeStaticProviderSettings()` |
| A3 | `external-correction.ts` 와 `UsageTracker.remainingUsd()` 삭제 후 `UsageTracker` 생성자가 `(db, broadcast)` 2인자가 되고, 부트의 비용 요약 재계산·브로드캐스트가 **동일하게 동작**한다 | `app/src/main/features/usage/tracker.test.ts` (기존, 무수정 통과) + typecheck | `app/bootstrap.ts:363` `new UsageTracker(db, …)` → `:369` `cost.recompute()` → `CHANNELS.costSummaryEvent` |
| A4 | `contracts/ports.ts` 의 `RuntimeCompleteRequest` 가 삭제되고, `UsageMapContext`·`UsageSampleFailureReason` 은 **export 를 유지**한 채 각각 같은 파일의 공개 계약 시그니처에 계속 쓰인다 | typecheck 3/3 + `rg 'RuntimeCompleteRequest' app/src` = 0건 | `contracts/usage-report.ts:44` `UsageSubscription.map(…, ctx: UsageMapContext)` — 모듈이 구현하는 계약 |
| A5 | 인증 스택(`features/auth-platform`·`features/connectors`·`infra/auth`)과 `contracts/` 를 제외한 `src/main` 의 **완전 무참조 export 가 0개**가 된다(현재 117). 테스트 전용 export 52개는 **그대로 유지**된다 | §게이트의 인벤토리 스크립트 재실행 — `완전 무참조: 0` · `테스트에서만 참조: 52` | 각 심볼은 삭제되거나 같은 파일 내부 사용으로 남는다. typecheck 3/3 이 내부 사용의 정합을 보장 |

### 2단계 — 껍데기 재사용 정리

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| A6 | `features/usage/boundaries.ts`·`boundaries.test.ts` 삭제 후 `tracker.ts` 가 `shared/time/clock` 의 `boundaries` 를 직접 import 해 `recompute()` 가 동일한 day/week/month 경계를 계산하고, 그 회귀는 `shared/time/clock.test.ts` 가 계속 잠근다 | `app/src/shared/time/clock.test.ts::"boundaries — 로컬타임 day/week/month 시작 epoch ms"` + `features/usage/tracker.test.ts` | `bootstrap.ts:369` `cost.recompute()` → `tracker.ts:35` `boundaries(now)` |
| A7 | `features/scheduler/cron-validate.ts` 삭제 후 `scheduler.ts` 가 `infra/cron` 의 `assertValidCron` 을 직접 import 해 **잘못된 cron 표현식에 대해 `schedule()` 이 throw** 하고, `scheduler/index.ts` 배럴에서 `assertValidCron`/`isValidCron` re-export 가 제거된다 | `app/src/main/features/scheduler/scheduler.test.ts` (기존 cron 검증 케이스, 무수정 통과) | `bootstrap.ts:383` `scheduler.applySettings(...)` → `scheduler.ts:40` `assertValidCron(spec.cron)` |

### 3단계 — `app/chat-turn.ts` 분해

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| A8 | `admitChatSend` 가 ① 스키마 실패 → `schema_validation_error` ② 업데이트 설치 대기 → `capability_unsupported` ③ 활성 어댑터 부재 → `provider_connection_error(retryable:true)` ④ 정상 → `{ok:true, data}` 를 돌려주고, **네 경우 모두 `sendChatEvent` 를 호출하지 않는다**(부작용 0) | `app/src/main/app/chat-turn/admission.test.ts` — 신규 4케이스 | `handlePlain(CHANNELS.chatSend)` → `handleChatSend` → `admitChatSend` |
| A9 | `leaseKeyFor` 가 sessionId 가 있으면 `sessionLeaseKey(sessionId)` 를, 없으면 `clientLeaseKey(clientKey → clientRequestId → 생성 uuid)` 우선순위로 논리 키를 돌려주고 provisional 키를 함께 반환한다 | `app/src/main/app/chat-turn/admission.test.ts` — 신규 3케이스 | 동상 → `supervisor.acquireChain({ logicalKey })` |
| A10 | `checkContinuitySource` 가 ① 원본 세션 부재 → `schema_validation_error` ② handoff + 원본 턴 진행 중 → `provider_connection_error(retryable:true)` ③ **fork + 원본 턴 진행 중 → `null`(허용)** ④ continuity 없음 → `null` 을 돌려준다 | `app/src/main/app/chat-turn/admission.test.ts` — 신규 4케이스 | `handleChatSend` → `checkContinuitySource`(현 `:480-510`) |
| A11 | `checkBusyReservation` 이 ① lease `closing` → 재시도 가능 오류 ② provider 경계 교차 → 재시도 가능 오류 ③ **요청 providerKey 가 `null`(미지정) → `null`(보수적 허용)** ④ 그 외 → `null` 을 돌려준다 | `app/src/main/app/chat-turn/admission.test.ts` — 신규 4케이스 | `handleChatSend` → `reserveOnBusySession`(현 `:280-354`) |
| A12 | `buildTurnContext` 가 continuity 페이로드에 대해 `lineage`·`initialTitle`·`titleGenerationStarted:true`·**출발 세션 cwd 계승** 4가지를 채우고, 일반 send 에 대해서는 `lineage`/`initialTitle` 이 없고 `titleGenerationStarted:false` 이며 cwd 를 `resolveTurnCwd` 로 해석한다 | `app/src/main/app/chat-turn/turn-context.test.ts` — 신규 2케이스 | `handleChatSend` → `buildTurnContext` → `supervisor.startNew/startResume` |
| A13 | `buildContinuationRequest` 가 ① `kind:'listen'` 이면 `text:''` + `pickFrameDelegates` **전량**을 싣고 `attachmentTexts`/`attachmentImages` 를 **싣지 않으며** ② `kind:'flush'` 이면 batch 의 text/uuid/첨부와 신선한 settings 를 싣고 `forkFrom`·`handoff` 를 **제거**한다 | `app/src/main/app/chat-turn/post-turn.test.ts` — 신규 2케이스 | 턴-후 루프(현 `:1098-1200`) → `coordinator.run` |
| A14 | 기존 통합 3종(`chat-turn.runtime-tools`·`chat-turn.continuity`·`chat-turn-continuation`)이 **테스트 파일을 한 줄도 고치지 않고** 통과한다 | 세 테스트 파일의 `git diff` 가 비어 있음 + `vitest run` green | `chat-turn.runtime-tools.test.ts:50` 의 `from './chat-turn'` 가 `chat-turn/index.ts` 로 해석된다 |
| A15 | `app/chat-turn/` 의 모든 파일이 **250줄 이하**이고, `src/main` 전체의 **최대 함수 길이가 200줄 미만**이 된다(현재 1,166줄) | §게이트의 함수 길이 측정 명령 | `CHANNELS.chatSend` → `handleChatSend` (분해 대상 자체의 진입점) |

### 4단계 — `app/handlers/misc.ts` 분해

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| A16 | 분해 후 `registerMiscHandlers` + 신규 4모듈(`skills`·`files`·`cost`·`settings`)이 등록하는 채널의 **합집합이 분해 전 26개와 정확히 일치**하고 **중복 등록이 0**이다 | `app/src/main/app/handlers/misc-split.test.ts` — 신규. `ipcMain` 을 모킹해 5개 register 함수를 호출하고 수집된 채널 집합을 리터럴 기대 목록과 비교 | `bootstrap.ts:register()` → `registerMiscHandlers(ctx)` + `registerSkillsHandlers(ctx)` 외 3 |
| A17 | `CHANNELS` 가 **82종을 유지**하고 `docs/IPC_CONTRACT.md` 의 헤더·도메인 합계가 82로 남는다 | `app/src/shared/ipc-documentation.test.ts::"keeps the header, domain summary, and CHANNELS count at 82"` (기존, 무수정 통과) | `preload/index.ts` → `ipcRenderer.invoke(CHANNELS.*)` |
| A18 | `handlers/misc.ts` 가 **200줄 이하**로 줄고 backend·agent·install·notify·debug 5개 도메인만 남는다 | `wc -l app/src/main/app/handlers/misc.ts` + `rg 'CHANNELS\.' app/src/main/app/handlers/misc.ts` 로 잔여 채널 확인 | `bootstrap.ts:700` `registerMiscHandlers(ctx)` |

### 문서

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| A19 | `app/AGENTS.md`·`app/src/main/AGENTS.md` 의 `src/main/app/` 행이 `chat-turn/`(디렉토리)과 **handlers 14종**을 반영하고, `_example` 언급이 제거된다 | 두 파일의 diff 를 verify 가 코드 실측과 1:1 대조 | 에이전트 진입 문서 — 코드가 아니라 다음 세션이 읽는다 |

### 사람 실기 (기계 검증 불가 — 실행 경로 명시)

| # | 인수 기준 | 실행 경로 |
|---|---|---|
| H1 | 3·4단계 후 실제 앱에서 회귀가 없다 | `cd app && npm run dev` → ① `/new` 에서 새 채팅 전송 ② 응답 중 추가 전송 → 예약 버블이 뜨고 게이트 flush 로 이어짐 ③ 중단 버튼 → 열린 도구가 `aborted` 로 정착 ④ 세션 메뉴에서 fork·handoff ⑤ 설정 모달의 스킬·파일 첨부·사용량 탭 (4단계가 이 3개 도메인의 IPC 배선을 옮기므로 필수) |

> H1 의 실행 경로는 이 작업의 **비범위에 막혀 있지 않다** — 범위가 main 프로세스이고 renderer 는
> 무변경이므로 `npm run dev` 로 전 경로가 그대로 열린다.

## 범위 / 비범위

- **범위**: `app/src/main/**` (인증 스택 제외) + `app/src/shared/time/`·`app/src/shared/ipc*`
  **읽기만** + `app/AGENTS.md`·`app/src/main/AGENTS.md`·`docs/PHASES.md`·`docs/handoff/INDEX.md`.
- **비범위**:
  - `app/src/main/features/auth-platform/**` · `features/connectors/**` · `infra/auth/**` —
    **파일을 열지 않는다**(사용자 결정 ①). 여기에도 완전 무참조 파일이 있으나(`auth-platform/test-fakes.ts`
    등) 남긴다.
  - `features/providers/static/modules/index.ts` 의 **빈 레지스트리와
    `materializeStaticProviderSettings` seam 은 유지**한다 — 삭제하는 것은 아무도 import 하지 않는
    `_example/` 뿐이다. seam 자체는 `servers.ts` 와 같은 "배포가 채우는 자리" 라 결정 ①과 짝을 이룬다.
  - `app/src/renderer/**` · `app/src/preload/**` (사용자 결정 ②). main 삭제의 **불가피한 연쇄만**
    허용하나, 현재 예상 연쇄는 **없다** — 삭제 대상 중 IPC 계약·preload 표면에 닿는 것이 0이다.
  - IPC 채널 82종 — 추가·삭제·시그니처 변경 **없음**. `docs/IPC_CONTRACT.md` 무변경.
  - DB 스키마·마이그레이션 무변경.
  - `infra/db/queries.ts`(828줄)·`adapters/mock-scenarios.ts`(711줄)·`bootstrap.ts`(703줄) 분해 —
    아래 유예 표.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 인증/커넥터 스택 정리 | **아니오 — 되돌릴 수 있음.** 삭제든 유지든 코드 이동이고, 외부에 나간 이름·스키마가 없다(대상 0개라 도구 이름·binding id 가 생산된 적이 없다). 지금 결정하지 않아도 비용이 늘지 않는다 |
| `infra/db/queries.ts`(49 메서드) 도메인별 분해 | **아니오.** 순수 내부 DAL — 파일 경계만 바뀐다 |
| `bootstrap.ts` 부트 단계 추출 | **아니오.** `bootReport.step()` 라벨이 이미 단계 이름을 들고 있어 나중에 떼도 관측 계약이 안 바뀐다 |
| `handlers/misc.ts` 잔여 5도메인의 추가 분해 | **아니오.** 채널 이름이 불변이므로(§A17) 파일 경계는 언제든 다시 그을 수 있다 |

> **일방향인 결정이 이번 범위에 없다** — 채널 이름·DB 스키마·파일 포맷·외부 계약을 전부
> 무변경으로 묶었기 때문이다(A17·§비범위). 그래서 사용자에게 지금 물어야 할 항목이 없다.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `infra/ipc/handle`(`handle`·`handlePlain`) · `infra/ipc/send`(`sendChatEvent`) ·
  `infra/errors`(`makeClassifiedError`) · `features/sessions/session-chain-lease`
  (`sessionLeaseKey`·`clientLeaseKey`) · `features/sessions/session-runtime`(`pickFrameDelegates`) ·
  `features/chat/post-turn`(`decidePostTurnStep`·`postTurnHoldsSession`) ·
  `shared/time/clock`(`boundaries`) · `infra/cron`(`assertValidCron`·`isValidCron`).
- 전제: ① `boundaries/elements` 의 `app` 요소가 folder 모드라 하위 디렉토리를 포함한다
  (`eslint.config.mjs:120` 로 확인) ② `chat-turn.runtime-tools.test.ts` 의 `'./chat-turn'` import 가
  디렉토리 `index.ts` 로 해석된다(Node/Vite 표준 해석) — A14 가 이를 기계 검증한다.
- **신규 의존성: 없음.** TRD §2 Stack 표 밖 패키지 추가 0.

## 설계

### 접근 방법

**단계마다 독립 커밋, 각 커밋이 그 자체로 green.** 순서는 위험도 오름차순 —
삭제(1) → 셸 제거(2) → 분해(3) → 배선 이동(4). 앞 단계가 뒤 단계의 노이즈를 미리 걷어낸다.

### 3단계 모듈 배치 — `app/src/main/app/chat-turn/`

레이어는 **전부 `app`**(컴포지션 루트)이다. `features/` 로 옮기지 않는다(사용자 결정 ③).

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `chat-turn/index.ts` | `registerChatHandlers` — deps 구조분해 · `emitTurn`/`settleDeadBackgroundTasks`/`stopAndSettleAbortedTasks` · IPC 4종 등록 | app | 기존 `chat-turn.runtime-tools.test.ts` 가 `ipcMain` 모킹으로 구동(무수정) |
| `chat-turn/admission.ts` | **순수** — `admitChatSend` · `leaseKeyFor` · `checkContinuitySource` · `checkBusyReservation` | app | 순수 단위 (`admission.test.ts`, 신규 15케이스) |
| `chat-turn/turn-context.ts` | **순수** — `buildTurnContext`(해석 결과 → `TurnContext`) | app | 순수 단위 (`turn-context.test.ts`, 신규 2케이스) |
| `chat-turn/send.ts` | `handleChatSend` — 이름 붙은 단계 호출 시퀀스. 판정은 `admission` 에, 조립은 `turn-context`/`turn-request` 에 위임하고 **`sendChatEvent` 발신만 여기서** | app | 기존 통합 3종 |
| `chat-turn/runtime-entry.ts` | runtime 획득 · `activateChain` · `decideRespawn` 적용 · 죽은 백그라운드 태스크 정착 | app | 기존 `chat-turn.runtime-tools.test.ts` |
| `chat-turn/enqueue.ts` | 프렐류드/본 배치 적재 + `message.queued` 발신 | app | 기존 통합 3종 |
| `chat-turn/turn-request.ts` | `TurnRequest` 조립(게이트 콜백 6종 — `takeSteerFlush`·`rollbackSteerFlush`·`commitSteerFlush`·`canSubmitInitial`·`commitInitialSubmission`·`rollbackInitialSubmission`) | app | 기존 통합 3종 |
| `chat-turn/approval.ts` | `requestApproval` 클로저 조립 | app | 기존 통합 3종 |
| `chat-turn/post-turn.ts` | `coordinator.run` + 턴-후 루프 + **순수** `buildContinuationRequest` | app | 순수부 단위 (`post-turn.test.ts`, 신규 2케이스) + 기존 통합 |
| `chat-turn/cleanup.ts` | `finally` 정리 2단(rollback·orphan·release) | app | 기존 통합 3종 |

> **전부 electron 에 직접 의존하지 않는다** — `WebContents`·`IpcMainInvokeEvent` 는 `import type`
> 이고, 실제 IPC 등록(`ipcMain.handle`)은 `infra/ipc/handle` 뒤에 있다. 즉 순수 4모듈
> (`admission`·`turn-context`·`post-turn` 의 조립부)은 **electron 없이 import 가능**하다.
> 이것이 사용자 결정 ③("순수 함수로 분해")의 실질이며, 이 seam 이 없으면 15개 신규 케이스가
> 아예 성립하지 않는다.

**가변 상태 전달 규칙(불변식 보호).** `initialBatches`·`activeTurn` 은 **값이 아니라 접근자로**
넘긴다 — `turn-request.ts` 는 `{ getActiveTurn(): TurnContext, getInitialBatches(): SteerFlushBatch[] }`
형태의 구조적 포트를 받고, `send.ts` 가 자기 지역 변수를 읽는 게터를 주입한다. 값 복사로 넘기면
연속 턴에서 콜백이 옛 턴을 보고(§자료조사 불변식 4) 롤백이 어긋난다(불변식 3).

### 4단계 핸들러 배치

| 신규 모듈 | 담당 채널 | 개수 |
|---|---|---|
| `handlers/skills.ts` | `skillsList` `skillsAuthor` `skillsUpload` `skillsSetEnabled` `skillsOpen` `skillsShowInFolder` `skillsRemove` | 7 |
| `handlers/files.ts` | `filesList` `filesPickAttachments` `filesPickDirectory` `filesOpenPath` `filesReadAttachment` `searchMessages` | 6 |
| `handlers/cost.ts` | `costSummary` `costProviderSummaries` `costRefreshProviderUsageReport` `costSetProviderLimit` `costUsageStats` | 5 |
| `handlers/settings.ts` | `settingsGet` `settingsSet` | 2 |
| `handlers/misc.ts` (잔여) | `backendList` `agentList` `installStart` `installStatus` `notifyShow` `debugGetMock` `debugSetMock` | 7 |

합계 **27** — 분해 전 `rg -c 'CHANNELS\.'` 는 26이지만 `installStatus` 는 `handle` 등록이 아니라
진행 전송에 쓰이는 참조라 등록 수와 참조 수가 1 어긋난다. **A16 은 참조 수가 아니라
`ipcMain.handle` 실제 등록 집합으로 판정**한다(그래서 `misc-split.test.ts` 가 모킹으로 수집한다).
`findSkill` 헬퍼(`misc.ts:58`)는 `handlers/skills.ts` 로 함께 옮긴다.

`bootstrap.ts:register()` 에 4줄 추가:
```ts
registerSettingsHandlers(ctx)
registerSkillsHandlers(ctx)
registerFilesHandlers(ctx)
registerCostHandlers(ctx)
```

## 기존 결정·규칙과의 관계

> 본문(§설계·§파생 UX·§범위)을 다 쓴 뒤 채웠다. 각 행은 **본문의 어느 문장이 그 결정을
> 건드리는지** 찾아 그 문장 기준으로 판정했다.

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| "재노출만 유지해 기존 importer(`tracker.ts`)·테스트 무회귀" | **코드 주석** `features/usage/boundaries.ts:2-3` | §AC A6 "`boundaries.ts`·`boundaries.test.ts` 삭제 후 `tracker.ts` 가 `shared/time/clock` 를 직접 import" | **뒤집음.** 근거: importer 가 1개(+중복 테스트 1개)뿐이라 셸이 막아주는 무회귀가 없다. 회귀는 원본 테스트(`clock.test.ts:12`)가 이미 잠근다 |
| `cron-validate.ts` 의 1줄 re-export 배선 | **코드** `features/scheduler/cron-validate.ts:1` + `scheduler/index.ts:3` | §AC A7 "배럴에서 `assertValidCron`/`isValidCron` re-export 가 제거된다" | **뒤집음.** 근거: 배럴 export 의 외부 소비자 0, `settings-store.ts:17` 은 이미 `infra/cron` 직행 |
| "모듈이 4책임 이상으로 비대해지면 slice 내부에서 응집 단위로 분해한다. 외부 import 가 많으면 **배럴 re-export 로 무회귀 분해**" | `app/src/main/AGENTS.md §작업 규칙` | §설계 "`chat-turn/index.ts` … IPC 4종 등록" + §AC A14 | **따름.** `chat-turn/index.ts` 가 정확히 그 배럴 역할을 해 `'./chat-turn'` import 가 무회귀로 유지된다 |
| "400줄 초과면 분해를 검토한다 … 수치는 *경고 트리거* 이지 절대 규칙이 아니다" | `app/AGENTS.md §에이전트 원칙 5` | §AC A15 "모든 파일이 250줄 이하" | **따름.** 1,383줄·892줄은 트리거를 훨씬 넘어섰고 "왜 한 파일에 두었는가" 에 답할 근거가 없다 |
| `src/main` 최상위는 `{app, contracts, adapters, features, infra}` + `index.ts`·`env.d.ts` 만 | `app/src/main/AGENTS.md §레이어 ↔ 디렉토리 매핑` 하단 주석 | §설계 "`app/src/main/app/chat-turn/`" | **유지.** 신설은 `app/` **하위**라 최상위 목록이 안 바뀐다. `boundaries` 의 `app` 요소가 folder 모드(`eslint.config.mjs:120`)라 분류도 그대로 |
| `handlers/` **10종** `{auth,boot,engine,log,mcp,misc,plugins,project,session,update}` | `app/AGENTS.md` · `app/src/main/AGENTS.md` `src/main/app/` 행 | §설계 4단계 배치 표 + §AC A19 | **갱신.** 10 → **14종**(+`cost`·`files`·`settings`·`skills`). 두 AGENTS.md 를 같은 커밋에서 고친다 |
| `features/providers/static/modules/` opt-in 레지스트리 (배포가 채우는 자리) | `app/src/main/AGENTS.md §작업 규칙`(구체 provider 리터럴 허용 위치) + `providers/static/index.ts:8-24` 헤더 | §비범위 "빈 레지스트리와 `materializeStaticProviderSettings` seam 은 유지한다" | **유지.** `_example/` 만 지운다 — 헤더가 말하는 "모듈을 `modules/<name>/` 에 추가" 절차는 그대로 성립 |
| 채널 카탈로그 82종 (코드·문서 동시 고정) | `app/src/shared/ipc-documentation.test.ts:9-22` (위생 테스트) | §AC A17 | **유지.** 4단계는 등록 *위치*만 옮기고 이름·개수·시그니처를 안 건드린다 |
| `no-console: 'error'` · `import/no-cycle` · `boundaries/dependencies` | `app/eslint.config.mjs:133-135` | §설계 전반(신규 10모듈) | **유지.** 신규 모듈도 `getLogger()` 만 쓰고, 분해가 순환을 만들면 lint 가 즉시 잡는다 |
| 턴 이벤트 버스 구독 순서 `usage → history → title → relay` 는 `bootstrap.ts` 한 곳이 소유 | `app/src/main/AGENTS.md §단일 턴 이벤트 파이프라인` | 본문에 **건드리는 문장 없음** | **유지.** 3단계는 `chat-turn` 안쪽만 나눈다 — `bootstrap.ts:631-642` 의 등록 순서는 무변경 |
| 첨부 정규화가 busy 판정보다 앞 (0152 AC1) | **코드 주석** `chat-turn.ts:394-402` | §자료조사 "분해가 깨뜨리면 안 되는 불변식" 1번 | **유지.** `send.ts` 의 단계 순서로 보존하고, 순서가 뒤집히면 기존 통합 테스트가 잡는다(A14) |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

이 작업은 **동작 무변경 리팩토링**이라 새 UX 가 없다. 대신 *기존* 엣지케이스가 분해로 깨질
지점만 적는다.

- **취소 / abort 전파** — `abortPreparing`(준비 중 renderer 소멸)과 `onOwnerGone`(턴 중 소멸)은
  등록·해제 짝이 서로 다른 스코프에 있다(`chat-turn.ts:476-478`·`:734-748`·`:1206-1207`·`:1227-1228`).
  `send.ts` 와 `cleanup.ts` 로 나뉘면 **해제 누락이 조용한 리스너 누수**가 된다 → 등록과 해제를
  같은 모듈(`send.ts`)에 묶고, `cleanup.ts` 는 큐/lease 정리만 받는다.
- **앱 종료(quit) 중 send** — `isUpdateInstallPending()` 게이트(A8 ②)와 `pendingMessages.freeze()`
  (`bootstrap.ts:574`)가 서로 다른 경로다. 분해가 게이트 순서를 바꾸면 종료 중 예약이 되살아난다
  → `admitChatSend` 를 **첫 단계로 고정**한다.
- **연속 턴 중 provider 변경** — 콜백이 `activeTurn` 을 동적으로 읽어야 한다(불변식 4).
  게터 주입 규칙(§설계)이 이 케이스를 덮는다.
- **빈 상태 / 로딩 / 테마 / a11y** — `N/A`. renderer 무변경.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **892줄 함수를 나누다 클로저 캡처 의미가 바뀐다** (가장 큰 리스크) — `initialBatches`·`activeTurn`·`listenPhaseSessionId` 는 여러 콜백이 공유하는 가변 지역이다 | 게터 주입 규칙을 설계에 명시(§설계) + 기존 통합 3종을 **무수정 통과**로 못 박음(A14). 통합 테스트가 실제 `ipcMain` 핸들러를 구동하므로 캡처가 어긋나면 red |
| 분해가 **순환 import** 를 만든다 (`send ↔ post-turn ↔ turn-request`) | `import/no-cycle`(`eslint.config.mjs:134`)이 빌드 에러로 잡는다. 설계상 의존 방향은 `index → send → {admission, turn-context, runtime-entry, enqueue, turn-request, approval, post-turn, cleanup}` 단방향이고, 역방향이 필요하면 콜백으로 넘긴다 |
| A5(무참조 export 117건 정리)의 **기계적 편집 폭이 넓다** — 80여 파일 | typecheck 3종이 모든 오편집을 잡는다(내부 사용을 지우면 즉시 red). 인벤토리 스크립트로 전후 수치를 비교해 **누락·과잉을 둘 다** 검출(A5) |
| 4단계가 IPC 등록을 옮겨 **채널 하나가 조용히 미등록**된다 | `misc-split.test.ts` 가 5개 모듈의 등록 집합을 리터럴 기대 목록과 대조(A16) + `ipc-documentation.test.ts` 가 82종 유지 확인(A17) + 사람 실기 H1 ⑤ |
| 커밋 4개가 각각 green 이어야 해 **중간 상태에서 되돌리기 쉬운 반면 라운드가 길어진다** | 의도한 트레이드오프. "반쯤 적용된 지점 금지" 가 검증 비용보다 싸다 |
| **"tiny" 목표 대비 체감 삭감이 작다** (prod 약 -450줄, 인증 스택 13,300줄은 범위 밖) | 사용자 결정 ①. §요구 비판적 검토 §이견 1 에 기록했고 범위는 줄이지 않았다 |

- **되돌리기 어려운 결정: 없음.** 채널 이름·DB 스키마·파일 포맷·외부 계약을 전부 무변경으로
  묶었다(§범위 유예 표).
- **단독 결정 금지 항목(Open Question): 없음.**

## 영향 받는 파일

**삭제**
- `app/src/main/features/extensions/conformance.ts` · `conformance.test.ts`
- `app/src/main/features/providers/static/modules/_example/{index,provider-hook,provider-subscription}.ts`
- `app/src/main/features/usage/external-correction.ts`
- `app/src/main/features/usage/boundaries.ts` · `boundaries.test.ts`
- `app/src/main/features/scheduler/cron-validate.ts`
- `app/src/main/app/chat-turn.ts` (→ `app/chat-turn/` 로 이전)

**신규**
- `app/src/main/app/chat-turn/{index,send,admission,turn-context,runtime-entry,enqueue,turn-request,approval,post-turn,cleanup}.ts`
- `app/src/main/app/chat-turn/{admission,turn-context,post-turn}.test.ts`
- `app/src/main/app/handlers/{skills,files,cost,settings}.ts` · `handlers/misc-split.test.ts`

**수정**
- `app/src/main/app/bootstrap.ts` (핸들러 4줄 추가 · `UsageTracker` 인자 · static provider import)
- `app/src/main/app/handlers/misc.ts` (5도메인만 잔존)
- `app/src/main/features/usage/tracker.ts` (`boundaries` 직행 · `correction` 제거)
- `app/src/main/features/scheduler/{scheduler.ts,index.ts}` (`infra/cron` 직행)
- `app/src/main/contracts/ports.ts` (`RuntimeCompleteRequest` 삭제)
- `export` 제거 대상 파일 다수 (A5 — `infra/config/{crypto,paths,orca-config}.ts` ·
  `infra/vars.ts` · `adapters/{workspace-guard,mcp-config,streaming-input}.ts` ·
  `features/chat/turn-coordinator.ts` · `features/providers/engine-write.ts` 외)
- `app/AGENTS.md` · `app/src/main/AGENTS.md` · `docs/PHASES.md` · `docs/handoff/INDEX.md`

## 참고 문서

- `app/src/main/AGENTS.md` — 레이어 DAG · feature 슬라이스 규칙 · 작업 규칙
- `app/AGENTS.md` §모듈 레이아웃 · §에이전트 원칙 5 · §better-sqlite3 ABI 게이트 가이드
- `docs/IPC_CONTRACT.md` — 채널 82종 (이번 작업 **무변경**)
- `docs/handoff/AGENTS.md` — 협업 규칙 · 상태 머신 · 커밋 trailer

## 게이트

```bash
cd app
npm run lint          # 0 error (warning 1 = 0102 베이스라인)
npm run typecheck     # 3/3 (node·web·test)
npm test              # vitest 전량 + node --test scripts/*.test.mjs
```

**베이스라인(2026-08-06 실측)**: lint 0 error/1 warn · typecheck 3/3 · vitest **204 파일 /
1,892 테스트 전량 green** · scripts 28/28.

**AC 측정 명령** (verify 가 그대로 재실행한다):

```bash
# A5 — 무참조 export 인벤토리 (인증 스택·contracts 제외)
node -e '
const fs=require("fs"),path=require("path");
function walk(d,a=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
  e.isDirectory()?walk(p,a):/\.tsx?$/.test(e.name)&&a.push(p)}return a}
const files=walk("src"), src=new Map(files.map(f=>[f,fs.readFileSync(f,"utf8")]));
const SKIP=/^src\/main\/(features\/(auth-platform|connectors)|infra\/auth|contracts)\//;
let none=0,testOnly=0;
for(const f of files.filter(f=>!/\.test\.tsx?$/.test(f)&&f.startsWith("src/main")&&!SKIP.test(f))){
  const re=/export (?:async )?(?:function|class|const|interface|type|enum) (\w+)/g;let m;
  while((m=re.exec(src.get(f)))){let ep=0,et=0;
    for(const [g,gt] of src){if(g!==f&&new RegExp("\\b"+m[1]+"\\b").test(gt)){/\.test\.tsx?$/.test(g)?et++:ep++}}
    if(ep===0)et>0?testOnly++:none++}}
console.log("완전 무참조:",none,"/ 테스트에서만 참조:",testOnly)'
# 기대: 완전 무참조: 0 / 테스트에서만 참조: 52

# A15 — src/main 최대 함수 길이 + chat-turn 파일 크기
wc -l src/main/app/chat-turn/*.ts        # 전부 250 이하
awk '/^(export )?(async )?(function|class) /{n=$0;s=NR} /^}$/{if(n){print NR-s, FILENAME; n=""}}' \
  $(find src/main -name '*.ts' ! -name '*.test.ts') | sort -rn | head -3   # 최댓값 < 200

# A18 — misc.ts 잔여
wc -l src/main/app/handlers/misc.ts      # 200 이하
```

**신규 테스트 요구** — 순수 판정 6종(`admission` 4 · `turn-context` 1 · `post-turn` 1) 총
**19케이스** + 핸들러 등록 집합 대조 **1케이스**.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 원문으로 인용했고(§의도 표), 결정 3건을 별행으로 분리, 추론은 "추론" 으로 표기
- [x] 자료조사 — 모든 발견에 `파일:라인` 또는 명령을 붙였다. 레퍼런스 없는 주장 0
- [x] 의존 기술 — 재사용 모듈 8종을 경로로 지목, **신규 의존성 0** 명시
- [x] 파생 UX — 리스너 등록/해제 짝, quit 중 send, 연속 턴 캡처 3건을 펼쳤고 해당 없는 항목은 `N/A`
- [x] 리스크 — 6건 + "되돌리기 어려운 결정 없음" 근거(§범위 유예 표)를 적었다
- [x] **요구 비판적 검토** 5질문 전부 답변, 이견 1건을 적고도 **범위를 줄이지 않았다**(인증 스택 제외는 사용자 결정이지 내 축소가 아니다)
- [x] `검증 수단` 칸 **19개 AC 전부 채움** — 기계 불가 1건(H1)은 실행 경로까지 명시
- [x] 부정형/"불변" 기준 **0개** — A2·A3·A6·A7·A14·A17 을 "여전히 X 를 돌려준다"·"동일하게 동작한다"·"무수정 통과한다" 같은 **양성 단언**으로 썼다
- [x] **AC 간 모순 점검** — A15(최대 함수 200줄 미만)와 A14(테스트 무수정)를 짝지어 확인: `chat-turn/index.ts` 배럴이 import 경로를 보존하므로 양립. A16(등록 집합 26)과 §설계 4단계 표(합 27)의 불일치를 **참조 수 vs 등록 수** 차이로 해소해 명시. A5(무참조 0)와 A4(`UsageMapContext` 유지)를 짝지어 확인: 스크립트가 `contracts/` 를 제외하므로 양립
- [x] 인용 수치 **전부 이번 세션 실측** — 25,022 / 23,400 / 1,383 / 1,166 / 892 / 347 / 82 / 169 / 117 / 52 / 204 / 1,892. 내역 검산: 169 = 117 + 52 ✅
- [x] 신규 모듈 10종 전부 테스트 방법 기재 + **순수부 seam 명시**(electron 은 `import type` 뿐이라 순수 4모듈이 electron 없이 import 가능)
- [x] 전수 조사에 N 수치 — 삭제 심볼 16종 각각의 `rg` 히트 수, 무참조 export 117, 채널 26/82
- [x] 각 AC 에 **프로덕션 도달 경로** 기재. 삭제 AC(A1)는 "프로덕션 경로 0 이 곧 삭제 근거" 임을 명시하고, 그 삭제가 실제 경로를 끊지 않았다는 증거로 전량 green 을 함께 요구
- [x] 사람 실기 AC(H1) 에 실행 경로 5단계 + **비범위에 막히지 않음**을 명시
- [x] 선택적 필드 판정의 미지정 케이스 — A11 ③ `providerKey === null`(미지정 = 보수적 허용)을 별도 케이스로 고정
- [x] 소비 계약의 제약 필드 강제 지점 — 이번 작업은 신규 계약을 소비하지 않는다(`N/A`). 대신 기존 불변식 6종의 보존 지점을 §자료조사·§설계·§파생 UX 에 배치
- [x] 참조 구현 입력 — `N/A`(외부 참조 구현 없음). 분해의 입력은 현행 코드 자신이고 단계 지도를 전수로 작성
- [x] 미룬 항목 4건 전부 **일방향 여부** 답변 — 전부 "아니오"
- [x] **관문 4 를 본문 완성 후 실행** — §기존 결정 표 11행을 본문 문장 인용으로 채웠고(코드 주석 2건 포함), 인용 경로를 `Read`/`rg` 로 열어 확인했으며, `[구현자 기입]`·`[검증자 기입]` 블록이 아래에 남아 있다
- [x] "확정돼 있다" 류 서술 — 이 문서는 `§표제어` 앵커 인용을 쓰지 않고 **`파일:라인`** 으로만 인용한다. 인용한 라인 전부를 이번 세션에서 열어 확인

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (이번 건은 비기능 → Claude 가 직접).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

- [ ] 1단계 — 죽은 코드 제거 (A1~A5)
- [ ] 2단계 — 껍데기 재사용 정리 (A6~A7)
- [ ] 3단계 — `chat-turn.ts` 분해 (A8~A15)
- [ ] 4단계 — `handlers/misc.ts` 분해 (A16~A18)
- [ ] 문서 갱신 (A19)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | | | |
