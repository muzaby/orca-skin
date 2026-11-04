# Verify — 0294-slow-runner-hermetic-tests

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0294-slow-runner-hermetic-tests` |
| 검증자 | Claude Code |
| 일자 | 2026-11-04 |
| 대상 커밋/range | `5f7b63a..e7d40b4` (r1 `c00fe95`·`0c49f17` · r1.2 `f087d27`·`e7d40b4`) |
| 구현 전 plan 기준 | `5f7b63a` (V1 설계 커밋) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `5f7b63a:V1` |
| 라운드 | 1 (verify 1회째) |
| 상태 | **RETURN_TO_PLAN** |
| 자기 검증 여부 | **설계·구현·검증 모두 Claude.** 구현 보고에 없던 축 9건(X1~X9)과 §10 EP-05 분모 독립 재열거를 더했다(§4) — 재열거에서 gap이 나왔다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — 메타 `상태` 1줄과 `[구현자 기입]`만(`git diff -U0 5f7b63a..e7d40b4 -- plan.md` hunk가 `:15`·`:500` 이후뿐).
- 기준선이 diff로 성립하는가: 예 — 설계 `5f7b63a`와 구현 커밋이 분리.
- Decision Ledger·Product/UX·AC·V node/pair·§10·oracle 변경: 없음.
- 채점 기준: `5f7b63a:V1` 원문.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 상속할 V 없음(§7-A) |
| NEW node ↔ 같은 레벨 REQUIRED pair | 유효 | R-01~05·SD-01·AR-01~03·MD-01~02 ↔ VP-01~11 |
| INHERITED ↔ REGRESSION | 해당 없음 | AR-03의 (A)~(E)는 VP-09 REQUIRED에 포함 |
| pair별 §10 자리 목록 | **PLAN_GAP — VP-01·07·09 EP-05** | 기록된 검색(`scan-test-budgets.mjs` `deadline`+`setTimeout`)의 술어가 해법 형태(`setTimeout`·`Date.now()+N`)다. 불변식의 주어 "테스트 소유 실시간 마감"(D-001)으로 넓히면 목록 밖 자리 2곳 + 분류 필요 1곳(§3 D1) |
| 나머지 §10 자리 목록 재실행 차집합 | 유효 | EP-01 2 · EP-02 1 · EP-03 20(+신규 hostile 1) · EP-04 6 · EP-06 3 · EP-07 4 · EP-08 2 · EP-11 0줄 — `--report`·`rg` 재실행이 목록과 같다(§5) |
| 선택적 적대 증거 | 유효 | M1~M10·M-A~M-D 전부 등록 이유 있음 |
| `SUPERSEDED` 이관 | 해당 없음 | — |
| 운영 gate | 유효 | §7-A 6종 |

- root PLAN_GAP: **D1** — EP-05 자리 검색 술어·게이트 (H) 술어가 불변식 주어보다 좁다 → 영향 pair VP-01·VP-07·VP-09, AC7.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path / 관측 |
|---|---|---|
| D-001·D-003 | 모든 예산 = base × 3 | `vitest.config.ts` `scaleMs(BASE_*)` · setup wrapper · 픽스처 `scaleMs` — **단 AbortSignal·자식 프로세스 timeout 2자리 미배율(D1)** |
| D-002 | `ORCA_TEST_TIME_SCALE` ≥1 유한수, 그 밖 시작 실패 | `test-time.mjs:24-32` · M7 red |
| D-004 | CI 90 / release 135 · 변수 | `ci.yml:31`·`release.yml:27` · Windows CI run 41796065410 success(API 확인, head `f087d27`) |
| D-005·D-006 | 임시 HOME·XDG·Git, 하네스 변수 지움, 기대값 유지 | `test-host.mjs` → `vitest-setup.mjs` · 합성 사내 호스트 HEAD +0 / 기준 +113 |
| D-007 | 배포 기본값 고정 단언 0 | 포크 모사 HEAD +0 |
| D-008·D-009·D-011 | 스킬 무변경 · A~E 유지 · 22건 범위 밖 | `check-test-budgets.test.mjs` 기존 케이스 통과 · 실패 집합 = 기준 22 |
| D-010 | OS 빈 포트 | `loopback-callback.test.ts` `port()` · `rg "nextPort\|45211"` 0 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 정상 | 잘못된 배율 → config import throw(`test-time.test.mjs`'vitest 자체가 비정상 종료한다') |
| false success | 없음 | 격리 실패는 배선 테스트 red(X1·X3), wrapper 해제는 red(X2) |
| partial failure | 정상 | 루트 정리 실패는 삼킴 — 남는 것은 OS 임시 폴더(`vitest-setup.mjs:36-42`) |
| 다른 B 구현 | **부분** | "예산 전부 × 배율"(D-001) 중 `AbortSignal.timeout`·`execFileSync {timeout}` 형태는 배율 밖(D1) |
| 증상만 제거 | 없음 | 실제 홈 쓰기: 기준 2파일 → HEAD 0(hostile 실행 후 `find -newer` 빈 출력) |
| worst-case | 정상 | 저성능 모사 최장 케이스 92.1s = 시스템 테스트(예산 540s) · 60.0s 1건은 기준선 실패의 멈춤(기준 20.0s → 60.0s) |

## 3. 역방향 탐색

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| **목록 밖 테스트 소유 마감** `managed-mcp.cli.integration.test.ts:289` `AbortSignal.timeout(40_000)` | **미배율** | VP-01 EP-05 · D1. 같은 파일의 `:322`·`:420` 마감은 목록에 있다. X7 `못 잡음` |
| **목록 밖** `native-storage.integration.test.ts:51` `execFileSync(…, { timeout: 300000 })` | **미배율** | 같은 파일 케이스 `scaleMs(330000)`(EP-04)는 배율 → 자식이 300s에서 먼저 끊는다("더 작은 캡이 이긴다"). X8 `못 잡음` |
| `infra/net/pop3-tls.test.ts:48-49` `connectTimeoutMs: 3000`·`timeoutMs: 3000`(로컬 TLS 서버) | **분류 필요** | 테스트가 고른 production 인자 — 예산인지 의미값인지 설계자가 정한다(D1) |
| 미사용 export | 정상 | `KILL_GRACE_MS`·`RM_RETRY` export는 픽스처 내부 + `test-time.test.mjs` 소비 |
| 형제 정책 비대칭 | 정상 | `HOME`↔`USERPROFILE` 같은 값, `ProgramData`는 win32만(`test-host.test.mjs`'ProgramData 는 win32 에서만') |
| SSOT | 정상 | `rg -n "20_000\|5_000" app/vitest.config.ts app/scripts/vitest-setup.mjs` → 0, 기준값은 `test-time.mjs`만 |
| 호스트 env 키 재열거(§8 검색 재실행) | 정상 | 58종 전부 접두사 일치 · `APPDATA`·`LOCALAPPDATA` 프로덕션 사용 0(`getPath('appData')`는 electron) |
| 이중 배율 | 없음 | `rg -n "waitFor\(.*scaleMs" app/src -g '*.test.ts'` → 0 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 인용 기존 테스트: `check-test-budgets.test.mjs` 기존 (A)~(E) 유지, 삭제 6자리 음성 검색 0(구현자 기록 명령 재실행).
- 선택된 적대 증거 재측정: 등록 16(M1~M8·M10·M-A~M-D·EP06a·EP06b + AC14) 중 검출 16. M9(포크 되돌림)는 개별 되돌림 대신 포크 모사 전체 실행으로 대체(+0) — 개별 2자리는 미재현.
- 자리 미지정 등록 변이: M3·M4·M5는 각 EP 목록의 한 자리에 심음 — (F)(H) 게이트는 파일 무관 술어라 자리 대표로 충분(게이트가 전 파일 AST 스캔).
- 이전 라운드 대조: 해당 없음(최초).
- 자기검증 분모: 보고에 없던 축 X1~X9 + EP-05 분모 재열거. 재열거가 D1을 냈다.

**고장 이력**

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 | 이번 결과 | 잡은 테스트 / 근거 | 귀속 |
|---|---|---|---|---|---|---|---|---|
| M1 | `vitest.config.ts:24` | 제거 | `hookTimeout` 줄 삭제 | `test-time.test.mjs` | 신규 | 잡음 | '케이스·훅 예산 = 20_000 × 배율…' | VP-01 등록 |
| M2 | `scripts/test-time.mjs:57` | 고정값 | 객체 timeout 비배율 | 같음 | 신규 | 잡음 | 'waitFor 옵션 네 갈래' | VP-01 등록 |
| M3 | `infra/git/repository.test.ts:14` | 제거 | `scaledBudget` 래핑 삭제 | 게이트 | 신규 | 잡음 | `check-test-budgets.mjs` (F) exit 1 | VP-01 등록 |
| M4 | `infra/config/file-mutation.test.ts:251` | 고정값 | `scaleMs(45_000)`→`45_000` | 게이트 | 신규 | 잡음 | (F) | VP-01 등록 |
| M5 | `file-mutation.test.ts:222` | 고정값 | `Date.now()+scaleMs(30_000)`→`+30_000` | 게이트 | 신규 | 잡음 | (H) | VP-01 등록 |
| M6 | `temp-repo.testfixture.ts:43` | 다른 값 | 600_000→300_000 | 게이트 | 신규 | 잡음 | (G) "369000 보다 크지 않다" | VP-01 등록 |
| M7 | `test-time.mjs:28` | 뒤집기 | `< 1`→`<= 0` | `test-time.test.mjs` | 신규 | 잡음 | '1 미만·숫자 아님·무한은…' | VP-02 등록 |
| M8 | `.github/workflows/ci.yml:31` | 다른 값 | `'90'`→`'30'` | 같음 | 신규 | 잡음 | '작업 상한은 저장소 변수 또는 기존값 × 3' | VP-02 등록 |
| M10 | `scripts/test-host.mjs:12` | 다른 값 | 지움 접두사에 `ORCA_` | `test-host.test.mjs` | 신규 | 잡음 | '하네스·git 변수는 지우고 ORCA_*…' | VP-11 등록 |
| M-A | `vitest.config.ts:26` | 빈 값 | `setupFiles: []` | hostile | 신규 | 잡음 | 시스템 테스트 exit≠0 | VP-03 등록 |
| M-B | `test-host.mjs:12` | 제거 | `'OPENCODE_'` | hostile | 신규 | 잡음 | 같음(64s) | VP-03 등록 |
| M-C | `test-host.mjs:12` | 제거 | `'GIT_'` | hostile | 신규 | 잡음 | 자식 `repository.test.ts` "gpg failed to sign" | VP-03 등록 |
| M-D | `test-host.mjs:28-29` | 제거 | `HOME`·`USERPROFILE` | hostile | 신규 | 잡음 | 홈 트리 6 → 9 항목 | VP-03 등록 |
| EP06a | `temp-repo.testfixture.ts:27` | 고정값 | `KILL_GRACE_MS = 5_000` | `test-time.test.mjs` | 신규 | 잡음 | '상한·kill 유예·rm 재시도 간격…' | 새 oracle |
| EP06b | `temp-repo.testfixture.ts:46` | 고정값 | `retryDelay: 200` | 같음 | 신규 | 잡음 | 같음 | 새 oracle |
| AC14 | `features/worktrees/service.test.ts:33` | 다른 값 | `git init -b develop` | 그 파일 | 신규 | HEAD green · 기준 `5f7b63a` red | 기준 트리 '별칭 managed root… rollback' 1 failed | AC14 등록(역변이) |
| X1 | `scripts/vitest-setup.mjs:28` | 제거 | 지움 루프 삭제 | `test-environment.test.ts` | 신규 | 잡음 | '하네스 변수가 남아 있지 않다' | 재량(보고 밖) |
| X2 | `vitest-setup.mjs:33` | 호출 대체 | wrapper가 원래 옵션 전달 | 같음 | 신규 | 잡음 | '무옵션 vi.waitFor 는 … 1초를 넘겨' | 재량 |
| X3 | `test-host.mjs:30` | 제거 | `XDG_CONFIG_HOME` | 같음 | 신규 | 잡음 | 'XDG 4종은 루트 아래…' | 재량 |
| X4 | `file-mutation.test.ts`(추가) | 다른 값 | `beforeEach(fn, 5000)` | 게이트 | 신규 | 잡음 | (F) hook | 재량(형제 진입점) |
| X5 | 같음 | 다른 값 | `it('x', { timeout: 5000 }, fn)` | 게이트 | 신규 | 잡음 | (F) options 객체 | 재량(형제 진입점) |
| X6 | `check-test-budgets.mjs:257` | 제거 | 의미 대기 파일 비교 삭제 | `check-test-budgets.test.mjs` | 신규 | 잡음 | '의미 대기는 파일·값이 모두 맞을 때만…' | 재량 |
| X7 | `app/managed-mcp.cli.integration.test.ts:289` | 다른 값 | `AbortSignal.timeout(40_000)`→`(10)` | 게이트 | 신규 | **못 잡음** | 게이트 (H) 술어 밖 · 파일은 opencode 실행 파일이 없으면 skip | D1 |
| X8 | `app/harnesses/opencode/native-storage.integration.test.ts:51` | 다른 값 | `timeout: 300000`→`10` | 게이트 | 신규 | **못 잡음** | (H) 술어 밖 · `ORCA_TEST_OPENCODE_EXE` 없으면 skip | D1 |
| X9 | `file-mutation.test.ts`(추가) | 다른 값 | `const T = 30_000; setTimeout(fn, T)` | 게이트 | 신규 | **못 잡음** | (H)는 숫자 리터럴만 본다 | D1(게이트 술어) |

- 검산: 시도 25 = 잡음 21 · 못 잡음 3 · 역변이 기대대로 1(AC14). `못 잡음` 3건은 §13 D1로 이관 — 설계자가 목록·술어를 고친 뒤 다음 구현이 고친다.
- 동작 보존 추출 라운드: 아니오.
- 형제 슬롯 맞바꿈: 해당 없음 — X6이 의미 대기 파일/값 축을 대신 본다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|
| VP-10 | MD-01↔UT-01 | PASS | `test-time.test.mjs`'배율 해석' 3케이스 · M7 | EP-08 2/2 |
| VP-11 | MD-02↔UT-02 | PASS | `test-host.test.mjs` 5케이스 · M10·X3 | EP-09 순수부 |
| VP-07 | AR-01↔IT-01 | **PLAN_GAP**(EP-05) — 나머지 PASS | VP-01 좌표 공유 | EP-01~06 목록 42/42, 목록 밖 2 |
| VP-08 | AR-02↔IT-02 | PASS | `test-environment.test.ts` AC11 5케이스 · X1·X3 | EP-09 15/15 |
| VP-09 | AR-03↔IT-03 | **PLAN_GAP**(H 술어) — (A)~(G) PASS | `check-test-budgets.test.mjs` · `gate:node scripts/check-test-budgets.mjs` · M3~M6·X4~X6 | EP-03~06 목록 39/39 |
| VP-06 | SD-01↔ST-01 | PASS | `test-environment.test.ts`'자식 프로세스도 격리된 홈을 받는다' · 파일별 루트 | 1/1 |
| VP-01 | R-01↔AT-01 | **PLAN_GAP**(D1) — 목록 자리 PASS | 위 · 저성능 모사 S2 +0 | 42/42 + 목록 밖 2 |
| VP-02 | R-02↔AT-02 | PASS | `test-time.test.mjs` · Windows CI run 41796065410 success | EP-07 4/4 · EP-08 2/2 |
| VP-03 | R-03↔AT-03 | PASS | `test-environment.hostile.test.ts` · M-A~M-D · 전체 합성 호스트 HEAD +0 / 기준 +113 · HOME 새 파일 HEAD 0 / 기준 2 | EP-09 15/15 · 대표 9파일 |
| VP-04 | R-04↔AT-04 | PASS | 포크 모사(`fork-deployment.py` → 전체 스위트) HEAD +0 · 음성 검색 0 | EP-10 13/13 |
| VP-05 | R-05↔AT-06 | PASS | `loopback-callback.test.ts` 7케이스 green · `rg "nextPort\|45211"` 0 | 1/1 |

- root `PAIR_FAIL`: 없음. root `PLAN_GAP`: D1 → VP-01·07·09.
- 좌표 실행 구간: hostile 시스템 테스트는 자식 vitest가 production config·setup·reader를 그대로 지난다(mock 0). 운반 값: 호스트 키마다 구별 값(`corp-*`), Git은 파일 2종 + env 주입으로 세 축이 서로 다르다.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1·AC2·AC3·AC4 | ✅ | M1·M2·M7 · X2 · `test-environment.test.ts` |
| AC5·AC6 | ✅ | `--report` setConfig 21(목록 20 + hostile) · case 6 |
| **AC7** | ⚠️ PLAN_GAP | 목록 10/10 · 목록 밖 2 + 분류 1(D1) |
| AC8 | ✅ | M6·EP06a·EP06b · (A)~(E) 통과 |
| AC9 | ✅ | 워크플로 테스트 · M8 · run 41796065410 success |
| AC10~AC13 | ✅ | §5 VP-03·08·11 |
| AC14 | ✅ | 역변이: HEAD green · 기준 red |
| AC15 | ✅ | 포크 모사 +0 |
| AC16 | ✅ | 실패 22 = 기준 22(added 0·removed 0) · 케이스 8,324 → 8,327 = −6 + 9 · S2·합성 호스트 +0 |
| AC17 | ✅ | `rg` 0 · 7케이스 green |
| AC18 | ⚠️ 사람 실기 | — |
| AC19 | ✅ | doc-inventory ok · 문서 diff |

- 합계 재측정: `✅ 17 · ⚠️ 2 · ❌ 0 = 총 19` · 자기보고 `18/19`(e7d40b4) — **불일치: AC7**.
- 케이스 총수 표기 차: 구현 보고 8,445/8,448은 다른 계수(이번 JSON `numTotalTests` 기준 8,324/8,327). 차이(+3)는 같다.

## 7. 숫자 / 음성 기준 재측정

- `vi.waitFor` 호출: `rg -c "vi\.waitFor\(" app/src -g '*.test.ts'` → 173/52 = 설계 172/51 + 배선 테스트 1 (구현 보고와 일치) · wrapper 설치 1자리(`rg -n "vi\.waitFor\s*=" app/scripts` → 1).
- 삭제 음성 검색(EP-10) 0 · 고정 포트 검색 0.
- 상한: CI 작업 13m43s(설계 실측) × 3 < 90분.

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 것 |
|---|---|---|
| AC18 | CPU 1코어·8워커 모사 +0(6m43s) | 사내 백신·디스크 지연이 있는 실제 Windows에서 `cd app && npm test` green·소요 시간 |

## 9. 게이트 재실행

- `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` → `npm rebuild better-sqlite3`(Node ABI, `:memory:` 열기 확인).
- lint: 0 error · 2 warning(`Timeline.tsx`·`useTranscriptVirtualizer.ts`, 변경 밖) · 실행 후 `git status` 변화 없음.
- typecheck: exit 0(node·web·test).
- vitest(깨끗한 호스트, `clean-host-run.sh`): 915파일 · 8,327케이스 · 실패 22 = 기준 `5f7b63a` 22와 차집합 0.
- 합성 사내 호스트: HEAD +0 / 기준 +113 · HOME 새 파일 HEAD 0 / 기준 2(`~/.config/orcinus-orca/downloads/confluence/…`).
- 저성능 모사 S2(1코어·8워커): +0 · 6m43s. 포크 모사: +0.
- `node --test "scripts/*.test.mjs"`: 171 pass · 0 fail. `check-test-budgets`: ok. `check-doc-inventory --check`: ok. `check-migrations-appendonly`: skip(태그 없음).
- 잔여물: 검증용 worktree 2개(`scratchpad/base`·`fork`)는 정리했다. 변이는 전부 원복(`git status` clean).

## 11. Repository operation checks

- AGENTS 위생: `app/AGENTS.md` 추가 2문단 — 비밀·일회성 정보 없음, 부모 규칙과 충돌 없음.
- INDEX: 상태·다음 주체 일치(`impl/IMPL_DONE` · Claude). 대상 커밋 좌표 기입 — r1 `c00fe95`·`0c49f17`, r1.2 `f087d27`·`e7d40b4`. `git cat-file -t` = commit, `origin/main` 조상 **아님**(PR #530 미병합) → 브랜치 좌표로 표기.
- trailer: 4커밋 모두 7키 파싱(`git log -1 --format='%(trailers:only=true)'`). `Criteria-Met`은 18/19로 기록 — 재측정 17/19(AC7).
- `[구현자 기입]` 7필드: 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX·놓친 잠재 문제·구현 보고·Review Signals 모두 있음.

## 12. 구현자 코멘트 / 선조치 경계

| 코멘트 | 판단 |
|---|---|
| M-C 민감도 0 → `GIT_CONFIG_COUNT` 입력 추가 | 타당 — M-C 재현 시 자식 `repository.test.ts` gpg 실패 |
| 픽스처 상수 export | 구현 세부 보완 |
| `bootstrap.harness`에 `spawn-env` mock 추가 | 타당(포크 방어) |
| r1.2 Windows 8.3 경로 실경로화 | 타당 — run 41796065410 success |

## 13. Finding disposition

| # | finding | 귀속 | disposition | 영향 | 후속 |
|---|---|---|---|---|---|
| D1 | EP-05 자리 검색·게이트 (H)의 술어(`setTimeout`·`Date.now()+리터럴`)가 불변식 주어 "테스트 소유 실시간 마감"보다 좁다. 목록 밖 미배율 2자리 `managed-mcp.cli.integration.test.ts:289` `AbortSignal.timeout(40_000)` · `native-storage.integration.test.ts:51` `execFileSync {timeout: 300000}`, 분류 필요 1자리 `pop3-tls.test.ts:48-49`(3000). 식별자 경유 지연(X9)도 (H) 밖 | VP-01·07·09 · D-001 · AC7 | **PLAN_GAP** | 고장 이력 X7·X8·X9 `못 잡음` | 설계자: EP-05 술어(AbortSignal·자식 프로세스 `timeout` 옵션·식별자 상수 포함 여부)와 자리 목록을 고정하고 pop3 값 분류 → 다음 구현이 X7·X8(·X9) 수정 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 최초 라운드. 술어가 해법 이름이라 분모가 좁아진 형태는 SKILL §0이 인용한 0262 사례와 같은 축.
- 관련 plan 지침: `handoff-plan`의 "술어 = 불변식의 주어" 규칙이 있었다.
- 사용자 결정 변경: 없음.
- 반복 환경 한계: 리눅스 기준선 22건 · Windows 백신·디스크 지연 모사 불가 · opencode 실행 파일 의존 opt-in 테스트는 이 환경에서 skip.

## 15. 결론

- 상태: **RETURN_TO_PLAN** — verify 1회째.
- pair: PASS 8 · PLAN_GAP 3(VP-01·07·09, root D1) · PAIR_FAIL 0.
- Product/UX·ACTIVE Decision: D-001 "예산 전부" 외 충족.
- AC: `✅ 17 · ⚠️ 2(AC7 PLAN_GAP · AC18 사람 실기) · ❌ 0 = 19`.
- 운영 gate: 전부 green(lint·typecheck·vitest 기준선 동일·node·예산·인벤토리·Windows CI).
- 다음 단계: 설계자가 V1 위 ΔV1로 EP-05 §10 행·게이트 (H) 계약을 정정(별도 설계 커밋) → `plan/READY` → 구현.
