import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MemoryRouter } from "react-router-dom";
import { TweakProvider } from "@source/renderer/src/shared/theme";
import { ChatTile } from "@source/renderer/src/features/chat/components/ChatTile";
import {
  initialChatState,
  chatReducer,
} from "@source/renderer/src/features/chat/reducer/chatReducer";
import {
  useChatStore,
  ingestChatEvent,
} from "@source/renderer/src/features/chat/store/chatStore";
import {
  acquireArtifacts,
  useArtifactStore,
  refreshArtifactList,
} from "@source/renderer/src/features/chat/store/artifactStore";
import { closeArtifactViewer } from "@source/renderer/src/features/chat/store/artifactViewerStore";
import { SettingsSchema } from "@source/shared/protocol";

const report = {
  checks: {},
  errors: [],
  calls: [],
  boundary:
    "Actual ChatTile, virtual TranscriptView/Exchange/AssistantTurn, PendingAssistant/SparkSpinner, ArtifactCards/Viewer and event store/reducer. Synthetic IPC and persisted reload payload; Main hook/DB lineage is verified separately.",
};
window.nativeReport = report;
window.addEventListener("error", (event) =>
  report.errors.push(String(event.error?.stack || event.message)),
);
window.addEventListener("unhandledrejection", (event) =>
  report.errors.push(String(event.reason)),
);
const tick = () => new Promise((resolve) => setTimeout(resolve, 200));
const find = (selector) => document.querySelector(selector);
const all = (selector) => [...document.querySelectorAll(selector)];
const check = (name, value) => {
  report.checks[name] = !!value;
  if (!value) throw new Error(name);
};
const click = async (element) => {
  if (!element) throw new Error("Missing click target");
  flushSync(() => element.click());
  await tick();
};
const output = (id, category, title) => ({
  publicationId: id,
  artifactFileId: id,
  category,
  title,
  filename: id + ".md",
  kind: "markdown",
  publishedAt: 1,
  sizeBytes: 24,
});
const ordinary = output("ordinary", "file", "첫 번째 턴의 일반 파일");
const published = output("published", "artifact", "두 번째 턴의 게시 아티팩트");
const latest = output("latest", "file", "소유권 없는 과거 일반 파일");
window.orca = {
  platform: "win32",
  settings: {
    get: async () =>
      SettingsSchema.parse({ theme: "white", notifyOnComplete: false }),
    set: async () => undefined,
  },
  artifacts: {
    list: async () => [latest, published],
    status: async ({ publicationIds }) =>
      publicationIds.map((publicationId) => ({
        publicationId,
        artifactFileId: publicationId,
        availability: { state: "present", sizeBytes: 24, modifiedAt: 1 },
      })),
    preview: async (req) => {
      report.calls.push(["preview", req]);
      return {
        state: "ready",
        format: "markdown",
        mimeType: "text/markdown",
        content: "# 일반 파일 미리보기\n\n실제 카드에서 뷰어를 열었습니다.",
        language: "markdown",
      };
    },
    save: async (req) => {
      report.calls.push(["save", req]);
      return {
        outcome: "completed",
        items: req.publicationIds.map((publicationId) => ({
          publicationId,
          outcome: "saved",
        })),
      };
    },
    reveal: async (req) => {
      report.calls.push(["reveal", req]);
      return { ok: true };
    },
  },
  agent: { list: async () => [] },
  provider: { onState: () => () => {} },
  skills: { list: async () => [] },
  git: {
    status: async () => ({
      isRepo: false,
      branch: null,
      dirty: false,
      ahead: 0,
      behind: 0,
    }),
  },
  files: {
    pickDirectory: async () => null,
    openPath: async () => ({ ok: true }),
  },
  session: { addDirectory: async () => ({ ok: true, extraDirs: [] }) },
  chat: { onEvent: () => () => {} },
  permission: { respond: async () => {} },
};
const root = createRoot(document.getElementById("root"));
const text = (value) => ({ type: "text", text: value });
const messages = () => [
  {
    role: "user",
    createdAt: 1,
    parts: [text("첫 번째 결과를 만들어 주세요.")],
  },
  {
    role: "assistant",
    createdAt: 2,
    parts: [
      { type: "response_boundary", boundary: { phase: "begin", id: "first" } },
      text("첫 번째 확정 응답입니다."),
      {
        type: "tool_call",
        toolRunId: "write-1",
        toolName: "Write",
        args: { file_path: "C:/fixture/report.md" },
      },
      {
        type: "tool_result",
        toolRunId: "write-1",
        result: "ok",
        isError: false,
      },
    ],
  },
  {
    role: "user",
    createdAt: 3,
    parts: [text("이어서 두 번째 결과도 만들어 주세요.")],
  },
  {
    role: "assistant",
    createdAt: 4,
    parts: [
      { type: "response_boundary", boundary: { phase: "begin", id: "second" } },
      text("두 번째 확정 응답입니다."),
      { type: "artifact", artifact: published },
    ],
  },
];
const card = (id) =>
  find('.app-frame-transcript [data-artifact-preview="' + id + '"]')?.closest(
    "article",
  );
const spark = () => find('.app-frame-transcript svg[viewBox="0 0 100 100"]');
const body = (value) =>
  all(".app-frame-transcript p").find((node) => node.textContent === value);
const precedes = (a, b) =>
  a && b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const checkOrder = (label) => {
  const committed = body("두 번째 확정 응답입니다."),
    live = body("두 번째 실시간 응답이 이어집니다."),
    status = spark(),
    footer = card("published");
  check(
    label + "-committed-live-spark-card-dom-order",
    precedes(committed, live) &&
      precedes(live, status) &&
      precedes(status, footer),
  );
  check(
    label + "-live-spark-card-vertical-order",
    live.getBoundingClientRect().bottom <= status.getBoundingClientRect().top &&
      status.getBoundingClientRect().bottom <=
        footer.getBoundingClientRect().top,
  );
  check(
    label + "-exactly-one-spark",
    all('.app-frame-transcript svg[viewBox="0 0 100 100"]').length === 1,
  );
  check(
    label + "-cards-last-in-assistant-turn",
    footer.parentElement === footer.closest(".group\\/msg").lastElementChild,
  );
};
window.nativeMount = async (kind) => {
  closeArtifactViewer();
  useArtifactStore.setState({ sessions: {} });
  const session = {
    ...initialChatState,
    agentKind: kind,
    sessionId: "native-turn",
    title: "턴별 산출물",
    cwd: "C:/fixture",
    agentPanelInitialized: true,
    messages: messages(),
    inflight: true,
    turnStartedAt: Date.now(),
    activityForeground: "streaming",
    rightPanelTiles: [],
  };
  flushSync(() =>
    useChatStore.setState({
      activeKey: "native-turn",
      sessions: {
        "native-turn": {
          session,
          live: { text: "두 번째 실시간 응답이 이어집니다.", reasoning: "" },
          subagentMeta: {},
        },
      },
    }),
  );
  flushSync(() =>
    root.render(
      <MemoryRouter>
        <TweakProvider>
          <div className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg [font-family:var(--font-app)] text-[13px] leading-[1.45] text-ink">
            <ChatTile
              backendLabel="Claude"
              canAbort
              initialDraft="보존할 입력 초안"
            />
          </div>
        </TweakProvider>
      </MemoryRouter>,
    ),
  );
  await tick();
  await tick();
  check(
    kind + "-full-width-host",
    find("[data-chat-pane-content]").getBoundingClientRect().width >= 700,
  );
  checkOrder(kind);
  window.draft = find("textarea") || find('[contenteditable="true"]');
  check(
    kind + "-draft-present",
    (window.draft?.value || window.draft?.textContent) === "보존할 입력 초안",
  );
  return report;
};
window.nativeLate = async () => {
  const entry = useChatStore.getState().sessions["native-turn"];
  const currentTurn = card("published").closest(".group\\/msg");
  flushSync(() =>
    ingestChatEvent({
      type: "output.captured",
      sessionId: "native-turn",
      artifact: ordinary,
      toolRunId: "write-1",
    }),
  );
  await tick();
  await tick();
  check(
    "late-output-original-turn-before-next-user",
    precedes(
      card("ordinary"),
      all(".app-frame-transcript [data-app-exchange]")[1],
    ),
  );
  check(
    "late-output-keeps-live-reference",
    useChatStore.getState().sessions["native-turn"].live === entry.live,
  );
  check(
    "late-output-keeps-current-turn-dom",
    card("published").closest(".group\\/msg") === currentTurn,
  );
  check(
    "original-turn-metadata-before-card",
    precedes(
      card("ordinary")
        .closest(".group\\/msg")
        .querySelector('[title="메시지 복사"]'),
      card("ordinary"),
    ),
  );
  flushSync(() =>
    ingestChatEvent({
      type: "output.captured",
      sessionId: "native-turn",
      artifact: ordinary,
      toolRunId: "write-1",
    }),
  );
  await tick();
  check(
    "duplicate-delivery-one-card-per-turn",
    all('.app-frame-transcript [data-artifact-preview="ordinary"]').length ===
      1,
  );
  const releaseList = acquireArtifacts("native-turn", [], true);
  await refreshArtifactList("native-turn");
  await tick();
  check(
    "latest-list-actually-replaced",
    useArtifactStore
      .getState()
      .sessions["native-turn"].list.map((ref) => ref.publicationId)
      .join(",") === "latest,published",
  );
  check(
    "latest-list-does-not-hide-original-or-invent-ownerless-card",
    !!card("ordinary") && !card("latest"),
  );
  releaseList();
  const before = useChatStore.getState();
  flushSync(() =>
    ingestChatEvent({
      type: "output.captured",
      sessionId: "native-turn",
      artifact: latest,
      toolRunId: "missing",
      responseId: "second",
    }),
  );
  check(
    "unknown-tool-does-not-fallback-to-response-or-tail",
    useChatStore.getState() === before,
  );
  checkOrder("after-late");
  return report;
};
window.nativeActions = async () => {
  const ordinaryCard = card("ordinary");
  await click(
    [...ordinaryCard.querySelectorAll("button")].find(
      (node) => node.textContent.trim() === "다운로드",
    ),
  );
  check(
    "ordinary-save-exact-session-and-publication",
    report.calls.some(
      ([kind, req]) =>
        kind === "save" &&
        req.sessionId === "native-turn" &&
        req.publicationIds.join(",") === "ordinary",
    ),
  );
  await click([...ordinaryCard.querySelectorAll("button")].at(-1));
  await click(
    all('[data-context="floating"] button').find((node) =>
      /탐색기/.test(node.textContent),
    ),
  );
  check(
    "ordinary-reveal-exact-session-and-publication",
    report.calls.some(
      ([kind, req]) =>
        kind === "reveal" &&
        req.sessionId === "native-turn" &&
        req.publicationId === "ordinary",
    ),
  );
  await click(ordinaryCard.querySelector("[data-artifact-preview]"));
  check(
    "ordinary-preview-exact-session-and-publication",
    report.calls.some(
      ([kind, req]) =>
        kind === "preview" &&
        req.sessionId === "native-turn" &&
        req.publicationId === "ordinary",
    ),
  );
  check(
    "ordinary-common-viewer-ready",
    !!find('[data-artifact-viewer="ordinary"]') &&
      find("[data-artifact-viewer]").textContent.includes("일반 파일 미리보기"),
  );
  return report;
};
window.nativeReload = async () => {
  await click(find('[data-behavior="viewer:close"]'));
  check(
    "viewer-close-keeps-draft-dom-and-value",
    window.draft === (find("textarea") || find('[contenteditable="true"]')) &&
      (window.draft.value || window.draft.textContent) === "보존할 입력 초안",
  );
  const current = useChatStore.getState().sessions["native-turn"];
  const session = chatReducer(initialChatState, {
    type: "LOAD_SESSION",
    session: {
      agentKind: "work",
      id: "native-turn",
      backend: "claude",
      title: "턴별 산출물",
      messages: JSON.parse(JSON.stringify(current.session.messages)),
    },
  });
  flushSync(() =>
    useChatStore.setState({
      sessions: {
        "native-turn": {
          ...current,
          session,
          live: { text: "", reasoning: "" },
        },
      },
    }),
  );
  await tick();
  await tick();
  check(
    "reload-keeps-original-turn-card",
    !!card("ordinary") &&
      precedes(
        card("ordinary"),
        all(".app-frame-transcript [data-app-exchange]")[1],
      ),
  );
  check("reload-keeps-published-card", !!card("published"));
  check("reload-no-ownerless-card-or-spark", !card("latest") && !spark());
  return report;
};
window.nativeIdle = async () => {
  flushSync(() =>
    useChatStore.setState((state) => ({
      sessions: {
        "native-turn": {
          ...state.sessions["native-turn"],
          session: {
            ...state.sessions["native-turn"].session,
            inflight: false,
            turnStartedAt: null,
            activityForeground: "idle",
            activityBackgroundTaskCount: 1,
          },
          live: { text: "", reasoning: "" },
        },
      },
    })),
  );
  await tick();
  check(
    "background-idle-keeps-card-without-spark",
    !!card("published") && !spark(),
  );
  return report;
};
