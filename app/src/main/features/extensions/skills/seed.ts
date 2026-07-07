import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { writeJsonAtomic } from '../../../infra/config/json-file'
import { isWithinDir } from '../../../infra/config/paths'
import { PROVIDER_NAME_RE } from '../../../infra/config/provider-key'

const MANIFEST = 'manifest.json'
const MARKER = '.orca-builtin.json'
// skill 디렉토리명 = 안전한 경로 세그먼트만(traversal 방어). provider/MCP 키와 동일 SSOT 제약.
const SAFE_NAME = PROVIDER_NAME_RE

interface BuiltinSkillSet {
  version: string
  skills: string[]
}

export interface SeedResult {
  seeded: string[]
  pruned: string[]
  skipped: boolean
  version: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validSkillNames(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const names: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') return null
    if (!SAFE_NAME.test(item)) continue
    if (seen.has(item)) continue
    seen.add(item)
    names.push(item)
  }
  return names
}

// manifest(builtinDir) 와 marker(skillsDir) 는 동형 스키마(`{version, skills[]}`)라 단일 리더로 파싱한다.
// 파일 부재/JSON 손상/스키마 불일치는 모두 null → 호출자가 안전측(no-op / marker 없음)으로 처리한다.
function readBuiltinJson(path: string): BuiltinSkillSet | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  if (typeof parsed.version !== 'string' || parsed.version.trim() === '') return null
  const skills = validSkillNames(parsed.skills)
  if (skills === null) return null
  return { version: parsed.version, skills }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function safeSkillPath(root: string, name: string): string | null {
  if (!SAFE_NAME.test(name)) return null
  const path = join(root, name)
  return isWithinDir(path, root) ? path : null
}

export function seedBuiltinSkills(builtinDir: string, skillsDir: string): SeedResult {
  const manifest = readBuiltinJson(join(builtinDir, MANIFEST))
  if (!manifest) return { seeded: [], pruned: [], skipped: true, version: null }

  const marker = readBuiltinJson(join(skillsDir, MARKER))
  if (marker?.version === manifest.version) {
    return { seeded: [], pruned: [], skipped: true, version: manifest.version }
  }

  mkdirSync(skillsDir, { recursive: true })

  const seeded: string[] = []
  for (const name of manifest.skills) {
    const src = safeSkillPath(builtinDir, name)
    const dest = safeSkillPath(skillsDir, name)
    if (!src || !dest || !isDirectory(src)) continue
    rmSync(dest, { recursive: true, force: true })
    cpSync(src, dest, { recursive: true, force: true })
    seeded.push(name)
  }

  const current = new Set(seeded)
  const pruned: string[] = []
  for (const name of marker?.skills ?? []) {
    if (current.has(name)) continue
    const dest = safeSkillPath(skillsDir, name)
    if (!dest || !existsSync(dest)) continue
    rmSync(dest, { recursive: true, force: true })
    pruned.push(name)
  }

  writeJsonAtomic(join(skillsDir, MARKER), {
    version: manifest.version,
    skills: seeded,
    at: Date.now()
  })

  return { seeded, pruned, skipped: false, version: manifest.version }
}
