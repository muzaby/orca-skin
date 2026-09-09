// Codex 작성. 기존 fixture 모듈을 번들로 재사용하며 사용자 데이터에 접근하지 않는다.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
const dir = path.dirname(fileURLToPath(import.meta.url)),
  repo = path.resolve(dir, "../../../.."),
  app = path.join(repo, "app");
const require = createRequire(path.join(app, "package.json"));
const cache = fs.mkdtempSync(
  path.join(app, "node_modules/.cache/orca/panel-r6-"),
);
await require("esbuild").build({
  entryPoints: [path.join(dir, "panel-r6-native-browser.tsx")],
  outfile: path.join(cache, "panel.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  minify: true,
  nodePaths: [path.join(app, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
  alias: { "@source": path.join(app, "src") },
});
const assets = path.join(app, "out/renderer/assets"),
  css = fs.readdirSync(assets).filter((f) => f.endsWith(".css"));
if (css.length !== 1) throw new Error("Expected one built stylesheet");
fs.writeFileSync(
  path.join(cache, "panel.html"),
  `<!doctype html><html lang="ko" data-theme="white"><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(assets, css[0])).href}"><style>body{margin:0}#root{height:100vh}</style><div id="root"></div><script src="panel.js"></script></html>`,
);
const files = [
  "components/AgentModeToggle.tsx",
  "components/CwdPanel.tsx",
  "components/Composer.tsx",
  "components/composer/BranchChip.tsx",
  "components/composer/modelSelection.ts",
  "components/composer/modes.ts",
].map((f) => "app/src/renderer/src/features/chat/" + f);
files.push(
  "app/src/renderer/src/features/sessions/components/SessionRow.tsx",
  "app/src/renderer/src/shared/ui/Icon.tsx",
  "app/src/shared/model-identity.ts",
  "app/src/main/features/harnesses/claude/model-parser.ts",
  path.relative(repo, path.join(assets, css[0])),
);
fs.writeFileSync(
  path.join(cache, "manifest.json"),
  JSON.stringify(
    Object.fromEntries(
      files.map((f) => [
        f,
        createHash("sha256")
          .update(fs.readFileSync(path.join(repo, f)))
          .digest("hex"),
      ]),
    ),
    null,
    2,
  ),
);
console.log(cache);
