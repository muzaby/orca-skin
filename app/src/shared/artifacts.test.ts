import { describe, expect, it } from 'vitest'
import {
  ArtifactSaveRequestSchema,
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
})
