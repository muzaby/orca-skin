// 테스트 시간 예산 자리 전수 열거(TypeScript AST). plan §10 EP-03·EP-04·EP-05·EP-02 의 분모를 만든 명령이다.
// 사용: node scan-test-budgets.mjs <app 디렉토리>
//   setConfig  : vi.setConfig(...) 호출과 인자
//   case/hook  : it/test/describe/bench/suite 와 before*/after* 의 타임아웃 인자(숫자 또는 { timeout })
//   deadline   : Date.now()/performance.now() + N
//   setTimeout : 숫자 리터럴 지연 ≥ 1000ms
//   waitFor    : vi.waitFor 호출 수·옵션 분포
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
const app = process.argv[2] ?? '.'
const ts = createRequire(join(app, 'package.json'))('typescript')
const list = (d) => readdirSync(d).flatMap((e) => { const f = join(d, e); return statSync(f).isDirectory() ? list(f) : /\.test\.tsx?$/.test(e) ? [f] : [] })
const TEST = new Set(['it', 'test', 'describe', 'bench', 'suite'])
const HOOK = new Set(['beforeAll', 'beforeEach', 'afterAll', 'afterEach'])
const root = (expr) => { let e = expr; while (ts.isCallExpression(e) || ts.isPropertyAccessExpression(e)) e = e.expression; return ts.isIdentifier(e) ? e.text : null }
const isFn = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n)
const num = (t) => Number(t.replace(/_/g, ''))
const out = { setConfig: [], case: [], hook: [], deadline: [], setTimeout: [], waitFor: [] }
for (const file of list(join(app, 'src'))) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const rel = relative(app, file).replaceAll('\\', '/')
  const at = (n) => `${rel}:${src.getLineAndCharacterOfPosition(n.getStart()).line + 1}`
  const text = (n) => n.getText(src).replace(/\s+/g, ' ').slice(0, 80)
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(src)
      const name = root(n.expression)
      if (callee === 'vi.setConfig') out.setConfig.push(`${at(n)}\t${text(n.arguments[0])}`)
      else if (callee === 'vi.waitFor') out.waitFor.push(n.arguments[1] ? text(n.arguments[1]) : '(default)')
      else if (/(^|\.)setTimeout$/.test(callee) && n.arguments[1] && ts.isNumericLiteral(n.arguments[1]) && num(n.arguments[1].text) >= 1000)
        out.setTimeout.push(`${at(n)}\t${n.arguments[1].getText(src)}\t${text(n.arguments[0])}`)
      else if (name && (TEST.has(name) || HOOK.has(name))) {
        n.arguments.forEach((a, i) => {
          const afterFn = n.arguments.slice(0, i).some(isFn)
          const option = ts.isObjectLiteralExpression(a) && a.properties.some((p) => p.name?.getText(src) === 'timeout')
          if ((afterFn && !isFn(a)) || option) out[HOOK.has(name) ? 'hook' : 'case'].push(`${at(a)}\t${callee.slice(0, 24)}\t${text(a)}`)
        })
      }
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken && /^(Date|performance)\.now\(\)$/.test(n.left.getText(src)))
      out.deadline.push(`${at(n)}\t${text(n)}\t${text(n.parent)}`)
    ts.forEachChild(n, visit)
  }
  visit(src)
}
for (const [kind, rows] of Object.entries(out)) {
  if (kind === 'waitFor') continue
  console.log(`== ${kind} ${rows.length}`)
  for (const row of rows) console.log(`  ${row}`)
}
const dist = {}
for (const o of out.waitFor) { const m = /timeout:\s*([\w_]+)/.exec(o); const k = o === '(default)' ? 'default' : m ? m[1] : 'no-timeout-option'; dist[k] = (dist[k] ?? 0) + 1 }
console.log(`== waitFor ${out.waitFor.length}\t${JSON.stringify(dist)}`)
