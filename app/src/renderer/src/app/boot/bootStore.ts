import { create } from 'zustand'
import { createBootSteps, runBootSteps, type BootStepEvent, type BootStepId } from './steps'

export type BootPhase = 'idle' | 'running' | 'ready' | 'failed'
export type BootStepStatus = 'pending' | 'running' | 'ok' | 'failed' | 'degraded'

export interface BootStepState {
  id: BootStepId
  status: BootStepStatus
  durationMs?: number
  error?: string
}

interface BootStoreState {
  phase: BootPhase
  steps: BootStepState[]
  landingTarget: string | null
  errorMessage: string | null
}

const initialSteps = (): BootStepState[] =>
  createBootSteps().map((step) => ({ id: step.id, status: 'pending' }))

export const useBootStore = create<BootStoreState>()(() => ({
  phase: 'idle',
  steps: initialSteps(),
  landingTarget: null,
  errorMessage: null
}))

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function applyStepEvent(event: BootStepEvent): void {
  useBootStore.setState((state) => ({
    steps: state.steps.map((step) =>
      step.id === event.id
        ? {
            ...step,
            status: event.status === 'degraded' ? 'degraded' : event.status,
            durationMs: event.durationMs,
            error: event.error ? errorMessage(event.error) : undefined
          }
        : step
    )
  }))
}

export const bootActions = {
  async runBoot(): Promise<void> {
    const phase = useBootStore.getState().phase
    if (phase === 'running' || phase === 'ready') return

    useBootStore.setState({
      phase: 'running',
      steps: initialSteps(),
      landingTarget: null,
      errorMessage: null
    })

    try {
      const result = await runBootSteps(createBootSteps(), applyStepEvent)
      useBootStore.setState({
        phase: 'ready',
        landingTarget: result.landingTarget,
        errorMessage: null
      })
    } catch (error) {
      useBootStore.setState({
        phase: 'failed',
        landingTarget: null,
        errorMessage: errorMessage(error)
      })
    }
  },

  reset(): void {
    useBootStore.setState({
      phase: 'idle',
      steps: initialSteps(),
      landingTarget: null,
      errorMessage: null
    })
  }
}
