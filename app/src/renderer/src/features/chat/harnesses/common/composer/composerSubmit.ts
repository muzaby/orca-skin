import type { AttachmentView, ComposerAttachment } from '../../../../../../../shared/ipc'
import type { DiffRequirementSubmitSnapshot } from '../../../store/chatStore'
import { clearDraftAfterAcceptedSubmit, type DraftSnapshot } from './draftSnapshot'

interface ComposerSubmitInput {
  submitted: DraftSnapshot
  submittedRequirements: DiffRequirementSubmitSnapshot
  items: ComposerAttachment[]
  views: AttachmentView[]
  onSend: (
    text: string,
    attachments: ComposerAttachment[],
    attachmentViews: AttachmentView[],
    requirements: DiffRequirementSubmitSnapshot['anchors']
  ) => boolean
  compositionActive: () => boolean
  currentDraft: () => DraftSnapshot
  resetAttachmentsIfUnchanged: (items: ComposerAttachment[]) => boolean
  onClearDiffRequirementsIfUnchanged: (snapshot: DiffRequirementSubmitSnapshot) => void
  updateSnapshot: (update: (current: DraftSnapshot) => DraftSnapshot) => void
  focus: (start: number, end?: number) => void
}

// 준비된 첨부 뷰와 원본을 함께 보내고, 수락된 스냅숏만 같은 입력 처리에서 비운다.
export function submitComposerInput({
  submitted,
  submittedRequirements,
  items,
  views,
  onSend,
  compositionActive,
  currentDraft,
  resetAttachmentsIfUnchanged,
  onClearDiffRequirementsIfUnchanged,
  updateSnapshot,
  focus
}: ComposerSubmitInput): void {
  if (compositionActive()) return
  const accepted = onSend(submitted.text, items, views, submittedRequirements.anchors)
  if (!accepted || compositionActive() || currentDraft().revision !== submitted.revision) return
  if (!resetAttachmentsIfUnchanged(items)) return
  onClearDiffRequirementsIfUnchanged(submittedRequirements)
  updateSnapshot((current) => clearDraftAfterAcceptedSubmit(current, submitted.revision))
  focus(0)
}
