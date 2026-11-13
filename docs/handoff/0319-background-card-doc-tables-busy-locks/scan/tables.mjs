#!/usr/bin/env node
// 0319 W2 gate — 마크다운 표의 행마다 셀 수가 머리 행과 같은지 센다(GFM 표 규칙의 부분집합).
//
//   node tables.mjs <file...>                            작업 트리 파일의 표 깨짐 검사. 깨진 행·모르는 형태가 있으면 exit 1
//   node tables.mjs --base <rev> [--head <rev>] <file...> 위 검사 + 바뀐 줄이 내용 보존 치환뿐인지 대조.
//                                                        --head 를 주면 작업 트리 대신 그 커밋의 파일을 판정한다
//   (저장소 루트에서 실행한다 — 경로와 `git show <rev>:<path>` 가 같은 기준이어야 한다)
//
// 셀 나누기: 줄 앞뒤의 `|` 하나씩을 떼고, 바로 앞이 `\` 가 아닌 `|` 로 나눈다. GFM 은 코드 조각
// 안에서도 `\|` 를 나누지 않고 `|` 는 나눈다 — 그래서 코드 조각 안 파이프도 셀을 가른다.
//
// fail-closed: 아래 형태는 판정하지 않고 red 로 막는다(허용하려면 이 파일을 고친다).
//   - 표 바로 뒤의 줄이 `|` 로 시작하지 않는데 이스케이프 안 된 `|` 를 담는다(GFM 은 표 행으로 읽는다)
//   - 구분 행의 셀 수가 머리 행과 다르다(GFM 은 표로 읽지 않는다)
//   - 인용(`>`) 안의 표 · `\\|`(이스케이프된 역슬래시 뒤 파이프)
//
// 내용 보존(--base): 바뀐 줄 L 은 `L.replaceAll('\\|', '|').replaceAll(' <br>', ' | ')` 가 기준 줄과
// 같아야 하고, 기준에서 깨진 행이어야 하며, 파일의 줄 수가 같아야 한다.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
let base
let head
while (args[0] === '--base' || args[0] === '--head') {
  if (args[0] === '--base') base = args[1]
  else head = args[1]
  args.splice(0, 2)
}
if (!args.length || (head && !base)) {
  console.error('usage: tables.mjs [--base <rev> [--head <rev>]] <file...>')
  process.exit(2)
}
const show = (rev, file) => execFileSync('git', ['show', `${rev}:${file}`], { encoding: 'utf8' })

const DELIMITER = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/
const cells = (line) => {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  return s.split(/(?<!\\)\|/).length
}

// 한 파일의 판정 — { tables, rows, broken: [{line, header, row}], unknown: [{line, why}] }
function judge(text) {
  const lines = text.split('\n')
  const out = { tables: 0, rows: 0, broken: [], unknown: [] }
  // 모르는 형태는 표 본문 행을 포함해 펜스 밖의 모든 줄에서 본다.
  const screen = (line, n) => {
    if (/\\\\\|/.test(line)) out.unknown.push({ line: n, why: 'escaped backslash before pipe' })
    if (/^\s*>\s*\|/.test(line)) out.unknown.push({ line: n, why: 'table inside blockquote' })
  }
  let fence = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMark = line.trimStart().match(/^(`{3,}|~{3,})/)
    if (fenceMark) {
      if (!fence) fence = fenceMark[1][0]
      else if (fenceMark[1][0] === fence) fence = null
      continue
    }
    if (fence) continue
    screen(line, i + 1)
    if (!line.trimStart().startsWith('|') || !DELIMITER.test(lines[i + 1] ?? '')) continue
    const header = cells(line)
    if (cells(lines[i + 1]) !== header)
      out.unknown.push({ line: i + 2, why: 'delimiter cell count differs from header' })
    out.tables++
    let j = i + 2
    for (; j < lines.length && lines[j].trimStart().startsWith('|'); j++) {
      out.rows++
      screen(lines[j], j + 1)
      const row = cells(lines[j])
      if (row !== header) out.broken.push({ line: j + 1, header, row })
    }
    if (j < lines.length && lines[j].trim() !== '' && /(?<!\\)\|/.test(lines[j]))
      out.unknown.push({ line: j + 1, why: 'pipe line continues a table without a leading pipe' })
    i = j - 1
  }
  return out
}

let failed = false
for (const file of args) {
  const text = head ? show(head, file) : readFileSync(file, 'utf8')
  const result = judge(text)
  console.log(
    `${file}: tables ${result.tables} · rows ${result.rows} · broken ${result.broken.length} · unknown ${result.unknown.length}`
  )
  for (const b of result.broken) console.log(`  broken ${file}:${b.line} header=${b.header} row=${b.row}`)
  for (const u of result.unknown) console.log(`  unknown ${file}:${u.line} ${u.why}`)
  if (result.broken.length || result.unknown.length) failed = true
  if (!base) continue
  const before = show(base, file)
  const brokenBefore = new Set(judge(before).broken.map((b) => b.line))
  const a = before.split('\n')
  const b = text.split('\n')
  if (a.length !== b.length) {
    console.log(`  preserve ${file}: line count ${a.length} -> ${b.length}`)
    failed = true
    continue
  }
  let changed = 0
  for (let k = 0; k < a.length; k++) {
    if (a[k] === b[k]) continue
    changed++
    const restored = b[k].replaceAll('\\|', '|').replaceAll(' <br>', ' | ')
    if (restored !== a[k]) {
      console.log(`  preserve ${file}:${k + 1} content changed beyond escaping`)
      failed = true
    } else if (!brokenBefore.has(k + 1)) {
      console.log(`  preserve ${file}:${k + 1} changed a row that was not broken at base`)
      failed = true
    }
  }
  console.log(`  preserve ${file}: changed ${changed} · broken at base ${brokenBefore.size}`)
}
process.exit(failed ? 1 : 0)
