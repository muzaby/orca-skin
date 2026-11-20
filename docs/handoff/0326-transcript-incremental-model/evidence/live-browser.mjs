// Run from the repository with Node 24. CHROME_PATH may select a Chromium binary.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
const app = fileURLToPath(new URL("../../../../app/", import.meta.url));
const require = createRequire(join(app, "package.json"));
const { build } = await import(require.resolve("vite"));
const probe = fileURLToPath(new URL("./live-probe.tsx", import.meta.url));
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
  define: { "import.meta.env.VITE_OO_DIAGNOSTIC": JSON.stringify("1") },
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
    {
      name: "measure-committed-transcript-renders",
      enforce: "pre",
      transform(source, id) {
        if (id.endsWith("/TranscriptViewport.tsx")) {
          const expression = "renderBlock(block, vi.index, selected)";
          if (!source.includes(expression)) throw new Error("Virtual row render entry changed");
          return source.replace(expression, "(block.key === 'u:old:user' && globalThis.rowRenders++, " + expression + ")");
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
  180000,
);
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  chrome = spawn(
    process.env.CHROME_PATH ?? "chromium",
    [
      "--headless",
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
