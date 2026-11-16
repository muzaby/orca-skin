// 세션 밖 프로젝트 칩 — 컴포저와 같은 메뉴(검색 · 행 · 프로젝트 추가)로 고른 id 를 돌려준다.

import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../shared/ui/renderHarness.testfixture'

vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  const { fakeHooks } = await import('../../../shared/ui/renderHarness.testfixture')
  return { ...actual, ...fakeHooks }
})
vi.mock(
  'react-dom',
  async () => (await import('../../../shared/ui/renderHarness.testfixture')).fakeReactDom
)
vi.mock('../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
import { ProjectMenuPanel } from './ProjectMenuPanel'
import { ProjectPickerChip } from './ProjectPickerChip'

const projects = [
  { id: 'p-alpha', name: 'Alpha', cwd: 'C:/Alpha' },
  { id: 'p-beta', name: 'Beta', cwd: 'D:/Beta' },
  { id: 'p-memo', name: 'Memo', cwd: null }
]

let dom: FakeDom
const nodes = (root: FakeNode): FakeNode[] => [root, ...root.children.flatMap(nodes)]
const find = (attribute: string, value?: unknown): FakeNode => {
  const found = nodes(dom.body).find(
    (node) => attribute in node.props && (value === undefined || node.props[attribute] === value)
  )
  expect(found, `${attribute}=${String(value)}`).toBeDefined()
  return found!
}
const rows = (): FakeNode[] => dom.queryAll('[role="menuitemradio"]')
const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
    dom.act(() => {})
  }
}

function render(
  props: Partial<Parameters<typeof ProjectPickerChip>[0]> = {}
): Parameters<typeof ProjectPickerChip>[0] {
  const full = {
    projects,
    value: null,
    onChange: vi.fn(),
    onAdd: vi.fn(async () => null),
    placeholder: 'pick',
    ...props
  }
  dom.render(createElement(ProjectPickerChip, full))
  return full
}
const open = (): void => dom.click(find('data-component', 'project-picker-chip'))

beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1000, innerHeight: 800 })
})
afterEach(() => vi.useRealTimers())

describe('ProjectPickerChip', () => {
  it('고른 프로젝트 이름을 보이고 고르기 전에는 자리표시 문구를 보인다', () => {
    render()
    expect(find('data-component', 'project-picker-chip').textContent).toContain('pick')
    render({ value: 'p-beta' })
    expect(find('data-component', 'project-picker-chip').textContent).toContain('Beta')
  })

  it('컴포저와 같은 메뉴에서 폴더 없는 프로젝트까지 보이고 고른 id 를 넘긴다', () => {
    const props = render({ value: 'p-alpha' })
    open()
    expect(dom.query('[data-component="landing-project-menu"]')).not.toBeNull()
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Alpha'),
      expect.stringContaining('Beta'),
      expect.stringContaining('schedules.modal.noFolderTag')
    ])
    expect(rows().map((row) => row.props['aria-checked'])).toEqual([true, false, false])
    dom.click(rows()[1]!)
    expect(props.onChange).toHaveBeenCalledExactlyOnceWith('p-beta')
    expect(dom.query('[data-component="landing-project-menu"]')).toBeNull()
  })

  it('검색어가 이름이나 경로에 들어간 프로젝트만 남긴다', () => {
    render()
    open()
    const input = find('aria-label', 'projects.search')
    dom.act(() => (input.props.onChange as (e: unknown) => void)({ target: { value: ' d:/be ' } }))
    expect(rows().map((row) => row.props.title)).toEqual(['D:/Beta'])
  })

  it('프로젝트 추가가 돌려준 id 를 고르고, 취소면 아무것도 바꾸지 않는다', async () => {
    const onAdd = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce(null)
    const props = render({ onAdd })
    open()
    dom.click(find('role', 'menuitem'))
    await settle()
    expect(props.onChange).not.toHaveBeenCalled()
    expect(dom.query('[data-component="landing-project-menu"]')).not.toBeNull()

    onAdd.mockResolvedValueOnce('p-new')
    dom.click(find('role', 'menuitem'))
    await settle()
    expect(props.onChange).toHaveBeenCalledExactlyOnceWith('p-new')
    expect(dom.query('[data-component="landing-project-menu"]')).toBeNull()
  })

  // 상태에 맞는 툴팁·빈 상태 문구를 고른다(0320 AC38 · EP-12 B).
  it('칩 툴팁은 고른 프로젝트 폴더, 고르기 전이나 폴더가 없으면 프로젝트 라벨이다', () => {
    render({ value: 'p-beta' })
    expect(find('data-component', 'project-picker-chip').props.title).toBe('D:/Beta')
    render({ value: null })
    expect(find('data-component', 'project-picker-chip').props.title).toBe(
      'schedules.modal.project'
    )
    render({ value: 'p-memo' })
    expect(find('data-component', 'project-picker-chip').props.title).toBe(
      'schedules.modal.project'
    )
  })

  it('행 툴팁은 폴더 경로이고 폴더 없는 행은 툴팁이 없다', () => {
    render()
    open()
    expect(rows().map((row) => row.props.title)).toEqual(['C:/Alpha', 'D:/Beta', undefined])
  })

  it('검색 결과가 없으면 noMatches, 프로젝트가 없으면 emptyFolders', () => {
    render()
    open()
    const input = find('aria-label', 'projects.search')
    dom.act(() => (input.props.onChange as (e: unknown) => void)({ target: { value: 'zzz' } }))
    expect(dom.query('[role="status"]')?.textContent).toBe('projects.noMatches')
    dom.unmount()
    render({ projects: [] })
    open()
    expect(dom.query('[role="status"]')?.textContent).toBe('projects.emptyFolders')
  })
})

describe('ProjectMenuPanel — 빈 상태', () => {
  it('불러오는 중이면 검색어와 무관하게 loading', () => {
    dom.render(
      createElement(ProjectMenuPanel, {
        items: [],
        query: 'zzz',
        onQueryChange: vi.fn(),
        isSelected: () => false,
        onSelect: vi.fn(),
        onAdd: vi.fn(),
        onClose: vi.fn(),
        loading: true
      })
    )
    expect(dom.query('[role="status"]')?.textContent).toBe('projects.loading')
  })
})
