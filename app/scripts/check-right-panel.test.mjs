import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  pairedBounds,
  layerOffset,
  firstVisibleParagraph,
  readingDelta
} from './right-panel/observations.mts'
import { passesRightPanel, requiredMeasurements } from './check-right-panel.mjs'

const complete = [false, true].flatMap((reduced) =>
  requiredMeasurements.map((name) => ({ name, reduced, ok: true }))
)

test('requires every measurement in both motion modes', () => {
  assert.equal(new Set(requiredMeasurements).size, requiredMeasurements.length)
  assert.equal(passesRightPanel({ records: complete }), true)
  for (const reduced of [false, true]) {
    for (const name of requiredMeasurements) {
      const missing = complete.filter((row) => row.reduced !== reduced || row.name !== name)
      assert.equal(passesRightPanel({ records: missing }), false, name)
    }
  }
})

test('propagates budget, measurement and browser failures', () => {
  const failedBudget = complete.map((row) => ({ ...row, ok: row.name !== 'long-task-observation' }))
  assert.equal(passesRightPanel({ records: failedBudget }), false)
  assert.equal(
    passesRightPanel({ records: [...complete, { ok: false, error: 'Detached frame' }] }),
    false
  )
  assert.equal(passesRightPanel({ records: complete, error: 'Timed out' }), false)
  assert.equal(passesRightPanel({ records: [] }), false)
})

test('width and depth samplers preserve the same-frame bounds and detect independent panel movement', () => {
  const box = (left, width) => ({
    getBoundingClientRect: () => ({ left, x: left, width, right: left + width })
  })
  const host = box(15, 1200)
  const pane = box(15, 800)
  const panel = box(815, 400)
  assert.deepEqual(pairedBounds(pane, panel, host), { width: 400, seam: 0, hostError: 0 })
  assert.equal(pairedBounds(pane, box(818, 397), host).seam, 3)
  // Moving both outer edges together preserves the seam and must still fail the host check.
  assert.deepEqual(pairedBounds(box(30, 800), box(830, 400), host), {
    width: 400,
    seam: 0,
    hostError: 15
  })
  for (const x of [-32, 0, 260]) {
    assert.equal(layerOffset({ ...box(815 + x, 400), parentElement: panel }), x)
  }
  assert.equal(layerOffset(null), 0)
})

test('reading keeps the original first visible paragraph, block and exact text after reflow', () => {
  const scanned = []
  const top = 30
  const height = 180
  const p = (key, textContent, y) => ({
    textContent,
    closest: () => ({ getAttribute: () => key }),
    getBoundingClientRect: () => {
      scanned.push(key)
      return { top: y }
    }
  })
  let paragraphs = [
    p('above', 'earlier', top - 1),
    p('empty', '  ', top),
    p('first', 'word and punctuation.', top + 12),
    p('later', 'word and punctuation.', top + 24)
  ]
  const scroller = {
    clientHeight: height,
    getBoundingClientRect: () => ({ top }),
    querySelectorAll: () => paragraphs
  }
  const original = paragraphs.filter((item) => {
    const y = item.getBoundingClientRect().top - top
    return y >= 0 && y < height - 20 && !!item.textContent.trim()
  })[0]
  scanned.length = 0
  const anchor = firstVisibleParagraph(scroller)
  assert.deepEqual(anchor, { key: 'first', text: original.textContent, top: top + 12 })
  assert.deepEqual(scanned, ['above', 'empty', 'first'])
  // Replacement nodes can share either the text or the block key. Both must match.
  paragraphs = [
    p('later', original.textContent, top),
    p('first', 'different', top),
    p('first', original.textContent, top + 13)
  ]
  assert.equal(readingDelta(scroller, anchor), 1)
  paragraphs[2] = p('first', original.textContent, top + 18)
  assert.equal(readingDelta(scroller, anchor), 6)
  paragraphs.pop()
  assert.equal(readingDelta(scroller, anchor), null)
  paragraphs = [p('edge', 'outside the margin', top + height - 20)]
  assert.equal(firstVisibleParagraph(scroller), null)
})
