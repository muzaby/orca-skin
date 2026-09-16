import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ProviderInfo } from '../../../../../../shared/ipc'
import { ProviderDetail } from './ProviderDetail'

const provider: ProviderInfo = {
  id: 'jira-dc',
  label: 'Jira Auth',
  kind: 'service',
  origin: 'https://jira.example.com',
  auth: [{ kind: 'pat', label: 'PAT', fields: [] }],
  status: 'none',
  activeAuthKind: null,
  principal: null,
  expiresAt: null,
  tools: ['mcp__jira-dc-tools__jira_searchIssues'],
  catalog: {
    icon: 'electrical_services',
    title: { ko: '지라 데이터 센터', en: 'Jira Data Center' },
    body: { ko: '이슈와 첨부를 다룹니다.', en: 'Works with issues and attachments.' },
    attribution: {
      source: '@atlassian-dc-mcp/jira',
      version: '0.34.0',
      githubUrl: 'https://github.com/b1ff/atlassian-dc-mcp/tree/pinned/packages/jira',
      license: 'MIT'
    }
  }
}

describe('ProviderDetail plugin presentation', () => {
  it('localized title/body와 source/version/GitHub/license를 auth detail과 함께 표시한다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProviderDetail, {
        provider,
        step: null,
        onLogin: vi.fn(),
        onSubmit: vi.fn(),
        onReauth: vi.fn(),
        onRevoke: vi.fn()
      })
    )
    expect(markup).toContain('지라 데이터 센터')
    expect(markup).toContain('이슈와 첨부를 다룹니다.')
    expect(markup).toContain('@atlassian-dc-mcp/jira')
    expect(markup).toContain('0.34.0')
    expect(markup).toContain('https://github.com/b1ff/atlassian-dc-mcp/tree/pinned/packages/jira')
    expect(markup).toContain('MIT')
    expect(markup).toContain('jira-dc')
    expect(markup).toContain('https://jira.example.com')
    expect(markup).toContain('mcp__jira-dc-tools__jira_searchIssues')
  })

  it('plugin catalog가 없으면 기존 Auth label과 power icon 동작을 유지한다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProviderDetail, {
        provider: { ...provider, catalog: undefined, label: 'Legacy Auth' },
        step: null,
        onLogin: vi.fn(),
        onSubmit: vi.fn(),
        onReauth: vi.fn(),
        onRevoke: vi.fn()
      })
    )
    expect(markup).toContain('Legacy Auth')
    expect(markup).not.toContain('@atlassian-dc-mcp/jira')
  })
})
