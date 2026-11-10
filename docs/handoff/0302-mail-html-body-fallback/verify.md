# Verify — 0302-mail-html-body-fallback

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
