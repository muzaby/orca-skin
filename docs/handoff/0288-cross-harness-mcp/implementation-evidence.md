# 0288 r1 구현 증거

이 문서는 구현자 자기확인이다. 독립 검증 결과는 `verify.md`에서 판정한다. 아래 경로는 `app/src/` 기준이다.

## 실제 oracle 좌표

| 기호 | 파일:테스트명 | 관측 범위 |
|---|---|---|
| T1 | `main/app/managed-mcp.test.ts:projects stored MCP and authenticated plugin bindings` | 실제 McpStore·resolver·세 plugin factory·binding·source·등록 IPC. 저장/외부 I/O만 대체 |
| T2 | `main/app/managed-mcp-projection.test.ts:preserves transports identities and native configuration` | resolve·projection·native environment·server profile, 파일 바이트·별칭·env exact equality |
| T3 | `main/features/extensions/common/mcp/bridge.integration.test.ts:serves only authorized application tools` | 실제 HTTP listener와 MCP SDK client. protocol/auth/schema/cancel/session/cleanup. 서비스 역할의 handler fixture 사용 |
| T4 | `main/app/managed-mcp.cli.integration.test.ts:advertises and calls managed MCP through the supported CLI` | 실제 Windows OpenCode CLI·bridge·세 plugin factory·stdio/http/sse 서버. 외부 서비스와 모델 protocol만 로컬 fixture |
| T5 | `main/app/handlers/managed-mcp-resources.test.ts:preserves source identity through prepared and live views` | 실제 mapping·prepared owner·session IPC handler. lease와 live runtime 경계는 fixture, 두 세대·두 source의 반환과 폐기 관측 |
| T6 | `renderer/src/features/chat/harnesses/common/composer/Composer.native-menu.test.ts` | 실제 controller·menu·후보·decoration·send; React hook/element 실행 환경과 IPC 대체. 양 하네스의 삽입/Enter/강조와 native 그룹 확인 |
| T7 | `main/app/chat-turn/managed-mcp-revision.test.ts:applies new revisions to user and continuation turns` | 실제 builder·user/continuation·respawn·SessionRuntime, adapter sink에서 revision 1/2 관측, 0/undefined 분리 |
| T8 | `main/app/managed-mcp-lifecycle.test.ts:shares generations and releases only owned resources` | 실제 composition·adapter·session-context·bridge. server/fetch 외부 경계 대체. A/B owner·변경·부분 실패·snapshot 99 운반 |
| T9 | `main/app/bootstrap.managed-mcp-wiring.test.ts:wires the live MCP source into bootstrap consumers and broadcasts only its revision` | production bootstrap AST 배선 proxy. B1~B11 결함을 각각 심어 assertion red 확인 |
| T10 | `main/app/managed-mcp-document-contract.test.ts:matches deployment recipes and secret boundaries` | 문서 recipe 실제 타입 compile, 잘못된 registry의 TS2322 음성 대조, 빈 기본 배포 |
| T11 | `main/app/managed-mcp-claude-regression.test.ts:retains resolved Claude MCP publication through the actual deployment service and plugin writer` | 실제 Claude deployment service→common resolve→deployer→plugin 파일→publish. 임시 파일 루트/진단 sink만 대체 |
| T12 | `main/app/project-resource-sync.test.ts:holds watcher broadcasts behind an in-flight project mutation` 및 `main/app/handlers/session-resources.claude-assembly.test.ts:keeps every toggle while overlapping plugin toggles save through the real watcher` | 두 own-save 사이의 watcher/프로젝트 큐 경합을 직접 고정하고 실제 Claude 조립과 polling watcher도 재실행 |
| P1 | `main/app/prepared-mcp-resources.test.ts:keeps observed preparations alive and rejects retired completions` | 실제 owner의 관측 수명·invalidate·renderer 해제·늦은 acquire release |
| P2 | `main/app/prepared-mcp-resources.test.ts:resolves draft execution choices and saved session scope from their actual owners` | draft provider/agent와 saved DB cwd/project를 서로 다른 값으로 검증 |
| I1 | `preload/index.test.ts`의 managed MCP revision 구독 case | 실제 preload와 renderer API wrapper에 revision 37 전달·unsubscribe |
| I2 | `renderer/src/features/chat/lib/managedMcp-state.test.ts` | 실제 renderer subscription·NativeResourceState. 변경 후 관리 후보 즉시 제거, 이전 응답 폐기, 새 응답만 적용 |
| I3 | `renderer/src/features/chat/harnesses/opencode/composer/composerCatalogState.test.ts`의 managed MCP 변경 case | 실제 catalog state 구독, model 응답 세대 폐기·재준비, 기존 agent cache 유지 |
| C1 | `main/app/composer-catalog.test.ts:prepares draft and saved directory with the same production settings and env resolution as turns` | 실제 production resolver→prepare 조립. draft/saved 설정·환경 운반 |
| C2 | `main/app/handlers/composer-catalog.test.ts`의 managed source invalidation case | 실제 handler/owner invalidate, 이전 acquisition release 및 재준비 |
| R1 | `main/features/extensions/claude/mcp/convert.test.ts` 전체 | stdio/http/sse·미해결 값·원본 불변성 회귀 |
| R2 | `main/adapters/claude/adapter.native-plugins.test.ts:pins deployed MCP files for same-cwd peers and reloads until the final owner closes` | Claude 배포 파일·같은 cwd lease 기존 행동 |
| R3 | `main/adapters/claude/runtime-tools.boundary.test.ts` 전체 | 실제 Claude SDK MCP 경계 결과·취소·예외·query별 context |
| R4 | `main/adapters/opencode/v1/mcp-control.test.ts:applies restored choices once per new directory and preserves project overrides and existing instances` | native choices·project override·directory 제어 회귀 |
| R5 | `main/adapters/opencode/v1/adapter.test.ts` | 수동/자동 승인·거절, 동일 request의 이미 정착한 404만 무시하는 4개 case |
| R6 | `renderer/src/features/chat/lib/composerSkills.test.ts` 전체 | OpenCode native command 유지·Orca skill 차단 |

T2/T4는 adapter 하위에서 app/features를 import하는 DAG 역전을 피하려고 `main/app/`에 배치했다. T6은 기존 실제 controller 실행 장치에 증설했다. T3의 handler fixture 범위 밖인 실제 세 plugin factory 호출은 T1·T4가 담당한다. O9는 별도 복제 테스트 대신 R1~R5 및 Artifact guard 회귀를 실행했다.

## 고정 강제 자리별 운반과 관측

각 행은 plan §10의 한 자리다. 선언·import·주석을 실행 자리로 세지 않는다. T9는 행동 실행으로 과장하지 않으며, 그 배선 proxy 자체의 삭제/오주입 민감도를 별도로 검증했다.

| 자리 | production 자리 | 운반 항 · 구별 입력 → 관측 | oracle |
|---|---|---|---|
| E1a | `mcp/store.ts:enabledConfig` | enabled/disabled 사용자 → 활성 서버만 snapshot | T1 |
| E1b | `mcp/store.ts:resolver` | `${TOKEN}`/미해결 변수 → 실제 secret/서버 제외 | T1·T2 |
| E1c | `mcp/resolve.ts` | stdio args/env·http/sse headers의 서로 다른 값 → transport 보존 | T2·R1 |
| E1d | `managed-source.ts:refresh` | toggle/auth revision 변경·동일 입력 → revision 증가/유지 | T1 |
| E1e | `managed-source.ts:snapshot` | 반환 config/map 변경 → 다음 snapshot 원본 보존 | T1 |
| E1f | `deployment/plugins.ts:sync` | valid/revoked/relogin·credential revision → 실제 plugin registry 노출 변경 | T1 |
| E1g | `app/managed-mcp.ts` 및 bootstrap 주입 | 세 plugin binding·user store → builtin/user snapshot·bridge 주입 | T1·T8·T9 B1~B4 |
| E1h | bootstrap auth callback | syncPlugins 뒤 source refresh → callback 배선 / 철회 후 실제 call 거부 | T9 B6·T1·T3 |
| E1i | `handlers/mcp.ts:mcpAdd` | 새 사용자 서버 → 등록 반환과 새 source revision | T1 |
| E1j | `handlers/mcp.ts:mcpUpdate` | 기존 서버의 변경 command/toggle → 새 snapshot | T1 |
| E1k | `handlers/mcp.ts:mcpDelete` | 등록 ID 삭제 → source 제거 | T1 |
| E2a | `mcp/bridge.ts` listener 경계 | capability 없음·틀린 Host·Origin·초과 body → 요청 거부 | T3 |
| E2b | initialize/session | 다른 server/세대의 session ID → 404, 올바른 세대 연결 성공 | T3 |
| E2c | tools/list | application/session scope와 schema/readOnly → application만 정확한 schema로 노출 | T3·T4 |
| E2d | tools/call | 서로 다른 args/결과·철회·취소·예외/잘못된 결과 → 원래 handler·isError·abort | T3·T4 |
| E2e | release/close | 두 lease·중복 release·마지막 owner → 첫 해제 뒤 401 listener 유지, 최종 연결 거부 | T3·T8 |
| E3a | `opencode/v1/managed-mcp.ts` | native 동명·a-b/a_b·예약 alias·stdio/http/sse → 안정 identity·충돌 부분 제외 | T2 |
| E3b | `adapter.ts:client` | source snapshot·bridge lease → 두 관리 MCP config와 실제 endpoint | T8·T4 |
| E3c | `native-storage.ts:nativeOpenCodeEnvironment` | 사용자 비밀·Windows 역슬래시/따옴표/개행/중괄호 → child env 치환 후 동일 JSON 값 | T2·T4 |
| E3d | `server-profile.ts:openCodeServerProfile` | 같은 설정/다른 cwd 및 새 세대 → 같은/다른 profile | T2·T8·T4 |
| E3e | `server.ts:start` | distinct stdio env·http/sse header·capability → 실제 CLI 도구 호출 성공, argv 비밀 없음 | T4 |
| E3f | `adapter.ts:prepareComposer` | 기본 source의 builtin 3/user 3 → 연결 관측 6개, native와 구별 | T4 |
| E3g | `adapter.ts:sendMessage` | 기본 source와 다른 revision 99/turn-only command → 획득 config는 turn-only 하나 | T8 |
| E3h | `channel.ts` system mapping | 일반 prompt/slash의 managed mention → 로컬 모델 request mapping과 실제 지정 도구 결과 | T4 |
| E4a | `ExtensionBuilder.build` | source revision 1→2 → 요청 snapshot 1→2 | T7 |
| E4b | `runtime-entry.ts` | warm 1, 현재 2 → 기존 channel teardown·다음 send 2 | T7 M1a |
| E4c | `chat-turn-continuation.ts` | spawned 2, 다음 2/3/0/undefined → respawn false/true/true/true | T7 M1b |
| E4d | `respawn-inputs.ts` | spawned/current 0·revision 2/3 → 동일 값 유지·변경 반영 | T7 |
| E4e | `respawn-policy.ts` | 0와 undefined를 포함한 revision 비교 → 위 respawn 판정 | T7 |
| E4f | `SessionRuntime` spawn | revision 0/37 및 turn 1/2 → spawned 값 exact equality | T7·`session-runtime.test.ts` M1c |
| E4g | 같은 파일 teardown | 기록 37·1 → teardown 뒤 undefined | T7·`session-runtime.test.ts` |
| E4h | `session-context.ts` lease/cache | A/B 같은 profile·A 해제·새 source → B owner 유지, 새 profile만 추가 | T8 |
| E4i | bootstrap shutdown | mcpBridge.close 호출 배선·실제 close → listener 최종 연결 거부 | T9 B8·T3·T8 |
| E5a | native resource mapping | builtin wiki/user stored-user/native 서로 다른 ID → kind/sourceId/mentionId 정확히 구별 | T5·T8 M2a |
| E5b | `channel.ts:nativeResources` | 실제 CLI live turn의 6개 관리 MCP → origin/source가 준비 결과와 일치 | T4 |
| E5c | `composer-cache.ts:mcp` | 성공 응답·source 변경/retired profile → stale 관리 항목 제거 | T8·T4 |
| E5d | `app/composer-catalog.ts` | draft/saved의 다른 provider/env/cwd → 정확한 prepare 입력 | C1 |
| E5e | catalog handler invalidation | managed source 변경 → 이전 owner release·다음 요청 재획득 | C2·T9 B10 |
| E5f | session handler live | saved live 결과와 draft prepared 결과가 다른 입력 → saved는 live 반환 | T5 |
| E5g | 같은 handler draft/cold | observed prepared builtin/user → 안전 DTO; 변경 전 늦은 live 응답 폐기 | T5 |
| E5h | prepared owner | draft-provider/C:/draft와 DB C:/stored, owner 해제/late completion → scope 구별·release | P1·P2·T9 B11 |
| E5i | app source broadcast | `{revision}`만 send·두 owner invalidate → AST 인자 exact equality | T9 B7/B9/B10 |
| E5j | preload receive | revision 37 → 실제 preload callback·unsubscribe | I1 |
| E5k | renderer subscription | managedMcpChanged callback → nativeResourceState의 invalidate | I1·I2 |
| E5l | nativeResourceState | 이전/새 응답 sentinel → 옛 managed 후보 제거·새 것만 채택 | I2 |
| E5m | composerCatalogState | 이전/새 model sentinel → 옛 응답 폐기·재준비·agent 유지 | I3 |
| E6a | Claude composer Module | binding availability·skills=true·managed=true → binding 후보 메뉴/강조 | T6 |
| E6b | OpenCode Module | observed availability·skills=false·managed=true → 연결 후보만 메뉴/강조 | T6 |
| E6c | controller 후보 | builtin/user/native 서로 다른 이름·연결 상태 → 선택·삽입·유효 강조 집합 | T6 |
| E6d | controller AttachMenu props | includeSkills와 includeManagedMcp 구별 → OpenCode MCP 활성, skill 제외 | T6·`composerAttachMenu.test.ts` C1 |
| E6e | AttachMenu model 인자 | native/Orca source 및 skills 구별 → 그룹별 정확한 아이템 | T6 |
| E6f | attachMenuModel | 세 source ID·중복·한글/공백 label → Orca/native 그룹·삽입 token exact equality | T6 M2b |
| E6g | useMentionAutocomplete | observed user alias·invalid binding → @검색 표시/선택, invalid 제외 | T6·`useMentionAutocomplete.test.ts` |
| E6h | pluginMention merge | binding과 native의 같은 mention ID → 중복 제거·displayName 유지 | T6 |
| E6i | composerSkills | OpenCode native 명령과 Orca skill → native만 허용 | R6·T6 |
| E6j | decoration valid IDs | 삽입한 user alias·builtin ID → 같은 token 강조·Enter 전송 | T6 |
| E7a | Claude convert | 변수·transport별 구별 입력 → 기존 Claude config와 동일 | R1 |
| E7b | Claude harness extensions | stdio/http/sse의 서로 다른 값 → 실제 service가 해석한 plugin 파일 publication | T11·R2 |
| E7c | Claude plugin 파일 쓰기 | 원본의 변수/비밀 해석 → 정확한 plugin JSON, source 바이트 불변 | T11·R2 |
| E7d | Claude runtime tools | query별 context·읽기/쓰기·isError → 기존 SDK 호출 결과/승인 의미 유지 | R3·`runtime-tools.test.ts` |
| E7e | Confluence scope/signal | application scope·실제 search args → confluence sentinel, per-call 취소 signal | T4·T3 |
| E7f | Jira scope | application scope·issue key → 실제 Jira handler의 다른 sentinel | T4 |
| E7g | Mail scope/signal | application search·독립 caller 취소 → cache 결과/마지막 caller에서만 abort | T4·`features/plugins/mail/tools.sync.test.ts` |
| E7h | Artifact guard | application context → 거부; 기존 session context → 기존 성공 경로 | `features/artifacts/tool.test.ts` |
| E7i | registry 동등성 | 동일 도구·다른 executionScope → revision 증가 | `features/extensions/common/runtime-tool-registry.test.ts` |
| E7j | native mcp-control | saved choices와 project override → 원래 토글 동작 유지 | R4 |
| E7k | OpenCode permission | allow/deny/cancel 및 settled 404의 같은/다른 request → 올바른 종료/실패 | T4·R5 |

## 검색 대조의 범위

plan Q1~Q5를 그대로 실행했다. 검색 hit는 import/타입/주석, 기존 native 전용 파일 읽기, 다른 revision 및 다른 release도 포함한다. 이들은 관리 MCP 계약을 운반하지 않는 항목으로 분리했다. 관리 MCP 실행 edge는 위 자리의 producer/consumer, 같은 자리 안의 helper, 또는 별도 계약 선언이다.

- 고정 ID 목록은 E1a~k/E2a~e/E3a~h/E4a~i/E5a~m/E6a~j/E7a~k다. 위 표의 ID와 양방향 차집합은 별도 보고 검사에서 확인한다.
- 추가 helper `preparedMcpScope`는 E5h의 scope 해석, `mapManagedMcpResources`는 E5a의 mapping 구현이다. 별도 행동 경계를 도입하지 않았다.
- `isSettledOpenCodePermission`은 E7k의 CLI sibling permission 정착 처리다. MCP source/revision 운반 자리는 아니다.
- 실제 서비스/시각 H1은 위 기계 자리와 별개이며 미실기다. 이 문서의 67자리 자기확인은 AC17의 완료를 뜻하지 않는다.

## CI 실패 재현과 수정

[기존 main CI](https://github.com/muzaby/orca-skin/actions/runs/40332495483)의 Test 단계는 파일 837통과·1실패·2skip(총 840)이었으며 `attachMenu.render.test.ts` 한 케이스가 실패했다. `composerProps={{...}}` 안의 중첩 `landingProjects`를 정규식이 끝으로 오인했다.

실제 JSX AST에서 `LandingComposer`의 `composerProps.onManagePlugins`를 찾아 shorthand/명시 인자를 검증한다. 중첩 객체만 있는 경우·다른 component·다른 callback은 실패한다. 실제 페이지의 callback 삭제(CI1)/형제 callback 교환(CI2) 모두 red였고 복원 후 6케이스가 통과했다.

### r1.2의 CI 보완

[첫 PR CI](https://github.com/muzaby/orca-skin/actions/runs/40444775961)는 lint/typecheck/문서 gate가 통과했고, Test에서 8082통과·1실패·3skip이었다. 실패는 기존 Claude 조립의 `configurationPending` 오표시이며 Landing 실패는 재발하지 않았다.

`ProjectResourceSync.refresh`가 첫 own-save의 설정을 읽은 뒤 방송 큐를 기다리는 동안 두 번째 own-save가 끝나면, 이미 적용된 중간 revision을 미적용으로 판단할 수 있었다. 읽기와 방송을 같은 프로젝트 큐 작업으로 묶어 현재 revision을 관측한다. 추가 파일 읽기나 timeout 확대 없이 해결했다.

T12의 unit case는 mutation 큐를 latch로 막고 own-first→own-second 순서를 고정한다. r1.1 production으로 복귀하면 실제 CI와 같은 `expected true to be undefined`로 실패한다(CI3). 수정본 복원 후 직접 회귀와 실제 polling 조립을 재실행했다. 이는 현재 산출물의 운영 gate 보완이며 V1의 제품/운반 계약 변경이 아니다.
