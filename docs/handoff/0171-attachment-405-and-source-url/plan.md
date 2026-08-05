# Plan — 0171-attachment-405-and-source-url

## 메타

| 항목 | 값 |
|---|---|
| slug | `0171-attachment-405-and-source-url` |
| 작성자 | Claude Code |
| 일자 | 2026-08-05 |
| 매핑 | 0169 의 다운로드 좌표 우선순위를 **사용자 실측으로 반전** |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 보고 | "이미지첨부 다운로드는 **405 에러** 발생하고 있다. **cql이 지원하지 않는것인지?**" | 라이브 세션 요청 2026-08-05 |
| 명시 요구 | "**manifest에 원본 url 도 포함하라**" | 〃 |
| 추론 의도 | 없음 — 둘 다 문자 그대로다 |

## Context (왜)

0169 는 첨부 다운로드 좌표를 둘로 두되 `/child/attachment/{id}/data` 를 1순위,
`_links.download` 를 폴백으로 뒀다. 근거는 broker 주석의 "302 추종" 실측이었다.
**사용자 실측(405)이 그 전제를 반증한다.**

## 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 진짜 문제를 겨냥하는가 | **타당 — 그리고 사용자 질문에는 정정이 붙는다.** 405 = **Method Not Allowed** 는 HTTP *메서드* 거부다. CQL 은 검색(`/content/search?cql=`)의 질의 언어이고 405 가 난 곳은 첨부 다운로드 엔드포인트라 **둘은 무관**하다. CQL 이 문제라면 400/500 이 나고 검색 자체가 실패한다 | `rest.ts` `searchRequest` ↔ `attachmentDataRequest` (다른 엔드포인트) |
| 405 의 원인이 특정되는가 | **된다.** Atlassian 문서에서 `/child/attachment/{id}/data` 는 **업로드(POST, multipart)** 좌표다. GET 은 메서드 미허용 → 405. 0169 조사(R5)가 이미 이 사실을 적었는데도 **순서를 반대로 뒀다** — R6(broker 주석의 302)을 더 무겁게 본 판단이 틀렸다 | 0169 §자료조사 R5·R6 · [DC REST — attachments](https://developer.atlassian.com/server/confluence/rest/v910/api-group-attachments/) |
| 이미 있는 것 아닌가 | **폴백은 이미 있다** — 0169 가 `_links.download` 경로와 요청 빌더를 만들어 뒀다. 이번 변경은 **순서 반전**이 본질이라 신규 코드가 적다 | `rest.ts` `attachmentDownloadRequest` |
| 더 작은 해법이 있는가 | **`/data` 를 아예 제거**하는 것이 더 작다. 그러나 `_links.download` 를 안 주는 배포·확장이 있을 수 있어 **폴백으로 남긴다** — 좌표 하나만 남기는 쪽이 회귀 위험이 크다 | `parseAttachments` 의 `downloadPath?` 선택성 |
| 기존 채택 결정을 뒤집는가 | **뒤집는다 — 0169 의 좌표 우선순위 1건.** 근거가 사용자 실측이라 되돌릴 여지가 없다 | §기존 결정 표 |

- **사용자에게 올릴 것**: 없음(질문에는 답으로 갈음 — CQL 무관).

## 자료조사

| # | 발견 / 제약 | 레퍼런스 |
|---|---|---|
| R1 | **405 = Method Not Allowed.** 서버가 경로는 알지만 그 메서드를 안 받는다. 인증(401/403)·부재(404)·질의 오류(400)와 구분되는 신호라, "GET 을 쓰면 안 되는 좌표" 를 정확히 가리킨다 | 사용자 실측 2026-08-05 |
| R2 | `/child/attachment/{id}/data` 는 **업로드 좌표**다(POST + multipart + `X-Atlassian-Token: nocheck`). 0169 조사에 이미 적혀 있었다 | 0169 plan §자료조사 R5 |
| R3 | **DC 의 다운로드 좌표는 `_links.download`** — `/download/attachments/{pageId}/{filename}?version=N&…`. 사용자가 직전 턴에 지목한 경로와 같다 | 0169 plan §자료조사 R5 · 사용자 요청 2026-08-05("`/download/attachments/`") |
| R4 | **0169 의 요청 빌더가 이미 있다** — `attachmentDownloadRequest` 가 컨텍스트 경로 부착·쿼리 분해·XSRF·binary 를 처리하고 `rest.test.ts` 3건이 고정한다 | `rest.ts` · `rest.test.ts` |
| R5 | **재시도 판정도 이미 있다** — `isRetriableDownloadError`(HTTP 상태 실패만). 405 는 `HttpStatusError` 라 다음 좌표로 넘어간다 | `connector.ts` |
| R6 | **자산 메타는 객체 인자다** — 0169 가 `AssetMeta` 로 바꿔 둬서 필드 추가가 시그니처를 늘리지 않는다 | `download-store.ts` `AssetMeta` |
| R7 | **게이트 베이스라인(직접 측정)**: 모듈 스위트 **8파일 / 167 테스트** (0169 종료 시점) | 이번 세션 실행 |

## 인수 기준

> 프로덕션 도달 경로(P): `confluence_get_pages` → `fetchPage` → `downloadAttachments` → `downloadOne`.

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `_links.download` 가 있으면 **그 좌표로 먼저** 받고 `/data` 는 요청조차 하지 않는다 | `connector.test.ts::"download 링크를 먼저 쓰고 data 경로는 두드리지 않는다"` | `downloadOne` |
| 2 | `_links.download` 가 없으면 `/data` 로 받는다 (링크를 안 주는 배포 보호) | 〃`::"download 링크가 없으면 data 경로로 받고 그 URL 을 남긴다"` | 〃 |
| 3 | `_links.download` 가 실패하면 `/data` 로 재시도한다 | 〃`::"download 링크가 실패하면 data 경로로 재시도한다"` | 〃 |
| 4 | 두 좌표가 모두 실패하면 **마지막 상태 코드**가 `failedAssets` 메시지에 남는다(405 가 보인다) | 〃`::"두 다운로드 경로가 모두 실패해도 페이지 저장은 완료된다"` | 〃 |
| 5 | 취소·크기 초과는 다음 좌표로 재시도하지 않는다 (0169 의 규칙 유지) | 〃`::"취소·크기 초과는 다음 다운로드 좌표로 재시도하지 않는다"` | 〃 |
| 6 | 내려받은 자산의 **절대 URL** 이 `SavedAsset.sourceUrl` 에 실린다 (origin + 경로 + 쿼리) | 〃`::"download 링크를 먼저 쓰고…"` 의 `sourceUrl` 단언 | `store.saveAsset` |
| 7 | 같은 URL 이 **`manifest.json`** 에도 기록된다 | 〃 (manifest 파일을 읽어 단언) | `manifestOf` |
| 8 | `/data` 로 받은 경우 그 좌표의 URL 이 기록된다 (어느 좌표가 통했는지 구분된다) | 〃`::"download 링크가 없으면 data 경로로 받고 그 URL 을 남긴다"` | 〃 |
| 9 | 사람 실기 — 사내 페이지에서 이미지가 실제로 저장되고 405 가 사라진다 | **사람 실기** — 실행 경로: `npm run dev` → 연결 → `confluence_get_pages` → `assets/` 와 `manifest.json` 의 `sourceUrl` 확인 | 도구 전체 경로 (P) |

## 범위 / 비범위

- **범위**: 좌표 우선순위 반전 · `sourceUrl` 기록(자산 + manifest).
- **비범위**: `/data` 좌표 완전 제거 · 본문 `<img>` 의 원본 URL 별도 기록(받은 좌표와 다를 수
  있으나, 사용자가 요구한 것은 "받아온 원본 url" 이다) · 0168 D2 · 0169 D1·D2.

| 미룬 항목 | 나중에 하면 더 비싼가 |
|---|---|
| `/data` 제거 | 아니오 — 배열에서 한 줄 빼면 된다. 실기로 `_links.download` 가 항상 있음이 확인되면 그때 |
| 본문 `<img>` 원본 URL | 아니오 — 필드 추가. 다만 **받은 좌표**가 진단에 더 쓸모 있어 그것을 먼저 넣는다 |

## 의존 기술 / 전제

- 신규 의존성 0. 0169 가 만든 `attachmentDownloadRequest`·`AssetMeta`·`isRetriableDownloadError`
  를 그대로 쓴다.
- 전제: `_links.download` 를 목록이 준다(R3). 안 주면 AC2 의 `/data` 경로로 강등된다 — 전제가
  틀려도 **현행(0169)보다 나빠지지 않는다**.

## 설계

`downloadOne` 을 "좌표 배열을 순서대로 시도" 로 바꾼다.

```
attempts = [ _links.download(있으면), /data ]
각 시도: 실패 → 마지막이거나 재시도 불가(취소·크기 초과)면 throw, 아니면 다음
성공 → 그 요청의 절대 URL 을 sourceUrl 로 기록
```

배열로 두는 이유는 순서를 **한 줄로 읽히게** 하기 위해서다 — try/catch 중첩으로 두면 좌표가
셋이 될 때 구조가 무너진다. `absoluteUrl(req)` 은 `config.baseUrl` + `path` + 쿼리를 잇는
클로저 내부 함수다(connector 설정을 알아야 하므로).

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `absoluteUrl` (`connector.ts` 내부) | 요청 서술자 → 절대 URL | 같은 슬라이스 | connector 통합 테스트에서 `sourceUrl` 값으로 단언 |
| `SavedAsset.sourceUrl` | 출처 기록 | 〃 | 〃 + manifest 파일 단언 |

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **0169: "`/data` 를 먼저 쓴다 — 실동작이 실측돼 있어 교체는 회귀 위험만 만든다"** | `connector.ts` `downloadOne` 주석 · 0169 plan §설계 (2) | §설계의 `attempts` 순서 | **뒤집음.** 근거였던 broker 주석의 302 실측은 **다른 배포의 관찰**이었고, 사용자 실측 405 가 이를 반증한다. 폴백으로는 유지해 회귀 위험을 남기지 않는다 |
| 0169: "재시도 가치가 있을 때만 다음 좌표"(`isRetriableDownloadError`) | `connector.ts` | §설계의 "재시도 불가면 throw" | **유지** — AC5 가 계속 잠근다 |
| 0169: "버전은 목록 조회 시점의 현재 버전" | `AGENTS.md §버전과 다운로드 좌표` | §설계 — 버전 로직 무변경 | **유지** |
| "바이너리는 `responseType:'binary'` + XSRF 헤더를 함께" | `AGENTS.md §규칙` | §설계 — 두 요청 빌더 모두 이미 준수 | **유지** |
| 0168 P27(컨텍스트 출력 상한) | `failure-patterns.md` | `sourceUrl` 은 **manifest·자산에만** 기록하고 도구 결과 문장에는 안 싣는다 | **유지** — 페이지당 첨부 수만큼 URL 이 늘 수 있어 컨텍스트에 넣지 않는다 |

## 파생 UX / 엣지케이스

- **좌표가 하나뿐인 배포**: `_links.download` 미제공 → `/data` 단독. 실패하면 재시도 없이
  `failedAssets`(AC2 의 경로가 그대로 실패 경로가 된다).
- **405 가 아닌 실패**: 401/403(자격증명)·404(삭제됨)도 같은 순서를 탄다. 마지막 상태 코드가
  메시지에 남아 사용자가 구분한다(AC4).
- **`sourceUrl` 에 쿼리가 실린다**: `version`·`modificationDate`·`api` 가 포함된다. 토큰류는
  들어가지 않는다 — 인증은 헤더로 나간다(`presentation`).

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| 순서 반전이 `_links.download` 를 안 주는 배포를 깨뜨린다 | AC2 가 그 경로를 잠근다 — 링크가 없으면 `/data` 단독으로 동작 |
| `sourceUrl` 이 민감 정보를 담는다 | 쿼리는 `version`·`modificationDate`·`api` 뿐이다. credential 은 헤더로만 나가므로 URL 에 없다 |
| 405 가 사내 배포 고유 설정일 수 있다 | 두 좌표를 모두 시도하므로 어느 쪽이든 통하면 받는다 |

- 되돌리기 어려운 결정: 없음. `sourceUrl` 은 선택 필드라 기존 manifest 를 읽는 쪽이 안 깨진다.
- Open Question: 없음.

## 영향 받는 파일

- `app/src/main/features/auth-platform/modules/confluence/connector.ts`(+`.test.ts`)
- `app/src/main/features/auth-platform/modules/confluence/download-store.ts`
- `app/src/main/features/auth-platform/modules/confluence/AGENTS.md`
- `docs/handoff/INDEX.md` · 본 plan

## 게이트

`cd app && npm run lint && npm run typecheck` +
`./node_modules/.bin/vitest run src/main/features/auth-platform/modules/confluence/`
(베이스라인 8파일 167테스트 — R7).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 보고·요구를 원문 인용. 추론 0.
- [x] 자료조사 — 7건 전부 `파일:라인`·외부 1차 출처·사용자 실측.
- [x] 의존 기술 — 신규 의존성 0. 전제가 틀려도 현행보다 나빠지지 않음을 명시.
- [x] 파생 UX — 단일 좌표 배포·405 외 실패·URL 내용.
- [x] 리스크 — 순서 반전의 회귀를 1순위로 두고 AC2 로 잠갔다.
- [x] 요구 비판적 검토 5문항 — 사용자 질문(CQL)을 **정정**하고도 요구는 줄이지 않았다.
- [x] `검증 수단` 빈 칸 0 — AC9 는 "사람 실기 + 실행 경로".
- [x] 부정형 기준 0 — AC1 의 "요청조차 하지 않는다" 도 `toHaveLength(0)` 로 측정된다.
- [x] AC 간 모순 — AC1(링크 우선)·AC2(링크 없음)·AC3(링크 실패)은 입력이 배타적. AC5 는 AC3 의 예외 조건을 좁히는 것이라 일관.
- [x] 인용 수치 직접 측정 — 베이스라인 8파일/167(R7). 승계 0.
- [x] 신규 표면 2개 테스트 방법 기재.
- [x] 전수 조사 N — 다운로드 좌표 **2곳**, `saveAsset` 호출 **1곳**, manifest 조립 **1곳**.
- [x] 각 AC 에 프로덕션 도달 경로 기재.
- [x] 사람 실기 AC9 의 실행 경로가 비범위에 막혀 있지 않다.
- [x] 선택적 필드 미지정 케이스 — `downloadPath` 미지정(AC2) / 지정(AC1) 둘 다 있다.
- [x] 제약 필드 강제 지점 — 재시도 가부는 `isRetriableDownloadError` 가 **각 시도 실패 시점**에, URL 조립은 `absoluteUrl` 이 **저장 시점**에 강제한다.
- [x] 미룬 항목 일방향 여부 답변 완료.
- [x] 관문 4 — 기존 결정 표 5행을 본문 문장과 짝지어 채웠다. `[구현자 기입]`·`[검증자 기입]` 블록 있음.

---

## [구현자 기입] 설계 리뷰 (비판적)

- **동의**: 좌표를 배열로 두고 순서만 바꾼 것이 옳다. 0169 가 폴백 경로·요청 빌더·재시도 판정을
  이미 만들어 둬서 이번 변경의 실질은 **배열 순서와 `sourceUrl` 한 필드**다.
- **이견**: 0169 가 순서를 반대로 둔 판단이 틀렸다는 것을 기록해 둔다. **자기 조사(R5)가 이미
  "`/data` 는 업로드 좌표" 라고 적었는데도**, 코드 주석 하나(broker 의 302 관찰)를 더 무겁게 봤다.
  1차 출처(벤더 문서)와 2차 관찰(우리 주석)이 충돌하면 1차를 따랐어야 했다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 0169 의 테스트 3건이 옛 순서를 전제로 쓰여 있었다(이름·기대값 모두) | ✅ **구현함** — 새 순서로 다시 썼다. `/data` 를 405 로 응답하는 라우트를 넣어 **실서버 신호를 fixture 에 박았다** | 구현 세부 → ✅ |
| 2 | `sourceUrl` 을 도구 결과 문장에도 실으면 첨부 수만큼 URL 이 컨텍스트에 쌓인다(P27) | ✅ **구현함(넣지 않음)** — manifest·자산에만 기록한다 | 직전 라운드에서 축적한 패턴 적용 → ✅ |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `connector.ts`(+`.test.ts`) · `download-store.ts` · `AGENTS.md` |
| 게이트 결과 | lint **0 error**(warning 1 = 베이스라인) · typecheck **3/3** · 모듈 vitest **8파일 168/168**(베이스라인 167 대비 +1, 테스트 3건은 재작성) |
| 블로커 | 없음. **AC9(사람 실기) 미검증** |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | `_links.download` 가 항상 존재한다면 `/data` 좌표는 죽은 코드다 | verify r1 | 사람 실기(AC9)에서 `manifest.json` 의 `sourceUrl` 이 전부 `/download/attachments/` 면 다음 라운드에서 제거 | open (실기 대기) |
