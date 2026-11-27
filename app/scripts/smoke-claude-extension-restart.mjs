// Exercise global preference, native resume and the published skill through two real host boots.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { bootPair } from './smoke-host-pair.mjs'
import { scaleMs } from './test-time.mjs'

const tool = 'mcp__docs__marker'
function respond(res, call, arg) {
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  const send = (type, fields) =>
    res.write('event: ' + type + '\ndata: ' + JSON.stringify({ type, ...fields }) + '\n\n')
  send('message_start', {
    message: {
      id: randomUUID(),
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 0 }
    }
  })
  const content = call
    ? { type: 'tool_use', id: 'toolu_' + randomUUID(), name: tool, input: {} }
    : { type: 'text', text: '' }
  send('content_block_start', { index: 0, content_block: content })
  send('content_block_delta', {
    index: 0,
    delta: call
      ? { type: 'input_json_delta', partial_json: JSON.stringify({ arg }) }
      : { type: 'text_delta', text: 'fixture complete' }
  })
  send('content_block_stop', { index: 0 })
  send('message_delta', {
    delta: { stop_reason: call ? 'tool_use' : 'end_turn', stop_sequence: null },
    usage: { output_tokens: 10 }
  })
  send('message_stop', {})
  res.end()
}

async function run(root, out) {
  assert.equal(homedir(), join(root, 'home'))
  const records = []
  const calls = join(root, 'calls')
  const a = join(root, 'A'),
    b = join(root, 'B')
  const write = async (path, content) => {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, typeof content === 'string' ? content : JSON.stringify(content))
  }
  const api = createServer(async (req, res) => {
    if (!req.url?.startsWith('/v1/messages') || req.url.includes('count_tokens')) {
      res
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ input_tokens: 10 }))
      return
    }
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString())
    const messages = JSON.stringify(body.messages)
    const marker = messages.match(/CLAUDE_RESTART_[A-Z_]+/g)?.at(-1)
    const names = (body.tools ?? []).map((entry) => entry.name)
    const match = marker && names.includes('Read')
    const first = match && !records.some((record) => record.marker === marker)
    if (match) records.push({ marker, names, messages })
    respond(res, first && names.includes(tool), marker)
  })
  api.listen(0, '127.0.0.1')
  await once(api, 'listening')
  const server = join(root, 'docs.cjs')
  const config = join(homedir(), '.config', 'orcinus-orca')
  const native = process.env.CLAUDE_CONFIG_DIR
  const userSettings = join(root, 'app', 'orcinus-orca-settings.json')
  const rootEnv = {
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:' + api.address().port,
    ANTHROPIC_API_KEY: 'local-fixture',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    ENABLE_TOOL_SEARCH: 'false'
  }
  Object.assign(process.env, rootEnv)
  await Promise.all([
    mkdir(a, { recursive: true }),
    mkdir(b, { recursive: true }),
    write(
      server,
      `require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
      const q=JSON.parse(line); if(q.id===undefined)return; let result={};
      if(q.method==='initialize') result={protocolVersion:q.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'docs',version:'1'}};
      if(q.method==='tools/list') result={tools:[{name:'marker',description:'record a unique marker',inputSchema:{type:'object',properties:{arg:{type:'string'}},required:['arg']}}]};
      if(q.method==='tools/call'){const arg=q.params.arguments.arg; require('node:fs').appendFileSync(${JSON.stringify(calls)},arg+'\\n'); result={content:[{type:'text',text:'restart-result-'+arg}]};}
      process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:q.id,result})+'\\n');
    })`
    ),
    write(join(native, '.claude.json'), {
      mcpServers: { docs: { command: process.execPath, args: [server] } }
    }),
    write(join(config, 'sources', 'settings', 'claude', 'fixture', 'settings.json'), {
      env: rootEnv
    }),
    write(
      join(native, 'skills', 'restart-proof', 'SKILL.md'),
      '---\nname: restart-proof\ndescription: verify the current published wrapper\n---\nuser-skill-body-r1 $ARGUMENTS'
    ),
    write(userSettings, { harnesses: { claude: { autoApprovePermissions: true } } })
  ])
  let pair
  try {
    const start = async () => {
      pair = await bootPair(out, root)
      const catalog = await pair.invoke('agent', 'oo:extensions:catalog', { backend: 'claude' })
      const row = catalog.items.find((item) => item.id === 'docs' && item.kind === 'mcp')
      assert.ok(row?.canToggle, JSON.stringify(catalog))
      return row
    }
    const choice = async (enabled) => {
      const result = await pair.invoke('agent', 'oo:extensions:setEnabled', {
        backend: 'claude',
        kind: 'mcp',
        id: 'docs',
        enabled
      })
      assert.equal(result.resources.items.find((item) => item.id === 'docs')?.selected, enabled)
      assert.equal(
        JSON.parse(await readFile(userSettings, 'utf8')).nativeExtensionChoices.claude['mcp:docs'],
        enabled
      )
    }
    const send = async (marker, cwd, sessionId, on, skill) => {
      const before = pair.received.length
      const text = skill ? '/claude:restart-proof ' + marker : marker
      const result = await pair.invoke('agent', 'oo:chat:send', {
        sessionId,
        backend: 'claude',
        agentKind: 'code',
        cwd,
        projectId: null,
        text,
        providerKey: 'claude-fixture',
        modelFamily: 'claude-sonnet-4-6',
        permissionMode: 'bypass',
        clientKey: marker,
        clientRequestId: marker
      })
      const events = pair.received.slice(before)
      const error = events.find((event) => event.type === 'error')
      assert.ok(!error, JSON.stringify(error))
      assert.ok(
        events.some((event) => event.type === 'turn.ended'),
        JSON.stringify({ result, events: events.map((event) => event.type) })
      )
      const inputs = events.filter(
        (event) => event.type === 'message.committed' && event.text === text
      )
      assert.equal(
        inputs.length,
        1,
        JSON.stringify(
          events.map((event) => ({ type: event.type, text: event.text, ids: event.ids }))
        )
      )
      const own = records.filter((record) => record.marker === marker)
      assert.ok(own.length, marker)
      assert.equal(own[0].names.includes(tool), on)
      const lines = (await readFile(calls, 'utf8').catch(() => '')).trim().split('\n')
      assert.equal(lines.filter((line) => line === marker).length, on ? 1 : 0)
      if (skill) assert.ok(own[0].messages.includes(skill), 'skill body missing from model input')
      console.log(marker, inputs[0].sessionId, 'MCP', on)
      return inputs[0].sessionId
    }
    const transcript = async (id) => {
      const projects = join(native, 'projects')
      const paths = (await readdir(projects, { recursive: true })).filter(
        (path) => basename(path) === id + '.jsonl'
      )
      assert.equal(paths.length, 1)
      return (await readFile(join(projects, paths[0]), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    }
    await start()
    await choice(true)
    const first = await send('CLAUDE_RESTART_ORIGINAL', a, null, true)
    await send('CLAUDE_RESTART_SKILL', a, null, true, 'user-skill-body-r1')
    await choice(false)
    await send('CLAUDE_RESTART_SAME', a, null, false)
    await send('CLAUDE_RESTART_OTHER', b, null, false)
    await pair.close()
    pair = undefined
    const firstInputs = (await transcript(first)).filter(
      (entry) => entry.message?.content === 'CLAUDE_RESTART_ORIGINAL'
    )
    assert.equal(firstInputs.length, 1)
    assert.equal(firstInputs[0].sessionId, first)
    await write(
      join(native, 'skills', 'restart-proof', 'SKILL.md'),
      '---\nname: restart-proof\ndescription: prove the current wrapper after restart\n---\nuser-skill-body-r2 $ARGUMENTS'
    )
    assert.equal((await start()).selected, false)
    assert.equal(await send('CLAUDE_RESTART_RESUME', a, first, false), first)
    assert.ok(
      records
        .find((record) => record.marker === 'CLAUDE_RESTART_RESUME')
        .messages.includes('restart-result-CLAUDE_RESTART_ORIGINAL')
    )
    await send('CLAUDE_RESTART_NEW_A', a, null, false)
    await send('CLAUDE_RESTART_NEW_B', b, null, false)
    await send('CLAUDE_RESTART_SKILL_AGAIN', a, null, false, 'user-skill-body-r2')
    const resumed = await transcript(first)
    for (const marker of ['CLAUDE_RESTART_ORIGINAL', 'CLAUDE_RESTART_RESUME']) {
      const user = resumed.filter(
        (entry) => entry.type === 'user' && entry.message?.content === marker
      )
      assert.equal(user.length, 1)
      assert.equal(user[0].sessionId, first)
    }
    const rows = await pair.invoke('data', 'oo:session:list')
    assert.equal(rows.filter((row) => row.id === first).length, 1)
  } finally {
    await pair?.close()
    api.closeAllConnections()
    await new Promise((resolve) => api.close(resolve))
  }
}

if (process.argv[2] === '--isolated') {
  await run(process.argv[3], process.argv[4])
} else {
  const root = await mkdtemp(join(tmpdir(), 'oo-claude-host-restart-'))
  try {
    const home = join(root, 'home')
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !/^(CLAUDE|ANTHROPIC|OPENCODE|ORCINUS_ORCA_PROVIDER)/i.test(key)
      )
    )
    Object.assign(env, {
      HOME: home,
      USERPROFILE: home,
      CLAUDE_CONFIG_DIR: join(home, '.claude'),
      XDG_CONFIG_HOME: join(root, 'config'),
      XDG_DATA_HOME: join(root, 'data'),
      XDG_STATE_HOME: join(root, 'state'),
      XDG_CACHE_HOME: join(root, 'cache')
    })
    const child = promisify(execFile)(
      process.execPath,
      [fileURLToPath(import.meta.url), '--isolated', root, resolve(process.argv[2] ?? 'out/main')],
      { env, timeout: scaleMs(180_000), maxBuffer: 8 * 1024 * 1024 }
    )
    child.child.stdout.pipe(process.stdout)
    child.child.stderr.pipe(process.stderr)
    await child
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
}
