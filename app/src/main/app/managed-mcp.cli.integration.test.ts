import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { OoMcpConfig } from '../adapters/common/mcp-config'
import type { ProviderMessageBatch } from '../adapters/common/types'
import type { TurnRequest } from '../adapters/common/turn'
import { managedMcpAlias } from '../adapters/opencode/v1/managed-mcp'
import { OpenCodeAdapter } from '../adapters/opencode/v1/adapter'
import { OpenCodeServerPool, resolveOpenCodeExecutable } from '../adapters/opencode/v1/server'
import type { PluginAuth } from '../contracts/auth'
import { confluenceTools } from '../features/plugins/confluence/tools'
import { jiraTools } from '../features/plugins/jira/tools'
import { mailTools } from '../features/plugins/mail/tools'
import { createPluginBinding } from './deployment/plugins'
import { createManagedMcp } from './managed-mcp'
import { sharedMcpResponses } from './managed-mcp-concurrency.testfixture'
import { scaleMs, scaledBudget } from '../../../scripts/test-time.mjs'

vi.setConfig(scaledBudget({ testTimeout: 180_000, hookTimeout: 30_000 }))
const fixtureData = vi.hoisted(() => ({ root: '' }))
vi.mock('../infra/config/user-data-path', () => ({ userDataPath: async () => fixtureData.root }))
let executable: string | undefined
try {
  executable = resolveOpenCodeExecutable()
} catch {
  /* CLI is an optional integration environment */
}
const bodyOf = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

it.skipIf(!executable)('advertises and calls managed MCP through the supported CLI', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orcinus-orca-managed-mcp-'))
  fixtureData.root = root
  const home = join(root, 'home')
  await mkdir(home)
  const responses: Record<string, unknown>[] = []
  const sharedResponses = sharedMcpResponses()
  const modelRequests: Record<string, unknown>[] = []
  const diagnostics: string[] = []
  const called: string[] = []
  const servers = new Set<McpServer>()
  const sse = new Map<string, SSEServerTransport>()
  const serverFor = (kind: string): McpServer => {
    const server = new McpServer({ name: `fixture-${kind}`, version: '1' })
    server.registerTool(
      'lookup',
      { description: `Distinct ${kind} fixture`, inputSchema: { text: z.string() } },
      async ({ text }) => {
        called.push(kind)
        return { content: [{ type: 'text', text: `${kind}:${text}` }] }
      }
    )
    servers.add(server)
    return server
  }
  const http = createServer((request, response) => {
    void (async () => {
      if (request.url?.startsWith('/sse')) {
        expect(request.headers['x-secret']).toBe('sse-secret')
        const transport = new SSEServerTransport('/messages', response)
        sse.set(transport.sessionId, transport)
        await serverFor('sse').connect(transport)
        return
      }
      if (request.url?.startsWith('/messages')) {
        const transport = sse.get(
          new URL(request.url, 'http://localhost').searchParams.get('sessionId')!
        )
        if (!transport) {
          response.writeHead(404)
          response.end()
          return
        }
        await transport.handlePostMessage(request, response)
        return
      }
      if (['/http', '/G', '/P', '/late'].includes(request.url ?? '')) {
        if (request.url === '/http') expect(request.headers['x-secret']).toBe('http-secret')
        const server = serverFor(request.url!.slice(1))
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true
        })
        response.on('close', () => {
          void server.close()
        })
        await server.connect(transport)
        await transport.handleRequest(request, response, await bodyOf(request))
        return
      }
      const body = await bodyOf(request)
      modelRequests.push(body)
      const messages = body.messages as Array<{ role: string; content: unknown }>
      const lastUser = messages.map((message) => message.role).lastIndexOf('user')
      const results = messages.slice(lastUser + 1).filter((message) => message.role === 'tool')
      const probe = JSON.stringify(messages[lastUser]?.content ?? '').includes('0333-probe')
      const declared = (body.tools ?? []) as Array<{ function: { name: string } }>
      if (!results.length && declared.length)
        await sharedResponses.hold(JSON.stringify(messages[lastUser]?.content ?? ''))
      const forceCalls = [
        'docs_lookup',
        managedMcpAlias('user', 'http') + '_lookup',
        managedMcpAlias('builtin', 'jira') + '_jira_getIssue',
        managedMcpAlias('user', 'sse') + '_lookup',
        managedMcpAlias('user', 'late') + '_lookup',
        managedMcpAlias('builtin', 'late-jira') + '_jira_getIssue'
      ]
      // Deliberately ask for the OFF tools too. The CLI must reject them without running a handler.
      const tools = probe
        ? forceCalls.map((name) => ({ function: { name } }))
        : declared.filter(
            (tool) =>
              tool.function.name.startsWith('orcinus_orca_') &&
              /_(lookup|confluence_search|jira_getIssue|mail_search)$/.test(tool.function.name)
          )
      const calls =
        results.length || !declared.length
          ? undefined
          : tools.map((tool, index) => ({
              index,
              id: `call-${index}`,
              type: 'function',
              function: {
                name: tool.function.name,
                arguments: JSON.stringify(
                  tool.function.name.endsWith('_jira_getIssue')
                    ? { issueKey: 'QA-288' }
                    : tool.function.name.endsWith('_mail_search')
                      ? { query: 'mail-sentinel' }
                      : { text: 'cli-sentinel' }
                )
              }
            }))
      const content = !calls ? 'Managed MCP calls completed' : null
      const completion = {
        id: 'fixture-completion',
        object: 'chat.completion',
        created: 1,
        model: 'fixture-model',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content, ...(calls ? { tool_calls: calls } : {}) },
            finish_reason: calls ? 'tool_calls' : 'stop'
          }
        ],
        usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 }
      }
      responses.push(completion)
      if (body.stream) {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        response.write(
          `data: ${JSON.stringify({ ...completion, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', ...(content ? { content } : {}), ...(calls ? { tool_calls: calls } : {}) }, finish_reason: null }] })}\n\n`
        )
        response.write(
          `data: ${JSON.stringify({ ...completion, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: calls ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`
        )
        response.end()
      } else {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(completion))
      }
    })().catch((error: unknown) => {
      response.writeHead(500)
      response.end(String(error))
    })
  })
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve))
  const address = http.address() as { port: number }
  const base = `http://127.0.0.1:${address.port}`
  const script = join(root, 'stdio.mjs')
  await writeFile(
    script,
    `import {McpServer} from ${JSON.stringify(pathToFileURL(resolve('node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js')).href)};
import {StdioServerTransport} from ${JSON.stringify(pathToFileURL(resolve('node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js')).href)};
import {z} from ${JSON.stringify(pathToFileURL(resolve('node_modules/zod/index.js')).href)};
const server=new McpServer({name:'stdio-fixture',version:'1'});
server.registerTool('lookup',{inputSchema:{text:z.string()}},async({text})=>({content:[{type:'text',text:process.env.DISTINCT==='stdio-secret'?'stdio:'+text:'missing-stdio-environment'}]}));
await server.connect(new StdioServerTransport());`
  )
  const users: OoMcpConfig = {
    stdio: { command: process.execPath, args: [script], env: { DISTINCT: 'stdio-secret' } },
    http: { type: 'http', url: `${base}/http`, headers: { 'X-Secret': 'http-secret' } },
    sse: { type: 'sse', url: `${base}/sse`, headers: { 'X-Secret': 'sse-secret' } }
  }
  const authFor = (authId: string, origin: string, body: unknown): PluginAuth => ({
    authId,
    origin,
    label: authId,
    snapshot: () => ({ authId, status: 'valid', verified: true, credentialRevision: 1 }),
    request: async (_request, signal) => {
      signal?.throwIfAborted()
      called.push(authId)
      return {
        ok: true,
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        finalUrl: origin
      }
    },
    withCredential: vi.fn()
  })
  const wiki = authFor('wiki', 'https://wiki.test', {
    results: [{ id: '288', title: 'wiki-sentinel', type: 'page', _links: { webui: '/pages/288' } }],
    start: 0,
    limit: 25,
    size: 1,
    totalSize: 1,
    _links: { base: 'https://wiki.test' }
  })
  const jira = authFor('jira', 'https://jira.test', {
    id: '288',
    key: 'QA-288',
    fields: { summary: 'jira-sentinel', issuetype: { name: 'Task' }, status: { name: 'Open' } }
  })
  const mail = authFor('mail', 'pop3://mail.test:110', {})
  let firstAuth = false
  const lateAuth = authFor('late-jira', 'https://jira.test', {
    key: 'LATE',
    fields: { summary: 'late-jira-sentinel', issuetype: { name: 'Task' } }
  })
  const initialAuth = lateAuth.snapshot
  lateAuth.snapshot = () => ({ ...initialAuth(), status: firstAuth ? 'valid' : 'none' })
  const bindings = [
    confluenceTools(wiki),
    jiraTools(jira),
    mailTools(mail, { accountId: 'fixture-mail' }),
    jiraTools(lateAuth)
  ].map((server, index) =>
    createPluginBinding({
      auth: [wiki, jira, mail, lateAuth][index],
      server,
      registry: { add: () => {}, remove: () => {} }
    })
  )
  const managed = createManagedMcp(
    { enabledConfig: () => users, resolver: () => () => undefined },
    bindings
  )
  const choices: Record<string, boolean> = {}
  const env = {
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_DATA_HOME: join(root, 'data'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_STATE_HOME: join(root, 'state'),
    OPENCODE_DISABLE_AUTOUPDATE: 'true',
    OPENCODE_DISABLE_MODELS_FETCH: 'true'
  }
  const config = {
    command: { managed: { template: 'Call every managed lookup tool once' } },
    model: 'fixture/fixture-model',
    provider: {
      fixture: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Local fixture',
        options: { baseURL: `${base}/v1`, apiKey: 'local-fixture' },
        models: {
          'fixture-model': {
            name: 'Fixture model',
            tool_call: true,
            limit: { context: 32000, output: 2048 }
          }
        }
      }
    }
  }
  const globalDir = join(env.XDG_CONFIG_HOME, 'opencode')
  await mkdir(globalDir, { recursive: true })
  await writeFile(
    join(globalDir, 'opencode.json'),
    JSON.stringify({
      $schema: 'https://opencode.ai/config.json',
      mcp: {
        docs: {
          type: 'remote',
          url: base + '/G',
          oauth: false,
          enabled: true
        }
      }
    })
  )
  const children: ChildProcess[] = []
  const nativeDestinations: string[] = []
  const sdkPaths: string[] = []
  const permissionReplies: { reply: unknown; status: number }[] = []
  const pool = new OpenCodeServerPool({
    timeoutMs: scaleMs(40_000),
    dataDirectory: root,
    preferences: () => ({ executablePath: executable, instructions: '' }),
    fetchImpl: fetch,
    spawnProcess: ((command: string, args: readonly string[], options: SpawnOptions) => {
      const child = spawn(command, args, options)
      children.push(child)
      return child
    }) as typeof spawn
  })
  const fetchObserved: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    const parsed = new URL(url)
    sdkPaths.push(parsed.pathname)
    if (/^\/mcp\/docs\/(?:dis)?connect$/.test(parsed.pathname)) {
      const directory = parsed.searchParams.get('directory')
      if (directory) nativeDestinations.push(directory)
    }
    const permission = /\/permission\/[^/]+\/reply$/.test(new URL(url).pathname)
      ? ((await (input instanceof Request ? input.clone() : new Request(input, init)).json()) as {
          reply: unknown
        })
      : undefined
    const result = await fetch(input, init)
    if (permission) permissionReplies.push({ reply: permission.reply, status: result.status })
    if (url.includes('/mcp'))
      diagnostics.push(
        `${result.status} ${result.headers.get('content-type')} ${await result.clone().text()}`
      )
    return result
  }
  const adapter = new OpenCodeAdapter(
    pool,
    fetchObserved,
    undefined,
    { global: () => choices },
    undefined,
    {
      snapshot: () => managed.source.snapshot(),
      peek: () => managed.source.peek(),
      acquire: (snapshot) => managed.mcpBridge.acquire(snapshot)
    }
  )
  let prepared: Awaited<ReturnType<NonNullable<typeof adapter.prepareComposer>>> | undefined
  let turn: ReturnType<typeof adapter.sendMessage> | undefined
  try {
    const providerSettings = { settings: config } as unknown as TurnRequest['providerSettings']
    prepared = await adapter.prepareComposer({ cwd: root, env, providerSettings })
    // A read only observes: production catalog/warmup owners activate first
    // (composer-catalog-owner.ts), and an unactivated directory reads as [] by design (0289 D19).
    prepared.activate?.()
    const lease = prepared
    // Activation connects in the background, so the first read can still report `pending`.
    // Wait for every Orcinus orca MCP to settle; a `failed` settlement ends the wait and fails below.
    const resources = await vi.waitFor(
      async () => {
        const items = await lease
          .read('mcp', AbortSignal.timeout(scaleMs(40_000)))
          .catch((error: unknown) => {
            throw new Error(JSON.stringify(diagnostics), { cause: error })
          })
        if (items.some((item) => item.origin === 'orcinus-orca' && item.status === 'pending'))
          throw new Error(`Orcinus orca MCP still pending: ${JSON.stringify(diagnostics)}`)
        return items
      },
      { timeout: 40_000, interval: 100 }
    )
    expect(
      resources.filter((item) => item.origin === 'orcinus-orca' && item.status === 'connected')
    ).toHaveLength(6)
    for (const text of [
      'Call every managed lookup tool once',
      '/managed',
      'Decline every managed lookup tool'
    ]) {
      const denied = text.startsWith('Decline')
      const approvals = vi.fn<NonNullable<TurnRequest['requestApproval']>>(async () =>
        denied ? { behavior: 'deny', message: 'fixture denied' } : { behavior: 'allow' }
      )
      const callsBefore = called.length
      const repliesBefore = permissionReplies.length
      const before = modelRequests.length
      turn = adapter.sendMessage({
        sessionId: null,
        cwd: root,
        text,
        env,
        model: 'fixture/fixture-model',
        providerSettings,
        extensions: {
          skills: [],
          hooks: { normalized: {} },
          managedMcp: managed.source.snapshot()
        },
        requestApproval: approvals
      })
      const errors: unknown[] = []
      const timeout = setTimeout(() => turn?.close(), scaleMs(60_000))
      try {
        for await (const batch of turn.eventBatches) {
          errors.push(...batch.events.filter((event) => event.type === 'error'))
          if (batch.events.some((event) => event.type === 'turn.ended')) {
            const live = await turn.nativeResources?.()
            expect(live?.items.filter((item) => item.origin === 'orcinus-orca')).toHaveLength(6)
            expect(JSON.stringify(live)).not.toMatch(/stdio-secret|http-secret|sse-secret|Bearer /)
            break
          }
        }
      } finally {
        clearTimeout(timeout)
      }
      expect(errors).toEqual([])
      expect(modelRequests.length - before).toBeGreaterThanOrEqual(denied ? 1 : 2)
      // Native background requests may arrive after the tool continuation. Read
      // this turn's actual tool outputs, rather than whichever model request won last.
      const results = JSON.stringify(
        modelRequests
          .slice(before)
          .flatMap((request) =>
            (request.messages as Array<{ role: string; content: unknown }>)
              .filter((message) => message.role === 'tool')
              .map((message) => message.content)
          )
      )
      expect(approvals).toHaveBeenCalled()
      if (denied) {
        expect(called.length).toBe(callsBefore)
        expect(permissionReplies.slice(repliesBefore)).toEqual(
          expect.arrayContaining([{ reply: 'reject', status: 200 }])
        )
      } else {
        for (const kind of ['stdio', 'http', 'sse'])
          expect(results).toContain(`${kind}:cli-sentinel`)
        expect(results).toContain('wiki-sentinel')
        expect(results).toContain('jira-sentinel')
        expect(results).toContain('cacheAsOf')
        expect(called).toEqual(expect.arrayContaining(['wiki', 'jira', 'http', 'sse']))
      }
      expect(
        modelRequests
          .slice(before)
          .some((body) => JSON.stringify(body).includes('Orcinus orca MCP references'))
      ).toBe(true)
      expect(children).toHaveLength(1)
      expect(JSON.stringify(children[0].spawnargs)).not.toMatch(
        /stdio-secret|http-secret|sse-secret|Bearer /
      )
      turn.close()
      turn = undefined
    }
    let approvalSignal: AbortSignal | undefined
    turn = adapter.sendMessage({
      sessionId: null,
      cwd: root,
      text: 'Cancel pending MCP approval',
      env,
      model: 'fixture/fixture-model',
      providerSettings,
      extensions: { skills: [], hooks: { normalized: {} }, managedMcp: managed.source.snapshot() },
      requestApproval: async (_action, signal) => {
        approvalSignal = signal
        return new Promise((resolve) =>
          signal?.addEventListener(
            'abort',
            () => resolve({ behavior: 'deny', message: 'cancelled' }),
            { once: true }
          )
        )
      }
    })
    const active = turn
    const observed: string[] = []
    let recordAborted!: () => void
    const aborted = new Promise<void>((resolve) => {
      recordAborted = resolve
    })
    const consuming = (async () => {
      for await (const batch of active.eventBatches) {
        observed.push(...batch.events.map((event) => event.type))
        // A persistent runtime keeps consuming after the turn ends. Returning the
        // iterator here closes the channel before the interrupt HTTP reply arrives.
        if (batch.events.some((event) => event.type === 'turn.aborted')) recordAborted()
      }
    })()
    await vi.waitFor(() => expect(approvalSignal).toBeDefined(), { timeout: 40_000 })
    await active.interrupt()
    await aborted
    expect(approvalSignal?.aborted).toBe(true)
    expect(observed).toContain('turn.aborted')
    active.close()
    await consuming
    turn = undefined
    await sharedResponses.verify(
      root,
      (cwd, text, onWaitPhase) =>
        adapter.sendMessage({
          cwd,
          text,
          onWaitPhase,
          sessionId: null,
          env,
          model: 'fixture/fixture-model',
          providerSettings,
          extensions: {
            skills: [],
            hooks: { normalized: {} },
            managedMcp: managed.source.snapshot()
          },
          requestApproval: async () => ({ behavior: 'allow' })
        }),
      (enabled) =>
        Object.assign(choices, {
          'mcp:docs': enabled,
          'managed:user:http': enabled,
          'managed:builtin:jira': enabled
        }),
      called,
      modelRequests,
      () => ({
        pids: children.map((child) => child.pid),
        disposals: sdkPaths.filter((path) => path === '/instance/dispose').length
      })
    )
    // Keep consuming the same channel across all three inputs, as SessionRuntime does.
    const disposeBefore = sdkPaths.filter((path) => path === '/instance/dispose').length
    const promptPaths = new Set<string>()
    const pids = children.map((child) => child.pid)
    const ids = [
      'docs_lookup',
      managedMcpAlias('user', 'http') + '_lookup',
      managedMcpAlias('builtin', 'jira') + '_jira_getIssue'
    ]
    let stream: AsyncIterator<ProviderMessageBatch> | undefined
    for (const [index, enabled] of [true, false, true].entries()) {
      Object.assign(choices, {
        'mcp:docs': enabled,
        'managed:user:http': enabled,
        'managed:builtin:jira': enabled,
        'managed:builtin:late-jira': index === 2
      })
      if (index === 1) {
        firstAuth = true
        users.late = { type: 'http', url: base + '/late' }
        choices['managed:user:late'] = true
        managed.source.refresh()
      }
      const text = '0333-probe-' + index
      const before = modelRequests.length
      const callsBefore = called.length
      const beforeSdk = sdkPaths.length
      if (!turn) {
        turn = adapter.sendMessage({
          sessionId: null,
          cwd: root,
          text,
          env,
          model: 'fixture/fixture-model',
          providerSettings,
          extensions: {
            skills: [],
            hooks: { normalized: {} },
            managedMcp: managed.source.snapshot()
          },
          requestApproval: async () => ({ behavior: 'allow' })
        })
        stream = turn.eventBatches[Symbol.asyncIterator]()
      } else expect(await turn.pushTurn!({ text })).toEqual({ kind: 'accepted' })
      for (;;) {
        const batch = await stream!.next()
        expect(batch.done).toBeFalsy()
        const events = batch.value!.events
        expect(events.filter((event) => event.type === 'error')).toEqual([])
        if (events.some((event) => event.type === 'turn.ended')) break
      }
      const names = modelRequests
        .slice(before)
        .flatMap((body) =>
          ((body.tools ?? []) as { function: { name: string } }[]).map((tool) => tool.function.name)
        )
      for (const name of ids) expect(names.includes(name)).toBe(enabled)
      for (const target of ['G', 'http', 'jira'])
        expect(called.slice(callsBefore).includes(target)).toBe(enabled)
      expect(called.slice(callsBefore)).toContain('sse')
      expect(called.slice(callsBefore).includes('late')).toBe(index > 0)
      expect(called.slice(callsBefore).includes('late-jira')).toBe(index === 2)
      sdkPaths
        .slice(beforeSdk)
        .filter((path) => path.endsWith('/prompt_async'))
        .forEach((path) => promptPaths.add(path))
      expect(children.map((child) => child.pid)).toEqual(pids)
      expect(sdkPaths.filter((path) => path === '/instance/dispose')).toHaveLength(disposeBefore)
    }
    expect(promptPaths.size).toBe(1)
    turn!.close()
    await stream?.return?.()
    turn = undefined
    // A different native definition can have exactly the same SDK id. A global
    // OFF must not change that directory's own connection or its model results.
    const foreign = join(root, 'foreign')
    await mkdir(foreign)
    await writeFile(
      join(foreign, 'opencode.json'),
      JSON.stringify({
        $schema: 'https://opencode.ai/config.json',
        mcp: { docs: { type: 'remote', url: base + '/P', oauth: false, enabled: true } }
      })
    )
    choices['mcp:docs'] = false
    const callsBeforeForeign = called.length
    turn = adapter.sendMessage({
      sessionId: null,
      cwd: foreign,
      text: '0333-probe-foreign',
      env,
      model: 'fixture/fixture-model',
      providerSettings,
      extensions: { skills: [], hooks: { normalized: {} }, managedMcp: managed.source.snapshot() },
      requestApproval: async () => ({ behavior: 'allow' })
    })
    for await (const batch of turn.eventBatches) {
      expect(batch.events.filter((event) => event.type === 'error')).toEqual([])
      if (batch.events.some((event) => event.type === 'turn.ended')) break
    }
    expect(called.slice(callsBeforeForeign)).toContain('P')
    expect(called.slice(callsBeforeForeign)).not.toContain('G')
    expect(nativeDestinations).not.toContain(foreign)
    turn.close()
    turn = undefined
  } finally {
    turn?.close()
    await prepared?.release()
    const exits = children.map(
      (child) =>
        new Promise<void>((resolve, reject) => {
          if (child.exitCode !== null || child.signalCode !== null) return resolve()
          const timeout = setTimeout(() => {
            // The Linux CLI can keep a stdio transport open after SIGTERM.
            if (process.platform !== 'win32') child.kill('SIGKILL')
            else reject(new Error('CLI did not exit'))
          }, scaleMs(10_000))
          child.once('exit', () => {
            clearTimeout(timeout)
            resolve()
          })
        })
    )
    adapter.close()
    await managed.mcpBridge.close()
    await Promise.all(exits)
    await Promise.allSettled([...servers].map((server) => server.close()))
    await new Promise<void>((resolve) => {
      http.close(() => resolve())
      http.closeAllConnections()
    })
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})
