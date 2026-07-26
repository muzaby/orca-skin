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

export function updateDraftSelectionWhenIdle(
  snapshot: DraftSnapshot,
  selectionStart: number,
  selectionEnd: number
): DraftSnapshot {
  if (snapshot.composing) return snapshot
  return updateDraftSelection(snapshot, selectionStart, selectionEnd)
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

// IME 조합 중에는 텍스트를 바꾸는 어떤 변이도 거부한다(0149). 예전엔 컨트롤러가 변이 경로마다
// `if (compositionActive()) return` 가드를 손으로 붙였고(9곳), 새 삽입 경로가 하나 늘 때마다
// 가드를 잊으면 조합이 깨졌다 — 순수 모듈이 규칙을 소유하면 테스트가 그걸 잡는다.
// (컨트롤러에는 focus/setSelectionRange 같은 **DOM 부수효과** 가드만 남는다.)
export function replaceDraftRange(
  snapshot: DraftSnapshot,
  expectedRevision: number,
  start: number,
  end: number,
  replacement: string
): DraftSnapshot {
  if (snapshot.composing) return snapshot
  if (snapshot.revision !== expectedRevision) return snapshot
  if (start < 0 || end < start || end > snapshot.text.length) return snapshot
  const text = snapshot.text.slice(0, start) + replacement + snapshot.text.slice(end)
  const caret = start + replacement.length
  return updateDraftText(snapshot, text, caret, caret)
}

// 시드/복원/전송 후 비우기 — 전문 치환. 조합 중이면 거부한다(위 replaceDraftRange 와 같은 규칙).
// 조합 상태 자체를 내리는 것은 setDraftComposition 의 몫이다.
export function replaceDraft(snapshot: DraftSnapshot, text: string): DraftSnapshot {
  if (snapshot.composing) return snapshot
  return updateDraftText(snapshot, text, text.length, text.length)
}

export function clearDraftAfterAcceptedSubmit(
  snapshot: DraftSnapshot,
  expectedRevision: number
): DraftSnapshot {
  return snapshot.revision === expectedRevision ? replaceDraft(snapshot, '') : snapshot
}
