import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

const EXPECTED_TOOLS = [
  'jira_searchIssues',
  'jira_getIssue',
  'jira_getIssueComments',
  'jira_createIssue',
  'jira_updateIssue',
  'jira_postIssueComment',
  'jira_updateIssueComment',
  'jira_getTransitions',
  'jira_getIssueDevelopmentInfo',
  'jira_transitionIssue',
  'jira_getIssueLinkTypes',
  'jira_linkIssues',
  'jira_unlinkIssues',
  'jira_downloadAttachment'
].sort()

const unpackedRoot = resolve(process.argv[2] ?? 'dist/win-unpacked')
const executable = join(unpackedRoot, 'orcinus-orca.exe')
const resources = join(unpackedRoot, 'resources')
const appAsar = join(resources, 'app.asar')
const entrypoint = join(appAsar, 'node_modules', '@atlassian-dc-mcp', 'jira', 'build', 'index.js')

if (!existsSync(executable)) throw new Error(`Packaged executable is missing: ${executable}`)
if (!existsSync(appAsar)) throw new Error(`Packaged app.asar is missing: ${appAsar}`)

const child = spawn(executable, [entrypoint], {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    JIRA_API_BASE_PATH: 'https://jira.invalid/rest',
    JIRA_API_TOKEN: 'dummy-token',
    JIRA_DEFAULT_PAGE_SIZE: '25',
    JIRA_ATTACHMENTS_UPLOAD_ENABLED: 'false',
    JIRA_ATTACHMENTS_DOWNLOAD_ENABLED: 'false',
    ATLASSIAN_DC_MCP_CONFIG_FILE: ''
  },
  stdio: ['pipe', 'pipe', 'pipe']
})

let stderr = ''
child.stderr.on('data', (chunk) => {
  stderr += String(chunk)
})
const pending = new Map()
const lines = createInterface({ input: child.stdout })
lines.on('line', (line) => {
  const message = JSON.parse(line)
  if (typeof message.id === 'number') pending.get(message.id)?.(message)
})
child.once('exit', (code) => {
  for (const settle of pending.values()) {
    settle({ error: { message: `Jira MCP exited (${code}): ${stderr}` } })
  }
})

function request(id, method, params) {
  return new Promise((resolveRequest, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${method}: ${stderr}`)),
      10_000
    )
    pending.set(id, (message) => {
      clearTimeout(timer)
      pending.delete(id)
      resolveRequest(message)
    })
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  })
}

try {
  const initialized = await request(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'orca-packaged-jira-smoke', version: '1.0.0' }
  })
  if (initialized.error) throw new Error(JSON.stringify(initialized.error))
  child.stdin.write(
    `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`
  )
  const listed = await request(2, 'tools/list', {})
  if (listed.error) throw new Error(JSON.stringify(listed.error))
  const names = listed.result.tools.map((tool) => tool.name).sort()
  if (JSON.stringify(names) !== JSON.stringify(EXPECTED_TOOLS)) {
    throw new Error(`Packaged Jira tools drifted: ${JSON.stringify(names)}`)
  }
  process.stdout.write(`packaged Jira MCP smoke passed (${names.length} tools)\n`)
} finally {
  child.kill()
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise((resolveExit) => child.once('exit', resolveExit))
  }
}
