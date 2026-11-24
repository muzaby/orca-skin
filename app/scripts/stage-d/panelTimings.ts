import { measurePlanGeometry } from './planGeometry'
import { measureProviderFlow } from './providerFlow'

export async function measurePanelTimings(): Promise<unknown> {
  const entries: PerformanceEntry[] = []
  const observer = PerformanceObserver.supportedEntryTypes.includes('longtask')
    ? new PerformanceObserver((list) => entries.push(...list.getEntries()))
    : null
  observer?.observe({ type: 'longtask' })
  const gaps: number[] = []
  let previous: number | undefined
  let tick = 0
  const sample = (time: number): void => {
    if (previous !== undefined) gaps.push(time - previous)
    previous = time
    tick = requestAnimationFrame(sample)
  }
  tick = requestAnimationFrame(sample)
  try {
    const geometry = await measurePlanGeometry(true)
    const provider = await measureProviderFlow(true)
    if (observer) entries.push(...observer.takeRecords())
    return {
      geometry,
      provider,
      longTasks: observer ? entries.map((entry) => entry.duration) : null,
      frameGapsMs: gaps
    }
  } finally {
    observer?.disconnect()
    cancelAnimationFrame(tick)
  }
}
