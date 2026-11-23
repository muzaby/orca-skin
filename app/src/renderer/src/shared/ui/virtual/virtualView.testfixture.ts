import { vi, afterEach, beforeEach } from 'vitest'
import { installFakeDom, type FakeDom } from '../renderHarness.testfixture'
import { fakeComputeClient } from '../../compute/fakeClient.testfixture'
import { setComputeClient } from '../../compute/client'
export let dom: FakeDom
export let fake: ReturnType<typeof fakeComputeClient>
export const visible = { first: 0, count: 4 }
export function useTestVirtualRows(count: number): {
  range: { startIndex: number; endIndex: number }
  options: { scrollMargin: number }
  getTotalSize: () => number
  measureElement: () => void
  getVirtualItems: () => { key: number; index: number; start: number }[]
} {
  const size = Math.max(0, Math.min(visible.count, count - visible.first))
  return {
    range: { startIndex: visible.first, endIndex: visible.first + 1 },
    options: { scrollMargin: 0 },
    getTotalSize: () => count * 20,
    measureElement: () => {},
    getVirtualItems: () =>
      Array.from({ length: size }, (_, i) => ({
        key: visible.first + i,
        index: visible.first + i,
        start: (visible.first + i) * 20
      }))
  }
}
export async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  dom.act(() => {})
}
beforeEach(() => {
  dom = installFakeDom({ innerWidth: 1200, innerHeight: 800 })
  fake = fakeComputeClient()
  setComputeClient(fake.client)
  visible.first = 0
})
afterEach(() => {
  dom.unmount()
  setComputeClient(null)
  vi.unstubAllGlobals()
})
