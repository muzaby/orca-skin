// Plugin 배선 (0188 — 구 `features/providers/declarations/service.ts` + `service/index.ts`).
//
// Confluence 는 Auth 의 service contribution 이 아니라 **독립 Plugin** 이다. Plugin 모듈은
// `PluginAuth` 하나로 조립되고, Runtime Tool 서버를 **한 번만** 만든다. 전송이 HTTP 가 아닌
// Plugin(POP3 mail)만 전송 한 벌을 **이름 있는 두 번째 인자**로 더 받는다 — 그 갈래는 시그니처
// 에서 보이고, 배포가 무엇을 더 줘야 하는지도 거기서 읽힌다(0237 D-050).
//
// ── 왜 범용 registrar 를 만들지 않는가 ───────────────────────────────────────
// 0181 의 `ServiceToolRegistrar` 는 `Provider[]` 를 받아 `provider.tools` 를 훑는 일반화된
// 등록자였다. 그 일반화는 `Provider` 계약에 `tools` 슬롯이 있어야만 성립한다 — 슬롯을 없앤
// 지금은 배포가 자기 Plugin 을 직접 조립하는 것이 더 짧고, 형상도 타입으로 잡힌다.
// **PluginHost·ConnectorRegistry·ContributionRegistry 를 다시 만들지 않는다.**
//
// ── 같은 인스턴스를 재사용해야 하는 이유 ─────────────────────────────────────
// `RuntimeToolRegistry` 의 동등성 검사는 **handler identity** 까지 본다(실행 값이라 복사하지
// 않는다). sync 마다 서버를 새로 만들면 형상이 같아도 revision 이 올라 다음 턴이 런타임을
// 재spawn 한다. 그래서 서버는 부팅에서 1회 만들고 `sync` 는 add/remove 만 한다.

import type { RuntimeToolServer, RuntimeToolSink } from '../../adapters/runtime-tools'
import { runtimeToolFullName } from '../../adapters/runtime-tool-policy'
import type { AuthBinder, AuthId, BoundAuth, CredentialMaterial } from '../../contracts/auth'
import {
  normalizePluginCatalogPresentation,
  type PluginCatalogPresentation,
  type PluginCatalogPresentationInput
} from '../../../shared/plugin-catalog'

// 부팅이 만든 Plugin 한 벌. `toolNames()` 는 **cached descriptor** 에서 나온다 — Auth 가
// invalid 여도 카탈로그는 이 이름들을 계속 보여 준다(0188 D-024).
export interface PluginBinding {
  auth: BoundAuth
  server: RuntimeToolServer
  catalog: PluginCatalogPresentation
  toolNames(): readonly string[]
  sync(): void
}

export interface CreatePluginBindingDeps {
  auth: BoundAuth
  server: RuntimeToolServer
  registry: RuntimeToolSink
  catalog?: PluginCatalogPresentationInput
  logger?: (event: string, data: Record<string, unknown>) => void
}

// Plugin 하나의 도구 가시성 helper. **`syncXTools` 같은 작은 함수만 허용한다** — 이것이
// 범용 registrar 로 자라면 0181 이 지운 3중 상태(PluginHost·ConnectionRegistry·TransactionStore)
// 로 돌아간다.
export function createPluginBinding(deps: CreatePluginBindingDeps): PluginBinding {
  const names = deps.server.descriptor.tools.map((tool) =>
    runtimeToolFullName(deps.server.descriptor.id, tool.name)
  )
  return {
    auth: deps.auth,
    server: deps.server,
    catalog: normalizePluginCatalogPresentation(deps.catalog),
    // 정적 목록이다 — registry 등록 여부와 무관하게 같은 값을 돌려준다.
    toolNames: () => names,
    sync(): void {
      if (deps.auth.snapshot().status === 'valid') {
        deps.registry.add(deps.server)
        deps.logger?.('plugin.tools.registered', {
          authId: deps.auth.authId,
          serverId: deps.server.descriptor.id,
          tools: deps.server.descriptor.tools.length
        })
        return
      }
      deps.registry.remove(deps.server.descriptor.id)
    }
  }
}

// Bootstrap 이 주입하는 **능력**. 배포는 이 목록을 늘릴 수 있지만 **plugin 고유 어휘는 넣지
// 않는다** (0237 D-051) — `mail?: MailPluginDeployment` 같은 키를 두면 범용 `bootstrap.ts` 가
// 그 Plugin 의 옵션 형상·소켓 팩토리·실값 전달 경로를 알아야 하고, "배포가 고치는 파일은
// `app/deployment/` 묶음뿐" 이라는 경계가 거기서 깨진다(0188 r3 과 0237 r2 에서 실제로 그랬다).
//
// 판별 기준은 하나다: **다른 Plugin 이 생겨도 같은 이름으로 쓰이는가.** `secretFor`·
// `userDataRoot` 는 그렇고 `mail` 은 아니다.
export interface PluginDeploymentDeps {
  auth: AuthBinder
  registry: RuntimeToolSink
  logger?: (event: string, data: Record<string, unknown>) => void
  /**
   * AuthId 를 닫은 자격증명 closure 를 만든다. **`AuthSecretReader` 자체는 넘어오지 않는다**
   * (0188 D-010) — Plugin 은 자기 것 말고는 읽을 수 없다. HTTP Plugin 은 이것을 쓰지 않는다
   * (자격증명 주입은 `PluginAuth.request` 안에서 끝난다).
   *
   * 값은 **선언이 편 형태**다 (0237 D-054) — 소비자가 `user:pass` 의 `:` 규칙을 다시 구현하지
   * 않는다. 그 규칙이 두 곳에 생겨 한쪽만 고쳐진 것이 0237 G4 다.
   */
  credentialFor: (authId: AuthId) => () => CredentialMaterial | null
  /** 캐시 DB·staging 이 살 루트(`app.getPath('userData')`). 경로 계산을 배포가 다시 하지 않는다. */
  userDataRoot: string
  /** 비-HTTP 전송이 자격증명 **거부**를 관측했을 때 Auth 를 강등시키는 되먹임 (0237 D-035). */
  credentialRejectionReporter?: (authId: string) => void
}

// 배포가 채우는 자리. **기본 배포는 Plugin 이 없다** (D-030) — 그래서 기본 빌드는 도구 0·network 0 이다.
//
// 조립 예제는 `docs/guides/closed-network-extensions.md` §4 (레시피 C) 다. 폐쇄망 배포는 이
// 파일만 고친다:
//
// ```ts
// const confluenceAuth = deps.auth.bindForPlugin(CONFLUENCE_AUTH.id)
// const mailAuth = deps.auth.bindForPlugin(MAIL_AUTH.id)
// return [
//   createPluginBinding({
//     auth: confluenceAuth,
//     server: confluenceTools(confluenceAuth, { apiBasePath: '/confluence' }),
//     registry: deps.registry,
//     logger: deps.logger
//   }),
//   createPluginBinding({
//     auth: mailAuth,
//     server: mailTools(
//       mailAuth,
//       {
//         credential: deps.credentialFor(MAIL_AUTH.id),
//         root: deps.userDataRoot,
//         socketFactory: createPop3Socket,
//         ...(deps.credentialRejectionReporter
//           ? { reportCredentialRejected: deps.credentialRejectionReporter }
//           : {})
//       },
//       MAIL_PLUGIN_OPTIONS
//     ),
//     registry: deps.registry,
//     logger: deps.logger
//   })
// ]
// ```
export function createPluginBindings(deps: PluginDeploymentDeps): PluginBinding[] {
  void deps
  return []
}
