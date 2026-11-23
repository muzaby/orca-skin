import type { Element, Root } from 'hast'
export function mergeTableChunks(roots: Root[]): Root {
  const root = roots[0]
  if (roots.length === 1) return root
  const table = (r: Root): Element | undefined =>
    r.children.find((n): n is Element => n.type === 'element' && n.tagName === 'table')
  const first = table(root)
  if (!first) return root
  const body = (t: Element): Element | undefined =>
    t.children.find((n): n is Element => n.type === 'element' && n.tagName === 'tbody')
  const firstBody = body(first)
  if (!firstBody) return root
  const merged = {
    ...firstBody,
    children: roots.flatMap((r) => {
      const t = table(r)
      return (t && body(t)?.children) || []
    })
  }
  return {
    ...root,
    children: root.children.map((n) =>
      n === first
        ? { ...first, children: first.children.map((c) => (c === firstBody ? merged : c)) }
        : n
    )
  }
}
