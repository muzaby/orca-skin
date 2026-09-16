import type { AuthenticatedRequest, AuthenticatedResponse } from '../../../contracts/auth'
import {
  attachmentContentRequest,
  buildDevelopmentInfoRequest,
  buildJiraRequest,
  JIRA_ATTACHMENT_HARD_MAX_BYTES,
  JIRA_DEFAULT_PAGE_SIZE,
  JIRA_MAX_PAGE_SIZE
} from './rest'
import {
  jiraHttpErrorCode,
  JiraToolError,
  type JiraDownloadData,
  type JiraDownloadedAttachment,
  type JiraErrorDetails,
  type JiraPreparedInvocation
} from './result'
import { createJiraAttachmentStore, type JiraAttachmentStore } from './attachment-store'
import type { JiraPluginContext, JiraServicePort, JiraToolName, JiraToolOptions } from './tools'

type Input = Readonly<Record<string, unknown>>
type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null
}

function boundedDetails(value: unknown): JiraErrorDetails | undefined {
  const source = object(value)
  if (!source) return undefined
  const messages = Array.isArray(source.errorMessages)
    ? source.errorMessages
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 20)
        .map((item) => item.slice(0, 512))
    : undefined
  const rawErrors = object(source.errors)
  const errors = rawErrors
    ? Object.fromEntries(
        Object.entries(rawErrors)
          .slice(0, 50)
          .map(([key, item]) => [key.slice(0, 128), String(item).slice(0, 512)])
      )
    : undefined
  return messages?.length || (errors && Object.keys(errors).length)
    ? { ...(messages?.length ? { errorMessages: messages } : {}), ...(errors ? { errors } : {}) }
    : undefined
}

function parseJson(response: AuthenticatedResponse): unknown {
  if (response.status === 204 || response.body.trim() === '') return null
  try {
    return JSON.parse(response.body)
  } catch {
    throw new JiraToolError('invalid_response', 'invalid_response')
  }
}

async function requestJson(
  ctx: JiraPluginContext,
  request: AuthenticatedRequest,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await ctx.request(request, signal)
  if (!response.ok) {
    let parsed: unknown
    try {
      parsed = response.body ? JSON.parse(response.body) : undefined
    } catch {
      parsed = undefined
    }
    throw new JiraToolError(
      jiraHttpErrorCode(response.status),
      `Jira request failed with status ${response.status}`,
      response.status,
      boundedDetails(parsed)
    )
  }
  return parseJson(response)
}

interface AttachmentBean {
  id?: string
  filename?: string
  mimeType?: string
  size?: number
  content?: string
}

function bean(value: unknown): AttachmentBean {
  const source = object(value)
  if (!source) throw new JiraToolError('invalid_response', 'invalid_response')
  return {
    ...(source.id !== undefined ? { id: String(source.id) } : {}),
    ...(typeof source.filename === 'string' ? { filename: source.filename } : {}),
    ...(typeof source.mimeType === 'string' ? { mimeType: source.mimeType } : {}),
    ...(typeof source.size === 'number' ? { size: source.size } : {}),
    ...(typeof source.content === 'string' ? { content: source.content } : {})
  }
}

function selectorOf(input: Input): { key: string; single: boolean } {
  if (typeof input.attachmentId === 'string' && !input.issueKey) {
    return { key: `attachment-${input.attachmentId}`, single: true }
  }
  if (typeof input.issueKey === 'string' && !input.attachmentId) {
    return { key: `issue-${input.issueKey}`, single: false }
  }
  throw new JiraToolError('invalid_input', 'invalid_input')
}

export function createJiraService(
  ctx: JiraPluginContext,
  options: JiraToolOptions = {},
  store: JiraAttachmentStore = createJiraAttachmentStore()
): JiraServicePort {
  const basePath = options.apiBasePath
  const pageSize = options.defaultPageSize ?? JIRA_DEFAULT_PAGE_SIZE
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > JIRA_MAX_PAGE_SIZE) {
    throw new JiraToolError('invalid_input', 'invalid defaultPageSize')
  }
  const attachmentMax = options.maxAttachmentBytes ?? JIRA_ATTACHMENT_HARD_MAX_BYTES
  if (
    !Number.isInteger(attachmentMax) ||
    attachmentMax < 1 ||
    attachmentMax > JIRA_ATTACHMENT_HARD_MAX_BYTES
  ) {
    throw new JiraToolError('invalid_input', 'invalid maxAttachmentBytes')
  }

  async function download(
    input: Input,
    signal?: AbortSignal
  ): Promise<JiraDownloadData | JiraPreparedInvocation> {
    const selector = selectorOf(input)
    const metadata = await requestJson(
      ctx,
      buildJiraRequest('jira_downloadAttachment', input, basePath, pageSize),
      signal
    )
    let all: AttachmentBean[]
    if (selector.single) {
      all = [bean(metadata)]
    } else {
      const fields = object(object(metadata)?.fields)
      const attachments = fields?.attachment
      if (!Array.isArray(attachments))
        throw new JiraToolError('invalid_response', 'invalid_response')
      all = attachments.map(bean)
      if (typeof input.filename === 'string') {
        all = all.filter((item) => item.filename === input.filename)
      }
    }
    if (all.length === 0) throw new JiraToolError('not_found', 'No matching Jira attachments')
    const selected = all.slice(0, 10)
    const skipped = all.slice(10).map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      ...(item.filename ? { filename: item.filename } : {}),
      reason: 'call_limit' as const
    }))
    const save = input.save === true
    const batch = save ? await store.begin(ctx.authId, selector.key) : undefined
    const output: JiraDownloadedAttachment[] = []
    try {
      for (const item of selected) {
        if (!item.content)
          throw new JiraToolError('invalid_response', 'Attachment has no content URL')
        if (item.size !== undefined && item.size > attachmentMax) {
          throw new JiraToolError('attachment_too_large', 'attachment_too_large')
        }
        const response = await ctx.request(
          attachmentContentRequest(ctx.origin, item.content, attachmentMax),
          signal
        )
        if (!response.ok) {
          throw new JiraToolError(
            jiraHttpErrorCode(response.status),
            `Jira request failed with status ${response.status}`,
            response.status
          )
        }
        const bytes = response.bodyBytes ?? Buffer.from(response.body)
        if (bytes.byteLength > attachmentMax) {
          throw new JiraToolError('attachment_too_large', 'attachment_too_large')
        }
        const originalName = item.filename ?? item.id ?? 'attachment'
        const written = batch
          ? await batch.write(
              selector.single && typeof input.saveName === 'string' ? input.saveName : originalName,
              bytes
            )
          : undefined
        const attachment: JiraDownloadedAttachment = {
          ...(item.id ? { id: item.id } : {}),
          filename: written?.filename ?? originalName,
          ...(item.mimeType ? { mediaType: item.mimeType } : {}),
          size: bytes.byteLength,
          ...(written ? { savedPath: written.savedPath } : {})
        }
        const returnContent = input.returnContent ?? 'none'
        const inlineMax = Number(input.maxInlineBytes ?? 1024 * 1024)
        if (returnContent !== 'none') {
          if (bytes.byteLength > inlineMax) {
            Object.assign(attachment, { contentOmittedReason: 'inline_file_limit' as const })
          } else if (returnContent === 'base64') {
            Object.assign(attachment, {
              encoding: 'base64' as const,
              content: Buffer.from(bytes).toString('base64')
            })
          } else {
            Object.assign(attachment, {
              encoding: 'text' as const,
              content: new TextDecoder().decode(bytes)
            })
          }
        }
        output.push(attachment)
      }
    } catch (error) {
      await batch?.abort()
      throw error
    }
    const data: JiraDownloadData = { count: output.length, attachments: output, skipped }
    return batch ? { data, commit: () => batch.commit(), abort: () => batch.abort() } : data
  }

  return {
    async invoke(
      tool: JiraToolName,
      input: Input,
      signal?: AbortSignal
    ): Promise<unknown | JiraPreparedInvocation> {
      if (tool === 'jira_downloadAttachment') return download(input, signal)
      if (tool === 'jira_getIssueDevelopmentInfo') {
        const issue = object(
          await requestJson(ctx, buildJiraRequest(tool, input, basePath, pageSize), signal)
        )
        if (!issue || issue.id === undefined) {
          throw new JiraToolError('invalid_response', 'Could not resolve numeric Jira issue id')
        }
        return requestJson(
          ctx,
          buildDevelopmentInfoRequest(
            String(issue.id),
            typeof input.dataType === 'string' ? input.dataType : undefined,
            typeof input.applicationType === 'string' ? input.applicationType : undefined,
            basePath
          ),
          signal
        )
      }
      return requestJson(ctx, buildJiraRequest(tool, input, basePath, pageSize), signal)
    }
  }
}
