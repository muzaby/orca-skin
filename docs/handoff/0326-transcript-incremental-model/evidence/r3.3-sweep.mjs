// Run from the repository root. --rows returns a JSONL location inventory.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const base = "5b489f82";
const directory = fileURLToPath(new URL(".", import.meta.url));
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const repo = git("rev-parse", "--show-toplevel").trim();
if (resolve(".") !== repo) throw Error("Run from the repository root");
const ts = createRequire(join(repo, "app/package.json"))("typescript");
const files = new Set(
  [
    ...git(
      "diff",
      "--no-renames",
      "--name-only",
      base,
      "--",
      "app/src",
      "app/scripts/measure-ui-inputs.mjs",
    ).split("\n"),
    ...git(
      "ls-files",
      "--others",
      "--exclude-standard",
      "app/src",
      "app/scripts/measure-ui-inputs.mjs",
    ).split("\n"),
  ].filter(
    (p) =>
      /\.(?:tsx?|mjs)$/.test(p) &&
      !/(?:\.test(?:fixture|Harness)?\.|\.spec\.|\/__tests__\/|\.d\.ts$|\/fixtures\/)/.test(
        p,
      ) &&
      existsSync(p),
  ),
);
// Family ownership follows §10 and §7-A. Shared files intentionally belong to multiple
// families. This is a file-level filter, not an inference that every branch is a rule.
const owners = {
  k: /\/(?:bootstrap|persistence-sender|persistence-receiver|send|turn-coordinator|turn-sinks|message-id|peer-protocol|ipc)\.ts$/,
  w: /\/(?:writer|persistence-sender|persistence-receiver|queries|native-history-queries|migrate|message-id)\.ts$/,
  i: /\/(?:native-projection|native-recovery|native-history-queries|session-load|message-id)\.ts$/,
  r: /\/(?:chatReducer|chatStore|mergeKey|heldParts)\.ts$/,
  l: /\/(?:chatReducer|chatStore|changeLog)\.ts$/,
  q: /\/(?:messageOrder|orderedToolParts|chatReducer|turnStart)\.ts$/,
  y: /\/(?:blockKeys|mergeKey|claudeBlocks|openCodeBlocks|workActivity|sourceParts|Markdown)\.tsx?$/,
  z: /\/(?:claudeBlocks|openCodeBlocks|workActivity|orderedToolParts|turns|Timeline|projection)\.tsx?$/,
  u: /\/blockList\.ts$/,
  s: /\/(?:segmentCache|parts|workActivity)\.ts$/,
  p: /\/(?:pin|reserve|entry|ScrollController|useScrollAnchor|chatStore|TranscriptViewport)\.tsx?$/,
  a: /\/(?:anchor|textOffset|TranscriptViewport|ScrollController)\.tsx?$/,
  d: /\/(?:disclosureStore|usePruneDisclosures|chatStore|Timeline|AgentTaskRow|AssistantSegment|ReasoningBlock|WorkActivity|WorkToolTimeline|ToolCard|ToolGroup|Text)\.tsx?$/,
  e: /\/(?:ToolCard|ToolGroup|ReasoningBlock|WorkActivity|TranscriptViewport|disclosureStore)\.tsx?$/,
  c: /\/(?:copy|range|textOffset|CopySerializationHost|TranscriptViewport|TranscriptView|AssistantSegment|Timeline|AgentTaskRow|UserBubbleText|Markdown|sourceParts)\.tsx?$/,
  m: /\/(?:bubbleMeasure|bubbleCollapse|UserBubbleText|UserMessage)\.tsx?$/,
  f: /\/(?:markdownBlocks|StreamingMarkdown|Markdown|sourceParts|CodeBlock)\.tsx?$/,
  x: /\/(?:transcriptIndex|useTaskBoard|useTaskContext|taskBoard|taskContext|canonicalBackground|chatStore|AgentViews|tiles|SubAgentTaskDetail|LegacySubAgentTile|CanonicalBackgroundContent|InlineSubagentDetail|AgentTaskRow|SubagentNoticeRow)\.tsx?$/,
  b: /\/(?:eventCoalescer|chatStore|chatReducer|openCodeBlocks|claudeBlocks|Timeline)\.tsx?$/,
  j: /\/measure-ui-inputs\.mjs$/,
  g: /\/(?:chatReducer|chatStore|turnStart|heldParts|mergeKey|transcriptFixtures)\.ts$/,
  v: /\/(?:TranscriptViewport|blockList|Timeline|claudeBlocks|openCodeBlocks)\.tsx?$/,
};
const corpus = readdirSync(directory)
  .filter((s) => /^r3\.[23].*\.jsonl$/.test(s))
  .flatMap((f) =>
    readFileSync(join(directory, f), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((s) => JSON.parse(s)),
  );
const changed = new Map();
let currentFile;
for (const line of git(
  "diff",
  "--no-renames",
  "--unified=0",
  base,
  "--",
  "app/src",
  "app/scripts/measure-ui-inputs.mjs",
).split("\n")) {
  if (line.startsWith("+++ b/")) {
    currentFile = line.slice(6);
    changed.set(currentFile, []);
    continue;
  }
  const hunk = /^@@ .*? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (hunk && changed.has(currentFile))
    changed.get(currentFile).push([+hunk[1], +hunk[1] + Number(hunk[2] ?? 1)]);
}
const untracked = new Set(
  git(
    "ls-files",
    "--others",
    "--exclude-standard",
    "app/src",
    "app/scripts/measure-ui-inputs.mjs",
  )
    .trim()
    .split("\n"),
);
const rows = [],
  unmappedFiles = [],
  metadata = {
    records: corpus.length,
    files: files.size,
    scoped: 0,
    locators: {},
    outside: [],
  };
const overlaps = (a, b, c, d) => a < d && c < b;
const intervalsByFile = new Map();
for (const record of corpus) {
  const path = "app/" + record.file;
  const src = existsSync(path) ? readFileSync(path, "utf8") : "";
  const positions = [];
  if (record.old)
    for (
      let pos = src.indexOf(record.old);
      pos >= 0;
      pos = src.indexOf(record.old, pos + record.old.length)
    )
      positions.push(pos);
  const chosen =
    record.mode === "replace_last"
      ? positions.at(-1)
      : record.occ !== undefined
        ? positions[record.occ]
        : positions.length === 1
          ? positions[0]
          : undefined;
  const status =
    chosen !== undefined
      ? "located"
      : positions.length
        ? "ambiguous"
        : "absent";
  metadata.locators[status] = (metadata.locators[status] ?? 0) + 1;
  let l = 0,
    r = 0;
  while (
    l < record.old.length &&
    l < record.new.length &&
    record.old[l] === record.new[l]
  )
    l++;
  while (
    r < record.old.length - l &&
    r < record.new.length - l &&
    record.old.at(-1 - r) === record.new.at(-1 - r)
  )
    r++;
  if (!intervalsByFile.has(path)) intervalsByFile.set(path, []);
  for (const at of chosen === undefined ? positions : [chosen])
    intervalsByFile
      .get(path)
      .push({
        id: record.id,
        at,
        end: at + record.old.length,
        lo: at + l,
        hi: at + record.old.length - r,
        ambiguous: chosen === undefined,
      });
}
for (const file of [...files].sort()) {
  const family = Object.keys(owners).filter((k) => owners[k].test(file));
  if (!family.length) unmappedFiles.push(file);
  else metadata.scoped++;
  const source = readFileSync(file, "utf8"),
    ext = file.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : file.endsWith(".mjs")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ext,
  );
  const hunks = untracked.has(file)
    ? [[1, Infinity]]
    : (changed.get(file) ?? []);
  const line = (pos) => ast.getLineAndCharacterOfPosition(pos).line + 1;
  const locators = intervalsByFile.get(file) ?? [];
  function add(kind, node) {
    const start = node.getStart(ast),
      end = node.getEnd();
    if (
      !hunks.some(
        ([lo, hi]) => lo < hi && line(start) < hi && line(end - 1) >= lo,
      )
    )
      return;
    const hits = { delta: [], context: [], ambiguous: [] };
    for (const item of locators) {
      if (!overlaps(start, end, item.at, item.end)) continue;
      const touched =
        item.lo === item.hi
          ? start <= item.lo && item.lo < end
          : overlaps(start, end, item.lo, item.hi);
      hits[item.ambiguous ? "ambiguous" : touched ? "delta" : "context"].push(
        item.id,
      );
    }
    const match = hits.delta.length
      ? "delta"
      : hits.context.length
        ? "context"
        : hits.ambiguous.length
          ? "ambiguous"
          : "none";
    rows.push({
      file,
      start,
      end,
      line: line(start),
      col: ast.getLineAndCharacterOfPosition(start).character + 1,
      kind,
      family,
      match,
      ids: hits[match] ?? [],
      expression: node.getText(ast).replace(/\s+/g, " ").slice(0, 220),
    });
  }
  function visit(n) {
    if (
      ts.isIfStatement(n) ||
      ts.isWhileStatement(n) ||
      ts.isDoStatement(n) ||
      ts.isSwitchStatement(n)
    )
      add(ts.SyntaxKind[n.kind], n.expression);
    else if (ts.isCaseClause(n)) add("case", n.expression);
    else if (ts.isForStatement(n) && n.condition) add("for", n.condition);
    else if (ts.isConditionalExpression(n)) {
      add("ternary", n.condition);
      add("ternary.true", n.whenTrue);
      add("ternary.false", n.whenFalse);
    } else if (
      ts.isSpreadAssignment(n) ||
      ts.isSpreadElement(n) ||
      ts.isJsxSpreadAttribute(n)
    )
      add("spread", n);
    else if (
      ts.isBinaryExpression(n) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(n.operatorToken.kind)
    ) {
      const op = n.operatorToken.getText(ast);
      add(op, n);
      add(op + ".left", n.left);
      add(op + ".right", n.right);
    } else if (ts.isReturnStatement(n)) {
      const isFinal =
        ts.isBlock(n.parent) &&
        ts.isFunctionLike(n.parent.parent) &&
        n.parent.statements.at(-1) === n;
      if (!isFinal) add("early-return", n);
    }
    ts.forEachChild(n, visit);
  }
  visit(ast);
}
metadata.outside = unmappedFiles;
const counts = (list) =>
  Object.fromEntries(
    ["delta", "context", "ambiguous", "none"].map((k) => [
      k,
      list.filter((r) => r.match === k).length,
    ]),
  );
const scoped = rows.filter((r) => r.family.length);
if (process.argv.includes("--rows"))
  for (const r of rows) console.log(JSON.stringify(r));
else
  console.log(
    JSON.stringify(
      {
        ...metadata,
        scopedNodes: counts(scoped),
        distinctSpans: new Set(
          scoped.map((r) => [r.file, r.start, r.end].join(":")),
        ).size,
        kinds: Object.fromEntries(
          [...new Set(scoped.map((r) => r.kind))]
            .sort()
            .map((k) => [k, scoped.filter((r) => r.kind === k).length]),
        ),
        outsideNodes: counts(rows.filter((r) => !r.family.length)),
        families: Object.fromEntries(
          Object.keys(owners).map((k) => [
            k,
            counts(scoped.filter((r) => r.family.includes(k))),
          ]),
        ),
      },
      null,
      2,
    ),
  );
