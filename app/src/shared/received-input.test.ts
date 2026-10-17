import { describe, expect, it } from 'vitest'
import { classifyReceivedInput, withReceivedInputFormat } from './received-input'

describe('provider-owned input format', () => {
  it.each([
    ['<system-reminder>Continue.</system-reminder>', 'system-reminder'],
    [' \n<system-reminder reason="done > next">계속</system-reminder>\n', 'system-reminder'],
    ['<task id="a" state="completed"><summary>done</summary></task>', 'tagged'],
    ['<task><task>nested</task>outer</task>', 'tagged'],
    ['<task/>\n<peer>hello</peer>', 'tagged'],
    ['<task>done</task> <system-reminder>continue</system-reminder>', 'system-reminder'],
    ['<wrapper><system-reminder>quoted</system-reminder></wrapper>', 'tagged'],
    ['<System-reminder>case-sensitive</System-reminder>', 'tagged'],
    ['Continue if you have next steps.', 'plain'],
    ['before <task>done</task>', 'plain'],
    ['<task>done</task> after', 'plain'],
    ['```xml\n<system-reminder>example</system-reminder>\n```', 'plain'],
    ['<task>unfinished', 'plain'],
    ['<task>wrong closing</peer>', 'plain'],
    ['<task><task>missing outer close</task>', 'plain'],
    ['</task>', 'plain'],
    ['', 'plain']
  ] as const)('classifies %s as %s', (text, expected) => {
    expect(classifyReceivedInput(text)).toBe(expected)
  })

  it('adds meaning without changing the original input or source', () => {
    const text = '\n<task>  원문  </task>\n'
    const origin = { kind: 'peer' as const, label: 'worker' }
    expect(withReceivedInputFormat(text, origin)).toEqual({ ...origin, format: 'tagged' })
    expect(origin).toEqual({ kind: 'peer', label: 'worker' })
    expect(text).toBe('\n<task>  원문  </task>\n')
  })
})
