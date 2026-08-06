// Auth provider · connector 레지스트리 (0157 → 0178 축소).
//
// **형태 강제는 타입 시스템이 한다.** 등록 배열이 계약을 만족하는지는 컴파일 타임에 끝나므로
// 여기서 다시 검사하지 않는다. 0178 이전에는 zod manifest(`manifest.ts` 170줄) + 선언↔구현 전
// 필드 대조 + `apiVersion` ABI + 메서드 존재 확인이 등록 경로에 있었는데, 그 전부가 **컴파일
// 타임에 이미 참인 명제**를 런타임에 재확인하는 것이었다. 선언을 두 벌 적게 만든 것도 그 검사
// 자신이었고(`declare.ts` 가 그 드리프트를 막으려 존재했다), 검사가 사라지면 두 벌도 사라진다.
//
// 런타임에 남는 판정은 **타입으로 표현할 수 없는 것 둘**뿐이다:
//
//   1. **중복 id 거부** — 같은 id 를 두 패키지가 기여했는지는 배열을 합쳐봐야 안다.
//      의도적 비채택: OpenCode 의 last-writer-wins override. 폐쇄망 보안 태세에서 로드 순서로
//      인증 구현이 조용히 갈리는 것은 사고 경로다 — 중복은 **거부**한다.
//   2. **origin 형태** — `allowedOrigins: string[]` 의 원소가 경로 없는 origin 인지는 타입이
//      말해주지 않는다. 틀리면 요청이 조용히 전부 거부돼 디버깅이 어려우므로 등록에서 잡는다.

import type { AuthProviderV1 } from '../../contracts/auth-plugin'
import type { ConnectorRuntimeV1 } from '../../contracts/connector-plugin'
import type { RuntimeToolContribution } from '../../adapters/runtime-tools'
import type { AuthProviderInfo, AuthTargetKind } from '../../../shared/ipc'
import { isBareOrigin } from '../../../shared/connector-address'

export interface RegistrationError {
  pluginId: string
  contributionId?: string
  message: string
}

// 한 배포 단위. manifest 가 없다 — 구현체가 곧 선언이다.
export interface AuthPackage {
  providers?: readonly AuthProviderV1[]
  connectors?: readonly ConnectorRuntimeV1[]
  runtimeTools?: readonly RuntimeToolContribution[]
}

export class AuthRegistry {
  private readonly providers = new Map<string, AuthProviderV1>()
  private readonly connectors = new Map<string, ConnectorRuntimeV1>()
  private readonly runtimeTools = new Map<string, RuntimeToolContribution>()
  // pluginId → 그 패키지가 기여한 provider id (등록 순서). 로그인 체인의 순서 출처다.
  private readonly providersByPlugin = new Map<string, string[]>()
  private readonly errors: RegistrationError[] = []

  // 패키지 단위 등록. 하나라도 문제가 있으면 **그 패키지 전체를 거부**한다 — 반쯤 등록된
  // 상태가 남으면 어떤 provider 가 살아 있는지 추론해야 해서 더 위험하다.
  register(pkg: AuthPackage): RegistrationError[] {
    const errs = this.validate(pkg)
    if (errs.length > 0) {
      this.errors.push(...errs)
      return errs
    }
    for (const provider of pkg.providers ?? []) {
      this.providers.set(provider.descriptor.id, provider)
      const siblings = this.providersByPlugin.get(provider.descriptor.pluginId) ?? []
      siblings.push(provider.descriptor.id)
      this.providersByPlugin.set(provider.descriptor.pluginId, siblings)
    }
    for (const connector of pkg.connectors ?? []) {
      this.connectors.set(connector.descriptor.id, connector)
    }
    for (const runtimeTool of pkg.runtimeTools ?? []) {
      this.runtimeTools.set(runtimeTool.descriptor.id, runtimeTool)
    }
    return []
  }

  private validate(pkg: AuthPackage): RegistrationError[] {
    const errs: RegistrationError[] = []
    const seen = new Set<string>()
    const claim = (id: string, pluginId: string, taken: boolean, kind: string): void => {
      if (taken || seen.has(id)) {
        errs.push({ pluginId, contributionId: id, message: `이미 등록된 ${kind} id 입니다: ${id}` })
      }
      seen.add(id)
    }

    for (const p of pkg.providers ?? []) {
      const d = p.descriptor
      claim(d.id, d.pluginId, this.providers.has(d.id), 'auth provider')
      for (const origin of d.allowedOrigins) {
        if (!isBareOrigin(origin)) {
          errs.push({
            pluginId: d.pluginId,
            contributionId: d.id,
            message: `allowedOrigins 는 경로 없는 origin 이어야 합니다: ${origin}`
          })
        }
      }
    }
    for (const c of pkg.connectors ?? []) {
      const d = c.descriptor
      claim(d.id, d.pluginId, this.connectors.has(d.id), 'connector')
      if (!isBareOrigin(d.baseUrl)) {
        errs.push({
          pluginId: d.pluginId,
          contributionId: d.id,
          message: `baseUrl 은 경로 없는 origin 이어야 합니다: ${d.baseUrl}`
        })
      }
    }
    for (const tool of pkg.runtimeTools ?? []) {
      const d = tool.descriptor
      claim(d.id, d.pluginId, this.runtimeTools.has(d.id), 'runtime tool')
      const duplicate = firstDuplicate(d.tools.map((t) => t.name))
      if (duplicate !== null) {
        errs.push({
          pluginId: d.pluginId,
          contributionId: d.id,
          message: `runtime tool 이름이 중복입니다: ${duplicate}`
        })
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

  // 앱 로그인 체인 (0172) — **같은 패키지가 기여한 application provider 들이 하나의 로그인**이다.
  //
  // 순서의 진실원은 그 패키지의 **등록 배열 순서**다. 0178 이전에는 manifest 선언 순서였는데,
  // manifest 가 사라지면서 구현 배열이 유일한 순서가 됐다 — 두 벌이 아니므로 갈릴 수 없다.
  //
  // `application` 을 지원하지 않는 provider(=서비스 연결 전용)는 체인 멤버가 아니다. connector
  // 연결은 사용자가 방식 하나를 **고르는** 흐름이라 순차 강제가 의미를 뒤집는다.
  loginChainFor(providerId: string): AuthProviderV1[] {
    const head = this.providers.get(providerId)
    if (!head) return []
    if (!head.descriptor.targets.includes('application')) return [head]

    const chain = (this.providersByPlugin.get(head.descriptor.pluginId) ?? [])
      .map((id) => this.providers.get(id))
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

function firstDuplicate(values: readonly string[]): string | null {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) return value
    seen.add(value)
  }
  return null
}
