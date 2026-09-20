import { connect as connectNet, isIP } from 'node:net'
import { connect as connectTls, type ConnectionOptions, type TlsOptions } from 'node:tls'
import { Pop3Error } from './pop3-errors'

export interface Pop3SocketOptions {
  readonly host: string
  readonly port?: number
  readonly tls?: boolean
  readonly tlsOptions?: TlsOptions
  readonly servername?: string
  readonly timeoutMs?: number
  readonly connectTimeoutMs?: number
}

export interface Pop3Socket {
  on(event: string, listener: (...args: unknown[]) => void): this
  once(event: string, listener: (...args: unknown[]) => void): this
  removeListener(event: string, listener: (...args: unknown[]) => void): this
  write(chunk: string | Uint8Array): boolean
  destroy(): void
  setTimeout?(timeout: number): void
}

export type Pop3SocketFactory = (options: Pop3SocketOptions) => Pop3Socket

// Allow trust material and client certificates; never custom verification, contexts,
// ciphers, destination/socket overrides, PSK, or legacy protocol negotiation.
const SAFE_TLS_KEYS = new Set([
  'ca',
  'cert',
  'key',
  'pfx',
  'passphrase',
  'crl',
  'rejectUnauthorized',
  'minVersion',
  'maxVersion'
])

export function createPop3Socket(options: Pop3SocketOptions): Pop3Socket {
  const { host, tlsOptions } = options
  const tls = options.tls ?? true
  const port = options.port ?? (tls ? 995 : 110)
  if (!host || /[\s\0]/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Pop3Error('connection_failed')
  }
  if (
    tlsOptions &&
    (Object.keys(tlsOptions).some((key) => !SAFE_TLS_KEYS.has(key)) ||
      tlsOptions.rejectUnauthorized === false ||
      (tlsOptions.minVersion !== undefined &&
        !['TLSv1.2', 'TLSv1.3'].includes(tlsOptions.minVersion)) ||
      (tlsOptions.maxVersion !== undefined &&
        !['TLSv1.2', 'TLSv1.3'].includes(tlsOptions.maxVersion)))
  )
    throw new Pop3Error('tls_failed')

  const servername = options.servername ?? (isIP(host) ? undefined : host)
  if (servername !== undefined && (!servername || /[\s\0]/.test(servername) || isIP(servername))) {
    throw new Pop3Error('tls_failed')
  }
  const connectionOptions: ConnectionOptions = {
    ca: tlsOptions?.ca,
    cert: tlsOptions?.cert,
    key: tlsOptions?.key,
    pfx: tlsOptions?.pfx,
    passphrase: tlsOptions?.passphrase,
    crl: tlsOptions?.crl,
    maxVersion: tlsOptions?.maxVersion,
    host,
    port,
    ...(servername ? { servername } : {}),
    rejectUnauthorized: true,
    minVersion: tlsOptions?.minVersion ?? 'TLSv1.2'
  }
  // Session deadlines cover whole operations, unlike socket idle timeouts.
  return tls ? connectTls(connectionOptions) : connectNet({ host, port })
}
