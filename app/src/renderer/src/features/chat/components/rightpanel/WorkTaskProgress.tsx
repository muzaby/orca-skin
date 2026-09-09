import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import { chatActions, useChatStore } from '../../store/chatStore'
import type { TaskBoardItem } from '../../lib/taskBoard'
import { TaskProgressList } from './TaskProgressList'

const EMPTY_CIRCLE =
  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong text-ink3'

export function WorkTaskProgress({ items }: { items: TaskBoardItem[] }): React.JSX.Element {
  const { tr } = useI18n()
  const activeKey = useChatStore((state) => state.activeKey)
  if (items.length > 0)
    return (
      <TaskProgressList
        items={items}
        onAsk={(item) =>
          chatActions.restoreComposerDraft(
            activeKey,
            `> ${item.subject.replace(/\r?\n/g, '\n> ')}\n\n`,
            'append'
          )
        }
      />
    )
  return (
    <div>
      <div data-empty-progress aria-hidden="true" className="flex items-center px-4 py-3">
        {[0, 1, 2].map((step) => (
          <div key={step} className="flex items-center">
            {step > 0 && <span className="h-px w-3 bg-border-strong" />}
            <span className={`${EMPTY_CIRCLE} ${step === 2 ? 'bg-bg2' : 'bg-panel shadow-sm'}`}>
              {step < 2 && <Icon name="check" size={21} />}
            </span>
          </div>
        ))}
      </div>
      <p className="px-4 pt-2 text-footnote leading-relaxed text-ink3">
        {tr('chat.taskTile.sections.progressDesc')}
      </p>
    </div>
  )
}
