# Plan — 0168-confluence-image-download-regression

## 메타

| 항목 | 값 |
|---|---|
| slug | `0168-confluence-image-download-regression` |
| 작성자 | Claude Code |
| 일자 | 2026-08-05 |
| 매핑 | PHASES 미등록 (0164 후속 버그수정) |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "컨플루언스 플러그인에서 get pages 동작에 대해 다시 한 번 검토하라. **본문 첨부 이미지 다운로드가 안된다.** 마크다운 관련 수정 요청전엔 됐었는데 안되고 있다." | 라이브 세션 요청 2026-08-05 |
| 명시 요구 | 두 가설을 지목 — ⓐ "마크다운 변환전에 본문 이미지 다운로드를 수행하고 있는지?" ⓑ "혹시 변환 후의 링크 재조정에 따라 다운로드가 안되는건지" | 라이브 세션 요청 2026-08-05 |
| 명시 결정 | 수정 범위 = **"검출 확장 + 진단 가시화"** — raw `<img>` 를 참조로 인식하고, 참조 0개여도 첨부 목록을 조회해 진단을 결과에 남긴다. **엄격 필터(참조한 것만 받기)는 유지**, "전부 받기" 폴백은 복원하지 않는다 | 라이브 세션 선택지 응답 2026-08-05 |
| 추론 의도 | 사용자 페이지의 이미지가 `<ac:image>` 가 아닌 형식일 것이라는 것은 **추론**이다 — 실서버 본문을 보지 못했다. 그래서 이 작업은 검출 확장(추론 기반)과 **진단 가시화**(추론에 의존하지 않음)를 함께 낸다 | §자료조사 R7 |

## Context (왜)

`confluence_get_pages` 가 본문 이미지를 로컬에 내려받지 못한다. 사용자는 "마크다운 수정 이전에는
됐다" 고 보고했고, `git log` 대조 결과 그 마크다운 수정 커밋(`354ffc7`)이 **"참조를 못 찾으면
페이지 첨부를 전부 받는" 암묵적 폴백을 함께 제거**한 것이 확인됐다(§자료조사 R4). 즉 이전에는
변환기가 이미지를 인식하지 못해도 폴백이 파일을 채워 "되는 것처럼" 보였고, 폴백이 사라진 지금은
**검출 실패 = 0건 다운로드**가 된다.

의도한 결과는 둘이다. ⓐ 실제로 쓰이는 이미지 표현을 더 인식해 다시 받아지게 한다. ⓑ 그래도 못
받는 경우 **왜 못 받았는지가 도구 결과에 보이게** 한다 — 지금은 참조가 0개면 첨부 목록 조회조차
건너뛰어 `failedAssets` 도 비고, 모델·사용자 모두에게 "첨부 없는 페이지"로 보인다(무성 실패).

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **전제 정정** — 사용자가 지목한 두 가설은 **둘 다 원인이 아니다.** ⓐ 다운로드는 변환 *후* 가 맞지만 그 순서 자체는 결함이 아니다(변환이 수집한 참조가 대상 목록이다). ⓑ 링크 재조정은 markdown `src` 에만 적용되고 조회·저장은 원본 이름으로 하므로 다운로드를 깨뜨리지 않는다. 실제 원인은 **`354ffc7` 이 제거한 "참조 0개 → 전부 받기" 폴백**이다. 요구의 *목적*(이미지가 다시 받아질 것)은 그대로 유지한다 | `connector.ts:257,265-268` · `storage-to-markdown.ts:91-93` · `download-store.ts:106` · §자료조사 R2·R3·R4 |
| 이미 있는 것 아닌가 | **아니다** — 검출은 `ac:image` 한 형식만 처리하고(`storage-to-markdown.ts:85`, 전수 grep N=1), raw `<img>` 를 참조로 삼는 코드는 0곳이다. 진단 필드도 없다 | `storage-to-markdown.ts:84-106` · `connector.ts:98-110` |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **있고, 그것을 택한다** — 신규 모듈·스키마·IPC 없이 순수 변환기 한 함수 확장 + 결과 타입 필드 1개 추가로 끝난다. 폴백 복원(더 작아 보이는 길)은 **사용자가 명시적으로 배제**했고, "쓰지 않는 파일이 디스크에 쌓인다"는 기존 근거와도 충돌한다 | `connector.ts:300` 주석 · 사용자 결정 2026-08-05 |
| 인용 자료가 요구를 부풀리지 않았나 | **해당 없음(부풀림 0)** — 이번 근거는 전부 이 저장소의 코드·`git log`·이번 세션 실측이다. 선행 보고서·외부 연구를 입력으로 쓰지 않았다 | §자료조사 전 항목 |
| 기존 채택 결정을 뒤집는가 | **1건 뒤집는다** — "본문이 참조하지 않으면 첨부 목록 조회조차 하지 않는다". 조회는 하되 **다운로드는 여전히 안 한다**로 좁혀 뒤집는다(진단 목적). 나머지 결정(엄격 필터·파일명 위생·xmlMode·매크로 전처리 순서)은 유지 | §기존 결정·규칙과의 관계 |

- **사용자에게 올릴 것**(단독 결정 불가): 없음. 유일한 결정 사항(폴백 복원 여부)은 2026-08-05 에
  "검출 확장 + 진단 가시화" 로 이미 답을 받았다.

## 자료조사 (Research)

| # | 발견 / 제약 | 레퍼런스 |
|---|---|---|
| R1 | **다운로드는 마크다운 변환 *후*다.** `fetchPage` 가 `storageToMarkdown(storage)` 를 먼저 부르고, 그 결과의 `referencedAttachments` 가 다운로드 대상의 **유일한 근거**다. 첨부 목록을 먼저 보고 받는 구조가 아니다 | `app/src/main/features/auth-platform/modules/confluence/connector.ts:257,265-268` |
| R2 | **링크 재조정은 다운로드에 영향이 없다.** `referenced.add(filename)` 은 **원본 이름**을 담고, `sanitizeAssetName` 은 markdown `src` 에만 적용된다. 저장 시 `saveAsset(item.title, …)` 이 같은 sanitize 를 다시 적용하므로 링크와 실제 파일명이 일치한다 | `storage-to-markdown.ts:91-93` · `download-store.ts:106-116` |
| R3 | **전송 계층은 정상이며 이 회귀와 무관하다.** `responseType:'binary'` → `readBytesWithCap` 로 `bodyBytes` 가 채워지고, 302 는 broker 가 origin 재검사 후 추종하며 `SendOptions`(binary·maxBytes)를 홉마다 유지한다. 경로 정책(`checkRequestPath`)은 **절대 URL 만** 막으므로 `/download/...` 리다이렉트를 거부하지 않는다 | `infra/auth/authenticated-fetch.ts:121-134,152-169` · `features/auth-platform/broker.ts:304-356` · `features/auth-platform/policy.ts:39-44,101-105` |
| R4 | **회귀의 정확한 출처 — `354ffc7 fix(confluence): 검색 한 번으로 본문까지, 표 변환과 등록 가시성 복구`**(사용자가 말한 "마크다운 관련 수정" 그 커밋). 두 가지를 동시에 지웠다: ⓐ `filenames.length === 0 ? listed : …` — 참조 0개면 **페이지 첨부 전부 다운로드**하던 폴백 ⓑ `confluence_download_attachments` 도구(파일명 생략 = 전부 받기)라는 수동 우회로. 추가로 `includeAttachments && referencedAttachments.length > 0` 가드가 붙어 참조 0개면 **첨부 목록 조회조차** 안 한다 | `git show 354ffc7 -- app/src/.../connector.ts` · 현행 `connector.ts:265-268,301` · `tools.ts:CONFLUENCE_TOOL_NAMES` |
| R5 | **`ac:image` 계열 검출은 현재도 온전하다 — 이번 세션 실측.** 임시 probe 로 실제 저장 형식 10종을 `storageToMarkdown` 에 통과시킨 결과: 기본형·`ri:version-at-save`·`ac:caption` 동반·**표 셀 안**·**expand 매크로 안**·**`ac:layout-cell` 안**·공백/한글 파일명·타 페이지 첨부(`ri:page` 자식) **8종 모두 `referencedAttachments` 에 잡힌다.** 표 정규화(`normalizeTables`)는 `normalizeImages` 뒤에 돌아 검출에 영향이 없다 | 이번 세션 실측(임시 probe, 결과만 기록 후 파일 삭제) · `storage-to-markdown.ts:67-70` |
| R6 | **실측에서 검출되지 않은 형식 2종.** ⓐ `<img class="confluence-embedded-image" src="/download/attachments/12345/foo.png?version=1&api=v2" data-linked-resource-default-alias="foo.png">` → `referencedAttachments = []`, markdown 링크도 서버 상대경로로 남는다 ⓑ `<ac:link><ri:attachment ri:filename="spec.pdf">` (이미지가 아닌 첨부 링크) → 설계상 대상 아님 | 이번 세션 실측(R5 와 같은 probe) |
| R7 | **사용자 페이지가 어느 형식인지는 확인하지 못했다.** 사내 Confluence 에 접근할 수 없어 실제 `body.storage.value` 를 보지 못했다. 따라서 "raw `<img>` 라서 안 된다"는 **가설**이며, 이 작업은 가설이 틀려도 다음 실행에서 원인이 드러나도록 **진단 출력**을 함께 넣는다 | (조사 한계 — 명시) |
| R8 | **무성 실패 경로.** 참조가 0개면 `downloads = { assets: [], failed: [] }` 로 고정되어 `failedAssets` 도 비고, `renderPage` 는 첨부 관련 줄을 **하나도 찍지 않는다**. 모델에게는 "첨부 없는 페이지"와 구분되지 않는다 | `connector.ts:265-268` · `search-render.ts:78-90` |
| R9 | **현행 동작을 잠근 기존 테스트 1건.** `'본문이 첨부를 참조하지 않으면 첨부 목록조차 조회하지 않는다'` 가 attachment 경로 요청 0건을 단언한다 — 이번 변경이 이 테스트를 **의도적으로 뒤집는다**(갱신 대상) | `connector.test.ts:435-445` |
| R10 | **모듈 게이트 베이스라인 (이번 세션 직접 측정)**: `vitest run src/main/features/auth-platform/modules/confluence/` → **8 파일 / 132 테스트 전부 통과**, 1.96s | 이번 세션 실행 |
| R11 | **레이어 제약**: 변경 대상 4파일이 전부 같은 feature 슬라이스(`features/auth-platform/modules/confluence/`) 안이라 `boundaries` 교차 위반이 생기지 않는다. 이 디렉터리는 `vault`·`secret`·전역 `fetch` import 가 0이어야 한다(AUTH-PLAT-009) — 이번 변경은 import 를 늘리지 않는다 | `app/eslint.config.mjs` (`src/main/**` 블록) · `modules/confluence/AGENTS.md §규칙` |

## 인수 기준 (Acceptance Criteria)

> 공통 프로덕션 도달 경로(P): `tools.ts` `confluence_get_pages` handler → `ctx.invoke('pages')`
> → `connector.ts` `invoke` → `fetchPages` → `fetchPage` → (`storageToMarkdown` / `downloadAttachments`)
> → `search-render.ts` `renderPagesResult`. 아래 표의 `프로덕션 도달 경로` 칸은 그 경로 중
> **이 AC 가 닿는 구간**을 적는다.

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `<img src="/download/attachments/123/foo.png?version=1&api=v2">` 가 `referencedAttachments` 에 `foo.png` 로 실리고 markdown 이 `assets/foo.png` 를 가리킨다 | `storage-to-markdown.test.ts::"download 경로 img 를 첨부 참조로 인식한다"` | `fetchPage` → `storageToMarkdown` (`connector.ts:257`) |
| 2 | `data-linked-resource-default-alias` 가 있으면 그 값이 파일명이 된다 (`src` 마지막 세그먼트보다 우선) | `storage-to-markdown.test.ts::"data-linked-resource-default-alias 를 파일명으로 우선한다"` | 〃 |
| 3 | `/download/thumbnails/123/bar.png` 도 참조로 인식한다 | `storage-to-markdown.test.ts::"thumbnails 경로도 첨부 참조다"` | 〃 |
| 4 | percent-encoded 경로 세그먼트(`%ED%85%8C%EC%8A%A4%ED%8A%B8.png`)를 디코드한 이름으로 싣는다 | `storage-to-markdown.test.ts::"인코딩된 파일명을 디코드해 참조로 싣는다"` | 〃 |
| 5 | 절대 URL `<img src="https://cdn.example.invalid/x.png">` 는 `src` 를 그대로 유지하고 참조에 넣지 않는다 | `storage-to-markdown.test.ts::"외부 절대 URL img 는 참조가 아니다"` | 〃 |
| 6 | `/download/` **밖**의 host-relative img(`/images/icons/emoticons/smile.png`)를 담은 페이지를 받으면 `assets` 가 비고 **`failedAssets` 도 빈 배열**이다 (오탐이 실패로 새지 않는다) | `connector.test.ts::"download 경로 밖 img 는 첨부 후보가 아니다"` | `fetchPage` → `downloadAttachments` (`connector.ts:265-268,293`) |
| 7 | 같은 파일을 `ac:image` 와 raw `<img>` 가 함께 가리켜도 `referencedAttachments` 에 1건만 실린다 (`ac:image` 가 만든 `assets/…` img 가 2차 인식되지 않는 것 포함) | `storage-to-markdown.test.ts::"같은 첨부를 두 형식이 가리켜도 한 번만 센다"` | `fetchPage` → `storageToMarkdown` |
| 8 | raw `<img>` 의 `alt` 가 비어 있으면 파일명을 alt 로 쓴다 (`ac:image` 경로와 같은 규칙) | `storage-to-markdown.test.ts::"alt 가 없으면 파일명을 쓴다"` | 〃 |
| 9 | `includeAttachments` 기본값에서 본문 참조가 0개여도 첨부 목록을 **1회** 조회하고, 목록의 제목 전부가 결과의 `unreferencedAttachments` 에 실린다 | `connector.test.ts::"참조가 없어도 첨부 목록을 조회해 진단으로 남긴다"` | `fetchPage` → `attachmentListRequest` (`connector.ts:299`) |
| 10 | 참조가 있는 페이지에서, 목록에 있으나 본문이 참조하지 않은 첨부 이름이 `unreferencedAttachments` 에 실리고 **다운로드는 참조분만** 이뤄진다 | `connector.test.ts::"참조 밖 첨부는 받지 않고 이름만 남긴다"` | 〃 |
| 11 | `includeAttachments:false` 면 attachment 경로 요청이 0건이고 `unreferencedAttachments` 가 빈 배열이다 | `connector.test.ts::"includeAttachments:false 면 첨부 목록도 조회하지 않는다"` (기존 케이스에 단언 추가) | 〃 |
| 12 | `manifest.json` 에 `unreferencedAttachments` 가 기록된다 | `connector.test.ts::"manifest 에 참조 밖 첨부를 기록한다"` | `fetchPage` → `store.saveText('manifest.json')` (`connector.ts:289`) |
| 13 | 내려받은 첨부가 0개인데 `unreferencedAttachments` 가 있으면 `renderPagesResult` 가 "본문에서 이미지 참조를 찾지 못했습니다" 취지의 문장과 첨부 이름 목록을 함께 싣는다 | `search-render.test.ts::"참조를 못 찾았는데 첨부가 있으면 그 사실을 말한다"` | `tools.ts` handler → `renderPagesResult` (`search-render.ts:74-101`) |
| 14 | 내려받은 첨부가 있고 참조 밖 첨부도 있으면 두 줄이 **모두** 나온다 | `search-render.test.ts::"내려받은 첨부와 참조 밖 첨부를 함께 보고한다"` | 〃 |
| 15 | 사내 Confluence 페이지 id 로 `confluence_get_pages` 를 호출하면 `<downloads>/confluence/<connectorId>/<pageId>/assets/` 에 이미지 파일이 생기고, 도구 결과에 내려받은 첨부 줄이 보인다 | **사람 실기** — 실행 경로: `servers.ts` 에 사내 서버 등록 → `npm run dev` → 플러그인 탭에서 PAT/ID·비밀번호로 연결 → 채팅에서 `confluence_search` 로 pageId 확보 → `confluence_get_pages` 승인 → 다운로드 디렉터리 확인 | 도구 전체 경로 (P) |
| 16 | 사내 페이지에서 여전히 0건이면, 도구 결과가 **페이지 첨부 이름 목록**을 보여 주어 다음 조치(어떤 형식을 더 인식할지)를 정할 수 있다 | **사람 실기** — 실행 경로: AC15 와 같되 결과 텍스트의 "참조 밖 첨부" 줄을 읽는다 | 〃 |

> AC5·AC8 은 **새 규칙이 과잉 검출로 새지 않는 것**을 잠그는 가드다(현행 코드도 통과한다 — 측정
> 대상은 이번에 추가하는 후보 규칙이지 현행 동작이 아니다). AC6 은 같은 성질이지만 connector
> 통합 지점에서 재므로 새 동작을 측정한다.

## 범위 / 비범위

- **범위**:
  1. `normalizeImages` 확장 — host-relative `/download/{attachments,thumbnails}/…` `<img>` 를 첨부 참조로 인식하고 `assets/<위생화 이름>` 으로 재작성.
  2. `ConfluencePageResult.unreferencedAttachments: string[]` 추가 — `includeAttachments` 면 참조 0개여도 목록을 조회해 채운다(**다운로드는 하지 않는다**).
  3. `renderPagesResult` 진단 줄 + `manifest.json` 기록.
  4. `modules/confluence/AGENTS.md` 갱신 (뒤집는 규칙 1건 + 새 검출 규칙).
- **비범위**:
  - "참조 0개면 전부 받기" 폴백 복원 · `confluence_download_attachments` 도구 부활 (사용자가 배제).
  - 타 페이지 첨부(`ri:attachment` 의 `ri:page` 자식) 해석 — 지금도 이름은 잡히나 이 페이지 목록에 없어 실패로 보고된다.
  - `uniqueName` 충돌 시(같은 위생화 이름 2건) markdown 링크가 `-1` 접미사 파일을 못 가리키는 기존 엣지.
  - 첨부 목록 200건 초과 페이지의 페이지네이션.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 폴백 복원 | 아니오 — 되돌릴 수 있음. 동작 스위치일 뿐 이름·스키마가 걸리지 않는다 |
| 타 페이지 첨부 해석 | 아니오 — 실패 사유가 이미 결과에 남아 추적 가능하고, 추가 시 기존 필드를 재해석하지 않는다 |
| `uniqueName` 링크 desync | 아니오 — 저장 파일명 규칙만 바꾸면 되고 외부 소비자가 없다 |
| 첨부 목록 페이지네이션 | 아니오 — 요청 파라미터 변경이라 되돌릴 수 있다 |
| **`unreferencedAttachments` 라는 필드 이름** | **예 — 일방향에 가깝다.** `manifest.json` 에 기록되어 디스크에 남고 도구 결과 문장에 반영된다. 다만 소비자가 **이 저장소 안(렌더러 문자열·매니페스트)뿐**이고 IPC·DB 스키마·도구 *이름* 이 아니라서 개명 비용이 0164 의 도구명 사례(P16)와 다르다 — **지금 이 이름으로 확정하고 진행**한다 |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `cheerio`(xmlMode) · `turndown` + `turndown-plugin-gfm` · `sanitizeAssetName`/
  `resolveAssetPath`(`download-store.ts`) · `mapWithLimit`/`partitionSettled`(`limit.ts`) ·
  `attachmentListRequest`/`attachmentDataRequest`(`rest.ts`).
- 전제: 첨부 목록의 `results[].title` 이 본문의 파일명과 문자열로 일치한다(현행 매칭 규칙 유지,
  `connector.ts:301`).
- **신규 의존성: 없음.** 새 패키지를 추가하지 않는다.

## 설계

**핵심은 "검출이 유일한 근거" 라는 구조를 유지하되, 검출 실패를 관측 가능하게 만드는 것**이다.
다운로드 결정을 첨부 목록으로 되돌리면(폴백) 사용자가 배제한 설계로 돌아간다.

### (1) `storage-to-markdown.ts` — raw `<img>` 를 참조로 승격 (순수)

`normalizeImages` 의 `ac:image` 루프 **뒤에** 두 번째 패스를 둔다. 순서가 중요하다: 첫 패스가
만든 `<img src="assets/…">` 는 host-relative 가 아니므로 둘째 패스의 규칙에 걸리지 않는다(AC7).

후보 판정 규칙 — **셋을 모두 만족할 때만** 참조로 본다:

1. `src` 에 스킴이 없다(절대 URL 제외 — AC5).
2. 경로가 `/download/attachments/` 또는 `/download/thumbnails/` 로 시작한다(AC3·AC6).
   → `/images/icons/…` 같은 UI 리소스가 오탐되지 않는다.
3. 파일명을 얻을 수 있다 — `data-linked-resource-default-alias` 우선, 없으면 쿼리를 뗀 마지막
   경로 세그먼트를 `decodeURIComponent` 로 푼다(AC2·AC4).

판정부는 **`parseDownloadHref(src, alias)` 순수 함수**로 떼어 파일명 파생만 단위 테스트한다.
통과하면 `referenced.add(name)` + 기존 `imgTag(`${ASSETS_DIR}/${sanitizeAssetName(name)}`, alt)`
로 재작성한다 — `ac:image` 경로와 **같은 재작성 함수**를 쓴다(링크 규칙 이원화 방지).

### (2) `connector.ts` — 목록 조회를 진단으로 분리

`ConfluencePageResult` 에 `unreferencedAttachments: string[]` 추가. `fetchPage` 흐름을 바꾼다:

```
includeAttachments === false        → 목록 조회 없음, unreferencedAttachments = []      (AC11)
includeAttachments && refs.length>0 → 지금과 동일 + 목록에서 참조 밖 이름 수집          (AC10)
includeAttachments && refs.length===0 → 목록만 조회, 다운로드 0건, 전 이름을 진단으로   (AC9)
```

`downloadAttachments` 가 이미 `listed` 를 갖고 있으므로 반환값에 `unreferenced` 를 얹는 것으로
족하다 — 참조 0개일 때만 "목록 조회 후 즉시 반환" 하는 짧은 경로가 추가된다. **`wanted` 필터와
`missing` 판정 규칙은 그대로 둔다**(엄격 필터 유지).

`manifestOf` 에 같은 필드를 싣는다(AC12).

### (3) `search-render.ts` — 진단 문장 (순수)

`renderPage` 에 줄을 추가한다. `assets.length === 0 && unreferenced.length > 0` 이면 원인을
명시하는 문장(본문에서 이미지 참조를 찾지 못했다)과 이름 목록을, 그 외 `unreferenced.length > 0`
이면 참조 밖 첨부 줄만 싣는다(AC13·AC14).

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `parseDownloadHref(src, alias)` (신규 순수 함수, `storage-to-markdown.ts` 내부) | `<img>` 의 `src`/alias → 첨부 파일명 또는 `undefined` | `features/auth-platform/modules/confluence` (기존 파일) | 순수 단위 — 네트워크·fs 의존 0 |
| `ConfluencePageResult.unreferencedAttachments` (기존 타입 필드) | 진단 데이터 | 동일 | connector 통합 테스트(기존 `context([routes])` 하니스로 요청 경로·결과 단언) |

신규 파일을 만들지 않는다 — 세 변경 모두 기존 파일의 응집 범위 안이고, 각 파일은 400줄 미만을
유지한다(현재 `storage-to-markdown.ts` 247줄 · `connector.ts` 471줄 — connector 는 이미 넘지만
이번 변경은 순증 20줄 미만이며 분해는 별건이다).

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **"본문이 참조하지 않으면 목록 조회조차 하지 않는다 — '참조 0개' 를 '전부 받기' 로 오해할 여지를 남기지 않는 것이 요점"** | `connector.ts:263-264` (코드 주석) · `modules/confluence/AGENTS.md §그 밖의 규칙` | §설계 (2) 의 "`includeAttachments && refs.length===0` → 목록만 조회" | **뒤집음.** 근거: 이 규칙이 막으려던 것은 *전부 받기* 이고 그것은 그대로 금지된다(다운로드 0건 유지). 조회를 막은 결과가 **무성 실패**(R8)라 진단 비용(GET 1회)보다 크다. 주석·AGENTS.md 를 함께 갱신한다 |
| 같은 결정을 잠근 테스트 `'본문이 첨부를 참조하지 않으면 첨부 목록조차 조회하지 않는다'` | `connector.test.ts:435-445` | 〃 | **갱신** — AC9 의 케이스로 대체한다(요청 0건 → 목록 1회 + 진단 채움) |
| **"본문이 참조한 것만 받는다. 목록 전체를 받으면 쓰지 않는 파일이 디스크에 쌓인다"** (엄격 필터) | `connector.ts:300` (코드 주석) | §범위 비범위의 "폴백 복원 배제" · §설계 (2) 의 "`wanted` 필터와 `missing` 판정 규칙은 그대로" | **유지** |
| `354ffc7` 의 "전부 받기 폴백 제거" | `git log`(§자료조사 R4) | 〃 | **유지** (사용자 결정 2026-08-05) |
| **"첨부 파일명은 원격이 준 값이다. `sanitizeAssetName` → `resolveAssetPath` 를 반드시 거친다"** | `modules/confluence/AGENTS.md §규칙` · `download-store.ts:52-59` | §설계 (1) 의 "기존 `imgTag(…sanitizeAssetName(name)…)` 로 재작성" | **유지** — 새 경로도 같은 위생 함수를 통과한다 |
| **"cheerio 는 반드시 `xmlMode: true`"** | `modules/confluence/AGENTS.md §규칙` · `storage-to-markdown.ts:65` | §설계 (1) — 파서 설정을 건드리지 않는다 | **유지** |
| **"매크로 전처리를 turndown 보다 먼저"** / 변환 단계 순서 | `storage-to-markdown.ts:67-70` | §설계 (1) 의 "`ac:image` 루프 **뒤에** 두 번째 패스" | **유지** — 두 패스 모두 `normalizeImages` 안, 즉 여전히 가장 먼저 돈다 |
| **"raw credential 을 보지 않는다 — vault·secret·전역 `fetch` import 가 이 디렉터리에 하나도 없어야 한다"** (AUTH-PLAT-009) | `modules/confluence/AGENTS.md §규칙` | §의존 기술 "신규 의존성 없음" | **유지** — import 를 늘리지 않는다 |
| **"도구 handler 는 `RuntimeToolResult`(`content` 필수) 를 반환한다"** | `modules/confluence/AGENTS.md §규칙` · `tools.ts:toToolResult` | §설계 (3) — 렌더러 문자열만 바꾸고 결과 형상은 그대로 | **유지** |
| **"결과를 JSON 으로 감싸지 않는다"** (0164 r2) | `search-render.ts:1-6` (파일 헤더) | §설계 (3) 의 "`renderPage` 에 줄을 추가" | **유지** — 문자열 조립만 늘린다 |
| main 레이어 DAG + feature 교차 금지 | `app/eslint.config.mjs` (`src/main/**` 블록) · `app/src/main/AGENTS.md` | §설계 표의 레이어 칸 | **유지** — 변경 4파일이 전부 같은 슬라이스 내부 |
| 단일 파일 분해 가이드(400줄) | `app/AGENTS.md §에이전트 원칙 5` | §설계 말미 "connector 는 이미 넘지만 … 분해는 별건" | **유지(경고 인지)** — 순증 20줄 미만, 분해는 이번 범위 밖 |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **빈 상태의 의미 분리**: "첨부가 없는 페이지"(목록 0건)와 "첨부는 있는데 본문 참조를 못 찾은
  페이지"(목록 N건·다운로드 0건)가 지금은 같은 출력이다. AC13 이 이 둘을 문장으로 가른다.
- **요청 1회 증가**: 참조 0개 페이지마다 첨부 목록 GET 이 1회 더 나간다. `get_pages` 는 한 번에
  최대 50페이지(`MAX_PAGES_PER_CALL`)이므로 최악 +50 GET. 페이지 동시성 2 · 목록은 페이지당 1회로
  기존 상한 안에 머문다.
- **오탐 시 깨진 링크**: `/download/` 후보가 첨부 목록에 없으면(권한·삭제·타 페이지 첨부) markdown
  은 `assets/…` 를 가리키는데 파일이 없다. 다만 **현행도 `/download/…` 서버 경로라 로컬에서 못
  연다** — 더 나빠지지 않고, `failedAssets` 에 사유가 남아 오히려 관측 가능해진다.
- **취소/부분 실패**: 첨부 하나가 실패해도 페이지 저장은 완료되는 기존 성질(`partitionSettled`)을
  그대로 쓴다. 목록 조회 자체가 실패하면 그 페이지가 `failedPages` 로 떨어지는 현행 동작도 유지.
- **`includeAttachments:false`**: 목록 조회·진단 모두 0 — 다운로드를 원치 않는 호출자가 추가
  요청을 물지 않는다(AC11).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **가설 의존** — 사용자 페이지가 raw `<img>` 가 아니면 (1) 이 증상을 못 고친다(R7) | (2)(3) 의 진단이 가설과 **독립**이다. 다음 실행에서 "페이지 첨부 N개, 본문 참조 0개 + 이름 목록" 이 나오므로 어떤 형식을 더 인식해야 하는지 곧바로 정해진다. AC16 이 이것을 인수 기준으로 고정한다 |
| 후보 규칙 과잉 검출 — `/download/` 밖 리소스까지 잡으면 실패 잡음이 늘고 링크가 깨진다 | 경로 prefix 를 `/download/{attachments,thumbnails}/` 로 좁히고 AC5·AC6 으로 잠근다 |
| 요청 증가로 사내 서버 부담 | 페이지당 1회 · `includeAttachments:false` 면 0회 · 기존 동시성 상한 유지 |
| 기존 테스트 1건을 의도적으로 뒤집는다(R9) | §기존 결정 표에 근거를 남기고 AC9 로 대체 단언을 세운다 — verify 가 "회귀"와 "의도된 변경"을 구분할 수 있다 |

- 되돌리기 어려운 결정: **없음.** 필드 추가는 매니페스트/렌더러 문자열까지만 흐르고 IPC·DB
  스키마·도구 이름을 건드리지 않는다.
- **단독 결정 금지 항목(Open Question)** → 사용자에게: 없음.

## 영향 받는 파일

- `app/src/main/features/auth-platform/modules/confluence/storage-to-markdown.ts`
- `app/src/main/features/auth-platform/modules/confluence/storage-to-markdown.test.ts`
- `app/src/main/features/auth-platform/modules/confluence/connector.ts`
- `app/src/main/features/auth-platform/modules/confluence/connector.test.ts`
- `app/src/main/features/auth-platform/modules/confluence/search-render.ts`
- `app/src/main/features/auth-platform/modules/confluence/search-render.test.ts`
- `app/src/main/features/auth-platform/modules/confluence/AGENTS.md`
- `docs/handoff/INDEX.md` · `docs/handoff/0168-confluence-image-download-regression/plan.md`

## 참고 문서

- `app/src/main/features/auth-platform/modules/confluence/AGENTS.md` (모듈 규칙 — 이번에 갱신)
- `app/src/main/features/auth-platform/modules/AGENTS.md` (패키지 opt-in 레지스트리 규칙)
- `app/src/main/AGENTS.md` (main 레이어 DAG)
- `docs/handoff/0160-confluence-connector-plugin/plan.md` (원 설계)
- IPC 변경: **없음** — `docs/IPC_CONTRACT.md` 갱신 불필요

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + 모듈 스위트
  `./node_modules/.bin/vitest run src/main/features/auth-platform/modules/confluence/`
  (베이스라인 8파일 / 132테스트 — R10). `npm test` 전체는 better-sqlite3 ABI 제약 하에서 DB 로드
  스위트가 환경 사유로 red 일 수 있으므로 그 경우 분리 보고한다(`app/AGENTS.md` 제약 환경 지침).
- 신규 테스트 요구: 순수 변환기(AC1~5·7·8) · connector 통합(AC6·9~12) · 렌더러 순수(AC13·14).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, "raw `<img>` 가설" 은 추론으로 표기(R7).
- [x] 자료조사 — 발견 11건 전부 `파일:라인`·`git` 커밋·이번 세션 실측 레퍼런스를 붙였다.
- [x] 의존 기술 — 신규 의존성 0을 명시했다.
- [x] 파생 UX — 빈 상태 구분·요청 증가·오탐 링크·부분 실패·`includeAttachments:false` 를 펼쳤다.
- [x] 리스크 — 가설 의존을 1순위 리스크로 적고 진단으로 완화했다. Open Question 0.

**기계적으로 확인 가능한 것**

- [x] **요구 비판적 검토** 5문항 전부 답했고, 사용자가 배제한 폴백 복원을 임의로 되살리지 않았으며 요구 범위도 줄이지 않았다.
- [x] `검증 수단` 칸 빈 곳 0 — AC15·16 은 "사람 실기 + 실행 경로" 로 명시.
- [x] 부정형/"불변" 기준 0개 — AC11 도 "요청 0건 + 빈 배열"이라는 **측정 가능한 양성 단언**이다.
- [x] AC 간 모순 점검 — AC9(참조 0개면 목록 조회)와 AC11(`includeAttachments:false` 면 조회 0건)은 조건이 배타적이라 충돌하지 않는다. AC1(참조로 승격)과 AC5·AC6(승격하지 않음)은 `src` 판정 규칙 3조건으로 갈린다. AC7 은 AC1 이 만든 `assets/…` img 를 2차 승격하지 않음을 잠가 AC1 과 자가당착하지 않는다.
- [x] 인용 수치를 이번 세션에서 직접 측정 — 실측 10종(R5·R6), 게이트 베이스라인 8파일/132테스트(R10), 검출 지점 전수 N=1(R11 근거 grep). 승계한 숫자 0.
- [x] 신규 모듈(순수 함수 1개)에 테스트 방법이 있고 electron/DB 의존이 없다 — 순수부 seam 이 곧 그 함수다.
- [x] 전수 조사 N 수치 — `ac:image` 검출 지점 1곳 · `referencedAttachments` 소비 지점 1곳 · 현행 동작을 잠근 테스트 1건(R9).
- [x] 각 AC 에 프로덕션 도달 경로 기재 — 유일한 호출자가 테스트인 AC 0개(전부 `tools.ts` handler 경로에 닿는다).
- [x] "사람 실기" AC(15·16)에 실행 경로가 있고, `servers.ts` 등록·플러그인 탭 연결이 **비범위에 막혀 있지 않다**(둘 다 현행 코드로 가능).
- [x] 선택적 필드 판정 — `data-linked-resource-default-alias` **미지정** 케이스가 AC1(세그먼트 폴백)에, 지정 케이스가 AC2 에 각각 있다.
- [x] 소비하는 계약의 제약 필드 강제 지점 — `src` 스킴·경로 prefix 검사는 `parseDownloadHref` 가 **변환 시점에** 강제하고, 첨부 목록 대조는 `downloadAttachments` 가 **다운로드 직전에** 강제한다.
- [x] 참조 구현 전수 대비 — 참조 구현을 입력으로 쓰지 않았다. 대신 **저장 형식 10종 실측 표**(R5·R6)가 그 자리를 대신한다.
- [x] 미룬 항목마다 일방향 여부에 답했다 — 필드 이름 1건이 준-일방향이라 판단해 **지금 확정**했다.
- [x] 관문 4 를 본문 완성 후 실행 — 기존 결정 표 11행을 §설계·§범위 문장과 짝지어 채웠고, 인용 경로를 `Read`/`grep` 으로 열어 확인했으며, `[구현자 기입]`·`[검증자 기입]` 블록이 아래에 있다.
- [x] "확정" 서술 검증 — `modules/confluence/AGENTS.md` 의 §규칙·§그 밖의 규칙 표제어와 `connector.ts:263-264,300` 주석을 직접 열어 문구 존재를 확인했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 이 작업은 **버그수정(비기능)** 이므로 Claude 가 직접 구현한다.

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: 진단(2)을 검출 확장(1)과 **분리한 것**이 이 설계의 값이다. 사용자
  페이지의 저장 형식을 못 봤다는 조사 한계(R7)를 설계가 정직하게 안고 가므로, (1)의 가설이
  빗나가도 다음 실행이 스스로 답을 준다. 후보 규칙을 `/download/` 접두사로 좁힌 것도 옳다 —
  넓게 잡았다면 이모티콘이 실패 목록을 채웠을 것이다(AC6 이 그걸 잠근다).
- **이견 / 우려 ①(해소됨)**: §설계 (2)가 "`downloadAttachments` 반환값에 `unreferenced` 를
  얹는 것으로 족하다" 고 적었는데 **부족했다.** 목록 조회가 실패하면 그 예외가 페이지를 통째로
  실패시킨다 — 참조가 0개인 페이지는 **원래 성공하던 페이지**라서, 진단을 켠 대가로 멀쩡한
  결과를 잃는다. 설계에 없던 `collectAttachments` 경계를 넣어 닫았다(아래 문제 1).
- **이견 / 우려 ②(설계 대비 축소)**: §설계가 `parseDownloadHref` 를 **export** 해 단위
  테스트하라고 했으나 export 하지 않았다. 분기 전부(스킴·`//`·접두사·alias·세그먼트·디코드
  실패)가 `storageToMarkdown` 경유 테스트로 덮여, export 는 **소비자 없는 공개 표면**만 늘린다
  (`e837e97` 의 "선언을 구현에서 파생시킨다" 방향과 반대). 순수 판정부를 함수로 떼어낸다는
  설계 의도는 그대로 지켰다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **진단 조회가 페이지를 죽인다.** 참조 0개 페이지에서 첨부 목록 요청이 실패하면(404·500·권한) 예외가 `fetchPage` 를 타고 올라가 그 페이지가 `failedPages` 로 떨어진다. 변경 전에는 조회 자체를 안 했으므로 **성공하던 페이지가 실패로 바뀐다.** 기존 테스트 3건(`중복 id 는 한 번만 처리한다` 등)이 즉시 red 로 이 회귀를 잡았다 | ✅ **구현함** — `collectAttachments` 를 새로 두어, **참조가 0개일 때만** 목록 실패를 삼키고 로그(`confluence.attachments.list-failed`)만 남긴다. 참조가 있을 때의 실패는 "받을 수 없음" 이라 그대로 전파(0160 이래 동작 유지). AC 신설: `"진단용 목록 조회가 실패해도 페이지 저장은 완료된다"` | 구현 세부·명백한 회귀 → 선조치 경계 ✅ 안 |
| 2 | **`includeAttachments:false` 의 진단 값이 AC 에 없었다.** 요청 0건만 재고 `unreferencedAttachments` 는 안 봤다 — 필드가 `undefined` 로 새도 통과한다 | ✅ **구현함** — 기존 케이스에 `unreferencedAttachments` 가 빈 배열임을 단언 추가(AC11) | AC 보강(약화 아님) → ✅ |
| 3 | **디코드 실패 분기가 어느 AC 에도 없었다.** `decodeURIComponent` 는 깨진 퍼센트 시퀀스에 던진다 — 첨부 이름 하나로 페이지 변환 전체가 실패할 수 있었다 | ✅ **구현함** — `decodeSegment` 가 원문으로 폴백하고, 케이스 `"인코딩이 깨진 세그먼트는 원문 그대로 쓴다"` 로 고정 | 놓친 엣지케이스 → ✅ |
| 4 | **`uniqueName` 링크 desync** (§비범위) 가 이번 변경으로 **조금 더 잘 드러난다** — 같은 위생화 이름의 첨부 2건이 `x-1.png` 로 저장되면 본문 링크는 `x.png` 를 가리킨다 | ⚠️ **보고만** — 비범위로 남긴다. 이번 변경이 만든 결함이 아니고, 고치려면 저장 파일명 규칙(연쇄로 markdown 링크 생성 시점)을 바꿔야 해 범위가 다르다 | 설계 범위 변경 → ⚠️ |

## [구현자 기입] 구현 체크리스트

- [x] `normalizeDownloadImages` + `parseDownloadHref` + `decodeSegment` — `ac:image` 루프 **뒤**에 배치(2차 승격 방지)
- [x] `ConfluencePageResult.unreferencedAttachments` + `DownloadOutcome.unreferenced` + `manifestOf` 기록
- [x] `collectAttachments` — 참조 0개일 때만 목록 실패를 삼킨다(문제 1)
- [x] `renderPage` 진단 두 갈래(받은 것 0 / 받은 것 있음)
- [x] 뒤집는 테스트 1건 갱신 + 신규 15건
- [x] `modules/confluence/AGENTS.md` — 검출 규칙·진단·"폴백을 되살리지 마라" 명시
- [x] 측정력 확인 — 소스 3파일을 `git stash` 로 되돌려 신규 단언이 실제로 실패하는지 실행

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `storage-to-markdown.ts`(+`.test.ts`) · `connector.ts`(+`.test.ts`) · `search-render.ts`(+`.test.ts`) · `modules/confluence/AGENTS.md` |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run src/main/features/auth-platform/modules/confluence/` |
| 게이트 결과 | lint **0 error**(warning 1 = `useTranscriptVirtualizer` — 0102 베이스라인, 변경 무관) · typecheck **3/3** · 모듈 vitest **8파일 147/147**(베이스라인 132 대비 **+15**) |
| **측정력 실측** | 소스 3파일만 stash 한 상태로 재실행 → **신규 15건 중 13건 red**. 남은 2건(`외부 절대 URL img 는 참조가 아니다` · `download 경로 밖 img 는 첨부 후보가 아니다`)은 plan 이 **과잉검출 가드**로 명시한 것이라 현행도 통과하는 것이 정상이다 |
| 블로커 / 역질문 | 없음. 단 **AC15·16(사람 실기)은 미검증** — 사내 Confluence 접근 불가. 사용자 실기가 필요하고, 실기에서 여전히 0건이면 AC16 의 진단 줄이 다음 조치를 지정한다 |
| 대상 커밋 | (아래 fix 커밋) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (verify/FAIL 시 신설) | | | |
