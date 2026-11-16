// 셸 서비스 왕복 (0324 EP-10 · VP-25 · AC27).
//
// 호스트 쪽 클라이언트와 셸 쪽 서버를 한 채널로 묶는다 — 메시지는 실제 스키마(`HostToShellSchema`·
// `ShellToHostSchema`)를 지난다. 이름마다 왕복 1회와 실패 분기를 본다.

import { describe, expect, it } from 'vitest'
import {
  HostToShellSchema,
  ShellToHostSchema,
  type ShellToHost
} from '../../../shared/host-protocol'
import { SHELL_SERVICE_ARGS, type ShellServiceImpl } from '../../../shared/shell-services'
import { createShellClient } from '../agent-host/shell-client'
import { connectShellServicesInProcess, createShellServiceServer } from './services'

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

function fakeImpl(calls: Array<[string, unknown[]]>): ShellServiceImpl {
  const record =
    <T>(name: string, value: T) =>
    (...args: unknown[]): T => {
      calls.push([name, args])
      return value
    }
  return {
    'secrets.isAvailable': record('secrets.isAvailable', true),
    'secrets.encrypt': record('secrets.encrypt', 'Y2lwaGVy'),
    'secrets.decrypt': record('secrets.decrypt', 'plain'),
    'dialog.showOpen': async (...args) => {
      calls.push(['dialog.showOpen', args])
      return { canceled: false, filePaths: ['/a', '/b'] }
    },
    'dialog.showSave': async (...args) => {
      calls.push(['dialog.showSave', args])
      return { canceled: false, filePath: '/out.txt' }
    },
    'external.openExternal': async (...args) => {
      calls.push(['external.openExternal', args])
    },
    'external.openPath': async (...args) => {
      calls.push(['external.openPath', args])
      return ''
    },
    'external.showItemInFolder': record('external.showItemInFolder', undefined),
    'external.trashItem': async (...args) => {
      calls.push(['external.trashItem', args])
    },
    'notify.show': record('notify.show', undefined)
  }
}

// 클라이언트 → (HostToShell 검증) → 서버 → (ShellToHost 검증) → 클라이언트.
function connect(impl: ShellServiceImpl): {
  client: ReturnType<typeof createShellClient>
  replies: ShellToHost[]
  errors: Array<[string, unknown]>
  server: ReturnType<typeof createShellServiceServer>
} {
  const replies: ShellToHost[] = []
  const errors: Array<[string, unknown]> = []
  let client: ReturnType<typeof createShellClient> | null = null
  const server = createShellServiceServer({
    impl,
    reply: (message) => {
      const parsed = ShellToHostSchema.parse(message)
      replies.push(parsed)
      client!.receive(parsed)
    },
    onError: (name, error) => errors.push([name, error])
  })
  client = createShellClient({
    post: (message) => {
      const parsed = HostToShellSchema.parse(message)
      if (parsed.type === 'service.call') void server(parsed)
    }
  })
  return { client, replies, errors, server }
}

describe('셸 서비스 — 이름마다 왕복', () => {
  it('표의 이름은 10개다 — 테스트가 모든 이름을 부른다', () => {
    expect(Object.keys(SHELL_SERVICE_ARGS).sort()).toEqual(
      [
        'dialog.showOpen',
        'dialog.showSave',
        'external.openExternal',
        'external.openPath',
        'external.showItemInFolder',
        'external.trashItem',
        'notify.show',
        'secrets.decrypt',
        'secrets.encrypt',
        'secrets.isAvailable'
      ].sort()
    )
  })

  it('인자는 그대로 셸 구현에 가고 결과는 그대로 호스트에 돌아온다', async () => {
    const calls: Array<[string, unknown[]]> = []
    const { client } = connect(fakeImpl(calls))
    const open = { clientId: 7, properties: ['openFile' as const], defaultPath: '/w' }
    const results = await Promise.all([
      client.call('secrets.isAvailable'),
      client.call('secrets.encrypt', 'p@ss'),
      client.call('secrets.decrypt', 'Y2lwaGVy'),
      client.call('dialog.showOpen', open),
      client.call('dialog.showSave', { clientId: null, defaultPath: 'a.md' }),
      client.call('external.openExternal', 'https://example.com/x'),
      client.call('external.openPath', '/tmp/f'),
      client.call('external.showItemInFolder', '/tmp/g'),
      client.call('external.trashItem', '/tmp/h'),
      client.call('notify.show', { clientId: 3, title: '완료', body: '응답 완료' })
    ])
    expect(results).toEqual([
      true,
      'Y2lwaGVy',
      'plain',
      { canceled: false, filePaths: ['/a', '/b'] },
      { canceled: false, filePath: '/out.txt' },
      undefined,
      '',
      undefined,
      undefined,
      undefined
    ])
    expect(calls).toEqual([
      ['secrets.isAvailable', []],
      ['secrets.encrypt', ['p@ss']],
      ['secrets.decrypt', ['Y2lwaGVy']],
      ['dialog.showOpen', [open]],
      ['dialog.showSave', [{ clientId: null, defaultPath: 'a.md' }]],
      ['external.openExternal', ['https://example.com/x']],
      ['external.openPath', ['/tmp/f']],
      ['external.showItemInFolder', ['/tmp/g']],
      ['external.trashItem', ['/tmp/h']],
      ['notify.show', [{ clientId: 3, title: '완료', body: '응답 완료' }]]
    ])
  })

  it('응답은 요청 번호로 짝짓는다 — 늦게 끝난 요청이 다른 요청의 값을 받지 않는다', async () => {
    let releaseFirst: (value: { canceled: boolean; filePaths: string[] }) => void = () => {}
    const impl = fakeImpl([])
    impl['dialog.showOpen'] = () =>
      new Promise((resolve) => {
        releaseFirst = resolve
      })
    const { client } = connect(impl)
    const slow = client.call('dialog.showOpen', { clientId: null, properties: ['openFile'] })
    const fast = await client.call('secrets.decrypt', 'x')
    releaseFirst({ canceled: true, filePaths: [] })
    expect(fast).toBe('plain')
    await expect(slow).resolves.toEqual({ canceled: true, filePaths: [] })
  })
})

describe('셸 서비스 — 실패', () => {
  it('셸 구현이 던지면 그 오류로 거부하고 셸 로그에 남긴다', async () => {
    const impl = fakeImpl([])
    impl['secrets.encrypt'] = () => {
      throw new Error('키체인 잠김')
    }
    const { client, errors } = connect(impl)
    await expect(client.call('secrets.encrypt', 'p')).rejects.toThrow('Error: 키체인 잠김')
    expect(errors.map(([name]) => name)).toEqual(['secrets.encrypt'])
  })

  it('셸 구현이 거부해도 같다', async () => {
    const impl = fakeImpl([])
    impl['external.trashItem'] = async () => {
      throw new TypeError('없는 파일')
    }
    const { client } = connect(impl)
    await expect(client.call('external.trashItem', '/x')).rejects.toThrow('TypeError: 없는 파일')
  })

  it('인자가 스키마에 맞지 않으면 구현을 부르지 않고 거부한다', async () => {
    const calls: Array<[string, unknown[]]> = []
    const { server, replies, errors } = connect(fakeImpl(calls))
    await server({ id: 9, name: 'external.openExternal', args: ['not a url'] })
    await server({ id: 10, name: 'external.openPath', args: [''] })
    await server({ id: 11, name: 'secrets.decrypt', args: [] })
    expect(calls).toEqual([])
    expect(errors).toEqual([])
    expect(replies).toEqual([
      {
        type: 'service.result',
        id: 9,
        ok: false,
        error: '셸 서비스 인자가 틀렸다: external.openExternal'
      },
      {
        type: 'service.result',
        id: 10,
        ok: false,
        error: '셸 서비스 인자가 틀렸다: external.openPath'
      },
      {
        type: 'service.result',
        id: 11,
        ok: false,
        error: '셸 서비스 인자가 틀렸다: secrets.decrypt'
      }
    ])
  })

  it('셸 구현에는 스키마가 정한 키만 간다 — 선언 밖 옵션은 Electron 에 닿지 않는다', async () => {
    const calls: Array<[string, unknown[]]> = []
    const { server, replies } = connect(fakeImpl(calls))
    await server({
      id: 3,
      name: 'dialog.showOpen',
      args: [{ clientId: null, properties: ['openFile'], securityScopedBookmarks: true }]
    })
    expect(calls).toEqual([['dialog.showOpen', [{ clientId: null, properties: ['openFile'] }]]])
    expect(replies[0]).toMatchObject({ id: 3, ok: true })
  })

  it('모르는 이름은 거부한다 — 객체 원형의 이름도 모르는 이름이다', async () => {
    const { server, replies } = connect(fakeImpl([]))
    await server({ id: 1, name: 'app.quit', args: [] })
    await server({ id: 2, name: 'toString', args: [] })
    expect(replies).toEqual([
      { type: 'service.result', id: 1, ok: false, error: '모르는 셸 서비스: app.quit' },
      { type: 'service.result', id: 2, ok: false, error: '모르는 셸 서비스: toString' }
    ])
  })
})

describe('셸 서비스 클라이언트', () => {
  it('연결이 끊기면 기다리는 호출과 이후 호출을 그 이유로 거부한다', async () => {
    const posted: unknown[] = []
    const client = createShellClient({ post: (message) => posted.push(message) })
    const waiting = client.call('secrets.isAvailable')
    client.close('셸 연결 끊김')
    client.close('두 번째')
    await expect(waiting).rejects.toThrow('셸 연결 끊김')
    await expect(client.call('secrets.isAvailable')).rejects.toThrow('셸 연결 끊김')
    expect(posted).toHaveLength(1)
  })

  it('모르는 번호의 응답은 무시하고, 자기 몫이 아닌 메시지는 false 다', async () => {
    const client = createShellClient({ post: () => {} })
    const waiting = client.call('secrets.decrypt', 'x')
    expect(client.receive({ type: 'service.result', id: 5, ok: true, value: 'stale' })).toBe(true)
    expect(client.receive({ type: 'shutdown' })).toBe(false)
    client.receive({ type: 'service.result', id: 0, ok: true, value: 'real' })
    await expect(waiting).resolves.toBe('real')
  })

  it('실패 응답에 오류 문장이 없으면 기본 문장으로 거부한다', async () => {
    const client = createShellClient({ post: () => {} })
    const waiting = client.call('secrets.decrypt', 'x')
    client.receive({ type: 'service.result', id: 0, ok: false })
    await expect(waiting).rejects.toThrow('셸 서비스 실패')
  })

  it('wake 는 원인과 함께 구독자 전부에 알리고, 해제한 구독자는 받지 않는다', async () => {
    const client = createShellClient({ post: () => {} })
    const a: string[] = []
    const b: string[] = []
    const offA = client.onWake((reason) => a.push(reason))
    client.onWake((reason) => b.push(reason))
    expect(client.receive({ type: 'wake', reason: 'resume' })).toBe(true)
    offA()
    client.receive({ type: 'wake', reason: 'window-focus' })
    await flush()
    expect(a).toEqual(['resume'])
    expect(b).toEqual(['resume', 'window-focus'])
  })
})

describe('한 프로세스 연결', () => {
  it('같은 검증을 거쳐 셸 구현을 부르고 오류를 같은 문장으로 돌려준다', async () => {
    const calls: Array<[string, unknown[]]> = []
    const impl = fakeImpl(calls)
    impl['external.openExternal'] = () => {
      throw new Error('막힘')
    }
    const errors: string[] = []
    const port = connectShellServicesInProcess(impl, (name) => errors.push(name))
    await expect(port.call('secrets.decrypt', 'Y2lwaGVy')).resolves.toBe('plain')
    await expect(port.call('external.openExternal', 'https://example.com')).rejects.toThrow(
      'Error: 막힘'
    )
    await expect(port.call('external.openPath', '' as unknown as string)).rejects.toThrow(
      '셸 서비스 인자가 틀렸다: external.openPath'
    )
    expect(calls).toEqual([['secrets.decrypt', ['Y2lwaGVy']]])
    expect(errors).toEqual(['external.openExternal'])
  })
})
