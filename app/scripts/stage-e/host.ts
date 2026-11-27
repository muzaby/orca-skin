import Database from 'better-sqlite3'
import { HistoryIndex } from '../../src/main/features/history/turn-index'
import { CHANNELS } from '../../src/shared/ipc'
import { ClientToHostSchema } from '../../src/shared/host-protocol'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createPortTransport } from '../../src/main/app/host-port-server'
import { wrapPort, type ParentPort } from '../../src/main/app/host-runtime'
import { registerSessionLoadHandlers } from '../../src/main/app/data-host/session-load'
import { migrationRecorder, readAppliedMigrations } from '../../src/main/infra/db/migration-meta'
import { DbQueries } from '../../src/main/infra/db/queries'
import { setIpcTransport } from '../../src/main/infra/ipc/transport'

const [fixture, migrations, size, mode] = process.argv.slice(2)
const file = join(fixture, 'old.db')
const sessions = size === 'long' ? 200 : 20
const targetMessages = size === 'long' ? 100000 : 100
const parent = (process as typeof process & { parentPort: ParentPort }).parentPort
const seed = new Database(file)
seed.pragma('journal_mode = WAL')
seed.pragma('foreign_keys = ON')
readAppliedMigrations(seed)
const record = migrationRecorder(seed)
for (const name of readdirSync(migrations)
  .filter((name) => /^\d{4}_.*\.sql$/.test(name) && name < '0037')
  .sort()) {
  seed.transaction(() => {
    seed.exec(readFileSync(join(migrations, name), 'utf8'))
    record(name.slice(0, -4))
  })()
}

const session = seed.prepare(
  "INSERT INTO sessions (id, backend, title, created_at, updated_at) VALUES (?, 'claude', 'Q10', 1, ?)"
)
const snapshot = seed.prepare(
  'INSERT INTO native_history_snapshots (session_id, payload_json, local_frontier, synced_at) VALUES (?, ?, 0, 1)'
)
const search = seed.prepare(
  'INSERT INTO native_history_messages (session_id, native_id, role, created_at, content) VALUES (?, ?, ?, ?, ?)'
)
seed.transaction(() => {
  for (let i = 0; i < sessions; i++) {
    const id = 'session-' + i
    session.run(id, i + 1)
    const count = i === 0 ? targetMessages : 100
    const messages = Array.from({ length: count }, (_, j) => {
      const role = j % 2 === 0 ? 'user' : 'assistant'
      const text = 'fixture message ' + j
      const key = 'native-' + j
      search.run(id, key, role, j, text)
      return { id: key, role, createdAt: j, parts: [{ type: 'text', text }] }
    })
    snapshot.run(id, JSON.stringify({ messages }))
  }
})()
seed.close()

const db = new Database(file)
db.pragma('foreign_keys = ON')
db.pragma('synchronous = NORMAL')
const oldDisk = diskBytes()
if (mode === 'projection') {
  for (const name of readdirSync(migrations)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name) && name >= '0037')
    .sort()) {
    db.transaction(() => {
      db.exec(readFileSync(join(migrations, name), 'utf8'))
      migrationRecorder(db)(name.slice(0, -4))
    })()
  }
}
const queries = new DbQueries(db)
const index = mode === 'projection' ? new HistoryIndex(queries) : undefined
let backgroundStarted = false
const transport = createPortTransport()
setIpcTransport(transport)
registerSessionLoadHandlers({ db: queries, getCwd: () => fixture }, { historyIndex: index })
const getSnapshot = queries.nativeHistory.get.bind(queries.nativeHistory)
const payloads: string[] = []
let backgroundPayloadBytes = 0
queries.nativeHistory.get = (id) => {
  const row = getSnapshot(id)
  if (row && id === 'session-0') payloads.push(row.payload_json)
  else if (row) backgroundPayloadBytes += Buffer.byteLength(row.payload_json)
  return row
}
// Size the load envelopes after the timed operation. The store can start refresh two
// frames later; counting that reply here would change the baseline with frame timing.
const frames: unknown[] = []
let loadRequest: { id: number; bytes: number } | undefined
function diskBytes(): { db: number; wal: number } {
  const wal = file + '-wal'
  return { db: statSync(file).size, wal: existsSync(wal) ? statSync(wal).size : 0 }
}
let before = oldDisk
let prepared: unknown
let readBodyBytes = 0
const parts = queries.historyIndex.parts.bind(queries.historyIndex)
queries.historyIndex.parts = (id, gen, h) => {
  readBodyBytes += h.part_count ? h.body_bytes : 0
  return parts(id, gen, h)
}
parent.on('message', ({ data, ports }) => {
  if (data === 'metrics') {
    const after = diskBytes()
    parent.postMessage({
      sessions,
      prepared,
      readBodyBytes,
      backgroundPayloadBytes,
      before,
      after,
      readerPayloadBytes: payloads.reduce(
        (total, payload) => total + Buffer.byteLength(payload),
        0
      ),
      requestJsonBytes: loadRequest?.bytes,
      replyJsonBytes: frames.reduce<number>(
        (total, frame) => total + Buffer.byteLength(JSON.stringify(frame)),
        0
      ),
      replyFrames: frames.length
    })
    before = after
    frames.length = 0
    payloads.length = 0
    loadRequest = undefined
    prepared = undefined
    readBodyBytes = 0
    backgroundPayloadBytes = 0
    return
  }
  const port = wrapPort(ports[0])
  transport.connect(
    {
      ...port,
      onMessage(listener) {
        port.onMessage((message) => {
          const input = ClientToHostSchema.safeParse(message)
          if (
            input.success &&
            input.data.kind === 'invoke' &&
            (input.data.channel === CHANNELS.sessionLoad ||
              input.data.channel === CHANNELS.sessionHistoryPage)
          ) {
            loadRequest = { id: input.data.id, bytes: Buffer.byteLength(JSON.stringify(message)) }
          }
          listener(message)
          if (index && loadRequest && !backgroundStarted) {
            backgroundStarted = true
            index.startBackground()
          }
        })
      },
      post(frame) {
        if (
          (frame.kind === 'result' && frame.id === loadRequest?.id) ||
          (frame.kind === 'event' && frame.channel === CHANNELS.sessionLoadChunk)
        ) {
          frames.push(frame)
          if (frame.kind === 'result' && frame.ok)
            prepared = (frame.value as { prepared?: unknown } | null)?.prepared
        }
        port.post(frame)
      }
    },
    { clientId: 1, trusted: true }
  )
})
parent.postMessage('ready')
