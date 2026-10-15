import type { KeyboardEvent } from 'react'
import { Button } from '../../../../../shared/ui/Button'
import { useI18n } from '../../../../../shared/i18n'
import { chatActions } from '../../../store/chatStore'
import { summarizeToolInput, toolDescription } from '../../common/composer/toolApproval'
import { toolApprovalRequestKey } from './approval'
import type { ToolApprovalBodyProps } from '../../contracts'
// 동시(서브에이전트·병렬) 도구 승인은 큐(pendingToolApprovals)로 모델링되어 Composer 가
// 항목마다 본 컴포넌트를 스택으로 렌더한다 — 각 카드는 자신의 승인 항목을 prop 으로 받아
// 자기 approvalId 로 응답한다.
export function ToolApprovalBody({
  approvalId,
  toolName,
  input
}: ToolApprovalBodyProps): React.JSX.Element {
  const { tr } = useI18n()
  const { approveTool, approveToolForSession, denyTool } = chatActions

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      approveTool(approvalId)
    }
  }

  const summary = summarizeToolInput(input)
  const description = toolDescription(input)

  return (
    <div
      className="app-frame-plan-approval rounded-r7 border border-t5 bg-surface-primary-elevated px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,.03)]"
      data-surface="prompt"
      data-behavior="interactive"
      role="group"
      aria-label={tr('chat.approval.toolAria')}
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-g3">
        <span className="text-footnote font-medium text-t9">
          {tr(toolApprovalRequestKey, { tool: toolName })}
        </span>
      </div>

      {description && <p className="mt-1 text-caption text-t6">{description}</p>}

      <div className="mt-2 line-clamp-2 break-all rounded-r5 bg-bg px-3 py-1.5 font-mono text-caption text-t7">
        {summary}
      </div>

      <div className="mt-3 flex items-center justify-between gap-g3">
        <Button
          variant="contained"
          onClick={() => denyTool(approvalId)}
          data-behavior="dismissible"
        >
          {tr('chat.approval.deny')}
        </Button>
        <div className="flex items-center gap-g3">
          <Button
            variant="uncontained"
            onClick={() => approveToolForSession(approvalId, toolName)}
            title={tr('chat.approval.allowSessionTitle')}
          >
            {tr('chat.approval.allowSession')}
          </Button>
          <Button
            variant="primary"
            onClick={() => approveTool(approvalId)}
            data-behavior="action:send"
          >
            {tr('chat.approval.allow')}
          </Button>
        </div>
      </div>
    </div>
  )
}
