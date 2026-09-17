import { describe, expect, it } from 'vitest'
import {
  attachmentContentRequest,
  buildDevelopmentInfoRequest,
  buildJiraRequest,
  normalizeJiraApiBasePath
} from './rest'

describe('Jira REST 0.34.0 mapping', () => {
  it.each([
    ['jira_searchIssues', { jql: 'project = QA' }, 'POST', '/rest/api/2/search'],
    ['jira_getIssue', { issueKey: 'QA/1' }, 'GET', '/rest/api/2/issue/QA%2F1'],
    ['jira_getIssueComments', { issueKey: 'QA-1' }, 'GET', '/rest/api/2/issue/QA-1/comment'],
    [
      'jira_createIssue',
      { projectId: 'QA', summary: 's', description: 'd', issueTypeId: '3' },
      'POST',
      '/rest/api/2/issue'
    ],
    ['jira_updateIssue', { issueKey: 'QA-1', summary: 's' }, 'PUT', '/rest/api/2/issue/QA-1'],
    [
      'jira_postIssueComment',
      { issueKey: 'QA-1', comment: 'c' },
      'POST',
      '/rest/api/2/issue/QA-1/comment'
    ],
    [
      'jira_updateIssueComment',
      { issueKey: 'QA-1', commentId: '7', comment: 'c' },
      'PUT',
      '/rest/api/2/issue/QA-1/comment/7'
    ],
    ['jira_getTransitions', { issueKey: 'QA-1' }, 'GET', '/rest/api/2/issue/QA-1/transitions'],
    ['jira_getIssueDevelopmentInfo', { issueKey: 'QA-1' }, 'GET', '/rest/api/2/issue/QA-1'],
    [
      'jira_transitionIssue',
      { issueKey: 'QA-1', transitionId: '31' },
      'POST',
      '/rest/api/2/issue/QA-1/transitions'
    ],
    ['jira_getIssueLinkTypes', {}, 'GET', '/rest/api/2/issueLinkType'],
    [
      'jira_linkIssues',
      { inwardIssueKey: 'QA-1', outwardIssueKey: 'QA-2', linkType: 'Blocks' },
      'POST',
      '/rest/api/2/issueLink'
    ],
    ['jira_unlinkIssues', { linkId: '99' }, 'DELETE', '/rest/api/2/issueLink/99'],
    ['jira_downloadAttachment', { attachmentId: '42' }, 'GET', '/rest/api/2/attachment/42']
  ] as const)('%s → %s %s와 Jira transport policy', (tool, input, method, path) => {
    const request = buildJiraRequest(tool, input)
    expect(request.method).toBe(method)
    expect(request.path).toBe(path)
    expect(request.headers).toMatchObject({
      'User-Agent': 'Orcinus-Orca-Jira/0.34.0',
      'X-Atlassian-Token': 'no-check'
    })
    expect(request.authFailureStatuses).toEqual([401])
  })

  it('search defaults와 create/update/transition/link payload 의미를 보존한다', () => {
    const search = buildJiraRequest('jira_searchIssues', { jql: 'project = QA' })
    expect(JSON.parse(search.body ?? '')).toEqual({
      jql: 'project = QA',
      maxResults: 25,
      fields: [
        'summary',
        'description',
        'status',
        'assignee',
        'reporter',
        'priority',
        'issuetype',
        'labels',
        'updated'
      ]
    })

    const create = buildJiraRequest('jira_createIssue', {
      projectId: 'QA',
      summary: 's',
      description: 'd',
      issueTypeId: '3',
      customFields: { summary: 'override', labels: ['urgent'] }
    })
    expect(create.query).toEqual({ updateHistory: 'true' })
    expect(JSON.parse(create.body ?? '')).toEqual({
      fields: {
        project: { key: 'QA' },
        summary: 'override',
        description: 'd',
        issuetype: { id: '3' },
        labels: ['urgent']
      }
    })

    const transition = buildJiraRequest('jira_transitionIssue', {
      issueKey: 'QA-1',
      transitionId: '31',
      fields: { resolution: { id: '1' } },
      customFields: { update: { comment: [{ add: { body: 'done' } }] } }
    })
    expect(JSON.parse(transition.body ?? '')).toEqual({
      transition: { id: '31' },
      fields: { resolution: { id: '1' } },
      update: { comment: [{ add: { body: 'done' } }] }
    })
  })

  it('context base path와 query를 origin에서 분리한다', () => {
    expect(normalizeJiraApiBasePath('/company/jira/rest/')).toBe('/company/jira/rest')
    const req = buildDevelopmentInfoRequest('123', 'branch', 'github', '/company/jira/rest')
    expect(req).toMatchObject({
      path: '/company/jira/rest/dev-status/1.0/issue/detail',
      query: { issueId: '123', dataType: 'branch', applicationType: 'github' },
      headers: {
        'User-Agent': 'Orcinus-Orca-Jira/0.34.0',
        'X-Atlassian-Token': 'no-check'
      },
      authFailureStatuses: [401]
    })
  })

  it('attachment absolute URL은 같은 origin만 path+query로 바꾼다', () => {
    expect(
      attachmentContentRequest(
        'https://jira.example.com',
        'https://jira.example.com/secure/attachment/1/a.txt?download=1',
        1024
      )
    ).toMatchObject({
      path: '/secure/attachment/1/a.txt',
      query: { download: '1' },
      responseType: 'binary',
      maxBytes: 1024,
      headers: {
        'User-Agent': 'Orcinus-Orca-Jira/0.34.0',
        'X-Atlassian-Token': 'no-check'
      },
      authFailureStatuses: [401]
    })
    expect(() =>
      attachmentContentRequest('https://jira.example.com', 'https://evil.example/steal', 1024)
    ).toThrow('unsafe_attachment_url')
  })

  it('1 MiB 초과 JSON body는 remote call 전에 거부한다', () => {
    expect(() =>
      buildJiraRequest('jira_postIssueComment', {
        issueKey: 'QA-1',
        comment: 'x'.repeat(1024 * 1024)
      })
    ).toThrow('request_too_large')
  })
})
