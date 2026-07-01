// 프로젝트별 active turn 회계.
//
// 이 카운터는 렌더러 경고/입장 제어가 보는 "동일 프로젝트에서 진행 중인 턴 수"를 추적한다.
// RuntimeSupervisor/RuntimeCapPolicy 의 active+idle SessionRuntime population(cap/LRU 대상)과는
// 별개의 숫자다. lifecycle 소속인 이유는 증가/감소가 TurnCoordinator 의 start→finally 경로와
// Supervisor 소유 자원 회계에 맞물려야 하기 때문이다.
export type ConcurrencyListener = (projectId: string, count: number) => void

export class ConcurrencyRegistry {
  private readonly counts = new Map<string, number>()

  constructor(private readonly onChange: ConcurrencyListener = () => undefined) {}

  getCount(projectId: string | null | undefined): number {
    if (!projectId) return 0
    return this.counts.get(projectId) ?? 0
  }

  increment(projectId: string | null | undefined): void {
    if (!projectId) return
    const next = this.getCount(projectId) + 1
    this.counts.set(projectId, next)
    this.onChange(projectId, next)
  }

  decrement(projectId: string | null | undefined): void {
    if (!projectId) return
    const next = Math.max(0, this.getCount(projectId) - 1)
    if (next === 0) this.counts.delete(projectId)
    else this.counts.set(projectId, next)
    this.onChange(projectId, next)
  }
}
