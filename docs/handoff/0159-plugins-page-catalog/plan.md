# Plan — 0159-plugins-page-catalog

## 메타

| 항목 | 값 |
|---|---|
| slug | `0159-plugins-page-catalog` |
| 작성자 | Claude Code |
| 일자 | 2026-08-03 |
| 매핑 | PHASES 신규 행 (Phase 4) / PR 미정 |
| 상태 | DRAFT → **READY** |
| 개정 | **r2 (2026-08-03)** — "플러그인" 어휘 3중 의미 정합(§용어 레지스터 정합 신설, 결정 ⑥⑦). 초판이 인용한 `GLOSSARY.md §Plugin` 이 **실재하지 않음**을 확인해 정정하고, 표제어 신설을 산출물로 편입(AC15~17). 탭 구성·데이터 출처는 초판과 동일. |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "skills&mcp 페이지를 플러그인 페이지로 변경하라." | 라이브 세션 요청 (`/handoff-plan` 인자) |
| 명시 요구 ② | "하위의 페이지 구성을 다음 브랜치를 참고하여 변경하라. `agent/extensions-library-modal`" | 라이브 세션 요청 (`/handoff-plan` 인자) |
| 명시 결정 ③ | **라우트 페이지를 유지**한다 (참조 브랜치의 모달 전환은 채택하지 않는다). | 세션 중 `AskUserQuestion` 응답 — "라우트 페이지 유지" |
| 명시 결정 ④ | 탭 3종은 **용어 정합** 안으로 간다 — 스킬 / MCP / **플러그인**, 플러그인 탭은 참조 브랜치의 "내장 스킬" 이 아니라 **실제 플러그인**(0157/0158 의 `orca:plugin:list` 계열)을 노출한다. | 세션 중 `AskUserQuestion` 응답 — "용어 정합 — 스킬 / MCP / 플러그인" |
| 명시 결정 ⑤ | 라우트를 **`/plugins` 로 개명**하고 `/skills` 는 리다이렉트로 보존한다. i18n 키도 함께 개명한다. | 세션 중 `AskUserQuestion` 응답 — "`/plugins` 로 개명 + `/skills` 리다이렉트" |
| 명시 지적 ⑥ | "플러그인의 용어가 혼용되고 있는데, 이번 핸드오프에서 언급한 플러그인은 **uiux 에서 적합한 용어**이고, 코드에서 orca plugin 의 경우 **claude 플랫폼에서 사용되는 용어**이다." → 두 "플러그인" 은 *같은 개념의 다른 표기* 가 아니라 **다른 레지스터의 다른 개념**이다. | 라이브 세션 지적 (r2 `/handoff-plan` 인자) |
| 명시 결정 ⑦ | 지적 ⑥ 을 받아 3번째 탭 정체성을 재질의한 결과 — **"플러그인 탭 유지 / 행 = 플러그인 패키지"**(초판 설계 그대로). 어휘 해소는 UI 재명명이 아니라 **레지스터 구분 + GLOSSARY 표제어 등록**으로 한다. | 세션 중 `AskUserQuestion` 응답 (r2) |
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

## 용어 레지스터 정합 — "플러그인" 3중 의미 (지적 ⑥ / 결정 ⑦)

이 저장소에는 "플러그인" 이 **세 의미**로 이미 공존하는데 `docs/GLOSSARY.md` 에 `Plugin` 표제어가 **없다**
(이번 세션 확인: `rg '\*\*Plugin\*\*' docs` = **0건**). 그래서 이 plan 초판이 "main 에서 **Plugin = provider·connector 를
담는 빌드타임 패키지**로 확정돼 있다" 며 `GLOSSARY.md:30` 을 인용했는데, 30행은 **`Connector` 표제어**다 —
없는 정의를 근거로 삼은 것이 혼용의 출처다(초판 46·267행, r2 에서 정정).

| 의미 | 무엇인가 | 코드/문서 앵커 | 전수 (이번 세션 측정) | 레지스터 | 이번 핸드오프의 취급 |
|---|---|---|---|---|---|
| **(A) 우산어 "플러그인"** | 스킬·MCP·플러그인 패키지를 **한 화면에서 관리한다는 UX 개념** = 이 페이지의 이름 | `/plugins` · `PluginsPage` · `nav.plugins*` · `sidebar.nav.plugins` | **신설** — 현재 renderer 의 `plugin` 식별자는 `remarkPlugins` 제외 시 **0건** | **UI/UX** (사용자 지적 ⑥: 여기서 적합한 용어) | **신설·확정**(결정 ⑤). UI 라벨·라우트·nav 키에만 쓴다. |
| **(B) orca plugin** | Claude Code 가 `options.plugins` 로 로드하는 **플러그인 패키지 디렉토리** — `dist/<engine>/plugins/orca/`(+ 사용자 `~/.claude/skills` 래퍼 `plugins/claude/`). 로드된 스킬은 `orca:<name>` 으로 네임스페이스된다 | `ORCA_PLUGIN_NAME='orca'`(`main/adapters/claude-plugin.ts:7`) · `.claude-plugin/plugin.json` · `renderClaudePluginPackage`(`features/extensions/claude-plugin-package.ts:56`) · `orcaPluginRoot`(같은 파일 27행) · `infra/config/paths.ts:12-13` | **10파일 / 54줄** | **Claude 플랫폼** (사용자 지적 ⑥) | **무변경** — main 변경 0. renderer 에 이 의미의 식별자를 만들지 않는다. |
| **(C) 플러그인 패키지** | 인증 provider · connector · runtime tool 을 담는 **Orca 빌드 타임 확장 패키지**. `orca:plugin:*` IPC 도메인이 그 connector lifecycle 을 노출한다 | `AuthPluginPackage`·`AUTH_PLUGIN_PACKAGES`(`auth-platform/modules/index.ts:20,29`) · `PluginHost`(`auth-platform/plugin-host.ts`) · `PluginConnectorInfo`(`shared/ipc.ts:284-293`) · `pluginId` | **39파일 / 162줄** | Orca 내부 (0157/0158, 미등록) | **3번째 탭의 데이터**(결정 ⑦ — 탭 유지, 행 = 패키지). |

**(A) 와 (B) 는 무관한 개념이 아니라 *방향* 이 다르다**: (A) 화면이 관리하는 스킬·MCP 는 배포 시점에 (B) 로
렌더된다(`renderClaudePluginPackage`). 즉 (A) = 사람이 보는 관리 화면, (B) = 그 결과물의 Claude 플랫폼 표현.
같은 단어를 쓰지만 **한쪽은 UI 라벨, 한쪽은 배포 산출물 이름**이므로 코드에서 섞이면 안 된다.

**(C) 는 IPC 도메인 이름과 payload 가 어긋나 있다**: `IPC_CONTRACT.md` §2.13-d 제목이 "Plugin (0158 — **정적 connector
lifecycle**)" 이고 `orca:plugin:list` 응답은 `PluginConnectorInfo[]`(= **커넥터** 목록)다. "플러그인 패키지" 라는 *행 단위* 는
채널이 주는 것이 아니라 이 설계가 `pluginId` 로 **집계해 만드는 파생물**이다(AC7). 채널 계약은 건드리지 않는다(82채널 불변).

### 식별자 배치 규칙 (레지스터가 코드에서 섞이지 않게)

| 레지스터 | 이 작업이 쓰는 식별자 | 쓰지 않는 것 |
|---|---|---|
| **(A) 우산어** | 라우트·페이지·nav·i18n nav 키: `/plugins` · `pages/PluginsPage.tsx` · `nav.plugins` · `nav.pluginsBreadcrumb` · `sidebar.nav.plugins` | 뷰·훅·`lib/` 이름에 **A 의미로** `plugin` 을 쓰지 않는다 — 셸은 `ExtensionsCatalogView` + `data-context="extensions-catalog"`(우산 개념은 `extensions` 로 표기) |
| **(C) 패키지** | `orca:plugin:*` 도메인을 **미러**: `pluginApi.list` · `lib/pluginCatalog.ts` · `buildPluginRows` · `usePluginCatalog` · `PluginDetail.tsx` · 탭 id `plugins` · `skills.rail.plugins` | — |
| **(B) Claude 플랫폼** | (renderer 는 이 의미에 닿지 않는다 — 측정치 0건) | renderer 에 `OrcaPlugin*` · `claudePlugin*` · `.claude-plugin` 식별자를 만들지 않는다 |

- (A) 와 (C) 가 같은 파일 트리에 나란히 놓이므로, 두 진입 파일(`pages/PluginsPage.tsx` · `features/skills/lib/pluginCatalog.ts`)
  **헤더 주석에 자기 의미와 `docs/GLOSSARY.md` §Plugin 앵커를 명시**한다(AC17).
- **UI 문구 규칙**: 페이지 라벨·탭 라벨은 "플러그인"(결정 ⑤⑦ 유지), **탭 본문 문구**(열 제목·빈 상태·상세 헤더)는
  "**플러그인 패키지**" 로 적어 한 화면에서 두 의미가 같은 단어로 읽히지 않게 한다(§i18n 변경).
- **산출물**: `docs/GLOSSARY.md` §1 에 `Plugin (3중 의미)` 표제어를 신설한다(AC15). 이 핸드오프가 (A) 를 만드는 당사자이므로
  등록을 미루지 않는다 — 표제어 없이 (A) 를 UI 에 내보내면 다음 작업자가 초판과 같은 오인용을 반복한다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당** — 다만 증상 서술이 하나 부족했다. "페이지 이름 변경" 은 표면이고, 실제 결손은 **`orca:plugin:list` 를 소비하는 renderer 코드가 0건**이라는 것이다. 요구대로 하면 이 결손이 함께 닫힌다. | `grep -rn "pluginList\|PluginConnectorInfo" app/src/renderer app/src/preload` = preload 2건뿐, renderer 0건 |
| 이미 있는 것 아닌가 (기존 코드로 충족되나) | **아니오.** 현행 레일은 2탭(`skills`·`mcp`)이고 플러그인 탭·플러그인 데이터 경로가 없다. 참조 브랜치의 `isBuiltin`(내장 스킬 = 플러그인) 도 main 에 없다. | `CustomizeRail.tsx:4` · `app/src/shared/ipc.ts:1165-1180`(`SkillInfo` 에 `isBuiltin` 없음) |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **부분적으로 예 → 채택.** feature 디렉토리 개명(`features/skills` → `features/extensions`)은 하지 **않는다** — 배럴 소비자가 `pages/` 1곳뿐이라 언제 해도 비용이 같고, 요구가 부르지 않은 churn 이다. 반면 컴포넌트 재구성은 3-pane → 2-pane 이라 구조 변경이 불가피하다(테이블 목록이 중앙 pane 을 전폭으로 요구). | `grep -rn "SkillsCustomizeView" app/src` = 배럴 1 + 페이지 1 |
| 인용 자료가 요구를 부풀리지 않았나 | **부풀림 발견 — 정정함.** 참조 브랜치 `e22d43b`(2026-07-30)는 **0156 기반이라 0157/0158 이전**이다. 그 브랜치의 "커넥터" = MCP 서버, "플러그인" = `.orca-builtin.json` 마킹된 내장 **스킬**인데, 현재 main 에서 **Connector = 인증된 내장 도구 contribution**(GLOSSARY 등록)이고 "플러그인" 은 (B)(C) 두 의미로 코드에 산다(§용어 레지스터 정합). 그대로 옮기면 채택된 `Connector` 어휘를 UI 에서 뒤집는다. → 사용자 결정 ④ 로 정합안 채택. | `git log --oneline origin/agent/extensions-library-modal` · `docs/GLOSSARY.md:30`(=`Connector`) · `app/src/main/features/connectors/registry.ts:1-13` |
| **자기 인용이 실재하는가 (r2 자기 정정)** | **초판 오류 — 정정함.** 초판은 "main 에서 **Plugin = 빌드타임 패키지로 확정**" 이라며 `GLOSSARY.md:30` 을 인용했으나 **`Plugin` 표제어는 GLOSSARY 에 존재하지 않고** 30행은 `Connector` 다. 즉 확정되지 않은 정의를 확정으로 서술했다. → §용어 레지스터 정합에서 세 의미를 실측 앵커로 다시 세우고, 표제어 신설을 산출물로 편입(AC15). 사용자 지적 ⑥ 이 정확히 이 지점을 짚었다. | 이번 세션 실행: `rg -n '\*\*Plugin\*\*' docs` = **0건** · `rg -n '§Plugin' docs` → 유일한 히트가 **초판 §참고 문서의 자기 인용** 1줄 |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다** (§기존 결정·규칙과의 관계 참조). 오히려 참조 브랜치가 뒤집던 것(GLOSSARY §Connector)을 결정 ④ 가 되돌린다. 단 ⓐ `/skills` 라우트·i18n 키 개명은 0083/0096 의 nav 결정을 **개명 수준에서 갱신**하고, ⓑ GLOSSARY 에 `Plugin` 표제어를 **가산**한다(기존 표제어 수정 없음 — (B)(C) 는 이미 코드에 있는 사실의 등록). | `docs/arch/frontend/overview.md:71` · `docs/GLOSSARY.md:30` · `docs/AGENTS.md` 원칙 5(용어 통일) |

- **사용자에게 올릴 것(단독 결정 불가)**: 컨테이너·탭 어휘·식별자 3건은 **세션 중 이미 질의·확정**(결정 ③④⑤). 추가 미결은 아래 §리스크 Open Question 1건.

> **이견(요구는 그대로 진행)** — 결정 ④ 를 확정한 *뒤에* 발견한 사실이 하나 있다:
> `AUTH_PLUGIN_PACKAGES` 는 신규 설치에서 **빈 배열**이다(`app/src/main/features/auth-platform/modules/index.ts:28`).
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
| `AUTH_PLUGIN_PACKAGES = []` (신규 설치 기본값). `_example` 은 배럴 미등록 + `contributes.connectors: []`. → 기본 빌드에서 provider·connector 모두 0건. | `app/src/main/features/auth-platform/modules/index.ts:28` · `modules/_example/index.ts:1-2,45` |
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
| **(r2)** `docs/GLOSSARY.md` 에 `Plugin` 표제어가 **없다**. "플러그인" 이 나오는 곳은 3줄뿐이고 전부 다른 표제어의 *수식어* 다 — `Auth provider`(29행 "빌드 타임 플러그인") · `Connector`(30행 "한 플러그인 패키지가 …") · §3 금지어(81행 "설치형 플러그인"). | 이번 세션 실행: `rg -n '\*\*Plugin\*\*' docs` = **0건** · `rg -c '플러그인' docs/GLOSSARY.md` = **3** |
| **(r2)** 의미 (B) 전수 = **10파일 / 54줄**(`ORCA_PLUGIN_NAME`·`CLAUDE_USER_PLUGIN_NAME`·`.claude-plugin`·`orcaPluginRoot`·`userClaudePluginRoot`·`renderClaudePluginPackage`·`renderClaudeUserSkillsPlugin`). `dist/<engine>/plugins/orca` = Claude Code plugin, `plugins/claude` = 사용자 `~/.claude/skills` 래퍼(0117). | 이번 세션 실행: `rg -n '<7개 심볼>' app/src \| wc -l` = 54 / `rg -l … \| wc -l` = 10 · `app/src/main/infra/config/paths.ts:12-13` |
| **(r2)** 의미 (C) 전수 = **39파일 / 162줄**(`orca:plugin:`·`AUTH_PLUGIN_PACKAGES`·`AuthPluginPackage`·`PluginConnectorInfo`·`PluginHost`·`pluginId`). | 이번 세션 실행: 같은 방식 `wc -l` = 162 / 39 |
| **(r2)** renderer 에는 "플러그인" 이 **아직 없다** — i18n ko 카탈로그에 `플러그인`/`plugin` **0건**, renderer 소스의 `plugin` 식별자는 `Markdown.tsx:144` 의 `remarkPlugins` 1건뿐(라이브러리 prop). → 의미 (A) 는 이 작업이 **처음 도입**하며 기존 어휘와 충돌하지 않는다. | 이번 세션 실행: `rg -n '플러그인\|[Pp]lugin' …/resources/ko.ts` = 0 · `rg -n '[Pp]lugin' src/renderer/src \| rg -v remarkPlugins \| wc -l` = 0 |
| **(r2)** `orca:plugin:list` 는 IPC 문서에서 "**정적 connector** 의 목록" 으로 정의된다 — 도메인 이름(plugin)과 payload(connector)가 어긋난다. "플러그인 패키지" 행 단위는 이 설계의 `pluginId` 집계 파생물이다. | `docs/IPC_CONTRACT.md:402-408`(§2.13-d 제목·표) · `app/src/main/app/handlers/plugins.ts:14-16` |
| **(r2)** `authApi.providers()` 도 renderer 소비자가 **0건**이다(facade 정의 1줄뿐). 즉 이 탭은 `orca:plugin:list` 와 `orca:auth:providers` **둘 다의 첫 소비자**다. | `app/src/renderer/src/shared/api/ipc.ts:205` · `rg -n 'providers\(\)' src/renderer` = facade 1건 |
| **(r2)** 문서-코드 불일치 발견(**이번 범위 밖 · 사용자 보고**): `GLOSSARY.md:58` §sources/dist 가 "현행 **`ensureOrcaPlugin()`** 은 `~/.config/orca/` 직접 write, 설계 채택/**구현 대기**" 라고 적었으나 ⓐ `ensureOrcaPlugin` 심볼은 코드에 **없고**(전 저장소 유일 히트가 이 문서 줄) ⓑ 배포는 `deploy()` 로 구현되어 부팅에서 호출된다(`bootstrap.ts:32,258,402`). r2 는 **ⓐ 심볼명만** 정정하고(AC16) ⓑ 구현 상태 문구는 손대지 않는다 — 상태 판정은 어휘 정합이 아니라 별건이다. | 이번 세션 실행: `rg -n 'ensureOrcaPlugin' docs app/src` = `docs/GLOSSARY.md:58` **1건** · `app/src/main/app/bootstrap.ts:32,258,402` |
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
| 15 **(r2)** | `docs/GLOSSARY.md` §1 에 `Plugin` 표제어가 있고, 그 행이 **세 의미를 각각 코드 앵커와 함께** 담는다 — `ORCA_PLUGIN_NAME`(B) · `AUTH_PLUGIN_PACKAGES`(C) · `nav.plugins`(A) 세 문자열이 모두 그 행 안에 나타난다. | 아래 `### AC15~17 검증 명령` 의 1번(4줄 이상 매치) | 문서 자체 — 이후 모든 plan/verify 가 §Plugin 을 인용한다 |
| 16 **(r2)** | `GLOSSARY.md` §sources/dist 행이 **실재하는 심볼**(`renderClaudePluginPackage`)을 인용하고, 저장소 `docs/`(핸드오프 제외) 전체에서 `ensureOrcaPlugin` 검색이 0줄이다. | 아래 검증 명령 2번 | 문서 자체 |
| 17 **(r2)** | `pages/PluginsPage.tsx`(의미 A) 와 `features/skills/lib/pluginCatalog.ts`(의미 C) 의 **헤더 주석이 각각 자기 의미를 밝히고 `GLOSSARY.md` §Plugin 을 앵커로 인용**한다 — 두 파일 모두에서 `GLOSSARY` 문자열이 첫 10줄 안에 나타난다. | 아래 검증 명령 3번(2파일 × 1줄 이상) | 소스 파일 자체 — (A)/(C) 를 나란히 읽는 다음 작업자가 첫 화면에서 레지스터를 구분한다 |

### AC13 검증 명령

```sh
# 라우트 토큰(백틱/작은따옴표 인용) 잔존 = 0줄이어야 한다
rg -n -e "'/skills'" -e '`/skills`' docs \
  -g '!docs/handoff/**' -g '!docs/PHASES.md' -g '!docs/arch/frontend/overview.md'

# overview.md 두 이력 행에 개명 각주가 있어야 한다 (2줄 이상)
rg -n '0159' docs/arch/frontend/overview.md
```

### AC15~17 검증 명령

```sh
# 1) §Plugin 표제어가 세 의미의 코드 앵커를 모두 담는다 (각 1줄 이상 = 총 4줄 이상)
rg -n '\*\*Plugin\*\*' docs/GLOSSARY.md
rg -n '\*\*Plugin\*\*.*ORCA_PLUGIN_NAME' docs/GLOSSARY.md
rg -n '\*\*Plugin\*\*.*AUTH_PLUGIN_PACKAGES' docs/GLOSSARY.md
rg -n '\*\*Plugin\*\*.*nav\.plugins' docs/GLOSSARY.md

# 2) 죽은 심볼 인용 제거 + 실재 심볼 인용 (앞 0줄 / 뒤 1줄 이상)
rg -n 'ensureOrcaPlugin' docs -g '!docs/handoff/**'
rg -n 'renderClaudePluginPackage' docs/GLOSSARY.md

# 3) 두 진입 파일 헤더가 GLOSSARY 를 앵커로 인용한다 (각 1줄 이상)
head -10 app/src/renderer/src/pages/PluginsPage.tsx | rg -n 'GLOSSARY'
head -10 app/src/renderer/src/features/skills/lib/pluginCatalog.ts | rg -n 'GLOSSARY'
```

> AC1~7·9·10 은 순수 `.ts` 단위 테스트, AC12~14 는 게이트 명령, AC13·AC15~17 은 `rg`/`head` 명령, AC8 후반부·AC11 만 사람 실기다.
> **두 사람-실기 항목의 실행 경로(`npm run dev` → 사이드바 → 탭)는 이 문서의 비범위 절 어디에도 막혀 있지 않다.**

## 범위 / 비범위

- **범위**
  1. 라우트·nav·i18n 개명: `/skills` → `/plugins`(레거시 리다이렉트 보존), `nav.skills*`/`sidebar.nav.skills` → `nav.plugins*`/`sidebar.nav.plugins`, 페이지 라벨 "플러그인".
  2. 하위 구성 재구성(참조 브랜치 구조 채택): 좌측 3탭 레일 + 우측 `header(제목 · 목록에서만 추가 버튼) + 본문(테이블 목록 ↔ 상세 1-depth)`. 랜딩(`CustomizeLanding`) 폐기 — 기본 탭 = 스킬.
  3. 탭 3종: **스킬**(기존 `useCustomizeSkills`) · **MCP**(기존 `useMcpServers`) · **플러그인**(신규 `usePluginCatalog` — `authApi.providers()` + `pluginApi.list()`).
  4. renderer facade 에 `pluginApi.list` 추가 + `features/skills` 에 순수 `lib/` 3모듈(선택 상태 · 행 메타 · 플러그인 집계) 신설 및 단위 테스트.
  5. Sidebar `NAV` 를 `app/navItems.ts` 로 추출(동작 무변경) — nav 라우팅을 기계 검증 가능하게 만드는 seam.
  6. 프론트엔드 아키텍처 문서 6건 + `IPC_CONTRACT.md` §MCP 호출자 문구 정합.
  7. **(r2) 용어 정합**: `docs/GLOSSARY.md` §1 에 `Plugin` 표제어 신설(3중 의미 + 코드 앵커, AC15) · §sources/dist 의 죽은 심볼 인용 정정(AC16) · (A)/(C) 두 진입 파일 헤더 주석에 레지스터 + GLOSSARY 앵커 표기(AC17).

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
| **(r2)** `GLOSSARY.md:58` 의 sources/dist **구현 상태** 문구("설계 채택 / 구현 대기")가 코드(`bootstrap.ts` 가 `deploy()` 호출)와 어긋나는 것 | **아니오 — 다만 미루는 게 아니라 *이 핸드오프의 일이 아니다*.** 상태 판정은 어휘 정합이 아니라 배포 계층 현행화 작업이고, 잘못 고치면 `standardization.md` §5.1 스테이지 구분까지 흔든다(`docs/AGENTS.md` 원칙 4 — 문서-코드 충돌은 사용자 판단). r2 는 **죽은 심볼명만** 정정한다(AC16). 상태 문구는 §리스크에 사용자 보고 항목으로 남긴다. |
| **(r2)** `orca:plugin:*` 도메인 이름과 payload(커넥터)의 불일치 자체 | **아니오, 그리고 지금 건드리면 더 비싸다** — 채널명은 preload·renderer·문서에 걸친 **공개 계약**이고 이미 배포됐다(82채널 SSOT). 이 작업은 소비자일 뿐이므로 개명 권한이 없다. 대신 §용어 레지스터 정합이 "채널은 커넥터를 주고 패키지 행은 파생물" 이라는 사실을 문서로 고정한다. |

> **일방향이라 지금 확정한 것**: 라우트 경로 `/plugins`, i18n 키 `nav.plugins`/`sidebar.nav.plugins`, 탭 식별자
> `skills|mcp|plugins`, 페이지 라벨 "플러그인". 넷 다 세션 중 사용자에게 물어 확정했다(결정 ③④⑤).
> **(r2) 다섯째 — 어휘 등록**: (A) 를 UI 에 내보내는 순간 "플러그인" 은 사용자 대화·스크린샷·후속 문서에 소비자가 생겨
> 되돌리기 비용이 붙는다. 그래서 3번째 탭 정체성을 **다시 물어 재확인**하고(결정 ⑦), 세 의미의 GLOSSARY 등록을
> 후속 핸드오프로 넘기지 않고 이 작업의 산출물로 넣었다(AC15). 등록 없이 내보내면 다음 작업자가 초판과 같은
> 오인용(없는 §Plugin 을 확정으로 인용)을 반복한다 — 실제로 초판이 그렇게 했다.

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
| `features/skills/lib/pluginCatalog.ts` (신규) | `buildPluginRows(providers, connectors)` — `pluginId` 합집합 + 집계, `buildPluginDetail(pluginId, …)`. **헤더 주석에 "의미 (C) 플러그인 패키지" + GLOSSARY §Plugin 앵커**(AC17) | `features/skills` | 순수 단위 — `pluginCatalog.test.ts` |
| `features/skills/hooks/usePluginCatalog.ts` (신규) | `authApi.providers()` + `pluginApi.list()` 동시 로드 → `{rows, loading}`. **집계 로직은 `lib/pluginCatalog` 에 위임**(훅은 배선만) | `features/skills` | 훅 자체는 미테스트(전제: 판정 0). 떼어낸 순수부 = `lib/pluginCatalog` |
| `features/skills/components/customize/PluginDetail.tsx` (신규) | 플러그인 1건 상세 — provider/connector 목록, connector 의 `origin`·`connected` 표시 | `features/skills` | 시각 검증(사람) — 판정 로직은 `lib/pluginCatalog` 에 없음 |
| `features/skills/components/customize/ExtensionsCatalogView.tsx` (`SkillsCustomizeView.tsx` 개명) | 3탭 셸 조립 — 레일 + 헤더 + 목록/상세 스위치 | `features/skills` | 시각 검증(사람) |
| `pages/PluginsPage.tsx` (`SkillsPage.tsx` 개명) | `ExtensionsCatalogView` 배치만. **헤더 주석에 "의미 (A) 우산어 = 페이지 이름" + GLOSSARY §Plugin 앵커**(AC17) | `pages` | 시각 검증(사람) |
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
- **(r2) 두 의미가 한 화면에서 같은 단어로 읽히지 않게 하는 문구 규칙**(§용어 레지스터 정합):
  - 우산어(A) = **페이지 라벨·탭 라벨**: `nav.plugins`·`sidebar.nav.plugins`·`skills.rail.plugins` = "플러그인"(결정 ⑤⑦ 유지).
  - 패키지(C) = **탭 본문 문구**: `skills.table.plugin`(열 제목) · `skills.table.noPlugins`(빈 상태) · `skills.pluginDetail.*`(상세)
    은 "**플러그인 패키지**" 로 적는다. 예 — `noPlugins` = "등록된 플러그인 패키지가 없습니다"(중립 문구, §파생 UX 빈 상태 3종).
  - en 은 같은 대응으로 `Plugin`(라벨) / `Plugin package`(본문).
  - 이 규칙은 i18n 문자열만 건드리므로 되돌리기 비용이 없다 — 식별자·키 이름은 (C) 레지스터를 그대로 미러한다.

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **Connector = 인증된 내장 도구 contribution** (MCP 서버와 별개 개념) | `docs/GLOSSARY.md:30` · `app/src/main/features/connectors/registry.ts:1-15` | §i18n 변경 의 "`skills.rail.connectors` 는 채택하지 않는다"; §범위 3 의 "탭 3종: 스킬 · MCP · 플러그인" | **유지** — 참조 브랜치가 뒤집던 것을 되돌린다. MCP 탭은 "MCP" 로 남고, connector 어휘는 플러그인 상세 안에서만 원 의미로 쓰인다. |
| **(r2) "orca plugin" = Claude Code plugin 배포 산출물** — `dist/<engine>/plugins/orca` + `.claude-plugin/plugin.json`, 스킬 네임스페이스 `orca:<name>` | `app/src/main/adapters/claude-plugin.ts:1-11`(주석이 "플러그인 이름 = 네임스페이스 prefix 의 SSOT 는 어댑터 포트" 를 못 박는다) · `features/extensions/claude-plugin-package.ts:1-3,14-18` · `infra/config/paths.ts:12-13` | §용어 레지스터 정합 의 (B) 행 + 식별자 배치 규칙 "renderer 에 `OrcaPlugin*`·`claudePlugin*` 을 만들지 않는다"; §비범위 "main 프로세스 변경 일체" | **유지 · 무변경** — 이 작업은 (B) 를 읽지도 쓰지도 않는다. 사용자 지적 ⑥ 이 (A) 와 (B) 를 갈랐으므로, 같은 단어를 UI 에 도입하면서도 **코드 심볼은 겹치지 않게** 규칙으로 분리한다. |
| **(r2) GLOSSARY 가 용어 SSOT** — "문서·코드·UI 라벨이 같은 개념을 다르게 부르지 않도록 한다" | `docs/GLOSSARY.md:3` · `docs/AGENTS.md` 원칙 5 | §용어 레지스터 정합 의 "산출물" 항 + §범위 7 + AC15 | **가산(신설)** — 기존 표제어를 수정하지 않고 `Plugin (3중 의미)` 을 **추가**한다. GLOSSARY 의 반대 규칙(§3 사용하지 않는 용어)에 "플러그인" 은 없으므로 금지어 정책과 충돌하지 않는다(81행의 금지어는 "**설치형** 플러그인" 이며, 그 금지 이유 = 런타임 동적 로딩 — (A)(B)(C) 어느 것도 런타임 로딩을 뜻하지 않는다). |
| **connector 당 활성 연결 1개 · 정적 descriptor** (0158 r4 사용자 결정) | `app/src/main/features/connectors/registry.ts:8-11` | §범위 3 의 "플러그인 탭 … 읽기 전용"; §설계 `PluginDetail` 의 "`connected` 표시" | **유지** — 연결 상태를 *읽기만* 한다. 연결 생성·해제는 비범위라 이 규칙에 손대지 않는다. |
| **renderer 4-layer 경계** (`features` → `shared` + 동일 feature) | `app/eslint.config.mjs:81-96` · `app/AGENTS.md:26-31` | §설계 "cross-feature 없음" 문단 | **유지** — 신규 훅이 `features/auth` 를 부르지 않고 `shared/api/ipc.ts` 를 부른다. |
| **UI 는 시각 검증으로 갈음, 순수 변환기는 테스트 동반** | `app/AGENTS.md:168` | §설계 "판정 로직을 전부 순수 `lib/` 로 내리고 `.tsx` 에는 배치만" | **유지 + 강화** — 판정을 `.ts` 로 내려 AC **17개 중 15개**를 기계 검증으로 만든다(r2 의 AC15~17 은 `rg`/`head` 로 판정). |
| **i18n 라벨은 키만 상수로 두고 렌더에서 `tr()` 해석**(0096) | `app/src/renderer/src/app/Sidebar.tsx:8-10` · `CustomizeRail.tsx:6` | §설계 `app/navItems.ts` 의 "`labelKey`", `CATALOG_TABS` descriptor | **유지** — 추출한 `SIDEBAR_NAV`·`CATALOG_TABS` 도 키만 담는다. |
| **nav 4-항목 구성**(새 대화·프로젝트·엔진 & 모델·Skills & MCP, 0083) | `docs/arch/frontend/overview.md:71` · `dom-architecture.md:45` | §범위 1 의 "페이지 라벨 '플러그인'"; §범위 5 의 `app/navItems.ts` 추출 | **개명 갱신** — 4항목 구성과 순서는 그대로, 4번째의 라벨·경로만 '플러그인'/`/plugins`. 문서 2건 동시 갱신(AC13). |
| **`/skills` 라우트**(URL/path 라우팅 전환 시 등록) | `docs/PHASES.md:32` · `shared/navigation/routes.ts:27` | §범위 1 의 "`/skills` → `/plugins`(레거시 리다이렉트 보존)" | **뒤집음(개명)** — 근거: 사용자 결정 ⑤. 저장된 딥링크 파손을 막기 위해 `LEGACY_ROUTE_REDIRECTS` 로 `replace` 리다이렉트를 남긴다(AC2). |
| **IPC 82채널·23도메인** | `docs/IPC_CONTRACT.md:5,28` | §비범위 "IPC 채널 신설·변경 0(82채널 유지)" | **유지** — 이미 있는 `orca:plugin:list`·`orca:auth:providers` 를 소비만 한다. `IPC_CONTRACT.md:228` 의 "`/skills` 화면이 단일 호출자" 문구만 경로 정합. |
| **i18n 위생 테스트**(ko↔en 키 일치·빈 값 금지·placeholder 일치) | `resources/resources.test.ts:29-51` | §i18n 변경 전체 | **유지** — `skills.view.backAria` 의 `{{section}}` 을 ko/en 양쪽에 동일하게 둔다. |
| **마이그레이션 append-only 가드** | `app/scripts/check-migrations-appendonly.mjs` | (해당 없음 — 마이그레이션 0) | **N/A** |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **로딩**: 세 데이터 소스(`useCustomizeSkills`·`useMcpServers`·`usePluginCatalog`)가 독립 비동기다. 탭 본문은 *그 탭의* 로딩만 본다 — 현행처럼 `skills.loading || mcp.loading` 으로 묶으면 무관한 탭이 함께 스피너가 된다(`SkillsCustomizeView.tsx:119` 의 현행 결함). 탭별 로딩으로 분리한다.
- **빈 상태 3종**: 스킬 0(`noSkills`) · MCP 0(`noMcp`) · 플러그인 0(`noPlugins`). **플러그인 0 은 기본 빌드의 상시 상태**이므로 오류처럼 보이지 않게 중립 문구로 쓰고, **문구는 "등록된 플러그인 패키지가 없습니다"**(우산어가 아니라 (C) 패키지를 가리킨다 — §i18n 문구 규칙).
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
| **"플러그인" 이 3중 의미로 읽힌다** — 페이지(A 우산어) ⊃ 탭(C 패키지), 그리고 코드에는 (B) `orca plugin`(Claude 플랫폼)이 이미 있다. 사용자가 r2 에서 이 혼용을 직접 지적했다(⑥). | **사용자 결정 ⑦ = UI 유지**(탭 라벨 "플러그인", 행 = 패키지). 해소는 세 갈래로: ⓐ **GLOSSARY §Plugin 표제어 신설**로 세 의미를 코드 앵커와 함께 등록(AC15) ⓑ **식별자 배치 규칙**으로 코드에서 레지스터를 분리 — (A)=라우트·페이지·nav 키, (C)=`orca:plugin:*` 미러, (B)=renderer 진입 금지, 셸은 우산-중립 `ExtensionsCatalogView`/`extensions-catalog` ⓒ **UI 문구 규칙** — 라벨은 "플러그인", 탭 본문은 "플러그인 패키지". 두 진입 파일 헤더 주석이 자기 레지스터를 선언한다(AC17). 페이지·탭 라벨 키를 분리해 두므로(`nav.plugins` vs `skills.rail.plugins`) 훗날 한쪽만 개명 가능하다. |
| **3-pane → 2-pane 전환으로 목록 단계의 스킬 on/off 토글이 사라진다**(현행 `CustomizeList` 좌측 토글, `skills.list.off`). | 토글은 상세(`SkillDetail`)에 이미 있으므로 기능 손실은 없고 클릭 1회가 늘어난다. 테이블 이름 열에서 비활성 항목을 `text-ink3` 로 흐리게 표기해 상태는 목록에서도 읽히게 한다(참조 브랜치 관례). |
| 참조 브랜치를 **부분만** 가져오므로, 나중에 그 브랜치를 머지하면 충돌한다. | 이 핸드오프는 참조 브랜치를 머지하지 않고 구조만 재구현한다. 참조 브랜치는 설계 입력으로만 인용하고 `INDEX.md`·plan 에 그 사실을 남긴다. |
| `Sidebar.tsx` 의 `NAV` 추출이 동작을 바꿀 위험. | 추출은 **이동만**(값·순서·`isActive` 술어 동일). 4항목 전부에 대해 `navItems.test.ts` 가 `path`·`isActive` 를 고정한다(AC3 은 4번째, 나머지 3개도 같은 테스트에서 회귀로 고정). |
| **(r2) 문서-코드 불일치 1건이 범위 밖에 남는다** — `GLOSSARY.md:58` 이 sources/dist 를 "구현 대기" 로 적었으나 `bootstrap.ts` 가 부팅에서 `deploy()` 를 호출한다(`:32,258,402`). | r2 는 **죽은 심볼명(`ensureOrcaPlugin`)만** 정정하고(AC16) 구현 상태 문구는 손대지 않는다 — `docs/AGENTS.md` 원칙 4(문서-코드 충돌은 설계 변경인지 문서 지연인지 사용자가 판단). **사용자 보고 항목**으로 남긴다(아래 OQ2). |

- **되돌리기 어려운 결정**: 라우트 `/plugins`, i18n 키 `nav.plugins`/`sidebar.nav.plugins`, 탭 식별자 `skills|mcp|plugins`, **(r2) UI 에 도입되는 우산어 "플러그인" 자체**. 넷 다 세션 중 사용자 확정(결정 ③④⑤⑦). 저장된 딥링크는 `LEGACY_ROUTE_REDIRECTS` 가 흡수하고, 어휘는 GLOSSARY §Plugin 등록(AC15)이 흡수한다.
- **단독 결정 금지 항목(Open Question) → 사용자에게**:
  - **OQ1** — 플러그인 탭의 상시 빈 상태를 어떻게 다룰지. ⓐ 그대로(현 설계) ⓑ 빈 상태에 "폐쇄망 배포에서 플러그인 패키지를 등록하면 여기에 표시됩니다" 안내 문구 추가 ⓒ 참조 브랜치식 절충(내장 스킬을 플러그인으로도 표시 — GLOSSARY §Connector 어휘를 UI 에서 뒤집는 비용 수반). **현 설계는 ⓐ 로 진행하며, ⓑ 는 i18n 문구 1줄 추가라 언제든 가산 가능하다.**
  - **OQ2 (r2)** — `GLOSSARY.md:58` 의 sources/dist **구현 상태 문구**("설계 채택 / 구현 대기")를 현행화할지. 코드는 이미 `deploy()` 를 부팅에서 호출한다. 문서 지연이면 GLOSSARY·`standardization.md` §5.1 스테이지 표기를 함께 고쳐야 하고, 의도적 단계 구분이면 그대로 둔다. **이 핸드오프는 판단하지 않고 심볼명만 정정한다(AC16).**

## 영향 받는 파일

**renderer (신규 8 · 수정 8 · 개명 2 · 삭제 1)**

- 신규: `shared/navigation/routes.test.ts` · `app/navItems.ts` · `app/navItems.test.ts` · `features/skills/lib/catalogSelection.ts`(+`.test.ts`) · `features/skills/lib/catalogRows.ts`(+`.test.ts`) · `features/skills/lib/pluginCatalog.ts`(+`.test.ts`) · `features/skills/hooks/usePluginCatalog.ts` · `features/skills/components/customize/PluginDetail.tsx`
- 개명: `pages/SkillsPage.tsx` → `pages/PluginsPage.tsx` · `features/skills/components/customize/SkillsCustomizeView.tsx` → `ExtensionsCatalogView.tsx` (둘 다 `git mv` 로 이력 보존)
- 수정: `app/router.tsx` · `app/Sidebar.tsx` · `shared/navigation/routes.ts` · `shared/api/ipc.ts` · `shared/i18n/resources/ko.ts` · `shared/i18n/resources/en.ts` · `features/skills/index.ts` · `features/skills/components/customize/{CustomizeRail,CustomizeList}.tsx`
- 삭제: `features/skills/components/customize/CustomizeLanding.tsx`

**docs (7 — r2 에서 GLOSSARY 추가)**

- `docs/arch/frontend/ux-domains.md`(§3 화면 표 96행 + 102·108행 주석) · `overview.md`(71·75행에 0159 개명 각주) · `layers.md`(33행 라우트 주석 + 65행 features 트리) · `dom-architecture.md`(45행 nav 4-항목 라벨) · `terms.md`(69행 라우트 화면 목록) · `docs/IPC_CONTRACT.md`(228행 "`/skills` 화면이 단일 호출자")
- **(r2)** `docs/GLOSSARY.md` — §1 에 `Plugin (3중 의미)` 표제어 **신설**(AC15) + §sources/dist(58행)의 죽은 심볼 `ensureOrcaPlugin()` → `renderClaudePluginPackage()` 정정(AC16). **다른 표제어는 수정하지 않는다.**
- 보드/이력: `docs/handoff/INDEX.md` · (verify PASS 후) `docs/PHASES.md`

**main**: 변경 없음.

## 참고 문서

- `docs/GLOSSARY.md` §Auth provider / §Connector / §Auth target (29·30·31행) — **`Plugin` 표제어는 현재 없으며 이 작업이 신설한다**(AC15). 초판이 인용한 "§Plugin" 은 실재하지 않았다.
- `docs/IPC_CONTRACT.md` §2.13-d `plugin` 도메인 (402-408행 — 제목이 "정적 connector lifecycle") · §2.13-c `auth` 도메인
- **(r2) 의미 (B) 1차 출처**: `app/src/main/adapters/claude-plugin.ts:1-11`(`ORCA_PLUGIN_NAME`) · `app/src/main/features/extensions/claude-plugin-package.ts:1-3,14-18,27,56` · `app/src/main/infra/config/paths.ts:5-16`(디렉토리 레이아웃 주석)
- **(r2) 의미 (C) 1차 출처**: `app/src/main/features/auth-platform/modules/index.ts:1-29`(`AuthPluginPackage`·`AUTH_PLUGIN_PACKAGES`) · `app/src/main/app/handlers/plugins.ts` · `app/src/shared/ipc.ts:284-293`
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
- **(r2)** 문서 게이트: `### AC13 검증 명령` + `### AC15~17 검증 명령` 블록을 그대로 실행한다(테스트 러너 밖 — verify 턴이 재실행).
- 신규 의존성 0 · 마이그레이션 0 · IPC 82채널 불변.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 2건 + 세션 확정 결정 4건 + **r2 지적 1건(⑥)** 을 출처와 함께 인용했고, 추론은 "(추론)" 으로 표기했다.
- [x] 자료조사 — **27개** 발견 전부에 `파일:라인` 또는 실행한 명령을 붙였다(r2 에서 7개 추가).
- [x] 의존 기술 — 재사용 모듈·전제 2건을 적었고, 신규 의존성 0 을 명시했다.
- [x] 파생 UX — 로딩 분리·빈 상태 3종·상세 유실·탭 전환 잔상·딥링크 히스토리·키보드/a11y·언어 전환·테마를 이 작업 기준으로 펼쳤다(예시 복붙 아님).
- [x] 리스크 — **6건** + 되돌리기 어려운 결정 4건 + OQ **2건**을 사용자 몫으로 분리했다.
- [x] **(r2) 용어 레지스터** — "플러그인" 3중 의미를 각각 코드 앵커·전수 수치·레지스터와 함께 표로 세우고, 식별자 배치 규칙 + UI 문구 규칙 + GLOSSARY 등록(AC15~17)까지 산출물로 내렸다.

**기계적으로 확인 가능한 것**

- [x] **요구 비판적 검토** **6질문**(r2 에서 "자기 인용이 실재하는가" 추가) 전부 답했고, 이견(플러그인 탭 상시 빈 상태)을 적었지만 **요구 범위를 줄이지 않았다** — 플러그인 탭을 빼거나 내장 스킬로 대체하지 않았고, r2 에서도 사용자 결정 ⑦ 에 따라 탭을 **개명하지 않았다**(어휘 해소를 UI 축소로 갈음하지 않음).
- [x] 인수 기준 **17개** 전부 `검증 수단` 이 채워져 있고, 기계 검증 불가 2건(AC8 후반부·AC11)은 "**사람 실기** — `npm run dev` → 사이드바 '플러그인' → 플러그인 탭" 으로 실행 경로까지 명시했다. r2 의 AC15~17 은 `rg`/`head` 명령이라 사람 실기가 늘지 않았다.
- [x] 부정형/"불변" 기준 **0개** — AC12("typecheck 통과")·AC13·AC14("게이트 통과")·**AC15("표제어가 세 앵커를 담는다")·AC16("실재 심볼을 인용한다")·AC17("헤더가 GLOSSARY 를 인용한다")** 모두 실행 결과에 대한 양성 단언이다. AC16 의 `ensureOrcaPlugin` 0줄 절은 AC13 과 같은 형식(명령 결과 단언)이며, 같은 AC 안에 `renderClaudePluginPackage` **1줄 이상**이라는 양성 절을 짝으로 두었다.
- [x] **AC 끼리 모순 없음** — 짝지어 훑었다. AC2(`/skills` 리다이렉트 존재)와 AC13(`docs` 에서 `/skills` 토큰 0건)은 대상이 다르다(코드 vs 문서). AC12(구 키 삭제)와 AC3/AC4(신규 키 해석)는 삭제 집합과 신설 집합이 겹치지 않는다(`skills.rail.mcp`·`skills.list.addAria` 는 유지 목록). **(r2)** AC15(GLOSSARY 에 `Plugin` 표제어 신설)와 AC16(GLOSSARY 의 `ensureOrcaPlugin` 0줄)은 같은 파일이지만 **다른 줄**을 요구하며, 신설 표제어에 `ensureOrcaPlugin` 을 쓰지 않으므로 충돌하지 않는다. AC17(파일 헤더에 `GLOSSARY` 문자열)은 §식별자 배치 규칙의 "renderer 에 (B) 식별자 금지" 와 무관하다 — 주석은 `.claude-plugin` 같은 (B) 심볼을 쓰지 않고 `§Plugin` 앵커만 쓴다. 자기 산출물 위반 없음.
- [x] 인용 수치를 이번 세션에서 직접 측정했다 — renderer 테스트 39건(`find`), 문서 route 토큰 5줄/4파일(`rg`), IPC 82채널(문서 §2 합계 재확인), `SkillsCustomizeView` 참조 2건(`grep`), `AddMcpServerModal` importer 0건(`grep`). **(r2)** 의미 (B) 10파일/54줄 · 의미 (C) 39파일/162줄 · GLOSSARY 의 `**Plugin**` 0건 · GLOSSARY 의 "플러그인" 3줄 · renderer plugin 식별자 0건(`remarkPlugins` 제외) · `ensureOrcaPlugin` 전 저장소 1건(문서). 승계한 숫자 0 — r2 는 초판 수치도 재확인만 하고 새 수치를 직접 셌다.
- [x] 신규 모듈 10개 전부 테스트 방법이 적혀 있다. electron/DB 의존 없음(renderer 전용). `usePluginCatalog`·`.tsx` 3종은 "테스트 불가" 로 두지 않고 **떼어낼 순수부**(`lib/pluginCatalog`·`lib/catalogSelection`·`lib/catalogRows`)를 설계에 명시했다.
- [x] 전수 조사 대상에 N 수치 — `/skills` 라우트 토큰 **5줄/4파일**(+라벨 인용 2파일 = 6파일), `SkillsCustomizeView` 참조 **2건**, `CustomizeTab` 참조 **8건**, renderer 테스트 **39건**, `AddMcpServerModal` importer **0건**.
- [x] 각 AC 에 프로덕션 도달 경로가 있다 — 유일한 호출자가 테스트인 AC 0개. `lib/` 3모듈은 모두 `ExtensionsCatalogView`/`CustomizeList` 가 실제로 부르고, `SIDEBAR_NAV`·`ROUTES`·`LEGACY_ROUTE_REDIRECTS` 는 `Sidebar.tsx`·`AppLayout.tsx`·`router.tsx` 가 부른다. **(r2)** AC15~17 의 "도달 경로" 는 코드 호출이 아니라 **독자** 다 — §Plugin 표제어는 이후 plan/verify 가 인용하고(초판의 오인용이 그 필요를 실증했다), 헤더 주석은 (A)/(C) 를 나란히 여는 작업자가 첫 화면에서 읽는다.
- [x] "사람 실기" AC 2건의 실행 경로(`npm run dev` → 사이드바 → 탭)가 비범위에 막혀 있지 않다 — 비범위는 연결/해제 UI·모달 전환·디렉토리 개명뿐이고, 페이지 진입 자체는 범위 안이다.
- [x] 선택적 필드 판정마다 미지정 케이스 AC 가 있다 — `SkillInfo.updatedAt?` → AC9 가 미지정/지정 두 케이스를 요구한다. `PluginConnectorInfo.connected` 는 선택 필드가 아니므로(`ipc.ts:292`) 미지정 상태가 없다(§참조 구현 커버리지 표에 명시).
- [x] 소비하는 계약의 제약 필드마다 강제 지점이 설계에 있다 — 이번 설계는 **읽기 전용**이라 강제할 제약 필드를 소비하지 않는다. `acceptedAuthProviders` 는 연결 생성 시점의 제약이고, 연결 생성은 비범위(0158 이 main 에서 이미 강제 중). 이 사실을 §범위·§비범위에 명시했다.
- [x] 참조 구현을 입력으로 썼으므로 계약의 union/enum 전수 대비 커버리지를 §참조 구현 커버리지 대조 표로 표시했다(6계약 전부 100%).
- [x] 미룬 항목 **6건** 전부 일방향 여부에 답했다(§범위 유예 표 — r2 에서 GLOSSARY 구현상태 문구·`orca:plugin:*` 도메인명 2건 추가), 그리고 일방향인 것 5건(라우트·i18n 키·탭 식별자·페이지 라벨·**우산어 도입**)은 미루지 않고 **세션 중 사용자에게 물어 확정**했다(③④⑤⑦). 어휘 등록(AC15)도 후속 핸드오프로 넘기지 않았다.
- [x] **관문 4 를 본문 완성 후 돌렸다** — §기존 결정 표 **12행**을 본문(§용어 레지스터 정합·§범위·§설계·§i18n·§파생 UX)을 훑으며 채웠고 각 행에 "본문에서 건드리는 문장" 을 적었다. 인용 경로를 실제로 열어 확인했다(초판: `connectors/registry.ts:1-15`, `auth-platform/modules/index.ts:28`, `modules/_example/index.ts`, `vitest.config.ts`, `eslint.config.mjs:81-96`, `resources.test.ts`, `Icon.tsx:3-43` / **r2 추가**: `adapters/claude-plugin.ts:1-11`, `features/extensions/claude-plugin-package.ts:1-18,27,56`, `infra/config/paths.ts:5-16`, `app/handlers/plugins.ts`, `docs/GLOSSARY.md:3,29-30,58,81`, `docs/IPC_CONTRACT.md:402-408`, `app/src/renderer/src/shared/api/ipc.ts:203-205`). 아래 `[구현자 기입]`·`[검증자 기입]` 블록이 남아 있다.
- [x] **(r2) 관문 4-2 를 다시 돌려 자기 인용을 검증했다** — 초판이 인용한 `GLOSSARY.md §Plugin` 을 실제로 열어보니 **존재하지 않았다**(`rg '\*\*Plugin\*\*' docs` = 0건, 유일 히트가 자기 인용). 이 오인용을 §요구 비판적 검토에 자기 정정 행으로 남기고, §참고 문서의 인용을 실재하는 표제어(§Auth provider·§Connector·§Auth target)로 고쳤다. **"인용한 경로가 실제로 해석되는지" 는 파일 경로뿐 아니라 문서 내부 앵커에도 적용된다** — 이 실패를 `.agents/skills/handoff-plan/references/failure-patterns.md` **P19** 로 등록하고, `SKILL.md` 관문 4-4 + 두 체크리스트에 앵커 grep 항목을 추가했다.

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
