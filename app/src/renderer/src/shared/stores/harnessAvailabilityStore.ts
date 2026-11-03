import { create } from 'zustand'
import type { Backend, HarnessAvailability } from '../../../../shared/ipc'
import { harnessApi } from '../api/ipc'

const initial: Record<Backend, HarnessAvailability> = {
  claude: { id: 'claude', installed: true, usable: true },
  opencode: { id: 'opencode', installed: false, usable: false, unavailableReason: 'missing' }
}
export const useHarnessAvailabilityStore = create<{ byId: Record<Backend, HarnessAvailability> }>(
  () => ({ byId: initial })
)
let generation = 0
let stop: (() => void) | undefined
const changedAt = new Map<Backend, number>()
export function applyHarnessAvailabilitySnapshot(state: HarnessAvailability): void {
  changedAt.set(state.id, ++generation)
  useHarnessAvailabilityStore.setState(({ byId }) => ({ byId: { ...byId, [state.id]: state } }))
}
export function subscribeHarnessAvailability(): number {
  stop ??= harnessApi.onAvailability(applyHarnessAvailabilitySnapshot)
  return generation
}
export function seedHarnessAvailability(
  states: HarnessAvailability[],
  readGeneration: number
): void {
  for (const state of states)
    if ((changedAt.get(state.id) ?? 0) <= readGeneration) applyHarnessAvailabilitySnapshot(state)
}
