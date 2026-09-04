import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitStatus } from '../../../../../shared/ipc'

const fixture = vi.hoisted(() => ({ status: null as GitStatus | null, isolation: false }))
vi.mock('../store/chatStore', () => ({
  useChatSession: (select: (value: unknown) => unknown) =>
    select({
      extraDirs: [],
      extraDirRejection: null,
      worktreeIsolation: fixture.isolation,
      worktreeBaseRef: null
    }),
  chatActions: { setWorktreeIsolation: vi.fn() }
}))
vi.mock('../../../shared/api/ipc', () => ({ fileApi: {}, gitApi: {} }))
vi.mock('../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('./CwdButton', () => ({ CwdButton: () => null }))
// SSR does not run the status effect. Supply only its resolved snapshot; keep the visibility rule,
// BranchChip, CwdPanel and checkbox rendering real.
vi.mock('./composer/branchChipState', async (original) => ({
  ...(await original<typeof import('./composer/branchChipState')>()),
  statusForCwd: () => fixture.status
}))

import { CwdPanel } from './CwdPanel'
import { ko } from '../../../shared/i18n/resources/ko'

const render = (cwd: string | null = '/repo', inflight = false): string =>
  renderToStaticMarkup(createElement(CwdPanel, { cwd, inflight }))
const repo: GitStatus = {
  isRepo: true,
  branch: 'main',
  detached: false,
  root: '/repo'
}

beforeEach(() => {
  fixture.status = null
  fixture.isolation = false
})

describe('landing branch and worktree visibility', () => {
  it.each([null, { ...repo, isRepo: false }])(
    'hides the entire group without a confirmed Git repository: %j',
    (status) => {
      fixture.status = status
      const html = render()
      expect(html).not.toContain('branch-worktree-group')
      expect(html).not.toContain('chat.composer.worktreeIsolation')
      expect(html).not.toContain('chat.composer.branchTitle')
    }
  )

  it('shows both controls together when Git status resolves, then hides them without cwd', () => {
    fixture.status = repo
    const html = render()
    expect(html).toContain('branch-worktree-group')
    expect(html).toContain('chat.composer.branchTitle')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('chat.composer.worktreeIsolation')
    const group = html.match(
      /<div[^>]*data-surface="branch-worktree-group"[^>]*>([\s\S]*?)<\/div>/
    )?.[1]
    expect(group).toContain('chat.composer.branchTitle')
    expect(group).toContain('type="checkbox"')
    for (const control of group!.matchAll(/<(?:button|label)\b[^>]*class="([^"]+)"/g)) {
      expect(control[1]).toContain('self-stretch')
      expect(control[1]).not.toMatch(/(?:^|\s)(?:h-7|border|rounded-\S+)(?:\s|$)/)
    }
    expect(render(null)).not.toContain('branch-worktree-group')
  })

  it('renders a native checkbox with the draft checked state and inflight disablement', () => {
    fixture.status = repo
    expect(render().match(/<input[^>]*>/)?.[0]).not.toContain('checked=""')
    fixture.isolation = true
    expect(render().match(/<input[^>]*>/)?.[0]).toContain('checked=""')
    expect(render('/repo', true).match(/<input[^>]*>/)?.[0]).toContain('disabled=""')
    expect(ko.chat.composer.worktreeIsolation).toBe('워크트리')
  })
})
