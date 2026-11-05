import { pathToFileURL } from 'node:url'
const { analyzeScale } = await import(pathToFileURL(process.argv[2] + '/scripts/check-test-budgets.mjs').href)
const vc = (code) => {
  const out = analyzeScale('a.test.ts', code, [], [])
  const red = out.filter((l) => l.includes('판정 불가'))
  const ids = red.map((l) => (l.match(/판정 불가 ([A-Z]{2}\d+[a-z]?)/) ?? [, '?'])[1]).sort()
  return `${out.length}/${red.length}/${ids.join(',') || '-'}`
}
const IMP = (n) => `import { ${n} } from './o'\n`
const cases = {
  T1_boundary_origin: `${IMP('cfg')}const { ms } = cfg\nsetTimeout(f, ms)`,
  T2_function_ref_origin: `function getOpts() {}\nconst { ms } = getOpts\nsetTimeout(f, ms)`,
  T3_param_multi_call: `${IMP('getOpts')}function run({ ms }) { setTimeout(f, ms) }\nrun({ ms: 5000 })\nrun(getOpts())`,
  T4_param_member_read: `function run({ o }) { setTimeout(f, o.ms) }\nrun({ o: { ms: 5000 } })`,
}
for (const [k, v] of Object.entries(cases)) console.log(k, vc(v))
