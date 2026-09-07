/** Internal v1 wire: ORCA + u32le version + u32le payload bytes (<= 1 MiB).
 * Payload: UTF-8 strings executable, cwd; u32 argc + argument strings;
 * u32 envc + key/value string pairs. Every string is u32 byte length + bytes.
 * Counts <= 4096. No NUL, invalid Unicode or payload trailing bytes are permitted.
 * Bytes after the frame belong exclusively to the target's stdin.
 */
export const LAUNCH_MARKER = 'orca-launch-v1'
export const MAX_PAYLOAD_BYTES = 1024 * 1024
export const MAX_FIELD_COUNT = 4096

const reserved = new Set([
  'SYSTEMROOT',
  'WINDIR',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'HOME',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMDATA',
  'TEMP',
  'TMP',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS',
  'REQUESTS_CA_BUNDLE',
  'CURL_CA_BUNDLE',
  'GIT_SSL_CAINFO',
  'GIT_SSL_CAPATH',
  'GIT_PROXY_COMMAND'
])
export const isReservedEnvironmentKey = (key) => {
  const upper = key.toUpperCase()
  return reserved.has(upper) || upper.startsWith('GIT_CONFIG') || upper.startsWith('SRT_')
}
const absoluteWindowsPath = (value) =>
  /^[A-Za-z]:[\\/]/.test(value) || /^\\\\(?![.?]\\)[^\\/]+[\\/][^\\/]+(?:[\\/]|$)/.test(value)

export function encodeLaunchFrame({ executable, cwd, args = [], env = {} }) {
  const chunks = []
  let size = 0
  const append = (value) => {
    size += value.length
    if (size > MAX_PAYLOAD_BYTES) throw new Error('FRAME_TOO_LARGE')
    chunks.push(value)
  }
  const integer = (value) => {
    const bytes = Buffer.alloc(4)
    bytes.writeUInt32LE(value)
    append(bytes)
  }
  const string = (value) => {
    if (typeof value !== 'string' || value.includes('\0') || !value.isWellFormed())
      throw new Error('INVALID_STRING')
    const bytes = Buffer.from(value, 'utf8')
    integer(bytes.length)
    append(bytes)
  }
  if (
    typeof executable !== 'string' ||
    !absoluteWindowsPath(executable) ||
    !/\.exe$/i.test(executable)
  )
    throw new Error('INVALID_EXECUTABLE')
  if (typeof cwd !== 'string' || !absoluteWindowsPath(cwd)) throw new Error('INVALID_CWD')
  if (!Array.isArray(args) || args.length > MAX_FIELD_COUNT) throw new Error('INVALID_ARG_COUNT')
  if (!env || typeof env !== 'object' || Array.isArray(env)) throw new Error('INVALID_ENV')
  const entries = Object.entries(env)
  if (entries.length > MAX_FIELD_COUNT) throw new Error('INVALID_ENV_COUNT')
  string(executable)
  string(cwd)
  integer(args.length)
  args.forEach(string)
  integer(entries.length)
  const keys = new Set()
  for (const [key, value] of entries) {
    if (!key || key.includes('=') || isReservedEnvironmentKey(key))
      throw new Error('INVALID_ENV_KEY')
    const folded = key.toUpperCase()
    if (keys.has(folded)) throw new Error('DUPLICATE_ENV_KEY')
    keys.add(folded)
    string(key)
    string(value)
  }
  const header = Buffer.alloc(12)
  header.write('ORCA', 0, 'ascii')
  header.writeUInt32LE(1, 4)
  header.writeUInt32LE(size, 8)
  return Buffer.concat([header, ...chunks])
}
