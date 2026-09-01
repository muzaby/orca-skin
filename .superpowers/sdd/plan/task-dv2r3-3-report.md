# ΔV2 r3 Task 3 구현 보고서

## 상태

- 완료 범위: Task 3 renderer session changes / diff peek / hunk expansion / snapshot ownership.
- 전체 0211 handoff 상태: Task 4~6 및 독립 검증이 남아 있으므로 구현 커밋 trailer는 `Status: partial`로 남긴다.
- 시작 시 HEAD: `7fb1ce0251f83ecd990ac4b7eb594a46d3caa3ee` (`handoff/0211-worktree-session-ux`).
- 시작 시 dirty scope: Task-3 renderer rightpanel/reducer/store/diffLines/i18n 경로만 확인했다. 이 diff는 이전 구현자의 in-scope 작업으로 보존했고 reset/checkout/discard를 하지 않았다.
- 보고서 추가 외에는 새 scope 확장을 하지 않았다.

## inherited-state note

- 이전 구현자가 남긴 RED 로그는 전달되지 않았다. 그래서 inherited RED는 재구성하거나 꾸미지 않는다.
- 이 세션의 첫 기준 검증은 inherited diff 위에서 수행한 focused GREEN이다.
  - `npx.cmd vitest run ...focused Task-3 suites...`
  - 결과: `Test Files 14 passed (14)`, `Tests 104 passed (104)`.

## 구현 요약

- `useGitSnapshot`가 `gitApi.status`와 `gitApi.diffSummary`를 함께 소유하게 유지했다.
  - summary request key는 cwd/session만 사용한다.
  - trigger key는 cwd/session/refreshGeneration만 사용한다.
  - list/peek 선택, commit 펼침, tile remount는 summary query trigger가 아니다.
  - busy A → idle B 전환은 B identity 조회 1회로 수렴한다.
- reducer/store에 per-session git snapshot state를 유지했다.
  - `summary`, `peekTarget`, `expandedCommitIds`, `refreshGeneration`.
  - peek target은 `{ group: { kind: 'commit', sha } | { kind: 'uncommitted' }, path }` discriminated shape.
  - `SET_CWD`, `NEW_CHAT`, `START_LOAD_SESSION`, `LOAD_SESSION` 경계에서 snapshot이 새 세션 identity로 분리된다.
  - summary 응답은 key+generation guard로 늦은 응답을 버린다.
- diff tile UI를 정확히 두 화면으로 고정했다.
  - `SessionChangesList`: header/totals/chips/commit timeline/body/files/+N/collapse/truncation/unavailable/uncommitted block.
  - `DiffPeek`: path header, `i/N`, session baseline, uncommitted marker, Back, Prev/Next, diff body.
  - Back은 peek만 닫고 summary/expanded state를 건드리지 않는다.
  - Prev/Next는 사용자가 들어온 group 안에서만 이동한다.
- diff body request/cache를 peek identity로 분리했다.
  - body cache key는 cwd/session/group/path를 포함한다.
  - IPC request는 Task-2 session-wide `diffFile` contract만 사용하고 commit argument를 보내지 않는다.
  - 같은 상대 경로라도 새 identity의 늦은 응답은 current body를 채우지 못한다.
- diff line/hunk 순수 파생을 추가/보강했다.
  - `DiffLine`에 `oldLine`/`newLine`을 추가하고 기존 `lineNo`를 보존했다.
  - `buildDiffHunks`와 `expandGap`는 React 없이 검증 가능하다.
  - 200-line fixture의 초기 2 hunk / 3 gap, gap 확장, key/order subsequence, file boundary collapse를 고정했다.
  - 실제 scroll compensation owner/ref는 `DiffPeek` body child에 유지했다.
  - Node/SSR 검증은 순수/마크업 invariant만 담당한다. Task 6 수동 viewport gate를 대체하지 않는다.
- Task-1/2 계약과 right-panel wrapper/registry를 보존했다.
  - old tree/toggle/selected-commit derivation remnants는 제거했다.
  - schema negative test의 `commit` 미포함 assertion은 유지했다.

## TDD evidence

### inherited baseline

- inherited RED logs: unavailable.
- inherited GREEN:
  - command: focused Task-3 vitest suite.
  - result: `14 passed`, `104 passed`.

### 내 신규 RED → GREEN

- RED: tail file-boundary hunk gap에서 scroll compensation 입력이 잘못 계산되는 결함을 먼저 고정했다.
  - added test: `파일 끝 gap 확장은 보정할 다음 hunk가 없으므로 insertedAbove를 0으로 낸다`
  - command: `npx.cmd vitest run src/renderer/src/features/chat/lib/diffHunks.test.ts`
  - result: failed as expected, `expected 0`, `received 5`.
- GREEN: `expandGap`가 다음 visible line이 있는 gap에만 `insertedAbove=count`를 내도록 최소 수정했다.
  - command: `npx.cmd vitest run src/renderer/src/features/chat/lib/diffHunks.test.ts`
  - result: `Test Files 1 passed (1)`, `Tests 4 passed (4)`.

### inherited behavior에 대한 보강 GREEN

- summary trigger matrix와 busy-A→idle-B no-double query를 focused pure tests로 보강했다.
- reducer에서 peek open/back 및 commit expansion이 summary request/generation을 건드리지 않는다는 contract를 보강했다.
- 기존 구현이 이미 만족하던 behavior라 이 항목들은 가짜 RED를 만들지 않았다.

### build/type RED → GREEN

- `typecheck:web`에서 세 compile error를 확인했다.
  - 없는 i18n key `chat.back`.
  - commit group narrowing에서 `target.group.sha` 접근.
  - unused `index`.
- 수정:
  - `header.back` key 사용.
  - `target.group`을 local `group`으로 좁힌 뒤 sha 접근.
  - unused binding 제거.
- 이후 `typecheck:web` GREEN.
- 이후 ESLint `set-state-in-effect` 지적에 대해 `DiffPeekBody` keyed child로 body-local hunk state를 remount 초기화하도록 refactor했다.

## 최종 검증 출력

- Scoped lint:
  - command: `npx.cmd eslint --fix <Task-3 touched renderer files>`
  - result: exit 0, output 없음.
- `typecheck:web`:
  - command: `npm.cmd run typecheck:web`
  - result: exit 0.
- `typecheck:test`:
  - command: `npm.cmd run typecheck:test`
  - result: exit 0.
- Focused pure/reducer/store/query/cache/render/i18n suite:
  - command: `npx.cmd vitest run src/renderer/src/features/chat/lib/diffLines.test.ts src/renderer/src/features/chat/lib/diffHunks.test.ts src/renderer/src/features/chat/components/rightpanel/sessionChangesData.test.ts src/renderer/src/features/chat/components/rightpanel/sessionChangesList.render.test.ts src/renderer/src/features/chat/components/rightpanel/peekNavigation.test.ts src/renderer/src/features/chat/components/rightpanel/diffPeekRequest.test.ts src/renderer/src/features/chat/components/rightpanel/diffFileCache.test.ts src/renderer/src/features/chat/components/rightpanel/diffPeek.render.test.ts src/renderer/src/features/chat/components/rightpanel/diffTile.render.test.ts src/renderer/src/features/chat/components/composer/gitSnapshotQuery.test.ts src/renderer/src/features/chat/components/composer/gitQueryOwner.test.ts src/renderer/src/features/chat/reducer/chatReducer.plan.test.ts src/renderer/src/features/chat/store/chatStore.test.ts src/renderer/src/shared/i18n/resources/resources.test.ts`
  - result: `Test Files 14 passed (14)`, `Tests 107 passed (107)`, `Duration 7.91s`.
- Broader renderer regression suite:
  - command: `npx.cmd vitest run src/renderer/src/features/chat src/renderer/src/shared/i18n/resources src/shared/git-diff-schema.test.ts`
  - result: `Test Files 70 passed (70)`, `Tests 574 passed (574)`, `Duration 40.81s`.
- Diff whitespace:
  - command: `git diff --check`
  - result: exit 0.
- Staged diff whitespace:
  - command: `git diff --cached --check`
  - result: exit 0.

## 변경 파일

- `app/src/renderer/src/features/chat/components/composer/gitSnapshotQuery.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/DiffTileContent.tsx`
- `app/src/renderer/src/features/chat/components/rightpanel/DiffTileHeader.tsx`
- `app/src/renderer/src/features/chat/components/rightpanel/DiffPeek.tsx`
- `app/src/renderer/src/features/chat/components/rightpanel/SessionChangesList.tsx`
- `app/src/renderer/src/features/chat/components/rightpanel/diffFileCache.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/diffFileCache.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/diffPeekRequest.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/diffPeek.render.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/diffTile.render.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/peekNavigation.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/peekNavigation.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/sessionChangesData.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/sessionChangesData.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/sessionChangesList.render.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/diffTileData.ts` 삭제
- `app/src/renderer/src/features/chat/components/rightpanel/diffTileData.test.ts` 삭제
- `app/src/renderer/src/features/chat/components/rightpanel/diffTileFixtures.testlib.ts` 삭제
- `app/src/renderer/src/features/chat/components/rightpanel/diffTileTree.ts` 삭제
- `app/src/renderer/src/features/chat/components/rightpanel/diffTileTree.test.ts` 삭제
- `app/src/renderer/src/features/chat/lib/diffLines.ts`
- `app/src/renderer/src/features/chat/lib/diffLines.test.ts`
- `app/src/renderer/src/features/chat/lib/diffHunks.ts`
- `app/src/renderer/src/features/chat/lib/diffHunks.test.ts`
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts`
- `app/src/renderer/src/features/chat/reducer/chatReducer.plan.test.ts`
- `app/src/renderer/src/features/chat/store/chatStore.ts`
- `app/src/renderer/src/features/chat/store/chatStore.test.ts`
- `app/src/renderer/src/shared/i18n/resources/en.ts`
- `app/src/renderer/src/shared/i18n/resources/ko.ts`
- `.superpowers/sdd/plan/task-dv2r3-3-report.md`

## self-review

- Dirty scope: renderer Task-3 files와 이 보고서만 포함한다.
- Old API remnants: `selectedCommit`, old tree/toggle data derivations, old diff tile data/tree helpers are removed. Remaining `commit` search hit is the shared schema test that asserts `GitDiffFileRequest` has no commit argument.
- Request ownership: summary owner is `useGitSnapshot`; body owner is `DiffTileContent` local cache only.
- Generation guards: summary and body both key+generation 또는 generation guard를 가진다.
- AT-26: initial commit preview 2 rows, normal 8 rows `+6` then all 8+collapse, truncated 51/50 expands loaded 50 rows and does not show clickable `+1`.
- Null metadata: commit `fileCount/totals === null` shows unavailable, not zero.
- Scroll compensation: `data-diff-peek-scroll-owner` and DOM ref are in the actual component. SSR tests only check inspectable surface.
- No dependency, network, unrelated refactor, destructive git command, or handoff full-plan read was used.

## concerns / remaining work

- Independent verifier has not run yet.
- Task 6 manual viewport gate remains required for real scroll behavior; this Task-3 Node/SSR coverage intentionally does not replace it.
- Full 0211 work is still partial because later tasks own requirement UI and manual viewport validation.
