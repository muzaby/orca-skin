import { pathToFileURL } from 'node:url'
const { analyzeScale } = await import(pathToFileURL(process.argv[2] + '/scripts/check-test-budgets.mjs').href)
const cases = {
  selfInit: `const { ms } = { ms: ms }\nsetTimeout(f, ms)`,
  cycleDestr: `let o = {}\no = o.a\nconst { a: { ms } } = o\nsetTimeout(f, ms)`,
  defaultCall: `function run({ ms } = run()) { setTimeout(f, ms) }\nrun()`,
  thisAlias: `class A { ms = 500; run() { const { ms } = this; this.ms = ms; setTimeout(f, ms) } }`,
  paramSelf: `function run(o) { o = o.x; const { ms } = o; setTimeout(f, ms) }\nrun({ x: { ms: 5000 } })`,
  forOfSelf: `const list = [{ ms: 5000 }]\nfor (const { ms } of list) setTimeout(f, ms)`,
}
for (const [k, v] of Object.entries(cases)) {
  try {
    const out = analyzeScale('a.test.ts', v, [], [])
    console.log(k, 'ok', out.length)
  } catch (e) { console.log(k, 'THROW', String(e.message).split('\n')[0]) }
}
