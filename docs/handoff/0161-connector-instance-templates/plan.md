# Plan — 0161-connector-instance-templates

## 메타

| 항목 | 값 |
|---|---|
| slug | `0161-connector-instance-templates` |
| 작성자 | Claude Code |
| 일자 | 2026-08-03 |
| 매핑 | PHASES 신규 행 (Phase 3++) / PR #307 (0160 과 같은 브랜치) |
| 상태 | IMPL_DONE (Claude 직접 구현 — 환경에 Codex 부재, 사용자 지시) |
| 선행 | **0160** (IMPL_DONE `c0d1523`) — 전송 계약 4건 + Confluence 모듈. 이 핸드오프는 그 위에 **인스턴스 수명주기 계층만** 얹는다 |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| **명시 요구** | "설계를 변경하겠다. 사용자 ux로는 **플러그인에서 추가 버튼 클릭시 컨플루언스를 선택, base url, pat 혹은 id/passwd 입력**을 하도록 하겠다" | 라이브 세션 요청 (2026-08-03) |
| **명시 요구** | "**컨플루언스 플러그인이 템플릿으로 제공**되어야 할텐데 가능하겠나?" | 라이브 세션 요청 (2026-08-03) |
| **명시 결정** | 인스턴스 connector ID = **host 에서 파생** | 라이브 세션 질의 응답 (2026-08-03) |
| **명시 결정** | 인스턴스 설정 영속 = **electron-store 설정 키** | 라이브 세션 질의 응답 (2026-08-03) |
| **명시 결정** | 0160 의 **코드 레벨 서버 목록·정적 등록 경로는 유지** — 정적 + 사용자 생성 **둘 다 지원** | 라이브 세션 질의 응답 (2026-08-03) |
| 추론 의도 | "템플릿으로 제공" = Confluence 패키지가 **connector 를 찍어내는 factory 를 노출**하고, core 가 그 factory 를 템플릿 레지스트리로 들고 있다가 사용자 입력으로 인스턴스를 만든다. 코드는 여전히 빌드 타임에 있고 **설정만 런타임**이다 | `contracts/auth-plugin.ts:7-12` 런타임 동적 로딩 금지 + 사용자 문장 |
| 추론 의도 | "추가 버튼" = 0159 가 만든 플러그인 카탈로그 헤더의 기존 추가 버튼(`ExtensionsCatalogView.tsx:81` `addRef`). 현재 skills 탭에서만 메뉴를 여는 것을 plugins 탭으로 확장한다 | `ExtensionsCatalogView.tsx:32,36,81-86,143-145` |

## Context (왜)

0160 이 Confluence 를 내장 MCP 로 붙였지만 **서버 주소가 코드 레벨**이다(`modules/confluence/servers.ts`). 사내 배포가 소스를 고쳐야 하고, 사용자가 자기 서버를 붙일 수 없다. 사용자가 이 UX 를 바꾸기로 했다 — 플러그인 페이지의 추가 버튼에서 Confluence 를 고르고 주소·자격증명을 넣는다.

Confluence 쪽은 이미 준비돼 있다. `createConfluenceConnector({id,label,baseUrl,apiBasePath})`·`createConfluenceTools(id,label)`·`createConfluencePackage(servers)` 가 전부 설정을 받는 **factory** 다(0160 구현). 남은 것은 그 인자를 코드가 아니라 사용자가 주게 하는 계층이다.

목표 한 문장:

> 사용자가 플러그인 페이지에서 Confluence 템플릿을 고르고 서버 주소를 넣으면, 그 설정이 영속되어 재시작 후에도 살아 있는 connector 인스턴스가 되고, 이어서 PAT 또는 ID/비밀번호로 연결하면 그 인스턴스 전용 도구가 노출된다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 (`파일:라인` · 실측) |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당.** 0160 의 코드 레벨 모델은 "사내 IT 가 빌드를 관리한다" 를 전제하는데, 사용자는 그 전제를 버렸다. 현행으로는 신규 설치 후 **카탈로그에 아무것도 안 보이고**(`CONFLUENCE_SERVERS = []`), 소스를 고쳐야 보인다 | `modules/confluence/servers.ts:26` · `confluence-package.test.ts::"저장소 기본 서버 목록은 비어 있다"` |
| 이미 있는 것 아닌가 | **Confluence 쪽은 이미 있다.** connector·도구·REST·변환·다운로드가 전부 factory 형태다. 없는 것은 ⓐ 템플릿 레지스트리 ⓑ 인스턴스 영속 ⓒ 런타임 등록/해제 ⓓ 인스턴스 CRUD IPC ⓔ 추가 UI **5개뿐**이다 | `modules/confluence/{connector,tools,index}.ts` 의 factory 시그니처 · 아래 §자료조사 |
| 더 작은 해법이 있는가 | **있었지만 요구를 못 만족한다.** `servers.ts` 를 설정 파일(`~/.config/orca/orca.json`)에서 읽게만 해도 재빌드는 없앨 수 있다. 그러나 사용자가 요구한 것은 **UI 에서 추가**이고, 그러면 어차피 CRUD IPC·영속·런타임 등록이 필요하다. 설정 파일 안은 UI 없이 텍스트 편집을 요구해 요구 미달 | 사용자 요구 "추가 버튼 클릭시 … 입력" |
| 인용 자료가 요구를 부풀리지 않았나 | **해당 없음(N/A).** 이번 요구는 외부 자료 인용 없이 사용자 UX 결정 하나다. 0160 이 정정한 두 건(atlassian 패키지 도구 존재·connector 의 fetch 경로)은 그대로 유효하며 이번 변경이 건드리지 않는다 | `0160/plan.md §요구 비판적 검토` |
| 기존 채택 결정을 뒤집는가 | **두 건 뒤집는다.** ① 0158 "서버마다 별도 **정적** connector · 동적 endpoint 비채택"(`0158/plan.md:138`) → 사용자 생성 인스턴스가 생긴다. ② `modules/AGENTS.md` "동적 URL, alias, **endpoint 입력을 만들지 않는다**" → 만든다. 단 **정적 경로는 유지**되므로(사용자 결정) 두 모델이 공존한다 | `0158/plan.md:138,315-316` · `modules/AGENTS.md` · `connectors/registry.ts:7` |

- **사용자에게 올릴 것**(단독 결정 불가): **없음.** ID 규칙·영속 위치·정적 경로 존치 3건 모두 이번 세션에서 결정을 받았다.
- **이견(진행함, 범위 축소 없음)** 3건:
  1. **host 파생 ID 는 두 가지 문제를 안고 있고, 둘 다 설계에서 닫는다.** ⓐ 같은 host 에 컨텍스트 경로만 다른 두 인스턴스를 만들 수 없다 → **컨텍스트 경로를 ID 파생에 포함**한다(`confluence-wiki-corp-confluence`). ⓑ 주소를 고치면 ID 가 바뀌어 도구 이름·승인 키·다운로드 경로가 통째로 이동한다 → **주소는 생성 후 불변**으로 못 박고, 바꾸려면 삭제 후 재생성한다. UI 가 이를 명시한다.
  2. **인스턴스가 늘면 모델 프롬프트에 같은 도구가 N벌 실린다.** Confluence 서버 3개면 `confluence_search` 가 3개(서버 ID 로만 구분)다. 이번 범위에서 막지 않는다 — 서버가 여럿인 것이 요구이기 때문이다. 대신 도구 설명에 인스턴스 라벨을 넣어(0160 구현 그대로) 모델이 고를 수 있게 하고, §리스크에 남긴다.
  3. **사용자 입력 origin = SSRF 표면이 돌아온다.** 0160 r2 에서 사라졌던 것이 이 모델에서 되살아난다. 사내망 접근이 목적이라 private IP 는 차단하지 않고, origin 형태 강제 + redirect 동일 origin 제한으로 막는다(후자는 **0160 이 이미 구현**했고 인스턴스 descriptor 에 그대로 적용된다).

## 자료조사 (Research)

> 수치·계약은 이번 세션(2026-08-03)에 직접 측정했다. 0160 의 숫자를 승계하지 않고 다시 셌다.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `AuthRegistry` 는 **`register` 만 있고 `unregister` 가 없다.** 등록은 부팅 때 `AUTH_PLUGIN_PACKAGES` 루프 1회뿐 | `registry.ts:43` (register) · `rg 'unregister' src/main` → **0건** · `app/bootstrap.ts:192-198` |
| registry 는 **중복 `manifest.id` 를 거부**하고 `descriptor.pluginId === manifest.id` 를 강제한다 → 인스턴스마다 **고유 pluginId** 가 필요하다 | `registry.ts:77-79,127-132` |
| connector 가 **다른 패키지의 provider 를 참조하는 것은 허용**된다. 실재 검사는 `validateCrossReferences()` 라는 **별도 지연 패스**다 | `manifest.ts:164-165` · `registry.ts:210-226` |
| 인스턴스 설정을 담을 곳이 없다 — `rg 'connectorInstance' src` **0건**. binding·connection 은 **영속하지 않는다**(주석 명시) | `rg` 실측 · `features/auth-platform/bindings.ts:12-13` |
| 설정 스토어는 zod 검증 단일 객체이고, **알 수 없는 키는 기본값으로 복원**된다 — 새 키 추가는 스키마에 default 를 주면 되고 번호 붙은 마이그레이션 파일이 필요 없다 | `infra/settings-store.ts:26-49` · `infra/settings-migration.ts:17-25` `recoverKnownSettings` · `SETTINGS_VERSION = 1` |
| `CHANNELS` 실측 **82개**, `plugin` 도메인은 `list`·`connectionConnect`·`connectionDisconnect` **3개** | `node -e` 로 `CHANNELS` 블록 `'orca:` 계수 = 82 · `docs/IPC_CONTRACT.md:28,401` |
| 플러그인 카탈로그에 **추가 버튼이 이미 있다** — 현재 skills 탭에서만 메뉴를 연다(`expanded={selection.tab === 'skills' ? menuOpen : undefined}`) | `ExtensionsCatalogView.tsx:32,36,81-86,143-145` · `SkillAddMenu.tsx` |
| 0160 의 Confluence factory 3종이 그대로 템플릿 진입점이 된다 — `createConfluenceConnector(ConfluenceServerConfig)` · `createConfluenceTools(id,label)` · `createConfluencePackage(servers)` | `modules/confluence/{connector.ts,tools.ts,index.ts}` |
| broker 의 origin 강제·redirect 재검사는 **`connector.descriptor.baseUrl` 을 읽는다** — 인스턴스 descriptor 에 사용자 origin 이 들어가면 **0160 구현이 코드 변경 없이 그대로 적용**된다 | `broker.ts:272` (`allowedOrigins: [descriptor.baseUrl]`) · `broker.ts` redirect 루프 |
| manifest `OriginSchema` 는 경로·쿼리 없는 http(s) origin 만 통과한다 — 사용자 입력 검증에 **같은 스키마를 재사용**할 수 있다 | `manifest.ts:22-29` |
| `PLUGIN_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`, 최대 128자 — host 파생 ID 가 이 형태를 만족해야 한다 | `shared/protocol.ts:260-261` |
| `PluginHost` 는 connector 당 활성 연결 1개를 `activeByConnector` Map 으로 강제하고 `disconnect(connectorId)` 를 제공한다 — 인스턴스 삭제 전 정리 경로가 이미 있다 | `plugin-host.ts:70,151-157` |
| 0160 의 `ConnectorConnectModal`·`useConnectorConnect`·`connectorConnect.ts` 가 인증 단계를 이미 담당한다 — 이번엔 그 **앞에 서버 생성 단계**만 붙인다 | `features/skills/{components/customize/ConnectorConnectModal.tsx,hooks/useConnectorConnect.ts,lib/connectorConnect.ts}` |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 (`파일::케이스` 또는 "사람 실기 — 실행 경로") | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | host 파생 ID 는 `<templateId>-<host>` 형태이며 `.`·`:` 를 `-` 로 바꾸고 소문자로 정규화해 `PLUGIN_ID_PATTERN` 을 만족한다 | `features/connectors/instance-id.test.ts::"host 에서 케밥 ID 를 만든다"` · `::"포트·대문자·언더스코어를 정규화한다"` | 인스턴스 생성 IPC → `deriveConnectorId` |
| 2 | 컨텍스트 경로가 있으면 ID 에 포함되어, 같은 host 의 서로 다른 경로가 **다른 ID** 를 갖는다 | `features/connectors/instance-id.test.ts::"컨텍스트 경로를 ID 에 포함한다"` | 인스턴스 생성 → `deriveConnectorId` |
| 3 | 같은 host·경로로 두 번 생성하면 두 번째가 `already_exists` 로 거부되고 기존 인스턴스와 그 연결이 그대로 남는다 | `features/connectors/instance-store.test.ts::"중복 인스턴스를 거부하고 기존 것을 보존한다"` | `pluginInstanceCreate` → `ConnectorInstanceStore.create` |
| 4 | 인스턴스 생성 요청의 `baseUrl` 은 경로·쿼리·fragment·URL 자격증명·비 http(s) 스킴을 스키마 단계에서 거부한다 | `shared/protocol.plugins.test.ts::"인스턴스 baseUrl 은 origin 형태만 받는다"` | preload → `handle(CHANNELS.pluginInstanceCreate, …, 'reject')` |
| 5 | 생성된 인스턴스 설정이 electron-store 에 영속되어 **재시작 후 같은 connectorId·baseUrl 로 복원**된다 | `features/connectors/instance-store.test.ts::"저장한 인스턴스를 새 스토어에서 읽는다"` · `infra/settings-store.test.ts::"connectorInstances 기본값은 빈 배열이다"` | `SettingsStore` → `Bootstrap.createAuthPlatform` 복원 루프 |
| 6 | 설정 파일에 깨진 인스턴스 항목이 있어도 **부팅이 막히지 않고** 정상 항목만 복원된다 | `features/connectors/instance-store.test.ts::"깨진 항목을 버리고 정상 항목을 살린다"` | `SettingsStore.load` → `ConnectorInstanceStore.list` |
| 7 | `AuthRegistry.unregister(pluginId)` 는 그 패키지의 provider·connector·runtime tool·manifest 를 모두 제거하고, **다른 패키지의 기여는 남긴다** | `auth-platform/registry.test.ts::"패키지 기여를 전부 제거한다"` · `::"다른 패키지 기여를 남긴다"` | `pluginInstanceDelete` → `AuthRegistry.unregister` |
| 8 | 제거 후 같은 pluginId 로 다시 등록할 수 있다(중복 거부에 걸리지 않는다) | `auth-platform/registry.test.ts::"제거한 pluginId 를 재등록할 수 있다"` | 인스턴스 삭제 → 재생성 |
| 9 | 템플릿 레지스트리는 등록된 템플릿 목록을 `{templateId, label, fields}` 로 반환하고, Confluence 템플릿이 그 안에 있다 | `features/connectors/templates.test.ts::"Confluence 템플릿을 노출한다"` | `pluginTemplateList` → `handlers/plugins.ts` |
| 10 | 템플릿이 인스턴스 설정을 받아 **연결 가능한 패키지**를 만들고, 그 패키지가 `AuthRegistry.register` 를 통과한다(선언·구현 1:1, ABI, cross-reference 전부) | `features/connectors/templates.test.ts::"인스턴스 패키지가 등록 위생을 통과한다"` | `pluginInstanceCreate` → `template.build` → `AuthRegistry.register` |
| 11 | 인스턴스 패키지의 connector 는 사용자가 입력한 origin 을 `descriptor.baseUrl` 로 갖고, 그 값이 broker 의 allowlist 로 쓰인다 | `features/connectors/templates.test.ts::"사용자 origin 이 descriptor 에 실린다"` · `auth-platform/broker.test.ts::"연결 origin 밖 요청을 거부한다"` | 도구 호출 → `AuthBroker.authenticatedFetch` → `checkOutboundRequest` |
| 12 | 인증 provider 는 **템플릿 패키지에 한 번만** 등록되고 인스턴스가 몇 개든 재등록되지 않는다 | `features/connectors/templates.test.ts::"provider 를 인스턴스마다 중복 등록하지 않는다"` | 부팅 등록 순서 → `AuthRegistry` |
| 13 | 인스턴스 생성 직후 그 connector 가 `plugins.list` 에 나타나고 `connected:false` 다 | `auth-platform/plugin-host.test.ts::"런타임 등록된 connector 를 목록에 낸다"` | `pluginInstanceCreate` → `pluginList` |
| 14 | 인스턴스를 삭제하면 활성 연결이 먼저 정리되고, 그 connector 의 runtime 도구 서버가 제거되며, 목록에서 사라진다 | `auth-platform/plugin-host.test.ts::"삭제 전 연결과 도구를 회수한다"` · `features/connectors/instance-store.test.ts::"삭제가 영속 목록에서 지운다"` | `pluginInstanceDelete` → `PluginHost.disconnect` → `AuthRegistry.unregister` |
| 15 | 정적 connector(`servers.ts` 경로)는 삭제 요청을 **거부**하고 그대로 남는다 — 사용자 생성 인스턴스만 삭제된다 | `features/connectors/instance-store.test.ts::"정적 connector 삭제를 거부한다"` | `pluginInstanceDelete` → origin 판별 |
| 16 | `plugins.list` DTO 가 `source: 'static' \| 'instance'` 를 포함하고, secret·credential presentation·raw binding 은 포함하지 않는다 | `shared/protocol.plugins.test.ts::"list DTO 에 source 만 추가된다"` | `pluginList` → `parsePluginListResponse` → renderer |
| 17 | 신규 IPC 3채널(`pluginTemplateList`·`pluginInstanceCreate`·`pluginInstanceDelete`)이 무효 payload 를 거부한다 | `shared/protocol.plugins.test.ts::"인스턴스 IPC payload 를 검증한다"` | preload `window.api.plugins.*` → `handlers/plugins.ts` |
| 18 | `docs/IPC_CONTRACT.md` 헤더 총계·도메인별 합·`CHANNELS` 실측이 모두 **85** 로 일치한다 | `shared/ipc-documentation.test.ts::"keeps the header, domain summary, and CHANNELS count at 85"` | shared IPC 계약 → preload/main handler |
| 19 | 추가 흐름의 순수 로직이 템플릿 선택 → 주소 입력 → 인증 방식 선택의 단계 전이를 만들고, 각 단계의 검증 실패를 사유로 낸다 | `renderer/features/skills/lib/connectorInstance.test.ts::"단계 전이를 만든다"` · `::"잘못된 주소를 사유로 낸다"` · `::"중복 생성 실패를 사유로 분류한다"` | `ConnectorInstanceModal` → `buildInstanceSteps` |
| 20 | 주소 입력이 사용자가 붙여넣은 전체 URL(`https://wiki.corp/confluence/display/X`)에서 origin 과 컨텍스트 경로를 분리해 제안하고, 사용자가 확인한 값만 전송한다 | `renderer/features/skills/lib/connectorInstance.test.ts::"붙여넣은 URL 에서 origin 과 경로를 분리한다"` | 모달 입력 → `splitPastedUrl` |
| 21 | 사용자가 플러그인 페이지 추가 버튼 → Confluence → 사내 주소 → PAT 입력으로 서버를 만들고 연결하면 카탈로그에 "연결됨" 이 뜨고, 앱을 재시작해도 그 서버가 목록에 남는다 | **사람 실기** — `cd app && npm run dev` → 사이드바 플러그인 → 추가 → Confluence → 주소·PAT 입력 → 상태 확인 → 앱 재시작 → 목록 확인 (사내 Confluence DC 서버 필요) | `ExtensionsCatalogView` 추가 버튼 → `ConnectorInstanceModal` → `pluginInstanceCreate` → 재시작 복원 |
| 22 | ID/비밀번호로도 같은 흐름이 성립하고, 새 대화에서 그 인스턴스의 `confluence_search` 가 노출된다 | **사람 실기** — AC21 과 같은 경로에서 인증 방식만 ID/비밀번호 선택 → 새 세션에서 도구 호출 | 인스턴스 연결 → 다음 턴 respawn → SDK `mcpServers` |
| 23 | lint 0 error, typecheck 3분할 0, 수집된 vitest 전체 pass, DB migration diff 0, **신규 런타임 의존성 0개** | `npm run lint` · `npm run typecheck` · `npm test` · `git diff package.json` | 저장소 전체 |

> better-sqlite3 ABI·electron 바이너리 관련 실패는 `app/AGENTS.md` 의 알려진 egress 베이스라인이며 코드 회귀와 분리해 보고한다.

## 범위 / 비범위

- **범위**:
  - `ConnectorTemplate` 계약 + 템플릿 레지스트리(빌드 타임 등록, Confluence 가 첫 템플릿)
  - host+컨텍스트 경로 파생 ID (`deriveConnectorId`) — 순수 함수
  - `ConnectorInstanceStore` — electron-store `connectorInstances` 키 영속 + 복원 + 깨진 항목 격리
  - `AuthRegistry.unregister(pluginId)` + 재등록 허용
  - 부팅 시 저장된 인스턴스 복원, 생성 시 런타임 등록, 삭제 시 연결 정리 후 해제
  - IPC 3채널(`pluginTemplateList`·`pluginInstanceCreate`·`pluginInstanceDelete`) + preload + DTO `source`
  - 추가 UI — 플러그인 탭 추가 버튼 → 템플릿 선택 → 주소 입력 → (0160 의 인증 모달로 연결) + i18n(ko/en)
  - 문서: `IPC_CONTRACT.md`(82→85) · `modules/AGENTS.md`(동적 endpoint 금지 문구 개정) · `modules/confluence/AGENTS.md` · `connectors/registry.ts` 헤더 주석
- **비범위**:
  - 인스턴스 **주소 수정**(불변 — 삭제 후 재생성). 라벨 수정도 이번엔 없음
  - Confluence 외 템플릿(Jira 등) — 계약은 열어두되 구현은 후속
  - connection·binding 영속화(인스턴스 *설정*만 영속, 인증은 여전히 재시작 시 재연결)
  - 인스턴스별 도구 on/off, 도구 이름 사용자 지정
  - 인스턴스 간 설정 복사·내보내기/가져오기

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 주소 수정 | **아니오 — 그리고 의도적 비채택이다.** ID 가 주소에서 파생되므로 주소 수정은 곧 ID 변경이고, 그건 도구 이름·승인 키·다운로드 경로를 이동시킨다. "삭제 후 재생성" 이 그 사실을 사용자에게 정직하게 드러낸다 |
| 라벨 수정 | **아니오.** 라벨은 ID 에서 분리돼 있어 나중에 `instanceUpdate` 한 채널로 붙는다 |
| 다른 템플릿(Jira) | **아니오.** `ConnectorTemplate` 계약이 이번에 생기므로 추가는 배열 한 줄 + factory 다 |
| binding 영속화 | **아니오.** 현행 인증 동작(재시작 시 재인증)을 승계하며, 키는 이번에 고정하는 `connectorId` 를 그대로 쓴다 |
| **ID 파생 규칙·`connectorInstances` 설정 키 이름·IPC 채널 이름** | **예 — 일방향이다.** ID 는 승인 키·대화 기록·디스크 경로에, 설정 키는 사용자 설정 파일에, 채널 이름은 preload 계약에 남는다. **미루지 않고 이번에 확정**한다 |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **신규 의존성 0개.** 전부 기존 채택분 — `zod`(스키마)·`electron-store`(설정, 이미 `SettingsStore` 가 사용)·0160 이 도입한 cheerio/turndown 은 이번 변경과 무관하게 그대로.
- 전제:
  - 0160 이 머지 전이라도 같은 브랜치 위에 쌓는다 — 0160 의 factory·계약을 그대로 소비한다.
  - 인스턴스 **설정**만 영속하고 **비밀은 기존대로 safeStorage vault** 에 남는다. 설정 파일에는 origin·라벨 등 비밀 아닌 값만 들어간다.
  - `SettingsSchema` 에 키를 **추가**하는 것은 기존 `recoverKnownSettings` 가 기본값으로 흡수하므로 번호 붙은 마이그레이션이 필요 없다(`settings-migration.ts:17-25`).
  - 사내망 접근이 목적이므로 private IP·loopback 을 차단하지 않는다.

## 설계

### 계층 그림

```text
빌드 타임
  ConnectorTemplate (features/connectors/templates.ts)
    id: 'confluence' · label · fields[baseUrl, apiBasePath?]
    build(instance) → AuthPluginPackage        ← 0160 의 createConfluence* factory 재사용
    │
    ├─ 템플릿 패키지 (`confluence`)  : providers 2개만. 부팅 때 항상 1회 등록
    └─ 인스턴스 패키지 (`confluence-wiki-corp`) : connector 1 + runtimeTools 1

영속 (electron-store `connectorInstances`)
  [{ connectorId, templateId, label, baseUrl, apiBasePath }]
    │
    ▼ 부팅: Bootstrap 이 템플릿 패키지 → 정적 패키지 → 저장된 인스턴스 순으로 register
    ▼ 생성: pluginInstanceCreate → 검증 → 저장 → register → runtime 도구는 연결 후에 붙는다
    ▼ 삭제: pluginInstanceDelete → PluginHost.disconnect → AuthRegistry.unregister → 저장소 제거

renderer
  플러그인 탭 [추가] → 템플릿 선택 → 주소 입력 → (인스턴스 생성)
                                            → 0160 의 ConnectorConnectModal 로 인증
```

### ID 파생 — 일방향 문을 여기서 닫는다

```ts
deriveConnectorId('confluence', 'https://Wiki.Corp:8443', '/confluence')
//                → 'confluence-wiki-corp-8443-confluence'
```

- host 를 소문자화하고 `.`·`:` 를 `-` 로, 그 외 비허용 문자를 `-` 로 접는다. 연속 `-` 는 하나로, 양끝 `-` 는 제거한다 → `PLUGIN_ID_PATTERN` 만족.
- **컨텍스트 경로를 포함**한다(사용자 질의에서 지적한 충돌 문제). 경로의 `/` 도 `-` 로 접는다.
- 128자 초과는 잘라낸다(`PLUGIN_ID_MAX_LENGTH`).
- **주소는 생성 후 불변.** ID 가 주소에서 나오므로 주소를 고치면 도구 이름·승인 키·다운로드 경로가 통째로 옮겨간다. 수정 대신 삭제 후 재생성이며 UI 가 그렇게 안내한다.
- 같은 파생 ID 가 이미 있으면 `already_exists` 로 거부한다 — 접미사를 붙여 조용히 두 개를 만들지 않는다(같은 서버를 두 번 등록할 이유가 없고, 붙이면 ID 가 주소에서 파생된다는 성질이 깨진다).

### 템플릿 계약

```ts
export interface ConnectorTemplateField {
  name: 'baseUrl' | 'apiBasePath' | 'label'
  label: string
  required: boolean
  placeholder?: string
}

export interface ConnectorInstanceConfig {
  connectorId: string      // 파생값 — 사용자 입력 아님
  templateId: string
  label: string
  baseUrl: string
  apiBasePath?: string
}

export interface ConnectorTemplate {
  readonly id: string
  readonly label: string
  readonly fields: readonly ConnectorTemplateField[]
  // 템플릿이 한 번만 등록하는 공용 기여(주로 auth provider).
  sharedPackage(): AuthPluginPackage
  // 인스턴스 하나가 등록할 패키지 — connector + runtime tools.
  instancePackage(config: ConnectorInstanceConfig): AuthPluginPackage
}
```

Confluence 템플릿은 0160 의 factory 를 그대로 감싼다 — `sharedPackage()` 는 provider 2개, `instancePackage()` 는 `createConfluenceConnector`·`createConfluenceTools` 결과다. `createConfluencePackage(servers)`(정적 경로)는 **그대로 남는다**(사용자 결정: 둘 다 지원).

**provider 를 인스턴스마다 등록하지 않는 것이 중요하다** — registry 가 중복 provider id 를 거부하므로(`registry.ts:135-138`) 두 번째 인스턴스 등록이 통째로 실패한다(AC12 가 이것을 고정).

### 신규 모듈

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `features/connectors/instance-id.ts` | host+경로 → connector ID 파생 | connectors | **순수 단위** |
| `features/connectors/templates.ts` | `ConnectorTemplate` 계약 + 레지스트리(배열) | connectors | 순수 단위 + 등록 위생 통합 |
| `features/connectors/instance-store.ts` | 인스턴스 CRUD·중복 거부·깨진 항목 격리. 영속은 **주입된 포트**(`{read(), write()}`)로 — electron-store 를 직접 import 하지 않아 순수 테스트 가능 | connectors | 인메모리 포트 주입 단위 테스트 |
| `features/connectors/instance-lifecycle.ts` | 생성/삭제 오케스트레이션 — store ↔ registry ↔ PluginHost 를 **구조적 포트**로 받는다(교차 feature 회피) | connectors | fake 3종 주입 단위 테스트 |
| `app/handlers/plugins.ts` (수정) | 신규 3채널 인자 전달 | app | 로직은 protocol + lifecycle 에서, handler 는 typecheck |
| `renderer/features/skills/lib/connectorInstance.ts` | 단계 전이·붙여넣은 URL 분리·실패 분류 | renderer features | **순수 단위** |
| `renderer/features/skills/components/customize/ConnectorInstanceModal.tsx` | 템플릿 선택 + 주소 입력 모달 | renderer features | 시각 = 사람 실기(AC21) |

`features/connectors` 에 두는 이유: 인스턴스는 **연결 대상의 정체**이고, 그 슬라이스가 이미 connection 수명주기를 소유한다(`connectors/registry.ts` 헤더). `auth-platform` 은 인증이 관심사이므로 `AuthRegistry`·`PluginHost` 는 **구조적 포트**로 받는다(feature 교차 금지).

### 붙여넣기 흡수 (파생 UX 이지만 설계에 넣는 이유)

사용자는 브라우저 주소창의 전체 URL(`https://wiki.corp/confluence/display/ENG/Page`)을 붙여넣는다. 이걸 그대로 받으면 `OriginSchema` 가 거부하고 사용자는 이유를 모른다. `splitPastedUrl` 이 origin 과 첫 경로 세그먼트를 분리해 **제안**하고, 사용자가 확인한 값만 전송한다(자동 확정하지 않는다 — `/display` 를 컨텍스트 경로로 오인할 수 있다).

### TDD 구현 순서

1. `instance-id` (순수) → `instance-store`(포트 주입) → `templates`(등록 위생)
2. `AuthRegistry.unregister` + 재등록
3. `instance-lifecycle`(생성·삭제 오케스트레이션) + `PluginHost` 목록/정리 연동
4. 설정 스키마 키 + 부팅 복원 배선
5. IPC 3채널 + preload + DTO `source`
6. renderer lib → 모달 → 추가 버튼 배선 → i18n
7. 문서(IPC 85·AGENTS 3종) + 전체 게이트

## 기존 결정·규칙과의 관계

> 본문(§설계·§파생 UX·§범위)을 다 쓴 뒤 본문을 훑으며 채웠다.

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **서버마다 별도 정적 connector · 동적 endpoint 비채택** | `0158/plan.md:138,315-316` | §계층 그림 "저장된 인스턴스 순으로 register" · §ID 파생 | **뒤집음.** 사용자가 UI 에서 서버를 만든다. 단 정적 경로는 **함께 유지**(사용자 결정)되어 두 모델이 공존한다 |
| "동적 URL, alias, endpoint 입력을 만들지 않는다" | `modules/AGENTS.md` (0160 갱신분) | §템플릿 계약 `fields[baseUrl]` | **뒤집음.** 문구를 "정적 connector 는 …, 템플릿 인스턴스는 사용자 origin 을 받되 생성 후 불변" 으로 개정 |
| "connector = 이 Confluence 서버를 부를 수 있는 코드(origin 고정)" | `connectors/registry.ts:7` 코드 주석 | §계층 그림의 인스턴스 패키지 | **뒤집음.** 주석을 정적/인스턴스 두 출처로 개정 |
| connector 당 활성 연결 1개 | `0158/plan.md:35` · `plugin-host.ts:70` | §계층 그림 삭제 경로 "PluginHost.disconnect" | **유지.** 인스턴스도 connector 하나이므로 규칙이 그대로 적용된다 |
| 안정적 도구 ID — 재인증해도 이름이 같다 | `0158/plan.md:318` | §ID 파생 "주소는 생성 후 불변" | **유지·강화.** 주소 수정을 막아 ID 표류를 원천 차단한다 |
| **런타임 동적 로딩 금지 — 빌드 타임 플러그인** | `contracts/auth-plugin.ts:7-12` | §템플릿 계약(전부 빌드 타임 코드) · §계층 그림 "빌드 타임" | **유지.** 런타임에 오는 것은 **설정**뿐이고 코드는 컴파일 타임에 있다. 임의 경로 `import()` 0건 |
| ABI additive-optional-only | `contracts/auth-plugin.ts:14-18` | §설계 전반 | **유지.** `ConnectorTemplate` 은 신규 계약이고 기존 계약은 손대지 않는다. DTO `source` 는 필드 추가 |
| package 단위 all-or-nothing · 중복 pluginId 거부 | `registry.ts:77-79` | §템플릿 계약 "인스턴스마다 고유 pluginId" | **유지.** 인스턴스 ID 를 pluginId 로 써 규칙을 만족한다 |
| 중복 provider id 거부 | `registry.ts:135-138` | §템플릿 계약 "provider 를 인스턴스마다 등록하지 않는다" | **유지.** shared/instance 패키지 분리가 이 규칙을 지키려는 설계다 |
| cross-package provider 참조 허용 | `manifest.ts:164-165` · `registry.ts:210-226` | §템플릿 계약 인스턴스 패키지가 템플릿 provider 참조 | **유지·활용.** 이 허용이 없으면 분리가 성립하지 않는다 |
| opt-in 배열 등록 — 기본 빈 배열 | `modules/AGENTS.md` · `modules/index.ts:28` | §범위 "정적 경로 유지" | **유지.** 정적 등록은 그대로, 인스턴스는 별도 경로 |
| 설정은 zod 검증 단일 객체, 깨진 값은 기본값 복원 | `settings-store.ts:26-49` · `settings-migration.ts:17-25` | AC6 "깨진 항목을 버리고 정상 항목을 살린다" | **유지·확장.** 항목 단위 격리를 인스턴스 배열 안에서 한 겹 더 한다 |
| 마이그레이션 append-only 가드 | `scripts/check-migrations-appendonly.mjs` | §의존 기술 "번호 붙은 마이그레이션이 필요 없다" | **유지.** DB 마이그레이션 0건(설정 스토어는 별개) |
| main DAG — feature 교차 import 금지 | `eslint.config.mjs` · `src/main/AGENTS.md` | §신규 모듈 "구조적 포트로 받는다" | **유지.** `features/connectors` → `auth-platform` 직접 import 0 |
| secret 은 vault 에만 | `modules/AGENTS.md` · AUTH-PLAT-008 | §의존 기술 "설정 파일에는 비밀 아닌 값만" | **유지** |
| IPC 변경 시 문서 동시 갱신 | `docs/AGENTS.md` · `IPC_CONTRACT.md §6` | AC18 · §범위 문서 | **유지.** 82→85 |
| 모달 닫기는 Esc·백드롭 (X 미배치) | 0121 결정 · `Modal.tsx:37` | §신규 모듈 모달 | **유지** |
| i18n ko/en 양쪽 채움 | `resources.test.ts` | §범위 i18n | **유지** |
| `Plugin` 어휘 3레지스터 | `docs/GLOSSARY.md:31` (2026-08-03 `rg` 확인) | §Context "Confluence 패키지" = 레지스터 (C) | **유지.** 신규어 **connector 인스턴스**는 GLOSSARY 에 항목 추가 |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **전체 URL 붙여넣기**: origin + 컨텍스트 경로 제안, 사용자 확인 후 전송(§붙여넣기 흡수).
- **같은 서버 두 번 추가**: `already_exists` 로 거부하고 기존 인스턴스를 목록에서 강조한다.
- **주소를 잘못 넣었다**: 수정이 불가하므로 삭제 후 다시 추가한다 — 모달이 생성 전에 "주소는 나중에 바꿀 수 없습니다" 를 표시한다.
- **인스턴스 생성은 됐는데 인증 실패**: 인스턴스는 남는다(저장된 서버). 카탈로그에서 다시 연결하면 된다 — 생성과 연결은 별개 단계다.
- **연결된 인스턴스 삭제**: 연결을 먼저 끊고(binding logout → 도구 회수) 등록 해제 후 저장소에서 지운다. 순서가 뒤집히면 도구가 살아남는다.
- **정적 connector 삭제 시도**: 거부하고 사유를 표시한다(코드로 배포된 서버).
- **설정 파일 수동 편집**: 앱 실행 중 편집은 반영되지 않는다(`settings-store.ts:5-7` 의 기존 트레이드오프 승계). 재시작 시 반영되며 깨진 항목은 버려진다.
- **인스턴스가 여러 개일 때 도구**: 서버마다 도구 3종이 별도 서버 ID 로 노출된다. 설명에 인스턴스 라벨이 들어가 모델이 고를 수 있다.
- **앱 재시작**: 인스턴스는 살아남고 **인증은 사라진다**(binding 비영속). 카탈로그는 "연결되지 않음" 으로 보인다.
- **빈 상태**: 템플릿은 있는데 인스턴스가 0개면 카탈로그가 비고, 추가 버튼이 유일한 진입점이다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **사용자 입력 origin = SSRF 표면**(0160 r2 에서 사라졌다가 복귀) | 사내망 접근이 목적이라 private IP 를 차단하지 않는다. ⓐ origin 형태 강제(경로·쿼리·자격증명·비 http(s) 거부) ⓑ redirect 는 인스턴스 origin 안으로만(0160 구현이 그대로 적용) ⓒ 주소를 카탈로그에 항상 표시해 사용자가 확인 가능 |
| **ID 가 주소에서 파생돼 주소 수정이 불가능하다** | 의도적 비채택으로 문서화. 수정 대신 삭제 후 재생성이며 모달이 사전 고지한다. 대안(자동 UUID)은 사용자가 명시 거부 |
| `AuthRegistry` 에 제거 경로를 처음 만든다 — 부분 제거로 registry 가 반쪽 상태가 될 수 있다 | `unregister` 를 **manifest·provider·connector·runtimeTool 4곳 일괄**로 만들고, 다른 패키지 기여 보존을 AC7 로 고정. 제거 후 재등록 가능성을 AC8 로 별도 고정 |
| 인스턴스가 늘면 프롬프트에 같은 도구가 N벌 실린다 | 이번 범위에서 막지 않는다(서버 여럿이 요구). 도구 설명의 인스턴스 라벨로 구분. 필요해지면 인스턴스별 도구 on/off 를 후속으로 |
| 설정 파일이 사용자 편집 가능해 잘못된 origin 이 들어올 수 있다 | 읽을 때마다 zod 검증 + 항목 단위 격리(AC6). 부팅을 막지 않고 깨진 항목만 버린다 |
| 정적·인스턴스 두 경로가 공존해 "이 connector 는 어디서 왔나" 가 흐려진다 | DTO 에 `source` 를 넣어 UI 가 구분하고, 삭제 가능 여부를 그 값으로 판정한다(AC15·16) |
| 0160 이 아직 verify 전인데 그 위에 쌓는다 | 같은 브랜치·같은 PR 로 간다. 0160 의 AC 는 이번 변경으로 깨지지 않는다(정적 경로 유지) — 0160 스위트 전량 통과를 게이트에 포함 |

- **되돌리기 어려운 결정**: ① `deriveConnectorId` 규칙 ② 설정 키 `connectorInstances` ③ IPC 채널 3개 이름 ④ 주소 불변 정책. 전부 이번에 확정하고 §범위 유예표에 근거를 남겼다.
- **단독 결정 금지 항목(Open Question)** → 사용자에게: **없음**.

## 영향 받는 파일

**신규**

- `app/src/main/features/connectors/{instance-id,templates,instance-store,instance-lifecycle}.ts` + 각 `.test.ts`
- `app/src/renderer/src/features/skills/lib/connectorInstance.ts` + `.test.ts`
- `app/src/renderer/src/features/skills/components/customize/ConnectorInstanceModal.tsx`
- `docs/handoff/0161-connector-instance-templates/plan.md` (본 문서)

**수정**

- `app/src/main/features/auth-platform/registry.ts` + `.test.ts` (`unregister`)
- `app/src/main/features/auth-platform/plugin-host.ts` + `.test.ts` (런타임 등록 connector 목록·정리)
- `app/src/main/features/connectors/registry.ts` (헤더 주석)
- `app/src/main/features/auth-platform/modules/confluence/index.ts` (템플릿 export 추가 — 정적 경로 유지)
- `app/src/main/features/auth-platform/modules/{AGENTS.md,confluence/AGENTS.md}`
- `app/src/main/app/{bootstrap.ts,handlers/plugins.ts}`
- `app/src/main/infra/settings-store.ts` (+ `.test.ts`)
- `app/src/shared/{ipc.ts,protocol.ts}` + `protocol.plugins.test.ts` + `ipc-documentation.test.ts`
- `app/src/preload/index.ts`
- `app/src/renderer/src/shared/api/ipc.ts`
- `app/src/renderer/src/features/skills/components/customize/{ExtensionsCatalogView,PluginDetail}.tsx`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md` · `docs/GLOSSARY.md` · `docs/handoff/INDEX.md` · `docs/PHASES.md`

## 참고 문서

- `docs/handoff/0160-confluence-connector-plugin/plan.md` — 전송 계약 4건 + Confluence factory (이 핸드오프의 토대)
- `docs/handoff/0158-builtin-tool-plugin-host/plan.md` — 정적 connector 결정(이번에 부분 반전) · 런타임 도구 계약
- `docs/handoff/0157-auth-plugin-platform/plan.md` — registry·binding·broker 계약
- `docs/handoff/0159-plugins-page-catalog/plan.md` — 카탈로그 화면·추가 버튼
- `docs/IPC_CONTRACT.md §6` — IPC 변경 절차
- `app/src/main/AGENTS.md` — main DAG·feature 교차 금지

## 게이트

- 단계별: `cd app && ./node_modules/.bin/vitest run <changed-test-files>`
- 전체: `cd app && npm run lint && npm run typecheck && npm test`
- 위생: IPC 총계 **85** · **0160 스위트 전량 통과**(정적 경로 무회귀) · migration diff 0 · 신규 의존성 0 · core 의 confluence 리터럴은 `modules/confluence/` 밖 0

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 2건 + 결정 3건을 출처와 함께 인용하고, "템플릿" 해석을 추론으로 표기했다.
- [x] 자료조사 — 14개 발견 전부에 `파일:라인` 또는 실행한 명령을 붙였다.
- [x] 의존 기술 — **신규 의존성 0개**임을 명시하고 설정 스키마 확장이 마이그레이션을 요구하지 않는 근거를 달았다.
- [x] 파생 UX — 붙여넣기·중복·오타 주소·생성 후 인증 실패·연결된 인스턴스 삭제·정적 삭제 시도·수동 편집·다중 인스턴스 도구·재시작·빈 상태를 펼쳤다.
- [x] 리스크 — SSRF 복귀·주소 불변·최초 제거 경로·프롬프트 팽창·설정 오염·출처 혼동·선행 미검증을 적고 Open Question 0건을 확인했다.

**기계적으로 확인 가능한 것**

- [x] 요구 비판적 검토 5질문에 답했고 요구 범위를 줄이지 않았다 — 추가 버튼·템플릿·주소 입력·두 인증 방식이 전부 범위 안이다.
- [x] 인수 기준 **23개** 모두 `검증 수단` 이 채워져 있다. 기계 검증 불가 2건(AC21·22)은 "**사람 실기**" 로 명시하고 실행 경로를 적었다.
- [x] 부정형/"불변" 기준 0개 — 거부 기준(AC3·4·15)도 "거부하고 기존 것을 보존한다"·"그대로 남는다" 는 **양성 단언**으로 썼다.
- [x] AC 간 모순을 pairwise 점검했다: AC15(정적 삭제 거부) ↔ AC14(인스턴스 삭제)는 `source` 로 배타적이고, AC12(provider 1회 등록) ↔ AC10(인스턴스 패키지 등록 위생)은 shared/instance 분리로 양립하며, AC5(영속) ↔ AC6(깨진 항목 격리)는 같은 로드 경로의 정상/이상 분기다. AC23 의 "신규 의존성 0" 은 §의존 기술과 일치한다.
- [x] 인용 수치를 이번 세션에서 직접 측정했다 — CHANNELS 82, plugin 도메인 3, `unregister` 0건, `connectorInstance` 0건, `SETTINGS_VERSION = 1`, `PLUGIN_ID_MAX_LENGTH` 128.
- [x] 신규 모듈 7종마다 테스트 방법이 있고, electron 의존부(`electron-store`)는 **주입 포트**로 떼어 순수 테스트가 되게 설계했다.
- [x] 전수 조사 수치가 있다: `unregister` 0 · `connectorInstance` 0 · CHANNELS 82 · plugin 채널 3 · Confluence factory 3.
- [x] 각 AC 에 프로덕션 도달 경로가 있다. 유일한 호출자가 테스트인 AC 0개 — AC13·14 는 `PluginHost` 를 IPC 경로로 잇는 것이 요구 자체다.
- [x] "사람 실기" AC 2건에 실행 경로가 있고, 그 경로가 자기 비범위에 막혀 있지 않다 — 템플릿·모달·IPC·복원이 전부 범위 안이고 외부 자원(사내 서버)만 필요하다.
- [x] 선택적 필드로 판정하는 곳마다 미지정 케이스 AC 가 있다: `apiBasePath` 미지정 → AC2(경로 없으면 host 만으로 ID), DTO `source` → AC16, 저장 항목 결손 → AC6.
- [x] 소비하는 계약의 제약 필드마다 강제 지점이 있다: `baseUrl` 형태는 IPC 스키마, 중복 ID 는 store, pluginId 유일성·1:1 선언은 registry, 활성 연결 정리는 lifecycle, origin allowlist 는 broker.
- [x] 참조 구현(0160 산출물)을 입력으로 썼고, 재사용 표면 3종(`createConfluenceConnector`·`createConfluenceTools`·`createConfluencePackage`)과 그 커버리지를 §자료조사·§템플릿 계약에 나열했다.
- [x] 미룬 항목 5건마다 일방향 여부에 답했고, 일방향 4종(ID 규칙·설정 키·채널 이름·주소 불변)은 **이번에 확정**했다.
- [x] 관문 4 를 본문 완성 후 돌렸다 — §기존 결정 표 19행을 본문 문장과 짝지어 채웠고, 코드 주석(`connectors/registry.ts:7`)·계약 헤더(`contracts/auth-plugin.ts:7-12`)·위생 테스트(`resources.test.ts`·append-only 가드)를 출처에 포함했으며, 인용 경로를 `Read`/`rg` 로 확인했다.
- [x] "확정돼 있다"·"채택 결정이다" 로 쓴 것마다 앵커를 확인했다 — `0158/plan.md:138,315-318`·`docs/GLOSSARY.md:31`(`Plugin` 표제어)·`IPC_CONTRACT.md §6`(482행)·`modules/AGENTS.md` 문구를 직접 열어 인용했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**
  - 사용자 보고("플러그인 클릭 시 추가 버튼이 없다")가 설계의 추론과 정확히 일치했다 —
    `ExtensionsCatalogView.tsx` 가 `selection.tab !== 'plugins'` 로 추가 버튼을 **명시적으로
    숨기고** 있었다. 조건 하나를 지우고 탭별 분기를 넣는 것이 UI 변경의 전부였다.
  - "패키지를 둘로 나눈다"(shared=provider 1회 / instance=connector+tools)가 결정적이었다.
    합쳤으면 두 번째 서버 추가가 registry 의 중복 provider id 거부에 걸려 통째로 실패했을 것이다.
  - broker 의 origin·redirect 강제가 `descriptor.baseUrl` 을 읽는다는 설계 관찰이 맞았다 —
    인스턴스 descriptor 에 사용자 origin 이 들어가면서 **0160 의 정책 코드를 한 줄도 안 고쳤다**.

- **이견 / 우려**
  1. **§신규 모듈 표가 `ConnectorTemplate` 을 `features/connectors/templates.ts` 에 두게 적었는데
     그대로 하면 lint error 다.** Confluence 구현은 `features/auth-platform/modules/` 에 있어
     `auth-platform → connectors` **feature 교차 import** 가 된다. 저장소의 1번 해소책대로
     계약을 `contracts/connector-template.ts` 로 승격했다(레지스트리 클래스만 features 에 남김).
     설계가 §신규 모듈에서 "구조적 포트" 를 registry·host 에만 적용하고 **템플릿 계약 자체의
     방향은 검토하지 않은** 누락이다.
  2. **AC 표에 "생성/삭제가 갱신된 목록을 반환한다" 가 없다.** 구현에서는 반환하도록 했다 —
     안 그러면 renderer 가 create 직후 다시 list 를 불러야 하고 그 사이 "만들었는데 목록에 없는"
     중간 상태가 보인다. AC16(DTO) 이 형상만 고정하고 반환 시점을 다루지 않았다.
  3. **AC19 의 "단계 전이" 가 템플릿 1개인 경우를 다루지 않는다.** 선택지가 하나뿐인 선택
     화면은 클릭만 늘리므로 건너뛰도록 구현하고 테스트를 추가했다(`initialStep`).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **`ConnectorTemplate` 계약을 features 에 두면 feature 교차 import** — Confluence 구현(auth-platform)이 레지스트리(connectors)를 import 하게 된다 | ✅ 계약을 `contracts/connector-template.ts` 로 승격. 레지스트리 클래스만 `features/connectors` 에 남기고 타입은 re-export | `src/main/AGENTS.md` §해소책 1 · `npm run lint` boundaries |
| 2 | **`Settings` 는 `z.infer` 가 아니라 손으로 쓴 인터페이스**(`shared/ipc.ts:1160`) — 스키마에만 키를 넣으면 타입에 안 잡힌다 | ✅ 스키마와 인터페이스 양쪽에 `connectorInstances` 추가 | `tsc` 가 `Property 'connectorInstances' does not exist on type 'Settings'` 로 잡음 |
| 3 | **인스턴스 등록 실패 시 저장소에 유령 항목이 남는다** — 재시작마다 같은 실패를 반복한다 | ✅ 등록 실패면 `store.remove` 로 되돌린다 | `instance-lifecycle.test.ts::"등록 실패 시 저장을 되돌린다"` |
| 4 | **`/display` 를 컨텍스트 경로로 오인하면 모든 요청이 404 다.** 사용자는 `https://wiki.corp/display/ENG/Page` 를 붙여넣는다 | ✅ `splitPastedUrl` 이 Confluence 의 뷰 경로 6종(`display`·`pages`·`spaces`·`wiki`·`rest`·`x`)을 제안에서 제외. 자동 확정하지 않고 **제안**만 한다 | `connectorInstance.test.ts::"잘 알려진 뷰 경로는 컨텍스트 경로로 제안하지 않는다"` |
| 5 | **빈 컨텍스트 경로를 키로 보내면 요청이 통째로 거부된다**(스키마가 빈 문자열을 거부) | ✅ `toCreateRequest` 가 빈 값이면 **키 자체를 생략**한다 | `connectorInstance.test.ts::"빈 컨텍스트 경로는 키 자체를 보내지 않는다"` |
| 6 | **DTO 에 `source` 를 추가하면 기존 테스트 픽스처 4곳이 깨진다**(strict 스키마) | ✅ 픽스처 4곳 갱신. 깨진 것 자체가 DTO 경계가 fail-closed 로 동작한다는 증거다 | `protocol.plugins.test.ts` · `handlers/plugins.test.ts` · `plugin-id-ssot.test.ts` · `connectorConnect.test.ts` |
| 7 | **템플릿 i18n 키를 main 이 선언하는데 renderer 카탈로그에 없으면 키 문자열이 그대로 버튼에 뜬다** | ✅ `templateLabel` 이 미해결 키를 감지해 `templateId` 로 낮춘다 | `ConnectorInstanceModal.tsx` — i18next 는 미등록 키에 키 자체를 반환 |
| 8 | **인스턴스 복원을 `validateCrossReferences` 뒤에 두면 인스턴스 connector 의 provider 참조가 검사되지 않는다** | ✅ 복원을 cross-reference 패스 **앞**에 배치 | `bootstrap.ts` — 두 경로가 같은 검증 패스를 탄다 |
| 9 | **`PluginHost` 가 인스턴스 여부를 모르면 `source` 를 채울 수 없다** | ✅ `InstanceSourceLookup` 구조적 포트를 optional 로 추가. 미주입이면 `static` 으로 접힌다(fail-closed — UI 가 삭제 버튼을 안 그린다) | `plugin-host.ts` · `main/AGENTS.md` 해소책 2 |

## [구현자 기입] 구현 체크리스트

- [x] `instance-id`(파생 ID, 11 케이스) → `instance-store`(CRUD·중복·깨진 항목, 15) →
      `templates`(계약 + 레지스트리) → `instance-lifecycle`(순서·복원, 12) RED→GREEN
- [x] `AuthRegistry.unregister` + 재등록 허용 (4 케이스)
- [x] `confluenceTemplate` — shared/instance 패키지 분리, 정적 `createConfluencePackage` 존치
- [x] 설정 키 `connectorInstances`(스키마 + `Settings` 인터페이스) + 부팅 복원 배선
- [x] IPC 3채널 + preload + renderer api + DTO `source` (82→85)
- [x] `connectorInstance` lib(17 케이스) → `ConnectorInstanceModal` → **추가 버튼 plugins 탭 노출**
      → 생성 후 인증 모달 연결 → 인스턴스 삭제 버튼
- [x] ko/en i18n 19키씩 · `IPC_CONTRACT.md` §2.13-d · `modules/AGENTS.md` · `confluence/AGENTS.md`
      · `GLOSSARY.md`(Connector 인스턴스 표제어)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 8 (`contracts/connector-template.ts` · `features/connectors/{instance-id,instance-store,instance-lifecycle,templates}.ts` + 테스트 3 · renderer `connectorInstance.ts`+테스트 · `ConnectorInstanceModal.tsx`) + 수정 18 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint **0 error**(warning 1 = 0102 베이스라인) · typecheck **3/3** · vitest **1725/1725 pass** · scripts **28/28** |
| 알려진 환경 실패 | `app/chat-turn.continuity.test.ts` 1파일 collection 실패 — electron 바이너리 egress 차단(코드 무관, `app/AGENTS.md` 베이스라인) |
| IPC | 82 → **85** (`templateList`·`instanceCreate`·`instanceDelete`). 주소 **수정 채널 없음**(의도) |
| 신규 의존성 | **0개** |
| 사람 실기 대기 | AC21·22 — 사내 Confluence DC 서버 필요. 추가 버튼 → Confluence → 주소·PAT → 재시작 후 목록 유지 확인 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `9b161e9` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | | | |
