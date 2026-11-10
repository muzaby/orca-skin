# Plan — 0303-mail-get-and-sync-modes

> 메일 플러그인에 본문 전체를 나눠 읽는 `mail_get`을 추가하고, `mail_sync`가 증분 갱신과 전체 재갱신을 고를 수 있게 한다. `mail_search`는 그대로 둔다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0303-mail-get-and-sync-modes` |
| 작성자 | Claude Code |
| 일자 | 2026-11-10 |
| 상태 | READY |
| 구현 주체 | 사용자 결정 대기 — 도구 추가는 기능 구현(기본 Codex). Codex 부재 환경이면 사용자 지시로 Claude |
| V mode | `Baseline V` — 명시적으로 상속할 V 없음 |
| 기준 V | `none` |
| 이번 V revision | `V1 rev.2` — rev.1(`e67b718`, 구현 전)에서 파라미터 이름만 변경(D-015). 동작·노드·pair 불변 |
| 유효 V | `V1` |
| 기준 커밋 | `e7991dd` (0302 r1 구현 포함, 0302는 검증 대기). 이 plan은 0302의 `bodySource`·`noBodyMails`·`skippedMails`·RETR 원문 fixture hook 위에 선다 |

---

# Part I — Product & UX Contract

## 1. Context / 목표

**문제.**
- `mail_search`는 본문 맨 앞 300자만 돌려주고(`store/index.ts:346`), 본문 전체를 읽는 도구가 없다. 본문 뒤쪽 단어로 메일을 찾아도 모델은 그 내용을 읽지 못한다.
- `mail_sync`는 새 UIDL만 받는다. 이미 받은 메일을 다시 받아 캐시를 고칠 방법이 없다 — 0302 이전에 본문 없이 저장된 HTML 메일이 그대로 남는다.

**완료 후.**
- 모델이 `mail_get`으로 메일 한 통의 본문을 처음부터 끝까지 여러 번에 나눠 읽는다.
- `mail_sync`에 `mode: 'full'`을 주면 보존 기간 안의 서버 메일을 전부 다시 받아 캐시를 덮어쓴다. 기본은 지금과 같은 증분이다.
- `mail_search`의 입력·출력은 바뀌지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 1 | "Sync는 부분 갱신, 전체 (재)갱신 할 수 있도록." | 사용자 턴 2026-11-10 |
| 명시 요구 2 | "Search는 유지" | 같은 턴 |
| 명시 요구 3 | "Get 추가. 본문 전체 조회 기능 제공. 단 본문이 길 수 있으니, offset, length 개념을 추가해 여러번에 걸쳐 모델이 조회할 수 있도록 도구를 구현할 것. E.g., 1~100 라인 조회, 101~200 라인 조회 같이 크기가 크면 여러번에 걸쳐 조회. 100값을 제안하는 것이 아님" | 같은 턴 |
| 추론 의도 | "부분 갱신" = 현재의 증분 동기화(새 메일만), "전체 (재)갱신" = 이미 받은 메일까지 다시 받아 덮어쓰기 — 추론 | 직전 대화: 300자 한계와 기존 빈 본문 캐시가 논의됨 |
| 추론 의도 | offset·length의 단위는 사용자가 정하지 않았다("개념", "E.g."). 라인은 예시다 — 추론 | 요구 3 원문 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | `mail_search`의 입력 스키마·결과 필드·snippet 300자·정렬·상한을 바꾸지 않는다 | "Search는 유지" | 사용자 | ACTIVE | — |
| D-002 | 새 도구 `mail_get`: 입력 `{ mailId, offset?, maxChars? }`, 로컬 캐시만 읽는다. `readOnlyHint:true`·`idempotentHint:true`·`openWorldHint:false` — 승인 없이 호출된다 | "Get 추가. 본문 전체 조회 기능 제공". 승인은 `readOnlyHint`가 정한다(`adapters/common/runtime-tool-policy.ts:25`), `mail_search`와 같은 등급 | 사용자 + 조사 | ACTIVE | — |
| D-003 | `offset`·`maxChars`의 단위는 **문자(UTF-16 code unit)**다. `offset`은 0부터, 응답은 `totalChars`와 `nextOffset`(다음 호출의 offset, 끝이면 `null`)을 준다 | 라인 단위는 한 줄이 한 문단인 본문(HTML 변환 결과·줄바꿈 없는 평문)에서 한 번의 응답 크기를 묶지 못하고, 줄 중간에서 이어 읽으려면 결국 문자 offset이 필요하다. 문자 단위는 항상 이어 읽을 수 있다. 모델은 `nextOffset`만 따라가면 된다 | 설계자 판단(요구 3 "offset, length 개념") | ACTIVE — 사용자 확인(rev.2): "Offset, length는 개념적인것" | — |
| D-004 | `maxChars` 기본 **8,000**, 최대 **16,000** 문자. 상수는 `body-window.ts` 한 곳(`MAIL_GET_DEFAULT_CHARS`·`MAIL_GET_MAX_CHARS`) | 사용자: "100값을 제안하는 것이 아님" — 값은 설계자 몫. 기준은 기존 `mail_search` 응답 상한 ≈31KB(0237 §14)와 같은 자릿수. HTML 본문 최대(변환 입력 128Ki자)도 기본값으로 십수 회에 다 읽힌다 | 설계자 판단 | ACTIVE — 값 조정은 사용자 지시로 | — |
| D-005 | 창 경계는 code point를 가르지 않는다. 시작이 low surrogate면 한 칸 앞으로, 끝이 pair를 가르면 한 칸 앞으로 당긴다. 그 결과 빈 창이 되면(요청 길이 1이 pair에 걸림) pair 전체를 준다. 응답 `offset`·`maxChars`는 실제 값이다 | 이모지가 반쪽으로 잘려 깨진 문자가 모델에 가지 않게 한다 | 설계자 판단 | ACTIVE | — |
| D-006 | `mail_get` 응답: `{ mailId, date, from, to, cc, subject, bodySource, totalChars, offset, returnedChars, text, nextOffset, attachmentCount, attachments, attachmentsTruncated? }`. 메타데이터는 매 호출에 싣는다(무상태). 첨부 manifest는 메일당 10건 상한 + `attachmentsTruncated` — `mail_search`와 같은 형상 | 모델이 이전 호출을 기억하지 않아도 되고, 첨부 조회(`mail_getAttachment`)로 바로 이어진다 | 설계자 판단 | ACTIVE | — |
| D-007 | `mailId`가 `^[1-9][0-9]*$`가 아니거나 그 메일이 없으면 `{ error: 'mail_not_found' }` + `isError`. `offset`이 본문 길이 이상이면 오류가 아니라 `text:''`·`nextOffset:null` | `Number('1e2')` 같은 느슨한 변환으로 다른 메일이 조회되지 않게 한다. 끝을 넘긴 offset은 "다 읽었다"는 정상 신호 | 설계자 판단 | ACTIVE | — |
| D-008 | `mail_sync` 입력 `mode?: 'incremental' \| 'full'`, 기본 `incremental`. `incremental`은 현행 동작 그대로(5분 freshness 포함) | "Sync는 부분 갱신, 전체 (재)갱신 할 수 있도록" — 부분 = 증분(§2 추론) | 사용자 + 추론 | ACTIVE — "부분"의 뜻이 다르면 사용자 정정 | — |
| D-009 | `full`: freshness를 건너뛰고, 서버 UIDL 전부를 대상으로 TOP → 14일 경계 판정 → RETR → 덮어쓰기 저장한다. **지우지 않는다** — 서버에 없는 캐시 메일은 그대로 남고(ledger `missing`), 보호 판정(bulk loss)·연속 old-header 중단·메시지별 파싱 격리는 증분과 같다 | "(재)갱신"은 다시 받기다. 삭제까지 하면 서버 장애 순간의 full이 캐시를 날린다. 0237 D-007·D-026·D-047·D-062와 0302 D-009를 그대로 적용 | 사용자 + 설계자 | ACTIVE | — |
| D-010 | 성공 결과에 `mode`와 `updatedMails`를 싣는다. `newMails` = 저장한 메일 중 ledger에 active로 없던 것, `updatedMails` = active로 있던 것(증분에서는 항상 0) | full에서 "새 메일 N"만 주면 재저장분이 새 메일로 읽힌다 | 설계자 판단 | ACTIVE | — |
| D-011 | 동시 호출 규칙: 진행 중 동기화가 `full`이면 어떤 요청이든 합류한다. 진행 중이 `incremental`이고 요청도 `incremental`이면 합류한다. 진행 중이 `incremental`인데 요청이 `full`이면 **그 동기화가 끝난 뒤 full을 새로 돈다**. 합류한 호출자는 실제 돈 `mode`를 결과에서 본다 | 현재는 모드가 없어 무조건 합류한다(`tools.ts:45-85`). full 요청이 증분 결과를 받으면 재갱신이 조용히 안 된 것이다. full ⊇ incremental | 설계자 판단 | ACTIVE | — |
| D-012 | 새 도구는 도구 목록 **맨 뒤**에 둔다: `[mail_sync, mail_search, mail_getAttachment, mail_get]` | 기존 mail 테스트 14곳이 `implementations[0..2]` 위치로 부른다(§8) — 순서를 바꾸면 무관한 테스트가 깨진다 | 조사 | ACTIVE | — |
| D-013 | 스키마 변경·마이그레이션·새 의존성 없음 | 본문은 이미 `body_text`에 전부 저장돼 있다 | 조사 | ACTIVE | — |
| D-015 | 파라미터 이름: 입력은 `offset`·`maxChars`, 응답은 `offset`·`returnedChars`·`totalChars`·`nextOffset`. rev.1의 입력 `length`·응답 `length`를 대체한다 | 사용자: "Offset, length는 개념적인것. 더 나은 파라미터 이름이 있으면 거기에 맞춰라". `maxChars`는 단위(문자)와 "상한"(경계 보정·본문 끝에서 더 짧게 올 수 있음)을 이름이 말한다. `offset`은 응답의 `nextOffset`과 짝이라 유지. 응답의 길이는 요청값과 헷갈리지 않게 `returnedChars` | 사용자 + 설계자 | ACTIVE | ← rev.1 이름 |
| D-014 | 서버 descriptor `instructions`와 `mail_sync`·`mail_get` 설명에 사용법을 적는다: 검색 뒤 본문이 더 필요하면 `mail_get`, `nextOffset`으로 이어 읽기, `full`은 사용자가 전체 재갱신을 원하거나 캐시 본문이 비정상일 때만 | full은 보존 기간 전체를 다시 받는다 — 모델이 습관적으로 쓰면 서버 부하(0237 D-008의 취지) | 설계자 판단 | ACTIVE | — |

### 갱신 메모

- rev.2 (2026-11-10): 사용자 지시로 이름 변경 — 입력 `length` → `maxChars`, 응답 `length` → `returnedChars`, 상수 `MAIL_GET_*_LENGTH` → `MAIL_GET_*_CHARS`. `ACTIVE 결정 ↔ AC 대조: 충돌 0`(D-015→AC1·AC3·AC4·AC5, 나머지 매핑 불변).
- V1 신규. 0302(검증 대기)의 산출 위에 서지만 그 V를 상속하지 않는다 — 0302 pair는 0302 verify가 닫는다.
- `ACTIVE 결정 ↔ AC 대조: 충돌 0` — D-001→AC16, D-002→AC1·AC9·AC18, D-003→AC1~AC3, D-004→AC4, D-005→AC5, D-006→AC1·AC7·AC8, D-007→AC4·AC6, D-008→AC10·AC17, D-009→AC11~AC14, D-010→AC10·AC11, D-011→AC15, D-012→AC18, D-013→AC20, D-014→AC18.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구 3이 원인을 겨냥하는가 | **타당.** 본문은 전부 저장돼 있는데 꺼낼 표면이 없다 | `store/index.ts:346` `snippet: row.bodyText.slice(0, 300)` · 도구 3개(`tools.ts:96-110`) |
| 이미 충족됐는가 | 아니오 | `rg "mail_get\b" app/src` → 0건 |
| 라인 단위가 맞는가 | **이견 → 문자 단위(D-003).** 사용자가 단위를 예시로만 들었고, 라인은 응답 크기를 묶지 못한다 | 0302 실측: turndown 출력은 문단이 한 줄. 평문 메일도 줄바꿈 없는 긴 줄이 흔하다 |
| 요구 1 "부분 갱신"의 뜻 | 증분으로 해석. 다른 뜻(특정 메일만·기간 지정)이면 결과가 달라지므로 완료 보고에서 사용자에게 확인을 구한다 | §2 |
| full이 freshness(0237 D-008)와 충돌하는가 | 충돌하지 않게 한정 — freshness는 증분에만 남고, full은 명시적 입력일 때만 건너뛴다 | `0237 plan.md` D-008 · EP-06 "연속 검색이 POP3를 반복 호출" |
| full이 0302 D-011(기존 캐시 복구 안 함)과 충돌하는가 | 아니오. D-011은 자동 복구 코드를 만들지 않는다는 결정이고, 0237 D-060은 "기존 원문 재수집은 별도 사용자 요청이 있을 때"라고 적었다 — 이번이 그 요청이다 | `0237 plan.md:1559` |
| 더 작은 해법 | snippet을 늘리는 것은 "Search는 유지"에 어긋나고 응답만 커진다. full 대신 캐시 삭제 도구는 파괴적이다 | D-001 · D-009 |
| "도구 3개" 기존 계약 | 0237 테스트가 3개를 잠근다 — 사용자 요구로 4개가 된다. 해당 단언을 갱신한다 | `tools.test.ts:16` · `mail.integration.test.ts:477,547` |

## 5. 동작 / 사용자 흐름

```text
mail_search(query) → hits[{ mailId, snippet(300자), bodySource, … }]      (변경 없음)
mail_get(mailId)                 → { text: 0~8,000자, totalChars, nextOffset: 8000, 메타, 첨부 manifest }
mail_get(mailId, offset: 8000)   → { text: 다음 창, nextOffset: 16000 | null }
        … nextOffset 이 null 이 될 때까지

mail_sync()                → 증분 (현행: freshness → 새 UIDL만)
mail_sync(mode: 'full')    → freshness 생략 → 서버 UIDL 전부: TOP → 14일 판정 → RETR → 덮어쓰기
                             → { synced:true, mode:'full', newMails, updatedMails, noBodyMails, skippedMails, … }
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| `mail_get(mailId)` — 본문이 기본 길이보다 긺 | 앞 8,000자 창 | `text`·`totalChars`·`nextOffset:8000` |
| `mail_get(mailId, offset, maxChars)` | 그 창(D-005 경계 보정) | 실제 `offset`·`returnedChars`·`nextOffset` |
| 마지막 창 | 끝까지 | `nextOffset:null` |
| `offset ≥ totalChars` | 빈 창 | `text:''`·`nextOffset:null` (오류 아님) |
| 본문 없는 메일(`bodySource:'none'`) | — | `text:''`·`totalChars:0`·`nextOffset:null`·첨부 manifest |
| 없는/형식이 틀린 `mailId` | — | `error:'mail_not_found'`·`isError` |
| 동기화 전·stale 캐시에서 `mail_get` | 로컬만 읽음, 서버 접속 없음 | 캐시에 있으면 정상 응답 |
| `mail_sync()` 5분 이내 재호출 | 현행 | `fresh:true` (서버 접속 없음) |
| `mail_sync(mode:'full')` 5분 이내 | 서버 접속, 전부 다시 받음 | `synced:true, mode:'full'` |
| full 중 서버에 없는 캐시 메일 | 지우지 않음 | 계속 검색·조회됨 |
| full 중 대량 소실 의심 | 현행 보호 — RETR 0 | `error:'bulk_loss_suspected'` |
| 증분 진행 중 full 요청 | 증분이 끝난 뒤 full 실행 | 각 호출자가 자기 `mode` 결과 |
| full 진행 중 증분·full 요청 | 합류 | `mode:'full'` 결과 공유 |
| full 뒤 같은 메일의 `mailId` | upsert라 유지 | 이전 검색의 `mailId`로 계속 `mail_get` 가능 |

### 파생 UX / 엣지케이스

- full은 첨부를 다시 저장하므로 그 메일의 `attachmentId`가 바뀐다 — full 이전 검색에서 받은 `attachmentId`는 `attachment_not_found`가 된다(§10 선언 경계). `mailId`는 유지된다.
- 대기 중(증분 종료를 기다리는) full 요청을 취소하면, 진행 중 증분이 끝나는 시점에 `cancelled`가 된다 — 현재의 "취소된 flight 뒤 재시도" 경로(`tools.ts:47-48`)와 같은 지연이다(§10 선언 경계).
- `mail_get`은 retention 정리 뒤 사라진 메일에 `mail_not_found`를 준다.

## 6. 범위 / 비범위

- **범위**: §11 파일 표 + `closed-network-extensions.md` mail 절.
- **비범위**: `mail_search` 변경(D-001) · 라인 단위 조회 · 일치 위치 발췌 · 본문 내 검색 · 캐시 삭제/초기화 도구 · 특정 메일·기간만 재수집 · `partial`·재개 커서(0237 D-063 OPEN) · renderer UI.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| offset·maxChars 단위(D-003) | **예 — 도구 공개 계약** | 지금 고정(문자). 사용자 거부권 명시 |
| 결과 필드 이름 `mode`·`updatedMails`·`totalChars`·`nextOffset` | **예 — 도구 공개 계약** | 지금 고정 |
| 도구 이름 `mail_get` | **예** | 지금 고정(사용자 "Get 추가") |
| 파라미터 이름(D-015) | **예 — 도구 공개 계약** | 지금 고정: `offset`·`maxChars` / `returnedChars`·`totalChars`·`nextOffset` |
| 길이 상수 값(D-004) | 아니오 — 상수 한 곳 | 사용자 지시로 조정 |

## 7. Requirements / Acceptance — `R ↔ AT`

검증 수단의 `통합`은 `app/src/main/app/deployment/mail.integration.test.ts`의 배포 조립 경로(`f.server.implementations[i].handler`)다. `mail_get`은 `implementations[3]`.

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 기본 길이보다 긴 본문을 `mail_get(mailId)`로 부르면 `text`가 본문 앞 8,000자, `totalChars`가 본문 길이, `offset:0`, `returnedChars:8000`, `nextOffset:8000`이고 `date`·`from`·`to`·`cc`·`subject`·`bodySource`가 그 메일의 값이다 | 통합: 서로 다른 from·to·cc·subject를 가진 20,000자 평문 메일 동기화 → 검색으로 얻은 `mailId`로 호출 → 각 필드 단언 | `mail_get` handler → `manager.getMail` → `store.getMail` → `sliceBody` |
| R-01 | AT-01 / AC2 | `nextOffset`을 따라 `null`까지 부르면 `text`를 이은 것이 저장 본문 전체와 같다 | 통합: 위 메일을 기본 길이로 3회(8,000·8,000·4,000) → 이어 붙인 문자열 = 원문 본문 · 마지막 `nextOffset:null` | 같은 경로 |
| R-01 | AT-01 / AC3 | `offset`·`maxChars`를 주면 `text`가 본문의 그 구간이다 | `body-window.test.ts`: `sliceBody(text, 37, 113)` = `text.slice(37, 150)` 등 3구간 · 통합 1구간 | `sliceBody` |
| R-01 | AT-01 / AC4 | `maxChars` 생략 = 8,000 · `maxChars`가 16,000을 넘으면 스키마가 거부하고 handler 직접 호출은 16,000으로 자른다 · `offset ≥ totalChars`는 `text:''`·`returnedChars:0`·`nextOffset:null` · 상수 값이 8,000/16,000이다 | `body-window.test.ts` 경계 케이스 · `tools.test.ts`: `z.object(inputSchema).safeParse({ mailId:'1', maxChars:16001 })` 실패, `offset:-1`·`returnedChars:0`·소수 실패 | `mail_get` inputSchema → `sliceBody` |
| R-01 | AT-01 / AC5 | 창 경계가 surrogate pair를 가르지 않는다: 끝이 pair 중간이면 그 앞에서 끊고 `nextOffset`이 pair 시작을 가리킨다 · 시작이 pair 중간이면 pair 시작부터 준다 · 길이 1 요청이 pair에 걸리면 pair 전체(길이 2)를 준다 | `body-window.test.ts`: `'ab😀cd'`류 입력 3케이스 — `text`에 lone surrogate 없음(`isWellFormed()`), `offset`·`maxChars`·`nextOffset` 값 단언 | `sliceBody` |
| R-01 | AT-01 / AC6 | 없는 메일과 `'abc'`·`'1e2'`·`'0'`·`'-1'`·`'1.5'`·`' 1'`은 `error:'mail_not_found'`·`isError:true`이고 응답에 userData 경로가 없다 | 통합: id 100번 메일이 존재하는 상태에서 `'1e2'`가 그 메일을 돌려주지 않음을 포함해 각 입력 단언 | handler → `manager.getMail` |
| R-01 | AT-01 / AC7 | `bodySource:'none'` 메일은 `text:''`·`totalChars:0`·`nextOffset:null`, `'attachment'` 메일은 첨부 유래 본문과 manifest 1건을 준다 | 통합: 0302의 `mailRaw.none`·`mailRaw.attachment` 재사용 | 같은 경로 |
| R-01 | AT-01 / AC8 | 첨부 12건 메일의 `mail_get`은 `attachmentCount:12`·`attachments` 10건·`attachmentsTruncated:true`, 3건 메일은 3건·플래그 없음 | `store/index.test.ts` 신규 | `store.getMail` |
| R-01 | AT-01 / AC9 | `mail_get`은 서버에 접속하지 않고, 한 번도 동기화하지 않은 계정에서도 캐시에 있는 메일을 돌려준다 | 통합: `store.saveMessage`로 직접 넣은 뒤 handler 호출 → `f.sockets` 길이 불변 | handler → `withManager` |
| R-02 | AT-02 / AC10 | `mode` 생략과 `'incremental'`은 같은 동작이다: 새 UIDL만 RETR, 5분 안 재호출은 `fresh:true`, 성공 결과에 `mode:'incremental'`·`updatedMails:0` | 통합: 2통 동기화 → 301초 뒤 1통 추가 → RETR이 새 1통뿐 · 결과 필드 단언 · 299초 재호출 `fresh:true` | `mail_sync` handler → flight → `manager.sync` |
| R-02 | AT-02 / AC11 | `mode:'full'`은 5분 안이어도 서버에 접속해 14일 안의 서버 메일 전부를 RETR하고 `mode:'full'`·`newMails`(ledger에 없던 수)·`updatedMails`(있던 수)를 준다 | 통합: 3통 증분 직후 1통 추가하고 full → RETR 4건(번호 목록) · `newMails:1`·`updatedMails:3` · `lastSyncAt` 갱신 | 같은 경로 |
| R-02 | AT-02 / AC12 | full은 기존 캐시를 고친다: 빈 본문으로 저장돼 있던 UIDL의 서버 원문이 HTML이면 full 뒤 검색 `bodySource:'html'`, `mail_get`이 본문을 주고, 그 메일의 `mailId`는 full 전과 같다 | 통합: `store.saveMessage`로 `bodySource:'none'` 행을 만든 뒤 같은 UIDL에 `mailRaw.html` → full → 단언 | 같은 경로 → `store.saveMessage` upsert |
| R-02 | AT-02 / AC13 | full도 경계를 지킨다: TOP 날짜가 14일 밖이면 RETR하지 않고, 대량 소실 의심이면 RETR 0·`error:'bulk_loss_suspected'`, 파싱 실패는 그 메일만 건너뛴다(`skippedMails`) | 통합 3케이스 — `f.dates`·기존 보호 fixture·`mailRaw.broken` 재사용 | 같은 경로 |
| R-02 | AT-02 / AC14 | full은 지우지 않는다: 서버에서 사라진 캐시 메일이 full 뒤에도 검색되고 `mail_get`으로 읽힌다 | 통합: 3통 동기화 → 서버 목록에서 1통 제거(보호 임계 미만 표본) → full → 3통 모두 조회 | 같은 경로 |
| R-02 | AT-02 / AC15 | 동시 호출: 증분 진행 중 full 요청 → 동기화 2회(증분 → full 순서), 각 호출자가 자기 `mode` 결과 · full 진행 중 증분 요청 → 동기화 1회, 둘 다 `mode:'full'` · 같은 모드 동시 3회 → 1회(현행) | `tools-lifecycle.test.ts`(manager mock): `manager.sync` 호출 인자의 mode 순서와 횟수, 각 handler 결과의 `mode` 단언 | `tools.ts` flight 판정 |
| R-03 | AT-03 / AC16 | `mail_search`는 그대로다: 입력 스키마 키가 `query`·`limit`뿐이고, hit의 키 집합이 0302 시점과 같으며 snippet이 300자다 | `tools.test.ts`: 스키마 키 · 통합: 20,000자 메일 hit의 `Object.keys` = 고정 목록, `snippet.length === 300` · 기존 검색 테스트 green | `mail_search` handler |
| R-02 | AT-02 / AC17 | `mode`에 다른 값(`'all'`·`''`·`1`)은 스키마가 거부하고, handler 직접 호출은 증분으로 처리한다 | `tools.test.ts` safeParse · `tools-lifecycle.test.ts`: `handler({ mode:'all' })` → `manager.sync`가 `'incremental'`로 호출됨 | `mail_sync` inputSchema·handler |
| R-03 | AT-03 / AC18 | 도구 목록이 `[mail_sync, mail_search, mail_getAttachment, mail_get]` 순서이고 `readOnlyHint`가 `[false, true, false, true]`, `mail_get`은 `idempotentHint:true`·`openWorldHint:false`다. `instructions`가 `mail_get`·`nextOffset`·`full`을 언급한다. 인증 만료 시 네 도구가 함께 회수되고 재로그인 시 복원된다 | `tools.test.ts` 갱신 · 통합 기존 케이스의 `toHaveLength(3)` 2곳 → 4 | descriptor → registry binding |
| R-03 | AT-03 / AC19 | `closed-network-extensions.md` mail 절이 `mail_get`(문자 단위 창·`nextOffset`·승인 없음)과 `mail_sync` 두 모드(full의 범위·비삭제·`attachmentId` 변경)를 서술하고 "세 도구"를 "네 도구"로 고친다 | 문서 diff + `node scripts/check-doc-inventory.mjs --check` | 운영자 문서 |
| R-03 | AT-03 / AC20 | 새 의존성 0 · 마이그레이션 파일 2개 그대로 | `git diff e7991dd -- app/package.json app/package-lock.json` 0줄 · `ls …/mail/migrations` 2개 | — |

### AC 검증 주의사항

- AC1의 from·to·cc·subject·date는 서로 다른 값이어야 한다 — 같으면 매핑을 맞바꿔도 관측이 같다.
- AC2의 본문은 위치마다 내용이 달라야 한다(예: 줄마다 일련번호) — 같은 문자 반복이면 창이 어긋나도 이어 붙인 결과가 같다.
- AC11의 `newMails`·`updatedMails`는 서로 다른 값(1·3)이다.
- AC15는 mock manager의 `sync`가 받은 mode 인자를 기록한다 — 실제 manager가 그 mode로 동작하는지는 AC11이 본다.

## 7-A. V / Trace Matrix

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | 본문 전체를 나눠 읽는다 (§1·§5) | NEW | — |
| AT-01 | AT | AC1~AC9 | NEW | — |
| R-02 | R | 증분/전체 동기화를 고른다 (§1·§5) | NEW | — |
| AT-02 | AT | AC10~AC15·AC17 | NEW | — |
| R-03 | R | 검색 불변·도구 표면·문서·의존성 (§6) | NEW | — |
| AT-03 | AT | AC16·AC18~AC20 | NEW | — |
| SD-01 | SD | 동기화 모드 수명주기: freshness 생략·대상 선택·비삭제·동시 호출 (§5 상태표·§13) | NEW | — |
| AR-01 | AR | `mail_get` 운반: handler → manager → store → 창 → DTO (§9·§10) | NEW | — |
| AR-02 | AR | `mode` 운반: 입력 → flight → manager → 루프 → 결과 (§9·§10) | NEW | — |
| MD-01 | MD | 창 계산 D-003~D-005·D-007 (`body-window.ts`) | NEW | — |
| MD-02 | MD | 모드 판정 D-009·D-011 (`sync-mode.ts`) | NEW | — |
| INH-MAIL | SD | 0237·0302 동기화·검색·첨부 동작 | INHERITED | 기존 테스트 — mail 14파일 189케이스(`e7991dd`에서 green) |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `mail_get handler(입력 정규화) → withManager → manager.getMail → store.getMail(SQL·manifest) → sliceBody → DTO → handler JSON` | 신규 통합 AC1·AC2·AC6·AC7·AC9 | not selected — 직접 행동 oracle | EP-01·EP-02 (자리 14) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `mail_sync handler(mode 정규화) → flight 판정 → manager.sync(mode) → freshness 분기 → 루프 대상 선택 → 저장 → 결과` | 신규 통합 AC10~AC14 · `tools-lifecycle.test.ts` AC15·AC17 | required — freshness 생략 조건과 대상 선택 조건을 각각 증분 동작으로 되돌리는 변이를 EP-03 ⑤⑥에 심는다(둘 중 하나만 되돌려도 full이 조용히 증분이 됨) | EP-03·EP-04 (자리 11) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | descriptor·검색 handler·문서 | `tools.test.ts` AC16·AC18 · 통합 AC16 · gate | not selected | EP-05 (자리 4) |
| VP-04 | SD-01 ↔ ST-01 | REQUIRED | `증분 완료 → (5분 안) full → UIDL → 보호 → 전 UIDL TOP → 경계 → RETR → upsert → lastSyncAt` · `서버 소실 → full → 캐시 유지` | 통합 AC11·AC12·AC13·AC14 | not selected | EP-03 (자리 7) |
| VP-05 | AR-01 ↔ IT-01 | REQUIRED | `store.getMail(mailId) → row(account 한정) → 필드 매핑 → manifest(10 상한)` | `store/index.test.ts` AC8 + 필드 매핑 케이스 | not selected — 필드 값이 서로 달라 맞바꿈이 보인다 | EP-02 (자리 8) |
| VP-06 | AR-02 ↔ IT-02 | REQUIRED | `handler mode → flight.mode → manager.sync 인자 → 결과.mode` | `tools-lifecycle.test.ts` AC15·AC17 · 통합 AC10·AC11 | required — flight 합류 판정을 "항상 합류"(현행)로 되돌리는 변이를 EP-04 두 자리에 각각(AC15 red 기대) | EP-04 (자리 2) |
| VP-07 | MD-01 ↔ UT-01 | REQUIRED | `sliceBody(text, offset?, maxChars?)` | `body-window.test.ts` AC3·AC4·AC5 | not selected | EP-01 (자리 6) |
| VP-08 | MD-02 ↔ UT-02 | REQUIRED | `syncPlan(mode)` · `joinsRunningSync(running, requested)` · `normalizeSyncMode(input)` | `sync-mode.test.ts` 전 조합 | not selected | EP-04 판정표 |
| VP-09 | INH-MAIL ↔ 기존 ST | REGRESSION | 동기화 루프·tools flight·store를 고친다 | 기존 mail 14파일(갱신한 단언 3곳 포함) green | not selected | — |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 (`app/`에서) | 실패 범위 |
|---|---|---|---|
| 마이그레이션 append-only | 변경 없음을 확인 | `node scripts/check-migrations-appendonly.mjs` | 현재 변경이 유발한 실패만 blocking |
| 문서 인벤토리 | 문서 수정 | `node scripts/check-doc-inventory.mjs --check` | 〃 |
| 테스트 예산 · 풀 | 테스트 추가·수정. 통합 테스트의 주입 시계 값은 `SEMANTIC_DELAYS` count 갱신 필요(0302 선례: `301_000`) | `node scripts/check-test-budgets.mjs` · `node --test scripts/*.test.mjs` | 수정·추가 파일의 위반은 blocking |
| lint · typecheck | 타입·시그니처 변경 | `npm run lint` · `npm run typecheck` | 〃 |
| vitest 전체 | 회귀 | 파일 필터 없는 `./node_modules/.bin/vitest run` | 환경 서명 실패는 변경 전 집합과 차집합으로 분리(0302 r1: 29파일, Electron 미설치) |
| message bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 도구 3개, 승인은 `readOnlyHint !== true`일 때만 | `mail/tools.ts:94-112` · `adapters/common/runtime-tool-policy.ts:25` |
| snippet = 본문 앞 300자, 본문 전체는 `mail.body_text`에 저장 | `store/index.ts:346` · `migrations/0001_mail.sql` |
| 검색 manifest: 메일당 10건·응답 전체 50건, 초과 `attachmentsTruncated` | `store/index.ts:314-352` |
| 동기화 대상 선택: `reconciled.fresh`에 없으면 TOP 전에 건너뜀 | `sync-manager.ts:143` |
| freshness 판정은 연결 전 한 곳 | `sync-manager.ts:86-94` |
| `reconcileUidls`의 `fresh` = 로컬 **active** ledger에 없는 서버 UIDL (`missing` 상태였던 것 포함) | `reconcile.ts:17-24` |
| `saveMessage`는 upsert — `mail.id` 유지, 첨부 행은 지우고 다시 넣음(id 변경), 이전 첨부 파일 unlink | `store/index.ts:206-259` |
| tools 층 single-flight: 진행 중이면 무조건 합류, 소유자 0이면 abort, 취소된 flight 뒤에는 끝난 뒤 재시도 | `tools.ts:45-85` |
| manager 층 single-flight: `if (inFlight) return inFlight` | `sync-manager.ts:76` |
| tools는 flight마다 manager를 새로 만든다 — 한 manager에 동시 sync가 오는 production 경로 없음 | `tools.ts:29-44,56` |
| handler는 zod를 거치지 않고도 불린다(테스트가 직접 호출) — 기존 handler들이 입력을 방어적으로 재확인 | `tools.ts:135-136,152-158` |
| 0237: freshness 5분(D-008)·TOP 선행(D-007)·역순+유예(D-026)·보호(D-047)·연속 카운트(D-062) | `0237 plan.md:61,62,80,101,1694` |
| 0302: 파싱 격리·집계·RETR 원문 fixture hook `bodies` | `sync-manager.ts:156-180` · `mail.integration.test.ts` `mailRaw` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 도구 이름을 참조하는 production·문서(handoff 제외) | `rg -n "mail_sync\|mail_search\|mail_getAttachment" app/src docs -g '!**/handoff/**' -g '!*.test.ts'` | 11 | `tools.ts` 7 · `closed-network-extensions.md` 4 — 이름 기반 정책 목록 없음(승인은 annotation) |
| 테스트의 위치 기반 도구 호출 | `rg -n "implementations\[[0-2]\]" app/src/main/app/deployment/mail.integration.test.ts app/src/main/features/plugins/mail` | 14 | `[0]`=sync·`[1]`=search·`[2]`=getAttachment — D-012 근거 |
| "도구 3개" 단언 | `rg -n "toHaveLength\(3\)\|three tools\|세 도구" …(mail 테스트·문서)` | 4 | `tools.test.ts:16` · `mail.integration.test.ts:477,547`(toolNames) · 문서 `:1093` — 갱신 대상. `:439`는 첨부 3건(무관) |
| `manager.sync(` production 호출부 | `rg -n "\.sync\(" app/src/main/features/plugins/mail -g '!*.test.ts'` | 1 | `tools.ts:56` |
| `reconciled.fresh` 사용 | `rg -n "reconciled\.fresh" app/src/main` | 1 | `sync-manager.ts:143` — 대상 선택 유일 자리 |
| `isFresh(` production 호출 | `rg -n "isFresh\(" app/src/main/features/plugins/mail -g '!*.test.ts'` | 2 | `sync-manager.ts:87`(동기화 진입 — 변경) · `:232`(search의 `stale` — 불변). 정의 `freshness.ts:7`은 제외 |

### 수치 / 전칭 표현 검산

- 위 N은 이번 세션 `e7991dd`에서 센 값이다. 구현자는 자리 검색 명령으로 다시 센다.
- "`reconciled.fresh` 유일 자리" — 검색 1건.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
tools.sync(signal) → inFlight 있으면 합류 → manager.sync(signal)
   manager.sync: cleanup → isFresh? → fresh 반환 : 연결 → UIDL → 보호 → fresh UIDL만 TOP/RETR/저장
본문 조회 표면 없음 — search snippet 300자뿐
```

### TO-BE

```text
mail_sync({mode?}) → normalizeSyncMode → tools.sync(mode, signal)
   flight 있음: joinsRunningSync(flight.mode, mode) ? 합류 : flight 종료 대기 → 재판정
   flight 없음: withManager(m => m.sync(signal, undefined, mode))
   manager.sync: cleanup → (syncPlan(mode).bypassFreshness 아니고 isFresh) ? fresh 반환
                 : 연결 → UIDL → 보호 → 대상 = syncPlan(mode).refetchKnown ? 서버 UIDL 전부 : fresh만
                 → TOP → decideIngest → RETR → parse(격리) → saveMessage(upsert)
                 → { synced, mode, newMails, updatedMails, noBodyMails, skippedMails, … }

mail_get({mailId, offset?, maxChars?}) → withManager(m => m.getMail(mailId, offset, maxChars))
   manager.getMail: store.getMail(mailId) → null ? null : { …meta, ...sliceBody(bodyText, offset, maxChars), manifest }
   handler: null → mail_not_found
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 도구 표면 | 3개 | 4개(`mail_get` 맨 뒤) | D-002·D-012 | AR-01 / VP-01·03 |
| 본문 조회 | snippet만 | 문자 창 + `nextOffset` | D-003~D-007 | MD-01 / VP-07 |
| 동기화 대상 | fresh만 | mode에 따라 fresh 또는 전부 | D-008·D-009 | SD-01 / VP-04 |
| freshness | 항상 | 증분만 | D-009 | SD-01 / VP-02 |
| flight | 무조건 합류 | mode 판정 | D-011 | MD-02 / VP-06 |
| 결과 | mode 없음 | `mode`·`updatedMails` | D-010 | AR-02 / VP-02 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `mail/body-window.ts` (신규, 순수) | 길이 상수 · `sliceBody` | `(text, offset?, maxChars?) → { offset, returnedChars, text, totalChars, nextOffset }` | `sync-manager.ts`·`tools.ts`(상수) |
| `mail/sync-mode.ts` (신규, 순수) | `MailSyncMode` 값·`normalizeSyncMode`·`syncPlan`·`joinsRunningSync` | — | `tools.ts`·`sync-manager.ts`·`types.ts`(타입) |
| `mail/store/index.ts` | `getMail(mailId)` · manifest 공용 헬퍼 | `string → StoredMail \| null` | `sync-manager.ts` |
| `mail/sync-manager.ts` | `sync(signal?, onStage?, mode?)` · `getMail(mailId, offset?, maxChars?)` | — | `tools.ts` |
| `mail/tools.ts` | 도구 4개 · 입력 정규화 · mode별 flight | — | 배포 조립 |

전부 `features/plugins` 슬라이스 내부. `sync-mode.ts`·`body-window.ts`는 런타임 의존 0이라 unit 풀이다(0237 ΔV4의 `retention-window.ts`와 같은 seam 패턴).

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-07 | **EP-01** 창 계산 | `body-window.ts` `sliceBody` | 구현자 | 자리 6: ① offset 기본 0·음수/비정수 → 0 ② maxChars 기본값 ③ maxChars 상한 clamp·하한 1 ④ 시작 code point 보정 ⑤ 끝 code point 보정(+빈 창이면 pair 확장) ⑥ `nextOffset` = 끝 < total ? 끝 : null. **규칙 칸 분기 9**: (a) 생략 → `[0, 8000)` (b) 지정 구간 (c) maxChars > 16,000 → 16,000 (d) maxChars < 1·비정수 → 기본값 (e) offset ≥ total → `text:''`·`returnedChars:0`·`nextOffset:null` (f) 끝이 total에 닿음 → `nextOffset:null` (g) 끝이 pair 중간 → 한 칸 앞 (h) 시작이 low surrogate → 한 칸 앞 (i) 길이 1이 pair에 걸림 → 길이 2 | `rg -n "MAIL_GET_\|charCodeAt\|nextOffset\|Math\.(min\|max)" app/src/main/features/plugins/mail/body-window.ts` | 창이 어긋나면 이어 읽은 본문에 누락·중복. 상한이 빠지면 한 응답이 본문 전체 |
| MD-01 / VP-07 UT 입력 칸 | — | — | — | 본문 `T` = 위치마다 다른 20,000자. (a) `sliceBody(T)` (b) `(T,37,113)`·`(T,8000,8000)`·`(T,19990,5)` (c) `(T,0,99999)` → returnedChars 16,000 (d) `(T,0,0)`·`(T,0,2.5)`·`(T,0,-3)` → 8,000 (e) `(T,20000)`·`(T,99999)` (f) `(T,16000)` → returnedChars 4,000·null (g) `'ab😀cd'`,`(0,3)` → `'ab'`·next 2 (h) `(3,2)` → offset 2·`'😀'` (i) `(2,1)` → `'😀'`·returnedChars 2·next 4. 추가: offset `-5`·`1.7` → 0 | — | — |
| AR-01 / VP-01·VP-05 | **EP-02** `mail_get` 운반 | `types.ts` `MailBodyPage` | 구현자 | 자리 8: ① `store.getMail` SQL(`WHERE m.id=? AND m.account_id=?`) ② mailId 형식 검사 `^[1-9][0-9]*$` ③ row → 메타 매핑(date·from·to·cc·subject·bodySource 6필드) ④ manifest 헬퍼(10 상한·truncated) ⑤ `manager.getMail`의 `sliceBody` 호출과 DTO 조립 ⑥ handler 입력 정규화(offset·maxChars가 number일 때만 전달) ⑦ handler null → `mail_not_found` ⑧ descriptor·implementation 항목(스키마: `mailId` min 1 · `offset` int ≥0 · `maxChars` int 1..16,000) | `rg -n "getMail\|mail_get\|mail_not_found\|MailBodyPage" app/src/main/features/plugins/mail -g '!*.test.ts'` | 계정 한정이 빠지면 다른 계정 메일 노출(현재 DB는 계정별이라 잠재). 형식 검사가 빠지면 `'1e2'`가 100번 메일을 연다 |
| AR-01 UT 입력 칸 | — | — | — | ③ from·to·cc·subject·date·bodySource가 서로 다른 메일 ④ 첨부 12건·3건·0건 ② AC6 입력 6종 + id 100 메일 존재 ⑥ `handler({mailId, offset:'5'})` → offset 무시(0) | — | — |
| AR-02·SD-01 / VP-02·VP-04 | **EP-03** `mode` 운반과 full 의미 | `sync-mode.ts` | 구현자 | 자리 7: ① `mail_sync` inputSchema `mode: z.enum(['incremental','full']).optional()` ② handler `normalizeSyncMode(input.mode)` ③ `withManager` 안 `manager.sync(signal, undefined, mode)` ④ `manager.sync` 시그니처 기본값 `'incremental'` ⑤ freshness 분기: `!plan.bypassFreshness && isFresh(…)` ⑥ 루프 대상 선택: `plan.refetchKnown \|\| fresh.includes(uidl)` ⑦ 결과 `mode`·`newMails`/`updatedMails` 분리 집계(active ledger 여부) | `rg -n "mode\|syncPlan\|bypassFreshness\|refetchKnown\|updatedMails\|reconciled\.fresh" app/src/main/features/plugins/mail/sync-manager.ts app/src/main/features/plugins/mail/tools.ts` | ⑤만 되면 full이 접속은 하되 새 메일만 받고, ⑥만 되면 5분 안 full이 `fresh`로 끝난다 — 둘 다 "full이 조용히 증분" |
| MD-02 / VP-06·VP-08 | **EP-04** 동시 호출 판정 | `sync-mode.ts` `joinsRunningSync` | 구현자 | 자리 2: ① `tools.ts` flight 판정(합류 / 종료 대기 후 재판정) ② `sync-manager.ts` `inFlight` 판정(같은 함수 사용). **판정표 4칸**: (incremental, incremental) → 합류 · (full, incremental) → 합류 · (full, full) → 합류 · (incremental, full) → 대기 후 실행 | `rg -n "joinsRunningSync\|inFlight" app/src/main/features/plugins/mail -g '!*.test.ts'` | ①이 무조건 합류면 full 요청이 증분 결과를 받는다(재갱신 무음 실패) |
| MD-02 UT 입력 칸 | — | — | — | `joinsRunningSync` 4조합 전부 · `syncPlan('incremental')` = `{bypassFreshness:false, refetchKnown:false}` · `syncPlan('full')` = 둘 다 true · `normalizeSyncMode`: `'full'`→full, `'incremental'`·`undefined`·`'all'`·`''`·`1`·`null`→incremental | — | — |
| R-03 / VP-03 | **EP-05** 도구 표면·검색 불변 | `tools.ts` descriptor | 구현자 | 자리 4: ① descriptor `tools` 배열 순서 ② `implementations` 배열 순서(같은 순서) ③ `instructions` 문자열 ④ `mail_search` 항목·`store.search` 무변경 | `rg -n "name: 'mail_" app/src/main/features/plugins/mail/tools.ts` → 8줄(4×2) | 순서가 바뀌면 위치 기반 호출 14곳이 다른 도구를 부른다 |

**선언 경계** (판정에 쓰지 않음):

- 단위는 문자다(D-003). 라인 번호 조회·일치 위치 발췌는 없다.
- `totalChars`·`offset`은 UTF-16 code unit이다. 결합 문자(자모 조합·ZWJ 이모지 시퀀스)는 창 경계에서 갈릴 수 있다 — D-005는 surrogate pair만 지킨다.
- full 뒤 그 메일의 `attachmentId`가 바뀐다. `mailId`는 유지된다.
- full은 14일 경계 안의 메일만 다시 받는다. 경계 밖 캐시 행은 `cleanupExpired`가 먼저 지운다.
- full은 서버에서 사라진 메일의 캐시를 고치지 못한다(원문이 없다).
- 증분 종료를 기다리는 full 요청의 취소는 그 증분이 끝날 때 반영된다.
- manager 층 `inFlight` 판정(EP-04 ②)은 production에서 도달하지 않는다(tools가 flight마다 manager를 새로 만든다) — 직접 호출하는 통합 테스트용 일관성이며 `sync-mode.test.ts`가 판정 함수를, `tools-lifecycle.test.ts`가 ①을 잠근다.
- full 남용 방지는 설명 문구뿐이다(D-014). 호출 빈도 제한은 없다.
- 본문은 외부에서 온 신뢰할 수 없는 텍스트다. `mail_get`은 그 노출량을 늘린다 — 새로운 종류의 표면은 아니다(snippet·첨부가 이미 같다).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/features/plugins/mail/body-window.ts` (신규) | 창 계산 | `MAIL_GET_DEFAULT_CHARS = 8_000` · `MAIL_GET_MAX_CHARS = 16_000` · `sliceBody` — EP-01 | 순수 단위 |
| `…/mail/body-window.test.ts` (신규) | — | AC3·AC4·AC5 + EP-01 입력 칸 · 상수 값 단언 | unit |
| `…/mail/sync-mode.ts` (신규) | 모드 판정 | `export type MailSyncMode = 'incremental' \| 'full'` · `normalizeSyncMode(value: unknown)` · `syncPlan(mode)` · `joinsRunningSync(running, requested)` | 순수 단위 |
| `…/mail/sync-mode.test.ts` (신규) | — | EP-04 판정표 + MD-02 입력 칸 | unit |
| `…/mail/types.ts` | 타입 | `MailBodyPage`(D-006 필드) · `synced:true` 분기에 `readonly mode: MailSyncMode; readonly updatedMails: number` | typecheck |
| `…/mail/store/index.ts` | 조회 | `getMail(mailId: string): StoredMail \| null`(메타 + `bodyText` 전체 + manifest) · search의 manifest 매핑을 헬퍼로 추출해 공유(검색의 전체 50 상한 로직은 search에 남긴다) — EP-02 ①~④ | io |
| `…/mail/store/index.test.ts` | — | AC8 · 필드 매핑 · 형식 검사 · 기존 search 테스트 무변경 | io |
| `…/mail/sync-manager.ts` | 동기화·조회 | `sync(signal?, onStage?, mode = 'incremental')` — EP-03 ④~⑦·EP-04 ② · `getMail(mailId, offset?, maxChars?)` — EP-02 ⑤ | 통합 |
| `…/mail/tools.ts` | 도구 | `mail_sync` 스키마·handler·mode별 flight(EP-03 ①~③·EP-04 ①) · `mail_get` 항목(EP-02 ⑥~⑧·EP-05) · `instructions`·설명 문구(D-014) | mock manager |
| `…/mail/tools.test.ts` | — | AC4·AC16·AC17·AC18(기존 "exactly three" 케이스를 넷으로 갱신) | unit |
| `…/mail/tools-lifecycle.test.ts` | — | AC15·AC17 | unit |
| `app/src/main/app/deployment/mail.integration.test.ts` | — | AC1·AC2·AC6·AC7·AC9~AC14·AC16 · `toHaveLength(3)` 2곳 → 4 | io |
| `app/scripts/check-test-budgets.mjs` | 가드 등록 | 통합 테스트에 주입 시계 자리가 늘면 `SEMANTIC_DELAYS` count 갱신 | gate |
| `docs/guides/closed-network-extensions.md` | 문서 | AC19 | — |

flight 구현 지침(`tools.ts`): flight 레코드에 `mode`를 둔다. `sync(mode, signal)` 진입에서 진행 중 flight가 있고 `joinsRunningSync(flight.mode, mode)`가 false면 `flight.promise.catch(() => undefined).then(() => sync(mode, signal))`로 미룬다 — 기존의 "취소된 flight 뒤 재시도" 줄(`tools.ts:47-48`)과 같은 형태다. 재진입 시 다른 full이 이미 떠 있으면 거기에 합류한다.

`updatedMails` 집계: 루프 진입 전 `const active = new Set(local.filter(e => e.state === 'active').map(e => e.uidl))`. 저장 성공 뒤 `active.has(uidl)`이면 `updatedMails += 1`, 아니면 `processed(newMails) += 1`. 증분은 대상이 fresh뿐이라 `updatedMails`가 0이다.

### 테스트 가능성

- 창 계산·모드 판정은 순수 모듈이라 unit에서 전 분기를 직접 부른다.
- full의 실제 동작(RETR 목록·upsert·비삭제)은 0302가 만든 `bodies`·`dates`·`remote` fixture hook으로 배포 조립 경로에서 관측한다.
- flight 순서는 `tools-lifecycle.test.ts`의 mock manager가 `sync` 인자와 호출 순서를 기록한다.

## 12. End-to-end 영향

### producer → consumer

| producer | 정규화/상태 | consumer |
|---|---|---|
| `mail.body_text`·메타·attachment 행 | `store.getMail` → `sliceBody` | `mail_get` JSON → 모델 |
| 모델의 `mode` 입력 | `normalizeSyncMode` → flight → `syncPlan` | 동기화 루프 · 결과 `mode` |

### 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| registry binding(`createPluginBinding`) — 도구 수 | 3 → 4. 이름 기반 목록 없음(§8) | AC18 |
| 위치 기반 테스트 14곳 | 순서 유지로 영향 없음 | VP-09 |
| `manager.sync()` 직접 호출 테스트(인자 0~1개) | 기본값 `'incremental'`로 무변경 | VP-09 |
| sync 결과 `toMatchObject` 단언 | 필드 추가에 내성 | VP-09 |
| `tools.sync.test.ts`·`tools-lifecycle.test.ts`의 mock manager | `sync` 호출 인자가 `(signal, undefined, mode)`로 늘어남 — 인자 수를 단언하는 곳이 있으면 갱신 | AC15 |

## 13. Lifecycle / 오류 / 정리

- `mail_get`은 `withManager`로 연결을 열고 `finally`에서 닫는다(0237 D-053). 쓰기 없음.
- full 도중 실패(연결·DB·취소)는 증분과 같은 최외곽 처리다. 그때까지 덮어쓴 메일은 남는다(메시지 단위 원자성은 `saveMessage`가 보장).
- full이 덮어쓴 메일의 이전 첨부 파일은 `saveMessage`가 지운다(`store/index.ts:254-258`). 중단되면 다음 `cleanupExpired`의 고아 sweep이 정리한다.
- 대기 중 full: 진행 중 증분이 실패해도 full은 돈다(`catch(() => undefined)`).

## 14. 성능 / 상한 / 최적화

- `mail_get` 1회 응답: 본문 ≤ 16,000자 + 메타 + manifest 10건(≈3.3KB) — UTF-8로 최대 ≈ 51KB(한글 3바이트). 기본 8,000자는 ≈ 27KB로 `mail_search` 상한(≈31KB)과 같은 자릿수.
- 본문 전체 읽기 호출 수: `ceil(totalChars / maxChars)`. HTML 유래 본문은 변환 입력 128Ki자라 출력이 그 이하 → 기본값으로 최대 17회, 최대값으로 9회.
- `store.getMail`은 호출마다 `body_text` 전체를 읽고 JS에서 자른다. 본문 수백 KB × 호출 수 — SQLite 로컬 읽기라 무시 가능. SQL `substr`는 code point 단위라 UTF-16 offset과 어긋나므로 쓰지 않는다.
- full 요청 수: `UIDL 1 + TOP K + RETR K′` (K = 서버 메일 중 연속 old-header 중단 전까지, K′ = 14일 안). 증분 최초 동기화와 같은 규모다(0237 §14).

## 15. 외부 구현 포트 / 문서 계약

배포 recipe(`MailAuthOptions`·`MailPluginOptions`)는 바뀌지 않는다. 도구 출력 계약 변경은 `closed-network-extensions.md`(AC19)에 적는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0237 D-008 freshness 5분 | 0237 plan | D-008·D-009 | 유지(증분) — full만 명시적으로 건너뜀(사용자 요구 1) |
| 0237 D-007·D-026·D-047·D-062 | 0237 plan | D-009 | 유지 — full에도 그대로 |
| 0237 도구 3개 표면 | `tools.test.ts:16` | D-002·D-012 | 변경 — 사용자 요구 3으로 4개 |
| 0237 D-053 도구 작업마다 연결 | 0237 plan | §13 | 유지 |
| 0237 D-063 `partial` OPEN | 0237 plan | §6 | 유지 — 손대지 않음 |
| 0302 D-009 파싱 격리 · D-007 집계 | 0302 plan | D-009 | 유지 — full에도 그대로 |
| 0302 D-011 자동 복구 없음 | 0302 plan | §4 | 유지 — full은 사용자가 명시적으로 부르는 재수집 |
| 의존성·마이그레이션 정책 | `app/AGENTS.md` | D-013 | 유지 — 변경 0 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 사용자가 라인 단위를 기대 | D-003에 거부권 명시, 완료 보고에서 확인 요청 |
| "부분 갱신"이 증분이 아닌 다른 뜻 | D-008에 명시, 완료 보고에서 확인 요청 |
| 모델이 full을 남용 | D-014 설명 문구. 빈도 제한은 비범위 |
| 0302가 verify에서 FAIL | 이 plan의 fixture·필드 전제(`bodySource` 등)가 바뀌면 설계 턴에서 정정 |

## 18. 영향 받는 파일 / 문서

§11 표가 전부다. INDEX 보드 1행.

## 19. 게이트

§7-A "현재 변경의 운영 gate" 표가 정본이다.

## READY self-review

- 결정 보존: 사용자 문장 3개를 §2에 원문 인용, D-001(유지)·D-002~D-007(Get)·D-008~D-011(Sync)에 귀속.
- `ACTIVE 결정 ↔ AC 대조: 충돌 0`(§3 갱신 메모).
- 조건절: "100값을 제안하는 것이 아님" → 값은 D-004가 근거와 함께 정함. "E.g." → 단위는 예시로 읽고 D-003에 거부권.
- 사용자 질의로 남긴 것: D-003 단위 · D-008 "부분"의 뜻 — 둘 다 합리적 기본값으로 진행하고 보고에서 확인을 구한다. 구현 주체(Codex/Claude)도 사용자 결정.
- 실측: §8 전수 조사 6행(이번 세션 `e7991dd`) · 인용 테스트 존재 확인(`tools.test.ts:16`, `mail.integration.test.ts:477,547`, `tools-lifecycle.test.ts` shares concurrent sync 케이스).
- 저장소 규칙: 레이어(슬라이스 내부) · test-pools(순수 2모듈 unit) · 예산 가드 등록 선례 · 후보 표 겹침 0행.
- 규칙 칸 ↔ 입력 칸: EP-01 분기 9 ↔ 입력 9(+2) · EP-04 판정표 4 ↔ 4 · `normalizeSyncMode` 7입력.
- 적대 증거: VP-02(freshness 생략·대상 선택 각각 되돌림) · VP-06(무조건 합류로 되돌림, 두 자리).
- 사람 실기: 없음.

## [구현자 기입] 설계 리뷰

## [구현자 기입] 강제 지점 전수 (§10 대조)

## [구현자 기입] 이번 라운드 수정의 잠금

## [구현자 기입] Product/UX 파생 검토

## [구현자 기입] 놓친 잠재 문제 + 대응

## [구현자 기입] Review Signals

## [검증자 기입] 파생 이슈
