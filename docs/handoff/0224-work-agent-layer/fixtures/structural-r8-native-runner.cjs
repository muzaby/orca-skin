// Codex 작성. 실제 Windows Chromium, 격리 profile과 합성 IPC로만 실행한다.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs"),
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
    author: "Codex",
    success: false,
    errors: [],
    screens: [],
    manifest: JSON.parse(
      fs.readFileSync(path.join(cache, "manifest.json"), "utf8"),
    ),
  };
  try {
    await win.loadFile(path.join(cache, "fixture.html"));
    const scenes = [
      ["new-landing", "window.r8Landing('new')"],
      ["project-landing", "window.r8Landing('project')"],
      ["permissions", "window.r8Permissions()"],
      ["work-panel", "window.r8Panel('work')"],
      ["code-panel", "window.r8Panel('code')"],
      ["work-transcript", "window.r8Transcript('work')"],
      ["code-transcript", "window.r8Transcript('code')"],
      ["nav", "window.r8Nav()"],
    ];
    for (const [name, expression] of scenes) {
      try {
        await win.webContents.executeJavaScript(expression);
      } catch (error) {
        result.errors.push({
          scene: name,
          error: String(error.stack || error),
        });
      }
      fs.writeFileSync(
        path.join(cache, name + ".png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      result.screens.push(name + ".png");
      if (name === "code-panel") {
        try {
          win.webContents.debugger.attach("1.3");
          await win.webContents.debugger.sendCommand(
            "Emulation.setEmulatedMedia",
            {
              features: [
                { name: "prefers-reduced-motion", value: "no-preference" },
              ],
            },
          );
          const normal =
            await win.webContents.executeJavaScript("window.r8Motion()");
          await win.webContents.debugger.sendCommand(
            "Emulation.setEmulatedMedia",
            { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
          );
          const reduced =
            await win.webContents.executeJavaScript("window.r8Motion()");
          await win.webContents.executeJavaScript(
            `window.r8RecordMotion(${JSON.stringify({ normal, reduced })})`,
          );
          await win.webContents.debugger.sendCommand(
            "Emulation.setEmulatedMedia",
            { features: [] },
          );
          win.webContents.debugger.detach();
        } catch (error) {
          result.errors.push({
            scene: "motion",
            error: String(error.stack || error),
          });
        }
      }
    }
    result.observed =
      await win.webContents.executeJavaScript("window.r8Report");
    result.success =
      result.errors.length === 0 &&
      result.observed.errors.length === 0 &&
      Object.keys(result.observed.checks).length > 0 &&
      Object.values(result.observed.checks).every(Boolean) &&
      result.observed.sendCalls === 0;
  } catch (error) {
    result.errors.push({
      scene: "bootstrap",
      error: String(error.stack || error),
    });
  }
  fs.writeFileSync(
    path.join(cache, "result.json"),
    JSON.stringify(result, null, 2),
  );
  app.exit(result.success ? 0 : 1);
});
