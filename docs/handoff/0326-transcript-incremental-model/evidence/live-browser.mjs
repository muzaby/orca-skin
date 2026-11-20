// Run from the repository with Node 24. CHROME_PATH may select a Chromium binary.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { timingPhases } from "./copy-timing-phases.mjs";
const app = fileURLToPath(new URL("../../../../app/", import.meta.url));
const require = createRequire(join(app, "package.json"));
const { build } = await import(require.resolve("vite"));
const { default: tailwindcss } = await import(require.resolve("@tailwindcss/vite"));
const panelOnly = process.argv.includes("--panel-parent");
const consumersOnly = process.argv.includes("--panel-consumers");
const markdownPair = process.argv.includes("--copy-markdown-pair");
const profileTiming = markdownPair || process.argv.includes("--copy-profile");
const minimumTiming = process.argv.includes("--copy-minimum");
const timingOnly = minimumTiming || profileTiming || process.argv.includes("--copy-timing");
const historyReady = process.argv.includes("--history-ready");
const historyReplay = historyReady || process.argv.includes("--history-replay");
const probeFile = historyReplay ? "./history-replay.tsx" : timingOnly ? "./copy-timing.tsx" : panelOnly ? "./panel-parent.tsx" : consumersOnly ? "./panel-consumers.tsx" : "./live-probe.tsx";
const probe = fileURLToPath(new URL(probeFile, import.meta.url));
const profile = await mkdtemp(join(tmpdir(), "orca-react-probe-"));
let resolveProbe;
let rejectProbe;
const result = new Promise((resolve, reject) => {
  resolveProbe = resolve;
  rejectProbe = reject;
});
const dist = join(profile, "dist");
await build({
  root: app,
  configFile: false,
  define: { "import.meta.env.VITE_MARKDOWN_PAIR": JSON.stringify(markdownPair), "import.meta.env.VITE_HISTORY_READY": JSON.stringify(historyReady), "import.meta.env.VITE_OO_DIAGNOSTIC": JSON.stringify("1"), "import.meta.env.VITE_COPY_PROFILE": JSON.stringify(profileTiming), "import.meta.env.VITE_COPY_MINIMUM": JSON.stringify(minimumTiming), "import.meta.env.VITE_COPY_TIMING_SCREEN": JSON.stringify(process.env.COPY_TIMING_SCREEN ?? "all") },
  worker: { format: "es" },
  logLevel: "error",
  esbuild: { jsx: "automatic" },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: { "@renderer": join(app, "src/renderer/src") },
  },
  build: {
    outDir: dist,
    target: "esnext",
    minify: false,
    rollupOptions: {
      input: probe,
      output: { entryFileNames: "probe.js", chunkFileNames: "[hash].js" },
    },
  },
  plugins: [
    tailwindcss(),
    {
      name: "measure-committed-transcript-renders",
      enforce: "pre",
      transform(source, id) {
        if (historyReplay) return;
        if (markdownPair && id.endsWith("/markdown/Markdown.tsx")) {
          const simple = "const simple = simpleParagraph(source, sourceParts)";
          if (source.split(simple).length !== 2) throw new Error("Markdown fast path changed");
          return source.replace(simple, "const simple = globalThis.markdownReference ? null : simpleParagraph(source, sourceParts)");
        }
        if (timingOnly) return profileTiming ? timingPhases(source, id) : undefined;
        if (consumersOnly) {
          const file = id.split("/").at(-1);
          if (!["useTaskBoard.ts", "useTaskContext.ts", "tiles.tsx", "AgentViews.tsx", "LegacySubAgentTile.tsx", "CanonicalBackgroundContent.tsx", "InlineSubagentDetail.tsx", "AgentTaskRow.tsx", "SubagentNoticeRow.tsx"].includes(file)) return;
          let site = 0;
          return source.replace(/^( *)(const \w+ = |return )useTranscriptView\('([\w]+)'/gm,
            (line, indent, prefix, domain) => indent + "globalThis.panelVisits(" + JSON.stringify(file + "/" + (++site) + "/" + domain) + ");\n" + line);
        }
        if (panelOnly && id.endsWith("/SubAgentTaskDetail.tsx")) {
          const detail = "const prompt = promptFromCall(selected.call)";
          if (!source.includes(detail)) throw new Error("SubAgentTaskDetail entry changed");
          return source.replace(detail, "globalThis.detailCalls[selected.toolUseId] = (globalThis.detailCalls[selected.toolUseId] ?? 0) + 1; " + detail);
        }
        if (panelOnly && id.endsWith("/AgentViews.tsx")) {
          const child = "const child = useTranscriptView('childMessage', agent.toolUseId)";
          if (!source.includes(child)) throw new Error("AgentDetail child subscription changed");
          return source.replace(child, "globalThis.detailCalls[agent.toolUseId] = (globalThis.detailCalls[agent.toolUseId] ?? 0) + 1; " + child);
        }
        if (panelOnly) return;
        if (id.endsWith("/TranscriptViewport.tsx")) {
          const expression = "renderBlock(block, vi.index, selected)";
          if (!source.includes(expression)) throw new Error("Virtual row render entry changed");
          // Exercise the public copyChunkSize override with a small selection on each real Timeline.
          if (!source.includes("  copyChunkSize,")) throw new Error("Copy chunk option changed");
          return source.replace("  copyChunkSize,", "  copyChunkSize = globalThis.probeChunkSize ?? 2,").replace(expression, "(block.key === 'u:old:user' && globalThis.rowRenders++, " + expression + ")");
        }
        if (!id.endsWith("/UserBubbleText.tsx")) return;
        const start = "const { tr } = useI18n()";
        if (!source.includes(start))
          throw new Error("UserBubbleText render entry changed");
        return source.replace(start, "globalThis.bubbleRenders++; " + start);
      },
    },
  ],
});
const server = createServer(async (req, res) => {
  if (timingOnly && req.url === "/native-copy" && req.method === "POST") {
    try {
      const { nativeCopy } = await import("./copy-timing-driver.mjs");
      res.end(JSON.stringify(await nativeCopy(profile, "http://127.0.0.1:" + server.address().port)));
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
    return;
  }
  if (timingOnly && req.url === "/timing-sample" && req.method === "POST") {
    const data = [];
    for await (const part of req) data.push(part);
    console.log(Buffer.concat(data).toString());
    res.end("ok");
    return;
  }
  if (req.url === "/result" && req.method === "POST") {
    const input = [];
    for await (const chunk of req) input.push(chunk);
    const outcome = JSON.parse(Buffer.concat(input).toString());
    res.end("ok");
    if (outcome.error) rejectProbe(new Error(outcome.error));
    else resolveProbe(outcome);
  } else if (req.url === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end(`<div id="root"></div><script type="module">
      const fail = e => fetch('/result', {method:'POST',body:JSON.stringify({error:String(e?.stack || e)})})
      window.onerror = (_,a,b,c,e) => fail(e)
      window.onunhandledrejection = e => fail(e.reason)
      import('/probe.js').catch(fail)
      </script>`);
  } else {
    try {
      const path = resolve(dist, '.' + new URL(req.url, 'http://localhost').pathname);
      if (!path.startsWith(dist + sep)) throw new Error('Invalid asset path');
      const data = await readFile(path);
      res.setHeader('Content-Type', path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  }
});
let chrome;
const timer = setTimeout(
  () => rejectProbe(new Error("Chromium probe timed out")),
  timingOnly ? 600000 : 180000,
);
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  chrome = spawn(
    process.env.CHROME_PATH ?? "chromium",
    [
      "--headless",
      ...(timingOnly ? ["--remote-debugging-port=0"] : []),
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-background-timer-throttling",
      "--disable-gpu",
      "--user-data-dir=" + join(profile, "chrome"),
      "http://127.0.0.1:" + port + "/",
    ],
    { stdio: "ignore" },
  );
  chrome.on("error", rejectProbe);
  console.log(JSON.stringify(await result));
} finally {
  clearTimeout(timer);
  chrome?.kill();
  server.close();
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
}
