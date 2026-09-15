import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveJiraEntrypoint } from './entrypoint'
import { createJiraRuntimeServer } from './server'
import { JIRA_TOOL_NAMES } from './tools'

const children = new Set<ChildProcessWithoutNullStreams>()

afterEach(async () => {
  const pending = [...children]
  for (const child of pending) child.kill()
  await Promise.all(
    pending.map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) resolve()
          else child.once('exit', () => resolve())
        })
    )
  )
  children.clear()
})

async function listInstalledJiraTools(): Promise<string[]> {
  const server = createJiraRuntimeServer({
    authId: 'jira',
    origin: 'https://jira.invalid',
    token: 'dummy-token',
    credentialRevision: 1,
    electronExecutable: process.execPath,
    packageEntrypoint: resolveJiraEntrypoint()
  })
  const child = spawn(server.command, [...(server.args ?? [])], {
    env: { ...process.env, ...server.env },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  children.add(child)
  const lines = createInterface({ input: child.stdout })
  const responses = new Map<number, (value: unknown) => void>()
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk)
  })
  lines.on('line', (line) => {
    const message = JSON.parse(line) as { id?: number }
    if (typeof message.id === 'number') responses.get(message.id)?.(message)
  })
  child.once('exit', (code) => {
    for (const resolve of responses.values()) {
      resolve({ error: { message: `Jira MCP exited (${code}): ${stderr}` } })
    }
  })

  const request = (
    id: number,
    method: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out: ${method}\n${stderr}`)), 5_000)
      responses.set(id, (value) => {
        clearTimeout(timeout)
        responses.delete(id)
        resolve(value as Record<string, unknown>)
      })
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })

  const initialized = await request(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'orca-package-contract', version: '1.0.0' }
  })
  expect(initialized).not.toHaveProperty('error')
  child.stdin.write(
    `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`
  )
  const listed = await request(2, 'tools/list', {})
  expect(listed).not.toHaveProperty('error')
  const result = listed.result as { tools: Array<{ name: string }> }
  return result.tools.map((tool) => tool.name)
}

describe('@atlassian-dc-mcp/jira package contract', () => {
  it('initialize/tools/list가 descriptor 14개와 exact equality다', async () => {
    expect((await listInstalledJiraTools()).sort()).toEqual([...JIRA_TOOL_NAMES].sort())
  })
})
