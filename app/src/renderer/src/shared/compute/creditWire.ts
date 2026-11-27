import { ChunkedText, readWireText, wireTextFor } from './chunkedText'
// Structured worker data on the Markdown/body paths is a tree of records, arrays and primitives.
// Independently bound string bytes and record count. Each direction has one outstanding frame.
export const WIRE_FRAME_CHARS = 16_384
export const WIRE_FRAME_TOKENS = 384

type Scalar = number | string | boolean | null | undefined
type Token =
  | ['value', Scalar]
  | ['key' | 'chunk', string]
  | ['object' | 'array' | 'end' | 'string' | 'longKey' | 'stringEnd']
type Frame = {
  channel: 'oo-frame'
  id: number
  index: number
  tokens: Token[]
  done: boolean
}
type Ack = { channel: 'oo-credit'; id: number; index: number }

function* stringTokens(
  text: string,
  key: boolean,
  read?: (start: number, end: number) => string
): Generator<Token> {
  if (text.length <= WIRE_FRAME_CHARS) {
    yield key ? ['key', text] : ['value', text]
    return
  }
  yield [key ? 'longKey' : 'string']
  for (let start = 0; start < text.length; start += WIRE_FRAME_CHARS) {
    const end = Math.min(text.length, start + WIRE_FRAME_CHARS)
    const chunk = read ? read(start, end) : text.slice(start, end)
    if (chunk.length !== end - start) throw Error('Incomplete worker source range')
    yield ['chunk', chunk]
  }
  yield ['stringEnd']
}

function* tokensFor(root: unknown): Generator<Token> {
  type Cursor =
    | { kind: 'value'; value: unknown }
    | { kind: 'array'; items: unknown[]; index: number }
    | { kind: 'object'; fields: Record<string, unknown>; keys: string[]; index: number }
  const stack: Cursor[] = [{ kind: 'value', value: root }]
  while (stack.length) {
    const cursor = stack[stack.length - 1]
    if (cursor.kind === 'value') {
      stack.pop()
      const { value } = cursor
      if (typeof value === 'string') yield* stringTokens(value, false)
      else if (value === null || typeof value !== 'object') {
        if (
          value === null ||
          value === undefined ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        )
          yield ['value', value]
        else throw Error('Unsupported worker value')
      } else if (Array.isArray(value)) {
        yield ['array']
        stack.push({ kind: 'array', items: value, index: 0 })
      } else {
        yield ['object']
        stack.push({
          kind: 'object',
          fields: value as Record<string, unknown>,
          keys: Object.keys(value),
          index: 0
        })
      }
    } else if (cursor.kind === 'array' && cursor.index < cursor.items.length)
      stack.push({ kind: 'value', value: cursor.items[cursor.index++] })
    else if (cursor.kind === 'object' && cursor.index < cursor.keys.length) {
      const key = cursor.keys[cursor.index++]
      yield* stringTokens(key, true)
      const value = cursor.fields[key]
      const read =
        key === 'text' && typeof value === 'string' ? readWireText.get(cursor.fields) : undefined
      if (read && typeof value === 'string') yield* stringTokens(value, false, read)
      else stack.push({ kind: 'value', value })
    } else {
      stack.pop()
      yield ['end']
    }
  }
}

type Container =
  | { kind: 'object'; value: Record<string, unknown>; key?: string }
  | { kind: 'array'; value: unknown[] }
class FrameReader {
  private readonly stack: Container[] = []
  private hasRoot = false
  private root: unknown
  private text: { value: string; key: boolean; pieces?: ChunkedText } | undefined

  private key(key: string): void {
    const parent = this.stack.at(-1)
    if (parent?.kind !== 'object' || parent.key !== undefined)
      throw Error('Unexpected worker property')
    parent.key = key
  }

  private value(value: unknown): void {
    const parent = this.stack.at(-1)
    if (!parent) {
      if (this.hasRoot) throw Error('Duplicate worker value')
      this.hasRoot = true
      this.root = value
    } else if (parent.kind === 'array') parent.value.push(value)
    else {
      if (parent.key === undefined || Object.hasOwn(parent.value, parent.key))
        throw Error('Invalid worker property')
      if (parent.key === '__proto__') {
        Object.defineProperty(parent.value, parent.key, {
          value,
          configurable: true,
          enumerable: true,
          writable: true
        })
      } else parent.value[parent.key] = value
      parent.key = undefined
    }
  }

  append(tokens: Token[]): void {
    if (tokens.length > WIRE_FRAME_TOKENS) throw Error('Oversized worker frame')
    let chars = 0
    for (const token of tokens) {
      if (!Array.isArray(token)) throw Error('Invalid worker token')
      const [tag, data] = token
      if (typeof data === 'string') chars += data.length
      if (chars > WIRE_FRAME_CHARS) throw Error('Oversized worker string frame')
      if (this.text) {
        if (tag === 'chunk' && typeof data === 'string') {
          this.text.value += data
          this.text.pieces?.append(data)
        } else if (tag === 'stringEnd') {
          const { value, key, pieces } = this.text
          const parent = this.stack.at(-1)
          if (pieces && parent?.kind === 'object') wireTextFor.set(parent.value, pieces)
          this.text = undefined
          if (key) this.key(value)
          else this.value(value)
        } else throw Error('Incomplete worker string')
        continue
      }
      if (tag === 'longKey' || tag === 'string') {
        const parent = this.stack.at(-1)
        this.text = {
          key: tag === 'longKey',
          value: '',
          pieces:
            tag === 'string' && parent?.kind === 'object' && parent.key === 'text'
              ? new ChunkedText()
              : undefined
        }
      } else if (tag === 'key' && typeof data === 'string') this.key(data)
      else if (
        tag === 'value' &&
        (data === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof data))
      )
        this.value(data)
      else if (tag === 'object' || tag === 'array') {
        const container: Container =
          tag === 'object' ? { kind: tag, value: {} } : { kind: tag, value: [] }
        this.value(container.value)
        this.stack.push(container)
      } else if (tag === 'end') {
        const closed = this.stack.pop()
        if (!closed || (closed.kind === 'object' && closed.key !== undefined))
          throw Error('Unbalanced worker frame')
      } else throw Error('Invalid worker token')
    }
  }

  finish(): unknown {
    if (!this.hasRoot || this.stack.length || this.text) throw Error('Incomplete worker value')
    return this.root
  }
}

function* frames(value: unknown): Generator<Token[]> {
  let tokens: Token[] = []
  let chars = 0
  for (const token of tokensFor(value)) {
    const count = typeof token[1] === 'string' ? token[1].length : 0
    if (tokens.length === WIRE_FRAME_TOKENS || chars + count > WIRE_FRAME_CHARS) {
      yield tokens
      tokens = []
      chars = 0
    }
    tokens.push(token)
    chars += count
  }
  if (tokens.length) yield tokens
}

export interface CreditWire {
  send(value: unknown, framed: boolean): void
  receive(value: unknown): void
  close(): void
}

export function createCreditWire(
  post: (wire: unknown) => void,
  consume: (decoded: unknown) => void
): CreditWire {
  const queue: { value: unknown; framed: boolean }[] = []
  let active: { id: number; index: number; frames: Generator<Token[]>; last: boolean } | undefined
  let reader: { id: number; index: number; tree: FrameReader } | undefined
  let sequence = 0
  let lastReceived = 0
  let closed = false

  function sendNext(): void {
    if (!active) return
    const step = active.frames.next()
    active.last = step.done === true
    post({
      channel: 'oo-frame',
      id: active.id,
      index: active.index++,
      tokens: step.value ?? [],
      done: active.last
    } satisfies Frame)
  }

  function pump(): void {
    while (!active && queue.length) {
      const { value, framed } = queue.shift()!
      if (!framed) post(value)
      else {
        active = { id: ++sequence, index: 0, frames: frames(value), last: false }
        sendNext()
      }
    }
  }

  return {
    send(value: unknown, framed: boolean): void {
      if (closed) return
      queue.push({ value, framed })
      pump()
    },
    receive(value: unknown): void {
      if (closed) return
      const msg = value as Frame | Ack | null
      if (msg?.channel === 'oo-credit') {
        if (!active || msg.id !== active.id || msg.index !== active.index - 1)
          throw Error('Unexpected worker credit')
        if (active.last) {
          active = undefined
          pump()
        } else sendNext()
      } else if (msg?.channel === 'oo-frame') {
        if (!reader) {
          if (msg.id !== lastReceived + 1) throw Error('Unexpected worker stream')
          reader = { id: msg.id, index: 0, tree: new FrameReader() }
        }
        if (
          reader.id !== msg.id ||
          reader.index !== msg.index ||
          !Array.isArray(msg.tokens) ||
          typeof msg.done !== 'boolean'
        )
          throw Error('Out-of-order worker frame')
        reader.tree.append(msg.tokens)
        reader.index++
        if (msg.done) {
          const decoded = reader.tree.finish()
          lastReceived = reader.id
          reader = undefined
          consume(decoded)
        }
        post({ channel: 'oo-credit', id: msg.id, index: msg.index } satisfies Ack)
      } else {
        if (value && typeof value === 'object' && 'channel' in value)
          throw Error('Unknown worker frame channel')
        if (reader) throw Error('Interrupted worker stream')
        consume(value)
      }
    },
    close(): void {
      closed = true
      active = undefined
      reader = undefined
      queue.length = 0
    }
  }
}
