// 0291 — `OpenCodeServerPool.listModels` (EP-09·EP-10). 실제 프로세스를 띄우지 않고 `runCli` seam 으로
// 실행 인자·환경·한계를 관측한다. 판정 함수는 서버 start 와 같은 것이다.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { OPENCODE_CLI_VERSION_MESSAGE, OpenCodeCliError, OpenCodeServerPool } from './server'
import type { OpenCodeCliOptions } from './server'

const pools: OpenCodeServerPool[] = []
afterEach(() => {
  for (const pool of pools.splice(0)) pool.close()
})

const STDOUT = [
  'corp/gpt-x',
  '{',
  '  "id": "gpt-x",',
  '  "name": "GPT X",',
  '  "variants": { "high": {}, "off": { "disabled": true } }',
  '}',
  'corp/mini',
  ''
].join('\n')

function setup(options: { version?: string; executable?: () => string } = {}): {
  pool: OpenCodeServerPool
  runCli: ReturnType<
    typeof vi.fn<
      (
        exe: string,
        args: readonly string[],
        options: OpenCodeCliOptions
      ) => Promise<{ stdout: string }>
    >
  >
} {
  const runCli = vi.fn<
    (
      exe: string,
      args: readonly string[],
      options: OpenCodeCliOptions
    ) => Promise<{ stdout: string }>
  >(async () => ({ stdout: STDOUT }))
  const pool = new OpenCodeServerPool({
    dataDirectory: '/tmp/unused',
    preferences: () => undefined,
    fetchImpl: vi.fn<typeof fetch>(),
    executable: options.executable ?? (() => '/opt/opencode/bin/opencode'),
    readVersion: async () => options.version ?? '1.18.27',
    runCli
  })
  pools.push(pool)
  return { pool, runCli }
}

describe('OpenCodeServerPool.listModels (0291)', () => {
  it('listModels runs the models command with the server executable', async () => {
    const { pool, runCli } = setup()
    const signal = new AbortController().signal
    const models = await pool.listModels('corp', { signal, env: { CORP_TOKEN_HINT: 'x' } })
    expect(models).toEqual([
      { id: 'corp/gpt-x', name: 'GPT X', variants: ['high'] },
      { id: 'corp/mini' }
    ])
    expect(runCli).toHaveBeenCalledOnce()
    const [exe, args, cli] = runCli.mock.calls[0]!
    expect(exe).toBe('/opt/opencode/bin/opencode')
    expect(args).toEqual(['models', 'corp', '--verbose', '--pure'])
    expect(cli.cwd).toBe(resolve(homedir()))
    expect(cli.env.OPENCODE_DISABLE_PROJECT_CONFIG).toBe('true')
    expect(cli.env.CORP_TOKEN_HINT).toBe('x')
    expect(cli.env.PATH).toBe(process.env.PATH)
    expect(cli).toMatchObject({ windowsHide: true, timeout: 60_000, maxBuffer: 16 * 1024 * 1024 })
  })

  it('listModels rejects unsupported versions and missing executables like start', async () => {
    const old = setup({ version: '2.0.0' })
    await expect(
      old.pool.listModels('corp', { signal: new AbortController().signal })
    ).rejects.toThrow(OPENCODE_CLI_VERSION_MESSAGE)
    await expect(old.pool.acquire()).rejects.toThrow(OPENCODE_CLI_VERSION_MESSAGE)
    expect(old.runCli).not.toHaveBeenCalled()
    const missing = setup({
      executable: () => {
        throw new Error('OpenCode 실행 파일을 찾을 수 없습니다.')
      }
    })
    await expect(
      missing.pool.listModels('corp', { signal: new AbortController().signal })
    ).rejects.toThrow('OpenCode 실행 파일을 찾을 수 없습니다.')
    expect(missing.runCli).not.toHaveBeenCalled()
  })

  it.each(['--help', '../x', '', 'a b', '-p'])(
    'rejects provider id %j without running',
    async (id) => {
      const { pool, runCli } = setup()
      await expect(pool.listModels(id, { signal: new AbortController().signal })).rejects.toThrow(
        'provider id'
      )
      expect(runCli).not.toHaveBeenCalled()
    }
  )

  it('listModels aborts on caller signal and pool close', async () => {
    const { pool, runCli } = setup()
    const seen: AbortSignal[] = []
    runCli.mockImplementation(async (_exe, _args, cli) => {
      seen.push(cli.signal)
      return { stdout: '' }
    })
    const caller = new AbortController()
    await pool.listModels('corp', { signal: caller.signal })
    await pool.listModels('corp', { signal: new AbortController().signal })
    caller.abort()
    expect(seen[0]!.aborted).toBe(true)
    expect(seen[1]!.aborted).toBe(false)
    pool.close()
    expect(seen[1]!.aborted).toBe(true)
  })

  it('reports the last stderr line when the command fails', async () => {
    const { pool, runCli } = setup()
    runCli.mockRejectedValueOnce(
      new OpenCodeCliError('Command failed', 'warn: x\nError: Provider not found: corp\n\n')
    )
    await expect(pool.listModels('corp', { signal: new AbortController().signal })).rejects.toThrow(
      'OpenCode 모델 목록을 가져오지 못했습니다: Error: Provider not found: corp'
    )
  })
})
