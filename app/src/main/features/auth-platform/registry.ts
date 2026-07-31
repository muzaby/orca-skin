// Auth provider · connector 레지스트리 (0157).
//
// **등록 위생의 단일 지점** — built-in 도 예외 API 를 갖지 않고 같은 manifest·ABI 검사를
// 통과한다(AUTH-PLAT-012). 여기 판정이 모여 있어야 provider 를 늘려도 core 의 분기가 늘지 않는다.
//
// 의도적 비채택: OpenCode 의 **last-writer-wins override**(`auth-override.test.ts` 가 고정한
// "같은 provider id 면 마지막 훅이 이긴다"). 폐쇄망 보안 태세에서 로드 순서로 인증 구현이 조용히
// 갈리는 것은 사고 경로다 — 중복은 **거부**한다.

import type { AuthProviderV1 } from '../../contracts/auth-plugin'
import type { ConnectorRuntimeV1 } from '../../contracts/connector-plugin'
import type { AuthProviderInfo, AuthTargetKind } from '../../../shared/ipc'
import { AUTH_PLUGIN_API_VERSION, parsePluginManifest, type PluginManifest } from './manifest'

export interface RegistrationError {
  pluginId: string
  contributionId?: string
  message: string
}

export interface RegisterPackageInput {
  manifest: unknown
  providers?: readonly AuthProviderV1[]
  connectors?: readonly ConnectorRuntimeV1[]
}

export class AuthRegistry {
  private readonly providers = new Map<string, AuthProviderV1>()
  private readonly connectors = new Map<string, ConnectorRuntimeV1>()
  private readonly manifests = new Map<string, PluginManifest>()
  private readonly errors: RegistrationError[] = []

  // 패키지 단위 등록. 하나라도 문제가 있으면 **그 패키지 전체를 거부**한다 — 반쯤 등록된
  // 상태가 남으면 어떤 provider 가 살아 있는지 추론해야 해서 더 위험하다.
  register(input: RegisterPackageInput): RegistrationError[] {
    const parsed = parsePluginManifest(input.manifest)
    if (!parsed.ok) {
      const errs = parsed.errors.map((message) => ({ pluginId: '<unparsed>', message }))
      this.errors.push(...errs)
      return errs
    }
    const manifest = parsed.manifest
    const errs = this.validatePackage(manifest, input)
    if (errs.length > 0) {
      this.errors.push(...errs)
      return errs
    }
    this.manifests.set(manifest.id, manifest)
    for (const provider of input.providers ?? []) {
      this.providers.set(provider.descriptor.id, provider)
    }
    for (const connector of input.connectors ?? []) {
      this.connectors.set(connector.descriptor.id, connector)
    }
    return []
  }

  private validatePackage(
    manifest: PluginManifest,
    input: RegisterPackageInput
  ): RegistrationError[] {
    const errs: RegistrationError[] = []
    const err = (message: string, contributionId?: string): void => {
      errs.push({ pluginId: manifest.id, message, ...(contributionId ? { contributionId } : {}) })
    }

    if (this.manifests.has(manifest.id)) {
      err(`이미 등록된 pluginId 입니다: ${manifest.id}`)
    }

    const providers = input.providers ?? []
    const connectors = input.connectors ?? []

    // manifest 선언과 실제 구현체가 1:1 인지. 선언만 있고 구현이 없으면 런타임에 조용히 빈
    // provider 가 되고, 구현만 있고 선언이 없으면 capability·origin 검사를 우회한다.
    const declaredProviders = new Set(manifest.contributes.authProviders.map((p) => p.id))
    const declaredConnectors = new Set(manifest.contributes.connectors.map((c) => c.id))
    for (const p of providers) {
      if (!declaredProviders.has(p.descriptor.id)) {
        err(`manifest 에 선언되지 않은 auth provider 구현: ${p.descriptor.id}`, p.descriptor.id)
      }
    }
    for (const c of connectors) {
      if (!declaredConnectors.has(c.descriptor.id)) {
        err(`manifest 에 선언되지 않은 connector 구현: ${c.descriptor.id}`, c.descriptor.id)
      }
    }
    const implProviders = new Set(providers.map((p) => p.descriptor.id))
    for (const id of declaredProviders) {
      if (!implProviders.has(id)) err(`선언된 auth provider 의 구현이 없습니다: ${id}`, id)
    }
    const implConnectors = new Set(connectors.map((c) => c.descriptor.id))
    for (const id of declaredConnectors) {
      if (!implConnectors.has(id)) err(`선언된 connector 의 구현이 없습니다: ${id}`, id)
    }

    // ABI 버전 — 불일치는 등록 단계에서 거부 (AUTH-PLAT-014).
    for (const p of providers) {
      if (p.descriptor.apiVersion !== AUTH_PLUGIN_API_VERSION) {
        err(`지원하지 않는 apiVersion: ${p.descriptor.apiVersion}`, p.descriptor.id)
      }
      if (p.descriptor.pluginId !== manifest.id) {
        err(
          `descriptor.pluginId 가 manifest 와 다릅니다: ${p.descriptor.pluginId}`,
          p.descriptor.id
        )
      }
      // 중복 id — last-writer-wins override 금지.
      if (this.providers.has(p.descriptor.id)) {
        err(`이미 등록된 auth provider id 입니다: ${p.descriptor.id}`, p.descriptor.id)
      }
      // 5메서드가 전부 있는지. 계약상 required 지만 선언형 어댑터가 만든 객체도 받으므로
      // 런타임에서도 확인한다(AUTH-PLAT-002).
      for (const method of ['begin', 'continue', 'status', 'refresh', 'logout'] as const) {
        if (typeof p[method] !== 'function') {
          err(`AuthProviderV1.${method} 가 구현되지 않았습니다`, p.descriptor.id)
        }
      }
    }
    for (const c of connectors) {
      if (c.descriptor.apiVersion !== AUTH_PLUGIN_API_VERSION) {
        err(`지원하지 않는 apiVersion: ${c.descriptor.apiVersion}`, c.descriptor.id)
      }
      if (this.connectors.has(c.descriptor.id)) {
        err(`이미 등록된 connector id 입니다: ${c.descriptor.id}`, c.descriptor.id)
      }
    }
    return errs
  }

  getProvider(providerId: string): AuthProviderV1 | undefined {
    return this.providers.get(providerId)
  }

  getConnector(connectorId: string): ConnectorRuntimeV1 | undefined {
    return this.connectors.get(connectorId)
  }

  // 등록이 모두 끝난 뒤 호출 — connector 가 참조하는 auth provider 가 실재하는지 확인한다.
  // 패키지 등록 시점에는 아직 등록되지 않은 provider 를 참조할 수 있어 여기서 뒤늦게 본다.
  validateCrossReferences(): RegistrationError[] {
    const errs: RegistrationError[] = []
    for (const connector of this.connectors.values()) {
      for (const providerId of connector.descriptor.acceptedAuthProviders) {
        if (!this.providers.has(providerId)) {
          errs.push({
            pluginId: connector.descriptor.pluginId,
            contributionId: connector.descriptor.id,
            message: `acceptedAuthProviders 가 존재하지 않는 provider 를 참조합니다: ${providerId}`
          })
        }
      }
    }
    this.errors.push(...errs)
    return errs
  }

  listProviders(): AuthProviderV1[] {
    return [...this.providers.values()]
  }

  listConnectors(): ConnectorRuntimeV1[] {
    return [...this.connectors.values()]
  }

  // renderer 노출형. secret 도 allowedOrigins 도 내보내지 않는다.
  describeProviders(): AuthProviderInfo[] {
    return this.listProviders().map((p) => ({
      id: p.descriptor.id,
      pluginId: p.descriptor.pluginId,
      apiVersion: p.descriptor.apiVersion,
      label: p.descriptor.label,
      targets: [...p.descriptor.targets],
      mechanisms: [...p.descriptor.mechanisms],
      capabilities: [...p.descriptor.capabilities],
      ...(p.descriptor.sessionGroup !== undefined
        ? { sessionGroup: p.descriptor.sessionGroup }
        : {})
    }))
  }

  // 해당 target 종류를 지원하는 provider 만.
  providersForTarget(kind: AuthTargetKind): AuthProviderV1[] {
    return this.listProviders().filter((p) => p.descriptor.targets.includes(kind))
  }

  registrationErrors(): RegistrationError[] {
    return [...this.errors]
  }
}
