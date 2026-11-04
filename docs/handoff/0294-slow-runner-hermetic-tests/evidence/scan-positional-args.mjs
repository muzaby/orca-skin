// 0294 ΔV2 경계 측정 — 같은 파일 선언에 닿지 않는 호출(production·라이브러리)의 위치 인자로 넘기는 숫자 리터럴 ≥1000. 사용: node scan-positional-args.mjs <app 절대경로>
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
const app = process.argv[2]
const ts = createRequire(join(app, 'package.json'))('typescript')
const list = (d) => readdirSync(d).flatMap((e) => { const f = join(d, e); if (statSync(f).isDirectory()) return e === 'node_modules' ? [] : list(f); return /\.test\.ts$|\.testfixture\.tsx?$/.test(e) ? [f] : [] })
const SKIP = /^(scaleMs|scaledBudget|expect|vi\.|it$|test$|describe$|beforeAll|beforeEach|afterAll|afterEach|setTimeout|setInterval|globalThis\.setTimeout|AbortSignal\.timeout|Buffer\.|Array|new Array|String|Number|Math\.|Date\.UTC|Object\.|JSON\.|crypto|BigInt)/
for (const file of list(join(app, 'src')).sort()) {
  const rel = relative(app, file); const text = readFileSync(file, 'utf8')
  const src = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true)
  const local = new Set()
  const c = (n) => { if ((ts.isFunctionDeclaration(n) && n.name) ) local.add(n.name.text); if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) local.add(n.name.text); ts.forEachChild(n, c) }; c(src)
  const w = (n) => {
    if ((ts.isCallExpression(n) || ts.isNewExpression(n)) && n.arguments) {
      const callee = n.expression.getText(src).replace(/\s+/g, '')
      const isMatcher = ts.isPropertyAccessExpression(n.expression) && /^(to[A-Z]|resolves|rejects|not)/.test(n.expression.name.text)
      if (!SKIP.test(callee) && !isMatcher && !local.has(callee) && !(ts.isNewExpression(n) && /^(Date|Error|Map|Set|Uint8Array|ArrayBuffer|Promise)$/.test(callee)))
        n.arguments.forEach((a, i) => { if (ts.isNumericLiteral(a) && Number(a.text.replace(/_/g, '')) >= 1000) console.log(`${rel}:${src.getLineAndCharacterOfPosition(a.getStart(src)).line + 1}\t${ts.isNewExpression(n) ? 'new ' : ''}${callee.slice(0, 40)}\t#${i}\t${a.text}`) })
    }
    ts.forEachChild(n, w)
  }
  w(src)
}
