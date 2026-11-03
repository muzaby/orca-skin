// 0292 r2 verify 재현(D14) — app/src/renderer/src/app/boot/ 에 복사해 OBS_OUT=<json> 으로 실행하고 지운다.
// 관측: c958f83 → {backend:claude, writes:[]} · 24d91a6 → {backend:claude, writes:[[{lastBackend:'claude'}]]}
// verify r2 scratch — degraded backend step (list failure) with remembered OpenCode (not committed)
import { afterEach, expect, it, vi } from 'vitest'
import { createBootSteps, defaultBootDependencies, runBootSteps } from './steps'
import { backendApi, harnessApi, settingsApi } from '../../shared/api/ipc'
import { useChatStore } from '../../features/chat/store/chatStore'
afterEach(() => vi.restoreAllMocks())
it('records lastBackend claude although availability was never read (backend step degraded)', async () => {
  vi.spyOn(harnessApi, 'onAvailability').mockReturnValue(() => {})
  vi.spyOn(backendApi, 'list').mockRejectedValue(new Error('list failed'))
  vi.spyOn(settingsApi, 'get').mockResolvedValue({ lastBackend: 'opencode', lastAgentKind: 'code' } as never)
  const write = vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
  await runBootSteps(
    createBootSteps({
      ...defaultBootDependencies,
      whenMainReady: async () => {},
      getBootReport: async () => ({ startedAt: 1, finishedAt: 2, durationMs: 1, status: 'ok', steps: [], warnings: [] }),
      initSessions: async () => {},
      initProjects: async () => {},
      initUsage: async () => {}
    })
  )
  const state = useChatStore.getState()
  require('node:fs').writeFileSync(process.env.OBS_OUT ?? '/dev/null', JSON.stringify({ backend: state.sessions[state.activeKey].session.backend, writes: write.mock.calls }))
  expect(true).toBe(true)
})
