import { Button } from '../../../../../shared/ui/Button'
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
  return showCancelButton ? (
    <Button
      iconOnly
      variant="uncontained"
      leadingIcon="stop"
      onClick={onCancel}
      disabled={!canAbort}
      title={canAbort ? tr('common.stop') : tr('chat.composer.abortUnsupported')}
      aria-label={tr('common.stop')}
      data-behavior="action:cancel-turn"
      className="mb-1 shrink-0 rounded-full"
    />
  ) : (
    <Button
      iconOnly
      variant="uncontained"
      leadingIcon="enter"
      onClick={submit}
      disabled={text.trim() === ''}
      title={feedbackMode ? tr('chat.composer.sendFeedbackEnter') : tr('chat.composer.sendEnter')}
      aria-label={feedbackMode ? tr('chat.composer.sendFeedback') : tr('chat.composer.send')}
      data-behavior={feedbackMode ? 'action:send-feedback' : 'action:send'}
      className="mb-1 shrink-0 rounded-full"
    />
  )
}
