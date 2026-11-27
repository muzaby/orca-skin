import { useId, useMemo } from 'react'
import { useComputeDocument } from '../../../shared/compute/useComputeDocument'
import { TOKENS_RANGE_MAX_LINES } from '../../../shared/compute/limits'
import { type DiffLine } from '../lib/diffLines'
import { type DiffSyntaxTokens } from '../lib/diffSyntax'
import { extToLang } from '../lib/lang'
import { useWindowTokens } from './useWindowTokens'
import { isLang } from '../../../shared/ui/markdown/syntax'
import { VIRTUAL_BODY_MIN_LINES } from '../../../shared/ui/virtual/limits'

function useAxis(
  lines: readonly DiffLine[],
  exclude: DiffLine['type'],
  lang: string | undefined
): { line: DiffLine; parts: readonly import('shiki').ThemedToken[] | undefined }[] {
  const input = useMemo(
    () =>
      lang && isLang(lang) && lines.length <= VIRTUAL_BODY_MIN_LINES
        ? lines.filter((line) => line.type !== exclude)
        : [],
    [lang, lines, exclude]
  )
  const text = useMemo(() => input.map((line) => line.text).join('\n'), [input])
  const doc = useComputeDocument(useId(), text, 'compute', input, undefined, input.length > 0)
  const source = useMemo(() => ({ doc: doc.ref }), [doc.ref])
  const first = useWindowTokens(source, lang, 0, 'visible', doc.ready)
  const second = useWindowTokens(
    source,
    lang,
    TOKENS_RANGE_MAX_LINES,
    'visible',
    doc.ready && input.length > TOKENS_RANGE_MAX_LINES
  )
  return useMemo(
    () =>
      input.map((line, i) => ({
        line,
        parts: (i < TOKENS_RANGE_MAX_LINES ? first : second)?.[i % TOKENS_RANGE_MAX_LINES]
      })),
    [input, first, second]
  )
}
export function useSmallDiffSyntax(lines: readonly DiffLine[], filePath: string): DiffSyntaxTokens {
  const lang = extToLang(filePath),
    old = useAxis(lines, 'added', lang),
    next = useAxis(lines, 'removed', lang)
  return useMemo(() => {
    const values = new Map<
      DiffLine,
      { old?: readonly import('shiki').ThemedToken[]; new?: readonly import('shiki').ThemedToken[] }
    >()
    for (const [axis, entries] of [
      ['old', old],
      ['new', next]
    ] as const)
      for (const { line, parts } of entries)
        if (parts && parts.map((t) => t.content).join('') === line.text)
          values.set(line, { ...values.get(line), [axis]: parts })
    return values
  }, [old, next])
}
