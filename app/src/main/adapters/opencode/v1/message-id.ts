import { randomBytes } from 'node:crypto'

// OpenCode 1.x ascending ID format (MIT):
// https://github.com/anomalyco/opencode/blob/v1.19.0/packages/opencode/src/id/id.ts
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
let lastTimestamp = 0
let counter = 0

export function createOpenCodeMessageId(): string {
  const timestamp = Date.now()
  if (timestamp !== lastTimestamp) {
    lastTimestamp = timestamp
    counter = 0
  }
  counter++

  const value = BigInt(timestamp) * 0x1000n + BigInt(counter)
  const time = BigInt.asUintN(48, value).toString(16).padStart(12, '0')
  const suffix = Array.from(randomBytes(14), (byte) => BASE62[byte % 62]).join('')
  return `msg_${time}${suffix}`
}
