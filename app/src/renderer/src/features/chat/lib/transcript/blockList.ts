const CHUNK_SIZE = 64

export interface BlockSnapshot<Block> {
  readonly revision: number
  readonly keyRevision: number
  readonly count: number
  keyAt(index: number): string
  blockAt(index: number): Block
  indexOf(key: string): number
}

type BlockKey = { readonly key: string }

interface Chunk<Block extends BlockKey> {
  readonly blocks: readonly Block[]
  readonly slots: ReadonlyMap<string, number>
}

function makeChunks<Block extends BlockKey>(
  blocks: readonly Block[],
  packFromEnd = false
): Chunk<Block>[] {
  const chunks: Chunk<Block>[] = []
  let width = packFromEnd ? blocks.length % CHUNK_SIZE || CHUNK_SIZE : CHUNK_SIZE
  for (let index = 0; index < blocks.length;) {
    const slice = blocks.slice(index, index + width)
    index += width
    width = CHUNK_SIZE
    chunks.push({ blocks: slice, slots: new Map(slice.map(({ key }, slot) => [key, slot])) })
  }
  return chunks
}

export interface BlockList<Block> {
  snapshot(): BlockSnapshot<Block>
  splice(start: number, deleteCount: number, insert: readonly Block[]): BlockSnapshot<Block>
}

export function createBlockList<Block extends BlockKey>(
  initial: readonly Block[] = []
): BlockList<Block> {
  let chunks = makeChunks(initial)
  let starts: number[] = []
  const latest = new Map<string, Chunk<Block>>()
  for (const chunk of chunks) for (const key of chunk.slots.keys()) latest.set(key, chunk)

  function snapshot(revision: number, keyRevision: number): BlockSnapshot<Block> {
    const snapshotChunks = chunks
    let count = 0
    const snapshotStarts = snapshotChunks.map(({ blocks }) => {
      const start = count
      count += blocks.length
      return start
    })
    starts = snapshotStarts
    let offsetByChunk: Map<Chunk<Block>, number> | undefined
    const blockAt = (index: number): Block => {
      if (index < 0 || index >= count)
        throw new RangeError('Transcript block index is out of range')
      const chunk = chunkAt(snapshotStarts, index)
      return snapshotChunks[chunk].blocks[index - snapshotStarts[chunk]]
    }
    return {
      revision,
      keyRevision,
      count,
      blockAt,
      keyAt: (index) => blockAt(index).key,
      indexOf(key) {
        offsetByChunk ??= new Map(
          snapshotChunks.map((chunk, index) => [chunk, snapshotStarts[index]])
        )
        const candidate = latest.get(key)
        if (candidate) {
          const start = offsetByChunk.get(candidate)
          const slot = candidate.slots.get(key)
          if (start !== undefined && slot !== undefined) return start + slot
        }
        // An old snapshot can still see a key after the current owner moves or deletes it.
        for (let index = 0; index < snapshotChunks.length; index++) {
          const slot = snapshotChunks[index].slots.get(key)
          if (slot !== undefined) return snapshotStarts[index] + slot
        }
        return -1
      }
    }
  }

  let current = snapshot(0, 0)
  return {
    snapshot: () => current,
    splice(start, deleteCount, insert) {
      if (start < 0 || deleteCount < 0 || start + deleteCount > current.count) {
        throw new RangeError('Invalid transcript block range')
      }
      if (deleteCount === 0 && insert.length === 0) return current
      const keyChanged =
        deleteCount !== insert.length ||
        insert.some(({ key }, slot) => current.keyAt(start + slot) !== key)
      const first = chunks.length === 0 ? 0 : chunkAt(starts, start)
      const last = deleteCount === 0 ? first : chunkAt(starts, start + deleteCount - 1)
      const firstOffset = start - (starts[first] ?? 0)
      const lastOffset = start + deleteCount - (starts[last] ?? 0)
      const changed = chunks.slice(first, last + 1)
      const left = chunks[first]?.blocks.slice(0, firstOffset) ?? []
      const right = chunks[last]?.blocks.slice(lastOffset) ?? []
      const replacement = makeChunks([...left, ...insert, ...right], start === 0)

      for (const chunk of changed) {
        for (const key of chunk.slots.keys()) if (latest.get(key) === chunk) latest.delete(key)
      }
      for (const chunk of replacement) {
        for (const key of chunk.slots.keys()) latest.set(key, chunk)
      }
      chunks = [...chunks.slice(0, first), ...replacement, ...chunks.slice(last + 1)]
      current = snapshot(current.revision + 1, current.keyRevision + Number(keyChanged))
      return current
    }
  }
}

function chunkAt(starts: readonly number[], position: number): number {
  let low = 0
  let high = starts.length
  while (low + 1 < high) {
    const mid = (low + high) >>> 1
    if (starts[mid] <= position) low = mid
    else high = mid
  }
  return low
}
