import { Icon } from '../../../../../shared/ui/Icon'
import { useI18n } from '../../../../../shared/i18n'
import type { ComposerSubmitProps } from '../../types'
export function SubmitButton({
  showCancelButton,
  onCancel,
  submit,
  canAbort,
  text,
  feedbackMode
}: ComposerSubmitProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <button
      type="button"
      onClick={showCancelButton ? onCancel : submit}
      disabled={showCancelButton ? !canAbort : text.trim() === ''}
      aria-label={tr(
        showCancelButton
          ? 'common.stop'
          : feedbackMode
            ? 'chat.composer.sendFeedback'
            : 'chat.composer.send'
      )}
      title={tr(showCancelButton ? 'common.stop' : 'chat.composer.sendEnter')}
      data-behavior={
        showCancelButton
          ? 'action:cancel-turn'
          : feedbackMode
            ? 'action:send-feedback'
            : 'action:send'
      }
      className="absolute bottom-2 right-2 z-10 flex size-8 items-center justify-center rounded-[7px] border-0 bg-oc-ink text-oc-surface outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
    >
      <Icon name={showCancelButton ? 'stop' : 'enter'} size={16} />
    </button>
  )
}
