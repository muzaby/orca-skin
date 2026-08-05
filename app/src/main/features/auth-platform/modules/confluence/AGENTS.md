# `modules/confluence/` — Confluence Data Center 플러그인 (0160)

사내 Confluence DC 를 **내장 MCP**(claude-agent-sdk `createSdkMcpServer`, 0158 배관)로 붙인다.
검색·페이지 Markdown 변환·첨부 다운로드만 하는 **원격 read-only** 패키지다.

## 도구 2종 — 찾기와 읽기를 나눈다 (0164 r3)

사용자 재지정 2026-08-04. r2 는 검색 하나가 본문까지 끌고 왔는데, 그러면 **모든 검색이 파일을
쓰므로 승인 대상**이 된다. 나누면 탐색은 자유롭고 내려받기만 승인을 받는다.

| 도구 | 반환 | `readOnlyHint` |
|---|---|---|
| `confluence_search` | pageId · 제목 · **작성자** + 페이지네이션 좌표 (본문 없음) | `true` — 자동 허용 |
| `confluence_get_pages` | 받은 pageId 들의 **본문 Markdown + 첨부** | `false` — 승인 카드 |

```
search(CQL/text, limit≤50, start) → id·제목·작성자 목록 + nextStart
get_pages(pageIds[])             → storage XHTML → Markdown → 참조 첨부 다운로드
                                 → 본문을 그대로 텍스트로 반환
```

### 첨부 다운로드 — **변환기가 찾은 것만** 받는다 (0168 에서 구멍을 메움)

다운로드 대상의 **유일한 근거는 `storageToMarkdown` 의 `referencedAttachments`** 다. 순서상
변환이 먼저고 다운로드가 나중이다 — 첨부 목록을 보고 받는 구조가 아니다. 그래서 **변환기가 못
알아본 이미지는 아예 내려받지 않는다.**

0164 이전에는 "참조 0개면 페이지 첨부를 전부 받는" 폴백이 이 성질을 가리고 있었다. `354ffc7` 이
그 폴백과 `confluence_download_attachments` 도구를 함께 지우면서 **미검출 = 0건 다운로드**가 됐고,
사내 페이지의 이미지가 통째로 안 받아지는 회귀로 드러났다(사용자 보고 2026-08-05).

두 가지로 막는다:

1. **검출 범위** — `<ac:image><ri:attachment>` 계열(표 셀·매크로·`ac:layout-cell` 안 포함)에
   더해, 저장 형식에 날 `<img>` 로 들어앉은 첨부도 참조로 승격한다
   (`normalizeDownloadImages`). 승격 조건은 **셋 다** 만족할 때뿐이다 — ⓐ 스킴 없는
   host-relative ⓑ 경로가 `/download/attachments/` 또는 `/download/thumbnails/` 로 시작
   ⓒ 이름을 얻을 수 있음(`data-linked-resource-default-alias` 우선, 없으면 마지막 세그먼트를
   `decodeURIComponent`). **범위를 넓히지 마라** — `/images/icons/…` 같은 UI 리소스를 첨부로
   오인하면 받지도 못할 이름이 실패 목록에 쌓이고 본문 링크까지 깨진다.
2. **진단 가시화** — `includeAttachments` 면 **참조가 0개여도 첨부 목록을 조회**해
   `unreferencedAttachments` 로 돌려준다. 받지는 않는다. 조회를 건너뛰면 "첨부 없는 페이지" 와
   "이미지 참조를 못 알아본 페이지" 가 같은 출력이 되어 검출 실패가 무성으로 묻힌다.
   **이 조회는 진단 전용이라 실패해도 페이지를 죽이지 않는다**(`collectAttachments` 가 참조 0개일
   때만 삼킨다) — 참조가 있을 때의 목록 실패는 "받을 수 없음" 이므로 그대로 전파한다.

> **폴백을 되살리지 마라.** "참조를 못 찾으면 전부 받기" 는 사용자가 명시적으로 배제했다
> (2026-08-05) — 쓰지 않는 파일이 디스크에 쌓인다. 검출이 부족하면 **검출 규칙을 넓히고**,
> 무엇이 부족한지는 위 2번의 진단 출력이 알려 준다.

### 버전과 다운로드 좌표 (0169)

- **받는 것은 항상 목록 조회 시점의 현재 버전**이다. 본문 URL 의 `?version=N` 은 *삽입 시점*
  버전이라 따르지 않는다 — `parseDownloadHref` 가 쿼리를 버리고 파일명만 쓰며, 대조 대상은
  `expand=version` 으로 받은 **현재** 첨부 목록이다. 받은 번호는 `SavedAsset.version` 과
  `manifest.json` 에 남아 사후 확인이 된다.
- **다운로드 좌표는 둘이다.** ⓐ `/child/attachment/{id}/data`(현행, 302 로 실제 파일에 넘긴다)
  → 실패 시 ⓑ 목록이 준 `_links.download`(`/download/attachments/…`). Atlassian 문서상 `/data`
  는 *업로드(POST)* 좌표이고 Cloud 전용 `GET …/download` 는 Server 에서 404 라, DC 에서 확실한
  좌표는 ⓑ 다. **그래도 ⓐ 를 먼저 쓴다** — 실동작이 실측돼 있어 교체는 회귀 위험만 만든다.
- `_links.download` 는 `_links.base`(origin + 컨텍스트 경로) 기준 **상대 경로**다.
  `attachmentDownloadRequest` 가 `apiBasePath` 를 붙이고 쿼리를 `query` 로 분해한다 — 경로에
  `?` 를 남기면 인코딩이 두 번 된다.

## 멘션(`@이름`)은 지우지 않는다 (0169)

저장 형식의 멘션은 `<ac:link><ri:user ri:userkey="…"/></ac:link>` 다. `ri:page` 도
`ri:attachment` 도 아니라서, 분기가 없던 동안 라벨이 빈 문자열이 되고 `replaceWith('')` 로
**통째로 사라졌다**(사용자 보고 2026-08-05).

```
ac:plain-text-link-body 있음 → 그 텍스트          (저자가 쓴 표기가 가장 정확하다)
ri:username 있음             → @<username>        (REST 조회 불필요)
ri:userkey 있음              → @{{user:<key>}}    (자리표시자 — connector 가 이름으로 치환)
셋 다 없음                    → @사용자
```

- **변환기는 네트워크를 모른다.** `storage-to-markdown.ts` 는 키를 `referencedUsers` 로 모으기만
  하고, `connector.ts` 의 `resolveMentions` 가 `/rest/api/user?key=` 로 표시 이름을 얻어
  (`displayName` → `username` 폴백) 치환한다. 키당 1회, 멘션 0이면 0회.
- **자리표시자가 본문으로 새면 안 된다.** 조회가 403·404 여도 마지막에 **남은 토큰을 전부**
  `사용자` 로 훑어 치운다. 조회 실패는 페이지를 죽이지 않는다.
- **토큰에 `_`·`*`·`[` 를 쓰지 마라** — turndown 이 이스케이프해 `\{\{user...` 로 깨진다.

### 페이지네이션 — 오프셋은 **서버가 적용한 limit** 으로 민다

사용자 결정 2026-08-04: "1턴의 limit 은 50까지, 단 **허용치가 낮으면 해당 숫자를 따른다**.
개수가 더 많은 경우 offset 을 해당 크기로 두어 다시 limit 만큼 검색한다."

- 요청 `limit` 은 `MAX_SEARCH_LIMIT`(50)에서 잘린다.
- **응답의 `limit` 이 실효 페이지 크기다.** Confluence 는 사이트 설정에 따라 더 낮은 값을
  적용하고 그 사실을 응답으로 알린다 — 요청값(50)을 더해 오프셋을 밀면 그 사이 결과가 통째로
  건너뛰어진다. `parseSearchResponse` 가 실효값으로 `nextStart` 를 **계산해서** 준다.
- 렌더러는 `start: <숫자>` 를 문장으로 찍는다 — 모델이 직접 더하게 두지 않는다.
- 다음이 있는지 판정: `totalSize` 를 주면 `start + size < totalSize`, 없으면 "한도를 채워 왔다"
  (`size >= limit`)를 신호로 본다.

### 작성자

`expand=space,version,history` 로 받아 `history.createdBy.displayName` 을 쓴다. history 확장이
빠진 배포는 `version.by.displayName`(마지막 수정자)으로 폴백하고, 그마저 없으면 **필드를 아예
싣지 않는다**(빈 문자열 금지).

### 그 밖의 규칙

- **connector operation 도 도구와 1:1** (`search`·`pages`). `invoke` 를 부르는 곳은 도구 handler
  뿐이라 그 밖의 분기를 남기면 아무도 부르지 않는 코드가 된다(자격증명 검증은 `start()` 가 한다).
- **`get_pages` 도 한 번에 50개까지**. 페이지 하나가 조회 + 첨부 다운로드를 끌고 오므로 상한이
  필요하다. 넘긴 id 는 버리지 않고 `skippedPageIds` 로 되돌려 준다.
- **`includeAttachments:false` 는 첨부 관련 요청을 0으로 만든다** — 다운로드도 진단 조회도 없다.
  받지 않겠다고 한 호출자에게 추가 요청을 물리지 않는다.
- **결과를 JSON 으로 감싸지 않는다.** `JSON.stringify` 를 거치면 Markdown 줄바꿈이 `\n` 두 글자로
  새어 나온다(0164 r2 실측). 텍스트 조립은 `search-render.ts` 가 한다.

## 두 가지 사용 경로 (0161 → 0164 로 기본값 반전)

| 경로 | 서버 주소 출처 | 추가 방법 | 삭제 |
|---|---|---|---|
| **정적 등록** (기본) | `servers.ts` (코드) | 그 파일의 배열을 채운다 | 불가(코드로 배포) |
| 템플릿 인스턴스 | 사용자가 UI 에서 입력 | **디버그 패널에서 "서버 추가 버튼 노출" 을 켠 뒤** 플러그인 페이지 → 추가 | UI 에서 가능 |

**서버 목록의 정본은 빌드타임이다** (사용자 결정 2026-08-03 — "빌드타임에서 2개의 컨플루언스
등록 … base url 수정은 안된다"). UI 추가 경로는 코드에 남아 있지만 `Tweaks.pluginAddEnabled`
(기본 `false`) 뒤에 있어 일반 사용자에게 노출되지 않는다. **인증만 런타임**이다 — PAT·ID/비밀번호는
매번 사용자가 입력한다(binding 은 비영속, 0157).

## 정적 등록 — `servers.ts` **한 파일만** 고친다

`AUTH_PLUGIN_PACKAGES` 배선은 이미 켜져 있다(0164). 저장소 기본값은 `CONFLUENCE_SERVERS = []` 라
provider 2종만 등록되고 connector 는 0개다 — 사내 주소를 모르는 상태로 placeholder 를 넣으면
모든 사용자에게 연결되지 않는 카드가 보이기 때문이다.

```ts
export const CONFLUENCE_SERVERS: readonly ConfluenceServerConfig[] = [
  { id: 'confluence-dc', label: '사내 위키', baseUrl: 'https://wiki.corp' },
  { id: 'confluence-lab', label: '연구소 위키', baseUrl: 'https://rnd.corp',
    apiBasePath: '/confluence' }
]
```

**`id` 는 한 번 정하면 유지한다** — 도구 이름(`mcp__<server>__<tool>`)·승인 키·다운로드 경로가
파생되고 대화 기록에 남는다. 주소만 바뀌면 `baseUrl` 만 고친다.

그 외 코어 코드(broker·registry·IPC·UI)는 수정하지 않는다. 서버 N개는 **한 패키지** 안에
들어가므로 provider 중복 문제가 없다(패키지 2분할은 인스턴스 경로에만 필요하다).

## 주소 규칙 (두 경로 공통)

- `baseUrl` 은 **경로 없는 origin** 이어야 한다(manifest `OriginSchema`).
- 컨텍스트 경로(`https://wiki.corp/confluence`)는 `apiBasePath: '/confluence'` 로 분리한다.
  `checkRequestPath` 가 상대 경로 prefix 를 허용하므로 계약 변경 없이 성립한다.
- **`normalizeServerConfig` 가 흔한 실수를 흡수한다** (0164 r2). 끝의 `/` 와 주소에 붙은 경로는
  자동으로 origin + `apiBasePath` 로 갈린다 — 그 한 글자가 패키지 등록을 통째로 거부시키고
  (all-or-nothing) 서버가 UI 에서 전부 사라지기 때문이다. 해석조차 안 되는 값(스킴 없음 등)은
  손대지 않고 manifest 가 거부하며, 그 사유는 **플러그인 탭 배너**(`orca:plugin:diagnostics`)에
  뜬다.
- 템플릿 인스턴스는 `connectorId` 가 **host+컨텍스트 경로에서 파생**되므로(0161) 같은 host 의
  다른 경로가 서로 다른 서버가 되고, **주소는 생성 후 바꿀 수 없다**(수정 = 도구 이름·승인 키·
  다운로드 경로의 이동). 바꾸려면 삭제 후 재생성한다.

## 파일 구성 — 취득과 가공을 모듈로 나눈다

| 파일 | 책임 | 순수? |
|---|---|---|
| `servers.ts` | 정적 서버 목록 (정적 경로에서만 쓴다) | 데이터 |
| `index.ts` 의 `confluenceTemplate` | 템플릿 — `sharedPackage`(provider 2) + `instancePackage`(connector+tools) | 선언 |
| `rest.ts` | 요청 서술자 — 경로·CQL 이스케이프·XSRF 헤더 | ✅ 순수 |
| `storage-to-markdown.ts` | storage XHTML → Markdown + 참조 첨부·미지원 매크로 수집 | ✅ 순수 |
| `limit.ts` | 동시성 세마포어 (`p-limit` 미도입) | ✅ 순수 |
| `download-store.ts` | 파일명 위생·경로 이탈 차단(순수) + 쓰기(I/O) | 반반 |
| `connector.ts` | `ConnectorRuntimeV1` — 위 셋을 순서대로 부르는 오케스트레이션 | I/O |
| `search-render.ts` | 도구 결과 → 모델에게 줄 텍스트 (`renderSearchResult` · `renderPagesResult`) | ✅ 순수 |
| `tools.ts` | `RuntimeToolContribution` — 도구 2종(`confluence_search` · `confluence_get_pages`) | 선언 |
| `index.ts` | manifest + 패키지 조립 (manifest 는 구현에서 **파생**) | 조립 |

## 이 모듈이 존재하는 이유

`@atlassian-dc-mcp/confluence@0.29.0` 는 검색·조회·첨부 다운로드를 이미 갖고 있다(실측 —
요구서가 "다운로드 도구가 없다" 고 적은 것은 사실과 다르다). 그럼에도 자체 구현한 이유는:

1. **stdio 별도 프로세스**라 in-process `RuntimeToolContribution` 계약에 맞지 않는다.
2. 인증이 `CONFLUENCE_API_TOKEN` **env 하나**뿐이라 ID/비밀번호를 받을 수 없다.
3. **Markdown 변환이 없다** — storage XHTML 을 그대로 준다(사용자: "기능이 부족하여 api 호출후
   추가적인 변환과정을 처리하여 반환하는 것이 목적").
4. 쓰기 도구 2종을 기본 포함한다.

그 경로는 여전히 열려 있다 — `sources/mcp/mcp.json` 에 등록하면 코드 0줄로 병행 사용 가능하다.

## 규칙

- **raw credential 을 보지 않는다.** `ctx.authenticatedFetch` 만 부른다 — vault·secret·전역
  `fetch` import 가 이 디렉터리에 하나도 없어야 한다(AUTH-PLAT-009).
- **`readOnlyHint` 는 정직하게.** MCP 정의는 "환경을 변경하지 않는다" 다. `confluence_search` 는
  아무것도 쓰지 않으므로 `true`(자동 허용), 페이지 Markdown·첨부를 로컬에 쓰는
  `confluence_get_pages` 는 `false`(승인 카드 경유)다. **도구 경계를 이 선언에 맞춰 그었다** —
  둘을 합치면 모든 검색이 승인 대상이 된다. 원격 read-only 요구는 write 계열 **도구를 두지 않는
  것**으로 지킨다.
- **cheerio 는 반드시 `xmlMode: true`.** HTML 파서로 읽으면 `ac:`/`ri:` 태그가 뭉개지고
  self-closing `<ri:attachment/>` 가 뒤 문단을 삼킨다.
- **표는 turndown 에 넘기기 전에 정규화한다** (0164 r2). turndown-plugin-gfm 의 `table` 규칙은
  **머리글 행이 있는 표만** 변환하고 나머지는 `keep()` 으로 **원본 HTML 을 그대로 뱉는다**.
  Confluence 저장 형식은 세 가지가 다 걸린다: ⓐ `<colgroup>` 이 `<tbody>` 앞에 있으면
  `isFirstTbody()` 가 false → 제거한다, ⓑ 머리글 행이 없으면 첫 행을 `<th>` 로 승격한다,
  ⓒ 셀 안 `<p>` 가 둘 이상이면 행이 끊기므로 `<br>` 로 잇는다(셀 안 `<br>` 은 리터럴로 남긴다 —
  turndown 기본 규칙의 `"  \n"` 은 표를 깬다). **표 테스트 fixture 는 실제 저장 형식으로 쓴다** —
  `<table><tbody>` 축약 fixture 만 있었기 때문에 이 회귀를 테스트가 잡지 못했다.
- **매크로 전처리를 turndown 보다 먼저.** turndown 은 표준 HTML 만 안다.
- **미지원 매크로를 지우지 않는다.** 이름이 보이는 인용블록으로 남기고 `unhandledMacros` 에
  집계한다 — 조용한 내용 소실이 가장 나쁜 결과다.
- **첨부 파일명은 원격이 준 값이다.** `sanitizeAssetName` → `resolveAssetPath` 를 반드시 거친다.
  선두 `..` 는 `_` 로 바꾼다 — `isWithinDir` 이 `relative()` 결과의 `..` 접두사로 판정해서
  **파일명**이 경로 이탈로 오판되기 때문이다(`infra/config/paths.ts:72-75`).
- **바이너리는 `responseType:'binary'` + `X-Atlassian-Token: nocheck` 를 함께.** 전자가 없으면
  UTF-8 로 손상되고, 후자가 없으면 XSRF 보호에 걸려 403 이 온다.
- 도구 handler 는 `RuntimeToolResult`(`content` 필수)를 반환한다. `ctx.invoke` 결과를 그대로
  흘리지 마라(0158 verify r1 D5). 끊긴 연결의 예외는 **잡지 않는다** — SDK 가 `isError` 로 바꾼다.

## 게이트

```
cd app && npm run lint && npm run typecheck
./node_modules/.bin/vitest run src/main/features/auth-platform/modules/confluence/
```

새 서버를 추가해도 테스트는 그대로다 — `confluence-package.test.ts` 가 factory 를 두 서버로
호출해 ID 파생과 이름 충돌 없음을 고정한다.
