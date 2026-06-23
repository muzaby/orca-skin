export interface ImageCapability {
  supported: boolean
  supportedMediaTypes: readonly string[]
  maxImagesPerRequest: number
  nativeLongEdgePx: number
  maxRequestBytes: number
}

const DEFAULT_CLAUDE_IMAGE_CAPABILITY: ImageCapability = {
  supported: true,
  supportedMediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxImagesPerRequest: 20,
  // Checked against Anthropic vision docs during 0039 implementation planning.
  nativeLongEdgePx: 2576,
  maxRequestBytes: 32 * 1024 * 1024
}

export function imageCapabilityFor(model: string | null | undefined): ImageCapability {
  void model
  return DEFAULT_CLAUDE_IMAGE_CAPABILITY
}
