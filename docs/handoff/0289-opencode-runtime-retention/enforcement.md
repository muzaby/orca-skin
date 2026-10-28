# 0289 §10 — 강제 지점 정본

현재 코드의 의미 경계를 자리로 센다. 한 메서드 안의 동일 계약 운반은 한 자리이고, 이름이 바뀌어도 구현자가 기존 ID와 새 좌표의 대응을 남긴다. 신규 service 내부 책임은 그 service를 연결하는 기존 조립 자리와 함께 닫는다.

경로는 app/src 기준이다. oracle O 번호는 [plan §11](plan.md#11-구현-설계--oracle-좌표)의 파일·테스트명·진입·구별 입력·관측 좌표를 참조한다. “미착수”이며 이 표 자체가 실행 증거는 아니다.

## 자리 검색

저장소 루트에서 실행한다. 정규식의 주어는 소유/연결/설정/관측 값이며 신규 해법 이름으로 분모를 제한하지 않는다. 테스트·선언·미사용 helper·다른 하네스 전용 구현은 실행 자리와 구분한다.

~~~powershell
# Q1 A·I: 소유 수명, scope, bridge, process
rg -n 'acquire|release|retire|close|dispose|references|owners|spawn|terminate' app/src/main/adapters/opencode app/src/main/features/extensions/common/mcp app/src/main/app -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
# Q2 B·C: 준비/관측/승격의 실제 entry부터 renderer consumer까지
rg -n 'ComposerCatalog|preparedMcp|nativeResources|observation|promotePendingNewChat|sessionId|managedMcpChanged' app/src/main/app app/src/preload app/src/renderer/src/features/chat app/src/renderer/src/shared/api -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.testfixture.ts'
# Q3 D·E: 상태 읽기·연결·선택·제출·활동
rg -n 'openCodeNativeMcp|mcp\.|nativeResources|enabled|configurationPending|submit|pushTurn|projectResourcesIdle|setGlobal' app/src/main/adapters/opencode app/src/main/app app/src/main/features/extensions/common -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
# Q4 F: revision 생성·모든 운반·기록/초기화
rg -n 'managedMcp|ManagedMcp|spawned.*Revision|extensionsChanged|respawnInputs' app/src/main -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
# Q5 G: 탐색 입력·파일 I/O·감시·소비처
rg -n 'configuredOpenCode|effectiveOpenCodePlugins|openCodePluginInstallation|readOpenCodeProjectSettings|fingerprint|readFile|realpath|watchFile|OPENCODE_CONFIG|XDG_|ProgramData' app/src/main/adapters/opencode app/src/main/app -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
# Q6 H: 부팅 조건과 재평가/정리
rg -n 'lastBackend|lastCwd|resolveLandingCwd|gate|resuming|register\(|shutdown|prepareComposer' app/src/main/app app/src/main/features/gate -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
~~~

검색은 조사 후보를 넓게 반환한다. 실제 계약 경로의 자리 목록은 아래 표이며 새 운반 자리가 발견되면 누락/범위 판정과 함께 기록한다. query의 전체 hit 수를 자리 수로 사용하지 않는다.

## 고정 자리 목록

| ID | 파일 | 언제 강제 / 현재 심볼 | 직접 oracle | 실패 의미 |
|---|---|---|---|---|
| A1 | main/adapters/opencode/v1/server.ts | acquire | O3·O10 | 같은 profile에 중복 spawn 또는 retiring entry 재사용 |
| A2 | main/adapters/opencode/v1/server.ts | start / spawnProcess 경계 | O10·O11 | 실제 spawn/health 실패와 논리 시작 혼동 |
| A3 | main/adapters/opencode/v1/server.ts | acquire의 connection.release | O3·O10 | idle dependency가 있는데 process 종료 |
| A4 | main/adapters/opencode/v1/server.ts | acquire의 connection.retire | O3·O10 | 구 세대 retire가 replacement를 지움 |
| A5 | main/adapters/opencode/v1/server.ts | retireAll | O3·O10 | idle 구 세대 보유·active 강제 종료 |
| A6 | main/adapters/opencode/v1/server.ts | close | O10·O11 | quit 후 소유 자식 존속 |
| A7 | main/adapters/opencode/v1/instance-lifecycle.ts | acquire | O3 | 만료/획득 경합에서 두 instance 또는 예약 누락 |
| A8 | main/adapters/opencode/v1/instance-lifecycle.ts | release | O3 | TTL 전 scope abort 또는 cleanup ack만 보고 회수 |
| A9 | main/adapters/opencode/v1/instance-lifecycle.ts | disposed | O3 | old completion이 새 instance 삭제 |
| A10 | main/adapters/opencode/v1/instance-lifecycle.ts | close | O3 | shutdown timer/대기 promise 누수 |
| A11 | main/adapters/opencode/v1/session-context.ts | OpenCodeSessionContexts.acquire | O3·O10 | profile/cwd 격리·물리 dependency 채택 누락 |
| A12 | main/adapters/opencode/v1/session-context.ts | acquire의 finish / 신규 idle settled 연결 | O3·O10 | logical release와 physical 회수 혼동 |
| A13 | main/adapters/opencode/v1/session-context.ts | ServerContext.close 및 pool close 운반 | O3·O11 | 닫힌 context 또는 SSE가 살아 있음 |
| A14 | main/adapters/opencode/v1/adapter.ts | client의 bridge/projection/server/context 획득 | O3·O10·O11 | 같은 정의의 token/endpoint 회전 또는 실패 hold 누수 |
| A15 | main/adapters/opencode/v1/adapter.ts | client 반환 release | O3·O10 | caller가 TTL 대기하거나 dependency 조기 해제 |
| A16 | main/adapters/opencode/v1/adapter.ts | client의 획득 실패 catch 정리 | O3·O11 | 부분 획득의 hold 누수 |
| A17 | main/features/extensions/common/mcp/bridge.ts | acquire | O10·O11 | 같은 실행 정의 세대 endpoint 미공유 |
| A18 | main/features/extensions/common/mcp/bridge.ts | acquire 반환 release / generation 수거 | O3·O11 | retained context의 endpoint 조기 종료 |
| A19 | main/features/extensions/common/mcp/bridge.ts | close | O11 | shutdown 후 listener/call 존속 |
| B1 | main/app/composer-catalog.ts | prepareComposerCatalog | O2 | DB/실행 설정 재검증 없이 scope 공유 |
| B2 | main/app/composer-catalog-owner.ts | read | O1·O2 | pending owner 취소가 peer로 전파 |
| B3 | main/app/composer-catalog-owner.ts | adopt | O2 | acquire-before-release/generation guard 누락 |
| B4 | main/app/composer-catalog-owner.ts | release | O1·O2 | 중복 해제·늦은 lease 누수 |
| B5 | main/app/composer-catalog-owner.ts | invalidate | O1·O2 | pure toggle로 모든 part/owner 파기 |
| B6 | main/app/prepared-mcp-resources.ts | observe | O1·O2 | role/sender/request 경계 혼동 |
| B7 | main/app/prepared-mcp-resources.ts | read | O1·O2 | 관측 종료를 raw exception으로 반환 |
| B8 | main/app/prepared-mcp-resources.ts | releaseSender | O1·O2 | 다른 창 owner까지 취소 |
| B9 | main/app/prepared-mcp-resources.ts | close | O1·O2 | 관측/service 중복 close 또는 누수 |
| B10 | main/app/handlers/composer-catalog.ts | catalog handle/read | O2 | 다른 service에 catalog 연결 |
| B11 | main/app/handlers/composer-catalog.ts | release handle / window teardown | O2 | release와 owner 수명 분리 실패 |
| B12 | main/app/handlers/session-resources.ts | read(saved session) | O1 | saved cancellation이 IPC reject |
| B13 | main/app/handlers/session-resources.ts | readRequest(draft) 및 catch 운반 | O1 | draft 취소를 일반 실패로 포장 |
| B14 | main/app/handlers/session-resources.ts | observation handler 및 renderer clear | O1·O2 | 해제 후 계속 observe/읽기 |
| B15 | main/app/bootstrap.ts | catalog/prepared service 조립 | O2·O10 | 동일 target 두 prepare flight |
| B16 | main/app/bootstrap.ts | managed source.subscribe consumer | O2·O5·O6 | 변경 종류와 관계없이 blanket invalidation |
| B17 | main/app/bootstrap.ts | shutdown의 catalog/prepared 정리 | O2·O8 | service 중복 종료/후발 acquire |
| C1 | renderer/src/features/chat/harnesses/opencode/composer/useComposerCatalog.ts | scope/state 선택 | O9 | 승격만으로 snapshot 소멸 |
| C2 | renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.ts | subscribe / invalidation listeners | O9 | MCP toggle가 models/agents 무효화 |
| C3 | renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.ts | read result/epoch 채택 | O9 | part·generation·draft 대상 맞바꿈 |
| C4 | renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.ts | dispose | O9 | logical owner 해제 누락 |
| C5 | renderer/src/features/chat/store/chatStore.ts | promotePendingNewChat | O9 | 다른 pending draft 또는 worktree catalog 계승 |
| C6 | renderer/src/features/chat/lib/nativeResourceState.ts | subscribe / 마지막 listener 해제 | O9 | old read serial을 새 관측에 적용 |
| C7 | renderer/src/features/chat/lib/nativeResourceState.ts | readResources / observed 적용 | O9 | 취소 partial을 성공 empty 또는 토스트로 처리 |
| C8 | renderer/src/features/chat/lib/nativeResourceState.ts | managedMcpChanged | O9 | 철회된 후보 복원 또는 unrelated model 무효화 |
| C9 | renderer/src/features/chat/lib/nativeResourceState.ts | ensure / refresh / visible 재열기 | O9 | 5초 만료 connected 상태를 영구 신뢰 |
| D1 | main/adapters/opencode/v1/composer-cache.ts | read / part별 slot | O4 | freshness/flight epoch 혼동·실패 Promise 고정 |
| D2 | main/adapters/opencode/v1/session-context.ts | lease.mcp | O4 | control 적용 후 slot 관측 불일치 |
| D3 | main/adapters/opencode/v1/mcp-control.ts | apply / low-level status seed | O4 | 초기 status 이중 조회·prepare 재귀 |
| D4 | main/adapters/opencode/v1/channel.ts | nativeResources | O4 | slot 우회 HTTP·safe DTO 손상 |
| D5 | main/adapters/opencode/v1/channel.ts | refreshComposer | O4 | MCP 토글에 model/agent 재조회 |
| D6 | main/adapters/opencode/v1/session-context.ts | commands / rememberCommands | O4 | MCP 명령 변경 뒤 stale commands 실행 |
| E1 | main/app/handlers/mcp.ts | mcpUpdate 저장 후 deploy | O5·O6 | 저장 실패에 연결 적용/동일 토글 오분류 |
| E2 | main/app/handlers/extension-catalog.ts | extensionSetEnabled OpenCode native 경로 | O5 | 저장만 하고 live 적용 없음 |
| E3 | main/features/extensions/common/mcp/managed-source.ts | refresh fingerprint/change 분류 | O5·O6 | off/edit/auth를 같은 revision으로 처리 |
| E4 | main/adapters/opencode/v1/managed-mcp.ts | projectManagedMcp | O5·O11 | off 정의 누락 또는 toggle가 profile 변경 |
| E5 | main/adapters/opencode/v1/adapter.ts | mapMcpResources / managedMcpMentions | O5·O11 | 전체 revision 불일치만으로 후보 제거·stale 권한 |
| E6 | main/adapters/opencode/v1/mcp-control.ts | prepare/reconcile의 desired→applied 경계 | O5 | 상태 확인 전 applied 기록 |
| E7 | main/app/project-resource-sync.ts | apply / projectResourcesIdle | O5 | 공유 busy peer·background 누락 |
| E8 | main/adapters/opencode/v1/channel.ts | submit의 최초/후속 prompt 및 command 분기 | O5·O6 | 연결 변경 중 제출 또는 실패 후 낡은 도구 실행 |
| E9 | main/adapters/opencode/v1/channel.ts | pushTurn→submit의 예약 운반 | O5·O6 | warm 턴만 barrier 누락 |
| E10 | main/app/bootstrap.ts | activity/source/control→신규 opencode-mcp-reconcile 조립 | O5·O10 | reconcile에 실제 activity guard 미주입 |
| F1 | main/features/extensions/common/mcp/managed-source.ts | snapshot | O6·O11 | definitions/desired가 enabled users와 섞임 |
| F2 | main/features/extensions/common/builder.ts | ExtensionBuilder.build snapshot 운반 | O6·O11 | restart 축 누락 |
| F3 | main/app/chat-turn/runtime-entry.ts | respawnInputs 호출 | O6·O11 | 사용자 턴의 선택/정의 축 뒤집힘 |
| F4 | main/app/chat-turn-continuation.ts | respawnInputs 호출 | O6·O11 | 자동 연속 턴만 옛 revision |
| F5 | main/app/chat-turn/respawn-inputs.ts | spawned/current revision 조립 | O6·O11 | 한쪽만 definition 적용 |
| F6 | main/features/sessions/respawn-policy.ts | decideRespawn | O6·O11 | 다른 기존 respawn 조건 제거 |
| F7 | main/features/sessions/session-runtime.ts | spawn 기록 | O6·O11 | applied/definition 대신 source 전체 기록 |
| F8 | main/features/sessions/session-runtime.ts | teardown reset | O6·O11 | 재획득에 구 기록 유지 |
| F9 | main/adapters/opencode/v1/adapter.ts | extensionsChanged | O6·O11 | 정의 변경을 idle pool에 전달하지 않음 |
| F10 | main/app/bootstrap.ts | deployExtensions 및 auth syncPlugins source.refresh | O6·O11 | auth 철회/동일 deploy 의미 혼동 |
| G1 | main/adapters/opencode/v1/global-plugins.ts | effectiveOpenCodePlugins / fingerprint | O7 | 일반 config 변경 누락 |
| G2 | main/adapters/opencode/v1/configured-resources.ts | configuredOpenCode | O7 | 조상·부재·env/layout 의존성 누락 |
| G3 | main/adapters/opencode/v1/plugin-installation.ts | openCodePluginInstallation | O7 | 설치/realpath/package metadata 교체 누락 |
| G4 | main/adapters/opencode/v1/project-settings.ts | readOpenCodeProjectSettings | O7 | 내용 revision 없이 mtime만 신뢰 |
| G5 | main/app/opencode-global-watch.ts | check / notifyOpenCodePluginsChanged | O7 | cache invalidation과 plugin event 혼동 |
| G6 | main/app/project-resource-sync.ts | refresh의 policy.read / broadcast | O7 | old manifest/flight가 최신 관측 덮어씀 |
| G7 | main/adapters/opencode/v1/adapter.ts | client의 configured collision discovery | O7 | 캐시 bypass 또는 다른 env 결과 재사용 |
| G8 | main/app/harnesses/opencode/module.ts | draftResources/globalResources/configuredMcpFile 운반 | O7 | 설정/설치 DTO와 실제 cwd/env 불일치 |
| G9 | main/adapters/opencode/v1/configured-resources.ts | configuredOpenCodePluginSkillDirectories | O7 | plugin metadata cache가 skill source 누락 |
| H1 | main/app/bootstrap.ts | start 완료·register 뒤 warmup 연결 | O8·O10 | 부팅 main path에 웜업 없음/부팅 await 차단 |
| H2 | main/app/bootstrap.ts | gate 상태 재평가 consumer | O8·O10 | gate 허용/철회 반영 누락 |
| H3 | main/app/handlers/session-cwd.ts | resolveLandingCwd | O8·O10 | foreground와 다른 fallback 경로 |
| H4 | main/app/opencode-warmup.ts (신규) | eligibility / prepare / finally release | O8·O10 | CLI/gate/lastBackend 조건·hold 누락 |
| H5 | main/app/bootstrap.ts | shutdown warmup cancel | O8·O10 | shutdown 이후 late spawn |
| I1 | main/adapters/opencode/v1/server.ts | start request / 실제 spawn trace | O10·O11 | start 진입을 실제 spawn으로 계산 |
| I2 | main/adapters/opencode/v1/server.ts | terminate / child exit trace | O10·O11 | 요청/실제 종료 혼동 |
| I3 | main/adapters/opencode/v1/session-context.ts | instance/lease lifecycle trace | O10·O11 | 유예/retire/종료 이유 추적 불가 |
| I4 | main/adapters/opencode/v1/composer-cache.ts | slot hit/miss / HTTP trace | O10·O11 | cache hit를 외부 연결 완료로 혼동 |
| I5 | main/app/composer-preparation-service.ts (신규) | owner attach/detach/invalidate trace | O10·O11 | 취소 원인을 구별 못함 또는 secret 노출 |

## 분모 검산

A=19 · B=17 · C=9 · D=6 · E=10 · F=10 · G=9 · H=5 · I=5 → 90자리. 서로 다른 계약 edge가 같은 파일/함수에 있어도 ID가 다르면 시험에서 운반 값을 각각 관측한다.

| Pair | 자리 집합 | N |
|---|---|---:|
| VP01 | B·C | 26 |
| VP02 | A·B·C·D | 51 |
| VP03 | E·F | 20 |
| VP04 | G | 9 |
| VP05 | H | 5 |
| VP06 | A·C·E·F·I | 53 |
| VP07 | A·B·D | 42 |
| VP08 | E·F | 20 |
| VP09 | H·A | 24 |
| VP10 | B·C | 26 |
| VP11 | E·F·A | 39 |
| VP12 | G·H·C | 23 |
| VP13 | A7·A8·A9·A10 | 4 |
| VP14 | B2·B3·B4·B5·D1·D2·D3 | 7 |
| VP15 | E3·E4·E6·F1·F5·F6·F7·F8 | 8 |
| VP16 | G1·G2·G3·G4 | 4 |

## 직접 oracle의 한계

O3의 낮은 수준 fixture만으로 A14~19를 닫지 않는다. 해당 자리는 실제 adapter·server pool·bridge를 조립하는 O10/O11이 보완한다. O6의 runtime-entry/continuation과 O9의 실제 승격, O8의 실제 bootstrap 조립이 빠지면 해당 운반 자리는 미완료다.

preload/sessionApi는 shape와 전달을 바꾸지 않는 기존 edge다. O9의 계약 시험에서 이를 실제 wrapper로 통과시키고 public request·response를 관측한다. 새 wrapper를 도입하면 B/C의 해당 entry 자리에 대응시킨다.

## ΔV1 자리 — 2026-10-28

진단 trace만 더한다(plan D24~D26). 검색 주어는 MCP 상태 응답과 pool profile 산출이며, 저장소 루트에서 실행한다.

~~~powershell
# Q7 J: MCP status 응답·pool profile 구성요소·trace sink
rg -n 'mcp\.status\(|openCodeServerProfile\(|harnessEnvFingerprint\(|export function retentionTrace' app/src/main/adapters/opencode -g '*.ts' -g '!*.test.ts' -g '!*.testfixture.ts'
~~~

2026-10-28 출력 8행: native-resources.ts:89, retention-trace.ts:4, server-profile.ts:11·38, server.ts:122·132·325, session-context.ts:487.

| ID | 파일 | 언제 강제 / 현재 심볼 | 직접 oracle | 실패 의미 |
|---|---|---|---|---|
| J1 | main/adapters/opencode/v1/native-resources.ts | openCodeNativeMcp — status 응답의 MCP별 status·error 분류와 발행 | O12·O14 | 원문·이름 노출, 분류 누락, 반환값 변화 |
| J2 | main/adapters/opencode/v1/server.ts | acquire의 miss 분기 — live entry 구성요소 비교 후 발행 | O13 | hit 발행, 분할 미발행, 값 노출 |
| J3 | main/adapters/opencode/v1/server-profile.ts | openCodeServerProfile — key와 같은 입력으로 구성요소 해시 | O13·O14 | key와 diff 입력 불일치, 구성요소 누락 |
| J4 | main/adapters/opencode/v1/retention-trace.ts | retentionTrace data 타입 — 새 필드는 enum·불투명 ID만 | O12·O13 | 자유 문자열 운반 허용 |

제외: server.ts:122(`key()` — `databasePath`가 303행에서 entry 조회에만 사용, spawn 없음), server.ts:325(`opencode db path` 실행 profile), session-context.ts:487(pool이 발급한 url·headers로 만든 context 키 — pool 분할을 따른다).

| Pair | 자리 집합 | N |
|---|---|---:|
| VP06 (CHANGED) | A·C·E·F·I + J1~J4 | 57 |
| VP17 | J1·J2·J3·J4 | 4 |
| VP18 | J1·J3 | 2 |
| VP02 (REGRESSION) | D1·D2·D3 | 3 |
| VP07 (REGRESSION) | A1 | 1 |
| VP08 (REGRESSION) | E6·E8 | 2 |

V1 90자리 + J 4자리 = 94자리.

## ΔV1 변경 금지 자리 — D27

OpenCode MCP 토글의 현행 동작(노출·최초 설정값·제어 비활성)을 운반하는 자리다. ΔV1 구현 diff에 X1·X3~X5가 없어야 하고, X2는 J1이 같은 함수를 고치므로 반환 매핑이 그대로여야 한다.

| ID | 파일 | 현재 심볼 | 확인 | 실패 의미 |
|---|---|---|---|---|
| X1 | main/adapters/opencode/v1/mcp-control.ts | preview의 `canToggle: false`(123행), `set`의 거부(93행) | diff 부재 | 세션 화면 토글이 활성화되거나 값이 바뀜 |
| X2 | main/adapters/opencode/v1/native-resources.ts | openCodeNativeMcp 매핑의 `enabled`·`canToggle: false`(102~103행) | O12 반환 배열 동일 | 상태 표시나 토글 가능 여부가 바뀜 |
| X3 | main/adapters/opencode/v1/configured-resources.ts | globalOpenCodeResources의 `canToggle`(135행) | diff 부재 | MCP 탭 토글 동작 변화 |
| X4 | main/app/handlers/extension-catalog.ts | read의 선택 반영·extensionSetEnabled(30·51행) | diff 부재 | 저장·적용 경로 변화 |
| X5 | renderer/src/features/skills/{components/customize/CustomizeList.tsx, components/customize/CatalogToggle.tsx, hooks/useNativeMcpCatalog.ts} | 토글 노출·비활성 표시 | diff 부재 | 화면 노출·비활성 표시 변화 |
