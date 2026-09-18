# Plan — 0237-pop3-mail-search-plugin

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장 규칙은 [`§산출물 문장 규칙`](../AGENTS.md) — 판정 먼저, 주장 한 줄에 관측 하나, 표 한 칸 3줄, 문단 3문장.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0237-pop3-mail-search-plugin` |
| 작성자 | Claude Code |
| 일자 | 2026-09-18 |
| 매핑 | 없음 (신규 제품 기능) |
| 상태 | READY — r1 PLAN_GAP(G1·G2·G3) 3건을 규범 행으로 정정 완료 |
| V mode | `Delta V` (기준 `V1`) |
| 기준 V | `V1` — 본 plan의 Baseline, commit `07ec3a6`~`e252c6b` |
| 이번 V revision | `ΔV1` |
| 유효 V | `V1 + ΔV1` |

입력 제안서: 사용자 업로드 `orcinus-orca-pop3-mail-search-plugin-proposal.md` (22절). 본 plan은 그 제안서를 **진단하고 보완한 결과**이며, 제안서 문장과 어긋나는 곳은 §3 Decision Ledger와 §4에 판정과 근거를 남겼다.

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: Orca 사용자가 사내 POP3 메일함의 내용을 대화에서 찾을 수 없다. 지금은 메일을 직접 열어 검색한 뒤 내용을 대화창에 붙여 넣어야 한다.
- 완료 후 달라지는 것: 인증된 메일 계정이 있으면 모델이 `mail_sync` → `mail_search`로 최근 14일 메일을 찾아 답하고, 첨부는 요청 시 `mail_getAttachment`로 받는다.
- 성공을 사용자 관점에서 한 문장으로: **"지난주 회의 일정 메일 찾아줘"라고 말하면 모델이 최신화된 로컬 캐시에서 찾아 발신자·날짜·제목·발췌로 답한다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "Pop3 메일서버 클라이언트를 플러그인으로 재공할 것이다" | 사용자 턴 (2026-09-18) |
| 명시 요구 | "제안 내용이 타당한 검토인지 진단하고 보완하여 plan을 작성하라" | 같은 턴 — §4가 그 진단이다 |
| 명시 요구 | 제안서 §1 요구사항 표 18행 (POP3 · SQLite+FTS5 · 14일 · 10,000통 · UIDL · TOP · 5분 · Logical TTL · polling 없음 · 공개 도구 · 검색 대상 · 별도 서버 없음 · 캐시 주체 · 첨부 경로 · Card UI · Orca Core 역할) | 업로드 제안서 |
| 명시 요구 | 구현 레지스터 = **레시피 C(앱 내 Plugin 슬라이스)** | 사용자 턴 (2026-09-18, 질의 응답 ①) |
| 명시 요구 | 전송·인증 경계를 **명시적으로 확장** | 사용자 턴 (질의 응답 ②) |
| 명시 요구 | POP3·MIME **라이브러리 도입 승인** | 사용자 턴 (질의 응답 ③) |
| 명시 요구 | 공개 도구 **세 번째 추가** (`mail_getAttachment`) | 사용자 턴 (질의 응답 ④) |
| 명시 요구 | 인증 거부 시 **"3도구 전부 회수"** | 사용자 턴 (ΔV1 질의 ①) |
| 명시 요구 | 첨부 식별자는 **"검색 결과 + 단건"** | 사용자 턴 (ΔV1 질의 ②) |
| 명시 요구 | "2번 질문에서 단건 확정 아직 아니다. 3개 첨부가 있을시, 3개를 어떻게 받을 수 있는건사?" → 승인 3회 비용을 제시한 뒤 **"단건 전용 유지"** | 사용자 턴 (ΔV1 질의 ③) |
| 추론 의도 | 사내 폐쇄망 배포가 opt-in 대상이다 — 기본 OSS 배포의 `createPluginBindings`는 `[]`를 유지한다 | 추론. 근거: `app/src/main/app/deployment/plugins.ts:83` 주석 "기본 배포는 Plugin 이 없다" |
| 추론 의도 | 검색 언어는 한국어가 1순위다 | 추론. 근거: `settings.language` 기본값 `'한국어'` (`docs/arch/backend/persistence.md §1.2`) |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 메일 프로토콜은 POP3다 | 제안서 §1 "메일 프로토콜 \| POP3" | 제안서 | ACTIVE | — |
| D-002 | 구현 레지스터는 레시피 C — `features/plugins/mail/` 수직 슬라이스 + `app/deployment/plugins.ts` 등록 | 사용자가 3지선다에서 선택 | 사용자 턴 | ACTIVE | — |
| D-003 | 검색 저장소는 SQLite + FTS5다. MiniSearch·Meilisearch·Elasticsearch·OpenSearch를 쓰지 않는다 | 제안서 §5 "SQLite 자체가 이미 전문 검색 엔진인 FTS5를 제공" | 제안서 | ACTIVE | — |
| D-004 | 보관 범위는 항상 최근 14일이다. 삭제 기준은 14일 Retention **뿐**이다 | 제안서 §20 "삭제 기준은 14일 Retention뿐이다" | 제안서 | ACTIVE | — |
| D-005 | 10,000통은 Hard Limit이 아니라 **설계·성능시험 규모**다 | 제안서 §1 "10,000통 \| 삭제 기준이 아닌 설계 규모" | 제안서 | ACTIVE | — |
| D-006 | 증분 동기화 기준은 UIDL이다 | 제안서 §8 | 제안서 | ACTIVE | — |
| D-007 | TOP으로 헤더를 먼저 보고 14일 밖 메일의 RETR을 생략한다 | 제안서 §9 "과거 전체 메일 본문을 다운로드하지 않고" | 제안서 | ACTIVE | — |
| D-008 | Cache Freshness Threshold는 5분이다 | 제안서 §7 | 제안서 | ACTIVE | — |
| D-009 | Retention은 Logical TTL + Lazy Cleanup이다. **별도 Background Scheduler를 쓰지 않고** 상시 polling도 하지 않는다 | 제안서 §10 "별도의 Background Scheduler는 사용하지 않는다" | 제안서 | ACTIVE | — |
| D-010 | 검색 대상은 From·To·Cc·Subject·Body Text다 | 제안서 §19 "기본 검색 대상은" | 제안서 | ACTIVE | — |
| D-011 | Mail Plugin은 자기 SQLite DB를 소유한다. **기존 `orcinus-orca.db`에 Mail 테이블을 추가하지 않는다** | 제안서 §4 — 설치·삭제·마이그레이션·장애 범위를 Core와 분리하려는 조건절 | 제안서 | ACTIVE | — |
| D-012 | 첨부는 플러그인 내부 원본 경로를 노출하지 않고 Orca Temp 복사본만 제공한다. **원본은 이동하거나 수정하지 않는다** | 제안서 §19 "Internal Path → Temp Copy → Card UI" | 제안서 | ACTIVE | — |
| D-013 | ~~모델 공개 도구는 `mail_sync`·`mail_search` 2개다~~ | 제안서 §1·§6. §19 첨부 흐름이 세 번째 도구 없이는 실행 불가 (§4 진단 ⑥) | 제안서 | **SUPERSEDED** | D-014 |
| D-014 | 모델 공개 도구는 `mail_sync`·`mail_search`·`mail_getAttachment` **3개**다 | 사용자가 "세 번째 도구 추가"를 선택. Jira `jira_downloadAttachment` 선례와 같은 형상 | 사용자 턴 | ACTIVE | D-013 대체 |
| D-015 | `mail_search`는 POP3 서버와 통신하지 않는다 | 제안서 §6 "중요한 원칙" | 제안서 | ACTIVE | — |
| D-016 | 동일 계정의 동시 `mail_sync`는 하나의 POP3 sync 결과를 공유한다 | 제안서 §16 | 제안서 | ACTIVE | — |
| D-017 | 메일 시각은 `headerDate` 우선, 불가 시 `firstSeenAt` fallback이다 | 제안서 §17 — POP3에 `INTERNALDATE` 없음 | 제안서 | ACTIVE | — |
| D-018 | 비정상 UIDL 변경·대규모 소실은 즉시 대량 삭제하지 않고 보호 상태로 처리한다 | 제안서 §18 | 제안서 | ACTIVE | — |
| D-019 | ~~Sync가 실패해도 기존 Cache가 있으면 검색을 허용하고 stale 상태를 모델에 전달한다~~ | 제안서 §12. 실패 범위가 열려 있어 인증 거부까지 포함되면 AC14·AC28의 도구 회수와 양립하지 않는다 (r1 G2) | 제안서 | **SUPERSEDED** | D-045 |
| D-020 | 첨부 내용은 FTS 인덱스의 기본 검색 대상이 아니다 | 제안서 §19 | 제안서 | ACTIVE | — |
| D-021 | POP3 소켓 전송을 **명시적 경계 확장**으로 도입한다 — `infra/net/`에 전용 모듈을 신설하고 `security.md §1.8` 표에 예외로 등재한다 | 사용자가 "경계를 명시적으로 확장"을 선택. 근거: §8 조사 F-02·F-03 | 사용자 턴 | ACTIVE | — |
| D-022 | Mail Plugin은 raw credential을 읽는 **세 번째 소비자**가 된다. 주입은 컴포지션 루트가 하고 `AuthSecretReader` 자체는 feature에 넘기지 않는다 | D-021의 귀결. 현재 소비자는 `bootstrap.ts:385`·`:526` 2곳뿐 (§8 F-05) | 설계자 + 사용자 승인(②) | ACTIVE | — |
| D-023 | POP3·MIME 라이브러리를 도입한다 — `node-pop3`(POP3) + `postal-mime`(MIME) | 사용자가 "라이브러리 도입 승인"을 선택. 후보 비교는 §8 F-10 | 사용자 턴 | ACTIVE | — |
| D-024 | 메일 FTS5 tokenizer는 `trigram`이다. `messages_fts`의 `unicode61`을 따르지 않는다 | 설계자 결정. 근거: `unicode61`은 한국어 어절 중간 매치가 **0건**, `trigram`은 3글자 이상 MATCH·2글자 LIKE로 매치 (§8 F-07 실측) | 설계자 | ACTIVE | — |
| D-025 | 연결은 **implicit TLS(기본 995)** 를 요구한다. STARTTLS(`STLS`) 승격은 이번 범위가 아니다 | `node-pop3@0.15.3` 소스에 `STLS` 문자열 0건 (§8 F-11). 평문 110 포트는 선언으로만 허용하고 기본값이 아니다 | 설계자 | ACTIVE | — |
| D-026 | 최초 sync는 **최신 메시지 번호부터 역순**으로 TOP을 돌고 14일 경계 + 유예창을 넘으면 중단한다. 전체 메일에 TOP을 돌지 않는다 | 설계자 결정. 제안서 §9는 "최초 Sync → 신규 UIDL → TOP"이라고만 적어 10,000통 전건 TOP을 함의한다 (§4 진단 ⑨) | 설계자 | ACTIVE | — |
| D-027 | 첨부의 **Artifact Card UI는 이번 범위가 아니다.** `mail_getAttachment`는 Jira 선례와 같이 Temp 경로만 돌려주고, 카드화는 모델이 게시 도구를 부를 때만 일어난다 | `ArtifactRef['kind']`에 office/pdf가 없고(`shared/artifacts.ts:7`) 자동 수집은 temp 루트 **바로 아래 + Work 에이전트** 한정 (§4 진단 ⑦) | 설계자 | ACTIVE | — |
| D-028 | `mail_sync`·`mail_getAttachment`는 `readOnlyHint: false`, `mail_search`는 `readOnlyHint: true`다 | `runtime-tool-policy.ts:19` — `readOnlyHint !== true`면 승인 대상. 원격 I/O와 디스크 쓰기를 자동 통과시키지 않는다 | 설계자 | ACTIVE | — |
| D-029 | Timeout 기본값을 plan이 확정한다 — 연결 15s · 명령 30s · sync 전체 예산 120s | 제안서 §12는 "실제 서버 환경 측정 후 결정"이라 구현자가 정할 수 없다 (§4 진단 ⑪). 값은 설정으로 덮을 수 있다 | 설계자 | ACTIVE | — |
| D-030 | 기본 OSS 배포의 `createPluginBindings()`는 계속 `[]`를 돌려준다. Mail Plugin은 폐쇄망 배포가 typed recipe로 opt-in한다 | Jira·Confluence와 같은 처리 (`docs/arch/backend/auth.md §7`) | 설계자 | ACTIVE | — |
| D-031 | POP3 `DELE`를 **절대 보내지 않는다.** 서버 메일함은 읽기 전용으로 다룬다 | 설계자 결정. 제안서에 없는 축이며 되돌릴 수 없는 파괴적 부작용이다 | 설계자 | ACTIVE | — |
| D-032 | Mail Auth는 **`probe`를 선언하지 않는 것이 정상 경로**다. 자격증명 검증은 **첫 `mail_sync`**가 한다 | `probe`는 gate에서만 필수이고(`GateAuthDefinition` 타입 강제) Plugin Auth는 `probe?` optional이다. POP3-only 서버에는 probe가 칠 HTTP endpoint가 아예 없다. **D-037(lazy 전이 정책)이 이 선택의 근거다** — 선제 검증을 두지 않는 것이 정책이다 | 설계자 | ACTIVE | — |
| D-033 | `iso-2022-kr` 메일은 **미지원으로 남긴다.** `mailparser` 폴백을 두지 않는다 | 사용자 결정 — "mailparser 폴백 필요없음. iso-2022-kr 은 미지원으로 남겨두겠음" | 사용자 턴 | ACTIVE | — |
| D-034 | Mail Auth를 **`GATE_AUTH_DEFINITIONS`에 넣지 않는다.** 앱 로그인 게이트와 무관하다 | 사용자 결정 — "pop3 메일서버는 앱 로그인시 체인으로 안해도 된다. Sso 인증이 아니기때문. 토큰 계열도 안해도 된다". Confluence·Jira도 게이트 멤버가 아니다(F-21) | 사용자 턴 | ACTIVE | — |
| D-035 | POP3 인증 거부를 **Auth 강등으로 되먹인다** — `createAuthRuntime` 결과에 좁은 reporter를 더하고 컴포지션 루트가 `authId`를 닫아 Mail Plugin에 준다 | 강등 경로가 HTTP status·probe 둘뿐이라 POP3는 어느 쪽도 안 탄다(F-24). **D-037의 lazy 전이를 POP3에서 성립시키는 유일한 지점**이다 — 관측 자리가 없으면 lazy 전이도 일어나지 않는다. reporter는 이름·시그니처를 Plugin 일반으로 두되 지금 배선하는 소비자는 mail 하나다(rule of three) | 설계자 | ACTIVE | — |
| D-036 | Mail Auth는 **`sessionGroup`을 공유하지 않는다.** ADFS SSO로 메일이 자동 인증되지 않고 사용자가 비밀번호를 따로 입력한다 | POP3에는 쿠키가 없어 cookie jar 공유가 성립하지 않는다. `methods[0]`이 입력형이라 자동 재로그인 대상에서도 제외된다(F-23) — 규칙과 일치한다 | 설계자 | ACTIVE | — |
| D-037 | **운영 중 인증 상태는 사용 시점 lazy 전이다.** 도구 호출·(있다면) 주기 실행이 실패를 관측한 자리에서 만료·미인증으로 내린다. 주기 검증·polling을 만들지 않는다. **연결 버튼을 누른 순간은 예외로, 그때는 즉시 증명한다**(D-040) — 사용자가 결과를 기다리는 자리다 | 사용자 결정 — "모든 플러그인은 내부동작(주기적 실행 등), 도구 호출 등이 이루어질때, 실패시 만료, 미인증, 인증 해제 등으로 lazy하게 바뀌어도 된다". `auth.md §4.4`의 "`settleExpiry()` 가 snapshot·request·resume 이 이미 지나는 자리에서 그 전이를 한 번 확정하고 **polling 을 새로 만들지 않는다**"와 같은 방향이다 | 사용자 턴 | ACTIVE | — |
| D-038 | lazy 전이는 **강등(`expired`·`unauthorized`)까지만** 한다. 실패가 `revoke`(자격증명 삭제)를 부르지 않는다 | `auth.md §11` "해제는 fail-closed, 추가·교체는 degrade-open" — 방향이 다르다. 오타·일시 장애 한 번이 보관된 비밀번호를 지우면 사용자가 되돌릴 수 없다. 해제는 사용자가 연결 탭에서 직접 한다 | 설계자 | ACTIVE | — |
| D-039 | POP3 인증은 **`USER`/`PASS`(ID·비밀번호)만 지원한다.** SASL 토큰 인증(`AUTH XOAUTH2` 등)은 **한계로 기록하고 홀드**한다 | 사용자 결정 — "id passwd만 지원하고 나머지 인증 방식에 대해서는 한계점으로 남겨두고 홀드하라". `node-pop3@0.15.3`이 `_connect()`에 `USER`/`PASS`를 하드코딩해 SASL 경로가 없다(F-26) — 채택 라이브러리와 범위가 일치한다 | 사용자 턴 | ACTIVE | — |
| D-040 | **연결 버튼은 실제 POP3 로그인 왕복으로 증명한다.** `LoginDeps`에 authId별 optional verifier를 더하고 컴포지션 루트가 mail에만 주입한다. 검증은 **candidate**(커밋 전 자격증명)로 하고 실패하면 커밋하지 않는다 | `login.ts:499`가 `probe` 미선언을 무조건 통과시켜 값 입력만으로 `valid`가 된다(F-06b). seam은 이미 있다 — `LoginDeps.request`가 authId별 주입 함수이고 `candidate`를 받으며 커밋은 probe 뒤다(`login.ts:143`) | 설계자 | ACTIVE | — |
| D-041 | 입력형의 **거부 메시지를 파라미터화**한다. verifier가 `rejected`(거부)와 `unreachable`(도달 실패)을 구분해 돌려주고 `input-required` step이 그에 맞는 문구를 싣는다 | `login.ts:716`이 `'자격증명이 거부되었습니다. 값을 확인해 주세요.'` **고정 문자열**이라 두 경우가 같은 화면이 된다(F-27). 서버에 못 닿은 것을 비밀번호 탓으로 읽으면 사용자가 맞는 값을 계속 다시 넣는다 | 설계자 | ACTIVE | — |
| D-042 | verifier는 **`candidate`가 있을 때만** 돈다 — 즉 `login`/`reauth`에서만 돌고 **부팅 `resume()`에서는 돌지 않는다** | `probe()` 호출부는 2곳뿐이고 `resume()`은 candidate 없이(`login.ts:336`), login settle은 candidate와 함께(`:567`) 부른다 — 유무가 그대로 판별자다(F-28). 부팅마다 POP3를 여는 것은 D-037이 금지한 선제 검증이다 | 설계자 | ACTIVE | — |
| D-043 | **`mail_search` 결과가 첨부 매니페스트를 싣는다** — hit마다 `attachmentCount`와 `attachments:[{attachmentId, filename, mimeType, sizeBytes}]`. `attachmentId`는 `attachment.id`(불투명 PK)이고 `stored_name`·경로가 아니다. `hasAttachments` boolean은 **제거한다** — `attachmentCount`에서 파생된다 | 사용자가 "검색 결과 + 단건"을 선택. r1 G1 — `mail_getAttachment`가 요구하는 `attachmentId`의 producer가 plan 어디에도 없어 §5 첨부 흐름의 진입점이 끊겨 있었다 | 사용자 턴 | ACTIVE | — |
| D-044 | **`mail_getAttachment`는 단건 전용이다** — `mailId`·`attachmentId` 둘 다 필수다. Jira의 합집합 selector(`issueKey` XOR `attachmentId`)와 `filename` 필터를 **복제하지 않는다**. 첨부 N개 = 호출 N회 = 승인 N회 | 사용자 결정 — 승인 3회·staging 3배치라는 비용을 제시한 뒤 "단건 전용 유지". 입력·결과 형상이 가장 좁고 AC10·AC12가 단순해진다 | 사용자 턴 | ACTIVE | — |
| D-045 | **D-019의 "Sync 실패"는 비인증 장애로 한정한다** — 연결·TLS·타임아웃·파싱·DB 오류 5종이다. 이때 Auth는 `valid`로 남고 캐시 검색이 계속된다. **자격증명 거부는 Auth 강등이며 도구 3종이 전부 회수되어 캐시 검색도 불가능해진다** | 사용자가 "3도구 전부 회수"를 선택. `createPluginBinding.sync()`가 서버를 통째로 add/remove하고(`plugins.ts:57-68`) `plugins.test.ts:69-71`이 "valid 만 등록 이 곧 나머지 셋은 전부 회수"를 주석으로 적고 `none`·`expired`·`unknown` 3케이스로 잠갔다. 서버를 둘로 쪼개는 우회는 `duplicateConnectionAuthIds`(0188 D-029)가 한 authId 두 row로 진단한다 | 사용자 턴 | ACTIVE | D-019 대체 |
| D-046 | **일반 UIDL 소실은 본문을 삭제하지 않는다.** ledger state를 `missing`으로 표시만 하고 행·FTS·첨부는 retention이 지울 때까지 남는다 — **서버에서 지운 메일이 최대 14일간 검색에 계속 뜬다** | D-004("삭제 기준은 14일 Retention**뿐**")의 직접 귀결이다. r1 G3이 "일반 UIDL 소실의 본문 삭제 여부"를 물었고, ACTIVE 결정이 답을 강제한다 — 재해석하지 않는다 | 설계자 (D-004 귀결) | ACTIVE | — |
| D-047 | **보호 상태가 막는 것은 삭제가 아니라 대량 재수집이다.** D-046 아래 `removed:0`은 모든 경로에서 참이라 판별자가 아니다. 보호 중에는 신규 UIDL을 **수집하지 않는다**(RETR 0회). 임계 `retainedRatio < 0.5` · 최소 표본 `활성 ledger >= 20` · 해제는 ①비율 회복 또는 ②같은 `remoteFingerprint` **2회 연속** 관측 시 채택이다 | r1 G3 — D-018은 "대량 삭제하지 않는다"만 말해 D-004 아래 공허했다. 임계·표본·해제는 정책 파라미터라 설계자가 확정한다. 해제를 사용자 조작에 맡기면 renderer 화면이 비범위(§6)여서 탈출구가 없다. **D-018을 대체하지 않고 그 위에 메커니즘을 얹는다** — D-018은 ACTIVE로 남는다 | 설계자 | ACTIVE | — |
| D-048 | **`PluginDeploymentDeps` 공개 계약은 `auth`, `registry`, 선택적 `logger`만 유지한다.** `mail`, raw secret reader, POP3 socket, credential rejection reporter 같은 Mail 전용 필드를 추가하지 않는다 | 사용자 정정 — 폐쇄망 배포자는 `features/plugins` 구현을 바탕으로 `app/deployment`에 플러그인을 추가하며, Confluence/Jira가 사용하는 기존 factory 포맷이 배포 계약이다. r2가 이 타입을 확장해 계약을 깨뜨렸다 | 사용자 턴 | ACTIVE | D-030·r2 배선 대체 |
| D-049 | **현재 폐쇄망 factory 계약에는 POP3 Mail을 억지로 배선하지 않는다.** `BoundAuth.request`는 HTTP 요청 capability이고 POP3는 raw TCP/TLS와 별도 자격증명 capability가 필요하므로, Mail 전용 배포는 새 공개 계약을 별도 설계·승인한 뒤 진행한다 | 사용자 정정과 현재 auth 경계의 결합 — 일반 plugin dependency에 raw secret을 넣거나 Auth core를 POP3에 결합하지 않는다. 이번 라운드는 기존 배포 계약 복구와 Mail 레시피의 보류 상태 명시까지로 한정한다 | 사용자 턴 + 현재 계약 검토 | ACTIVE | D-021·D-022·D-035·D-040의 r2 배선 범위 대체 |

### 갱신 메모

- **ΔV2 (사용자 정정 r3)**: r2 구현이 `PluginDeploymentDeps`에 `mail`·`credentialRejectionReporter`를 추가하고 bootstrap에서 raw secret/POP3 capability를 주입해 폐쇄망 배포 계약을 변경한 사실을 확인했다. D-048로 기존 factory 포맷을 복구하고, D-049에 따라 POP3 Mail은 별도 capability contract가 설계될 때까지 현재 `createPluginBindings` 경로에 배선하지 않는다. 이번 구현의 필수 회귀는 `deployment-wiring` 계약 테스트·정적 타입 검사·가이드 레시피와의 일치다.

- **ΔV1 (이번 턴) — r1 PLAN_GAP 3건 정정**: G1 → D-043·D-044(사용자) · G2 → D-045(사용자, D-019 대체) · G3 → D-046·D-047(설계자, D-004 귀결 + 정책 파라미터).
- **G3를 사용자에게 올리지 않은 이유**: D-004("삭제 기준은 14일 Retention**뿐**")가 ACTIVE라 "일반 UIDL 소실의 본문 삭제 여부"의 답이 하나로 강제된다 — 두 해석이 서지 않으므로 질의 대상이 아니다. 임계·표본·해제는 정책 파라미터(스킬 §6)라 설계자 몫이다.
- **D-046이 만드는 사용자 관측**: 서버에서 지운 메일이 최대 14일간 검색에 남는다. D-004의 직접 귀결이며 재해석하지 않았다 — §5 상태 전이표에 행으로 노출했다.
- 이번 턴에서 새로 추가된 결정: D-014(사용자) · D-021·D-022·D-023(사용자 승인) · D-024~D-031(설계자).
- 후속 턴 추가: D-032(설계자) · D-033·D-034·D-037·D-039(사용자) · D-035·D-036·D-038·D-040·D-041·D-042(설계자).
- 인프라 재감사(이번 턴): F-27~F-32로 6가지 가정을 다시 쳤다 — 성립 3(F-28·F-29·F-30 렌더러·seam·spec) · 코드 변경 필요 2(F-27 고정 문구 · F-31 context 부재) · 주장 정정 1(F-32 `structuredContent` 소비처 0).
- 변경된 결정: **D-013 → D-014** — 제안서의 "공개 도구 2개"를 사용자가 3개로 변경했다. 제안서 §19 첨부 흐름이 도구 없이는 도달 불가라는 진단에 대한 응답이다.
- 변경된 결정: **D-019 → D-045** — 사용자가 "3도구 전부 회수"를 선택해 실패 범위를 비인증 장애 5종으로 좁혔다. 결정 변경이지 구현 실패가 아니다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-001·D-003~D-012·D-015~D-020 (제안서 §1 요구사항 표 전부). 최신 턴이 다시 말하지 않았다는 이유로 지우지 않는다.
- **`ACTIVE 결정 ↔ AC` 대조 (ΔV1 재실행)**: 충돌 0. 신규·변경 결정에 대해 대조한 쌍 — D-043("매니페스트를 싣는다") ↔ AC11(정정본: `attachments[]` 양성 단언 + 내부 루트·`stored_name` 부재) → 일치. D-044("단건 전용") ↔ AC32(`mailId`·`attachmentId` 중 하나만 주면 스키마가 거부) → 일치, 합집합 selector AC 없음. D-045("인증 거부 시 3도구 전부 회수") ↔ AC28(정정본: registry snapshot에 mail 서버 0개) ∧ AC5(정정본: 비인증 5종에 한정) → 일치, "인증 거부 후에도 검색된다"를 요구하는 AC 없음. D-046("본문 삭제 없음") ↔ AC25(정정본: `missing` 표시 후 mail 행 수 불변) → 일치. D-047("보호는 재수집을 막는다") ↔ AC25·AC33(RETR 호출 횟수가 판별자, `removed:0`은 D-004 회귀로만 유지) → 일치.
- **`ACTIVE 결정 ↔ AC` 대조 (V1)**: 충돌 0. 대조한 쌍 — D-004("삭제 기준은 14일 Retention뿐") ↔ AC8(만료 3저장소 동시 제거) → 일치, 10,000통 상한 AC 없음. D-009("Background Scheduler 사용 안 함") ↔ AC9(`mail_sync` 진입에서만 cleanup · `scheduler` 등록 0건) → 일치, `features/scheduler` 등록 AC 없음. D-011("`orcinus-orca.db`에 Mail 테이블 추가 안 함") ↔ AC18(Core 마이그레이션 27건 불변) → 일치. D-012("원본은 이동·수정하지 않는다") ↔ AC12(`mail_getAttachment` 후 내부 원본 mtime·크기 불변) → 일치. D-015("`mail_search`는 통신 안 함") ↔ AC4(소켓 팩토리 호출 0회) → 일치. D-031("`DELE` 금지") ↔ AC26(명령 화이트리스트에 `DELE` 부재 + 허용 6명령 양성 단언) → 일치. D-037("lazy하게 바뀌어도 된다") ↔ AC28(도구 호출이 실패를 관측한 자리에서 강등) → 일치, 주기 검증 AC 없음(AC9의 슬라이스 전수 스윕이 부재를 잠근다). D-038("`revoke` 하지 않는다") ↔ AC28(단언은 `registry.remove`·reporter 호출이며 `revoke` 호출을 요구하지 않는다) → 일치.

## 4. 요구 비판적 검토

> 사용자가 요청한 **진단**이다. 제안서 22절을 이 저장소의 코드·계약과 대조했다.

### 4-a. 제안서가 타당한 곳 (그대로 승계)

| # | 제안서 주장 | 판정 | 근거 |
|---|---|---|---|
| ① | SQLite FTS5를 쓰고 별도 검색엔진을 도입하지 않는다 (§5) | **타당** | 이미 `messages_fts` 선례가 있다 — `0003_messages_fts.sql` |
| ② | UIDL로 증분, TOP으로 본문 다운로드 절감 (§8·§9) | **타당** | `node-pop3@0.15.3` `src/Command.js:131 UIDL` · `:234 TOP` · `:113 supports()` |
| ③ | `mail_search`는 네트워크에 접근하지 않는다 (§6) | **타당** | 도구 경계로 강제 가능 — §10 EP-02 |
| ④ | POP3에 `INTERNALDATE`가 없어 `headerDate` + `firstSeenAt`이 필요하다 (§17) | **타당** | RFC 1939에 수신 시각 명령이 없다. `LIST`/`UIDL`/`STAT` 어디에도 시각이 없다 |
| ⑤ | 대규모 UIDL 소실 시 즉시 대량 삭제하지 않는다 (§18) | **타당** | POP3 서버 교체·메일함 재생성이 실제로 UIDL 전체를 바꾼다 |
| ⑥ | Sync 실패해도 기존 캐시로 검색하고 stale을 알린다 (§12) | **타당** | Auth 계약의 fail-closed와 충돌하지 않는다 — 검색은 로컬이다 |
| ⑦ | 첨부 원본 경로를 감추고 Temp 복사본만 준다 (§19) | **타당** | `features/plugins/jira/attachment-store.ts`가 같은 형상이다 |
| ⑧ | UIDL 전체 목록·POP3 로그를 모델에 반환하지 않는다 (§13) | **타당** | 모델 컨텍스트 상한 관리로 옳다 |

### 4-b. 제안서가 틀렸거나 빠뜨린 곳 (보완)

| # | 제안서 문장 | 판정 | 근거 (관측) | 보완 |
|---|---|---|---|---|
| ① | "Orca Core 역할 = Plugin/MCP Tool 실행 및 결과 전달" · "Plugin의 설치·삭제·**장애 범위**를 Orca Core와 분리한다" (§1·§4) | **전제 정정** | Orca의 Plugin(A)은 build-time TypeScript 수직 슬라이스다. `auth.md §11`이 "런타임 동적 TypeScript/JavaScript 로딩을 추가하지 않는다"를 뒤집으면 안 되는 결정으로 고정한다 | 같은 main 프로세스 안이다. **프로세스 격리는 없다** — 분리되는 것은 DB 파일·마이그레이션·도구 표면이지 크래시 경계가 아니다. §9 TO-BE에 명시 |
| ② | "메일 프로토콜 \| POP3" + "Plugin이 POP3 연결을 소유" (§1·§3) | **경계 위반** | `src/main` 전체에 `node:net`/`node:tls`/`node:dgram` import **0건** (`grep -rnE "from '(node:)?(net\|tls\|dgram)'" src/main --include=*.ts \| wc -l` → `0`). `security.md §1.8`은 "main 프로세스의 **모든** 원격 요청은 Chromium 네트워크 스택으로 나간다"이다 | D-021 — `infra/net/pop3-socket.ts` 단일 소유 + §1.8 표에 예외 등재 + 유일성 가드 |
| ③ | "Plugin이 POP3 인증을 소유" (§3) | **성립 불가 — 등록 축** | `new URL('pop3s://mail.example.corp:995').origin` → `'null'`. `registry.ts:43`의 `isBareOrigin`이 `invalid_origin`으로 거부한다 (실측). **게이트와 무관한 축이다** — 게이트 멤버가 아니어도 `AuthDefinition`을 선언하는 한 걸린다(F-21) | `AuthDefinition.origin`은 계정 식별용 HTTPS origin으로 두고, POP3 host·port·TLS는 **Plugin 옵션**으로 넘긴다 (§10 AR-02). `probe`는 미선언이 정상 경로다(D-032) |
| ④ | 같은 문장 | **성립 불가** | Plugin은 raw credential을 볼 수 없다. `auth.md §7` "Plugin 모듈은 `BoundAuth.request`와 자기 옵션만 받고, **raw credential 을 보지 않는다**" | D-022 — 컴포지션 루트가 `authId`를 닫은 closure를 주입한다. `AuthSecretReader` 자체는 넘기지 않는다 |
| ⑤ | "모델 공개 도구 \| `mail_sync`, `mail_search` 2개" (§1) vs "사용자가 첨부파일을 요청했을 때만 복사" (§19) | **내부 모순** | 모델이 부를 도구가 없으면 §19 흐름의 진입점이 없다 | D-014 — 세 번째 도구 `mail_getAttachment` (사용자 확정) |
| ⑥ | "첨부파일은 Orca의 File/Artifact 스타일 **Card UI**로 제공한다" (§19) | **자동으로 생기지 않는다** | `ArtifactRef['kind']` = `html\|markdown\|text\|image\|file` (`shared/artifacts.ts:7`)에 office·pdf가 없다. 자동 수집은 temp 루트 **바로 아래 파일 + Work 에이전트** 한정 (`persistence.md §1.4`). Jira 첨부는 하위 디렉터리라 카드가 없다 | D-027 — 카드화는 비범위. 텍스트·이미지 첨부는 모델이 게시 도구를 부르면 카드가 된다 |
| ⑦ | "`mail_sync`가 항상 POP3에 연결하는 도구가 아니다" (§6) — 승인 언급 없음 | **누락** | `runtime-tool-policy.ts:19` — `readOnlyHint !== true`인 도구는 전부 승인 대상이다. 원격 I/O 도구를 자동 통과시키면 fail-open이다 | D-028 — `mail_search`만 `readOnlyHint: true` |
| ⑧ | "서버에 10,000통이 존재하고 신규 메일이 20통이라면 … TOP 20건" (§8) + "최초 Sync → 신규 UIDL → TOP" (§9) | **최초 sync 비용 누락** | 최초 sync는 로컬 ledger가 비어 있으므로 "신규 UIDL" = 전건이다. 제안서의 20건 예시는 **증분** 경우이고 최초 경우를 가린다. POP3는 단일 연결 순차 왕복이라 10,000 TOP은 RTT 20ms 기준 200s다 | D-026 — 최신 메시지 번호부터 역순 TOP, 14일 + 유예창을 넘으면 중단. §14에 상한 계산 |
| ⑨ | "검색 대상 \| 발신자, 수신자, 참조, 제목, 본문" (§1) — tokenizer 미지정 | **한국어에서 깨진다** | `unicode61`로 `'회의일정'`을 색인하고 `MATCH '일정'` → **0건** (실측). `trigram`은 `MATCH '회의일'` → 1건, `LIKE '%일정%'` → 1건 | D-024 — `trigram` tokenizer + 2글자 이하는 LIKE 경로 |
| ⑩ | "TLS 오류" 를 장애 목록에만 적음 (§12) | **모드 미지정** | `node-pop3@0.15.3` 소스에 `STLS`·`starttls` 문자열 **0건** — implicit TLS(`tls.connect`, `src/Connection.js:236`)만 있다 | D-025 — implicit TLS 995 기본. STARTTLS 서버는 이번 범위에서 지원하지 않음을 선언으로 노출 |
| ⑪ | "구체적인 Timeout 시간은 실제 서버 환경 측정 후 결정한다" (§12) | **설계 미완** | 구현자가 정할 수 없는 값을 미정으로 넘기면 `PLAN_GAP`이다 | D-029 — 15s/30s/120s 기본값 확정, 설정으로 덮기 가능 |
| ⑫ | "`mail.db` 내부에는 개념적으로 다음 데이터가 존재한다" (§4) — 마이그레이션 관리 언급 없음 | **가드 사각** | `check-migrations-appendonly.mjs:20-21`이 `src/main/infra/db/migrations`와 `migrate.ts`에 하드 앵커돼 있다. 두 번째 DB의 마이그레이션은 **가드 밖**이다 | §10 AR-03 — 가드를 디렉터리 목록으로 일반화하고 mail 마이그레이션을 등재 |
| ⑬ | "모델의 기본 Tool 호출 순서" (§11) | **모델에 강제할 수 없다** | 모델이 `mail_sync`를 건너뛰고 `mail_search`만 부를 수 있다. 제안서는 순서 준수를 가정한다 | `descriptor.instructions`로 유도(`adapters/claude-runtime-tools.ts:92`)하고, **`mail_search`가 stale 여부를 항상 결과에 싣는다**(D-045의 확장) |
| ⑭ | 제안서 전체에 `DELE` 언급 없음 | **누락 — 파괴적** | POP3 `DELE`는 서버 메일함에서 메일을 지운다. `node-pop3`가 `DELE`를 노출한다(`src/Command.js:192`) | D-031 — 명령 화이트리스트로 금지 |

### 4-c. 조사로 닫은 사실 / 사용자에게 올린 결정

- 사용자에게 올린 결정: **4건 전부 이번 턴에 응답을 받았다** — 구현 레지스터(D-002) · 전송·인증 경계(D-021·D-022) · 신규 의존성(D-023) · 도구 수(D-014).
- 코드 조사로 닫은 사실: `features/plugins/*` 슬라이스 **2개**(confluence·jira) · `createPluginBindings()` 기본 반환 `[]` · `secretReader` 프로덕션 소비 지점 **2곳**(`bootstrap.ts:385`·`:526`) · 마이그레이션 **27건** · `features/` 최상위 슬라이스 **15개**(mail 추가로 변하지 않는다 — `plugins`의 하위다).
- **남은 OPEN 없음.** 이번 plan에 `OPEN` 상태 Decision은 0건이다.

## 5. 동작 / 사용자 흐름

```text
[사용자] "지난주 회의 일정 관련 메일 찾아줘"
  → [모델] mail_sync 호출  ── 승인 필요 (D-028)
      → 5분 이내 정상 sync 있음 → POP3 미연결, { synced:false, fresh:true }
      → 5분 초과 → 만료 정리 → POP3 증분 sync → { synced:true, newMails:N, expired:M }
      ↘ 연결·인증·TLS 실패 → { synced:false, error:<code>, lastSyncAt, stale:true }
  → [모델] mail_search 호출 ── 자동 통과 (readOnlyHint:true)
      → { cacheAsOf, stale, total, results:[{ mailId, date, from, to, subject, snippet, rank,
             attachmentCount, attachments:[{ attachmentId, filename, mimeType, sizeBytes }], attachmentsTruncated? }] }
      ↘ 캐시 없음 → { total:0, cacheAsOf:null, stale:true }
  → [모델] 사용자에게 답변 (stale이면 "N분 전 기준" 을 함께 말한다)
                                    ↑ attachmentId 의 유일한 producer 다 (D-043)

[사용자] "그 메일 첨부 열어줘"     ── 첨부 3개면 호출 3회 · 승인 3회 · staging 3배치 (D-044)
  → [모델] mail_getAttachment(mailId, attachmentId) ── 승인 필요. 둘 다 필수, 하나만 주면 거부
      → Temp staging 쓰기 → 예산 통과 시 rename 공개 → { filename, bytes, savedPath }
      ↘ 만료로 이미 제거됨 → { error:'attachment_expired' }
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 연결 버튼 — ID/비밀번호 입력 | POP3 연결 → `USER`/`PASS` → `QUIT` (candidate로 1왕복) | 성공해야 **연결됨**이 된다. 거부면 "아이디 또는 비밀번호 확인", 도달 실패면 "메일 서버에 닿지 못함" — **둘 다 커밋하지 않는다** (D-040) |
| Auth `valid` 로 전이 | `sync()`가 tool server를 registry에 add | **다음 spawn부터** 도구 3종이 모델에 보인다 |
| 메일 인증 실패·미인증 | 도구만 사라진다 | **앱 진입은 막히지 않는다** — Mail Auth는 게이트 멤버가 아니다(D-034) |
| Auth `invalid`·해제·401 강등 | `sync()`가 registry에서 remove | 다음 턴에 도구가 사라진다. 연결 탭 목록은 cached descriptor로 유지되고 `status`가 비활성을 안내한다 |
| POP3가 `PASS`에 `-ERR`로 답함 (비밀번호 회전 등) | reporter가 Auth를 강등 → `sync()`가 **서버를 통째로** 회수 | **도구 3종이 전부 사라진다 — 로컬 캐시 검색도 불가능하다**(D-045). 연결 탭이 **재인증 필요**로 바뀌고, 자동 재로그인은 돌지 않으며(입력형, F-23) 사용자가 비밀번호를 다시 넣으면 세 도구가 함께 돌아온다 (D-035·D-036) |
| `mail_sync` — 캐시 fresh | POP3 미연결 | `{ synced:false, fresh:true, lastSyncAt }` |
| `mail_sync` — 캐시 stale | 만료 정리 → POP3 증분 | `{ synced:true, newMails, expired, lastSyncAt }` |
| `mail_sync` 진행 중 동일 계정 재호출 | single-flight — 진행 중 Promise를 공유 | 두 호출이 **같은 결과 객체**를 받는다 (D-016) |
| `mail_sync` **비인증** 실패 + 캐시 있음 (연결·TLS·타임아웃·파싱·DB 5종) | 캐시 보존, `lastSyncAt` 미갱신, **Auth 강등 없음** | `{ synced:false, error, stale:true, lastSyncAt }` — 도구 3종이 남아 검색이 계속된다 (D-045) |
| `mail_sync` 비인증 실패 + 캐시 없음 | 없음 | `{ synced:false, error, stale:true, lastSyncAt:null }` |
| 원격 UIDL **일반** 소실 (사용자가 서버에서 몇 통 지움) | ledger state를 `missing`으로 표시만 | **본문·FTS·첨부는 그대로 남아 최대 14일간 계속 검색된다** (D-046 — D-004의 귀결) |
| 원격 UIDL **대량** 소실 감지 (활성 ledger ≥ 20 ∧ 잔존 비율 < 0.5) | 보호 진입 — **신규 UIDL을 수집하지 않는다**(RETR 0회) | `{ synced:false, protection:'bulk_loss_suspected', newMails:0, removed:0 }`. 기존 캐시 검색은 계속된다 (D-047) |
| 보호 중 다음 sync — 비율 회복 | 보호 해제 + 정상 수집 | `{ synced:true, newMails:N }` — 일시적 서버 오류였다 (D-047) |
| 보호 중 다음 sync — 같은 `remoteFingerprint` 2회째 | 보호 해제 + 정상 수집 (서버 교체로 채택) | `{ synced:true, newMails:N, removed:0 }` — **기존 캐시는 지우지 않고** retention이 걷는다 (D-046·D-047) |
| 보호 중 다음 sync — 다른 `remoteFingerprint` | 관측 카운트 리셋, 보호 유지 | `{ synced:false, protection:'bulk_loss_suspected', newMails:0 }` — 서버가 불안정한 것이지 교체가 아니다 |
| 턴 취소 (`AbortSignal`) | 소켓 파괴 + staging 제거 + 트랜잭션 롤백 | `isError:true` + 취소 사유. 부분 커밋이 남지 않는다 |
| 14일 경과 | 다음 `mail_sync` 진입에서 lazy cleanup | 검색 결과에서 사라지고 첨부 파일도 지워진다 |

### 파생 UX / 엣지케이스

- loading / empty / error: 도구 호출은 기존 승인 오버레이·도구 카드를 그대로 쓴다. 신규 renderer 표면 **0개**.
- cancel / retry: 취소는 `RuntimeToolContext.getSignal()`. 재시도는 모델이 도구를 다시 부르는 것이고 플러그인이 자동 재시도하지 않는다 — POP3 재연결은 서버 부하를 만든다.
- 첨부 다건: 한 메일의 첨부 3개를 모두 받으면 **승인 오버레이가 3번** 뜬다(D-044). 중간에 사용자가 거절하면 앞의 것만 Temp에 남는다 — 각 호출이 자기 staging 배치를 commit 하므로 부분 상태가 아니라 완결된 N건이다.
- concurrency / multi-session: 여러 세션이 같은 계정을 쓴다. single-flight 키는 `authId` 하나다 (세션 아님).
- keyboard / a11y / theme: 해당 없음 — renderer 변경이 없다.
- 외부환경/오프라인/폐쇄망: POP3는 Chromium 스택 밖이라 **OS 프록시·PAC를 타지 않는다**. 사설 CA는 `tlsOptions.ca`로 배포가 주입한다 (§13).

## 6. 범위 / 비범위

- **범위**: `features/plugins/mail/` 슬라이스 · `infra/net/pop3-socket.ts` · mail DB(스키마·마이그레이션 러너·FTS) · 도구 3종 · `app/deployment/plugins.ts` 조립 예제 · `security.md §1.8` 표 갱신 · `closed-network-extensions.md §4` 레시피 보강 · 마이그레이션 append-only 가드 일반화.
- **비범위**: IMAP·SMTP(발신) · 메일 읽음 처리·`DELE` · 첨부 본문 인덱싱(D-020) · Artifact Card UI(D-027) · STARTTLS 승격(D-025) · 메일 전용 renderer 화면 · 기본 OSS 배포 활성화(D-030) · 다중 메일 계정(1계정 = 1 Auth = 1 Plugin binding) · **로그인 게이트 편입**(D-034) · **SASL 토큰 인증**(D-039 — `AUTH XOAUTH2` 등, 한계로 홀드) · **첨부 합집합 selector·`filename` 필터**(D-044 — Jira와 달리 복제하지 않는다) · **인증 거부 후의 캐시 검색**(D-045 — 도구별 게이팅을 만들지 않는다).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 첨부 본문 인덱싱 | 아니오 — FTS 테이블에 행 추가로 가능 | 후속 |
| STARTTLS | 아니오 — `Connection` 옵션 축 추가 | 후속 |
| SASL 토큰 인증(`AUTH XOAUTH2` 등) | **예 — 라이브러리 교체 + Auth 종류 변경** | **한계로 기록하고 홀드**(D-039). 여는 시점에 `node-pop3`를 SASL 지원 구현으로 바꾸고 `passwordSpec` → `oauth` 선언으로 옮긴다 |
| 다중 계정 | **예 — DB 스키마의 계정 축** | **지금 스키마에 `account_id`를 둔다.** 도구 표면은 단일 계정으로 시작 |
| Artifact Card | 아니오 — 게시 도구가 이미 경로를 받는다 | 후속 |
| mail DB 파일명·경로 | **예 — 저장 형식·이관 비용** | **지금 확정** — `<userData>/plugins/mail/<accountId>/mail.db` (§10 AR-03) |
| 도구 이름 | **예 — 공개 계약** | **지금 확정** — D-014 |
| 첨부 합집합 selector (`mail_getAttachment(mailId)` 전량) | 아니오 — 기존 입력 스키마에 선택지 추가로 가능 | 후속. 지금은 단건 전용(D-044) |
| 도구별 게이팅 (`createPluginBinding`) | **예 — Confluence·Jira가 함께 쓰는 공유 계약** | **지금 확정 — 만들지 않는다**(D-045). 서버 단위 add/remove를 유지한다 |

## 7. Requirements / Acceptance — `R ↔ AT`

> 왼쪽 칸은 **계약 node**, 두 번째 칸은 그 레벨의 **검증 node**다. 사용자가 관측하는 요구는 `R↔AT`, 그 밖의 계약은 `SD↔ST`·`AR↔IT`·`MD↔UT`로 닫는다. `AC<N>`은 역사적 참조용 연번이다.

| 계약 node | 검증 node / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 마지막 정상 sync가 5분 **이내**면 `mail_sync`가 POP3에 연결하지 않고 `{ synced:false, fresh:true }`를 돌려준다 | 주입 시계 `now = lastSync + 299s`에서 소켓 팩토리 호출 **0회** + 반환값 두 필드 | `mailTools().implementations['mail_sync'].handler` |
| R-01 | AT-02 / AC2 | 5분을 **초과**하면 증분 sync를 수행하고 `{ synced:true, newMails, expired }`를 돌려준다 | `now = lastSync + 301s`에서 소켓 팩토리 호출 **1회** + fake 서버의 신규 UIDL 2건이 `newMails:2` | 같은 handler |
| R-01 | AT-03 / AC3 | 로컬 ledger에 있는 UIDL은 다시 `RETR`하지 않는다 | fake 서버 UIDL 5건 중 3건이 ledger에 있을 때 `RETR` 호출 인자 집합이 **나머지 2건과 정확히 같다**(차집합 0) | 같은 handler |
| R-02 | AT-04 / AC4 | `mail_search`는 어떤 입력에서도 POP3에 연결하지 않는다 | 소켓 팩토리를 "호출 시 throw"로 주입하고 6종 입력(빈 질의·긴 질의·날짜만·발신자만·페이지 초과·캐시 없음)에서 전부 정상 반환 | `mail_search` handler |
| R-02 | AT-05 / AC5 | **비인증** sync 실패(연결·TLS·타임아웃·파싱·DB 5종) 후에도 캐시가 있으면 검색 결과가 나오고 `stale:true`·`cacheAsOf`가 실린다 | 5종 오류를 각각 주입한 뒤 `mail_search` 결과의 `total > 0` ∧ `stale === true` ∧ `cacheAsOf === lastSyncAt`. 각 케이스에서 Auth 상태가 `valid`로 **남는다**(D-045 방향) | `mail_sync` 실패 → `mail_search` |
| R-02 | AT-06 / AC6 | `mail_search`는 sync를 부르지 않았을 때도 `stale` 판정을 싣는다 | `mail_sync` 없이 `mail_search`만 호출해 `stale === true` (진단 ⑬ 대응) | `mail_search` handler 단독 |
| R-03 | AT-07 / AC7 | 14일을 넘긴 메일은 다음 `mail_sync` 뒤 검색 결과에서 사라진다 | 15일 전 `headerDate` 메일 1건을 넣고 sync → `mail_search`의 해당 `mailId` **부재** | `mail_sync` → cleanup → `mail_search` |
| R-03 | AT-08 / AC8 | 만료 정리는 **본문 행·FTS 행·첨부 파일 3곳 모두**에서 일어난다 | 만료 후 `mail`·`mail_fts`·첨부 디렉터리 각각의 잔여 **0건**(세 단언 분리) | 같은 경로 |
| R-03 | AT-09 / AC9 | `mail_sync` 외에는 만료 정리 진입점이 없다 | `features/scheduler` 등록 호출이 mail 슬라이스에 **0건**(`rg` 전수) + `mail_search` 실행 후 만료 행이 **남아 있다**(양성 대조) | D-009 강제 |
| R-04 | AT-10 / AC10 | `mail_getAttachment` 결과에 Temp 경로만 실리고 mail 내부 저장 경로는 없다 | 결과 JSON 문자열에 내부 루트 절대경로 substring **부재** + `savedPath`가 `prepareTemporaryFilesPath()` 하위 | `mail_getAttachment` handler |
| R-04 | AT-11 / AC11 | `mail_search` 결과는 첨부 매니페스트를 싣고 내부 경로·`stored_name`은 싣지 않는다 | 양성: 첨부 2건 메일의 `attachments[]` 길이 **2** ∧ 각 항목이 `attachmentId`·`filename`·`mimeType`·`sizeBytes` 4키. 음성: 결과 JSON에 내부 루트·`stored_name` substring **부재** ∧ `hasAttachments` 키 **부재**(D-043) | `mail_search` handler |
| R-04 | AT-12 / AC12 | Temp 복사 후 내부 원본이 바뀌지 않는다 | `mail_getAttachment` 전후 내부 원본의 크기·mtime·SHA-256 **동일** | D-012 강제 |
| R-04 | AT-13 / AC13 | 오류 메시지에도 내부 경로·자격증명이 없다 | 6종 오류(연결·인증·TLS·타임아웃·파싱·DB)의 메시지에 내부 루트·비밀번호 substring **부재** | 오류 매핑 함수 |
| R-05 | AT-14 / AC14 | Auth가 `valid`가 아니면 도구 서버가 registry에 없다 | `sync()`를 `invalid` 스냅샷으로 호출 후 `registry.remove` 1회 + `add` 0회 | `createPluginBinding.sync` |
| R-05 | AT-15 / AC15 | 연결 탭의 도구 목록은 Auth가 invalid여도 3개를 유지한다 | `toolNames()` 길이 **3** (Auth 상태 무관 2케이스) | `PluginBinding.toolNames` |
| R-06 | AT-16 / AC16 | 한국어 어절 중간 문자열로 제목·본문을 찾는다 | `'회의일정 안내'` 색인 후 `'일정'`(2글자)·`'회의일'`(3글자) 두 질의가 **모두 1건** | `mail_search` 질의 빌더 → FTS |
| R-06 | AT-17 / AC17 | EUC-KR 본문이 깨지지 않고 색인된다 | EUC-KR 인코딩 fixture를 파싱해 본문에 `'회의'` 포함 ∧ `mail_search '회의'` 1건 | MIME 정규화 → FTS |
| AR-03 | IT-03a / AC18 | `orcinus-orca.db` 마이그레이션은 27건 그대로다 | `ls src/main/infra/db/migrations/*.sql \| wc -l` → **27** ∧ `migrate.ts`의 `?raw` import 27건 | D-011 강제 — mail 슬라이스가 Core 러너를 건드리지 않는 경로 |
| AR-03 | IT-03b / AC19 | mail DB 마이그레이션도 append-only 가드를 받는다 | 가드에 mail 디렉터리를 등재하고, 기존 mail 마이그레이션 1줄을 고친 변이가 가드를 **red**로 만든다 | `check-migrations-appendonly.mjs` CI 게이트 |
| AR-01 | IT-01 / AC20 | POP3 소켓을 만드는 파일은 `infra/net/pop3-socket.ts` 하나다 | 음성: `node:net`/`node:tls` import가 그 파일 밖에서 **0건**. 양성: 그 파일이 실제로 `tls.connect`로 연결을 연다는 fake TLS 서버 단언 | 부팅 → 소켓 팩토리 주입 → `pop3/session.ts` |
| AR-02 | IT-02 / AC21 | Mail Plugin factory는 `AuthSecretReader`를 받지 않고 `() => string \| null` closure만 받는다 | 음성: mail 슬라이스 전체에 `AuthSecretReader` 식별자 **0건**. 양성: 주입된 closure가 실제 자격증명을 돌려주고 그 값으로 `PASS`가 전송된다 | `bootstrap.ts` → `createMailPlugin` → `pop3/session.ts` |
| AR-04 | IT-04 / AC22 | `readOnlyHint`는 `mail_search`만 `true`다 | descriptor 3행의 `annotations.readOnlyHint`가 `[false, true, false]`이고, **형제 자리를 맞바꾼 변이가 red**다 | `createPluginBinding` → registry → `runtimeApprovalToolNames` |
| SD-03 | ST-03 / AC23 | 동일 계정의 동시 `mail_sync` 3건이 POP3 연결을 1회만 만든다 | 3개 handler를 동시에 await → 소켓 팩토리 호출 **1회** ∧ 세 결과가 같은 값 | `mail_sync` handler → single-flight 맵 |
| SD-02 | ST-02 / AC24 | 취소 신호가 오면 소켓이 파괴되고 부분 커밋이 남지 않는다. **`context`가 없으면 취소는 불가하되 호출은 정상 동작한다** | `RETR` 도중 abort → 소켓 `destroy` 1회 ∧ mail 행 증가 **0** ∧ staging 잔여 **0**. 별도로 `context === undefined` 케이스에서 3도구가 throw 없이 결과를 돌려준다(F-31) | `RuntimeToolContext.getSignal()` → `sync-manager` 정리 |
| MD-01 | UT-01 / AC25 | 활성 ledger가 20건 이상이고 잔존 비율이 0.5 **미만**이면 신규 UIDL을 수집하지 않고 보호 상태를 돌려준다 | 진입(ledger 100·remote 10)에서 **RETR 호출 0회** ∧ `protection:'bulk_loss_suspected'`. 경계·표본 4케이스 — 비율 `0.50` 미발동·수집 진행 / `0.49` 발동, ledger `19`건 미발동 / `20`건 발동. **판별자는 RETR 횟수다** — `removed:0`은 D-046 아래 전 경로에서 참이라 D-004 회귀로만 남긴다 | `mail_sync` → `reconcile.ts` → `protection.ts` → 수집 분기 |
| MD-01 | UT-01b / AC25b | 일반 UIDL 소실은 본문을 삭제하지 않고 ledger state만 `missing`으로 바꾼다 | ledger 100건 중 remote 95건(비율 0.95, 보호 미발동)에서 `mail` 행 수·FTS 행 수·첨부 파일 수 **불변** ∧ 소실 5건의 ledger state가 `missing` ∧ `mail_search`가 그 5건을 **여전히 반환**한다(D-046 — 14일 전) | 같은 경로 |
| MD-07 | UT-07 / AC26 | `DELE`는 어떤 경로로도 전송되지 않는다 | 음성: 명령 화이트리스트에 `DELE` **부재**. 양성: 화이트리스트의 `UIDL`·`TOP`·`RETR`·`STAT`·`CAPA`·`QUIT` **6개가 실제로 전송된다**는 fake 서버 수신 로그 | `pop3/session.ts` 명령 게이트 |
| R-05 | AT-18 / AC27 | `probe` 미선언 배포에서 비밀번호가 틀리면 첫 `mail_sync`가 `auth_failed`를 돌려준다 | fake 서버가 `PASS`에 `-ERR`로 답하는 케이스에서 `{ synced:false, error:'auth_failed' }` ∧ 연결 오류(`ECONNREFUSED`)·타임아웃과 **다른 코드**임을 3케이스로 대조 | `mail_sync` handler → `pop3/errors.ts` 매핑 |
| AR-05 | IT-05 / AC28 | POP3가 `PASS`에 `-ERR`로 답하면 Auth가 강등되고 **다음 sync에서 도구 3종이 전부 registry에서 사라진다** | fake 서버가 `-ERR`을 준 뒤 reporter 호출 **1회** ∧ `binding.sync()` 후 registry snapshot의 mail 서버 **0개**(호출 횟수가 아니라 상태를 관측한다) ∧ `mail_search` 완전 이름이 `runtimeApprovalToolNames`·snapshot 어디에도 **부재**. 같은 실패 3연속에서 reporter는 **1회**(전이 1회성, `auth.md §4.5`) | `mail_sync` → `pop3/errors.ts` → reporter → `markExpired` → change → `binding.sync()` |
| AR-05 | IT-05b / AC28b | **비인증 오류는 Auth를 강등시키지 않는다** — 도구 3종이 registry에 남는다 | 연결·TLS·타임아웃·파싱·DB 5종을 각각 주입해 reporter 호출 **0회** ∧ `binding.sync()` 후 registry snapshot의 mail 서버 **1개**·도구 **3개**. 5종 중 하나라도 `authFailure:true`로 매핑하는 변이가 **red**다(D-045 방향) | 같은 경로의 음성 축 |
| R-05 | AT-19 / AC29 | 연결 버튼에 틀린 비밀번호를 넣으면 **연결됨이 되지 않고** 자격증명이 저장되지 않는다 | fake 서버가 `PASS`에 `-ERR` → `input-required` 복귀 ∧ vault 쓰기 **0회** ∧ `snapshot().status !== 'valid'`. 도달 실패(`ECONNREFUSED`)는 **같은 형상의 다른 문구**임을 두 케이스가 대조한다(D-041 — 현재 고정 문자열이라 이 단언이 코드 변경을 요구한다) | 연결 탭 → `AuthRuntime.login()` → verifier → `pop3/session.ts` |
| AR-06 | IT-06 / AC30 | verifier를 주입하지 않은 Auth는 로그인 동작이 **바뀌지 않는다** | verifier 미주입 authId 2종(`probe` 선언형·미선언형)에서 `deps.request` 호출 횟수와 커밋 여부가 변경 전과 동일. mail authId에서만 verifier 호출 1회 | `bootstrap.ts` 주입부 → `login.ts` probe 분기 |
| R-07 | AT-20 / AC31 | `mail_search`가 돌려준 `attachmentId`로 `mail_getAttachment`를 부르면 그 첨부가 나온다 | 첨부 3건 메일을 색인 → `attachments[]` 길이 **3** ∧ `attachmentCount === 3` → 세 `attachmentId`로 각각 호출해 `filename`·`bytes`가 매니페스트와 일치. **매니페스트를 지우는 변이가 red**다(producer 소멸) | `mail_search` → 모델 → `mail_getAttachment` ×3 |
| R-07 | AT-21 / AC32 | `mail_getAttachment`는 `mailId`·`attachmentId`를 **둘 다** 요구한다 | 3케이스 — 둘 다 주면 성공 / `mailId`만 스키마 거부 / `attachmentId`만 스키마 거부. 음성: 입력 스키마 키 집합이 정확히 `{mailId, attachmentId}`(합집합 selector·`filename` 필터 부재, D-044) | `mail_getAttachment` inputSchema |
| MD-08 | UT-08 / AC33 | 보호는 ①비율 회복 또는 ②같은 `remoteFingerprint` **2회 연속**에서 풀리고, 다른 fingerprint는 카운트를 리셋한다 | 순수 `decideProtection()` 4케이스 — 회복 `{ingest:true}` / 같은 fp 2회째 `{ingest:true}` / 다른 fp `{ingest:false, observations:1}` / 같은 fp 1회째 `{ingest:false, observations:1}`. 채택 케이스에서 기존 `mail` 행 삭제 **0건**(D-046) | `sync-manager` → `protection.ts` → `sync_state.protection_state` |

### AC 검증 주의사항

- 기존 테스트 재사용: 없음 — 전부 신규다. 인용한 기존 케이스 없음.
- 사람 실기 항목: **실 POP3 서버 연결 1건**(TLS 핸드셰이크·사설 CA·실 인코딩)만 사람 몫이다. 그 밖의 프로토콜 판정·TTL·FTS·경로 은닉은 fake 소켓으로 순수 테스트한다 — 사람 실기로 미룬 순수 로직은 없다.
- N회/총량 기준: AC23의 "소켓 팩토리 1회"의 sink는 `Pop3SocketFactory` 단일 함수다. 프로덕션 호출부 전수 = `pop3/session.ts`의 연결 진입 1곳(`rg 'socketFactory\(' src/main/features/plugins/mail --include=*.ts` → 구현 후 1건이어야 한다). `mail_search`·`mail_getAttachment` handler는 그 팩토리를 **받지 않으므로** 식의 항이 아니다(AC4·§10 EP-02).
- 총량/0건 기준: AC20의 음성 스윕은 `infra/net/pop3-socket.ts` 1개를 허용 목록으로 뺀다. **음성만으로는 배선 삭제를 못 잡으므로** 양성 단언(실제 `tls.connect` 진입)을 짝지었다. AC21·AC26도 같은 음성+양성 구조다.
- 형제 자리 변이: AC22(annotations 3자리)·AC8(3저장소)은 값을 맞바꾸거나 한 자리만 지우는 변이에서 red여야 한다.
- **공허한 단언을 판별자로 쓰지 않는다 (ΔV1)**: D-046 아래 `removed:0`은 보호 발동 여부와 무관하게 항상 참이다. AC25의 판별자는 **RETR 호출 횟수**이고 `removed:0`은 D-004 회귀로만 남긴다 — r1 G3이 지적한 축이다.
- **음성 방향을 짝지은 쌍 (ΔV1)**: AC28(인증 거부 → 회수)에 AC28b(비인증 5종 → 유지)를, AC25(보호 발동)에 AC25b(일반 소실 → 본문 유지)를 붙였다. 한쪽만 두면 "전부 강등"·"전부 보호"로 뭉개는 구현이 통과한다.
- **producer 소멸 변이 (ΔV1)**: AC31은 `mail_search` 매니페스트를 지우면 red여야 한다 — `attachmentId`의 producer가 그 한 곳뿐이라(§12) 지우면 `mail_getAttachment`가 도달 불가가 된다. r1 G1이 실제로 그 상태였다.
- **AC 35건 — 분할 검토 결과 분할하지 않는다.** 전송 경계(AC20·AC21)만 떼면 소비자 없는 소켓 모듈이 남아 프로덕션 도달 경로가 없고, 캐시·검색만 떼면 연결 수단이 없어 어느 쪽도 사용자 결과에 닿지 못한다. 35건 중 16건(AC18~AC30 · AC28b · AC31 · AC32)은 경계·가드 단언이라 구현 표면이 아니라 **배선 1회**에 붙는다.

## 7-A. V / Trace Matrix

- V mode 판정: **Delta V** (`ΔV1`). 기준은 본 plan의 Baseline `V1`이고 유효 V는 `V1 + ΔV1`이다.
- 기준 V 상속 근거: `V1`은 commit `07ec3a6`(Baseline 설계) ~ `e252c6b`(r1 PLAN_GAP 보고)에 확정돼 있다. **구현은 착수되지 않았다**(AC 자기보고 0/30) — 따라서 `ΔV1`이 건드리지 않은 V1 pair는 전부 `REQUIRED`로 그대로 상속되며, 이 절은 그것을 복사하지 않는다.
- 변경이 시작되는 수준: **R** — r1 G1(첨부 식별 producer 부재)·G2(인증 거부 후 캐시 검색)가 사용자 관측 결과를 바꾸고, G3(보호 정책)는 MD에서 시작해 R-03의 삭제 기준에 닿는다.
- V1 Baseline 등록부는 아래 두 표에 그대로 둔다. `ΔV1`의 변경·신규·회귀 행은 그 뒤 **ΔV1 절**에 모았다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 동기화 후 검색 | NEW | — |
| R-02 | R | §7 장애 시 캐시 검색 + stale | NEW | — |
| R-03 | R | §7 14일 보관 | NEW | — |
| R-04 | R | §7 첨부 경로 은닉 | NEW | — |
| R-05 | R | §7 인증 상태와 도구 가시성 | NEW | — |
| R-06 | R | §7 한국어 부분 문자열 검색 | NEW | — |
| AT-01…AT-19 | AT | §7 AC1~AC17 · AC27 · AC29 | NEW | — |
| SD-01 | SD | §5·§9 `mail_sync` freshness → cleanup → 증분 → 영속 수명주기 | NEW | — |
| SD-02 | SD | §5·§13 실패·취소·부분 커밋의 관측 상태 | NEW | — |
| SD-03 | SD | §5·§13 single-flight 공유 수명 | NEW | — |
| ST-01 | ST | §7-A VP-07 end-to-end 왕복 | NEW | — |
| ST-02 | ST | §7 AC24 | NEW | — |
| ST-03 | ST | §7 AC23 | NEW | — |
| AR-01 | AR | §9·§10 POP3 소켓 전송 경계 | NEW | — |
| AR-02 | AR | §10 자격증명 경계 — 세 번째 secret 소비자 | NEW | — |
| AR-03 | AR | §10·§11 mail DB 소유·마이그레이션·가드 | NEW | — |
| AR-04 | AR | §10·§12 Plugin 등록 · 도구 descriptor 계약 | NEW | — |
| AR-05 | AR | §10·§13 자격증명 실패 되먹임 경계 (Plugin → Auth 강등) | NEW | — |
| AR-06 | AR | §10·§11 로그인 시점 자격증명 증명 경계 (authId별 verifier) | NEW | — |
| IT-01 | IT | §7 AC20 | NEW | — |
| IT-02 | IT | §7 AC21 | NEW | — |
| IT-03a·IT-03b | IT | §7 AC18·AC19 | NEW | — |
| IT-04 | IT | §7 AC22 | NEW | — |
| IT-05 | IT | §7 AC28 | NEW | — |
| IT-06 | IT | §7 AC30 | NEW | — |
| MD-01 | MD | §11 UIDL reconcile (신규/기존/소실 3분류 + 보호) | NEW | — |
| MD-02 | MD | §11 14일 경계 판정 · cleanup 대상 산출 | NEW | — |
| MD-03 | MD | §11 FTS 질의 빌더 (trigram · 길이 분기) | NEW | — |
| MD-04 | MD | §11 MIME → 검색 문서 정규화 | NEW | — |
| MD-05 | MD | §11 freshness 판정 | NEW | — |
| MD-06 | MD | §11 첨부 파일명·경로 정규화 | NEW | — |
| MD-07 | MD | §10·§11 POP3 명령 화이트리스트 (`DELE` 금지) | NEW | — |
| UT-01…UT-07 | UT | §7-A VP-14~VP-20 · §7 AC25·AC26 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·02·03 | REQUIRED | 모델 tool call → `mail_sync` handler → freshness → 소켓 팩토리 → ledger | 소켓 팩토리 호출 횟수 + 반환 필드 값 | not selected — 호출 횟수와 반환값을 직접 관측한다 | EP-06 (2) |
| VP-02 | R-02 ↔ AT-04·05·06 | REQUIRED | `mail_search` handler → mail DB → 결과 | throw 소켓 팩토리에서 정상 반환 + `stale`·`cacheAsOf` 값 | required — "네트워크 미접근"은 부재 주장이라 소켓 팩토리 throw 변이로 방향을 고정한다 | EP-02 (2) |
| VP-03 | R-03 ↔ AT-07·08·09 | REQUIRED | `mail_sync` 진입 → cleanup → 3저장소 삭제 | 세 저장소 각각의 잔여 차집합 | required — 한 저장소만 지우는 변이 3종(각 자리 하나씩 남김) | EP-03 (3) |
| VP-04 | R-04 ↔ AT-10·11·12·13 | REQUIRED | 도구 3종 결과 조립 + 오류 매핑 → tool result | 결과 문자열의 내부 루트 substring 부재 + 원본 해시 동일 | required — 결과 조립에서 내부 경로를 그대로 싣는 변이 4종(도구 3 + 오류 1) | EP-01 (4) |
| VP-05 | R-05 ↔ AT-14·15·18 | REQUIRED | Auth change → `binding.sync()` → `RuntimeToolSink` · `mail_sync` → `pop3/errors.ts` | `add`/`remove` 호출 횟수 + `toolNames()` 길이 + `auth_failed` 코드 분리(AC27) | required — `auth_failed`를 일반 오류 코드로 뭉개는 변이 | EP-05 (3) |
| VP-06 | R-06 ↔ AT-16·17 | REQUIRED | 질의 문자열 → 질의 빌더 → FTS → 결과 | 2글자·3글자 질의 각각의 결과 건수 | required — tokenizer를 `unicode61`로 되돌리는 변이(AC16이 red여야 한다) | EP-04 (2) |
| VP-07 | SD-01 ↔ ST-01 | REQUIRED | fake POP3 서버 end-to-end: `mail_sync` → `mail_search` 연속 호출 | 두 호출의 반환값 쌍 + DB 상태 | not selected — end-to-end 상태를 직접 관측한다 | EP-06 (2) |
| VP-08 | SD-02 ↔ ST-02 | REQUIRED | 실패·취소 주입 → 관측 상태 | 실패 후 DB 행 수·staging 잔여·`lastSyncAt` 3값 | required — 실패 시 `lastSyncAt`을 갱신하는 변이(AC5가 red여야 한다) | EP-07 (3) |
| VP-09 | SD-03 ↔ ST-03 | REQUIRED | 동시 3호출 → single-flight → 공유 결과 | 소켓 팩토리 호출 1회 + 결과 동일성 | required — single-flight 맵을 제거하는 변이 | EP-08 (1) |
| VP-10 | AR-01 ↔ IT-01 | REQUIRED | `bootstrap` → `pop3-socket.ts` → `tls.connect` → `Pop3Connection` | 양성: fake TLS 서버에 실제 연결(AC20 후단). 음성: import 스윕 0건 | required — **음성 스윕 단독은 배선 삭제에 침묵**하므로 양성 단언을 짝짓고, 소켓 모듈을 no-op으로 만드는 변이를 심는다 | EP-09 (2) |
| VP-11 | AR-02 ↔ IT-02 | REQUIRED | `bootstrap.ts` → `authId` 닫은 closure → `createMailPlugin` → `PASS` 전송 | 주입된 closure의 값이 `PASS`로 나간다(AC21 양성) + `AuthSecretReader` 식별자 부재(음성) | required — closure 대신 `AuthSecretReader`를 통째로 넘기는 변이 | EP-10 (2) |
| VP-12 | AR-03 ↔ IT-03a·IT-03b | REQUIRED | 앱 부팅 → mail DB 열기 → 마이그레이션 → FTS 준비 | Core 마이그레이션 27건 불변(AC18) + 신규 mail DB에 테이블·FTS·`_migrations` 행 생성 | required — 기존 mail 마이그레이션 수정 변이가 가드를 red로 만드는지 (AC19) | EP-11 (2) |
| VP-13 | AR-04 ↔ IT-04 | REQUIRED | `createPluginBindings` → `createPluginBinding` → registry → `runtimeApprovalToolNames` | descriptor id·도구 3종 이름·annotations 3자리 (AC22) | required — annotations 형제 자리 맞바꿈 변이 | EP-12 (3) |
| VP-14 | MD-01 ↔ UT-01 | REQUIRED | 순수 reconcile 함수 | 신규/기존/소실 3집합의 차집합 + 보호 임계 | required — 보호 임계 비교 부호를 뒤집는 변이 (AC25) | EP-13 (1) |
| VP-15 | MD-02 ↔ UT-02 | REQUIRED | 순수 TTL 경계 함수 | 14일 ±1초 경계 3케이스 | not selected — 경계값을 직접 단언한다 | EP-03 (3) |
| VP-16 | MD-03 ↔ UT-03 | REQUIRED | 순수 질의 빌더 | 길이별 분기(1·2·3·4글자) 반환 형태 | not selected — 반환 문자열을 직접 단언한다 | EP-04 (2) |
| VP-17 | MD-04 ↔ UT-04 | REQUIRED | 순수 MIME 정규화 | From/To/Cc/Subject/Body 5필드 + 인코딩 3종 | required — 5필드 중 하나를 빼는 변이 5종 (D-010 전수) | EP-14 (1) |
| VP-18 | MD-05 ↔ UT-05 | REQUIRED | 순수 freshness 함수 | 5분 ±1초 경계 3케이스 | not selected — 경계값 직접 단언 | EP-06 (2) |
| VP-19 | MD-06 ↔ UT-06 | REQUIRED | 순수 파일명 정규화 | 경로 이탈·Windows 예약어·중복 이름 | not selected — 반환값 직접 단언 | EP-01 (4) |
| VP-22 | R-05 ↔ AT-19 | REQUIRED | 연결 탭 → `login()` → verifier → `pop3/session.ts` → 커밋 여부 | 실패 step + vault 쓰기 0회 + status + 두 문구 대조 (AC29) | required — verifier 결과를 무시하고 항상 커밋하는 변이 · 두 실패 문구를 맞바꾸는 형제 변이 | EP-17 (3) |
| VP-23 | AR-06 ↔ IT-06 | REQUIRED | `bootstrap.ts` 주입부 → `login.ts` probe 분기 → 기존 HTTP 경로 | 미주입 Auth 2종의 `deps.request` 호출 횟수·커밋 여부 불변 (AC30) + 부팅 `resume()`에서 verifier 호출 **0회**(D-042) | required — 분기를 뒤집어 모든 Auth가 verifier를 타게 하는 변이 · `candidate` 조건을 지워 resume도 타게 하는 변이 | EP-17 (3) |
| VP-21 | AR-05 ↔ IT-05 | REQUIRED | `pop3/errors.ts` → 주입된 reporter → `markExpired` → `AuthChange` → `binding.sync()` | reporter 호출 횟수 + `registry.remove`/`add` 횟수 (AC28) | required — reporter를 no-op으로 두는 변이(도구가 등록된 채 남는다) | EP-16 (2) |
| VP-20 | MD-07 ↔ UT-07 | REQUIRED | `session.ts` 명령 게이트 → fake 서버 수신 로그 | 양성: 허용 6명령이 실제로 수신된다. 음성: `DELE` 부재 (AC26) | required — 화이트리스트에 `DELE`를 더하는 변이가 게이트를 red로 만드는지 | EP-15 (1) |

`NOT_REQUIRED` 행 없음 — V1은 Baseline이라 상속한 pair가 없다.

**V1 합계 검산**: 설계 node `R 6 · SD 3 · AR 6 · MD 7 = 22` ↔ 검증 node `AT 19 · ST 3 · IT 7 · UT 7 = 36`(AT-01~19 · ST-01~03 · IT-01·02·03a·03b·04·05·06 · UT-01~07). pair `VP-01~VP-23 = 23`, 전부 `REQUIRED`. §10 강제 지점 군 `EP-01~EP-17 = 17`, 지점 합 `4+2+3+2+3+2+3+1+2+2+2+3+1+1+1+2+3 = 37`.

### ΔV1 — r1 PLAN_GAP 정정분

> V1을 상속하되 아래 행만 덮는다. 여기 없는 V1 node·pair는 `INHERITED` + `REQUIRED`로 그대로 유효하다 — 구현 미착수라 비영향 판정(`NOT_REQUIRED`)을 쓸 자리가 없다.

| Node | 레벨 | provenance | 무엇이 바뀌었나 | 기준선 출처 / 대체 |
|---|---|---|---|---|
| R-02 | R | **CHANGED** | 실패 후 캐시 검색의 범위가 **비인증 5종**으로 좁혀졌다 (D-045) | V1 R-02 |
| R-04 | R | **CHANGED** | 검색 결과가 첨부 매니페스트를 싣고 `hasAttachments`가 사라졌다 (D-043) | V1 R-04 |
| R-07 | R | **NEW** | 첨부 식별과 수신 — 매니페스트 → 단건 다운로드 왕복 (D-043·D-044) | — |
| AR-05 | AR | **CHANGED** | 강등 되먹임에 **비인증 오류의 비-강등** 방향이 더해졌다 (D-045) | V1 AR-05 |
| MD-01 | MD | **CHANGED** | 보호가 막는 대상이 *삭제* → **재수집**으로 바뀌고, 일반 소실은 본문을 남긴다 (D-046·D-047) | V1 MD-01 |
| MD-08 | MD | **NEW** | 보호 상태 전이 — 진입·유지·해제·리셋 (D-047) | — |
| AT-05 · AT-11 | AT | **CHANGED** | R-02·R-04의 oracle 갱신 | V1 AT-05·AT-11 |
| AT-20 · AT-21 | AT | **NEW** | AC31·AC32 | — |
| IT-05 | IT | **CHANGED** | AC28 — 호출 횟수 proxy → registry **상태** 관측 | V1 IT-05 |
| IT-05b | IT | **NEW** | AC28b — 비인증 5종 음성 축 | — |
| UT-01 | UT | **CHANGED** | AC25 — 판별자가 `removed:0` → **RETR 횟수** | V1 UT-01 |
| UT-01b · UT-08 | UT | **NEW** | AC25b · AC33 | — |

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-02 | R-02 ↔ AT-04·05·06 | REQUIRED (CHANGED) | 비인증 오류 주입 → `mail_search` handler → mail DB → 결과 | 5종 각각의 `total`·`stale`·`cacheAsOf` + Auth 상태가 `valid` 유지 | required — 비인증 오류 하나를 `authFailure:true`로 매핑하는 변이(AC5·AC28b가 red여야 한다) | EP-02 (2) · EP-16 (3) |
| VP-04 | R-04 ↔ AT-10·11·12·13 | REQUIRED (CHANGED) | 도구 3종 결과 조립 + 오류 매핑 → tool result | 양성: `attachments[]` 4키 존재. 음성: 내부 루트·`stored_name`·`hasAttachments` 부재 | required — 매니페스트에 `stored_name`을 싣는 변이 · 내부 경로를 그대로 싣는 변이 4종 | EP-01 (4) |
| VP-24 | R-07 ↔ AT-20·21 | REQUIRED (NEW) | `mail_search` 매니페스트 → 모델 → `mail_getAttachment(mailId, attachmentId)` ×N | 3건 왕복의 `filename`·`bytes` 일치 + 스키마 3케이스 | required — **매니페스트를 지우는 변이**(producer 소멸, r1 G1의 상태) · 둘 중 하나를 optional로 되돌리는 변이 | EP-01 (4) · EP-18 (1) |
| VP-05 | R-05 ↔ AT-14·15·18 | **REGRESSION** | Auth change → `binding.sync()` → `RuntimeToolSink` | D-045가 이 경로의 의미를 확정했으므로 V1 동작(서버 단위 add/remove)이 그대로인지 다시 닫는다 | required — 도구별 게이팅을 도입하는 변이(`plugins.test.ts:71` 잠금이 red여야 한다) | EP-05 (3) |
| VP-14 | MD-01 ↔ UT-01·01b | REQUIRED (CHANGED) | `mail_sync` → `reconcile.ts` → `protection.ts` → 수집 분기 | 진입·경계·표본 5케이스의 **RETR 호출 횟수** + 일반 소실의 행 수 불변 | required — 임계 비교 부호를 뒤집는 변이 · `MIN_LEDGER_SAMPLE`을 지우는 변이 · 일반 소실에서 본문을 지우는 변이 | EP-03 (4) · EP-13 (2) |
| VP-25 | MD-08 ↔ UT-08 | REQUIRED (NEW) | `sync-manager` → `protection.ts` → `sync_state.protection_state` | 순수 `decideProtection()` 4케이스의 `{protection, ingest}` | required — `CONFIRM_OBSERVATIONS`를 1로 낮추는 변이 · fingerprint 비교를 지워 리셋이 안 되는 변이 | EP-19 (3) |
| VP-21 | AR-05 ↔ IT-05·05b | REQUIRED (CHANGED) | `pop3/errors.ts` → reporter → `markExpired` → `AuthChange` → `binding.sync()` | registry snapshot의 mail 서버 수(1 → 0) + 비인증 5종에서 reporter 0회·서버 1개 | required — reporter를 no-op으로 두는 변이 · 모든 오류를 `authFailure:true`로 뭉개는 변이 | EP-16 (3) |

**ΔV1 합계 검산**: 변경·신규 설계 node `R 3(R-02·R-04·R-07) · AR 1 · MD 2 = 6` ↔ 변경·신규 검증 node `AT 4 · IT 2 · UT 3 = 9`. `ΔV1` pair `6 REQUIRED + 1 REGRESSION = 7`.
**유효 V(`V1 + ΔV1`) 합계**: 설계 node `R 7 · SD 3 · AR 6 · MD 8 = 24` ↔ 검증 node `AT 21 · ST 3 · IT 8 · UT 9 = 41`. pair `VP-01~VP-25 = 25`. §10 강제 지점 군 `EP-01~EP-19 = 19`, 지점 합 `4+2+4+2+3+2+3+1+2+2+2+3+2+1+1+3+3+1+3 = 44`.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree — lint | `app/**`를 수정한다 | `cd app && npm run lint` | 이번 변경이 만든 error만 blocking. 기존 warning 1건은 기준선 |
| subtree — typecheck | 신규 타입·계약이 3구성에 걸린다 | `cd app && npm run typecheck` | 이번 변경 유발분만 |
| subtree — 순수 테스트 | 신규 스위트가 전부 비-DB 순수다 | `cd app && ./node_modules/.bin/vitest run src/main/features/plugins/mail src/main/infra/net src/main/app/deployment` | 이번 변경 유발분만 |
| subtree — 마이그레이션 가드 | mail 마이그레이션을 신설하고 가드를 일반화한다 | `cd app && node scripts/check-migrations-appendonly.mjs` + `node --test scripts/check-migrations-appendonly.test.mjs` | 이번 변경 유발분만 |
| repository — 문서 인벤토리 | `docs/` 문서를 갱신한다 | `cd app && node scripts/check-doc-inventory.mjs --check` | 수치 재서술·깨진 상대링크만 |
| message-bus — 커밋 trailer | 설계 커밋에 trailer를 단다 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |
| 환경 한계 (비-blocking) | better-sqlite3 ABI가 egress 차단으로 못 붙을 수 있다 | `app/AGENTS.md §제약 환경 게이트 가이드`의 알려진 5파일 | 코드 무관 — 기준선으로 분리 보고 |
| 사람 실기 (비-blocking) | 실 POP3 서버 TLS·사설 CA·실 인코딩 | 폐쇄망 배포에서 1회 | 기계 판정 대상 아님 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| # | 발견 / 제약 | 근거 |
|---|---|---|
| F-01 | Orca의 Plugin(A)은 `features/plugins/<name>/` 수직 슬라이스이고 등록은 `app/deployment/plugins.ts`가 한다 | `docs/arch/backend/auth.md §7`·`docs/GLOSSARY.md:43` |
| F-02 | `src/main` 전체에 raw 소켓 import가 **0건**이다 | `grep -rnE "from '(node:)?(net\|tls\|dgram)'\|require\('(node:)?(net\|tls)'\)" src/main --include=*.ts \| wc -l` → `0` |
| F-03 | `security.md §1.8`은 main의 모든 원격 요청을 Chromium 스택으로 고정한다. 강제는 `infra/net/no-node-fetch.test.ts`인데 **전역 `fetch(`만** 본다 | `docs/arch/backend/security.md §1.8` · `src/main/infra/net/no-node-fetch.test.ts:22` `GLOBAL_FETCH` 정규식 |
| F-04 | `AuthenticatedRequest`는 HTTP 전용이다 — `path`·`method`·`headers`·`query`·`body`·`authFailureStatuses` | `src/main/contracts/auth.ts:310-326` |
| F-05 | raw credential 소비 지점은 프로덕션에 **2곳**이다 | `src/main/app/bootstrap.ts:385`(`mcp.attachTokenSource`) · `:526`(`DIRECT_CREDENTIAL_AUTH_IDS`). `src/main/app/context.ts:51`은 "여기 없다"는 주석 |
| F-06 | `AuthDefinition.origin`은 bare HTTP(S) origin만 받는다 | `src/main/features/auth/registry.ts:43` `isBareOrigin` — `url.origin === raw && url.origin !== 'null'` |
| F-06b | `AuthProbe`도 HTTP 전용이고, **미선언이면 검증 없이 `valid`가 된다** | `contracts/auth.ts` `AuthProbe = Pick<AuthenticatedRequest, 'path'\|'method'\|'headers'\|'authFailureStatuses'>` · `features/auth/login.ts:499` `if (!probe \|\| !this.deps.request) return { ok: true, ... }` |
| F-06c | `BoundAuth`에는 Auth를 강등시키는 표면이 없다 — `authId`·`snapshot()`·`request()` 3개뿐 | `contracts/auth.ts:407-411`. 401 강등은 `authenticated-request.ts`가 HTTP status로만 한다 |
| F-21 | **게이트 멤버십과 Plugin 은 별개 경로다.** 기본 배포의 게이트 멤버는 빈 배열이고 Confluence·Jira도 들어 있지 않다 | `app/deployment/gate-auth.ts` `GATE_AUTH_DEFINITIONS: readonly GateAuthDefinition[] = []`. `bootstrap.ts:402` `createPluginBindings(...)`는 `gateSelection`과 다른 인자를 받고, `:413` `createConnectionSources`가 `gateMembers`와 `plugins`를 따로 조립한다 |
| F-22 | **대상 폐쇄망은 ADFS 게이트를 운영 중이다**(사용자 진술). 그래서 나머지 Auth 복원은 게이트 통과 뒤로 밀린다 | `docs/arch/backend/auth.md §5.2` — `gate Auth 순차 확인 → 나머지 Auth 병렬 확인`. Mail은 probe 미선언(D-032)이라 probe 후보가 아니고 왕복 0이다 |
| F-23 | 자동 재로그인 대상은 `methods[0]`이 `browser-session`·`oauth`인 것뿐이다 — **입력형은 제외**된다 | `auth.md §5.2` 재로그인 대상 행 — "입력형은 입력 없이 부르면 네트워크를 타지 않고 전역 `input-required` step 만 남긴다" |
| F-24 | **Auth 강등 경로는 둘뿐이고 POP3는 어느 쪽도 타지 않는다** | `auth.md §4.5` 관측 지점 표 — ① 요청 경로의 `authFailureStatuses`(HTTP status) ② `resume()` probe 실패. `AuthRuntime` 표면(`contracts/auth.ts`)에 강등 보고 메서드가 없다(F-06c) |
| F-27 | 입력형 Auth의 probe 실패는 `probe_failed`가 아니라 **`input-required` + 고정 메시지**로 돌아간다 | `login.ts:712-716` — `message: '자격증명이 거부되었습니다. 값을 확인해 주세요.'`. `shared/ipc.ts` `ProviderFailureReason.probe_failed` 주석도 "입력 폼이 있는 방식은 이 대신 `input-required` 로 되돌아간다" |
| F-28 | `probe()` 호출부는 **2곳**이고 `candidate` 유무가 login과 resume을 가른다 | `login.ts:336` `await this.probe(definition)`(resume) · `:567` `await this.probe(definition, candidate)`(login settle) |
| F-29 | 렌더러는 **다중 자격증명 필드를 이미 렌더한다** | `ProviderDetail.tsx:178` `fields.map(...)` · `:182` `type === 'password' ? 'password' : 'text'` · `GateLogin.tsx:140`·`:148`(`autoComplete` 분기까지) |
| F-30 | `passwordSpec`은 `user:pass`로 합성하고 `principalId`에 아이디를 싣는다. 아이디의 `:`를 거부한다. **프로덕션 사용처는 0건** | `features/auth/specs/credential.ts` `passwordSpec` · `rg 'passwordSpec' src/main --glob '!*.test.ts'` → 정의부 외 0건 |
| F-31 | `RuntimeToolContext`는 **없을 수 있다** | `adapters/claude.ts:503`·`:511`이 `req.runtimeToolContext`를 넘기지만 `features/sessions/session-runtime.ts:832`가 `runtimeToolContext: this.runtimeToolContext ?? undefined`다. 계약도 `handler(input, context?)`로 optional이다 |
| F-32 | `structuredContent`의 **앱 내 소비처는 0건**이다 — MCP passthrough로 모델에만 간다 | `rg structuredContent src --glob '!*.test.*'` → 생산 `features/plugins/jira/result.ts:91`, 타입 선언 `adapters/runtime-tools.ts:39`. renderer 소비 0건 |
| F-26 | `node-pop3@0.15.3`은 `USER`/`PASS`를 하드코딩하고 **SASL·`AUTH` 경로가 없다.** `CAPA`조차 `_connect()`로 먼저 로그인한 뒤 능력을 읽는다 | 패키지 소스 `src/Command.js:90-91`(`super.command('USER'…)` → `super.command('PASS'…)`) · `:99` `CAPA()` 첫 줄이 `await this._connect()` |
| F-25 | `SPAWN_ENV_INJECTOR`의 `NODE_EXTRA_CA_CERTS`는 **Harness subprocess** env다 — Orca 자기 프로세스의 `node:tls`에는 적용되지 않는다 | `app/deployment/spawn-env.ts` 헤더 "모든 Harness+ModelProvider 의 subprocess env 에 그 반환값이 실린다" · 예제는 `deployment-wiring.test.ts:619` |
| F-07 | FTS5 tokenizer 선택이 한국어 결과를 가른다 | 실측 (아래 §수치 검산) |
| F-08 | `readOnlyHint !== true`면 승인 대상이다 (fail-closed) | `src/main/adapters/runtime-tool-policy.ts:19-28` |
| F-09 | `descriptor.instructions`가 SDK MCP 서버로 전달된다 | `src/main/adapters/claude-runtime-tools.ts:92` |
| F-10 | 라이브러리 후보 실측 (npm registry, 2026-09-18 조회) | 아래 비교표 |
| F-11 | `node-pop3@0.15.3`은 implicit TLS만 지원한다 | 패키지 소스 `src/Connection.js:236` `_tls.connect`. `STLS`·`starttls` 문자열 **0건** |
| F-12 | `postal-mime@3.0.0`은 `TextDecoder`로 charset을 처리하고 미지원 charset은 `windows-1252`로 폴백한다 | 패키지 소스 `src/decode-strings.js:117`·`:140` |
| F-13 | Node 22의 `TextDecoder`는 `euc-kr`을 지원하고 `iso-2022-kr`은 지원하지 않는다 | 실측 (아래 §수치 검산) |
| F-14 | 마이그레이션 append-only 가드는 단일 디렉터리에 하드 앵커돼 있다 | `app/scripts/check-migrations-appendonly.mjs:20-21` |
| F-15 | Jira 첨부는 Temp 하위에 staging → rename으로 공개하고 `savedPath`를 결과에 싣는다 | `src/main/features/plugins/jira/attachment-store.ts` · `service.ts:200` |
| F-16 | Artifact 자동 수집은 temp 루트 **바로 아래 파일 + Work 에이전트** 한정이다 | `docs/arch/backend/persistence.md §1.4` · `src/main/features/artifacts/output-files.ts` |
| F-17 | `ArtifactRef['kind']`에 office·pdf가 없다 | `src/shared/artifacts.ts:7` — `'html' \| 'markdown' \| 'text' \| 'image' \| 'file'` |
| F-18 | eslint `boundaries`의 feature capture는 `src/main/features/*`라 `plugins` 전체가 **한 요소**다 | `app/eslint.config.mjs:17` — `pattern: 'src/main/features/*'`, `capture: ['feature']` |
| F-19 | 기본 OSS 배포의 `createPluginBindings()`는 `[]`를 돌려준다 | `src/main/app/deployment/plugins.ts:83-88` |
| F-20 | Temp 앱 폴더 준비는 symlink·비디렉터리를 거부한다 | `src/main/infra/config/temp-path.ts` `plainDirectory` |

### 라이브러리 후보 비교 (F-10)

| 패키지 | 최신 | 게시일 | 라이선스 | 의존성 | 크기(unpacked) | 판정 |
|---|---|---|---|---|---|---|
| `node-pop3` | 0.15.3 | 2026-09-16 | MIT | **0** | 115 KB | **채택** — `UIDL`·`TOP`·`RETR`·`STAT`·`CAPA`·`supports()` 제공, `engines: ^20.11.0 \|\| >=22`. `USER`/`PASS` 전용이라 D-039 범위와 일치한다(F-26) |
| `yapople` | 0.4.10 | 2024-05-17 | MIT | 1 | — | 미채택 — 2년 미갱신 |
| `poplib` | 0.1.7 | 2014-04-04 | MIT | 1 | — | 미채택 — 12년 미갱신 |
| `postal-mime` | 3.0.0 | 2026-08-11 | MIT-0 | **0** | 317 KB | **채택** — `from`/`to`/`cc`/`subject`/`text`/`html`/`attachments[]` 제공, ESM+CJS 양쪽 export |
| `mailparser` | 3.9.28 | 2026-09-15 | MIT | **10** (`nodemailer`·`html-to-text`·`iconv-lite` 등) | 79 KB (+전이) | 미채택 — 전이 의존 10개가 승인 범위를 넓힌다 |
| `letterparser` | 0.1.8 | 2024-09-19 | BSD-3-Clause-Clear | 2 | — | 미채택 — 2년 미갱신 |
| `emailjs-mime-parser` | 2.0.7 | 2019-03-25 | MIT | 3 | — | 미채택 — 7년 미갱신 |

트레이드오프: `mailparser`는 `iconv-lite`로 `iso-2022-kr`까지 디코드하지만 `postal-mime`은 못 한다(F-13). **사용자가 그 1종을 미지원으로 확정했다**(D-033) — `postal-mime`이 `windows-1252`로 폴백해 그 메일은 깨진 채 색인된다. 관측되는 결과와 범위는 §17에 적었다.

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---|---|
| main의 raw 소켓 import | `grep -rnE "from '(node:)?(net\|tls\|dgram)'..." src/main --include=*.ts` | **0** | AR-01이 최초 도입이다. 유일성 가드의 분모가 0에서 1로 간다 |
| `features/plugins/*` 슬라이스 | `ls -d src/main/features/plugins/*/` | **2** | confluence · jira. mail이 3번째다 |
| `RuntimeToolSink.add` 프로덕션 호출부 | `grep -rn "registry\.add" src/main --include=*.ts \| grep -v '\.test\.'` | **1** | `app/deployment/plugins.ts:59` — 등록 경로가 하나다 |
| `secretReader` 프로덕션 소비 | `grep -rn "secretReader" src/main/app/bootstrap.ts` | **2** | `:385`·`:526`. AR-02가 3번째를 만든다 |
| `orcinus-orca.db` 마이그레이션 | `ls src/main/infra/db/migrations/*.sql \| wc -l` | **27** | D-011에 의해 이 수는 변하지 않는다 |
| `features/` 최상위 슬라이스 | `ls -d src/main/features/*/` | **15** | mail은 `plugins` 하위라 인벤토리 수치가 변하지 않는다 |
| 마이그레이션 가드의 디렉터리 앵커 | `grep -n "MIGRATIONS_DIR\|MIGRATE_SOURCE" scripts/check-migrations-appendonly.mjs` | **2** | 두 상수가 단일 경로다 — AR-03이 목록화한다 |

### 수치 / 전칭 표현 검산

- **FTS5 tokenizer (F-07)** — `python3` sqlite 3.45.1로 실측. `'다음주 회의일정 안내드립니다'` 색인 후:
  - `unicode61` + `MATCH '일정'` → **0건** · `MATCH '"회의"*'` → **1건** (어절 접두만 매치)
  - `trigram` + `MATCH '회의일'`(3글자) → **1건** · `MATCH '의일정'` → **1건** · `MATCH '일정'`(2글자) → **0건**
  - `trigram` + `LIKE '%일정%'` → **1건** · `LIKE '%회의%'` → **1건**
  - 결론: trigram은 3글자 이상 MATCH, 2글자 이하 LIKE로 갈라야 한다 → MD-03의 길이 분기 근거.
- **tokenizer 가용성** — `unicode61`·`trigram`·`porter`·`ascii` 네 종 모두 `CREATE VIRTUAL TABLE` 성공. `trigram`은 SQLite 3.34+ 기본 제공이라 better-sqlite3 번들에서 별도 확장이 필요 없다.
- **인코딩 (F-13)** — Node v22.22.2 `new TextDecoder(x)` 실측: `euc-kr` **OK**(`-> euc-kr`) · `ks_c_5601-1987` **OK**(`-> euc-kr`) · `big5` OK · `shift_jis` OK · `iso-2022-kr` **FAIL**(`The "replacement" encoding is not supported`).
- **`pop3s://` origin (F-06)** — `new URL('pop3s://mail.example.corp:995').origin` → `'null'` · `'pop3://…:110'` → `'null'` · `'https://mail.example.corp:995'` → `'https://mail.example.corp:995'`. 앞 둘은 `isBareOrigin` **false**.
- **"유일한/항상" 반례 확인** — "main의 모든 원격 요청은 Chromium 스택"(§1.8)의 반례를 `src/main` 전수로 찾았고 현재 **0건**이다. 이 plan이 최초의 문서화된 예외를 만든다.
- **문서 앵커 존재 확인** — `docs/arch/backend/security.md §1.8`·`§1.9` 실재 · `docs/arch/backend/auth.md §7`·`§7.1`·`§11` 실재 · `docs/guides/closed-network-extensions.md §0`·`§4`·`§5` 실재 · `docs/arch/backend/persistence.md §1.4` 실재. 인용한 기존 테스트 케이스는 없다(전부 신규).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: 없음 — 메일 기능이 존재하지 않는다.
- 현재 책임 소유자: 없음. 사용자가 메일 클라이언트에서 직접 찾아 붙여 넣는다.
- 현재 entry → flow → store → consumer: Plugin 계열의 현재 경로는 **HTTP 하나**다 — 도구 handler → `BoundAuth.request` → `infra/net/transport.ts` → `net-fetch.ts` → Chromium `net.fetch`.
- 현재 오류/취소/정리 경로: `AuthenticatedResponse.status`가 401/403이면 Auth가 강등되고 `sync()`가 도구를 회수한다. 취소는 `RuntimeToolContext.getSignal()`.
- 구조적 제약: **비-HTTP 프로토콜을 표현할 자리가 없다.** `AuthenticatedRequest`에 `path`·`method`·`headers`만 있고(F-04), `AuthDefinition.origin`이 HTTP scheme만 받는다(F-06).

```text
[모델 tool call]
  → [features/plugins/{confluence,jira}/tools.ts]
  → [BoundAuth.request  (HTTP 전용)]
  → [infra/net/transport.ts → net-fetch.ts]
  → [Chromium net.fetch]              ← OS 프록시·PAC·OS 인증서 저장소를 본다
  → [tool result]
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`~`SD-03` · `AR-01`~`AR-04` · `MD-01`~`MD-06`.
- 변경 후 책임 소유자: `features/plugins/mail/`이 POP3 세션·캐시·TTL·검색·첨부를 소유한다. 전송 프리미티브는 `infra/net/pop3-socket.ts`가, 자격증명 주입은 컴포지션 루트가 소유한다.
- 유지하는 기존 메커니즘: Plugin binding 등록·Auth 상태 gating·`RuntimeToolRegistry` 동등성·Temp staging→rename·취소 신호.
- 신설하는 메커니즘: raw TLS 소켓 경계(AR-01) · 세 번째 secret 소비자(AR-02) · 두 번째 SQLite DB와 그 마이그레이션 러너(AR-03).
- 제거하는 메커니즘: 없음.

```text
[모델 tool call: mail_sync]
  → [features/plugins/mail/tools.ts]
  → [sync-manager.ts  ── single-flight(authId)]
      ├─ freshness.ts (순수)      5분 판정
      ├─ retention.ts (순수)      14일 경계 → cleanup 대상
      ├─ store/ (mail.db)         ledger·본문·FTS·첨부 메타
      └─ pop3/session.ts
           → [infra/net/pop3-socket.ts]   ← 유일한 tls.connect 지점
           → [node-pop3 Command: CAPA·UIDL·TOP·RETR·STAT·QUIT]
           → [postal-mime]  → normalize.ts (순수) → store/
  → [sync result DTO]

[모델 tool call: mail_search]
  → [features/plugins/mail/tools.ts]
  → [search.ts → query-builder.ts (순수) → mail.db FTS5(trigram)]
  → [search result DTO + cacheAsOf + stale]      ← 네트워크 경로 없음

[모델 tool call: mail_getAttachment]
  → [attachment-export.ts]
  → [<userData>/plugins/mail/<accountId>/attachments/…]  읽기 전용
  → [OS Temp/orcinus-orca/mail/<accountId>/<batch>/  staging → rename]
  → [{ filename, bytes, savedPath }]             ← 내부 경로 미포함
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 원격 전송 | Chromium `net.fetch` 단일 스택 | HTTP는 그대로, **POP3만 `infra/net/pop3-socket.ts`** 예외 | POP3는 HTTP가 아니라 Chromium 스택으로 표현 불가 (F-02·F-03) | AR-01 / VP-10 · `infra/net/pop3-socket.ts` |
| 자격증명 | 소비자 2곳 (`${BINDING:}`·Harness) | **3곳** — mail plugin closure 추가 | `BoundAuth.request`가 POP3를 못 싣는다 (F-04) | AR-02 / VP-11 · `app/bootstrap.ts` |
| 영속 | `orcinus-orca.db` 단일 | `orcinus-orca.db` 불변 + **`mail.db` 신설** | D-011 — Core DB에 메일 테이블 추가 금지 | AR-03 / VP-12 · `plugins/mail/store/` |
| 마이그레이션 가드 | 단일 디렉터리 하드 앵커 | **디렉터리 목록**으로 일반화 | 두 번째 DB가 가드 밖이면 append-only가 안 걸린다 (F-14) | AR-03 / VP-12 · `scripts/check-migrations-appendonly.mjs` |
| 검색 색인 | `messages_fts` = `unicode61` | mail FTS = **`trigram`** | 한국어 어절 중간 매치 0건 (§8 실측) | MD-03 / VP-06 · `store/schema` |
| 도구 표면 | plugin당 도구 N개, 승인은 `readOnlyHint` | 도구 3종, `mail_search`만 자동 통과 | 원격 I/O·디스크 쓰기를 fail-closed로 (F-08) | AR-04 / VP-13 · `tools.ts` |
| 첨부 | Jira: Temp staging→rename, `savedPath` 반환 | **같은 형상 재사용** | 검증된 선례를 복제하지 않고 구조만 따른다 (F-15) | MD-06 / VP-04 · `attachment-export.ts` |
| 오류 경계 | HTTP status 기반 강등 | POP3 응답 코드 → Auth 강등 매핑 신설 | `-ERR` 인증 실패를 401 등가로 해석해야 도구 회수가 돈다 | SD-02 / VP-08 · `pop3/errors.ts` |
| 테스트 seam | electron 미의존 순수 모듈 분리 관례 | 동일 — 소켓 팩토리를 포트로 주입 | `pop3-socket.ts`는 `node:tls`를 물어 테스트가 직접 import하면 안 된다 | MD-01~06 / VP-14~19 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `infra/net/pop3-socket.ts` | TLS/TCP 소켓 생성 **한 곳** | `{host, port, tls, tlsOptions, servername}` → `Duplex` | `app/bootstrap.ts`만 (팩토리로 주입) |
| `features/plugins/mail/pop3/session.ts` | POP3 명령 시퀀스 · 화이트리스트 게이트 | 소켓 팩토리 + 자격증명 → 명령 결과 | mail 슬라이스 내부 |
| `features/plugins/mail/sync-manager.ts` | freshness → cleanup → 증분 → 영속 오케스트레이션 · single-flight | 도구 입력 → sync DTO | `tools.ts` |
| `features/plugins/mail/store/` | mail.db 연결 · 마이그레이션 · ledger/본문/FTS/첨부 메타 질의 | SQL | mail 슬라이스 내부 |
| `features/plugins/mail/normalize.ts` | MIME → 검색 문서 (순수) | `postal-mime` 결과 → `MailDocument` | `sync-manager.ts` |
| `features/plugins/mail/reconcile.ts` | UIDL 3분류 + 잔존 비율·fingerprint 계산 (순수) | `{local[], remote[]}` → `{new[], known[], missing[], retainedRatio, sampleSize, remoteFingerprint}` | `sync-manager.ts` |
| `features/plugins/mail/protection.ts` | 보호 상태 전이 — 진입·유지·해제·리셋 (순수, MD-08) | `{previous, retainedRatio, sampleSize, remoteFingerprint, now}` → `{protection, ingest}` | `sync-manager.ts` |
| `features/plugins/mail/retention.ts` | 14일 경계 판정 (순수) | `{now, headerDate, firstSeenAt}` → `boolean` | `sync-manager.ts` |
| `features/plugins/mail/freshness.ts` | 5분 판정 (순수) | `{now, lastSyncAt}` → `boolean` | `sync-manager.ts` |
| `features/plugins/mail/query-builder.ts` | FTS 질의 생성 · 길이 분기 (순수) | 질의 문자열 → `{mode:'match'\|'like', sql}` | `search.ts` |
| `features/plugins/mail/attachment-export.ts` | Temp staging→rename · 경로 은닉 | `{mailId, attachmentId}` → `{savedPath}` | `tools.ts` |
| `features/plugins/mail/tools.ts` | descriptor + 3 handler + 결과 조립 | `RuntimeToolServer` | `app/deployment/plugins.ts` |

## 10. 계약 / 타입 / 강제 지점

| EP | V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (지점 전수) | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 | R-04·R-07 / VP-04·VP-19·VP-24 | 내부 경로와 `stored_name`은 어떤 출력에도 없다. 첨부는 **불투명 `attachmentId`로만** 지칭한다 | `tools.ts` 결과 조립기 | mail 슬라이스 | **4지점** — `mail_search` 결과(매니페스트 포함) · `mail_getAttachment` 결과 · 오류 매핑 · `structuredContent` | 사용자·모델이 플러그인 내부 저장 구조를 본다. D-012·D-043 위반 |
| EP-02 | R-02 / VP-02 | `mail_search`는 소켓을 열지 않는다 | `search.ts` 시그니처 | mail 슬라이스 | **2지점** — `search.ts`가 소켓 팩토리를 인자로 받지 않음(타입) · 도구 조립에서 `mail_search` handler에 팩토리 미전달(배선) | D-015 위반. 검색이 네트워크 지연·실패를 탄다 |
| EP-03 | R-03 / VP-03·VP-14·VP-15 | 14일 초과 데이터는 검색 대상이 아니고, **삭제 기준은 retention 하나뿐이다** | `retention.ts` | mail 슬라이스 | **4지점** — `mail` 행 삭제 · `mail_fts` 행 삭제 · 첨부 파일 삭제 · **삭제 호출부가 retention 경로 하나뿐**(전수 grep — UIDL 소실 경로에 삭제 0건, D-046) | 만료 메일이 검색되거나 디스크에 남는다. 또는 UIDL 소실이 두 번째 삭제 기준이 된다 — 둘 다 D-004 위반 |
| EP-04 | R-06 / VP-06·VP-16 | 질의는 길이에 따라 MATCH/LIKE로 갈린다 | `query-builder.ts` | mail 슬라이스 | **2지점** — 스키마의 `tokenize='trigram'` · 질의 빌더의 길이 분기 | 한국어 2글자 질의가 0건이 된다. D-024 위반 |
| EP-05 | R-05 / VP-05 | Auth가 `valid`일 때만 도구가 등록되고, 자격증명 거부는 고유 코드로 구분된다 | `createPluginBinding.sync` (기존) + `pop3/errors.ts` | 컴포지션 루트 + mail 슬라이스 | **3지점** — 부팅 초기 sync · Auth change 리스너 · `PASS` 응답 `-ERR` 매핑 | 미인증에서 도구가 보이거나, 틀린 비밀번호가 네트워크 오류로 보여 사용자가 재인증하지 않는다 |
| EP-06 | R-01 / VP-01·VP-07·VP-18 | 5분 이내면 POP3에 연결하지 않는다 | `freshness.ts` | mail 슬라이스 | **2지점** — `sync-manager` 진입 판정 · single-flight 캐시 히트 경로 | 연속 검색이 POP3를 반복 호출해 서버 부하를 만든다. D-008 위반 |
| EP-07 | SD-02 / VP-08 | 실패·취소는 `lastSyncAt`을 갱신하지 않는다 | `sync-manager.ts` | mail 슬라이스 | **3지점** — 연결 실패 · 명령 실패 · abort | stale이 fresh로 보여 다음 5분간 재시도가 막힌다. D-045 위반 |
| EP-08 | SD-03 / VP-09 | 동일 `authId`의 동시 sync는 하나다 | `sync-manager.ts` in-flight 맵 | mail 슬라이스 | **1지점** — handler 진입 | 중복 POP3 접속·중복 insert. D-016 위반 |
| EP-09 | AR-01 / VP-10 | 소켓 생성은 `pop3-socket.ts` 하나다 | `infra/net/pop3-socket.ts` | infra + 가드 | **2지점** — 음성 스윕(import 0건) · 양성 단언(실제 `tls.connect` 진입) | 두 번째 소켓 지점이 생겨 §1.8 경계가 문서와 갈린다 |
| EP-10 | AR-02 / VP-11 | Plugin은 `AuthSecretReader`를 받지 않는다 | `createMailPlugin` 시그니처 | 컴포지션 루트 | **2지점** — factory 시그니처가 `() => string \| null` closure만 받음(타입) · `bootstrap.ts` 주입부 | secret 표면이 feature로 넓어진다. `auth.md §11` 위반 |
| EP-11 | AR-03 / VP-12 | mail 마이그레이션도 append-only다 | `check-migrations-appendonly.mjs` | CI 가드 | **2지점** — 가드의 디렉터리 목록 · mail `migrate.ts`의 `?raw` 집합 일치 | 머지된 마이그레이션이 조용히 수정돼 기존 설치가 깨진다 |
| EP-12 | AR-04 / VP-13 | 도구 3종의 `readOnlyHint`는 `[false, true, false]`다 | `tools.ts` descriptor | mail 슬라이스 | **3지점** — 세 도구 각각의 annotations | 원격 I/O·디스크 쓰기가 승인 없이 통과한다. D-028 위반 |
| EP-13 | MD-01 / VP-14 | 대량 소실은 **신규 UIDL 수집을 멈춘다**(삭제가 아니다 — D-046 아래 삭제는 애초에 0이다) | `reconcile.ts` 잔존 비율 + `protection.ts` 임계 | mail 슬라이스 | **2지점** — 잔존 비율·표본 계산(`reconcile.ts`) · 임계 `<0.5` ∧ 표본 `>=20` 비교(`protection.ts` 진입 분기) | 서버 교체 한 번이 10,000통을 다시 끌어와 14일 캐시와 중복시킨다. D-018·D-047 위반 |
| EP-14 | MD-04 / VP-17 | 검색 문서는 From·To·Cc·Subject·Body 5필드다 | `normalize.ts` | mail 슬라이스 | **1지점** — `MailDocument` 조립 | 선언한 검색 대상 중 일부가 실제로는 안 걸린다. D-010 위반 |
| EP-17 | AR-06 / VP-22·VP-23 | 연결은 실제 왕복으로 증명되고, 실패 사유가 구분되며, verifier 미주입 Auth는 불변이다 | `login.ts` probe 분기·거부 문구 + 컴포지션 루트 주입부 | auth 슬라이스 + 컴포지션 루트 | **3지점** — `login.ts`의 `candidate` 조건 verifier 분기 · `:716` 거부 문구 분기 · `bootstrap.ts`가 mail authId에만 주입 | 값만 넣어도 연결됨이 되거나, 도달 실패가 비밀번호 오류로 보이거나, 다른 Auth의 로그인 경로가 바뀐다 |
| EP-16 | AR-05 / VP-02·VP-21 | 자격증명 거부**만** Auth 강등으로 되먹여진다 | `pop3/errors.ts` 거부 판정 + 컴포지션 루트 주입 | mail 슬라이스 + 컴포지션 루트 | **3지점** — `-ERR` 인증 거부 판정 · **비인증 5종(연결·TLS·타임아웃·파싱·DB)의 `authFailure:false` 판정** · `bootstrap.ts` reporter 주입부 | 강등이 좁으면 비밀번호가 바뀌어도 도구가 남아 매번 실패한다. **넓으면 네트워크 한 번 끊긴 것이 도구 3종을 회수해 캐시 검색까지 끊는다** — D-045가 막는 쪽이다 |
| EP-15 | MD-07 / VP-20 | `DELE`를 보내지 않는다 | `pop3/session.ts` 명령 화이트리스트 | mail 슬라이스 | **1지점** — 명령 게이트 | 서버 메일함이 지워진다. 되돌릴 수 없다. D-031 위반 |
| EP-18 | R-07 / VP-24 | `mail_getAttachment`는 `mailId`·`attachmentId`를 둘 다 요구한다 | `tools.ts` 입력 스키마 | mail 슬라이스 | **1지점** — `mail_getAttachment` zod 스키마(둘 다 required, 추가 selector 키 없음) | 합집합 selector가 생겨 승인 1회로 전량 다운로드가 가능해진다. D-044 위반 |
| EP-19 | MD-08 / VP-25 | 보호는 비율 회복 또는 같은 fingerprint 2회 연속에서만 풀린다 | `protection.ts` 전이 함수 | mail 슬라이스 | **3지점** — 해제 2경로(회복·`CONFIRM_OBSERVATIONS` 도달) · 다른 fingerprint의 카운트 리셋 · `sync-manager`의 `ingest` 분기(RETR 호출 여부) | 안 풀리면 서버 교체 뒤 메일이 영구히 갱신되지 않는다(비범위인 renderer 화면이 없어 탈출구가 없다). 너무 쉽게 풀리면 일시 장애가 대량 재수집을 부른다 |

- 같은 규칙의 SSOT: "내부 경로 은닉"은 **결과 조립기 한 곳**이 소유한다. 각 handler가 각자 마스킹하면 네 번째 도구가 생길 때 새 누출 지점이 된다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: **없음.** 모든 행이 자기 지점의 관측으로 판정된다.
- **양방향으로 적은 행 (ΔV1)**: EP-03·EP-16·EP-19는 좁아도 넓어도 결함이라 `실패 의미`에 두 방향을 모두 적었다. 한 방향만 적으면 검사 장치도 한 방향만 생긴다 — r1 G2·G3이 그 상태였다.
- 선택적 필드의 `true/false/undefined`: `annotations.readOnlyHint`는 `undefined`가 **승인 대상**으로 접힌다(F-08, fail-closed) — 그래도 세 도구 모두 명시한다. `protection`은 `undefined`가 "보호 미발동"이고 `mail_sync` 결과에서 생략한다. `tlsOptions.ca`는 `undefined`가 "OS 기본 신뢰 저장소"이지 "검증 안 함"이 아니다 — `rejectUnauthorized`는 절대 `false`로 두지 않는다.
- 외부 SDK 경계의 실제 요구 타입: `node-pop3`의 `Connection`은 `{host, port, tls, tlsOptions, servername}`를 받고 `RETR`/`TOP`은 `Readable`을 돌려준다. `postal-mime`의 `PostalMime.parse()`는 `ArrayBuffer|Uint8Array|string`을 받는다. 두 패키지 모두 `type: "module"`이지만 CJS `require` export가 있어 electron-vite main 번들에서 쓸 수 있다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/infra/net/pop3-socket.ts` | **신규** — 소켓 생성 유일 지점 | `createPop3Socket(opts): Duplex`. `node:net`·`node:tls`를 무는 유일한 파일 | electron 미의존이나 `node:tls`를 물므로 **fake TLS 서버**로만 통합 테스트 |
| `app/src/main/infra/net/pop3-socket.guard.test.ts` | **신규** — 유일성 가드 | `no-node-fetch.test.ts`와 같은 `scanOffenders` 방식. 허용 목록 = `pop3-socket.ts` 1개 + 자기 정규식 오탐/미탐 고정 | 소스 문자열 스캔 (순수) |
| `app/src/main/features/plugins/mail/tools.ts` | **신규** — descriptor + 3 handler | `mailTools(ctx, options): RuntimeToolServer`. `instructions`에 "검색 전 `mail_sync`" 유도 + **"첨부는 `mail_search`가 준 `attachmentId`로 한 건씩 받는다"**(D-043·D-044). `mail_getAttachment` 스키마는 두 키 모두 required (EP-18) | 순수 — 의존 전부 주입 |
| `.../mail/sync-manager.ts` | **신규** — 오케스트레이션 + single-flight | `Map<authId, Promise<SyncResult>>` | 순수 — 소켓 팩토리·시계 주입 |
| `.../mail/pop3/session.ts` | **신규** — 명령 시퀀스 + 화이트리스트 (MD-07) | `node-pop3` `Command`를 감싸고 허용 6명령만 통과. `DELE`는 화이트리스트 밖이다 | 순수 — 소켓 팩토리 주입 |
| `.../mail/pop3/errors.ts` | **신규** — 오류 정규화 | POP3 `-ERR`·소켓 오류 → `{code, authFailure}` + 마스킹 | 순수 |
| `.../mail/reconcile.ts` · `retention.ts` · `freshness.ts` · `query-builder.ts` · `normalize.ts` · **`protection.ts`** | **신규** — 순수 로직 | MD-01·MD-02·MD-03·MD-04·MD-05·**MD-08** | 순수 단위 |
| `.../mail/store/index.ts` · `migrate.ts` · `migrations/0001_mail.sql` | **신규** — mail.db | 연결·PRAGMA·마이그레이션·질의 | DB 스위트 (ABI 필요, 환경 한계 분리) |
| `.../mail/attachment-export.ts` | **신규** — Temp 공개 (MD-06) | Jira store와 **같은 구조**를 새로 작성 (교차 import 금지, F-18) | 순수 — 루트 주입 |
| `app/src/main/app/deployment/plugins.ts` | **수정** — 조립 예제 | `createMailPlugin` 사용 예제를 주석으로 추가. 기본 반환은 `[]` 유지 (D-030) | 기존 `plugins.test.ts` 확장 |
| `app/src/main/app/bootstrap.ts` | **수정** — 자격증명·소켓·강등 주입 | Plugin 배포 deps에 `secret(authId)` closure · 소켓 팩토리 · `reportCredentialRejected(authId)` closure를 추가 | `deployment-wiring.test.ts` 확장 |
| `app/src/main/features/auth/runtime.ts` | **수정** — reporter 노출 | `createAuthRuntime` 결과에 `credentialRejectionReporter`를 더한다. `AuthRuntime` 인터페이스와 `RouterContext`는 건드리지 않는다 (AR-05) | `runtime.test.ts` 확장 |
| `app/src/main/features/auth/login.ts` | **수정** — verifier 분기 + 거부 문구 | ① `LoginDeps.verify?: (authId, candidate, signal) => Promise<{ok, rejected}>`를 더하고 `probe()`에서 **`candidate`가 있을 때만** 우선한다(D-042) ② `:716`의 고정 거부 문구를 outcome에 따라 갈라 싣는다(D-041). 타임아웃은 기존 `PROBE_TIMEOUT_MS`(15s) (AR-06) | `login.test.ts` 확장 |
| `app/scripts/check-migrations-appendonly.mjs` | **수정** — 가드 일반화 | 단일 상수 2개 → `{dir, source}` 목록. mail 쌍 등재 | 동반 `*.test.mjs` 확장 |
| `app/package.json` | **수정** — 의존성 | `node-pop3` · `postal-mime` 추가 (D-023) | — |
| `docs/arch/backend/security.md` | **수정** — §1.8 표 | POP3 예외 1행 추가 + 강제 수단 명시 | `check-doc-inventory.mjs` |
| `docs/arch/backend/auth.md` | **수정** — §7 | Plugin이 비-HTTP 전송을 쓰는 경우와 자격증명 주입 경로 서술 | 같은 가드 |
| `docs/guides/closed-network-extensions.md` | **수정** — §4 | Mail Plugin 레시피 (POP3 host/port/TLS 옵션·CA 주입) | 같은 가드 |
| `docs/arch/backend/persistence.md` | **수정** — §1 | 두 번째 DB(`mail.db`)의 소유·경로·마이그레이션 서술 | 같은 가드 |
| `docs/TRD.md` | **수정** — §2 Stack | `node-pop3`·`postal-mime` 등재 (의존성 정책) | 같은 가드 |

### mail.db 스키마 (`0001_mail.sql`)

```text
account        (id PK, auth_id, host, port, tls, created_at)
uidl_ledger    (account_id FK, uidl, message_number, first_seen_at, state, PRIMARY KEY(account_id, uidl))
mail           (id PK, account_id FK, uidl, header_date, first_seen_at, from_addr, to_addrs,
                cc_addrs, subject, body_text, has_attachments, size_bytes)
mail_fts       VIRTUAL TABLE fts5(from_addr, to_addrs, cc_addrs, subject, body_text,
                                  content='mail', content_rowid='id', tokenize='trigram')
               + AFTER INSERT/UPDATE/DELETE 트리거 3종 (0003_messages_fts.sql 패턴)
attachment     (id PK, mail_id FK ON DELETE CASCADE, filename, mime_type, size_bytes, stored_name)
sync_state     (account_id PK, last_sync_at, last_error_code,
                protection_kind, protection_first_observed_at,
                protection_observations, protection_fingerprint)
```

- `content='mail'` external-content 패턴은 `0003_messages_fts.sql`과 같다 — 본문 사본을 만들지 않는다.
- `mail_fts`가 5열이라 열 지정 검색(`subject:회의`)이 가능하다. `messages_fts`는 1열이라 이 선례가 없다.
- `attachment`의 `stored_name`은 내부 저장 파일명이고 **도구 결과에 실리지 않는다**(§10 EP-01). 모델에 나가는 것은 `attachment.id`(불투명 PK) 하나이며 그것이 `attachmentId`다(D-043).
- `uidl_ledger.state`가 `active` | `missing` 두 값을 갖는다 — `missing`은 원격에서 사라졌다는 표시일 뿐 삭제 트리거가 아니다(D-046).
- `protection_*` 4열은 `{ kind:'none' }` | `{ kind:'suspected', firstObservedAt, observations, fingerprint }` discriminated union의 평탄화다. `kind='none'`이면 나머지 3열은 `NULL` — 타입 경계에서 union으로 되살려 "none인데 observations가 있다"를 불가능하게 만든다(§10 선택적 필드 규칙).
- `account_id`를 모든 테이블에 둔다 — 다중 계정은 비범위지만 스키마 축은 지금 잡는다(§6).

### 테스트 가능성

- electron/native 분리: `pop3-socket.ts`는 `node:tls`를 물어 **별도 파일 seam**이다. 슬라이스의 나머지는 `Pop3SocketFactory` 포트로 받아 vitest 대상으로 남는다 — `browser-session.ts` ↔ `BrowserSessionPort`와 같은 관계(F-03 인접 선례).
- 기존 메커니즘 재사용 적합성: `createPluginBinding`은 그대로 쓴다 — mail도 `auth: BoundAuth`를 갖는다(계정 식별·GUI 행·상태 gating 용도). POP3 전송만 그 밖으로 나간다.
- 순서 관측: `sync-manager`는 단계 훅(`onStage: (stage) => void`)을 받아 `freshness → cleanup → connect → uidl → top → retr → persist` 순서를 테스트가 배열로 단언한다. 순서를 요구하는 AC(AC7·AC9)가 이 훅을 쓴다.
- `postal-mime`·`node-pop3`는 **직접 import하지 않고** 얇은 어댑터 파일 1개씩을 둔다 — 순수 로직이 라이브러리 타입에 묶이지 않아야 fixture로 단위 테스트할 수 있다. 교체 대비가 아니라 **테스트 seam**이 이유다(D-033으로 폴백 경로는 없다).

## 12. End-to-end 영향

### producer → consumer

```text
POP3 서버 → pop3-socket(전송) → session(명령) → postal-mime(파싱)
  → normalize.ts(정규화)   ← producer 기준: MailDocument 5필드 + headerDate/firstSeenAt
  → mail.db + mail_fts(상태)
  → search.ts(소비) → tools.ts 결과 조립 → 모델 컨텍스트 → 사용자 답변
```

- producer 기준: `normalize.ts`가 `MailDocument`를 만든다. `headerDate`가 파싱 불가·미래·1970 이전이면 `firstSeenAt`으로 대체한다(D-017).
- consumer 파생 규칙: `mail_search` 결과의 `date`는 **`MailDocument.effectiveDate` 한 필드에서만** 나온다. `headerDate`와 `firstSeenAt`을 둘 다 내보내면 소비자가 자기 규칙으로 고를 수 있어 정본이 둘이 된다.
- `structuredContent`의 소비자는 **모델뿐이다** — 앱 내 소비처가 0건이고 MCP passthrough로만 나간다(F-32). 화면에 보여야 하는 것은 `content`에 싣는다.
- **첨부 식별자의 producer는 `mail_search` 결과 매니페스트 하나뿐이다**(D-043). `mail_getAttachment`는 그 소비자이고 자기 입력을 스스로 만들 수 없다 — 매니페스트를 빼면 도구가 도달 불가가 된다(r1 G1). AC31이 그 연결을 왕복으로 잠근다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: `attachmentCount`가 정본이고 `hasAttachments` boolean은 **두지 않는다**(D-043) — `attachments[]`가 잘릴 수 있어(`attachmentsTruncated`) 길이가 진짜 개수가 아니다. `stale`은 `cacheAsOf`와 `now`에서 파생하되 **결과에 함께 싣는다** — 모델이 계산하게 두면 진단 ⑬의 순서 문제가 재발한다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `RuntimeToolRegistry` revision | Plugin 1개 증가 → 서버 1개 증가. **부팅 1회 생성** 관례를 지키면 revision은 안정 | AC14 (add/remove 호출 횟수) |
| `runtimeApprovalToolNames` | 승인 대상 도구가 2개 늘어난다(`mail_sync`·`mail_getAttachment`) | AC22 |
| `connection-views` plugin row | 배포가 opt-in할 때만 1행 증가. 기본 배포는 0 | AC15 · `deployment-wiring.test.ts` |
| `bootstrap` 부팅 순서 | Plugin 생성은 **DB 이전** 단계다(`auth.md §10`). mail.db 열기는 **Plugin factory 안에서 lazy**로 미룬다 — 부팅 단계를 바꾸지 않는다 | VP-12 |
| `check-doc-inventory` 수치 | `features/` 최상위는 15로 불변(mail은 `plugins` 하위). 마이그레이션 27로 불변 | AC18 |
| `no-node-fetch.test.ts` | 영향 없음 — 전역 `fetch(`만 본다. 새 가드는 별도 파일 | AC20 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: Plugin은 부팅에서 **1회** 만든다. mail.db 연결은 첫 도구 호출에서 lazy로 연다.
- 취소/중단: `RuntimeToolContext.getSignal()` → 소켓 `destroy()` → 진행 중 트랜잭션 롤백 → staging 디렉터리 제거.
- 종료/quit/crash: `QUIT` 미전송 상태로 프로세스가 죽으면 서버가 세션을 타임아웃으로 정리한다. `DELE`를 안 보내므로(D-031) 서버 상태는 변하지 않는다. mail.db는 WAL이라 크래시에 무손실이다.
- 취소 신호 부재: `RuntimeToolContext`는 `undefined`일 수 있다(F-31). 세 handler는 `context?.getSignal()`로 받고 없으면 **취소 없이 정상 수행**한다 — 없다고 throw 하지 않는다.
- 연결 시점 증명: verifier가 candidate로 POP3 1왕복(`USER`/`PASS`/`QUIT`)을 돌고 **성공해야 커밋**한다(D-040). 부팅 `resume()`은 candidate가 없어 타지 않는다(D-042). 실패는 커밋하지 않으므로 vault·grant에 잔여가 없다 — 부분 상태가 생기지 않는다.
- 자격증명 상태 전이: **lazy** — 도구 호출이 인증 거부를 관측한 자리에서만 강등한다(D-037). 주기 검증·`features/scheduler` 등록을 만들지 않으며 그 부재는 AC9의 슬라이스 전수 스윕이 함께 잠근다. 강등까지만 하고 `revoke`는 부르지 않는다(D-038).
- retry/timeout/partial failure: 자동 재시도 **없음**. 타임아웃은 D-029(연결 15s·명령 30s·전체 120s). 전체 예산 초과는 **부분 성공**으로 커밋하고 `partial:true`를 반환한다 — 커밋된 메일은 ledger에 있으므로 다음 sync가 이어받는다.
- cleanup/rollback: 메일 1건의 영속은 `mail` + `attachment` + `uidl_ledger` + FTS 트리거를 **한 트랜잭션**으로 묶는다.

### 다중 저장소 쓰기

한 동작이 원자적으로 함께 쓸 수 없는 **3곳**에 쓴다: ① mail.db ② 첨부 파일(`<userData>/plugins/mail/<accountId>/attachments/`) ③ Temp 공개 디렉터리.

| 쓰기 지점 | 사이에서 죽으면 관측되는 상태 | 허용 여부 / 설계 |
|---|---|---|
| ① 첨부 파일 기록 → ② mail.db 커밋 | 파일은 있고 DB 행이 없다 = **고아 파일** | 허용. 다음 `mail_sync`의 cleanup이 DB에 없는 `stored_name`을 지운다 (sweep) |
| ② mail.db 커밋 → ① 첨부 파일 기록 | DB 행은 있고 파일이 없다 = `mail_getAttachment`가 죽는다 | **허용 불가.** 순서를 ①→②로 고정한다 |
| ③ Temp staging → rename | staging만 남는다 | 허용. Jira와 같이 24h 지난 stale stage를 다음 준비 때 지운다 |
| 만료 정리: DB 삭제 → 파일 삭제 | DB에 없고 파일이 남는다 = 고아 | 허용 — 위 sweep이 회수한다. **반대 순서는 금지**(파일만 지우면 검색 결과가 죽은 첨부를 가리킨다) |

**산출물이 문서인 부분**: 이 handoff의 판정·상태 사본은 **2곳**이다 — `plan.md`(본 문서)와 `docs/handoff/INDEX.md` 보드 행. 설계 커밋에서 둘을 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- **`mail_search` 출력 상한**: 본문 `결과 20건 × (제목 200자 + 스니펫 300자 + 주소 3필드 200자)` ≈ **14 KB**. 매니페스트(D-043)는 항목당 `attachmentId 32B + filename ≤120B + mimeType ≤100B + sizeBytes 12B + JSON 구두점 70B ≈ 334 B`이고 **결과 전체 합산 50항목**을 상한으로 두어 ≈ **17 KB** — 합계 **≈31 KB**. 메일 1건당 10항목까지 싣고 초과는 `attachmentsTruncated:true`로 알린다. `limit`은 기본 20·최대 50, 스니펫·파일명은 문자 단위로 자른다.
- **`mail_getAttachment` 호출 수**: 첨부 N건 = 호출 N회 = 승인 N회 = staging N배치다(D-044). Jira의 `slice(0,10)` 합집합 경로를 복제하지 않았으므로 1회 호출의 바이트 상한은 첨부 1건분이고, 총량은 사용자가 승인한 횟수만큼만 늘어난다.
- **`mail_sync` 요청 수 — 증분**: `UIDL 1회 + TOP K회 + RETR K회` (K = 신규 건수). 제안서 §8의 20건 예시가 이 경우다.
- **`mail_sync` 요청 수 — 최초 (제안서가 가린 경우)**: 나이브하게는 `UIDL 1 + TOP N + RETR M` (N = 서버 총 건수 ≈ 10,000). POP3는 단일 연결 순차 왕복이라 RTT 20 ms 기준 **TOP만 200 s**로 D-029의 120 s 예산을 넘긴다.
  → **D-026**: 메시지 번호 **역순**으로 TOP을 돌고, 연속 `GRACE`건(기본 50)이 14일 경계보다 오래되면 중단한다. 메일 서버는 도착 순으로 번호를 매기므로 최신부터 훑으면 스캔량이 `최근 14일 건수 + GRACE`로 수렴한다. 10,000통 중 14일분이 1,000통이면 TOP **≈1,050회**(200 s → 21 s).
  → 예산을 그래도 넘기면 `partial:true` + 재개 커서(마지막 처리 메시지 번호)를 남긴다. 재개는 다음 `mail_sync`가 한다 — 백그라운드 스케줄러를 만들지 않는다(D-009).
- **디스크 상한**: 10,000통 × 본문 평균 20 KB ≈ 200 MB + trigram 인덱스(원문의 약 2~3배) ≈ **최대 800 MB**. trigram은 unicode61보다 인덱스가 크다 — 이것이 D-024의 비용이고, 14일 TTL이 상한을 잡는다.
- **캐시·호출 축소로 잃는 부수 효과**: 5분 freshness는 **그 5분 안에 도착한 메일을 못 본다**(D-008이 수용한 트레이드오프). 회귀 테스트는 AC1이고, 사용자가 "방금 온 메일"을 물으면 모델이 `stale`·`lastSyncAt`을 보고 안내한다.
- **되돌리기 어려운 결정**: 도구 3종 이름 · `mail.db` 파일 경로 · `0001_mail.sql` 스키마 · `trigram` tokenizer(재색인 없이 못 바꾼다). 전부 이 plan이 확정했다.

## 15. 외부 구현 포트 / 문서 계약

폐쇄망 배포가 채우는 typed recipe가 이번 작업의 외부 진입점이다.

- 외부/배포가 구현할 config: `MailPluginOptions = { host: string; port?: number; tls?: boolean; tlsOptions?: TlsOptions; accountId: string; retentionDays?: number; freshnessMs?: number; timeouts?: {...} }`.
- 구현 문서: `docs/guides/closed-network-extensions.md §4`에 Mail 레시피를 추가한다 — `AuthDefinition`(계정 식별용 HTTPS origin + `passwordSpec`) → `createMailPlugin` 조립 → 사설 CA 주입.
- **shape 검증**: 가이드의 예제 코드를 `app/src/main/app/deployment/plugins.ts` 주석이 아니라 **타입 체크되는 fixture**로 둔다 — `deployment-wiring.test.ts`가 예제와 같은 형상을 조립해 `npm run typecheck`가 본다. 문서 예제만 두면 시그니처가 바뀌어도 아무도 모른다.
- **semantics 검증**: `tlsOptions`의 `rejectUnauthorized`가 `false`면 조립이 거부된다는 계약 테스트를 둔다. 사설 CA는 `ca`로 주고 검증을 끄지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| "main의 모든 원격 요청은 Chromium 스택(`net.fetch`)만 쓴다" | `security.md §1.8` · `auth.md §11` 표 | §9 Delta "원격 전송" 행 · §10 AR-01 | **변경** — POP3 1건을 문서화된 예외로 등재한다. HTTP 요청의 규칙은 그대로다 |
| "`AuthSecretReader`를 RouterContext·renderer·일반 feature에 넣지 않는다" | `auth.md §11` | §10 AR-02 "Plugin은 `AuthSecretReader`를 받지 않는다" | **유지** — closure만 주입한다. 소비 지점이 2 → 3으로 늘지만 타입 표면은 안 넓어진다 |
| "Plugin 모듈은 `BoundAuth.request`와 자기 옵션만 받고 raw credential을 보지 않는다" | `auth.md §7` | 같은 행 | **변경** — mail은 POP3 자격증명 closure를 받는다. `auth.md §7`에 "비-HTTP 전송 Plugin" 단서를 추가한다 |
| "런타임 동적 TypeScript/JavaScript 로딩을 추가하지 않는다" | `auth.md §11` | §9 TO-BE 전체 | **유지** — build-time 슬라이스다 |
| "Plugin tool server를 sync마다 재생성하지 않는다" | `auth.md §11` | §11 `tools.ts` · §12 registry 행 | **유지** — 부팅 1회 생성 |
| "머지된 마이그레이션 파일은 절대 수정 금지" | `app/AGENTS.md §DB·캐시 정책` | §10 AR-03 | **유지 + 확장** — mail 마이그레이션에도 같은 가드를 건다 |
| "TRD §2 Stack 표 밖의 패키지 추가는 사용자 승인 필수" | `app/AGENTS.md §의존성 정책` | D-023 · §11 `package.json` 행 | **유지** — 사용자 승인을 받았고 TRD §2에 등재한다 |
| "`orcinus-orca.db`가 SSOT이고 DB 위치는 `app.getPath('userData')` 단일 출처" | `app/AGENTS.md §DB·캐시 정책` | §10 AR-03 mail.db 경로 | **유지** — mail.db도 같은 `userData` 아래다. Core DB의 SSOT 지위는 안 건드린다 |
| "feature 끼리 직접 import 금지" | `app/src/main/AGENTS.md` | §11 `attachment-export.ts` "Jira store와 같은 구조를 새로 작성" | **유지** — eslint가 `plugins`를 한 요소로 보아 잡아주지 못하므로(F-18) 설계로 금지한다 |
| "도구 결과는 MCP 표준 형상(`content` 필수)" | `adapters/runtime-tools.ts:22` 주석 | §11 `tools.ts` | **유지** — 세 도구 모두 `content` + `structuredContent` |
| "기본 OSS 배포의 Auth/Plugin 배열은 비어 있다" | `auth.md §7` | D-030 | **유지** |
| "`settleExpiry()` 는 이미 지나는 자리에서 전이를 확정하고 **polling 을 새로 만들지 않는다**" | `auth.md §4.4` | D-037 · §13 | **유지** — 이번 작업도 주기 검증을 만들지 않는다. 사용자 정책이 같은 방향을 Plugin 전반으로 확장한다 |
| "검증 경로와 사용 경로가 글자까지 같아진다" | `login.ts` probe 절 주석 | D-040 · §10 EP-17 | **유지** — verifier도 `pop3/session.ts`의 실제 연결 경로를 그대로 탄다. 검증 전용 경로를 따로 만들지 않는다 |
| "후보 커밋은 `await probe()` 뒤에 일어난다" | `login.ts:143` | D-040 | **유지** — verifier를 그 자리에 끼우므로 커밋-후-검증으로 뒤집히지 않는다 |
| "강등 경로는 요청 경로(HTTP status)와 `resume()` probe 둘뿐" | `auth.md §4.5` 관측 지점 표 | D-035 · §10 EP-16 | **변경** — 세 번째 관측 지점(POP3 `-ERR`)을 더한다. 전이 1회성·통지 규칙은 기존 `markExpired` 를 그대로 쓴다 |
| "`AuthSecretReader` 를 RouterContext·renderer·일반 feature 에 넣지 않는다" 와 같은 좁힘 원칙 | `auth.md §11` | D-035 | **유지** — reporter 도 `createAuthRuntime` 결과에만 싣고 컴포지션 루트가 `authId` 를 닫아 넘긴다. `AuthRuntime`·`RouterContext` 표면은 안 넓힌다 |
| "Auth 는 자신이 gate 에 쓰이는지 모른다 — 그 지식은 `gate-auth.ts` 하나에 있다" | `auth.md` D-007 · `gate-auth.ts` 헤더 | D-034 | **유지** — Mail Auth 를 `GATE_AUTH_DEFINITIONS` 에 넣지 않는다. Auth 선언 자체는 gate 여부를 모른다 |
| `messages_fts`의 `unicode61` | `0003_messages_fts.sql` | D-024 | **유지** — 기존 메시지 검색은 안 건드린다. mail은 별도 DB·별도 tokenizer다 |
| "`valid` 만 등록 이 곧 나머지 셋은 전부 회수" — Plugin 도구는 **서버 단위**로 add/remove 한다 | `app/deployment/plugins.ts:57-68` · `plugins.test.ts:71` (0188 D-024) | D-045 · §10 EP-05 | **유지** — 도구별 게이팅을 만들지 않는다. mail이 첫 예외가 되면 Confluence·Jira가 함께 쓰는 공유 계약이 넓어진다 |
| "GUI row 를 feature 수만큼 복제하지 않는다 — `authId` 는 중복되지 않는다" | `app/connection-views.ts:110` `duplicateConnectionAuthIds` (0188 D-029) | D-045 | **유지** — mail 도구를 두 서버로 쪼개 하나만 무조건 등록하는 우회를 쓰지 않는다. 한 authId에 두 row가 생겨 부팅 진단에 걸린다 |
| Jira 첨부는 `issueKey` XOR `attachmentId` 합집합 selector이고 `slice(0,10)`·`filename` 필터를 갖는다 | `jira/tools.ts:118-138` · `jira/service.ts:144-160` | D-044 | **선례 미채택** — mail은 단건 전용이다. 승인 3회·staging 3배치 비용을 제시한 뒤 사용자가 좁은 표면을 골랐다. 첨부 store의 staging→rename 형상(F-15)은 그대로 따른다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| POP3가 Chromium 스택 밖이라 **OS 프록시·PAC를 안 탄다** | **실기 1순위**(§19). 대상 배포가 ADFS 게이트를 운영 중이라 HTTP는 프록시를 탈 가능성이 높다(F-22). POP3가 프록시 경유로만 닿으면 이 Plugin은 성립하지 않는다 — 다른 설계 전에 이것부터 확인한다 |
| `node:tls`가 사설 CA를 못 본다. **`SPAWN_ENV_INJECTOR`의 `NODE_EXTRA_CA_CERTS`로는 해결되지 않는다**(F-25 — 그건 subprocess env다) | 배포가 `tlsOptions.ca`에 PEM을 넣는다(§15). ADFS 환경이면 사설 CA가 사실상 확실하므로 실기 2순위다 |
| `node:tls`가 **OS 인증서 저장소를 안 본다** | `tlsOptions.ca`로 배포가 사설 CA를 주입한다. `rejectUnauthorized:false`는 조립에서 거부한다(§15) |
| `postal-mime`이 `iso-2022-kr`을 못 읽는다 (F-13 실측) | **수용한다 — 완화하지 않는다**(D-033). 그 메일은 `windows-1252`로 폴백해 제목·본문이 깨진 채 색인되고 검색에 걸리지 않는다. 동작은 멈추지 않으며 sync·다른 메일에 영향이 없다 |
| 값만 넣어도 "연결됨"이 될 수 있다 (F-06b) | **닫았다**(D-040) — 연결 버튼이 실제 POP3 왕복으로 증명하고 실패는 커밋하지 않는다(AC29). 이후 운영 중 변화는 lazy 강등이 받는다(D-037·AC28) |
| `passwordSpec`의 **프로덕션 첫 사용자**다 (F-30) | 렌더러 다중 필드 경로는 코드로 확인했다(F-29). 남은 미지는 실제 폼 동작이라 실기 ⑤에 넣었다 |
| `login.ts` 분기를 고쳐 다른 Auth의 로그인이 바뀐다 | verifier 미주입 Auth 2종의 호출 횟수·커밋 여부 불변을 AC30이 잠그고, 분기를 뒤집는 변이를 등록했다(VP-23) |
| `trigram` 인덱스가 크다 (§14) | 14일 TTL이 상한을 잡는다. 10,000통 기준 최대 800 MB를 §14에 계산해 두었고 성능시험 항목이다(D-005) |
| 최초 sync가 느리다 | D-026 역순 스캔 + `partial` 재개. 10,000통 중 14일분 1,000통 기준 TOP 200 s → 21 s |
| 두 번째 SQLite 연결이 main 스레드를 점유한다 | better-sqlite3는 동기 API다. 대량 insert를 **건당 트랜잭션이 아니라 배치 트랜잭션**으로 묶고, 배치 사이에 이벤트 루프를 양보한다 |
| POP3는 `USER`/`PASS` 평문 인증이다 | D-025 — implicit TLS 필수. 평문 110은 선언으로만 열리고 기본값이 아니다. **ID/비밀번호 전용이 확정(D-039)이라 TLS는 선택이 아니다** |
| SASL 토큰 인증을 지원하지 않는다 (F-26) | **한계로 기록하고 홀드한다**(D-039). 서버가 `USER`/`PASS`를 막고 SASL만 허용하면 이 Plugin은 그 서버에 못 붙는다 — 실기 ①에서 함께 확인한다 |
| Plugin 크래시가 앱 전체를 죽인다 (제안서 §4의 "장애 범위 분리"가 성립하지 않음) | 도구 handler 전체를 try/catch로 감싸 `isError:true`로 변환한다. 프로세스 격리는 이 구조로 불가능함을 §9 TO-BE에 명시했다 |
| 모델이 `mail_sync`를 건너뛴다 | `descriptor.instructions` 유도 + `mail_search`가 항상 `stale`·`cacheAsOf`를 싣는다(AC6) |
| 첨부 3건을 받으면 **승인 오버레이가 3번** 뜬다 | **수용한다**(D-044) — 비용을 제시한 뒤 사용자가 좁은 표면을 골랐다. 매니페스트가 이름·크기를 먼저 주므로 사용자는 필요한 것만 고를 수 있다(D-043) |
| 인증이 거부되면 **로컬 캐시 검색까지 끊긴다** | **수용한다**(D-045) — 사용자가 "3도구 전부 회수"를 골랐다. 복구는 연결 탭 재인증 1회이고, 그 순간 세 도구가 함께 돌아온다. 공유 계약(`createPluginBinding`)을 건드리지 않는 대가다 |
| 보호 발동 중에는 새 메일이 색인되지 않는다 | 최대 **sync 2회** 동안이다(D-047). freshness가 5분이라 사용자가 다시 물으면 두 번째 관측이 곧 일어나 회복 또는 채택으로 풀린다. 기존 캐시 검색은 그동안에도 계속된다 |
| **서버에서 지운 메일이 최대 14일간 검색에 뜬다** | **수용한다**(D-046) — D-004("삭제 기준은 14일 Retention뿐")의 직접 귀결이다. 재해석하지 않았고 §5 상태 전이표에 행으로 노출했다. 바꾸려면 D-004를 바꾸는 새 사용자 결정이 필요하다 |

- 되돌리기 어려운 결정: §14 마지막 항목 참조 (도구 이름 · DB 경로 · 스키마 · tokenizer).
- 신규 의존성: `node-pop3@^0.15.3` · `postal-mime@^3.0.0` → **사용자 승인 완료**(D-023). TRD §2 Stack 표에 등재한다.

## 18. 영향 받는 파일 / 문서

- `app/src/main/infra/net/pop3-socket.ts` · `pop3-socket.guard.test.ts` (신규)
- `app/src/main/features/plugins/mail/**` (신규 — §11 표)
- `app/src/main/app/deployment/plugins.ts` · `app/src/main/app/bootstrap.ts` (수정)
- `app/scripts/check-migrations-appendonly.mjs` + 동반 `*.test.mjs` (수정)
- `app/package.json` · `package-lock.json` (수정)
- `docs/arch/backend/security.md` §1.8 · `auth.md` §7 · `persistence.md` §1 · `docs/TRD.md` §2 (수정)
- `docs/guides/closed-network-extensions.md` §4 (수정)
- `docs/handoff/INDEX.md` (수정)

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md §레이어 DAG`
- ABI/네트워크 등 환경 제약: mail DB 스위트는 better-sqlite3 네이티브를 로드한다. egress 차단 환경에서는 알려진 5파일과 함께 실패할 수 있고 **코드 회귀가 아니다** — 기준선으로 분리 보고한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`
- 관련 테스트: `cd app && ./node_modules/.bin/vitest run src/main/features/plugins/mail src/main/infra/net src/main/app/deployment` · `node --test scripts/check-migrations-appendonly.test.mjs`
- 문서 게이트: `cd app && node scripts/check-doc-inventory.mjs --check`
- 사람 실기: 폐쇄망 배포에서 **순서대로** — ① POP3 포트가 프록시 없이 닿는가 + 서버가 `USER`/`PASS`를 받는가(둘 중 하나라도 아니면 이후가 무의미) ② 사설 CA로 TLS 핸드셰이크 ③ 실제 한국어 메일 인코딩 ④ 최초 sync 소요 시간 ⑤ 연결 탭에서 아이디·비밀번호 2필드 폼이 실제로 뜨고 저장되는가(F-30 — 첫 사용자) ⑥ 비밀번호를 일부러 틀려 연결 거부 문구와 도달 실패 문구가 다른지(AC29) ⑦ 연결 후 비밀번호를 서버에서 바꿔 **도구 3종이 모두 사라지고** 재인증으로 함께 돌아오는지 확인(AC28·D-045) ⑧ 첨부 3건 메일에서 매니페스트가 3건 뜨고 각각 승인 후 받아지는지(AC31·D-044).

## READY self-review

> **ΔV1 재실행**. 정정한 행(D-043~D-047 · AC5·AC11·AC25·AC28 · 신규 AC25b·AC28b·AC31·AC32·AC33 · EP-01·EP-03·EP-13·EP-16 · 신규 EP-18·EP-19)은 §5 AC 게이트를 **다시** 통과시켰다 — 최초 작성만 게이트를 받고 정정은 안 받으면 다음 라운드가 틀린 기준으로 채점된다.

- [x] **r1 PLAN_GAP 3건이 규범 행으로 닫혔다** — G1 → D-043·D-044 + R-07/AT-20·21/VP-24/EP-18 + AC31·AC32. G2 → D-045(D-019 대체) + AC5·AC28 정정 + AC28b + EP-16 3지점 + VP-05 REGRESSION. G3 → D-046·D-047 + MD-08/UT-08/VP-25/EP-19 + AC25 재작성 + AC25b·AC33 + EP-03 4지점. 구현자에게 되넘긴 미정 항목 **0건**.
- [x] Decision Ledger의 ACTIVE/SUPERSEDED/OPEN이 여러 턴의 결정을 보존한다 — 실측 47행: ACTIVE **45** · SUPERSEDED **2**(D-013→D-014 · D-019→D-045) · OPEN 0.
- [x] Part I만 읽어도 사용자/제품 완료 상태가 이해된다 — §5 흐름 + §7 AC.
- [x] 조건절·이유절·제거/유지 요구를 임의 재해석하지 않았다 — D-004("삭제 기준은 14일 Retention뿐")·D-011("Core DB에 추가하지 않는다")·D-012("원본은 이동하거나 수정하지 않는다")를 원문으로 인용했다.
- [x] Product/UX의 각 핵심 동작이 AC와 Technical Design에 연결된다 — §5 상태 전이표 12행이 전부 AC 또는 §13 lifecycle에 있다.
- [x] Technical Design에 AS-IS와 TO-BE가 모두 있고 같은 비교 축으로 작성되어 있다 — §9 Delta 9행.
- [x] AS-IS → TO-BE Delta의 각 변경이 구현 파일/모듈 또는 AC에 추적 가능하다 — Delta 9행 모두 오른쪽 끝에 V node + 파일.
- [x] AS-IS에서 사라진 책임은 삭제/이동/대체 중 무엇인지 명시했다 — 사라진 책임 없음(§9 "제거하는 메커니즘: 없음").
- [x] 수치·전칭 표현·외부 규약·문서 앵커·기존 테스트 인용을 실측했다 — §8 전수 조사 7행 + 수치 검산 5항목. 인용한 기존 테스트 케이스 0건(전부 신규라 검증 대상 없음).
- [x] 각 AC가 행동 단언, 검증 수단, 프로덕션 도달 경로를 가진다 — §7 표 실측 **35행**이 모두 네 칸을 채웠다. 25건 초과라 분할을 재검토했고 결론은 §7 주의사항 마지막 항목에 적었다.
- [x] 명시적인 기존 V를 일부 바꿀 때만 Delta V를 썼고 유효 V를 재구성할 수 있다 — 기준 `V1`(commit `07ec3a6`~`e252c6b`, 구현 미착수) + `ΔV1`. ΔV1이 건드리지 않은 V1 pair는 복사하지 않고 `INHERITED`+`REQUIRED`로 유효하다고 §7-A ΔV1 절 머리에 명시했다.
- [x] 변경 효과에 필요한 레벨을 선택했고 모든 NEW·CHANGED node에 같은 레벨 REQUIRED pair가 있다 — ΔV1의 CHANGED·NEW 설계 node 6개(R-02·R-04·R-07·AR-05·MD-01·MD-08)가 각각 VP-02·VP-04·VP-24·VP-21·VP-14·VP-25를 갖는다. 유효 V 실측 `VP-01~VP-25 = 25`.
- [x] 영향받은 INHERITED 상위 node는 REGRESSION, 비영향 node만 NOT_REQUIRED다 — D-045가 도구 회수 경로의 의미를 확정하므로 R-05를 **VP-05 REGRESSION**으로 다시 닫았다. `NOT_REQUIRED` 0건 — 구현 미착수라 비영향 판정을 쓸 자리가 없고, 그 이유를 ΔV1 절에 적었다.
- [x] 각 pair의 경로·§10 전수 분모·직접 oracle이 있고 적대 증거가 필요한 pair만 선택 이유·변이를 갖는다 — ΔV1 7 pair 전부 적대 증거를 선택했고 심을 결함을 적었다. §10 실측 `EP-01~EP-19 = 19`군·지점 합 **44**가 pair registry 분모와 일치한다.
- [x] 현재 변경 산출물의 운영 gate가 열거됐고 관련 없는 기존 실패를 새 blocking 범위로 만들지 않는다 — §7-A gate 표 8행, ABI/사람 실기는 비-blocking으로 분리.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 실기는 실 서버 TLS·실 인코딩 1건뿐이고 프로토콜 판정·TTL·FTS·경로 은닉은 전부 순수 테스트다.
- [x] semantic 목표가 structural proxy만으로 검증되지 않는다 — AC20·AC21·AC26의 음성 스윕에 각각 양성 단언을 짝지었다. **ΔV1에서 공허한 단언 1건을 제거했다**: AC25의 `removed:0`은 D-046 아래 전 경로에서 참이라 보호 발동 여부를 반증하지 못했다(r1 G3) — 판별자를 **RETR 호출 횟수**로 바꾸고 `removed:0`은 D-004 회귀로만 남겼다.
- [x] "X가 쓰인다" 불변식의 검사 장치가 X를 지웠을 때 실패한다 — AC20은 `pop3-socket.ts`를 no-op으로 만드는 변이(VP-10), AC26은 허용 6명령의 실제 전송 단언(VP-20). **ΔV1 추가**: AC31은 `mail_search` 매니페스트를 지우면 red다 — `attachmentId`의 producer가 그 한 곳뿐이라 지우면 `mail_getAttachment`가 도달 불가가 된다(r1 G1의 상태). **자리를 말하는 불변식**(AC22 annotations 3자리 · AC8 3저장소)은 형제 맞바꿈 변이를 등록했다.
- [x] **한 방향만 잠근 불변식이 없다 (ΔV1)** — "인증 거부는 강등한다"(AC28)에 "비인증 5종은 강등하지 않는다"(AC28b)를, "대량 소실은 보호한다"(AC25)에 "일반 소실은 본문을 남긴다"(AC25b)를 짝지었다. 한쪽만 두면 "전부 강등"·"전부 보호"로 뭉개는 구현이 통과한다 — EP-03·EP-16·EP-19의 `실패 의미`도 두 방향을 적었다.
- [x] 정책 파라미터의 단위/범위가 명확하고 상호배타 상태의 불가능 조합을 타입이 허용하지 않는다 — `retentionDays`(일)·`freshnessMs`(ms)·`timeouts`(ms) 단위 명시. `mail_sync` 결과의 `fresh` / `synced` / `error` / `protection`은 discriminated union으로 표현해 "fresh이면서 synced"를 타입이 막는다.
- [x] 참조 구현 사용 시 계약 union/enum 전수 대비 coverage가 있다 — D-010의 검색 대상 5필드를 VP-17이 5종 변이로 전수 덮는다.
- [x] 신규 계약의 SSOT·강제 지점·테스트 seam이 있다 — §10 표 17행(EP-01~EP-17) 전부 SSOT·지점 수를 가지며 seam은 §11 표에 있다.
- [x] 부팅/등록 변경의 기존 소비처를 전수 확인했다 — §12 표 6행.
- [x] producer/consumer 양쪽 의미를 확인했다 — §12 `effectiveDate` 단일 정본 · **`attachmentCount` 정본(`hasAttachments`는 D-043이 제거)** · `stale` 동봉 · **첨부 매니페스트가 `attachmentId`의 유일한 producer**(AC31이 왕복으로 잠근다).
- [x] 상한·총량·one-way door를 필요한 곳에서 계산했다 — §14 출력 14 KB · 최초 sync 요청 수 · 디스크 800 MB · one-way door 4건.
- [x] 게이트 명령이 대상 subtree의 현재 `AGENTS.md`와 충돌하지 않는다 — `npm test`를 기본 게이트로 쓰지 않고 lint+typecheck+직접 `vitest run`을 썼다.
- [x] 본문 완성 후 Decision Ledger와 기존 결정을 전체 교차검증했고, `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다 — V1 6쌍 + **ΔV1 5쌍**(D-043↔AC11 · D-044↔AC32 · D-045↔AC28·AC5 · D-046↔AC25b · D-047↔AC25·AC33), 충돌 0.
- [x] **정정한 AC 행이 §5 AC 게이트를 다시 통과했다 (ΔV1)** — 9행(AC5·AC11·AC25·AC28 정정 + AC25b·AC28b·AC31·AC32·AC33 신규) 각각 동작 기준·검증 수단·프로덕션 도달 경로 3축을 채웠고, 부정형만으로 목적을 표현한 행이 없다.
- [x] **사용자 결정과 설계자 결정을 갈랐다 (ΔV1)** — G1·G2는 두 해석이 서고 사용자 결과가 달라져 질의했다(D-043·D-044·D-045). G3는 D-004가 답을 하나로 강제해 질의하지 않고 귀결로 닫았고(D-046), 임계·표본·해제만 정책 파라미터로 확정했다(D-047). 그 판정 근거를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다 — Part I은 관측 결과, Part II는 경로·계약. §4 진단 근거는 Part I에, 같은 사실의 코드 좌표는 §8에 한 번만 적었다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 라운드도 같은 이름의 필드를 다시 채운다** — 라운드 표제(`… (r2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

## [구현자 기입] 설계 리뷰

- **PLAN_GAP — r1 구현 보류.** V1의 REQUIRED VP-01~VP-23과 EP-01~EP-17을 읽고 아래 G1~G3를 확인했다. 앱 코드·의존성은 변경하지 않았다.
- 동의 / 그대로 진행: D-002·D-021~D-024·D-030·D-039의 슬라이스·전송·인증·의존성·기본 배포 범위는 유지한다.
- ACTIVE Decision과 충돌하는 설계 발견: D-019의 실패 후 캐시 검색과 AC14·AC28의 서버 전체 회수가 인증 거부 경로에서 양립하지 않는다(G2). 규범 정정은 설계자 몫으로 남긴다.

| ID | 판정 / 출처 | 이번 턴 관측 | 설계자에게 필요한 정정 |
|---|---|---|---|
| G1 | PLAN_GAP — D-014·§5 첨부 흐름·VP-04 | §5 검색 DTO는 `hasAttachments`만 반환하고 AC11도 이를 고정한다. `attachmentId`는 §5 다운로드 입력과 §9 모듈 입력에만 등장하며 모델에 전달하는 producer가 없다. | 공개 도구 3개를 유지하면서 첨부 식별자를 얻는 경로와 다중 첨부 선택 결과를 확정한다. §5·AC10~12·VP-04·EP-01에 검색→식별→다운로드 oracle을 연결한다. |
| G2 | PLAN_GAP — D-019·§5 실패 후 검색 / AC14·AC28·VP-02·VP-05·VP-21 | `app/src/main/app/deployment/plugins.ts:67`은 서버 전체를 remove한다. `bootstrap.ts:711`은 Auth change에서 이 sync를 호출한다. 기존 `plugins.test.ts:82`의 valid→expired 테스트는 registry 크기 1→0을 단언한다. | 인증 거부 뒤에도 로컬 검색을 허용할지, D-019의 실패 범위를 비인증 장애로 제한할지 결정한다. 후자의 경우 사용자 결과를 명시하고, 전자의 경우 등록 계약·경로·pair·강제 지점을 정정한다. 기존 spawn에 남은 handler로는 다음 턴 접근을 보장하지 못한다. |
| G3 | PLAN_GAP — D-004·D-018·AC25·VP-14·EP-13 | `rg -n 'threshold\|임계' plan.md`의 계약은 임계 비율이라는 이름과 100→10 사례뿐이다. 임계값·최소 표본·보호 해제 조건이 없고, D-004는 삭제 기준을 retention으로만 고정한다. | 보호 진입·유지·해제 기준과 일반 UIDL 소실의 처리(본문 삭제 여부·ledger 상태)를 확정한다. VP-14의 경계값 양성/음성 oracle과 비교 부호 변이에 필요한 기준을 명시한다. |

G1 재현 검색: `rg -n 'attachmentId|hasAttachments|mail_getAttachment' docs/handoff/0237-pop3-mail-search-plugin/plan.md`. G2의 기존 Plugin 테스트는 아래 명령으로 1파일·8케이스 통과했으며, 이는 현재 서버 회수 동작의 증거이고 신규 mail pair의 SELF_PASS가 아니다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-04·VP-19 | 첨부 공개 경로 | EP-01, 4지점 | 0 | G1: 식별자 producer 미정 | 4지점 전부 |
| VP-02·VP-05·VP-21 | 장애 검색 / 인증 가시성 | EP-02·05·16, 7지점 | 0 | G2: 서버 전체 회수 코드·기존 테스트 | 7지점 전부 |
| VP-14 | UIDL 보호 | EP-13, 1지점 | 0 | G3: 임계 및 해제 계약 미정 | 1지점 |
| 나머지 pair | 기타 V1 계약 | 나머지 EP, 25지점 | 0 | 구현 진입 전 보류 | 25지점 전부 |

- §10에 없는데 같은 불변식이 필요했던 지점: G1의 모델에게 첨부 식별자를 제공하는 producer→consumer 경계. 확정 후 설계자가 EP-01 전수 분모를 재평가해야 한다.
- 전수 수치는 계획 분모이며 구현 실측 완료 수가 아니다. 닫은 지점 0, 미구현 37.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-04 | REQUIRED | SELF_BLOCKED | G1 | 미실행 |
| VP-02·VP-05·VP-21 | REQUIRED | SELF_BLOCKED | G2 | 미실행 |
| VP-14 | REQUIRED | SELF_BLOCKED | G3 | 미실행 |
| VP-01·03·06·07·08·09·10·11·12·13·15·16·17·18·19·20·22·23 | REQUIRED | SELF_BLOCKED | 독립 구현·검증 미착수; 위 제품 계약 정정 뒤 수행 | 미실행 |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 해당 없음 | SELF_PASS 및 closed 주장 없음 | 첫 라운드 | 미실행 | 등록 변이는 구현 재개 후 수행 |

- **분모 검산**: `선택 증거 0 · 인용 변이 0 · 새 oracle 0 = 실제 변이 표 행 0` — 이번 턴 SELF_PASS 주장 기준이며 V1에 등록된 변이의 면제가 아니다.
- **덮개 회귀**: 해당 없음 — 기존 검사 장치를 교체·삭제하지 않았다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 새 코드 없음. 첨부 ID 소비자는 있으나 producer 계약이 없다(G1) | 공개 결과 정정 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 해당 없음 — 재배치 없음 | 구현 재개 뒤 확인 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 새 경로 없음. 인증 실패 후 검색과 전체 회수 행이 충돌한다(G2) | 상태표 정정 |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | G2에서 재인증 안내는 설계됐으나 캐시 검색 도달이 끊긴다 | 장애 종류별 이용 가능 기능 확정 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 미검증 — 신규 비동기 구현 없음 | 구현 재개 뒤 확인 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| G1 | 첨부 ID를 모델이 얻지 못한다 | PLAN_GAP, 보고만 | 설계 리뷰 G1 |
| G2 | 인증 강등 후 검색 도구도 회수된다 | PLAN_GAP, 보고만 | 설계 리뷰 G2 |
| G3 | UIDL 보호 정책을 구현자가 선택해야 한다 | PLAN_GAP, 보고만 | 설계 리뷰 G3 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 해당 없음 — 앱 구현 미착수. 메타 상태와 구현자 보고만 갱신하며 Decision·AC·V·§10은 정정하지 않았다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 대체 구현 없음 | 미검증 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 — 대체 구현 없음 | 미검증 |
| 재진입 | 해당 없음 — 대체 구현 없음 | 미검증 |
| 다른 무효화 축 | 해당 없음 — 대체 구현 없음 | 미검증 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 본 plan의 상태·구현자 보고 + `docs/handoff/INDEX.md`의 0237 행 |
| 실행 명령 | `git pull --ff-only` → Already up to date. `cd app; node node_modules/vitest/vitest.mjs run src/main/app/deployment/plugins.test.ts` |
| **관측한 게이트 산출**(exit code 아님) | 기존 Plugin 테스트 1파일·8케이스 통과. `cd app; node scripts/check-doc-inventory.mjs --check`: generated doc/prose/links 모두 ok. `git diff --check` 공백 오류 0; plan:14와 INDEX:24의 DRAFT 상태 재확인. 앱 변경이 없어 lint/typecheck/신규 mail 스위트는 미실행. |
| V-pair 자기확인 | SELF_PASS 0 · SELF_BLOCKED 23. G1~G3 직접 영향 5 pair, 나머지 18 pair 미착수 |
| 강제 지점 전수 | 계획 17군·37지점, 닫은 지점 0. 실구현 전수 검증 미수행 |
| **AC 자기보고**(`Criteria-Met`) | 0/30. AC1~AC30 모두 ⚠️ 미구현·미검증; 기존 테스트 결과를 신규 AC 충족으로 계산하지 않음 |
| **합계 검산** | ✅ 0 · ⚠️ 30 · ❌ 0 = 총 30 |
| 블로커 / 역질문 | G1~G3의 규범 정정 필요. INDEX `plan/DRAFT`, 다음 주체 Claude(설계 정정) |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음 — 첫 구현 진입, 닫은 불변식 없음.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: READY self-review는 producer/consumer·정책 파라미터 검토 완료를 적었으나 G1·G3의 계약이 없고 G2의 두 상태 결과가 충돌한다.
- 반복해서 부딪히는 환경 한계: 없음. 최초 pull은 `.git/FETCH_HEAD` 쓰기 제한으로 실패했으며 권한 상승 재시도는 성공했다.
- 현재 라운드 수: 1 (구현 진입에서 PLAN_GAP 보고).

## [구현자 기입] 설계 리뷰 (r2)

- **READY 확인 후 구현 진행.** `V1 + ΔV1`의 D-043~D-047, AC5·AC11·AC25·AC25b·AC28·AC28b·AC31~AC33과 §10 EP-01~EP-19를 기준으로 구현했다.
- 동의 / 그대로 진행: 첨부 매니페스트→단건 수신, 비인증 장애의 캐시 유지, UIDL `missing` 보존, 대량 소실 시 신규 수집 중단, 기본 배포 opt-in 결정을 유지했다.
- 구현 중 확인한 차이: `node-pop3`의 자체 socket 생성을 사용하면 fake socket seam과 POP3 명령 whitelist를 동시에 보장할 수 없어, 동일한 POP3 line protocol을 `pop3/session.ts`에서 주입 socket으로 구현했다. 의존성은 plan의 배포 목록에 유지하고, 실제 전송 경계는 `infra/net/pop3-socket.ts` 하나로 닫았다.

## [구현자 기입] 강제 지점 전수 (§10 대조, r2)

| EP 묶음 | 구현으로 닫은 지점 | 직접 관측 | 상태 |
|---|---|---|---|
| EP-01·02·04·06·07·08 | 결과 은닉, 검색의 비-소켓 경로, 질의/TTL/동시성/실패 수명주기 | `tools.ts`, `sync-manager.ts`, 순수 모듈·store 테스트 | 구현 완료, 독립 AT 대기 |
| EP-03·13·19 | retention 3저장소 정리, UIDL `missing`, `<0.5 ∧ >=20` 보호와 해제 전이 | `store/index.ts`, `reconcile.ts`, `protection.ts` 테스트 | 구현 완료, RETR fake 서버 대기 |
| EP-05·10·16·17 | 서버 단위 binding, secret closure, 인증 거부만 reporter, verifier/문구 분기 | `plugins.ts`, `bootstrap.ts`, `login.ts`, 기존 auth 회귀 | 구현 완료, mail Auth IT 대기 |
| EP-09·11·12·14·15·18 | native 경계, mail migration pair, annotations, 5필드 정규화, 명령 whitelist, 단건 schema | guard·migration·mail 스위트 | 구현 완료, POP3 AT 대기 |

- **분모 검산:** §10 EP 19군·44지점 중 코드 경로를 배치한 지점 44/44. 테스트로 직접 닫은 지점은 아래 V-pair 표에 적은 11 AC와 migration/guard 결과이며, 나머지는 독립 검증자에게 남긴다.
- `mail_search`와 `mail_getAttachment`는 모두 하나의 `MailStore` 결과 조립기를 통과한다. `stored_name`·내부 DB 경로는 매니페스트와 오류 결과에 포함하지 않는다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r2)

| 심은 결함 | 출처 | 실패한 테스트 / 케이스 | 결과 |
|---|---|---|---|
| native import를 mail feature가 직접 소유 | EP-09·AR-01 | `pop3/native-boundary.test.ts` 2케이스 | 해당 변이 red, 경계 유지 |
| 대량 소실 보호의 비교 부호·fingerprint 카운트 | D-047·EP-19 | `pure.test.ts` 경계/표본/회복/리셋 4경로 | 해당 변이 red |
| 첨부 producer를 제거해 consumer를 끊음 | D-043·EP-01 | `store/index.test.ts` 매니페스트→findAttachment 왕복 | 해당 변이 red |
| mail migration을 가드 목록에서 누락 | AR-03·EP-11 | `check-migrations-appendonly` 19케이스 + CLI pair 출력 | 해당 변이 red |

- **덮개 회귀:** 기존 `plugins.test.ts`, `deployment-wiring.test.ts`, `login.test.ts`, `runtime.test.ts`를 함께 실행해 서버 단위 add/remove와 verifier 미주입 경로를 유지했다.

## [구현자 기입] Product/UX 파생 검토 (r2)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태에 소비자가 있는가 | ✅ `mail_sync` 오류/`stale`·`cacheAsOf`, 첨부 매니페스트와 단건 schema가 각각 모델 경로에 연결된다 | 독립 AT에서 문구 대비 |
| 실패가 화면에서 구분되는가 | ✅ verifier의 credential rejection과 도달 실패가 다른 입력 문구로 내려간다 | 사람 실기에서 한국어 문구 확인 |
| 서버 UIDL 소실이 사용자 데이터 삭제로 오해되지 않는가 | ✅ ledger만 `missing`으로 바꾸고 retention 전까지 검색/첨부를 유지한다 | AC25b 독립 확인 |
| 보호 상태가 탈출 가능한가 | ✅ 비율 회복 또는 같은 fingerprint 2회 관측에서만 수집을 재개한다 | AC33 독립 확인 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r2)

| # | 문제 | 대응 | 분류 |
|---|---|---|---|
| P1 | 실제 POP3 서버별 multiline·TLS handshake 차이는 fake socket만으로 완전히 닫히지 않는다 | socket factory와 명령 로그 seam을 남기고 사설 CA/실서버 AT를 다음 검증으로 넘긴다 | NEXT_HANDOFF |
| P2 | `node-pop3` 고수준 API는 주입 socket을 제공하지 않아 raw session을 사용했다 | `DELE`를 포함하지 않는 allowlist와 `node:net`/`node:tls` 단일 경계를 함께 강제했다 | NON_BLOCKING |
| P3 | mail DB native ABI와 Electron ABI는 환경에 따라 다르다 | plain Node mail store 스위트는 실행했고, Electron ABI gate는 저장소 운영 절차에 따른다 | NON_BLOCKING |

### 설계 대비 명시적 차이 (r2)

- `node-pop3` 객체를 직접 호출하지 않고 `pop3/session.ts`가 명령·multiline framing을 소유한다. 이유는 POP3 socket factory 주입, `DELE` 금지, 취소 시 `destroy()`를 한 경계에서 동시에 보장하기 위해서다.
- 별도 `search.ts` 파일 대신 `tools.ts` → `MailSyncManager.search()` → `MailStore.search()` 경로를 사용했다. 검색 handler는 sync manager의 POP3 factory를 받지 않아 EP-02의 음성 경계를 유지한다.

## [구현자 기입] 구현 보고 (r2)

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/features/plugins/mail/**`, `app/src/main/infra/net/pop3-socket.ts`, auth/bootstrap/plugin 배선, migration guard, TRD·security·auth·persistence·closed-network 문서 |
| 실행 명령 | `cd app; npm.cmd run lint` · `npm.cmd run typecheck:node` · `npm.cmd run typecheck:test` · `npx.cmd vitest run src/main/features/plugins/mail src/main/infra/net src/main/app/deployment src/main/features/auth/login.test.ts src/main/features/auth/runtime.test.ts` · `node --test scripts/check-migrations-appendonly.test.mjs` · `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `git diff --check` |
| 관측한 게이트 산출 | lint 0 error(기존 renderer warning 1건) · node/test typecheck 통과 · Vitest 11파일 176케이스 통과 · migration test 19케이스 통과 · 두 migration pair sync/append-only/no-copies 통과 · docs inventory 9 items/98 channels ok · diff 공백 오류 0 |
| V-pair 자기확인 | `MD-02/03/04/05/06/08`, `AR-01/03/04/05/06`의 순수·경계 테스트는 PASS. 전체 V-pair의 독립 판정은 pending이며 `verify.md`에서 닫는다. |
| 강제 지점 전수 | §10 19군·44지점 코드 배치 44/44; 테스트 직접 관측은 11 AC + migration/guard, 나머지 AT/IT/ST pending |
| **AC 자기보고**(`Criteria-Met`) | 11/35 — AC11·AC16·AC18·AC19·AC20·AC22·AC25·AC25b·AC31·AC32·AC33에 직접 증거가 있다 |
| **Criteria-Pending** | AC1~10·AC12~15·AC17·AC21·AC23·AC24·AC26~30·AT/IT/ST fake POP3 왕복과 실서버 TLS/MIME 확인 |
| 블로커 / 역질문 | 없음. 구현 산출은 완료했고 독립 검증자에게 넘긴다. |
| 대상 커밋 | `(r2 구현 — 이 커밋)` |

## [구현자 기입] Review Signals — 사실만 (r2)

- 이번 라운드에서 r1 PLAN_GAP 3건은 ΔV1의 규범 행(D-043~D-047)과 코드 경로로 반영됐다. 새 PLAN_GAP은 발견하지 않았다.
- 이전 라운드와 같은 축의 잠금은 서버 단위 binding, Auth verifier 미주입 불변, migration append-only이며 기존 회귀 스위트로 재실행했다.
- 현재 라운드 수: 2. 다음 주체는 Claude 검증자이며, 이 보고는 구현자의 증거로만 사용한다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | … | … | … | … | … |
