# 0290 r1 구현 증거

구현자의 자기확인 기록이다. 독립 검증 결과는 아니다. 유효 계약은 plan의 V1 + ΔV1이며, 아래 경로는 `app/src/` 기준이다.

## 재현 명령

```powershell
cd app
npm run typecheck
node node_modules/eslint/bin/eslint.js src scripts
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=vitest-result.json
node --test "scripts/*.test.mjs"
node scripts/check-migrations-appendonly.mjs
node scripts/check-doc-inventory.mjs --check
node scripts/check-test-budgets.mjs
npm run build
```

DB 테스트 전 Node ABI는 `npm test`의 pretest로 보장했다. 빌드는 DB 테스트·DB 변이 검증을 마친 뒤 실행했으며 Electron ABI로 전환했다. 현재 로컬 바이너리는 Electron ABI다.

```powershell
# 저장소 루트
node docs/handoff/0290-simplify-0254-0289/scan/dead-exports.cjs --out dead-current.tsv
node docs/handoff/0290-simplify-0254-0289/scan/i18n-unreferenced.cjs
node docs/handoff/0290-simplify-0254-0289/scan/i18n-unreferenced.cjs --absent docs/handoff/0290-simplify-0254-0289/baseline/i18n-remove-keys.txt
node docs/handoff/0290-simplify-0254-0289/scan/vitest-failed-ids.mjs app/vitest-result.json
```

## 강제 지점별 직접 좌표

아래 번호는 §10의 고정 자리 번호다. `전 케이스`는 전체 Vitest 실행 집합에 포함된 해당 파일의 케이스를 뜻한다. 삭제 자리의 직접 oracle은 §10 검색이며, 복원 변이에 대한 red 관측은 `scan/mutation-evidence.json`에 기록했다.

| 좌표 | 자리 | 직접 oracle / 구별 입력과 관측 |
|---|---|---|
| O-01 | VP-01 집계 | Windows 전체 실행 886파일·8,256케이스: 8,241 성공·13 실패·2 skip. 변경에 따른 테스트 대역 12실패를 고친 뒤 해당 파일 재실행 성공. 남은 CLI 1실패는 변경 전 트리에서도 같은 `connected` 자원 0/6으로 재현. 실패 ID 신규 차집합 0. |
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

## 검색 차집합과 제외 근거

| 집합 | 관측 |
|---|---|
| §10 고아 채널·legacy·구 catalog 조립·구 로고/PlanTile 파일 | 삭제 목표 잔여 0. `watchFile`은 공통 구현 1곳, skills/discovery의 제거 대상 interval 0. |
| EP-08 넓은 `AssistantSegment` 텍스트 검색 | 6줄은 유지 대상 하네스 전용 파일 경로 4줄·Claude 로컬 alias 사용 2줄. 삭제 대상 `components/transcript/AssistantMessage.tsx`의 export는 0. §17에서 보존한 두 하네스의 AssistantSegment를 삭제 목록에 넣지 않았다. |
| EP-09 BOM 검색 | `JSON.parse`와 결합된 어댑터 사본 0. `plan-text.ts`의 계획 텍스트 BOM 정규화는 JSON 읽기와 다른 규칙이며 유지. |
| EP-13 능력 분기 | 계획이 보존한 OpenCode 전용 UI 분기 3곳만 남음. CwdPanel 이름 분기·openCodeLanding 0. |
| EP-18 | canonical 사본 0·정본 1, variant 판정 1, isRecord 정본 1, 가드 0, wire null 변환 1, auth 연결 분기 1, orcaGroupFirst 0. |
| 미사용 export | Windows 경로 정규화 보정 후 기준선과 현재를 같은 스캐너로 측정. 신규 dead/test-only 집합 차집합 0. 새 사망 선언 Avatar·backend 설치 훅·업데이트 state/progress schema·rightPanelTileIds도 제거. |
| i18n | 지정 삭제 14키 present 0. 전체 미참조 56키 − 기준선 64키 = 0줄. 삭제 때문에 새로 미참조가 된 backend 상태/능력 키도 제거. |

## 결함 주입 재현

[mutation-evidence.json](scan/mutation-evidence.json)에 production 파일, 정확한 교체 전/후 문자열(정규식은 pattern/flags), 실행한 테스트 파일, 실패한 테스트명을 저장했다. 별도 작업 사본에서 한 변이씩 적용하고 `cd app; node node_modules/vitest/vitest.mjs run <tests...> --maxWorkers=1`로 실행한 뒤 복원했다. 전체 86변이는 assertion 실패로 red이며 collection 오류를 red로 세지 않았다.

정적 oracle 12건은 파일명/분류·alias 소비·production 소비·i18n 삭제/신규 키·금지 심볼·금지 토큰·이동 모듈 소유권·Windows 실패 ID 추출의 민감도 확인이다. 원본 작업 트리에는 변이를 적용하지 않았다. [정적 재현 스크립트](scan/check-oracle-sensitivity.cjs)는 저장소 루트에서 실행하며 임시 산출만 `.git/0290-evidence/`에 쓴다.

## 최종 운영 gate

[Windows CI](https://github.com/muzaby/orca-skin/actions/runs/41288104219)가 성공했다. Vitest 888파일·8,278케이스 성공, 3파일·3케이스 skip; Node 스크립트 144/144 성공; ESLint 오류 0·기존 react-hooks/incompatible-library 경고 2; 타입 3구성·migration·문서 inventory/링크·test budget 통과. 로컬 Electron build도 성공했다.

환경 조건에 따라 생략된 파일은 managed-mcp.cli.integration, artifact-sdk-live, native-storage.integration이다. 로컬에서는 첫 CLI 통합을 실행했고 변경 전/후 동일 실패를 별도로 기록했다.

## 환경 한계

로컬 doc inventory의 생성 내용·prose 검사는 통과했지만, 무시된 기존 제3자 checkout `.tmp/opencode-dev`·`app/.temp/opencode`의 문서 링크 10개가 전체 링크 검사를 실패시킨다. 해당 디렉터리는 수정하지 않았다. 깨끗한 checkout의 Windows CI에서는 동일 문서 gate가 통과했다.

로컬 CLI 통합 실패는 변경 전/후 모두 `advertises and calls managed MCP through the supported CLI`에서 connected 자원이 0/6인 동일 증상이다. 0건을 성공으로 바꾸거나 테스트를 삭제하지 않았다.
