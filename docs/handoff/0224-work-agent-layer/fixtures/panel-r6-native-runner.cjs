// Codex 작성. 실제 Windows Chromium + 합성 IPC 응답으로 ΔV6를 확인한다.
const { app, BrowserWindow } = require("electron"),
  fs = require("node:fs"),
  path = require("node:path");
const cache = path.resolve(process.argv[2]);
app.disableHardwareAcceleration();
app.setPath("userData", fs.mkdtempSync(path.join(cache, "profile-")));
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1500,
    height: 1125,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  const result = {
    success: false,
    errors: [],
    screens: [],
    manifest: JSON.parse(
      fs.readFileSync(path.join(cache, "manifest.json"), "utf8"),
    ),
  };
  try {
    await win.loadFile(path.join(cache, "panel.html"));
    const scenes =
      process.argv[3] === "r7"
        ? [
            ["work-permission", "window.r7Landing()"],
            ["work-output", "window.r7Outputs()"],
          ]
        : [
            ["new-landing", "window.r6Landing('new-landing')"],
            ["project-landing", "window.r6Landing('project-landing')"],
            ["nav-unread", "window.r6Nav(false)"],
            ["nav-read", "window.r6Nav(true)"],
          ];
    for (const [name, expression] of scenes) {
      result.observed = await win.webContents.executeJavaScript(expression);
      fs.writeFileSync(
        path.join(cache, name + ".png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      result.screens.push(name);
    }
    result.success = Object.values(result.observed.checks).every(Boolean);
  } catch (error) {
    result.errors.push(String(error.stack || error));
    result.observed = await win.webContents
      .executeJavaScript("window.r6Report")
      .catch(() => null);
    fs.writeFileSync(
      path.join(cache, "failure.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
  }
  fs.writeFileSync(
    path.join(cache, "result.json"),
    JSON.stringify(result, null, 2),
  );
  app.exit(result.success ? 0 : 1);
});
