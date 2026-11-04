// 0294 ΔV2 경계 측정 — vi.waitFor 옵션 인자·자식 프로세스 마지막 비문자열 인자의 문법 종류(인라인 객체가 아니면 출력). 사용: node scan-option-args.mjs <app 절대경로>
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
const app = process.argv[2]
const ts = createRequire(join(app, 'package.json'))('typescript')
const list = (d) => readdirSync(d).flatMap((e) => { const f = join(d, e); if (statSync(f).isDirectory()) return e === 'node_modules' ? [] : list(f); return /\.test\.ts$|\.testfixture\.tsx?$/.test(e) ? [f] : [] })
const CP = /(^|\.)(execFile|execFileSync|spawn|spawnSync|exec|execSync|fork)$/
const kinds = {}
for (const file of list(join(app, 'src'))) {
  const rel = relative(app, file); const src = ts.createSourceFile(rel, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const w = (n) => {
    if (ts.isCallExpression(n)) {
      const c = n.expression.getText(src)
      const opt = c === 'vi.waitFor' ? n.arguments.slice(1) : CP.test(c) ? n.arguments.filter((a) => !ts.isStringLiteralLike(a) && !ts.isArrayLiteralExpression(a)).slice(-1) : []
      for (const a of opt) {
        const k = `${c === 'vi.waitFor' ? 'waitFor' : 'child'}:${ts.SyntaxKind[a.kind]}`
        kinds[k] = (kinds[k] ?? 0) + 1
        if (!ts.isObjectLiteralExpression(a) && !ts.isNumericLiteral(a)) console.log(`${k}\t${rel}:${src.getLineAndCharacterOfPosition(a.getStart(src)).line + 1}\t${a.getText(src).slice(0, 60)}`)
      }
    }
    ts.forEachChild(n, w)
  }
  w(src)
}
console.log(JSON.stringify(kinds))
