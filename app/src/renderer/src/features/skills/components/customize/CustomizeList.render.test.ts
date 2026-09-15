import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { McpServer, ProviderInfo, SkillInfo } from '../../../../../../shared/ipc'
import type { CatalogTab } from '../../lib/catalogSelection'
import { CustomizeList } from './CustomizeList'
import { ProviderDetail } from './ProviderDetail'

const skill = (sourceId: string, sourceLabel: string): SkillInfo => ({
  name: 'review',
  description: 'Review changes',
  sourceId,
  sourceLabel,
  sourceKind: 'orca',
  enabled: true,
  canToggle: true,
  canRemove: true,
  skillPath: `/skills/${sourceId}/review/SKILL.md`,
  skillDir: `/skills/${sourceId}/review`,
  updatedAt: 1
})
const server = (id: string, enabled: boolean): McpServer => ({
  id,
  name: id,
  description: '',
  enabled,
  transport: 'http',
  command: null,
  args: [],
  authEnvKey: null,
  url: 'https://example.com/mcp',
  hasAuth: false
})
const provider = (id: string, kind: ProviderInfo['kind']): ProviderInfo => ({
  id,
  label: id,
  kind,
  origin: 'https://example.com',
  auth: [{ kind: 'api-key', label: 'API 키', fields: [] }],
  activeAuthKind: 'api-key',
  status: 'valid',
  principal: null,
  expiresAt: null,
  tools: [],
  ...(id === 'service'
    ? {
        plugin: {
          icon: 'bolt' as const,
          copy: { ko: { title: '지라 플러그인', body: '이슈를 조회하고 변경합니다.' } }
        }
      }
    : {})
})
const render = (patch: Partial<ComponentProps<typeof CustomizeList>>): string =>
  renderToStaticMarkup(
    createElement(CustomizeList, {
      tab: 'skills',
      skills: [skill('z', 'Zulu'), skill('a', 'Alpha')],
      mcpServers: [server('inactive', false), server('active', true)],
      providers: [provider('service', 'service'), provider('gate', 'gate')],
      onSelect: vi.fn(),
      ...patch
    })
  )
const rows = (markup: string): string[] =>
  [...markup.matchAll(/data-extensions-row="([^"]+)"/g)].map((match) => match[1])

describe('plugin catalog list', () => {
  it.each<[CatalogTab, string[]]>([
    ['skills', ['a/review', 'z/review']],
    ['mcp', ['active', 'inactive']],
    ['plugins', ['gate', 'service']]
  ])('%s uses flat catalog buttons with selection and preserves its previous order', (tab, ids) => {
    const markup = render({ tab, selectedId: ids[1] })
    expect(rows(markup)).toEqual(ids)
    expect(markup.match(/<ul\b/g)).toHaveLength(1)
    expect(markup.match(/<li\b/g)).toHaveLength(2)
    expect(markup.match(/<button\b/g)).toHaveLength(2)
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(markup).not.toMatch(/<(?:table|thead|th|h[1-6])(?:\s|>)/)
    expect(markup).not.toContain('aria-expanded')
  })

  it('keeps source, author, transport and connection state available without headings', () => {
    const skills = render({ tab: 'skills' })
    expect(skills).toContain('사용자 · Alpha')
    expect(skills).toContain('사용자 · Zulu')
    expect(skills).not.toContain('aria-pressed="true"')
    const mcp = render({ tab: 'mcp' })
    expect(mcp).toContain('>http<')
    expect(mcp).toContain('>활성<')
    expect(mcp).toContain('>비활성<')
    const plugins = render({ tab: 'plugins' })
    expect(plugins).toContain('앱 로그인 · API 키')
    expect(plugins).toContain('지라 플러그인')
    expect(plugins).toContain('이슈를 조회하고 변경합니다.')
    expect(plugins).toContain('data-icon="bolt"')
    expect(plugins).toContain('>연결됨<')
  })

  it.each<CatalogTab>(['plugins', 'skills', 'mcp'])(
    '%s exposes an empty state without a table',
    (tab) => {
      const markup = render({ tab, skills: [], mcpServers: [], providers: [] })
      expect(markup).toContain('role="status"')
      expect(rows(markup)).toEqual([])
      expect(markup).not.toContain('<table')
    }
  )

  it('상세도 목록과 같은 localized title/body/icon을 사용한다', () => {
    const markup = renderToStaticMarkup(
      createElement(ProviderDetail, {
        provider: provider('service', 'service'),
        step: null,
        onLogin: vi.fn(),
        onSubmit: vi.fn(),
        onReauth: vi.fn(),
        onRevoke: vi.fn()
      })
    )
    expect(markup).toContain('지라 플러그인')
    expect(markup).toContain('이슈를 조회하고 변경합니다.')
    expect(markup).toContain('data-icon="bolt"')
  })
})
