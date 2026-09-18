import { connect as connectNet } from 'node:net'
import { connect as connectTls, type TlsOptions } from 'node:tls'

export interface Pop3SocketOptions {
  readonly host: string
  readonly port: number
  readonly tls: boolean
  readonly tlsOptions?: TlsOptions
  readonly servername?: string
  readonly timeoutMs?: number
}

export interface Pop3Socket {
  on(event: string, listener: (...args: unknown[]) => void): this
  once(event: string, listener: (...args: unknown[]) => void): this
  removeListener(event: string, listener: (...args: unknown[]) => void): this
  write(chunk: string | Uint8Array): boolean
  destroy(): void
  setTimeout?(timeout: number): void
}

export function createPop3Socket(options: Pop3SocketOptions): Pop3Socket {
  const { host, port, tls, tlsOptions, servername, timeoutMs } = options
  const connectionOptions: TlsOptions & { host: string; port: number } = {
    host,
    port,
    ...(servername ? { servername } : {}),
    ...(tlsOptions ? { ...tlsOptions, pskCallback: undefined } : {})
  }
  const socket = tls
    ? connectTls(connectionOptions as unknown as Parameters<typeof connectTls>[0])
    : connectNet(connectionOptions)
  if (timeoutMs !== undefined && 'setTimeout' in socket) {
    socket.setTimeout(timeoutMs)
  }
  return socket
}
