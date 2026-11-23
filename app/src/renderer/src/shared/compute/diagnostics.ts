import { useLayoutEffect } from 'react'
import type { ComputeJobTiming } from './client'

export interface ComputeDiagnostics {
  job(timing: ComputeJobTiming): void
  paint(key: string, at: number): void
}
let observer: ComputeDiagnostics | undefined
export function setComputeDiagnostics(value: ComputeDiagnostics | undefined): void {
  observer = value
}
export function computeDiagnostics(): ComputeDiagnostics | undefined {
  return observer
}

export function useComputePaint(key: string | null): void {
  useLayoutEffect(() => {
    const sink = observer
    if (!key || !sink) return
    const frame = requestAnimationFrame(() => sink.paint(key, performance.now()))
    return () => cancelAnimationFrame(frame)
  }, [key])
}
