# Verify — 0169-confluence-mentions-and-latest-attachment

## 메타

| 항목 | 값 |
|---|---|
| slug | `0169-confluence-mentions-and-latest-attachment` |
| 검증자 | Claude Code |
| 일자 | 2026-08-05 |
| 대상 커밋 | 작업 트리 (base `8a08af1`) |
| 라운드 | 1 |
| 상태 | **PASS** (사람 실기 1건 대기) |
| 자기 검증 여부 | **예 — 설계·구현·검증 동일 에이전트.** 0168 r1 에서 "신규 출력은 의도한 것으로 읽혀 첫 패스를 통과한다" 를 실증했으므로 §0 을 **두 번** 돌렸다 |

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 | **구현 턴에서 3건 발견·차단** — ⓐ 이름 조회에 상한이 없어 멘션 60명 × 배치 50페이지 = 3,000 GET(요청 축의 P27) ⓑ `mapWithLimit` 이 조회 실패를 삼켜 **관측 지점 0** ⓒ 다운로드 폴백이 취소·크기 초과에도 발동해 대용량 파일을 상한까지 두 번 받음. 셋 다 닫혔다(plan §[구현자 기입] 5·6·7) | `connector.ts` `MAX_USER_LOOKUPS`·`confluence.mentions.*` 로그·`isRetriableDownloadError` |
| **잘못된 성공(false success)** 이 가능한 경로 | **없다.** 멘션 해석 실패는 `@사용자` 로 **눈에 보이게** 강등되고 로그가 남는다. 다운로드는 두 좌표가 모두 실패해야 실패이며 그때 `failedAssets` 에 사유가 남는다. 자리표시자 유출은 AC6 + 상한 케이스 두 곳에서 `{{user:` 0건으로 잠갔다 | `connector.test.ts::"사용자 조회가 실패해도 자리표시자를 흘리지 않는다"` · `::"멘션이 아주 많아도 조회 수에 상한을 둔다"` |
| 되돌릴 수 있는가 | **예.** 파일 쓰기는 기존 다운로드 루트 한정, DB·마이그레이션·IPC·도구 이름 무변경. `SavedAsset.version` 은 선택 필드라 기존 `manifest.json` 을 읽는 쪽이 깨지지 않는다 | 변경 파일 목록에 `migrations/`·`shared/ipc.ts` 없음 |
| 설계가 의도한 것을 구현이 실제로 했는가 | **했다.** §설계 (1) 의 4분기가 `mentionLabel` 에 1:1로 있고, "변환기는 네트워크를 모른다" 가 지켜졌다(`storage-to-markdown.ts` 에 fetch·ctx import 0). §설계 (2) 의 "교체가 아니라 폴백" 도 그대로 — `/data` 가 여전히 1순위다 | `storage-to-markdown.ts` `mentionLabel` · `connector.ts` `downloadOne` |
| 구현자 선조치가 경계를 넘지 않았나 | **넘지 않았다.** 7건 전부 구현 세부·엣지케이스·명백한 누락이고, **AC 를 약화한 것이 0** 이다(3건은 AC 를 *신설*했다). 이견 ②는 AC3 을 "가드" 로 **재분류**했을 뿐 삭제하지 않았다 | plan §[구현자 기입] 1~7 |

**두 번째 패스에서 추가로 본 것**(0168 의 교훈 적용):

- **토큰 충돌** — 본문에 사용자가 직접 `{{user:x}}` 라고 쓴 경우 `resolveMentions` 가 그것도
  `사용자` 로 바꾼다. 현실 확률이 매우 낮고(위키 본문에 이 정확한 문자열), 피해도 그 문자열
  하나에 국한된다. **파생 이슈 D1 로 기록하되 이번 범위에서 고치지 않는다.**
- **요청 축 상한 재점검** — 첨부(페이지당 200 × 50) · 멘션(페이지당 50 × 50) 둘 다 상한이 있다.
  이번에 추가한 요청은 그 둘뿐이다.

## 역방향 탐색

```
$ bash .agents/skills/handoff-verify/scripts/scan-surface.sh HEAD   (대상 4 파일)
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 값 export `userToken` (신규) | **결함 → 수정함** | 이번에 만든 export 인데 **호출자가 파일 안에만** 있다. 토큰을 *읽는* 쪽(connector)은 `USER_TOKEN_PATTERN` 만 필요하다 — 0168 의 `parseDownloadHref` 와 같은 형태라 같은 판단으로 비-export 로 되돌렸다 |
| 값 export `assetsDirOf`·`uniqueName` | 정상 | `DownloadStore` 가 같은 파일에서 쓴다(스크립트가 파일 내 참조를 세지 않는 알려진 오탐) |
| 값 export `relativeToDownloads` | **기존 죽은 코드** — 프로덕션·테스트 참조 0. 이번 변경과 무관(0160 부터 존재) | **파생 이슈 D2** 로 기록. 이번 범위 밖 |
| 테스트에만 등장 `XSRF_HEADER`·`buildSearchCql`·`escapeCqlLiteral` | 정상 | 셋 다 `rest.ts` 내부에서 쓰인다(`attachmentDataRequest`·`attachmentDownloadRequest` 가 `XSRF_HEADER`, `searchRequest` 가 `buildSearchCql`, 그것이 `escapeCqlLiteral`). 파일 내 참조 미집계 오탐 |
| 타입 전용 export `AssetMeta` (신규) | 정상 | `DownloadStore.saveAsset` 시그니처가 쓴다. `SavedAsset` 에서 **파생**돼 두 곳이 어긋날 수 없다 |
| 형제 파일 정책 비대칭 | 0건 | — |
| AC 핵심 동사의 테스트 등장 | 확인 — `referencedUsers` 4곳 · `{{user:` 5곳 · `version` 단언 3곳 · `/download/attachments/` 4곳 | 이번 세션 grep |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | userkey → 자리표시자 + 키 수집 | ✅ | `storage-to-markdown.test.ts::"userkey 멘션을 자리표시자로 남기고 키를 모은다"` (수정 없이 red) |
| 2 | `ri:username` 은 조회 없이 사용 | ✅ | 〃`::"username 이 있으면 조회 없이 그대로 쓴다"` (red) |
| 3 | 링크 본문 우선 | ✅ **(가드)** | 〃`::"멘션에 링크 본문이 있으면 그 텍스트를 쓴다"`. **현행도 통과** — 기존 `bodyText` 분기가 이미 그 값을 썼다(구현자 이견 ② 가 정확히 지적). 신규 동작이 아니라 회귀 가드로 재분류 |
| 4 | 중복 멘션 키 1건 | ✅ | 〃`::"같은 사용자를 여러 번 멘션해도 키는 한 번만 모은다"` (red) |
| 5 | 키당 1회 조회 + `displayName` 치환 | ✅ | `connector.test.ts::"멘션 userkey 를 표시 이름으로 치환한다"` — 미리보기·`page.md` **양쪽**과 조회 1회를 단언 (red) |
| 6 | 조회 실패해도 저장되고 자리표시자 0건 | ✅ | 〃`::"사용자 조회가 실패해도 자리표시자를 흘리지 않는다"` (red) |
| 7 | `displayName` 없으면 `username` | ✅ | 〃`::"displayName 이 없으면 username 으로 폴백한다"` (red) |
| 8 | 멘션 0이면 조회 0건 | ✅ **(가드)** | 〃`::"멘션이 없으면 사용자 조회를 하지 않는다"`. 현행도 통과(자명) |
| 9 | `expand=version` 전송 | ✅ | `rest.test.ts::"현재 버전을 알 수 있게 version 확장을 요청한다"` + `connector.test.ts` 에서 실요청 단언 (red) |
| 10 | 버전이 `SavedAsset`·manifest 에 | ✅ | `download-store.test.ts::"assets 디렉터리를…"`(version 3) + `connector.test.ts` manifest 단언 (red) |
| 11 | 본문 URL 의 옛 version 을 안 따른다 | ✅ | `connector.test.ts::"본문 URL 의 옛 version 을 따르지 않고 현재 첨부를 받는다"` — 본문은 `?version=1`, 결과는 3 (red) |
| 12 | `/data` 실패 → `_links.download` 재시도 | ✅ | 〃`::"data 경로가 실패하면 download 링크로 재시도한다"` (red) |
| 13 | 링크의 컨텍스트 경로·쿼리 분해 | ✅ | `rest.test.ts::"download 링크를 컨텍스트 경로와 쿼리를 살려 요청으로 만든다"` (red) |
| 14 | 둘 다 실패 → 그 첨부만 실패 | ✅ | `connector.test.ts::"두 다운로드 경로가 모두 실패해도 페이지 저장은 완료된다"` (red) |
| 15 | 사내 페이지 실기 | ❌ **미검증** | **사람 실기 필요** — 사내 Confluence 접근 불가 |
| **+A** | (선조치 5) 이름 조회 상한 50 + 초과분도 자리표시자 0건 | ✅ | `connector.test.ts::"멘션이 아주 많아도 조회 수에 상한을 둔다"` |
| **+B** | (선조치 7) 취소·크기 초과는 재시도 안 함 | ✅ | 〃`::"취소·크기 초과는 두 번째 다운로드 좌표로 재시도하지 않는다"` |
| **+C** | (선조치 3) 멘션 분기가 페이지·첨부 링크를 가로채지 않음 | ✅ | `storage-to-markdown.test.ts::"페이지·첨부 링크는 종전대로 남는다"` (red) |
| **+D** | (선조치 4) 식별자 없는 멘션도 보존 | ✅ | 〃`::"식별자가 하나도 없는 멘션도 지우지 않는다"` (red) |

**집계(직접 재측정)**: 인수 기준 15건 → ✅14 / ❌1(사람 실기). 선조치로 신설된 기준 4건도 전부
테스트 동반. **코드 존재만으로 센 항목 0.**

**측정력 실측**: 소스 4파일을 `git stash` 한 상태로 재실행 → 신규 19건 중 **17건 red**. green 으로
남은 2건은 AC3·AC8 이고, 매트릭스에 **가드로 표기**했다(측정 대상이 신규 동작이 아님을 숨기지
않는다).

## 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 아래 |
| 인수 기준 ↔ 코드 1:1 | ✅ | 이견 시 중재 | 14/15 |
| 레이어 경계 위반 0 | ✅ | — | 변경 4파일 전부 같은 슬라이스 |
| `storage-to-markdown.ts` 순수성 유지 | ✅ | — | 그 파일에 `ctx`·fetch import **0건**(grep 확인) |
| **실서버 동작(멘션 이름·최신 이미지)** | ✖ 접근 불가 | ✅ | **AC15 대기** |
| `/rest/api/user` 사내 허용 여부 | ✖ | ✅ | 실기에서만 확인 가능 |
| PR 머지 승인 | ✖ | ✅ | — |

## 게이트 재실행 결과

```
$ npm run lint       → ✖ 1 problem (0 errors, 1 warning)   ← useTranscriptVirtualizer, 0102 베이스라인
$ npm run typecheck  → error TS 0건 (3/3)
$ ./node_modules/.bin/vitest run src/main/features/auth-platform/modules/confluence/
   Test Files  8 passed (8) · Tests  167 passed (167)       ← 베이스라인 148 대비 +19
```

전체 스위트의 DB 5파일 실패는 0168 verify 에 기록한 better-sqlite3 ABI 베이스라인 그대로이며,
이번 변경은 `infra/db` 를 건드리지 않는다.

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 스캔: 추가분 **0건**. 등장하는 값은 경로 패턴과 저장 형식 태그뿐이다.
- 변동성/일회성 혼입: 없음 — 추가분은 검출 규칙·좌표 우선순위·토큰 금지사항 등 영속 규칙이다.
- 새 규칙이 기존 §규칙과 모순되지 않는다 — "조용한 내용 소실 금지" 를 멘션으로 **확장**한다.

## PHASES.md 정합성

- **미승격 (의도)** — 0160~0168 이 모두 미승격이라 0169 만 올리면 표가 이력 순서를 잃는다.
  라이브 상태의 정본은 `INDEX.md`(0168 verify 와 같은 판단).

## 검증 자기 리뷰

- **설계 단계**: plan 이 §파생 UX 에서 멘션 조회 증가를 "대개 한 자릿수" 로 **낙관**하고 상한을
  두지 않았다. 직전 라운드에서 P27(모델 출력의 최대 길이)을 축적해 놓고도 **같은 곱셈을 요청
  축에서 반복**했다. → P27 을 "출력" 이 아니라 **"새로 만드는 모든 원천 × 배치 상한"** 으로 넓혀
  읽어야 한다. `failure-patterns.md` 의 P27 에 이 확장을 덧붙인다.
- **설계 단계 2**: plan 이 AC3 을 신규 동작처럼 적었으나 현행도 통과하는 가드였다. 관문 2 규칙 3
  ("현행 코드가 이미 통과하는 기준은 측정력이 0")을 AC 를 *쓸 때* 돌렸어야 했는데, 구현 후
  측정력 실측에서야 드러났다.
- **구현 단계**: 선조치 7건 모두 경계 안이었고 AC 를 약화한 것이 0이다. 특히 5·6·7 은 설계가
  놓친 실환경 실패 축이라 **구현자가 설계를 그대로 받아쓰지 않았다는 증거**다.
- **검증 단계 — 못 본 것**:
  - **AC15(실서버)** 는 대리 검증이 불가능하다. `/rest/api/user` 가 사내에서 허용되는지,
    사용자 페이지의 멘션이 `ri:userkey` 형식인지 **둘 다 미확인**이다. 후자가 아니면(예:
    `ri:account-id` 를 쓰는 배포) AC1 경로가 안 타고 `@사용자` 로만 나온다 — 그 경우
    `confluence.mentions.*` 로그가 단서가 된다.
  - 첨부 "최신 버전" 은 **목록 응답을 신뢰한 결과**다. 목록이 준 버전과 실제 바이트가 같다는
    것은 기계로 확인하지 못했다(fake 서버는 우리가 짠 것이다).

## 결론 / 다음 단계

**PASS.** 인수 기준 15건 중 14건이 테스트와 함께 충족됐고, 선조치로 4건이 더 잠겼다. 남은 1건은
사람 실기다.

**사람에게 남는 것 (AC15)**: 멘션과 갱신된 이미지가 있는 사내 페이지를 `confluence_get_pages` 로
받아 ⓐ `page.md` 의 `@이름` 이 실제 이름인지 ⓑ `assets/` 이미지가 최신 내용인지
ⓒ `manifest.json` 의 `assets[].version` 이 Confluence 화면의 버전과 같은지 확인.
ⓐ 가 전부 `@사용자` 로 나오면 로그(`confluence.mentions.lookup-failed`)를 보면 원인이 갈린다 —
조회 차단이면 실패 수가 찍히고, 저장 형식이 다르면 아예 안 찍힌다.

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | 본문에 사용자가 직접 `{{user:x}}` 를 쓰면 `resolveMentions` 가 `사용자` 로 바꾼다(토큰 충돌) | verify r1 §0 2차 패스 | 확률·피해 모두 작아 이번 범위 밖. 고친다면 토큰에 사설 유니코드 구분자를 넣는 방향 | open (비범위) |
| D2 | `relativeToDownloads` 가 프로덕션·테스트 어디서도 안 쓰인다(0160 부터의 죽은 코드) | verify r1 역방향 탐색 | 삭제 또는 사용처 배선. 이번 변경과 무관 | open (비범위) |
