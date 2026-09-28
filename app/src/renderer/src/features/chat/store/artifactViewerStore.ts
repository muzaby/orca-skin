import { create } from 'zustand'
import type { ArtifactRef, ArtifactPreviewResult } from '../../../../../shared/artifacts'
import { previewFailureKey } from '../lib/artifactFeedback'
import { reportArtifactIssue } from '../lib/artifactIssueReport'

export interface ArtifactViewerSelection {
  sessionKey: string
  sessionId: string
  artifact: ArtifactRef
  request: number
  loading: boolean
  result?: ArtifactPreviewResult
  mode: 'preview' | 'code'
  expanded: boolean
  origin?: HTMLElement
}
export const useArtifactViewerStore = create<{
  selection: ArtifactViewerSelection | null
  widths: Record<'transcript' | 'catalog', number>
}>()(() => ({ selection: null, widths: { transcript: 560, catalog: 640 } }))
let sequence = 0

export function setArtifactViewerWidth(host: 'transcript' | 'catalog', width: number): void {
  useArtifactViewerStore.setState((state) => ({ widths: { ...state.widths, [host]: width } }))
}

async function readSelection(selection: ArtifactViewerSelection): Promise<void> {
  let result: ArtifactPreviewResult
  try {
    result = await window.orca.artifacts.preview({
      sessionId: selection.sessionId,
      publicationId: selection.artifact.publicationId
    })
  } catch {
    result = { state: 'unavailable', reason: 'io-error' }
  }
  if (useArtifactViewerStore.getState().selection?.request !== selection.request) return
  // 0242 ΔV2 (D-011) — 파일에 접근할 수 없으면 뷰어 본문에 불가 화면을 두지 않는다. 미리보기를
  // 요청한 사용자에게 사유를 toast 로 알리고 뷰어를 닫는다. 형식 미지원은 접근 불가가 아니라
  // 다운로드로 이어지는 정상 상태라 본문에 남긴다.
  if (result.state === 'unavailable' && result.reason !== 'unsupported-format') {
    useArtifactViewerStore.setState({ selection: null })
    reportArtifactIssue({
      event: 'artifacts.preview.failed',
      filename: selection.artifact.filename,
      reason: result.reason,
      messageKey: previewFailureKey(result.reason)
    })
    return
  }
  useArtifactViewerStore.setState((state) =>
    state.selection?.request !== selection.request
      ? state
      : { selection: { ...state.selection, loading: false, result } }
  )
}

export async function openArtifactViewer(
  sessionKey: string,
  sessionId: string,
  artifact: ArtifactRef,
  origin?: HTMLElement
): Promise<void> {
  const selection: ArtifactViewerSelection = {
    sessionKey,
    sessionId,
    artifact,
    origin,
    request: ++sequence,
    loading: true,
    mode: artifact.kind === 'text' ? 'code' : 'preview',
    expanded: false
  }
  useArtifactViewerStore.setState({ selection })
  await readSelection(selection)
}

export function closeArtifactViewer(sessionKey?: string): void {
  const selected = useArtifactViewerStore.getState().selection
  if (!selected || (sessionKey !== undefined && selected.sessionKey !== sessionKey)) return
  useArtifactViewerStore.setState({ selection: null })
}

export async function retryArtifactViewer(): Promise<void> {
  const current = useArtifactViewerStore.getState().selection
  if (!current || current.loading) return
  const selection = { ...current, request: ++sequence, loading: true, result: undefined }
  useArtifactViewerStore.setState({ selection })
  await readSelection(selection)
}

export function setArtifactViewerMode(mode: ArtifactViewerSelection['mode']): void {
  useArtifactViewerStore.setState((state) =>
    state.selection ? { selection: { ...state.selection, mode } } : state
  )
}

export function toggleArtifactViewerExpanded(): void {
  useArtifactViewerStore.setState((state) =>
    state.selection
      ? { selection: { ...state.selection, expanded: !state.selection.expanded } }
      : state
  )
}
