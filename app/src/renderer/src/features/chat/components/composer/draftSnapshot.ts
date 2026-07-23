export interface DraftSnapshot {
  revision: number
  text: string
  selectionStart: number
  selectionEnd: number
  composing: boolean
}

export function createDraftSnapshot(text = ''): DraftSnapshot {
  return {
    revision: 0,
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
    composing: false
  }
}

function clampSelection(value: number, text: string): number {
  return Math.max(0, Math.min(value, text.length))
}

export function updateDraftText(
  snapshot: DraftSnapshot,
  text: string,
  selectionStart: number,
  selectionEnd: number
): DraftSnapshot {
  const start = clampSelection(selectionStart, text)
  const end = clampSelection(selectionEnd, text)
  if (
    text === snapshot.text &&
    start === snapshot.selectionStart &&
    end === snapshot.selectionEnd
  ) {
    return snapshot
  }
  return {
    ...snapshot,
    revision: text === snapshot.text ? snapshot.revision : snapshot.revision + 1,
    text,
    selectionStart: start,
    selectionEnd: end
  }
}

export function updateDraftSelection(
  snapshot: DraftSnapshot,
  selectionStart: number,
  selectionEnd: number
): DraftSnapshot {
  return updateDraftText(snapshot, snapshot.text, selectionStart, selectionEnd)
}

export function setDraftComposition(
  snapshot: DraftSnapshot,
  composing: boolean,
  text = snapshot.text,
  selectionStart = snapshot.selectionStart,
  selectionEnd = snapshot.selectionEnd
): DraftSnapshot {
  const next = updateDraftText(snapshot, text, selectionStart, selectionEnd)
  return next.composing === composing ? next : { ...next, composing }
}

export function replaceDraftRange(
  snapshot: DraftSnapshot,
  expectedRevision: number,
  start: number,
  end: number,
  replacement: string
): DraftSnapshot {
  if (snapshot.revision !== expectedRevision) return snapshot
  if (start < 0 || end < start || end > snapshot.text.length) return snapshot
  const text = snapshot.text.slice(0, start) + replacement + snapshot.text.slice(end)
  const caret = start + replacement.length
  return updateDraftText(snapshot, text, caret, caret)
}

export function replaceDraft(
  snapshot: DraftSnapshot,
  text: string,
  composing = false
): DraftSnapshot {
  const next = updateDraftText(snapshot, text, text.length, text.length)
  return next.composing === composing ? next : { ...next, composing }
}

export function clearDraftAfterAcceptedSubmit(
  snapshot: DraftSnapshot,
  expectedRevision: number
): DraftSnapshot {
  return snapshot.revision === expectedRevision ? replaceDraft(snapshot, '') : snapshot
}
