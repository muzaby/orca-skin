export function acceptedSubmitCanClearDraftAndRequirements({
  accepted,
  composing,
  currentDraftRevision,
  submittedDraftRevision,
  attachmentsUnchanged
}: {
  accepted: boolean
  composing: boolean
  currentDraftRevision: number
  submittedDraftRevision: number
  attachmentsUnchanged: boolean
}): boolean {
  return (
    accepted &&
    !composing &&
    currentDraftRevision === submittedDraftRevision &&
    attachmentsUnchanged
  )
}
