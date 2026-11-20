import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { TranscriptView } from "/src/renderer/src/features/chat/components/transcript/TranscriptView";
import {
  ingestChatEvent,
  useChatStore,
} from "/src/renderer/src/features/chat/store/chatStore";
import { initialChatState } from "/src/renderer/src/features/chat/reducer/chatReducer";

import { createDiagnosticDevApi } from "/src/renderer/src/features/chat/dev/transcriptFixtures";
import { Markdown } from "/src/renderer/src/shared/ui/markdown/Markdown";

declare global {
  var bubbleRenders: number;
  var rowRenders: number;
}
const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const settle = async () => {
  await frame();
  await frame();
  await frame();
};
const results = [];
for (const [backend, agentKind] of [
  ["claude", "code"],
  ["claude", "work"],
  ["opencode", "code"],
] as const) {
  globalThis.bubbleRenders = 0;
  globalThis.rowRenders = 0;
  const messages = [
    {
      id: "u:old",
      role: "user",
      createdAt: 0,
      parts: [{ type: "text", text: "retained question" }],
    },
  ];
  const session = {
    ...initialChatState,
    sessionId: "s",
    backend,
    agentKind,
    messages,
    inflight: true,
  };
  useChatStore.setState({
    activeKey: "s",
    sessions: {
      s: {
        session,
        live: { text: "", reasoning: "", reasoningVisible: false },
        subagentMeta: {},
      },
    },
  });
  const root = createRoot(document.querySelector("#root")!);
  flushSync(() =>
    root.render(
      <TranscriptView
        backend={backend}
        agentKind={agentKind}
        messages={messages}
        inflight
        loadingSession={false}
        anchored={false}
        pendingSteer={[]}
        scrollRef={{ current: null }}
        contentRef={{ current: null }}
        onScroll={() => {}}
      />,
    ),
  );
  const delta = (type, text) =>
    ingestChatEvent({
      type,
      sessionId: "s",
      messageKey: "a:live",
      delta: { text },
    });
  await settle();
  delta("message.delta", "first");
  delta("message.reasoning.delta", "thinking");
  await settle();
  const rowBaseline = globalThis.rowRenders;
  const baseline = globalThis.bubbleRenders;
  if (
    baseline === 0 || rowBaseline === 0 ||
    !document.body.textContent.includes("retained question")
  )
    throw new Error(backend + " historical bubble missing");
  for (let i = 0; i < 5; i++) {
    delta("message.delta", " more");
    delta("message.reasoning.delta", " step");
    await settle();
  }
  const live = useChatStore.getState().sessions.s.live;
  const rerenders = globalThis.bubbleRenders - baseline;
  if (
    rerenders || globalThis.rowRenders !== rowBaseline ||
    !live.text.endsWith(" more".repeat(5)) ||
    !live.reasoning.endsWith(" step".repeat(5))
  )
    throw new Error(JSON.stringify({ backend, agentKind, rerenders, rowRenders: globalThis.rowRenders - rowBaseline, live }));
  results.push({
    backend,
    agentKind,
    mountedBubbleRenders: baseline,
    unrelatedBubbleRenders: rerenders,
    unrelatedRowRenders: globalThis.rowRenders - rowBaseline,
  });
  function FixtureScreen() {
    const state = useChatStore(store => store.sessions.s.session);
    return <TranscriptView backend={backend} agentKind={agentKind} messages={state.messages} inflight={state.inflight} loadingSession={false} anchored={false} pendingSteer={[]} scrollRef={React.useRef(null)} contentRef={React.useRef(null)} onScroll={() => {}}/>;
  }
  const api = createDiagnosticDevApi();
  flushSync(() => root.render(<FixtureScreen />));
  api.loadFixture('long', { turns: 4, loadedTurns: 1 });
  await settle();
  const before = api.blockCount();
  if (!before || api.prependFixtureTurn().remainingTurns !== 2) throw new Error('fixture prepend ' + before);
  await settle();
  if (api.blockCount() <= before) throw new Error('fixture prepend count');
  api.appendFixtureTurn();
  await settle();
  const question = 'u:fx-4:user';
  if (!api.selectBlocks('u:fx-2:user', question, {reverse:true, partialEnds:true})) throw new Error('fixture select ' + backend);
  const info = api.selectionInfo();
  if (info.endpoints?.anchor.blockKey !== question || info.blockCount < 3) throw new Error('fixture endpoints ' + JSON.stringify(info));
  api.streamFixture(1024);
  await settle();
  await settle();
  const streamed = useChatStore.getState().sessions.s.session.messages.at(-1);
  if (!streamed?.parts.some(p => p.type === 'text' && p.text.length === 1024)) throw new Error('fixture stream ' + JSON.stringify(streamed));
  flushSync(() => root.unmount());
}
const highlighted = createRoot(document.querySelector("#root")!);
const code = '```javascript\nconst splitToken = 1\n```';
const parts = [{start: 0, key: 'left'}, {start: code.indexOf('Token'), key: 'right'}];
flushSync(() => highlighted.render(<Markdown source={code} sourceParts={parts} />));
const deadline = performance.now() + 15000;
while (!document.querySelector('.shiki code') && performance.now() < deadline) await frame();
const tokens = document.querySelector('.shiki code');
const marked = key => Array.from(tokens?.querySelectorAll('[data-part-key="' + key + '"]') ?? [], span => span.textContent).join('');
if (marked('left') !== 'const split' || marked('right') !== 'Token = 1') throw new Error('Highlighted part boundaries: ' + tokens?.outerHTML);
flushSync(() => highlighted.unmount());
await fetch("/result", { method: "POST", body: JSON.stringify(results) });
