#!/usr/bin/env node
// site_census.mjs — §10 자리 검색 출력의 줄마다 "값을 운반하는가"를 AST로 가른다.
//
// §10 `언제 강제`의 자리 목록은 기록된 검색 명령의 출력에서 운반 줄을 골라 만든다. 그 골라내기를
// 눈으로 하면 설계자와 검증자가 같은 모델이라 같은 줄을 같이 놓친다(0329 verify 3: 검색 출력 9줄 중
// `AboveInput.tsx:11·13·14`를 둘 다 "import·타입·주석"으로 읽었다). 이 스크립트는 그 분류를 TypeScript
// AST로 하고, 목록에도 제외 목록에도 없는 운반 줄(미분류)을 낸다. 판정은 하지 않는다 — 미분류 줄을
// 목록에 넣을지, 사유를 붙여 제외할지는 설계자가 정하고 검증자가 같은 명령으로 다시 센다.
//
// 사용(저장소 루트):
//   node .agents/skills/handoff-verify/scripts/site_census.mjs \
//     --search "rg -n 'openCodeTodoTurnStartIndex' app/src -g '!*.test.*' -g '!*.testfixture.*'" \
//     --sites  app/src/a.ts:10-15,app/src/b.ts:44 \
//     [--excluded app/src/c.ts:560] [--emit-mutants "<oracle 명령>" --cwd app]
//
// 줄 분류(한 줄에 일치가 여럿이면 value가 이긴다):
//   value        값을 읽거나 쓰거나 넘긴다 — 운반 후보. 목록 또는 제외 목록에 있어야 한다
//   type         타입 선언·타입 위치(interface·type·속성 시그니처·타입 인자)
//   import       import/export 지정자
//   declaration  함수·메서드·클래스 이름(정의 자체 — 그 본문의 운반 줄은 따로 잡힌다)
//   comment      주석·문자열 밖의 텍스트 일치
//   unparsed     TS/JS가 아닌 파일 — 사람이 판정한다(미분류로 센다)
// 종료 코드 — 세 경우를 섞지 않는다. 검색이 실패해 출력이 비면 "미분류 0"처럼 보이기 때문이다.
//   0  정상 검사, 미분류 0 · 목록에만 있는 범위 0
//   1  정상 검사, 미분류 > 0 또는 검색 줄이 하나도 없는 목록 범위(목록이 낡았거나 술어가 못 닿음)
//   2  검색 실행 실패(rg 종료 코드 ≥ 2 — 없는 경로·잘못된 정규식·잘못된 인자) 또는 검색 줄 파일 읽기 실패
//   3  검색은 성공했지만 0줄인데 --sites로 예상 자리가 주어짐
// --emit-mutants: value 일치마다 mutate.py spec(JSONL) 한 줄을 stdout 끝에 낸다 — 속성 이름은
// `__oo_mut`를 붙여 다른 키로, 단독 식별자는 `(void 0)`으로 바꾼다. 미분류 줄이 실제로 잠겼는지는
// 이 spec을 mutate.py로 돌려 본다(green이면 운반하지만 아무 좌표도 보지 않는 줄이다). oracle의 종료 코드가
// 판정이므로 `… | tail`처럼 파이프로 끝내지 않는다 — 파이프의 마지막 명령이 0이면 실패도 green이 된다.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(resolve('app/package.json'))
const ts = require('typescript')

function arg(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const search = arg('--search')
if (!search) {
  console.error('--search "<rg 명령>" 이 필요하다')
  process.exit(2)
}
const parseRanges = (value) =>
  (value ? value.split(',') : []).filter(Boolean).map((entry) => {
    const [file, span] = entry.split(/:(?=\d)/)
    const [from, to] = span.split('-').map(Number)
    return { file, from, to: to ?? from }
  })
const sites = parseRanges(arg('--sites'))
const excluded = parseRanges(arg('--excluded'))
const emit = arg('--emit-mutants')
const cwdPrefix = (arg('--cwd', '') || '').replace(/\/?$/, '/')
const inRanges = (ranges, file, line) =>
  ranges.some((r) => r.file === file && line >= r.from && line <= r.to)

const rgPattern = (() => {
  const m = search.match(/rg\s+(?:-\w+\s+)*(?:'([^']+)'|"([^"]+)")/)
  return new RegExp(m ? (m[1] ?? m[2]).replace(/\\\|/g, '|').replace(/\\\(/g, '\\(') : '$^', 'g')
})()

// rg는 일치 0을 1로, 실행 오류를 2로 낸다. 오류가 나도 일부 경로의 결과를 찍을 수 있으므로 출력이 있어도 실패로 본다.
const run = spawnSync('/bin/bash', ['-c', search], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
if (run.error || run.status === null || run.status >= 2) {
  console.error(`검색 실행 실패(종료 코드 ${run.status ?? run.error?.message}) — 미분류를 셀 수 없다`)
  if (run.stderr) console.error(run.stderr.trim())
  process.exit(2)
}
const hits = run.stdout
  .split('\n')
  .map((row) => row.match(/^(.+?):(\d+):(.*)$/))
  .filter(Boolean)
  .map(([, file, line, text]) => ({ file, line: Number(line), text }))

const sources = new Map()
function source(file) {
  if (!sources.has(file)) {
    const kind = /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : /\.(ts|mts|cts|js|mjs|cjs)$/.test(file) ? ts.ScriptKind.TS : null
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch (error) {
      console.error(`검색 줄의 파일을 읽지 못했다: ${file} (${error.code}) — 검색을 저장소 루트에서 돌렸는지 확인한다`)
      process.exit(2)
    }
    sources.set(file, { text, sf: kind === null ? null : ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind) })
  }
  return sources.get(file)
}

function tokenAt(sf, pos) {
  let found
  const visit = (node) => {
    if (pos < node.getStart(sf) || pos >= node.getEnd()) return
    if (node.getChildCount(sf) === 0) found = node
    else node.getChildren(sf).forEach(visit)
  }
  visit(sf)
  return found
}

function classify(node) {
  if (!node) return { cls: 'comment' }
  if (node.kind !== ts.SyntaxKind.Identifier && node.kind !== ts.SyntaxKind.PrivateIdentifier && !ts.isStringLiteralLike(node))
    return { cls: 'comment' }
  for (let p = node.parent, child = node; p; child = p, p = p.parent) {
    if (ts.isImportDeclaration(p) || ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p))
      return { cls: 'import' }
    if (ts.isTypeNode(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isPropertySignature(p) || ts.isHeritageClause(p))
      return { cls: 'type' }
    if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p) || ts.isClassDeclaration(p)) && p.name === child)
      return { cls: 'declaration' }
    if (ts.isExpression(p) || ts.isStatement(p) || ts.isBindingElement(p) || ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p) || ts.isVariableDeclaration(p))
      break
  }
  return { cls: 'value', node }
}

function mutant(sf, node) {
  const p = node.parent
  const start = node.getStart(sf)
  const end = node.getEnd()
  const name = node.getText(sf)
  if (ts.isShorthandPropertyAssignment(p)) return [start, end, `${name}__oo_mut: ${name}`]
  if (ts.isBindingElement(p) && !p.propertyName) return [start, end, `${name}__oo_mut: ${name}`]
  if ((ts.isPropertyAccessExpression(p) && p.name === node) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p))
    return [start, end, `${name}__oo_mut`]
  if (ts.isStringLiteralLike(node)) return [start + 1, end - 1, `${node.text}__oo_mut`]
  return [start, end, '(void 0)']
}

const rank = { value: 5, unparsed: 4, declaration: 3, type: 2, import: 1, comment: 0 }
const rows = []
const specs = []
for (const hit of hits) {
  const { text, sf } = source(hit.file)
  let cls = 'unparsed'
  const lineStart = sf ? sf.getPositionOfLineAndCharacter(hit.line - 1, 0) : 0
  if (sf) {
    cls = 'comment'
    for (const m of hit.text.matchAll(rgPattern)) {
      const result = classify(tokenAt(sf, lineStart + m.index))
      if (rank[result.cls] > rank[cls]) cls = result.cls
      if (result.cls === 'value' && emit) {
        const [s, e, replacement] = mutant(sf, result.node)
        const lineEnd = text.indexOf('\n', lineStart)
        const old = text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd)
        const changed = text.slice(lineStart, s) + replacement + text.slice(e, lineEnd < 0 ? undefined : lineEnd)
        let occ = 0
        for (let at = text.indexOf(old); at >= 0 && at < lineStart; at = text.indexOf(old, at + 1)) occ++
        const file = hit.file.startsWith(cwdPrefix) ? hit.file.slice(cwdPrefix.length) : hit.file
        specs.push({ id: `SC-${hit.file.split('/').pop()}:${hit.line}:${m.index}`, file, old, new: changed, occ, oracle: emit })
      }
    }
  }
  const state = inRanges(sites, hit.file, hit.line) ? 'site' : inRanges(excluded, hit.file, hit.line) ? 'excluded' : '-'
  rows.push({ ...hit, cls, state })
}

console.log('줄\t분류\t목록\t본문')
for (const r of rows) console.log(`${r.file}:${r.line}\t${r.cls}\t${r.state}\t${r.text.trim().slice(0, 100)}`)
const carrying = rows.filter((r) => r.cls === 'value' || r.cls === 'unparsed')
const unlisted = carrying.filter((r) => r.state === '-')
const listedNonValue = rows.filter((r) => r.state === 'site' && r.cls !== 'value')
const orphanRanges = [...sites, ...excluded].filter((r) => !rows.some((row) => row.file === r.file && row.line >= r.from && row.line <= r.to))
console.log(`\n검색 ${rows.length}줄 · 운반 후보 ${carrying.length} · 목록 ${rows.filter((r) => r.state === 'site').length} · 제외 ${rows.filter((r) => r.state === 'excluded').length} · 미분류 ${unlisted.length} · 목록만 ${orphanRanges.length}`)
for (const r of unlisted) console.log(`미분류\t${r.file}:${r.line}\t${r.cls}`)
for (const r of orphanRanges) console.log(`목록만\t${r.file}:${r.from}${r.to !== r.from ? `-${r.to}` : ''}\t검색 줄이 없다`)
for (const r of listedNonValue) console.log(`참고\t${r.file}:${r.line}\t목록에 있으나 ${r.cls}`)
if (emit) for (const s of specs) console.log(JSON.stringify(s))
if (rows.length === 0 && sites.length) {
  console.log(`상태: 검색 0줄인데 예상 자리 ${sites.length}개 — 경로·술어를 확인한다`)
  process.exit(3)
}
const clean = unlisted.length === 0 && orphanRanges.length === 0
console.log(`상태: ${rows.length === 0 ? '검색 0줄(예상 자리 없음)' : clean ? '정상 — 미분류 0' : '불일치'}`)
process.exit(sites.length && !clean ? 1 : 0)
