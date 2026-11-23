import { DIFF_MODEL_SYNC_MAX_LINES, DIFF_MODEL_SYNC_MAX_CHARS } from './limits'
// Count the supplied source, before packing introduces markers and newlines.
export function diffViewPath(source: string | readonly { text: string }[]): 'sync' | 'worker' {
  if (typeof source === 'string')
    return source.length <= DIFF_MODEL_SYNC_MAX_CHARS ? 'sync' : 'worker'
  if (source.length > DIFF_MODEL_SYNC_MAX_LINES) return 'worker'
  let chars = 0
  return source.some((row) => (chars += row.text.length) > DIFF_MODEL_SYNC_MAX_CHARS)
    ? 'worker'
    : 'sync'
}
