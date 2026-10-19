import { chatActions } from '../../../store/chatStore'
import { summarizeToolInput, toolDescription } from '../../common/composer/toolApproval'
import { OpenCodePermissionDock } from './PermissionDock'
import type { ToolApprovalBodyProps } from '../../contracts'
export function ToolApprovalBody({
  approvalId,
  toolName,
  input
}: ToolApprovalBodyProps): React.JSX.Element {
  return (
    <OpenCodePermissionDock
      toolName={toolName}
      summary={summarizeToolInput(input)}
      description={toolDescription(input)}
      onAllow={() => chatActions.approveTool(approvalId)}
      onAllowSession={() => chatActions.approveToolForSession(approvalId, toolName)}
      onDeny={() => chatActions.denyTool(approvalId)}
    />
  )
}
