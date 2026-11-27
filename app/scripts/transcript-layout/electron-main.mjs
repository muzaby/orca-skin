import { app, BrowserWindow } from 'electron'
const [origin] = process.argv.slice(-3)
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 1200,
    useContentSize: true,
    webPreferences: { sandbox: true, backgroundThrottling: false }
  })
  const records = []
  try {
    for (const [screen, scenarios] of [
      [
        'claude-code',
        [
          'toolSpacing',
          'matrix-c1',
          'matrix-c2',
          'matrix-c3',
          ...['text', 'reasoning', 'ask', 'error', 'compact'].map((kind) => 'matrix-c4-' + kind),
          'errorRun',
          'errorLive',
          'acceptedFailures',
          'reopenedFailures',
          'editStat'
        ]
      ],
      [
        'claude-work',
        ['workDot', 'workNote', 'matrix-w3', 'errorRun', 'acceptedFailures', 'reopenedFailures']
      ],
      [
        'opencode-code',
        [
          'matrix-o1',
          'matrix-o2',
          'matrix-o3',
          'matrix-o4',
          'editStat',
          'acceptedFailures',
          'reopenedFailures'
        ]
      ]
    ])
      for (const scenario of scenarios) {
        try {
          await win.loadURL(origin + '/?' + new URLSearchParams({ screen, scenario }))
          records.push({
            screen,
            scenario,
            ...(await win.webContents.executeJavaScript('window.layoutMeasurement()'))
          })
        } catch (error) {
          records.push({ screen, scenario, ok: false, error: String(error) })
        }
      }
    await new Promise((resolve) =>
      process.stdout.write('OO_RESULT ' + JSON.stringify({ records }) + '\n', resolve)
    )
  } finally {
    app.quit()
  }
})
