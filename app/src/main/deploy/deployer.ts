// ExtensionDeployer — 사람이 편집한 정규 소스(sources/)를 엔진 규약 산출물(dist/<engine>/)로 배포한다
// (standardization.md §5.2). 다단계 파이프라인/다중 drift 정책을 두지 않고 안전한 기본 동작 하나로
// 시작한다: render(sources→engine 규약) → validate(특히 MCP 키 이름) → dryRun ? 계획 : backup-then-write.
//
// claude-code 축별 동작:
//   instructions : AGENTS.md 는 런타임 systemPromptAppend 로 주입(ExtensionBuilder) → dist 파일 미생성(중립).
//   skills/agents/commands : sources/ → dist/<engine>/plugin/ 으로 **복사**(심링크 아님 — 샌드박스 이슈 회피).
//   mcp : claude 는 MCP 를 파일이 아니라 query() options 로 런타임 주입 → 여기선 **키 이름 검증만**.
//   hooks : sources/hooks/<engine>/ → dist/<engine>/plugin/hooks 로 **변환 없이 복사만**(표준 부재 §2).
//   manifest : dist/<engine>/plugin/.claude-plugin/plugin.json 작성(claude 로컬 플러그인 루트).
//   settings : sources/settings/<engine>/<provider>/settings.json → dist/<engine>/<provider>/.claude/
//              settings.json 으로 **복사**(handoff 0014). 플러그인 스펙엔 settings.json 이 없으므로
//              플러그인 루트(plugin/) 밖 provider 디렉토리에 두고, 런타임은 SDK resolveSettings 의
//              project 소스 고정 경로(<cwd>/.claude/settings.json)에 맞춰 cwd 로 이 디렉토리를 넘긴다.
//              meta.json(어댑터당 1개, Orca 메타)은 dist 로 가지 않는다 — sources 에서 직접 읽는다.
//
// dist/<engine> 는 편집 대상이 아니다. 무단 덮어쓰기를 막기 위해 기록 전 항상 백업한다(.bak 1개 롤링).
// 레이아웃은 paths.ts 의 sources*/dist* 헬퍼와 일치해야 한다 — 본 함수는 테스트 용이성을 위해 root 를
// 받아 상대 경로로 계산한다(homedir 비의존). 기본값은 orcaConfigDir().

import {
  existsSync,
  mkdirSync,
  writeFileSync,
  cpSync,
  rmSync,
  renameSync,
  readFileSync,
  readdirSync,
  type Dirent
} from 'node:fs'
import { join } from 'node:path'
import type { Backend } from '../../shared/ipc'
import { orcaConfigDir } from '../config/paths'

export interface DeployOptions {
  dryRun?: boolean
}

export interface DeployResult {
  engine: Backend
  dryRun: boolean
  actions: string[]
  backedUp: boolean
  validation: { ok: boolean; errors: string[] }
}

const MCP_KEY_RE = /^[A-Za-z0-9_-]+$/
// provider 디렉토리 이름 = providerKey(`${adapter}-${provider}`)의 구성 요소 — MCP 키와 동일 제약.
const PROVIDER_NAME_RE = /^[A-Za-z0-9_-]+$/

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

// src 디렉토리를 dest 로 복사(없으면 빈 dest 생성). dist 는 매 배포 새로 만들므로 force:true.
function copyDir(src: string, dest: string): void {
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true, force: true })
  } else {
    mkdirSync(dest, { recursive: true })
  }
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
  const plugin = join(dist, 'plugin')
  const actions: string[] = []

  const mcpValidation = validateMcp(join(sources, 'mcp', 'mcp.json'))
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
    actions.push('render manifest + copy skills/agents/commands/hooks → dist/plugin')
    actions.push(`copy settings (${settingsScan.providers.length} provider(s))`)
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

  // manifest (claude 로컬 플러그인 루트 = dist/<engine>/plugin/).
  mkdirSync(join(plugin, '.claude-plugin'), { recursive: true })
  writeFileSync(
    join(plugin, '.claude-plugin', 'plugin.json'),
    JSON.stringify(
      {
        name: 'orca',
        description: 'Orca 정규 확장(skills/agents/commands) — Orca 가 관리',
        version: '1.0.0'
      },
      null,
      2
    ),
    'utf8'
  )
  actions.push('write manifest')

  copyDir(join(sources, 'skills'), join(plugin, 'skills'))
  copyDir(join(sources, 'agents'), join(plugin, 'agents'))
  copyDir(join(sources, 'commands'), join(plugin, 'commands'))
  copyDir(join(sources, 'hooks', engine), join(plugin, 'hooks'))
  actions.push('copy skills/agents/commands/hooks')

  // provider settings — 검증 통과한 provider 만. settings.json 부재 디렉토리도 provider 로
  // 인정하되 dist 파일은 만들지 않는다(런타임 격리모드에서 settings 없이 동작).
  for (const provider of settingsScan.providers) {
    const src = join(sources, 'settings', engine, provider, 'settings.json')
    if (!existsSync(src)) continue
    const destDir = join(dist, provider, '.claude')
    mkdirSync(destDir, { recursive: true })
    cpSync(src, join(destDir, 'settings.json'), { force: true })
  }
  actions.push(`copy settings (${settingsScan.providers.length} provider(s))`)

  // 배포 마커(드리프트 식별·디버깅용).
  writeFileSync(
    join(dist, '.orca-deploy.json'),
    JSON.stringify({ engine, at: Date.now() }, null, 2),
    'utf8'
  )

  return { engine, dryRun, actions, backedUp, validation }
}
