# Plan — 0162-connector-add-menu-status

## 메타

| 항목 | 값 |
|---|---|
| slug | `0162-connector-add-menu-status` |
| 작성자 | Claude Code |
| 일자 | 2026-08-03 |
| 매핑 | PR #307 (0160·0161 과 같은 브랜치 `claude/confluence-mcp-plugin-eejiq5`) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "플러그인 추가 버튼 클릭시 커넥터 항목들을 나열해야 한다" | 라이브 세션 요청 (2026-08-03) |
| 명시 요구 ② | "현재는 컨플루언스만 나열해야 한다" | 〃 |
| 명시 요구 ③ | "컨플루언스 클릭시 플러그인 항목에 컨플루언스 커넥터 항목이 추가돼야 한다. 클릭 시, base url 및 pat 혹은 id/passwd를 입력할 수 있어야 한다" | 〃 |
| 명시 요구 ④ | "연결 확인(pat 혹은 id/passwd)이 되면 초록색 공 표시가 추가돼야 한다" | 〃 |
| 명시 요구 ⑤ | "연결해제 기능, 제거, 재연결 기능도 제공해야 한다" | 〃 |
| **사용자 결정 (질의 응답)** | 요구 ③ 의 흐름 = **"입력 먼저 (현재 구조 유지)"** — 추가 메뉴에서 Confluence 를 고르면 주소·자격증명을 입력하고, **저장하는 시점에** 플러그인 목록에 항목이 나타난다. "목록 먼저(미설정 항목 선생성)" 는 사용자가 기각했다. | AskUserQuestion 응답 (2026-08-03) |
| **사용자 결정 (질의 응답)** | 재연결이 필요한 이유 = **"pat이나 passwd 가 변경되는 경우가 있다"** | 〃 |
| 추론 의도 | 요구 ⑤ 의 "재연결" 은 *새 자격증명으로 다시 붙는 것*이다 — 위 결정이 근거다(자격증명 회전). 저장된 자격증명으로 원클릭 재접속하는 기능이 아니다. **추론이지만 아래 §자료조사 3 이 코드로 뒷받침한다**(끊으면 vault 가 비워지므로 재입력 외에 길이 없다). | 추론 + `broker.ts:246` |

## Context (왜)

0161 이 "플러그인 탭에 추가 버튼이 없다" 를 고쳤지만, 사용자가 실제로 눌러보니 **누른 뒤에
나열되는 것이 없었다**. 등록된 템플릿이 정확히 1개라 선택 단계가 통째로 건너뛰어지고 곧바로
주소 입력 폼이 뜬다 — 사용자 입장에서는 "무엇을 추가하는 것인지" 가 화면에 없다.

같은 흐름에서 연결 상태도 글자(`연결됨`/`연결되지 않음`)로만 보이고, 자격증명이 바뀌었을 때
다시 붙는 경로가 UI 에 없다(끊고 다시 연결하는 2단 조작을 사용자가 스스로 조합해야 한다).

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당 — 원인 확정** | 증상="나열이 없다". 원인은 UI 누락이 아니라 **데이터 조건부 스킵**이다: `initialStep()` 이 `templates.length === 1` 이면 `'server'` 를 돌려주고(`connectorInstance.ts:31-33`), 등록 템플릿은 정확히 1개다(`bootstrap.ts:216` `new ConnectorTemplateRegistry([confluenceTemplate])`). 선택 화면 코드는 이미 있으나(`ConnectorInstanceModal.tsx:148-171`) **현재 데이터에서 영원히 도달 불가**다. |
| 이미 있는 것 아닌가 | **요구 ⑤ 의 2/3 는 이미 있다** | 연결 해제·제거 버튼이 `PluginDetail.tsx:90-113` 에 이미 있다. **없는 것은 재연결 하나**다. 요구 ④ 의 초록 점도 `Dot` 컴포넌트가 이미 있고(`shared/ui/Status.tsx:15-21`) `McpDetail.tsx:29` 가 `green`/`slate` 로 같은 패턴을 쓴다 — **신규 컴포넌트·신규 토큰 불필요**. |
| 더 작은 해법이 있는가 | **있다 — 그러나 채택하지 않는다** | 요구 ① 은 `initialStep` 을 지워 항상 `'template'` 로 시작시키는 **1줄 변경**으로도 만족한다. 그렇게 하지 않는 이유: skills 탭의 추가 버튼은 이미 **Popover 드롭다운**(`SkillAddMenu.tsx:42-63`)이라, plugins 탭만 "모달을 연 뒤 그 안에서 1행짜리 목록을 고르는" 형태면 같은 버튼의 의미가 탭마다 갈린다. 메뉴로 통일하면 클릭도 하나 줄어든다(모달 열기→선택→폼 3단 → 메뉴→폼 2단). |
| 인용 자료가 요구를 부풀리지 않았나 | **해당 없음** | 이번 요구에는 인용 자료(연구·보고서)가 없다. 사용자 직접 관찰이다. |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다** | 요구 ③ 은 두 가지로 읽혔고(`미설정 항목 선생성` vs `입력 후 등재`), 사용자가 **후자**를 골랐다. 따라서 0161 의 "주소는 생성 시 입력하고 이후 불변"(`connector/AGENTS.md:37-39`)이 **그대로 유지**된다. 상세는 아래 §기존 결정·규칙과의 관계. |

- **사용자에게 올릴 것**(단독 결정 불가): **없음.** 유일하게 갈렸던 요구 ③ 의 흐름은 착수 전
  질의로 확정했다(§사용자 의도의 사용자 결정 2행).

## 자료조사 (Research)

| # | 발견 / 제약 | 레퍼런스 |
|---|---|---|
| 1 | **선택 단계는 도달 불가다.** `initialStep(templates)` 은 `templates.length === 1` 일 때 `'server'` 를 돌려준다. 등록 템플릿 = **1개**(전수: `ConnectorTemplateRegistry` 생성자 호출은 저장소 전체에서 1곳). | `connectorInstance.ts:31-33` · `bootstrap.ts:216` |
| 2 | **템플릿 목록 IPC 는 이미 있다** — `pluginApi.templates()` (`CHANNELS.pluginTemplateList`, 0161). 이번 작업의 **신규 IPC 채널은 0개**이고 총 채널 수는 **85 유지**다. | `handlers/plugins.ts:52-57` · `shared/ipc.ts` |
| 3 | **연결 해제는 자격증명을 지운다.** `PluginHost.disconnect` → `logout.logout(bindingId, false)` → broker 가 provider logout 후 `vaultFor(authBindingPrefix(victim.id)).clearAll()`. 따라서 **재연결에는 자격증명 재입력이 필수**이고, 저장된 값으로 되붙는 경로는 존재하지 않는다. | `plugin-host.ts:170-176` · `broker.ts:226-246` |
| 4 | **binding 은 애초에 비영속이다**(0157) — 재시작하면 모든 연결이 끊긴 상태로 뜬다. 서버 목록만 `connectorInstances` 로 영속된다(0161). | `broker.ts` · `features/connectors/instance-store.ts` |
| 5 | **`Dot` 이 이미 있다.** 전수 사용 = **4곳** (`grep '<Dot '` = 4). 그중 `McpDetail.tsx:29` 이 이 작업과 동형(`enabled ? 'green' : 'slate'`). 토큰 `--color-good: #5a8a4f` 는 dark 스코프에서 재정의되지 않아 두 테마 공용이다. | `Status.tsx:15-21` · `McpDetail.tsx:29` · `BackendStatus.tsx:30` · `CameraView.tsx:84` · `tokens.css:49,177` |
| 6 | **connector 당 활성 연결은 1개**(0158). 그래서 현재 UI 는 연결됨이면 연결 버튼을 그리지 않는다 — 재연결을 "그냥 연결 한 번 더" 로 구현하면 `already_connected` 로 실패한다. **반드시 끊고 붙여야 한다.** | `PluginDetail.tsx:89` 주석 · `plugin-host.ts:109-111` |
| 7 | **목록은 이미 연결 여부로 그룹을 가른다** — `pluginGroups` 가 `connectedCount > 0` 로 연결됨/안 됨 두 그룹을 만든다. 초록 점은 이 그룹핑과 **같은 값**을 써야 두 표시가 어긋나지 않는다. | `catalogGroups.ts:57-70` |
| 8 | **추가 버튼의 드롭다운 관례.** skills 탭은 `dropdown`/`expanded` prop + `Popover` 메뉴를 쓴다. plugins 탭도 같은 배선을 재사용할 수 있다. | `ExtensionsCatalogView.tsx:87-103` · `SkillAddMenu.tsx:42-63` |
| 9 | **UI 컴포넌트 테스트는 이 저장소의 관례가 아니다** — "어댑터 정규화·reducer·IPC 스키마·순수 변환기는 단위 테스트와 함께, **UI 는 시각 검증으로 갈음**". 따라서 판정 로직을 순수 모듈로 내리고, 렌더링만 사람 실기로 남긴다. | `app/AGENTS.md` §에이전트 원칙 4 |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | plugins 탭의 추가 버튼이 드롭다운으로 표시된다(`dropdown` prop 이 skills·plugins 두 탭에서 참). | 사람 실기 — `npm run dev` → 확장 화면 → **플러그인** 탭 → 추가 버튼에 caret 이 보인다 | `ExtensionsCatalogView.tsx` 헤더 |
| 2 | 추가 버튼을 누르면 **등록된 템플릿 1개당 1행**인 메뉴가 열리고, 현재 등록분이 Confluence 하나이므로 **행이 정확히 1개** 보인다. | 사람 실기 — 위 경로에서 추가 클릭 → 메뉴에 `Confluence (Data Center)` 1행 | `ConnectorAddMenu` ← `pluginApi.templates()` → `handlers/plugins.ts:52` → `ConnectorTemplateRegistry.describe()` |
| 3 | 템플릿이 0개면 메뉴가 "추가할 수 있는 서비스가 없습니다" 를 **보여준다**(빈 메뉴가 아니라 사유를 보여준다). | `connectorAddMenu.test.ts::"템플릿이 없으면 빈 상태 사유를 낸다"` (순수 `addMenuState`) | 동 위 |
| 4 | 메뉴에서 Confluence 를 고르면 **그 템플릿으로 고정된** 주소 입력 폼이 열린다 — 모달 안에 템플릿 선택 단계가 남아 있지 않다. | `typecheck` — `ConnectorInstanceModal` 의 `templateId: string` 이 **필수 prop** 이라 템플릿 미선택 호출이 컴파일되지 않는다 + `connectorInstance.test.ts::"draftForTemplate 은 받은 템플릿으로 초안을 연다"` | `ExtensionsCatalogView` → `ConnectorInstanceModal` |
| 5 | 주소를 저장하면 플러그인 목록에 그 커넥터 항목이 **나타난다**(생성 응답이 갱신된 목록이다). | `handlers/plugins.test.ts` 기존 케이스(0161)가 생성 후 갱신 목록 반환을 고정 + 사람 실기 — 저장 후 목록에 행이 보인다 | `pluginApi.createInstance` → `handlers/plugins.ts:59-72` → `ConnectorInstanceLifecycle.create` |
| 6 | 저장 직후 자격증명 입력(**PAT 또는 ID/비밀번호**) 화면이 이어진다. | 사람 실기 — 저장 → 인증 방식 버튼 2종이 보이고 각각 필드가 다르다 | `ExtensionsCatalogView.onCreated` → `ConnectorConnectModal` |
| 7 | 연결된 커넥터는 상세에서 **초록 점**(`tone='green'`)을, 연결되지 않은 커넥터는 회색 점(`tone='slate'`)을 갖는다. | `connectorActions.test.ts::"연결되면 green, 아니면 slate"` | `PluginDetail` 커넥터 행 |
| 8 | 목록 행의 점은 **`pluginGroups` 와 같은 값**(`connectedCount > 0`)으로 켜진다 — 그룹은 "연결됨" 인데 점은 회색인 조합이 나오지 않는다. | `connectorActions.test.ts::"목록 tone 은 connectedCount>0 과 일치한다"` | `CustomizeList` plugins 행 |
| 9 | 연결된 커넥터의 액션 집합이 **`재연결`·`연결 해제`** 를 포함한다. | `connectorActions.test.ts::"연결됨 → reconnect·disconnect"` | `PluginDetail` |
| 10 | 연결되지 않은 커넥터의 액션 집합이 **`연결`** 을 포함하고 `재연결`·`연결 해제` 를 포함하지 않는다(끊긴 것을 끊을 수 없다). | `connectorActions.test.ts::"미연결 → connect 만"` | `PluginDetail` |
| 11 | `source === 'instance'` 인 커넥터만 액션 집합에 **`제거`** 가 들어간다. `static` 은 들어가지 않는다(main 이 `not_found` 로 거부하므로 누를 수 없어야 한다). | `connectorActions.test.ts::"instance 만 remove"` + `connectorActions.test.ts::"static 은 remove 없음"` | `PluginDetail` → `pluginApi.deleteInstance` |
| 12 | 재연결은 **연결 해제를 먼저 수행한 뒤** 자격증명 입력을 연다(순서가 반대면 `already_connected` 로 실패한다 — §자료조사 6). | `connectorActions.test.ts::"재연결은 disconnect 후 open 순서로 부른다"` (주입된 콜백 호출 순서 단언) | `PluginDetail.reconnect` → `pluginApi.disconnect` → `ConnectorConnectModal` |
| 13 | 연결 해제가 실패하면 재연결이 **자격증명 화면을 열지 않고** 실패를 돌려준다(끊기지 않은 채 입력받아 다시 `already_connected` 로 죽는 것을 막는다). | `connectorActions.test.ts::"disconnect 실패면 open 을 부르지 않는다"` | 동 위 |
| 14 | 새 자격증명으로 재연결하면 연결이 성립한다(PAT/비밀번호 회전 시나리오 — 사용자 요구의 목적). | **사람 실기 — 사내 Confluence DC 필요.** 연결됨 상태에서 `재연결` → 새 PAT 입력 → 초록 점이 다시 켜진다 | `PluginDetail` → `pluginApi.disconnect` → `pluginApi.connect` |
| 15 | 새 i18n 키가 ko·en **두 카탈로그 모두**에 존재한다. | `typecheck` — `en.ts` 는 `ko.ts` 의 타입을 만족해야 하므로 누락 시 컴파일 실패 | `shared/i18n/resources/*` |

> AC1·2·5·6·14 는 사람 실기다. 실행 경로가 이 작업의 비범위에 막혀 있지 않다 — AC1·2·5·6 은
> `npm run dev` + 이 브랜치의 renderer 로 끝까지 도달하고, AC14 만 사내 서버가 추가로 필요하다.

## 범위 / 비범위

- **범위**: plugins 탭 추가 버튼의 드롭다운화 + 템플릿 나열 메뉴 · 모달의 템플릿 단계 제거(메뉴가
  대신한다) · 목록/상세의 연결 상태 점 · 상세의 재연결 액션 · 액션 집합 판정의 순수 모듈화 · i18n.
- **비범위**: 저장된 자격증명으로의 원클릭 재접속(§자료조사 3 이 불가능함을 보인다) · 주소 수정
  채널(0161 결정 유지) · 미설정 상태의 항목(사용자가 기각) · 템플릿 2개 이상일 때의 메뉴 그룹핑·
  검색(행이 1개인 지금 필요 없다) · Confluence 외 신규 템플릿.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 템플릿이 여러 개가 됐을 때의 메뉴 그룹핑/검색 | **아니오** — 메뉴는 `describe()` 결과를 그대로 그리므로 행이 늘어도 동작하고, 그때 UI 만 덧붙이면 된다. 이름·식별자·스키마가 걸리지 않는다. |
| 저장된 자격증명 재사용 | **아니오** — 그러려면 vault 보존 정책(0157 의 비영속 binding)을 바꿔야 하는데, 그것은 이 UI 작업이 아니라 인증 플랫폼 결정이다. 지금 UI 를 어떻게 만들어도 그 결정을 막지 않는다. |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 쓴다: `shared/ui/Popover`(SkillAddMenu 가 쓰는 것) · `shared/ui/Status`의 `Dot` ·
  `shared/ui/Button`의 `dropdown`/`expanded` prop · `pluginApi.templates|createInstance|
  disconnect|deleteInstance`(0161 에 이미 있음).
- 전제: 등록 템플릿이 1개다(`bootstrap.ts:216`). 0개여도 메뉴가 사유를 보여야 한다(AC3).
- **신규 의존성: 없음.**

## 설계

**요구 ①②③ — 추가 버튼을 메뉴로.** `ExtensionsCatalogView` 의 추가 버튼은 이미 탭별로 분기한다
(0161). plugins 분기를 "모달 열기" 에서 "메뉴 열기" 로 바꾸고, skills 와 같은 방식으로
`dropdown={tab === 'skills' || tab === 'plugins'}` 를 준다. 새 `ConnectorAddMenu` 가
`pluginApi.templates()` 를 읽어 행을 그리고, 고른 `templateId` 를 그대로
`ConnectorInstanceModal` 에 넘긴다.

그러면 모달의 템플릿 단계는 **죽은 코드**가 된다 — 선택은 메뉴가 끝냈다. `templateId` 를 **필수
prop** 으로 만들어 타입 수준에서 "템플릿 없이 모달을 열 수 없다" 를 강제하고, `InstanceStep`
타입과 `initialStep`/`initialDraft` 를 지운 뒤 `draftForTemplate(templateId)` 하나로 대체한다.
`validateDraft` 의 `template_required` 분기는 **남긴다** — main 스키마와 같은 규칙을 renderer 가
먼저 보는 방어선이고, 지우면 fail-open 이 된다.

**요구 ④⑤ — 상태 점과 액션.** 판정을 렌더링에서 떼어 순수 모듈 `lib/connectorActions.ts` 로
내린다(§자료조사 9 — 이 저장소는 UI 를 시각 검증으로 갈음하므로, 검증하고 싶은 규칙은 순수부로
내려야 한다).

```ts
export type ConnectorAction = 'connect' | 'reconnect' | 'disconnect' | 'remove'
export function connectorActions(c: { connected: boolean; source: 'static' | 'instance' })
  : { tone: 'green' | 'slate'; actions: readonly ConnectorAction[] }
export function pluginTone(row: { connectedCount: number }): 'green' | 'slate'
```

`pluginTone` 이 `connectedCount > 0` 을 쓰는 것은 `pluginGroups` 와 **같은 식**이어야 하기
때문이다(AC8 — 그룹과 점이 어긋나면 사용자는 어느 쪽을 믿을지 모른다).

재연결의 **순서**도 순수 함수로 내린다 — 이것이 이 작업에서 유일하게 조용히 깨질 수 있는 지점이다
(§자료조사 6: 순서가 반대면 `already_connected`):

```ts
export async function runReconnect(
  steps: { disconnect: () => Promise<unknown>; open: () => void }
): Promise<boolean>   // disconnect 성공 시에만 open() 을 부르고 true
```

콜백을 주입받으므로 electron 없이 호출 순서·실패 분기를 단언할 수 있다(AC12·13).

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `features/skills/lib/connectorActions.ts` | 점 색·액션 집합·재연결 순서 판정 | renderer `features/skills` | **순수 단위** — `connectorActions.test.ts`. electron·React 의존 0, 재연결은 콜백 주입으로 순서 단언 |
| `features/skills/components/customize/ConnectorAddMenu.tsx` | 템플릿 나열 Popover | renderer `features/skills` | 렌더링은 사람 실기. **판정 가능한 부분(로딩·빈 상태·행 구성)은 같은 파일이 아니라 `lib/connectorAddMenu.ts` 의 `addMenuState()` 로 떼어** 단위 테스트(AC3) |

레이어: 셋 다 `features/skills` 내부이고 `shared/ui`·`shared/i18n`·`shared/api` 만 바깥으로
참조한다 — renderer 4-layer 의 `features → shared` 하향 의존이라 `boundaries` 위반이 없다.
다른 feature 를 import 하지 않는다.

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **주소는 생성 시 입력하고 이후 불변** (0161) | `modules/confluence/AGENTS.md:37-39` · `handlers/plugins.ts:45-51` 주석 | §사용자 의도 "입력 먼저 (현재 구조 유지)" · §범위 비범위 "주소 수정 채널" | **유지** — 사용자가 "목록 먼저(미설정 항목)" 를 기각해 이 결정이 그대로 남는다 |
| **connector 당 활성 연결 1개** (0158) | `connectors/registry.ts` 헤더 · `plugin-host.ts:109-111` | §설계 "반드시 끊고 붙여야 한다" · AC12 | **유지** — 재연결을 `disconnect → connect` 로 구현하는 것이 이 결정을 지키는 방법이다 |
| **binding 은 비영속, 자격증명은 logout 시 삭제** (0157) | `broker.ts:246` | §자료조사 3 · §범위 비범위 "저장된 자격증명 재사용" | **유지** — 재연결이 재입력을 요구하는 근거 |
| **정적 connector 는 UI 에서 지울 수 없다** (0161) | `plugin-host.ts:43-46` 주석 | AC11 | **유지** — 액션 집합에서 `remove` 를 뺀다 |
| **UI 는 시각 검증으로 갈음, 순수 변환기는 단위 테스트** | `app/AGENTS.md` §에이전트 원칙 4 | §설계 "판정을 렌더링에서 떼어" | **유지** — 그래서 판정을 순수 모듈로 내렸다 |
| **renderer 4-layer boundaries** | `app/eslint.config.mjs` | §설계 마지막 문단 | **유지** — `features/skills` 내부 + `shared` 만 참조 |
| **UI 문구는 renderer 소유(i18n 키), main 은 키만 선언** | `ConnectorInstanceModal.tsx:44-46` 주석 | AC2 의 `Confluence (Data Center)` | **유지** — 메뉴도 `templateLabel()` 과 같은 폴백 규칙을 쓴다 |
| IPC 채널 **85** (0161) | `docs/IPC_CONTRACT.md` | §자료조사 2 | **유지 — 신규 채널 0개.** `IPC_CONTRACT.md` 무수정 |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **템플릿 0개**: 메뉴가 빈 채로 열리면 고장으로 보인다 → 사유 문구를 보여준다(AC3).
- **템플릿 로딩 중**: 메뉴가 열린 직후 `templates()` 가 아직 안 왔다면 행이 없다 → 로딩 상태를
  빈 상태와 구분해 표시한다(빈 상태 문구를 로딩 중에 띄우면 오보다).
- **재연결 도중 실패**: 연결은 끊겼는데 새 자격증명 입력을 취소하면 **연결되지 않은 상태**로
  남는다. 이는 정상이고 목록에서 다시 연결할 수 있다 — 다만 사용자가 "재연결을 눌렀는데 끊겼다"
  로 읽지 않도록 자격증명 모달의 제목이 그대로 `{{name}} 연결` 이라는 점을 유지한다.
- **동시 조작**: 같은 커넥터에 재연결과 제거가 겹치면 안 된다 → 기존 `busyId` 게이트를 재연결에도
  건다(`PluginDetail` 이 이미 커넥터별 `busyId` 를 갖고 있다).
- **a11y/키보드**: 메뉴는 `Popover` + `role="menu"`/`menuitem` 을 쓰는 `SkillAddMenu` 와 같은
  구조라 포커스 트랩·ESC 닫기가 그대로 따라온다. 점은 장식이므로 텍스트 라벨(`연결됨`)을
  **지우지 않는다** — 색만으로 상태를 전달하지 않는다.
- **테마**: `--color-good` 은 dark 스코프에서 재정의되지 않아 두 테마 공용이다(§자료조사 5).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 재연결이 "끊기만 하고 못 붙는" 중간 상태를 만들 수 있다 | 그 상태는 목록에 회색 점으로 정직하게 보이고 연결 버튼이 살아 있다. 순서 역전(붙은 채로 붙기)이 더 나쁜 실패라 끊기 우선을 택했다(AC12·13). |
| 모달에서 템플릿 단계를 지우면 그 코드 경로가 사라진다 | 선택 책임이 메뉴로 **이동**하는 것이지 없어지는 것이 아니다. `templateId` 필수 prop 으로 타입 강제하고, 죽은 `initialStep`/`initialDraft` 와 그 테스트를 함께 지운다(남기면 실제로 안 쓰는 코드가 green 으로 남는다). |
| 점을 추가하면서 기존 텍스트 라벨을 지우고 싶어진다 | **지우지 않는다** — 색만으로 상태를 전달하면 색각 이상 사용자에게 정보가 사라진다. |

- 되돌리기 어려운 결정: **없음.** 신규 채널·스키마·식별자가 0이라 전부 renderer 내부에서 되돌릴 수 있다.
- **단독 결정 금지 항목(Open Question)**: 없음.

## 영향 받는 파일

- `app/src/renderer/src/features/skills/lib/connectorActions.ts` (신규) + `.test.ts`
- `app/src/renderer/src/features/skills/lib/connectorAddMenu.ts` (신규) + `.test.ts`
- `app/src/renderer/src/features/skills/components/customize/ConnectorAddMenu.tsx` (신규)
- `app/src/renderer/src/features/skills/lib/connectorInstance.ts` (+ `.test.ts`) — `initialStep`·`initialDraft` → `draftForTemplate`
- `app/src/renderer/src/features/skills/components/customize/ConnectorInstanceModal.tsx` — `templateId` 필수 prop, 템플릿 단계 제거
- `app/src/renderer/src/features/skills/components/customize/ExtensionsCatalogView.tsx` — plugins 탭 드롭다운 배선
- `app/src/renderer/src/features/skills/components/customize/PluginDetail.tsx` — 점·재연결
- `app/src/renderer/src/features/skills/components/customize/CustomizeList.tsx` — 목록 행 점
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`

## 참고 문서

- `docs/handoff/0161-connector-instance-templates/plan.md` (템플릿·인스턴스 계층)
- `docs/handoff/0160-confluence-connector-plugin/plan.md` (연결 모달·전송 계약)
- `app/AGENTS.md` §스타일링 · §에이전트 원칙 4
- IPC 변경 **없음** → `docs/IPC_CONTRACT.md` 무수정 (85 유지)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + `./node_modules/.bin/vitest run`
  (`npm test` 는 better-sqlite3 ABI 를 Node 로 뒤집으므로 이 renderer 전용 변경에는 쓰지 않는다 —
  `app/AGENTS.md` §ABI 가이드).
- 신규 테스트 요구: `connectorActions.test.ts`(점·액션·재연결 순서) · `connectorAddMenu.test.ts`
  (행 구성·빈 상태) · `connectorInstance.test.ts` 갱신(`draftForTemplate`).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 5건을 라이브 세션 요청으로 인용했고, 질의로 확정한 결정 2건을 별행으로 분리했다. 추론(재연결의 의미)은 추론으로 표기하고 코드 근거를 붙였다.
- [x] 자료조사 — 9건 전부 `파일:라인` 레퍼런스가 있다.
- [x] 의존 기술 — 전부 기존 모듈. 신규 의존성 0개.
- [x] 파생 UX — 로딩/빈 상태·재연결 중단·동시 조작·a11y·테마를 이 작업에 해당하는 것만 적었다.
- [x] 리스크 — 3건 + "되돌리기 어려운 결정 없음" 의 근거(신규 스키마·식별자 0).

**기계적으로 확인 가능한 것**:

- [x] 요구 비판적 검토 5문 전부 답했고, 요구 범위를 줄이지 않았다(요구 ⑤ 중 이미 있는 2건도 AC 로 고정했다 — "이미 있으니 생략" 하지 않았다).
- [x] `검증 수단` 칸 **15/15 채움**. 사람 실기 5건은 실행 경로를 함께 적었다.
- [x] 부정형 기준 **0개** — AC10·11·13 은 "포함하지 않는다"/"부르지 않는다" 를 *단언 대상*으로 삼은 양성 단언이다(관측 가능한 호출 유무).
- [x] AC 간 모순 점검 — AC7(상세 점)과 AC8(목록 점)은 서로 다른 소스(`connected` vs `connectedCount`)를 쓰지만 AC8 이 두 값의 일치를 명시적으로 요구한다. AC9·10 은 연결 상태로 배타. AC11 은 source 축이라 9·10 과 직교. AC4(템플릿 단계 제거)와 AC3(빈 상태)은 **다른 컴포넌트**(모달 vs 메뉴)라 충돌하지 않는다.
- [x] 인용 수치 전부 이번 세션 실측 — 템플릿 1개(`bootstrap.ts:216` 확인), `<Dot ` 4곳(grep), 채널 85 유지(신규 0), i18n 카탈로그 2개.
- [x] 신규 모듈 3개 중 순수 2개는 단위 테스트, React 1개는 판정부를 `lib/connectorAddMenu.ts` 로 떼는 seam 을 설계에 명시했다.
- [x] 전수 조사 N — `ConnectorTemplateRegistry` 생성 1곳, `<Dot ` 4곳, 신규 IPC 0곳.
- [x] 각 AC 에 프로덕션 도달 경로가 있다. 유일한 호출자가 테스트인 AC 0개 — 순수 모듈 3개는 전부 `PluginDetail`·`CustomizeList`·`ConnectorAddMenu` 가 실제로 부른다.
- [x] 사람 실기 AC 5건의 실행 경로가 비범위에 막혀 있지 않다(AC14 만 사내 서버 필요, 그것도 이 작업이 막은 것이 아니다).
- [x] 선택적 필드 판정 — `source` 는 0161 이 기본값 `'static'` 으로 fail-closed 하므로 미지정 케이스가 타입상 존재하지 않는다(union 2값). AC11 이 두 값 모두를 케이스로 갖는다.
- [x] 제약 필드 강제 지점 — `source==='instance'` 만 삭제 가능이라는 제약은 **UI(액션 집합) + main(`not_found` 거부)** 두 곳에서 강제된다. UI 는 편의, 강제 지점은 main 이다.
- [x] 참조 구현 커버리지 — `ConnectorAction` union 4값 전부가 AC9·10·11 에 나온다.
- [x] 미룬 항목 2건 모두 일방향 여부에 답했다(둘 다 아니오).
- [x] 관문 4 를 본문 완성 후 돌렸다 — §기존 결정 표 8행을 본문 문장과 짝지어 채웠고, 인용 경로(`Status.tsx`·`McpDetail.tsx`·`catalogGroups.ts`·`broker.ts`·`plugin-host.ts`·`bootstrap.ts`)를 전부 열어 확인했다. `[구현자 기입]`·`[검증자 기입]` 블록이 아래에 있다.
- [x] "확정" 류 서술의 앵커 확인 — `app/AGENTS.md` §에이전트 원칙 4 (grep `UI 는 시각 검증으로 갈음` = 1건), `modules/confluence/AGENTS.md` §주소 규칙 (grep `주소는 생성 후 바꿀 수 없다` = 1건) 실재를 확인했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

> 상태: **IMPL_DONE** (Claude 직접 구현 — 환경에 Codex 부재, 사용자 지시. 0160·0161 과 같은 사유)

- **동의 / 그대로 진행**
  - §설계 의 "판정을 순수 모듈로 내린다" 가 이 저장소에서 유일하게 맞는 선택이다. `app/AGENTS.md`
    가 UI 를 시각 검증으로 갈음하므로, 순수부로 내리지 않았다면 요구 ④⑤ 의 규칙이 **테스트 0개**로
    들어갔을 것이다. 실제로 15개 AC 중 9개가 이 두 모듈로 기계 검증됐다.
  - §자료조사 3(끊으면 vault 가 비워진다)이 재연결 설계를 결정했다. 이걸 안 봤으면 "저장된
    자격증명으로 원클릭 재접속" 을 만들려다 vault 계약과 충돌했을 것이다.
- **이견 / 우려**
  - **§설계 의 `runReconnect` 시그니처가 틀렸다.** plan 은 `disconnect: () => Promise<unknown>`
    으로 적었지만, `pluginApi.disconnect` 는 `AuthLogoutOutcome` 을 돌려주고 **broker 는 실패를
    던지지 않는다**(`broker.ts` logout 이 `{kind:'failed'}` 를 *resolve* 한다). `unknown` 으로
    받으면 `try/catch` 만 보게 되어 **실패한 연결 해제를 성공으로 읽고** 자격증명 화면을 연다 —
    AC13 이 막으려던 바로 그 상황이다. 시그니처를 `Promise<AuthLogoutOutcome>` 으로 좁히고
    `kind !== 'logged_out'` 을 실패로 판정하도록 구현했다. 테스트도 "던지는 실패" 와 "던지지 않는
    실패" 두 케이스로 나눴다.
    - 부수 발견: 기존 `PluginDetail.disconnect` 도 `.catch(() => undefined)` 만 갖고 있어 같은
      맹점이 있다. 다만 그쪽은 실패해도 `onChanged()` 로 목록을 다시 읽어 **상태가 정직하게**
      보이므로(연결됨이 유지된다) 동작상 문제가 아니다. 이번 범위에서 건드리지 않았다.
  - **§설계 의 모달 초기화 방식이 lint 에 걸린다.** "다시 열면 앞선 입력이 남지 않게 초기화" 를
    `useEffect` 로 쓰면 `react-hooks/set-state-in-effect` **error** 다(이 저장소는 이 규칙이 켜져
    있다). 호출부가 템플릿을 고른 동안에만 모달을 **마운트**하도록 바꿔 effect 자체를 없앴다 —
    remount 가 곧 초기화다. 설계 의도는 그대로 만족한다.
  - **AC1 의 "drop-down prop 이 skills·plugins 두 탭에서 참"** 을 그대로 쓰면 mcp 탭이 빠진 것을
    매번 나열해야 한다. `dropdown={selection.tab !== 'mcp'}` 로 뒤집어 적었다 — 의미는 같고
    탭이 늘 때 기본값이 "메뉴" 쪽으로 안전하게 접힌다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `pluginApi.disconnect` 는 **실패를 던지지 않는다** — 설계의 `Promise<unknown>` 으로는 AC13 을 만족할 수 없다 | ✅ 구현함 — `AuthLogoutOutcome` 으로 좁히고 `kind !== 'logged_out'` 을 실패로. 테스트 4케이스(성공·throw·`failed`·`not_supported`) | `broker.ts` logout 이 `{kind:'failed'}` 를 resolve · `shared/ipc.ts:294-297` union 3값 |
| 2 | `not_supported` 도 성공이 아니다 — union 3값 중 `logged_out` 만 성공이다 | ✅ 구현함 — 전수 케이스 테스트 | 〃 |
| 3 | 모달 초기화 effect 가 lint error(`set-state-in-effect`) | ✅ 구현함 — 조건부 마운트로 effect 제거 | `npm run lint` 실측 |
| 4 | `Icon` 에 `plug` 이름이 없다(설계가 아이콘을 지정하지 않았다) | ✅ 구현함 — `link` 사용 | `Icon.tsx` `IconName` union 전수 확인 |
| 5 | 템플릿 단계를 지우면 `skills.instance.pickTemplate` 키가 고아가 된다 | ✅ 구현함 — ko·en 두 카탈로그에서 제거(grep 결과 사용처 0) | `grep -rn pickTemplate src/` = 정의 2건·사용 0건 |
| 6 | 목록 행의 점을 추가하면서 기존 텍스트를 지우면 색각 이상 사용자에게 정보가 사라진다 | ✅ 구현함 — 상세의 `연결됨`/`연결되지 않음` 라벨과 목록의 `N · M 연결됨` 을 **둘 다 유지**하고 점만 더했다 | §파생 UX a11y |
| 7 | 재연결 중 같은 커넥터에 제거가 겹칠 수 있다 | ✅ 구현함 — 기존 `busyId` 게이트를 재연결·연결해제·제거 전부에 적용 | `PluginDetail` |
| 8 | 메뉴가 열린 직후와 템플릿 0개가 화면상 같아 보인다 | ✅ 구현함 — `addMenuState` 가 `loading`/`empty` 를 갈라 각각 다른 문구 | `connectorAddMenu.test.ts` |

## [구현자 기입] 구현 체크리스트

- [x] `connectorActions.ts` — 점 색·액션 집합·재연결 순서 (+테스트 11케이스)
- [x] `connectorAddMenu.ts` — 행 구성·로딩/빈 상태·라벨 폴백 (+테스트 6케이스)
- [x] `ConnectorAddMenu.tsx` — Popover 메뉴 (skills 와 같은 role 구조)
- [x] `connectorInstance.ts` — `initialStep`/`initialDraft` → `draftForTemplate` (죽은 코드·테스트 제거)
- [x] `ConnectorInstanceModal.tsx` — `templateId` 필수 prop, 템플릿 단계 삭제, effect 제거
- [x] `ExtensionsCatalogView.tsx` — plugins 탭 드롭다운 + 메뉴 → 모달 배선
- [x] `PluginDetail.tsx` — `Dot` + 재연결/연결해제/제거 액션 분기
- [x] `CustomizeList.tsx` — 목록 행 `Dot`
- [x] i18n ko·en — `skills.connect.reconnect` 추가, 고아 `pickTemplate` 제거
- [x] 게이트 통과

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 5 (`lib/connectorActions.ts`+테스트 · `lib/connectorAddMenu.ts`+테스트 · `components/customize/ConnectorAddMenu.tsx`) + 수정 8 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint **0 error**(warning 1 = 0102 `useTranscriptVirtualizer` 베이스라인) · typecheck **3/3** · vitest **1740/1740 pass**(0161 의 1725 + 신규 15) · scripts **28/28** |
| 알려진 환경 실패 | `app/chat-turn.continuity.test.ts` 1파일 collection 실패 — electron 바이너리 egress 차단(코드 무관, `app/AGENTS.md` 베이스라인) |
| IPC | **85 유지 · 신규 채널 0개.** `IPC_CONTRACT.md` 무수정 |
| 신규 의존성 | **0개** |
| 사람 실기 대기 | AC1·2·5·6(앱 실행만 필요) · AC14(사내 Confluence DC 필요) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (아래 커밋 hash) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | | | |
