// 에이전트 호스트가 데이터 호스트에 부탁하는 연산의 표 (0324 F2 · F4 · EP-16).
//
// 실행 쪽 코드의 DB 조회·기록은 이 표의 이름으로만 건너온다 — 표에 없는 `DbQueries` 메서드는 실행
// 쪽에서 부를 수 없다. 인자·결과는 구조화 복제가 되는 값(행·원시값)만 쓴다. 조회는 `data.query`,
// 기록은 `data.write` 로 간다.
//
// 한 연산은 데이터 호스트에서 한 번에(동기로) 끝난다 — 읽고-고쳐-쓰기를 실행 쪽에서 두 요청으로
// 나누면 사이에 다른 요청이 끼어든다. 그런 묶음은 여기서 한 연산으로 둔다.

import type {
  NativeHistoryCursor,
  NativeHistorySnapshot
} from '../../adapters/common/native-history'
import { recoverSessionHistory } from '../../features/chat/recovery'
import { readNativeHistoryPrevious } from '../../features/history/native-sync'
import { loadSession } from '../../features/history/reader'
import { getWorkspacePath } from '../../infra/config/paths'
import type { DbQueries } from '../../infra/db'
import type { AgentEnvironment, SkillInfo } from '../../../shared/ipc'
import type { OoMcpConfig } from '../../adapters/common/mcp-config'
import type { McpStore } from '../../features/extensions/common/mcp/store'
import { expandEnvRecord } from '../../features/harnesses/common/env'
import type { RuntimeModelCatalog } from '../../features/harnesses/common/runtime-catalog'
import type {
  HarnessRuntimeConfigService,
  HarnessRuntimeConfigTarget
} from '../../features/harnesses/common/runtime-config'
import type { HarnessSettingsService } from '../../features/harnesses/common/settings'
import { appEnv } from '../../infra/config/oo-config'
import { getLogger } from '../../infra/log'
import { toAgentEnvironments } from '../../features/harnesses/common/models'
import { referencedVariables, type RemoteToolCall } from '../remote-tools'
import type { RuntimeToolResult } from '../../adapters/common/runtime-tools'
import type { ArtifactRef } from '../../../shared/artifacts'

export interface DataOpsDeps {
  db: DbQueries
  // 프로젝트 미소속 세션의 기본 작업 폴더.
  defaultCwd(): string
  // 하네스 실행 구성(인증에 묶여 데이터 호스트에 있다). 없으면 그 연산이 던진다.
  harness?: {
    settings: Pick<HarnessSettingsService, 'adapters' | 'list' | 'invalidateAll'>
    runtime: Pick<HarnessRuntimeConfigService, 'resolve' | 'cached' | 'invalidate'>
    catalog: Pick<RuntimeModelCatalog, 'merge' | 'isReadOnly' | 'invalidate'>
  }
  // MCP 설정·해석기. 앱 환경과 배포가 쓰는 해석값을 만든다.
  mcp?: Pick<McpStore, 'enabledConfig' | 'resolver'>
  // 데이터 호스트 조립이 가진 그 밖의 것(스킬 목록 · 런타임 도구 호출 · 관리형 MCP 임대 · 산출물 담기).
  host?: DataHostOps
}

export interface CaptureOutputRequest {
  path: string
  directory: string
  sessionId: string
  cwd: string
  extraDirs: string[]
  expectedContent?: string
}

export interface DataHostOps {
  skills(): SkillInfo[]
  runtimeToolCall(request: RemoteToolCall): Promise<RuntimeToolResult>
  runtimeToolCancel(callId: string): void
  managedMcpAcquire(
    revision: number
  ): Promise<{ leaseId: string; endpoints: Array<[string, { url: string; token: string }]> }>
  managedMcpRelease(leaseId: string): Promise<void>
  captureOutput(request: CaptureOutputRequest): Promise<ArtifactRef | null>
  extensionsDeployed(): Promise<void>
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`데이터 호스트에 ${name} 이(가) 없다`)
  return value
}

// MCP 설정과 그 `${…}` 참조의 해석값 — 실행 쪽이 같은 해석기를 다시 만든다(배포 렌더 · 앱 환경).
export interface McpResolution {
  config: OoMcpConfig
  values: Record<string, string>
}

// 하네스 원본 이력의 이전 스냅샷. 원본 레코드(`raw`)는 크고 드물게 쓰여 `nativeHistoryRaw` 로 따로 준다.
export interface NativeHistoryPreviousRow {
  snapshot: NativeHistorySnapshot
  cursor: NativeHistoryCursor | undefined
}

// 표의 타입은 구현에서 유도한다 — 따로 적으면 표와 타입이 갈린다.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createDataQueryOps(deps: DataOpsDeps) {
  const { db } = deps
  const cwdOf = (projectId: string | null | undefined): string =>
    getWorkspacePath(projectId ? db.getProject(projectId) : null, deps.defaultCwd())
  return {
    getSessionById: (id: string) => db.getSessionById(id),
    getProject: (id: string) => db.getProject(id),
    // 프로젝트마다의 작업 폴더. `null` 은 프로젝트 미소속(기본 작업 폴더)이다.
    workspacePaths: (projectIds: Array<string | null>): Array<[string | null, string]> =>
      projectIds.map((id) => [id, cwdOf(id)]),
    getProjectContextForSession: (sessionId: string) => db.getProjectContextForSession(sessionId),
    getTitleSource: (sessionId: string) => db.getTitleSource(sessionId),
    getManagedWorktreeBySession: (sessionId: string) => db.getManagedWorktreeBySession(sessionId),
    nativeRecovery: (sessionId: string) => db.nativeHistory?.recovery?.(sessionId),
    nativeObserve: (sessionId: string) => db.nativeHistory.observe(sessionId),
    nativeHistoryPrevious: (sessionId: string): NativeHistoryPreviousRow | undefined => {
      const previous = readNativeHistoryPrevious(db, sessionId)
      return previous && { snapshot: previous.snapshot, cursor: previous.cursor }
    },
    // 이전 스냅샷의 원본 레코드 — 이어 읽기가 성립할 때만 실행 쪽이 따로 묻는다.
    nativeHistoryRaw: (sessionId: string): unknown =>
      readNativeHistoryPrevious(db, sessionId)?.raw?.(),
    // 보관 대화 전체 — 원본이 사라진 세션의 복구 입력.
    loadSessionArchive: (sessionId: string) => loadSession(db, sessionId, cwdOf),
    // 백그라운드 작업 기록 — 정본이 메모리에 없을 때 상태를 다시 만든다.
    backgroundEvents: (sessionId: string) => db.background?.list(sessionId) ?? [],
    sessionAgentKind: (sessionId: string) => db.getSessionById(sessionId)?.agent_kind,
    sessionBaseline: (sessionId: string) => db.getSessionBaseline(sessionId),
    sessionBackend: (sessionId: string) => db.getSessionById(sessionId)?.backend,
    // ── 하네스 실행 구성 (F2) ──
    harnessEnvironments: (supported: string[], adapterId: string | null): AgentEnvironment[] => {
      const harness = required(deps.harness, '하네스 실행 구성')
      const rows = (adapterId ? [adapterId] : harness.settings.adapters()).flatMap((adapter) =>
        harness.settings.list(adapter)
      )
      return harness.catalog.merge(
        toAgentEnvironments(rows, supported),
        ...(adapterId ? [adapterId] : [])
      )
    },
    harnessRuntimeConfig: async (target: HarnessRuntimeConfigTarget) => {
      const harness = required(deps.harness, '하네스 실행 구성')
      return harness.catalog.isReadOnly(target.key)
        ? harness.runtime.cached(target.key)
        : harness.runtime.resolve(target)
    },
    harnessIsReadOnly: (key: string) => required(deps.harness, '하네스 실행 구성').catalog.isReadOnly(key),
    harnessAppEnv: (): Record<string, string> => {
      const mcp = required(deps.mcp, 'MCP 저장소')
      const { env, missing } = expandEnvRecord(appEnv(), mcp.resolver())
      if (missing.length)
        getLogger()
          .child('config')
          .warn('config.env.unresolved', { missing, reason: 'app env keys skipped' })
      return env
    },
    skills: (): SkillInfo[] => required(deps.host, '조립').skills(),
    runtimeToolCall: (request: RemoteToolCall) => required(deps.host, '조립').runtimeToolCall(request),
    managedMcpAcquire: (revision: number) => required(deps.host, '조립').managedMcpAcquire(revision),
    captureOutput: (request: CaptureOutputRequest) =>
      required(deps.host, '조립').captureOutput(request),
    mcpResolution: (): McpResolution => {
      const mcp = required(deps.mcp, 'MCP 저장소')
      const config = mcp.enabledConfig()
      const resolve = mcp.resolver()
      const values: Record<string, string> = {}
      for (const name of referencedVariables(config)) {
        const value = resolve(name)
        if (value !== undefined) values[name] = value
      }
      return { config, values }
    }
  }
}
export type DataQueryOps = ReturnType<typeof createDataQueryOps>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createDataWriteOps(deps: DataOpsDeps) {
  const { db } = deps
  return {
    updateSessionProviderKey: (
      id: string,
      providerKey: string | null,
      updatedAt: number,
      model: string | null
    ) => db.updateSessionProviderKey(id, providerKey, updatedAt, model),
    ensurePathProject: (row: Parameters<DbQueries['ensurePathProject']>[0]) =>
      db.ensurePathProject(row),
    updateSessionTitleAuto: (id: string, title: string, updatedAt: number) =>
      db.updateSessionTitleAuto(id, title, updatedAt),
    insertManagedWorktree: (row: Parameters<DbQueries['insertManagedWorktree']>[0]) =>
      db.insertManagedWorktree(row),
    deleteManagedWorktree: (id: string) => db.deleteManagedWorktree(id),
    updateSessionCwd: (sessionId: string, cwd: string, updatedAt: number) =>
      db.updateSessionCwd(sessionId, cwd, updatedAt),
    nativePrepareRecovery: (input: Parameters<DbQueries['nativeHistory']['prepareRecovery']>[0]) =>
      db.nativeHistory.prepareRecovery(input),
    nativeAcceptRecovery: (sessionId: string, nativeMessageId: string) =>
      db.nativeHistory.acceptRecovery(sessionId, nativeMessageId),
    nativeRecoveryPrompt: (sessionId: string, nativeMessageId: string, visibleText: string) =>
      db.nativeHistory.recoveryPrompt(sessionId, nativeMessageId, visibleText),
    // 쉬는 세션의 끊긴 도구 호출·미완료 메시지 정리. 진행 중인지는 실행 쪽이 먼저 본다.
    recoverSessionHistory: (sessionId: string): void => {
      recoverSessionHistory(db, { sessionId })
    },
    runtimeToolCancel: (callId: string): void => required(deps.host, '조립').runtimeToolCancel(callId),
    managedMcpRelease: (leaseId: string) => required(deps.host, '조립').managedMcpRelease(leaseId),
    extensionsDeployed: () => required(deps.host, '조립').extensionsDeployed(),
    // 하네스 설정 트리가 바뀌었다 — 두 캐시를 함께 비우고 카탈로그를 다시 맞춘다(0188).
    harnessSettingsChanged: async (key: string | null): Promise<void> => {
      const harness = required(deps.harness, '하네스 실행 구성')
      harness.settings.invalidateAll()
      harness.runtime.invalidate(key ?? undefined, 'harness-settings-crud')
      await harness.catalog.invalidate(key ?? undefined)
    }
  }
}
export type DataWriteOps = ReturnType<typeof createDataWriteOps>
