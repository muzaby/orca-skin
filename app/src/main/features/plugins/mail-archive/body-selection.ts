import { load } from 'cheerio'
import type {
  MailArchiveBodyKind,
  MailArchiveBodyQualityFlag,
  MailArchiveBodySelectionReason
} from '../../../../shared/mail-archive'

const MAX_BODY_BYTES = 2 * 1024 * 1024
const PLACEHOLDER_TEXTS = new Set([
  'this message is best viewed in html.',
  'please view this email in html.',
  'to view this message, please use an html compatible email reader.',
  '이 메시지는 html 형식으로 보는 것이 가장 좋습니다.',
  '이 메일은 html 형식으로 확인해 주세요.'
])

const BLOCK_ELEMENTS =
  'address, article, aside, blockquote, dd, div, dl, dt, fieldset, figcaption, figure, footer, form, h1, h2, h3, h4, h5, h6, header, hr, li, main, ol, p, pre, section, table, tbody, tfoot, thead, tr, ul'

export interface MailBodySelection {
  /** Stable pre-projection text used only for identity compatibility across parser revisions. */
  readonly identityBodyText: string
  readonly bodyText: string
  readonly bodyKind: MailArchiveBodyKind
  readonly bodyAlternateText: string | null
  readonly bodyAlternateKind: Exclude<MailArchiveBodyKind, 'none' | 'legacy'> | null
  readonly bodyAlternateOmitted: boolean
  readonly bodyQualityFlags: readonly MailArchiveBodyQualityFlag[]
  readonly bodySelectionReason: MailArchiveBodySelectionReason
}

function normalizeBodyText(value: string | null | undefined): string {
  return (value ?? '').replace(/\r\n?/g, '\n').normalize('NFC').trim()
}

function legacyHtmlIdentityText(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse HTML as an inert document. Cheerio does not execute scripts or load remote resources;
 * this projection intentionally handles only explicit hidden markers, not the CSS cascade.
 */
export function htmlToReadableText(value: string): string {
  if (!value.trim()) return ''
  const $ = load(value, { scriptingEnabled: false }, false)
  $('head, title, meta, link, script, style, template, noscript, iframe, object, embed').remove()
  $('[hidden], [aria-hidden="true"]').remove()
  $('[style]')
    .filter((_index, element) => {
      const style = $(element).attr('style') ?? ''
      return /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$)/i.test(style)
    })
    .remove()
  $('br').replaceWith('\n')
  $(BLOCK_ELEMENTS).each((_index, element) => {
    $(element).before('\n').after('\n')
  })
  $('li').each((_index, element) => {
    $(element).prepend('• ')
  })
  $('td, th').each((_index, element) => {
    $(element).after('\t')
  })

  return $.root()
    .text()
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n[\t ]+/g, '\n')
    .replace(/[\t ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function comparisonText(value: string): string {
  return value.replace(/[\s\u00a0]+/g, ' ').trim()
}

function isConfirmedPlaceholder(value: string): boolean {
  return PLACEHOLDER_TEXTS.has(comparisonText(value).toLocaleLowerCase('en-US'))
}

function isOnlyBrokenCharacters(value: string): boolean {
  return /^[\s\uFEFF\uFFFD]*$/u.test(value)
}

function isDecodeSuspect(value: string): boolean {
  return (
    value.includes('\uFFFD') ||
    /(?:Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â(?:€|‚|„|…|†|‡|ˆ|‰|‹|‘|’|“|”|•|–|—|˜|™)|ï»¿)/u.test(
      value
    )
  )
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8')
}

export function selectMailBody(input: {
  readonly plainText?: string | null
  readonly html?: string | null
}): MailBodySelection {
  const plainText = normalizeBodyText(input.plainText)
  const htmlText = htmlToReadableText(input.html ?? '').normalize('NFC')
  const identityBodyText = plainText || legacyHtmlIdentityText(input.html ?? '')
  const hasPlain = plainText.length > 0
  const hasHtml = htmlText.length > 0
  const placeholderFallback = hasPlain && hasHtml && isConfirmedPlaceholder(plainText)
  const unusableFallback = hasPlain && hasHtml && isOnlyBrokenCharacters(plainText)

  let selectedText = ''
  let selectedKind: MailArchiveBodyKind = 'none'
  let alternateText: string | null = null
  let alternateKind: Exclude<MailArchiveBodyKind, 'none' | 'legacy'> | null = null
  let selectionReason: MailArchiveBodySelectionReason = 'empty'

  if (hasPlain && !placeholderFallback && !unusableFallback) {
    selectedText = plainText
    selectedKind = 'plain'
    selectionReason = 'plain_preferred'
    if (hasHtml && comparisonText(plainText) !== comparisonText(htmlText)) {
      alternateText = htmlText
      alternateKind = 'html'
    }
  } else if (hasHtml) {
    selectedText = htmlText
    selectedKind = 'html'
    selectionReason = placeholderFallback
      ? 'plain_placeholder_fallback'
      : unusableFallback
        ? 'plain_unusable_fallback'
        : 'html_only'
    if (hasPlain && !placeholderFallback && !unusableFallback) {
      alternateText = plainText
      alternateKind = 'plain'
    }
  } else if (hasPlain) {
    // Keep the only available representation even when it resembles an HTML placeholder.
    selectedText = plainText
    selectedKind = 'plain'
    selectionReason = 'plain_preferred'
  }

  const flags = new Set<MailArchiveBodyQualityFlag>()
  const bothCandidatesDiffer =
    hasPlain && hasHtml && comparisonText(plainText) !== comparisonText(htmlText)
  if (bothCandidatesDiffer) flags.add('alternative_mismatch')

  let alternateOmitted = false
  if (selectedText && utf8Bytes(selectedText) > MAX_BODY_BYTES) {
    flags.add('oversized')
    selectedText = ''
    alternateText = null
    alternateKind = null
    alternateOmitted = bothCandidatesDiffer
    selectionReason = 'oversized'
  } else if (alternateText && utf8Bytes(selectedText) + utf8Bytes(alternateText) > MAX_BODY_BYTES) {
    flags.add('oversized')
    alternateText = null
    alternateKind = null
    alternateOmitted = true
  }

  if ((selectedKind === 'html' && selectedText) || alternateKind === 'html') {
    flags.add('html_converted')
  }
  if (selectedText && isDecodeSuspect(selectedText)) flags.add('decode_suspect')

  return {
    identityBodyText,
    bodyText: selectedText,
    bodyKind: selectedKind,
    bodyAlternateText: alternateText,
    bodyAlternateKind: alternateKind,
    bodyAlternateOmitted: alternateOmitted,
    bodyQualityFlags: [...flags],
    bodySelectionReason: selectionReason
  }
}
