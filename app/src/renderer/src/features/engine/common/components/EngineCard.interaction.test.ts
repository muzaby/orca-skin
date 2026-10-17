import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { AgentEnvironment } from '../../../../../../shared/ipc'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import { EngineCard } from '../../components/EngineCard'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))

let dom: FakeDom
const nodes = (node: FakeNode): FakeNode[] => [node, ...node.children.flatMap(nodes)]
afterEach(() => {
  dom?.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it.each(['claude', 'opencode'])(
  'routes the %s card edit and delete clicks with the original engine',
  (adapter) => {
    vi.useFakeTimers()
    dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
    const agent: AgentEnvironment = {
      adapter,
      key: `${adapter}-fixture`,
      provider: 'fixture',
      supported: true,
      models: []
    }
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    dom.render(createElement(EngineCard, { agent, onEdit, onDelete }))
    const [edit, remove] = nodes(dom.body).filter((node) => node.tag === 'button')
    expect(edit.textContent).toBe('common.edit')
    expect(remove.textContent).toBe('common.delete')

    dom.click(edit)
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(agent)
    expect(onEdit.mock.calls[0][0]).toBe(agent)
    expect(onDelete).not.toHaveBeenCalled()

    dom.click(remove)
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(agent)
    expect(onDelete.mock.calls[0][0]).toBe(agent)
    expect(onEdit).toHaveBeenCalledTimes(1)
  }
)
