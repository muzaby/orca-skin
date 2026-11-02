# 0290 r3 구현 증거

구현자 자기확인이다. V1+ΔV1·REQUIRED 18/REGRESSION 1·고정 187자리·AC 23을 유지한다.

## 게이트와 환경

- [Windows CI](https://github.com/muzaby/orca-skin/actions/runs/41378268434): Vitest 892파일·8,301케이스 성공, 3파일·3케이스 skip; scripts 144/144; 타입·lint·문서·migration·budget 성공.
- 로컬 타입 node/web/test 성공; lint 0 error·기존 incompatible-library warning 2; scripts 144/144; 문서·migration·budget 성공.
- 로컬 전체 실행: 895파일·8,304케이스에서 8,294 성공·8 실패·2 skip. 시간 예산 초과 7건은 코드·예산 변경 없이 해당 테스트명으로 재실행해 7/7 성공. CLI connected 자원 0/6 실패 1건은 수정 전 64047af9 코드에서도 같은 테스트명·assertion으로 재현했다. 잔여 실패−기준선 차집합 0; CI에서는 기존 조건으로 CLI가 skip됐다.
- 소스 변경은 production 1파일과 테스트 1파일이다. 별도 checkout에 같은 두 파일을 복사해 전체 gate를 실행하고, 원본에서 결함을 한 번에 하나씩 심고 원래 바이트로 복원했다.
- DB 검사는 현재 Node ABI에서 수행했다(`ensure-sqlite-abi node`: already ok). 새 의존성·IPC·영속 포맷·UI 문구 변경 0.
- 상세 수치는 [gate summary](scan/r3-gate-summary.json), 결함별 실패 테스트명과 정상 결과는 [실행 기록](scan/r3-mutation-evidence.json)에 있다.

## 이번 보완의 직접 좌표

경로 접두는 `app/src/`다. 신규 파일은 `main/adapters/opencode/v1/discovery-cache.poll-race.test.ts`다. watchFile/unwatchFile·타이머·시계와 readFile 반환 시점을 제어하며 실제 `run`·`hold`·`poll`·파일 읽기/쓰기·지문 코드를 실행한다.

| 좌표 | 경로·구별 입력·관측 |
|---|---|
| R3-01 | `notifies an edit made after the content read but before dependency registration`: 실제 readFile의 내용을 받은 직후 파일을 편집하고 이전 내용을 반환. poll 후 통보 1회·새 값 반환·반복 poll 추가 0. Z01 읽기 뒤 stat 변이에서 1실패 |
| R3-02 | `notifies an overlapping reload once and keeps its latest dependencies: same-value`: old→polled change 읽기를 보류한 동안 invalidate+run으로 같은 새 내용을 읽음. 구 r2에서 0회, 수정 후 1회. 검증자 원본 F3도 green |
| R3-03 | 같은 테스트의 `newer-value`·`new-file`: 보류 중 더 최신 값 또는 다른 파일을 재로드. 이전 pass 뒤 통보 1회 유지, 버린 파일 편집 0회, 최신 파일 후속 편집 1회. Z03 manifest 가드 제거에서 2실패 |

수정 전 신규 4케이스 중 D7 세 갈래가 실패(통보 0)했고 수정 뒤 4/4 성공했다. 관련 fingerprint/project 초기화·기존 discovery를 합쳐 최초 집중 실행 5파일·17케이스 성공. 기존 oracle은 삭제하지 않았다.

## 상속 자리별 직접 좌표

O-02~O-19의 기존 직접 oracle 테스트는 유지했다. 아래 좌표의 테스트를 이번 전체 gate로 실행했고, 수정한 VP-07 ④는 R3-01~03으로 보강했다. R2-01~R2-07의 세부 입력은 [r2 증거](implementation-evidence-r2.md#이번-보완의-직접-좌표)를 함께 인용한다.

| 좌표 | 자리 | 직접 oracle / 구별 입력과 관측 |
|---|---|---|
| O-01 | VP-01 집계 | 아래 r3 전체 gate·CI 및 환경 분리 결과. |
| O-02 | VP-02 #1~3 | `renderer/src/features/skills/hooks/useNativeMcpCatalog.test.ts:refreshes on backend push and focus, coalesces busy and locked pushes and stops after unmount` — 30초 추가 조회 0, backend 구별 push, focus, busy/lock 합류, 해제 후 0. |
| O-03 | VP-03 #1~2 | `main/adapters/opencode/v1/native-history.test.ts`의 missing·probe failure 케이스와 §10 legacy 검색 0. SDK 404는 missing, probe 실패+SDK 성공은 unavailable, 이전 source 불일치에는 SDK 조회. |
| O-04 | VP-04 #1~7·9~19 | §10 고아 IPC 검색: production 0·계약 문서 0. `main/app/handlers/session-resources{,.sync,.cancellation,.claude-assembly}.test.ts` 전 케이스로 남은 자원 응답·취소·스코프·Claude 조립을 실행. |
| O-04 | VP-04 #8 | `main/app/project-resource-sync.test.ts:serializes the same project key and continues after failure` — 첫 action deferred 동안 같은 key의 둘째 action 미시작, 성공·실패 양쪽 뒤 큐 진행. |
| O-05 | VP-05 #1~3 | `main/app/composer-catalog.test.ts:wires the public handler through the production resolver and returns its shutdown cleanup` 및 configuration/acquire 실패·취소·draft/saved 케이스. 구 조립 심볼 0, 실제 조립의 필수 owners 인자는 typecheck로 확인. |
| O-06 | VP-06 #1~5 | 구 app 최상위 파일 5개 부재. 이동한 warmup·MCP reconcile·global watch·prepared MCP·Claude processes의 기존 테스트 실행. 공통 모듈에서 각 이동 모듈 import를 심으면 `harness/ownership` 오류(5/5). |
| O-07 | VP-07 #1~4 | `main/infra/config/fingerprint-watch.test.ts:serializes checks, notifies once for a changed fingerprint and releases every file on close`; `main/app/harnesses/opencode/global-watch.test.ts`, `main/app/project-resource-sync.test.ts`, `main/adapters/opencode/v1/discovery-cache.test.ts` 전 케이스; Claude 조립은 O-19. 동일 지문 0·변화 1·close 이후 0. |
| O-08 | VP-08 #1~29 | §10 삭제 대상 검색·실제 파일 부재·dead export/i18n 스캔. dead 44→33, test-only 52→45; `(name,kind,category)` 신규 차집합 0. i18n 미참조 64→56, 신규 차집합 0, 삭제 키 present 0. CSS 두 테마 삭제 토큰 0. 문서 inventory·link CI gate. |
| O-09 | VP-09 #1~4 | `main/app/native-config-boundaries.test.ts`의 `carries BOM JSON through ...` 3케이스와 `preserves existing BOM-prefixed settings through plugin state writes` — configured resources, sync/async plugin catalog, project settings, plugin state를 실제 fs로 실행. `json-file.test.ts`의 ENOENT·비객체·파싱 오류와 소비자 기존 케이스 병행. |
| O-09 | VP-09 #5~7 | 같은 파일의 Git-root consumer 3케이스: 깊이 3 cwd에서 Claude project path·Claude native project state·OpenCode 자원에 루트 값이 전달됨. `git-root.test.ts`의 루트 없음·비-ENOENT 오류도 실행. 탐색 1단계 변이에서 소비자 3개와 헬퍼 1개가 실패. |
| O-09 | VP-09 #8~14 | `main/adapters/claude/{configured-resources,plugin-catalog,project-reconciliation}.test.ts`의 선택/우선순위/외부 플래그 케이스 — true·false·배열·객체 구별. `main/adapters/opencode/v1/{native-resources,plugin-installation}.test.ts`의 문자열/tuple spec 케이스. #14는 고아 디렉터리 함수 삭제로 소멸. |
| O-10 | VP-10 #1~2 | `main/adapters/opencode/v1/abortable-fetch.test.ts` 및 `session-context.test.ts`의 shutdown·지각 SDK 결과·directory peer 케이스. abort 후 body cancel·throw, 종료한 lease와 생존 peer 구별. |
| O-10 | VP-10 #3~4 | `main/adapters/opencode/v1/adapter.test.ts`의 managed MCP revision/권한 케이스. choices·노출 필터 각각 반전 시 1케이스씩 실패. |
| O-10 | VP-10 #5~11 | `adapter.persistent.test.ts`의 dispose 실패, `main/app/project-resource-sync.test.ts`의 native root/idle boundary, `main/app/bootstrap.native-history.test.ts`의 scope 변경 거부, `composer-catalog.test.ts`의 취소/세션 변경, `session-context.test.ts`의 lifecycle. 삭제된 공유 경로는 O-04, options 필수 항은 typecheck와 실제 소비 테스트 병행. |
| O-11 | VP-11 #1~4 | `channel.native-resources.test.ts:shares one configuration read between plugin and skill projections in a channel inventory`; `native-resources.test.ts`의 deferred 동시성; `claude/plugin-catalog.test.ts:projects asynchronous menu reads identically to spawn without re-reading skill contents`; `main/app/skill-catalog.test.ts` 전 케이스. |
| O-12 | VP-12 #1~10 | `shared/ui/HarnessLogo.render.test.ts`; `engine/common/components/{EngineCard.render,AgentEnvironmentView.interaction}.test.ts`; `skills/components/customize/SourceHeading.render.test.ts`; `chat/components/AgentModeToggle.test.ts`, `composer/modelMenu0215.render.test.ts`, `harnesses/registries/brand-surfaces.test.ts`; `app/SidebarUserButton.brand.test.ts`. 각 소비자의 viewBox·톤을 구별해 단언. |
| O-12 | VP-12 #11~15 | `shared/harness.test.ts`의 shortLabel·능력 표, `ChatTitleBar.copy.test.ts`의 두 하네스·null 기본값 실제 clipboard, 엔진 메뉴 및 `chat/lib/{composerSkills,attachMenuModel}.test.ts`의 source label. `chat/harnesses/common/rightpanel/plan0215.render.test.ts`의 locale별 feedback hint 4케이스·하네스별 빈 설명 2케이스는 실제 `tileById(...).Content`를 렌더. |
| O-13 | VP-13 #1~11 | `chat/components/CwdPanel.surface.test.ts` — 구현 전 생성한 클래스 스냅샷 4개와 동일. 두 하네스의 6개 cwd 슬롯 각각 맞바꿈에서 실패(12변이). |
| O-13 | VP-13 #12~22 | `pages/NewChatLandingPage.harness.test.ts:renders the harness landing and preserves draft and attachment state` — 실제 Landing→Composer에서 context DOM 순서, 입력·첨부 보존. `brand-surfaces.test.ts`의 presentation 값. Composer 클래스·inline/below·Landing 전달 변이 모두 실패. |
| O-13 | VP-13 #23~29 | `chat/store/chatStore.harness.test.ts`의 기존 Work draft seed·fresh draft·OpenCode continuity 거부; `chatStore.test.ts`의 Claude fork/handoff; `chatStore.{panelTiles,background-open}.test.ts`; `chat/reducer/chatReducer.harness.test.ts`의 subagent·permission default. 7자리별 반전 변이 모두 실패. |
| O-14 | VP-14 #1~3 | `engine/harnesses/opencode/ProviderForm.interaction.test.ts`의 모델·헤더 추가/편집/제거; `chat/harnesses/opencode/transcript/ScrollController.interaction.test.ts`의 프레임 내 scroll 3회→측정 1회·unmount 취소. |
| O-15 | VP-15 #1 | `main/adapters/opencode/v1/native-history.test.ts` — previous checkpoint 일치 시 client 0; source 변경·probe 실패·404 경계도 구별. client 선행 변이 4실패. |
| O-15 | VP-15 #2~4 | `main/features/history/native-sync.test.ts:parses a stored payload once and returns the freshly committed snapshot for projection`; `main/app/handlers/session.load.test.ts:reuses the refreshed snapshot through the handler without parsing its payload again`; `main/app/chat-turn/native-session.test.ts:passes a stored snapshot and matching cursor on cold resume, but bypasses them for unsettled recovery`. |
| O-15 | VP-15 #5~6 | `main/features/history/native-history.db.test.ts:keeps row identities and touches only changed messages while deleting absent native IDs` 및 FTS·rollback·cursor 케이스. 변경 없는 rowid 유지·행 갱신 수 관측. SQL prepare는 생성자 16개(종전 17호출 중 bind 동일 SQL 공유), replace 반복 뒤 prepare 증가 0. |
| O-16 | VP-16 #1~2 | `project-resource-sync.test.ts:captures runtime targets once per stable tick across three project entries`; `handlers/skills.test.ts:joins concurrent list scans and starts a fresh scan after a mutation`; `bootstrap.native-history.test.ts:keeps the newer skill scan in the cache when a pre-mutation scan finishes late`. |
| O-16 | VP-16 #3~6 | `claude/plugin-catalog.test.ts:reads defaults from settings alone without traversing installed plugin trees`; `project-settings.test.ts:parses shared native state once per file fingerprint and refreshes after replacement`; `claude/native-history.test.ts`의 bounded concurrent candidates·hashed bytes; `main/app/skill-catalog.test.ts`의 realpath 횟수. |
| O-16 | VP-16 #7~11 | `opencode/v1/map.replay.test.ts`의 4,096건 이후 원 delta 재전달 0; `native-resources.test.ts`의 skill roots 1벌; `server-profile.test.ts:computes executable identity once and delays diagnostic components until requested`; `session-context.test.ts:normalizes each subscription once and each directory event once across peers`; `features/extensions/common/mcp/managed-source.test.ts`의 peek 비복제. |
| O-17 | VP-17 #1~4 | `chat/harnesses/opencode/rightpanel/tiles.memo.test.ts:shares one projection across four components and invalidates each input reference independently`; 기존 Panel/AgentViews·composerCatalogState 테스트; `shared/hooks/useReducedMotion.test.ts`의 media change·listener cleanup. |
| O-18 | VP-18 #1~7 | `main/adapters/common/harness-config.test.ts`의 키 순서; `infra/db/background-journal-key.test.ts` 고정 hash; `app/composer-catalog.test.ts:shares preparation identity for reordered settings and changes it for different values`; `opencode/v1/{settings,model-listing,composer-catalog}.test.ts`의 disabled variants. 정규화 3·filter 3 복원 변이 모두 실패. |
| O-18 | VP-18 #8~12 | `server.list-models.test.ts`의 args/env/signal·60초/버퍼, `server.cli.test.ts`의 --version·15초, `server.database-path.test.ts`의 db/path·cwd/env. `adapter.list-models.test.ts` 위임 및 `bootstrap.native-history.test.ts` retireAll. |
| O-18 | VP-18 #13~19 | `main/app/{connection-views,handlers/providers}.test.ts`의 null wire; `features/auth/login-free.test.ts`의 plugin/runtime snapshot·connect reject; `chat/lib/attachMenuModel.test.ts`의 스킬 순서, `chat/harnesses/common/composer/Composer.native-menu.test.ts`의 Orca 플러그인 우선. 6개 관련 되돌리기 변이 실패. |
| O-19 | VP-19 #1~3 | `main/app/bootstrap.native-history.test.ts:broadcasts each OpenCode plugin revision after retiring servers without an owner`, `broadcasts Claude global changes only on the common channel and closes both watchers on shutdown` — 실제 register 콜백·두 방송 payload·shutdown 실행. |
| O-19 | VP-19 #4~6 | `preload/index.test.ts`에서 실제 preload와 renderer sessionApi를 함께 실행해 callback/unsubscribe 전달 확인. 테스트 파일만 기존 배선 테스트에 합쳤다. 훅의 backend별 행 변경·unmount는 O-02. |

## 자리 검색·적대 증거

- [§10 검색](scan/r3-ep-search.txt) 47행을 이전 결과와 문자열로 대조해 차집합 0. 고정 187자리의 삭제·SSOT·전달 좌표는 그대로이며 발견한 목록 밖 신규 자리 0.
- [미사용 집합](scan/r3-static-deltas.json): dead 33·test-only 45, 신규 `(name,kind,category)` 0. i18n 56·신규 0·지정 삭제 키 present 0.
- [정의](scan/r3-mutation-definitions.json) 134 ID와 실행 기록의 누락·초과·중복 차집합 0. assertion red 130·동치 1·정상 재현 green 3. collection 오류는 검출로 세지 않았다.
- 이전 잡음은 그대로 red. 이전 `못 잡음` Z01·Z03은 red, F3는 정상 코드 green 및 D7 조기 반환 복원 red. Z16은 53케이스 green이며 release의 실제 소비 경로가 1회 호출/소유 참조로 제한되는 기존 근거를 다시 읽었다(`channel.ts` finally·`adapter.ts` finally·`composer-preparation-service.ts` released/ref).
- M101은 추출된 `claudeLocalSettingsRootAsync` 호출을 cwd로 바꾸는 같은 결함으로 재지정했다. Z03은 r3 분기 안에서 manifest를 무조건 대입하는 동일 결함이다. 나머지 이전 교체식은 그대로 적용했다.
- M 계열은 이전에 실패한 테스트 파일을 실행했다. 나머지 파일은 전체 gate에 남았으며, 동일한 무변이 파일 집합의 이미 얻은 green은 재사용했다. 기록의 `restored.source`는 그 실행 ID다.
- [정적 12건](scan/r3-static-sensitivity.json): N3의 세 검색은 실제 source에 심어 기록 명령의 0→1을 관측했다. export scanner도 실제 parts.ts에 partsStructured를 복원해 dead로 분류됨을 확인했다.

## 재현 명령

```powershell
# app/에서, ABI를 바꾸지 않는 실행
npm run typecheck
node node_modules/eslint/bin/eslint.js ./src ./scripts
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=<report.json>
node --test scripts/*.test.mjs
node scripts/check-doc-inventory.mjs --check
node scripts/check-test-budgets.mjs
node scripts/check-migrations-appendonly.mjs
```

결함 실행은 r3 정의의 file에 replacement를 한 번 적용하고 tests를 Vitest로 실행한 뒤 바이트로 복원한다. 정상 실행의 실패 집합을 빼서 새 assertion 실패만 검출로 센다. 공개 CI에는 결함을 올리지 않았다.
