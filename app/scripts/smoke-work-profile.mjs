// Opt-in native SDK smoke. The model is a bounded loopback fixture; production modules
// compose every profile. Run from any cwd: node app/scripts/smoke-work-profile.mjs
// Packaged: --resources-path=<electron-builder dir/resources>; tools: --workflow
import { createHash } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { access, mkdir, mkdtemp, readFile, readdir, lstat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(appDir, 'package.json'))
const codingMarker = 'The user will primarily request you to perform software engineering tasks.'
const styleBody =
  'Follow the Work instructions supplied by Orcinus orca for this session.\n' +
  "Use programming when useful, but do not assume software development is the user's primary goal."
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const check = (condition, message) => {
  // Never attach SDK errors, prompts, request bodies or assertion actual/expected values.
  if (!condition) throw new Error(message)
}

export function normalizePrompt(text) {
  return text.replace(/\r\n/g, '\n').replace(/>\s+</g, '>\n<').trim()
}

export function parseArgs(args) {
  let resourcesPath
  let workflow = false
  let timeoutMs = 45_000
  for (const arg of args) {
    if (arg.startsWith('--resources-path=') && resourcesPath === undefined) {
      check(arg.slice(17).trim() !== '', 'resources-path must not be empty')
      resourcesPath = resolve(arg.slice(17))
    } else if (arg === '--workflow' && !workflow) workflow = true
    else if (/^--timeout-ms=\d+$/.test(arg)) timeoutMs = Number(arg.slice(13))
    else
      throw new Error('Expected --resources-path=<dir>, --workflow, or --timeout-ms=<1000..120000>')
  }
  check(timeoutMs >= 1000 && timeoutMs <= 120_000, 'timeout-ms must be between 1000 and 120000')
  return { resourcesPath, workflow, timeoutMs }
}

export function requestMarker(messages) {
  // Resume includes old turns; only the latest user text identifies this request.
  const text = (messages ?? [])
    .filter((message) => message.role === 'user')
    .flatMap((message) =>
      typeof message.content === 'string'
        ? [message.content]
        : (message.content ?? [])
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
    )
    .join('\n')
  return [
    ...text.matchAll(/ORCA_WORK_PROFILE_(empty|sentinel|workflow)_(work|code)_(new|resume)/g)
  ].at(-1)?.[0]
}

export function inspectRequest(body, { kind, approved, append }) {
  const system = normalizePrompt(
    typeof body.system === 'string'
      ? body.system
      : (body.system ?? []).map((block) => block.text ?? '').join('\n')
  )
  const count = (needle) => system.split(normalizePrompt(needle)).length - 1
  const result = {
    approvedOccurrences: count(approved),
    styleOccurrences: count(styleBody),
    appendOccurrences: count(append),
    codingInstructions: system.includes(codingMarker),
    systemSha256: sha256(system),
    systemBytes: Buffer.byteLength(system),
    toolNames: (body.tools ?? []).map((tool) => tool.name).sort()
  }
  check(result.approvedOccurrences === (kind === 'work' ? 1 : 0), 'approved prompt count mismatch')
  check(result.styleOccurrences === (kind === 'work' ? 1 : 0), 'output style count mismatch')
  check(result.appendOccurrences === 1, 'production header missing or duplicated')
  check(result.codingInstructions === (kind === 'code'), 'coding instructions mismatch')
  check(result.toolNames.length > 0, 'native tool inventory is empty')
  return result
}

export async function snapshotTree(directory) {
  const entries = []
  async function walk(path, name) {
    let stat
    try {
      stat = await lstat(path)
    } catch (error) {
      if (error.code === 'ENOENT' && name === '') return
      throw error
    }
    check(!stat.isSymbolicLink(), 'fixture tree unexpectedly contains a symlink')
    entries.push(
      stat.isDirectory()
        ? { path: name, type: 'directory' }
        : { path: name, type: 'file', sha256: sha256(await readFile(path)) }
    )
    if (stat.isDirectory())
      for (const child of (await readdir(path)).sort())
        await walk(join(path, child), name ? `${name}/${child}` : child)
  }
  await walk(directory, '')
  return entries
}

export function treeDifference(before, after) {
  const left = new Set(before.map((entry) => JSON.stringify(entry)))
  const right = new Set(after.map((entry) => JSON.stringify(entry)))
  return {
    removed: [...left].filter((entry) => !right.has(entry)),
    added: [...right].filter((entry) => !left.has(entry))
  }
}

function fixtureEnv(root, config, url) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|PROGRAMFILES|PROGRAMFILES\(X86\))$/i.test(key)
    )
  )
  return {
    ...env,
    HOME: join(root, 'home'),
    USERPROFILE: join(root, 'home'),
    APPDATA: join(root, 'home', 'AppData', 'Roaming'),
    LOCALAPPDATA: join(root, 'home', 'AppData', 'Local'),
    TEMP: join(root, 'tmp'),
    TMP: join(root, 'tmp'),
    CLAUDE_CONFIG_DIR: config,
    CLAUDE_CODE_TMPDIR: join(root, 'tmp'),
    ANTHROPIC_BASE_URL: url,
    ANTHROPIC_API_KEY: 'local-fixture',
    ANTHROPIC_AUTH_TOKEN: 'local-fixture',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_USE_POWERSHELL_TOOL: '1'
  }
}

function respond(res, body, content) {
  const stopReason = content.some((block) => block.type === 'tool_use') ? 'tool_use' : 'end_turn'
  const message = {
    id: 'msg_orca_work_profile_fixture',
    type: 'message',
    role: 'assistant',
    model: body.model,
    content,
    stop_reason: stopReason,
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
  content.forEach((block, index) => {
    emit('content_block_start', {
      type: 'content_block_start',
      index,
      content_block: block.type === 'text' ? { type: 'text', text: '' } : { ...block, input: {} }
    })
    emit('content_block_delta', {
      type: 'content_block_delta',
      index,
      delta:
        block.type === 'text'
          ? { type: 'text_delta', text: block.text }
          : { type: 'input_json_delta', partial_json: JSON.stringify(block.input) }
    })
    emit('content_block_stop', { type: 'content_block_stop', index })
  })
  emit('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 1 }
  })
  emit('message_stop', { type: 'message_stop' })
  res.end()
}

function workflowResponse(body, cwd, state) {
  const results = (body.messages ?? []).flatMap((message) =>
    Array.isArray(message.content)
      ? message.content.filter((block) => block.type === 'tool_result')
      : []
  )
  const done = (id) => results.find((result) => result.tool_use_id === id)
  const use = (id, name, input) => [{ type: 'tool_use', id, name, input }]
  const created = done('fixture_create')
  if (!created)
    return use('fixture_create', 'TaskCreate', {
      subject: 'Verify local Work fixture',
      description: 'Create and check the fixture output.',
      activeForm: 'Checking local fixture'
    })
  check(!created.is_error, 'native TaskCreate failed')
  const taskId = JSON.stringify(created.content).match(/Task #(\d+)/)?.[1]
  check(taskId, 'native TaskCreate did not return a task id')
  if (!done('fixture_start'))
    return use('fixture_start', 'TaskUpdate', { taskId, status: 'in_progress' })
  if (!done('fixture_write'))
    return use('fixture_write', 'Write', {
      file_path: join(cwd, 'result.txt'),
      content: 'Orca Work fixture 한글\n'
    })
  if (!done('fixture_deny'))
    return use('fixture_deny', 'Write', {
      file_path: join(cwd, 'denied.txt'),
      content: 'This fixture request must be denied.\n'
    })
  if (!done('fixture_complete'))
    return use('fixture_complete', 'TaskUpdate', { taskId, status: 'completed' })
  for (const id of ['fixture_create', 'fixture_start', 'fixture_write', 'fixture_complete'])
    check(!done(id).is_error, 'native workflow tool returned an error')
  check(done('fixture_deny').is_error === true, 'denied native request did not return an error')
  state.workflowCompleted = true
  return [{ type: 'text', text: `Fixture checked: [result](${join(cwd, 'result.txt')})` }]
}

export async function main(args = process.argv.slice(2)) {
  const { resourcesPath, workflow, timeoutMs } = parseArgs(args)
  const parent = join(tmpdir(), 'orcinus-orca')
  await mkdir(parent, { recursive: true })
  const root = await mkdtemp(join(parent, 'work-profile-smoke-'))
  const resultPath = join(root, 'result.json')
  const evidence = {
    date: new Date().toISOString(),
    root,
    mode: resourcesPath ? 'packaged' : 'development',
    scope:
      'Production resolver/profile/builder/adapt helpers + actual CLI; no external model. ' +
      'Does not certify send/runtime/UI, output collection, or natural-language compliance.',
    status: 'running',
    observations: [],
    workspaces: [],
    failures: []
  }
  const liveQueries = new Set()
  const children = new Set()
  const captures = new Map()
  let server
  let fatal
  let stage = 'initialization'
  const fail = (message) => {
    fatal ??= message
    for (const live of liveQueries) live.close()
    for (const child of children) child.kill('SIGKILL')
  }
  const onSignal = () => fail('smoke interrupted')
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)
  const deadline = setTimeout(
    () => fail('overall smoke deadline exceeded'),
    timeoutMs * (workflow ? 6 : 5)
  )
  try {
    const { createServer: createViteServer } = await import('vite')
    const loader = await createViteServer({
      root: appDir,
      configFile: false,
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true, entries: [] },
      server: { middlewareMode: true }
    })
    let modules
    try {
      modules = await Promise.all([
        loader.ssrLoadModule('/src/main/app/builtin-resources.ts'),
        loader.ssrLoadModule('/src/main/app/agent-extension-profile.ts'),
        loader.ssrLoadModule('/src/main/features/extensions/builder.ts'),
        loader.ssrLoadModule('/src/main/adapters/claude-adapt.ts')
      ])
    } finally {
      await loader.close()
    }
    const [
      { resolveWorkProfilePluginDir },
      { prepareAgentExtensionProfile },
      { ExtensionBuilder },
      adapt
    ] = modules
    const { query } = await import('@anthropic-ai/claude-agent-sdk')
    const executable = resourcesPath
      ? join(
          resourcesPath,
          'app.asar.unpacked',
          'node_modules',
          '@anthropic-ai',
          'claude-agent-sdk-win32-x64',
          'claude.exe'
        )
      : require.resolve(
          `@anthropic-ai/claude-agent-sdk-${process.platform}-${process.arch}/claude${process.platform === 'win32' ? '.exe' : ''}`
        )
    check(!resourcesPath || process.platform === 'win32', 'packaged smoke requires Windows')
    await access(executable)
    const pluginPath = resolveWorkProfilePluginDir({
      isPackaged: !!resourcesPath,
      resourcesPath: resourcesPath ?? '',
      appPath: appDir
    })
    check(
      isAbsolute(pluginPath) && !pluginPath.split(/[\\/]/).includes('app.asar'),
      'plugin path must be native and absolute'
    )
    check(
      pluginPath ===
        join(resourcesPath ?? join(appDir, 'resources'), 'claude-plugins', 'work-profile'),
      'unexpected production resource root'
    )
    const approved = normalizePrompt(
      await readFile(
        join(appDir, '..', 'docs', 'handoff', '0234-work-prompt-profile', 'work-system-prompt.md'),
        'utf8'
      )
    )
    const manifest = JSON.parse(
      await readFile(join(pluginPath, '.claude-plugin', 'plugin.json'), 'utf8')
    )
    check(
      manifest.name === 'orcinus-orca-work-profile' && manifest.version === '1.0.0',
      'Work plugin manifest mismatch'
    )
    const style = (await readFile(join(pluginPath, 'output-styles', 'work.md'), 'utf8')).replace(
      /\r\n/g,
      '\n'
    )
    check(
      style.replace(/^---\n[\s\S]*?\n---\n/, '').trim() === styleBody,
      'Work style body mismatch'
    )
    const config = join(root, 'config')
    const basePlugin = join(root, 'base-plugin')
    await Promise.all(
      [
        config,
        join(root, 'tmp'),
        join(root, 'home', 'AppData', 'Local'),
        join(root, 'home', 'AppData', 'Roaming'),
        join(basePlugin, '.claude-plugin')
      ].map((directory) => mkdir(directory, { recursive: true }))
    )
    await writeFile(
      join(basePlugin, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'orca-smoke-base', version: '1.0.0' })
    )
    const baseRoots = Object.freeze([basePlugin])
    const project = { name: 'Orca fixture', instructions: 'ORCA_FIXTURE_PROJECT_INSTRUCTIONS' }
    const builder = new ExtensionBuilder(
      { getProject: () => project, getProjectContextForSession: () => project },
      () => [],
      () => ({ language: 'en', accountInstructions: 'ORCA_FIXTURE_ACCOUNT_INSTRUCTIONS' }),
      'fixture',
      () => baseRoots
    )
    server = createServer(async (req, res) => {
      try {
        if (req.method === 'HEAD' && req.url === '/api/hello') {
          res.writeHead(200)
          res.end()
          return
        }
        check(req.method === 'POST', `unexpected loopback method ${req.method} ${req.url}`)
        const chunks = []
        let size = 0
        for await (const chunk of req) {
          size += chunk.length
          check(size <= 4 * 1024 * 1024, 'loopback request exceeded byte limit')
          chunks.push(chunk)
        }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (req.url?.startsWith('/v1/messages/count_tokens')) {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ input_tokens: 1 }))
          return
        }
        check(req.url?.split('?')[0] === '/v1/messages', 'unexpected loopback endpoint')
        const state = captures.get(requestMarker(body.messages))
        check(state, 'unrecognized fixture request')
        state.requests.push(inspectRequest(body, state))
        check(state.requests.length <= 10, 'fixture request limit exceeded')
        const content = state.workflow
          ? workflowResponse(body, state.cwd, state)
          : [{ type: 'text', text: 'Local fixture complete.' }]
        respond(res, body, content)
      } catch (error) {
        // No captured request or native error is serialized, including on failure.
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            error: { type: 'api_error', message: 'Local fixture validation failed.' }
          })
        )
        fail(`loopback request validation failed: ${error.message}`)
      }
    })
    server.requestTimeout = timeoutMs
    server.headersTimeout = Math.min(timeoutMs, 10_000)
    await new Promise((done, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', done)
    })
    const env = fixtureEnv(root, config, `http://127.0.0.1:${server.address().port}`)
    evidence.native = {
      executable,
      pluginPath,
      cli: execFileSync(executable, ['--version'], {
        env,
        windowsHide: true,
        timeout: 10_000,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim(),
      sdk: JSON.parse(
        await readFile(
          join(dirname(require.resolve('@anthropic-ai/claude-agent-sdk')), 'package.json'),
          'utf8'
        )
      ).version,
      binarySha256: sha256(await readFile(executable)),
      approvedSha256: sha256(approved),
      approvedBytes: Buffer.byteLength(approved)
    }

    async function run(fixture, cwd, kind, resume) {
      check(!fatal, 'smoke already failed')
      const phase = resume ? 'resume' : 'new'
      const marker = `ORCA_WORK_PROFILE_${fixture}_${kind}_${phase}`
      const profile = await prepareAgentExtensionProfile(kind, pluginPath)
      check(
        (profile.agentProfileKey ?? null) === (kind === 'work' ? 'work:4' : null),
        'profile key mismatch'
      )
      check(
        kind === 'code'
          ? !profile.agentInstructions
          : normalizePrompt(profile.agentInstructions) === approved,
        'production instructions differ from approval'
      )
      const extensions = builder.build(resume ?? null, resume ? null : 'fixture-project', profile)
      const expectedRoots = kind === 'work' ? [basePlugin, pluginPath] : [basePlugin]
      check(
        JSON.stringify(extensions.pluginRoots) === JSON.stringify(expectedRoots),
        'builder plugin roots mismatch'
      )
      check(baseRoots.length === 1 && baseRoots[0] === basePlugin, 'base plugin roots mutated')
      const promptOptions = adapt.adaptSystemPrompt(extensions.systemPromptAppend)
      const pluginOptions = adapt.adaptPlugins(extensions.pluginRoots)
      check(
        JSON.stringify(pluginOptions.plugins?.map((plugin) => plugin.path)) ===
          JSON.stringify(expectedRoots),
        'adapter plugin roots mismatch'
      )
      check(promptOptions.systemPrompt?.preset === 'claude_code', 'production preset missing')
      const state = {
        fixture,
        cwd,
        kind,
        phase,
        approved,
        append: extensions.systemPromptAppend,
        workflow: fixture === 'workflow',
        requests: [],
        permissions: []
      }
      captures.set(marker, state)
      let live
      let sessionId
      let result
      let timedOut = false
      const ownChildren = new Set()
      const timer = setTimeout(() => {
        timedOut = true
        fail('native query deadline exceeded')
      }, timeoutMs)
      try {
        live = query({
          prompt: marker,
          options: {
            cwd,
            env,
            pathToClaudeCodeExecutable: executable,
            model: 'claude-sonnet-4-6',
            ...adapt.adaptSettingSources(),
            ...promptOptions,
            ...pluginOptions,
            permissionMode: 'default',
            maxTurns: state.workflow ? 8 : 1,
            ...(resume ? { resume } : {}),
            // Own the real child handle so query/server failures cannot orphan this CLI.
            spawnClaudeCodeProcess(options) {
              check(
                resolve(options.command) === resolve(executable),
                'SDK selected another executable'
              )
              check(options.cwd === cwd, 'SDK selected another cwd')
              const child = spawn(options.command, options.args, {
                cwd: options.cwd,
                env: options.env,
                signal: options.signal,
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
              })
              children.add(child)
              ownChildren.add(child)
              child.once('exit', () => {
                children.delete(child)
                ownChildren.delete(child)
              })
              child.once('error', () => {
                children.delete(child)
                ownChildren.delete(child)
              })
              return child
            },
            stderr: () => {},
            hooks: {
              PreToolUse: [
                {
                  hooks: [
                    async (input) => {
                      const allowed =
                        state.workflow &&
                        (['TaskCreate', 'TaskUpdate'].includes(input.tool_name) ||
                          (input.tool_name === 'Write' &&
                            input.tool_input?.file_path === join(cwd, 'result.txt') &&
                            input.tool_input?.content === 'Orca Work fixture 한글\n'))
                      // Ask routes disallowed calls to canUseTool even if the CLI would auto-allow them.
                      return {
                        hookSpecificOutput: {
                          hookEventName: 'PreToolUse',
                          permissionDecision: allowed ? 'allow' : 'ask'
                        }
                      }
                    }
                  ]
                }
              ]
            },
            canUseTool: async (name) => {
              state.permissions.push({ tool: name, decision: 'deny' })
              return { behavior: 'deny', message: 'Fixture request denied.' }
            }
          }
        })
        liveQueries.add(live)
        for await (const event of live) {
          if (event.type === 'system' && event.subtype === 'init') sessionId = event.session_id
          if (event.type === 'result') result = event.subtype
        }
        check(!timedOut && !fatal && result === 'success', 'native query did not succeed')
        check(sessionId && (!resume || resume === sessionId), 'native resume session id mismatch')
        check(state.requests.length > 0, 'native request was not observed')
        if (state.workflow) {
          check(state.workflowCompleted, 'native workflow incomplete')
          check(
            state.permissions.some((entry) => entry.tool === 'Write'),
            'permission denial was not requested'
          )
          check(
            (await readFile(join(cwd, 'result.txt'), 'utf8')) === 'Orca Work fixture 한글\n',
            'native output bytes mismatch'
          )
          check(
            (await snapshotTree(join(cwd, 'denied.txt'))).length === 0,
            'denied file was written'
          )
        }
        return sessionId
      } finally {
        clearTimeout(timer)
        live?.close()
        liveQueries.delete(live)
        for (const child of ownChildren) child.kill('SIGKILL')
        evidence.observations.push({
          fixture,
          kind,
          phase,
          sessionId,
          result,
          timedOut,
          agentProfileKey: profile.agentProfileKey ?? null,
          pluginRoots: extensions.pluginRoots,
          requests: state.requests,
          permissions: state.permissions,
          workflowCompleted: state.workflowCompleted ?? false
        })
      }
    }

    for (const fixture of ['empty', 'sentinel']) {
      stage = fixture
      const cwd = join(root, fixture)
      await mkdir(cwd)
      if (fixture === 'sentinel') {
        await mkdir(join(cwd, '.claude'))
        await writeFile(join(cwd, '.claude', 'CLAUDE.md'), 'Harmless Orca fixture sentinel.\n')
        await writeFile(join(cwd, '.claude', 'settings.json'), '{}\n')
      }
      const before = await snapshotTree(join(cwd, '.claude'))
      const workspace = { fixture, cwd, before, phases: [] }
      evidence.workspaces.push(workspace)
      let sessions
      for (const phase of ['new', 'resume']) {
        const settled = await Promise.allSettled(
          ['work', 'code'].map((kind, index) => run(fixture, cwd, kind, sessions?.[index]))
        )
        const after = await snapshotTree(join(cwd, '.claude'))
        const difference = treeDifference(before, after)
        workspace.phases.push({ phase, after, difference })
        check(
          difference.added.length === 0 && difference.removed.length === 0,
          'workspace .claude changed'
        )
        check(
          settled.every((item) => item.status === 'fulfilled'),
          'a native profile query failed'
        )
        sessions = settled.map((item) => item.value)
        check(sessions[0] !== sessions[1], 'Work and Code shared a native session id')
        const pair = ['work', 'code'].map((kind) =>
          captures.get(`ORCA_WORK_PROFILE_${fixture}_${kind}_${phase}`)
        )
        const inventories = pair.flatMap((state) =>
          state.requests.map((request) => JSON.stringify(request.toolNames))
        )
        check(
          inventories.every((inventory) => inventory === inventories[0]),
          'Work/Code tool inventories differ'
        )
      }
    }
    if (workflow) {
      stage = 'workflow'
      const cwd = join(root, 'workflow')
      await mkdir(cwd)
      await run('workflow', cwd, 'work')
      check(
        (await snapshotTree(join(cwd, '.claude'))).length === 0,
        'workflow wrote workspace .claude'
      )
    }
    check(!fatal, 'smoke failed during shutdown')
    evidence.status = 'pass'
  } catch {
    evidence.status = 'fail'
    evidence.failures.push({
      stage,
      reason: fatal ?? 'fixture setup, composition, or native assertion failed'
    })
  } finally {
    clearTimeout(deadline)
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    for (const live of liveQueries) live.close()
    for (const child of children) child.kill('SIGKILL')
    if (server) {
      server.closeAllConnections()
      await new Promise((done) => server.close(done))
    }
    await writeFile(resultPath, JSON.stringify(evidence, null, 2) + '\n')
    console.log(
      JSON.stringify({
        status: evidence.status,
        resultPath,
        observations: evidence.observations.length,
        failures: evidence.failures
      })
    )
  }
  return evidence.status === 'pass' ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = await main()
  } catch {
    console.error(
      'Work profile smoke could not initialize; check arguments and local fixture access.'
    )
    process.exitCode = 1
  }
}
