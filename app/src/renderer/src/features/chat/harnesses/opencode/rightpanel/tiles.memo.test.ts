import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { emptyBackgroundState } from '../../../../../../../shared/background-task'
import { useBackgroundStore } from '../../../store/backgroundStore'
import { useChatStore } from '../../../store/chatStore'
import {
  OpenCodeAgentContent,
  OpenCodeAgentHeader,
  OpenCodeProcessContent,
  OpenCodeTaskContent
} from './tiles'

it('shares one incremental transcript index across four components and updates on new messages', () => {
  const initial = useChatStore.getInitialState()
  const entry = initial.sessions[initial.activeKey]
  const previous = entry.session
  const backgrounds = useBackgroundStore.getInitialState().sessions
  const render = (): string =>
    renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(OpenCodeTaskContent),
        createElement(OpenCodeAgentContent),
        createElement(OpenCodeAgentHeader),
        createElement(OpenCodeProcessContent)
      )
    )
  try {
    entry.session = {
      ...previous,
      sessionId: 'memo-panel',
      backend: 'opencode',
      messages: [
        {
          id: 'm-38',
          role: 'assistant',
          createdAt: 1,
          parts: [
            {
              type: 'tool_call',
              toolName: 'Bash',
              toolRunId: 'shell',
              args: { command: 'echo first' }
            }
          ]
        }
      ]
    }
    const messages = entry.session.messages
    expect(render()).toContain('echo first')
    const background = emptyBackgroundState()
    backgrounds['memo-panel'] = { state: background, loading: false }
    expect(render()).toContain('echo first')
    entry.session = {
      ...entry.session,
      messages: [
        ...messages,
        {
          id: 'm-71',
          role: 'assistant',
          createdAt: 2,
          parts: [
            { type: 'tool_result', toolRunId: 'shell', result: 'final output', isError: false }
          ]
        }
      ]
    }
    expect(render()).toContain('echo first')
  } finally {
    entry.session = previous
    delete backgrounds['memo-panel']
  }
})
