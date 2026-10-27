import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import type { OrcaMcpConfig } from '../adapters/common/mcp-config'
import { PRODUCT_SLUG } from '../../shared/product'

const fixture = vi.hoisted(() => ({ root: '' }))
vi.mock('../infra/config/paths', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../infra/config/paths')>()),
  orcaConfigDir: () => fixture.root
}))
vi.mock('../infra/error-report', () => ({ reportError: vi.fn() }))
import { createClaudeDeploymentService } from './harnesses/claude/extensions'

it('retains resolved Claude MCP publication through the actual deployment service and plugin writer', async () => {
  fixture.root = await mkdtemp(join(tmpdir(), 'orca-managed-claude-'))
  const source = join(fixture.root, 'sources', 'mcp', 'mcp.json')
  const config: OrcaMcpConfig = {
    stdio: { command: 'distinct-command', args: ['two words', ''], env: { TOKEN: '${TOKEN}' } },
    http: { type: 'http', url: 'https://http.test', headers: { Authorization: '${TOKEN}' } },
    sse: { type: 'sse', url: 'https://sse.test', headers: { 'X-User': '${USER}' } },
    unresolved: { command: 'unresolved-command', env: { TOKEN: '${MISSING}' } }
  }
  const raw = JSON.stringify({ mcpServers: config })
  const publish = vi.fn(async (roots: readonly string[]) => {
    expect(roots[0]).toBe(join(fixture.root, 'dist', 'claude', 'plugins', PRODUCT_SLUG))
    expect(JSON.parse(await readFile(join(roots[0], '.mcp.json'), 'utf8'))).toEqual({
      mcpServers: {
        stdio: {
          command: 'distinct-command',
          args: ['two words', ''],
          env: { TOKEN: 'secret-claude' }
        },
        http: {
          type: 'http',
          url: 'https://http.test',
          headers: { Authorization: 'secret-claude' }
        },
        sse: { type: 'sse', url: 'https://sse.test', headers: { 'X-User': 'distinct-user' } }
      }
    })
  })
  const service = createClaudeDeploymentService(
    {
      enabledConfig: () => config,
      resolver: () => (key) =>
        ({ TOKEN: 'secret-claude', USER: 'distinct-user' })[key as 'TOKEN' | 'USER']
    },
    () => [],
    publish
  )
  try {
    await mkdir(join(fixture.root, 'sources', 'mcp'), { recursive: true })
    await writeFile(source, raw)
    await service.deployNow({ throwOnFailure: true })
    expect(publish).toHaveBeenCalledOnce()
    expect(await readFile(source, 'utf8')).toBe(raw)
    expect(raw).not.toContain('secret-claude')
  } finally {
    await service.close()
    await rm(fixture.root, { recursive: true, force: true })
  }
})
