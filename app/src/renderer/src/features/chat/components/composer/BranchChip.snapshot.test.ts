import { describe, expect, it, vi } from 'vitest'
import type { BranchSnapshot } from './branchChipState'

const { api, snapshots, menu } = vi.hoisted(() => ({
  api: { checkout: vi.fn(), status: vi.fn(), snapshot: vi.fn(), branches: vi.fn() },
  snapshots: [] as BranchSnapshot[],
  menu: { onPick: null as ((branch: string) => void) | null }
}))
vi.mock('react', async (original) => {
  const react = await original<typeof import('react')>()
  return {
    ...react,
    useState: (initial: unknown) => {
      const [value, set] = react.useState(initial)
      if (initial && typeof initial === 'object' && 'cwd' in initial && 'status' in initial) {
        return [
          value,
          (next: BranchSnapshot): void => {
            snapshots.push(next)
            set(next)
          }
        ]
      }
      return [value, set]
    }
  }
})
vi.mock('../../../../shared/api/ipc', () => ({ gitApi: api }))
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
vi.mock('./BranchMenu', () => ({
  BranchMenu: (props: { onPick: (branch: string) => void }): null => {
    menu.onPick = props.onPick
    return null
  }
}))
vi.mock('../../../../shared/ui/Popover', () => ({
  Popover: ({ children }: { children?: unknown }) => children
}))
vi.mock('../../../../shared/ui/Modal', () => ({ Modal: () => null }))
vi.mock('./branchChipState', async (original) => ({
  ...(await original<typeof import('./branchChipState')>()),
  branchChipView: () => ({ visible: true, branch: 'main' })
}))

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { BranchChip } from './BranchChip'

describe('checkout snapshot consumption', () => {
  it('updates the chip with the returned status and issues no status or snapshot query', async () => {
    const status = {
      isRepo: true,
      branch: 'feature',
      detached: false,
      root: '/repo',
      githubUrl: 'https://github.com/a/b'
    }
    api.checkout.mockResolvedValue({ ok: true, branch: 'feature', status })
    renderToStaticMarkup(createElement(BranchChip, { cwd: '/repo' }))
    expect(menu.onPick).not.toBeNull()
    menu.onPick!('feature')
    await vi.waitFor(() => expect(snapshots).toEqual([{ cwd: '/repo', status }]))
    expect(api.checkout).toHaveBeenCalledOnce()
    expect(api.status).not.toHaveBeenCalled()
    expect(api.snapshot).not.toHaveBeenCalled()
  })
})
