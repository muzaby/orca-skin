import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { PluginSnapshots } from './plugin-snapshots'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-publications-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})
it('pins MCP/skill bytes for existing owners, publishes new defaults and reclaims retired leases', async () => {
  const source = join(root, 'source'),
    base = join(root, 'private')
  await mkdir(join(source, '.claude-plugin'), { recursive: true })
  await writeFile(join(source, '.claude-plugin/plugin.json'), '{"name":"orca"}')
  await writeFile(join(source, '.mcp.json'), '{"mcpServers":{"original":{}}}')
  await writeFile(join(source, 'SKILL.md'), 'old skill')
  const snapshots = new PluginSnapshots(base)
  await snapshots.publish([source])
  const old = snapshots.capture([source])
  await writeFile(join(source, '.mcp.json'), '{"mcpServers":{"next":{}}}')
  await writeFile(join(source, 'SKILL.md'), 'new skill')
  await snapshots.publish([source])
  const next = snapshots.capture([source])
  expect(await readFile(join(old.roots[0], '.mcp.json'), 'utf8')).toContain('original')
  expect(await readFile(join(old.roots[0], 'SKILL.md'), 'utf8')).toBe('old skill')
  expect(await readFile(join(next.roots[0], '.mcp.json'), 'utf8')).toContain('next')
  expect((await readdir(base)).length).toBe(2)
  old.release()
  old.release()
  next.release()
  await snapshots.close()
  expect(await readdir(base)).toEqual([])
})
it('keeps the prior publication on failure and omits absent managed roots without mutable fallback', async () => {
  const source = join(root, 'source')
  await mkdir(join(source, '.claude-plugin'), { recursive: true })
  await writeFile(join(source, '.claude-plugin/plugin.json'), '{}')
  const snapshots = new PluginSnapshots(join(root, 'private'))
  await snapshots.publish([source, join(root, 'absent')])
  const before = snapshots.capture([source, join(root, 'absent'), join(root, 'static-profile')])
  expect(before.roots).toHaveLength(2)
  await writeFile(join(root, 'not-a-directory'), 'invalid')
  await expect(snapshots.publish([join(root, 'not-a-directory')])).rejects.toThrow()
  const after = snapshots.capture([source])
  expect(after.roots[0]).toBe(before.roots[0])
  before.release()
  after.release()
  await snapshots.close()
})
