import { describe, expect, it } from 'vitest'
import {
  ArtifactSaveRequestSchema,
  ArtifactCatalogRequestSchema,
  ArtifactSetPinnedRequestSchema,
  ArtifactStatusRequestSchema,
  ArtifactTargetRequestSchema
} from './protocol'

describe('artifact ID-only IPC contracts', () => {
  const target = { sessionId: 'session', publicationId: 'publication' }
  it('rejects renderer paths and unknown properties', () => {
    expect(ArtifactTargetRequestSchema.safeParse(target).success).toBe(true)
    expect(
      ArtifactTargetRequestSchema.safeParse({ ...target, path: 'C:/private/file.md' }).success
    ).toBe(false)
  })
  it('bounds save and status lists without silently truncating', () => {
    const request = (n: number): { sessionId: string; publicationIds: string[] } => ({
      sessionId: 'session',
      publicationIds: Array.from({ length: n }, (_, i) => `id-${i}`)
    })
    expect(ArtifactSaveRequestSchema.safeParse(request(50)).success).toBe(true)
    expect(ArtifactSaveRequestSchema.safeParse(request(51)).success).toBe(false)
    expect(ArtifactSaveRequestSchema.safeParse(request(0)).success).toBe(false)
    expect(ArtifactStatusRequestSchema.safeParse(request(100)).success).toBe(true)
    expect(ArtifactStatusRequestSchema.safeParse(request(101)).success).toBe(false)
  })
  it('bounds catalog and pin actions to ID-only inputs with an explicit boolean', () => {
    expect(ArtifactCatalogRequestSchema.safeParse({}).success).toBe(true)
    expect(ArtifactCatalogRequestSchema.safeParse({ path: 'C:/private' }).success).toBe(false)
    expect(ArtifactSetPinnedRequestSchema.safeParse({ ...target, pinned: false }).success).toBe(
      true
    )
    for (const extra of [{}, { pinned: 'true' }, { pinned: true, path: 'C:/private' }]) {
      expect(ArtifactSetPinnedRequestSchema.safeParse({ ...target, ...extra }).success).toBe(false)
    }
  })
})
