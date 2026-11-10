# Verify — 0302-mail-html-body-fallback

> 최신 라운드가 위, 이전 라운드(r1)는 아래에 원문 그대로 보존한다.

# r3 검증 (verify 3회째)

## 메타

| 항목 | 값 |
|---|---|
| 판정 | **PASS** — 이행·현재 결함 0, 확장 후보 1(창 밖 → 후보 표) |
| 검증자 · 일자 | Claude Code · 2026-11-10 |
| 대상 | r3 구현 `f0dd5582`(브랜치 좌표 — 병합 뒤 교정) · 설계 `4f339a0`(ΔV2) |
| V mode / 유효 V | `Baseline V` V1 rev.2 + ΔV1 + ΔV2 |
| 라운드 | 3 |
| 확장 창 | verify 3회째 — **창 밖**. 사용자 요구 변경 ΔV로 다시 열린 노드 없음 |
| 독립 축(⑥) | 2축·17행: 중간 구간 누락 · 가공(trim·replace·중복) · 형제 디코더 맞바꿈 — 경로 ⑤⑥⑦ |
| 열거 sweep(⑦) | 이번 diff가 닿은 g1~g3 + 직전 실패(머리 누락) — 아래 17행, 이행 못 잡음 0 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 1(후보 표) · 경계 0 · 비귀속 0 |
| 못 본 것 | `mime.test.ts`·`store/index.test.ts`·`store/migrate.test.ts` 3파일 — 이 환경에서 `npm ci --ignore-scripts`라 better-sqlite3 바인딩 없음(`Could not locate the bindings file`), 실행 불가. 이번 diff는 테스트 1파일이라 production 변경 0 · 전체 vitest·`node --test`·가드 스크립트 미실행. 구현자 보고(메일 228 passed)는 증거로 쓰지 않음 |

## 0. 기준선

- `b0a105f..HEAD`의 app diff는 `html-body.test.ts` 1파일(`git diff --name-only`). production 0줄. plan.md 변경은 `[구현자 기입]` 추가와 상태 줄뿐이며 Decision·AC·V 규범 행 변경 없음(설계 커밋 `4f339a0`이 ΔV2).
- plan validity: CHANGED MD-03 ↔ REQUIRED VP-10″ 유효 · `.decode(` 자리 3(55·58·60) = §10 EP-06″ 3자리, 차집합 ∅ · VP-01 NOT_REQUIRED 근거(production diff 0) 성립.

## 1. 관측

- 오라클 `vitest run html-body.test.ts`: 1파일 22 passed(이번 턴 재실행).
- 정확 일치 단언(`toBe(declaration+filler+'결론')`)은 g1~g3 입력 4,130/4,109/4,107바이트에서 머리·중간·꼬리 변이를 모두 잡는다.
- typecheck(node·web·test) exit 0, 대상 파일 eslint 출력 0건.
- 커밋 trailer 파싱: `Agent·Handoff·Status·Criteria-Met·Verified-By` 5키 반환, 허용값 일치. 해시 `f0dd558` 실재.

## 2. 고장 이력 (⑥⑦)

| ID | 자리 | 바꾼 내용 | 결과 | 분류 |
|---|---|---|---|---|
| A-head1 | ⑤ | `decode(bytes.subarray(1))` | 잡음(g1) | — |
| A-mid | ⑤ | 3,000번째 바이트 제거 | 잡음 | — |
| A-tail1 | ⑤ | 꼬리 1바이트 제거 | 잡음 | — |
| A-dup | ⑤ | 결과 뒤에 머리 1바이트 디코딩을 덧붙임 | 잡음 | — |
| A-nonstream | ⑤ | 꼬리 1바이트를 따로 디코딩해 이음 | 잡음 | — |
| A-sniffwin | ⑤ | 1,024바이트 경계로 둘로 나눠 디코딩 후 이음 | 못 잡음 | **동치** — 경계가 ASCII 구간이라 결과 문자열이 같다 |
| A-trim | ⑤ | 결과 `.trim()` | 못 잡음 | 확장 후보(아래) |
| B-head1·mid·tail1 | ⑥ | A와 같은 3변이 | 잡음 ×3 | — |
| B-trim | ⑥ | `.trim()` | 못 잡음 | 확장 후보(같은 형태) |
| C-head1·mid·tail1 | ⑦ | A와 같은 3변이 | 잡음 ×3 | — |
| C-trim | ⑦ | `.trim()` | 못 잡음 | 확장 후보(같은 형태) |
| C-utf8 | ⑦ | EUC-KR 폴백을 UTF-8로 맞바꿈 | 잡음(2케이스) | — |
| C-replace | ⑦ | 결과 중 `f` 한 글자 치환 | 잡음 | — |

원복 확인: 하네스 출력 "모든 파일 원문 그대로", `git status` 깨끗. 이행 못 잡음 0 — F3 머리 누락 형태(`subarray(N)`)는 세 경로 모두 잡힌다.

## 3. 발견

| # | finding | 분류 | disposition |
|---|---|---|---|
| F4 | `decodeHtmlBytes` 결과의 앞·뒤 공백 제거(`.trim()`)를 세 경로 모두 못 잡는다 — g1~g3 입력이 공백으로 시작·끝나지 않는다 | 확장 후보(EP-06″ (g′)는 "앞·뒤 누락"이나 열거 입력이 공백을 운반하지 않음) | 창 밖 → `NEXT_HANDOFF(확장)`, 후보 표 등록. 영향: `htmlToBodyText`가 어차피 `trim()`하므로 본문 결과 변화 0 — 사실상 무해 |

## 4. 판정

- VP-10″ REQUIRED: PASS(좌표 `html-body.test.ts` `decodeHtmlBytes (0302 AC18)` g1~g3 + AC17 8케이스).
- VP-01 NOT_REQUIRED: 근거 성립. 이전 PASS 좌표 유지(이번 diff 비영향).
- 막는 발견 0, 창 밖 확장 후보 F4는 PASS를 막지 않는다.

## Review Signals

- 직전 r2의 F3(머리 누락)과 같은 디코딩 완전성 축이 3라운드 연속 나왔다 — 단, 이번에는 이행 결함 0이고 남은 형태(F4)는 본문 결과에 영향이 없다.
- 반복된 환경 한계: DB 바인딩 없는 환경에서 store·mime 3파일 미실행.
- 독립 축(⑥) 발견 1건(확장).

---

# r2 검증 (verify 2회째)

## 메타

| 항목 | 값 |
|---|---|
| 판정 | **RETURN_TO_PLAN** — 이행·현재 결함 0, 확장 후보 1(창 안 → `PLAN_GAP`) |
| 검증자 · 일자 | Claude Code · 2026-11-10 |
| 대상 | r2 구현 `b0a105f0`(브랜치 좌표 — `origin/main` 조상 아님, 병합 뒤 교정) · 설계 `873c410c`(ΔV1) |
| V mode / 유효 V | `Baseline V` V1 rev.2 `d196925` + ΔV1 `873c410c` |
| 라운드 | 2 |
| 확장 창 | verify 2회째 — **창 안**(마지막 창). 사용자 요구 변경 ΔV로 다시 열린 노드 없음 |
| 독립 축(⑥) | 3축·30행: 절단 길이(4096·tail-1·half·1024) / 머리 절단(head-1·창 1,024) / 형제 디코더 맞바꿈 — 경로 ⑤⑥⑦ 각각 |
| 열거 sweep(⑦) | diff가 닿은 EP-06·EP-06′ 전 자리 + 직전 `못 잡음`(V1-04·08) · 항목 14 · 못 잡음 0 |
| 발견 분류 | 이행 0 · 현재 0 · 확장 1(막음 1 / 후보 표 0) · 경계 0 · 비귀속 1 |
| 구현 주체·문맥 | 구현 Codex, 설계·검증 Claude — plan validity는 자기 설계 감사 |
| 못 본 것 | 폐쇄망 실표본 charset · Windows 실기 · 변경 전 기준선 vitest 재실행(r1 verify와 같은 29파일/22케이스임을 확인했을 뿐) |

## 0. 기준선 / plan validity

- 구현 커밋 `873c410c..b0a105f0`의 plan.md 변경은 `[구현자 기입]` 150줄 추가와 메타 `상태` 한 줄뿐이다(`git diff … | grep '^-[^-]'` → 1줄). Decision·AC·V·§10 변경 0.
- 설계 커밋 `e87666f0..873c410c`는 D-017·AC18·EP-06′·§14를 추가했다(사용자 승인 변경이 아니라 verify r1 F1의 설계자 채택). 기준 원문은 §3 D-017 · §7 AC18 · §10 EP-06′ 그대로 쓴다.
- 확장 창 밖 ΔV 새 열거 항목: 해당 없음(창 안).

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V 기준 | 유효 | 기준 `d196925` `origin/main` 조상 |
| CHANGED MD-03 ↔ REQUIRED VP-10′ | 유효 | §7-A ΔV1 표 |
| 영향받은 INHERITED ↔ REGRESSION | 유효 | VP-01 `NOT_REQUIRED` — production diff 0(`git diff --name-only -- app` → `html-body.test.ts` 1개)이라 근거 성립. VP-09는 이번 mail 16파일 228 passed로 다시 닫힘 |
| §10 자리 목록 차집합 | 유효, ∅ | `rg "\.decode\(" html-body.ts` → 55·58·60 = EP-06′ 3자리 · EP-06 검색 9줄 |
| 선택 적대 증거 | 유효 | V1-04·08·09 등록 |
| 운영 gate | 유효 | §7-A gate 표 |

## 1. 구현 비판 읽기 · 역방향 탐색

- diff는 테스트 1파일 15줄이다. production 0줄이라 false success·미배선·형제 비대칭 후보 없음(`decodeHtmlBytes` production 호출 1곳 `normalize.ts:61`, 변경 없음).
- 테스트가 production symbol을 import한다(`decodeHtmlBytes`·`HTML_CHARSET_SNIFF_BYTES`) — 로컬 재구현 아님.
- 출력 상한: 디코딩은 첨부 크기에 선형·무상한(§14 F2 기록됨), 변환은 128Ki 상한 유지.

## 4. 증거 재측정 — 고장 이력

하네스 `mutate.py` · oracle `vitest run html-body.test.ts mime.test.ts pure.test.ts`(baseline 78 passed). 첫 실행은 `better-sqlite3` 바인딩이 없어 baseline부터 exit 1이라 무효였고(`npm rebuild better-sqlite3` 뒤 재실행) 아래는 재실행 결과다. 원복 `git status` 변경 0.

| ID | 자리 | 종류 | 바꾼 내용 | 직전 | 이번 | 잡은 테스트 / 근거 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|---|
| V1-04 | ⑤ `html-body.ts:55` | 다른 값 | `decode(bytes.subarray(0, 2000))` | 못 잡음 | 잡음(1) | AC18 g1 | ②③ | — |
| V1-08 | ⑥ `:58` | 다른 값 | 같은 절단 | 못 잡음 | 잡음(2) | AC18 g2·g3 | ②③ | — |
| V1-09 | ⑦ `:60` | 다른 값 | 같은 절단 | — | 잡음(1) | AC18 g3 | ① | — |
| V1-05 | 레이블 | 다른 값 | `declared.toLowerCase()` | 동치 | 동치 | TextDecoder 레이블은 대소문자 무시 — 78 passed | ③ | — |
| V2-{A,B,C}-4096 | ⑤⑥⑦ | 다른 값 | `subarray(0, 4096)` (입력 4,107~4,130) | — | 잡음 1·2·1 | AC18 | ⑥ | — |
| V2-{A,B,C}-tail1 | ⑤⑥⑦ | 다른 값 | `subarray(0, length-1)` | — | 잡음 1·2·1 | AC18 | ⑥ | — |
| V2-{A,B,C}-half | ⑤⑥⑦ | 다른 값 | `subarray(0, length>>1)` | — | 잡음 6·11·3 | AC17·18 | ⑥ | — |
| V2-{A,B,C}-1024 | ⑤⑥⑦ | 다른 값 | `subarray(0, 1024)` | — | 잡음 1·3·1 | AC18 | ⑥ | — |
| V2-{A,B,C}-headwin | ⑤⑥⑦ | 다른 값 | `subarray(1024)` | — | 잡음 5·9·2 | AC17·18 | ⑥ | — |
| V2-B-head1 · V2-C-head1 | ⑥⑦ | 다른 값 | `subarray(1)` | — | 잡음 5 · 1 | AC17 (d)(e) 본문이 입력 첫 바이트부터 | ⑥ | — |
| **V2-A-head1** | ⑤ `:55` | 다른 값 | `decode(bytes.subarray(1))` | — | **못 잡음**(78 passed) | 입력 앞부분이 `<meta …><p>f…` 뿐이고 표지가 끝에만 있어 앞 몇 바이트 누락이 관측되지 않는다 | ⑥ | **확장** |
| P-A-head{1,10,23,24,25,30} | ⑤ | 다른 값 | `subarray(N)` N=1~30 | — | **못 잡음**(78 passed) 6행 | 위와 같음. N=100부터 잡힘(AC17 (a)(b)의 `회의`) — P-A-head100·1000·4000 잡음 | ⑥ | **확장**(같은 가족) |
| V2-swap-fatal · V2-swap-fallback | ⑥⑦ | 맞바꿈 | utf-8↔euc-kr 디코더 | — | 잡음 8 · 3 | AC17·18 | ⑤ | — |
| E6-01·03·04·06·07 · E6-08-nodecl · E6-09-declswap | EP-06 ①~④ | 제거·다른 값 | 탐지 창 제거·레이블 try 제거·`fatal` 제거·창 2048·정규식 축소·선언 단계 무시·선언 디코더 euc-kr 고정 | — | 잡음 1·1·3·1·1·3·4 | AC17 | ⑦ | — |

- 검산: 시도 40(중복 P-A-head1=V2-A-head1 포함) = 잡음 32 · 동치 1 · 못 잡음 7. `못 잡음` 7은 한 가족(⑤ 선언 경로의 앞 N≤30바이트 누락) → 확장 1건.
- ④: 이번 diff가 닿은 파일은 `html-body.test.ts`뿐이고 공용 설정·setup·헬퍼 변경 0 — r1의 V1-01~03·06·07 행(normalize·sync·migrate 자리)은 diff가 닿지 않아 재실행하지 않았다.
- 동작 보존 추출 라운드 아님 · 소거 변이 잔여물 해당 없음 · 형제 슬롯 맞바꿈 2 슬롯 맞바꿔 검출 · `N회`·순서 기준 해당 없음.
- 구현자 sweep 14행(R2-01~11)은 같은 자리의 변이(`bytes`→빈 배열 등)라 이번 독립 축에서 재현하지 않았다 — 구현자 보고로만 있다. 위 E6-0x와 V2-*가 같은 자리를 다른 변이로 닫는다.

## 5. V-pair closeout

| Pair | 결과 | 직접 oracle 좌표 | 자리 |
|---|---|---|---|
| VP-10′ (MD-03↔UT-03) | **PASS(조건부)** — 규칙 칸 (g) 경로별 입력 3개가 모두 red를 낸다(V1-04·08·09). 위 확장 1건은 판정에 따름 | `html-body.test.ts` `decodeHtmlBytes (0302 AC18)` g1~g3 · `(0302 AC17)` 8케이스 | EP-06 4 + EP-06′ 3 = 7/7, 차집합 ∅ |
| VP-10 (MD-03↔UT-03, 하위) | PASS | 같은 파일 AC17 8케이스 + `mime.test.ts` EUC-KR 첨부 raw | EP-06 4/4 |
| VP-01 | NOT_REQUIRED | 비영향 근거 확인(production diff 0) | — |
| VP-02~08 · VP-09 (이전 PASS) | 이전 PASS 유지 | r1 §4 좌표 — mail 범위 16파일 228 passed로 좌표 실재·green 재확인 | — |

- 좌표 실행 구간: g1은 `decodeHtmlBytes`에 들어가 반환값을 관측한다 — mock 없음. 운반 값 `결론`은 입력 끝 4,107~4,130바이트 뒤라 기본값·빈 값·형제와 구별된다. 규칙 (g)의 분기 1개에 입력 3개(경로별).
- AC 합계: ✅ 18 · ⚠️ 0 · ❌ 0 = 총 18(AC1~AC18 직접 센 값) · 구현 보고·trailer `Criteria-Met: 18/18` 일치.

## 9. 게이트 (`app/`, 마지막 수정 없음)

| 명령 | 관측 |
|---|---|
| `npm run lint` | 0 errors · 2 warnings(Timeline·useTranscriptVirtualizer, 변경 파일 아님) |
| `npm run typecheck` | exit 0 |
| `check-migrations-appendonly` · `check-doc-inventory --check` · `check-test-budgets` | 모두 ok(`20 real-git suites ok`) |
| mail 범위 + `mail.integration.test.ts` | 16파일 · 228 passed(구현 보고와 같음) |
| 파일 필터 없는 `vitest run` | 945파일: 29 failed · 912 passed · 4 skipped / 22 케이스 실패. 서명 `Electron failed to install correctly`(`discard.test.ts` 샘플 재현). 실패 29파일 중 mail·html-body 0, diff가 닿은 파일 0 |
| `node --test scripts/*.test.mjs` | 827 pass · 0 fail |
| 작업 트리 | 변경 0 (`npm ci --ignore-scripts`·`npm rebuild better-sqlite3` 산출은 ignore) |

- 기준선 분리: 실패 29파일/22케이스는 r1 verify가 본 집합과 같은 수치이고 구현 보고의 공통 9파일 외에는 환경(Electron 미설치)이다. 이번 diff가 추가·수정한 파일(`html-body.test.ts`)의 가드 위반 0.
- 구현 보고의 "전체 10 failed + 간헐 hostile 1건"과 이번 29 failed는 환경(Electron 설치 유무)이 다른 수치다 — mail과 무관.

## 11. Repository operation checks

- INDEX 좌표: `a928e94`·`4605e30`·`1aa0f8a`·`b816296`·`d196925` 존재·`origin/main` 조상. `873c410c`(ΔV1 설계)·`b0a105f0`(r2)·`e87666f0`(r1 verify)는 존재하나 `origin/main` 조상 아님(브랜치 좌표) — INDEX 자리표시자를 이 값으로 채우고 "병합 뒤 교정"을 적는다.
- `b0a105f0` trailer 파싱: `Agent·Handoff·Status·Criteria-Met·Verified-By` 5키 반환.
- 구현 보고 필드: 이번 턴 `[구현자 기입]` 7필드(설계 리뷰 · 강제 지점 전수 · 잠금 · Product/UX · 놓친 잠재 문제 · 구현 보고 · Review Signals) 모두 `— r2` 표제로 존재. 강제 지점 표 7자리와 `남긴 곳 0`.
- INDEX 비고 3줄(≤5).

## 13. Finding disposition / 파생 이슈

| # | finding | 분류 · 근거 | 귀속 | disposition | 후속 |
|---|---|---|---|---|---|
| F3 | `decodeHtmlBytes` 선언 경로(`html-body.ts:55`)가 입력의 앞 N≤30바이트를 빠뜨려도 78 케이스 green — g1은 표지가 맨 끝에만 있고 앞부분(`<meta …><p>ffff…`)은 어떤 단언도 보지 않는다. 지금 코드는 올바르다 | **확장 후보**: 등록 변이 V1-04·08·09 밖의 고장. 규칙 칸 (g)는 경로별 입력 1개를 요구하고 g1이 있어 이행 결함이 아니고, 현재 동작은 올바르므로 현재 결함이 아니다. 시도한 고장 V2-A-head1·P-A-head1~30 | EP-06′ ⑤ | `PLAN_GAP`(창 안, 2회째) | 설계자: (a) 채택 — g1 입력 맨 앞에도 표지를 두거나 `결론` 외 머리 단언을 더하고 (g)를 "앞·뒤 모두 보존"으로 확장 (b) 경계 선언 — "디코딩 입력의 머리 수십 바이트 누락은 잠그지 않는다". 현실 원인이 없는 변이(앞 N바이트만 빼는 코드)라 (b)가 구현 턴 없이 닫는다 |
| F2 | 거대 첨부 디코딩 비용 | 비귀속 | §14 | `NON_BLOCKING` | ΔV1이 §14에 이미 기록 — 추가 조치 없음 |

> 이 verify가 2회째라 창 안이다. 설계자가 이번 턴(마지막 창 안 설계 턴)에서 채택/경계를 정하면 이후 새 열거 항목은 동결된다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).

## 14. Review Signals

- 이전 라운드와 유사 증상: 있음 — r1 F1과 같은 자리(`decodeHtmlBytes` 입력 관측)의 다른 방향(길이 절단 → 머리 누락). r1이 닫은 절단 3종은 red이고 이번 건은 별도 방향이다.
- 관련 plan 지침: EP-06′ (g)·AC18 주의사항이 "마지막 바이트 표지"만 요구해 머리 방향을 열거하지 않음.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: Electron 미설치 29파일 red · `better-sqlite3` 네이티브 바인딩 부재(r1과 같음 — 이번 oracle 첫 실행이 이 때문에 무효였다).
- 독립 축(⑥) 발견 1건(확장).

## 15. 결론

- 상태: **RETURN_TO_PLAN** — verify 2회째(창 안).
- pair: REQUIRED/REGRESSION PASS 이전 포함 VP-01~10 유지 · root PAIR_FAIL 0 · BLOCKED_BY 0.
- PLAN_GAP: F3(확장 후보) → VP-10′ 영향.
- Product/UX·ACTIVE Decision(D-017) 충족: ✅ — production diff 0, AC18 18/18.
- 현재 변경 운영 gate: 필수 gate PASS, 전체 vitest 실패는 환경 기준선.
- 남은 사람 확인: 폐쇄망 실표본 charset(plan §6).
- 다음 단계: 설계자가 F3를 채택 또는 경계 선언. (b)이면 구현 없이 verify 3회째(창 밖), (a)이면 r3 구현 후 verify 3회째.

---

# r1 검증 (보존)


## 메타

| 항목 | 값 |
|---|---|
| 판정 | **RETURN_TO_PLAN** — 이행·현재 결함 0, 확장 후보 1(창 안 → `PLAN_GAP`) |
| verify 회차 | 1회째 (확장 창 안). ΔV 없음 |
| 대상 | 구현 `a928e94`·`4605e30`·`1aa0f8a` (`git merge-base --is-ancestor a928e94 origin/main` → on main) |
| 기준선 | plan.md는 설계 커밋 이후 구현 커밋에서 **추가만** 됨(`git diff f49b0ad..1aa0f8a -- plan.md` 삭제 줄 0) — AC·Decision 완화 없음 |
| 못 본 것 | 폐쇄망 실표본 charset · Windows 실기 · 변경 전 기준선 vitest 재실행(구현 보고의 29파일/22케이스와 이번 수치가 같음을 확인했을 뿐) |

## 0. Plan validity

유효. V mode·pair 10행·§10 자리 목록(EP-01~06)·oracle 좌표 존재. 자리 검색 재실행: `normalize.ts`·`html-body.ts`·`sync-manager.ts`·`store/index.ts`·`migrate.ts` 모두 목록과 차집합 ∅(diff 직접 대조).

## 1. diff 비판 읽기 · 역방향 탐색

- 체인 `selectBody`·`attempt`·파싱 한정 catch·저장 뒤 `noBody` 집계·트랜잭션 마이그레이션 모두 D-006/D-009/D-014/D-015와 일치. false success·미배선 없음(`bodySource`는 store → hit → 도구 JSON으로 소비).
- 로그 이벤트에 `message: errorMessage(error)`가 있다(D-012 "uidl, message"와 일치, 제목·주소 아님).

## 2. 증거 재측정 (`app/`, 이번 턴)

| 항목 | 관측 |
|---|---|
| `npm run lint` | 0 errors · 2 warnings(변경 파일 아님) |
| `npm run typecheck`(node+test) | exit 0 |
| mail 범위 vitest(14파일) | 189 passed (better-sqlite3를 node-gyp로 빌드한 뒤) |
| 마이그레이션·doc-inventory·test-budgets 가드 | 모두 ok (`20 real-git suites ok`) |
| 필터 없는 vitest | 29 failed 파일 · 22 failed 케이스 · 8695 passed — 실패 서명 `Electron failed to install correctly`·Windows 경로(`C:/one`). mail 파일 FAIL 0건. 구현 보고와 수치 동일 |
| `node --test scripts/*.test.mjs` | 827 pass · 0 fail |
| 작업 트리 | `git status` 변경 0 (npm ci·빌드 산출은 ignore 대상) |

## 3. 고장 이력 (⑥ 독립 축 포함)

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|
| V1-01 | normalize plain 단계 | 제거 | `text?.trim()` → `text` | 잡음 | pure/mime 1 | — |
| V1-02 | attempt | 제거 | 공백 판정 제거 | 잡음 | 1 | — |
| V1-03 | sync noBody 조건 | 뒤집기 | `=== 'none'` → `!== 'html'` | 잡음 | integration 1 | — |
| V1-05 | decodeHtmlBytes 레이블 | 다른 값 | 선언 레이블 소문자화 | 못 잡음 | — | 동치 (TextDecoder 레이블은 대소문자 무시) |
| V1-06 | migrate skip-applied | 제거 | `applied.has` 건너뛰기 삭제 | 잡음 | store 4 | — |
| V1-07 | parse_failed 로그 `message` | 제거 | message 필드 삭제 | 잡음 | integration 1 | — |
| **V1-04** | decodeHtmlBytes 선언 경로 | 다른 값 | `decoder.decode(bytes.subarray(0, 2000))` | **못 잡음** (158 passed) | — | **확장 후보** |
| **V1-08** | decodeHtmlBytes UTF-8 경로 | 다른 값 | `.decode(bytes.subarray(0, 2000))` | **못 잡음** (158 passed) | — | **확장 후보** |

- V1-04·08: EP-06 UT 입력 칸·AC17의 모든 입력이 2,000바이트 미만이라 "전체 바이트를 디코딩한다"가 어떤 규칙 칸 분기에도 속하지 않는다(규칙 칸 (a)~(f)는 어느 디코더를 쓰는지만 가른다). 인용할 열거 원문이 없어 이행이 아니고, 현재 동작은 올바르므로 현재 결함도 아니다.
- 구현자 sweep 52행 중 이번 턴에 재현한 것은 위 6행뿐이다. 나머지 `잡음` 46행·`동치` 2행(E2-04·E2-11)은 재실행하지 않았다 — 구현자 보고로만 있다.
- ③④(직전 라운드 이력)는 없음(1회째).

## 4. V-pair closeout

VP-01~VP-10: 직접 oracle 좌표(파일:테스트명)가 실재하고 이번 gate 실행 집합 안에서 green. 위 V1-01~08에서 EP-01·03·04·05 자리는 red, EP-06 자리의 "전체 바이트" 항만 비잠금. 판정 기준 VP-10 `PASS`는 **확장 후보 판정에 따름**(아래).

AC 합계: ✅ 17 / 총 17 — 행과 합계를 따로 센 결과 구현 보고와 일치. trailer `Criteria-Met: 17/17` 일치.

## 5. Repository operation checks

- INDEX 대상 커밋 좌표: plan·INDEX의 `a832f51`·`a43f564`는 이 저장소에 없다(`git cat-file -t` → fatal). 실제 설계 커밋은 `b816296`(V1)·`d196925`(rev.2). 구현 `a928e94`·`4605e30`·`1aa0f8a`는 존재·`origin/main` 조상. INDEX 칸을 이 값으로 교정한다.
- `1aa0f8a` trailer 파싱 5키 정상(`Agent`·`Handoff`·`Status`·`Criteria-Met`·`Verified-By`).
- `[구현자 기입]` 일곱 필드 존재(설계 리뷰·강제 지점 전수·잠금(sweep)·Product/UX·놓친 잠재 문제·구현 보고·Review Signals).

## 13. Finding disposition / 파생 이슈

| # | 분류 | disposition | 내용 | 설계자 선택지 |
|---|---|---|---|---|
| F1 | 확장 후보 | `PLAN_GAP` (창 안) | `decodeHtmlBytes`가 입력의 일부만 디코딩해도(V1-04·08) 어떤 테스트도 red가 아니다 — 큰 첨부(2,000바이트 초과) 입력이 없다 | (a) 채택: EP-06 UT 입력 칸에 `>1,024+` 바이트 본문을 가진 선언/UTF-8/EUC-KR 입력을 더하고 §10 규칙 칸에 "전체 바이트를 디코딩한다" 분기를 적는다 (b) 경계 선언: "디코딩 완전성은 잠그지 않는다" |
| F2 | 비귀속·관측 | `NON_BLOCKING` | `decodeHtmlBytes`는 첨부 전체 바이트를 문자열로 디코딩한 뒤 `htmlToBodyText`가 128Ki로 자른다 — 거대 HTML 첨부의 디코딩 비용이 §14 상한에 포함돼 있지 않다 | 설계자가 F1 정정 때 §14에 한 줄 |

이행·현재 결함: 0. 사람 실기: 폐쇄망 실표본 확인은 plan §6이 이미 verify 뒤 사용자 확인으로 둠.

## 14. Review Signals

- 환경 한계 반복: Electron 미설치(29파일 red)·better-sqlite3 네이티브 바인딩이 `npm ci --ignore-scripts` 후 없어 `node-gyp rebuild`가 필요했다.
- 독립 축(⑥) 발견 2건 모두 같은 자리(`decodeHtmlBytes` 입력 길이)이며 분류는 확장 후보.
- 사용자 결정 변경 없음. 관련 plan 지침은 EP-06(AC17)이 입력 크기를 다루지 않음.

## 15. 결론

**RETURN_TO_PLAN.** 구현은 열거 원문을 모두 이행했고 gate가 green이나, 1회째 창 안에서 확장 후보 F1이 나와 설계자가 채택/경계 선언을 정해야 한다. 채택하면 다음 구현은 테스트 입력만 더하면 된다. 다음 주체: 설계자(Claude).
