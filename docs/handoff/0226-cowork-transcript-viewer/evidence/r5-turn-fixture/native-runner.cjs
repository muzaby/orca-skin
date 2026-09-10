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
    width: 1350,
    height: 1200,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: true,
    },
  });
  const result = {
    success: false,
    errors: [],
    screens: [],
    blockedRequests: [],
    consoleMessages: [],
    manifest: JSON.parse(
      fs.readFileSync(path.join(cache, "manifest.json"), "utf8"),
    ),
  };
  win.webContents.on("console-message", (details) =>
    result.consoleMessages.push(details.message),
  );
  win.webContents.session.webRequest.onBeforeRequest((request, callback) => {
    const external = /^https?:/.test(request.url);
    if (external) result.blockedRequests.push(request.url);
    callback({ cancel: external });
  });
  const capture = async (name) => {
    await win.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    await new Promise((resolve) => setTimeout(resolve, 240));
    const painted = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Native paint timed out")),
        5000,
      );
      win.webContents.once("paint", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    win.webContents.invalidate();
    await painted;
    fs.writeFileSync(
      path.join(cache, name + ".png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    result.screens.push(name + ".png");
  };
  try {
    await win.loadFile(path.join(cache, "fixture.html"));
    for (const [name, expression] of [
      ["work-live", 'window.nativeMount("work")'],
      ["late-output", "window.nativeLate()"],
      ["ordinary-preview", "window.nativeActions()"],
      ["reload", "window.nativeReload()"],
      ["code-live", 'window.nativeMount("code")'],
      ["idle", "window.nativeIdle()"],
    ]) {
      await win.webContents.executeJavaScript(expression);
      await capture(name);
    }
    result.observed = await win.webContents.executeJavaScript(
      "window.nativeReport",
    );
    result.success =
      Object.values(result.observed.checks).every(Boolean) &&
      result.observed.errors.length === 0 &&
      result.blockedRequests.length === 0 &&
      result.consoleMessages.length === 0;
  } catch (error) {
    result.errors.push(String(error.stack || error));
    result.observed = await win.webContents
      .executeJavaScript("window.nativeReport")
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
