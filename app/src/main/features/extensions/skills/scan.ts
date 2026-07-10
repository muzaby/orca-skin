// SKILL.md frontmatter 스캐너 — Orca sources/skills 와 어댑터가 제공한 skill root 목록을
// 받아 각 root 하위 디렉토리의 SKILL.md 를 SkillInfo 로 정규화한다. SDK headless 모드는
// 슬래시 명령 목록을 제공하지 않으므로 백엔드가 직접 디렉토리를 스캔한다.

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { SkillInfo } from '../../../../shared/ipc'

export interface SkillScanRoot {
  sourceId: string
  sourceLabel: string
  sourceKind: 'orca' | 'adapter' | 'workspace'
  rootDir: string
}

interface Frontmatter {
  name?: string
  description?: string
  'argument-hint'?: string
}

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
    if (key === 'name' || key === 'description' || key === 'argument-hint') result[key] = value
  }
  return result
}

function bodyWithoutFrontmatter(text: string): string {
  return text.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*/, '').trim()
}

export function skillEnabledKey(sourceId: string, name: string): string {
  return `${sourceId}/${name}`
}

// 스킬 디렉토리별 read/stat 을 병렬 수행한다(부팅 skill-scan 스텝 지연 축소, 0092). 반환 순서는
// readdir 항목 순서를 보존한다 — 같은 root 안에서 frontmatter name 이 충돌하면 뒤 항목이 이긴다
// (기존 순차 스캔과 동일한 dedup 규칙).
async function scanRoot(
  root: SkillScanRoot,
  enabled: Record<string, boolean>
): Promise<SkillInfo[]> {
  const entries = await fs.readdir(root.rootDir, { withFileTypes: true }).catch(() => [])
  const skills = await Promise.all(
    entries
      .filter((dir) => dir.isDirectory())
      .map(async (dir): Promise<SkillInfo | null> => {
        const skillDir = join(root.rootDir, dir.name)
        const skillPath = join(skillDir, 'SKILL.md')
        const [text, stat] = await Promise.all([
          fs.readFile(skillPath, 'utf8').catch(() => null),
          fs.stat(skillPath).catch(() => null)
        ])
        if (text === null) return null
        const meta = parseFrontmatter(text)
        const name = meta.name ?? dir.name
        return {
          name,
          description: meta.description ?? '',
          ...(meta['argument-hint'] ? { argumentHint: meta['argument-hint'] } : {}),
          sourceId: root.sourceId,
          sourceLabel: root.sourceLabel,
          enabled:
            root.sourceKind === 'orca'
              ? (enabled[skillEnabledKey(root.sourceId, name)] ?? true)
              : true,
          body: bodyWithoutFrontmatter(text),
          sourceKind: root.sourceKind,
          canToggle: root.sourceKind === 'orca',
          canRemove: root.sourceKind === 'orca',
          skillPath,
          skillDir,
          ...(stat ? { updatedAt: stat.mtimeMs, createdAt: stat.birthtimeMs } : {})
        }
      })
  )
  return skills.filter((s): s is SkillInfo => s !== null)
}

export async function scanSkills(
  roots: SkillScanRoot[],
  enabled: Record<string, boolean> = {}
): Promise<SkillInfo[]> {
  // root 간에도 병렬 스캔하되, dedup(byKey.set)은 roots 순서대로 적용해 "뒤 root 가 이긴다"
  // 규칙을 보존한다.
  const perRoot = await Promise.all(roots.map((root) => scanRoot(root, enabled)))
  const byKey = new Map<string, SkillInfo>()
  for (const skills of perRoot) {
    for (const s of skills) byKey.set(skillEnabledKey(s.sourceId, s.name), s)
  }
  return [...byKey.values()].sort(
    (a, b) => a.sourceLabel.localeCompare(b.sourceLabel) || a.name.localeCompare(b.name)
  )
}
