// Codex 작성. 실제 React DOM click과 production scroll hook을 관측한다.
import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Exchange } from '@work-source/renderer/src/features/chat/components/transcript/Exchange'
import { groupExchanges } from '@work-source/renderer/src/features/chat/lib/turns'
import { useScrollAnchor } from '@work-source/renderer/src/features/chat/hooks/useScrollAnchor'
import { createWorkToolResultSelector } from '@work-source/renderer/src/features/chat/lib/workToolResults'
window.orca = new Proxy({}, { get(_target, group) { return new Proxy({}, { get(_target, method) { return () => { throw new Error(`Unexpected fixture IPC: ${String(group)}.${String(method)}`) } } }) } })
const rootElement = document.getElementById('root')!
const root = createRoot(rootElement)
const text = value => ({ type: 'text', text: value })
const begin = id => ({ type: 'response_boundary', boundary: { phase: 'begin', id } })
const end = id => ({ type: 'response_boundary', boundary: { phase: 'end', id, outcome: 'ended' } })
const message = (role, parts) => ({ role, createdAt: 1700000000000, parts })
const history = Array.from({ length: 20 }, (_, index) => [message('user', [text(`previous-request-${index}`)]), message('assistant', [text(`previous-answer-${index}`)])]).flat()
const original = message('assistant', [begin('original'), text('stable-introduction'), { type: 'tool_call', toolRunId: 'original-tool', toolName: 'Bash', args: { command: 'echo fixture-display-only' } }, { type: 'tool_result', toolRunId: 'original-tool', result: 'initial-tool-result', isError: false }, text(Array.from({ length: 45 }, (_, index) => `- middle-note-${index}`).join('\n')), { type: 'tool_call', toolRunId: 'second-tool', toolName: 'Read', args: { file_path: 'fixture-display-only.md' } }, text('stable-conclusion'), end('original')])
const prefix = [...history, message('user', [text('current-request')]), original]
const noSteer = []
function Board({ messages }) {
  const scroll = useScrollAnchor({ messages, sessionId: 'work-fixture', sendCount: 1, inflight: true })
  const exchanges = useMemo(() => groupExchanges(messages), [messages])
  const [selectResults] = useState(createWorkToolResultSelector)
  const results = useMemo(() => selectResults(exchanges), [exchanges, selectResults])
  return <div id="viewport" ref={scroll.scrollRef} onScroll={scroll.onScroll}><div id="content" ref={scroll.contentRef}>
    {exchanges.map(exchange => <Exchange key={exchange.startIndex} exchange={exchange} agentKind="work" toolResults={results.get(exchange.startIndex)} reserve={false} pending={false} forkable={false} pendingSteer={noSteer} />)}
  </div><span data-jump={scroll.showJump} /></div>
}
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
const settled = async () => { await frame(); await frame(); await new Promise(resolve => setTimeout(resolve, 40)) }
const render = messages => flushSync(() => root.render(<Board messages={messages} />))
window.runWorkLifetime = async () => {
  console.log('Work fixture: render')
  render(prefix)
  console.log('Work fixture: first frames')
  await settled()
  console.log('Work fixture: open activity')
  const viewport = document.getElementById('viewport')!
  const activity = rootElement.querySelector('[data-agent="work"] button[aria-expanded]')!
  if (!activity || activity.getAttribute('aria-expanded') !== 'false') throw new Error('Initial activity not collapsed')
  flushSync(() => activity.click())
  await settled()
  console.log('Work fixture: open tool')
  const tool = rootElement.querySelector('[data-agent="work"] [role="button"][aria-expanded]')!
  flushSync(() => tool.click())
  await settled()
  console.log('Work fixture: scroll')
  viewport.scrollTop = Math.max(0, activity.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - 80)
  viewport.dispatchEvent(new Event('scroll', { bubbles: true }))
  await settled()
  const previous = rootElement.querySelector('[data-app-exchange]')
  const conclusion = Array.from(rootElement.querySelectorAll('p')).find(node => node.textContent === 'stable-conclusion')
  const initial = { scrollTop: viewport.scrollTop, anchorTop: activity.getBoundingClientRect().top, gapToBottom: viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight }
  if (initial.gapToBottom <= 120 || !conclusion || tool.getAttribute('aria-expanded') !== 'true') throw new Error('Fixture did not establish an open, detached reading position')
  const samples = []
  function observe(stage) {
    const sample = { stage, disclosureOpen: activity.getAttribute('aria-expanded') === 'true', toolOpen: tool.getAttribute('aria-expanded') === 'true', activityDomPreserved: rootElement.querySelector('[data-agent="work"] button[aria-expanded]') === activity, toolDomPreserved: rootElement.querySelector('[data-agent="work"] [role="button"][aria-expanded]') === tool, historicalDomPreserved: rootElement.querySelector('[data-app-exchange]') === previous, conclusionDomPreserved: conclusion.isConnected && conclusion.textContent === 'stable-conclusion', scrollTop: viewport.scrollTop, anchorTop: activity.getBoundingClientRect().top }
    samples.push(sample)
    if (!sample.disclosureOpen || !sample.toolOpen || !sample.activityDomPreserved || !sample.toolDomPreserved || !sample.historicalDomPreserved || !sample.conclusionDomPreserved || Math.abs(sample.scrollTop - initial.scrollTop) > 1 || Math.abs(sample.anchorTop - initial.anchorTop) > 1) throw new Error(`Work DOM lifetime oracle failed: ${JSON.stringify(sample)}`)
  }
  observe('opened')
  console.log('Work fixture: tail updates')
  for (let index = 0; index < 20; index++) {
    render([...prefix, message('assistant', [begin('late-response'), text(`tail-update-${'x'.repeat(index + 1)}`)])])
    await settled()
    observe(`tail-${index}`)
    console.log(`Work fixture: tail ${index} observed`)
  }
  render([...prefix, message('assistant', [begin('late-response'), text('tail-finished'), end('late-response'), { type: 'tool_result', toolRunId: 'original-tool', result: 'late-original-tool-result', isError: false }])])
  await settled()
  observe('late-original-result')
  const lateResultVisible = rootElement.textContent.includes('late-original-tool-result')
  if (!lateResultVisible) throw new Error('Updated original tool result not visible in the still-open card')
  flushSync(() => root.unmount())
  return { initial, samples, lateResultVisible, rootUnmounted: rootElement.childElementCount === 0 }
}
