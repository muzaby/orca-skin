import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../../../shared/i18n'
import type { MenuItemProps } from '../../../../shared/ui/MenuItem'

const h = vi.hoisted(() => ({ items: [] as MenuItemProps[] }))
// 서비스 호출은 실제 메뉴의 onClick을 실행한다. 공유 atom만 관측 가능한 경계로 둔다.
vi.mock('../../../../shared/ui/MenuItem', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../shared/ui/MenuItem')>()
  return {
    ...original,
    MenuItem: (props: MenuItemProps) => {
      h.items.push(props)
      return createElement(original.MenuItem, props)
    }
  }
})
import { GitIdentityMenu } from './GitIdentityMenu'
import { githubBranchUrl, moveGitMenuFocus } from './gitIdentityMenuActions'

const url = 'https://github.com/muzaby/orca-skin'
const branch = 'feature/한글#100%/next'
type Props = ComponentProps<typeof GitIdentityMenu>
const render = (over: Partial<Props> = {}): { $: ReturnType<typeof load>; props: Props } => {
  h.items = []
  const props: Props = {
    kind: 'branch',
    branch,
    detached: false,
    githubUrl: url,
    copyFailed: false,
    onClose: vi.fn(),
    onCopyResult: vi.fn(),
    ...over
  }
  return { $: load(renderToStaticMarkup(createElement(GitIdentityMenu, props))), props }
}
const invoke = async (index: number): Promise<void> => {
  await (h.items[index].onClick as () => void | Promise<void>)()
}

beforeEach(() => {
  vi.stubGlobal('window', { open: vi.fn() })
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('ko')
})

describe('Git 이름 메뉴 서비스와 비가용 상태 (VP-92)', () => {
  it.each([
    ['loading', '원격 저장소 확인 중…'],
    ['error', '원격 주소 조회에 실패했습니다. 메뉴를 다시 열어 주세요.']
  ] as const)(
    '원격 %s 상태는 부재와 구분하고 브랜치 복사는 유지한다',
    async (remotePhase, reason) => {
      const { $ } = render({ remotePhase })
      expect($('[role="menuitem"][disabled]').text()).toContain(reason)
      expect($('[role="menuitem"]').first().attr('disabled')).toBeUndefined()
      await invoke(1)
      expect(window.open).not.toHaveBeenCalled()
      await invoke(0)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(branch)
    }
  )
  it('저장소 메뉴는 한 항목으로 실제 GitHub 저장소를 연 뒤 닫는다', async () => {
    const { $, props } = render({ kind: 'repo' })
    expect(
      $('[role="menuitem"]')
        .map((_, item) => $(item).text())
        .get()
    ).toEqual(['GitHub에서 리포지토리 열기'])
    expect($('svg')).toHaveLength(0)
    await invoke(0)
    expect(window.open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer')
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('브랜치 메뉴는 복사·열기 순서이고 전체 이름을 복사한다', async () => {
    const { $, props } = render()
    expect(
      $('[role="menuitem"]')
        .map((_, item) => $(item).text())
        .get()
    ).toEqual(['브랜치 이름 복사', 'GitHub에서 브랜치 열기'])
    expect($('svg')).toHaveLength(0)
    await invoke(0)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(branch)
    expect(props.onCopyResult).toHaveBeenCalledWith(true)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('브랜치 열기는 slash를 보존하고 특수문자를 인코딩한 목적지로 간다', async () => {
    const { props } = render()
    await invoke(1)
    expect(window.open).toHaveBeenCalledWith(
      `${url}/tree/feature/%ED%95%9C%EA%B8%80%23100%25/next`,
      '_blank',
      'noopener,noreferrer'
    )
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it.each(['repo', 'branch'] as const)(
    'GitHub URL이 없으면 %s 열기만 이유와 함께 비활성이다',
    async (kind) => {
      const { $ } = render({ kind, githubUrl: null })
      const disabled = $('[role="menuitem"][disabled]')
      expect(disabled).toHaveLength(1)
      expect(disabled.text()).toContain('origin의 GitHub 주소를 확인할 수 없습니다')
      await invoke(kind === 'repo' ? 0 : 1)
      expect(window.open).not.toHaveBeenCalled()
      if (kind === 'branch') expect($('[role="menuitem"]').first().attr('disabled')).toBeUndefined()
    }
  )

  it.each([
    { branch: null, detached: true },
    { branch: null, detached: false },
    { branch: 'stale-branch', detached: true }
  ])('브랜치를 사용할 수 없으면 복사와 열기 모두 막고 이유를 보여 준다 (%j)', async (state) => {
    const { $, props } = render(state)
    expect($('[role="menuitem"][disabled]')).toHaveLength(2)
    expect($('[role="menuitem"]').text()).toContain('현재 브랜치가 없습니다')
    await invoke(0)
    await invoke(1)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(props.onCopyResult).not.toHaveBeenCalled()
  })

  it('클립보드 실패는 성공으로 닫지 않고 화면에 표시할 실패 결과를 전달한다', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('blocked'))
    const { props } = render()
    await invoke(0)
    expect(props.onCopyResult).toHaveBeenCalledWith(false)
    expect(props.onClose).not.toHaveBeenCalled()
    const { $ } = render({ copyFailed: true })
    expect($('[role="alert"]').text()).toBe(
      '브랜치 이름을 복사하지 못했습니다. 다시 시도해 주세요.'
    )
  })

  it('영어에서도 메뉴와 실패·비가용 이유를 번역한다', async () => {
    await i18n.changeLanguage('en')
    const { $ } = render({ githubUrl: null, copyFailed: true })
    expect($.text()).toContain('Copy branch name')
    expect($.text()).toContain('Open branch on GitHub')
    expect($.text()).toContain('Could not resolve a GitHub URL for origin')
    expect($('[role="alert"]').text()).toContain('Could not copy the branch name')
  })
})

describe('브랜치 URL과 메뉴 키보드 탐색', () => {
  it('경로를 쿼리나 fragment로 바꾸지 않는다', () => {
    expect(githubBranchUrl(url, branch)).toBe(
      `${url}/tree/feature/%ED%95%9C%EA%B8%80%23100%25/next`
    )
    expect(githubBranchUrl(url, 'main')).toBe(`${url}/tree/main`)
    expect(githubBranchUrl(null, branch)).toBeNull()
    expect(githubBranchUrl(url, null)).toBeNull()
  })

  it('위아래는 순환하고 Home/End는 첫/마지막 사용 가능 항목을 선택한다', () => {
    const first = { focus: vi.fn() }
    const last = { focus: vi.fn() }
    const ownerDocument = { activeElement: first }
    const menu = {
      querySelectorAll: vi.fn().mockReturnValue([first, last]),
      ownerDocument
    } as unknown as HTMLElement
    expect(moveGitMenuFocus(menu, 'ArrowDown')).toBe(true)
    expect(last.focus).toHaveBeenCalledOnce()
    expect(moveGitMenuFocus(menu, 'ArrowUp')).toBe(true)
    expect(last.focus).toHaveBeenCalledTimes(2)
    ownerDocument.activeElement = last
    moveGitMenuFocus(menu, 'ArrowDown')
    expect(first.focus).toHaveBeenCalledOnce()
    moveGitMenuFocus(menu, 'End')
    moveGitMenuFocus(menu, 'Home')
    expect(last.focus).toHaveBeenCalledTimes(3)
    expect(first.focus).toHaveBeenCalledTimes(2)
    expect(moveGitMenuFocus(menu, 'Enter')).toBe(false)
    expect(menu.querySelectorAll).toHaveBeenCalledWith('[role="menuitem"]:not(:disabled)')
  })
})
