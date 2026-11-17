// 데이터 호스트 진입점 (0324 D-034 · §7-F 4b). 셸이 `utilityProcess.fork` 로 띄운다.
import { runHostProcess } from '../host-process'
import type { ParentPort } from '../host-runtime'
import { DataBootstrap } from './bootstrap'

runHostProcess({
  name: 'data-host',
  parent: process.parentPort as unknown as ParentPort,
  argv: process.argv,
  exit: (code) => process.exit(code),
  create: (context) => new DataBootstrap(context),
  onProcessError: (listener) => {
    process.on('unhandledRejection', (reason) => listener('rejection', reason))
    process.on('uncaughtException', (error) => listener('exception', error))
  }
})
