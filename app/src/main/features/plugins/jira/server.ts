import type { RuntimeStdioToolServer } from '../../../adapters/runtime-tools'
import { authToolServerId } from '../../../adapters/runtime-tool-policy'
import { JIRA_TOOL_DESCRIPTOR } from './tools'

export interface JiraRuntimeServerInput {
  authId: string
  origin: string
  apiContextPath?: string
  token: string
  credentialRevision: number
  electronExecutable: string
  packageEntrypoint: string
}

export function jiraApiBasePath(origin: string, contextPath?: string): string {
  const parsed = new URL(origin)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Jira origin must use http or https')
  }
  if (
    parsed.pathname !== '/' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    throw new Error('Jira origin must not include a path, query, fragment, or credentials')
  }

  const rawContext = contextPath?.trim() ?? ''
  if (rawContext === '') return `${parsed.origin}/rest`
  if (!rawContext.startsWith('/') || /[?#\\]/.test(rawContext)) {
    throw new Error('Jira context path must be an absolute path without query or fragment')
  }
  const context = rawContext.replace(/\/+$/, '')
  if (/(?:^|\/)rest(?:\/|$)/i.test(context)) {
    throw new Error('Jira context path must not include the REST API suffix')
  }
  return `${parsed.origin}${context}/rest`
}

export function createJiraRuntimeServer(input: JiraRuntimeServerInput): RuntimeStdioToolServer {
  if (input.token.trim() === '') throw new Error('Jira API token must not be blank')
  if (input.packageEntrypoint.trim() === '') {
    throw new Error('Jira package entrypoint must not be blank')
  }

  return {
    transport: 'stdio',
    descriptor: {
      ...JIRA_TOOL_DESCRIPTOR,
      id: authToolServerId(input.authId),
      connectorId: input.authId
    },
    command: input.electronExecutable,
    args: [input.packageEntrypoint],
    env: {
      ELECTRON_RUN_AS_NODE: '1',
      JIRA_API_BASE_PATH: jiraApiBasePath(input.origin, input.apiContextPath),
      JIRA_API_TOKEN: input.token,
      JIRA_DEFAULT_PAGE_SIZE: '25',
      JIRA_ATTACHMENTS_UPLOAD_ENABLED: 'false',
      JIRA_ATTACHMENTS_DOWNLOAD_ENABLED: 'false',
      ATLASSIAN_DC_MCP_CONFIG_FILE: ''
    },
    credentialRevision: input.credentialRevision
  }
}
