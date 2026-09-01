import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { AttachmentView } from '../../../../../../shared/ipc'
import { submitComposerInput } from './composerSubmit'
import { createDraftSnapshot, type DraftSnapshot } from './draftSnapshot'
import { acceptedSubmitCanClearDraftAndRequirements } from './submitClearGate'

const REQUIREMENTS = {
  sessionKey: 'session-1',
  sessionId: 'session-1',
  ids: ['requirement-1'],
  revision: 1,
  anchors: []
}

describe('ComposerInputController submit clear gate', () => {
  it('delegates the controller submit lifecycle without a direct clear bypass', () => {
    const source = readFileSync(new URL('./ComposerInputController.tsx', import.meta.url), 'utf8')

    expect(source.match(/void submitComposerInput\(\{/g)).toHaveLength(1)
    expect(source.match(/onClearDiffRequirementsIfUnchanged\(/g) ?? []).toHaveLength(0)
  })

  it('accepted submit clears requirements only when draft composition and attachments are unchanged', () => {
    expect(
      acceptedSubmitCanClearDraftAndRequirements({
        accepted: true,
        composing: false,
        currentDraftRevision: 3,
        submittedDraftRevision: 3,
        attachmentsUnchanged: true
      })
    ).toBe(true)

    expect(
      acceptedSubmitCanClearDraftAndRequirements({
        accepted: false,
        composing: false,
        currentDraftRevision: 3,
        submittedDraftRevision: 3,
        attachmentsUnchanged: true
      })
    ).toBe(false)
    expect(
      acceptedSubmitCanClearDraftAndRequirements({
        accepted: true,
        composing: true,
        currentDraftRevision: 3,
        submittedDraftRevision: 3,
        attachmentsUnchanged: true
      })
    ).toBe(false)
    expect(
      acceptedSubmitCanClearDraftAndRequirements({
        accepted: true,
        composing: false,
        currentDraftRevision: 4,
        submittedDraftRevision: 3,
        attachmentsUnchanged: true
      })
    ).toBe(false)
    expect(
      acceptedSubmitCanClearDraftAndRequirements({
        accepted: true,
        composing: false,
        currentDraftRevision: 3,
        submittedDraftRevision: 3,
        attachmentsUnchanged: false
      })
    ).toBe(false)
  })

  it('does not clear requirements when the real async submit path is rejected', async () => {
    const submitted = createDraftSnapshot('send this')
    const onClearDiffRequirementsIfUnchanged = vi.fn()
    const resetAttachmentsIfUnchanged = vi.fn(() => true)

    await submitComposerInput({
      submitted,
      submittedRequirements: REQUIREMENTS,
      items: [],
      buildAttachmentViews: async () => [],
      onSend: vi.fn(() => false),
      compositionActive: () => false,
      currentDraft: () => submitted,
      resetAttachmentsIfUnchanged,
      onClearDiffRequirementsIfUnchanged,
      updateSnapshot: vi.fn(),
      focus: vi.fn()
    })

    expect(resetAttachmentsIfUnchanged).not.toHaveBeenCalled()
    expect(onClearDiffRequirementsIfUnchanged).not.toHaveBeenCalled()
  })

  it('clears requirements with draft and attachments after an accepted unchanged submit', async () => {
    const submitted = createDraftSnapshot('send this')
    const onClearDiffRequirementsIfUnchanged = vi.fn()
    const updateSnapshot = vi.fn()
    const focus = vi.fn()

    await submitComposerInput({
      submitted,
      submittedRequirements: REQUIREMENTS,
      items: [],
      buildAttachmentViews: async () => [],
      onSend: vi.fn(() => true),
      compositionActive: () => false,
      currentDraft: () => submitted,
      resetAttachmentsIfUnchanged: vi.fn(() => true),
      onClearDiffRequirementsIfUnchanged,
      updateSnapshot,
      focus
    })

    expect(onClearDiffRequirementsIfUnchanged).toHaveBeenCalledOnce()
    expect(onClearDiffRequirementsIfUnchanged).toHaveBeenCalledWith(REQUIREMENTS)
    expect(updateSnapshot).toHaveBeenCalledOnce()
    expect(focus).toHaveBeenCalledWith(0)
  })

  it('does not clear requirements when async attachment conversion finishes after draft drift', async () => {
    const submitted = createDraftSnapshot('send this')
    let current: DraftSnapshot = submitted
    let resolveViews!: (views: AttachmentView[]) => void
    const views = new Promise<AttachmentView[]>((resolve) => {
      resolveViews = resolve
    })
    const onClearDiffRequirementsIfUnchanged = vi.fn()
    const resetAttachmentsIfUnchanged = vi.fn(() => true)

    const completion = submitComposerInput({
      submitted,
      submittedRequirements: REQUIREMENTS,
      items: [],
      buildAttachmentViews: () => views,
      onSend: vi.fn(() => true),
      compositionActive: () => false,
      currentDraft: () => current,
      resetAttachmentsIfUnchanged,
      onClearDiffRequirementsIfUnchanged,
      updateSnapshot: vi.fn(),
      focus: vi.fn()
    })

    current = { ...submitted, revision: submitted.revision + 1, text: 'new draft' }
    resolveViews([])
    await completion

    expect(resetAttachmentsIfUnchanged).not.toHaveBeenCalled()
    expect(onClearDiffRequirementsIfUnchanged).not.toHaveBeenCalled()
  })

  it('does not clear requirements when attachments drift during async submit', async () => {
    const submitted = createDraftSnapshot('send this')
    const onClearDiffRequirementsIfUnchanged = vi.fn()

    await submitComposerInput({
      submitted,
      submittedRequirements: REQUIREMENTS,
      items: [],
      buildAttachmentViews: async () => [],
      onSend: vi.fn(() => true),
      compositionActive: () => false,
      currentDraft: () => submitted,
      resetAttachmentsIfUnchanged: vi.fn(() => false),
      onClearDiffRequirementsIfUnchanged,
      updateSnapshot: vi.fn(),
      focus: vi.fn()
    })

    expect(onClearDiffRequirementsIfUnchanged).not.toHaveBeenCalled()
  })
})
