import { memo } from 'react'
import { chatActions, type PendingSteerState } from '../../store/chatStore'
import { useI18n } from '../../../../shared/i18n'
import { UserBubbleText } from '../UserBubbleText'

interface PendingSteerTurnProps {
  items: PendingSteerState[]
  onRestoreDraft?: (text: string) => void
}

// 미커밋(pending) 사용자 메시지 버블(0067 pending-first) — 일반 send·steer 예약 모두 이
// 연회색/기울임 버블로 시작해, echo 커밋(message.committed) 시 store 가 일반 커밋 사용자
// 메시지로 승격한다. held 인 동안 hover 취소(단건 draft 복원) 가능.
export const PendingSteerTurn = memo(function PendingSteerTurn({
  items,
  onRestoreDraft
}: PendingSteerTurnProps): React.JSX.Element | null {
  const { tr } = useI18n()
  if (items.length === 0) return null
  return (
    <div className="group/msg flex flex-col items-end gap-[var(--chat-item-gap)]">
      {items.map((item) => (
        <div key={item.id} className="flex max-w-[80%] items-start gap-2">
          {/* 소유권이 넘어간(stdin 주입 완료) 항목은 취소 버튼을 내린다(0151) — main 이 취소를
              거부하므로, 버튼을 남겨두면 눌러도 아무 일이 없는 죽은 어포던스가 된다. */}
          {item.submitted ? (
            <span className="mt-1 select-none px-2 py-0.5 text-[11px] text-ink3 opacity-0 transition-opacity group-hover/msg:opacity-100">
              {tr('chat.steer.submitted')}
            </span>
          ) : (
            <button
              type="button"
              className="mt-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-ink3 opacity-0 transition-opacity hover:bg-fill-uncontained-hover group-hover/msg:opacity-100"
              onClick={() => {
                const restored = chatActions.cancelSteer(item.id)
                if (restored) onRestoreDraft?.(restored)
              }}
            >
              {tr('common.cancel')}
            </button>
          )}
          <UserBubbleText
            data-state={item.submitted ? 'submitted-steer' : 'pending-steer'}
            className="rounded-r6 bg-bubble-user px-p7 py-p5 text-body italic text-ink3"
            title={item.text}
          >
            {item.text}
          </UserBubbleText>
        </div>
      ))}
    </div>
  )
})
