import type { WebContents } from 'electron'

/** Keep the application document in place; external web links belong to the OS browser. */
export function installExternalNavigation(
  contents: Pick<WebContents, 'setWindowOpenHandler' | 'on'>,
  open: (url: string) => Promise<unknown>
): void {
  const isWeb = (value: string): boolean => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol)
    } catch {
      return false
    }
  }
  const launch = (url: string): void => {
    void open(url).catch(() => undefined)
  }
  contents.setWindowOpenHandler(({ url }) => {
    if (isWeb(url)) launch(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    event.preventDefault()
    if (isWeb(url)) launch(url)
  })
}
