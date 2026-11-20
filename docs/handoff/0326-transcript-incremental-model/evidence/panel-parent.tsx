import { LegacySubAgentContent } from "/src/renderer/src/features/chat/harnesses/claude/rightpanel/LegacySubAgentTile";
import { TranscriptRuntimeProvider } from "/src/renderer/src/features/chat/harnesses/common/transcript/TranscriptRuntime";
import { assistantRuntime } from "/src/renderer/src/features/chat/harnesses/registries/assistant";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { OpenCodeAgentContent } from "/src/renderer/src/features/chat/harnesses/opencode/rightpanel/tiles";
import { initialChatState } from "/src/renderer/src/features/chat/reducer/chatReducer";
import {
  ingestChatEvent,
  useChatStore,
} from "/src/renderer/src/features/chat/store/chatStore";
import { transcriptIndexFor } from "/src/renderer/src/features/chat/lib/transcriptIndex";

declare global {
  var detailCalls: Record<string, number>;
}

const results = [];
for (const [backend, agentKind] of [
  ["opencode", "code"],
  ["claude", "code"],
  ["claude", "work"],
] as const) {
  globalThis.detailCalls = {};
  const key = backend + agentKind;
  useChatStore.setState({
    activeKey: key,
    sessions: {
      [key]: {
        session: {
          ...initialChatState,
          sessionId: key,
          backend,
          agentKind,
          selectedSubagentTaskId: "A",
        },
        live: { text: "", reasoning: "", reasoningVisible: false },
        subagentMeta: {},
      },
    },
  });
  function emit(event) {
    flushSync(() =>
      ingestChatEvent({ ...event, sessionId: key, messageKey: "a:1" }),
    );
  }
  function text(parentToolRunId: string, value: string) {
    emit({
      type: "message.completed",
      message: { text: value },
      parentToolRunId,
    });
  }
  for (const id of ["A", "B"]) {
    emit({
      type: "tool.call.started",
      toolRunId: id,
      toolName: "Agent",
      args: { description: id, prompt: "Prompt " + id },
    });
    text(id, "First " + id);
  }
  const root = createRoot(document.querySelector("#root")!);
  flushSync(() =>
    root.render(
      <TranscriptRuntimeProvider value={assistantRuntime(backend)}>
        {backend === "opencode" ? (
          <OpenCodeAgentContent />
        ) : (
          <LegacySubAgentContent />
        )}
      </TranscriptRuntimeProvider>,
    ),
  );
  const frames = async () => {
    for (let i = 0; i < 3; i++)
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
  };
  await frames();
  function index() {
    return transcriptIndexFor(useChatStore.getState().sessions[key].session);
  }
  const before = globalThis.detailCalls.A;
  const revision = index().parentRevision.get("A");
  if (!before || !document.body.textContent?.includes("First A"))
    throw new Error("A detail did not mount");
  text("B", "Second B");
  await frames();
  const afterText = globalThis.detailCalls.A;
  emit({
    type: "tool.call.started",
    toolRunId: "nested-b",
    toolName: "Read",
    args: { file_path: "/tmp/b" },
    parentToolRunId: "B",
  });
  await frames();
  const afterTool = globalThis.detailCalls.A;
  if (
    !index()
      .childMessage("B")
      ?.parts.some((p) => p.type === "text" && p.text.includes("Second B"))
  )
    throw new Error("B did not receive its child text");
  if (
    !index()
      .childMessage("B")
      ?.parts.some((p) => p.type === "tool_call" && p.toolRunId === "nested-b")
  )
    throw new Error("B did not receive its child tool");
  if (
    afterText !== before ||
    afterTool !== before ||
    index().parentRevision.get("A") !== revision
  )
    throw new Error(
      JSON.stringify({
        before,
        afterText,
        afterTool,
        revision,
        currentRevision: index().parentRevision.get("A"),
      }),
    );
  text("A", "Second A");
  await frames();
  const afterOwn = globalThis.detailCalls.A;
  if (afterOwn <= before || !document.body.textContent?.includes("Second A"))
    throw new Error("A failed its own child update");
  emit({
    type: "tool.call.completed",
    toolRunId: "A",
    result: "A finished",
    isError: false,
  });
  await frames();
  if (
    globalThis.detailCalls.A <= afterOwn ||
    (backend === "opencode" &&
      !document.body.textContent?.includes("A finished"))
  )
    throw new Error("A failed its own result update");
  flushSync(() => root.unmount());
  results.push({
    backend,
    agentKind,
    before,
    afterText,
    afterTool,
    afterOwn,
    afterResult: globalThis.detailCalls.A,
  });
}
await fetch("/result", { method: "POST", body: JSON.stringify(results) });
