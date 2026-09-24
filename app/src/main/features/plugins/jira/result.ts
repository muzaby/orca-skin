import { jsonToolResult, type RuntimeToolResult } from '../../../adapters/runtime-tools'

export const JIRA_TOOL_OUTPUT_MAX_BYTES = 2 * 1024 * 1024

export type JiraErrorCode =
  | 'invalid_input'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'request_too_large'
  | 'response_too_large'
  | 'tool_output_too_large'
  | 'attachment_too_large'
  | 'unsafe_attachment_url'
  | 'filesystem_error'
  | 'cancelled'
  | 'transport_error'
  | 'invalid_response'
  | 'jira_error'

export interface JiraErrorDetails {
  readonly errorMessages?: readonly string[]
  readonly errors?: Readonly<Record<string, string>>
}

export type JiraToolEnvelope =
  | { ok: true; tool: string; data: unknown }
  | {
      ok: false
      tool: string
      error: { code: JiraErrorCode; message: string; status?: number; details?: JiraErrorDetails }
    }

export interface JiraDownloadedAttachment {
  readonly id?: string
  readonly filename: string
  readonly mediaType?: string
  readonly size: number
  readonly savedPath?: string
  readonly encoding?: 'base64' | 'text'
  readonly content?: string
  readonly contentOmittedReason?: 'inline_file_limit' | 'tool_output_limit'
}

export interface JiraDownloadData {
  readonly count: number
  readonly attachments: readonly JiraDownloadedAttachment[]
  readonly skipped: readonly { id?: string; filename?: string; reason: 'call_limit' }[]
}

export interface JiraPreparedInvocation {
  readonly data: JiraDownloadData
  commit(): Promise<void>
  abort(): Promise<void>
}

export class JiraToolError extends Error {
  constructor(
    readonly code: JiraErrorCode,
    message: string,
    readonly status?: number,
    readonly details?: JiraErrorDetails
  ) {
    super(message)
    this.name = 'JiraToolError'
  }
}

export function isJiraPreparedInvocation(value: unknown): value is JiraPreparedInvocation {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'data' in value &&
    'commit' in value &&
    typeof value.commit === 'function' &&
    'abort' in value &&
    typeof value.abort === 'function'
  )
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

function resultOf(envelope: JiraToolEnvelope, isError = false): RuntimeToolResult {
  return jsonToolResult(envelope as unknown as Record<string, unknown>, isError)
}

function boundedDownload(tool: string, data: JiraDownloadData, maxBytes: number): JiraDownloadData {
  const attachments = data.attachments.map((attachment) => ({ ...attachment }))
  for (let index = attachments.length - 1; index >= 0; index -= 1) {
    const attachment = attachments[index]
    if (!attachment || attachment.content === undefined) continue
    delete attachment.content
    delete attachment.encoding
    attachment.contentOmittedReason = 'tool_output_limit'
  }
  const metadataOnly = { ...data, attachments }
  if (byteLength({ ok: true, tool, data: metadataOnly }) > maxBytes) {
    throw new JiraToolError('tool_output_too_large', 'tool_output_too_large')
  }

  const resolved = attachments.map((attachment, index) => {
    const source = data.attachments[index]
    if (!source || source.content === undefined) return attachment
    const candidate = { ...source }
    const next = attachments.map((item, itemIndex) => (itemIndex === index ? candidate : item))
    if (byteLength({ ok: true, tool, data: { ...data, attachments: next } }) <= maxBytes) {
      attachments[index] = candidate
      return candidate
    }
    return attachment
  })
  return { ...data, attachments: resolved }
}

export function prepareJiraSuccessResult(
  tool: string,
  data: unknown,
  maxBytes = JIRA_TOOL_OUTPUT_MAX_BYTES
): RuntimeToolResult {
  const bounded =
    tool === 'jira_downloadAttachment' && data && typeof data === 'object'
      ? boundedDownload(tool, data as JiraDownloadData, maxBytes)
      : data
  const envelope: JiraToolEnvelope = { ok: true, tool, data: bounded }
  if (byteLength(envelope) > maxBytes) {
    throw new JiraToolError('tool_output_too_large', 'tool_output_too_large')
  }
  return resultOf(envelope)
}

const SECRET_HEADER = /\b(authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*[^\r\n]+/gi
const BEARER = /\bbearer\s+[^\s,;"']+/gi

function redactMessage(message: string): string {
  return message
    .replace(SECRET_HEADER, '$1: [redacted]')
    .replace(BEARER, 'Bearer [redacted]')
    .slice(0, 512)
}

function safeMessage(error: unknown): string {
  if (error instanceof JiraToolError) return redactMessage(error.message)
  if (error instanceof Error) return redactMessage(error.message)
  return 'Jira request failed'
}

function safeDetails(details: JiraErrorDetails | undefined): JiraErrorDetails | undefined {
  if (!details) return undefined
  const errorMessages = details.errorMessages?.slice(0, 20).map(redactMessage)
  const errors = details.errors
    ? Object.fromEntries(
        Object.entries(details.errors)
          .slice(0, 50)
          .map(([key, value]) => [redactMessage(key).slice(0, 128), redactMessage(value)])
      )
    : undefined
  return errorMessages?.length || (errors && Object.keys(errors).length)
    ? {
        ...(errorMessages?.length ? { errorMessages } : {}),
        ...(errors && Object.keys(errors).length ? { errors } : {})
      }
    : undefined
}

function inferredCode(error: unknown): JiraErrorCode {
  if (error instanceof JiraToolError) return error.code
  if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
  if (error instanceof Error && error.name === 'ResponseTooLargeError') return 'response_too_large'
  return 'transport_error'
}

export function toJiraErrorResult(tool: string, error: unknown): RuntimeToolResult {
  const known = error instanceof JiraToolError ? error : undefined
  const details = safeDetails(known?.details)
  const envelope: JiraToolEnvelope = {
    ok: false,
    tool,
    error: {
      code: inferredCode(error),
      message: safeMessage(error),
      ...(known?.status !== undefined ? { status: known.status } : {}),
      ...(details ? { details } : {})
    }
  }
  return resultOf(envelope, true)
}

export function jiraHttpErrorCode(status: number): JiraErrorCode {
  if (status === 401) return 'unauthenticated'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rate_limited'
  return 'jira_error'
}
