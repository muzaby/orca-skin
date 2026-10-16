import { useI18n } from '../../../../../shared/i18n'
import { OpenCodeIcon } from '../Icon'
import { useToolDisclosure } from './viewState'
import { questionAnswers } from '../toolPresentation'
import type { ToolCall } from '../../../reducer/chatReducer'

export function OpenCodeAskExchange({ call }: { call: ToolCall }): React.JSX.Element | null {
  const { tr } = useI18n()
  const [open, setOpen] = useToolDisclosure(`question:${call.toolUseId}`, true)
  const { items, response } = questionAnswers(call)
  if (!items.length || (!items.some((item) => item.answer) && response == null)) return null
  return (
    <div
      data-component="opencode-question-answers"
      className="flex flex-col gap-[12px] text-[calc(13px*var(--transcript-text-scale,1))] leading-[20px]"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group/oc-question flex min-h-[28px] w-fit items-center gap-[6px] rounded-[6px] text-left outline-none ring-focus"
      >
        <span className="font-[530] text-oc-ink">{tr('chat.opencode.question')}</span>
        <span className="text-oc-muted">
          {tr('chat.opencode.questionAnswered', {
            count: items.filter((item) => item.answer).length
          })}
        </span>
        <OpenCodeIcon
          name="chevron-down"
          size={14}
          className={`${open ? '' : '-rotate-90'} text-oc-faint opacity-0 group-hover/oc-question:opacity-100 group-focus-visible/oc-question:opacity-100`}
        />
      </button>
      {open &&
        items.map((item, index) => (
          <div key={index} className="flex flex-col gap-[2px]">
            <div className="min-w-0 whitespace-pre-wrap break-words">
              <div className="text-oc-muted">{item.question}</div>
              {item.answer && <div className="mt-[2px] text-oc-ink">{item.answer}</div>}
            </div>
          </div>
        ))}
      {open && response && <div className="text-oc-ink">{response}</div>}
    </div>
  )
}
