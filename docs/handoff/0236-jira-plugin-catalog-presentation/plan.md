# Plan — 0236-jira-plugin-catalog-presentation

## 메타

| 항목 | 값 |
|---|---|
| slug | `0236-jira-plugin-catalog-presentation` |
| 작성자 | Codex — 사용자의 신규 handoff-plan 요청에 따라 설계 수행 |
| 일자 | 2026-09-15 |
| 매핑 | 0188 Plugin/Auth 수명주기 위에 Jira stdio 패키지와 카탈로그 표시 계약을 추가하는 독립 기능 |
| 상태 | plan/READY |
| V mode | Baseline V |
| 기준 V | none |
| 이번 V revision | V1 |
| 유효 V | V1 |
| 조사 기준 | `afed48d161b5fb81aea913bf05ed6f062a0553c1` — 시작 시 변경 파일 0 |
| 다음 주체 | Codex — handoff-impl r1 |
| 이번 턴 경계 | READY plan과 INDEX 등록만 수행; 제품 코드·테스트·현재 아키텍처 문서는 미수정 |

# Part I — Product & UX Contract

## 1. Context / 목표

현재 Orca의 Confluence Plugin은 `BoundAuth`와 `RuntimeToolRegistry`를 묶어 인증이 유효할 때만 도구를 노출하고, 같은 연결 행에서 로그인·재인증·해제를 제공한다. 반면 `@atlassian-dc-mcp/jira`는 import 가능한 인프로세스 factory가 아니라 환경변수를 읽고 stdio에 연결하는 실행형 MCP 패키지라서, Confluence의 제품 수명주기를 재사용하되 실행 adapter는 별도로 필요하다.

완료 후 폐쇄망 배포자는 Jira Data Center Auth 한 건과 Jira Plugin 한 건을 빌드타임에 조립할 수 있다. 사용자는 플러그인 탭에서 현지화된 제목·설명·구성 아이콘을 보고 연결하며, 연결된 다음 턴부터 패키지 도구를 쓰고 변경 도구는 기존 Orca 승인 카드를 거친다.

성공을 사용자 관점에서 한 문장으로: 플러그인 페이지를 열면 `플러그인 → 스킬 → MCP` 순으로 탐색하고, Jira를 자기 언어의 이름·설명·아이콘으로 식별해 안전하게 연결하고 사용할 수 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “`@atlassian-dc-mcp/jira` 패키지로, 기 구현했던 confluence 사례와 같이 구현” | 2026-09-15 사용자 메시지 |
| 명시 요구 | “플러그인 구성 시 icon 설정 가능하도록” | 2026-09-15 사용자 메시지 |
| 기본값 원문 | 미설정 아이콘은 Material Symbols Outlined `electrical_services`, FILL 0·wght 400·GRAD 0·opsz 24 | 2026-09-15 사용자 링크 |
| 명시 요구 | “ko, en 등 i18n 으로 타이틀, 본문 내용(현재지원안함) 지원” | 2026-09-15 사용자 메시지 |
| 명시 요구 | “플러그인, 스킬, mcp 순서로” 탭 변경 | 2026-09-15 사용자 메시지 |
| 작업 경계 | “Handoff-plan 수행하라” | 2026-09-15 사용자 메시지 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | `@atlassian-dc-mcp/jira`를 정확히 `0.34.0`으로 고정하고 패키지의 공개 stdio 진입점을 실행한다 | 현재 패키지는 `main=build/index.js`, factory export 없음; 런타임 `npx -y` 설치는 폐쇄망·재현성을 깬다 | 사용자 요구 + 공식 package/index 조사 | ACTIVE | 0160의 Confluence 패키지 비채택 판단은 Jira에 승계하지 않음 |
| D-002 | Jira는 Confluence와 같은 `BoundAuth → PluginBinding → RuntimeToolRegistry → catalog row` 수명주기를 사용한다 | “confluence 사례와 같이”의 현재 코드상 공통점은 인증·노출/회수·카탈로그 수명주기다 | 사용자 요구 + 0188 D-023/024 | ACTIVE | — |
| D-003 | `RuntimeToolServer`를 인프로세스 `sdk`와 신뢰된 `stdio`의 판별 union으로 확장한다 | 패키지 내부를 deep-import하거나 14개 구현을 재작성하지 않고도 승인·revision·도구명 SSOT를 유지 | 공식 index + 현재 adapter | ACTIVE | 인프로세스 Jira 재구현·일반 MCP 탭 등록안 대체 |
| D-004 | Jira child는 `process.execPath` + package entrypoint를 쓰고 필수 env와 attachment 양방향 disable을 명시한다 | 사용자 Node/런타임 다운로드에 기대지 않고 부모 env의 filesystem gateway 활성화도 덮어씀 | package config/gateway + Electron 패키징 | ACTIVE | `npx -y`, `JIRA_HOST`, “관련 env 생략”안 대체 |
| D-005 | Jira descriptor의 기본 도구 14개를 정적으로 선언하고 실제 `tools/list`와 계약 테스트로 대조한다 | 카탈로그와 승인 정책은 child 연결 전에도 도구 이름·위험도를 알아야 한다 | 0188 D-024 + 공식 index | ACTIVE | upload 도구는 명시적으로 비활성/비등록 |
| D-006 | 읽기 7개만 `readOnlyHint:true`, 변경 7개는 false/미지정으로 승인 대상에 둔다 | 외부 MCP 이름은 현재 Orca custom gate를 자동으로 거치지 않으므로 registry descriptor가 정책 SSOT여야 한다 | 현재 `runtime-tool-policy.ts` + 공식 도구 동작 | ACTIVE | 일반 `.mcp.json` 직결안 대체 |
| D-007 | secret 접근은 배포가 선언한 `PLUGIN_SECRET_AUTH_IDS`의 닫힌 closure만 받으며 raw 값은 IPC·로그·디스크에 쓰지 않는다 | 임의 Auth selector를 Plugin factory에 넘기지 않는 기존 secret 최소권한 패턴 유지 | security.md + harness-runtime 선례 | ACTIVE | 전체 `secretReader` 전달 금지 |
| D-008 | stdio MCP config의 env가 Claude CLI의 `--mcp-config`를 거쳐 child로 전달되는 raw-secret 예외를 보안 문서에 추가한다 | 현재 SDK 구현상 동적 stdio config는 CLI argv에 직렬화되며 이를 숨기면 보안 계약이 거짓이 됨 | 설치 SDK 실물 조사 | ACTIVE | 비밀이 child env에만 있다는 초기 가정 대체 |
| D-009 | credential 변경은 registry revision을 올려 **다음 턴**에 새 child를 spawn한다; 이미 시작한 턴은 기존 snapshot으로 끝날 수 있다 | 현재 SessionRuntime은 runtimeTools revision을 다음 요청의 respawn 경계에서 비교한다 | 기존 respawn-policy + Auth revision | ACTIVE | 활성 턴 강제 중단안 배제 |
| D-010 | 플러그인 표시 설정은 로컬 아이콘 키와 locale map `{title, body}`를 갖고 main에서 정규화해 wire에 싣는다 | 원격 이미지/CSP/온라인 의존 없이 정적 배포 구성으로 확장 | 사용자 icon/i18n 요구 | ACTIVE | renderer 전역 번역 파일에 플러그인별 문구 하드코딩안 대체 |
| D-011 | icon 미설정·알 수 없는 값은 로컬 `electricalServices` glyph로 접는다 | 사용자 지정 기본 아이콘을 모든 테마·폐쇄망에서 동일하게 보장 | 사용자 기본값 | ACTIVE | 현재 `power` 하드코딩 대체 |
| D-012 | locale 선택은 exact → base language → `ko` → `en` → 첫 유효 항목 → auth label/body 없음 순이다 | 현재 ko/en을 만족하면서 `en-US`와 미래 언어를 renderer 수정 없이 수용 | 사용자 “ko, en 등” + 현재 locale 계약 | ACTIVE | ko/en 고정 switch 대체 |
| D-013 | renderer 탭 id를 `providers`에서 `plugins`로 바꾸고 순서를 `plugins, skills, mcp`, 최초 탭도 `plugins`로 둔다 | 사용자가 순서와 플러그인 탭 명칭을 명시 | 사용자 요구 | ACTIVE | 현재 `skills, mcp, providers` 대체 |
| D-014 | 새 플러그인 탭은 기존 connection row 전부를 유지하고 plugin category만 새 표시 메타를 쓴다 | gate/harness/usage row를 숨기면 현재 로그인·재인증 도달 경로가 사라짐 | 0188 D-029/044 + 현재 UI | ACTIVE | plugin category만 필터링하는 안 배제 |
| D-015 | 기본 OSS/prod 배포는 계속 Auth 0·Plugin 0이며 Jira endpoint를 추측해 넣지 않는다 | 실제 사내 URL이 없고 기본 빌드의 network 0 계약이 존재 | auth-definitions 주석 + 루트 규칙 | ACTIVE | 가짜/공용 Jira 기본 등록 금지 |
| D-016 | 구현은 패키징된 앱에서 stdio initialize/`tools/list`가 성공해야 완료다 | dev에서만 되는 asar/entrypoint 경로는 제품 기능이 아님 | Electron 실행 경계 | ACTIVE | 단위 테스트만으로 완료 판정 금지 |
| D-017 | 이번 턴은 READY plan과 INDEX 등록까지만 수행한다 | 사용자 요청 단계가 handoff-plan | 사용자 메시지 | ACTIVE | — |

### 갱신 메모

- 신규 결정 D-001~D-017, OPEN 0건. 실제 Jira origin은 배포 입력이므로 제품 결정을 미룬 것이 아니라 기본 배포의 의도된 빈 구성이다.
- 0188 D-023/024/029/044는 유지한다. D-030의 “별도 UI migration 전 wire 유지” 중 채널·핵심 DTO 이름은 유지하고, 이번 별도 UI migration이 plugin 표시 필드와 tab id를 추가한다.
- 0188 D-032의 “신규 의존성 없음”은 0188 작업 범위 결정이었다. 이번 사용자가 특정 패키지를 명시했으므로 D-001이 이번 범위에서 대체한다.
- D-017은 제품 AC가 아닌 작업 경계다. 이번 변경 파일은 이 plan과 `docs/handoff/INDEX.md`뿐이다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 현재 Confluence가 같은 npm 패키지를 쓰는가 | 아니오 | 현재 Confluence는 `BoundAuth.request` 기반 자체 인프로세스 구현이며 `@atlassian-dc-mcp/confluence`를 쓰지 않는다. “같이”를 패키지 방식까지 동일하다고 쓰면 사실과 다르다. |
| Jira 패키지를 단순 import할 수 있는가 | 아니오 | 공개 main은 env 초기화 뒤 즉시 `await connectServer(server)`를 실행하고 재사용 factory를 export하지 않는다. |
| 일반 MCP 설정에 한 줄 추가하면 충분한가 | 불충분 | 플러그인 탭 row·Auth 수명주기·cached names가 없고, 변경 도구가 runtime approval descriptor에 들어오지 않는다. |
| 14개 Jira 도구를 Orca에서 다시 구현해야 하는가 | 아니오 | 신뢰된 stdio transport를 기존 runtime registry에 추가하면 패키지가 구현을 소유하고 Orca는 정책·수명주기만 소유한다. |
| remote icon URL을 그대로 저장해야 하는가 | 아니오 | 사용자가 준 링크는 glyph 사양 출처다. 앱은 기존처럼 로컬 inline path를 사용해야 폐쇄망·CSP·테마가 안정적이다. |
| 플러그인 탭에서 plugin row만 보여야 하는가 | 아니오 | 현재 Connections 탭은 gate/harness/usage 인증의 유일한 관리 표면이다. 사용자가 재배치를 요구하지 않았으므로 행 집합은 보존한다. |
| `ko`, `en`만 enum으로 고정해야 하는가 | 아니오 | “등”을 만족하려면 locale-keyed data여야 한다. 현재 선택 UI는 ko/en을 유지하되 계약은 미래 locale을 허용한다. |
| 추가 사용자 결정이 필요한가 | 없음 | 패키지·기본 아이콘·copy 축·탭 순서는 명시됐고, endpoint는 기존 배포 입력으로 남기는 것이 정본 계약이다. |

## 5. 동작 / 사용자 흐름

```text
앱 부팅
  → 빌드타임 Auth/Jira Plugin 조립
  → auth invalid: 카탈로그 row + cached 14 tool names, runtime server 없음
  → 사용자가 플러그인 탭에서 Jira 선택
  → 현 locale의 title/body + 구성 icon + 기존 PAT 폼 표시
  → probe 성공·credentialChanged
  → 닫힌 secret closure로 trusted stdio server materialize
  → RuntimeToolRegistry revision 증가
  → 다음 turn spawn이 Jira MCP child를 포함
  → read tool 자동 허용 / write tool 기존 승인 카드
  → revoke·expiry·401: registry에서 제거, 다음 turn부터 도구 없음
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 기본 OSS 배포 | Auth·Plugin factory가 빈 배열 반환 | 플러그인 행 0, 외부 연결·child 0 |
| Jira 선언·미인증 | descriptor/copy/icon만 카탈로그에 유지 | Jira 행·14개 도구 이름과 연결 버튼 표시, 실제 도구 비활성 안내 |
| PAT 제출·probe 성공 | secret을 읽어 stdio server 등록, revision 증가 | 연결됨 상태; 다음 턴부터 Jira 도구 사용 가능 |
| read tool 호출 | descriptor의 `readOnlyHint:true` 소비 | 추가 승인 없이 실행 |
| write tool 호출 | 완전 이름이 runtime approval set에 포함 | 기존 도구 승인 카드에서 허용/거부 선택 |
| PAT 교체 | 새 `credentialRevision`/env server로 교체, revision 증가 | 이미 시작한 턴은 snapshot 완료 가능; 다음 턴은 새 child |
| revoke/expiry/unauthorized | registry에서 server 제거 | 카탈로그는 남고 비활성; 다음 턴부터 Jira 도구 제거 |
| child 시작/handshake 실패 | SDK의 MCP 연결 오류 경로로 표면화, Auth grant는 임의 삭제하지 않음 | 연결 상태와 도구 실행 실패를 구분; 재인증 또는 배포 설정 점검 가능 |
| locale `en-US` | `en-US` → `en` 순으로 copy 탐색 | 영어 title/body 표시 |
| locale copy 일부/전부 없음 | 정해진 fallback chain 적용 | 제목은 끝내 auth label, 본문은 생략; 빈 문자열 카드 없음 |
| icon 미설정/미지 값 | `electricalServices`로 정규화 | 목록과 상세에 같은 기본 plug glyph |
| 플러그인 페이지 첫 진입 | `plugins`를 초기 선택 | 첫 탭과 첫 콘텐츠가 플러그인 |

### 파생 UX / 엣지케이스

- loading: 기존 skills/MCP/provider 병합 loading을 유지한다. stdio child는 카탈로그 조회 때 시작하지 않고 턴 spawn 때만 시작한다.
- error: 잘못된 entrypoint·누락 env·handshake 실패는 MCP 실행 오류이며 Auth 상태를 `expired`로 추측 변경하지 않는다. 실제 401/403을 Orca가 직접 관찰하지 못하므로 패키지 실패만으로 grant를 강등하지 않는다.
- retry: 사용자는 다음 턴에서 다시 호출하거나 재인증한다. 같은 credential과 descriptor의 반복 `sync()`는 revision을 올리지 않는다.
- cancel/close: Jira child는 Claude CLI/SessionRuntime 수명에 속해 기존 interrupt·channel close와 함께 종료한다.
- concurrency: 각 SessionRuntime이 자기 snapshot에서 child를 가진다. registry나 plugin binding이 전역 child 하나를 공유하지 않는다.
- credential rotation: 현재 턴 snapshot 경계가 원자 단위다. 재인증이 진행 중인 턴을 강제 중단하지 않으며 다음 턴 전에 revision 비교가 respawn한다.
- i18n: plugin copy는 배포 data이고 chrome/status/form 라벨은 기존 `shared/i18n` resource다. 둘을 한 map으로 합치지 않는다.
- accessibility: icon은 장식 요소로 유지하고 title 텍스트가 식별명을 제공한다. body는 목록에서 한 줄 말줄임, 상세에서 자연 줄바꿈한다.
- closed network: package는 Chromium `net.fetch`가 아닌 Node 네트워크를 쓴다. 프록시/PAC/private CA가 필요한 배포는 설치본 실기로 확인해야 하며 Confluence와 네트워크 동등성을 주장하지 않는다.

## 6. 범위 / 비범위

- **범위**: Jira 0.34.0 정확 고정, trusted stdio runtime server, Jira descriptor/config factory, Auth 기반 등록·회수, 승인 분류, 닫힌 secret 주입, 패키징 실행, plugin catalog icon/i18n wire와 renderer, 탭 rename/order/default, 관련 테스트·현재 문서.
- **비범위**: 실제 사내 Jira URL/PAT 커밋, Jira Cloud/OAuth/basic 인증, 동적 플러그인 설치 UI, plugin-only 행 필터, Jira upload/save gateway, Jira 도구 자체 재구현, Confluence 네트워크 구현 교체, 일반 MCP 탭 config 변경.
- **이번 턴 비범위**: `app/**`와 제품 문서 구현, 의존성 설치, 테스트 실행, 구현 커밋·push.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| Jira uploadAttachment/save-to-disk | 예 — filesystem 권한·승인·경로 계약 필요 | 이번에 env를 넣지 않아 fail-closed; 별도 handoff |
| plugin 전용 행과 gate/harness/usage 재배치 | 예 — 인증 UX 정보구조 변경 | 이번 요구에 없으므로 기존 행 보존; 별도 UX 결정 |
| 사용자가 런타임에 plugin URL을 추가하는 UI | 예 — 동적 Auth 등록·영속 모델 필요 | 기존 빌드타임 deployment 정책 유지 |
| Node proxy/PAC/CA 일반화 | 예 — 모든 stdio MCP에 영향 | Jira 설치본 실기 결과가 필요; 실패 시 별도 infra handoff |
| raw secret argv 제거용 broker | 예 — child proxy/IPC 보안 모델 필요 | 현재 예외를 정직하게 문서화; 별도 security hardening |
| Jira 전용 브랜드 로고 | 아니오 — icon config로 후속 선택 가능 | 기본 `electricalServices` 사용 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 앱이 `@atlassian-dc-mcp/jira@0.34.0`의 설치된 main을 직접 실행하며 `npx`·런타임 download가 없다 | package/lock exact version, resolver가 package main absolute path 반환, command=`process.execPath` 단언 | deployment Jira factory→entrypoint resolver→runtime snapshot→Claude MCP config |
| R-01 | AT-02 / AC2 | Jira config는 full API base/token/Node mode를 전달하고 upload·download filesystem gateway를 명시적으로 false로 덮어쓴다 | path 경계표, env exact-set과 두 disable 값, null secret이면 server 미생성 단언 | BoundAuth+secret closure→Jira server materializer→stdio child |
| R-02 | AT-03 / AC3 | invalid에서는 row만, valid에서는 server, revoke/expiry에서는 제거되며 reauth는 revision을 바꾼다 | status/revision 전이표, 같은 revision 반복 sync 멱등, secret 값 IPC/log 0 단언 | boot initial sync + Auth `credentialChanged` subscriber→registry |
| R-03 | AT-04 / AC4 | 기본 Jira 도구 14개가 descriptor와 실제 `tools/list`에서 이름까지 일치하고 upload는 없다 | fake URL/token child initialize/listTools integration test로 정렬 집합 exact equality | installed Jira entry→MCP handshake→Claude tool surface |
| R-03 | AT-05 / AC5 | 읽기 7개는 자동 허용 후보, 변경 7개는 기존 승인 대상이다 | descriptor annotation 표와 `runtimeApprovalToolNames` 완전 이름 집합 7개 exact 단언 | runtime snapshot→policy→`makeCanUseTool`→approval broker |
| R-03 | AT-06 / AC6 | 기존 Confluence 인프로세스 server는 같은 handler identity·result validation·승인 규칙으로 동작한다 | 기존 adapter/binding/registry 테스트 무변경 + sdk/stdio 양 branch 단언 | Confluence binding→sdk branch→createSdkMcpServer |
| R-04 | AT-07 / AC7 | plugin 구성의 유효 local icon key가 목록·상세에 동일하게 렌더된다 | nondefault icon fixture의 list/detail SSR 또는 component oracle | PluginBinding presentation→ConnectionViewSource→ProviderInfo→renderer |
| R-04 | AT-08 / AC8 | icon 미설정·미지 값은 두 화면 모두 `electricalServices`다 | undefined/invalid normalization과 SVG glyph key 단언 | presentation normalizer→Icon local path |
| R-05 | AT-09 / AC9 | locale map의 title/body가 exact/base/fallback 순으로 선택된다 | `ko`, `en`, `en-US`, 미지원 locale, 빈 항목 표에서 title/body exact 단언 | ProviderInfo.plugin.copy→locale resolver→list/detail |
| R-05 | AT-10 / AC10 | copy 미설정인 기존 plugin/non-plugin row는 auth label과 기존 kind/auth 상세로 안전하게 fallback한다 | legacy fixture에서 title/detail/status/action 유지, body node 부재 단언 | connection mapper→renderer fallback |
| R-06 | AT-11 / AC11 | 탭 순서·라벨·초기 선택이 `plugins, skills, mcp` / 플러그인·Plugins / plugins다 | `CATALOG_TABS`, ko/en resource, initial selection component oracle | Extensions page mount→CustomizeTabs→tabpanel |
| R-06 | AT-12 / AC12 | plugins 탭에서 기존 connection row 순서·수·인증 액션이 유지되고 Add 버튼은 없다 | gate/harness/plugin/usage virtual deployment + renderer row/order/action 회귀 | provider state→useProviders→plugins list/detail |
| R-07 | AT-13 / AC13 | raw token은 vault→닫힌 Jira closure→main snapshot/SDK config/child에만 존재하고 IPC·renderer·logger·파일에는 없다 | deps shape typecheck, logger payload spy, ProviderInfo snapshot, source/disk-write scan 단언 | SecretReader allowlist→Jira materializer; wire에는 presentation만 |
| R-07 | AT-14 / AC14 | 기본 배포는 Auth/Plugin/secret allowlist 0이고 폐쇄망 recipe만 실제 Jira를 활성화한다 | production factory 0행·0server·0secret IDs, virtual deployment nonempty 양성 단언 | bootstrap→default deployment / operator build-time deployment |
| R-08 | AT-15 / AC15 | packaged app의 resolved entry가 존재하고 stdio initialize/listTools가 종료·정리까지 성공한다 | `build:unpack` 산출물에서 entry existence + child handshake smoke; 필요 시 asar fallback 적용 | installed app→Electron run-as-node→Jira package |
| R-08 | AT-16 / AC16 | 실제 Jira DC에서 PAT probe·검색·변경 승인·재인증·해제가 종단 동작한다 | **사람 실기**: 사내 deployment 값으로 로그인, search, create/update 승인, rotate, revoke | Plugins UI→Auth→package→Jira DC→approval/result |

### AC 검증 주의사항

- AC4의 handshake는 네트워크를 호출하지 않는다. `https://jira.invalid/rest`와 dummy token으로 initialize·`tools/list`까지만 수행하고 프로세스를 반드시 종료한다.
- AC5 도구 분류는 이름 추론이 아니라 아래 표를 정본으로 테스트한다. descriptor에서 `readOnlyHint:true`가 아닌 값은 fail-closed로 승인 대상이다.
- AC13은 “메모리에 secret이 없다”가 아니다. main snapshot과 SDK `--mcp-config` argv를 명시적 예외로 인정하되 renderer·disk·log 확산을 막는다.
- AC15는 dev 성공으로 대체할 수 없다. asar path가 실패하면 구현자는 package entry/dependency closure를 `asarUnpack`하고 unpacked path로 remap한 뒤 같은 smoke를 다시 통과시킨다.
- AC16은 외부 사내 자원이 필요하므로 구현자/검증자는 기계 범위를 PASS로 판정하되 사람 실기를 `⚠️`로 분리한다.

### Jira 도구 정책 정본 — package 0.34.0

| read-only — 자동 허용 7 | mutating — 승인 7 |
|---|---|
| `jira_searchIssues` | `jira_createIssue` |
| `jira_getIssue` | `jira_updateIssue` |
| `jira_getIssueComments` | `jira_postIssueComment` |
| `jira_getTransitions` | `jira_updateIssueComment` |
| `jira_getIssueDevelopmentInfo` | `jira_transitionIssue` |
| `jira_getIssueLinkTypes` | `jira_linkIssues` |
| `jira_downloadAttachment` — 저장 env 비활성, inline only | `jira_unlinkIssues` |

`jira_uploadAttachment`는 package가 upload gateway를 명시적으로 켰을 때만 등록한다. 이번 configuration은 관련 env를 전달하지 않으므로 descriptor·실제 handshake 모두에서 부재해야 한다.

## 7-A. V / Trace Matrix

- V mode 판정: Jira 패키지·stdio runtime variant·catalog presentation·tab migration을 처음 정의하므로 Baseline V.
- 기준 V 상속 근거: 없음. 0188의 Plugin/Auth 계약은 regression provenance로 쓰지만 그 V 판정을 통째로 승계하지 않는다.
- 변경이 시작되는 수준: Baseline V라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01…R-08 | R | §7 각 요구 | NEW | 사용자 요구 + 현 코드 조사 |
| AT-01…AT-16 | AT | §7 각 직접 증거 | NEW | 구현 후 테스트/게이트/사람 실기 |
| SD-01 / ST-01 | SD / ST | §5 Jira Auth→tool registration→turn→revoke 전체 수명 | NEW | 0188 수명주기 확장 |
| SD-02 / ST-02 | SD / ST | §5 plugin catalog 탐색·locale·detail·auth action | NEW | 현재 Connections UI migration |
| SD-03 / ST-03 | SD / ST | 기존 Confluence와 gate/harness/usage/skills/MCP 회귀 | INHERITED | 0188 + 현행 renderer 테스트 |
| AR-01 / IT-01 | AR / IT | trusted stdio server가 registry와 Claude adapter를 관통 | NEW | — |
| AR-02 / IT-02 | AR / IT | plugin presentation이 deployment→wire→renderer를 관통 | NEW | — |
| AR-03 / IT-03 | AR / IT | 닫힌 secret allowlist와 Auth change/revision composition | NEW | harness direct-credential 선례 |
| MD-01 / UT-01 | MD / UT | Jira path/env/descriptor materializer | NEW | 공식 package contract |
| MD-02 / UT-02 | MD / UT | icon normalize + locale copy resolver | NEW | 사용자 표시 요구 |
| MD-03 / UT-03 | MD / UT | sdk/stdio registry copy/equality와 approval set | NEW | 현행 registry/policy 확장 |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01/02 | REQUIRED | Jira deployment→resolver/materializer→stdio config | exact dependency/path/env 표 | M1·M9 | EP-01/03/05/06/07/09/22 (7) |
| VP-02 | R-02 ↔ AT-03 | REQUIRED | Auth boot/change→PluginBinding.sync→registry revision | status×revision 전이표 | M3·M4 | EP-08/09/10/11/12 (5) |
| VP-03 | R-03 ↔ AT-04/05 | REQUIRED | descriptor+child tools→policy→approval | 14 exact + mutating 7 exact | M2·M9 | EP-05/07/13/14/22 (5) |
| VP-04 | R-03 ↔ AT-06 | REGRESSION | Confluence binding→sdk adapter→handler | 기존 server/adapter suites | M1 | EP-01/02/03/04/08 (5) |
| VP-05 | R-04 ↔ AT-07/08 | REQUIRED | plugin config→wire→list/detail Icon | configured/default/invalid fixtures | M5 | EP-08/15/16/18/19 (5) |
| VP-06 | R-05 ↔ AT-09/10 | REQUIRED | localized copy→locale resolver→list/detail | locale fallback matrix + legacy row | M6 | EP-08/15/17/18/19 (5) |
| VP-07 | R-06 ↔ AT-11 | REQUIRED | page mount→tabs→selection | order/labels/default exact | M7 | EP-20/21 (2) |
| VP-08 | R-06 ↔ AT-12 | REGRESSION | provider state→plugins rows→auth actions | 4-category fixture + Add absence | M8 | EP-15/18/19/21 (4) |
| VP-09 | R-07 ↔ AT-13/14 | REQUIRED | vault→closed closure→runtime + default empty | secret boundary spies + prod empty fixture | M3 | EP-09/10/12/15/23 (5) |
| VP-10 | R-08 ↔ AT-15/16 | REQUIRED | installed app→child→Jira DC | packaged handshake + 사람 실기 | M1·M9 | EP-06/07/22/24 (4) |
| VP-11 | SD-01 ↔ ST-01 | REQUIRED | invalid→login→valid→turn→rotate→revoke | lifecycle integration state table | M4 | EP-08…14 (7) |
| VP-12 | SD-02 ↔ ST-02 | REQUIRED | route→plugins tab→localized row→detail→auth | renderer component flow | M5·M6·M7 | EP-15…21 (7) |
| VP-13 | SD-03 ↔ ST-03 | REGRESSION | legacy rows/tabs→existing interactions | existing suites + virtual deployment | M8 | EP-02/03/08/15/18/19/21 (7) |
| VP-14 | AR-01 ↔ IT-01 | REQUIRED | RuntimeToolServer union→registry→Claude Options | sdk/stdio branch integration | M1 | EP-01/02/03/04/13 (5) |
| VP-15 | AR-02 ↔ IT-02 | REQUIRED | PluginBinding metadata→source→ProviderInfo→renderer | nondefault config end-to-end fixture | M5·M6 | EP-08/15/16/17/18/19 (6) |
| VP-16 | AR-03 ↔ IT-03 | REQUIRED | AuthId allowlist→closure→sync/revision | undeclared id inaccessible + rotate | M3·M4 | EP-09/10/11/12 (4) |
| VP-17 | MD-01 ↔ UT-01 | REQUIRED | input config+secret→Jira stdio server | normalization/env/tool table | M9 | EP-05/06/07 (3) |
| VP-18 | MD-02 ↔ UT-02 | REQUIRED | icon/copy input→normalized presentation | icon+locale fallback truth tables | M5·M6 | EP-16/17 (2) |
| VP-19 | MD-03 ↔ UT-03 | REQUIRED | sdk/stdio value→copy/equality/policy | branch copy, equality, revision, approvals | M1·M2 | EP-01/02/04/13/14 (5) |

M1=stdio server를 sdk branch로 잘못 adapt, M2=변경 도구 하나에 `readOnlyHint:true` 부여, M3=Plugin에 전체 secret selector 전달, M4=invalid/revoke 뒤 server 유지, M5=icon 미지정 fallback 제거, M6=locale base/fallback 순서 제거, M7=탭 순서를 현행으로 복귀, M8=plugins 탭에서 non-plugin connection row 필터, M9=package version/tool surface를 바꾸고 descriptor를 미갱신.

선택 이유: transport·승인·secret·lifecycle·표시 기본값·정보구조·외부 drift라는 서로 다른 실패축을 하나씩 심는다. 같은 변이가 여러 pair를 지지해도 구현 잠금 표에서는 변이별 한 행으로 센다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| plan/INDEX 정합성 | 이번 턴 산출물은 두 문서 | `git diff --check`; slug·상태·다음 주체·링크 재읽기 | 불일치면 READY 불가 |
| 문서 인벤토리 | 새 handoff 링크와 이후 current docs 변경 | `cd app; node scripts/check-doc-inventory.mjs --check` | 이번 변경 유발 오류 blocking |
| dependency integrity | 특정 package/version 요구 | package-lock resolved/integrity + `npm ls @atlassian-dc-mcp/jira` | exact 0.34.0이 아니면 blocking |
| 구현 subtree | main/shared/renderer/scripts 변경 | `npm run lint`; `npm run typecheck`; 표적 Vitest/Node tests | 신규 오류 또는 pair 실패 blocking |
| 전체 회귀 | runtime/IPC/UI 공통 경계 변경 | `npm test`를 구현 종료 직전 실행 | 신규 실패 blocking; 환경 baseline 분리 |
| package contract | side-effect stdio package의 실제 표면 | child initialize + `tools/list` exact 14 | spawn/handshake/drift 모두 blocking |
| packaged smoke | Electron/asar에서만 생기는 실패 | `npm run build:unpack` 후 packaged resolver/handshake | dev-only 성공은 blocking |
| visual/human | title/body/icon·실 Jira 네트워크 | ko/en·두 테마 시각 + AC16 사람 실기 | 기계 범위와 분리 보고 |
| message bus | 설계/구현 커밋 분리 | 각 커밋 뒤 `git log -1 --format='%(trailers:only=true)'` | trailer/status 사본 불일치 blocking |

# Part II — Technical Design

## 8. Research — 현재 코드와 외부 계약

### 현재 코드 발견

| 발견 / 제약 | 근거 |
|---|---|
| 기본 `createPluginBindings`는 빈 배열이고 Plugin은 `BoundAuth` 상태로 같은 server를 add/remove한다 | `app/src/main/app/deployment/plugins.ts:23-78` |
| plugin toolNames는 invalid에서도 cached descriptor에서 유지된다 | `plugins.ts:40-62`; 0188 D-024 |
| Plugin initial sync는 Auth resume보다 먼저, 후속 sync는 `credentialChanged:true`에서만 수행된다 | `app/src/main/app/bootstrap.ts:392-409,700-717` |
| Auth snapshot에는 단조 `credentialRevision`이 있다 | `app/src/main/contracts/auth.ts:344-362` |
| RuntimeToolServer는 현재 descriptor+implementations 한 형태뿐이다 | `app/src/main/adapters/runtime-tools.ts:55-72` |
| registry equality는 descriptor와 implementation identity를 비교하고 변경 시 revision을 올린다 | `features/extensions/runtime-tool-registry.ts:45-105` |
| Claude adapter는 runtime server를 전부 `createSdkMcpServer`로 변환한다 | `adapters/claude-runtime-tools.ts:69-108` |
| non-readonly runtime 완전 이름만 custom 승인 집합에 들어간다 | `adapters/runtime-tool-policy.ts:18-36`; `claude.ts:458,562` |
| runtimeTools revision 변화는 다음 요청의 SessionRuntime respawn 조건이다 | `features/sessions/respawn-policy.ts:21-39` |
| plugin row는 `ProviderInfo`로 호환 매핑되고 gate/harness/usage도 같은 배열에 있다 | `app/connection-views.ts:18-91`; `deployment/connections.ts:31-52` |
| provider 목록·상세 아이콘은 둘 다 `power`, 제목은 `provider.label`, body 슬롯은 없다 | `CustomizeList.tsx:108-135`; `ProviderDetail.tsx:37-71` |
| 현재 탭은 `skills,mcp,providers`, 초기값은 skills다 | `catalogSelection.ts:7-17`; `ExtensionsCatalogView.tsx:28` |
| i18n locale은 현재 ko/en이지만 hook에서 locale을 제공한다 | `renderer/shared/i18n/index.ts`; `resources/{ko,en}.ts` |
| 보안 문서는 raw-secret 반출 예외를 3곳으로 닫아 두고 신규 경로의 표 추가를 요구한다 | `docs/arch/backend/security.md:58-70` |
| default Auth declarations는 network 0을 위해 비어 있고 가짜 URL을 금지한다 | `deployment/auth-definitions.ts:1-18,44` |

### 외부 package/SDK 발견

| 발견 / 제약 | 근거 |
|---|---|
| Jira package 최신 조사 버전은 0.34.0이고 main은 `build/index.js`, type=module, bin은 `bin/run.js`다 | [공식 package.json](https://raw.githubusercontent.com/b1ff/atlassian-dc-mcp/master/packages/jira/package.json) |
| main은 env 검증·service/tool 등록 뒤 곧바로 `await connectServer(server)`한다 | [공식 index.ts](https://raw.githubusercontent.com/b1ff/atlassian-dc-mcp/master/packages/jira/src/index.ts) |
| env는 `JIRA_HOST`, `JIRA_API_BASE_PATH`, `JIRA_API_TOKEN`, `JIRA_DEFAULT_PAGE_SIZE`; 기본 API path는 `/rest`다 | [공식 config.ts](https://raw.githubusercontent.com/b1ff/atlassian-dc-mcp/master/packages/jira/src/config.ts) |
| filesystem attachment는 `JIRA_ATTACHMENTS_{UPLOAD,DOWNLOAD}_ENABLED`가 true이고 유효 root가 있을 때만 켜진다 | [공식 attachment-gateway.ts](https://raw.githubusercontent.com/b1ff/atlassian-dc-mcp/master/packages/common/src/attachment-gateway.ts) |
| README는 npx stdio와 full URL `JIRA_API_BASE_PATH`를 공식 사용법으로 제시한다 | [공식 Jira README](https://raw.githubusercontent.com/b1ff/atlassian-dc-mcp/master/packages/jira/README.md) |
| package는 community-maintained Jira Data Center용이며 Atlassian 공식 제품이 아니다 | 공식 package.json description |
| 설치 Claude SDK의 `McpStdioServerConfig`는 command/args/env를 지원한다 | `app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:1209-1226` |
| 설치 Claude SDK는 process MCP config를 JSON으로 `--mcp-config` argv에 넣는다 | `app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs`의 `mcpServers→W.push('--mcp-config', …)` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| handoff 번호 | `docs/handoff/INDEX.md` + directory 정렬 | max=0235 | 신규 slug는 0236 |
| runtime server adapter | `rg createSdkMcpServer app/src/main/adapters` | production 1 | 이 한 분기에 stdio variant 추가 |
| Plugin sync production 지점 | bootstrap과 `plugins.ts` 검색 | initial 1 + change 1 | 두 수명 경계 모두 Jira 적용 |
| Plugin row mapper | `pluginRows`→`connectionInfo` | 1 + 1 | presentation 전달 강제 지점 두 층 |
| provider icon 하드코딩 | CustomizeList/ProviderDetail의 `power` | 2 | 목록·상세 모두 교체 |
| catalog tab 선언 | `CATALOG_TABS` | 3 entries | 순서 전부 exact oracle |
| Jira 기본 tools | 공식 `server.tool` 전수 + 조건부 upload 분리 | 14 + optional 1 | 이번 descriptor는 14, upload 0 |
| Jira 기본 tools 위험 분류 | 각 handler 동작 전수 검토 | read 7 + mutate 7 | 승인 집합 exact 7 |
| 문서화된 raw secret 예외 | security.md 표 | current 3 | 구현 뒤 trusted stdio 행 추가, 개수는 generated inventory에 적지 않음 |
| 기본 production plugin | `createPluginBindings` 반환 | 0 | Jira는 opt-in deployment recipe/fixture |

### 수치 / 전칭 표현 검산

- “14개”, “7+7”, “두 아이콘 지점”, “탭 3개”는 이번 세션에서 위 경로를 직접 전수했다. package 버전을 바꾸면 AC4와 도구 정책 표를 다시 조사한다.
- 문서화된 예외의 총개수처럼 코드/문서에서 셀 수 있는 변동 수치는 current architecture 본문에 숫자로 복제하지 않는다. 이 plan의 baseline 측정과 검증 evidence에만 둔다.
- Provider 관련 전체 `providers` 문자열은 다른 feature/store 의미가 섞이므로 일괄 rename하지 않는다. `features/skills`의 CatalogTab 판별값과 rail label 소비처만 대상으로 전수한다.

## 9. AS-IS / TO-BE / Delta

### AS-IS

```text
PluginBinding
  └─ fixed RuntimeToolServer(descriptor + implementations)
       └─ RuntimeToolRegistry
            └─ Claude createSdkMcpServer(in-process only)

ConnectionViewSource(plugin)
  └─ ProviderInfo(label/tools/status)
       └─ providers tab, power icon, no body
```

### TO-BE

```text
PluginBinding(auth + normalized catalog presentation)
  ├─ sdk RuntimeToolServer          ← existing Confluence unchanged
  └─ stdio RuntimeToolServer        ← Jira package entry + env snapshot
       └─ RuntimeToolRegistry(revision/equality by variant)
            ├─ sdk → createSdkMcpServer
            └─ stdio → McpStdioServerConfig

ConnectionViewSource(plugin + presentation)
  └─ ProviderInfo.plugin(icon + locale copy)
       └─ plugins tab
            ├─ list: localized title + body + icon + status
            └─ detail: same title/body/icon + existing auth/actions/tools
```

### Delta

| 축 | 현재 | 변경 후 | 불변 |
|---|---|---|---|
| Jira implementation | 없음 | exact package stdio child | package가 REST/tool 구현 소유 |
| runtime tools | in-process only | sdk/stdio union | descriptor id/tool policy/revision snapshot |
| auth lifecycle | Confluence fixed server add/remove | Jira secret-backed materialization 포함 | initial + credentialChanged sync |
| approvals | in-process descriptor만 | Jira static descriptor도 같은 policy | readOnly만 자동 허용 |
| catalog wire | label/status/tools | plugin-only icon/copy optional field | provider 채널·Auth DTO/action 유지 |
| icon | power hardcoded | configured key or electricalServices | inline SVG/currentColor |
| copy | auth label, no body | locale title/body + legacy fallback | chrome/status i18next |
| tabs | skills→mcp→providers, skills initial | plugins→skills→mcp, plugins initial | skills/MCP 내용·CRUD |
| deployment | default empty | default empty + Jira recipe/fixture | build-time configuration |

### 핵심 책임

- Jira feature는 package entrypoint, env, descriptor, tool classification만 소유한다. Auth UI·vault·approval UI·MCP protocol 구현은 소유하지 않는다.
- Plugin deployment는 자기 Auth와 secret closure, 표시 설정을 조립한다. Bootstrap은 Jira URL·도구명·locale copy를 모른다.
- Runtime registry/adapter는 transport union을 보존·변환한다. Jira 이름을 분기 조건으로 쓰지 않는다.
- Connection view mapper는 plugin category에서만 presentation을 wire에 싣는다. renderer는 category를 재추론하지 않는다.
- Renderer presentation helper는 locale와 fallback을 순수 계산하고 목록·상세가 같은 결과를 쓴다.

## 10. Contracts / 강제 지점

### 10.1 Runtime server 계약

```ts
type RuntimeToolServer = RuntimeSdkToolServer | RuntimeStdioToolServer

interface RuntimeSdkToolServer {
  transport?: 'sdk'
  descriptor: RuntimeToolDescriptor
  implementations: readonly RuntimeToolImplementation[]
}

interface RuntimeStdioToolServer {
  transport: 'stdio'
  descriptor: RuntimeToolDescriptor
  command: string
  args?: readonly string[]
  env?: Readonly<Record<string, string>>
  credentialRevision: number
}
```

- `transport` 미지정은 기존 sdk server 호환이다. stdio에는 implementations가 없고 sdk에는 command/env가 없다.
- registry copy/equality는 공통 descriptor 뒤 variant 필드를 비교한다. env key/value 또는 `credentialRevision`이 바뀌면 revision이 증가한다.
- adapter는 sdk만 `createSdkMcpServer`로 만들고 stdio는 `{type:'stdio',command,args,env}`로 전달한다. `credentialRevision`은 spawn config에 싣지 않는다.
- descriptor는 catalog·approval용 정적 정책 SSOT다. 실제 child의 도구 surface와 AC4에서 대조한다.

### 10.2 Jira deployment 계약

```ts
interface JiraPluginConfig {
  apiContextPath?: string
  catalog?: PluginCatalogPresentationInput
}

createJiraRuntimeServer({
  authId,
  origin,
  apiContextPath,
  token,
  credentialRevision,
  packageEntrypoint,
  electronExecutable
}): RuntimeStdioToolServer
```

- `origin`은 기존 AuthDefinition 정규형처럼 path 없는 `http(s)` origin이다. `apiContextPath`는 빈 값 또는 `/jira`처럼 정규화한다.
- `JIRA_API_BASE_PATH = origin + apiContextPath + '/rest'`다. `/rest`, `/rest/api/2`, query/hash가 들어온 context는 거부해 중복 경로를 막는다.
- package entrypoint는 `createRequire(import.meta.url).resolve('@atlassian-dc-mcp/jira')`로 구하고 테스트에서는 resolver를 주입한다.
- token이 null/blank면 stdio server를 만들지 않는다. 값을 trim하거나 변형하지 않고 package env에만 싣는다.
- env는 `ELECTRON_RUN_AS_NODE=1`, `JIRA_API_BASE_PATH`, `JIRA_API_TOKEN`, `JIRA_DEFAULT_PAGE_SIZE=25`, `JIRA_ATTACHMENTS_UPLOAD_ENABLED=false`, `JIRA_ATTACHMENTS_DOWNLOAD_ENABLED=false`를 명시한다.
- `ATLASSIAN_DC_MCP_CONFIG_FILE`은 빈 값으로 덮어 부모가 지정한 외부 dotenv 경로를 상속하지 않는다. direct Jira 값과 gateway disable이 package의 home/`.env` fallback보다 높은 우선순위를 가져야 함을 integration test로 확인한다.
- `JIRA_HOST`와 attachment root/limit env는 싣지 않는다. disable flag를 생략하면 부모 환경의 `true`가 상속될 수 있으므로 “미설정=off”에 기대지 않는다.

### 10.3 Plugin catalog presentation 계약

```ts
type PluginCatalogCopy = { title: string; body: string }
type PluginCatalogCopies = Readonly<Record<string, PluginCatalogCopy>>

interface PluginCatalogPresentationInput {
  icon?: IconName
  copy?: PluginCatalogCopies
}

interface PluginCatalogPresentation {
  icon: IconName
  copy: Readonly<Record<string, PluginCatalogCopy>>
}

interface ProviderInfo {
  // existing fields...
  plugin?: PluginCatalogPresentation
}
```

- `IconName` 정본을 shared type으로 옮기고 renderer `Icon`이 이를 import/re-export한다. 문자열 URL·SVG markup·임의 path는 허용하지 않는다.
- `electricalServices`를 union과 local path map에 추가한다. path는 사용자 링크가 지정한 Material Symbols Outlined glyph를 960 viewBox 규칙에 맞춰 vendoring한다.
- normalizer는 own enumerable locale key와 nonblank title/body만 복사하고 객체를 새로 소유한다. 전체가 무효면 빈 copy로 접는다.
- plugin source만 `ProviderInfo.plugin`을 갖는다. gate/harness/usage는 field 자체를 생략해 fallback을 명확히 한다.
- wire field는 표시 data뿐이며 secret·실행 config·package path를 포함하지 않는다.

### 10.4 Locale 계약

```text
resolve(locale, copies, authLabel)
  1. exact locale (`en-US`)
  2. base language (`en`)
  3. `ko`
  4. `en`
  5. insertion order의 첫 유효 copy
  6. title=authLabel, body=null
```

- locale 비교는 대소문자를 정규화하고 `_`를 `-`로 다룬다. 빈 title/body entry는 후보에서 제외한다.
- 목록과 상세는 같은 `pluginPresentation(provider, locale)` helper를 호출한다. title/body를 각 컴포넌트가 따로 계산하지 않는다.
- plugin copy가 없으면 목록 detail은 현행 `kind · auth method`, 상세 body는 생략한다. copy가 있으면 목록 detail과 상세 본문에 localized body를 표시한다.

### 10.5 Tab/row 계약

- `CatalogTab = 'plugins' | 'skills' | 'mcp'`이며 `CATALOG_TABS`의 선언 순서가 UI 순서다.
- rail key는 `skills.rail.plugins`이고 ko=`플러그인`, en=`Plugins`다. `providers` key는 CatalogTab 소비 차집합 0 확인 뒤 삭제한다.
- `ExtensionsCatalogView` 초기 selection은 `{tab:'plugins',selectedId:null}`다.
- plugins 탭의 data source는 기존 `providers.list` 전체다. 이름은 내부 wire compatibility이고 일괄 rename하지 않는다.
- Add 버튼은 plugins에서 없다. skills menu와 MCP modal 동작은 그대로다.

### 10.6 강제 지점 전수

| EP | 누가 / 언제 | 강제 내용 | 직접 잠금 |
|---|---|---|---|
| EP-01 | `adapters/runtime-tools.ts` typecheck | sdk/stdio 판별 union과 상호 배타 필드 | UT-03 + typecheck |
| EP-02 | `runtime-tool-registry.ts` add/snapshot | variant별 deep copy/equality, env/revision 변화만 revision 증가 | UT-03 |
| EP-03 | `claude-runtime-tools.ts` spawn adapt | sdk=createSdkMcpServer, stdio=process config | IT-01 |
| EP-04 | `claude-runtime-tools.ts` sdk handler path | 기존 result/context/cancel validation 유지 | regression suite |
| EP-05 | `jira/server.ts` config normalize | origin/context/rest·nonblank token·gateway false/env isolation | UT-01 |
| EP-06 | `jira/entrypoint.ts` boot/build | installed exact package main과 Electron executable resolve | UT-01 + packaged smoke |
| EP-07 | `jira/tools.ts` declaration | 14 names/descriptions/annotations, upload 부재 | UT-01 + live list |
| EP-08 | `deployment/plugins.ts` binding construction | cached descriptor + normalized presentation + stable Auth | binding tests |
| EP-09 | `PluginDeploymentDeps`/allowlist composition | 선언 AuthId의 closure만 Jira factory에 전달 | typecheck + virtual deployment |
| EP-10 | bootstrap initial plugin sync | resume/first snapshot 전 valid server materialize | lifecycle IT |
| EP-11 | Auth change handler | `credentialChanged:true`와 matching AuthId에서만 sync | handler/lifecycle tests |
| EP-12 | secret-backed binding sync | invalid/null remove, valid add, same revision 멱등, rotate 교체 | binding UT |
| EP-13 | `runtime-tool-policy.ts` snapshot walk | stdio descriptor도 full-name/approval set에 포함 | policy UT |
| EP-14 | `makeCanUseTool` production input | mutating Jira full names가 approval broker로 감 | adapter IT |
| EP-15 | `pluginRows`→`ConnectionViewSource` | plugin presentation만 row source에 전달 | connection IT |
| EP-16 | `connectionInfo` wire mapper | plugin field copy, non-plugin omission, secret 필드 0 | mapper UT |
| EP-17 | presentation normalizer | icon fallback + locale entries validation/copy | UT-02 |
| EP-18 | renderer locale helper | exact/base/ko/en/first/label 순서 단일 계산 | UT-02 |
| EP-19 | CustomizeList/ProviderDetail | 동일 icon/title/body 사용, legacy detail fallback | renderer tests |
| EP-20 | `catalogSelection.ts` | tab union/order/icon/label exact | catalogSelection test |
| EP-21 | `ExtensionsCatalogView.tsx` | plugins initial/selection/detail/Add absence | component test |
| EP-22 | package contract test | resolved entry initialize/listTools=descriptor 14 | stdio integration |
| EP-23 | security/current docs | raw-secret argv 예외·Node network·wire/UX 정직한 서술 | doc review/inventory |
| EP-24 | unpacked packaged artifact | entry existence·child handshake·cleanup | packaged smoke |

강제 지점 차집합 기준: 구현자가 `rg`로 production 소비처를 다시 세고 EP의 실제 좌표/N을 갱신한다. 이 plan의 24개는 조사 기준 tree에서의 설계 목록이며 파일 이동이 생기면 역할 기준으로 승계한다.

## 11. 구현 설계 / 파일별 작업

### Task A — trusted stdio runtime foundation

1. `runtime-tools.ts`에 판별 union을 추가하고 기존 이름을 sdk member로 보존한다.
2. registry copy/equality를 공통 descriptor + variant별 값으로 분리한다. readonly args/env를 mutable SDK shape로 복사한다.
3. Claude adapter가 stdio config를 그대로 `Options.mcpServers`에 넣도록 분기한다. runtime context는 sdk branch에만 전달한다.
4. policy가 transport와 무관하게 descriptor를 읽는 현 구조를 유지하고 stdio fixture를 추가한다.
5. RED 우선: wrong-branch, env rotation, same-revision idempotence, sdk regression, mutating approval 변이를 먼저 등록한다.

### Task B — Jira package plugin

1. `app/package.json`과 lock에 exact 0.34.0 dependency를 설치한다.
2. `features/plugins/jira/{entrypoint,tools,server}.ts`와 테스트를 만든다. package를 정적 import하지 않는다.
3. 14-tool descriptor를 §7 표로 선언하고 low-level stdio integration test가 실제 `tools/list`와 대조한다.
4. `createSecretBackedPluginBinding` 또는 동등한 좁은 generic helper를 `deployment/plugins.ts`에 추가한다. 기존 fixed binding은 동일 public behavior를 유지한다.
5. `PLUGIN_SECRET_AUTH_IDS`와 `PluginDeploymentDeps.secrets`를 추가하고 bootstrap이 그 ID들에만 closure를 만든다.
6. virtual deployment에 Jira Auth와 localized presentation을 추가해 login→register→catalog→revoke를 종단 검증한다. production 배열은 빈 값 유지다.

### Task C — catalog presentation + tabs

1. shared `IconName`/plugin presentation wire type을 추가하고 `ProviderInfo.plugin?`을 확장한다.
2. plugin configuration normalizer와 connection source/mapper를 배선한다.
3. renderer pure helper로 locale/title/body/icon을 한 번 계산한다.
4. 목록과 상세가 helper 결과를 사용하고 `electricalServices` local glyph를 추가한다.
5. tab union/order/label/initial selection과 비교 분기를 `plugins`로 바꾼다. provider data/hook 명칭은 wire 내부명이라 유지한다.
6. ko/en·두 테마·legacy non-plugin row·Add 버튼 회귀를 component/SSR fixture로 잠근다.

### Task D — packaging/docs/gates

1. dev child handshake를 통과시킨 뒤 unpacked app에서 같은 resolver와 handshake를 실행한다.
2. asar path가 실패하면 `electron-builder.yml`에 Jira package와 필요한 runtime dependency closure를 unpack하고 resolver가 `app.asar.unpacked`를 선택하게 한다.
3. auth/security/frontend/IPC/closed-network current docs를 TO-BE와 맞춘다.
4. 표적→lint/typecheck→전체 test→build:unpack/package smoke 순서로 증거를 남긴다.

### 테스트 seam

| I/O 경계 | seam | 테스트 |
|---|---|---|
| package path | `(specifier)=>absolutePath` resolver 주입 | installed main/existence + missing package error |
| Electron executable | string input | `process.execPath`/fake path config exact |
| token | `() => string|null` closed closure | null/blank/rotate/revoke; raw 값 logger/wire 부재 |
| Auth state | existing BoundAuth fake | credentialRevision/status 전이 |
| stdio child | child spawn helper + timeout/cleanup | initialize/listTools; network request 0 |
| registry | RuntimeToolSink fake/real registry | add/remove/revision/equality |
| locale | pure `pluginPresentation` | exact/base/fallback table |
| renderer | ProviderInfo fixtures | configured/legacy rows, list/detail/tab |
| packaged path | appPath/resourcesPath/isPackaged inputs | asar or unpack remap without launching full UI |

## 12. E2E / boot 소비자 전수

| 단계 | 입력 | 소비자 | 실패 시 관측 |
|---|---|---|---|
| Auth registration | Jira AuthDefinition in deployment | AuthRuntime | unknown provider/row absent; virtual deployment catches |
| Plugin construction | bound auth + secret closure + config | PluginBinding | boot critical sync construction error; no silent placeholder |
| initial sync | restored snapshot | RuntimeToolRegistry | first provider state/tools snapshot mismatch |
| connection mapping | PluginBinding presentation | ProviderInfo | icon/copy missing; mapper test catches |
| renderer initial route | ProviderPlatformState | ExtensionsCatalogView | wrong tab/order/content; component test catches |
| Auth commit/revoke | AuthChange | plugin sync + connection push | stale row/tool revision; lifecycle IT catches |
| turn build | runtime snapshot | ExtensionBuilder/ClaudeAdapter | wrong mcp server shape; adapter IT catches |
| permission | descriptor annotations | runtime policy/canUseTool | mutating auto-allow; exact approval test catches |
| child startup | command/args/env | Claude CLI/Jira package | MCP status/tool error; handshake smoke catches |
| packaged startup | asar/unpacked path | Electron run-as-node | ENOENT/module resolution; AC15 catches |
| real request | package Node network | Jira DC | proxy/CA/auth/API path error; AC16 human smoke |

부팅 순서는 바꾸지 않는다: Auth stack → Plugin construction/initial sync → connection source → handler/subscription → resume. 새 secret closure 조립은 Plugin construction 이전에만 추가하며 DB·window·gate 순서를 이동하지 않는다.

## 13. 수명주기 / 오류 계약

- PluginBinding은 `authId`, descriptor, normalized presentation을 부팅 1회 고정한다. secret 값은 construction 때 캡처하지 않고 `sync()`의 valid revision에서 읽는다.
- stdio server 값에는 token과 `credentialRevision`의 한 snapshot이 함께 들어간다. registry snapshot 뒤 token만 바뀌는 혼합 세대를 만들지 않는다.
- 같은 valid credentialRevision과 같은 env는 add no-op이다. commit/revoke/expiry/unauthorized만 기존 Auth `credentialChanged`를 통해 재동기화한다.
- registry remove/add는 다음 `ExtensionBuilder.build()`에 반영되고 SessionRuntime respawn policy가 다음 user/continuation request에서 새 child를 만든다.
- 이미 시작한 turn의 child는 그 turn snapshot을 끝낼 수 있다. 이 경계를 renderer에 과장해 “즉시 모든 호출 중단”으로 쓰지 않는다.
- spawn/handshake timeout과 stderr는 SDK 기존 진단 경로를 쓴다. logger에 command args/env 전체를 기록하지 않는다.
- child stdout은 MCP 전용이어야 한다. package가 non-JSON을 stdout에 쓰는 drift는 handshake test 실패로 잡는다.

## 14. 성능 / 자원 계약

- 카탈로그 조회는 child를 시작하지 않는다. string copy와 locale lookup만 추가한다.
- Jira child는 활성 SessionRuntime마다 최대 하나다. 독립 process가 필요한 package 구조의 비용이며 전역 daemon을 새로 만들지 않는다.
- tool descriptor와 presentation은 부팅 1회 정규화한다. renderer render마다 map 전체를 재정규화하지 않는다.
- repeated `sync()`가 같은 credentialRevision이면 registry revision과 runtime respawn을 올리지 않는다.
- package handshake는 기존 MCP startup timeout 안에 있어야 한다. `alwaysLoad`는 설정하지 않아 Jira 실패가 unrelated turn 시작을 blocking하지 않게 한다.
- body는 짧은 카탈로그 설명용 plain text다. Markdown/HTML 렌더링을 도입하지 않는다.

## 15. 외부 포트 / 문서 계약

| 포트 | 채택 | 비채택/주의 |
|---|---|---|
| Jira package entry | installed exact main path | `npx -y`, source deep import, copied implementation |
| Jira endpoint | full `JIRA_API_BASE_PATH` | `JIRA_HOST` protocol stripping, `/api/2` 중복 |
| Jira auth | existing PAT AuthDefinition/vault | token source file, process-wide selector, IPC token |
| MCP transport | trusted runtime stdio union | user MCP catalog row로 우회 |
| icon | local typed Material path | remote URL, arbitrary SVG/HTML |
| copy | trusted build-time locale map | runtime translation download, plugin body HTML |
| tab data | existing ProviderPlatformState | 새 IPC channel/별도 registry |

### 현재 문서 갱신

- `docs/arch/backend/auth.md`: Plugin이 in-process와 trusted stdio transport를 가질 수 있고 Auth snapshot/revision으로 노출을 동기화함을 현재 상태로 쓴다.
- `docs/arch/backend/security.md`: stdio env가 SDK `--mcp-config` argv와 child env를 거치는 raw-secret 예외, 닫힌 closure·무로그·무디스크·다음-turn 회수 완화를 추가한다.
- `docs/arch/frontend/overview.md`: 세 탭의 새 순서/이름/초기 탭과 plugin icon/localized body, non-plugin connection row 보존을 쓴다.
- `docs/IPC_CONTRACT.md`: `ProviderInfo.plugin?` 표시 필드와 plugin category 매핑을 추가하고 `orca:provider:*` 채널·기존 fields의 compatibility를 유지한다.
- `docs/guides/closed-network-extensions.md`: Jira AuthDefinition, context path, `PLUGIN_SECRET_AUTH_IDS`, Jira binding/presentation 예제와 package Node network 실기 절차를 추가한다.
- `app/src/main/AGENTS.md`: Runtime Tool adapter 지도에 trusted stdio variant가 누락된다면 한 줄 갱신한다. 별도 invariant가 없으므로 Jira subtree AGENTS는 만들지 않는다.

## 16. 확정 결정 / 미정 항목

| 항목 | 확정값 | 근거 |
|---|---|---|
| package/version | `@atlassian-dc-mcp/jira@0.34.0` exact | 조사 시 공식 package + 재현성 |
| package execution | Electron run-as-node, installed main | packaged Windows + 폐쇄망 |
| server id | `authToolServerId(authId)` | 0188 existing policy |
| API base | `origin + normalized context + /rest` | package config/README |
| auth | PAT, closed secret closure | existing Auth + package token |
| tools | base 14, upload/save disabled | official 0.34.0 index |
| approval | read 7 auto, mutate 7 approval | behavior + fail-closed policy |
| default icon | `electricalServices` local glyph | 사용자 명시 |
| copy | locale-keyed plain `{title,body}` | 사용자 “ko, en 등” |
| locale fallback | exact→base→ko→en→first→label | 안정적 미래 확장 |
| tabs | plugins→skills→mcp, plugins initial | 사용자 명시 |
| row membership | existing connection rows preserved | 로그인 관리 도달성 |
| deployment | default empty, build-time opt-in | 현행 network 0 + URL 미제공 |
| credential change | next-turn respawn boundary | current runtime architecture |

단독 결정 금지 Open Question은 0건이다. 실제 사내 Jira URL/PAT·프록시/CA 값은 코드에 들어갈 제품 결정이 아니라 각 폐쇄망 배포자가 recipe에 따라 제공하는 운영 입력이다.

## 17. 리스크 / 완화

| 리스크 | 영향 | 완화 / 검증 |
|---|---|---|
| package가 community-maintained이고 도구 표면이 변함 | 승인 분류 drift | exact pin + actual `tools/list` exact test |
| package main이 side effect라 import 시 테스트 hang | boot/test 정지 | static import 금지, path resolve 후 child spawn만 |
| stdio env가 SDK argv에 직렬화 | same-user process command-line 노출 | 보안 예외 명시, closed closure, no disk/log, broker 후속 가능 |
| package Node network가 Chromium proxy/PAC/CA와 다름 | 폐쇄망 접속 실패 | AC16 실기, Confluence와 동등성 주장 금지 |
| asar 내부 entry/dependency spawn 실패 | 설치본만 broken | unpacked artifact handshake; 실패 시 closure unpack/remap |
| descriptor와 child 도구 불일치 | 도구 미표시·승인 누락 | live handshake exact-set blocking gate |
| `jira_downloadAttachment`가 후속 env로 save 가능해짐 | readOnly 분류가 거짓 | save gateway env 금지 + schema/description handshake 확인 |
| reauth 중 기존 turn이 old token 사용 | 짧은 revoke 지연 | 명시된 turn snapshot 경계; 다음 turn revision respawn |
| plugin tab rename이 provider 도메인 전체 rename으로 번짐 | 불필요한 대규모 diff | CatalogTab/i18n 소비처만 rename, wire/hook types 유지 |
| plugin-only filter가 인증 관리 row를 숨김 | 로그인 불가 | virtual 4-category + renderer regression |
| locale map 빈 문자열 | 빈 title/body | normalizer의 nonblank entry 필터 + label fallback |
| 임의 icon 입력 | runtime SVG/CSP/보안 문제 | shared typed allowlist + default fallback |

## 18. 영향 받는 파일

### 신규 예상

- `app/src/main/features/plugins/jira/entrypoint.ts` + `.test.ts`
- `app/src/main/features/plugins/jira/tools.ts` + `.test.ts`
- `app/src/main/features/plugins/jira/server.ts` + `.test.ts`
- `app/src/main/features/plugins/jira/stdio-contract.test.ts`
- `app/src/renderer/src/features/skills/lib/pluginPresentation.ts` + `.test.ts`
- 필요 시 `app/scripts/jira-packaged-smoke.mjs` + `.test.mjs`

### 수정 예상

- `app/package.json` · `app/package-lock.json`
- `app/electron-builder.yml` — AC15에서 asar unpack이 필요한 경우 같은 구현 턴에 반영
- `app/src/shared/ipc.ts` 및 shared icon type 파일(구현자가 최소 위치 확정)
- `app/src/main/adapters/{runtime-tools,claude-runtime-tools,runtime-tool-policy}.ts` + tests
- `app/src/main/features/extensions/runtime-tool-registry.ts` + test
- `app/src/main/app/deployment/{plugins,connections,deployment-wiring.test}.ts`
- `app/src/main/app/{bootstrap,connection-views}.ts` + 관련 tests
- `app/src/renderer/src/shared/ui/Icon.tsx`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `app/src/renderer/src/features/skills/lib/catalogSelection.ts` + test
- `app/src/renderer/src/features/skills/components/customize/{ExtensionsCatalogView,CustomizeList,ProviderDetail}.tsx` + tests
- `docs/arch/backend/{auth,security}.md`
- `docs/arch/frontend/overview.md`
- `docs/IPC_CONTRACT.md`
- `docs/guides/closed-network-extensions.md`
- 조건부 `app/src/main/AGENTS.md`
- `docs/handoff/0236-jira-plugin-catalog-presentation/plan.md` · `docs/handoff/INDEX.md`

파일명은 책임 기준이다. 구현자가 기존 테스트 파일에 더 작은 seam이 있음을 확인하면 합칠 수 있으나 §10 EP·pair·동작 계약을 줄일 수 없다.

## 19. 구현/검증 순서와 게이트

1. RED: runtime stdio union/registry/adapter/policy tests와 M1/M2를 등록한다.
2. GREEN: generic trusted stdio foundation을 구현하고 기존 Confluence suites를 돌린다.
3. RED: Jira normalization/tool table/entrypoint/secret lifecycle/actual listTools tests와 M3/M4/M9를 등록한다.
4. GREEN: exact dependency와 Jira feature, closed deployment binding을 구현한다.
5. RED: icon/locale/tab/list/detail tests와 M5~M8을 등록한다.
6. GREEN: shared wire→main mapper→renderer UI를 배선한다.
7. current docs를 코드의 실제 TO-BE와 맞추고 문서 inventory를 검사한다.
8. 표적 tests → lint → typecheck → 전체 `npm test`를 실행한다.
9. `build:unpack` 산출물에서 entry resolve와 stdio handshake를 실행한다. 실패 시 §11 Task D의 unpack/remap을 적용하고 재실행한다.
10. implementation report에 AC/pair/EP/변이/gate 결과와 AC16 사람 실기 대기를 채우고 별도 구현 커밋을 만든다.

### 구현 완료 명령 기준

```text
cd app
npm ls @atlassian-dc-mcp/jira
npx vitest run <runtime/Jira/deployment/renderer target tests>
npm run lint
npm run typecheck
npm test
node scripts/check-doc-inventory.mjs --check
npm run build:unpack
node <packaged Jira stdio smoke entry>
```

Windows sandbox/egress 때문에 dependency install이나 package build가 막히면 승인된 환경에서 같은 명령을 재실행한다. failure를 green으로 간주하거나 package 계약 test를 mock으로 대체하지 않는다.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 요구 4축(Jira package, icon/default, localized title/body, tab 순서)을 §2에 원문과 함께 보존했다.
- [x] 요구를 현재 Confluence의 실제 인프로세스 구현과 혼동하지 않고 공통 수명주기와 다른 transport를 분리했다.
- [x] 공식 package main/config/package/README와 설치 SDK type/runtime를 직접 확인했다.
- [x] package 도구 14개와 조건부 upload 1개를 전수했고 read 7/mutate 7 정책을 명시했다.
- [x] raw secret이 SDK argv를 거치는 사실을 숨기지 않고 D-008·AC13·EP-23·리스크에 같은 의미로 반영했다.
- [x] default deployment에 endpoint를 추측하지 않고도 Jira feature와 virtual deployment가 구현/검증 가능한 경계를 정했다.
- [x] tab rename이 gate/harness/usage 로그인 도달성을 끊지 않도록 D-014·AC12·M8로 잠갔다.
- [x] icon은 remote asset이 아니라 local typed glyph이고, 미설정/미지 값 모두 사용자 지정 기본값으로 접는다.
- [x] i18n은 ko/en을 포함한 locale map이며 exact/base/fallback과 legacy no-copy 사례가 있다.
- [x] 파생 UX에서 loading/error/retry/cancel/concurrency/rotation/closed network/accessibility를 해당 범위만 펼쳤다.
- [x] Decision Ledger OPEN 0건이고 ACTIVE 결정과 AC 사이 모순을 대조했다.
- [x] R 8종에 AT/AC 16개, production 도달 경로와 직접 oracle을 모두 부여했다.
- [x] V node 11군과 pair 19개를 등록했고 REQUIRED/REGRESSION을 구분했다.
- [x] §10 강제 지점 24개를 역할 기준으로 전수하고 모든 pair가 최소 한 지점을 참조한다.
- [x] 선택적 필드(icon/copy/plugin wire/apiContextPath)의 미지정·무효 사례가 각각 직접 AC에 있다.
- [x] 테스트-only 구현이 되지 않도록 boot→wire→renderer와 turn→adapter→child의 E2E 소비자를 §12에 열거했다.
- [x] packaged-only asar 실패를 blocking AC15로 두고 ordered fallback을 정했다.
- [x] 구현과 설계 커밋을 분리하고 이번 턴이 plan/INDEX 두 파일뿐임을 D-017로 고정했다.

---

> **[구현자 기입]** 이하는 handoff-impl 턴에서만 채운다. 설계 본문을 조용히 바꾸지 말고 PLAN_GAP은 `[구현자 기입]`에 기록해 설계자에게 되먹인다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행:
- 이견 / PLAN_GAP:
- 구현 전 재측정한 전수 수치:

## [구현자 기입] 구현 체크리스트

### Task A — trusted stdio runtime foundation

- [ ] RED tests/변이 등록
- [ ] sdk/stdio union·registry·adapter·policy 구현
- [ ] Confluence regression 확인

### Task B — Jira package/plugin

- [ ] exact dependency 설치
- [ ] entrypoint/tools/server + live listTools 구현
- [ ] closed secret lifecycle/deployment fixture 구현

### Task C — catalog presentation/tabs

- [ ] shared wire/icon normalizer 구현
- [ ] locale helper + list/detail 구현
- [ ] tab order/name/default + legacy row 회귀 구현

### Task D — docs/packaging/gates

- [ ] current docs 동기화
- [ ] full gates
- [ ] unpacked packaged smoke
- [ ] AC/pair/EP/변이 증거 기록

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 놓친 문제 / PLAN_GAP | 대응 | 근거 |
|---|---|---|---|
| 1 | — | — | — |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | — |
| AC | — |
| V pair | — |
| 강제 지점 | — |
| 등록 변이 | — |
| 실행 명령/결과 | — |
| packaged smoke | — |
| 사람 실기 대기 | AC16 |
| 신규 의존성 | `@atlassian-dc-mcp/jira@0.34.0` 예정 |
| 블로커/역질문 | — |
| 대상 커밋 | — |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| 1 | — | — | — | — |
