# ΔV2 r3 Task 5 report

## Scope

Finished Task 5 only on top of the preserved in-scope working diff inherited from the interrupted `gpt-5.5` implementer. BASE and local `HEAD` before and after Task 5 work remained `7e49fec4b8a6c5b7b81f01c3e58baf6b0ca04f24`.

The original pre-production RED history from the interrupted implementer was unavailable and was not reconstructed.

## Inherited snapshot

### Local inherited snapshot before edits

Focused changed/new Task 5 test files:

```text
npx.cmd vitest run
  src/renderer/src/features/chat/components/rightpanel/diffFileCache.test.ts
  src/renderer/src/features/chat/components/rightpanel/diffPeek.render.test.ts
  src/renderer/src/features/chat/reducer/chatReducer.plan.test.ts
  src/renderer/src/features/chat/store/chatStore.test.ts
  src/renderer/src/features/chat/components/composer/Composer.requirements.render.test.ts
  src/renderer/src/features/chat/components/composer/ComposerInputController.test.ts
  src/renderer/src/features/chat/components/composer/RequirementTray.render.test.ts
  src/renderer/src/features/chat/components/rightpanel/DiffTileContent.bridge.test.ts
  src/renderer/src/features/chat/components/rightpanel/diffRequirements.test.ts
```

Observed result:

```text
Test Files  9 passed (9)
Tests  101 passed (101)
Duration  7.96s
```

### Controller-observed inherited snapshot

Controller independently re-ran the inherited focused snapshot on September 1, 2026, including the same Task 5 files plus resource parity coverage.

Observed result:

```text
Test Files  10 passed (10)
Tests  104 passed (104)
Duration  15.67s
```

Ruling: there was no trustworthy inherited RED to continue from; the preserved working diff was already green on the focused Task 5 surface.

## Production changes retained and completed

- Requirement creation and reanchor stayed in the renderer-only Task 5 surface:
  - exact 10-key `DiffRequirementAnchor`
  - `HEAD` sentinel for `GitDiffBase.kind === 'none'`
  - nullable add/delete axes
  - capped `contextBefore` / `contextAfter` / `comment`
  - deterministic hunk header generation
  - duplicate-nearest reanchor and no-match `located:false` retention
- Session-local reducer/store state stayed transient only:
  - `diffRequirements`
  - `diffRequirementsRevision`
  - `diffRequirementDraft`
  - `diffRequirementBodyRequest`
- Reanchor stayed guarded by captured session slot, `sessionId`, path, and body generation, and only runs from the current text-body bridge.
- Unavailable/error bodies preserve the prior requirement `located` state.
- Send lifecycle stayed attachment-shaped:
  - anchors-only wire payload
  - clear only on `onSend(...) === true` plus unchanged submitted snapshot
  - retain on `false`, session mismatch, in-flight add/remove/draft/reanchor, and async cross-session send attempts
- Composer stacking now places `RequirementTray` under `GitRow` and above `ComposerInputController`, with ko/en labels and remove a11y.

## Lint-only completion work

The inherited functional diff was green, but touched-file `eslint --max-warnings=0` was initially blocked on September 1, 2026 by:

```text
- diffRequirements.ts: 2 explicit-return-type errors
- Composer.tsx: unnecessary useMemo dependency warning
- ComposerInputController.tsx: react-refresh/only-export-components warning
- DiffTileContent.tsx: 2 react-refresh/only-export-components warnings + 1 prettier warning
- chatReducer.plan.test.ts: 1 prettier warning
```

Minimal completion edits:

- added explicit return types in `diffRequirements.ts`
- moved diff-body bridge helpers into `rightpanel/diffRequirementBridge.ts`
- moved submit-clear helper into `composer/submitClearGate.ts`
- removed the unnecessary requirement snapshot `useMemo` wrapper in `Composer.tsx`
- normalized the two prettier warnings without changing behavior

No functional Task 5 behavior was redesigned during this completion pass.

## Final regression and gate results

### Broader renderer/regression sweep

```text
npx.cmd vitest run
  src/renderer/src/features/chat/components/rightpanel/diffFileCache.test.ts
  src/renderer/src/features/chat/components/rightpanel/diffPeek.render.test.ts
  src/renderer/src/features/chat/components/rightpanel/DiffTileContent.bridge.test.ts
  src/renderer/src/features/chat/components/rightpanel/diffRequirements.test.ts
  src/renderer/src/features/chat/components/rightpanel/sessionChangesData.test.ts
  src/renderer/src/features/chat/components/rightpanel/sessionChangesList.render.test.ts
  src/renderer/src/features/chat/components/rightpanel/peekNavigation.test.ts
  src/renderer/src/features/chat/components/rightpanel/diffPeekRequest.test.ts
  src/renderer/src/features/chat/components/rightpanel/diffTile.render.test.ts
  src/renderer/src/features/chat/components/rightpanel/diffTileMockRemoved.test.ts
  src/renderer/src/features/chat/reducer/chatReducer.plan.test.ts
  src/renderer/src/features/chat/store/chatStore.test.ts
  src/renderer/src/features/chat/components/composer/Composer.requirements.render.test.ts
  src/renderer/src/features/chat/components/composer/ComposerInputController.test.ts
  src/renderer/src/features/chat/components/composer/RequirementTray.render.test.ts
```

Observed result:

```text
Test Files  15 passed (15)
Tests  123 passed (123)
Duration  26.01s
```

### Type and hygiene gates

Observed on September 1, 2026:

```text
npm.cmd run typecheck:web   -> exit 0
npm.cmd run typecheck:test  -> exit 0
npx.cmd eslint --max-warnings=0 <all touched/new Task 5 files> -> exit 0
git diff --check -> exit 0
```

## Files changed

- `app/src/renderer/src/features/chat/components/Composer.tsx`
- `app/src/renderer/src/features/chat/components/composer/Composer.requirements.render.test.ts`
- `app/src/renderer/src/features/chat/components/composer/ComposerInputController.test.ts`
- `app/src/renderer/src/features/chat/components/composer/ComposerInputController.tsx`
- `app/src/renderer/src/features/chat/components/composer/RequirementTray.render.test.ts`
- `app/src/renderer/src/features/chat/components/composer/RequirementTray.tsx`
- `app/src/renderer/src/features/chat/components/composer/submitClearGate.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/DiffPeek.tsx`
- `app/src/renderer/src/features/chat/components/rightpanel/DiffTileContent.bridge.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/DiffTileContent.tsx`
- `app/src/renderer/src/features/chat/components/rightpanel/diffFileCache.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/diffFileCache.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/diffPeek.render.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/diffRequirementBridge.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/diffRequirements.test.ts`
- `app/src/renderer/src/features/chat/components/rightpanel/diffRequirements.ts`
- `app/src/renderer/src/features/chat/reducer/chatReducer.plan.test.ts`
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts`
- `app/src/renderer/src/features/chat/store/chatStore.test.ts`
- `app/src/renderer/src/features/chat/store/chatStore.ts`
- `app/src/renderer/src/shared/i18n/resources/en.ts`
- `app/src/renderer/src/shared/i18n/resources/ko.ts`
- `.superpowers/sdd/plan/task-dv2r3-5-report.md`

## Oracle audit

- `DiffTileContent.bridge.test.ts` now exercises the extracted production bridge helper behavior directly and also verifies that `DiffTileContent.tsx` imports and calls that bridge path.
- `chatStore.test.ts` includes the cross-session async send rejection oracle: a captured requirement snapshot from one session is rejected after switching the active session, and no payload is sent.
- `chatReducer.plan.test.ts` covers:
  - no revision bump when no requirement item matches the reanchor path
  - revision bump on current-body reanchor outcomes
  - draft edits bumping revision
  - stale generation/session guards
- wire payload assertions continue to prove `located` never crosses the wire.

## Concerns

- No unresolved Task 5 blocker remains in the renderer/store surface.
- Task 6 is still pending for effective-V closeout, manual viewport evidence, final handoff gates, and independent verification.
- This report records implementation evidence only. It does not claim verify/PASS.

## Fix round 1 — submit lifecycle and equal-distance reanchor oracles

Fresh review found that the pure clear-gate/store tests did not drive the controller's real asynchronous submit lifecycle, and that equal-distance duplicate reanchor tie-breaking was implicit.

- Test-first RED: adding the real submit-lifecycle cases before the production seam existed produced 3 failing cases (`submitComposerInput is not a function`); the equal-distance reanchor case was already green against the intended first-seen implementation.
- Production path: `ComposerInputController.submit()` now delegates the complete async conversion → send → unchanged snapshot → coordinated clear lifecycle to `composerSubmit.ts`. A source oracle pins one delegation and rejects a direct clear-call bypass in the controller.
- Submit lifecycle oracles: an accepted unchanged submit clears requirements/draft/attachments together; `onSend === false`, draft revision drift during delayed attachment-view creation, and attachment identity drift all retain requirements.
- Premature-clear mutation: moving `onClearDiffRequirementsIfUnchanged(...)` ahead of the accepted/unchanged gate in the final `composerSubmit.ts` seam produced 3/5 RED; restoring the gate returned the suite to GREEN.
- Equal-distance mutation: changing the winner comparison from `<` to `<=` produced 1/5 RED (`expected 8, received 12`); restoring `<` returned the first-seen tie contract to GREEN.
- Final focused Task 5 sweep: 15/15 files, 129/129 tests GREEN.
- Gates: `typecheck:web`, `typecheck:test`, strict lint for the four fix files, and `git diff --check` all exited 0. The initial in-component exported seam produced the expected Fast Refresh warning, so the orchestration moved to a non-component module without weakening the source oracle.
