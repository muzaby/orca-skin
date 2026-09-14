// 설계 증거: 번들 SDK가 로컬 모형 서버로 전송한 prompt를 관측한다. 외부 모델 호출 없음.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '../../../app')
const require = createRequire(join(appDir, 'package.json'))
const { query } = await import(pathToFileURL(require.resolve('@anthropic-ai/claude-agent-sdk')))
const sdkDir = dirname(require.resolve('@anthropic-ai/claude-agent-sdk'))
const sdk = JSON.parse(await readFile(join(sdkDir, 'package.json'), 'utf8'))
const executable = require.resolve(`@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}/claude${process.platform === 'win32' ? '.exe' : ''}`)
const root = await mkdtemp(join(tmpdir(), 'orca-work-profile-probe-'))
const cwd = join(root, 'shared-workspace')
const config = join(root, 'config')
const plugin = join(root, 'work-profile')
await Promise.all([mkdir(cwd), mkdir(config), mkdir(join(plugin, '.claude-plugin'), { recursive: true }), mkdir(join(plugin, 'output-styles'), { recursive: true })])
await writeFile(join(plugin, '.claude-plugin/plugin.json'), JSON.stringify({ name: 'orcinus-orca-work-profile', version: '1.0.0', description: 'Work-mode output profile for Orcinus orca' }))
const styleBody = "Follow the Work instructions supplied by Orcinus orca for this session.\nUse programming when useful, but do not assume software development is the user's primary goal."
await writeFile(join(plugin, 'output-styles/work.md'), `---\nname: Orcinus orca Work\ndescription: Work profile for Orcinus orca\nkeep-coding-instructions: false\nforce-for-plugin: true\n---\n\n${styleBody}\n`)
const approved = (await readFile(join(here, 'work-system-prompt.md'), 'utf8')).trim()
const codingMarker = 'The user will primarily request you to perform software engineering tasks.'
const captures = new Map()
const server = createServer(async (req, res) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
  if (req.url?.includes('count_tokens')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ input_tokens: 1 }))
    return
  }
  const text = JSON.stringify(body.messages ?? [])
  const matches = [...text.matchAll(/ORCA_PROFILE_PROBE_(work|code)_(new|resume)/g)]
  const marker = matches.at(-1)?.[0]
  if (marker) captures.set(marker, body)
  const message = { id: 'msg_local_fixture', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: 'Local fixture complete.' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }
  if (body.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    emit('message_start', { type: 'message_start', message: { ...message, content: [], stop_reason: null } })
    emit('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
    emit('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: message.content[0].text } })
    emit('content_block_stop', { type: 'content_block_stop', index: 0 })
    emit('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } })
    emit('message_stop', { type: 'message_stop' })
    res.end()
  } else {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(message))
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|PROGRAMFILES|PROGRAMFILES\(X86\))$/i.test(key)))
Object.assign(env, { CLAUDE_CONFIG_DIR: config, ANTHROPIC_BASE_URL: `http://127.0.0.1:${server.address().port}`, ANTHROPIC_API_KEY: 'local-fixture', ANTHROPIC_AUTH_TOKEN: 'local-fixture', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', CLAUDE_CODE_USE_POWERSHELL_TOOL: '1' })
const observations = []
async function run(kind, resume) {
  const marker = `ORCA_PROFILE_PROBE_${kind}_${resume ? 'resume' : 'new'}`
  const live = query({ prompt: marker, options: { cwd, pathToClaudeCodeExecutable: executable, model: 'claude-sonnet-4-6', settingSources: ['project', 'local'], permissionMode: 'default', maxTurns: 1, env, ...(resume ? { resume } : {}), systemPrompt: { type: 'preset', preset: 'claude_code', append: kind === 'work' ? approved : 'ORCA_CODE_COMMON_HEADER' }, ...(kind === 'work' ? { plugins: [{ type: 'local', path: plugin }] } : {}), canUseTool: async () => ({ behavior: 'deny', message: 'No tool execution in prompt probe.' }) } })
  let sessionId
  let outputStyle
  let result
  const timer = setTimeout(() => live.close(), 45_000)
  try {
    for await (const event of live) {
      if (event.type === 'system' && event.subtype === 'init') { sessionId = event.session_id; outputStyle = event.output_style }
      if (event.type === 'result') result = event.subtype
    }
  } finally { clearTimeout(timer); live.close() }
  assert.equal(result, 'success', marker)
  assert.ok(sessionId, marker)
  if (resume) assert.equal(sessionId, resume)
  const capture = captures.get(marker)
  assert.ok(capture, `${marker}: no request captured`)
  const prompt = typeof capture.system === 'string' ? capture.system : (capture.system ?? []).map((block) => block.text ?? '').join('\n')
  const isWork = kind === 'work'
  assert.equal(prompt.includes(styleBody), isWork, `${marker}: style body`)
  assert.equal(prompt.includes(approved), isWork, `${marker}: approved append`)
  assert.equal(prompt.includes(codingMarker), !isWork, `${marker}: coding instructions`)
  const tools = (capture.tools ?? []).map((tool) => tool.name).sort()
  observations.push({ kind, phase: resume ? 'resume' : 'new', result, outputStyle, approvedAppend: prompt.includes(approved), styleBody: prompt.includes(styleBody), codingInstructions: prompt.includes(codingMarker), toolNames: tools })
  return sessionId
}
try {
  const sessions = await Promise.all(['work', 'code'].map((kind) => run(kind)))
  await Promise.all(['work', 'code'].map((kind, index) => run(kind, sessions[index])))
  await assert.rejects(access(join(cwd, '.claude')), { code: 'ENOENT' })
  for (const phase of ['new', 'resume']) {
    const work = observations.find((item) => item.kind === 'work' && item.phase === phase)
    const code = observations.find((item) => item.kind === 'code' && item.phase === phase)
    assert.deepEqual(work.toolNames, code.toolNames)
  }
  const evidence = { date: new Date().toISOString(), sdk: sdk.version, cli: execFileSync(executable, ['--version'], { env, encoding: 'utf8' }).trim(), binarySha256: createHash('sha256').update(await readFile(executable)).digest('hex'), promptBytes: Buffer.byteLength(approved), promptSha256: createHash('sha256').update(approved).digest('hex'), scope: 'SDK native probe only; application composition and packaging not tested', sharedCwd: true, workspaceClaudeDirectoryCreated: false, observations }
  await writeFile(join(root, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ ...evidence, evidencePath: join(root, 'evidence.json') }, null, 2))
} finally { server.closeAllConnections(); await new Promise((done) => server.close(done)) }
