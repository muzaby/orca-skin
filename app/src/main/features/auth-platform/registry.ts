// 인증 방식 · 대상 레지스트리 (0157 → 0178 축소).
//
// **형태 강제는 타입 시스템이 한다.** 등록 배열이 계약을 만족하는지는 컴파일 타임에 끝나므로
// 여기서 다시 검사하지 않는다. 0178 이전에는 zod manifest(170줄) + 선언↔구현 전 필드 대조 +
// `apiVersion` ABI + 메서드 존재 확인이 등록 경로에 있었는데, 그 전부가 **컴파일 타임에 이미
// 참인 명제**를 런타임에 재확인하는 것이었다.
//
// 런타임에 남는 판정은 **타입으로 표현할 수 없는 것 둘**뿐이다:
//
//   1. **중복 id 거부** — 같은 id 를 두 곳이 기여했는지는 배열을 합쳐봐야 안다.
//      의도적 비채택: OpenCode 의 last-writer-wins override. 폐쇄망 보안 태세에서 로드 순서로
//      인증 구현이 조용히 갈리는 것은 사고 경로다 — 중복은 **거부**한다.
//   2. **origin 형태** — `allowedOrigins`·`baseUrl` 의 원소가 경로 없는 origin 인지는 타입이
//      말해주지 않는다. 틀리면 요청이 조용히 전부 거부돼 디버깅이 어려우므로 등록에서 잡는다.

import type { AuthMethod } from '../../contracts/auth-method'
import type { ConnectorRuntime } from '../../contracts/connector'
import type { RuntimeToolContribution } from '../../adapters/runtime-tools'
import type { AuthProviderInfo, AuthTargetKind } from '../../../shared/ipc'
import { isBareOrigin } from '../../../shared/connector-address'

export interface RegistrationError {
  // 거부된 대상 — 인증 방식 id 또는 대상 id.
  subject: string
  message: string
}

// 한 배포 단위가 기여하는 **대상**. 인증 방식은 내장 목록(`methods/index.ts`)이 소유하므로
// 여기 없다 — 0178 이전에는 모듈마다 자기 provider 를 만들어 붙였고, 그래서 위키와 사용량이
// 글자까지 같은 PAT/ID·비밀번호 구현을 각각 한 벌씩 들고 있었다.
export interface ConnectorPackage {
  connectors?: readonly ConnectorRuntime[]
  runtimeTools?: readonly RuntimeToolContribution[]
}

export class AuthRegistry {
  private readonly methods = new Map<string, AuthMethod>()
  private readonly connectors = new Map<string, ConnectorRuntime>()
  private readonly runtimeTools = new Map<string, RuntimeToolContribution>()
  // groupId → 그 그룹이 기여한 방식 id (등록 순서). 로그인 체인의 순서 출처다.
  private readonly methodsByGroup = new Map<string, string[]>()
  private readonly errors: RegistrationError[] = []

  // 내장 인증 방식 등록. 거부된 방식은 **그것만** 빠진다 — 방식끼리는 독립이라 하나의 오설정이
  // 다른 방식을 끌고 들어갈 이유가 없다.
  registerMethods(methods: readonly AuthMethod[]): RegistrationError[] {
    const errs: RegistrationError[] = []
    for (const method of methods) {
      const d = method.descriptor
      const bad = this.methods.has(d.id)
        ? `이미 등록된 인증 방식 id 입니다: ${d.id}`
        : d.allowedOrigins.find((origin) => !isBareOrigin(origin)) !== undefined
          ? `allowedOrigins 는 경로 없는 origin 이어야 합니다: ${d.allowedOrigins.join(', ')}`
          : null
      if (bad !== null) {
        errs.push({ subject: d.id, message: bad })
        continue
      }
      this.methods.set(d.id, method)
      const siblings = this.methodsByGroup.get(d.groupId) ?? []
      siblings.push(d.id)
      this.methodsByGroup.set(d.groupId, siblings)
    }
    this.errors.push(...errs)
    return errs
  }

  // 대상 패키지 등록. 하나라도 문제가 있으면 **그 패키지 전체를 거부**한다 — 반쯤 등록된
  // 상태가 남으면 어떤 대상이 살아 있는지 추론해야 해서 더 위험하다.
  register(pkg: ConnectorPackage): RegistrationError[] {
    const errs = this.validate(pkg)
    if (errs.length > 0) {
      this.errors.push(...errs)
      return errs
    }
    for (const connector of pkg.connectors ?? []) {
      this.connectors.set(connector.descriptor.id, connector)
    }
    for (const runtimeTool of pkg.runtimeTools ?? []) {
      this.runtimeTools.set(runtimeTool.descriptor.id, runtimeTool)
    }
    return []
  }

  private validate(pkg: ConnectorPackage): RegistrationError[] {
    const errs: RegistrationError[] = []
    const seen = new Set<string>()
    const claim = (id: string, taken: boolean, kind: string): void => {
      if (taken || seen.has(id)) {
        errs.push({ subject: id, message: `이미 등록된 ${kind} id 입니다: ${id}` })
      }
      seen.add(id)
    }

    for (const c of pkg.connectors ?? []) {
      const d = c.descriptor
      claim(d.id, this.connectors.has(d.id), '대상')
      if (!isBareOrigin(d.baseUrl)) {
        errs.push({
          subject: d.id,
          message: `baseUrl 은 경로 없는 origin 이어야 합니다: ${d.baseUrl}`
        })
      }
    }
    for (const tool of pkg.runtimeTools ?? []) {
      const d = tool.descriptor
      claim(d.id, this.runtimeTools.has(d.id), 'runtime tool')
      const duplicate = firstDuplicate(d.tools.map((t) => t.name))
      if (duplicate !== null) {
        errs.push({ subject: d.id, message: `runtime tool 이름이 중복입니다: ${duplicate}` })
      }
    }
    return errs
  }

  getMethod(methodId: string): AuthMethod | undefined {
    return this.methods.get(methodId)
  }

  getConnector(connectorId: string): ConnectorRuntime | undefined {
    return this.connectors.get(connectorId)
  }

  // 등록이 모두 끝난 뒤 호출 — 대상이 참조하는 인증 방식이 실재하는지 확인한다.
  validateCrossReferences(): RegistrationError[] {
    const errs: RegistrationError[] = []
    for (const connector of this.connectors.values()) {
      for (const methodId of connector.descriptor.acceptedMethods) {
        if (!this.methods.has(methodId)) {
          errs.push({
            subject: connector.descriptor.id,
            message: `acceptedMethods 가 존재하지 않는 인증 방식을 참조합니다: ${methodId}`
          })
        }
      }
    }
    this.errors.push(...errs)
    return errs
  }

  listMethods(): AuthMethod[] {
    return [...this.methods.values()]
  }

  listConnectors(): ConnectorRuntime[] {
    return [...this.connectors.values()]
  }

  listRuntimeTools(): RuntimeToolContribution[] {
    return [...this.runtimeTools.values()]
  }

  listRuntimeToolsForConnector(connectorId: string): RuntimeToolContribution[] {
    return this.listRuntimeTools().filter((tool) => tool.descriptor.connectorId === connectorId)
  }

  // renderer 노출형. secret 도 allowedOrigins 도 내보내지 않는다.
  describeMethods(): AuthProviderInfo[] {
    return this.listMethods().map((m) => ({
      id: m.descriptor.id,
      label: m.descriptor.label,
      targets: [...m.descriptor.targets],
      mechanisms: [...m.descriptor.mechanisms],
      ...(m.descriptor.sessionGroup !== undefined
        ? { sessionGroup: m.descriptor.sessionGroup }
        : {})
    }))
  }

  // 해당 target 종류를 지원하는 방식만.
  methodsForTarget(kind: AuthTargetKind): AuthMethod[] {
    return this.listMethods().filter((m) => m.descriptor.targets.includes(kind))
  }

  // 앱 로그인 체인 (0172) — **같은 그룹이 기여한 application 방식들이 하나의 로그인**이다.
  // 순서의 진실원은 등록 배열 순서다(선언이 한 벌이므로 갈릴 수 없다).
  //
  // `application` 을 지원하지 않는 방식(=서비스 연결 전용)은 체인 멤버가 아니다. 서비스 연결은
  // 사용자가 방식 하나를 **고르는** 흐름이라 순차 강제가 의미를 뒤집는다.
  loginChainFor(methodId: string): AuthMethod[] {
    const head = this.methods.get(methodId)
    if (!head) return []
    if (!head.descriptor.targets.includes('application')) return [head]

    const chain = (this.methodsByGroup.get(head.descriptor.groupId) ?? [])
      .map((id) => this.methods.get(id))
      .filter(
        (method): method is AuthMethod =>
          method !== undefined && method.descriptor.targets.includes('application')
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
