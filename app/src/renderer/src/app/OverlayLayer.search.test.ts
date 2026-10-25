import { describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { OverlayLayer } from './OverlayLayer'
import { SearchModal } from '../features/sessions/components/SearchModal'
import { ConfirmDialogHost } from '../shared/ui/ConfirmDialogHost'

const h = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }))
vi.mock('../features/backend', () => ({
  backendActions: {},
  useInstallerOpen: () => false,
  InstallerDialog: () => null,
  AuthExpiredModal: () => null
}))
vi.mock('../features/chat', () => ({
  chatActions: {},
  useChatSession: () => false,
  AutomaticFeedDebugSection: () => null
}))
vi.mock('../features/update', () => ({
  UpdateDebugSection: () => null,
  UpdateDialog: () => null,
  useUpdateDialogOpen: () => false
}))
vi.mock('../features/debug', () => ({ DebugPanel: () => null }))
vi.mock('../features/providers', () => ({ ProviderDebugSection: () => null }))

function findSearch(
  node: ReactNode
): { onChoose: (id: string) => void; onClose: () => void } | undefined {
  if (Array.isArray(node)) return node.map(findSearch).find(Boolean)
  if (
    !isValidElement<{ children?: ReactNode; onChoose: (id: string) => void; onClose: () => void }>(
      node
    )
  )
    return
  return node.type === SearchModal ? node.props : findSearch(node.props.children)
}

function countConfirmationHosts(node: ReactNode): number {
  if (Array.isArray(node))
    return node.reduce((count, child) => count + countConfirmationHosts(child), 0)
  if (!isValidElement<{ children?: ReactNode }>(node)) return 0
  return Number(node.type === ConfirmDialogHost) + countConfirmationHosts(node.props.children)
}

describe('shell wiring to the sessions search feature', () => {
  it('mounts the shared confirmation host once in the shell', () => {
    for (const searchOpen of [false, true]) {
      expect(countConfirmationHosts(OverlayLayer({ searchOpen, onCloseSearch: vi.fn() }))).toBe(1)
    }
  })

  it('passes the session selection into navigation and retains the close callback', () => {
    const close = vi.fn()
    const search = findSearch(OverlayLayer({ searchOpen: true, onCloseSearch: close }))
    expect(search).toBeDefined()
    search!.onChoose('selected-session')
    expect(h.navigate).toHaveBeenCalledExactlyOnceWith('/chat/selected-session')
    expect(search!.onClose).toBe(close)
    expect(close).not.toHaveBeenCalled()
    expect(findSearch(OverlayLayer({ searchOpen: false, onCloseSearch: close }))).toBeUndefined()
  })
})
