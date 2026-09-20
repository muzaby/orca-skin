# Verify — 0237-pop3-mail-search-plugin

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 문장 규칙은 [`§산출물 문장 규칙`](../AGENTS.md) — 판정 먼저, 주장 한 줄에 관측 하나, 표 한 칸 3줄.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0237-pop3-mail-search-plugin` |
| 검증자 | Claude Code |
| 일자 | 2026-09-20 |
| 대상 커밋/range | `dc2af38^..6522bdc` (r2 `dc2af38`·`059ae04` / ΔV2 설계 `c8eb202`·`5f73fd6` / r3 `5689650` / ΔV2 본문 `20a2188` / r3 보완 `6522bdc`) |
| 구현 전 plan 기준 | `20a2188` (ΔV2 규범 확정 — 보완 패스 코드 `6522bdc` 직전) |
| V mode / 유효 V | `Delta V` / `V1 + ΔV1 + ΔV2` |
| 검증 기준 plan revision | `20a2188:ΔV2` |
| 라운드 | r3 검증 (1회차 verify 턴) |
| 상태 | **FAIL** — root `PAIR_FAIL: VP-10` |
| 자기 검증 여부 | **부분적으로 동일 에이전트** — r3 본구현은 Codex(`5689650`), 보완 패스는 Claude(`6522bdc`). §4에 구현 보고가 이름을 대지 않은 적대 축 6건을 별도로 넣었다 |

---

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: **예, 그러나 규범 행은 아니다.** `6522bdc`의 plan.md diff 240줄은 전부 `[구현자 기입] (r3)` 절이다(`git show 6522bdc -- plan.md | grep '^+' | grep '^+#'` → 9개 heading 전부 `[구현자 기입]`).
- **기준선이 diff로 성립하는가**: **예.** 규범 증분(D-056·D-057·EP-17증분·EP-24·EP-25)은 설계 커밋 `20a2188`(`Agent: claude` · `Status: designed`)이 단독으로 넣었고, 코드 커밋 `6522bdc`는 규범을 건드리지 않았다.
- Decision Ledger 변경: 설계 커밋에서만. `20a2188`이 D-056·D-057 2건 추가, 기존 ACTIVE 행 삭제 0건.
- Product/UX Contract 변경: 없음. `20a2188`이 §5 상태 전이표를 손대지 않았다.
- AC 변경: 없음(보완 패스). ΔV2가 이미 AC21·29·30 경로를 대체하고 AC34~38을 추가한 상태가 `c8eb202`(구현 전)에 확정돼 있었다.
- V node/pair·requiredness·§10·oracle 변경: `20a2188`이 EP-17 증분·EP-24·EP-25 3행 추가. pair 신설 0.
- 채점에 사용할 원 기준: `20a2188` 시점의 §3·§7·§7-A·§10 — 즉 현재 `plan.md`의 규범부와 동일하다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | **유효** | `V1`(Baseline) + `ΔV1` + `ΔV2` 순서가 §7-A에 적혀 있고 각 절이 덮는 행을 명시한다 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | ΔV2의 NEW 5쌍(R-08/AT-22·SD-04/ST-04·AR-07/IT-08·MD-09/UT-09·MD-10/UT-10)에 VP-26~VP-30이 1:1로 있다 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | "VP-01~10·12~20·24~25는 REGRESSION으로 실행" 문장이 잔여 전건을 덮는다 |
| pair별 path·§10 전수·직접 oracle | **1건 무효** | VP-10의 음성 oracle("import 스윕 0건")이 실행 불가한 술어다 — §4 D1 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 25 pair 중 19개가 변이를 등록하고 6개는 `not selected` + 직접 관측 이유를 적었다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | §7-A "현재 변경의 운영 gate" 8행이 lint·typecheck·순수테스트·마이그레이션·문서·trailer·환경한계·사람실기를 가른다 |

- V 도입 전 plan이 아니다 — 합성 매핑 불필요.
- root PLAN_GAP: **없음.** D1은 구현자가 새 계약을 발명하지 않고 닫을 수 있다(술어를 원문에 적용하거나 `import type` 예외를 명시). 따라서 `PLAN_GAP`이 아니라 `PAIR_FAIL`이다.

---

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-002·D-030 | 기본 OSS는 도구 0, 폐쇄망만 opt-in | `createPluginBindings()` → `[]` (`plugins.ts:88`). `bootstrap.ts:405` 가 그 배열을 sync 한다 |
| D-014·D-044 | 공개 도구 3종, 첨부는 단건 | `mailTools()` descriptor 3행 + `mail_getAttachment` 스키마 2키 필수 (`tools.ts:117`) |
| D-015 | `mail_search`가 통신하지 않음 | `manager.search()`가 `store.search()`만 부른다 (`sync-manager.ts:196`) |
| D-045 | 인증 거부만 3도구 회수, 비인증 5종은 유지 | `sync-manager.ts:159` `normalizePop3Error(error).authFailure` → `reject()` → `markExpired` → `binding.sync()` |
| D-046·D-047 | 일반 소실은 보관, 대량 소실은 재수집 중단 | `reconcile.ts` → `protection.ts` → `sync-manager.ts:118` `if (!protection.ingest) return` |
| D-049·D-056 | 선언 소유 probe, 자격증명 거부만 grant 만료 | `login.ts:502` `'execute' in probe` 분기 → `:353` `probe.ok \|\| probe.preserveGrant ? null : markExpired` |
| D-052 | 옛 revision의 거부가 새 로그인을 만료시키지 않음 | `runtime.ts:213` `credentialRevision` 캡처 → `:223` `markExpired(authId, revision)` |
| D-057 | 연결 좌표 사본은 `AuthDefinition.origin` 하나 | `types.ts:MailPluginOptions`에 좌표 필드 0 · `tools.ts:30` `mailSessionConfig(auth.origin, options)` |

### end-to-end 흐름 (검증한 경로)

```text
연결 탭 login(candidate)
  → login.ts probe() → mailProbe.execute → withMailSession → createPop3Socket → USER/PASS/QUIT
  → 성공만 commit → snapshot 'valid'
  → binding.sync() → RuntimeToolRegistry 에 mail 서버 1개(도구 3)
  → mail_sync handler → withManager(openFileDatabase → applyMailMigrations)
      → cleanupExpired → freshness → withCredential → UIDL → reconcile → protection
      → TOP(역순·14일 경계) → RETR → parseMail → saveMessage → lastSyncAt 저장 → close()
  → mail_search handler → store.search(trigram MATCH / LIKE) → 매니페스트 포함 hit
  → mail_getAttachment(mailId, attachmentId) → exportMailAttachment → Temp 경로만 반환
  → PASS 에 -ERR → reject() → markExpired(revision) → binding.sync() → 서버 0개
```

`mail.integration.test.ts`가 이 경로를 실제 production 심볼로 지난다 — mock 은 `createPop3Socket`·`userDataPath`·`prepareTemporaryFilesPath` 3개뿐이고 `createAuthRuntime`·`createMailAuth`·`mailTools`·`createPluginBinding`·`RuntimeToolRegistry`는 원본을 import 한다. 동명 로컬 재구현 0건.

---

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 양호 | 연결·TLS·타임아웃·파싱·DB·취소 6종이 `pop3-errors.ts`에서 코드로 갈리고 `publicMailError`가 한국어 문구를 붙인다 |
| false success 가능성 | **1건** | AC20 음성 스윕이 구조적으로 0건만 낸다 — §4 D1 |
| partial failure/rollback | 양호 | `saveMessage`가 `written[]`을 잡고 실패 시 전건 `unlink`(`store/index.ts:258`). 완료 메시지 유지는 D-055 |
| Product/UX의 A가 아닌 B를 구현했는가 | 아니오 | §5 상태 전이 6축을 `mail.integration.test.ts` 22케이스가 그대로 지난다 |
| 증상만 제거하고 상태가 남았는가 | 아니오 | 실패 경로가 `lastSyncAt`을 영속하지 않는다 — M20b 변이 red |
| 최적화가 잃은 재검증/취소/만료 관측 | 없음 | 도구 작업마다 DB를 열고 `finally`에서 닫아 전역 캐시가 없다(`tools.ts:44`) |
| 출력/요청 worst-case 상한 | **설계 초과** | 매니페스트 총량 상한이 미구현 — §7 D6 |

---

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh dc2af38~1..HEAD
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `MAIL_TOOL_NAMES` (tools.ts:13) | **죽은 코드** | `rg '\bMAIL_TOOL_NAMES\b' app/src docs` → 선언 1건뿐. 비귀속 → D7 |
| `createMailPlugin` (tools.ts:157) | **죽은 별칭** | 코드 참조 0, plan 본문 참조 4. ΔV2가 EP-10을 `mailTools` 공개 인자로 대체했다 → D7 |
| `retention.ts::isExpired` | **미배선 + SSOT drift** | 프로덕션 호출 0. `cleanupExpired`가 SQL로 같은 규칙을 다시 적는다 → D2 |
| `MailCredential`·`MailConnection` | 정상 | D-050이 요구한 인터페이스. `mail-extension-cost.test.ts`가 typecheck 로 붙잡는다 |
| `createPluginBinding` 프로덕션 0 | 정상(기준선) | D-030 — 기본 배포가 `[]`. 0188 이전부터 같은 상태이며 이번 변경이 만든 것이 아니다 |
| 형제 정책 비대칭 | **결함 1건** | `pop3/native-boundary.test.ts`만 문자열 리터럴을 stripper 에 통과시킨다 → D1 |
| producer ↔ consumer 파생 | 일치 | `attachmentId` producer 는 `store.search` 1곳, consumer 는 `findAttachment` 1곳 |
| 검색 결과 투영의 형제 슬롯 | **잠금 없음** | `from_addr`↔`to_addrs` 맞바꿈이 검출되지 않는다 → D3 |

---

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트: `plugins.test.ts` "valid 만 등록 = 나머지 셋 전부 회수" 3케이스(`none`·`expired`·`unknown`)가 `plugins.test.ts:71`에 실재한다 — VP-05 REGRESSION 의 잠금.
- 핵심 입력/분기 실행 확인: `mail.integration.test.ts:426`이 동시 3호출 후 `f.sockets` 를 2로 단언한다(로그인 1 + sync 1) — AC23의 "소켓 1회"를 **횟수가 아니라 소켓 배열 길이**로 관측한다.
- structural proxy만으로 통과시킨 AC: **AC20 음성 축 1건**(D1).
- **선택된 적대 증거 재측정**: 24건 실행 — 검출 **21** · 미검출 **3**(M20·M23 + 신설축 별도). 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: 이 handoff의 verify 턴은 이번이 처음이라 비교할 verify 라운드가 없다. 구현자 r3 잠금표 21행 중 15행을 다시 심어 전건 red 를 재현했고, `red → green` 덮개 회귀 **0건**.
- **자기검증 분모**: 보완 패스 구현자가 Claude 이므로 보고가 이름을 대지 않은 축 **6건**(N1~N6)을 신설했다 — 3 red · 3 green.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 `tokenize='trigram'`→`'unicode61'` | mail | red(보고) | **red** (2 케이스) | VP-06 등록 변이 |
| M2 `mail_sync`↔`mail_search` annotations 맞바꿈 | mail+deployment | red(보고) | **red** | VP-13 등록 변이 |
| M3 화이트리스트에 `DELE` 추가 | mail+infra/net | red(보고) | **red** | VP-20 등록 변이 |
| M4 `authFailure = true`(전 오류 강등) | mail+deployment | red(보고) | **red** (7 케이스) | VP-21 등록 변이 |
| M5 `authFailure = false`(거부 축소) | mail+deployment | red(보고) | **red** | VP-05 등록 변이 |
| M6 `attachmentId` optional | mail+deployment | red(보고) | **red** | VP-24 등록 변이 |
| M7 보호 임계 부호 반전 | mail+deployment | red(보고) | **red** (7 케이스) | VP-14 등록 변이 |
| M8 표본 조건(`>= MIN_SAMPLE`) 제거 | mail+deployment | red(보고) | **red** | VP-14 등록 변이 |
| M9 `CONFIRM_OBSERVATIONS` 2→1 | mail+deployment | red(보고) | **red** | VP-25 등록 변이 |
| M10 `markExpired(authId, revision)`→`(authId)` | auth+deployment | red(보고) | **red** | VP-30 등록 변이 |
| M11 거부/도달실패 두 문구 맞바꿈 | auth+deployment | red(보고) | **red** (2 파일) | VP-22 형제 맞바꿈 |
| M12 resume 조건(`!candidate && !onResume`) 제거 | auth+gate+app | red(보고) | **red** | VP-23 등록 변이 |
| M13 `preserveGrant` threading 제거 | auth+deployment | red(보고) | **red** | D-056 새 oracle 민감도 |
| M14 probe 결과 무시(항상 commit) | auth+deployment | red(보고) | **red** (9 케이스) | VP-22 등록 변이 |
| M15 `ccAddrs` 제거 | mail+deployment | red(보고) | **red** | VP-17 등록 변이 |
| M16 `bodyText` 제거 | mail+deployment | red(보고) | **red** (4 케이스) | VP-17 등록 변이 |
| M17 `manager.close()` 제거 | mail+deployment | red(보고) | **red** (3 케이스) | VP-28 등록 변이 |
| M18b `record(migration.name)` 삭제 | mail+infra/db | red(보고) | **red** | 보완 패스 새 oracle |
| M19 결과에 내부 루트 노출 | mail+deployment | red(보고) | **red** | VP-04 등록 변이 |
| M20b 실패 경로가 `lastSyncAt` 영속 | mail+deployment | red(보고) | **red** (5 케이스) | VP-08 등록 변이 |
| M21 `PRAGMA synchronous` 삭제 | infra/db+mail | red(보고) | **red** | 보완 패스 새 oracle |
| M22 mail export parent 정규화 되돌림 | mail+deployment | red(보고) | **red** | EP-25 새 oracle |
| M23 **jira** export parent 정규화 되돌림 | jira | 보고 없음 | **green** | EP-25 두 번째 지점 → D5 |
| M24 소켓 모듈 no-op | infra/net+mail+deployment | red(보고) | **red** (4 케이스) | VP-10 양성 축 |
| M20 실패 반환값의 `lastSyncAt`을 now 로 | mail+deployment | 보고 없음 | green | 비귀속 — 영속 축은 M20b 가 잠근다 |

### 검증자 신설 적대 축 (구현 보고가 이름을 대지 않은 지점)

| 축 | 심은 결함 | 관측 | 귀속 |
|---|---|---|---|
| **N1** | `retention.isExpired` 경계 `>`→`<` | `store`+`deployment` 6파일 76케이스 **green**, `pure.test.ts`만 red | D2 |
| N2 | 매니페스트 `slice(0,10)`→`slice(0,1)` | **red** | 기존 잠금 유효 |
| **N3** | 검색 SELECT `from_addr`↔`to_addrs` 맞바꿈 | 13파일 119케이스 **green** | D3 |
| N4 | `mail_getAttachment` `readOnlyHint` false→true | **red** (형제 3번째 자리도 잠김) | 기존 잠금 유효 |
| **N5** | cleanup 에서 `COALESCE(header_date, first_seen_at)`→`first_seen_at` | 13파일 119케이스 **green** | D4 |
| N6 | `parseMailOrigin` 의 TLS 판정 반전 | **red** (6 케이스) | 기존 잠금 유효 |

- 동작 보존 추출 라운드인가: **아니오** — 신규 슬라이스라 hunk 되돌림 문제가 없다.
- 소거 변이의 잔여물 수렴: M12·M24 는 잔여 진단 0 상태에서 red 였다(vitest 는 타입 진단을 세지 않는다). 타입 오류를 red 로 계산한 행 0건.
- 형제 슬롯 맞바꿈: 3종 실행 — annotations 3자리(M2·N4) red, 오류 문구 2자리(M11) red, 검색 투영 2자리(N3) **green**.
- `N회` 기준의 실제 관측 주체: AC23 은 `f.sockets` 배열 길이(fake socket 생성 기록)로 관측한다 — spy 호출 횟수가 아니라 실제 생성물이다.
- 순서 기준의 관측 훅: AC5 의 "비인증 → 캐시 유지" 는 `it.each` 5코드가 각각 `sync → search` 순서를 실행해 관측한다.

### D1 — AC20 음성 스윕이 구조적으로 0건만 낸다 (root)

판정: **`PAIR_FAIL` (VP-10)**. AC20 의 음성 절반과 EP-09 의 1번 지점이 동작하지 않는다.

- 원인 관측: `pop3/native-boundary.test.ts:8` 의 술어는 `/from\s+['"]node:(?:net|tls)['"]/` 인데, `scanOffenders`(`infra/source-scan.ts:46`)가 술어에 넘기기 전에 `stripCommentsAndStrings`로 **모든 문자열 리터럴을 비운다**. `from 'node:tls'` → `from ''` 라 어떤 파일도 매치될 수 없다.
- 결정적 변이: 허용목록 밖 프로덕션 파일(`features/plugins/mail/freshness.ts`)에 런타임 `import { connect } from 'node:net'` 를 심었다 → 가드 **3 tests passed (green)**.
- 이중 확인: 같은 심은 상태에서 `eslint --no-fix` exit 0 · `npm run typecheck:node` 통과. 이 불변식의 **다른 강제 수단이 없다**.
- 엄격화 차집합: 술어를 원문에 적용하면 offender 1건(`features/plugins/mail/types.ts` — `import type { TlsOptions }`), 현재 기준으로는 0건. **차집합이 비지 않았고**, 0 은 전수가 아니라 공허다.
- 형제 비대칭: 같은 헬퍼를 쓰는 `no-node-fetch.test.ts`(`/(^|[^.\w$])fetch\s*\(/`)·`no-cookie-token.test.ts`(`/\.cookies\b/`)는 **식별자**를 보므로 stripper 를 통과한다. `jira/native-boundary.test.ts`는 `readFileSync` 원문을 본다. 문자열 리터럴을 스윕에 넘기는 가드는 이번에 신설된 이 하나뿐이다.
- 범위 귀속: `pop3/native-boundary.test.ts`는 `dc2af38`(이번 handoff)에서 신설됐다. 기존 실패가 아니라 **이번 변경 산출물**이다.
- 양성 절반은 유효: M24(소켓 no-op) 4케이스 red — EP-09 2번 지점은 성립한다.

---

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-14 | MD-01 ↔ UT-01·01b / UT | REQUIRED(CHANGED) | PASS | `pure.test.ts` 보호 경계 + `store` 행수 불변; M7·M8 red | reconcile→protection→수집 분기 / EP-03 4·EP-13 2 |
| VP-15 | MD-02 ↔ UT-02 / UT | REQUIRED | **PASS(경고)** | 14일 경계는 `store/index.test.ts` retention 케이스가 잠근다 | **선언 경로(`retention.ts`)는 미배선** → D2 / EP-03 4 |
| VP-16 | MD-03 ↔ UT-03 / UT | REQUIRED | PASS | `pure.test.ts` 길이 분기 1·2·3·4글자 | query-builder / EP-04 2 |
| VP-17 | MD-04 ↔ UT-04 / UT | REQUIRED | PASS | M15·M16 포함 5필드 소거 전건 red | normalize / EP-14 1 |
| VP-18 | MD-05 ↔ UT-05 / UT | REQUIRED | PASS | 299s/301s 경계 + `freshness` 순수 케이스 | freshness / EP-06 2 |
| VP-19 | MD-06 ↔ UT-06 / UT | REQUIRED | PASS | `attachment-export.test.ts` 파일명 정규화 + M22 red | attachment-export / EP-01 4 |
| VP-20 | MD-07 ↔ UT-07 / UT | REQUIRED | PASS | 허용 6명령 실제 송신 + M3 red | session 명령 게이트 / EP-15 1 |
| VP-25 | MD-08 ↔ UT-08 / UT | REQUIRED(NEW) | PASS | 회복·확인·리셋 4케이스 + M9 red | protection 전이 / EP-19 3 |
| VP-29 | MD-09 ↔ UT-09 / UT | REQUIRED(NEW) | PASS | `pop3-session.test.ts` 40케이스(coalesce·fragment·EOF·abort·timeout) | socket→parser→RETR bytes / EP-22 9 |
| VP-30 | MD-10 ↔ UT-10 / UT | REQUIRED(NEW) | PASS | `plugin-auth.test.ts` unknown/expired/경합 + M10 red | bound credential→revision callback / EP-23 4 |
| VP-10 | AR-01 ↔ IT-01 / IT | REQUIRED | **PAIR_FAIL** | 양성 red(M24) · **음성 스윕 공허**(D1) | bootstrap→pop3-socket→tls.connect / **EP-09 1/2** |
| VP-11 | AR-02 ↔ IT-02 / IT | REQUIRED(ΔV2 대체) | PASS | `AuthSecretReader` 슬라이스 전체 0건 + 실제 USER/PASS 왕복 | deployment→bindForPlugin→mailTools / EP-10 2 |
| VP-12 | AR-03 ↔ IT-03a·03b / IT | REQUIRED | PASS | `sync ok: infra/db 27 · mail 1`, `no-copies ok: 1274 files` | migrate→가드 / EP-11 2 |
| VP-13 | AR-04 ↔ IT-04 / IT | REQUIRED | PASS | annotations `[false,true,false]` + M2·N4 red | binding→registry→approval / EP-12 3 |
| VP-21 | AR-05 ↔ IT-05·05b / IT | REQUIRED(ΔV2 대체) | PASS | 거부 후 registry 0 / 비인증 5종 registry 1; M4·M5 red | errors→reject→markExpired→sync / EP-16 3 |
| VP-23 | AR-06 ↔ IT-06 / IT | REQUIRED(ΔV2 대체) | PASS | HTTP 회귀 불변 + POP3 resume 접속 0; M12 red | login/resume→선언 probe / EP-17 5 |
| VP-26 | R-08 ↔ AT-22 / IT | REQUIRED(NEW) | PASS | 동일 deps 로 HTTP·POP3 조립, OSS 기본 `[]` | auth definitions→deployment→tools / EP-20 3 |
| VP-28 | AR-07 ↔ IT-08 / IT | REQUIRED(NEW) | PASS | 초기화 실패 close·재시도·검색 접속 0; M17 red | tool→infra DB→finally / EP-21 3 |
| VP-07 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | `mail.integration.test.ts:426` sync→search 왕복 | end-to-end / EP-06 2 |
| VP-08 | SD-02 ↔ ST-02 / ST | REQUIRED | PASS | 취소·예산 2케이스 + M20b red | 실패·취소 주입 / EP-07 3 |
| VP-09 | SD-03 ↔ ST-03 / ST | REQUIRED | PASS | 동시 3호출에서 `f.sockets` 2(로그인1+sync1), 세 결과 동일 | single-flight / EP-08 1 |
| VP-27 | SD-04 ↔ ST-04 / ST | REQUIRED(NEW) | PASS | 거부→3도구 회수→재인증 복원 왕복 | 후보 로그인→sync→거부→회수 / EP-16·17 |
| VP-01 | R-01 ↔ AT-01·02·03 / AT | REQUIRED | PASS | 299s 무접속 / 301s 증분 / 기존 UIDL RETR 제외 | mail_sync handler / EP-06 2 |
| VP-02 | R-02 ↔ AT-04·05·06 / AT | REQUIRED(CHANGED) | PASS | throw 소켓 6입력 정상 + 비인증 5종 `stale`·`cacheAsOf` 유지 | mail_search / EP-02 2 · EP-16 3 |
| VP-03 | R-03 ↔ AT-07·08·09 / AT | REQUIRED | PASS | 본문·FTS·파일 3저장소 잔여 0, `features/scheduler` 0건 | cleanup / EP-03 4 |
| VP-04 | R-04 ↔ AT-10·11·12·13 / AT | REQUIRED(CHANGED) | PASS | 내부 루트 substring 부재 4지점 + M19 red | 결과 조립 / EP-01 4 |
| VP-05 | R-05 ↔ AT-14·15·18 / AT | **REGRESSION** | PASS | `toolNames()` 3 유지, `plugins.test.ts` 3상태 잠금 불변 | binding.sync / EP-05 3 |
| VP-06 | R-06 ↔ AT-16·17 / AT | REQUIRED | PASS | 2글자 LIKE·3글자 MATCH 각 1건 + EUC-KR 색인; M1 red | 질의 빌더→FTS / EP-04 2 |
| VP-22 | R-05 ↔ AT-19 / AT | REQUIRED(ΔV2 대체) | PASS | 실패 vault 쓰기 0 + 두 문구 구분; M11·M14 red | login→probe→commit / EP-17 5 |
| VP-24 | R-07 ↔ AT-20·21 / AT | REQUIRED(NEW) | PASS | 매니페스트 3건 왕복 + 두 id 필수; M6·N2 red | search→getAttachment / EP-01 4 · EP-18 1 |

- root `PAIR_FAIL`: **VP-10** — AC20 음성 oracle 이 공허하다(D1).
- 종속 `BLOCKED_BY`: 없음. VP-10 의 양성 축과 나머지 24 pair 는 독립 판정이 가능했고 전건 PASS 다. 같은 원인을 여러 실패로 부풀리지 않았다.
- 하나의 증거가 함께 닫은 pair: `mail.integration.test.ts:426` 한 케이스가 VP-01·VP-07·VP-09·VP-02 의 일부를 동시에 관측한다 — 각 행에 해당 단언을 적었다.
- 이번 라운드 실행 범위: **최초 verify 턴이므로 유효 V의 REQUIRED/REGRESSION 30 pair 전건 + 운영 gate 전건**을 실행했다. 이전 PASS 참조 0건.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 |
|---|---|---|---|
| AC1·2·3 | freshness·증분·기존 UIDL 제외 | ✅ | 299s 무접속 / 301s 증분 / RETR 차집합 |
| AC4·6 | 검색이 통신하지 않고 stale 판정 | ✅ | throw 소켓 6입력 + sync 없이 `stale:true` |
| AC5·28b | 비인증 5종에서 캐시·`valid`·registry 유지 | ✅ | `it.each` 5코드 전건 |
| AC7·8·9 | 만료 3저장소 정리, 진입점 1개 | ✅ | `cleanupExpired` 행·FTS·파일 + `features/scheduler` 0건 |
| AC10·11·12 | Temp 경로만, 매니페스트, 원본 불변 | ✅ | 3첨부 왕복 + bytes/mtime 동일 |
| AC13 | 오류 메시지에 내부 경로·자격증명 없음 | ✅ | 6코드 문구 고정 + M19 red |
| AC14·15 | invalid 면 registry 0, 도구목록은 3 유지 | ✅ | `toolNames()` 3 (2케이스) |
| AC16·17 | 한국어 어절 중간·EUC-KR | ✅ | `'일정'`·`'회의일'` 각 1건 + EUC-KR fixture |
| AC18·19 | core 27 불변, mail append-only 등재 | ✅ | `sync ok: 27 · mail 1`; 가드 fixture 120 pass |
| **AC20** | 소켓 생성 파일이 하나 | **⚠️** | 사실은 성립(독립 grep: 런타임 `node:net/tls` = `pop3-socket.ts` 1개) · **음성 검증 장치는 공허**(D1) |
| AC21 | 공통 deps 로 bound Auth 서버 조립 | ✅ | `AuthSecretReader` 0건 + 실제 USER/PASS |
| AC22·23 | annotations 3자리 · 동시 3호출 1접속 | ✅ | M2·N4 red / `f.sockets` 2 + 세 결과 동일 |
| AC24 | 취소 시 부분 커밋 없음, context 부재 허용 | ✅ | cancel·budget 2케이스 + context 없는 handler 왕복 |
| AC25·25b·33 | 보호 경계·일반 소실 보관·fingerprint 전이 | ✅ | RETR 횟수 차이 + 행수 불변 + 4케이스 |
| AC26·27·28 | DELE 부재·미probe 첫 sync·거부 시 전체 회수 | ✅ | M3 red / `-ERR` 첫 sync / registry 0 |
| AC29·30 | 후보 실패 무저장·문구 구분 / HTTP 불변·resume 무접속 | ✅ | M11·M14·M12 red |
| AC31·32 | 첨부 id 왕복 · 두 id 필수 | ✅ | 3건 왕복 + M6 red |
| AC34·35 | stale revision 거부 무효 · byte stream 종결 | ✅ | M10 red / `pop3-session.test.ts` 40케이스 |
| AC36·37·38 | 자원 close/재시도 · TLS·명령 가드 · USER/PASS 공통 | ✅ | M17·M21 red / `rejectUnauthorized:true` 고정 / 공백·콜론 보존 |

- **합계 재측정**: ✅ **39** · ⚠️ **1**(AC20) · ❌ **0** = 총 **40**. 자기보고 `40/40` 과 **불일치 1건**.
- **합계 사본 대조**: 자기보고 본문 `40/40` ↔ trailer `Criteria-Met: 40/40`(`5689650`·`6522bdc`) ↔ INDEX 비고 `40/40` — 세 사본은 서로 일치한다. 재측정과만 갈린다.

### pair별 plan §10 강제 지점 분모 (검증자 독립 재열거)

| EP | 계약 | plan 지점 | 재열거 | 결과 |
|---|---|---|---|---|
| EP-01 | 내부 경로 은닉 | 4 | **4/4** — `result()` 1 조립기 × sync·search·attachment·error 4 진입 | PASS |
| EP-02 | 검색이 소켓을 열지 않음 | 2 | **2/2(형태 변경)** — 타입 축 대신 `manager.search`의 순수 DB 조회 + 도구 배선 0 sync | PASS |
| EP-03 | 삭제 기준은 retention 하나 | 4 | **4/4** — `DELETE FROM mail` 1곳(`store/index.ts:273`), UIDL 소실 경로 삭제 0 | PASS |
| **EP-09** | 소켓 생성 지점 하나 | 2 | **1/2** — 양성 성립, **음성 스윕 공허** | **PAIR_FAIL** |
| EP-12 | `readOnlyHint` 3자리 | 3 | **3/3** — 세 자리 각각 변이 red(M2·N4) | PASS |
| EP-16 | 자격증명 거부만 강등 | 3 | **3/3** — `-ERR` 판정 · 비인증 5종 `false` · reject 주입 | PASS |
| EP-17 | 선언 소유 probe | 5 | **5/5** — method 우선·candidate commit·resume·문구·gate | PASS |
| EP-21 | 작업 범위 자원 정리 | 3(+2 증분) | **5/5** — open 실패·작업 finally·공유 finally + PRAGMA·적용 기록 | PASS |
| EP-24 | 좌표 사본 하나 | 6 | **6/6** — authoring 1(`resolveMailEndpoint`) · reading 1(`parseMailOrigin`) · 소비 3 · 타입 1 | PASS |
| **EP-25** | 봉쇄 검사 parent 자가 정규화 | 2 | **2/2 코드 · 1/2 oracle** — jira 지점에 잠금 없음(M23 green) | PASS(잠금 결손 D5) |

- 표에 없는데 같은 불변식이 필요한 지점: **2건** — ① 검색 결과 투영의 형제 슬롯(D3) ② cleanup 의 `headerDate` 우선(D4). 둘 다 현재 pair·Decision·AC 가 *행동*으로는 이미 요구하므로 `PLAN_GAP` 이 아니라 `NON_BLOCKING` 이다.
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: **없음**(plan §10 자체 선언과 일치). D1 은 그 역 — plan 이 자기 지점으로 적었는데 그 지점이 동작하지 않는다.

### 현재 변경의 운영 gate

| Gate | 결과 | 관측한 산출 |
|---|---|---|
| subtree — lint | **PASS** | `0 errors, 1 warning` — warning 은 기존 React Compiler(`useTranscriptVirtualizer.ts:22`) 기준선 |
| subtree — typecheck | **PASS** | node·web·test 3구성 exit 0 |
| subtree — 변경영역 테스트 | **PASS** | `vitest run` plugins·auth·gate·deployment·infra/net·infra/db → **56파일 755케이스 pass** |
| subtree — 전체 회귀 | **PASS(환경 한계 분리)** | **544파일 5,056케이스 pass · 8파일 fail · 1 skip** — 8건 전부 `Electron failed to install correctly` |
| subtree — 마이그레이션 가드 | **PASS(부분 한계)** | `sync ok: infra/db 27 · mail 1` · `no-copies ok: 1274 files` · **append-only 체크는 이 환경에 `v*` 태그가 없어 skip** |
| repository — 문서 인벤토리 | **PASS** | `generated doc ok (9 items, 98 channels)` · `prose ok` · `links ok` |
| repository — scripts 테스트 | **PASS** | `node --test scripts/*.test.mjs` → `# pass 120 · # fail 0` (16 suites) |
| message-bus — 커밋 trailer | **PASS** | 7커밋 전건이 `%(trailers:only=true)`로 적힌 키를 그대로 반환 |
| 환경 한계(비-blocking) | 분리 보고 | electron 미설치 8파일. 전부 이번 변경이 건드리지 않은 `app/bootstrap.*`·`app/chat-turn/*` 이고 서명이 동일하다 |
| 사람 실기(비-blocking) | 대기 | 사내 POP3 TLS·사설 CA·실 인코딩·10,000통 초기 수집 |

**이 환경은 구현자보다 넓다** — `npm rebuild better-sqlite3`(Node ABI)가 성공해 DB 스위트가 전부 돌았다. 구현자가 보고한 `55파일 733 pass`(변경영역)를 `56파일 755 pass`로 재측정했다.

---

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| 폐쇄망 레시피(`closed-network-extensions.md:757`) | `mail.integration.test.ts`·`mail-extension-cost.test.ts` 가 같은 형상을 typecheck 한다 | 잘못된 auth id 즉시 거부, 기본 `[]` 유지 | PASS |
| `tlsOptions` 안전 키 | `SAFE_TLS_KEYS` 9키 화이트리스트(`pop3-socket.ts:27`) | `rejectUnauthorized:false` → `Pop3Error('tls_failed')`, 커넥션 옵션에 `rejectUnauthorized: true` 고정 | PASS |
| `security.md §1.8` POP3 예외 | 161~162줄에 등재 | **강제 수단 서술이 D1 로 반쯤 공허하다** — 문서가 있다고 적은 가드가 동작하지 않는다 | ⚠️ D1 |
| `persistence.md` 두 번째 DB | 142줄에 `mail.db` 경로·소유 서술 | `openFileDatabase` 가 core 와 같은 PRAGMA·메타 사본 사용 | PASS |
| `TRD.md §2` 의존성 | `postal-mime 3.0.0` 등재 | `package.json` 과 일치 | PASS(D8 주의) |

- §15 가 요구한 "예제를 `deployment-wiring.test.ts` 의 fixture 로" 는 **위치가 다르다** — mail fixture 는 `mail.integration.test.ts`·`mail-extension-cost.test.ts` 에 있다. shape 검증 요구 자체는 충족된다.

---

## 7. 숫자 / 음성 기준 / 상한 재측정

- 마이그레이션 수: core **27** · mail **1** — 가드 CLI 출력과 `ls` 가 일치.
- `node:net`/`node:tls` 프로덕션 파일: 런타임 **1**(`pop3-socket.ts`) · 타입 전용 **1**(`mail/types.ts`). 프로덕션 `.ts` 전수 **292**.
- `socketFactory` 프로덕션 소비: `tools.ts`(주입) · `auth.ts`(전달) · `sync-manager.ts`(전달) · `pop3-session.ts:221`(유일 호출). 생성 sink 1개 — AC23 의 식과 일치.
- 0건 게이트의 정당한 예외 보존: `AuthSecretReader` 0건·`features/scheduler` 0건은 **식별자 술어**라 유효. `node:net` 0건만 공허(D1).
- **출력 상한 실측(D6)**: plan §14 는 "매니페스트 … **결과 전체 합산 50항목** … ≈17 KB" 를 상한으로 적었다. 코드에는 메일당 `slice(0, 10)`만 있고 **합산 상한이 없다**(`store/index.ts:329`). `limit:50` 최악은 500항목 × ≈334 B ≈ **167 KB** — 설계값의 약 **9.8배**, 본문 포함 ≈200 KB.
- `search()` 가 같은 질의를 **2회** 실행한다(`sync-manager.ts:199`·`:200`) — `total` 도 `limit` 으로 잘린 개수라 "전체 건수" 가 아니다(D10).

---

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| POP3 TLS 핸드셰이크 | 로컬 테스트 CA 로 실제 `tls.connect` 왕복(`pop3-tls.test.ts`) | 사내 사설 CA·프록시 경유 | 폐쇄망 배포에서 연결 버튼 1회 |
| MIME 실 인코딩 | EUC-KR fixture bytes 색인·검색 | 실제 사내 메일의 혼합 인코딩 | 실 계정으로 `mail_sync` → `mail_search` |
| 초기 10,000통 수집 | 역순 TOP + 유예 50 로직 단위 검증 | 120s 예산 내 수렴 여부 | 실 서버 최초 sync 1회 · 소요시간 기록 |
| Electron 설치본 UI | 없음(이 환경은 electron 미설치) | 연결 탭 문구 2종 시각 확인 | 틀린 비밀번호 / 서버 주소 오기 각 1회 |

순수 로직을 사람에게 넘긴 항목 **0건** — 프로토콜 판정·TTL·FTS·경로 은닉·보호 전이는 전부 fake 소켓과 실제 SQLite 로 기계 검증했다.

---

## 9. 게이트 재실행

```bash
cd app && npm run lint && npm run typecheck                 # ABI 중립
npm rebuild better-sqlite3                                   # Node ABI (성공) — DB 스위트 활성화
./node_modules/.bin/vitest run src/main/features/plugins src/main/features/auth \
  src/main/features/gate src/main/app/deployment src/main/infra/net src/main/infra/db
./node_modules/.bin/vitest run                               # 전체
node scripts/check-migrations-appendonly.mjs
node scripts/check-doc-inventory.mjs --check
node --test scripts/*.test.mjs
```

- **관측한 실행 산출**: 변경영역 56파일/755케이스 pass · 전체 544파일/5,056케이스 pass(8파일 환경 실패) · lint `0 error 1 warning` · scripts `pass 120 fail 0`. exit code 를 통과 증거로 쓰지 않았다.
- `npm test` 미사용 — `pretest` 의 ABI 전환 없이 `npm rebuild better-sqlite3` 로 Node ABI 를 맞춰 DB 스위트를 직접 돌렸다.
- 환경 기인 실패 분리 근거: 8파일 전부 `node_modules/electron/index.js:17 getElectronPath` 서명이고, 8파일 중 이번 변경이 수정한 파일은 **0개**다(`bootstrap.artifacts`·`bootstrap.shutdown`·`chat-turn.continuity`·`chat-turn/*` 5). `app/AGENTS.md §제약 환경 게이트 가이드` 의 알려진 서명이다.
- **게이트가 작업 트리를 바꿨는가**: **아니오.** `npm run lint` 는 `--fix` 가 붙지만 실행 후 `git status --porcelain` 이 비었다.
- **검증 중 실행한 명령이 남긴 잔여물**: `node_modules/`(설치)와 Node-ABI 로 재빌드된 `better_sqlite3.node`. 둘 다 `.gitignore` 대상이고 추적 파일 변경 0건. 다음 `npm run dev`/`build` 는 Electron ABI 재빌드가 필요하다(egress 열린 환경 몫).

---

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료 |
| AC ↔ production path | 40행 1:1 대조 완료 — 1건(AC20) 장치 결손 |
| 레이어/계약/문서 링크 | boundaries lint · doc-inventory 통과 |
| AGENTS 위생 | 해당 없음 — 이번 변경에 `AGENTS.md` 수정 0건 |
| 제품 의도 / Open Question | 해당 없음 — 이번 라운드에 새 Open Question 없음 |
| UI/UX 시각 품질 | 연결 탭 문구 2종은 사람 몫(§8) |
| 신규 의존성 | **감소** — `node-pop3` 제거, 신규 0. 승인 필요 없음(D8 은 ledger 표기 문제) |

---

## 11. Repository operation checks

### INDEX 보드 정합성

- 상태/다음 주체: 갱신 필요 — `impl/IMPL_DONE` → `verify/FAIL`, 다음 주체 = Claude(handoff-review, r>3 트리거).
- 「다음 주체」 칸이 주체 하나만 담는가: 현재 `**Claude** (검증)` 1주체 — 형식 적합.
- **대상 커밋 좌표 기입(검증자 몫)**: 자리표시자 `(r3 구현 — 검증자 기입)` 를 실제 좌표로 채운다. `git cat-file -t` 로 7건 전건 `commit` 확인.
- 비고 5줄 이내: 현재 행은 단일 문단 — 적합.
- PASS 시 archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- trailer 허용값: 7커밋 전건 적합. `Agent` = `codex`(5) · `claude`(2), `Status` = `designed`/`implemented`, `Criteria-Met`·`Verified-By: pending` 은 구현 커밋에만.
- trailer 파싱: 7커밋 전건이 `git log -1 --format='%(trailers:only=true)'` 에서 적힌 키를 그대로 반환. 파싱 0건 커밋 없음.
- **인용 해시 실재**: **1건 죽음** — plan 메타 "기준 V … commit `07ec3a6`~`e252c6b`" 의 `e252c6b` 가 `fatal: Not a valid object name`. 서술("r1 PLAN_GAP 보고")이 가리키는 실제 커밋은 **`e3ea535`** 다 → D11.
- 재구현 라운드 `[구현자 기입]` 7필드: **7/7 존재** — 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제·구현 보고·Review Signals. 산문으로 접힌 필드 0.
- 이동/삭제 reference: `implementation-r3.md`·`delta-v2.md` 삭제 — 내용이 `plan.md` 로 흡수됐고 inbound 링크 0건(doc-inventory `links ok`).

---

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| "별도 search 파일 대신 manager 의 순수 DB 조회" | **타당** — EP-02 를 타입 축에서 행동 축으로 옮겼고, throw 소켓 6입력이 그 축을 잠근다 | 수용. EP-02 2/2 |
| "차이 1 — 좌표를 대조에서 파생으로" (D-057) | **타당** — 만료·공유·재진입·무효화 4축을 재유도했고 재측정에서 EP-24 6/6 | 수용 |
| "차이 2 — `preserveGrant` 를 선언 옵트인" | **타당** — HTTP `authFailureStatuses` 와 같은 모양, 기본값이 기존 동작 | 수용. M13 red 로 threading 확인 |
| "`node-pop3` 의존성 제거, 신규 0" | **타당하나 ledger 미반영** — D-023 이 ACTIVE 로 `node-pop3` 를 계속 지시한다 | D8 로 이관(설계자 몫) |
| EP-25 "2/2 — mail · jira" | **코드는 2/2, 잠금은 1/2** — jira 되돌림 변이가 green | D5 로 이관 |
| EP-09 "2/2 — import 경계·실제 TLS 연결" | **재측정 1/2** — 음성 축이 공허하다 | D1(BLOCKING) |
| "`retention.ts` = MD-02" (§11) | **미배선** — 프로덕션 호출 0 | D2 로 이관 |

---

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | AC20 음성 스윕이 어떤 파일도 매치할 수 없다 — `scanOffenders` 가 술어 적용 전에 문자열 리터럴을 비운다 | VP-10 / EP-09 1번 지점 / AC20 | **BLOCKING** | 구현자 — 술어를 원문에 적용하거나 `import type` 예외를 명시하고, 허용목록 밖 런타임 import 를 심은 변이가 red 임을 보인다 |
| D2 | `retention.ts::isExpired` 프로덕션 호출 0 — `cleanupExpired` SQL 이 같은 규칙을 재구현 | VP-15 선언 경로 / EP-03 SSOT 칸 | NON_BLOCKING | 배선하거나 §11·EP-03 의 SSOT 표기를 `store` 로 정정 |
| D3 | 검색 결과 투영의 형제 슬롯 맞바꿈(`from_addr`↔`to_addrs`)을 아무도 잡지 않는다 | 비귀속(§1 성공 문장) | NON_BLOCKING | hit 의 `from`·`to`·`subject` 값 단언 1케이스 추가 |
| D4 | cleanup 의 `headerDate` 우선(D-017)에 잠금이 없다 — fixture 가 두 필드를 같은 값으로 묶는다 | D-017 / AC7 의 기술된 oracle | NON_BLOCKING | `headerDate ≠ firstSeenAt` fixture 1건 추가 |
| D5 | EP-25 의 jira 지점에 oracle 이 없다 — 되돌림 변이 green | EP-25 2번 지점 | NON_BLOCKING | jira 첨부 store 에 별칭 root 케이스 추가 |
| D6 | 매니페스트 총량 상한 미구현 — 최악 500항목 ≈167 KB vs 설계 ≈17 KB | plan §14 | NON_BLOCKING | 결과 전체 합산 50항목 절단 + `attachmentsTruncated` |
| D7 | 죽은 export 2건 — `MAIL_TOOL_NAMES`(참조 0) · `createMailPlugin`(코드 참조 0) | 비귀속 | NON_BLOCKING | 제거하거나 소비처를 만든다 |
| D8 | D-023 이 ACTIVE 로 `node-pop3` 를 지시하나 의존성이 제거됐다 | Decision Ledger | NON_BLOCKING | 설계자가 해당 절반을 SUPERSEDED 로 표기 |
| D9 | plan §15 의 `MailPluginOptions` 가 `host` 를 포함 — D-057 이후의 `types.ts` 와 갈린다 | plan §15 | NON_BLOCKING | 설계자가 §15 형상 갱신 |
| D10 | `manager.search()` 가 같은 질의를 2회 실행하고 `total` 이 `limit` 으로 잘린다 | 비귀속 | NON_BLOCKING | 1회 실행 후 재사용, `total` 의미 확정 |
| D11 | plan 메타의 기준 V 좌표 `e252c6b` 가 실재하지 않는다(실제는 `e3ea535`) | plan 메타 | NON_BLOCKING | 설계자가 좌표 정정 |

`PLAN_GAP` **0건** — D1 은 구현자가 기존 계약(AC20·EP-09)만으로 닫을 수 있으므로 `RETURN_TO_PLAN` 이 아니다. D8·D9·D11 은 설계자 몫이지만 어느 pair 도 막지 않는다.

---

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **없음** — 이 handoff 의 첫 verify 턴이다. r1~r3 은 PLAN_GAP 보고·외부 리뷰 흡수로 돌았고 독립 검증은 0회였다.
- 관련 plan 지침/AC 의 존재 여부: **있었다.** VP-10 이 "음성 스윕 단독은 배선 삭제에 침묵하므로 양성 단언을 짝짓고" 라고 적어 두 축을 모두 요구했고, EP-09 도 2지점으로 세었다. 지침이 없어서가 아니라 **장치가 요구를 수행하지 못해서** 놓쳤다.
- 자기보고 `N/N` 이 못 본 축: EP-09 `2/2` 는 *지점의 존재*를 셌고 *그 지점이 작동하는지*는 세지 않았다. r3 Review Signals 가 EP-21 에서 같은 형태("분모가 열기 쪽을 포함하지 않아 `N/N` 이 이 결함을 볼 수 없었다")를 스스로 기록했다 — **같은 축이 두 번째로 나타났다.**
- 사용자 결정 변경 근거: 이번 라운드에 없음. D-056·D-057 은 외부 리뷰 실측에서 나온 설계자 판단이다.
- 반복된 검증 환경 한계: (a) electron 미설치 8파일, (b) `v*` 태그 부재로 append-only 체크 skip. (b)는 구현자 보고(`append-only ok since v0.3.1`)와 갈리는 **환경 차이**이며 코드 무관이다.
- 라운드 수: r3 검증 FAIL → r4 는 **3을 초과**한다. `docs/handoff/AGENTS.md §handoff-review 트리거` 에 따라 다음 재구현 전에 `handoff-review` 를 수행한다.

---

## 15. 결론

- 상태: **FAIL**
- pair 결과: REQUIRED/REGRESSION **29 PASS** · root `PAIR_FAIL` **1**(VP-10) · `BLOCKED_BY` **0** — 총 30
- PLAN_GAP: **없음**
- Product/UX 및 ACTIVE Decision 충족: ACTIVE 결정 전건 충족. 충돌 0
- AC 충족: ✅ **39** · ⚠️ **1**(AC20 — 기준은 성립, 검증 장치 공허) · ❌ **0** = 40. 자기보고 `40/40` 과 1건 불일치
- 현재 변경 운영 gate: lint·typecheck·테스트·마이그레이션·문서·scripts·trailer **7종 PASS**. 전체 회귀 8파일 실패는 electron 미설치 환경 기인이며 이번 변경이 건드린 파일 0개
- NON_BLOCKING: **10건**(D2~D11) · NEXT_HANDOFF: 없음
- repository operation checks: trailer 7/7 파싱 · `[구현자 기입]` 7필드 전수 · 죽은 좌표 1건(D11)
- 남은 사람 확인: 사내 POP3 TLS·실 인코딩·10,000통 성능·연결 탭 문구 시각 확인 4건
- **다음 단계**: r4 재구현 전에 `handoff-review` 를 수행한다(라운드 3 초과). 그 뒤 구현자가 **D1 한 건**을 닫는다 — 허용목록 밖 프로덕션 파일에 런타임 `node:net` import 를 심은 상태에서 `pop3/native-boundary.test.ts` 가 red 여야 한다. D2~D11 은 같은 push 에 실을 수 있으나 blocking 이 아니다
