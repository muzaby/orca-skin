// A separate B5 diagnostic retains the locked corpus length and splits one unique word
// across two real stored text parts in the middle paragraph.
import assert from 'node:assert/strict'
import { findVisibleTarget } from './find-target.mjs'

const left = 'TextMiddle2026'
const right = 'SelectionMarker'
const needle = left + right

export function middleCorpus(original) {
  const paragraphStart = original.indexOf('\n\n', Math.floor(original.length / 2)) + 2
  const offset = paragraphStart + 80
  assert.ok(paragraphStart > original.length / 2)
  assert.ok(!original.includes(needle))
  const source = original.slice(0, offset) + needle + original.slice(offset + needle.length)
  const split = offset + left.length
  const paragraphIndex = original.slice(0, paragraphStart).split('\n\n').length - 1
  return {
    source,
    paragraphIndex,
    parts: [
      { type: 'text', text: source.slice(0, split) },
      { type: 'text', text: source.slice(split) }
    ]
  }
}

// This function executes in the context-isolated renderer. It measures the native text
// range and the actual part wrappers that contain each endpoint.
async function locateMiddle(index, token, select) {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const paragraphs = [...document.querySelectorAll('[data-markdown-document] p')]
  const paragraph = paragraphs[index]
  if (!paragraph || !paragraph.textContent.includes(token)) return { paragraphs: paragraphs.length }
  const at = paragraph.textContent.indexOf(token)
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  let offset = 0,
    begin,
    end
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const next = offset + node.length
    if (!begin && next > at) begin = { node, offset: at - offset }
    if (next >= at + token.length) {
      end = { node, offset: at + token.length - offset }
      break
    }
    offset = next
  }
  if (!begin || !end) return { paragraphs: paragraphs.length }
  const range = document.createRange()
  range.setStart(begin.node, begin.offset)
  range.setEnd(end.node, end.offset)
  if (select) {
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  }
  const owner = (node) => node.parentElement.closest('[data-part-key]')?.dataset.partKey
  return {
    paragraphs: paragraphs.length,
    first: owner(begin.node),
    last: owner(end.node),
    range: range.toString(),
    rect: range.getBoundingClientRect().toJSON(),
    selected: select ? window.getSelection().toString() : undefined
  }
}

// Verify the DOM oracle after the official timing interval. Each edit is restored before
// applying the next one; the fixture source and the completion marker stay independent.
async function checkDomOmissions(index) {
  const paragraphs = document.querySelectorAll('[data-markdown-document] p')
  const middle = paragraphs[index]
  const placeholder = document.createElement('p')
  const strong = paragraphs[paragraphs.length - 1].querySelector('strong')
  const plain = document.createTextNode(strong.textContent)
  let missingParagraph, missingFormatting
  middle.replaceWith(placeholder)
  try {
    missingParagraph = await window.verifyBody()
  } finally {
    placeholder.replaceWith(middle)
  }
  strong.replaceWith(plain)
  try {
    missingFormatting = await window.verifyBody()
  } finally {
    plain.replaceWith(strong)
  }
  return { missingParagraph, missingFormatting }
}

export async function measureMiddleSelection(
  wc,
  clipboard,
  js,
  find,
  definition,
  observed,
  deadline
) {
  const semantic = await js('window.verifyBody()')
  Object.assign(observed, semantic, {
    variant: 'middle-source-parts',
    paragraphIndex: definition.paragraphIndex
  })
  assert.equal(semantic.sourceMatches, true, 'source content')
  assert.equal(semantic.formattedBodyMatches, true, 'all formatted paragraphs')
  assert.equal(semantic.bodyCounts.checked, 2443)
  const context = await js('window.revealBody()')
  observed.searchTarget = context
  assert.equal(context, true, 'search row not revealed')
  const locate = (select) =>
    js(
      '(' +
        locateMiddle.toString() +
        ')(' +
        [definition.paragraphIndex, JSON.stringify(needle), select].join(',') +
        ')'
    )
  const actual = await locate(false)
  observed.middleRange = actual
  assert.equal(actual.paragraphs, 2443)
  assert.equal(actual.range, needle)
  const result = await findVisibleTarget(
    wc,
    find,
    needle,
    async () => (await locate(false)).rect,
    deadline - performance.now()
  )
  Object.assign(observed, result)
  assert.equal(result.nativeFind, true, JSON.stringify(result))
  wc.stopFindInPage('clearSelection')
  const selection = await locate(true)
  Object.assign(observed, {
    selected: selection.selected,
    first: selection.first,
    last: selection.last
  })
  assert.deepEqual([selection.first, selection.last], ['message:text:0', 'message:text:1'])
  assert.equal(selection.selected, needle)
  clipboard.writeText('0331-middle-copy-sentinel')
  wc.copy()
  let copied
  for (let i = 0; i < 40; i++) {
    copied = clipboard.readText()
    if (copied === needle) break
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  observed.copied = copied
  assert.equal(copied, needle)
  const omissions = await js(
    '(' + checkDomOmissions.toString() + ')(' + definition.paragraphIndex + ')'
  )
  for (const result of Object.values(omissions)) {
    assert.equal(result.sourceMatches, true)
    assert.equal(result.bodyCounts.paragraphs, 2443)
    assert.equal(result.formattedBodyMatches, false)
  }
  return { ...observed, detectedDomOmissions: Object.keys(omissions), ok: true }
}
