// SKILL.md frontmatter 스캐너 — ~/.claude/skills/ 와 <cwd>/.claude/skills/ 두 경로의
// 하위 디렉토리에서 SKILL.md 를 읽어 SkillInfo 목록을 만든다. SDK headless 모드는
// 슬래시 명령 목록을 제공하지 않으므로 (docs/claude-code-spec.md §5.3) 백엔드가
// 직접 디렉토리를 스캔한다.

import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SkillInfo } from '../../shared/ipc'

interface Frontmatter {
  name?: string
  description?: string
  'argument-hint'?: string
}

// 단순 YAML frontmatter 파서 — `--- ... ---` 사이의 `key: value` 라인만 인식.
// 다중라인 값/배열은 지원하지 않는다. SKILL.md 컨벤션 상 본 3개 키는 한 줄로 충분.
function parseFrontmatter(text: string): Frontmatter {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const result: Frontmatter = {}
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const kv = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.+)$/)
    if (!kv) continue
    const key = kv[1] as keyof Frontmatter
    let value = kv[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key === 'name' || key === 'description' || key === 'argument-hint') {
      result[key] = value
    }
  }
  return result
}

async function scanRoot(root: string): Promise<SkillInfo[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
  const skills: SkillInfo[] = []
  for (const dir of entries) {
    if (!dir.isDirectory()) continue
    const text = await fs.readFile(join(root, dir.name, 'SKILL.md'), 'utf8').catch(() => null)
    if (text === null) continue
    const meta = parseFrontmatter(text)
    const name = meta.name ?? dir.name
    skills.push({
      name,
      description: meta.description ?? '',
      ...(meta['argument-hint'] ? { argumentHint: meta['argument-hint'] } : {})
    })
  }
  return skills
}

export async function scanSkills(cwd: string): Promise<SkillInfo[]> {
  const userRoot = join(homedir(), '.claude', 'skills')
  const projectRoot = join(cwd, '.claude', 'skills')
  // 같은 경로면 한 번만 읽는다 (현재 cwd 가 home 인 흔한 경우).
  const roots = userRoot === projectRoot ? [userRoot] : [userRoot, projectRoot]

  // roots 순서대로 read → Map 으로 누적하면 뒤에 오는(=프로젝트 로컬) skill 이 우선.
  const byName = new Map<string, SkillInfo>()
  for (const root of roots) {
    for (const s of await scanRoot(root)) byName.set(s.name, s)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}
