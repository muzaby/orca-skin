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

interface MailBodySelection {
  readonly bodyText: string
  readonly bodyKind: MailArchiveBodyKind
  readonly bodyAlternateText: string | null
  readonly bodyAlternateKind: Exclude<MailArchiveBodyKind, 'none'> | null
  readonly bodyAlternateOmitted: boolean
  readonly bodyQualityFlags: readonly MailArchiveBodyQualityFlag[]
  readonly bodySelectionReason: MailArchiveBodySelectionReason
}

function normalizeBodyText(value: string | null | undefined): string {
  return (value ?? '').replace(/\r\n?/g, '\n').normalize('NFC').trim()
}

/**
 * Parse HTML as an inert document. Cheerio does not execute scripts or load remote resources;
 * this projection intentionally handles only explicit hidden markers, not the CSS cascade.
 */
function htmlToReadableText(value: string): string {
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
    .normalize('NFC')
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
    /(?:Ã[\u0080-¿]|Â[\u0080-¿]|â(?:€|‚|„|…|†|‡|ˆ|‰|‹|‘|’|“|”|•|–|—|˜|™)|ï»¿)/u.test(value)
  )
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8')
}

/** Plain을 우선하고, 안내문·깨진 plain일 때만 HTML로 대체한다. 나머지 표현은 대체 본문으로 보존한다. */
export function selectMailBody(input: {
  readonly plainText?: string | null
  readonly html?: string | null
}): MailBodySelection {
  const plainText = normalizeBodyText(input.plainText)
  const htmlText = htmlToReadableText(input.html ?? '')
  const hasHtml = htmlText.length > 0
  const plainUsable =
    plainText.length > 0 &&
    !(hasHtml && (isConfirmedPlaceholder(plainText) || isOnlyBrokenCharacters(plainText)))
  const differ =
    plainText.length > 0 && hasHtml && comparisonText(plainText) !== comparisonText(htmlText)

  let selectedText = ''
  let selectedKind: MailArchiveBodyKind = 'none'
  let alternateText: string | null = null
  let selectionReason: MailArchiveBodySelectionReason = 'empty'
  if (plainUsable) {
    selectedText = plainText
    selectedKind = 'plain'
    selectionReason = 'plain_preferred'
    if (differ) alternateText = htmlText
  } else if (hasHtml) {
    selectedText = htmlText
    selectedKind = 'html'
    selectionReason =
      plainText.length === 0
        ? 'html_only'
        : isConfirmedPlaceholder(plainText)
          ? 'plain_placeholder_fallback'
          : 'plain_unusable_fallback'
  }

  const flags = new Set<MailArchiveBodyQualityFlag>()
  if (differ) flags.add('alternative_mismatch')
  let alternateOmitted = false
  if (selectedText && utf8Bytes(selectedText) > MAX_BODY_BYTES) {
    // 본문을 조용히 자르지 않는다. 저장하지 않고 이유를 남긴다.
    flags.add('oversized')
    selectedText = ''
    alternateText = null
    alternateOmitted = differ
    selectionReason = 'oversized'
  } else if (alternateText && utf8Bytes(selectedText) + utf8Bytes(alternateText) > MAX_BODY_BYTES) {
    flags.add('oversized')
    alternateText = null
    alternateOmitted = true
  }
  if ((selectedKind === 'html' && selectedText) || alternateText !== null)
    flags.add('html_converted')
  if (selectedText && isDecodeSuspect(selectedText)) flags.add('decode_suspect')

  return {
    bodyText: selectedText,
    bodyKind: selectedKind,
    bodyAlternateText: alternateText,
    bodyAlternateKind: alternateText === null ? null : 'html',
    bodyAlternateOmitted: alternateOmitted,
    bodyQualityFlags: [...flags],
    bodySelectionReason: selectionReason
  }
}
