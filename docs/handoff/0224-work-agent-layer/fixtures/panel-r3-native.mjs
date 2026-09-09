// Codex 작성. 실제 renderer 구성요소 + 합성 데이터. 외부 모델 호출 없음.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { prepareDirectoryHost } from "./panel-directory-host.mjs";
const fixture = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(fixture, "../../../.."),
  app = path.join(repo, "app");
const require = createRequire(path.join(app, "package.json"));
const cache = fs.mkdtempSync(
  path.join(app, "node_modules/.cache/orca/panel-r3-"),
);
await require("esbuild").build({
  entryPoints: [path.join(fixture, "panel-r3-native-browser.tsx")],
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
await prepareDirectoryHost(cache);
const assets = path.join(app, "out/renderer/assets"),
  css = fs.readdirSync(assets).filter((n) => n.endsWith(".css"));
if (css.length !== 1)
  throw new Error("Expected one current production stylesheet");
fs.writeFileSync(
  path.join(cache, "panel.html"),
  '<!doctype html><html lang="ko" data-theme="white"><meta charset="utf-8"><link rel="stylesheet" href="' +
    pathToFileURL(path.join(assets, css[0])).href +
    '"><style>body{margin:0}#root{height:100vh}</style><div id="root"></div><script src="panel.js"></script></html>',
);
const files = [
  "components/rightpanel/RightPanel.tsx",
  "components/rightpanel/TaskTileContent.tsx",
  "components/rightpanel/TaskTileSections.tsx",
  "components/rightpanel/TaskContextContent.tsx",
  "components/rightpanel/PlanTileContent.tsx",
  "hooks/useDirectoryPicker.ts",
  "store/chatStore.ts",
  "components/rightpanel/WorkTaskProgress.tsx",
  "components/composer/ComposerInputController.tsx",
  "components/ChatTitleBar.tsx",
  "lib/rightPanelLayout.ts",
  "reducer/chatReducer.ts",
];
fs.writeFileSync(
  path.join(cache, "manifest.json"),
  JSON.stringify(
    {
      scope:
        "Actual RightPanel/ChatTitleBar/task/plan/context components, production store/actions/CSS, synthetic tool/artifact/picker data. Directory acceptance also uses actual validated Main handler, SQLite/history through isolated IPC; no model call.",
      files: Object.fromEntries(
        files.map((f) => [
          f,
          createHash("sha256")
            .update(
              fs.readFileSync(
                path.join(app, "src/renderer/src/features/chat", f),
              ),
            )
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
        path.join(fixture, "panel-r3-native-runner.cjs"),
        cache,
      ],
    },
    null,
    2,
  ),
);
