import type { RuntimeToolDeclaration, RuntimeToolDescriptor } from '../../../adapters/runtime-tools'

const readOnly = (name: string, description: string): RuntimeToolDeclaration => ({
  name,
  description,
  annotations: { readOnlyHint: true }
})

const mutating = (name: string, description: string): RuntimeToolDeclaration => ({
  name,
  description,
  annotations: { readOnlyHint: false }
})

// @atlassian-dc-mcp/jira@0.34.0 build/index.js의 기본 등록 순서와 이름을 고정한다.
// attachment upload는 filesystem gateway가 꺼져 있으므로 descriptor에도 넣지 않는다.
export const JIRA_TOOLS = [
  readOnly('jira_searchIssues', 'Search Jira issues with JQL.'),
  readOnly('jira_getIssue', 'Get a Jira issue by key.'),
  readOnly('jira_getIssueComments', 'Get comments for a Jira issue.'),
  mutating('jira_createIssue', 'Create a Jira issue.'),
  mutating('jira_updateIssue', 'Update a Jira issue.'),
  mutating('jira_postIssueComment', 'Post a comment to a Jira issue.'),
  mutating('jira_updateIssueComment', 'Update an existing Jira issue comment.'),
  readOnly('jira_getTransitions', 'Get available transitions for a Jira issue.'),
  readOnly('jira_getIssueDevelopmentInfo', 'Get linked development information.'),
  mutating('jira_transitionIssue', 'Transition a Jira issue.'),
  readOnly('jira_getIssueLinkTypes', 'Get available Jira issue link types.'),
  mutating('jira_linkIssues', 'Create a link between Jira issues.'),
  mutating('jira_unlinkIssues', 'Delete a link between Jira issues.'),
  readOnly('jira_downloadAttachment', 'Read Jira attachment content without saving to disk.')
] as const satisfies readonly RuntimeToolDeclaration[]

export const JIRA_TOOL_NAMES = JIRA_TOOLS.map((tool) => tool.name)

export const JIRA_MUTATING_TOOL_NAMES = JIRA_TOOLS.filter(
  (tool) => tool.annotations?.readOnlyHint !== true
).map((tool) => tool.name)

export const JIRA_TOOL_DESCRIPTOR: RuntimeToolDescriptor = {
  id: 'jira-tools',
  connectorId: 'jira',
  tools: JIRA_TOOLS
}
