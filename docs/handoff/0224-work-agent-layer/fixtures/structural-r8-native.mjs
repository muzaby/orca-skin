// Codex 작성. R8 전용 actual renderer fixture; historical fixture는 수정하지 않는다.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
const fixture = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(fixture, "../../../..");
const app = path.join(repo, "app");
const require = createRequire(path.join(app, "package.json"));
const cache = fs.mkdtempSync(
  path.join(app, "node_modules/.cache/orca/structural-r8-"),
);
const build = await require("esbuild").build({
  absWorkingDir: repo,
  entryPoints: [path.join(fixture, "structural-r8-native-browser.tsx")],
  outfile: path.join(cache, "fixture.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  minify: true,
  metafile: true,
  nodePaths: [path.join(app, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@source": path.join(app, "src") },
});
const assets = path.join(app, "out/renderer/assets");
const styles = fs.readdirSync(assets).filter((name) => name.endsWith(".css"));
if (styles.length !== 1)
  throw new Error("Expected one final production stylesheet");
const css = path.join(assets, styles[0]);
fs.writeFileSync(
  path.join(cache, "fixture.html"),
  `<!doctype html><html lang="ko" data-theme="white"><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(css).href}"><style>body{margin:0}#root{height:100vh;display:flex;min-width:0}</style><div id="root"></div><script src="fixture.js"></script></html>`,
);
const files = [
  ...Object.keys(build.metafile.inputs).filter(
    (name) =>
      name.startsWith("app/src/") || name.includes("fixtures/structural-r8-"),
  ),
  path.relative(repo, css),
  path.relative(repo, fileURLToPath(import.meta.url)),
  path.relative(repo, path.join(fixture, "structural-r8-native-runner.cjs")),
];
fs.writeFileSync(
  path.join(cache, "manifest.json"),
  JSON.stringify(
    {
      author: "Codex",
      scope:
        "Actual production components/store/parser/CSS; synthetic IPC only; no SDK, user DB, shell or file operations",
      files: Object.fromEntries(
        files.map((name) => [
          name,
          createHash("sha256")
            .update(fs.readFileSync(path.join(repo, name)))
            .digest("hex"),
        ]),
      ),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      cache,
      run: [
        path.join(app, "node_modules/electron/dist/electron.exe"),
        path.join(fixture, "structural-r8-native-runner.cjs"),
        cache,
      ],
    },
    null,
    2,
  ),
);
