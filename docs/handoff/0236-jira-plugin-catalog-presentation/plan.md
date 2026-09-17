# Plan — 0236-jira-plugin-catalog-presentation

## 메타

| 항목 | 값 |
|---|---|
| slug | `0236-jira-plugin-catalog-presentation` |
| 작성자 | Claude Code |
| 일자 | 2026-09-16 |
| 매핑 | 사용자 라이브 요구 · `0160-confluence-connector-plugin` 절차 참조 |
| 상태 | **IMPL_DONE** |
| V mode | `Delta V` |
| 기준 V | `V1@41c07e9c` — 최초 Jira catalog/native tool 설계 |
| 이번 V revision | `ΔV1` — Jira 403 분류·전용 User-Agent·CI 경로 oracle 정정 |
| 유효 V | `V1 + ΔV1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: Plugin 조립 계약에는 카탈로그 표시 정보가 없어서 모든 연결 행이 같은 전원 아이콘과 Auth label만 보이고, 설명과 언어별 문구를 실을 수 없다.
- 해결하려는 문제: 카탈로그 첫 화면이 `스킬 → MCP → 연결` 순서라 사용자가 요구한 `플러그인 → 스킬 → MCP` 탐색 순서와 다르다.
- 해결하려는 문제: Jira Data Center 기능은 외부 MCP 프로세스로만 존재하고 Orca의 Auth·승인·런타임 도구·임시 파일 정책에 편입돼 있지 않다.
- 완료 후 달라지는 것: 배포가 Plugin별 아이콘·ko/en 제목·ko/en 본문·출처를 선언하고, Jira 0.34.0의 기본 MCP 도구 표면을 Orca 내부 도구로 제공할 수 있다.
- 성공을 사용자 관점에서 한 문장으로: 플러그인 탭에서 현지화된 Jira 설명과 출처를 확인하고 연결한 뒤, 에이전트가 안전한 승인 정책 아래 Jira 이슈와 첨부를 다룬다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | Plugin 구성 시 아이콘을 설정하고, 미설정 시 Material Symbols Outlined `electrical_services`를 쓴다 | 사용자 라이브 세션 2026-09-16 |
| 명시 요구 | 카탈로그 제목과 본문을 ko/en 등 i18n으로 구성한다 | 사용자 라이브 세션 2026-09-16 |
| 명시 요구 | 탭 순서를 플러그인, 스킬, MCP로 바꾼다 | 사용자 라이브 세션 2026-09-16 |
| 명시 요구 | `@atlassian-dc-mcp/jira`를 0160 Confluence와 같은 절차로 분석·마이그레이션한다 | 사용자 라이브 세션 2026-09-16 |
| 명시 요구 | 에이전트가 받을 결과 형식을 만들고 첨부를 OS Temp의 Orca 폴더에 저장한다 | 사용자 라이브 세션 2026-09-16 |
| 명시 요구 | 카탈로그 설명에 출처·사용 버전·GitHub 주소를 표시한다 | 사용자 라이브 세션 2026-09-16 |
| 명시 요구 | Jira 도구의 HTTP 403을 인증 만료로 오독하지 않고 권한 부족으로 전달한다 | 사용자 라이브 세션 2026-09-17 |
| 명시 요구 | Jira 요청의 Chromium/Mozilla User-Agent를 Jira 전용 값으로 재지정해 UA-XSRF guard를 통과한다 | 사용자 라이브 세션 2026-09-17 |
| 명시 요구 | `attachment-store.test.ts`의 CI 경로 구분자 의존 실패를 고친다 | 사용자 라이브 세션 2026-09-17 |
| 추론 의도 | “같은 절차”는 외부 stdio 서버 실행이 아니라, 0160처럼 소스 의미를 분석해 `BoundAuth.request` 기반 native Runtime Tool로 옮긴다는 뜻이다 | 0160 구현과 현재 `features/plugins/confluence/` 구조 |
| 추론 의도 | 사용자가 적은 `orucinus-orca`는 현 제품 정본 `PRODUCT_SLUG='orcinus-orca'`의 오탈자로 본다 | `app/src/shared/product.ts`; 기존 OS Temp 정본 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | `PluginBinding`에 선택적 `catalog` 표시 계약을 추가한다 | 기존 배포 Plugin은 수정 없이 동작해야 한다 | 사용자 요구 + 현재 조립 경계 | ACTIVE | — |
| D-002 | 아이콘 값은 Material Symbols glyph 이름의 오프라인 번들형 허용 목록으로 제한하고 미설정 시 `electrical_services`를 쓴다. 축은 요청한 Outlined/FILL 0/wght 400/GRAD 0/opsz 24다 | 원격 font 로드 실패와 임의 SVG 주입을 피한다 | 사용자 URL + 기존 `Icon.tsx` 방식 | ACTIVE | — |
| D-003 | 제목·본문은 `ko`와 `en`을 필수 키로 갖고 추가 locale 키를 wire에서 보존한다. 현재 UI가 실제 선택하는 locale은 ko/en이고, pure resolver의 exact locale → base language → ko → en 규칙은 미래 locale 확장 계약이다 | 현재 도달 가능한 두 언어를 보장하되 데이터 계약을 다시 깨지 않고 확장한다 | 사용자 요구 + 현 `UiLocale`/`useI18n` | ACTIVE | — |
| D-004 | Plugin config의 `catalog`가 없으면 binding이 Auth label fallback·본문 없음·`electrical_services`인 catalog를 생성한다. non-Plugin 연결은 catalog undefined와 기존 power icon을 유지한다 | legacy Plugin과 gate/harness/usage를 구분하면서 새 기본 아이콘 요구를 지킨다 | D-001·D-002 | ACTIVE | — |
| D-005 | 출처는 본문 문자열에 박지 않고 `source`·`version`·`githubUrl`·선택적 `license` 구조로 실어 상세 패널에 표시한다 | locale 문구와 provenance를 독립 검증한다 | 사용자 요구 | ACTIVE | — |
| D-006 | 보이는 탭 이름과 순서는 `플러그인/Plugins → 스킬/Skills → MCP`, 초기 탭은 플러그인이다. 내부 호환 ID `providers`와 gate·harness·plugin·usage 통합 목록은 유지한다 | 사용자 순서를 지키면서 0181·0188의 인증 관리 경로를 잃지 않는다 | 사용자 요구 + 기존 결정 | ACTIVE | — |
| D-007 | Jira 기준 소스는 `@atlassian-dc-mcp/jira@0.34.0`, gitHead `ab2b534…`, MIT, GitHub의 pinned `packages/jira` 경로다 | 조사 시점의 재현 가능한 버전을 고정한다 | npm package metadata·배포 tarball | ACTIVE | — |
| D-008 | Jira는 새 runtime dependency나 별도 MCP process 없이 Orca native 모듈로 옮긴다 | Chromium `net.fetch`, vault, 승인, 취소 계약을 한 경로로 유지한다 | 0160 패턴 + main 정책 | ACTIVE | — |
| D-009 | upstream 기본 등록 표면 14개를 옮긴다. 환경 opt-in `jira_uploadAttachment` 1개는 이번 범위에서 제외한다 | upstream도 upload root를 켠 경우에만 등록하며, 현 `BoundAuth.request`에는 multipart outbound body가 없다 | package `src/index.ts`·`jira-service.ts` | ACTIVE | — |
| D-010 | PAT는 `Authorization: Bearer`로 제시하고 probe는 기본 `/rest/api/2/myself`다. origin은 배포가 정하고 정규화한 API base path 하나에서 probe와 tools path를 함께 파생한다 | context path 배포에서 probe와 도구 URL이 갈라지지 않게 한다 | package source + `BoundAuth` | ACTIVE | — |
| D-011 | 도구 결과는 성공/실패 판별 가능한 JSON envelope를 `content[0].text`와 `structuredContent`에 동일하게 싣고, 실패는 `isError:true`다 | 에이전트가 결과·실패를 기계적으로 구분해야 한다 | 사용자 요구 + `RuntimeToolResult` | ACTIVE | — |
| D-012 | 첨부 저장 root의 유일한 정본은 `getTemporaryFilesPath()`이고 그 아래 `jira/<auth-segment>/<selector-segment>/<batch-id>/`만 publish한다. Windows의 통상 예시는 `%LOCALAPPDATA%/Temp/orcinus-orca/…`지만 경로 문자열 자체는 계약이 아니다 | `~/<APPDATA>` 문자열 조립·환경별 Temp 추측·두 번째 오탈자 제품 루트를 만들지 않는다 | 사용자 요구 + 0225 제품명 결정 | ACTIVE | — |
| D-013 | 원격·로컬 상태를 바꾸지 않는 6개 도구만 `readOnlyHint:true`; 원격 변경 7개와 저장 가능 download 1개는 승인 대상이다 | 정책은 명시적 true만 자동 허용한다 | `runtime-tool-policy.ts` | ACTIVE | — |
| D-014 | 기본 OSS 배포의 Auth·Plugin 배열은 계속 비워 두고, Jira origin/PAT는 폐쇄망 배포 레시피에서만 조립한다 | 실제 URL을 추측하거나 가짜 production endpoint를 만들 수 없다 | 현 deployment 계약 | ACTIVE | — |
| D-015 | 신규 npm 의존성은 추가하지 않는다. package 소스는 의미·schema·도구명 분석 자료이며 `node_modules`를 제품 코드로 참조하지 않는다 | 이미 있는 zod 4·Runtime Tool·BoundAuth로 구현 가능하다 | package 분석 + dependency 정책 | ACTIVE | — |
| D-016 | 0.34.0 migration 호환 범위는 tool 이름·입력 필드·기본값·REST method/path/query/body 의미다. selector XOR, page 최대 100, 호출당 첨부 최대 10, request/response/output/byte 상한, fixed safe save field, Orca envelope는 의도한 안전·host 통합 delta다 | “똑같은 절차”를 무제한/모호 입력까지 복사한다는 뜻으로 오해하지 않는다 | package source 대조 + Orca 보안 경계 | ACTIVE | — |
| D-017 | 한 번의 download 호출에서 저장할 첨부 배치는 all-or-nothing이다. 같은 canonical root의 숨은 staging 디렉터리에 전부 쓴 뒤 디렉터리 rename으로 한 번에 publish하고, 실패·취소 시 stage 전체를 지운다 | 최대 10개 저장에서 일부 파일만 성공 결과처럼 남는 모호한 상태를 막는다 | AC12 역방향 검토 | ACTIVE | — |
| D-018 | download 결과는 publish 전에 최종 경로를 예측해 직렬화 예산을 확정한다. optional inline content는 source 순서대로 예산 안에서만 싣고 초과분은 `tool_output_limit`으로 생략하며, 필수 metadata조차 2 MiB를 넘으면 stage를 제거하고 실패한다 | publish 뒤 output-cap error가 완성된 batch를 고아로 남기는 교차 실패를 막는다 | AC9·AC11·AC12 역방향 검토 | ACTIVE | — |
| D-019 | Jira 도구와 Auth probe 요청은 401만 자격증명 실패로 강등한다. 403 tool 결과는 grant/registry를 유지한 채 `forbidden`으로 반환하고, 복원 probe의 403도 기존 grant/registry를 유지하되 verified 성공으로 위장하지 않는다. 다른 Auth 소비자의 기존 401/403 강등 기본값은 유지한다 | Jira 403은 유효 PAT의 프로젝트·동작 권한 부족일 수 있어 재인증으로 해결되지 않는다 | 사용자 라이브 세션 2026-09-17 + `AuthenticatedRequester`·`LoginService.resume` 실측 | ACTIVE | V1 §5·§13의 Jira `401/403` 강등 문구를 대체 |
| D-020 | Jira Auth probe·기본 REST·dev-status·attachment content 요청의 User-Agent는 모두 `Orcinus-Orca-Jira/0.34.0`이다 | 비브라우저 제품 토큰으로 UA-XSRF guard를 피하고 서버 로그에서 이식 기준 버전을 식별한다 | 사용자 라이브 세션 2026-09-17 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-019·D-020.
- 변경된 결정: V1 §5·§13의 Jira `401/403` 강등 문구는 D-019가 대체한다. 0181의 보이는 `연결/Connections` 명칭과 기본 탭만 D-006으로 변경한다는 D-006은 유지한다.
- 기존 ACTIVE 중 유지되는 결정: 0188의 `plugin→service` wire kind, cached tool name, binding 1회 생성, invalid auth에서 registry 제거 계약.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0. V1의 D-001…D-018 연결은 유지하고, D-019는 AC17, D-020은 AC18에 연결한다. AC15는 실제 환경 종단 확인이다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 고정 `power`/`provider.label`은 producer→wire 표시 계약 부재의 결과다. Plugin 조립 계약부터 넓혀야 한다 |
| 이미 기존 코드가 충족하는가 | 일부만 충족 | Auth label·도구 목록·상태는 있으나 icon/body/i18n/provenance가 없다. Temp root와 Runtime Tool 인프라는 재사용 가능하다 |
| 더 작은 해법이 있는가 | UI 하드코딩은 기각 | Jira만 renderer에서 분기하면 다음 Plugin마다 다시 분기하고 배포 config 요구를 충족하지 못한다 |
| 선행 자료의 주장을 코드와 대조했는가 | 대조 완료 | 0160 현재 코드는 native `BoundAuth.request`·tool descriptor·download store로 진화했다. Jira package 0.34.0 source의 실제 등록 도구와 경로를 별도 확인했다 |
| ACTIVE 결정과 충돌하는가 | 보이는 명칭만 변경 | 통합 provider tab을 분리하지 않고 내부 ID·행·wire kind를 유지하므로 0181·0188의 구조 결정은 보존된다 |

- 사용자에게 올릴 결정: 없음. upload는 upstream opt-in이고 요구에 upload root가 없으므로 D-009로 범위를 닫았다.
- 코드 조사로 닫은 사실: package는 기본 13개 REST 도구와 download 1개를 등록한다. upload 1개는 attachment gateway upload가 enabled일 때만 추가된다.
- 코드 조사로 닫은 사실: `getTemporaryFilesPath()`가 이미 `os.tmpdir()/orcinus-orca`를 정본으로 제공한다.
- 코드 조사로 닫은 사실: `RuntimeToolResult.structuredContent`와 binary response/maxBytes가 이미 계약에 있다.

## 5. 동작 / 사용자 흐름

```text
[배포자가 Jira origin·PAT Auth·Plugin catalog를 빌드타임 조립]
  → [앱 부팅: PluginBinding은 localized catalog와 14개 cached tool name을 제공]
  → [플러그인 탭 첫 화면: 선택 아이콘·현재 locale 제목 표시]
  → [상세: locale 본문 + source/version/GitHub + 인증 상태·도구명 표시]
  → [사용자가 PAT 연결]
  → [probe 성공: Runtime Tool server 등록, 다음 agent spawn에 14개 도구 노출]
  → [에이전트 호출: Zod 검증 → BoundAuth.request → JSON envelope]
  ↘ [원격/검증 실패: isError=true envelope, 비밀 없는 오류]
  ↘ [download save=true: 고정 Temp 하위에 배타 생성 후 저장 경로 반환]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| Plugin config에 `catalog`가 없음 | binding이 기본 `electrical_services`·Auth label fallback·본문 없음인 normalized catalog를 만든다 | 기존 Plugin 배포도 깨지지 않고 새 기본 아이콘을 본다 |
| gate/harness/usage 연결 행 | `ProviderInfo.catalog`를 만들지 않는다 | 기존 power icon·Auth label·인증 UI를 유지한다 |
| ko/en locale 전환 | 같은 `ProviderInfo.catalog`에서 현재 locale 값을 다시 선택 | 재연결·재조회 없이 제목과 본문이 즉시 바뀐다 |
| 플러그인 페이지 진입 | `providers` 선택으로 시작하고 탭 배열 순서를 따른다 | 플러그인, 스킬, MCP 순서로 보인다 |
| Jira grant 없음/expired | cached descriptor는 카탈로그에 남고 server는 registry에서 빠진다 | 설명·도구 이름은 보이지만 연결 필요 상태다 |
| PAT 제출·probe 성공 | `BoundAuth` valid, 기존 binding의 server를 registry에 추가 | 다음 턴부터 Jira 도구가 모델에 보인다 |
| read-only Jira 호출 | approval allowlist를 통과하고 동일 origin REST 요청 | JSON success envelope를 받는다 |
| 변경/download 호출 | 기존 tool approval 흐름을 거친다 | 사용자가 승인/거부할 수 있다 |
| download `save:false` | binary를 상한 내 읽고 선택된 inline 표현만 반환 | 파일시스템 변화가 없다. 그래도 도구 capability상 승인 대상이다 |
| download `save:true` | 같은 Temp root의 숨은 stage에 선택된 파일을 모두 쓴 뒤 batch directory를 원자 rename한다 | 전부 성공한 뒤에만 envelope에 저장 경로·크기·MIME가 실린다 |
| 다중 download 중 하나 실패·취소 | stage 전체를 닫고 제거하며 final batch를 만들지 않는다 | 실패 envelope만 받고 부분 저장 경로는 없다 |
| revoke/401 | Auth 상태가 invalid/expired가 되고 binding sync가 server를 제거 | 이후 spawn에서 도구가 빠지고 카탈로그는 재연결 상태가 된다 |
| Jira 도구가 403 반환 | Auth 상태와 registry를 유지하고 Jira error mapper가 `forbidden`을 만든다 | 현재 연결은 유지되고 에이전트가 권한 부족과 status 403을 본다 |

### 파생 UX / 엣지케이스

- loading / empty / error: Plugin 목록이 0개여도 플러그인 탭은 빈 상태를 기존 방식으로 표시한다. 잘못된 locale map은 TypeScript와 fixture에서 막는다.
- cancel / retry / close / restart: tool handler는 `RuntimeToolContext.getSignal()`을 request에 전달한다. 저장 중 취소·실패하면 batch stage 전체를 제거하고 retry는 새 batch id를 쓴다. crash로 남은 숨은 stage는 다음 store 준비 때 24시간 초과분만 정리하며 publish된 batch는 자동 삭제하지 않는다.
- concurrency / multi-session: 같은 파일명이 겹쳐도 overwrite하지 않고 suffix를 붙인다. server 객체는 부팅 1회 생성해 handler identity를 유지한다.
- keyboard / a11y / theme: 아이콘은 `currentColor`, 제목/본문은 text node, provenance URL은 선택 가능한 평문으로 렌더한다. 탭 키보드 동작은 공용 `CatalogTabs`를 유지한다.
- detail layout: body는 `whitespace-pre-wrap`, GitHub 주소는 monospace `break-all`, source/version/GitHub/license heading은 ko/en resource key를 쓴다.
- 외부환경/오프라인/폐쇄망: icon은 inline SVG라 Google Fonts 네트워크에 의존하지 않는다. Jira 요청은 선언된 origin 안에서만 돈다.
- locale 누락: 이번 계약은 ko/en을 필수로 하므로 현재 `useI18n`이 실제 내는 locale에서 누락이 없다. 추가 locale key는 wire에서 보존되고 pure resolver 규칙은 고정하지만, 해당 locale을 사용자가 선택하는 UI는 이번 범위가 아니다.
- GitHub 주소: 앱 안에서 직접 navigation하지 않고 그대로 표시한다. 외부 브라우저 IPC 추가는 이번 범위가 아니다.

## 6. 범위 / 비범위

- **범위**: Plugin catalog 표시 계약, wire 전달, renderer locale 해석과 표시, default `electrical_services` icon, 탭 순서·이름·초기 선택.
- **범위**: Jira 0.34.0 기본 등록 도구 14개의 schema·REST 의미·result envelope·approval annotation·download 저장.
- **범위**: Jira PAT 배포 레시피, 실제 타입에 대입되는 fixture, 현재 아키텍처·IPC·폐쇄망 가이드 갱신.
- **비범위**: `jira_uploadAttachment`, multipart outbound request, 사용자 선택 upload root.
- **비범위**: 기본 OSS 빌드에 가짜 Jira origin 또는 기본 Jira card 추가, runtime 동적 Plugin 설치/편집.
- **비범위**: arbitrary remote icon URL, web font 의존, raw SVG/HTML/Markdown body 입력.
- **비범위**: 새 `ProviderKind`, `providers` wire/tab ID rename, gate·harness·usage 행 제거.
- **비범위**: Confluence 저장 경로 이전, DB 영속화, Jira Cloud/Atlassian 공식 remote MCP.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `jira_uploadAttachment` | 예 — `AuthenticatedRequest`의 binary/multipart body와 별도 input root 정책이 필요 | 후속 handoff. 이번 tool inventory에는 넣지 않는다 |
| 클릭 가능한 GitHub 링크 | 아니오 — 주소 표시 계약과 독립 | 안전한 external-open 계약이 필요할 때 후속 |
| runtime catalog 편집 | 예 — config 저장·검증·IPC가 새 공개 계약이 된다 | 사용자 요구 없음. build-time config 유지 |
| Confluence Temp root 통일 | 아니오 — Jira 요구와 독립 | 별도 migration으로 처리 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | Plugin config의 `catalog` icon/title/body/attribution이 provider list와 상세까지 보존된다 | binding→row→`ProviderInfo`→renderer integration fixture가 같은 값을 단언 | `createPluginBinding`→`pluginRows`→`connectionInfo`→catalog UI |
| R-02 | AT-02 / AC2 | icon 미설정/`catalog` 미설정 Plugin은 `electrical_services` glyph를 쓰고, 허용한 다른 Material glyph도 list/detail 양쪽에서 같다. non-Plugin은 power를 유지한다 | default/custom/non-Plugin render와 SVG path fixture | Plugin config→icon resolver→`Icon` |
| R-03 | AT-03 / AC3 | 현재 UI의 ko/en 전환 시 제목과 본문이 해당 locale로 바뀐다. 추가 locale key는 wire에서 보존되며 pure resolver는 forward-compatible exact→base→ko→en 규칙을 지킨다 | ko/en component render + 임의 locale 문자열에 대한 pure resolver table; 현 UI 도달성은 ko/en만 단언 | `useI18n.locale`(ko/en)→resolver→list/detail |
| R-04 | AT-04 / AC4 | Jira 상세에 source·0.34.0·pinned GitHub 주소가 body와 분리돼 표시된다 | source constant와 detail markup text 단언 | Jira source metadata→catalog attribution→detail |
| R-05 | AT-05 / AC5 | 탭은 플러그인, 스킬, MCP 순서이고 첫 진입은 플러그인이다 | `CATALOG_TABS` 순서·label·initial selection render | `ExtensionsCatalogView`→`CustomizeTabs` |
| R-06 | AT-06 / AC6 | 플러그인 탭은 기존 gate·harness·plugin·usage 연결 행과 인증 동작을 그대로 포함한다 | 네 category fixture의 행/선택/detail/auth callback 회귀 | `createConnectionSources`→provider tab |
| R-07 | AT-07 / AC7 | Jira descriptor는 upstream 기본 14개 이름을 정확히 한 번씩 가지며 upload는 없다 | literal inventory와 descriptor set equality | `jiraTools`→RuntimeToolRegistry snapshot→agent extension |
| R-08 | AT-08 / AC8 | 14개 이름·입력 필드·기본값·REST method/path/query/body가 0.34.0 의미를 보존하고, D-016의 명시적 안전 delta만 적용한다 | request fake가 각 도구의 outbound request/body와 selector XOR·상한 delta를 함께 단언 | handler→Jira service→`BoundAuth.request` |
| R-09 | AT-09 / AC9 | 성공·204·실패가 안정된 JSON envelope로 text/structuredContent에 같게 실리고 실패는 `isError:true`다 | parse round-trip, 204 null, error mapping fixture | Jira result mapper→RuntimeToolResult→agent |
| R-10 | AT-10 / AC10 | PAT Bearer와 `/rest/api/2/myself` probe로 연결하며 context path를 origin과 분리하고, 같은 normalized API base가 probe와 tools를 함께 움직인다 | default/non-default base의 AuthDefinition compile fixture + probe/request path contract | deployment Auth→AuthRuntime→Jira tools |
| R-11 | AT-11 / AC11 | pagination·request·response 상한 초과는 명시 오류다. tool-output은 publish 전에 2 MiB 이하로 확정하고 optional inline만 결정적으로 생략하며, secret/raw header는 결과·로그에 없다 | 경계값/초과값·multi-inline omission·metadata-only overflow·redaction fixture | schema/service/error mapper→pre-publish result budget |
| R-12 | AT-12 / AC12 | attachmentId 또는 issueKey로 다운로드하고 save 시 canonical Temp 하위만 쓴다. 선택 batch 전부와 bounded success envelope가 준비돼야 stage→atomic publish 후 경로를 반환하며 traversal/symlink/overwrite/cross-origin·부분 publish·publish 후 output 실패를 거부한다 | temp fixture·same-origin URL·exclusive-create·다중 성공/중간 실패/취소/output-cap/stale-stage cleanup 테스트 | download tool→metadata→binary request→stage→result preflight→batch publish |
| R-13 | AT-13 / AC13 | 6개 순수 조회만 자동 허용되고 원격 변경 7개와 download 1개는 승인 대상이다 | descriptor annotation과 `runtimeApprovalToolNames` exact set | registry snapshot→approval policy |
| R-14 | AT-14 / AC14 | grant valid/invalid 전이에 따라 동일 server가 등록/제거되고 기본 OSS 배포는 계속 0 Plugin이다 | binding sync/identity/default deployment 회귀 + guide fixture typecheck | boot→binding sync→registry |
| R-15 | AT-15 / AC15 | 실제 Jira DC에서 조회·변경·첨부 저장과 두 locale UI가 요구대로 동작한다 | 사람 실기 체크리스트와 파일 위치/화면 관측 | packaged/dev app→real Jira→agent/UI |
| R-16 | AT-16 / AC16 | 제품 manifest/lockfile에 어떤 신규 npm dependency도 추가하지 않고, 제품 source의 `@atlassian-dc-mcp/*` import도 0이다. Jira는 repository-owned native module로만 bundle된다 | dependencies/devDependencies/optionalDependencies/peerDependencies와 lock entry 추가 0, product import sweep, production typecheck/build | app package build→native Jira module→bundled app |
| R-17 | AT-17 / AC17 | Jira의 401은 기존처럼 grant를 만료시키지만 403 tool 결과와 복원 probe는 grant·registry를 유지한다. tool은 `forbidden`, probe는 verified 성공이 아닌 보존 실패로 끝난다 | 공용 requester 기본 403 강등 회귀 + Jira tool 403 비강등/result code + probe→resume→registry 상태표 | Jira request/probe policy→`AuthenticatedRequester`→`LoginService`→Auth store/binding sync→Jira result mapper |
| R-18 | AT-18 / AC18 | Jira가 만드는 Auth probe·기본 REST·dev-status·attachment content 요청은 모두 `User-Agent: Orcinus-Orca-Jira/0.34.0`과 기존 `X-Atlassian-Token: no-check`를 함께 보낸다 | probe + 기본 14개 request + dev-status 후속 요청 + attachment content 요청의 header table과 Chromium manual transport | Jira probe/request builders→`BoundAuth.request`→Chromium transport→Jira DC |

### AC 검증 주의사항

- 기존 테스트 재사용: `deployment/plugins.test.ts`, `deployment-wiring.test.ts`, `connection-views.test.ts`, `catalogSelection.test.ts`, `CustomizeList.render.test.ts`, runtime approval policy 테스트를 확장한다.
- 사람 실기 항목: 실제 Jira DC 인증·권한·dev-status·첨부 binary와 최종 시각 레이아웃만 AC15에 둔다. locale/icon/경로/도구 형상·dependency 부재는 사람에게 미루지 않는다.
- 총량 기준: upstream source의 최대 15개 = 기본 13 + download 1 + 조건부 upload 1. 이번 descriptor 총량은 14 = read-only 6 + remote mutation 7 + download 1이다.
- 순서 기준: `CATALOG_TABS.map(tab)`과 `ExtensionsCatalogView` 최초 state를 서로 다른 oracle로 잡는다.
- 0건 기준: `package.json`/lockfile dependency diff 0, default `createPluginBindings()` 결과 0, Jira descriptor의 `jira_uploadAttachment` 0을 각각 허용/제거 대상으로 분해한다.

## 7-A. V / Trace Matrix

- V mode 판정: 최초 catalog/Jira 기능은 V1 Baseline이고, 사용자 실기 피드백이 인증 상태·요청 header·filesystem oracle을 일부 바꾸므로 `ΔV1`이다.
- 기준 V 상속 근거: `V1@41c07e9c`; 0160·0181·0188은 architecture/regression 근거로만 사용한다.
- 변경이 시작되는 수준: R — Jira 403의 사용자 관측 의미와 User-Agent 요구가 바뀌어 SD·AR·MD까지 내려간다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01…R-05, R-07…R-16 | R | §7 신규 제품 요구 | NEW | 사용자 요구 |
| AT-01…AT-05, AT-07…AT-16 | AT | §7 신규 직접 evidence | NEW | 구현 후 test/실기 |
| R-06 / AT-06 | R / AT | 기존 통합 provider 목록·인증 동작 보존 | INHERITED | 0181·0188 및 기존 renderer/auth 테스트 |
| SD-01 / ST-01 | SD / ST | Plugin 표시 config가 부팅부터 locale UI까지 유지 | NEW | — |
| SD-02 / ST-02 | SD / ST | Jira Auth→tool 등록→호출→revoke 전체 lifecycle | NEW | — |
| AR-01 / IT-01 | AR / IT | presentation producer→wire→consumer | NEW | — |
| AR-02 / IT-02 | AR / IT | Jira schema→REST request→result envelope | NEW | — |
| AR-03 / IT-03 | AR / IT | attachment metadata→same-origin binary→Temp store | NEW | — |
| AR-04 / IT-04 | AR / IT | 통합 provider 목록·Plugin sync 기존 계약 | INHERITED | 0181·0188 기존 테스트 |
| MD-01 / UT-01 | MD / UT | locale fallback와 default/custom icon resolver | NEW | — |
| MD-02 / UT-02 | MD / UT | 14개 schema·route·payload builder | NEW | — |
| MD-03 / UT-03 | MD / UT | success/error envelope·size/redaction | NEW | — |
| MD-04 / UT-04 | MD / UT | filename/path/same-origin/exclusive stage/atomic batch store | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | config→binding→row→wire→UI | same fixture identity/value | M1 presentation 전달 제거 | EP-01…06 (6) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | absent/custom icon→resolver→two surfaces | SVG glyph/list-detail equality | M2 default를 `power_settings_new`로 복귀 | EP-02/05/06/07 (4) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | current ko/en→resolver→title/body; extra key→wire→pure fallback | ko/en render + arbitrary-locale table | M3 ko/en 선택 또는 pure fallback 맞바꿈 | EP-04/05/06/08 (4) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | source constant→catalog→detail | four attribution fields | M4 version 또는 URL 제거 | EP-06/11/12 (3) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | initial state→tabs render | order + initial selection | M5 order/default 각각 복귀 | EP-09/10 (2) |
| VP-06 | R-06 ↔ AT-06 | REGRESSION | four categories→provider rows→auth detail | category matrix/callback | not selected — 기존 종단 oracle | EP-03/04/05/06 (4) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | tool constants→descriptor→snapshot | exact 14-name set | M6 한 이름 제거/upload 추가 | EP-11/13/22 (3) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | Zod input→safety delta→request builder→BoundAuth fake | 14 route/payload + XOR/cap cases | M7 method/path/body 또는 D-016 delta 하나 변경 | EP-14/15/16/17/21 (5) |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | response→mapper→MCP result | text/structured parity + isError | M8 error를 success로 변경 | EP-18 (1) |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | deployment Auth→probe→request auth | compile fixture + request headers/path | M9 origin에 base path 중복 | EP-16/17 (2) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | input/response→bounds→pre-publish output budget→safe result | boundary/omission table + secret sentinel absence | M10 maxBytes/redaction/preflight 제거 | EP-14/15/18/20/21 (5) |
| VP-12 | R-12 ↔ AT-12 | REQUIRED | selector→metadata→binary→stage→result preflight→atomic batch publish | adversarial filesystem + multi-file failure/cancel/output-cap matrix | M11 traversal/cross-origin/overwrite/partial-or-orphan publish 허용 | EP-18/19/20/21 (4) |
| VP-13 | R-13 ↔ AT-13 | REQUIRED | annotations→approval exact set | 6/8 set equality | M12 mutation을 readOnly로 뒤집기 | EP-13/22 (2) |
| VP-14 | R-14 ↔ AT-14 | REQUIRED | auth status→binding sync→registry/default deploy | same server identity + 0 default | M13 invalid에서 remove 생략 | EP-16/22/23 (3) |
| VP-15 | R-15 ↔ AT-15 | REQUIRED | packaged app→real Jira/UI | signed checklist/screens/file path | not selected — 외부·시각 종단 | EP-04/05/06/09/10/12/13/16/17/18/20/22 (12) |
| VP-16 | SD-01 ↔ ST-01 | REQUIRED | boot config→IPC→locale rerender | integration state sequence | M1/M3/M5 | EP-01…10 (10) |
| VP-17 | SD-02 ↔ ST-02 | REQUIRED | boot→login→spawn→tool→revoke | lifecycle integration | M6/M8/M13 | EP-13…22 (10) |
| VP-18 | AR-01 ↔ IT-01 | REQUIRED | binding→view source→ProviderInfo→renderer | producer/consumer contract fixture | M1 | EP-01…06 (6) |
| VP-19 | AR-02 ↔ IT-02 | REQUIRED | handler→service→BoundAuth→envelope | request/response fake | M7/M8/M10 | EP-13…18 (6) |
| VP-20 | AR-03 ↔ IT-03 | REQUIRED | Jira content URL→relative path→binary→stage→result preflight→batch publish | temp integration with mid-batch/output-cap fault | M11 | EP-18…21 (4) |
| VP-21 | AR-04 ↔ IT-04 | REGRESSION | categories/binding→existing UI/runtime | existing suite + new category matrix | M13 | EP-03/04/22 (3) |
| VP-22 | MD-01 ↔ UT-01 | REQUIRED | locale/icon input→resolved presentation | pure table | M2/M3 | EP-07/08 (2) |
| VP-23 | MD-02 ↔ UT-02 | REQUIRED | tool input→route/body | literal route table | M6/M7 | EP-13…17 (5) |
| VP-24 | MD-03 ↔ UT-03 | REQUIRED | HTTP/error→envelope | parse/redaction/size table | M8/M10 | EP-18 (1) |
| VP-25 | MD-04 ↔ UT-04 | REQUIRED | untrusted name/URL→safe stage/publish | traversal/symlink/exclusive/atomic cases | M11 | EP-19…21 (3) |
| VP-26 | R-16 ↔ AT-16 | REQUIRED | package build→repository Jira source→bundle | all dependency sections/lock/import sweep + build/typecheck | M14 임의 dependency 또는 upstream product import 추가 | EP-24 (1) |

### ΔV1 node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-17 / AT-17 | R / AT | Jira 401·403 인증 상태와 오류 의미 분리 | NEW | D-019·AC17 |
| R-18 / AT-18 | R / AT | Jira 전용 User-Agent 전 요청 적용 | NEW | D-020·AC18 |
| SD-03 / ST-03 | SD / ST | Jira 응답 status→Auth 상태→registry→agent 결과 lifecycle | NEW | V1 SD-02 보완 |
| AR-05 / IT-05 | AR / IT | Jira request policy/header→AuthenticatedRequester→Chromium transport | NEW | V1 AR-02 보완 |
| MD-05 / UT-05 | MD / UT | 요청별 auth 실패 status와 Jira 공통 header 조립 | NEW | — |
| MD-04 / UT-04 | MD / UT | attachment final path와 batch publish oracle | INHERITED | V1 VP-25 |

### ΔV1 pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-27 | R-17 ↔ AT-17 | REQUIRED | Jira request/probe policy→requester·resume status 판정→store/registry→error mapper | 401 강등·tool/probe 403 비강등·`forbidden` envelope 상태표 | M15 Jira policy에서 403을 다시 auth failure로 포함하거나 resume에서 모든 probe 실패를 강등 | EP-25 (3) |
| VP-28 | R-18 ↔ AT-18 | REQUIRED | Jira probe/builders→headers→Auth presentation→Chromium transport | probe + 14 기본 + dev-status + attachment content 요청 header 표 | M16 공통 Jira UA 제거 또는 probe/특수 요청에서 누락 | EP-26 (4) |
| VP-29 | SD-03 ↔ ST-03 | REQUIRED | tool/probe 403 response→grant 유지→server 유지→agent forbidden 또는 보존 실패 | 공용 requester·resume·binding registry·Jira mapper 결합 evidence | M15 | EP-18/22/25 (3) |
| VP-30 | AR-05 ↔ IT-05 | REQUIRED | request policy/header→AuthenticatedRequest→requester/transport | contract + request-builder integration | M15/M16 | EP-17/25/26 (3) |
| VP-31 | MD-05 ↔ UT-05 | REQUIRED | status/header input→requester/resume demotion·header output | pure/default/override/probe table | M15/M16 | EP-25/26 (2) |
| VP-32 | MD-04 ↔ UT-04 | REGRESSION | published savedPath→canonical Jira root·batch directory | `relative`/`dirname` 기반 Windows·POSIX 독립 assertion | not selected — 기존 직접 filesystem oracle의 플랫폼 표현만 수정 | EP-20 (1) |
| VP-33 | R-14 ↔ AT-14 | REGRESSION | non-Jira 403→기존 Auth 강등·sync | 기본 policy 403 회귀 | M15 override를 전역 기본값으로 오적용 | EP-22/25 (2) |

M1=`pluginRows` 또는 `connectionInfo`에서 catalog 제거. M2=미설정 icon을 `power_settings_new`로 복귀. M3=ko/en 선택 또는 pure locale fallback 순서 교환. M4=Jira attribution field 제거. M5=탭 순서 또는 초기 탭 복귀. M6=14-name inventory drift. M7=REST method/path/query/body 또는 D-016 안전 delta drift. M8=실패의 `isError` 제거. M9=origin과 API base path 중복. M10=size/redaction/pre-publish output budget guard 제거. M11=cross-origin·traversal·overwrite·부분 또는 orphan publish guard 제거. M12=mutation annotation을 read-only로 변경. M13=invalid auth의 registry remove 제거. M14=임의 npm dependency를 추가하거나 `@atlassian-dc-mcp/*`를 제품 source에서 import.
M15=Jira 요청에서 403을 auth failure로 되돌리거나 resume이 Jira probe 403을 재강등하거나 요청별 override를 전역 기본값으로 적용. M16=Jira 공통 User-Agent를 제거하거나 probe/dev-status/attachment content 경로에서만 누락.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| plan/INDEX 정합성 | 이번 턴 산출물 | `git diff --check`; slug·READY·다음 주체·링크 재읽기 | 문서 불일치면 READY 불가 |
| renderer/main/shared | 세 subtree 계약 동시 변경 | `npm run lint`; `npm run typecheck` | 이번 변경 유발 error |
| 관련 비-DB 테스트 | 순수 UI·REST·filesystem·wiring | `npx vitest run`에 §19 대상 파일 명시 | pair 실패 또는 신규 red |
| 문서/인벤토리 | IPC·arch·guide 변경 | `node scripts/check-doc-inventory.mjs --check`; `git diff --check` | 이번 변경 유발 불일치 |
| dependency | native port, 신규 패키지 0 | manifest 4개 dependency section·lock entry 추가 0 + upstream import sweep | 어떤 새 dependency든 사용자 승인 전 blocking |
| message bus | 설계/구현 커밋 분리 | trailer parse와 INDEX 상태 비교 | trailer·보드 불일치 |
| CI portability | attachment store oracle이 OS 구분자와 무관해야 함 | Jira attachment store 단독 테스트를 Windows와 현재 host에서 실행 | 이번 변경과 무관한 filesystem 실패는 분리 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 현재 tab type/order는 `skills,mcp,providers`, initial은 `skills` | `catalogSelection.ts:7,13`; `ExtensionsCatalogView.tsx:27` |
| ko/en tab label은 `스킬/MCP/연결`, `Skills/MCP/Connections` | `resources/ko.ts:187`; `resources/en.ts:188` |
| renderer의 현재 locale 공개 타입과 `useI18n` 반환값은 ko/en뿐이다 | `shared/i18n/datetime.ts:11`; `shared/i18n/index.ts:41-43` |
| provider list/detail icon과 title은 각각 `power`·`provider.label`로 고정 | `CustomizeList.tsx:118`; `ProviderDetail.tsx:51` |
| `ProviderInfo`에는 presentation field가 없다 | `shared/ipc.ts:1729` |
| Plugin 표시 producer는 `PluginBinding→pluginRows→connectionInfo`다 | `deployment/plugins.ts`; `deployment/connections.ts:45`; `connection-views.ts:59` |
| cached tool name은 auth invalid에서도 유지되고 server는 valid일 때만 registry에 있다 | `deployment/plugins.ts:40`과 기존 테스트 |
| Temp SSOT는 `resolve(os.tmpdir(), PRODUCT_SLUG)`다 | `infra/config/temp-path.ts:8`; `shared/product.ts` |
| `BoundAuth.request`는 origin-relative path, string body, binary response, maxBytes를 지원한다 | `contracts/auth.ts:311` |
| outbound binary/multipart body는 지원하지 않는다 | `AuthenticatedRequest.body?: string` |
| explicit `readOnlyHint:true`만 approval allowlist에서 제외된다 | `adapters/runtime-tool-policy.ts:17-28` |
| Runtime Tool result는 `content`, `isError`, `structuredContent`를 지원한다 | `adapters/runtime-tools.ts:35` |
| Jira package 0.34.0은 community-maintained, MIT, gitHead `ab2b534…`다 | package `package.json`·`LICENSE` |
| Jira pinned source URL은 `https://github.com/b1ff/atlassian-dc-mcp/tree/ab2b534bafefa4666feca463e79824dadb797ff3/packages/jira`다 | package `repository.directory`·`gitHead` |
| default glyph source는 [`electrical_services`](https://fonts.google.com/icons?selected=Material+Symbols+Outlined:electrical_services:FILL@0;wght@400;GRAD@0;opsz@24)이며 bundle provenance는 [`google/material-design-icons`](https://github.com/google/material-design-icons) Apache-2.0이다 | 사용자 URL·공식 repository/license |
| package source의 기본 surface는 14개이며 upload만 gateway-enabled 조건부다 | package `src/index.ts:31-195` |
| package 기본 API base는 `/rest`, page size는 25, search/get default fields가 있다 | package `src/jira-service.ts:45-85` |
| package validation endpoint는 `/api/2/myself`다 | package `MyselfService.ts:18-25` |

### upstream tool inventory와 native mapping

| 도구 | REST 의미 | annotation | 비고 |
|---|---|---|---|
| `jira_searchIssues` | `POST /rest/api/2/search` | read-only | JQL, default 25, max 100 |
| `jira_getIssue` | `GET /rest/api/2/issue/{key}` | read-only | default fields + parent/subtasks |
| `jira_getIssueComments` | `GET …/issue/{key}/comment` | read-only | startAt/maxResults |
| `jira_createIssue` | `POST /rest/api/2/issue?updateHistory=true` | approval | standard fields 뒤 customFields override |
| `jira_updateIssue` | `PUT …/issue/{key}?notifyUsers=true` | approval | 제공된 field만 전송 |
| `jira_postIssueComment` | `POST …/issue/{key}/comment` | approval | `{body: comment}` |
| `jira_updateIssueComment` | `PUT …/issue/{key}/comment/{id}` | approval | 기존 body 교체 |
| `jira_getTransitions` | `GET …/issue/{key}/transitions` | read-only | transition metadata |
| `jira_getIssueDevelopmentInfo` | issue numeric id 조회 후 `GET /rest/dev-status/1.0/issue/detail` | read-only | dataType/applicationType 유지 |
| `jira_transitionIssue` | `POST …/issue/{key}/transitions` | approval | `transition`, `fields`, top-level customFields |
| `jira_getIssueLinkTypes` | `GET /rest/api/2/issueLinkType` | read-only | 설치별 link type |
| `jira_linkIssues` | `POST /rest/api/2/issueLink` | approval | inward/outward 방향 설명 보존 |
| `jira_unlinkIssues` | `DELETE /rest/api/2/issueLink/{id}` | approval | 204→`data:null` |
| `jira_downloadAttachment` | metadata/issue 조회 뒤 same-origin content GET | approval | save=false 기본, local-write capability |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| catalog tab 선언 | `rg -e CatalogTab -e CATALOG_TABS app/src` | SSOT 1 + 소비자/테스트 | 순서 변경은 배열과 initial state 두 지점 |
| provider 표시 고정 icon | `rg 'name="power"' features/skills` | list/detail 2 | 양쪽을 같은 resolver로 바꾼다 |
| Plugin presentation 전달 경로 | `PluginBinding`, `pluginRows`, `ConnectionViewSource`, `ProviderInfo` 추적 | producer/bridge/wire 4단 | 어느 한 단계가 빠지면 조용히 소실된다 |
| Jira source 등록 호출 | package `src/index.ts` `registerTool` 전수 | 최대 15 | 기본 14 + 조건부 upload 1 |
| 기본 14 분류 | handler가 쓰는 method/local write 조사 | read 6 + remote mutation 7 + download 1 | approval exact set의 분모 |
| Temp root 호출부 | `rg getTemporaryFilesPath app/src` | 공통 helper 1, 복수 소비자 | 새 문자열 root를 만들지 않는다 |
| Auth request capability | `AuthenticatedRequest`와 request adapter 테스트 | text body/binary response | upload 제외·download 포함 근거 |

### 수치 / 전칭 표현 검산

- 재측정 수치: default tool 14, upstream conditional maximum 15, read-only 6, approval 8.
- 내역 합: REST 기본 13 + download 1 = 14. 6 read + 7 remote mutation + 1 local-write capable download = 14.
- “모든 Plugin” 반례: gate/harness/usage는 Plugin이 아니므로 default `electrical_services`·catalog body를 강제로 주지 않는다.
- “OS Temp” 반례: `%APPDATA%` 문자열은 정본이 아니며 Windows `os.tmpdir()` 결과를 사용한다.
- 문서 앵커/테스트 존재: closed-network guide §4, auth arch Plugin 절, IPC provider list 절, deployment/plugin/connection/catalog 테스트를 확인했다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: AR-04, SD-01.
- 현재 책임 소유자: 배포는 Auth/server만 만들고, app view mapper는 Auth descriptor를 `ProviderInfo`로 바꾸며, renderer는 고정 presentation을 덧씌운다.
- 현재 entry → flow: `createPluginBinding` → `pluginRows` → `connectionInfo` → `ProviderInfo` → `CustomizeList`/`ProviderDetail`.
- 현재 오류/정리: Auth invalid면 server remove, cached tool name은 남는다. presentation이 없으므로 손실을 감지할 계약도 없다.
- 직접 원인: Plugin config에서 UI까지 이어지는 icon/localized text/attribution field가 한 단계도 없다.

```text
Plugin(Auth + RuntimeToolServer)
  → ConnectionViewSource(category=plugin, toolNames)
  → ProviderInfo(Auth label/status/tools)
  → fixed power icon + Auth label
```

- Jira AS-IS: 외부 package는 자체 env/token/fetch/MCP server/filesystem gateway를 소유한다. Orca에는 Jira feature나 등록 binding이 없다.

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-01/02, AR-01/02/03.
- 표시 책임: shared catalog contract가 wire-safe shape를 소유하고, Plugin binding이 기본값을 정규화하며, renderer pure resolver가 locale를 선택한다.
- Jira 책임: `features/plugins/jira`가 source metadata, schema, REST mapping, envelope, attachment store, Runtime Tool descriptor를 소유한다.
- 인증 책임: deployment가 실제 origin과 PAT Auth를 선언하고 `BoundAuth`를 Jira context에 넘긴다. Jira feature는 raw credential을 받지 않는다.
- 오류/정리: HTTP·schema·size·filesystem 오류는 safe envelope로 끝나고 미공개 batch stage 전체를 정리한다. revoke/401은 기존 Auth change→binding sync로 server를 제거하고, Jira 403은 상태를 유지한 채 `forbidden` envelope로 끝난다.
- 유지: ProviderInfo compatibility kind, provider IPC 채널, runtime registry, approval policy, 공용 tabs 컴포넌트, default empty deployment.

```text
Plugin(Auth + RuntimeToolServer + catalog config)
  → normalized PluginCatalogPresentation
  → ConnectionViewSource(category=plugin, catalog)
  → ProviderInfo.catalog
  → locale/icon resolver
  → list title/icon + detail body/attribution

agent tool call
  → Jira Zod schema
  → request builder
  → BoundAuth.request(origin-relative, signal, maxBytes)
  → result envelope / attachment safe store
  → RuntimeToolResult(text JSON + structuredContent)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| presentation 소유 | renderer hard-code | shared config + binding normalization | 배포별 설정·i18n | AR-01 / VP-01…04 |
| tab UX | skills first, Connections label | Plugin first, visible Plugin label | 사용자 탐색 순서 | R-05 / VP-05 |
| Jira transport | 외부 process/env/fetch | native `BoundAuth.request` | 보안·취소·approval 통합 | AR-02 / VP-08…11 |
| Jira result | upstream `{success,data}`를 JSON text만 반환 | `{ok,tool,data-or-error}` + `isError` + structuredContent | agent 판별 가능성 | MD-03 / VP-09 |
| attachment | package gateway/env directory | canonical Orca Temp subtree의 staged all-or-nothing batch | 경로 정본·안전성·부분 publish 방지 | AR-03 / VP-12 |
| upload | conditional package capability | 미도입 | multipart/input-root 결정 없음 | D-009 / AC7 |
| deployment | Jira 없음 | typed recipe만, default empty 유지 | 실제 origin 추측 금지 | R-14 / VP-14 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/plugin-catalog.ts` | serializable catalog type·default icon constant | config/wire shape | main app + renderer |
| `app/deployment/plugins.ts` | trusted build config 정규화·binding lifecycle | `catalog?`→normalized binding | deployment composition |
| `app/connection-views.ts` | plugin-only presentation을 DTO로 투영 | source→`ProviderInfo.catalog` | provider handlers |
| renderer `pluginPresentation.ts` | locale/icon fallback pure logic | DTO+locale→render model | list/detail |
| `jira/source.ts` | package provenance·localized Jira catalog | constants | tools/deployment recipe |
| `jira/rest.ts` | base path·route·query·body·same-origin URL | operation→AuthenticatedRequest | service |
| `jira/service.ts` | 14 operation orchestration | validated input→domain result | tools |
| `jira/result.ts` | safe error/success envelope·size cap | raw result/error→MCP result | tools |
| `jira/attachment-store.ts` | path sanitize·exclusive stage write·atomic batch publish·stale-stage cleanup | bytes+metadata→published batch | service |
| `jira/tools.ts` | descriptor·schemas·handlers | Jira context/options→server | deployment |

## 10. 계약 / 타입 / 강제 지점

### 핵심 타입

```ts
export type PluginCatalogIconName =
  | 'electrical_services'
  | 'power_settings_new'
  | 'link'
  | 'description'
  | 'memory'
  | 'language'

export type LocalizedPluginText = Readonly<{
  ko: string
  en: string
  [locale: string]: string
}>

export interface PluginCatalogAttribution {
  readonly source: string
  readonly version: string
  readonly githubUrl: string
  readonly license?: string
}

export interface PluginCatalogPresentation {
  readonly icon: PluginCatalogIconName
  readonly title?: LocalizedPluginText
  readonly body?: LocalizedPluginText
  readonly attribution?: PluginCatalogAttribution
}

export type PluginCatalogPresentationInput =
  Omit<PluginCatalogPresentation, 'icon'> & { readonly icon?: PluginCatalogIconName }

// Input이 없더라도 PluginBinding에는 normalized catalog가 항상 있다.
// ProviderInfo에서는 plugin category만 catalog를 갖고 다른 connection category는 undefined다.

export type JiraErrorCode =
  | 'invalid_input'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'request_too_large'
  | 'response_too_large'
  | 'tool_output_too_large'
  | 'attachment_too_large'
  | 'unsafe_attachment_url'
  | 'filesystem_error'
  | 'cancelled'
  | 'transport_error'
  | 'invalid_response'
  | 'jira_error'

export type JiraToolEnvelope =
  | { ok: true; tool: JiraToolName; data: unknown }
  | { ok: false; tool: JiraToolName; error: {
      code: JiraErrorCode
      message: string
      status?: number
      details?: { errorMessages?: readonly string[]; errors?: Readonly<Record<string, string>> }
    } }

export interface JiraPluginContext {
  readonly authId: string
  readonly label: string
  readonly origin: string
  request(req: AuthenticatedRequest, signal?: AbortSignal): Promise<AuthenticatedResponse>
}

export interface JiraToolOptions {
  readonly apiBasePath?: string       // default '/rest'; context path 포함 가능
  readonly defaultPageSize?: number   // default 25, hard range 1..100
  readonly maxAttachmentBytes?: number // 25 MiB hard ceiling보다 낮추기만 가능
}

export interface JiraDownloadedAttachment {
  readonly id?: string
  readonly filename: string
  readonly mediaType?: string
  readonly size: number
  readonly savedPath?: string
  readonly encoding?: 'base64' | 'text'
  readonly content?: string
  readonly contentOmittedReason?: 'inline_file_limit' | 'tool_output_limit'
}

export interface JiraDownloadData {
  readonly count: number
  readonly attachments: readonly JiraDownloadedAttachment[]
  readonly skipped: readonly { id?: string; filename?: string; reason: 'call_limit' }[]
}
```

- config input에서는 `icon`이 optional이고 binding 결과에서는 default `electrical_services`로 채운다.
- `title`·`body`는 각각 optional이다. 존재하면 ko/en 두 키가 compile-time 필수이며 `normalizePluginCatalogPresentation`이 공백·unsupported icon을 binding 생성 시 거부한다.
- `resolveLocalizedPluginText(text, locale: string)`는 추가 locale의 exact/base fallback을 순수 함수로 지원한다. production caller인 `useI18n`은 이번 범위에서 계속 `ko|en`만 넘긴다.
- `PluginBinding.catalog: PluginCatalogPresentation`은 항상 채운다. `ProviderInfo.catalog?`는 plugin category에만 투영하고 다른 category와 기존 fixture는 undefined다.
- Jira envelope는 `content[0].text = JSON.stringify(envelope)`와 `structuredContent = envelope`를 같은 객체에서 만든다.
- Jira error details는 Jira의 `errorMessages`·`errors`만 크기 제한해 담는다. response header, Authorization, request body 전체, arbitrary HTML은 담지 않는다.

### 강제 지점 registry

| EP | 계약/필드 | SSOT | 누가/언제 강제 | 실패 의미 |
|---|---|---|---|---|
| EP-01 | catalog input shape | `shared/plugin-catalog.ts` | deployment compile + binding normalize 시 | config drift |
| EP-02 | default `electrical_services` | `DEFAULT_PLUGIN_CATALOG_ICON` | `createPluginBinding` 1회 | 미설정 Plugin 오표시 |
| EP-03 | binding→row 전달 | `pluginRows` | boot source 조립 | presentation 유실 |
| EP-04 | row→wire 전달 | `connectionInfo` | list/state snapshot | IPC 유실/비Plugin 오염 |
| EP-05 | list icon/title | `CustomizeList` render model | 목록 render | list/detail 불일치 |
| EP-06 | detail icon/title/body/attribution | `ProviderDetail` render model | 상세 render | 요구 정보 누락 |
| EP-07 | `electrical_services` SVG path·glyph map | `Icon.tsx` | icon render | glyph/축 불일치 |
| EP-08 | locale fallback | renderer pure resolver | 매 render | 언어 drift |
| EP-09 | visible tab order/label | `CATALOG_TABS` + i18n resources | tabs render | 순서/명칭 회귀 |
| EP-10 | initial Plugin tab | `ExtensionsCatalogView` initial state | mount | 첫 화면 회귀 |
| EP-11 | Jira source/version/gitHead/repo/license | `jira/source.ts` | build/test | provenance drift |
| EP-12 | Jira localized catalog | `JIRA_CATALOG_PRESENTATION` | binding recipe | 출처/본문 누락 |
| EP-13 | exact tool names/annotations | `jira/tools.ts` descriptor | server creation | agent/approval drift |
| EP-14 | Zod input bounds | `jira/tools.ts` schemas | handler entry | 과대/모호 입력 |
| EP-15 | route/query/body builders | `jira/rest.ts` | request build | upstream 의미 drift |
| EP-16 | Auth definition/probe/base path example | deployment guide fixture | compile/boot | 인증 불가/URL 중복 |
| EP-17 | authenticated same-origin request | `BoundAuth.request` adapter seam | each remote call | credential/origin 우회 |
| EP-18 | envelope/error/redaction/pre-publish output budget | `jira/result.ts` | handler return 확정과 save publish 전 | agent 오판/비밀 유출/orphan batch |
| EP-19 | attachment content URL same-origin | `jira/rest.ts` | binary request 전 | SSRF/origin 탈출 |
| EP-20 | canonical Temp/sanitize/exclusive stage/result-ready commit/atomic batch publish/cleanup | `jira/attachment-store.ts` + service commit 순서 | save 시와 store 준비 시 | traversal/overwrite/부분·orphan publish/잔여 stage |
| EP-21 | download count/byte/inline cap | schema+service+store | selection/read/write 시 | memory/disk 폭증 |
| EP-22 | server 1회 생성·valid add/invalid remove | existing binding + Jira factory | boot/auth change | stale tool/respawn churn |
| EP-23 | default empty + docs/current-state sync | deployment test/docs | build/release | 가짜 endpoint/계약 drift |
| EP-24 | 모든 manifest/lock 신규 dependency 0 + upstream product import 0 | `app/package.json`·lockfile·product source | dependency gate/build 시 | 신규 package 또는 reference package runtime 결합 |
| EP-25 | 요청별 인증 실패 status | `AuthenticatedRequest`/`AuthProbe.authFailureStatuses` + requester 기본값 + probe outcome | Jira common request policy, `AuthenticatedRequester`, `LoginService.resume`가 요청 생성·응답 수신·복원 실패 시 강제 | Jira tool/probe 403을 만료로 오독하거나 기존 소비자의 403 강등 회귀 |
| EP-26 | Jira User-Agent/XSRF header | `JIRA_USER_AGENT` + Jira common headers | Auth probe·기본·개발정보·첨부 request 생성 시 강제 | Chromium Mozilla UA가 서버에 도달하거나 probe/특수 요청만 header 누락 |

- 같은 규칙의 SSOT: default icon은 shared constant 하나, locale fallback은 renderer pure function 하나, Jira name inventory는 `JIRA_TOOL_NAMES` 하나, source metadata는 `JIRA_SOURCE` 하나다.
- 선택적 필드 의미: config input의 `catalog===undefined`는 legacy Plugin default 생성, wire의 `catalog===undefined`는 non-Plugin 연결이다. `title/body===undefined`는 각각 Auth label fallback/본문 없음, `license===undefined`는 license 행 숨김이다.
- 외부 SDK 경계: upstream zod 3/MCP SDK 타입은 가져오지 않는다. tool name·입력 필드·기본값·request behavior만 현재 zod 4/RuntimeTool 타입으로 다시 선언하고 D-016의 안전 delta는 fixture에서 별도로 고정한다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/plugin-catalog.ts` (신규) | catalog wire types/constants | icon allowlist, localized text, attribution, default | type fixture/pure test |
| `app/src/shared/ipc.ts` | provider DTO | optional `catalog` 추가 | protocol/typecheck |
| `app/src/main/app/deployment/plugins.ts` | binding config | `catalog?` input과 default normalize | existing unit 확장 |
| `app/src/main/app/deployment/connections.ts` | source bridge | plugin row에 catalog 전달 | wiring test |
| `app/src/main/app/connection-views.ts` | wire mapper | plugin-only catalog copy | category matrix |
| `app/src/renderer/src/shared/ui/Icon.tsx` | glyph | `electrical_services` inline path와 public-name mapping | SVG render/hash |
| `features/skills/lib/pluginPresentation.ts` (신규) | locale/icon/title resolver | fallback와 render model | pure table |
| `catalogSelection.ts`·`ExtensionsCatalogView.tsx` | tab contract | order·label key·initial provider | selection/render |
| `CustomizeList.tsx`·`ProviderDetail.tsx` | presentation consumer | localized title/icon/body/provenance | render tests |
| ko/en resources | visible label/attribution headings | 플러그인, source/version/GitHub/license | key typecheck/render |
| `features/plugins/jira/source.ts` (신규) | provenance/catalog SSOT | 0.34.0/gitHead/MIT/pinned URL/ko-en copy; icon은 생략해 shared default 사용 | exact constant test |
| `features/plugins/jira/rest.ts` (신규) | Jira HTTP mapping | path/query/body/default fields/same-origin | request table |
| `contracts/auth.ts`·`features/auth/{authenticated-request,login}.ts` | 요청별 인증 실패 의미 | `AuthProbe`가 request header/status policy를 재사용, 기본 401/403 유지, Jira `[401]`, resume 403 grant 보존 | default/override/probe/resume status table |
| `features/plugins/jira/service.ts` (신규) | operation orchestration | 14 tool behavior, pagination, download selection | fake request integration |
| `features/plugins/jira/result.ts` (신규) | agent message | envelope, 204, error codes, pre-publish output budget/inline omission/redaction | unit table |
| `features/plugins/jira/attachment-store.ts` (신규) | file safety | canonical root, sanitize, begin/stage/publish/abort transaction, atomic directory publish, stale-stage cleanup | temp fixture |
| `features/plugins/jira/tools.ts` (신규) | Runtime Tool server | names, descriptions, zod 4 schemas, annotations, handlers | descriptor/handler test |
| Jira `*.test.ts` (신규) | direct evidence | package semantics·filesystem·result·approval | VP-07…25 |
| deployment wiring fixture | typed recipe | Jira Auth/binding shape, default empty 회귀 | type/runtime |
| `app/package.json`·lockfile·product import sweep | dependency boundary | 모든 신규 npm dependency 0과 `@atlassian-dc-mcp/*` product import 0 유지 | VP-26 |
| docs | current contract | IPC/auth/persistence/rendering/closed-network recipe | inventory/link check |

### 테스트 가능성

- electron/DB/native 의존부와 분리: locale resolver, route builder, envelope mapper, same-origin parser, path sanitizer를 순수 파일로 둔다.
- HTTP는 `BoundAuth.request` compatible fake를 주입하고 method/path/query/body/signal/maxBytes를 관측한다.
- filesystem은 attachment store factory의 test-only root 주입으로 각 테스트를 격리한다. production factory만 인자 없이 `getTemporaryFilesPath()`를 호출하며 실제 사용자 Temp는 테스트에서 쓰지 않는다.
- `createJiraToolServer(ctx, service)` 하위 factory를 두어 descriptor/handler만 검증하고, production `jiraTools(ctx, opts)`는 실제 service를 한 번 만든다.
- source package 파일을 테스트가 `node_modules`에서 읽지 않는다. 기대표는 plan과 제품 상수에 고정해 설치 유무와 무관하게 돈다.

### Jira 요청·결과 세부

- `JIRA_CATALOG_PRESENTATION_INPUT`은 icon을 생략해 shared `electrical_services` default를 실제 production path에서 쓴다.
- Jira default title은 ko/en 모두 `Jira Data Center`다. body는 이슈·댓글·전환·링크·첨부 기능과 “community-maintained, Atlassian 비공식” 사실을 각 언어로 평문 표시한다.
- `jiraTools`는 `authToolServerId(ctx.authId)`와 `connectorId=ctx.authId`를 사용한다. deployment가 server id를 다시 적는 표면은 만들지 않는다.
- default search fields: `summary,description,status,assignee,reporter,priority,issuetype,labels,updated`.
- default get issue fields: search defaults + `parent,subtasks`.
- Jira requests set `X-Atlassian-Token: no-check`; `Authorization` is never supplied by Jira code and remains `BoundAuth` presentation responsibility.
- Jira requests set `User-Agent: Orcinus-Orca-Jira/0.34.0`; 공통 header 상수가 Auth probe·기본 14개·dev-status·attachment content 경로에 같은 값을 적용한다.
- `AuthenticatedRequest.authFailureStatuses`는 요청별 401/403 좁은 집합이며 미지정 기본값은 `[401, 403]`이다. `AuthProbe`도 같은 header/status policy를 전달한다. Jira는 `[401]`을 지정해 403 권한 오류가 Auth 상태를 바꾸지 않게 하고, `resume`은 이 비인증 403을 verified로 만들지 않으면서 기존 grant를 보존한다.
- issue/comment/link/attachment 식별자는 path segment마다 percent-encode하고 query는 `AuthenticatedRequest.query`로 분리한다. raw string concatenation으로 query를 만들지 않는다.
- create에서 customFields는 upstream처럼 standard fields 뒤에 merge해 명시 override를 허용한다.
- transition은 `{transition:{id}, fields?}`를 만들고 customFields를 top-level에 merge한다.
- development info는 먼저 issue의 numeric `id`를 읽고 `dataType='pullrequest'`, `applicationType='stash'`를 기본으로 `/dev-status/1.0/issue/detail`을 호출한다.
- link 도구 설명과 payload는 upstream의 inward/outward 방향을 그대로 보존한다.
- 0.34.0 호환 fixture는 tool 이름·입력 필드·기본값·method/path/query/body를 고정한다. package보다 엄격한 selector XOR, page 100, attachment 10, byte/output cap, fixed save field, Orca envelope는 D-016의 의도한 delta로 별도 케이스를 둔다.
- 204/empty successful response는 parse error가 아니라 `data:null`이다.
- non-2xx는 status와 bounded Jira error object를 safe error code로 바꾼다. Jira의 401 상태 강등과
  요청별 인증 실패 판정은 기존 `BoundAuth.request`가 소유하고, 403은 `forbidden` 결과로 보존한다.
- status mapping은 401=`unauthenticated`, 403=`forbidden`, 404=`not_found`, 409=`conflict`, 429=`rate_limited`, 나머지 non-2xx=`jira_error`다. transport/abort/parse/size/filesystem은 각 전용 code를 쓴다.
- attachment `bean.content` absolute URL은 파싱 후 Auth origin과 origin equality를 확인하고 path+query만 request에 넘긴다.
- store는 `prepareTemporaryFilesPath()`로 공통 root를 준비하고 `jira/<auth-segment>/<selector-segment>` 각 ancestor를 `lstat`/`realpath`로 확인한다. symlink·junction·root 이탈은 거부한다.
- `save:true`는 `<selector>/.staging/<request-id>/`를 배타 생성하고 선택된 모든 filename을 basename/Windows reserved name/separator/control 문자 규칙으로 sanitize한 뒤 `open('wx', 0o600)`으로 쓴다. 하나라도 실패·취소하면 handle을 닫고 stage 전체를 지우며 final path를 반환하지 않는다.
- 모든 파일 write/close가 성공하면 고유 `<batch-id>`와 final path를 먼저 확정하되 아직 공개하지 않는다. result mapper는 attachment source 순서대로 inline을 넣어 보고, serialized 2 MiB budget을 넘기는 optional content는 `tool_output_limit`으로 바꾼다. 필수 metadata·예정 `savedPath`만으로도 상한을 넘으면 `tool_output_too_large`로 stage를 abort한다.
- bounded success envelope가 먼저 완성된 뒤에만 stage directory를 같은 filesystem의 `<batch-id>/`로 한 번 rename해 publish하고, 미리 만든 동일 envelope를 반환한다. rename 실패는 success envelope를 버리고 stage cleanup 뒤 `filesystem_error`가 된다. 다음 store 준비는 `.staging` 아래 24시간이 지난 검증된 real directory만 정리하고 symlink·현재 stage·published batch는 건드리지 않는다.
- `issueKey`와 `attachmentId`는 정확히 하나만 허용한다. `saveName`은 단일 attachment 선택에서만 허용한다.
- Orca descriptor는 fixed safe store가 있으므로 download의 `save`·`saveName` schema를 항상 노출한다. `save` default는 upstream과 같이 false다.

## 12. End-to-end 영향

### producer → consumer

```text
deployment catalog literal
  → createPluginBinding(default normalize)
  → pluginRows
  → connectionInfo
  → ProviderInfo.catalog over existing provider IPC
  → renderer locale/icon resolver
  → list/detail

Jira input
  → zod schema
  → operation service
  → origin-relative AuthenticatedRequest
  → Auth transport
  → bounded envelope mapper
  → Runtime Tool adapter/agent

download save:true
  → metadata + binary → hidden stage
  → bounded success envelope preflight
  → atomic batch publish
  → preflighted Runtime Tool result
```

- producer 기준: deployment catalog literal과 Jira source constant가 정본이다. renderer는 Jira id를 보고 별도 문구를 만들지 않는다.
- consumer 파생 규칙: current locale, Auth label fallback, status/auth actions만 renderer가 파생한다.
- `ProviderInfo.label`은 Auth label 정본으로 유지한다. localized catalog title은 표시 이름이지 vault/auth id를 바꾸지 않는다.
- tool name은 descriptor에서 캐시한 완전 이름을 계속 쓴다. catalog title/source가 server identity에 개입하지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| provider list/state IPC | optional field 추가, 기존 consumer는 무시 가능 | AC1·AC6 |
| gate login/principal selector | `ProviderInfo` 구조 확장뿐, kind/status 의미 불변 | AC6 |
| catalog order/filter | initial tab만 변경, provider sort/row count 불변 | AC5·AC6 |
| RuntimeToolRegistry | Jira binding이 있을 때 server 1개/14 tools 증가 | AC7·AC14 |
| approval set | Jira non-read-only full names 8개 증가 | AC13 |
| adapter extension snapshot | registry revision은 auth 실제 add/remove에서만 변경 | AC14 |
| default OSS boot | binding 0이라 registry/provider row 증분 0 | AC14 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: deployment가 Auth를 bind하고 `jiraTools`를 한 번 호출한 뒤 catalog와 함께 `createPluginBinding`에 넘긴다.
- 잘못된 build-time catalog config: binding 생성이 registry mutation 전에 동기 실패한다. production fallback으로 숨기지 않고 typecheck/fixture에서 출하를 막는다.
- 인증 전: descriptor와 catalog는 메모리에 있으나 registry에는 server가 없다.
- 인증 성공: 기존 Auth subscription이 binding `sync()`를 불러 같은 server object를 add한다.
- 취소/중단: context signal을 모든 remote request와 binary read에 전달한다. abort는 `cancelled` error envelope로 끝낸다.
- revoke/401: Auth change가 sync를 일으켜 server id를 remove한다. 임의 재로그인이나 token refresh를 Jira module이 수행하지 않는다.
- Jira 403: tool 요청 결과는 `forbidden`으로 매핑하지만 grant revision/status를 바꾸거나 binding sync를 일으키지 않는다. Auth 복원 probe의 403도 verified 성공은 아니지만 grant/registry를 보존한다. 공용 Auth 요청의 미지정 기본 403 강등은 유지한다.
- download 실패: destination을 먼저 공개하지 않는다. 한 호출의 모든 save 대상은 숨은 stage에 모으고, 중간 fetch/write/close/abort 실패 시 stage 전체를 제거한다. bytes·필수 metadata·예정 path와 2 MiB 이하 success envelope를 모두 확정한 경우에만 directory rename으로 batch를 publish한다. publish 뒤에는 output-cap 판정을 다시 하지 않는다.
- retry: API 호출은 자동 재시도하지 않는다. mutation 중복을 피하고 에이전트가 status/error를 보고 결정한다.
- restart: Jira catalog/binding은 build config에서 다시 구성된다. Temp attachment는 OS temp 파일이며 앱 DB에 영속 참조를 만들지 않는다. crash로 남은 `.staging` 중 24시간 초과분은 다음 store 준비가 정리한다.
- 다중 저장소 쓰기: Jira remote mutation과 Orca local DB를 함께 쓰지 않는다. download save는 remote read 후 한 canonical Temp store의 stage 하나만 쓰고 batch directory rename으로 공개한다.
- 문서 산출 상태 사본: plan READY와 INDEX `plan/READY/Codex` 두 곳을 같은 설계 커밋에서 갱신한다.

## 14. 성능 / 상한 / 최적화

- search/comments `maxResults`: 기본 25, 최소 1, 최대 100.
- JSON request body: 직렬화 후 최대 1 MiB. 넘으면 remote call 전에 `request_too_large`.
- JSON/text response: `BoundAuth.request.maxBytes` 2 MiB. 넘으면 `response_too_large`.
- agent JSON text/structured payload: 직렬화 2 MiB. 일반 JSON의 필수 data가 넘으면 `tool_output_too_large` error envelope다. download optional inline은 publish 전에 source 순서대로 예산을 배분하고, 다음 content가 상한을 넘기면 metadata를 유지한 채 `tool_output_limit`으로 생략한다.
- attachment: 한 파일 최대 25 MiB, issue 기준 한 호출 최대 10개, 순차 download. 최악 stage/final disk 증분은 rename이 copy가 아니므로 250 MiB/call이고 peak binary memory는 25 MiB + envelope다.
- inline content: 기본 `none`; `text|base64` 요청 시 파일당 최대 1 MiB. 파일 자체가 넘으면 `inline_file_limit`, 합산 serialized budget이 넘으면 `tool_output_limit`으로 생략한다. 1 MiB base64 1개는 2 MiB envelope 안에 들지만 여러 파일의 inline은 자동 누적하지 않는다.
- issue attachment가 10개를 넘으면 첫 10개만 조용히 고르지 않는다. result에 skipped count와 id/name을 싣는다.
- no cache: Jira 응답은 권한·상태 변화가 잦고 package도 cache하지 않는다.
- UI: locale resolver와 small catalog object는 render 시 O(locale fallback keys), 별도 store/cache가 필요 없다.

## 15. 외부 구현 포트 / 문서 계약

- 폐쇄망 배포가 구현할 값: stable Jira Auth id, real `origin`, `apiBasePath`(기본 `/rest`), PAT method, localized catalog override가 필요하면 그 값.
- 배포가 쓰는 port: `AuthDefinition` + `createPluginBinding` + `jiraTools`; raw token/Authorization header를 Plugin에 넘기지 않는다.
- 구현 문서: `docs/guides/closed-network-extensions.md` §4에 Jira recipe를 Confluence와 나란히 추가한다.
- current-state architecture는 도구 개수를 복제하지 않고 `JIRA_TOOL_NAMES`/descriptor를 정본으로 가리킨다. 배포 guide는 조립법과 제외된 upload 의미를 설명한다.
- shape 검증: 가이드의 Jira Auth와 binding 예제를 `deployment-wiring.test.ts`의 실제 `AuthDefinition`, `PluginDeploymentDeps`, `PluginBinding` 타입에 대입한다.
- semantics 검증: probe path, context base path, 14 names, annotations, default empty를 production factory와 대조한다.
- 카탈로그 source metadata: package 명·0.34.0·MIT·`https://github.com/b1ff/atlassian-dc-mcp/tree/ab2b534bafefa4666feca463e79824dadb797ff3/packages/jira`를 `jira/source.ts` 하나에서 가져온다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| Plugin은 `BoundAuth.request`와 자기 옵션만 받는다 | auth arch §Plugin | §9·§11 Jira context | 유지 |
| server는 부팅 1회 만들고 sync는 add/remove만 한다 | 0188·`plugins.ts` | §13 lifecycle | 유지 |
| provider IPC와 kind compatibility를 유지한다 | 0188 D-029/D-030 | D-006·§10 optional field | 유지 |
| 앱 로그인·모델·서비스 연결은 한 탭이다 | 0181 | D-006·AC6 | 내부 구조 유지, 보이는 이름만 Plugin으로 변경 |
| 기본 배포는 Auth/Plugin 0개다 | deployment current state | D-014·AC14 | 유지 |
| remote request는 Chromium stack 단일 경로다 | main AGENTS | D-008·EP-17 | 유지 |
| 신규 dependency는 사용자 승인 대상이다 | app AGENTS | D-015 | dependency 0으로 유지 |
| Temp root/product slug는 `orcinus-orca`다 | 0225·`temp-path.ts` | D-012 | 유지; 사용자 경로 오탈자 교정 |
| 현재 상태 문서만 arch에 쓴다 | docs AGENTS | §18 docs | delta는 plan에만, arch는 최종 상태만 갱신 |
| 0160 Confluence source migration | historical plan/current code | D-008·§15 | 절차 재사용, old V/구현 세부는 상속하지 않음 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| package가 이후 버전에서 tool/schema를 바꾼다 | 0.34.0+gitHead를 고정하고 exact inventory/request fixture를 둔다 |
| arbitrary icon 요구가 생긴다 | 이번 allowlist는 안전한 additive contract다. 새 glyph는 type+inline path+license evidence로 추가한다 |
| localized body에 HTML이 들어온다 | plain text로만 render하고 Markdown/HTML API를 제공하지 않는다 |
| REST response가 agent context를 폭증시킨다 | page/response/output caps와 `response_too_large`/`tool_output_too_large`, optional inline omission을 둔다 |
| download content URL이 다른 host를 가리킨다 | exact origin equality 실패 시 다운로드를 거부한다 |
| 같은 filename이 기존 파일을 덮는다 | exclusive create + deterministic suffix, overwrite 0 |
| 다중 첨부의 중간 실패나 output-cap 판정이 파일만 남긴다 | 숨은 stage 전체 정리 + bounded success envelope 확정 + 같은 filesystem의 directory rename 순서로만 path 공개 |
| crash가 숨은 stage를 남긴다 | 다음 store 준비에서 24시간 초과 `.staging` real directory만 정리하고 published batch는 보존 |
| mutation timeout 후 서버에서 이미 반영됐을 수 있다 | 자동 retry 금지, status/message를 보존해 에이전트가 재조회한다 |
| dev-status endpoint가 Jira 설치에서 꺼져 있다 | 해당 tool만 safe error; 연결/다른 tools는 유지한다 |
| display title과 Auth label이 달라 혼동한다 | detail의 id/origin/auth 상태는 기존대로 유지한다 |
| upload 누락을 migration 실패로 오해한다 | catalog/guide/tool inventory에 upstream conditional 제외 사유를 명시한다 |

- 되돌리기 어려운 결정: `ProviderInfo.catalog` wire shape와 tool names. 모두 additive/기존 upstream 이름 유지라 rollback 가능성을 높였다.
- 신규 의존성: 종류를 불문하고 없음. 특히 reference인 `@atlassian-dc-mcp/jira`를 package.json/lockfile에 추가하거나 제품 source에서 import하지 않는다.
- 라이선스: Jira reference source는 MIT, bundled Material glyph source는 Apache-2.0이다. native 코드는 의미를 재구현하고 source/version/link를 표시한다.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/plugin-catalog.ts` (신규)
- `app/src/shared/ipc.ts`
- `app/src/main/app/deployment/{plugins,connections}.ts`와 테스트
- `app/src/main/app/connection-views.ts`와 테스트
- `app/src/main/features/plugins/jira/{source,rest,service,result,attachment-store,tools}.ts`와 테스트 (신규)
- `app/src/main/contracts/auth.ts`, `app/src/main/features/auth/authenticated-request.ts`와 테스트
- `app/src/renderer/src/shared/ui/Icon.tsx`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `app/src/renderer/src/features/skills/lib/{catalogSelection,pluginPresentation}.ts`와 테스트
- `app/src/renderer/src/features/skills/components/customize/{ExtensionsCatalogView,CustomizeList,ProviderDetail}.tsx`와 render 테스트
- `docs/guides/closed-network-extensions.md`
- `docs/IPC_CONTRACT.md`
- `docs/arch/backend/{auth,persistence,security}.md`
- `docs/arch/frontend/rendering.md`
- `docs/generated/inventory.md` — generator가 실제 inventory delta를 요구할 때만 갱신
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md`, `app/src/main/AGENTS.md`, `app/src/renderer/AGENTS.md`, `docs/AGENTS.md`.
- ABI/네트워크 제약: DB가 필요 없는 Vitest 대상만 직접 실행해 `pretest` ABI flip을 피한다. 실제 Jira/Google network는 단위 테스트 필수가 아니다.
- 기본 정적 gate: `cd app; npm run lint`; `npm run typecheck`; `node scripts/check-doc-inventory.mjs --check`; repository root `git diff --check`.
- 관련 테스트 예시:

```text
npx vitest run src/main/features/plugins/jira src/main/app/deployment/plugins.test.ts src/main/app/deployment/deployment-wiring.test.ts src/main/app/connection-views.test.ts src/main/adapters/runtime-tool-policy.test.ts src/renderer/src/features/skills/lib/catalogSelection.test.ts src/renderer/src/features/skills/lib/pluginPresentation.test.ts src/renderer/src/features/skills/components/customize/CustomizeList.render.test.ts src/renderer/src/features/skills/components/customize/ProviderDetail.render.test.ts
```

- ΔV1 관련 테스트: `npx vitest run src/main/features/auth/authenticated-request.test.ts src/main/features/plugins/jira/rest.test.ts src/main/features/plugins/jira/result.test.ts src/main/features/plugins/jira/attachment-store.test.ts`.

- 구조 sweep: manifest의 dependencies/devDependencies/optionalDependencies/peerDependencies와 lockfile dependency entry 추가 0, product source의 `@atlassian-dc-mcp/*` import 0, `jira_uploadAttachment` product descriptor 0, Jira names exact 14, `name="power"` provider presentation 잔여 0, `ProviderInfo.catalog` producer/consumer 차집합 0.
- 사람 실기 AC15:
  1. ko/en에서 Jira title/body/source/version/GitHub와 `electrical_services` icon 확인.
  2. 탭 순서와 첫 탭 확인, 기존 gate/harness/usage 연결 행 관리 확인.
  3. real Jira DC의 지정된 테스트 프로젝트·폐기 가능한 이슈에 PAT로 연결하고, search/get/create/update/comment/transition/link/unlink 중 권한 가능한 동작을 확인한 뒤 생성한 테스트 자료를 정리.
  4. 작은 text와 binary attachment를 `save:false/true`로 확인하고 실제 저장 경로가 그 실행 환경의 `getTemporaryFilesPath()` 결과 아래 `jira\…`인지 확인. Windows 통상 예시는 `%LOCALAPPDATA%\Temp\orcinus-orca\jira\…`다.
  5. revoke 뒤 새 agent turn에서 Jira server가 빠지는지 확인.

## READY self-review

- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 이번 턴 결정을 보존한다.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다.
- [x] 조건절·이유절·유지/제외 요구를 임의로 숨기지 않았다.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다.
- [x] AS-IS와 TO-BE가 같은 축으로 작성됐다.
- [x] Delta의 각 변경이 구현 파일·AC로 추적된다.
- [x] 사라진 upstream upload 책임은 삭제가 아니라 조건부 비범위로 명시됐다.
- [x] 수치·외부 package version·도구 총량·현재 코드 앵커를 실측했다.
- [x] 각 AC가 행동, oracle, production path를 가진다.
- [x] 독립 기능이라 Baseline V를 만들었다.
- [x] 모든 NEW node에 REQUIRED pair, 영향받은 기존 목록/sync에 REGRESSION pair가 있다.
- [x] 각 pair에 경로·oracle·§10 분모가 있다.
- [x] 현재 산출물과 구현 산출물의 운영 gate를 분리했다.
- [x] 순수 locale/icon/path/schema/result 로직을 사람 실기로 미루지 않았다.
- [x] semantic 동작을 단순 파일 존재/개수만으로 판정하지 않는다.
- [x] 신규 contract의 SSOT·강제 지점·test seam이 있다.
- [x] 부팅/registry/provider/approval 기존 소비처를 열거했다.
- [x] producer와 consumer 양쪽 의미를 확인했다.
- [x] response/output/attachment 상한과 worst-case disk를 계산했다.
- [x] 다중 attachment의 중간 실패·취소·crash stage 정리와 publish 원자성을 정했다.
- [x] reference package의 의도한 호환 범위와 안전 delta, dependency/import 0을 별도 pair로 고정했다.
- [x] 게이트 명령이 현재 subtree 가이드와 충돌하지 않는다.
- [x] 본문 완성 후 ACTIVE 결정과 AC를 대조했다.
- [x] 산출물 문장 규칙을 적용했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 `handoff-impl/SKILL.md`다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: Plugin 표시 계약을 binding에서 정규화하고 기존 provider IPC에 additive field로
  전달하는 경계, Jira를 신규 dependency 없이 repository-owned Runtime Tool로 이식하는 경계, 첨부
  stage→bounded result→atomic commit 순서, 기본 OSS 배포 0개를 그대로 구현했다.
- 이견 / 현실성 문제: 제품 전체 소스 가드는 `.publish()` 호출을 artifact model tool 하나에만 허용한다.
  Jira batch의 개념적 publish는 유지하되 내부 메서드 이름을 `commit()`으로 좁혀 기존 경계를 보존했다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 실제 Jira 자격증명과 사람 UI 세션이 없어 AC15만 구현
  턴에서 관측하지 못했다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01 | catalog E2E 전달 | EP-01…06 (6) | **6/6** | `plugins.test`·`connection-views.test`·list/detail render | — |
| VP-02 | 기본/선택 icon | EP-02/05/06/07 (4) | **4/4** | `plugin-catalog.test`·`CustomizeList.render.test`·`ProviderDetail.render.test` | — |
| VP-03 | locale 보존/fallback | EP-04/05/06/08 (4) | **4/4** | `pluginPresentation.test` exact/base/ko/en 표 | — |
| VP-04 | Jira attribution | EP-06/11/12 (3) | **3/3** | `source.test`·`ProviderDetail.render.test` | — |
| VP-05 | 탭 순서/초기값 | EP-09/10 (2) | **2/2** | `catalogSelection.test` | — |
| VP-06 | 기존 네 category | EP-03/04/05/06 (4) | **4/4** | `connection-views.test` + 전체 renderer 회귀 | — |
| VP-07 | Jira inventory | EP-11/13/22 (3) | **3/3** | `tools.test` exact name/set/implementation | — |
| VP-08 | schema/REST 의미 | EP-14/15/16/17/21 (5) | **5/5** | `tools.test` field inventory/XOR + `rest.test` route table | — |
| VP-09 | 결과 envelope | EP-18 (1) | **1/1** | `result.test` text/structured/isError | — |
| VP-10 | PAT/probe/base path | EP-16/17 (2) | **2/2** | `deployment-wiring.test`·`rest.test` | — |
| VP-11 | bounds/redaction | EP-14/15/18/20/21 (5) | **5/5** | `result.test`·`service.test`·`tools.test` | — |
| VP-12 | 안전한 첨부 commit | EP-18/19/20/21 (4) | **4/4** | `attachment-store.test`·`service.test`·`rest.test` | — |
| VP-13 | approval 정책 | EP-13/22 (2) | **2/2** | `tools.test` 6 read-only/8 approval exact set | — |
| VP-14 | auth sync/default 0 | EP-16/22/23 (3) | **3/3** | `plugins.test`·`deployment-wiring.test` | — |
| VP-15 | 실제 Jira/UI | EP-04/05/06/09/10/12/13/16/17/18/20/22 (12) | **11/12 코드 경계** | 기계 경계 green, 실제 Jira/UI 실기 미수행 | AC15 |
| VP-16 | 표시 system 경로 | EP-01…10 (10) | **10/10** | binding/wire/pure/render 조합 + 전체 suite | — |
| VP-17 | Jira lifecycle 경로 | EP-13…22 (10) | **10/10** | wiring/service/result/store/approval/sync 조합 | — |
| VP-18 | presentation 통합 | EP-01…06 (6) | **6/6** | producer/bridge/DTO/consumer fixture | — |
| VP-19 | Jira 호출 통합 | EP-13…18 (6) | **6/6** | fake `BoundAuth.request` + handler envelope | — |
| VP-20 | 첨부 통합 | EP-18…21 (4) | **4/4** | 중간 실패/output cap/commit 전 비가시성 | — |
| VP-21 | 기존 목록/sync 회귀 | EP-03/04/22 (3) | **3/3** | 기존 app/renderer suite + 전체 Vitest | — |
| VP-22 | locale/icon 단위 | EP-07/08 (2) | **2/2** | pure resolver + SVG path render | — |
| VP-23 | schema/route 단위 | EP-13…17 (5) | **5/5** | exact fields + route/body/query 표 | — |
| VP-24 | result 단위 | EP-18 (1) | **1/1** | success/error/size/redaction 표 | — |
| VP-25 | file safety 단위 | EP-19…21 (3) | **3/3** | traversal/junction/collision/stale/atomic fixture | — |
| VP-26 | native dependency 경계 | EP-24 (1) | **1/1** | `native-boundary.test` + manifest/lock diff/import sweep + build | — |

- §10에 없는데 같은 불변식이 필요했던 지점: 제품 전체의 artifact `.publish()` 유일성 가드 1곳.
  Jira batch API를 `commit()`으로 바꿔 `bootstrap.artifacts.test.ts`의 기존 단일 진입점 계약을 닫았다.
- 고유 강제 지점 합계: **24/24**. VP-15의 외부 실기만 구현자 관측에서 남았고, 해당 코드 강제
  지점은 모두 닫혔다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | `SELF_PASS` | catalog 값이 binding→DTO→두 UI에 동일 | M1 red 1 |
| VP-02 | REQUIRED | `SELF_PASS` | 기본 SVG와 custom map | M2 red 2 |
| VP-03 | REQUIRED | `SELF_PASS` | exact→base→ko→en 표 | M3 red 1 |
| VP-04 | REQUIRED | `SELF_PASS` | source/version/pinned URL/license | M4 red 2 |
| VP-05 | REQUIRED | `SELF_PASS` | order와 initial 독립 단언 | M5 red 1 |
| VP-06 | REGRESSION | `SELF_PASS` | 네 category DTO/전체 suite | 직접 회귀 oracle |
| VP-07 | REQUIRED | `SELF_PASS` | name/descriptor/implementation exact set | M6 red 3 |
| VP-08 | REQUIRED | `SELF_PASS` | field inventory·14 route·XOR/cap | M7 red 1 |
| VP-09 | REQUIRED | `SELF_PASS` | JSON parity·204 null·isError | M8 red 6 |
| VP-10 | REQUIRED | `SELF_PASS` | typed PAT recipe·probe·base path | M9 red 14 |
| VP-11 | REQUIRED | `SELF_PASS` | request/response/output cap·details redaction | M10 red 2 |
| VP-12 | REQUIRED | `SELF_PASS` | same-origin·junction·collision·atomic stage | M11 red 1 |
| VP-13 | REQUIRED | `SELF_PASS` | 6/8 approval exact set | M12 red 1 |
| VP-14 | REQUIRED | `SELF_PASS` | same server add/remove·default empty | M13 red 2 |
| VP-15 | REQUIRED | `SELF_BLOCKED` | 기계 경계만 관측 | 실제 Jira DC/UI 환경 없음 |
| VP-16 | REQUIRED | `SELF_PASS` | boot config→wire→locale render | M1/M3/M5 red |
| VP-17 | REQUIRED | `SELF_PASS` | Auth recipe→server→handler→revoke | M6/M8/M13 red |
| VP-18 | REQUIRED | `SELF_PASS` | producer/consumer contract fixture | M1 red 1 |
| VP-19 | REQUIRED | `SELF_PASS` | handler→fake request→envelope | M7/M8/M10 red |
| VP-20 | REQUIRED | `SELF_PASS` | metadata→binary→stage→preflight→commit | M11 red 1 |
| VP-21 | REGRESSION | `SELF_PASS` | category/sync 전체 회귀 | M13 red 2 |
| VP-22 | REQUIRED | `SELF_PASS` | pure locale/icon 표 | M2/M3 red |
| VP-23 | REQUIRED | `SELF_PASS` | exact tool fields/routes | M6/M7 red |
| VP-24 | REQUIRED | `SELF_PASS` | error/result/secret/output budget | M8/M10 red |
| VP-25 | REQUIRED | `SELF_PASS` | untrusted path/URL/store fixtures | M11 red 1 |
| VP-26 | REQUIRED | `SELF_PASS` | dependency/import/upload 0 + production build | M14 red 1 |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 — `connectionInfo` catalog 전달 제거 | VP-01·16·18 | 최초 | `connection-views.test` 1 | **잠김** |
| M2 — 기본 icon을 `power_settings_new`로 복귀 | VP-02·22 | 최초 | `plugin-catalog`+`plugins` 2 | **잠김** |
| M3 — ko/en fallback 순서 교환 | VP-03·16·22 | 최초 | `pluginPresentation.test` 1 | **잠김** |
| M4 — source version을 `0.34.1`로 drift | VP-04 | 최초 | `source.test` 2 | **잠김** |
| M5 — 탭 선두를 skills로 복귀 | VP-05·16 | 최초 | `catalogSelection.test` 1 | **잠김** |
| M6 — `jira_unlinkIssues` inventory 제거 | VP-07·17·23 | 최초 | `tools.test` 3 | **잠김** |
| M7 — search REST path 변경 | VP-08·19·23 | 최초 | `rest.test` 1 | **잠김** |
| M8 — error `isError` 제거 | VP-09·17·19·24 | 최초 | `result.test` 6 | **잠김** |
| M9 — 기본 API base에 `/jira` 중복 | VP-10 | 최초 | `rest.test` 14 | **잠김** |
| M10 — secret header redaction 제거 | VP-11·19·24 | 최초 | `result.test` 2 | **잠김** |
| M11 — attachment same-origin 검사 제거 | VP-12·20·25 | 최초 | `rest.test` 1 | **잠김** |
| M12 — create를 read-only로 변경 | VP-13 | 최초 | `tools.test` 1 | **잠김** |
| M13 — invalid auth registry remove 제거 | VP-14·17·21 | 최초 | `plugins.test` 2 | **잠김** |
| M14 — Jira upstream devDependency 추가 | VP-26 | 최초 | `native-boundary.test` 1 | **잠김** |
| N1 — 120자 절단 뒤 trailing dot 정리 누락 | 구현 중 신규 oracle | 최초 | `attachment-store.test` 1 red 후 수정 | **잠김** |
| N2 — known error/details의 cookie·proxy secret 노출 | 구현 중 신규 oracle | 최초 | `result.test` 단계별 2 red 후 수정 | **잠김** |
| N3 — Jira `.publish()`가 artifact 유일 진입점 가드를 침범 | 전체 suite 신규 oracle | 최초 | `bootstrap.artifacts.test` 1 red 후 `commit()`으로 수정 | **잠김** |

- 분모 검산: 선택 증거 **14** · 인용 변이 **0** · 새 oracle **3** = 표 행 **17**.
- 추가 직접 oracle: 14개 input field inventory, final batch collision 보존, lockfile entry 부재를
  상시 테스트로 추가했다.
- 덮개 회귀: 이전 라운드 없음. 심은 변이 원복 후 관련 **16파일/123케이스 green**.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문구·상태에 소비자가 있는가 | 있음 | ko/en 탭·source/version/license는 list/detail과 i18n resource가 함께 소비한다 |
| production seam 재배치가 cleanup scope를 깨뜨리지 않는가 | 보존 | Jira stage만 abort/cleanup하고 기존 artifact publication·DB를 건드리지 않는다 |
| 새 실패 경로가 §5 상태표에 있는가 | 있음 | invalid input·HTTP·size·filesystem·cancel은 `isError:true` envelope, save 실패는 stage abort다 |
| 실패가 “아무 일 없음”으로 보이지 않는가 | 통과 | 모든 handler 오류가 stable code/message를 가진 agent result로 반환된다 |
| 늦은 응답이 화면/registry를 되돌리지 않는가 | 통과 | 원격 호출은 turn signal을 전달하고 registry는 기존 Auth sync/동일 server identity를 유지한다 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 파일명 120자 절단이 끝의 `.`을 새로 만들 수 있었다 | ✅ 절단 뒤 Windows trailing 문자 제거로 순서 수정 | N1 red→green |
| 2 | `JiraToolError.details`가 message와 달리 secret redaction을 우회했다 | ✅ 최종 result mapper에서 key/value까지 bounded redaction | N2 red→green |
| 3 | write 성공 뒤 file handle close 실패를 무시했다 | ✅ close 오류도 batch 실패로 올리고 상위가 stage abort | `attachment-store.ts` write 경계 |
| 4 | Jira의 `.publish()` 이름이 기존 artifact publication 유일성 가드와 충돌했다 | ✅ 내부 API를 `commit()`으로 변경 | 전체 suite N3 red→green |
| 5 | 실제 Jira DC 권한·dev-status·binary와 최종 UI는 로컬 fixture로 대체할 수 없다 | ⚠️ AC15 사람 실기로 이관 | §19 체크리스트 |

### 설계 대비 명시적 차이

- plan과 다르게 구현한 것과 이유: stage의 원자 확정 메서드만 `publish()` 대신 `commit()`으로
  명명했다. 제품 전체에서 `.publish()`는 artifact model tool의 명시적 진입점이라는 기존 가드를
  보존하기 위한 이름 차이이며, result preflight 뒤 directory rename이라는 동작 순서는 같다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 대체물 없음 — 401/403 강등과 invalid remove는 기존 BoundAuth/Plugin sync 소유 | AC10·AC14 / M13 |
| 공유 | Jira server는 부팅 1회 인스턴스, 첨부 batch는 UUID별 독립 stage | AC12·AC14 / EP-20·22 |
| 재진입 | batch 상태가 open→published/aborted 단방향이고 중복 확정을 거부 | AC12 / store state fixture |
| 다른 무효화 축 | catalog는 build config, registry는 credentialChanged sync만 사용 | AC1·AC14 / EP-01·22 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | shared catalog/IPC, main Plugin wiring, renderer list/detail/tab/i18n/icon, `features/plugins/jira/` native module·tests, IPC/auth/persistence/security/rendering/폐쇄망 guide, INDEX |
| 실행 명령 | `npm run lint` · `npm run typecheck` · 대상 `npx vitest run …` · 전체 `npx vitest run` · `node --test scripts/*.test.mjs` · `npm run build` · `node scripts/check-doc-inventory.mjs --check` · dependency/import/upload/power sweeps · `git diff --check` |
| 관측한 게이트 산출 | lint **0 error/1 기존 warning** · typecheck 3구성 pass · 대상 **16파일/123케이스 pass** · 전체 Vitest **536파일/4,932케이스 pass, 1파일/1케이스 skip** · script **119/119 pass** · production build pass(기존 dynamic-import warning 1) · doc inventory/link pass |
| V-pair 자기확인 | `SELF_PASS` **25/26**, `SELF_BLOCKED` **1/26**(VP-15 실제 Jira/UI 실기) |
| 강제 지점 전수 | **24/24** |
| AC 자기보고 | **15/16** — AC15 사람 실기 대기 |
| 합계 검산 | ✅ **15** · ⚠️ **1** · ❌ **0** = **16** |
| 블로커 / 역질문 | 코드 블로커 없음. 검증자가 §19 AC15를 실제 Jira DC/ko·en UI에서 확인해야 한다 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 이전 구현 라운드 없음.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: catalog/Jira/attachment/dependency 축은 AC와
  EP가 있었다. artifact `.publish()` 이름 충돌은 기존 전역 회귀 가드가 추가로 발견했다.
- 반복 환경 한계: 실제 Jira DC endpoint/PAT와 사람 UI 세션이 없어 AC15는 반복 관측 불가.
- 현재 라운드 수: 1

---

## [구현자 기입] 설계 리뷰 (r2)

- 동의 / 그대로 진행: Jira 요청만 인증 실패 status를 `[401]`로 좁히고 공용 기본값 `[401, 403]`은
  유지했다. 모든 Jira 원격 요청은 한 공통 builder에서 `Orcinus-Orca-Jira/0.34.0`과 기존 XSRF
  header를 함께 받으며, attachment CI oracle은 실제 경로 의미를 OS 중립적으로 비교한다.
- 구현 중 발견한 PLAN_GAP: D-019와 달리 §11 결과 절에 이전 “401/403 강등” 문장이 한 줄 남아
  있었다. 구현 산출과 섞지 않고 설계 정합성 커밋 `914081b2`에서 401 강등·403 `forbidden`으로
  바로잡았다.
- 최초 r2 구현 뒤 독립 리뷰가 Auth probe가 path/method만 전달하고 `resume()`이 모든 비성공
  probe를 다시 만료시키는 PLAN_GAP을 발견했다. 규범 행은 `d0880910`에서 probe header/status
  policy, 보존 실패, 공통 API base까지 먼저 보강했고 이번 후속 구현은 그 READY 상태를 따랐다.
- 같은 리뷰의 cancellation error shape와 ProviderDetail 줄바꿈/긴 URL 누락은 기존 계약의 구현
  누락으로 판정해 회귀 oracle과 함께 닫았다.
- ACTIVE Decision과 충돌하는 구현: 없음. 실제 Jira DC와 사람 UI가 필요한 AC15는 계속 외부 실기다.

## [구현자 기입] 강제 지점 전수 (r2 · §10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-27 | Jira 401/403 의미 분리 | EP-25 (3) | **3/3** | requester default/override + AuthProbe policy 전달 + resume 보존 상태표 | — |
| VP-28 | Jira UA/XSRF 전 요청 | EP-26 (4) | **4/4** | probe·14개 기본·dev-status·attachment content header 표 | — |
| VP-29 | 403→grant/registry 유지→forbidden | EP-18/22/25 (3) | **3/3** | tool 403 mapper + probe 403에서 valid/unverified·registry 유지 | — |
| VP-30 | request policy/header 전송 경계 | EP-17/25/26 (3) | **3/3** | Auth presentation과 Jira headers가 tool/probe transport 입력에 도달 | — |
| VP-31 | default/override·header 단위 규칙 | EP-25/26 (2) | **2/2** | 기본 `[401,403]`, Jira `[401]`, probe/tool 공통 headers | — |
| VP-32 | OS 중립 attachment 경로 oracle | EP-20 (1) | **1/1** | `relative(...).split(sep)`로 auth/selector/UUID/file 단언 | — |
| VP-33 | non-Jira 403 기본 강등 | EP-22/25 (2) | **2/2** | 공용 requester 401·403 parameterized regression | — |

- ΔV1 고유 강제 지점: **7/7**(EP-25 3곳 + EP-26 4경로). 이번 pair가 다시 참조한 기존
  강제 지점 EP-17·18·20·22도 **4/4** 재관측했다.

**V-pair 자기확인 (r2)**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-27 | REQUIRED | `SELF_PASS` | tool/probe 401 강등·403 보존·forbidden 분리 | M15a red 17 + M15b red 1 |
| VP-28 | REQUIRED | `SELF_PASS` | probe + 기본 14 + dev-status + attachment header | M16 red 17 |
| VP-29 | REQUIRED | `SELF_PASS` | 403에서 grant valid·verified false·registry 유지·forbidden | M15a red 17 + M15b red 1 |
| VP-30 | REQUIRED | `SELF_PASS` | caller UA와 Auth presentation이 함께 transport 입력에 도달 | M15/M16 red |
| VP-31 | REQUIRED | `SELF_PASS` | 기본/override와 공통 header 표 | M15/M16 red |
| VP-32 | REGRESSION | `SELF_PASS` | Windows·POSIX 구분자 독립 path segment 비교 | CI 원 red + 수정 후 green |
| VP-33 | REGRESSION | `SELF_PASS` | 다른 소비자의 기본 403 강등 유지 | M15 + parameterized regression |

- 유효 V 전체: `SELF_PASS` **32/33**, `SELF_BLOCKED` **1/33**(VP-15 실제 Jira/UI 실기).

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M15a — Jira policy에 403을 다시 auth failure로 포함 | VP-27·29·30·31·33 | r2 재현 | `rest.test` 16 + `deployment-wiring.test` 1 | **잠김** |
| M15b — resume가 보존 실패도 무조건 만료 | VP-27·29·31 | 독립 리뷰 결함 재현 | `deployment-wiring.test` 1 | **잠김** |
| M16 — Jira 공통 User-Agent 제거 | VP-28·30·31 | r2 재현 | `rest.test` 16 + `deployment-wiring.test` 1 | **잠김** |
| M17 — Chromium abort를 이름 없는 일반 Error로 복귀 | cancellation 회귀 | 독립 리뷰 결함 재현 | `net-request.test` 1 | **잠김** |
| M18 — mapper가 DOMException만 cancelled로 인정 | cancellation 회귀 | 독립 리뷰 결함 재현 | `result.test` 1 + `tools.test` 1 | **잠김** |
| M19 — tool binding만 context API base를 무시하고 `/rest`로 복귀 | VP-09·10·30 | 재리뷰 Minor 재현 | `deployment-wiring.test` 1 | **잠김** |

- r2 분모 검산: plan 선택 evidence family **2**(M15·M16) + 독립 리뷰 파생 회귀 변이 **4** =
  실행 표 행 **6**. M15는 tool/probe policy와 resume outcome 두 강제 지점을 각각 공격했다.
- 모든 변이를 각각 원복한 뒤 reviewer target **5파일/59케이스**, 최종 affected target
  **10파일/210케이스**, 전체 Vitest와 build를 다시 관측했다.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 403이 재인증 요구로 오해되는가 | 해소 | grant와 도구 registry를 유지하고 agent에는 `forbidden`을 반환한다 |
| UA 변경이 다른 네트워크 요청에 번지는가 | 없음 | Jira request builder의 caller header만 지정하며 전역 Chromium UA는 바꾸지 않는다 |
| 서버 로그에서 제품/호환 버전을 구분할 수 있는가 | 가능 | source version SSOT로 `Orcinus-Orca-Jira/0.34.0`을 만든다 |
| CI 수정이 제품 저장 경로 의미를 느슨하게 하는가 | 없음 | root·auth·selector·UUID batch·filename을 segment별로 계속 단언한다 |
| Jira가 context path 아래 배포되면 probe만 `/rest`로 새는가 | 해소 | 정규화한 `JIRA_API_BASE_PATH` 한 값에서 probe와 tools 경로를 함께 파생한다 |
| 사용자가 요청을 취소하면 transport 오류로 보이는가 | 해소 | Chromium producer와 Jira mapper가 `AbortError` 이름 계약으로 `cancelled`를 보존한다 |
| 현지화 본문의 개행과 긴 GitHub 주소가 잘리는가 | 해소 | 본문은 `whitespace-pre-wrap`, GitHub는 `break-all`로 렌더한다 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | UA의 버전 literal이 catalog source 버전과 따로 drift할 수 있었다 | ✅ `JIRA_SOURCE.version`에서 UA를 파생 | `source.ts`→`rest.ts` |
| 2 | 일부 비표준 Jira 배포가 만료된 credential에도 403을 쓸 수 있다 | ⚠️ 이번 사용자 서버 의미를 우선해 `forbidden`으로 보존; 해당 배포는 명시 재인증 필요 | D-019 |
| 3 | 미래 소비자가 401/403 외 status를 인증 실패로 분류할 수 있다 | ⚠️ 현재 tuple을 의도적으로 좁힘; 새 status는 계약·상태표와 함께 확장 | `AuthenticatedRequest` |
| 4 | Auth probe가 도구 공통 header/status policy를 전달하지 않았다 | ✅ `AuthProbe`를 request 계약의 부분집합으로 만들고 그대로 requester에 전달 | `contracts/auth.ts`·`login.ts` |
| 5 | probe의 403을 requester가 보존해도 `resume()`이 다시 만료시켰다 | ✅ probe outcome에 `preserveGrant`를 분리하고 verified 성공과도 구분 | `login.ts`·deployment integration |
| 6 | 실제 net 취소가 일반 Error라 Jira mapper의 DOMException 분기와 만나지 않았다 | ✅ producer는 DOMException AbortError, mapper는 Error 이름 계약도 수용 | `net-request.ts`·`result.ts` |
| 7 | 상세 패널 본문 개행과 긴 GitHub 주소 계약이 구현에서 빠졌다 | ✅ 렌더 클래스와 static markup oracle 추가 | `ProviderDetail.tsx` |

### 설계 대비 명시적 차이 (r2)

- 없음. UA 문자열은 설계값을 유지하되 catalog 출처 버전 SSOT에서 파생하도록 구현했다.

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | AuthProbe/requester/resume 상태 계약과 integration test, Jira REST 공통 policy/header, Chromium 취소 shape와 Jira result mapper, attachment store OS 중립 test, ProviderDetail 렌더, auth/폐쇄망 current-state docs, plan/INDEX |
| 실행 명령 | `npm run lint` · `npm run typecheck` · ΔV1 대상 `npx vitest run …` · 전체 `npx vitest run` · `node --test scripts/*.test.mjs` · `npm run build` · `node scripts/check-doc-inventory.mjs --check` · dependency/import/tool-name sweep · `git diff --check` |
| 관측한 게이트 산출 | lint **0 error/1 기존 warning** · typecheck 3구성 pass · affected target **10파일/210케이스 pass** · 전체 Vitest **536파일/4,939케이스 pass, 1파일/1케이스 skip** · script **119/119 pass** · production build pass(기존 dynamic-import warning 1) · doc inventory/link pass · dependency/lock delta 0 |
| V-pair 자기확인 | `SELF_PASS` **32/33**, `SELF_BLOCKED` **1/33**(VP-15 실제 Jira/UI 실기) |
| 강제 지점 전수 | ΔV1 **7/7**, 재참조 기존 지점 **4/4** |
| AC 자기보고 | **17/18** — AC15 사람 실기 대기 |
| 합계 검산 | ✅ **17** · ⚠️ **1** · ❌ **0** = **18** |
| 블로커 / 역질문 | 코드 블로커 없음. 검증자가 §19 AC15를 실제 Jira DC/ko·en UI에서 확인해야 한다 |
| 대상 커밋 | `748372f1`(최초 r2) + `(r2 독립 리뷰 후속 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r2)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: Jira Auth lifecycle·REST transport·attachment
  filesystem oracle라는 기존 축이지만, 403 의미와 UA-XSRF 요구는 사용자 실기에서 새로 드러난 Delta다.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: r1 V에는 없었고 ΔV1의 D-019·D-020·AC17·AC18과
  VP-27…33이 추가된 뒤 구현했다. 최초 ΔV1은 probe 강제 지점을 빠뜨렸고 독립 리뷰 후 규범 행을
  먼저 보강한 다음 후속 구현했다.
- 독립 리뷰에서 실제로 찾은 구현 누락: Auth probe policy 전달, resume 보존 실패, cancellation
  error shape, context-path probe, ProviderDetail 줄바꿈/긴 URL 처리.
- 후속 재리뷰 판정은 Critical/Important 0, merge ready였다. 남은 Minor인 context-path oracle의
  tools 미단언도 실제 tool invocation URL을 확인하도록 보강하고 M19 red 1로 잠갔다.
- 반복 환경 한계: 실제 Jira DC endpoint/PAT와 사람 UI 세션이 없어 AC15는 계속 반복 관측 불가.
- 현재 라운드 수: 2

---

## [검증자 기입] 파생 이슈

> r1 검증 판정과 근거 정본은 [`verify.md`](verify.md)다. 아래는 이관된 이슈 행만 갖는다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | 14개 도구 중 7개의 REST query/body가 어떤 테스트로도 잠기지 않는다. 8변이(linkIssues inward↔outward 맞바꿈 포함) 전부 green | VP-08 / AC8 / EP-15 | `jira_getIssue`·`getIssueComments`·`updateIssue`·`postIssueComment`·`updateIssueComment`·`linkIssues`·`downloadAttachment(issueKey)`의 query/body를 단언하고 같은 8변이로 red 확인 | BLOCKING | open |
| D2 | `JiraAttachmentBatch`의 `state !== 'open'` 재진입 가드를 write/commit 양쪽에서 제거해도 8스위트 84케이스 전건 green | r1 `설계 대비 차이` 표 `재진입` 행이 인용한 `store state fixture` | 중복 `commit()`과 commit 후 `write()`가 `filesystem_error`임을 단언 | NON_BLOCKING | open |
| D3 | Jira `AuthenticatedRequest` 생성이 `jiraRequest()`를 지나는지 보장하는 구조 가드가 없다. 현재 5지점은 전부 준수 | EP-26 seam | 기록 — 새 요청 지점 추가 시 header 누락이 조용히 통과할 수 있다 | NON_BLOCKING | open |
| D4 | 설계 커밋 `52487f1c`·`914081b2`·`d0880910`이 `Agent: codex` + `Status: designed` | root `AGENTS.md` 커밋 프로토콜 | 기록 — 허용값이고 구현 커밋과 분리됐다 | NON_BLOCKING | 기록 |
| D5 | `jiraTools`·`createPluginBinding`·catalog 경로의 프로덕션 호출자 0 — `createPluginBindings()`가 `[]`다 | D-014 | 기록 — 의도된 기본 배포. AC7·13·14의 production path는 배포 fixture에서만 실행된다 | NON_BLOCKING | 기록 |
| D6 | AC15(실제 Jira DC·ko/en UI 실기) 관측 불가 | VP-15 | 사람 실기 — `verify.md §8` 체크리스트 | NON_BLOCKING | open |

---

## [구현자 기입] 설계 리뷰 (r3)

- 판정: D1과 D2는 기존 계약을 구현하지 못한 것이 아니라, 이미 존재하는 동작 계약을 실제 production path의 oracle로 잠그지 못한 구현·검증 누락이다.
- 유효 V: V1 `41c07e9c`에 ΔV1 `d0880910`을 합성한 기준을 유지하고, 이번 라운드는 REQUIRED VP-08과 VP-25의 파생 이슈만 재구현한다.
- 계약 변경: Decision·AC·V node/pair·§10 강제 지점을 바꾸지 않았다. 신규 의존성·공개 메시지·UI 동작 변경도 없다.
- D1 불변식: 각 Jira 도구 호출은 schema를 통과한 뒤 실제 `BoundAuth.request`에 upstream 0.34.0의 method/path/query/body를 전달해야 한다.
- D2 불변식: publish 이후 batch 상태는 재진입할 수 없으며, stage 경로가 다시 존재해도 `write`와 `commit`은 `filesystem_error`를 반환해야 한다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인 (r3)

| Pair | §10 강제 지점 | 전수 결과 | 자기 상태 | 직접 관측 |
|---|---|---:|---|---|
| VP-08 | EP-14/15/16/17/21 | **5/5** | `SELF_PASS` | `service.test.ts`가 7개 도구의 실제 request fake 호출에서 query/body와 method/path를 확인하고, 기존 `rest.test.ts`가 나머지 7개 route를 유지한다 |
| VP-25 | EP-19/20/21 | **3/3** | `SELF_PASS` | `attachment-store.test.ts`가 publish 후 stage 재생성 시 `write`·`commit` 재진입을 확인한다. EP-20의 상태 가드 두 subpoint(write/commit)도 **2/2**다 |

- VP-15는 실제 Jira DC endpoint와 사람 UI 세션이 없어 `SELF_BLOCKED`로 유지한다.
- 기존 pair는 변경 경로가 없으므로 이전 자기확인 결과를 상속하고, 이번 라운드의 독립 검증을 선점하지 않는다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r3)

| 심은 결함 또는 새 oracle | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 신규 outbound oracle — 7개 도구의 실제 service→BoundAuth request query/body | D1 / AC8 / EP-15 | 해당 oracle 없음 | 기본 GREEN 1 · 인용 변이 red 9 | **잠김** |
| 신규 재진입 oracle — publish 후 stage 재생성 | D2 / AC12 / EP-20 | 해당 oracle 없음 | 기본 GREEN 1 · P-i red 1 | **잠김** |
| S1 — linkIssues inward↔outward 맞바꿈 | D1 / VP-08 | green | `service.test.ts` 1 | **잠김** |
| P-a — updateIssue summary↔description | D1 / VP-08 | green | `service.test.ts` 1 | **잠김** |
| P-b — updateIssue `notifyUsers` 변경 | D1 / VP-08 | green | `service.test.ts` 1 | **잠김** |
| P-c — linkIssues `type.name`→`type.id` | D1 / VP-08 | green | `service.test.ts` 1 | **잠김** |
| P-d — postIssueComment body key 변경 | D1 / VP-08 | green | `service.test.ts` 1 | **잠김** |
| P-e — getIssue 기본 fields 축소 | D1 / VP-08 | green | `service.test.ts` 1 | **잠김** |
| P-f — download issueKey query fields 변경 | D1 / VP-08 | green | `service.test.ts` 1 | **잠김** |
| P-g — updateIssueComment body key 변경 | D1 / VP-08 | green | `service.test.ts` 1 | **잠김** |
| P-h — getIssueComments 기본 maxResults 제거 | D1 / VP-08 | green | `service.test.ts` 1 | **잠김** |
| P-i — batch write/commit 상태 가드 제거 | D2 / VP-25 | green | `attachment-store.test.ts` 1 | **잠김** |

- r3 분모 검산: 선택 evidence **0** + 검증자가 열거한 인용 변이 **10**(S1·P-a…P-i) + 신규 oracle **2** = 표 행 **12**.
- 각 변이는 주입 후 해당 테스트가 RED임을 확인하고 즉시 원복했다. P-f는 잘못된 metadata 응답으로 `invalid_response`가 발생했으며, 나머지는 기대 payload/query 단언에서 실패했다.
- 직접 oracle은 구현된 service와 store를 호출하므로 동명 builder만 검사하는 구조적 proxy가 아니다.

## [구현자 기입] Product/UX 파생 검토 (r3)

| 질문 | 판정 | 후속 |
|---|---|---|
| outbound 요청 oracle 추가가 agent 메시지 포맷을 바꾸는가 | 없음 | 기존 Jira success/error envelope와 tool name을 유지 |
| publish 후 재진입 오류가 사용자에게 무음으로 보이는가 | 없음 | handler의 기존 `filesystem_error` 매핑을 사용하며 새 오류를 삼키지 않음 |
| stage 재생성 적대 fixture가 실제 Temp 경로를 벗어나는가 | 없음 | 테스트 root 아래 `jira/auth/selector/.staging`만 재생성하고 afterEach에서 제거 |
| 이번 라운드에 UI·제품 문자열 소비자가 새로 생기는가 | 없음 | 코드·렌더·i18n 변경 없이 테스트/문서만 갱신 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r3)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 기존 route table만으로는 payload 의미가 drift해도 통과할 수 있었다 | 실제 `createJiraService(...).invoke()`와 fake request를 연결해 7개 미잠금 도구를 한 케이스에서 관측 | `service.test.ts` outbound oracle |
| 2 | 기존 재진입 테스트는 stage가 사라져 가드가 없어도 filesystem 오류로 보일 수 있었다 | publish 후 원래 stage 이름을 재생성한 뒤 write를 호출해 상태 가드 자체를 적대적으로 관측 | `attachment-store.test.ts` P-i red |
| 3 | D3(공통 `jiraRequest` 구조 guard), D4(설계 trailer), D5(기본 배포 호출자 0), D6(사람 실기)는 이번 계약의 BLOCKING이 아니다 | 변경하지 않고 verifier 파생 이슈로 유지 | `verify.md §13` |
| 4 | 실제 Jira DC와 ko/en UI 실기는 로컬에서 재현할 수 없다 | AC15/VP-15를 `SELF_BLOCKED`로 남기고 Claude/사람 검증으로 이관 | `verify.md §8` |

## [구현자 기입] 구현 보고 (r3)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/features/plugins/jira/service.test.ts`, `app/src/main/features/plugins/jira/attachment-store.test.ts`, `docs/handoff/INDEX.md`, 본 plan의 r3 보고 |
| production diff | 없음. Jira REST 동작과 attachment store guard는 기존 구현을 유지하고 oracle만 추가 |
| 실행 명령 | `npx.cmd vitest run src/main/features/plugins/jira` · `npx.cmd vitest run` · `node --test scripts/*.test.mjs` · `npm.cmd run lint` · `npm.cmd run typecheck:node` · `npm.cmd run typecheck:web` · `npm.cmd run typecheck:test` · `node scripts/check-doc-inventory.mjs --check` · `git diff --check` |
| 관측한 게이트 산출 | Jira **7파일/64케이스 pass** · 전체 Vitest **536파일 pass/1 skip, 4,941 pass/1 skip** · scripts **119 pass/0 fail** · lint **0 error/기존 warning 1** · typecheck **3/3 pass** · doc inventory **9 items/98 channels, prose/link pass** · diff check pass |
| V-pair 자기확인 | VP-08 `SELF_PASS`(EP 5/5), VP-25 `SELF_PASS`(EP 3/3); VP-15 `SELF_BLOCKED` |
| AC 자기보고 | **17/18** — AC15 실제 Jira DC·ko/en UI 실기 대기 |
| 합계 검산 | ✅ **17** · ⚠️ **1** · ❌ **0** = **18** |
| 블로커 / 역질문 | 코드 블로커 없음. AC15는 실제 Jira DC 자격증명과 사람 UI 세션이 필요하다 |
| 대상 커밋 | `(r3 구현 — 검증자 기입)` — 좌표는 INDEX에서 Claude가 기입 |

## [구현자 기입] Review Signals — 사실만 (r3)

- 이번에 닫은 불변식은 이전 라운드의 Jira REST/attachment 축과 같고, 검증 FAIL이 지목한 oracle 누락을 production path에서 보완했다.
- 이를 막았어야 할 plan 지침과 AC는 이미 있었다. AC8·EP-15가 각 도구의 outbound query/body를 요구했지만 r2 보고는 route/field inventory만 관측했다.
- D2에서는 기존 테스트가 가드 제거를 검출하지 못하는 이유를 stage 경로 재생성으로 확인했고, 그 fixture가 가드가 태어난 지점을 직접 본다.
- 반복 환경 한계는 실제 Jira DC endpoint/PAT와 사람 UI 세션 부재다. 전체 기계 gate는 이번 라운드에서 모두 통과했다.
- 현재 라운드 수는 **3**이며, 다음 주체는 Claude 독립 검증자다.
