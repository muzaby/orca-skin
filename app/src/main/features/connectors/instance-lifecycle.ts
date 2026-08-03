// 사용자 생성 connector 인스턴스의 수명주기 오케스트레이션 (0161).
//
// 세 소유자를 순서대로 조율한다 — 저장소(설정) · registry(등록) · host(연결·도구).
// `features/connectors` 는 `features/auth-platform` 을 import 할 수 없으므로(main DAG)
// registry·host 를 **구조적 포트**로 받고 컴포지션 루트가 실제 객체를 주입한다.
//
// **순서가 계약이다.** 삭제에서 연결을 먼저 끊지 않고 등록을 해제하면 도구 서버가 살아남아
// "목록에는 없는데 모델은 계속 부를 수 있는" 상태가 된다.

import type { ConnectorInstance, ConnectorInstanceStore } from './instance-store'
import type { TemplatePackage } from '../../contracts/connector-template'
import type { ConnectorTemplateRegistry } from './templates'

// auth-platform 의 `AuthRegistry` 가 구조적으로 만족하는 최소 표면.
export interface InstanceRegistryPort {
  register(input: {
    manifest: unknown
    providers?: readonly never[]
    connectors?: readonly never[]
    runtimeTools?: readonly never[]
  }): ReadonlyArray<{ message: string }>
  unregister(pluginId: string): boolean
}

// `PluginHost` 가 구조적으로 만족하는 최소 표면.
export interface InstanceHostPort {
  // 연결돼 있으면 끊는다. 연결이 없으면 아무 일도 하지 않는다(멱등).
  disconnectIfConnected(connectorId: string): Promise<void>
}

export type CreateOutcome =
  | { ok: true; instance: ConnectorInstance }
  | {
      ok: false
      reason:
        'unknown_template' | 'invalid_input' | 'already_exists' | 'invalid_id' | 'register_failed'
      detail?: string
    }

export type DeleteOutcome =
  { ok: true } | { ok: false; reason: 'not_found' | 'not_deletable'; detail?: string }

export interface InstanceLifecycleDeps {
  store: ConnectorInstanceStore
  templates: ConnectorTemplateRegistry
  registry: InstanceRegistryPort
  host: InstanceHostPort
  logger?: (message: string, meta?: Record<string, unknown>) => void
}

export class ConnectorInstanceLifecycle {
  constructor(private readonly deps: InstanceLifecycleDeps) {}

  // 부팅 복원 — 템플릿 공용 패키지를 먼저 등록한 뒤 저장된 인스턴스를 얹는다.
  //
  // **공용이 먼저다.** 인스턴스 connector 는 공용 패키지의 provider 를 참조하므로, 순서가
  // 뒤집히면 `validateCrossReferences` 가 참조 실패를 낸다.
  //
  // 인스턴스 하나가 등록에 실패해도 **나머지는 계속 복원한다** — 설정 한 줄이 앱 전체의
  // connector 를 죽이면 안 된다.
  restore(): {
    registered: ConnectorInstance[]
    failed: Array<{ instance: ConnectorInstance; message: string }>
  } {
    for (const template of this.deps.templates.list()) {
      const errors = this.registerPackage(template.sharedPackage())
      if (errors.length > 0) {
        this.log('connector.template.shared.failed', { templateId: template.id, errors })
      }
    }

    const registered: ConnectorInstance[] = []
    const failed: Array<{ instance: ConnectorInstance; message: string }> = []
    for (const instance of this.deps.store.list()) {
      const template = this.deps.templates.get(instance.templateId)
      if (!template) {
        failed.push({ instance, message: `unknown template: ${instance.templateId}` })
        continue
      }
      const errors = this.registerPackage(template.instancePackage(instance))
      if (errors.length > 0) failed.push({ instance, message: errors[0].message })
      else registered.push(instance)
    }
    if (failed.length > 0) this.log('connector.instance.restore.partial', { failed: failed.length })
    return { registered, failed }
  }

  async create(input: {
    templateId: string
    label: string
    baseUrl: string
    apiBasePath?: string
  }): Promise<CreateOutcome> {
    const template = this.deps.templates.get(input.templateId)
    if (!template) return { ok: false, reason: 'unknown_template', detail: input.templateId }

    const created = this.deps.store.create(input)
    if (!created.ok) {
      return {
        ok: false,
        reason: created.reason,
        ...(created.detail !== undefined ? { detail: created.detail } : {})
      }
    }

    const errors = this.registerPackage(template.instancePackage(created.instance))
    if (errors.length > 0) {
      // 등록에 실패했으면 저장소도 되돌린다 — 재시작 때 같은 실패를 반복할 뿐인 유령
      // 인스턴스를 남기지 않는다.
      this.deps.store.remove(created.instance.connectorId)
      return { ok: false, reason: 'register_failed', detail: errors[0].message }
    }
    return { ok: true, instance: created.instance }
  }

  async remove(connectorId: string): Promise<DeleteOutcome> {
    const instance = this.deps.store.get(connectorId)
    // 저장소에 없으면 정적 connector 이거나 애초에 없는 것이다. 정적 connector 는 코드로
    // 배포된 서버라 UI 에서 지울 수 없다.
    if (!instance) return { ok: false, reason: 'not_found', detail: connectorId }

    // ① 연결·도구 회수 → ② 등록 해제 → ③ 저장소 제거. 순서가 뒤집히면 도구가 살아남는다.
    await this.deps.host.disconnectIfConnected(connectorId)
    this.deps.registry.unregister(connectorId)
    this.deps.store.remove(connectorId)
    return { ok: true }
  }

  // 사용자 생성 인스턴스인지 — DTO 의 `source` 판정과 삭제 가능 여부에 쓴다.
  isUserInstance(connectorId: string): boolean {
    return this.deps.store.get(connectorId) !== undefined
  }

  private registerPackage(pkg: TemplatePackage): ReadonlyArray<{ message: string }> {
    return this.deps.registry.register({
      manifest: pkg.manifest,
      ...(pkg.providers !== undefined ? { providers: pkg.providers as readonly never[] } : {}),
      ...(pkg.connectors !== undefined ? { connectors: pkg.connectors as readonly never[] } : {}),
      ...(pkg.runtimeTools !== undefined
        ? { runtimeTools: pkg.runtimeTools as readonly never[] }
        : {})
    })
  }

  private log(message: string, meta?: Record<string, unknown>): void {
    this.deps.logger?.(message, meta)
  }
}
