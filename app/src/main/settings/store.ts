// Phase 1: in-memory 설정 저장. Phase 2+ 에서 electron-store 도입 (TRD §6.7).
export class SettingsStore {
  private map = new Map<string, unknown>()

  get(key: string): unknown {
    return this.map.get(key)
  }

  set(key: string, value: unknown): void {
    this.map.set(key, value)
  }
}
