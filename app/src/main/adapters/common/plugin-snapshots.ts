export interface PluginSnapshotLease {
  roots: string[]
  release(): void
}
export interface PluginSnapshotPort {
  capture(roots: readonly string[]): PluginSnapshotLease
}
