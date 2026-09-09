import { expect, it } from 'vitest'
import { buildSystemHeader } from './system-header'

it('inserts Work once after Orca while an absent profile leaves Code bytes unchanged', () => {
  const input = { orcaVersion: '1', language: 'ko', projectName: 'test' }
  const code = buildSystemHeader(input)
  expect(buildSystemHeader({ ...input, agentInstructions: undefined })).toBe(code)
  const work = buildSystemHeader({ ...input, agentInstructions: 'Work fixture instruction' })
  expect(work.replace('\n\n# Agent\nWork fixture instruction', '')).toBe(code)
  expect(work.match(/# Agent\n/g)).toHaveLength(1)
  expect(work.indexOf('# Agent')).toBeLessThan(work.indexOf('# Tools'))
})
