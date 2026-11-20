import React, { useRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  TranscriptViewport,
  setVirtualization,
} from "/src/renderer/src/features/chat/components/transcript/TranscriptViewport";
import { createBlockList } from "/src/renderer/src/features/chat/lib/transcript/blockList";
import { Markdown } from "/src/renderer/src/shared/ui/markdown/Markdown";

const sources = [
  "before **bold words** followed by [a link](https://example.org) and ordinary text ".repeat(
    4,
  ),
  "first paragraph\n\nsecond paragraph",
  "after [link](https://example.org) and `inline code` with the rest of the sentence",
];
const snapshot = (generation: number) =>
  createBlockList(
    sources.map((source, index) => ({
      key: `row-${generation}-${index}`,
      partKeys: [`part-${index}`],
      source,
    })),
  ).snapshot();
const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export async function probeCopyReflow(): Promise<void> {
  const root = createRoot(document.querySelector("#root")!);
  function Screen({
    width,
    rows,
  }: {
    width: number;
    rows: ReturnType<typeof snapshot>;
  }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    return (
      <div ref={scrollRef} style={{ width, height: 350, overflow: "auto" }}>
        <TranscriptViewport
          scrollRef={scrollRef}
          snapshot={rows}
          overscan={6}
          copyChunkSize={1}
          renderBlock={(block) => <Markdown source={block.source} />}
        />
      </div>
    );
  }
  function selectReverse(): void {
    function textUnder(selector: string): Node {
      const el = document.querySelector(selector)!;
      return document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
    }
    const anchor = textUnder('[data-part-key="part-2"] code');
    const focus = textUnder('[data-part-key="part-0"] strong');
    document.getSelection()!.setBaseAndExtent(anchor, 4, focus, 2);
    document.dispatchEvent(new Event("selectionchange"));
  }
  function assertSelection(text: string): void {
    const selection = document.getSelection()!;
    if (
      selection.toString() !== text ||
      selection.anchorOffset !== 4 ||
      selection.focusOffset !== 2
    )
      throw new Error("Copy reflow lost formatted endpoints");
  }
  const first = snapshot(1);
  try {
    setVirtualization(false);
    flushSync(() => root.render(<Screen rows={first} width={220} />));
    selectReverse();
    const fullSelection = document.getSelection()!;
    const reference = fullSelection.toString();
    const referenceHtmlText = fullSelection.getRangeAt(0).cloneContents().textContent;
    if (
      !reference.includes("a link") ||
      !reference.includes("first paragraph") ||
      !reference.includes("\n")
    )
      throw new Error("Incomplete copy reflow reference");
    setVirtualization(true);
    flushSync(() => root.render(<Screen rows={first} width={600} />));
    await frame();
    selectReverse();
    await frame();
    const oldAnchor = document.getSelection()!.anchorNode!;
    const oldFocus = document.getSelection()!.focusNode!;
    flushSync(() => root.render(<Screen rows={snapshot(2)} width={220} />));
    await frame();
    if (oldAnchor.isConnected || oldFocus.isConnected)
      throw new Error("Expected both ends to remount");
    assertSelection(reference);
    let items: ClipboardItem[] | undefined;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        write: async (value: ClipboardItem[]) => {
          items = value;
        },
      },
    });
    const event = new Event("copy", { bubbles: true, cancelable: true });
    document.querySelector("[data-transcript-viewport]")!.dispatchEvent(event);
    const deadline = performance.now() + 10000;
    while (!items && performance.now() < deadline) await frame();
    if (
      !event.defaultPrevented ||
      items?.length !== 1 ||
      (await (await items[0].getType("text/plain")).text()) !== reference
    )
      throw new Error("Copy reflow clipboard mismatch");
    const html = await (await items[0].getType("text/html")).text();
    const body = new DOMParser().parseFromString(html, "text/html").body;
    if (body.textContent !== referenceHtmlText || !body.querySelector("a") || body.querySelector("[data-copy-edge]"))
      throw new Error("Copy reflow HTML differs from original range");
    assertSelection(reference);
  } finally {
    flushSync(() => root.unmount());
    setVirtualization(true);
  }
}
