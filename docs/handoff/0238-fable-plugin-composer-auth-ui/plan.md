# Plan — 0238-fable-plugin-composer-auth-ui

## 메타

| 항목 | 값 |
|---|---|
| slug | `0238-fable-plugin-composer-auth-ui` |
| 작성자 | Codex — 사용자 지시로 설계 턴 수행 |
| 일자 | 2026-09-22 |
| 매핑 | 신규 기능 요청 3건 |
| 상태 | **IMPL_DONE** |
| V mode | `Baseline V` |
| 기준 V | `none` — 0224의 Fable 결정은 제품 선행 결정으로 대조하되 V는 상속하지 않는다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: Claude Harness의 Fable 지원이 계열 판정 일부에만 있어 settings 기본 alias와 `ANTHROPIC_DEFAULT_FABLE_MODEL` 경로가 끊겨 있고, Composer의 `@` 후보는 파일만 보여 내장 Plugin을 참조할 수 없다.
- 해결하려는 문제: Plugin 상세의 `연결`·`재인증`·`연결 해제`가 같은 헤더에 나란히 있어 일상 인증과 파괴적 해제가 같은 무게로 보이며, 사용자 지정 라벨·버튼 스타일과도 다르다.
- 완료 후 달라지는 것: Fable이 settings/runtime 모델 카탈로그와 두 모델 UI를 끝까지 통과하고, `@` 팝업이 Plugin과 경로를 그룹으로 나누며, Plugin 상세 인증 액션이 검정 기본 버튼과 빨간 해제 메뉴로 정리된다.
- 성공을 사용자 관점에서 한 문장으로: 사용자는 Fable을 다른 Claude 모델처럼 선택하고, `@<플러그인 식별자>`를 빠르게 입력하며, Plugin 상세에서 인증·재인증·연결 해제를 일관된 버튼 체계로 수행한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “Claude 하네스에 대해서 fable 모델도 지원하라 (composer 모델 선택, 엔진&모델 페이지 카드ui 지원, ANTHROPIC_DEFAULT_FABLE_MODEL, availableModels 인식)” | 2026-09-22 사용자 요청 1 |
| 명시 요구 | “플러그인 (내장 mcp도구) 에 대해서도 composer 입력에서 '@' 참조를 지원하도록 하라. 예시) '@<플러그인식별자> 사용자메시지~'.” | 2026-09-22 사용자 요청 2 |
| 명시 요구 | “‘@’입력시 나타나는 팝업에서 기존의 경로 표시와 구분되도록 그룹을 나누어 노출될 수 있어야 한다.” | 2026-09-22 사용자 요청 2 |
| 명시 요구 | “플러그인 항목을 클릭했을때, 우측 패널의 본문 상단에 '본문 타이틀' 우측에 인증 버튼”을 배치하고 `인증` → `재인증﹀`로 전환한다. | 2026-09-22 사용자 요청 3 |
| 명시 요구 | `인증`은 “제품 추가버튼(검정) 스타일”, `재인증﹀`은 “스킬탭의 추가버튼 참고”, 팝업의 `연결해제`는 제품 제거의 빨간 폰트 스타일을 따른다. | 2026-09-22 사용자 요청 3 |
| 추론 의도 | `플러그인식별자`는 화면 제목이 아니라 안정 식별자인 `ProviderInfo.id`다. 등록 시 kebab 소문자로 강제돼 공백 없는 `@` token에 안전하다. | `ipc.ts:1730-1750`, `auth/registry.ts:47-78`, `ProviderDetail.tsx:99-103` |
| 추론 의도 | `재인증﹀`은 스킬 탭의 결합형 dropdown 선례를 따르므로 팝업에 `재인증`과 `연결 해제`를 함께 둔다. 그래야 기존 재인증 기능을 잃지 않고 해제만 파괴적 메뉴로 내릴 수 있다. | `ExtensionsCatalogView.tsx:118-136`, `SkillAddMenu.tsx`, `MenuItem.tsx` |

### 요구가 지목한 레퍼런스 전수

| 사용자 표현 | 현재 레퍼런스 | 이 계획에서의 사용 |
|---|---|---|
| Composer 모델 선택 | `features/chat/components/composer/ModelMenu.tsx`, `modelSelection.ts`, `Composer.tsx` | Fable 행의 식별자·선택·실행 전달 경로 |
| 엔진&모델 페이지 카드 UI | `features/engine/components/{EngineCard,EngineModelList,AgentEnvironmentView}.tsx` | Fable alias·실제 모델명·1M·default 배지 렌더 |
| `ANTHROPIC_DEFAULT_FABLE_MODEL` | `main/features/harnesses/claude/model-parser.ts`의 `FAMILY_ORDER`·`ALIAS_ENV_KEY` | 네 번째 family env 키와 bare alias 후보 |
| `availableModels` 인식 | `model-parser.ts`의 `availableModelsOf`·`parseRuntimeModels`, `runtime-config.ts` | runtime/settings discovery에서 Fable family 유지 |
| 기존 `@` 경로 팝업 | `useFileAutocomplete.ts`, `FileAutocomplete.tsx`, `ComposerInputController.tsx` | 그룹형 mention 상태·키보드·선택 로직의 기준선 |
| 기존 `@` 경로 강조 | `ComposerInputSurface.tsx`, `ComposerDecorationLayer.tsx`, `composerDecoration.ts` | Plugin 식별자도 검증된 mention chip으로 표시 |
| Plugin 식별자·내장 MCP 도구 | `ProviderInfo.id/catalog/tools`, `connection-views.ts`의 `connectionInfo()` | `catalog`가 있고 `tools`가 비지 않은 row를 후보로 투영 |
| 본문 타이틀 우측 인증 버튼 | `features/skills/components/customize/ProviderDetail.tsx:49-85` | 헤더 우측 액션 영역을 재구성 |
| 검정 추가 버튼 | `ExtensionsCatalogView.tsx:118-136`의 `Button variant="primary"` | 미인증 `인증` 버튼의 정확한 primitive/variant |
| 스킬 탭 추가 dropdown | 같은 버튼의 `dropdown`·`expanded` + `SkillAddMenu.tsx` | 인증 후 `재인증﹀` trigger·Popover 패턴 |
| 빨간 제거 폰트 | `shared/ui/MenuItem.tsx`의 `danger`, `McpDetail.tsx`·`SkillDetail.tsx` 제거 행 | `연결 해제` 메뉴 항목의 색·hover·아이콘 톤 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | Claude model family는 `sonnet · opus · haiku · fable` 네 종류를 settings alias 후보로 지원한다. | “fable 모델도 지원”을 기본 모델 선택 표면까지 적용한다. | 사용자 요청 1 | ACTIVE | 0224 D-046의 “기본 alias 추가 아님” 부분 대체 |
| D-002 | `ANTHROPIC_DEFAULT_FABLE_MODEL`은 다른 family env 키와 같은 정규화·중복 제거·default 규칙을 사용한다. | 별도 Fable 분기를 만들면 1M·명시 모델 우선순위가 갈린다. | 사용자 요청 1 | ACTIVE | — |
| D-003 | 기존 default 우선순위 `sonnet → haiku → opus`는 유지하고 Fable은 마지막 fallback이다. | Fable 추가가 기존 provider의 기본 모델을 바꾸지 않게 한다. | 기존 TRD §6.8 + 최소 변경 | ACTIVE | — |
| D-004 | `availableModels`의 Fable은 shared family 분류와 `(모델명, 1M)` identity를 그대로 사용한다. | 현재 shared 분류는 이미 Fable을 알며 이를 우회할 이유가 없다. | 사용자 요청 1 + `model-identity.ts:37` | ACTIVE | — |
| D-005 | Composer Plugin 후보는 `ProviderInfo.catalog`가 있고 `tools.length > 0`인 내장 Plugin row다. | gate/harness/usage 연결과 도구 없는 행을 Plugin mention으로 오인하지 않는다. | 사용자 요청 2 + `auth.md §7·§9` | ACTIVE | — |
| D-006 | Plugin 참조 토큰은 `@${ProviderInfo.id}`이고 선택 시 뒤에 공백을 붙인다. 전송 text는 변환하지 않는다. | Auth registry가 id를 kebab 소문자로 강제하므로 plain token이 손실 없이 성립한다. | 사용자 요청 2 + `auth/registry.ts:47-78` | ACTIVE | — |
| D-007 | root plain `@partial` 팝업은 `플러그인` 그룹 뒤에 `경로` 그룹을 보여 준다. quoted 또는 `/` 포함 partial은 경로 탐색만 보여 준다. | Plugin id는 단일 토큰이고 경로 계층 진입과 충돌하지 않게 한다. | 사용자 요청 2 + 기존 경로 UX | ACTIVE | — |
| D-008 | Plugin 인증 상태와 무관하게 후보를 유지하며, provider state를 못 읽으면 경로 자동완성만 계속 동작한다. | `tools`는 invalid Auth에서도 cached descriptor를 유지하는 현재 계약이다. | `auth.md §7`, `plugins.ts:28-36` | ACTIVE | — |
| D-009 | 미인증 상세 헤더에는 `인증` 검정 primary 버튼 하나를 둔다. | 사용자가 제품 추가 버튼 스타일을 직접 지정했다. | 사용자 요청 3 | ACTIVE | — |
| D-010 | 인증 이력이 있으면 `재인증﹀` 검정 primary dropdown을 두고 메뉴에 `재인증`, `연결 해제`를 둔다. | 기존 재인증 능력을 보존하면서 파괴적 해제를 dropdown으로 내린다. | 사용자 요청 3 + 보존 원칙 | ACTIVE | — |
| D-011 | `연결 해제`는 공용 `MenuItem danger`를 사용하고 실행 전에 메뉴를 닫는다. 별도 확인 모달은 추가하지 않는다. | 빨간 제거 폰트 선례를 그대로 재사용하고 기존 해제 동작 범위를 바꾸지 않는다. | 사용자 요청 3 + 현행 즉시 revoke | ACTIVE | — |
| D-012 | 신규 IPC·DB·마이그레이션·패키지 의존성은 추가하지 않는다. | 필요한 모델·Plugin 데이터가 현행 `orca:agent:list`와 provider state에 이미 있다. | 코드 조사 | ACTIVE | — |
| D-013 | 0224 D-046의 Fable family 인식·점/하이픈 버전 지원은 유지한다. | 이번 요청은 그 결정을 확장하며 자동 승인 판정을 되돌리지 않는다. | `0224-work-agent-layer/plan.md:1064` | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-012.
- 변경된 결정: 0224 D-046의 “기본 alias/env 추가는 아님”을 D-001·D-002가 대체한다. family 분류·자동 승인 부분은 D-013으로 유지한다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 모델 identity의 `[1m]` 축, Plugin tools의 invalid-auth 정적 표시, provider row의 기존 인증 lifecycle.
- **ACTIVE 결정 ↔ AC 대조: 충돌 0.** D-001~D-004↔AC1~AC5, D-005~D-008↔AC6~AC12, D-009~D-011↔AC13~AC16, D-012~D-013↔AC17~AC18.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당. Fable의 원인은 parser의 3-family 후보/env map이고, Plugin mention 부재의 원인은 file-only `@` 상태 모델이다. | `model-parser.ts:24-34`, `useFileAutocomplete.ts:7-12` |
| 이미 기존 코드가 충족하는가 | 부분 충족. Fable discovery·권한 판정은 이미 있고, env alias·empty-settings·Engine card 보장은 없다. | `model-parser.test.ts:389-399`, `modes.r7.test.ts:12-52` |
| 더 작은 해법이 있는가 | 있다. wire를 늘리지 않고 `ProviderInfo.id/catalog/tools`를 renderer에서 투영한다. | `ipc.ts:1730-1750`, `connection-views.ts:62-82` |
| 선행 자료의 주장을 코드와 대조했는가 | 대조 완료. 0224 D-046의 “기본 alias/env 추가 아님”은 코드의 3-family map과 일치한다. | `0224 plan:1064`, `model-parser.ts:24-34` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 사용자 요청이 0224의 제한을 명시적으로 확장한다. 기존 default 우선순위·1M identity·Auth lifecycle은 보존한다. | D-001~D-004, D-013 |

- 사용자에게 올릴 결정: 없음. `재인증﹀`의 메뉴는 기능 보존을 위해 `재인증`·`연결 해제` 두 행으로 해석했다.
- 코드 조사로 닫은 사실: Plugin 식별자는 `ProviderInfo.id`, Plugin 판별자는 `catalog`, 내장 도구 존재는 `tools`, UI 스타일 선례는 공용 `Button primary/dropdown`·`MenuItem danger`다.

## 5. 동작 / 사용자 흐름

```text
[settings 또는 runtime에서 Fable 발견]
  → [ParsedModel → AgentModelView]
  → [Composer 모델 메뉴 + 엔진 카드]
  → [선택한 identity가 SDK model로 전달]

[Composer에서 @ 입력]
  → [Plugin provider snapshot + cwd 경로 listing]
  → [플러그인 / 경로 그룹 popup]
  → [Plugin 선택: @id + 공백, 경로 선택: 기존 규칙]
  → [원문 text 전송]

[Plugin 상세 열기]
  → [status none: 인증]
  → [status non-none: 재인증﹀]
  → [메뉴에서 재인증 또는 빨간 연결 해제]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| settings 모델 키가 전무 | 네 family bare alias를 만들고 기존 우선순위로 default 하나를 고른다. | 두 모델 UI에 Fable을 포함한 선택지가 보이고 Sonnet default는 유지된다. |
| `ANTHROPIC_DEFAULT_FABLE_MODEL=X` | X를 Fable family로 정규화하고 1M·명시 default 규칙을 적용한다. | Composer와 Engine 카드에 실제 X가 Fable로 보인다. |
| runtime `availableModels`에 Fable | shared family 판정으로 `alias:'fable'`을 만든다. | read-only runtime 카드와 Composer에 같은 identity가 보인다. |
| root에서 `@` 또는 `@prefix` | Plugin 후보와 cwd root 경로를 같은 snapshot에서 필터한다. | 두 그룹 헤더와 선택 가능한 행이 열린다. |
| quoted partial 또는 `/` 포함 path partial | Plugin 그룹을 제외하고 기존 디렉토리 listing을 진행한다. | 경로 그룹만 보이며 quoted wrapping·단계 진입이 유지된다. |
| cwd 없음 + Plugin 후보 있음 | 파일 IPC를 호출하지 않고 Plugin 후보만 계산한다. | Plugin 그룹 popup은 계속 열린다. |
| provider state 실패 + cwd 있음 | Plugin 후보를 빈 목록으로 두고 파일 listing을 유지한다. | 경로 그룹은 정상이고 Plugin 그룹은 숨는다. |
| Plugin status `none` | `login` 콜백을 직접 호출하는 primary 버튼을 렌더한다. | 제목 우측에 `인증`이 보인다. |
| Plugin status `valid/expired/unknown` | dropdown을 열고 두 auth action을 제공한다. | `재인증﹀`와 메뉴의 `재인증`·빨간 `연결 해제`가 보인다. |
| 메뉴 action 선택 | 먼저 popup을 닫고 기존 reauth/revoke callback을 호출한다. | 이전 단계 popup이 남지 않고 기존 인증 폼·상태 push가 이어진다. |

### 파생 UX / 엣지케이스

- loading / empty / error: path listing 중이면 기존 spinner를 유지한다. 두 그룹이 모두 비면 `일치하는 항목 없음`, 한 그룹만 비면 빈 그룹 header는 렌더하지 않는다.
- cancel / retry / close / restart: Esc는 현재 partial을 dismiss하고 partial 변경 시 재개한다. provider 상태는 재시작 후 초기 `state()` snapshot으로 다시 채운다.
- concurrency / multi-session: Plugin subscription은 active Composer에서만 살아 있고 비활성화·unmount에서 해제한다. 늦은 provider/file 응답은 owner가 바뀌면 버린다.
- keyboard / a11y / theme: 그룹 header는 선택 index에서 제외하고 행만 ↑/↓ 순환한다. popup은 기존 `role=listbox/option`, auth dropdown은 `aria-expanded`·`role=menu/menuitem`을 쓴다.
- 외부환경/오프라인/폐쇄망: 신규 네트워크 요청은 없다. provider state는 local IPC push이며 Fable settings 파싱도 local이다.

## 6. 범위 / 비범위

- **범위**: Claude Fable family의 settings/runtime 열거·Composer 선택·Engine 카드, grouped `@` Plugin/path autocomplete와 chip, Plugin 상세 auth action 재배치, 관련 i18n·현재상태 문서·테스트.
- **비범위**: Plugin 자동 호출·tool allowlist 변경, `@id`를 별도 backend AST로 변환, 사용자 정의 MCP 서버를 Plugin 그룹에 합치기, Plugin 식별자 변경·migration, Auth protocol·vault·probe 변경, 새 split-button primitive.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `@plugin` backend semantic expansion | 아니오 — 현재 요청은 Composer 참조 UI이고 raw text 계약으로 닫힌다. | 후속 제품 요구가 생기면 별도 handoff |
| 사용자 MCP 서버 mention | 아니오 — 사용자 요청은 내장 Plugin이고 현행 `McpServer`는 다른 탭·수명주기다. | 비범위 |
| 연결 해제 확인 모달 | 아니오 — 현행 즉시 해제 의미를 유지한다. | 비범위 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 빈 Claude settings는 Fable을 포함한 네 bare alias를 노출하고 Sonnet만 default다. | parser·settings 열거 테스트가 alias 순서, `model:null`, default 1개를 단언한다. | settings dir → `parseClaudeModels` → `toAgentEnvironment` |
| R-01 | AT-02 / AC2 | `ANTHROPIC_DEFAULT_FABLE_MODEL=X`는 Fable 한 행을 만들고 X·`[1m]`·default를 보존한다. | parser 테스트가 base/1M 두 입력과 duplicate 음성을 단언한다. | settings env → `ALIAS_ENV_KEY` → ParsedModel |
| R-01 | AT-03 / AC3 | `availableModels`의 점/하이픈 Fable과 1M 변형은 custom이 아닌 Fable identity로 유지된다. | settings/runtime parser 테스트가 alias·isCustom·identity·dedupe를 단언한다. | runtime cache/settings discovery → parser → catalog |
| R-01 | AT-04 / AC4 | Composer 모델 메뉴에서 Fable 행을 선택하면 exact identity와 alias가 선택·실행 경로로 전달된다. | ModelMenu/modelSelection render·unit test가 라벨, active row, callback 4필드를 단언한다. | `orca:agent:list` → agentStore → ModelMenu → `setModel` |
| R-01 | AT-05 / AC5 | 엔진 카드가 Fable alias·실제 모델명·1M·default 배지를 함께 렌더한다. | 신규 EngineModelList render test가 각 위치와 sibling 맞바꿈을 구분한다. | agent list → AgentEnvironmentView → EngineCard → EngineModelList |
| R-02 | AT-06 / AC6 | root `@partial`은 Plugin과 경로를 별도 group header 아래 동시에 보여 준다. | 순수 후보/flatten 테스트와 popup render test가 그룹 순서·행 귀속을 단언한다. | Composer text/caret → mention hook → MentionAutocomplete |
| R-02 | AT-07 / AC7 | Plugin 후보는 `catalog`가 있고 `tools`가 비지 않은 row만 포함하며 status와 무관하다. | 네 status × catalog/tools matrix가 포함/제외와 id를 단언한다. | provider state → candidate projector → Plugin group |
| R-02 | AT-08 / AC8 | Plugin을 선택하면 현재 token range만 `@id `로 바뀌고 caret이 공백 뒤로 이동한다. | 순수 replacement 테스트가 앞/뒤 text·caret·identity를 단언한다. | option pick → draft range replacement → textarea |
| R-02 | AT-09 / AC9 | quoted·slash path는 Plugin을 숨기고 기존 directory/quote/hidden-file/8-path 규칙을 유지한다. | 기존 hook 케이스를 rename 후 재사용하고 Plugin 후보가 있어도 path 결과가 동일함을 단언한다. | text/caret/cwd → fileApi.list → Path group |
| R-02 | AT-10 / AC10 | cwd가 없어도 Plugin 후보가 있으면 popup이 열리고, provider 실패 시 cwd 경로는 계속 동작한다. | hook lifecycle 테스트가 두 fail-soft 방향과 IPC 호출 횟수를 단언한다. | active Composer → providerApi/fileApi → popup |
| R-02 | AT-11 / AC11 | ↑/↓·Tab/Enter·Esc는 두 그룹의 flattened option만 대상으로 동작한다. | controller keyboard test가 header 제외 index와 각 kind dispatch를 단언한다. | textarea keydown → active suggestion → apply/close |
| R-02 | AT-12 / AC12 | 선택된 `@id`는 Plugin이 목록에 있는 동안 검증 chip으로 보이고 제출 text는 그대로다. | decoration unit test와 submit callback test가 chip kind와 원문 동일성을 단언한다. | known Plugin ids → decoration; draft → onSend |
| R-03 | AT-13 / AC13 | status `none`이면 제목 우측에 `인증` primary 버튼 하나만 보이고 login을 호출한다. | auth action model/render test가 label·variant·action과 dropdown 부재를 단언한다. | ProviderDetail → ProviderAuthActions → `providers.login` |
| R-03 | AT-14 / AC14 | status `valid/expired/unknown`이면 제목 우측에 `재인증﹀` primary dropdown 하나가 보인다. | status matrix render test가 primary/dropdown/expanded와 기존 별도 revoke 버튼 부재를 단언한다. | ProviderDetail → canManageAuth → dropdown trigger |
| R-03 | AT-15 / AC15 | dropdown menu의 `재인증`은 reauth, 빨간 `연결 해제`는 revoke를 정확히 한 번 호출한다. | action model/component test가 item 순서·callback·danger를 단언한다. | Popover MenuItem → parent callbacks → providerApi |
| R-03 | AT-16 / AC16 | auth 메뉴 action은 popup을 먼저 닫고 기존 input/code/failed 단계 UI를 유지한다. | state/action test와 ProviderDetail regression render가 step body가 함께 남는지 단언한다. | menu close → useProviders requestSeq → step render |
| R-04 | AT-17 / AC17 | TRD·frontend UX·backend Auth·폐쇄망 guide가 네 family와 grouped Plugin mention의 현재 동작을 같은 용어로 설명한다. | 문서 anchor grep과 doc inventory check가 stale 3-family 문구·옛 `@=path only`를 검출한다. | 구현자/배포자 문서 진입점 → 코드 경로 |
| R-04 | AT-18 / AC18 | 기존 Fable 자동 승인, 파일 `@`, Provider auth lifecycle은 회귀하지 않는다. | 관련 기존 suites와 full lint/typecheck가 shared identity·path lifecycle·requestSeq를 재검증한다. | 기존 production path 전부 |

### AC 검증 주의사항

- 기존 테스트 재사용: `model-parser.test.ts`의 “r6 Fable discovery classification”, `modes.r7.test.ts`의 settings/runtime Fable, `useFileAutocomplete.test.ts`의 owner·quote·8개 상한, `providerRows.test.ts`의 4-status matrix가 실제 존재한다.
- 사람 실기 항목: 두 테마에서 group header·Fable 카드·auth dropdown 배치와 popup clipping을 확인한다. 후보 계산·상태 전이·선택 text는 사람 실기로 미루지 않는다.
- N회/총량 기준: 신규 네트워크 요청 0. active Composer 하나당 provider 초기 invoke 1 + provider push subscription 1이며 keystroke당 provider IPC 0, file listing은 기존 dir cache당 1회를 유지한다.
- 총량/0건 기준: `@` popup의 visible option은 `P + min(F,8)`이며 P는 조건을 만족한 Plugin row, F는 현재 directory prefix 일치 경로다. header는 option 수에 포함하지 않는다.

## 7-A. V / Trace Matrix

- V mode 판정: 세 사용자 관측 결과와 production 경계·모듈 불변식이 모두 새 계약이므로 `Baseline V`다.
- 기준 V 상속 근거: 없음. 0224 D-046은 prior decision으로만 대조하고 이 작업의 세 기능을 함께 설명하는 기존 V는 없다.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §1·§7 Fable 전표면 지원 | NEW | — |
| AT-01 | AT | AC1~AC5 | NEW | — |
| R-02 | R | §5·§7 grouped Plugin mention | NEW | — |
| AT-02 | AT | AC6~AC12 | NEW | — |
| R-03 | R | §5·§7 Plugin auth action UX | NEW | — |
| AT-03 | AT | AC13~AC16 | NEW | — |
| R-04 | R | §7 current-state 문서·회귀 | NEW | — |
| AT-04 | AT | AC17~AC18 | NEW | — |
| SD-01 | SD | §9 Fable catalog end-to-end | NEW | — |
| ST-01 | ST | settings/runtime→두 UI→선택 종단 | NEW | — |
| SD-02 | SD | §9 mention source·caret·dismiss lifecycle | NEW | — |
| ST-02 | ST | provider/file source→popup→draft→submit 종단 | NEW | — |
| SD-03 | SD | §9 auth status→action→step/push lifecycle | NEW | — |
| ST-03 | ST | Plugin detail→provider API→detail 갱신 종단 | NEW | — |
| AR-01 | AR | §9·§10 model producer/consumer 경계 | NEW | — |
| IT-01 | IT | settings/runtime catalog와 두 renderer 소비자 | NEW | — |
| AR-02 | AR | §9·§10 ProviderInfo→chat mention 경계 | NEW | — |
| IT-02 | IT | provider state와 file listing의 grouped 조립 | NEW | — |
| AR-03 | AR | §9·§10 ProviderDetail auth callback 경계 | NEW | — |
| IT-03 | IT | status별 버튼/menu와 useProviders callback 배선 | NEW | — |
| MD-01 | MD | §10·§11 four-family parser invariant | NEW | — |
| UT-01 | UT | parser/default/dedupe matrix | NEW | — |
| MD-02 | MD | §10·§11 mention token·group·replacement | NEW | — |
| UT-02 | UT | candidate/flatten/replacement pure tests | NEW | — |
| MD-03 | MD | §10·§11 mention decoration invariant | NEW | — |
| UT-03 | UT | Plugin/file chip tokenization tests | NEW | — |
| MD-04 | MD | §10·§11 auth action model/menu | NEW | — |
| UT-04 | UT | status/action/danger render tests | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | settings/runtime → catalog → Composer/Engine → selected model | AC1~AC5 behavior tests + 두 테마 실기 | required — Fable env map 제거·Engine sibling badge 맞바꿈 | EP-01·02 (7) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `@`+sources → grouped options → draft → submit | AC6~AC12 hook/render/submit tests | required — group 귀속 맞바꿈·id 대신 title 삽입 | EP-03·04 (8) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | Provider status → header/dropdown → login/reauth/revoke | AC13~AC16 status/action tests + 시각 실기 | required — none/non-none branch 맞바꿈·danger 제거 | EP-05 (5) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | current docs/tests → implementation/verification readers | doc inventory + stale phrase grep + existing suites | required — 3-family/`@ path only` 문구 잔존 | EP-06 (6) |
| VP-05 | SD-01 ↔ ST-01 | REQUIRED | parse source → ParsedModel → AgentModelView → both UIs → setModel | settings/runtime integration + renderer render tests | not selected — 종단 직접 oracle이 각 edge 값을 단언 | EP-01·02 (7) |
| VP-06 | SD-02 ↔ ST-02 | REQUIRED | provider state/file list → owner snapshot → option → range replacement | hook owner test + controller dispatch + submit text | required — 늦은 source owner·header index 결함 | EP-03·04 (8) |
| VP-07 | SD-03 ↔ ST-03 | REQUIRED | status → action → providerApi → pushed step/state | action callbacks + 기존 useProviders requestSeq tests | required — close/callback 순서 역전 | EP-05 (5) |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | settings/runtime producers → shared identity → renderer consumers | parser + toAgentEnvironment + UI integration | required — parser만 Fable 제거 | EP-01·02 (7) |
| VP-09 | AR-02 ↔ IT-02 | REQUIRED | connectionInfo DTO → providerApi state → chat projector → popup | DTO fixture with gate/harness/plugin/empty-tools rows | required — `catalog` 또는 `tools` 필터 하나 제거 | EP-03 (2) |
| VP-10 | AR-03 ↔ IT-03 | REQUIRED | ProviderDetail props → auth actions → useProviders methods | callback identity/count test | required — reauth/revoke callback 맞바꿈 | EP-05 (5) |
| VP-11 | MD-01 ↔ UT-01 | REQUIRED | four-family tables → normalized rows/default | exhaustive env/discovery matrix | required — default order에 Fable을 앞세움 | EP-01 (4) |
| VP-12 | MD-02 ↔ UT-02 | REQUIRED | token parse → groups → flattened index → replacement | pure tests for plain/quoted/slash/caret | required — header를 option으로 계산 | EP-04 (6) |
| VP-13 | MD-03 ↔ UT-03 | REQUIRED | known ids/paths → token hits → chip segments | joined-text equality + kind/position assertions | required — Plugin/file validity set 맞바꿈 | EP-04 하위 (2) |
| VP-14 | MD-04 ↔ UT-04 | REQUIRED | status model → trigger/items/tone | status matrix + menu render | required — danger 제거·menu item 순서 맞바꿈 | EP-05 (5) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| renderer/main 관련 Vitest | parser·hooks·pure transforms·render 구성 변경 | `npx.cmd vitest run <§19 대상>` | 변경 suite 또는 명시 회귀의 실패만 blocking |
| renderer/main typecheck | DTO 재사용·discriminated union·callback 배선 | `npm.cmd run typecheck` | 신규 타입 오류 blocking |
| lint/boundaries | chat↔skills 교차 import 금지와 hooks 규칙 | `npm.cmd run lint` | 현재 변경 error blocking, 기존 warning 분리 |
| 문서 inventory | current docs 상대 링크·수치 위생 | `node scripts/check-doc-inventory.mjs --check` | 변경 문서가 만든 실패 blocking |
| repository/message-bus | plan/INDEX/trailer 정합 | `git diff --check`, trailer parse | 현재 handoff 산출 불일치 blocking |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| Fable은 shared family와 자동 승인에는 이미 있지만 settings alias/env table에는 없다. | `model-identity.ts:37-43`, `model-parser.ts:24-34` |
| 현재 Fable 테스트는 `ANTHROPIC_MODEL`·`availableModels` discovery만 보며 bare alias/env는 의도적으로 부정한다. | `model-parser.test.ts:389-399`, `modes.r7.test.ts:12-52` |
| 모델 wire는 ParsedModel 필드를 변환 없이 AgentModelView로 옮긴다. | `main/features/harnesses/models.ts:69-87` |
| Composer와 Engine 모델 UI는 generic `agent.models`를 순회하므로 family 전용 JSX가 필요 없다. | `ModelMenu.tsx:44-78`, `EngineModelList.tsx:12-32` |
| EngineModelList key는 현재 1M identity를 포함하지 않는다. | `EngineModelList.tsx:14` |
| `@` parser·file listing·popup·keyboard·chip은 file 전용 이름과 타입으로 연결돼 있다. | `useFileAutocomplete.ts`, `FileAutocomplete.tsx`, `ComposerInputController.tsx:180-310` |
| Plugin row의 stable id·catalog·완전 도구 이름은 이미 ProviderInfo 한 DTO에 있다. | `ipc.ts:1730-1750`, `connection-views.ts:62-82` |
| Auth id는 등록 시 `^[a-z0-9]+(?:-[a-z0-9]+)*$`로 강제돼 whitespace·quote wrapping이 필요 없다. | `features/auth/registry.ts:47-78` |
| invalid Auth에서도 Plugin tools는 정적 descriptor에서 유지된다. | `deployment/plugins.ts:28-36`, `auth.md §7` |
| Provider 상세는 현재 non-none status에서 재인증·연결 해제 버튼을 나란히 렌더한다. | `ProviderDetail.tsx:71-84`, `providerRows.ts:42-53` |
| 요구한 검정·dropdown·빨간 메뉴 스타일은 공용 primitive로 이미 존재한다. | `Button.tsx`, `MenuItem.tsx`, `ExtensionsCatalogView.tsx:118-136` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| settings family 후보/env key | `rg 'FAMILY_ORDER|ALIAS_ENV_KEY' model-parser.ts` | 2 tables, 현재 family 3 | 둘을 함께 늘려야 env와 fallback이 갈리지 않는다. |
| shared Claude family | `rg 'CLAUDE_MODEL_FAMILIES' app/src` | 선언 1 + 소비 2 | discovery·자동 승인 SSOT는 이미 Fable 포함이다. |
| 직접 모델 UI consumer | `rg 'agent\.models|models\.map' renderer` 후 테스트 제외 | 5 | Composer default/menu, Engine list, Settings usage가 wire 증가 영향을 받는다. |
| `@` file production surface | `rg 'useFileAutocomplete|FileAutocomplete|validFilePaths|tokenizeComposerDecoration'` | 6 files | hook·popup·controller·surface·layer·tokenizer를 같은 변경으로 닫아야 한다. |
| provider state renderer subscription | `rg 'providerApi\.onState' renderer` | 4 | 신규 chat subscription은 active lifecycle을 가져야 중복 상주를 피한다. |
| Provider auth action sink | `rg 'onLogin|onReauth|onRevoke' ProviderDetail/ExtensionsCatalogView` | 각 1 production binding | 세 callback identity를 그대로 유지한다. |
| 요구 UI 스타일 선례 | primary add, dropdown add, `MenuItem danger` 직접 확인 | 3 patterns | 새 스타일 literal 없이 primitive를 재사용한다. |

### 수치 / 전칭 표현 검산

- 재측정 수치: parser settings family는 현재 3, shared discovery family는 4, `@` file surface는 6파일, provider push 구독은 4곳이다.
- 내역 합 = 총계: 모델 직접 UI consumer 5 = Composer default 1 + ModelMenu 1 + modelSelection 1 + EngineModelList 1 + UsageTab 1.
- “Plugin만” 반례 검색: `ProviderInfo.catalog` producer는 `connectionInfo()`의 `source.category === 'plugin'` 분기 한 곳이며 non-plugin row에는 필드가 없다.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `TRD.md` 모델 파싱 규약, `ux-domains.md §1.1·§1.2·Agent/model UX`, `auth.md §7·§9`, 위 AC 주의사항의 네 기존 suite를 열어 확인했다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01~03`, `AR-01~03`.
- 현재 책임 소유자: model parser는 main harness feature, `@`는 renderer chat feature, auth header는 renderer skills feature가 소유한다.
- 현재 entry → data/control flow → state/store → consumer: Fable discovery는 shared classifier를 타지만 settings family table에서 끊긴다. `@`는 cwd file listing만 읽고 Plugin provider state는 읽지 않는다.
- 현재 오류/취소/정리 경로: file request owner cancellation과 provider auth requestSeq는 각각 존재한다. 두 기능은 아직 합류하지 않는다.
- 문제의 직접 원인 또는 구조적 제약: 새 wire가 필요한 것이 아니라 기존 두 producer를 Composer가 함께 투영하는 local projection이 없다.

```text
settings env ──> 3-family parser ──> AgentModelView ──> Composer / Engine
availableModels ─> 4-family classifier ────────────────┘

Composer @ ──> cwd fileApi.list ──> FileAutocomplete ──> @path
provider state ──> Plugins page only

ProviderDetail status ──> [재인증] [연결 해제]
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01~03`, `AR-01~03`.
- 변경 후 책임 소유자: model family tables는 main/shared 현 위치를 유지하고, Plugin mention projection은 chat feature 안의 순수 모듈·active hook이 소유한다. auth action component는 skills feature 안에 둔다.
- 변경 후 entry → data/control flow → state/store → consumer: settings/runtime 모델은 같은 ParsedModel path로 두 UI에 도달한다. provider snapshot과 file listing은 `MentionSuggestion` union으로 합쳐 popup·keyboard·decoration에 한 번만 전달한다.
- 변경 후 오류/취소/정리 경로: active Composer만 provider state를 구독하고 owner가 바뀐 async 결과를 버린다. auth menu는 close 후 기존 callback에 위임한다.
- 유지하는 기존 메커니즘과 제거/대체하는 메커니즘: ProviderInfo wire·file dir cache·draft revision·useProviders lifecycle은 유지한다. file-only hook/component 이름과 나란한 auth 버튼은 grouped mention/auth dropdown으로 대체한다.

```text
settings env / availableModels
  → four-family parser + shared identity
  → AgentModelView
  → Composer ModelMenu / EngineModelList
  → exact model identity

providerApi state ─┐
                   ├→ chat mention projector → grouped MentionAutocomplete → draft raw text
cwd fileApi.list ──┘

ProviderDetail status → ProviderAuthActions
  ├ none → [인증]
  └ non-none → [재인증﹀] → {재인증, 연결 해제(danger)}
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| model family | settings 3, discovery 4 | settings/discovery 4 | Fable 전표면 지원 | AR-01 / VP-08·11 |
| model UI | generic 렌더지만 Fable env 입력 없음·Engine key 1M 미포함 | Fable fixtures와 identity key로 카드/선택 잠금 | 카드 UI 요구와 identity 보존 | R-01 / VP-01·05 |
| mention source | cwd file만 | Plugin provider + cwd file | 내장 MCP Plugin 참조 | AR-02 / VP-09 |
| mention state | file entry 단일 배열 | discriminated union + group/flat view | keyboard와 삽입 kind 혼동 방지 | MD-02 / VP-12 |
| decoration | known path만 | known path + known Plugin id | 선택 token 피드백 | MD-03 / VP-13 |
| auth header | 재인증·해제 병렬 | primary direct/dropdown + danger menu | 지정된 위계·스타일 | AR-03 / VP-03·10·14 |
| error/lifecycle | file cancel, provider requestSeq 분리 | active provider subscription + 기존 file/requestSeq 유지 | stale update·상주 구독 방지 | SD-02·03 / VP-06·07 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| main `claude/model-parser.ts` | four-family settings/runtime 모델 정규화 | settings/runtime config → ParsedModel[] | harness settings/runtime catalog |
| shared `model-identity.ts` | family 분류·identity·자동 승인 | 최소 model shape → string/boolean | main parser/models + renderer |
| chat `pluginMention.ts` | ProviderInfo를 안전한 Plugin 후보로 투영 | ProviderInfo[] → PluginMention[] | chat mention hook |
| chat `mentionAutocomplete.ts` | token parse·group·flatten·replacement 순수 규칙 | text/caret/sources → model/update | hook/controller tests |
| chat `useMentionAutocomplete.ts` | provider subscription·file listing owner lifecycle | active/text/caret/cwd → UI state | ComposerInputController |
| chat `MentionAutocomplete.tsx` | 그룹 header와 option 렌더 | grouped state + callbacks | ComposerInputController |
| skills `ProviderAuthActions.tsx` | status별 trigger/menu/action | status/authKind/callbacks → UI | ProviderDetail |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| MD-01 / VP-11 | family=`sonnet|opus|haiku|fable`, env key, fallback priority | `model-parser.ts` + shared family const | parser | settings/runtime parse | **EP-01 4곳** 중 하나가 빠지면 source별 목록·default가 갈린다. |
| AR-01 / VP-08 | ParsedModel identity가 두 UI까지 보존 | `modelIdentity`·`toAgentEnvironment` | main + renderer | list/selection/render | **EP-02 3곳**: wire 1 + Composer 1 + Engine 1. |
| AR-02 / VP-09 | Plugin candidate=`catalog present ∧ tools.length>0`, token=`@id` | `ProviderInfo` + `pluginMention.ts` | connection view + chat | state snapshot/push | **EP-03 2곳**: DTO producer + candidate projector. |
| MD-02 / VP-12 | suggestion union과 flattened index; headers non-option | `mentionAutocomplete.ts` | hook/controller/popup | parse/filter/key/pick | **EP-04 6곳**: parse, group, flatten, replace, keyboard, decoration. |
| MD-03 / VP-13 | Plugin id와 path는 서로 다른 validity set | `composerDecoration.ts` | decoration layer | deferred render | path set으로 Plugin을 검증하거나 그 반대면 잘못된 chip이 생긴다. |
| AR-03 / VP-10 | none=`login`; non-none menu=`reauth`,`revoke` | `ProviderAuthActions` action model | ProviderDetail | render/click | **EP-05 5곳**: predicate, direct trigger, dropdown, reauth item, danger revoke item. |
| R-04 / VP-04 | ko/en key와 current docs가 새 계약을 설명 | ko SSOT + en structural parity + docs | renderer/docs | typecheck/doc gate | **EP-06 6곳**: ko, en, TRD, frontend UX, backend Auth, closed-network guide. |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT와 공유 방법: family/identity는 `shared/model-identity.ts`, settings env table은 parser 한 곳, Plugin 후보 술어는 chat 순수 projector 한 곳, danger tone은 공용 `MenuItem`을 쓴다.
- `실패 의미`에 “다른 게이트가 막는다”를 적었다면 그 범위를 이 턴에 측정한 근거: 해당 없음.
- 선택적 필드의 `true/false/undefined` 의미: `catalog===undefined`는 Plugin 아님, `tools=[]`는 mention 대상 아님, cwd `null`은 path group 없음이지 popup 전체 닫힘이 아니다.
- 외부 SDK 경계의 실제 요구 타입/의미: SDK model은 `modelIdentity` 문자열 그대로다. Plugin `@id`는 user text이며 SDK option·MCP config를 바꾸지 않는다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/features/harnesses/claude/model-parser.ts` | four-family parser | Fable family/env/default fallback 추가, 기존 우선순위 뒤에 배치 | parser pure unit |
| `model-parser.test.ts`, `settings.test.ts` | source matrix | 3-family 기대를 4-family로 갱신하고 Fable env/discovery/1M/dedupe 추가 | Vitest |
| `app/src/renderer/src/features/engine/components/EngineModelList.tsx` | model card rows | key를 `modelIdentity`로 통일하고 Fable generic render 유지 | 신규 render test |
| `ModelMenu.tsx`, `modelSelection.test.ts`, `modes.r7.test.ts` | Composer model selection | production은 generic 경로 유지, Fable exact selection 회귀 강화 | render + unit |
| `chat/lib/pluginMention.ts` (신규) | candidate projection | catalog/tools filter와 id projection | pure unit |
| `chat/lib/mentionAutocomplete.ts` (신규) | token/group/flatten/update | plain/quoted/slash와 Plugin/file union 규칙 | pure unit |
| `chat/hooks/useMentionAutocomplete.ts` (대체) | async source lifecycle | 기존 file cache/cancel + active provider state subscription | hook fixture |
| `composer/MentionAutocomplete.tsx` (대체) | grouped popup | Plugin/경로 header·loading·empty·option roles | static render |
| `ComposerInputController.tsx` | orchestration | unified state·keyboard·kind별 apply·known Plugin ids 전달 | controller tests |
| `ComposerInputSurface.tsx`, `ComposerDecorationLayer.tsx`, `composerDecoration.ts` | chip projection | Plugin validity set와 chip kind 추가 | tokenizer/layer tests |
| `skills/components/customize/ProviderAuthActions.tsx` (신규) | auth action UI | primary direct/dropdown, reauth/revoke menu | action/render tests |
| `ProviderDetail.tsx` | detail composition | 헤더 우측에 auth action component 조립 | existing render regression |
| `resources/{ko,en}.ts` | UI 문구 | 인증·Plugin/경로 그룹·mention aria 키 정렬 | key parity test |
| `docs/TRD.md` | model parsing contract | 4 family/env/default 규약 | doc gate |
| `docs/arch/frontend/ux-domains.md` | Composer/model current state | grouped mention·Fable UI 경로 | doc gate |
| `docs/arch/backend/auth.md` | Plugin view consumer | `catalog/tools/id`의 Composer read-only 투영 | doc gate |
| `docs/guides/closed-network-extensions.md` | deployment recipe | optional Fable env/availableModels 예제 | doc gate |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: `pluginMention.ts`와 `mentionAutocomplete.ts`는 React·IPC를 import하지 않는다.
- 기존 메커니즘 재사용 시 형상/시점 적합성: provider state는 Plugin 페이지와 같은 DTO/push를 쓰되 chat은 auth action을 import하지 않는다. renderer feature 교차 import를 만들지 않는다.
- 순서를 관측할 훅/로그/주입 경계: hook fixture의 provider/file deferred owner, flattened option 배열, action model callback spy가 순서를 관측한다.

## 12. End-to-end 영향

### producer → consumer

```text
settings/runtime config
  → parseClaudeModels/parseRuntimeModels
  → toAgentEnvironment
  → agentStore
  → ModelMenu + EngineModelList

ConnectionViewSource(plugin)
  → ProviderInfo{id,catalog,tools,status}
  → providerApi state/push
  → pluginMentionCandidates
  → MentionAutocomplete
  → draft/onSend
```

- producer 기준: model source는 parser가 family/identity/default를 확정한다. Plugin producer는 `connectionInfo()`가 plugin category에만 catalog와 cached tool names를 싣는다.
- consumer 파생 규칙: Composer는 Plugin 여부를 `catalog && tools.length`로만 파생하고 status를 후보 존재 조건으로 사용하지 않는다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: popup label이나 localized title에서 id를 재구성하지 않는다. `ProviderInfo.id`를 직접 삽입한다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| settings provider list | 빈/손상 settings가 모델 4행이 된다. 기존 default는 Sonnet이라 선택 변화는 없다. | AC1·AC18 |
| Composer default/model menu | Fable 행이 추가되며 selected identity 형상은 변하지 않는다. | AC4·AC18 |
| Engine model card | generic row가 하나 늘고 1M key 충돌이 사라진다. | AC5 |
| UsageTab model 목록 | generic map이라 Fable 값을 그대로 표시한다. 별도 family 분기는 없다. | AC18 |
| provider state 기존 4구독 | wire/producer는 불변이고 active chat 구독만 추가된다. | AC10·AC18 |
| Plugin page auth hook | action 배치만 바뀌고 login/reauth/revoke sink는 동일하다. | AC13~AC16 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: active Composer가 provider initial state를 한 번 읽고 push를 구독한다. `@` token이 생기면 memory 후보와 cwd dir cache를 조합한다.
- 취소/중단: active=false·unmount에서 provider subscription과 pending file owner를 해제한다. Esc dismissal은 기존 partial-key 상태를 유지한다.
- 종료/quit/crash/renderer-gone: renderer-local 후보·menu state만 사라지며 main registry·vault에는 쓰지 않는다.
- retry/timeout/partial failure: provider state 실패는 Plugin group만 비우고 path를 유지한다. file listing 실패는 기존처럼 해당 path group 결과 없음으로 제한하며 Plugin group은 유지한다.
- cleanup/rollback: auth menu는 close 후 callback을 호출한다. reauth/revoke의 late response fence는 `useProviders.requestSeq`를 그대로 사용한다.
- **다중 저장소 쓰기**: 제품 동작은 저장소 쓰기가 없다. handoff 상태 사본은 이 plan의 상태와 `INDEX.md` 행 두 곳이며 같은 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: popup option은 Plugin `P` 전건 + path `min(F,8)`이고 header 0~2개다. text decoration은 입력 길이 L을 한 번 순회하고 known id/path Set 조회를 쓴다.
- 새 요청 수의 `원천 상한 × 배치 상한`: active Composer당 provider initial invoke 1 + push subscription 1; key 입력당 추가 provider 요청 0. file 요청은 dir cache key당 1로 불변이다.
- 구조적 목표: file-only hook/component를 mention 책임으로 이름과 타입까지 대체해 같은 token parser 두 벌을 만들지 않는다.
- 캐시/snapshot/호출 축소로 잃는 부수 효과와 회귀 테스트: active-only subscription은 inactive Composer의 후보를 즉시 갱신하지 않는다. 다시 active가 될 때 fresh state를 읽는 테스트로 stale 복귀를 막는다.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port/schema/config: 기존 `AuthDefinition`·`PluginBinding.catalog`·cached `toolNames()`·runtime `availableModels` 형상만 쓴다. 새 필드는 없다.
- 구현 문서: `docs/guides/closed-network-extensions.md`와 `docs/arch/backend/auth.md`.
- **shape 검증**: 기존 deployment fixtures가 `ProviderInfo{id,catalog,tools}`와 runtime `availableModels:string[]`에 typecheck된다.
- **semantics 검증**: invalid Auth에서도 tools가 남고 status만 바뀌는 connection-view contract test를 candidate matrix와 함께 실행한다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| Fable은 family로 인식하되 기본 alias/env 추가는 아님 | `0224 plan D-046` | §3 D-001·D-002 | **부분 변경** — 사용자 최신 요청으로 alias/env 제한만 대체 |
| model identity=(name,1M) | TRD 모델 파싱 규약·`model-identity.ts` | §3 D-004, §10 | 유지 |
| feature 간 직접 import 금지 | renderer `AGENTS.md` | §9·§11 | 유지 — chat은 skills를 import하지 않고 shared IPC DTO만 읽음 |
| Plugin tools는 invalid Auth에도 cached descriptor 유지 | `auth.md §7`, `plugins.ts` | §3 D-008, §12 | 유지 |
| renderer 새 ProviderKind 금지 | `auth.md §9` | §9 TO-BE | 유지 — wire enum 무변경 |
| 연결 버튼은 auth lifecycle만 호출 | `auth.md §9` | §3 D-010·D-011 | 유지 |
| Tailwind semantic token·공용 primitive 우선 | renderer `AGENTS.md` | §10·§11 | 유지 — 새 raw 색·CSS 없음 |
| UI label은 한국어·en parity 유지 | root/docs 규칙 + i18n type | §10 EP-06 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| bare `fable` alias가 기존 SDK에서 해석되지 않을 수 있다. | 사용자 최신 요구를 제품 계약으로 우선한다. 실제 SDK 실행은 사람 실기에서 확인하고 env/availableModels exact id 경로도 함께 제공한다. |
| Plugin title과 id가 다르면 사용자가 어떤 문자열이 삽입되는지 헷갈릴 수 있다. | row에 `@id`를 주 라벨로 표시하고 삽입도 같은 id만 쓴다. |
| popup 두 source의 늦은 응답이 group/index를 되돌릴 수 있다. | active owner·revision과 flattened list 재보정으로 stale 결과를 버린다. |
| auth dropdown으로 reauth가 한 단계 늘어난다. | 사용자가 dropdown을 직접 요구했고 파괴적 해제와 같은 메뉴에서 명시적으로 선택하게 한다. |
| Engine list의 1M key 교정이 인접 diff를 만든다. | shared identity를 재사용하고 base/1M sibling render test로 범위를 잠근다. |

- 되돌리기 어려운 결정: `@` Plugin token의 공개 식별자로 `ProviderInfo.id`를 쓰는 것. 이미 vault/tool-server 안정 식별자이므로 새 이름을 발명하는 것보다 migration 위험이 작다.
- 신규 의존성: 없음. 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/main/features/harnesses/claude/{model-parser.ts,model-parser.test.ts}`
- `app/src/main/features/harnesses/settings.test.ts`
- `app/src/renderer/src/features/engine/components/{EngineModelList.tsx,EngineModelList.render.test.ts}`
- `app/src/renderer/src/features/chat/lib/{pluginMention.ts,pluginMention.test.ts,mentionAutocomplete.ts,mentionAutocomplete.test.ts}`
- `app/src/renderer/src/features/chat/hooks/{useFileAutocomplete.ts,useFileAutocomplete.test.ts}` → mention 이름으로 대체
- `app/src/renderer/src/features/chat/components/composer/{FileAutocomplete.tsx,ComposerInputController.tsx,ComposerInputSurface.tsx,ComposerDecorationLayer.tsx,composerDecoration.ts}`와 관련 테스트 → grouped mention 이름/계약으로 대체
- `app/src/renderer/src/features/skills/components/customize/{ProviderDetail.tsx,ProviderDetail.render.test.ts,ProviderAuthActions.tsx,ProviderAuthActions.test.ts}`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `docs/{TRD.md,arch/frontend/ux-domains.md,arch/backend/auth.md,guides/closed-network-extensions.md}`
- `docs/handoff/0238-fable-plugin-composer-auth-ui/plan.md`, `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §스타일링·renderer 규칙, §빌드/실행`, `app/src/main/AGENTS.md §레이어 DAG`, `app/src/renderer/AGENTS.md §4-layer DAG·스타일·테스트`, `docs/AGENTS.md §작성 규칙`.
- ABI/네트워크 등 환경 제약: 변경 테스트는 DB를 열지 않으므로 `npm test` 대신 direct Vitest를 사용한다. Electron/SDK 실제 Fable 실행과 두 테마 시각은 사람 실기다.
- 기본 정적 게이트: `npm.cmd run lint`, `npm.cmd run typecheck`, `node scripts/check-doc-inventory.mjs --check`, `git diff --check`.
- 관련 테스트:

```text
npx.cmd vitest run \
  src/main/features/harnesses/claude/model-parser.test.ts \
  src/main/features/harnesses/settings.test.ts \
  src/main/features/harnesses/runtime-catalog.test.ts \
  src/renderer/src/features/chat/components/composer \
  src/renderer/src/features/chat/hooks \
  src/renderer/src/features/chat/lib/pluginMention.test.ts \
  src/renderer/src/features/chat/lib/mentionAutocomplete.test.ts \
  src/renderer/src/features/engine/components/EngineModelList.render.test.ts \
  src/renderer/src/features/skills/lib/providerRows.test.ts \
  src/renderer/src/features/skills/components/customize/ProviderDetail.render.test.ts \
  src/renderer/src/features/skills/components/customize/ProviderAuthActions.test.ts \
  src/renderer/src/shared/i18n/resources/resources.test.ts
```

- mutation/대조: Fable env map 제거, fallback 우선순위 앞세우기, Plugin filter 각 항 제거, group sibling 맞바꿈, inserted id→title 변경, auth branch 맞바꿈, danger 제거를 각각 심어 등록 oracle이 red인지 확인한다.
- 사람 실기: ① settings bare/env/runtime Fable을 Composer와 Engine 카드에서 선택, ② cwd 유/무에서 grouped `@` popup·keyboard·chip, ③ none/valid/expired/unknown auth UI와 두 테마·좁은 우측 패널 clipping.

## READY self-review

- [x] Decision Ledger의 ACTIVE와 prior decision 변경 관계를 보존했다.
- [x] Part I만 읽어도 Fable·Plugin mention·auth UI 완료 상태가 이해된다.
- [x] 사용자 요구의 조건절과 세 UI 레퍼런스를 §2에 원문·코드 좌표로 전수 기록했다.
- [x] Product/UX 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] AS-IS와 TO-BE를 같은 model/mention/auth 축으로 작성했다.
- [x] Delta 각 행이 구현 파일·AC·V pair에 추적된다.
- [x] AS-IS file-only popup과 병렬 auth 버튼은 대체로 명시했다.
- [x] 수치·전칭 표현·문서 anchor·기존 테스트를 이번 세션에서 실측했다.
- [x] 각 AC에 동작 기준·검증 수단·production path가 있다.
- [x] 상속할 통합 V가 없어 Baseline V를 만들었다.
- [x] 모든 NEW R/SD/AR/MD node에 같은 레벨 REQUIRED pair가 있다.
- [x] 각 pair에 production path·직접 oracle·§10 분모가 있다.
- [x] group 위치·배선·필터처럼 방향 민감도가 필요한 pair만 적대 증거를 선택했다.
- [x] 현재 변경 산출물의 subtree·repository gate를 열거했다.
- [x] 순수 후보·replacement·상태 전이를 사람 실기로 미루지 않았다.
- [x] semantic 목표를 render/source 문자열 존재만으로 검증하지 않는다.
- [x] 신규 계약의 SSOT·강제 지점·순수 test seam이 있다.
- [x] provider subscription 추가의 기존 소비처와 active lifecycle을 전수 확인했다.
- [x] producer/consumer 양쪽에서 id/catalog/tools와 model identity 의미를 확인했다.
- [x] popup option·IPC 요청 상한과 active-only tradeoff를 계산했다.
- [x] 게이트 명령은 대상 subtree AGENTS와 충돌하지 않는다.
- [x] ACTIVE Decision ↔ AC 대조와 기존 결정 교차검증 결과를 §3·§16에 남겼다.
- [x] 문장 규칙을 적용했다: 판정 우선, 관측 한 줄, 표 한 칸 3줄 이하, Part I/II 역할 분리.

---

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: Fable family/env 확장, 기존 파일 자동완성의 grouped mention 투영, ProviderDetail auth action 분리 설계에 동의한다. 구현 중 실제 컴포넌트 경계·ProviderInfo 타입이 plan의 가정과 다르면 명시적으로 기록한다.
- 이견 / 현실성 문제: `FileAutocomplete`와 `useFileAutocomplete`의 기존 공개 표면은 다른 회귀 테스트와도 연결되어 있어 삭제하지 않고, 새 `mentionAutocomplete` 순수 규칙을 위임하는 호환 껍데기로 남겼다. Composer controller의 실제 경로는 새 grouped mention hook/popup이다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 계획에 없던 `providerAuthActionModel.ts` 순수 seam과 `EngineModelList.render.test.ts`는 fast-refresh/lint 및 1M sibling 행 오라클을 위해 추가한 구현·검증 파일이며 제품 계약을 바꾸지 않는다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·05·08·11 | Fable family/env/default와 모델 identity | EP-01 4곳, EP-02 3곳 | `model-parser.ts`의 family/env/fallback 4곳, `toAgentEnvironment` wire, Composer `modelIdentity`, Engine key를 연결했다. | §19 targeted Vitest 50 files/368 tests green; parser Fable env·fallback red 변이도 확인. | AC1~5, MD-01, AR-01 |
| VP-02·06 | `@` source → grouped option → draft | EP-03 2곳, EP-04 parse/group/flatten/replace/keyboard/deco 6곳 | `pluginMention.ts`, `mentionAutocomplete.ts`, `useMentionAutocomplete`, grouped popup, controller 키보드/apply, decoration chip을 연결했다. | plugin/mention pure tests와 Composer/hooks suite가 green; group/id 변이 red. | AC6~12, MD-02 |
| VP-03·07·10·14 | auth status → trigger/menu/callback | EP-05 5곳 | `providerAuthActionKind` predicate, 직접 인증, dropdown, 재인증 item, danger 연결 해제 item을 `ProviderDetail`에 연결했다. | auth action matrix/model + ProviderDetail/providerRows suite green; branch/danger 변이 red. | AC13~16, AR-03/MD-04 |
| VP-04 | 문서·i18n current contract | EP-06 6곳 | ko/en key, TRD, frontend UX, backend auth, 폐쇄망 guide를 같은 Fable/Plugin/auth 용어로 갱신했다. | doc inventory/prose/link gate green; stale 3-family/path-only 표현 없음. | AC17~18, R-04 |
| EP 합계 | §10 전수 | EP-01 4/4 · EP-02 3/3 · EP-03 2/2 · EP-04 6/6 · EP-05 5/5 · EP-06 6/6 | **26/26** | targeted Vitest + typecheck/lint/doc/diff gate green | §10 모든 강제 지점 |

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | parser/settings/runtime + ModelMenu/Engine render | Fable env map 제거 2 fail; fallback Fable-first 4 fail |
| VP-02 | REQUIRED | SELF_PASS | mention parser/group/replace + Composer controller suite | group sibling swap 1 fail; id→label 1 fail |
| VP-03 | REQUIRED | SELF_PASS | auth status/action + ProviderDetail render | none/non-none branch swap 4 fail |
| VP-04 | REQUIRED | SELF_PASS | i18n parity + document inventory | 이번 라운드 문서 stale gate green; 별도 mutation 미실행 |
| VP-05 | REQUIRED | SELF_PASS | ParsedModel → AgentModelView → two renderer rows | Engine 1M sibling key/render oracle green |
| VP-06 | REQUIRED | SELF_PASS | active source owner/cancel + range replacement | group/id mutation 결과로 option 귀속·삽입을 red 확인 |
| VP-07 | REQUIRED | SELF_PASS | callback path와 기존 requestSeq 회귀 | close-before-callback은 source inspection + action tests로 확인 |
| VP-08 | REQUIRED | SELF_PASS | parser/settings/runtime producer-consumer suites | parser Fable 제거 mutation 2 fail |
| VP-09 | REQUIRED | SELF_PASS | ProviderInfo catalog/tools → plugin projector | tools filter 제거 1 fail |
| VP-10 | REQUIRED | SELF_PASS | ProviderDetail callback identity/model | auth branch/action matrix green |
| VP-11 | REQUIRED | SELF_PASS | four-family env/discovery/default matrix | Fable-first fallback 4 fail |
| VP-12 | REQUIRED | SELF_PASS | plain/quoted/slash/flatten/caret pure tests | group sibling swap 1 fail |
| VP-13 | REQUIRED | SELF_PASS | plugin/file validity sets → chip segments | decoration test + targeted Composer suite green |
| VP-14 | REQUIRED | SELF_PASS | action model → trigger/menu/tone | danger=false mutation 1 fail |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `ALIAS_ENV_KEY.fable`을 다른 키로 변경 | VP-01·VP-08 / EP-01 | V1 신규 oracle | `model-parser.test.ts`: 2 fail / 44 tests | **RED 재현 후 원복** |
| `DEFAULT_FAMILY_ORDER`를 Fable-first로 변경 | VP-01·VP-11 / EP-01 | V1 신규 oracle | `model-parser.test.ts`: 4 fail / 44 tests | **RED 재현 후 원복** |
| Plugin `tools.length > 0` 필터 제거 | VP-02·VP-09 / EP-03 | V1 신규 oracle | `pluginMention.test.ts`: 1 fail / 2 tests | **RED 재현 후 원복** |
| path group `push`를 `unshift`로 바꿔 형제 순서 역전 | VP-02·VP-12 / EP-04 | V1 신규 oracle | `mentionAutocomplete.test.ts`: 1 fail / 5 tests | **RED 재현 후 원복** |
| Plugin 삽입 id를 표시 label로 변경 | VP-02·VP-12 / EP-04 | V1 신규 oracle | `mentionAutocomplete.test.ts`: 1 fail / 5 tests | **RED 재현 후 원복** |
| auth predicate ternary 분기 반전 | VP-03·VP-10 / EP-05 | V1 신규 oracle | `ProviderAuthActions.test.ts`: 4 fail / 5 tests | **RED 재현 후 원복** |
| revoke menu danger를 `false`로 변경 | VP-03·VP-14 / EP-05 | V1 신규 oracle | `ProviderAuthActions.test.ts`: 1 fail / 5 tests | **RED 재현 후 원복** |

- 분모 검산: 선택 적대 증거 **7행 / 7행 실행**, 모두 red; EP-01·03·04·05의 방향 민감한 oracle을 포함한다. VP-04의 stale 문구 변이는 문서 gate로 측정하지 않고, 현재 gate green 사실만 기록했다.
- 덮개 회귀: 각 mutation 원복 뒤 §19 대상 **50 files / 368 tests**와 legacy `useFileAutocomplete.test.ts` **4/4**가 green이었다. mutation 실행 중 원본 회귀가 추가로 생기지 않았다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | **예** — `skills.provider.authenticate`, Plugin 그룹/aria 키는 각각 `ProviderAuthActions`·`MentionAutocomplete`에서 소비되고 en/ko parity가 있다. | 별도 후속 없음; i18n parity gate 유지 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | **예** — auth 순수 model은 컴포넌트 밖으로만 분리했고, Composer hook은 active cleanup·legacy hook 위임을 유지했다. | legacy 파일 popup은 호환용으로 남기고 추후 제거 여부를 별도 결정 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | provider/file source 실패는 popup loading/empty 행, auth 실패·만료는 기존 status 행, cwd 변경은 file cache 무효화 행이다. | 각 경로를 §19 targeted suite와 source inspection으로 고정 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | **예** — provider 조회 실패는 path 후보를 유지하고, file 실패는 empty group, 비동기 조회는 loading, auth는 직접 인증/메뉴 trigger를 남긴다. | 사람 실기에서 문구·clipping 확인 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | **예** — provider/file 요청에 cancel flag, draft 적용에 deferred revision fence, 메뉴 callback은 close 후 실행이다. | 실제 Electron 재진입은 검증자/사람 실기에서 확인 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 기존 `FileAutocomplete` 공개 표면을 즉시 삭제하면 legacy caller 회귀가 생길 수 있음 | controller만 unified mention으로 전환하고 기존 hook은 새 순수 parser/filter를 위임하는 compatibility seam으로 유지 | `useFileAutocomplete.test.ts` 4/4, §18 영향 파일 |
| 2 | active Composer마다 provider push listener가 남으면 중복 후보·메모리 누수가 생길 수 있음 | active일 때만 `state()`/`onState()`를 연결하고 cleanup에서 구독 해제; 비활성 provider projection은 빈 배열 | `useMentionAutocomplete.ts`, VP-06 |
| 3 | Plugin id와 표시 label을 혼동하면 실행 token이 깨짐 | candidate와 replacement 모두 `ProviderInfo.id`, label은 화면 표시 전용; id→label mutation red | `pluginMention.ts`, `mentionAutocomplete.test.ts` |
| 4 | 사람 실기 없이 두 테마·좁은 우측 패널의 clipping을 단정할 수 없음 | 기계 AC는 닫았지만 Electron 시각 확인을 검증자/사람 handoff로 명시 | §19 사람 실기 ①~③ |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: (1) 기존 `FileAutocomplete` 파일은 즉시 삭제하지 않고 호환용으로 남겼다. (2) `providerAuthActionModel.ts`와 Engine render test를 추가했다. 전자는 legacy 회귀와 pure seam을 함께 보존하기 위해, 후자는 1M sibling key와 auth menu danger를 구조적으로 단언하기 위해서다. 제품 동작·IPC·Decision Ledger는 변경하지 않았다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | Plugin 후보는 status를 보지 않아 expired/unknown에서도 static tools가 보인다. auth는 non-none을 관리 가능한 상태로 본다. | VP-02·03·09, `pluginMention.test.ts` status matrix, `ProviderAuthActions.test.ts` 4-status |
| 공유 | ProviderInfo는 read-only snapshot이며 Composer마다 active listener/cache를 갖는다. 새로운 mutable shared store를 만들지 않았다. | VP-06·09, `useMentionAutocomplete.ts` cleanup/source owner |
| 재진입 | provider/file cancel flag, draft revision fence, popover close-before-callback으로 늦은 결과와 열린 메뉴를 차단한다. | VP-06·07·12, §19 targeted suites |
| 다른 무효화 축 | cwd가 바뀌면 file cache/valid path set을 비우고, provider push는 id/catalog/tools를 다시 투영한다. | VP-02·06·13, Composer decoration/mention tests |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `model-parser.ts`, parser/settings/model tests; renderer chat: `pluginMention.ts`, `mentionAutocomplete.ts`, `useMentionAutocomplete.ts`, grouped popup, controller/surface/decoration, legacy file hook 위임; engine: `EngineModelList.tsx`/render test; skills: `ProviderAuthActions.tsx`/model/test, `ProviderDetail.tsx`; ko/en i18n; TRD·frontend UX·backend auth·폐쇄망 guide; 이 plan과 `docs/handoff/INDEX.md`. |
| 실행 명령 | §19 targeted `npx.cmd vitest run ...` (**50 files / 368 tests**); `npx.cmd vitest run src/renderer/src/features/chat/hooks/useFileAutocomplete.test.ts` (**4/4**); `npm.cmd run typecheck`; `npm.cmd run lint`; `node scripts/check-doc-inventory.mjs --check`; `git diff --check`; 선택 mutation 7종 focused Vitest. |
| 관측한 게이트 산출 | targeted/legacy Vitest green; typecheck 3 configs exit 0; lint 0 errors·기존 warning 1; doc inventory **9 items·98 channels**, prose/links green; diff check exit 0. |
| V-pair 자기확인 | VP-01~VP-14 **14/14 SELF_PASS**; `SELF_BLOCKED` 0. 직접 oracle과 선택 mutation 결과는 위 표에 기록했다. |
| 강제 지점 전수 | EP-01 **4/4**, EP-02 **3/3**, EP-03 **2/2**, EP-04 **6/6**, EP-05 **5/5**, EP-06 **6/6** — 합계 **26/26**. |
| AC 자기보고 | 기계 범위 AC **18/18 ✅**. 후보/상태/selection/replacement는 테스트로 닫았고, 두 테마·좁은 패널·실제 Electron 시각은 사람/검증자 대기다. |
| 합계 검산 | V-pair 14/14 + EP 26/26 + AC 18/18 + mutation **7/7 red** + 운영 gate 6종 green. |
| 블로커 / 역질문 | 코드 블로커 없음. Electron/SDK 실제 실행 및 두 테마 시각 확인은 환경상 수행하지 않았으므로 다음 주체가 확인한다. |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **아니오** — 이전 구현 라운드가 없는 Baseline V1 신규 축이다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: **예** — §10 EP 분모, VP-01~14 pair, §19 mutation/사람 실기, AC1~18이 모두 선행 기재되어 있었다.
- 반복해서 부딪히는 환경 한계: Electron/SDK/native 실행과 두 테마 시각은 이 환경에서 수행하지 못해 direct Vitest와 정적 gate로 대체했다.
- 현재 라운드 수: **1**.

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | 미기입 | 미기입 | 미기입 | 미기입 | 미기입 |
