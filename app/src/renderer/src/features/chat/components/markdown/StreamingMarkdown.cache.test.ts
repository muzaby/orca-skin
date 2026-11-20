import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { advanceStableBlocks } from '../../lib/markdownBlocks'
import { StreamingMarkdown } from './StreamingMarkdown'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../lib/markdownBlocks', { spy: true })
vi.mock('../../../../shared/ui/markdown/CodeBlock', () => ({
  CodeBlock: ({ code }: { code: string }) => createElement('code', { 'data-fence': 'true' }, code)
}))

it('passes the previous scan into the mounted renderer on each new fence delta', () => {
  const dom = installFakeDom({ innerWidth: 500, innerHeight: 200 })
  const scan = vi.mocked(advanceStableBlocks)
  try {
    let source = '~~~js\n'
    for (const delta of ['first', '\nsecond', '\nthird']) {
      const previous = scan.mock.results.at(-1)?.value?.cache ?? null
      source += delta
      dom.render(createElement(StreamingMarkdown, { source }))
      expect(scan.mock.lastCall).toEqual([previous, source])
      expect(dom.query('[data-fence]')?.textContent).toBe(source.slice(6))
    }
    expect(scan).toHaveBeenCalledTimes(3)
  } finally {
    dom.unmount()
    vi.unstubAllGlobals()
  }
})
