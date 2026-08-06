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

  // 패키지 단위 제거 (0161) — 사용자가 만든 connector 인스턴스를 지울 때 쓴다.
  //
  // 등록이 all-or-nothing 이듯 제거도 **4곳 일괄**이다(manifest·provider·connector·runtime tool).
  // 하나라도 남으면 "목록에는 없는데 도구는 살아 있는" 상태가 된다. 다른 패키지의 기여는
  // `pluginId` 로 걸러 보존한다 — 인스턴스 제거가 템플릿 공용 provider 를 지우면 안 된다.
  //
  // 제거 후 같은 pluginId 를 다시 등록할 수 있다(중복 거부에 걸리지 않는다) — 삭제 후
  // 같은 주소로 재생성하는 흐름이 성립하려면 필요하다.
  // 이 pluginId 가 이미 등록됐는가. 중복 등록은 registry 가 **거부**하므로, 두 경로가 같은
  // 패키지를 등록할 수 있는 자리(정적 등록 vs 템플릿 공용 패키지, 0164)에서는 부르기 전에
  // 물어야 한다 — 실패를 삼키는 대신.
  hasPlugin(pluginId: string): boolean {
    return this.manifests.has(pluginId)
  }

  unregister(pluginId: string): boolean {
    if (!this.manifests.has(pluginId)) return false
    this.manifests.delete(pluginId)
    removeByPluginId(this.providers, pluginId)
    removeByPluginId(this.connectors, pluginId)
    removeByPluginId(this.runtimeTools, pluginId)
    return true
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
    //
    // 세 종류가 **같은 검사**라서 한 번만 적는다 — 종류를 늘릴 때 한쪽 방향만 붙이고 다른
    // 쪽을 잊는 것이 이 블록의 실제 이력이다.
    const declaredProviders = new Set(manifest.contributes.authProviders.map((p) => p.id))
    const declaredConnectors = new Set(manifest.contributes.connectors.map((c) => c.id))
    const declaredRuntimeTools = new Set(manifest.contributes.runtimeTools.map((tool) => tool.id))

    const checkPairing = (
      declared: ReadonlySet<string>,
      implIds: readonly string[],
      messages: { orphanImpl: (id: string) => string; orphanDecl: (id: string) => string }
    ): void => {
      const impls = new Set(implIds)
      for (const id of implIds) {
        if (!declared.has(id)) err(messages.orphanImpl(id), id)
      }
      for (const id of declared) {
        if (!impls.has(id)) err(messages.orphanDecl(id), id)
      }
    }

    checkPairing(
      declaredProviders,
      providers.map((p) => p.descriptor.id),
      {
        orphanImpl: (id) => `manifest 에 선언되지 않은 auth provider 구현: ${id}`,
        orphanDecl: (id) => `선언된 auth provider 의 구현이 없습니다: ${id}`
      }
    )
    checkPairing(
      declaredConnectors,
      connectors.map((c) => c.descriptor.id),
      {
        orphanImpl: (id) => `manifest 에 선언되지 않은 connector 구현: ${id}`,
        orphanDecl: (id) => `선언된 connector 의 구현이 없습니다: ${id}`
      }
    )
    checkPairing(
      declaredRuntimeTools,
      runtimeTools.map((tool) => tool.descriptor.id),
      {
        orphanImpl: (id) => `runtime tool implementation has no manifest declaration: ${id}`,
        orphanDecl: (id) => `runtime tool declaration has no implementation: ${id}`
      }
    )

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
      // 선언과 구현이 같은 것을 말하는지 (0164 verify D4). connector·runtimeTools 는 이미
      // 전 필드를 대조하는데 provider 만 **id 존재 여부**만 봤다. 그 틈으로 "manifest 는
      // connector 전용이라 선언했는데 구현은 application 까지 여는" 불일치가 통과했고,
      // 그 결과 서버가 0개인 설치에서도 prod 로그인 게이트가 켜졌다(D1).
      const declaredProvider = manifest.contributes.authProviders.find(
        (declared) => declared.id === p.descriptor.id
      )
      if (declaredProvider && !sameProviderDescriptor(declaredProvider, p.descriptor)) {
        err(`auth provider descriptor 가 manifest 와 다릅니다: ${p.descriptor.id}`, p.descriptor.id)
      }
      // 중복 id — last-writer-wins override 금지.
      if (this.providers.has(p.descriptor.id)) {
        err(`이미 등록된 auth provider id 입니다: ${p.descriptor.id}`, p.descriptor.id)
      }
      // 4메서드가 전부 있는지. 계약상 required 지만 선언형 어댑터가 만든 객체도 받으므로
      // 런타임에서도 확인한다(AUTH-PLAT-002).
      for (const method of ['begin', 'continue', 'status', 'logout'] as const) {
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
        err(
          `runtime tool connectorId is not declared by this package: ${descriptor.connectorId}`,
          descriptor.id
        )
      }
      const duplicateToolName = firstDuplicate(descriptor.tools.map((tool) => tool.name))
      if (duplicateToolName) {
        err(`runtime tool descriptor has duplicate tool name: ${duplicateToolName}`, descriptor.id)
      }
      if (
        this.runtimeTools.has(descriptor.id) ||
        hasDuplicateRuntimeToolId(runtimeTools, descriptor.id)
      ) {
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

  // 앱 로그인 체인 (0172) — **같은 패키지가 선언한 application provider 들이 하나의 로그인**이다.
  //
  // 순서의 진실원은 manifest `contributes.authProviders` 배열이다. 등록 시 선언과 구현을 전 필드
  // 대조하므로(위 `sameProviderDescriptor`) 선언 순서를 쓰면 구현과 갈릴 수 없다 — provider Map 의
  // 삽입 순서를 쓰면 같은 패키지의 기여가 여러 경로로 들어올 때 순서가 흔들린다.
  //
  // `application` 을 지원하지 않는 provider(=서비스 연결 전용)는 체인 멤버가 아니다. connector
  // 연결은 사용자가 방식 하나를 **고르는** 흐름이라 순차 강제가 의미를 뒤집는다.
  loginChainFor(providerId: string): AuthProviderV1[] {
    const head = this.providers.get(providerId)
    if (!head) return []
    if (!head.descriptor.targets.includes('application')) return [head]

    const manifest = this.manifests.get(head.descriptor.pluginId)
    if (!manifest) return [head]

    const chain = manifest.contributes.authProviders
      .map((declared) => this.providers.get(declared.id))
      // 선언됐지만 미등록인 id 는 건너뛴다. 등록이 all-or-nothing 이라 실제로는 발생하지 않지만,
      // 없는 멤버를 체인에 넣으면 로그인이 영원히 완결되지 않는다.
      .filter(
        (provider): provider is AuthProviderV1 =>
          provider !== undefined && provider.descriptor.targets.includes('application')
      )
    return chain.length > 0 ? chain : [head]
  }

  registrationErrors(): RegistrationError[] {
    return [...this.errors]
  }
}

// **targets 가 핵심이다** — 여기가 앱 로그인 게이트(`broker.status().required`)를 켜는 스위치다.
// label·mechanisms·capabilities 도 함께 본다: 화면 표기와 lifecycle 선언이 어긋나면 사용자가
// 보는 것과 실제로 일어나는 일이 갈린다. `allowedOrigins`·`sessionGroup` 은 manifest 가 기본값
// (빈 배열/미지정)을 채우는 필드라 대조 대상에서 뺀다.
function sameProviderDescriptor(
  declared: PluginManifest['contributes']['authProviders'][number],
  actual: AuthProviderV1['descriptor']
): boolean {
  return (
    declared.id === actual.id &&
    declared.apiVersion === actual.apiVersion &&
    declared.label === actual.label &&
    sameSortedStrings(declared.targets, actual.targets) &&
    sameSortedStrings(declared.mechanisms, actual.mechanisms) &&
    sameSortedStrings(declared.capabilities, actual.capabilities)
  )
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
    sameValue(declared.presentation, actual.presentation) &&
    // 선언·구현 한쪽만 presentations 를 가지면 등록 단계에서 거부한다. 이 필드가 어긋나면
    // 어떤 mechanism 이 어떤 헤더로 나가는지가 문서와 코드에서 갈린다(0160).
    sameValue(declared.presentations, actual.presentations)
  )
}

function sameRuntimeToolDescriptor(
  declared: RuntimeToolManifestContribution,
  actual: RuntimeToolDescriptor
): boolean {
  const declaredTools = [...declared.tools].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
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

// descriptor.pluginId 가 일치하는 기여만 제거한다. `manifest.id === descriptor.pluginId` 는
// 등록 단계에서 이미 강제되므로 이 필터가 곧 "그 패키지의 기여" 다.
function removeByPluginId<T extends { descriptor: { pluginId: string } }>(
  map: Map<string, T>,
  pluginId: string
): void {
  for (const [id, entry] of map) {
    if (entry.descriptor.pluginId === pluginId) map.delete(id)
  }
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
