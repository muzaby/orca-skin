import Database from 'better-sqlite3'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { nativeSchemaSql } from './legacy-schema.testfixture'
import { probeNativeCursor } from './native-cursor'
import { openFileDatabase } from '../../../infra/db/file-database'

let root: string
let file: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-native-cursor-'))
  file = join(root, 'opencode.db')
  const db = new Database(file)
  db.exec(nativeSchemaSql.join(';'))
  db.exec(
    "INSERT INTO project(id,worktree,time_created,time_updated,sandboxes) VALUES ('p','C:/work',1,1,'[]')"
  )
  const insert = db.prepare(
    "INSERT INTO session(id,project_id,slug,directory,title,version,time_created,time_updated) VALUES (?, 'p', 'slug', 'C:/work', 'title', '1.19.0', 1, 1)"
  )
  insert.run('s')
  insert.run('other')
  db.exec(
    "INSERT INTO event_sequence VALUES ('s', 4, NULL); INSERT INTO message VALUES ('m','s',1,1,'{}'); INSERT INTO part VALUES ('part','m','s',1,1,'{}')"
  )
  db.close()
})
afterEach(() => rmSync(root, { recursive: true, force: true }))
const probe = (): ReturnType<typeof probeNativeCursor> =>
  probeNativeCursor(openFileDatabase, file, 's')

it('reads the actual native schema without writes or initialization', () => {
  const before = readFileSync(file)
  const initialize = vi.fn()
  const readonly = openFileDatabase(file, { readonly: true, fileMustExist: true, initialize })
  expect(() => readonly.exec("UPDATE session SET title = 'changed'")).toThrow()
  expect(readonly.pragma('journal_mode', { simple: true })).toBe('delete')
  readonly.close()
  expect(initialize).not.toHaveBeenCalled()
  expect(probe()).toMatchObject({
    kind: 'opencode-sqlite',
    sequence: 4,
    digest: expect.any(String)
  })
  expect(probe()).toEqual(probe())
  expect(readFileSync(file)).toEqual(before)
})

it.each([
  "INSERT INTO message VALUES ('new','s',2,2,'{}')",
  "UPDATE part SET data = '{edited}' WHERE id = 'part'",
  "DELETE FROM part WHERE id = 'part'",
  "UPDATE session SET revert = '{reverted}' WHERE id = 's'",
  "DELETE FROM message WHERE id = 'm'"
])('detects projection mutation without advancing event sequence: %s', (sql) => {
  const before = probe()
  const db = new Database(file)
  db.exec(sql)
  db.close()
  const after = probe()
  expect(after?.sequence).toBe(before?.sequence)
  expect(after?.digest).not.toBe(before?.digest)
})

it('isolates other sessions and falls back when a required schema changes', () => {
  const before = probe()
  const db = new Database(file)
  db.exec("UPDATE session SET title='elsewhere' WHERE id='other'")
  expect(probe()).toEqual(before)
  db.exec('DROP TABLE part')
  db.close()
  expect(probe()).toBeUndefined()
})
