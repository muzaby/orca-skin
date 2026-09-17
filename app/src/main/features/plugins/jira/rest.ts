import type { AuthenticatedRequest } from '../../../contracts/auth'
import { JiraToolError } from './result'
import { JIRA_SOURCE } from './source'
import type { JiraToolName } from './tools'

export const JIRA_JSON_MAX_BYTES = 2 * 1024 * 1024
export const JIRA_REQUEST_MAX_BYTES = 1024 * 1024
export const JIRA_ATTACHMENT_HARD_MAX_BYTES = 25 * 1024 * 1024
export const JIRA_DEFAULT_PAGE_SIZE = 25
export const JIRA_MAX_PAGE_SIZE = 100
export const JIRA_USER_AGENT = `Orcinus-Orca-Jira/${JIRA_SOURCE.version}`
export const JIRA_REQUEST_HEADERS = {
  'User-Agent': JIRA_USER_AGENT,
  'X-Atlassian-Token': 'no-check'
} as const
export const JIRA_AUTH_FAILURE_STATUSES = [401] as const
export const JIRA_DEFAULT_SEARCH_FIELDS = [
  'summary',
  'description',
  'status',
  'assignee',
  'reporter',
  'priority',
  'issuetype',
  'labels',
  'updated'
] as const
export const JIRA_DEFAULT_ISSUE_FIELDS = [...JIRA_DEFAULT_SEARCH_FIELDS, 'parent', 'subtasks']

type Input = Readonly<Record<string, unknown>>

const segment = (value: unknown): string => encodeURIComponent(String(value))

function jiraRequest(request: AuthenticatedRequest): AuthenticatedRequest {
  return {
    ...request,
    headers: {
      ...request.headers,
      ...JIRA_REQUEST_HEADERS
    },
    authFailureStatuses: JIRA_AUTH_FAILURE_STATUSES
  }
}

export function normalizeJiraApiBasePath(path = '/rest'): string {
  const normalized = path.trim().replace(/\/+$/, '') || '/rest'
  if (
    !normalized.startsWith('/') ||
    normalized.includes('://') ||
    normalized.split('/').includes('..')
  ) {
    throw new JiraToolError('invalid_input', 'invalid Jira apiBasePath')
  }
  return normalized
}

function jsonRequest(
  path: string,
  method: string,
  body: unknown,
  query?: Record<string, string>
): AuthenticatedRequest {
  const serialized = JSON.stringify(body)
  if (Buffer.byteLength(serialized, 'utf8') > JIRA_REQUEST_MAX_BYTES) {
    throw new JiraToolError('request_too_large', 'request_too_large')
  }
  return jiraRequest({
    path,
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(query ? { query } : {}),
    body: serialized,
    maxBytes: JIRA_JSON_MAX_BYTES
  })
}

function readRequest(path: string, query?: Record<string, string>): AuthenticatedRequest {
  return jiraRequest({
    path,
    method: 'GET',
    ...(query ? { query } : {}),
    maxBytes: JIRA_JSON_MAX_BYTES
  })
}

function optionalQuery(
  entries: readonly (readonly [string, unknown])[]
): Record<string, string> | undefined {
  const query: Record<string, string> = {}
  for (const [key, value] of entries) if (value !== undefined) query[key] = String(value)
  return Object.keys(query).length ? query : undefined
}

export function buildJiraRequest(
  tool: JiraToolName,
  input: Input,
  apiBasePath = '/rest',
  defaultPageSize = JIRA_DEFAULT_PAGE_SIZE
): AuthenticatedRequest {
  const base = normalizeJiraApiBasePath(apiBasePath)
  const issue = `${base}/api/2/issue`
  switch (tool) {
    case 'jira_searchIssues':
      return jsonRequest(`${base}/api/2/search`, 'POST', {
        jql: input.jql,
        maxResults: input.maxResults ?? defaultPageSize,
        ...(input.fields ? { fields: input.fields } : { fields: JIRA_DEFAULT_SEARCH_FIELDS }),
        ...(input.expand ? { expand: input.expand } : {}),
        ...(input.startAt !== undefined ? { startAt: input.startAt } : {})
      })
    case 'jira_getIssue':
      return readRequest(`${issue}/${segment(input.issueKey)}`, {
        fields: ((input.fields as string[] | undefined) ?? JIRA_DEFAULT_ISSUE_FIELDS).join(','),
        ...(input.expand ? { expand: String(input.expand) } : {})
      })
    case 'jira_getIssueComments':
      return readRequest(
        `${issue}/${segment(input.issueKey)}/comment`,
        optionalQuery([
          ['expand', input.expand],
          ['maxResults', input.maxResults ?? defaultPageSize],
          ['startAt', input.startAt]
        ])
      )
    case 'jira_createIssue': {
      const standard = {
        project: { key: input.projectId },
        summary: input.summary,
        description: input.description,
        issuetype: { id: input.issueTypeId }
      }
      return jsonRequest(
        issue,
        'POST',
        { fields: { ...standard, ...((input.customFields as object | undefined) ?? {}) } },
        { updateHistory: 'true' }
      )
    }
    case 'jira_updateIssue': {
      const fields: Record<string, unknown> = {}
      if (input.summary !== undefined) fields.summary = input.summary
      if (input.description !== undefined) fields.description = input.description
      if (input.issueTypeId !== undefined) fields.issuetype = { id: input.issueTypeId }
      Object.assign(fields, (input.customFields as object | undefined) ?? {})
      return jsonRequest(
        `${issue}/${segment(input.issueKey)}`,
        'PUT',
        { fields },
        { notifyUsers: 'true' }
      )
    }
    case 'jira_postIssueComment':
      return jsonRequest(`${issue}/${segment(input.issueKey)}/comment`, 'POST', {
        body: input.comment
      })
    case 'jira_updateIssueComment':
      return jsonRequest(
        `${issue}/${segment(input.issueKey)}/comment/${segment(input.commentId)}`,
        'PUT',
        { body: input.comment }
      )
    case 'jira_getTransitions':
      return readRequest(`${issue}/${segment(input.issueKey)}/transitions`)
    case 'jira_getIssueDevelopmentInfo':
      return readRequest(`${issue}/${segment(input.issueKey)}`, { fields: 'id' })
    case 'jira_transitionIssue': {
      const body: Record<string, unknown> = { transition: { id: input.transitionId } }
      if (input.fields) body.fields = input.fields
      Object.assign(body, (input.customFields as object | undefined) ?? {})
      return jsonRequest(`${issue}/${segment(input.issueKey)}/transitions`, 'POST', body)
    }
    case 'jira_getIssueLinkTypes':
      return readRequest(`${base}/api/2/issueLinkType`)
    case 'jira_linkIssues':
      return jsonRequest(`${base}/api/2/issueLink`, 'POST', {
        type: { name: input.linkType },
        inwardIssue: { key: input.inwardIssueKey },
        outwardIssue: { key: input.outwardIssueKey },
        ...(input.comment ? { comment: { body: input.comment } } : {})
      })
    case 'jira_unlinkIssues':
      return jiraRequest({
        path: `${base}/api/2/issueLink/${segment(input.linkId)}`,
        method: 'DELETE',
        maxBytes: JIRA_JSON_MAX_BYTES
      })
    case 'jira_downloadAttachment':
      return input.attachmentId
        ? readRequest(`${base}/api/2/attachment/${segment(input.attachmentId)}`)
        : readRequest(`${issue}/${segment(input.issueKey)}`, { fields: 'attachment' })
  }
}

export function buildDevelopmentInfoRequest(
  issueId: string,
  dataType = 'pullrequest',
  applicationType = 'stash',
  apiBasePath = '/rest'
): AuthenticatedRequest {
  return readRequest(`${normalizeJiraApiBasePath(apiBasePath)}/dev-status/1.0/issue/detail`, {
    issueId,
    applicationType,
    dataType
  })
}

export function attachmentContentRequest(
  origin: string,
  absoluteUrl: string,
  maxBytes: number
): AuthenticatedRequest {
  let expected: URL
  let target: URL
  try {
    expected = new URL(origin)
    target = new URL(absoluteUrl)
  } catch {
    throw new JiraToolError('unsafe_attachment_url', 'unsafe_attachment_url')
  }
  if (target.origin !== expected.origin) {
    throw new JiraToolError('unsafe_attachment_url', 'unsafe_attachment_url')
  }
  const query = Object.fromEntries(target.searchParams.entries())
  return jiraRequest({
    path: target.pathname,
    method: 'GET',
    ...(Object.keys(query).length ? { query } : {}),
    responseType: 'binary',
    maxBytes
  })
}
