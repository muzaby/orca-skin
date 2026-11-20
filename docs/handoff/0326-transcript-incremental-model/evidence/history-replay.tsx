import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  chatActions,
  useChatStore,
} from "/src/renderer/src/features/chat/store/chatStore";
import { generateTranscriptFixture } from "/src/renderer/src/features/chat/dev/transcriptFixtures";
import { HarnessScrollController } from "/src/renderer/src/features/chat/components/transcript/HarnessScrollController";
import { TranscriptView } from "/src/renderer/src/features/chat/components/transcript/TranscriptView";
import appCss from "/src/renderer/src/styles/app.css?inline";

const style = document.createElement("style");
style.textContent =
  appCss +
  "#root {display:flex;flex-direction:column;width:640px;height:150px;} .app-frame-transcript {height:150px;min-height:0;width:640px;overflow:auto;}";
document.head.appendChild(style);
const frames = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame);
};
function check(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const observations = [];
for (const [kind, backend, agentKind] of [
  ["claude-code", "claude", "code"],
  ["claude-work", "claude", "work"],
  ["opencode", "opencode", "code"],
] as const) {
  const id = "replay-" + kind;
  const fixture = generateTranscriptFixture(kind, {
    turns: 11,
    loadedTurns: 1,
  });
  const loads: string[] = [];
  let release!: () => void;
  const firstRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  window.oo = {
    session: {
      load: async (sessionId) => {
        loads.push(sessionId);
        await firstRead;
        return {
          id,
          title: kind,
          backend,
          agentKind,
          complete: false,
          messages: fixture.loadedMessages,
        };
      },
      refresh: async () => ({ status: "unchanged" }),
    },
    settings: { set: async () => ({}) },
    chat: { backgroundState: async () => ({ tasks: [], processes: [] }) },
  } as typeof window.oo;
  const loading = chatActions.loadSession(id);
  const initial = useChatStore.getState();
  check(
    loads.join() === id && initial.entryIntent?.cause === "open",
    kind + " first history load",
  );
  check(
    initial.sessions[id].session.loadingSession &&
      initial.sessions[id].session.messages.length === 0,
    kind + " unloaded entry",
  );
  const root = createRoot(document.querySelector("#root")!);
  function Screen() {
    const session = useChatStore((s) => s.sessions[id].session);
    return (
      <HarnessScrollController
        backend={backend}
        sessionId={id}
        sessionKey={id}
        messages={session.messages}
        sendCount={session.sendCount}
        inflight={session.inflight}
      >
        {(scroll) => (
          <TranscriptView
            {...scroll}
            backend={backend}
            agentKind={agentKind}
            messages={session.messages}
            pendingSteer={[]}
            inflight={session.inflight}
            loadingSession={session.loadingSession}
          />
        )}
      </HarnessScrollController>
    );
  }
  if (import.meta.env.VITE_HISTORY_READY) {
    release();
    await loading;
    flushSync(() => root.render(<Screen />));
  } else {
    flushSync(() => root.render(<Screen />));
    await frames(2);
    release();
    await loading;
  }
  await frames();
  check(
    useChatStore
      .getState()
      .sessions[id].session.messages.map((m) => m.id)
      .join() === "u:fx-10,a:fx-10",
    kind + " initial turn",
  );
  const viewport = document.querySelector<HTMLElement>("[data-harness]")!;
  check(
    viewport.querySelectorAll("[data-index]").length > 0,
    kind + " initial viewport has no mounted rows",
  );
  const bottom = viewport.scrollHeight - viewport.clientHeight;
  check(
    bottom > 0 && Math.abs(bottom - viewport.scrollTop) <= 1,
    kind +
      " open bottom " +
      JSON.stringify([viewport.scrollTop, bottom, viewport.clientHeight]),
  );
  check(useChatStore.getState().entryIntent === null, kind + " consumed open");
  const toolKey = "a:fx-10:tool:fx-tool-10-0";
  const toolSelector = '[data-part-key="' + toolKey + '"] [aria-expanded]';
  for (const group of document.querySelectorAll<HTMLElement>(
    '[data-focus-id="activity-toggle"],[data-component="context-tool-group"] [aria-expanded]',
  )) {
    if (
      !document.querySelector(toolSelector) &&
      group.getAttribute("aria-expanded") === "false"
    ) {
      group.click();
      await frames();
    }
  }
  const card = document.querySelector<HTMLElement>(toolSelector);
  check(
    card?.getAttribute("aria-expanded") === "false",
    kind + " missing collapsed real tool " + toolKey,
  );
  card.click();
  await frames();
  check(
    card.getAttribute("aria-expanded") === "true",
    kind + " open real card",
  );
  viewport.dispatchEvent(
    new WheelEvent("wheel", { deltaY: -100, bubbles: true }),
  );
  const userKey = "u:fx-10:user";
  const userSelector = '[data-part-key="' + userKey + '"]';
  const question = document.querySelector(userSelector)!;
  const walker = document.createTreeWalker(question, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while (
    (node = walker.nextNode()) &&
    !node.textContent?.includes("Fixture prompt #10")
  ) {}
  check(node, kind + " missing selectable user text");
  const range = document.createRange();
  range.setStart(node, 3);
  range.setEnd(node, 4);
  const glyph = () =>
    range.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
  viewport.scrollTop += glyph() - 12;
  await frames();
  check(
    glyph() >= 0 && glyph() <= 45,
    kind + " anchor outside viewport: " + glyph(),
  );
  const selection = document.getSelection()!;
  selection.setBaseAndExtent(node, 13, node, 3);
  document.dispatchEvent(new Event("selectionchange"));
  await frames();
  const selected = selection.toString();
  check(
    selected === node.textContent!.slice(3, 13),
    kind + " initial selection",
  );
  const top = glyph();
  const pages = [];
  for (const turn of [9, 8, 7]) {
    chatActions.prependHistory(id, fixture.remainingPrefixTurns[turn], {
      reachedStart: false,
    });
    await frames();
    const messages = useChatStore.getState().sessions[id].session.messages;
    const expected = Array.from({ length: 11 - turn }, (_, i) => [
      "u:fx-" + (turn + i),
      "a:fx-" + (turn + i),
    ]).flat();
    check(
      messages.map((m) => m.id).join() === expected.join(),
      kind + " transcript order " + turn,
    );
    check(
      question === document.querySelector(userSelector) && node.isConnected,
      kind + " lost user row " + turn,
    );
    check(
      document.querySelector(toolSelector)?.getAttribute("aria-expanded") ===
        "true",
      kind + " lost card " + turn,
    );
    check(
      selection.anchorNode === node &&
        selection.focusNode === node &&
        selection.anchorOffset === 13 &&
        selection.focusOffset === 3 &&
        selection.toString() === selected,
      kind + " lost reverse selection " + turn,
    );
    const drift = glyph() - top;
    check(
      Math.abs(drift) <= 1,
      kind +
        " moved glyph " +
        JSON.stringify({
          turn,
          drift,
          top,
          current: glyph(),
          scrollTop: viewport.scrollTop,
        }),
    );
    pages.push({ turn, drift });
  }
  observations.push({
    kind,
    initialBottom: bottom,
    userKey,
    toolKey,
    anchorOffset: 13,
    focusOffset: 3,
    pages,
  });
  flushSync(() => root.unmount());
}
await fetch("/result", {
  method: "POST",
  body: JSON.stringify({ historyReplay: observations }),
});
