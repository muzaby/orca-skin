import type { IpcMainInvokeEvent, WebContents } from 'electron'

/** 파일 작업은 현재 Orca 창의 신뢰한 최상위 문서만 요청할 수 있다. */
export function createArtifactSenderCheck(
  getContents: () => WebContents | null,
  rendererUrl: string
): (event: IpcMainInvokeEvent) => boolean {
  const expected = new URL(rendererUrl)
  return (event) => {
    const contents = getContents()
    if (!contents || contents.isDestroyed() || event.sender !== contents) return false
    const frame = event.senderFrame
    if (!frame || frame !== contents.mainFrame) return false
    try {
      const actual = new URL(frame.url)
      // app: URL의 origin은 Node에서 null이므로 origin 문자열끼리 비교하지 않는다.
      return (
        actual.protocol === expected.protocol &&
        actual.host === expected.host &&
        actual.username === '' &&
        actual.password === ''
      )
    } catch {
      return false
    }
  }
}
