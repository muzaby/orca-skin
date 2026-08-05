# Verify — 0168-confluence-image-download-regression

## 메타

| 항목 | 값 |
|---|---|
| slug | `0168-confluence-image-download-regression` |
| 검증자 | Claude Code |
| 일자 | 2026-08-05 |
| 대상 커밋 | `109e106` (base `e139efb`) |
| 라운드 | 1 → **2 (재검증 완료)** |
| 상태 | r1 **FAIL** → **r2 PASS** (§r2 재검증 참조) |
| 자기 검증 여부 | **예 — 설계·구현·검증이 모두 Claude.** 사용자 지시로 Codex 부재 환경. §비판적 검토·§역방향 탐색을 더 강하게 적용했다 |

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 (지연·부분 실패·동시 호출·종료 중·권한 거부) | **결함 1건 — D1.** 첨부 목록은 `ATTACHMENT_LIST_LIMIT=200`(`rest.ts:113`)까지 오고, 새 진단 줄이 그 이름을 **상한 없이 전부** 도구 결과에 싣는다(`search-render.ts` 의 `unreferenced.join(', ')`). `get_pages` 는 한 번에 50페이지(`MAX_PAGES_PER_CALL`)이므로 최악 **200×50 = 10,000개 파일명**이 모델 컨텍스트로 들어간다. 같은 파일이 본문 미리보기는 `PREVIEW_CHARS=4000` 으로 **일부러 자르고 있는데**(`connector.ts:48-50` — "대용량 페이지가 컨텍스트를 통째로 먹지 않게") 새로 넣은 출력만 무제한이다 | `connector.ts:48-50` ↔ `search-render.ts:85-96` · `rest.ts:113` |
| 권한 거부·부분 실패 (그 외) | **양호** — 목록 조회 실패는 참조 0개일 때만 삼키고(`collectAttachments`) 그 외는 전파한다. 첨부 개별 실패는 `partitionSettled` 로 페이지를 죽이지 않는다. `includeAttachments:false` 는 요청 0건 | `connector.ts` `collectAttachments` · `connector.test.ts::"진단용 목록 조회가 실패해도 페이지 저장은 완료된다"` |
| **잘못된 성공(false success)** 이 가능한 경로 | **없음 — 오히려 반대 방향으로 개선됐다.** 변경 전에는 검출 실패가 "첨부 없는 페이지" 라는 **잘못된 성공**으로 보였다(이번 작업의 동기). 후보가 목록에 없으면 `failedAssets` 에 사유가 남고, 참조가 0개면 진단 줄이 뜬다. 다만 **D1 이 그 개선을 과하게 실어** 다른 문제를 만든다 | `search-render.ts:85-96` · `connector.ts` `downloadAttachments` 의 `missing` |
| 되돌릴 수 있는가 (마이그레이션·파일 쓰기·외부 상태) | **예.** 파일 쓰기는 `<downloads>/confluence/<connectorId>/<pageId>/` 아래로 한정되고 경로는 `resolveAssetPath` 가 fail-closed 로 잠근다. DB·마이그레이션·IPC 스키마 변경 0 | `download-store.ts:52-59` · 변경 파일 목록에 `migrations/`·`shared/ipc.ts` 없음 |
| 설계가 의도한 것을 구현이 실제로 했는가 (비슷한 다른 것 아닌가) | **했다.** plan §설계 (1)(2)(3) 이 코드에 1:1로 있다. 승격 조건 3개(스킴 없음·`/download/` 접두사·이름 획득)가 `parseDownloadHref` 에 그대로 있고, "다운로드는 여전히 참조분만" 이 `wanted` 필터 무변경으로 지켜졌다 | plan §설계 ↔ `storage-to-markdown.ts` `parseDownloadHref` · `connector.ts` `downloadAttachments` |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | **넘지 않았다.** 선조치 3건은 전부 *구현 세부·놓친 엣지케이스·명백한 회귀* 다. 인수 기준을 **약화한 것이 하나도 없고** 오히려 AC11 에 단언을 더하고 AC 를 1건 신설했다. `parseDownloadHref` 를 export 하지 않은 것은 설계 대비 축소지만 **테스트 커버리지를 줄이지 않으므로**(분기 전부가 `storageToMarkdown` 경유로 덮인다) 허용 범위 | plan §[구현자 기입] 문제 1~4 · `storage-to-markdown.test.ts` 신규 8건 |

## 역방향 탐색 (매트릭스 전 선행)

```
$ bash .agents/skills/handoff-verify/scripts/scan-surface.sh e139efb..109e106
→ 1a) 값 export 미사용: (없음)
→ 2) 테스트에만 등장: (없음)
→ 3) 형제 파일 정책 비대칭: (없음)
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 타입 전용 export `ConfluenceSearchHit` · `StorageConversion` | **정상** — 둘 다 이번 변경 이전부터 있던 심볼이고 정의 파일 내부 시그니처에 쓰인다(`ConfluenceSearchResult.hits` · `storageToMarkdown` 반환형) | `connector.ts` · `storage-to-markdown.ts` |
| 값 export 미사용 0건 | **정상** — 신규 심볼(`parseDownloadHref`·`decodeSegment`·`normalizeDownloadImages`·`collectAttachments`·`DownloadOutcome`)을 **전부 비-export 로 둔 결과**다. 소비자 없는 공개 표면이 0 | `storage-to-markdown.ts` · `connector.ts` |
| 신규 필드의 외부 소비자 | **모듈 밖 참조 0건** — `grep -rn "ConfluencePageResult\|unreferencedAttachments" src/ --include=*.ts` 가 `modules/confluence/` 밖에서 0건. IPC·DB·renderer 로 새지 않는다(plan §범위의 "IPC 변경 없음" 과 일치) | 이번 세션 grep |
| 인수 기준 핵심 동사의 테스트 등장 | **확인** — `unreferencedAttachments` 는 `connector.test.ts` 4곳·`search-render.test.ts` 3곳, `download` 경로 승격은 `storage-to-markdown.test.ts` 6곳에 등장 | 이번 세션 grep |
| plan 이 "N곳" 이라 적은 것 재측정 | **일치** — `referencedAttachments` 생산 지점은 여전히 `normalizeImages` 한 곳(그 안에서 2패스), 소비 지점도 `fetchPage` 한 곳 | `storage-to-markdown.ts:85-136` · `connector.ts` `fetchPage` |

**스크립트 밖에서 추가로 잡은 것**: D1 은 위 세 후보 어디에도 걸리지 않았다 — 미사용도, 테스트
전용도, 비대칭도 아니다. **§0 의 "실환경에서 실패하는 방식" 질문에서만 나왔다.** 스크립트는
후보 생성기이지 판정기가 아니라는 것이 이번 라운드에서도 확인됐다.

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 ①: "§설계 (2)의 '반환값에 얹으면 족하다' 는 부족했다 — 목록 조회 실패가 페이지를 죽인다" | **타당.** 재현 경로가 명확하고(참조 0개 페이지 + 목록 500) 기존 테스트 3건이 즉시 red 로 잡았다. `collectAttachments` 의 비대칭(참조 0개일 때만 삼킴)도 옳다 — 참조가 있을 때 삼키면 "받을 수 없었음" 이 무성이 된다 | 매트릭스 AC9 의 증거로 채택 + 신규 AC 로 인정 |
| 이견 ②: "`parseDownloadHref` 를 export 하지 않았다(설계 대비 축소)" | **타당.** 분기 6개(스킴·`//`·접두사·alias·세그먼트 공백·디코드 실패)가 전부 `storageToMarkdown` 경유 테스트로 덮인다 — 직접 확인했다. export 는 소비자 없는 표면만 늘렸을 것 | 매트릭스 감점 없음. 다만 §자기 리뷰에 "plan 이 export 를 지시한 것 자체가 과했다" 로 기록 |
| 선조치 ✅ #1(`collectAttachments`)·#2(AC11 단언)·#3(디코드 폴백) | **경계 안** — 셋 다 구현 세부/엣지케이스/명백한 회귀 | 그대로 인정 |
| 선조치 ⚠️ #4(`uniqueName` 링크 desync — 보고만) | **판단 옳다.** 이번 변경이 만든 결함이 아니고 저장 파일명 규칙 변경이 필요하다 | **파생 이슈 D2 로 이관**(다음 라운드 아님 — 후속 핸드오프 후보) |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `/download/attachments/…` img → 참조 + `assets/` 링크 | ✅ | `storage-to-markdown.test.ts::"download 경로 img 를 첨부 참조로 인식한다"` — 수정 없이는 **red** 확인 |
| 2 | `data-linked-resource-default-alias` 우선 | ✅ | 〃`::"data-linked-resource-default-alias 를 파일명으로 우선한다"` (수정 없이 red) |
| 3 | `/download/thumbnails/…` 도 참조 | ✅ | 〃`::"thumbnails 경로도 첨부 참조다"` (수정 없이 red) |
| 4 | percent-encoded 세그먼트 디코드 | ✅ | 〃`::"인코딩된 파일명을 디코드해 참조로 싣는다"` (수정 없이 red) |
| 5 | 외부 절대 URL img 는 참조 아님 + src 유지 | ✅ **(가드)** | 〃`::"외부 절대 URL img 는 참조가 아니다"`. 현행도 통과 — plan 이 **과잉검출 가드**로 명시한 항목이라 정상 |
| 6 | `/download/` 밖 host-relative img → assets 0 **+ failedAssets 0** | ✅ **(가드)** | `connector.test.ts::"download 경로 밖 img 는 첨부 후보가 아니다"`. 현행도 통과(가드) |
| 7 | `ac:image`+raw img 중복 → 참조 1건 | ✅ | `storage-to-markdown.test.ts::"같은 첨부를 두 형식이 가리켜도 한 번만 센다"` |
| 8 | alt 없으면 파일명 | ✅ | 〃`::"alt 가 없으면 파일명을 쓴다"` (수정 없이 red) |
| 9 | 참조 0개여도 목록 1회 조회 + 이름 전부 진단으로 | ✅ | `connector.test.ts::"참조가 없어도 첨부 목록을 조회해 진단으로 남긴다 — 받지는 않는다"`. `/child/attachment` 1건 · `/data` 0건 · 이름 2건 단언 (수정 없이 red) |
| 10 | 참조 있을 때 참조 밖 첨부는 이름만 | ✅ | 〃`::"참조 밖 첨부는 받지 않고 이름만 남긴다"` (수정 없이 red) |
| 11 | `includeAttachments:false` → 요청 0건 + 빈 배열 | ✅ | 〃`::"includeAttachments:false 면 첨부 목록도 조회하지 않는다"` (단언 추가로 수정 없이 red) |
| 12 | `manifest.json` 기록 | ✅ | 〃`::"manifest 에 참조 밖 첨부를 기록한다"` — 실제 파일을 읽어 단언 (수정 없이 red) |
| 13 | assets 0 + unreferenced>0 → "찾지 못했습니다" + 이름 | ✅ **단, D1 대상** | `search-render.test.ts::"참조를 못 찾았는데 첨부가 있으면 그 사실을 말한다"` (수정 없이 red). **기준은 충족하나 출력 상한이 없다 — D1** |
| 14 | assets>0 + unreferenced>0 → 두 줄 모두 | ✅ **단, D1 대상** | 〃`::"내려받은 첨부와 참조 밖 첨부를 함께 보고한다"` (수정 없이 red). 동일 |
| 15 | 사내 페이지 실기 — assets/ 에 파일 생성 | ❌ **미검증** | **사람 실기 필요.** 사내 Confluence 접근 불가(plan R7) |
| 16 | 0건이면 진단 줄이 다음 조치를 지정 | ❌ **미검증** | 동일. 단 AC13·14 로 **문장 자체는** 기계 검증됨 |

**충족 집계(직접 재측정)**: ✅ 14 / ❌ 2(둘 다 사람 실기). 구현 보고의 `Criteria-Met: 14/16` 과
일치하며, **14건 전부 테스트를 동반**한다(코드 존재만으로 센 항목 0).

**측정력 재측정**: 소스 3파일만 `git stash` 하고 모듈 스위트 재실행 → 신규 15건 중 **13건 red**.
green 으로 남은 2건은 AC5·AC6 으로, plan 이 과잉검출 가드로 사전 명시한 항목과 정확히 일치한다.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | lint 0 error · typecheck 3/3 · vitest 아래 참조 |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일::케이스`) | 이견 시 중재 | 14/16 ✅ |
| 레이어 경계(eslint-boundaries) 위반 0 | ✅ | — | 변경 4파일 전부 같은 슬라이스 — 위반 0 |
| 문서 형식/링크/한국어 컨벤션 | ✅ | — | plan·verify·모듈 AGENTS.md 한국어 유지 |
| AGENTS.md 위생(키/토큰/이메일/IP) 스캔 | ✅ grep 보고 | ✅ 맥락 최종 판단 | 아래 §위생 검토 |
| **실서버 동작(사내 Confluence)** | ✖ 접근 불가 | ✅ | **AC15·16 사람 확인 대기** |
| 제품 의도 부합 (폴백 복원 배제) | ✖ 보조 의견 | ✅ 결정 | 2026-08-05 사용자 결정으로 확정 — 코드가 그대로 따름 |
| PR 머지 승인 | ✖ | ✅ | — |

## 게이트 재실행 결과

```
$ cd app && npm run lint
✖ 1 problem (0 errors, 1 warning)
  → useTranscriptVirtualizer.ts:22 react-hooks/incompatible-library (0102 베이스라인, 변경 무관)

$ npm run typecheck
typecheck:node ✅  typecheck:web ✅  typecheck:test ✅   (3/3)

$ ./node_modules/.bin/vitest run src/main/features/auth-platform/modules/confluence/
Test Files  8 passed (8) · Tests  147 passed (147)      ← 베이스라인 132 대비 +15

$ ./node_modules/.bin/vitest run          # 전체
Test Files  5 failed | 197 passed (202) · Tests  39 failed | 1857 passed (1896)
```

**환경 기인 분리 (SKILL.md §4)** — 실패 5파일 전수와 판정:

| 실패 파일 | DB 로드 | 판정 |
|---|---|---|
| `src/main/infra/db/queries.test.ts` | ✅ | ABI 베이스라인 |
| `src/main/infra/db/migrate.test.ts` | ✅ | ABI 베이스라인 |
| `src/main/features/orchestration/fork.test.ts` | ✅ | ABI 베이스라인 |
| `src/main/features/extensions/builder.test.ts` | ✅ | ABI 베이스라인 |
| `src/main/app/chat-turn.continuity.test.ts` | ✅ | ABI 베이스라인 |

서명 `Module did not self-register: …/better_sqlite3.node` **6회**. **베이스라인 5파일을 제외한
실패는 0건**이며, 이번 변경은 `infra/db`·마이그레이션을 건드리지 않는다(변경 파일 4개 전부
`modules/confluence/`). `app/AGENTS.md §better-sqlite3 ABI` 의 알려진 제약과 일치한다.

## 위생 검토 (AGENTS.md 변경 시)

- 키/토큰/이메일/IP 패턴 스캔: `modules/confluence/AGENTS.md` 추가분에 **0건**. 등장하는 주소는
  `/download/attachments/`·`/images/icons/…` 같은 **경로 패턴**뿐이고 사내 호스트명은 없다.
- 변동성/일회성/장문 코드설명서 혼입: 추가분은 *검출 규칙·진단 계약·금지 사항* 으로 영속 규칙에
  해당한다. 라운드 상태·커밋 해시 같은 변동성 정보는 넣지 않았다(`INDEX.md` 로 분리).
- "폴백을 되살리지 마라" 인용블록은 **사용자 결정(2026-08-05)** 을 근거로 명시했다 — AGENTS.md
  위생 규칙의 "모순 규칙 금지" 에 부합(기존 §규칙과 충돌 없음).

## PHASES.md 정합성

- **미승격 (의도)** — r1 은 FAIL 이라 당연히 미승격이고, **r2 PASS 후에도 올리지 않는다.**
  근거: `docs/PHASES.md` 를 grep 하면 승격된 최신 핸드오프가 `0158` 이고 **`0160`~`0167` 이
  전부 미승격**이다(이번 세션 실측 — `grep -o "01[0-6][0-9]" docs/PHASES.md | sort -u` 의 최대값
  = 0158). 0168 만 끼워 넣으면 표가 이력 순서를 잃는다. 라이브 상태의 정본은 `INDEX.md` 이고
  (`PHASES.md §현재 작업 중` 이 그렇게 위임한다), 0160 계열 일괄 승격은 별건이다.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan 이 §파생 UX 에서 "요청 1회 증가" 라는 **호출 횟수** 비용은 따졌으면서
  **출력 크기** 비용은 따지지 않았다(D1). 같은 파일이 `PREVIEW_CHARS` 로 이미 출력 상한을
  운영하고 있었는데도 그렇다. → 다음 plan 이 따라 할 형태: **"모델 컨텍스트로 나가는 필드를
  새로 만들 때, 그 필드의 최대 길이를 원천 상한(여기서는 `ATTACHMENT_LIST_LIMIT` × 배치 상한)
  으로 곱해 계산하고, 같은 파일에 이미 있는 상한 상수와 나란히 적는다."** — `failure-patterns.md`
  에 신규 패턴으로 추가 대상.
- **설계 단계 2**: plan 이 `parseDownloadHref` 를 **export 해서** 단위 테스트하라고 지시한 것은
  과했다. "순수부로 떼어라" 와 "export 하라" 는 다른 요구이고, 후자는 소비자 없는 공개 표면을
  만든다. 구현자가 이를 축소한 판단이 옳았다.
- **구현 단계**: 선조치 경계를 지켰고(3건 모두 ✅ 범위), 설계를 그대로 받아쓰지 않고 §설계 (2)의
  구멍(목록 조회 실패 전파)을 실행으로 잡아냈다 — 기존 테스트 3건이 red 로 경고했을 때 그것을
  "테스트를 고칠 일" 이 아니라 "회귀" 로 읽은 것이 옳은 판단이었다.
- **검증 단계 — 이번 verify 가 못 본 것**:
  - **AC15·16(실서버)** 은 전혀 대리하지 못했다. AC13·14 의 렌더러 문자열 테스트는 *문장이
    만들어지는가* 의 대리일 뿐, *그 문장이 사용자 페이지에서 유용한 이름을 담는가* 는 못 잰다.
  - **raw `<img>` 가 실제 사내 저장 형식인지** 여전히 미확인이다(plan R7 그대로). 이번 라운드가
    고친 것이 사용자 증상과 같은 것이라는 **기계 증거는 없다** — 있는 것은 "미검출 형식 하나를
    검출하게 만들었다" 와 "못 찾으면 이름을 보여 준다" 두 가지다.
  - 자기 검증(설계=구현=검증 동일 에이전트)이라 §0 의 다섯 질문을 한 번 더 돌렸고, D1 은 그
    두 번째 패스에서 나왔다. **첫 패스에서는 놓쳤다** — 자기 코드의 신규 출력을 "의도한 것" 으로
    읽는 편향이 실재한다.

## [FAIL 시] 미충족 요구사항 (구현자 액션 아이템)

- [ ] **D1 — 진단 출력에 상한을 둔다.** `renderPage` 의 `unreferenced` 나열이 무제한이다.
      모델 컨텍스트로 나가는 이름 수를 상수로 제한하고(`PREVIEW_CHARS` 와 같은 자리·같은 성격),
      잘렸으면 그 사실과 전체 개수를 문장에 남긴다. **`manifest.json` 은 전량 유지**한다 —
      디스크는 컨텍스트 비용이 없고 나중에 되짚는 용도다. 상한 동작을 잠그는 테스트를 추가한다.
- 그 외 인수 기준 미충족: **없음**(AC15·16 은 사람 실기 대기이지 구현자 액션이 아니다).

## 결론 / 다음 단계

**FAIL (r1).** 인수 기준 16건 중 14건이 테스트와 함께 충족됐고 2건은 사람 실기 대기다. 기준
자체는 미충족이 없으나, **기준 밖에서 D1 이 나왔다** — 이번 변경이 새로 만든 모델 컨텍스트
출력에 상한이 없다. 같은 파일이 본문 미리보기를 일부러 4000자로 자르고 있는 것과 정면으로
어긋나므로 조용히 통과시키지 않는다.

다음: 구현자(Claude) → r2 에서 D1 을 닫고 재검증.

---

## r2 재검증 (2026-08-05)

### D1 조치 확인

| 항목 | 결과 |
|---|---|
| 조치 내용 | `search-render.ts` 에 `MAX_DIAGNOSTIC_NAMES = 20` + `nameList()` 도입. 상한을 넘으면 앞 20건만 싣고 `… 외 N개 (전체 목록은 manifest.json)` 를 붙인다. **전체 개수(`unreferenced.length`)는 잘리기 전 값을 그대로 말한다** — 모델이 목록을 완전한 것으로 오독하지 않는다 |
| 데이터 손실 여부 | **없음.** `connector.ts` 의 `unreferencedAttachments` 와 `manifestOf` 는 무변경 — 전량이 `manifest.json` 에 남는다. 자른 것은 **모델 컨텍스트로 나가는 표면 하나뿐**이다 |
| 최악 출력 | 페이지당 이름 20건 + 꼬리 문장. 50페이지 배치에서도 1,000건 상한으로 묶인다(이전: 10,000건 무제한) |
| 회귀 테스트 | `search-render.test.ts::"진단 목록이 길면 잘라내고 남은 개수를 알려 준다"` — 57건 입력에 대해 ⓐ 전체 개수 57 표기 ⓑ 20번째 포함 ⓒ **21번째 미포함** ⓓ `외 37개` 꼬리를 모두 단언 |
| 상한 상수의 자리 | `PREVIEW_CHARS`(connector) 와 **같은 성격의 상수를 각자 출력이 만들어지는 파일에** 둔다. 렌더러 출력은 렌더러가 자른다 — 판정 지점이 흩어지지 않는다 |

### r2 게이트

```
$ ./node_modules/.bin/vitest run src/main/features/auth-platform/modules/confluence/
Test Files  8 passed (8) · Tests  148 passed (148)      ← r1 147 대비 +1 (D1 회귀)
$ npm run lint       → ✖ 1 problem (0 errors, 1 warning)  ← 0102 베이스라인, 변경 무관
$ npm run typecheck  → error TS 0건 (3/3 통과)
```

### r2 매트릭스 델타

AC13·14 의 "단, D1 대상" 단서가 해소됐다 — 두 기준 모두 **상한이 걸린 상태로** 충족한다.
나머지 12건은 r1 증거 그대로 유효하다(해당 코드 무변경). **✅ 14 / ❌ 2(사람 실기)** 는 불변.

### r2 자기 리뷰 추가분

- **못 본 것은 r1 과 같다** — AC15·16(실서버)은 여전히 대리 불가이고, 사용자 증상이 raw `<img>`
  때문이라는 기계 증거도 여전히 없다. r2 는 D1 만 닫았고 그 경계를 넓히지 않았다.
- D1 이 §0 **두 번째 패스**에서야 나온 것이 이번 라운드의 교훈이다. 자기 코드를 검증할 때
  "새로 만든 출력" 은 의도한 것으로 읽혀 첫 패스를 통과한다 — **신규 출력 필드마다 최대 길이를
  원천 상한의 곱으로 계산하는 질문**을 §0 에 고정하는 것이 실효적이다.

### r2 결론

**PASS.** D1 이 회귀 테스트와 함께 닫혔고 게이트가 전량 green 이다(DB 스위트 5건은 better-sqlite3
ABI 베이스라인 — 위 §게이트 재실행 결과의 분리표 참조). D2 는 이번 범위 밖으로 남긴다.

**사람에게 남는 것**: AC15·16 실기. 사내 Confluence 에서 `confluence_get_pages` 를 돌려
ⓐ `assets/` 에 이미지가 생기는지 ⓑ 안 생기면 결과의 "본문에서 이미지 참조를 찾지 못했습니다 …"
줄에 어떤 첨부 이름이 나오는지 — **ⓑ 의 이름이 다음 검출 규칙을 지정한다.**
