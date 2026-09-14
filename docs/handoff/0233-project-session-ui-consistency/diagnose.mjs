// 저장소 루트에서 실행: node docs/handoff/0233-project-session-ui-consistency/diagnose.mjs
// 수정 후 같은 입력 확인: 위 명령 끝에 --expect-fixed 를 붙인다.
// 실제 TS 소스를 메모리에서 변환해 호출하며 앱 코드·사용자 DB·파일은 수정하지 않는다.
// store는 실제 Zustand를 사용한다. route hook은 ref/dependency/effect 순서를 보존한 모델이다.
// React DOM·라우터 스케줄러·Electron 시각 재현은 아니므로 native 화면 인수의 대체가 아니다.
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const appRequire = createRequire(resolve(root, 'app/package.json'))
const ts = appRequire('typescript')

function sourceModule(relativePath, imports) {
  const cache = new Map()
  const evaluate = (file) => {
    if (cache.has(file)) return cache.get(file)
    const exports = {}
    cache.set(file, exports)
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText
    vm.runInNewContext(code, {
      exports,
      console,
      require: (name) => {
        if (Object.hasOwn(imports, name)) return imports[name]
        if (!name.startsWith('.')) return appRequire(name)
        const base = resolve(dirname(file), name)
        const target = [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts')].find(
          (candidate) => existsSync(candidate) && /\.[cm]?[jt]sx?$/.test(candidate)
        )
        if (!target) throw new Error(`Cannot resolve ${name} from ${file}`)
        return evaluate(target)
      }
    })
    return exports
  }
  return evaluate(resolve(root, relativePath))
}

const session = (id) => ({
  id,
  agentKind: 'code',
  backend: 'claude',
  title: id,
  updatedAt: id === 'new' ? 2 : 1,
  preview: null,
  projectId: 'p',
  cwd: null,
  pinnedAt: null
})

let recentRows = [session('old')]
let projectList = async () => [session('old')]
const sessions = sourceModule('app/src/renderer/src/features/sessions/store/sessionsStore.ts', {
  '../../../shared/api/ipc': {
    sessionApi: { list: async () => recentRows },
    projectApi: { listSessions: () => projectList() }
  }
})

await sessions.sessionsActions.loadProject('p')
await sessions.sessionsActions.refresh()

// 펼침/랜딩 조회가 전송보다 먼저 시작됐지만, 응답은 새 최근 목록 뒤에 도착하는 입력이다.
let resolveOlderProject
projectList = () => new Promise((finish) => { resolveOlderProject = finish })
const olderProjectRequest = sessions.sessionsActions.loadProject('p')
recentRows = [session('new'), session('old')]
await sessions.sessionsActions.refresh()
const membershipSnapshot = () => {
  const state = sessions.useSessionsStore.getState()
  return {
    recentIds: [...state.recentIds],
    projectSessionIds: [...state.projectSessionIds.p],
    newEntityPresent: state.byId.new != null
  }
}
const atRecentRefresh = membershipSnapshot()
resolveOlderProject([session('old')])
await olderProjectRequest
const afterOlderProjectResponse = membershipSnapshot()

let pathname = '/projects/p'
let project = { id: 'p', cwd: 'C:/P' }
let active = {
  sessionId: null,
  pendingProjectId: 'p',
  messages: [],
  loadingSession: false,
  forkFrom: null,
  handoffFrom: null
}
let refIndex = 0
let effectIndex = 0
const refs = []
const dependencies = []
const queuedEffects = []
const routeCalls = []
const navigate = (path, options) => {
  routeCalls.push({ navigate: path, options, activeAtNavigate: active.sessionId })
}
const route = sourceModule('app/src/renderer/src/app/hooks/useChatRouteSync.ts', {
  react: {
    useRef: (initialValue) => {
      const index = refIndex++
      return refs[index] ?? (refs[index] = { current: initialValue })
    },
    useEffect: (setup, next) => {
      const index = effectIndex++
      const previous = dependencies[index]
      if (!previous || next.some((value, i) => !Object.is(value, previous[i]))) {
        queuedEffects.push(setup)
      }
      dependencies[index] = next
    }
  },
  'react-router-dom': {
    useLocation: () => ({ pathname }),
    useNavigate: () => navigate,
    matchPath: (pattern, path) => {
      if (pattern === '/projects/:projectId' && path.startsWith('/projects/')) {
        return { params: { projectId: path.slice(10) } }
      }
      if (pattern === '/chat/:sessionId' && path.startsWith('/chat/')) {
        return { params: { sessionId: path.slice(6) } }
      }
      return null
    }
  },
  '../../features/chat': {
    getActiveChatSession: () => active,
    useChatSession: (select) => select(active),
    chatActions: {
      newChat: (projectId) => {
        routeCalls.push({ newChat: projectId, before: active.sessionId })
        active = { ...active, sessionId: null, pendingProjectId: projectId, messages: [] }
      },
      initializeProjectCwd: () => {},
      loadSession: () => {}
    }
  },
  '../../features/sessions': { useSessionsState: (select) => select({ byId: {} }) },
  '../../features/projects': { useProjectsState: (select) => select({ list: [project] }) }
})

function renderRoute() {
  refIndex = 0
  effectIndex = 0
  route.useChatRouteSync()
  while (queuedEffects.length > 0) queuedEffects.shift()()
}

renderRoute()
// URL replace가 확정되기 전에 승격과 동일 프로젝트 카탈로그 참조 교체가 관측되는 입력이다.
active = {
  ...active,
  sessionId: 'new',
  pendingProjectId: null,
  messages: [{ role: 'user', content: 'hello' }]
}
project = { ...project }
renderRoute()
const routePromotion = {
  calls: routeCalls,
  finalActiveSession: active.sessionId,
  finalMessageCount: active.messages.length
}

console.log(JSON.stringify({ atRecentRefresh, afterOlderProjectResponse, routePromotion }, null, 2))

if (process.argv.includes('--expect-fixed')) {
  assert.deepEqual(atRecentRefresh.projectSessionIds, ['new', 'old'])
  assert.deepEqual(afterOlderProjectResponse.projectSessionIds, ['new', 'old'])
  assert.equal(routePromotion.finalActiveSession, 'new')
  assert.equal(routePromotion.finalMessageCount, 1)
  assert.equal(routeCalls.filter((call) => 'newChat' in call).length, 0)
  assert.equal(routeCalls.filter((call) => call.navigate === '/chat/new').length, 1)
}
