// Claude 도구 카드 본문 헤더의 지연 복사 (0325 VP-26 y3 · EP-7 ①).
// 연 카드는 렌더 중 복사 문자열을 만들지 않고, 복사 버튼을 누를 때 한 번 만든다.
import { createElement } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../../../shared/ui/renderHarness.testfixture'
import type { ToolCall } from '../../../reducer/chatReducer'
import { agentUiPolicy } from '../../../lib/agentPresentation'
import * as toolCopy from './toolCopyText'
import { ToolCard } from './ToolCard'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))
// 본문 렌더러·셸 동작은 이 oracle 밖이다 — 헤더의 복사 버튼만 본다.
vi.mock('./registry', () => ({
  toolRendererRegistry: { resolve: () => ({ kind: 'generic', Body: () => null }) }
}))
vi.mock('../../common/transcript/ForegroundShellActions', () => ({
  ForegroundShellActions: () => null
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('y3 연 도구 카드 — 렌더 중 `copyText` 0 · 클릭 때 1회 · 문자열은 같은 함수의 결과', async () => {
  vi.useFakeTimers()
  const writeText = vi.fn(async () => {})
  const copy = vi.spyOn(toolCopy, 'copyText')
  const call: ToolCall = {
    toolUseId: 'b1',
    name: 'Bash',
    input: { command: 'ls' },
    result: { output: 'a.txt\nb.txt', isError: false }
  } as ToolCall
  const dom = installFakeDom({ innerWidth: 1200, innerHeight: 900 })
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  try {
    const render = (): void =>
      dom.render(
        createElement(ToolCard, { call, transcriptPolicy: agentUiPolicy('code').transcript })
      )
    render()
    dom.click(dom.query('[role="button"]')!)
    render()
    render()
    const button = dom.query('[aria-label="common.copy"]')!
    expect(button).not.toBeNull()
    expect(copy).not.toHaveBeenCalled()
    dom.click(button)
    await Promise.resolve()
    expect(copy).toHaveBeenCalledOnce()
    copy.mockRestore()
    expect(writeText).toHaveBeenCalledExactlyOnceWith(toolCopy.copyText(call))
    expect(writeText).toHaveBeenCalledWith('$ ls\na.txt\nb.txt')
  } finally {
    dom.unmount()
  }
})
