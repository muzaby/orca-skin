import { describe, expect, it, vi } from 'vitest'
import { createSessionMetaCache, type SessionMetaRow } from './session-meta'

// 0324 EP-16′ — 실행 쪽 동기 판정이 읽는 세션 메타 사본.
type Row = SessionMetaRow & { id: string; agent_kind: string }
const row = (id: string, cwd: string, backend = 'claude'): Row => ({
  id,
  backend,
  cwd,
  project_id: `project-${id}`,
  agent_kind: 'code'
})

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}

describe('세션 메타 사본', () => {
  it('다시 읽으면 사본을 고치고, 없는 세션이면 지운다 — 바뀐 때만 알린다', async () => {
    const rows = new Map<string, Row>([['s1', row('s1', '/a')]])
    const changed = vi.fn()
    const meta = createSessionMetaCache<Row>({ read: async (id) => rows.get(id), changed })
    expect(meta.get('s1')).toBeUndefined()
    await expect(meta.refresh('s1')).resolves.toEqual(row('s1', '/a'))
    expect(meta.get('s1')).toEqual(row('s1', '/a'))
    expect(changed).toHaveBeenCalledTimes(1)
    // 같은 값 — 알리지 않는다.
    await meta.refresh('s1')
    expect(changed).toHaveBeenCalledTimes(1)
    // 작업 폴더가 바뀜 — 알린다.
    rows.set('s1', row('s1', '/b'))
    await meta.refresh('s1')
    expect(meta.get('s1')?.cwd).toBe('/b')
    expect(changed).toHaveBeenCalledTimes(2)
    // 세션이 사라짐 — 지우고 알린다.
    rows.delete('s1')
    await expect(meta.refresh('s1')).resolves.toBeUndefined()
    expect(meta.get('s1')).toBeUndefined()
    expect(changed).toHaveBeenCalledTimes(3)
  })

  it('늦게 도착한 옛 응답은 더 새 읽기를 덮지 않는다', async () => {
    const answers: Array<ReturnType<typeof deferred<Row | undefined>>> = []
    const meta = createSessionMetaCache<Row>({
      read: () => {
        const next = deferred<Row | undefined>()
        answers.push(next)
        return next.promise
      },
      changed: vi.fn()
    })
    const older = meta.refresh('s1')
    const newer = meta.refresh('s1')
    answers[1]!.resolve(row('s1', '/new'))
    await newer
    answers[0]!.resolve(row('s1', '/old'))
    await expect(older).resolves.toEqual(row('s1', '/new'))
    expect(meta.get('s1')?.cwd).toBe('/new')
  })

  it('잊은 세션은 진행 중이던 읽기가 되살리지 않는다', async () => {
    const answer = deferred<Row | undefined>()
    const meta = createSessionMetaCache<Row>({ read: () => answer.promise, changed: vi.fn() })
    const pending = meta.refresh('s1')
    meta.forget('s1')
    answer.resolve(row('s1', '/a'))
    await pending
    expect(meta.get('s1')).toBeUndefined()
  })

  it('ensure — 사본이 없는 세션만 읽는다', async () => {
    const read = vi.fn(async (id: string) => row(id, `/${id}`))
    const meta = createSessionMetaCache<Row>({ read, changed: vi.fn() })
    await meta.refresh('s1')
    read.mockClear()
    await meta.ensure(['s1', 's2', 's2'])
    expect(read.mock.calls).toEqual([['s2']])
    expect(meta.get('s2')?.cwd).toBe('/s2')
  })

  it('track — 새로 들어온 세션과 사본이 없는 세션을 읽고, 이미 따라가는 세션은 다시 읽지 않는다', async () => {
    const rows = new Map<string, Row>([['s1', row('s1', '/a')]])
    const read = vi.fn(async (id: string) => rows.get(id))
    const changed = vi.fn()
    const meta = createSessionMetaCache<Row>({ read, changed })
    meta.track(['s1', 'new'])
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(meta.get('s1')).toEqual(row('s1', '/a')))
    expect(changed).toHaveBeenCalledTimes(1)
    // 'new' 는 아직 행이 없다(첫 턴의 저장 전) — 다음 lease 변화에 다시 읽는다. 's1' 은 읽지 않는다.
    rows.set('new', row('new', '/n'))
    read.mockClear()
    meta.track(['s1', 'new'])
    await vi.waitFor(() => expect(meta.get('new')?.cwd).toBe('/n'))
    expect(read.mock.calls).toEqual([['new']])
    expect(changed).toHaveBeenCalledTimes(2)
    // 집합에서 빠졌다 다시 들어오면 새로 읽는다(그 사이 바뀌었을 수 있다).
    meta.track(['new'])
    rows.set('s1', row('s1', '/moved'))
    read.mockClear()
    meta.track(['new', 's1'])
    await vi.waitFor(() => expect(meta.get('s1')?.cwd).toBe('/moved'))
    expect(read.mock.calls).toEqual([['s1']])
  })

  it('track 의 읽기 실패는 알리고 사본을 그대로 둔다', async () => {
    const failed = vi.fn()
    const read = vi.fn(async (id: string): Promise<Row | undefined> => row(id, '/a'))
    const meta = createSessionMetaCache<Row>({ read, changed: vi.fn(), failed })
    await meta.refresh('s1')
    read.mockRejectedValueOnce(new Error('peer gone'))
    meta.forget('s1')
    meta.track(['s1'])
    await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce())
    expect(String(failed.mock.calls[0]![0])).toContain('peer gone')
    expect(meta.get('s1')).toBeUndefined()
  })
})
