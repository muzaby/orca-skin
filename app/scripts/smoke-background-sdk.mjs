// Codex: opt-in Windows SDK/CLI process smoke with a loopback model fixture, no external model calls.
import { createServer } from 'node:http'
import { mkdtemp, mkdir, writeFile, readFile, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, isAbsolute } from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { createServer as createViteServer } from 'vite'
import { setTimeout as delay } from 'node:timers/promises'

const mode = process.argv.find((arg) => arg.startsWith('--mode='))?.slice(7) ?? 'basic'
const selectedCase = process.argv.find((arg) => arg.startsWith('--case='))?.slice(7)
if (!['basic', 'lifetime', 'workflow', 'extended', 'promotion'].includes(mode)) {
  throw new Error('Expected --mode=basic|lifetime|workflow|extended|promotion')
}

const root = join(tmpdir(), 'orcinus-orca')
await mkdir(root, { recursive: true })
const cwd = await mkdtemp(join(root, 'sdk-smoke-'))
const results = []
const loader = await createViteServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true }
})
let BackgroundOutputStore
let ClaudeBackgroundMapper
let emptyBackgroundState
let applyBackgroundEvent
let backgroundPending
try {
  ;({ BackgroundOutputStore } = await loader.ssrLoadModule('/src/main/infra/background-output.ts'))
  ;({ ClaudeBackgroundMapper } = await loader.ssrLoadModule(
    '/src/main/adapters/claude-background.ts'
  ))
  ;({ emptyBackgroundState, applyBackgroundEvent, backgroundPending } = await loader.ssrLoadModule(
    '/src/shared/background-task.ts'
  ))
} finally {
  await loader.close()
}
const outputStore = new BackgroundOutputStore(join(cwd, 'captured'))

async function run(tool, stop, scenario) {
  const mapper = new ClaudeBackgroundMapper()
  let canonical = emptyBackgroundState()
  const called = new Set()
  let available = []
  let requests = 0
  let live
  let timedOut = false
  const events = []
  const observations = []
  const startedFile = scenario && join(cwd, `${scenario.name}.started`)
  const doneFile = scenario && join(cwd, `${scenario.name}.done`)
  const readMarker = async (path) => readFile(path, 'utf8').catch(() => undefined)
  const waitForMarker = async (path, milliseconds) => {
    const deadline = Date.now() + milliseconds
    do {
      const marker = await readMarker(path)
      if (marker !== undefined) return marker
      await delay(100)
    } while (Date.now() < deadline)
    return undefined
  }
  let actionApplied = false
  let actionError
  let shellStarted = false
  let shellFinished = false
  let startupError
  let shellTaskId
  let shellTerminal = false
  const promotion =
    scenario?.action === 'promotion'
      ? {
          toolUseId: `fixture_main_${tool}`,
          toolCalls: 0,
          receivedToolCalls: 0,
          updatedTaskIds: [],
          returnedTaskIds: []
        }
      : undefined
  const server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    let body = {}
    try {
      body = JSON.parse(Buffer.concat(chunks).toString())
    } catch {
      // Non-JSON health checks receive the same bounded local fixture response.
    }
    if (req.url?.includes('count_tokens')) {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ input_tokens: 1 }))
      return
    }
    requests++
    if (
      scenario?.name === 'workflow-oneshot' &&
      (body.messages ?? []).some(
        (message) =>
          message.role === 'user' &&
          JSON.stringify(message.content).includes('orca-fixture-workflow-child')
      )
    )
      await delay(3000)
    available = (body.tools ?? []).map((item) => item.name)
    const childRequest = (body.messages ?? []).some(
      (message) =>
        message.role === 'user' &&
        (typeof message.content === 'string'
          ? message.content
          : (message.content ?? [])
              .filter((block) => block.type === 'text')
              .map((block) => block.text)
              .join('\n')
        ).includes('orca-fixture-child-shell')
    )
    const selectedTool =
      scenario?.owner && scenario.owner !== 'main' ? (childRequest ? 'Bash' : 'Agent') : tool
    const callKey = `${childRequest ? 'child' : 'main'}:${selectedTool}`
    const use = !called.has(callKey) && available.includes(selectedTool)
    if (use) called.add(callKey)
    if (use && promotion) promotion.toolCalls++
    // Keep the main model turn in flight while its background Agent starts the shell.
    if (scenario?.name === 'background-agent-interrupt' && !childRequest && !use) {
      observations.push({ at: Date.now(), kind: 'main-response-held' })
      await delay(15_000)
      if (res.destroyed) return
    }
    const command = promotion
      ? tool === 'Bash'
        ? `printf '%s' "$$" > '${scenario.name}.started'; sleep 8; printf '%s' "$$" > '${scenario.name}.done'; printf 'orca-promotion-finished\\n'`
        : `$PID | Set-Content -LiteralPath '${scenario.name}.started'; Start-Sleep -Seconds 8; $PID | Set-Content -LiteralPath '${scenario.name}.done'; Write-Output 'orca-promotion-finished 한글'`
      : scenario && selectedTool === 'Bash'
        ? `printf '%s' "$$" > '${scenario.name}.started'; sleep 8; printf 'finished' > '${scenario.name}.done'; printf 'orca-lifetime-finished\\n'`
        : tool === 'Bash'
          ? `sleep ${stop ? 20 : 3}; printf 'orca-sdk-smoke-bash\\n'`
          : `Start-Sleep -Seconds ${stop ? 20 : 3}; Write-Output 'orca-sdk-smoke-powershell 한글'`
    const input =
      selectedTool === 'Workflow'
        ? {
            // Valid module syntax reaches the CLI's second-stage async-function compiler.
            script:
              scenario?.action === 'oneshot'
                ? "export const meta = { name: 'orca-smoke-oneshot', description: 'Bounded local fixture agent', phases: [] }; return await agent('orca-fixture-workflow-child: return a local result.');"
                : "export const meta = { name: 'orca-smoke-start-error', description: 'Bounded syntax error fixture', phases: [] }; export const unsupportedBodyExport = 1;"
          }
        : selectedTool === 'Agent'
          ? {
              subagent_type: 'general-purpose',
              description: 'SDK local agent smoke',
              prompt: scenario
                ? 'orca-fixture-child-shell: Run the bounded local background Bash fixture once, then return.'
                : 'Return a brief local smoke result.',
              ...(scenario ? { run_in_background: scenario.owner === 'background-agent' } : {})
            }
          : { command, run_in_background: !promotion, description: 'Orca SDK local smoke' }
    const content = use
      ? [
          {
            type: 'tool_use',
            id: `fixture_${callKey.replace(':', '_')}`,
            name: selectedTool,
            input
          }
        ]
      : [
          {
            type: 'text',
            text: available.includes(tool)
              ? 'Local smoke main response complete.'
              : `${tool} is not exposed by this CLI.`
          }
        ]
    const message = {
      id: `fixture_message_${requests}`,
      type: 'message',
      role: 'assistant',
      model: body.model ?? 'claude-sonnet-4-6',
      content,
      stop_reason: use ? 'tool_use' : 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 }
    }
    if (body.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      emit('message_start', {
        type: 'message_start',
        message: { ...message, content: [], stop_reason: null }
      })
      for (const [index, block] of content.entries()) {
        emit('content_block_start', {
          type: 'content_block_start',
          index,
          content_block:
            block.type === 'tool_use' ? { ...block, input: {} } : { type: 'text', text: '' }
        })
        emit('content_block_delta', {
          type: 'content_block_delta',
          index,
          delta:
            block.type === 'tool_use'
              ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) }
              : { type: 'text_delta', text: block.text }
        })
        emit('content_block_stop', { type: 'content_block_stop', index })
      }
      emit('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: message.stop_reason, stop_sequence: null },
        usage: { output_tokens: 1 }
      })
      emit('message_stop', { type: 'message_stop' })
      res.end()
    } else {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(message))
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  let mainResult = false
  let terminal = false
  let taskId
  let stopAck = false
  const timer = setTimeout(() => {
    timedOut = true
    live?.close()
  }, 45_000)
  try {
    async function* prompt() {
      yield {
        type: 'user',
        session_id: '',
        parent_tool_use_id: null,
        message: { role: 'user', content: 'Run the bounded local shell smoke once.' }
      }
      if (scenario?.action !== 'oneshot') await new Promise(() => {})
    }
    live = query({
      prompt: prompt(),
      options: {
        cwd,
        model: 'claude-sonnet-4-6',
        settingSources: [],
        persistSession: false,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        perTaskStopAffordance: true,
        agentProgressSummaries: true,
        includePartialMessages: true,
        env: {
          ...process.env,
          ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
          ANTHROPIC_API_KEY: 'local-fixture',
          ANTHROPIC_AUTH_TOKEN: 'local-fixture',
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
          CLAUDE_CODE_USE_POWERSHELL_TOOL: '1',
          CLAUDE_CODE_TMPDIR: root
        }
      }
    })
    for await (const event of live) {
      for (const normalized of mapper.map(event, '')?.events ?? []) {
        if (normalized.type !== 'provider.message')
          canonical = applyBackgroundEvent(canonical, normalized)
      }
      events.push({
        at: Date.now(),
        type: event.type,
        subtype: event.subtype,
        task_id: event.task_id,
        status: event.status,
        patch: event.patch,
        output_file: event.output_file,
        tool_use_id: event.tool_use_id,
        task_type: event.task_type,
        is_backgrounded: event.is_backgrounded,
        parent_tool_use_id: event.parent_tool_use_id,
        message: event.type === 'user' ? event.message : undefined,
        tools: event.type === 'system' && event.subtype === 'init' ? event.tools : undefined,
        tool_use_result: event.tool_use_result
      })
      if (event.type === 'result') mainResult = true
      if (promotion) {
        if (event.type === 'assistant')
          promotion.receivedToolCalls += (event.message?.content ?? []).filter(
            (part) => part.type === 'tool_use' && part.id === promotion.toolUseId
          ).length
        if (
          !actionApplied &&
          event.type === 'system' &&
          event.subtype === 'task_started' &&
          event.task_type === 'local_bash' &&
          event.tool_use_id === promotion.toolUseId &&
          event.is_backgrounded === false
        ) {
          promotion.foregroundTaskId = event.task_id
          promotion.pidBefore = (await waitForMarker(startedFile, 5000))?.trim()
          if (!promotion.pidBefore || (await readMarker(doneFile)) !== undefined)
            throw new Error('Foreground shell was not still running at promotion dispatch')
          shellStarted = true
          actionApplied = true
          observations.push({
            at: Date.now(),
            kind: 'promotion-dispatched',
            toolUseId: promotion.toolUseId,
            taskId: event.task_id,
            pid: promotion.pidBefore
          })
          promotion.acknowledged = await live.backgroundTasks(promotion.toolUseId)
          observations.push({
            at: Date.now(),
            kind: 'promotion-ack',
            acknowledged: promotion.acknowledged
          })
        }
        if (
          event.type === 'system' &&
          event.subtype === 'task_updated' &&
          event.patch?.is_backgrounded === true
        )
          promotion.updatedTaskIds.push(event.task_id)
        if (event.tool_use_result?.backgroundTaskId) {
          promotion.returnedTaskIds.push(event.tool_use_result.backgroundTaskId)
          promotion.backgroundedByUser = event.tool_use_result.backgroundedByUser
        }
        if (
          event.type === 'system' &&
          event.subtype === 'task_notification' &&
          event.task_id === promotion.foregroundTaskId
        ) {
          promotion.completedTaskId = event.task_id
          promotion.terminalStatus = event.status
        }
      }
      if (event.type === 'system' && event.subtype === 'task_started') taskId = event.task_id
      if (
        event.type === 'system' &&
        event.subtype === 'task_started' &&
        event.task_type === 'local_bash'
      )
        shellTaskId = event.task_id
      if (
        event.type === 'system' &&
        event.subtype === 'task_notification' &&
        event.task_id === shellTaskId
      )
        shellTerminal = true
      if (scenario?.action === 'workflow') {
        const output = event.tool_use_result
        if (output && typeof output === 'object' && output.error) startupError = output
      }
      if (scenario && !promotion && tool === 'Bash' && !actionApplied && !shellStarted) {
        const marker =
          event.type === 'system' &&
          event.subtype === 'task_started' &&
          event.task_type === 'local_bash'
            ? await waitForMarker(startedFile, 5000)
            : await readMarker(startedFile)
        if (marker !== undefined) {
          shellStarted = true
          observations.push({ at: Date.now(), kind: 'shell-started', pid: marker })
          if (scenario.action === 'interrupt' || scenario.action === 'close') {
            if ((await readMarker(doneFile)) !== undefined)
              throw new Error(
                'Shell already completed before lifecycle action; result is inconclusive'
              )
            actionApplied = true
            observations.push({ at: Date.now(), kind: scenario.action })
            if (scenario.action === 'close') {
              live.close()
              break
            }
            try {
              await live.interrupt()
            } catch (error) {
              actionError = String(error)
            }
          }
        }
      }
      if (stop && taskId && !stopAck) {
        await live.stopTask(taskId)
        stopAck = true
      }
      if (event.type === 'system' && event.subtype === 'task_notification') terminal = true
      if (scenario?.action === 'workflow' && mainResult) break
      if (!scenario && mainResult && (terminal || !available.includes(tool))) break
      if (promotion && mainResult && promotion.completedTaskId) break
      if (scenario?.action === 'interrupt' && actionApplied && shellTerminal) break
      if (scenario?.action === 'oneshot' && event.type === 'result') {
        observations.push({ at: Date.now(), kind: 'one-shot-main-result' })
      }
    }
    if (promotion) {
      promotion.pidAfter = (await waitForMarker(doneFile, 1000))?.trim()
      shellFinished = promotion.pidAfter !== undefined
      const id = promotion.foregroundTaskId
      if (
        !id ||
        promotion.acknowledged !== true ||
        promotion.toolCalls !== 1 ||
        promotion.receivedToolCalls !== 1 ||
        !promotion.updatedTaskIds.includes(id) ||
        promotion.returnedTaskIds.length !== 1 ||
        promotion.returnedTaskIds[0] !== id ||
        promotion.completedTaskId !== id ||
        promotion.terminalStatus !== 'completed' ||
        !promotion.pidBefore ||
        promotion.pidBefore !== promotion.pidAfter
      )
        throw new Error('Same-execution promotion evidence was incomplete or inconsistent')
    }
    if (scenario && !promotion && tool === 'Bash') {
      // Each command self-terminates after eight seconds. Observe only this case's markers.
      shellStarted ||= (await readMarker(startedFile)) !== undefined
      shellFinished = (await waitForMarker(doneFile, 10_000)) !== undefined
      observations.push({ at: Date.now(), kind: 'final-markers', shellStarted, shellFinished })
      if (!shellStarted)
        throw new Error('Shell start was not observed; lifetime result is inconclusive')
      if (scenario.action !== 'oneshot' && !actionApplied)
        throw new Error('Requested lifecycle action was not applied')
      if (actionError) throw new Error(actionError)
    }
    if (scenario?.action === 'workflow' && !startupError) {
      throw new Error('Workflow did not expose the expected structured startup error')
    }
    if (scenario?.action === 'workflow' && backgroundPending(canonical)) {
      throw new Error(
        'Production mapper/reducer retained running work after Workflow startup error'
      )
    }
    if (scenario?.name === 'workflow-oneshot' && !terminal)
      throw new Error('One-shot Workflow did not produce a terminal notification')
    const outputs = []
    for (const output of new Set(events.map((event) => event.output_file).filter(Boolean))) {
      const path = await realpath(output)
      const rel = relative(await realpath(root), path)
      const insideAppTemp =
        rel !== '..' &&
        !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) &&
        !isAbsolute(rel)
      if (!insideAppTemp) throw new Error('SDK output escaped the application temporary root')
      const text = await readFile(path, 'utf8')
      const ref = { id: output, field: 'output_file', value: output, kind: 'file' }
      const mainRead = await outputStore.read(ref, [root], { offset: 0, maxBytes: 65_536 })
      if (mainRead.status !== 'available' && mainRead.status !== 'partial') {
        throw new Error(`Production output reader rejected SDK output: ${mainRead.status}`)
      }
      const snapshot = await outputStore.capture(ref, [root])
      const captured = await outputStore.readSnapshot(snapshot, { offset: 0, maxBytes: 65_536 })
      if (captured.text !== mainRead.text)
        throw new Error('Captured output differs from the SDK file')
      outputs.push({
        path,
        insideAppTemp,
        bytes: Buffer.byteLength(text),
        korean: text.includes('한글'),
        mainReadStatus: mainRead.status,
        mainReadKorean: mainRead.text?.includes('한글'),
        snapshot: { size: snapshot.size, sha256: snapshot.sha256, partial: snapshot.partial }
      })
    }
    if (!scenario && !stop && outputs.length === 0)
      throw new Error('Completed task did not expose an output file')
    if (tool === 'PowerShell' && !outputs.some((output) => output.korean)) {
      throw new Error('PowerShell UTF-8 output did not preserve Korean text')
    }
    return {
      tool,
      stop,
      available: available.includes(tool),
      mainResult,
      terminal,
      taskId,
      stopAck,
      timedOut,
      requests,
      outputs,
      events,
      scenario,
      observations,
      shellStarted,
      shellFinished,
      actionApplied,
      startupError,
      promotion,
      canonical: {
        pending: backgroundPending(canonical),
        tasks: canonical.tasks,
        calls: canonical.calls
      }
    }
  } catch (error) {
    return {
      tool,
      stop,
      available: available.includes(tool),
      mainResult,
      terminal,
      stopAck,
      timedOut,
      requests,
      error: String(error),
      events,
      scenario,
      observations,
      shellStarted,
      shellFinished,
      actionApplied,
      startupError,
      promotion,
      canonical: {
        pending: backgroundPending(canonical),
        tasks: canonical.tasks,
        calls: canonical.calls
      }
    }
  } finally {
    clearTimeout(timer)
    live?.close()
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}
const cases =
  mode === 'basic'
    ? [
        ['Bash', false],
        ['Bash', true],
        ['PowerShell', false],
        ['Agent', false]
      ]
    : []
if (mode === 'lifetime' || mode === 'extended') {
  for (const owner of ['main', 'foreground-agent', 'background-agent']) {
    for (const action of ['interrupt', 'close', 'oneshot']) {
      cases.push(['Bash', false, { name: `${owner}-${action}`, owner, action }])
    }
  }
}
if (mode === 'workflow' || mode === 'extended') {
  cases.push(['Workflow', false, { name: 'workflow-start-error', action: 'workflow' }])
  cases.push(['Workflow', false, { name: 'workflow-oneshot', action: 'oneshot' }])
}
if (mode === 'promotion') {
  for (const tool of ['Bash', 'PowerShell'])
    cases.push([
      tool,
      false,
      { name: `${tool.toLowerCase()}-promotion`, action: 'promotion', owner: 'main' }
    ])
}
for (const [tool, stop, scenario] of cases) {
  if (selectedCase && scenario?.name !== selectedCase) continue
  console.log(`Running: ${scenario?.name ?? `${tool}-${stop ? 'stop' : 'complete'}`}`)
  const result = await run(tool, stop, scenario)
  results.push(result)
  await writeFile(join(cwd, 'result.json'), JSON.stringify({ cwd, mode, results }, null, 2))
  console.log(
    JSON.stringify({
      ...result,
      canonical: result.canonical && {
        pending: result.canonical.pending,
        tasks: Object.values(result.canonical.tasks).map(({ taskId, status }) => ({
          taskId,
          status
        })),
        calls: Object.values(result.canonical.calls).map(({ toolUseId, status }) => ({
          toolUseId,
          status
        }))
      },
      events: result.events.map((event) => ({
        type: event.type,
        subtype: event.subtype,
        task_id: event.task_id,
        status: event.status
      }))
    })
  )
}
if (!results.length) throw new Error('No smoke case matched the requested mode/case')
const path = join(cwd, 'result.json')
await writeFile(path, JSON.stringify({ cwd, mode, results }, null, 2))
console.log(`Evidence: ${path}`)
process.exitCode = results.some(
  (result) =>
    result.error || result.timedOut || !result.available || (!result.scenario && !result.terminal)
)
  ? 1
  : 0
