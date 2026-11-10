# Plan — 0302-mail-html-body-fallback

> POP3 메일 플러그인이 `text/plain` 파트 없는 메일의 본문을 0바이트로 저장하는 결함을 고친다.
> HTML 폴백 · HTML 첨부 3단 폴백 · 본문 출처 상태(`bodySource`) · 메시지별 파싱 실패 격리 · 동기화 결과 집계를 한 번에 닫는다.
> 입력: 폐쇄망 설치본 결함 리포트(2026-11-10, DB 실측 259건 중 본문 22건). 사용자 지시: "'요구'는 보고자 판단이니 자율적으로 다시 검토 및 판단하라".

## 메타

| 항목 | 값 |
|---|---|
| slug | `0302-mail-html-body-fallback` |
| 작성자 | Claude Code |
| 일자 | 2026-11-10 |
| 상태 | impl/IMPL_DONE (V1 rev.2 + ΔV1 + ΔV2 r3) — 다음 Claude 검증 |
| 구현 주체 | Claude (버그수정 — 비기능 작업, root `AGENTS.md` 구현 주체 분담) |
| V mode | `Baseline V` — 명시적으로 상속할 V 없음. 0237 mail plugin 회귀는 기존 테스트를 REGRESSION gate로 묶는다 |
| 기준 V | `none` |
| 이번 V revision | `ΔV2` — verify r2 F3(확장 후보, 창 안, 마지막 창) 채택: EP-06′ (g)를 "디코딩 결과 = 입력 전체의 디코딩"(앞·뒤 누락 없음)으로 좁히고 AC18′ oracle을 정확 일치로 바꾼다. 이전: `ΔV1` — verify r1 F1(확장 후보, 창 안) 채택: EP-06에 "전체 바이트 디코딩" 분기 (g) 추가 · F2를 §14에 반영. 이전: `V1 rev.2` — rev.1(`b816296`, 구현·검증 전)에 사용자 결정 D-014~D-016을 반영. 구현 전이라 Delta V를 두지 않고 V1 노드를 직접 갱신했으며 바뀐 노드는 Node registry에 `rev.2` 표시 |
| 유효 V | `V1 rev.2 + ΔV1 + ΔV2` |
| 기준 커밋 | `f49b0ad` (설계 착수 시 HEAD) |

---

# Part I — Product & UX Contract

## 1. Context / 목표

**문제.** `normalize.ts:67` `bodyText: email.text ?? ''`가 `email.html`을 쓰지 않는다. postal-mime 3.0.0은 메시지 전체에 `text/plain` 파트가 하나도 없으면 `text`를 만들지 않으므로(아래 §8 실측), HTML 단독 메일은 본문 0바이트로 저장·색인된다. 모델은 `mail_search`에서 빈 `snippet`을 받고 "본문 없음"과 "추출 실패"를 구분하지 못하며, `mail_sync`는 `synced:true`만 돌려준다.

**완료 후.**
- HTML만 있는 메일의 본문이 읽을 수 있는 텍스트로 저장되고 본문 단어로 검색된다.
- 본문 파트가 없고 HTML이 첨부로만 온 메일은 그 첨부를 본문으로 삼고, 출처를 `attachment`로 밝힌다(첨부는 그대로 남는다).
- 검색 결과 각 메일이 본문 출처(`plain`/`html`/`none`)를 갖는다.
- `mail_sync` 결과가 본문 없이 저장된 수와 파싱 실패로 건너뛴 수를 보고한다.
- 메시지 1건의 MIME 파싱 실패가 동기화 전체를 실패시키지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "다음 이슈가 리포트 되었다. 대응하라. '요구'는 보고자 판단으러 네가 자율적으로 다시 검토 및 판단하라." | 사용자 턴 2026-11-10 |
| 보고 결함 1~7 | §4 표의 각 행 — 결함 1·2·3·4·5·6·7 | 결함 리포트 |
| 보고 요구 | text→html 2단 폴백(turndown 재사용) · `bodySource` + 마이그레이션 0002 · `partial`에 집계 · Pop3ErrorCode 추가 금지 · search 3분기에 `body_source` · 테스트 코퍼스 보강 · 기존 건 복구 불요 | 결함 리포트 "요구" — **보고자 판단이며 §4에서 재검토** |
| 미검증 1건 | HTML 파트가 `Content-Disposition: attachment`면 `text`·`html` 모두 비어 폴백 불가(case 8). 3단 폴백 판정엔 원문 헤더 표본 1~2건 필요 | 결함 리포트 |
| 명시 요구 (rev.2) | case 8 질의에 대한 설계자 권고 "(권장) 이번 handoff에 같이 넣기: 좁은 조건, 출처 값 `'attachment'`, charset 감지, 같은 128Ki 상한. 표본은 구현 뒤 확인용"에 사용자 "1번으로 plan 수정해" | 사용자 턴 2026-11-10 |
| 추론 의도 | 모델이 메일 본문을 근거로 답할 때 "본문이 비었다"를 "내용이 없다"로 오인하지 않게 한다 — 추론 | 결함 4 "구분 불가" |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 본문 선택 규칙: `email.text`가 공백 제외 비어 있지 않으면 `plain`(값은 `email.text` 그대로), 아니면 `email.html`을 변환해 공백 제외 비어 있지 않으면 `html`, 둘 다 아니면 `none`(본문 `''`) | 결함 1. plain 우선은 현행 동작 보존(회귀 0) | 리포트 요구 (1) 채택 | SUPERSEDED | → D-014 |
| D-002 | 변환기는 이미 채택된 `turndown`(0160 승인, `app/AGENTS.md` 의존성 정책)을 신규 순수 모듈 `mail/html-body.ts`에서 쓴다. 규칙 고정: `style`·`script`·`noscript`·`head`·`title` 제거 · `escape`를 항등 함수로 · `img`는 빈 문자열 · `a`는 링크 텍스트만 · 결과 `trim()` | 기본 설정은 CSS/JS 텍스트가 본문에 섞이고 `file_name`이 `file\_name`으로 이스케이프돼 trigram 검색이 깨진다(§8 실측). postal-mime 내부 `text-format.js`는 `exports`가 `.`뿐이라 import 불가 | 리포트 요구 (1) 채택 + 규칙 보강 | ACTIVE | — |
| D-003 | HTML 변환 입력은 앞 **131,072 UTF-16 code unit**(`html.slice(0, 131072)`)으로 자른다. 상수는 `html-body.ts` 한 곳(`HTML_BODY_INPUT_LIMIT`) | turndown은 입력 크기에 초선형이다 — 이번 세션 실측 `<p>` 512KB 2.4s, 표 1MB 4.3s, 4MB 66s. 변환은 Electron main 스레드에서 돈다. 128Ki는 실측 0.06~0.19s | 설계자 판단(측정) | ACTIVE | — |
| D-004 | 변환기가 throw하면 그 메일은 `bodySource:'none'`, 본문 `''`로 저장한다. 동기화를 실패시키지 않는다 | 결함 2·6. 메일 메타·첨부는 여전히 쓸모 있다 | 설계자 판단 | SUPERSEDED | → D-014 (throw = 그 단계 결과 없음 → 다음 단계. 동기화 비실패는 유지) |
| D-005 | `MailDocument.bodySource`와 `mail.body_source` 열을 추가한다. 마이그레이션 `0002_mail_body_source.sql`(append-only): `ALTER TABLE mail ADD COLUMN body_source TEXT NOT NULL DEFAULT 'none' CHECK (body_source IN ('plain','html','none'))` + `UPDATE mail SET body_source='plain' WHERE body_text <> ''` | 열 의미 = "저장된 `body_text`의 출처, `none` = 저장 본문이 비어 있음". 기존 행은 이 의미로 정확히 유도된다(내용 추측 없음). 구 코드는 `email.text`만 저장했으므로 비어 있지 않은 기존 본문은 전부 plain | 리포트 요구 (2) 채택 + backfill 규칙 | SUPERSEDED (CHECK 값 집합만) | → D-016. 열 추가·기본값·backfill·열 의미는 유지 |
| D-006 | 메일 마이그레이션은 한 건씩 `SQL 실행 + _migrations 기록`을 **한 트랜잭션**으로 적용한다 | 현재 `store/migrate.ts:15-19`는 트랜잭션 없이 `exec` 뒤 `record`한다. 0002는 `ALTER ADD COLUMN`이라 재실행이 `duplicate column`으로 실패한다 — 기록 전 중단되면 그 계정 store가 영구히 열리지 않는다. core `infra/db/migrate.ts:191`은 이미 트랜잭션이다 | 설계자 판단(조사로 발견) | ACTIVE | — |
| D-007 | **`partial`을 재사용하지 않는다.** 대신 `synced:true` 결과에 `noBodyMails: number`(이번 동기화로 `bodySource:'none'`으로 저장된 수)와 `skippedMails: number`(MIME 파싱 실패로 저장하지 않은 수)를 항상 싣는다 | `partial`은 0237 §14가 "예산 초과 시 `partial:true` + 재개 커서"로 약속했고 그 구현 여부가 **0237 D-063 OPEN(사용자 결정 대기)**이다. 집계를 실으면 모델이 "일부만 동기화됨(시간 초과)"으로 읽고 D-063을 선점한다 | 리포트 요구 (2)(7)의 `partial` 부분 **기각** | ACTIVE | — |
| D-008 | `Pop3ErrorCode`에 코드를 추가하지 않는다. 완료된 동기화의 `lastErrorCode:null` 기록은 유지한다 | 리포트 동의 — 오류 코드는 최외곽 catch가 동기화 전체 실패로 처리한다(`sync-manager.ts:175-186`). `lastErrorCode`는 기록만 있고 읽는 소비자가 0이다(§8). 손실은 D-007 결과·D-005 메일별 상태·D-012 로그로 보인다 | 리포트 요구 (2)(7) 일부 채택 | ACTIVE | — |
| D-009 | 메시지별 예외 격리는 **`parseMail` 호출만** 감싼다. TOP/RETR(네트워크)·`saveMessage`(DB·파일)·취소는 기존처럼 동기화 전체로 전파한다. 건너뛴 메시지는 ledger에 쓰지 않으므로 다음 비-fresh 동기화가 다시 RETR한다 | 결함 6. 네트워크·디스크 장애를 메시지별로 삼키면 전체 장애가 "N건 skip"으로 위장된다. 재시도는 TOP 날짜가 14일 경계를 넘으면 `decideIngest`가 멈춘다 | 리포트 결함 6 채택 + 범위 한정 | ACTIVE | — |
| D-010 | `MailSearchHit.bodySource`를 필수 필드로 추가하고 `store.search`의 3분기(LIKE·MATCH·빈 쿼리) SELECT가 모두 `m.body_source`를 읽는다. FTS 테이블·트리거는 바꾸지 않는다 | 결함 3·4. 변환된 본문은 기존 트리거(`0001_mail.sql:45-58`)로 색인된다 | 리포트 요구 (3)(4) 채택 | ACTIVE | — |
| D-011 | 기존 캐시 복구 코드는 만들지 않는다 | 원문을 저장하지 않으므로 복구하려면 ledger를 되돌려 재수집해야 한다. 기존 빈 본문 행은 retention(기본 14일) 정리로 자연 소거된다. 근거 인용 정정: 보고서의 "D-060"은 0237의 **첨부 분류** 결정이며 본문에 대한 결정은 아니다 — 같은 원칙(새 수집에만 적용)을 이번 결정으로 명시한다 | 리포트 요구 동의 + 인용 정정 | ACTIVE | — |
| D-012 | 로그: 파싱 실패마다 `getLogger().warn('mail.sync.parse_failed', { uidl, message })`, `none`으로 저장한 메일마다 `getLogger().warn('mail.sync.body_none', { uidl })`. 제목·주소·본문은 싣지 않는다 | 결함 2(무음). `infra/log/registry.ts`는 electron 비의존이라 feature에서 import 가능(다른 feature 8곳 선례) | 설계자 판단 | ACTIVE | — |
| D-013 | HTML 파트가 `Content-Disposition: attachment`인 메일(case 8)의 3단 폴백(그 첨부를 본문으로 변환) 여부 | 현재도 그 HTML은 첨부로 저장되고 `mail_search` manifest에 보이며 `mail_getAttachment`로 열 수 있다. 일반 HTML 첨부(보고서 등)를 본문으로 오인하면 검색 품질이 나빠진다. 판정엔 폐쇄망 원문 헤더 표본(`Content-Type`·`Content-Disposition`만) 1~2건이 필요 | 리포트 "미검증 1건" | SUPERSEDED | → D-014·D-015·D-016 (사용자 "1번으로 plan 수정해") |
| D-014 | 본문 선택 체인: **plain → html → attachment → none**. 각 단계는 공백 제외 비어 있지 않은 텍스트를 내면 채택되고, 비었거나 변환이 throw하면 다음 단계로 간다. ① plain = `email.text` 원문 그대로 ② html = `htmlToBodyText(email.html)` ③ attachment = `email.attachments` 순서상 **첫 번째** `mimeType`이 `text/html`(대소문자 무시)인 첨부 하나만 — 바이트를 D-015로 디코딩해 `htmlToBodyText` ④ none = `''`. attachment 단계에서 쓴 첨부는 첨부 목록에서 빼지 않는다. 동기화는 어느 단계에서도 실패시키지 않는다 | case 8 실측: `text`·`html` 둘 다 없음, 첨부 `text/html:attachment`. 발동은 본문이 하나도 없을 때뿐이라 다른 본문을 밀어내지 않는다. 일반 HTML 보고서가 걸려도 빈 본문보다 검색에 낫다. 출처 값을 따로 두어 모델이 첨부 유래임을 안다. 첫 번째만 보는 것은 변환 비용을 메일당 HTML 2회로 묶기 위함 | 사용자 결정(선택지 1) | ACTIVE | ← D-001·D-004·D-013 |
| D-015 | HTML 첨부 디코딩 `decodeHtmlBytes(bytes)`: ① 앞 1,024바이트를 latin1로 읽어 `<meta charset="X">` 또는 `<meta http-equiv="Content-Type" content="…charset=X">`의 X를 찾는다 → `new TextDecoder(X)`가 지원하면 그것으로 디코딩 ② X가 없거나 지원 안 되는 레이블이면 `new TextDecoder('utf-8', { fatal: true })` ③ 그것이 throw하면 `new TextDecoder('euc-kr')` | postal-mime는 첨부의 charset 파라미터를 버린다 — 첨부 키는 `filename`·`mimeType`·`disposition`·`content`뿐이고 바이트는 원 charset 그대로(이번 세션 실측: `charset=euc-kr` 첨부 → `content`에 `c8b8c0c7`). 폐쇄망 한국어 메일의 EUC-KR 가능성 때문에 ③을 둔다. 실측: UTF-8 fatal은 EUC-KR 바이트를 `ERR_ENCODING_INVALID_ENCODED_DATA`로 거부, `TextDecoder('euc-kr')`·`'ks_c_5601-1987'` 모두 `회의`, 모르는 레이블은 `ERR_ENCODING_NOT_SUPPORTED` | 사용자 결정(선택지 1 "charset 감지") + 설계자 규칙 | ACTIVE | — |
| D-016 | `body_source` 값 집합 = `'plain' \| 'html' \| 'attachment' \| 'none'`. 0002의 CHECK가 이 넷을 허용한다 | SQLite는 열 CHECK를 ALTER로 바꿀 수 없어 나중에 넓히려면 `mail` 테이블·FTS 트리거를 재생성해야 한다 — rev.1 §6의 "append-only 마이그레이션으로 CHECK를 넓힌다"는 틀린 서술이었다 | 사용자 결정(선택지 1) + 설계자 정정 | ACTIVE | ← D-005(CHECK 부분) |
| D-017 | `decodeHtmlBytes`는 **입력 바이트 전체**를 디코딩한다. 앞 1,024바이트 창은 charset 선언 탐지에만 쓰고 디코딩 길이를 제한하지 않는다. 길이 상한은 변환 단계의 D-003(131,072자) 하나뿐이다 | 디코딩이 앞부분만 읽으면 HTML 첨부 본문 뒷부분이 조용히 사라지고 출처는 `attachment`로 남아 손실이 숨는다(EP-06 실패 의미). 현재 코드는 이미 전체를 디코딩하나 V1 입력이 모두 2,000바이트 미만이라 잠기지 않았다(verify r1 V1-04·V1-08) | 설계자 결정(verify r1 F1 채택) | ACTIVE | — |

### 갱신 메모

- V1 신규 작성. 기존 handoff 상속 없음.
- (rev.1) `ACTIVE 결정 ↔ AC 대조: 충돌 0` — D-001→AC1·AC2·AC4, D-002→AC3, D-003→AC5, D-004→AC6, D-005→AC7·AC8, D-006→AC9, D-007→AC10, D-008→AC10, D-009→AC10·AC11, D-010→AC7·AC12, D-011→§6, D-012→AC13, D-013(OPEN)→AC2 case 8.
- rev.2 (2026-11-10, 사용자 "1번으로 plan 수정해"): D-013 OPEN을 D-014·D-015·D-016으로 확정. D-001·D-004는 D-014로, D-005의 CHECK 부분은 D-016으로 대체. AC2·AC6·AC8·AC10·AC12를 고치고 AC16·AC17 신설, MD-03/VP-10 신설, EP-01 분기 재열거, EP-06 신설.
- rev.2 `ACTIVE 결정 ↔ AC 대조: 충돌 0` — D-014→AC1·AC2·AC4·AC6·AC16, D-015→AC17, D-016→AC8, D-002→AC3, D-003→AC5, D-005(유지 부분)→AC7·AC8, D-006→AC9, D-007→AC10, D-008→AC10, D-009→AC10·AC11, D-010→AC7·AC12, D-011→§6, D-012→AC13. SUPERSEDED D-001·D-004·D-013을 근거로 쓰는 AC 0.
- ΔV1 (verify r1 F1 채택): D-017 추가, 대체 없음. 제품 동작 변경 0 — 현재 코드의 전체 디코딩을 계약으로 잠근다.
  - `ACTIVE 결정 ↔ AC 대조(ΔV1)`: D-017 ↔ AC18, D-015 ↔ AC17(유지) · D-003 ↔ AC5(유지), 충돌 0.
- ΔV2 (verify r2 F3 채택): Decision 추가·대체 없음 — D-017 "입력 바이트 전체를 디코딩"이 이미 머리 누락을 금지한다. 바뀐 것은 그 잠금(AC18′·EP-06″)뿐, 제품 동작 변경 0.
  - `ACTIVE 결정 ↔ AC 대조(ΔV2)`: D-017 ↔ AC18′(AC18 대체), D-015 ↔ AC17(유지), 충돌 0.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 결함 1: `email.html` 미사용이 원인인가 | **타당.** postal-mime는 `textTypes`에 `plain`이 하나라도 있을 때만 html→text를 만든다 | `node_modules/postal-mime/src/postal-mime.js:346-416` · §8 매트릭스 12종 실측 |
| 결함 2: 추출 실패 무음 | **타당.** mail 플러그인에 로거 사용 0 | `rg "infra/log" src/main/features/plugins` → 0건 |
| 결함 3: 빈 본문이 FTS·snippet까지 전파 | **타당**, 단 트리거는 정상 동작(입력이 비었을 뿐) — 트리거 변경 불요 | `0001_mail.sql:45-58` · `store/index.ts:344` |
| 결함 4: 검색 결과에 상태 없음 | **타당** | `types.ts:159-170` `MailSearchHit` |
| 결함 5: HTML 단독 테스트 부재 | **타당.** `mime.test.ts:25-49` 픽스처는 항상 plain+html, `pure.test.ts:116-138`은 `text`만 준다 | 파일 열람 |
| 결함 6: 메시지별 try/catch 없음 | **타당**, 단 격리 범위를 파싱으로 한정(D-009). postal-mime가 실제로 throw하는 입력이 있다 | 실측 `Maximum header size of 2097152 bytes exceeded` · `mime-node.js:46` 중첩 256 초과 |
| 결함 7: 무조건 `lastErrorCode:null` | **전제 정정.** `lastErrorCode`는 읽는 곳이 없어 사용자·모델에게 보이지 않는다. 보이는 신호는 도구 결과 `synced:true`이고 거기에 집계를 싣는다(D-007) | `rg "lastErrorCode" src --type ts`(테스트 제외) → `store/index.ts`·`sync-manager.ts` 쓰기뿐 |
| 요구: `partial`에 집계 | **이견 — 기각(D-007).** `partial`은 다른 의미로 약속돼 있고 OPEN 결정에 묶여 있다 | `0237 plan.md:1695` D-063 |
| 요구: turndown 재사용 | **채택 + 규칙 보강 + 입력 상한.** 기본 설정은 검색을 깨고 큰 입력에 초선형 | §8 실측 |
| 요구: 마이그레이션 0002 | **채택 + 적용 원자화(D-006).** 원자화 없이는 0002가 계정 store를 영구 불능으로 만들 수 있다 | `store/migrate.ts:15-19` · `migrate.test.ts:20-22` 주석이 이 위험을 이미 예고 |
| 이미 충족됐는가 | 아니오. `bodySource`·집계·격리 모두 없음 | `rg "bodySource\|noBodyMails\|skippedMails" app/src` → 0건 |
| 더 작은 해법 | `normalize.ts` 한 줄 폴백만으로 결함 1은 닫히나 결함 2·4·6이 남고, 변환 규칙 없이는 검색 회귀가 생긴다 | §8 turndown 기본 출력 |
| (rev.2) 미검증 1건: case 8 3단 폴백 | **채택(D-014).** 표본이 disposition 판정에는 필요 없어졌다 — 본문이 전무할 때만 발동하고 출처를 따로 표시하므로 오인 피해가 없다. 남은 위험은 charset이며 D-015로 대응, 표본은 구현 뒤 charset 확인용 | §8 case 8 · postal-mime 첨부 키 실측 |
| 보고서 줄 번호 | 현재 `main`과 일부 다르다(`types.ts:82-93`→`159-170`, `partial` `:110`→`:187`, snippet `:334`→`:344`). 대상 코드는 같다 | 파일 열람 |

## 5. 동작 / 사용자 흐름

```text
mail_sync → (fresh면 기존대로) → UIDL → 보호 판정 → 새 메시지마다 TOP → decideIngest
   └ fetch: RETR → parseMail ──throw──→ skippedMails+1, warn parse_failed, 다음 메시지
                      └ ok → bodySource 판정(plain→html→attachment→none) → saveMessage → newMails+1
                                                     └ none이면 noBodyMails+1, warn body_none
 → { synced:true, newMails, expired, lastSyncAt, noBodyMails, skippedMails }
mail_search → 3분기 SELECT → hit { …, snippet, bodySource, … }
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| HTML 단독/alt{html}/mixed{html,…}/related{html,img} 메일 수집 | HTML을 D-002 규칙으로 변환해 저장 | 검색 snippet에 본문 텍스트, `bodySource:'html'` |
| plain 파트가 있는 메일 | 현행 그대로 `email.text` 저장 | `bodySource:'plain'`, 본문 바이트 불변 |
| plain·html 결과 없음 + `text/html` 첨부(case 8) | 첫 `text/html` 첨부를 D-015로 디코딩·변환해 저장, 첨부는 기존 규칙대로 유지 | `bodySource:'attachment'`, snippet에 첨부 본문, manifest에 그 첨부 |
| 본문 파트·HTML 첨부 모두 없음(첨부만·빈 본문) | 본문 `''` 저장 | `bodySource:'none'`, `noBodyMails` 증가, 첨부 manifest 유지 |
| 어느 단계의 변환이 throw | 그 단계를 건너뛰고 다음 단계 | 다음 단계 결과(마지막이면 `none`) |
| MIME 파싱 throw | 그 메시지만 건너뜀, ledger 미기록 | `skippedMails` 증가, 동기화는 `synced:true`; 다음 비-fresh 동기화가 재시도 |
| TOP/RETR/저장/취소 오류 | 기존대로 동기화 전체 실패 | 기존 `stale:true` + 오류 코드 (회귀 0) |
| 마이그레이션 이전 행 검색 | backfill 값 | 본문 있던 행 `plain`, 빈 행 `none` |

### 파생 UX / 엣지케이스

- plain이 공백뿐(`'\r\n'`)이고 HTML이 있으면 `html`이다(D-014 trim).
- HTML이 131,072자를 넘으면 앞부분만 본문이 된다 — 검색 범위가 그만큼 줄어든다(§10 선언 경계).
- `noBodyMails`는 "손실"이 아니라 "본문 없이 저장"이다. 첨부만 있는 정상 메일도 센다. `attachment` 출처는 본문이 있는 것으로 보고 세지 않는다.
- HTML 첨부가 여럿이면 첫 번째만 본다. 첫 번째가 비면 `none`이다(두 번째를 보지 않는다).
- plain 또는 html 본문이 있으면 HTML 첨부는 본문 후보가 아니다(case 9·10).

## 6. 범위 / 비범위

- **범위**: §11 파일 표 전부 + 두 문서(`persistence.md`·`closed-network-extensions.md`)의 해당 문단.
- **비범위**: 기존 캐시 복구(D-011) · `partial`·재개 커서(0237 D-063) · 도구 descriptor/instructions 문구 변경 · plain이 "HTML을 보세요" 같은 안내문일 때의 HTML 우선 · renderer UI(메일 플러그인은 모델 도구 출력만 있음).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `bodySource` 값 이름·집합 | **예 — 저장 형식·도구 출력, 그리고 SQLite CHECK는 ALTER로 못 넓힌다(테이블 재생성)** | 지금 고정(D-016): `'plain' \| 'html' \| 'attachment' \| 'none'` |
| charset 실표본 확인 | 아니오 — D-015 규칙은 표본 없이 동작하고, 표본은 규칙 밖 charset(예: UTF-16) 존재 여부만 알려 준다 | verify 뒤 사용자에게 `[link]_*.html` 첨부의 `Content-Type` 줄·`<meta charset>` 유무 요청 |
| 결과 필드 이름 `noBodyMails`·`skippedMails` | **예 — 도구 출력** | 지금 고정(D-007) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | HTML 단독 메일을 정규화하면 본문이 HTML의 보이는 텍스트이고 `bodySource:'html'`이다 | `pure.test.ts` 신규: `normalizeMail({html:'<p>결재 <b>요청</b></p>'})` → `bodyText`에 `결재`·`요청` 포함, `bodySource==='html'` | `sync-manager` → `parseMail` → `normalizeMail` |
| R-01 | AT-01 / AC2 | raw MIME 매트릭스의 각 형상이 아래 출처·본문을 낸다: text/html 단독·alt{html}·mixed{html,pdf}·mixed{ics,html,pdf}·related{html,img} → `html` · plain 단독·alt{plain,html}·mixed{alt{plain,html},pdf} → `plain`이고 `bodyText`가 `email.text`와 같다 · HTML `attachment` disposition(case 8, UTF-8) → `attachment`이고 본문에 첨부의 텍스트, 그 `text/html` 첨부 1건 유지 · mixed{plain, html 첨부}(case 9) → `plain`(첨부 미사용) · mixed{html, txt 첨부}(case 10) → `html` · 빈 본문 → `none` · pdf 첨부만 → `none` | `mime.test.ts` 신규 `it.each`: `parseMail(raw)` → `bodySource`·`bodyText` 포함/미포함 단어·(case 8·9) `attachments` 단언. 각 raw의 본문·첨부 단어는 서로 다르게 둔다 | `parseMail` production 함수 그대로 |
| R-01 | AT-01 / AC3 | 변환 결과에 `<style>`·`<script>`·`<noscript>`·`<head>`·`<title>` 텍스트가 없고, `_`·`*`·`[`가 이스케이프되지 않으며, `img`의 alt·src와 `a`의 href가 없고 링크 텍스트는 남는다 | `html-body.test.ts` 신규: 규칙마다 표지 문자열 하나씩(§10 EP-02 입력 칸) 넣고 포함/미포함 단언 | `normalizeMail` → `htmlToBodyText` |
| R-01 | AT-01 / AC4 | `text`가 공백뿐이고 `html`이 있으면 `html`, `text`가 비어 있지 않으면 `html`이 있어도 `plain`이고 본문은 `text` 그대로 | `pure.test.ts` 신규 2케이스 | `normalizeMail` |
| R-01 | AT-01 / AC5 | 131,072자를 넘는 HTML은 앞 131,072자만 변환된다 | `html-body.test.ts`: 상한 앞에 표지 A, 상한 뒤에 표지 B → A 포함·B 미포함. 상한 직전 끝나는 입력은 B까지 포함(경계 1 이내) | 위와 같음 |
| R-02 | AT-02 / AC6 | 변환이 throw하면 그 단계만 건너뛴다: html 변환 throw + HTML 첨부 있음 → `attachment`, html·첨부 변환 모두 throw → `none`·`bodyText:''`이고 제목·첨부는 정상 | `pure.test.ts`: `normalizeMail(email, input, { htmlToText })`에 입력 문자열로 분기하는 가짜 변환기(본문 HTML이면 throw, 첨부 HTML이면 정상 / 둘 다 throw) → 단언 | `normalizeMail`의 단계별 catch(seam은 테스트 전용 3번째 인자, production 기본값 = `htmlToBodyText`) |
| R-02 | AT-02 / AC7 | `saveMessage`가 `bodySource`를 저장하고 같은 UIDL 재저장(upsert)이 갱신하며, `search`의 LIKE·MATCH·빈 쿼리 분기가 각 메일의 저장 값을 `bodySource`로 돌려준다 | `store/index.test.ts` 신규: plain·html·none 세 메일 저장 → 세 분기마다 메일별 `bodySource` 단언 · 같은 UIDL을 `none`→`html`로 재저장 후 `html` | `sync-manager` → `store.saveMessage` / `mail_search` → `store.search` |
| R-02 | AT-02 / AC8 | 0002 적용 뒤 새 DB는 `body_source` 열을 갖고, 0001만 적용된 기존 DB의 행은 본문 있음→`plain`·빈 본문→`none`으로 채워지며, 네 값(`plain`·`html`·`attachment`·`none`)은 허용되고 그 밖 값은 거부되며, 재개방 시 재적용되지 않는다 | `store/migrate.test.ts` 신규: 0001만 적용한 파일에 행 2개 → `applyMailMigrations` → 값 단언 · 네 값 각각 `UPDATE` 성공 · `UPDATE … body_source='x'` throw · 기존 "records every"·"applies exactly once" 케이스가 0002 포함으로 green | `createMailStore` → `openFileDatabase.initialize` → `applyMailMigrations` |
| R-02 | AT-02 / AC9 | 마이그레이션 SQL이 중간에 실패하면 그 마이그레이션의 스키마 변경도 `_migrations` 기록도 남지 않는다 | `store/migrate.test.ts` 신규: 내부 seam `applyMigrationList(db, list)`에 `[{name:'9999_fail', sql:'ALTER TABLE … ADD COLUMN probe TEXT; SELECT * FROM missing_table'}]` → throw 뒤 `probe` 열 없음·기록 없음 | `applyMailMigrations` = `applyMigrationList(db, MAIL_MIGRATIONS)` |
| R-02 | AT-02 / AC10 | 서버가 [plain, html 단독, 본문 없음, 파싱 실패, case 8 HTML 첨부] 5통을 줄 때 `mail_sync` 결과는 `synced:true, newMails:4, noBodyMails:1, skippedMails:1`이고 `lastErrorCode`는 `null`, `error` 키가 없다. 파싱 실패 메시지는 ledger에 없고 freshness가 지난 다음 동기화에서 다시 RETR되며, 저장된 4통은 다시 RETR되지 않는다 | `app/deployment/mail.integration.test.ts` 신규: 메시지 번호별 RETR 원문 hook을 fixture에 추가 → `f.server.implementations[0].handler({})` 결과 · `manager.store.state().lastErrorCode` · 두 번째 동기화 RETR 명령 목록 단언. 파싱 실패 원문 = 2 MiB 초과 헤더(실측 throw) | 선언 → auth → `mailTools` → `createMailSyncManager` → 실제 store·POP3 경로 |
| R-02 | AT-02 / AC11 | 파싱 외 오류(연결·TLS·타임아웃·DB)와 RETR 중 취소는 기존처럼 동기화 전체를 `stale:true`로 실패시킨다 | 기존 `mail.integration.test.ts:540` `'%s preserves valid auth and stale cache'` · `:353` `'%s during RETR closes socket without a partial message'` · `:297` 취소 케이스 green 유지 + 신규: `saveMessage`가 throw하면 `skippedMails` 경로가 아니라 `error:'db_failed'` | 같은 경로 |
| R-01 | AT-01 / AC12 | 동기화 뒤 HTML 본문에만 있는 단어로 `mail_search`하면 그 메일 1건이 나오고 `snippet`에 그 단어, `bodySource:'html'`이 있다. HTML 첨부에만 있는 단어로 검색하면 case 8 메일 1건이 `bodySource:'attachment'`와 그 첨부 manifest 1건으로 나온다. 같은 동기화의 plain 메일은 `bodySource:'plain'`, 본문 없음 메일은 `'none'` | AC10과 같은 테스트에서 `f.server.implementations[1].handler({ query })` 결과 단언(MATCH 분기 길이 ≥3 단어 + LIKE 분기 2자 단어 각 1회) | `mail_search` → `manager.search` → `store.search` |
| R-02 | AT-02 / AC13 | 파싱 실패는 `mail.sync.parse_failed`(uidl 포함), `none` 저장은 `mail.sync.body_none`(uidl 포함) warn 로그를 남기고 두 이벤트 데이터에 제목·주소가 없다 | AC10 테스트에서 `setRootLogger(spy)`로 warn 호출 인자 단언 | `sync-manager` 루프 |
| R-03 | AT-03 / AC14 | `persistence.md` Mail Plugin 캐시 절이 본문 출처 열을, `closed-network-extensions.md` mail 절이 HTML 폴백·HTML 첨부 폴백·`bodySource`·`noBodyMails`·`skippedMails`·메시지별 파싱 실패 격리를 서술한다. 숫자 재서술 없음 | 문서 diff 열람 + `node scripts/check-doc-inventory.mjs --check` green | 운영자 문서 |
| R-03 | AT-03 / AC15 | 새 의존성 0, `Pop3ErrorCode` 멤버 불변 | `git diff f49b0ad -- app/package.json app/package-lock.json` 빈 출력 · `git diff f49b0ad -- app/src/main/infra/net/pop3-errors.ts` 빈 출력 | — |
| R-01 | AT-01 / AC16 | attachment 단계는 첫 번째 `text/html` 첨부만 쓴다: 첫 HTML 첨부가 비면 두 번째가 있어도 `none` · `Text/HTML` 대문자 mimeType도 대상 · `text/plain` 첨부만 있으면 `none` · html 본문이 있으면 HTML 첨부가 있어도 `html`이고 본문에 첨부 텍스트가 없다 · 사용한 첨부는 `attachments`에 남는다 | `pure.test.ts`: `normalizeMail`에 `attachments` 배열을 직접 준 케이스 5개 | `normalizeMail` |
| R-01 | AT-01 / AC17 | HTML 첨부 바이트 디코딩: `<meta charset="euc-kr">` EUC-KR → 한글 정상 · `<meta http-equiv="Content-Type" content="text/html; charset=euc-kr">` → 정상 · meta 없는 UTF-8 → 정상 · meta 없는 EUC-KR → 정상(UTF-8 fatal 실패 → euc-kr) · `<meta charset="bogus">` + UTF-8 → 정상 · 탐지 창 경계: 바이트 `c3 a9`(UTF-8 `é`)를 담은 본문에 `<meta charset="iso-8859-1">`이 앞 1,024바이트 안이면 `Ã©`, 그 뒤에 있으면 `é` | `html-body.test.ts`: `decodeHtmlBytes(Buffer)` 6케이스, 한글 표지(`회의`)와 ASCII 표지 단언 · `mime.test.ts`: `charset=euc-kr` 파라미터를 가진 base64 HTML 첨부 raw(case 8) → `bodyText`에 `회의` | `normalizeMail` → `decodeHtmlBytes` → `htmlToBodyText` |
| R-01 | AT-01 / AC18 (ΔV1) | HTML 첨부 디코딩은 바이트 전체를 읽는다(D-017): 3개 디코딩 경로 — 선언 레이블 · UTF-8 · EUC-KR 폴백 — 각각에서 `4×HTML_CHARSET_SNIFF_BYTES`(4,096)바이트 이상의 ASCII 채움 **뒤** 맨 끝에 둔 표지가 결과에 남는다 | `html-body.test.ts` `decodeHtmlBytes` 3케이스: (g1) `<meta charset="euc-kr">` + 채움 + EUC-KR `결론`(`b0e1b7d0`) (g2) meta 없음 + 채움 + UTF-8 `결론` (g3) meta 없음 + 채움 + EUC-KR `결론`. 각 결과에 `결론` 포함 단언 + 입력 길이 `> 4×HTML_CHARSET_SNIFF_BYTES` 단언 | `normalizeMail` → `decodeHtmlBytes` → `htmlToBodyText` | ← **ΔV2에서 AC18′로 대체**(검증 수단만)
| R-01 | AT-01 / AC18′ (ΔV2, AC18 대체) | HTML 첨부 디코딩 결과는 입력 바이트 **전체**의 디코딩과 같다(D-017) — 앞·뒤·중간 어디도 빠지지 않는다. 3개 경로(선언 레이블 · UTF-8 · EUC-KR 폴백) 각각 | `html-body.test.ts` `decodeHtmlBytes (0302 AC18)` g1~g3: 입력 = `선언 + filler + 표지 바이트`(ASCII 채움 `4×HTML_CHARSET_SNIFF_BYTES` 이상) → `expect(decodeHtmlBytes(bytes)).toBe(declaration + filler + '결론')` 정확 일치 + 입력 길이 `> 4×HTML_CHARSET_SNIFF_BYTES` 단언. 포함(`toContain`) 단언은 쓰지 않는다 | `normalizeMail` → `decodeHtmlBytes` → `htmlToBodyText` |

### AC 검증 주의사항

- AC2·AC12의 본문 단어는 형상마다 달라야 한다 — 같은 단어면 출처를 맞바꿔도 관측이 같다.
- AC10의 4통은 메시지 번호별로 원문이 달라야 하고 `newMails`·`noBodyMails`·`skippedMails`가 서로 다른 값(3·1·1 중 `newMails`만 3)이므로 맞바꿈이 보인다. 두 집계 필드 맞바꿈은 값이 같아(1·1) 보이지 않으므로 **보조 케이스**로 [본문 없음 2통, 파싱 실패 1통]을 하나 더 둔다(`noBodyMails:2, skippedMails:1`).
- AC5는 시간 단언을 하지 않는다(상한 동작만). 시간은 §14.
- AC16·AC17의 각 케이스는 본문 HTML·첨부 HTML·두 번째 첨부의 표지 단어가 서로 달라야 한다 — 같으면 어느 원천을 썼는지 관측이 같다.
- AC17 탐지 창 케이스는 meta 위치만 다르고 바이트가 같아야 한다 — 1,024 상수를 바꾸거나 meta 단계를 지우면 둘 중 하나가 달라진다.
- AC18 표지는 입력의 **마지막 바이트들**이어야 한다 — 디코딩 길이를 어떤 N(< 입력 길이)으로 잘라도 표지가 사라진다. 설계 실측(이번 세션): 세 입력 4,107~4,130바이트, 전체 디코딩은 `결론` 포함, `subarray(0, 2000)` 절단은 세 경로 모두 미포함.
- (ΔV2) AC18′은 정확 일치다 — 끝 표지 포함만 보면 머리 N≤30바이트 누락이 green이었다(verify r2 V2-A-head1·P-A-head1~30). 설계 실측(이번 세션, 임시 테스트를 `toBe`로 바꿔 실행 후 원복): 경로 3 × {head 1·head 30·tail 1·앞 2,000 절단} 12변이 전부 red, 원 코드 22 passed.

## 7-A. V / Trace Matrix

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | HTML 본문 메일이 검색 가능한 텍스트로 저장된다 (§1·§5) | NEW | — |
| AT-01 | AT | AC1~AC5·AC12·AC16·AC17 | NEW (rev.2 확장) | — |
| R-02 | R | 본문 출처·손실·파싱 실패가 모델에게 보이고 파싱 실패가 동기화를 막지 않는다 (§1·§5) | NEW | — |
| AT-02 | AT | AC6~AC11·AC13 | NEW | — |
| R-03 | R | 운영 문서·의존성·오류 코드 계약 (§6) | NEW | — |
| AT-03 | AT | AC14·AC15 | NEW | — |
| SD-01 | SD | 동기화 수명주기: 메시지별 파싱 격리·집계·ledger 미기록 재시도 (§5 상태표·§13) | NEW | — |
| AR-01 | AR | `bodySource` 운반: normalize → store 쓰기 → 3분기 읽기 → 도구 출력 (§9·§10) | NEW | — |
| AR-02 | AR | 메일 마이그레이션 0002 + 원자 적용 (§10·§13) | NEW | — |
| MD-01 | MD | 본문 선택 체인 D-014 (`normalize.ts`) | NEW (rev.2: D-001·D-004 → D-014) | — |
| MD-02 | MD | 변환 규칙 D-002·D-003 (`html-body.ts`) | NEW | — |
| MD-03 | MD | HTML 첨부 디코딩 D-015 (`html-body.ts` `decodeHtmlBytes`) | NEW (rev.2) | — |
| INH-0237 | SD | 0237 동기화 경계(보호·수집 경계·취소·오류 분류) | INHERITED | `docs/handoff/0237-pop3-mail-search-plugin/plan.md` — 기존 테스트 `mail.integration.test.ts`·`sync-manager.test.ts`·`retention-window.test.ts` |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `mail_sync handler → sync-manager RETR → parseMail → normalizeMail(본문 선택 체인) → saveMessage → mail_search handler → store.search → hit.snippet` | 신규 `mail.integration.test.ts` AC10/AC12 케이스 — HTML 본문 전용 단어·HTML 첨부 전용 단어 검색 결과·snippet | not selected — 직접 행동 oracle | EP-01·EP-03 (자리 13) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `mail_sync handler → sync loop(parse catch · none 집계) → 결과 객체 → handler JSON` · `mail_search → hit.bodySource` | 신규 `mail.integration.test.ts` AC10(주+보조)·AC12·AC13 | required — 집계 두 필드 맞바꿈·`skippedMails` 증가 제거를 EP-04에 심는다(구조가 같은 두 카운터) | EP-03·EP-04 (자리 10) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 문서·패키지 산출물 | gate: `check-doc-inventory --check` · AC15 diff 명령 | not selected | 0 — 운반 edge 없음(문서) |
| VP-04 | SD-01 ↔ ST-01 | REQUIRED | `sync loop → parseMail throw → catch(파싱만) → 다음 메시지 → 완료 저장(lastSyncAt) → 다음 비-fresh sync → reconcile fresh에 재등장 → RETR` | 신규 AC10 두 번째 동기화 RETR 목록 · AC11 신규 `db_failed` 케이스 · 기존 `:540`·`:353`·`:297` | required — catch 범위를 `saveMessage`까지 넓히는 변이(AC11 red 기대) | EP-04 (자리 4) |
| VP-05 | AR-01 ↔ IT-01 | REQUIRED | `MailDocument.bodySource → saveMessage INSERT/UPSERT → mail.body_source → SELECT(LIKE·MATCH·빈) → row 매핑 → MailSearchHit.bodySource` | 신규 `store/index.test.ts` AC7 | not selected — 세 메일의 값이 서로 달라 직접 oracle이 맞바꿈·제거를 본다 | EP-03 (자리 7) |
| VP-06 | AR-02 ↔ IT-02 | REQUIRED | `createMailStore → openFileDatabase.initialize → applyMailMigrations → applyMigrationList → (BEGIN · exec · record · COMMIT)` | 신규 `store/migrate.test.ts` AC8·AC9 + 기존 2케이스 | required — 트랜잭션 제거 변이(AC9 red 기대) | EP-05 (자리 3) |
| VP-07 | MD-01 ↔ UT-01 | REQUIRED | `normalizeMail(email, input, deps?) → plain → html → attachment(첫 text/html → decodeHtmlBytes → htmlToText) → none → {bodyText, bodySource}` | 신규 `pure.test.ts` AC1·AC4·AC6·AC16 · `mime.test.ts` AC2·AC17(raw) | required — 단계 순서 뒤집기(html↔attachment)와 "첫 번째만" 제거(두 번째 첨부까지 시도)를 EP-01에 심는다(AC16 red 기대) | EP-01 (자리 4) |
| VP-08 | MD-02 ↔ UT-02 | REQUIRED | `htmlToBodyText(html) → slice(LIMIT) → turndown(규칙) → trim` | 신규 `html-body.test.ts` AC3·AC5 | not selected | EP-02 (자리 7) |
| VP-10 | MD-03 ↔ UT-03 | REQUIRED | `decodeHtmlBytes(bytes) → latin1(앞 1,024) meta 탐지 → TextDecoder(X) / utf-8 fatal → euc-kr` | 신규 `html-body.test.ts` AC17 6케이스 · `mime.test.ts` EUC-KR 첨부 raw | not selected — 케이스마다 디코딩 결과가 달라 직접 oracle이 단계 제거를 본다 | EP-06 (자리 4) |
| VP-09 | INH-0237 ↔ 기존 ST | REGRESSION | 동기화 루프가 바뀌므로 0237 경계 재확인 | 기존 `mail.integration.test.ts` 전체 · `sync-manager.test.ts` · `retention-window.test.ts` · `tools*.test.ts` green | not selected | — |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 (`app/`에서) | 실패 범위 |
|---|---|---|---|
| 마이그레이션 append-only | 새 SQL·`migrate.ts` import 동기화 | `node scripts/check-migrations-appendonly.mjs` | 현재 변경이 유발한 실패만 blocking |
| 문서 인벤토리 | 문서 2건 수정 | `node scripts/check-doc-inventory.mjs --check` | 〃 |
| 테스트 예산 · 풀 | 테스트 파일 추가·수정 | `node scripts/check-test-budgets.mjs` · `node --test scripts/*.test.mjs` | 수정·추가 파일의 `[test-pools]`·예산 위반은 blocking(AGENTS §판정 범위) |
| lint · typecheck | 타입 필드 추가 | `npm run lint` · `npm run typecheck` | 〃 |
| vitest 전체 | 회귀 | 파일 필터 없는 `./node_modules/.bin/vitest run` | 네이티브 로드 환경 서명은 변경 전 실패 집합과 함께 분리 |
| message bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

### ΔV1 — verify r1 F1 채택 · D-017

- V mode: Delta V. 기준 V = `0302-mail-html-body-fallback:V1 rev.2@d196925`(설계 READY 커밋, `origin/main` 조상 확인). 유효 V = V1 rev.2 + ΔV1.
- 범위: MD 레벨만. production 코드 변경 0이 기대값 — 현재 `html-body.ts:55·58·60`이 이미 `bytes` 전체를 디코딩한다. 구현은 테스트 입력 추가다.

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| MD-03 | MD | HTML 첨부 디코딩 D-015 + **전체 바이트 D-017** | CHANGED | V1 rev.2 MD-03 |
| R-01 / AT-01 | R / AT | AC18을 §7 표에 추가하나 증거는 VP-10′(MD)가 든다 — R-01 동작·VP-01 path 불변 | INHERITED | V1 rev.2 R-01·AT-01 |

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-10′ | MD-03 ↔ UT-03 | REQUIRED | `decodeHtmlBytes(bytes) → 탐지 창 → 경로 선택(선언·utf-8 fatal·euc-kr) → decode(전체 bytes)` | 기존 `html-body.test.ts` `decodeHtmlBytes (0302 AC17)` 8케이스 + 신규 AC18 3케이스(g1~g3) | required — verify r1 인용 변이 V1-04(선언 경로 `decode(bytes.subarray(0, 2000))`)·V1-08(UTF-8 경로 같은 절단)과 신규 V1-09(EUC-KR 경로 같은 절단). 자리는 EP-06′ ⑤·⑥·⑦ 각각 | EP-06 (자리 4) + EP-06′ (자리 3) |
| VP-01 | R-01 ↔ AT-01 | NOT_REQUIRED | V1 rev.2와 같음 | 기존 V1 좌표(verify r1 §4 PASS) | — | 비영향 근거: ΔV1의 production diff 0 · AC18은 MD-03 좌표로 닫힌다 |

---

### ΔV2 — verify r2 F3 채택

- V mode: Delta V. 기준 V = `V1 rev.2 + ΔV1@873c410c`(브랜치 좌표 — `origin/main` 조상 아님, 검증자가 병합 뒤 교정). 유효 V = V1 rev.2 + ΔV1 + ΔV2.
- 범위: MD 레벨만, production 변경 0 기대. 구현은 AC18 테스트의 단언을 정확 일치로 바꾸는 것이다.

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| MD-03 | MD | D-015 + D-017 — 디코딩 결과 = 입력 전체의 디코딩 | CHANGED | ΔV1 MD-03 |

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-10″ (VP-10′ 대체) | MD-03 ↔ UT-03 | REQUIRED | ΔV1 VP-10′와 같음 | 기존 AC17 8케이스 + AC18′ g1~g3(정확 일치) | required — VP-10′ 등록 변이 V1-04·V1-08·V1-09(이관) + verify r2 인용 변이 V2-A-head1(⑤ `subarray(1)`)과 같은 머리 누락 `subarray(1)`을 ⑥⑦에도(V2-B-head1·V2-C-head1). 자리는 EP-06″ ⑤·⑥·⑦ 각각 | EP-06 (4) + EP-06″ (3) |
| VP-01 | R-01 ↔ AT-01 | NOT_REQUIRED | V1 rev.2와 같음 | 기존 V1 좌표 | — | 비영향: production diff 0 기대 · AC18′은 MD-03 좌표로 닫힌다 |

- VP-10′ → VP-10″ 이관: AC17·AC18(→AC18′)·V1-04·08·09 전부 VP-10″로 간다. 폐기 0.

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 본문은 `email.text`만 쓴다 | `app/src/main/features/plugins/mail/normalize.ts:67` |
| `parseMail`은 `PostalMime.parse` → `normalizeMail` | `mime.ts:5-14` |
| 루프에 메시지별 catch 없음, 완료 시 `lastErrorCode:null` | `sync-manager.ts:136-159`·`163-168` |
| 결과 `partial?`은 production에서 설정 0 — 0237 D-063 OPEN | `types.ts:187` · `0237 plan.md:1695` |
| `MailSearchHit`에 상태 필드 없음 | `types.ts:159-170` |
| search 3분기 SELECT, snippet = `bodyText.slice(0,300)` | `store/index.ts:294-350` |
| 메일 마이그레이션은 트랜잭션 없음, core는 트랜잭션 | `store/migrate.ts:12-20` · `infra/db/migrate.ts:191` |
| `MigrationMetaDb`는 `exec`·`prepare`만 노출 | `infra/db/migration-meta.ts:8-11` |
| append-only 가드가 mail migrations 디렉터리와 `?raw` import 집합 일치를 강제 | `scripts/check-migrations-appendonly.mjs:22-26` |
| turndown 7.2.4 · `@types/turndown` · 승인 의존성 · 같은 `plugins` 슬라이스 confluence가 main에서 사용 | `app/package.json:53,68` · `app/AGENTS.md` 의존성 정책 · `confluence/storage-to-markdown.ts:14` |
| postal-mime 3.0.0 `exports`는 `"."`뿐 | `node_modules/postal-mime/package.json` |
| 로거는 electron 비의존 registry에서 | `infra/log/registry.ts` · `AppLogger.warn(event, data?)` `log-manager.ts:18` |
| 도구 핸들러는 sync 결과·search 결과를 변형 없이 JSON으로 낸다 | `tools.ts:118-145` |
| ADD COLUMN `NOT NULL DEFAULT 'none' CHECK(...)` + backfill UPDATE가 SQLite에서 동작하고 FTS 일치 유지, CHECK 위반 거부 | 이번 세션 실측(better-sqlite3, `:memory:`): `[u1 plain, u2 none]` · `CHECK constraint failed` · `match 'hello' → rowid 1` |

### postal-mime 3.0.0 실측 매트릭스 (이번 세션)

| # | 형상 | `text` | `html` | 첨부 |
|---|---|---|---|---|
| 1 | plain 단독 | 있음 | 없음 | — |
| 2 | text/html 단독 | **없음** | 있음 | — |
| 3 | alt{plain,html} | 있음 | 있음 | — |
| 4 | alt{html} | **없음** | 있음 | — |
| 5 | mixed{html,pdf} | **없음** | 있음 | pdf |
| 6 | mixed{ics,html,pdf} | **없음** | 있음 | ics·pdf |
| 7 | mixed{alt{plain,html},pdf} | 있음 | 있음 | pdf |
| 8 | text/html `attachment` | **없음** | **없음** | text/html |
| 9 | mixed{plain, html-attachment} | 있음 | 없음 | text/html |
| 10 | mixed{html, txt-attachment} | **없음** | 있음 | text/plain |
| 11 | 빈 본문 | 없음 | 없음 | — |
| 12 | related{html,img} | **없음** | 있음 | png |

### turndown 실측 (이번 세션)

| 입력 | 결과 |
|---|---|
| 기본 설정, `<head><title>T</title><style>.a{}</style>` + `<script>` | 본문에 `T.a{color:red}var x=1` 혼입 |
| 기본 설정, `file_name *star*` | `file\_name \*star\*` |
| 기본 설정, `<a href>`·`<img alt>` | `[Click](http://…)![logo](cid:i1)` |
| D-002 규칙 | `file_name *star* 1. item` · `Click` · 표 셀 텍스트 · CSS/JS 없음 · 공백 HTML → `""` |
| 크기 (D-002 규칙) | `<p>` 128KB 187ms · 256KB 711ms · 512KB 2,399ms / 표 1MB 4,344ms · 4MB 65,955ms |

### HTML 첨부 실측 (rev.2, 이번 세션)

| 관측 | 결과 |
|---|---|
| `Content-Type: text/html; charset=euc-kr; name=…` + `attachment` + base64 첨부의 postal-mime 첨부 객체 키 | `filename`·`mimeType`·`disposition`·`content` — charset 없음 |
| 그 `content` | `ArrayBuffer`, 바이트 `…3c703e c8b8c0c7 3c2f703e…` = 원 EUC-KR 그대로 |
| `new TextDecoder('utf-8', {fatal:true}).decode(EUC-KR)` | `ERR_ENCODING_INVALID_ENCODED_DATA` |
| `new TextDecoder('euc-kr')` · `('ks_c_5601-1987')` | 둘 다 `회의` |
| `new TextDecoder('bogus')` | `ERR_ENCODING_NOT_SUPPORTED` |
| Node ICU | `78.3` (full ICU — Electron도 Chromium ICU) |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 본문 원천을 읽는 production 자리 | `rg -n "email\.text\|email\.html" app/src/main/features/plugins/mail -g '!*.test.ts'` | 2 | `normalize.ts:38`(cid 참조 — 불변) · `:67`(본문 — 변경) |
| 첨부 목록을 읽는 production 자리 | `rg -n "email\.attachments" app/src/main/features/plugins/mail -g '!*.test.ts'` | 2 | `normalize.ts:39`(필터·저장) · `:70`(크기 합) — attachment 단계는 같은 `email.attachments`를 순서 그대로 읽는다(필터 결과가 아님) |
| `parseMail` production 호출부 | `rg -n "parseMail\(" app/src/main -g '!*.test.ts'` | 1 | `sync-manager.ts:151` — catch 대상 유일 |
| `body_text`를 다루는 store SQL | `rg -n "body_text" app/src/main/features/plugins/mail/store/index.ts` | 5 | INSERT(215)·UPSERT(217)·LIKE(299)·MATCH(304)·빈(309) — `body_source`도 같은 5문 + 매핑 1 |
| `MailDocument` 리터럴 생성(테스트) | `rg -n "bodyText:" app/src/main --type ts` mail 관련 | 6 | `store/index.test.ts:53,175,221` · `mail.integration.test.ts:250,341,412` — 필수 필드 추가 시 `bodySource` 기입 필요(typecheck:test) |
| `lastErrorCode` 읽기 | `rg -n "lastErrorCode" app/src --type ts`(테스트 제외) | 0 읽기 | 쓰기만 3(`sync-manager.ts:118,166,179`) |
| mail 플러그인 로거 | `rg -n "infra/log" app/src/main/features/plugins` | 0 | 신규 |

### 수치 / 전칭 표현 검산

- "본문 22/259"는 보고자 실측이며 이 저장소에서 재현할 수 없다(폐쇄망 DB). 원인 메커니즘만 매트릭스로 재현했다.
- "`parseMail` 호출부 유일" — 위 검색 1건.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
RETR raw → parseMail → PostalMime.parse ──throw──→ 루프 탈출 → 최외곽 catch → stale 실패
                             └ normalizeMail: bodyText = email.text ?? ''   (html 무시)
→ saveMessage(body_text) → FTS 트리거 → search: snippet = body_text[0:300]  (상태 없음)
→ { synced:true, newMails, expired, lastSyncAt }
```

### TO-BE

```text
RETR raw → try parseMail ─catch→ skipped++ · warn parse_failed · continue
                └ normalizeMail(email, input, deps = { htmlToText: htmlToBodyText })
                     text.trim() ? plain
                     : try convert(html).trim() ? html
                     : try convert(decodeHtmlBytes(첫 text/html 첨부)).trim() ? attachment
                     : none            (각 try의 throw = 그 단계 결과 없음)
→ saveMessage(body_text, body_source) → (none이면 noBody++ · warn body_none) → processed++
→ search 3분기: SELECT … m.body_source AS bodySource → hit.bodySource
→ { synced:true, newMails, expired, lastSyncAt, noBodyMails, skippedMails }
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임 | normalize가 text만 선택 | normalize가 4단 체인 선택, 변환·디코딩은 `html-body.ts` | D-014·D-002·D-015 | MD-01·MD-02·MD-03 / VP-07·08·10 |
| data flow | body_text만 운반 | body_text + body_source | D-005·D-010 | AR-01 / VP-05 |
| contract | 결과에 집계 없음, hit에 상태 없음 | `noBodyMails`·`skippedMails`·`bodySource` | D-007·D-010 | AR-01·SD-01 / VP-02·05 |
| error | 파싱 1건 → 전체 실패 | 파싱만 메시지별 격리 | D-009 | SD-01 / VP-04 |
| schema | 0001만, 비원자 적용 | 0002 + 원자 적용 | D-005·D-006 | AR-02 / VP-06 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `mail/html-body.ts` (신규, 순수) | D-002 규칙·D-003 상한으로 HTML → 텍스트, D-015 첨부 바이트 디코딩 | `string → string` · `Uint8Array → string` | `normalize.ts` |
| `mail/normalize.ts` | D-014 체인 + 단계별 catch | `Email → MailDocument` | `mime.ts` |
| `mail/sync-manager.ts` | D-009 격리 · 집계 · D-012 로그 | — | `tools.ts` |
| `mail/store/index.ts` | `body_source` 쓰기·읽기 | — | `sync-manager.ts` |
| `mail/store/migrate.ts` | 0002 등록 · D-006 원자 적용 | — | `store/index.ts` |
| `mail/types.ts` | `MailBodySource` SSOT | — | 위 전부 |

레이어: 전부 `features/plugins` 슬라이스 내부 + `infra/log/registry`(하향). turndown 서비스는 mail 전용 인스턴스를 `html-body.ts`에 lazy singleton으로 둔다 — confluence 변환기는 매크로 전처리와 규칙이 달라 재사용하지 않는다(`confluence/storage-to-markdown.ts:44-53`가 같은 singleton 패턴).

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-07 | **EP-01** 본문 선택 체인 D-014 | `normalize.ts` | 구현자 | 자리 4: ① plain 단계 ② html 단계(변환 + catch) ③ attachment 단계(첫 `text/html` 선택 · `decodeHtmlBytes` · 변환 + catch) ④ none 기본값과 반환 객체의 `bodyText`·`bodySource`. **규칙 칸 분기 10**: (a) text 비공백 → plain·text 원문 (b) text 공백/부재 + html 변환 비공백 → html (c) html 변환 공백 → 다음 (d) html 부재 → 다음 (e) html 변환 throw → 다음 (f) 첫 `text/html` 첨부 변환 비공백 → attachment (g) 첫 HTML 첨부가 비면 두 번째가 있어도 none (h) 첨부 변환 throw → none (i) `text/html` 첨부 없음(`text/plain` 첨부만 포함) → none (j) mimeType 대소문자 무시 | `rg -n "email\.text\|email\.html\|email\.attachments\|text/html\|bodySource" app/src/main/features/plugins/mail/normalize.ts` | 순서가 바뀌면 html 본문이 있는 메일에서 첨부를 본문으로 씀(case 10). "첫 번째만"이 빠지면 변환 비용 상한(§14)이 깨짐 |
| MD-01 / VP-07 UT 입력 칸 | — | — | — | (a) `{text:'평문A', html:'<p>HTMLB</p>'}`→plain,`'평문A'` (b) `{text:'\r\n', html:'<p>HTMLB</p>'}`→html (c) `{html:'<p> </p>', attachments:[html첨부 '첨부C']}`→attachment (d) `{attachments:[html첨부 '첨부C']}`→attachment (e) `{html:'<p>HTMLB</p>', attachments:[html첨부 '첨부C']}` + 본문 HTML에서만 throw하는 `deps.htmlToText`→attachment (f) (d)와 같음 + 본문에 `첨부C` (g) `attachments:[html첨부 '<p> </p>', html첨부 '첨부D']`→none·본문에 `첨부D` 없음 (h) 모든 입력 throw하는 `deps.htmlToText` + 첨부→none·제목 유지 (i) `attachments:[{mimeType:'text/plain', content:'평문첨부E'}]`→none (j) `mimeType:'Text/HTML'` 첨부→attachment | — | — |
| MD-02 / VP-08 | **EP-02** 변환 규칙 D-002·상한 D-003 | `html-body.ts` | 구현자 | 자리 7: ① `remove` 목록(style·script·noscript·head·title) ② `escape` 항등 ③ `img` 규칙 ④ `a` 규칙 ⑤ `slice(0, HTML_BODY_INPUT_LIMIT)` ⑥ `trim()` ⑦ singleton 생성 | `rg -n "remove\|escape\|addRule\|slice\|trim\|HTML_BODY_INPUT_LIMIT" app/src/main/features/plugins/mail/html-body.ts` | 규칙 하나가 빠지면 CSS/JS 혼입·이스케이프·URL 잡음으로 검색 품질 회귀 |
| MD-02 / VP-08 UT 입력 칸 | — | — | — | ①은 5태그마다 고유 표지(`STYLEMARK` 등) ② `snake_case_word *star* [x]` 그대로 ③ `<img alt="IMGALT" src="cid:IMGSRC">` 둘 다 없음 ④ `<a href="http://HREFMARK">LINKTEXT</a>` → `LINKTEXT` 있음·`HREFMARK` 없음 ⑤ AC5 표지 A/B ⑥ `<p> </p>` → `''` ⑦ 두 번 호출해도 결과 동일 | — | — |
| AR-01 / VP-05·VP-01 | **EP-03** `bodySource` 운반 | `types.ts` `MailBodySource` | 구현자 | 자리 9: ① `MailDocument.bodySource`(types) ② `MailSearchHit.bodySource`(types) ③ INSERT 열·값 ④ UPSERT `SET body_source=excluded.body_source` ⑤ LIKE SELECT ⑥ MATCH SELECT ⑦ 빈 쿼리 SELECT ⑧ row 타입 ⑨ hit 매핑 | `rg -n "body_source\|bodySource" app/src/main/features/plugins/mail/store/index.ts app/src/main/features/plugins/mail/types.ts` | 한 분기만 빠지면 그 쿼리 형태의 검색에서 상태가 `undefined` |
| SD-01 / VP-04·VP-02 | **EP-04** 격리·집계 | `sync-manager.ts` | 구현자 | 자리 4: ① `parseMail`만 감싼 try/catch(→ skipped++·warn·continue) ② `document.bodySource==='none'` 분기(→ noBody++·warn) — 저장 **성공 뒤** ③ 성공 반환 객체 `noBodyMails`·`skippedMails` ④ 카운터 초기화(루프 전 0) | `rg -n "parseMail\|skippedMails\|noBodyMails\|mail\.sync\." app/src/main/features/plugins/mail/sync-manager.ts` | catch가 넓으면 DB·네트워크 장애가 skip으로 위장(D-009). 집계를 저장 전에 세면 저장 실패 메시지가 `noBodyMails`에 남음 |
| AR-02 / VP-06 | **EP-05** 마이그레이션 | `store/migrate.ts` · `migrations/0002_mail_body_source.sql` | 구현자 | 자리 3: ① 0002 SQL 파일(D-005 문장에 D-016 CHECK `IN ('plain','html','attachment','none')`) ② `MAIL_MIGRATIONS` 항목 ③ `applyMigrationList`의 트랜잭션(`BEGIN`→`exec`→`record`→`COMMIT`, 실패 시 `ROLLBACK` 후 rethrow) | `rg -n "0002\|BEGIN\|COMMIT\|ROLLBACK\|transaction" app/src/main/features/plugins/mail/store/migrate.ts` · `ls app/src/main/features/plugins/mail/migrations` | 비원자면 중단 시 계정 store 영구 불능 |
| MD-03 / VP-10 | **EP-06** 첨부 디코딩 D-015 | `html-body.ts` `decodeHtmlBytes` | 구현자 | 자리 4: ① 탐지 창 `bytes.subarray(0, 1024)` latin1 ② meta 정규식 2형(`charset=` 속성 · `http-equiv` content 안의 `charset=`) ③ 레이블 디코더 생성 try(실패 → ④) ④ utf-8 fatal → catch → euc-kr. **규칙 칸 분기 6**: (a) meta charset 속성 유효 (b) http-equiv 형 유효 (c) 레이블 무효 → utf-8 경로 (d) meta 없음 + 유효 UTF-8 (e) meta 없음 + UTF-8 무효 → euc-kr (f) meta가 창 밖 → 미검출 | `rg -n "subarray\|1024\|charset\|TextDecoder\|fatal\|euc-kr" app/src/main/features/plugins/mail/html-body.ts` | 디코딩이 틀리면 한글 본문이 깨져 검색 불능 — 출처는 `attachment`로 보여 손실이 숨는다 |
| MD-03 / VP-10 UT 입력 칸 | — | — | — | AC17 6케이스가 (a)~(f)에 1:1: (a) `<meta charset="euc-kr">`+EUC-KR (b) http-equiv+EUC-KR (c) `<meta charset="bogus">`+UTF-8 (d) meta 없음 UTF-8 (e) meta 없음 EUC-KR (f) `c3 a9` 본문 + `iso-8859-1` meta 창 안/밖 두 입력 | — | — |
| MD-03 / VP-10′ (ΔV1) | **EP-06′** 디코딩 완전성 D-017 | `html-body.ts` `decodeHtmlBytes` | 구현자 | 자리 3: ⑤ 선언 경로 `decoder.decode(bytes)` ⑥ UTF-8 fatal 경로 `.decode(bytes)` ⑦ EUC-KR 폴백 `.decode(bytes)`. **규칙 칸 분기 1**: (g) 어느 경로든 디코딩 입력은 `bytes` 전체 — 경로마다 입력 1개(g1~g3) | `rg -n "\.decode\(" app/src/main/features/plugins/mail/html-body.ts` → 3줄(55·58·60, 이번 세션) | 절단되면 첨부 본문 뒷부분이 색인되지 않는데 출처는 `attachment`로 보여 손실이 숨는다 | ← **ΔV2에서 EP-06″로 대체**
| MD-03 / VP-10′ UT 입력 칸 | — | — | — | (g1)→⑤ `<meta charset="euc-kr">` + `<p>`+`f`×4096+`</p>` + EUC-KR `결론` (g2)→⑥ meta 없음 + 같은 채움 + UTF-8 `결론` (g3)→⑦ meta 없음 + 같은 채움 + EUC-KR `결론`. 표지는 입력 맨 끝, 채움에 비-ASCII 0 | — | — |
| MD-03 / VP-10″ (ΔV2, EP-06′ 대체) | **EP-06″** 디코딩 완전성 D-017 | `html-body.ts` `decodeHtmlBytes` | 구현자 | 자리 3(EP-06′와 같음): ⑤ 선언 경로 `decoder.decode(bytes)` ⑥ UTF-8 fatal `.decode(bytes)` ⑦ EUC-KR 폴백 `.decode(bytes)`. **규칙 칸 분기 1**: (g′) 어느 경로든 디코딩 결과는 `bytes` 전체를 그 경로 디코더로 디코딩한 문자열과 같다 — 앞·뒤·중간 누락 없음. 경로마다 입력 1개(g1~g3) | `rg -n "\.decode\(" app/src/main/features/plugins/mail/html-body.ts` → 3줄(55·58·60, 이번 세션 재실행) | 머리가 빠지면 `<meta` 의 `<`가 사라져 `meta charset=…>` 같은 잡음이 본문에 들어가고, 꼬리가 빠지면 본문 뒷부분이 색인되지 않는다 — 출처는 `attachment`로 보여 손실이 숨는다 |
| MD-03 / VP-10″ UT 입력 칸 | — | — | — | (g1)(g2)(g3) 입력은 EP-06′ 입력 칸과 같고, 관측을 **정확 일치**로 한다: g1 기대 `<meta charset="euc-kr"><p>f×4096</p>결론` · g2·g3 기대 `<p>f×4096</p>결론` | — | — |
| R-03 / VP-03 | 문서·의존성 | 두 문서 | 구현자 | 0 — 운반 edge 없음 | — | — |

**선언 경계** (게이트가 green인 채로 남는 차이 — 판정에 쓰지 않음):

- HTML 131,072자 뒤의 본문은 색인되지 않는다(D-003). AC5가 이 동작을 고정한다.
- plain이 비어 있지 않으면 HTML이 더 풍부해도 plain을 쓴다(D-014).
- HTML 첨부는 첫 번째 `text/html` 하나만 본다(D-014). 첫 번째가 비면 뒤 첨부에 본문이 있어도 `none`이다.
- 첨부 charset은 `<meta>`(앞 1,024바이트) · UTF-8 · EUC-KR만 다룬다(D-015). meta 없는 UTF-16·Shift_JIS 등은 EUC-KR로 잘못 디코딩될 수 있다 — 출처는 `attachment`로 남는다.
- `attachment` 출처 메일이 실제로 본문 대체인지 일반 HTML 보고서인지 구분하지 않는다.
- `noBodyMails`는 손실과 정상 무본문(첨부만)을 구분하지 않는다.
- 파싱 실패 메시지는 retention 경계까지 비-fresh 동기화마다 재RETR된다(D-009) — 비용 상한은 그 메시지 크기 × 동기화 수.
- 모든 단계의 변환 throw와 진짜 빈 본문은 둘 다 `none`이다(로그 이벤트도 같은 `body_none`).
- 기존 캐시의 HTML 단독 메일은 `none`으로 남다가 retention으로 사라진다(D-011).
- (ΔV1) 디코딩은 전체지만 색인은 디코딩 결과의 앞 131,072자뿐이다(D-003) — AC18은 디코딩 단계만 잠그고 변환 상한은 AC5가 잠근다.
- (ΔV1) `normalize.ts` `asBytes` → `decodeHtmlBytes` 운반 edge는 EP-06′ 자리가 아니다 — ΔV1은 MD-03 내부만 다룬다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/features/plugins/mail/types.ts` | SSOT | `export type MailBodySource = 'plain' \| 'html' \| 'attachment' \| 'none'` · `MailDocument.bodySource: MailBodySource`(필수) · `MailSearchHit.bodySource: MailBodySource`(필수) · `synced:true` 분기에 `readonly noBodyMails: number; readonly skippedMails: number`. `partial?`은 손대지 않는다(D-007) | typecheck |
| `…/mail/html-body.ts` (신규) | 변환·디코딩 | `export const HTML_BODY_INPUT_LIMIT = 131_072` · `export function htmlToBodyText(html: string): string` — EP-02 자리 7 · `export function decodeHtmlBytes(bytes: Uint8Array): string` — EP-06 자리 4 | 순수 단위 |
| `…/mail/html-body.test.ts` (신규) | — | AC3·AC5·AC17·AC18(ΔV1) + EP-02·EP-06·EP-06′ 입력 칸 | unit 풀 |
| `…/mail/normalize.ts` | 선택 | 3번째 인자 `deps: { htmlToText?: (html: string) => string } = {}`(본문 HTML·첨부 HTML 두 단계가 같은 변환기를 쓴다) · EP-01. 첨부 바이트는 기존 `asBytes`로 얻는다. `referencedContentIds(email.html)`(38줄)·첨부 필터는 그대로 | 순수 단위 |
| `…/mail/pure.test.ts` | — | AC1·AC4·AC6·AC16 + EP-01 입력 칸 10개. 기존 `'normalizes sender/recipient…'`에 `bodySource:'plain'` 단언 추가 | unit |
| `…/mail/mime.test.ts` | — | AC2 raw `it.each`(§8 매트릭스 1~12 중 AC2 행의 형상 + pdf 첨부만) · AC17 EUC-KR HTML 첨부 raw. 기존 케이스 유지 | 이 파일은 store를 import하므로 기존 풀 분류 그대로 |
| `…/mail/migrations/0002_mail_body_source.sql` (신규) | 스키마 | D-005 SQL 두 문장(CHECK 값은 D-016의 넷) | — |
| `…/mail/store/migrate.ts` | 적용 | `0002` `?raw` import·목록 추가 · `export function applyMigrationList(db, list)`에 D-006 트랜잭션 · `applyMailMigrations`는 이를 호출 | io(SQLite) |
| `…/mail/store/migrate.test.ts` | — | AC8·AC9 | io |
| `…/mail/store/index.ts` | 저장·검색 | EP-03 ③~⑨ | io |
| `…/mail/store/index.test.ts` | — | AC7 · 기존 `MailDocument` 리터럴 3곳에 `bodySource` 기입 | io |
| `…/mail/sync-manager.ts` | 격리·집계·로그 | EP-04 · `import { getLogger } from '../../../infra/log/registry'`(호출 시점에 `getLogger()`) · `errorMessage`는 `infra/errors` | integration |
| `…/mail/sync-manager.test.ts` | — | 기존 `toMatchObject({ synced: true, newMails: 3 })` 유지(필드 추가에 내성) | — |
| `app/src/main/app/deployment/mail.integration.test.ts` | — | fixture에 메시지 번호별 RETR 원문 hook(`bodies(next: Record<number, string>)`) 추가 · AC10(주+보조)·AC11 신규 db_failed·AC12·AC13 · 기존 리터럴 3곳 `bodySource` 기입 | io |
| `docs/arch/backend/persistence.md` | 문서 | Mail Plugin 캐시 절에 "메일 행은 본문 출처(`plain`/`html`/`none`)를 함께 기록한다" 한 문장 | — |
| `docs/guides/closed-network-extensions.md` | 문서 | mail 절(`mail_sync`… 문단 뒤)에 HTML 폴백·HTML 첨부 폴백(첫 `text/html` 첨부, 출처 `attachment`, 첨부 유지)·`bodySource`·`noBodyMails`·`skippedMails`·파싱 실패 격리·기존 캐시 비소급 문단 | — |

AC10 원문 4통(메시지 번호 1~4, 본문 단어 서로 다름):
1. `Content-Type: text/plain` — `평문본문`
2. `Content-Type: text/html` — `<html><head><style>.x{}</style></head><body><p>결재요청서 HTML본문</p></body></html>`
3. `Content-Type: multipart/mixed` 안에 pdf 첨부만 — 본문 없음
4. 2 MiB 초과 헤더 1줄 + plain — postal-mime throw(이번 세션 실측 메시지 `Maximum header size of 2097152 bytes exceeded`)
5. `multipart/mixed` 안에 `Content-Type: text/html; name="link_1.html"` + `Content-Disposition: attachment` 파트 하나 — `<p>첨부링크본문</p>` (case 8)

보조 케이스(집계 맞바꿈 감지): [본문 없음 2통, 파싱 실패 1통] → `newMails:2, noBodyMails:2, skippedMails:1`.

### 테스트 가능성

- `normalize.ts`·`html-body.ts`는 런타임 의존이 turndown(+domino)뿐이라 unit 풀이다.
- 파싱 실패는 mock 없이 실제 postal-mime throw 입력으로 만든다 — catch 자리가 production 경로 그대로 실행된다.
- 마이그레이션 원자성은 `applyMigrationList` seam에 실패 목록을 준다 — production은 같은 함수에 `MAIL_MIGRATIONS`를 준다.

## 12. End-to-end 영향

### producer → consumer

| producer | 정규화/상태 | consumer |
|---|---|---|
| POP3 RETR 원문 | `normalizeMail` → `MailDocument.bodySource` | `store.saveMessage` |
| `mail.body_source` | `store.search` 매핑 | `mail_search` 도구 JSON → 모델 |
| sync 루프 카운터 | 결과 객체 | `mail_sync` 도구 JSON → 모델 |

### 기존 소비처

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| `tools.ts` mail_sync/mail_search | 변형 없이 통과 — 필드 증가만 | AC10·AC12 |
| `tools.sync.test.ts:14` 수동 결과 `{synced:true, fresh:false, lastSyncAt}` | 타입 없는 `new Promise` 값이라 typecheck 영향 0(`tools.sync.test.ts:11-14`). 핸들러 통과 동작만 본다 — 변경 불요 | VP-09 |
| `mail.integration.test.ts` `toMatchObject` 단언들 | 필드 추가에 내성 | VP-09 |

## 13. Lifecycle / 오류 / 정리

- 파싱 catch는 `operationSignal.aborted` 확인 뒤에 있다 — 취소는 기존 루프 머리 검사(`sync-manager.ts:137`)가 계속 던진다.
- `saveMessage` 실패는 catch 밖이라 기존 롤백·첨부 정리(`store/index.ts:259-264`)가 그대로 동작한다.
- 마이그레이션: `BEGIN` 전 `readAppliedMigrations`로 이미 적용된 것은 건너뛴다. 트랜잭션 안의 `ALTER`·`UPDATE`·`INSERT _migrations`가 함께 커밋/롤백된다. `UPDATE`는 `mail_au` 트리거로 FTS delete+insert를 같은 값으로 하므로 색인 내용 불변(실측).
- 두 저장소 쓰기: 메시지 저장은 기존처럼 파일 → DB 트랜잭션 순서이고 이번 변경은 같은 행에 열 하나를 더할 뿐이라 새 조합 없음.

## 14. 성능 / 상한 / 최적화

- 메일 1통 변환 상한: 입력 131,072자 — 실측 0.06~0.19s(이 환경), 기준 PC 배율 3을 적용해도 0.6s 이하. 체인에서 변환은 최대 2회(html 단계 + 첫 HTML 첨부)라 메일당 상한은 그 2배. 첨부 디코딩은 바이트 길이에 선형. 동기화는 메시지마다 RETR 왕복이 있어 변환이 지배하지 않는다.
- (ΔV1, verify r1 F2) 첨부 디코딩은 128Ki 변환 상한 **앞**에서 첫 `text/html` 첨부 전체를 문자열로 만든다(D-017) — 비용·메모리는 그 첨부 크기에 비례하고 상한이 없다. postal-mime이 첨부 바이트를 이미 메모리에 들고 있어 추가분은 같은 크기 문자열 1개다. 디코딩 입력을 자르는 상한은 D-017과 충돌하므로 이번 범위 밖이다.
- backfill `UPDATE`: 행 수 × FTS 재삽입. 보존 14일 캐시 규모(보고 259건)에서 무시 가능.
- 저장 본문 크기: HTML 경로는 변환 출력이 입력 상한보다 작다(실측 출력/입력 ≈ 0.4~0.85). plain 경로는 현행대로 무상한.

## 15. 외부 구현 포트 / 문서 계약

`mail_sync`·`mail_search` 출력은 모델 도구 계약이다. 폐쇄망 배포 문서(`closed-network-extensions.md`)가 운영자 진입점이므로 AC14로 함께 고친다. 배포 recipe(`MailAuthOptions`·`MailPluginOptions`) 형상은 바뀌지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| D-063 `partial` 형상 OPEN | 0237 plan | D-007 | 유지 — 선점하지 않음 |
| D-062 연속 old-header 카운트 | 0237 plan | §13 | 유지 — 파싱 catch는 `decideIngest` 뒤 |
| D-060 새 수집에만 적용(첨부) | 0237 plan | D-011 | 유지 — 같은 원칙을 본문에 별도 결정으로 |
| 머지된 마이그레이션 수정 금지 | `app/AGENTS.md` DB 정책 | EP-05 | 유지 — 0001 불변, 0002 신규 |
| 의존성 정책 | `app/AGENTS.md` | D-002 | 유지 — 신규 0 |
| main은 Node 전역 fetch 금지 등 보안 베이스라인 | `app/AGENTS.md` | — | 무관 |
| 로거는 호출 시점 `getLogger()` | `infra/log/registry.ts` 헤더 | D-012 | 따른다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 변환 텍스트가 HTML 레이아웃 잡음(표 셀 줄바꿈)을 포함 | 검색·snippet 용도로 충분. 마크다운 서식은 거의 남지 않음(§8) |
| turndown/domino가 특정 HTML에서 예외 | D-014 — 그 단계만 건너뛰고 다음 단계, 끝까지 없으면 `none`. 동기화 계속 |
| HTML 첨부 charset 오판 | D-015 3단 탐지 + §10 선언 경계. verify 뒤 실표본으로 확인 |
| 0002 적용 실패 | D-006 — 롤백되어 다음 개방에서 재시도 |
| 보고자가 기대한 `partial` 형상과 다름 | D-007 근거를 사용자에게 보고 |

## 18. 영향 받는 파일 / 문서

§11 표가 전부다. INDEX 보드 1행.

## 19. 게이트

§7-A "현재 변경의 운영 gate" 표가 정본이다. 단독 실행 예: `cd app && ./node_modules/.bin/vitest run src/main/features/plugins/mail src/main/app/deployment/mail.integration.test.ts`.

## READY self-review

- 여러 턴 결정: 단일 턴 — 사용자 지시 원문을 §2에 인용, 리포트 요구 채택/기각을 D-001~D-013에 귀속. rev.2: 사용자 선택지 1을 D-014~D-016에 귀속하고 대체 관계를 Ledger에 기록.
- `ACTIVE 결정 ↔ AC 대조: 충돌 0`(§3 갱신 메모).
- 조건절 보존: "'요구'는 보고자 판단 … 자율적으로 다시 검토 및 판단" → §4에서 요구별 판정, 기각 1건(D-007)·보강 3건(D-002 규칙·D-003·D-006).
- 사용자 질의: rev.1의 OPEN(D-013)은 rev.2에서 사용자 결정으로 닫혔다(D-014~D-016). 남은 OPEN 0.
- 실측: postal-mime 매트릭스 12종 · turndown 규칙·크기 · SQLite ALTER/CHECK/FTS · postal-mime throw 입력 · baseline `vitest run src/main/features/plugins/mail` 12 files/108 tests green.
- 저장소 규칙: append-only 가드 · test-pools(SQLite는 io) · 레이어(슬라이스 내부 + infra 하향) · 후보 표 겹침 0행(`rg -n "mail" docs/handoff/INDEX.md` 후보 표 구간 0건).
- 규칙 칸 ↔ 입력 칸(rev.1): EP-01 분기 5 ↔ 입력 5, EP-02 자리 7 ↔ 입력 7. rev.2 값은 아래.
- 적대 증거 선택: VP-02(카운터 맞바꿈·증가 제거) · VP-04(catch 범위 확대) · VP-06(트랜잭션 제거) · VP-07(rev.2 — 단계 순서 뒤집기·"첫 번째만" 제거). 각 red 기대 테스트를 Pair registry에 적었다.
- rev.2 재검: 규칙 칸 ↔ 입력 칸 EP-01 분기 10 ↔ 입력 10, EP-06 분기 6 ↔ 입력 6(창 경계는 입력 2개). VP-01 자리 = EP-01 4 + EP-03 9 = 13. 고친 AC2·AC6·AC8·AC10·AC12와 신규 AC16·AC17이 각각 행동 단언·검증 수단·도달 경로를 가진다.
- 사람 실기: 없음 — 폐쇄망 실제 메일로 22/259 → 개선 확인은 운영 관측이지 AC가 아니다(§6 범위 밖, verify 뒤 사용자 확인 권장).
- ΔV1 재검: CHANGED MD-03 ↔ REQUIRED VP-10′ · 규칙 칸 (g) 1분기 ↔ 경로별 입력 3(자리 ⑤⑥⑦ 1:1) · 자리 검색 `.decode(` 3줄 = 목록 3 · 인용 변이 V1-04·V1-08 + 신규 V1-09 자리 지정 · AC18 행동 단언·검증·도달 경로 있음 · VP-01 NOT_REQUIRED 근거 기재. 입력 민감도는 설계 실측(§7 AC 주의사항)으로 확인.
- ΔV2 재검: CHANGED MD-03 ↔ REQUIRED VP-10″ · 규칙 칸 (g′) 1분기 ↔ 경로별 입력 3(자리 ⑤⑥⑦ 1:1, 기대 문자열 명시) · 자리 검색 `.decode(` 3줄 = 목록 3 · 등록 변이 V1-04·08·09 이관 + V2-A/B/C-head1 자리 지정 · AC18′ 행동 단언·검증·도달 경로 있음 · VP-01 NOT_REQUIRED 근거 기재 · 설계 실측 12변이 red. plan 동결: 이 턴이 verify 2회째 뒤 마지막 열거 확장 턴이다.

## [구현자 기입] 설계 리뷰

r1 (구현자 = Claude, 비기능 버그수정). 설계를 그대로 수행했다. plan 규범 행 변경 0, `PLAN_GAP` 0.

| 항목 | 판정 | 근거 |
|---|---|---|
| D-014 체인 | 그대로 구현 | `normalize.ts` `selectBody` — plain → html → 첫 `text/html` 첨부 → none, 단계 결과는 `attempt()`(빈 결과·throw = 다음 단계) |
| D-015 meta 정규식 | 2형을 정규식 1개로 처리(구현 세부) | `/<meta\b[^>]*?charset\s*=…/i`가 `charset=` 속성과 http-equiv `content="…charset=…"`를 모두 잡는다. 두 형은 AC17 (a)(b) latin1 입력으로 각각 관측 |
| D-002 `head` 제거 규칙 | 구현했으나 동작상 잉여 | HTML 파서는 `<head>` 안 맨 텍스트를 body로 옮기고, head에 남는 텍스트 요소는 이미 제거되는 title·style·script·noscript와 inert template뿐 — 고장 이력 E2-04 `동치` |
| `MigrationMetaDb` 트랜잭션 | `db.exec('BEGIN'/'COMMIT'/'ROLLBACK')`로 구현 | 인터페이스(`exec`·`prepare`)를 넓히지 않았다 |
| 마이그레이션 테스트의 0001 단독 적용 | 정본 목록 `MAIL_MIGRATIONS`를 export해 필터 | 테스트에서 SQL `?raw`를 직접 import하면 append-only 가드가 "목록 사본"으로 막는다(실측 `migration list copy outside migrate.ts`) |

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-07 | EP-01 체인 | 자리 4 · 분기 10 | 4/4 · 10/10 | `rg -n "email\.text\|email\.html\|email\.attachments\|text/html\|bodySource" …/normalize.ts` → 12줄(자리 4가 이 안). 좌표 `pure.test.ts` `mail body selection chain (0302 D-014)` (a)~(j) + 공백 결과 케이스 · `mime.test.ts` `mail body source matrix (0302 AC2)` | 원천마다 표지 단어 다름(`평문A`·`HTMLB`·`첨부C`·`첨부D`·`첨부F`) — 맞바꾸면 본문 단어가 달라진다(E1-08 red) | 0 |
| VP-08 | EP-02 변환 규칙 | 자리 7 | 7/7 (⑦은 동치) | `rg -n "remove\|escape\|addRule\|slice\|trim\|HTML_BODY_INPUT_LIMIT" …/html-body.ts` → 8줄. 좌표 `html-body.test.ts` `htmlToBodyText (0302 AC3·AC5)` | 태그별 표지 `STYLEMARK` 등 · `LEADNBSP`·`LEADBR`(trim) · 표지 A/B(상한) · 상수 값 단언 `131_072` | ⑦ singleton: 결과 동일 — E2-11 `동치`(규칙 등록만 바뀌고 출력 불변) |
| VP-10 | EP-06 디코딩 | 자리 4 · 분기 6 | 4/4 · 6/6 | `rg -n "subarray\|1024\|charset\|TextDecoder\|fatal\|euc-kr" …/html-body.ts` → 9줄. 좌표 `html-body.test.ts` `decodeHtmlBytes (0302 AC17)` 8케이스 · `mime.test.ts` `AC17 decodes an EUC-KR HTML attachment…` | latin1 선언 + `c3 a9` → `Ã©`(선언 단계만이 내는 값) · EUC-KR `c8b8c0c7` → `회의` · 창 안/밖 같은 바이트 | 0 |
| VP-05 | EP-03 `bodySource` 운반 | 자리 9 | 9/9 | `rg -n "body_source\|bodySource" …/store/index.ts …/types.ts` → 11줄. 좌표 `store/index.test.ts` `returns each stored bodySource in %s results and updates it on re-save`(match·like·empty) | 네 출처가 서로 다른 값 → 분기별 `'plain' AS bodySource` 고정 변이 3종 모두 red(E3-03~05) | types ①② 필드는 typecheck가 아니라 위 런타임 단언(E1-12·E3-06 red)으로 관측 |
| VP-04·VP-02 | EP-04 격리·집계 | 자리 4 | 4/4 | `rg -n "parseMail\|skippedMails\|noBodyMails\|mail\.sync\." …/sync-manager.ts` → 11줄. 좌표 `mail.integration.test.ts` `AC10·AC12·AC13 …` · `AC10 counts body-less and skipped mail separately` · `AC11 a storage failure still fails the whole sync…` | 주 시나리오 4·1·1 + 보조 2·2·1 → 카운터 맞바꿈 red(E4-04) · catch를 저장까지 넓히면 AC11 red(E4-01) | 0 |
| VP-06 | EP-05 마이그레이션 | 자리 3 | 3/3 | `rg -n "0002\|BEGIN\|COMMIT\|ROLLBACK\|transaction" …/store/migrate.ts` → 5줄 · `ls migrations` → 0001·0002. 좌표 `store/migrate.test.ts` `backfills body_source on an existing 0001 cache…` · `rolls back a failing migration together with its record` · 기존 2케이스 | 행 2개(본문 있음/없음) → plain/none · 실패 목록 `9999_fail` | 0 |
| VP-01 | path (EP-01 + EP-03) | 자리 13 | 13/13 | 위 VP-07·VP-05 좌표 + 배포 조립 경로 `mail.integration.test.ts` AC10/AC12 케이스(`f.server.implementations[0/1].handler`) | HTML 본문 단어 `htmlbodyword`·`결재`, 첨부 단어 `attachbodyword` | 0 |
| VP-03 | 문서·의존성 | 0 | — | `git diff f49b0ad -- app/package.json app/package-lock.json app/src/main/infra/net/pop3-errors.ts` → 0줄 · `check-doc-inventory --check` ok | — | — |

목록 밖 운반 자리 0. tools.ts는 결과를 변형 없이 통과시킨다(`tools.ts:118-145` 무변경, 통합 테스트가 handler JSON으로 관측).

### Pair 자기검증

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | `mail.integration.test.ts` `AC10·AC12·AC13 …` | not selected |
| VP-02 | REQUIRED | SELF_PASS | 같은 파일 주 시나리오 + `AC10 counts …` | 카운터 맞바꿈 E4-04 red · `skippedMails` 증가 제거 E4-02 red |
| VP-03 | REQUIRED | SELF_PASS | gate `check-doc-inventory --check` · AC15 diff 0줄 | not selected |
| VP-04 | REQUIRED | SELF_PASS | `AC11 a storage failure …` · 주 시나리오 두 번째 동기화 `['RETR 4']` | catch 범위 확대 E4-01 red(2 failed) |
| VP-05 | REQUIRED | SELF_PASS | `store/index.test.ts` `returns each stored bodySource …` ×3 | not selected |
| VP-06 | REQUIRED | SELF_PASS | `store/migrate.test.ts` 4케이스 | 트랜잭션 제거 E5-01 red · ROLLBACK만 제거 E5-02 red |
| VP-07 | REQUIRED | SELF_PASS | `pure.test.ts` 체인 12케이스 · `mime.test.ts` 매트릭스 13 | 순서 뒤집기 E1-08 red · "첫 번째만" 제거(`findLast`) E1-06 red |
| VP-08 | REQUIRED | SELF_PASS | `html-body.test.ts` 변환 11케이스 | not selected |
| VP-09 | REGRESSION | SELF_PASS | 기존 `mail.integration.test.ts`(0302 신규 3 포함 31 passed) · `sync-manager.test.ts` · `retention-window.test.ts` · `tools*.test.ts` — mail 14파일 189 passed | — |
| VP-10 | REQUIRED | SELF_PASS | `html-body.test.ts` 디코딩 8케이스 · `mime.test.ts` EUC-KR raw | not selected |

## [구현자 기입] 이번 라운드 수정의 잠금

하네스 `mutate.py`, oracle = `vitest run src/main/features/plugins/mail src/main/app/deployment/mail.integration.test.ts`(14파일 189케이스). spec 52행 + 보강 뒤 재실행 3행. 실행 뒤 `# 원복 확인: 모든 파일 원문 그대로`.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| E1-01 `normalize.ts` plain 단계 제거 | sweep — EP-01 ① / 분기 (a) | — | 10 failed | 잡음 |
| E1-02 plain 본문 `email.text.trim()` | sweep — 분기 (a) "원문 그대로" | — | 1 | 잡음 |
| E1-03 html 단계 return 제거 | sweep — EP-01 ② / (b) | — | 9 | 잡음 |
| E1-04 html 단계 catch 제거 | sweep — 분기 (e) | — | 3 | 잡음 |
| E1-05 attachment 단계 return 제거 | sweep — EP-01 ③ / (f) | — | 8 | 잡음 |
| E1-06 `find`→`findLast` | VP-07 선택 증거("첫 번째만") / (g) | — | 1 | 잡음 |
| E1-07 mimeType 소문자화 제거 | sweep — 분기 (j) | — | 1 | 잡음 |
| E1-08 html↔attachment 순서 맞바꿈 | VP-07 선택 증거 / 형제 맞바꿈 | — | 1 | 잡음 |
| E1-09 attachment 단계 catch 제거 | sweep — 분기 (h) | — | 1 | 잡음 |
| E1-10 `attempt` 공백 판정 제거 | sweep — diff 자리(규칙 "공백 제외 비어 있지 않은") | 첫 실행 전 테스트 추가 | 1 | 잡음 |
| E1-11 none 기본값 `'plain'` | sweep — EP-01 ④ / (c)(d)(i) | — | 8 | 잡음 |
| E1-12 반환 `bodySource: 'plain'` 고정 | sweep — EP-01 ④ | — | 23 | 잡음 |
| E1-13 `deps.htmlToText` 무시 | sweep — seam 배선 | — | 3 | 잡음 |
| E2-01~03·05 remove 목록에서 style·script·noscript·title 각 제거 | sweep — EP-02 ① | — | 9·1·1·1 | 잡음 |
| E2-04 remove 목록에서 head 제거 | sweep — EP-02 ① | — | 0 (189 passed) | **동치** — 파서가 head에 텍스트 노드를 남기지 않고, 남는 텍스트 요소는 다른 규칙이 제거(이번 세션 node 실측: template·base·link·meta·noscript·title·object 입력 3종에서 head 규칙 유무 출력 동일) |
| E2-06 escape 항등 제거 | sweep — EP-02 ② | — | 2 | 잡음 |
| E2-07 img 규칙 제거 | sweep — EP-02 ③ | — | 1 | 잡음 |
| E2-08 a 규칙 제거 | sweep — EP-02 ④ | — | 2 | 잡음 |
| E2-09 입력 slice 제거 | sweep — EP-02 ⑤ | — | 1 | 잡음 |
| E2-10 결과 trim 제거 | sweep — EP-02 ⑥ | 첫 실행 `못 잡음` → `LEADNBSP`·`LEADBR` 테스트 추가 | 1 | 잡음(재실행) |
| E2-11 singleton → 매번 생성 | sweep — EP-02 ⑦ | — | 0 | **동치** — 규칙 등록 비용만 바뀌고 출력 불변(규칙은 상태 없음) |
| E2-12 상한 `131_073` | sweep — D-003 값 | 첫 실행 전 상수 단언 추가 | 1 | 잡음 |
| E6-01 탐지 창 제거(전체 바이트) | sweep — EP-06 ① / (f) | — | 1 | 잡음 |
| E6-02 선언 단계 건너뜀 | sweep — EP-06 ② / (a)(b) | 첫 실행 전 latin1 입력 추가 | 3 | 잡음 |
| E6-03 레이블 try 제거 | sweep — EP-06 ③ / (c) | — | 1 | 잡음 |
| E6-04 `fatal` 제거 | sweep — EP-06 ④ / (e) | — | 2 | 잡음 |
| E6-05 EUC-KR 대신 UTF-8 | sweep — EP-06 ④ / (e) | — | 2 | 잡음 |
| E6-06 창 `2048` | sweep — D-015 값 | — | 1 | 잡음 |
| E6-07 정규식을 `charset="`만 허용 | sweep — 분기 (b) http-equiv | — | 1 | 잡음 |
| E3-01 INSERT 값 `'none'` | sweep — EP-03 ③ | — | 4 | 잡음 |
| E3-02 UPSERT `body_source` SET 제거 | sweep — EP-03 ④ | — | 3 | 잡음 |
| E3-03~05 LIKE·MATCH·빈 SELECT를 `'plain' AS bodySource`로 | sweep — EP-03 ⑤⑥⑦ (형제 분기) | — | 2·2·1 | 잡음 |
| E3-06 hit 매핑 제거 | sweep — EP-03 ⑨ | — | 4 | 잡음 |
| E4-01 catch를 `saveMessage`까지 확대 | VP-04 선택 증거 | — | 2 | 잡음 |
| E4-02 `skippedMails += 1` 제거 | VP-02 선택 증거 | — | 2 | 잡음 |
| E4-03 `noBodyMails += 1` 제거 | sweep — EP-04 ② | — | 2 | 잡음 |
| E4-04 결과 두 카운터 맞바꿈 | VP-02 선택 증거 / 형제 맞바꿈 | — | 2 | 잡음 |
| E4-05 catch의 `continue` 제거 | sweep — EP-04 ① | — | 2 | 잡음 |
| E4-06 `parse_failed` 로그 제거 | sweep — D-012 | — | 1 | 잡음 |
| E4-07 `body_none` 로그 제거 | sweep — D-012 | — | 1 | 잡음 |
| E4-08 카운터 초기값 1 | sweep — EP-04 ④ | — | 2 | 잡음 |
| E4-09 none 판정 `!== 'plain'` | sweep — EP-04 ② 조건 | — | 1 | 잡음 |
| E5-01 트랜잭션 제거 | VP-06 선택 증거 | — | 1 | 잡음 |
| E5-02 ROLLBACK 제거 | sweep — EP-05 ③ | — | 1 | 잡음 |
| E5-03 0002 목록 항목 제거 | sweep — EP-05 ② | — | 44 | 잡음 |
| E5-04 backfill UPDATE 제거 | sweep — EP-05 ① | — | 1 | 잡음 |
| E5-05 CHECK에서 `attachment` 제거 | sweep — D-016 | — | 5 | 잡음 |

검산: 선택 증거 N=6(VP-02 E4-02·E4-04 · VP-04 E4-01 · VP-06 E5-01 · VP-07 E1-06·E1-08) · 인용 변이 M=0 · 새 oracle K=0(구조적 proxy 없음) · sweep S=46 = 표 행 52(spec 52). 재실행 3행(E2-04·E2-10·E2-11)은 같은 ID. 결과: 잡음 50 · 동치 2 · 못 잡음 0.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 있음 — `bodySource`·`noBodyMails`·`skippedMails`는 도구 JSON으로 모델이 받는다(통합 테스트 handler 관측). 로그 이벤트 2종은 운영자 로그 | 도구 descriptor 문구는 비범위(§6) |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 — `parseMail` 호출만 try로 감쌌고 `saveMessage` 실패 시 기존 첨부 정리(`store/index.ts`)는 그대로 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 파싱 throw → "MIME 파싱 throw" 행 · 변환 throw → "어느 단계의 변환이 throw" 행 · 마이그레이션 실패 → 표에 없음(store 개방 실패 = 기존 오류 경로, 다음 개방에서 재시도) | 마이그레이션 실패는 사용자 동작 변화가 없어 상태표 행 추가 불요로 판단 |
| 실패가 "아무 일도 안 일어남"으로 보이지 않는가 | 파싱 실패는 `skippedMails`와 warn 로그로 보인다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 해당 없음 — renderer 없음, 동시 sync는 기존 Promise 공유 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 테스트가 상한·탐지 창 상수를 import해 경계를 계산하므로 값 변경에 무감 | ✅ 선조치 — 값 단언 추가(E2-12·E6-06 red) | `html-body.test.ts` `converts only the first …` |
| 2 | EUC-KR 입력만으로는 meta 단계 제거가 폴백에 가려짐 | ✅ 선조치 — latin1 선언 입력 (a)(b) 추가(E6-02 red 3) | 같은 파일 `%s declaration wins over the UTF-8 fallback` |
| 3 | turndown은 앞쪽 nbsp·`<br>` 줄바꿈을 남겨 trim이 실제로 필요(첫 sweep `못 잡음`) | ✅ 선조치 — `LEADNBSP`·`LEADBR`·`<p>&nbsp;</p>` 단언 | node 실측 `&nbsp;x` → `" x"`, `<br><br>x` → `"  \n  \nx"` |
| 4 | 새 `301_000` 시계 자리가 테스트 예산 가드의 `SEMANTIC_DELAYS` 등록 수(4)와 어긋남 | ✅ 선조치 — `scripts/check-test-budgets.mjs` 등록 count 4→5(같은 사유: 주입 시계로 신선도 5분 넘김) | 가드 출력 `실제 자리 5 개` → 수정 뒤 `all budget sites scaled` |
| 5 | 전체 vitest 29파일 red | 비귀속(환경) — 변경 전 커밋 `a43f564` worktree에서 같은 29파일 실행: 29 failed·22 tests failed, 차집합 ∅. 서명 `Electron failed to install correctly`(npm ci `--ignore-scripts`·`ELECTRON_SKIP_BINARY_DOWNLOAD`) 외 claude/opencode native 계열. 이번 변경 파일 0 | §gate |

### 설계 대비 명시적 차이

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| meta 정규식 2형 → 1개 | 한 형만 고치면 다른 형도 같이 바뀜(공유) | AC17 (a)(b) 각 입력 · E6-07 red |
| 트랜잭션: better-sqlite3 `db.transaction` 대신 `exec('BEGIN')` | 재진입: 바깥 트랜잭션 안에서 부르면 `BEGIN` 실패 — `initialize`는 트랜잭션 밖에서만 호출(`file-database.ts:20`) | AC9 · E5-01·E5-02 red |
| 만료·다른 무효화 | 해당 없음 — 캐시·만료 메커니즘을 바꾸지 않음 | — |

### 구현 보고

| AC | 상태 | 관측 |
|---|---|---|
| AC1 | ✅ | `pure.test.ts` `(b) AC1·AC4 converts HTML when plain text is blank` |
| AC2 | ✅ | `mime.test.ts` `mail body source matrix (0302 AC2)` 13형상 |
| AC3 | ✅ | `html-body.test.ts` 태그 5·escape·img·a 케이스 |
| AC4 | ✅ | `pure.test.ts` (a)·(b) |
| AC5 | ✅ | `html-body.test.ts` `converts only the first HTML_BODY_INPUT_LIMIT code units` |
| AC6 | ✅ | `pure.test.ts` (e)·(h) |
| AC7 | ✅ | `store/index.test.ts` `returns each stored bodySource in %s results …` ×3 |
| AC8 | ✅ | `store/migrate.test.ts` `backfills body_source on an existing 0001 cache …` |
| AC9 | ✅ | `store/migrate.test.ts` `rolls back a failing migration together with its record` |
| AC10 | ✅ | `mail.integration.test.ts` `AC10·AC12·AC13 …`(4·1·1, 재RETR `['RETR 4']`, `lastErrorCode` null) · `AC10 counts …`(2·2·1) |
| AC11 | ✅ | `AC11 a storage failure …`(`db_failed`) · 기존 `%s preserves valid auth and stale cache`·`%s during RETR closes socket …`·취소 케이스 green(파일 31 passed) |
| AC12 | ✅ | 같은 테스트 — `htmlbodyword`(MATCH)·`결재`(LIKE)·`attachbodyword` 각 total 1, 출처 4종 |
| AC13 | ✅ | 같은 테스트 — warn 2건(`m4` parse_failed, `m3` body_none), 제목·주소 미포함 |
| AC14 | ✅ | `persistence.md` Mail Plugin 캐시 절 1문장 · `closed-network-extensions.md` mail 절 2문단 · `check-doc-inventory --check` ok |
| AC15 | ✅ | `git diff f49b0ad -- app/package.json app/package-lock.json app/src/main/infra/net/pop3-errors.ts` → 0줄 |
| AC16 | ✅ | `pure.test.ts` (g)·(i)·(j) · `AC16 never uses an HTML attachment while the HTML body has text` |
| AC17 | ✅ | `html-body.test.ts` `decodeHtmlBytes (0302 AC17)` 8케이스 · `mime.test.ts` EUC-KR 첨부 raw |

검산: ✅ 17 · ⚠️ 0 · ❌ 0 = 총 17 (AC1~AC17 재계수).

**gate** (`app/`, 마지막 수정 뒤 트리):

| Gate | 관측 |
|---|---|
| `node scripts/check-migrations-appendonly.mjs` | mail `2 migrations` sync ok · no-copies ok |
| `node scripts/check-doc-inventory.mjs --check` | generated·prose·links ok |
| `node scripts/check-test-budgets.mjs` | `20 real-git suites ok · all budget sites scaled` |
| `npm run lint` | 0 errors · 2 warnings(`Timeline.tsx`·`useTranscriptVirtualizer.ts` — 변경 전과 같음, 변경 파일 아님) |
| `npm run typecheck` | exit 0 |
| `./node_modules/.bin/vitest run`(필터 없음, 마지막 수정 뒤) | 940파일 중 29 failed · 907 passed · 4 skipped / 케이스 22 failed · 8695 passed. 실패 29파일은 변경 전 커밋 `a43f564`에서 같은 29파일·22케이스 실패(차집합 ∅, 환경 — 이번 변경 파일 0) |
| `node --test scripts/*.test.mjs` | 827 pass · 0 fail |
| mail 범위 | 14파일 189 passed |
| 테스트 소스 규칙(수정·추가 테스트 6파일) | 예산 가드 위반 0 · 풀 가드: unit 2(`html-body`·`pure`), io 4(SQLite) — 전체 실행에서 `[test-pools]` 위반 0 |

## [구현자 기입] Review Signals

- 라운드 1, impl 턴 `r1`(같은 라운드 앞선 커밋은 진행 중 체크포인트 `Status: partial`).
- 첫 sweep에서 `못 잡음` 1건(E2-10 trim)이 났다 — 테스트 입력이 "정리된 입력"만 써서 정리 단계를 관측하지 못했다. plan EP-02 입력 칸 ⑥(`<p> </p>` → `''`)도 같은 형태라 규칙 칸을 따라 입력을 더했다.
- 환경 한계: Electron 바이너리 미설치로 claude/opencode 계열 29파일이 기준선에서도 red. mail 범위와 무관.

## [구현자 기입] 설계 리뷰 — r2

유지. 사용자 `Handoff-impl 302` 지시로 Codex가 ΔV1을 수행했다. production 변경 0이며 `html-body.test.ts`에 AC18 입력 3개만 추가했다(`git diff --numstat`: 15 insertions).

| 항목 | 판정 | 근거 |
|---|---|---|
| 유효 V / 작업 목록 | V1 rev.2 + ΔV1 유지 | 이번 REQUIRED는 VP-10′, 명시 REGRESSION 없음. VP-01은 ΔV1의 NOT_REQUIRED이며 나머지 V1 경로도 변경하지 않았다 |
| D-017 · AC18 | 그대로 수행 | g1 선언 EUC-KR 4,130바이트 · g2 UTF-8 4,109바이트 · g3 EUC-KR 폴백 4,107바이트. ASCII 채움 뒤 마지막 바이트가 `결론`이다 |
| D-003 · D-015 | 유지 | `html-body.test.ts` AC5·AC17 기존 19케이스와 신규 AC18 3케이스가 함께 통과했다 |
| 설계 대비 차이 | 없음 · PLAN_GAP 0 | `git diff --name-only`의 app 파일은 `html-body.test.ts` 하나이며 production diff는 0줄이다 |

## [구현자 기입] 강제 지점 전수 (§10 대조) — r2

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-10′ | EP-06 D-015 + EP-06′ D-017 | 7자리: 탐지 창 · meta 2형 · 레이블 생성 try · UTF-8 fatal/EUC-KR · 전체 바이트 decode 3곳 | 7/7 · (a)~(f) 6분기와 (g) 경로별 입력 3개 | §10 검색 재실행: `.decode(` 3줄(55·58·60), EP-06 검색 9줄. 아래 좌표 7행 · 변이 14개 red | `회의`·`결재`·`Ã©/é` · 입력 끝 `결론`. 길이 4,130/4,109/4,107 > 4,096 | 0 |

| 자리 | 직접 oracle (`app/src/main/features/plugins/mail/html-body.test.ts`) | 이번 관측 |
|---|---|---|
| EP-06 ① 탐지 창 | `(f) only sniffs the declaration inside the first HTML_CHARSET_SNIFF_BYTES bytes` · `converts only the first HTML_BODY_INPUT_LIMIT code units` | 창 안/밖 `Ã©/é`, 상수 1024. R2-04·09 red |
| EP-06 ② meta 2형 | `%s declaration wins over the UTF-8 fallback`의 `(a) charset attribute`·`(b) http-equiv content` | 선언 경로만 `Ã©`. R2-05 red 3 · R2-10 red 1 |
| EP-06 ③ 레이블 생성 try | `(c) falls back to UTF-8 when the declared label is unknown` · `(a) honours <meta charset> for EUC-KR bytes` | bogus → UTF-8, 유효 선언 → EUC-KR. R2-06 red 1 |
| EP-06 ④ UTF-8 fatal → EUC-KR | `(d) decodes undeclared valid UTF-8 as UTF-8` · `(e) decodes undeclared invalid UTF-8 as EUC-KR` | `결재`/`회의`. R2-07·08 red 각 2 · R2-11 red 4 |
| EP-06′ ⑤ 선언 decode | `decodes the entire input through (g1) declared EUC-KR` | `결론` 포함. V1-04 red 1 · R2-01 red 6 |
| EP-06′ ⑥ UTF-8 decode | `decodes the entire input through (g2) undeclared UTF-8` | `결론` 포함. V1-08 red 2 · R2-02 red 6 |
| EP-06′ ⑦ EUC-KR decode | `decodes the entire input through (g3) undeclared EUC-KR fallback` | `결론` 포함. V1-09 red 1 · R2-03 red 2 |

목록 차집합 ∅. §10의 EP-06′ 목록 `decoder`·`utf-8`·`euc-kr` decode와 `.decode(` 검색의 세 반환을 대응시켰다. EP-06도 기존 네 자리에 그대로 대응하며 신규 production 운반 자리는 없다.

### Pair 자기검증

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-10′ | REQUIRED | SELF_PASS | 위 7자리 좌표 — AC17 8케이스 + AC18 3케이스, AC5 포함 파일 전체 22 passed | V1-04 red 1 · V1-08 red 2 · V1-09 red 1 |
| VP-01 | NOT_REQUIRED | — (ΔV1 비영향) | production diff 0줄 · 기존 통합 테스트 41 passed | 선택 없음 |

## [구현자 기입] 이번 라운드 수정의 잠금 — r2

하네스 `mutate.py`, oracle `cd app && ./node_modules/.bin/vitest run src/main/features/plugins/mail/html-body.test.ts`. 각 실험 후 원복했고 `git diff -- html-body.ts`는 0줄이다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| V1-04 선언 경로를 2,000바이트로 절단 | VP-10′ 선택 · F1 인용 | verify r1 못 잡음 | AC18 g1 / 1 | 잡음 |
| V1-08 UTF-8 경로를 2,000바이트로 절단 | VP-10′ 선택 · F1 인용 | verify r1 못 잡음 | AC18 g2·g3 / 2 | 잡음 |
| V1-09 EUC-KR 경로를 2,000바이트로 절단 | VP-10′ 선택 | — | AC18 g3 / 1 | 잡음 |
| R2-01 선언 경로의 bytes를 빈 배열로 | sweep EP-06′ ⑤ | — | 선언 입력·AC18 g1 / 6 | 잡음 |
| R2-02 UTF-8 경로의 bytes를 빈 배열로 | sweep EP-06′ ⑥ | — | UTF-8·폴백 입력 / 6 | 잡음 |
| R2-03 EUC-KR 경로의 bytes를 빈 배열로 | sweep EP-06′ ⑦ | — | AC17 (e)·AC18 g3 / 2 | 잡음 |
| R2-04 탐지 창 제한 제거 | sweep EP-06 ① · (f) | — | AC17 (f) / 1 | 잡음 |
| R2-05 선언 탐지·선언 디코더 단계 제거 | sweep EP-06 ② · (a)(b), 선언/UTF-8 edge | — | latin1 선언 2형·창 안 입력 / 3 | 잡음 |
| R2-06 선언 레이블의 try/catch 제거 | sweep EP-06 ③ · (c) | — | AC17 (c) / 1 | 잡음 |
| R2-07 UTF-8 fatal 제거 | sweep EP-06 ④ · (e) | — | AC17 (e)·AC18 g3 / 2 | 잡음 |
| R2-08 EUC-KR 폴백을 UTF-8로 대체 | sweep EP-06 ④ · (e), 폴백 edge | — | AC17 (e)·AC18 g3 / 2 | 잡음 |
| R2-09 탐지 창 1024 → 2048 | sweep D-015 값 | — | AC5 상수 단언 / 1 | 잡음 |
| R2-10 meta 정규식을 charset 속성형만 허용 | sweep EP-06 ② · (b) | — | http-equiv latin1 입력 / 1 | 잡음 |
| R2-11 UTF-8·EUC-KR 디코더 맞바꿈 | sweep 계약이 다른 형제 슬롯 | — | UTF-8 입력 / 4 | 잡음 |

검산: 선택 증거 N=1(V1-09) · 인용 변이 M=2(V1-04·08, 선택 증거와 중복 집계하지 않음) · 새 구조적 oracle K=0 · sweep S=11 = 표 행 14. 선택 목록·F1 인용·sweep의 ID 합집합에서 실행 ID를 뺀 차집합은 ∅이며, 잡음 14 · 못 잡음 0이다.

## [구현자 기입] Product/UX 파생 검토 — r2

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문구·상태의 소비자 | 해당 없음 — production diff 0줄 | 기존 bodySource·동기화 집계는 통합 테스트 handler에서 관측 |
| 새 실패·정리·부분 저장 경로 | 없음 — 변경 파일은 순수 테스트 하나 | Part I 전이·파싱 격리·기존 저장 순서 유지 |
| 로딩·취소·지각 응답 | 변경 없음 | 기존 메일 통합 41케이스를 다시 실행 |
| 전체 디코딩과 변환 상한 | 유지 | AC18은 바이트 전체, AC5는 앞 131,072자 변환. 둘 다 같은 파일에서 통과 |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r2

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| F1 | 작은 입력만으로 디코딩 절단을 검출하지 못함 | closed — 세 경로의 마지막 표지를 관측 | V1-04·08·09 red 1/2/1, 원복 후 22 passed |
| F2 | 큰 첨부의 디코딩 비용·메모리 | 기존 설계 유지 · 추가 변경 없음 | ΔV1의 §14가 선형 비용·무상한을 이미 기록. D-017과 충돌하는 입력 절단은 추가하지 않음 |
| G1 | 전체 테스트의 기존 비귀속 실패 | NON_BLOCKING(비귀속). 미수정 파일의 실패를 기록하고 이번 범위를 확장하지 않음 | 전 10파일/23건 · 후 10파일/23건. 공통 9파일/22건, 변경 후 전용 hostile 1건은 단독 재실행 green |

### 설계 대비 명시적 차이

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 메커니즘 대체 없음 | production diff 0줄 |
| 공유 | 해당 없음 — 새 singleton·가변 fixture 없음 | 각 it.each 행의 Buffer는 읽기만 함 |
| 재진입 | 해당 없음 — 함수·상태 변경 없음 | 기존 AC17 + 신규 AC18 11케이스 통과 |
| 다른 무효화 | 해당 없음 — 저장·캐시 변경 없음 | 변경 파일 1개, test 소스 |

## [구현자 기입] 구현 보고 — r2

| AC | 상태 | 관측 |
|---|---|---|
| AC1 | ✅ | `pure.test.ts` `(b) AC1·AC4 converts HTML when plain text is blank` |
| AC2 | ✅ | `mime.test.ts` `mail body source matrix (0302 AC2)` |
| AC3 | ✅ | `html-body.test.ts` 태그 5·escape·img·a 케이스 |
| AC4 | ✅ | `pure.test.ts` 체인 (a)·(b) |
| AC5 | ✅ | `converts only the first HTML_BODY_INPUT_LIMIT code units` |
| AC6 | ✅ | `pure.test.ts` 체인 (e)·(h) |
| AC7 | ✅ | `store/index.test.ts` `returns each stored bodySource in %s results and updates it on re-save` ×3 |
| AC8 | ✅ | `store/migrate.test.ts` `backfills body_source on an existing 0001 cache and restricts its values` |
| AC9 | ✅ | `store/migrate.test.ts` `rolls back a failing migration together with its record` |
| AC10 | ✅ | 통합 `AC10·AC12·AC13` · `AC10 counts body-less and skipped mail separately` |
| AC11 | ✅ | 통합 `AC11 a storage failure still fails the whole sync instead of skipping the mail` 및 기존 오류·취소 케이스 |
| AC12 | ✅ | 통합 `AC10·AC12·AC13`의 MATCH·LIKE·첨부 검색·출처 단언 |
| AC13 | ✅ | 같은 통합 테스트의 parse_failed·body_none warn 인자 단언 |
| AC14 | ✅ | 운영 문서의 기존 본문 출처·집계·HTML 폴백 문단 재확인 · doc-inventory green |
| AC15 | ✅ | `git diff f49b0ad -- app/package.json app/package-lock.json app/src/main/infra/net/pop3-errors.ts` 0줄 |
| AC16 | ✅ | `pure.test.ts` 첫 HTML 첨부·대문자 mimeType·plain 첨부·HTML 본문 우선 케이스 |
| AC17 | ✅ | `decodeHtmlBytes (0302 AC17)` 8케이스 · `mime.test.ts` EUC-KR 첨부 raw |
| AC18 | ✅ | `decodeHtmlBytes (0302 AC18)` g1~g3 3케이스 · V1-04·08·09 red |

검산: ✅ 18 · ⚠️ 0 · ❌ 0 = 총 18. ΔV1이 AC18을 추가해 분모가 r1의 17에서 18로 바뀌었다. 구현 좌표는 `(r2 구현 — 좌표는 INDEX)`이다.

| Gate | 관측 |
|---|---|
| 마이그레이션 가드 | core·mail sync / no-copies / `append-only ok since v0.3.1` |
| 문서 인벤토리 | generated·prose·links ok |
| 테스트 예산 | `20 real-git suites ok · all budget sites scaled` |
| lint | 0 errors · 기존 2 warnings(Timeline·useTranscriptVirtualizer) |
| typecheck | node·web·test 모두 exit 0 |
| 파일 필터 없는 vitest | 945파일: 931 passed · 10 failed · 4 skipped. 케이스: 8913 passed · 23 failed · 1 expected fail · 11 skipped, unhandled error 1건 |
| `node --test scripts/*.test.mjs` | 827 pass · 0 fail |
| 메일 범위 (전체 실행에서 추출) | 16파일 · 228 passed(변경 전 225). html-body 22 passed · 메일 실패 0 |
| 수정 테스트 소스 규칙 | 1파일: `html-body.test.ts`. unit 분류(reasons `[]`) · 새 시간/홈/프로세스/DB 자리 0 · 예산·풀 위반 0 |

비귀속. 공통 실패 9파일/22케이스와 native-resources의 unhandled rejection 1건은 이번 변경 파일과 교집합이 없다. 원인이 확인되지 않은 native/plugin 실패를 환경 오류로 단정하지 않았다.

| 파일 | 공통 실패 케이스 | 관측 |
|---|---:|---|
| `src/main/adapters/claude/adapter.native-plugins.test.ts` | 5 | 변경 전·후 같은 케이스가 실패 |
| `src/main/adapters/claude/native-resources.test.ts` | 3 | 변경 전·후 같은 케이스가 실패 |
| `src/main/adapters/claude/project-reconciliation.test.ts` | 2 | 변경 전·후 같은 케이스가 실패 |
| `src/main/adapters/opencode/v1/adapter.instances.test.ts` | 2 | 변경 전·후 같은 케이스가 실패 |
| `src/main/adapters/opencode/v1/adapter.persistent.test.ts` | 1 | 변경 전·후 같은 케이스가 실패 |
| `src/main/adapters/opencode/v1/adapter.test.ts` | 1 | 변경 전·후 같은 케이스가 실패 |
| `src/main/app/composer-catalog.test.ts` | 6 | 변경 전·후 같은 케이스가 실패 |
| `src/main/app/composer-preparation-service.test.ts` | 1 | 변경 전·후 같은 케이스가 실패 |
| `src/main/app/handlers/session-resources.claude-assembly.test.ts` | 1 | 변경 전·후 같은 케이스가 실패 |

- 변경 전 전용 실패 `adapters/common/git-root.test.ts` 1건은 변경 후 전체 실행에서 통과했다.
- 변경 후 전용 실패 `infra/test-environment.hostile.test.ts` 1건은 내부 `bootstrap.native-history.test.ts`의 `fixture:review` 명령 단언이었다. 단독 재실행은 1/1 passed(14.42s)이며 원인은 미확정이다.
- 단독 재실행 결과로 치환한 잔존 실패 집합에서 변경 전 실패 집합을 뺀 차집합은 ∅다. 원래 전체 실행의 차집합은 위 hostile 1건이며 숨기지 않았다.


## [구현자 기입] Review Signals — r2

- 라운드 2, impl 턴 `r2`. verify r1 F1을 채택한 ΔV1의 테스트 입력 3개를 구현했다.
- 같은 디코딩 길이 축을 닫았다. 이전 EP-06의 분기에는 전체 길이가 없었고 ΔV1 D-017·EP-06′·AC18이 의무를 추가했다.
- 환경 준비: SQLite ABI 140 → 현재 Node ABI 137로 `npm rebuild better-sqlite3` 후 메일 DB 경로도 실행했다. 전체 실패는 위 비귀속 목록으로 남겼다.



## [구현자 기입] 설계 리뷰 — r3

SELF_PASS — ΔV2를 그대로 구현했다. AC18의 기존 포함 단언을 AC18′의 정확 일치로 교체했으며 Decision·AC·V·§10 규범 행 변경은 없다.

| 항목 | 판정 | 근거 |
|---|---|---|
| 유효 V·작업 목록 | V1 rev.2 + ΔV1 + ΔV2 | REQUIRED VP-10″, EP-06 ①~④ + EP-06″ ⑤~⑦. VP-01은 ΔV2의 NOT_REQUIRED |
| F3의 불변식 | 디코딩 결과는 입력 전체의 문자열과 정확히 같다 | `html-body.test.ts` AC18 g1~g3에서 선언·채움·마지막 표지 전체를 `toBe`로 비교 |
| 범위 | 설계대로 테스트 1파일 | production 변경 0. 문자 인코딩·탐지 창·변환 상한·의존성 변경 없음 |

## [구현자 기입] 강제 지점 전수 (§10 대조) — r3

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-10″ | EP-06 D-015 + EP-06″ D-017 | 7자리: 탐지 창·meta 2형·레이블 생성 try·UTF-8 fatal/EUC-KR·decode 3곳 | 7/7, (a)~(f)와 g1~g3 | §10 검색 9줄·`.decode(` 3줄(55·58·60). 아래 직접 좌표 7행 | `회의`·`결재`·`Ã©/é`·전체 기대 문자열. 세 입력은 4,130/4,109/4,107바이트 | 0 |

아래 좌표의 파일은 모두 `src/main/features/plugins/mail/html-body.test.ts`이며 mock 없이 production `decodeHtmlBytes`에 들어가 반환값을 관측한다.

| 자리 | 직접 oracle 좌표(테스트명) | 관측 |
|---|---|---|
| EP-06 ① 탐지 창 | `(f) only sniffs the declaration inside the first HTML_CHARSET_SNIFF_BYTES bytes` · `converts only the first HTML_BODY_INPUT_LIMIT code units` | 창 안/밖 `Ã©/é`, 상수 1024. R2-04·09 red |
| EP-06 ② meta 2형 | `%s declaration wins over the UTF-8 fallback`의 `(a) charset attribute`·`(b) http-equiv content` | 선언 경로만 `Ã©`. R2-05·10 red |
| EP-06 ③ 레이블 생성 try | `(c) falls back to UTF-8 when the declared label is unknown` · `(a) honours <meta charset> for EUC-KR bytes` | bogus 선언은 UTF-8, 유효 선언은 EUC-KR. R2-06 red |
| EP-06 ④ UTF-8 fatal → EUC-KR | `(d) decodes undeclared valid UTF-8 as UTF-8` · `(e) decodes undeclared invalid UTF-8 as EUC-KR` | `결재/회의`. R2-07·08·11 red |
| EP-06″ ⑤ 선언 decode | `decodes the entire input through (g1) declared EUC-KR` | 선언+채움+결론 정확 일치. V1-04·V2-A-head1 red |
| EP-06″ ⑥ UTF-8 decode | `decodes the entire input through (g2) undeclared UTF-8` | 채움+결론 정확 일치. V1-08·V2-B-head1 red |
| EP-06″ ⑦ EUC-KR decode | `decodes the entire input through (g3) undeclared EUC-KR fallback` | 채움+결론 정확 일치. V1-09·V2-C-head1 red |

목록 차집합 ∅: §10 decode 목록 `{decoder, utf-8 fatal, euc-kr}`와 검색한 세 반환이 일치한다. EP-06의 기존 네 자리도 위 좌표로 관측했고 새 production 운반 자리는 없다.

### Pair 자기검증

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-10″ | REQUIRED | SELF_PASS | 위 7자리, AC17 8케이스 + AC18′ 3케이스. 파일 전체 22 passed | V1-04·08·09 + V2-A/B/C-head1 모두 red |
| VP-01 | NOT_REQUIRED | — (ΔV2 비영향) | production diff 0. 기존 통합 테스트 재실행 | 선택 없음 |

## [구현자 기입] 이번 라운드 수정의 잠금 — r3

하네스 `mutate.py`, oracle `cd app && ./node_modules/.bin/vitest run src/main/features/plugins/mail/html-body.test.ts`. 변경 전 F3 머리 누락 6행을 재현한 뒤 단언을 교체했다. 이전 verify r2 고장 이력과 r2 구현 sweep을 아래 45행으로 대응시켰다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| V1-04 ⑤ 선언 절단 2,000 | VP-10″ 등록 | 잡음 | AC18 / 1 | 잡음 |
| V1-08 ⑥ UTF-8 절단 2,000 | VP-10″ 등록 | 잡음 | AC18 / 2 | 잡음 |
| V1-09 ⑦ EUC-KR 절단 2,000 | VP-10″ 등록 | 잡음 | AC18 / 1 | 잡음 |
| V2-A-4096 ⑤ 앞 4,096바이트만 | 직전 verify 회귀 | 잡음 | AC18 / 1 | 잡음 |
| V2-A-tail1 ⑤ 꼬리 1바이트 제거 | 직전 verify 회귀 | 잡음 | AC18 / 1 | 잡음 |
| V2-A-half ⑤ 앞 절반만 | 직전 verify 회귀 | 잡음 | AC17·AC18 / 6 | 잡음 |
| V2-A-1024 ⑤ 앞 1,024바이트만 | 직전 verify 회귀 | 잡음 | AC18 / 1 | 잡음 |
| V2-A-headwin ⑤ 머리 1,024바이트 제거 | 직전 verify 회귀 | 잡음 | AC17·AC18 / 6 | 잡음 |
| V2-A-head1 ⑤ 머리 1바이트 제거 | VP-10″ 등록·F3 인용 | 못 잡음 | AC18 / 1 | 잡음 |
| V2-B-4096 ⑥ 앞 4,096바이트만 | 직전 verify 회귀 | 잡음 | AC18 / 2 | 잡음 |
| V2-B-tail1 ⑥ 꼬리 1바이트 제거 | 직전 verify 회귀 | 잡음 | AC18 / 1 | 잡음 |
| V2-B-half ⑥ 앞 절반만 | 직전 verify 회귀 | 잡음 | AC17·AC18 / 6 | 잡음 |
| V2-B-1024 ⑥ 앞 1,024바이트만 | 직전 verify 회귀 | 잡음 | AC17·AC18 / 3 | 잡음 |
| V2-B-headwin ⑥ 머리 1,024바이트 제거 | 직전 verify 회귀 | 잡음 | AC17·AC18 / 4 | 잡음 |
| V2-B-head1 ⑥ 머리 1바이트 제거 | VP-10″ 등록 | 잡음 | AC18 / 1 | 잡음 |
| V2-C-4096 ⑦ 앞 4,096바이트만 | 직전 verify 회귀 | 잡음 | AC18 / 1 | 잡음 |
| V2-C-tail1 ⑦ 꼬리 1바이트 제거 | 직전 verify 회귀 | 잡음 | AC18 / 1 | 잡음 |
| V2-C-half ⑦ 앞 절반만 | 직전 verify 회귀 | 잡음 | AC17·AC18 / 2 | 잡음 |
| V2-C-1024 ⑦ 앞 1,024바이트만 | 직전 verify 회귀 | 잡음 | AC18 / 1 | 잡음 |
| V2-C-headwin ⑦ 머리 1,024바이트 제거 | 직전 verify 회귀 | 잡음 | AC17·AC18 / 2 | 잡음 |
| V2-C-head1 ⑦ 머리 1바이트 제거 | VP-10″ 등록 | 잡음 | AC18 / 1 | 잡음 |
| P-A-head1 ⑤ 머리 1바이트 제거 | F3 인용 | 못 잡음 | AC18 / 1 | 잡음 |
| P-A-head10 ⑤ 머리 10바이트 제거 | F3 인용 | 못 잡음 | AC18 / 1 | 잡음 |
| P-A-head23 ⑤ 머리 23바이트 제거 | F3 인용 | 못 잡음 | AC18 / 1 | 잡음 |
| P-A-head24 ⑤ 머리 24바이트 제거 | F3 인용 | 못 잡음 | AC18 / 1 | 잡음 |
| P-A-head25 ⑤ 머리 25바이트 제거 | F3 인용 | 못 잡음 | AC18 / 1 | 잡음 |
| P-A-head30 ⑤ 머리 30바이트 제거 | F3 인용 | 못 잡음 | AC18 / 1 | 잡음 |
| P-A-head100 ⑤ 머리 100바이트 제거 | 직전 verify 회귀 | 잡음 | AC17·AC18 / 5 | 잡음 |
| P-A-head1000 ⑤ 머리 1000바이트 제거 | 직전 verify 회귀 | 잡음 | AC17·AC18 / 6 | 잡음 |
| P-A-head4000 ⑤ 머리 4000바이트 제거 | 직전 verify 회귀 | 잡음 | AC17·AC18 / 6 | 잡음 |
| V1-05 레이블 소문자화 | 직전 verify 동치 | 동치 | 22 passed | 동치 |
| R2-01 ⑤ bytes 빈 배열 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC17·AC18 / 6 | 잡음 |
| R2-02 ⑥ bytes 빈 배열 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC17·AC18 / 6 | 잡음 |
| R2-03 ⑦ bytes 빈 배열 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC17·AC18 / 2 | 잡음 |
| R2-04 탐지 창 제한 제거 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC17 / 1 | 잡음 |
| R2-05 선언 탐지·디코더 단계 제거 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC17 / 3 | 잡음 |
| R2-06 레이블 생성 try 제거 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC17 / 1 | 잡음 |
| R2-07 UTF-8 fatal 제거 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC17·AC18 / 2 | 잡음 |
| R2-08 EUC-KR 폴백을 UTF-8로 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC17·AC18 / 2 | 잡음 |
| R2-09 탐지 창 1024→2048 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC3·AC5 / 1 | 잡음 |
| R2-10 정규식 charset 속성형만 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC17 / 1 | 잡음 |
| R2-11 UTF-8/EUC-KR 맞바꿈 | sweep EP-06/EP-06″ | 잡음(r2 구현) | AC17 / 1 | 잡음 |
| V2-swap-fatal ⑥ UTF-8→EUC-KR | 직전 verify 형제 회귀 | 잡음 | AC17·AC18 / 4 | 잡음 |
| V2-swap-fallback ⑦ EUC-KR→UTF-8 | 직전 verify 형제 회귀 | 잡음 | AC17·AC18 / 2 | 잡음 |
| E6-09-declswap 선언 디코더를 EUC-KR 고정 | 직전 verify 회귀 | 잡음 | AC17 / 4 | 잡음 |

검산: 선택 증거 N=5 · 인용 변이 M=7(F3, V2-A-head1 중복은 여기만) · 새 구조적 oracle K=0 · sweep/직전 이력 S=33 = 표 행 45. 선택 목록·F3 인용·이전 verify 이력·sweep 목록에서 실행 목록을 뺀 차집합은 ∅다.

결과는 잡음 44 · 동치 1 · 못 잡음 0이다. V1-05는 TextDecoder 레이블의 대소문자 무시로 기존 동치이며 22 passed를 재현했다. 하네스 원복 확인 뒤 `git diff -- app/src/main/features/plugins/mail/html-body.ts`는 0줄이다.

## [구현자 기입] Product/UX 파생 검토 — r3

| 질문 | 판정 | 후속 |
|---|---|---|
| 사용자 대면 문구·상태 소비자 | 해당 없음 — 테스트 단언만 변경 | 기존 bodySource·동기화 집계는 통합 handler 테스트로 재확인 |
| 새 실패·부분 저장·정리 경로 | 없음 | production diff 0, 기존 Part I 상태표 유지 |
| 로딩·취소·늦은 응답 | 변경 없음 | 메일 통합 테스트의 기존 오류·취소 좌표 재실행 |
| 디코딩과 변환 상한 | 유지 | AC18′은 전체 디코딩, AC5는 앞 131,072자 변환. 같은 파일 22 passed |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r3

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| F3 | 끝 표지 포함만 보면 선언 경로 머리 누락을 못 잡음 | closed — 전체 기대 문자열과 정확 비교 | V2-A-head1·P-A-head10/23/24/25/30: 변경 전 green → 변경 후 red. P-A-head1도 red |
| F2 | 큰 HTML 첨부의 디코딩 비용·메모리 | 기존 설계 유지 | §14의 무상한·선형 비용 경계. production 변경 0 |
| G1 | 전체 테스트의 기존 실패 | 비귀속 · 목록은 아래 gate 표 | 변경 전후 같은 명령의 실패 집합을 비교. 수정 테스트 파일 실패 0 |

### 설계 대비 명시적 차이

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 메커니즘 대체 없음 | production diff 0 |
| 공유 | 해당 없음 — 공용 setup·헬퍼·가변 fixture 추가 없음 | 각 it.each 행의 Buffer는 읽기만 함 |
| 재진입 | 해당 없음 — 함수·상태 변경 없음 | AC17 8 + AC18′ 3케이스 통과 |
| 다른 무효화 | 해당 없음 — 저장·캐시 변경 없음 | 테스트 파일 1개만 변경 |

## [구현자 기입] 구현 보고 — r3

| AC | 상태 | 관측 |
|---|---|---|
| AC1 | ✅ | `pure.test.ts` `(b) AC1·AC4 converts HTML when plain text is blank` |
| AC2 | ✅ | `mime.test.ts` `mail body source matrix (0302 AC2)` |
| AC3 | ✅ | `html-body.test.ts` 태그 5·escape·img·a 케이스 |
| AC4 | ✅ | `pure.test.ts` 체인 (a)·(b) |
| AC5 | ✅ | `html-body.test.ts` `converts only the first HTML_BODY_INPUT_LIMIT code units` |
| AC6 | ✅ | `pure.test.ts` 체인 (e)·(h) |
| AC7 | ✅ | `store/index.test.ts` `returns each stored bodySource in %s results and updates it on re-save` ×3 |
| AC8 | ✅ | `store/migrate.test.ts` `backfills body_source on an existing 0001 cache and restricts its values` |
| AC9 | ✅ | `store/migrate.test.ts` `rolls back a failing migration together with its record` |
| AC10 | ✅ | 통합 `AC10·AC12·AC13` · `AC10 counts body-less and skipped mail separately` |
| AC11 | ✅ | 통합 `AC11 a storage failure still fails the whole sync instead of skipping the mail` 및 기존 오류·취소 케이스 |
| AC12 | ✅ | 통합 `AC10·AC12·AC13`의 MATCH·LIKE·첨부 검색·출처 단언 |
| AC13 | ✅ | 같은 통합 테스트의 parse_failed·body_none warn 인자 단언 |
| AC14 | ✅ | `persistence.md:166` · `closed-network-extensions.md:1099` 본문 출처·HTML 폴백·집계. doc-inventory green |
| AC15 | ✅ | `git diff f49b0ad -- app/package.json app/package-lock.json app/src/main/infra/net/pop3-errors.ts` 0줄 |
| AC16 | ✅ | `pure.test.ts` 첫 HTML 첨부·대문자 mimeType·plain 첨부·HTML 본문 우선 케이스 |
| AC17 | ✅ | `decodeHtmlBytes (0302 AC17)` 8케이스 · `mime.test.ts` EUC-KR 첨부 raw |
| AC18′ | ✅ | `decodeHtmlBytes (0302 AC18)` g1~g3 정확 일치. 등록 6변이 전부 red |

검산: ✅ 18 · ⚠️ 0 · ❌ 0 = 총 18. AC18을 AC18′로 대체해 분모는 18로 유지했다. 구현 좌표는 `(r3 구현 — 좌표는 INDEX)`이다.

| Gate | 관측 |
|---|---|
| 마이그레이션 가드 | core·mail sync / no-copies / append-only ok since v0.3.1. 릴리스 태그를 확보한 뒤 재실행 |
| 문서 인벤토리 | generated·prose·links ok |
| 테스트 예산 | `20 real-git suites ok · all budget sites scaled` |
| lint | 0 errors · 기존 2 warnings(Timeline·useTranscriptVirtualizer) |
| typecheck | node·web·test exit 0 |
| 파일 필터 없는 vitest | 945파일: 931 passed · 10 failed · 4 skipped. 케이스: 8913 passed · 23 failed · 1 expected fail · 11 skipped, unhandled error 1건 |
| `node --test scripts/*.test.mjs` | 827 pass · 0 fail |
| 메일 범위(전체 실행에서 추출) | 16파일 · 228 passed. html-body 22 · 통합 41 · store/index 36 |
| 수정 테스트 소스 규칙 | `git diff --name-only`에서 `html-body.test.ts` 1파일. unit(reasons `[]`), 시간·홈·exe·DB 자리 추가 없음. 예산·풀 위반 0 |

비귀속. 변경 전 9파일/22케이스와 변경 후의 공통 실패 집합은 같다. 이번 변경 테스트의 실패는 0이며, 실패 원인이 미확정인 native/plugin 계열을 환경 오류로 단정하지 않았다.

| 파일 | 변경 전·후 공통 실패 | 서명 |
|---|---|---|
| `src/main/adapters/claude/adapter.native-plugins.test.ts` | 5 | native plugin 상태·프로젝트 제어 기대 불일치 |
| `src/main/adapters/claude/native-resources.test.ts` | 3 | native plugin 상태·프로젝트 제어 기대 불일치 |
| `src/main/adapters/claude/project-reconciliation.test.ts` | 2 | native plugin 상태·프로젝트 제어 기대 불일치 |
| `src/main/adapters/opencode/v1/adapter.instances.test.ts` | 2 | Windows C:/ 경로 기대와 Linux 절대경로 차이 |
| `src/main/adapters/opencode/v1/adapter.persistent.test.ts` | 1 | C:/ 경로가 현재 디렉터리 아래 경로로 해석됨 |
| `src/main/adapters/opencode/v1/adapter.test.ts` | 1 | C:/ 경로가 현재 디렉터리 아래 경로로 해석됨 |
| `src/main/app/composer-catalog.test.ts` | 6 | plugins 결과 상태 기대 불일치 |
| `src/main/app/composer-preparation-service.test.ts` | 1 | Composer directory must be absolute |
| `src/main/app/handlers/session-resources.claude-assembly.test.ts` | 1 | native plugin 상태·프로젝트 제어 기대 불일치 |

- 원래 전체 실행의 추가 실패는 `infra/test-environment.hostile.test.ts` 1건이다. 단독 재실행은 1/1 passed(12.14s)이며, 전체 실행 결과에서 숨기지 않았다.
- 그 단독 재실행으로 치환한 잔존 실패 집합에서 변경 전 실패 집합을 뺀 차집합은 ∅다. 변경 전에는 없고 원래 전체 실행에만 있던 차집합은 위 hostile 1건이다.
- 변경 전후 모두 `native-resources.test.ts`에서 unhandled rejection 1건(`이 플러그인은 프로젝트별 제어를 지원하지 않습니다`)이 남는다. 이번 diff와 해당 파일의 교집합은 없다.


## [구현자 기입] Review Signals — r3

- 라운드 3, impl 턴 `r3`. 사용자 요청으로 Codex가 READY ΔV2의 테스트 단언 교체를 수행했다.
- 같은 디코딩 완전성 축이다. 기존 포함 단언에서 관측하지 않던 입력 앞부분을 AC18′·EP-06″의 정확 일치로 잠갔다.
- 환경 준비: 샌드박스 로컬 소켓 EPERM과 SQLite ABI 140→137을 확인했다. 소켓 테스트는 샌드박스 밖, SQLite는 기존 의존성 재빌드 후 실행했다.


## [검증자 기입] 파생 이슈

### verify r2 (2회째, 창 안)

| # | finding | 분류 | disposition | 설계자 선택지 |
|---|---|---|---|---|
| F3 | `decodeHtmlBytes` 선언 경로(`html-body.ts:55`)가 입력 앞 N≤30바이트를 빠뜨려도 green(`decode(bytes.subarray(N))` N=1~30 7행 `못 잡음`, N≥100은 AC17이 잡음) — g1 표지가 입력 맨 끝에만 있음 | 확장 후보(V1-04·08·09 밖) | `PLAN_GAP`(창 안) | (a) 채택: g1 입력 맨 앞에도 표지 + (g)를 앞·뒤 보존으로 (b) 경계 선언: 머리 수십 바이트 누락은 잠그지 않음 — 구현 턴 없이 verify 3회째 |
| F2 | 거대 첨부 디코딩 비용 | 비귀속 | `NON_BLOCKING` | §14에 기록됨 |

상세 `verify.md` r2. 이행·현재 결함 0, gate green(전체 vitest 29파일/22케이스는 Electron 미설치 기준선).
