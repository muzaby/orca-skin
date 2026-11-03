// 0292 r2 verify 재현 — app/src/renderer/src/app/boot/ 에 복사해 실행하고 지운다(저장소 app 트리에 두지 않는다).
// 실행: ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron ./node_modules/vitest/vitest.mjs run src/renderer/src/app/boot/<이 파일>
// verify r2 scratch — sibling orders of the push/list race (not committed to app/)
import { afterEach, expect, it, vi } from 'vitest'
import type { HarnessAvailability } from '../../../../shared/ipc'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})
async function setup() {
  vi.resetModules()
  const list = Promise.withResolvers<{ backends: HarnessAvailability[] }>()
  let push!: (state: HarnessAvailability) => void
  vi.stubGlobal('window', {
    orca: {
      backend: { list: vi.fn(() => list.promise) },
      harness: { onAvailability: vi.fn((handler) => ((push = handler), () => {})) }
    }
  })
  const { useHarnessAvailabilityStore: store } = await import('../../shared/stores/harnessAvailabilityStore')
  const { initBackend } = await import('../../features/backend/store/backendStore')
  return { list, push: (s: HarnessAvailability) => push(s), store, initBackend }
}
const usable: HarnessAvailability = { id: 'opencode', installed: true, version: '1.19.0', usable: true }
const missing: HarnessAvailability = { id: 'opencode', installed: false, usable: false, unavailableReason: 'missing' }
const claudeV: HarnessAvailability = { id: 'claude', installed: true, version: 'push-claude', usable: true }
it('S1 list resolves first, later push wins', async () => {
  const f = await setup()
  const p = f.initBackend()
  f.list.resolve({ backends: [missing] })
  await p
  expect(f.store.getState().byId.opencode).toEqual(missing)
  f.push(usable)
  expect(f.store.getState().byId.opencode).toEqual(usable)
})
it('S2 push for a sibling harness only fences that harness', async () => {
  const f = await setup()
  const p = f.initBackend()
  f.push(claudeV)
  f.list.resolve({ backends: [{ id: 'claude', installed: true, usable: true, version: 'list-claude' }, missing] })
  await p
  expect(f.store.getState().byId.claude).toEqual(claudeV)
  expect(f.store.getState().byId.opencode).toEqual(missing)
})
it('S3 push during list then a newer push after list', async () => {
  const f = await setup()
  const p = f.initBackend()
  f.push(usable)
  f.list.resolve({ backends: [missing] })
  await p
  const unsupported: HarnessAvailability = { id: 'opencode', installed: true, version: '2.0.0', usable: false, unavailableReason: 'unsupported' }
  f.push(unsupported)
  expect(f.store.getState().byId.opencode).toEqual(unsupported)
})
