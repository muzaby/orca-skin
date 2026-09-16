import { z } from 'zod'
import type { AuthenticatedRequest, AuthenticatedResponse } from '../../../contracts/auth'
import type { RuntimeToolImplementation, RuntimeToolServer } from '../../../adapters/runtime-tools'
import { authToolServerId } from '../../../adapters/runtime-tool-policy'
import {
  isJiraPreparedInvocation,
  JiraToolError,
  prepareJiraSuccessResult,
  toJiraErrorResult,
  type JiraPreparedInvocation
} from './result'
import { createJiraService } from './service'

export const JIRA_TOOL_NAMES = [
  'jira_searchIssues',
  'jira_getIssue',
  'jira_getIssueComments',
  'jira_createIssue',
  'jira_updateIssue',
  'jira_postIssueComment',
  'jira_updateIssueComment',
  'jira_getTransitions',
  'jira_getIssueDevelopmentInfo',
  'jira_transitionIssue',
  'jira_getIssueLinkTypes',
  'jira_linkIssues',
  'jira_unlinkIssues',
  'jira_downloadAttachment'
] as const

export type JiraToolName = (typeof JIRA_TOOL_NAMES)[number]

export interface JiraPluginContext {
  readonly authId: string
  readonly label: string
  readonly origin: string
  request(req: AuthenticatedRequest, signal?: AbortSignal): Promise<AuthenticatedResponse>
}

export interface JiraToolOptions {
  readonly apiBasePath?: string
  readonly defaultPageSize?: number
  readonly maxAttachmentBytes?: number
}

export interface JiraServicePort {
  invoke(
    tool: JiraToolName,
    input: Readonly<Record<string, unknown>>,
    signal?: AbortSignal
  ): Promise<unknown | JiraPreparedInvocation>
}

const record = z.record(z.string(), z.unknown())
const page = z.number().int().min(1).max(100).optional()
const offset = z.number().int().min(0).optional()

const schemas = {
  jira_searchIssues: z.object({
    jql: z.string().min(1),
    maxResults: page,
    startAt: offset,
    expand: z.array(z.string()).optional(),
    fields: z.array(z.string()).optional()
  }),
  jira_getIssue: z.object({
    issueKey: z.string().min(1),
    expand: z.string().optional(),
    fields: z.array(z.string()).optional()
  }),
  jira_getIssueComments: z.object({
    issueKey: z.string().min(1),
    expand: z.string().optional(),
    maxResults: page,
    startAt: offset
  }),
  jira_createIssue: z.object({
    projectId: z.string().min(1),
    summary: z.string(),
    description: z.string(),
    issueTypeId: z.string().min(1),
    customFields: record.optional()
  }),
  jira_updateIssue: z.object({
    issueKey: z.string().min(1),
    summary: z.string().optional(),
    description: z.string().optional(),
    issueTypeId: z.string().optional(),
    customFields: record.optional()
  }),
  jira_postIssueComment: z.object({ issueKey: z.string().min(1), comment: z.string() }),
  jira_updateIssueComment: z.object({
    issueKey: z.string().min(1),
    commentId: z.string().min(1),
    comment: z.string()
  }),
  jira_getTransitions: z.object({ issueKey: z.string().min(1) }),
  jira_getIssueDevelopmentInfo: z.object({
    issueKey: z.string().min(1),
    dataType: z.enum(['pullrequest', 'repository', 'branch']).optional(),
    applicationType: z.enum(['stash', 'bitbucket', 'github', 'githube']).optional()
  }),
  jira_transitionIssue: z.object({
    issueKey: z.string().min(1),
    transitionId: z.string().min(1),
    fields: record.optional(),
    customFields: record.optional()
  }),
  jira_getIssueLinkTypes: z.object({}),
  jira_linkIssues: z.object({
    inwardIssueKey: z.string().min(1),
    outwardIssueKey: z.string().min(1),
    linkType: z.string().min(1),
    comment: z.string().optional()
  }),
  jira_unlinkIssues: z.object({ linkId: z.string().min(1) }),
  jira_downloadAttachment: z
    .object({
      issueKey: z.string().min(1).optional(),
      attachmentId: z.string().min(1).optional(),
      filename: z.string().optional(),
      returnContent: z.enum(['none', 'base64', 'text']).default('none'),
      maxInlineBytes: z
        .number()
        .int()
        .min(0)
        .max(1024 * 1024)
        .default(1024 * 1024),
      save: z.boolean().default(false),
      saveName: z.string().optional()
    })
    .superRefine((value, refinement) => {
      if (Boolean(value.issueKey) === Boolean(value.attachmentId)) {
        refinement.addIssue({ code: 'custom', message: 'exactly one selector is required' })
      }
      if (value.saveName && !value.attachmentId) {
        refinement.addIssue({ code: 'custom', message: 'saveName requires attachmentId' })
      }
    })
} satisfies Record<JiraToolName, z.ZodType<Record<string, unknown>>>

const READ_ONLY = new Set<JiraToolName>([
  'jira_searchIssues',
  'jira_getIssue',
  'jira_getIssueComments',
  'jira_getTransitions',
  'jira_getIssueDevelopmentInfo',
  'jira_getIssueLinkTypes'
])

const DESCRIPTIONS: Record<JiraToolName, string> = {
  jira_searchIssues: 'Search Jira Data Center issues with JQL.',
  jira_getIssue: 'Get one Jira Data Center issue by key.',
  jira_getIssueComments: 'Get comments for one Jira Data Center issue.',
  jira_createIssue: 'Create a Jira Data Center issue.',
  jira_updateIssue: 'Update a Jira Data Center issue.',
  jira_postIssueComment: 'Post a comment to a Jira Data Center issue.',
  jira_updateIssueComment: 'Replace an existing Jira Data Center comment body.',
  jira_getTransitions: 'Get available transitions for a Jira Data Center issue.',
  jira_getIssueDevelopmentInfo: 'Get linked development information for a Jira issue.',
  jira_transitionIssue: 'Transition a Jira Data Center issue.',
  jira_getIssueLinkTypes: 'Get available Jira issue link types.',
  jira_linkIssues:
    'Link Jira issues. inwardIssueKey displays the outward phrase; outwardIssueKey displays the inward phrase.',
  jira_unlinkIssues: 'Delete one Jira issue link by link id.',
  jira_downloadAttachment:
    'Download Jira attachments inline and optionally save them under the Orca temporary directory.'
}

export function createJiraToolServer(
  ctx: JiraPluginContext,
  service: JiraServicePort
): RuntimeToolServer {
  const descriptorTools = JIRA_TOOL_NAMES.map((name) => ({
    name,
    description: `${DESCRIPTIONS[name]} (${ctx.label})`,
    annotations: READ_ONLY.has(name)
      ? { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
      : { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
  }))

  const implementations = JIRA_TOOL_NAMES.map((name): RuntimeToolImplementation => ({
    name,
    inputSchema: schemas[name].shape,
    handler: async (raw, context) => {
      try {
        const parsed = schemas[name].parse(raw)
        const value = await service.invoke(name, parsed, context?.getSignal())
        if (!isJiraPreparedInvocation(value)) return prepareJiraSuccessResult(name, value)
        try {
          const result = prepareJiraSuccessResult(name, value.data)
          await value.commit()
          return result
        } catch (error) {
          await value.abort()
          throw error
        }
      } catch (error) {
        const safe =
          error instanceof z.ZodError ? new JiraToolError('invalid_input', 'invalid_input') : error
        return toJiraErrorResult(name, safe)
      }
    }
  }))

  return {
    descriptor: {
      id: authToolServerId(ctx.authId),
      connectorId: ctx.authId,
      tools: descriptorTools
    },
    implementations
  }
}

export function jiraTools(ctx: JiraPluginContext, opts: JiraToolOptions = {}): RuntimeToolServer {
  return createJiraToolServer(ctx, createJiraService(ctx, opts))
}
