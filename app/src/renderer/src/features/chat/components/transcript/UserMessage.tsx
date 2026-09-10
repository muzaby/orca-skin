import { partsAttachments, partsDiffRequirements, partsText } from '../../lib/parts'
import { AttachmentThumb } from '../composer/AttachmentThumb'
import { UserBubbleText } from '../UserBubbleText'
import type { Message } from '../../reducer/chatReducer'
import { UserDiffRequirements } from './UserDiffRequirements'
import { useI18n } from '../../../../shared/i18n'
import { Icon } from '../../../../shared/ui/Icon'

interface UserMessageProps {
  message: Message
}

// 본문 전용 — 메타(복사/시간)는 턴 단위로 UserTurn 이 한 번만 렌더한다.
// 첨부가 있으면 버블 위에 read-only 썸네일 행(이미지=썸네일/파일=확장자, hover=파일명)을 둔다.
export function UserMessage({ message }: UserMessageProps): React.JSX.Element {
  const { tr } = useI18n()
  const attachments = partsAttachments(message.parts)
  const requirements = partsDiffRequirements(message.parts)
  const text = partsText(message.parts)
  const originPart = message.parts.find((part) => part.type === 'text' && part.origin)
  const origin = originPart?.type === 'text' ? originPart.origin : undefined
  return (
    <div className="flex flex-col items-end gap-1.5">
      {origin && (
        <div
          data-message-origin={origin.kind}
          className="flex max-w-[80%] min-w-0 items-center gap-1.5 text-caption text-ink3"
        >
          <Icon name={origin.kind === 'scheduled' ? 'clock' : 'chat'} size={14} />
          <span className="shrink-0">{tr(`chat.messageOrigin.${origin.kind}`)}</span>
          {origin.label && (
            <span className="truncate" title={origin.label}>
              {origin.label}
            </span>
          )}
        </div>
      )}
      {(attachments.length > 0 || requirements.length > 0) && (
        <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
          {attachments.map((att) => (
            <AttachmentThumb
              key={att.id}
              name={att.name}
              isImage={att.kind === 'image'}
              previewUrl={att.previewDataUrl}
            />
          ))}
          <UserDiffRequirements requirements={requirements} />
        </div>
      )}
      {text && (
        <UserBubbleText
          className="max-w-[80%] rounded-r6 bg-bubble-user px-p7 py-p5 text-body text-ink"
          title={text}
        >
          {text}
        </UserBubbleText>
      )}
    </div>
  )
}
