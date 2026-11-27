import type { Root, RootContent } from 'hast'
import { defaultUrlTransform } from 'react-markdown'
export function safeHast(hast: Root, visit?: (node: Root | RootContent) => void): void {
  const pending: (Root | RootContent)[] = [hast]
  while (pending.length) {
    const node = pending.pop()!
    visit?.(node)
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
}
