// 테스트 전용 가짜 요소 — TooltipNode 최소 형상.
import type { TooltipNode } from './tooltipTarget'

export class FakeNode implements TooltipNode {
  readonly attrs = new Map<string, string>()
  constructor(
    readonly tagName: string,
    readonly parentElement: FakeNode | null = null,
    attrs: Record<string, string> = {}
  ) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v)
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value)
  }
  removeAttribute(name: string): void {
    this.attrs.delete(name)
  }
  hasAttribute(name: string): boolean {
    return this.attrs.has(name)
  }
}
