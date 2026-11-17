// 에이전트 호스트 진입점 (0324 D-034 · §7-F 4c). 셸이 데이터 호스트가 준비된 뒤 `utilityProcess.fork` 로 띄운다.
import { runHostProcess } from '../host-process'
import type { ParentPort } from '../host-runtime'
import { AgentBootstrap } from './bootstrap'

runHostProcess({
  name: 'agent-host',
  parent: process.parentPort as unknown as ParentPort,
  argv: process.argv,
  exit: (code) => process.exit(code),
  create: (context) => new AgentBootstrap(context),
  onProcessError: (listener) => {
    process.on('unhandledRejection', (reason) => listener('rejection', reason))
    process.on('uncaughtException', (error) => listener('exception', error))
  }
})
