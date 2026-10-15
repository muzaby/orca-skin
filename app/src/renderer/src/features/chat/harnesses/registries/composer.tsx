import type { Backend } from '../../../../../../shared/ipc'
import type { ComponentType } from 'react'
import type { ComposerModule, ToolApprovalBodyProps } from '../contracts'
import { composerModule as claude } from '../claude/composer/Module'
import { composerModule as opencode } from '../opencode/composer/Module'
import { ToolApprovalBody as ClaudeToolApproval } from '../claude/composer/ToolApproval'
import { ToolApprovalBody as OpenCodeToolApproval } from '../opencode/composer/ToolApproval'
import { useChatSession } from '../../store/chatStore'
const modules = { claude, opencode } satisfies Record<Backend, ComposerModule>
export function composerHarness(backend: Backend | null | undefined): ComposerModule {
  return modules[backend ?? 'claude']
}
const approval = { claude: ClaudeToolApproval, opencode: OpenCodeToolApproval } satisfies Record<
  Backend,
  ComponentType<ToolApprovalBodyProps>
>
export function ToolApprovalBody(props: ToolApprovalBodyProps): React.JSX.Element {
  const backend = useChatSession((s) => s.backend)
  const Body = approval[backend ?? 'claude']
  return <Body {...props} />
}
