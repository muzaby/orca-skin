// 두 호스트 기동 스모크 (0324 SD-04″ · AC31′·AC32′·AC24′·F2·F5). `electron-vite build` 의 산출(`out/main`)을
// 셸 대신 띄운다 — 데이터 호스트 → 준비 → 에이전트 호스트 → 준비 → 피어 포트 → 창 포트, 그리고 창 포트로
// 실제 채널 요청을 보내고 에이전트 → 데이터 순으로 내린다. 단위 테스트는 조립(`DataBootstrap`·
// `AgentBootstrap`)을 통째로 띄우지 못한다(plan B29) — 조립 안의 기동 순서 결함은 여기서만 보인다.
//
// 호스트는 worker 스레드에서 돈다(`smoke-host-worker.mjs` — utility 프로세스의 부모 포트와 `electron.net`
// 을 흉내 낸다). SQLite 를 열므로 better-sqlite3 가 Node ABI 여야 한다 — CI 는 `npm test` 뒤에 돌린다.
//
// 사용: node scripts/smoke-hosts.mjs [out/main]   — 통과하면 exit 0, 아니면 판정을 출력하고 exit 1.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { MessageChannel, Worker } from 'node:worker_threads'
import { scaleMs } from './test-time.mjs'

// `src/main/app/host-runtime.ts` 의 `HOST_ENVIRONMENT_ARG` 와 같아야 한다(테스트가 대조한다).
export const HOST_ENVIRONMENT_ARG = '--oo-host-environment='
const WORKER = fileURLToPath(new URL('./smoke-host-worker.mjs', import.meta.url))
const BASE_TIMEOUT_MS = 60_000

// 관측 → 실패 목록. 비어 있으면 통과다.
export function evaluate(observed) {
  const failures = []
  const result = (key) => observed.results[key]
  const ok = (key, check, why) => {
    const r = result(key)
    if (!r) failures.push(`${key}: 응답 없음`)
    else if (!r.ok) failures.push(`${key}: 오류 — ${r.error}`)
    else if (!check(r.value)) failures.push(`${key}: ${why}`)
  }
  if (!observed.ready.data) failures.push('데이터 호스트가 준비를 알리지 않았다')
  else if (typeof observed.ready.data.mirror?.uiLocale !== 'string')
    failures.push('데이터 호스트의 준비에 UI 언어 사본이 없다(F5)')
  if (!observed.ready.agent) failures.push('에이전트 호스트가 준비를 알리지 않았다')
  ok('data oo:settings:get', (v) => v !== null && typeof v === 'object', '설정 객체가 아니다')
  ok('data oo:session:list', Array.isArray, '세션 목록이 배열이 아니다')
  ok('agent oo:backend:list', (v) => Array.isArray(v?.backends), '하네스 목록이 없다')
  ok('agent oo:agent:list', Array.isArray, '모델 환경 목록이 배열이 아니다(피어 조회 F2)')
  const wrong = result('agent oo:settings:get')
  if (!wrong) failures.push('agent oo:settings:get: 응답 없음')
  else if (wrong.ok)
    failures.push('agent oo:settings:get: 소유하지 않은 채널을 에이전트 호스트가 처리했다')
  if (observed.exits.agent !== 0) failures.push(`에이전트 호스트 종료 코드 ${observed.exits.agent}`)
  if (observed.exits.data !== 0) failures.push(`데이터 호스트 종료 코드 ${observed.exits.data}`)
  if (observed.exitOrder.join('>') !== 'agent>data')
    failures.push(`종료 순서가 에이전트 → 데이터가 아니다: ${observed.exitOrder.join(' → ')}`)
  for (const error of observed.errors) failures.push(error)
  return failures
}

export function runSmoke(outDir, { timeoutMs = scaleMs(BASE_TIMEOUT_MS) } = {}) {
  const userData = mkdtempSync(join(tmpdir(), 'orcinus-orca-host-smoke-'))
  const environment = {
    userData,
    desktop: userData,
    appVersion: '0.0.0-smoke',
    isPackaged: false,
    appPath: process.cwd()
  }
  const observed = {
    ready: {},
    results: {},
    exits: {},
    exitOrder: [],
    errors: []
  }
  const hosts = {}
  const windows = {}
  const pending = new Map()
  let nextId = 1

  return new Promise((done) => {
    const finish = () => {
      clearTimeout(timer)
      for (const worker of Object.values(hosts)) void worker.terminate()
      rmSync(userData, { recursive: true, force: true, maxRetries: 3 })
      done(observed)
    }
    const timer = setTimeout(() => {
      observed.errors.push(`제한 시간 ${timeoutMs}ms 초과`)
      finish()
    }, timeoutMs)

    const invoke = (kind, channel, payload) =>
      new Promise((settle) => {
        const id = nextId++
        pending.set(id, settle)
        windows[kind].postMessage({ kind: 'invoke', id, channel, payload })
      })

    const connectWindow = (kind) => {
      const { port1, port2 } = new MessageChannel()
      windows[kind] = port1
      port1.on('message', (message) => {
        if (message?.kind !== 'result') return
        const settle = pending.get(message.id)
        pending.delete(message.id)
        settle?.(message)
      })
      hosts[kind].postMessage(
        { data: { type: 'client.connect', clientId: 1, trusted: true }, ports: [port2] },
        [port2]
      )
    }

    const exercise = async () => {
      const { port1, port2 } = new MessageChannel()
      hosts.data.postMessage({ data: { type: 'peer.connect' }, ports: [port1] }, [port1])
      hosts.agent.postMessage({ data: { type: 'peer.connect' }, ports: [port2] }, [port2])
      const requests = [
        ['data', 'oo:settings:get'],
        ['data', 'oo:session:list'],
        ['agent', 'oo:backend:list'],
        ['agent', 'oo:agent:list'],
        ['agent', 'oo:settings:get']
      ]
      for (const [kind, channel] of requests) {
        observed.results[`${kind} ${channel}`] = await invoke(kind, channel)
      }
      hosts.agent.once('exit', () => hosts.data.postMessage({ data: { type: 'shutdown' } }))
      hosts.agent.postMessage({ data: { type: 'shutdown' } })
    }

    const start = (kind) => {
      const worker = new Worker(WORKER, {
        workerData: {
          bundle: join(outDir, `${kind}-host.js`),
          environment,
          environmentArg: HOST_ENVIRONMENT_ARG
        }
      })
      hosts[kind] = worker
      worker.on('error', (error) => observed.errors.push(`${kind}: ${error?.stack ?? error}`))
      worker.on('exit', (code) => {
        observed.exits[kind] = code
        observed.exitOrder.push(kind)
        if (observed.exitOrder.length === 2) finish()
      })
      worker.on('message', ({ toShell: message }) => {
        if (!message) return
        if (message.type === 'service.call') {
          // 셸 서비스 — 키체인이 없는 환경으로 답한다.
          const value = message.name === 'secrets.isAvailable' ? false : null
          worker.postMessage({ data: { type: 'service.result', id: message.id, ok: true, value } })
          return
        }
        if (message.type !== 'ready') return
        observed.ready[kind] = message
        connectWindow(kind)
        if (kind === 'data') start('agent')
        else
          exercise().catch((error) => {
            observed.errors.push(`요청 단계: ${error?.stack ?? error}`)
            finish()
          })
      })
    }

    start('data')
  })
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const outDir = resolve(process.argv[2] ?? 'out/main')
  const observed = await runSmoke(outDir)
  const failures = evaluate(observed)
  for (const [key, value] of Object.entries(observed.results)) {
    console.log(`[smoke-hosts] ${key}: ${value.ok ? 'ok' : `error — ${value.error}`}`)
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[smoke-hosts] FAIL ${failure}`)
    process.exit(1)
  }
  console.log(
    '[smoke-hosts] OK — 데이터 → 에이전트 기동 · 피어 · 창 포트 요청 · 에이전트 → 데이터 종료'
  )
}
