# Plan — 0261-bypass-flag-prod-devtools

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장은 [`§산출물 문장 규칙`](../AGENTS.md)을 따른다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0261-bypass-flag-prod-devtools` |
| 작성자 | Claude Code |
| 일자 | 2026-10-13 |
| 매핑 | PR #501 (브랜치 `ccr-0d9ab133-25ay9c`) — 0260 질의 3·4 의 사용자 응답 |
| 상태 | READY → impl/IMPL_DONE (r1) |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제 ①: Claude 장수명 채널을 `bypass` 아닌 모드로 시작하면 같은 채널에서 `bypass` 로 바꿀 수 없다. CLI 가 `Cannot set permission mode to bypassPermissions because the session was not launched with --dangerously-skip-permissions` 로 거부한다(§8 실측 A).
- 해결하려는 문제 ②: production 빌드에도 DevTools 진입이 남아 있다. 두 창이 `webPreferences.devTools` 를 지정하지 않아 Electron 기본값(`true`)이고, 패키징 실행에서 막히는 것은 `optimizer.watchWindowShortcuts` 가 가로채는 단축키뿐이다(§8).
- 성공을 사용자 관점에서 한 문장으로: 세션 도중 `bypass` 로 바꾸면 바로 적용되고, 설치본에서는 어떤 창에서도 DevTools 가 열리지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "allowDangerouslySkipPermissions 도 넘길것" | 라이브 세션 2026-10-13 (0260 질의 3 응답) |
| 명시 요구 | "Production 빌드이서는 devtools 막을것" | 라이브 세션 2026-10-13 (0260 질의 4 응답) |
| 추론 의도 | 플래그의 목적은 세션 도중 `bypass` 전환이 동작하는 것이다 — 플래그의 효과는 bypass 가용성 하나다 | §8 실측 A·B, `sdk.d.ts` `allowDangerouslySkipPermissions` 주석 |
| 추론 의도 | "production 빌드" = `electron-vite build` 산출(빌드 타임 `import.meta.env.DEV === false`) | D-003 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 대화 query 에 `allowDangerouslySkipPermissions: true` 를 넘긴다 | "allowDangerouslySkipPermissions 도 넘길것" | 사용자 | ACTIVE | claude-code-spec §5.5·§14.3 "넘기지 않는다"(0260)를 대체 |
| D-002 | production 빌드에서 DevTools 를 막는다 | "Production 빌드이서는 devtools 막을것" | 사용자 | ACTIVE | security.md §1.5 "코드가 열거나 막지 않는다"(0260)를 대체 |
| D-003 | production 판정은 빌드 타임 상수 `import.meta.env.DEV` 다(`app.isPackaged` 아님) | 저장소 dev/prod 분기 관례(security.md §1.7·`bootstrap.ts` `authBypass`)이고 번들에서 상수로 접혀 런타임에 되돌릴 수 없다. 결과: `npm start`(production 번들·미패키징)도 차단, `npm run dev` 만 허용 | 설계자 해석 | ACTIVE | — |
| D-004 | 플래그는 Orca 가 시작 모드(`permissionMode`)를 명시한 대화 spawn 에만 함께 싣는다. 제목 생성 `complete()`(도구 0·모드 없음)에는 싣지 않는다 | 가용성이 필요한 곳은 라이브 전환이 있는 장수명 채널뿐이다. 명시 모드와 묶으면 플래그가 실린 spawn 의 시작 모드는 항상 Orca 의 선택값이다 — production 대화 턴은 항상 명시한다(`send.ts` `DEFAULT_PERMISSION_MODE`) | 설계자 기본값 | ACTIVE | — |
| D-005 | DevTools 차단은 창 단위 `webPreferences.devTools: import.meta.env.DEV` 로 하고, 모든 webContents 생성자 자리에 구조 스캔으로 강제한다 | 한 지점이 메뉴·단축키·`openDevTools()` 를 함께 무효화한다(Electron `webPreferences.devTools`). 단축키 가로채기·메뉴 제거는 부분 차단이다 | 설계자 | ACTIVE | — |
| D-006 | 0260 `drift-assertions.tsv` 에서 옛 사실을 단언한 행을 새 사실로 교체한다 | 옛 사실을 `must` 로 단언한 행이 남으면 후속 에이전트가 문서를 옛 사실로 되돌린다 | 설계자 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-006 (Baseline).
- 변경된 결정: 없음 (0260 의 서술 사실을 D-001·D-002 가 대체 — 0260 의 Decision 은 아니다).
- 기존 ACTIVE 중 유지: 해당 없음.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001 ↔ AC1·AC2·AC3 · D-002 ↔ AC4·AC6·AC7 · D-003 ↔ AC5(DEV 양값)·AC6(번들) · D-004 ↔ AC3(모드 부재·`complete()` 부재 케이스) · D-005 ↔ AC4(전 생성자 자리) · D-006 ↔ AC8(DA 교체 4행).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | 실측 A(플래그 없음 → 라이브 bypass 거부) · B(플래그 → 수락) — §8 |
| 이미 기존 코드가 충족하는가 | ① 아니오 · ② 부분 | ① `rg allowDangerouslySkipPermissions app/src` 0건 · ② `devTools` 지정 0건, 패키징 실행의 KeyI·Ctrl+R 만 optimizer 가 가로챈다 |
| 더 작은 해법이 있는가 | 없음 | ① 대안 "모드 변경 시 respawn" 은 채널 재시작 비용 · ② 대안 "메뉴 제거" 는 `openDevTools()`·macOS 앱 메뉴를 남긴다 |
| 선행 자료의 주장을 코드와 대조했는가 | **전제 정정** | 0260 이 쓴 "DevTools 는 코드가 열거나 막지 않는다"는 `index.ts` `browser-window-created` → `optimizer.watchWindowShortcuts` 를 빠뜨렸다 — 이번에 현재 사실로 교체 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 사용자 결정이 대체 | claude-code-spec §5.5·§14.3(0260 DA-CS4·CS6) ↔ D-001. OQ9(기본 정책값)는 건드리지 않는다 — 기본 모드 불변 |

- 사용자에게 올릴 결정: 없음 — D-003·D-004 는 설치본 결과가 같은 설계자 기본값이고 보고에 명시한다.
- 코드 조사로 닫은 사실: 라이브 전환 호출부 4곳 · 창 생성자 2곳 · 대화 모드 항상 명시(§8).

## 5. 동작 / 사용자 흐름

```text
① 채널이 살아 있는 세션 — 시작 모드 default / auto_classified / accept_edits …
  → Composer 에서 bypass 선택 (위험 모드 확인은 기존대로)
     → 턴 중: orca:permission:setMode → ApprovalCoordinator → live.setPermissionMode('bypassPermissions') → 수락 → 적용값 bypass 회신
     → idle: 선택 저장 → 다음 chat:send → SessionRuntime.pushTurn → setPermissionMode → 수락 → 턴 진행
  ↘ 정책(disableBypassPermissionsMode)이 막으면 CLI 가 거부 — 기존 실패 계약 그대로(턴 중 undefined · 다음 턴 오류)
② production 빌드 실행 → 어느 창에서든 메뉴·단축키·openDevTools() → DevTools 열리지 않음
   dev 빌드(npm run dev) → F12(미패키징 optimizer)·메뉴로 열림
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 턴 중 bypass 선택 (채널은 default 로 시작) | `setPermissionMode('bypassPermissions')` 수락 | 권한 표시가 bypass 로 바뀐다 (이전: 선택 미적용) |
| idle 에서 bypass 선택 후 전송 | `pushTurn` 의 setter 수락 | 턴이 정상 진행된다 (이전: 턴 오류 종료) |
| 정책이 bypass 를 막은 환경 | CLI 거부 (`disabled by settings or configuration`) | 기존과 같다 — spawn 은 정상(§8 실측 C) |
| production 빌드에서 DevTools 시도 | `devTools:false` 창 | 무반응 |
| dev 빌드에서 F12 | `devTools:true` 창 | DevTools 열림 |

### 파생 UX / 엣지케이스

- 시작 모드: 플래그가 있어도 레포 settings 의 `defaultMode: bypassPermissions` 는 시작 모드가 되지 않는다(§8 실측 D).
- bypass 진입 뒤: 벤더 권한 평가 순서(훅 → 거부 규칙 → 모드 → 허용 → `canUseTool`)상 bypass 는 `canUseTool` 전에 승인한다(`docs/spec/claude/agent-sdk/permissions.md` 권한 평가 방식). 이번 변경은 진입 시점만 넓힌다 — §6 비범위·§17.
- concurrency: 같은 세션 라이브 변경 직렬화(ApprovalCoordinator)는 불변.

## 6. 범위 / 비범위

- **범위**: 대화 query 플래그(D-001·D-004) · 두 창 `devTools`(D-002·D-003·D-005) · 구조 스캔/행동 테스트 · 실제 CLI·번들 관측 스크립트 · 현재 사실 문서와 0260 DA 행(D-006).
- **비범위**: 아래 표.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 원격 디버깅·Node inspect 진입(`--remote-debugging-port`·`--inspect`, Electron fuses) | 아니오 — 창 DevTools 와 다른 진입점 | NEXT_HANDOFF 후보, 사용자 보고 |
| bypass 에서 `canUseTool` 게이트(위험 도구 승인 카드·중단 서브에이전트 재호출 차단)가 동작하지 않는 기존 의미 | 아니오 | 사용자 보고 · 후보 |
| 정책으로 bypass 가 막힌 환경의 bypass 메뉴 노출 | 아니오 — 기존 동작 | 후보 |
| OQ9 기본 정책값 | — | 미정 유지(PRD §11) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | default 로 시작한 채널에서 bypass 로 바꾸면 턴 중 전환은 `bypass` 를 회신하고 다음 턴은 오류 없이 진행된다 | 사람 실기(Windows 앱) — 기계 근거 사슬은 AC2·AC3 | Composer → IPC/`chat:send` → ApprovalCoordinator·SessionRuntime → `handle.setPermissionMode` |
| R-01 | ST-01 / AC2 | 실제 CLI: 플래그 없이 spawn 한 스트리밍 세션은 라이브 bypass 를 `not launched` 문구로 거부, 플래그와 함께면 수락, 정책 disable 설정에서는 spawn 정상·전환은 `disabled` 문구로 거부 | `probe-live-bypass.mjs` 의 A·B·C 판정이 모두 기대값 → exit 0 (API 호출 없음) | SDK `query()` → CLI argv → `set_permission_mode` |
| R-01 | IT-01 / AC3 | `sendMessage` 는 `permissionMode` 가 있으면 options 에 `permissionMode` 와 `allowDangerouslySkipPermissions: true` 를 함께 싣고, 없으면 둘 다 없다. `complete()` options 에는 플래그가 없다 | `claude.executable-option.test.ts` 신규 describe 3케이스 — SDK `query` mock 의 options 단언 | `TurnRequest` → `ClaudeAdapter.sendMessage`/`complete` → `query()` |
| R-02 | IT-02 / AC4 | `app/src/main` 의 모든 webContents 생성자 자리의 `webPreferences` 가 `devTools: import.meta.env.DEV`·`contextIsolation: true`·`nodeIntegration: false`·`sandbox: true` 를 각각 정확히 한 번 명시하고, 그 블록 안과 그 뒤에 spread 가 없다 | `infra/browser-window-devtools.test.ts` 구조 스캔 — 등록 변이 M1~M8 이 red | 소스 → 번들 → Electron 창 |
| R-02·R-03 | IT-03·AT-03 / AC5 | 로그인 창은 DEV=false 에서 `webPreferences.devTools === false`, DEV=true 에서 `true` 로 만들어지고 파티션·보안 3키는 그대로다 | `infra/browser-session.devtools.test.ts` — `vi.mock('electron')` + `vi.stubEnv('DEV', …)` 로 생성자 인자 단언 | `BrowserSessionStore.openLoginWindow` → `openWindow` → `new BrowserWindow` |
| R-02 | ST-02 / AC6 | `electron-vite build` 산출 `app/out/main/*.js` 의 모든 창 생성자 자리가 `devTools: false` 를 싣고 그 수가 소스 자리 수와 같다 | `check-prod-bundle.mjs` exit 0 | `import.meta.env.DEV` define → 번들 |
| R-02 | AT-02 / AC7 | Windows 설치본(또는 `npm start`)에서 본창 F12·Ctrl+Shift+I, 로그인 창 Alt 메뉴 View → Toggle Developer Tools 로 DevTools 가 열리지 않는다 | 사람 실기 — 이 환경에는 Electron 바이너리가 없다 | 설치본 실행 |
| R-04 | AT-04 / AC8 | 현재 사실 문서가 두 변경을 서술한다 — EP-04 새 사실 9자리가 있고 옛 사실 문장은 scope 0건이다 | `drift-check.sh check`(교체 4행 + 신규 5행) 공집합 + scope sweep 0건 | 문서 → 에이전트·사람 독자 |

### AC 검증 주의사항

- 기존 테스트 재사용: `claude.executable-option.test.ts` 의 `queryMock`·`optionsOfFirstCall` 하네스 실재 확인(파일 상단). `coordinator.permission.test.ts` 'SDK failure does not report or store success' 는 bypass 거부 시 `undefined` 를 잠근다 — 회귀용으로 유지.
- 사람 실기 항목: AC1(앱 UI 전 경로)·AC7(Electron 런타임 메뉴·단축키). 순수 로직(옵션 조립·`devTools` 값)은 AC3·AC5 가 기계 검증한다.
- AC2 는 실제 CLI 바이너리를 띄우는 외부 계약 관측이다 — CI 게이트가 아니라 검증 턴과 SDK 갱신 때 재실행하는 도구다.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 V 없음 → Baseline V1.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED` 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | 세션 도중 bypass 전환이 적용된다 (§1 ①·§5) | NEW | — |
| R-02 | R | production 빌드에서 DevTools 가 열리지 않는다 (§1 ②·§5) | NEW | — |
| R-03 | R | dev 빌드에서는 DevTools 가 열린다 (D-003) | NEW | — |
| R-04 | R | 현재 사실 문서가 두 변경을 서술한다 (D-006·§18) | NEW | — |
| SD-01 | SD | 대화 채널은 spawn 부터 수명 내내 bypass 가용, 정책은 우선 (§9 TO-BE) | NEW | — |
| SD-02 | SD | production 산출의 모든 창 생성자에 `devTools:false` (§9 TO-BE) | NEW | — |
| AR-01 | AR | `sendMessage`/`complete` → `query()` options 의 플래그 계약 (§10 EP-01) | NEW | — |
| AR-02 | AR | 모든 webContents 생성자의 `webPreferences` 계약 (§10 EP-02) | NEW | — |
| AR-03 | AR | 기존 대화/제목 query options 계약(실행 파일·settingSources·disallowedTools·complete 도구 0) | INHERITED | 0215 ΔV4 AC38 · 0117 — `claude.executable-option.test.ts` 기존 케이스 |
| AT-01·AT-02 | AT | 사람 실기 AC1·AC7 | NEW | — |
| AT-03 | AT | dev 빌드 DevTools 허용 — AC5 의 DEV=true 케이스 + AC4 표현식 단언 | NEW | — |
| AT-04 | AT | 문서 사실 단언 AC8 | NEW | — |
| ST-01·ST-02 | ST | AC2·AC6 관측 스크립트 | NEW | — |
| IT-01·IT-02·IT-03 | IT | AC3·AC4·AC5 | NEW | — |
| IT-04 | IT | 기존 options·approvals 회귀 스위트 | INHERITED | 기존 테스트(V 상속 아님) |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | Composer bypass → (a) `orca:permission:setMode` → `ApprovalCoordinator` → `turn.live.setPermissionMode` / (b) `chat:send` → `SessionRuntime.pushTurn` → `handle.setPermissionMode` → CLI | 사람 실기 AC1 · edge (a) 코디네이터 → `coordinator.permission.test.ts:'%s %s settles %s'` · spawn 플래그 → VP-03 · CLI 수락 → VP-02 | not selected — 사람 실기 + 하위 pair 좌표 | EP-01 ① (1) |
| VP-02 | SD-01 ↔ ST-01 | REQUIRED | SDK `query({permissionMode, allowDangerouslySkipPermissions})` → CLI argv `--allow-dangerously-skip-permissions` → `isBypassPermissionsModeAvailable` → `set_permission_mode` | `gate:node docs/handoff/0261-bypass-flag-prod-devtools/probe-live-bypass.mjs` — A·B·C 판정 | required — 방향 확인: 케이스 A(플래그 없음)가 음성 대조로 거부를 관측해야 한다 | EP-01 ① (1) |
| VP-03 | AR-01 ↔ IT-01 | REQUIRED | `TurnRequest.permissionMode` → `ClaudeAdapter.sendMessage` options 스프레드 → `query()` · `complete()` → `runCompletion` options → `query()` | ① → `claude.executable-option.test.ts:'대화 query 는 명시 모드와 함께 플래그를 싣는다'` · `'모드를 명시하지 않은 대화 query 는 플래그도 싣지 않는다'` · ② → `'제목 생성 complete() 는 플래그를 싣지 않는다'` | not selected — options 객체 값을 직접 관측 | EP-01 (2) |
| VP-04 | AR-02 ↔ IT-02·IT-03 | REQUIRED | 소스 생성자 자리 → `webPreferences` 리터럴 → Electron | ① `index.ts` createWindow → `browser-window-devtools.test.ts:'%s — webPreferences 보안 베이스라인'` · ② `browser-session.ts` openWindow → 같은 케이스 + `browser-session.devtools.test.ts` | required — 구조 스캔(proxy)이라 M1~M8 을 자리마다 심어 red 확인 | EP-02 (2) |
| VP-05 | SD-02 ↔ ST-02 | REQUIRED | `devTools: import.meta.env.DEV` → electron-vite define(DEV=false) → `out/main/*.js` 생성자 | `gate:(cd app && npx electron-vite build) && node docs/handoff/0261-bypass-flag-prod-devtools/check-prod-bundle.mjs` | required — 번들 스캔(proxy)이라 M9a·M9b 로 red 확인 | EP-03 (2) |
| VP-06 | R-02 ↔ AT-02 | REQUIRED | 설치본 → 창 → 메뉴·단축키 | 사람 실기 AC7 · 하위 VP-04·VP-05 | not selected — 사람 실기 | EP-02 (2) |
| VP-07 | R-03 ↔ AT-03 | REQUIRED | DEV=true → `webPreferences.devTools === true` | ② → `browser-session.devtools.test.ts:'dev 빌드(DEV=true)에서는 devTools 를 연다'` · ① → `browser-window-devtools.test.ts` 표현식 단언(상수 아님) | not selected — M2·M4(VP-04)가 표현식 훼손을 덮는다 | EP-02 (2) |
| VP-08 | R-04 ↔ AT-04 | REQUIRED | 문서 자리 → `drift-check.sh` DA 행 | `gate:bash docs/handoff/0260-docs-handoff-resync/drift-check.sh check` · `gate:` scope sweep(§19) | required — 문자열 단언(proxy)이라 M10(DA 9행 각각 must 훼손)·M11(옛 사실 5자리 각각 복원) | EP-04 (9 + 5) |
| VP-09 | AR-03 ↔ IT-04 | REGRESSION | 기존 대화/제목 options 조립 | `claude.executable-option.test.ts` 기존 케이스 전부 · `src/main/adapters` · `src/main/features/approvals` 스위트 | not selected — 기존 직접 oracle | 0 — 이번 변경이 그 계약을 바꾸지 않는다 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/src/main` 수정 | `npm run lint` · `npm run typecheck` | 이번 변경이 낸 error |
| vitest 관련 스위트 | 신규·변경 테스트와 회귀 | `./node_modules/.bin/vitest run src/main/adapters src/main/infra src/main/features/approvals src/main/features/sessions` | DB 로드 스위트 bindings 실패는 환경 분리(app/AGENTS.md) |
| doc gates | docs·AGENTS 수정 | `doc-gate.sh check` · `drift-check.sh check` · `node app/scripts/check-doc-inventory.mjs --check` | 이번 변경이 낸 차집합 |
| message bus | 커밋 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| SDK 옵션 의미: bypass 사용 시 `true` 필요 | `app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` `allowDangerouslySkipPermissions` 주석 |
| SDK → CLI 매핑 | `sdk.mjs` `if(S)K.push(je("--permission-mode",S));if(b)K.push("--allow-dangerously-skip-permissions")` |
| CLI 라이브 전환 거부 | 바이너리 문자열 `code:"bypass_not_launched"` · `code:"bypass_disabled"` |
| 실측 A·B·C (SDK 0.3.296, 프롬프트 없음 = API 호출 없음) | A 플래그 없음 → `Cannot set permission mode to bypassPermissions because the session was not launched with --dangerously-skip-permissions` · B 플래그 → 수락 · C 플래그 + `disableBypassPermissionsMode:"disable"` → init 정상 · 전환 `…disabled by settings or configuration` |
| 실측 D (system/init.permissionMode, 'hi' 1턴) | 레포 settings `defaultMode: bypassPermissions`: 플래그+명시 default → `default` · 플래그+명시 없음 → `default` · local settings 도 같음 · 대조(project `acceptEdits`) → `acceptEdits` |
| 벤더 권한 평가 순서 | `docs/spec/claude/agent-sdk/permissions.md` 권한 평가 방식 — 훅 → 거부 → 모드 → 허용 → canUseTool |
| Electron 창 DevTools | `webPreferences.devTools` 미지정 = `true`(Electron 문서). 두 창 모두 미지정 — `index.ts` createWindow · `infra/browser-session.ts` openWindow |
| toolkit 단축키 | `@electron-toolkit/utils` `watchWindowShortcuts`: `is.dev`(= `!app.isPackaged`) 거짓이면 KeyI(Ctrl+Shift·Alt+Meta)·Ctrl+R 차단, 참이면 F12 로 `openDevTools` — `index.ts` `browser-window-created` 가 모든 창에 건다 |
| DEV 상수 접기 | `npx electron-vite build` 산출 `out/main/index.js` 에서 `managedWorktreesDir(import.meta.env.DEV)` 가 인자 없는 호출로 접힘 |
| vitest DEV 스텁 | `vi.stubEnv('DEV', false)` 가 import 한 모듈의 `import.meta.env.DEV` 를 바꾼다 (scratch 테스트 1/1 green, 파일 삭제) |
| 대화 모드 항상 명시 | `app/chat-turn/send.ts` `payload.permissionMode ?? DEFAULT_PERMISSION_MODE` · 연속 턴 `return { ...prepared, permissionMode: settled }` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| SDK `query(` 호출 | `rg -n 'query\(\{' app/src/main -g '!*.test.ts'` | 2 | `claude.ts` runCompletion · sendMessage |
| 라이브 모드 setter 호출 | `rg -n '\.setPermissionMode\(' app/src/main -g '!*.test.ts'` | 4 | `coordinator.ts`(턴 중 IPC) · `session-runtime.ts`(위임) · `claude.ts` pushTurn · `claude.ts` control 위임 |
| webContents 생성자 | `rg -n 'new\s+(\w+\.)?(BrowserWindow\|BrowserView\|WebContentsView)\s*\(' app/src/main -g '!*.test.ts'` | 2 | `index.ts` · `infra/browser-session.ts` |
| DevTools 지정·호출 | `rg -n 'openDevTools\|devTools' app/src` | 0 | 지정 없음 |
| 옛 사실 문장 | scope(`doc-gate.sh` `scope_files`)에서 `넘기지 않는다`·`코드가 열거나 막지 않는다` 중 두 주제 문장 | 5 | claude-code-spec §5.5·§14.3 · security §1.5 · TRD §9.3 · app/AGENTS 보안 베이스라인 |
| 옛 사실을 단언한 0260 DA 행 | `drift-assertions.tsv` | 4 | DA-SE03 · DA-AG5 · DA-CS4 · DA-CS6 |

### 수치 / 전칭 표현 검산

- "모든 webContents 생성자" — 반례 검색: `BrowserView`·`WebContentsView`·`<webview` 0건, `new BrowserWindow(` 2건.
- "production 대화 턴은 항상 명시" — `TurnRequest` producer 는 `send.ts` 최초 턴(기본값 대입)과 연속 턴(`settled`) 두 갈래, `sendMessage` 호출부는 `session-runtime.ts` 1곳.
- 문서 앵커 확인: claude-code-spec §5.5·§11·§14.1·§14.3 · adapters.md §1.7 · security.md §1.1·§1.5 · TRD §9.3 · app/AGENTS.md "보안 베이스라인" 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`·`SD-02`·`AR-01`·`AR-02`.
- 대화 spawn: `ClaudeAdapter.sendMessage` options = `permissionMode`(명시 시)만 — 가용성은 시작 모드가 bypass 일 때만 생긴다.
- 라이브 전환: default 로 시작한 채널에서 `setPermissionMode('bypassPermissions')` → CLI `bypass_not_launched` → 코디네이터 `catch → undefined` / `pushTurn` throw → SessionRuntime `markError` → 턴 오류.
- 창: 두 생성자의 `webPreferences` = 3 보안 키(+preload/partition), `devTools` 미지정 → 기본 `true`.

```text
send/setMode → ClaudeAdapter.sendMessage(options: permissionMode)
             → CLI(가용성 = 시작 모드가 bypass 일 때만) → live bypass 거부
createWindow / openWindow → new BrowserWindow({ webPreferences: {3키} }) → devTools 기본 true
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 대화 spawn: `permissionMode` 가 있으면 `{ permissionMode, allowDangerouslySkipPermissions: true }` 를 함께 싣는다(D-004). `complete()` 는 그대로.
- 라이브 전환: 같은 호출이 CLI 에서 수락된다. 정책 disable 은 CLI 가 계속 거부한다(실측 C).
- 창: 두 생성자의 `webPreferences` 에 `devTools: import.meta.env.DEV` — production 번들은 `false`, dev 는 `true`.
- 유지: 코디네이터 직렬화·실패 계약, SessionRuntime 오류 마감, optimizer 단축키 처리, 3 보안 키.

```text
send/setMode → ClaudeAdapter.sendMessage(options: permissionMode + allowDangerouslySkipPermissions)
             → CLI(가용성 = spawn 부터) → live bypass 수락 (정책 disable 은 거부)
createWindow / openWindow → new BrowserWindow({ webPreferences: {3키, devTools: DEV} })
             → electron-vite build: devTools:false · dev: true
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| state/contract | 대화 options 에 플래그 없음 | 명시 모드와 함께 플래그 | D-001·D-004 | AR-01 / VP-03 · `claude.ts` |
| data/control flow | 라이브 bypass 거부 → undefined·턴 오류 | 수락 | R-01 | SD-01 / VP-02 · probe |
| state/contract | `devTools` 미지정(기본 true) | `import.meta.env.DEV` | D-002·D-003·D-005 | AR-02 / VP-04 · `index.ts`·`browser-session.ts` |
| test seam/관측점 | 창 옵션을 보는 테스트 없음 | 구조 스캔 + electron mock 행동 + 번들 스캔 | 자리 전수 강제 | VP-04·VP-05·VP-07 |
| 문서 | "넘기지 않는다" · "코드가 열거나 막지 않는다" | 새 사실 + DA 행 교체 | D-006 | R-04 / VP-08 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `adapters/claude.ts` | SDK options 조립 (플래그 포함) | `TurnRequest` → `query()` | `features/sessions/session-runtime.ts` |
| `index.ts` (app 루트) | 본창 생성 | settings → `BrowserWindow` | Electron `whenReady` |
| `infra/browser-session.ts` | 로그인 창 생성 | `LoginWindowOptions` → `BrowserWindow` | `features/auth` (주입 포트) |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| AR-01 / VP-03·VP-02 | EP-01 `Options.allowDangerouslySkipPermissions` | `adapters/claude.ts` | `ClaudeAdapter` | 자리 2: ① `sendMessage` options(명시 모드와 함께 `true`) ② `runCompletion` options(부재) | ① 누락 → 라이브 bypass 거부(턴 중 미적용·다음 턴 오류) / 모드 없이 실림 → 시작 모드가 CLI 해석에 맡겨짐 ② 실림 → 도구 0 경로에 불필요한 권한 표면 |
| AR-02 / VP-04·VP-07 | EP-02 `webPreferences.devTools = import.meta.env.DEV` + 3 보안 키, 단일·최종 값 | 각 생성자 리터럴 | main 프로세스 | 자리 2: ① `index.ts` createWindow ② `infra/browser-session.ts` openWindow | 그 창의 DevTools 가 production 에서 열림 / 중복 키·뒤 spread 가 값을 덮음 |
| SD-02 / VP-05 | EP-03 번들 `devTools: false` | electron-vite define | 빌드 | 자리 2: 번들의 두 생성자 | 상수가 접히지 않거나 다른 값 |
| R-04 / VP-08 | EP-04 현재 사실 | 아래 목록 | 문서 | 새 사실 9자리 + 옛 사실 제거 5자리 + DA 행 9 | 문서가 코드와 다른 사실을 말함 / 옛 DA 행이 문서를 되돌리게 함 |

EP-04 새 사실 9자리 ↔ DA 행: ① claude-code-spec §5.5 플래그 표 행(DA-CS12 신규) ② §5.5 채택 문단(DA-CS4 교체) ③ §14.1 신규 행(DA-CS6 교체 — §14.3 옛 행은 must_not) ④ adapters.md §1.7 신규 행(DA-A15 신규) ⑤ security.md §1.1 코드 블록 `devTools` 줄(DA-SE13 신규) ⑥ security.md §1.5 DevTools 문단(DA-SE03 교체) ⑦ TRD §9.3 DevTools 행(DA-TR22 신규) ⑧ app/AGENTS.md 코드 블록 `devTools` 줄(DA-AG9 신규) ⑨ app/AGENTS.md DevTools 문장(DA-AG5 교체).

- 같은 규칙의 SSOT: 창 보안 베이스라인 = 각 생성자 리터럴(app/AGENTS.md "명시한다"), 강제는 구조 스캔 한 곳.
- `실패 의미`에 다른 게이트 의존: 해당 없음.
- 선택적 필드 의미: `allowDangerouslySkipPermissions` 미지정 = 가용성 없음(시작 모드가 bypass 가 아니면). `devTools` 미지정 = `true`.
- 외부 SDK 경계: `Options.allowDangerouslySkipPermissions?: boolean` — `as` 캐스트 불요.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/adapters/claude.ts` | 대화 options | `...(permissionMode ? { permissionMode: toClaudePermissionMode(permissionMode), allowDangerouslySkipPermissions: true } : {})` + 근거 주석 | `query` mock (AC3) |
| `app/src/main/index.ts` | 본창 | `webPreferences` 에 `devTools: import.meta.env.DEV` | 구조 스캔 (AC4) · 번들 (AC6) |
| `app/src/main/infra/browser-session.ts` | 로그인 창 | 같은 키 | electron mock (AC5) · 스캔 · 번들 |
| `app/src/main/adapters/claude.executable-option.test.ts` | AC3 | describe 1 · 케이스 3 | — |
| `app/src/main/infra/browser-window-devtools.test.ts` (신규) | AC4 | `source-scan` 으로 생성자 자리 추출 → 괄호 균형으로 인자·`webPreferences` 블록 → 키별 1회·값·spread 0 단언, 알려진 두 파일을 스캔이 찾는지 확인 | — |
| `app/src/main/infra/browser-session.devtools.test.ts` (신규) | AC5 | `vi.mock('electron')`(BrowserWindow·session 스텁) · `vi.stubEnv('DEV', false/true)` → `openLoginWindow` → 생성자 인자 단언 → 창 `closed` 로 정착 | — |
| `docs/handoff/0261-…/probe-live-bypass.mjs` (신규) | AC2 | 실제 SDK·CLI 로 A·B·C, 임시 디렉토리, 프롬프트 없음, 판정 표 + exit | — |
| `docs/handoff/0261-…/check-prod-bundle.mjs` (신규) | AC6 | `app/out/main/*.js` 생성자 자리 → `webPreferences` 블록 `devTools: false\|!1` 1회 · 소스 자리 수와 대조 | — |
| 문서 9자리 + `0260/drift-assertions.tsv` 9행 | AC8 | §10 EP-04 | drift-check |

### 테스트 가능성

- electron 의존 `browser-session.ts` 는 `vi.mock('electron')` 으로 import 한다(선례: `app/bootstrap.shutdown.test.ts` 등 `vi.mock('electron'` 10파일). 본창(`index.ts`)은 모듈 부작용이 커서 구조 스캔 + 번들 스캔으로 덮는다.
- 기존 `source-scan.ts`(`sourceFiles`·`stripCommentsAndStrings`·`toPosix`)를 재사용한다 — 문자열이 비워져도 `import.meta.env.DEV` 표현식은 남는다.
- DEV 양값은 `vi.stubEnv` 로 같은 프로세스에서 관측한다.

## 12. End-to-end 영향

### producer → consumer

```text
Composer(bypass) → IPC/chat:send → ApprovalCoordinator·SessionRuntime → ClaudeAdapter live setter → CLI
createWindow/openWindow → BrowserWindow(devTools) → 메뉴·단축키·openDevTools
```

- producer 기준: 플래그는 spawn 시 한 번, 모드는 매 전환 — 소비자(CLI)는 spawn 시 가용성을 정한다.
- consumer 파생 규칙: 해당 없음 — renderer·IPC 계약 불변.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `optimizer.watchWindowShortcuts`(dev F12 → `openDevTools`) | `npm start`(미패키징·production 번들)에서 F12 가 no-op 이 된다 — D-003 결과 | AC5·AC7 |
| respawn 경로 | 같은 `sendMessage` 를 지나 플래그가 함께 실린다 | AC3 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 플래그는 spawn 시점 가용성 — 채널 수명 동안 유지.
- 취소/중단·종료: 불변.
- retry/partial failure: 정책 disable 거부는 기존 실패 계약(턴 중 `undefined` · 다음 턴 오류) 그대로.
- **다중 저장소 쓰기**: 코드 쓰기는 해당 없음. 문서 사실의 사본은 현재 사실 문서 9자리 + 0260 DA 행 9 + 이 plan·INDEX — EP-04 가 전부 자리로 센다.

## 14. 성능 / 상한 / 최적화

해당 없음 — spawn 인자 1개, 창 옵션 1키.

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

해당 없음 — 배포 확장점(`docs/guides/closed-network-extensions.md`)이 창이나 SDK 권한 옵션을 노출하지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| "`allowDangerouslySkipPermissions` 는 넘기지 않는다" | claude-code-spec §5.5·§14.3 (0260) | D-001·§11 | 변경 — 사용자 결정 |
| "DevTools 는 코드가 열거나 막지 않는다" | security.md §1.5 · TRD §9.3 · app/AGENTS.md (0260) | D-002·§4 | 변경 — 사용자 결정 + 전제 정정 |
| `BrowserWindow` 보안 키 명시 | app/AGENTS.md 보안 베이스라인 | §11 | 유지·확장 (`devTools` 추가) |
| DEV 인라인 가드 관례 | security.md §1.7 | D-003 | 유지 |
| 격리는 훅이 진다(모드 독립) | `adapters/workspace-guard.ts` 헤더 | §5 파생 | 유지 — bypass 에서도 훅 deny 유효 |
| 라이브 전환 실패 = `undefined` | IPC_CONTRACT 권한 모드 라이브 전환 | §13 | 유지 — 실패 원인 하나가 사라질 뿐 |
| OQ9 기본 정책값 | PRD §11 | §6 | 유지 — 기본 모드 불변 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| bypass 진입 시점이 세션 도중으로 넓어져 `canUseTool` 게이트(위험 도구 승인 카드·중단 서브에이전트 재호출 차단)가 꺼지는 구간이 늘어난다 | 기존 bypass 의미(벤더 평가 순서) — 위험 모드 확인 UI·훅 deny 유지. 사용자 보고 + 후보 |
| 안전 근거가 CLI 동작(가용성·레포 settings 필터·정책 우선)에 기댄다 | D-004 로 시작 모드를 항상 명시 · probe 를 SDK 갱신 때 재실행 |
| Linux/macOS 를 root(비샌드박스)로 실행할 때 CLI root 거부 분기가 이 플래그로도 열리는지 미확인 | Windows 는 `process.getuid` 부재로 분기 자체가 없다 — 비대상 경로, 보고 |
| production 현장에서 DevTools 진단 불가 | 사용자 결정(D-002) — JSONL 로그·dev 빌드로 진단 |

- 되돌리기 어려운 결정: 없음.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/adapters/claude.ts` · `app/src/main/index.ts` · `app/src/main/infra/browser-session.ts`
- `app/src/main/adapters/claude.executable-option.test.ts` · `app/src/main/infra/browser-window-devtools.test.ts` · `app/src/main/infra/browser-session.devtools.test.ts`
- `docs/claude-code-spec.md` · `docs/arch/backend/adapters.md` · `docs/arch/backend/security.md` · `docs/TRD.md` · `app/AGENTS.md`
- `docs/handoff/0260-docs-handoff-resync/drift-assertions.tsv` · (필요 시) `docs/handoff/0192-doc-gate-baselines-as-data/baselines/*.tsv` regen
- `docs/handoff/0261-bypass-flag-prod-devtools/{probe-live-bypass.mjs,check-prod-bundle.mjs}` · `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `docs/handoff/AGENTS.md §구현 게이트의 정본`.
- 환경 제약: Electron 바이너리 없음(`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`) — AC1·AC7 은 사람 실기.
- 기본 정적 게이트: `npm run lint` · `npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/main/adapters src/main/infra src/main/features/approvals src/main/features/sessions`.
- 관측 스크립트: `node docs/handoff/0261-bypass-flag-prod-devtools/probe-live-bypass.mjs` · `(cd app && npx electron-vite build) && node docs/handoff/0261-bypass-flag-prod-devtools/check-prod-bundle.mjs`.
- 문서: `bash docs/handoff/0192-doc-gate-baselines-as-data/doc-gate.sh check` · `bash docs/handoff/0260-docs-handoff-resync/drift-check.sh check` · `(cd app && node scripts/check-doc-inventory.mjs --check)` · scope sweep `넘기지 않는다|코드가 열거나 막지 않는다` 중 두 주제 문장 0건.
- 사람 실기: AC1 · AC7.

## READY self-review

- [x] Decision Ledger 가 사용자 결정 2(원문 인용)와 설계자 결정 4를 ACTIVE 로 보존한다.
- [x] Part I 만으로 완료 상태가 설명된다 — §1 성공 문장·§5 상태표.
- [x] 조건절·이유절을 재해석하지 않았다 — "Production 빌드" 해석은 D-003 으로 분리·근거 명시.
- [x] Product/UX 핵심 동작이 AC 와 §9·§11 에 연결된다 — R-01 ↔ AC1~3, R-02 ↔ AC4·6·7, R-03 ↔ AC5, R-04 ↔ AC8.
- [x] AS-IS 와 TO-BE 가 같은 축(옵션·전환·창·문서)으로 있다.
- [x] Delta 각 행이 파일/AC 로 추적된다.
- [x] 사라진 책임 없음 — 옛 문서 문장은 교체(§10 EP-04).
- [x] 수치·전칭·외부 규약·앵커·기존 테스트를 실측했다(§8).
- [x] 각 AC 가 행동 단언·검증 수단·도달 경로를 가진다.
- [x] Baseline V1, 모든 NEW node 에 같은 레벨 REQUIRED pair, 영향받은 INHERITED(AR-03)는 REGRESSION.
- [x] 각 pair 의 경로·자리 수·자리별 좌표가 있고 proxy oracle(VP-02·04·05·08)만 적대 증거를 선택했다.
- [x] 운영 gate 가 열거됐다.
- [x] 사람 실기로 미룬 순수 로직 없음 — 옵션·`devTools` 값은 AC3·AC5.
- [x] semantic 목표를 proxy 만으로 검증하지 않는다 — 스캔(AC4)에 행동(AC5)·번들(AC6) 짝.
- [x] "X 가 쓰인다" 장치가 X 를 지웠을 때 실패한다 — M1·M3·M9, 형제 맞바꿈 M6, 중복·spread M5·M8.
- [x] 신규 계약의 SSOT·강제 지점·seam 이 있다.
- [x] 부팅/등록 기존 소비처(optimizer·respawn)를 확인했다.
- [x] producer/consumer 의미 확인 — renderer·IPC 불변.
- [x] 상한·one-way door — 해당 없음.
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: D-001~D-006 · §10 EP-01~EP-04 · §11 파일 표 그대로 구현했다.
- 이견 / 현실성 문제: 없음. VP-03 케이스 이름은 `'대화 query 는 명시 모드(%s)와 함께 플래그를 싣는다'`(`it.each` default·bypass 2행)로 구현했다 — 단언 행동은 plan 과 같다.
- ACTIVE Decision 과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-03 | EP-01 플래그 | sendMessage · runCompletion (2) | 2/2 | `rg -n 'query\(\{' app/src/main -g '!*.test.ts'` → 2 · `rg -n allowDangerouslySkipPermissions app/src/main -g '!*.test.ts'` → 1(`claude.ts` sendMessage) · ① → `claude.executable-option.test.ts:'대화 query 는 명시 모드(%s)와 함께 플래그를 싣는다'`(2) · `'모드를 명시하지 않은 대화 query 는 플래그도 싣지 않는다'` · ② → `'제목 생성 complete() 는 플래그를 싣지 않는다'` — 파일 20/20 green | — |
| VP-04·VP-07 | EP-02 webPreferences | index.ts · browser-session.ts (2) | 2/2 | `rg -n 'new\s+(\w+\.)?(BrowserWindow\|BrowserView\|WebContentsView)\s*\(' app/src/main -g '!*.test.ts'` → 2 · ① → `browser-window-devtools.test.ts:'%s — webPreferences 보안 베이스라인'`(index.ts) · ② → 같은 케이스(infra/browser-session.ts) + `browser-session.devtools.test.ts:'production 빌드(DEV=false)에서는 devTools 를 끈다 — 보안 3키·파티션은 그대로'`·`'dev 빌드(DEV=true)에서는 devTools 를 연다'` — 5/5 green | — |
| VP-05 | EP-03 번들 | 번들 생성자 (2) | 2/2 | `gate:(cd app && npx electron-vite build) && node docs/handoff/0261-bypass-flag-prod-devtools/check-prod-bundle.mjs` → `out/main/index.js:15186`·`:23124` devTools=false · 소스 2 = 번들 2 · exit 0 | — |
| VP-02 | EP-01 ① CLI 가용성 | (1) | 1/1 | `gate:node docs/handoff/0261-bypass-flag-prod-devtools/probe-live-bypass.mjs` → A·B·C PASS · exit 0 | — |
| VP-08 | EP-04 문서 | 새 9 · 옛 5 · DA 9 | 9/9 · 5/5 · 9/9 | `gate:bash docs/handoff/0260-docs-handoff-resync/drift-check.sh check` → 206행 공집합 · scope(50파일) 옛 사실 `grep -nE` 0줄 · 새 사실 표식 TRD:490 · adapters:82 · security:21·:123 · spec:236·:240·:475 · AGENTS:69·:76 | — |

- §10에 없는데 같은 불변식이 필요했던 지점: 없음 — webContents 생성자 반례(`BrowserView`·`WebContentsView`·`<webview`) 0건.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_BLOCKED — 사람 실기 AC1 대기 | edge (a) `coordinator.permission.test.ts:'%s %s settles %s'` green · spawn → VP-03 · CLI → VP-02 | not selected |
| VP-02 | REQUIRED | SELF_PASS | probe A·B·C | required — A(음성 대조)가 `not launched` 거부를 관측 |
| VP-03 | REQUIRED | SELF_PASS | 위 4케이스 | not selected — options 직접 관측 |
| VP-04 | REQUIRED | SELF_PASS | 스캔 3케이스 + 행동 2케이스 | required — M1~M8b 9/9 red |
| VP-05 | REQUIRED | SELF_PASS | 번들 gate | required — M9a·M9b 2/2 red |
| VP-06 | REQUIRED | SELF_BLOCKED — 사람 실기 AC7 대기 | 하위 VP-04·VP-05 | not selected |
| VP-07 | REQUIRED | SELF_PASS | `browser-session.devtools.test.ts:'dev 빌드(DEV=true)에서는 devTools 를 연다'` · 스캔 표현식 단언(index.ts) | not selected — M2·M4 가 표현식 훼손을 덮음 |
| VP-08 | REQUIRED | SELF_PASS | drift-check DA 9행 + scope sweep | required — M10 9/9 · M11 5/5 red(DA-CS6 결함 수정 후) |
| VP-09 | REGRESSION | SELF_PASS | `claude.executable-option.test.ts` 기존 16케이스 · `src/main/{adapters,infra,features/approvals,features/sessions}` 120파일 green | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 `index.ts` devTools 줄 삭제 | VP-04 선택 증거 | 최초 | `index.ts — webPreferences 보안 베이스라인` 1 | 잠김 |
| M2 `index.ts` `devTools: true` | VP-04 | 최초 | 같은 케이스 1 | 잠김 |
| M3 `browser-session.ts` devTools 줄 삭제 | VP-04 | 최초 | 스캔 1 + 행동 2 = 3 | 잠김 |
| M4 `browser-session.ts` `devTools: !import.meta.env.DEV` | VP-04 | 최초 | 3 | 잠김 |
| M5 `index.ts` 뒤에 `devTools: true` 중복 | VP-04 | 최초 | 1 | 잠김 |
| M6 `index.ts` devTools 를 webPreferences 밖 최상위 옵션으로(형제 슬롯 맞바꿈) | VP-04 | 최초 | 1 | 잠김 |
| M7 새 파일 `app/m7-window.ts` 에 devTools 없는 생성자 | VP-04 | 최초 | `app/m7-window.ts — …` 1 | 잠김 |
| M8a webPreferences 안 끝 `...extraPrefs` | VP-04 | 최초 | 1 | 잠김 |
| M8b webPreferences 뒤 `...overrides` | VP-04 | 최초 | 1 | 잠김 |
| M9a `browser-session.ts` `devTools: true` → 빌드 | VP-05 | 최초 | 번들 위반 1(`index.js:15186`) · exit 1 | 잠김 |
| M9b `index.ts` `devTools: true` → 빌드 | VP-05 | 최초 | 번들 위반 1(`index.js:23124`) · exit 1 | 잠김 |
| M10 DA 9행 must 문자열 각각 훼손 | VP-08 | 최초 | 9/9 해당 id 보고 · exit 1 | 잠김 |
| M11 옛 사실 5자리 각각 복원 | VP-08 | 최초 | 첫 실행 3/5 → DA-CS6 수정 후 5/5 | 잠김 |
| probe 케이스 A(플래그 없음) | VP-02 | 최초 | A 가 거부를 관측 | 잠김 |

- **분모 검산**: 선택 증거 14행(자리 26) · 인용 변이 0 · 새 oracle 0 — 새 장치 4개(스캔·번들·probe·DA 행)의 민감도는 위 선택 증거 행이 겸한다 = 표 행 14.
- **덮개 회귀**: 0건 — 교체한 DA 4행은 옛 must_not 을 그대로 두고 옛 사실 must_not 을 더했다. 매 변이 후 원본 복원 상태 green(스캔·행동 5/5, 번들 exit 0, drift 공집합).

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — 새 문구 없음. 전환 결과는 기존 IPC 응답·`session.updated` 가 운반 | — |
| seam 재배치 | 재배치 없음 | — |
| 이번에 만든 실패 경로가 Part I 상태표의 어느 행인가 | 정책 disable 거부 = 상태표 3행(기존 계약) | — |
| 실패가 “아무 일도 안 일어남”으로 보이지 않는가 | 정책 환경에서 턴 중 bypass 선택은 `undefined` → 선택 미적용 — 기존 동작 | §6 후보(정책 환경 bypass 메뉴) |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 불변 — 코디네이터 세대 검사 유지 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | DA-CS6 must_not 의 `[를는]` 이 drift-check 의 `LC_ALL=C` 에서 바이트 클래스로 읽혀 옛 문장 복원을 못 잡았다 | ✅ 선조치 — `(를\|는)` 교대식. 0260 TSV 의 다른 비ASCII 문자 클래스 0건 | M11 3/5 → 5/5 · `grep -cP` 0 |
| 2 | doc-gate `regen` 이 줄 번호를 키로 써서 이동한 기존 판정 14건(시제 13 · 경로 1)을 미판정으로 되돌렸다 | ✅ 선조치 — 이동량(security +3 · adapters +1 · AGENTS +1)으로 같은 키 판정 승계, 신규 2건 판정(`disableBypassPermissionsMode`=외부 · §1.5 `openDevTools`=참) | `doc-gate.sh check` 공집합 |
| 3 | `npm start`(production 번들·미패키징)에서 optimizer 의 F12 는 `openDevTools()` 를 부르지만 무효 | ⚠️ 보고만 — D-003 결과, security.md §1.5 에 적었다 | `index.ts` `browser-window-created` |
| 4 | root(비샌드박스) Linux/macOS 실행에서 CLI root 거부 분기가 이 플래그로도 열리는지 | ⚠️ 보고만 — plan §17. 이 환경은 `IS_SANDBOX` 가 설정돼 관측 불가 | `env` |

### 설계 대비 명시적 차이

- 없음 — 케이스 이름 표기만 다르다(설계 리뷰). 대체물이 없으므로 4축 표는 해당 없음.

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | app: `adapters/claude.ts` · `index.ts` · `infra/browser-session.ts` · `adapters/claude.executable-option.test.ts` · `infra/browser-window-devtools.test.ts`(신규) · `infra/browser-session.devtools.test.ts`(신규) · `app/AGENTS.md` / docs: `claude-code-spec.md` · `arch/backend/adapters.md` · `arch/backend/security.md` · `TRD.md` / handoff: 0260 `drift-assertions.tsv` · 0192 baselines 3 · 0261 `probe-live-bypass.mjs` · `check-prod-bundle.mjs` · plan · INDEX |
| 실행 명령 | §19 전부 + 변이 M1~M11 (scratch 러너, 매번 원본 복원) |
| **관측한 게이트 산출** | lint 0 error · 1 warning(`renderer/…/useTranscriptVirtualizer.ts` — 0261 무관 기존) · typecheck exit 0(`error TS` 0) · 대상 3파일 25/25 · 관련 스위트 129파일 중 120 green(1364 통과) — 실패 9파일은 전부 `infra/db/*`, 서명 `better_sqlite3.node … NODE_MODULE_VERSION` 9건(ABI 환경 기인) · doc-gate 공집합 · drift-check 206행 공집합 · inventory ok · probe exit 0 · 번들 exit 0 |
| V-pair 자기확인 | SELF_PASS 7 / SELF_BLOCKED 2(사람 실기 VP-01·VP-06) |
| 강제 지점 전수 | EP-01 2/2 · EP-02 2/2 · EP-03 2/2 · EP-04 새 9/9 · 옛 5/5 · DA 9/9 |
| **AC 자기보고**(`Criteria-Met`) | AC1 ⚠️ 사람 실기 · AC2 ✅ probe A·B·C PASS · AC3 ✅ 4케이스 green · AC4 ✅ 스캔 3케이스 + M1~M8b red · AC5 ✅ 2케이스 green · AC6 ✅ 번들 exit 0 · AC7 ⚠️ 사람 실기 · AC8 ✅ drift 공집합 + sweep 0줄 |
| **합계 검산** | `✅ 6 · ⚠️ 2 · ❌ 0 = 총 8` — 분모는 plan §7 의 AC1~AC8 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 최초 라운드. 0260 이 만든 drift-check DA 행에서 C 로캘 바이트 클래스 결함이 이번 턴 변이(M11)로 처음 드러났다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: `handoff-impl` §3 "선택한 적대 증거를 자리마다 심는다"가 잡았다.
- 반복해서 부딪히는 환경 한계: Electron 바이너리 없음(AC1·AC7 사람 실기) · better-sqlite3 ABI(DB 9파일).
- 현재 라운드·impl 턴: `r1`.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
