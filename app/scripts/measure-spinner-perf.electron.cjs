// `measure-spinner-perf.mjs` 의 Electron 진입점 — **CommonJS 여야 한다**.
//
// Electron 39 의 ESM 진입점에서는 `app.whenReady()` 가 돌아오지 않는다(`ready` 가 비동기 모듈
// 평가보다 먼저 발화한다). 최소 프로브로 확인했다: ESM 진입점은 `import('electron')` 까지는
// 도달하고 `whenReady()` 에서 멈춘다. 그래서 electron 을 **동기 require** 로 잡고 ready 리스너를
// 모듈 최상단에서 건 뒤, 측정 로직만 ESM 모듈에서 동적으로 가져온다.
//
// 이 파일에 로직을 두지 않는 이유: 측정 로직이 여기 있으면 companion 테스트(`node --test`)가
// 그것을 읽지 못한다.

// require 여야 한다 — 위 이유로 이 파일은 CJS 이고, 동기 로드가 목적이다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { app, BrowserWindow } = require('electron')

app.whenReady().then(async () => {
  const { runMeasurement } = await import('./measure-spinner-perf.mjs')
  await runMeasurement({ app, BrowserWindow })
})
