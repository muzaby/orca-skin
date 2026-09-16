import type { PluginCatalogPresentationInput } from '../../../../shared/plugin-catalog'

export const JIRA_SOURCE = {
  packageName: '@atlassian-dc-mcp/jira',
  version: '0.34.0',
  license: 'MIT',
  gitHead: 'ab2b534bafefa4666feca463e79824dadb797ff3',
  githubUrl:
    'https://github.com/b1ff/atlassian-dc-mcp/tree/ab2b534bafefa4666feca463e79824dadb797ff3/packages/jira'
} as const

export const JIRA_CATALOG_PRESENTATION_INPUT = {
  title: { ko: 'Jira Data Center', en: 'Jira Data Center' },
  body: {
    ko: '이슈·댓글·전환·링크·첨부를 다루는 community-maintained 도구입니다. Atlassian 공식 제품이 아닌 비공식 통합입니다.',
    en: 'Community-maintained tools for issues, comments, transitions, links, and attachments. Not affiliated with Atlassian.'
  },
  attribution: {
    source: JIRA_SOURCE.packageName,
    version: JIRA_SOURCE.version,
    githubUrl: JIRA_SOURCE.githubUrl,
    license: JIRA_SOURCE.license
  }
} as const satisfies PluginCatalogPresentationInput
