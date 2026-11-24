import type { WireControl, WireRequest, WireResponse } from '../protocol'
import { imageThumbnail } from './imageThumb'

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WireRequest | WireControl>) => void) | null
  postMessage(message: WireResponse): void
}

scope.onmessage = ({ data }) => {
  if ('type' in data) return
  if (data.kind !== 'imageThumb') {
    scope.postMessage({ id: data.id, ok: false, error: 'wrong-lane' })
    return
  }
  void imageThumbnail(data.mimeType, data.data).then(
    (thumbnail) =>
      scope.postMessage({
        id: data.id,
        ok: true,
        result: { thumbnail },
        size: thumbnail?.length ?? 0
      }),
    () => scope.postMessage({ id: data.id, ok: false, error: 'thumbnail-failed' })
  )
}
