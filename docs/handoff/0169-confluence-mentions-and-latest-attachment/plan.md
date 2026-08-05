# Plan — 0169-confluence-mentions-and-latest-attachment

## 메타

| 항목 | 값 |
|---|---|
| slug | `0169-confluence-mentions-and-latest-attachment` |
| 작성자 | Claude Code |
| 일자 | 2026-08-05 |
| 매핑 | 0168 후속 (같은 모듈, 사용자 후속 보고 2건) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 A | "`/download/attachments/` 본문 첨부된 **(최신버전)** 이미지 파일을 받아야 한다" | 라이브 세션 요청 2026-08-05 |
| 명시 요구 B | "`@이름` 같은 **이름태그도 마크다운 변환과정에서 유실**되고 있음" | 〃 |
| 추론 의도 | A 는 0168 이 넣은 `/download/` 검출 규칙에 대한 **확인 + 버전 요구사항 추가**로 읽는다 — "받아야 한다" 가 검출 대상 지정이고 "(최신버전)" 이 버전 규칙이다. 본문 URL 의 `?version=N` 에 고정되면 안 된다는 뜻 | (추론임을 표기) |

## Context (왜)

0168 이 `/download/attachments/…` `<img>` 를 참조로 승격했다. A 는 그 대상을 **어느 버전으로**
받는지를 못박는다 — 본문 URL 은 삽입 시점 버전(`?version=1`)을 달고 있어서 그대로 쓰면 갱신된
이미지를 놓친다. B 는 별개 결함이다: 멘션이 변환에서 **통째로 사라진다**.

## 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 진짜 문제를 겨냥하는가 | **A 는 절반 이미 충족·절반 미충족** / **B 는 전부 타당** | A: 0168 의 `parseDownloadHref` 가 `src.split(/[?#]/)[0]` 로 **쿼리를 이미 버리고**, 다운로드는 *현재* 첨부 목록과 이름을 대조해 attachment id 로 받으므로 구조상 최신이다(`storage-to-markdown.ts` · `connector.ts` `downloadAttachments`). 미충족은 **검증 가능성** — 받은 버전을 어디에도 기록하지 않아 "최신을 받았다" 를 사후에 확인할 수단이 없다. B: `normalizeLinks` 가 `ri:page`·`ri:attachment` 만 보고 `ri:user` 는 라벨이 `''` 가 되어 `node.replaceWith('')` → **완전 소실**(`storage-to-markdown.ts:176-187`) |
| 이미 있는 것 아닌가 | A 부분 있음(위), **B 없음** — `ri:user`·mention 문자열이 이 디렉터리에 **0건**(전수 grep) | 이번 세션 grep |
| 더 작은 해법이 있는가 | **A**: 버전 기록만 추가하면 요구를 만족한다. 다운로드 경로를 `_links.download` 로 **교체**하는 것은 더 큰 변경이고 현행 `/data` 경로가 302 로 같은 파일을 준다(`broker.ts:319-322` 주석이 그 302 를 실측으로 기록). → **교체하지 않고 폴백으로만** 둔다. **B**: `ri:username` 이 있는 저장 형식만 처리하면 REST 조회 없이 끝나지만, DC 최신 저장 형식은 **`ri:userkey` 만** 싣는 경우가 흔해 그것만으로는 이름이 안 나온다 → 해석 경로가 필요하다 | Atlassian 문서(아래 R3·R4) |
| 인용 자료가 요구를 부풀리지 않았나 | 해당 없음 — 요구는 사용자 실사용 보고 2건이다 | — |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다.** "미지원 매크로를 지우지 않는다(조용한 내용 소실이 가장 나쁜 결과다)" 원칙을 **멘션에도 적용**하는 것이라 오히려 기존 결정의 누락을 메운다 | `modules/confluence/AGENTS.md §규칙` |

- **사용자에게 올릴 것**: 없음.

## 자료조사

| # | 발견 / 제약 | 레퍼런스 |
|---|---|---|
| R1 | **멘션 소실 경로 확정.** `normalizeLinks` 의 `title` 은 `ri:page[ri:content-title]` → `ri:attachment[ri:filename]` 순으로만 찾고, `bodyText` 도 비면 `label === ''` → `node.replaceWith('')`. 멘션은 세 조건에 모두 걸려 **흔적 없이 사라진다** | `app/src/main/features/auth-platform/modules/confluence/storage-to-markdown.ts:176-187` |
| R2 | **`ri:user` 처리 코드 0건**(전수 grep — `ri:user`·`mention` 이 모듈 전체에서 0 hit) | 이번 세션 grep |
| R3 | **저장 형식**: 멘션은 `<ac:link><ri:user ri:userkey="…"/></ac:link>`. `ri:username` 도 쓸 수 있고 Confluence 가 저장 시 userkey 로 바꾼다. userkey 는 MD5 형태의 **불투명 키**라 그 자체로는 이름이 아니다 | [Confluence Storage Format](https://confluence.atlassian.com/doc/confluence-storage-format-790796544.html) · [when-are-user-keys-used-in-mentions](https://community.developer.atlassian.com/t/when-are-user-keys-used-in-mentions-and-how-to-resolve-them/76933) |
| R4 | **이름 해석 엔드포인트**: DC 는 `GET /rest/api/user?key={userkey}` 가 `{ username, userKey, displayName }` 를 준다 | [DC REST — user](https://developer.atlassian.com/server/confluence/rest/v900/api-group-user/) |
| R5 | **첨부 다운로드 경로 현황**: 현행은 `GET /rest/api/content/{pageId}/child/attachment/{attId}/data`. Atlassian 문서에서 `/data` 는 *업로드(POST, multipart)* 로 문서화돼 있고, Cloud 전용 `GET …/download` 는 **Server 에서 404** 다. DC 의 정식 다운로드 좌표는 첨부 목록이 주는 `_links.download`(`/download/attachments/…?version=N&…`) | [DC REST — attachments](https://developer.atlassian.com/server/confluence/rest/v910/api-group-attachments/) · [how-to-download-attachment-via-rest-api](https://community.developer.atlassian.com/t/how-to-download-attachment-via-rest-api/83378) |
| R6 | **현행 `/data` GET 은 302 로 동작한다** — broker 주석이 "0160 이전에는 재검사 호출자가 없어 302 가 빈 본문으로 반환됐다(첨부 다운로드가 빈 파일로 끝나던 원인)" 로 그 리다이렉트를 실측 기록했다. 즉 `/data` GET 은 `/download/attachments/…` 로 넘겨 주고 **broker 가 추종한다** → 교체가 아니라 폴백이 옳다 | `app/src/main/features/auth-platform/broker.ts:319-322` |
| R7 | **버전 정보가 결과에 없다.** `parseAttachments` 는 `id`·`title`·`metadata.mediaType` 만 읽고, `attachmentListRequest` 는 `expand` 를 안 붙인다. `SavedAsset`·`manifest.json` 어디에도 버전이 없다 | `connector.ts` `parseAttachments` · `rest.ts:115-121` · `download-store.ts:89-94` |
| R8 | **경로 접두사 규칙**: `_links.download` 는 `_links.base`(= origin + 컨텍스트 경로) 기준 상대 경로다. 우리 `restPath` 와 같은 방식으로 `apiBasePath` 를 앞에 붙여야 한다. `checkRequestPath` 는 **절대 URL 만** 거부하므로 `/download/…` 상대 경로는 정책을 통과한다 | `rest.ts:33-35` · `features/auth-platform/policy.ts:39-44` |
| R9 | **게이트 베이스라인(직접 측정)**: 모듈 스위트 **8파일 / 148 테스트** 전부 통과 (0168 r2 종료 시점) | 이번 세션 실행 |

## 인수 기준

> 공통 프로덕션 도달 경로(P): `tools.ts` `confluence_get_pages` → `ctx.invoke('pages')` →
> `connector.ts` `fetchPage` → (`storageToMarkdown` / `downloadAttachments` / `resolveMentions`).

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `<ac:link><ri:user ri:userkey="K"/></ac:link>` 가 markdown 에 **남는다** — 해석 전 형태가 `@{{user:K}}` 이고 `referencedUsers` 에 `K` 가 실린다 | `storage-to-markdown.test.ts::"userkey 멘션을 자리표시자로 남기고 키를 모은다"` | `fetchPage` → `storageToMarkdown` |
| 2 | `ri:username` 이 있으면 REST 조회 없이 그 이름을 쓴다 (`@jsmith`), `referencedUsers` 는 비어 있다 | 〃`::"username 이 있으면 조회 없이 그대로 쓴다"` | 〃 |
| 3 | 링크 본문(`ac:plain-text-link-body`)이 있으면 그 텍스트를 라벨로 쓴다 | 〃`::"멘션에 링크 본문이 있으면 그 텍스트를 쓴다"` | 〃 |
| 4 | 같은 사용자를 여러 번 멘션해도 `referencedUsers` 에 1건만 실린다 | 〃`::"같은 사용자를 여러 번 멘션해도 키는 한 번만 모은다"` | 〃 |
| 5 | connector 가 `/rest/api/user?key=K` 를 **키당 1회** 호출하고 `displayName` 으로 치환해 `@홍길동` 이 본문에 남는다 | `connector.test.ts::"멘션 userkey 를 표시 이름으로 치환한다"` | `fetchPage` → `resolveMentions` |
| 6 | 사용자 조회가 실패(404·500)해도 **페이지는 저장되고** 자리표시자가 새지 않는다 — 본문에 `@사용자` 가 남고 `{{user:` 문자열은 0건 | 〃`::"사용자 조회가 실패해도 자리표시자를 흘리지 않는다"` | 〃 |
| 7 | `displayName` 이 없으면 `username` 으로 폴백한다 | 〃`::"displayName 이 없으면 username 으로 폴백한다"` | 〃 |
| 8 | 멘션이 없는 페이지는 사용자 조회 요청이 **0건**이다 | 〃`::"멘션이 없으면 사용자 조회를 하지 않는다"` | 〃 |
| 9 | 첨부 목록 요청이 `expand=version` 을 실어 보낸다 | 〃`::"첨부 목록에 version 확장을 요청한다"` | `fetchPage` → `attachmentListRequest` |
| 10 | 내려받은 첨부의 **버전 번호**가 `SavedAsset.version` 과 `manifest.json` 에 기록된다 | 〃`::"내려받은 첨부의 버전을 기록한다"` | `fetchPage` → `store.saveAsset` / `manifestOf` |
| 11 | 본문 URL 이 `?version=1` 로 옛 버전을 가리켜도, 목록의 **현재 버전**(예: 3)을 받아 그 번호가 기록된다 | 〃`::"본문 URL 의 옛 version 을 따르지 않고 현재 첨부를 받는다"` | 〃 |
| 12 | `/data` 다운로드가 실패하면 목록이 준 `_links.download` 경로로 **한 번 더** 시도하고, 성공하면 자산으로 저장된다 | 〃`::"data 경로가 실패하면 download 링크로 재시도한다"` | `fetchPage` → `downloadAttachments` |
| 13 | `_links.download` 의 쿼리(`version`·`modificationDate`·`api`)가 요청 query 로 그대로 전달되고, 경로에 `apiBasePath` 접두사가 붙는다 | `rest.test.ts::"download 링크를 컨텍스트 경로와 쿼리를 살려 요청으로 만든다"` | 〃 |
| 14 | 두 경로 모두 실패하면 그 첨부만 `failedAssets` 로 남고 페이지 저장은 완료된다 | `connector.test.ts::"두 다운로드 경로가 모두 실패해도 페이지 저장은 완료된다"` | 〃 |
| 15 | 사내 페이지 실기 — 본문의 `@이름` 이 결과 Markdown 에 이름으로 남고, 갱신된 이미지가 최신 내용으로 저장된다 | **사람 실기** — 실행 경로: `servers.ts` 등록 → `npm run dev` → 플러그인 탭 연결 → 멘션·이미지가 있는 페이지를 `confluence_get_pages` → `page.md` 와 `assets/` 확인 | 도구 전체 경로 (P) |

## 범위 / 비범위

- **범위**: `ri:user` 멘션 보존 + 이름 해석 · 첨부 버전 기록 · `_links.download` 폴백 경로.
- **비범위**: 사용자 프로필 링크(URL) 생성 · 멘션 이름 캐시의 호출 간 재사용(호출 1회 내 캐시만) ·
  `ri:space`·`ri:blog-post` 등 나머지 `ri:*` 리소스 · 0168 D2(`uniqueName` 링크 desync).

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 프로필 링크 생성 | 아니오 — 텍스트에 링크를 씌우는 추가 변경이고 되돌릴 수 있다 |
| 호출 간 이름 캐시 | 아니오 — 순수 성능 항목 |
| **자리표시자 토큰 형식(`{{user:KEY}}`)** | **아니오 — 밖으로 새지 않는 것이 AC6 이다.** 해석에 실패해도 `@사용자` 로 치환되므로 이 문자열은 `page.md` 에도 도구 결과에도 남지 않는다. 소비자가 없으니 개명 비용 0 |
| 나머지 `ri:*` | 아니오 — 같은 자리에 분기 추가 |

## 의존 기술 / 전제

- 기존 모듈만 쓴다(cheerio·turndown·`mapWithLimit`·`authenticatedFetch`). **신규 의존성 0.**
- 전제: DC 가 `GET /rest/api/user?key=` 를 제공한다(R4). 없거나 권한이 없으면 AC6 의 폴백으로
  강등되며 **페이지는 정상 저장된다** — 전제가 틀려도 회귀가 아니다.

## 설계

### (1) 멘션 — 변환기는 수집, connector 는 해석 (순수/IO 분리)

`normalizeLinks` 에 `ri:user` 분기를 **가장 먼저** 둔다.

```
ac:plain-text-link-body 있음 → 그 텍스트를 라벨로            (AC3)
ri:username 있음             → `@<username>`, 수집 없음      (AC2)
ri:userkey 있음              → `@{{user:<key>}}` + 키 수집   (AC1)
셋 다 없음                    → `@사용자`                      (소실 금지)
```

`StorageConversion` 에 `referencedUsers: string[]`(userkey) 추가. **변환기는 네트워크를 모른다** —
순수성 유지.

connector 의 `fetchPage` 는 markdown 을 만든 **직후**, `page.md` 저장 **전에** `resolveMentions`
를 돌린다: 키마다 `userRequest(endpoint, key)` 를 `mapWithLimit` 로 조회(키당 1회, AC5·AC8) →
`displayName ?? username` (AC7) → `markdown.replace(/\{\{user:([^}]*)\}\}/g, …)`. **해석 실패·미조회
키는 `사용자` 로 치환**해 자리표시자가 절대 새지 않게 한다(AC6). 치환은 미해결 토큰까지 전부
훑으므로 fail-closed 다.

토큰에 `_`·`*`·`[` 를 쓰지 않는다 — turndown 이 이스케이프해 `\{\{user...` 로 깨진다.

### (2) 첨부 — 버전을 기록하고 다운로드 경로를 이중화

- `attachmentListRequest` 에 `expand: 'version'` 추가(AC9).
- `parseAttachments` 가 `version`(= `version.number`)과 `downloadPath`(= `_links.download`)를 함께 읽는다.
- `SavedAsset.version?: number` 추가 → `saveAsset(…, { mediaType, version })`, `manifestOf` 기록(AC10·11).
- 다운로드는 **`/data` 우선, 실패 시 `_links.download` 재시도**(AC12·14). 교체하지 않는 이유는
  R6 — 현행 경로가 302 로 실제 동작하는 것이 실측돼 있어 교체는 회귀 위험만 만든다.
- `rest.ts` 에 `attachmentDownloadRequest(endpoint, downloadPath, maxBytes)` 신설 — 링크의
  `?a=b` 를 `query` 레코드로 분해하고 경로에 `apiBasePath` 를 붙인다(AC13·R8). **순수 함수**.

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `userRequest` · `attachmentDownloadRequest` (`rest.ts`) | 요청 서술자 2종 | 같은 슬라이스 | 순수 단위 (`rest.test.ts`) |
| `resolveMentions` (`connector.ts` 내부) | userkey → 표시 이름 치환 | 〃 | fake `authenticatedFetch` 통합 (`connector.test.ts`) |
| `StorageConversion.referencedUsers` | 수집 채널 | 〃 | 순수 단위 (`storage-to-markdown.test.ts`) |

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **"미지원 매크로를 지우지 않는다 — 조용한 내용 소실이 가장 나쁜 결과다"** | `modules/confluence/AGENTS.md §규칙` | §설계 (1) 의 "셋 다 없음 → `@사용자`" | **유지·확장** — 같은 원칙을 멘션에 적용한다(현행이 이 원칙의 예외였다) |
| "내부 링크는 URL 을 만들 수 없으므로 제목 텍스트로 남긴다" | `storage-to-markdown.ts:174-175` (주석) | §설계 (1) — `ri:user` 분기를 **앞에** 둔다 | **유지** — 기존 `ri:page`·`ri:attachment` 분기는 무변경 |
| **`storage-to-markdown.ts` 는 순수 함수만 (네트워크·fs 의존 0)** | 같은 파일 헤더 1행 · `AGENTS.md §파일 구성` 표 | §설계 (1) 의 "변환기는 네트워크를 모른다" | **유지** — 해석은 connector 로 넘긴다 |
| "본문이 참조한 것만 받는다" (엄격 필터) | `connector.ts` `downloadAttachments` 주석 | §설계 (2) — `wanted` 필터 무변경 | **유지** |
| "바이너리는 `responseType:'binary'` + `X-Atlassian-Token: nocheck` 를 함께" | `AGENTS.md §규칙` · `rest.ts:123-124` | §설계 (2) 의 `attachmentDownloadRequest` | **유지** — 새 요청도 같은 두 값을 싣는다 |
| 0168 의 "`/download/` 접두사로 후보를 좁힌다" | `AGENTS.md §첨부 다운로드` | §설계 (2) — 검출 규칙 무변경 | **유지** |
| 0168 의 진단 출력 상한(`MAX_DIAGNOSTIC_NAMES`) | `search-render.ts` | §설계 — 진단 줄 무변경 | **유지** |
| main 레이어 DAG · feature 교차 금지 | `eslint.config.mjs` · `src/main/AGENTS.md` | §설계 표의 레이어 칸 | **유지** — 변경 전부 같은 슬라이스 |

## 파생 UX / 엣지케이스

- **요청 증가**: 멘션이 있는 페이지마다 *고유 사용자 수* 만큼 GET 이 는다. 같은 키는 1회(AC5),
  멘션 0이면 0회(AC8). 첨부 다운로드와 달리 대개 한 자릿수다.
- **권한**: 사용자 조회가 403 일 수 있다(사내 디렉터리 정책). AC6 이 그 경우 `@사용자` 로 강등하고
  페이지는 정상 저장한다.
- **탈퇴 사용자**: userkey 는 남고 조회는 404 — 같은 폴백 경로.
- **첨부 버전 경합**: 목록 조회와 다운로드 사이에 새 버전이 올라오면 기록된 번호와 실제 바이트가
  어긋날 수 있다. 창이 매우 좁고, 기록값은 "목록 조회 시점의 현재 버전" 이라는 의미로 정의한다.
- **`_links.download` 부재**: 확장이 빠진 배포면 폴백 경로가 없다 — `/data` 실패가 곧 첨부 실패이고
  이는 현행과 동일하다(회귀 아님).

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| 자리표시자가 본문에 새면 0168 보다 나쁜 결과(사용자에게 보이는 쓰레기 문자열) | AC6 을 **양성 단언**으로 두고(`{{user:` 0건) 치환을 정규식 전역 훑기로 fail-closed 하게 만든다 |
| 사용자 조회가 페이지 실패를 유발 | 조회 실패를 삼키고 폴백 치환 — 0168 D1 에서 배운 "진단·부가 조회가 본 작업을 죽이지 않는다" 를 그대로 적용 |
| `_links.download` 경로 접두사 오판(컨텍스트 경로 이중 부착) | `attachmentDownloadRequest` 를 **순수 함수**로 떼어 AC13 으로 경로 조립을 고정 |
| 사내 DC 가 `/rest/api/user` 를 막아 둠 | 폴백으로 강등되고 회귀는 없다. 실기(AC15)에서 확인 |

- 되돌리기 어려운 결정: 없음 (IPC·DB·도구 이름 무변경).
- Open Question: 없음.

## 영향 받는 파일

- `app/src/main/features/auth-platform/modules/confluence/storage-to-markdown.ts`(+`.test.ts`)
- `app/src/main/features/auth-platform/modules/confluence/connector.ts`(+`.test.ts`)
- `app/src/main/features/auth-platform/modules/confluence/rest.ts`(+`.test.ts`)
- `app/src/main/features/auth-platform/modules/confluence/download-store.ts`
- `app/src/main/features/auth-platform/modules/confluence/AGENTS.md`
- `docs/handoff/INDEX.md` · 본 plan

## 참고 문서

- [Confluence Storage Format](https://confluence.atlassian.com/doc/confluence-storage-format-790796544.html) (멘션 형식)
- [DC REST — user](https://developer.atlassian.com/server/confluence/rest/v900/api-group-user/) · [DC REST — attachments](https://developer.atlassian.com/server/confluence/rest/v910/api-group-attachments/)
- `modules/confluence/AGENTS.md` · `docs/handoff/0168-confluence-image-download-regression/`
- IPC 변경: **없음**

## 게이트

- `cd app && npm run lint && npm run typecheck` + `./node_modules/.bin/vitest run src/main/features/auth-platform/modules/confluence/` (베이스라인 8파일 148테스트 — R9).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 요구 A·B 를 원문으로 인용하고, A 의 해석은 추론으로 표기했다.
- [x] 자료조사 — 9건 전부 `파일:라인` 또는 외부 1차 출처 URL.
- [x] 의존 기술 — 신규 의존성 0. 전제(R4 엔드포인트)가 틀려도 회귀가 아님을 명시.
- [x] 파생 UX — 요청 증가·권한·탈퇴 사용자·버전 경합·확장 부재를 펼쳤다.
- [x] 리스크 — 자리표시자 유출을 1순위로 두고 AC6 으로 잠갔다.
- [x] 요구 비판적 검토 5문항 — A 가 **절반 이미 충족**임을 밝히고도 요구를 줄이지 않았다(검증 가능성으로 재정의).
- [x] `검증 수단` 빈 칸 0 — AC15 는 "사람 실기 + 실행 경로" 명시.
- [x] 부정형/"불변" 기준 0 — AC6·AC8 도 "0건" 이라는 측정 가능한 양성 단언.
- [x] AC 간 모순 점검 — AC1(자리표시자 남김)과 AC6(자리표시자 0건)은 **단계가 다르다**(변환기 출력 ↔ connector 최종 본문). AC2(username 경로)와 AC5(userkey 경로)는 입력이 배타적. AC12(폴백 성공)와 AC14(둘 다 실패)도 배타적.
- [x] 인용 수치 직접 측정 — 베이스라인 148(R9), `ri:user` grep 0건(R2). 승계 0.
- [x] 신규 모듈 3개 전부 테스트 방법 기재 · 순수부(`rest.ts` 2함수)를 IO 에서 분리.
- [x] 전수 조사 N — `ri:user` 처리 0건 · `normalizeLinks` 1곳 · `parseAttachments` 1곳.
- [x] 각 AC 에 프로덕션 도달 경로 기재 (테스트가 유일 호출자인 AC 0개).
- [x] 사람 실기 AC15 의 실행 경로가 비범위에 막혀 있지 않다.
- [x] 선택적 필드 미지정 케이스 — `ri:username` 미지정(AC1) / 지정(AC2), `displayName` 미지정(AC7), `_links.download` 미지정(§파생 UX) 각각 있다.
- [x] 제약 필드 강제 지점 — 경로 접두사·쿼리 분해는 `attachmentDownloadRequest` 가 **요청 조립 시점**에, 자리표시자 제거는 `resolveMentions` 가 **저장 직전**에 강제한다.
- [x] 미룬 항목 일방향 여부 답변 완료 (토큰 형식 포함).
- [x] 관문 4 — 기존 결정 표 8행을 본문 문장과 짝지어 채웠고 인용 경로를 열어 확인했다. `[구현자 기입]`·`[검증자 기입]` 블록 있음.

---

## [구현자 기입] 설계 리뷰 (비판적)

- **동의**: 변환기(순수) / connector(IO) 로 멘션 처리를 가른 것이 옳다. 대안은 변환기가 fetch 를
  들이는 것인데 그러면 `storage-to-markdown.test.ts` 51건이 통째로 네트워크 모킹을 물게 된다.
  다운로드 좌표를 **교체가 아니라 폴백**으로 둔 판단도 옳다 — R6 의 302 실측이 있는데 교체하면
  검증 불가능한 회귀 위험만 산다.
- **이견 ①(해소됨)**: §설계 (2)가 `saveAsset` 에 버전을 "추가" 하라고만 적었는데, 현행 시그니처가
  `(rawName, bytes, mediaType?)` 라 세 번째 인자를 늘리면 **호출부에서 뭐가 뭔지 안 보인다**.
  `AssetMeta` 객체로 바꿨다(아래 문제 1).
- **이견 ②**: AC3(링크 본문 우선)은 **현행 코드도 통과한다** — 기존 `bodyText` 분기가 이미
  그 값을 쓰고 있었다. plan 이 이를 신규 동작처럼 적었다. 측정력 실측에서 확인됐고(19건 중
  17건만 red), 가드 성격의 AC 로 재분류한다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `saveAsset(name, bytes, mediaType?)` 에 버전을 인자로 더하면 **위치 인자 4개**가 되어 호출부 가독성이 무너진다 | ✅ **구현함** — `AssetMeta = Omit<SavedAsset,'filename'\|'path'\|'bytes'>` 객체 인자로 전환. 타입이 `SavedAsset` 에서 **파생**되므로 필드를 늘려도 두 곳이 어긋나지 않는다 | 구현 세부 → ✅ |
| 2 | `downloadOne` 이 없으면 폴백 로직이 `mapWithLimit` 콜백 안에 인라인으로 들어가 **첨부 하나의 다운로드 규칙**이 동시성 코드와 뒤엉킨다 | ✅ **구현함** — 첨부 1건 다운로드를 `downloadOne` 으로 떼어 `mapWithLimit` 은 동시성만 맡는다 | 구현 세부 → ✅ |
| 3 | 멘션 분기가 **기존 `ri:page`·`ri:attachment` 링크를 가로챌** 위험. `ac:link` 하나에 여러 `ri:*` 가 섞이면 순서가 결과를 바꾼다 | ✅ **구현함 + AC 신설** — `ri:user` 존재 여부로만 분기하고, `storage-to-markdown.test.ts::"페이지·첨부 링크는 종전대로 남는다 — 멘션 분기가 가로채지 않는다"` 로 잠갔다 | 놓친 엣지케이스 → ✅ |
| 4 | plan 의 AC 목록에 **"식별자가 하나도 없는 멘션"** 케이스가 없었다(설계 본문에는 `@사용자` 로 적혀 있었는데 기준이 빠졌다) | ✅ **구현함 + AC 신설** — `::"식별자가 하나도 없는 멘션도 지우지 않는다"` | AC 보강(약화 아님) → ✅ |
| 5 | **이름 조회에 상한이 없다 — 0168 D1(P27)과 같은 계열인데 이번엔 *요청* 축이다.** 사람 60명을 나열한 페이지 × 배치 50페이지면 3,000번의 GET 이 나간다. plan 의 §파생 UX 는 "대개 한 자릿수" 라고만 적고 상한을 두지 않았다 | ✅ **구현함 + AC 신설** — `MAX_USER_LOOKUPS = 50`(페이지당), 초과분은 조회 없이 기본 라벨로 떨어지므로 **본문은 여전히 온전하다**. `::"멘션이 아주 많아도 조회 수에 상한을 둔다"` 가 조회 50건 + 자리표시자 0건을 함께 단언 | 명백한 누락(직전 라운드에서 축적한 패턴의 재발) → ✅ |
| 6 | **`mapWithLimit` 이 조회 실패를 삼켜 관측 지점이 0 이었다.** 사내 디렉터리가 조회를 막으면 모든 멘션이 `@사용자` 로 떨어지는데 로그조차 없다 — 0168 이 고친 "무성 실패" 를 같은 파일에서 다시 만들 뻔했다 | ✅ **구현함** — `confluence.mentions.lookup-failed`(실패 수/전체) · `confluence.mentions.truncated`(상한 절삭) 두 지점 로깅. **도구 결과에는 싣지 않는다** — P27 을 지켜 컨텍스트 표면을 늘리지 않고 로그로만 관측한다 | 명백한 누락 → ✅ |
| 7 | **다운로드 폴백이 취소·크기 초과에도 발동한다.** `ctx.signal` abort 는 "그만두라" 는 신호인데 두 번째 좌표를 두드리고, 상한 초과는 같은 파일이라 다시 받아도 같은 결과다 — 최악의 경우 대용량 파일을 상한까지 **두 번** 받는다 | ✅ **구현함 + AC 신설** — `isRetriableDownloadError`(HTTP 상태 실패만 재시도). `::"취소·크기 초과는 두 번째 다운로드 좌표로 재시도하지 않는다"` | 놓친 엣지케이스 → ✅ |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `storage-to-markdown.ts`(+`.test.ts`) · `connector.ts`(+`.test.ts`) · `rest.ts`(+`.test.ts`) · `download-store.ts`(+`.test.ts`) · `modules/confluence/AGENTS.md` |
| 게이트 결과 | lint **0 error**(warning 1 = 0102 베이스라인) · typecheck **3/3** · 모듈 vitest **8파일 167/167**(베이스라인 148 대비 **+19**) |
| **측정력 실측** | 소스 4파일만 stash 하고 재실행 → **17건 red**(선조치 5·7 의 회귀 2건을 더하기 전 시점). green 으로 남은 신규 2건은 AC3(위 이견 ②, 현행도 통과)과 AC8(멘션 없으면 조회 0건 — 자명 통과)이다 |
| 블로커 | 없음. **AC15(사람 실기) 미검증** — 사내 Confluence 접근 불가 |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (verify/FAIL 시 신설) | | | |
