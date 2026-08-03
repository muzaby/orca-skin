# Plan — 0164-buildtime-servers-only

## 메타

| 항목 | 값 |
|---|---|
| slug | `0164-buildtime-servers-only` |
| 작성자 | Claude Code |
| 일자 | 2026-08-03 |
| 매핑 | PR #307 (0160~0163 과 같은 브랜치 `claude/confluence-mcp-plugin-eejiq5`) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "빌드타임에서 2개의 컨플루언스(다른 base url을 빌드타임 고정) 등록을 하려한다" | 라이브 세션 요청 (2026-08-03) |
| 명시 요구 ② | "**ui 에서는 2개의 컨플루언스 항목이 노출돼야 한다**" | 〃 |
| 명시 요구 ③ | "이제 base url 수정은 안된다. 빌드타임에 고정돼있으니까" | 〃 |
| 명시 요구 ④ | "그러나 auth 인증은 런타임때 사용자가 직접 입력해야 한다" | 〃 |
| **사용자 결정 (질의)** | UI 추가 경로 = **"제거 빌드타임 전용, 단 디버그 패널에 플러그인 항목을 플러그인 토글 버튼 추가, 추가버튼이 노출되도록"** — 즉 코드는 남기고 **기본 숨김 + 디버그 토글로만 노출**한다. | AskUserQuestion 응답 |
| **사용자 결정 (질의)** | 실제 서버 주소 = **"자리만 만들어 두라"** — `servers.ts` 배열은 비운 채 뼈대만 두고 배포가 채운다. | 〃 |

## Context (왜)

0161~0163 은 "사용자가 UI 에서 서버를 만든다" 를 전제로 쌓였다. 사용자가 그 전제를 **빌드타임
고정**으로 바꿨다 — 사내 배포에서 서버 주소는 IT 가 정하는 값이지 사용자가 타이핑할 값이 아니다.
다만 인스턴스 경로를 **삭제하지는 않고** 디버그 토글 뒤로 숨긴다(되돌릴 여지를 남긴다).

요구 ①③④ 는 **이미 동작한다**(§자료조사 1). 실제로 손볼 것은 ② 하나 — 그런데 그 하나가
0159 의 "행 = 플러그인 패키지" 결정을 건드린다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당** | 요구 ②가 핵심이고 나머지는 이미 충족. "2개 노출" 은 취향이 아니라 **행의 단위가 사용자 모델과 다르다**는 지적이다. |
| 이미 있는 것 아닌가 | **①③④ 는 전부 있다** | 정적 2서버 등록은 `confluence-package.test.ts::"factory 로 서버 두 개를 등록한다"` 가 고정. 정적 connector 는 수정·삭제 채널이 없다(`connectorActions` 가 `remove` 를 instance 에만 준다). 런타임 자격증명 입력도 0160 그대로. **새로 만들 것은 ②와 디버그 게이트뿐.** |
| 더 작은 해법이 있는가 | **②에 두 안이 있었다** | ⓐ 행을 커넥터 단위로 바꾼다 ⓑ 정적 패키지를 서버마다 쪼갠다(=인스턴스 흉내). ⓑ 는 main 을 건드리고 provider 중복 문제를 다시 부른다. **ⓐ 채택** — 표시 계층만 바뀐다. |
| 인용 자료가 요구를 부풀리지 않았나 | **해당 없음** | 사용자 직접 결정. |
| 기존 채택 결정을 뒤집는가 | **하나 뒤집는다** | 0159 명시 결정 ⑦ "행 = 플러그인 패키지". 그 결정의 **전제**(패키지가 provider+connector 를 함께 담는다)가 0161 의 패키지 2분할로 깨졌다. 사용자가 §Context 의 대화에서 그 전제를 재확인하고 "2개 항목 노출" 을 지시했다 — 상세는 §기존 결정·규칙과의 관계. |

- **사용자에게 올릴 것**: **없음.** 갈렸던 두 지점(추가 경로 존폐 · 서버 주소)은 착수 전 질의로 확정했다.

## 자료조사 (Research)

| # | 발견 / 제약 | 레퍼런스 |
|---|---|---|
| 1 | **정적 N서버는 이미 성립한다.** `createConfluencePackage(servers)` 가 한 매니페스트 안에 provider 2 + connector N + runtimeTool N 을 담는다. 두 서버 등록·도구 서버 ID 무충돌이 테스트로 고정. 서버 0개면 **provider 만** 등록된다(`"서버가 0개면 provider 만 등록된다"`). | `modules/confluence/index.ts:166-203` · `confluence-package.test.ts:109-129` |
| 2 | **⚠️ 정적 패키지와 템플릿 공용 패키지가 `manifest.id` 를 공유한다** — 둘 다 `CONFLUENCE_PLUGIN_ID = 'confluence'` 이고 provider 2종도 같다. `AUTH_PLUGIN_PACKAGES` 를 활성화하면 부팅 시 ⓐ 정적 등록 → ⓑ `instances.restore()` 의 `sharedPackage()` 등록이 **중복 pluginId** 로 거부된다(`이미 등록된 pluginId 입니다`). `restore()` 가 로그만 남기고 계속하므로 치명적이진 않으나 **매 부팅 오류 로그**가 남는다. | `bootstrap.ts:199,233` · `registry.ts:95-97` · `instance-lifecycle.ts:65-70` |
| 3 | **행은 pluginId 로 묶인다** — `buildPluginRows` 가 provider·connector 의 pluginId 합집합으로 행을 만든다. 정적 2서버는 pluginId 가 모두 `confluence` 라 **행 1개**가 된다(요구 ② 미충족). | `pluginCatalog.ts:17-33` |
| 4 | **행 그룹도 같은 단위를 쓴다** — `pluginGroups` 가 `connectedCount > 0` 로 연결됨/안 됨을 가른다. 행이 커넥터 단위가 되면 `connected` 를 직접 쓰면 된다. | `catalogGroups.ts:57-70` |
| 5 | **디버그 패널 토글의 기존 관례** — `PanelToggle label/value/onChange` + `useTweakContext().setTweak`. Tweaks 는 설정에 영속되고 새 키는 `Settings` 인터페이스·zod 2곳·`useTweaks` 3곳을 지난다. | `DebugPanel.tsx:50-55` · `useTweaks.ts:8-55` · `protocol.ts:621,645` |
| 6 | **설정 스토어는 새 키를 기본값으로 흡수한다** — 번호 마이그레이션이 필요 없다(0161 에서 `connectorInstances` 로 확인). | `infra/settings-store.ts` |
| 7 | **DTO 에 "무엇으로 연결됐는지" 가 없다.** `PluginConnectorInfo` 는 `connected` 불리언만 준다 — 사용자가 "id/passwd 로 연결했는데 인증 제공자 0" 을 본 이유의 절반이다. 활성 binding 의 `providerId` 는 `PluginHost` 가 갖고 있다(`ActiveConnection.bindingFingerprint.providerId`). | `plugin-host.ts:80-95,66-74` · `shared/ipc.ts:301` |
| 8 | **`AuthRegistry` 에 "이 pluginId 가 등록됐나" 를 묻는 공개 메서드가 없다** — `unregister` 만 내부에서 `manifests.has` 를 쓴다. | `registry.ts:77-84` (공개 메서드 전수 12개 확인) |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `servers.ts` 에 서버 2개를 적으면 목록에 **행 2개**가 나타난다(각 행 = 한 서버). | `pluginCatalog.test.ts::"커넥터마다 행을 만든다"` | `usePluginCatalog` → `buildPluginRows` → `CustomizeList` |
| 2 | 행 제목은 서버 라벨이고, 부제로 주소를 보여준다. | `pluginCatalog.test.ts::"행 제목은 서버 라벨, 부제는 주소"` | `CustomizeList` plugins 행 |
| 3 | provider 만 기여하는 패키지는 **행을 만들지 않는다**(조작 대상이 아니다). | `pluginCatalog.test.ts::"provider 전용 패키지는 행이 없다"` | 동 위 |
| 4 | 각 행이 그 서버의 **쓸 수 있는 인증 방식**을 보여준다(PAT · ID/비밀번호). | `pluginCatalog.test.ts::"수용 provider 를 라벨로 푼다"` (`connectorAuthLabels`) | `PluginDetail` |
| 5 | 연결된 서버는 **무엇으로 연결됐는지**를 보여준다("ID/비밀번호로 연결됨"). | `handlers/plugins.test.ts` DTO 케이스 + `pluginCatalog.test.ts::"연결된 provider 를 골라낸다"` | `PluginHost.list` → `PluginConnectorInfo.connectedProviderId` → `PluginDetail` |
| 6 | 미연결 서버의 `connectedProviderId` 는 **부재**다(연결되지 않았는데 방식이 표시되지 않는다). | `plugin-host.test.ts::"미연결이면 connectedProviderId 가 없다"` | 동 위 |
| 7 | plugins 탭의 **추가 버튼이 기본으로 보이지 않는다**. | `pluginAddGate.test.ts::"기본값은 숨김"` | `ExtensionsCatalogView` ← `Tweaks.pluginAddEnabled` |
| 8 | 디버그 패널의 **플러그인 토글을 켜면** 추가 버튼이 보인다. | `pluginAddGate.test.ts::"토글을 켜면 노출"` + 사람 실기 — 디버그 패널 → 플러그인 → 토글 → plugins 탭에 추가 버튼 | `DebugPanel` → `setTweak('pluginAddEnabled')` → `ExtensionsCatalogView` |
| 9 | 토글 값이 **설정에 영속**되어 재시작 후에도 유지된다. | `protocol.plugins.test.ts` 또는 `protocol` 스키마 테스트로 기본값 `false` 고정 + `typecheck`(Settings 인터페이스·zod·useTweaks 전 지점) | `settingsApi.get/set` |
| 10 | 정적 패키지가 이미 provider 를 등록했으면 템플릿 공용 패키지 등록을 **건너뛴다**(부팅 오류 로그가 남지 않는다). | `instance-lifecycle.test.ts::"공용 패키지가 이미 있으면 건너뛴다"` | `bootstrap` → `instances.restore()` |
| 11 | 그래도 공용 패키지가 **없으면 등록한다**(정적 경로를 안 쓰는 배포에서 인스턴스가 계속 동작한다). | `instance-lifecycle.test.ts::"없으면 등록한다"` | 동 위 |
| 12 | `AUTH_PLUGIN_PACKAGES` 가 활성화돼 있고, `CONFLUENCE_SERVERS` 가 비어도 **부팅이 깨지지 않는다**(provider 만 등록). | `confluence-package.test.ts::"서버가 0개면 provider 만 등록된다"`(기존) + `npm run typecheck` | `bootstrap:199` |
| 13 | 정적 서버 행에 **제거 버튼이 없다**(빌드타임 고정이므로 UI 에서 지울 수 없다). | `connectorActions.test.ts::"static 은 remove 없음"`(기존) | `PluginDetail` |
| 14 | 정적 서버의 **주소를 바꾸는 UI 표면이 없다**. | `rg 'baseUrl' src/renderer/src/features/skills --glob '!*instance*'` = 0건 (인스턴스 생성 모달 외 주소 입력 표면 0) | — |
| 15 | 배포자가 `servers.ts` 한 파일만 편집해 서버를 켤 수 있다(`modules/index.ts` 는 이미 배선돼 있다). | `typecheck` + `servers.ts` 주석 절차가 2단계 → **1단계**로 줄었는지 문서 대조 | `AUTH_PLUGIN_PACKAGES` |
| 16 | 새 i18n 키가 ko·en 두 카탈로그에 존재한다. | `typecheck` (en 은 ko 타입을 만족해야 한다) | `shared/i18n/resources/*` |

> AC8 만 사람 실기가 섞인다(토글 조작). 나머지 15건은 순수 모듈·스키마·타입으로 기계 검증한다.
> AC1·2 는 `servers.ts` 가 비어 있어도 **테스트 fixture 로** 검증된다 — 실제 주소는 배포가 채운다.

## 범위 / 비범위

- **범위**: 정적 등록 배선 활성화 + 서버 2개 자리 · 공용 패키지 중복 등록 회피 · 목록 행을 커넥터
  단위로 · 인증 방식/연결 방식 표시(DTO 필드 1개 추가) · 추가 버튼 디버그 게이트 · i18n · 문서.
- **비범위**: 인스턴스 계층 **코드 삭제**(사용자 결정 = 게이트만) · 주소 수정 채널 · 실제 사내
  주소 기입(사용자 결정 = 자리만) · Confluence 외 템플릿.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 인스턴스 계층 완전 삭제 | **아니오** — 게이트가 닫혀 있으면 사용자에게 도달하지 않는다. 나중에 지워도 저장 형상(`connectorInstances`)만 정리하면 된다. 지금 지우면 되돌릴 때 3개 핸드오프를 재구현해야 하므로 **지우지 않는 쪽이 싸다**. |
| 실제 서버 주소 | **아니오** — `servers.ts` 배열 한 곳이고 ID·이름 규약을 주석으로 남긴다. 단 **`id` 는 일방향**이다(도구 이름·승인 키·다운로드 경로가 파생) — 그래서 주석에 "한 번 정하면 유지" 를 명시한다. |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만. **신규 의존성 0개, 신규 IPC 채널 0개(85 유지).**
- 전제: 설정 스토어가 새 키를 기본값으로 흡수한다(§자료조사 6) — 마이그레이션 불필요.

## 설계

**① 정적 배선 활성화 (요구 ①③④).** `modules/index.ts` 의 `AUTH_PLUGIN_PACKAGES` 를
`[createConfluencePackage(CONFLUENCE_SERVERS)]` 로 켠다. 배열이 비어 있으면 provider 만 등록되어
안전하고(§자료조사 1), 배포는 **`servers.ts` 한 파일만** 편집하면 된다(기존 2단계 → 1단계).
`servers.ts` 에는 서버 2개의 주석 뼈대를 둔다.

**② 중복 등록 회피 (§자료조사 2).** `InstanceRegistryPort` 에 `has(pluginId): boolean` 을 더하고
`restore()` 가 이미 등록된 공용 패키지를 건너뛴다. `AuthRegistry` 에 `hasPlugin(pluginId)` 공개
메서드를 추가한다(내부 `manifests.has` 를 노출). **정적 패키지와 공용 패키지는 provider 내용이
동일**하므로 건너뛰어도 인스턴스가 참조할 provider 는 그대로 있다.

**③ 행 = 커넥터 (요구 ②).** `buildPluginRows` 를 `buildConnectorRows` 로 바꾼다 — connector 하나가
행 하나이고, provider 만 기여하는 패키지는 행을 만들지 않는다. 행이 갖는 것:

```ts
interface ConnectorRow {
  connectorId: string        // 선택 키
  title: string              // 서버 라벨
  origin: string             // 부제
  connected: boolean
  source: 'static' | 'instance'
  authLabels: string[]       // 쓸 수 있는 인증 방식 (수용 ∩ 등록)
  connectedAuthLabel: string | null   // 무엇으로 연결됐는지
  connector: PluginConnectorInfo
}
```

`authLabels`·`connectedAuthLabel` 은 `acceptedAuthProviders`·`connectedProviderId` 를 등록 provider
목록으로 푼 **순수 파생**이다 — `buildConnectOptions` 와 같은 교집합 규칙을 쓴다.

**④ 연결 방식 DTO (요구 ②의 나머지·§자료조사 7).** `PluginConnectorInfo` 에
`connectedProviderId?: string` 을 더한다. `PluginHost.list()` 가 `ready` 인 연결의
`bindingFingerprint.providerId` 를 싣는다. **secret 은 나가지 않는다** — provider id 만이다.
미연결이면 키를 싣지 않는다(부재 = 미연결, AC6).

**⑤ 추가 버튼 게이트 (사용자 결정).** `Tweaks.pluginAddEnabled: boolean`(기본 `false`)를 더하고
디버그 패널에 `플러그인` 섹션 + 토글을 둔다. `ExtensionsCatalogView` 는 plugins 탭에서 그 값이
참일 때만 추가 버튼을 그린다. 판정은 순수 함수로 내린다:

```ts
export function showsAddButton(tab: CatalogTab, pluginAddEnabled: boolean): boolean
```

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `features/skills/lib/pluginAddGate.ts` | 탭·토글 → 추가 버튼 노출 판정 | renderer `features/skills` | **순수 단위** |

`pluginCatalog.ts`(행 구성)·`connectorActions.ts`(액션)·`instance-lifecycle.ts`(등록 스킵)는 기존
모듈 확장이라 새 레이어가 생기지 않는다. renderer 는 전부 `features/skills` + `shared`,
main 은 `features/connectors` + `features/auth-platform` 내부라 boundaries 위반이 없다.

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **"행 = 플러그인 패키지"** (0159 명시 결정 ⑦, 사용자 결정) | `0159/plan.md` §사용자 의도 | §설계 ③ "행 = 커넥터" | **뒤집는다.** 근거: 그 결정의 전제(패키지가 provider+connector 를 함께 담는다 — `GLOSSARY.md` §Plugin (C))가 0161 의 패키지 2분할로 깨졌고, 사용자가 "2개 항목 노출" 로 새 단위를 지시했다. |
| **"UI 에서 서버를 만든다"** (0161·0162 전제) | `0161/plan.md` | §설계 ⑤ · §범위 비범위 | **기본값을 뒤집는다** — 코드는 남기고 디버그 토글 뒤로 숨긴다(사용자 결정). 삭제하지 않는다. |
| **주소는 생성 후 불변** (0161) | `modules/confluence/AGENTS.md` §주소 규칙 | AC14 | **유지·강화** — 정적 경로에는 애초에 수정 채널이 없다. |
| **정적 connector 는 UI 에서 지울 수 없다** (0161) | `plugin-host.ts:43-46` 주석 | AC13 | **유지** |
| **secret 은 binding 결과·renderer 응답에 싣지 않는다** (AUTH-PLAT) | `modules/AGENTS.md` §규칙 | §설계 ④ | **유지** — provider **id** 만 나간다. 값·handle 이 아니다. |
| **registry 는 중복 pluginId 를 거부한다** (0157) | `registry.ts:95-97` | §설계 ② | **유지** — 우회하지 않고 **호출 전에 묻는다**(`hasPlugin`). |
| **저장소 기본값은 빈 서버 목록** (0160) | `servers.ts` 헤더 | §설계 ① | **유지** — 배열은 비운 채 배선만 켠다. placeholder origin 을 넣지 않는다. |
| IPC 채널 **85** | `docs/IPC_CONTRACT.md` | §의존 기술 | **유지 — 신규 채널 0.** 단 `PluginConnectorInfo` 에 필드 1개가 늘어 §2.13 표 갱신 필요 |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **서버 0개(저장소 기본값)**: plugins 탭이 빈 상태 문구를 보여준다(기존 `noPlugins`). 추가 버튼도
  기본 숨김이므로 **아무것도 할 수 없는 화면**이 된다 — 그래서 빈 상태 문구에 "관리자가 설정한다"
  는 취지를 담는다.
- **디버그 토글이 켜진 채 서버를 만든 뒤 토글을 끄면**: 만든 서버는 목록에 **남는다**(행은 커넥터
  단위라 인스턴스도 정상 표시). 토글은 *만드는 입구*만 닫는다 — 이미 만든 것을 숨기면 사용자가
  지울 방법이 사라진다.
- **연결 방식 표시와 재연결**: 재연결로 방식을 바꾸면(PAT → ID/비밀번호) `connectedProviderId` 가
  따라 바뀐다. 표시는 `list()` 재조회로 갱신된다.
- **정적·인스턴스 혼재**: 정적 행에는 제거 버튼이 없고 인스턴스 행에는 있다 — 같은 목록에서 둘이
  구분된다(`source`).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `AUTH_PLUGIN_PACKAGES` 활성화가 부팅 경로를 건드린다 — 잘못되면 앱이 안 뜬다 | 배열이 비면 provider 만 등록되는 것이 **기존 테스트로 고정**돼 있다(AC12). 중복 등록은 AC10·11 로 막는다. |
| 행 단위 변경이 `catalogGroups`·선택 키(`selectedId`)를 함께 흔든다 | 선택 키를 `pluginId` → `connectorId` 로 바꾸고 그룹도 행의 `connected` 를 쓴다. 둘 다 같은 커밋에서 바꿔 중간 상태를 만들지 않는다. |
| 디버그 토글을 사용자 설정에 영속한다 = 일반 사용자 설정 파일에 개발용 키가 생긴다 | 기본값 `false` 이고 UI 노출은 디버그 패널뿐이다. 별도 저장소를 새로 만드는 비용이 이득보다 크다. |

- 되돌리기 어려운 결정: **`servers.ts` 의 `id`** — 도구 이름·승인 키·다운로드 경로가 파생된다.
  배열을 비워 두므로 **이번 커밋에서는 확정하지 않는다**(배포가 정할 때 주석이 경고한다).
- **단독 결정 금지 항목**: 없음.

## 영향 받는 파일

- `app/src/main/features/auth-platform/modules/{index.ts,confluence/servers.ts}`
- `app/src/main/features/auth-platform/registry.ts` (`hasPlugin`) · `plugin-host.ts` (`connectedProviderId`)
- `app/src/main/features/connectors/instance-lifecycle.ts` (+ `.test.ts`)
- `app/src/shared/{ipc.ts,protocol.ts}` (DTO 필드 + Settings 키)
- `app/src/renderer/src/features/skills/lib/{pluginCatalog,pluginAddGate,catalogGroups,catalogSelection}.ts` (+ 테스트)
- `app/src/renderer/src/features/skills/components/customize/{CustomizeList,PluginDetail,ExtensionsCatalogView}.tsx`
- `app/src/renderer/src/features/debug/components/DebugPanel.tsx` · `shared/hooks/useTweaks.ts`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/IPC_CONTRACT.md` (§2.13 DTO 필드) · `modules/confluence/AGENTS.md`

## 게이트

- `cd app && npm run lint && npm run typecheck` + `./node_modules/.bin/vitest run`.
- 신규 테스트: `pluginAddGate.test.ts` · `pluginCatalog.test.ts`(행 재구성) ·
  `instance-lifecycle.test.ts`(등록 스킵 2케이스) · `plugin-host.test.ts`(`connectedProviderId`).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 4건 + 질의로 확정한 결정 2건을 원문으로 인용했다.
- [x] 자료조사 — 8건 전부 `파일:라인`. 특히 #2(중복 등록)는 설계를 바꾼 발견이다.
- [x] 의존 기술 — 신규 의존성 0, 채널 0.
- [x] 파생 UX — 서버 0개·토글 끄기·방식 변경·혼재를 이 작업에 해당하는 것만 적었다.
- [x] 리스크 — 부팅 경로·행 단위 연쇄·설정 키 3건 + 되돌리기 어려운 것(`id`)을 이번 범위 밖으로 뺐다.

**기계적으로 확인 가능한 것**:

- [x] 비판적 검토 5문에 답했고 범위를 줄이지 않았다(요구 ①③④ 가 이미 된다고 **생략하지 않고** AC12·13·14 로 고정했다).
- [x] `검증 수단` **16/16** 채움. 사람 실기는 AC8 하나이고 실행 경로를 적었다.
- [x] 부정형 기준 0개 — AC3·6·7·13·14 는 "행이 없다/키가 없다/보이지 않는다" 를 **관측 가능한 결과**로 단언한다(각각 배열 길이·프로퍼티 부재·grep 0건).
- [x] AC 간 모순 점검 — AC7(기본 숨김) ↔ AC8(토글 시 노출)은 같은 함수의 두 입력. AC10 ↔ AC11 은 조건이 배타. AC1(행 2개)과 AC3(provider 행 없음)은 같은 재구성의 두 면이라 함께 성립한다. AC5 ↔ AC6 은 연결 여부로 배타.
- [x] 인용 수치 이번 세션 측정 — `AuthRegistry` 공개 메서드 12개 전수, 설정 키 배선 지점(ipc 1 · protocol 2 · useTweaks 3), 정적 2서버 테스트 실재.
- [x] 신규 모듈 1개는 순수 단위. 나머지는 기존 순수 모듈 확장.
- [x] 전수 N — `buildPluginRows` 소비처 3곳(`usePluginCatalog`·`CustomizeList`·`PluginDetail`), `AUTH_PLUGIN_PACKAGES` 소비처 1곳(`bootstrap:199`).
- [x] 각 AC 에 프로덕션 도달 경로가 있다.
- [x] 사람 실기 AC 의 경로가 비범위에 막혀 있지 않다(디버그 패널은 이미 있다).
- [x] 선택적 필드 — `connectedProviderId` 는 **부재가 곧 미연결**이고 AC6 이 그 케이스를 갖는다.
- [x] 제약 필드 강제 지점 — `acceptedAuthProviders` 의 강제 지점은 여전히 `buildConnectOptions`(연결 시)이고, `authLabels` 는 같은 규칙을 **표시용으로** 재사용할 뿐 새 강제 지점이 아니다.
- [x] 미룬 항목 2건 모두 일방향 여부에 답했다(둘 다 아니오, 단 `id` 는 일방향이라 확정을 미룬다).
- [x] 관문 4 — 기존 결정 표 8행을 본문 문장과 짝지어 채웠고 인용 경로를 전부 열어 확인했다.
- [x] "확정" 류 앵커 확인 — `0159/plan.md` 의 "행 = 플러그인 패키지"(grep 1건), `GLOSSARY.md` §Plugin (C)(grep 1건).

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

> 상태: **IMPL_DONE** (Claude 직접 구현 — 환경에 Codex 부재, 사용자 지시. 0160~0163 과 같은 사유)

- **동의 / 그대로 진행**
  - §자료조사 2(정적 패키지 ↔ 템플릿 공용 패키지의 `manifest.id` 충돌)가 이 작업에서 가장 값진
    발견이다. 이걸 안 봤으면 `AUTH_PLUGIN_PACKAGES` 를 켜자마자 **매 부팅 오류 로그**가 생기고,
    `restore()` 가 로그만 남기고 계속하므로 **테스트는 전부 green 인 채로** 새어 나갔을 것이다.
  - §설계 ③(행 = 커넥터)이 사용자 요구 ②를 만족하면서 지난 두 라운드의 혼란(provider 전용 행 ·
    "인증 제공자 0")을 **부수 효과 없이** 함께 없앤다. 별도 작업으로 나눌 이유가 없었다.
- **이견 / 우려**
  - **§설계 ③이 `PluginRow` 소비처를 3곳으로 셌는데 실제로는 5곳이다.** `usePluginCatalog`·
    `CustomizeList`·`PluginDetail` 외에 **`catalogGroups.pluginGroups`**(`connectedCount` 로 그룹을
    가른다)와 **`ExtensionsCatalogView`의 선택 키**(`item.pluginId === selection.selectedId`)가
    같은 타입에 묶여 있었다. 둘 다 같은 커밋에서 바꿨다 — 선택 키를 안 바꿨으면 목록에서 행을
    눌러도 상세가 안 열린다(조용한 파손).
  - **`ExtensionsCatalogView` 의 `allProviders` 가 행에서 파생되고 있었다**(0163 이
    `rows.flatMap(r => r.providers)` 로 만들었다). 행이 커넥터가 되면 그 경로가 사라지므로
    `usePluginCatalog` 가 provider 목록을 **직접 내보내도록** 바꿨다. 0163 의 파생은 애초에
    우회였고 이번에 정본이 됐다.
  - **AC15("배포자가 한 파일만 편집")는 설계가 적은 것보다 큰 이득이다.** 편집 지점이 둘이면
    `servers.ts` 만 고치고 `index.ts` 를 빠뜨리는 실패가 조용하다(서버를 적었는데 안 뜬다).
    배선을 켜두면 그 실패 모드가 사라진다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `PluginRow` 소비처가 설계의 3곳이 아니라 **5곳** — `pluginGroups`·선택 키가 빠져 있었다 | ✅ 구현함 — 같은 커밋에서 전부 커넥터 단위로 | 선택 키 미변경 = 행을 눌러도 상세가 안 열림 |
| 2 | `allProviders` 가 행에서 파생돼 행 재구성과 함께 끊긴다 | ✅ 구현함 — `usePluginCatalog` 가 provider 를 직접 내보낸다 | 0163 의 `rows.flatMap` 우회를 정본화 |
| 3 | i18n `skills.table.*` 열 제목이 패키지 어휘였다(`플러그인 패키지`·`인증 제공자`·`커넥터`) | ✅ 구현함 — `서버`·`주소`·`인증 방식` 으로 교체(ko·en) | 열이 바뀌었는데 제목이 남으면 더 헷갈린다 |
| 4 | `PluginDetail` 의 "인증 제공자 N" 메타가 행 재구성 후에도 남는다 | ✅ 구현함 — `인증 방식` 섹션(쓸 수 있는 방식 + 현재 연결 방식)으로 교체 | 사용자 보고의 직접 대상 |
| 5 | i18n 편집 중 `debug.mockMode` 키를 실수로 지웠다(typecheck 가 즉시 잡음) | ✅ 복구함 | `tr()` 의 키 리터럴 타입 검사가 안전망으로 동작 |
| 6 | `connectorActions.pluginTone` 이 `connectedCount` 를 받아 행 재구성 후 소비처가 없다 | ✅ 구현함 — 목록도 `connectorActions(row.connector).tone` 을 쓰도록 통일(판정 1곳) | 같은 값을 두 함수가 계산하지 않는다 |
| 7 | `servers.ts` 의 "2단계 절차" 주석이 배선 활성화 후 거짓이 된다 | ✅ 구현함 — 1단계로 고쳐 쓰고 `id` 불변 경고를 본문으로 올렸다 | 문서와 코드가 어긋나면 문서가 진다 |

## [구현자 기입] 구현 체크리스트

- [x] `AUTH_PLUGIN_PACKAGES` 활성화 + `servers.ts` 2서버 자리(배열은 빈 채)
- [x] `AuthRegistry.hasPlugin` + `restore()` 중복 등록 스킵 (+테스트 2건)
- [x] `PluginConnectorInfo.connectedProviderId` (main → DTO → zod) + `plugin-host` 테스트 2건
- [x] `buildConnectorRows` — 행 = 커넥터, provider 전용 패키지는 행 없음 (+테스트 11건)
- [x] 소비처 5곳 전환 — 목록·상세·그룹·선택 키·provider 공급
- [x] `Tweaks.pluginAddEnabled` + 디버그 패널 토글 + `showsAddButton` (+테스트 3건)
- [x] i18n ko·en (`debug.plugins`·`debug.pluginAdd`·`skills.table.{plugin,origin,authMethod}`·`skills.pluginDetail.{authMethods,actions,connectedWith}`)
- [x] 문서 — `IPC_CONTRACT.md` DTO 필드, `modules/confluence/AGENTS.md` 경로 표 반전
- [x] 게이트 통과

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 2 (`lib/pluginAddGate.ts`+테스트) + 수정 19 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint **0 error**(warning 1 = 0102 베이스라인) · typecheck **3/3** · vitest **1770/1770 pass**(0163 의 1757 + 신규 13) · scripts **28/28** |
| 알려진 환경 실패 | `app/chat-turn.continuity.test.ts` 1파일 collection 실패 — electron 바이너리 egress 차단(코드 무관, `app/AGENTS.md` 베이스라인) |
| IPC | **85 유지 · 신규 채널 0.** `PluginConnectorInfo` 에 선택 필드 1개(`connectedProviderId`) — `IPC_CONTRACT.md` §2.13 갱신 |
| 신규 의존성 | **0개** |
| 서버 주소 | **미기입(사용자 결정 "자리만 만들어 두라")** — `CONFLUENCE_SERVERS = []` 유지, 주석에 2서버 자리 |
| 사람 실기 대기 | AC8(디버그 토글 조작) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `4c74524` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | | | |
