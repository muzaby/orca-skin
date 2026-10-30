// 0290 i18n 미참조 키 스캐너 — ko.ts 를 평가해 키를 펼치고, 비리소스 소스에서 키 리터럴 또는
// 동적 부모(`parent.${`) 참조가 없는 키를 출력한다. i18next 복수 접미(_one·_other)는 기준 키 참조로 센다.
//
// usage (repo root):
//   node docs/handoff/0290-simplify-0254-0289/scan/i18n-unreferenced.cjs [--keys keys.txt]
//   node docs/handoff/0290-simplify-0254-0289/scan/i18n-unreferenced.cjs --absent keys.txt
//   --keys 를 주면 그 키 목록만 판정한다(한 줄 한 키).
//   --absent 는 목록 키 중 ko.ts 에 아직 있는 키를 출력하고, 하나라도 있으면 exit 1.
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '../../../..')
const APP = path.join(ROOT, 'app')
const ts = require(path.join(APP, 'node_modules/typescript'))
const keysArg = process.argv.indexOf('--keys')
const absentArg = process.argv.indexOf('--absent')
const readList = (file) =>
  fs.readFileSync(path.resolve(ROOT, file), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)

function flatten(file) {
  const src = fs.readFileSync(file, 'utf8').replace(/^import .*$/gm, '')
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText
  const m = { exports: {} }
  new Function('module', 'exports', 'PRODUCT_DISPLAY_NAME', 'PRODUCT_SLUG', out)(m, m.exports, 'P', 'p')
  const keys = []
  const walk = (o, p) => {
    for (const [k, v] of Object.entries(o)) {
      const key = p ? `${p}.${k}` : k
      if (v && typeof v === 'object') walk(v, key)
      else keys.push(key)
    }
  }
  walk(m.exports.ko, '')
  return keys
}

function sources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!file.includes(`${path.sep}i18n${path.sep}resources`)) sources(file, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.|\.testfixture\.|\.testlib\./.test(entry.name)) out.push(file)
  }
  return out
}

const all = flatten(path.join(APP, 'src/renderer/src/shared/i18n/resources/ko.ts'))
if (absentArg > 0) {
  const present = new Set(all)
  const left = readList(process.argv[absentArg + 1]).filter((key) => present.has(key))
  process.stdout.write(left.join('\n') + (left.length ? '\n' : ''))
  process.stderr.write(`present=${left.length}\n`)
  process.exit(left.length ? 1 : 0)
}
const wanted = keysArg > 0 ? readList(process.argv[keysArg + 1]) : all
const text = [path.join(APP, 'src/renderer/src'), path.join(APP, 'src/shared'), path.join(APP, 'src/main')]
  .flatMap((dir) => sources(dir))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
const quoted = (key) => ["'", '"', '`'].some((q) => text.includes(`${q}${key}${q}`))
const unreferenced = wanted.filter((key) => {
  const base = key.replace(/_(zero|one|two|few|many|other)$/, '')
  if (quoted(key) || quoted(base)) return false
  const parent = base.split('.').slice(0, -1).join('.')
  return !text.includes(`\`${parent}.\${`) && !text.includes(`'${parent}.' +`)
})
process.stdout.write(unreferenced.join('\n') + (unreferenced.length ? '\n' : ''))
process.stderr.write(`keys=${wanted.length} unreferenced=${unreferenced.length}\n`)
