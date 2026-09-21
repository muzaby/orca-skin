# Plan — 0237-pop3-mail-search-plugin

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장 규칙은 [`§산출물 문장 규칙`](../AGENTS.md) — 판정 먼저, 주장 한 줄에 관측 하나, 표 한 칸 3줄, 문단 3문장.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0237-pop3-mail-search-plugin` |
| 작성자 | Claude Code (V1·ΔV1), **Codex (ΔV2·ΔV3 설계·구현)** |
| 일자 | 2026-09-21 |
| 매핑 | 없음 (신규 제품 기능) |
| 상태 | IMPL_DONE — ΔV3 본문 임베드 이미지 제외, 독립 verify 대기 |
| V mode | `Delta V` (기준 `V1`) |
| 기준 V | `V1` — 본 plan의 Baseline, commit `07ec3a6`~`e3ea535` |
| 이번 V revision | `ΔV3` (r5 운영 요구 증분) |
| 유효 V | `V1 + ΔV1 + ΔV2 + ΔV3` |

**현재 규범 증분: ΔV3** — 문서 뒤의 `ΔV3 — 본문 임베드 이미지 제외 (r5)`가 이번 요구의 정본이다. **기존 ΔV2** — §3·§7·§7-A·§10·§11의 `ΔV2` 절이 정본이다. D-022·032·035·039·040과 관련 AC·V·§10·기술 경로의 대체는 이 부속이 정본이다. 과거 구현 보고는 당시 증거로 보존한다.

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
| D-022 | Mail Plugin은 raw credential을 읽는 **세 번째 소비자**가 된다. 주입은 컴포지션 루트가 하고 `AuthSecretReader` 자체는 feature에 넘기지 않는다 | D-021의 귀결. 현재 소비자는 `bootstrap.ts:385`·`:526` 2곳뿐 (§8 F-05) | 설계자 + 사용자 승인(②) | **SUPERSEDED** | D-048 (ΔV2) |
| D-023 | MIME은 `postal-mime`을 사용한다. POP3의 `node-pop3` 도입 부분은 내부 세션 구현으로 대체했다 | 사용자 라이브러리 승인과 D-053·054의 infra 세션 경계. 불필요한 의존성 제거 | 사용자 승인·ΔV2 | MIME ACTIVE / POP3 SUPERSEDED | D-053·D-054 |
| D-024 | 메일 FTS5 tokenizer는 `trigram`이다. `messages_fts`의 `unicode61`을 따르지 않는다 | 설계자 결정. 근거: `unicode61`은 한국어 어절 중간 매치가 **0건**, `trigram`은 3글자 이상 MATCH·2글자 LIKE로 매치 (§8 F-07 실측) | 설계자 | ACTIVE | — |
| D-025 | 연결은 **implicit TLS(기본 995)** 를 요구한다. STARTTLS(`STLS`) 승격은 이번 범위가 아니다 | `node-pop3@0.15.3` 소스에 `STLS` 문자열 0건 (§8 F-11). 평문 110 포트는 선언으로만 허용하고 기본값이 아니다 | 설계자 | ACTIVE | — |
| D-026 | 최초 sync는 **최신 메시지 번호부터 역순**으로 TOP을 돌고 14일 경계 + 유예창을 넘으면 중단한다. 전체 메일에 TOP을 돌지 않는다 | 설계자 결정. 제안서 §9는 "최초 Sync → 신규 UIDL → TOP"이라고만 적어 10,000통 전건 TOP을 함의한다 (§4 진단 ⑨) | 설계자 | ACTIVE | — |
| D-027 | 첨부의 **Artifact Card UI는 이번 범위가 아니다.** `mail_getAttachment`는 Jira 선례와 같이 Temp 경로만 돌려주고, 카드화는 모델이 게시 도구를 부를 때만 일어난다 | `ArtifactRef['kind']`에 office/pdf가 없고(`shared/artifacts.ts:7`) 자동 수집은 temp 루트 **바로 아래 + Work 에이전트** 한정 (§4 진단 ⑦) | 설계자 | ACTIVE | — |
| D-028 | `mail_sync`·`mail_getAttachment`는 `readOnlyHint: false`, `mail_search`는 `readOnlyHint: true`다 | `runtime-tool-policy.ts:19` — `readOnlyHint !== true`면 승인 대상. 원격 I/O와 디스크 쓰기를 자동 통과시키지 않는다 | 설계자 | ACTIVE | — |
| D-029 | Timeout 기본값을 plan이 확정한다 — 연결 15s · 명령 30s · sync 전체 예산 120s | 제안서 §12는 "실제 서버 환경 측정 후 결정"이라 구현자가 정할 수 없다 (§4 진단 ⑪). 값은 설정으로 덮을 수 있다 | 설계자 | ACTIVE | — |
| D-030 | 기본 OSS 배포의 `createPluginBindings()`는 계속 `[]`를 돌려준다. Mail Plugin은 폐쇄망 배포가 typed recipe로 opt-in한다 | Jira·Confluence와 같은 처리 (`docs/arch/backend/auth.md §7`) | 설계자 | ACTIVE | — |
| D-031 | POP3 `DELE`를 **절대 보내지 않는다.** 서버 메일함은 읽기 전용으로 다룬다 | 설계자 결정. 제안서에 없는 축이며 되돌릴 수 없는 파괴적 부작용이다 | 설계자 | ACTIVE | — |
| D-032 | Mail Auth는 **`probe`를 선언하지 않는 것이 정상 경로**다. 자격증명 검증은 **첫 `mail_sync`**가 한다 | `probe`는 gate에서만 필수이고(`GateAuthDefinition` 타입 강제) Plugin Auth는 `probe?` optional이다. POP3-only 서버에는 probe가 칠 HTTP endpoint가 아예 없다. **D-037(lazy 전이 정책)이 이 선택의 근거다** — 선제 검증을 두지 않는 것이 정책이다 | 설계자 | **SUPERSEDED** | D-049 (ΔV2) |
| D-033 | `iso-2022-kr` 메일은 **미지원으로 남긴다.** `mailparser` 폴백을 두지 않는다 | 사용자 결정 — "mailparser 폴백 필요없음. iso-2022-kr 은 미지원으로 남겨두겠음" | 사용자 턴 | ACTIVE | — |
| D-034 | Mail Auth를 **`GATE_AUTH_DEFINITIONS`에 넣지 않는다.** 앱 로그인 게이트와 무관하다 | 사용자 결정 — "pop3 메일서버는 앱 로그인시 체인으로 안해도 된다. Sso 인증이 아니기때문. 토큰 계열도 안해도 된다". Confluence·Jira도 게이트 멤버가 아니다(F-21) | 사용자 턴 | ACTIVE | — |
| D-035 | POP3 인증 거부를 **Auth 강등으로 되먹인다** — `createAuthRuntime` 결과에 좁은 reporter를 더하고 컴포지션 루트가 `authId`를 닫아 Mail Plugin에 준다 | 강등 경로가 HTTP status·probe 둘뿐이라 POP3는 어느 쪽도 안 탄다(F-24). **D-037의 lazy 전이를 POP3에서 성립시키는 유일한 지점**이다 — 관측 자리가 없으면 lazy 전이도 일어나지 않는다. reporter는 이름·시그니처를 Plugin 일반으로 두되 지금 배선하는 소비자는 mail 하나다(rule of three) | 설계자 | **SUPERSEDED** | D-048 (ΔV2) |
| D-036 | Mail Auth는 **`sessionGroup`을 공유하지 않는다.** ADFS SSO로 메일이 자동 인증되지 않고 사용자가 비밀번호를 따로 입력한다 | POP3에는 쿠키가 없어 cookie jar 공유가 성립하지 않는다. `methods[0]`이 입력형이라 자동 재로그인 대상에서도 제외된다(F-23) — 규칙과 일치한다 | 설계자 | ACTIVE | — |
| D-037 | **운영 중 인증 상태는 사용 시점 lazy 전이다.** 도구 호출·(있다면) 주기 실행이 실패를 관측한 자리에서 만료·미인증으로 내린다. 주기 검증·polling을 만들지 않는다. **연결 버튼을 누른 순간은 예외로, 그때는 즉시 증명한다**(D-040) — 사용자가 결과를 기다리는 자리다 | 사용자 결정 — "모든 플러그인은 내부동작(주기적 실행 등), 도구 호출 등이 이루어질때, 실패시 만료, 미인증, 인증 해제 등으로 lazy하게 바뀌어도 된다". `auth.md §4.4`의 "`settleExpiry()` 가 snapshot·request·resume 이 이미 지나는 자리에서 그 전이를 한 번 확정하고 **polling 을 새로 만들지 않는다**"와 같은 방향이다 | 사용자 턴 | ACTIVE | — |
| D-038 | lazy 전이는 **강등(`expired`·`unauthorized`)까지만** 한다. 실패가 `revoke`(자격증명 삭제)를 부르지 않는다 | `auth.md §11` "해제는 fail-closed, 추가·교체는 degrade-open" — 방향이 다르다. 오타·일시 장애 한 번이 보관된 비밀번호를 지우면 사용자가 되돌릴 수 없다. 해제는 사용자가 연결 탭에서 직접 한다 | 설계자 | ACTIVE | — |
| D-039 | POP3 인증은 **`USER`/`PASS`(ID·비밀번호)만 지원한다.** SASL 토큰 인증(`AUTH XOAUTH2` 등)은 **한계로 기록하고 홀드**한다 | 사용자 결정 — "id passwd만 지원하고 나머지 인증 방식에 대해서는 한계점으로 남겨두고 홀드하라". `node-pop3@0.15.3`이 `_connect()`에 `USER`/`PASS`를 하드코딩해 SASL 경로가 없다(F-26) — 채택 라이브러리와 범위가 일치한다 | 사용자 턴 | **SUPERSEDED** | D-050 (ΔV2) |
| D-040 | **연결 버튼은 실제 POP3 로그인 왕복으로 증명한다.** `LoginDeps`에 authId별 optional verifier를 더하고 컴포지션 루트가 mail에만 주입한다. 검증은 **candidate**(커밋 전 자격증명)로 하고 실패하면 커밋하지 않는다 | `login.ts:499`가 `probe` 미선언을 무조건 통과시켜 값 입력만으로 `valid`가 된다(F-06b). seam은 이미 있다 — `LoginDeps.request`가 authId별 주입 함수이고 `candidate`를 받으며 커밋은 probe 뒤다(`login.ts:143`) | 설계자 | **SUPERSEDED** | D-049 (ΔV2) |
| D-041 | 입력형의 **거부 메시지를 파라미터화**한다. verifier가 `rejected`(거부)와 `unreachable`(도달 실패)을 구분해 돌려주고 `input-required` step이 그에 맞는 문구를 싣는다 | `login.ts:716`이 `'자격증명이 거부되었습니다. 값을 확인해 주세요.'` **고정 문자열**이라 두 경우가 같은 화면이 된다(F-27). 서버에 못 닿은 것을 비밀번호 탓으로 읽으면 사용자가 맞는 값을 계속 다시 넣는다 | 설계자 | ACTIVE | — |
| D-042 | verifier는 **`candidate`가 있을 때만** 돈다 — 즉 `login`/`reauth`에서만 돌고 **부팅 `resume()`에서는 돌지 않는다** | `probe()` 호출부는 2곳뿐이고 `resume()`은 candidate 없이(`login.ts:336`), login settle은 candidate와 함께(`:567`) 부른다 — 유무가 그대로 판별자다(F-28). 부팅마다 POP3를 여는 것은 D-037이 금지한 선제 검증이다 | 설계자 | ACTIVE | — |
| D-043 | **`mail_search` 결과가 첨부 매니페스트를 싣는다** — hit마다 `attachmentCount`와 `attachments:[{attachmentId, filename, mimeType, sizeBytes}]`. `attachmentId`는 `attachment.id`(불투명 PK)이고 `stored_name`·경로가 아니다. `hasAttachments` boolean은 **제거한다** — `attachmentCount`에서 파생된다 | 사용자가 "검색 결과 + 단건"을 선택. r1 G1 — `mail_getAttachment`가 요구하는 `attachmentId`의 producer가 plan 어디에도 없어 §5 첨부 흐름의 진입점이 끊겨 있었다 | 사용자 턴 | ACTIVE | — |
| D-044 | **`mail_getAttachment`는 단건 전용이다** — `mailId`·`attachmentId` 둘 다 필수다. Jira의 합집합 selector(`issueKey` XOR `attachmentId`)와 `filename` 필터를 **복제하지 않는다**. 첨부 N개 = 호출 N회 = 승인 N회 | 사용자 결정 — 승인 3회·staging 3배치라는 비용을 제시한 뒤 "단건 전용 유지". 입력·결과 형상이 가장 좁고 AC10·AC12가 단순해진다 | 사용자 턴 | ACTIVE | — |
| D-045 | **D-019의 "Sync 실패"는 비인증 장애로 한정한다** — 연결·TLS·타임아웃·파싱·DB 오류 5종이다. 이때 Auth는 `valid`로 남고 캐시 검색이 계속된다. **자격증명 거부는 Auth 강등이며 도구 3종이 전부 회수되어 캐시 검색도 불가능해진다** | 사용자가 "3도구 전부 회수"를 선택. `createPluginBinding.sync()`가 서버를 통째로 add/remove하고(`plugins.ts:57-68`) `plugins.test.ts:69-71`이 "valid 만 등록 이 곧 나머지 셋은 전부 회수"를 주석으로 적고 `none`·`expired`·`unknown` 3케이스로 잠갔다. 서버를 둘로 쪼개는 우회는 `duplicateConnectionAuthIds`(0188 D-029)가 한 authId 두 row로 진단한다 | 사용자 턴 | ACTIVE | D-019 대체 |
| D-046 | **일반 UIDL 소실은 본문을 삭제하지 않는다.** ledger state를 `missing`으로 표시만 하고 행·FTS·첨부는 retention이 지울 때까지 남는다 — **서버에서 지운 메일이 최대 14일간 검색에 계속 뜬다** | D-004("삭제 기준은 14일 Retention**뿐**")의 직접 귀결이다. r1 G3이 "일반 UIDL 소실의 본문 삭제 여부"를 물었고, ACTIVE 결정이 답을 강제한다 — 재해석하지 않는다 | 설계자 (D-004 귀결) | ACTIVE | — |
| D-047 | **보호 상태가 막는 것은 삭제가 아니라 대량 재수집이다.** D-046 아래 `removed:0`은 모든 경로에서 참이라 판별자가 아니다. 보호 중에는 신규 UIDL을 **수집하지 않는다**(RETR 0회). 임계 `retainedRatio < 0.5` · 최소 표본 `활성 ledger >= 20` · 해제는 ①비율 회복 또는 ②같은 `remoteFingerprint` **2회 연속** 관측 시 채택이다 | r1 G3 — D-018은 "대량 삭제하지 않는다"만 말해 D-004 아래 공허했다. 임계·표본·해제는 정책 파라미터라 설계자가 확정한다. 해제를 사용자 조작에 맡기면 renderer 화면이 비범위(§6)여서 탈출구가 없다. **D-018을 대체하지 않고 그 위에 메커니즘을 얹는다** — D-018은 ACTIVE로 남는다 | 설계자 | ACTIVE | — |

### 갱신 메모

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

### ΔV2 증분 — D-048~D-055 (Codex, 2026-09-20)

| ID | 결정 | 근거/조건 | 상태·대체 |
|---|---|---|---|
| D-048 | `PluginAuth extends BoundAuth`는 label/origin과 자기 credential을 사용하는 `withCredential`만 추가한다. `PluginDeploymentDeps`는 auth/registry/logger뿐이다 | 사용자: auth만 받는 서버, 계약 슬롯 증식 금지. 신뢰하는 built-in 코드의 권한 경계이며 sandbox가 아니다 | ACTIVE; D-022·D-035 대체 |
| D-049 | HTTP probe 선언을 보존하고 실행형 probe를 추가한다. AuthMethod의 probe가 있으면 정의의 probe보다 우선하며 실행형은 기본적으로 login candidate에만 실행된다 | 사용자: 통신/인증별 probe는 플러그인 소유, core 분기 금지 | ACTIVE; D-032·D-040 대체 |
| D-050 | core는 vault 문자열과 authKind/principalId만 전달한다. 프로토콜에서 쓰는 password/app-password/XOAUTH2 형상과 POP3/IMAP 연결 형상은 mail 인터페이스에 둔다. 현재 factory는 POP3 password만 제공한다 | 사용자: 이번 범위 외 인터페이스만. 중복 인증 레지스트리·프로토콜별 core switch 불필요 | ACTIVE; D-039 대체 |
| D-051 | `present`는 HTTP 전용으로 선택적이다. non-HTTP authority URI를 등록할 수 있으나 `request()`는 HTTP(S)만 허용한다 | 사용자: HTTP 외 프로토콜 지원; HTTP 송신 정책 보존 | ACTIVE |
| D-052 | `withCredential`에서 읽은 revision을 닫은 rejection callback만 해당 grant를 만료시킨다. 옛 요청의 거부는 새 로그인에 영향을 주지 않는다 | 기존 store.markExpired의 observedRevision 보존 | ACTIVE |
| D-053 | infra는 파일 SQLite 열기와 앱 데이터 경로, POP3 세션/소켓을 제공한다. mail은 스키마·MIME·검색·보관 정책을 소유한다 | 사용자: 연결되지 않는 자원은 infra 확장. 도구 작업 finally에서 DB close, sync Promise만 공유 | ACTIVE |
| D-054 | probe와 sync가 같은 POP3 세션 구현을 사용한다. 응답 bytes를 보존하고 coalesced/fragmented 데이터·EOF·error·abort·timeout을 모두 종결한다 | 기존 parser가 waiter 없는 줄을 버리는 재현 확인. MIME 원문 손상은 AC17 위반 | ACTIVE |
| D-055 | 완료된 메시지는 유지하되 취소된 메시지는 저장하지 않는다. sync 전체 예산을 넘으면 stale로 두어 다음 호출에 증분 재개한다 | D-006·D-029·AC24의 구현 명확화; 전체 트랜잭션/롤백 신규 정책 없음 | ACTIVE |

### ΔV2 보완 — D-056·D-057 (외부 리뷰 흡수, 라운드 증가 아님)

| ID | 결정 | 근거/조건 | 상태·대체 |
|---|---|---|---|
| D-056 | 실행형 probe도 **grant 보존 축**을 갖는다. `execute`가 `preserveGrant`를 돌려주면 그 실패는 복원된 grant를 만료시키지 않는다. 생략하면 기존대로 만료한다 | HTTP probe는 `authFailureStatuses`로 "권한·정책 실패지 자격증명 거부는 아님"을 말할 수 있는데 실행형에는 그 통로가 없어, `onResume` 선언이 서버 점검·도달 실패로 살아 있는 연결을 잃었다. D-049의 "선언 소유 probe"와 같은 축이므로 같은 모양으로 맞춘다. 기본값이 기존 동작이라 다른 선언은 바뀌지 않는다 | ACTIVE; D-049 보완 |
| D-057 | 연결 좌표(host·port·tls)의 사본은 **`AuthDefinition.origin` 하나다.** 배포는 좌표를 선언 입력에만 적고, 런타임 옵션은 좌표를 담지 않으며, 소비자는 `origin`에서 되읽는다 | ΔV2는 좌표 출처를 정하지 않아 옵션과 origin 두 사본을 부팅에서 대조하는 구현이 나왔다. 사본이 하나면 대조가 필요 없고 어긋날 수도 없다. 부수로 포트·TLS 기본값 식이 3벌에서 1벌이 된다 | ACTIVE; D-053 보완 |

D-023의 MIME 도입은 유지하고 POP3 라이브러리 도입은 D-053·054의 작은 infra 세션으로 대체한다. `node-pop3`의 USER/PASS 하드코딩을 미래 인터페이스의 제약으로 삼지 않는다. 신규 의존성은 없다. D-041·D-042의 verifier는 실행형 probe를 뜻하며 전역 `LoginDeps.verify` 주입은 제거한다.

### ΔV2 r4 — verify 지적에 따른 기술·증거 정정 (Codex, 2026-09-21)

제품 계약·AC 개수는 유지한다. 아래 행은 같은 ID의 이전 기술 경로를 대체하며, 나머지 유효 V는 승계한다.

| 귀속 | 정정 | 확인할 증거 |
|---|---|---|
| AC20·VP-10·EP-09 | 소켓 경계는 실행되는 net/tls 모듈 참조를 검사한다. 타입 전용 import/export는 예외이고, 허용 경로는 정확히 `infra/net/pop3-socket.ts`다. 문자열 제거용 helper를 이 검사에 쓰지 않는다 | 허용목록 밖 runtime import를 실제 파일에 심으면 가드 red. 같은 basename의 다른 디렉터리도 거부, 타입 전용·주석·문자열은 허용. 실제 TLS 양성 축 유지 |
| MD-02·VP-15·EP-03·§11 | retention SSOT는 `store.cleanupExpired` SQL이다. 미배선 `retention.isExpired` 사본은 제거하고 실제 SQLite에서 14일 ±1초·headerDate 우선·null fallback을 검증한다 | 기존 N1의 미배선 정책 사본 없음, N5의 날짜 우선순위 변이 red; 삭제 지점 4개 유지 |
| VP-04·EP-01·§14 | 기존 매니페스트 상한(메일당 10·응답 전체 50)을 store 결과 조립에서 적용한다. 줄어든 각 hit에 `attachmentsTruncated:true`를 싣고 실제 `attachmentCount`는 보존한다 | 50메일×다중 첨부 검색에서도 매니페스트 합산 ≤50, 생략 표시·id 왕복 유지 |
| EP-25 | mail/jira 두 정규화 지점에 별칭 root의 실제 파일 왕복 증거를 둔다 | M23 jira 정규화 되돌림 red, mail 회귀 유지 |
| D8·D9·D11 | D-023의 POP3 부분 상태·§15 옵션 형상·기준 V 좌표를 실제 코드/커밋과 맞춘다 | `node-pop3` 의존성 0, options 좌표 필드 0, `e3ea535` commit 실재 |

READY 대조: D-017의 날짜 우선순위와 AC7은 유지하고, AC20의 타입 예외는 실행 소켓 경계라는 원래 목적을 명시한다. D-048~057의 auth/infra 책임과 서버별 계약 슬롯 금지에는 변경이 없다. r4는 VP-10 REQUIRED, VP-03·04·15·19·24 및 EP-25를 영향 회귀로 확인하고 다른 pair는 기존 의미를 보존한다.

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

### ΔV2 — AC 대체와 추가

| AC | 행동 단언 | 검증 |
|---|---|---|
| AC21 (대체) | HTTP와 POP3를 `bindForPlugin` 결과와 서버 옵션만으로 조립한다. 같은 deps 타입으로 서버를 추가하며 Bootstrap에 mail 인자가 없다 | 타입 검사 + 실제 runtime/binding/tool 통합; 잘못된 auth id는 즉시 거부 |
| AC29·30 (경로 대체) | 해당 인증 방식의 probe만 후보 값으로 실행되고 성공만 commit한다. 거부/도달 실패 문구가 다르며 HTTP 기존 요청 및 POP3 resume 무통신을 보존한다 | 메모리 vault·fake POP3·기존 Auth 회귀 |
| AC34 | 비인증 오류는 상태를 유지하고 현재 credential의 거부만 만료한다. 이전 revision의 거부는 재로그인 상태를 유지한다 | runtime + binding 통합, 동시 credential 교체 |
| AC35 | 합쳐진 UIDL/RETR와 나뉜 CRLF를 처리하고 RETR의 비 UTF-8 bytes가 동일하다. USER/PASS -ERR, EOF·abort·timeout 뒤 Promise와 소켓이 끝난다 | 실제 세션 + fake socket; 성공/실패 양쪽 |
| AC36 | 도구 성공/실패·초기화 실패·동시 sync 후 DB가 닫히고 다음 호출이 재시도된다. 검색은 소켓을 만들지 않는다 | 파일 DB·mock infra 자원 + 도구 호출 |
| AC37 | POP3 기본 TLS 검증을 약화시키는 옵션을 거부하고 명령 입력의 CR/LF를 차단한다. 허용 명령 외 송신은 없다 | socket/session 테스트 및 기존 AC20·26 |
| AC38 | POP3 password factory가 연결 검증과 sync에 동일한 username/password를 사용한다. 다른 인증/프로토콜은 타입만 제공하고 미지원 실행 성공을 만들지 않는다 | probe → runtime commit → tool 왕복 + typecheck |

AC1~33(AC25b·28b 포함)은 위 대체 외 승계한다. 이전 r2의 미검증 항목을 통과로 간주하지 않는다. 실서버 계정이 없는 환경에서는 실제 사내 TLS·EUC-KR 서버 실기는 미실행으로 보고하며 fake/server fixture 검증과 구분한다.

## 7-A. V / Trace Matrix

- V mode 판정: **Delta V** (`ΔV1`). 기준은 본 plan의 Baseline `V1`이고 유효 V는 `V1 + ΔV1`이다.
- 기준 V 상속 근거: `V1`은 commit `07ec3a6`(Baseline 설계) ~ `e3ea535`(r1 PLAN_GAP 보고)에 확정돼 있다. **구현은 착수되지 않았다**(AC 자기보고 0/30) — 따라서 `ΔV1`이 건드리지 않은 V1 pair는 전부 `REQUIRED`로 그대로 상속되며, 이 절은 그것을 복사하지 않는다.
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

### ΔV2 — Delta V 노드·pair

AR-02/IT-02, AR-05/IT-05·05b, AR-06/IT-06, R-05/AT-19는 CHANGED다. 나머지 V1+ΔV1 노드는 INHERITED이며 해당 테스트를 회귀한다. 다음 신규 노드는 NEW다: R-08/AT-22(공통 배포), SD-04/ST-04(인증→도구), AR-07/IT-08(자원 수명), MD-09/UT-09(POP3 byte stream), MD-10/UT-10(범용 credential scope).

| Pair | 노드 | 성격·production path | oracle·적대 증거 | 강제 지점 |
|---|---|---|---|---|
| VP-11 (대체) | AR-02 ↔ IT-02 | REQUIRED; deployment → bindForPlugin → mailTools | 사용자 입력 USER/PASS 실제 송신, AuthSecretReader·mail 전용 deps 없음. 옛 raw-reader 변이는 계약 폐기되어 superseded | EP-10 |
| VP-21 (대체) | AR-05 ↔ IT-05·05b | REQUIRED; session → bound callback → markExpired → binding.sync | 거부 시 서버 0, 비인증 5종 시 서버 1. callback no-op 변이 선택 | EP-16 |
| VP-22 (대체) | R-05 ↔ AT-19 | REQUIRED; auth method probe → candidate → commit | 실패 vault 쓰기 0·성공 저장, 두 메시지. 결과 무시 변이 선택 | EP-17 |
| VP-23 (대체) | AR-06 ↔ IT-06 | REQUIRED; login/resume → 선언 probe | HTTP 요청 수/커밋 회귀, POP3 resume 접속 0. resume 조건 삭제 변이 선택 | EP-17 |
| VP-26 | R-08 ↔ AT-22 | REQUIRED; auth definitions → deployment → tools | 공통 deps로 HTTP/POP3 서버 조립. 타입 회귀가 primary oracle, mutation not selected | EP-20 |
| VP-27 | SD-04 ↔ ST-04 | REQUIRED; 후보 로그인 → sync → 거부 → 도구 회수 | 실제 세션 왕복·3도구 제거·재인증 회복. VP-21/22 변이 재사용 | EP-16·17 |
| VP-28 | AR-07 ↔ IT-08 | REQUIRED; tool → infra DB → finally | 동시 sync 하나, 성공/예외/초기화 실패 후 close/재시도, 검색 접속 0. close 삭제 변이 선택 | EP-21 |
| VP-29 | MD-09 ↔ UT-09 | REQUIRED; socket → parser → RETR bytes | coalesced/fragmented/EOF/abort/timeout, 인코딩 bytes 동등. 줄 버리기 변이 선택 | EP-22 |
| VP-30 | MD-10 ↔ UT-10 | REQUIRED; bound credential → revision callback | 다른 authId 접근 불가, expired 접근 거부, stale revision의 거부 무효. revision 인자 삭제 변이 선택 | EP-23 |

VP-01~10·12~20·24~25는 REGRESSION으로 실행하며 이전에 선택한 적대 증거는 승계한다. 미실행 pair·변이는 구현 보고에서 이름으로 남긴다. 증거 없는 SELF_PASS를 금지한다.

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
      ├─ store.cleanupExpired    14일 경계 → cleanup 대상
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
| `features/plugins/mail/store/index.ts` | 14일 경계·headerDate 우선·만료 정리 SSOT | `cleanupExpired(now, retentionDays)` → 삭제 건수 | `sync-manager.ts` |
| `features/plugins/mail/freshness.ts` | 5분 판정 (순수) | `{now, lastSyncAt}` → `boolean` | `sync-manager.ts` |
| `features/plugins/mail/query-builder.ts` | FTS 질의 생성 · 길이 분기 (순수) | 질의 문자열 → `{mode:'match'\|'like', sql}` | `search.ts` |
| `features/plugins/mail/attachment-export.ts` | Temp staging→rename · 경로 은닉 | `{mailId, attachmentId}` → `{savedPath}` | `tools.ts` |
| `features/plugins/mail/tools.ts` | descriptor + 3 handler + 결과 조립 | `RuntimeToolServer` | `app/deployment/plugins.ts` |

## 10. 계약 / 타입 / 강제 지점

| EP | V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (지점 전수) | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 | R-04·R-07 / VP-04·VP-19·VP-24 | 내부 경로와 `stored_name`은 어떤 출력에도 없다. 첨부는 **불투명 `attachmentId`로만** 지칭한다 | `tools.ts` 결과 조립기 | mail 슬라이스 | **4지점** — `mail_search` 결과(매니페스트 포함) · `mail_getAttachment` 결과 · 오류 매핑 · `structuredContent` | 사용자·모델이 플러그인 내부 저장 구조를 본다. D-012·D-043 위반 |
| EP-02 | R-02 / VP-02 | `mail_search`는 소켓을 열지 않는다 | `search.ts` 시그니처 | mail 슬라이스 | **2지점** — `search.ts`가 소켓 팩토리를 인자로 받지 않음(타입) · 도구 조립에서 `mail_search` handler에 팩토리 미전달(배선) | D-015 위반. 검색이 네트워크 지연·실패를 탄다 |
| EP-03 | R-03 / VP-03·VP-14·VP-15 | 14일 초과 데이터는 검색 대상이 아니고, **삭제 기준은 retention 하나뿐이다** | `store.cleanupExpired` SQL | mail 슬라이스 | **4지점** — `mail` 행 삭제 · `mail_fts` 행 삭제 · 첨부 파일 삭제 · **삭제 호출부가 retention 경로 하나뿐**(전수 grep — UIDL 소실 경로에 삭제 0건, D-046) | 만료 메일이 검색되거나 디스크에 남는다. 또는 UIDL 소실이 두 번째 삭제 기준이 된다 — 둘 다 D-004 위반 |
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

### ΔV2 — 강제 지점 증분

| EP | 불변식·SSOT | 강제하는 자리 | 실패 의미 |
|---|---|---|---|
| EP-10 (대체) | auth만으로 서버 생성 / contracts/auth.ts | bindForPlugin; mailTools 공개 인자 | Bootstrap 서비스 슬롯 복귀 |
| EP-16 (대체) | 확실한 현재 credential 거부만 강등 | USER/PASS -ERR; mail 오류 분류; withCredential revision callback | 네트워크 장애/오래된 응답으로 새 인증 회수 |
| EP-17 (대체) | 선언 소유 probe / login.ts | method 우선 선택; candidate 검증·commit; resume 정책; 거부/도달 실패 문구 | 다른 Auth 가로채기·미확인 저장·부팅 접속 |
| EP-20 | 배포 deps 불변 / plugins.ts | deps 타입; 기본 [] recipe; Bootstrap 호출 | 새 프로토콜마다 조립 계약 추가 |
| EP-21 | 작업 범위 자원 정리 / infra DB + mail tools | SQLite open 실패; manager 작업 finally; shared sync finally | DB 누수·실패 Promise 영구 캐시 |
| EP-22 | bytes/종결 보장 / infra POP3 | chunk 큐; multiline; EOF/error; abort; command timeout; login timeout; QUIT; TLS 검증; 명령 CRLF | 데이터 유실·hang·인증 우회·명령 삽입 |
| EP-23 | bound auth scope / runtime.ts | unknown bind 거부; valid credential 읽기; revision 캡처; markExpired 인자 | 타 인증 노출·expired 사용·신규 credential 강등 |

**보완 패스 증분 (D-056·D-057).**

| EP | 불변식·SSOT | 강제하는 자리 | 실패 의미 |
|---|---|---|---|
| EP-17 (증분) | 자격증명 거부로 **관측된** 실패만 복원 grant를 만료시킨다 / login.ts | 실행형 probe 결과의 `preserveGrant` 전달; mail 선언의 `authFailure` 분류 | 서버 점검·권한 부족·도달 실패로 살아 있는 연결 회수 |
| EP-24 | 연결 좌표는 `AuthDefinition.origin` 한 사본 / mail types.ts | 런타임 옵션 타입에 좌표 필드 없음; `resolveMailEndpoint`(authoring 1곳)·`parseMailOrigin`(reading 1곳); 기본값 식 1곳 | 두 사본이 갈려 선언과 실제 접속처가 달라짐 |
| EP-25 | 봉쇄 검사의 parent는 **스스로 정규화한다** / 첨부 저장 경로 | mail `exportMailAttachment`; jira `createJiraAttachmentStore` — 기본 경로 제공자의 반환을 그대로 parent로 쓰지 않는다 | 8.3 별칭·symlink 조상에서 정상 경로가 `unsafe`로 거부됨 |

전수 술어는 **불변식의 주어**로 쓴다 — EP-25는 `realpath 한 자식과 비교되는 parent`이지 `ensureDirectory(null, …)`(해법 이름)이 아니다. 해법 이름으로 세면 이미 고친 지점만 분모에 오른다.

구현자는 credential 소비·probe 호출·DB 열기·소켓 생성과 종결을 술어로 전수 검색해 위 목록의 누락을 확인한다. 기존 EP-01~09·11~15·18~19는 승계한다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/infra/net/pop3-socket.ts` | **신규** — 소켓 생성 유일 지점 | `createPop3Socket(opts): Duplex`. `node:net`·`node:tls`를 무는 유일한 파일 | electron 미의존이나 `node:tls`를 물므로 **fake TLS 서버**로만 통합 테스트 |
| `app/src/main/infra/net/pop3-socket.guard.test.ts` | **신규** — 유일성 가드 | `no-node-fetch.test.ts`와 같은 `scanOffenders` 방식. 허용 목록 = `pop3-socket.ts` 1개 + 자기 정규식 오탐/미탐 고정 | 소스 문자열 스캔 (순수) |
| `app/src/main/features/plugins/mail/tools.ts` | **신규** — descriptor + 3 handler | `mailTools(ctx, options): RuntimeToolServer`. `instructions`에 "검색 전 `mail_sync`" 유도 + **"첨부는 `mail_search`가 준 `attachmentId`로 한 건씩 받는다"**(D-043·D-044). `mail_getAttachment` 스키마는 두 키 모두 required (EP-18) | 순수 — 의존 전부 주입 |
| `.../mail/sync-manager.ts` | **신규** — 오케스트레이션 + single-flight | `Map<authId, Promise<SyncResult>>` | 순수 — 소켓 팩토리·시계 주입 |
| `.../mail/pop3/session.ts` | **신규** — 명령 시퀀스 + 화이트리스트 (MD-07) | `node-pop3` `Command`를 감싸고 허용 6명령만 통과. `DELE`는 화이트리스트 밖이다 | 순수 — 소켓 팩토리 주입 |
| `.../mail/pop3/errors.ts` | **신규** — 오류 정규화 | POP3 `-ERR`·소켓 오류 → `{code, authFailure}` + 마스킹 | 순수 |
| `.../mail/reconcile.ts` · `freshness.ts` · `query-builder.ts` · `normalize.ts` · **`protection.ts`** | **신규** — 순수 로직 | MD-01·MD-03·MD-04·MD-05·**MD-08**. MD-02는 store 실제 SQLite 경로 | 순수 단위·store 경계 테스트 |
| `.../mail/store/index.ts` · `migrate.ts` · `migrations/0001_mail.sql` | **신규** — mail.db | 연결·PRAGMA·마이그레이션·질의 | DB 스위트 (ABI 필요, 환경 한계 분리) |
| `.../mail/attachment-export.ts` | **신규** — Temp 공개 (MD-06) | Jira store와 **같은 구조**를 새로 작성 (교차 import 금지, F-18) | 순수 — 루트 주입 |
| `app/src/main/app/deployment/plugins.ts` | **수정** — 조립 예제 | `createMailPlugin` 사용 예제를 주석으로 추가. 기본 반환은 `[]` 유지 (D-030) | 기존 `plugins.test.ts` 확장 |
| `app/src/main/app/bootstrap.ts` | **수정** — 자격증명·소켓·강등 주입 | Plugin 배포 deps에 `secret(authId)` closure · 소켓 팩토리 · `reportCredentialRejected(authId)` closure를 추가 | `deployment-wiring.test.ts` 확장 |
| `app/src/main/features/auth/runtime.ts` | **수정** — reporter 노출 | `createAuthRuntime` 결과에 `credentialRejectionReporter`를 더한다. `AuthRuntime` 인터페이스와 `RouterContext`는 건드리지 않는다 (AR-05) | `runtime.test.ts` 확장 |
| `app/src/main/features/auth/login.ts` | **수정** — verifier 분기 + 거부 문구 | ① `LoginDeps.verify?: (authId, candidate, signal) => Promise<{ok, rejected}>`를 더하고 `probe()`에서 **`candidate`가 있을 때만** 우선한다(D-042) ② `:716`의 고정 거부 문구를 outcome에 따라 갈라 싣는다(D-041). 타임아웃은 기존 `PROBE_TIMEOUT_MS`(15s) (AR-06) | `login.test.ts` 확장 |
| `app/scripts/check-migrations-appendonly.mjs` | **수정** — 가드 일반화 | 단일 상수 2개 → `{dir, source}` 목록. mail 쌍 등재 | 동반 `*.test.mjs` 확장 |
| `app/package.json` | **수정** — 의존성 | `postal-mime` 유지, 미사용 `node-pop3` 제거 (D-023·D-053·054) | — |
| `docs/arch/backend/security.md` | **수정** — §1.8 표 | POP3 예외 1행 추가 + 강제 수단 명시 | `check-doc-inventory.mjs` |
| `docs/arch/backend/auth.md` | **수정** — §7 | Plugin이 비-HTTP 전송을 쓰는 경우와 자격증명 주입 경로 서술 | 같은 가드 |
| `docs/guides/closed-network-extensions.md` | **수정** — §4 | Mail Plugin 레시피 (POP3 host/port/TLS 옵션·CA 주입) | 같은 가드 |
| `docs/arch/backend/persistence.md` | **수정** — §1 | 두 번째 DB(`mail.db`)의 소유·경로·마이그레이션 서술 | 같은 가드 |
| `docs/TRD.md` | **수정** — §2 Stack | 내부 POP3 세션·`postal-mime` 등재 | 같은 가드 |

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

### ΔV2 — 사용자 결과와 범위

기존 HTTP 플러그인과 POP3 플러그인은 같은 `deps.auth.bindForPlugin(id)`로 자기 인증만 받아 생성한다. 새 서버 때문에 Bootstrap 인자나 `PluginDeploymentDeps`에 서비스별 슬롯을 추가하지 않는다. DB와 전송 구현은 infra에서 확장하며 Auth에 DB·소켓 서비스 컨테이너를 넣지 않는다.

이번 실행 구현은 POP3 USER/PASS다. IMAP·앱 비밀번호·XOAUTH2는 명시적인 인터페이스만 남기고 지원되지 않는 로그인 선택지를 UI에 노출하지 않는다. 연결 버튼은 실제 인증을 확인한 후에만 저장하며 부팅 시 POP3 선제 probe는 하지 않는다. 사용 중 확실한 인증 거부만 해당 인증을 만료시키고 도구 전체를 회수한다.

소규모 정적 배포를 유지한다. 동적 로더·DI 컨테이너·capability registry·공통 전송 프로토콜 enum·플러그인 lifecycle 플랫폼은 만들지 않는다. DB 연결은 도구 작업 범위에서 닫아 공통 dispose 계약을 추가하지 않는다.

### ΔV2 — 구현 지침·게이트

1. `contracts/auth.ts`: HTTP probe와 실행형 probe union, PluginAuth, 선택적 presentation. 실행형 callback에는 `{value, authKind, principalId?}`와 AbortSignal만 제공한다. AuthMethod에도 probe 선언을 허용한다. 프로토콜 enum은 Auth core에 두지 않는다.
2. `features/auth`: registry는 authority URI를 검증한다. request는 HTTP(S)로 제한한다. login은 선언 probe를 후보 값으로 호출하고 timeout/오류를 안전하게 처리한다. runtime은 scoped credential과 revision callback을 제공하고 전역 verifier/reporter를 제거한다.
3. `infra/net`: raw socket과 POP3 상태 기계를 소유한다. 메일 auth helper와 sync가 같은 세션을 쓴다. 비밀이나 서버 응답을 오류 문자열에 넣지 않는다.
4. `infra/db`·앱 경로 helper: 파일 DB open/close만 제공한다. mail store의 스키마·SQL·보관 정책은 mail에 둔다. 공개 `mailTools(auth, options)`는 내부 infra 기본값을 사용한다. 단위 테스트 주입은 하위 manager/session seam으로 제한한다.
5. `app/deployment/plugins.ts`·Bootstrap: mail 인자/전역 verify/reporter를 제거하고 기존 binding 동기화 흐름을 보존한다. 문서 레시피를 실제 타입으로 검사한다.
6. `auth.md`·`security.md`·`persistence.md`·폐쇄망 가이드의 현재 구조를 갱신한다. 사용자 요청에 따라 설계 및 구현 커밋의 `Agent`는 모두 `codex`다.

게이트: app의 lint·typecheck(node/web/test)·Vitest 전체·scripts 테스트·core migration append-only·문서 inventory. 실제 사내 서버 접속은 계정/환경이 없으면 미실행으로 명시한다. 운영 gate와 pair 증거는 서로 대신하지 않는다.

READY self-review: 사용자 요구 D-048~055가 AC21·29·30·34~38 및 VP-11·21~23·26~30에 연결된다. 폐기된 전역 주입은 변경 ledger와 경로 대체에 명시했다. 이번 문서는 Codex가 작성했으며 구현 산출과 분리해 커밋한다.

### Codex 구현 전파 조사 — gate 회귀 경계 보완

실행형 probe의 `onResume` 기본 생략을 gate가 그대로 받아들이면 저장된 자격증명만으로 gate가 열릴 수 있다. Mail은 gate 비대상이지만 공통 Auth 타입의 소비자라 AR-06/IT-06·VP-23의 회귀 범위에 `selectGateMembers`를 포함한다. gate는 정의의 probe와 모든 방식별 유효 probe가 복원 검증 가능한 경우만 선택한다(HTTP 또는 `execute` + `onResume:true`). 누락/복원 생략은 기존 `missing_probe`로 fail-closed한다.

EP-17에 gate 선택 지점을 추가한다. oracle은 HTTP gate 허용, 실행형 `onResume:true` 허용, 생략/false 및 method override로 생략한 gate 차단이다. 적대 증거는 선택 조건 삭제이며 기존 VP-23에 포함한다. 이는 신규 gate 기능 요구가 아니라 공통 probe 확장에 따른 기존 접근 정책 보존이다.

#### gate 회귀 경계 보완 (구현 전파 조사)

실행형 probe의 `onResume` 기본 생략을 gate가 그대로 받아들이면 저장된 자격증명만으로 gate가 열릴 수 있다. Mail은 gate 비대상이지만 공통 Auth 타입의 소비자라 AR-06/IT-06·VP-23의 회귀 범위에 `selectGateMembers`를 포함한다. gate는 정의의 probe와 모든 방식별 유효 probe가 복원 검증 가능한 경우만 선택한다(HTTP 또는 `execute` + `onResume:true`). 누락/복원 생략은 기존 `missing_probe`로 fail-closed한다.

EP-17에 gate 선택 지점을 추가한다. oracle은 HTTP gate 허용, 실행형 `onResume:true` 허용, 생략/false 및 method override로 생략한 gate 차단이다. 적대 증거는 선택 조건 삭제이며 기존 VP-23에 포함한다. 이는 신규 gate 기능 요구가 아니라 공통 probe 확장에 따른 기존 접근 정책 보존이다.

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

- 외부/배포가 구현할 config: `MailPluginOptions = { tlsOptions?: TlsOptions; accountId: string; retentionDays?: number; freshnessMs?: number; timeouts?: {...} }`.
- 구현 문서: `docs/guides/closed-network-extensions.md §4`에 Mail 레시피를 추가한다 — `createMailAuth(id, label, endpoint)`로 POP3 origin 선언 → `bindForPlugin(id)` → `mailTools(auth, options)` 조립. 사설 CA는 options에 주입한다(D-057).
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
- 의존성: `postal-mime@^3.0.0`은 사용자 승인(D-023)으로 유지한다. POP3는 D-053·054에 따라 내부 세션을 사용하고 `node-pop3`는 제거한다.

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
- [x] 명시적인 기존 V를 일부 바꿀 때만 Delta V를 썼고 유효 V를 재구성할 수 있다 — 기준 `V1`(commit `07ec3a6`~`e3ea535`, 구현 미착수) + `ΔV1`. ΔV1이 건드리지 않은 V1 pair는 복사하지 않고 `INHERITED`+`REQUIRED`로 유효하다고 §7-A ΔV1 절 머리에 명시했다.
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

## [구현자 기입] 설계 리뷰 (r3)

**구현 완료, 독립 검증 대기.** 문제의 원인은 HTTP 요청에 묶인 Auth와 서비스별 bootstrap 주입이었다. POP3 전용 deployment 인자를 제거하고 `bindForPlugin(id)`가 자기 인증 값·revision에 한정된 거부 콜백을 제공하게 했다. HTTP 소비자는 기존 `request()`를 사용한다.

`AuthDefinition`/`AuthMethod`의 실행형 probe를 로그인 후보 검증에 연결했다. 프로토콜과 인증 방법의 처리는 플러그인이 소유하며 Auth core에는 메일 분기를 추가하지 않았다. HTTP presentation은 선택적이지만 `request()` 자체는 HTTP(S)로 제한한다. 실행형 probe 확장에 따른 gate 복원 검증 누락은 ΔV2 규범 정정 후 fail-closed로 보완했다.

DB·앱 경로·소켓은 infra를 사용한다. 도구 작업마다 DB를 열고 `finally`에서 닫으며, 동시 sync Promise만 공유한다. 공통 lifecycle·DI 컨테이너·서비스별 deployment 슬롯은 추가하지 않았다. POP3 USER/PASS만 실행 지원하고 IMAP·앱 비밀번호·XOAUTH2는 타입으로 남겼다. 사용하지 않는 `node-pop3` 의존성을 제거했으며 신규 의존성은 없다.

**보완 패스 (같은 r3, 라운드 증가 아님).** PR #468 외부 리뷰가 지적한 7건을 흡수했다. 그중 CI `gate` red 는 이번 라운드 산출물의 필수 gate라 묻지 않고 고쳤고(impl §0), 나머지 6건은 사용자가 흡수를 지시했다. `preserveGrant` 소실은 실측으로 재현됐다 — `login.ts`의 실행형 probe 분기가 `preserveGrant: false`를 상수로 반환해, HTTP probe가 `authFailureStatuses`로 표현하던 "권한 실패지 자격증명 거부는 아님"을 실행형 선언이 말할 방법이 없었다. 계약(`ExecutableAuthProbe.execute`)에 그 축을 돌려주고 mail 선언이 채운다.

연결 좌표는 대조에서 **파생**으로 바꿨다. `MailPluginOptions`에서 `host`/`port`/`tls`를 제거하고 런타임은 `auth.origin`에서만 `parseMailOrigin`으로 읽는다 — 사본이 하나라 `auth.origin !== mailOrigin(options)` 대조 자체가 필요 없다. 부수로 포트·TLS 기본값 식이 3벌(`auth.ts` origin·session, `sync-manager.ts`)에서 1벌(`resolveMailEndpoint`)로 줄었다.

`MailCredential`/`MailConnection`은 유지하되 **컴파일로 붙잡았다**. ΔV2가 요구한 것은 인터페이스의 존재이지 소비처 0이 아니다 — `app/deployment/mail-extension-cost.test.ts`가 실제 `AuthDefinition`/`AuthMethod` 계약으로 IMAP·XOAUTH2·앱 비밀번호를 조립하고 그 선언을 실제 `createAuthRuntime`에 등록한다.

## [구현자 기입] 강제 지점 전수 (§10 대조, r3)

아래 경로의 `mail/`은 `app/src/main/features/plugins/mail/`, `auth/`는 `app/src/main/features/auth/`다. 테스트 경로는 저장소에서 재현 가능하며 원시 실행 로그는 로컬 `.tmp/pop3-*`에 남겼다.

전수 조사 술어: `withCredential|markExpired|probe.execute|method.probe|definition.probe`, `cleanupExpired|DELETE FROM mail|features/scheduler`, `openFileDatabase|createPop3Socket|destroy|quit|inFlight`, `createPluginBindings|plugin.sync`. 프로덕션 파일과 테스트를 구분해 읽었다. 소켓 음성 가드는 runtime import를 대상으로 하며 `import type { TlsOptions }`는 소켓 생성으로 세지 않는다.

| EP | 확인 지점 | 관측 근거 |
|---|---|---|
| 01 | 4/4 — 검색·첨부·오류·sync 구조화 결과 | integration 내부 경로 변이 3종, pure 오류 변이, manifest 키 단언 |
| 02 | 2/2 — manager 검색·도구 배선 | 소켓이 throw하도록 설정한 검색 입력 6종 모두 정상, lifecycle의 sync 호출 0 |
| 03 | 4/4 — 본문·FTS·파일·삭제 진입점 | store retention 테스트의 행/검색어/파일 단언, `DELETE FROM mail`은 cleanup 한 곳, missing 유지 |
| 04 | 2/2 — tokenizer·질의 길이 | store 한국어 검색과 pure 길이 분기, unicode61 변이 검출 |
| 05 | 3/3 — 초기 sync·change sync·인증 오류 | bootstrap의 두 `plugin.sync()` 경로, binding 회귀, 실제 USER/PASS 거부 |
| 06 | 2/2 — freshness·공유 sync | 299초 미접속/301초 증분, 동시 호출 결과 동일 |
| 07 | 3/3 — 연결·명령·abort 실패 | 비인증 5종 캐시 시각 유지, RETR 취소/예산 초과, persist 직전 취소 |
| 08 | 1/1 — 도구 진입 | 동시 3호출 접속 1회, lifecycle manager 생성 1회 |
| 09 | 2/2 — import 경계·실제 TLS 연결 | native-boundary 및 로컬 TLS 서버 왕복 |
| 10 | 2/2 — bound Auth·mailTools 인자 | HTTP/POP3 동일 deps 타입 조립, 실제 USER/PASS 동일성 |
| 11 | 2/2 — migration 목록·raw 집합 | core/mail CLI 출력, 격리 git fixture의 기존 mail SQL 수정 거부 |
| 12 | 3/3 — 도구별 annotations | `[false,true,false]` 및 sync/search 자리 맞바꿈 검출 |
| 13 | 2/2 — reconcile·보호 판정 | ledger 19/20, 비율 .49/.50의 실제 RETR 호출 차이 |
| 14 | 1/1 — 검색 문서 조립 | From/To/Cc/Subject/Body 각각 누락 변이 5종 검출 |
| 15 | 1/1 — 명령 gate | 허용 명령 실제 송신, DELE 추가 변이 검출 |
| 16 | 3/3 — 명령 거부·분류·revision 콜백 | 거부 후 registry 0, 비인증 5종 registry 1, 이전 revision 거부 무효 |
| 17 | 5/5 — method 선택·candidate commit·resume·문구·gate | plugin-auth 및 기존 login/runtime 회귀, resume/gate/문구 변이 검출 |
| 18 | 1/1 — 첨부 입력 | 두 id 필수 및 각각 optional 변이 검출 |
| 19 | 3/3 — 회복·확인/리셋·ingest | 순수 전이와 실제 반복 sync의 baseline 유지/RETR 재개 |
| 20 | 3/3 — deps·기본 recipe·bootstrap | auth/registry/logger만 선언, 기본 빈 배열, 서비스별 주입 제거 |
| 21 | 3/3 — open 실패·작업 finally·공유 finally | file-database/lifecycle 초기화 실패 close 및 재시도 |
| 22 | 9/9 — 큐·multiline·EOF/error·abort·명령/로그인 timeout·QUIT·TLS·CRLF | pop3-session 40케이스, socket 및 TLS 테스트 |
| 23 | 4/4 — unknown·valid·revision 캡처·만료 인자 | plugin-auth unknown/expired/재인증 경합 및 revision 삭제 변이 |

표 분모는 유효 §10의 23군·65지점이다. 이전 r2의 전역 verifier/reporter와 raw-reader closure 경로는 ΔV2가 대체했으며 현재 전수에 중복 계산하지 않았다.

| Pair | 자기상태 | 이번 실행 증거 |
|---|---|---|
| VP-01·07·18 | SELF_PASS | integration freshness/증분/왕복, pure 5분 경계 |
| VP-02 | SELF_PASS | 비인증 5종 뒤 캐시 유지, throw 소켓의 검색 6입력 |
| VP-03·15 | SELF_PASS | store 14일 경계, 본문/FTS/첨부 정리와 orphan 회수 |
| VP-04·19 | SELF_PASS | 세 첨부 왕복·원본 bytes/mtime 유지·Temp 경로, 파일명 정규화 |
| VP-05·21·27 | SELF_PASS | 실제 인증 거부 후 서버 회수·재인증 복원, 비인증 상태 유지 |
| VP-06·16·17 | SELF_PASS | 한국어 2/3글자 검색, 5필드 정규화, EUC-KR fixture 색인 |
| VP-08·09 | SELF_PASS | RETR/persist 취소·sync 예산, 동시 3호출 공유 |
| VP-10·20·29 | SELF_PASS | 실제 TLS 및 명령 송신, byte 동일성·fragment/coalesce·종결 |
| VP-11·26 | SELF_PASS | HTTP/POP3 동일 deps recipe, password 공백/콜론 보존 왕복 |
| VP-12 | SELF_PASS | migration CLI core/mail 동기화 및 append-only 거부 |
| VP-13·24 | SELF_PASS | descriptor annotations·필수 id, manifest → 첨부 3회 |
| VP-14·25 | SELF_PASS | RETR로 본 보호 경계, fingerprint 변경·확인·회복 |
| VP-22·23 | SELF_PASS | 후보 probe 실패 무저장·문구 구분·method 우선·복원 무접속·gate |
| VP-28·30 | SELF_PASS | DB 수명/재시도, bound credential 및 stale rejection |

자기확인 pair: 30 SELF_PASS. 독립 검증과 사내 서버 실기는 포함하지 않는다.

**보완 패스 증분.** 아래는 이번 보완이 닫은 지점이며 위 분모에 더해 센다.

| EP | 확인 지점 | 관측 근거 |
|---|---|---|
| 17 (증분) | 1/1 — 실행형 probe의 grant 보존 판정 | `plugin-auth.test.ts` resume 3케이스(`preserveGrant:true` → `valid`, `rejected:true` → `expired`, 무설명 실패 → `expired`); threading 삭제 변이 red |
| 21 (증분) | 2/2 — 파일 DB PRAGMA 한 벌 · mail 마이그레이션 적용 기록 | `file-database.test.ts` 3 PRAGMA 단언(`synchronous` 삭제 변이 red) · `store/migrate.test.ts` 기록·재개방 2케이스(`record()` 삭제 변이 red) |
| 신설 — 봉쇄 검사의 parent 정규화 | 2/2 — mail · jira 첨부 export | 전수 술어는 **"realpath 한 자식과 비교되는 parent"**(해법 이름이 아니다): `rg 'ensureDirectory\(null\|ensurePlainDirectory\(null\|inside\(\|samePath\('` → 4사이트. 준수 2(`artifacts/files.ts` `unredirectedDirectory`·`chat/attachment-files.ts` `prepareDirectory`), 위반 2(mail·jira 기본 분기) → 둘 다 `ensureDirectory(null, …)`로 정규화 |
| 신설 — 연결 좌표 단일 사본 | 6/6 — 좌표를 만들거나 읽는 프로덕션 자리 | `rg '\bhost\b|\bport\b|\btls\b' src/main/features/plugins/mail --include=*.ts`(테스트·`tlsOptions` 제외) → authoring 1(`resolveMailEndpoint`) · reading 1(`parseMailOrigin`) · 소비 3(`withMailSession`·`sync-manager`·`store`) · 타입 선언 1. 기본값 식은 1곳뿐 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r3)

아래 각 변이는 원본을 복구한 뒤 다음 변이를 실행했다. `검출`은 대상 테스트 실패 또는 production migration CLI의 명시적 오류를 뜻한다. 타입 오류를 테스트 성공으로 계산하지 않았다.

| 선택 증거 / pair | 심은 결함 | 관측 |
|---|---|---|
| VP-02·21 | 비인증 오류까지 authFailure | integration 실패 |
| VP-03 | cleanup transaction 생략 / FTS 삭제 항목 이탈 / 파일 sweep 생략 | 각각 store 실패 |
| VP-04 | sync·search·attachment 내부 루트 노출 / 오류 원문 노출 / stored_name 노출 | 5종 각각 integration·pure·store 실패 |
| VP-05 | auth_failed를 일반 오류로 축소 / 검색 도구만 남기는 부분 gating | 각각 session·binding/integration 실패 |
| VP-06 | trigram → unicode61 | store 실패 |
| VP-08 | 실패 시 lastSyncAt 갱신 | integration 실패 |
| VP-09 | 공유 Promise 조건 제거 | lifecycle 실패 |
| VP-10 | 소켓 생성 no-op | socket/TLS 실패 |
| VP-12 | 이미 커밋된 mail migration 수정 | 격리 fixture baseline exit 0 → 변이 exit 1 |
| VP-13 | sync/search의 readOnlyHint 맞바꿈 | tools 실패 |
| VP-14 | 임계 부호 반전 / 표본 조건 제거 / missing 본문 삭제 | 3종 각각 pure·store/integration 실패 |
| VP-17 | 검색 5필드 각각 빈 값 | 5종 각각 pure 실패 |
| VP-20 | whitelist에 DELE 추가 | native-boundary 실패 |
| VP-21·27 | rejection callback no-op | plugin-auth/integration 실패 |
| VP-22·27 | probe 결과 무시 / 거부와 도달 실패 문구 맞바꿈 | 각각 plugin-auth 실패 |
| VP-23 | resume 조건 제거 / gate 선택 조건 제거 | 각각 plugin-auth·gate 실패 |
| VP-24 | manifest 생략 / mailId optional / attachmentId optional | 3종 각각 store/integration·tools 실패 |
| VP-25 | 확인 횟수 1 / fingerprint 비교 제거 | 각각 pure/integration 실패 |
| VP-28 | manager close 제거 / DB initialize 실패 close 제거 | 각각 lifecycle·file-database 실패 |
| VP-29 | 대기자 없는 수신 buffer 폐기 | session 실패 |
| VP-30 | observed revision 인자 제거 | plugin-auth 실패 |

검산 단위는 위 표의 증거군이다: 선택 증거 **21행** · 별도 인용 변이 **0행** · 선택 증거와 겹치지 않는 새 oracle **0행** = **21행**. 직접 oracle인 나머지 pair는 별도 변이를 요구하지 않는다. 추가로 TLS 연결을 TCP로 바꾸는 변이도 socket 테스트가 검출했다.

처음에는 resume 테스트가 이미 검증된 runtime을 재사용했고, 표본 경계가 구현 상수를 같이 읽었으며, 경로 테스트가 Windows JSON escaping을 반영하지 않아 해당 변이를 놓쳤다. 각각 새 runtime 복원·리터럴 경계값·직렬화된 경로 비교로 고쳤고 동일 변이가 실패함을 재측정했다. 이 중간 결과를 최종 검출 결과와 구분한다.

**보완 패스 잠금.** 각 변이는 원본 복구 후 다음 변이를 실행했다.

| 대상 claim | 심은 결함 | 관측 |
|---|---|---|
| 새 oracle — `attachment-export.test.ts` | 기본 root 정규화 되돌림 | 별칭 root 케이스 red, 명시 root 케이스는 green(원래 정규화돼 있었다 — 정직한 읽기) |
| 새 oracle — `plugin-auth.test.ts` preserveGrant | `preserveGrant` threading 제거 | 보존 케이스 red, 만료 2케이스 green |
| 새 oracle — `mail-extension-cost.test.ts` 0건 스윕 | 기존 core 파일에 `pop3` 주석 / **새 core 파일** 생성 | 각각 red — 대상 집합을 디렉토리에서 읽으므로 나중에 생긴 파일도 분모에 든다 |
| 새 oracle — `mail-extension-cost.test.ts` 컴파일 fixture | `MailCredential`·`MailConnection` 삭제 | `typecheck` TS2305 2건 |
| 새 oracle — `file-database.test.ts` PRAGMA | `synchronous = NORMAL` 삭제 | red (`expected 2 to be 1`) |
| 새 oracle — `store/migrate.test.ts` | `record(migration.name)` 삭제 | red |

검산: 선택 증거 **0행**(ΔV2가 이번 보완에 등록한 적대 증거 없음) · 인용 변이 **0행**(닫은 파생 이슈 없음) · 새 oracle **6행** = 표 **6행**.

**덮개 회귀 점검.** 제거한 장치는 `mailTools`의 `auth.origin !== mailOrigin(options)` throw 하나다. 그것이 red로 만들던 변이(선언과 옵션의 좌표 불일치)는 이제 **표현 불가능**하다 — 옵션에 좌표 필드가 없어 타입이 거부한다. 그 장치가 덮던 나머지 축(형식이 깨진 origin)은 `endpoint.test.ts`의 거부 8케이스가 받는다. 다만 이 장치에는 이전 verify가 관측한 red 기록이 없다(해당 throw를 단언한 테스트가 0건이었다 — `rg 'endpoint mismatch' --include=*.test.ts` → 0).

## [구현자 기입] Product/UX 파생 검토 (r3)

연결 실패는 기존 입력 폼으로 돌아가고 자격증명을 저장하지 않는다. 거부와 네트워크 도달 실패의 문구를 구분한다. 기존 grant가 있으면 실패한 후보가 덮어쓰지 않는다. 실제 인증 거부는 세 도구를 함께 회수하고 재인증하면 복원한다.

비인증 오류는 캐시 검색과 `stale/cacheAsOf`를 유지한다. 검색만으로 동기화·정리를 시작하지 않는다. 첨부는 검색 매니페스트의 id로 건별 반환하며 내부 원본은 유지한다. 이번 변경에 신규 화면·IPC·미지원 인증 선택지는 없다.

**보완 패스.** 사용자가 관측하는 것이 달라지는 지점은 하나다 — 실행형 probe가 `preserveGrant`를 돌려주면 **부팅 복원에서 연결이 살아남는다**. 이전에는 서버 점검·권한 부족·도달 실패가 전부 저장된 연결을 만료시켜 사용자가 다시 로그인해야 했다. Part I 상태 전이표의 "복원 실패 → 만료" 행은 이제 *자격증명 거부로 관측된 경우*로 좁혀진다. mail 선언은 POP3의 `-ERR`만 거부로 세므로 이 완화를 바로 받는다.

기본값을 바꾸지 않았다 — `preserveGrant`를 생략한 선언은 기존대로 만료한다. 새 화면·IPC·미지원 인증 선택지는 이번에도 없다. 첨부 export 실패가 `unsafe attachment directory`로 보이던 Windows 경로는 사라졌다(사용자에게는 "첨부를 저장할 수 없습니다"로만 보이던 자리다).

## [구현자 기입] 놓친 잠재 문제 + 대응 (r3)

| 발견 | 대응 / 상태 |
|---|---|
| 대량 UIDL 소실에서 확인 전 ledger를 missing으로 바꾸면 다음 비교 기준이 사라짐 | ingest 허용 후에만 markMissing, 서로 다른 fingerprint 2회 뒤 같은 fingerprint 확인으로 재현·수정 |
| RETR 바이트/남은 줄 소실 및 idle socket 오류 후 추가 write | byte 큐 유지, 실패 상태 확인, abort 구독 정리; 실제 stream 테스트로 수정 |
| MIME 파싱 뒤 persist 직전 취소가 protocol_failed로 보임 | 최종 오류 경계에서 취소·예산 우선 분류, 메시지/파일 0·socket 종료 재현 |
| SQLite 초기화·파일 write 실패와 Windows 계정 경로 별칭 | 초기화 실패 close, 생성 부분 파일 회수, 단일 경로 segment 및 기존 account 소유 확인 |
| 실제 사내 TLS/프록시/인코딩·초기 10,000통 성능 | 미실행. 테스트 CA의 로컬 TLS와 EUC-KR bytes fixture를 실제 사내 환경 검증으로 간주하지 않음 |

설계 메커니즘 차이: 별도 search 파일 대신 manager의 순수 DB 조회를 사용한다. 작업별 DB 개방의 만료 축은 기존 영속 `lastSyncAt`, 공유 축은 도구의 sync Promise, 재진입 축은 Promise finally 초기화, 다른 무효화 축은 인증 revision으로 각각 확인했다. DB를 전역 캐시하지 않아 dispose 계약을 추가할 필요가 없다. plan의 제품 동작을 바꾸는 미해결 PLAN_GAP은 없다.

**보완 패스에서 새로 발견한 것.**

| 발견 | 대응 / 상태 |
|---|---|
| `mailOrigin`이 `user:pw@host` 입력을 **우연히** 거부했다 — IPv6 bracket 안에서 URL 생성이 깨져 `Invalid URL`이 난다. 거부는 맞지만 문구가 갈려 호출자가 한 가지로 잡지 못한다 | `parseUrl` 헬퍼로 문구를 `invalid mail endpoint`로 통일. `endpoint.test.ts`가 authoring·parsing 양쪽에서 단언 |
| mail 마이그레이션의 "한 번만 적용" 불변식에 **oracle이 없었다**. `record()`를 지워도 전 스위트가 green이었다 — 현재 SQL 9건이 전부 `IF NOT EXISTS`라 증상이 가려진다 | 지금은 무해하지만 멱등하지 않은 `0002_mail`이 들어오면 손상이 된다. `store/migrate.test.ts`로 기록·재개방을 단언하고 변이 red를 확인 |
| jira 첨부 저장소가 mail과 **같은 결함**을 갖고 있었다(기본 root 미정규화) | 같은 불변식이므로 함께 닫았다. 지적은 mail만 가리켰다 |
| `mail-extension-cost.test.ts`가 vitest green이면서 `typecheck` red였다(`OAuthStart.exchange` 누락) | 타입 오류를 테스트 성공으로 세지 않는다 — `exchange`를 채우고 typecheck exit 0 재확인 |

### 설계 대비 명시적 차이 (r3 보완)

**차이 1 — `mailTools`의 좌표 획득을 대조에서 파생으로 바꿨다.** ΔV2 §구현 지침은 "공개 `mailTools(auth, options)`"만 정하고 좌표 출처를 정하지 않았으므로 AC 대체가 아니다. 대체물(`parseMailOrigin`)이 갖고 원본(대조)이 갖지 않던 실패 모드를 축마다 재유도했다 — **만료**: 좌표에 수명이 없어 해당 없음(origin은 선언 상수다). **공유**: `auth.origin`을 mail과 Auth core가 함께 읽지만 core는 origin을 쓰기만 하고 비우지 않는다 — `registry.isBareOrigin`이 등록 시 형태를 강제하고, `endpoint.test.ts`가 그 형태를 다시 단언한다. **재진입**: `mailSessionConfig`는 `mailTools` 조립 시 1회만 부르고 이후 불변 값이다 — 도구 호출마다 재파싱하지 않는다. **다른 무효화 축**: 사용자가 재인증해도 origin은 선언에서 오므로 바뀌지 않는다(자격증명만 바뀐다) — AC21·AC38을 `mail.integration.test.ts` 22케이스로 재확인했다.

**차이 2 — `preserveGrant`를 선언 옵트인으로 뒀다**(`!rejected`에서 자동 유도하지 않았다). 자동 유도는 HTTP 경로의 기존 계약(전송 실패는 만료)과 갈린다. D-049의 "선언 소유 probe"와 HTTP의 `authFailureStatuses`가 같은 축이므로 같은 모양으로 맞췄다. 생략 시 기본이 기존 동작이라 다른 선언의 행동은 바뀌지 않는다.

## [구현자 기입] 구현 보고 (r3)

| 항목 | 관측 |
|---|---|
| 작성/구현 주체 | Codex — 사용자 명시 지시 |
| 구현 좌표 | `(r3 구현 — 좌표는 INDEX)` |
| 전체 회귀 | Vitest 547파일·5,052 pass, 1파일·1케이스 skip; scripts 120 pass |
| 최종 변경 회귀 | auth/gate/deployment/mail/infra 27파일·418 pass; 마지막 테스트 보완 뒤 2파일·24 pass |
| lint | 0 error, 기존 React Compiler/TanStack warning 1 |
| typecheck | node/web/test 3구성 통과. 추가 테스트 union 접근 오류 1건 수정 후 test 재실행 exit 0 |
| migration/doc gate | core 27·mail 1 동기화, append-only 통과; doc 9항목·98채널/prose/links 통과; real-git budget 11스위트 통과 |
| 독립 리뷰 | 첫 리뷰의 persist 취소 분류 지적을 재현·수정했고 재검토 지적 없음. handoff-verify와 별개 |
| 한계 | Electron 설치본 UI·사내 POP3 서버 실기·10,000통 초기 수집 성능 미실행 |

AC 자기보고는 아래 관측을 기준으로 한다. 이전 r2는 35개, ΔV2는 AC34~38 추가로 40개다.

| AC | 상태 | 직접 근거 |
|---|---|---|
| 1·2·3 | ✅ | 299초/301초 및 기존 UIDL RETR 제외 |
| 4·6 | ✅ | 무캐시·sync 없이 6입력 검색, 소켓 0·stale true |
| 5·28b | ✅ | 비인증 5종 캐시 시각·valid·registry 유지 |
| 7·8·9 | ✅ | sync 후 만료 정리 3저장소, 검색만 하면 만료 행 유지 |
| 10·11·12 | ✅ | 매니페스트 및 세 첨부 Temp 반환·원본 bytes/mtime 동일 |
| 13 | ✅ | 6종 안전 오류 메시지, 원문 노출 변이 검출 |
| 14·15 | ✅ | 미인증 registry 0, toolNames 3 유지 |
| 16·17 | ✅ | 한국어 중간어와 EUC-KR 색인 검색 |
| 18·19 | ✅ | core migration 불변, mail append-only 변이 CLI 거부 |
| 20·21 | ✅ | 실제 로컬 TLS, 공통 deps로 bound Auth 서버 조립 |
| 22·23 | ✅ | annotations 자리 맞바꿈 검출, 동시 sync 1회 |
| 24 | ✅ | RETR/persist 취소 무부분 메시지, context 없는 세 handler 왕복 |
| 25·25b·33 | ✅ | 보호 5경계 RETR 차이, 일반 소실 보관, fingerprint 전이 |
| 26·27·28 | ✅ | whitelist 송신·미probe 첫 sync 오류·현재 거부 전체 회수 |
| 29·30 | ✅ | 후보 실패 무저장·문구 구분, HTTP 회귀·POP3 복원 무접속 |
| 31·32 | ✅ | 첨부 id 3건 왕복, 두 id 필수 |
| 34·35 | ✅ | stale revision 거부 무효, byte stream/종결 |
| 36·37·38 | ✅ | 작업 자원 close/재시도, TLS/명령 가드, USER/PASS 공통 경로 |

검산: ✅ **40** · ⚠️ **0** · ❌ **0** = 총 **40**. 이는 기계 검증의 자기보고이며 위에 명시한 환경 실기는 별도 대기다.

### 보완 패스 게이트 — 관측한 산출

| 항목 | 관측 |
|---|---|
| lint | `0 error, 1 warning` — warning은 기존 React Compiler/TanStack(`useTranscriptVirtualizer.ts:22`) 기준선 |
| typecheck | exit 0, node/web/test 3구성 |
| 변경 영역 회귀 | `plugins`·`auth`·`app/deployment`·`infra/net`·`infra/db` **55파일 733 pass** |
| 전체 회귀 | **543파일 pass · 8파일 fail · 1 skip (552)** / **5,054 tests pass · 3 skip** |
| 전체 회귀의 8 fail | **환경 기인, 변경 무관.** 서명 `Electron failed to install correctly` (`node_modules/electron/index.js:17`) — `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 로 설치한 환경이다. **동일 8파일이 stash 한 원본 트리에서도 같은 서명으로 실패**함을 재측정했다(`Test Files 8 failed (8) · Tests no tests`). CI(windows-latest)는 egress가 열려 이 8파일이 통과한다 |
| scripts | `# pass 120 · # fail 0` (16 suites) |
| migration gate | `sync ok: infra/db 27 · mail 1` · `no-copies ok: scanned 1273 source files, 3 list owners` · `append-only ok since v0.3.1` |
| doc inventory | `generated doc ok (9 items, 98 channels)` · `prose ok` · `links ok: every relative markdown link resolves` |
| CI 기준선 | 흡수 전 PR #469 `gate` = **failure** (`mail.integration.test.ts:393` `TypeError: Cannot read properties of undefined (reading 'startsWith')`, 547 passed / 1 failed). 근본 원인은 아래 |
| 근본 원인 재현 | `prepareTemporaryFilesPath` mock이 `mkdtemp` 원본을 돌려주는데 Windows 러너의 `os.tmpdir()`은 `C:\Users\RUNNER~1\...` 8.3 별칭이다. `realpath` 한 자식과 비정규 parent를 `relative()`로 비교하면 `../../...`가 나와 `inside()`가 false → `unsafe attachment directory` throw → handler가 `errorResult`를 돌려주어 `savedPath`가 `undefined`. Linux에서 symlink 조상으로 같은 조건을 만들어 `inside() => false`를 실측 |
| 한계 | 변동 없음 — Electron 설치본 UI · 사내 POP3 서버 실기 · 10,000통 초기 수집 성능 미실행. 추가로 이 환경에서는 electron 의존 8파일이 미실행이다 |

AC 자기보고 **40/40 유지**. 보완 패스는 AC를 추가하거나 분할하지 않았다 — 검산: ✅ **40** · ⚠️ **0** · ❌ **0** = 총 **40**. 아래는 보완이 근거를 바꾼 행만 다시 적는다.

| AC | 상태 | 이번 패스의 직접 근거 |
|---|---|---|
| 10·11·12 | ✅ | 첨부 export 3건 왕복이 Windows 8.3 별칭 조건에서도 성립(`attachment-export.test.ts` 2케이스 + 정규화 되돌림 변이 red) |
| 20·21 | ✅ | 좌표 단일 사본 — `endpoint.test.ts` 왕복 5입력 · 거부 8입력, `mail.integration.test.ts` 22케이스 |
| 29·30 | ✅ | 실행형 probe의 거부/도달 실패 분기에 grant 보존 축 추가(`plugin-auth.test.ts` resume 3케이스) |
| 36 | ✅ | 파일 DB PRAGMA 한 벌 공유 + 마이그레이션 적용 기록(`file-database.test.ts` · `store/migrate.test.ts`) |
| 38 | ✅ | IMAP·XOAUTH2·앱 비밀번호가 core 변경 0으로 조립·등록됨(`mail-extension-cost.test.ts` 2케이스, core 프로토콜 이름 0건) |

## [구현자 기입] Review Signals — 사실만 (r3)

- 현재 라운드 r3. r2의 미실행 통합 경로를 실제 Auth → Plugin → POP3/SQLite 왕복으로 연결했다.
- gate probe의 복원 가능성은 기존 접근 정책과 관련 있어 구현 전에 ΔV2 규범을 별도 정정했다.
- 원래 규범이 요구한 byte 보존·취소·보호 baseline 및 선택 변이 감도가 이번 구현에서 결함을 드러냈다. 수정 후 해당 사례를 재실행했다.
- Windows JSON 경로 escaping과 Python 로그 decoding이 실행 환경 차이였다. 로그 디코딩 실패는 UTF-8을 명시해 재실행했으며 기능 실패로 집계하지 않았다.
- 독립 검증자는 이 보고를 증거 대신 사용하지 않고 유효 V와 사내 실기 대기 항목을 다시 판정한다.

**보완 패스 신호.**

- 현재 라운드 수 **3 유지**(사용자 지시: 라운드 증가가 아닌 보완). 다음 주체는 검증자다.
- 이번에 닫은 불변식 중 **"봉쇄 검사의 parent는 스스로 정규화한다"**는 이전 라운드와 다른 축이다. 지적은 mail 한 지점만 가리켰고 전수에서 jira의 같은 결함이 나왔다 — 리뷰가 본 표면과 불변식의 외연이 갈린 사례다(impl §5).
- **막았어야 할 지침이 있었다.** ΔV2 EP-21이 "작업 범위 자원 정리"를 요구했지만 *열기* 경로의 경로 정규화는 분모에 없었다. r3 자기보고는 EP-21을 `3/3`으로 적었고 그 셋은 전부 *닫기* 지점이었다 — 분모가 열기 쪽을 포함하지 않아 `N/N`이 이 결함을 볼 수 없었다.
- **mail 마이그레이션 기록에는 oracle이 아예 없었다.** 전 스위트가 green인 채로 `record()`를 지울 수 있었다. 현재 SQL이 전부 `IF NOT EXISTS`라 증상이 가려진 것이고, r3 자기보고의 EP-11 `2/2`는 *목록 동기화*와 *append-only*를 셌지 *적용 기록*을 세지 않았다.
- 반복해서 부딪히는 환경 한계: (a) `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 설치라 electron 의존 8파일 미실행, (b) better-sqlite3 ABI를 `npm rebuild`로 Node 쪽에 맞춰야 DB 스위트가 돈다. 둘 다 `app/AGENTS.md §제약 환경 게이트 가이드`의 알려진 서명이다.
- 외부 PR 리뷰는 verify가 아니다 — 이 보고는 구현자 자기확인이며 독립 검증자가 유효 V와 사내 실기 대기 항목을 다시 판정한다.

## [검증자 기입] 파생 이슈

> r3 검증 = **FAIL**. 판정 원문은 [`verify.md`](verify.md) — 여기 표는 이관 목록이다.
> 닫힘은 대응 방향의 수행이 아니라 `출처` 계약의 성립이다.

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | AC20 음성 스윕이 어떤 파일도 매치할 수 없다 — `scanOffenders` 가 술어 적용 전에 문자열 리터럴을 비워 `/from ['\"]node:(net|tls)['\"]/` 가 항상 0건이다 | VP-10 / EP-09 1번 지점 / AC20 | 술어를 원문에 적용하거나 `import type` 예외를 명시한다. 허용목록 밖 프로덕션 파일에 런타임 `node:net` import 를 심은 변이가 red 여야 한다 | **BLOCKING** | closed (r4 자기확인 — 실제 net/tls import 변이 red) |
| D2 | `retention.ts::isExpired` 프로덕션 호출 0 — `store.cleanupExpired` SQL 이 14일 규칙을 재구현한다 | VP-15 선언 경로 / EP-03 SSOT 칸 | 배선하거나 §11·EP-03 의 SSOT 표기를 `store` 로 정정한다 | NON_BLOCKING | closed (r4 자기확인 — SQL SSOT 정정·경계 단언) |
| D3 | 검색 결과 투영의 형제 슬롯 맞바꿈(`from_addr`↔`to_addrs`)을 아무 테스트도 잡지 않는다 | 비귀속 — §1 "발신자·날짜·제목·발췌로 답한다" | hit 의 `from`·`to`·`subject` 값을 단언하는 케이스 1건 | NON_BLOCKING | closed (r4 자기확인 — projection 3분기 맞바꿈 red) |
| D4 | cleanup 의 `headerDate` 우선(D-017)에 잠금이 없다 — fixture 가 `headerDate`·`firstSeenAt` 를 같은 값으로 묶는다 | D-017 / AC7 의 기술된 oracle | `headerDate ≠ firstSeenAt` fixture 1건 | NON_BLOCKING | closed (r4 자기확인 — header 우선 변이 red) |
| D5 | EP-25 의 jira 지점에 oracle 이 없다 — 되돌림 변이가 green | EP-25 2번 지점 | jira 첨부 store 에 별칭 root 케이스 추가 | NON_BLOCKING | closed (r4 자기확인 — Jira 기본·명시 root 되돌림 red) |
| D6 | 매니페스트 총량 상한 미구현 — 최악 500항목 ≈167 KB vs §14 의 ≈17 KB | plan §14 출력 상한 | 결과 전체 합산 50항목에서 절단하고 `attachmentsTruncated` 로 알린다 | NON_BLOCKING | closed (r4 자기확인 — 총량 50·truncated 단언) |
| D7 | 죽은 export 2건 — `MAIL_TOOL_NAMES`(참조 0) · `createMailPlugin`(코드 참조 0) | 비귀속 | 제거하거나 소비처를 만든다 | NON_BLOCKING | closed (r4 자기확인 — 참조 0 export 제거) |
| D8 | D-023 이 ACTIVE 로 `node-pop3` 를 지시하나 의존성이 제거됐다 | Decision Ledger | 설계자가 해당 절반을 SUPERSEDED 로 표기한다 | NON_BLOCKING | closed (r4 자기확인 — D-023 POP3 절반 SUPERSEDED) |
| D9 | §15 의 `MailPluginOptions` 가 `host` 를 포함 — D-057 이후의 `types.ts` 와 갈린다 | plan §15 | 설계자가 §15 형상을 갱신한다 | NON_BLOCKING | closed (r4 자기확인 — §15 좌표 제거) |
| D10 | `manager.search()` 가 같은 질의를 2회 실행하고 `total` 이 `limit` 으로 잘린다 | 비귀속 | 1회 실행 후 재사용하고 `total` 의미를 확정한다 | NON_BLOCKING | closed (r4 자기확인 — 조회 1회·기존 반환 건수 유지) |
| D11 | 메타의 기준 V 좌표 `e252c6b` 가 실재하지 않는다 — 실제는 `e3ea535` | plan 메타 | 설계자가 좌표를 정정한다 | NON_BLOCKING | closed (r4 자기확인 — 실재 기준 좌표 정정) |

## [구현자 기입] 설계 리뷰 (r4)

- **동의 / 그대로 진행:** 사용자 지시에 따라 Codex가 원격 verify를 rebase로 동기화하고 r4 설계·구현을 수행했다. auth만으로 서버를 조립하고 DB·소켓을 infra에서 사용하는 ΔV2 책임 분리는 유지한다.
- **이견 / 현실성 문제:** r3의 AC20 자기보고는 틀렸다. 문자열을 제거한 뒤 import 문자열을 찾는 음성 검사는 금지 import에도 0건이었다. 실제 production 파일에 결함을 심어 원인을 재현했다.
- **ACTIVE Decision과 충돌:** D-023의 POP3 의존성 절반, §15 옵션 사본, MD-02/EP-03의 미사용 retention 소유 표기를 설계 역할에서 먼저 정정하고 별도 설계 커밋으로 분리했다. D-017의 날짜 우선순위·공개 계약은 유지한다.
- **handoff-review:** r4 진입 전 지침 자체는 DIAGNOSE_ONLY로 진단했다. 사용자 요청은 FAIL 구현 보완이며 지침 개편 요청은 아니다. 원인은 B(명시된 적대 검사를 수행하지 않음)·F(검사 코드의 결함)이다. impl §2·3·8에 충분한 규칙이 있어 중복 규칙·corpus·별도 review 자료는 추가하지 않았다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인 (r4)

r4의 직접 변경 범위는 §3 r4 정정의 VP-10 REQUIRED, VP-03·04·15·19·24 REGRESSION과 EP-25다. 다른 pair의 계약·등록 변이는 변경하지 않았으며 r3 독립 판정을 승계한다. 전체 스위트 실행과 이번 턴에 다시 심은 변이는 구분한다.

| Pair / 계약 | §10 지점 | 닫은 지점 | 재현 명령 / 직접 관측 | 남긴 곳 |
|---|---|---|---|---|
| VP-10 / EP-09 | 금지 runtime import·실제 TLS 연결 | 2/2 | `native-boundary.test.ts`: main 전수 차집합 `[]`, freshness에 net/tls import를 각각 삽입하면 파일명이 offender로 나타남. `pop3-tls.test.ts`: 실제 서버 왕복·전송 no-op 검출 | — |
| VP-03·15 / EP-03 | 본문·FTS·첨부 정리·단일 만료 진입점 | 4/4 | `rg 'cleanupExpired|DELETE FROM mail|DELETE FROM mail_fts' .../mail -g '*.ts' -g '!*.test.ts'`: 삭제는 store, 호출은 sync 1곳. store 테스트에서 세 저장소 잔여와 날짜 경계 단언 | — |
| VP-04·19·24 / EP-01 | 검색·첨부·오류·structuredContent | 4/4 | integration의 공개 결과에 내부 root 부재, 첨부 3건 id 왕복·원본 유지. 검색 매니페스트 실제 총량 `[10,10,10,10,10,0,0]`, 실제 개수 12와 절단 표시 유지 | — |
| VP-24 / EP-18 | 두 id 필수 스키마 | 1/1 | `tools.test.ts`: mailId만/attachmentId만 거부, 둘 다 입력은 허용 | — |
| EP-25 | mail·Jira 부모 경로 정규화 | 2/2 | mail 기본·명시 root, Jira 기본·명시 root 별칭 테스트. Jira 반환 경로는 canonical 부모 아래이고 파일 bytes `[1,2]` 일치 | — |

검색 projection은 MATCH·LIKE·빈 질의 **3/3**에서 서로 다른 sender/recipient/subject를 단언했다. 보존 규칙은 header 우선·null fallback·cutoff 전/동일/후를 실제 SQLite에서 확인했다. `rg 'MAIL_TOOL_NAMES|createMailPlugin|isExpired' .../mail -g '*.ts'`의 잔여는 0건이다. 삭제한 함수와 export는 호출을 만드는 대신 제거했다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 적대 증거 |
|---|---|---|---|---|
| VP-10 | REQUIRED | SELF_PASS | 음성 검사와 실제 TLS 서버 양성 검사 | 금지 import 2종·전송 제거 red |
| VP-03·15 | REGRESSION | SELF_PASS | 만료 2건 삭제·4건 보존, ledger 6건 유지; 기존 세 저장소 정리 | DB·FTS·파일 정리 제거, 날짜 우선/비교 변경 red |
| VP-04·19 | REGRESSION | SELF_PASS | 공개 경로·파일명·원본 보존·매니페스트 예산 | 내부 경로 4종·stored_name·총량/표시 변경 red |
| VP-24 | REGRESSION | SELF_PASS | 검색 id로 첨부 3건 왕복, id 입력 스키마 | producer 삭제·두 id optional 변경 red |

r4 직접 판정은 **SELF_PASS 6 / SELF_BLOCKED 0**이다. 비영향 VP-01·02·05~09·11~14·16~18·20~23·25~30의 등록 변이를 이번 턴에 전부 다시 실행했다고 주장하지 않는다. 이 24 pair는 r3 verify 판정과 아래 전체 회귀를 근거로 보존하며 새 SELF_PASS 수에 합산하지 않는다. §10에 없는 신규 계약 지점 및 미해결 PLAN_GAP은 없다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r4)

| 심은 결함 | 출처 | 이전 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| freshness.ts에 node:net runtime import | 인용 D1 | green | `features/plugins/mail/pop3/native-boundary.test.ts` / 1 | red·잠김 |
| freshness.ts에 node:tls runtime import | 새 oracle | 최초 | `features/plugins/mail/pop3/native-boundary.test.ts` / 1 | red·잠김 |
| LIKE의 from/to 맞바꿈 | 인용 D3 | green | `features/plugins/mail/store/index.test.ts` / 1 | red·잠김 |
| MATCH의 from/to 맞바꿈 | 인용 D3 | green | `features/plugins/mail/store/index.test.ts` / 1 | red·잠김 |
| 빈 질의의 from/to 맞바꿈 | 인용 D3 | green | `features/plugins/mail/store/index.test.ts` / 1 | red·잠김 |
| cleanup COALESCE를 first_seen_at로 대체 | 인용 D4 | green | `features/plugins/mail/store/index.test.ts` / 1 | red·잠김 |
| cleanup 비교 <를 >로 변경 | 새 oracle | 최초 | `features/plugins/mail/store/index.test.ts` / 3 | red·잠김 |
| Jira parent 정규화 제거 | 인용 D5 | green | `features/plugins/jira/attachment-store.test.ts` / 2 | red·잠김 |
| hit마다 첨부 예산 50으로 재설정 | 새 oracle | 최초 | `features/plugins/mail/store/index.test.ts` / 1 | red·잠김 |
| truncated를 false로 변경 | 새 oracle | 최초 | `features/plugins/mail/store/index.test.ts` / 1 | red·잠김 |
| store.search 중복 호출 복귀 | 새 oracle | 최초 | `app/deployment/mail.integration.test.ts` / 1 | red·잠김 |
| trigram을 unicode61로 변경 | 선택 VP-06 회귀 | red | `features/plugins/mail/store/index.test.ts` / 2 | red·잠김 |
| 검색 attachments를 빈 배열로 대체 | 선택 VP-24 | red | `app/deployment/mail.integration.test.ts` / 3 | red·잠김 |
| 첨부 정리 filter를 false로 변경 | 선택 VP-03 | red | `features/plugins/mail/store/index.test.ts` / 2 | red·잠김 |
| cleanup transaction 실행 제거 | 선택 VP-03 | red | `features/plugins/mail/store/index.test.ts` / 2 | red·잠김 |
| native socket factory를 throw로 대체 | 선택 VP-10 | red | `infra/net/pop3-tls.test.ts` / 1 | red·잠김 |
| mail 삭제 FTS trigger 제거 | 선택 VP-03 | red | `features/plugins/mail/store/index.test.ts` / 1 | red·잠김 |
| sync에 내부 userDataPath 추가 | 선택 VP-04 | red | `app/deployment/mail.integration.test.ts` / 1 | red·잠김 |
| search에 내부 userDataPath 추가 | 선택 VP-04 | red | `app/deployment/mail.integration.test.ts` / 2 | red·잠김 |
| 첨부 savedPath를 내부 경로로 변경 | 선택 VP-04 | red | `app/deployment/mail.integration.test.ts` / 1 | red·잠김 |
| 오류 메시지를 raw exception으로 대체 | 선택 VP-04 | red | `features/plugins/mail/pure.test.ts` / 6 | red·잠김 |
| 매니페스트에 stored_name 추가 | 선택 VP-04 | red | `features/plugins/mail/store/index.test.ts` / 1 | red·잠김 |
| mailId를 optional로 변경 | 선택 VP-24 | red | `features/plugins/mail/tools.test.ts` / 1 | red·잠김 |
| attachmentId를 optional로 변경 | 선택 VP-24 | red | `features/plugins/mail/tools.test.ts` / 1 | red·잠김 |
| mail parent 정규화 제거 | 선택 EP-25 회귀 | red | `features/plugins/mail/attachment-export.test.ts` / 2 | red·잠김 |

분모 검산: 선택 증거 **14** · 인용 변이 **6** · 새 oracle 민감도 **5** = **25행**. 실제 실행 이름 집합과 표의 차집합 0. 같은 검사가 두 범주에 해당하면 위 출처로 한 번만 셌다. VP-06·mail EP-25는 기존 장치의 덮개 회귀 대조이며 신규 pair 판정에 합산하지 않았다.

덮개 회귀: 위 표의 이전 red → 이번 green은 **0건**. 미사용 retention helper 삭제 뒤 실제 SQL 비교 변경을 red로 잡는다. 파일·DB·FTS 정리, 매니페스트와 trigram의 기존 red도 보존했다. 문서 정정·죽은 export 제거는 해당 없음 — 직접 참조 검색 및 타입 검사.

모든 변이는 원본 bytes를 보관하고 한 건씩 실행한 뒤 `finally`에서 복원했다. 임시 스크립트·로그는 OS 임시 디렉터리에만 두었다. 저장소에 별도 round 보고서나 mutation 로그를 추가하지 않았다.

## [구현자 기입] Product/UX 파생 검토 (r4)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태에 소비자가 있는가 | 기존 `attachmentsTruncated`가 해당 hit의 생략을 알리고 `attachmentCount`는 원래 개수를 유지한다 | 전체 예산 소진 뒤 hit도 표시 확인 |
| seam 재배치와 정리 스코프 | production 재배치 없음. 검색 결과 배열은 호출 내부 값이고 DB 수명은 기존 withManager finally가 소유한다 | — |
| 새 실패 경로와 상태 전이 | 신규 실패 경로 없음. 인증 거부·비인증 실패·캐시 검색은 기존 상태 전이 유지 | — |
| 실패가 무반응으로 보이는가 | 기존 오류 결과를 보존한다. 절단은 무표시 누락 없이 flag로 전달한다 | — |
| 늦은 응답이 화면을 되돌리는가 | 비동기 경로 추가 없음. 동기식 store 조회를 한 번으로 줄였다 | — |
| `total` 의미 | 기존의 limit 적용 후 반환 건수를 유지한다. 3건 저장·limit 2에서 total/result length 모두 2, store 조회 1회 | 전체 일치 건수로의 변경은 이번에 하지 않음 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r4)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | basename 허용목록은 다른 디렉터리의 pop3-socket.ts도 면제한다 | ✅ 정확한 상대경로 1곳만 허용 | 같은 이름의 금지 fixture도 offender로 검출 |
| 2 | runtime import와 type-only import를 정규식만으로 혼동할 수 있다 | ✅ 이미 설치된 TypeScript parser를 테스트에서만 사용 | 런타임 로딩 9형식 거부, type-only·주석·문자열 허용 |
| 3 | 매니페스트 전체 예산이 소진되면 뒤 hit의 첨부가 0개일 수 있다 | ✅ 실제 attachmentCount와 truncated 유지 | 7 hit 각각 12개에서 마지막 둘은 배열 0·count 12·flag true |
| 4 | 사용되지 않는 retention 함수가 구현 규칙처럼 보인다 | ✅ 함수·테스트를 제거하고 설계 SSOT를 SQLite cleanup으로 정정 | 호출 0 재확인, 날짜 우선·null·경계값 실제 DB 단언 |

### 설계 대비 명시적 차이 (r4)

r4 설계 정정 이후 제품 계약 차이는 없다. 검사 AST는 테스트 전용이며 런타임 추상화·의존성은 추가하지 않았다.

| 축 | 대체물의 실패 가능성 | 재확인 |
|---|---|---|
| 만료 | SQL을 유일한 규칙으로 두면 날짜 우선순위 실수를 직접 잡아야 함 | AC7·EP-03 실제 SQLite 6입력, 2삭제·4보존 |
| 공유 | 응답 전체 첨부 예산이 서로 다른 hit에 공유됨 | 각 검색 호출의 지역 변수, 합산 50·메일당 10 |
| 재진입 | 이전 호출 예산이 다음 검색에 남을 가능성 | store.search마다 50으로 초기화, 전역 캐시 없음 |
| 다른 무효화 축 | 중복 조회 제거가 두 번의 상태 확인을 줄이는지 | 조회 사이 await·쓰기가 없었음. 상태 조회와 결과 한 번으로 같은 응답 조립 |

## [구현자 기입] 구현 보고 (r4)

| 항목 | 관측 |
|---|---|
| 작성/구현 주체 | Codex — 사용자 명시 지시 |
| 변경 파일 | mail native 경계 테스트·store/manager·죽은 export 정리, mail/Jira 회귀 테스트. handoff 산출은 plan.md·INDEX.md만 |
| 실행 명령 | app에서 `node node_modules/vitest/vitest.mjs run --maxWorkers=4`, `npm run typecheck`, `node node_modules/eslint/bin/eslint.js src scripts --cache`, `node --test scripts/*.test.mjs`, migration/doc-inventory/test-budgets CLI |
| 관측한 게이트 산출 | 전체 **552파일·5,110 pass**, 1파일·1케이스 skip. 변이 복원 후 영향 스위트 **12파일·117 pass**. scripts **120 pass**. typecheck node/web/test 3구성 통과. lint **0 error·기존 warning 1**. migration append-only·doc inventory/prose/links·real-git budget 통과 |
| V-pair 자기확인 | r4 직접 판정 6 SELF_PASS / 0 SELF_BLOCKED. 비영향 24 pair의 r3 독립 판정 보존 |
| 강제 지점 | 이번 영향 범위 EP-09 2/2·EP-03 4/4·EP-01 4/4·EP-18 1/1·EP-25 2/2 |
| 블로커 / 역질문 | 없음. 사내 POP3 서버·설치본 UI·초기 10,000통 성능 실기는 미실행 |
| 대상 커밋 | `(r4 구현 — 좌표는 INDEX)` |

AC 자기보고는 r3 독립 검증의 39개 충족 결과에 AC20의 직접 음성·양성 증거를 보완하고, 현재 전체 회귀에서 아래 동작을 다시 확인한 것이다. 독립 verify의 PASS를 뜻하지 않는다.

| AC | 자기 결과 | 이번 턴의 실행 근거 |
|---|---|---|
| 1·2·3 | ✅ | mail integration의 299/301초 연결 횟수·기존 UIDL RETR 제외 |
| 4·5·6·28b | ✅ | integration 검색 무접속·비인증 5종 캐시/valid/registry 유지 |
| 7·8·9 | ✅ | store/integration header 우선·14일 경계·세 저장소 정리·검색만 할 때 보존 |
| 10·11·12·13 | ✅ | 공개 결과·첨부 3건 원본 보존, pure 오류 6종·경로 노출 변이 red |
| 14·15 | ✅ | tools/binding invalid registry 부재·toolNames 유지 |
| 16·17 | ✅ | store/pure 2·3글자 검색·EUC-KR 색인, tokenizer 변이 red |
| 18·19 | ✅ | migration CLI core/mail 동기화·append-only 및 scripts 테스트 |
| 20 | ✅ | main 실제 금지 import 검출 2종·실제 로컬 TLS 연결·전송 제거 red |
| 21 | ✅ | integration 공통 bound auth 조립·USER/PASS 왕복 |
| 22·23·24 | ✅ | tools annotations, integration single-flight·abort·context 없는 handler |
| 25·25b·33 | ✅ | pure/integration 보호 경계·표본·일반 소실 보존·fingerprint 전이 |
| 26·27·28 | ✅ | POP3 명령/거부 테스트·integration 현재 인증 거부 뒤 서버 회수 |
| 29·30 | ✅ | auth/plugin-auth와 integration 후보 실패 무저장·HTTP·resume 회귀 |
| 31·32 | ✅ | integration 첨부 id 3건 왕복, tools 두 id 필수·optional 변이 red |
| 34·35 | ✅ | plugin-auth revision, infra POP3 bytes/EOF/abort/timeout |
| 36·37·38 | ✅ | DB 초기화/작업 close·재시도, TLS/명령 검증·확장 인터페이스 컴파일 |

검산: 위 행의 AC 집합은 **1~38 + 25b·28b = 40**, 유효 AC 집합과 차집합 0. **✅40 · ⚠️0 · ❌0 = 총40**. 설치본·사내 환경 실기는 이 기계 기준 합계에 포함하지 않았다.


## [구현자 기입] Review Signals — 사실만 (r4)

- 현재 라운드 **r4**. r3의 소켓 경계 음성 검사와 같은 불변식을 다시 열었다. 원인은 문자열 제거로 판단 대상이 사라진 것이다.
- 막았어야 할 지침은 AC20·EP-09와 impl §3의 production 결함 주입이다. TLS 양성 검사만 통과한 사실을 음성 스윕 감도까지 확장해 해석했다. 이번에는 허용 밖 실제 파일을 각각 net/tls import로 바꾸어 offender 경로를 확인했다.
- 지침 진단은 위 설계 리뷰의 B·F 판단으로 종결했다. 새로운 일반 규칙·과거 사례·별도 보고서 파일은 만들지 않았다.
- 현재 환경에서 Electron 의존 파일을 포함한 전체 스위트가 통과했다. r3의 Electron 설치 실패 8파일을 이번 환경의 미실행 사유로 재사용하지 않았다. 설치본 UI·사내 서버·대량 수집 실기는 여전히 별도다.
- 다음 단계는 Claude의 독립 verify다. 이전 verify.md의 FAIL 판정은 이 구현 보고로 덮어쓰지 않는다.


## ΔV3 — 본문 임베드 이미지 제외 (r5)

작성: Codex. 사용자 추가 요구에 따른 설계 증분이다. **사용자 명시 지시로 handoff-review는 실행하지 않는다.** 기존 r4의 구현·검증 기록은 보존한다.

### Decision Ledger / Product & UX Contract

| 결정 | 상태 | 출처·내용 |
|---|---|---|
| D-058 | SUPERSEDED → D-061 | 최초 UIDL 길이 완화 요청은 후속 사용자 지시로 철회됐다 |
| D-061 | ACTIVE | 사용자: "70자 제한은 수정 요청은 무시하라". UIDL parser와 테스트는 기존 코드 그대로 유지한다 |
| D-059 | ACTIVE | 사용자: MIME part 메타데이터로 파일 첨부와 본문 임베드 이미지를 구분한다. image/* 중 related 또는 inline 또는 HTML cid 참조에 해당하는 part는 저장·첨부 개수·매니페스트에서 제외한다. 파일명 유무·확장자로 분류하지 않는다 |
| D-060 | ACTIVE | 구현 범위 해석: 새 수집에 적용한다. 기존 캐시에는 disposition/related/contentId가 없으므로 파일명으로 추측 삭제하지 않는다. 기존 원문 재수집·이관은 별도 사용자 요청이 있을 때 수행한다 |

**분류 근거:** postal-mime의 MIME part 메타데이터를 사용한다. RFC 2387 §4에 따라 related compound에서는 disposition보다 관계 의미를 우선한다: https://www.rfc-editor.org/rfc/rfc2387.html .

**사용자 결과:** mail_sync → UIDL 비교 → RETR → MIME 정규화에서 임베드 이미지 제외 → 본문·실제 파일 첨부만 DB/디스크 저장 → mail_search의 attachmentCount/manifest도 실제 파일만 노출. 모든 첨부가 임베드 이미지면 count 0·배열 []이며 본문 검색은 유지한다. 일반 첨부 image/*, 파일명 없는 일반 첨부, inline 비이미지는 보존한다. CID만 있고 HTML 참조/related/inline이 없는 이미지는 일반 첨부로 보존한다.

실패·취소·재시도·정리 및 auth-only 조립은 기존 계약을 유지한다. POP3 RETR은 메시지 전체를 받으므로 네트워크 다운로드와 MIME 파싱 순간의 메모리까지 없애지는 않는다. 이미지 영속 저장과 모델의 첨부 노출을 줄인다. 신규 설정·플랫폼 계약·의존성·DB 마이그레이션은 없다.

### Technical Design / 코드 근거

- UIDL 길이 완화와 그 추가 테스트는 D-061에 따라 원복했다. 이 증분의 수정 범위에서 제외한다.
- `mail/mime.ts`는 이미 PostalMime.parse → normalizeMail 한 경로다. postal-mime 3.0.0 타입/실제 구현은 Attachment의 mimeType/disposition/related/contentId를 제공한다. 별도 MIME parser나 모델 분류기를 만들지 않는다.
- `mail/normalize.ts`에서 bytes 변환·MailAttachment 생성 전에 image/*와 위 메타데이터를 조합해 필터한다. HTML cid URI는 완전한 ID 단위로 비교하고 percent encoding을 해제한다. 깨진 encoding은 예외 없이 원문으로 비교한다. 관련성 신호를 갖지 않는 일반 첨부는 기존 이름 fallback을 유지한다.
- 기존 store는 정규화된 attachments만 저장하고 그 행으로 count/manifest를 생성한다. 이 경로를 실제 SQLite·파일·공개 검색 결과 테스트로 검증한다. sizeBytes는 수신한 원문 크기이며 필터 후 첨부 합계로 바꾸지 않는다.

### V / Acceptance / §10 강제 지점 증분

기준: V1 + ΔV1 + ΔV2(r4), 이번 ΔV3. 기존 AC 40개와 pair 30개를 유지한다. AC39·VP-31은 D-061로 철회됐으며 활성 기준에 세지 않는다. 새 AC40을 더해 총 41개, 새 pair VP-32·33을 더해 총 32개다. 이번 턴 직접 판정은 아래 REQUIRED 2개이고 기존 mail/infra 회귀 테스트를 함께 실행한다. 비영향 pair에 새 SELF_PASS나 전 변이 재실행을 주장하지 않는다.

| Pair / node | requiredness | 계약·AC | production path / oracle | 선택 적대 증거 |
|---|---|---|---|---|
| VP-32 / R-09 ↔ AT-23 | REQUIRED | AC40: raw MIME에서 임베드 이미지 제외 후 DB·파일·검색 첨부 개수 일치, 실제 첨부는 bytes/id 유지, 본문 유지 | parseMail → store.saveMessage → store.search/findAttachment 및 파일 열거 | 필터 우회 → 실제 저장소 단언 red |
| VP-33 / MD-12 ↔ UT-12 | REQUIRED | MIME 분류는 filename과 독립. related/inline/cid 이미지 제외, 일반 image·비이미지·무파일명 일반 part 유지 | raw MIME fixtures → PostalMime → normalizeMail, 각 결과 filename/mime/bytes 및 본문 단언 | not selected — 분류별 직접 결과 대조 |

| EP | 불변식 / SSOT | 강제 지점 | 실패 의미 |
|---|---|---|---|
| EP-27 / VP-32·33 | 본문 임베드 이미지 영속·모델 노출 제외 / normalizeMail | 정규화 필터 1곳 → store의 파일·첨부 행 → search count/manifest | 무확장자 attachment·서명 이미지가 디스크와 모델 문맥에 계속 남음 |

### 구현·검증 범위와 READY 확인

수정 예정: normalize.ts, MIME/저장소 테스트, 현재 메일 가이드. handoff 산출은 기존 plan.md·INDEX.md만. 테스트 fixture는 app 테스트 코드에 둔다.

게이트: 영향 mail·infra/net·deployment 회귀(실제 DB 포함), typecheck node/web/test, 읽기 전용 lint, 문서 inventory/link·migration·test-budget 검사. 필터 우회 변이 1종은 원복을 보장하며 실행한다. READY: 공개 도구 형상·인증·retention·기존 캐시 계약과 충돌 없음. 운영 서버 원문 없이도 MIME 메타데이터별 실제 파서 결과와 저장 결과를 판정 가능하다.


## [구현자 기입] 설계 리뷰 (r5)

- 동의 / 그대로 진행: 사용자 최종 지시에 따라 MIME 분류만 수행했다. UIDL 코드·테스트는 HEAD와 차이 0이며 D-058은 D-061로 철회했다. handoff-review는 실행하지 않았다.
- 이견 / 현실성 문제: POP3 RETR과 postal-mime 파싱은 전체 메시지를 받는다. 이번 개선은 이미지 파일 영속과 모델 첨부 노출을 줄이며 원문 다운로드 자체는 줄이지 않는다.
- ACTIVE Decision 충돌: 없음. 파일명 없는 part를 일괄 제거하지 않고 image/*와 MIME 관계 신호로 분류한다. 기존 캐시는 메타데이터가 없어 추측 삭제하지 않는다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인 (r5)

| Pair | §10 지점 | 닫은 지점 | 직접 관측 | 남긴 곳 |
|---|---|---|---|---|
| VP-32·33 / EP-27 | 정규화 필터 → 파일·첨부 행 → 검색 count/manifest | 3/3 | parseMail로 실제 raw MIME 파싱 후 store.saveMessage/search/readAttachment. 이미지와 파일 혼합은 2개, 임베드만 있으면 0개; 디스크 파일 개수도 각각 2/0, 일반 첨부 bytes `[1,2,3]` 유지 | 기존 캐시 재분류는 범위 밖 |

`rg 'parseMail\(|saveMessage\(' app/src/main/features/plugins/mail/sync-manager.ts`에서 수집 → 파싱 → 저장 경로를 확인했다. 필터는 normalizeMail 한 곳이고 store/도구에 다른 분류 규칙을 추가하지 않았다. 새 §10 지점은 없다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택 증거 |
|---|---|---|---|---|
| VP-32 | REQUIRED | SELF_PASS | 실제 MIME → SQLite·파일 → 검색 첨부 manifest 및 일반 첨부 read 왕복 | 필터 우회 시 저장소 2케이스 포함 8실패 |
| VP-33 | REQUIRED | SELF_PASS | MIME 분류 12케이스: related/inline/CID 제외, 일반 이미지·비이미지·무파일명 첨부 유지, encoded CID·ID prefix 구별 | not selected — 실제 파서 반환값 직접 단언 |

이번 직접 판정은 **SELF_PASS 2 / SELF_BLOCKED 0**. VP-31·AC39는 사용자 철회로 제외한다. 기존 pair 30개의 과거 판정과 이번 영향 회귀 실행은 신규 pair 판정에 합산하지 않는다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r5)

| 심은 결함 | 출처 | 이전 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| normalizeMail 이미지 필터를 `return true`로 우회 | VP-32 선택 증거 | 최초 | mime.test.ts 분류 6·실제 저장소 2 = 8 | red·잠김 |

검산: 선택 증거 **1** · 인용 변이 **0** · 새 구조적 oracle **0** = **1행**. 직접 분류 대조에는 별도 변이를 추가하지 않았다. 변이 원본은 finally에서 bytes 그대로 복원했다. UIDL 변이는 철회된 범위라 최종 근거에 합산하지 않는다.

덮개 회귀: 기존 EUC-KR bytes·sizeBytes 테스트를 유지하고 재실행했다. 관련 없는 기존 검사 장치는 교체하지 않았다. 신규 MIME 테스트를 처음 작성하면서 빠졌던 기존 EUC-KR 케이스는 diff 대조에서 복원한 뒤 최종 회귀에 포함했다.

## [구현자 기입] Product/UX 파생 검토 (r5)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 문구·상태 소비자가 있는가 | 신규 형상 없음. 기존 attachmentCount/attachments가 실제 파일만 표시 | 모두 제외되면 0/[] |
| 재배치와 정리 스코프 | 재배치 없음. 저장 전에 part를 걸러 기존 store/finally를 그대로 사용 | — |
| 새 실패 경로가 상태표에 있는가 | CID percent decoding 실패는 원문 비교로 접어 MIME 수집을 중단하지 않음 | malformed CID 테스트 |
| 실패가 무반응으로 보이는가 | 정상 수집으로 완료되고 본문은 검색 가능. 기존 오류·stale 경로 불변 | 혼합·임베드 전용 모두 본문 hit 확인 |
| 늦은 응답이 화면을 되돌리는가 | 순수 동기 정규화만 변경, 비동기 상태 추가 없음 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r5)

| 문제 | 대응 | 근거 |
|---|---|---|
| CID prefix만 비교하면 일반 첨부를 잘못 제외함 | URI에서 추출한 전체 ID Set으로 비교 | prefix / prefix-long 구별 |
| related 이미지에 attachment disposition이 붙을 수 있음 | related 신호로 제외, 파일명·disposition attachment는 면제 조건이 아님 | HTML에서 참조하지 않는 related-only part 포함 테스트 |
| 기존 파일에는 MIME 관계 정보가 없음 | 기존 캐시 보존, 신규 수집부터 적용 | DB 저장 필드에 related/disposition/contentId 없음 |

설계 대비 명시적 차이: 없음. 만료는 기존 retention, 공유는 호출 내부 CID Set, 재진입은 normalizeMail마다 새 Set, 인증 등 다른 무효화 축은 변경하지 않았다. 신규 의존성·DB 포맷·플러그인 계약은 추가하지 않았다.

## [구현자 기입] 구현 보고 (r5)

| 항목 | 관측 |
|---|---|
| 주체 / 변경 파일 | Codex. normalize.ts·mime.test.ts·메일 가이드, 필수 handoff plan·INDEX |
| 실행 명령 | app에서 vitest `src/main/features/plugins/mail src/main/infra/net src/main/app/deployment --maxWorkers=3`; npm run typecheck; eslint src scripts --cache; migration/doc-inventory/test-budget CLI |
| 관측한 게이트 산출 | 영향 회귀 **19파일·230 pass**, MIME 15케이스 포함. typecheck node/web/test 3구성 통과. 최종 lint **0 error·기존 warning 1**. migration append-only·doc inventory/prose/links·test-budget 통과. 필터 우회 변이 8실패로 검출·복원 후 회귀 green |
| V / 강제 지점 | 신규 2 SELF_PASS·0 SELF_BLOCKED / EP-27 3/3 |
| AC 자기보고 | AC40 ✅ — 임베드 이미지는 파일·첨부 목록 0, 일반 첨부 2개 bytes 왕복. 기존 40개 기준은 계약 보존·영향 회귀로 승계하며 이번에 전체 스위트를 재실행했다고 주장하지 않음 |
| 합계 | 기존 ✅40 + 신규 ✅1 = **✅41·⚠️0·❌0 / 41**. 철회된 AC39 미포함 |
| 블로커 / 한계 | 없음. 실제 운영 메일 원문 실기·기존 캐시 재분류 미실행 |
| 대상 커밋 | `(r5 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r5)

- r5는 FAIL 재구현이 아니라 사용자 운영 요구의 추가다. 후속 지시로 UIDL 변경은 철회됐다.
- 사용자 명시 지시대로 handoff-review를 실행하지 않았으며 SKILL·AGENTS·corpus를 변경하지 않았다.
- MIME parser가 이미 제공하는 메타데이터를 소모하는 작은 필터로 해결했다. 새 플랫폼 계약은 없다.
- 최초 테스트에서 일반 첨부를 읽을 때 store 반환 메타데이터를 bytes로 오인한 단언을 고쳤다. 실제 readAttachment 결과를 검증한다.
- 최종 구현의 독립 verify는 다음 주체에게 남긴다. 임시 로그·스크립트는 OS 임시 경로에만 둔다.
