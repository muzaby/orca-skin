import { create } from 'zustand'
import {
  createBootSteps,
  runBootSteps,
  formatError,
  type BootStep,
  type BootStepEvent,
  type BootStepId
} from './steps'

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

const pendingRows = (steps: BootStep[]): BootStepState[] =>
  steps.map((step) => ({ id: step.id, status: 'pending' }))

const initialSteps = (): BootStepState[] => pendingRows(createBootSteps())

export const useBootStore = create<BootStoreState>()(() => ({
  phase: 'idle',
  steps: initialSteps(),
  landingTarget: null,
  errorMessage: null
}))

function applyStepEvent(event: BootStepEvent): void {
  useBootStore.setState((state) => ({
    steps: state.steps.map((step) =>
      step.id === event.id
        ? {
            ...step,
            status: event.status,
            durationMs: event.durationMs,
            error: event.error ? formatError(event.error) : undefined
          }
        : step
    )
  }))
}

export const bootActions = {
  async runBoot(): Promise<void> {
    const phase = useBootStore.getState().phase
    if (phase === 'running' || phase === 'ready') return

    const steps = createBootSteps()
    useBootStore.setState({
      phase: 'running',
      steps: pendingRows(steps),
      landingTarget: null,
      errorMessage: null
    })

    try {
      const result = await runBootSteps(steps, applyStepEvent)
      useBootStore.setState({
        phase: 'ready',
        landingTarget: result.landingTarget,
        errorMessage: null
      })
    } catch (error) {
      useBootStore.setState({
        phase: 'failed',
        landingTarget: null,
        errorMessage: formatError(error)
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
