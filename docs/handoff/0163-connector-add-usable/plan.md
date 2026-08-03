# Plan — 0163-connector-add-usable

## 메타

| 항목 | 값 |
|---|---|
| slug | `0163-connector-add-usable` |
| 작성자 | Claude Code |
| 일자 | 2026-08-03 |
| 매핑 | PR #307 (0160·0161·0162 과 같은 브랜치 `claude/confluence-mcp-plugin-eejiq5`) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | "추가 시 실제 추가로 이어지지 않고있다" | 라이브 세션 요청 (2026-08-03, 0162 구현 직후 실사용 리뷰) |
| 명시 요구 ② | "컨텍스트 경로라는 사용자가 이해할수없는 옵션을 제공하고 있다" | 〃 |
| 명시 요구 ③ | "플러그인 패키지 항목의 pat, id/passwd를 수정할 수 없다" | 〃 |
| 추론 의도 | ①·③ 은 **같은 뿌리에서 갈라진 증상**이다 — 0161 이 패키지를 둘로 쪼갠 결과 인스턴스 행에 provider 가 0개가 되어, 추가는 되지만 **인증 방식이 하나도 없는 커넥터**가 만들어진다. 사용자에게는 ①("추가해도 쓸 수 있는 게 안 생긴다")과 ③("자격증명을 넣을 데가 없다")으로 각각 보인다. **추론이지만 §자료조사 1·2 가 코드와 실행으로 뒷받침한다.** | 추론 + `PluginDetail.tsx:168` · `connectorConnect.ts:38-49` |

## Context (왜)

0162 까지는 "추가 버튼이 보이는가 / 나열되는가" 를 고쳤다. 사용자가 **실제로 서버를 하나 만들어
써보니** 그 다음 단계가 전부 막혀 있었다. 세 보고는 UI 취향 문제가 아니라 **기능이 성립하지
않는다**는 보고다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당 — 단 ①은 증상이고 원인이 셋** | 아래 §자료조사 1·3·4 가 서로 독립인 세 결함을 짚는다. 하나만 고치면 나머지가 남는다. |
| 이미 있는 것 아닌가 | **아니다 — 오히려 실행으로 반증했다** | main 프로세스의 생성 경로는 **정상이다**(§자료조사 5 — 실제 `confluenceTemplate` 으로 `create()` 를 돌려 `ok:true` + connector 등록까지 확인). 즉 "추가가 안 된다" 를 main 버그로 오진했다면 헛수고했을 것이다. 결함은 전부 **renderer 경계**에 있다. |
| 더 작은 해법이 있는가 | **②는 있다 — 채택** | 컨텍스트 경로를 "고급 설정" 으로 접는 안도 있었으나, 접어도 개념은 남는다. 사용자가 아는 것은 **브라우저 주소창의 URL 하나**뿐이므로 입력을 하나로 합치고 앱이 쪼갠다. 필드가 줄어 ③의 오입력 경로도 같이 사라진다. |
| 인용 자료가 요구를 부풀리지 않았나 | **해당 없음** | 사용자 직접 실사용 관찰. |
| 기존 채택 결정을 뒤집는가 | **하나 뒤집는다** | 0161 의 "붙여넣은 URL 은 **제안**만 하고 자동 확정하지 않는다"(`connectorInstance.ts` 주석). 그 결정이 **입력을 먹는 버그의 원인**이므로 뒤집는다 — 상세는 §기존 결정·규칙과의 관계. |

- **사용자에게 올릴 것**(단독 결정 불가): **없음.** 세 보고 모두 "동작하지 않는다" 는 결함
  보고이고, 고치는 방향에 제품 의도 선택지가 없다.

## 자료조사 (Research)

| # | 발견 / 제약 | 레퍼런스 |
|---|---|---|
| 1 | **인스턴스 행에는 provider 가 0개다.** 0161 이 패키지를 둘로 쪼개 provider 는 `pluginId:'confluence'`(공용), connector 는 `pluginId:<connectorId>`(인스턴스)에 산다. `buildPluginRows` 는 **pluginId 로 묶으므로** 인스턴스 행의 `providers` 는 항상 `[]` 다. | `modules/confluence/index.ts:60-98` · `pluginCatalog.ts:17-32` |
| 2 | **그래서 상세에서 연결이 불가능하다.** `PluginDetail` 이 연결 모달에 `providers={plugin.providers}` 를 넘기는데(그 행의 provider = `[]`), `buildConnectOptions` 는 `acceptedAuthProviders ∩ 넘겨받은 provider` 를 쓰므로 교집합이 **항상 공집합** → `no_matching_provider` → "이 커넥터에 쓸 수 있는 인증 방식이 없습니다". **요구 ③ 의 직접 원인이고 요구 ① 의 절반이다.** | `PluginDetail.tsx:168` · `connectorConnect.ts:38-49` |
| 3 | **주소 입력이 타이핑 중 문자를 먹는다.** `onBaseUrlChange` 가 **매 키 입력마다** `splitPastedUrl` 로 origin 을 잘라 되쓴다. `https://wiki.corp/` 까지 치는 순간 값이 `https://wiki.corp` 로 바뀌어 **`/` 가 사라지고**, 이어 치면 `https://wiki.corpconfluence` 가 된다 — 그마저 형태상 유효한 origin 이라 검증도 통과해 **없는 호스트의 커넥터**가 만들어진다. | `ConnectorInstanceModal.tsx:75-86` · `connectorInstance.ts` `splitPastedUrl` |
| 4 | **생성 성공이 조용히 사라질 수 있다.** `submit()` 이 `close()` 를 먼저 부르고 `onCreated` 는 **`find()` 가 맞았을 때만** 부른다. `onCreated` 안에 `plugins.refresh()` 가 있으므로, 매칭이 어긋나면 **목록 갱신도 안 되고 오류도 안 뜬다** — 사용자에게는 "아무 일도 없었다" 로 보인다. 매칭 조건이 `item.origin === draft.baseUrl.trim()` 이라 main 이 값을 조금이라도 정규화하면 어긋난다. | `ConnectorInstanceModal.tsx:95-106` · `ExtensionsCatalogView.tsx:156-162` |
| 5 | **main 생성 경로는 정상이다(실행 확인).** 실제 `confluenceTemplate` + `AuthRegistry` + `ConnectorInstanceLifecycle` 로 `restore()` → `create({templateId:'confluence', baseUrl:'https://wiki.corp'})` 를 돌려 `ok:true`, `connectorId='confluence-wiki-corp'`, 등록된 connector 의 `acceptedAuthProviders=['confluence-pat','confluence-basic']`, `origin='https://wiki.corp'` 를 확인했다. **main 은 고칠 것이 없다.** | 이번 세션 실행(임시 probe 스위트, 이후 제거) |
| 6 | **Confluence 뷰 경로 어휘.** 컨텍스트 경로 뒤에 붙는 잘 알려진 세그먼트는 `display`·`pages`·`spaces`·`wiki`·`rest`·`x` 다(0161 이 이미 수집). 사용자가 붙여넣는 URL 은 대개 `https://wiki.corp/confluence/display/SPACE/Page` 형태라, **첫 뷰 세그먼트 앞까지**가 컨텍스트 경로다. | `connectorInstance.ts` `VIEW_SEGMENTS` |
| 7 | **목록 행 제목이 기계값이다.** `CustomizeList` 가 `plugin.pluginId` 를 그린다 — 인스턴스 행은 `confluence-wiki-corp` 로 보이고 사용자가 붙인 이름("사내 위키")은 어디에도 안 보인다. | `CustomizeList.tsx` plugins 행 |
| 8 | **`apiBasePath` 정규화는 main 이 이미 흡수한다** — `/confluence/`·`confluence`·`''` 를 `/confluence`·`undefined` 로. renderer 가 완벽히 정규화하지 않아도 안전하다. | `instance-store.ts:123-129` |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 인스턴스 커넥터의 상세에서 연결을 누르면 **인증 방식 2종(PAT · ID/비밀번호)이 제시된다** — 다른 패키지에 등록된 provider 도 후보에 포함된다. | `connectorConnect.test.ts::"다른 패키지의 provider 도 수용 목록에 있으면 후보다"` | `ExtensionsCatalogView` → `PluginDetail providers=` (전체) → `buildConnectOptions` |
| 2 | `PluginDetail` 은 **전체 provider 목록**을 prop 으로 받는다(자기 행의 provider 만 쓰지 않는다). | `typecheck` — `providers` 가 필수 prop 이라 미전달이 컴파일되지 않는다 | `ExtensionsCatalogView` → `PluginDetail` |
| 3 | 주소 입력에 `https://wiki.corp/confluence` 를 **한 글자씩 입력해도 값이 그대로 남는다**(중간에 `/` 가 지워지지 않는다). | `connectorInstance.test.ts::"주소 입력은 타이핑 중 값을 고치지 않는다"` (문자열 누적 시뮬레이션) | `ConnectorInstanceModal` 주소 input |
| 4 | 제출 시 `https://wiki.corp/confluence` 가 **origin `https://wiki.corp` + 컨텍스트 경로 `/confluence`** 로 쪼개져 전송된다. | `connectorInstance.test.ts::"주소를 origin 과 컨텍스트 경로로 쪼갠다"` | `toCreateRequest` → `pluginApi.createInstance` |
| 5 | 뷰 경로가 붙은 실사용 URL `https://wiki.corp/confluence/display/SP/Page` 도 컨텍스트 경로 `/confluence` 로 쪼개진다(뒤쪽 뷰 경로는 버린다). | `connectorInstance.test.ts::"뷰 경로 앞까지만 컨텍스트 경로다"` | 동 위 |
| 6 | 컨텍스트 경로가 없는 `https://wiki.corp/display/SP/Page` 는 컨텍스트 경로 **없이** 전송된다(첫 세그먼트가 뷰 경로면 컨텍스트가 아니다). | `connectorInstance.test.ts::"첫 세그먼트가 뷰 경로면 컨텍스트 경로가 없다"` | 동 위 |
| 7 | UI 에 **"컨텍스트 경로" 라는 입력 필드가 없다** — 주소 입력이 하나다. | 사람 실기 — 추가 → Confluence → 폼에 입력칸이 `표시 이름`·`서버 주소` 둘뿐 | `ConnectorInstanceModal` |
| 8 | 사용자가 넣은 주소로부터 **앱이 실제로 쓸 주소를 화면에 되보여준다**(무엇이 적용되는지 확인 가능). | `connectorInstance.test.ts::"적용될 주소를 사람이 읽을 문자열로 만든다"` (`describeApiBase`) | `ConnectorInstanceModal` 도움말 줄 |
| 9 | 생성이 성공하면 **매칭 성공 여부와 무관하게 목록이 갱신된다**. | `connectorCreate.test.ts::"생성 응답을 받으면 항상 갱신을 부른다"` (주입 콜백) | `ExtensionsCatalogView.onCreated` → `plugins.refresh` |
| 10 | 생성 응답에서 **새로 생긴 커넥터를 이전 목록과의 차집합으로** 찾는다(origin 문자열 비교에 기대지 않는다). | `connectorCreate.test.ts::"이전 목록에 없던 커넥터를 새것으로 고른다"` | 동 위 |
| 11 | 새 커넥터를 특정하지 못해도 **오류로 끝나지 않고 목록만 갱신**한다(사용자는 목록에서 직접 연결할 수 있다). | `connectorCreate.test.ts::"새것을 못 찾아도 갱신은 한다"` | 동 위 |
| 12 | 목록 행이 인스턴스면 **사용자가 붙인 이름**을 제목으로 보여준다(기계 ID 가 아니라). | `pluginCatalog.test.ts::"인스턴스 행은 사용자가 붙인 이름을 제목으로 쓴다"` | `CustomizeList` plugins 행 |
| 13 | 커넥터가 여럿이거나 provider 행이면 제목은 **pluginId 를 유지**한다(이름을 지어낼 근거가 없다). | `pluginCatalog.test.ts::"근거가 없으면 pluginId 를 제목으로 유지한다"` | 동 위 |
| 14 | 연결된 커넥터의 자격증명 변경 액션이 **"인증 정보 변경"** 으로 표시된다(요구 ③ 의 어휘). | `typecheck` + 사람 실기 — 연결된 커넥터 행에 그 라벨이 보인다 | `PluginDetail` ← `connectorActions` |
| 15 | 실제 사내 서버에서 추가 → 연결 → 초록 점까지 도달한다. | **사람 실기 — 사내 Confluence DC 필요.** 추가 → 주소 붙여넣기 → PAT 입력 → 초록 점 | 전 경로 |

> AC7·14·15 는 사람 실기다. AC7·14 는 `npm run dev` 로 끝까지 도달하고, AC15 만 사내 서버가
> 추가로 필요하다. 나머지 12건은 순수 모듈로 기계 검증한다.

## 범위 / 비범위

- **범위**: `PluginDetail` 의 provider 전달 · 주소 입력 단일화(타이핑 중 재작성 제거 + 제출 시
  분해) · 생성 후 갱신 보장 + 차집합으로 새 커넥터 특정 · 목록 행 제목 · 자격증명 변경 어휘 · i18n.
- **비범위**: **main 프로세스 변경**(§자료조사 5 로 정상 확인) · IPC 채널 변경 · 인스턴스 행과
  공용 provider 행을 **하나로 합치는 목록 재구성**(아래 유예 표) · 주소 수정 채널(0161 결정 유지).

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 공용 provider 행 + 인스턴스 행을 한 항목으로 묶는 목록 재구성 | **아니오** — 표시 계층(`buildPluginRows`)만의 문제이고 저장·ID·IPC 가 걸리지 않는다. 이번엔 **연결이 되게 하는 것**이 급하고, 묶는 방식(템플릿 기준? 서버 기준?)은 서버가 2개 이상 생긴 뒤 판단하는 편이 낫다. |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 쓴다. **신규 의존성 0개, 신규 IPC 채널 0개(85 유지).**
- 전제: `buildConnectOptions` 가 `acceptedAuthProviders` 로 이미 교집합을 잡으므로, 전체 provider
  를 넘겨도 **다른 커넥터의 provider 가 새는 일이 없다**(§자료조사 2 의 함수가 강제 지점).

## 설계

**① 연결 불가 (요구 ①③).** `PluginDetail` 에 `providers: AuthProviderInfo[]`(전체)를 **필수 prop**
으로 추가하고 연결 모달에 그것을 넘긴다. 상단의 "인증 제공자" 섹션은 지금처럼 **그 행의**
provider 만 나열한다 — 그 섹션은 "이 패키지가 무엇을 기여하는가" 를 보이는 자리이고, 연결
후보는 "이 커넥터가 무엇을 수용하는가" 로 다른 질문이다.

**② 주소 입력 (요구 ②).** 필드를 하나로 합친다.

- `onBaseUrlChange` 의 **타이핑 중 재작성을 없앤다** — 입력은 사용자가 친 그대로 둔다.
- `InstanceDraft` 에서 `apiBasePath` 를 **제거**하고, 제출 시 `splitServerUrl(address)` 가
  origin 과 컨텍스트 경로로 쪼갠다.
- 쪼개는 규칙: 경로 세그먼트를 앞에서부터 모으다가 **첫 뷰 세그먼트에서 멈춘다**(§자료조사 6).
  첫 세그먼트부터 뷰 경로면 컨텍스트 경로는 없다.
- `describeApiBase()` 가 "실제로 쓸 주소" 를 한 줄로 만들어 입력 아래 보여준다. 자동 추측을
  **숨기지 않고 되보여주는 것**이 0161 이 "자동 확정하지 않는다" 로 지키려던 목적을 대신한다.

**③ 생성 후 (요구 ①).** 모달은 `onCreated(connectors)` 로 **목록 전체**를 넘긴다. 호출부가
`pickCreatedConnector(before, after)` 로 차집합을 잡고, **찾든 못 찾든 `refresh()` 를 먼저**
부른다. origin 문자열 동등 비교를 없애 main 의 정규화와 무관해진다.

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `features/skills/lib/connectorCreate.ts` | 생성 응답 처리 — 차집합으로 새 커넥터 특정 + 갱신 보장 순서 | renderer `features/skills` | **순수 단위** — 콜백 주입으로 호출 순서·미발견 분기 단언 |

`connectorInstance.ts` 에 `splitServerUrl`·`describeApiBase` 를 더하고 `splitPastedUrl` 을
없앤다(대체되므로 남기면 안 쓰는 규칙이 green 으로 남는다). `pluginCatalog.ts` 에
`pluginRowTitle(row)` 를 더한다 — 전부 기존 순수 모듈이라 새 레이어가 생기지 않는다.

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **붙여넣은 URL 은 제안만 하고 자동 확정하지 않는다** (0161) | `connectorInstance.ts` `splitPastedUrl` 주석 · `ConnectorInstanceModal.tsx:73-74` 주석 | §설계 ② "제출 시 `splitServerUrl` 이 쪼갠다" | **뒤집는다.** 근거: 그 "제안" 이 **타이핑 중 입력을 먹는** 원인이고(§자료조사 3), 사용자는 컨텍스트 경로 개념 자체를 이해할 수 없다고 보고했다(요구 ②). 자동 확정하되 **결과를 되보여줘** 원래 목적(오인 방지)을 지킨다. |
| **패키지를 둘로 나눈다 — provider 는 공용, connector 는 인스턴스** (0161) | `modules/AGENTS.md` §규칙 · `modules/confluence/index.ts:38-40` | §자료조사 1·2 · §설계 ① | **유지.** 나누는 것 자체는 옳다(중복 provider id 거부 회피). 고치는 것은 그 결과를 **UI 가 잘못 읽은 것**이다. |
| **주소는 생성 후 불변** (0161) | `modules/confluence/AGENTS.md` §주소 규칙 | §범위 비범위 | **유지** |
| **connector 당 활성 연결 1개 / 재연결은 끊고 붙이기** (0158·0162) | `connectorActions.ts` 주석 | AC14 | **유지** — 라벨만 "인증 정보 변경" 으로 바꾼다(동작 동일). |
| **UI 는 시각 검증으로 갈음, 판정은 순수 모듈로** | `app/AGENTS.md` §에이전트 원칙 4 | §설계의 신규 모듈 표 | **유지** |
| **renderer 4-layer boundaries** | `app/eslint.config.mjs` | §설계 마지막 문단 | **유지** — 전부 `features/skills` 내부 + `shared`. |
| IPC 채널 **85** | `docs/IPC_CONTRACT.md` | §의존 기술 | **유지 — 신규 0.** `IPC_CONTRACT.md` 무수정 |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **주소 끝 슬래시**: `https://wiki.corp/` 는 컨텍스트 경로 없음으로 쪼개진다(빈 세그먼트 무시).
- **주소만 있고 경로 없음**: 기존과 동일하게 origin 만 전송한다.
- **해석 불가 입력**: `splitServerUrl` 이 `null` → 기존 `base_url_invalid` 사유를 그대로 보여준다.
- **자격증명 변경 도중 취소**: 0162 와 같다 — 연결이 끊긴 채 남고 목록에서 다시 연결한다.
- **행 제목**: 사용자가 라벨을 비워둘 수 없으므로(필수 필드) 인스턴스 행 제목이 빈 문자열이 될 일은
  없다. 그래도 `pluginRowTitle` 은 빈 라벨이면 pluginId 로 되돌린다(fail-safe).
- **provider 행과 인스턴스 행이 둘 다 보이는 것**은 이번 범위에서 남는다 — 다만 인스턴스 행이
  사용자 이름으로 보이므로(AC12) 어느 쪽을 눌러야 하는지가 전보다 분명해진다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 컨텍스트 경로 자동 추정이 틀리면 모든 요청이 404 가 된다 | 추정 결과를 입력 아래에 **되보여준다**(AC8). 틀렸으면 저장 전에 사용자가 본다. 뷰 세그먼트 목록은 0161 이 이미 수집한 것을 재사용한다. |
| 전체 provider 를 상세에 넘기면 다른 커넥터의 인증 방식이 샐 수 있다 | 새지 않는다 — `buildConnectOptions` 가 `acceptedAuthProviders ∩ targets:'connector'` 로 이미 좁힌다. 그 함수가 강제 지점이고 AC1 이 그것을 고정한다. |
| `splitPastedUrl` 제거로 0161 테스트가 깨진다 | 의도한 것이다. 대체 함수의 테스트로 옮기고, 없어진 규칙의 테스트는 지운다(안 쓰는 규칙을 green 으로 남기지 않는다). |

- 되돌리기 어려운 결정: **없음** — 신규 스키마·식별자·채널이 0이라 전부 renderer 내부에서 되돌릴 수 있다.
- **단독 결정 금지 항목(Open Question)**: 없음.

## 영향 받는 파일

- `app/src/renderer/src/features/skills/lib/connectorCreate.ts` (신규) + `.test.ts`
- `app/src/renderer/src/features/skills/lib/connectorInstance.ts` (+ `.test.ts`)
- `app/src/renderer/src/features/skills/lib/connectorConnect.test.ts` (AC1 케이스 추가)
- `app/src/renderer/src/features/skills/lib/connectorActions.ts` (라벨 키만)
- `app/src/renderer/src/features/skills/lib/pluginCatalog.ts` (+ `.test.ts`)
- `app/src/renderer/src/features/skills/components/customize/{ConnectorInstanceModal,ExtensionsCatalogView,PluginDetail,CustomizeList}.tsx`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`

## 참고 문서

- `docs/handoff/0162-connector-add-menu-status/plan.md` · `0161-connector-instance-templates/plan.md`
- `app/AGENTS.md` §에이전트 원칙 4
- IPC 변경 **없음** → `docs/IPC_CONTRACT.md` 무수정 (85 유지)

## 게이트

- `cd app && npm run lint && npm run typecheck` + `./node_modules/.bin/vitest run`.
- 신규 테스트 요구: `connectorCreate.test.ts` · `connectorInstance.test.ts`(주소 분해) ·
  `connectorConnect.test.ts`(교차 패키지 provider) · `pluginCatalog.test.ts`(행 제목).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 3건을 원문으로 인용했고, "①③은 같은 뿌리" 는 추론으로 표기하고 코드 근거를 붙였다.
- [x] 자료조사 — 8건 전부 `파일:라인` 또는 **실행 결과**(#5)를 붙였다.
- [x] 의존 기술 — 전부 기존 모듈, 신규 의존성 0.
- [x] 파생 UX — 주소 형태 엣지·취소·행 제목 fail-safe 를 이 작업에 해당하는 것만 적었다.
- [x] 리스크 — 3건 + 되돌리기 어려운 결정 없음의 근거.

**기계적으로 확인 가능한 것**:

- [x] 요구 비판적 검토 5문에 답했고 범위를 줄이지 않았다(요구 ①을 "renderer 만의 문제" 로 축소하지 않고 main 까지 **실행으로 확인**한 뒤 제외했다).
- [x] `검증 수단` 칸 **15/15 채움**, 사람 실기 3건은 실행 경로 명시.
- [x] 부정형 기준 0개 — AC3·6·11 은 관측 가능한 결과(값이 남는다 / 경로 없이 전송 / 갱신은 한다)의 양성 단언이다.
- [x] AC 간 모순 점검 — AC4·5·6 은 입력이 서로 달라 배타. AC9·10·11 은 같은 함수의 세 분기(항상 갱신 / 찾으면 특정 / 못 찾아도 진행)로 서로를 보완한다. AC12·13 은 조건이 배타. AC1(전체 provider)과 리스크표의 "새지 않는다" 는 같은 함수를 근거로 한다.
- [x] 인용 수치·사실을 이번 세션에서 직접 측정 — main 생성 경로는 실제 코드로 **실행**해 확인(#5), `providers=[]` 는 `pluginCatalog.ts` 의 pluginId 그룹핑에서 도출.
- [x] 신규 모듈 1개는 순수 단위 테스트, 나머지는 기존 순수 모듈 확장.
- [x] 전수 조사 N — `PluginDetail` 에 연결 모달을 여는 지점 2곳(connect·reconnect), `providers=` 를 넘기는 지점 2곳(`PluginDetail`·`ExtensionsCatalogView`) 중 잘못된 곳 **1곳**.
- [x] 각 AC 에 프로덕션 도달 경로가 있다. 유일한 호출자가 테스트인 AC 0개.
- [x] 사람 실기 AC 3건의 실행 경로가 비범위에 막혀 있지 않다.
- [x] 선택적 필드 판정 — `apiBasePath` 는 `undefined` 가 정상값이고 AC6 이 그 케이스를 갖는다.
- [x] 제약 필드 강제 지점 — `acceptedAuthProviders` 의 강제 지점은 `buildConnectOptions`(연결 후보 산출 시)이고 AC1 이 고정한다.
- [x] 참조 구현 커버리지 — 해당 없음(참조 구현을 입력으로 쓰지 않았다).
- [x] 미룬 항목 1건의 일방향 여부에 답했다(아니오).
- [x] 관문 4 를 본문 완성 후 돌렸다 — 기존 결정 표 7행을 본문 문장과 짝지어 채웠고, 인용 경로를 전부 열어 확인했다. `[구현자 기입]`·`[검증자 기입]` 블록이 아래에 있다.
- [x] "확정" 류 서술의 앵커 확인 — `modules/AGENTS.md` §규칙의 "템플릿을 만들 때 패키지를 둘로 나눈다"(grep 1건), `modules/confluence/AGENTS.md` 의 "주소는 생성 후 바꿀 수 없다"(grep 1건) 실재 확인.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

> 상태: **IMPL_DONE** (Claude 직접 구현 — 환경에 Codex 부재, 사용자 지시. 0160~0162 와 같은 사유)

- **동의 / 그대로 진행**
  - §자료조사 5(main 생성 경로를 **실행해** 확인)가 이 작업에서 가장 값진 한 걸음이었다. "추가가
    안 된다" 는 보고를 main 버그로 읽었으면 registry·store·manifest 를 며칠 팠을 것이다. 실제로는
    `create()` 가 `ok:true` 를 내고 connector 까지 등록된다 — 결함은 전부 renderer 경계에 있었다.
  - §설계 ①(전체 provider 전달)이 세 보고 중 둘(①의 절반·③ 전부)을 한 번에 닫는다. 0161 의
    패키지 2분할 자체는 옳고, UI 가 그 결과를 잘못 읽은 것이라는 진단이 맞았다.
- **이견 / 우려**
  - **§설계 ②가 `validateDraft` 와 `toCreateRequest` 의 이중 판정을 남긴다.** 둘 다 주소를 쪼개
    보는데 실패 처리가 갈리면(`validateDraft` 는 통과인데 `toCreateRequest` 가 `null`) 조용히
    아무 일도 안 하는 경로가 생긴다 — 이번에 고치는 결함과 **같은 종류**다. `toCreateRequest` 가
    `null` 이면 `address_invalid` 를 세워 **반드시 사유가 보이도록** 이중 안전장치를 넣었다.
  - **§설계가 `PluginRow.title` 의 소비처를 다 세지 않았다.** 목록(`CustomizeList`)만 적혀 있었는데
    상세(`PluginDetail`)의 `<h2>` 도 같은 기계값을 그리고 있었다. 상세도 제목을 `title` 로 바꾸고,
    **제목과 pluginId 가 다를 때만** 아래에 pluginId 를 작게 덧붙였다(진단 시 실제 ID 가 필요하다).
  - **AC14 의 "인증 정보 변경" 라벨은 0162 의 "재연결" 을 대체한다.** 동작은 그대로고 이름만
    바뀐다. 사용자가 0162 에서 "재연결 기능" 을 요구했다가 0163 에서 "수정할 수 없다" 고 한 것은
    **같은 기능을 다른 이름으로 찾은 것**이므로 사용자가 쓴 어휘("pat, id/passwd 수정")에 맞췄다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `PluginDetail` 의 `<h2>` 도 기계 ID 를 그린다 — 설계는 목록만 적었다 | ✅ 구현함 — 제목을 `title` 로, 다를 때만 pluginId 를 부제로 | `PluginDetail.tsx` |
| 2 | `toCreateRequest` 가 `null` 을 낼 수 있는데 설계에 처리가 없다(조용한 무동작 재발) | ✅ 구현함 — `null` 이면 `address_invalid` 를 세운다 | 이번 작업이 고치는 결함과 동종 |
| 3 | 커넥터 행에 버튼이 4개가 되면 이름이 밀려 사라진다 | ✅ 구현함 — 액션을 **별도 줄**로 내리고 `flex-wrap` | 0162 가 이름 줄에 4개를 넣었다 |
| 4 | `skills.connect.serverHint` 가 "주소는 설치 시 정해집니다, 관리자에게 문의" 라고 말한다 — 사용자가 **자기가 만든** 서버에서 그 문구를 본다 | ✅ 구현함 — "만든 뒤 바꿀 수 없습니다. 삭제 후 다시 추가하세요" 로 교체(ko·en) | 0160 은 정적 경로 전제였다 |
| 5 | `failUnreachable` 도 같은 이유로 어긋난다("주소는 설치 설정값") | ✅ 구현함 — "주소가 맞는지 확인해 주세요" 로 교체(ko·en) | 〃 |
| 6 | `pickCreatedConnector` 가 origin 대신 ID 를 쓰므로 **대소문자·끝 슬래시 정규화와 무관**하다는 것이 테스트에 없었다 | ✅ 구현함 — 표기가 다른 origin 으로 케이스 추가 | `connectorCreate.test.ts` |
| 7 | `rowTitle` 이 `label` 을 무조건 `trim()` 해 DTO 가 라벨을 빠뜨리면 화면이 죽는다 | ✅ 구현함 — `?? ''` 방어(표시 경로는 죽으면 안 된다) | 기존 테스트 fixture 가 실제로 label 없이 캐스팅하고 있었다 |
| 8 | 고아 i18n 키 6개(`baseUrl`·`baseUrlHint`·`apiBasePath`·`apiBasePathHint`·`errBaseUrl`·`errBasePath`) | ✅ 구현함 — ko·en 양쪽에서 제거 | 주소 단일화로 사용처 0 |

## [구현자 기입] 구현 체크리스트

- [x] `PluginDetail` `providers` 필수 prop + 연결 모달에 전체 전달 (요구 ①③)
- [x] 주소 단일 필드 — `splitServerUrl`·`describeApiBase`, 타이핑 중 재작성 제거 (요구 ②)
- [x] `connectorCreate.ts` — 차집합 특정 + 갱신 무조건 (요구 ①)
- [x] `PluginRow.title` + 목록·상세 반영
- [x] 커넥터 행 액션을 별도 줄로
- [x] i18n — 주소 3키 추가·고아 6키 제거·`reconnect` 를 "인증 정보 변경" 으로·어긋난 안내 2건 교체
- [x] 게이트 통과

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 2 (`lib/connectorCreate.ts`+테스트) + 수정 9 |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint **0 error**(warning 1 = 0102 베이스라인) · typecheck **3/3** · vitest **1757/1757 pass**(0162 의 1740 + 신규 17) · scripts **28/28** |
| 알려진 환경 실패 | `app/chat-turn.continuity.test.ts` 1파일 collection 실패 — electron 바이너리 egress 차단(코드 무관, `app/AGENTS.md` 베이스라인) |
| main 프로세스 | **무변경** — §자료조사 5 의 실행으로 정상 확인 |
| IPC | **85 유지 · 신규 채널 0개.** `IPC_CONTRACT.md` 무수정 |
| 신규 의존성 | **0개** |
| 사람 실기 대기 | AC7·14(앱 실행만 필요) · AC15(사내 Confluence DC 필요) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (아래 커밋 hash) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | | | |
