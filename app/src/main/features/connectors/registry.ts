// Connection 레지스트리 (0157).
//
// ⚠️ 이름 주의: connector **구현체**의 등록은 여기가 아니라 `features/auth-platform/registry.ts`
// 가 한다 — manifest 검증·ABI·중복 거부를 auth provider 와 **한 경로**로 묶기 위해서다.
// 여기가 소유하는 것은 그 위의 개념인 **연결(connection)** 이다:
//
//   connector  = "이 Confluence 서버를 부를 수 있는 코드" (빌드 타임 플러그인, origin 고정)
//   connection = "그 서버에 이 binding 으로 연결됨" (connector 당 최대 1개)
//
// 0158 r4 사용자 결정: 서버/하위 도메인마다 **별도 정적 connector** 를 두고 connector 당 활성
// 연결은 1개다. 그래도 둘을 분리하는 이유는 수명이 다르기 때문이다 — connector 는 빌드 산출물로
// 상주하고, connection 은 인증 binding 과 함께 생겼다 사라진다.
//
// 레이어: features/connectors 는 features/auth-platform 을 **import 하지 않는다**(교차 금지).
// 필요한 것은 컴포지션 루트가 주입한다.

// Static connector model (0158 r4): one connector ID represents one fixed server origin,
// so it has at most one pending or ready connection. The auth binding supplies that record's
// connection ID; this registry neither generates nor replaces it.
export interface Connection {
  id: string
  connectorId: string
  // 이 연결이 사용하는 인증 binding. raw credential 은 여기 없다.
  bindingId: string
  label?: string
  createdAt: number
}

export interface CreateConnectionInput {
  id: string
  connectorId: string
  bindingId: string
  label?: string
}

export class ConnectionRegistry {
  private readonly connections = new Map<string, Connection>()

  constructor(private readonly clock: () => number = Date.now) {}

  create(input: CreateConnectionInput): Connection {
    if (this.connections.has(input.id)) {
      throw new Error(`connection ID already exists: ${input.id}`)
    }
    if (this.listByConnector(input.connectorId).length > 0) {
      throw new Error(`static connector already has an active connection: ${input.connectorId}`)
    }
    const connection: Connection = {
      id: input.id,
      connectorId: input.connectorId,
      bindingId: input.bindingId,
      createdAt: this.clock(),
      ...(input.label !== undefined ? { label: input.label } : {})
    }
    this.connections.set(input.id, connection)
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

  remove(id: string): boolean {
    return this.connections.delete(id)
  }

  removeIfSame(id: string, expected: Connection): boolean {
    if (this.connections.get(id) !== expected) return false
    return this.connections.delete(id)
  }
}
