// DevTools supplies a user gesture to Chromium's native copy command. The browser
// dispatches the trusted ClipboardEvent and writes its normal, isolated clipboard.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

let activeDriver;

async function connect(profile, origin) {
  const port = (
    await readFile(join(profile, "chrome", "DevToolsActivePort"), "utf8")
  ).split("\n")[0];
  const targets = await (
    await fetch("http://127.0.0.1:" + port + "/json/list")
  ).json();
  const target = targets.find(
    (page) => page.type === "page" && page.url.startsWith(origin + "/"),
  );
  if (!target) throw new Error("Timing page not found");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let seq = 0;
  async function request(method, params) {
    const id = ++seq;
    const answer = new Promise((resolve, reject) => {
      function receive(event) {
        const msg = JSON.parse(event.data);
        if (msg.id !== id) return;
        socket.removeEventListener("message", receive);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
      socket.addEventListener("message", receive);
    });
    socket.send(JSON.stringify({ id, method, params }));
    return answer;
  }
  await request("Page.bringToFront", {});
  await request("Browser.grantPermissions", {
    origin,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  });
  return request;
}

export async function nativeCopy(profile, origin) {
  activeDriver ??= await connect(profile, origin);
  const result = await activeDriver("Runtime.evaluate", {
    expression: `(() => {
    const started=performance.now(); const copied=document.execCommand('copy');
    return {copied,commandMs:performance.now()-started}
  })()`,
    userGesture: true,
    returnByValue: true,
  });
  if (!result.result.value?.copied)
    throw new Error("Native copy command failed: " + JSON.stringify(result));
  return result.result.value;
}
