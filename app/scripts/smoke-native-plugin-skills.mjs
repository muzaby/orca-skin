// Real bundled CLI + production adapter; the model endpoint is a local fixture.
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const evidenceDir = resolve(appDir, '../.tmp')
await mkdir(evidenceDir, { recursive: true })
const root = await mkdtemp(join(evidenceDir, 'native-skill-smoke-'))
const config = join(root, 'claude')
const cwd = join(root, 'workspace')
const plugin = process.argv[2] ? resolve(process.argv[2]) : join(root, 'plugin')
const write = async (path, value) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, value)
}
await mkdir(cwd, { recursive: true })
if (!process.argv[2]) {
  await write(
    join(plugin, '.claude-plugin/plugin.json'),
    JSON.stringify({ name: 'frontend-design' })
  )
  await write(
    join(plugin, 'skills/frontend-design/SKILL.md'),
    '---\nname: frontend-design\ndescription: Design fixture interface\n---\nNATIVE_SKILL_EXPANDED_0267. Answer with the supplied design brief: $ARGUMENTS\n'
  )

  await write(
    join(plugin, 'skills/folder-name/SKILL.md'),
    '---\nname: metadata-name\ndescription: Alternate name\n---\nAlias body'
  )
  await write(
    join(plugin, 'skills/internal/SKILL.md'),
    '---\nname: internal\nuser-invocable: false\n---\nInternal body'
  )
}
const sourceBefore = await readFile(join(plugin, 'skills/frontend-design/SKILL.md'), 'utf8')
const bodyMarker = sourceBefore
  .replace(/^---[\s\S]*?\n---\s*/, '')
  .trim()
  .split('\n')[0]
  .slice(0, 35)
await write(
  join(config, 'settings.json'),
  JSON.stringify({ enabledPlugins: { 'frontend-design@fixture': true } })
)
await write(
  join(config, 'plugins/installed_plugins.json'),
  JSON.stringify({
    version: 2,
    plugins: { 'frontend-design@fixture': [{ scope: 'user', installPath: plugin }] }
  })
)
let expanded = false
let brief = false
let requests = 0
const server = createServer(async (req, res) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  if (!req.url.includes('/messages') || req.url.includes('count_tokens')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ input_tokens: 1 }))
    return
  }
  const body = JSON.parse(raw)
  const messages = JSON.stringify(body.messages)
  expanded ||= messages.includes(bodyMarker)
  brief ||= messages.includes('design-brief-0267')
  requests++
  const message = {
    id: 'msg_fixture',
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: [{ type: 'text', text: 'Local skill fixture completed.' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 }
  }
  if (!body.stream) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(message))
    return
  }
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  emit('message_start', {
    type: 'message_start',
    message: { ...message, content: [], stop_reason: null }
  })
  emit('content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' }
  })
  emit('content_block_delta', {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: message.content[0].text }
  })
  emit('content_block_stop', { type: 'content_block_stop', index: 0 })
  emit('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: 1 }
  })
  emit('message_stop', { type: 'message_stop' })
  res.end()
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|PROGRAMFILES|PROGRAMFILES\(X86\))$/i.test(key)
  )
)
Object.assign(env, {
  HOME: join(root, 'home'),
  USERPROFILE: join(root, 'home'),
  APPDATA: join(root, 'home/AppData/Roaming'),
  LOCALAPPDATA: join(root, 'home/AppData/Local'),
  TEMP: join(root, 'tmp'),
  TMP: join(root, 'tmp'),
  CLAUDE_CONFIG_DIR: config,
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  ANTHROPIC_API_KEY: 'local-fixture',
  ANTHROPIC_AUTH_TOKEN: 'local-fixture',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  CLAUDE_CODE_USE_POWERSHELL_TOOL: '1'
})
await mkdir(env.TEMP, { recursive: true })
const { createServer: createViteServer } = await import('vite')
const loader = await createViteServer({
  root: appDir,
  configFile: false,
  logLevel: 'silent',
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true }
})
let live
const deadline = setTimeout(() => live?.close(), 45000)
try {
  const { ClaudeAdapter } = await loader.ssrLoadModule('/src/main/adapters/claude/adapter.ts')
  live = new ClaudeAdapter().sendMessage({
    sessionId: null,
    text: '/frontend-design:frontend-design design-brief-0267',
    cwd,
    env,
    model: 'claude-sonnet-4-6',
    extensions: {
      hooks: { normalized: {} },
      skills: [
        {
          name: 'unrelated-disabled',
          sourceKind: 'orca',
          enabled: false,
          description: '',
          sourceId: 'orca',
          sourceLabel: 'Orca',
          canToggle: true,
          canRemove: true,
          skillPath: join(root, 'unused/SKILL.md'),
          skillDir: join(root, 'unused')
        }
      ]
    }
  })
  let native
  for await (const batch of live.eventBatches) {
    if (batch.events.some((event) => event.type === 'turn.ended')) {
      native = await live.nativeResources()
      break
    }
    for (const event of batch.events) {
      if (event.type.includes('error') || event.type.includes('failed')) console.log(event)
    }
  }
  assert(native, 'CLI must complete a turn')
  assert(native.commands.some((command) => command.name === 'frontend-design:frontend-design'))
  assert(native.items.some((item) => item.kind === 'plugin' && item.name === 'frontend-design'))
  if (!process.argv[2]) {
    assert(
      native.commands.some((command) => command.name === 'frontend-design:metadata-name'),
      'metadata name must match native CLI'
    )
    assert(
      !native.commands.some((command) => command.name === 'frontend-design:internal'),
      'hidden skill must not be offered'
    )
  }
  assert.equal(
    await readFile(join(plugin, 'skills/frontend-design/SKILL.md'), 'utf8'),
    sourceBefore
  )
  assert(expanded, 'CLI must expand the plugin skill into the model request')
  assert(brief, 'CLI must preserve the supplied skill arguments')
  const settings = JSON.parse(await readFile(join(config, 'settings.json'), 'utf8'))
  assert.equal(settings.enabledPlugins['frontend-design@fixture'], true)
  console.log(
    JSON.stringify({
      commands: native.commands.map((command) => command.name),
      expanded,
      brief,
      requests
    })
  )
} finally {
  clearTimeout(deadline)
  live?.close()
  await loader.close()
  server.closeAllConnections()
  await new Promise((done) => server.close(done))
}
