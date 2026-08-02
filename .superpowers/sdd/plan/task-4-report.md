# Task 4 — PluginHost 연결·runtime tool lifecycle 보고

## Scope

- `PluginHost`를 auth-platform 내부 lifecycle coordinator로 추가했다.
- ConnectorPort, BindingLookup, LogoutPort, RuntimeToolSink를 구조적 port로 선언해 connector/extensions 구현을 직접 import하지 않는다.
- `AuthRegistry.listRuntimeToolsForConnector()` 읽기 API를 추가했다.

## RED → GREEN

- RED 1: `plugin-host.ts` 부재로 PluginHost test suite가 module-not-found로 실패했다.
- RED 2: connector별 runtime tool 읽기 API 부재로 registry test가 `is not a function`으로 실패했다.
- GREEN: binding 사전 검증, target connection ID 보존, connector당 pending/ready 1개, 다중 정적 connector 공존, 제한된 factory context, name drift 거부, connector/factory/sink 실패 rollback, 종료 경합, logout callback cleanup, stop 실패/cascade/idempotent 종료를 fake structural port로 검증했다.

## Verification

- `npx.cmd vitest run src/main/features/auth-platform/plugin-host.test.ts src/main/features/auth-platform/registry.test.ts` — 2 files, 31 tests passed.
- `npm.cmd run typecheck:node` — passed.
- Scoped ESLint for changed files — 0 errors. 기존 registry/registry.test의 Prettier warning 6개는 이번 변경 범위 밖 기존 줄이며 수정하지 않았다.
- `git diff --check` — passed.

## Self-review

- PluginHost는 credential, vault, session, Electron, DB를 import하거나 전달하지 않는다.
- Runtime factory에는 `connectionId`, `invoke`, `logger`, `signal`만 전달하고 invoke는 현재 connection ID에 고정된다.
- 종료 중 late-ready는 AbortSignal과 active identity 검사로 server 등록 전에 거부된다.
- rollback 및 binding 종료는 cleanup promise로 동시 cleanup의 stop/remove 중복을 피하고, stop 실패에도 finally에서 runtime server와 host state를 제거한다.
- 명시 disconnect는 `LogoutPort.logout(bindingId, false)`만 호출한다. 실제 broker callback/bootstrap injection은 Task 5 범위다.

## Follow-up dependencies

- Task 5: AuthBroker의 ended-binding awaited callback과 PluginHost `onBindingsEnded` composition wiring.
- Task 6: `PluginConnectorInfo`를 shared IPC DTO로 승격하고 handler/preload/fixture를 연결.
- Task 7: runtime snapshot revision을 session respawn에 배선.
