import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openCodeMainModule } from './module'
import type { OpenCodeAdapter } from '../../../adapters/opencode/v1/adapter'
import { openFileDatabase } from '../../../infra/db/file-database'

const executable = process.env.ORCA_TEST_OPENCODE_EXE
if (!executable) throw new Error('ORCA_TEST_OPENCODE_EXE must point to the tested local 1.x CLI')
const root = mkdtempSync(join(tmpdir(), 'orca-native-cli-'))
const home = join(root, 'home')
const cwd = join(root, 'workspace')
mkdirSync(home, { recursive: true })
mkdirSync(cwd, { recursive: true })
const environment: Record<string, string> = {
  HOME: home,
  USERPROFILE: home,
  APPDATA: join(home, 'AppData', 'Roaming'),
  LOCALAPPDATA: join(home, 'AppData', 'Local'),
  OPENCODE_DISABLE_AUTOUPDATE: '1',
  OPENCODE_DISABLE_MODELS_FETCH: '1',
  OPENCODE_DISABLE_DEFAULT_PLUGINS: '1',
  OPENCODE_DISABLE_EXTERNAL_SKILLS: '1',
  OPENCODE_DISABLE_CLAUDE_CODE: '1',
  OPENCODE_DISABLE_LSP_DOWNLOAD: '1',
  OPENCODE_DISABLE_INSTALL: '1',
  HTTP_PROXY: 'http://127.0.0.1:9',
  HTTPS_PROXY: 'http://127.0.0.1:9',
  ALL_PROXY: 'http://127.0.0.1:9',
  NO_PROXY: '127.0.0.1,localhost'
}
// Only this disposable fixture process's environment is changed.
for (const key of [
  'XDG_DATA_HOME',
  'XDG_CONFIG_HOME',
  'XDG_STATE_HOME',
  'XDG_CACHE_HOME',
  'OPENCODE_DB'
])
  delete process.env[key]
Object.assign(process.env, environment)
const requests: string[] = []
const provider = createServer(async (req, res) => {
  if (req.url === '/models.json') {
    res.end('{}')
    return
  }
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const body = JSON.parse(Buffer.concat(chunks).toString()) as { model: string; stream?: boolean }
  requests.push(body.model)
  const text = 'Native fixture answer'
  if (body.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    for (const [index, delta] of [
      { role: 'assistant', content: '' },
      { content: text },
      {}
    ].entries())
      res.write(
        'data: ' +
          JSON.stringify({
            id: 'fixture',
            object: 'chat.completion.chunk',
            created: 1,
            model: body.model,
            choices: [{ index: 0, delta, finish_reason: index === 2 ? 'stop' : null }],
            ...(index === 2
              ? { usage: { prompt_tokens: 1, completion_tokens: 3, total_tokens: 4 } }
              : {})
          }) +
          '\n\n'
      )
    res.end('data: [DONE]\n\n')
  } else {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        id: 'fixture',
        object: 'chat.completion',
        created: 1,
        model: body.model,
        choices: [
          { index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }
        ],
        usage: { prompt_tokens: 1, completion_tokens: 3, total_tokens: 4 }
      })
    )
  }
})
const cli = (args: string[], env: Record<string, string>): Promise<string> =>
  new Promise((done, reject) => {
    const child = execFile(
      executable!,
      args,
      {
        cwd,
        env: { ...process.env, ...env },
        encoding: 'utf8',
        windowsHide: true,
        timeout: 90000,
        maxBuffer: 8 * 1024 * 1024
      },
      (error, stdout, stderr) =>
        error ? reject(new Error(String(error) + '\n' + stderr + '\n' + stdout)) : done(stdout)
    )
    child.stdin?.end()
  })
const adapters: OpenCodeAdapter[] = []
async function run(fetchImpl: typeof fetch): Promise<void> {
  await new Promise<void>((done) => provider.listen(0, '127.0.0.1', done))
  const port = (provider.address() as { port: number }).port
  environment.OPENCODE_MODELS_URL = 'http://127.0.0.1:' + port + '/models.json'
  const settings = {
    model: 'fixture/body',
    small_model: 'fixture/aux',
    snapshot: false,
    enabled_providers: ['fixture'],
    plugin: [],
    mcp: {},
    lsp: false,
    agent: { title: { model: 'fixture/aux' }, summary: { model: 'fixture/aux' } },
    provider: {
      fixture: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Fixture',
        options: { baseURL: 'http://127.0.0.1:' + port + '/v1', apiKey: 'fixture' },
        models: {
          body: { name: 'Body', limit: { context: 8192, output: 1024 } },
          aux: { name: 'Aux', limit: { context: 8192, output: 1024 } }
        }
      }
    }
  }
  const configDir = join(home, '.config', 'opencode')
  mkdirSync(configDir, { recursive: true })
  const configPath = join(configDir, 'opencode.json')
  const originalConfig = JSON.stringify({
    $schema: 'https://opencode.ai/config.json',
    username: 'native-fixture',
    snapshot: false
  })
  writeFileSync(configPath, originalConfig)
  const projectConfig = join(cwd, 'opencode.json')
  const originalProject = JSON.stringify({
    $schema: 'https://opencode.ai/config.json',
    instructions: []
  })
  writeFileSync(projectConfig, originalProject)
  const makeAdapter = (): OpenCodeAdapter => {
    const adapter = openCodeMainModule.createAdapter({
      dataDirectory: join(root, 'orca'),
      preferences: () => ({ executablePath: executable!, instructions: '' }),
      fetchImpl: async (input, init) => {
        const request = new Request(input, init)
        assert.equal(new URL(request.url).hostname, '127.0.0.1')
        return fetchImpl(request)
      }
    }) as OpenCodeAdapter
    adapters.push(adapter)
    return adapter
  }
  const adapter = makeAdapter()
  const catalog = await adapter.catalog(
    { adapter: 'opencode', key: 'fixture', supported: true, models: [] },
    settings,
    true,
    environment
  )
  assert.ok(catalog.models.some((model) => model.model === 'fixture/body'))
  const providerSettings = {
    provider: 'opencode',
    providerKey: 'fixture',
    sourceRevision: 'fixture',
    settings
  }
  const turn = adapter.sendMessage({
    sessionId: null,
    cwd,
    text: 'ORCA_NATIVE_INITIAL',
    promptUuid: 'queue-id',
    model: 'fixture/body',
    env: environment,
    providerSettings,
    signal: AbortSignal.timeout(90000),
    extensions: { skills: [], hooks: { normalized: {} } }
  })
  let sessionId = ''
  let nativeMessageId = ''
  let answer = ''
  try {
    for await (const batch of turn.eventBatches) {
      for (const event of batch.events) {
        if (event.type === 'session.updated') sessionId = event.sessionId
        if (event.type === 'input.echo') nativeMessageId = event.nativeMessageId ?? ''
        if (event.type === 'message.completed') answer += event.message.text
        if (event.type === 'error') throw new Error(event.error.message)
      }
      if (batch.events.some((event) => event.type === 'turn.ended')) break
    }
  } finally {
    turn.close()
  }
  assert.equal(answer, 'Native fixture answer')
  assert.ok(nativeMessageId.startsWith('msg_'))
  const cliEnv = { ...environment, OPENCODE_CONFIG_CONTENT: JSON.stringify(settings) }
  const path = (await cli(['db', 'path'], cliEnv)).trim()
  assert.equal(
    path.replaceAll('\\', '/'),
    join(home, '.local', 'share', 'opencode', 'opencode.db').replaceAll('\\', '/')
  )
  assert.ok(!existsSync(join(root, 'orca', 'opencode', 'data')))
  const exported = JSON.parse(await cli(['export', sessionId], cliEnv))
  assert.equal(exported.info.id, sessionId)
  assert.ok(
    exported.messages.some((value: { info: { id: string } }) => value.info.id === nativeMessageId)
  )
  await cli(
    ['run', '--session', sessionId, '--model', 'fixture/body', 'CLI_NATIVE_FOLLOWUP'],
    cliEnv
  )
  const reopened = await adapter.readHistory({ sessionId, cwd, env: environment, providerSettings })
  assert.equal(reopened.status, 'ready', JSON.stringify(reopened))
  if (reopened.status !== 'ready') throw new Error('native not ready')
  assert.ok(
    reopened.snapshot.messages.some((message) =>
      message.parts.some(
        (part) => part.type === 'text' && part.text.includes('CLI_NATIVE_FOLLOWUP')
      )
    )
  )
  const beforeAux = JSON.parse(await cli(['session', 'list', '--format', 'json'], cliEnv)).length
  assert.equal(
    await adapter.complete({
      prompt: 'AUXILIARY',
      cwd,
      model: 'fixture/aux',
      env: environment,
      providerSettings
    }),
    'Native fixture answer'
  )
  const afterAux = JSON.parse(await cli(['session', 'list', '--format', 'json'], cliEnv)).length
  assert.equal(afterAux, beforeAux)
  assert.equal(readFileSync(configPath, 'utf8'), originalConfig)
  assert.equal(readFileSync(projectConfig, 'utf8'), originalProject)
  adapter.close()
  const restarted = makeAdapter()
  const restartedClient = await restarted.client(settings, environment, cwd)
  assert.equal(
    (await restartedClient.session.get({ sessionID: sessionId, directory: cwd })).data?.id,
    sessionId
  )
  const restartedHistory = await restarted.readHistory({
    sessionId,
    cwd,
    env: environment,
    providerSettings
  })
  assert.equal(restartedHistory.status, 'ready', JSON.stringify(restartedHistory))
  if (restartedHistory.status !== 'ready') throw new Error('snapshot required')
  assert.equal(restartedHistory.cursor?.checkpoint.kind, 'opencode-sqlite')
  const requestsBeforeRead = requests.length
  const unchanged = await restarted.readHistory({
    sessionId,
    cwd,
    env: environment,
    providerSettings,
    previous: { snapshot: restartedHistory.snapshot, cursor: restartedHistory.cursor }
  })
  assert.equal(unchanged.status, 'unchanged', JSON.stringify(unchanged))
  assert.equal(requests.length, requestsBeforeRead)

  // Reproduce the old Orca-only XDG root, then migrate via the actual module's 404 path.
  const legacyRoot = join(root, 'orca', 'opencode')
  const legacyEnv = {
    ...environment,
    XDG_DATA_HOME: join(legacyRoot, 'data'),
    XDG_CONFIG_HOME: join(legacyRoot, 'config'),
    XDG_STATE_HOME: join(legacyRoot, 'state'),
    XDG_CACHE_HOME: join(legacyRoot, 'cache')
  }
  const legacyAdapter = makeAdapter()
  const legacyTurn = legacyAdapter.sendMessage({
    sessionId: null,
    cwd,
    text: 'LEGACY_NATIVE_INITIAL',
    promptUuid: 'legacy-queue-id',
    model: 'fixture/body',
    env: legacyEnv,
    providerSettings,
    signal: AbortSignal.timeout(90000),
    extensions: { skills: [], hooks: { normalized: {} } }
  })
  let legacyId = ''
  let legacyMessageId = ''
  try {
    for await (const batch of legacyTurn.eventBatches) {
      for (const event of batch.events) {
        if (event.type === 'session.updated') legacyId = event.sessionId
        if (event.type === 'input.echo') legacyMessageId = event.nativeMessageId ?? ''
        if (event.type === 'error') throw new Error(event.error.message)
      }
      if (batch.events.some((event) => event.type === 'turn.ended')) break
    }
  } finally {
    legacyTurn.close()
  }
  legacyAdapter.close()
  const legacyCliEnv = { ...legacyEnv, OPENCODE_CONFIG_CONTENT: JSON.stringify(settings) }
  const originalLegacy = JSON.parse(await cli(['export', legacyId], legacyCliEnv))
  const journal = (database: string, id: string): unknown[] => {
    const db = openFileDatabase(database, { fileMustExist: true, readonly: true })
    try {
      return db.prepare('SELECT * FROM event WHERE aggregate_id=? ORDER BY seq').all(id)
    } finally {
      db.close()
    }
  }
  const legacyDatabase = (await cli(['db', 'path'], legacyCliEnv)).trim()
  const originalJournal = journal(legacyDatabase, legacyId)
  assert.ok(originalJournal.length > 0)
  const migrated = await restarted.readHistory({
    sessionId: legacyId,
    cwd,
    env: environment,
    providerSettings
  })
  assert.equal(migrated.status, 'ready', JSON.stringify(migrated))
  const migratedExport = JSON.parse(await cli(['export', legacyId], cliEnv))
  assert.deepEqual(migratedExport, originalLegacy)
  assert.deepEqual(journal(path, legacyId), originalJournal)
  assert.ok(
    migratedExport.messages.some(
      (value: { info: { id: string } }) => value.info.id === legacyMessageId
    )
  )
  await cli(
    ['run', '--session', legacyId, '--model', 'fixture/body', 'MIGRATED_CLI_FOLLOWUP'],
    cliEnv
  )
  const migratedFollowup = await restarted.readHistory({
    sessionId: legacyId,
    cwd,
    env: environment,
    providerSettings
  })
  assert.equal(migratedFollowup.status, 'ready', JSON.stringify(migratedFollowup))
  if (migratedFollowup.status !== 'ready') throw new Error('migrated history unavailable')
  assert.ok(
    migratedFollowup.snapshot.messages.some((message) =>
      message.parts.some(
        (part) => part.type === 'text' && part.text.includes('MIGRATED_CLI_FOLLOWUP')
      )
    )
  )
  assert.deepEqual(JSON.parse(await cli(['export', legacyId], legacyCliEnv)), originalLegacy)
  assert.deepEqual(journal(legacyDatabase, legacyId), originalJournal)
  assert.ok(journal(path, legacyId).length > originalJournal.length)
  const custom = {
    ...environment,
    XDG_DATA_HOME: join(root, 'custom-data'),
    OPENCODE_DB: join(root, 'custom.db')
  }
  const client = await restarted.client(settings, custom, cwd)
  const created = await client.session.create({ directory: cwd })
  assert.ok(created.data?.id)
  const customPath = (
    await cli(['db', 'path'], { ...custom, OPENCODE_CONFIG_CONTENT: JSON.stringify(settings) })
  ).trim()
  assert.equal(customPath.replaceAll('\\', '/'), join(root, 'custom.db').replaceAll('\\', '/'))
  assert.equal(
    JSON.parse(
      await cli(['export', created.data!.id], {
        ...custom,
        OPENCODE_CONFIG_CONTENT: JSON.stringify(settings)
      })
    ).info.id,
    created.data!.id
  )
  process.stdout.write(
    JSON.stringify({
      nativeIdPreserved: true,
      terminalFollowupImported: true,
      nativeConfigUnchanged: true,
      customXdgAndDatabase: true,
      auxiliarySessionRemoved: true,
      legacyMigratedAndTerminalResumed: true,
      modelRequests: requests.length,
      externalModelRequests: 0
    }) + '\n'
  )
}
export async function runNativeStorageFixture(fetchImpl: typeof fetch): Promise<void> {
  return run(fetchImpl)
    .catch((error) => {
      process.stderr.write(String(error?.stack ?? error) + '\n')
      process.exitCode = 1
    })
    .finally(async () => {
      for (const adapter of adapters) adapter.close()
      await new Promise<void>((done) => provider.close(() => done()))
      // Owned servers exit asynchronously; all paths here are this test's private temporary root.
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          rmSync(root, { recursive: true, force: true })
          break
        } catch {
          await new Promise((done) => setTimeout(done, 100))
        }
      }
    })
}
