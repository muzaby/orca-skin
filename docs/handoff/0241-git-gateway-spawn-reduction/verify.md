# Verify — 0241-git-gateway-spawn-reduction

## 메타

| 항목 | 값 |
|---|---|
| slug | `0241-git-gateway-spawn-reduction` |
| 검증자 | Claude Code |
| 일자 | 2026-09-27 |
| 대상 커밋/range | `a09aeec4..1b1956cd` (r1 구현 1커밋) |
| 구현 전 plan 기준 | `a09aeec4` (ΔV2 `80b88860` + 처분 표 R21~R25 보완 3커밋) |
| V mode / 유효 V | `Baseline V1@f682cc2` + `ΔV1@2ce833e` + `ΔV2@80b88860` |
| 검증 기준 plan revision | `a09aeec4:plan.md` §3·§7·§21·§23 |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니오 — 구현 `Agent: codex`, 검증 Claude. 그래도 보고에 없던 적대 축 22건을 추가했다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: 메타 `상태` 1행 교체 + `§24 [구현자 기입]` 추가뿐 — `git show 1b1956cd -- …/plan.md`의 삭제 줄 **1**.
- 기준선이 diff로 성립: **예** — 설계 커밋 `a09aeec4`와 구현 커밋 `1b1956cd`가 분리돼 있다.
- Decision Ledger·Product/UX·AC·V pair·§10 변경(구현 커밋): **없음**.
- 구현 전 규범 보완 3커밋(`58d0ab66`·`2a5f650e`·`a09aeec4`)은 `Agent: codex`·`Status: designed`로 AC24 처분 표 R21~R25를 추가했다. 행별로 원 AC 대비 완화 여부를 대조했다 → **완화 0**(§12). 절차 사실은 D8.
- 채점 기준: `a09aeec4`의 §3 ACTIVE Decision, §7 + §21.3 + §23.2 AC 25건, §7-A + §21.4 + §23.3 pair 20건, §10 + §21.5 + §23.4 강제 지점.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | V1 `f682cc2` → ΔV1 `2ce833e` → ΔV2 `80b88860`, 세 해시 모두 `git cat-file -t` = commit |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-10↔VP-20, MD-07↔VP-21, CHANGED R-01~R-09·SD-01·AR-01·02·MD-05 각 REQUIRED 보유 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | 선택 커밋 경로 VP-03R(`git-diff-commit.test.ts` 3케이스) |
| pair별 path·§10 전수·직접 oracle | 유효 | §23.3 VP-20 9자리·9변이, EP-05 8+1, EP-09 2 |
| 필요한 pair의 선택적 적대 증거 | 유효 | VP-02·03·05·06·07·09·20 selected, 나머지 직접 oracle 사유 기재 |
| `SUPERSEDED` pair 이관 | 유효 | VP-15·VP-19 폐기 근거 D-021·D-022, ΔV1 VP-20 6변이 → ΔV2 9변이 포함 |
| 운영 gate·범위 | 유효 | §7-A 4종 |

- root PLAN_GAP: **없음**.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-005·D-021 요청마다 probe, 결과 캐시 없음 | 반복 호출도 같은 실행 수 | `gitSnapshot` → `probeRepo` → `gateway.read`(in-flight만 공유, `gateway.ts:53` 완료 즉시 삭제) |
| D-008 절대 PATH 실행 파일 | cwd 가짜 git 미실행 | `runner.ts:27` `gitExecutable()` → `resolveGitExecutable`(`git-executable.ts:29-31` 상대·드라이브상대 제외) |
| D-010·D-026 snapshot 1채널, status 래퍼 | IPC 1회/계기 | `useGitSnapshot` → `gitApi.snapshot` → preload → `handlers/git.ts` `gitSnapshot` |
| D-011 checkout 결과에 status | 추가 조회 0 | `gitCheckout` → mutate → `probeRepo` → `buildStatus` → `checkoutOutcome` → `BranchChip.setSnapshot` |
| D-012 `uncommitted` 삭제 | 필드 0 | `shared/ipc.ts` `GitDiffSummary` 8필드 |
| D-014 diff/log 외부 프로그램 차단 | 마커 부재 | `DIFF_SAFETY_ARGS` 6자리 |
| D-015·D-016·D-017 쓰기 mutate·읽기 상한 4·세대 키 | 락·세대 | `gateway.ts` `mutate`(`withRepoMutation` + finally 세대+1) / `read` 세마포어 |
| D-022 origin 매 조회 | 전역 insteadOf 반영 | `buildStatus` → `remote get-url origin` |
| D-025 lint 규칙 3종 | 우회 import error | `eslint.config.mjs:177-188` |
| D-027·D-028 누적 `[B,H]`·선택 `[P,C]`, B=H 생략 | 한 응답 한 시점 | `resolveDiffRange`(probe H) → `rangeArgs` → `readDiff`·`readCommitHistory`·`runPatch` ×2 |

```text
tick/수동 → useGitSnapshot(effect 1) → gitApi.snapshot({includeSummary}) → orca:git:snapshot
  → gitSnapshot → probeRepo(read 1) → buildStatus(remote 1) ‖ gitDiffSummary(probe 공유)
      → rangeArgs(B,H) = null ? 빈 결과 : diff ‖ log
  → onResult: setGitStatus + receiveGitSnapshotSummary | failGitSnapshotQuery
칩 전환 → gitCheckout → probe·shortstat(read) → mutate(checkout) → probe·remote → {ok, branch, status} → setSnapshot
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ⚠️ 비차단 | 실행 파일은 찾았으나 spawn 실패(메모 후 git 제거 등)는 `unavailable`이 아니라 `not-repo`로 접힌다 → D6 |
| false success 가능성 | ⚠️ 비차단 | probe 첫 호출이 128 외 사유(timeout)로 실패하면 unborn으로 분류돼 요약이 빈다 → D7(plan §11 폴백 설계 그대로) |
| partial failure/rollback | 정상 | checkout `applied` 경로 불변(`git-cli.ts:62-82`), 세대는 throw에도 +1(gateway 테스트 + X04b red) |
| Product/UX의 A가 아닌 B | 정상 | §5 상태 표 5행 ↔ 코드 경로 일치 |
| 증상만 제거 | 해당 없음 | — |
| 최적화가 잃은 관측 | ⚠️ 비차단 | 같은 cwd에서 sessionId만 바뀌면 진행 중 턴 종료 snapshot의 status도 버린다(구 status effect는 cwd 키라 유지) → D10 |
| 출력/요청 worst-case | 정상 | 읽기 동시 4(P2 지속 부하 probe 최대 4), 요청 사이 보관 = 실행 파일 경로 1개 |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 1b1956cd^..1b1956cd` — 대상 22파일.

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `gitStatusQueryReason`·`gitSummaryQueryReason` 테스트 전용 | 죽은 코드 | production 참조 0(`grep` 결과 정의 줄만). `gitQueryReason.test`·`gitManualRefresh.test`가 여전히 이 둘을 단언 → D5 |
| `resolveHeadRef`·`resolveRepoRoot` 테스트 전용 | 죽은 코드 | production 참조 0. plan §11이 "probe 위로 재구현"만 지시 → D5 |
| `createGitGateway`·`rangeArgs`·`planGitSnapshotQuery`·`resolveGitExecutable` | 정상 | 같은 파일 내부 production 사용(`gateway.ts:72`, `git-diff.ts:204·270`, `useGitSnapshot.ts:121`, `git-executable.ts:39`) |
| 형제 정책 비대칭 | 없음 | 스크립트 §3 0건. 읽기 sink 1(`gateway.ts:41`), 쓰기 sink 1(`:63`) |
| producer ↔ consumer | 정상 | `GitCheckoutResult.status` 소비처 `checkoutOutcome` 1곳(`branchChipState.ts:63`) |
| lint 경계 스펠링 | 구멍 | `./runner.js` 정적 import가 tsc 통과·lint 0 error. 원인은 `src/main` 블록의 `node` resolver(`eslint.config.mjs:113`)이며 `boundaries`도 `.js`를 놓친다 → D1 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 인용 케이스 실재: `git-diff-commit.test.ts` `it(` 3건, `legacy-paths.test.ts` 6건(`grep -cE '^\s*it(\.each…)?\('`). plan §7의 26·16은 `rg -c "it\("`가 `commit(` 등을 함께 센 값 → D9.
- structural proxy만으로 닫힌 AC: 없음. AC10은 마커 부재(`git-safety.test.ts`), AC26은 결과 단언이 먼저 실패한다(M11~M19 첫 실패 줄이 전부 결과 단언 — `git-consistency.test.ts:82·97·98·143`).
- **선택된 적대 증거 재측정**: 29건 중 검출 **29** · 미검출 0 — M01~M22 22건(`r1-mutations.cjs 0 22`, Linux) + L01~L07 7건(`scripts/git-boundary.test.mjs` 7케이스 pass = 7변이 severity 2).
- 자리 미지정 등록 변이: 해당 없음 — VP-20 9변이·VP-06 6자리는 자리를 적었다.
- 이전 라운드 대조: 첫 구현 라운드 — 해당 없음.
- 보고에 없던 적대 축: 22건 — red 18 · green 4. green 4는 전부 검증자 probe로 현재 동작이 옳음을 확인했다(아래).

| 변이 | 범위 | 결과 | 귀속 |
|---|---|---|---|
| M01~M22 (구현자 등록·신설) | 지정 스위트 | **22/22 red** | VP-02·03·05·06·07·09·12·20 등록 변이 |
| L01~L07 lint 7변이 | `git-boundary.test.mjs` | **7/7 red** | VP-09·12 등록 변이 |
| X01 in-flight 키에서 세대 제거 | gateway.test | red | AC13 |
| X02 완료 결과를 in-flight 맵에 유지 | gateway·git-snapshot | red (4 fail) | AC1·AC13 / D-021 |
| X03b 읽기 슬롯 누수 | git-snapshot | red (3 fail) | AC14 |
| X03c 슬롯 인계 시 과소 계수 | gateway.test | **green** → 검증자 P2 probe red | AC14 잠금 공백 → D4 |
| X04b 쓰기 세대 증가 제거 | gateway·git-execution | red (3 fail) | AC13·EP-05 |
| X05 checkout 성공 status를 전환 전 probe로 | git-cli·git-execution | red (6 fail) | AC15·EP-07 |
| X06 턴 종료 응답의 status 반영 제거 | composer 전체 236 | **green** → 검증자 P1 probe red | AC16 잠금 공백 → D2 |
| X07 핸들러 baseline 미전달 | handlers/git.test | red | AC2·AC25 |
| X08b 실행 파일 **실패 결과도** 메모 | infra/git·app·worktrees 744 | **green** → 검증자 P3 probe red | AC12 잠금 공백 → D3 |
| X09 probe branch/detached 맞바꿈 | probe.test | red (2 fail) | VP-14 |
| X10 칩이 성공 status 대신 null 저장 | BranchChip.snapshot | red | AC17 |
| X11 unavailable → not-repo 맞바꿈 | git-execution·reject-reasons | red (2 fail) | AC12 |
| X12 repair를 read로 | git-execution | red | EP-05 |
| X13 요약이 probe를 재실행 | git-snapshot | red (3 fail) | AC1·AC2 |
| X14 초기 계기에 요약 포함 | composer | red (4 fail) | AC16 |
| X15 checkout을 락 밖 read로 | git-execution | red | EP-05 |
| X16 늦은 응답 수용 | composer | red (5 fail) | AC16 |
| X-L1 `require('node:child_process')` | ESLint.lintText | red | AC22 |
| X-L2 `export * from './runner'` | 〃 | red | AC22 |
| X-L3 `import … from './runner.js'` | 〃 | **green** (tsc 통과) | D1 |
| X-L6 `createRequire` 경유 | 〃 | **green** | D1 |

- 재현: `evidence/verify-r1/xmut.cjs`(X 변이, `app/`에서 `node ../docs/…/xmut.cjs [접두사]`), `lintx.mjs`(X-L), probe는 `probe-main.test.ts`·`probe-renderer.test.ts`를 각각 `src/main/infra/git/__verify/`·composer 디렉토리에 복사해 실행. 실행 후 모두 삭제했고 `git status --short` 결과는 evidence 디렉토리만 남았다.
- 형제 슬롯 맞바꿈: 누적↔선택 끝점은 M15~M19가 자리별로, branch↔detached는 X09가 잡는다.
- `N회` 관측 주체: `createGitGateway({ run })`의 run 호출 기록(실제 `runGit` 래핑, 실저장소).

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 |
|---|---|---|---|---|---|
| VP-14 | MD-01 ↔ UT-01 | REQUIRED | PASS | `probe.test.ts` 3케이스 7상태 + X09 red | 0 |
| VP-16 | MD-03 ↔ UT-03 | REQUIRED | PASS | `gateway.test.ts` 4케이스 + X01·X02·X03b·X04b red, P2 probe | EP-05 세대 1/1 |
| VP-17 | MD-04 ↔ UT-04 | REQUIRED | PASS | `git-executable.test.ts` 3케이스 + M02 red, P3 probe | EP-04 1/1 |
| VP-18 | MD-05 ↔ UT-05 | REQUIRED | PASS | `gitSnapshotPlan`·`gitSnapshotLifecycle`·`gitSnapshotQuery` + X14·X16 red, P1 probe | 0 |
| VP-21 | MD-07 ↔ UT-07 | REQUIRED | PASS | `range-args.test.ts` 표(누적 B≠H·B=H·none, 선택 P≠C·P=C) | 0 |
| VP-12 | AR-01 ↔ IT-01 | REQUIRED | PASS | lint 0 error · child_process import 파일 = `runner.ts` 1 · `assertPolicies` 읽기/쓰기 위반 `[]` | EP-01 1/1 · EP-05 8/8 · EP-10 1/1 |
| VP-13 | AR-02 ↔ IT-02 | REQUIRED | PASS | `handlers/git.test` 5 · 스키마 거절 4종 · `ipc-documentation.test` · `gitIdentityRemoteWiring` 무수정 통과 | EP-08 3/3 |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED | PASS | `git-snapshot.test` 커밋 전후 2→4→4, 결과 새 커밋 반영 | EP-11a 6/6 |
| VP-11 | SD-02 ↔ ST-02 | REQUIRED | PASS | `git-execution.test` checkout status = 이후 snapshot status (`toEqual`) | EP-07 1/1 |
| VP-01 | R-01 ↔ AT-01·02·03 | REQUIRED | PASS | `git-snapshot.test` B=H 2회×2, B≠H 4회×2, bornAt 3/5회×2 · X13 red | EP-11a |
| VP-02 | R-02 ↔ AT-04~07 | REQUIRED | PASS | 상태 2회, set-url·전역 insteadOf 반영 · M01 red | EP-09 2/2 |
| VP-03 | R-03 ↔ AT-08·09 | REQUIRED | PASS | 패치 2/3/1회 반복 · 폴백 끝점 동일 · M16 red | EP-11a 2 · EP-11b 3 |
| VP-03R | R-03 ↔ 선택 커밋 회귀 | REGRESSION | PASS | `git-diff-commit.test.ts` 3케이스, 파일 diff 0줄 | EP-11b 3/3 |
| VP-04 | R-04 ↔ AT-14~16 | REQUIRED | PASS | clean 5·dirty 2·해소 3종 6 · R16 정확 비교 · X05·X15 red | EP-05·07·09 |
| VP-05 | R-05 ↔ AT-12·13 | REQUIRED | PASS | cwd 가짜 git 마커 부재 · unavailable spawn 0 · M02·X11 red · P3 | EP-04 1/1 |
| VP-06 | R-06 ↔ AT-10·11 | REQUIRED | PASS | diff.external·textconv 양성 마커 확인 후 조회 마커 부재 · M03~M09 red | EP-01 1 · EP-02 6/6 |
| VP-07 | R-07 ↔ AT-17~20 | REQUIRED | PASS | `BranchChip.snapshot` 추가 조회 0 · M10·X10 red · owner 스윕 M20 | EP-07 1 · EP-08 3 |
| VP-08 | R-08 ↔ AT-21·22 | REQUIRED | PASS | prepare 4회 · passthrough probe 1/resume 0 · `legacy-paths.test` 6 pass(better-sqlite3 Node ABI 재빌드 후) · X12 red | EP-05 repair |
| VP-09 | R-09 ↔ AT-23·25 | REQUIRED | PASS | L01~L07 red · 기존 수정 테스트 24파일 ⊆ 처분 표 · 완화 0 | EP-10 1/1 |
| VP-20 | R-10 ↔ AT-26 | REQUIRED | PASS | 경합 5종 + 폴백 2종, 커밋이 probe 완료 뒤 일어남 단언 · M11~M19 9/9 red(결과 단언) | EP-11a 6 · EP-11b 3 |

- root `PAIR_FAIL`: **없음**. `BLOCKED_BY`: 없음.
- 실행 범위: 최초 검증 — 유효 V REQUIRED 19 + REGRESSION 1 전건.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | B=H snapshot 2회(rev-parse·remote) ×2 |
| AC2 | ✅ | 커밋 후 4회 {diff,log,remote,rev-parse} ×2, files·commits 새 커밋 |
| AC3 | ✅ | 상태만 2회, set-url·`GIT_CONFIG_GLOBAL` insteadOf 반영(로컬 config 불변 단언) |
| AC4 | ✅ | 없는 경로 0회, 비저장소 2회 |
| AC5 | ✅ | unborn 4회, `branch:'main'`, `base:none` |
| AC6 | ✅ | probe detached · `git-cli.test` detached 케이스 |
| AC7 | ✅ | 누적 2 · 선택 3 · B=H 1 ×2, 선택 커밋 3케이스 무수정 |
| AC8 | ✅ | 전문맥 실패 사이 커밋, 두 인자 `--unified`만 다름, 결과 H·C 기준(누적·선택 각 1) |
| AC9 | ✅ | `assertPolicies`·safety 읽기/쓰기 위반 `[]` |
| AC10 | ✅ | 마커 부재 + 플래그 누락 `[]` |
| AC11 | ✅ | 실행 가능한 가짜 `git` 양성 확인 후 미실행 |
| AC12 | ✅ | spawn 0 · `git-unavailable` · 재탐색 2회 · P3(production 메모) |
| AC13 | ✅ | 동일 읽기 공유 1회, 쓰기 후 새 실행, 완료 제거 |
| AC14 | ✅ | 동시 10건 최대 4 · P2 지속 부하 최대 4 |
| AC15 | ✅ | clean 5 · dirty 2 · 해소별 6, 정확 status |
| AC16 | ✅ | 계획 표 · lifecycle 4 · P1 턴 종료 status 반영 |
| AC17 | ✅ | 성공 status → setter, status/snapshot 호출 0 |
| AC18 | ✅ | `gitIdentityRemoteWiring` 무수정 통과 |
| AC19 | ✅ | 채널 집합 4 · `uncommitted` 0 · inventory 97채널 일치 |
| AC20 | ✅ | prepare 4회 · passthrough/resume · worktrees 스위트 통과 |
| AC21 | ✅ | `legacy-paths.test` 6 pass · repair 세대 +1 |
| AC22 | ✅ | 7변이 severity 2 · production lint 0 error (`.js`·createRequire 구멍은 D1) |
| AC24 | ✅ | 수정 기존 테스트 24파일 − 처분 대상 = `[]`, hunk 대조 완화 0 |
| AC25 | ✅ | bornAt B=H 3 · B≠H 5 ×2, rev-list 끝 인자 = probe H |
| AC26 | ✅ | probe 완료 후 커밋 5종 결과 · HEAD 인자 `[]` · 9변이 red |

- 합계 재측정: **✅ 25 · ⚠️ 0 · ❌ 0 = 총 25**(AC1~22·24~26, AC23 폐기). 자기보고 25/25와 일치.
- 합계 사본 대조: plan §24 `25/25` ↔ trailer `Criteria-Met: 25/25` ↔ INDEX 비고 `AC 25/25` — 일치.

### pair별 plan §10 강제 지점 분모

| Pair | 계약 | plan 자리 | 검증자 재열거 | 결과 |
|---|---|---|---|---|
| VP-06·12 | EP-01 읽기 정책 | 1 | `runGit(` production 호출 = `gateway.ts:41`(read)·`:63`(write) | 1/1 |
| VP-06 | EP-02 안전 플래그 | 6 | `DIFF_SAFETY_ARGS` 사용: readDiff·history 2·runPatch 2호출·shortstat | 6/6 |
| VP-05 | EP-04 절대 경로 | 1 | `runner.ts` `exec(executable` 1 | 1/1 |
| VP-04·08 | EP-05 쓰기 | 8 + 세대 1 | `write(` 8(git-cli 4·worktree 4), 전부 `gateway.mutate` 내부, 세대 finally 1 | 9/9 |
| VP-04·11 | EP-07 | 1 | `gitCheckout` 최종 반환 1 | 1/1 |
| VP-07·13 | EP-08 | 3 | `gitApi.status(` 2(BranchChip·useGitIdentityRemote) + `gitApi.snapshot(` 1 | 3/3 |
| VP-02·04 | EP-09 | 2 | `buildStatus(` 호출 2(git-snapshot·git-cli) | 2/2 |
| VP-09·12 | EP-10 | 1 | `eslint.config.mjs:177-188` | 1/1 |
| VP-01·03·20 | EP-11a | 6 | readDiff·history normal·fallback·rev-list·runPatch ×2 | 6/6 |
| VP-03·03R·20 | EP-11b | 3 | cat-file·runPatch ×2 (`revArgs` 1회 계산) | 3/3 |

- 합계 **33/33** — 자기보고와 일치. `HEAD` 문자열 production 사용 4곳 = §23.4 예외(probe 2 · shortstat · reset write)와 일치.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| typecheck | PASS | node·web·test 3구성 exit 0 |
| lint | PASS | 0 error · 1 warning(기존 `useTranscriptVirtualizer`) · 실행 후 트리 변경 0 |
| vitest (plan 지정 스위트) | PASS | 1차: 299파일 중 12 red = electron 미설치 6 + better-sqlite3 bindings 6. `npm rebuild better-sqlite3`·electron install 후 전체 **579파일 · 5,342 pass · 3 skip(Windows 전용 2 · SDK live 1) · 0 fail** |
| scripts | PASS | `node --test scripts/*.test.mjs` 128/128 |
| 문서 인벤토리 | PASS | 9항목 · 97채널 · prose·링크 ok |
| 커밋 trailer | PASS | `1b1956cd` 5키 파싱 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `IPC_CONTRACT.md §2.6-b` | typecheck(preload·renderer) | `ipc-documentation.test` · `git-diff-schema.test`(snapshot 행, `uncommitted` 부재) | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 수정된 기존 테스트 파일 24 = 처분 표 R1~R25 대상 파일 24(R7 12파일 fixture는 `uncommitted` 블록·쉼표만 삭제, `+` 줄 11개 전부 `commitFilesUnavailable: false`).
- 무수정 보존 대상 R14·R19·R20: `git diff --numstat` 0줄.
- 동시 실행 상한: 순간 버스트 4(gateway.test), 지속 부하 4(P2).

## 8. 남은 사람 실기

없음 — plan §19 "사람 실기 없음". 구현자가 Windows, 검증자가 Linux에서 같은 스위트를 돌려 두 플랫폼 경로 해석을 모두 지났다.

## 9. 게이트 재실행

- 명령: `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run <plan 스위트>` → 전체 `vitest run` · `node --test scripts/*.test.mjs` · `node scripts/check-doc-inventory.mjs --check`.
- `npm test` 미사용. DB 스위트는 `npm rebuild better-sqlite3`(Node ABI)로 bindings를 만들어 실행했다 — AC21 증거인 `legacy-paths.test`가 DB 로드 파일이라서다.
- 환경 분리: 1차 red 12파일의 서명은 `Electron failed to install correctly` 6 · `Could not locate the bindings file` 6. 설치 후 0 red.
- 작업 트리: lint·변이·probe 후 `git status --short` = 신규 `evidence/verify-r1/`만.
- 잔여물: `app/node_modules/.cache/orca/0241/`(변이 로그, 추적 제외), `node_modules` 내 bindings·electron dist(추적 제외).

## 10. 검증 책임 분리

기계 판정 범위(gate·계약·상태 로직·레이어 경계·문서)는 전부 에이전트가 닫았다. 사람 몫은 D1(lint resolver 개선을 별도 handoff로 열지)뿐이다.

## 11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: 이번 턴에 `verify/PASS`로 갱신하고 archive로 이동한다. 대상 커밋 좌표 `1b1956cd`(r1)·설계 `dc1978f`~`a09aeec4` 전부 `git cat-file -t` = commit.
- `[구현자 기입]` §24 7필드: 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals — **7/7**.
- trailer: `1b1956cd` `Agent: codex`·`Status: implemented`·`Criteria-Met: 25/25`·`Verified-By: pending`·`Handoff` 파싱 5키.
- `a09aeec4` 제목 첫 글자가 U+FEFF(BOM)이고 scope가 `git`이다 → D8.
- evidence 스크립트: `r1-mutations.cjs`가 Linux에서도 22/22 재현.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| I1 진행 중 status-only 요청 이어받기 | 타당 — 완료 결과 캐시 아님(`finally`에서 해제) | lifecycle 2케이스 + X16 red |
| I2 plan 테스트 수 불일치 | 타당 | D9 |
| I3 dirty 검사 ↔ 큐 획득 사이 창 | 기존 한계, 이번 범위 밖 | 기록 |
| I4 SHA-256 empty tree | 기존 한계 | 기록 |
| R21~R25 처분 추가(구현 전 설계 커밋) | 완화 0 — R21 절대 경로 정확 일치, R22·R23 결과 단언 보존, R24 정확 비교, R25 M22 red로 스윕 유지 | D8 절차 기록 |
| R12 "PATH 없는 resolver" 대신 `probeRepo` spy | 대체 — 실제 resolver 경로는 `git-execution.test` unavailable 케이스가 덮는다(X11 red) | 기록 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | `import … from './runner.js'`(tsc 통과)와 `createRequire` 경유가 lint 0 error. 원인은 `src/main` 블록 `node` resolver가 `.js→.ts`를 풀지 못하는 것이고 `boundaries`도 같은 스펠링을 놓친다(`../artifacts/service.js` → 0 error) | AC22 인접, 저장소 공용 resolver | NEXT_HANDOFF | resolver를 TS 인식형으로 바꿀지 결정 후 별도 handoff |
| D2 | 턴 종료·수동 응답의 `setGitStatus` 반영을 지워도 composer 236케이스 green(X06). 현재 코드는 옳다(P1) | AC16 잠금 공백 | NON_BLOCKING | lifecycle 테스트에 P1 케이스 추가 |
| D3 | production `gitExecutable` 메모가 실패도 보관하게 바꿔도 744케이스 green(X08b). 현재 코드는 옳다(P3) | AC12 잠금 공백 | NON_BLOCKING | P3 케이스 추가 |
| D4 | 세마포어 인계 과소 계수(X03c)가 gateway.test green. 현재 코드는 옳다(P2) | AC14 잠금 공백 | NON_BLOCKING | P2 케이스 추가 |
| D5 | `gitStatusQueryReason`·`gitSummaryQueryReason`·`resolveHeadRef`·`resolveRepoRoot` production 참조 0, 앞의 둘은 테스트 2파일이 계속 단언 | 비귀속 | NON_BLOCKING | 정리 handoff |
| D6 | 실행 파일은 있으나 spawn 실패 시 prepare가 `git-unavailable` 대신 `not-repo` | plan §11 결정 범위 | NON_BLOCKING | 기록 |
| D7 | probe 첫 호출의 128 외 실패가 unborn으로 분류돼 해당 요청 요약이 빔 | plan §11 폴백 설계 | NON_BLOCKING | 기록 |
| D8 | 구현자가 `Status: designed` 커밋 3개로 AC24 처분 행을 추가했고 `a09aeec4` 제목에 BOM | repository operation | NON_BLOCKING | Review Signal |
| D9 | plan §7 "기존 테스트 수" 26·16은 `commit(` 오검출 값(실제 3·6) | plan 서술 | NON_BLOCKING | 기록 |
| D10 | 같은 cwd에서 sessionId만 바뀌면 진행 중 턴 종료 snapshot의 status도 버려져 다음 계기까지 옛 브랜치 표시 | AC16 문장 범위 밖(lifecycle 테스트가 이 동작을 단언) | NON_BLOCKING | 기록 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음(첫 verify).
- 관련 plan 지침: AC16의 증거 설계(§21.3)가 "턴 종료 응답의 status 반영"을 oracle로 두지 않았다 → D2.
- 사용자 결정 변경 근거: 없음. D-021·D-022 유지.
- 반복된 검증 환경 한계: 이 컨테이너는 최초 상태에서 electron·better-sqlite3 바인딩이 없었고, 설치로 해소됐다.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED 19 · REGRESSION 1 **전건 PASS** · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision: D-001~D-028 ACTIVE 항목 충족
- AC: ✅ 25 · ⚠️ 0 · ❌ 0
- 운영 gate: 6종 PASS
- NON_BLOCKING D2~D10 · NEXT_HANDOFF D1
- 남은 사람 확인: 없음
- 다음 단계: INDEX를 archive로 이동한다. D1~D5는 후속 handoff 후보다.
