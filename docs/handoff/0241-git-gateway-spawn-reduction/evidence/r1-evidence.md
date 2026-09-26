# 0241 r1 구현 증거 — 2026-09-27

이 기록은 구현자의 자기검사다. 독립 검증 판정은 아직 없다. 명령은 별도 표기 외에는 `app/`에서 실행했다.

## 실행 결과

| 명령 | 관측 |
|---|---|
| `npx.cmd vitest run` | 579파일·5,344케이스 통과, 기존 1파일·1케이스 skip. 423.44초. |
| `node --test scripts/*.test.mjs` | 128 통과, 실패 0. Git import 경계 7변이와 허용 경로 포함. |
| `npm.cmd run typecheck` | node·web·test 3구성 오류 없음. |
| `npm.cmd run lint` | 오류 0, 기존 `useTranscriptVirtualizer.ts`의 incompatible-library 경고 1. |
| `node scripts/check-doc-inventory.mjs --check` | generated 9항목·97채널 일치, prose·상대 링크 정상. |
| 저장소 루트 `git diff --check` | 출력 0줄. |

전체 테스트 이후 변경은 테스트의 타입 단언·설명·이름, 설명 주석·BOM 제거와 문서 정리다. 타입 단언 수정은 최종 typecheck, 테스트 하네스 설명은 lint로 확인했다. 빌드·사람 실기는 이 plan의 필수 gate가 아니다.

샌드박스에서는 Node가 임시 저장소의 helper를 실행할 때 상위 경로를 realpath 하다가 `EPERM lstat C:\Users\rlaeo`로 실패했다. 같은 safety 테스트를 권한 확장 환경에서 실행하면 2/2 통과했다. scripts의 최초 환경 실패 8건도 권한 확장 재실행에서 해소됐다. 별도의 실제 오류인 새 fixture timeout 누락·execFile mock 타입 불일치는 코드를 고친 뒤 각각 scripts 128/128·typecheck 3구성으로 닫았다.

## 강제 지점 검색과 분류

검색은 해법 이름만 찾지 않고 Git 명령·실행 sink·상태 생산/소비를 대상으로 했다. `rg`가 없어 PowerShell과 `git diff`를 썼다.

```powershell
$files = Get-ChildItem app/src/main -Recurse -File -Filter '*.ts' |
  Where-Object { $_.Name -notmatch '\.(test|testfixture)\.ts$' }
$files | Select-String -Pattern "'diff'|'log'|'cat-file'|'rev-list'|'stash'|'commit'|'reset'|'checkout'|'worktree'"
Select-String -Path app/src/main/infra/git/worktree.ts -Pattern "'branch'"
Select-String -Path app/src/main/infra/git/runner.ts -Pattern 'execFile|executable'
Select-String -Path app/src/main/infra/git/git-diff.ts -Pattern 'runPatch\(|run\(runner|readDiff\(|readCommitHistory\('
Get-ChildItem app/src/renderer -Recurse -File -Include '*.ts','*.tsx' |
  Where-Object { $_.Name -notmatch '\.test\.' } |
  Select-String -Pattern 'gitApi\.(status|snapshot)\('
```

| 모집단 | 실제 자리와 분류 | 모집단 − 아래 닫은 자리 |
|---|---|---|
| 읽기 실행 sink | `gateway.read`의 `runGit` 1. 기록의 prefix·readOnly 불일치 집합을 safety/execution 테스트가 비교한다. | `[]` |
| diff/log 호출 | `readDiff`, `readCommitHistory` normal/fallback, `runPatch` full/limited, checkout shortstat = 6. `runPatch` 함수 본문은 공유하지만 호출 자리는 둘이다. | `[]` |
| 실행 파일 sink | runner의 `exec(executable, …)` 1. 다른 production Git sink는 lint 경계로 거절된다. | `[]` |
| Git 쓰기 명령 | `git-cli` stash/commit/reset/checkout 4 + `worktree` add/remove/branch-delete/repair 4. `worktree list`는 읽기다. | `[]` |
| mutation 세대 완료 | gateway `finally` 1. 성공과 throw 각각 세대 증가를 단언한다. | `[]` |
| checkout 성공 DTO | `gitCheckout` 최종 반환 1. callback 안의 `{ok:true}`는 내부 결과이며 DTO가 아니다. | `[]` |
| renderer status/snapshot 요청 | BranchChip·useGitIdentityRemote의 status 래퍼 2 + useGitSnapshot 1. 래퍼는 preload snapshot(false)으로 간다. | `[]` |
| status 생산 | `gitSnapshot`·`gitCheckout`에서 `buildStatus` 호출 2. helper 내부 remote 호출은 하나다. | `[]` |
| 누적 끝점 운반 | diff·history normal/fallback·bornAt·patch full/limited = 6. | `[]` |
| 선택 커밋 끝점 운반 | cat-file·patch full/limited = 3. | `[]` |

문자열 검색의 비실행 결과는 `adapters/edit-preview.ts`의 diff 패키지, Jira의 stash/commit 자료, worktree 진행 라벨, DB diff 타입, range 판별자다. 이들은 명령 배열의 실행 edge가 아니다. probe·remote는 범위 끝점 모집단에서 제외하며 checkout dirty의 실제 HEAD 사용은 §23.4의 명시 예외다. `git-consistency.test.ts`는 probe 직후 커밋이 실제로 바뀐 것을 먼저 단언하고, 해당 범위 호출에서 `HEAD`/`..HEAD` 인자를 빼낸 결과를 `[]`와 비교한다.

## 기존 테스트 처분 대조 — AC24

`git diff --name-only -- '*.test.ts' '*.test.tsx'`의 기존 수정 파일은 24개다. 아래 파일 집합을 처분 표에서 독립적으로 만든 뒤 `changed | Where-Object { $_ -notin $allowed }`로 비교했다. **changed − allowed = 0줄**. 파일 일치 후 `git diff --unified=1`의 각 hunk를 다음 처분과 대조했다.

| 파일 / 기존 케이스 변경 | 처분 |
|---|---|
| git-diff.test: 좌표 반복 조회, 캐시 격리 제거 | R1·R2 |
| git-diff.test: uncommitted 단언 4곳(해당 필드만 보던 케이스 포함) 제거 | R5 |
| git-diff.test: fake probe 응답·실제 존재 cwd·gateway seam | R13 |
| git-diff.test: unborn 내부 range 정확 비교 | R24 |
| gitQueryReason.test: effect 하나의 의존성 | R3 |
| gitQueryOwner.test: snapshot 소유자 추가, 구 summary 소유자 0 | R4 |
| git-diff-schema.test: 문서 채널·uncommitted 부재 | R6 |
| gitSnapshotQuery·gitRow.availability·GitContextBar.actions·GitContextBar.render·diffComparison·diffPanel0211dv6.render·diffReviewNavigation·diffSyncState.render·diffTile.render·sessionChangesData·chatReducer.diffRequirementSelection·chatReducer.plan | R7, fixture 필드만 삭제 |
| git-cli.test: status가 snapshot(false)를 호출; checkout 정확 비교에 status 추가 | R9·R16 |
| handlers/git.test: snapshot 채널·baseline mock·fallback | R11 |
| reject-reasons.test: unavailable/not-repo/invalid-path의 probe seam | R12·R23 |
| gitSnapshotQuery.test: 늦은 status도 폐기 | R15 |
| branchChipState.test: switched의 status 전달 | R17 |
| BranchChip.defer.test: checkout mock status | R18 |
| runner.test: 절대 실행 파일 기대 | R21 |
| prepare-worktree.test: 새 세션 probe·resume 0호출 | R22 |
| worktrees/ipc-integration.test: CALL_AXIS 양성 표본 이동 | R25 |

R8의 비교 모드 단언은 그대로다. R14·R19·R20의 `gitIdentityRemoteWiring.test.ts`·`queue-entry.test.ts`·`git-diff-commit.test.ts`는 `git diff --numstat -- <세 경로>` 출력 0줄이다. 새 파일·새 케이스는 §23.2 AC24 ②에 따라 별도로 추가했다. 정확 일치를 부분 일치로 완화한 기존 케이스는 없다.

## 적대 증거 재현

`r1-mutations.cjs`는 한 번에 한 변이만 심고 `finally`에서 원문을 복구한다. **깨끗한 작업 디렉터리에서**, `app/` 기준 아래처럼 실행한다. 각 index 범위는 끝을 포함하지 않는다.

```powershell
New-Item -ItemType Directory -Force node_modules/.cache/orca/0241
node ../docs/handoff/0241-git-gateway-spawn-reduction/evidence/r1-mutations.cjs 0 10
node ../docs/handoff/0241-git-gateway-spawn-reduction/evidence/r1-mutations.cjs 10 21
node ../docs/handoff/0241-git-gateway-spawn-reduction/evidence/r1-mutations.cjs 21 22
node --test scripts/git-boundary.test.mjs
```

실행 결과는 `r1-mutations.json`에 보존했다. M01~M22 모두 exit 1과 실제 테스트 실패를 함께 확인했으며 단순 실행 오류를 red로 세지 않았다. M02는 posix/win32 2케이스 실패, 나머지는 각각 1케이스 실패다. M22는 feature에 직접 runGit 호출을 심어 R25의 기존 소스 스윕도 red인지 확인한다. lint 변이 7개는 `ESLint.lintText`로 production 경로에 같은 rule을 적용하고 severity 2·예상 ruleId를 단언한다.

추가 리뷰 P2는 실제 `useGitSnapshot`을 mock React lifecycle로 실행해 재현했다. 수정 전 session 전환·StrictMode 두 케이스가 `setGitStatus` 0호출로 실패했고, 수정 후 4케이스가 통과했다. 같은 cwd의 **진행 중인 status-only** Promise만 새 owner에 연결하며, 추가 API 호출·완료 결과 캐시는 없다. cwd 변경·unmount·summary 세션 전환의 응답 폐기를 함께 확인했다.

EP-08의 구 API 제거 타입 방어도 직접 확인했다. renderer API 파일에 `window.orca.git.status`와 `window.orca.git.diffSummary`를 임시 삽입한 `tsc --noEmit -p tsconfig.web.json --composite false`는 두 줄 각각 TS2339로 실패했다. 원문은 `finally`에서 복구했고 `npm.cmd run typecheck:web`가 다시 통과했다. 이는 기존 컴파일 gate의 음성 확인이며 신설 oracle 분모에 더하지 않는다.
