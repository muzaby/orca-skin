// 지원 이미지 미디어 타입의 단일 출처(SSOT). attachments.ts 의 검증 Set 도 이 배열에서 파생한다.
export const SUPPORTED_IMAGE_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
] as const

export interface ImageCapability {
  supported: boolean
  supportedMediaTypes: readonly string[]
  maxImagesPerRequest: number
  nativeLongEdgePx: number
  maxRequestBytes: number
}

const DEFAULT_CLAUDE_IMAGE_CAPABILITY: ImageCapability = {
  supported: true,
  supportedMediaTypes: SUPPORTED_IMAGE_MEDIA_TYPES,
  maxImagesPerRequest: 20,
  // Checked against Anthropic vision docs during 0039 implementation planning.
  nativeLongEdgePx: 2576,
  maxRequestBytes: 32 * 1024 * 1024
}

export function imageCapabilityFor(model: string | null | undefined): ImageCapability {
  void model
  return DEFAULT_CLAUDE_IMAGE_CAPABILITY
}
