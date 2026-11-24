import type { InstallStatus } from '../../../shared/ipc'

const INSTALL_LOG_BATCH_BYTES = 16 * 1024
const INSTALL_LOG_FLUSH_MS = 16

export async function forwardInstallStatus(
  statuses: AsyncIterable<InstallStatus>,
  send: (status: InstallStatus) => void
): Promise<void> {
  let pending: InstallStatus | undefined
  let bytes = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  function flush(): void {
    clearTimeout(timer)
    timer = undefined
    const status = pending
    pending = undefined
    bytes = 0
    if (status) send(status)
  }
  function append(source: Pick<InstallStatus, 'step' | 'progress'>, text: string): void {
    if (pending && (pending.step !== source.step || pending.progress !== source.progress)) flush()
    let begin = 0
    let offset = 0
    for (const char of text) {
      const charBytes = Buffer.byteLength(char)
      if (bytes + charBytes > INSTALL_LOG_BATCH_BYTES) {
        if (offset > begin) add(source, text.slice(begin, offset))
        flush()
        begin = offset
      }
      offset += char.length
      bytes += charBytes
    }
    if (offset > begin) add(source, text.slice(begin))
    if (bytes === INSTALL_LOG_BATCH_BYTES) flush()
    if (pending) timer ??= setTimeout(flush, INSTALL_LOG_FLUSH_MS)
  }
  function add(source: Pick<InstallStatus, 'step' | 'progress'>, log: string): void {
    if (!pending) pending = { ...source, log }
    else pending.log += log
  }
  try {
    for await (const status of statuses) {
      const { log, ...state } = status
      if (log) append({ step: state.step, progress: state.progress }, log)
      if (!log || state.error || state.done) {
        flush()
        send(state)
      }
      if (state.done) break
    }
  } finally {
    flush()
  }
}
