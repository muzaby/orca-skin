// 0325 AC19 의 재현 입력과 함수 재측정 — 0325 AC22 · EP-10 · D-042 의 오라클이다.
//
// 왜 커밋되어 있는가: 요청서는 "빈 parts 메시지 20만 개, Git 파일 5만 추가 줄, 초안 40만 자를 다시
// 실행한다" 를 요구한다. 그런데 빈 parts 메시지는 native 스냅샷으로만 생기고 앱에 그런 세션을 넣는 경로가
// 없다(0325 §8 X10). 앱 DB 에 합성 세션을 쓰는 도구는 저장 형식 위험이라 만들지 않고, 같은 Windows 장비에서
// 실제 소스 함수를 다시 잰다. 절차가 산출을 결정하지 못하면 오라클이 아니다(0216 D-210) — 입력·측정·요약을
// 전부 이 파일에 둔다.
//
// 실행 (app/ 에서):
//   node scripts/measure-ui-inputs.mjs --src <app 트리>        I1~I9 를 1회 예열 + 9회 재고 중앙값·최대 표를 낸다
//   node scripts/measure-ui-inputs.mjs --write-inputs <폴더>   F1~F5 재현 파일(초안 · PNG · Git 저장소)을 쓴다
// 두 커밋 비교는 `git worktree add <경로> ee8ac81` 로 꺼낸 트리를 `--src` 로 준다. 외부 의존은 이 스크립트를
// 실행하는 `app/node_modules` 로 해석한다(0325 단계 A 는 의존을 바꾸지 않는다).
//
// 규칙:
//   · 입력은 결정적이다 — 난수·시각을 쓰지 않아 같은 인자는 같은 산출이다.
//   · 측정이 던지면 그 행은 `N/A(실패: 메시지)`, 대상 트리에 함수가 없으면 `N/A(함수 없음)` 이다 — 값으로
//     채우지 않는다(0325 §19 N/A).
//   · 요약은 예열 1회를 뺀 9회의 중앙값·최대다.
// 순수 부분(입력 생성 · 요약 · N/A)과 `--src` 번들(임시 트리)은 `measure-ui-inputs.test.mjs` 가 돌린다 — git 은 실행하지 않는다.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '..')

export const WARMUP_RUNS = 1
export const MEASURED_RUNS = 9

// ── 입력 (I1~I9 · F1~F5) ───────────────────────────────────────────────────────

// I1 빈 parts 메시지 200,000건.
export function emptySessionMessages(count = 200_000) {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    createdAt: index,
    parts: []
  }))
}

// I2 추가 줄 50,000 의 Git patch 줄(main 이 파싱해 보내는 형상).
export function addedPatchLines(count = 50_000) {
  return Array.from({ length: count }, (_, index) => ({
    type: 'added',
    oldLine: null,
    newLine: index + 1,
    text: `export const line${index} = ${index}`
  }))
}

// I3·I4·I5 · F1·F2·F3 초안.
export function draftText(kind) {
  switch (kind) {
    case 'large':
      return '/build @file.ts '.repeat(25_000) // 400,000자
    case 'edge':
      return `/z${'.'.repeat(19_998)}` // 20,000자 — 장식 상한 안
    case 'over':
      return `/z${'.'.repeat(19_999)}` // 20,001자 — 장식 상한 밖
    default:
      throw new Error(`알 수 없는 초안: ${kind}`)
  }
}

const block = (count, prefix) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`).join('\n')

// I6 MultiEdit 수정 50 × (200+200줄).
export function multiEditCall(edits = 50) {
  return {
    toolUseId: 'measure-multiedit',
    name: 'MultiEdit',
    input: {
      file_path: 'measure.ts',
      edits: Array.from({ length: edits }, (_, index) => ({
        old_string: block(200, `old${index}-`),
        new_string: block(200, `new${index}-`)
      }))
    }
  }
}

// I7 한 줄 5,000,000자 두 입력.
export function longLinePair(chars = 5_000_000) {
  return ['a'.repeat(chars), 'b'.repeat(chars)]
}

// 추가 줄만 가진 unified patch — 길이를 정확히 `chars` 로 맞춘다.
export function addedPatchText(chars, lines) {
  const head = `--- a/f.ts\n+++ b/f.ts\n@@ -0,0 +1,${lines} @@\n`
  const width = Math.floor((chars - head.length) / lines) - 2
  const text = head + Array.from({ length: lines }, () => `+${'x'.repeat(width)}\n`).join('')
  return text.slice(0, -1) + 'x'.repeat(chars - text.length) + '\n'
}

// I8 OpenCode 파일 patch 3 × 404,045자.
export function patchFiles(count = 3, chars = 404_045) {
  const patch = addedPatchText(chars, 4_000)
  return Array.from({ length: count }, (_, index) => ({ path: `f${index}.ts`, patch }))
}

// I9 과거 exchange 10,000 뒤 assistant 1건 추가.
export function exchangeHistory(exchanges = 10_000) {
  const base = []
  for (let index = 0; index < exchanges; index++) {
    base.push({
      role: 'user',
      createdAt: index * 2 + 1,
      parts: [{ type: 'text', text: `q${index}` }]
    })
    base.push({
      role: 'assistant',
      createdAt: index * 2 + 2,
      parts: [{ type: 'text', text: `a${index}` }]
    })
  }
  const next = [
    ...base,
    { role: 'assistant', createdAt: exchanges * 2 + 1, parts: [{ type: 'text', text: '추가' }] }
  ]
  return { base, next }
}

// F5 Git 파일 — 50,000줄(커밋 뒤 이 내용을 쓰면 5만 추가 줄 diff 다).
export function gitFileContent(lines = 50_000) {
  return `${block(lines, 'export const generated')}\n`
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

// F4 단색 RGB PNG — `seed` 가 색을 정한다(결정적).
export function pngImage(width = 4032, height = 3024, seed = 0) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // RGB
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = (seed * 53) & 0xff
    row[2 + x * 3] = (seed * 97 + 64) & 0xff
    row[3 + x * 3] = (seed * 151 + 128) & 0xff
  }
  const raw = Buffer.alloc(row.length * height)
  for (let y = 0; y < height; y++) row.copy(raw, y * row.length)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// F1~F4 와 F5 의 파일 내용 — 파일 이름 → 바이트. 같은 인자는 같은 바이트다.
export function inputFiles() {
  const files = {
    'draft-400000.txt': Buffer.from(draftText('large')),
    'draft-20000.txt': Buffer.from(draftText('edge')),
    'draft-20001.txt': Buffer.from(draftText('over')),
    'git-50000/generated.ts': Buffer.from(gitFileContent())
  }
  for (let index = 0; index < 5; index++)
    files[`image-${index + 1}.png`] = pngImage(4032, 3024, index)
  return files
}

// ── 측정 요약 ────────────────────────────────────────────────────────────────

// 예열 1회를 뺀 9회의 중앙값·최대.
export function summarize(times) {
  if (times.length !== WARMUP_RUNS + MEASURED_RUNS)
    throw new Error(`측정 수가 다르다: ${times.length}/${WARMUP_RUNS + MEASURED_RUNS}`)
  const measured = times.slice(WARMUP_RUNS).sort((a, b) => a - b)
  return { median: measured[Math.floor(measured.length / 2)], max: measured[measured.length - 1] }
}

// 측정 하나 — 함수가 없으면 `N/A(함수 없음)`, 던지면 `N/A(실패: 메시지)`. `prepare` 는 재지 않는다.
export function measureCase(run, { clock = () => performance.now(), prepare } = {}) {
  if (typeof run !== 'function') return 'N/A(함수 없음)'
  const times = []
  try {
    for (let index = 0; index < WARMUP_RUNS + MEASURED_RUNS; index++) {
      const state = prepare?.()
      const started = clock()
      run(state)
      times.push(clock() - started)
    }
  } catch (error) {
    return `N/A(실패: ${error instanceof Error ? error.message : String(error)})`
  }
  return summarize(times)
}

export function formatCell(result) {
  return typeof result === 'string'
    ? result
    : `${result.median.toFixed(2)}ms / ${result.max.toFixed(2)}ms`
}

// ── 측정 대상 (대상 트리의 소스 함수) ─────────────────────────────────────────

// 번들 진입점이 다시 내보내는 대상 트리의 모듈 — 없는 파일은 빈 모듈이다.
export const SOURCE_MODULES = {
  dataHost: 'src/shared/data-host.ts',
  patchLines: 'src/renderer/src/features/chat/lib/diffPatchLines.ts',
  diffHunks: 'src/renderer/src/features/chat/lib/diffHunks.ts',
  decoration: 'src/renderer/src/features/chat/harnesses/common/composer/composerDecoration.ts',
  toolMeta: 'src/renderer/src/features/chat/lib/toolMeta.ts',
  inline: 'src/renderer/src/shared/compute/inline.ts',
  filePresentation:
    'src/renderer/src/features/chat/harnesses/opencode/transcript/filePresentation.ts',
  turns: 'src/renderer/src/features/chat/lib/turns.ts'
}

// I1~I9 — 각 행은 모듈에서 함수를 고르고(없으면 `undefined`) 입력을 미리 만든다.
export function measurementCases(modules) {
  const session = emptySessionMessages()
  const patch = addedPatchLines()
  const known = new Set(['build'])
  const files = new Set(['file.ts'])
  const [longA, longB] = longLinePair()
  const history = exchangeHistory()
  // 입력은 재기 전에 만든다 — 측정 구간에는 대상 함수만 있다.
  const drafts = { large: draftText('large'), edge: draftText('edge'), over: draftText('over') }
  const multiEdit = multiEditCall()
  const opencodeFiles = patchFiles()
  const { dataHost, patchLines, diffHunks, decoration, toolMeta, inline, filePresentation, turns } =
    modules
  const tokenize = decoration.tokenizeComposerDecoration
  return [
    {
      id: 'I1',
      input: '빈 parts 메시지 200,000건 분할·조립',
      run:
        dataHost.splitSessionMessages && dataHost.assembleSession
          ? () => {
              const chunks = dataHost.splitSessionMessages(session)
              const head = {
                id: 's',
                backend: 'claude',
                agentKind: 'code',
                title: '',
                messages: [],
                chunked: { chunks: chunks.length, messages: session.length }
              }
              dataHost.assembleSession(
                head,
                chunks.map((messages, seq) => ({ seq, messages }))
              )
            }
          : undefined
    },
    {
      id: 'I2',
      input: '5만 추가 줄 patch → hunk',
      run:
        patchLines.patchLinesToDiffLines && diffHunks.buildDiffHunks
          ? () => diffHunks.buildDiffHunks(patchLines.patchLinesToDiffLines(patch), 3)
          : undefined
    },
    {
      id: 'I3',
      input: '초안 400,000자 장식',
      run: tokenize ? () => tokenize(drafts.large, known, files) : undefined
    },
    {
      id: 'I4',
      input: '`/z` + 마침표 19,998개(20,000자) 장식',
      run: tokenize ? () => tokenize(drafts.edge, known, files) : undefined
    },
    {
      id: 'I5',
      input: '`/z` + 마침표 19,999개(20,001자) 장식',
      run: tokenize ? () => tokenize(drafts.over, known, files) : undefined
    },
    {
      id: 'I6',
      input: 'MultiEdit 50 × (200+200줄) 머리',
      run: toolMeta.toolDiffStat ? () => toolMeta.toolDiffStat(multiEdit) : undefined
    },
    {
      id: 'I7',
      input: '한 줄 5,000,000자 쌍 인라인 diff',
      run: inline.diffLinesWithinCap ? () => inline.diffLinesWithinCap(longA, longB) : undefined
    },
    {
      id: 'I8',
      input: 'patch 3 × 404,045자 머리',
      run: filePresentation.fileChanges
        ? () => filePresentation.fileChanges(opencodeFiles)
        : undefined
    },
    // Claude Timeline 이 확정 메시지 추가에 하는 그룹화 — 증분 grouper 가 있으면 그것, 없으면 전체 그룹화.
    turns.createExchangeGrouper
      ? {
          id: 'I9',
          input: '10,000 exchange 뒤 1건 추가 그룹화(createExchangeGrouper)',
          prepare: () => {
            const grouper = turns.createExchangeGrouper()
            grouper(history.base)
            return grouper
          },
          run: (grouper) => grouper(history.next)
        }
      : {
          id: 'I9',
          input: '10,000 exchange 뒤 1건 추가 그룹화(groupExchanges)',
          run: turns.groupExchanges ? () => turns.groupExchanges(history.next) : undefined
        }
  ]
}

// `--src` 트리의 소스만 번들해 불러온다 — 없는 모듈 파일은 빈 모듈이다(0325 EP-10 ④).
export async function loadTree(tree) {
  const { build } = await import('esbuild')
  const work = mkdtempSync(join(tmpdir(), 'measure-ui-inputs-'))
  try {
    const entry = Object.entries(SOURCE_MODULES)
      .map(([name, file]) => {
        const path = join(tree, file)
        return existsSync(path)
          ? `export * as ${name} from ${JSON.stringify(path)}`
          : `export const ${name} = {}`
      })
      .join('\n')
    writeFileSync(join(work, 'entry.mjs'), entry)
    const outfile = join(work, 'bundle.mjs')
    await build({
      entryPoints: [join(work, 'entry.mjs')],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      logLevel: 'silent',
      nodePaths: [join(APP, 'node_modules')]
    })
    return await import(pathToFileURL(outfile).href)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

async function measureTree(tree) {
  const modules = await loadTree(tree)
  const rows = measurementCases(modules).map((item) => ({
    ...item,
    result: measureCase(item.run, { prepare: item.prepare })
  }))
  const lines = [
    `| 입력 | 내용 | 중앙값 / 최대 (예열 ${WARMUP_RUNS} 뒤 ${MEASURED_RUNS}회) |`,
    '|---|---|---|',
    ...rows.map((row) => `| ${row.id} | ${row.input} | ${formatCell(row.result)} |`)
  ]
  process.stdout.write(
    `트리: ${tree}\nNode ${process.version} · ${process.platform}/${process.arch}\n\n${lines.join('\n')}\n`
  )
}

function writeInputs(folder) {
  for (const [name, bytes] of Object.entries(inputFiles())) {
    if (name.startsWith('git-50000/')) continue
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, name), bytes)
  }
  // F5 — 빈 파일을 커밋한 뒤 5만 줄을 쓴다(작업 트리의 변경 = 5만 추가 줄).
  const repo = join(folder, 'git-50000')
  mkdirSync(repo, { recursive: true })
  const git = (...args) =>
    execFileSync(
      'git',
      ['-c', 'user.name=measure', '-c', 'user.email=measure@example.invalid', ...args],
      { cwd: repo, stdio: 'ignore' }
    )
  git('init', '-q')
  writeFileSync(join(repo, 'generated.ts'), '')
  git('add', 'generated.ts')
  git('commit', '-q', '-m', 'empty')
  writeFileSync(join(repo, 'generated.ts'), inputFiles()['git-50000/generated.ts'])
  process.stdout.write(`재현 입력을 썼다: ${folder}\n`)
}

async function main(argv) {
  const flag = argv[0]
  const value = argv[1]
  if (flag === '--src' && value) return measureTree(resolve(value))
  if (flag === '--write-inputs' && value) return writeInputs(resolve(value))
  process.stderr.write(
    '사용법: node scripts/measure-ui-inputs.mjs --src <app 트리> | --write-inputs <폴더>\n'
  )
  process.exitCode = 2
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await main(process.argv.slice(2))
