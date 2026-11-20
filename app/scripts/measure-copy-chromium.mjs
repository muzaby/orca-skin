import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { UI_TASK_BUDGET_MS } from '../src/shared/perf-budget.ts'
import { measureJ9CopyCap } from './measure-ui-inputs.mjs'

const screens = ['claude-code', 'claude-work', 'opencode-code']
const sizes = [25, 50, 75, 100, 150, 200, 300, 400, 500]
const repetitions = 5
const constantSizes = (c) => [...new Set([c, c + 1, 2 * c + 1, 2500, 5000])]
const within = (ms, budget) => Number.isFinite(ms) && ms >= 0 && ms <= budget
const five = (runs, predicate) => runs?.length === repetitions && Array.from(runs).every(predicate)

function matches(run, n, c, budget) {
  const overflow = n > c
  const chunks = overflow ? Math.ceil(n / c) : 0
  if (!Array.isArray(run) || run.length !== (overflow ? chunks + 2 : 1)) return false
  return Array.from(run).every((task, i) => {
    if (!task || !within(task.durationMs, budget)) return false
    if (i === 0) return task.kind === 'handler' && task.blockCount === (overflow ? 0 : n)
    if (i > chunks) return task.kind === 'assemble' && task.blockCount === n
    return task.kind === 'chunk' && task.blockCount === Math.min(c, n - (i - 1) * c)
  })
}

export function judgeCandidate(samples, budgetMs = UI_TASK_BUDGET_MS) {
  return screens.every((screen) => screenPasses(samples[screen], samples.size, budgetMs))
}

function screenPasses(data, size, budget) {
  return (
    five(data?.sync, (ms) => within(ms, budget)) &&
    five(data.overflow, (run) => matches(run, 2 * size + 1, size, budget))
  )
}

export function deriveCopyCap(candidates) {
  let cap = null
  for (const { size, pass } of [...candidates].sort((a, b) => a.size - b.size)) {
    if (!pass) break
    cap = size
  }
  return cap
}

export function judgeConstant(
  { constant, cap, candidates, constantRuns },
  budget = UI_TASK_BUDGET_MS
) {
  return (
    Number.isSafeInteger(constant) &&
    constant > 0 &&
    constant <= cap &&
    Object.entries(candidates).every(([n, row]) => Number(n) > constant || row.pass) &&
    constantSizes(constant).every((n) =>
      screens.every((screen) =>
        five(constantRuns[n]?.[screen], (run) => matches(run, n, constant, budget))
      )
    )
  )
}

export function copyCapExitCode({ verdict, load, cores, env }) {
  if (load > cores) return 2
  if (!env) return 3
  return verdict ? 0 : 1
}

async function measure(page, n, limit) {
  await page.evaluate((size) => globalThis.select(size), n)
  const commandMs = await page.evaluate(() => {
    const start = performance.now()
    if (!document.execCommand('copy')) throw new Error('Native copy command failed')
    return performance.now() - start
  })
  const records = await page.evaluate((size) => globalThis.timings(size), n)
  // Keep the native handler's identity/count. The synchronous task also includes browser serialization.
  if (n <= limit && records[0]) records[0].durationMs = Math.max(records[0].durationMs, commandMs)
  return records
}

function summary(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return { median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) }
}

async function collect(browser, origin) {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const candidates = {}
  const constantRuns = {}
  let constant
  for (const candidate of [...sizes, null]) {
    for (const screen of screens) {
      const page = await context.newPage()
      try {
        await page.goto(
          origin + '/?screen=' + screen + (candidate ? '&candidate=' + candidate : '')
        )
        await page.waitForFunction(() => typeof globalThis.timings === 'function')
        constant = await page.evaluate(() => globalThis.cap)
        const c = candidate ?? constant
        const data = {}
        for (const n of candidate ? [c, 2 * c + 1] : constantSizes(c)) {
          await measure(page, n, c)
          const runs = []
          for (let i = 0; i < repetitions; i++) runs.push(await measure(page, n, c))
          if (!candidate) (constantRuns[n] ??= {})[screen] = runs
          else if (n === c)
            data.sync = runs.map((run) => (matches(run, n, c, Infinity) ? run[0].durationMs : null))
          else data.overflow = runs
        }
        if (candidate) {
          data.pass = screenPasses(data, c, UI_TASK_BUDGET_MS)
          data.summary = {
            sync: summary(data.sync),
            overflow: summary(data.overflow.flat().map((t) => t.durationMs))
          }
          candidates[c] ??= {}
          candidates[c][screen] = data
        }
      } catch (error) {
        throw new Error(screen + ' (' + (candidate ?? 'product constant') + '): ' + error.message)
      } finally {
        await page.close()
      }
    }
    if (candidate)
      candidates[candidate].pass = judgeCandidate({ size: candidate, ...candidates[candidate] })
  }
  const cap = deriveCopyCap(sizes.map((size) => ({ size, pass: candidates[size].pass })))
  const result = { cap, constant, candidates, constantRuns }
  const j9 = Object.fromEntries(
    measureJ9CopyCap([...new Set([...sizes, ...constantSizes(constant)])]).samples.map(
      ({ size, result }) => [size, result.median]
    )
  )
  return {
    ...result,
    j9,
    verdict: judgeConstant(result),
    ...(cap === null && { reason: '통과 표본 없음' })
  }
}

async function main() {
  const load = os.loadavg()[0]
  const cores = os.cpus().length
  let browser, server, dist
  try {
    if (load > cores) return { load, cores, env: true, verdict: false, reason: '측정 무효' }
    try {
      const { chromium } = createRequire(import.meta.url)('playwright')
      // Match the live-browser probe on headless Linux, where GPU rasterization is emulated.
      const args = process.platform === 'linux' ? ['--disable-gpu'] : []
      if (process.env.CHROME_PATH) {
        browser = await chromium.launch({ args, executablePath: process.env.CHROME_PATH })
      } else {
        try {
          browser = await chromium.launch({ args })
        } catch (error) {
          if (!existsSync('/usr/bin/chromium')) throw error
          browser = await chromium.launch({ args, executablePath: '/usr/bin/chromium' })
        }
      }
    } catch (error) {
      return { load, cores, env: false, verdict: false, reason: '환경 없음', error: String(error) }
    }
    const { build, preview } = await import('vite')
    const { default: tailwindcss } = await import('@tailwindcss/vite')
    const root = fileURLToPath(new URL('../', import.meta.url))
    dist = await mkdtemp(join(os.tmpdir(), 'orca-copy-'))
    const config = {
      root,
      configFile: false,
      logLevel: 'silent',
      build: {
        outDir: dist,
        target: 'esnext',
        rollupOptions: {
          input: join(root, 'scripts/copy-timing/probe.tsx'),
          output: { entryFileNames: 'probe.js' }
        }
      }
    }
    await build({
      ...config,
      worker: { format: 'es' },
      esbuild: { jsx: 'automatic' },
      resolve: { alias: { '@renderer': join(root, 'src/renderer/src') } },
      define: { 'import.meta.env.VITE_OO_DIAGNOSTIC': JSON.stringify('1') },
      plugins: [
        tailwindcss(),
        {
          name: 'candidate-copy-prop',
          enforce: 'pre',
          transform(source, id) {
            if (!id.endsWith('/TranscriptViewport.tsx')) return
            const prop = '  copyChunkSize,'
            if (source.split(prop).length !== 2)
              throw new Error('Viewport copyChunkSize prop changed')
            return source.replace(prop, '  copyChunkSize = globalThis.copyCandidate,')
          }
        }
      ]
    })
    await writeFile(
      join(dist, 'index.html'),
      '<div id="root"></div><script type="module" src="/probe.js"></script>'
    )
    server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0 } })
    return {
      load,
      cores,
      env: true,
      ...(await collect(browser, server.resolvedUrls.local[0].replace(/\/$/, '')))
    }
  } catch (error) {
    return { load, cores, env: true, verdict: false, error: String(error) }
  } finally {
    await browser?.close()
    if (server) await server.close()
    if (dist) await rm(dist, { recursive: true, force: true })
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await main()
  console.log(JSON.stringify(result))
  process.exitCode = copyCapExitCode(result)
}
