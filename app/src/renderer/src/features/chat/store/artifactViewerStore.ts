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
/** 결과를 기다리는 열기 요청. 이 동안 뷰어 공간(selection)은 아직 할당하지 않는다(0242 ΔV4). */
export interface ArtifactViewerOpening {
  request: number
  sessionKey: string
  publicationId: string
}
export const useArtifactViewerStore = create<{
  selection: ArtifactViewerSelection | null
  opening: ArtifactViewerOpening | null
  widths: Record<'transcript' | 'catalog', number>
}>()(() => ({ selection: null, opening: null, widths: { transcript: 560, catalog: 640 } }))
let sequence = 0

export function setArtifactViewerWidth(host: 'transcript' | 'catalog', width: number): void {
  useArtifactViewerStore.setState((state) => ({ widths: { ...state.widths, [host]: width } }))
}

async function readPreview(
  sessionId: string,
  publicationId: string
): Promise<ArtifactPreviewResult> {
  try {
    return await window.orca.artifacts.preview({ sessionId, publicationId })
  } catch {
    return { state: 'unavailable', reason: 'io-error' }
  }
}

// 0242 ΔV2 (D-011) — 접근할 수 없는 파일은 뷰어 본문에 불가 화면을 두지 않고 요청한 사용자에게
// 사유를 toast 로 알린다. 형식 미지원은 다운로드로 이어지는 정상 상태라 본문에 남긴다.
function blocked(artifact: ArtifactRef, result: ArtifactPreviewResult): boolean {
  if (result.state !== 'unavailable' || result.reason === 'unsupported-format') return false
  reportArtifactIssue({
    event: 'artifacts.preview.failed',
    filename: artifact.filename,
    reason: result.reason,
    messageKey: previewFailureKey(result.reason)
  })
  return true
}

// 이미 열린 뷰어의 재시도 — 공간이 이미 있으므로 불가면 닫는 것이 되돌림이다.
async function readSelection(selection: ArtifactViewerSelection): Promise<void> {
  const result = await readPreview(selection.sessionId, selection.artifact.publicationId)
  if (useArtifactViewerStore.getState().selection?.request !== selection.request) return
  if (blocked(selection.artifact, result)) {
    useArtifactViewerStore.setState({ selection: null })
    return
  }
  useArtifactViewerStore.setState((state) =>
    state.selection?.request !== selection.request
      ? state
      : { selection: { ...state.selection, loading: false, result } }
  )
}

// 0242 ΔV4 (D-014) — 결과를 받은 뒤, 열 수 있을 때만 뷰어 공간을 할당한다. 먼저 로딩 뷰어로 자리를
// 잡았다가 불가 결과에 되돌리면 패널이 번쩍인다. 불가면 이미 열린 다른 뷰어도 그대로 둔다.
export async function openArtifactViewer(
  sessionKey: string,
  sessionId: string,
  artifact: ArtifactRef,
  origin?: HTMLElement
): Promise<void> {
  const pending = useArtifactViewerStore.getState().opening
  if (pending?.sessionKey === sessionKey && pending.publicationId === artifact.publicationId) return
  const opening = { request: ++sequence, sessionKey, publicationId: artifact.publicationId }
  useArtifactViewerStore.setState({ opening })
  const result = await readPreview(sessionId, artifact.publicationId)
  if (useArtifactViewerStore.getState().opening?.request !== opening.request) return
  useArtifactViewerStore.setState({ opening: null })
  if (blocked(artifact, result)) return
  useArtifactViewerStore.setState({
    selection: {
      sessionKey,
      sessionId,
      artifact,
      origin,
      request: opening.request,
      loading: false,
      result,
      mode: artifact.kind === 'text' ? 'code' : 'preview',
      expanded: false
    }
  })
}

export function closeArtifactViewer(sessionKey?: string): void {
  const { selection, opening } = useArtifactViewerStore.getState()
  // 대기 중인 열기도 함께 취소한다 — 세션 이동·카탈로그 이탈 뒤 늦은 결과가 뷰어를 열지 않게.
  if (opening && (sessionKey === undefined || opening.sessionKey === sessionKey))
    useArtifactViewerStore.setState({ opening: null })
  if (!selection || (sessionKey !== undefined && selection.sessionKey !== sessionKey)) return
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
