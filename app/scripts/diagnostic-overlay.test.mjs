import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(
  new URL('./diagnostic-overlay/visibility-marks.js', import.meta.url),
  'utf8'
)
const context = {}
runInNewContext(source, context)
const { pick, createWatcher } = context.__ooVisibility
const bounds = { top: 10, bottom: 60 }
const row = {
  owner: 'sB',
  messageId: 'native-5',
  text: 'fixture message 5',
  top: 20,
  bottom: 40,
  height: 20
}
const target = {
  kind: 'first-body',
  sessionId: 'sB',
  messageId: 'native-5',
  expectText: 'fixture message 5',
  input: 'click',
  opId: 'op1'
}
const visible = 'oo-visible:first-body:sB:native-5:'
function fixture() {
  let frames = [],
    rows = []
  const marks = [],
    listeners = {}
  const arm = createWatcher({
    raf: (fn) => frames.push(fn),
    mark: (name) => marks.push(name),
    listen: (type, fn) => (listeners[type] = fn),
    queryRows: () => rows,
    viewport: () => bounds
  })
  return {
    marks,
    arm: (patch = {}) => arm({ ...target, ...patch }),
    input: (type, key) => listeners[type]?.({ type, key }),
    frame: (...next) => {
      rows = next
      const queue = frames
      frames = []
      queue.forEach((fn) => fn())
    }
  }
}

test('first body belongs to the selected session', () => {
  for (const input of ['click', 'enter']) {
    const f = fixture()
    f.arm({ input })
    f.input(input === 'click' ? 'click' : 'keydown', 'Enter')
    for (const patch of [{ owner: 'sA' }, { text: '' }, { text: '본문 열기' }]) {
      f.frame({ ...row, ...patch })
      assert.deepEqual(f.marks, ['oo-select:op1'])
    }
    f.frame(row)
    f.frame(row)
    assert.deepEqual(f.marks, ['oo-select:op1', visible + 'op1'])
  }
})
test('search target needs owner and highlight; other highlights are reported', () => {
  const f = fixture()
  f.arm({ kind: 'search-target' })
  f.input('click')
  f.frame(row)
  assert.deepEqual(f.marks, ['oo-select:op1'])
  for (const patch of [{ owner: 'sA' }, { messageId: 'native-6' }])
    f.frame({ ...row, highlighted: true, ...patch })
  assert.deepEqual(f.marks, ['oo-select:op1', 'oo-highlight-other:op1'])
  f.frame({ ...row, highlighted: true })
  assert.equal(f.marks.at(-1), 'oo-visible:search-target:sB:native-5:op1')
})
test('select mark is the armed input event', () => {
  for (const input of ['click', 'enter']) {
    const f = fixture()
    f.arm({ input })
    f.input('pointerdown')
    f.input('keydown', 'Escape')
    f.input(input === 'click' ? 'keydown' : 'click', 'Enter')
    assert.deepEqual(f.marks, [])
    f.input(input === 'click' ? 'click' : 'keydown', 'Enter')
    assert.deepEqual(f.marks, ['oo-select:op1'])
  }
})
test('visible mark once per selection', () => {
  const f = fixture()
  f.arm()
  f.input('click')
  f.frame(row)
  f.input('click')
  f.frame(row)
  assert.deepEqual(f.marks, ['oo-select:op1', visible + 'op1'])
})
test('repeats and concurrent selections keep their own opId', () => {
  const f = fixture()
  for (let i = 1; i <= 3; i++) {
    const opId = 'op-r' + i
    f.arm({ opId })
    f.input('click')
    f.frame(row)
    assert.ok(f.marks.includes(visible + opId))
  }
  f.arm()
  f.arm({ opId: 'op2', sessionId: 'sC' })
  f.input('click')
  f.input('click')
  f.frame(row)
  assert.deepEqual(f.marks.slice(-3), ['oo-select:op1', 'oo-select:op2', visible + 'op1'])
  f.frame({ ...row, owner: 'sC' })
  assert.equal(f.marks.at(-1), 'oo-visible:first-body:sC:native-5:op2')
})
test('unobservable reasons', () => {
  for (const [rows, last] of [
    [[], 'oo-unobservable:op1:no-message-id'],
    [[{ ...row, owner: undefined }], 'oo-unobservable:op1:no-session-owner'],
    [[{ ...row, owner: 'sA' }], 'oo-timeout:op1']
  ]) {
    const f = fixture()
    f.arm()
    f.input('click')
    for (let i = 0; i < 599; i++) f.frame(...rows)
    assert.deepEqual(f.marks, ['oo-select:op1'])
    f.frame(...rows)
    assert.equal(f.marks.at(-1), last)
  }
})
test('pick skips empty and other-session rows', () => {
  assert.equal(pick([row], bounds, target), row)
  for (const patch of [
    { height: 0 },
    { bottom: 10 },
    { top: 60 },
    { text: ' ' },
    { owner: 'sA' },
    { messageId: 'other' }
  ])
    assert.equal(pick([{ ...row, ...patch }], bounds, target), undefined)
})

test('console arm reads the rendered scroll root and records capture-phase input', () => {
  const marks = [],
    frames = [],
    listeners = {}
  let owner = 'sA'
  const element = {
    dataset: { messageId: row.messageId },
    innerText: row.text,
    getBoundingClientRect: () => row,
    closest: (selector) =>
      selector === '[data-transcript-session]'
        ? { dataset: { transcriptSession: owner } }
        : { getBoundingClientRect: () => bounds },
    hasAttribute: (key) => key === 'data-history-highlight'
  }
  const dom = {
    document: {
      addEventListener: (type, fn, capture) => {
        assert.equal(capture, true)
        listeners[type] = fn
      },
      querySelectorAll: (selector) => {
        assert.equal(selector, '[data-message-id]')
        return [element]
      }
    },
    requestAnimationFrame: (fn) => frames.push(fn),
    performance: { mark: (name) => marks.push(name) },
    innerHeight: 90
  }
  runInNewContext(source, dom)
  dom.__ooVisibility.arm({ ...target, kind: 'search-target' })
  listeners.click({ type: 'click' })
  frames.shift()()
  owner = 'sB'
  frames.shift()()
  assert.deepEqual(marks, [
    'oo-select:op1',
    'oo-highlight-other:op1',
    'oo-visible:search-target:sB:native-5:op1'
  ])
})

test('an older search trace without a session owner stays unobservable', () => {
  const f = fixture()
  f.arm({ kind: 'search-target' })
  f.input('click')
  for (let i = 0; i < 600; i++) f.frame({ ...row, owner: undefined, highlighted: true })
  assert.deepEqual(f.marks, ['oo-select:op1', 'oo-unobservable:op1:no-session-owner'])
})
