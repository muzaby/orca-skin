# 0289 r1 구현 관측 좌표

이 문서는 구현자 자기확인의 좌표다. 독립 verify를 대신하지 않는다. 경로는 `app/src/` 기준이며, 실제 통과한 테스트의 이름을 인용한다. 자리의 의미·분모는 [enforcement.md](enforcement.md)가 정본이다.

## 자리별 직접 관측

| 자리 | 직접 oracle | 구별 입력 / 관측 |
|---|---|---|
| A1 | T01 | 동시 acquire가 소유 child 하나와 같은 인증 endpoint를 공유 |
| A2 | T02 | startup/health 실패 뒤 새 child로 명시 재시도 |
| A3 | T03 | 두 send까지 child/bridge 1, 90초 뒤 dispose ack/event·exit, secret 미노출 |
| A4 | T04 | old release/retire가 replacement를 제거하지 않음 |
| A5 | T05 | retireAll 후 새 generation, 기존 owner 유지 |
| A6 | T03 | 두 send까지 child/bridge 1, 90초 뒤 dispose ack/event·exit, secret 미노출 |
| A7 | T06 | 89,999ms 유지·90,000ms dispose, ack와 event 모두 대기 |
| A8 | T06 | 89,999ms 유지·90,000ms dispose, ack와 event 모두 대기 |
| A9 | T07 | old disposed owner가 replacement를 지우지 않음 |
| A10 | T08 | shutdown이 timer·대기 acquire를 정착 |
| A11 | T09 | directory와 인증 server 세대를 구별·한 global SSE 공유 |
| A12 | T10·T11·T12·T13 | complete/recover/history/channel 반환은 즉시, native 완료까지 dependency 유지 |
| A13 | T09·T14 | 마지막 정리 뒤 모든 SSE stream 취소, 종료 context에서 native 요청 0 |
| A14 | T03 | 두 send까지 child/bridge 1, 90초 뒤 dispose ack/event·exit, secret 미노출 |
| A15 | T10·T11·T12·T13 | complete/recover/history/channel 반환은 즉시, native 완료까지 dependency 유지 |
| A16 | T15 | 실제 bridge endpoint: 보유 시 살아 있음·정의 retire/획득 실패 뒤 닫힘 |
| A17 | T03 | 두 send까지 child/bridge 1, 90초 뒤 dispose ack/event·exit, secret 미노출 |
| A18 | T15 | 실제 bridge endpoint: 보유 시 살아 있음·정의 retire/획득 실패 뒤 닫힘 |
| A19 | T16 | 인가·철회·실행 중 호출 취소와 listener 정리 |
| B1 | T17 | 실제 DB/provider/env 해석 입력과 adapter prepare 결과 |
| B2 | T18 | sender 하나 취소·peer 완료, late lease release 정확히 1 |
| B3 | T19 | replacement 획득 뒤 previous release |
| B4 | T18 | sender 하나 취소·peer 완료, late lease release 정확히 1 |
| B5 | T20·T54 | 실제 owner invalidation과 안전 generation 방송; register에서 definition만 invalidate, toggle은 reconcile |
| B6 | T21 | 두 실제 IPC+warmup: 동일 owner 문자열의 role 격리, resolve/prepare 각각 1 |
| B7 | T22·T23 | draft/saved 해제는 disconnected+partial·generation 없음, late release 1 |
| B8 | T25 | sender 해제·late completion 폐기, close 두 번 뒤 owned lease 해제 1·후속 read 없음 |
| B9 | T25 | sender 해제·late completion 폐기, close 두 번 뒤 owned lease 해제 1·후속 read 없음 |
| B10 | T21 | 두 실제 IPC+warmup: 동일 owner 문자열의 role 격리, resolve/prepare 각각 1 |
| B11 | T24 | 다른 창과 role 소유 분리, navigation/crash/shutdown 해제 |
| B12 | T22·T23 | draft/saved 해제는 disconnected+partial·generation 없음, late release 1 |
| B13 | T22·T23 | draft/saved 해제는 disconnected+partial·generation 없음, late release 1 |
| B14 | T22·T23 | 실제 observation handler 해제 뒤 pending 읽기는 safe partial |
| B15 | T21 | 두 실제 IPC+warmup: 동일 owner 문자열의 role 격리, resolve/prepare 각각 1 |
| B16 | T20 | 실제 register: definition retire/invalidate 1, toggle reconcile 1, busy guard·deploy/auth refresh |
| B17 | T26 | 실제 shutdown 경로가 pending warmup/service owner를 종료 |
| C1 | T27 | 실제 store/hook/controls 및 IPC wrapper: 서로 다른 model/agent와 flight 승계·old owner 해제 |
| C2 | T28 | MCP event 뒤 model/agent flight·snapshot 유지 |
| C3 | T27 | 실제 store/hook/controls 및 IPC wrapper: 서로 다른 model/agent와 flight 승계·old owner 해제 |
| C4 | T27 | 실제 store/hook/controls 및 IPC wrapper: 서로 다른 model/agent와 flight 승계·old owner 해제 |
| C5 | T27 | 실제 store/hook/controls 및 IPC wrapper: 서로 다른 model/agent와 flight 승계·old owner 해제 |
| C6 | T29 | 동일 scope push만 채택·old read serial 폐기 |
| C7 | T30 | partial 결과에 기존 관측 보존·종료 generation 폐기 |
| C8 | T31 | actual shared changes가 peer cache 갱신·old generation 복원 금지 |
| C9 | T32 | 5초 전 재열기는 hit, 이후 HTTP 재조회 |
| D1 | T33 | prepared/live MCP 공유·5초 만료·실패 retry·명시 refresh, model/agent 유지·commands live 재조회 |
| D2 | T33 | prepared/live MCP 공유·5초 만료·실패 retry·명시 refresh, model/agent 유지·commands live 재조회 |
| D3 | T33 | prepared/live MCP 공유·5초 만료·실패 retry·명시 refresh, model/agent 유지·commands live 재조회 |
| D4 | T33 | prepared/live MCP 공유·5초 만료·실패 retry·명시 refresh, model/agent 유지·commands live 재조회 |
| D5 | T33 | prepared/live MCP 공유·5초 만료·실패 retry·명시 refresh, model/agent 유지·commands live 재조회 |
| D6 | T33 | prepared/live MCP 공유·5초 만료·실패 retry·명시 refresh, model/agent 유지·commands live 재조회 |
| E1 | T34 | 실제 MCP/native 저장 handler→source→공유 peer HTTP, 프로젝트 우선·저장 실패 무적용 |
| E2 | T34 | 실제 MCP/native 저장 handler→source→공유 peer HTTP, 프로젝트 우선·저장 실패 무적용 |
| E3 | T35 | off/edit/env 해소/credential 회전/철회별 revision·정의·desired·복제 격리 |
| E4 | T34 | 실제 MCP/native 저장 handler→source→공유 peer HTTP, 프로젝트 우선·저장 실패 무적용 |
| E5 | T34 | 실제 MCP/native 저장 handler→source→공유 peer HTTP, 프로젝트 우선·저장 실패 무적용 |
| E6 | T36 | busy/background 동안 pending, 첫/후속 submit은 apply 완료 뒤·실패에 prompt 없음 |
| E7 | T36·T52·T53 | 실제 project sync는 모든 peer가 idle일 때 적용; activity의 foreground/queued/delivered/residual/background/wakeup 구별 |
| E8 | T36 | busy/background 동안 pending, 첫/후속 submit은 apply 완료 뒤·실패에 prompt 없음 |
| E9 | T36 | busy/background 동안 pending, 첫/후속 submit은 apply 완료 뒤·실패에 prompt 없음 |
| E10 | T20 | 실제 register: definition retire/invalidate 1, toggle reconcile 1, busy guard·deploy/auth refresh |
| F1 | T35 | off/edit/env 해소/credential 회전/철회별 revision·정의·desired·복제 격리 |
| F2 | T37·T38 | 실제 builder/양 turn entry/runtime: total37·definition11·connection23, toggle/edit·record/reset |
| F3 | T37·T38 | 실제 builder/양 turn entry/runtime: total37·definition11·connection23, toggle/edit·record/reset |
| F4 | T37·T38 | 실제 builder/양 turn entry/runtime: total37·definition11·connection23, toggle/edit·record/reset |
| F5 | T37·T38 | 실제 builder/양 turn entry/runtime: total37·definition11·connection23, toggle/edit·record/reset |
| F6 | T37·T38 | 실제 builder/양 turn entry/runtime: total37·definition11·connection23, toggle/edit·record/reset |
| F7 | T37·T38 | 실제 builder/양 turn entry/runtime: total37·definition11·connection23, toggle/edit·record/reset |
| F8 | T37·T38 | 실제 builder/양 turn entry/runtime: total37·definition11·connection23, toggle/edit·record/reset |
| F9 | T15 | 실제 bridge endpoint: 보유 시 살아 있음·정의 retire/획득 실패 뒤 닫힘 |
| F10 | T20 | 실제 register: definition retire/invalidate 1, toggle reconcile 1, busy guard·deploy/auth refresh |
| G1 | T39 | 같은 파일 probe 공유·1초 전 dirty 검증 장벽 |
| G2 | T40 | 부재 생성·조상 .git·명시 config·환경 layout 변경 |
| G3 | T41 | realpath/symlink/package metadata 변경, plugin 실행 없음 |
| G4 | T39 | 같은 파일 probe 공유·1초 전 dirty 검증 장벽 |
| G5 | T42 | 일반 config dirty와 plugin 변경 event를 분리·변화 없으면 방송 없음 |
| G6 | T43 | 읽기 중 invalidation의 old revision은 push되지 않음 |
| G7 | T44 | 실제 adapter client에서 env one은 native alias 충돌 제외, env two는 투영·파일 삭제 후 재투영 |
| G8 | T45 | 실제 등록 module에 stored backend/cwd를 운반해 native 설정 반환 |
| G9 | T46 | 두 cached read의 skill/skills/명시 하위 경로 보존·설치 삭제 뒤 제거 |
| H1 | T47 | 실제 Bootstrap.start 완료가 stalled model을 기다리지 않음·foreground 공유 |
| H2 | T48·T49 | gate/resuming 해제 시 시작·gate 재폐쇄에 owner 취소 |
| H3 | T50 | 없는 lastCwd는 실제 foreground fallback·실패 owner 반환 후 명시 retry |
| H4 | T51 | CLI 없음에서 prepare 0·중복 background retry 없음 |
| H5 | T26 | 다른 backend 시작 0·실제 shutdown이 pending warmup 취소 |
| I1 | T03 | 두 send까지 child/bridge 1, 90초 뒤 dispose ack/event·exit, secret 미노출 |
| I2 | T03 | 두 send까지 child/bridge 1, 90초 뒤 dispose ack/event·exit, secret 미노출 |
| I3 | T03 | 두 send까지 child/bridge 1, 90초 뒤 dispose ack/event·exit, secret 미노출 |
| I4 | T03 | 두 send까지 child/bridge 1, 90초 뒤 dispose ack/event·exit, secret 미노출 |
| I5 | T03 | 두 send까지 child/bridge 1, 90초 뒤 dispose ack/event·exit, secret 미노출 |

정본 자리 ID − 아래 좌표의 자리 ID = ∅, 역차집합 = ∅. 이 검산은 ID 대응 확인이며 단독으로 행동 증명이 되지 않는다. A19/B17 등 전체 종료는 아래 종료 oracle을 함께 읽는다.

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
| T36 | `main/app/opencode-mcp-reconcile.test.ts`: defers busy/background peers and admits queued input only after successful connection mutation |
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

## 검색과 기존 자리의 승계

Q1~Q6는 enforcement.md의 명령 그대로 재실행했다. 아래는 후보 행 수이며 90자리의 분모와 다르다. 선언·타입·호출부·공통 turn 코드가 중복 포함되고, 다른 하네스의 정책과 관계없는 app 코드도 포함한다.

| 검색 | 후보 행 | 파일 |
|---|---:|---:|
| Q1 | 526 | 58 |
| Q2 | 1095 | 84 |
| Q3 | 144 | 34 |
| Q4 | 122 | 20 |
| Q5 | 120 | 33 |
| Q6 | 144 | 24 |

| 새 내부 코드 | 승계한 고정 자리 | 차집합 판정 |
|---|---|---|
| composer-preparation/service | B1~5·B10~17·I5 | 두 기존 준비 진입의 실제 조립과 owner 구현을 공유 |
| composerPromotion | C1·C3·C5 | 기존 pending 승격 이벤트와 state 키 연결 |
| opencode-mcp-reconcile·control.read | E6·E8~10·D2~3 | busy 대기·submit 장벽·동시 status 조회를 같은 directory queue에서 처리 |
| discovery-cache | G1~9 | 기존 reader와 watcher의 manifest/내용 검증을 공통화 |
| opencode-warmup | H1~5 | 기존 start/gate/shutdown에 같은 준비 service 연결 |
| retention-policy/trace·idle budget | A7~12·I1~5 | 단일 deadline·adapter 전체 cap과 기존 경계 사건 기록 |

검색에서 새 helper를 찾았다고 별도 제품 경로로 세지 않았다. 위 내부 edge는 고정 자리의 책임을 승계한다. preload/sessionApi의 기존 shape·wrapper는 변경하지 않았고 실제 renderer store 시험에서 wrapper를 통과한다. 개별 자리의 동작은 T 좌표가 근거이며, 검색 hit 총계로 완료를 판정하지 않았다.

## 선택된 변이

각 변이는 원본 bytes를 보존하고 하나씩 적용한 뒤 같은 테스트 파일을 재실행했다. 표의 red는 assertion 실패 수이며 원복 후 실패는 모두 0이다. M4-H2 첫 실행은 파일 원복 중 Windows I/O 오류가 나서 호출을 먼저 복원한 후 다시 red/원복 green을 확인했다.

| 자리 | 실제 결함 | red | 원복 green |
|---|---|---:|---:|
| M1-F3 | 사용자 턴 restart 값을 total revision으로 교체 | 1 | 3 |
| M1-F4 | 연속 턴 restart 값을 total revision으로 교체 | 1 | 3 |
| M1-F5 | scalar 조립에 반대 축 fixture total=37 삽입(definition=11과 구별) | 3 | 3 |
| M1-F7 | spawn 기록을 total revision으로 교체 | 1 | 3 |
| M2-C3 | models/agents 갱신 대상 맞바꿈 | 3 | 5 |
| M2-C5 | 실제 store 승격 전달 제거 | 1 | 5 |
| M3-B15 | resources에 별도 service 생성 | 1 | 2 |
| M4-H1 | 부팅 warmup.update 제거 | 2 | 5 |
| M4-H2 | gate callback warmup.update 제거 | 2 | 5 |
| M4-H5 | shutdown warmup.close 제거 | 1 | 5 |

F5는 snapshot이 아닌 이미 선택된 숫자를 운반하는 기존 함수다. 이 자리의 변이는 fixture의 전체 revision 37을 주입해 반대 축을 재현했다. F3/F4/F7은 실제 snapshot.revision을 운반한다. 선택 증거 10자리·인용 변이 0·새 구조적 oracle 0 = 10행이다. 새 행동 시험은 실제 production 함수를 실행하며, 이 문서의 ID 대응표 자체는 행동 oracle이 아니다.
