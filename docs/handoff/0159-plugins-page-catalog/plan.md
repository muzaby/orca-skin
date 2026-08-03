# Plan — 0159-plugins-page-catalog

## 메타

| 항목 | 값 |
|---|---|
| slug | `0159-plugins-page-catalog` |
| 작성자 | Claude Code |
| 일자 | 2026-08-03 |
| 매핑 | PHASES 신규 행 (Phase 4) / PR 미정 |
| 상태 | DRAFT → **READY** |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "skills&mcp 페이지를 플러그인 페이지로 변경하라." | 라이브 세션 요청 (`/handoff-plan` 인자) |
| 명시 요구 ② | "하위의 페이지 구성을 다음 브랜치를 참고하여 변경하라. `agent/extensions-library-modal`" | 라이브 세션 요청 (`/handoff-plan` 인자) |
| 명시 결정 ③ | **라우트 페이지를 유지**한다 (참조 브랜치의 모달 전환은 채택하지 않는다). | 세션 중 `AskUserQuestion` 응답 — "라우트 페이지 유지" |
| 명시 결정 ④ | 탭 3종은 **용어 정합** 안으로 간다 — 스킬 / MCP / **플러그인**, 플러그인 탭은 참조 브랜치의 "내장 스킬" 이 아니라 **실제 플러그인**(0157/0158 의 `orca:plugin:list` 계열)을 노출한다. | 세션 중 `AskUserQuestion` 응답 — "용어 정합 — 스킬 / MCP / 플러그인" |
| 명시 결정 ⑤ | 라우트를 **`/plugins` 로 개명**하고 `/skills` 는 리다이렉트로 보존한다. i18n 키도 함께 개명한다. | 세션 중 `AskUserQuestion` 응답 — "`/plugins` 로 개명 + `/skills` 리다이렉트" |
| 추론 의도 | "참고하여"(②) = *복제* 가 아니라 **하위 구성(3탭 레일 + 목록→상세 1-depth 드릴인 + 테이블 목록)의 채택**. 결정 ③~⑤ 가 컨테이너·어휘·식별자를 명시적으로 갈랐으므로, 참조 브랜치에서 가져오는 것은 **레이아웃 구성뿐**이다. (추론) | 요구 ② 의 "참고" + 결정 ③④⑤ 의 조합 |

## Context (왜)

현행 `/skills` 화면(`SkillsCustomizeView`)은 **레일(depth1) → 목록(depth2) → 상세(depth3) 3-pane** 이고,
탭이 선택되기 전에는 랜딩 카드 2장을 보여준다(`CustomizeLanding.tsx:44-70`). 탭은 `skills | mcp` 2종이다
(`CustomizeRail.tsx:4`).

그 사이 0157(auth plugin platform)·0158(builtin tool plugin host)이 **`plugin` IPC 도메인 3채널**을 신설했고
(`docs/IPC_CONTRACT.md:5,407-409`), `PluginConnectorInfo` 는 preload 까지 노출돼 있지만
(`app/src/preload/index.ts:282-288`) **renderer 소비자가 0건**이다 — 즉 Orca 에는 "플러그인" 이라는 1급 개념이
생겼는데 그것을 보여주는 화면이 없다.

이번 작업은 그 화면을 만드는 것이다: `/skills` → **`/plugins`(플러그인) 페이지**로 개명하고, 하위 구성을
`agent/extensions-library-modal`(커밋 `e22d43b`)의 **3탭 레일 + 테이블 목록 → 상세 1-depth** 구조로 재구성하되,
탭 어휘와 데이터 출처는 0157/0158 에 정합시킨다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당** — 다만 증상 서술이 하나 부족했다. "페이지 이름 변경" 은 표면이고, 실제 결손은 **`orca:plugin:list` 를 소비하는 renderer 코드가 0건**이라는 것이다. 요구대로 하면 이 결손이 함께 닫힌다. | `grep -rn "pluginList\|PluginConnectorInfo" app/src/renderer app/src/preload` = preload 2건뿐, renderer 0건 |
| 이미 있는 것 아닌가 (기존 코드로 충족되나) | **아니오.** 현행 레일은 2탭(`skills`·`mcp`)이고 플러그인 탭·플러그인 데이터 경로가 없다. 참조 브랜치의 `isBuiltin`(내장 스킬 = 플러그인) 도 main 에 없다. | `CustomizeRail.tsx:4` · `app/src/shared/ipc.ts:1165-1180`(`SkillInfo` 에 `isBuiltin` 없음) |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **부분적으로 예 → 채택.** feature 디렉토리 개명(`features/skills` → `features/extensions`)은 하지 **않는다** — 배럴 소비자가 `pages/` 1곳뿐이라 언제 해도 비용이 같고, 요구가 부르지 않은 churn 이다. 반면 컴포넌트 재구성은 3-pane → 2-pane 이라 구조 변경이 불가피하다(테이블 목록이 중앙 pane 을 전폭으로 요구). | `grep -rn "SkillsCustomizeView" app/src` = 배럴 1 + 페이지 1 |
| 인용 자료가 요구를 부풀리지 않았나 | **부풀림 발견 — 정정함.** 참조 브랜치 `e22d43b`(2026-07-30)는 **0156 기반이라 0157/0158 이전**이다. 그 브랜치의 "커넥터" = MCP 서버, "플러그인" = `.orca-builtin.json` 마킹된 내장 **스킬**인데, 현재 main 에서 **Connector = 인증된 내장 도구 contribution**, **Plugin = provider·connector 를 담는 빌드타임 패키지**로 확정돼 있다. 그대로 옮기면 채택된 용어를 UI 에서 뒤집는다. → 사용자 결정 ④ 로 정합안 채택. | `git log --oneline origin/agent/extensions-library-modal` · `docs/GLOSSARY.md:30` · `app/src/main/features/connectors/registry.ts:1-13` |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다** (§기존 결정·규칙과의 관계 참조). 오히려 참조 브랜치가 뒤집던 것(GLOSSARY §Connector)을 결정 ④ 가 되돌린다. 단 `/skills` 라우트·i18n 키 개명은 0083/0096 의 nav 결정을 **개명 수준에서 갱신**한다. | `docs/arch/frontend/overview.md:71` · `docs/GLOSSARY.md:30` |

- **사용자에게 올릴 것(단독 결정 불가)**: 컨테이너·탭 어휘·식별자 3건은 **세션 중 이미 질의·확정**(결정 ③④⑤). 추가 미결은 아래 §리스크 Open Question 1건.

> **이견(요구는 그대로 진행)** — 결정 ④ 를 확정한 *뒤에* 발견한 사실이 하나 있다:
> `AUTH_PLUGIN_PACKAGES` 는 신규 설치에서 **빈 배열**이다(`app/src/main/features/auth-platform/modules/index.ts:29`).
> 즉 기본 빌드에서 **플러그인 탭은 항상 0건**이다. `_example` 패키지조차 `connectors: []` 이고
> 배럴에 등록되지 않는다(`modules/_example/index.ts:1-2,45`).
> 그래도 요구대로 진행한다 — 0157/0158 이 정의한 "플러그인" 을 그 정의대로 보여주는 것이 맞고,
> 빈 상태는 폐쇄망 배포가 모듈을 등록하면 그대로 채워진다. 대신 **빈 상태를 1급 설계 산출물로 다루고**
> (AC8), 비어 있지 않은 경우의 렌더링은 순수 함수 단위 테스트로 고정한다(AC7).
> 사용자가 원하면 참조 브랜치의 "내장 스킬을 플러그인으로" 절충안으로 전환 가능하나, 그 경우 GLOSSARY §Connector/Plugin
> 어휘를 UI 에서 뒤집는 비용을 감수해야 한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 참조 브랜치 `origin/agent/extensions-library-modal` 은 단일 커밋 `e22d43b`("스킬 카탈로그를 3탭 모달로 재구성"), main 대비 24파일 변경. 기반은 0156(`0ddf31e`) — **0157/0158 이전**. | `git log --oneline origin/agent/extensions-library-modal` · `git diff --stat main...origin/agent/extensions-library-modal` |
| 참조 브랜치의 구조: 좌측 레일(3탭) + 우측 `header(제목/뒤로가기/추가/닫기)` + **테이블 목록 ↔ 상세 1-depth 토글**(`data-state="detail|list"`). 목록은 `<table>` 3열, 행은 `role="button" tabIndex=0` + Enter/Space 활성화. | `git show e22d43b:.../SkillsCustomizeView.tsx` · `.../CustomizeList.tsx:12-16,60-70` |
| 참조 브랜치의 플러그인 탭 = `SkillInfo.isBuiltin`(신설) 기준 분리. main 의 `SkillInfo` 에는 `isBuiltin` 이 **없다**. | `git show e22d43b:.../lib/catalog.ts` · `app/src/shared/ipc.ts:1165-1180` |
| 참조 브랜치의 플러그인 탭에는 **추가 버튼이 없다**(`!detailOpen && tab !== 'plugins'`) — 읽기 전용 목록. | `git show e22d43b:.../SkillsCustomizeView.tsx` (헤더 액션 블록) |
| main 의 `plugin` IPC 도메인 3채널: `orca:plugin:list`(→`PluginConnectorInfo[]`) · `connectionConnect` · `connectionDisconnect`. 총 82채널·23도메인. | `docs/IPC_CONTRACT.md:5,28,407-409` · `app/src/shared/ipc.ts:108-110` |
| `PluginConnectorInfo = { connectorId, label, origin, pluginId, acceptedAuthProviders[], connected }`. credential·binding·artifact 는 이 경계를 넘지 않는다. | `app/src/shared/ipc.ts:284-293` |
| `AuthProviderInfo = { id, pluginId, apiVersion, label, targets[], mechanisms[], capabilities[], sessionGroup? }` — **`pluginId` 보유**. 따라서 provider + connector 의 `pluginId` 합집합이 "설치된 플러그인" 의 완전한 목록이다. | `app/src/shared/ipc.ts:238-247` |
| preload 는 `window.orca.plugins.{list,connect,disconnect}` 를 노출하지만 renderer facade(`shared/api/ipc.ts`)에는 `pluginApi` 가 **없다** — renderer 소비자 0건. | `app/src/preload/index.ts:282-288` · `app/src/renderer/src/shared/api/ipc.ts:203-232` |
| `AUTH_PLUGIN_PACKAGES = []` (신규 설치 기본값). `_example` 은 배럴 미등록 + `contributes.connectors: []`. → 기본 빌드에서 provider·connector 모두 0건. | `app/src/main/features/auth-platform/modules/index.ts:29` · `modules/_example/index.ts:1-2,45` |
| GLOSSARY 확정 어휘: **Connector** = 인증된 요청으로 외부 서비스 기능을 제공하는 contribution(= "인증이 필요한 내장 도구"). MCP 서버와 별개 개념. | `docs/GLOSSARY.md:30` |
| `connectors/registry.ts` 헤더 주석이 connector/connection 수명 분리와 "connector 당 활성 연결 1개" 를 채택 결정으로 못 박고 있다(0158 r4 사용자 결정). | `app/src/main/features/connectors/registry.ts:1-15` |
| renderer 테스트 환경: `vitest.config.ts` 의 `include` 가 **`src/**/*.test.ts` 만** — `.tsx` 미포함, `environment: 'node'`, testing-library 미도입. **React 컴포넌트는 이 저장소에서 기계 검증 불가**. | `app/vitest.config.ts:1-10` · `find app/src/renderer -name '*.test.ts*'` = **39건, 전부 `.ts`**(lib/store/reducer/shared) |
| 저장소 규칙이 이를 명문화: "테스트 동반 … **UI 는 시각 검증으로 갈음**". | `app/AGENTS.md:168` |
| renderer 4-layer 경계는 lint error 로 강제: `features` → `shared` + 동일 feature 만. cross-feature 는 `pages/`·`app/` 에서 props 로. | `app/eslint.config.mjs:81-96` · `app/AGENTS.md:26-31` |
| i18n 위생 테스트: ko↔en 리프 키 집합 일치 · 빈 문자열 금지 · `{{placeholder}}` 일치. **미사용 키 검출은 없다**(대신 `MessageKey` union 이 typecheck 로 참조를 강제). | `app/src/renderer/src/shared/i18n/resources/resources.test.ts:29-51` |
| `ROUTES` 카탈로그(`shared/navigation/routes.ts:17-29`)는 순수 `.ts` const — `AppLayout.tsx:59-62` 가 `matchPath` 로 헤더 라벨/breadcrumb 을 결정한다. | `app/src/renderer/src/shared/navigation/routes.ts` · `app/src/renderer/src/app/AppLayout.tsx:2-3,59-62` |
| Sidebar 의 `NAV` 4항목은 `Sidebar.tsx:12-36` 의 파일 내 const — 현재 `.tsx` 안이라 단위 테스트 불가. | `app/src/renderer/src/app/Sidebar.tsx:12-36` |
| 재사용 가능한 shared 자산: `Button`(forwardRef + `leadingIcon`) · `Icon`(`layers`·`link`·`doc`·`cpu`·`plus`·`chevR`·`arrowL`·`x` 전부 존재) · `formatDateMedium` · `common.{add,close,unknown,loading}` 키. | `shared/ui/Button.tsx:82,91,122` · `shared/ui/Icon.tsx:3-43` · `shared/i18n/datetime.ts:100` · `resources/ko.ts` §common |
| `AddMcpServerModal.tsx` 는 **importer 0건**(주석 언급 2건뿐) — 이미 죽은 파일. | `grep -rn "AddMcpServerModal" app/src` |
| 문서 중 `/skills` **라우트 토큰**(백틱 인용 또는 작은따옴표 인용)을 쓰는 곳(핸드오프·PHASES 이력 제외) = **5줄 / 4파일**(`IPC_CONTRACT.md:228` · `terms.md:69` · `overview.md:71,75` · `layers.md:33`). 라벨("Skills & MCP")만 인용하는 곳을 더하면 **6파일**. | 이번 세션 실행: `rg` 로 route 토큰 검색 = 5줄 · 추가로 `dom-architecture.md:45` · `ux-domains.md:96,102,108` · `layers.md:65` |

## 인수 기준 (Acceptance Criteria)

> 신규 파일은 전부 `app/src/renderer/src/` 하위. 테스트 경로는 `app/` 기준 상대.

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `ROUTES` 카탈로그에 `/plugins` 패턴이 있고, 그 `labelKey`·`breadcrumbKey` 가 ko·en 두 카탈로그에서 **비어 있지 않은 문자열**로 해석된다. | `src/renderer/src/shared/navigation/routes.test.ts::"'/plugins' 패턴이 ROUTES 에 있다"` + `::"ROUTES 의 모든 labelKey·breadcrumbKey 가 ko·en 에서 해석된다"` | `app/AppLayout.tsx:59-62` `matchPath(ROUTES)` → 헤더 라벨/breadcrumb |
| 2 | `LEGACY_ROUTE_REDIRECTS` 가 `'/skills' → '/plugins'` 를 담고, 각 키가 `ROUTES` 에 없고 각 값이 `ROUTES` 에 있다. | `routes.test.ts::"레거시 리다이렉트는 구 경로→현 경로만 담는다"` | `app/router.tsx` 가 이 맵을 순회해 `<Route path=key element={<Navigate to=value replace/>}>` 렌더 → 브라우저 `/skills` 진입 |
| 3 | Sidebar 4번째 nav 항목이 `path: '/plugins'` 이고 `isActive('/plugins')` 가 `true`, `isActive('/skills')` 가 `false` 이며, 그 `labelKey` 가 ko·en 에서 해석된다. | `src/renderer/src/app/navItems.test.ts::"플러그인 nav 항목은 /plugins 로 이동하고 그 경로에서 활성이다"` | `app/Sidebar.tsx` 가 `SIDEBAR_NAV` 를 map → `navigate(it.path)` |
| 4 | `CATALOG_TABS` 가 `skills`·`mcp`·`plugins` 3개를 이 순서로 담고, 각 `labelKey` 가 ko·en 에서 해석된다. | `src/renderer/src/features/skills/lib/catalogSelection.test.ts::"탭은 스킬·MCP·플러그인 3개이고 라벨이 해석된다"` | `pages/PluginsPage.tsx` → `ExtensionsCatalogView` → `CustomizeRail` 이 `CATALOG_TABS` 를 map |
| 5 | `selectTab(state, next)` 는 탭을 바꾸면서 `selectedId` 를 `null` 로 만든다(= 목록 depth 로 복귀). | `catalogSelection.test.ts::"탭을 바꾸면 선택이 해제된다"` | `ExtensionsCatalogView` 의 레일 `onSelect` 핸들러 |
| 6 | `openDetail(state, id)` 후 `back(state)` 가 `selectedId: null` 을 돌려주고 `tab` 은 유지된다. | `catalogSelection.test.ts::"상세를 열었다 뒤로가면 같은 탭의 목록으로 돌아온다"` | 상세 헤더의 뒤로가기 버튼 `onClick` |
| 7 | `buildPluginRows(providers, connectors)` 가 두 입력의 `pluginId` **합집합**을 `pluginId` 오름차순 1행씩 돌려주고, 각 행이 `providerCount`·`connectorCount`·`connectedCount` 를 정확히 집계한다(provider 만 있는 플러그인·connector 만 있는 플러그인 포함). | `src/renderer/src/features/skills/lib/pluginCatalog.test.ts::"provider·connector 의 pluginId 합집합을 정렬해 집계한다"` | `ExtensionsCatalogView` → `usePluginCatalog` → `authApi.providers()` + `pluginApi.list()` |
| 8 | `buildPluginRows([], [])` 가 빈 배열을 돌려주고, 플러그인 탭은 그때 `skills.table.noPlugins` 문구를 렌더한다. | 전반부 `pluginCatalog.test.ts::"입력이 비면 행이 없다"` / 후반부 **사람 실기** — `cd app && npm run dev` → 사이드바 '플러그인' → 플러그인 탭에서 빈 상태 문구 확인(기본 빌드는 `AUTH_PLUGIN_PACKAGES=[]` 라 항상 이 경로) | `pages/PluginsPage.tsx` → `CustomizeList` 의 `PluginTable` 빈 분기 |
| 9 | `skillRowMeta(skill)` 가 `updatedAt` **미지정** 항목에 `updatedAtMs: null` 을 돌려주고, 지정 항목에는 그 값을 그대로 돌려준다. | `src/renderer/src/features/skills/lib/catalogRows.test.ts::"updatedAt 미지정 스킬은 updatedAtMs 가 null 이다"` + `::"updatedAt 지정 스킬은 값을 보존한다"` | `CustomizeList` 의 `SkillTable` 이 `updatedAtMs === null` 이면 `common.unknown`, 아니면 `formatDateMedium` |
| 10 | `mcpRowMeta(server)` 가 `enabled` 에 따라 `statusKey` 를 `skills.mcpDetail.active` / `skills.mcpDetail.inactive` 로 가르고, `transport` 를 그대로 실어 준다. | `catalogRows.test.ts::"MCP 행 메타는 enabled 로 상태 키를 가른다"` | `CustomizeList` 의 `McpTable` |
| 11 | `pluginApi.list()` 호출이 `window.orca.plugins.list()` 로 위임된다 — 플러그인 탭 진입 시 `orca:plugin:list` 가 **실제로 호출되어** 목록(기본 빌드에서는 0건)이 렌더되고 콘솔/로그에 오류가 남지 않는다. | **사람 실기** — `cd app && npm run dev` → '플러그인' nav → 플러그인 탭 진입 → DevTools 콘솔에 예외 0건 + 빈 상태 렌더 확인 | `pages/PluginsPage.tsx` → `usePluginCatalog` → `shared/api/ipc.ts` `pluginApi.list` → `window.orca.plugins.list` → `orca:plugin:list` |
| 12 | 삭제되는 i18n 키(`nav.skills`·`nav.skillsBreadcrumb`·`sidebar.nav.skills`·`skills.listTitle`·`skills.landing.*` 6키·`skills.list.{groupOrca,groupClaude,off,activeMcp,inactiveMcp}`)를 참조하는 코드가 0이 되어 **`npm run typecheck` 3분할이 전부 통과**한다. | `cd app && npm run typecheck` (`MessageKey` union 이 참조를 컴파일 시점에 강제 — `resources/ko.ts` 가 SSOT) | `tr()` 호출부 전수 |
| 13 | `docs/` 에서 **`/skills` 라우트 토큰**(백틱 인용 또는 작은따옴표 인용) 검색이 **0건**이다 — 제외 대상은 `docs/handoff/**`·`docs/PHASES.md`·`docs/arch/frontend/overview.md` 세 이력 경로뿐. 그리고 `overview.md` 의 두 이력 행(71·75)에는 `/plugins` 개명을 알리는 `0159` 문자열이 포함된다. | verify 턴에서 아래 명령 재실행 (기계) — 아래 `### AC13 검증 명령` 블록 | 문서 자체 |
| 14 | 게이트가 전부 통과한다: `cd app && npm run lint`(boundaries 위반 0 error) · `npm run typecheck` · `npm test`. 신규 테스트 4파일이 통과에 포함된다. | `cd app && npm run lint && npm run typecheck && npm test` | — |

### AC13 검증 명령

```sh
# 라우트 토큰(백틱/작은따옴표 인용) 잔존 = 0줄이어야 한다
rg -n -e "'/skills'" -e '`/skills`' docs \
  -g '!docs/handoff/**' -g '!docs/PHASES.md' -g '!docs/arch/frontend/overview.md'

# overview.md 두 이력 행에 개명 각주가 있어야 한다 (2줄 이상)
rg -n '0159' docs/arch/frontend/overview.md
```

> AC1~7·9·10 은 순수 `.ts` 단위 테스트, AC12~14 는 게이트 명령, AC8 후반부·AC11 만 사람 실기다.
> **두 사람-실기 항목의 실행 경로(`npm run dev` → 사이드바 → 탭)는 이 문서의 비범위 절 어디에도 막혀 있지 않다.**

## 범위 / 비범위

- **범위**
  1. 라우트·nav·i18n 개명: `/skills` → `/plugins`(레거시 리다이렉트 보존), `nav.skills*`/`sidebar.nav.skills` → `nav.plugins*`/`sidebar.nav.plugins`, 페이지 라벨 "플러그인".
  2. 하위 구성 재구성(참조 브랜치 구조 채택): 좌측 3탭 레일 + 우측 `header(제목 · 목록에서만 추가 버튼) + 본문(테이블 목록 ↔ 상세 1-depth)`. 랜딩(`CustomizeLanding`) 폐기 — 기본 탭 = 스킬.
  3. 탭 3종: **스킬**(기존 `useCustomizeSkills`) · **MCP**(기존 `useMcpServers`) · **플러그인**(신규 `usePluginCatalog` — `authApi.providers()` + `pluginApi.list()`).
  4. renderer facade 에 `pluginApi.list` 추가 + `features/skills` 에 순수 `lib/` 3모듈(선택 상태 · 행 메타 · 플러그인 집계) 신설 및 단위 테스트.
  5. Sidebar `NAV` 를 `app/navItems.ts` 로 추출(동작 무변경) — nav 라우팅을 기계 검증 가능하게 만드는 seam.
  6. 프론트엔드 아키텍처 문서 6건 + `IPC_CONTRACT.md` §MCP 호출자 문구 정합.

- **비범위**
  - 플러그인 **연결/해제**(`orca:plugin:connectionConnect` · `connectionDisconnect`) UI. 플러그인 탭은 **읽기 전용**(참조 브랜치의 플러그인 탭과 동일한 형상).
  - `SkillInfo.isBuiltin` + `scan.ts` 마커 판독 이식 — 결정 ④ 로 불필요해졌다(플러그인 탭이 내장 스킬을 쓰지 않는다).
  - 참조 브랜치의 **모달 전환**(`extensionsModalStore`·`Modal` 래핑·`AppLayout` 마운트) — 결정 ③ 으로 배제.
  - `features/skills` 디렉토리 개명, 죽은 파일 `AddMcpServerModal.tsx`(importer 0건) 제거.
  - main 프로세스 변경 일체. IPC 채널 신설·변경 0(82채널 유지).

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 플러그인 연결/해제 UI | **아니오** — 이미 확정·배포된 IPC 채널 2개 위에 UI 만 얹는 순수 가산 작업이고, 새 이름·스키마·저장 포맷을 만들지 않는다. 지금 넣으면 기본 빌드(등록 플러그인 0)에서 **실행도 검증도 불가능한 AC** 가 생긴다. |
| `features/skills` → `features/extensions` 디렉토리 개명 | **아니오** — 디렉토리명은 공개 계약이 아니고 배럴 소비자가 `pages/` 1곳뿐이라, 지금 하든 나중에 하든 변경 표면이 같다. |
| `AddMcpServerModal.tsx` 삭제 | **아니오** — importer 0건이라 언제 지워도 파급이 없다. 다만 MCP 편집 UI 의도가 남아 있을 수 있어 별건으로 둔다. |
| `SkillInfo.isBuiltin` | **아니오** — 이 설계는 그 필드에 의존하지 않는다. 훗날 내장 스킬 구분이 필요해지면 그때 IPC 필드를 추가하면 되고, 지금 넣으면 소비자 없는 계약 필드가 된다. |

> **일방향이라 지금 확정한 것**: 라우트 경로 `/plugins`, i18n 키 `nav.plugins`/`sidebar.nav.plugins`, 탭 식별자
> `skills|mcp|plugins`, 페이지 라벨 "플러그인". 넷 다 세션 중 사용자에게 물어 확정했다(결정 ③④⑤).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `useCustomizeSkills`·`useMcpServers`(hooks) · `SkillDetail`·`McpDetail`·`SkillAddMenu`·`SkillAuthorModal`·`SkillUploadModal`·`CustomMcpModal`(컴포넌트) · `shared/ui/{Button,Icon}` · `shared/i18n/{useI18n,formatDateMedium}` · `shared/api/ipc.ts` 의 `authApi`.
- 전제 ①: `orca:plugin:list` 와 `orca:auth:providers` 는 **인증 게이트 통과 여부와 무관하게** invoke 가능하다 — `AuthTarget` 주석이 "application 은 UX 게이트이지 보안 경계가 아니다 — 인증 전에도 main IPC 는 열려 있다" 라고 명시한다(`docs/GLOSSARY.md:31`).
- 전제 ②: 기본 빌드에서 두 채널 모두 **빈 배열**을 돌려준다(`AUTH_PLUGIN_PACKAGES = []`). 설계는 이를 정상 경로로 다룬다.
- **신규 의존성: 없음.** 신규 npm 패키지·신규 IPC 채널·신규 마이그레이션 0.

## 설계

### 접근

참조 브랜치의 **레이아웃**(3탭 레일 + 목록↔상세 1-depth + 테이블)만 가져오고, **컨테이너**(라우트 페이지)와
**데이터 출처**(0157/0158 의 플러그인)는 결정 ③④ 를 따른다. 컴포넌트가 기계 검증 불가한 환경이므로
(`vitest.config.ts` include = `.ts` 만), **판정 로직을 전부 순수 `lib/` 로 내리고** `.tsx` 에는 배치만 남긴다.

### 레이어 배치

| 신규/이동 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `shared/navigation/routes.ts` (수정) — `/plugins` 행 + `LEGACY_ROUTE_REDIRECTS` | 경로 카탈로그 + 레거시 매핑 SSOT | `shared` | 순수 단위 — `routes.test.ts`(신규). ko/en 카탈로그를 import 해 키 해석까지 확인(shared→shared 허용) |
| `app/navItems.ts` (신규 — `Sidebar.tsx:12-36` 에서 추출) | Sidebar nav 4항목 descriptor(`icon`·`labelKey`·`path`·`isActive`) | `app` | 순수 단위 — `app/navItems.test.ts`(신규). `app`→`shared` import 만 사용 |
| `features/skills/lib/catalogSelection.ts` (신규) | `CatalogTab` union · `CATALOG_TABS` descriptor · 선택 상태 전이(`selectTab`/`openDetail`/`back`) | `features/skills` | 순수 단위 — `catalogSelection.test.ts` |
| `features/skills/lib/catalogRows.ts` (신규) | 테이블 행 메타 순수 변환(`skillRowMeta`·`mcpRowMeta`) — 날짜/상태/작성자 **판정만**, 포맷은 뷰가 | `features/skills` | 순수 단위 — `catalogRows.test.ts` |
| `features/skills/lib/pluginCatalog.ts` (신규) | `buildPluginRows(providers, connectors)` — `pluginId` 합집합 + 집계, `buildPluginDetail(pluginId, …)` | `features/skills` | 순수 단위 — `pluginCatalog.test.ts` |
| `features/skills/hooks/usePluginCatalog.ts` (신규) | `authApi.providers()` + `pluginApi.list()` 동시 로드 → `{rows, loading}`. **집계 로직은 `lib/pluginCatalog` 에 위임**(훅은 배선만) | `features/skills` | 훅 자체는 미테스트(전제: 판정 0). 떼어낸 순수부 = `lib/pluginCatalog` |
| `features/skills/components/customize/PluginDetail.tsx` (신규) | 플러그인 1건 상세 — provider/connector 목록, connector 의 `origin`·`connected` 표시 | `features/skills` | 시각 검증(사람) — 판정 로직은 `lib/pluginCatalog` 에 없음 |
| `features/skills/components/customize/ExtensionsCatalogView.tsx` (`SkillsCustomizeView.tsx` 개명) | 3탭 셸 조립 — 레일 + 헤더 + 목록/상세 스위치 | `features/skills` | 시각 검증(사람) |
| `pages/PluginsPage.tsx` (`SkillsPage.tsx` 개명) | `ExtensionsCatalogView` 배치만 | `pages` | 시각 검증(사람) |
| `shared/api/ipc.ts` (수정) — `pluginApi = { list }` | preload 위임 facade | `shared` | 위임뿐(판정 0) — AC11 사람 실기 |

- **cross-feature 없음**: 플러그인 데이터는 `features/auth` 가 아니라 `shared/api/ipc.ts` 의 `authApi`·`pluginApi` 에서
  온다(`features` → `shared` 는 허용, `features` ↔ `features` 는 lint error). `eslint.config.mjs:81-96` 준수.
- **`data-context`**: 현행 `customize` → `extensions-catalog` 로 바꾸고 목록/상세를 `data-state="list|detail"` 로 표기
  (참조 브랜치 관례 승계, `dom-architecture.md` 마커 체계와 정합).

### 컴포넌트 구성 (재구성 후)

```
pages/PluginsPage.tsx
└ features/skills/components/customize/ExtensionsCatalogView.tsx     ← 셸 (탭/선택 상태 = useState<CatalogSelection>)
  ├ CustomizeRail.tsx           3탭 (CATALOG_TABS 를 map)
  ├ (header)                    제목 | 목록일 때만 [추가] (스킬·MCP 탭만) / 상세일 때 [← 제목]
  ├ CustomizeList.tsx           SkillTable · McpTable · PluginTable (3열 테이블, 행 role=button+Enter/Space)
  ├ SkillDetail.tsx  (기존)     스킬 상세 — 토글/채팅에서 사용/폴더 열기/제거
  ├ McpDetail.tsx    (기존)     MCP 상세 — 활성 토글
  └ PluginDetail.tsx (신규)     플러그인 상세 — provider·connector 목록 (읽기 전용)
  + SkillAddMenu / SkillAuthorModal / SkillUploadModal / CustomMcpModal (기존, 그대로)
삭제: CustomizeLanding.tsx
```

### i18n 변경

- 신규: `nav.plugins`·`nav.pluginsBreadcrumb`·`sidebar.nav.plugins` · `skills.rail.plugins` · `skills.pageTitle` ·
  `skills.view.backAria`(`{{section}}`) · `skills.table.{skill,mcp,plugin,lastUpdated,author,status,transport,user,providers,connectors,connected,noSkills,noMcp,noPlugins}` ·
  `skills.pluginDetail.{providers,connectors,origin,connectedLabel,disconnectedLabel}`.
- 개명/삭제: `nav.skills`·`nav.skillsBreadcrumb`·`sidebar.nav.skills` 삭제(위 신규로 대체), `skills.listTitle` 삭제,
  `skills.landing.*` 6키 삭제, `skills.list.{groupOrca,groupClaude,off,activeMcp,inactiveMcp}` 삭제
  (`skills.list.addAria` 는 헤더 추가 버튼 aria 로 유지).
- `skills.rail.mcp` 는 **유지**한다(탭 라벨 "MCP"). 참조 브랜치의 `skills.rail.connectors` 는 채택하지 않는다 — 결정 ④.
- ko/en 동시 갱신(en 은 `typeof ko` 로 컴파일 강제 + `resources.test.ts` 3중 위생).

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **Connector = 인증된 내장 도구 contribution** (MCP 서버와 별개 개념) | `docs/GLOSSARY.md:30` · `app/src/main/features/connectors/registry.ts:1-15` | §i18n 변경 의 "`skills.rail.connectors` 는 채택하지 않는다"; §범위 3 의 "탭 3종: 스킬 · MCP · 플러그인" | **유지** — 참조 브랜치가 뒤집던 것을 되돌린다. MCP 탭은 "MCP" 로 남고, connector 어휘는 플러그인 상세 안에서만 원 의미로 쓰인다. |
| **connector 당 활성 연결 1개 · 정적 descriptor** (0158 r4 사용자 결정) | `app/src/main/features/connectors/registry.ts:8-11` | §범위 3 의 "플러그인 탭 … 읽기 전용"; §설계 `PluginDetail` 의 "`connected` 표시" | **유지** — 연결 상태를 *읽기만* 한다. 연결 생성·해제는 비범위라 이 규칙에 손대지 않는다. |
| **renderer 4-layer 경계** (`features` → `shared` + 동일 feature) | `app/eslint.config.mjs:81-96` · `app/AGENTS.md:26-31` | §설계 "cross-feature 없음" 문단 | **유지** — 신규 훅이 `features/auth` 를 부르지 않고 `shared/api/ipc.ts` 를 부른다. |
| **UI 는 시각 검증으로 갈음, 순수 변환기는 테스트 동반** | `app/AGENTS.md:168` | §설계 "판정 로직을 전부 순수 `lib/` 로 내리고 `.tsx` 에는 배치만" | **유지 + 강화** — 판정을 `.ts` 로 내려 AC 14개 중 12개를 기계 검증으로 만든다. |
| **i18n 라벨은 키만 상수로 두고 렌더에서 `tr()` 해석**(0096) | `app/src/renderer/src/app/Sidebar.tsx:8-10` · `CustomizeRail.tsx:6` | §설계 `app/navItems.ts` 의 "`labelKey`", `CATALOG_TABS` descriptor | **유지** — 추출한 `SIDEBAR_NAV`·`CATALOG_TABS` 도 키만 담는다. |
| **nav 4-항목 구성**(새 대화·프로젝트·엔진 & 모델·Skills & MCP, 0083) | `docs/arch/frontend/overview.md:71` · `dom-architecture.md:45` | §범위 1 의 "페이지 라벨 '플러그인'"; §범위 5 의 `app/navItems.ts` 추출 | **개명 갱신** — 4항목 구성과 순서는 그대로, 4번째의 라벨·경로만 '플러그인'/`/plugins`. 문서 2건 동시 갱신(AC13). |
| **`/skills` 라우트**(URL/path 라우팅 전환 시 등록) | `docs/PHASES.md:32` · `shared/navigation/routes.ts:27` | §범위 1 의 "`/skills` → `/plugins`(레거시 리다이렉트 보존)" | **뒤집음(개명)** — 근거: 사용자 결정 ⑤. 저장된 딥링크 파손을 막기 위해 `LEGACY_ROUTE_REDIRECTS` 로 `replace` 리다이렉트를 남긴다(AC2). |
| **IPC 82채널·23도메인** | `docs/IPC_CONTRACT.md:5,28` | §비범위 "IPC 채널 신설·변경 0(82채널 유지)" | **유지** — 이미 있는 `orca:plugin:list`·`orca:auth:providers` 를 소비만 한다. `IPC_CONTRACT.md:228` 의 "`/skills` 화면이 단일 호출자" 문구만 경로 정합. |
| **i18n 위생 테스트**(ko↔en 키 일치·빈 값 금지·placeholder 일치) | `resources/resources.test.ts:29-51` | §i18n 변경 전체 | **유지** — `skills.view.backAria` 의 `{{section}}` 을 ko/en 양쪽에 동일하게 둔다. |
| **마이그레이션 append-only 가드** | `app/scripts/check-migrations-appendonly.mjs` | (해당 없음 — 마이그레이션 0) | **N/A** |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **로딩**: 세 데이터 소스(`useCustomizeSkills`·`useMcpServers`·`usePluginCatalog`)가 독립 비동기다. 탭 본문은 *그 탭의* 로딩만 본다 — 현행처럼 `skills.loading || mcp.loading` 으로 묶으면 무관한 탭이 함께 스피너가 된다(`SkillsCustomizeView.tsx:119` 의 현행 결함). 탭별 로딩으로 분리한다.
- **빈 상태 3종**: 스킬 0(`noSkills`) · MCP 0(`noMcp`) · 플러그인 0(`noPlugins`). **플러그인 0 은 기본 빌드의 상시 상태**이므로 "설치된 플러그인이 없습니다" 가 오류처럼 보이지 않게 중립 문구로 쓴다.
- **목록 변동 중 상세 유실**: 상세에서 스킬을 제거하면 그 `selectedId` 가 목록에서 사라진다 → 제거 완료 후 `back()` 으로 목록 복귀(참조 브랜치 `await skills.remove(...); setSelectedId(null)` 승계). MCP 삭제·플러그인 목록 갱신도 같은 규칙 — 렌더 시 `selectedId` 가 현재 탭 목록에 없으면 목록 depth 로 강등한다.
- **탭 전환 시 잔상**: 탭을 바꾸면 `selectedId` 를 반드시 비운다(AC5) — 안 그러면 스킬 상세를 보다 MCP 탭으로 갔을 때 id 가 우연히 충돌해 엉뚱한 상세가 열릴 수 있다(스킬 키는 `sourceId/name`, MCP 는 `id` 로 네임스페이스가 다르지만 의존하지 않는다).
- **딥링크·뒤로가기**: `/skills` 는 `replace` 리다이렉트라 히스토리에 남지 않는다 — 브라우저 뒤로가기가 `/skills` ↔ `/plugins` 를 오가는 루프가 생기지 않는다.
- **키보드/a11y**: 테이블 행은 `role="button"` + `tabIndex={0}` + Enter/Space 활성화(참조 브랜치 `activateRow` 승계). 상세 헤더 뒤로가기는 `aria-label={tr('skills.view.backAria', { section })}`. 레일 활성 탭은 `aria-current="page"`.
- **언어 전환**: 라벨은 전부 키로 보관하고 렌더에서 `tr()` — 전환 시 stale 없음(0096).
- **테마**: 신규 마크업은 시맨틱 토큰(`bg-panel`·`text-ink*`·`border-border`·`bg-fill-uncontained-hover`)만 사용 — 하드코딩 색상 0.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **플러그인 탭이 기본 빌드에서 항상 빈 상태** (`AUTH_PLUGIN_PACKAGES = []`) — 사용자가 "고장" 으로 오해할 수 있고, 비어 있지 않은 렌더링 경로를 실기로 확인할 수 없다. | 빈 상태를 중립 문구로 1급 처리(AC8 후반부, 사람 실기 가능). 비어 있지 않은 경우의 집계·정렬은 `buildPluginRows` 순수 테스트로 고정(AC7). 렌더 자체는 스킬/MCP 테이블과 동일 컴포넌트 관용구를 써서 시각 리스크를 줄인다. |
| **"플러그인 페이지" 안에 "플러그인 탭"** 이 있어 어휘가 중의적이다. | 사용자 결정(③⑤)이므로 그대로 간다. 페이지 헤더 라벨과 탭 라벨을 다른 키(`nav.plugins` vs `skills.rail.plugins`)로 분리해, 훗날 어느 한쪽만 바꿀 수 있게 남긴다. 내부 컴포넌트 어휘는 우산 개념인 `ExtensionsCatalogView`/`extensions-catalog` 로 두어 셋을 구분한다. |
| **3-pane → 2-pane 전환으로 목록 단계의 스킬 on/off 토글이 사라진다**(현행 `CustomizeList` 좌측 토글, `skills.list.off`). | 토글은 상세(`SkillDetail`)에 이미 있으므로 기능 손실은 없고 클릭 1회가 늘어난다. 테이블 이름 열에서 비활성 항목을 `text-ink3` 로 흐리게 표기해 상태는 목록에서도 읽히게 한다(참조 브랜치 관례). |
| 참조 브랜치를 **부분만** 가져오므로, 나중에 그 브랜치를 머지하면 충돌한다. | 이 핸드오프는 참조 브랜치를 머지하지 않고 구조만 재구현한다. 참조 브랜치는 설계 입력으로만 인용하고 `INDEX.md`·plan 에 그 사실을 남긴다. |
| `Sidebar.tsx` 의 `NAV` 추출이 동작을 바꿀 위험. | 추출은 **이동만**(값·순서·`isActive` 술어 동일). 4항목 전부에 대해 `navItems.test.ts` 가 `path`·`isActive` 를 고정한다(AC3 은 4번째, 나머지 3개도 같은 테스트에서 회귀로 고정). |

- **되돌리기 어려운 결정**: 라우트 `/plugins`, i18n 키 `nav.plugins`/`sidebar.nav.plugins`, 탭 식별자 `skills|mcp|plugins`. 셋 다 세션 중 사용자 확정(결정 ③④⑤). 저장된 딥링크는 `LEGACY_ROUTE_REDIRECTS` 가 흡수한다.
- **단독 결정 금지 항목(Open Question) → 사용자에게**:
  **OQ1** — 플러그인 탭의 상시 빈 상태를 어떻게 다룰지. ⓐ 그대로(현 설계) ⓑ 빈 상태에 "폐쇄망 배포에서 플러그인 패키지를 등록하면 여기에 표시됩니다" 안내 문구 추가 ⓒ 참조 브랜치식 절충(내장 스킬을 플러그인으로도 표시 — GLOSSARY §Connector/Plugin 어휘를 UI 에서 뒤집는 비용 수반). **현 설계는 ⓐ 로 진행하며, ⓑ 는 i18n 문구 1줄 추가라 언제든 가산 가능하다.**

## 영향 받는 파일

**renderer (신규 8 · 수정 8 · 개명 2 · 삭제 1)**

- 신규: `shared/navigation/routes.test.ts` · `app/navItems.ts` · `app/navItems.test.ts` · `features/skills/lib/catalogSelection.ts`(+`.test.ts`) · `features/skills/lib/catalogRows.ts`(+`.test.ts`) · `features/skills/lib/pluginCatalog.ts`(+`.test.ts`) · `features/skills/hooks/usePluginCatalog.ts` · `features/skills/components/customize/PluginDetail.tsx`
- 개명: `pages/SkillsPage.tsx` → `pages/PluginsPage.tsx` · `features/skills/components/customize/SkillsCustomizeView.tsx` → `ExtensionsCatalogView.tsx` (둘 다 `git mv` 로 이력 보존)
- 수정: `app/router.tsx` · `app/Sidebar.tsx` · `shared/navigation/routes.ts` · `shared/api/ipc.ts` · `shared/i18n/resources/ko.ts` · `shared/i18n/resources/en.ts` · `features/skills/index.ts` · `features/skills/components/customize/{CustomizeRail,CustomizeList}.tsx`
- 삭제: `features/skills/components/customize/CustomizeLanding.tsx`

**docs (6)**

- `docs/arch/frontend/ux-domains.md`(§3 화면 표 96행 + 102·108행 주석) · `overview.md`(71·75행에 0159 개명 각주) · `layers.md`(33행 라우트 주석 + 65행 features 트리) · `dom-architecture.md`(45행 nav 4-항목 라벨) · `terms.md`(69행 라우트 화면 목록) · `docs/IPC_CONTRACT.md`(228행 "`/skills` 화면이 단일 호출자")
- 보드/이력: `docs/handoff/INDEX.md` · (verify PASS 후) `docs/PHASES.md`

**main**: 변경 없음.

## 참고 문서

- `docs/GLOSSARY.md` §Connector / §Plugin / §Auth target (30·31행)
- `docs/IPC_CONTRACT.md` §2.13-d `plugin` 도메인 (407-409행) · §2.13-c `auth` 도메인
- `docs/arch/frontend/{ux-domains,overview,layers,dom-architecture,terms}.md`
- `app/AGENTS.md` §레이어 경계 · §테스트 동반 (26-31·166-169행)
- `app/src/main/features/auth-platform/modules/AGENTS.md` (플러그인 패키지 등록 절차 — 빈 배열이 기본값인 이유)
- 참조 구현: `git show e22d43b` (`origin/agent/extensions-library-modal`) — **레이아웃만 인용, 어휘·데이터 출처는 비채택**
- IPC 변경 없음 → `IPC_CONTRACT.md` 는 채널 표가 아니라 §2.10 설명 문구만 정합

### 참조 구현 커버리지 대조 (계약 전수)

참조 브랜치를 설계 입력으로 썼으므로, 이번 설계가 소비하는 계약의 union/enum 을 전수 나열해 커버리지를 표시한다.

| 계약 | 멤버 (전수) | 이번 설계의 처리 |
|---|---|---|
| `CatalogTab` (신설 union) | `skills` · `mcp` · `plugins` | 3/3 — 레일·목록·상세 전 분기 구현. 참조 브랜치는 `skills`·`connectors`·`plugins` 였다(어휘 비채택). |
| `SkillInfo.sourceKind` | `orca` · `adapter` · `workspace` | 3/3 — 작성자 열: `orca`→`skills.table.user`, 그 외→`sourceLabel`. `workspace` 는 현재 스캔 루트에서 생성되지 않지만(`adapters.md:169`) union 멤버이므로 `sourceLabel` 분기가 흡수한다. |
| `SkillInfo.updatedAt` (선택) | 지정 · **미지정** | 2/2 — 미지정 케이스를 별도 AC(AC9)로 고정. `formatDateMedium` 호출 전에 `null` 로 분기. |
| `McpServer.transport` | `stdio` · `http` | 2/2 — 아이콘(`cpu`/`link`) + 전송 방식 열. |
| `PluginConnectorInfo.connected` | `true` · `false` | 2/2 — 상세에서 연결/미연결 라벨. **미지정 상태 없음**(선택 필드가 아님, `app/src/shared/ipc.ts:292`). |
| `AuthProviderInfo.targets` | `application` · `connector` | 2/2 — 플러그인 상세의 provider 목록에 그대로 나열(판정에 쓰지 않으므로 분기 없음). |

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 4파일: `shared/navigation/routes.test.ts` · `app/navItems.test.ts` · `features/skills/lib/catalogSelection.test.ts` · `features/skills/lib/catalogRows.test.ts` · `features/skills/lib/pluginCatalog.test.ts` (총 5파일).
- 기존 `resources.test.ts` 3케이스가 i18n 개명을 그대로 검증한다(추가 작성 불필요).
- 신규 의존성 0 · 마이그레이션 0 · IPC 82채널 불변.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 2건 + 세션 확정 결정 3건을 출처와 함께 인용했고, 추론은 "(추론)" 으로 표기했다.
- [x] 자료조사 — 20개 발견 전부에 `파일:라인` 또는 실행한 명령을 붙였다.
- [x] 의존 기술 — 재사용 모듈·전제 2건을 적었고, 신규 의존성 0 을 명시했다.
- [x] 파생 UX — 로딩 분리·빈 상태 3종·상세 유실·탭 전환 잔상·딥링크 히스토리·키보드/a11y·언어 전환·테마를 이 작업 기준으로 펼쳤다(예시 복붙 아님).
- [x] 리스크 — 5건 + 되돌리기 어려운 결정 3건 + OQ1 을 사용자 몫으로 분리했다.

**기계적으로 확인 가능한 것**

- [x] **요구 비판적 검토** 5질문 전부 답했고, 이견(플러그인 탭 상시 빈 상태)을 적었지만 **요구 범위를 줄이지 않았다** — 플러그인 탭을 빼거나 내장 스킬로 대체하지 않았다.
- [x] 인수 기준 14개 전부 `검증 수단` 이 채워져 있고, 기계 검증 불가 2건(AC8 후반부·AC11)은 "**사람 실기** — `npm run dev` → 사이드바 '플러그인' → 플러그인 탭" 으로 실행 경로까지 명시했다.
- [x] 부정형/"불변" 기준 **0개** — AC12("typecheck 통과")·AC13("grep 0건")·AC14("게이트 통과")는 모두 실행 결과에 대한 양성 단언이다.
- [x] **AC 끼리 모순 없음** — 짝지어 훑었다. AC2(`/skills` 리다이렉트 존재)와 AC13(`docs` 에서 `/skills` 토큰 0건)은 대상이 다르다(코드 vs 문서). AC12(구 키 삭제)와 AC3/AC4(신규 키 해석)는 삭제 집합과 신설 집합이 겹치지 않는다(`skills.rail.mcp`·`skills.list.addAria` 는 유지 목록). 자기 산출물 위반 없음 — 신설 파일 5개는 어느 AC 도 금지하지 않는다.
- [x] 인용 수치를 이번 세션에서 직접 측정했다 — renderer 테스트 39건(`find`), 문서 route 토큰 5줄/4파일(`rg`), IPC 82채널(문서 §2 합계 재확인), `SkillsCustomizeView` 참조 2건(`grep`), `AddMcpServerModal` importer 0건(`grep`). 승계한 숫자 0.
- [x] 신규 모듈 10개 전부 테스트 방법이 적혀 있다. electron/DB 의존 없음(renderer 전용). `usePluginCatalog`·`.tsx` 3종은 "테스트 불가" 로 두지 않고 **떼어낼 순수부**(`lib/pluginCatalog`·`lib/catalogSelection`·`lib/catalogRows`)를 설계에 명시했다.
- [x] 전수 조사 대상에 N 수치 — `/skills` 라우트 토큰 **5줄/4파일**(+라벨 인용 2파일 = 6파일), `SkillsCustomizeView` 참조 **2건**, `CustomizeTab` 참조 **8건**, renderer 테스트 **39건**, `AddMcpServerModal` importer **0건**.
- [x] 각 AC 에 프로덕션 도달 경로가 있다 — 유일한 호출자가 테스트인 AC 0개. `lib/` 3모듈은 모두 `ExtensionsCatalogView`/`CustomizeList` 가 실제로 부르고, `SIDEBAR_NAV`·`ROUTES`·`LEGACY_ROUTE_REDIRECTS` 는 `Sidebar.tsx`·`AppLayout.tsx`·`router.tsx` 가 부른다.
- [x] "사람 실기" AC 2건의 실행 경로(`npm run dev` → 사이드바 → 탭)가 비범위에 막혀 있지 않다 — 비범위는 연결/해제 UI·모달 전환·디렉토리 개명뿐이고, 페이지 진입 자체는 범위 안이다.
- [x] 선택적 필드 판정마다 미지정 케이스 AC 가 있다 — `SkillInfo.updatedAt?` → AC9 가 미지정/지정 두 케이스를 요구한다. `PluginConnectorInfo.connected` 는 선택 필드가 아니므로(`ipc.ts:292`) 미지정 상태가 없다(§참조 구현 커버리지 표에 명시).
- [x] 소비하는 계약의 제약 필드마다 강제 지점이 설계에 있다 — 이번 설계는 **읽기 전용**이라 강제할 제약 필드를 소비하지 않는다. `acceptedAuthProviders` 는 연결 생성 시점의 제약이고, 연결 생성은 비범위(0158 이 main 에서 이미 강제 중). 이 사실을 §범위·§비범위에 명시했다.
- [x] 참조 구현을 입력으로 썼으므로 계약의 union/enum 전수 대비 커버리지를 §참조 구현 커버리지 대조 표로 표시했다(6계약 전부 100%).
- [x] 미룬 항목 4건 전부 일방향 여부에 답했다(§범위 유예 표), 그리고 일방향인 것 4건(라우트·i18n 키·탭 식별자·페이지 라벨)은 미루지 않고 **세션 중 사용자에게 물어 확정**했다.
- [x] **관문 4 를 본문 완성 후 돌렸다** — §기존 결정 표 9행을 본문(§범위·§설계·§파생 UX)을 훑으며 채웠고 각 행에 "본문에서 건드리는 문장" 을 적었다. 인용 경로를 실제로 열어 확인했다(`connectors/registry.ts:1-15`, `auth-platform/modules/index.ts:29`, `modules/_example/index.ts`, `vitest.config.ts`, `eslint.config.mjs:81-96`, `resources.test.ts`, `Icon.tsx:3-43`). 아래 `[구현자 기입]`·`[검증자 기입]` 블록이 남아 있다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (Codex=기능 / Claude=비기능). 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다(공유 파일 충돌 회피).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

- [ ] …

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint … / typecheck … / test … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (비어 있음) | — | — | — |
