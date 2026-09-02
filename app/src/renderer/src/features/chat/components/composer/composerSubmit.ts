import type { AttachmentView, ComposerAttachment } from '../../../../../../shared/ipc'
import type { DiffRequirementSubmitSnapshot } from '../../store/chatStore'
import { acceptedSubmitCanClearDraftAndRequirements } from './submitClearGate'
import { clearDraftAfterAcceptedSubmit, type DraftSnapshot } from './draftSnapshot'

interface ComposerSubmitInput {
  submitted: DraftSnapshot
  submittedRequirements: DiffRequirementSubmitSnapshot
  items: ComposerAttachment[]
  buildAttachmentViews: (items: ComposerAttachment[]) => Promise<AttachmentView[]>
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

// 비동기 attachment view 생성부터 성공 시 text/attachment/requirement를 함께 비우는 데까지가
// 하나의 submit 수명주기다. 이 함수가 실제 컨트롤러 경로의 전체 clear 경계를 소유해,
// 거절 또는 비동기 완료 중 상태 변경이 어느 한 종류의 입력만 지우지 못하게 한다.
export async function submitComposerInput({
  submitted,
  submittedRequirements,
  items,
  buildAttachmentViews,
  onSend,
  compositionActive,
  currentDraft,
  resetAttachmentsIfUnchanged,
  onClearDiffRequirementsIfUnchanged,
  updateSnapshot,
  focus
}: ComposerSubmitInput): Promise<void> {
  const views = await buildAttachmentViews(items)
  const accepted = onSend(submitted.text, items, views, submittedRequirements.anchors)
  // text 또는 attachment가 바뀌었으면 둘 다 보존한다. 오래된 async 완료가 최신 초안을
  // 부분적으로 지우지 않도록 submit snapshot 전체를 하나의 clear 조건으로 취급한다.
  if (compositionActive()) return
  if (currentDraft().revision !== submitted.revision) return
  const attachmentsUnchanged = accepted ? resetAttachmentsIfUnchanged(items) : false
  if (
    !acceptedSubmitCanClearDraftAndRequirements({
      accepted,
      composing: compositionActive(),
      currentDraftRevision: currentDraft().revision,
      submittedDraftRevision: submitted.revision,
      attachmentsUnchanged
    })
  ) {
    return
  }
  onClearDiffRequirementsIfUnchanged(submittedRequirements)
  updateSnapshot((current) => clearDraftAfterAcceptedSubmit(current, submitted.revision))
  focus(0)
}
