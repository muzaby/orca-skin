// 소형 도메인 핸들러 묶음 — backend / agent / install / settings / skills / files /
// search / cost / debug(dev 전용). 각각 1~2 채널이라 별도 파일로 쪼개지 않는다.

import {
  CHANNELS,
  AuthorSkillSchema,
  DebugMockPatchSchema,
  ListFilesRequestSchema,
  SetSkillEnabledSchema,
  SkillTargetSchema,
  SearchMessagesRequestSchema,
  UploadSkillSchema,
  StartInstallSchema,
  type AgentEnvironment,
  type BackendListResult,
  type CostSummary,
  type DebugMockState,
  type FileEntry,
  type SearchHit,
  type Settings,
  type SkillInfo
} from '../../../shared/protocol'
import { shell } from 'electron'
import { toAgentEnvironments } from '../../settings/provider-settings'
import { removeOrcaSkillDir, writeAuthoredSkill, writeUploadedSkill } from '../../skills/sources'
import { skillEnabledKey } from '../../skills/scan'
import { listDir } from '../../files/scan'
import { sendInstallStatus, setWireLog, type RouterContext } from '../context'
import { handle, handlePlain } from '../registry'

function findSkill(ctx: RouterContext, sourceId: string, name: string): SkillInfo {
  const skill = ctx.getSkills().find((s) => s.sourceId === sourceId && s.name === name)
  if (!skill) throw new Error(`스킬을 찾을 수 없습니다: ${sourceId}/${name}`)
  return skill
}

export function registerMiscHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.backendList, (): BackendListResult => {
    // 능력 서술자를 computed-on-the-fly 로 각 엔트리에 부착(DB 미관여 — §4). capabilities 는
    // 백엔드의 함수(세션별 데이터 아님)라 영속하지 않고 매 응답에 다시 계산해 붙인다.
    const descriptors = ctx.registry.describeAll()
    const backends = ctx.registry.list().map((b) => ({ ...b, capabilities: descriptors[b.id] }))
    const active = ctx.registry.getActiveId() ?? undefined
    return { backends, ...(active ? { active } : {}) }
  })

  // 원천 = sources/settings/<adapter>/ 트리 (handoff 0014 — 구 orca.json agents[] 대체).
  // 페이로드 shape(AgentEnvironment)는 0010 과 동일 유지 — renderer ModelMenu 변경 0.
  handlePlain(CHANNELS.agentList, (): AgentEnvironment[] => {
    const supported = ctx.registry.list().map((adapter) => adapter.id)
    const entries = ctx.providerSettings
      .adapters()
      .flatMap((adapter) => ctx.providerSettings.list(adapter))
    return toAgentEnvironments(entries, supported)
  })

  handle(CHANNELS.installStart, StartInstallSchema, 'reject', async (req, event): Promise<void> => {
    for await (const st of ctx.installer.start(req.backend)) {
      sendInstallStatus(event.sender, st)
    }
  })

  handlePlain(CHANNELS.settingsGet, (): Settings => ctx.settings.getAll())

  // 검증은 SettingsStore.patch 내부 zod(SettingsPatchSchema)가 담당.
  handlePlain(CHANNELS.settingsSet, (raw): Settings => ctx.settings.patch(raw))

  handlePlain(CHANNELS.skillsList, (): SkillInfo[] => ctx.getSkills())

  handle(CHANNELS.skillsAuthor, AuthorSkillSchema, 'reject', async (req): Promise<SkillInfo[]> => {
    await writeAuthoredSkill(req)
    ctx.syncExtensions()
    return ctx.refreshSkills()
  })

  handle(CHANNELS.skillsUpload, UploadSkillSchema, 'reject', async (req): Promise<SkillInfo[]> => {
    await writeUploadedSkill(req)
    ctx.syncExtensions()
    return ctx.refreshSkills()
  })

  handle(
    CHANNELS.skillsSetEnabled,
    SetSkillEnabledSchema,
    'reject',
    async (req): Promise<SkillInfo[]> => {
      const skill = findSkill(ctx, req.sourceId, req.name)
      if (!skill.canToggle) return ctx.getSkills()
      const current = ctx.settings.getAll()
      ctx.settings.patch({
        skillEnabled: {
          ...current.skillEnabled,
          [skillEnabledKey(req.sourceId, req.name)]: req.enabled
        }
      })
      ctx.syncExtensions()
      return ctx.refreshSkills()
    }
  )

  handle(CHANNELS.skillsOpen, SkillTargetSchema, 'reject', async (req): Promise<void> => {
    await shell.openPath(findSkill(ctx, req.sourceId, req.name).skillPath)
  })

  handle(CHANNELS.skillsShowInFolder, SkillTargetSchema, 'reject', (req): void => {
    shell.showItemInFolder(findSkill(ctx, req.sourceId, req.name).skillPath)
  })

  handle(CHANNELS.skillsRemove, SkillTargetSchema, 'reject', async (req): Promise<SkillInfo[]> => {
    const skill = findSkill(ctx, req.sourceId, req.name)
    if (!skill.canRemove) throw new Error('Orca 스킬만 제거할 수 있습니다.')
    await removeOrcaSkillDir(skill.skillDir)
    const current = ctx.settings.getAll()
    const skillEnabled = { ...current.skillEnabled }
    delete skillEnabled[skillEnabledKey(req.sourceId, req.name)]
    ctx.settings.patch({ skillEnabled })
    ctx.syncExtensions()
    return ctx.refreshSkills()
  })

  handle(
    CHANNELS.filesList,
    ListFilesRequestSchema,
    { fallback: [] as FileEntry[] },
    (req): Promise<FileEntry[]> => listDir(req.cwd, req.relDir)
  )

  // 대화 검색 — main thread 에서 FTS5 prepared statement 실행. better-sqlite3 가
  // sync 라 main 이 블록되지만 FTS5 + LIMIT 30 의 latency 는 단위 ms 수준으로
  // renderer 의 150ms debounce 하에서 체감 영향 없음. perf 회귀 발생 시 utilityProcess
  // 로 이전 검토 (계획 문서 §Worker thread 보류 근거).
  handle(
    CHANNELS.searchMessages,
    SearchMessagesRequestSchema,
    { fallback: [] as SearchHit[] },
    (req): SearchHit[] => {
      const rows = ctx.db.searchMessages(req.q, req.limit ?? 30)
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

  handlePlain(CHANNELS.costSummary, (): CostSummary => ctx.cost.getSummary())

  if (import.meta.env.DEV) {
    setWireLog(ctx.debugMock.wireLog)
    handlePlain(CHANNELS.debugGetMock, (): DebugMockState => ({ ...ctx.debugMock }))
    handle(CHANNELS.debugSetMock, DebugMockPatchSchema, 'reject', (patch): DebugMockState => {
      Object.assign(ctx.debugMock, patch)
      setWireLog(ctx.debugMock.wireLog)
      return { ...ctx.debugMock }
    })
  }
}
