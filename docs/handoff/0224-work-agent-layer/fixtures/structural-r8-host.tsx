// Codex 작성. R8 synthetic IPC/세션 host. production 컴포넌트와 store를 그대로 조립한다.
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { NewChatLandingPage } from "@source/renderer/src/pages/NewChatLandingPage";
import { ProjectLandingPage } from "@source/renderer/src/pages/ProjectLandingPage";
import { Composer } from "@source/renderer/src/features/chat/components/Composer";
import { ChatTitleBar } from "@source/renderer/src/features/chat/components/ChatTitleBar";
import { RightPanel } from "@source/renderer/src/features/chat/components/rightpanel/RightPanel";
import { initialChatState } from "@source/renderer/src/features/chat/reducer/chatReducer";
import {
  useChatStore,
  useChatSession,
  chatActions,
  ingestChatEvent,
} from "@source/renderer/src/features/chat/store/chatStore";
import { useAgentStore } from "@source/renderer/src/shared/stores/agentStore";
import {
  useSessionsStore,
  sessionsActions,
} from "@source/renderer/src/features/sessions/store/sessionsStore";
import { SessionRow } from "@source/renderer/src/features/sessions/components/SessionRow";
import { useSessionHandlers } from "@source/renderer/src/app/hooks/useSessionHandlers";
import { useSessionCompletion } from "@source/renderer/src/app/hooks/useSessionCompletion";
import { agentUiPolicy } from "@source/renderer/src/features/chat/lib/agentPresentation";

export {
  React,
  flushSync,
  useChatStore,
  useChatSession,
  chatActions,
  ingestChatEvent,
  useAgentStore,
  useSessionsStore,
  sessionsActions,
  agentUiPolicy,
};
export const report = {
  checks: {},
  observations: {},
  errors: [],
  sendCalls: 0,
};
window.r8Report = report;
window.addEventListener("error", (event) =>
  report.errors.push(String(event.error?.stack || event.message)),
);
window.addEventListener("unhandledrejection", (event) =>
  report.errors.push(String(event.reason?.stack || event.reason)),
);
export const tick = async () => {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => setTimeout(resolve, 70));
};
export const check = (name, value) => {
  report.checks[name] = (report.checks[name] ?? true) && !!value;
  if (!value) throw new Error(name);
};
export const current = () =>
  useChatStore.getState().sessions[useChatStore.getState().activeKey].session;
export const patch = (value) =>
  flushSync(() =>
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        [state.activeKey]: {
          ...state.sessions[state.activeKey],
          session: { ...state.sessions[state.activeKey].session, ...value },
        },
      },
    })),
  );
export const closeMenu = async () => {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await tick();
};
export const button = (label) =>
  document.querySelector(`button[aria-label="${label}"]`);
export const click = async (element) => {
  check("host:actual-click-target", !!element);
  flushSync(() => element.click());
  await tick();
};
export const setInput = (element, value) => {
  Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  ).set.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
};
export const publicationRefs = Array.from({ length: 3 }, (_, index) => ({
  publicationId: `r8-p${index + 1}`,
  artifactFileId: `r8-f${index + 1}`,
  title: `결과 보고서 ${index + 1}`,
  filename: `report-${index + 1}.md`,
  kind: "markdown",
  sizeBytes: 100,
  publishedAt: 1700000000000,
}));
export const ports = {
  catalog: [
    {
      key: "r8-claude",
      adapter: "claude",
      supported: true,
      models: [
        {
          alias: "sonnet",
          model: "claude-sonnet-4-6",
          isCustom: false,
          isDefault: true,
          oneMillionContext: false,
        },
      ],
    },
  ],
  permission: [],
  list: [],
  git: [],
};
const repoResult = {
  isRepo: true,
  root: "C:/r8-fixture",
  branch: "main",
  detached: false,
};
window.orca = {
  skills: { list: async () => [] },
  agent: { list: async () => ports.catalog },
  provider: { onState: () => () => {} },
  project: { listSessions: async () => [] },
  chat: {
    send: async () => {
      report.sendCalls++;
    },
    onEvent: () => () => {},
  },
  git: {
    status: async (request) => {
      ports.git.push(request);
      return repoResult;
    },
    branches: async () => ({
      isRepo: true,
      branches: ["main"],
      current: "main",
    }),
  },
  permission: {
    setMode: async (request) => request.mode,
    respond: async (request) => {
      ports.permission.push(request);
    },
  },
  files: {
    list: async () => [],
    pickAttachments: async () => [
      {
        path: "C:/r8-fixture/input.md",
        name: "input.md",
        mimeType: "text/markdown",
        sizeBytes: 32,
      },
    ],
    pickDirectory: async () => null,
    openPath: async () => ({ ok: true }),
  },
  session: {
    list: async () => ports.list,
    cwd: async () => "C:/r8-fixture",
    addDirectory: async (request) => ({
      ok: true,
      extraDirs: [...current().extraDirs, request.directory],
    }),
  },
  artifacts: {
    list: async () => structuredClone(publicationRefs),
    status: async ({ publicationIds }) =>
      publicationIds.map((id) => ({
        publicationId: id,
        artifactFileId: publicationRefs.find(
          (item) => item.publicationId === id,
        )?.artifactFileId,
        availability: {
          state: "present",
          sizeBytes: 100,
          modifiedAt: 1700000000000,
        },
      })),
    save: async () => ({ outcome: "cancelled", items: [] }),
  },
};
const root = createRoot(document.getElementById("root"));
export const taskMessages = (count = 3) => [
  {
    role: "assistant",
    createdAt: 1700000000000,
    parts: [
      {
        type: "tool_call",
        toolRunId: "r8-list",
        toolName: "TaskList",
        args: {},
      },
      {
        type: "tool_result",
        toolRunId: "r8-list",
        result: "wire",
        isError: false,
        structuredOutput: {
          tasks: Array.from({ length: count }, (_, index) => ({
            id: String(index + 1),
            subject: `작업 ${index + 1} — 내용이 길 때에도 같은 제목과 상세를 유지합니다`,
            description: `상세 내용 ${index + 1}`,
            status: ["in_progress", "completed", "pending"][index % 3],
            blockedBy: index === 0 ? ["3"] : [],
          })),
        },
      },
    ],
  },
];
export function reset(kind, key, value = {}) {
  flushSync(() => root.render(null));
  const session = {
    ...initialChatState,
    agentKind: kind,
    sessionId: key,
    title: `R8 ${kind} 작업`,
    providerKey: "r8-claude",
    modelFamily: "claude-sonnet-4-6",
    modelAlias: "sonnet",
    cwd: "C:/r8-fixture",
    agentPanelInitialized: true,
    ...value,
  };
  flushSync(() =>
    useChatStore.setState({
      sessions: {
        [key]: { session, live: { text: "", reasoning: "" }, subagentMeta: {} },
      },
      activeKey: key,
      pendingNewChatKey: null,
      newChatQueue: [],
      draftRestore: null,
      concurrencyByProjectId: {},
    }),
  );
  flushSync(() => useAgentStore.setState({ agents: ports.catalog }));
}
export async function mountLanding(page) {
  reset("work", `r8-${page}`, {
    sessionId: null,
    messages: [],
    extraDirs: ["C:/r8-fixture/reference"],
    agentPanelInitialized: false,
  });
  const route = page === "new" ? "/new" : "/projects/r8-project";
  flushSync(() =>
    root.render(
      <section className="flex h-full min-w-0 flex-1">
        <MemoryRouter key={page} initialEntries={[route]}>
          <Routes>
            <Route path="/new" element={<NewChatLandingPage />} />
            <Route
              path="/projects/:projectId"
              element={<ProjectLandingPage />}
            />
          </Routes>
        </MemoryRouter>
      </section>,
    ),
  );
  await tick();
}
function ConversationHost({ children }) {
  const key = useChatStore((state) => state.activeKey),
    restore = useChatStore((state) => state.draftRestore);
  return (
    <section className="flex h-full min-w-0 flex-1 bg-bg">
      <main className="flex min-w-0 flex-1 flex-col">
        <ChatTitleBar />
        <div data-r8-transcript className="min-h-0 flex-1 overflow-auto p-4">
          {children}
        </div>
        <Composer
          backendLabel="Claude"
          canAbort
          showGitRow
          initialDraft="보존할 초안"
          restoredDraft={
            restore?.key === key
              ? { id: restore.seq, text: restore.text, mode: restore.mode }
              : undefined
          }
        />
      </main>
      <RightPanel />
    </section>
  );
}
export async function mountConversation(kind, value = {}, children = null) {
  reset(kind, `r8-${kind}`, {
    messages: taskMessages(),
    planContent:
      kind === "code" ? "# R8 계획\n\n문서 본문은 그대로 유지됩니다." : null,
    extraDirs: ["C:/r8-fixture/reference"],
    rightPanelTiles:
      kind === "work"
        ? [{ id: "work-column", tiles: ["task"] }]
        : [{ id: "code-column", tiles: ["plan"] }],
    ...value,
  });
  flushSync(() => root.render(<ConversationHost>{children}</ConversationHost>));
  await tick();
}
export const navItems = ["work", "code"].map((kind) => ({
  id: `nav-${kind}`,
  backend: "claude",
  agentKind: kind,
  title: `${kind} 세션`,
  preview: null,
  projectId: null,
  cwd: "C:/r8-fixture",
  updatedAt: 1,
  pinnedAt: null,
}));
function NavigationHost() {
  const handlers = useSessionHandlers(),
    { pathname } = useLocation();
  useSessionCompletion(handlers.currentSessionId);
  return (
    <aside className="w-80 p-4">
      {navItems.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          appearance={agentUiPolicy(session.agentKind)}
          isActive={handlers.currentSessionId === session.id}
          onSelect={handlers.handleSelectSession}
        />
      ))}
      <button
        data-r8-route={pathname}
        onClick={() => handlers.handleOpenProject("r8-project")}
      >
        다른 화면
      </button>
    </aside>
  );
}
export async function mountNavigation() {
  reset("work", "nav-work");
  ports.list = navItems;
  useSessionsStore.setState({
    unseenCompletedIds: new Set(),
    viewedSessionId: null,
  });
  flushSync(() =>
    root.render(
      <MemoryRouter initialEntries={["/new"]}>
        <NavigationHost />
      </MemoryRouter>,
    ),
  );
  await tick();
}
