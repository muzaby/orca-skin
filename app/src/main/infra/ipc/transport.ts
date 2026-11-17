// 요청·통지의 전송 선택 (0324 EP-8·EP-9).
//
// 핸들러 등록(`handle.ts`)과 창 통지(`send.ts`)는 Electron 을 직접 물지 않고 여기서 고른 전송을
// 쓴다. 셸에서는 `ipcMain`/`webContents`(`electron-transport.ts`), 두 호스트에서는 창마다
// 하나씩 받은 포트(`app/host-port-server.ts` — `app/host-process.ts` 가 정한다)다. 프로세스마다
// 시작할 때 한 번 정한다.
//
// 이 파일은 electron 을 import 하지 않는다 — 호스트와 테스트가 그대로 import 한다.

// 요청을 보냈거나 통지를 받을 창 하나. `WebContents` 를 대신한다.
export interface ClientRef {
  // 같은 창이면 다시 연결돼도 같은 값이다(셸이 정한 창 id).
  readonly id: number
  // 닫힌 뒤의 전송은 조용히 버린다 — 호출자가 먼저 확인할 필요가 없다.
  send(channel: string, payload: unknown): void
  isClosed(): boolean
  // 창이 사라지거나(닫힘·renderer 종료) 문서가 새로 읽히면 한 번 부른다. 이미 닫혔으면 바로
  // 부른다. 반환값은 구독 해제다.
  onClosed(listener: () => void): () => void
}

export interface RequestEvent {
  readonly sender: ClientRef
  // 현재 앱 창의 신뢰한 최상위 문서가 보낸 요청인가(파일 작업 핸들러가 본다).
  readonly trusted: boolean
}

export type InvokeListener = (event: RequestEvent, raw: unknown) => unknown
export type SendListener = (event: RequestEvent, raw: unknown) => void

export interface IpcTransport {
  // 응답이 있는 요청. 같은 채널을 두 번 등록하면 던진다.
  handle(channel: string, listener: InvokeListener): void
  // 응답 없는 단방향 수신.
  on(channel: string, listener: SendListener): void
  // 지금 열려 있는 창 전부 — 방송 대상이다.
  clients(): readonly ClientRef[]
  // 한 창만 맡아야 하는 통지의 대상(먼저 열린 창). 없으면 undefined.
  primaryClient(): ClientRef | undefined
}

let current: IpcTransport | null = null

// 프로세스 시작 때 한 번 부른다. 테스트는 `null` 로 되돌린다.
export function setIpcTransport(transport: IpcTransport | null): void {
  current = transport
}

export function hasIpcTransport(): boolean {
  return current !== null
}

export function ipcTransport(): IpcTransport {
  if (!current) throw new Error('IPC 전송이 정해지지 않았다 — 프로세스 시작에서 setIpcTransport')
  return current
}

// 닫힘 통지를 한 번만, 늦게 구독한 쪽에도 전달하는 작은 상태. 전송 구현 둘이 함께 쓴다.
export class CloseSignal {
  private closed = false
  private readonly listeners = new Set<() => void>()

  isClosed(): boolean {
    return this.closed
  }

  // 아직 불리지 않은 구독 수.
  get pending(): number {
    return this.listeners.size
  }

  onClosed(listener: () => void): () => void {
    if (this.closed) {
      listener()
      return () => {}
    }
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    const pending = [...this.listeners]
    this.listeners.clear()
    for (const listener of pending) listener()
  }
}
