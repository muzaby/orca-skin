import { expect, it } from 'vitest'
import { extensionChoices } from './extension-control'

it('maps only one kind of choice to harness keys', () => {
  const choices = { 'plugin:tools@market': false, 'plugin:other': true, 'mcp:tools@market': true }
  expect(extensionChoices(choices, 'plugin')).toEqual({ 'tools@market': false, other: true })
  expect(extensionChoices(choices, 'mcp')).toEqual({ 'tools@market': true })
})
