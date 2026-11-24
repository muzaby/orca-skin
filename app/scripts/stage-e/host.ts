import Database from 'better-sqlite3'
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

const [fixture, migrations, size] = process.argv.slice(2)
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
const queries = new DbQueries(db)
const transport = createPortTransport()
setIpcTransport(transport)
registerSessionLoadHandlers({ db: queries, getCwd: () => fixture })
const getSnapshot = queries.nativeHistory.get.bind(queries.nativeHistory)
const payloads: string[] = []
queries.nativeHistory.get = (id) => {
  const row = getSnapshot(id)
  if (row) payloads.push(row.payload_json)
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
const before = diskBytes()
parent.on('message', ({ data, ports }) => {
  if (data === 'metrics') {
    const after = diskBytes()
    parent.postMessage({
      sessions,
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
    db.close()
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
            input.data.channel === CHANNELS.sessionLoad
          ) {
            loadRequest = { id: input.data.id, bytes: Buffer.byteLength(JSON.stringify(message)) }
          }
          listener(message)
        })
      },
      post(frame) {
        if (
          (frame.kind === 'result' && frame.id === loadRequest?.id) ||
          (frame.kind === 'event' && frame.channel === CHANNELS.sessionLoadChunk)
        )
          frames.push(frame)
        port.post(frame)
      }
    },
    { clientId: 1, trusted: true }
  )
})
parent.postMessage('ready')
