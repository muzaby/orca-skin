import { describe, expect, it } from 'vitest'
import { JIRA_CATALOG_PRESENTATION_INPUT, JIRA_SOURCE } from './source'

describe('Jira package provenance', () => {
  it('0.34.0과 pinned source를 하나의 상수로 고정한다', () => {
    expect(JIRA_SOURCE).toEqual({
      packageName: '@atlassian-dc-mcp/jira',
      version: '0.34.0',
      license: 'MIT',
      gitHead: 'ab2b534bafefa4666feca463e79824dadb797ff3',
      githubUrl:
        'https://github.com/b1ff/atlassian-dc-mcp/tree/ab2b534bafefa4666feca463e79824dadb797ff3/packages/jira'
    })
  })

  it('catalog는 shared default icon을 실제로 쓰고 양 언어 설명과 출처를 싣는다', () => {
    expect('icon' in JIRA_CATALOG_PRESENTATION_INPUT).toBe(false)
    expect(JIRA_CATALOG_PRESENTATION_INPUT.title).toEqual({
      ko: 'Jira Data Center',
      en: 'Jira Data Center'
    })
    expect(JIRA_CATALOG_PRESENTATION_INPUT.body?.ko).toContain('비공식')
    expect(JIRA_CATALOG_PRESENTATION_INPUT.body?.en).toContain('Not affiliated')
    expect(JIRA_CATALOG_PRESENTATION_INPUT.attribution).toEqual({
      source: '@atlassian-dc-mcp/jira',
      version: '0.34.0',
      githubUrl: JIRA_SOURCE.githubUrl,
      license: 'MIT'
    })
  })
})
