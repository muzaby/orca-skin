// Codex 작성. 실제 Main 폴더 handler/SQLite/history를 native UI 인수에 연결한다.
// prepare는 Node에서, 생성된 createDirectoryHost는 설치된 SQLite ABI의 Electron에서 실행한다.
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixture = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(fixture, "../../../../app");
const require = createRequire(path.join(app, "package.json"));

export async function prepareDirectoryHost(cache) {
  const outfile = path.join(cache, "directory-host.cjs");
  const result = await require("esbuild").build({
    absWorkingDir: app,
    metafile: true,
    stdin: {
      contents: `
        import Database from 'better-sqlite3'
        import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs'
        import path from 'node:path'
        import { addSessionDirectory } from './src/main/app/handlers/session-directory'
        import { registerFilesHandlers } from './src/main/app/handlers/files'
        import { DbQueries } from './src/main/infra/db/queries'
        import { applyMigrations } from './src/main/infra/db/migrate'
        import { loadSession } from './src/main/features/history/reader'
        import { AddSessionDirectorySchema, CHANNELS } from './src/shared/protocol'
        import { fixturePort } from 'electron'

        export function createDirectoryHost(cache: string) {
          const root = mkdtempSync(path.join(cache, 'directory-host-'))
          const cwd = path.join(root, 'Downloads')
          const directory = path.join(root, 'References')
          mkdirSync(cwd)
          mkdirSync(directory)
          const db = new Database(path.join(root, 'fixture.sqlite'))
          db.pragma('foreign_keys = ON')
          applyMigrations(db)
          const queries = new DbQueries(db)
          const sessionId = 'directory-work'
          queries.insertSession({
            id: sessionId, backend: 'claude', title: 'Directory fixture',
            projectId: null, createdAt: 1, cwd, agentKind: 'work'
          })
          const messageId = queries.appendMessage({
            sessionId, role: 'user', content: 'synthetic', createdAt: 1
          })
          queries.appendPart({
            messageId, type: 'text', toolRunId: null,
            payloadJson: JSON.stringify({ text: 'synthetic' })
          })
          let busy = false
          registerFilesHandlers({ db: queries, getCwd: () => cwd })
          return {
            sessionId,
            cwd: realpathSync(cwd),
            directory: realpathSync(directory),
            async addDirectory(request: unknown) {
              const parsed = AddSessionDirectorySchema.safeParse(request)
              if (!parsed.success) return { ok: false, reason: 'invalid-directory' }
              return addSessionDirectory({ db: queries, isSessionBusy: () => busy }, parsed.data)
            },
            load(id: string = sessionId) { return loadSession(queries, id, () => cwd) },
            setBusy(value: boolean) { busy = value },
            openPath(request: unknown) {
              return fixturePort.handlers.get(CHANNELS.filesOpenPath)({}, request)
            },
            openState() { return { calls: [...fixturePort.calls], pending: fixturePort.pending !== null } },
            setOpenFailure(value: string) { fixturePort.failure = value },
            setOpenDeferred(value: boolean) { fixturePort.deferred = value },
            releaseOpen() { fixturePort.pending?.(); fixturePort.pending = null },
            close() { if (db.open) db.close() }
          }
        }
      `,
      resolveDir: app,
      sourcefile: "panel-directory-host.ts",
      loader: "ts",
    },
    outfile,
    bundle: true,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "fixture-os-port",
        setup(build) {
          build.onResolve({ filter: /^electron$/ }, () => ({
            path: "electron",
            namespace: "fixture-os-port",
          }));
          build.onLoad({ filter: /.*/, namespace: "fixture-os-port" }, () => ({
            contents: `
              export const fixturePort = { handlers: new Map(), calls: [], failure: '', deferred: false, pending: null }
              export const ipcMain = { handle: (channel, listener) => fixturePort.handlers.set(channel, listener) }
              export const shell = {
                async openPath(path) {
                  fixturePort.calls.push(path)
                  if (fixturePort.deferred) await new Promise(resolve => { fixturePort.pending = resolve })
                  return fixturePort.failure
                },
                showItemInFolder() { throw new Error('Unexpected reveal call in Context fixture') }
              }
              export const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }
            `,
            loader: "js",
          }));
        },
      },
      {
        name: "migration-sql",
        setup(build) {
          build.onResolve({ filter: /\.sql\?raw$/ }, (args) => ({
            path: path.resolve(args.resolveDir, args.path.slice(0, -4)),
            namespace: "migration-sql",
          }));
          build.onLoad(
            { filter: /.*/, namespace: "migration-sql" },
            (args) => ({
              contents: readFileSync(args.path, "utf8"),
              loader: "text",
            }),
          );
        },
      },
    ],
  });
  const sources = Object.keys(result.metafile.inputs)
    .map((file) => path.resolve(app, file.replace(/^migration-sql:/, "")))
    .filter((file) => existsSync(file));
  sources.push(fileURLToPath(import.meta.url));
  const hash = (file) =>
    createHash("sha256").update(readFileSync(file)).digest("hex");
  writeFileSync(
    path.join(cache, "directory-host-manifest.json"),
    JSON.stringify(
      {
        scope:
          "Actual session directory and files open handlers/schema, SQLite queries/migrations and history loader. Electron shell is an injected recording/failure port; Explorer is never opened. Isolated synthetic session/directories.",
        bundle: { file: path.basename(outfile), sha256: hash(outfile) },
        files: Object.fromEntries(
          sources.map((file) => [
            path.relative(app, file).replace(/\\/g, "/"),
            hash(file),
          ]),
        ),
      },
      null,
      2,
    ),
  );
  return outfile;
}
