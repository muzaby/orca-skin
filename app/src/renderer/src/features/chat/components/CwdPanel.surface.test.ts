import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('../store/chatStore', () => ({
  useChatSession: (select: (value: unknown) => unknown) =>
    select({
      agentKind: 'code',
      extraDirs: ['/reference'],
      extraDirRejection: null,
      worktreeIsolation: true,
      worktreeBaseRef: 'main',
      cwd: '/repo',
      projectId: 'project'
    }),
  chatActions: {
    setWorktreeIsolation: vi.fn(),
    setWorktreeBaseRef: vi.fn(),
    removeExtraDir: vi.fn()
  }
}))
vi.mock('../../../shared/api/ipc', () => ({ fileApi: {}, gitApi: {} }))
vi.mock('../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('../hooks/useDirectoryPicker', () => ({
  useDirectoryPicker: () => ({ pick: vi.fn(), picking: false, errorKey: null })
}))
vi.mock('../harnesses/common/composer/branchChipState', async (original) => ({
  ...(await original<typeof import('../harnesses/common/composer/branchChipState')>()),
  statusForCwd: () => ({ isRepo: true, branch: 'main', detached: false, root: '/repo' })
}))

import { CwdPanel } from './CwdPanel'

// Captured before replacing harness conditions: real controls, both picker branches, both surfaces.
it.each(['default', 'opencode'] as const)('preserves every rendered class for %s', (appearance) => {
  for (const projects of [false, true]) {
    const html = renderToStaticMarkup(
      createElement(CwdPanel, {
        cwd: '/repo',
        inflight: false,
        appearance,
        landingProjects: projects
          ? { items: [{ id: 'project', name: 'Project', cwd: '/repo' }], loading: false }
          : undefined
      })
    )
    expect([...html.matchAll(/class="([^"]*)"/g)].map((match) => match[1])).toMatchSnapshot(
      projects ? 'project-picker' : 'cwd-button'
    )
  }
})
