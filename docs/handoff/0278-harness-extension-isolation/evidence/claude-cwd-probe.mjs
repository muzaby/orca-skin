import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { query } from "../../../../app/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs";

const base = await mkdtemp(resolve("work/test-temp/verify-claude-cwd-"));
const config = join(base, "config");
const a = join(base, "repo");
const b = join(a, "child");
const write = async (file, value) => {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(
    file,
    typeof value === "string" ? value : JSON.stringify(value),
  );
};
await mkdir(b, { recursive: true });
execFileSync("git", ["init", "--quiet", a], { windowsHide: true });
const server = join(base, "mcp.cjs");
await write(
  server,
  `require('node:readline').createInterface({input:process.stdin}).on('line', line => {
  const q=JSON.parse(line); if(q.id===undefined) return;
  const result=q.method==='initialize'?{protocolVersion:q.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}}:q.method==='tools/list'?{tools:[]}:{};
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:q.id,result})+'\\n');
});`,
);
for (const cwd of [a, b]) {
  await write(join(cwd, ".mcp.json"), {
    mcpServers: { fixture: { command: process.execPath, args: [server] } },
  });
  await write(join(cwd, ".claude/settings.local.json"), {
    enabledMcpjsonServers: ["fixture"],
  });
}
await mkdir(config, { recursive: true });
await mkdir(join(base, "tmp"), { recursive: true });
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|PROGRAMFILES|PROGRAMFILES\(X86\))$/i.test(
      key,
    ),
  ),
);
Object.assign(env, {
  HOME: join(base, "home"),
  USERPROFILE: join(base, "home"),
  APPDATA: join(base, "home/AppData/Roaming"),
  LOCALAPPDATA: join(base, "home/AppData/Local"),
  TEMP: join(base, "tmp"),
  TMP: join(base, "tmp"),
  CLAUDE_CONFIG_DIR: config,
  ANTHROPIC_API_KEY: "local-fixture",
  ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  CLAUDE_CODE_USE_POWERSHELL_TOOL: "1",
});
const lives = [];
const start = async (cwd) => {
  const live = query({
    prompt: {
      async *[Symbol.asyncIterator]() {
        await new Promise(() => {});
        yield { type: "user", message: { role: "user", content: "unused" } };
      },
    },
    options: {
      cwd,
      env,
      settingSources: ["project", "local"],
      settings: { disableAllHooks: true },
    },
  });
  lives.push(live);
  await live.supportedCommands();
  for (let i = 0; i < 50; i++) {
    const found = (await live.mcpServerStatus()).find(
      (item) => item.name === "fixture",
    );
    if (found && found.status !== "pending")
      return { live, status: found.status };
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("MCP readiness timeout");
};
const timeout = setTimeout(() => {
  for (const live of lives) live.close();
  process.exitCode = 1;
}, 30000);
try {
  const first = await start(a);
  await first.live.toggleMcpServer("fixture", false);
  const child = await start(b);
  const state = JSON.parse(
    await readFile(join(config, ".claude.json"), "utf8"),
  );
  const entries = Object.entries(state.projects ?? {}).filter(([, value]) =>
    value.disabledMcpServers?.includes("fixture"),
  );
  console.log(
    JSON.stringify(
      {
        initialA: first.status,
        afterA: (await first.live.mcpServerStatus()).find(
          (item) => item.name === "fixture",
        )?.status,
        disabledSavedAt: entries.map(([key]) =>
          key.replaceAll("\\", "/") === a.replaceAll("\\", "/")
            ? "A Git root"
            : "other",
        ),
        firstB: child.status,
      },
      null,
      2,
    ),
  );
} finally {
  clearTimeout(timeout);
  for (const live of lives) live.close();
}
