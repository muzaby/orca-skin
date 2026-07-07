import type { BootReport } from '../../../../shared/ipc'

export async function readCompletedMainBootReport(): Promise<BootReport | null> {
  try {
    const report = await window.orca.boot.getReport()
    console.info('[boot] main bootstrap completed report', report)
    return report
  } catch (error) {
    console.warn('[boot] main bootstrap report 조회 실패:', error)
    return null
  }
}
