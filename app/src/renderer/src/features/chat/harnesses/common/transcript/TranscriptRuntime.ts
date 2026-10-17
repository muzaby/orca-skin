import { createContext, useContext, type ComponentType } from 'react'
import type { TranscriptAppearance, AgentTranscriptPresentation } from '../../contracts'
import type { MessageSegment } from '../../../lib/parts'
export interface TranscriptRuntime {
  DetailStatus: ComponentType<{ turnStartedAt: number | null }>
  appearance: TranscriptAppearance
  messageClassName: string
  canFork: boolean
  Segment: ComponentType<{ segment: MessageSegment; transcriptPolicy: AgentTranscriptPresentation }>
}
const Runtime = createContext<TranscriptRuntime | null>(null)
export const TranscriptRuntimeProvider = Runtime.Provider
export function useTranscriptRuntime(): TranscriptRuntime {
  const runtime = useContext(Runtime)
  if (!runtime) throw new Error('Transcript runtime must be supplied by the harness assembly')
  return runtime
}
