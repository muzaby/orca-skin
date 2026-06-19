import { promises as fs } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { sourcesSkillsDir } from '../config/paths'

function sanitizeSkillName(name: string): string {
  return name
    .replace(/\.(md|skill)$/i, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function escapeYaml(value: string): string {
  return JSON.stringify(value)
}

export async function writeAuthoredSkill(input: {
  name: string
  description: string
  body: string
}): Promise<void> {
  const name = sanitizeSkillName(input.name)
  if (!name) throw new Error('스킬 이름이 비어 있습니다.')
  const dir = join(sourcesSkillsDir(), name)
  await fs.mkdir(dir, { recursive: true })
  const content = [
    '---',
    `name: ${escapeYaml(name)}`,
    `description: ${escapeYaml(input.description.trim())}`,
    '---',
    '',
    input.body.trim() || input.description.trim(),
    ''
  ].join('\n')
  await fs.writeFile(join(dir, 'SKILL.md'), content, 'utf8')
}

export async function writeUploadedSkill(input: {
  fileName: string
  content: string
}): Promise<void> {
  const ext = extname(input.fileName).toLowerCase()
  if (ext !== '.md' && ext !== '.skill') {
    throw new Error('.md 또는 .skill 파일만 지원합니다.')
  }
  const name = sanitizeSkillName(basename(input.fileName)) || 'uploaded-skill'
  const dir = join(sourcesSkillsDir(), name)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(join(dir, 'SKILL.md'), input.content, 'utf8')
}

export async function removeOrcaSkillDir(skillDir: string): Promise<void> {
  if (!skillDir.startsWith(sourcesSkillsDir())) {
    throw new Error('Orca 스킬 sources 안의 항목만 제거할 수 있습니다.')
  }
  await fs.rm(skillDir, { recursive: true, force: true })
}
