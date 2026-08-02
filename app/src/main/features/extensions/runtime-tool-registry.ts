import type {
  RuntimeToolServer,
  RuntimeToolSink,
  RuntimeToolSnapshot,
  RuntimeToolSource
} from '../../adapters/runtime-tools'

// 연결된 정적 runtime server의 메모리 전용 registry. 같은 객체 재등록과 없는 ID 제거는
// snapshot을 바꾸지 않으므로 revision을 증가시키지 않는다.
export class RuntimeToolRegistry implements RuntimeToolSource, RuntimeToolSink {
  private readonly servers = new Map<string, RuntimeToolServer>()
  private revision = 0

  add(server: RuntimeToolServer): void {
    const id = server.descriptor.id
    if (this.servers.get(id) === server) return
    this.servers.set(id, server)
    this.revision += 1
  }

  remove(serverId: string): void {
    if (!this.servers.delete(serverId)) return
    this.revision += 1
  }

  snapshot(): RuntimeToolSnapshot {
    return { revision: this.revision, servers: new Map(this.servers) }
  }
}
