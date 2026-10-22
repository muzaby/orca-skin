// SKILL.md frontmatter 스캐너 — Orca sources/skills 와 어댑터가 제공한 skill root 목록을
// 받아 각 root 하위 디렉토리의 SKILL.md 를 SkillInfo 로 정규화한다. SDK headless 모드는
// 슬래시 명령 목록을 제공하지 않으므로 백엔드가 직접 디렉토리를 스캔한다.

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { skillMetadata } from '../../../../adapters/common/skill-metadata'
import type { SkillInfo } from '../../../../../shared/ipc'
import { isRecord } from '../../../../../shared/obj'

export interface SkillScanRoot {
  sourceId: string
  sourceLabel: string
  sourceKind: 'orca' | 'adapter' | 'workspace'
  rootDir: string
  /** Explicit native plugin files, with their exact slash-command names. */
  files?: readonly { file: string; name: string; enabled?: boolean }[]
  /** Only entries recorded in this installation lock are visible. */
  lockFile?: string
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
  let allowed: Set<string> | undefined
  if (root.lockFile) {
    try {
      const lock: unknown = JSON.parse(await fs.readFile(root.lockFile, 'utf8'))
      allowed = new Set(isRecord(lock) && isRecord(lock.skills) ? Object.keys(lock.skills) : [])
    } catch {
      allowed = new Set()
    }
  }
  const files: NonNullable<SkillScanRoot['files']> =
    root.files ??
    entries
      .filter(
        (dir) => (dir.isDirectory() || dir.isSymbolicLink()) && (!allowed || allowed.has(dir.name))
      )
      .map((dir) => ({ file: join(root.rootDir, dir.name, 'SKILL.md'), name: '' }))
  const skills = await Promise.all(
    files.map(async (entry): Promise<SkillInfo | null> => {
      const skillPath = entry.file
      const skillDir = join(skillPath, '..')
      const [text, stat] = await Promise.all([
        fs.readFile(skillPath, 'utf8').catch(() => null),
        fs.stat(skillPath).catch(() => null)
      ])
      if (text === null || !stat?.isFile()) return null
      const meta = skillMetadata(text)
      if (meta['user-invocable'] === 'false') return null
      const name = entry.name || meta.name || skillDir.split(/[\\/]/).at(-1)!
      return {
        name,
        description: meta.description ?? '',
        ...(meta['argument-hint'] ? { argumentHint: meta['argument-hint'] } : {}),
        sourceId: root.sourceId,
        sourceLabel: root.sourceLabel,
        enabled:
          root.sourceKind === 'orca' || root.sourceId === 'adapter:claude'
            ? (enabled[skillEnabledKey(root.sourceId, name)] ?? true)
            : (entry.enabled ?? true),
        body: bodyWithoutFrontmatter(text),
        sourceKind: root.sourceKind,
        canToggle: root.sourceKind === 'orca' || root.sourceId === 'adapter:claude',
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
