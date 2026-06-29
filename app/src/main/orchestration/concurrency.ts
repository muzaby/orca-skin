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
