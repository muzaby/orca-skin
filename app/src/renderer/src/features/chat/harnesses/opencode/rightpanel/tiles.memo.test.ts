import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { emptyBackgroundState } from '../../../../../../../shared/background-task'
import { useChatStore } from '../../../store/chatStore'
import { useBackgroundStore } from '../../../store/backgroundStore'
import * as projection from './model'
import { OpenCodeTaskContent, OpenCodeAgentContent, OpenCodeAgentHeader, OpenCodeProcessContent } from './tiles'

it('shares one projection across four components and invalidates each input reference independently', () => {
  const initial = useChatStore.getInitialState()
  const entry = initial.sessions[initial.activeKey]
  const previous = entry.session
  const backgrounds = useBackgroundStore.getInitialState().sessions
  const project = vi.spyOn(projection, 'sessionPanelModel')
  const render = (): string => renderToStaticMarkup(createElement('div', null,
    createElement(OpenCodeTaskContent), createElement(OpenCodeAgentContent),
    createElement(OpenCodeAgentHeader), createElement(OpenCodeProcessContent)))
  try {
    entry.session = { ...previous, sessionId: 'memo-panel', backend: 'opencode', messages: [{ role: 'assistant', createdAt: 1, parts: [{ type: 'tool_call', toolName: 'Bash', toolRunId: 'shell', args: { command: 'echo first' } }] }] }
    const messages = entry.session.messages
    expect(render()).toContain('echo first')
    render()
    expect(project).toHaveBeenCalledTimes(1)
    const background = emptyBackgroundState()
    backgrounds['memo-panel'] = { state: background, loading: false }
    render()
    render()
    expect(project).toHaveBeenCalledTimes(2)
    backgrounds['memo-panel'] = { state: emptyBackgroundState(), loading: false }
    render()
    expect(project).toHaveBeenCalledTimes(3)
    backgrounds['memo-panel'] = { state: background, loading: false }
    render()
    expect(project).toHaveBeenCalledTimes(3)
    entry.session = { ...entry.session, messages: [...messages, { role: 'assistant', createdAt: 2, parts: [{ type: 'tool_result', toolRunId: 'shell', result: 'final output', isError: false }] }] }
    expect(render()).toContain('echo first')
    expect(project).toHaveBeenCalledTimes(4)
    expect(project.mock.results.at(-1)?.value.processes[0].output).toBe('final output')
  } finally {
    entry.session = previous
    delete backgrounds['memo-panel']
    project.mockRestore()
  }
})
