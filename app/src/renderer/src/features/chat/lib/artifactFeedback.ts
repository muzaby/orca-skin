import type { MessageKey } from '../../../shared/i18n'

export function artifactFailureKey(reason?: string): MessageKey {
  switch (reason) {
    case 'missing':
    case 'not-found':
      return 'chat.artifacts.missing'
    case 'access-denied':
      return 'chat.artifacts.unavailable'
    case 'forbidden':
      return 'chat.artifacts.forbidden'
    case 'unsafe-path':
      return 'chat.artifacts.unsafe'
    case 'too-large':
      return 'chat.artifacts.tooLarge'
    case 'too-many-items':
      return 'chat.artifacts.tooMany'
    case 'busy':
      return 'chat.artifacts.working'
    default:
      return 'chat.artifacts.failed'
  }
}

export function previewFailureKey(reason: string): MessageKey {
  if (reason === 'unsupported-format') return 'chat.artifactViewer.unsupported'
  if (reason === 'invalid-utf8' || reason === 'invalid-encoding')
    return 'chat.artifactViewer.invalidEncoding'
  return artifactFailureKey(reason)
}
