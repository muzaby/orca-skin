import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const { serveProbe } = await import(new URL('../../../../../app/scripts/check-transcript-selection.mjs', import.meta.url).href)
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
  await page.goto(served.origin + '/?' + new URLSearchParams({ screen: 'claude-code', scenario: 'markdown' }))
  await page.waitForTimeout(1500)
  out.withoutCancel = await Promise.race([page.evaluate(() => window.dropTest(false)), new Promise((r) => setTimeout(() => r('TIMEOUT'), 60000))])
  out.withCancel = await Promise.race([page.evaluate(() => window.dropTest(true)), new Promise((r) => setTimeout(() => r('TIMEOUT'), 60000))])
} finally {
  await browser.close()
  await served.close()
}
console.log(JSON.stringify(out, null, 1))
