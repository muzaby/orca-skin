import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  expect,
  it,
  vi,
} from "../../../../app/node_modules/vitest/dist/index.js";
import { readClaudeProjectSettings } from "../../../../app/src/main/adapters/claude/project-settings";
import { ClaudeProjectReconciliation } from "../../../../app/src/main/adapters/claude/project-reconciliation";
import { OpenCodeSessionContexts } from "../../../../app/src/main/adapters/opencode/v1/session-context";

it("keeps captured OpenCode defaults and isolates opposite MCP choices on one server", async () => {
  let enabled = true;
  const projects: Record<string, Record<string, boolean>> = {};
  const states = new Map<string, boolean>();
  const mutations: string[] = [];
  let subscriptions = 0;
  const pool = new OpenCodeSessionContexts(
    async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const directory =
        url.searchParams.get("directory") ??
        decodeURIComponent(request.headers.get("x-opencode-directory") ?? "");
      if (url.pathname === "/config") return Response.json({});
      if (url.pathname === "/mcp")
        return Response.json({
          docs: {
            status: (states.get(directory) ?? true) ? "connected" : "disabled",
          },
        });
      if (/\/mcp\/docs\/(connect|disconnect)$/.test(url.pathname)) {
        mutations.push(directory);
        states.set(directory, url.pathname.endsWith("/connect"));
        return Response.json(true);
      }
      if (url.pathname === "/global/event") {
        subscriptions++;
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ payload: { type: "server.connected", properties: {} } })}\n\n`,
                ),
              );
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      }
      throw new Error(`Unexpected endpoint ${url.pathname}`);
    },
    4096,
    {
      global: () => ({ "mcp:docs": enabled }),
      projectMcp: (directory) => projects[directory] ?? {},
      setProjectMcp: (directory, id, value) => {
        projects[directory] = { ...projects[directory], [id]: value };
      },
    },
  );
  const server = { url: "http://test.invalid", headers: {} };
  const signal = new AbortController().signal;
  try {
    const a = await pool.acquire(server, "C:/A");
    const b = await pool.acquire(server, "C:/B");
    // Change global defaults between acquisition and the first configuration request.
    enabled = false;
    await Promise.all([a.prepare(signal), b.prepare(signal)]);
    expect((await a.mcp(signal))[0].enabled).toBe(true);
    expect((await b.mcp(signal))[0].enabled).toBe(true);
    const c = await pool.acquire(server, "C:/C");
    await c.prepare(signal);
    expect((await c.mcp(signal))[0].enabled).toBe(false);
    mutations.length = 0;
    await a.mcpControl!.set("docs", false);
    const { revision } = await a.mcpControl!.policy.read("C:/A");
    expect(await a.mcpControl!.reconcile(revision, () => false)).toBe(
      "pending",
    );
    expect(mutations).toEqual([]);
    expect(await a.mcpControl!.reconcile(revision, () => true)).toBe("applied");
    expect(
      mutations.map((directory) => directory.replaceAll("\\", "/")),
    ).toEqual(["C:/A"]);
    expect((await a.mcp(signal, true))[0].enabled).toBe(false);
    expect((await b.mcp(signal, true))[0].enabled).toBe(true);
    expect(subscriptions).toBe(0); // Catalog reads do not require opening SSE.
  } finally {
    pool.close();
  }
});

it("keeps a child working directory unchanged when the Git-root working directory changes MCP state", async () => {
  const temp = mkdtempSync(resolve("work/test-temp/verify-native-isolation-"));
  const a = join(temp, "repo");
  const b = join(a, "child");
  const native = join(temp, "native");
  for (const directory of [join(a, ".git"), b, native])
    mkdirSync(directory, { recursive: true });
  const state = join(native, ".claude.json");
  writeFileSync(state, JSON.stringify({ projects: {} }));
  const set = vi.fn(async () => {});
  const sync = new ClaudeProjectReconciliation({
    cwd: b,
    root: native,
    configDirSpecified: true,
    plugins: {
      defaults: {},
      roots: [],
      skills: [],
      commands: [],
      files: [],
      installations: [],
    },
    list: async () => [
      {
        id: "docs",
        name: "docs",
        kind: "mcp",
        enabled: true,
        status: "connected",
        canToggle: true,
        source: "user",
      },
    ],
    set,
  });
  try {
    const before = readClaudeProjectSettings(b, native, true);
    // Only A's native persistent state changes. B has a distinct Orca project/cwd key.
    writeFileSync(
      state,
      JSON.stringify({ projects: { [a]: { disabledMcpServers: ["docs"] } } }),
    );
    const after = readClaudeProjectSettings(b, native, true);
    await sync.reconcile(after.revision, () => true);
    expect.soft(after.revision).toBe(before.revision);
    expect(set).not.toHaveBeenCalled();
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
