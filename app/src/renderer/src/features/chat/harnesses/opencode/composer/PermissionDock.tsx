import { useI18n } from '../../../../../shared/i18n'
import { OpenCodeIcon } from '../Icon'
import { DockButton, DockPrompt } from './DockPrompt'

export function OpenCodePermissionDock({
  toolName,
  summary,
  description,
  onAllow,
  onAllowSession,
  onDeny
}: {
  toolName: string
  summary: string
  description: string | null
  onAllow: () => void
  onAllowSession: () => void
  onDeny: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <DockPrompt
      kind="permission"
      label={tr('chat.approval.toolAria')}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          (event.ctrlKey || event.metaKey) &&
          !event.nativeEvent.isComposing &&
          !event.repeat
        ) {
          event.preventDefault()
          onAllow()
        }
      }}
      header={
        <div className="flex min-h-[28px] items-center gap-[8px] px-[4px] font-[530]">
          <OpenCodeIcon name="circle-exclamation" className="text-oc-faint" />
          {tr('chat.approval.toolRequestOpenCode', { tool: toolName })}
        </div>
      }
      footer={
        <>
          <div />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-[8px]">
            <DockButton onClick={onDeny}>{tr('chat.approval.deny')}</DockButton>
            <DockButton
              tone="neutral"
              onClick={onAllowSession}
              title={tr('chat.approval.allowSessionTitle')}
            >
              {tr('chat.approval.allowSession')}
            </DockButton>
            <DockButton tone="submit" onClick={onAllow}>
              {tr('chat.approval.allow')}
            </DockButton>
          </div>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-[8px] pb-[4px] pl-[28px] pr-[4px]">
        {description && <p className="m-0 break-words text-oc-muted">{description}</p>}
        <pre className="m-0 max-h-[160px] overflow-auto whitespace-pre-wrap break-all font-mono text-[13px] leading-[20px] text-oc-muted">
          {summary}
        </pre>
      </div>
    </DockPrompt>
  )
}
