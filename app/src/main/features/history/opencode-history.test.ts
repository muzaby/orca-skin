import { describe, expect, it } from 'vitest'
import { OpenCodeEventMapper } from '../../adapters/opencode-map'
import { assistantMessage, editTool, openCodeEvent } from '../../adapters/opencode.testfixture'
import { toolCallPartPayload } from './tool-call-payload'
import { partFromRow } from '../../infra/ipc/dto'

describe('OpenCode history payload roundtrip', () => {
  it('reloads normalized arguments and the exact provider name/input together', () => {
    const mapper = new OpenCodeEventMapper('s1', 'prompt-1')
    mapper.map(openCodeEvent('message.updated', { sessionID: 's1', info: assistantMessage() }))
    const events = mapper.map(
      openCodeEvent('message.part.updated', { sessionID: 's1', part: editTool(), time: 1 })
    )
    const started = events.find((event) => event.type === 'tool.call.started')!
    expect(started.type).toBe('tool.call.started')
    if (started.type !== 'tool.call.started') throw new Error('missing tool')
    const part = partFromRow({
      message_id: 1,
      role: 'assistant',
      created_at: 1,
      complete: 1,
      message_idx: 0,
      part_idx: 0,
      type: 'tool_call',
      tool_run_id: started.toolRunId,
      payload_json: JSON.stringify(toolCallPartPayload(started))
    })
    expect(part).toMatchObject({
      type: 'tool_call',
      toolName: 'Edit',
      args: { file_path: 'src/a.ts', old_string: 'old', new_string: 'new' },
      providerTool: {
        name: 'edit',
        input: { filePath: 'src/a.ts', oldString: 'old', newString: 'new' }
      }
    })
  })
})
