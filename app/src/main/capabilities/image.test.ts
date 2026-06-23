import { describe, expect, it } from 'vitest'
import { imageCapabilityFor } from './image'

describe('imageCapabilityFor', () => {
  it('returns a conservative Claude image capability', () => {
    expect(imageCapabilityFor('claude-opus-4-8')).toMatchObject({
      supported: true,
      nativeLongEdgePx: 2576,
      maxImagesPerRequest: 20
    })
  })
})
