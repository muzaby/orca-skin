// One-time implementation review inventory. Run at the repository root.
// Exact source positions deliberately make later source drift fail visibly.
const { execFileSync } = require('node:child_process')
const { writeFileSync } = require('node:fs')
const queries = [
  ['isError|SubagentTaskStatus|TaskBoardStatus|isBackgroundTerminal\\(|projectBackgroundPanel\\(|canStopBackgroundTask\\(|backgroundElapsedSeconds\\(', 'app/src/renderer/src', ':!*.test.*', ':!app/src/renderer/src/shared/i18n/*'],
  ['hasPending|backgroundPending|haveTasks|lastSeenAt', 'app/src/main/app/chat-turn', 'app/src/main/features/chat/background-tasks.ts', 'app/src/shared/background-task.ts', ':!*.test.*'],
  ['reconcileSegments|toolCallEquals|resultEquals', 'app/src/renderer/src', ':!*.test.*'],
  ['settleOrphanToolRuns|tool.call.retracted|commitConsumed', 'app/src/main/features/chat/turn-coordinator.ts', 'app/src/main/adapters/claude-map.ts'],
  ['tool_result|tool.call.completed|nonExecution', 'app/src/main/adapters/claude-map.ts', 'app/src/main/features/history/writer.ts', 'app/src/shared/ipc.ts', 'app/src/renderer/src/features/chat/reducer/chatReducer.ts', 'app/src/renderer/src/features/chat/lib/parts.ts']
]
const classified = new Map()
const add = (file, lines, reason) => lines.forEach(line => classified.set(`${file}:${line}`, reason))
add('CanonicalBackgroundContent.tsx', [74,198,201,202], 'EP-06 projection / Stop / elapsed')
add('SubAgentTileContent.tsx', [26,59], 'EP-04 status type and label map')
add('SubAgentTileContent.tsx', [119], 'rev.3 excluded header projection: clear also clears selection')
add('TaskProgressList.tsx', [10,15], 'EP-04 progress labels')
add('TaskStatusIcon.tsx', [2,4,22], 'EP-04 status icon and tone')
add('AgentTaskRow.tsx', [6,8,18,55], 'EP-04 agent status and fallback')
add('ForegroundShellActions.tsx', [55,57], 'existing call.result / returned guards already hide actions after settlement')
add('ToolCard.tsx', [123,151,193], 'EP-04 result outcome drives header/body tone')
add('TaskToolBody.tsx', [40], 'EP-04 observation parser after non-execution guard')
add('backgroundPresentation.ts', [22,30], 'EP-06 Stop helper; caller additionally requires unsettled display')
add('canonicalBackground.ts', [63,79,92,173,283,295,300], 'EP-04/06 canonical status / detail transport / projection / elapsed')
add('parts.ts', [11,12,150,155,317,355,362,368,371], 'EP-04 shared result classification and agent summary')
add('parts.ts', [105,110,113,128,137,143], 'existing reload aborted synthesis, no non-execution producer or new status decision')
add('parts.ts', [186,187,219,222,223,513], 'EP-01 pairing and metadata validation')
add('parts.ts', [400], 'settlementMessageFromCall text extraction, no rendered status consumer')
add('parts.ts', [579,584,586,592,597,623,633,661], 'EP-10 result equality and tool/ask reconciliation')
add('taskBoard.ts', [34,58,243,263,297,313], 'EP-04 board status transport and existing actions')
add('taskBoard.ts', [190], 'TaskXXX list fold parser, not tool execution outcome')
add('workToolPresentation.ts', [67], 'EP-04 structured TaskXXX parser after non-execution guard')
add('chatReducer.ts', [79,81,978,980,983,984], 'EP-01 live result type and append')
add('chatReducer.ts', [992], 'artifact success gate; non-execution carries no artifact')
add('chatReducer.ts', [1914,1916,1923], 'TaskXXX settled-list notification, not tool execution outcome')
add('backgroundStore.ts', [67,102], 'EP-06 transcript binding before and after clear')
add('index.ts', [168], 'EP-05 Stop retention uses same pending predicate')
add('post-turn.ts', [109,114,127], 'EP-05/09 single pending value for decision and log')
add('background-tasks.ts', [18,61,63], 'EP-05 tracker delegates canonical pending')
add('background-tasks.ts', [188], 'legacy hasAny canonical alias delegates same predicate; no independent rule')
add('background-task.ts', [131,156,278,297,415], 'EP-06 time types / initial task / monotonic task and call producers')
add('background-task.ts', [568], 'EP-05 pending predicate')
add('AssistantMessage.tsx', [13,40], 'EP-10 transcript production reconciliation')
add('workActivity.ts', [4,59], 'EP-10 Work production reconciliation')
add('claude-map.ts', [131], 'EP-03 retraction event factory')
add('claude-map.ts', [240], 'result multiplicity guard for structured output')
add('claude-map.ts', [607,626,627,639,650], 'EP-01 SDK result metadata extraction and event transport')
add('turn-coordinator.ts', [30,399,406,532,544,548], 'EP-02 terminal settlement before commit / emit')
add('turn-coordinator.ts', [190,360], 'existing input commit helper and received-input branch')
add('turn-coordinator.ts', [352,353], 'EP-03 absorbs internal retraction')
add('writer.ts', [258], 'existing answered Ask synthesis; not an unexecuted tool')
add('writer.ts', [416,445], 'EP-01 persisted non-execution result')
add('ipc.ts', [622,640,1463,1476], 'EP-01 normalized and persisted result type')

const candidates = new Map()
for (const [pattern, ...paths] of queries) {
  const output = execFileSync('git', ['grep', '-n', '-E', pattern, '--', ...paths], {encoding:'utf8'})
  for (const row of output.trim().split('\n')) {
    const match = row.match(/^(.+?):(\d+):(.*)$/)
    if (!match) throw Error('unparsed candidate: ' + row)
    const [, file, line, source] = match
    candidates.set(`${file}:${line}`, {file, line:Number(line), source})
  }
}
const rows = [...candidates.values()].map(row => ({...row, reason: row.source.trim().startsWith('//') ? 'comment, not executable edge' : classified.get(`${row.file.split('/').pop()}:${row.line}`)}))
const classifiedIds = new Set(rows.filter(row => row.reason).map(row => `${row.file}:${row.line}`))
const difference = ids => [...candidates.keys()].filter(id => !ids.has(id))
const missing = difference(classifiedIds)
// New audit oracle sensitivity: omit an actual projection edge from classifications.
const omitted = 'app/src/renderer/src/features/chat/store/backgroundStore.ts:67'
const weakened = new Set(classifiedIds)
weakened.delete(omitted)
const mutationDifference = difference(weakened)
if (missing.length || mutationDifference.length !== 1 || mutationDifference[0] !== omitted)
  throw Error(JSON.stringify({missing, mutationDifference}))
const report = {queries, candidateCount:rows.length, missing, omittedClassification:omitted, mutationDifference, rows}
writeFileSync(__dirname + '/r1.3-enforcement-audit.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({candidateCount:rows.length, missing, mutationDifference}))
