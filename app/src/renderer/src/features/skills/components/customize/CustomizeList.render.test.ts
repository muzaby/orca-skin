import { createElement, type ComponentProps } from 'react'
import { load } from 'cheerio'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { McpServer, ProviderInfo, SkillInfo } from '../../../../../../shared/ipc'
import type { CatalogTab } from '../../lib/catalogSelection'
import { CustomizeList } from './CustomizeList'

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
  authScheme: 'login-required',
  origin: 'https://example.com',
  auth: [{ kind: 'api-key', label: 'API 키', fields: [] }],
  activeAuthKind: 'api-key',
  status: 'valid',
  principal: null,
  expiresAt: null,
  tools: []
})
const render = (patch: Partial<ComponentProps<typeof CustomizeList>>): string =>
  renderToStaticMarkup(
    createElement(CustomizeList, {
      tab: 'skills',
      skills: [skill('orca', 'Orcinus orca 스킬'), skill('adapter:claude', 'Claude 스킬')],
      mcpServers: [server('inactive', false), server('active', true)],
      providers: [provider('service', 'service'), provider('gate', 'gate')],
      onSelect: vi.fn(),
      ...patch
    })
  )
const rows = (markup: string): string[] =>
  [...markup.matchAll(/data-extensions-row="([^"]+)"/g)].map((match) => match[1])

describe('plugin catalog list', () => {
  it('uses capability for font and fixed switches independently of enabled state', () => {
    const entries = [true, false].flatMap((canToggle) =>
      [true, false].map((enabled): SkillInfo => ({
        ...skill('plugin:claude', 'Claude 플러그인'),
        name: `superpowers:${canToggle}:${enabled}`,
        sourceKind: 'adapter',
        enabled,
        canToggle,
        canRemove: false
      }))
    )
    const $ = load(render({ skills: entries }))
    for (const entry of entries) {
      const row = $(`[data-extensions-row="${entry.sourceId}/${entry.name}"]`)
      expect(row.find(`[title="${entry.name}"]`).hasClass('text-ink3')).toBe(!entry.canToggle)
      expect(row.find('button').attr('disabled')).toBeUndefined()
      expect(row.find('button')).toHaveLength(2)
      expect(row.find('[role=switch]').attr('aria-checked')).toBe(String(entry.enabled))
      expect(row.find('[role=switch]').is('[disabled]')).toBe(!entry.canToggle)
    }
  })

  it('labels native plugin skills and both native MCP groups with brand marks', () => {
    const markup = render({
      skills: [
        skill('plugin:claude', 'OLD'),
        skill('plugin:opencode', 'OLD'),
        skill('agents', 'OLD')
      ]
    })
    expect(markup).toContain('Claude 플러그인')
    expect(markup).toContain('OpenCode 플러그인')
    expect(markup).toContain('~/.agents/skills')
    expect(markup).toContain('viewBox="0 0 248 248"')
    expect(markup).toContain('viewBox="0 0 16 20"')
    const mcp = render({
      tab: 'mcp',
      nativeMcp: (['claude', 'opencode'] as const).map((backend) => ({
        backend,
        resource: {
          id: 'docs',
          name: `${backend} docs`,
          kind: 'mcp',
          status: 'configured',
          enabled: true,
          canToggle: false
        }
      }))
    })
    expect(rows(mcp)).toEqual(['claude:docs', 'opencode:docs', 'active', 'inactive'])
    expect(mcp).toContain('Claude MCP')
    expect(mcp).toContain('OpenCode MCP')
    expect(mcp).toContain('Orcinus orca MCP')
    const headings = load(mcp)('li').filter((_, el) => !load(mcp)(el).attr('data-extensions-row'))
    expect(headings.eq(0).attr('class')).toContain('pt-5')
    expect(headings.eq(1).attr('class')).toContain('pt-8')
    expect(headings.eq(2).attr('class')).toContain('pt-8')
    expect(mcp).toContain('text-spinner')
    expect(mcp).toContain('text-oc-ink')
  })
  it.each<[CatalogTab, string[]]>([
    ['skills', ['adapter:claude/review', 'orca/review']],
    ['mcp', ['active', 'inactive']],
    ['providers', ['gate', 'service']]
  ])('%s uses flat catalog buttons with selection and preserves its previous order', (tab, ids) => {
    const markup = render({ tab, selectedId: ids[1] })
    expect(rows(markup)).toEqual(ids)
    expect(markup.match(/<ul\b/g)).toHaveLength(1)
    expect(markup.match(/<li\b/g)).toHaveLength(tab === 'skills' ? 4 : tab === 'mcp' ? 3 : 2)
    expect(markup.match(/<button\b/g)).toHaveLength(tab === 'providers' ? 2 : 4)
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(markup).not.toMatch(/<(?:table|thead|th|h[1-6])(?:\s|>)/)
    expect(markup).not.toContain('aria-expanded')
  })

  it('groups skills and MCP by canonical source while retaining management metadata', () => {
    const skills = render({ tab: 'skills' })
    expect(skills).toContain('Claude 스킬')
    expect(skills).toContain('Orcinus orca 스킬')
    const $ = load(skills)
    expect($('li').not('[data-extensions-row]').last().hasClass('pt-8')).toBe(true)
    $('[data-extensions-row]').each((_, row) => {
      expect($(row).text()).toContain('review')
      expect($(row).text()).not.toContain('스킬')
      expect($(row).text()).not.toContain('Review changes')
    })
    expect(skills).not.toContain('aria-pressed="true"')
    const mcp = render({ tab: 'mcp' })
    expect(mcp).toContain('>http<')
    expect(mcp).toContain('>활성<')
    expect(mcp).toContain('>비활성<')
    const providers = render({ tab: 'providers' })
    expect(providers).toContain('앱 로그인 · API 키')
    expect(providers).toContain('>연결됨<')
  })

  it('plugin catalog title을 locale에 맞게 목록에 표시한다', () => {
    const jira = {
      ...provider('jira-auth', 'service'),
      catalog: {
        icon: 'electrical_services' as const,
        title: { ko: '지라 데이터 센터', en: 'Jira Data Center' },
        body: { ko: '이슈 도구', en: 'Issue tools' }
      }
    }
    const markup = render({ tab: 'providers', providers: [jira] })

    expect(markup).toContain('지라 데이터 센터')
    expect(markup).not.toContain('>jira-auth<')
    expect(markup).toContain('M720-360v-80h80')
  })

  it('로그인 프리 행은 detail에 기본 제공만, trailing에 연결됨을 표시한다 (0249 AC1)', () => {
    const markup = render({
      tab: 'providers',
      providers: [
        {
          ...provider('builtin-tools', 'service'),
          authScheme: 'login-free',
          auth: [],
          activeAuthKind: null
        }
      ]
    })
    expect(markup).toContain('title="기본 제공">기본 제공</span>')
    expect(markup).toContain('>연결됨</span>')
    expect(markup).not.toContain('인증 불필요')
    expect(markup).not.toContain('기본 제공 ·')
    expect(markup).not.toContain('알 수 없음')
    expect(markup).not.toContain('API 키')
    expect(markup.match(/<button\b/g)).toHaveLength(1)
  })

  it.each<CatalogTab>(['skills', 'mcp', 'providers'])(
    '%s exposes an empty state without a table',
    (tab) => {
      const markup = render({ tab, skills: [], mcpServers: [], providers: [] })
      expect(markup).toContain('role="status"')
      expect(rows(markup)).toEqual([])
      expect(markup).not.toContain('<table')
    }
  )
})
