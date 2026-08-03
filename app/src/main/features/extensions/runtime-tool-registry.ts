import type {
  RuntimeToolAnnotations,
  RuntimeToolDeclaration,
  RuntimeToolDescriptor,
  RuntimeToolImplementation,
  RuntimeToolServer,
  RuntimeToolSink,
  RuntimeToolSnapshot,
  RuntimeToolSource
} from '../../adapters/runtime-tools'

function copyAnnotations(
  annotations: RuntimeToolAnnotations | undefined
): RuntimeToolAnnotations | undefined {
  return annotations ? { ...annotations } : undefined
}

function copyDeclaration(declaration: RuntimeToolDeclaration): RuntimeToolDeclaration {
  return {
    ...declaration,
    ...(declaration.annotations ? { annotations: copyAnnotations(declaration.annotations) } : {})
  }
}

function copyDescriptor(descriptor: RuntimeToolDescriptor): RuntimeToolDescriptor {
  return { ...descriptor, tools: descriptor.tools.map(copyDeclaration) }
}

function copyImplementation(implementation: RuntimeToolImplementation): RuntimeToolImplementation {
  // inputSchema와 handler는 실행 값이라 identity를 보존한다. 그 외 entry 구조는 registry가 소유한다.
  return { ...implementation }
}

function copyServer(server: RuntimeToolServer): RuntimeToolServer {
  return {
    descriptor: copyDescriptor(server.descriptor),
    implementations: server.implementations.map(copyImplementation)
  }
}

function sameAnnotations(
  left: RuntimeToolAnnotations | undefined,
  right: RuntimeToolAnnotations | undefined
): boolean {
  return (
    left?.readOnlyHint === right?.readOnlyHint &&
    left?.destructiveHint === right?.destructiveHint &&
    left?.idempotentHint === right?.idempotentHint &&
    left?.openWorldHint === right?.openWorldHint
  )
}

function sameDescriptor(left: RuntimeToolDescriptor, right: RuntimeToolDescriptor): boolean {
  return (
    left.id === right.id &&
    left.pluginId === right.pluginId &&
    left.connectorId === right.connectorId &&
    left.apiVersion === right.apiVersion &&
    left.alwaysLoad === right.alwaysLoad &&
    left.instructions === right.instructions &&
    left.tools.length === right.tools.length &&
    left.tools.every(
      (tool, index) =>
        tool.name === right.tools[index]?.name &&
        tool.description === right.tools[index]?.description &&
        sameAnnotations(tool.annotations, right.tools[index]?.annotations)
    )
  )
}

function sameServer(left: RuntimeToolServer, right: RuntimeToolServer): boolean {
  return (
    sameDescriptor(left.descriptor, right.descriptor) &&
    left.implementations.length === right.implementations.length &&
    left.implementations.every(
      (implementation, index) =>
        implementation.name === right.implementations[index]?.name &&
        implementation.inputSchema === right.implementations[index]?.inputSchema &&
        implementation.handler === right.implementations[index]?.handler
    )
  )
}

// 연결된 정적 runtime server의 메모리 전용 registry. 실행 값은 보존하되 caller/snapshot이
// descriptor 또는 implementation 구조를 바꿔도 내부 상태가 변하지 않게 복사본을 소유한다.
export class RuntimeToolRegistry implements RuntimeToolSource, RuntimeToolSink {
  private readonly servers = new Map<string, RuntimeToolServer>()
  private revision = 0

  add(server: RuntimeToolServer): void {
    const id = server.descriptor.id
    const existing = this.servers.get(id)
    if (existing && sameServer(existing, server)) return
    this.servers.set(id, copyServer(server))
    this.revision += 1
  }

  remove(serverId: string): void {
    if (!this.servers.delete(serverId)) return
    this.revision += 1
  }

  snapshot(): RuntimeToolSnapshot {
    return {
      revision: this.revision,
      servers: new Map([...this.servers].map(([id, server]) => [id, copyServer(server)]))
    }
  }
}
