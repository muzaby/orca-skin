// IpcRouter — main 측 컴포지션 루트. 의존성 생성 + 부팅 시퀀스 + 핸들러 등록 위임만 담당한다.
// 도메인 핸들러는 ipc/handlers/, chat 턴 파이프라인은 ipc/chat/ 참조 (handoff 0011 분해).

import { webContents } from 'electron'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { CHANNELS, type DebugMockState, type SkillInfo } from '../../shared/ipc'
import { AdapterRegistry } from '../adapters/registry'
import { MockAdapter } from '../adapters/mock'
import { Installer } from '../installer'
import { SettingsStore } from '../settings/store'
import { McpStore } from '../mcp/store'
import { ensureConfigDir, sourcesSkillsDir, workspaceDir } from '../config/paths'
import { loadOrcaConfig } from '../config/orca-config'
import { SecretStore } from '../config/secret-store'
import { deploy } from '../deploy/deployer'
import { syncWorkspaceExtensions } from '../deploy/workspace-sync'
import { scaffoldProviderSettings } from '../deploy/scaffold'
import { ProviderSettingsService } from '../settings/provider-settings'
import { loadClaudeProviderSettings } from '../adapters/claude-settings'
import { scanSkills, type SkillScanRoot } from '../skills/scan'
import { initDb } from '../db'
import { CostTracker } from '../cost/tracker'
import { PythonRuntime, type RuntimeStatus } from '../runtime'
import { ExtensionBuilder } from '../extensions/builder'
import { buildAppend, loadPolicies } from '../prompts'
import { PermissionModeController } from '../runtime-events/permission-mode-controller'
import type { RouterContext } from './context'
import { registerSessionHandlers } from './handlers/session'
import { registerProjectHandlers } from './handlers/project'
import { registerMcpHandlers } from './handlers/mcp'
import { registerEngineHandlers } from './handlers/engine'
import { registerMiscHandlers } from './handlers/misc'
import { registerChatHandlers } from './chat/send'
import { TurnRegistry } from './chat/turn-registry'
import { ApprovalCoordinator } from './chat/approvals'
import { TurnPersistence } from './chat/persist'
import { TitleGenerator } from './chat/title-generation'

export class IpcRouter {
  readonly settings = new SettingsStore()
  readonly mcp = new McpStore(this.settings)
  // resolver 팩토리를 lazy arrow 로 넘긴다 — 호출은 턴 실행 시점이라 this.mcp 가 이미 할당돼 있다
  // (field-init 순서 무관). 비밀 확장은 어댑터의 어댑트 시점에만.
  private readonly registry = new AdapterRegistry(() => this.mcp.resolver())
  readonly runtime = new PythonRuntime()
  // 부팅 시 1회 스캔하여 메모리에 캐시. fs.watch hot-reload 는 본 PR 범위 밖 (재시작).
  private skillsCache: SkillInfo[] = []
  // chat send 와 files list, session cwd 노출에서 모두 동일하게 사용하는 단일
  // cwd. 기본은 ~/.config/orca/workspace — 향후 사용자 선택 디렉토리로 확장 가능.
  private defaultCwd: string = ''
  private readonly debugMock: DebugMockState = {
    enabled: false,
    scenarioId: 'full',
    contextUsageRatio: 0.3,
    wireLog: false
  }

  private skillRoots(): SkillScanRoot[] {
    return [
      {
        sourceId: 'orca',
        sourceLabel: 'Orca 스킬',
        sourceKind: 'orca',
        rootDir: sourcesSkillsDir()
      },
      {
        sourceId: 'adapter:claude',
        sourceLabel: 'CLAUDE 스킬',
        sourceKind: 'adapter',
        rootDir: join(homedir(), '.claude', 'skills')
      }
    ]
  }

  private async refreshSkills(): Promise<SkillInfo[]> {
    this.skillsCache = await scanSkills(
      this.skillRoots(),
      this.settings.getAll().skillEnabled
    ).catch(() => [])
    return this.skillsCache
  }

  private syncExtensions(): void {
    try {
      const settings = this.settings.getAll()
      const r = deploy('claude', {
        skillEnabled: settings.skillEnabled,
        skillRoots: this.skillRoots(),
        mcpConfig: this.mcp.enabledConfig()
      })
      if (!r.validation.ok) {
        for (const err of r.validation.errors) console.warn('[deploy] 검증 경고:', err)
      }
      syncWorkspaceExtensions('claude', this.defaultCwd)
    } catch (e) {
      console.warn('[sync] 확장 싱크 건너뜀:', e)
    }
  }

  async start(): Promise<void> {
    const db = initDb()
    // 비용 요약 IPC 송출 배선 — domain(CostTracker)은 electron 비의존, 송출은 여기(컴포지션 루트)서.
    const cost = new CostTracker(db, (summary) => {
      for (const wc of webContents.getAllWebContents()) {
        if (!wc.isDestroyed()) wc.send(CHANNELS.costSummaryEvent, summary)
      }
    })
    cost.recompute()
    // 정적 정책 본문(prompts/)을 startup 1회 조립. 조건은 startup-known 값(platform)만 — 조건부
    // 블록이 per-turn ctx 를 요구하면 그 시점에 빌더로 옮긴다. DB 프로젝트 지침은 빌더가 매 턴
    // 조회하므로(무캐시) 지침 편집 즉시 반영 불변.
    const stableAppend = buildAppend({ platform: process.platform }, loadPolicies())
    // 빌더는 db 인스턴스가 필요해 여기서 생성. skills 는 lazy getter 라 스캔
    // 완료 전에 만들어도 무방 — 턴 실행 시점에 최신 skillsCache 를 읽는다.
    const extensions = new ExtensionBuilder(db, this.mcp, () => this.skillsCache, stableAppend)
    await this.registry.refreshInstallState()
    this.defaultCwd = workspaceDir()
    await mkdir(this.defaultCwd, { recursive: true }).catch((e) =>
      console.warn('[boot] workspace 생성 실패:', e)
    )
    // ~/.config/orca 보장 → orca.json 로드 → provider settings 스캐폴드(최초 1회) →
    // dist/<engine> 배포(ExtensionDeployer) → settings 해석 캐시 무효화.
    // 어느 단계 실패도 부팅을 막지 않는다(채팅/세션 기능은 독립).
    await ensureConfigDir().catch((e) => console.warn('[boot] ensureConfigDir 실패:', e))
    try {
      loadOrcaConfig()
    } catch (e) {
      console.warn('[boot] orca.json 로드 건너뜀:', e)
    }
    const secretStore = new SecretStore()
    const providerSettings = new ProviderSettingsService({ claude: loadClaudeProviderSettings })
    try {
      const s = scaffoldProviderSettings('claude')
      for (const path of s.created) console.log('[scaffold] 생성:', path)
    } catch (e) {
      console.warn('[boot] provider settings 스캐폴드 건너뜀:', e)
    }
    try {
      const settings = this.settings.getAll()
      const r = deploy('claude', {
        skillEnabled: settings.skillEnabled,
        skillRoots: this.skillRoots(),
        mcpConfig: this.mcp.enabledConfig()
      })
      if (!r.validation.ok) {
        for (const err of r.validation.errors) console.warn('[deploy] 검증 경고:', err)
      }
      providerSettings.invalidateAll()
    } catch (e) {
      console.warn('[boot] 배포 건너뜀:', e)
    }
    // ClaudeAdapter 가 사용하는 cwd 와 동일한 값으로 스킬 스캔.
    await this.refreshSkills()
    this.syncExtensions()

    const ctx: RouterContext = {
      db,
      settings: this.settings,
      mcp: this.mcp,
      registry: this.registry,
      installer: new Installer(this.registry),
      cost,
      runtime: this.runtime,
      secretStore,
      extensions,
      providerSettings,
      getSkills: () => this.skillsCache,
      refreshSkills: () => this.refreshSkills(),
      syncExtensions: () => this.syncExtensions(),
      getCwd: () => this.defaultCwd,
      debugMock: this.debugMock,
      mockAdapter: import.meta.env.DEV ? new MockAdapter(() => this.debugMock) : null
    }
    this.register(ctx)

    // Python 런타임 (uv 격리 인터프리터) 비동기 초기화. await 하지 않아 부팅을 막지
    // 않는다 — 진행 상태는 runtime:statusEvent 로 모든 webContents 에 스트리밍된다.
    void this.runtime.ensure()
  }

  private register(ctx: RouterContext): void {
    // chat 턴 파이프라인 조립 — 레지스트리(세션 키잉) · persist · 제목 생성 · 승인 조정.
    const turns = new TurnRegistry<Electron.WebContents>()
    const titles = new TitleGenerator(ctx.db)
    const persistence = new TurnPersistence(ctx.db, ctx.cost, (turn) => titles.maybeStart(turn))
    const approvals = new ApprovalCoordinator()
    const permissionModes = new PermissionModeController()
    registerChatHandlers({ ctx, turns, approvals, persistence, permissionModes })
    approvals.registerHandlers(turns, permissionModes)

    registerSessionHandlers(ctx)
    registerProjectHandlers(ctx)
    registerMcpHandlers(ctx)
    registerEngineHandlers(ctx)
    registerMiscHandlers(ctx)

    // 런타임 초기화 진행/에러는 dev 터미널 로깅으로 관찰한다 — 구 runtime IPC 3채널
    // (status/prepare/statusEvent)은 renderer 소비처가 없어 제거됨(handoff 0012).
    this.runtime.on('status', (st: RuntimeStatus) => {
      if (is.dev) {
        if (st.stage === 'error') console.error('[runtime] error:', st.error)
        else console.log('[runtime]', st.stage, st.log ?? '')
      }
    })
  }
}
