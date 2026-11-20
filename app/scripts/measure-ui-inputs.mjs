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

import { DOMImplementation, XMLSerializer } from '@xmldom/xmldom'
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
  turns: 'src/renderer/src/features/chat/lib/turns.ts',
  changeLog: 'src/renderer/src/features/chat/lib/transcript/changeLog.ts',
  reducer: 'src/renderer/src/features/chat/reducer/chatReducer.ts',
  messageOrder: 'src/renderer/src/features/chat/lib/transcript/messageOrder.ts',
  blockList: 'src/renderer/src/features/chat/lib/transcript/blockList.ts',
  claudeBlocks: 'src/renderer/src/features/chat/harnesses/claude/transcript/claudeBlocks.ts',
  openCodeBlocks: 'src/renderer/src/features/chat/harnesses/opencode/transcript/openCodeBlocks.ts',
  segmentCache: 'src/renderer/src/features/chat/lib/segmentCache.ts',
  transcriptIndex: 'src/renderer/src/features/chat/lib/transcriptIndex.ts',
  markdownBlocks: 'src/renderer/src/features/chat/lib/markdownBlocks.ts'
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

// ── 0326 입력 J1~J10 · 세 갈래 요약(coldBuild / incremental / cacheHit) ───────

export const J9_SIZES = Array.from({ length: 20 }, (_, i) => (i + 1) * 100) // 100..2,000 step 100
export const J9_BUDGET_MS = 50

export function jTranscriptMessages(turns = 500) {
  const messages = []
  for (let i = 0; i < turns; i++) {
    messages.push({
      id: `u:j-${i}`,
      role: 'user',
      createdAt: i * 2 + 1,
      parts: [{ type: 'text', text: `question ${i}` }]
    })
    messages.push({
      id: `a:j-${i}`,
      role: 'assistant',
      createdAt: i * 2 + 2,
      parts: [
        { type: 'text', text: `answer ${i}` },
        { type: 'tool_call', toolRunId: `jt-${i}`, toolName: 'Read', args: { path: `f${i}.ts` } },
        { type: 'tool_result', toolRunId: `jt-${i}`, result: `content ${i}`, isError: false }
      ]
    })
  }
  return messages
}

export function jOpenFenceStream(chars = 100_000, chunk = 50) {
  const header = '```ts\n'
  const body = 'const x = 1;\n'.repeat(Math.ceil(chars / 13)).slice(0, chars)
  const full = header + body
  const deltas = []
  for (let i = 0; i < full.length; i += chunk) deltas.push(full.slice(i, i + chunk))
  return { full, deltas }
}

export function measureJ9CopyCap(
  sizes = J9_SIZES,
  { budgetMs = J9_BUDGET_MS, clock = () => performance.now() } = {}
) {
  const samples = []
  let maxPassing = null
  for (const size of sizes) {
    const blocks = Array.from({ length: size }, (_, i) => ({
      key: `b:${i}`,
      text: `Line ${i}: example transcript block content with code \`const v${i} = ${i}\``
    }))
    const res = measureCase(
      () => {
        const doc = new DOMImplementation().createDocument(
          'http://www.w3.org/1999/xhtml',
          'section',
          null
        )
        const root = doc.documentElement
        for (const block of blocks) {
          const row = doc.createElement('div')
          row.setAttribute('data-block-key', block.key)
          const body = doc.createElement('span')
          body.setAttribute('data-part-key', block.key)
          body.appendChild(doc.createTextNode(block.text))
          row.appendChild(body)
          root.appendChild(row)
        }
        return root.textContent.length + new XMLSerializer().serializeToString(root).length
      },
      { clock }
    )
    samples.push({ size, result: res })
    if (typeof res !== 'string' && res.median <= budgetMs) {
      maxPassing = size
    }
  }
  const assembleTasks = [2_500, 5_000].map((count) => {
    const textParts = []
    const htmlParts = []
    const chunkSize = maxPassing ?? sizes[0] ?? 1
    for (let from = 0; from < count; from += chunkSize) {
      const length = Math.min(chunkSize, count - from)
      if (from) textParts.push('\n')
      textParts.push(Array.from({ length }, (_, i) => `block ${from + i} text payload`).join('\n'))
      htmlParts.push(
        Array.from({ length }, (_, i) => `<p>block ${from + i} text payload</p>`).join('')
      )
    }
    const Item =
      globalThis.ClipboardItem ??
      class {
        constructor(data) {
          this.types = Object.keys(data)
          this.data = data
        }
      }
    const fakeClipboard = { write: async () => undefined }
    const result = measureCase(
      () => {
        const textBlob = new Blob(textParts, { type: 'text/plain' })
        const htmlBlob = new Blob(htmlParts, { type: 'text/html' })
        void fakeClipboard.write([new Item({ 'text/plain': textBlob, 'text/html': htmlBlob })])
      },
      { clock }
    )
    return { count, result }
  })
  return {
    samples,
    cap: maxPassing ?? '통과 표본 없음',
    assembleTasks
  }
}

export async function measureJ10Virtualizer(sizes = [5_000, 100_000]) {
  let Virtualizer
  try {
    const mod = await import('@tanstack/virtual-core')
    Virtualizer = mod.Virtualizer
  } catch {
    return sizes.map((count) => ({ count, result: 'N/A(함수 없음)', getItemKeyCalls: 0 }))
  }
  const rows = []
  for (const count of sizes) {
    let getItemKeyCalls = 0
    const keys = Array.from({ length: count + 1 }, (_, i) => `k:${i}`)
    const getItemKey = (index) => {
      getItemKeyCalls++
      return keys[index]
    }
    const makeVirt = (n) => {
      const v = new Virtualizer({
        count: n,
        getScrollElement: () => ({}),
        estimateSize: () => 50,
        getItemKey,
        scrollToFn: () => {},
        observeElementRect: (_inst, cb) => cb({ width: 600, height: 800 }, false),
        observeElementOffset: (_inst, cb) => cb(0, false)
      })
      v.shouldAdjustScrollPositionOnItemSizeChange = () => false
      v._didMount()
      v._willUpdate()
      v.getVirtualItems()
      return v
    }

    const scenarios = [
      {
        label: `J10(${count}:count+1)`,
        prepare: () => {
          const v = makeVirt(count)
          getItemKeyCalls = 0
          return v
        },
        run: (v) => {
          v.setOptions({ ...v.options, count: count + 1, getItemKey })
          v._willUpdate()
          v.getVirtualItems()
        }
      },
      {
        label: `J10(${count}:topResize)`,
        prepare: () => {
          const v = makeVirt(count)
          getItemKeyCalls = 0
          return v
        },
        run: (v) => {
          v.resizeItem(0, 80)
          v.getVirtualItems()
        }
      },
      {
        label: `J10(${count}:lastResize)`,
        prepare: () => {
          const v = makeVirt(count)
          getItemKeyCalls = 0
          return v
        },
        run: (v) => {
          v.resizeItem(count - 1, 80)
          v.getVirtualItems()
        }
      }
    ]
    for (const sc of scenarios) {
      const result = measureCase(sc.run, { prepare: sc.prepare })
      rows.push({ id: sc.label, count, result, getItemKeyCalls })
    }
  }
  return rows
}

export function transcriptMeasurementCases(modules) {
  const {
    changeLog = {},
    messageOrder = {},
    blockList = {},
    claudeBlocks = {},
    openCodeBlocks = {},
    segmentCache = {},
    transcriptIndex = {},
    markdownBlocks = {}
  } = modules
  const msgs = jTranscriptMessages(500)
  const fence = jOpenFenceStream(10_000, 50)

  const threeBranch = (id, label, fns) => [
    { id: `${id}:coldBuild`, input: `${label} (coldBuild)`, ...fns.coldBuild },
    { id: `${id}:incremental`, input: `${label} (incremental)`, ...fns.incremental },
    { id: `${id}:cacheHit`, input: `${label} (cacheHit)`, ...fns.cacheHit }
  ]

  function prependCase(turns, branch) {
    const reducer = modules.reducer
    if (!reducer?.chatReducer || !claudeBlocks.createClaudeBlockModel) return {}
    const messages = jTranscriptMessages(turns + 1)
    const page = messages.slice(0, 2)
    return {
      prepare() {
        const model = claudeBlocks.createClaudeBlockModel({ mode: 'code', sessionKey: 'j8' })
        const state = reducer.chatReducer(reducer.initialChatState, {
          type: 'LOAD_SESSION',
          session: { id: 'j8', backend: 'claude', agentKind: 'code', messages: messages.slice(2) },
          complete: false
        })
        if (branch !== 'coldBuild') model.advance(state)
        return { model, state }
      },
      run({ model, state }) {
        const next =
          branch === 'incremental'
            ? reducer.chatReducer(state, {
                type: 'PREPEND_HISTORY',
                messages: page,
                reachedStart: false
              })
            : state
        return { blocks: model.advance(next).count, messages: next.messages.length }
      }
    }
  }

  return [
    ...threeBranch('J1', 'Claude code 블록 1,000메시지 끝 추가', {
      coldBuild: {
        run:
          claudeBlocks.createClaudeBlockModel && changeLog.newTranscriptChanges
            ? () => {
                const m = claudeBlocks.createClaudeBlockModel({ mode: 'code', sessionKey: 'j1' })
                const log = changeLog.recordChange(changeLog.newTranscriptChanges(), {
                  kind: 'reset',
                  complete: true
                })
                m.advance({ messages: msgs, transcriptChanges: log })
              }
            : undefined
      },
      incremental: {
        prepare: () => {
          if (!claudeBlocks.createClaudeBlockModel || !changeLog.newTranscriptChanges) return null
          const m = claudeBlocks.createClaudeBlockModel({ mode: 'code', sessionKey: 'j1' })
          const log0 = changeLog.recordChange(changeLog.newTranscriptChanges(), {
            kind: 'reset',
            complete: true
          })
          m.advance({ messages: msgs, transcriptChanges: log0 })
          const nextMsg = {
            id: 'u:j-new',
            role: 'user',
            createdAt: 99999,
            parts: [{ type: 'text', text: 'next' }]
          }
          const log1 = changeLog.recordChange(log0, { kind: 'append', ids: ['u:j-new'] })
          return { m, state: { messages: [...msgs, nextMsg], transcriptChanges: log1 } }
        },
        run: claudeBlocks.createClaudeBlockModel
          ? (ctx) => ctx && ctx.m.advance(ctx.state)
          : undefined
      },
      cacheHit: {
        prepare: () => {
          if (!claudeBlocks.createClaudeBlockModel || !changeLog.newTranscriptChanges) return null
          const m = claudeBlocks.createClaudeBlockModel({ mode: 'code', sessionKey: 'j1' })
          const log0 = changeLog.recordChange(changeLog.newTranscriptChanges(), {
            kind: 'reset',
            complete: true
          })
          const state = { messages: msgs, transcriptChanges: log0 }
          m.advance(state)
          return { m, state }
        },
        run: claudeBlocks.createClaudeBlockModel
          ? (ctx) => ctx && ctx.m.advance(ctx.state)
          : undefined
      }
    }),
    ...threeBranch('J2', 'OpenCode 블록 1,000메시지 끝 추가', {
      coldBuild: {
        run:
          openCodeBlocks.createOpenCodeBlockModel && changeLog.newTranscriptChanges
            ? () => {
                const m = openCodeBlocks.createOpenCodeBlockModel()
                const log = changeLog.recordChange(changeLog.newTranscriptChanges(), {
                  kind: 'reset',
                  complete: true
                })
                m.advance({ messages: msgs, transcriptChanges: log })
              }
            : undefined
      },
      incremental: {
        prepare: () => {
          if (!openCodeBlocks.createOpenCodeBlockModel || !changeLog.newTranscriptChanges)
            return null
          const m = openCodeBlocks.createOpenCodeBlockModel()
          const log0 = changeLog.recordChange(changeLog.newTranscriptChanges(), {
            kind: 'reset',
            complete: true
          })
          m.advance({ messages: msgs, transcriptChanges: log0 })
          const nextMsg = {
            id: 'u:j2-new',
            role: 'user',
            createdAt: 99999,
            parts: [{ type: 'text', text: 'next' }]
          }
          const log1 = changeLog.recordChange(log0, { kind: 'append', ids: ['u:j2-new'] })
          return { m, state: { messages: [...msgs, nextMsg], transcriptChanges: log1 } }
        },
        run: openCodeBlocks.createOpenCodeBlockModel
          ? (ctx) => ctx && ctx.m.advance(ctx.state)
          : undefined
      },
      cacheHit: {
        prepare: () => {
          if (!openCodeBlocks.createOpenCodeBlockModel || !changeLog.newTranscriptChanges)
            return null
          const m = openCodeBlocks.createOpenCodeBlockModel()
          const log0 = changeLog.recordChange(changeLog.newTranscriptChanges(), {
            kind: 'reset',
            complete: true
          })
          const state = { messages: msgs, transcriptChanges: log0 }
          m.advance(state)
          return { m, state }
        },
        run: openCodeBlocks.createOpenCodeBlockModel
          ? (ctx) => ctx && ctx.m.advance(ctx.state)
          : undefined
      }
    }),
    ...threeBranch('J3', '앞삽입 1턴 (T 유지)', {
      coldBuild: {
        run: blockList.createBlockList
          ? () => blockList.createBlockList(msgs.map((m) => ({ key: m.id })))
          : undefined
      },
      incremental: {
        prepare: () =>
          blockList.createBlockList
            ? blockList.createBlockList(msgs.map((m) => ({ key: m.id })))
            : null,
        run: blockList.createBlockList
          ? (list) => list && list.splice(0, 0, [{ key: 'u:pre' }, { key: 'a:pre' }])
          : undefined
      },
      cacheHit: {
        prepare: () =>
          blockList.createBlockList
            ? blockList.createBlockList(msgs.map((m) => ({ key: m.id })))
            : null,
        run: blockList.createBlockList ? (list) => list && list.snapshot() : undefined
      }
    }),
    ...threeBranch('J4', 'messageOrderFor 순번·소유 조회', {
      coldBuild: {
        run:
          messageOrder.messageOrderFor && changeLog.newTranscriptChanges
            ? () => {
                const log = changeLog.recordChange(changeLog.newTranscriptChanges(), {
                  kind: 'reset',
                  complete: true
                })
                messageOrder.messageOrderFor({ messages: msgs, transcriptChanges: log }, true)
              }
            : undefined
      },
      incremental: {
        prepare: () => {
          if (!messageOrder.messageOrderFor || !changeLog.newTranscriptChanges) return null
          const log0 = changeLog.recordChange(changeLog.newTranscriptChanges(), {
            kind: 'reset',
            complete: true
          })
          messageOrder.messageOrderFor({ messages: msgs, transcriptChanges: log0 }, true)
          const next = {
            id: 'u:j4',
            role: 'user',
            createdAt: 99999,
            parts: [{ type: 'text', text: 'x' }]
          }
          const log1 = changeLog.recordChange(log0, { kind: 'append', ids: ['u:j4'] })
          return { messages: [...msgs, next], transcriptChanges: log1 }
        },
        run: messageOrder.messageOrderFor
          ? (state) => state && messageOrder.messageOrderFor(state, true)
          : undefined
      },
      cacheHit: {
        prepare: () => {
          if (!messageOrder.messageOrderFor || !changeLog.newTranscriptChanges) return null
          const log0 = changeLog.recordChange(changeLog.newTranscriptChanges(), {
            kind: 'reset',
            complete: true
          })
          const state = { messages: msgs, transcriptChanges: log0 }
          messageOrder.messageOrderFor(state, true)
          return state
        },
        run: messageOrder.messageOrderFor
          ? (state) => state && messageOrder.messageOrderFor(state, true)
          : undefined
      }
    }),
    ...threeBranch('J5', '패널 색인 transcriptIndexFor', {
      coldBuild: {
        run:
          transcriptIndex.transcriptIndexFor && changeLog.newTranscriptChanges
            ? () => {
                const log = changeLog.recordChange(changeLog.newTranscriptChanges(), {
                  kind: 'reset',
                  complete: true
                })
                transcriptIndex
                  .transcriptIndexFor({ messages: msgs, transcriptChanges: log })
                  .taskBoard()
              }
            : undefined
      },
      incremental: {
        prepare: () => {
          if (!transcriptIndex.transcriptIndexFor || !changeLog.newTranscriptChanges) return null
          const log0 = changeLog.recordChange(changeLog.newTranscriptChanges(), {
            kind: 'reset',
            complete: true
          })
          transcriptIndex
            .transcriptIndexFor({ messages: msgs, transcriptChanges: log0 })
            .taskBoard()
          const next = {
            id: 'a:j5',
            role: 'assistant',
            createdAt: 99999,
            parts: [{ type: 'text', text: 'ok' }]
          }
          const log1 = changeLog.recordChange(log0, { kind: 'append', ids: ['a:j5'] })
          return { messages: [...msgs, next], transcriptChanges: log1 }
        },
        run: transcriptIndex.transcriptIndexFor
          ? (state) => state && transcriptIndex.transcriptIndexFor(state).taskBoard()
          : undefined
      },
      cacheHit: {
        prepare: () => {
          if (!transcriptIndex.transcriptIndexFor || !changeLog.newTranscriptChanges) return null
          const log0 = changeLog.recordChange(changeLog.newTranscriptChanges(), {
            kind: 'reset',
            complete: true
          })
          const state = { messages: msgs, transcriptChanges: log0 }
          transcriptIndex.transcriptIndexFor(state).taskBoard()
          return state
        },
        run: transcriptIndex.transcriptIndexFor
          ? (state) => state && transcriptIndex.transcriptIndexFor(state).taskBoard()
          : undefined
      }
    }),
    ...threeBranch('J6', '분절 캐시 segmentsFor', {
      coldBuild: {
        run: segmentCache.createSegmentCache
          ? () => segmentCache.createSegmentCache().segmentsFor(msgs[1])
          : undefined
      },
      incremental: {
        prepare: () => {
          if (!segmentCache.createSegmentCache) return null
          const c = segmentCache.createSegmentCache()
          c.segmentsFor(msgs[1])
          const next = { ...msgs[1], parts: [...msgs[1].parts, { type: 'text', text: 'tail' }] }
          return { c, next, from: msgs[1].parts.length }
        },
        run: segmentCache.createSegmentCache
          ? (ctx) => ctx && ctx.c.segmentsFor(ctx.next, ctx.from)
          : undefined
      },
      cacheHit: {
        prepare: () => {
          if (!segmentCache.createSegmentCache) return null
          const c = segmentCache.createSegmentCache()
          c.segmentsFor(msgs[1])
          return { c, m: msgs[1] }
        },
        run: segmentCache.createSegmentCache ? (ctx) => ctx && ctx.c.segmentsFor(ctx.m) : undefined
      }
    }),
    ...threeBranch('J7', '열린 펜스 증분 스캔 vs 코드 본문 문자열 생성', {
      coldBuild: {
        run: markdownBlocks.splitStableBlocks
          ? () => markdownBlocks.splitStableBlocks(fence.full)
          : undefined
      },
      incremental: {
        run: markdownBlocks.advanceStableBlocks
          ? () => {
              let st = null
              let acc = ''
              for (const d of fence.deltas) {
                acc += d
                st = markdownBlocks.advanceStableBlocks(st, acc)
              }
            }
          : undefined
      },
      cacheHit: {
        prepare: () => {
          if (!markdownBlocks.advanceStableBlocks) return null
          const st = markdownBlocks.advanceStableBlocks(null, fence.full)
          return { st, full: fence.full }
        },
        run: markdownBlocks.advanceStableBlocks
          ? (ctx) => ctx && markdownBlocks.advanceStableBlocks(ctx.st, ctx.full)
          : undefined
      }
    }),
    ...[1, 100].flatMap((turns) =>
      threeBranch(turns === 1 ? 'J8' : 'J8(100)', `앞삽입 1턴 · 기존 ${turns}턴`, {
        coldBuild: prependCase(turns, 'coldBuild'),
        incremental: prependCase(turns, 'incremental'),
        cacheHit: prependCase(turns, 'cacheHit')
      })
    )
  ]
}

async function measureTree(tree) {
  const modules = await loadTree(tree)
  const rows = [...measurementCases(modules), ...transcriptMeasurementCases(modules)].map(
    (item) => ({
      ...item,
      result: measureCase(item.run, { prepare: item.prepare })
    })
  )
  const j9 = measureJ9CopyCap()
  const j10 = await measureJ10Virtualizer()
  const lines = [
    `| 입력 | 내용 | 중앙값 / 최대 (예열 ${WARMUP_RUNS} 뒤 ${MEASURED_RUNS}회) |`,
    '|---|---|---|',
    ...rows.map((row) => `| ${row.id} | ${row.input} | ${formatCell(row.result)} |`),
    `| J9 | 복사 상한 탐색 (100~2,000, ≤ ${J9_BUDGET_MS}ms) | 상한 = ${j9.cap} |`,
    ...j9.samples.map(
      ({ size, result }) => `| J9:sample(${size}) | DOM 마운트·직렬화 | ${formatCell(result)} |`
    ),
    ...j9.assembleTasks.map(
      (t) => `| J9:assemble(${t.count}) | 조립 task (${t.count}블록) | ${formatCell(t.result)} |`
    ),
    ...j10.map(
      (r) =>
        `| ${r.id} | Virtualizer (${r.count}블록, getItemKey=${r.getItemKeyCalls}) | ${formatCell(r.result)} |`
    )
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
