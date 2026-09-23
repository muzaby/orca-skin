# Plan — 0238-fable-plugin-composer-auth-ui

## 메타

| 항목 | 값 |
|---|---|
| slug | `0238-fable-plugin-composer-auth-ui` |
| 작성자 | Codex — 사용자 지시로 설계 턴 수행 |
| 일자 | 2026-09-22 |
| 매핑 | 최초 기능 요청 3건 + 사용자 변경·보완 4건 |
| 상태 | **IMPL_DONE (V1+ΔV1 라운드 3 · r4)** — r3 판정은 [`verify.md`](verify.md) `# r3 검증`, r4 검증 대기 |
| V mode | `Delta V` |
| 기준 V | `V1@651d9080` — 0238 최초 READY 설계; r1 구현 `6030afae`·`e96a2494`·`2c7dad51`은 독립 검증 전 |
| 이번 V revision | `ΔV1` — Composer 그룹 순서·token 재진입·전 category catalog presentation 입력 |
| 유효 V | `V1 + ΔV1` |

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
| Plugin 식별자·내장 MCP 도구 | `ProviderInfo.id/catalog/tools`, `connection-views.ts`의 `connectionInfo()` | V1은 `catalog && tools`로 투영했다. ΔV1은 `§Δ2 D-017`의 plugin-only tools producer로 대체한다. |
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
| D-005 | Composer Plugin 후보는 `ProviderInfo.catalog`가 있고 `tools.length > 0`인 내장 Plugin row다. | V1에서는 `catalog`가 Plugin category에만 존재했다. ΔV1에서 다른 category도 presentation을 가지므로 더는 분류자로 쓸 수 없다. | 사용자 요청 2 + `auth.md §7·§9` | SUPERSEDED | D-017 |
| D-006 | Plugin 참조 토큰은 `@${ProviderInfo.id}`이고 선택 시 뒤에 공백을 붙인다. 전송 text는 변환하지 않는다. | Auth registry가 id를 kebab 소문자로 강제하므로 plain token이 손실 없이 성립한다. | 사용자 요청 2 + `auth/registry.ts:47-78` | ACTIVE | — |
| D-007 | root plain `@partial` 팝업은 `플러그인` 그룹 뒤에 `경로` 그룹을 보여 준다. quoted 또는 `/` 포함 partial은 경로 탐색만 보여 준다. | 최초 구현의 순서이며 사용자가 Plugin을 하단으로 바꾸었다. | 사용자 요청 2 + 기존 경로 UX | SUPERSEDED | D-014 |
| D-008 | Plugin 인증 상태와 무관하게 후보를 유지하며, provider state를 못 읽으면 경로 자동완성만 계속 동작한다. | `tools`는 invalid Auth에서도 cached descriptor를 유지하는 현재 계약이다. | `auth.md §7`, `plugins.ts:28-36` | ACTIVE | — |
| D-009 | 미인증 상세 헤더에는 `인증` 검정 primary 버튼 하나를 둔다. | 사용자가 제품 추가 버튼 스타일을 직접 지정했다. | 사용자 요청 3 | ACTIVE | — |
| D-010 | 인증 이력이 있으면 `재인증﹀` 검정 primary dropdown을 두고 메뉴에 `재인증`, `연결 해제`를 둔다. | 기존 재인증 능력을 보존하면서 파괴적 해제를 dropdown으로 내린다. | 사용자 요청 3 + 보존 원칙 | ACTIVE | — |
| D-011 | `연결 해제`는 공용 `MenuItem danger`를 사용하고 실행 전에 메뉴를 닫는다. 별도 확인 모달은 추가하지 않는다. | 빨간 제거 폰트 선례를 그대로 재사용하고 기존 해제 동작 범위를 바꾸지 않는다. | 사용자 요청 3 + 현행 즉시 revoke | ACTIVE | — |
| D-012 | 신규 IPC·DB·마이그레이션·패키지 의존성은 추가하지 않는다. | 필요한 모델·Plugin 데이터가 현행 `orca:agent:list`와 provider state에 이미 있다. | 코드 조사 | ACTIVE | — |
| D-013 | 0224 D-046의 Fable family 인식·점/하이픈 버전 지원은 유지한다. | 이번 요청은 그 결정을 확장하며 자동 승인 판정을 되돌리지 않는다. | `0224-work-agent-layer/plan.md:1064` | ACTIVE | — |

### 갱신 메모

- 이 절은 V1 설계 당시 기록이다. D-001~D-012를 추가했고 0224 D-046의 alias/env 제한을 D-001·D-002가 대체했다.
- ΔV1에서 D-005는 D-017, D-007은 D-014가 대체했다. 현재 결정·AC 대조 정본은 `§Δ2`다.
- 유지 결정: 모델 identity의 `[1m]` 축, Plugin tools의 invalid-auth 정적 표시, provider row의 기존 인증 lifecycle.
- **V1 당시 ACTIVE 결정 ↔ AC 대조: 충돌 0.** 현재 유효 V의 대조는 `§Δ2`에서 충돌 0으로 재확인했다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당. Fable의 원인은 parser의 3-family 후보/env map이고, Plugin mention 부재의 원인은 file-only `@` 상태 모델이다. | `model-parser.ts:24-34`, `useFileAutocomplete.ts:7-12` |
| 이미 기존 코드가 충족하는가 | 부분 충족. Fable discovery·권한 판정은 이미 있고, env alias·empty-settings·Engine card 보장은 없다. | `model-parser.test.ts:389-399`, `modes.r7.test.ts:12-52` |
| 더 작은 해법이 있는가 | 있다. wire를 늘리지 않고 `ProviderInfo.id/catalog/tools`를 renderer에서 투영한다. | `ipc.ts:1730-1750`, `connection-views.ts:62-82` |
| 선행 자료의 주장을 코드와 대조했는가 | 대조 완료. 0224 D-046의 “기본 alias/env 추가 아님”은 코드의 3-family map과 일치한다. | `0224 plan:1064`, `model-parser.ts:24-34` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 사용자 요청이 0224의 제한을 명시적으로 확장한다. 기존 default 우선순위·1M identity·Auth lifecycle은 보존한다. | D-001~D-004, D-013 |

- 사용자에게 올릴 결정: 없음. `재인증﹀`의 메뉴는 기능 보존을 위해 `재인증`·`연결 해제` 두 행으로 해석했다.
- V1 코드 조사로 닫은 사실: Plugin 식별자는 `ProviderInfo.id`, 당시 판별자는 `catalog`, 내장 도구 존재는 `tools`였다. 현재 판별 계약은 `§Δ2 D-017`이다.

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
| R-02 | AT-07 / AC7 | **V1 기준 — ΔV1 AC23이 대체.** Plugin 후보는 `catalog`가 있고 `tools`가 비지 않은 row만 포함하며 status와 무관하다. | V1 네 status × catalog/tools matrix. 현재 oracle은 source category × catalog × tools matrix다. | provider state → candidate projector → Plugin group |
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
| AR-02 / VP-09 | **V1 기준 — ΔV1 AR-04/VP-20·23이 대체.** Plugin candidate=`catalog present ∧ tools.length>0`, token=`@id` | `ProviderInfo` + `pluginMention.ts` | connection view + chat | state snapshot/push | V1 EP-03 2곳. 현재 강제 지점은 EP-10·12다. |
| MD-02 / VP-12 | suggestion union과 flattened index; headers non-option | `mentionAutocomplete.ts` | hook/controller/popup | parse/filter/key/pick | **EP-04 6곳**: parse, group, flatten, replace, keyboard, decoration. |
| MD-03 / VP-13 | Plugin id와 path는 서로 다른 validity set | `composerDecoration.ts` | decoration layer | deferred render | path set으로 Plugin을 검증하거나 그 반대면 잘못된 chip이 생긴다. |
| AR-03 / VP-10 | none=`login`; non-none menu=`reauth`,`revoke` | `ProviderAuthActions` action model | ProviderDetail | render/click | **EP-05 5곳**: predicate, direct trigger, dropdown, reauth item, danger revoke item. |
| R-04 / VP-04 | ko/en key와 current docs가 새 계약을 설명 | ko SSOT + en structural parity + docs | renderer/docs | typecheck/doc gate | **EP-06 6곳**: ko, en, TRD, frontend UX, backend Auth, closed-network guide. |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT와 공유 방법: family/identity는 `shared/model-identity.ts`, settings env table은 parser 한 곳, Plugin 후보 술어는 chat 순수 projector 한 곳, danger tone은 공용 `MenuItem`을 쓴다.
- `실패 의미`에 “다른 게이트가 막는다”를 적었다면 그 범위를 이 턴에 측정한 근거: 해당 없음.
- V1 선택적 필드 의미: `catalog===undefined`는 Plugin 아님이었다. ΔV1에서는 `§Δ8`의 category/fallback 의미가 대체하며 `tools=[]`, cwd `null` 의미는 유지한다.
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
- V1 consumer 파생 규칙은 `catalog && tools.length`였다. ΔV1은 main의 plugin-only `toolsOf()`와 renderer의 `tools.length>0`으로 대체하고 status 비의존은 유지한다.
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

- V1 외부/배포 계약은 기존 형상만 썼다. ΔV1은 `ProviderCatalogPresentationInput`을 일반화하고 Plugin compatibility alias와 기존 ProviderInfo field shape를 유지한다.
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

# ΔV1 — Composer 재진입과 전 category catalog presentation

> 2026-09-22 사용자 변경·보완 4건의 설계다. V1의 Fable·Plugin 인증 UI 계약은 유지하며,
> V1 r1 구현은 독립 검증 전에 이 Delta 구현으로 이어진다. 이 절은 구현 산출물이 아니다.

## Δ1. 사용자 의도 / 요구 출처와 레퍼런스 전수

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “Composer에서 @ 입력시, 팝업메뉴에서 플러그인이 상단에 배치됨. 하단으로 배치할 것” | 2026-09-22 사용자 변경 1 |
| 명시 요구 | “입력을 모두 지우고 다시 @ 입력시 팝업메뉴가 발생하지 않고 있음”을 고친다. | 2026-09-22 사용자 보완 2 |
| 명시 요구 | “카탈로그의 프레젠테이션 input을 gate, harness에도 지원”한다. | 2026-09-22 사용자 보완 3 |
| 명시 요구 | 같은 presentation input을 “usage-fetcher에도 지원”한다. | 2026-09-22 사용자 보완 4 |
| 해석 | `usage-fetcher` 지원은 `category:'usage'` 연결 행의 표시 입력을 뜻한다. `UsageFetcher` 도메인 포트에는 표시 책임을 넣지 않는다. | `usage-fetcher.ts`, `features/usage/fetcher.ts`, `connections.ts`의 현재 책임 경계 |

| 사용자 표현 | 현재 레퍼런스 | ΔV1에서의 사용 |
|---|---|---|
| Plugin을 하단 배치 | `mentionAutocomplete.ts:62-82`, `mentionAutocomplete.test.ts:45-57`, `MentionAutocomplete.tsx:35-70` | path group을 먼저, Plugin group을 마지막에 투영·렌더하고 flat keyboard index도 같은 순서를 따른다. |
| 모두 지운 뒤 `@` 재입력 | `useTokenAutocompleteState.ts:14-28`, `useMentionAutocomplete.ts:117-124`, `ComposerInputController.tsx:297-318` | token 부재를 occurrence 종료로 처리하고 새 `@` occurrence에서 dismissal/index를 초기화한다. |
| 기존 파일/skill 재오픈 선례 | `useFileAutocomplete.test.ts:151-201`, `useSkillAutocomplete.ts:42-47` | 공유 상태 머신 변경이 파일 `@`와 `/` skill 자동완성을 회귀시키지 않는 증거다. |
| catalog presentation input | `shared/plugin-catalog.ts`, `deployment/plugins.ts:20-55`, `0236-jira-plugin-catalog-presentation/plan.md` D-001~D-005·EP-01~08 | icon·localized title/body·attribution·fallback 의미를 일반 연결 행으로 확장한다. |
| gate | `deployment/gate-auth.ts`, `deployment/connections.ts:41-43`, `closed-network-extensions.md §2` | gate connection source도 선택적 presentation input을 받는다. |
| harness | `deployment/harness-runtime.ts`, `connection-views.ts:32-37`, `closed-network-extensions.md §3` | harness connection source도 같은 input을 받고 `harnessModelProviderKey`는 유지한다. |
| usage-fetcher | `deployment/usage-fetcher.ts`, `connection-views.ts:46`, `closed-network-extensions.md §5-b` | usage 연결 행에 같은 input을 허용하되 fetcher의 `supports/fetchUsage` 계약은 불변이다. |
| wire/renderer 표시 | `shared/ipc.ts:1725-1750`, `connection-views.ts:61-81`, `pluginPresentation.ts:33-43`, `CustomizeList.tsx:108-132`, `ProviderDetail.tsx:39-102` | category·presentation을 producer에서 list/detail consumer까지 보존한다. |
| 현재 문서 계약 | `IPC_CONTRACT.md §2.13-c`, `auth.md §7~§9`, `ux-domains.md §1.2`, `TRD.md §6.8.1` | Plugin-only catalog·Plugin-first 문구를 새 계약으로 갱신한다. |

## Δ2. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-014 | root plain `@partial`에서 path group을 먼저, Plugin group을 마지막에 표시한다. slash/quoted 입력은 계속 path group만 표시한다. | 사용자가 Plugin의 하단 배치를 명시했다. | 사용자 변경 1 | ACTIVE | D-007 대체 |
| D-015 | 자동완성 token이 사라지면 그 occurrence의 dismissal과 active index를 끝낸다. 같은 문자열의 새 `@` token은 새 occurrence로 열려야 한다. | partial 문자열만 dismissal identity로 쓰면 `'' → null → ''` 재진입을 구분하지 못한다. | 사용자 보완 2 + 코드 조사 | ACTIVE | — |
| D-016 | catalog presentation input은 `gate · harness · plugin · usage` 네 connection category 모두에서 선택적으로 받는다. | 동일 카탈로그 list/detail에서 category별 표시를 구성할 수 있어야 한다. | 사용자 보완 3·4 | ACTIVE | 0236 D-004의 non-Plugin 제한 대체 |
| D-017 | main은 계속 Plugin source에만 `tools`를 싣고, Composer Plugin mention은 `tools.length>0`으로 판별한다. `catalog` 존재 여부는 분류자가 아니다. | presentation 확장 후 `catalog`로 Plugin을 추론하면 gate/harness/usage가 `@` 후보에 섞인다. | D-016 역방향 검토 + `toolsOf()` | ACTIVE | D-005 대체 |
| D-018 | presentation input이 없는 gate/harness/usage는 기존 power icon·Auth label을 유지한다. Plugin은 input이 없어도 기존 `electrical_services` 기본값을 유지한다. | 선택적 입력 확장이 기존 배포의 표시를 바꾸면 안 된다. | 0236 D-002·D-004 + 호환성 | ACTIVE | — |
| D-019 | 일반 계약의 정본 이름은 `ProviderCatalog*`로 옮기되 기존 `PluginCatalog*`·`LocalizedPluginText` type·constant·normalizer export는 호환 alias로 보존한다. wire 필드명 `catalog`도 유지한다. | 비Plugin에 Plugin 이름을 강요하지 않으면서 기존 배포 소스와 JSON shape를 깨지 않는다. | 타입/배포 공개 경계 검토 | ACTIVE | — |
| D-020 | usage presentation은 `category:'usage'` connection source의 표시 입력이다. `UsageFetcher`의 `supports/fetchUsage` 포트와 snapshot에는 표시 필드를 추가하지 않는다. | usage 실행 책임과 카탈로그 표시 책임을 다시 결합하지 않는다. | 사용자 보완 4 + 0183/0188 경계 | ACTIVE | — |
| D-021 | 새 IPC 채널·ProviderInfo 필드·DB·마이그레이션·패키지 의존성은 추가하지 않는다. 기존 `catalog` 필드의 허용 producer만 넓힌다. | 기존 provider state 채널과 build-time deployment 입력으로 닫힌다. | 코드 조사 | ACTIVE | D-012 유지·구체화 |

### Δ1 갱신 메모

- 새 결정: D-014~D-021.
- 변경 결정: D-007→D-014, D-005→D-017, 0236 D-004의 “non-Plugin catalog undefined”→D-016·D-018.
- 유지 결정: D-006의 `@id` raw text, D-008의 status 무관 후보, D-009~D-011의 인증 액션, Fable D-001~D-004·D-013.
- **ACTIVE 결정 ↔ AC 대조: 충돌 0.** D-014↔AC19, D-015↔AC20, D-016·D-018·D-020↔AC21~AC22, D-017↔AC23, D-019·D-021↔AC24, 유지 결정↔AC25.

## Δ3. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| Plugin 하단 배치가 작은 변경으로 닫히는가 | 예. group 배열 순서가 렌더 순서와 flattened keyboard 순서를 함께 결정한다. | `groupMentionSuggestions`·`flattenMentionGroups`·`MentionAutocomplete` |
| 재입력 증상이 원인을 지목하는가 | 증상은 맞고 원인은 shared lifecycle이다. 상태가 dismissed partial 문자열만 기억해 token occurrence 경계를 잃는다. | `useTokenAutocompleteState.ts:20-27` |
| presentation을 `catalog` producer만 넓히면 되는가 | 아니오. V1 Plugin projector가 `catalog` 존재를 category 신호로 쓰므로 mention 오염 회귀가 생긴다. | `pluginMention.ts:20`, `connection-views.ts:57-59` |
| usage port에 표시 입력을 넣어야 하는가 | 아니오. 표시 입력은 connection source, 원격 사용량 동작은 `UsageFetcher`가 소유한다. | `usage-fetcher.ts`, `features/usage/fetcher.ts` |
| 사용자에게 올릴 제품 결정이 남는가 | 없음. 순서·지원 category·재입력 결과는 명시됐고, 책임 배치는 기존 아키텍처로 닫힌다. | D-014~D-021 |

## Δ4. 동작 / 상태 전이

```text
[Composer root plain @]
  → [path 후보 계산 + Plugin 후보 계산]
  → [경로 group]
  → [Plugin group — 항상 마지막]

[@ token이 열림]
  → [전체 입력 삭제: token=null, occurrence 종료]
  → [다시 @ 입력: 새 occurrence]
  → [dismissal/index 초기화, popup 재오픈]

[gate/harness/plugin/usage connection source + optional catalog input]
  → [한 번 정규화 + plugin-only tools producer 유지]
  → [ProviderInfo.catalog? + tools]
  → [카탈로그 목록/상세 표시]
  ↘ [input 없음: category별 기존 fallback]
```

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| root `@`에서 path와 Plugin 후보가 모두 있음 | path group을 먼저 flatten하고 Plugin group을 뒤에 붙인다. | 경로가 상단, Plugin이 하단이며 ↑/↓ 순서도 화면과 같다. |
| slash/quoted path | Plugin 후보를 조립하지 않는다. | 기존 path-only 팝업이 유지된다. |
| popup이 열린 뒤 draft를 전부 지움 | token 부재 전이에서 dismissal과 active index를 초기화한다. | popup이 닫히고 남은 stale selection이 없다. |
| 같은 Composer에 다시 `@` 입력 | 새 token occurrence로 후보를 다시 계산한다. | 이전 close/select 이력과 무관하게 popup이 다시 열린다. |
| non-Plugin category에 presentation input 있음 | 공용 normalizer가 icon/title/body/attribution을 보존한다. | Plugin과 같은 locale/fallback 규칙으로 목록·상세가 표시된다. |
| gate/harness/usage에 input 없음 | `catalog`를 싣지 않는다. | power icon과 Auth label이 그대로다. |
| Plugin에 input 없음 | Plugin binding의 기존 default normalization을 유지한다. | `electrical_services`와 Auth label이 그대로다. |
| presentation이 있는 non-Plugin row | main이 tools를 빈 배열로 싣고 renderer는 tools만 후보 자격으로 본다. | Composer Plugin group에는 나타나지 않는다. |

### Δ1 범위 / 비범위

- **범위**: mention group 순서, token occurrence 재진입, 네 connection category의 optional presentation input, generic shared naming·호환 alias, ProviderInfo `catalog` 의미 확장, list/detail resolver, 문서·테스트.
- **비범위**: `UsageFetcher` 응답·스케줄·네트워크 변경, ProviderKind 교체, catalog runtime 편집/저장, 새 아이콘/locale 정책, Plugin token backend semantic expansion.

## Δ5. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-05 | AT-05 / AC19 | root plain `@`의 두 group은 path→Plugin 순서이고 keyboard flatten 순서도 같다. | 순수 group/flatten test와 popup render test가 header·첫/마지막 option·형제 맞바꿈을 구분한다. | Composer token → groups → popup/controller |
| R-06 | AT-06 / AC20 | 입력 전체 삭제로 token이 사라진 뒤 같은 Composer에서 다시 `@`를 입력하면 popup이 열린다. | shared hook fixture가 `@ → close 또는 open → '' → @`와 active index reset을 단언한다. | draft revision → token parser → shared autocomplete state → open |
| R-07 | AT-07 / AC21 | gate/harness/plugin/usage source에 지정한 presentation input이 list/detail의 icon·locale title/body·attribution까지 보존된다. | 네 category integration table이 같은 입력의 producer→wire→두 consumer 값을 단언한다. | deployment input → source → ProviderInfo → resolver → UI |
| R-07 | AT-08 / AC22 | input이 없는 gate/harness/usage는 power/Auth label, Plugin은 electrical_services/Auth label fallback을 유지한다. | category × input 유무 table과 기존 Plugin normalization test가 정확한 fallback을 단언한다. | source normalization → wire optional catalog → resolver |
| R-07 | AT-09 / AC23 | catalog가 있는 gate/harness/usage는 Plugin `@` 후보가 아니며, Plugin source가 싣는 tools가 있는 행만 후보가 된다. | source category × catalog × tools × status integration과 projector matrix가 포함/제외·id를 단언한다. | ConnectionViewSource → ProviderInfo.tools → plugin projector → Composer group |
| R-07 | AT-10 / AC24 | generic presentation type·normalizer가 정본이고 기존 Plugin type/function import는 호환되며 현재 문서·배포 예제가 네 category를 설명한다. | type fixture·normalizer unit·문서 anchor/inventory gate가 alias와 예제 shape를 단언한다. | deployment author → shared contract → build/current docs |
| R-08 | AT-11 / AC25 | 기존 slash/quoted file mention, `/` skill dismissal, Plugin raw `@id`, auth action, usage fetch 동작은 회귀하지 않는다. | 기존 focused suites와 usage fetcher fixture가 기존 결과를 재단언한다. | 기존 V1 production path + UsageFetcher port |

### AC 검증 주의사항

- AC20은 partial 문자열 변화만 보지 않는다. **token 존재→부재→새 존재** 전이를 같은 hook instance에서 재현한다.
- AC19는 group 문자열 존재가 아니라 path/Plugin 형제 위치를 맞바꿨을 때 실패하는 순서 oracle을 둔다.
- AC23은 source category별 `toolsOf()` 결과와 catalog 유무를 분리해 표시 입력을 Plugin 자격으로 오인하지 않는다.
- 사람 실기: 두 테마에서 path 상단/Plugin 하단과 gate/harness/usage의 custom icon·본문을 확인한다. 재입력·분류·locale fallback은 기계 테스트로 닫는다.

## Δ6. V / Trace Matrix

- V mode 판정: `V1@651d9080`의 R-02·SD-02·AR-02·MD-02를 일부 변경하고 connection presentation 경계를 확장하므로 `Delta V`다.
- 변경 시작 수준: 사용자 관측 순서·재진입·category별 표시가 바뀌므로 R부터 시작한다.
- 영향 없는 Fable R-01/SD-01/AR-01/MD-01과 모델 UI는 복사하지 않는다. 기존 증거는 V1 VP-01·05·08·11에 남는다.

### ΔV1 node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-05 / AT-05 | R / AT | AC19 group 위치 | NEW | D-014; V1 D-007 대체 |
| R-06 / AT-06 | R / AT | AC20 token 재진입 | NEW | D-015 |
| R-07 / AT-07~10 | R / AT | AC21~24 전 category presentation | NEW | 0236 Plugin-only 계약 확장 |
| R-08 / AT-11 | R / AT | AC25 기존 동작 회귀 | INHERITED | V1 R-02~04 + usage port |
| V1 R-02 / AT-02 | R / AT | V1 grouped Plugin mention 묶음 | SUPERSEDED | R-05·R-06·R-07·R-08로 분해 |
| SD-04 / ST-04 | SD / ST | group order·token occurrence 종단 | CHANGED | V1 SD-02 / ST-02 일부 대체 |
| SD-05 / ST-05 | SD / ST | presentation input→list/detail 종단 | NEW | 0236 Plugin path 일반화 |
| V1 SD-02 / ST-02 | SD / ST | V1 mention source·caret·dismiss 종단 | SUPERSEDED | SD-04·SD-05로 분해 |
| AR-04 / IT-04 | AR / IT | category+catalog producer/wire/consumer | CHANGED | V1 AR-02 / IT-02와 0236 presentation 경계 확장 |
| V1 AR-02 / IT-02 | AR / IT | V1 ProviderInfo→mention 경계 | SUPERSEDED | AR-04 / IT-04 |
| MD-05 / UT-05 | MD / UT | path-first group/flatten invariant | CHANGED | V1 MD-02 / UT-02의 순서 대체 |
| MD-06 / UT-06 | MD / UT | token occurrence dismissal/index lifecycle | NEW | shared hook의 누락 계약 |
| MD-07 / UT-07 | MD / UT | generic normalization·plugin-only tools projection | CHANGED | V1 Plugin projector + 0236 normalizer |
| V1 MD-02 / UT-02 | MD / UT | V1 token·group·replacement 묶음 | SUPERSEDED | MD-05·MD-06·MD-07로 분해 |

### ΔV1 pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §Δ8 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-15 | R-05 ↔ AT-05 | REQUIRED | root `@` → grouped options → popup/keyboard | AC19 순수+render 순서 table | required — path/Plugin 형제 group 맞바꿈 | EP-07 (2) |
| VP-16 | R-06 ↔ AT-06 | REQUIRED | draft clear → token null → new `@` → open | AC20 동일 hook sequence | required — token-null reset 제거 | EP-08 (2) |
| VP-17 | R-07 ↔ AT-07~10 | REQUIRED | four category inputs → wire → list/detail | AC21~24 category matrix | required — 한 category의 catalog 전달 제거 | EP-09~11 (9) |
| VP-18 | SD-04 ↔ ST-04 | REQUIRED | parser → occurrence state → groups/index → popup | lifecycle/controller integration | required — stale dismissed partial 유지 | EP-07~08 (4) |
| VP-19 | SD-05 ↔ ST-05 | REQUIRED | deployment config → normalized source → state push → two UI consumers | producer-consumer integration fixture | required — input category 하나를 undefined로 소실 | EP-09~11 (9) |
| VP-20 | AR-04 ↔ IT-04 | REQUIRED | ConnectionViewSource → ProviderInfo → resolver/projector | four-category wire test | required — catalog edge 또는 plugin-only tools guard 제거 | EP-10~12 (6) |
| VP-21 | MD-05 ↔ UT-05 | REQUIRED | group projection → flatten index | exact ordered arrays | required — sibling swap | EP-07 (2) |
| VP-22 | MD-06 ↔ UT-06 | REQUIRED | partial/token occurrence → dismissal/index | state transition table | required — occurrence reset 제거 | EP-08 (2) |
| VP-23 | MD-07 ↔ UT-07 | REQUIRED | input normalize + tools filter → render/mention models | normalizer + projector matrices | required — catalog를 다시 Plugin 판별자로 사용 | EP-09·12 (6) |
| VP-24 | R-08 ↔ AT-11 | REGRESSION | file/skill/plugin/auth/usage 기존 entry → 기존 sink | AC25 기존 focused suites | required — non-Plugin category를 plugin으로 변경 | EP-08·11·12 (7) |
| VP-25 | V1 R-03 ↔ AT-03 | REGRESSION | provider detail presentation → auth actions | ProviderDetail/auth action render suites | not selected — 직접 callback/status oracle | EP-11 하위 (2) |

### ΔV1 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| renderer/main/shared Vitest | occurrence·projection·wire·normalizer 변경 | direct `vitest run`의 §Δ10 suites | 변경 suite·명시 regression 실패 blocking |
| typecheck | shared wire field 타입·호환 alias·네 category input | `npm.cmd run typecheck` | 신규 타입 오류 blocking |
| lint/boundaries | shared→main→renderer 방향과 feature 격리 | `npm.cmd run lint` | 현재 변경 error blocking |
| current docs/inventory | IPC·Auth·frontend·폐쇄망 계약 갱신 | `node scripts/check-doc-inventory.mjs --check` | 변경 문서 실패 blocking |
| repository/message-bus | plan/INDEX/trailer 두 사본 정합 | `git diff --check`, trailer parse | 현재 handoff 불일치 blocking |

## Δ7. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
root @ → Plugin group → path group
dismissedAt=partial string → token null → same partial string → stale dismissed

PluginBinding.catalog → plugin ConnectionViewSource → ProviderInfo.catalog
gate/harness/usage → no catalog → power/Auth label
Plugin mention = catalog present && tools nonempty
```

- group 배열이 UI와 keyboard 순서의 정본이며 현재 Plugin을 먼저 push한다.
- shared autocomplete state는 token occurrence가 아니라 partial 문자열만 dismissal identity로 가진다.
- `catalog`는 presentation과 Plugin category 표식 두 역할을 동시에 하며 non-Plugin source는 입력 자리가 없다.

### TO-BE

```text
root @ → path group → Plugin group
token occurrence end(null) → reset dismissal/index → new occurrence opens

ProviderCatalogPresentationInput
  → normalize once at connection source boundary
  → ConnectionViewSource{category,catalog?}
  → ProviderInfo{catalog?,tools}
  ├→ providerPresentation → list/detail
  └→ pluginMention(tools>0; main producer is plugin-only)
```

- 표시 계약은 generic shared type이 소유하고 기존 Plugin type export는 alias다.
- connection source factory가 optional input을 정규화한다. input 부재 non-Plugin은 catalog를 만들지 않는다.
- `UsageFetcher`는 presentation을 모르며 deployment connections가 usage row의 표시 입력을 소유한다.

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현 연결 |
|---|---|---|---|---|
| group 위치 | Plugin→path | path→Plugin | 사용자 변경 | VP-15·21 / `mentionAutocomplete.ts` |
| dismissal identity | partial 문자열 | token occurrence 경계 | delete/retype bug | VP-16·18·22 / shared hook |
| presentation 범위 | Plugin만 | 네 category optional | 사용자 보완 | VP-17·19 / shared+connections |
| Plugin 판별 | catalog+tools | plugin-only tools producer + tools filter | catalog 의미 일반화 | VP-20·23·24 / wire+projector |
| usage 책임 | fetcher와 row가 별도이나 row presentation 없음 | row만 presentation 입력, fetcher 불변 | 레이어 보존 | VP-17·24 / deployment guide |
| consumer naming | pluginPresentation | providerPresentation | 비Plugin 표시 지원 | VP-19·25 / skills renderer |

## Δ8. 계약 / 타입 / 강제 지점

| EP | 계약/필드 | SSOT | 누가/언제 강제 | 실패 의미 |
|---|---|---|---|---|
| EP-07 | root group order=`path → plugin`; header는 option 아님 | `groupMentionSuggestions`·flatten model | token projection/render 시 2곳 | 화면/keyboard 순서 불일치 |
| EP-08 | token null은 occurrence 종료·dismissal/index reset | `useTokenAutocompleteState` | shared hook state + mention open 계산 2곳 | 같은 `@` 재입력 미오픈 또는 stale index |
| EP-09 | generic input shape·icon/locale validation·Plugin compatibility alias | shared catalog module | typecheck/normalization 3곳 | category별 config drift·source break |
| EP-10 | 네 category optional catalog + Plugin-only tools | connection source factory·`toolsOf`·`connectionInfo` | boot source 조립/list/state 3곳 | presentation 유실·non-Plugin tool 오염 |
| EP-11 | list/detail가 같은 provider presentation resolver 사용 | provider resolver·CustomizeList·ProviderDetail | render 3곳 | 목록/상세 불일치 |
| EP-12 | Plugin candidate=`tools.length>0`; catalog/status 비의존 | `toolsOf` + `pluginMentionCandidates` | producer·후보·valid id projection 3곳 | non-Plugin mention 오염·chip drift |
| EP-13 | current docs가 path-first·네 category·usage 분리를 설명 | IPC·TRD·backend Auth·frontend UX·폐쇄망 guide | 문서 gate 5곳 | 배포 입력·현재 동작 drift |

- `catalog===undefined`: gate/harness/usage는 기존 fallback, Plugin source에는 binding default가 있으므로 정상 조립에서 undefined가 아니다.
- 기존 `ProviderInfo.kind`와 JSON field shape는 유지한다. internal source category는 `toolsOf()`와 catalog normalization의 producer 분기에만 사용한다.
- `ProviderCatalogPresentationInput`은 icon만 optional이고 title/body가 있으면 ko/en은 계속 필수다. locale fallback·attribution shape는 0236 계약을 바꾸지 않는다.
- 강제 지점 분모는 불변식 주어로 재검색한다: category union/constructor, catalog producer/consumer, Plugin candidate/valid-id 두 경로, group/flatten/open state를 각각 센다.

## Δ9. 구현 설계 / 영향 파일

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `shared/{provider-catalog.ts,plugin-catalog.ts,ipc.ts}` | generic presentation·wire | canonical generic type/normalizer, Plugin alias, 기존 `catalog` field type 일반화 | pure/type fixture |
| `main/app/deployment/connections.ts` | connection input normalization | 네 category source factory와 기존 helpers의 호환 경로 | deployment wiring |
| `main/app/connection-views.ts` | source→wire | category와 optional catalog를 모든 variant에서 투영, tools는 plugin-only 유지 | category matrix |
| `chat/lib/mentionAutocomplete.ts` | group/flat order | path 먼저, Plugin 마지막 | ordered pure unit |
| `chat/hooks/useTokenAutocompleteState.ts` | occurrence lifecycle | token 부재 reset과 active index 초기화 | deterministic hook fixture |
| `chat/hooks/useMentionAutocomplete.ts` | open integration | 새 occurrence state를 mention token과 연결 | integration fixture |
| `chat/lib/pluginMention.ts` | Plugin projection | tools predicate, status/catalog 비의존 | exhaustive matrix |
| `skills/lib/providerPresentation.ts` | 공용 render model | 기존 locale/icon/title/body/attribution fallback 일반화 | pure table |
| `CustomizeList.tsx`, `ProviderDetail.tsx` | list/detail consumer | 공용 resolver 사용, auth action 유지 | render regression |
| 관련 tests | direct evidence | group swap·clear/retype·four category·compat alias·legacy regressions | Vitest |
| `IPC_CONTRACT.md`, `TRD.md`, `auth.md`, `ux-domains.md`, `closed-network-extensions.md` | current/deployment 계약 | Plugin-only/Plugin-first 문구 교체와 category별 입력 예제 | doc gate |

### End-to-end·lifecycle

- provider state invoke와 push는 같은 `connectionInfo()`를 쓰므로 optional catalog와 plugin-only tools를 한 mapper에서 싣는다.
- token occurrence reset은 renderer-local state이며 저장·IPC·네트워크 요청을 만들지 않는다. token이 없어진 순간 active index도 0으로 돌아간다.
- presentation normalizer는 source 조립 시 한 번 호출한다. state push마다 localized text를 다시 복사/검증하지 않는다.
- 다중 저장소 쓰기: 제품 쓰기 없음. plan 상태와 INDEX 보드는 같은 설계 커밋에서 함께 갱신한다.

### 성능 / 상한

- popup option 상한은 V1의 `P + min(F,8)`로 불변이며 group 순서만 바뀐다. keystroke당 provider IPC 0도 유지한다.
- `ProviderInfo`에는 새 필드가 없고 기존 optional catalog payload의 producer만 넓어진다. 입력이 없는 non-Plugin row의 catalog payload는 0이다.
- 새 네트워크·DB·scheduler 호출은 0이다. usage fetch 주기와 요청 수는 불변이다.

## Δ10. 게이트

- 관련 순수 테스트: `mentionAutocomplete.test.ts`, 신규 shared autocomplete state test, `pluginMention.test.ts`, `plugin-catalog/provider-catalog.test.ts`, `connection-views.test.ts`, `deployment-wiring.test.ts`, `pluginPresentation/providerPresentation.test.ts`, `CustomizeList.render.test.ts`, `ProviderDetail.render.test.ts`.
- 회귀 테스트: `useFileAutocomplete.test.ts`, skill autocomplete tests, Provider auth action tests, deployment usage fixture.
- 정적/문서: `npm.cmd run typecheck`, `npm.cmd run lint`, `node scripts/check-doc-inventory.mjs --check`, `git diff --check`.
- 선택 mutation: ① path/Plugin 형제 group 맞바꿈, ② token-null reset 제거, ③ gate/harness/usage 중 한 category catalog edge 제거, ④ `toolsOf()`의 plugin-only guard 제거, ⑤ projector를 catalog 기반으로 되돌림.
- 사람 실기: Composer path-first/Plugin-last와 clear/retype, 두 테마의 gate/harness/usage custom presentation. 기계 oracle이 있는 재입력·분류를 사람 실기만으로 판정하지 않는다.

## ΔV1 READY self-review

- [x] D-007·D-005와 0236 D-004를 SUPERSEDED 관계로 보존하고 D-014~D-021을 추가했다.
- [x] 사용자 요구 4건과 요구가 가리킨 코드·문서 레퍼런스를 §Δ1에 전수 기록했다.
- [x] group 위치·token occurrence·presentation category가 AC19~AC24와 Technical Design에 연결된다.
- [x] 기존 file/skill mention·Plugin id·auth action·usage 동작은 AC25 REGRESSION으로 남겼다.
- [x] `V1@651d9080 + ΔV1` 기준과 변경 시작 R, NEW/CHANGED node의 REQUIRED pair를 기록했다.
- [x] V1 R-02/SD-02/AR-02/MD-02는 새 node로 분해·대체했고, 유지 동작 R-08과 V1 R-03은 VP-24·VP-25 REGRESSION으로 다시 닫는다.
- [x] pair마다 production path·직접 oracle·EP 분모가 있고 순서/재진입/분류 축만 mutation을 선택했다.
- [x] category presentation이 Plugin mention 판별을 오염시키는 역방향 회귀를 D-017·AC23·VP-23/24로 차단했다.
- [x] usage 표시와 UsageFetcher 동작을 D-020으로 분리하고 신규 네트워크/DB/의존성 0을 확인했다.
- [x] renderer/main/shared/docs의 현재 가이드와 ABI-중립 gate를 반영했다.
- [x] **ACTIVE 결정 ↔ AC 대조 결과 충돌 0**이며 plan과 INDEX 두 상태 사본을 함께 갱신한다.

---

## [구현자 기입] 설계 리뷰 (r1 — V1)

- 동의 / 그대로 진행: Fable family/env 확장, 기존 파일 자동완성의 grouped mention 투영, ProviderDetail auth action 분리 설계에 동의한다. 구현 중 실제 컴포넌트 경계·ProviderInfo 타입이 plan의 가정과 다르면 명시적으로 기록한다.
- 이견 / 현실성 문제: `FileAutocomplete`와 `useFileAutocomplete`의 기존 공개 표면은 다른 회귀 테스트와도 연결되어 있어 삭제하지 않고, 새 `mentionAutocomplete` 순수 규칙을 위임하는 호환 껍데기로 남겼다. Composer controller의 실제 경로는 새 grouped mention hook/popup이다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 계획에 없던 `providerAuthActionModel.ts` 순수 seam과 `EngineModelList.render.test.ts`는 fast-refresh/lint 및 1M sibling 행 오라클을 위해 추가한 구현·검증 파일이며 제품 계약을 바꾸지 않는다.

## [구현자 기입] 강제 지점 전수 (§10 대조, r1 — V1)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01·05·08·11 | Fable family/env/default와 모델 identity | EP-01 4곳, EP-02 3곳 | EP-01=`FAMILY_ORDER`·`ALIAS_ENV_KEY`·`DEFAULT_FAMILY_ORDER`·shared `CLAUDE_MODEL_FAMILIES`; EP-02=`toAgentEnvironment`·Composer `modelIdentity`·Engine `key`. | §19 targeted Vitest 50 files/368 tests green; parser Fable env·fallback red 변이도 확인. | AC1~5, MD-01, AR-01 |
| VP-02·06 | `@` source → grouped option → draft | EP-03 2곳, EP-04 parse/group/flatten/replace/keyboard/deco 6곳 | EP-03=`connectionInfo()`·`pluginMentionCandidates`; EP-04=`parseMentionToken`·`groupMentionSuggestions`·`flattenMentionGroups`·`applyMentionSuggestion`·controller 키보드/apply·decoration surface/layer. | plugin/mention pure tests와 Composer/hooks suite가 green; group/id 변이 red. | AC6~12, MD-02 |
| VP-03·07·10·14 | auth status → trigger/menu/callback | EP-05 5곳 | EP-05=`providerAuthActionKind`·직접 Button·dropdown Button/Popover·재인증 MenuItem·`danger` revoke MenuItem을 `ProviderDetail`에 연결했다. | auth action matrix/model + ProviderDetail/providerRows suite green; branch/danger 변이 red. | AC13~16, AR-03/MD-04 |
| VP-04 | 문서·i18n current contract | EP-06 6곳 | EP-06=`ko.ts`·`en.ts`·TRD·frontend UX·backend auth·폐쇄망 guide를 같은 Fable/Plugin/auth 용어로 갱신했다. | doc inventory/prose/link gate green; stale 3-family/path-only 표현 없음. | AC17~18, R-04 |
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

## [구현자 기입] 이번 라운드 수정의 잠금 (r1 — V1)

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

## [구현자 기입] Product/UX 파생 검토 (r1 — V1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | **예** — `skills.provider.authenticate`, Plugin 그룹/aria 키는 각각 `ProviderAuthActions`·`MentionAutocomplete`에서 소비되고 en/ko parity가 있다. | 별도 후속 없음; i18n parity gate 유지 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | **예** — auth 순수 model은 컴포넌트 밖으로만 분리했고, Composer hook은 active cleanup·legacy hook 위임을 유지했다. | legacy 파일 popup은 호환용으로 남기고 추후 제거 여부를 별도 결정 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | provider/file source 실패는 popup loading/empty 행, auth 실패·만료는 기존 status 행, cwd 변경은 file cache 무효화 행이다. | 각 경로를 §19 targeted suite와 source inspection으로 고정 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | **예** — provider 조회 실패에도 cwd가 있으면 path 후보를 유지하고, file 실패는 empty group, 비동기 조회는 loading, auth는 직접 인증/메뉴 trigger를 남긴다. | 사람 실기에서 문구·clipping 확인 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | **예** — provider/file 요청에 cancel flag, draft 적용에 deferred revision fence, 메뉴 callback은 close 후 실행이다. | 실제 Electron 재진입은 검증자/사람 실기에서 확인 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1 — V1)

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

## [구현자 기입] 구현 보고 (r1 — V1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | main: `model-parser.ts`, parser/settings/model tests; renderer chat: `pluginMention.ts`, `mentionAutocomplete.ts`, `useMentionAutocomplete.ts`, grouped popup, controller/surface/decoration, legacy file hook 위임; engine: `EngineModelList.tsx`/render test; skills: `ProviderAuthActions.tsx`/model/test, `ProviderDetail.tsx`; ko/en i18n; TRD·frontend UX·backend auth·폐쇄망 guide; 이 plan과 `docs/handoff/INDEX.md`. |
| 실행 명령 | §19 targeted `npx.cmd vitest run ...` (**50 files / 368 tests**); `npx.cmd vitest run src/renderer/src/features/chat/hooks/useFileAutocomplete.test.ts` (**4/4**); `npm.cmd run typecheck`; `npm.cmd run lint`; `node scripts/check-doc-inventory.mjs --check`; `git diff --check`; 선택 mutation 7종 focused Vitest. |
| 관측한 게이트 산출 | targeted/legacy Vitest green; typecheck 3 configs exit 0; lint 0 errors·기존 warning 1; doc inventory **9 items·98 channels**, prose/links green; diff check exit 0. |
| V-pair 자기확인 | VP-01~VP-14 **14/14 SELF_PASS**; `SELF_BLOCKED` 0. 직접 oracle과 선택 mutation 결과는 위 표에 기록했다. |
| 강제 지점 전수 | EP-01 **4/4**, EP-02 **3/3**, EP-03 **2/2**, EP-04 **6/6**, EP-05 **5/5**, EP-06 **6/6** — 합계 **26/26**. |
| AC 자기보고 | 기계 범위 AC **18/18 ✅**. 후보/상태/selection/replacement는 테스트로 닫았고, 두 테마·좁은 패널·실제 Electron 시각은 사람/검증자 대기다. |
| 합계 검산 | V-pair 14/14 + EP 26/26 + AC 18/18 + mutation **7/7 red** + 운영 gate 5종 green. |
| 블로커 / 역질문 | 코드 블로커 없음. Electron/SDK 실제 실행 및 두 테마 시각 확인은 환경상 수행하지 않았으므로 다음 주체가 확인한다. |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1 — V1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **아니오** — 이전 구현 라운드가 없는 Baseline V1 신규 축이다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: **예** — §10 EP 분모, VP-01~14 pair, §19 mutation/사람 실기, AC1~18이 모두 선행 기재되어 있었다.
- 반복해서 부딪히는 환경 한계: Electron/SDK/native 실행과 두 테마 시각은 이 환경에서 수행하지 못해 direct Vitest와 정적 gate로 대체했다.
- 현재 라운드 수: **1**.

## [구현자 기입] 설계 리뷰 (r2 — ΔV1)

- 동의 / 그대로 진행: ✅ D-014~D-021, AC19~AC25, VP-15~25의 Delta V1 설계를 그대로 적용했다.
- 이견 / 현실성 문제: 없음. `ProviderCatalog*` 정본과 기존 Plugin facade, row helper로 계획 범위 안의 API 표면 차이를 닫았다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. UsageFetcher 포트·ProviderInfo 외부 field·IPC·DB·migration은 변경하지 않았다.

## [구현자 기입] 강제 지점 전수 (§Δ8 대조, r2 — ΔV1)

| Pair | 계약/필드 | §Δ8이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-15 | R-05↔AT-05 | EP-07: path group first / Plugin group last | `mentionAutocomplete.ts` push 순서와 flatten test | `mentionAutocomplete.test.ts` 5/5 | SELF_PASS |
| VP-16 | R-06↔AT-06 | EP-08: token-null occurrence 종료 | `useTokenAutocompleteState` + clear/retype fixture | `useFileAutocomplete.test.ts` 4/4 | SELF_PASS |
| VP-17 | R-07↔AT-07~10 | EP-09~11: 네 category catalog 입력·wire·consumer | `connections.test.ts`, `connection-views.test.ts` | category matrix 및 focused suite | SELF_PASS |
| VP-18 | SD-04↔ST-04 | EP-08: parser/state/open lifecycle | shared hook과 `useMentionAutocomplete` 경계 | clear 후 재입력에서 index 0/open | SELF_PASS |
| VP-19 | SD-05↔ST-05 | EP-09~11: deployment producer→normalized source | `gateRows`·`harnessRows`·`usageRows`·`pluginRows` | 4-category source factory | SELF_PASS |
| VP-20 | AR-04↔IT-04 | EP-10~12: source→ProviderInfo→projector | `connectionInfo`, `toolsOf`, `pluginMentionCandidates` | catalog 보존 + Plugin-only tools | SELF_PASS |
| VP-21 | MD-05↔UT-05 | EP-07: ordered group/flat index | sibling swap mutation | path→Plugin 배열 oracle | SELF_PASS |
| VP-22 | MD-06↔UT-06 | EP-08: occurrence/dismissal/index state | token-null reset mutation | close→clear→retype reopen | SELF_PASS |
| VP-23 | MD-07↔UT-07 | EP-09·12: normalize + tools predicate | catalog discriminator mutation | canonical alias와 tools matrix | SELF_PASS |
| VP-24 | R-08↔AT-11 | EP-08·11·12: file/skill/plugin/auth/usage regression | 12-file focused regression suite | 85/85 tests pass | SELF_PASS |
| VP-25 | V1 R-03↔AT-03 | EP-11: detail presentation/auth actions | ProviderDetail/AuthActions suite | 기존 callback/status oracle 유지 | SELF_PASS |

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-15 | REQUIRED | SELF_PASS | group order + flatten | group sibling swap: 1 failure, restored |
| VP-16 | REQUIRED | SELF_PASS | token occurrence reset | token-null reset 제거: 1 failure, restored |
| VP-17 | REQUIRED | SELF_PASS | four-category catalog matrix | category catalog edge 제거: 1 failure, restored |
| VP-18 | REQUIRED | SELF_PASS | shared state/open lifecycle | clear/retype fixture: 1 failure when reset removed |
| VP-19 | REQUIRED | SELF_PASS | deployment source factory | gate/harness/usage row tests pass |
| VP-20 | REQUIRED | SELF_PASS | source wire/projector | non-Plugin catalog edge 제거: 1 failure, restored |
| VP-21 | REQUIRED | SELF_PASS | exact ordered arrays | path/Plugin sibling swap: 1 failure, restored |
| VP-22 | REQUIRED | SELF_PASS | state transition table | token-null reset 제거: 1 failure, restored |
| VP-23 | REQUIRED | SELF_PASS | normalizer + candidate predicate | catalog-based projector: 1 failure, restored |
| VP-24 | REGRESSION | SELF_PASS | existing V1 entry/sink suite | focused 12 files / 85 tests pass |
| VP-25 | REGRESSION | SELF_PASS | ProviderDetail/AuthActions | focused auth/detail tests pass |

## [구현자 기입] 이번 라운드 수정의 잠금 (r2 — ΔV1)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| group sibling swap (`path`↔`plugin`) | VP-15·21 / EP-07 | path-first contract | `mentionAutocomplete.test.ts`: 1 failure | RED → 복원 |
| token-null reset branch 제거 | VP-16·22 / EP-08 | clear/retype occurrence oracle | `useFileAutocomplete.test.ts`: 1 failure | RED → 복원 |
| non-Plugin catalog spread 제거 | VP-17·20 / EP-10 | four-category catalog preservation | `connection-views.test.ts`: 1 failure | RED → 복원 |
| `toolsOf()` Plugin-only guard 제거 | VP-20·23 / EP-10·12 | non-Plugin tools must stay empty | `connection-views.test.ts`: 1 failure | RED → 복원 |
| projector를 catalog discriminator로 회귀 | VP-23·24 / EP-12 | no-catalog Plugin with tools remains candidate | `pluginMention.test.ts`: 1 failure | RED → 복원 |

- 분모 검산: 선택 mutation **5/5 RED**, 복원 후 focused suite **12 files / 85 tests PASS**.
- 덮개 회귀: r1의 Composer projector/group 축은 VP-15·20·21·23·24에서 재실행했고, 기존 auth/detail/usage 진입점은 VP-24·25에서 재확인했다.

## [구현자 기입] Product/UX 파생 검토 (r2 — ΔV1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 예 | 새 label은 없고 provider catalog가 list/detail의 공통 표시 모델로 소비된다. |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 예 | `providerPresentation` wrapper와 connection row helper는 기존 consumer/import scope를 유지한다. |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 예 | `@` 전체 삭제는 token occurrence 종료 행, catalog 부재는 category fallback 행이다. |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 예 | clear 후 재입력은 popup을 다시 열고, catalog 부재는 기존 power/Auth 표시를 유지한다. |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 | 새 비동기 요청/구독을 만들지 않았고 occurrence state는 renderer local이다. |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2 — ΔV1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 직접 `ConnectionViewSource`를 만드는 호출자가 raw catalog input을 넣을 수 있음 | deployment row helper에서만 input을 normalize하고 source type은 normalized presentation을 요구한다. | `connections.ts`, `connection-views.ts` |
| 2 | UsageFetcher에 표시 책임이 섞일 위험 | presentation은 `category:'usage'` row가 소유하고 `supports/fetchUsage`·snapshot은 변경하지 않았다. | D-020, usageRows test |
| 3 | 기존 Plugin import 경로와 새 Provider 명칭의 drift | `plugin-catalog.ts`와 `pluginPresentation.ts`를 compatibility facade로 남겼다. | D-019, alias test |
| 4 | Electron 두 테마와 custom gate/harness/usage 시각 차이 | 자동화 가능한 contract/render gate를 닫고 사람 검증 대상으로 남겼다. | §10 사람 실기 항목 |

### 설계 대비 명시적 차이 (r2 — ΔV1)

- plan이 지정한 것과 다르게 구현한 것과 그 이유: `provider-catalog.ts`와 `providerPresentation.ts`를 새 정본으로 두고 기존 Plugin 파일은 facade로 남겼다. D-019의 canonical naming과 기존 import/배포 호환을 동시에 보장하기 위한 구현 차이다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§Δ8 행 / 관측 |
|---|---|---|
| 만료 | 새 만료 경로 없음; 기존 auth status는 읽기 전용 | VP-24·25 focused auth/detail suite pass |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 새 shared mutable store 없음; occurrence state는 hook instance가 소유 | VP-16·18·22 clear/retype oracle |
| 재진입 | partial 문자열이 아니라 null 경계로 occurrence를 나누고 index/dismissal을 초기화 | VP-16·22, token-null mutation RED |
| 다른 무효화 축 | catalog 부재는 fallback일 뿐 Plugin 후보 판별 축이 아니며, tools만 projector 입력이다 | VP-20·23·24, catalog mutation RED |

## [구현자 기입] 구현 보고 (r2 — ΔV1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | shared provider catalog/IPC facade, main connection source/wire, renderer mention lifecycle/projector/presentation consumer, focused tests, current contract docs/guide |
| 실행 명령 | `npx.cmd vitest run` focused 12 files; `npm.cmd run typecheck`; `npm.cmd run lint`; `node scripts/check-doc-inventory.mjs --check`; `git diff --check`; 선택 mutation 5종 |
| 관측한 게이트 산출 | Vitest **12 files / 85 tests PASS**; typecheck 3 config exit 0; lint 0 errors·기존 warning 1; doc inventory **9 items / 98 channels**; diff check pass |
| V-pair 자기확인 | VP-15~25 **11/11 SELF_PASS**, SELF_BLOCKED 0 |
| 강제 지점 전수 | EP-07 **2/2**, EP-08 **2/2**, EP-09 **3/3**, EP-10 **3/3**, EP-11 **3/3**, EP-12 **3/3**, EP-13 **5/5** — 합계 **21/21** |
| AC 자기보고 | 기계 검증 AC **7/7**(AC19~25); 사람 검증은 두 테마·path-first/Plugin-last·custom catalog 시각 확인 pending |
| 합계 검산 | VP 11/11 + EP 21/21 + AC 7/7 + mutation 5/5 RED→복원 + 운영 gate 5종 pass |
| 블로커 / 역질문 | 코드 blocker 없음. Electron 시각 검증만 다음 Claude verify에서 수행한다. |
| 대상 커밋 | `(r2 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r2 — ΔV1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **아니오** — ΔV1의 group order, token occurrence, category catalog 범위가 새 축이고 V1 회귀는 별도 재확인했다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: **예** — D-014~D-021, AC19~25, VP-15~25, EP-07~13이 이번 라운드에 선행 기재되어 있었다.
- 반복해서 부딪히는 환경 한계: Electron/SDK/native 실행과 두 테마 시각은 이 환경에서 수행하지 못해 direct Vitest·정적 gate로 대체했다. lint warning 1건은 기존 TanStack Virtual 경고다.
- 현재 라운드 수: **2**.

## [구현자 기입] 설계 리뷰 (r3 — verify/FAIL D1~D12)

- 동의 / 그대로 진행: ✅ D1~D8 BLOCKING과 D9~D12 NON_BLOCKING을 V1+ΔV1 규범 행 변경 없이 닫았다. Decision·AC·V pair·§10은 수정하지 않았다.
- 이견 / 현실성 문제: 없음. D13(plan 메타 죽은 좌표)은 설계자 소유 행이라 손대지 않았다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. D2의 빈 그룹 제거는 V1 §5 “한 그룹만 비면 빈 그룹 header는 렌더하지 않는다”를 그대로 따른다.
- 구현 주체: 보드의 다음 주체는 Codex였으나 사용자가 `/handoff-impl`을 명시 호출해 Claude가 구현했다(`docs/handoff/AGENTS.md §역할 분담`).

## [구현자 기입] 강제 지점 전수 (r3 — 파생 이슈 불변식)

| 파생 이슈 → 불변식 | 지점 전수 (검색) | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| D1 → **dismissal을 쓰는 것은 `close` 하나뿐이다** | `rg 'dismiss' app/src/renderer/src/features/chat/hooks` → 쓰기 지점: `useTokenAutocompleteState` close·setActiveIndex·occurrence 경계 3 | `setActiveIndex`는 `activeIndex`만, 경계는 `dismissedAt:null` (`useTokenAutocompleteState.ts:41-58`) — 소비자 2(`useSkillAutocomplete`·`useMentionAutocomplete`) 모두 이 상태 머신 | `useMentionAutocomplete.test` “keeps a popup reopened…”, `useSkillAutocomplete.test` “does not re-dismiss…” green; D1-revert red 2 | 없음 |
| D2 → **빈 그룹은 만들지 않고, 옵션 0건이면 noMatches** | group 생성 2(`groupMentionSuggestions` path·plugin) + popup empty 판정 1 | path는 `pathSuggestions.length>0`일 때만(`mentionAutocomplete.ts:75`), popup은 `suggestions.length===0`(`MentionAutocomplete.tsx`) | `MentionAutocomplete.render.test` root/slash 0건 noMatches, D2-revert red 4 | 없음 |
| D3 → **Plugin chip은 토큰 전체가 id일 때만** | chip regex 3(`SKILL`·`PLUGIN`·`FILE`) 중 Plugin/file 충돌 가능 1 | `PLUGIN_TOKEN_RE` 끝 경계 `(?=\s|$)` (`composerDecoration.ts:3`) | `composerDecoration.test` 경로 충돌 case, D3-revert red 1 | 없음 |
| D4 → **배지는 자기 행에 붙는다** | EP-02 Engine 1 | 행 분할 후 행별 `[1M, default]` 단언 | M3 red 1 | 없음 |
| D5 → **메뉴 순서·danger는 model이 SSOT, 렌더 트리가 그것을 소비한다** | EP-05 5(predicate·직접 trigger·dropdown·reauth·revoke) | JSX가 `providerAuthMenuItems.map`으로 렌더(`ProviderAuthActions.tsx:73-85`), 렌더 트리 test 3케이스 | M9 red 3·M10 red 4·M10b red 5·M11 red 1·M13 red 1 | 없음 |
| D6 → **render 순서 = flatten 순서** | EP-07 2(group 투영·render) | `MentionAutocomplete.render.test` 순서·flat index 선택 | N1b red 1, N1 red 3 | 없음 |
| D7 → **production hook이 AC10·AC20·dismissal을 직접 단언** | `useMentionAutocomplete` 1 (죽은 `useFileAutocomplete`·`FileAutocomplete` 삭제, 테스트 4케이스 이전) | `useMentionAutocomplete.test.ts` 13케이스 | N6 red 3·M7 red 1·N2b red 1·N2 red 4 | 없음 |
| D8 → **Plugin 판별은 tools 한 술어 — valid id 지점 포함** | EP-12 3(`toolsOf`·후보·valid id) | valid id matrix(catalog∧no-tools 제외·no-catalog∧tools 포함) | EP12 red 2 | 없음 |
| D9 → **row 조각은 입력을 반드시 정규화·검증한다** | row 조각 3(`gateRows`·`harnessRows`·`usageRows`) | icon 기본값·빈 locale 거부 test | N9b red 2·N9c red 2 | 없음 |
| D10 | current `docs/arch/frontend` 인용 5파일 | `rg 'FileAutocomplete|useFileAutocomplete' docs app/src --glob '!docs/{archive,handoff,etc}/**'` → **0줄** | 위 명령 출력 0 | `docs/etc/study/**`는 evidence라 유지 |
| D11 | 미사용 export 4(`useFileAutocomplete`·`FileAutocomplete`·`mentionGroupOptions`·`projectPluginMentions`) + i18n `fileAutocompleteAria` | 삭제, `splitDirAndPrefix` 비export | `rg 'mentionGroupOptions|projectPluginMentions|fileAutocompleteAria' app/src` → 0줄 | 없음 |
| D12 | bootstrap이 넘기지 않는 deps 3 | `ConnectionDeploymentDeps`에서 제거, guide 표·예제 2곳 정정 | `rg 'gateCatalog' app docs` → 0줄 | 없음 |

**V-pair 자기확인 (r2 verify의 root·BLOCKED pair)**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | Engine 행별 배지 | M3 red 1 |
| VP-03 | REQUIRED | SELF_PASS | 분기 + 렌더 danger | M8 red 11·M8b red 7·M9 red 3 |
| VP-07 | REQUIRED | SELF_PASS | close→callback 로그 | M11 red 1 |
| VP-10 | REQUIRED | SELF_PASS | 항목별 callback 1회 | M13 red 1 |
| VP-13 | REQUIRED | SELF_PASS | 경로/Plugin 충돌 chip | M14 red 1·D3-revert red 1 |
| VP-14 | REQUIRED | SELF_PASS | 렌더 순서·danger | M9 red 3·M10 red 4·M10b red 5 |
| VP-15 | REQUIRED | SELF_PASS | 순수+render+hook 순서 | N1 red 3·N1b red 1 |
| VP-18 | REQUIRED | SELF_PASS | production hook lifecycle | N6 red 3·M7 red 1 |
| VP-22 | REQUIRED | SELF_PASS | occurrence·dismissal | N2 red 4·N2b red 1·D1-revert red 2 |
| VP-23 | REQUIRED | SELF_PASS | 후보·valid id tools 술어 | N5 red 6·N5b red 5·EP12 red 2 |
| VP-24 | REGRESSION | SELF_PASS | skill·file dismissal·empty | D1-revert red 2·D2-revert red 4·N7 red 4 |
| VP-25 | REGRESSION | SELF_PASS | ProviderDetail + 렌더 트리 callback | M13 red 1·M8b red 7 |

- r2 verify PASS 9 pair(VP-04·05·08·11·16·17·19·20·21)는 아래 이전 red 19건 재실행으로 덮개 회귀 0을 확인했다. VP-19의 N9(factory `gateCatalog` 누락)는 D12로 대상 필드가 삭제돼 해당 없음.

## [구현자 기입] 이번 라운드 수정의 잠금 (r3)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M3 Engine 1M↔default 조건 맞바꿈 | D4 인용 | green | `EngineModelList.render.test` 1 | RED → 복원 |
| M9 JSX `danger={false}` | D5 인용 | green | `ProviderAuthActions.render.test` 3 | RED → 복원 |
| M10 렌더 순서 역전 | D5 인용 | green | `ProviderAuthActions.render.test` 4 | RED → 복원 |
| M11 callback 후 close | D5 인용 | green | `ProviderAuthActions.render.test` 1 | RED → 복원 |
| M13 재인증↔연결 해제 onClick 맞바꿈 | D5 인용 | green | `ProviderAuthActions.render.test` 1 | RED → 복원 |
| N1b popup render groups 역순 | D6 인용 | green | `MentionAutocomplete.render.test` 1 | RED → 복원 |
| N6 dismissal의 partial 비교 제거 | D7 인용 | green | mention 2 + skill 1 | RED → 복원 |
| M7 cwd-null Plugin-only open 제거 | D7 인용 | green | `useMentionAutocomplete.test` 1 | RED → 복원 |
| N2b 새 occurrence 분기 제거 | D7 인용 | green | `useMentionAutocomplete.test` 1 | RED → 복원 |
| EP12 valid id를 catalog 판별로 | D8 인용 | green | `useMentionAutocomplete.test` 2 | RED → 복원 |
| D1-revert `setActiveIndex`가 dismissedAt을 현재 partial로 | 새 oracle | 없음 | mention 1 + skill 1 | RED → 복원 |
| D2-revert 빈 path 그룹 push | 새 oracle | 없음 | render 2 + hook 1 + lib 1 | RED → 복원 |
| D3-revert Plugin regex 끝 경계 제거 | 새 oracle | 없음 | `composerDecoration.test` 1 | RED → 복원 |
| N9b harness row 정규화 생략 | D9 인용 / 새 oracle | green | `connections.test` 2 | RED → 복원 |
| N9c usage row 정규화 생략 | 새 oracle (D9 형제) | 없음 | `connections.test` 2 | RED → 복원 |

- 분모 검산: 선택 증거·인용 변이 **11**(D4 1·D5 4·D6 1·D7 3·D8 1·D9 1) · 새 oracle **4**(D1·D2·D3 되돌림, N9c) = 표 행 **15**, 15/15 RED.
- 덮개 회귀: r2 verify가 red로 관측한 19건(M1·M2·M12·M8·M8b·M9b·M14·N1·M5·N2·N5·N5b·N4·N8·N3a·N3b·N3d·N7 + M10b 신규)을 재실행해 전부 red — red→green 0. 명령: `/tmp` 러너가 아래 스위트를 대상으로 변이 1건씩 적용·복원.
- 스위트: model-parser·settings·runtime-catalog·chat/{components/composer,hooks,lib}·engine/components·skills·i18n resources·shared/plugin-catalog·main/app/{connection-views,deployment/{connections,plugins,deployment-wiring}} — baseline **108파일/808케이스** green.

## [구현자 기입] Product/UX 파생 검토 (r3)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 예 — 새 문구 없음. `noMatches`는 `MentionAutocomplete`가 소비, 삭제한 `fileAutocompleteAria`는 소비자 0 | 없음 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 해당 없음 — seam 재배치 없음. 메뉴 JSX map 전환은 `closeThen`·`authKind` 스코프 그대로 | 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 0건 = V1 §5 empty 행, Esc 재개 = V1 §5 cancel 행 | 없음 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 예 — 0건이면 `일치하는 항목 없음`, 재개된 popup은 ↓/hover에도 유지 | slash 0건에서 `./dir/` header가 사라진다(빈 그룹 미렌더). 사람 실기에서 문구 확인 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — 비동기 경로 불변, 기존 owner 테스트 4케이스를 production hook으로 이전해 유지 | 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r3)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | AC11 controller keyboard(↑/↓·Tab/Enter·Esc dispatch) 직접 test가 여전히 없다 | hook `setActiveIndex`·render flat index로 대신 관측, controller 조립 test는 남김 — 보고만 | `ComposerInputController.test.ts`에 mention case 0 |
| 2 | 같은 partial로 되돌아오면(`@a` Esc → `@ab` → `@a`) 다시 닫힌다 | base `6200cf1`의 `dismissedAt` 의미를 보존한 것 — 변경 없음 | `useTokenAutocompleteState.ts` dismissedAt 비교 |
| 3 | 빈 그룹 미렌더로 slash 0건에서 현재 디렉터리 header가 없다 | V1 §5 계약 그대로. 제품 판단이 다르면 설계자 결정 | Product/UX 표 4행 |

### 설계 대비 명시적 차이 (r3)

- 없음. D12의 deps 제거는 r2가 추가했던 미배선 표면을 되돌린 것이며 D-016 경로(row 조각 인자)는 유지된다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 대체 메커니즘 없음 | — |
| 공유 | 해당 없음 | — |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r3)

| 항목 | 내용 |
|---|---|
| 변경 파일 | chat: `useTokenAutocompleteState.ts`·`mentionAutocomplete.ts`·`pluginMention.ts`·`MentionAutocomplete.tsx`·`composerDecoration.ts`, 삭제 `useFileAutocomplete.ts`·`FileAutocomplete.tsx`; skills: `ProviderAuthActions.tsx`; main: `deployment/connections.ts`; i18n ko/en; tests 신규 4·갱신 5; docs `arch/frontend` 5파일·폐쇄망 guide |
| 실행 명령 | `npm run typecheck`; `npm run lint`; `./node_modules/.bin/vitest run <위 스위트>`; `node scripts/check-doc-inventory.mjs --check`; `git diff --cached --check`; 변이 34건 1건씩 |
| 관측한 게이트 산출 | typecheck 3 config `error TS` 0; lint 0 error·1 warning(기존 TanStack Virtual); vitest **108파일/808케이스** pass; doc inventory `9 items, 98 channels`·prose ok·links ok; diff check 출력 0 |
| V-pair 자기확인 | r2 root·BLOCKED 12 pair **12/12 SELF_PASS**, SELF_BLOCKED 0 |
| 강제 지점 전수 | 파생 이슈 불변식 12행 전부 닫음, 남긴 곳 0(D10의 `docs/etc` evidence 제외) |
| AC 자기보고 | ✅ 23 · ⚠️ 1(AC11 controller oracle) · ❌ 0 = **24** (AC7은 AC23이 대체) |
| 합계 검산 | pair 12/12 + 잠금 15/15 + 덮개 19/19 red + AC 23/24 + gate 5종 |
| 블로커 / 역질문 | 없음. 두 테마·clipping·SDK bare `fable`은 사람 실기 |
| 대상 커밋 | `(r3 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r3)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **예** — D1은 r2가 바꾼 occurrence 상태 머신(D-015)의 같은 축, D4~D8은 r1·r2가 등록 변이를 실행하지 않은 oracle 축.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: **예** — V1 §5(dismissal·empty), 각 pair의 등록 적대 증거, AC6·10·15·16·19의 검증 수단.
- 반복해서 부딪히는 환경 한계: Electron/SDK 실기 불가, DB 스위트 ABI.
- 구현·다음 검증 주체가 같은 에이전트(Claude)다 — 다음 verify는 자기 검증 분모 규칙 대상.
- 현재 라운드 수: **3**.

## [구현자 기입] 설계 리뷰 (r4 — 라운드 3, verify/FAIL D14~D20)

- 동의 / 그대로 진행: ✅ r3 verify D14(BLOCKING)와 권장 D15~D18·D20을 V1+ΔV1 규범 행 변경 없이 닫았다. Decision·AC·V pair·§10은 수정하지 않았다.
- 이견 / 현실성 문제: 없음. D19(occurrence identity에 `tokenStart` 포함 여부)는 NEXT_HANDOFF·설계자 판단이라 손대지 않았다. D13도 설계자 몫이다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. D16의 키보드 분기 추출은 동작 보존 — skill·mention 두 분기가 같은 모양이라 한 순수 함수로 합쳤다.
- 구현 주체: 보드 다음 주체는 Codex였으나 사용자가 `/handoff-impl`을 명시 호출해 Claude가 구현했다. 라운드 3의 첫 impl 턴이며 기존 `r3` 라벨과 겹치지 않게 `r4`로 적는다(`docs/handoff/AGENTS.md §라운드`).

## [구현자 기입] 강제 지점 전수 (r4 — 파생 이슈 불변식, 자리 단위)

| 파생 이슈 → 불변식 | 자리 전수 (검색) | 닫은 자리 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| D14·D15 → **인증 callback과 선택 방식은 부모가 받은 그대로 자식에 전달된다** | `rg -n "onLogin\|onReauth\|onRevoke\|authKind=" {ExtensionsCatalogView,ProviderDetail,ProviderAuthActions}.tsx`(구조분해 제외) → 10자리: catalog view 3(`:215·217·218`) · ProviderDetail 4(`:74~77`) · ProviderAuthActions 3(`:41` login · `:81` reauth·revoke) | 10/10 | `providerAuthWiring.render.test` 2케이스 — S1 red 1·S1b red 1·S2 red 1. ProviderAuthActions 3자리는 기존 render test(M13·M8) | 없음 |
| D16 → **키보드는 flatten된 옵션만 순환하고 활성 옵션을 자기 apply로 넘긴다** | 분기 3(↑/↓·Enter/Tab·Esc, `autocompleteKeys.ts`) + controller 호출 2(skill·mention) = 5자리 | 5/5 | `autocompleteKeys.test` 7케이스 — S5a·S5b·S5c red, 배선 W1(skill 호출 제거)·W2(mention apply 맞바꿈)·W3(mention 조건을 skillOpen으로) red | 없음 |
| D17 → **Plugin chip 끝 경계는 공백과 문자열 끝 둘 다다** | `PLUGIN_TOKEN_RE` 끝 lookahead 가지 2(`\s`·`$`) | 2/2 | `composerDecoration.test` draft 끝 case — S6 red 1. `\s` 가지는 기존 `@jira-dc @unknown` | 없음 |
| D18 → **quoted token은 Plugin popup을 열지 않는다** | `pluginOpen` 가드 1 + group 조건 1(`rootPlain`, S12 기존 red) | 2/2 | `useMentionAutocomplete.test` quoted·cwd-null case — S4 red 1 | 없음 |
| D20 | `rg -n "filterFileSuggestions" app/src` → 정의 1·내부 호출 1 | 비export | 외부 참조 0줄 | 없음 |

**V-pair 자기확인 (r3 verify의 root·BLOCKED pair)**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-10 | REQUIRED | SELF_PASS | ProviderDetail·catalog view 전달 props 식별·호출 인자 | 등록 `callback 맞바꿈` — 자리 3곳(M13·S1·S2) 전부 red |
| VP-03 | REQUIRED | SELF_PASS | root VP-10 해소, 분기·danger | M8 red 11·7, M9 red 3 |
| VP-25 | REGRESSION | SELF_PASS | ProviderDetail 트리의 auth action props | S1·S1b red |

## [구현자 기입] 이번 라운드 수정의 잠금 (r4)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| S1 ProviderDetail `onReauth`↔`onRevoke` 전달 맞바꿈 | D14 인용 | green | `providerAuthWiring.render` 1 | RED → 복원 |
| S1b ProviderDetail `authKind={null}` | D14 인용 | green | `providerAuthWiring.render` 1 | RED → 복원 |
| S2 catalog view `onReauth`→`providers.revoke` | D15 인용 | green | `providerAuthWiring.render` 1 | RED → 복원 |
| S5a ↑/↓ 모듈로에 header 1칸 포함 | D16 인용 | green | `autocompleteKeys` 1 | RED → 복원 |
| S5b Enter/Tab이 첫 옵션 고정 | D16 인용 | green | `autocompleteKeys` 2 | RED → 복원 |
| S5c Esc가 close 안 부름 | D16 인용 | green | `autocompleteKeys` 1 | RED → 복원 |
| S6 Plugin chip 끝 경계 `$` 제거 | D17 인용 | green | `composerDecoration` 1 | RED → 복원 |
| S4 `pluginOpen`의 `!token.quoted` 제거 | D18 인용 | green | `useMentionAutocomplete` 1 | RED → 복원 |
| W1 controller skill 키 처리 호출 제거 | 새 oracle(배선 source 단언) | 없음 | `autocompleteKeys` 1 | RED → 복원 |
| W2 mention 호출의 apply를 skill apply로 | 새 oracle | 없음 | `autocompleteKeys` 1 | RED → 복원 |
| W3 mention 호출 조건을 `skillOpen`으로 | 새 oracle | 없음 | `autocompleteKeys` 1 | RED → 복원 |

- 분모 검산: 선택 증거 0(VP-10 등록 변이는 인용 변이 S1·S2와 같은 결함이라 중복 계상 안 함) · 인용 변이 8(D14 2·D15 1·D16 3·D17 1·D18 1) · 새 oracle 3(W1~W3) = 표 행 **11**, 11/11 RED.
- 덮개 회귀: r3 verify가 red로 관측한 41건(r3 잠금 15 · r2 red 19 · 신설 red S3·S7~S12 7)을 재실행해 전부 red — red→green 0. 러너가 변이를 1건씩 적용·복원했고, 스위트는 아래 구현 보고와 같다.

## [구현자 기입] Product/UX 파생 검토 (r4)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — 새 문구 없음 | 없음 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 예 — 키보드 분기만 순수 함수로 옮겼고 `event.preventDefault()`·조기 `return`은 controller에 남았다. 비동기·정리 코드 없음 | 없음 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 해당 없음 — 새 실패 경로 없음. 0건일 때 ↑/↓·Enter는 키만 소비(V1 §5 empty 행, r3과 동일) | 없음 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 예 — 동작 불변 | 없음 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — 비동기 경로 불변 | 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r4)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 키보드 배선 잠금(W1~W3)이 controller source 문자열 단언이다 — 호출 형태를 바꾸는 리팩터링에 깨질 수 있다 | 저장소 선례(`ComposerInputController.test` submit 위임 단언)와 같은 수준으로 두고 보고만 | controller는 hook 20+개를 조립해 node fixture로 구동하기 비싸다 |
| 2 | D19 — caret만 같은 partial의 다른 token으로 옮기면 dismissal이 이어진다 | 변경 없음 — 설계자 판단 대상 | r3 verify probe P1 |

### 설계 대비 명시적 차이 (r4)

- `autocompleteKeys.ts` 순수 함수 신설 — plan §11은 controller keyboard test를 요구했고, controller를 직접 구동하는 대신 분기를 추출해 단언했다. 동작 보존 추출이라 hunk 되돌림 초록은 판정 근거가 아니며, 잠금은 인용 변이 S5a~c와 배선 변이 W1~W3로 쟀다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 상태 없는 순수 함수 | — |
| 공유 | skill·mention이 한 함수를 공유 — 한쪽을 위한 변경이 다른 쪽에 번진다 | AC11·AC25: `useSkillAutocomplete` 소비 경로는 W1, mention은 W2·W3과 7케이스가 잠근다 |
| 재진입 | 해당 없음 — 호출마다 인자로 받은 상태만 읽는다 | — |
| 다른 무효화 축 | skill 분기에 없던 `length>0` 가드가 생겼다 | skill popup은 `suggestions.length>0`일 때만 열려 도달 불가 — 동작 차이 0 |

## [구현자 기입] 구현 보고 (r4)

| 항목 | 내용 |
|---|---|
| 변경 파일 | chat: 신규 `composer/autocompleteKeys.ts`, `ComposerInputController.tsx`(키보드 분기 위임), `lib/mentionAutocomplete.ts`(`filterFileSuggestions` 비export). tests: 신규 `autocompleteKeys.test.ts`·`skills/.../providerAuthWiring.render.test.ts`, 갱신 `composerDecoration.test.ts`·`useMentionAutocomplete.test.ts` |
| 실행 명령 | `npm run typecheck`; `npm run lint`; `./node_modules/.bin/vitest run <r3 verify 스위트>`; `node scripts/check-doc-inventory.mjs --check`; `git diff --check`; 변이 52건 1건씩 적용·복원 |
| 관측한 게이트 산출 | typecheck 3 config `error TS` 0; lint 0 error·1 warning(기존 TanStack Virtual); vitest **110파일/819케이스** pass(r3 108/808 + 2파일·11케이스); doc inventory `9 items, 98 channels`·links ok; diff check 출력 0 |
| V-pair 자기확인 | r3 verify root·BLOCKED 3 pair **3/3 SELF_PASS**, SELF_BLOCKED 0 |
| 강제 지점 전수 | 파생 이슈 불변식 5행 — 자리 10/10 · 5/5 · 2/2 · 2/2 · D20 비export, 남긴 곳 0 |
| AC 자기보고 | ✅ 24 · ⚠️ 0 · ❌ 0 = **24** (AC7은 AC23이 대체). r3 verify ⚠️였던 AC11(D16)·AC15(D14)가 ✅ |
| 합계 검산 | pair 3/3 + 잠금 11/11 + 덮개 41/41 red + AC 24/24 + gate 5종 |
| 블로커 / 역질문 | 없음. 두 테마·clipping·SDK bare `fable`은 사람 실기 |
| 대상 커밋 | `(r4 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r4)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **예** — D14는 r2 D5와 같은 계약(VP-10)의 다른 자리, D16은 ΔV1 분해에서 빠진 V1 header-index 축.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: **예** — VP-10 path가 `ProviderDetail props`를, AC11 검증 수단이 controller keyboard test를 명시했다. review round 28이 자리 단위 분모·SUPERSEDED 이관 규칙을 추가했다.
- 반복해서 부딪히는 환경 한계: Electron/SDK 실기 불가.
- 구현·다음 검증 주체가 같은 에이전트(Claude)다 — 다음 verify는 자기 검증 분모 규칙 대상.
- 현재 라운드와 impl 턴 라벨: **라운드 3 · `r4`**(기존 `r3` 라벨과 겹치지 않게 순번 유지).

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | Esc 후 partial 변경으로 재오픈된 팝업에서 `setActiveIndex`(↓/↑·hover)가 남은 `dismissed:true`를 되살려 팝업을 닫는다. `/` skill도 회귀(base `6200cf1` green) | VP-22 root · VP-24 / D-015·V1 §5·AC11·AC25 | `partial` 변경 시 dismissal을 해제하거나 `setActiveIndex`가 dismissal을 복원하지 않게 한다. production hook으로 Esc→입력→↓ 회귀 test | BLOCKING | closed (r3) |
| D2 | 결과 0건이면 빈 path 그룹 header만 남고 `일치하는 항목 없음`이 사라진다(root plain·slash 모두) | VP-24 root / V1 §5 empty 행·AC25 | 빈 그룹 미렌더 + 전 그룹 0건이면 noMatches. popup render test | BLOCKING | closed (r3) |
| D3 | `@jira-dc/notes.md` 앞부분이 Plugin chip이 되어 유효 path chip을 가린다(`PLUGIN_TOKEN_RE` 끝 경계 없음) | VP-13 / MD-03·AC12 | token 끝 경계 요구 + 충돌 case test | BLOCKING | closed (r3) |
| D4 | Engine `1M`↔`default` 배지 조건 맞바꿈(M3) 미검출 | VP-01 / 등록 변이·AC5 | 행별 배지 귀속을 단언 | BLOCKING | closed (r3) |
| D5 | `ProviderAuthActions` 렌더 트리 oracle 부재 — JSX danger 제거·메뉴 순서·close 순서·callback 맞바꿈(M9·M10·M11·M13) 미검출. model 상수는 JSX가 순서를 읽지 않는다 | VP-14·10·07 root · VP-03·25 / 등록 변이·AC15·16 | 컴포넌트 트리의 MenuItem 순서·danger·onClick→callback·close 선행 단언(verify §4 probe 형태) | BLOCKING | closed (r3) |
| D6 | popup render 순서 oracle 부재 — render에서 groups 역순(N1b) 미검출 | VP-15 / 등록 변이·AC6·AC19 | `MentionAutocomplete` render test로 header·첫/마지막 option 순서 단언 | BLOCKING | closed (r3) |
| D7 | production `useMentionAutocomplete` hook test 0 — stale dismissal(N6)·cwd-null Plugin-only open(M7) 미검출, AC20 oracle은 죽은 `useFileAutocomplete` 위에만 있다 | VP-18 / 등록 변이·AC10·AC20 | production hook fixture test | BLOCKING | closed (r3) |
| D8 | `validPluginIds`를 catalog 판별로 되돌려도 미검출 — EP-12 세 번째 지점 | VP-23 / 등록 변이·EP-12 | valid id 경로에 catalog∧no-tools·no-catalog∧tools matrix | BLOCKING | closed (r3) |
| D9 | harness/usage row catalog 정규화 생략(N9b) 미검출 | VP-19 비등록 축 | icon 없는 input fixture 추가 | NON_BLOCKING | closed (r3) |
| D10 | `docs/arch/frontend/{state,layers,overview}.md`가 `useFileAutocomplete`를 현재 Composer 자동완성으로 서술 | R-04 EP 목록 밖 | 현재 hook 이름으로 정정 | NON_BLOCKING | closed (r3) |
| D11 | `useFileAutocomplete.ts`·`FileAutocomplete.tsx` production 참조 0, `mentionGroupOptions`·`projectPluginMentions` 미사용 | plan §18 | D7 oracle 이전 후 제거 | NON_BLOCKING | closed (r3) |
| D12 | `createConnectionSources` optional deps를 bootstrap이 넘기지 않음, guide gate 예제의 자기 import·스코프 밖 변수 | D-016 비귀속 | deps 제거 또는 guide 정정 | NON_BLOCKING | closed (r3) |
| D13 | plan 메타 `V1@651d9080`·r1 `6030afae`·`e96a2494`·`2c7dad51` 죽은 좌표. r2는 메타 상태를 `READY`로 남겼다(이번 verify가 갱신) | message-bus | 설계자가 `6200cf1`·`6f40c8b`~`f31c068`로 교정 | NON_BLOCKING | open |
| D14 | `ProviderDetail → ProviderAuthActions`의 `onReauth`/`onRevoke`/`authKind` 전달 edge에 oracle이 없다 — props 맞바꿈(S1)·`authKind={null}`(S1b)이 808케이스 green. `ProviderDetail.render.test`는 static markup만 본다 | VP-10 root · VP-03·25 / 등록 변이 “reauth/revoke callback 맞바꿈”·AC15 | `ProviderDetail` 반환 트리에서 `ProviderAuthActions` props가 받은 callback·현재 `authKind`와 동일한지 단언(`ProviderAuthActions.render.test` 방식) | BLOCKING | closed (r4) |
| D15 | `ExtensionsCatalogView`의 `providers.reauth/revoke` 바인딩 맞바꿈(S2) green | 0238 미변경 기존 sink | D14와 함께 sink 바인딩 단언 권장 | NON_BLOCKING | closed (r4) |
| D16 | AC11 controller keyboard glue 미잠금 — header 포함 모듈로·Enter 첫 항목 고정·Esc 무시(S5a/b/c) green. ΔV1 분해 뒤 V1 VP-06·12 header-index 축이 어느 pair에도 없다 | AC11 · 비등록 축 | controller keyboard 분기를 순수 함수로 빼거나 fixture로 dispatch 단언 | NON_BLOCKING | closed (r4) |
| D17 | Plugin chip 끝 경계의 `$` 가지(draft 끝 `@id`) 미잠금(S6) | VP-13 · D3 수정의 새 표면 | 끝 위치 `@jira-dc` case 추가 | NON_BLOCKING | closed (r4) |
| D18 | `pluginOpen`의 `!token.quoted` 가드 제거(S4) green — 동작은 정상(probe P3) | AC9 비등록 축 | quoted·cwd-null case 추가 | NON_BLOCKING | closed (r4) |
| D19 | 같은 partial의 다른 `@` token으로 caret만 옮기면 dismissal이 이어진다(probe P1). occurrence 경계가 token null뿐이며 base도 같다 | D-015 문언 ↔ EP-08 | `tokenStart`를 occurrence identity에 넣을지 설계자 판단 | NEXT_HANDOFF | open |
| D20 | `filterFileSuggestions` export 외부 참조 0 — D11이 형제 `splitDirAndPrefix`만 비export | D11 형제 | 비export | NON_BLOCKING | closed (r4) |
