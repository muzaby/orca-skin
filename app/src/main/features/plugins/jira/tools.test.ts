import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { runtimeApprovalToolNames } from '../../../adapters/runtime-tool-policy'
import { authToolServerId } from '../../../adapters/runtime-tool-policy'
import {
  createJiraToolServer,
  JIRA_TOOL_NAMES,
  type JiraPluginContext,
  type JiraToolName,
  type JiraServicePort
} from './tools'

const ctx: JiraPluginContext = {
  authId: 'jira-dc',
  label: 'Jira Corp',
  origin: 'https://jira.example.com',
  request: vi.fn()
}

const service = (
  invoke: JiraServicePort['invoke'] = vi.fn(async () => ({ key: 'QA-1' }))
): JiraServicePort => ({ invoke })

describe('Jira Runtime Tool descriptor', () => {
  const server = createJiraToolServer(ctx, service())

  it('0.34.0 기본 14개 이름만 정확히 한 번 등록한다', () => {
    expect(server.descriptor.id).toBe(authToolServerId('jira-dc'))
    expect(server.descriptor.tools.map((tool) => tool.name)).toEqual([...JIRA_TOOL_NAMES])
    expect(new Set(JIRA_TOOL_NAMES).size).toBe(14)
    expect(JIRA_TOOL_NAMES).not.toContain('jira_uploadAttachment')
    expect(server.implementations.map((tool) => tool.name)).toEqual([...JIRA_TOOL_NAMES])
  })

  it('순수 조회 6개만 자동 허용하고 변경 7개와 download 1개는 승인한다', () => {
    const readOnly = server.descriptor.tools
      .filter((tool) => tool.annotations?.readOnlyHint === true)
      .map((tool) => tool.name)
    expect(readOnly).toEqual([
      'jira_searchIssues',
      'jira_getIssue',
      'jira_getIssueComments',
      'jira_getTransitions',
      'jira_getIssueDevelopmentInfo',
      'jira_getIssueLinkTypes'
    ])
    expect(
      runtimeApprovalToolNames({ revision: 1, servers: new Map([[server.descriptor.id, server]]) })
    ).toEqual(
      new Set([
        'mcp__jira-dc-tools__jira_createIssue',
        'mcp__jira-dc-tools__jira_updateIssue',
        'mcp__jira-dc-tools__jira_postIssueComment',
        'mcp__jira-dc-tools__jira_updateIssueComment',
        'mcp__jira-dc-tools__jira_transitionIssue',
        'mcp__jira-dc-tools__jira_linkIssues',
        'mcp__jira-dc-tools__jira_unlinkIssues',
        'mcp__jira-dc-tools__jira_downloadAttachment'
      ])
    )
  })

  it('selector XOR와 pagination/inline 상한을 schema가 거부한다', () => {
    const byName = new Map(server.implementations.map((tool) => [tool.name, tool]))
    const download = byName.get('jira_downloadAttachment')!
    const shape = download.inputSchema
    expect((shape.maxInlineBytes as z.ZodType).safeParse(1024 * 1024 + 1).success).toBe(false)
    expect((shape.save as z.ZodType).parse(undefined)).toBe(false)
    const search = byName.get('jira_searchIssues')!
    expect((search.inputSchema.maxResults as z.ZodType).safeParse(101).success).toBe(false)
  })

  it('14개 도구의 upstream 입력 필드 inventory를 보존한다', () => {
    const fields = Object.fromEntries(
      server.implementations.map((implementation) => [
        implementation.name,
        Object.keys(implementation.inputSchema)
      ])
    )
    expect(fields).toEqual({
      jira_searchIssues: ['jql', 'maxResults', 'startAt', 'expand', 'fields'],
      jira_getIssue: ['issueKey', 'expand', 'fields'],
      jira_getIssueComments: ['issueKey', 'expand', 'maxResults', 'startAt'],
      jira_createIssue: ['projectId', 'summary', 'description', 'issueTypeId', 'customFields'],
      jira_updateIssue: ['issueKey', 'summary', 'description', 'issueTypeId', 'customFields'],
      jira_postIssueComment: ['issueKey', 'comment'],
      jira_updateIssueComment: ['issueKey', 'commentId', 'comment'],
      jira_getTransitions: ['issueKey'],
      jira_getIssueDevelopmentInfo: ['issueKey', 'dataType', 'applicationType'],
      jira_transitionIssue: ['issueKey', 'transitionId', 'fields', 'customFields'],
      jira_getIssueLinkTypes: [],
      jira_linkIssues: ['inwardIssueKey', 'outwardIssueKey', 'linkType', 'comment'],
      jira_unlinkIssues: ['linkId'],
      jira_downloadAttachment: [
        'issueKey',
        'attachmentId',
        'filename',
        'returnContent',
        'maxInlineBytes',
        'save',
        'saveName'
      ]
    })
  })

  it.each([{}, { issueKey: 'QA-1', attachmentId: '42' }, { issueKey: 'QA-1', saveName: 'x.txt' }])(
    'download selector 안전 delta를 handler 경계에서 invalid_input으로 거부한다',
    async (input) => {
      const implementation = server.implementations.at(-1)!
      const result = await implementation.handler(input)
      expect(result).toMatchObject({ isError: true })
      expect(result.structuredContent).toMatchObject({ error: { code: 'invalid_input' } })
    }
  )

  it('handler는 도구 이름과 input, 취소 signal을 service에 넘기고 envelope를 반환한다', async () => {
    const invoke = vi.fn(async () => ({ key: 'QA-1' }))
    const serverWithFake = createJiraToolServer(ctx, service(invoke))
    const signal = new AbortController().signal
    const result = await serverWithFake.implementations[1].handler(
      { issueKey: 'QA-1' },
      { cwd: '', extraDirs: [], getSignal: () => signal, waitForSession: vi.fn() }
    )
    expect(invoke).toHaveBeenCalledWith('jira_getIssue', { issueKey: 'QA-1' }, signal)
    expect(result.structuredContent).toMatchObject({ ok: true, tool: 'jira_getIssue' })
  })

  it('AbortController 취소를 agent cancelled envelope로 반환한다', async () => {
    const controller = new AbortController()
    const invoke = vi.fn(
      (_name: JiraToolName, _input: Readonly<Record<string, unknown>>, signal?: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            const error = new Error('요청이 취소되었습니다')
            error.name = 'AbortError'
            reject(error)
          })
        })
    )
    const serverWithFake = createJiraToolServer(ctx, service(invoke))
    const pending = serverWithFake.implementations[1].handler(
      { issueKey: 'QA-1' },
      { cwd: '', extraDirs: [], getSignal: () => controller.signal, waitForSession: vi.fn() }
    )
    controller.abort()

    await expect(pending).resolves.toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'cancelled' } }
    })
  })

  it('prepared download는 result preflight 뒤에만 publish하고 preflight 실패는 abort한다', async () => {
    const commit = vi.fn(async () => undefined)
    const abort = vi.fn(async () => undefined)
    const pending: JiraServicePort = {
      invoke: vi.fn(async () => ({
        data: {
          count: 1,
          skipped: [],
          attachments: [{ filename: 'x'.repeat(2 * 1024 * 1024), size: 1, savedPath: 'hidden' }]
        },
        commit,
        abort
      }))
    }
    const impl = createJiraToolServer(ctx, pending).implementations.at(-1)!
    const result = await impl.handler({ attachmentId: '1', save: true })
    expect(result).toMatchObject({ isError: true })
    expect(result.structuredContent).toMatchObject({ error: { code: 'tool_output_too_large' } })
    expect(commit).not.toHaveBeenCalled()
    expect(abort).toHaveBeenCalledOnce()
  })
})
