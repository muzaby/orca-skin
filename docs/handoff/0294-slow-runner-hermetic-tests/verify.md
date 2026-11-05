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

---

# r2 재검증 (2026-11-04)

> r1 절은 위에 그대로 둔다. 이 절은 ΔV1(`05d75ee`) 기준으로 r2 구현(`756b461`)을 채점한다.

## r2 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `05d75ee..756b461` (r2 `756b461`) |
| 구현 전 plan 기준 | `05d75ee` (ΔV1 설계 커밋) |
| V mode / 유효 V | `Baseline V + ΔV1` / `V1 + ΔV1` |
| 검증 기준 plan revision | `05d75ee:ΔV1` |
| 라운드 | 2 (verify 2회째) |
| 상태 | **RETURN_TO_PLAN** — `PAIR_FAIL` VP-12(D2)와 `PLAN_GAP` D3이 함께 있어 다음 주체는 설계자다 |
| 자기 검증 여부 | **설계·구현·검증 모두 Claude.** 보고에 없던 축 7개(Y1·Y1c·Y2·Y2b·Y5·Y5b·Y11)와 EP-05a 분모 독립 재열거를 더했다(r2-3·r2-4) — 고장 6개 중 5개를 게이트가 잡지 못했고, 정상 코드 대조 Y2b는 red로 오탐했다 |

## r2-0. 기준선 / plan validity

- 구현 커밋이 `plan.md`를 바꿨는가: 예 — `[구현자 기입]` 추가만(`git diff -U0 05d75ee..756b461 -- plan.md` hunk 1개, `@@ -827,0 +828,115 @@`).
- 기준선이 diff로 성립하는가: 예 — ΔV1 설계 `05d75ee`와 r2 `756b461`이 분리.
- Decision·AC·V node/pair·§10·oracle 변경: 없음. 채점 기준: `05d75ee:ΔV1` 원문.

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·적용 순서 | 유효 | `V1 → ΔV1`, 구 행 SUPERSEDED 표기(plan §7-B) |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | MD-03→VP-12 · AR-01a→VP-07a · AR-03a→VP-09a · AT-01a→VP-01a · AT-05→VP-13(REGRESSION) |
| SUPERSEDED 이관 | 유효 | VP-01·07·09의 AC·M1~M6 → VP-01a·07a·09a, 폐기 0 |
| EP-05a 자리 목록 재실행 | 유효 | `scan-deadlines.mjs app` 44 = 목록 44 = `--report` deadline 44, 파일:줄 차집합 0 |
| EP-05a 술어 독립 재열거 | 유효(현재 트리) | 넓힌 술어 186행 중 게이트 밖 146행 전부 비마감(r2-3) · 단축 속성·변수 경유 옵션·변수 경유 경과 식·구조 분해 기본값 형태 ≥1000ms 트리 0자리 |
| **EP-12 규칙 칸 ↔ D-012 주어** | **PLAN_GAP — D3** | P2 규칙(`expect(now 식)` · `now() + N` · `/timeout/i` 매개변수 기본값)이 형태 판정 대상이 같은 파일 바인딩(변수·구조 분해)을 거칠 때를 정하지 않는다. D-012 주어("경과 상한 단언"·"`now()` 마감"·"매개변수 기본값")는 그 형태를 덮는다 — Y5·Y5b·Y11 |
| NOT_REQUIRED 8 pair 비영향 | 유효 | r2 diff = 게이트 2파일 · 예산 10파일 · `app/AGENTS.md`(`git show --stat 756b461`) — 격리·워크플로·배포·포트 경로 0 |
| 운영 gate | 유효 | §7-B ΔV1 운영 gate 6종 |

- root PLAN_GAP: **D3** → 영향 pair VP-12·VP-01a(AC7b).

## r2-1. Product & UX / ACTIVE Decision

| Decision | 기대 결과 | 관측 |
|---|---|---|
| D-001·D-012 | 테스트 소유 마감 7형태 전부 = `scaleMs(기준값)` | 트리 44자리 중 예산 24 `scaled` · 의미 값 20 `semantic`(`--report`) |
| D-013 | 예산/의미 값 분류 · 임계 1000(abort·자식 프로세스 무임계) | 의미 값 20자리 원문 대조 — 가짜 시계 9(`adapter.test` 2 · `broker` 3 · `sync-manager` 3 · `background.monitor:254` 1) · 데이터 8 · 하한 대기 2(mtime 간격 · `test-environment:39`) · SDK 2.5s 초과 대기 1, 항목 사유와 일치 · P4 UT·M17·R-child red |
| D-014 | count 대조 · `vi.waitFor` 옵션 안 `scaleMs` red | 인라인 옵션은 red(M15) · **같은 파일 const에 담은 옵션은 green(Y2) — D2** |
| D-009 | (A)~(E) 대상 범위 불변 | `listTestFiles` = `*.test.ts`만(P1 UT) · 16 real-git suites ok |

## r2-2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | **있음(게이트)** | 단축 속성 `{ timeoutMs }`의 미배율 5000이 exit 0(Y1). 같은 값을 `{ timeoutMs: probeMs }`로 쓰면 exit 1(Y1c) |
| 반대 실패(정상 코드 red) | **있음(게이트)** | 기준값만 담은 `const opts = { timeout: 5000 }; vi.waitFor(cb, opts)`가 "테스트 소유 마감은 `scaleMs`" 위반으로 red(Y2b) — 처방을 따르면 이중 배율이 되고, 그 이중 배율은 green(Y2) |
| 다른 B 구현 | 부분 | 형태 판정이 대상 노드를 문법으로만 본다 — 값(N)만 같은 파일 const를 따라간다(`scanDeadlineSites` `resolveValue` vs `visit`) |
| 증상만 제거 | 없음 | 새 예산 18자리는 기준값 그대로 `scaleMs` 래핑(diff) · 의미 값 count 합 20 = 자리 20 |
| worst-case | 정상 | S2 최장 케이스 104.4s = hostile 시스템 테스트(예산 540s) · 60.0s 1건은 기준선 실패 `native-resources` 멈춤(기준과 같은 집합) |

## r2-3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| `scan-surface.sh 05d75ee..756b461` | 정상 | 테스트 전용 1건 `runNativeStorageFixture` — testfixture 정의상 정상. 미사용 export·형제 비대칭 0 |
| 테스트 지원 파일 범위 | 정상 | `*.testlib.ts` 4 · `*.testHarness.ts` 1은 (H′) 범위 밖이지만 시간 자리 0(`grep setTimeout\|AbortSignal\|now\|timeout` 0줄) · `*.test.tsx` 0 |
| 넓힌 술어 재열거 | 정상 | 숫자 ≥1000 + 시간 문맥(키·이름·callee·now 식) 186행 · 게이트 밖 146행(126줄) = `testTimeout`·`hookTimeout` 39 · `scaleMs` 인자 9 · 데이터 키(`durationMs`·`expiresAt`·`intervalMs` 등) 70 · `vi.waitFor` 옵션 13 · matcher 피연산자 12 · 과거 시각 `Date.now() - N` 2 · 게이트 자리와 같은 호출(`sync-manager:43` = `:40`) 1 — 실제 경과 상한 0 |
| 게이트 ↔ 자리 검색 명령 | 사본 | `scanDeadlineSites`와 `scan-deadlines.mjs`는 같은 알고리즘(차이는 `vi.waitFor` `argIndex >= 1` vs `=== 1`) — `--report` = 스캔 차집합 0은 사본 일치다. 그래서 위 넓힌 재열거로 대신 쟀다 |
| SSOT | 정상 | 기준값은 각 자리 리터럴 그대로 · 배율은 `test-time.mjs`만 |

## r2-4. 기존 테스트 / semantic 검증

- 선택된 적대 증거 재측정: ΔV1 등록 30(M5a 18 · X7′·X8′·X9′ · M11a·M11b·M15 · M12·M13·M14·M16·M17 · X6) + V1 승계(M1~M6) 전부 잡음.
- 자리 미지정 등록 변이: 없음 — ΔV1 변이 표가 자리를 적었다. "이미 배율" 6자리는 M5·EP06a + 재량 Z1~Z3로 5자리를 심었다(`file-mutation:231`은 `:222`와 같은 상수).
- 이전 라운드 대조: r1 `잡음` 21행 재실행 → 21행 잡음(**덮개 회귀 0**) · 역변이 AC14 → HEAD green 유지. r1 `못 잡음` X7·X8·X9 → X7′·X8′·X9′ 잡음.
- 자기검증 분모: 보고에 없던 축 — **같은 계약을 다른 문법 지점에서 깨기**(Y-행) + EP-05a 분모 독립 재열거(r2-3).
- 동작 보존 추출 라운드: 아니오. 형제 슬롯 맞바꿈: 해당 없음 — 의미 값 항목은 파일·값 키라 X6(파일 비교 삭제)이 같은 축을 본다.

**고장 이력** — 게이트 = `node scripts/check-test-budgets.mjs` exit·위반 수, UT = `node --test scripts/check-test-budgets.test.mjs`. 경로는 `app/` 기준.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 | 이번 결과 | 잡은 테스트 / 근거 | 귀속 |
|---|---|---|---|---|---|---|---|---|
| M5a-01 | `src/main/adapters/opencode/v1/instance-lifecycle.test.ts:5` | 고정값 | `scaleMs(1000)`→`1000` | 게이트 | 신규 | 잡음 | exit 1 · 위반 1 | VP-07a 등록 |
| M5a-02 | `…/v1/server.database-path.test.ts:75` | 고정값 | 같음 | 게이트 | 신규 | 잡음 | exit 1 · 1 | VP-07a 등록 |
| M5a-03 | `…/v1/server.test.ts:89` | 고정값 | `?? scaleMs(1000)`→`?? 1000` | 게이트 | 신규 | 잡음 | exit 1 · 1 | VP-07a 등록 |
| M5a-04·05 | `src/main/app/deployment/mail.integration.test.ts:374`·`:375` | 고정값 | `connectMs` 각각 | 게이트 | 신규 | 잡음 | 각 exit 1 · 1 | VP-07a 등록 |
| M5a-06 | `src/main/app/harnesses/opencode/native-storage.integration.test.ts:51` | 고정값 | `scaleMs(300000)`→`300000` | 게이트 | 신규 | 잡음 | exit 1 · 1 | VP-07a 등록 |
| M5a-07~09 | `…/native-storage.testfixture.ts:106`·`:190`·`:297` | 고정값 | option·abort·abort 각각 | 게이트 | 신규 | 잡음 | 각 exit 1 · 1 | VP-07a 등록 |
| M5a-10 | `src/main/app/managed-mcp.cli.integration.test.ts:289` | 고정값 | `scaleMs(40_000)`→`40_000` | 게이트 | 신규 | 잡음 | exit 1 · 1 | VP-07a 등록 |
| M5a-11~14 | `src/main/features/chat/background-tasks.test.ts:123`·`:131`·`:138`·`:163` | 고정값 | 각각 | 게이트 | 신규 | 잡음 | 각 exit 1 · 1 | VP-07a 등록 |
| M5a-15·16 | `src/main/infra/net/pop3-tls.test.ts:49`·`:50` | 고정값 | 각각 | 게이트 | 신규 | 잡음 | 각 exit 1 · 1 | VP-07a 등록 |
| M5a-17·18 | `src/renderer/src/app/boot/steps.test.ts:95`·`:96` | 고정값 | 각각 | 게이트 | 신규 | 잡음 | 각 exit 1 · 1 | VP-07a 등록 |
| X7′ | `src/main/app/managed-mcp.cli.integration.test.ts:289` | 다른 값 | abort 인자 → `10` | 게이트 | 못 잡음(X7) | 잡음 | exit 1 · 1 | D1 인용 |
| X8′ | `…/native-storage.integration.test.ts:51` | 다른 값 | 자식 프로세스 `timeout: 10` | 게이트 | 못 잡음(X8) | 잡음 | exit 1 · 1 | D1 인용 |
| X9′ | `src/main/infra/config/file-mutation.test.ts`(끝) | 다른 값 | `const T = 30_000; setTimeout(() => {}, T)` | 게이트 | 못 잡음(X9) | 잡음 | exit 1 · 1 | D1 인용 |
| M11a | `src/main/features/approvals/broker.test.ts`(끝) | 다른 값 | `{ timeoutMs: 1000 }` 1자리 추가 | 게이트 | 신규 | 잡음 | exit 1 · 1(count 3 ≠ 4) | VP-09a 등록 |
| M11b | `src/renderer/src/features/chat/lib/taskBoard.test.ts:303` | 제거 | `timeout: 30_000` 삭제 | 게이트 | 신규 | 잡음 | "count: 1 — 실제 자리 0 개" | VP-09a 등록 |
| M15 | `src/main/app/chat-turn/opencode-continuation.test.ts:60` | 다른 값 | `timeout: scaleMs(5000)` | 게이트 | 신규 | 잡음 | "`vi.waitFor` 옵션에 `scaleMs` 를 쓰지 않는다" | VP-09a 등록 |
| M3 | `src/main/infra/git/repository.test.ts:14` | 제거 | `scaledBudget` 래핑 삭제 | 게이트 | 잡음 | 잡음 | exit 1 · 1 | VP-09a 승계 |
| M4 | `file-mutation.test.ts:251` | 고정값 | `scaleMs(45_000)`→`45_000` | 게이트 | 잡음 | 잡음 | exit 1 · 1 | VP-09a 승계 |
| M5 | `file-mutation.test.ts:222` | 고정값 | `+ scaleMs(30_000)`→`+ 30_000` | 게이트 | 잡음 | 잡음 | exit 1 · 1 | VP-07a 승계 |
| M6 | `src/main/infra/git/temp-repo.testfixture.ts:43` | 다른 값 | `600_000`→`300_000` | 게이트 | 잡음 | 잡음 | exit 1 · fixture cap | VP-09a 승계 |
| M12 | `scripts/check-test-budgets.mjs:416` | 제거 | `expect(x)` 예외 삭제 | UT | 신규 | 잡음 | fail 1 'P5 — …' | VP-12 등록 |
| M13 | `scripts/check-test-budgets.mjs:493` | 제거 | `inTimeoutObject` 삭제 | UT | 신규 | 잡음 | fail 3 'P2 — option 중첩 timeouts'·'… 변수의 객체'·'실제 저장소…' | VP-12 등록 |
| M14 | `scripts/check-test-budgets.mjs:409` | 뒤집기 | `argIndex >= 1`→`=== 0` | UT·게이트 | 신규 | 잡음 | UT fail 3('P5'·'P7'·'실제 저장소') · 트리 exit 1 · 위반 14 | VP-12 등록 |
| M16 | `scripts/check-test-budgets.mjs:615` | 제거 | `BUDGET_FILE` = `*.test.ts`만 | UT | 신규 | 잡음 | fail 1 'P1 — …' · 트리 게이트는 exit 0(fixture 4자리가 모두 배율이라 판정 같음) | VP-12 등록 |
| M17 | `scripts/check-test-budgets.mjs:452` | 제거 | abort 무임계 삭제 | UT | 신규 | 잡음 | fail 1 'P4 — …' | VP-12 등록 |
| X6 | `scripts/check-test-budgets.mjs:550` | 제거 | 의미 값 파일 비교 삭제 | UT | 잡음 | 잡음 | fail 3('리터럴 마감…'·'의미 대기는 파일·값…'·'P6 — …') | VP-12 등록(r1 재실행) |
| R-method | `scripts/check-test-budgets.mjs:472` | 제거 | method 형태 분기 | UT | 신규 | 잡음 | fail 1 'P2 — method' | 구현자 재량 재실행 |
| R-child | `scripts/check-test-budgets.mjs:452` | 고정값 | 자식 프로세스 무임계 → `false` | UT | 신규 | 잡음 | fail 1 'P4 — …' | 구현자 재량 재실행 |
| M1 | `vitest.config.ts:24` | 제거 | `hookTimeout` 줄 | `test-time.test.mjs` | 잡음 | 잡음 | fail 1 | r1 재실행 |
| M2 | `scripts/test-time.mjs:58` | 고정값 | 객체 timeout 비배율 | 같음 | 잡음 | 잡음 | fail 1 | r1 재실행 |
| M7 | `scripts/test-time.mjs:28` | 뒤집기 | `< 1`→`<= 0` | 같음 | 잡음 | 잡음 | fail 2 | r1 재실행 |
| M8 | `.github/workflows/ci.yml:31` | 다른 값 | `'90'`→`'30'` | 같음 | 잡음 | 잡음 | fail 1 | r1 재실행 |
| EP06a | `temp-repo.testfixture.ts:27` | 고정값 | `KILL_GRACE_MS = 5_000` | 같음 | 잡음 | 잡음 | fail 1 | r1 재실행 |
| EP06b | `temp-repo.testfixture.ts:46` | 고정값 | `retryDelay: 200` | 같음 | 잡음 | 잡음 | fail 1 | r1 재실행 |
| M10 | `scripts/test-host.mjs:12` | 다른 값 | 지움 접두사에 `ORCA_` | `test-host.test.mjs` | 잡음 | 잡음 | fail 1 | r1 재실행 |
| X1 | `scripts/vitest-setup.mjs:27` | 제거 | 지움 루프 | `test-environment.test.ts` | 잡음 | 잡음 | '하네스 변수가 남아 있지 않다' | r1 재실행 |
| X2 | `vitest-setup.mjs:33` | 호출 대체 | wrapper가 원래 옵션 전달 | 같음 | 잡음 | 잡음 | '무옵션 vi.waitFor 는 … 1초를 넘겨' | r1 재실행 |
| X3 | `scripts/test-host.mjs:31` | 제거 | `XDG_CONFIG_HOME` | 같음 + `test-host.test.mjs` | 잡음 | 잡음 | 'XDG 4종은 루트 아래…' · test-host fail 1 | r1 재실행 |
| X4 | `file-mutation.test.ts`(끝) | 다른 값 | `beforeEach(() => {}, 5000)` | 게이트 | 잡음 | 잡음 | exit 1 · 1 | r1 재실행 |
| X5 | 같음 | 다른 값 | `it('x', { timeout: 5000 }, …)` | 게이트 | 잡음 | 잡음 | exit 1 · 1 | r1 재실행 |
| AC14 | `src/main/features/worktrees/service.test.ts:33` | 다른 값 | `git init -b develop` | 그 파일 | HEAD green | HEAD green | 11/11 — 기본 브랜치 비의존(역변이) | r1 재실행 |
| M-A | `vitest.config.ts:26` | 빈 값 | `setupFiles: []` | hostile | 잡음 | 잡음 | 자식 실패 'reuses a live OpenCode process…' | r1 재실행 |
| M-B | `test-host.mjs:12` | 제거 | `'OPENCODE_'` | hostile | 잡음 | 잡음 | 요청 목록 `/mcp` 증가 | r1 재실행 |
| M-C | `test-host.mjs:12` | 제거 | `'GIT_'` | hostile | 잡음 | 잡음 | 자식 2 failed / 118 | r1 재실행 |
| M-D | `test-host.mjs:29-30` | 제거 | `HOME`·`USERPROFILE` | hostile | 잡음 | 잡음 | 홈 트리 6 → 9 | r1 재실행 |
| Z1 | `src/main/app/artifact-sdk-live.test.ts:75` | 고정값 | `scaleMs(90_000)`→`90_000` | 게이트 | 신규 | 잡음 | exit 1 · 1 | 재량(이미 배율 자리) |
| Z2·Z3 | `managed-mcp.cli.integration.test.ts:323`·`:421` | 고정값 | 각각 리터럴 | 게이트 | 신규 | 잡음 | 각 exit 1 · 1 | 재량 |
| Y1 | `background-tasks.test.ts`(끝) | 다른 값 | `const timeoutMs = 5000` + `waitForTask(…, { timeoutMs })` | 게이트 | 신규 | **못 잡음** | exit 0 — 단축 속성은 `isPropertyAssignment`가 아니다(`:492`) | 보고 밖 축 → **D2** |
| Y1c | 같음 | 다른 값 | `const probeMs = 5000` + `{ timeoutMs: probeMs }` | 게이트 | 신규 | 잡음 | exit 1 · 1 — Y1의 대조 | 보고 밖 축 |
| Y2 | `opencode-continuation.test.ts`(끝) | 다른 값 | `const probeOpts = { timeout: scaleMs(5000) }` + `vi.waitFor(() => {}, probeOpts)` | 게이트 | 신규 | **못 잡음** | exit 0 — `hasScaleMs`가 식별자 인자만 본다(`:529`) | 보고 밖 축 → **D2** |
| Y5 | `background-tasks.test.ts`(끝) | 다른 값 | `const elapsed = Date.now() - start; expect(elapsed).toBeLessThan(5000)` | 게이트 | 신규 | **못 잡음** | exit 0 — `mentionsNow`가 `expect` 인자 원문만 본다 | 보고 밖 축 → **D3** |
| Y5b | 같음 | 다른 값 | `const start = Date.now(); const deadline = start + 5000; while (Date.now() < deadline) {}` | 게이트 | 신규 | **못 잡음** | exit 0 — `deadline` → `start + 5000` 값 해석이 null | 보고 밖 축 → **D3** |
| Y11 | 같음 | 다른 값 | `({ timeoutMs = 5000 }: {…} = {}) => …` | 게이트 | 신규 | **못 잡음** | exit 0 — 구조 분해 `BindingElement`는 `isParameter`가 아니다(`:496`) | 보고 밖 축 → **D3** |

- 정상 코드 대조(고장 아님) **Y2b**: `const probeOpts = { timeout: 5000 }; vi.waitFor(() => {}, probeOpts)` → exit 1 · 위반 1("테스트 소유 마감은 `scaleMs(기준값)`") — 기준값만 적는 §12 규칙대로의 코드가 red다(D2).
- 검산: 시도 62(M5a 18 · 인용 3 · ΔV1 게이트 3 · V1 승계 4 · UT 6 · 구현자 재량 2 · r1 재실행 17 · 검증자 재량 3 · 보고 밖 축 6) = 잡음 56 · 역변이 기대대로 1(AC14) · 못 잡음 5 · 동치 0. 대조 1(Y2b)은 따로 셌다.
- `못 잡음` 5건은 r2-13에서 D2(Y1·Y2)·D3(Y5·Y5b·Y11)으로 이관 — 현재 트리에 같은 형태의 ≥1000ms 자리는 0(r2-3).

## r2-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-12 | MD-03↔UT-03 / UT | REQUIRED | **PAIR_FAIL** (root, D2) | `check-test-budgets.test.mjs` 66/66 · M12~M17·X6·R-method·R-child 잡음 · **Y1(P2·P3)·Y2(P5·P7) 못 잡음** | EP-12 7지점: P1·P4·P6 닫힘 · P2·P3·P5·P7 규칙 칸 대비 미완 · P2 규칙 칸 자체도 D3 |
| VP-09a | AR-03a↔IT-03a / IT | REQUIRED | PASS | `gate:node scripts/check-test-budgets.mjs` exit 0 · `--report` deadline 44 = 스캔 44(차집합 0) · 넓힌 재열거 실제 상한 0 · M3·M4·M6·M11a·M11b·M15·X9′ 잡음 · Windows CI run 41850123503 'Test budget guard' success | EP-03 21(20 + hostile) · 04 6 · 05a 44 · 06 3 · 12 7 |
| VP-07a | AR-01a↔IT-01a / IT | REQUIRED | PASS | M5a 18/18 · X7′·X8′ · M1·M2·M5 · Z1~Z3 · EP06a 잡음 | EP-01 2 · 02 1 · 03 21 · 04 6 · 05a 44 · 06 3 |
| VP-13 | R-01↔AT-05 / AT | REGRESSION | PASS | clean-host 기준 `05d75ee` · HEAD `756b461` 둘 다 915파일 8,327케이스 실패 22 — `newfails` added 0 · removed 0 · S2(1코어·8워커 7m37s) added 0 · removed 0 | 바뀐 10파일: 8 green · opt-in 2 skip |
| VP-01a | R-01↔AT-01a / AT | REQUIRED | **BLOCKED_BY:VP-12** | AC1~3·5·6·7a·8 ✅(아래) · AC7b는 VP-12 root | 76 |
| VP-02~06·08·10·11 | — | NOT_REQUIRED | NOT_REQUIRED | r1 §5 좌표 실재 · 이번 라운드 M7·M8·M10·X1~X3·M-A~M-D·AC14·Windows CI로 재관측 | 비영향(r2-0) |

- root `PAIR_FAIL`: VP-12(D2). root `PLAN_GAP`: D3(EP-12 P2 규칙). 종속: VP-01a → VP-12.
- 좌표의 실행 구간: VP-12 UT는 판정 함수(`analyzeScale`·`scanBudgetSites`·`runCli`)를 production 그대로 부른다(mock 0). 운반 값: 형태마다 `5000` ↔ `scaleMs(5000)` 구별 입력 · P6은 count 1·2·3과 파일 a·b로 구별. 빠진 것은 입력 축이다 — 대상이 같은 파일 바인딩을 거치는 입력이 P2·P3·P5·P7에 없다.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1·AC2·AC3 | ✅ | M1·M2 · X2 · `node --test` 199/199 |
| AC4 | ✅ | M7 · `test-time.test.mjs` '배율 해석' |
| AC5·AC6 | ✅ | `--report` setConfig 21 scaled · case 6 scaled |
| **AC7a** | ✅ | 44 = 스캔 44 · 예산 24 · 의미 값 20(16항목 count 합 20) · M5a 18/18 · M11a·b |
| **AC7b** | ❌ | Y1·Y2 못 잡음(D2) · P2 규칙 칸 미정(D3) |
| AC8 | ✅ | M6 · EP06a·b · (A)~(E) 케이스 통과 |
| AC9 | ✅ | 워크플로 테스트 · M8 · Windows CI run 41850123503(head `756b461`) success |
| AC10~AC13 | ✅ | M10 · X1·X3 · M-A~M-D · hostile 1/1 green |
| AC14 | ✅ | 역변이 HEAD green 11/11 |
| AC15 | ✅ | r1 §5 VP-04 좌표 승계 — r2 diff가 배포 결합 13자리에 닿지 않음(`mail.integration` 변경은 `:374-375` 시간 인자) |
| AC16 | ✅ | VP-13 |
| AC17 | ✅ | `rg "nextPort\|4521[0-9]"` 0 · `loopback-callback.test.ts` 6/6(기준과 같음, 파일 diff 0) |
| AC18 | ⚠️ 사람 실기 | — |
| AC19 | ✅ | `check-doc-inventory --check` ok |
| AC19a | ✅ | `app/AGENTS.md:150` — (H′) 7형태·임계·"abort·자식 프로세스 `timeout` 은 임계가 없다"·`{file, value, count, reason}`·`*.testfixture.ts(x)` |

- 합계 재측정: `✅ 19 · ⚠️ 1(AC18) · ❌ 1(AC7b) = 총 21`.
- 자기보고 대조: 본문 `✅ 19 · ⚠️ 2 · ❌ 0` ↔ trailer `Criteria-Met: 19/21` ↔ INDEX 비고(수치 없음) — 사본끼리는 같다. 재측정과는 **불일치**: AC9 ⚠️→✅(CI 완료) · AC7b ✅→❌.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan §10 자리 목록 | 목록 자리별 확인 · oracle 좌표 | 목록 밖 발견 · 고장 이력 ID | 결과 |
|---|---|---|---|---|---|
| VP-07a·09a | EP-05a 마감 | 44 | 새 예산 18 = M5a-01~18 · 이미 배율 6 = M5·Z1~Z3·EP06a(+`:231` 같은 상수) · 의미 값 20 = 16항목 count(M11a·b) | 트리 0 — 넓힌 재열거 · 형태 검색 | PASS |
| VP-07a·09a | EP-01·02·03·04·06 | 2·1·20·6·3 | `rg testTimeout\|hookTimeout vitest.config.ts` 2 · `rg "vi\.waitFor\s*=" app/scripts` 1 · `--report` setConfig 21(목록 20 + hostile) · case 6 · 픽스처 상수 `rg` 3 · M1·M2·M3·M4·M6·EP06a·b | 없음 | PASS |
| VP-12 | EP-12 판정 | 7 | P1 M16 · P2 M13·R-method · P3 X9′ · P4 M17·R-child · P5 M12·M14 · P6 X6·M11 · P7 M15 | Y1(P2·P3) · Y2(P5·P7) → D2 · Y5·Y5b·Y11(P2 규칙 칸 밖) → D3 | PAIR_FAIL + PLAN_GAP |

- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: 없음.
- `vi.waitFor` 호출 173/52 = 설계 172/51 + 배선 테스트 1(r1과 같음).

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| lint | PASS | 0 error · 2 warning(`Timeline.tsx:57`·`useTranscriptVirtualizer.ts:22`, 변경 밖) · 실행 후 `git status` 변화 0 |
| typecheck | PASS | node·web·test 3설정 exit 0 · `error TS` 0 |
| node scripts 테스트 | PASS | `node --test "scripts/*.test.mjs"` 199 pass · 0 fail · 25 suites |
| 예산 게이트 | PASS | exit 0 · "16 real-git suites ok · all budget sites scaled" |
| 인벤토리 게이트 | PASS | `--check` generated·prose·links ok |
| vitest | PASS | 915파일 · 8,327케이스 · 실패 22 = 기준 `05d75ee` 22(added 0 · removed 0) · HOME 새 파일 0 |
| Windows CI | PASS | run 41850123503 · job `gate` windows-latest · 13m09s · 전 단계 success(Test budget guard·Lint·Typecheck·Test 포함) |
| commit trailer | PASS | `756b461` 6키 + 2 파싱 · `05d75ee` 3키 + 2 파싱 |

## r2-8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 것 |
|---|---|---|
| AC18 | S2 1코어·8워커 7m37s · added 0 | 사내 백신·디스크 지연이 있는 실제 Windows에서 `cd app && npm test` green·소요 시간 |

## r2-9. 게이트 재실행

- 설치: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` exit 0 → `npm rebuild better-sqlite3`(Node ABI, `:memory:` 열기 확인).
- 회귀 실행은 scratchpad worktree 2개(`05d75ee`·`756b461`, `node_modules` 링크)에서 했고 변이는 주 트리에서 했다 — 서로 간섭 없음.
- 잔여물: worktree 2개 제거(`git worktree list` 1행) · 변이 전부 원복(`git status` clean).

## r2-11. Repository operation checks

- AGENTS 위생: `app/AGENTS.md` 1줄 교체 — 비밀·일회성 정보 없음, (A)~(E) 서술 유지.
- INDEX: 상태·다음 주체 일치(`impl/IMPL_DONE` · Claude 검증). 자리표시자 2개를 좌표로 채움 — ΔV1 `05d75ee` · r2 `756b461`. `git cat-file -t` = commit, `origin/main` 조상 **아님**(PR #531·#532 미병합) → 브랜치 좌표. 이전 좌표 6개도 `main` 조상 아님 — 기존 표기("브랜치 좌표, `main` 미병합") 그대로 유효.
- trailer: `756b461` — Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By + Co-Authored-By·Claude-Session 파싱.
- `[구현자 기입]` r2 7필드: 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX·놓친 잠재 문제·구현 보고·Review Signals 모두 있음. 강제 지점 전수 표는 EP-05a·EP-12 행만 두고 EP-01~04·06(VP-07a·09a 분모 32자리)을 "NOT_REQUIRED 비영향"으로 한 줄에 적었다 — 그 자리는 REQUIRED pair 분모다(D4, 검증자가 위 표로 독립 재측정).

## r2-12. 구현자 코멘트 / 선조치 경계

| 코멘트 | 판단 |
|---|---|
| `runCli` 셋째 인자 `entries` | 구현 세부 — CLI 기본값 `SEMANTIC_DELAYS`, P6 UT가 주입 경로를 쓴다 |
| `listBudgetFiles` 신설 | plan "(F)(H′)용 파일 목록을 따로" 그대로 — P1 UT |
| M14 위반 14 ≠ 설계 근거 13 | 재현 14 — 분모 행이 아니라 변이 관측값, 목록 영향 없음 |
| 합성 사내 호스트·포크 모사 미재실행 | 타당 — VP-03·04 NOT_REQUIRED, r2 diff가 격리·배포 경로에 닿지 않음(r2-0) |

## r2-13. Finding disposition

| # | finding | 귀속 | disposition | 영향 | 후속 |
|---|---|---|---|---|---|
| D1 | (r1) EP-05 술어·게이트 (H)가 좁다 | VP-01·07·09 | **closed** | X7′·X8′·X9′ 잡음 · EP-05a 44 = 스캔 · pop3 2자리 `scaleMs` | — |
| D2 | (H′) 형태 판정이 같은 파일 바인딩을 따라가지 않아 규칙 칸이 덮는 두 형태를 놓친다. (a) 단축 속성 `{ timeoutMs }` + 같은 파일 const 5000 → exit 0(Y1), 키 형태는 exit 1(Y1c) — P2 "`/timeout/i` 키" · P3 "같은 파일 const". (b) const에 담은 `vi.waitFor` 옵션 — 안의 `scaleMs`는 green(Y2), 기준값만 담으면 red(Y2b) — P5 "`vi.waitFor` 옵션(둘째 인자)" 제외 · P7 · D-014 | VP-12 · AC7b · D-012·D-014 | **BLOCKING** (`PAIR_FAIL`) | 현재 트리 해당 자리 0 — 게이트가 다음 자리를 막지 못한다 | 구현: 둘째 인자 식별자를 같은 파일 const로 풀어 P5 제외·P7 판정에 쓰고, 단축 속성을 키 형태로 판정 · UT 입력 Y1·Y2·Y2b 추가 |
| D3 | EP-12 P2 규칙 칸이 형태의 **대상**이 같은 파일 바인딩을 거칠 때를 정하지 않는다 — `expect(elapsed)`(`const elapsed = Date.now() - start`, Y5) · `start + 5000`(`const start = Date.now()`, Y5b) · 구조 분해 매개변수 기본값 `{ timeoutMs = 5000 }`(Y11) 모두 exit 0. D-012 주어("경과 상한 단언"·"`now()` 마감"·"매개변수 기본값")는 덮는다. 자리 검색 명령 `scan-deadlines.mjs`도 같은 알고리즘이라 같이 놓친다 | VP-12 · AC7b · D-012 · §10 EP-12 | **PLAN_GAP** | 현재 트리 해당 자리 0(형태 검색) | 설계자: P2(·P3) 규칙 칸에 바인딩 추적 범위(now 식 변수·파생 마감·구조 분해 기본값·단축 속성)를 한 번에 정하고 UT 입력 칸·스캔 술어를 맞춘다 → 구현이 Y5·Y5b·Y11을 닫는다 |
| D4 | r2 `[구현자 기입]` 강제 지점 전수 표가 VP-07a·09a 분모의 EP-01~04·06 32자리를 행으로 두지 않고 "NOT_REQUIRED 비영향"으로 적었다 | repository operation | NON_BLOCKING | 검증자가 독립 재측정으로 닫음(r2-5 분모 표) | 다음 impl 표는 pair §10 자리 전부를 행으로 둔다 |

## r2-14. Review Signals — 사실만

- 이전 라운드와 같은 축인가: 같다 — r1 D1은 자리 술어가 형태 이름이라 좁았고, r2 D2·D3은 형태 판정이 문법 노드만 봐서 좁다. 둘 다 "D-012 주어보다 좁은 판정"이다.
- 관련 plan 지침: ΔV1 P3가 값 해석만 같은 파일 const로 넓혔고 형태 대상의 바인딩은 정하지 않았다.
- 사용자 결정 변경: 없음.
- 반복 환경 한계: opt-in 2파일 skip · 리눅스 기준선 22건 · 백신·디스크 지연 모사 불가.
- 게이트와 자리 검색 명령이 같은 알고리즘 사본이라 차집합 0이 독립 측정이 아니다 — 두 라운드 모두 검증자가 다른 방법으로 재열거했다.

## r2-15. 결론

- 상태: **RETURN_TO_PLAN** — verify 2회째. `FAIL`(D2)과 `PLAN_GAP`(D3)이 함께 있어 설계자가 먼저다.
- pair: PASS 3(VP-07a·09a·13) · PAIR_FAIL 1(VP-12) · BLOCKED_BY 1(VP-01a → VP-12) · NOT_REQUIRED 8.
- AC: `✅ 19 · ⚠️ 1(AC18) · ❌ 1(AC7b) = 21`.
- 운영 gate: 전부 PASS(lint·typecheck·node 199·예산·인벤토리·vitest 기준 동일·S2·Windows CI·trailer).
- 고장 62 = 잡음 56 · 역변이 1 · 못 잡음 5(Y1·Y2 → D2 · Y5·Y5b·Y11 → D3), 덮개 회귀 0.
- 다음 단계: 설계자가 ΔV2로 EP-12 P2·P3·P5·P7 규칙 칸·UT 입력 칸·스캔 술어를 바인딩 추적 범위까지 한 번에 고정(별도 설계 커밋) → `plan/READY` → 구현이 Y1·Y2·Y2b·Y5·Y5b·Y11을 닫는다.

---

# r3 재검증 (2026-11-05)

> r1·r2 절은 위에 그대로 둔다. 이 절은 ΔV2(`fd2507c`) 기준으로 r3 구현(`fdb3b55`)을 채점한다. 적대 입력 재현은 [`evidence/verify-r3-probes.mjs`](evidence/verify-r3-probes.mjs)(`node … app`).

## r3 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `3ff54f9..fdb3b55` (r3 `fdb3b55`) |
| 구현 전 plan 기준 | `fd2507c` (ΔV2 설계 커밋) · `3ff54f9`는 INDEX 문구 정정(plan 무변경) |
| V mode / 유효 V | `Baseline V + ΔV1 + ΔV2` / `V1 + ΔV1 + ΔV2` |
| 검증 기준 plan revision | `fd2507c:ΔV2` |
| 라운드 | 3 (verify 3회째) |
| 상태 | **RETURN_TO_PLAN** — `PAIR_FAIL` VP-12b(D5)와 `PLAN_GAP` D6이 함께 있어 다음은 설계자다. verify 3회째 비PASS라 다음 라운드 전 `handoff-review` |
| 자기 검증 여부 | **설계·구현·검증 모두 Claude.** 보고에 없던 축 셋 — EP-12b 규칙 칸 분기마다 입력 대조(분기 변이 19 · M21b) · 같은 계약을 다른 문법으로 쓴 입력 26(W) · 사각을 고친 실험 사본 게이트로 EP-05b 분모 독립 재열거(r3-0) |

## r3-0. 기준선 / plan validity

- 구현 커밋이 `plan.md`를 바꿨는가: 예 — 메타 `상태` 1줄과 `[구현자 기입]` 추가만(`git diff -U0 3ff54f9..fdb3b55 -- plan.md` hunk `@@ -15 +15 @@` · `@@ -1143,0 +1144,127 @@` · `@@ -1145,0 +1273 @@`).
- 기준선이 diff로 성립하는가: 예 — ΔV2 설계 `fd2507c`와 r3 `fdb3b55`가 분리.
- Decision·AC·V node/pair·§10·oracle 변경: 없음. 채점 기준: `fd2507c:ΔV2` 원문.

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·적용 순서 | 유효 | `V1 → ΔV1 → ΔV2`, 구 행 SUPERSEDED 표기(plan §7-C) |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | MD-03b→VP-12b · AR-03b→VP-09b · AR-01b→VP-07b · AT-01b→VP-01b · AT-05→VP-13(REGRESSION) |
| SUPERSEDED 이관 | 유효 | VP-12·09a·07a·01a의 AC·변이 → VP-12b·09b·07b·01b, 폐기 0 |
| EP-05b 자리 목록 재실행 | 유효 | `scan-deadlines-v2.mjs app` 62 = 목록 62 = `--report` deadline 62 · §7-C 대조 명령 0줄 |
| EP-05b 독립 재열거 | 유효(현재 트리) | `broad-time-lines.sh app` 326 · 겹침 60 · 나머지 266(설계와 같음) · W1~W6 사각을 고친 실험 사본 게이트 `--report` deadline 62, 원본과 diff 0줄 — 사각 형태의 트리 자리 0 |
| **EP-12b 규칙 칸 ↔ D-015·D-016** | **PLAN_GAP — D6** | P2′ 호출 대상 해석 목록("B1·B2·`promisify`·import 별칭")과 P8 now 식 목록("B(변수·대입·멤버·조건)")이 D-015("형태의 호출 대상·대상 식 … 구조 분해 … 호출 결과←반환식")보다 좁다(W4b·W4c·W4d·W5, 정상 코드 red W4·W10) · D-016 열거가 주어보다 좁다(W6 `.not` · W8 기본값 없는 매개변수 · W9 복합 대입). 시제품 스캔도 같은 입력에서 게이트와 판정이 같다 |
| NOT_REQUIRED 8 pair 비영향 | 유효 | r3 diff = `scripts/` 3파일 · `app/AGENTS.md`(`git show --stat fdb3b55`) — 격리·워크플로·배포·포트 경로 0 · (A)~(G) 함수 hunk 0 |
| 운영 gate | 유효 | §7-C ΔV2 운영 gate 6종 |

- root PLAN_GAP: **D6** → 영향 pair VP-12b · VP-01b(AC7d).

## r3-1. Product & UX / ACTIVE Decision

| Decision | 기대 결과 | 관측 |
|---|---|---|
| D-001·D-015 | 테스트 소유 마감 = `scaleMs(기준값)`, 같은 파일 바인딩을 거쳐도 | 트리 62 = 예산 24 `scaled` · 의미 값 38 `semantic`(`--report`) · Y1·Y2·Y5·Y5b·Y11 트리 삽입 exit 1 · **구조 분해 호출 대상(W4b~W4d)·now 직접 호출 반환(W5) exit 0 — D6** |
| D-016 | 형태 8 · 슬롯 · now 원천 4 · 맥락 | **`timers/promises` 별칭 없는 `setTimeout`(W1) · 다중 값 산술(W2) · 클래스 필드·대입 `timeouts` 소유(W3) exit 0 — D5** · `.valueOf()`·`\|\|=`·`o['k'] =` 등 13분기는 판정은 맞고 UT 입력이 없다(D5) |
| D-013·D-014 | 새 의미 값 7항목 count = 자리 수 | count 9·1·1·1·1·4·1 = `--report` semantic 자리 · M11c·M11d exit 1 |
| D-009 | (A)~(G) 무변경 | `git diff fd2507c..fdb3b55 -- app/scripts/check-test-budgets.mjs`에 `analyze`·`checkFixtureCap` 등 hunk 0 · "16 real-git suites ok" |

## r3-2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | **있음(게이트)** | W1 `import { setTimeout } from 'node:timers/promises'; await setTimeout(5000)` 트리 삽입 exit 0 — 전역 정규식(`check-test-budgets.mjs:520`)이 별칭 표(`:522`)보다 먼저 맞아 둘째 인자를 읽는다 |
| | | W2 `(fast ? 2 : 5) * 1000` exit 0 — 산술은 양쪽 값이 하나씩일 때만 값을 낸다(`test-budget-bindings.mjs:315`) |
| 반대 실패(정상 코드 red) | **있음(게이트, D6)** | `const { waitFor } = vi; waitFor(cb, { timeout: 5000 })` red(W4), 같은 별칭 안 `scaleMs`는 green(W4b) — r2 D2(b) 모양이 구조 분해 별칭에서 남았다 |
| 다른 B 구현 | 아니오 | r3 게이트와 시제품 스캔의 판정이 W·V 입력 15개에서 전부 같다 — 설계 규칙 칸 그대로 |
| 증상만 제거 | 없음 | 테스트 소스 diff 0 · Y-행 5 exit 1 · Y2b exit 0 |
| worst-case | 정상 | 게이트 5.5s(926파일) · CI 'Test budget guard' 5s · 순환 바인딩은 memo·busy로 끊어 트리 완주 |

## r3-3. 역방향 탐색

| 후보 | 판정 | 근거 |
|---|---|---|
| `scan-surface.sh fd2507c..fdb3b55` | 해당 없음 | "변경된 소스 파일이 없습니다" — 범위가 `app/src`라 `scripts/`는 직접 셌다 |
| 새 export 소비처 | NON_BLOCKING(N1) | `test-budget-bindings.mjs` export 4 — `createBindings`·`keyOf`는 게이트가 쓰고 `peel`·`ARITH_OPS`는 외부 참조 0(`grep -l`) |
| 게이트 ↔ 시제품 | 같은 사각 | 독립 작성인데 W·V 입력 15개 판정이 전부 같다(`scan-deadlines-v2.mjs --probe`) — 대조 명령 0줄은 두 사본의 사각까지 일치한다는 뜻이다 |
| 트리의 사각 형태 | 0 | 실험 사본 게이트 62 = 원본 62 · `timers/promises` import 0 · `.not.toBeGreaterThan` 0 · `() => Date.now()` 헬퍼 0 |

## r3-4. 기존 테스트 / semantic 검증

- 선택된 적대 증거 재측정: ΔV2 등록 M18~M38 21 · M5b 24 · M11c·M11d · Y-트리 5 + Y2b 대조 — 전부 기대대로.
- 이전 라운드 대조: r2 `못 잡음` Y1·Y2·Y5·Y5b·Y11 → 잡음(D2·D3 인용 변이 해소). r2 `잡음` 56행 재실행 → 56 잡음(M5a 18·Z1~Z3·M5는 M5b로) — **덮개 회귀 0**. 역변이 AC14 → green 유지.
- 자기검증 분모: 보고에 없던 축 — 규칙 칸 분기마다 그 분기 하나를 지우는 변이(V 19 · M21b), 같은 계약을 다른 문법으로 쓴 입력(W 26), EP-05b 분모 독립 재열거(r3-0).
- 동작 보존 추출 라운드: 아니오. 형제 슬롯 맞바꿈: 해당 없음(r2와 같다).

**고장 이력** — 게이트 = `node scripts/check-test-budgets.mjs` exit·위반 수, UT = `node --test scripts/check-test-budgets.test.mjs`. 경로는 `app/` 기준. G = `scripts/check-test-budgets.mjs`, B = `scripts/test-budget-bindings.mjs`.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 | 이번 결과 | 잡은 테스트 / 근거 | 귀속 |
|---|---|---|---|---|---|---|---|---|
| M5b-01~03 | `src/main/adapters/opencode/v1/instance-lifecycle.test.ts:5` · `server.database-path.test.ts:75` · `server.test.ts:89` | 고정값 | `scaleMs(1000)`→`1000` | 게이트 | 잡음(M5a) | 잡음 | 각 exit 1 · 1 | VP-07b 등록 |
| M5b-04 | `src/main/app/artifact-sdk-live.test.ts:75` | 고정값 | `scaleMs(90_000)`→`90_000` | 게이트 | 잡음(Z1) | 잡음 | exit 1 · 1 | VP-07b 등록 |
| M5b-05·06 | `src/main/app/deployment/mail.integration.test.ts:374`·`:375` | 고정값 | `connectMs` 각각 | 게이트 | 잡음 | 잡음 | 각 exit 1 · 1 | VP-07b 등록 |
| M5b-07~10 | `…/native-storage.integration.test.ts:51` · `native-storage.testfixture.ts:106`·`:190`·`:297` | 고정값 | 자식 프로세스·option·abort·abort | 게이트 | 잡음 | 잡음 | 각 exit 1 · 1 | VP-07b 등록 |
| M5b-11~13 | `src/main/app/managed-mcp.cli.integration.test.ts:289`·`:323`·`:421` | 고정값 | abort·timer·timer 리터럴 | 게이트 | 잡음(M5a-10·Z2·Z3) | 잡음 | 각 exit 1 · 1 | VP-07b 등록 |
| M5b-14~17 | `src/main/features/chat/background-tasks.test.ts:123`·`:131`·`:138`·`:163` | 고정값 | `scaleMs(1_000)`→`1_000` | 게이트 | 잡음 | 잡음 | 각 exit 1 · 1 | VP-07b 등록 |
| M5b-18 | `src/main/infra/config/file-mutation.test.ts:222` | 고정값 | `+ scaleMs(30_000)`→`+ 30_000` | 게이트 | 잡음(M5) | 잡음 | exit 1 · 1 | VP-07b 등록 |
| M5b-19 | `src/main/infra/git/temp-repo.testfixture.ts:43` | 고정값 | `scaleMs(600_000)`→`600_000` | 게이트 | 신규 | 잡음 | exit 1 · 위반 2((H′) named + (G) 형태) | VP-07b 등록 |
| M5b-20 | `temp-repo.testfixture.ts:27` | 고정값 | `KILL_GRACE_MS = 5_000`(`:80` timer 값) | 게이트 | 신규 | 잡음 | exit 1 · 1 | VP-07b 등록 |
| M5b-21~24 | `src/main/infra/net/pop3-tls.test.ts:49`·`:50` · `src/renderer/src/app/boot/steps.test.ts:95`·`:96` | 고정값 | 각각 리터럴 | 게이트 | 잡음 | 잡음 | 각 exit 1 · 1 | VP-07b 등록 |
| M11c | `src/main/adapters/opencode/v1/discovery-cache.poll-race.test.ts`(끝) | 다른 값 | `now += 1001` 추가 | 게이트 | 신규 | 잡음 | exit 1 · count 9 ≠ 10 | VP-09b 등록 |
| M11d | `src/main/app/deployment/mail.integration.test.ts:691` | 제거 | `now += 301_000` 삭제 | 게이트 | 신규 | 잡음 | exit 1 · count 4 ≠ 3 | VP-09b 등록 |
| Y1·Y1c·Y5·Y5b·Y11 | `background-tasks.test.ts`(끝) | 다른 값 | r2 Y-행 입력(이름만 겹치지 않게) | 게이트 | 못 잡음 ×4 · Y1c 잡음 | 잡음 | 각 exit 1 · 1 | D2·D3 인용 |
| Y2 | `src/main/app/chat-turn/opencode-continuation.test.ts`(끝) | 다른 값 | `const probeOpts = { timeout: scaleMs(5000) }` + `vi.waitFor(() => {}, probeOpts)` | 게이트 | 못 잡음 | 잡음 | exit 1 · 1 | D2 인용 |
| M18 | G`:567-571` | 제거 | 단축 속성 슬롯 | UT | 신규 | 잡음 | fail 1 'P2′ 단축 속성 — 이름 변수가 아닌 매개변수 경유' | VP-12b 등록 |
| M19 | G`:550` | 제거 | 속성·요소 대입 분기 | UT | 신규 | 잡음 | fail 4 'P2′ 속성 대입'·'??= 대입'·'timeouts 소유 객체 대입' | VP-12b 등록 |
| M20 | G`:572` | 제거 | 클래스 필드 | UT | 신규 | 잡음 | fail 1 | VP-12b 등록 |
| M21 | G`:588` | 제거 | named 변수 초기값 | UT | 신규 | 잡음 | fail 2 'P2′ named 위치 인자로 넘김'·'P5′ …' | VP-12b 등록 |
| **M21b** | G`:549` | 제거 | named **식별자 대입** | UT | 신규(보고 밖) | **못 잡음** | UT fail 0 · `let timeoutMs; timeoutMs = 5000; waitUntil(s, timeoutMs)` 1 → 0 | **D5** |
| M22 | G`:577` | 제거 | 구조 분해 기본값 슬롯 | UT | 신규 | 잡음 | fail 4 | VP-12b 등록 |
| M23 | B`:445` | 제거 | 호출 대상 해석(`hop < 0`) | UT | 신규 | 잡음 | fail 4 'setTimeout 별칭'·'AbortSignal.timeout 별칭'·'P4′ …' | VP-12b 등록 |
| M24 | B`:83` | 다른 값 | 검사기 → 이름 맵(마지막 선언) | UT | 신규 | 잡음 | fail 2 'P3′ 가림'·'실제 저장소가 계약을 지킨다' | VP-12b 등록 |
| M25 | B`:263` | 제거 | 대입 후보 | UT·게이트 | 신규 | 잡음 | UT fail 2 · 트리 exit 1 · 3 | VP-12b 등록 |
| M26 | B`:196` | 제거 | 매개변수 ← 호출 인자 | UT | 신규 | 잡음 | fail 8 | VP-12b 등록 |
| M27 | B`:288` | 제거 | 반환식 | UT | 신규 | 잡음 | fail 1 'P3′ 반환식' | VP-12b 등록 |
| M28 · M28b | B`:271` · `:273` | 제거 | 속성 접근 · 요소 접근 멤버(검증자가 둘로 나눔) | UT | 신규 | 잡음 | 각 fail 1 'P3′ 멤버 접근' · '요소 접근' | VP-12b 등록 |
| M29 | G`:456` | 호출 대체 | 자식 프로세스 판정 `objectUses` → 선언 자리 | UT | 신규 | 잡음 | fail 1 'P4′ …' | VP-12b 등록 |
| M30 | G`:451` | 호출 대체 | `usesOf(slot)` → `[slot]` | UT | 신규 | 잡음 | fail 1 'P5′ …' | VP-12b 등록 |
| M31 | G`:452` | 뒤집기 | `every` → `some` | UT·게이트 | 신규 | 잡음 | UT fail 2 · 트리 exit 1 · 1 | VP-12b 등록 |
| M32 | B`:388` | 제거 | P7′ 바인딩 해석 | UT | 신규 | 잡음 | fail 1 'P7′ …' | VP-12b 등록 |
| M33 | B`:373` | 제거 | now 바인딩 해석 | UT·게이트 | 신규 | 잡음 | UT fail 6 · 트리 exit 1 · 7 | VP-12b 등록 |
| M34 | G`:541` | 제거 | `+=` | UT·게이트 | 신규 | 잡음 | UT fail 2 · 트리 exit 1 · 6 | VP-12b 등록 |
| M35 | G`:530` | 제거 | 역방향 elapsed | UT | 신규 | 잡음 | fail 1 'P8 역방향 상한 단언' | VP-12b 등록 |
| M36 | B`:362` | 다른 값 | now 식 = 부분 트리 어디든 원천 | UT | 신규 | 잡음 | fail 1 'P8 하한 단언·호출 인자 안 now…' | VP-12b 등록 |
| M37 | G`:544` | 제거 | now 식끼리 비교 제외 | UT | 신규 | 잡음 | fail 1 | VP-12b 등록 |
| M38 | G`:499` | 제거 | 리터럴 중복 제거 | UT | 신규 | 잡음 | fail 2 'P2′ 단축 속성 (Y1)'·'P9 …' | VP-12b 등록 |
| M12·M13·M14 | G`:446` · `:564` · `:439` | 제거·제거·뒤집기 | `expect(x)` 예외 · 중첩 `timeouts` 소유 · `vi.waitFor` 제외 첫 인자로 | UT(M14 게이트) | 잡음 | 잡음 | fail 1 · 4 · 4 · M14 트리 exit 1 · 14 | ΔV1 승계 |
| M16 | G`:707` | 제거 | `BUDGET_FILE` = `*.test.ts`만 | UT | 잡음 | 잡음 | fail 1 'P1 — …' · 트리 exit 0(r2와 같음 — fixture 자리가 전부 배율) | ΔV1 승계 |
| M17 · R-child | G`:495` | 제거·고정값 | abort 무임계 · 자식 프로세스 무임계 | UT | 잡음 | 잡음 | fail 1 · 2 | ΔV1 승계 |
| X6 · R-method | G`:638` · `:523` | 제거 | 의미 값 파일 비교 · method 형태 | UT | 잡음 | 잡음 | fail 3 · 1 | ΔV1 승계 |
| M3·M4·M6 | `src/main/infra/git/repository.test.ts:14` · `file-mutation.test.ts:251` · `temp-repo.testfixture.ts:43` | 제거·고정값·다른 값 | `scaledBudget` 래핑 · `45_000` · `300_000` | 게이트 | 잡음 | 잡음 | 각 exit 1 | VP-09b 승계 |
| M11a·M11b·M15 | `broker.test.ts`(끝) · `taskBoard.test.ts:303` · `opencode-continuation.test.ts:60` | 다른 값·제거·다른 값 | `{ timeoutMs: 1000 }` 추가 · `timeout: 30_000` 삭제 · `timeout: scaleMs(5000)` | 게이트 | 잡음 | 잡음 | 각 exit 1 · 1 | VP-09b 승계 |
| X7′·X8′·X9′·X4·X5 | `managed-mcp.cli.integration.test.ts:289` · `native-storage.integration.test.ts:51` · `file-mutation.test.ts`(끝 ×3) | 다른 값 | abort `10` · 자식 `timeout: 10` · `const T = 30_000` 경유 · 훅 `5000` · `{ timeout: 5000 }` | 게이트 | 잡음 | 잡음 | 각 exit 1 · 1 | 승계 |
| M1·M2·M7·M8 | `vitest.config.ts:24` · `scripts/test-time.mjs:58`·`:28` · `.github/workflows/ci.yml:31` | 제거·고정값·뒤집기·다른 값 | r2와 같음 | `test-time.test.mjs` | 잡음 | 잡음 | fail 1 · 1 · 2 · 1 | r2 재실행 |
| EP06a·EP06b | `temp-repo.testfixture.ts:27`·`:46` | 고정값 | `5_000` · `200` | `test-time.test.mjs` | 잡음 | 잡음 | 각 fail 1 | r2 재실행 |
| M10 · X3 | `scripts/test-host.mjs:12` · `:31` | 다른 값·제거 | `ORCA_` 지움 · `XDG_CONFIG_HOME` | `test-host.test.mjs`(X3은 + `test-environment.test.ts`) | 잡음 | 잡음 | 각 fail 1 · X3 vitest exit 1 | r2 재실행 |
| X1 · X2 | `scripts/vitest-setup.mjs:27` · `:33` | 제거·호출 대체 | 지움 루프 · wrapper 원래 옵션 | `test-environment.test.ts` | 잡음 | 잡음 | 각 exit 1 | r2 재실행 |
| AC14 | `src/main/features/worktrees/service.test.ts:33` | 다른 값 | `git init -b develop` | 그 파일 | HEAD green | HEAD green | 11/11 — 역변이 | r2 재실행 |
| M-A~M-D | `vitest.config.ts:26` · `test-host.mjs:12`(×2) · `:29-30` | 빈 값·제거 | `setupFiles: []` · `OPENCODE_` · `GIT_` · `HOME`·`USERPROFILE` | hostile | 잡음 | 잡음 | 각 exit 1 · M-C 2 failed | r2 재실행 |
| V-elem | G`:550` | 제거 | 대입 대상 `o['k']` | UT | 신규(보고 밖) | **못 잡음** | UT fail 0 · `o['timeoutMs'] = 5000` 1 → 0 | **D5** |
| V-oreq | G`:380` | 제거 | `SLOT_ASSIGN`의 `\|\|=` | UT | 신규 | **못 잡음** | `opts.timeoutMs \|\|= 5000` 1 → 0 | **D5** |
| V-util | B`:474` | 다른 값 | `^(util\.)?promisify$`→`^promisify$` | UT | 신규 | **못 잡음** | `util.promisify(execFile)(c, a, { timeout: 10 })` 1 → 0 | **D5** |
| V-peel | B`:444` | 제거 | 호출 대상 래퍼 벗기기 | UT | 신규 | **못 잡음** | `;(setTimeout)(f, 5000)` 1 → 0 | **D5** |
| V-div | B`:325` | 맞바꿈 | `a / b`→`a * b` | UT | 신규 | **못 잡음** | `setTimeout(f, 1500 / 2)` 0 → 1 | **D5** |
| V-valueOf | B`:345` | 제거 | now 원천 `.valueOf()` | UT | 신규 | **못 잡음** | `new Date().valueOf() + 5000` 1 → 0 | **D5** |
| V-gte | G`:382` | 제거 | 역방향 `toBeGreaterThanOrEqual` | UT | 신규 | **못 잡음** | `expect(5000).toBeGreaterThanOrEqual(Date.now() - s)` 1 → 0 | **D5** |
| V-or | B`:282` | 제거 | `??`·`\|\|` 왼쪽 | UT | 신규 | **못 잡음** | `const t = 5000; setTimeout(f, t ?? 0)` 1 → 0 | **D5** |
| V-spreadval | B`:219` | 제거 | 객체 멤버의 전개 | UT | 신규 | **못 잡음** | `const cfg = { ...base }; cfg.delay` 1 → 0 | **D5** |
| V-satisfies · V-nonnull | B`:28` · `:29` | 제거 | 래퍼 `satisfies` · `!` | UT | 신규 | **못 잡음** | `5000 satisfies number` · `d!.ms` 각 1 → 0 | **D5** |
| V-expectx | G`:446` | 제거 | elapsed의 matcher 제외 면제(`keepMatcher`) | UT | 신규 | **못 잡음** | `expect(x).toSatisfy(() => expect(Date.now() - s).toBeLessThan(5000))` 1 → 0 | **D5** |
| V-short7 | B`:387` | 제거 | P7′ 단축 속성 → 이름 전환 | UT | 신규 | 동치 | `{ timeout }`(`const timeout = scaleMs(4000)`) 이중 배율 1 → 1 — 자식 순회(`:389`)가 단축 속성 이름에서 같은 선언에 닿는다 | 재량 |
| V-cond·V-gthis·V-cpopt·V-owner·V-ifbranch·V-setconf | B`:284` · G`:520`·`:467`·`:557`·`:443`·`:437` | 제거 | 조건식 뒤쪽 · `globalThis.` · `cp.execFile` 끝 이름 · 소유 객체 이름 · it/test 옵션 객체 제외 · `vi.setConfig` 제외 | UT | 신규 | 잡음 | 각 fail 1 | 재량 |
| **W1** | 입력(`pop3-tls.test.ts` 끝 삽입) | 다른 값 | `import { setTimeout } from 'node:timers/promises'` + `await setTimeout(5000)` | UT 함수·게이트 | 신규 | **못 잡음** | 위반 0 · 트리 exit 0 — 규칙 "`timers/promises`의 `setTimeout` 첫 인자"(ΔV1 P2) | **D5** |
| **W2 · W2b** | 입력 | 다른 값 | `(fast ? 2 : 5) * 1000` · 같은 값을 변수 경유 | 같음 | 신규 | **못 잡음** | 각 위반 0 · W2 트리 exit 0 — 규칙 "조건식 양쪽 · 산술 · 여러 값이면 값마다"(P3′ B7) | **D5** |
| **W3 · W3b** | 입력 | 다른 값 | `class F { timeouts = { connectMs: 5000 } }` · `o.timeouts = { connectMs: 5000 }` | 같음 | 신규 | **못 잡음** | 각 위반 0 · W3 트리 exit 0 — 규칙 "중첩 `timeouts` 소유"(P2′) + "`/timeout/i` 이름 속성·변수에 담긴 객체"(ΔV1 P2) | **D5** |
| **W7** | 입력 | 다른 값 | `await ((ms) => new Promise((r) => setTimeout(r, ms)))(5000)` | 같음 | 신규 | **못 잡음** | 위반 0 — 규칙 "같은 파일 함수 ← 같은 파일 호출부 위치 인자"(P3′ B4) | **D5** |
| **W4b·W4c·W4d** | 입력 | 다른 값 | 구조 분해 별칭 — `const { waitFor } = vi` 안 `scaleMs` · `const { setTimeout: st } = globalThis` · `const { timeout } = AbortSignal` | 같음 | 신규 | **못 잡음** | 각 0 · W4b 트리 exit 0 — P2′ 목록 밖 · D-015 안 | **D6** |
| **W5** | 입력 | 다른 값 | `const now = () => Date.now(); now() + 5000` | 같음 | 신규 | **못 잡음** | 0 · 트리 exit 0 — 같은 헬퍼를 변수 경유(W5b)하면 1 | **D6** |
| **W6** | 입력 | 다른 값 | `expect(Date.now() - s).not.toBeGreaterThan(5000)` | 같음 | 신규 | **못 잡음** | 0 · 트리 exit 0 — D-016 elapsed 두 방향 밖 | **D6** |
| **W8 · W9** | 입력 | 다른 값 | `function run(timeoutMs) { return prod(timeoutMs) }; run(5000)` · `let t = 500; t += 4500; setTimeout(f, t)` | 같음 | 신규 | **못 잡음** | 각 0 — D-016 슬롯·B2 연산자 열거 밖 | **D6** |
| W1n·W2c·W5b·W12~W17·W19 | 입력 | 다른 값 | namespace `timers.setTimeout` · `(x ?? 4000) + 1000` · 변수 경유 now 헬퍼 · 중첩 구조 분해 · now 멤버·대입 · 참조 혼합 · P7′ 반환 · 구조 분해 `require` · abort 상수 `10` | 같음 | 신규 | 잡음 | 각 위반 1 | 재량 |
| W11·W18·W20 | 입력 | 다른 값 | 배열 요소 `ds[0]` · `set.call(sock, 5000)` · 미선언 피연산자 산술 | 같음 | 신규 | 동치(경계) | 각 0 = 규칙 기대 0 — D-015 경계(객체 리터럴 밖 멤버 · 해석 목록 밖 호출 · 풀리지 않는 값) | 재량 |

- 정상 코드 대조(고장 아님): **Y2b** `const probeOpts2 = { timeout: 5000 }; vi.waitFor(() => {}, probeOpts2)` exit 0 ✓ · W1s `setTimeout(scaleMs(5000))`(timers/promises) 0 ✓ · **W4** `const { waitFor } = vi; waitFor(cb, { timeout: 5000 })` 위반 1(오탐) · **W10** `vi['waitFor'](cb, { timeout: 5000 })` 위반 1(오탐) — W4·W10은 D6.
- 검산: 시도 134 = M5b 24 · M11c·d 2 · Y 6 · ΔV2 판정 변이 23(등록 21 + M21b + M28b 분리) · ΔV1 승계 UT 8 · 트리 승계 11 · V1 승계 15 · 분기 변이 19 · 입력 W 26 = 잡음 103 · 역변이 기대대로 1(AC14) · 동치 4(V-short7 · W11·W18·W20) · 못 잡음 26(M21b 1 · 분기 12 · W 13).
- `못 잡음` 26 → D5 19(M21b · 분기 12 · W1·W2·W2b·W3·W3b·W7) · D6 7(W4b·W4c·W4d·W5·W6·W8·W9). 현재 트리에 같은 형태의 자리 0(r3-3).

## r3-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-12b | MD-03b↔UT-03b / UT | REQUIRED | **PAIR_FAIL** (root, D5) | `check-test-budgets.test.mjs` 104/104 · M18~M38 잡음 · Y1·Y2·Y5·Y5b·Y11 잡음 · **W1·W2·W2b·W3·W3b·W7 판정 침묵 · M21b·분기 12 UT 침묵** | EP-12b 9지점: P1·P4′·P6·P7′·P9 닫힘 · P2′·P3′·P5′·P8 미완(D5) + 규칙 칸 D6 |
| VP-09b | AR-03b↔IT-03b / IT | REQUIRED | PASS | `gate:node scripts/check-test-budgets.mjs` exit 0 · 대조 명령 0줄(62 = 62) · M11c·M11d·Y-트리 5 exit 1 · Y2b exit 0 · M3·M4·M6·M11a·M11b·M15·X9′·X4·X5 잡음 · Windows CI run 41935619856 'Test budget guard' success · W-트리 exit 0은 판정 root(VP-12b·D6) | EP-03 21(20 + hostile) · 04 6 · 05b 62 · 06 3 · 12b 9 |
| VP-07b | AR-01b↔IT-01b / IT | REQUIRED | PASS | M5b 24/24 · X7′·X8′ · M1·M2·M6 · EP06a·b 잡음 | EP-01 2 · 02 1 · 03 21 · 04 6 · 05b 62 · 06 3 |
| VP-13 | R-01↔AT-05 / AT | REGRESSION | PASS | clean-host 기준 `fd2507c` · HEAD `fdb3b55` 둘 다 915파일 8,448케이스 실패 22 — `newfails` added 0 · removed 0 · HOME 새 파일 0 · `git diff --stat fd2507c..fdb3b55 -- app/src` 0줄 | 0 |
| VP-01b | R-01↔AT-01b / AT | REQUIRED | **BLOCKED_BY:VP-12b** | AC1~3·5·6·7c·8 ✅(아래) · AC7d는 VP-12b root | 94 |
| VP-02~06·08·10·11 | — | NOT_REQUIRED | NOT_REQUIRED | r1 §5·r2-5 좌표 실재 · 이번 라운드 M7·M8·M10·X1~X3·M-A~M-D·AC14·Windows CI로 재관측 | 비영향(r3-0) |

- root `PAIR_FAIL`: VP-12b(D5). root `PLAN_GAP`: D6(EP-12b 규칙 칸). 종속: VP-01b → VP-12b.
- 좌표의 실행 구간: VP-12b UT는 `analyzeScale`·`scanBudgetSites`·`runCli`를 production 그대로 부른다(mock 0). 빠진 것은 규칙 칸이 적은 분기 중 입력이 없는 13분기(M21b·분기 12)와 규칙이 덮는 입력 6개의 판정(W1·W2·W2b·W3·W3b·W7)이다.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1·AC2·AC3 | ✅ | M1·M2 · X2 · `node --test` 237/237 |
| AC4 | ✅ | M7 · `test-time.test.mjs` '배율 해석' |
| AC5·AC6 | ✅ | `--report` setConfig 21 scaled · case 6 scaled |
| **AC7c** | ✅ | 62 = 스캔 62 · 대조 0줄 · 예산 24 = M5b 24/24 · 의미 값 38 = 23항목 count · M11c·M11d · 테스트 소스 diff 0 |
| **AC7d** | ❌ | D5(W1·W2·W2b·W3·W3b·W7 · M21b·분기 12) · D6(W4b~W9 · 오탐 W4·W10) |
| AC8 | ✅ | M6 · EP06a·b · (A)~(E) 케이스 통과 |
| AC9 | ✅ | Windows CI run 41935619856(head `fdb3b55`) gate success |
| AC10~AC13 | ✅ | M10 · X1·X3 · M-A~M-D · hostile green |
| AC14 | ✅ | 역변이 HEAD green 11/11 |
| AC15 | ✅ | r1 §5 VP-04 좌표 승계 — r3 diff가 배포 결합 자리에 닿지 않음 |
| AC16 | ✅ | VP-13 |
| AC17 | ✅ | `rg "nextPort\|4521[0-9]"` 0 |
| AC18 | ⚠️ 사람 실기 | — |
| AC19 | ✅ | `check-doc-inventory --check` ok |
| **AC19b** | ✅ | `app/AGENTS.md:150` — 바인딩 해석(`scripts/test-budget-bindings.mjs`)·경계 · 단축 속성·대입·클래스 필드·구조 분해 기본값·이름 변수 · now 원천 4종·`+=` · "참조가 **전부** 제외" |

- 합계 재측정: `✅ 19 · ⚠️ 1(AC18) · ❌ 1(AC7d) = 총 21`.
- 자기보고 대조: 본문 `✅ 19 · ⚠️ 2 · ❌ 0` ↔ trailer `Criteria-Met: 19/21` · `Criteria-Pending: AC9, AC18` ↔ INDEX 비고(수치 없음) — 사본끼리는 같다. 재측정과는 **불일치**: AC9 ⚠️→✅(CI 완료) · AC7d ✅→❌.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan §10 자리 목록 | 목록 자리별 확인 · oracle 좌표 | 목록 밖 발견 · 고장 이력 ID | 결과 |
|---|---|---|---|---|---|
| VP-07b·09b | EP-05b 마감 | 62 | 예산 24 = M5b-01~24 · 의미 값 38 = 23항목 count(`--report` semantic 38 · M11c·d) | 트리 0 — broad 나머지 266 · 실험 사본 재열거 62 | PASS |
| VP-07b·09b | EP-01·02·03·04·06 | 2·1·20·6·3 | `vitest.config.ts` testTimeout·hookTimeout 2 · `scripts/vitest-setup.mjs` `vi.waitFor =` 1 · `--report` setConfig 21(목록 20 + hostile) · case 6 · 픽스처 상수 3 · M1·M2·M3·M4·M6·EP06a·b | 없음 | PASS |
| VP-12b | EP-12b 판정 | 9 | P1 M16 · P2′ M18~M23·Y1·Y11 · P3′ M24~M28b · P4′ M29·M17·R-child · P5′ M30·M31·Y2b · P6 X6·M11c·d · P7′ M32·Y2 · P8 M33~M37·Y5·Y5b · P9 M38 | P2′ W1·W3·W3b·M21b·V-elem·V-oreq·V-util·V-peel · P3′ W2·W2b·W7·V-div·V-or·V-spreadval·V-satisfies·V-nonnull · P5′ V-expectx · P8 V-valueOf·V-gte → D5 · W4b·W4c·W4d·W5·W6·W8·W9 → D6 | PAIR_FAIL + PLAN_GAP |

- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| lint | PASS | 0 error · 2 warning(`Timeline.tsx`·`useTranscriptVirtualizer.ts`, 변경 밖) · 실행 후 `git status` 변화 0 |
| typecheck | PASS | node·web·test 3설정 exit 0 · `error TS` 0 |
| node scripts 테스트 | PASS | `node --test "scripts/*.test.mjs"` 237 pass · 0 fail · 26 suites |
| 예산 게이트 | PASS | exit 0 · "16 real-git suites ok · all budget sites scaled" · 5.5s |
| 인벤토리 게이트 | PASS | `--check` generated·prose·links ok |
| vitest | PASS | 915파일 · 8,448케이스 · 실패 22 = 기준 `fd2507c` 22(added 0 · removed 0) · HOME 새 파일 0 |
| Windows CI | PASS | run 41935619856 · job `gate` windows-latest · head `fdb3b55` · Test budget guard·Lint·Typecheck·Test success |
| commit trailer | PASS | `fdb3b55` 6키 + 2 파싱 · `fd2507c`·`3ff54f9` 3키 + 2 파싱 |

## r3-8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 것 |
|---|---|---|
| AC18 | r2 S2 1코어·8워커 실측(ΔV2·r3는 테스트 소스 diff 0) | 사내 백신·디스크 지연이 있는 실제 Windows에서 `cd app && npm test` green·소요 시간 |

## r3-9. 게이트 재실행

- 설치 상태: 기존 `node_modules` · better-sqlite3 Node ABI(`:memory:` 열기 확인).
- 회귀 실행은 scratchpad worktree 2개(`fd2507c`·`fdb3b55`, `node_modules` 링크)에서, 변이는 주 트리에서 했다 — 서로 간섭 없음. 세션 중 작업 프로세스가 한 번 재시작됐고 재개 시 `git status` clean을 확인했다.
- 잔여물: worktree 2개 제거(`git worktree list` 1행) · 변이 전부 원복(`git status` clean) · 실험 사본 게이트는 scratchpad에만 있었다.

## r3-11. Repository operation checks

- AGENTS 위생: `app/AGENTS.md:150` 1줄 교체 — 비밀·일회성 정보 없음, (A)~(G) 서술 유지.
- INDEX: 상태·다음 주체 일치(`impl/IMPL_DONE` · Claude 검증). 자리표시자 2개를 좌표로 채움 — ΔV2 `fd2507c`·`3ff54f9` · r3 `fdb3b55`. `git cat-file -t` = commit, `origin/main` 조상 **아님**(PR #534 열림) → 브랜치 좌표. 이전 좌표 9개도 `main` 조상 아님 — 기존 표기 유효.
- trailer: `fdb3b55` — Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By + Co-Authored-By·Claude-Session 파싱.
- `[구현자 기입]` r3 7필드: 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX·놓친 잠재 문제·구현 보고·Review Signals 모두 있음. 강제 지점 표가 EP-01~04·06 32자리를 행으로 둔다 — r2 D4 해소.

## r3-12. 구현자 코멘트 / 선조치 경계

| 코멘트 | 판단 |
|---|---|
| 해석기 별도 모듈 · 시제품 비복사 | plan 허용 범위 — 다만 독립 작성인데 W·V 입력 15개 판정이 시제품과 전부 같다(r3-3) |
| 확장자 없는 이름에 `.ts` | 구현 세부 — P6 UT 입력 `'a'`가 쓴다 |
| 게이트 1.4s → 5.5s | 설계 근거 "증가 수 초" 범위 · CI 'Test budget guard' 5s |
| 세션 초기 electron·better-sqlite3 복구 | 이번 세션 잔여물 없음(`git status` clean) |
| `--report` 값 열은 deadline만 | 구현 세부 — P9 UT가 값 열을 단언 |

## r3-13. Finding disposition

| # | finding | 귀속 | disposition | 영향 | 후속 |
|---|---|---|---|---|---|
| D2 | (r2) 단축 속성·const 옵션 | VP-12 | **closed** | Y1·Y2 잡음 · Y2b exit 0 | — |
| D3 | (r2) now 변수·파생 마감·구조 분해 기본값 | VP-12 · EP-12 | **closed** | ΔV2 P2′·P8 규칙 칸 · Y5·Y5b·Y11 잡음 | — |
| D4 | (r2) 강제 지점 표 EP-01~04·06 행 누락 | repository operation | **closed** | r3 표에 32/32 행 | — |
| D5 | EP-12b 규칙 칸이 덮는데 판정·UT가 못 미친다. (a) 판정: W1 `timers/promises` 별칭 없는 `setTimeout` · W2·W2b 다중 값 × 산술 · W3·W3b 클래스 필드·대입의 `timeouts` 소유 · W7 IIFE 호출부 — 모두 위반 0. (b) 분기 입력 없음: M21b(named 식별자 대입) · `o['k'] =` · `\|\|=` · `util.promisify` · 호출 대상 래퍼 · `/` · `??`·`\|\|` 왼쪽 · 전개 멤버 · `satisfies` · `!` · `.valueOf()` · 역방향 `OrEqual` · matcher 안 elapsed — 분기를 지워도 UT green | VP-12b · AC7d · EP-12b P2′·P3′·P5′·P8 · D-016 | **BLOCKING** (`PAIR_FAIL`) | 현재 트리 해당 자리 0 — 게이트가 다음 자리를 막지 못한다 | 구현: 별칭 표를 전역 정규식보다 먼저 · 산술 값 조합마다 · 소유 판정에 클래스 필드·대입 · IIFE 호출부 · 13분기마다 UT 입력(`evidence/verify-r3-probes.mjs` 입력 그대로) |
| D6 | EP-12b 규칙 칸이 D-015와 갈리거나 주어보다 좁다. (a) 호출 대상 해석 목록(P2′ "B1·B2·`promisify`·import")에 구조 분해·요소 접근이 없다 — W4b·W4c·W4d green, 정상 코드 W4·W10 red. (b) P8 now 식 "B(변수·대입·멤버·조건)"에 호출 반환이 없다 — W5 green인데 같은 헬퍼를 변수 경유(W5b)하면 red. (c) D-016 열거 밖: elapsed `.not`(W6) · 기본값 없는 `/timeout/i` 매개변수 ← 같은 파일 호출(W8) · B2 복합 대입 값(W9). 시제품 스캔도 같은 판정 | VP-12b · AC7d · D-015·D-016 · §10 EP-12b | **PLAN_GAP** | 현재 트리 해당 자리 0(실험 사본 재열거 62) | 설계자: (a)(b)를 D-015 쪽 또는 P2′·P8 쪽 하나로 맞추고 (c) 3축을 자리/경계로 정해 EP-12b 규칙·UT 입력 칸·시제품 술어를 갱신 → 구현이 W4b~W9와 W4·W10 오탐을 닫는다 |
| N1 | `test-budget-bindings.mjs`의 `peel`·`ARITH_OPS` export가 외부 소비 0 | 역방향 탐색 | NON_BLOCKING | 동작 무관 | 다음 구현이 export를 거둘 수 있다 |

## r3-14. Review Signals — 사실만

- 이전 라운드와 같은 축인가: 같다 — r1 술어(형태 이름), r2 판정(문법 노드), r3 규칙 칸 열거(해석 목록·분기 입력). 세 라운드 모두 "판정이 D-012/D-015 주어보다 좁다".
- 관련 plan 지침: ΔV2 D-015는 "식을 읽는 모든 자리 … 해석기 하나"라 적었고 EP-12b P2′·P8 칸은 해석 목록을 따로 좁게 적었다(D6). 규칙 칸 분기 13개가 UT 입력 칸에 없었다(D5).
- 사용자 결정 변경: 없음.
- 반복 환경 한계: opt-in 2파일 skip · 리눅스 기준선 22건 · 백신·디스크 지연 모사 불가 · 세션 중 작업 프로세스 재시작 1회.
- 새로 쓴 게이트와 시제품 스캔이 적대 입력 15개에서 판정이 전부 같다 — "복사하지 않는다"가 같은 사각의 공유를 막지 않았다.
- r2 vitest 기록(915파일 8,327케이스)이 같은 `app/src`(`git diff --stat f73927a fdb3b55 -- app/src` 0줄)의 이번 재측정 8,448과 다르다.

## r3-15. 결론

- 상태: **RETURN_TO_PLAN** — verify 3회째. `FAIL`(D5)과 `PLAN_GAP`(D6)이 함께 있어 설계자가 먼저다. 3회째 비PASS라 r4 전에 `handoff-review`를 수행한다.
- pair: PASS 3(VP-09b·07b·13) · PAIR_FAIL 1(VP-12b) · BLOCKED_BY 1(VP-01b → VP-12b) · NOT_REQUIRED 8.
- AC: `✅ 19 · ⚠️ 1(AC18) · ❌ 1(AC7d) = 21`.
- 운영 gate: 전부 PASS(lint·typecheck·node 237·예산·인벤토리·vitest 기준 동일·Windows CI·trailer).
- 고장 134 = 잡음 103 · 역변이 1 · 동치 4 · 못 잡음 26(D5 19 · D6 7), 덮개 회귀 0.
- 다음 단계: `handoff-review`(verify 3회째) → 설계자 ΔV3(D6 규칙 칸 정합 + D5 분기 입력 칸, 별도 설계 커밋) → `plan/READY` → 구현 r4가 못 잡음 26을 닫는다.

---

# r3 판정 정정 — review round 41 (2026-11-05)

> 새 verify가 아니다(verify 횟수 3 유지). 2026-11-05 사용자 결정으로 바뀐 발견 분류·확장 창(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`)을 r3 발견에 적용한 기록이다. r3 원문은 위에 그대로 둔다.

**정정 판정: FAIL** — 이행 결함 14건이 남고 `PLAN_GAP`은 0이다. verify 3회째라 확장 창 밖이므로 확장 후보 12건은 후보 표로 간다. 다음 주체는 구현자(r4).

| 묶음 | r3 판정 | 새 분류 | 근거 | 정정 disposition |
|---|---|---|---|---|
| M21b · V-elem · V-oreq · V-util · V-peel · V-div · V-or · V-spreadval · V-valueOf · V-gte · V-expectx (11) | D5 BLOCKING | 이행 | EP-12b 규칙 칸 원문이 분기를 글자 그대로 적음 — P2′ named "식별자 대입"·`o['k'] = v`·`\|\|=`·`util.promisify(x)`·B1 · P3′ B7 `+ - * /`·`??`/`\|\|` 양쪽·B6 전개 · P8 now 원천 4종·역방향 `OrEqual` · ΔV1 P5 "elapsed 상한 인자는 센다" | BLOCKING |
| W1 · W2 · W2b (3) | D5 BLOCKING | 이행 | ΔV1 P2 "`timers/promises`의 `setTimeout` 첫 인자" · P3′ B7 "여러 값이면 값마다 자리" | BLOCKING |
| W3 · W3b · W7 (3) | D5 BLOCKING | 확장 | 덮는다고 보려면 해석이 필요 — "이름 속성"이 클래스 필드·대입 대상을 포함하는가 · "같은 파일 호출부"가 IIFE를 포함하는가 | NEXT_HANDOFF(확장) |
| V-satisfies · V-nonnull (2) | D5 BLOCKING | 확장 | 규칙 칸은 "B1 래퍼"만 적고 `satisfies`·`!`를 열거하지 않음 — 구현이 고른 분기 | NEXT_HANDOFF(확장) |
| W4b · W4c · W4d · W5 · W6 · W8 · W9 · 오탐 W4 · W10 | D6 PLAN_GAP | 확장 | 규칙 칸 밖 — D-015 주어만 근거 · 트리 영향 0(실험 사본 재열거 62) | NEXT_HANDOFF(확장) |
| N1 | NON_BLOCKING | 비귀속 | 인접 정리 | NON_BLOCKING |

- r4 의무: 이행 결함 14건의 `못 잡음`을 닫는다 + 열거 sweep(EP-12b 규칙 칸 분기 전수 · EP-05b 62자리). 재현 입력은 [`evidence/verify-r3-probes.mjs`](evidence/verify-r3-probes.mjs)다.
- 후보 표: INDEX `## 새 handoff 후보`의 0294 행(확장 12건 + 오탐 2). 그 형태가 테스트 소스에 나타나거나 사용자가 요청할 때만 승격한다.
- verify 3회째 비PASS의 의무 `handoff-review`는 round 41로 수행됐다(`.agents/skills/handoff-review/references/regression-coverage.md`).

---

# r4 재검증 (2026-11-05)

> r1~r3 절과 r3 판정 정정은 위에 그대로 둔다. 이 절은 ΔV4(`947662e`) 기준으로 r4 구현(`b4e1b9d`, Codex)을 채점한다. 보고 밖 탐침은 [`evidence/verify-r4-probes.mjs`](evidence/verify-r4-probes.mjs)(`cd app && node ../docs/handoff/0294-slow-runner-hermetic-tests/evidence/verify-r4-probes.mjs .`).

## r4 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `947662e..b4e1b9d` (r4 `b4e1b9d`) |
| 구현 전 plan 기준 | `947662e` (ΔV4 설계 커밋) · `fedd224` (ΔV3 설계 커밋) |
| V mode / 유효 V | `Baseline V + ΔV1 + ΔV2 + ΔV3 + ΔV4` / `V1 + ΔV1~ΔV4` |
| 검증 기준 plan revision | `947662e:ΔV4` |
| 라운드 | 4 (verify 4회째) |
| 확장 창 | handoff 기준 창 밖(4회째). 단 ΔV4가 사용자 결정 ΔV라 NEW·CHANGED 노드(MD-03d·UT-03d·AR-03c·IT-03c·AT-01d) 범위는 **창 안 — ΔV4 뒤 verify 1회째** |
| 상태 | **RETURN_TO_PLAN** — `PAIR_FAIL` VP-12d(D7 이행)와 `PLAN_GAP` D8(창 안 확장)이 함께 있어 설계자가 먼저다 |
| 자기 검증 여부 | 구현 Codex · 설계·검증 Claude. 보고 밖 축(⑥): 332행 입력 목록에 없는 문법 13개(`verify-r4-probes.mjs`) — 구조 분해 원천 4종 · namespace import · `this` 생성자 대입 · 구조 분해 대입. 불일치 6 |

## r4-0. 기준선 / plan validity

- 구현 커밋이 `plan.md`를 바꿨는가: 예 — 메타 `상태`·`구현 주체` 2줄과 `[구현자 기입]` 추가만(`git diff -U0 947662e..b4e1b9d -- plan.md` hunk `@@ -15` · `@@ -20` · `@@ -1841,0 +1842,129`). Decision·AC·V·§10 변경 0. 채점 기준: `947662e:ΔV4` 원문.
- `app/AGENTS.md`는 `check-test-budgets.mjs` 항목 1줄 교체(AC19c 대상).

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V 적용 순서 | 유효 | `V1 → ΔV1 → ΔV2 → ΔV3 → ΔV4`, 구 행 SUPERSEDED 표기(§7-D·§7-E) |
| NEW/CHANGED ↔ 같은 레벨 REQUIRED | 유효 | MD-03d→VP-12d · AR-03c→VP-09c · AT-01d→VP-01d · REGRESSION VP-07b·13 |
| SUPERSEDED 이관 | 유효 | VP-12c·09b·01c → VP-12d·09c·01d, 폐기 0 |
| EP-12d 자리 목록 재실행 | 유효 | `dv3-branches.mjs .` "분기 169 · 판정 불일치 0" · `dv4-cells.mjs .` "칸 입력 163 · 판정 불일치 0" · 칸 표 행 수 91(KV 17·KD 15·KM 9·KF 5·KC 13·KN 9·KE 5·KO 5·KP 4·KA 9) |
| EP-05b 재실행 | 유효 | 대조 명령 0줄 · `--report` deadline 62(scaled 24 · semantic 38) |
| EP-13 | 유효 | `--report` UNRESOLVED·allowed 행 0 · `UNRESOLVED_ALLOWED = []` |
| 운영 gate 열거 | 유효 | §7-E 운영 gate 7종 |
| 칸 규칙 ↔ 보고 밖 입력 | **PLAN_GAP — D8** | KM06·KD01 규칙이 D-018 주어(같은 파일 선언 그래프)보다 좁다 — r4-3 Q8·Q9 |

## r4-1. Product & UX / ACTIVE Decision

| Decision | 기대 | 관측 |
|---|---|---|
| D-017·D-018 노드 종류 표 | 칸 91 판정 + 값 자리 fail-closed | 332행 기대 = 현재(탐침 불일치 0) · **표에 없는 결과 `KD05 숫자 아님`이 값 자리를 조용히 통과시킨다(D7)** |
| 게이트 소비자 문구 | `판정 불가 <칸 ID>: <칸 이름>` + 처방 | `check-test-budgets.mjs` `analyzeScale` 문구 · KA08 단언 · M51 실제 CLI stderr |
| `UNRESOLVED_ALLOWED` | 파일·칸·count·why 대조, 대상 파일 없음 위반 | `checkUnresolvedEntries` · `runCli` · KA01~KA07 · M52 count 1 exit 0 / 2 exit 1 |
| 현재 트리 | 판정 불가 0 · 허용 0 · exit 0 | `node scripts/check-test-budgets.mjs` exit 0 · `--report` UNRESOLVED 0 |

## r4-2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | **있음(D7)** | 값 자리가 표에 없는 `nonnum` 단말로 끝나는 경로 — `test-budget-bindings.mjs:495` `out.length ? out : one('nonnum', 'KD05', node)` |
| 같은 값 다른 문법의 판정 대칭 | **비대칭** | `getOpts().ms` → KM08 red, `const { ms } = getOpts()` → KD05 숫자 아님(Q1·Q1c) · `(await load()).ms` red, `const { ms } = await load()` 통과(Q3·Q3c) |
| fail-closed 과잉 | 없음 | 트리 exit 0 · 판정 불가 0 · KD08·KD10·KD12e·KF04 경계 칸 M44~M47 잡음 |
| 동시성·부분 실패 | 해당 없음 | 순수 함수 · 파일별 memo(`createBindings` 지역) |
| worst-case | 정상 | 로컬 5.25s(Node 22) · Windows CI 'Test budget guard' 9s(`05:32:25 → 05:32:34`) |

## r4-3. 역방향 탐색 · 보고 밖 축(⑥)

`scan-surface.sh 947662e..b4e1b9d` → `app/src` 변경 0. 범위 밖 변경(`app/scripts/*`)은 직접 읽었다.

| ID | 입력(요지) | 칸 근거 | 기대 | 현재 | 분류 |
|---|---|---|---:|---:|---|
| Q1 | `import { getOpts }…; const { ms } = getOpts(); setTimeout(f, ms)` | KD05 "후보마다 KV" → 원천 멤버 = 호출 결과의 멤버(KM08 red) | 1 | **0** | 이행(D7) |
| Q1c | `setTimeout(f, getOpts().ms)` (대조) | KM08 | 1 | 1 | — |
| Q2 | `for (const { ms } of cases) setTimeout(f, ms)` | KD04 "for-of 변수 → red" | 1 | **0** | 이행(D7) |
| Q2c | `for (const ms of [5000]) setTimeout(f, ms)` (대조) | KD04 | 1 | 1 | — |
| Q3 | `const { ms } = await load(); setTimeout(f, ms)` | KD05 → KV14 red | 1 | **0** | 이행(D7) |
| Q3c | `setTimeout(f, (await load()).ms)` (대조) | KV14 | 1 | 1 | — |
| Q4 | `const [ms] = pair(); setTimeout(f, ms)` | KD05 → KF05 red | 1 | **0** | 이행(D7) |
| Q5·Q6 | 객체 리터럴 원천 5000 · `scaleMs` 원천 | KD05 | 1 · 0 | 1 · 0 | — |
| Q7·Q7c | `import * as child …; child.execFileSync(…, { timeout: 500 })` · named import | KC06 · 무임계 | 1 · 1 | 1 · 1 | — |
| Q8 | `class A { ms = 500; constructor() { this.ms = 5000 } … setTimeout(f, this.ms) }` | KM06 "같은 클래스 속성 선언의 초기값" — 생성자 대입은 표에 없다 | 1(D-018 주어) | **0** | 확장(창 안 → D8) |
| Q9 | `let ms = 500; ({ ms } = { ms: 5000 }); setTimeout(f, ms)` | KD01 "같은 파일 대입 `=`" — 구조 분해 대입 대상이 드는지 해석 필요 | 1(D-018 주어) | **0** | 확장(창 안 → D8) |

- D7 근거: KD05 칸의 분류는 "후보마다 KV" 하나다 — `숫자 아님` 결과가 없다. 값 자리는 "red 칸과 표 밖 종류는 판정 불가"(§7-E 무엇이 왜). 같은 값을 멤버 접근으로 쓴 대조 Q1c·Q3c는 red다. 원천이 for-of이면 그 변수는 KD04(red) 칸이다.
- D7 잠금 부재: `:495`의 `'nonnum'`을 `'red'`로 바꾼 사본에서 `node --test scripts/check-test-budgets.test.mjs` 537/537 통과 · 트리 게이트 exit 0 — UT 입력이 이 분기에 없고 **트리 자리 0**(현재 결함 아님).
- D8 트리 실측: 테스트 소스의 구조 분해 대입 5줄(`cascadeMenuState.test.ts:98`·`:100` · `chatStore.test.ts:189`·`:668` · `chatStore.listen.test.ts:22`)은 전부 상태·핸들러 값이고 값 자리에 닿지 않는다(게이트 exit 0) · `this.<시간 이름> =` 대입 0(`rg`).
- N2(비귀속): `createBindings`가 돌려주는 `values`·`sources`·`argumentsFor`·`importAliases`의 외부 소비 0(`grep` — `check-test-budgets.mjs`는 `classify`·`calleeInfo`·`calleeName`·`isNow`·`reachesScale`·`usesOf`·`objectUses`만 쓴다). N1(`peel`·`ARITH_OPS` export)은 거둬졌다.

## r4-4. 증거 재측정 · 고장 이력

- 하한 ① 등록 변이·② 인용 변이·④ 이전 `잡음`·⑦ sweep: 구현자 spec `r4-mutations.jsonl` 중 `r4-sweep.tsv`(485행)·`r4-selected.tsv`(100행)가 인용한 변이 **245개**를 이 트리에서 다시 돌렸다(`mutate.py`, 결과 red 243 · green 2 — green은 대조 Y2b·M52-1로 기대 green, 전부 기대 일치). 원복 후 `git status` clean.
- 하한 ③ r3 이행 14건: M21b·V-elem·V-oreq·V-util·V-div·V-or·V-spreadval·V-valueOf·V-gte·V-expectx·V-peel(KV04-Parenthesized)·W1(M39)·W2·W2b(M40) — 위 재실행에 포함, 전부 잡음. `verify-r3-probes.mjs` 재실행 32행 — ok 31. W11(`const ds = [5000]; setTimeout(f, ds[0])`)만 r3 기대 0 → 결과 1이며, ΔV4 KM04(배열 리터럴 + 숫자 키 → 요소 KV)가 r3 경계 기대를 대체해 1이 맞다.
- 하한 ⑤ 형제 맞바꿈: 칸 91마다 이웃 분류(해석·숫자 아님·경계·red) 맞바꿈이 sweep `cell` 91행에 있다 — 재실행 잡음.
- 하한 ⑥: r4-3 Q1~Q9(13입력, 불일치 6).
- 덮개 회귀(④ `red → green`): 0.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 | 이번 결과 | 잡은 테스트 / 근거 | 분류 |
|---|---|---|---|---|---|---|---|---|
| r4-sweep 245 | `r4-mutations.jsonl` 각 행 | 제거·맞바꿈·고정값 | 구현자 spec 그대로 | UT · 게이트 | 잡음(구현자 r4) | 기대 일치 245/245 | 행별 결과 [`evidence/verify-r4-mutation-results.tsv`](evidence/verify-r4-mutation-results.tsv) · spec [`verify-r4-mutations.jsonl`](evidence/verify-r4-mutations.jsonl) | VP-12d·09c·07b |
| K1 | B`:495` | 다른 값 | KD05 빈 후보 `'nonnum'` → `'red'` | UT · 게이트 | 신규(보고 밖) | **못 잡음** | UT 537/537 green · 게이트 exit 0 — 분기 입력 없음 | 이행(D7) |
| Q1~Q4 | 입력(`verify-r4-probes.mjs`) | 다른 값 | 구조 분해 원천 = 호출·for-of·await·배열 | `analyzeScale` | 신규 | **못 잡음** | 위반 0(기대 1) | 이행(D7) |
| Q8 | 입력 | 다른 값 | 생성자 `this.ms =` | `analyzeScale` | 신규 | **못 잡음** | 위반 0 | 확장(D8) |
| Q9 | 입력 | 다른 값 | 구조 분해 대입 | `analyzeScale` | 신규 | **못 잡음** | 위반 0 | 확장(D8) |

## r4-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-12d | MD-03d↔UT-03d / UT | REQUIRED | **PAIR_FAIL** (root, D7) | `check-test-budgets.test.mjs` — ΔV3 describe '분기 목록 (0294 ΔV3)' · ΔV4 describe '노드 종류 표 (0294 ΔV4)'에 신설·칸 ID 327/332 케이스명 실재(나머지 T05~T09는 기존 케이스명 행) · 탐침 불일치 0 · sweep 재실행 기대 일치 245/245 · **KD05 빈 후보 분기가 표에 없는 `숫자 아님`(Q1~Q4 · K1)** | EP-12d 9지점 · 칸 91 · 입력 332 — KD05 칸 미완 |
| VP-09c | AR-03c↔IT-03c / IT | REQUIRED | PASS | `gate:node scripts/check-test-budgets.mjs` exit 0 · 대조 명령 0줄 · UNRESOLVED 0 · M51 exit 1(`판정 불가 KF05`) · M52 count 1 exit 0 / 2 exit 1 · M11c·M11d · Windows CI run 41974447156(head `b4e1b9d`) 'Test budget guard' success | EP-03 20 · 04 6 · 05b 62 · 06 3 · 12d 9 · 13 0 |
| VP-07b | AR-01b↔IT-01b / IT | REGRESSION | PASS | M5b 24 각 실제 CLI exit 1(재실행) · M1·M2·M6·EP06 잡음 | 94 |
| VP-13 | R-01↔AT-05 / AT | REGRESSION | PASS | Windows CI run 41974447156 'Test' success(head `b4e1b9d`) · `git diff --stat 947662e..b4e1b9d -- app/src app/vitest.config.ts app/scripts/{vitest-setup,test-time,test-host}.mjs app/package.json .github` 0줄 — vitest가 읽는 파일 무변경 | 0 |
| VP-01d | R-01↔AT-01d / AT | REQUIRED | **BLOCKED_BY:VP-12d** | AC1~3·5·6·7c·8 ✅(아래) · AC7f는 VP-12d root | 94 |
| VP-02~06·08·10·11 | — | NOT_REQUIRED | NOT_REQUIRED | 관련 코드 diff 0 · Windows CI Test success로 재관측 | 비영향 |

- 좌표의 실행 구간: VP-12d UT는 `analyzeScale`·`scanBudgetSites`·`runCli`를 production 그대로 부른다(mock 0). 실행 구간 밖은 KD05 빈 후보 분기(입력 0)다.
- Linux 전체 실행은 이번 턴에 돌리지 않았다 — 같은 head의 Windows CI 전체 Test가 VP-13 좌표다. 구현자 Linux 실패 26(기준 22 + 4)은 같은 `app/src`의 환경 차이로 판단하며 재현하지 않았다.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1·AC2·AC3 | ✅ | `node --test scripts/*.test.mjs` 670/670 · M1·M2 재실행 잡음 |
| AC4 | ✅ | `test-time.test.mjs` 통과 · 관련 코드 diff 0 |
| AC5·AC6 | ✅ | `--report` setConfig 21 scaled · case 6 scaled |
| AC7c | ✅ | 대조 0줄 · deadline 62 = 24 + 38 · M5b 24 |
| **AC7f** | ❌ | D7 — KD05 칸이 표에 없는 결과로 값 자리를 통과시킨다(Q1~Q4) |
| AC8 | ✅ | M6·EP06 재실행 잡음 |
| AC9 | ✅ | Windows CI run 41974447156 `gate` success(head `b4e1b9d`, windows-latest) |
| AC10~AC13 | ✅ | 같은 CI Test success — `test-environment.hostile.test.ts`(skip 없음) 포함 · 관련 코드 diff 0 |
| AC14·AC15·AC17·AC19 | ✅ | 관련 코드 diff 0 · 인벤토리 `--check` ok · Windows CI Test success |
| AC16 | ✅ | VP-13 |
| AC18 | ⚠️ 사람 실기 | — |
| AC19c | ✅ | `app/AGENTS.md:150` — 노드 종류 표 정본 링크 · fail-closed · 판정 불가 처방 · `UNRESOLVED_ALLOWED {file, reason, count, why}` · 경계 칸 4종 |

- 합계 재측정: `✅ 19 · ⚠️ 1(AC18) · ❌ 1(AC7f) = 총 21`.
- 자기보고 대조: 본문 `✅ 17 · ⚠️ 4 · ❌ 0` = trailer `Criteria-Met: 17/21` · `Criteria-Pending` 4항목 — 사본끼리 같다. 재측정과 불일치: AC9·12·13 ⚠️→✅(Windows CI 완료) · AC7f ✅→❌.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | 자리 목록 | 자리별 확인 · oracle | 목록 밖 발견 | 결과 |
|---|---|---|---|---|---|
| VP-07b·09c | EP-01·02·03·04·06 | 2·1·20·6·3 | `--report` setConfig 21(목록 20 + hostile) · case 6 · 구현자 EP03·EP04·EP06 변이 재실행 잡음 | 없음 | PASS |
| VP-07b·09c | EP-05b | 62 | 대조 0줄 · M5b 24 · semantic 38 | 없음 | PASS |
| VP-09c | EP-13 | 0항목 | `--report` UNRESOLVED·allowed 0 | 없음 | PASS |
| VP-12d | EP-12d | 9지점 · 칸 91 · 입력 332 | 칸 입력 163 + 분기 169 단언 · sweep 재실행 | KD05 빈 후보 분기(D7) · KM06·KD01 범위(D8) | PAIR_FAIL |

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| lint | PASS | 0 error · 2 warning(변경 밖) · 실행 후 `git status` 변화 0 |
| typecheck | PASS | node·web·test exit 0 · `error TS` 0 |
| node scripts 테스트 | PASS | 670 pass · 0 fail · 29 suites |
| 분기·칸 탐침 | PASS | 169 · 163 불일치 0 |
| 예산·인벤토리 | PASS | exit 0 · 5.25s · 대조 0줄 · UNRESOLVED 0 · `--check` ok |
| vitest | PASS(CI 좌표) | Windows CI run 41974447156 Test success · vitest 입력 파일 diff 0 |
| Windows CI | PASS | run 41974447156 · job `gate` · head `b4e1b9d` · 14m |
| commit trailer | PASS | `b4e1b9d` Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By 6키 파싱 · 값 허용 범위 |

## r4-8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 것 |
|---|---|---|
| AC18 | r2 S2 1코어·8워커 실측(이후 테스트 소스 diff 0) | 사내 백신·디스크 지연 Windows에서 `cd app && npm test` green·소요 시간 |

## r4-9. 게이트 재실행

- 설치: `npm ci --ignore-scripts` + `npm rebuild better-sqlite3`(Node 22.23.4) — 코드 파일 해시 4개가 `r4-gates.json` `code_sha256`과 같다.
- 변이는 주 트리에서 순차 실행했고 탐침·게이트는 변이 종료 뒤에 돌렸다. 잔여물: `git status` clean(증거 파일 2개 추가만).

## r4-11. Repository operation checks

- AGENTS 위생: `app/AGENTS.md:150` 1줄 교체 — 비밀·일회성 정보 없음, (A)~(G) 서술 유지 · 상대 링크 `../docs/handoff/…/plan.md` 해석(인벤토리 links ok).
- INDEX: 상태·다음 주체 일치(`impl/IMPL_DONE` · Claude). 자리표시자 → r4 `b4e1b9d`(`git cat-file -t` commit). `main` 조상 아님 — 0294 사슬은 PR #530(head `b4e1b9d`, 열림)에 쌓여 있고 #531~#535는 그 사슬 브랜치로 병합됐다 → 브랜치 좌표. 이전 좌표 표기 유지.
- `[구현자 기입]` r4 7필드 전부 있음 · 강제 지점 표가 EP-01~04·06·05b·12d·13 행을 둔다.
- trailer: 위 gate 행. Criteria 사본(본문·trailer·INDEX 비고 "17/21") 일치.

## r4-13. Finding disposition

| # | finding | 귀속 | disposition | 영향 | 후속 |
|---|---|---|---|---|---|
| D5 | (r3) EP-12b 이행 14건 | VP-12b → VP-12d | **closed** | 인용 변이 14 재실행 잡음 · 분기 탐침 불일치 0 | — |
| D7 | KD05 칸에 표에 없는 결과 `숫자 아님` — 원천이 호출·`await`·for-of·배열 요소면 값 자리가 통과(Q1~Q4) · 분기 UT 입력 0(K1) | VP-12d · AC7f · EP-12d KD05·KD04 | **BLOCKING** (`PAIR_FAIL`) | 트리 자리 0 | 구현: 빈 후보를 원천 식의 KV 판정으로(호출 → KF05·`await` → KV14·for-of → KD04 등) · Q1~Q4 + 객체 리터럴 대조를 UT 입력으로 |
| D8 | KM06(생성자 `this.x =` 대입)·KD01(구조 분해 대입 `({ x } = …)`)이 D-018 주어보다 좁다 — Q8·Q9 위반 0 | VP-12d · AC7f · D-018 · EP-12d KM06·KD01 | **PLAN_GAP** (창 안 확장) | 트리 자리 0 | 설계자: 두 형태를 칸으로 채택하거나 경계로 선언 |
| N2 | `createBindings` 반환의 `values`·`sources`·`argumentsFor`·`importAliases` 외부 소비 0 | 역방향 탐색 | NON_BLOCKING | 동작 무관 | 다음 구현이 거둘 수 있다 |
| N1 | (r3) `peel`·`ARITH_OPS` export | — | **closed** | `grep "^export" test-budget-bindings.mjs` → `keyOf`·`createBindings`만 | — |

## r4-14. Review Signals — 사실만

- 같은 축인가: 같다 — r1~r3과 마찬가지로 "판정이 Decision 주어보다 좁다". 이번에는 표 자체가 아니라 구현이 표에 없는 결과(`KD05 숫자 아님`)를 만든 곳 1개(D7)와 표 칸 범위 2개(D8).
- 관련 plan 지침: ΔV4 "값 자리는 fail-closed — red 칸과 표 밖 종류는 판정 불가" · KD05 "후보마다 KV".
- 사용자 결정 변경: 없음(ΔV4가 사용자 결정, 이번 턴 변경 0).
- 반복 환경 한계: AC18 사람 실기 · Linux 전체 실행 기준선(구현자 26 · r3 22).
- 독립 축(⑥) 발견: 6입력 — 이행 4(D7) · 확장 2(D8).
- 구현 주체가 Codex로 바뀐 첫 라운드다. 구현자 sweep 485행의 변이를 그대로 다시 돌리면 기대 일치 245/245이고, 발견 6건은 모두 그 목록 밖 입력에서 나왔다.

## r4-15. 결론

- 상태: **RETURN_TO_PLAN** — verify 4회째. `FAIL`(D7)과 `PLAN_GAP`(D8)이 함께 있어 설계자가 먼저다. 4회째라 review 의무 없음(3·6회째).
- pair: PASS 3(VP-09c·07b·13) · PAIR_FAIL 1(VP-12d) · BLOCKED_BY 1(VP-01d → VP-12d) · NOT_REQUIRED 8.
- AC: `✅ 19 · ⚠️ 1(AC18) · ❌ 1(AC7f) = 21`.
- 운영 gate: 전부 PASS.
- 고장: 재실행 245(기대 일치 245/245) · 보고 밖 7(K1 + Q1~Q4 + Q8·Q9 = 못 잡음 7 — 이행 5 · 확장 2), 덮개 회귀 0.
- 다음 단계: 설계자 ΔV5(D8 채택/경계 — ΔV4 창 안 마지막 1회 남음, 별도 설계 커밋) → `plan/READY` → 구현 r5가 D7(K1·Q1~Q4)과 채택된 D8 칸을 닫는다.

---

# r5 재검증 (2026-11-05)

> r1~r4 절은 위에 그대로 둔다. 이 절은 ΔV5(`80a0cfe`) 기준으로 r5 구현(`aac291f`, Claude)을 채점한다. 보고 밖 탐침은 [`evidence/verify-r5-probes.mjs`](evidence/verify-r5-probes.mjs)(`cd app && node ../docs/handoff/0294-slow-runner-hermetic-tests/evidence/verify-r5-probes.mjs .`).

## r5 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `80a0cfe..aac291f` (r5 `aac291f` — `origin/main` 조상) |
| 구현 전 plan 기준 | `80a0cfe` (ΔV5 설계 커밋) · `cb2b79e` (ΔV4 설계 커밋, `main` 좌표) |
| V mode / 유효 V | `Baseline V + ΔV1~ΔV5` / `V1 + ΔV1~ΔV5` |
| 검증 기준 plan revision | `80a0cfe:ΔV5` |
| 라운드 | 5 (verify 5회째) |
| 확장 창 | handoff 기준 창 밖(5회째). ΔV4(사용자 결정) 노드 범위 MD-03·UT-03·AR-03c·IT-03c·AT-01은 **창 안 — ΔV4 뒤 verify 2회째(마지막)**. ΔV5는 설계자 ΔV라 창을 새로 열지 않는다 |
| 상태 | **RETURN_TO_PLAN** — `PAIR_FAIL` VP-12e(D9 이행)와 `PLAN_GAP` D10(plan 내부 불일치)·D11(창 안 확장)이 함께 있어 설계자가 먼저다 |
| 자기 검증 여부 | 구현·설계·검증 모두 Claude(세션 분리). 보고 밖 축(⑥): 368행 입력·r5 sweep 밖 문법 26개(`verify-r5-probes.mjs`) — 증감·구조 분해 대입의 선언 종류 · 혼합 원천 구조 분해 · 멤버 대입 뒤 구조 분해 읽기 · 멤버 `&&=`·배열 패턴 대상 · 클래스 식. 불일치 11 |

## r5-0. 기준선 / plan validity

- 구현 커밋이 `plan.md`를 바꿨는가: 예 — 메타 `상태` 1줄 · `@@ -20` 1줄 · `[구현자 기입]` r5 7절 추가(`git diff -U0 80a0cfe..aac291f -- plan.md` hunk `@@ -15` · `@@ -20` · `@@ -2127,0 +2128,119`). Decision·AC·V·§10 변경 0. 채점 기준: `80a0cfe:ΔV5` 원문.
- 좌표 교정: r4 `b4e1b9d`·ΔV4 `947662e`는 PR #530 브랜치 해시이고 `main`에는 `3d5c16f`(r4)·`cb2b79e`(ΔV4)로 도착했다(`git merge-base --is-ancestor` 성공, 같은 커밋 제목).

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V 적용 순서 | 유효 | `V1 → ΔV1 → … → ΔV5`, ΔV4 행 SUPERSEDED 표기(§7-E `→ ΔV5`) |
| NEW/CHANGED ↔ 같은 레벨 REQUIRED | 유효 | MD-03e→VP-12e · AT-01e→VP-01e · REGRESSION VP-09c·07b·13 |
| SUPERSEDED 이관 | 유효 | VP-12d·01d → VP-12e·01e, 폐기 0 |
| EP-12e 자리 목록 재실행 | 유효 | `dv3-branches.mjs .` 169 · `dv4-cells.mjs .` 163 · `dv5-cells.mjs .` 36 — 판정 불일치 0 |
| EP-05b·EP-13 | 유효 | 대조 명령 0줄 · `--report` deadline 62(scaled 24 · semantic 38) · UNRESOLVED 0 · `UNRESOLVED_ALLOWED = []` |
| D-019 ↔ §7-F KD05 칸 | **PLAN_GAP — D10** | D-019 "KD05 '원천 멤버'는 원천 식을 KM 표로 판정한 결과" ↔ KD05 칸 "후보마다 KV. **후보가 없으면** 원천 식을 KM 표로" — 후보가 있을 때 KM10 대입·비리터럴 원천이 드는지 두 문장이 갈린다(r5-3 R5·R6·R7b·R8b) |
| KD02·KD15 칸 ↔ D-018·D-019 주어 | **PLAN_GAP — D11** | 칸 종류가 "변수"인데 판정 순서 목록(§7-F)이 변수 선언만 다룬다 — 구조 분해 선언 변수·매개변수·for-of 머리 대입 대상(r5-3 R2·R2c·R3·R4) |

## r5-1. Product & UX / ACTIVE Decision

| Decision | 기대 | 관측 |
|---|---|---|
| D-017 값 자리 fail-closed | 모르는 원천은 판정 불가 | **혼합 원천 구조 분해(리터럴 + 호출)가 KM02 숫자 아님으로 통과(D9)** — 같은 원천의 멤버 읽기는 KM08 |
| D-019 대입 경로 | 멤버 대입 우변 후보 · 증감·복합·구조 분해 대입 red | 368행 기대 = 현재 · 멤버 접근 형태는 맞음(R13~R17) · 구조 분해 읽기·선언 종류 형태에서 갈림(D10·D11) |
| 게이트 소비자 문구 | `판정 불가 KD15: 증감·구조 분해 대입 변수` | M61 실제 CLI stderr 그대로(r5-4) |
| 현재 트리 | 판정 불가 0 · 허용 0 · exit 0 | `node scripts/check-test-budgets.mjs` exit 0 · `--report` UNRESOLVED 0 |

## r5-2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | **있음(D9)** | `test-budget-bindings.mjs:603-607` `sources(origin).some(리터럴)`이면 KM02 — 원천 후보 중 호출이 섞여도 숫자 아님 |
| 같은 값 다른 문법의 판정 대칭 | **비대칭** | `r.ms`(R7c) red ↔ `const { ms } = r`(R7) 통과 · `o.ms`(R5c) 위반 1 ↔ `const { ms } = o`(R5) 0 · `let ms; ms++`(KD15a) red ↔ `let { ms } = …; ms++`(R2) 통과 |
| fail-closed 과잉 | 없음 | 트리 exit 0 · 구별 입력 KD15f·f2·KM10e·l·m·n·o 0/0 |
| 동시성·부분 실패 | 해당 없음 | 순수 함수 · `memberWrites`·`unresolvedVariables`는 `createBindings` 지역 |
| worst-case | 정상 | 로컬 실제 CLI 8.1s(r4 기록 5.25s — 같은 머신 아님) · Windows CI 'Test budget guard' 6s(`07:19:47 → 07:19:53`) |

## r5-3. 역방향 탐색 · 보고 밖 축(⑥)

`scan-surface.sh 80a0cfe..aac291f` → `app/src` 변경 0. `app/scripts/*` 변경은 직접 읽었다. 기대는 표 원문으로 유도했고 r4 트리(`3d5c16f`)도 같은 탐침으로 돌렸다.

| ID | 입력(요지) | 칸 근거 | 기대 | 현재 | r4 | 분류 |
|---|---|---|---|---|---|---|
| R7 | `let r = {}; r = getOpts(); const { ms } = r` | KD05 빈 후보 → "원천 식을 KM 표로 … 그 밖(호출…)은 KM08" · 같은 원천 KM 판정 R7c = KM08 | 1/1/KM08 | **0/0/-** | 0/0/- | 이행(D9) |
| R8 | `const { ms } = cond ? {} : getOpts()` | 같음 · R8c = KM08 | 1/1/KM08 | **0/0/-** | 0/0/- | 이행(D9) |
| R7b·R8b | 같은 혼합 원천, 리터럴에 `ms: 500` 있음 | KD05 "후보마다 KV"(후보 있음) ↔ D-019 "원천 멤버 = KM 표 판정"(R7bc = KM08) | 1/1/KM08(D-019) | **0/0/-** | 0/0/- | plan 내부 불일치(D10) |
| R5 | `const o = { ms: 500 }; o.ms = 5000; const { ms } = o` | 같은 두 문장 · R5c `o.ms` = KM10 위반 1 | 1/0/-(D-019) | **0/0/-** | 0/0/- | plan 내부 불일치(D10) |
| R6 | `o.ms++` 뒤 `const { ms } = o` | 같음 · `o.ms` = KM11 red | 1/1/KM11(D-019) | **0/0/-** | 0/0/- | plan 내부 불일치(D10) |
| R2·R2c | `let { ms } = { ms: 500 }` 뒤 `ms++` · `ms += 4500` | KD15·KD02 종류 "변수" — 판정 순서 목록에 구조 분해 선언 없음(해석 필요) | 1/1 | **0/0/-** | 0/0/- | 확장(창 안 → D11) |
| R3 | `function run(ms) { ms++; setTimeout(f, ms) } run(500)` | KD15 "변수" ↔ 매개변수 칸 KD06 | 1/1 | **0/0/-** | 0/0/- | 확장(창 안 → D11) |
| R4 | `let ms = 500; for ({ ms } of [{ ms: 5000 }]) {}` | KD15 "구조 분해 대입" 예시는 `=` 형태뿐 | 1/1 | **0/0/-** | 0/0/- | 확장(창 안 → D11) |
| R19 | `({ ...rest } = …)` 뒤 `rest.ms` | KD15 대상이나 읽기가 멤버 형태 → KM08 | 1/1 | 1/1/KM08 | 1/1/KM08 | — (판정 불가 동일 · 멤버 읽기는 KM 칸이 맞다) |
| R1·R9~R18 | for 갱신식 증감 · 중첩·`new`·변수 경유 원천 · import 멤버 · 멤버 `&&=`·배열 패턴 대상·`this ||=`·우변 호출·클래스 식 · 기본값 대입 대상 | KD15·KD05·KM07·KM10·KM11 | 표대로 | 일치 14 | 불일치 13(r5가 고침) | — |

- D9 잠금 부재: K2(`.some` → `.every` — 혼합 원천에서만 판정이 갈림)에 UT 709/709 green(r5-4). 혼합 원천 입력이 368행에 없다.
- 트리 실측(현재 결함 아님): 계측 사본(커밋하지 않음 — 구조 분해 선언 변수·매개변수의 증감/복합 red · 혼합 원천 red · 구조 분해 읽기에 멤버 대입 우변 추가)으로 `node scripts/check-test-budgets.mjs` exit 0 · 대입 경로 적중 0. for-of 머리 대입 `rg 'for \(\s*[\[{]'` 테스트 소스 0.
- N3(비귀속): PR #530 브랜치 run 41986312686(head `cc72b80`)이 `discovery-cache.test.ts:123` 경쟁 단언 1건으로 red — 같은 코드의 `main` push run 41986335666은 Test success이고 `app/src` diff 0.
- N2(r4)는 그대로 open — `createBindings` 반환 외부 소비 0.

## r5-4. 증거 재측정 · 고장 이력

- 하한 ①②⑤⑦: r5 spec 71행(M53~M61 · sweep S-*·X-* · r4 occ 보정 `C*r`) 전부 재실행 — 기대 일치 66 · green 5(S-KD05-noorigin·S-KM10-obj-notthis = 구현자 `동치` · C081r·C136r·C108r = r4 원 spec에서도 green이던 탐색 변이, 인용 밖). M61b(허용 등록)는 spec 밖이라 손으로 재현: count 1 exit 0 · count 2 exit 1(`실제 자리 1 개. count 를 맞춘다`).
- `동치` 2 확인: S-KD05-noorigin — `:601` 원천 없는 분기에 닿는 입력은 `let { ms }`(TS1182)뿐(`declare`는 `:585` KD03b가 먼저). S-KM10-obj-notthis — `this.x` 읽기는 `:621` `this` 분기가 먼저 받고, `sources(this)`는 리터럴 소유와 겹치지 않는다.
- 하한 ③(r4 `못 잡음`): K1 = M53 red · Q1~Q4·Q8·Q9 = `verify-r4-probes.mjs` 13 불일치 0.
- 하한 ④(r4 `잡음` 245, 오라클 파일이 바뀌어 전부): 기대 일치 244 · green 1(C080 — occ 3이 새 코드의 다른 `'red'`로 이동). 문맥 대조로 occ가 옮겨진 12행을 원 자리로 다시 심어 12/12 red(`C*v`). 문맥이 바뀐 7행(C001·C006·C111·C116·C120·C122·C123)은 원 occ 재실행 red. **덮개 회귀 0.**
- 하한 ⑥: r5-3 R1~R19(26입력, 불일치 11) + K2·K3.
- 행별 결과 [`evidence/verify-r5-mutation-results.tsv`](evidence/verify-r5-mutation-results.tsv) · spec [`verify-r5-mutations.jsonl`](evidence/verify-r5-mutations.jsonl) (worktree `aac291f`에서 실행, 원복 확인 출력 있음).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 직전 | 이번 결과 | 잡은 테스트 / 근거 | 분류 |
|---|---|---|---|---|---|---|---|---|
| r5 spec 71 | `r5-mutations.jsonl` 각 행 | 제거·맞바꿈·고정값 | 구현자 spec 그대로 | UT · 게이트 | 잡음 66 · 동치 2 · 탐색 green 3(구현자) | 같음 | 결과 tsv | VP-12e·09c |
| verify r4 245 + 보정 12 | `verify-r4-mutations.jsonl` | 같음 | occ 문맥 보정 12 | UT · 게이트 | 잡음 245(verify r4) | 잡음 257(C080은 C080v로) | 결과 tsv | VP-12e·09c·07b |
| M61b | `check-test-budgets.mjs:362` + `pop3-tls.test.ts` 끝 | 다른 값 | `UNRESOLVED_ALLOWED` KD15 count 1 / 2 | 게이트 | 잡음(구현자) | 잡음 | exit 0 / exit 1 | VP-09c |
| K2 | `test-budget-bindings.mjs:603` | 뒤집기 | 리터럴 판정 `.some` → `.every` | UT | 신규(보고 밖) | **못 잡음** | UT 709/709 green — 혼합 원천 입력 없음 | 이행(D9) |
| K3 | `:328` | 다른 값 | 비리터럴 원천이 있으면 후보에 판정 불가 추가 | UT | 신규 | 잡음 | KD05b·c·e 등 4 fail(과잉 판정 방향) | — |
| R7·R8 | 입력 | 다른 값 | 혼합 원천 구조 분해(빈 후보) | `analyzeScale` | 신규 | **못 잡음** | 위반 0(기대 1/1/KM08) | 이행(D9) |
| R5·R6·R7b·R8b | 입력 | 다른 값 | 구조 분해 읽기 + 멤버 대입·혼합 원천(후보 있음) | `analyzeScale` | 신규 | **못 잡음** | 위반 0 | plan 내부 불일치(D10) |
| R2·R2c·R3·R4 | 입력 | 다른 값 | 구조 분해 선언 변수·매개변수 증감/복합 · for-of 머리 대입 | `analyzeScale` | 신규 | **못 잡음** | 위반 0 | 확장(창 안 → D11) |

## r5-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-12e | MD-03e↔UT-03e / UT | REQUIRED | **PAIR_FAIL** (root, D9) | `check-test-budgets.test.mjs` describe '노드 종류 표 정정 (0294 ΔV5)' 36 + sweep 구별 3 — spec 실행에 ID 36/36 실재 · 탐침 169·163·36 불일치 0 · 재실행 기대 일치 · **KD05 빈 후보의 혼합 원천 분기가 KM02로 통과(R7·R8 · K2)** | EP-12e 9지점 · 칸 94 · 입력 368 — KD05 칸 미완 |
| VP-09c | AR-03c↔IT-03c / IT | REGRESSION | PASS | `gate:node scripts/check-test-budgets.mjs` exit 0 · 대조 명령 0줄 · UNRESOLVED 0 · M61 exit 1(`판정 불가 KD15`) · M61b 1 / 2 · M51·M52·M11c·M11d 재실행 red · Windows CI run 41986335666(head `aac291f`) 'Test budget guard' success | EP-03 20 · 04 6 · 05b 62 · 06 3 · 12e 9 · 13 0 |
| VP-07b | AR-01b↔IT-01b / IT | REGRESSION | PASS | M5b 24 실제 CLI exit 1(재실행) · M1·M2·M6·EP06 잡음 | 94 |
| VP-13 | R-01↔AT-05 / AT | REGRESSION | PASS | Windows CI run 41986335666 'Test' success(head `aac291f`, `main` push) · `git diff --stat 80a0cfe..aac291f -- app/src app/vitest.config.ts app/scripts/{vitest-setup,test-time,test-host}.mjs app/package.json .github` 0줄 | 0 |
| VP-01e | R-01↔AT-01e / AT | REQUIRED | **BLOCKED_BY:VP-12e** | AC1~3·5·6·7c·8 ✅ · AC7g는 VP-12e root | 94 |
| VP-02~06·08·10·11 | — | NOT_REQUIRED | NOT_REQUIRED | 관련 코드 diff 0 · 같은 CI Test success | 비영향 |

- 실행 구간: VP-12e UT는 `analyzeScale`을 production 그대로 부른다(mock 0). 구간 밖은 혼합 원천 KD05 분기(입력 0)다.
- Linux 전체 vitest는 이번 턴에 돌리지 않았다 — 같은 head의 Windows CI 전체 Test가 VP-13 좌표다.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1·AC2·AC3 | ✅ | `node --test scripts/*.test.mjs` 709/709(31 suites) · M1·M2 재실행 잡음 |
| AC4 | ✅ | `test-time.test.mjs` 통과 · 관련 코드 diff 0 |
| AC5·AC6 | ✅ | `--report` setConfig 21 scaled · case 6 scaled |
| AC7c | ✅ | 대조 0줄 · deadline 62 = 24 + 38 · M5b 24 |
| **AC7g** | ❌ | D9 — 혼합 원천 구조 분해가 KM08 대신 숫자 아님(R7·R8) |
| AC8 | ✅ | M6·EP06 재실행 잡음 |
| AC9 | ✅ | Windows CI run 41986335666 job `gate` success(head `aac291f`, windows-latest) |
| AC10~AC13 | ✅ | 같은 CI Test success · 관련 코드 diff 0 |
| AC14·AC15·AC17·AC19 | ✅ | 관련 코드 diff 0 · 인벤토리 `--check` ok · CI Test success |
| AC16 | ✅ | VP-13 |
| AC18 | ⚠️ 사람 실기 | — |
| AC19d | ✅ | `app/AGENTS.md:150` — `§7-E·§7-F` · "멤버(`this`·객체) 대입" · "증감·구조 분해 대입으로 바뀌는 변수·멤버는 **판정 불가**" · 인벤토리 links ok |

- 합계 재측정: `✅ 19 · ⚠️ 1(AC18) · ❌ 1(AC7g) = 총 21`.
- 자기보고 대조: 본문 `✅ 19 · ⚠️ 2 · ❌ 0` = trailer `Criteria-Met: 19/21` · `Criteria-Pending` 2항목 = INDEX "19/21" — 사본끼리 같다. 재측정과 불일치: AC9 ⚠️→✅ · AC7g ✅→❌.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | 자리 목록 | 자리별 확인 · oracle | 목록 밖 발견 | 결과 |
|---|---|---|---|---|---|
| VP-07b·09c | EP-01·02·03·04·06 | 2·1·20·6·3 | `--report` setConfig 21(목록 20 + hostile) · case 6 · 변이 재실행 잡음 | 없음 | PASS |
| VP-07b·09c | EP-05b | 62 | 대조 0줄 · M5b 24 · semantic 38 | 없음 | PASS |
| VP-09c | EP-13 | 0항목 | `--report` UNRESOLVED·allowed 0 · M61·M61b | 없음 | PASS |
| VP-12e | EP-12e | 9지점 · 칸 94 · 입력 368 | 탐침 3종 불일치 0 · UT ID 36/36 · 재실행 | KD05 혼합 원천(D9) · KD05 후보 있음 범위(D10) · KD02·KD15 선언 종류(D11) | PAIR_FAIL |

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| lint | PASS | 0 error · 2 warning(변경 밖) · 실행 후 `git status` 변화 0 |
| typecheck | PASS | node·web·test exit 0 · `error TS` 0 |
| node scripts 테스트 | PASS | 709 pass · 0 fail · 31 suites |
| 분기·칸 탐침 | PASS | 169 · 163 · 36 불일치 0 |
| 예산·인벤토리 | PASS | exit 0 · 대조 0줄 · UNRESOLVED 0 · `--check` prose·links ok |
| vitest | PASS(CI 좌표) | Windows CI run 41986335666 Test success · vitest 입력 파일 diff 0 |
| Windows CI | PASS | run 41986335666 · job `gate` · head `aac291f` · `main` push |
| commit trailer | PASS | `aac291f` 6키 + Co-Authored-By·Claude-Session 파싱 · `80a0cfe` Agent·Handoff·Status 파싱 · 값 허용 범위 |

## r5-8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 것 |
|---|---|---|
| AC18 | r2 S2 1코어·8워커 실측(이후 테스트 소스 diff 0) | 사내 백신·디스크 지연 Windows에서 `cd app && npm test` green·소요 시간 |

## r5-9. 게이트 재실행

- 설치: `npm ci --ignore-scripts` + `npm rebuild better-sqlite3`(Node 22.23.4).
- 변이는 별도 worktree(`aac291f`)에서 돌렸고 주 트리는 게이트·탐침만 실행했다. 계측 사본도 별도 worktree였고 전부 제거했다(`git worktree list` 1행). 주 트리 잔여물: 증거 파일 3개 추가만.

## r5-11. Repository operation checks

- AGENTS 위생: `app/AGENTS.md:150` 1줄 교체 — 비밀·일회성 정보 없음 · 상대 링크 해석(인벤토리 links ok).
- INDEX: 상태·다음 주체 일치(`impl/IMPL_DONE` · Claude). 자리표시자 → r5 `aac291f` · ΔV5 `80a0cfe`. r4 `b4e1b9d` → `main` 좌표 `3d5c16f`로 교정. 비고 5줄 이내.
- `[구현자 기입]` r5 7필드 전부 있음 · 강제 지점 표가 EP-01~04·06·05b·12e·13 행을 둔다 · 합계 검산 줄 있음.
- trailer: 위 gate 행.

## r5-13. Finding disposition

| # | finding | 귀속 | disposition | 영향 | 후속 |
|---|---|---|---|---|---|
| D7 | (r4) KD05 빈 후보 `숫자 아님` | VP-12d → VP-12e | **closed** | M53 red · Q1~Q4 불일치 0 · KD05b~e·h·i 단언 | — |
| D8 | (r4) 생성자·구조 분해 대입 | ΔV5 채택 | **closed** | Q8·Q9 = KM10a·KD15c 단언 · M55~M60 red | — |
| D9 | KD05 빈 후보에서 원천 후보가 리터럴 + 호출로 섞이면 `:603-607` `some(리터럴)`이 KM02 숫자 아님 — 칸 원문 "원천 식을 KM 표로 … 그 밖(호출…)은 KM08"과 같은 원천의 KM 판정(R7c·R8c = KM08)을 어긴다 · K2 못 잡음 | VP-12e · AC7g · EP-12e KD05 | **BLOCKING** (`PAIR_FAIL`) | 트리 자리 0(계측) | 구현: 원천 후보마다 KM 판정(리터럴 → KM01~05 · 호출 등 → KM08) · R7·R8을 UT 입력으로 |
| D10 | D-019 "KD05 '원천 멤버'는 원천 식을 KM 표로 판정한 결과" ↔ §7-F KD05 칸 "후보마다 KV, 후보가 없으면 KM 표" — 후보가 있을 때 멤버 대입 우변(KM10)·KM11·비리터럴 원천이 드는지 갈린다(R5·R6·R7b·R8b, 멤버 읽기 대조는 1) | VP-12e · AC7g · D-019 · EP-12e KD05 | **PLAN_GAP** (plan 내부 불일치) | 트리 자리 0(계측) | 설계자: 한 문장으로 정하고 칸·입력을 고친다 |
| D11 | KD02·KD15 판정이 변수 선언만 본다 — 구조 분해 선언 변수(R2·R2c)·매개변수(R3)의 증감·복합 대입, for-of 머리 구조 분해 대입(R4)이 위반 0 | VP-12e · AC7g · D-018·D-019 · EP-12e KD02·KD15 | **PLAN_GAP** (ΔV4 창 안 확장 — 마지막) | 트리 자리 0(계측 · `rg`) | 설계자: 항목마다 채택 또는 경계 선언. 이 설계 턴이 열거를 늘릴 수 있는 마지막 턴 |
| N2 | (r4) `createBindings` 반환 외부 소비 0 | 역방향 탐색 | NON_BLOCKING | 동작 무관 | 그대로 |
| N3 | PR #530 브랜치 run 41986312686 `discovery-cache.test.ts:123` red | 비귀속 | NON_BLOCKING | `app/src` diff 0 · 같은 코드 `main` run success | — |

## r5-14. Review Signals — 사실만

- 같은 축인가: 같다 — "판정이 Decision 주어보다 좁다". 이번에는 구현이 칸 원문의 원천 판정을 집합 하나로 줄인 곳 1(D9)과 칸 문장끼리 갈린 곳 1(D10), 칸 종류의 선언 범위 1(D11).
- 관련 plan 지침: ΔV5 KD05 "원천 식을 KM 표로" · D-019 "원천 멤버는 KM 표 판정 결과" · KD15 "변수".
- 사용자 결정 변경: 없음.
- 반복 환경 한계: AC18 사람 실기 · Linux 전체 vitest 미실행(CI 좌표).
- 독립 축(⑥) 발견: 26입력 불일치 11 — 이행 2(R7·R8) · plan 내부 불일치 4 · 확장 4 · 칸 ID만 다름 1(R19, finding 아님). K2 못 잡음 1.
- 구현자와 검증자가 같은 에이전트다(세션 분리). 구현자 sweep 529행의 재실행은 전부 기대대로였고 발견은 모두 목록 밖 입력에서 나왔다.

## r5-15. 결론

- 상태: **RETURN_TO_PLAN** — verify 5회째. `FAIL`(D9)과 `PLAN_GAP`(D10·D11)이 함께 있어 설계자가 먼저다. 5회째라 review 의무 없음(3·6회째).
- pair: PASS 3(VP-09c·07b·13) · PAIR_FAIL 1(VP-12e) · BLOCKED_BY 1(VP-01e → VP-12e) · NOT_REQUIRED 8.
- AC: `✅ 19 · ⚠️ 1(AC18) · ❌ 1(AC7g) = 21`.
- 운영 gate: 전부 PASS.
- 고장: 재실행 316 + 보정 12 + M61b(기대 일치 — 동치 2·탐색 green 3·occ 이동 1 설명됨) · 보고 밖 K2·K3 + 탐침 26(못 잡음 11 — 이행 3(K2·R7·R8) · 내부 불일치 4 · 확장 4), 덮개 회귀 0.
- 다음 단계: 설계자 ΔV6(D10 문장 정정 · D11 채택/경계 — ΔV4 창 마지막, 이 뒤 열거 동결, 별도 설계 커밋) → `plan/READY` → 구현 r6이 D9와 ΔV6 칸을 닫는다.
