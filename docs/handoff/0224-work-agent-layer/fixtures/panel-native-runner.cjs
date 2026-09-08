// Codex 작성. 숨긴 Chromium에서 패널 화면/클릭 결과 보존. 모델/사용자 DB 접근 없음.
const { app, BrowserWindow } = require("electron"),
  fs = require("node:fs"),
  path = require("node:path");
const cache = path.resolve(process.argv[2]);
app.disableHardwareAcceleration();
app.on("window-all-closed", () => {});
const profile = fs.mkdtempSync(path.join(cache, "profile-"));
app.setPath("userData", profile);
app.setPath("appData", profile);
const report = {
  success: false,
  errors: [],
  screens: [],
  manifest: JSON.parse(
    fs.readFileSync(path.join(cache, "manifest.json"), "utf8"),
  ),
};
async function run() {
  await app.whenReady();
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 900,
    webPreferences: {
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.webContents.on("console-message", (e) => {
    if (e.level === "error") report.errors.push(e.message);
  });
  try {
    await win.loadFile(path.join(cache, "panel.html"));
    for (const name of [
      "coding-full",
      "coding-empty",
      "work-empty",
      "work-full",
      "work-dark",
      "work-narrow",
    ]) {
      win.setSize(name.includes("narrow") ? 760 : 1200, 900);
      const result = await win.webContents.executeJavaScript(
        "window.panelStage(" + JSON.stringify(name) + ")",
      );
      await new Promise((r) => setTimeout(r, 200));
      fs.writeFileSync(
        path.join(cache, name + ".png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      report.screens.push(result);
    }
    win.setSize(1200, 900);
    report.interactions = await win.webContents.executeJavaScript(
      "window.panelInteractions()",
    );
    report.success = report.errors.length === 0;
  } finally {
    win.destroy();
  }
}
const timeout = setTimeout(() => {
  report.errors.push("Timed out");
  finish();
}, 90000);
let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  fs.writeFileSync(
    path.join(cache, "result.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({ cache, success: report.success, errors: report.errors }),
  );
  app.exit(report.success ? 0 : 1);
}
run()
  .catch((e) => report.errors.push(e.stack || String(e)))
  .finally(finish);
