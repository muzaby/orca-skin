const sourceRoot = 'src/renderer/src/'
export const visibleModules = Object.fromEntries(
  Object.entries({
    view: 'shared/compute/diffView.ts',
    pack: 'shared/compute/diffSource.ts',
    code: 'shared/compute/codeView.ts',
    gutter: 'shared/compute/gutter.ts',
    worker: 'shared/compute/worker/state.ts',
    handler: 'shared/compute/worker/handler.ts',
    markdown: 'shared/compute/worker/markdown.ts',
    blocks: 'shared/markdown/markdownDocumentBlocks.ts',
    tree: 'features/chat/lib/changedFileTree.ts',
    patch: 'features/chat/lib/unifiedDiffLines.ts',
    work: 'features/chat/lib/workToolPresentation.ts'
  }).map(([name, path]) => [name, sourceRoot + path])
)

function repeat(seed, n) {
  return seed.repeat(Math.ceil(n / seed.length)).slice(0, n)
}
function table(rows, columns = 3, cell = 'x') {
  const line = (value) => '|' + Array(columns).fill(value).join('|') + '|\n'
  return line('heading') + line('---') + line(cell).repeat(rows)
}
export function visibleInputs() {
  return {
    'artifact-1mb.md': repeat(
      '# Heading\n\nText **bold** and [link](https://example.org).\n\n- item\n\n' +
        table(2) +
        '\n~~~ts\nconst n = 1\n~~~\n\n',
      1000000
    ),
    'generated-5mib.ts': repeat(
      'export const result = { value: 12345, name: "sample" }\n',
      5 * 1024 * 1024
    ),
    'work-5mb.json': JSON.stringify({ output: repeat('work message\n', 5000000) }),
    'table-1600.md': table(1600),
    'table-2001.md': table(2001),
    'footnote-60k.md': '[^a]: ' + repeat('note ', 59994),
    'single-line-1mb.json': JSON.stringify(repeat('x', 999998))
  }
}

async function tokens(createWorkerState, text, start, end, lang) {
  const run = createWorkerState(),
    doc = { id: 'tokens', revision: 1 }
  await run({ type: 'doc.open', ref: doc, text })
  let id = 0,
    resumeFrom,
    max = 0
  while (true) {
    const t = performance.now()
    const result = await run({
      kind: 'tokens',
      id: ++id,
      doc,
      start,
      end,
      lang,
      theme: 'github-light',
      resumeFrom
    })
    max = Math.max(max, performance.now() - t)
    if (result.ok === true) return { jobs: id, maxJobMs: max }
    if (result.ok !== 'continue') throw Error(result.error)
    resumeFrom = id
  }
}
export async function measureVisible(modules, patchLines, patchText) {
  const f = visibleInputs(),
    code = f['generated-5mib.ts'],
    md = f['artifact-1mb.md'],
    long = 'x'.repeat(1000000)
  const options = {
    layout: 'inline',
    expansions: [],
    ignoreWhitespace: false,
    highlightWords: true
  }
  const file = patchLines.map((l) => ({ ...l, lineNo: l.newLine }))
  const anchors = file.slice(-200).map(({ oldLine, newLine }) => ({ oldLine, newLine }))
  const doc = { id: 'md', revision: 1 }
  const cases = []
  const add = (id, name, run) => cases.push({ id, name, run })
  for (const size of [5000, 5001, 50000])
    add(
      'K1',
      size + ' diff rows',
      modules.view.buildDiffView &&
        (() => {
          const model = modules.view.buildDiffView(file.slice(0, size), false)
          modules.view.diffViewRows(model, options, 0, 70)
          modules.view.diffViewLocate(model, options, anchors)
        })
    )
  const ts = file.map((l) => l.text).join('\n')
  for (const start of [0, 49800])
    add(
      'K2',
      'tokens ' + start,
      modules.worker.createWorkerState &&
        (() => tokens(modules.worker.createWorkerState, ts, start, start + 200, 'typescript'))
    )
  const parse = (text, limit, render = false) => {
    const input = { text },
      stats = { chunks: 0, raw: 0, nodes: 0, wireBytes: 0, maxChunkMs: 0, renderMs: 0 }
    for (const block of modules.blocks.markdownDocumentBlocks(text).slice(0, limit)) {
      if (block.raw) {
        stats.raw++
        continue
      }
      for (const table of block.table ?? [undefined]) {
        const start = performance.now()
        const result = modules.markdown.markdownBlock(input, {
          kind: 'markdown',
          doc,
          start: block.start,
          end: block.end,
          table
        })
        stats.maxChunkMs = Math.max(stats.maxChunkMs, performance.now() - start)
        if (!result.hast) {
          stats.raw++
          continue
        }
        stats.chunks++
        if (render) {
          const tree = structuredClone(result.hast),
            stack = [tree]
          while (stack.length) {
            const node = stack.pop()
            stats.nodes++
            if (node.children) stack.push(...node.children)
          }
          stats.wireBytes += Buffer.byteLength(JSON.stringify(tree))
          const t = performance.now()
          modules.renderHast(tree, text.slice(block.start, block.end))
          stats.renderMs += performance.now() - t
        }
      }
    }
    return stats
  }
  add(
    'K3',
    '1MB markdown, first 30 blocks',
    modules.blocks.markdownDocumentBlocks && (() => parse(md, 30))
  )
  for (const chars of [4000, 20000, 50000])
    add(
      'K4',
      'loose list ' + chars,
      modules.markdown.parseMarkdown &&
        (() => {
          const source = repeat('- a\n\n', chars),
            result = modules.markdown.parseMarkdown(source)
          if (result.hast) modules.renderHast(result.hast, source)
        })
    )
  add(
    'K5',
    '5MiB code index and first 200 rows',
    modules.code.buildCodeIndex &&
      (() => modules.code.codeWindow(modules.code.buildCodeIndex(code), 0, 200))
  )
  const paths = file
    .slice(0, 200)
    .map((_, i) => ({ path: 'src/' + (i % 10) + '/file' + i, added: i, removed: 0 }))
  add(
    'K6',
    '200 file paths',
    modules.tree.buildChangedFileTree &&
      (() => modules.tree.visibleTreeRows(modules.tree.buildChangedFileTree(paths), new Set()))
  )
  add(
    'K7',
    '990044-char patch',
    modules.patch.unifiedDiffLines && (() => modules.patch.unifiedDiffLines(patchText))
  )
  for (const [lang, text] of [
    ['typescript', ts.slice(0, 32000)],
    ['javascript', long.slice(0, 32000)]
  ])
    add(
      'K8',
      lang,
      modules.handler.compute &&
        (() =>
          modules.handler.compute({ kind: 'highlight', code: text, lang, theme: 'github-light' }))
    )
  for (const [lang, text] of [
    ['javascript', long.slice(0, 5000)],
    ['javascript', long.slice(0, 20000)],
    ['javascript', long],
    ['json', JSON.stringify(long)]
  ])
    add(
      'K9',
      lang + ' ' + text.length,
      modules.worker.createWorkerState &&
        (() => tokens(modules.worker.createWorkerState, text, 0, 1, lang))
    )
  for (const [i, text] of [
    table(1600),
    table(2001),
    '[^a]: ' + repeat('footnote ', 60000),
    table(200, 3, 'a'.repeat(1000)),
    table(200, 50),
    table(1, 501),
    repeat('- *a*\n', 30000)
  ].entries())
    add(
      'K10',
      'boundary ' + i,
      modules.blocks.markdownDocumentBlocks && (() => parse(text, Infinity, true))
    )
  for (const n of [1000000, 5000000]) {
    const text = code.slice(0, n)
    add(
      'K11',
      'Read ' + n,
      modules.gutter.stripLineNumberGutter && (() => modules.gutter.stripLineNumberGutter(text))
    )
    for (const value of [text, { text }])
      add(
        'K11',
        'Work ' + typeof value + ' ' + n,
        modules.work.workToolPayload && (() => modules.work.workToolPayload(value))
      )
  }
  add('K11', '50000 patch lines', modules.pack.packLines && (() => modules.pack.packLines(file)))
  add(
    'K13',
    '50000 pair diff rows',
    modules.worker.createWorkerState &&
      (async () => {
        const run = modules.worker.createWorkerState(),
          old = { id: 'before', revision: 1 },
          next = { id: 'after', revision: 1 }
        await run({ type: 'doc.open', ref: old, text: '' })
        await run({ type: 'doc.open', ref: next, text: ts })
        const result = await run({
          kind: 'diffView',
          id: 1,
          source: { kind: 'pair', old, new: next },
          options,
          start: 0,
          end: 70
        })
        if (!result.ok) throw Error(result.error)
      })
  )
  for (const size of [2000, 5000, 50000]) {
    const left = file.slice(0, size).map((l) => l.text)
    const before = left.join('\n')
    const after =
      size === 50000
        ? before.replace('line25000', 'changed25000')
        : left.map((l) => 'different ' + l).join('\n')
    add(
      'K13',
      'pair ' + size + ' + ' + size,
      modules.worker.createWorkerState &&
        (async () => {
          const run = modules.worker.createWorkerState(),
            old = { id: 'before', revision: 1 },
            next = { id: 'after', revision: 1 }
          await run({ type: 'doc.open', ref: old, text: before })
          await run({ type: 'doc.open', ref: next, text: after })
          const result = await run({
            kind: 'diffView',
            id: 1,
            source: { kind: 'pair', old, new: next },
            options,
            start: 0,
            end: 70
          })
          if (!result.ok) throw Error(result.error)
        })
    )
  }
  add(
    'K13',
    '50000 model only',
    modules.view.buildDiffView && (() => modules.view.buildDiffView(file, false))
  )
  add(
    'K13',
    '5MiB codeView',
    modules.code.buildCodeIndex &&
      (() => modules.code.codeWindow(modules.code.buildCodeIndex(code), 0, 200))
  )
  add(
    'K13',
    '32000-char highlight',
    modules.handler.compute &&
      (() =>
        modules.handler.compute({
          kind: 'highlight',
          code: ts.slice(0, 32000),
          lang: 'typescript',
          theme: 'github-light'
        }))
  )
  const rows = []
  for (const { id, name, run } of cases) {
    if (!run) {
      rows.push({ id, name, result: 'N/A(함수 없음)' })
      continue
    }
    const times = []
    let last,
      attempts = 0,
      error
    for (; times.length < 10 && attempts < 12;) {
      attempts++
      try {
        const t = performance.now()
        last = await run()
        times.push(performance.now() - t)
      } catch (e) {
        error = String(e)
      }
    }
    const samples = times.slice(1).sort((a, b) => a - b)
    rows.push({
      id,
      name,
      attempts,
      result: samples.length === 9 ? { median: samples[4], max: samples[8] } : 'N/A(' + error + ')',
      ...(last?.jobs ? { jobs: last.jobs, maxJobMs: last.maxJobMs } : {}),
      ...(last?.chunks !== undefined ? { blocks: last } : {})
    })
  }
  return rows
}
