import { reportError } from './reportError'

export function isBenignWindowError(message: string): boolean {
  return message.startsWith('ResizeObserver loop')
}

export function registerGlobalErrorHandlers(): () => void {
  const onError = (event: ErrorEvent): void => {
    if (isBenignWindowError(event.message)) return
    reportError({
      event: 'renderer.uncaught.error',
      scope: 'renderer',
      title: 'unexpected',
      error: event.error ?? event.message,
      data: { filename: event.filename, lineno: event.lineno }
    })
  }
  const onRejection = (event: PromiseRejectionEvent): void => {
    reportError({
      event: 'renderer.unhandled.rejection',
      scope: 'renderer',
      title: 'unexpected',
      error: event.reason
    })
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
