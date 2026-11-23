import { createElement as h, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { VirtualRowMountContext, useMountedRows } from '<app>/src/renderer/src/shared/ui/virtual/rowMount'
import { usePanelSelection } from 'UPS'
let setState: (s: { keys: number[]; doc: string }) => void = () => {}
let guardRef: any
function Rows({ keys }: { keys: number[] }) {
  useMountedRows(keys)
  return h('div', null, ...keys.map((k) => h('p', { key: k, id: 'r' + k }, 'row text ' + k)))
}
function Panel() {
  const [st, set] = useState({ keys: [0, 1], doc: 'a' })
  setState = set
  const root = useRef<HTMLDivElement>(null)
  const g = usePanelSelection(root, st.doc)
  guardRef = g
  return h('div', { ref: root, id: 'owner', 'data-s': g.suppressed ? 'yes' : 'no', onPointerDown: g.onPointerDown },
    h(VirtualRowMountContext.Provider, { value: g.notify }, h(Rows, { keys: st.keys })))
}
const tick = () => new Promise((r) => setTimeout(r, 50))
async function run() {
  const el = document.getElementById('app')!
  flushSync(() => createRoot(el).render(h(Panel)))
  await tick()
  const owner = () => document.getElementById('owner')!
  const sel = () => {
    const p = document.querySelector('#owner p')!.firstChild!
    document.getSelection()!.setBaseAndExtent(p, 0, p, 4)
  }
  guardRef.onPointerDown({ button: 0 })
  await tick()
  sel(); await tick()
  flushSync(() => setState({ keys: [0, 1, 2], doc: 'a' })); await tick()
  const s1 = owner().dataset.s
  flushSync(() => setState({ keys: [5, 6, 7], doc: 'b' })); await tick()
  const s2 = owner().dataset.s
  sel(); await tick()
  const after = document.getSelection()!.toString()
  ;(window as any).result = { suppressedAfterCancel: s1, suppressedAfterSwitch: s2, newSelection: after }
}
run().catch((e) => ((window as any).result = { error: String(e) }))
