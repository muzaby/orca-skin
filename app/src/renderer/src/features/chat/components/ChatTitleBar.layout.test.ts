import { Children, createElement, isValidElement, type ButtonHTMLAttributes } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  openPath: vi.fn(async () => {}),
  state: {
    title: '대화 제목',
    cwd: 'C:/workspace/example',
    worktree: null,
    sessionId: 's1',
    agentKind: 'code',
    messages: [],
    rightPanelTiles: [],
    rightPanelTileLabels: {}
  }
}))
vi.mock('react', async (load) => ({
  ...(await load<typeof import('react')>()),
  useState: (initial: unknown) => [initial, vi.fn()]
}))
vi.mock('../../../shared/api/ipc', () => ({ fileApi: { openPath: h.openPath } }))
vi.mock('../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../store/chatStore', () => ({
  chatActions: {},
  getActiveChatSession: () => h.state,
  useChatSession: (select: (s: typeof h.state) => unknown) => select(h.state),
  useUnseenSettledTaskCount: () => 0
}))
import { ChatTitleBar } from './ChatTitleBar'
import { CwdButton } from './CwdButton'

beforeEach(() => vi.clearAllMocks())

describe('Transcript 제목의 폴더 아이콘과 제목', () => {
  it('실제 폴더 버튼이 제목 앞에 있고 프로젝트 및 폴더 표시 텍스트는 없다', () => {
    const markup = renderToStaticMarkup(createElement(ChatTitleBar, { onRenameSession: vi.fn() }))
    const folder = markup.indexOf('aria-label="chat.composer.cwdOpenAria"')
    const title = markup.indexOf('>대화 제목</button>')
    expect(folder).toBeGreaterThan(-1)
    expect(title).toBeGreaterThan(folder)
    expect(markup).not.toContain('>example</span>')
    expect(markup).toContain('title="C:/workspace/example"')
    expect(markup).toContain('chat.titleBar.copyAll')
    expect(markup).toContain('chat.titleBar.tilesButton')
  })

  it('아이콘 전용 버튼도 실제 실행 cwd를 열고 Composer 기본 라벨은 유지한다', async () => {
    const button = CwdButton({ cwd: h.state.cwd, sessionStarted: true, iconOnly: true })
    const props = button.props as ButtonHTMLAttributes<HTMLButtonElement>
    const children = Children.toArray(props.children)
    expect(children).toHaveLength(1)
    expect(isValidElement<{ name?: string }>(children[0]) && children[0].props.name).toBe('folder')
    props.onClick?.({} as React.MouseEvent<HTMLButtonElement>)
    await Promise.resolve()
    expect(h.openPath).toHaveBeenCalledWith({ path: h.state.cwd, mode: 'directory' })
    expect(props['aria-label']).toBe('chat.composer.cwdOpenAria')
    const composer = renderToStaticMarkup(
      createElement(CwdButton, { cwd: h.state.cwd, sessionStarted: false, variant: 'outlined' })
    )
    expect(composer).toContain('>example</span>')
  })
})
