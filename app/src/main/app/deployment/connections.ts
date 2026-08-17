// 카탈로그 row 조립 (0188 r3 신설).
//
// ── 왜 별도 파일인가 ──────────────────────────────────────────────────────────
// r2 는 `bootstrap.ts` 가 gate·plugin row 만 손으로 이어 붙였다. `ConnectionViewSource` 는
// harness·usage 도 지원하는데 그 두 category 를 만들 자리가 **어디에도 없었다** — Harness
// 인증이나 Usage 인증을 선언한 배포는 카탈로그에 행이 뜨지 않아 **로그인 자체가 불가능**했다.
// 배포가 그것을 고치려면 범용 `bootstrap.ts` 를 열어야 했고, 그러면 "배포가 고치는 파일은
// `app/deployment/` 묶음뿐" 이라는 경계가 깨진다.
//
// 그래서 row 조립을 배포 모듈로 내린다. Bootstrap 은 gate 멤버와 plugin binding 을 넘기고
// 결과 배열을 그대로 IPC 에 태운다.
//
// ── 규칙 ─────────────────────────────────────────────────────────────────────
// - **AS-IS GUI row 의 순서와 개수를 보존한다.** 이 배열이 곧 카탈로그 목록이다.
// - **`authId` 는 중복되지 않는다.** 하나의 Auth 를 Harness 와 Usage 가 함께 써도 `BoundAuth`
//   만 재사용하고 row 를 feature 수만큼 복제하지 않는다(Bootstrap 이 중복을 진단으로 잡는다).
// - 이 배열을 AuthId 기반 feature join registry 로 쓰지 않는다 — 표시용 view source 다.

import type { AuthBinder, BoundAuth } from '../../contracts/auth'
import type { ConnectionViewSource } from '../connection-views'
import type { PluginBinding } from './plugins'

export interface ConnectionDeploymentDeps {
  auth: AuthBinder
  // 부팅 composition 이 fail-closed 검사를 마친 gate 멤버.
  gateMembers: readonly BoundAuth[]
  // 부팅에서 1회 만든 Plugin binding. `toolNames()` 는 cached descriptor 에서 나온다.
  plugins: readonly PluginBinding[]
}

// 기본 배포는 gate 와 plugin row 만 만든다(둘 다 선언이 비어 있어 실제로는 0행).
// 폐쇄망 배포가 harness·usage row 를 끼워 넣는 예제는
// `docs/guides/closed-network-extensions.md` §3·§5-b 다.
export function createConnectionSources(
  deps: ConnectionDeploymentDeps
): readonly ConnectionViewSource[] {
  return [...gateRows(deps.gateMembers), ...pluginRows(deps.plugins)]
}

// 배포가 순서를 바꿔 조립할 수 있도록 조각으로 노출한다 — 가이드 §3 예제가 그것을 쓴다.
export function gateRows(members: readonly BoundAuth[]): ConnectionViewSource[] {
  return members.map((auth) => ({ category: 'gate', auth }))
}

export function pluginRows(plugins: readonly PluginBinding[]): ConnectionViewSource[] {
  return plugins.map((plugin) => ({
    category: 'plugin',
    auth: plugin.auth,
    toolNames: () => plugin.toolNames()
  }))
}
