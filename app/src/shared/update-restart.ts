export interface RestartGateState {
  isGenerating: boolean
  activeToolCallCount: number
  activeDbWriteCount: number
  isIndexing: boolean
}

export function canRestartForUpdate(state: RestartGateState): boolean {
  return (
    !state.isGenerating &&
    state.activeToolCallCount === 0 &&
    state.activeDbWriteCount === 0 &&
    !state.isIndexing
  )
}
