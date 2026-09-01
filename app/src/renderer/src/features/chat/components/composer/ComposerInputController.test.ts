import { describe, expect, it } from 'vitest'
import { acceptedSubmitCanClearDraftAndRequirements } from './submitClearGate'

describe('ComposerInputController submit clear gate', () => {
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
})
