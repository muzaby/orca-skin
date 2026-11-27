import { describe, expect, it, vi } from 'vitest'
import { submitComposerInput } from './composerSubmit'
import { createDraftSnapshot, replaceDraft } from './draftSnapshot'

const REQUIREMENTS = {
  sessionKey: 'session-1',
  sessionId: 'session-1',
  ids: ['requirement-1'],
  revision: 1,
  anchors: []
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 테스트 fixture 반환값 추론.
function submitFixture() {
  const submitted = createDraftSnapshot('send this')
  return {
    submitted,
    submittedRequirements: REQUIREMENTS,
    items: [],
    views: [],
    onSend: vi.fn(() => true),
    compositionActive: vi.fn(() => false),
    currentDraft: () => submitted,
    resetAttachmentsIfUnchanged: vi.fn(() => true),
    onClearDiffRequirementsIfUnchanged: vi.fn(),
    updateSnapshot: vi.fn(),
    focus: vi.fn()
  }
}

describe('ComposerInputController submit clear gate', () => {
  it('clears requirements, attachments and text and focuses in the same accepted submit', () => {
    const input = submitFixture()
    submitComposerInput(input)
    expect(input.onSend).toHaveBeenCalledOnce()
    expect(input.resetAttachmentsIfUnchanged).toHaveBeenCalledOnce()
    expect(input.onClearDiffRequirementsIfUnchanged).toHaveBeenCalledExactlyOnceWith(REQUIREMENTS)
    expect(input.updateSnapshot).toHaveBeenCalledOnce()
    expect(input.focus).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('keeps everything when the send is rejected', () => {
    const input = submitFixture()
    input.onSend.mockReturnValue(false)
    submitComposerInput(input)
    expect(input.onSend).toHaveBeenCalledOnce()
    expect(input.resetAttachmentsIfUnchanged).not.toHaveBeenCalled()
    expect(input.onClearDiffRequirementsIfUnchanged).not.toHaveBeenCalled()
    expect(input.updateSnapshot).not.toHaveBeenCalled()
    expect(input.focus).not.toHaveBeenCalled()
  })

  it('does not start a send during IME composition', () => {
    const input = submitFixture()
    input.compositionActive.mockReturnValue(true)
    submitComposerInput(input)
    expect(input.onSend).not.toHaveBeenCalled()
    expect(input.resetAttachmentsIfUnchanged).not.toHaveBeenCalled()
  })

  it('preserves a draft changed by the synchronous send callback', () => {
    const input = submitFixture()
    let current = input.submitted
    input.currentDraft = () => current
    input.onSend.mockImplementation(() => {
      current = replaceDraft(current, 'new draft')
      return true
    })
    submitComposerInput(input)
    expect(input.resetAttachmentsIfUnchanged).not.toHaveBeenCalled()
    expect(input.updateSnapshot).not.toHaveBeenCalled()
  })

  it('preserves text and requirements when the attachment snapshot changed during send', () => {
    const input = submitFixture()
    input.resetAttachmentsIfUnchanged.mockReturnValue(false)
    submitComposerInput(input)
    expect(input.onClearDiffRequirementsIfUnchanged).not.toHaveBeenCalled()
    expect(input.updateSnapshot).not.toHaveBeenCalled()
  })
})
