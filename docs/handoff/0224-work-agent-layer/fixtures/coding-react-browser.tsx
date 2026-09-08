// 실제 컴포넌트/React.memo를 사용한다. 번들에서 render 함수 진입 counter만 동일 삽입한다.
// production profiling React + 고정 CSS/합성 text workload. 전체 앱/페인트/FPS 측정은 아니다.
import React, { Profiler } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Exchange } from '@benchmark-source/renderer/src/features/chat/components/transcript/Exchange'
import { groupExchanges } from '@benchmark-source/renderer/src/features/chat/lib/turns'

const counts = () => ({ Exchange: 0, AssistantTurn: 0, AssistantMessage: 0 })
window.__renderCounts = counts()
// 초기 렌더는 IPC를 호출하지 않아야 한다. 불필요 host 접근은 조용히 모킹하지 않고 실패시킨다.
window.orca = new Proxy({}, { get(_target, group) {
  return new Proxy({}, { get(_target, method) {
    return () => { throw new Error(`Unexpected benchmark IPC: ${String(group)}.${String(method)}`) }
  } })
} })
const rootElement = document.getElementById('root')!
const root = createRoot(rootElement)
const noSteer = []
const message = (role, text, id) => ({ role, createdAt: 1700000000000 + id, parts: [{ type: 'text', text }] })
const paragraph = '합성 검증 결과입니다. **완료 기준**과 입력 조건을 확인했습니다.\n\n- 입력 값 17\n- 예상 값 19\n- 실제 값 19'
const history = Array.from({ length: 100 }, (_, i) => [message('user', `이전 요청 ${i}`, i * 2), message('assistant', `${paragraph}\n\n이전 결과 ${i}`, i * 2 + 1)]).flat()
const completed = Array.from({ length: 100 }, (_, i) => message('assistant', `${paragraph}\n\n현재 완료 ${i}`, 201 + i))
const prefix = [...history, message('user', '현재 요청', 200), ...completed]
let recorded = false
let commits = []
const onRender = (_id, phase, actualDuration, baseDuration, startTime, commitTime) => {
  if (recorded) commits.push({ phase, actualDuration, baseDuration, startTime, commitTime })
}
function render(last) {
  const exchanges = groupExchanges([...prefix, last])
  flushSync(() => root.render(
    <Profiler id="transcript" onRender={onRender}>
      {exchanges.map(exchange => <Exchange key={exchange.startIndex} exchange={exchange} agentKind="coding" reserve={false} pending={false} forkable={false} pendingSteer={noSteer} />)}
    </Profiler>
  ))
  return rootElement.offsetHeight // 동일 강제 layout; paint/FPS를 포함한다고 주장하지 않는다.
}
const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
window.runBenchmark = async () => {
  render(message('assistant', 'warming', 301))
  for (let i = 0; i < 20; i++) render(message('assistant', `${paragraph}\n\n예열 ${i}`, 301))
  await frame()
  await frame()
  const pastNode = rootElement.firstElementChild
  commits = []
  window.__renderCounts = counts()
  recorded = true
  const elapsed = []
  let height = 0
  for (let i = 0; i < 100; i++) {
    const last = message('assistant', `${paragraph}\n\n현재 갱신 ${'x'.repeat(i + 1)}`, 301)
    const start = performance.now()
    height = render(last)
    elapsed.push(performance.now() - start)
    await frame()
  }
  recorded = false
  const result = {
    elapsed, commits, counts: { ...window.__renderCounts }, height,
    historicalDomPreserved: pastNode === rootElement.firstElementChild,
    finalTextPresent: rootElement.textContent.includes(`현재 갱신 ${'x'.repeat(100)}`),
    exchangeCount: rootElement.children.length,
    workload: { historicalExchanges: 100, currentCompletedMessages: 100, lastMessageUpdates: 100, warmupUpdates: 20 }
  }
  if (commits.length !== 100 || result.counts.Exchange !== 100 || result.counts.AssistantTurn !== 100 || result.counts.AssistantMessage !== 100 || !result.historicalDomPreserved || !result.finalTextPresent || result.exchangeCount !== 101) throw new Error(`Benchmark oracle failed: ${JSON.stringify(result)}`)
  return result
}
