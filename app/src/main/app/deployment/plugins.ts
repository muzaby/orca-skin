// Plugin 배선 (0188 — 구 `features/providers/declarations/service.ts` + `service/index.ts`).
//
// Plugin 은 Auth 의 service contribution 이 아니라 **독립 모듈**이다. Plugin 모듈은
// `PluginAuth` 와 자기 옵션만 받고, Runtime Tool 서버를 **한 번만** 만든다.
//
// ── 왜 범용 registrar 를 만들지 않는가 ───────────────────────────────────────
// 0181 의 `ServiceToolRegistrar` 는 `Provider[]` 를 받아 `provider.tools` 를 훑는 일반화된
// 등록자였다. 그 일반화는 `Provider` 계약에 `tools` 슬롯이 있어야만 성립한다 — 슬롯을 없앤
// 지금은 배포가 자기 Plugin 을 직접 조립하는 것이 더 짧고, 형상도 타입으로 잡힌다.
// **PluginHost·ConnectorRegistry·ContributionRegistry 를 다시 만들지 않는다.**
//
// ── deps 는 3키로 고정이다 (0237 ΔV2 — D-048) ────────────────────────────────
// r2 는 mail 하나 때문에 `mail?: MailPluginDeployment` 와 `credentialRejectionReporter?` 를
// 더했다. 플러그인당 슬롯 하나는 **확장마다 계약이 자란다**는 뜻이고, 그러면 배포가 범용
// `bootstrap.ts` 까지 고쳐야 해서 "배포가 고치는 파일은 `app/deployment/` 묶음뿐" 이라는 이
// 디렉토리의 존재 이유가 무너진다. 플러그인은 **파라미터가 아니라 아래 배열의 행**으로 들어온다.
//
// ── 같은 인스턴스를 재사용해야 하는 이유 ─────────────────────────────────────
// `RuntimeToolRegistry` 의 동등성 검사는 **handler identity** 까지 본다(실행 값이라 복사하지
// 않는다). sync 마다 서버를 새로 만들면 형상이 같아도 revision 이 올라 다음 턴이 런타임을
// 재spawn 한다. 그래서 서버는 부팅에서 1회 만들고 `sync` 는 add/remove 만 한다.

import type { RuntimeToolServer, RuntimeToolSink } from '../../adapters/runtime-tools'
import { runtimeToolFullName } from '../../adapters/runtime-tool-policy'
import type { PluginAuth, PluginAuthBinder } from '../../contracts/auth'
import {
  normalizePluginCatalogPresentation,
  type PluginCatalogPresentation,
  type PluginCatalogPresentationInput
} from '../../../shared/plugin-catalog'

// 부팅이 만든 Plugin 한 벌. `toolNames()` 는 **cached descriptor** 에서 나온다 — Auth 가
// invalid 여도 카탈로그는 이 이름들을 계속 보여 준다(0188 D-024).
export interface PluginBinding {
  auth: PluginAuth
  server: RuntimeToolServer
  catalog: PluginCatalogPresentation
  toolNames(): readonly string[]
  sync(): void
  // 앱 종료에서 1회 (0237 ΔV2 — D-060). Auth 강등에서는 부르지 않는다.
  dispose(): void
}

export interface CreatePluginBindingDeps {
  auth: PluginAuth
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
      // **회수는 registry 에서만** — 서버가 든 자원은 그대로 둔다(D-060). 재인증 1회로
      // 돌아오는 것이 D-045 가 약속한 회복이고, 그때 DB 를 다시 열 이유가 없다.
      deps.registry.remove(deps.server.descriptor.id)
    },
    dispose(): void {
      deps.registry.remove(deps.server.descriptor.id)
      deps.server.dispose?.()
    }
  }
}

// Bootstrap 이 주입하는 능력. **배포가 이 시그니처를 바꾸면 안 된다** — 바꾸는 순간 배포가
// 범용 `bootstrap.ts` 까지 고쳐야 하고, "배포가 고치는 파일은 `app/deployment/` 묶음뿐" 이라는
// 경계가 깨진다(r3 에서 실제로 그랬다).
//
// **키는 셋이고 플러그인 이름은 없다** (0237 ΔV2 — D-048). `auth` 가 `PluginAuthBinder` 인 것이
// 좁힘 장치다 — Harness·Usage·Connections 배포 factory 는 `AuthBinder` 를 받아 `secret()` 에
// 도달하지 못한다.
export interface PluginDeploymentDeps {
  auth: PluginAuthBinder
  registry: RuntimeToolSink
  logger?: (event: string, data: Record<string, unknown>) => void
}

// 배포가 채우는 자리. **기본 배포는 Plugin 이 없다** — `AUTH_DEFINITIONS` 가 비어 있어
// `bindForPlugin` 이 던지므로, 선언을 채우지 않은 배포에서는 아래 행이 있어도 빈 배열이다.
//
// 조립 예제는 `docs/guides/closed-network-extensions.md` §4 (레시피 C) 다. 폐쇄망 배포는
// **여기에 행을 더한다** — 파라미터를 늘리지 않는다:
//
//   const mailAuth = deps.auth.bindForPlugin(MAIL_AUTH.id)
//   bindings.push(
//     createPluginBinding({
//       auth: mailAuth,
//       server: mailTools(mailAuth, { plugin: { accountId: MAIL_AUTH.id } }),
//       registry: deps.registry,
//       logger: deps.logger
//     })
//   )
export function createPluginBindings(deps: PluginDeploymentDeps): PluginBinding[] {
  void deps
  return []
}
