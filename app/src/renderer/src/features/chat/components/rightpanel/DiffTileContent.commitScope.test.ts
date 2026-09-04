import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { initialChatState, type ChatState } from '../../reducer/chatReducer'
import type { DiffReview } from './DiffReview'
import { createDiffRequirementItem } from './diffRequirements'
const h = vi.hoisted(() => ({ state: null as unknown as ChatState, add: vi.fn(), draft: vi.fn() }))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useCallback: (fn: unknown) => fn
}))
vi.mock('../../hooks/useGitPatch', () => ({ useGitPatch: () => {} }))
vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (state: ChatState) => unknown) => select(h.state),
  chatActions: { addDiffRequirement: h.add, setDiffRequirementDraft: h.draft }
}))
import { DiffTileContent } from './DiffTileContent'
const sha = 'a'.repeat(40)
const parent = 'b'.repeat(40)
const lines = [
  { type: 'added' as const, lineNo: 101, oldLine: null, newLine: 101, text: 'selected commit' }
]
beforeEach(() => {
  h.add.mockClear()
  h.draft.mockClear()
  h.state = {
    ...initialChatState,
    sessionId: 's1',
    gitSnapshot: {
      ...initialChatState.gitSnapshot,
      comparison: { kind: 'commit', sha },
      patch: {
        isRepo: true,
        base: { kind: 'commit-parent', oid: parent, commitOid: sha },
        files: [],
        filesTruncated: false,
        contextLimited: false,
        unavailable: false
      }
    },
    diffRequirementDraft: {
      key: 'line',
      filePath: 'a.ts',
      oldLine: null,
      newLine: 101,
      body: 'comment'
    }
  }
})
describe('DiffTileContent 댓글 비교 범위 배선', () => {
  it('요약 없이도 현재 패치의 실제 부모를 anchor 기준선으로 기록한다', () => {
    const props = DiffTileContent().props as ComponentProps<typeof DiffReview>
    props.onAddRequirement!({ lines, lineIndex: 0, comment: 'comment' })
    expect(h.add).toHaveBeenCalledWith(
      expect.objectContaining({
        commitSha: sha,
        anchor: expect.objectContaining({ baselineCommit: parent, filePath: 'a.ts', newLine: 101 })
      })
    )
    expect(h.draft).toHaveBeenCalledWith(null)
  })
  it('다른 커밋과 전체 범위의 댓글 표식은 현재 패널에 보내지 않는다', () => {
    const input = {
      id: 'selected',
      sessionId: 's1',
      base: h.state.gitSnapshot.patch!.base,
      filePath: 'a.ts',
      lines,
      lineIndex: 0,
      comment: 'comment',
      createdAt: 0
    }
    const selected = createDiffRequirementItem({ ...input, commitSha: sha })
    h.state.diffRequirements = [
      selected,
      createDiffRequirementItem({ ...input, id: 'all' }),
      createDiffRequirementItem({ ...input, id: 'other', commitSha: 'c'.repeat(40) })
    ]
    const props = DiffTileContent().props as ComponentProps<typeof DiffReview>
    expect(props.requirements).toEqual([selected])
    expect(h.state.diffRequirements).toHaveLength(3)
  })
})
