import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitDiffSummary } from '../../../../../../shared/ipc'
import { chatReducer, initialChatState, type ChatState } from '../../reducer/chatReducer'

const h = vi.hoisted(() => ({ state: null as unknown as ChatState, query: vi.fn() }))
vi.mock('../../store/chatStore', () => ({
  useChatSession: (select: (state: ChatState) => unknown) => select(h.state),
  chatActions: { toggleRightPanelTile: vi.fn(), closeGitRow: vi.fn() }
}))
vi.mock('./useGitSnapshot', () => ({ useGitSnapshot: h.query }))
import { GitRow } from './GitRow'

const request = { key: 'repo-restored-session', generation: 1 }
const render = (): ReturnType<typeof load> =>
  load(renderToStaticMarkup(createElement(GitRow, { cwd: '/repo', sessionStarted: true })))
const summary = (added: number, removed: number): GitDiffSummary => ({
  isRepo: true,
  base: { kind: 'head', oid: 'a'.repeat(40) },
  files: [],
  totals: { added, removed },
  filesTruncated: false,
  commits: [],
  commitsTruncated: false,
  commitFilesUnavailable: false,
  uncommitted: { files: [], totals: { added: 0, removed: 0 }, filesTruncated: false }
})
beforeEach(() => {
  h.query.mockClear()
  h.state = {
    ...initialChatState,
    cwd: '/repo',
    sessionId: 'restored-session',
    gitStatus: {
      cwd: '/repo',
      status: { isRepo: true, root: '/repo', branch: 'main', detached: false }
    },
    rightPanelTiles: [{ id: 'diff-column', tiles: ['diff'] }]
  }
})
describe('복원된 세션의 composer diff 버튼', () => {
  it.each([null, request])(
    '요약이 준비되기 전에는 버튼을 숨기고 저장소·브랜치·닫기를 남긴다 (request=%j)',
    (pending) => {
      h.state.gitSnapshotRequest = pending
      const $ = render()
      const row = $('[data-surface="git-row"]')
      expect(row.text()).toContain('repo')
      expect(row.text()).toContain('main')
      expect(row.find('button')).toHaveLength(1)
      expect(row.find('[data-git-row-close]')).toHaveLength(1)
      expect(row.text()).not.toContain('+0')
      expect(h.query).toHaveBeenCalledWith('/repo', 'restored-session')
    }
  )
  it.each([
    [0, 0],
    [120, 20]
  ])('요약 수신 후 실제 +%i −%i 버튼이 나타난다', (added, removed) => {
    h.state = chatReducer(h.state, { type: 'BEGIN_GIT_SNAPSHOT_QUERY', request })
    expect(render()('[data-surface="git-row"] button')).toHaveLength(1)
    h.state = chatReducer(h.state, {
      type: 'RECEIVE_GIT_SNAPSHOT_SUMMARY',
      request,
      summary: summary(added, removed)
    })
    const $ = render()
    const buttons = $('[data-surface="git-row"] button')
    expect(buttons).toHaveLength(2)
    const diff = buttons.not('[data-git-row-close]')
    expect(diff.text()).toContain(`+${added}`)
    expect(diff.text()).toContain(`−${removed}`)
    expect(diff.attr('aria-pressed')).toBe('true')
  })
})
