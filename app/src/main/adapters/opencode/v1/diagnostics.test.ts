import { expect, it } from 'vitest'
import { classifyMcpError, diffProfileComponents, profileComponents } from './diagnostics'

it('classifies MCP errors and diffs profile components', () => {
  for (const [error, expected] of [
    ['request timed out', 'timeout'],
    ['ECONNREFUSED https://secret/?token=secret', 'refused'],
    ['getaddrinfo ENOTFOUND private', 'dns'],
    ['self-signed certificate TLS', 'tls'],
    ['OAuth HTTP 401', 'auth'],
    ['Connection closed', 'closed'],
    ['HTTP status code 500', 'http'],
    ['unknown', 'other']
  ])
    expect(classifyMcpError(error)).toBe(expected)
  const before = profileComponents('exe', 'cwd', {
    ORCA_MCP_one: 'first',
    OPENCODE_CONFIG_CONTENT: '{"mcp":{"one":{}}}',
    A: '1',
    REMOVED: 'yes'
  })
  const after = profileComponents('exe', 'cwd', {
    ORCA_MCP_one: 'second',
    OPENCODE_CONFIG_CONTENT: '{"mcp":{"two":{}}}',
    A: '2',
    ADDED: 'yes'
  })
  expect(diffProfileComponents(before, after)).toEqual([
    'config:mcp',
    'env:A',
    'env:ADDED',
    'env:OPENCODE_CONFIG_CONTENT',
    'env:ORCA_MCP_*',
    'env:REMOVED'
  ])
  expect(JSON.stringify(after)).not.toMatch(/first|second|two|yes/)
})
