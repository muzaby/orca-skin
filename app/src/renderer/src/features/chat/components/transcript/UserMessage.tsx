import { partsAttachments, partsText } from '../../lib/parts'
import { AttachmentThumb } from '../composer/AttachmentThumb'
import type { Message } from '../../reducer/chatReducer'

interface UserMessageProps {
  message: Message
}

// 본문 전용 — 메타(복사/시간)는 턴 단위로 UserTurn 이 한 번만 렌더한다.
// 첨부가 있으면 버블 위에 read-only 썸네일 행(이미지=썸네일/파일=확장자, hover=파일명)을 둔다.
export function UserMessage({ message }: UserMessageProps): React.JSX.Element {
  const attachments = partsAttachments(message.parts)
  const text = partsText(message.parts)
  return (
    <div className="flex flex-col items-end gap-1.5">
      {attachments.length > 0 && (
        <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
          {attachments.map((att) => (
            <AttachmentThumb
              key={att.id}
              name={att.name}
              isImage={att.kind === 'image'}
              previewUrl={att.previewDataUrl}
            />
          ))}
        </div>
      )}
      {text && (
        <div className="max-w-[80%] whitespace-pre-wrap rounded-r6 bg-bubble-user px-p7 py-p5 text-body text-ink">
          {text}
        </div>
      )}
    </div>
  )
}
