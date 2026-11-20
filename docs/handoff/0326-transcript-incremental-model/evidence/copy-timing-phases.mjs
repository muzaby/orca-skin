// Optional wall-time accounting. Keep React's callback/ref identities and all production work.
export function timingPhases(source, id) {
  const phase = (name, expression) =>
    `globalThis.copyPhase(${JSON.stringify(name)}, () => ${expression})`;
  const replace = (old, updated) => {
    if (source.split(old).length !== 2)
      throw new Error(
        "Copy profile source changed: " + id + " " + old.slice(0, 48),
      );
    source = source.replace(old, updated);
  };
  const call = (name, expression) =>
    replace(expression, phase(name, expression));
  if (id.endsWith("/TranscriptViewport.tsx")) {
    for (const [name, expression] of [
      ["syncFlush", "flushSync(() => setSyncCopyRange([lo, hi]))"],
      ["restoreSelection", "restoreSelection(scroller, domSel, sel)"],
      ["chunkMount", "flushSync(() => setAsyncChunkRange([cStart, cEnd]))"],
      ["chunkUnmount", "flushSync(() => setAsyncChunkRange(null))"],
      ["heightLayoutRead", "element.getBoundingClientRect().height"],
      ["rowRangeSort", "Array.from(merged).sort((a, b) => a - b)"],
    ])
      call(name, expression);
    replace(
      "const aIdx = selectionBlockIndex(snap, sel.anchor)",
      "const aIdx = " +
        phase("handlerIndex", "selectionBlockIndex(snap, sel.anchor)"),
    );
    replace(
      "const fIdx = selectionBlockIndex(snap, sel.focus)",
      "const fIdx = " +
        phase("handlerIndex", "selectionBlockIndex(snap, sel.focus)"),
    );
    replace(
      "): number[] => {\n      const snap = snapshotRef.current",
      '): number[] => globalThis.copyPhase("rangeExtractor", () => {\n      const snap = snapshotRef.current',
    );
    replace(
      "    },\n    [anchorKey, displacedAnchorIndex, retainedSelection",
      "    }),\n    [anchorKey, displacedAnchorIndex, retainedSelection",
    );
    replace(
      "(element: Element, entry?: ResizeObserverEntry) => {",
      '(element: Element, entry?: ResizeObserverEntry) => globalThis.copyPhase("rowMeasurement", () => {',
    );
    replace("      return height\n    },", "      return height\n    }),");
  } else if (id.endsWith("/@tanstack/virtual-core/dist/esm/index.js")) {
    replace(
      "this.measureElement = (node) => {",
      'this.measureElement = (node) => globalThis.copyPhase("virtualRowRef", () => {',
    );
    replace(
      "    };\n    this.resizeItem = (index, size) => {",
      "    });\n    this.resizeItem = (index, size) => {",
    );
  } else if (id.endsWith("/react-markdown/lib/index.js")) {
    replace(
      "export function Markdown(options) {",
      'export function Markdown(options) { return globalThis.copyPhase("reactMarkdown", () => {',
    );
    replace(
      "return post(processor.runSync(processor.parse(file), file), options)\n}",
      "return post(processor.runSync(processor.parse(file), file), options)\n})}",
    );
  } else if (id.endsWith("/transcript/viewport/copy.ts")) {
    call(
      "chunkSerialize",
      "hooks.serializeChunk(start, end, start === lo, end === hi)",
    );
  }
  return source;
}
