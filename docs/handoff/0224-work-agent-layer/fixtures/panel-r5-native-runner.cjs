// Codex 작성. 숨긴 Chromium에서 패널 화면/클릭 결과 보존. 모델/사용자 DB 접근 없음.
const { app, BrowserWindow, ipcMain } = require("electron"),
  fs = require("node:fs"),
  path = require("node:path");
const cache = path.resolve(process.argv[2]);
app.disableHardwareAcceleration();
app.on("window-all-closed", () => {});
const profile = fs.mkdtempSync(path.join(cache, "profile-"));
app.setPath("userData", profile);
app.setPath("appData", profile);
let directoryHost;
const report = {
  success: false,
  errors: [],
  screens: [],
  directoryManifest: JSON.parse(
    fs.readFileSync(path.join(cache, "directory-host-manifest.json"), "utf8"),
  ),
  manifest: JSON.parse(
    fs.readFileSync(path.join(cache, "manifest.json"), "utf8"),
  ),
};
async function run() {
  await app.whenReady();
  directoryHost = require(
    path.join(cache, "directory-host.cjs"),
  ).createDirectoryHost(cache);
  ipcMain.handle("fixture:directory:info", () => ({
    sessionId: directoryHost.sessionId,
    cwd: directoryHost.cwd,
    directory: directoryHost.directory,
  }));
  ipcMain.handle("fixture:directory:add", (_event, request) =>
    directoryHost.addDirectory(request),
  );
  ipcMain.handle("fixture:directory:load", () => directoryHost.load());
  ipcMain.handle("fixture:directory:open", (_event, request) =>
    directoryHost.openPath(request),
  );
  ipcMain.handle("fixture:directory:open-state", () =>
    directoryHost.openState(),
  );
  ipcMain.handle("fixture:directory:open-failure", (_event, value) =>
    directoryHost.setOpenFailure(value),
  );
  ipcMain.handle("fixture:directory:open-deferred", (_event, value) =>
    directoryHost.setOpenDeferred(value),
  );
  ipcMain.handle("fixture:directory:open-release", () =>
    directoryHost.releaseOpen(),
  );
  fs.writeFileSync(
    path.join(cache, "directory-preload.cjs"),
    "const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('directoryFixture',{info:()=>ipcRenderer.invoke('fixture:directory:info'),addDirectory:(request)=>ipcRenderer.invoke('fixture:directory:add',request),load:()=>ipcRenderer.invoke('fixture:directory:load'),openPath:(request)=>ipcRenderer.invoke('fixture:directory:open',request),openState:()=>ipcRenderer.invoke('fixture:directory:open-state'),setOpenFailure:(value)=>ipcRenderer.invoke('fixture:directory:open-failure',value),setOpenDeferred:(value)=>ipcRenderer.invoke('fixture:directory:open-deferred',value),releaseOpen:()=>ipcRenderer.invoke('fixture:directory:open-release')});",
  );
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 900,
    webPreferences: {
      offscreen: true,
      preload: path.join(cache, "directory-preload.cjs"),
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
      "new-landing",
      "project-landing",
      "coding-full",
      "coding-tasks-only",
      "coding-plan-only",
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
      if (name.endsWith("landing")) {
        report.landing ??= [];
        report.landing.push(
          await win.webContents.executeJavaScript(
            "window.panelLandingChecks()",
          ),
        );
      }
      if (name === "coding-full") {
        const normal = await win.webContents.executeJavaScript(
          "window.panelMotion()",
        );
        win.webContents.debugger.attach("1.3");
        await win.webContents.debugger.sendCommand(
          "Emulation.setEmulatedMedia",
          { features: [{ name: "prefers-reduced-motion", value: "reduce" }] },
        );
        const reduced = await win.webContents.executeJavaScript(
          "window.panelMotion()",
        );
        await win.webContents.debugger.sendCommand(
          "Emulation.setEmulatedMedia",
          { features: [] },
        );
        win.webContents.debugger.detach();
        if (
          normal.animationName === "none" ||
          reduced.animationName !== "none" ||
          !reduced.reduced
        )
          throw new Error("Reduced motion assertion failed");
        report.motion = { normal, reduced };
      }
    }
    win.setSize(1200, 900);
    report.interactions = await win.webContents.executeJavaScript(
      "window.panelInteractions()",
    );
    report.r4 = await win.webContents.executeJavaScript(
      "window.panelR4Interactions()",
    );
    for (const keyCode of ["Enter", "Space"]) {
      await win.webContents.executeJavaScript("window.panelFocusDirectory()");
      const before = directoryHost.openState().calls.length;
      const key = keyCode === "Enter" ? "Enter" : " ";
      const virtualKey = keyCode === "Enter" ? 13 : 32;
      win.webContents.debugger.attach("1.3");
      await win.webContents.debugger.sendCommand("Input.dispatchKeyEvent", {
        type: "keyDown",
        key,
        code: keyCode,
        windowsVirtualKeyCode: virtualKey,
        text: keyCode === "Enter" ? "\r" : " ",
      });
      await win.webContents.debugger.sendCommand("Input.dispatchKeyEvent", {
        type: "keyUp",
        key,
        code: keyCode,
        windowsVirtualKeyCode: virtualKey,
      });
      win.webContents.debugger.detach();
      const deadline = Date.now() + 20000;
      while (
        directoryHost.openState().calls.length === before &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      const after = directoryHost.openState().calls.length;
      if (after !== before + 1)
        throw new Error("Context keyboard activation failed: " + keyCode);
      report.r4.checks["contextKeyboard" + keyCode] = true;
    }
    for (const name of [
      "work-detail",
      "work-context-error",
      "work-menu",
      "coding-menu",
    ]) {
      const result = await win.webContents.executeJavaScript(
        "window.panelR4Snapshot(" + JSON.stringify(name) + ")",
      );
      fs.writeFileSync(
        path.join(cache, name + ".png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      report.screens.push(result);
    }
    const inspect = async (name, call) => {
      try {
        return await win.webContents.executeJavaScript(call);
      } catch (error) {
        report.errors.push(name + ": " + String(error));
        return { name, checks: { completed: false } };
      }
    };
    report.r5 = await inspect("r5", "window.panelR5Interactions()");
    for (const [name, call, height] of [
      ["work-density", "window.panelR5HeightSnapshot()", 600],
      ["coding-detail", "window.panelR5CodingSnapshot()", 900],
      ["nav-completion", "window.panelR5Nav()", 900],
    ]) {
      win.setSize(1200, height);
      const result = await inspect(name, call);
      if (name === "work-density") {
        const target = await win.webContents.executeJavaScript(
          "window.panelR5HoverTarget()",
        );
        win.webContents.debugger.attach("1.3");
        await win.webContents.debugger.sendCommand("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          ...target,
        });
        win.webContents.debugger.detach();
        await new Promise((resolve) => setTimeout(resolve, 250));
        report.r5Tooltip = await win.webContents.executeJavaScript(
          "window.panelR5Tooltip()",
        );
      }
      fs.writeFileSync(
        path.join(cache, name + ".png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      report.screens.push(result);
      if (name === "work-density") report.r5Resize = result;
      if (name === "nav-completion") report.r5Nav = result;
      if (name === "work-density") {
        report.r5TooltipLife = await inspect(
          "tooltip scroll",
          "window.panelR5TooltipScroll()",
        );
        if (report.r5TooltipLife.target) {
          win.webContents.debugger.attach("1.3");
          await win.webContents.debugger.sendCommand(
            "Input.dispatchMouseEvent",
            { type: "mouseMoved", ...report.r5TooltipLife.target },
          );
          win.webContents.debugger.detach();
          await new Promise((resolve) => setTimeout(resolve, 250));
          report.r5TooltipLast = await inspect(
            "tooltip last row",
            "window.panelR5Tooltip()",
          );
          // 키보드 수명 검사는 hover 재진입과 분리한다. 대조 실행의 원본은 evidence에 보존한다.
          win.webContents.debugger.attach("1.3");
          await win.webContents.debugger.sendCommand(
            "Input.dispatchMouseEvent",
            { type: "mouseMoved", x: 0, y: 0 },
          );
          win.webContents.debugger.detach();
          report.r5TooltipLife.pointerDuringKeyboard = { x: 0, y: 0 };
          Object.assign(
            report.r5TooltipLife.checks,
            await win.webContents.executeJavaScript(
              "window.panelR5TooltipFinish()",
            ),
          );
          report.r5TooltipLife.observations =
            await win.webContents.executeJavaScript(
              "window.panelR5TooltipLifeObservation",
            );
        }
      }
    }
    for (const group of [
      "r5",
      "r5Resize",
      "r5Nav",
      "r5Tooltip",
      "r5TooltipLast",
      "r5TooltipLife",
    ]) {
      if (!report[group]?.checks)
        report.errors.push(group + ": missing checks");
      for (const [name, passed] of Object.entries(
        report[group]?.checks ?? {},
      )) {
        if (passed !== true)
          report.errors.push(group + ": " + name + " failed");
      }
    }
    report.success = report.errors.length === 0;
  } catch (error) {
    fs.writeFileSync(
      path.join(cache, "failure.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    report.failureState = await win.webContents
      .executeJavaScript(
        "({r5:window.panelR5LastResult,nav:window.panelR5LastNav,text:document.body.innerText.slice(0,4000)})",
      )
      .catch(() => null);
    throw error;
  } finally {
    win.destroy();
    directoryHost.close();
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
  if (directoryHost) directoryHost.close();
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
