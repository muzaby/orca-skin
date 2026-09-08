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
        import { DbQueries } from './src/main/infra/db/queries'
        import { applyMigrations } from './src/main/infra/db/migrate'
        import { loadSession } from './src/main/features/history/reader'
        import { AddSessionDirectorySchema } from './src/shared/protocol'

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
          "Actual session directory handler/schema, SQLite queries/migrations and history loader; isolated synthetic session and directories.",
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
