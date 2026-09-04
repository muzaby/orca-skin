import { describe, expect, it } from 'vitest'
import type { GitDiffPatch } from '../../../../../shared/ipc'
import { chatReducer, initialChatState } from './chatReducer'
import { createDiffRequirementItem } from '../components/rightpanel/diffRequirements'
import { patchLinesToDiffLines } from '../lib/diffPatchLines'

const a = { kind: 'commit' as const, sha: 'a'.repeat(40) }
const b = { kind: 'commit' as const, sha: 'b'.repeat(40) }
const request = { key: 'session-1', generation: 1 }
const patch: GitDiffPatch = {
  isRepo: true,
  base: { kind: 'head', oid: 'parent' },
  files: [
    {
      path: 'a.ts',
      status: 'modified',
      added: 1,
      removed: 0,
      kind: 'text',
      lines: [{ type: 'added', oldLine: null, newLine: 1, text: 'saved line' }]
    }
  ],
  filesTruncated: false,
  contextLimited: false,
  unavailable: false
}

describe('커밋 범위의 패치와 댓글', () => {
  it('A→B 전환은 낡은 본문·초안을 지우고 늦게 도착한 A를 버린다', () => {
    const current = {
      ...initialChatState,
      gitSnapshotRequest: request,
      gitSnapshot: { ...initialChatState.gitSnapshot, comparison: a, patch },
      diffRequirementDraft: {
        key: 'draft',
        filePath: 'a.ts',
        oldLine: null,
        newLine: 1,
        body: 'draft'
      }
    }
    const selected = chatReducer(current, { type: 'SET_DIFF_COMPARISON', comparison: b })
    expect(selected.gitSnapshot.patch).toBeNull()
    expect(selected.diffRequirementDraft).toBeNull()
    expect(
      chatReducer(selected, { type: 'RECEIVE_GIT_PATCH', request, patch, comparison: a })
    ).toBe(selected)
    const loaded = chatReducer(selected, {
      type: 'RECEIVE_GIT_PATCH',
      request,
      patch,
      comparison: b
    })
    expect(loaded.gitSnapshot.patch).toBe(patch)
    expect(chatReducer(loaded, { type: 'SET_DIFF_COMPARISON', comparison: b })).toBe(loaded)
  })

  it('새 세대·다른 세션의 응답은 현재 범위라도 버린다', () => {
    const current = { ...initialChatState, gitSnapshotRequest: request }
    for (const stale of [
      { ...request, key: 'another' },
      { ...request, generation: 0 }
    ]) {
      expect(
        chatReducer(current, {
          type: 'RECEIVE_GIT_PATCH',
          request: stale,
          patch,
          comparison: { kind: 'all' }
        })
      ).toBe(current)
    }
  })

  it('커밋 댓글은 비교 기준을 기록하고 다른 범위 패치가 anchor를 바꾸지 않는다', () => {
    const item = createDiffRequirementItem({
      id: 'comment',
      sessionId: 's1',
      base: patch.base,
      filePath: 'a.ts',
      lines: patchLinesToDiffLines(patch.files[0].lines),
      lineIndex: 0,
      comment: 'keep this',
      createdAt: 1,
      commitSha: a.sha
    })
    expect(item.commitSha).toBe(a.sha)
    expect(item.anchor.baselineCommit).toBe('parent')
    const current = {
      ...initialChatState,
      gitSnapshotRequest: request,
      gitSnapshot: { ...initialChatState.gitSnapshot, comparison: b },
      diffRequirements: [item]
    }
    const next = chatReducer(current, {
      type: 'RECEIVE_GIT_PATCH',
      request,
      comparison: b,
      patch: { ...patch, files: [] }
    })
    expect(next.diffRequirements[0]).toBe(item)
    expect(next.diffRequirements[0].located).toBe(true)
  })
})
