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
| 이번 V revision | `V1 rev.5`(경계 선언, 아래 절) · 이전 `V1 rev.3` — rev.1 `e67b718` · rev.2 `b043ce9`(이름 변경 D-015) · rev.3: 사용자 확인 D-008 + 검색·조회 코드 재사용 D-016(구현 전이라 V1 노드를 직접 갱신, 바뀐 행에 `rev.3` 표시) |
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
| D-001 | `mail_search`의 입력 스키마·결과 필드·snippet 300자·정렬·상한을 바꾸지 않는다 | "Search는 유지" | 사용자 | SUPERSEDED | → D-016 (snippet 산출 방식만. 입력·필드·300자·정렬·상한은 D-016이 그대로 승계) |
| D-002 | 새 도구 `mail_get`: 입력 `{ mailId, offset?, maxChars? }`, 로컬 캐시만 읽는다. `readOnlyHint:true`·`idempotentHint:true`·`openWorldHint:false` — 승인 없이 호출된다 | "Get 추가. 본문 전체 조회 기능 제공". 승인은 `readOnlyHint`가 정한다(`adapters/common/runtime-tool-policy.ts:25`), `mail_search`와 같은 등급 | 사용자 + 조사 | ACTIVE | — |
| D-003 | `offset`·`maxChars`의 단위는 **문자(UTF-16 code unit)**다. `offset`은 0부터, 응답은 `totalChars`와 `nextOffset`(다음 호출의 offset, 끝이면 `null`)을 준다 | 라인 단위는 한 줄이 한 문단인 본문(HTML 변환 결과·줄바꿈 없는 평문)에서 한 번의 응답 크기를 묶지 못하고, 줄 중간에서 이어 읽으려면 결국 문자 offset이 필요하다. 문자 단위는 항상 이어 읽을 수 있다. 모델은 `nextOffset`만 따라가면 된다 | 설계자 판단(요구 3 "offset, length 개념") | ACTIVE — 사용자 확인(rev.2): "Offset, length는 개념적인것" | — |
| D-004 | `maxChars` 기본 **8,000**, 최대 **16,000** 문자. 상수는 `body-window.ts` 한 곳(`MAIL_GET_DEFAULT_CHARS`·`MAIL_GET_MAX_CHARS`) | 사용자: "100값을 제안하는 것이 아님" — 값은 설계자 몫. 기준은 기존 `mail_search` 응답 상한 ≈31KB(0237 §14)와 같은 자릿수. HTML 본문 최대(변환 입력 128Ki자)도 기본값으로 십수 회에 다 읽힌다 | 설계자 판단 | ACTIVE — 값 조정은 사용자 지시로 | — |
| D-005 | 창 경계는 code point를 가르지 않는다. 시작이 low surrogate면 한 칸 앞으로, 끝이 pair를 가르면 한 칸 앞으로 당긴다. 그 결과 빈 창이 되면(요청 길이 1이 pair에 걸림) pair 전체를 준다. 응답 `offset`·`maxChars`는 실제 값이다 | 이모지가 반쪽으로 잘려 깨진 문자가 모델에 가지 않게 한다 | 설계자 판단 | ACTIVE | — |
| D-006 | `mail_get` 응답: `{ mailId, date, from, to, cc, subject, bodySource, totalChars, offset, returnedChars, text, nextOffset, attachmentCount, attachments, attachmentsTruncated? }`. 메타데이터는 매 호출에 싣는다(무상태). 첨부 manifest는 메일당 10건 상한 + `attachmentsTruncated` — `mail_search`와 같은 형상 | 모델이 이전 호출을 기억하지 않아도 되고, 첨부 조회(`mail_getAttachment`)로 바로 이어진다 | 설계자 판단 | ACTIVE | — |
| D-007 | `mailId`가 `^[1-9][0-9]*$`가 아니거나 그 메일이 없으면 `{ error: 'mail_not_found' }` + `isError`. `offset`이 본문 길이 이상이면 오류가 아니라 `text:''`·`nextOffset:null` | `Number('1e2')` 같은 느슨한 변환으로 다른 메일이 조회되지 않게 한다. 끝을 넘긴 offset은 "다 읽었다"는 정상 신호 | 설계자 판단 | ACTIVE | — |
| D-008 | `mail_sync` 입력 `mode?: 'incremental' \| 'full'`, 기본 `incremental`. `incremental`은 현행 동작 그대로(5분 freshness 포함) | "Sync는 부분 갱신, 전체 (재)갱신 할 수 있도록" — 부분 = 증분(§2 추론) | 사용자 + 추론 | ACTIVE — 사용자 확인(rev.3): "증분맞다" | — |
| D-009 | `full`: freshness를 건너뛰고, 서버 UIDL 전부를 대상으로 TOP → 14일 경계 판정 → RETR → 덮어쓰기 저장한다. **지우지 않는다** — 서버에 없는 캐시 메일은 그대로 남고(ledger `missing`), 보호 판정(bulk loss)·연속 old-header 중단·메시지별 파싱 격리는 증분과 같다 | "(재)갱신"은 다시 받기다. 삭제까지 하면 서버 장애 순간의 full이 캐시를 날린다. 0237 D-007·D-026·D-047·D-062와 0302 D-009를 그대로 적용 | 사용자 + 설계자 | ACTIVE | — |
| D-010 | 성공 결과에 `mode`와 `updatedMails`를 싣는다. `newMails` = 저장한 메일 중 ledger에 active로 없던 것, `updatedMails` = active로 있던 것(증분에서는 항상 0) | full에서 "새 메일 N"만 주면 재저장분이 새 메일로 읽힌다 | 설계자 판단 | ACTIVE | — |
| D-011 | 동시 호출 규칙: 진행 중 동기화가 `full`이면 어떤 요청이든 합류한다. 진행 중이 `incremental`이고 요청도 `incremental`이면 합류한다. 진행 중이 `incremental`인데 요청이 `full`이면 **그 동기화가 끝난 뒤 full을 새로 돈다**. 합류한 호출자는 실제 돈 `mode`를 결과에서 본다 | 현재는 모드가 없어 무조건 합류한다(`tools.ts:45-85`). full 요청이 증분 결과를 받으면 재갱신이 조용히 안 된 것이다. full ⊇ incremental | 설계자 판단 | ACTIVE | — |
| D-012 | 새 도구는 도구 목록 **맨 뒤**에 둔다: `[mail_sync, mail_search, mail_getAttachment, mail_get]` | 기존 mail 테스트 14곳이 `implementations[0..2]` 위치로 부른다(§8) — 순서를 바꾸면 무관한 테스트가 깨진다 | 조사 | ACTIVE | — |
| D-013 | 스키마 변경·마이그레이션·새 의존성 없음 | 본문은 이미 `body_text`에 전부 저장돼 있다 | 조사 | ACTIVE | — |
| D-015 | 파라미터 이름: 입력은 `offset`·`maxChars`, 응답은 `offset`·`returnedChars`·`totalChars`·`nextOffset`. rev.1의 입력 `length`·응답 `length`를 대체한다 | 사용자: "Offset, length는 개념적인것. 더 나은 파라미터 이름이 있으면 거기에 맞춰라". `maxChars`는 단위(문자)와 "상한"(경계 보정·본문 끝에서 더 짧게 올 수 있음)을 이름이 말한다. `offset`은 응답의 `nextOffset`과 짝이라 유지. 응답의 길이는 요청값과 헷갈리지 않게 `returnedChars` | 사용자 + 설계자 | ACTIVE | ← rev.1 이름 |
| D-016 | **검색 발췌와 본문 조회는 같은 코드를 쓴다.** ① `mail_search`의 `snippet` = `sliceBody(bodyText, 0, 300).text` — `mail_get(mailId, offset:0, maxChars:300).text`와 항상 같다 ② 메일 행 → 메타(`date`·`from`·`to`·`subject`·`bodySource`) 매핑은 한 함수 `mailMeta(row)`를 검색과 조회가 함께 쓴다(조회는 `cc`를 더한다) ③ 첨부 manifest 매핑은 한 헬퍼를 함께 쓴다(메일당 10건 상한·`attachmentsTruncated`; 검색 응답 전체 50건 상한은 검색에만 남는다). `mail_search`의 입력 스키마·결과 필드·300자·정렬·상한은 그대로다 | 사용자: "Get(0, 300) 호출하면 search 와 같을 것으로 보인다. 내부적으로 코드 재사용이 되어야 할 것으로 보인다". 현재 검색은 `bodyText.slice(0, 300)`(`store/index.ts:346`)이라 300번째 자리에 surrogate pair가 걸리면 lone surrogate를 내고(이번 세션 실측: `'가'×299+'😀'` → 길이 300, `isWellFormed()` false) get(D-005)과 갈린다. 재사용하면 그 경우만 검색 발췌가 299자로 바뀐다 | 사용자 | ACTIVE | ← D-001 |
| D-014 | 서버 descriptor `instructions`와 `mail_sync`·`mail_get` 설명에 사용법을 적는다: 검색 뒤 본문이 더 필요하면 `mail_get`, `nextOffset`으로 이어 읽기, `full`은 사용자가 전체 재갱신을 원하거나 캐시 본문이 비정상일 때만 | full은 보존 기간 전체를 다시 받는다 — 모델이 습관적으로 쓰면 서버 부하(0237 D-008의 취지) | 설계자 판단 | ACTIVE | — |

### 갱신 메모

- rev.3 (2026-11-10): 사용자 "증분맞다" → D-008 확인. 사용자 "Get(0, 300) … search 와 같을 것 … 코드 재사용" → D-016 신설, D-001 SUPERSEDED(산출 방식만). AC16 수정·AC21 신설, MD-03/VP-10 신설, EP-06 신설. `ACTIVE 결정 ↔ AC 대조: 충돌 0` — D-016→AC16·AC21, D-008→AC10·AC17, 나머지 매핑 불변. SUPERSEDED D-001을 근거로 쓰는 AC 0.
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
| R-03 | AT-03 / AC16 | `mail_search`의 표면은 그대로다: 입력 스키마 키가 `query`·`limit`뿐이고, hit의 키 집합이 0302 시점과 같으며, 300자 이상인 본문(surrogate 없음)의 snippet은 본문 앞 300자다 | `tools.test.ts`: 스키마 키 · 통합: 20,000자 메일 hit의 `Object.keys` = 고정 목록, `snippet === body.slice(0, 300)` · 기존 검색 테스트 green | `mail_search` handler → `store.search` |
| R-02 | AT-02 / AC17 | `mode`에 다른 값(`'all'`·`''`·`1`)은 스키마가 거부하고, handler 직접 호출은 증분으로 처리한다 | `tools.test.ts` safeParse · `tools-lifecycle.test.ts`: `handler({ mode:'all' })` → `manager.sync`가 `'incremental'`로 호출됨 | `mail_sync` inputSchema·handler |
| R-03 | AT-03 / AC18 | 도구 목록이 `[mail_sync, mail_search, mail_getAttachment, mail_get]` 순서이고 `readOnlyHint`가 `[false, true, false, true]`, `mail_get`은 `idempotentHint:true`·`openWorldHint:false`다. `instructions`가 `mail_get`·`nextOffset`·`full`을 언급한다. 인증 만료 시 네 도구가 함께 회수되고 재로그인 시 복원된다 | `tools.test.ts` 갱신 · 통합 기존 케이스의 `toHaveLength(3)` 2곳 → 4 | descriptor → registry binding |
| R-03 | AT-03 / AC19 | `closed-network-extensions.md` mail 절이 `mail_get`(문자 단위 창·`nextOffset`·승인 없음)과 `mail_sync` 두 모드(full의 범위·비삭제·`attachmentId` 변경)를 서술하고 "세 도구"를 "네 도구"로 고친다 | 문서 diff + `node scripts/check-doc-inventory.mjs --check` | 운영자 문서 |
| R-03 | AT-03 / AC20 | 새 의존성 0 · 마이그레이션 파일 2개 그대로 | `git diff e7991dd -- app/package.json app/package-lock.json` 0줄 · `ls …/mail/migrations` 2개 | — |
| R-03 | AT-03 / AC21 | 같은 메일에서 `mail_search` hit의 `snippet`은 `mail_get(mailId, offset:0, maxChars:300)`의 `text`와 같고, `date`·`from`·`to`·`subject`·`bodySource`도 같다. 300번째 자리에 surrogate pair가 걸린 본문에서도 같으며 그때 snippet은 299자이고 lone surrogate가 없다. 본문이 300자보다 짧거나 비어도 같다 | 통합: 본문 3종(`'가'×299+'😀'+…` · 짧은 본문 · `bodySource:'none'`)과 서로 다른 메타를 가진 메일을 저장 → 메일마다 search hit와 `mail_get(0, 300)` 대조 · `snippet.isWellFormed()` | `mail_search` → `store.search` → `sliceBody`·`mailMeta` / `mail_get` → `store.getMail` → 같은 함수 |

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
| AT-03 | AT | AC16·AC18~AC21 | NEW (rev.3 AC21) | — |
| SD-01 | SD | 동기화 모드 수명주기: freshness 생략·대상 선택·비삭제·동시 호출 (§5 상태표·§13) | NEW | — |
| AR-01 | AR | `mail_get` 운반: handler → manager → store → 창 → DTO (§9·§10) | NEW | — |
| AR-02 | AR | `mode` 운반: 입력 → flight → manager → 루프 → 결과 (§9·§10) | NEW | — |
| MD-01 | MD | 창 계산 D-003~D-005·D-007 (`body-window.ts`) | NEW | — |
| MD-02 | MD | 모드 판정 D-009·D-011 (`sync-mode.ts`) | NEW | — |
| MD-03 | MD | 검색·조회 공용 투영 D-016 — `sliceBody` 재사용 · `mailMeta` · manifest 헬퍼 (`store/index.ts`) | NEW (rev.3) | — |
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
| VP-10 | MD-03 ↔ IT-03 | REQUIRED | `store.search row → mailMeta → sliceBody(…,0,300) → manifest 헬퍼 → hit` ∥ `store.getMail row → mailMeta → (manager) sliceBody → manifest 헬퍼 → page` | 신규 통합 AC21 · `store/index.test.ts` 대조 케이스 | required — 검색 snippet을 `bodyText.slice(0, 300)`로 되돌리는 변이(AC21 surrogate 본문 red 기대) · 검색이 `mailMeta` 대신 인라인 매핑으로 `from`↔`to`를 맞바꾸는 변이 | EP-06 (자리 6) |

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
| `mail/body-window.ts` (신규, 순수) | 길이 상수(`MAIL_GET_*`·`MAIL_SEARCH_SNIPPET_CHARS`) · `sliceBody` — 검색·조회 공용 | `(text, offset?, maxChars?) → { offset, returnedChars, text, totalChars, nextOffset }` | `sync-manager.ts`·`store/index.ts`·`tools.ts`(상수) |
| `mail/sync-mode.ts` (신규, 순수) | `MailSyncMode` 값·`normalizeSyncMode`·`syncPlan`·`joinsRunningSync` | — | `tools.ts`·`sync-manager.ts`·`types.ts`(타입) |
| `mail/store/index.ts` | `getMail(mailId)` · 검색·조회 공용 `mailMeta`·manifest 헬퍼 · 검색 snippet은 `sliceBody` 사용(D-016) | `string → StoredMail \| null` | `sync-manager.ts` |
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
| MD-03 / VP-10 | **EP-06** 검색·조회 공용 투영 (rev.3) | `body-window.ts` `sliceBody` · `store/index.ts` `mailMeta`·manifest 헬퍼 | 구현자 | 자리 6: ① 검색 snippet = `sliceBody(row.bodyText, 0, 300).text` ② 검색 hit 메타 = `mailMeta(row)` ③ 검색 manifest = 공용 헬퍼(+전체 50 상한은 검색에) ④ `getMail` 메타 = `mailMeta(row)` + `cc` ⑤ `getMail` manifest = 같은 헬퍼 ⑥ 검색 snippet 길이 상수 300을 한 곳(`MAIL_SEARCH_SNIPPET_CHARS`)에 둔다. **규칙 칸 분기 3**: (a) 300자 이상·surrogate 없음 → 앞 300자 (b) 300번째 자리에 pair → 299자 (c) 300자 미만·빈 본문 → 본문 전체 | `rg -n "sliceBody\|mailMeta\|slice\(0, 300\)\|MAIL_SEARCH_SNIPPET_CHARS\|attachmentManifest" app/src/main/features/plugins/mail -g '!*.test.ts'` | 사본이 남으면 검색과 조회가 조용히 갈린다(예: 한쪽만 매핑 필드를 고침) |
| MD-03 / VP-10 UT 입력 칸 | — | — | — | (a) 20,000자 ASCII 본문 (b) `'가'×299 + '😀' + '끝'` (c) `'짧은 본문'`·`''` — 메일마다 from·to·subject·date가 서로 다름 | — | — |

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
| `…/mail/store/index.ts` | 조회·공용 투영 | `getMail(mailId: string): StoredMail \| null`(메타 + `bodyText` 전체 + manifest) — EP-02 ①~④ · `mailMeta(row)`·`attachmentManifest(rows, limit)` 추출 · 검색 snippet을 `sliceBody(row.bodyText, 0, MAIL_SEARCH_SNIPPET_CHARS).text`로 교체 — EP-06 | io |
| `…/mail/store/index.test.ts` | — | AC8 · 필드 매핑 · 형식 검사 · 검색 hit와 `getMail` 메타·발췌 대조(EP-06 입력 3종) · 기존 search 테스트 무변경 | io |
| `…/mail/sync-manager.ts` | 동기화·조회 | `sync(signal?, onStage?, mode = 'incremental')` — EP-03 ④~⑦·EP-04 ② · `getMail(mailId, offset?, maxChars?)` — EP-02 ⑤ | 통합 |
| `…/mail/tools.ts` | 도구 | `mail_sync` 스키마·handler·mode별 flight(EP-03 ①~③·EP-04 ①) · `mail_get` 항목(EP-02 ⑥~⑧·EP-05) · `instructions`·설명 문구(D-014) | mock manager |
| `…/mail/tools.test.ts` | — | AC4·AC16·AC17·AC18(기존 "exactly three" 케이스를 넷으로 갱신) | unit |
| `…/mail/tools-lifecycle.test.ts` | — | AC15·AC17 | unit |
| `app/src/main/app/deployment/mail.integration.test.ts` | — | AC1·AC2·AC6·AC7·AC9~AC14·AC16·AC21 · `toHaveLength(3)` 2곳 → 4 | io |
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
| 0237 검색 snippet 300자(`slice`) | `store/index.ts:346` | D-016 | 변경 — 산출을 `sliceBody`로 공유. 300번째 자리에 surrogate pair가 걸린 경우만 299자 |
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
- 사용자 질의: D-003 단위(rev.2 "개념적인것")·D-008(rev.3 "증분맞다") 모두 확인됨. 남은 것은 구현 주체(Codex/Claude) 하나.
- 실측: §8 전수 조사 6행(이번 세션 `e7991dd`) · 인용 테스트 존재 확인(`tools.test.ts:16`, `mail.integration.test.ts:477,547`, `tools-lifecycle.test.ts` shares concurrent sync 케이스).
- 저장소 규칙: 레이어(슬라이스 내부) · test-pools(순수 2모듈 unit) · 예산 가드 등록 선례 · 후보 표 겹침 0행.
- 규칙 칸 ↔ 입력 칸: EP-01 분기 9 ↔ 입력 9(+2) · EP-04 판정표 4 ↔ 4 · `normalizeSyncMode` 7입력.
- 적대 증거: VP-02(freshness 생략·대상 선택 각각 되돌림) · VP-06(무조건 합류로 되돌림, 두 자리) · VP-10(rev.3 — 검색 snippet을 `slice`로 되돌림 · 검색 메타 인라인 맞바꿈).
- rev.3 재검: EP-06 분기 3 ↔ 입력 3. AC 총 21. D-016이 D-001을 승계해 "Search는 유지"(사용자 요구 2)를 표면 기준으로 지킨다 — 바뀌는 관측은 surrogate 경계 한 경우뿐.
- 사람 실기: 없음.

## 구현 전 규범 정정 — V1 rev.4 (2026-11-10)

READY. 출처는 plan 내부 정합이며 D-002~D-016의 제품 동작은 유지한다. 아래 행은 rev.3의 해당 문구만 대체하며, 원문은 비교를 위해 남긴다.

| 대상 | rev.3 원문 | 유효 기준 / 근거 |
|---|---|---|
| 구현 주체 | 사용자 결정 대기 | Codex — 이번 사용자 `handoff-impl 303` 명시 호출 |
| AC4 검증 수단 | `returnedChars:0` 스키마 거부 | 입력 `maxChars:0` 거부. D-015의 입력은 `maxChars`, `returnedChars`는 응답이다 |
| D-005 마지막 문장·AC5 검증 수단 | 응답 `maxChars` | 응답 `returnedChars`. D-006·D-015 응답 필드 목록과 일치 |
| VP-02 강제 지점 합계 | EP-03·EP-04 자리 11 | 자리 9 = EP-03 7 + EP-04 2. §10의 고정 자리 목록은 유지 |
| VP-06 EP-04 ② 직접 oracle | `tools-lifecycle.test.ts` AC15 red | 배포 통합에서 같은 manager에 incremental→full을 겹쳐 호출하고 RETR·mode·호출 순서를 관측한다. tools mock은 manager를 실행하지 않음(`tools-lifecycle.test.ts:6`) |
| §10 manager 경계 | 판정 함수 UT와 tools ①만 잠금 | production에서 도달하지 않는 경계는 유지. 직접 호출 통합이 ②의 실행 구간을 덮는다 |

`ACTIVE 결정 ↔ AC 대조: 충돌 0` — AC4·AC5 이름은 D-006·D-015를 따르고, manager 검사는 D-011의 판정표를 실행한다. 새 Decision·노드·자리·의존성은 없으며 VP-01~VP-10의 path는 유지한다.

자리 검색 명령 정정: rev.3 표의 `\|`는 rg에서 OR가 아니라 리터럴 파이프다. 같은 검색 항을 `rg -n -e '항1|항2'`로 실행하며, escape된 괄호 alternation도 `Math\.(min|max)`로 고친다. 검색 범위·고정 자리 목록은 유지하고 import·타입·정의는 운반 자리의 선언 근거로 분류한다.

READY self-review: §10 EP-01 6·EP-02 8·EP-03 7·EP-04 2·EP-05 4·EP-06 6 = 33자리. 규칙 분기·선택 변이는 승계하고, 같은 manager 직접 호출은 기존 `syncManager` fixture(`mail.integration.test.ts`)로 가능하다.

## verify r1 후 규범 정정 — V1 rev.5 (2026-11-10)

READY — **규범 변경만, 구현 없음.** 출처: verify 1회째 확장 후보 E1([`verify.md`](verify.md) §7). 판정은 **경계 선언**이며 새 Decision·AC·자리·UT 입력·변이 의무는 0이다.

| 대상 | 결정 | 근거 |
|---|---|---|
| E1 `sliceBody` 안전하지 않은 큰 정수 offset(`2**53`·`1e21`·`Infinity`) → 0 정규화 | **경계** — §10 선언 경계에 아래 1줄 추가. EP-01 ①·(e) 규칙 칸과 UT 입력 칸은 그대로 | 도구 스키마 `z.number().int().min(0)`(zod 4.4.3)가 두 값을 거부한다(verify §7 실측 `safeParse(...).success=false`). production MCP 경로에서 닿지 않고 직접 호출에서만 관측된다 |

§10 선언 경계 추가: **`Number.isSafeInteger`가 아닌 offset·maxChars(큰 정수·`Infinity`)는 비정수와 같이 기본값(offset 0·maxChars 8,000)으로 정규화한다. 스키마가 거부하는 입력이라 (e) "offset ≥ total → 빈 창"의 대상이 아니다.**

`ACTIVE 결정 ↔ AC 대조: 충돌 0` — D-003·D-007은 스키마 안 입력의 의미를 정하고, 스키마 밖 값의 처리는 D-007이 다루지 않는다. AC4·AC5와 VP-07 path는 그대로다.

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: V1 rev.4의 D-002~D-016을 구현했다. 기본 조회 창·full 비삭제·서로 다른 모드의 합류 규칙·공용 투영을 유지했다.
- 이견 / 현실성 문제: 입력/응답 이름·자리 합계·manager 직접 oracle·rg alternation은 구현 전 별도 설계 커밋으로 정정했다(위 rev.4).
- ACTIVE Decision과 충돌하는 설계 발견: 없음. 신규 의존성·마이그레이션 diff는 0줄이다.

작업 기준선: `5b4ee524`(공유 main의 0303 rev.3·0302 구현 포함), 유효 V = V1 rev.4. REQUIRED VP-01~08·10, REGRESSION VP-09, 열린 파생 이슈 없음, 선택 변이 A01~A06을 먼저 확정했다.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

좌표 약칭: `B` = `mail/body-window.test.ts:mail body windows`, `M` = `mail/sync-mode.test.ts`, `T` = `mail/tools.test.ts`, `L` = `mail/tools-lifecycle.test.ts`, `S` = `mail/store/index.test.ts`, `I` = `app/deployment/mail.integration.test.ts`. 모두 `app/src/main/` 아래이며 아래 테스트명은 해당 파일 안의 직접 oracle이다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01·07 | EP-01① | offset 기본·정규화 (1) | 1/1 | B:normalizes invalid values; reads offset 37; S01~03 관측 | -5·1.7→0, 37→37 | — |
| VP-01·07 | EP-01② | maxChars 기본 (1) | 1/1 | B:uses the public defaults; S04 관측 | 생략→8000·next 8000 | — |
| VP-01·07 | EP-01③ | 상한·하한·정수 (1) | 1/1 | B:normalizes invalid values; S05~07 관측 | 99999→16000, 0·-3·2.5→8000 | — |
| VP-01·07 | EP-01④ | 시작 pair 보정 (1) | 1/1 | B:preserves code points at offset 3; S08 관측 | offset 3→2·😀 | — |
| VP-01·07 | EP-01⑤ | 끝 pair·빈 창 확장 (1) | 1/1 | B:preserves code points at offset 0; offset 2; S09·10·12~14 관측 | ab😀cd의 길이 3→ab, pair 길이 1→2 | — |
| VP-01·07 | EP-01⑥ | nextOffset (1) | 1/1 | B:distinct consecutive windows; normalizes invalid values; S11 관측 | 8000→16000→null·본문 밖 빈 창 | — |
| VP-01·05 | EP-02① | 계정 한정 SQL (1) | 1/1 | S:rejects loose identifiers even when id 100 exists and scopes the account; S15·58 관측 | 다른 account 행은 null, id 100은 존재 | — |
| VP-01·05 | EP-02② | mailId 정규식 (1) | 1/1 | S:rejects loose identifiers; I:AC6·9; S16 관측 | 1e2·0·음수·소수·공백·없는 id→오류 | — |
| VP-01·05 | EP-02③ | 메타 6필드 (1) | 1/1 | S:bounds a 12 attachment manifest; I:AC1·2·3·4·16; S17~22 관측 | date·from·to·cc·subject·source를 서로 다른 값으로 응답 단언 | — |
| VP-01·05 | EP-02④ | manifest 10·truncated (1) | 1/1 | S:bounds a %i attachment manifest; S23·24·54 관측 | 12·3·0건, 파일명·MIME·size·id 구별 | — |
| VP-01·05 | EP-02⑤ | manager 창·DTO (1) | 1/1 | I:AC1·2·3·4·16; AC6·9; S25·55·57 관측 | 37·113→[37,150), 20k 본문 재조립 | — |
| VP-01·05 | EP-02⑥ | handler 정규화 (1) | 1/1 | L:normalizes get inputs, closes local readers, and hides failures; S26~28·56·59 관측 | 문자열 5·8→undefined, number 37·113 전달 | — |
| VP-01·05 | EP-02⑦ | null 오류 (1) | 1/1 | I:AC6·9; S29 관측 | isError:true·mail_not_found, root 경로 없음 | — |
| VP-01·05 | EP-02⑧ | get 항목·스키마 (1) | 1/1 | T:keeps search inputs unchanged and validates the new get and sync inputs; S30~32 관측 | 빈 id·음수·소수·max 0·16001 거부 | — |
| VP-02·04 | EP-03① | mode 스키마 (1) | 1/1 | T:validates the new get and sync inputs; S33 관측 | full·incremental·생략 허용, all·빈 문자열·1 거부 | — |
| VP-02·04 | EP-03② | mode 정규화 (1) | 1/1 | L:normalizes direct invalid sync modes; M:normalizes untrusted modes; S34·43 관측 | full 전달, all·빈 문자열·1→incremental | — |
| VP-02·04 | EP-03③ | manager 인자 (1) | 1/1 | L:orders a running %s and requested %s flight; S35 관측 | controller.signal·undefined·mode 인자 기록 | — |
| VP-02·04 | EP-03④ | manager 기본값 (1) | 1/1 | I 기존 syncManager 직접 호출 회귀; S36 관측 | 인자 생략은 증분, fresh 재호출 RETR 없음 | — |
| VP-02·04 | EP-03⑤ | freshness 우회 (1) | 1/1 | I:AC11 full bypasses freshness; M:plans both independent full operations; A01·S41 관측 | 증분 직후 full도 접속·RETR 4건 | — |
| VP-02·04 | EP-03⑥ | 전 UIDL 선택 (1) | 1/1 | I:AC11 full bypasses freshness; M:plans both independent full operations; A02·S42 관측 | 기존 3·새 1 모두 RETR 4,3,2,1 | — |
| VP-02·04 | EP-03⑦ | mode·집계 (1) | 1/1 | I:AC11; counts a reappearing missing ledger entry; S37~39 관측 | new 1·updated 3, missing 재등장은 new 1 | — |
| VP-02·06·08 | EP-04① | tools 합류·대기 (1) | 1/1 | L:orders a running %s and requested %s flight; retries a queued full; A03·S40·60 관측 | 4조합·후속 요청 둘·실패/취소 분기 | — |
| VP-02·06·08 | EP-04② | manager 합류·대기 (1) | 1/1 | I:EP-04 manager waits for incremental before full; A04·S61 관측 | 같은 manager 직접 호출, mode·연결 수 1/2 | — |
| VP-03 | EP-05① | descriptor 순서 (1) | 1/1 | T:four tools with local search and get as read-only operations; S44 관측 | sync/search/getAttachment/get·힌트 배열 | — |
| VP-03 | EP-05② | implementation 순서 (1) | 1/1 | T:four tools with local search and get as read-only operations; S45 관측 | descriptor와 이름·순서 동일 | — |
| VP-03 | EP-05③ | instructions (1) | 1/1 | T:four tools with local search and get as read-only operations; S46 관측 | mail_get·nextOffset·full 언급 | — |
| VP-03 | EP-05④ | search 표면 (1) | 1/1 | T:keeps search inputs unchanged; I:AC1·2·3·4·16; S47 관측 | query·limit 키, hit 키 집합·앞 300자 | — |
| VP-10 | EP-06① | search sliceBody (1) | 1/1 | S:shares search and get projections; I:AC7·21; A05 관측 | 20k·pair 경계·짧음·빈 본문 | — |
| VP-10 | EP-06② | search mailMeta (1) | 1/1 | S:shares search and get projections; A06·S48 관측 | 3검색 모드·서로 다른 메타 4메일 | — |
| VP-10 | EP-06③ | search manifest (1) | 1/1 | S:caps the whole response manifest at 50; S49·50 관측 | 메일당 10·전체 50·truncated | — |
| VP-10 | EP-06④ | get mailMeta (1) | 1/1 | S:shares search and get projections; I:AC7·21; S51 관측 | 같은 메일의 메타·snippet/page 대조 | — |
| VP-10 | EP-06⑤ | get manifest (1) | 1/1 | S:bounds a %i attachment manifest; I:AC7·21; S52 관측 | 첨부 12·3·0 및 첨부 본문 1건 | — |
| VP-10 | EP-06⑥ | 300 상수 한 곳 (1) | 1/1 | B:uses the public defaults; S53 관측 | MAIL_SEARCH_SNIPPET_CHARS=300 | — |

합계: EP-01 6 + EP-02 8 + EP-03 7 + EP-04 2 + EP-05 4 + EP-06 6 = **33/33**. 자리 검색은 [surface-search.txt](evidence/surface-search.txt)에 원출력을 보존했다. import·타입·상수 정의·helper 정의는 선언으로 분류했으며, 고정 자리 목록과 실제 운반 자리의 양방향 차집합은 ∅다.

- §10 밖에서 발견한 운반 자리: 없음. 공용 `readManifest`는 EP-02④·EP-06③⑤의 같은 쿼리·투영을 묶은 helper다.
- 직전 verify 고장 이력의 못 잡음: 해당 없음(r1 첫 구현).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | I:AC1·2·3·4·16, AC6·9, AC7·21 · B 전 케이스 | not selected; 직접 응답·재조립 |
| VP-02 | REQUIRED | SELF_PASS | I:AC10~14 · L 동시·입력 정규화 | A01·A02 red |
| VP-03 | REQUIRED | SELF_PASS | T 전 케이스 · I:AC1·2·3·4·16 · 문서/가드 | not selected; 스키마·목록·문서 직접 비교 |
| VP-04 | REQUIRED | SELF_PASS | I:AC11, AC12·14, AC13 2케이스 | not selected; RETR·upsert·비삭제 |
| VP-05 | REQUIRED | SELF_PASS | S:0303 cached mail projection | not selected; 계정·메타·manifest |
| VP-06 | REQUIRED | SELF_PASS | L 동시 4조합 · I:EP-04 manager waits | A03·A04 red |
| VP-07 | REQUIRED | SELF_PASS | B 전 8케이스 | not selected; 9분기·잘못된 입력·pair 직접 단언 |
| VP-08 | REQUIRED | SELF_PASS | M:normalizes untrusted modes; joins only a running mode | not selected; 4조합·7입력·두 plan |
| VP-09 | REGRESSION | SELF_PASS | 기존 mail 14파일 포함 현재 16파일·225케이스 | not selected; 변경한 도구 수 단언 포함 |
| VP-10 | REQUIRED | SELF_PASS | S:shares search and get projections · I:AC7·21 | A05·A06 red |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

[변이 spec](evidence/mutations.jsonl)과 [원실행 결과](evidence/mutation-results.tsv)를 보존했다. 실행: `python3 .agents/skills/handoff-verify/scripts/mutate.py docs/handoff/0303-mail-get-and-sync-modes/evidence/mutations.jsonl --cwd app`.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| S01 `mail/body-window.ts` — EP-01① specified offset | sweep | 최초 | vitest 7 failed \| 1 passed (8) | 잠김 |
| S02 `mail/body-window.ts` — EP-01① noninteger offset | sweep | 최초 | vitest 1 failed \| 7 passed (8) | 잠김 |
| S03 `mail/body-window.ts` — EP-01① negative offset | sweep | 최초 | vitest 1 failed \| 7 passed (8) | 잠김 |
| S04 `mail/body-window.ts` — EP-01② default | sweep | 최초 | vitest 1 failed \| 7 passed (8) | 잠김 |
| S05 `mail/body-window.ts` — EP-01③ clamp | sweep | 최초 | vitest 1 failed \| 7 passed (8) | 잠김 |
| S06 `mail/body-window.ts` — EP-01③ integer | sweep | 최초 | vitest 1 failed \| 7 passed (8) | 잠김 |
| S07 `mail/body-window.ts` — EP-01③ positive size | sweep | 최초 | vitest 1 failed \| 7 passed (8) | 잠김 |
| S08 `mail/body-window.ts` — EP-01④ start pair | sweep | 최초 | vitest 1 failed \| 7 passed (8) | 잠김 |
| S09 `mail/body-window.ts` — EP-01⑤ end pair | sweep | 최초 | vitest 2 failed \| 6 passed (8) | 잠김 |
| S10 `mail/body-window.ts` — EP-01⑤ single pair | sweep | 최초 | vitest 1 failed \| 7 passed (8) | 잠김 |
| S11 `mail/body-window.ts` — EP-01⑥ next offset | sweep | 최초 | vitest 8 failed (8) | 잠김 |
| S12 `mail/body-window.ts` — EP-01⑤ end clamp | sweep | 최초 | vitest 8 passed (8) | 동치 — slice가 끝을 clamp하고 끝 이후 nextOffset은 null |
| S13 `mail/body-window.ts` — EP-01⑤ empty-end guard | sweep | 최초 | vitest 8 passed (8) | 동치 — slice가 끝을 clamp하고 끝 이후 nextOffset은 null |
| S14 `mail/body-window.ts` — EP-01⑤ actual length | sweep | 최초 | vitest 4 failed \| 4 passed (8) | 잠김 |
| S15 `mail/store/index.ts` — EP-02① account scope | sweep | 최초 | vitest 1 failed \| 35 passed (36) | 잠김 |
| S16 `mail/store/index.ts` — EP-02② strict id | sweep | 최초 | vitest 1 failed \| 35 passed (36) | 잠김 |
| S17 `mail/store/index.ts` — EP-02③ metadata | sweep | 최초 | vitest 3 failed \| 33 passed (36) | 잠김 |
| S18 `mail/store/index.ts` — EP-02③ metadata | sweep | 최초 | vitest 6 failed \| 30 passed (36) | 잠김 |
| S19 `mail/store/index.ts` — EP-02③ metadata | sweep | 최초 | vitest 6 failed \| 30 passed (36) | 잠김 |
| S20 `mail/store/index.ts` — EP-02③ metadata | sweep | 최초 | vitest 9 failed \| 27 passed (36) | 잠김 |
| S21 `mail/store/index.ts` — EP-02③ metadata | sweep | 최초 | vitest 6 failed \| 30 passed (36) | 잠김 |
| S22 `mail/store/index.ts` — EP-02③ cc | sweep | 최초 | vitest 3 failed \| 33 passed (36) | 잠김 |
| S23 `mail/store/index.ts` — EP-02④ per-mail limit | sweep | 최초 | vitest 1 failed \| 35 passed (36) | 잠김 |
| S24 `mail/store/index.ts` — EP-02④ truncation flag | sweep | 최초 | vitest 2 failed \| 34 passed (36) | 잠김 |
| S25 `mail/sync-manager.ts` — EP-02⑤ window arguments | sweep | 최초 | vitest 1 failed \| 8 passed \| 32 skipped (41) | 잠김 |
| S26 `mail/tools.ts` — EP-02⑥ offset | sweep | 최초 | vitest 1 failed \| 10 passed (11) | 잠김 |
| S27 `mail/tools.ts` — EP-02⑥ maxChars | sweep | 최초 | vitest 1 failed \| 10 passed (11) | 잠김 |
| S28 `mail/tools.ts` — EP-02⑥ type normalization | sweep | 최초 | vitest 1 failed \| 10 passed (11) | 잠김 |
| S29 `mail/tools.ts` — EP-02⑦ isError | sweep | 최초 | vitest 1 failed \| 40 skipped (41) | 잠김 |
| S30 `mail/tools.ts` — EP-02⑧ schema | sweep | 최초 | vitest 1 failed \| 2 passed (3) | 잠김 |
| S31 `mail/tools.ts` — EP-02⑧ offset schema | sweep | 최초 | vitest 1 failed \| 2 passed (3) | 잠김 |
| S32 `mail/tools.ts` — EP-02⑧ mailId schema | sweep | 최초 | vitest 1 failed \| 2 passed (3) | 잠김 |
| S33 `mail/tools.ts` — EP-03① mode schema | sweep | 최초 | vitest 1 failed \| 2 passed (3) | 잠김 |
| S34 `mail/tools.ts` — EP-03② mode normalization | sweep | 최초 | vitest 4 failed \| 7 passed (11) | 잠김 |
| S35 `mail/tools.ts` — EP-03③ manager mode | sweep | 최초 | vitest 4 failed \| 7 passed (11) | 잠김 |
| S36 `mail/sync-manager.ts` — EP-03④ default (inherited direct calls) | sweep | 최초 | vitest 4 failed \| 37 passed (41) | 잠김 |
| A01 `mail/sync-manager.ts` — VP-02 selected freshness/EP-03⑤ | 선택 증거 | 최초 | vitest 1 failed \| 1 passed \| 39 skipped (41) | 잠김 |
| A02 `mail/sync-manager.ts` — VP-02 selected targets/EP-03⑥ | 선택 증거 | 최초 | vitest 1 failed \| 1 passed \| 39 skipped (41) | 잠김 |
| S37 `mail/sync-manager.ts` — EP-03⑦ actual result mode | sweep | 최초 | vitest 1 failed \| 1 passed \| 39 skipped (41) | 잠김 |
| S38 `mail/sync-manager.ts` — EP-03⑦ new/updated swap | sweep | 최초 | vitest 1 failed \| 1 passed \| 39 skipped (41) | 잠김 |
| S39 `mail/sync-manager.ts` — EP-03⑦ active-only ledger | sweep | 최초 | vitest 1 failed \| 40 skipped (41) | 잠김 |
| A03 `mail/tools.ts` — VP-06 selected tools/EP-04① | 선택 증거 | 최초 | vitest 2 failed \| 9 passed (11) | 잠김 |
| A04 `mail/sync-manager.ts` — VP-06 selected manager/EP-04② | 선택 증거 | 최초 | vitest 1 failed \| 40 skipped (41) | 잠김 |
| S40 `mail/sync-mode.ts` — EP-04 four combinations | sweep | 최초 | vitest 1 failed \| 1 passed (2) | 잠김 |
| S41 `mail/sync-mode.ts` — EP-03⑤ mode planner | sweep | 최초 | vitest 1 failed \| 1 passed (2) | 잠김 |
| S42 `mail/sync-mode.ts` — EP-03⑥ mode planner | sweep | 최초 | vitest 1 failed \| 1 passed (2) | 잠김 |
| S43 `mail/sync-mode.ts` — EP-03② mode normalizer | sweep | 최초 | vitest 1 failed \| 1 passed (2) | 잠김 |
| S44 `mail/tools.ts` — EP-05① descriptor | sweep | 최초 | vitest 1 failed \| 2 passed (3) | 잠김 |
| S45 `mail/tools.ts` — EP-05② implementation | sweep | 최초 | vitest 1 failed \| 2 passed (3) | 잠김 |
| S46 `mail/tools.ts` — EP-05③ instructions | sweep | 최초 | vitest 1 failed \| 2 passed (3) | 잠김 |
| S47 `mail/tools.ts` — EP-05④ search schema | sweep | 최초 | vitest 1 failed \| 2 passed (3) | 잠김 |
| A05 `mail/store/index.ts` — VP-10 selected snippet/EP-06① | 선택 증거 | 최초 | vitest 3 failed \| 33 passed (36) | 잠김 |
| A06 `mail/store/index.ts` — VP-10 selected inline metadata swap/EP-06② | 선택 증거 | 최초 | vitest 6 failed \| 30 passed (36) | 잠김 |
| S48 `mail/store/index.ts` — EP-06② common metadata | sweep | 최초 | vitest 14 failed \| 22 passed (36) | 잠김 |
| S49 `mail/store/index.ts` — EP-06③ search manifest | sweep | 최초 | vitest 5 failed \| 31 passed (36) | 잠김 |
| S50 `mail/store/index.ts` — EP-06③ global cap | sweep | 최초 | vitest 1 failed \| 35 passed (36) | 잠김 |
| S51 `mail/store/index.ts` — EP-06④ get metadata | sweep | 최초 | vitest 6 failed \| 30 passed (36) | 잠김 |
| S52 `mail/store/index.ts` — EP-06⑤ get manifest | sweep | 최초 | vitest 5 failed \| 31 passed (36) | 잠김 |
| S53 `mail/body-window.ts` — EP-06⑥ snippet constant | sweep | 최초 | vitest 1 failed \| 7 passed (8) | 잠김 |
| S54 `mail/store/index.ts` — EP-02④ attachment sibling swap | sweep | 최초 | vitest 3 failed \| 33 passed (36) | 잠김 |
| S55 `mail/sync-manager.ts` — EP-02⑤ offset/maxChars swap | sweep | 최초 | vitest 1 failed \| 8 passed \| 32 skipped (41) | 잠김 |
| S56 `mail/tools.ts` — EP-02⑥ size type normalization | sweep | 최초 | vitest 1 failed \| 10 passed (11) | 잠김 |
| S57 `mail/sync-manager.ts` — EP-02⑤ missing row must be mail_not_found | sweep | 최초 | vitest 1 failed \| 40 skipped (41) | 잠김 |
| S58 `mail/store/index.ts` — EP-02① SQL missing row | sweep | 최초 | vitest 1 failed \| 40 skipped (41) | 잠김 |
| S59 `mail/tools.ts` — EP-02⑥ mailId | sweep | 최초 | vitest 1 failed \| 10 passed (11) | 잠김 |
| S60 `mail/tools.ts` — EP-04① requested mode after wait | sweep | 최초 | vitest 2 failed \| 9 passed (11) | 잠김 |
| S61 `mail/sync-manager.ts` — EP-04② requested mode after wait | sweep | 최초 | vitest 1 failed \| 40 skipped (41) | 잠김 |

분모 검산: 선택 증거 6 · 인용 변이 0 · 새 구조 oracle 0 · sweep 61 = **67행**. 고정 33자리·path edge·규칙 분기·형제 값 맞바꿈을 포함하며, 그 집합의 행 없는 항목은 ∅다.

65행 red · 2행 동치(S12 끝 clamp, S13 본문 끝 guard) · 못 잡음 0. 두 동치는 빈 본문·끝 이후 offset·끝에 닿는 창을 포함한 B 8케이스가 green이고, 변경 전후 반환식이 같다. 하네스 원복 메시지 `모든 파일 원문 그대로`를 확인했다. lint 정정 뒤 저장소 oracle의 18변이를 다시 실행해 전부 red로 유지했고, S54는 formatter의 들여쓰기에 재앵커했다.

덮개 회귀: 해당 없음(r1 첫 구현·직전 verify 없음). 기존 검색 global manifest 50·첨부 동작은 기존 S 테스트와 VP-09 회귀로 유지했다.

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태 소비자 | 있음 — descriptor instructions·설명은 모델에 전달되고 `mail_not_found`는 structuredContent·isError로 전달(I:AC6·9) | 없음 |
| seam 정리 스코프 | 기존 withManager finally 유지, L의 local read·실패에서도 close 관측 | 없음 |
| 실패 상태표 귀속 | 없는 메일·끝 이후 빈 창·bulk loss·대기 취소가 §5 상태표/선언 경계와 일치 | 없음 |
| 실패가 무음인가 | 아님 — I:AC6·9·AC13 오류 단언, full은 mode와 updatedMails를 반환 | 없음 |
| 늦은 결과가 화면을 되돌리는가 | renderer 변경 없음, 각 호출은 실제 실행 flight의 mode 결과를 받음(L 4조합) | 없음 |
| full 뒤 첨부 id | 선언 경계 유지 — 재검색/조회 절차를 운영 가이드에 명시 | 없음 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | manager 합류 변이를 tools mock으로 관측할 수 없음 | 선조치 — rev.4 별도 정정 후 같은 manager 통합 | A04 red·I:EP-04 |
| 2 | MIME parser는 평문 원문 끝에 개행을 추가함 | fixture를 base64로 전달해 저장 본문을 정확히 20,000자로 고정 | I:AC1·2·3·4·16 재조립 |
| 3 | 로컬 Node ABI137과 SQLite ABI140 불일치 | Electron의 Node22/ABI140으로 직접 실행, 바이너리 재빌드 없음 | baseline.json·최종 gate 비교 |
| 4 | 기다리는 full 호출이 증분 실패·취소 뒤 사라질 위험 | 기존 재진입 형태 유지, 실패 후 full·대기 취소 두 케이스 추가 | L:retries a queued full 2케이스 |
| 5 | missing ledger를 updated로 셀 위험 | active 집합만 집계, 재등장은 new로 직접 확인 | I:counts a reappearing missing ledger entry·S39 red |

full에서 기존 메일의 MIME 해석이 실패하면 기존 active ledger·캐시를 유지한다(`sync-manager.ts` parse catch가 저장 전에 continue). 다음 증분은 그 UIDL을 건너뛰므로 full로 재시도하도록 운영 가이드에 구분했다. D-009의 메시지별 격리·비삭제를 따르는 설명이며 새 제품 결정은 없다.

### 설계 대비 명시적 차이

제품 메커니즘 차이 없음. `readManifest` helper는 계획의 attachmentManifest 공유를 감싸며, 길이 설명은 body-window 상수를 직접 참조한다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 캐시·TTL 추가 없음 | AC10·EP-03⑤ |
| 공유 | 해당 없음 — 별도 공유 상태 추가 없이 기존 flight에 mode만 추가 | AC15·EP-04 두 자리 |
| 재진입 | 해당 없음 — 계획의 종료 대기 후 재판정 사용 | L 실패·취소 및 4조합 |
| 다른 무효화 | 해당 없음 — 삭제·초기화 경로 추가 없음 | AC12·14 mailId·캐시 유지 |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | mail 순수 모듈 2·store/types/manager/tools·테스트 6·예산 등록·운영 가이드. 세부는 diff |
| 실행 명령 | lint·typecheck·migration/doc/budget 가드·파일 필터 없는 vitest·node --test scripts/*.test.mjs. vitest만 Electron Node 모드 사용 |
| 관측한 게이트 산출 | vitest 전체 942파일: 8855 passed · 23 failed · 11 skipped(총 8889); mail 16파일 225/225. node scripts 827/827 · lint 0 error/기존 warning 2 · typecheck 3종 · migration/doc/budget 가드 통과 |
| 추가·수정 테스트의 subtree 규칙 | 6파일: unit 4(B·M·T·L), sqlite io 2(S·I). 새 exe 사용·실제 홈 참조·인라인 timeout 없음. test-budgets 위반 0, node scripts 가드 포함 |
| V-pair 자기확인 | SELF_PASS 10 / SELF_BLOCKED 0 — 위 좌표 참조 |
| 강제 지점 전수 | 33/33, 검색/목록 차집합 ∅ |
| AC 자기보고 | 아래 21행 관측, Criteria-Met 21/21 |
| 블로커 / 역질문 | 없음 — 독립 검증은 Claude 차례 |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

| AC | 자기 판정 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | I:AC1·2·3·4·16 — 20k 본문·기본 창·메타 6필드 |
| AC2 | ✅ | 같은 테스트 — 8000+8000+4000 재조립·마지막 null |
| AC3 | ✅ | B 지정 3구간·I offset37/max113 |
| AC4 | ✅ | B clamp·끝 이후·기본 상수, T 스키마, I 직접 max99999 |
| AC5 | ✅ | B pair 끝/시작/길이1 세 케이스·A05 red |
| AC6 | ✅ | I:AC6·9 — id100 존재·입력7종 오류·root 미노출 |
| AC7 | ✅ | I:AC7·21 — none 빈 창·attachment 본문+manifest |
| AC8 | ✅ | S manifest12·3·0 세 케이스 |
| AC9 | ✅ | I:AC6·9 — 미로그인·미동기화 캐시 읽기, sockets 불변 |
| AC10 | ✅ | I:AC10 — 301초 뒤 RETR3만·299초 fresh·updated0 |
| AC11 | ✅ | I:AC11 — RETR4,3,2,1·new1/updated3·실행 시각 |
| AC12 | ✅ | I:AC12·14 — none→html·mailId 유지 |
| AC13 | ✅ | I:AC13 두 케이스 — old RETR 제외·skipped1·bulk loss RETR0 |
| AC14 | ✅ | I:AC12·14 — 서버 소실 메일 검색·조회 유지 |
| AC15 | ✅ | L 동시 4조합·I manager 직접 4조합 |
| AC16 | ✅ | T query/limit, I hit 키 집합·snippet300 |
| AC17 | ✅ | T 스키마 거부, L 잘못된 mode 3종 증분 인자 |
| AC18 | ✅ | T 도구4·순서·힌트·설명, 기존 I 인증 회수/복원 케이스 |
| AC19 | ✅ | closed-network-extensions mail 절 창·두 모드·비삭제·첨부id, doc inventory 통과 |
| AC20 | ✅ | 기준 main `5b4ee524` 대비 package/lock/migrations diff 0줄; migration 가드 2개 유지 |
| AC21 | ✅ | I:AC7·21·S 공용 투영 3검색모드, pair 경계299·짧음·none |

합계 검산: **✅ 21 · ⚠️ 0 · ❌ 0 = 총 21**. rev.4는 필드명·합계·직접 oracle 정정이며 AC 분모는 rev.3의 21을 유지한다.

전체 실패 기준선 분리: [baseline.json](evidence/baseline.json) ↔ [final-gates.json](evidence/final-gates.json)의 `(파일, 테스트명)` 양방향 차집합 ∅. Windows 경로 fixture 11건·win32 플러그인 제어 조건 11건·복사된 Electron 실행 파일의 공유 라이브러리 1건이며 수정 테스트 파일의 실패는 0이다.

마이그레이션 sync/no-copies는 통과했고, 저장소에 이전 `v*` 태그가 없어 append-only 비교 단계만 스크립트가 생략했다. 패키지·lock·마이그레이션 diff는 0줄이다. Windows PR/CI는 이 턴에서 실행하지 않았으며 독립 검증 대상이다.

## [구현자 기입] Review Signals (r1)

- 현재 라운드 r1, 첫 impl 턴. 직전 verify·반복 실패 축 없음.
- plan의 등록 적대 증거 A01~A06은 모두 red였다. manager mock 사각은 구현 전 직접 oracle로 정정했다.
- 환경 한계: plain Node는 ABI 불일치, Electron Node 모드는 SQLite 정상 로드. 전체 실패 집합은 최종 gate 증거에서 기준선과 비교한다.

## [검증자 기입] 파생 이슈
