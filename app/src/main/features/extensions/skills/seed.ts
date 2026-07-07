import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { writeJsonAtomic } from '../../../infra/config/json-file'

const MANIFEST = 'manifest.json'
const MARKER = '.orca-builtin.json'
const SAFE_NAME = /^[A-Za-z0-9_-]+$/

interface BuiltinManifest {
  version: string
  skills: string[]
}

interface BuiltinMarker {
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

function readJson(path: string): unknown | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function readManifest(builtinDir: string): BuiltinManifest | null {
  const parsed = readJson(join(builtinDir, MANIFEST))
  if (!isRecord(parsed)) return null
  if (typeof parsed.version !== 'string' || parsed.version.trim() === '') return null
  const skills = validSkillNames(parsed.skills)
  if (skills === null) return null
  return { version: parsed.version, skills }
}

function readMarker(skillsDir: string): BuiltinMarker | null {
  const parsed = readJson(join(skillsDir, MARKER))
  if (!isRecord(parsed)) return null
  if (typeof parsed.version !== 'string' || parsed.version.trim() === '') return null
  const skills = validSkillNames(parsed.skills)
  if (skills === null) return null
  return { version: parsed.version, skills }
}

function isWithinDir(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
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
  const manifest = readManifest(builtinDir)
  if (!manifest) return { seeded: [], pruned: [], skipped: true, version: null }

  const marker = readMarker(skillsDir)
  if (marker?.version === manifest.version) {
    return { seeded: [], pruned: [], skipped: true, version: manifest.version }
  }

  mkdirSync(skillsDir, { recursive: true })

  const seeded: string[] = []
  const managedSkills: string[] = []
  for (const name of manifest.skills) {
    const src = safeSkillPath(builtinDir, name)
    const dest = safeSkillPath(skillsDir, name)
    if (!src || !dest || !isDirectory(src)) continue
    rmSync(dest, { recursive: true, force: true })
    cpSync(src, dest, { recursive: true, force: true })
    seeded.push(name)
    managedSkills.push(name)
  }

  const current = new Set(managedSkills)
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
    skills: managedSkills,
    at: Date.now()
  })

  return { seeded, pruned, skipped: false, version: manifest.version }
}
