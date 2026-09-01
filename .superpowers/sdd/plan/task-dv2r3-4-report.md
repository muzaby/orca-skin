# ΔV2 r3 Task 4 report

## Scope

Implemented Task 4 only: exact `SendChatMessage.requirements` wire contract, main-only requirement serialization, and carrier survival through the eight attachment-adjacent main hops. Renderer requirement creation/consumption remains for Task 5.

## Production changes

- Added shared contract types in `app/src/shared/ipc.ts`
  - `DiffRequirementAnchor` with the exact 10 wire keys
  - `DiffRequirementItem = { id, anchor, located }`
  - `SendChatMessage.requirements?: DiffRequirementAnchor[]`
- Added strict shared schema in `app/src/shared/protocol.ts`
  - `requirements` defaults to `[]`
  - relative-path / no-`..` rule reused from diff-path policy
  - `oldLine/newLine`: `number | null`
  - `contextBefore/contextAfter`: max 3 lines, max 200 chars per line
  - `comment`: max 2000 chars
  - `createdAt`: integer epoch ms
  - unknown anchor keys are stripped at parse time
- Added main-only serializer `app/src/main/adapters/diff-requirements.ts`
  - explicit start/end sentinels
  - escaped machine-readable attrs
  - neutralized sentinel / closing-tag user content
- Integrated serialized requirements into `buildTurnContent` in `app/src/main/adapters/claude.ts`
  - empty requirements keep pre-change bytes
  - requirements append after attachment text blocks and before image blocks
- Mirrored `requirements` through the exact 8-hop main carrier path
  1. `app/src/main/app/chat-turn/send.ts`
  2. `app/src/main/app/chat-turn/enqueue.ts`
  3. `app/src/main/features/chat/pending-message-queue.ts`
  4. `app/src/main/app/chat-turn/busy-reserve.ts`
  5. `app/src/main/app/chat-turn/continuation.ts`
  6. `app/src/main/features/sessions/session-runtime.ts`
  7. `app/src/main/adapters/turn.ts`
  8. `app/src/main/adapters/claude.ts`
- Kept attachment and continuation semantics intact; queue merge uses the same `flatMap` rule as attachments.

## TDD record

### Pre-flight correction

First run used repo-relative paths from the wrong working directory:

```text
RUN  v4.1.10 C:/workspace/github/codex/orca-skin/app
No test files found, exiting with code 1
filter: app/src/shared/protocol.send.test.ts, ...
include: src/**/*.test.ts
```

This was a path filter mistake, not the intended RED.

### RED

Command:

```text
npx.cmd vitest run src/shared/protocol.send.test.ts src/main/adapters/build-turn-content.test.ts src/main/adapters/diff-requirements.test.ts src/main/features/chat/pending-message-queue.test.ts src/main/app/chat-turn/continuation.test.ts src/main/app/chat-turn/send.worktree.test.ts src/main/features/sessions/session-runtime.test.ts
```

Exact result:

```text
Test Files  7 failed (7)
Tests  10 failed | 142 passed (152)
```

RED reasons matched Task 4 targets:

- missing `requirements` default/schema in `SendChatMessageSchema`
- missing formatter module
- `buildTurnContent` not including requirement blocks
- queue merge not preserving requirements
- continuation flush inheriting stale base requirements
- send path not carrying requirements into `TurnRequest`
- session-runtime `pushTurn` not forwarding requirements

### GREEN

Same focused command after production changes:

```text
Test Files  7 passed (7)
Tests  155 passed (155)
```

Additional focused adapter/continuation regressions:

```text
npx.cmd vitest run src/main/adapters/claude.eventbatches.test.ts src/main/adapters/claude.fork.test.ts src/main/adapters/claude.steer-replay.test.ts src/main/app/chat-turn-continuation.test.ts
```

Result:

```text
Test Files  4 passed (4)
Tests  14 passed (14)
```

## Verification commands

Passed:

```text
npm.cmd run typecheck:node
npm.cmd run typecheck:web
npm.cmd run typecheck:test
npx.cmd eslint --max-warnings=0 src/shared/ipc.ts src/shared/protocol.ts src/shared/protocol.send.test.ts src/main/adapters/claude.ts src/main/adapters/turn.ts src/main/adapters/build-turn-content.test.ts src/main/adapters/diff-requirements.ts src/main/adapters/diff-requirements.test.ts src/main/app/chat-turn/deps.ts src/main/app/chat-turn/send.ts src/main/app/chat-turn/enqueue.ts src/main/app/chat-turn/busy-reserve.ts src/main/app/chat-turn/continuation.ts src/main/app/chat-turn/continuation.test.ts src/main/app/chat-turn/send.worktree.test.ts src/main/features/chat/pending-message-queue.ts src/main/features/chat/pending-message-queue.test.ts src/main/features/sessions/session-runtime.ts src/main/features/sessions/session-runtime.test.ts
git diff --check
```

## Files changed

- `app/src/shared/ipc.ts`
- `app/src/shared/protocol.ts`
- `app/src/shared/protocol.send.test.ts`
- `app/src/main/adapters/turn.ts`
- `app/src/main/adapters/claude.ts`
- `app/src/main/adapters/build-turn-content.test.ts`
- `app/src/main/adapters/diff-requirements.ts`
- `app/src/main/adapters/diff-requirements.test.ts`
- `app/src/main/app/chat-turn/deps.ts`
- `app/src/main/app/chat-turn/send.ts`
- `app/src/main/app/chat-turn/enqueue.ts`
- `app/src/main/app/chat-turn/busy-reserve.ts`
- `app/src/main/app/chat-turn/continuation.ts`
- `app/src/main/app/chat-turn/continuation.test.ts`
- `app/src/main/app/chat-turn/send.worktree.test.ts`
- `app/src/main/features/chat/pending-message-queue.ts`
- `app/src/main/features/chat/pending-message-queue.test.ts`
- `app/src/main/features/sessions/session-runtime.ts`
- `app/src/main/features/sessions/session-runtime.test.ts`

## Self-review

- Verified exact 10-key anchor equality and UI-only key stripping at the wire boundary.
- Verified caps/nullability/path/epoch rules in schema tests.
- Verified serializer sentinel wrapping, attribute escaping, and neutralization against embedded sentinel strings and `</comment>`-style breakout.
- Verified empty requirements leave turn content unchanged on the string-only path.
- Verified direct send, queued merge, continuation flush, runtime `pushTurn`, and adapter content integration.
- Added a production sweep asserting all 8 named carrier files contain requirement handling; this is supplemental, not the sole oracle.

## Concerns

- No unresolved architecture blocker found.
- Task 5 still needs to create/send renderer requirement items against this exact contract and consume the main prompt behavior end-to-end.

## Fix round 1 — reviewer findings on 2026-09-01

### Scope

Applied only the two Important findings from the external review on top of `37adf976`:

1. `send.ts` dropped prior held structured payloads when `enqueueTurnPrompt()` returned a merged `mainBatch`.
2. `GitDiffPathSchema` still accepted Windows root-relative and UNC paths.

### RED

Focused RED command:

```text
npx.cmd vitest run src/main/app/chat-turn/send.worktree.test.ts src/shared/git-diff-schema.test.ts
```

Observed RED:

```text
Test Files  2 failed (2)
Tests  2 failed | 23 passed (25)
```

Expected failures:

- `send.worktree.test.ts`: merged turn-open batch still built `TurnRequest` from current `normalizedAttachments` and `payload.requirements`, so prior held A payloads were absent.
- `git-diff-schema.test.ts`: `\\repo\\file.ts` and `\\\\server\\share\\file.ts` still parsed as valid relative paths.

### GREEN

After the production fixes, the same focused command passed:

```text
Test Files  2 passed (2)
Tests  25 passed (25)
```

### Production fix

- `app/src/main/app/chat-turn/send.ts`
  - `TurnRequest` attachment text/image arrays and `requirements` now come from `mainBatch`, which is the single correct source for both item-only and merged turn-open batches.
  - This preserves FIFO merged payload order and avoids introducing a second payload path.
- `app/src/shared/protocol.ts`
  - `GitDiffPathSchema` now rejects any leading `/` or `\`, while still rejecting drive paths and `..` traversal and still allowing safe relative git paths.

### Regression and gate commands

Regression sweep:

```text
npx.cmd vitest run src/main/app/chat-turn/send.worktree.test.ts src/main/features/chat/pending-message-queue.test.ts src/main/app/chat-turn/continuation.test.ts src/main/app/chat-turn-continuation.test.ts src/main/features/sessions/session-runtime.test.ts src/shared/git-diff-schema.test.ts src/shared/protocol.send.test.ts src/main/adapters/build-turn-content.test.ts src/main/adapters/diff-requirements.test.ts src/main/adapters/claude.eventbatches.test.ts src/main/adapters/claude.fork.test.ts src/main/adapters/claude.steer-replay.test.ts
```

Result:

```text
Test Files  12 passed (12)
Tests  179 passed (179)
```

Type/lint/hygiene:

```text
npm.cmd run typecheck:node
npm.cmd run typecheck:test
npx.cmd eslint --max-warnings=0 src/main/app/chat-turn/send.ts src/main/app/chat-turn/send.worktree.test.ts src/shared/protocol.ts src/shared/git-diff-schema.test.ts
git diff --check
```

Observed results:

- `typecheck:node` passed.
- `typecheck:test` initially failed because the new `send.worktree` mock `mainBatch` fixtures omitted required `SteerFlushBatch.ids/createdAt`; after fixture correction it passed.
- touched-file lint passed.
- `git diff --check` passed.

### Files changed in fix round 1

- `app/src/main/app/chat-turn/send.ts`
- `app/src/main/app/chat-turn/send.worktree.test.ts`
- `app/src/shared/protocol.ts`
- `app/src/shared/git-diff-schema.test.ts`

### Self-review

- Confirmed the merged turn-open case now sends `text`, `promptUuid`, `attachmentTexts`, `attachmentImages`, and `requirements` from the same `mainBatch` source.
- Confirmed direct/item-only send still stays green because its `mainBatch` is the queued item itself.
- Confirmed the path guard now blocks both root-relative backslash paths and UNC paths without broadening accepted relative path forms.
