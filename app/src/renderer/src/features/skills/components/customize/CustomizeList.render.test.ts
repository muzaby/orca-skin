import { createElement, type ComponentProps } from 'react'
import { load } from 'cheerio'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { McpServer, ProviderInfo, SkillInfo } from '../../../../../../shared/ipc'
import type { CatalogTab } from '../../lib/catalogSelection'
import { CustomizeList } from './CustomizeList'
import { Icon } from '../../../../shared/ui/Icon'

const skill = (sourceId: string, sourceLabel: string): SkillInfo => ({
  name: 'review',
  description: 'Review changes',
  sourceId,
  sourceLabel,
  sourceKind: 'orca',
  enabled: true,
  canToggle: sourceId === 'orca',
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
  it('renders switches only for Orca skills', () => {
    const entries = ['orca', 'agents', 'adapter:claude', 'adapter:opencode'].map((source) =>
      skill(source, source)
    )
    const $ = load(render({ skills: entries }))
    expect($('[role=switch]')).toHaveLength(1)
    for (const entry of entries) {
      const row = $(`[data-extensions-row="${entry.sourceId}/${entry.name}"]`)
      expect(row).toHaveLength(1)
      expect(row.find('[title]').hasClass('text-ink3')).toBe(false)
      expect(row.find('[role=switch]')).toHaveLength(entry.sourceId === 'orca' ? 1 : 0)
    }
  })

  it('hides native plugin skills and labels both native MCP groups with brand marks', () => {
    const markup = render({
      skills: [
        skill('plugin:claude', 'OLD'),
        skill('plugin:opencode', 'OLD'),
        skill('agents', 'OLD')
      ]
    })
    expect(markup).not.toContain('Claude 플러그인')
    expect(markup).not.toContain('OpenCode 플러그인')
    expect(markup).toContain('~/.agents/skills')
    expect(rows(markup)).toEqual(['agents/review'])

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
    expect(rows(mcp)).toEqual(['active', 'inactive', 'claude:docs', 'opencode:docs'])
    expect(mcp).toContain('Claude')
    expect(mcp).toContain('OpenCode')
    expect(mcp).toContain('Orcinus orca')
    const headings = load(mcp)('li').filter((_, el) => !load(mcp)(el).attr('data-extensions-row'))
    expect(headings.eq(0).attr('class')).toContain('pt-5')
    expect(headings.eq(1).attr('class')).toContain('pt-8')
    expect(headings.eq(2).attr('class')).toContain('pt-8')
    expect(mcp).toContain('text-spinner')
    expect(mcp).toContain('text-oc-ink')
  })
  it.each<[CatalogTab, string[]]>([
    ['skills', ['orca/review', 'adapter:claude/review']],
    ['mcp', ['active', 'inactive']],
    ['providers', ['gate', 'service']]
  ])('%s uses flat catalog buttons with selection and preserves its previous order', (tab, ids) => {
    const markup = render({ tab, selectedId: ids[1] })
    expect(rows(markup)).toEqual(ids)
    expect(markup.match(/<ul\b/g)).toHaveLength(1)
    expect(markup.match(/<li\b/g)).toHaveLength(tab === 'skills' ? 4 : 3)
    expect(markup.match(/<button\b/g)).toHaveLength(
      tab === 'providers' ? 2 : tab === 'skills' ? 3 : 4
    )
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(markup).not.toMatch(/<(?:table|thead|th|h[1-6])(?:\s|>)/)
    expect(markup).not.toContain('aria-expanded')
  })

  it('groups skills and MCP by canonical source while retaining management metadata', () => {
    const skills = render({ tab: 'skills' })
    expect(skills).toContain('Claude')
    expect(skills).toContain('Orcinus orca')
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

  it.each([
    ['idle', '연결 안 됨'],
    ['checking', '확인 중…'],
    ['connected', '연결됨'],
    ['failed', '연결 실패']
  ] as const)('shows the host connection state of login-free rows — %s', (state, label) => {
    const markup = render({
      tab: 'providers',
      providers: [
        {
          ...provider('opencode-llm', 'service'),
          authScheme: 'login-free',
          auth: [],
          activeAuthKind: null,
          status: state === 'connected' ? 'valid' : 'none',
          connection: { state, message: state === 'failed' ? '실패' : null }
        }
      ]
    })
    expect(markup).toContain('title="기본 제공">기본 제공</span>')
    expect(markup).toContain(`>${label}</span>`)
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

const groupFixture = {
  skills: [
    skill('adapter:opencode', 'OpenCode 스킬'),
    skill('orca', 'Orcinus orca 스킬'),
    skill('agents', '~/.agents/skills'),
    skill('adapter:claude', 'Claude 스킬')
  ],
  providers: [provider('service', 'service'), provider('model', 'llm'), provider('gate', 'gate')],
  nativeMcp: (['opencode', 'claude'] as const).flatMap((backend) =>
    (['mcp', 'plugin'] as const).map((kind) => ({
      backend,
      resource: {
        id: kind,
        name: `${backend}-${kind}`,
        kind,
        status: 'configured' as const,
        enabled: true,
        canToggle: false
      }
    }))
  )
}
const expectedGroups: Record<CatalogTab, string[]> = {
  skills: ['Orcinus orca', '~/.agents/skills', 'Claude', 'OpenCode'],
  mcp: ['Orcinus orca', 'Claude', 'OpenCode'],
  providers: ['Orcinus orca', 'Claude', 'OpenCode']
}
it.each<CatalogTab>(['skills', 'mcp', 'providers'])(
  'puts the Orcinus orca group first in every tab (%s)',
  (tab) => {
    const markup = render({ ...groupFixture, tab })
    const expectedRows = {
      skills: ['orca/review', 'agents/review', 'adapter:claude/review', 'adapter:opencode/review'],
      mcp: ['active', 'inactive', 'claude:mcp', 'opencode:mcp'],
      providers: ['gate', 'model', 'service', 'claude:plugin', 'opencode:plugin']
    }
    expect(rows(markup)).toEqual(expectedRows[tab])
    const $ = load(markup)
    const headings = $('li').not('[data-extensions-row]')
    expect(headings.map((_, el) => $(el).text()).get()).toEqual(expectedGroups[tab])
    expect(headings.first().find('[aria-label="Orcinus orca"]')).toHaveLength(1)
  }
)

it.each<CatalogTab>(['skills', 'mcp', 'providers'])(
  'titles every group by brand name only (%s)',
  (tab) => {
    const $ = load(render({ ...groupFixture, tab }))
    const headings = $('li').not('[data-extensions-row]')
    expect(headings.map((_, el) => $(el).text()).get()).toEqual(expectedGroups[tab])
    expect(
      headings
        .map((_, el) =>
          ($(el).attr('class') ?? '')
            .split(/\s+/)
            .filter((token) => token.startsWith('pt-'))
            .join(' ')
        )
        .get()
    ).toEqual(expectedGroups[tab].map((_, index) => (index ? 'pt-8' : 'pt-5')))
  }
)

it.each<CatalogTab>(['mcp', 'providers'])(
  'omits an empty Orca group and gives the first native heading initial spacing (%s)',
  (tab) => {
    const $ = load(render({ ...groupFixture, tab, providers: [], mcpServers: [] }))
    const headings = $('li').not('[data-extensions-row]')
    expect(headings.map((_, el) => $(el).text()).get()).toEqual(['Claude', 'OpenCode'])
    expect(headings.first().hasClass('pt-5')).toBe(true)
    expect(headings.last().hasClass('pt-8')).toBe(true)
    expect($('[aria-label="Orcinus orca"]')).toHaveLength(0)
  }
)

it.each<CatalogTab>(['skills', 'mcp', 'providers'])(
  'sizes the Orca mark by height only (%s)',
  (tab) => {
    const $ = load(render({ ...groupFixture, tab }))
    const tokens = ($('[aria-label="Orcinus orca"]').attr('class') ?? '').split(/\s+/)
    expect(tokens).toEqual(expect.arrayContaining(['h-4', 'w-auto', 'shrink-0']))
    expect(tokens.filter((token) => /^(size-|w-(?!auto$))/.test(token))).toEqual([])
    for (const viewBox of ['0 0 248 248', '0 0 16 20']) {
      const logo = $('svg').filter((_, element) => $(element).attr('viewBox') === viewBox)
      expect(logo).toHaveLength(1)
      expect(logo.hasClass('size-4')).toBe(true)
    }
  }
)

it('uses the MCP icon for Orca MCP rows of both transports', () => {
  const $ = load(
    render({
      tab: 'mcp',
      mcpServers: [
        server('http', true),
        { ...server('stdio', true), transport: 'stdio', command: 'node', url: null }
      ]
    })
  )
  const expected = load(
    renderToStaticMarkup(
      createElement(Icon, { name: 'mcp', size: 20, className: 'shrink-0 text-ink3' })
    )
  )('svg').toString()
  for (const transport of ['http', 'stdio']) {
    const row = $(`[data-extensions-row="${transport}"]`)
    expect(row.find('svg').first().toString()).toBe(expected)
    expect(row.text()).toContain(transport)
  }
})

it('orders Claude then OpenCode plugin groups after providers and keeps plugin toggle capability', () => {
  const nativeMcp = (['opencode', 'claude'] as const).flatMap((backend) =>
    [true, false].map((canToggle) => ({
      backend,
      resource: {
        id: `plugin-${canToggle}`,
        name: `${backend}-${canToggle}`,
        kind: 'plugin' as const,
        status: 'installed' as const,
        enabled: canToggle,
        canToggle,
        canOpen: true
      }
    }))
  )
  const markup = render({
    tab: 'providers',
    providers: [provider('service', 'service'), provider('model', 'llm'), provider('gate', 'gate')],
    nativeMcp
  })
  expect(rows(markup)).toEqual([
    'gate',
    'model',
    'service',
    'claude:plugin-true',
    'claude:plugin-false',
    'opencode:plugin-true',
    'opencode:plugin-false'
  ])
  const $ = load(markup)
  for (const { backend, resource } of nativeMcp) {
    const row = $(`[data-extensions-row="${backend}:${resource.id}"]`)
    expect(row.find('[role=switch]').is('[disabled]')).toBe(!resource.canToggle)
    expect(row.find('[title]').hasClass('text-ink3')).toBe(!resource.canToggle)
    expect(row.find('[role=switch]').attr('aria-checked')).toBe(String(resource.enabled))
  }
  expect(markup).toContain('Claude')
  expect(markup).toContain('OpenCode')
})
