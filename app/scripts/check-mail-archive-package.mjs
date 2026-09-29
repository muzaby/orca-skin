// Inspect the actual electron-builder artifact, not its exclusion pattern declarations.
import assert from 'node:assert/strict'
import { listPackage } from '@electron/asar'

const archive = process.argv[2]
assert.ok(archive, 'Usage: node scripts/check-mail-archive-package.mjs <app.asar>')
const entries = listPackage(archive).map((entry) => entry.replaceAll('\\', '/'))
const forbidden = entries.filter((entry) =>
  /\/pst-extractor\/example\/|\/scripts\/fixtures\/|ORCA_MAIL_FIXTURE_SENTINEL/.test(entry)
)
assert.deepEqual(forbidden, [], 'Mail test fixtures must not ship in app.asar')
for (const worker of ['source-worker', 'index-worker']) {
  assert.ok(
    entries.some((entry) => new RegExp(`/out/main/${worker}-[^/]+\\.js$`).test(entry)),
    `Packaged ${worker} entry is missing`
  )
}
console.log('MAIL_ARCHIVE_PACKAGE: source/index entries present; forbidden mail fixtures absent')
