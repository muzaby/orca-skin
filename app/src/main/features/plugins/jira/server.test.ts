import { describe, expect, it } from 'vitest'
import { authToolServerId, runtimeToolFullName } from '../../../adapters/runtime-tool-policy'
import { JIRA_MUTATING_TOOL_NAMES, JIRA_TOOL_DESCRIPTOR, JIRA_TOOL_NAMES } from './tools'
import { createJiraRuntimeServer, jiraApiBasePath } from './server'

describe('Jira runtime server', () => {
  it.each([
    ['https://jira.example.corp', undefined, 'https://jira.example.corp/rest'],
    ['https://jira.example.corp', '', 'https://jira.example.corp/rest'],
    ['https://jira.example.corp', '/jira', 'https://jira.example.corp/jira/rest'],
    ['https://jira.example.corp', '/jira/', 'https://jira.example.corp/jira/rest']
  ])('origin=%s context=%s를 API base path로 정규화한다', (origin, context, expected) => {
    expect(jiraApiBasePath(origin, context)).toBe(expected)
  })

  it.each([
    ['https://jira.example.corp/path', undefined],
    ['https://jira.example.corp', 'jira'],
    ['https://jira.example.corp', '/jira?x=1'],
    ['https://jira.example.corp', '/jira#frag'],
    ['https://jira.example.corp', '/rest'],
    ['https://jira.example.corp', '/jira/rest/api/2']
  ])('모호하거나 중복된 API 경로를 거부한다: %s %s', (origin, context) => {
    expect(() => jiraApiBasePath(origin, context)).toThrow()
  })

  it('child config는 package entry와 보안 env exact-set을 사용한다', () => {
    const server = createJiraRuntimeServer({
      authId: 'jira',
      origin: 'https://jira.example.corp',
      apiContextPath: '/jira',
      token: 'top-secret',
      credentialRevision: 3,
      electronExecutable: 'electron.exe',
      packageEntrypoint: 'C:/app/node_modules/@atlassian-dc-mcp/jira/build/index.js'
    })

    expect(server).toEqual({
      transport: 'stdio',
      descriptor: {
        ...JIRA_TOOL_DESCRIPTOR,
        id: authToolServerId('jira'),
        connectorId: 'jira'
      },
      command: 'electron.exe',
      args: ['C:/app/node_modules/@atlassian-dc-mcp/jira/build/index.js'],
      env: {
        ELECTRON_RUN_AS_NODE: '1',
        JIRA_API_BASE_PATH: 'https://jira.example.corp/jira/rest',
        JIRA_API_TOKEN: 'top-secret',
        JIRA_DEFAULT_PAGE_SIZE: '25',
        JIRA_ATTACHMENTS_UPLOAD_ENABLED: 'false',
        JIRA_ATTACHMENTS_DOWNLOAD_ENABLED: 'false',
        ATLASSIAN_DC_MCP_CONFIG_FILE: ''
      },
      credentialRevision: 3
    })
    expect(Object.keys(server.env ?? {})).toHaveLength(7)
    expect(server.env).not.toHaveProperty('JIRA_HOST')
    expect(server.env).not.toHaveProperty('JIRA_ATTACHMENTS_DIR')
  })

  it('빈 token은 server materialization 전에 거부한다', () => {
    expect(() =>
      createJiraRuntimeServer({
        authId: 'jira',
        origin: 'https://jira.example.corp',
        token: '   ',
        credentialRevision: 1,
        electronExecutable: 'electron.exe',
        packageEntrypoint: 'jira.js'
      })
    ).toThrow(/token/i)
  })
})

describe('Jira tool policy 0.34.0', () => {
  it('기본 14개와 변경 7개를 exact-set으로 선언하고 upload를 제외한다', () => {
    expect(JIRA_TOOL_NAMES).toHaveLength(14)
    expect(new Set(JIRA_TOOL_NAMES).size).toBe(14)
    expect(JIRA_TOOL_NAMES).not.toContain('jira_uploadAttachment')
    expect(JIRA_MUTATING_TOOL_NAMES).toEqual([
      'jira_createIssue',
      'jira_updateIssue',
      'jira_postIssueComment',
      'jira_updateIssueComment',
      'jira_transitionIssue',
      'jira_linkIssues',
      'jira_unlinkIssues'
    ])
    expect(
      JIRA_TOOL_DESCRIPTOR.tools
        .filter((tool) => tool.annotations?.readOnlyHint !== true)
        .map((tool) => runtimeToolFullName(authToolServerId('jira'), tool.name))
    ).toEqual(JIRA_MUTATING_TOOL_NAMES.map((name) => `mcp__jira-tools__${name}`))
  })
})
