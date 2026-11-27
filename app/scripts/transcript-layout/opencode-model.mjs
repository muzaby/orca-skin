// The real OpenCode CLI uses its OpenAI-compatible provider to reach this local endpoint.
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { scaleMs } from '../test-time.mjs'

export async function configureOpenCode(root, base, cwd) {
  const cli = process.env.ORCINUS_ORCA_TEST_OPENCODE_EXE ?? 'opencode'
  const config = {
    model: 'fixture/local',
    small_model: 'fixture/local',
    enabled_providers: ['fixture'],
    lsp: false,
    formatter: false,
    provider: {
      fixture: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Fixture',
        options: { baseURL: base + '/v1', apiKey: 'layout-local-fixture' },
        models: { local: { name: 'Local', limit: { context: 32768, output: 1024 } } }
      }
    }
  }
  for (const [path, value] of [
    [
      join(
        process.env.HOME,
        '.config',
        'orcinus-orca',
        'sources',
        'settings',
        'opencode',
        'fixture',
        'settings.json'
      ),
      config
    ],
    [
      join(process.env.XDG_CONFIG_HOME, 'opencode', 'opencode.json'),
      { $schema: 'https://opencode.ai/config.json', ...config }
    ],
    [
      join(root, 'app', 'orcinus-orca-settings.json'),
      { harnesses: { opencode: { executablePath: cli, autoApprovePermissions: true } } }
    ]
  ]) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(value))
  }
  await promisify(execFile)(cli, ['db', 'select count(*) from sqlite_master'], {
    cwd,
    timeout: scaleMs(60_000)
  })
}

export function finishOpenCode(res, body, result) {
  const delta = { role: 'assistant', content: result }
  const base = {
    id: 'layout-local',
    model: body.model,
    created: 1,
    usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 }
  }
  if (!body.stream) {
    res.writeHead(200, { 'content-type': 'application/json' }).end(
      JSON.stringify({
        ...base,
        object: 'chat.completion',
        choices: [{ index: 0, message: delta, finish_reason: 'stop' }]
      })
    )
    return
  }
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  for (const [part, reason] of [
    [delta, null],
    [{}, 'stop']
  ]) {
    res.write(
      'data: ' +
        JSON.stringify({
          ...base,
          object: 'chat.completion.chunk',
          choices: [{ index: 0, delta: part, finish_reason: reason }]
        }) +
        '\n\n'
    )
  }
  res.end('data: [DONE]\n\n')
}
