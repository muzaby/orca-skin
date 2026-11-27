import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const { serveProbe } = await import(new URL('../../../../../app/scripts/check-transcript-selection.mjs', import.meta.url).href)
const shots = process.cwd() + '/'
const served = await serveProbe('zz-scratch-probe')
const browser = await chromium.launch()
const out = {}
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } })
  page.on('pageerror', (e) => (out.pageerror ??= []).push(String(e).slice(0, 300)))
  await page.goto(served.origin + '/?' + new URLSearchParams({ screen: 'claude-work', scenario: 'workNotes' }))
  await page.waitForTimeout(1500)
  const disclosure = await page.$('button[aria-expanded="false"]')
  await disclosure?.click()
  await page.waitForTimeout(50)
  out.immediate = await page.evaluate(() => window.notes())
  await page.waitForTimeout(3000)
  out.settled = await page.evaluate(() => window.notes())
  await page.screenshot({ path: shots + 'work-notes.png' })
} finally {
  await browser.close()
  await served.close()
}
console.log(JSON.stringify(out, null, 1))
