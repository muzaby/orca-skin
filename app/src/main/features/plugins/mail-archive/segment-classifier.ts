import type { MailArchiveBodySegment } from '../../../../shared/mail-archive'

export const ARCHIVE_CLASSIFIER_REVISION = 'plain-lines-v1'

function hasSignatureContacts(tail: string): boolean {
  const emails = tail.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi)?.length ?? 0
  const urls = tail.match(/https?:\/\/\S+/gi)?.length ?? 0
  const phones =
    tail.match(/(?:전화|휴대폰|연락처|tel|phone|mobile)\s*[:：]?\s*\+?\d[\d ()-]{6,}\d/gi)
      ?.length ?? 0
  return emails + urls + phones >= 2
}

/** Classify without rewriting a single code unit, including CRLF and trailing whitespace. */
export function classifyArchiveBody(body: string): MailArchiveBodySegment[] {
  const segments: MailArchiveBodySegment[] = []
  let signature = false
  for (const line of body.matchAll(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g)) {
    const start = line.index
    const end = start + line[0].length
    const content = line[0].replace(/[\r\n]+$/, '')
    if (content === '-- ' && hasSignatureContacts(body.slice(end))) signature = true
    const kind = /^\s*>/.test(content) ? 'quote' : signature ? 'signature' : 'unknown'
    const ruleId =
      kind === 'quote'
        ? 'explicit-quote-line'
        : kind === 'signature'
          ? 'signature-contacts'
          : 'unclassified'
    const previous = segments.at(-1)
    if (previous?.kind === kind) {
      segments[segments.length - 1] = { ...previous, end }
    } else {
      segments.push({
        ordinal: segments.length,
        start,
        end,
        kind,
        ruleId,
        classifierRevision: ARCHIVE_CLASSIFIER_REVISION,
        confidenceClass: kind === 'unknown' ? 'uncertain' : 'certain'
      })
    }
  }
  return segments
}
