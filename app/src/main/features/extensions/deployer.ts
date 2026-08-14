// ExtensionDeployer — 사람이 편집한 정규 소스(sources/)를 엔진 규약 산출물(dist/<engine>/)로 배포한다
// (standardization.md §5.2). 다단계 파이프라인/다중 drift 정책을 두지 않고 안전한 기본 동작 하나로
// 시작한다: render(sources→engine 규약) → validate(특히 MCP 키 이름) → dryRun ? 계획 : backup-then-write.
//
// claude 축별 동작:
//   instructions : AGENTS.md 는 런타임 systemPromptAppend 로 주입(ExtensionBuilder) → dist 파일 미생성(중립).
//   skills : sources/skills → dist/<engine>/plugins/orca/skills 로 **복사**(Claude plugin 패키지).
//            adapter 스킬(~/.claude/skills)은 복사하지 않고 dist/<engine>/plugins/claude 래퍼
//            플러그인(매니페스트 + skills 정션/심링크)으로 **링크**한다(0117 — settingSources
//            user 배제 보전, harness-plugins/claude-user-skills.ts).
//   mcp : 활성 MCP 를 확장한 뒤 dist/<engine>/plugins/orca/.mcp.json 으로 **렌더** + 키 검증.
//   agents/hooks : 빈 디렉토리 스캐폴드(후속 자산 수용). commands/settings 는 dist 로 배포하지 않는다.
//
// dist/<engine> 는 편집 대상이 아니다. 무단 덮어쓰기를 막기 위해 기록 전 항상 백업한다(.bak 1개 롤링).
// 레이아웃은 paths.ts 의 sources*/dist* 헬퍼와 일치해야 한다 — 본 함수는 테스트 용이성을 위해 root 를
// 받아 상대 경로로 계산한다(homedir 비의존). 기본값은 orcaConfigDir().

// 동기 fs 금지(0109) — 배포는 부팅 스텝과 스킬/MCP CRUD invoke 핸들러 안에서 돌므로,
// 재귀 복사/삭제가 sync 면 그 동안 이벤트 루프(=모든 IPC·프로토콜 응답)가 멈춘다.
import { existsSync } from 'node:fs'
import { getLogger } from '../../infra/log/registry'
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join } from 'node:path'
import type { Backend } from '../../../shared/ipc'
import { isRecord } from '../../../shared/obj'
import type { ClaudeMcpConfig } from '../../adapters/mcp-config'
import type { SkillScanRoot } from './skills/scan'
import { readJsonFile } from '../../infra/config/json-file'
import { orcaConfigDir } from '../../infra/config/paths'
import { PROVIDER_NAME_RE } from '../../infra/config/provider-key'
import { ORCA_PLUGIN_NAME } from '../../adapters/claude-plugin'
import { renderClaudeHarnessPlugin } from './harness-plugins/claude'
import { renderClaudeUserSkillsPlugin } from './harness-plugins/claude-user-skills'

interface DeployOptions {
  dryRun?: boolean
  skillRoots?: SkillScanRoot[]
  mcpConfig?: ClaudeMcpConfig
}

export interface DeployResult {
  engine: Backend
  dryRun: boolean
  actions: string[]
  backedUp: boolean
  validation: { ok: boolean; errors: string[] }
}

// MCP 서버 키 = provider 디렉토리 이름과 동일 제약(영숫자·_·-) — config/provider-key 의 정본 재사용.
const MCP_KEY_RE = PROVIDER_NAME_RE

// MCP 서버 키 이름 검증(잘못된 키는 엔진이 조용히 무시할 수 있으므로). 파일 부재/손상은 ok(서버 0).
async function validateMcp(mcpJson: string): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = []
  let raw: string
  try {
    raw = await readFile(mcpJson, 'utf8')
  } catch {
    return { ok: true, errors }
  }
  try {
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> }
    const servers = parsed.mcpServers ?? {}
    for (const name of Object.keys(servers)) {
      if (!MCP_KEY_RE.test(name)) {
        errors.push(`MCP 서버 키 '${name}' 는 [A-Za-z0-9_-] 만 허용됩니다.`)
      }
    }
  } catch {
    errors.push('mcp.json 파싱 실패 — JSON 형식을 확인하세요.')
  }
  return { ok: errors.length === 0, errors }
}

// sources/settings/<engine>/ 의 provider 디렉토리 열거 + settings.json 검증. 이름 위반/JSON 파싱
// 실패는 해당 provider 만 에러에 추가하고 나머지는 계속 배포한다 (3단 관용 — 항목 단위 격리).
async function scanProviderSettings(settingsRoot: string): Promise<{
  providers: string[]
  errors: string[]
}> {
  const providers: string[] = []
  const errors: string[] = []
  let entries: Dirent[]
  try {
    entries = await readdir(settingsRoot, { withFileTypes: true })
  } catch {
    return { providers, errors } // settings 소스 부재 = provider 0 (정상)
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (!PROVIDER_NAME_RE.test(entry.name)) {
      errors.push(`provider 디렉토리 '${entry.name}' 는 [A-Za-z0-9_-] 만 허용됩니다.`)
      continue
    }
    const settingsPath = join(settingsRoot, entry.name, 'settings.json')
    if (existsSync(settingsPath) && readJsonFile(settingsPath) === undefined) {
      errors.push(`settings/${entry.name}/settings.json 파싱 실패 — JSON 형식을 확인하세요.`)
      continue
    }
    providers.push(entry.name)
  }
  return { providers, errors }
}

export async function deploy(
  engine: Backend,
  opts: DeployOptions = {},
  root: string = orcaConfigDir()
): Promise<DeployResult> {
  const dryRun = !!opts.dryRun
  const sources = join(root, 'sources')
  const dist = join(root, 'dist', engine)
  const mcpSrc = join(sources, 'mcp', 'mcp.json')
  const actions: string[] = []

  const [mcpValidation, settingsScan] = await Promise.all([
    validateMcp(mcpSrc),
    scanProviderSettings(join(sources, 'settings', engine))
  ])
  const validation = {
    ok: mcpValidation.ok && settingsScan.errors.length === 0,
    errors: [...mcpValidation.errors, ...settingsScan.errors]
  }

  // dry-run 계획과 실행 계획이 같은 문구를 쓰도록 액션 문자열은 한 곳에서 만든다
  // (deploy 테스트가 두 경로의 문구를 대조한다 — 복사본이 갈리면 계획↔실행 드리프트).
  const userSkillsAction = (rendered: boolean): string =>
    rendered
      ? 'render user-skills plugin → dist/plugins/claude'
      : 'skip user-skills plugin (no adapter skills)'

  // adapter 스킬 루트(~/.claude/skills — 프로덕션은 bootstrap 이 주입) = 래퍼 플러그인의 링크
  // 대상. skillRoots 에서 파생해 deployer 는 homedir 비의존을 유지한다(테스트는 임시 경로 주입).
  const adapterSkillsRoot = opts.skillRoots?.find(
    (r) => r.sourceKind === 'adapter' && r.sourceId === `adapter:${engine}`
  )?.rootDir

  if (dryRun) {
    actions.push(
      `validate mcp keys (${validation.ok ? 'ok' : validation.errors.length + ' error(s)'})`
    )
    if (existsSync(dist)) actions.push(`backup ${dist} → ${dist}.bak`)
    actions.push('render orca plugin → dist/plugins/orca')
    actions.push(
      existsSync(mcpSrc) || opts.mcpConfig
        ? 'render mcp → plugins/orca/.mcp.json'
        : 'render empty mcp → plugins/orca/.mcp.json'
    )
    actions.push(userSkillsAction(!!adapterSkillsRoot && existsSync(adapterSkillsRoot)))
    actions.push('skip commands/settings dist copy')
    return { engine, dryRun, actions, backedUp: false, validation }
  }

  // backup-then-write: 기존 dist 를 .bak(롤링 1개)으로 옮긴 뒤 새로 렌더.
  let backedUp = false
  if (existsSync(dist)) {
    const bak = `${dist}.bak`
    try {
      await rm(bak, { recursive: true, force: true })
      await rename(dist, bak)
      backedUp = true
      // 0157 — 해석된 MCP 비밀의 **2차 사본 제거**. .bak 은 배포 구조 롤백용이지 비밀 보관용이
      // 아닌데, dist 를 통째로 rename 하면 평문 .mcp.json 이 무기한 남는다(보고서 위험 #2).
      // 남는 1차 사본(dist 쪽)은 claude CLI 가 읽어야 해서 제거할 수 없다 — 요구명세
      // §소비자 경계의 문서화된 잔여 노출이며, 최종 제거는 MCP proxy 단계 몫이다.
      await rm(join(bak, 'plugins', ORCA_PLUGIN_NAME, '.mcp.json'), { force: true })
      actions.push('backup dist → .bak (mcp secret 스크럽)')
    } catch (e) {
      getLogger()
        .child('extensions')
        .warn('extensions.deploy.backup-failed', { message: String(e), overwrite: true })
      await rm(dist, { recursive: true, force: true })
    }
  }

  let mcpConfig: ClaudeMcpConfig = {}
  if (opts.mcpConfig) {
    mcpConfig = opts.mcpConfig
    actions.push('render enabled mcp → plugins/orca/.mcp.json')
  } else if (existsSync(mcpSrc)) {
    const parsed = readJsonFile(mcpSrc)
    if (isRecord(parsed)) {
      mcpConfig = (parsed.mcpServers as ClaudeMcpConfig | undefined) ?? {}
      actions.push('copy mcp → plugins/orca/.mcp.json')
    } else {
      actions.push('render empty mcp → plugins/orca/.mcp.json (invalid source)')
    }
  } else {
    actions.push('render empty mcp → plugins/orca/.mcp.json')
  }

  await renderClaudeHarnessPlugin({
    engine,
    root,
    skillRoots: opts.skillRoots ?? [
      {
        sourceId: 'orca',
        sourceLabel: 'Orca 스킬',
        sourceKind: 'orca',
        rootDir: join(sources, 'skills')
      }
    ],
    mcpConfig
  })
  actions.push('render orca plugin → dist/plugins/orca')

  // 사용자 ~/.claude/skills 래퍼 플러그인(0117) — 대상 부재/링크 실패는 렌더러가 null 로 강등.
  const userPluginRoot = adapterSkillsRoot
    ? await renderClaudeUserSkillsPlugin({ root, engine, skillsTarget: adapterSkillsRoot })
    : null
  actions.push(userSkillsAction(userPluginRoot !== null))
  actions.push('skip commands/settings dist copy')

  // 배포 마커(드리프트 식별·디버깅용).
  await writeFile(
    join(dist, '.orca-deploy.json'),
    JSON.stringify({ engine, at: Date.now() }, null, 2),
    'utf8'
  )

  return { engine, dryRun, actions, backedUp, validation }
}
