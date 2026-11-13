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
