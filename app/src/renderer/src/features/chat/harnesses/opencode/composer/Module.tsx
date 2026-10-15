import { useMemo } from 'react'
import type { ComposerControlProps, ComposerModule } from '../../contracts'
import { composerAppearance } from './appearance'
import { ComposerChip } from './Chip'
import { SubmitButton } from './SubmitButton'
import { OpenCodeAgentControl, OpenCodeVariantControl } from './Controls'
import { OpenCodeRequestDock } from './RequestDock'
import { selectOpenCodeRequest } from './requestQueue'
import { OpenCodeTodoDock } from './TodoDock'
import { selectOpenCodeTodos } from './todoState'
import { chatActions, useChatSession, useChatStore } from '../../../store/chatStore'
import { modelKey } from '../../../components/composer/modelSelection'
function AboveInput({ inflight }: { inflight: boolean }): React.JSX.Element {
  const sessionKey = useChatStore((s) => s.activeKey)
  const state = useChatSession((s) => s)
  const request = selectOpenCodeRequest(state)
  const { backend, messages, sendCount, openCodeTodoTurnStartIndex } = state
  const todos = useMemo(
    () => selectOpenCodeTodos({ backend, messages, sendCount, openCodeTodoTurnStartIndex }),
    [backend, messages, sendCount, openCodeTodoTurnStartIndex]
  )
  return (
    <>
      <OpenCodeTodoDock
        sessionKey={sessionKey}
        turnKey={state.sendCount}
        todos={todos}
        live={inflight || !!request}
        blocked={!!request}
        collapsed={state.openCodeTodoCollapsed}
        onCollapsedChange={chatActions.setOpenCodeTodoCollapsed}
      />
      {request && <OpenCodeRequestDock request={request} />}
    </>
  )
}
export const composerModule: ComposerModule = {
  appearance: composerAppearance,
  includeExtensions: false,
  controlsPlacement: 'end',
  harness: 'opencode',
  placeholder: () => 'harness.promptPlaceholder',
  label: 'OpenCode',
  Chip: ComposerChip,
  SubmitButton,
  landingContextBelow: true,
  Status: () => null,
  Requests: () => null,
  AboveInput,
  inputBlocked: (state) => !!selectOpenCodeRequest(state),
  ModeControl: ({ agents, providerKey }: ComposerControlProps) => (
    <OpenCodeAgentControl agents={agents.find((a) => a.key === providerKey)?.agents} />
  ),
  EffortControl: ({ agents, providerKey, modelFamily }: ComposerControlProps) => (
    <OpenCodeVariantControl
      variants={
        agents
          .find((a) => a.key === providerKey)
          ?.models.find((model) => modelKey(model) === modelFamily)?.variants ?? []
      }
    />
  )
}
