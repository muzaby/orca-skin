import { app, BrowserWindow } from 'electron'

const [url] = process.argv.slice(-3)
app.whenReady().then(async () => {
  let timer
  const window = new BrowserWindow({
    width: 1000,
    height: 600,
    useContentSize: true,
    show: true,
    webPreferences: { sandbox: true, backgroundThrottling: false }
  })
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(Error('Renderer did not finish within the measurement window')),
        190000
      )
    })
    const result = await Promise.race([
      (async () => {
        await window.loadURL(url)
        return window.webContents.executeJavaScript('window.measureBody()')
      })(),
      timeout
    ])
    await new Promise((resolve) =>
      process.stdout.write('OO_RESULT ' + JSON.stringify(result) + '\n', resolve)
    )
  } catch (error) {
    await new Promise((resolve) =>
      process.stdout.write('OO_RESULT ' + JSON.stringify({ error: String(error) }) + '\n', resolve)
    )
  } finally {
    clearTimeout(timer)
    app.exit()
  }
})
