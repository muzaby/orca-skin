// ExtensionDeployer — 사람이 편집한 정규 소스(sources/)를 엔진 규약 산출물(dist/<engine>/)로 배포한다
// (standardization.md §5.2). 다단계 파이프라인/다중 drift 정책을 두지 않고 안전한 기본 동작 하나로
// 시작한다: render(sources→engine 규약) → validate(특히 MCP 키 이름) → dryRun ? 계획 : backup-then-write.
//
// claude 축별 동작:
//   instructions : AGENTS.md 는 런타임 systemPromptAppend 로 주입(ExtensionBuilder) → dist 파일 미생성(중립).
//   skills : sources/skills → dist/<engine>/plugins/orca/skills 로 **복사**(Claude plugin 패키지).
//   mcp : 활성 MCP 를 확장한 뒤 dist/<engine>/plugins/orca/.mcp.json 으로 **렌더** + 키 검증.
//   agents/hooks : 빈 디렉토리 스캐폴드(후속 자산 수용). commands/settings 는 dist 로 배포하지 않는다.
//
// dist/<engine> 는 편집 대상이 아니다. 무단 덮어쓰기를 막기 위해 기록 전 항상 백업한다(.bak 1개 롤링).
// 레이아웃은 paths.ts 의 sources*/dist* 헬퍼와 일치해야 한다 — 본 함수는 테스트 용이성을 위해 root 를
// 받아 상대 경로로 계산한다(homedir 비의존). 기본값은 orcaConfigDir().

import {
  existsSync,
  writeFileSync,
  rmSync,
  renameSync,
  readFileSync,
  readdirSync,
  type Dirent
} from 'node:fs'
import { join } from 'node:path'
import type { Backend } from '../../shared/ipc'
import type { ClaudeMcpConfig } from '../mcp/schema'
import type { SkillScanRoot } from '../skills/scan'
import { orcaConfigDir } from '../infra/config/paths'
import { PROVIDER_NAME_RE } from '../infra/config/provider-key'
import { renderClaudePluginPackage } from './claude-plugin-package'

export interface DeployOptions {
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
function validateMcp(mcpJson: string): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  let raw: string
  try {
    raw = readFileSync(mcpJson, 'utf8')
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
function scanProviderSettings(settingsRoot: string): {
  providers: string[]
  errors: string[]
} {
  const providers: string[] = []
  const errors: string[] = []
  let entries: Dirent[]
  try {
    entries = readdirSync(settingsRoot, { withFileTypes: true })
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
    if (existsSync(settingsPath)) {
      try {
        JSON.parse(readFileSync(settingsPath, 'utf8'))
      } catch {
        errors.push(`settings/${entry.name}/settings.json 파싱 실패 — JSON 형식을 확인하세요.`)
        continue
      }
    }
    providers.push(entry.name)
  }
  return { providers, errors }
}

export function deploy(
  engine: Backend,
  opts: DeployOptions = {},
  root: string = orcaConfigDir()
): DeployResult {
  const dryRun = !!opts.dryRun
  const sources = join(root, 'sources')
  const dist = join(root, 'dist', engine)
  const mcpSrc = join(sources, 'mcp', 'mcp.json')
  const actions: string[] = []

  const mcpValidation = validateMcp(mcpSrc)
  const settingsScan = scanProviderSettings(join(sources, 'settings', engine))
  const validation = {
    ok: mcpValidation.ok && settingsScan.errors.length === 0,
    errors: [...mcpValidation.errors, ...settingsScan.errors]
  }

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
    actions.push('skip commands/settings dist copy')
    return { engine, dryRun, actions, backedUp: false, validation }
  }

  // backup-then-write: 기존 dist 를 .bak(롤링 1개)으로 옮긴 뒤 새로 렌더.
  let backedUp = false
  if (existsSync(dist)) {
    const bak = `${dist}.bak`
    try {
      rmSync(bak, { recursive: true, force: true })
      renameSync(dist, bak)
      backedUp = true
      actions.push('backup dist → .bak')
    } catch (e) {
      console.warn('[deploy] dist 백업 실패(덮어쓰기 진행):', e)
      rmSync(dist, { recursive: true, force: true })
    }
  }

  let mcpConfig: ClaudeMcpConfig = {}
  if (opts.mcpConfig) {
    mcpConfig = opts.mcpConfig
    actions.push('render enabled mcp → plugins/orca/.mcp.json')
  } else if (existsSync(mcpSrc)) {
    try {
      const parsed = JSON.parse(readFileSync(mcpSrc, 'utf8')) as { mcpServers?: ClaudeMcpConfig }
      mcpConfig = parsed.mcpServers ?? {}
      actions.push('copy mcp → plugins/orca/.mcp.json')
    } catch {
      actions.push('render empty mcp → plugins/orca/.mcp.json (invalid source)')
    }
  } else {
    actions.push('render empty mcp → plugins/orca/.mcp.json')
  }

  renderClaudePluginPackage({
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
  actions.push('skip commands/settings dist copy')

  // 배포 마커(드리프트 식별·디버깅용).
  writeFileSync(
    join(dist, '.orca-deploy.json'),
    JSON.stringify({ engine, at: Date.now() }, null, 2),
    'utf8'
  )

  return { engine, dryRun, actions, backedUp, validation }
}
