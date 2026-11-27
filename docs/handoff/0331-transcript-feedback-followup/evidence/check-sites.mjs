/** ΔV5 planning evidence. Run from the repository root with Node and ripgrep. */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const cases = JSON.parse(readFileSync(new URL('./site-inventory.json', import.meta.url), 'utf8'))
const group = process.argv[2]
if (group && !Object.hasOwn(cases, group)) {
  throw new Error('Expected errors or markdown')
}

function ranges(files) {
  return Object.entries(files)
    .flatMap(([file, lines]) => lines.split(',').map((range) => file + ':' + range))
    .join(',')
}

for (const [name, checks] of Object.entries(cases)) {
  if (group && name !== group) continue
  for (const check of checks) {
    console.log(name + ' / ' + check.name)
    const result = spawnSync(process.execPath, [
      '.agents/skills/handoff-verify/scripts/site_census.mjs',
      '--search', check.search,
      '--sites', ranges(check.sites),
      '--excluded', ranges(check.excluded)
    ], { stdio: 'inherit' })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
}
