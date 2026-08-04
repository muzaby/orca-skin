# Verify — 0160-confluence-connector-plugin

## 메타

| 항목 | 값 |
|---|---|
| slug | `0160-confluence-connector-plugin` |
| 검증자 | Claude Code |
| 일자 | 2026-08-04 |
| 대상 커밋 | `c0d1523` |
| 라운드 | 1 |
| 상태 | **PASS** (사람 실기 2건 대기) |
| 자기 검증 여부 | **예** — 설계·구현·검증 모두 Claude |

## 구현 결과 비판적 검토

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경 실패 방식 | **다뤄져 있다** | 첨부 하나 실패가 나머지를 죽이지 않는다(`failedAssets` 로 수집) · `maxAttachmentBytes` 상한 · `mapWithLimit` 동시성 상한 · 끊긴 연결의 `ctx.invoke` 는 **던진다**(성공으로 위장하지 않는다) |
| **잘못된 성공** 가능 경로 | **막혀 있다 — 실측 확인** | `connector.ts` `start()` 가 `/rest/api/user/current` 응답을 **JSON 파싱까지** 해야 `ready` 를 낸다. 상태코드만 봤다면 "인증 실패 시 로그인 HTML 을 200 으로 주는 배포" 를 통과시켰을 것 — 0157 D1 과 같은 함정을 이번엔 피했다 |
| 되돌릴 수 있는가 | **부분적** — 첨부 다운로드는 로컬 파일을 쓴다. 실패 시 `page.md` 는 남고 실패 자산은 `failedAssets` 로 보고된다. 경로 이탈은 `sanitizeAssetName`→`resolveAssetPath` 2단으로 차단 | `download-store.ts` |
| 설계가 의도한 것을 구현했는가 | **예** | 계약 4건이 전부 additive-optional 이고 `__fixtures__` 무변경 통과가 테스트로 고정 |
| 구현자 선조치 경계 | **지켰다** | 요구서의 사실오류 2건(패키지에 다운로드 도구가 없다 / fetch 직접)을 **결론은 유지한 채 근거만 교체**했고, `p-limit` 미도입은 신규 의존성 회피라 보수적 방향 |

## 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| `MAX_REDIRECT_HOPS` — 테스트 5회, 프로덕션 0 | **오탐** | 같은 파일 `broker.ts` 의 `sendFollowingRedirects` 가 쓴다(스크립트는 동일 파일 참조를 세지 않는다) |
| `ResponseTooLargeError` — 테스트만 | **오탐** | `authenticated-fetch.ts` 내부 `readBytesWithCap` 이 throw |
| `createLimiter`·`clampLimit`·`escapeCqlLiteral`·`buildSearchCql`·`XSRF_HEADER` — 테스트만 | **오탐(전부 동일 파일 내부 사용)** | `limit.ts`·`rest.ts` 각각 자기 파일의 상위 함수가 소비 |
| `assetsDirOf`·`relativeToDownloads`·`uniqueName` — 참조 0 | **⚠️ 확장점 — 근거 약함** | `download-store.ts` 가 export 하지만 프로덕션·테스트 어디서도 안 쓴다. 죽은 코드에 가깝다 → **D2** |
| **형제 비대칭** `[infra/auth] redirect: 'follow'(browser-session-store) ↔ 'manual'(authenticated-fetch)` | **의도된 차이 — 근거 있음** | 브라우저 세션은 IdP 리다이렉트를 따라가야 하고(0130), connector 는 **broker 가 hop 마다 origin 을 검사**해야 하므로 manual 이다. 0160 이 그 검사(`checkRedirect`)를 **처음으로 배선**했다 — 그전엔 호출자 0이었다 |
| `credentials: 'include' ↔ 'omit'` | **의도된 차이** | 세션 쿠키는 browser-session 만, connector 는 쿠키를 싣지 않는다(AUTH-PLAT) |

## 구현자 코멘트 확인

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `@atlassian-dc-mcp/confluence` 에 `confluence_downloadAttachment` 가 **있다**(요구서가 틀렸다) | **타당 — 1차 출처 대조가 실제로 수행됐다** | `npm pack` 실측 근거. 제외 결론은 다른 근거(stdio·env 단일 인증·Markdown 부재)로 유지 |
| `checkRedirect` 프로덕션 호출자 0건이 "빈 파일" 증상의 원인 | **타당** | 이번 scan 에서 `MAX_REDIRECT_HOPS` 가 프로덕션에 붙은 것을 재확인 |

## 요구사항 충족 매트릭스

인수 기준 31건 중 표본·핵심 축을 재측정했다(전수 1:1 은 아래 §자기 리뷰에 한계로 기록).

| 축 | 충족 | 증거 |
|---|---|---|
| 바이너리 수신(`responseType:'binary'`, 미지정=text 기본) | ✅ | `authenticated-fetch.ts` + `contracts/connector-plugin.ts` · `authenticated-fetch.test.ts` |
| `maxBytes` 상한 + 초과 시 `ResponseTooLargeError` | ✅ | 테스트 4케이스 |
| 허용 origin 내 redirect 추종 (`MAX_REDIRECT_HOPS`) | ✅ | `broker.test.ts` |
| `presentations`(mechanism 별) — 미선언 시 `presentation` 폴백 | ✅ | `confluence-package.test.ts` 가 PAT=`Bearer`·basic=`BasicPair` 를 고정 |
| `BasicPair` scheme (`user:pass`) | ✅ | `authenticated-fetch.test.ts` |
| id/pw 2필드 provider (`:` 거부) | ✅ | `basic-credential.test.ts` |
| storage XHTML → Markdown (cheerio `xmlMode`) | ✅ | `storage-to-markdown.test.ts` |
| 미지원 매크로를 지우지 않고 집계 | ✅ | 동 위 (`unhandledMacros`) |
| 첨부 경로 이탈 차단 | ✅ | `download-store.test.ts` — 선두 `..` → `_` |
| `readOnlyHint` 정직 선언(검색만 true) | ✅ | `tools.ts` + 승인 정책 테스트 |
| XSRF `X-Atlassian-Token: nocheck` | ✅ | `rest.test.ts` |
| **실 서버 검색·페이지·첨부** | ❌ **미검증** | 사내 DC 서버 필요 — 사람 실기 |
| **신규 의존성 4개 승인** | ❌ **미승인** | cheerio·turndown·turndown-plugin-gfm·@types/turndown — 사람 결정 |

## 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 아래 §게이트 |
| 인수 기준 ↔ 코드 대조 | ✅ | — | 표본 대조(전수 아님) |
| 레이어 경계 | ✅ | — | 위반 0 — `modules/confluence` 에 `vault`·전역 `fetch` import **0건**(`rg` 확인, AUTH-PLAT-009) |
| **신규 의존성 승인** | ✖ 제안 | ✅ | **대기** |
| **실 서버 실기** | ✖ | ✅ | **대기** |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
lint      → 0 error (warning 1 = 0102 useTranscriptVirtualizer 베이스라인)
typecheck → 0 error (3분할 전부)
vitest    → 1770 passed / Test Files 1 failed (chat-turn.continuity — electron egress, collection 단계)
          → 베이스라인 제외 시 실패 0건
scripts   → 28 pass / 0 fail
```

## 검증 자기 리뷰

- **설계 단계**: 좋았다. 계약 4건을 **실측 근거(`파일:라인`)와 함께** 열거했고 전부 additive-optional 로
  닫아 회귀 면적을 0으로 만들었다. 특히 `checkRedirect` 호출자 0건을 **grep 수치로** 짚은 것이
  "빈 파일" 증상의 진짜 원인을 찾게 했다.
- **구현 단계**: 선조치 경계를 지켰다. 요구서의 사실오류를 **결론이 아니라 근거만** 교체한 것이 옳다.
- **검증 단계 — 이번 verify 가 못 본 것**:
  - **인수 기준 31건을 1:1 로 전수 대조하지 않았다.** 축 단위 표본 대조이고, 각 축의 대표 테스트만
    확인했다. "31건 전부 ✅" 라고 쓰지 않는 이유다.
  - **네트워크 경로를 한 번도 실행하지 않았다.** `start()`·`search`·`attachments` 는 전부 더블 기반
    단위 테스트로만 검증됐다 — 실제 Confluence 응답 형상(특히 `expand` 조합·첨부 302)은 미확인.
  - `assetsDirOf` 등 미사용 export 3건을 **죽은 코드로 단정하지 않고 D2 로 넘겼다** — 후속 정리 대상.

## 파생 이슈

- **D2** — `download-store.ts` 의 `assetsDirOf`·`relativeToDownloads`·`uniqueName` 이 프로덕션·테스트
  모두 미참조. 확장점 의도라면 주석으로 근거를 남기고, 아니면 제거한다. (경미)
