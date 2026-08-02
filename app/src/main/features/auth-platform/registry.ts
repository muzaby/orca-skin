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
import type { RuntimeToolContribution, RuntimeToolDescriptor } from '../../adapters/runtime-tools'
import type { AuthProviderInfo, AuthTargetKind } from '../../../shared/ipc'
import {
  AUTH_PLUGIN_API_VERSION,
  parsePluginManifest,
  type PluginManifest,
  type RuntimeToolManifestContribution
} from './manifest'

export interface RegistrationError {
  pluginId: string
  contributionId?: string
  message: string
}

export interface RegisterPackageInput {
  manifest: unknown
  providers?: readonly AuthProviderV1[]
  connectors?: readonly ConnectorRuntimeV1[]
  runtimeTools?: readonly RuntimeToolContribution[]
}

export class AuthRegistry {
  private readonly providers = new Map<string, AuthProviderV1>()
  private readonly connectors = new Map<string, ConnectorRuntimeV1>()
  private readonly runtimeTools = new Map<string, RuntimeToolContribution>()
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
    for (const runtimeTool of input.runtimeTools ?? []) {
      this.runtimeTools.set(runtimeTool.descriptor.id, runtimeTool)
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
    const runtimeTools = input.runtimeTools ?? []

    // manifest 선언과 실제 구현체가 1:1 인지. 선언만 있고 구현이 없으면 런타임에 조용히 빈
    // provider 가 되고, 구현만 있고 선언이 없으면 capability·origin 검사를 우회한다.
    const declaredProviders = new Set(manifest.contributes.authProviders.map((p) => p.id))
    const declaredConnectors = new Set(manifest.contributes.connectors.map((c) => c.id))
    const declaredRuntimeTools = new Set(manifest.contributes.runtimeTools.map((tool) => tool.id))
    const implRuntimeTools = new Set(runtimeTools.map((tool) => tool.descriptor.id))
    for (const id of declaredRuntimeTools) {
      if (!implRuntimeTools.has(id)) {
        err(`runtime tool declaration has no implementation: ${id}`, id)
      }
    }

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
    for (const runtimeTool of runtimeTools) {
      if (!declaredRuntimeTools.has(runtimeTool.descriptor.id)) {
        err(
          `runtime tool implementation has no manifest declaration: ${runtimeTool.descriptor.id}`,
          runtimeTool.descriptor.id
        )
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
      if (c.descriptor.pluginId !== manifest.id) {
        err(
          `connector descriptor pluginId does not match manifest: ${c.descriptor.pluginId}`,
          c.descriptor.id
        )
      }
      const declaredConnector = manifest.contributes.connectors.find(
        (connector) => connector.id === c.descriptor.id
      )
      if (declaredConnector && !sameConnectorDescriptor(declaredConnector, c.descriptor)) {
        err(`connector descriptor does not match manifest: ${c.descriptor.id}`, c.descriptor.id)
      }
      if (this.connectors.has(c.descriptor.id)) {
        err(`이미 등록된 connector id 입니다: ${c.descriptor.id}`, c.descriptor.id)
      }
    }
    for (const runtimeTool of runtimeTools) {
      const descriptor = runtimeTool.descriptor
      if (descriptor.apiVersion !== AUTH_PLUGIN_API_VERSION) {
        err(`unsupported runtime tool apiVersion: ${descriptor.apiVersion}`, descriptor.id)
      }
      if (descriptor.pluginId !== manifest.id) {
        err(`runtime tool pluginId does not match manifest: ${descriptor.pluginId}`, descriptor.id)
      }
      const declaredRuntimeTool = manifest.contributes.runtimeTools.find(
        (tool) => tool.id === descriptor.id
      )
      if (declaredRuntimeTool && !sameRuntimeToolDescriptor(declaredRuntimeTool, descriptor)) {
        err(`runtime tool descriptor does not match manifest: ${descriptor.id}`, descriptor.id)
      }
      if (!declaredConnectors.has(descriptor.connectorId)) {
        err(`runtime tool connectorId is not declared by this package: ${descriptor.connectorId}`, descriptor.id)
      }
      const duplicateToolName = firstDuplicate(descriptor.tools.map((tool) => tool.name))
      if (duplicateToolName) {
        err(`runtime tool descriptor has duplicate tool name: ${duplicateToolName}`, descriptor.id)
      }
      if (this.runtimeTools.has(descriptor.id) || hasDuplicateRuntimeToolId(runtimeTools, descriptor.id)) {
        err(`runtime tool id is already registered: ${descriptor.id}`, descriptor.id)
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

  getRuntimeTool(runtimeToolId: string): RuntimeToolContribution | undefined {
    return this.runtimeTools.get(runtimeToolId)
  }

  listRuntimeTools(): RuntimeToolContribution[] {
    return [...this.runtimeTools.values()]
  }

  listRuntimeToolsForConnector(connectorId: string): RuntimeToolContribution[] {
    return this.listRuntimeTools().filter((tool) => tool.descriptor.connectorId === connectorId)
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

function sameConnectorDescriptor(
  declared: PluginManifest['contributes']['connectors'][number],
  actual: ConnectorRuntimeV1['descriptor']
): boolean {
  return (
    declared.id === actual.id &&
    declared.apiVersion === actual.apiVersion &&
    declared.label === actual.label &&
    sameSortedStrings(declared.acceptedAuthProviders, actual.acceptedAuthProviders) &&
    declared.baseUrl === actual.baseUrl &&
    sameValue(declared.presentation, actual.presentation)
  )
}

function sameRuntimeToolDescriptor(
  declared: RuntimeToolManifestContribution,
  actual: RuntimeToolDescriptor
): boolean {
  const declaredTools = [...declared.tools].sort((left, right) => left.name.localeCompare(right.name))
  const actualTools = [...actual.tools].sort((left, right) => left.name.localeCompare(right.name))
  return (
    declared.id === actual.id &&
    declared.connectorId === actual.connectorId &&
    declared.apiVersion === actual.apiVersion &&
    declared.alwaysLoad === actual.alwaysLoad &&
    declared.instructions === actual.instructions &&
    declaredTools.length === actualTools.length &&
    declaredTools.every((tool, index) => {
      const implementation = actualTools[index]
      return (
        tool.name === implementation.name &&
        tool.description === implementation.description &&
        sameValue(tool.annotations, implementation.annotations)
      )
    })
  )
}

function sameSortedStrings(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.every((value, index) => value === sortedRight[index])
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortObjectKeys(left)) === JSON.stringify(sortObjectKeys(right))
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys)
  if (value === null || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortObjectKeys(item)])
  )
}

function firstDuplicate(values: readonly string[]): string | null {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) return value
    seen.add(value)
  }
  return null
}

function hasDuplicateRuntimeToolId(
  runtimeTools: readonly RuntimeToolContribution[],
  runtimeToolId: string
): boolean {
  return runtimeTools.filter((tool) => tool.descriptor.id === runtimeToolId).length > 1
}
