// Paste into the diagnostic window before recording a selection in DevTools.
;(() => {
  function visible(row, bounds) {
    return row.height > 0 && row.bottom > bounds.top && row.top < bounds.bottom
  }

  function pick(rows, bounds, target) {
    return rows.find(
      (row) =>
        row.messageId === target.messageId &&
        row.owner === target.sessionId &&
        target.expectText &&
        row.text.includes(target.expectText) &&
        visible(row, bounds) &&
        (target.kind !== 'search-target' || row.highlighted)
    )
  }

  function createWatcher({ raf, mark, listen, queryRows, viewport }) {
    const armed = []
    const seen = new Set()
    function onInput(event) {
      const input = event.type === 'keydown' && event.key === 'Enter' ? 'enter' : event.type
      const index = armed.findIndex((target) => target.input === input)
      if (index < 0) return
      const [target] = armed.splice(index, 1)
      const { opId, kind, sessionId, messageId } = target
      mark('oo-select:' + opId)
      let frames = 0
      let sawRow = false
      let sawOwner = false
      let otherReported = false
      function frame() {
        const rows = queryRows()
        const bounds = viewport()
        sawRow ||= rows.length > 0
        sawOwner ||= rows.some((row) => row.owner)
        if (
          kind === 'search-target' &&
          !otherReported &&
          rows.some(
            (row) =>
              row.highlighted &&
              row.owner &&
              visible(row, bounds) &&
              (row.owner !== sessionId || row.messageId !== messageId)
          )
        ) {
          mark('oo-highlight-other:' + opId)
          otherReported = true
        }
        if (pick(rows, bounds, target)) {
          mark(['oo-visible', kind, sessionId, messageId, opId].join(':'))
        } else if (++frames < 600) {
          raf(frame)
        } else if (!sawRow || !sawOwner) {
          mark('oo-unobservable:' + opId + (sawRow ? ':no-session-owner' : ':no-message-id'))
        } else {
          mark('oo-timeout:' + opId)
        }
      }
      raf(frame)
    }
    listen('click', onInput)
    listen('keydown', onInput)
    return function arm(target) {
      if (
        !['first-body', 'search-target'].includes(target.kind) ||
        !['click', 'enter'].includes(target.input) ||
        ![target.opId, target.sessionId, target.messageId, target.expectText].every(
          (value) => typeof value === 'string' && value.length
        ) ||
        seen.has(target.opId)
      )
        throw Error('Invalid or repeated visibility selection')
      seen.add(target.opId)
      armed.push({ ...target })
    }
  }

  let domArm
  globalThis.__ooVisibility = {
    pick,
    createWatcher,
    arm(target) {
      domArm ??= createWatcher({
        raf: (fn) => requestAnimationFrame(fn),
        mark: (name) => performance.mark(name),
        listen: (type, fn) => document.addEventListener(type, fn, true),
        queryRows: () =>
          Array.from(document.querySelectorAll('[data-message-id]'), (element) => {
            const rect = element.getBoundingClientRect()
            const scroll = element
              .closest('[data-behavior="virtualizable"]')
              ?.getBoundingClientRect()
            const top = Math.max(rect.top, scroll?.top ?? 0)
            const bottom = Math.min(rect.bottom, scroll?.bottom ?? innerHeight)
            return {
              messageId: element.dataset.messageId,
              owner: element.closest('[data-transcript-session]')?.dataset.transcriptSession,
              text: element.innerText ?? '',
              top,
              bottom,
              height: Math.min(rect.height, bottom - top),
              highlighted: element.hasAttribute('data-history-highlight')
            }
          }),
        viewport: () => ({ top: 0, bottom: innerHeight })
      })
      domArm(target)
    }
  }
})()
