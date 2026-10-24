// Isolated probe: does a Claude local plugin disabled via `<name>@inline:false` still
// contribute skills/commands? Loopback API only; isolated HOME/CLAUDE_CONFIG_DIR.
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
const app = process.argv[2]
const { query } = await import(join(app, 'node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs'))
const exe = join(app, 'node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude')
const seen = []
const server = createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    seen.push(`${req.method} ${req.url}`)
    res.setHeader('content-type', 'application/json')
    if (req.url.includes('count_tokens')) return res.end(JSON.stringify({ input_tokens: 7 }))
    res.statusCode = 404
    res.end('{}')
  })
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const write = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v)) }
async function run(label, settings, extra = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'probe-'))
  const home = join(temp, 'home'), cfg = join(temp, 'claude'), cwd = join(temp, 'project'), plugin = join(temp, 'superpowers')
  mkdirSync(join(cwd, '.git'), { recursive: true }); mkdirSync(home, { recursive: true })
  write(join(plugin, '.claude-plugin/plugin.json'), { name: 'superpowers' })
  write(join(plugin, 'skills/brainstorming/SKILL.md'), '---\nname: brainstorming\ndescription: Brainstorm ideas\n---\nBody text for brainstorming skill.')
  write(join(cfg, 'settings.json'), { enabledPlugins: { 'superpowers@market': true } })
  write(join(cfg, 'plugins/installed_plugins.json'), { plugins: { 'superpowers@market': [{ scope: 'user', installPath: plugin }] } })
  let release
  const gate = new Promise((r) => (release = r))
  async function* prompt() { await gate }
  const q = query({ prompt: prompt(), options: {
    cwd, pathToClaudeCodeExecutable: exe, settingSources: ['project', 'local'],
    plugins: [{ type: 'local', path: plugin }], skills: ['superpowers:brainstorming'],
    settings: JSON.stringify(settings), persistSession: false,
    env: { ...process.env, HOME: home, CLAUDE_CONFIG_DIR: cfg, ANTHROPIC_API_KEY: 'sk-probe', ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', DISABLE_TELEMETRY: '1', DISABLE_AUTOUPDATER: '1' },
    ...extra } })
  const out = { label }
  try {
    const init = await q.initializationResult?.()
    out.initCommands = (init?.commands ?? []).map((c) => c.name).filter((n) => n.includes('superpowers'))
    out.supported = (await q.supportedCommands()).map((c) => c.name).filter((n) => n.includes('superpowers'))
    const usage = await q.getContextUsage({ detail: 'summary' })
    out.skills = JSON.stringify(usage.skills ?? null).slice(0, 600); out.categories = (usage.categories ?? []).map((c) => `${c.name}:${c.tokens}`)
    const reload = await q.reloadPlugins?.()
    out.reloadPlugins = (reload?.plugins ?? []).map((p) => p.name)
  } catch (e) { out.error = String(e?.message ?? e) }
  release(); q.close?.()
  return out
}
const results = []
results.push(await run('inline-true', { enabledPlugins: { 'superpowers@market': false, 'superpowers@inline': true } }))
results.push(await run('inline-false', { enabledPlugins: { 'superpowers@market': false, 'superpowers@inline': false } }))
results.push(await run('inline-false-no-skills-allowlist', { enabledPlugins: { 'superpowers@market': false, 'superpowers@inline': false } }, { skills: undefined }))
console.log(JSON.stringify({ results, seen: [...new Set(seen)] }, null, 2))
server.close()
process.exit(0)
