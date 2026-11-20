import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { TranscriptView } from "/src/renderer/src/features/chat/components/transcript/TranscriptView";
import { initialChatState } from "/src/renderer/src/features/chat/reducer/chatReducer";
import { useChatStore } from "/src/renderer/src/features/chat/store/chatStore";
import { createDiagnosticDevApi } from "/src/renderer/src/features/chat/dev/transcriptFixtures";
import {
  SELECTION_COPY_SYNC_MAX_BLOCKS as cap,
  UI_TASK_BUDGET_MS,
} from "/src/renderer/src/features/chat/lib/transcript/viewport/copy";
import appCss from "/src/renderer/src/styles/app.css?inline";

const style = document.createElement("style");
style.textContent =
  appCss + "\nhtml, body, #root { height: 600px; width: 900px; }";
document.head.appendChild(style);
const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const api = createDiagnosticDevApi();
const results = [];
const stages = new Map<string, { ms: number; calls: number }>();
let inside = 0;
const outer = new Set([
  "syncFlush",
  "restoreSelection",
  "chunkMount",
  "chunkUnmount",
  "chunkSerialize",
  "handlerIndex",
]);
globalThis.copyPhase = (name, work) => {
  if (!inside && !outer.has(name)) return work();
  const start = performance.now();
  inside++;
  try {
    return work();
  } finally {
    inside--;
    const step = stages.get(name) ?? { ms: 0, calls: 0 };
    step.ms += performance.now() - start;
    step.calls++;
    stages.set(name, step);
  }
};
let lastWrite: Promise<void> | undefined;
const write = navigator.clipboard.write.bind(navigator.clipboard);
navigator.clipboard.write = (items) => (lastWrite = write(items));

async function clipboardContent() {
  const item = (await navigator.clipboard.read())[0];
  const text = await (await item.getType("text/plain")).text();
  const html = await (await item.getType("text/html")).text();
  const body = new DOMParser().parseFromString(html, "text/html").body;
  if (
    !text.trim() ||
    !text.includes("\n") ||
    !body.children.length ||
    body.querySelector("[data-copy-edge]")
  )
    throw new Error("Missing transcript clipboard content");
  return {
    text,
    htmlText: body.textContent,
    htmlChars: html.length,
    ...(import.meta.env.VITE_MARKDOWN_PAIR
      ? {
          partFragments: Array.from(
            body.querySelectorAll("[data-markdown-part-fragment]"),
            (el) => [
              el.localName,
              el.getAttribute("data-part-key"),
              el.textContent,
            ],
          ),
        }
      : {}),
    formatted: Array.from(
      body.querySelectorAll("strong,em,code,a,pre"),
      (el) => [el.localName, el.textContent, el.getAttribute("href")],
    ),
  };
}

for (const [backend, agentKind] of [
  ["claude", "code"],
  ["claude", "work"],
  ["opencode", "code"],
] as const) {
  const screen = backend + "-" + agentKind;
  if (
    import.meta.env.VITE_COPY_TIMING_SCREEN !== "all" &&
    import.meta.env.VITE_COPY_TIMING_SCREEN !== screen
  )
    continue;
  const key = "time-" + screen;
  const session = { ...initialChatState, sessionId: key, backend, agentKind };
  useChatStore.setState({
    activeKey: key,
    sessions: {
      [key]: {
        session,
        live: { text: "", reasoning: "", reasoningVisible: false },
        subagentMeta: {},
      },
    },
  });
  function Screen() {
    const state = useChatStore((s) => s.sessions[key].session);
    return (
      <TranscriptView
        backend={backend}
        agentKind={agentKind}
        messages={state.messages}
        inflight={false}
        loadingSession={false}
        anchored={false}
        pendingSteer={[]}
        scrollRef={React.useRef(null)}
        contentRef={React.useRef(null)}
        onScroll={() => {}}
      />
    );
  }
  const root = createRoot(document.querySelector("#root")!);
  flushSync(() => root.render(<Screen />));
  api.loadFixture("long", { turns: 1, minBlocks: 2 * cap + 3 });
  await frame();
  await frame();
  const viewport = document.querySelector<HTMLElement>(
    "[data-transcript-viewport]",
  )!;
  viewport.tabIndex = -1;
  viewport.focus({ preventScroll: true });
  let firstSelection:
    | {
        offset: number;
        clipboard: Awaited<ReturnType<typeof clipboardContent>>;
      }
    | undefined;
  let pairIndex = 0;
  const fullParser = [true, false, false, true, true, false];
  for (const size of import.meta.env.VITE_MARKDOWN_PAIR
    ? fullParser.map(() => 300)
    : import.meta.env.VITE_COPY_PROFILE
      ? [300, cap + 1]
      : import.meta.env.VITE_COPY_MINIMUM
        ? [100, 300]
        : [100, 300, cap, cap + 1, 2 * cap + 3]) {
    if (import.meta.env.VITE_MARKDOWN_PAIR) {
      globalThis.markdownReference = fullParser[pairIndex++];
    }
    let selected = false;
    let selectedOffset = 0;
    for (let offset = 0; offset < 32; offset++) {
      if (
        api.selectBlocks(offset, offset + size - 1, { partialEnds: true }) &&
        api.selectionInfo().blockCount === size
      ) {
        selected = true;
        selectedOffset = offset;
        break;
      }
    }
    if (!selected)
      throw new Error(
        "No selectable endpoints for " +
          screen +
          " " +
          size +
          " in " +
          api.blockCount(),
      );
    await frame();
    await frame();
    lastWrite = undefined;
    stages.clear();
    let trusted = false;
    viewport.addEventListener(
      "copy",
      (e) => {
        trusted = e.isTrusted;
      },
      { once: true },
    );
    const command = await fetch("/native-copy", { method: "POST" });
    if (!command.ok) throw new Error(await command.text());
    const { commandMs } = await command.json();
    const async = size > cap;
    const deadline = performance.now() + 120000;
    while (
      async &&
      !api.copyTimings().some((row) => row.kind === "assemble") &&
      performance.now() < deadline
    )
      await frame();
    const records = api.copyTimings();
    const expectedChunks = async
      ? Array.from({ length: Math.ceil(size / cap) }, (_, i) =>
          Math.min(cap, size - i * cap),
        )
      : [];
    const expected = [
      ["handler", async ? 0 : size],
      ...expectedChunks.map((count) => ["chunk", count]),
      ...(async ? [["assemble", size]] : []),
    ];
    if (
      !trusted ||
      JSON.stringify(
        records.map(({ kind, blockCount }) => [kind, blockCount]),
      ) !== JSON.stringify(expected)
    ) {
      throw new Error(
        JSON.stringify({
          screen,
          size,
          trusted,
          records,
          selection: api.selectionInfo(),
        }),
      );
    }
    if (async && !lastWrite) throw new Error("Async clipboard write missing");
    await lastWrite;
    const clipboard = await clipboardContent();
    if (import.meta.env.VITE_MARKDOWN_PAIR && firstSelection) {
      for (const field of [
        "text",
        "htmlText",
        "formatted",
        "partFragments",
      ] as const) {
        if (
          JSON.stringify(clipboard[field]) !==
          JSON.stringify(firstSelection.clipboard[field])
        )
          throw new Error("Paired clipboard mismatch: " + field);
      }
    }
    if (size === 300) firstSelection = { offset: selectedOffset, clipboard };
    const row = {
      screen,
      size,
      cap,
      trusted,
      commandMs,
      ...(import.meta.env.VITE_MARKDOWN_PAIR
        ? { parser: globalThis.markdownReference ? "full" : "fast" }
        : {}),
      chars: clipboard.text.length,
      htmlChars: clipboard.htmlChars,
      ...(import.meta.env.VITE_COPY_PROFILE
        ? { phases: Object.fromEntries(stages) }
        : {}),
      events: records.map((e) => ({ ...e })),
    };
    await fetch("/timing-sample", {
      method: "POST",
      body: JSON.stringify(row),
    });
    results.push(row);
    await frame();
    await frame();
  }
  if (!firstSelection) throw new Error("300-block reference sample missing");
  // long fixtures have the same deterministic prefix for every length.
  api.loadFixture("long", { turns: 1, minBlocks: 340 });
  api.setVirtualization(false);
  await frame();
  await frame();
  viewport.focus({ preventScroll: true });
  const { offset, clipboard } = firstSelection;
  if (
    !api.selectBlocks(offset, offset + 299, { partialEnds: true }) ||
    api.selectionInfo().blockCount !== 300
  )
    throw new Error("Nonvirtual reference endpoints missing");
  const command = await fetch("/native-copy", { method: "POST" });
  if (!command.ok) throw new Error(await command.text());
  const reference = await clipboardContent();
  for (const field of ["text", "htmlText", "formatted"] as const) {
    const actual = JSON.stringify(clipboard[field]);
    const expected = JSON.stringify(reference[field]);
    if (actual !== expected) {
      let index = 0;
      while (index < actual.length && actual[index] === expected[index])
        index++;
      throw new Error(
        JSON.stringify({
          screen,
          field,
          firstDifference: index,
          actual: actual.slice(Math.max(0, index - 20), index + 65),
          expected: expected.slice(Math.max(0, index - 20), index + 65),
        }),
      );
    }
  }
  await fetch("/timing-sample", {
    method: "POST",
    body: JSON.stringify({
      screen,
      reference300: "plain, HTML text and formatting equal",
    }),
  });
  flushSync(() => root.unmount());
  api.setVirtualization(true);
}
await fetch("/result", {
  method: "POST",
  body: JSON.stringify({
    cases: results.length,
    budgetMs: UI_TASK_BUDGET_MS,
    casesOverBudget: results.filter(({ events }) =>
      events.some(({ durationMs }) => durationMs > UI_TASK_BUDGET_MS),
    ).length,
    maxTaskMs: Math.max(
      ...results.flatMap(({ events }) =>
        events.map(({ durationMs }) => durationMs),
      ),
    ),
  }),
});
