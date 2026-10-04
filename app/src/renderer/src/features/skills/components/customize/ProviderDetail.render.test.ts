import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ProviderInfo } from '../../../../../../shared/ipc'
import { ProviderDetail } from './ProviderDetail'

const provider: ProviderInfo = {
  id: 'jira-dc',
  label: 'Jira Auth',
  kind: 'service',
  authScheme: 'login-required',
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
  it.each(['', 'https://public.example.com'])(
    '로그인 프리 상세는 도구와 상태를 표시하고 origin=%s 주소 유무를 따른다 (0248 AC12)',
    (origin) => {
      const markup = renderToStaticMarkup(
        createElement(ProviderDetail, {
          provider: {
            ...provider,
            authScheme: 'login-free',
            origin,
            auth: [],
            status: 'valid',
            activeAuthKind: null
          },
          step: null,
          onLogin: vi.fn(),
          onSubmit: vi.fn(),
          onReauth: vi.fn(),
          onRevoke: vi.fn()
        })
      )
      expect(markup).toContain('>기본 제공</span>')
      expect(markup).toContain('>연결됨</span>')
      expect(markup).not.toContain('인증 불필요')
      expect(markup.indexOf('>기본 제공</span>')).toBeLessThan(markup.indexOf('>연결됨</span>'))
      expect(markup).toContain('bg-good ring-good/20')
      expect(markup).toContain('mcp__jira-dc-tools__jira_searchIssues')
      expect(markup).not.toMatch(/<button\b|provider-authenticate|provider-reauth-menu/)
      expect(markup).not.toContain('연결 해제')
      expect(markup).not.toContain('연결되면 모델에게 노출됩니다.')
      expect(markup).not.toContain('PAT')
      expect(markup.includes('>주소</dt>')).toBe(origin !== '')
      if (origin !== '') expect(markup).toContain(origin)
    }
  )

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
    expect(markup).toContain('data-action="provider-authenticate"')
    expect(markup).toContain('>인증<')
    expect(markup).toContain('whitespace-pre-wrap')
    expect(markup).toContain('break-all')
  })

  it('인증 이력이 있으면 본문 상단에 재인증 dropdown trigger를 둔다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProviderDetail, {
        provider: { ...provider, status: 'valid', activeAuthKind: 'pat' },
        step: null,
        onLogin: vi.fn(),
        onSubmit: vi.fn(),
        onReauth: vi.fn(),
        onRevoke: vi.fn()
      })
    )
    expect(markup).toContain('data-action="provider-reauth-menu"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('>재인증<')
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
