import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { emptyBackgroundState } from "/src/shared/background-task";
import { TaskContextContent } from "/src/renderer/src/features/chat/harnesses/common/rightpanel/TaskContextContent";
import { PlanTileContent } from "/src/renderer/src/features/chat/harnesses/common/rightpanel/PlanTileContent";
import { OpenCodeAgentContent } from "/src/renderer/src/features/chat/harnesses/opencode/rightpanel/tiles";
import { CanonicalBackgroundContent } from "/src/renderer/src/features/chat/harnesses/claude/rightpanel/CanonicalBackgroundContent";
import {
  LegacySubAgentContent,
  LegacySubAgentHeader,
} from "/src/renderer/src/features/chat/harnesses/claude/rightpanel/LegacySubAgentTile";
import { InlineSubagentDetail } from "/src/renderer/src/features/chat/harnesses/common/transcript/InlineSubagentDetail";
import { AgentTaskRow } from "/src/renderer/src/features/chat/harnesses/common/transcript/AgentTaskRow";
import { SubagentNoticeRow } from "/src/renderer/src/features/chat/harnesses/common/transcript/SubagentNoticeRow";
import { TranscriptRuntimeProvider } from "/src/renderer/src/features/chat/harnesses/common/transcript/TranscriptRuntime";
import { assistantRuntime } from "/src/renderer/src/features/chat/harnesses/registries/assistant";
import { openCodeTranscript } from "/src/renderer/src/features/chat/harnesses/opencode/presentation";
import { initialChatState } from "/src/renderer/src/features/chat/reducer/chatReducer";
import {
  ingestChatEvent,
  useChatStore,
} from "/src/renderer/src/features/chat/store/chatStore";
import { useBackgroundStore } from "/src/renderer/src/features/chat/store/backgroundStore";
import { transcriptIndexFor } from "/src/renderer/src/features/chat/lib/transcriptIndex";

const visits = new Map<string, number>();
globalThis.panelVisits = (site) =>
  visits.set(site, (visits.get(site) ?? 0) + 1);
const key = "nine";
useChatStore.setState({
  activeKey: key,
  sessions: {
    [key]: {
      session: {
        ...initialChatState,
        sessionId: key,
        backend: "opencode",
        selectedSubagentTaskId: "A",
      },
      live: { text: "", reasoning: "", reasoningVisible: false },
      subagentMeta: {},
    },
  },
});
useBackgroundStore.setState({
  sessions: { [key]: { state: emptyBackgroundState(), loading: false } },
});
function emit(event) {
  flushSync(() =>
    ingestChatEvent({ ...event, sessionId: key, messageKey: "a:main" }),
  );
}
function state() {
  return useChatStore.getState().sessions[key].session;
}
for (const [id, tool] of [
  ["A", "Agent"],
  ["bash1", "Bash"],
  ["bash2", "Bash"],
])
  emit({
    type: "tool.call.started",
    toolRunId: id,
    toolName: tool,
    args: { command: "echo " + id, description: id },
  });
emit({
  type: "message.completed",
  parentToolRunId: "A",
  message: { text: "child ready" },
});
emit({
  type: "tool.call.completed",
  toolRunId: "A",
  result: "ok",
  isError: false,
});
const index = transcriptIndexFor(state());
const agent = index.subagentTasks()[0];
const root = createRoot(document.querySelector("#root")!);
flushSync(() =>
  root.render(
    <TranscriptRuntimeProvider value={assistantRuntime("opencode")}>
      <PlanTileContent
        emptyDescriptionKey="chat.taskTile.headerTitle"
        selectHintKey="chat.taskTile.headerTitle"
      />
      <TaskContextContent />
      <OpenCodeAgentContent />
      <CanonicalBackgroundContent />
      <LegacySubAgentHeader />
      <LegacySubAgentContent />
      <AgentTaskRow call={agent.call} transcriptPolicy={openCodeTranscript} />
      <SubagentNoticeRow
        status="completed"
        toolRunId="A"
        transcriptPolicy={openCodeTranscript}
      />
      <InlineSubagentDetail
        toolRunId="A"
        transcriptPolicy={openCodeTranscript}
      />
    </TranscriptRuntimeProvider>,
  ),
);
const frame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const deadline = performance.now() + 15000;
while (
  !document
    .querySelector('[data-subagent-inline="A"]')
    ?.textContent?.includes("child ready") &&
  performance.now() < deadline
)
  await frame();
if (
  !document
    .querySelector('[data-subagent-inline="A"]')
    ?.textContent?.includes("child ready")
)
  throw new Error("inline detail did not finish mounting");
await frame();
const prior = new Map(visits);
if (
  prior.size !== 13 ||
  new Set([...prior.keys()].map((site) => site.split("/")[0])).size !== 9
)
  throw new Error("missing hook sites " + JSON.stringify([...prior]));
emit({ type: "message.completed", message: { text: "unrelated output" } });
await frame();
await frame();
if (
  !state().messages.some((m) =>
    m.parts.some(
      (part) => part.type === "text" && part.text === "unrelated output",
    ),
  )
)
  throw new Error("unrelated text delivery missing");
const changes = Object.fromEntries(
  [...visits].map(([site, count]) => [site, count - prior.get(site)!]),
);
if (Object.values(changes).some((n) => n !== 0))
  throw new Error("unrelated consumer renders " + JSON.stringify(changes));
const before = index.openCodePanelModel().processes;
emit({
  type: "tool.call.completed",
  toolRunId: "bash2",
  result: "updated bash",
  isError: false,
});
await frame();
const after = transcriptIndexFor(state()).openCodePanelModel().processes;
if (
  before.length !== 2 ||
  after.length !== 2 ||
  before[0] !== after[0] ||
  before[1] === after[1] ||
  after[1].output !== "updated bash"
)
  throw new Error(
    "Bash process row identity " +
      JSON.stringify({
        firstStable: before[0] === after[0],
        secondStable: before[1] === after[1],
        output: after[1]?.output,
      }),
  );
flushSync(() => root.unmount());
await fetch("/result", {
  method: "POST",
  body: JSON.stringify({
    mounted: Object.fromEntries(prior),
    unrelatedRenders: changes,
    unchangedBashRow: before[0] === after[0],
    updatedBashRow: before[1] !== after[1],
  }),
});
