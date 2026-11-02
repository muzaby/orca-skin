# 0290 r2 구현 증거

구현자의 자기확인 기록이다. 독립 검증 결과는 아니다. V1+ΔV1과 §10 고정 187자리, REQUIRED 18·REGRESSION 1을 유지했다. 아래 경로는 별도 표기가 없으면 app/src/ 기준이다.

## 실행과 관측

| Gate | 실제 관측 |
|---|---|
| 타입 | node/web/test 3구성 성공. render-prop 테스트 lint 수정 뒤 web 재검사, binding 단언 보완 뒤 test 재검사 성공 |
| Lint | 전체 검사에서 새 테스트 1오류·기존 경고 2. render-prop props 구성 수정 뒤 해당 파일 0오류·0경고. 기존 경고는 Timeline/useTranscriptVirtualizer의 incompatible-library |
| 전체 Vitest | 894파일·8,299케이스: 8,295 성공·2 실패·2 skip. registry 파일 재실행 성공. CLI 1건은 r1에 기록한 connected 자원 0/6과 같은 로컬 실패 |
| 보완 재실행 | registry + scroll restore 69/70 성공. 남은 registry 케이스만 재실행해 1/1 성공(기존 20초 예산, 16.374초). D1~D5 집중 실행 82/82 및 discovery 후속 10/10 성공 |
| Scripts | 144/144 성공 |
| 정적 운영 gate | inventory generated/prose/links OK; migration sync·append-only OK; test budget 16 suites OK |
| 변이 | 실행 112/112 assertion red 및 복원 후 green; 정적 12/12 검출 |
| Windows CI | [Windows CI](https://github.com/muzaby/orca-skin/actions/runs/41363264661) 성공: Vitest 891파일·8297케이스 성공, 3파일·3케이스 skip; scripts 144/144; 타입·lint·문서·migration·budget 성공. 로컬 Electron build 성공 |

명령은 r1 증거의 재현 명령과 같다. 전체 Vitest는 clean worktree에서 --maxWorkers=2 --reporter=json으로 실행했고, 원본 트리에서 한 번에 한 변이만 적용·검출·바이트 복원·같은 테스트 재실행했다. Node ABI 상태에서 모든 DB 테스트/변이를 마친 뒤 npm run build를 실행했다. 빌드의 prebuild가 Electron ABI로 전환했고 main·preload·renderer 번들이 모두 생성됐다. 현재 로컬 바이너리는 Electron ABI다. 실행 요약은 [r2-gate-summary.json](scan/r2-gate-summary.json)이다.

전체 검사 중 registry 1케이스는 28.8초, 파일 재실행에서는 27.7초 뒤 STACK_TRACE_ERROR로 실패했다. 기존 예산은 20초이며, 해당 케이스만 실행했을 때 코드·예산 변경 없이 16.374초에 통과했다. 호스트 부하에 따른 시간 예산 초과로 분리했다. 변이 실행 중 json-file.ts 복원 쓰기가 Windows UNKNOWN 오류로 한 번 중단됐다. clean worktree 원본으로 바이트를 복구하고 완료 ID부터 재개했다. 이 실패를 검출 성공으로 세지 않았다.

## 이번 보완의 직접 좌표

| 좌표 | 실행 경로와 구별 관측 |
|---|---|
| R2-01 | main/adapters/opencode/v1/discovery-cache.hold-race.test.ts: load와 hold 사이·load 진행 중 각각 변경 후 추가 편집 없이 통보(2케이스), hold 뒤 변경 control(1케이스). discovery-cache.test.ts의 rechecks a newly held scope when its startup check overlaps another scope probe는 진행 중 다른 scope 검사에 합류한 뒤 변경을 통보한다. main/app/project-resource-sync.initialization.test.ts는 baseline pending 동안 policy.read 0회, baseline 후 new 발행, 후속 later 발행을 본다. fingerprint-watch.test.ts는 supplied baseline startup 1회·close 취소 및 직렬/동일 지문/해제를 본다. |
| R2-02 | chat/harnesses/opencode/transcript/ScrollController.restore-race.test.ts: resize-first·scroll-first 각각 scrollTop 240 유지, 저장 state.top 240, 후속 row offset +60 뒤 300 복원. 기존 interaction 테스트의 프레임당 측정·unmount도 유지한다. |
| R2-03 | main/app/bootstrap.native-history.test.ts: broadcasts Claude %s config / %s file changes through the configured native paths. custom/default × installed/state 4조합. 잘못된 경로 변경 0회, 실제 경로 변경 공용 채널 1회·두 창 동일 payload, shutdown 이후 추가 0회. settings 파일 기존 테스트도 유지한다. |
| R2-04 | main/app/handlers/skills.test.ts: %s starts a post-write scan while an earlier list is pending. author/upload/setEnabled/remove 네 경로. 배포 완료 전 새 scan 0회, 완료 뒤 scan 2회, 이전 list 완료 뒤에도 새 flight 공유, post-write 항목 반환. |
| R2-05 | main/adapters/claude/plugin-catalog.test.ts: win32/linux 각각 중첩 cwd와 git root의 서로 다른 plugin flag. 동기/비동기 catalog 동일, Windows는 cwd 명령 1개·Linux는 root disabled로 0개. configuredClaudeCommands 소비도 단언한다. |
| R2-06 | main/app/bootstrap.native-history.test.ts의 reads native configuration through the registered module using stored backend and cwd: configured·commands 두 콜백에서 backend/cwd/project_id 각각 다른 지각 결과 거부. main/app/composer-catalog.test.ts의 does not start a native server after caller cancellation or session scope change during preparation: 세 필드 각각 변경 후 거부·native prepare 0회. Y12 project_id 비교 제거가 두 테스트를 실패시킨다. |
| R2-07 | main/adapters/opencode/v1/adapter.persistent.test.ts: reports a rejected client lease release once without exposing its error. 실제 SDK/어댑터 sendMessage와 eventBatches를 실행하고 client lease release 의존성만 실패시킨다. close를 반복해도 opencode.instance.dispose.failed 경고는 1회, PRIVATE_RELEASE_DETAIL 비노출. Y14 catch 보고 제거가 이 테스트를 실패시킨다. |

## 기존 자리의 현재 실행 좌표

아래 번호는 §10의 고정 자리 번호다. `전 케이스`는 전체 Vitest 실행 집합에 포함된 해당 파일의 케이스를 뜻한다. 삭제 자리의 직접 oracle은 §10 검색이며, 복원 변이에 대한 red 관측은 `scan/mutation-evidence.json`에 기록했다.

| 좌표 | 자리 | 직접 oracle / 구별 입력과 관측 |
|---|---|---|
| O-01 | VP-01 집계 | 아래 r2 gate 표. 전체 실행과 실패 파일 재실행 및 Windows CI 성공을 함께 판정했다. |
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

O-07·O-10·O-11·O-14·O-16·O-19는 위 R2 좌표를 함께 적용한다. O-01은 r1 수치를 승계하지 않았다. O-08의 새 차집합은 아래 r2 산출이다. 표의 모든 테스트 파일은 이번 전체 실행 집합에 존재하며, 나중에 강화한 binding 단언은 Y12 복원 실행으로 다시 확인했다. 남은 CLI 환경 실패 외 직접 좌표 테스트는 성공했다.

## §10 검색과 차집합

[47줄 검색 산출](scan/r2-ep-search.txt)을 고정 187자리 목록에 대조했다. 삭제 목표 잔여 0, watchFile 정본 1, discovery 반복 interval 0. 넓은 dead symbol 8줄은 보존한 하네스 내부 이름이며 !harnesses 검색은 0이다. BOM 일반 검색 5줄 중 adapter JSON 사본은 0, plan text BOM 처리는 유지한다. Git join main 전체 2줄은 정본 helper, adapter 사본 0이다. 동기 plugin catalog는 spawn 경로이므로 sync fs 5줄을 유지하고 async 메뉴는 R2-05에서 비교한다. capability 이름 분기 3곳은 계획의 유지 목록이다. canonical 검색은 VP-18 path 범위에서 사본 0이며 N1은 별도 NON_BLOCKING 기록을 유지한다.

[정적 집합 차집합](scan/r2-static-deltas.json): dead 44→33, test-only 52→45, 각각 (이동 경로 정규화 file,name,kind,category)의 신규 집합 0. i18n 미참조 64→56, 신규 키 0, 사라진 키는 계획 8개와 일치한다. 지정 삭제 14키 present 0. 합계만 비교하지 않고 실제 행/키 집합을 뺐다.

## 선택된 적대 증거

[실행 변이 정의·관측·복원](scan/r2-mutation-evidence.json): 112개. 이전 실행 정의 81 + verify 대체/추가 26 + F1/F2 2 + D1 초기화 보완 3. 인용된 못 잡음 8개 모두 검출했다. 이전 5개 적용 불가 정의는 verify가 사용한 6개 정확한 정의로 교체했으며, Y11은 경로 헬퍼 추출 후에도 nested cwd로 고정하는 동일 결함이다. 오류나 collection 실패만 난 실행을 red로 세지 않았다.

Y12는 첫 Windows 실행에서 49/49 green으로 남았다. 기존 verify CAUGHT 기록은 Linux 경로 의존 실패 6개를 담고 있었다. project_id만 달라지는 소비 경로를 R2-06으로 보강했다. Y14도 첫 Windows 실행에서 green이었으며, 기존 Linux 기록은 release 보고와 다른 경로의 실패 2개였다. R2-07을 추가한 뒤 같은 변이를 다시 실행해 최종 기록에 담았다. 런타임 수정은 필요하지 않았다.

[정적 민감도](scan/r2-static-sensitivity.json): 기존 check-oracle-sensitivity.cjs 실행 12개. 소유권 5·dead 분류/alias/production 소비·i18n 삭제/신규 키·IPC/심볼/CSS 검색·Windows 실패 ID 추출. 격리 probe를 사용해 production을 바꾸지 않았다.

## 환경과 다음 단계

로컬 CLI 통합은 수정 전 0eb7dc27의 별도 worktree에서도 이번 턴에 실행해 1/1 동일 실패(connected 자원 0/6)를 재현했다. 최종 실패 ID 집합에서 이 기준선 ID를 뺀 신규 차집합은 0이다. 테스트를 삭제하거나 skip 조건을 바꾸지 않았다. Windows CI 성공으로 AC1·VP-01을 닫았다. D1~D5 closed는 구현자 자기확인이며 다음 단계는 Claude의 독립 verify다. 제품 선택·공개 계약·새 의존성 변경은 없다.
