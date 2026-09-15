import { describe, expect, it, vi } from 'vitest'
import { resolveJiraEntrypoint } from './entrypoint'

describe('resolveJiraEntrypoint', () => {
  it('설치된 exact package의 public main을 resolve한다', () => {
    const resolve = vi.fn(() => 'C:/node_modules/@atlassian-dc-mcp/jira/build/index.js')
    expect(resolveJiraEntrypoint(resolve)).toBe(
      'C:/node_modules/@atlassian-dc-mcp/jira/build/index.js'
    )
    expect(resolve).toHaveBeenCalledWith('@atlassian-dc-mcp/jira')
  })
})
