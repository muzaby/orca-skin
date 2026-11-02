import { expect, it } from 'vitest'
import { claudeProjectSettingsRevision, type ClaudeProjectSettings } from './project-settings'
import { ClaudeBackgroundMapper } from './background'
it('keeps project revisions independent of nested object key order while detecting changed values', () => {
  const value = {
    plugins: {},
    disabledMcp: [],
    enabledMcp: [],
    disabledProjectMcp: [],
    approvedProjectMcp: [],
    definitions: { project: { b: 1, a: 2 }, local: {} }
  } as unknown as Omit<ClaudeProjectSettings, 'revision' | 'structure'>
  const equal = { ...value, definitions: { project: { a: 2, b: 1 }, local: {} } }
  const changed = { ...value, definitions: { project: { a: 1, b: 2 }, local: {} } }
  expect(claudeProjectSettingsRevision(value)).toBe(claudeProjectSettingsRevision(equal))
  expect(claudeProjectSettingsRevision(value)).not.toBe(claudeProjectSettingsRevision(changed))
})
it('deduplicates a provider message whose only change is nested object insertion order', () => {
  const mapper = new ClaudeBackgroundMapper()
  const message = {
    uuid: 'same-id',
    type: 'assistant',
    message: { content: [{ type: 'text', text: 'response' }], model: 'model' }
  }
  expect(mapper.map(message, 'session')).toBeDefined()
  expect(
    mapper.map(
      {
        message: { model: 'model', content: [{ text: 'response', type: 'text' }] },
        type: 'assistant',
        uuid: 'same-id'
      },
      'session'
    )
  ).toBeUndefined()
})
