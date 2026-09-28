import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../app')
const OUT = path.join(os.tmpdir(), 'orca-0243-verify-m.json')
const C = 'src/main/features/chat/turn-coordinator.ts'
const H = 'src/main/app/chat-turn/index.ts'
const A = 'src/main/features/chat/abort.ts'
const TESTS = ['src/main/features/chat/turn-coordinator.test.ts','src/main/app/chat-turn/post-turn.schedules.test.ts','src/main/features/chat/abort.test.ts','src/main/app/chat-turn/approval.identity.test.ts']
const M = [
 ['M1',C,"          deliverAbortTerminal()\n          closeBoundary()","          closeBoundary()"],
 ['M2',C,"          if (turn.controller.signal.aborted) {\n            deliverAbortTerminal()\n            closeAfterFailure()","          if (turn.controller.signal.aborted) {\n            closeAfterFailure()"],
 ['M3',C,"            } catch {\n              deliverAbortTerminal()\n              closeAfterFailure()","            } catch {\n              closeAfterFailure()"],
 ['M4',H,"    turn.abortAcknowledged = true\n",""],
 ['M5',C,"              if (ev.type === 'telemetry' || ev.type === 'error' || ev.type === 'turn.aborted') {\n                terminalForwarded = true\n              }",""],
 ['M6',C,"    let terminalForwarded = false","    setTimeout(() => turn.controller.abort(), 120_000)\n    let terminalForwarded = false"],
 ['M6b-abortTurn',C,"    let terminalForwarded = false","    setTimeout(() => { runtime.markAborted?.('user_cancelled'); turn.controller.abort() }, 120_000)\n    let terminalForwarded = false"],
 ['X1-listener-reg',C,"    turn.controller.signal.addEventListener('abort', abortRuntime, { once: true })\n",""],
 ['X2-finalize-trycatch',C,"      try {\n        persist.finalizeTurn?.(turn)\n      } catch (err) {\n        // DB 마감 실패가 화면의 턴 종료까지 막지는 않는다. 미완성 기록은 부팅 시 복구한다.\n        log.warn('chat.turn.finalize-failed', { message: String(err) })\n      }","      persist.finalizeTurn?.(turn)"],
 ['X3-flag-synth',C,"            this.emit(turn, ev)\n            terminalForwarded = true\n","            this.emit(turn, ev)\n"],
 ['X4-flag-error',C,"            error\n          })\n          terminalForwarded = true\n","            error\n          })\n"],
 ['X5-preabort',C,"      if (turn.controller.signal.aborted) {\n        deliverAbortTerminal()\n        return\n      }\n",""],
 ['X6-listener-unsub',C,"      turn.controller.signal.removeEventListener('abort', abortRuntime)\n",""],
 ['X7-abortTurn-dedup',A,"  if (cause !== 'user_cancelled' || !turn.live?.cancelled) turn.live?.markAborted?.(cause)","  turn.live?.markAborted?.(cause)"],
 ['X8-helper-ack-write',C,"      turn.abortAcknowledged = true\n      terminalForwarded = true\n","      terminalForwarded = true\n"],
 ['X9-helper-reads-ack',C,"terminalForwarded || turn.abortAcknowledged) return","terminalForwarded) return"],
 ['X10-reason-swap',C,"        reason: 'interrupted'\n      })\n      turn.abortAcknowledged","        reason: 'user_cancelled'\n      })\n      turn.abortAcknowledged"],
 ['X11-order-finalize-before-settle',C,"      settleOpenToolRuns(\n        turn,\n        this.settleEmit,\n        'aborted',\n        turn.dbSessionId ? this.deps.backgroundTasks.getState?.(turn.dbSessionId) : undefined\n      )\n      try {\n        persist.finalizeTurn?.(turn)","      try {\n        persist.finalizeTurn?.(turn)\n        settleOpenToolRuns(turn, this.settleEmit, 'aborted', turn.dbSessionId ? this.deps.backgroundTasks.getState?.(turn.dbSessionId) : undefined)"],
 ['X12-catch-requires-cancelled',C,"        } catch (err) {\n          if (turn.controller.signal.aborted) {","        } catch (err) {\n          if (runtime.cancelled === true && turn.controller.signal.aborted) {"],
]
const out=[]
for (const [id,f,b,a] of M){
  const p=`${APP}/${f}`; const orig=fs.readFileSync(p,'utf8')
  const n=orig.split(b).length-1
  if(n!==1){out.push({id,error:'anchor count '+n});console.log(id,'ANCHOR',n);continue}
  try{
    fs.writeFileSync(p,orig.replace(b,a))
    const r=spawnSync('./node_modules/.bin/vitest',['run',...TESTS,'--reporter=json','--outputFile='+OUT],{cwd:APP,encoding:'utf8',timeout:300000})
    const j=JSON.parse(fs.readFileSync(OUT,'utf8'))
    const failed=j.testResults.flatMap(s=>s.assertionResults.filter(c=>c.status==='failed').map(c=>c.fullName))
    const suiteErr=j.testResults.filter(s=>s.status==='failed'&&s.assertionResults.length===0).map(s=>s.name)
    const rec={id,exit:r.status,tests:j.numTotalTests,failed:j.numFailedTests,failedTests:failed,suiteErr}
    out.push(rec); console.log(id,'exit',r.status,'total',j.numTotalTests,'failed',j.numFailedTests, failed.map(s=>s.slice(0,110)).join(' | '), suiteErr.join(','))
  } finally { fs.writeFileSync(p,orig) }
}
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname),'verify-r1-mutations.json'),JSON.stringify(out,null,2))
