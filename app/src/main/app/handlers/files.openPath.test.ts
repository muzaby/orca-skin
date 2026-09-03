// 0211 ΔV5 AT-68 / VP-69 — `orca:files:openPath` 의 파일 reveal 모드 (D-108 · §10 EP-44).
//
// **거부 케이스가 이 스위트의 보안 축이다.** "파일을 연다" 만 재면 임의 경로 오픈 벡터가
// 열린다 — 이 핸들러는 지금까지 디렉토리 전용이라 그 벡터를 구조적으로 막고 있었고, 이번에
// 그 자리를 넓힌다. 그래서 허용 1건마다 거부 2건(`..` 이탈 · 무관 경로)을 함께 센다.
//
// 화이트리스트를 **새로 쓰지 않는다**는 것도 여기서 잰다: reveal 은 부모 디렉토리로 같은
// 판정을 돌리므로, 그 디렉토리가 세션 cwd 로 등록돼 있지 않으면 파일도 거부된다.

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'

const handlers = vi.hoisted(() => new Map<string, (event: unknown, raw: unknown) => unknown>())
const shellCalls = vi.hoisted(() => ({ openPath: [] as string[], reveal: [] as string[] }))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, listener: (event: unknown, raw: unknown) => unknown) => {
      handlers.set(channel, listener)
    })
  },
  BrowserWindow: { fromWebContents: vi.fn() },
  Notification: { isSupported: () => false },
  dialog: { showOpenDialog: vi.fn() },
  shell: {
    openPath: vi.fn(async (path: string) => {
      shellCalls.openPath.push(path)
      return ''
    }),
    showItemInFolder: vi.fn((path: string) => {
      shellCalls.reveal.push(path)
    })
  }
}))

const { registerFilesHandlers } = await import('./files')

const ROOT = mkdtempSync(join(tmpdir(), 'orca-openpath-'))
const SESSION_CWD = join(ROOT, 'repo')
const OUTSIDE = join(ROOT, 'elsewhere')
mkdirSync(join(SESSION_CWD, 'src'), { recursive: true })
mkdirSync(OUTSIDE, { recursive: true })
const FILE_IN_REPO = join(SESSION_CWD, 'src', 'a.ts')
const FILE_OUTSIDE = join(OUTSIDE, 'secret.env')
writeFileSync(FILE_IN_REPO, 'export const a = 1\n')
writeFileSync(FILE_OUTSIDE, 'TOKEN=1\n')

function invoke(payload: unknown): Promise<unknown> {
  const listener = handlers.get(CHANNELS.filesOpenPath)
  if (!listener) throw new Error('filesOpenPath 핸들러가 등록되지 않았다')
  return Promise.resolve(listener({}, payload))
}

beforeEach(() => {
  handlers.clear()
  shellCalls.openPath = []
  shellCalls.reveal = []
  registerFilesHandlers({
    getCwd: () => SESSION_CWD,
    db: { hasSessionWithCwd: (cwd: string) => cwd === SESSION_CWD }
  } as never)
})

describe('reveal 모드 — 세션 cwd 안의 파일만', () => {
  it('세션 cwd 하위 파일을 탐색기에서 선택해 연다', async () => {
    await invoke({ path: FILE_IN_REPO, mode: 'reveal' })

    expect(shellCalls.reveal).toEqual([FILE_IN_REPO])
    // 디렉토리 열기 경로는 타지 않는다 — 두 모드가 섞이면 파일이 열리는 대신 폴더가 열린다.
    expect(shellCalls.openPath).toEqual([])
  })

  it('세션과 무관한 경로의 파일은 거부한다', async () => {
    await expect(invoke({ path: FILE_OUTSIDE, mode: 'reveal' })).rejects.toThrow('허용되지 않은')
    expect(shellCalls.reveal).toEqual([])
  })

  it('`..` 로 빠져나가는 경로는 거부한다 — 부모가 세션 cwd 로 정규화되지 않는다', async () => {
    const escaped = join(SESSION_CWD, '..', 'elsewhere', 'secret.env')

    await expect(invoke({ path: escaped, mode: 'reveal' })).rejects.toThrow('허용되지 않은')
    expect(shellCalls.reveal).toEqual([])
  })

  it('디렉토리를 reveal 로 부르면 거부한다 — 모드가 실체를 말한다', async () => {
    await expect(invoke({ path: SESSION_CWD, mode: 'reveal' })).rejects.toThrow('파일만')
    expect(shellCalls.reveal).toEqual([])
  })

  it('없는 파일은 거부한다 — 삭제된 파일을 눌러도 조용히 실패하지 않는다', async () => {
    await expect(
      invoke({ path: join(SESSION_CWD, 'src', 'gone.ts'), mode: 'reveal' })
    ).rejects.toThrow('파일만')
  })
})

describe('directory 모드 회귀 — 기존 동작이 그대로다', () => {
  it('세션 cwd 디렉토리를 연다', async () => {
    await invoke({ path: SESSION_CWD, mode: 'directory' })

    expect(shellCalls.openPath).toEqual([SESSION_CWD])
    expect(shellCalls.reveal).toEqual([])
  })

  it('파일을 directory 로 부르면 거부한다', async () => {
    await expect(invoke({ path: FILE_IN_REPO, mode: 'directory' })).rejects.toThrow('디렉토리만')
  })

  it('세션과 무관한 디렉토리는 거부한다', async () => {
    await expect(invoke({ path: OUTSIDE, mode: 'directory' })).rejects.toThrow('허용되지 않은')
  })
})
