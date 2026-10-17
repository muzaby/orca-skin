import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Backend } from '../../../../../../shared/ipc'
import { assistantRuntime } from './assistant'
import { TranscriptRuntimeProvider } from '../common/transcript/TranscriptRuntime'
export function withTranscript(element: ReactNode, backend: Backend = 'claude'): React.JSX.Element {
  return createElement(TranscriptRuntimeProvider, { value: assistantRuntime(backend) }, element)
}
export function renderWithTranscript(element: ReactNode, backend: Backend = 'claude'): string {
  return renderToStaticMarkup(withTranscript(element, backend))
}
export function renderOpenCodeTranscript(element: ReactNode): string {
  return renderWithTranscript(element, 'opencode')
}
