// Connection 레지스트리 (0157).
//
// ⚠️ 이름 주의: connector **구현체**의 등록은 여기가 아니라 `features/auth-platform/registry.ts`
// 가 한다 — manifest 검증·ABI·중복 거부를 auth provider 와 **한 경로**로 묶기 위해서다.
// 여기가 소유하는 것은 그 위의 개념인 **연결(connection)** 이다:
//
//   connector  = "Confluence 를 부를 수 있는 코드" (빌드 타임 플러그인, 1개)
//   connection = "이 Confluence 인스턴스에 이 binding 으로 연결됨" (사용자가 N개 만듦)
//
// 하나의 connector 를 서로 다른 사내 인스턴스에 여러 번 연결할 수 있어야 하므로 분리가 필요하다.
//
// 레이어: features/connectors 는 features/auth-platform 을 **import 하지 않는다**(교차 금지).
// 필요한 것은 컴포지션 루트가 주입한다.

export interface Connection {
  id: string
  connectorId: string
  // 이 연결이 사용하는 인증 binding. raw credential 은 여기 없다.
  bindingId: string
  label?: string
  createdAt: number
}

export interface CreateConnectionInput {
  connectorId: string
  bindingId: string
  label?: string
}

export class ConnectionRegistry {
  private readonly connections = new Map<string, Connection>()
  private seq = 0

  constructor(private readonly clock: () => number = Date.now) {}

  create(input: CreateConnectionInput): Connection {
    const id = `conn_${++this.seq}_${Math.random().toString(36).slice(2, 10)}`
    const connection: Connection = {
      id,
      connectorId: input.connectorId,
      bindingId: input.bindingId,
      createdAt: this.clock(),
      ...(input.label !== undefined ? { label: input.label } : {})
    }
    this.connections.set(id, connection)
    return connection
  }

  get(id: string): Connection | undefined {
    return this.connections.get(id)
  }

  list(): Connection[] {
    return [...this.connections.values()]
  }

  listByConnector(connectorId: string): Connection[] {
    return this.list().filter((c) => c.connectorId === connectorId)
  }

  // binding 이 끊기면 그 binding 을 쓰던 연결도 무효다 — broker 의 logout 이 호출한다.
  removeByBinding(bindingId: string): Connection[] {
    const victims = this.list().filter((c) => c.bindingId === bindingId)
    for (const v of victims) this.connections.delete(v.id)
    return victims
  }

  remove(id: string): boolean {
    return this.connections.delete(id)
  }
}
