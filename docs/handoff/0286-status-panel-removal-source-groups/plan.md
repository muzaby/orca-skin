# Plan — 0286-status-panel-removal-source-groups

## 메타

| 항목 | 값 |
|---|---|
| slug | `0286-status-panel-removal-source-groups` |
| 작성자 | Claude Code |
| 일자 | 2026-10-26 |
| 매핑 | — |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 설계 기준 트리 | `58fad402` (main, 0285 r1 구현 반영 후 재검산) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: transcript 케밥 메뉴의 `상태` 항목과 상태 패널이 세션별 네이티브 MCP·플러그인 상태 확인·토글을 제공한다. 플러그인 페이지에서 Orca 로고 우측이 잘리고, Orca 그룹이 탭마다 맨 아래에 있거나 제목이 없으며, 제목마다 `스킬`·`플러그인`·`MCP` 접미가 붙는다. Orca MCP 행은 MCP 아이콘을 쓰지 않는다.
- 완료 후 달라지는 것: 세션별 상태 확인·변경 UI가 사라진다. 플러그인 페이지 세 탭은 `Orcinus orca` 그룹이 맨 위이고, 그룹 제목은 `Orcinus orca`·`Claude`·`OpenCode`(스킬 탭 `~/.agents/skills` 유지)다. Composer 그룹 제목·로고도 같은 규칙을 따른다.
- 성공을 사용자 관점에서 한 문장으로: 케밥 메뉴에 `상태`가 없고, 플러그인 페이지·Composer의 Orca 로고가 온전히 보이며 그룹 제목이 브랜드 이름 하나다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "transcript 상단 케밥 버튼에서 상태 버튼을 제거하고, 상태패널 또한 제거하여 사용자에세 세션별 상태 변경 및 확인 기능을 제공하지 않겠다." | 라이브 세션 2026-10-26 |
| 명시 요구 | "mcp 탭에서 추가버튼으로 mcp 추가 시, 'Orcinus orca MCP' 그룹의 로고표시에서 우측 부분이 짤리고 있다(뷰포트 초과). 온전하게 보이도록 하라. 그리고 하위 항목에서는 mcp 아이콘을 사용하지 않고 있다. Mcp 아이콘으로 변경하라." | 라이브 세션 |
| 명시 요구 | "각 탭에서 orcinus orca 그룹은 항상 최상위로 둔다 (내장도구, 사용자가 직접 추가 등). 로고 출력도 짤리지 않게 출력할 것. 또한 각 그룹의 타이틀은 Orcinus orca, Claude, OpenCode 등으로 사용할 것. '~스킬', '~플러그인', '~MCP' 등의 표현을 제가할 것. 단 스킬 탭의 '~/.agents/skills' 타이틀은 그대로 유지." | 라이브 세션 |
| 명시 결정 | 질의 1 "화면+renderer만" · 질의 2 "로고+제목 모두 Composer도" · 질의 3 "제목+로고 붙인다" · 질의 4 "목록+상세 모두" | 라이브 세션 AskUserQuestion |
| 추론 의도 | 접미를 지워 같은 제목이 된 Composer 그룹은 하나로 합친다 — 같은 `Claude` 제목 두 개는 구분 정보가 없다 | D-010 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 케밥(타일 메뉴)의 `상태` 항목을 양 하네스·Code/Work 모두에서 제거한다 | "케밥 버튼에서 상태 버튼을 제거" | 사용자 턴 | ACTIVE | — |
| D-002 | 상태 패널을 제거한다 — Claude Code 우측 `nativeStatus` 타일, OpenCode Code 작업 위 상세. 다른 자리로 옮기지 않는다 | "사용자에세 세션별 상태 변경 및 확인 기능을 제공하지 않겠다" | 사용자 턴 | ACTIVE | — |
| D-003 | 제거 범위 = 화면 + renderer chat feature 소비 코드. main·preload·renderer `shared/api`의 IPC 표면(`orca:session:set-native-resource`·`orca:session:open-native-plugin`·composer catalog `mcp`/`plugins` part)과 main 구현(0284 포함)은 유지한다 | 질의 1 답 "화면+renderer만". main 정리는 후속 handoff 후보 | 사용자 답 | ACTIVE | — |
| D-004 | Composer가 쓰는 native 관측(`useNativeResources`의 `view`·`ensure`, `nativeResourceState` 읽기 수명주기)은 유지한다 | 소비처 `ComposerInputController.tsx:141-162`·`:224-229` | 코드 사실 | ACTIVE | — |
| D-005 | 플러그인 페이지 각 탭에서 `Orcinus orca` 그룹을 최상단에 둔다. 나머지 그룹의 상대 순서는 유지한다 | "각 탭에서 orcinus orca 그룹은 항상 최상위로 둔다 (내장도구, 사용자가 직접 추가 등)" | 사용자 턴 | ACTIVE | — |
| D-006 | 플러그인 탭의 Orca provider 행 위에 `Orcinus orca` 제목+로고를 신설한다 | 질의 3 답 | 사용자 답 | ACTIVE | — |
| D-007 | 그룹 제목은 `Orcinus orca`·`Claude`·`OpenCode`, 스킬 탭 `~/.agents/skills`는 유지한다. 적용 = 플러그인 페이지 + Composer(첨부 메뉴 스킬·플러그인 하위 패널, `/` 자동완성 섹션) | "'~스킬', '~플러그인', '~MCP' 등의 표현을 제가할 것. 단 스킬 탭의 '~/.agents/skills' 타이틀은 그대로 유지." + 질의 2 답 | 사용자 턴·답 | ACTIVE | — |
| D-008 | Orca 로고는 플러그인 페이지 그룹 제목과 Composer 그룹 제목에서 잘리지 않고 온전히 보인다 | "로고 출력도 짤리지 않게 출력할 것" + 질의 2 답 | 사용자 턴·답 | ACTIVE | — |
| D-009 | Orca MCP 항목 아이콘은 MCP 아이콘이다 — 목록 행 + 상세 머리. 전송 방식 표기(HTTP/STDIO)는 유지 | "Mcp 아이콘으로 변경하라" + 질의 4 답 | 사용자 턴·답 | ACTIVE | — |
| D-010 | 접미 제거로 같은 제목이 된 Composer 그룹은 하나의 그룹으로 표시한다 | 추론 — D-007 결과 `adapter:claude`·`plugin:claude`·native 플러그인 명령이 모두 `Claude` | 설계자 | ACTIVE | — |
| D-011 | 스킬 hover 설명의 출처 줄도 같은 제목을 쓴다(`설명⏎Orcinus orca`) | 추론 — 툴팁과 그룹 제목이 같은 `sourceLabel` SSOT(`shared/extension-sources.ts`)를 쓴다 | 설계자 | ACTIVE | — |
| D-012 | Composer 그룹 순서는 바꾸지 않는다 | D-005의 범위는 "nav -> 플러그인 페이지" | 사용자 턴 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-012 (신규 handoff).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 해당 없음.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-001↔AC1, D-002↔AC2, D-003↔AC13(IPC 표면 유지 양성 단언 포함), D-004↔AC3·AC14, D-005↔AC4~AC6, D-006↔AC6, D-007↔AC7~AC9, D-008↔AC11·AC16, D-009↔AC12, D-010↔AC8·AC9, D-011↔AC10, D-012↔AC8(순서 기존 유지 단언).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 로고 잘림의 원인 | **소비자가 크기 계약 위반** — OrcaLogo는 높이 기준인데 소비자가 가로를 고정한다 | `SourceHeading.tsx:9,25` `size-4`(16×16) → 필요 가로 16×1023/776=21.09px, 마크 우측 ≈5.7px 잘림. `composer.ts:18` `h-3.5 w-4` → 필요 18.46px vs 16px. 계약 주석 `OrcaLogo.tsx:4-6` |
| 이미 충족하는가 | 아니다 — Orca 그룹은 스킬·MCP 탭에서 맨 아래, 플러그인 탭에서는 제목 없음 | 스킬: `catalogOrder.ts:12` localeCompare → `'~/.agents/skills' < 'Claude 스킬' < 'OpenCode 스킬' < 'Orcinus orca 스킬'`(node 실측). MCP: `CustomizeList.tsx:170-172`. 플러그인: `:212-242` |
| 더 작은 해법 | 로고는 소비자 2곳 수정으로 닫힌다 | OrcaLogo 자체 교체(`object-view-box`)는 0227(IMPL_DONE·검증 대기) 산출을 바꾼다 — 채택 안 함 |
| 제거라면 능력 자체가 없어도 되는가 | 그렇다 — 세션별 상태 확인·변경 UI 자체를 없앤다. 이동 아님 | D-002. 전역 토글은 플러그인 페이지(`useNativeMcpCatalog.ts:90` `setGlobalExtension`)가 별도로 갖는다 |
| 선행 자료 대조 | 현재 코드와 일치 | `rendering.md:273` "케밥은 컬러 브랜드 로고의 상태 타일 진입" = `ChatTitleBar.tsx:238-243` |
| 기존 결정·진행 handoff와 충돌 | **있음 — 보고함** | 0284 AC2 실기가 상태 패널 토글로 수행된다(0284 plan §7 R-01 경로 `renderer toggle → orca:session:set-native-resource`). 이 구현 후 화면 경로가 사라진다. 0272 AC5·0259 AC12·0263 VP7-V 시각 대상이 바뀐다 |

- 사용자에게 올릴 결정: 없음(질의 4건 답 완료). 0284 AC2 실기를 하려면 이 handoff 구현 전에 해야 한다 — 사용자에게 보고.
- 코드 조사로 닫은 사실: 우측 패널 타일 배치는 영속되지 않는다(`rg rightPanelTiles app/src/main app/src/shared app/src/preload` → 0) — 마이그레이션 불필요.

## 5. 동작 / 사용자 흐름

```text
[케밥 클릭]
  → 타일 메뉴: Claude Code = 계획·서브에이전트·변경사항 / 그 외 = 작업
  → 구분선 · 고정 · 이름 변경 · 삭제   (상태 항목 없음, 상태 패널 진입 경로 없음)

[nav → 플러그인]
  → 플러그인 탭: [Orca 로고] Orcinus orca → 앱 로그인·모델·사내 서비스 행 → Claude → OpenCode
  → 스킬 탭:    Orcinus orca → ~/.agents/skills → Claude → OpenCode
  → MCP 탭:     Orcinus orca(MCP 아이콘 행, 활성→비활성) → Claude → OpenCode
  ↘ 그룹에 행이 없으면 그 제목도 없다 / 전부 없으면 기존 빈 상태

[Composer + → 스킬 ▸ / 플러그인 ▸ , / 자동완성]
  → 그룹 제목 = Orcinus orca · ~/.agents/skills · Claude · OpenCode, 같은 제목은 한 그룹
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 케밥 메뉴 열기 (4조합) | 정책 `menuIds`/`visibleIds`에서 타일 목록 생성 | `상태` 항목·하네스 로고 항목 없음 |
| 기존 세션에 열린 상태 패널이 있던 상태로 앱 업데이트 | 타일 배치는 메모리 상태라 재시작 시 초기화 | 상태 패널 없음 |
| MCP 탭에서 Orca MCP 추가 | 목록 재조회 → Orca 그룹 생성 | Orca 제목이 맨 위, 로고 온전, 행 아이콘 = MCP |
| 플러그인 탭 Orca provider 0개 | Orca 제목 생략 | Claude/OpenCode 그룹부터 시작(첫 제목 간격 `pt-5`) |
| Composer 스킬 패널, Claude 스킬 + Claude 플러그인 명령 공존 | 같은 제목 병합 | `Claude` 제목 하나 아래 두 종류 행 |

### 파생 UX / 엣지케이스

- loading / empty / error: 플러그인 페이지 로딩·빈 상태·`nativeMcp.failed` 안내 불변(`ExtensionsCatalogView.tsx:140-155`).
- cancel / retry / close / restart: 상태 패널의 새로고침·재시도 버튼은 패널과 함께 사라진다. Composer native 조회의 재연결 refresh는 유지(D-004).
- concurrency / multi-session: Composer의 peer push 반영·종료 generation 폐기 유지(AC14).
- keyboard / a11y / theme: 케밥 메뉴 항목 수 감소 외 키보드 경로 불변. 로고는 white/dark 사람 실기(AC16).
- 외부환경: 해당 없음.

## 6. 범위 / 비범위

- **범위**: renderer — 케밥 `상태` 항목, Claude `nativeStatus` 타일, OpenCode 상태 상세, 그 전용 모듈·hook 멤버·i18n 키 제거. 플러그인 페이지 세 탭 그룹 순서·제목·로고·Orca MCP 아이콘. Composer 첨부 메뉴·`/` 자동완성 그룹 제목·Orca 로고. 현재 상태 문서 갱신.
- **비범위**: main·preload·renderer `shared/api`의 세션 토글/열기 IPC와 main 구현 제거(D-003) · Composer 그룹 순서(D-012) · 스킬 상세 `작성자` 칸과 main `sourceLabel` 값(`bootstrap.ts:253` 등) · `OrcaLogo` 컴포넌트와 Header/Sidebar 로고 · 플러그인 페이지 전역 토글.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 세션 토글·열기 IPC 채널과 main 핸들러·peer 공유·어댑터 live 제어 제거 | 아니오 — 소비자 0인 휴면 표면 | NEXT_HANDOFF 후보(0284 처분과 함께 결정) |
| Composer 그룹 순서의 Orca 최상단 | 아니오 | 사용자 요청 시 별도 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 케밥 타일 항목 = Claude Code `[plan, subagent, diff]`, Claude Work·OpenCode Work·OpenCode Code `[task]`. 브랜드 로고 항목 없음. 고정·이름 변경·삭제 유지 | `ChatTitleBar.render.test.ts` `menuCases` 4조합 exact `toEqual` + Code 메뉴 `text-spinner`/`text-oc-ink` 부재 + 세션 액션 3종 기존 단언 | `ChatTitleBar` → `rightPanelMenuTileDefinitionsForAgent` → `MenuItem` |
| R-01 | AT-02 / AC2 | 상태 패널이 열리는 경로가 없다 — 타일 정의·양 registry·OpenCode 상세 선택·스토어 detail에 `nativeStatus`가 없다. 다른 타일 토글·상세(subagent/process/source/diff) 동작 유지 | `rightPanelTiles.test.ts` 정의 id 목록 exact · `rightPanelTiles.harness.test.ts` 정책 목록 · `chatStore.panelTiles.test.ts` 유지 케이스 · `Panel.interaction.test.ts` 유지 케이스 · `rg nativeStatus app/src` = 0 | 케밥 → `chatActions.toggleRightPanelTile` → reducer → `rightPanelColumnsForAgent` → `TilePanel` |
| R-02 | AT-03 / AC3 | Composer native 관측 유지 — 첨부 메뉴 native MCP·명령, `@` 장식, 재연결 refresh | `Composer.native-menu.test.ts` 7케이스 green(REGRESSION) | `ComposerInputController` → `useNativeResources` → `nativeResourceState` → `AttachMenu` |
| R-03 | AT-04 / AC4 | 스킬 탭 그룹 순서 = Orcinus orca → ~/.agents/skills → Claude → OpenCode(있는 그룹만), 그룹 안 순서 유지 | `catalogOrder.test.ts` 입력 순서에서 orca가 첫째가 아닌 4출처 fixture → 출력 순서 exact · `CustomizeList.render.test.ts` 행·제목 순서 | `ExtensionsCatalogView` → `CustomizeList` → `orderSkills` |
| R-03 | AT-05 / AC5 | MCP 탭 = Orcinus orca(활성→비활성) → Claude → OpenCode | `CustomizeList.render.test.ts` `data-extensions-row` 순서 exact + 제목 순서 exact | `CustomizeList` mcp 조립 |
| R-03 | AT-06 / AC6 | 플러그인 탭 = Orcinus orca 제목(Orca 로고) → gate→llm→service → Claude → OpenCode. Orca provider 0개면 Orca 제목 없음 | 같은 파일: 제목·행 순서 exact, `[aria-label="Orcinus orca"]`가 첫 제목 안 · providers=[] 변형에서 Orca 제목 부재 | `CustomizeList` providers 조립 |
| R-04 | AT-07 / AC7 | 플러그인 페이지 제목 텍스트 = 탭별 `[Orcinus orca, ~/.agents/skills, Claude, OpenCode]`·`[Orcinus orca, Claude, OpenCode]`×2 exact. 첫 제목 `pt-5`, 이후 `pt-8` | 같은 파일: 제목 `li`의 text·class 배열 exact. 모든 제목에 `스킬`·`플러그인`·`MCP` 부재 | `CustomizeList` → `SourceHeading` |
| R-04 | AT-08 / AC8 | Composer 첨부 메뉴: 스킬 패널 제목 = 출처 제목, 같은 제목은 하나(카탈로그 Claude 스킬 + Claude native 명령, native 없을 때 `adapter:claude`+`plugin:claude`). 플러그인 패널 = native MCP `Claude`/`OpenCode` → `Orcinus orca`(순서 기존) | `attachMenuModel.test.ts` heading 배열 exact · 같은 제목 heading 1개 | `AttachMenu` → `buildAttachMenu`·`nativeAttachItems` |
| R-04 | AT-09 / AC9 | `/` 자동완성 섹션 제목 = 출처 제목, 연속한 같은 제목은 한 섹션, 활성 인덱스 = 화면 순서 | `skillGroups.test.ts` 입력 `[adapter:claude, plugin:claude, orca, adapter:claude]` → 섹션 `[Claude(0,1), Orcinus orca(2), Claude(3)]` | `SkillAutocomplete` → `groupSkillSuggestions` ← `composerSkills` |
| R-04 | AT-10 / AC10 | 스킬 hover 설명 = `설명⏎<출처 제목>` | `attachMenuModel.test.ts` `skillTooltip(sourceSkills(...))` → `'설명 A\nOrcinus orca'` | `buildAttachMenu` → `skillTooltip` |
| R-05 | AT-11 / AC11 | Orca 로고 래퍼는 높이 토큰 + `w-auto`만 갖고 고정 가로(`size-*`·`w-<수치>`)가 없다 — 플러그인 페이지 3탭 제목, Composer 그룹 제목. Claude/OpenCode 로고 크기 불변 | `CustomizeList.render.test.ts` 3탭 `[aria-label="Orcinus orca"]` class 토큰 · `Composer.native-menu.test.ts` 같은 요소 class 토큰 | `SourceHeading` / `composerHarness().sourceIcon('orca')` |
| R-06 | AT-12 / AC12 | Orca MCP 행·상세 머리 아이콘 = `mcp`(http·stdio 둘 다), 전송 방식 표기 유지 | `CustomizeList.render.test.ts` http+stdio 서버 → 두 행 아이콘 markup = `Icon name="mcp"` markup · `mcpDetail.render.test.ts` 두 전송 | `CustomizeList` / `McpDetail` |
| R-07 | AT-13 / AC13 | renderer feature가 세션 토글·열기 IPC를 부르지 않는다. IPC 표면은 유지 | `rg "setNativeResource\|openNativePlugin" app/src/renderer/src/features` = 0 · `preload/index.test.ts` 기존 bridge 케이스 green | — / preload `session.setNativeResource`·`openNativePlugin` |
| R-02 | AT-14 / AC14 | `nativeResourceState` 읽기 불변식 유지 — draft scope 가드, A→B→A 캐시, 재연결 fence, 종료 generation 폐기, peer push, 부분 실패 보존 | `useNativeResources.test.ts` 유지 케이스(§7 주의사항 목록) · `nativeResourceState.composer.test.ts` green | `nativeResourceState()` window 캐시 → `sessionApi.nativeResources`·`onNativeResourcesChanged` |
| R-08 | AT-15 / AC15 | 현재 상태 문서가 상태 타일을 서술하지 않고 플러그인 페이지 순서·제목을 새 규칙으로 서술한다 | `rg -n "상태 타일\|상태 패널\|nativeStatus\|NativeResourcesTile\|nativeResourcesMenu\|preparedResourcesView" docs/arch docs/IPC_CONTRACT.md` = 0 · `node scripts/check-doc-inventory.mjs --check` | `docs/arch/frontend/*` |
| R-05 | AT-16 / AC16 | 실제 창 white/dark: 플러그인 페이지 3탭 Orca 로고 우측 잘림 없음, 제목·순서·MCP 아이콘. Composer `+` 메뉴 Orca 로고 잘림 없음. 케밥에 `상태` 없음, 우측 패널 정상 | 사람 실기 | `npm run dev` |

### AC 검증 주의사항

- 기존 테스트 재사용: `ChatTitleBar.render.test.ts:114-122` `menuCases`·`:126`·`:162`·`:193` 케이스, `catalogOrder.test.ts:44`, `skillGroups.test.ts:10`, `attachMenuModel.test.ts:228`·`:267`, `Composer.native-menu.test.ts` 7케이스(`:123`·`:190`·`:220`·`:277`·`:302`·`:396`·`:433`), `preload/index.test.ts:420` 존재를 이번 세션에 확인했다.
- `useNativeResources.test.ts` 처분: **유지(필요 시 제거된 멤버 참조만 정리)** `:151` it.each 3·`:175`·`:205`·`:317`·`:403`·`:485`의 `read` 변형·`:518`(pending 단언 제외)·`:596`·`:625`·`:913`·`:974`(read·exited fence 부분). **삭제** `:251`·`:274`·`:376`·`:447`·`:485`의 `write` 변형·`:539`·`:655`·`:711`·`:732`·`:776`·`:812`·`:861`·`:931` — 전부 toggle/openPlugin/pending/패널 렌더 대상.
- 삭제 테스트 파일: `NativeResourcesTile.test.ts`(4)·`opencode/rightpanel/NativeResources.test.ts`(3)·`nativeResourcesMenu.test.ts`·`preparedResourcesView.test.ts`(2). `chatStore.panelTiles.test.ts:17`·`Panel.interaction.test.ts:113`·`composerCatalogState.test.ts:187` 케이스 삭제.
- 사람 실기 항목: AC16만 — 픽셀 잘림은 jsdom이 레이아웃을 계산하지 않아 기계 관측 불가. 크기 계약은 AC11이 기계로 잠근다.
- 총량/0건 기준: AC2·AC13·AC15의 0건 스윕은 각각 양성 단언(AC1 목록, AC3 Composer 관측·AC13 preload bridge, AC7 새 서술)과 짝이다.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 명시 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 / AT-01·AT-02 | R/AT | §7 AC1·AC2 — 상태 항목·패널 없음 | NEW | — |
| R-02 / AT-03·AT-14 | R/AT | §7 AC3·AC14 — Composer native 관측 유지 | NEW | — |
| R-03 / AT-04~06 | R/AT | §7 AC4~AC6 — Orca 최상단 | NEW | — |
| R-04 / AT-07~10 | R/AT | §7 AC7~AC10 — 제목 규칙 | NEW | — |
| R-05 / AT-11·AT-16 | R/AT | §7 AC11·AC16 — 로고 온전 | NEW | — |
| R-06 / AT-12 | R/AT | §7 AC12 — MCP 아이콘 | NEW | — |
| R-07 / AT-13 | R/AT | §7 AC13 — 세션 제어 소비 제거·IPC 유지 | NEW | — |
| R-08 / AT-15 | R/AT | §7 AC15 — 문서 | NEW | — |
| SD-01 / ST-01 | SD/ST | §9 우측 패널 상태 전이 — 토글·상세 열기/닫기에서 `nativeStatus` 분기 소멸 | NEW | — |
| AR-01 / IT-01 | AR/IT | §9 renderer feature ↔ IPC 경계 — 세션 제어 호출 0, 읽기 호출 유지 | NEW | — |
| AR-02 / IT-02 | AR/IT | §10 출처 제목 SSOT(`shared/extension-sources.ts`) → skills·chat feature 소비 | NEW | — |
| MD-01 / UT-01 | MD/UT | §10 타일 정의·하네스 정책·배치 필터 | NEW | — |
| MD-02 / UT-02 | MD/UT | §10 `nativeResourceState` 읽기 전용 상태기계 | NEW | — |
| MD-03 / UT-03 | MD/UT | §10 `orderSkills` Orca 우선 | NEW | — |
| MD-04 / UT-04 | MD/UT | §10 `buildAttachMenu` 제목 기준 그룹 | NEW | — |
| MD-05 / UT-05 | MD/UT | §10 `groupSkillSuggestions` 연속 같은 제목 | NEW | — |
| MD-06 / UT-06 | MD/UT | §10 Orca 로고 소비자 크기 토큰 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 케밥 클릭 → `menuTiles` → `MenuItem` 렌더 | `ChatTitleBar.render.test.ts:'$backend $kind의 기존 순서·지원 항목과 타일 표시 제목을 보존한다'`(4조합 exact) · `:'…모든 항목이 자신의 타일을 토글하고…'` · `:'…기존 고정·이름 변경·삭제 메뉴를 보존한다'` | not selected — exact 배열이 추가·누락 둘 다 red | EP-01 ChatTitleBar(5) |
| VP-02 | SD-01 ↔ ST-01 | REQUIRED | `toggleRightPanelTile`/`setRightPanelTileActive`/`removeRightPanelTile` → reducer → `panelReveal` → OpenCode `Panel` detail | `chatStore.panelTiles.test.ts:'keeps the summary and other selections while opening and revealing each target'` · `:'clears only the closed process selection through %s'` · `Panel.interaction.test.ts:'opens one overlay with the selected task and parent width, resizes the parent, then closes without adding tiles'` | not selected — 직접 상태 단언 | EP-01 chatStore(8)·navigation(1)·RightPanelTile(2) |
| VP-03 | MD-01 ↔ UT-01 | REQUIRED | `rightPanelTileDefinitions` → 하네스 정책 → `rightPanelColumnsForAgent` | 신규 `rightPanelTiles.test.ts:'정의 id는 plan·subagent·task·diff·process·source 순서다'`(exact) · `rightPanelTiles.harness.test.ts` 4케이스 정책 목록 exact · `rightPanelLayout.test.ts` 기존 필터 케이스(`nativeStatus` 입력 → 다른 미지원 id로 교체) | not selected | EP-01 rightPanelTiles(2)·claude/rightPanel(1)·opencode/rightPanel(3)·rightPanelLayout(1)·tileRegistry×2(4) |
| VP-04 | R-02 ↔ AT-03 | REQUIRED | `ComposerInputController` → `useNativeResources(view·ensure)` → `AttachMenu` | `Composer.native-menu.test.ts` 7케이스(§7 주의사항) | not selected — 기존 행동 단언 | 0 — 경로 유지, 변경 없음 |
| VP-05 | MD-02 ↔ UT-02 | REQUIRED | `nativeResourceState()` → `subscribe`/`ensure`/`accept`/`retire`/`reconnect` → snapshot `view` | `useNativeResources.test.ts` 유지 케이스(§7 주의사항 목록) · `nativeResourceState.composer.test.ts:'retains a failed live Composer read only within the same generation and accepts authoritative removal'` | required — 음성 스윕 민감도: `nativeResourceState.ts`에 `sessionApi.setNativeResource(` 호출 1줄을 되살리면 EP-03 검색 1건 | EP-03 (4) |
| VP-06 | AR-01 ↔ IT-01 | REQUIRED | renderer feature → `shared/api/ipc.ts` → preload bridge | 음성 `gate:rg -n "setNativeResource\|openNativePlugin" app/src/renderer/src/features` = 0 · 양성 `preload/index.test.ts:'preserves native resource state and toggle identity through renderer and preload'` green(무수정) | 위 VP-05와 같은 변이 | EP-03 (4) |
| VP-07 | R-03 ↔ AT-04~06 | REQUIRED | `ExtensionsCatalogView` → `CustomizeList`(탭별 조립) → `SourceHeading`·`CatalogListRow` | 신규 `CustomizeList.render.test.ts:'puts the Orcinus orca group first in every tab'` — 3탭 각각 Orca·Claude·OpenCode 행이 모두 있는 fixture, 행 id·제목 순서 exact · providers=[] 변형 | required — 형제 맞바꿈: `{tab==='mcp' && nativeList}`를 Orca 블록 뒤로 되돌림 · providers Orca 제목 제거 → red | EP-07 (3) |
| VP-08 | MD-03 ↔ UT-03 | REQUIRED | `orderSkills` | `catalogOrder.test.ts:'orders skill sources by label and keeps the original order within each source'` 갱신 — 입력 `[opencode, orca, agents, claude]` 라벨 → 출력 `orca → agents → claude → opencode` | required — Orca 우선 비교 제거 시 red | EP-07 orderSkills(1) |
| VP-09 | AR-02 ↔ IT-02 | REQUIRED | `extension-sources.ts` 제목 → `CustomizeList`·`composerSkills`·`buildAttachMenu`·`nativeAttachItems`·`skillGroups` | 신규 `CustomizeList.render.test.ts:'titles every group by brand name only'`(AC7) · `attachMenuModel.test.ts:'lists source headings and every skill in one panel'` 갱신(AC8) · `:'hover 설명: …'` 갱신(AC10) | required — 다른 값: 한 자리를 옛 접미 문자열로 되돌림(자리마다) → red | EP-05 (9) |
| VP-10 | MD-04 ↔ UT-04 | REQUIRED | `buildAttachMenu` skills 그룹화 + native 병합 | 신규 `attachMenuModel.test.ts:'merges groups that share a title into one heading'` — native 없음+`adapter:claude`·`plugin:claude` / native 있음+카탈로그 Claude+native 플러그인 명령 → `Claude` heading 1개 | required — 그룹 key를 `sourceId`로 되돌림 → heading 2개 red | EP-06 (2) |
| VP-11 | MD-05 ↔ UT-05 | REQUIRED | `groupSkillSuggestions` | `skillGroups.test.ts:'연속한 같은 출처를 한 섹션으로 묶고 평면 인덱스를 그대로 둔다'` 갱신(AC9 입력) | required — 비교를 `sourceId`로 되돌림 → 섹션 4개 red | EP-06 skillGroups(1) |
| VP-12 | R-04 ↔ AT-08·09 | REQUIRED | Composer `+` 클릭 → `AttachMenu` → `CascadeMenu` / `/` 입력 → `SkillAutocomplete` | `attachMenu.render.test.ts:'/ 후보가 출처 헤더 아래 묶이고 활성 인덱스가 화면 순서와 같다'` 갱신(제목 `Orcinus orca`·`Claude`) · `Composer.native-menu.test.ts:'shows all source groups directly for %s and keeps draft text on selection'`에 제목 텍스트 단언 추가 | not selected — 하위 pair가 변이 보유 | EP-05 attachMenuModel(4)·skillGroups(1) |
| VP-13 | R-05 ↔ AT-11 | REQUIRED | `SourceHeading(source='orca')` / `sourceIcon('orca')` → `OrcaLogo` 래퍼 class | 신규 `CustomizeList.render.test.ts:'sizes the Orca mark by height only'` — 3탭 `[aria-label="Orcinus orca"]` class에 `h-4`·`w-auto`, `/^(size-\|w-(?!auto))/` 토큰 0 · `Composer.native-menu.test.ts:'shows all source groups…'`에 같은 단언(`h-3.5`) | required — 구조 proxy: `size-4`·`w-4` 되돌림(자리마다) → red | EP-08 (2) |
| VP-14 | R-06 ↔ AT-12 | REQUIRED | `CustomizeList` mcp 행 / `McpDetail` 머리 → `Icon` | 신규 `CustomizeList.render.test.ts:'uses the MCP icon for Orca MCP rows of both transports'` — http·stdio 서버, 행 안 아이콘 markup = `renderToStaticMarkup(Icon mcp 20)` · 신규 `mcpDetail.render.test.ts:'uses the MCP icon in the header for both transports'` | required — 한 자리를 `link`/`cpu`로 되돌림 → red | EP-09 (2) |
| VP-15 | R-08 ↔ AT-15 | REQUIRED | docs | 음성 `gate:rg`(AC15) = 0 · 양성 `rendering.md` 플러그인 목록 문단에 "각 탭은 Orcinus orca 그룹이 맨 위" 서술 존재 · `gate:node scripts/check-doc-inventory.mjs --check` | not selected | EP-11 (15) |
| VP-16 | R-05 ↔ AT-16 | REQUIRED | `npm run dev` 실제 창 | 사람 실기 | — | — |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| lint (boundaries 포함) | renderer 모듈 삭제·import 변경 | `cd app && npm run lint` | 이번 변경이 낸 error |
| typecheck | `RightPanelTileId` union 축소가 모든 참조를 컴파일로 드러냄 | `cd app && npm run typecheck` | 이번 변경 유발분 |
| 관련 vitest(비-DB) | 위 pair 좌표 | `cd app && ./node_modules/.bin/vitest run src/renderer/src/features/chat src/renderer/src/features/skills src/preload` | 이번 변경 유발분, DB ABI 서명은 분리 |
| doc inventory | 문서 편집 | `cd app && node scripts/check-doc-inventory.mjs --check` | 이번 변경 유발분 |
| commit trailer | 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 케밥 `상태` 항목 = 타일 `nativeStatus` + 하네스 로고 | `ChatTitleBar.tsx:65-67`·`:221-249` |
| 타일 정의 SSOT, 정의 순서 = 메뉴 순서 | `rightPanelTiles.ts:10-18` |
| Claude Code 지원 타일에 `nativeStatus` | `harnesses/claude/rightPanel.ts:17` |
| OpenCode Code 메뉴 = `task`·`nativeStatus`, Work는 필터 | `harnesses/opencode/rightPanel.ts:7-8`·`:18` |
| OpenCode `nativeStatus`는 독립 타일이 아니라 작업 열 위 상세 | `chatStore.ts:331-347` `setNativeStatusDetail`, `rightPanelLayout.ts:46` |
| Composer는 native 관측의 `view`·`ensure`만 쓴다 | `ComposerInputController.tsx:141-162`·`:224-229` |
| `toggle`/`openPlugin` 소비처 = 상태 패널 하나 | `NativeResourcesTile.tsx:65`·`:114` |
| composer catalog `resources` 구독 소비처 = OpenCode 상태 상세 하나 | `opencode/rightpanel/NativeResources.tsx:24` |
| 플러그인 페이지 전역 토글은 별도 IPC | `skills/hooks/useNativeMcpCatalog.ts:90` `setGlobalExtension` |
| 그룹 제목 문자열 SSOT 후보 | `shared/extension-sources.ts:3-10`(renderer 소비자만 import) |
| OrcaLogo는 높이 기준 계약, 캔버스 1254², 마크 1023×776 | `OrcaLogo.tsx:4-19`, `file resources/logo.png` |
| 우측 패널 배치는 영속되지 않는다 | `rg rightPanelTiles app/src/{main,shared,preload}` → 0 |
| vitest include = `src/**/*.test.ts`(tsx 제외) | `app/vitest.config.ts:8` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `nativeStatus` 비-테스트 참조 | `rg -n "nativeStatus" app/src --glob '!*.test.*'` | 32줄/13파일 | EP-01 분모 |
| `nativeStatus` 테스트 파일 | `rg -l "nativeStatus" app/src --glob '*.test.*'` | 8 | 갱신/삭제 대상 |
| 세션 제어 호출(feature) | `rg -n "setNativeResource\|openNativePlugin" app/src/renderer/src/features --glob '!*.test.*'` | 2 | `nativeResourceState.ts:214`·`:260` |
| 세션 제어 IPC 표면 | `rg -n "setNativeResource\|openNativePlugin" app/src --glob '!*.test.*'` | 18 | main 10·preload 2·shared/api 4·feature 2 — feature만 제거 |
| 그룹 제목 생산 자리 | §10 EP-05 명령 | 9 | 제목 SSOT 적용 분모 |
| OrcaLogo 소비자 | `rg -n "<OrcaLogo\|createElement\(OrcaLogo" app/src/renderer/src --glob '!*.test.*'` | 5 | Header·Sidebar×2는 이미 `h-* w-auto`, 수정 2 |
| Orca MCP 아이콘 | `rg -n "'link' : 'cpu'" app/src/renderer/src --glob '!*.test.*'` | 2 | EP-09 |
| `chat.nativeResources` 키 | ko 블록 26키 각각 정적 소비자 grep | 6키 소비자 0 예정 | `openConfig`·`openFolder`·`loading`·`enable`·`disable`·`plugins` |
| 현재 상태 문서 서술 | AC15 검색 | 13줄/5파일 | 삭제·재서술 대상. EP-11은 여기에 `rendering.md:231`·`design-components.md:392`(갱신)를 더한 15 |

### 수치 / 전칭 표현 검산

- 재측정: 32 = 5+3+1+2+2+3+1+2+1+2+8+1+1 (EP-01 파일별 합).
- 18 = main 10(`adapter.ts` 1·`types.ts` 1·`channel.ts` 1·`session-resources.ts` 1·`native-resource-sharing.ts` 3·`session-runtime.ts` 3 — 행 기준) + preload 2 + shared/api 4 + feature 2 — 이 표는 feature 2만 분모로 쓴다.
- "Composer는 view·ensure만": `rg -n "native\.(busy|pending|refresh|toggle|openPlugin|ensure|view)" app/src/renderer/src/features/chat --glob '!*.test.*'` → 8줄 = `ensure` 1·`view` 7, 나머지 0.
- 로고 계산: 1023/776 = 1.3183. h16 → 21.09px, h14 → 18.46px.
- 문서 앵커: `rendering.md:271` `### 하네스 상태 타일` 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01, AR-01, AR-02.
- 상태 패널: 케밥 → `toggleRightPanelTile('nativeStatus')` → Claude는 타일 추가, OpenCode는 `setNativeStatusDetail` → `panelReveal.detail` → `Panel` 상세 → `NativeResourcesTileView` → `useNativeResources` → `nativeResourceState.toggle/openPlugin` → `sessionApi.setNativeResource/openNativePlugin`.
- 플러그인 페이지: `CustomizeList`가 스킬(`orderSkills` 라벨순) / MCP(native → Orca) / 플러그인(provider → native) 순서로 조립하고 제목을 세 군데에서 각자 문자열로 만든다.
- Composer: `extensionSourceLabels`(접미 포함) → `sourceSkills` → 그룹 key `sourceId`. native 제목은 `${harness} 플러그인|스킬`·`${label} MCP`·`'Orcinus orca 플러그인'` 리터럴.
- 로고: `SourceHeading` `size-4`, composer `h-3.5 w-4`가 OrcaLogo 가로를 고정 → 우측 잘림.

```text
ChatTitleBar ─toggle(nativeStatus)─▶ chatStore ─▶ Claude 타일 | OpenCode detail
                                                    └▶ NativeResourcesTile ─▶ useNativeResources ─▶ nativeResourceState
                                                                                                    ├ read  ─▶ sessionApi.nativeResources
                                                                                                    └ write ─▶ sessionApi.setNativeResource/openNativePlugin
Composer ─────────────────────────────────────────────▶ useNativeResources(view, ensure) ─┘
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-01, AR-01, AR-02.
- 상태 패널 경로 삭제: `nativeStatus` id가 union에서 빠지고 registry·정책·스토어·OpenCode 선택·라벨 분기가 사라진다. 케밥은 나머지 타일만 그린다.
- `nativeResourceState`는 읽기 전용 관측 소유자가 된다: `subscribe`·`ensure`·`accept`·`retire`·`reconnect`·내부 `refresh`. snapshot은 `{ view }`. hook은 `{ view, ensure }`.
- `useComposerCatalog`는 `resources` 인자가 없고 `composerCatalogState.subscribeResources`가 없다.
- 제목 SSOT: `extension-sources.ts`의 `extensionSourceLabels` 값이 제목이 되고(`orca` = `PRODUCT_DISPLAY_NAME`), `harnessSourceTitle(backend)`가 `Claude`/`OpenCode`를 준다. 모든 제목 생산 자리가 둘 중 하나를 읽는다.
- 플러그인 페이지 조립: 탭마다 Orca 블록 → native 블록. 스킬은 `orderSkills`가 Orca 우선.
- Composer 그룹 key = 제목.
- 로고: 소비자 2곳이 `h-* w-auto`.

```text
ChatTitleBar ─▶ menuTiles(plan|subagent|diff|task…) ─▶ chatStore ─▶ TilePanel
Composer ─▶ useNativeResources(view, ensure) ─▶ nativeResourceState(read only) ─▶ sessionApi.nativeResources
extension-sources(제목 SSOT) ─▶ CustomizeList · composerSkills · attachMenuModel · skillGroups
IPC 표면(main·preload·shared/api)의 set/open 채널: 유지, renderer feature 소비자 0
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | `nativeResourceState` = 관측 + 세션 제어 | 관측만 | D-002·D-003 | MD-02 / VP-05 · `nativeResourceState.ts` |
| data/control flow | 케밥 → 상태 타일/상세 | 경로 삭제 | D-001·D-002 | SD-01 / VP-01·02 |
| state/contract | `RightPanelTileId`에 `nativeStatus`, `panelReveal.detail`에 `nativeStatus` | 둘 다 없음 | D-002 | MD-01 / VP-03 |
| 제목 | 자리마다 리터럴 | SSOT 2종 | D-007 | AR-02 / VP-09 |
| 순서 | Orca 뒤(스킬·MCP), 제목 없음(플러그인) | Orca 최상단 + 제목 | D-005·D-006 | MD-03 / VP-07·08 |
| 그룹 key(Composer) | `sourceId` | 제목 | D-010 | MD-04·05 / VP-10·11 |
| test seam/관측점 | 상태 패널 렌더 테스트 | 삭제, 정책·조립 순수 단언 | — | VP-03·07 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/src/shared/extension-sources.ts` | 출처 → 제목 SSOT | sourceId/backend → string | skills·chat feature |
| `features/skills/lib/catalogOrder.ts` | 스킬 그룹 순서(Orca 우선) | SkillInfo[] → SkillInfo[] | `CustomizeList` |
| `features/skills/components/customize/CustomizeList.tsx` | 탭별 블록 조립 | props → `ul` | `ExtensionsCatalogView` |
| `features/chat/lib/attachMenuModel.ts`·`skillGroups.ts` | Composer 그룹(제목 key) | 순수 | `AttachMenu`·`SkillAutocomplete` |
| `features/chat/lib/nativeResourceState.ts` | native 관측(읽기 전용) | IPC read/push → view | `useNativeResources` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-01·02·03 · EP-01 | `nativeStatus` 소멸 | `rightPanelTiles.ts` 정의 | 구현자 | `ChatTitleBar.tsx`(5) · `NativeResourcesTile.tsx`(3, 파일 삭제) · `claude/rightPanel.ts`(1) · `claude/rightpanel/tileRegistry.ts`(2) · `common/rightpanel/RightPanelTile.tsx`(2) · `opencode/rightPanel.ts`(3) · `opencode/rightpanel/navigation.ts`(1) · `opencode/rightpanel/tileRegistry.ts`(2) · `rightPanelLayout.ts`(1) · `rightPanelTiles.ts`(2) · `chatStore.ts`(8) · `i18n en.ts`(1) · `ko.ts`(1) = 32 | `rg -n "nativeStatus" app/src --glob '!*.test.*'` → 32 → 목표 0 | 하나라도 남으면 메뉴·스토어에 죽은 분기 또는 컴파일 실패 |
| VP-02 · EP-02 | 상태 패널 전용 모듈 삭제 | — | 구현자 | `components/rightpanel/NativeResourcesTile.tsx` · `opencode/rightpanel/NativeResources.tsx` · `opencode/rightpanel/preparedResourcesView.ts` · `lib/nativeResourcesMenu.ts` = 4파일(+테스트 4) | `rg -l "NativeResourcesTile\|OpenCodeNativeResourcesTile\|preparedResourcesView\|nativeResourcesMenu" app/src` → 목표 0 | 남으면 패널 재조립 가능 |
| MD-02·AR-01 / VP-05·06 · EP-03 | 세션 제어 소비 제거 | `nativeResourceState.ts` | 구현자 | `useNativeResources.ts:20-21`(타입) · `:49-50`(구현) · `nativeResourceState.ts:209-245 openPlugin`(`:214` 호출) · `:247-289 toggle`(`:260` 호출) = 4 | `rg -n "setNativeResource\|openNativePlugin\|state\.toggle\|state\.openPlugin\|openPlugin:\|toggle: \(resource" app/src/renderer/src/features/chat --glob '!*.test.*'` → 6줄(4자리) → 목표 0 | 남으면 화면 없는 쓰기 경로 |
| MD-02 / VP-05 · EP-03′ | 제어 전용 내부 상태 제거 | 같은 파일 | 구현자 | `operations`·`serial`·`pushSerial`·`epoch`·`begin`·`finish`·snapshot `pending`·`Issue`의 `control`/`open` — 읽기 경로가 읽지 않는 멤버만 | `rg -n "operations\|pushSerial\|this\.epoch\|begin\(\|finish\(\|pending" app/src/renderer/src/features/chat/lib/nativeResourceState.ts` → 목표 0 | 남아도 동작은 같다 — 죽은 상태. 읽기 불변식은 VP-05 좌표가 지킨다 |
| VP-02 · EP-04 | composer catalog `resources` 구독 제거 | `composerCatalogState.ts` | 구현자 | `composerCatalogState.ts:84` · `useComposerCatalog.ts:16`·`:48` = 3 | `rg -n "subscribeResources\|resources = false\|resources \?" app/src/renderer/src/features --glob '!*.test.*'` → 3 → 목표 0 | 남으면 소비자 없는 mcp/plugins part 조회 경로 |
| AR-02 / VP-09·12 · EP-05 | 그룹 제목 = 브랜드 이름 | `extension-sources.ts` `extensionSourceLabels`(값 6) + 신규 `harnessSourceTitle` | 구현자 | `CustomizeList.tsx:83-87`(native) · `:132-136`(skills) · `:172`(Orca MCP) · 신규 providers Orca 제목 · `attachMenuModel.ts:79`(group label) · `:128` · `:168` · `:252` · `skillGroups.ts:19` = 9(신규 1 포함) | `rg -n "<SourceHeading\|label: skill\.sourceLabel\|label=\{extensionSourceLabels\|label: 'Orcinus orca\|native\.label\} MCP\|'플러그인' : '스킬'" app/src/renderer/src/features --glob '!*.test.*'` → 현재 9줄 = 자리 8(`:132`·`:135`는 한 자리), 구현 후 신규 providers 제목을 더해 자리 9 · `rg -n "(스킬\|플러그인\|MCP)['\`]" app/src/shared/extension-sources.ts app/src/renderer/src/features/chat/lib/attachMenuModel.ts app/src/renderer/src/features/skills --glob '!*.test.*'` → 목표 0 | 한 자리라도 리터럴이면 그 표면만 옛 제목 |
| MD-04·05 / VP-10·11 · EP-06 | 같은 제목 = 한 그룹 | 제목 | 구현자 | `attachMenuModel.ts:77-79`(bySource key) · `skillGroups.ts:15`(연속 비교) = 2. `attachMenuModel.ts:149` native 병합은 이미 label 기준 — 유지 | `rg -n "bySource\.(get\|set)\|last\.items\[0\]\.skill\.source" app/src/renderer/src/features/chat/lib --glob '!*.test.*'` → 3줄(2자리 — `:77`·`:79`는 한 자리) | key가 sourceId면 같은 제목 heading 2개 |
| MD-03 / VP-07·08 · EP-07 | Orca 그룹 최상단 | `catalogOrder.ts`·`CustomizeList.tsx` | 구현자 | `catalogOrder.ts:12` sort · `CustomizeList.tsx:170-211` mcp 조립 순서 · `:212-242` providers 조립(Orca 제목 신설 포함) = 3 | `rg -n "localeCompare\(b\[0\]\.sourceLabel\)\|tab === 'mcp' && nativeList\|tab === 'providers' && nativeList\|orderProviders\(providers\)\.map" app/src/renderer/src/features/skills --glob '!*.test.*'` → 4줄(3자리) | 한 탭이라도 Orca가 아래면 D-005 위반 |
| MD-06 / VP-13 · EP-08 | Orca 로고 높이 기준 | `OrcaLogo.tsx:4-6` 계약 | 구현자 | `SourceHeading.tsx:9`·`:25` · `registries/composer.ts:18` = 2 | `rg -n "<OrcaLogo\|createElement\(OrcaLogo" app/src/renderer/src --glob '!*.test.*'` → 5(이 pair path는 2) | 가로 고정이면 우측 잘림 |
| R-06 / VP-14 · EP-09 | Orca MCP 아이콘 | `Icon` `mcp` | 구현자 | `CustomizeList.tsx:185` · `McpDetail.tsx:49` = 2 | `rg -n "'link' : 'cpu'" app/src/renderer/src --glob '!*.test.*'` → 2 → 목표 0 | 한 곳이 link/cpu |
| R-07 · EP-10 | 소비자 0 i18n 키 제거 | `i18n/resources/{ko,en}.ts` | 구현자 | `chat.rightpanel.tiles.nativeStatus` · `harness.catalogRefresh` · `chat.nativeResources.{openConfig,openFolder,loading,enable,disable,plugins}` = 8키 × 2 locale = 16 | 키마다 `rg -n "<prefix>\.<key>\b" app/src/renderer/src --glob '!*.test.*' --glob '!**/i18n/resources/**'` → 각 0 확인 후 삭제. 동적 `chat.nativeResources.${status}` 상태값 키는 삭제 금지 | 남아도 동작 동일 — 죽은 문자열 |
| R-08 / VP-15 · EP-11 | 현재 상태 문서 | `docs/arch`·`IPC_CONTRACT.md` | 구현자 | `IPC_CONTRACT.md:82`·`:84` · `design-components.md:118`·`:119`(행 삭제)·`:392`(갱신) · `adapters.md:51`·`:55` · `rendering.md:231`(갱신)·`:258`·`:271`·`:273`·`:275` · `state.md:197`·`:199`·`:202` = 15 | `rg -n "상태 타일\|상태 패널\|nativeStatus\|NativeResourcesTile\|nativeResourcesMenu\|preparedResourcesView\|SourceHeading\|Claude 플러그인·OpenCode 플러그인" docs/arch docs/IPC_CONTRACT.md` → 15 = 자리 목록. 구현 후 AC15 검색(앞 6패턴) 0 | 문서가 없는 기능을 서술 |

- 자리 목록은 그 검색 출력과 차집합 0이어야 한다. verify가 시도해 테스트가 잡지 못한 고장은 목록 안팎 모두 다음 구현이 고친다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).
- 같은 규칙의 SSOT: 제목은 `extension-sources.ts` 하나. `CustomizeList` native 제목·`attachMenuModel` native 제목은 `harnessSourceTitle(backend)`, Orca 제목은 `extensionSourceLabels.orca`(= `PRODUCT_DISPLAY_NAME`)를 읽는다. Composer의 `nativeMenu.label`(`ComposerInputController.tsx:158`)도 `harnessSourceTitle`로 바꾼다.
- `실패 의미`에 "다른 게이트가 막는다": EP-01의 컴파일 실패는 union 축소 후 typecheck가 낸다 — 이번 턴 측정: 미측정이므로 보호로 세지 않고 rg 0 목표를 분모로 둔다.
- 선택적 필드: `useComposerCatalog`의 `resources` 기본값 `false` 삭제 — 남은 호출 2곳(`Controls.tsx:14`·`:29`)은 인자를 주지 않는다.
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `shared/extension-sources.ts` | 제목 SSOT | 값 → `orca: PRODUCT_DISPLAY_NAME`, `agents: '~/.agents/skills'`, `adapter:/plugin:claude: 'Claude'`, `adapter:/plugin:opencode: 'OpenCode'`. `harnessSourceTitle(backend: Backend): string` 추가 | 순수 |
| `features/chat/lib/rightPanelTiles.ts` | 타일 정의 | `nativeStatus` 정의 삭제, `rightPanelTileLabel`의 특수 분기 삭제(서명 정리는 구현자 재량, 다른 타일 라벨 결과 불변) | `rightPanelTiles.test.ts` |
| `harnesses/{claude,opencode}/rightPanel.ts` | 정책 | `visibleIds`·`menuIds`에서 삭제. OpenCode Work 필터는 대상이 없어지므로 정리 | harness 테스트 |
| `harnesses/{claude,opencode}/rightpanel/tileRegistry.ts` · `common/rightpanel/RightPanelTile.tsx` · `opencode/rightpanel/navigation.ts` · `lib/rightPanelLayout.ts` | registry·chrome·선택 | `nativeStatus` 항목·분기 삭제 | 기존 |
| `store/chatStore.ts` | 패널 상태 | `panelReveal.detail`에서 `nativeStatus` 삭제, `setNativeStatusDetail`과 3개 action 분기 삭제 | `chatStore.panelTiles.test.ts` |
| `components/ChatTitleBar.tsx` | 케밥 | `statusDetail` 구독·`nativeStatus` 분기·`HarnessLogo` import 삭제. 항목 아이콘은 `active ? 'check' : 'plus'` 단일 규칙 | `ChatTitleBar.render.test.ts` |
| 삭제 4파일 + 테스트 | 상태 패널 | §10 EP-02 | — |
| `hooks/useNativeResources.ts` · `lib/nativeResourceState.ts` | 관측 | §9 TO-BE — 반환 `{ view, ensure }`, 제어·pending 상태 제거 | `useNativeResources.test.ts` 유지 케이스 |
| `harnesses/opencode/composer/{useComposerCatalog,composerCatalogState}.ts` | catalog | `resources` 인자·`subscribeResources` 삭제 | `composerCatalogState.test.ts` |
| `features/skills/lib/catalogOrder.ts` | 순서 | `orderSkills`: `orca` 그룹 우선, 나머지 기존 라벨 비교 | `catalogOrder.test.ts` |
| `features/skills/components/customize/CustomizeList.tsx` | 조립 | MCP: Orca 제목+행 → nativeList. providers: `providers.length>0`이면 Orca 제목 → 행 → nativeList. native 제목 = `harnessSourceTitle`. native 첫 제목 `spaced` = `index>0 \|\| Orca 그룹 존재`. Orca MCP 아이콘 `mcp` | `CustomizeList.render.test.ts` |
| `features/skills/components/customize/SourceHeading.tsx` | 로고 | Orca 분기 class `h-4 w-auto shrink-0`, Claude/OpenCode `size-4` 유지 | 같은 파일 |
| `features/skills/components/customize/McpDetail.tsx` | 상세 | 머리 아이콘 `mcp` | `mcpDetail.render.test.ts` |
| `features/chat/lib/attachMenuModel.ts` | Composer 메뉴 | 그룹 key = `skill.sourceLabel`(heading id·leading은 그룹 첫 sourceId), `:128` → `extensionSourceLabels.orca`, `:168` → `input.native.label`, `:252` → `labels.harness ?? harnessSourceTitle('claude')` | `attachMenuModel.test.ts` |
| `features/chat/lib/skillGroups.ts` | 자동완성 | 연속 비교 `sourceLabel` | `skillGroups.test.ts` |
| `features/chat/harnesses/registries/composer.ts` | 로고 | `h-3.5 w-auto shrink-0` | `Composer.native-menu.test.ts` |
| `harnesses/common/composer/ComposerInputController.tsx` | native 라벨 | `nativeMenu.label` = `harnessSourceTitle(backend ?? 'claude')` | 기존 |
| `i18n/resources/{ko,en}.ts` | 문자열 | §10 EP-10 | typecheck(`MessageKey`) |
| docs 5파일 | 현재 상태 | §10 EP-11 — 상태 타일 절 삭제, 플러그인 목록 순서·제목 갱신, `nativeResourceState`를 읽기 전용 관측으로, `SourceHeading` 행에 Orca 로고 높이 기준·세 탭 Orca 우선 | rg |

### 테스트 가능성

- electron/DB 의존 없음 — 전부 renderer 순수·static markup 테스트(`.test.ts`).
- 기존 메커니즘 재사용: `SourceHeading`을 플러그인 탭 Orca 제목에도 쓴다(형상·시점 동일).
- 순서 관측: `data-extensions-row` 순서 + 제목 `li` 순서를 같은 markup에서 함께 단언한다.

## 12. End-to-end 영향

### producer → consumer

```text
extension-sources(제목) ─▶ sourceSkills ─▶ composerSkills ─▶ SkillAutocomplete
                       └▶ CustomizeList · attachMenuModel(heading)
main SkillInfo.sourceLabel(접미 유지) ─▶ orderSkills 정렬 키 · catalogRows.author(상세)
```

- producer 기준: renderer 제목은 `extension-sources.ts`만 낸다. main의 `sourceLabel`은 정렬 키·상세 작성자 칸으로 남는다(비범위).
- consumer 파생 규칙: 플러그인 페이지 스킬 제목은 `extensionSourceLabels[sourceId]`, 순서는 `orderSkills`(Orca 우선 → main 라벨순).
- 파생 합성값 우회: 없음 — 제목 문자열 리터럴 0이 EP-05 목표.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `RightPanelTileId` 소비처 전부 | union 축소 — typecheck가 전수 드러냄 | AC1·AC2 |
| `useNativeResources` 소비처(Composer) | 반환 멤버 축소 — `view`·`ensure`만 사용 중 | AC3·AC14 |
| `extensionSourceLabels` 소비처(`CustomizeList`·`composerSkills`·`sourceSkills`) | 값 변경 | AC7~AC10 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 변화 없음.
- 취소/중단: 패널 새로고침·재시도 UI 소멸. Composer native 재연결 refresh 유지.
- 종료/crash: 해당 없음.
- retry/partial failure: `nativeResourceState`의 부분 실패 보존·stale 표시 유지(AC14).
- cleanup: `retire()`는 제어 정리(`operations.clear`·`epoch++`) 없이 view 폐기·재조회만 한다.
- **다중 저장소 쓰기**: 코드 해당 없음. 문서 사본 — `plan.md`(판정)·`INDEX.md` 보드 행 둘을 같은 커밋에서 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력·요청: 없음. OpenCode 상태 상세가 하던 catalog `mcp`/`plugins` part 조회가 사라져 요청이 줄 뿐이다.
- 부수 효과: OpenCode composer catalog의 `mcp`/`plugins` 슬롯은 더 이상 채워지지 않는다 — 소비자 0(EP-04 검색).

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음 — IPC 계약은 바꾸지 않는다(D-003). `IPC_CONTRACT.md:82`·`:84`는 소비자 서술만 정정한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 케밥이 상태 타일 진입을 제공 | `rendering.md:273` | §9 TO-BE | 변경 — D-001·D-002 |
| 플러그인 탭은 provider 뒤에 Claude·OpenCode 플러그인 그룹 | `rendering.md:231` | §11 CustomizeList | 변경(제목·Orca 제목) — D-006·D-007 |
| `/` 자동완성은 연속한 같은 출처를 한 섹션 | `skillGroups.ts:1-2`(0259 D-004) | §10 EP-06 | 변경 — 같은 출처 → 같은 제목. 순서·인덱스 규칙 유지 |
| OrcaLogo 높이 기준 크기 | `OrcaLogo.tsx:4-6`(0227) | §10 EP-08 | 유지 — 소비자를 계약에 맞춘다 |
| 0284 세션 토글 자기 쓰기 경합 수정 | `docs/handoff/0284-…/plan.md` | D-003 | 유지 — main 코드 불변, 화면 진입만 소멸 |
| renderer 4-layer | `app/src/renderer/AGENTS.md` | §9 | 유지 — `app/src/shared`만 공유 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 0284 AC2 실기 경로 소멸 | 사용자 보고. 실기가 필요하면 이 구현 전에 수행 |
| `nativeResourceState` 축소가 읽기 fence를 깨뜨림 | VP-05 유지 케이스 목록을 분모로 고정 |
| Composer 그룹 병합이 키보드 인덱스를 바꿈 | 순서 불변 — `skillGroups.test.ts:'화면 순서 = 인덱스 순서(0,1,2…)'` 유지 |
| 0272·0259·0263 사람 실기 대상 변화 | 그 handoff의 실기는 새 제목·로고 기준으로 본다 — INDEX 비고 없이 이 plan에 기록 |

- 되돌리기 어려운 결정: 없음(UI 제거·문자열).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/extension-sources.ts`
- `app/src/renderer/src/features/chat/{components/ChatTitleBar.tsx, store/chatStore.ts, hooks/useNativeResources.ts, lib/{nativeResourceState,rightPanelTiles,rightPanelLayout,attachMenuModel,skillGroups}.ts}`
- `app/src/renderer/src/features/chat/harnesses/{claude/rightPanel.ts, claude/rightpanel/tileRegistry.ts, opencode/rightPanel.ts, opencode/rightpanel/{tileRegistry,navigation}.ts, common/rightpanel/RightPanelTile.tsx, opencode/composer/{useComposerCatalog,composerCatalogState}.ts, registries/composer.ts, common/composer/ComposerInputController.tsx}`
- 삭제: `components/rightpanel/NativeResourcesTile.tsx`, `harnesses/opencode/rightpanel/{NativeResources.tsx,preparedResourcesView.ts}`, `lib/nativeResourcesMenu.ts` + 각 테스트
- `app/src/renderer/src/features/skills/{lib/catalogOrder.ts, components/customize/{CustomizeList,SourceHeading,McpDetail}.tsx}`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- 테스트: §7 주의사항 목록 + `rightPanelLayout.test.ts`·`rightPanelTiles{,.harness}.test.ts`·`chatReducer.panelPolicy.test.ts`·`CustomizeList.render.test.ts`·`mcpDetail.render.test.ts`·`catalogOrder.test.ts`·`attachMenuModel.test.ts`·`skillGroups.test.ts`·`attachMenu.{render,flow}.test.ts`·`attachMenuSelect.test.ts`·`Composer.native-menu.test.ts`
- `docs/arch/frontend/{rendering,design-components,state}.md`, `docs/arch/backend/adapters.md`, `docs/IPC_CONTRACT.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`, `app/src/renderer/AGENTS.md`.
- ABI/네트워크: renderer 순수 테스트만 — ABI 무관.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/renderer/src/features/chat src/renderer/src/features/skills src/preload`.
- 문서: `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기: AC16.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — D-001~D-012, 질의 4건 답 반영.
- [x] Part I만 읽어도 완료 상태가 이해된다.
- [x] 조건절·이유절·제거/유지 요구를 재해석하지 않았다 — "제거"는 이동 아님(D-002), "~/.agents/skills 유지"(D-007).
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §3 갱신 메모 대조.
- [x] AS-IS와 TO-BE가 같은 축으로 있다.
- [x] Delta의 각 변경이 §11 파일 또는 AC에 추적된다.
- [x] 사라진 책임: 상태 패널 = 삭제, 세션 제어 = renderer 삭제·IPC 유지(D-003).
- [x] 수치·전칭·앵커·기존 테스트 인용을 이번 세션에 실측했다(§8).
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다.
- [x] Baseline V.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair가 있다.
- [x] INHERITED node 없음.
- [x] 각 pair의 경로·§10 분모·자리별 좌표, 적대 증거는 구조 proxy·0건 스윕·형제 맞바꿈·key 교체 pair만.
- [x] 운영 gate가 열거됐고 기존 실패를 blocking으로 만들지 않는다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — AC16은 픽셀만.
- [x] AC11 구조 proxy는 VP-13 변이로 방향을 확인하고 AC16 실기와 짝이다.
- [x] 신규 계약(`harnessSourceTitle`)의 SSOT·강제 지점·테스트 seam이 있다.
- [x] 등록 변경 소비처 전수(§12).
- [x] producer/consumer 양쪽(§12).
- [x] 상한·총량: 요청 감소만(§14).
- [x] 게이트 명령이 `app/AGENTS.md`와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 §3에 적었다.
- [x] 산출물 문장 규칙.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | … | … | … | … | … |

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(최초 라운드)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: 해당 없음(최초 라운드)

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님) | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
