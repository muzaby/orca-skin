# 0264 구현 증거 — 직접 oracle

직접 oracle 좌표와 실행 구간. 게이트 결과는 [plan 구현보고](plan.md) 참조. 경로는 저장소 루트 기준이다.

## EP01 — renderer 등록 6자리

| 자리 | 실제 직접 oracle 파일: 테스트명 | 실행 구간과 한계 |
|---|---|---|
| EP01.1 composer | `app/src/renderer/src/features/chat/components/Composer.harness.test.ts`: `renders the %s surface around the shared editable draft` | 실제 `composerHarness(backend)`의 반환값을 실제 `ComposerInputController`에 주입한다. 양쪽 data-harness, OpenCode shadow와 selector를 단언한다. 페이지/Composer 외부 조립은 이 테스트의 실행 구간이 아니다. `ChatTile.composerLifetime`은 Composer 자체를 probe로 대체하므로 이 자리의 slot oracle로 쓰면 안 된다. |
| EP01.2 transcript | `app/src/renderer/src/features/chat/components/ChatTile.harness.test.ts`: `preserves the shared canvas, fades and transcript-only text scale for $backend/$agentKind`; `app/src/renderer/src/features/chat/components/transcript/TranscriptView.harness.test.ts`: `uses the harness spinner on each pending transcript path (%s)`, `renders shared messages in the %s slice` | 실제 ChatTile/TranscriptView 진입점이 registry를 경유한다. data-harness·배율 소유자·Claude scroll hook 호출과 실제 메시지 표현을 단언한다. ChatTile 테스트의 Composer/RightPanel은 mock이다. |
| EP01.3 rightpanel | `app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/Panel.render.test.ts`: `dispatches the default OpenCode summary with Work context sources and no PR` | 실제 public RightPanel을 양쪽 backend로 렌더한다. OpenCode summary 존재 및 Claude plan tile 존재/summary 부재를 단언한다. |
| EP01.4 engine config | `app/src/renderer/src/features/engine/common/components/EngineFormModal.harness.test.ts`: `restores the fixed claude chip and provider when editing a Claude engine (0262 AC31)`, `locks an existing OpenCode engine and uses its native settings` | common 경로의 테스트지만 import 대상은 public `components/EngineFormModal`이다. 실제 registry→common form→전용 config 경로와 하네스별 import 문구·고정 chip/selector를 검사한다. Modal overlay만 mock이다. |
| EP01.5 settings fields | `app/src/renderer/src/features/settings/common/components/HarnessSettingsTab.save.test.ts`: `saves only %s fields through the common tab` | public HarnessSettingsTab→registry→common tab→실제 Fields/codec으로 DOM 입력·저장 호출을 검사한다. OpenCode 전용 executable input과 저장 payload의 소유권을 단언한다. |
| EP01.6 landing | `app/src/renderer/src/pages/NewChatLandingPage.harness.test.ts`: `renders the harness landing and preserves draft and attachment state` | 실제 NewChatLandingPage의 registry 선택과 실제 Composer/입력 상태를 사용한다. wordmark, cwd 위치, mode controls와 초안·첨부 유지 단언. 주변 picker/레이아웃 지원부는 mock이다. |

계획의 `chat/harnesses/registry.test.tsx` 대신 위 **표면별 기존 진입점 테스트를 대체 oracle**로 사용한다. 등록 선택의 민감도는 아래 slot 교환 실행 결과가 확인한다.

## EP02 — main 등록/주입 6자리

| 자리 | 실제 직접 oracle 파일: 테스트명 | 실행 구간과 한계 |
|---|---|---|
| EP02.1 adapter 등록 | `app/src/main/app/harnesses/registry.test.ts`: `creates exactly the registered adapters, keeps Claude active, and closes each owner`; `app/src/main/app/bootstrap.harness.test.ts`: `initializes its actual adapter registry with user data, live preferences and Chromium fetch` | registry 테스트는 실제 factory와 concrete adapter 생성·등록·select/close를 관측한다. Bootstrap 테스트는 실제 constructor의 필드 초기화→factory를 실행하고 userData·netFetch·하네스별 최신 preferences callback·보관된 registry identity·기본 Claude를 단언한다. |
| EP02.2 settings parser | `app/src/main/app/harnesses/registry.test.ts`: `runs registered parsers through the real settings service and preserves unsupported-directory fallback`; `app/src/main/app/bootstrap.harness.test.ts`: `start forwards its real settings service and runtime parser into the catalog` | registry 테스트는 실제 factory→common service→Claude/OpenCode/legacy native parser의 모델·cache/invalidate를 검사한다. Bootstrap 테스트는 실제 start의 settings factory 호출과 반환 인스턴스가 runtime config에 전달되는 것을 관측하며 임시 native settings의 모델 결과도 검사한다. |
| EP02.3 runtime parser | `app/src/main/app/harnesses/registry.test.ts`: `runs the composed runtime parser after resolve and preserves explicit legacy contributions`; `app/src/main/app/bootstrap.harness.test.ts`: `start forwards its real settings service and runtime parser into the catalog` | registry 테스트는 legacy contribution의 app parser→Claude parser와 결과/default를 검사한다. Bootstrap 테스트는 실제 start가 catalog에 넘긴 runtime 및 parseModels identity, 반환된 catalog의 실제 reconcile→app/native parser→모델/default 결과를 검사한다. OpenCode module은 별도 native runtime parser를 제공하지 않으므로 그 경로를 실행했다는 증거는 아니다. |
| EP02.4 engine user-settings reader | `app/src/main/app/handlers/engine.import.test.ts`: `reads the selected harness global file and preserves legacy Claude callers`; `respects XDG_CONFIG_HOME without accepting renderer paths`; `returns missing for an absent or unreadable OpenCode file without reading Claude` | 실제 `registerEngineHandlers` 등록 callback→실제 app registry lookup→실제 각 reader→임시 native 파일을 실행한다. IPC transport/homedir만 격리하며 registry/reader는 대체하지 않는다. 생략 payload=Claude, XDG, 잘못된 사용자 경로와 OpenCode missing 격리도 검사한다. |
| EP02.5 native extension 배포 | `app/src/main/app/bootstrap.shutdown.test.ts`: `deploys enabled MCP servers after resolver expansion and excludes unresolved servers` | 실제 **Bootstrap.createDeploymentService**→app registry re-export→Claude deployment factory→MCP conversion→공통 queue를 실행한다. 최종 filesystem `deployer.deploy`만 spy로 대체한다. Claude target, Orca/Claude skillRoots, env/header 해석과 unresolved 제외, 원본 config 불변을 단언한다. `engine.deployment.test.ts`는 공통 queue를 테스트에서 조립하므로 이 bootstrap 배선 oracle의 대체물로 쓰면 안 된다. scaffold 실제 파일 동작은 별도 `features/extensions/claude/scaffold.test.ts`의 단위 범위다. |
| EP02.6 live permission 변환 | `app/src/main/features/approvals/coordinator.permission.test.ts`: `%s %s settles %s`; `app/src/main/features/sessions/session-runtime.test.ts`: `setModel·setPermissionMode 도 받은 값을 그대로 넘긴다 — 같은 형상의 형제 홉이다`; `app/src/main/adapters/claude/adapter.live-control.test.ts`: `converts every normalized live permission mode at the native SDK boundary` | 세 홉의 직접 테스트를 합쳐 증거로 삼는다. (a) 실제 승인 handler가 normalized 값을 live 포트 spy로 전달, (b) 실제 SessionRuntime이 normalized plan/accept_edits를 adapter live spy로 전달, (c) 실제 ClaudeAdapter.sendMessage가 반환한 live 객체에 normalized 6모드를 넣어 SDK query handle이 받는 native 6값을 단언. **세 홉을 하나의 실제 앱 세션에서 연속 실행한 E2E는 아니다.** 단순 변환 함수 테스트만으로 대체하지 않는다. |

EP02의 각 자리는 실제 production 함수를 통과하는 직접 oracle을 갖는다. EP02.1~3은 factory 내부와 실제 Bootstrap caller를 구분해 연결했고, EP02.6은 세 홉을 개별 실행한 증거다.

### Bootstrap 실행 범위

`bootstrap.harness.test.ts`는 실제 constructor와 start를 실행하되 인증·DB·IPC·timer 및 연결/플러그인·runtime contribution fixture를 격리한다. 실제 adapter/settings/runtime/catalog factory와 native parser는 대체하지 않으며, catalog 생성 다음 usage-fetcher 경계의 sentinel에서 start를 종료한다. 따라서 해당 조립 전달과 catalog 결과를 검증하지만 전체 네이티브 앱 시작 완료를 입증하지는 않는다.

## EP03 — 경계 강제 4자리

모두 `app/scripts/harness-boundary.test.mjs`의 실제 ESLint 실행이다. source 문자열에 금칙어가 있다는 사실만 세는 검사가 아니다.

| 자리 | 테스트명 | 직접 관측 |
|---|---|---|
| EP03.1 concrete sibling | `ownership rejects every import form across sibling harnesses including future names`; 기존 `harness implementations cannot import their sibling implementation` | import/re-export/dynamic/require/type import 및 가상 codex owner의 sibling rule diagnostic. |
| EP03.2 common 역방향 | `common modules cannot reach concrete implementations or selection registries`; 양성 짝 `composition, same-harness and neutral contracts remain usable for any harness name` | common→concrete/registry 거부와 composition/neutral 허용. fixture의 no-cycle만 비활성화하며 production ownership rule은 사용한다. |
| EP03.3 SDK outside v1 | `OpenCode SDK imports stay inside v1, including re-exports and dynamic access` | SDK import 위치 위반 diagnostic과 v1 허용. |
| EP03.4 version deep/cross | `native version imports require the facade and cannot cross version trees`; `renderer aliases cannot bypass the OpenCode version facade` | facade 외 deep import·버전 sibling·renderer alias 우회 diagnostic. |

## EP04 — UI 상태 7자리

| 자리 | 실제 직접 oracle 파일: 테스트명 | 실행 구간과 한계 |
|---|---|---|
| EP04.1 input instance | `app/src/renderer/src/features/chat/components/ChatTile.composerLifetime.test.ts`: `keeps the Composer instance across harness switch and draft session materialization`; `app/src/renderer/src/pages/NewChatLandingPage.harness.test.ts`: `renders the harness landing and preserves draft and attachment state`; `app/src/renderer/src/features/chat/components/Composer.approvalQueue.test.ts`: `keeps the draft and attachments until the mixed queue is empty` | ChatTile 부모/key의 인스턴스 유지(probe)와 실제 입력 draft/attachment 유지(나머지 두 테스트)를 구분한다. probe만으로 실제 input 값을 검증했다고 적지 않는다. |
| EP04.2 engine/settings save | `app/src/renderer/src/features/engine/common/components/EngineFormModal.import.test.ts`: `loads selected harness into the draft and imports then submits without changing the provider: %s`, `ignores stale results and errors after harness changes: %s`; `app/src/renderer/src/features/settings/common/components/HarnessSettingsTab.save.test.ts`: `saves only %s fields through the common tab` | 실제 public form/tab→registry→공통 state 경로. 선택 하네스별 import·입력·저장 값, 늦은 응답 무시. |
| EP04.3 request FIFO | `app/src/renderer/src/features/chat/components/Composer.approvalQueue.test.ts`: `renders only the earliest mixed request in the replacement slot: question first=%s`, `consumes question and permission requests in arrival order`, `retains Claude approval and question layout` | 실제 Composer/registry/RequestDock와 store 이벤트·승인/질문 소비. 계획의 `RequestDock`라는 별도 테스트 파일은 없음. 이 파일이 실제 진입점 대체 oracle이다. |
| EP04.4 Todo | `app/src/renderer/src/features/chat/harnesses/opencode/composer/TodoDock.integration.test.ts`: `renders metadata from successful root results, ignoring pending/failed/child writes and clearing on empty success`; `app/src/renderer/src/features/chat/harnesses/opencode/composer/TodoDock.render.test.ts`: `waits 400ms for terminal work, then exits downward over 300ms without a blank snapshot or live controls`; `Composer.approvalQueue.test.ts`: `overlaps the live Todo dock with the input and restores its collapse after mixed requests` | reducer/parts→Todo 상태, 실제 DOM 시간 경과·퇴장, 실제 Composer 통합을 각각 검사한다. fake timer와 측정 대체가 있으므로 실측 CSS 애니메이션은 UI fixture 관찰 증거를 별도로 붙인다. |
| EP04.5 transcript scroll/selection | `app/src/renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.interaction.test.ts`: `keeps jump-to-bottom pinned when an external click releases over a retained selection, then follows output`; `app/src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.selection.test.ts`: `keeps selected live content on completion, then resolves complete Markdown when selection clears` | 실제 controller/DOM interaction과 실제 선택 중 row renderer 전이를 검사한다. 브라우저 실제 선택/레이아웃 관찰은 plan의 Computer Use 증거와 구분한다. |
| EP04.6 Claude tiles | `app/src/renderer/src/features/chat/harnesses/common/rightpanel/rightPanelTiles.render.test.ts`: `세 섹션이 순서대로 있고 각 본문은 자신의 섹션에만 있다`, `상세는 child transcript 를 그린다`; `app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/Panel.render.test.ts`: `dispatches the default OpenCode summary with Work context sources and no PR`의 Claude 대조 | 첫 파일은 실제 Claude tile/content를 렌더하며 public RightPanel dispatch까지는 두 번째 파일의 Claude 대조가 확인한다. |
| EP04.7 OpenCode overlay close | `app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/navigation.test.ts`: `opens and closes $id independently of the base tile layout`; `app/src/renderer/src/features/chat/harnesses/common/rightpanel/TilePanel.detail.test.ts`: `keeps detail content beneath an artifact, then exposes detail and the original tiles in order`, `handles the actual detail Escape callback with %s`; `app/src/renderer/src/features/chat/harnesses/opencode/rightpanel/Panel.render.test.ts`: `renders the local detail selection and preserves the base tile selection` | reducer open/close, host 반환 렌더·실제 Escape callback, 상위/기저 selection 격리를 합친 oracle. SSR 재렌더 및 별도 callback 호출이므로 summary 클릭부터 close 버튼까지 실제 브라우저 한 흐름으로 수행했다는 주장은 CUA 증거가 맡는다. |

## EP05 — main runtime 3자리

| 자리 | 실제 직접 oracle 파일: 테스트명 | 실행 구간과 한계 |
|---|---|---|
| EP05.1 bootstrap/shutdown | `app/src/main/app/bootstrap.shutdown.test.ts`: `closes the owned adapter registry during shutdown before full startup`, `disposes title work during shutdown even before turn runtime initialization completed`, `records usage before history clears message identity, then starts title work before relay`, `deploys enabled MCP servers after resolver expansion and excludes unresolved servers` | 실제 Bootstrap 메서드를 Object.create(Bootstrap.prototype)로 실행하고 소유 필드/포트를 주입한다. lifecycle·이벤트 등록·native 배포 forwarding 증거이며 full `Bootstrap.start()` 실행은 아니다. |
| EP05.2 catalog/cache generation | `app/src/main/features/harnesses/common/runtime-catalog.test.ts`: `removes on unusable auth and rejects a late success`, `starts a latest-generation replay instead of joining stale in-flight work`, `joins the replay an invalidation started instead of opening a second fetch`; `app/src/main/app/chat-turn/resolve-turn.runtime-catalog.test.ts`: `uses the Gate-warmed cache without another augmenter fetch` | common catalog의 cache/generation 행동, app resolveTurnProvider가 warmed catalog를 소비하는 결과를 분리 관측한다. common suite는 Claude parser를 테스트에서 직접 주입하므로 app registry 선택을 검사한 증거로 재사용하지 않는다(EP02.3 별도). |
| EP05.3 send/permission/session | `app/src/main/adapters/opencode/v1/adapter.test.ts`: `sends native ascending IDs and completes successive turns under the legacy stop ordering contract`, `replies to permission and question approvals once, including rejection`, `surfaces a disconnected stream and aborts only that session without resending the prompt`; `app/src/main/app/chat-turn/resolve-turn.agent.test.ts`: `rejects a changed source harness after provider preparation (%s)`; EP02.6의 세 permission 홉 | 실제 OpenCode SDK와 주입 HTTP/SSE, 실제 resolveTurn의 비동기 이후 세션 하네스 고정, 실제 normalized permission 각 홉. 실모델/실서버 성공 증거로 확대하지 않는다. |

## EP06 — 삭제 후보 2자리

| 자리 | 직접 관측 / 대체 기능 oracle | 한계 |
|---|---|---|
| EP06.1 PlanTile.tsx | `Test-Path app/src/renderer/src/features/chat/components/PlanTile.tsx` → False; app/src·app/scripts의 exact `components/PlanTile` import 및 `.tsx` 경로 검색 → 0줄. `app/src/renderer/src/features/chat/harnesses/common/rightpanel/plan0215.render.test.ts`: `uses the %s %s plan feedback hint`, `본문이 있으면 마크다운을 그린다 — 두 빈 상태 어느 쪽도 아니다`는 실제 public tileById→전용 plan registration→common content를 렌더한다. | 삭제 파일 자체에 테스트를 추가한 것이 아니며 활성 대체 경로와 참조 부재를 대조한다. 빌드/typecheck 결과는 plan 구현보고를 따른다. |
| EP06.2 htmlRegion.testlib.ts | `Test-Path app/src/renderer/src/shared/ui/htmlRegion.testlib.ts` → False; app/src·app/scripts의 `htmlRegion.testlib` 검색 → 0줄. 기존 diff 기능은 `app/src/renderer/src/features/chat/harnesses/common/rightpanel/diffTile.render.test.ts`: `파일들이 한 스크롤 컨테이너 안에 순서대로 서고 각각 접기 컨트롤을 갖는다`, `diff 타일이 헤더 콘텐츠와 본문을 모두 해석한다`가 검사한다. | helper가 없다는 것을 diff 테스트만으로 입증하지 않는다. 삭제 후보 검색이 직접 부재 관측이고, diff 테스트는 활성 기능 회귀 대조다. |

## 자리 검산

- 자리 수: EP01 6 + EP02 6 + EP03 4 + EP04 7 + EP05 3 + EP06 2 = **28**. 이는 계획 자리 수와 대조한 목록이며 테스트 통과 수가 아니다.
- 없는 계획 경로 2개는 실제 진입점으로 명시 대체했다: `harnesses/registry.test.tsx` → EP01 표면별 테스트, `RequestDock` 별도 테스트 → `components/Composer.approvalQueue.test.ts`.
- EP02/EP05의 관측 범위는 위 표에 명시했다. factory와 홉별 테스트만으로 Bootstrap 전체 배선 실행을 주장하지 않는다.

## VP01 — renderer 등록 slot 교환

2026-10-16에 각 registry의 Claude/OpenCode 값을 양방향으로 바꾸고 실제 renderer oracle을 순차 실행했다. 매 단계 `finally`에서 원본 bytes를 복원한 뒤 같은 파일·test-name 필터를 재실행했으며, 종료 후 모든 대상의 SHA256을 최초 원본과 다시 대조했다. 아래 red는 모두 `AssertionError`이며, 통과 판정에 런타임 오류나 suite 로딩 실패를 포함하지 않았다.

| 표면 | 실제 변이 자리 | 변이 assertion red | 복원 후 동일 oracle | 원본 bytes/SHA256 |
|---|---|---:|---:|---|
| Composer | `chat/harnesses/registries/composer.tsx`의 `modules` | 2 | 3 passed | 일치 |
| Transcript | `chat/harnesses/registries/transcript.tsx`의 `registry` | 8 | 11 passed | 일치 |
| Right panel | `chat/harnesses/registries/rightpanel.ts`의 `panels` | 1 | 1 passed, 11 skipped | 일치 |
| Engine config | `engine/harnesses/configuration.ts`의 `configurations` | 2 | 3 passed | 일치 |
| Settings fields | `settings/harnesses/registry.ts`의 `configurations` | 2 | 2 passed | 일치 |
| Landing | `chat/harnesses/registries/landing.ts`의 `presentations` | 1 | 3 passed | 일치 |

표의 변이 자리는 `app/src/renderer/src/features/` 기준이며 직접 oracle은 EP01 표와 같다. Right panel은 실제 public RightPanel 진입점의 `dispatches the default OpenCode summary with Work context sources and no PR`만 같은 이름 필터로 red/green을 비교했다.

Right panel의 최초 전체 파일 실행은 assertion 실패 7건과 fixture의 transcript runtime context 오류 3건이 섞여 엄격 red 판정에서 제외했다. 원본 복원 후 전체 12건은 통과했으며, 위 단일 public 진입점으로 다시 변이해 assertion 실패만 발생하는 것을 확인했다.

로컬 재현 runner는 `.tmp/0264-mutations.cjs`이며 결과 JSON은 `.tmp/0264-mutations/2026-10-15T15-49-11-101Z/results.json`의 Composer/Transcript와 `.tmp/0264-mutations/2026-10-15T15-52-13-565Z/results.json`의 나머지 표면이다. 임시 실행 자료는 커밋 대상이 아니며, 본 표가 관측 결과를 보존한다.
