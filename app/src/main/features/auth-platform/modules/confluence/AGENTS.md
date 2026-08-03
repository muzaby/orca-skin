# `modules/confluence/` — Confluence Data Center 플러그인 (0160)

사내 Confluence DC 를 **내장 MCP**(claude-agent-sdk `createSdkMcpServer`, 0158 배관)로 붙인다.
검색·페이지 Markdown 변환·첨부 다운로드만 하는 **read-only** 패키지다.

## 두 가지 사용 경로 (0161)

| 경로 | 서버 주소 출처 | 추가 방법 | 삭제 |
|---|---|---|---|
| **템플릿 인스턴스** (기본) | 사용자가 UI 에서 입력 | 플러그인 페이지 → **추가** → Confluence → 주소·자격증명 | UI 에서 가능 |
| **정적 등록** | `servers.ts` (코드) | 아래 절차 | 불가(코드로 배포) |

템플릿 경로는 별도 활성화가 필요 없다 — `confluenceTemplate` 이 `bootstrap.ts` 의
`ConnectorTemplateRegistry` 에 이미 등록돼 있고, 사용자가 만든 인스턴스는 설정
(`connectorInstances`)에 영속돼 재시작 후 복원된다.

## 정적 등록 (선택 — 사내 표준 서버를 미리 박아둘 때)

저장소 기본값은 `CONFLUENCE_SERVERS = []` + `AUTH_PLUGIN_PACKAGES = []` 다 — 사내 주소를 모르는
상태로 placeholder connector 를 등록하면 모든 사용자에게 연결되지 않는 카드가 보인다.

1. `servers.ts` 의 `CONFLUENCE_SERVERS` 에 서버를 적는다.
2. `../index.ts` 의 `AUTH_PLUGIN_PACKAGES` 에 한 줄 추가:

```ts
import { createConfluencePackage, CONFLUENCE_SERVERS } from './confluence'
export const AUTH_PLUGIN_PACKAGES = [createConfluencePackage(CONFLUENCE_SERVERS)]
```

그 외 코어 코드(broker·registry·IPC·UI)는 수정하지 않는다.

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
