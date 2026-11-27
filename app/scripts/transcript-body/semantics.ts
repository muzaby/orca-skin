const marker = '완료'
const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
const container = (): HTMLElement =>
  document.querySelector<HTMLElement>('[data-markdown-document], [data-markdown-tail="parsed"]')!

function selectedRange(start: Text, startOffset: number, end: Text, endOffset: number): void {
  const range = document.createRange()
  range.setStart(start, startOffset)
  range.setEnd(end, endOffset)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
}

function texts(element: Element): Text[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)
  return nodes
}

export function selectBodyText(input: string): string {
  const root = container()
  if (input === 'B1') {
    const group = root.querySelector('[data-markdown-prose-group]')!
    const first = texts(group)[0]
    const next = texts(group.nextElementSibling!)[0]
    const start = Math.max(0, first.length - 12)
    selectedRange(first, start, next, 12)
    // This paragraph consists of an independently known repeating eight-unit sequence.
    const pattern = '가나다 라마바 '
    const end = group.textContent!.length + 12
    return pattern.repeat(Math.ceil(end / pattern.length)).slice(start, end)
  }
  if (input === 'B4') {
    const code = root.querySelector('code')!
    const link = root.querySelector('a')!
    selectedRange(texts(code)[0], 0, texts(link)[0], 4)
    return 'code link'
  }
  if (input === 'B2') {
    const first = texts(root.querySelector('li')!)[0]
    selectedRange(first, 0, first, 4)
    return 'Item'
  }
  const node = texts(root.querySelector('strong')!)[0]
  selectedRange(node, 0, node, marker.length)
  return marker
}

export async function verifyBody(
  input: string,
  chars: number,
  expected: (offset: number) => Promise<string>,
  stored?: string
): Promise<{
  formattedBodyMatches: boolean
  sourceMatches: boolean
  bodyCounts: Record<string, number>
}> {
  let sourceMatches = stored?.length === chars
  for (let start = 0; sourceMatches && start < chars; start += 65536) {
    sourceMatches = stored!.slice(start, start + 65536) === (await expected(start))
  }
  const root = container()
  const bold = root.querySelector('strong')
  const paragraphs = [...root.querySelectorAll('p')]
  const counts: Record<string, number> = { paragraphs: paragraphs.length }
  let matches =
    bold?.textContent === marker &&
    !!bold.closest('p') &&
    root.querySelector('[data-md-block-pending], [data-md-block-error]') === null
  if (input === 'B1' || input === 'B3') {
    const actual = paragraphs[0]?.textContent
    matches &&= paragraphs.length === 1 && actual === stored!.slice(0, -6) + marker
  } else if (input === 'B5') {
    let index = 0
    for (const paragraph of paragraphs) {
      const boundary = stored!.indexOf('\n\n', index)
      const end = boundary < 0 ? stored!.length : boundary
      const wanted = stored!.slice(index, end).trimEnd()
      matches &&= paragraph.textContent === (wanted === '**완료**' ? marker : wanted)
      index = boundary < 0 ? end : end + 2
      if ((counts.checked = (counts.checked ?? 0) + 1) % 128 === 0) await nextTask()
    }
    matches &&=
      paragraphs.length === 2443 && index === chars && paragraphs.at(-1)?.contains(bold) === true
  } else if (input === 'B4') {
    const elements = root.querySelectorAll<HTMLElement>('code, a, strong')
    counts.inline = elements.length
    matches &&= paragraphs.length === 1 && elements.length === 25001
    for (let i = 0; matches && i < 25000; i += 2) {
      const code = elements[i],
        link = elements[i + 1]
      matches &&=
        code.tagName === 'CODE' &&
        code.textContent === 'code' &&
        link.tagName === 'A' &&
        link.textContent === 'link' &&
        link.getAttribute('href') === 'https://example.org'
      if (i % 1024 === 0) await nextTask()
    }
    matches &&=
      elements[25000] === bold && paragraphs[0].textContent === 'code link '.repeat(12500) + marker
    for (const i of [1, 12501, 24999]) {
      elements[i]?.focus()
      matches &&= document.activeElement === elements[i]
    }
  } else if (input === 'B2') {
    const paragraphsOfP = paragraphs.filter((el) => el.textContent === 'p'.repeat(200))
    const blocks = [...root.querySelectorAll('pre code')]
    const tables = [...root.querySelectorAll('table')]
    const list = root.querySelector('ul')
    const items = list?.children
    Object.assign(counts, {
      regular: paragraphsOfP.length,
      fences: blocks.length,
      tables: tables.length,
      list: items?.length ?? 0
    })
    matches &&=
      paragraphsOfP.length === 3000 &&
      blocks.length === 40 &&
      blocks.every((el) => el.textContent?.trimEnd() === 'let n = 1') &&
      tables.length === 2 &&
      !!items &&
      items.length === 30000
    for (let i = 0; matches && items && i < items.length; i++) {
      matches &&= items[i].tagName === 'LI' && items[i].textContent === 'Item'
      if (i % 1024 === 0) await nextTask()
    }
    const narrow = tables[0],
      wide = tables[1]
    matches &&=
      narrow?.tHead?.rows[0].cells.length === 2 &&
      narrow.tHead.rows[0].cells[0].textContent === 'a' &&
      narrow.tHead.rows[0].cells[1].textContent === 'b' &&
      narrow?.tBodies[0]?.rows.length === 2001 &&
      wide?.tHead?.rows[0].cells.length === 600 &&
      wide.tBodies[0].rows[0].cells.length === 600
    counts.structure = Number(matches)
    if (matches) {
      for (const row of narrow.tBodies[0].rows)
        matches &&=
          row.cells.length === 2 &&
          row.cells[0].textContent === 'c' &&
          row.cells[1].textContent === 'd'
      for (const cell of wide.tHead!.rows[0].cells)
        matches &&= cell.textContent === 'a' && cell.style.textAlign === ''
      for (const cell of wide.tBodies[0].rows[0].cells) matches &&= cell.textContent === 'b'
      counts.cells = Number(matches)
      const ref = root.querySelector<HTMLAnchorElement>('a[data-footnote-ref]')
      const back = root.querySelector<HTMLAnchorElement>('a[data-footnote-backref]')
      matches &&=
        !!ref &&
        !!back &&
        !!root.querySelector('section[data-footnotes]') &&
        document.getElementById(ref.hash.slice(1))?.contains(back) === true &&
        back.hash.slice(1) === ref.id
      counts.footnote = Number(matches)
      const ordered: Element[] = [
        paragraphsOfP.at(-1)!,
        blocks[0],
        blocks.at(-1)!,
        narrow,
        wide,
        list!,
        ref!,
        bold!
      ]
      matches &&= ordered.every(
        (el, i) =>
          i === 0 ||
          !!(ordered[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
      )
    }
  }
  return { formattedBodyMatches: matches, sourceMatches, bodyCounts: counts }
}
