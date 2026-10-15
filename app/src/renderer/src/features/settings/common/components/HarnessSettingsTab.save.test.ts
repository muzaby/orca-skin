import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installFakeDom,
  type FakeDom,
  type FakeNode
} from '../../../../shared/ui/renderHarness.testfixture'
import { HarnessSettingsTab } from '../../components/HarnessSettingsTab'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../shared/i18n', () => {
  const tr = (key: string): string => key
  return { useI18n: () => ({ tr }) }
})
// DOM 측정은 이 저장 계약의 범위 밖이다. 탭과 하네스 필드·IPC는 production 구현을 사용한다.
vi.mock('../../../../shared/ui/AutoGrowTextarea', () => ({
  AutoGrowTextarea: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    createElement('textarea', {
      value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value)
    })
}))

let dom: FakeDom
const save = vi.fn(async () => {})
function nodes(root = dom.body): FakeNode[] {
  return [root, ...root.children.flatMap((child) => nodes(child))]
}
async function settle(): Promise<void> {
  for (let n = 0; n < 6; n++) await Promise.resolve()
  dom.act(() => {})
}
beforeEach(() => {
  vi.useFakeTimers()
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  save.mockClear()
  Object.assign(window, {
    orca: {
      settings: {
        get: async () => ({
          harnesses: {
            claude: { instructions: 'claude before' },
            opencode: { instructions: 'opencode before', executablePath: 'C:/old.exe' }
          }
        }),
        set: save
      }
    }
  })
})
afterEach(() => {
  dom.unmount()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('harness settings field and save routing', () => {
  it.each(['claude', 'opencode'] as const)(
    'saves only %s fields through the common tab',
    async (backend) => {
      dom.render(createElement(HarnessSettingsTab, { backend }))
      await settle()
      const textarea = nodes().find((node) => node.tag === 'textarea')!
      dom.act(() =>
        (textarea.props.onChange as (e: unknown) => void)({ target: { value: 'new instructions' } })
      )
      const input = nodes().find((node) => node.tag === 'input')
      expect(Boolean(input)).toBe(backend === 'opencode')
      if (input)
        dom.act(() =>
          (input.props.onChange as (e: unknown) => void)({ target: { value: ' C:/new.exe ' } })
        )
      const button = nodes().find(
        (node) => node.tag === 'button' && node.textContent === 'common.save'
      )!
      dom.click(button)
      await settle()
      expect(save).toHaveBeenCalledExactlyOnceWith({
        harnesses: {
          [backend]: {
            instructions: 'new instructions',
            ...(backend === 'opencode' ? { executablePath: 'C:/new.exe' } : {})
          }
        }
      })
    }
  )
})
