// 소형 도메인 핸들러 묶음 — backend / agent / install / settings / skills / files /
// search / cost / runtime / debug(dev 전용). 각각 1~2 채널이라 별도 파일로 쪼개지 않는다.

import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  CHANNELS,
  DebugMockPatchSchema,
  ListFilesRequestSchema,
  SearchMessagesRequestSchema,
  StartInstallSchema,
  type AgentEnvironment,
  type BackendListResult,
  type CostSummary,
  type FileEntry,
  type RuntimeStatus,
  type SearchHit,
  type Settings,
  type SkillInfo
} from '../../../shared/protocol'
import { getOrcaConfig } from '../../config/orca-config'
import { toAgentEnvironments } from '../../config/provider-key'
import { listDir } from '../../files/scan'
import { sendInstallStatus, type RouterContext } from '../context'

export function registerMiscHandlers(ctx: RouterContext): void {
  ipcMain.handle(CHANNELS.backendList, async (): Promise<BackendListResult> => {
    // 능력 서술자를 computed-on-the-fly 로 각 엔트리에 부착(DB 미관여 — §4). capabilities 는
    // 백엔드의 함수(세션별 데이터 아님)라 영속하지 않고 매 응답에 다시 계산해 붙인다.
    const descriptors = ctx.registry.describeAll()
    const backends = ctx.registry.list().map((b) => ({ ...b, capabilities: descriptors[b.id] }))
    const active = ctx.registry.getActiveId() ?? undefined
    return { backends, ...(active ? { active } : {}) }
  })

  ipcMain.handle(
    CHANNELS.agentList,
    async (): Promise<AgentEnvironment[]> =>
      toAgentEnvironments(
        getOrcaConfig().agents,
        ctx.registry.list().map((adapter) => adapter.id)
      )
  )

  ipcMain.handle(
    CHANNELS.installStart,
    async (event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
      const parsed = StartInstallSchema.parse(raw)
      for await (const st of ctx.installer.start(parsed.backend)) {
        sendInstallStatus(event.sender, st)
      }
    }
  )

  ipcMain.handle(CHANNELS.settingsGet, async (): Promise<Settings> => ctx.settings.getAll())

  ipcMain.handle(
    CHANNELS.settingsSet,
    async (_event: IpcMainInvokeEvent, raw: unknown): Promise<Settings> => ctx.settings.patch(raw)
  )

  ipcMain.handle(CHANNELS.skillsList, async (): Promise<SkillInfo[]> => ctx.getSkills())

  ipcMain.handle(
    CHANNELS.filesList,
    async (_event: IpcMainInvokeEvent, raw: unknown): Promise<FileEntry[]> => {
      const parsed = ListFilesRequestSchema.safeParse(raw)
      if (!parsed.success) return []
      return listDir(parsed.data.cwd, parsed.data.relDir)
    }
  )

  // 대화 검색 — main thread 에서 FTS5 prepared statement 실행. better-sqlite3 가
  // sync 라 main 이 블록되지만 FTS5 + LIMIT 30 의 latency 는 단위 ms 수준으로
  // renderer 의 150ms debounce 하에서 체감 영향 없음. perf 회귀 발생 시 utilityProcess
  // 로 이전 검토 (계획 문서 §Worker thread 보류 근거).
  ipcMain.handle(
    CHANNELS.searchMessages,
    async (_event: IpcMainInvokeEvent, raw: unknown): Promise<SearchHit[]> => {
      const parsed = SearchMessagesRequestSchema.safeParse(raw)
      if (!parsed.success) return []
      const rows = ctx.db.searchMessages(parsed.data.q, parsed.data.limit ?? 30)
      return rows.map((r) => ({
        messageId: r.message_id,
        sessionId: r.session_id,
        sessionTitle: r.session_title,
        role: r.role,
        createdAt: r.created_at,
        snippet: r.snippet
      }))
    }
  )

  ipcMain.handle(CHANNELS.costSummary, async (): Promise<CostSummary> => ctx.cost.getSummary())

  // 현재 런타임 상태 조회 (renderer 마운트 시점의 초기 동기화용). 인자 없음.
  ipcMain.handle(CHANNELS.runtimeStatus, async (): Promise<RuntimeStatus> => ctx.runtime.status)

  // 실패 후 재시도 또는 수동 준비 트리거. 진행 상태는 statusEvent 로 별도 스트리밍.
  ipcMain.handle(CHANNELS.runtimePrepare, async (): Promise<void> => {
    await ctx.runtime.retry()
  })

  if (import.meta.env.DEV) {
    ipcMain.handle(CHANNELS.debugGetMock, async () => ({ ...ctx.debugMock }))
    ipcMain.handle(CHANNELS.debugSetMock, async (_event, raw) => {
      Object.assign(ctx.debugMock, DebugMockPatchSchema.parse(raw))
      return { ...ctx.debugMock }
    })
  }
}
