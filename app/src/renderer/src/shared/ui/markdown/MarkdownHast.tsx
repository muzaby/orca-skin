import { useMemo } from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { Root } from 'hast'
import {
  COMPONENTS,
  COMPONENTS_WITH_SOURCE_PARTS,
  MarkdownPartsContext
} from './markdownComponents'
import { sourcePartSpans, type MarkdownSourcePart } from './sourceParts'

interface MarkdownHastProps {
  hast: Root
  source: string
  parts?: readonly MarkdownSourcePart[]
}

export function MarkdownHast({ hast, source, parts }: MarkdownHastProps): React.JSX.Element {
  return useMemo(() => {
    const tree = parts?.length ? structuredClone(hast) : hast
    if (parts?.length) sourcePartSpans(source, parts)()(tree)
    const children = toJsxRuntime(tree, {
      Fragment,
      jsx,
      jsxs,
      passKeys: true,
      passNode: true,
      ignoreInvalidStyle: true,
      components: parts?.length ? COMPONENTS_WITH_SOURCE_PARTS : COMPONENTS
    })
    return (
      <MarkdownPartsContext.Provider value={parts?.length ? { source, parts } : null}>
        {children}
      </MarkdownPartsContext.Provider>
    )
  }, [hast, source, parts])
}
