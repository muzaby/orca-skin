import { useMemo } from 'react'
import { OpenCodeRequestDock } from './RequestDock'
import { selectOpenCodeRequest } from './requestQueue'
import { OpenCodeTodoDock } from './TodoDock'
import { selectOpenCodeTodos } from './todoState'
import { chatActions, useChatSession, useChatStore } from '../../../store/chatStore'
export function AboveInput({ inflight }: { inflight: boolean }): React.JSX.Element {
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
