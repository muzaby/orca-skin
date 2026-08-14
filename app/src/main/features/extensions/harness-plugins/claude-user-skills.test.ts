import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderClaudeUserSkillsPlugin, userClaudePluginRoot } from './claude-user-skills'

let root: string
let target: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-user-plugin-'))
  target = join(root, 'home-claude-skills')
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function seedTarget(): void {
  mkdirSync(join(target, 'native'), { recursive: true })
  writeFileSync(join(target, 'native', 'SKILL.md'), '# native', 'utf8')
}

describe('renderClaudeUserSkillsPlugin', () => {
  it('대상 skills 디렉토리 부재 시 null — 아무것도 만들지 않는다 (클린 머신 정상)', async () => {
    const out = await renderClaudeUserSkillsPlugin({ root, engine: 'claude', skillsTarget: target })
    expect(out).toBeNull()
    expect(existsSync(userClaudePluginRoot(root, 'claude'))).toBe(false)
  })

  it('대상이 디렉토리가 아니면(파일) null', async () => {
    writeFileSync(target, 'not-a-dir', 'utf8')
    const out = await renderClaudeUserSkillsPlugin({ root, engine: 'claude', skillsTarget: target })
    expect(out).toBeNull()
  })

  it('매니페스트(name=claude) + skills 링크(→ 대상)를 렌더한다', async () => {
    seedTarget()
    const out = await renderClaudeUserSkillsPlugin({ root, engine: 'claude', skillsTarget: target })
    const pluginRoot = userClaudePluginRoot(root, 'claude')
    expect(out).toBe(pluginRoot)
    expect(
      JSON.parse(readFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'))
    ).toEqual({
      name: 'claude',
      description: '사용자 ~/.claude/skills 래퍼 (settingSources user 배제 보전)',
      version: '1.0.0'
    })
    const link = join(pluginRoot, 'skills')
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readlinkSync(link)).toBe(target)
    // 링크 경유로 스킬 파일이 실제로 보인다.
    expect(readFileSync(join(link, 'native', 'SKILL.md'), 'utf8')).toBe('# native')
  })

  it('재실행(잔존 링크)에도 멱등 — 링크를 재생성하고 같은 루트를 반환한다', async () => {
    seedTarget()
    const first = await renderClaudeUserSkillsPlugin({
      root,
      engine: 'claude',
      skillsTarget: target
    })
    const second = await renderClaudeUserSkillsPlugin({
      root,
      engine: 'claude',
      skillsTarget: target
    })
    expect(second).toBe(first)
    expect(readlinkSync(join(second!, 'skills'))).toBe(target)
  })

  it('skills 자리에 실디렉토리 잔존물이 있어도 링크로 교체한다 (복사 폴백 잔재 방어)', async () => {
    seedTarget()
    const pluginRoot = userClaudePluginRoot(root, 'claude')
    mkdirSync(join(pluginRoot, 'skills', 'stale'), { recursive: true })
    const out = await renderClaudeUserSkillsPlugin({ root, engine: 'claude', skillsTarget: target })
    expect(out).toBe(pluginRoot)
    expect(lstatSync(join(pluginRoot, 'skills')).isSymbolicLink()).toBe(true)
  })

  it('백업/삭제 사이클(rename → rm recursive)이 링크 대상 원본을 보존한다 (AC#7)', async () => {
    seedTarget()
    await renderClaudeUserSkillsPlugin({ root, engine: 'claude', skillsTarget: target })
    const dist = join(root, 'dist', 'claude')
    const bak = `${dist}.bak`
    // deployer 의 backup-then-write 동작 재현: dist 를 .bak 으로 옮긴 뒤 롤링 삭제.
    renameSync(dist, bak)
    rmSync(bak, { recursive: true, force: true })
    // 링크 자체는 사라지고 원본은 그대로 — rm 이 링크를 따라가면 여기서 사라진다.
    expect(existsSync(bak)).toBe(false)
    expect(readFileSync(join(target, 'native', 'SKILL.md'), 'utf8')).toBe('# native')
  })
})
