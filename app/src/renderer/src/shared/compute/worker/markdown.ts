import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import type { Root, RootContent } from 'hast'
import { defaultUrlTransform } from 'react-markdown'
import { MARKDOWN_BLOCK_MAX_CHARS, MARKDOWN_HAST_MAX_NODES } from '../limits'
import type { ComputeResults } from '../protocol'

const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })

export function parseMarkdown(source: string): ComputeResults['markdown'] {
  if (source.length > MARKDOWN_BLOCK_MAX_CHARS) return { tooLarge: true }
  const hast = parser.runSync(parser.parse(source)) as Root
  const pending: (Root | RootContent)[] = [hast]
  let nodes = 0
  while (pending.length) {
    const node = pending.pop()!
    if (++nodes > MARKDOWN_HAST_MAX_NODES) return { tooLarge: true }
    if (node.type === 'element') {
      for (const key of ['href', 'src']) {
        const url = node.properties[key]
        if (typeof url === 'string') node.properties[key] = defaultUrlTransform(url)
      }
    }
    if ('children' in node) {
      for (const [index, child] of node.children.entries()) {
        if (child.type === 'raw') {
          const text = { type: 'text' as const, value: child.value, position: child.position }
          node.children[index] = text
          pending.push(text)
        } else pending.push(child)
      }
    }
  }
  return { hast }
}
