const { app, BrowserWindow } = require('electron')
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  await w.loadFile(process.argv[process.argv.length - 1])
  for (let i = 0; i < 50; i++) {
    const r = await w.webContents.executeJavaScript('window.result')
    if (r) { console.log('RESULT', JSON.stringify(r)); break }
    await new Promise((r) => setTimeout(r, 100))
  }
  app.quit()
})
