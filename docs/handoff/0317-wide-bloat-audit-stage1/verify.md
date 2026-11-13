# Verify — 0317-wide-bloat-audit-stage1

## 메타

| 항목 | 값 |
|---|---|
| 판정 | **FAIL** — 이행 결함 1건(W-08 형태 잠금 근거의 사실 오류). PLAN_GAP 0 |
| 회차 | verify 1회째(확장 창 안) · 라운드 1 |
| 기준선 | `1168b67` (`git cat-file -t` = commit) · 이 세션에는 `origin/main` ref 가 없어 조상 여부는 **확인하지 못했다**. plan 메타의 "조상 성공" 주장은 재현 못함 |
| 판정 입력값(잠정) | `--ruling` → `0305 계열 종료` · `sum` 19 · `total` 34 · i18n 5건·55키·120줄. 결함이 문턱 합에 닿지 않아 갈래는 바뀌지 않는다 |

## 0. 기준선 / plan validity

- plan 은 구현 커밋(`7a27e8b`·`31df9d7`)에서 바뀌지 않았다(`[구현자 기입]` 절만 추가). 완화된 AC·Decision 없음.
- plan validity: V mode(Baseline) · pair 10개 · §10 분모(121 · 98 · 46 · 3 · 5 · 11) 모두 명령으로 재현됐다. PLAN_GAP 없음.

## 5. 게이트 재실행(관측)

| gate | 결과 |
|---|---|
| `node …/scan/check.mjs --check` | `단위 98 · 후보 11 · 위반 0 · 대기 0` |
| `node --test …/scan/*.test.mjs` | tests 114 · pass 114 · fail 0 |
| `--targets` / `--units \| wc -l` | 11행(§8 표와 일치) / 98 |
| `git diff --stat 1168b67..HEAD -- app .github` | 0줄 |
| 문서 가드 | INDEX 갱신 뒤 재실행(§11) |

## 4. 고장 이력 (검증자 시도)

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 잡은 것 | 분류 |
|---|---|---|---|---|---|---|
| M-A | `audit.json` W-08 formLock | 뒤집기 | `clear`→`blocks` | 잡음(K10 3건 — 사본 불일치) · `--ruling` 판정·`sum` 불변 | K10 | — (i18n 은 문턱 밖) |
| M-B | F06 `L6` | 빈 값 | `W-05`→`none` | 잡음 | K7·K10 | — |
| M-C | W-05 `saving.prod` | 다른 값 | 6→0 | 잡음 | K8·K10 | — |
| M-D | W-03 `ui` | 뒤집기 | `risk`→`safe` | `sum` 19→23, 판정 유지(둘 다 safe 면 31) | `--ruling` | 경계(선언 경계 2) |

원복 확인: `git status --short` 변경 0 · `--check` 위반 0.

## 7. 독립 축(⑥) — i18n 55키 재검색

plan §9 절차를 새로 짰다: 키마다 `git grep -n -F <전체 키> 1168b67 -- app/src` 에서 리소스 두 파일을 뺀 결과를 본다(접두사 15개 `startsWith` 대조는 0건).
- 반례 4건 중 3건은 더 긴 키의 부분 문자열이라 오탐이다(`skills.author.descPlaceholder` · `chat.artifacts.trashedUnrecorded` · `chat.taskTile.toBackgroundAria/Title`).
- **진짜 반례 1건**: `engine.subtitle` — `AgentEnvironmentView.count.test.ts:66` `expect(markup).not.toContain(ko.engine.subtitle)`. W-08 을 제거하면 이 테스트가 타입 오류다.

## 11. 발견

| # | 분류 | 내용 | 근거 | disposition |
|---|---|---|---|---|
| 1 | **이행 결함** | W-08 `formLock` 을 `clear`("키 경로를 담은 테스트·스크립트 0파일")로 적었으나 위 반례가 있다. AC4 근거 사실 오류 · VP-02 "전제 근거 재실행 N 일치" 위반 | `git grep -n 'engine.subtitle' 1168b67 -- app/src \| grep -v resources/` → 1줄 | BLOCKING → FAIL |
| 2 | 경계 | 판정이 W-03·W-04 UI `risk`(QuestionCard 를 지나는 테스트 0파일 — 재현: `git grep -l QuestionCard 1168b67 -- 'app/src/**/*.test.*'` → 0)에 걸린다. 둘 다 `safe` 면 `sum` 31 → `다음 단계 사용자 결정` | M-D · 선언 경계 2 | 사용자 확인 사항(§15) |
| 3 | 비귀속 | `LegacySubAgentTile.tsx:245` 카드 키 판정 동작 차이(구현자 보고 #5) | 재현 안 함 — 열람만 | NON_BLOCKING |
| 4 | 비귀속 | plan §8·메타의 `origin/main` 조상 주장은 이 세션에서 확인 불가 | `fatal: Not a valid object name origin/main` | 기록 |

통과 후보 W-01·W-06 의 식 동일·감량(4 · 9) 은 코드로 다시 셌고(adapter.ts:129-198 · GitContextBar.tsx:303-323) `process.env` 쓰기 0은 구현자 명령 그대로이며 **재실행하지 못했다**. W-05 raceGuard·감량 6, W-02 formLock 7파일(보고 6 — testfixture 포함, 어느 쪽이든 `blocks`)은 열람만 했다. 못 본 것: 통과 후보 전제 명령 전수 재실행 · i18n 키 `ko.ts` 줄 수 120 재계수 · 선언 경계 10 밖 조립.

## 14. Review Signals — 사실만

- 독립 축에서 나온 발견 1건(이행 결함 · 구현자 자기 검색이 "경계 일치" 문자열만 보고 `ko.engine.subtitle` 형태의 프로퍼티 접근을 놓침).
- 설계 시 `formLock` 의 "키 경로 문자열" 정의가 `ko.a.b` 접근을 명시하지 않았다.

## 15. 결론

**FAIL(r1 → r2).** 다음 주체는 구현자. 고칠 것: W-08 의 `formLock` 을 `blocks`(또는 `engine.subtitle` 을 후보에서 빼기)로 정정하고 근거에 위 테스트 자리를 적은 뒤, 같은 방식으로 나머지 54키를 `ko.<경로>` 프로퍼티 접근까지 포함해 재검색한다.

**사용자 확인(참고):** 현재 입력값으로는 `0305 계열 종료`(19 < 30)다. 단 W-03·W-04(12줄)의 UI 판정 하나가 결정적이다 — `risk` 면 종료, `safe` 면 31줄로 사용자 결정. 최종 판정은 r2 verify 에서 확정한다.

---

# r2 검증 (verify 2회째 · 확장 창 안)

## 판정

**RETURN_TO_PLAN** — 이행·현재 결함 0. r1 발견 1은 닫혔다. 확장 후보 1건(i18n 데이터 정합)이 창 안이라 `PLAN_GAP`이다. 판정 입력값은 그대로 `0305 계열 종료` · `sum` 19 · `total` 34 · i18n 6건 55키 120줄.

## 관측 (이번 턴)

| 항목 | 결과 |
|---|---|
| 기준선 | 구현 커밋 `6714715`(`git cat-file -t` = commit) · plan Decision·AC 변경 없음(`[구현자 기입]` 절만 추가) · `origin/main` ref 없음 — 조상 여부 확인 못함 |
| gate | `--check` 단위 98 · 후보 12 · 위반 0 · UT tests 127 · pass 127 · fail 0 · `git diff --stat 1168b67..HEAD -- app .github` 0줄 · 작업 트리 변경 0 |
| r1 발견 1 | 닫힘 — W-08 `formLock`을 `blocks`로 둔 `engine.subtitle`(W-12)이 분리됐고 `--ruling`에서 W-12만 `pass false` |
| 독립 축(⑥) | 55키를 내 방식으로 다시 셌다 — `skills.list·groups·view` 부모 객체 참조 · 키 꼬리 두 토막 · 꼬리 한 토막의 따옴표·대괄호 형태. 반례 0(`window.oo.skills.list`·이벤트 이름 `skills.list.load-failed`는 다른 주어) |
| 변이 M-E | W-07 `saving.prod` 40→38 후 `--write` → `--check` **green**(위반 0) · `--i18n`은 `audit 38` ≠ 유도 40 red. 원복 확인 |

## 발견

| # | 분류 | 내용 | 근거 | disposition |
|---|---|---|---|---|
| 1 | 확장 후보 | i18n 후보의 `i18nKeys`·`sites`·`saving` ↔ 유도 집합 정합이 K1~K12·`--check` 밖이다. AC13은 두 칸의 **존재**만 열거한다 | M-E: `--check` green · `--i18n` red | `PLAN_GAP` — 설계자가 K 규칙으로 채택하거나 경계로 선언. `sum`은 i18n을 담지 않아 판정은 불변 |
| 2 | 경계 | W-03·W-04 UI `risk`가 판정을 가른다(둘 다 `safe`면 31). r2 근거는 파일 기록 표식 관측으로 바뀌었다 — 이 라운드에 재실험은 하지 않고 열람만 했다 | 선언 경계 2 | 사용자 확인 사항(AC10) |
| 3 | 비귀속 | `LegacySubAgentTile.tsx:245` 카드 키 판정 | 열람만 | NON_BLOCKING |

못 본 것: `--i18n-strip` 삭제 실험(E1~E3)·표식 실험(QC·QC2)의 재실행 · 통과 후보 W-01·W-05·W-06 전제 명령 전수 재실행 · UT 변이 전수(구현자 57건 중 내가 심은 것은 M-E뿐).

## Review Signals — 사실만

- 독립 축 발견 1건(확장) — 구현자 보고 #4와 같다. r1과 같은 "0건 근거의 형태" 축은 이번 재측정에서 새 반례 0.
- 반복된 환경 한계: `origin/main` ref 없음.

## 결론

설계자가 발견 1을 채택(K13 후보)하거나 경계로 선언하면 다음 재구현·verify에서 PASS 가능하다. 사용자에게는 판정 `0305 계열 종료`(19 < 30)와 W-03·W-04 UI 판정 하나가 결정적임을 다시 알린다.

---

# r3 검증 (verify 3회째 · 확장 창 밖)

## 판정

**FAIL** — 막는 발견 2건: 이행 결함 1(W-02 `formLock` 근거 N 6 ≠ 재실행 7 — VP-02 "N 일치") · 현재 결함 1(F06 `L5` 근거 "→ 0" ≠ 재실행 2). PLAN_GAP 0. 판정 입력값은 그대로 `0305 계열 종료` · `sum` 19 · `total` 34 · i18n 6건 55키 120줄이고 두 결함 모두 판정·합을 바꾸지 않는다(근거 문장 정정). 다음 주체는 구현자(Claude, D-011)이며 verify 3회째 FAIL이라 **r4 착수 전 `handoff-review` 1회**다.

## 메타

| 항목 | 값 |
|---|---|
| 회차 | verify 3회째(창 밖 — 확장 후보는 후보 표로) · 라운드 3 → 4 |
| 기준선 | 구현 `ea33f5f`(`git cat-file -t` commit · `origin/main` 조상 아님 — 브랜치 `ccr-160f6d72-4ilo9v`) · 직전 설계 `4b45cb0`(rev.3) · 기준 커밋 `1168b67`(조상 yes) |
| plan 변경 | `git diff 4b45cb0..ea33f5f -- plan.md` 삭제 0줄 · `[구현자 기입] (r3)` 125줄 추가뿐 — Decision·AC·§10·V 불변. 설계와 구현은 별도 커밋(rev.3 설계 `4b45cb0` = plan·INDEX만) |
| 대상 diff | `check.mjs` +93 −42(i18n 순수 함수·상수 + CLI 껍질) · `check.test.mjs` +107 −1(UT 7) · INDEX 1줄 · `app`·`.github` 0줄 |
| 독립 축(⑥) | 6축(§4) — 94단위 짝 검색 재집계 · 정확 중복 블록 열거 · 55키 삭제 실험(tsc·vitest) · 표식 실험 · 경로 기준 소스 가드 · i18n 형태·슬롯 변이 |
| 열거 sweep(⑦) | EP-01~EP-10 분모 전수 재계수 · `check()` red 지점 51 제거 · 등록 변이 13 · r3 diff 자리 83 |
| 고장 이력 | 197건(실행 203회) = 잡음 178 · 동치 3 · 못 잡음(확장) 9 · 경계 7 |
| 발견 분류 | 이행 1 · 현재 1 · 확장 1묶음(9행 → 후보 표) · 경계 3묶음 · 비귀속 1 |
| 구현 주체·문맥 | 구현자 = Claude(D-011) · 설계자 = 검증자 = Claude — plan validity는 자기 설계 감사다 |

## 1. plan validity · 분모 재계수

| 검사 | 판정 | 근거(이번 턴 재현) |
|---|---|---|
| Baseline V · pair 10 · NEW node ↔ REQUIRED pair | 유효 | VP-01~VP-10 · SD 레벨 없음의 이유(실행 시스템 없음) 유효 |
| §10 자리 목록 분모 — 기록된 검색 재실행 | 차집합 ∅ | `--units` 98(구간별 20·16·18·22·3·5·4·3·0·1·6 = §8 표) · `--targets` 11행(경로·줄 수 §8 표와 같음) · `grep -c '^<!-- gen:' audit.md` 5 · `s.messages` 3줄 `:61`·`:80`·`:120` + 함수 정의 `:58`·`:75`·`:116` · `EXCLUDED` 5패턴 · UT 134 = 8+91+5+8+20+2 |
| 적대 증거 선택 이유·운영 gate | 유효 | VP-01·02·03·05·06 required · gate 5개 |
| i18n 근거 도구(§9 rev.3 형태 표·단계 문장) | **열거 원문 밖** | rev.3 self-review "열거 원문 불변 — AC 13 · Pair 10 · EP-01~EP-10 · K 조건 46". 그 표의 oracle 칸은 "기존 UT"다 → 이 도구의 UT 공백은 확장(D3) |

## 2. 관측 — gate · 재현

| 명령 | 관측 |
|---|---|
| `node scan/check.mjs --check` | `단위 98 · 후보 12 · 위반 0 · 대기 0` |
| `node --test scan/*.test.mjs` | tests 134 · pass 134 · fail 0 · cancelled 0 · skipped 0 |
| `--ruling` | `0305 계열 종료` · sum 19(P W-01 4 · W-05 6 · W-06 9) · total 34 · i18n 6·55·120 |
| `--i18n` | 46줄 · sha1 `b58047add57d` = r3 구현 보고(리팩토링 전과 같음) · `유도−audit.json ∅` · `audit.json−유도 ∅` |
| AC8 · 작업 트리 | `git diff --stat 1168b67 -- app .github` 0줄 · 변이 전후 `git status --short` 0줄 |
| 문서 가드 | `cd app && node scripts/check-doc-inventory.mjs --check` — generated · prose · links ok(INDEX 갱신 뒤 §11에서 재실행) |

## 3. VP-02·VP-03 근거 재실행 (통과 후보 전부 + 걸린 후보 3건)

audit.json 의 단위 밖 명령 중 N 을 적은 20개(W-01~W-06 17 · 구간 3)를 그대로 실행해 적힌 N 과 대조했다.

| 후보·구간 | 대조 | 결과 |
|---|---|---|
| W-01 (통과) | raceGuard prod 0(원 17줄 중 test 제외) · formLock 1 · agentsRule 0 | 3/3 일치 |
| W-05 (통과) | raceGuard 0 · formLock 3파일 16줄(4+3+9) · 호출 횟수 단언 0 · agentsRule 0 | 4/4 일치 |
| W-06 (통과) | formLock 0 · agentsRule 3줄 — 근거는 `design-components.md:193`·`state.md:113` 둘만 서술, `rendering.md:233`(확대 상태 전달 — 형태 규칙 아님) 누락 | N 미기재 · 판정 불변(D6) |
| W-02 (걸림) | formLock `'readVersion:'` → **7파일**(근거 "6파일") · agentsRule 0 · ui "non-test 는 server.ts 뿐" — `updater.ts` 의 `readVersion` 은 다른 함수 | formLock **불일치**(D1) |
| W-03 · W-04 (걸림) | raceGuard 0 · formLock 0파일 · agentsRule 0 | 일치 |
| F02 `L5` · F10 동적 접두사 | `FingerprintWatch` 0 · 27줄 · 접두사 16 · 번역 키 접두사 15 | 일치 |
| F06 `L5` | `git grep -l useBackgroundStore … harnesses/opencode` → **2파일**(근거 "→ 0") | **불일치**(D2) |
| i18n W-07~W-12 | `--i18n` 합계 줄(prod 0 · test W-11 1 · W-12 1 · rule 0 · 템플릿 0 · 접두사 겹침 0) · 범위 파일 prod 1038 · test 1016 · rule 50 · F10 근거 1,161 · 1,004 · 157 = 102 + 55 | 일치 |

**VP-03 — `l6: none` 단위 94개 전부(요구는 5)**: 파일 안 줄 수 94/94 · 반대 프로세스 파일 수 94/94(`.ts`·`.tsx`만 센 값 — 근거 명령 문장에 확장자 필터가 없다. 문장 그대로 돌리면 12건이 `.css`·`.sql` 때문에 ±1~3) · 같은 프로세스 타 파일 수 91/94(F02 `probe` 30≠31 · F02 `context` 56≠57 · F10 `ko` 9≠10, 정보 칸) → 경계 2(D6).

**산식 재계수**(수치 재측정): 전 줄 수 W-01 195-200=6 · W-03 165-170=6 · W-04 6+5+6=17 · W-05 107-118=12 + 139-145=7 · W-06 4+4+7+4=19 전부 일치. 한 줄로 접는 문장은 `printWidth: 100` 안이다(W-03 88자 · W-06 96·90·100자). `sum` 19 · 합치면 W-03·W-04 12줄.

**표식 실험 재현**(기준 커밋 사본에 파일 기록 표식 · `vitest run src/renderer src/main/adapters/opencode/v1/adapter` — 427파일 3,456케이스):

| 지점 | 근거 주장 | 이번 관측 |
|---|---|---|
| QuestionCard 렌더 · `onRootKeyDown` | 7회 3파일 · KEY 0 | 7회(approvalQueue 4 · activity 1 · questionIpc 2) · KEY 0 · W-03 세 자리 0 |
| W-04 세 갱신 함수 | 98 진입 1(조기 반환) · 복사·대입 0 · 116·123 진입 0 | `W04a-entry` 1(questionIpc) · `W04a-copy` 0 · `W04b` 0 · `W04c` 0 |
| W-05 · W-06 · W-01 | render·spark·wiring 3파일 · `GitContextBar.actions.test.ts` 네 콜백 · 4파일 두 try | 164·82회 3파일 · 네 콜백 2·1·1·1회 · 104·103회 4파일 — 일치 |

## 4. 독립 축(⑥) — 구현 보고·등록 목록에 없던 것

| 축 | 방법 | 결과 |
|---|---|---|
| 55키 삭제 실험 | 기준 커밋 사본(`app` 만 · `npm ci --ignore-scripts` 974패키지)에 `--i18n-strip`. E1 55키 · E3 54키(`engine.subtitle` 제외) | E1 `tsc` web 오류 1건 = `AgentEnvironmentView.count.test.ts(66,44)` TS2339 `subtitle`(W-12) · node·test 0. E3 `tsc` 3종 0 · `vitest run src/renderer src/main/product-identity.test.ts` 기준선·E3 모두 423파일 3,378케이스 실패 5, **실패 집합 동일**(새 0 · 사라짐 0 — 환경: better-sqlite3 바인딩 · Electron 바이너리 · 사본에 `docs` 없음) |
| 정확 중복 블록 | 정규화한 4줄 창을 prod 1,035파일 전체와 대조(8 prod 파일, i18n 제외) | 블록 15개 · 최대 6줄 · 대부분 F06·F07 우측 패널(감사 관찰 O-6 카드 틀 −4줄과 겹침) · 시그니처·JSX 속성 반복(감량 0~2줄 추정) — 근거 밖 7줄 이상 정확 중복 0 |
| 경로 기준 소스 가드 | 후보 파일명을 읽는 테스트·eslint(심볼이 아니라 경로) | `reportSites.registry.test.ts`(CanonicalBackgroundContent 등록 — `ordinal` 로 대조, `line` 은 제목뿐) · `diffPanel0211dv6.render.test.ts:112`(소스에 `chat.rightpanel.diffEmpty` 포함) · `harness-boundary.test.mjs`(import 경계) — 후보 형태를 새로 잠그는 것 0 |
| 파이프 불일치 일반화 | 위 N 대조를 구간 근거·후보 근거 전부로 확대 | D1·D2 — 2건 |
| i18n 근거 도구 변이 | r3 diff 자리 83건(§5) | 확장 9 · 경계 4 |
| 단위 짝 검색 재집계 | `none` 94개 · 3 해석 | §3 |

## 5. 고장 이력

**r3 diff 자리**(`check.mjs:844-914` 순수 함수 · 셸 4곳) — 83건 = 잡음 70 · 동치 1 · 확장 8 · 경계 4. 판정은 `node --test check.test.mjs` 종료 코드이고 `--i18n` 출력 sha1(기준 `b58047add57d`)을 함께 적었다.

| ID | 자리 | 종류 | 바꾼 내용 | 직전 | 결과 | 잡은 테스트 · 근거 | 분류 |
|---|---|---|---|---|---|---|---|
| VS01~VS14 · VS16~VS19 | `:847-863` 범위 | 제거·다른 값·맞바꿈 | `.json`·`[cm]?`·`tsx`·scripts·eslint·루트·`.test.`·`.testfixture.`·리소스 KO/EN(각각·맞바꿈)·prod/test 맞바꿈·`inRoots`·코드 확장자 | 구현자 S1~S7·G3·G4·G7 | 잡음 18/18 | "i18n i18nScopes" | — |
| VP01~VP04 · VP06 · VP08~VP11 · VP13~VP19 | `:868-895` 1단계·유도 | 제거·다른 값·맞바꿈 | 루트 2개·머리 꼴·`keyHeads` 거르기 제거·`every`·분기 순서·STATIC→TEMPLATE·`length>0`·복수형 접기·정렬·줄 번호·`eligible`↔`prefixed`·`prefixed`↔`referenced`·`path`·`head` | P-1~P-6·G1·G2·G5 | 잡음 15/15 | "i18n deriveI18n 1단계·STATIC·키" | — |
| VB-zero~VB-other · VB-noop | `:848-850` 복수형 | 제거 | 접미사 6개 각각 · `i18nBase` 항등 | B-zero~B-other | 잡음 7/7 | "i18n deriveI18n 키" | — |
| VT01~VT07 · VT09~VT11 · VT14 · VT15 | `:903-914` 집계 | 제거·뒤집기·다른 값 | step1 0·반전·`counted` true·반전·`template` 슬롯·rule 범위·순서·`...h`·`template=false`·DOC→템플릿·템플릿→prod/rule | T-1~T-3 | 잡음 12/12 | "i18n refTally" | — |
| VF-rm ×9 · VF-sw ×8 | `:805-809` 형태 표 | 제거·맞바꿈 | 9형태 각각 목록에서 · 합집합 유지 맞바꿈 8(`string`→DOC 등) | F-S1~4·F-SW1~4 | 잡음 17/17 | "i18n REF_FORMS"(제거)·"i18n deriveI18n STATIC·TEMPLATE·DOC"·"refTally" | — |
| VS15 | `:862` | 제거 | prod 의 `p.startsWith('app/src/')` | S-6 동치 | 동치 | `inRoots` ∧ `!isI18nTest` 이면 `app/src/` 밖은 `app/scripts/**`·eslint 설정뿐이고 둘 다 test — 모든 입력에서 동치. `--i18n` sha 같음 | — |
| VP05 | `:884` | 다른 값 | `keyHeads` 거르기 `startsWith`→`includes` | 신규 | 못 잡음 | UT green · 판정(referenced·prefixed·eligible) 불변 — `keyHeads` 보고값만 변함(sha 변함) | 확장 |
| VP07 | `:892` | 다른 값 | 접두사 대조 `startsWith`→`includes` | 신규 | 못 잡음 | UT green · sha 같음 · 중간에 접두사를 품은 키 입력이 없다 | 확장 |
| VP12 | `:883` | 제거 | 머리 중복 제거(`new Set`) | 신규 | 못 잡음 | UT green · 보고 접두사 수 27(sha 변함) | 확장 |
| VB-anchor | `:848` | 제거 | 접미사 정규식의 `$` 앵커 | 신규 | 못 잡음 | UT green · sha 같음 · 중간 `_one` 입력 없음 | 확장 |
| VT08 · VT12 · VT13 | `:911` | 맞바꿈 | `tally` 슬롯 test↔rule · prod↔test · prod↔rule | 신규(⑤) | 못 잡음 | 'i18n refTally' 의 `tally` 가 5슬롯 모두 1 — 맞바뀌어도 같다. VT08·VT12 는 `--i18n` 합계 줄이 바뀐다(sha 변함) | 확장 |
| VF-sw-bareAncestor>TEMPLATE | `:808` | 맞바꿈 | DOC `bareAncestor`→TEMPLATE | 신규(⑤) | 못 잡음 | 분류 입력이 `bare` 뿐 — `bareAncestor` 는 검출 UT만 있다 | 확장 |
| WS1~WS4 | `i18nReport` 셸 | 제거·맞바꿈 | `ls` 에서 `app/scripts` · `prod` 입력을 test 로 · test↔rule 색인 · `keyHeads` 비움 | 신규 | 못 잡음 | UT 는 순수 함수 여섯만 본다(plan §11) · `--i18n` sha 4건 모두 변함 | 경계(§11 · 선언 경계 11) |

**`못 잡음` 확장 9행** — VP05·VP07·VP12·VB-anchor·VT08·VT12·VT13·VF-sw-bareAncestor + P5(아래). 분류 근거: 이 도구의 규칙은 §9 형태 표·단계 문장이고 rev.3 가 "열거 원문 불변"을 적었다 — 그 표의 oracle 칸은 "기존 UT"라 원문이 이 입력을 덮는다고 보려면 해석이 필요하다(SKILL §11). 구현자가 r4 에서 같이 닫아도 되지만 의무가 아니다.

**VP-07~VP-10 UT 민감도**(r3 diff 밖 `check()`·`deriveTargets`·`extractUnits`·`passes`·`ruling` — 이전 pair 판정에 좌표가 없어 재판정) — 84건 = `check()` red 지점 51 제거 51/51 잡음 · `deriveTargets`/`collectRead` 11/11 · `ruling`/`passes` 12/12 · `extractUnits` 7/10 잡음.

| ID | 자리 | 종류 | 바꾼 내용 | 결과 | 근거 | 분류 |
|---|---|---|---|---|---|---|
| U-break | `:127` | 제거 | 첫 일치 뒤 `break` | 동치 | 기준 커밋 prod 1,035파일 4,989줄 중 패턴 2개 이상에 걸리는 줄 0 · 앵커가 서로소(`units` 98 · `--check` 0) | — |
| P2-mods | `check.mjs` P2 | 제거 | 수식어 목록에서 `readonly` | 동치 | TS 는 메서드에 `readonly` 를 못 붙인다 · `units` 98 · `--check` 0 | — |
| P5-export | P5 | 제거 | `(?:export )?` | 못 잡음(UT) · **잡음(`--check`)** | UT 입력에 `export const x = ` 없음. 실데이터 5줄(discovery-cache 4 · ko 1)이 사라져 `units` 98→93 · K2 red — VP-01 gate 가 잡는다 | 확장 |

**등록 변이 13**(`data`·`audit.md`·`check.mjs` · oracle `--check`): R-D1 F04.X8 삭제 `K1,K10` · R-D2 단위 삭제 `K2,K10` · R-D3 유령 단위 `K2,K10` · D01 W-12 formLock 삭제 `K5,K10` · D05 W-12 자리→테스트 파일 `K4,K10` · R-D6 유령 W-13 `K7,K10` · D02 `dynamicPrefix` 삭제 `K10,K12` · R-S1 W-06 raceGuard→blocks sum 19→10(P W-01·W-05) · D08 `i18nKeys` 삭제 `K10,K12` + sum 19 불변(i18n 5·54·118) · D15 `19줄`→`18줄` `K10` · R-M2 premises 블록 삭제 `K10` · R-C1 AREAS F11 삭제 `K1,K2,K10,K11` · R-C2 `READ_0315` 줄 삭제 — 5줄 각각: `--check` 는 `session-context.ts` 만 `K11`(나머지 4개는 4버킷 밖 · `--targets` 11행 그대로), UT-04 는 5줄 전부 red. **13/13 잡음**. 추가 R-C3(AREAS 에 F12) `K1,K2,K10,K11`.

**이전 라운드 대조(④)** — M-A W-08 formLock→blocks `K10` · M-B F06.L6→none `K7,K10` · M-C W-05 prod 6→0 `K8,K10`(sum 13) = 잡음 3/3, `red → green` 0 · M-D W-03 ui→safe 경계(sum 23) · **M-D2 W-03·W-04 ui→safe → `다음 단계 사용자 결정` sum 31**(경계) · M-E W-07 prod 40→38 + `--write` → `--check` green · `--ruling` i18n 118(경계 11, 설계대로).

**형제 슬롯 맞바꿈(⑤)** — 데이터 SW1 W-02 raceGuard↔formLock 판정 `K10` · SW2 W-03↔W-04 prod `K10` · SW3 W-01 area F01→F08 `K4,K7,K10` · SW4 W-12 자리 ko↔en `K10` = 4/4 잡음. 코드 슬롯은 위 표(VT08·VT12·VT13·VF-sw).

- 검산: 197 = 잡음 178 · 동치 3(VS15 · U-break · P2-mods) · 못 잡음 9(VP05 · VP07 · VP12 · VB-anchor · VT08 · VT12 · VT13 · VF-sw-bareAncestor · P5-export) · 경계 7(WS1~4 · M-D · M-D2 · M-E).
- 동작 보존 추출 라운드: **예**(r3 = 판정을 순수 함수로 옮김, `--i18n` 바이트 동일). hunk 되돌림의 green 은 근거가 아니라서 위 표는 되돌림이 아니라 규칙 칸 분기·형제 슬롯 변이로 짰다.
- 소거 변이의 잔여물: `no-unused` 진단 해당 없음(JS 모듈 · UT 종료 코드만 oracle).
- 실행 뒤 원복: `git status --short` 0줄, `--check` 위반 0.

## 6. V-pair closeout

| Pair | 결과 | 직접 oracle · 이번 관측 | §10 분모 |
|---|---|---|---|
| VP-01 R-01↔AT-01 | PASS | `--check` K1·K2 · R-D1·R-D2·R-D3 red · `l6: none` 94 재집계(§3) — F06 `L5` 근거 오류(D2)는 이 pair 의 oracle(존재) 밖 | EP-01 121 · EP-02 98/98 |
| VP-02 R-02↔AT-02 | **PAIR_FAIL** | W-02 formLock N 불일치(D1) — "N 일치를 본다" 위반. K3~K9·K12 · D01·D05·R-D6·D02 red | EP-03 156 · EP-04 36 · EP-08 5 |
| VP-03 R-03↔AT-03 | PASS(기계 범위) | UT-03 R1~R4(5건) · `--ruling` · R-S1 · D08 · M-D2 감도 · `none` 단위·동적 접두사 재실행(§3). AC10 사람 | EP-06 6 · EP-07 3 |
| VP-04 R-04↔AT-04 | PASS | `git diff --stat 1168b67 -- app .github` 0줄 | 0 |
| VP-05 R-05·AR-01↔AT-05·IT-01 | PASS | K10 · D15·R-M2·M1b red · `gen:` 5 | EP-09 사본 3곳 중 2(verify.md 는 이번 절) |
| VP-06 R-06↔AT-06 | PASS | K11 · R-C1·R-C3 red · R-C2 `session-context.ts` red(UT-04 5/5) · `--targets` 11 | EP-10 11 · 규칙 7 |
| VP-07 MD-01↔UT-01 | PASS | UT-01 8건 · `extractUnits` 변이 7/10 잡음 · 나머지 U-break·P2-mods 동치 · P5-export `--check` 잡음 | EP-02 패턴 5 + 규칙 2 |
| VP-08 MD-02↔UT-02 | PASS | UT-02 91건 · `check()` red 지점 51/51 · 조건 46 | EP-05 46 |
| VP-09 MD-03↔UT-03 | PASS | `ruling`·`passes` 변이 12/12 | EP-06 갈래 4 + 경계 2 |
| VP-10 MD-04↔UT-04 | PASS | `deriveTargets`·`collectRead` 11/11 | EP-10 규칙 7 |

- root `PAIR_FAIL`: VP-02 · 종속 `BLOCKED_BY` 없음 · 하위 pair 좌표로 닫은 상위 pair 없음.
- **AC 합계 재측정**: `✅ 10 · ⚠️ 2 · ❌ 1 = 총 13` — ✅ AC2·3·5·6·7·8·9·11·12·13 · ⚠️ AC1(근거 N 오류 F06 `L5`)·AC10(사람) · ❌ AC4(W-02 N). 자기보고 `12/13`과 갈린다(AC1·AC4). 본문 12 ✅ · 커밋 trailer `Criteria-Met: 12/13` · INDEX 비고(합계 미기재)는 서로 같다.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| 감사 검사 · 검사기 UT | PASS | §2 |
| 문서 가드 | PASS(§11) | links ok |
| trailer 파싱 | PASS | `git log -1 --format='%(trailers:only=true)' ea33f5f` — Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By·Co-Authored-By·Claude-Session 8키 |
| 무변경(AC8) | PASS | 0줄 |

## 7. 판정 입력값(잠정) · 걸린 후보 칸

`--ruling` — `0305 계열 종료` · `sum` 19 < 30 · P: W-01(4) · W-05(6) · W-06(9) · 걸림: W-02(3 formLock) · W-03(4 ui) · W-04(8 ui) · `total` 34 · i18n 6건 55키 120줄(통과 W-07~W-11 · 걸림 W-12). 두 결함(D1·D2)은 이 값을 바꾸지 않는다 — W-02 는 7파일이어도 `blocks`다.

`total` 34 ≥ 30 이므로 걸린 칸을 전부 적는다(plan §17):

| 후보 | 걸린 칸 | 이번 재현 |
|---|---|---|
| W-02 3줄 | formLock | `readVersion:` 주입 테스트 7파일 · `server.test.ts:235`(`toHaveBeenCalledOnce`)·`:244`(`toHaveBeenCalledTimes(2)`) 가 호출 횟수를 단언 |
| W-03 4줄 | ui | `onRootKeyDown` 실행 테스트 0 — 컴포넌트는 3파일 7회 렌더되나 키 입력이 없다 |
| W-04 8줄 | ui | 세 갱신 함수 중 98행 진입 1회(조기 반환)뿐 · 복사·대입 0 · 116·123 진입 0 |

**사용자 확인(AC10)** — 판정을 가르는 것은 W-03·W-04 UI `risk` 둘뿐이다. 둘 다 `safe`로 보면 `다음 단계 사용자 결정`(sum 31, M-D2 재현)이다. 기준은 0315 B-03·B-04 와 같은 "바꿀 분기를 지나는 테스트"이고 이번 재현으로 그 사실(KEY 0 · 복사·대입 0)이 다시 확인됐다. FAIL 이라 최종 판정은 r4 verify 에서 확정한다.

## 8. 사람 vs 에이전트

| 항목 | 에이전트 | 사람 |
|---|---|---|
| gate·UT·N 재현·삭제 실험·표식 실험 | 실행·출력 증거(§2~§5) | — |
| W-03·W-04 UI `risk` 의 해석(감량 12줄을 포기할지) | 근거 재현까지 | **AC10 확인** — 판정이 걸린 유일한 값 |

남은 사람 실기는 AC10 하나다. 순수 로직을 사람에게 넘기지 않았다.

## 9. 발견 · 파생 이슈 (§13)

| # | finding | 분류 · 근거 | 귀속 | disposition | 후속 |
|---|---|---|---|---|---|
| D1 | W-02 `formLock` 근거 "→ 6파일(…)"인데 같은 명령이 7파일 — 누락 `app/src/main/app/chat-turn/opencode-runtime.test.ts:150`(`new OpenCodeServerPool({ … readVersion: async () => '1.19.0' … })`) | **이행** — VP-02 "N 일치를 본다" · AC4 "근거(명령+N)". 재현 `git grep -l 'readVersion:' 1168b67 -- 'app/src/**/*.test.ts' 'app/src/**/*.testfixture.ts'` → 7. 판정 `blocks`·`sum` 불변 | VP-02(AC4) | BLOCKING | 구현: N·파일 목록 정정 → `--write` · `--check` |
| D2 | F06 `L5` 근거 "…→ 0 — 짝 없음"인데 같은 명령이 2파일 — `opencode/rightpanel/tiles.tsx:22`(prod · `sessionPanelModel` 입력으로 쓰는 소비자) · `tiles.memo.test.ts:5`. 판정(짝 없음)은 방어 가능 | **현재** — 재현 `git grep -l useBackgroundStore 1168b67 -- app/src/renderer/src/features/chat/harnesses/opencode` → 2. r1 파생 이슈 1 의 불변식("0건 근거는 재실행하면 0")과 AC1 "근거" | AC1 · 현재 산출물 | BLOCKING | 구현: N 정정 · `tiles.tsx` 의 역할을 근거에 적음 → `--write` |
| D3 | i18n 근거 도구 UT 입력 공백 9행 — `refTally` 슬롯 맞바꿈(VT08·VT12·VT13: `tally` 단언이 5슬롯 모두 1) · 1단계 접두사 대조 `includes`(VP07) · `keyHeads` 거르기(VP05) · 머리 중복 제거(VP12) · 복수형 `$` 앵커(VB-anchor) · DOC `bareAncestor` 분류 · EP-02 P5 `(?:export )?` UT 입력(데이터 gate 는 잡음) | **확장** — 시도한 고장은 §5. 원문(§9 형태 표·단계 문장)이 덮는다고 보려면 해석이 필요하다 | VP-02 근거 도구 | NEXT_HANDOFF(확장) | 후보 표 1행 — 고칠 의무 없음 |
| D4 | W-03·W-04 UI `risk` 가 판정을 가른다(둘 다 safe 면 31) | **경계** — 선언 경계 2 · M-D·M-D2 | AC10 | 사용자 확인 | — |
| D5 | CLI 껍질 `i18nReport` 배선 4곳(WS1~WS4)이 UT·`--check` 밖 — `--i18n` 출력만 바뀐다 | **경계** — plan §11 "여섯 함수 단위" · 선언 경계 11 · M-E | — | — | — |
| D6 | W-06 agentsRule 근거 3줄 중 2줄 서술 · W-02 ui "server.ts 뿐"(무관 함수 `updater.ts`) · `none` 단위 N 의 `.ts`·`.tsx` 암묵 필터와 ±1 3건 · 문구 중복 통계(F10 ko 100·252 vs 근거 100·249 · F09 en 89·228 vs 88·223 — 명령 미기재) | **경계** — 선언 경계 2(해석 의존 · 판정 불변) | — | NON_BLOCKING | r4 에서 같이 고쳐도 됨 |
| D7 | `LegacySubAgentTile.tsx:245` 카드 키 판정이 `target === currentTarget` 을 보지 않는다(`canonicalBackground.ts:346` 은 본다) — 코드로 사실 확인 | **비귀속**(감량과 무관 · 이번 범위 밖) | — | NON_BLOCKING | — |

> 파생 이슈 1(r1 W-08)은 닫혔다 — 인용 변이 M-A `K10` red · W-08 test 정적 0 · W-12 `blocks`(E1 TS2339). D1·D2 는 plan `[검증자 기입] 파생 이슈` 2·3 으로 옮긴다.

## 10. Repository operation checks

- **대상 커밋 좌표(검증자 기입)** — 모두 `git cat-file -t` = commit. `origin/main`(=`22b39d6`) 조상: `948d9fa`·`0533f83`·`9cbffae`(설계 V1 · rev.2 · 오타) · `4c17c49`·`5be1094`(r1) · `04b3e0a`(r1 verify) · `9aff8f6`(r2) · `22b39d6`(r2 verify) 예. `4b45cb0`(rev.3 설계)·`ea33f5f`(r3 구현)는 **아니오 — 브랜치 `ccr-160f6d72-4ilo9v` 에만 있다**(main 병합 뒤 교정). INDEX 가 r2 구현 좌표로 적었던 `6714715` 는 `git cat-file` 실패 — 실제 r2 구현은 `9aff8f6`.
- INDEX: 상태 `verify/FAIL` · 다음 주체 하나(`Claude` 구현) · 라운드 3 → 4 · 비고 5줄. 보드 정합은 이번 갱신 뒤 재확인.
- trailer: `ea33f5f` 8키 파싱 · 값 허용(`Agent: claude` · `Status: implemented` · `Verified-By: pending`). 이 verify 커밋은 `Agent: claude` · `Status: verified` · `Verified-By: claude:fail` · `Next-Action: claude`.
- 재구현 턴 `[구현자 기입]` 7필드 전수 존재(r3: 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금(sweep 포함) · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals) · 강제 지점 표가 pair §10 자리 전부와 `남긴 곳`을 담음.
- 후보 표: 0317 확장 후보 1행 등록. 0315 행의 결과 갱신은 PASS 때(plan §13) — FAIL 이라 보류.

## 11. 구현자 코멘트 · 못 본 것

| 구현자 코멘트(r3) | 검증자 판단 |
|---|---|
| "rev.3 '새 구현 의무 0'이 틀렸다 — 판정을 순수 함수로 떼어 UT 7" | 선조치로 타당(구현 세부 보완·`--i18n` 바이트 동일 재현). 열거 원문은 늘지 않았다 — 이 보강이 닫지 못한 공백은 확장(D3) |
| 놓친 잠재 문제 2·3(경계 12 문장 · S-6 동치) | 재현 — S-6 동치 증명(VS15) · 경계 12 문장은 설계자 몫 |

못 본 것: W-01·W-05·W-06 의 "합치면 줄이 준다" 후 줄 수를 실제 리팩토링 diff 로 재지 않았다(전 줄 수·`printWidth` 글자 수까지만) · `chat.*` i18n 키의 main 프로세스 조립(선언 경계 10) · W-03·W-04 합쳤을 때 동작 동일성(UI `risk` 의 정의상 테스트 0) · 문구 중복 통계의 원 계산 스크립트.

## 12. Review Signals — 사실만

- 이전 라운드와 같은 축: r1 이행 결함(근거 "0건"이 재실행과 다름)과 같은 종류가 구간 근거(F06 `L5` 0 → 2)와 ≥1 N(W-02 6 → 7)에서 다시 나왔다. r2 구현 보고는 "'0건' 근거 불변식을 W-01~W-06·i18n 6건에 적용"이라 적었으나 구간 근거와 ≥1 N 은 닿지 않았다.
- verify 1·2회째는 근거 명령 전수 재실행과 UT 변이 전수를 하지 않았다(r1 열람 · r2 55키 독립 축). 이번이 처음 전수이고 W-02 7파일은 r1 이 열람에서 본 값이다.
- 관련 plan 지침: VP-02 "통과 후보 전부 + 최대 3건 N 일치" · §9 L5 "근거 칸에 쌍 또는 짝 없음". 사용자 결정 변경 근거 없음.
- 환경: `app/node_modules` 없음 → scratch 사본 `npm ci --ignore-scripts` 14초로 삭제·표식 실험. `origin/main` ref 있음(r1·r2 한계 해소).
- 독립 축(⑥) 발견: 현재 1(D2) · 이행 1(D1 — VP-02 재실행에서) · 확장 9(D3) · 경계(D4~D6) · 비귀속 1(D7).

## 13. 결론

- **FAIL(r3 → r4).** verify 3회째 — 창 밖. 3회째가 PASS 가 아니므로 **다음 재구현(r4) 착수 전 `handoff-review` 1회**.
- 고칠 것(r4): D1 W-02 `formLock` 근거의 N·파일 목록(7파일 + `opencode-runtime.test.ts`) · D2 F06 `L5` 근거의 N(2)과 `tiles.tsx` 소비자 서술 · 정정 뒤 `--write` → `--check` · `node --test` · 두 근거 문장을 포함해 audit.json 의 N 대조 명령 20개를 다시 돌려 `[구현자 기입]`에 차집합 0 기입. 판정 입력값은 바뀌지 않아야 한다.
- 후보 표로 간 확장 후보: 1행(D3). 고칠 의무·재실행 의무 없음.
- pair: REQUIRED PASS 9 · root PAIR_FAIL 1(VP-02) · BLOCKED_BY 0 · PLAN_GAP 0.
- 남은 사람 확인: AC10(W-03·W-04 UI 판정).
