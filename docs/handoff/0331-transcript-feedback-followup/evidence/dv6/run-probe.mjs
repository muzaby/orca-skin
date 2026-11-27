import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const { serveProbe } = await import(new URL('../../../../../app/scripts/check-transcript-selection.mjs', import.meta.url).href)
const shots = process.cwd() + '/'
const served = await serveProbe('zz-scratch-probe')
const browser = await chromium.launch()
const out = {}
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } })
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      (out.console ??= []).push(m.text().slice(0, 400))
  })
  page.on('pageerror', (e) => (out.pageerror ??= []).push(String(e).slice(0, 400)))
  for (const arg of process.argv.slice(2)) {
    const [screen, scenario, deferred] = arg.split(':')
    const params = { screen, scenario, ...(deferred ? { deferred } : {}) }
    await page.goto(served.origin + '/?' + new URLSearchParams(params))
    await page.waitForTimeout(3000)
    if (scenario === 'tools' || scenario === 'workTools') {
      const toggles = await page.$$('[data-focus-id="toggle"]')
      for (const t of toggles) await t.click().catch(() => {})
      await page.waitForTimeout(3000)
    }
    out[arg] = await page.evaluate(() => window.report())
    await page.screenshot({ path: shots + arg.replaceAll(':', '-') + '.png' })
  }
} finally {
  await browser.close()
  await served.close()
}
console.log(JSON.stringify(out, null, 1))
