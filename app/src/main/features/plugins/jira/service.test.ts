import { mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AuthenticatedRequest,
  AuthenticatedResponse,
  PluginAuth
} from '../../../contracts/auth'
import { createJiraAttachmentStore } from './attachment-store'
import { createJiraService } from './service'
import { isJiraPreparedInvocation, JiraToolError } from './result'

const roots: string[] = []
afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(
    roots.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

const response = (body: unknown, status = 200, bodyBytes?: Uint8Array): AuthenticatedResponse => ({
  ok: status >= 200 && status < 300,
  status,
  finalUrl: 'https://jira.example.com',
  headers: {},
  body: bodyBytes ? '' : typeof body === 'string' ? body : JSON.stringify(body),
  ...(bodyBytes ? { bodyBytes } : {})
})

function context(handler: (request: AuthenticatedRequest) => AuthenticatedResponse): {
  ctx: PluginAuth
  request: ReturnType<typeof vi.fn>
} {
  const request = vi.fn(async (req: AuthenticatedRequest) => handler(req))
  return {
    ctx: {
      authId: 'jira-corp',
      label: 'Jira',
      origin: 'https://jira.example.com',
      snapshot: () => ({
        authId: 'jira-corp',
        status: 'valid',
        verified: true,
        credentialRevision: 1
      }),
      request
    },
    request
  }
}

describe('Jira service', () => {
  it('일반 도구는 BoundAuth request를 쓰고 204/empty를 null로 해석한다', async () => {
    const fake = context((req) =>
      req.path.endsWith('/transitions') ? response('', 204) : response({ issues: [] })
    )
    const service = createJiraService(fake.ctx)
    await expect(service.invoke('jira_searchIssues', { jql: 'project = QA' })).resolves.toEqual({
      issues: []
    })
    await expect(
      service.invoke('jira_transitionIssue', { issueKey: 'QA-1', transitionId: '31' })
    ).resolves.toBeNull()
    expect(fake.request.mock.calls[0][0]).not.toHaveProperty('headers.Authorization')
  })

  it('development info는 issue numeric id를 먼저 구한 뒤 default query를 보낸다', async () => {
    const fake = context((req) =>
      req.path.includes('dev-status') ? response({ detail: [] }) : response({ id: '10001' })
    )
    const data = await createJiraService(fake.ctx).invoke('jira_getIssueDevelopmentInfo', {
      issueKey: 'QA-1'
    })
    expect(data).toEqual({ detail: [] })
    expect(fake.request.mock.calls.map((call) => call[0])).toMatchObject([
      { path: '/rest/api/2/issue/QA-1', query: { fields: 'id' } },
      {
        path: '/rest/dev-status/1.0/issue/detail',
        query: { issueId: '10001', dataType: 'pullrequest', applicationType: 'stash' }
      }
    ])
  })

  it('7개 도구는 BoundAuth outbound request의 query/body 의미를 보존한다', async () => {
    const fake = context((req) => {
      if (req.responseType === 'binary') return response('', 200, Buffer.from('file'))
      if (req.path === '/rest/api/2/issue/QA-1' && req.query?.fields === 'attachment') {
        return response({
          fields: {
            attachment: [
              { id: '42', filename: 'a.txt', content: 'https://jira.example.com/files/a.txt' }
            ]
          }
        })
      }
      return response({})
    })
    const service = createJiraService(fake.ctx)

    await service.invoke('jira_getIssue', { issueKey: 'QA-1' })
    await service.invoke('jira_getIssueComments', { issueKey: 'QA-1' })
    await service.invoke('jira_updateIssue', {
      issueKey: 'QA-1',
      summary: 'summary',
      description: 'description',
      issueTypeId: '3',
      customFields: { labels: ['urgent'] }
    })
    await service.invoke('jira_postIssueComment', { issueKey: 'QA-1', comment: 'hello' })
    await service.invoke('jira_updateIssueComment', {
      issueKey: 'QA-1',
      commentId: '7',
      comment: 'hello'
    })
    await service.invoke('jira_linkIssues', {
      inwardIssueKey: 'QA-1',
      outwardIssueKey: 'QA-2',
      linkType: 'Blocks',
      comment: 'rel'
    })
    await service.invoke('jira_downloadAttachment', {
      issueKey: 'QA-1',
      save: false,
      returnContent: 'none'
    })

    const requestAt = (index: number): AuthenticatedRequest =>
      fake.request.mock.calls[index][0] as AuthenticatedRequest
    expect(requestAt(0)).toMatchObject({
      method: 'GET',
      path: '/rest/api/2/issue/QA-1',
      query: {
        fields:
          'summary,description,status,assignee,reporter,priority,issuetype,labels,updated,parent,subtasks'
      }
    })
    expect(requestAt(0).body).toBeUndefined()
    expect(requestAt(1)).toMatchObject({
      method: 'GET',
      path: '/rest/api/2/issue/QA-1/comment',
      query: { maxResults: '25' }
    })
    expect(requestAt(1).body).toBeUndefined()
    expect(requestAt(2)).toMatchObject({
      method: 'PUT',
      path: '/rest/api/2/issue/QA-1',
      query: { notifyUsers: 'true' }
    })
    expect(JSON.parse(requestAt(2).body ?? '')).toEqual({
      fields: {
        summary: 'summary',
        description: 'description',
        issuetype: { id: '3' },
        labels: ['urgent']
      }
    })
    expect(requestAt(3)).toMatchObject({
      method: 'POST',
      path: '/rest/api/2/issue/QA-1/comment'
    })
    expect(JSON.parse(requestAt(3).body ?? '')).toEqual({ body: 'hello' })
    expect(requestAt(4)).toMatchObject({
      method: 'PUT',
      path: '/rest/api/2/issue/QA-1/comment/7'
    })
    expect(JSON.parse(requestAt(4).body ?? '')).toEqual({ body: 'hello' })
    expect(requestAt(5)).toMatchObject({ method: 'POST', path: '/rest/api/2/issueLink' })
    expect(JSON.parse(requestAt(5).body ?? '')).toEqual({
      type: { name: 'Blocks' },
      inwardIssue: { key: 'QA-1' },
      outwardIssue: { key: 'QA-2' },
      comment: { body: 'rel' }
    })
    expect(requestAt(6)).toMatchObject({
      method: 'GET',
      path: '/rest/api/2/issue/QA-1',
      query: { fields: 'attachment' }
    })
  })

  it('non-2xx는 bounded Jira details와 status code로 실패한다', async () => {
    const fake = context(() =>
      response(
        { errorMessages: ['missing'], errors: { issueKey: 'invalid' }, html: '<secret>' },
        404
      )
    )
    await expect(
      createJiraService(fake.ctx).invoke('jira_getIssue', { issueKey: 'QA-404' })
    ).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
      details: { errorMessages: ['missing'], errors: { issueKey: 'invalid' } }
    })
  })

  it('issue attachment는 10개만 순차 download하고 나머지를 skipped로 보고한다', async () => {
    const beans = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      filename: `${index + 1}.txt`,
      content: `https://jira.example.com/files/${index + 1}`
    }))
    const fake = context((req) =>
      req.responseType === 'binary'
        ? response('', 200, Buffer.from('x'))
        : response({ fields: { attachment: beans } })
    )
    const data = await createJiraService(fake.ctx).invoke('jira_downloadAttachment', {
      issueKey: 'QA-1',
      returnContent: 'text',
      maxInlineBytes: 10,
      save: false
    })
    expect(data).toMatchObject({ count: 10 })
    expect((data as { skipped: unknown[] }).skipped).toHaveLength(2)
    expect(
      fake.request.mock.calls.filter((call) => call[0].responseType === 'binary')
    ).toHaveLength(10)
  })

  it('save batch는 publish 전 prepared 상태이고 중간 실패면 stage 전체를 abort할 수 있다', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'orca-jira-service-'))
    roots.push(directory)
    let binaryCall = 0
    const fake = context((req) => {
      if (req.responseType !== 'binary') {
        return response({
          fields: {
            attachment: [
              { id: '1', filename: 'a.txt', content: 'https://jira.example.com/a' },
              { id: '2', filename: 'b.txt', content: 'https://jira.example.com/b' }
            ]
          }
        })
      }
      binaryCall += 1
      if (binaryCall === 2) throw new Error('network failed')
      return response('', 200, Buffer.from('a'))
    })
    const service = createJiraService(fake.ctx, {}, createJiraAttachmentStore({ root: directory }))
    await expect(
      service.invoke('jira_downloadAttachment', { issueKey: 'QA-1', save: true })
    ).rejects.toThrow('network failed')
    const { readdir } = await import('node:fs/promises')
    const selector = join(directory, 'jira', 'jira-corp', 'issue-QA-1')
    expect(await readdir(selector)).toEqual(['.staging'])
  })

  it('single save 성공은 output preflight가 publish를 결정할 prepared invocation을 돌려준다', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'orca-jira-service-'))
    roots.push(directory)
    const fake = context((req) =>
      req.responseType === 'binary'
        ? response('', 200, Buffer.from('hello'))
        : response({ id: '42', filename: 'hello.txt', content: 'https://jira.example.com/hello' })
    )
    const value = await createJiraService(
      fake.ctx,
      {},
      createJiraAttachmentStore({ root: directory })
    ).invoke('jira_downloadAttachment', {
      attachmentId: '42',
      save: true,
      returnContent: 'text',
      maxInlineBytes: 1024
    })
    expect(isJiraPreparedInvocation(value)).toBe(true)
    if (!isJiraPreparedInvocation(value)) throw new JiraToolError('jira_error', 'not prepared')
    const path = value.data.attachments[0].savedPath!
    const { stat } = await import('node:fs/promises')
    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
    await value.commit()
    await expect(stat(path)).resolves.toBeTruthy()
  })
})
