export interface ArchiveSpan {
  start: number
  end: number
}

/** Exact, contiguous UTF-16 slices. Never split a surrogate pair or synthesize body text. */
export function archiveBodySpan(body: string, offset = 0, maxUnits = 1500): ArchiveSpan {
  let start = Math.min(offset, body.length)
  if (
    start > 0 &&
    /[\uDC00-\uDFFF]/.test(body[start] ?? '') &&
    /[\uD800-\uDBFF]/.test(body[start - 1])
  )
    start--
  let end = Math.min(body.length, start + maxUnits)
  if (
    end < body.length &&
    /[\uD800-\uDBFF]/.test(body[end - 1] ?? '') &&
    /[\uDC00-\uDFFF]/.test(body[end])
  )
    end--
  return { start, end }
}

export function archiveRelevantSpan(body: string, question: string): ArchiveSpan {
  const terms = question.split(/\s+/u).filter(Boolean)
  // RegExp reports offsets in the original string even when case folding changes length.
  const matches = terms.map(
    (term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').exec(body)?.index
  )
  const match =
    matches.filter((index): index is number => index !== undefined).sort((a, b) => a - b)[0] ?? 0
  const paragraph = body.lastIndexOf('\n', Math.max(0, match - 1)) + 1
  const start = match - paragraph < 1000 ? paragraph : Math.max(paragraph, match - 400)
  return archiveBodySpan(body, start)
}
