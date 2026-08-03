# `modules/confluence/` — Confluence Data Center 플러그인 (0160)

사내 Confluence DC 를 **내장 MCP**(claude-agent-sdk `createSdkMcpServer`, 0158 배관)로 붙인다.
검색·페이지 Markdown 변환·첨부 다운로드만 하는 **read-only** 패키지다.

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
| `tools.ts` | `RuntimeToolContribution` — 도구 3종 | 선언 |
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
- **`readOnlyHint` 는 정직하게.** MCP 정의는 "환경을 변경하지 않는다" 다. 로컬에 파일을 쓰는
  `confluence_get_page`·`confluence_download_attachments` 는 `false`(승인 카드 경유), 검색만
  `true`. 원격 read-only 요구는 write 계열 **도구를 두지 않는 것**으로 지킨다.
- **cheerio 는 반드시 `xmlMode: true`.** HTML 파서로 읽으면 `ac:`/`ri:` 태그가 뭉개지고
  self-closing `<ri:attachment/>` 가 뒤 문단을 삼킨다.
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
