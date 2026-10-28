# 0289 ΔV1 r1.2 구현 관측

2026-10-29 구현자 자기확인이다. 독립 verify를 대신하지 않는다. 경로는 `app/src/` 기준이다. 기준은 [plan](plan.md)의 유효 V1+ΔV1과 [고정 자리](enforcement.md)다.

## 새 자리별 직접 oracle

| 자리 | 직접 oracle | 이번 턴 관측 |
|---|---|---|
| J1 | D12·D14 | SDK 응답 반환 유지; 상태·분류만 trace, sentinel 0 |
| J2 | D13·D14 | 같은 acquire trace 0; 다른 프로필 구성요소 이름만 발행 |
| J3 | D13·D14 | 같은 acquire trace 0; 다른 프로필 구성요소 이름만 발행 |
| J4 | D12·D13·D15 | trace sink에 원문·이름·경로 없이 상태·구성요소·ms 운반 |
| J5 | D15 | prompt와 command 각각 수락→assistant→part 1회; 다른 세션 무시 |
| J6 | D15 | prompt와 command 각각 수락→assistant→part 1회; 다른 세션 무시 |
| K1 | D17 | 동일 env 전역 enabled 이름만 false 투영; alias 충돌 보존; 파일 불변·두 cwd child 1 |
| K2 | D17 | 동일 env 전역 enabled 이름만 false 투영; alias 충돌 보존; 파일 불변·두 cwd child 1 |
| K3 | D17 | 동일 env 전역 enabled 이름만 false 투영; alias 충돌 보존; 파일 불변·두 cwd child 1 |
| K4 | D16a | 기본값<전역<프로젝트<관리 선택을 서로 다른 값으로 관측 |
| K5 | D16a·D16b·D18a | 정지 MCP와 빠른 MCP 독립; 이름별 단일 시도, 명시 refresh만 재시도 |
| K6 | D16a·D19 | 수동 read/reconcile HTTP 0; catalog·warmup 이후 HTTP |
| K7 | D16b·D16c·D16d·D18a·D18b·T36 | 1999ms 전송 0/2000ms 1; 멘션 정착·취소; off 실패와 대기 중 off에 전송 0 |
| K8 | D16a·D16c | 초기 연결·실패는 configurationPending 아님; 미적용 토글·해제 실패는 pending |
| K9 | D16a·D16c·D17 | pending/failed 표시에서도 enabled true·canToggle false |
| K10 | D16a·D16c·T36 | 수동은 무동작; 초기 연결은 busy 허용, 토글 on/off는 busy 보류 |
| K11 | D17·D18a | prepare는 connect 정착 전 반환; 실제 channel 전송 상한 |
| K12 | D17·T34 | 실제 adapter reconcile에서 수동 peer MCP 0, 활성 peer만 적용 |
| K13 | D17·D19 | lease.activate/read/control의 실제 SDK HTTP 및 역할 분리 |
| K14 | D17·D18a·D18b | 실제 prompt body에 connected 관리 alias만 포함; 일반/멘션/취소 경로 |
| K15 | D17·D18a·D18b | 실제 prompt body에 connected 관리 alias만 포함; 일반/멘션/취소 경로 |
| K16 | D19·T47 | 실제 두 handler·service·warmup: passive 전용 cwd 요청 0, catalog·warmup 각각 MCP 조회 |
| K17 | D19·T47 | 실제 두 handler·service·warmup: passive 전용 cwd 요청 0, catalog·warmup 각각 MCP 조회 |
| K18 | D19·T47 | 실제 두 handler·service·warmup: passive 전용 cwd 요청 0, catalog·warmup 각각 MCP 조회 |
| K19 | D19·T47 | 실제 두 handler·service·warmup: passive 전용 cwd 요청 0, catalog·warmup 각각 MCP 조회 |
| K20 | D19·T47 | 실제 두 handler·service·warmup: passive 전용 cwd 요청 0, catalog·warmup 각각 MCP 조회 |
| K21 | D20a·D20b | 실제 controller/slot: 마운트 MCP 0, 다섯 첫 의도 각각1, 반복0 |
| K22 | D23·D18b | renderer 생성과 공유 JSON quoted 파서 왕복, channel의 quoted 멘션 대기 |
| L1 | D21 | 실제 adapter.readHistory 두 cwd까지 exec 재사용; env 변경/파일 삭제만 재실행 |
| L2 | D21 | 실제 adapter.readHistory 두 cwd까지 exec 재사용; env 변경/파일 삭제만 재실행 |
| L3 | D21 | 실제 adapter.readHistory 두 cwd까지 exec 재사용; env 변경/파일 삭제만 재실행 |
| M1 | D22a·D22b·D22c | 같은 provider seed+확인 중·선택 유지, 다른 provider 제외, live 목록 교체 |
| M2 | D22a·D22b·D22c | 같은 provider seed+확인 중·선택 유지, 다른 provider 제외, live 목록 교체 |
| M3 | D22a·D22b·D22c | 같은 provider seed+확인 중·선택 유지, 다른 provider 제외, live 목록 교체 |

## 기존 자리의 재검증

기존 A~I 90자리의 좌표는 [V1 관측표](implementation-evidence.md#자리별-직접-관측)를 사용한다. 아래 T01~T54의 모든 테스트를 이번 실행 집합에서 다시 확인했다. T36은 D28에 따라 연결 장벽을 해제 장벽으로 바꿨다. T44의 충돌 항목은 관리 정의에서 제외하고 native `{enabled:false}` 덮어쓰기를 보존한다. D19는 T21을 확장하여 별도 passive/warmup cwd까지 실행한다. V1 보고의 직렬 status 조회 설명은 이번 비동기 연결 설계에 승계하지 않는다.

## 테스트 좌표

| 참조 | 파일:테스트명 |
|---|---|
| T01 | `main/adapters/opencode/v1/server.test.ts`: coalesces concurrent startup and passes isolated configuration, auth and preferences to its owned child |
| T02 | `main/adapters/opencode/v1/server.test.ts`: removes failed startup and health entries so an explicit retry launches a fresh child |
| T03 | `main/app/opencode-mcp-reconcile.test.ts`: traces warmup navigation two sends toggle expiry and quit through the real assembly |
| T04 | `main/adapters/opencode/v1/server.test.ts`: releases only the last owner, is idempotent and never retires a replacement generation |
| T05 | `main/adapters/opencode/v1/server.test.ts`: starts a new server for new owners after retireAll while existing owners keep theirs |
| T06 | `main/adapters/opencode/v1/instance-retention.test.ts`: retains until one 90000ms deadline and waits for acknowledgement plus event |
| T07 | `main/adapters/opencode/v1/instance-lifecycle.test.ts`: does not let the old externally disposed owner dispose or erase a replacement |
| T08 | `main/adapters/opencode/v1/instance-lifecycle.test.ts`: cancels cleanup and pending reacquisition at shutdown without waiting for an unresponsive transport |
| T09 | `main/adapters/opencode/v1/session-context.test.ts`: shares one global subscription and routes directory and authenticated server generations separately |
| T10 | `main/adapters/opencode/v1/adapter.instances.test.ts`: returns the complete consumer before idle expiry and retains the server until native completion |
| T11 | `main/adapters/opencode/v1/adapter.instances.test.ts`: returns the recover consumer before idle expiry and retains the server until native completion |
| T12 | `main/adapters/opencode/v1/adapter.instances.test.ts`: returns the history consumer before idle expiry and retains the server until native completion |
| T13 | `main/adapters/opencode/v1/adapter.instances.test.ts`: returns the channel consumer before idle expiry and retains the server until native completion |
| T14 | `main/adapters/opencode/v1/session-context.test.ts`: rejects acquisition after context shutdown before issuing a native request |
| T15 | `main/app/managed-mcp-lifecycle.test.ts`: shares generations and releases only owned resources |
| T16 | `main/features/extensions/common/mcp/bridge.integration.test.ts`: serves only authorized application tools |
| T17 | `main/app/composer-catalog.test.ts`: prepares draft and saved directory with the same production settings and env resolution as turns |
| T18 | `main/app/composer-preparation-service.test.ts`: cancels only the leaving waiter and releases a late shared acquisition once |
| T19 | `main/app/handlers/composer-catalog.test.ts`: refresh re-resolves and keeps old owner until replacement is ready |
| T20 | `main/app/bootstrap.opencode-warmup.test.ts`: wires source changes and the runtime activity guard through actual Bootstrap registration |
| T21 | `main/app/composer-preparation-service.test.ts`: shares targets across catalog resources and warmup through the production assembly |
| T22 | `main/app/handlers/session-resources.cancellation.test.ts`: settles draft observation cancellation before acquisition completes |
| T23 | `main/app/handlers/session-resources.cancellation.test.ts`: settles session observation cancellation before acquisition completes |
| T24 | `main/app/handlers/composer-catalog.test.ts`: shares pending acquisition for parts, isolates windows, and releases on navigation/crash/shutdown |
| T25 | `main/app/prepared-mcp-resources.test.ts`: keeps observed preparations alive and discards retired completions |
| T26 | `main/app/bootstrap.opencode-warmup.test.ts`: does not warm a different last backend and closes a pending warmup from Bootstrap.shutdown |
| T27 | `renderer/src/features/chat/store/composer-promotion.test.ts`: preserves only the matching promoted catalog through the real store, hook and controls |
| T28 | `renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.test.ts`: preserves model and agent flights on MCP-only changes |
| T29 | `renderer/src/features/chat/hooks/useNativeResources.test.ts`: owns draft observations and accepts only matching pushes while fencing an older read |
| T30 | `renderer/src/features/chat/hooks/useNativeResources.test.ts`: refreshes after resume and caches connected resources across partial reads and navigation until termination |
| T31 | `renderer/src/features/chat/hooks/useNativeResources.test.ts`: updates a peer popup cache from actual shared changes and fences older reads and exited generations |
| T32 | `renderer/src/features/chat/hooks/useNativeResources.test.ts`: revalidates a connected inventory on visible reopen after five seconds |
| T33 | `main/adapters/opencode/v1/adapter.test.ts`: shares prepared and live inventory slots until freshness expiry and retries failed reads |
| T34 | `main/app/opencode-mcp-reconcile.test.ts`: applies saved managed and native choices across idle peers with stable definitions and project precedence |
| T35 | `main/features/extensions/common/mcp/managed-source.test.ts`: separates definitions and desired choices through disable edit resolution rotation and revocation |
| T36 | `main/app/opencode-mcp-reconcile.test.ts`: defers busy/background peers and admits queued input only after successful disconnection mutation |
| T37 | `main/app/chat-turn/managed-mcp-revision.test.ts`: uses the opencode restart policy through both turn entries and resets its recorded revision |
| T38 | `main/app/chat-turn/managed-mcp-revision.test.ts`: uses the claude restart policy through both turn entries and resets its recorded revision |
| T39 | `main/adapters/opencode/v1/discovery-cache.test.ts`: shares global/project file probes and sees a dirty barrier before the one-second deadline |
| T40 | `main/adapters/opencode/v1/discovery-cache.test.ts`: tracks missing candidates, ancestor git boundaries, custom files and environment layouts |
| T41 | `main/adapters/opencode/v1/discovery-cache.test.ts`: revalidates installation realpaths and package descriptions without executing plugins |
| T42 | `main/app/opencode-global-watch.test.ts`: fans out once per external plugin change and ignores unchanged polls |
| T43 | `main/app/project-resource-sync.test.ts`: discards a revision invalidated during reading before any resource push |
| T44 | `main/app/managed-mcp-lifecycle.test.ts`: checks native identity collisions in each actual adapter environment before projection |
| T45 | `main/app/bootstrap.native-history.test.ts`: reads native configuration through the registered module using stored backend and cwd |
| T46 | `main/adapters/opencode/v1/configured-resources.test.ts`: retains plugin skill roots through cached metadata and refreshes removed installations |
| T47 | `main/app/bootstrap.opencode-warmup.test.ts`: starts eligible boot preparation without waiting for a stalled model and shares the landing target |
| T48 | `main/app/bootstrap.opencode-warmup.test.ts`: starts only after gate allows and cancels its owner when the gate closes |
| T49 | `main/app/bootstrap.opencode-warmup.test.ts`: starts only after resuming allows and cancels its owner when the gate closes |
| T50 | `main/app/opencode-warmup.test.ts`: uses the foreground cwd fallback and releases failed warmup for an explicit retry |
| T51 | `main/app/opencode-warmup.test.ts`: skips unavailable CLI and leaves an explicit foreground retry available |
| T52 | `main/app/project-resource-sync.test.ts`: shares one watcher, emits immediately while either peer is busy and reconciles only after all are idle |
| T53 | `main/app/project-resource-sync.test.ts`: counts foreground, queued, delivered, residual, background and wakeup activity as busy |
| T54 | `main/app/handlers/composer-catalog.test.ts`: invalidates live preparation owners and emits only their safe generation identity |
| D12 | `main/adapters/opencode/v1/native-resources.test.ts`: traces secret-free MCP status classes without changing the returned resources |
| D13 | `main/adapters/opencode/v1/server.test.ts`: traces which profile components split the pool key without values |
| D14 | `main/adapters/opencode/v1/diagnostics.test.ts`: classifies MCP errors and diffs profile components |
| D15 | `main/adapters/opencode/v1/adapter.persistent.test.ts`: traces prompt acceptance assistant start and first part in order for command<br>traces prompt acceptance assistant start and first part in order for prompt |
| D16a | `main/adapters/opencode/v1/mcp-connection.test.ts`: activates directories connects desired MCPs independently and admits submissions within the bound |
| D16b | `main/adapters/opencode/v1/mcp-connection.test.ts`: settles mentioned connections and cancels admission without cancelling a shared attempt |
| D16c | `main/adapters/opencode/v1/mcp-connection.test.ts`: defers toggle mutations while busy and blocks submission on removal failure but not connect failure |
| D16d | `main/adapters/opencode/v1/mcp-connection.test.ts`: rechecks removal when choices change during the bounded admission wait |
| D17 | `main/adapters/opencode/v1/adapter.test.ts`: projects disabled global MCP overrides and connects them through the directory manager |
| D18a | `main/app/opencode-mcp-reconcile.test.ts`: sends the first prompt within the bound while a global MCP connection hangs |
| D18b | `main/app/opencode-mcp-reconcile.test.ts`: waits for an explicitly mentioned global MCP and handles cancelled admission<br>waits for an explicitly mentioned global MCP and handles failed admission |
| D19 | `main/app/composer-preparation-service.test.ts`: shares targets across catalog resources and warmup through the production assembly |
| D20a | `renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.test.ts`: requests the MCP part once on the first intent signal |
| D20b | `renderer/src/features/chat/store/composer-promotion.test.ts`: requests MCP once through the real controller and OpenCode slot on first attachment intent<br>requests MCP once through the real controller and OpenCode slot on first input intent<br>requests MCP once through the real controller and OpenCode slot on first menu intent<br>requests MCP once through the real controller and OpenCode slot on first paste intent<br>requests MCP once through the real controller and OpenCode slot on first send intent |
| D21 | `main/adapters/opencode/v1/server.test.ts`: reuses the database path across MCP projections of one storage profile |
| D22a | `renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.test.ts`: seeds stale models for the same profile and replaces them with the live list |
| D22b | `renderer/src/features/chat/store/composer-promotion.test.ts`: seeds only non-authoritative models after a cwd mismatch<br>seeds only non-authoritative models after a worktree reservation mismatch |
| D22c | `renderer/src/features/chat/store/composer-promotion.test.ts`: does not inherit the catalog selected before the provider changed |
| D23 | `shared/plugin-mention.test.ts`: parses plugin mention tokens identically to the renderer token format |

고정 자리 − 보고 자리 = ∅, 보고 자리 − 고정 자리 = ∅(124 ID). T 좌표 − 이번 green 테스트 = ∅(54 참조). 이는 ID 대응 검산이며 행동 증거는 각 테스트의 구별 입력·관측이다.

## 검색·현재 구현 좌표

| 검색 | 후보 행 | 파일 |
|---|---:|---:|
| Q1 | 529 | 59 |
| Q2 | 1104 | 86 |
| Q3 | 160 | 35 |
| Q4 | 125 | 20 |
| Q5 | 122 | 34 |
| Q6 | 144 | 24 |
| Q7 | 8 | 5 |
| Q8 | 40 | 7 |
| Q9 | 33 | 14 |
| Q10 | 34 | 7 |

Q1~Q10을 정본 명령으로 재실행했다. Q7의 줄바꿈된 `.command(` 호출과 신규 helper의 책임을 보충 검색(`pluginMentionIds|profileComponents|diffProfileComponents|openCodeStorageProfile|OpenCodeTurnTrace|onInputIntent|openCodeInputIntent|composerModelStore|\.command\(`)으로 대조했다. 후보 hit 수는 자리 분모로 쓰지 않았다.

| 새 내부 edge | 고정 자리 승계 | 목록과의 차이 |
|---|---|---|
| diagnostics·turn-trace | J1~J6 | 분류·프로필 해시·턴 관측을 helper로 분리 |
| defaults·managedMcpReferences·admission signal | K1~K15·K22 | 초기 기본값·멘션 대기·전송 취소를 같은 directory 경계에서 전달 |
| modelStore·inputIntent·Module·공통 onInputIntent | K21·M1~M3 | 다섯 신호와 임시 seed의 실제 controller/선택기 연결 |
| storage profile·databasePaths | L1~L3 | pool 서버 키와 별도의 저장소 캐시 |
| fixture 이동 | 시험만 | app fixture를 adapter subtree로 옮기고 기존 경로는 재export; production 경계 위반 제거 |

새 public IPC/DB 채널·형식은 없다. 고정 목록 밖의 별도 제품 경로는 추가하지 않았다. 기존 legacy history 소비/메타 선언·같은 ID의 caller/helper는 별도 자리로 부풀리지 않았다.

## 선택된 변이

원본 bytes를 저장하고 한 변이씩 실행한 뒤 원복·동일 suite green을 확인했다. M6의 한쪽 분류 치환 예비 실험은 아래 분모에서 제외하고 양쪽 맞바꿈 재실행을 썼다.

| 자리 | 심은 결함 | red 케이스 | 원복 green |
|---|---|---:|---:|
| M1-F3 | restart에 total revision | 1 | 3 |
| M1-F4 | restart에 total revision | 1 | 3 |
| M1-F5 | restart에 total revision | 3 | 3 |
| M1-F7 | restart에 total revision | 1 | 3 |
| M2-C3 | models/agents 맞바꿈 또는 승격 제거 | 3 | 10 |
| M2-C5 | models/agents 맞바꿈 또는 승격 제거 | 1 | 10 |
| M3-B15 | resources 별도 service | 1 | 2 |
| M4-H1 | warmup 시작/gate/종료 제거 | 2 | 5 |
| M4-H2 | warmup 시작/gate/종료 제거 | 2 | 5 |
| M4-H5 | warmup 시작/gate/종료 제거 | 1 | 5 |
| M5-J1 | 원문 오류 또는 env 값 노출 | 1 | 5 |
| M5-J2 | 원문 오류 또는 env 값 노출 | 1 | 35 |
| M6-J1-swap | timeout↔refused 맞바꿈 | 1 | 1 |
| M7-J2 | hit 발행 또는 config env 구성요소 제외 | 1 | 35 |
| M7-J3 | hit 발행 또는 config env 구성요소 제외 | 1 | 35 |
| M8-K1-project | project 또는 disabled 전역을 덮어쓰기 대상에 포함 | 1 | 26 |
| M8-K1-off | project 또는 disabled 전역을 덮어쓰기 대상에 포함 | 1 | 26 |
| M9-K7-bound | 상한 제거 또는 멘션 대기 제거 | 1 | 7 |
| M9-K7-mention | 상한 제거 또는 멘션 대기 제거 | 2 | 7 |
| M10-K16 | resources 역할을 활성 역할로 교체 | 1 | 2 |
| M10-K17 | resources 역할을 활성 역할로 교체 | 1 | 2 |
| M11-K9 | pending enabled=false | 1 | 4 |
| M12-L1 | 저장소 키 대신 실행 투영 키 | 1 | 35 |

선택 증거 V1 10 + ΔV1 13 · 이전 verify 인용 변이 0 · 별도 신규 구조적 oracle 0 = 23행. 행동 oracle은 production 코드를 실행하며 추가한 실패 표시·대기 중 off 시험은 해당 red→green 직접 재현으로 잠갔다. 실패 표시 시험: 수정 전 1 red/3 green, 수정 후 포함 suite 4 green.

## 게이트 산출

직접 vitest 최종 실행은 34파일 270 pass/2 fail이었다. 두 실패는 수동 조회의 연결 전제를 활성화 이후로 바꿨고, 최종 5파일 77 pass/0 fail을 파일별로 교체한 집계는 **34파일 272 pass/0 fail/0 skipped**다. 전체 저장소 테스트를 한 번에 통과했다고 주장하지 않는다. 원본 report는 로컬 work/0289-delta-final.json·0289-delta-last.json이고 이번 T/D 좌표는 모두 이 집합 안에 있다.
