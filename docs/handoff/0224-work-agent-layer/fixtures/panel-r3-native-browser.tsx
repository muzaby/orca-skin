// Codex 작성. 생산 컴포넌트의 클릭·상태·레이아웃을 관측하는 합성 인수.
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { RightPanel } from "@source/renderer/src/features/chat/components/rightpanel/RightPanel";
import { ApprovalCard } from "@source/renderer/src/features/chat/components/ApprovalCard";
import { AgentTaskRow } from "@source/renderer/src/features/chat/components/transcript/AgentTaskRow";
import { SubagentNoticeRow } from "@source/renderer/src/features/chat/components/transcript/SubagentNoticeRow";
import { ChatTitleBar } from "@source/renderer/src/features/chat/components/ChatTitleBar";
import { ComposerInputController } from "@source/renderer/src/features/chat/components/composer/ComposerInputController";
import { NewChatLandingPage } from "@source/renderer/src/pages/NewChatLandingPage";
import { ProjectLandingPage } from "@source/renderer/src/pages/ProjectLandingPage";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import {
  initialChatState,
  chatReducer,
} from "@source/renderer/src/features/chat/reducer/chatReducer";
import {
  useChatStore,
  chatActions,
} from "@source/renderer/src/features/chat/store/chatStore";
import {
  useArtifactStore,
  refreshArtifactList,
} from "@source/renderer/src/features/chat/store/artifactStore";
const refs = [
  {
    publicationId: "publication-1",
    artifactFileId: "file-1",
    title: "다운로드 폴더 정리 보고서",
    filename: "다운로드폴더_정리보고서.md",
    kind: "markdown",
    sizeBytes: 544,
    publishedAt: 1700000000000,
  },
];
let mainDirectory = false,
  composerChecks = false,
  sendCalls = 0;
let permissionCalls = [],
  transcriptChecks = false;
let outputs = false,
  pickResolve,
  pickReject,
  addFailure = null,
  calls = [];
window.orca = {
  skills: { list: async () => [] },
  agent: { list: async () => [] },
  provider: { onState: () => () => {} },
  project: { listSessions: async () => [] },
  chat: {
    send: async () => {
      sendCalls++;
    },
    onEvent: () => () => {},
  },
  git: {
    branches: async () => ({ isRepo: false, branches: [], current: null }),
    status: async () => ({ isRepo: false }),
  },
  permission: {
    respond: async (request) => {
      permissionCalls.push(request);
    },
  },
  files: {
    list: async () => [],
    pickAttachments: async () => [
      {
        path: "C:/fixture/input.md",
        name: "input.md",
        mimeType: "text/markdown",
        sizeBytes: 32,
      },
    ],
    pickDirectory: () =>
      new Promise((resolve, reject) => {
        pickResolve = resolve;
        pickReject = reject;
      }),
  },
  session: {
    list: async () => [],
    cwd: async () => "C:/fixture",
    addDirectory: async (request) => {
      calls.push(request);
      if (mainDirectory) return window.directoryFixture.addDirectory(request);
      if (addFailure) return { ok: false, reason: addFailure };
      const entry = Object.values(useChatStore.getState().sessions).find(
        (e) => e.session.sessionId === request.sessionId,
      );
      return {
        ok: true,
        extraDirs: [
          ...new Set([...(entry?.session.extraDirs ?? []), request.directory]),
        ],
      };
    },
  },
  artifacts: {
    list: async () => (outputs ? refs : []),
    status: async ({ publicationIds }) =>
      publicationIds.map((id) => ({
        publicationId: id,
        artifactFileId: "file-1",
        availability: {
          state: "present",
          sizeBytes: 544,
          modifiedAt: 1700000000000,
        },
      })),
    save: async () => ({ outcome: "cancelled", items: [] }),
  },
};
const root = createRoot(document.getElementById("root"));
const tasks = [];
for (const [i, status] of ["in_progress", "completed", "pending"].entries()) {
  const id = String(i + 1),
    run = "create" + id,
    subject = [
      "테스트 작업 1 - API 엔드포인트 구현",
      "테스트 작업 2 - 데이터베이스 마이그레이션",
      "테스트 작업 3 - UI 컴포넌트 리팩토링",
    ][i];
  tasks.push(
    {
      type: "tool_call",
      toolRunId: run,
      toolName: "TaskCreate",
      args: { subject },
    },
    {
      type: "tool_result",
      toolRunId: run,
      result: "created",
      isError: false,
      structuredOutput: { task: { id, subject } },
    },
  );
  if (status !== "pending")
    tasks.push(
      {
        type: "tool_call",
        toolRunId: "update" + id,
        toolName: "TaskUpdate",
        args: { taskId: id, status },
      },
      {
        type: "tool_result",
        toolRunId: "update" + id,
        result: "updated",
        isError: false,
        structuredOutput: {
          success: true,
          taskId: id,
          updatedFields: ["status"],
          statusChange: { from: "pending", to: status },
        },
      },
    );
}
const messages = [
  { role: "assistant", createdAt: 1700000000000, parts: tasks },
];
const workMessages = JSON.parse(
  JSON.stringify(messages)
    .replaceAll("테스트 작업 1 - API 엔드포인트 구현", "다운로드 폴더 정리 중")
    .replaceAll(
      "테스트 작업 2 - 데이터베이스 마이그레이션",
      "이미지 파일 클라우드 동기화",
    )
    .replaceAll(
      "테스트 작업 3 - UI 컴포넌트 리팩토링",
      "개발 빌드 파일 외부 저장소 이동",
    ),
);
function FixtureComposer() {
  const key = useChatStore((s) => s.activeKey);
  const update = useChatStore((s) => s.draftRestore);
  const restoredDraft =
    update?.key === key
      ? { id: update.seq, text: update.text, mode: update.mode }
      : undefined;
  return (
    <div data-fixture-composer className="m-4">
      <ComposerInputController
        key={key}
        active
        backendLabel="Claude"
        canAbort
        inflight={false}
        steerBlocked={false}
        toolApprovalPending={false}
        cwd={null}
        initialDraft="기존 초안"
        restoredDraft={restoredDraft}
        onSend={() => {
          sendCalls++;
          return false;
        }}
        diffRequirementSnapshot={{
          sessionKey: key,
          sessionId: key,
          ids: [],
          anchors: [],
          revision: 0,
        }}
        onClearDiffRequirementsIfUnchanged={() => {}}
        onCancel={() => {}}
        controlsStart={null}
        controlsEnd={null}
      />
    </div>
  );
}
function Shell() {
  return (
    <section className="flex h-full min-w-0 flex-1 bg-bg">
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatTitleBar />
        {transcriptChecks && (
          <div data-fixture-transcript>
            <ApprovalCard />
            <AgentTaskRow
              call={{
                toolUseId: "parent-task",
                name: "Task",
                input: { description: "자료 분석" },
                result: { output: "analysis complete", isError: false },
              }}
            />
            <SubagentNoticeRow toolRunId="parent-task" status="completed" />
          </div>
        )}
        {composerChecks && <FixtureComposer />}
        <div className="flex flex-1 items-center justify-center text-footnote text-ink3">
          합성 데이터로 패널 표시와 동작 확인
        </div>
      </div>
      <RightPanel />
    </section>
  );
}
const settled = async () => {
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 80));
};
const assert = (ok, label) => {
  if (!ok) throw new Error(label);
};
function seed(kind, full = false, key = kind) {
  outputs = full && kind === "work";
  const session = {
    ...initialChatState,
    sessionId: key,
    agentKind: kind,
    title:
      kind === "coding" ? "계획과 작업 테스트" : "다운로드 폴더 분석 및 정리",
    planContent:
      kind === "coding" && full
        ? "# 테스트 플랜\n\n## Context\nTaskCreate 도구 테스트\n\n## Plan\n- 작업 3개 생성 완료\n- Task #1: in_progress로 변경\n- Task #2: completed로 변경"
        : null,
    messages: full ? (kind === "work" ? workMessages : messages) : [],
    extraDirs: full && kind === "work" ? ["C:/Downloads"] : [],
    rightPanelTiles:
      kind === "coding"
        ? [{ id: "col-plan", tiles: ["plan"] }]
        : [{ id: "col-task", tiles: ["task"] }],
    agentPanelInitialized: true,
  };
  flushSync(() =>
    useChatStore.setState(
      {
        sessions: {
          [key]: {
            session,
            live: { text: "", reasoning: "" },
            subagentMeta: {},
          },
        },
        activeKey: key,
        pendingNewChatKey: null,
        newChatQueue: [],
        recentsEpoch: 0,
        concurrencyByProjectId: {},
        draftRestore: null,
      },
      true,
    ),
  );
}
const button = (label) =>
  document.querySelector('button[aria-label="' + label + '"]');
async function click(label) {
  const el = button(label);
  assert(el, "Missing button " + label);
  flushSync(() => el.click());
  await settled();
  return el;
}
window.panelStage = async (name) => {
  document.documentElement.dataset.theme = name.includes("dark")
    ? "dark"
    : "white";
  const kind = name.startsWith("coding") ? "coding" : "work";
  seed(kind, !name.includes("empty"));
  if (name === "coding-tasks-only" || name === "coding-plan-only") {
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        coding: {
          ...s.sessions.coding,
          session: {
            ...s.sessions.coding.session,
            ...(name === "coding-tasks-only"
              ? { planContent: null }
              : { messages: [] }),
          },
        },
      },
    }));
  }
  flushSync(() => root.render(<Shell />));
  await settled();
  if (kind === "work") {
    await refreshArtifactList("work");
    await settled();
  }
  const tiles = [...document.querySelectorAll("[data-context]")]
    .filter((e) =>
      ["task", "plan", "diff", "subagent"].includes(e.dataset.context),
    )
    .map((e) => e.dataset.context);
  assert(
    JSON.stringify(tiles) ===
      JSON.stringify([kind === "work" ? "task" : "plan"]),
    "Mode panel mismatch " + tiles,
  );
  if (kind === "work") {
    const names = [
      ...document
        .querySelector('[data-context="task"]')
        .querySelectorAll("section"),
    ].map((e) => e.getAttribute("aria-label"));
    assert(
      JSON.stringify(names) ===
        JSON.stringify(["진행 상황", "출력", "컨텍스트"]),
      "Section order mismatch",
    );
    assert(button("폴더 추가"), "Missing folder picker");
    assert(!button("작업 닫기"), "Work close visible");
  } else {
    const plan = document.querySelector('[data-context="plan"]');
    const lower = plan.querySelector('section[aria-label="작업"]');
    const heading = plan.querySelector("h1");
    const hasPlan = name === "coding-full";
    if (name === "coding-full") {
      assert(
        lower?.textContent.includes("API 엔드포인트"),
        "Tasks absent below plan",
      );
      assert(
        heading &&
          heading.getBoundingClientRect().top <
            lower.getBoundingClientRect().top,
        "Plan not above tasks",
      );
    } else if (name === "coding-tasks-only") {
      assert(
        lower?.textContent.includes("API 엔드포인트") &&
          !heading &&
          !plan.textContent.includes("계획이 없습니다"),
        "Tasks-only retains empty plan",
      );
    } else if (name === "coding-plan-only") {
      assert(
        heading?.textContent === "테스트 플랜" && !lower,
        "Plan-only retains empty tasks",
      );
    } else {
      assert(!lower && !heading, "Empty Coding still split into sections");
    }
    const animated = plan.querySelector(".animate-spin");
    if (name === "coding-full" || name === "coding-tasks-only") {
      assert(
        animated &&
          animated.getAnimations().some((a) => a.playState === "running"),
        "Coding in-progress animation not running",
      );
    }
  }
  assert(
    document.documentElement.scrollWidth <= innerWidth,
    "Viewport overflow",
  );
  assert(
    Math.abs(
      document.querySelector("#root > section").getBoundingClientRect().right -
        innerWidth,
    ) < 1,
    "Fixture does not fill viewport",
  );
  return {
    name,
    tiles,
    width: innerWidth,
    sections: [...document.querySelectorAll("section[aria-label]")].map((e) =>
      e.getAttribute("aria-label"),
    ),
    rootWidth: document.documentElement.scrollWidth,
  };
};
window.panelInteractions = async () => {
  const checks = {};
  document.documentElement.dataset.theme = "white";
  seed("work", true);
  await settled();
  await refreshArtifactList("work");
  await settled();
  const task = document.querySelector('[data-context="task"]'),
    body = task.querySelector("section"),
    width = task.getBoundingClientRect().width;
  await click("작업 넓게 보기");
  checks.expand =
    task === document.querySelector('[data-context="task"]') &&
    body === task.querySelector("section") &&
    task.getBoundingClientRect().width > width;
  await click("작업 원래 크기로");
  checks.restore = Math.abs(task.getBoundingClientRect().width - width) < 1;
  flushSync(() => chatActions.setRightPanelColWidth(0, 640));
  await settled();
  const resizedWidth = task.getBoundingClientRect().width;
  await click("작업 넓게 보기");
  checks.expandResized = task.getBoundingClientRect().width > resizedWidth;
  await click("작업 원래 크기로");
  checks.restoreResized =
    Math.abs(task.getBoundingClientRect().width - resizedWidth) < 1;
  flushSync(() => chatActions.setRightPanelColWidth(0, 360));
  await settled();
  await click("우측 패널 타일");
  const menuItems = [
    ...document.querySelectorAll('[role="menuitemcheckbox"]'),
  ].map((e) => e.textContent);
  checks.workMenu = menuItems.length === 1 && menuItems[0].includes("작업");
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await settled();
  const before = task.querySelectorAll("section")[1];
  flushSync(() => before.querySelector("button").click());
  await settled();
  checks.collapse =
    before.querySelector("button").getAttribute("aria-expanded") === "false" &&
    !before.querySelector("article");
  flushSync(() => before.querySelector("button").click());
  await settled();
  const context = task.querySelector('section[aria-label="컨텍스트"]');
  flushSync(() => context.querySelector("button").click());
  await settled();
  await click("폴더 추가");
  checks.contextActionReopens =
    context.querySelector("button").getAttribute("aria-expanded") === "true";
  flushSync(() => context.querySelector("button").click());
  await settled();
  addFailure = "invalid-directory";
  pickResolve("C:/missing-collapsed");
  await settled();
  addFailure = null;
  checks.collapsedError =
    !!context.querySelector('[role="alert"]') &&
    context.querySelector("button").getAttribute("aria-expanded") === "false";
  calls = [];
  const add = async (value) => {
    await click("폴더 추가");
    pickResolve(value);
    await settled();
  };
  await add(null);
  checks.cancel = calls.length === 0;
  await add("C:/");
  checks.root = calls.length === 0 && task.textContent.includes("루트 폴더");
  await add("C:/References");
  checks.add =
    calls.length === 1 &&
    useChatStore
      .getState()
      .sessions.work.session.extraDirs.includes("C:/References") &&
    task.textContent.includes("References");
  await add("C:/References");
  checks.duplicate =
    useChatStore
      .getState()
      .sessions.work.session.extraDirs.filter((x) => x === "C:/References")
      .length === 1;
  addFailure = "invalid-directory";
  await add("C:/missing");
  checks.error = task.textContent.includes("추가할 수 있는 폴더");
  addFailure = null;
  await click("폴더 추가");
  const beforeStale = calls.length;
  seed("work", false, "other");
  await settled();
  pickResolve("C:/Stale");
  await settled();
  checks.stale =
    calls.length === beforeStale &&
    useChatStore.getState().sessions.other.session.extraDirs.length === 0;
  seed("work", false);
  await settled();
  flushSync(() =>
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        work: {
          ...s.sessions.work,
          session: { ...s.sessions.work.session, inflight: true },
        },
      },
    })),
  );
  await settled();
  checks.busy = button("폴더 추가").disabled;
  const currentContext = document.querySelector(
    'section[aria-label="컨텍스트"]',
  );
  flushSync(() => currentContext.querySelector("button").click());
  await settled();
  seed("work", false, "reset-target");
  await settled();
  checks.sessionSectionsReset =
    document
      .querySelector('section[aria-label="컨텍스트"] button')
      .getAttribute("aria-expanded") === "true";
  seed("coding", true);
  await settled();
  await click("우측 패널 타일");
  const codingItems = [
    ...document.querySelectorAll('[role="menuitemcheckbox"]'),
  ].map((e) => e.textContent);
  checks.codingMenu =
    codingItems.some((x) => x.includes("계획")) &&
    !codingItems.some((x) => x === "작업");
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await settled();
  const taskButton = document.querySelector(
    '[data-context="plan"] section[aria-label="작업"] [role="button"]',
  );
  flushSync(() => taskButton.click());
  await settled();
  checks.codingDetail =
    document.querySelector('[data-context="plan"] h1')?.textContent ===
      "테스트 플랜" &&
    document
      .querySelector('[data-context="plan"] section[aria-label="작업"]')
      .textContent.includes("상태");
  let copied = null;
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text) => {
        copied = text;
      },
    },
  });
  const copyButton = document.querySelector(
    '[data-context="plan"] button[aria-label="플랜 복사"]',
  );
  assert(copyButton, "Plan copy absent");
  flushSync(() => copyButton.click());
  await settled();
  checks.planCopy =
    copied === useChatStore.getState().sessions.coding.session.planContent;
  flushSync(() =>
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        coding: {
          ...s.sessions.coding,
          session: {
            ...s.sessions.coding.session,
            pendingPlanReview: {
              requestId: "review-coding",
              plan: s.sessions.coding.session.planContent,
            },
          },
        },
      },
    })),
  );
  await settled();
  const heading = document.querySelector('[data-context="plan"] h1'),
    selection = window.getSelection(),
    range = document.createRange();
  range.selectNodeContents(heading);
  selection.removeAllRanges();
  selection.addRange(range);
  heading.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  heading.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  await settled();
  checks.planSelection = !!document.querySelector(
    '[data-context="plan"] [data-context="floating"]',
  );
  const outside = document.querySelector(
    '[data-context="plan"] section[aria-label="작업"]',
  );
  range.selectNodeContents(outside);
  selection.removeAllRanges();
  selection.addRange(range);
  heading.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  heading.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  await settled();
  checks.taskOutsidePlanSelection = !document.querySelector(
    '[data-context="plan"] [data-context="floating"]',
  );
  selection.removeAllRanges();
  seed("work", true);
  await settled();
  transcriptChecks = true;
  flushSync(() =>
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        work: {
          ...s.sessions.work,
          session: {
            ...s.sessions.work.session,
            pendingPlanReview: {
              requestId: "review-work",
              plan: "# Work 검토 계획\n\n확인 후 진행합니다.",
            },
            messages: [
              {
                role: "assistant",
                createdAt: 1,
                parts: [
                  {
                    type: "tool_call",
                    toolRunId: "parent-task",
                    toolName: "Task",
                    args: { description: "자료 분석" },
                  },
                  {
                    type: "text",
                    text: "하위 작업 분석 결과",
                    parentToolRunId: "parent-task",
                  },
                  {
                    type: "tool_result",
                    toolRunId: "parent-task",
                    result: "analysis complete",
                    isError: false,
                  },
                ],
              },
            ],
          },
        },
      },
    })),
  );
  flushSync(() => root.render(<Shell />));
  await settled();
  const transcript = document.querySelector("[data-fixture-transcript]");
  checks.workPlanVisible =
    transcript.querySelector("[data-work-plan-review] h1")?.textContent ===
      "Work 검토 계획" &&
    ![...transcript.querySelectorAll("button")].some(
      (b) => b.textContent === "계획 보기",
    );
  const approve = transcript.querySelector('[data-behavior="action:send"]');
  flushSync(() => approve.click());
  await settled();
  checks.workPlanApproval =
    permissionCalls.length === 1 &&
    permissionCalls[0].resolution.behavior === "allow" &&
    !useChatStore.getState().sessions.work.session.pendingPlanReview;
  const row = transcript.querySelector('[role="button"]');
  flushSync(() => row.click());
  await settled();
  checks.workChildInline =
    !!transcript.querySelector("[data-subagent-inline]") &&
    transcript
      .querySelector("[data-subagent-inline]")
      .textContent.includes("하위 작업 분석 결과") &&
    !document.querySelector('[data-context="subagent"]');
  const notice = transcript.querySelectorAll('[role="button"]')[1];
  flushSync(() => notice.click());
  await settled();
  checks.workNoticeInline =
    transcript.querySelectorAll("[data-subagent-inline]").length === 2 &&
    !document.querySelector('[data-context="subagent"]');
  for (const [name, ok] of Object.entries(checks))
    assert(ok, "Interaction failed: " + name);
  return { checks, calls, permissionCalls, menuItems, codingItems };
};

const existingInteractions = window.panelInteractions;
const waitFor = async (test, name) => {
  const deadline = performance.now() + 20000;
  while (!test()) {
    assert(performance.now() < deadline, "Timed out: " + name);
    await settled();
  }
};
window.panelInteractions = async () => {
  const result = await existingInteractions();
  const checks = result.checks;
  transcriptChecks = false;
  seed("work", true);
  flushSync(() => root.render(<Shell />));
  await settled();
  const rows = [...document.querySelectorAll("[data-work-task]")];
  checks.workVerticalRows =
    rows.length === 3 &&
    rows.map((r) => r.dataset.status).join(",") ===
      "in_progress,completed,pending" &&
    rows[0].getBoundingClientRect().top < rows[1].getBoundingClientRect().top &&
    rows[1].getBoundingClientRect().top < rows[2].getBoundingClientRect().top;
  checks.workSubjects = [
    "다운로드 폴더 정리 중",
    "이미지 파일 클라우드 동기화",
    "개발 빌드 파일 외부 저장소 이동",
  ].every((s, i) => rows[i]?.textContent.includes(s));
  checks.workCompleteStrike = !!rows[1]?.querySelector(".line-through");
  await click("우측 패널 타일");
  const toggle = document.querySelector('[role="menuitemcheckbox"]');
  checks.workToggleEnabled =
    toggle &&
    !toggle.disabled &&
    toggle.getAttribute("aria-disabled") !== "true";
  flushSync(() => toggle.click());
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await settled();
  checks.workToggleOff = !document.querySelector('[data-context="task"]');
  flushSync(() =>
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        work: {
          ...s.sessions.work,
          session: chatReducer(s.sessions.work.session, { type: "BEGIN_TURN" }),
        },
      },
    })),
  );
  await settled();
  checks.workClosedThroughTurn = !document.querySelector(
    '[data-context="task"]',
  );
  flushSync(() =>
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        work: {
          ...s.sessions.work,
          session: { ...s.sessions.work.session, inflight: false },
        },
      },
    })),
  );
  await click("우측 패널 타일");
  flushSync(() => document.querySelector('[role="menuitemcheckbox"]').click());
  await settled();
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await settled();
  checks.workToggleOn =
    document.querySelectorAll('[data-context="task"]').length === 1;

  composerChecks = true;
  seed("work", true, "composer-work");
  flushSync(() => root.render(<Shell />));
  await settled();
  const composer = document.querySelector("[data-fixture-composer]");
  const surface =
    composer.querySelector("textarea") ||
    composer.querySelector('[contenteditable="true"]');
  assert(surface, "Actual Composer input absent");
  const inputText = () => surface.value ?? surface.textContent;
  checks.questionInitialDraft = inputText() === "기존 초안";
  const attachTrigger = composer.querySelector("button[aria-haspopup]");
  assert(attachTrigger, "Attachment menu trigger absent");
  flushSync(() => attachTrigger.click());
  await settled();
  const attachItem = [...document.querySelectorAll('[role="menuitem"]')].find(
    (e) => e.textContent !== "Skill",
  );
  assert(attachItem, "Attachment menu item absent");
  flushSync(() => attachItem.click());
  await settled();
  // AttachmentThumb은 확장자를 표시하고 전체 파일명은 title/제거 접근성 이름에 둔다.
  const attachment = composer.querySelector('[title="input.md"]');
  checks.questionAttachmentBefore =
    attachment?.textContent === "MD" &&
    !!attachment.querySelector('button[aria-label*="input.md"]') &&
    attachment.getBoundingClientRect().width > 0;
  const ask = document.querySelector('[data-behavior="action:ask-about-task"]');
  flushSync(() => ask.click());
  await settled();
  checks.questionAppends =
    inputText().startsWith("기존 초안") &&
    inputText().includes("> 다운로드 폴더 정리 중");
  checks.questionFocus = document.activeElement === surface;
  checks.questionNoSend = sendCalls === 0;
  checks.questionAttachmentPreserved =
    attachment === composer.querySelector('[title="input.md"]') &&
    composer.querySelectorAll('[title="input.md"]').length === 1;
  const draft = inputText();
  flushSync(() => root.render(<Shell />));
  await settled();
  checks.questionConsumedOnce = inputText() === draft;
  composerChecks = false;

  mainDirectory = true;
  const info = await window.directoryFixture.info();
  const before = await window.directoryFixture.load();
  seed("work", false, info.sessionId);
  flushSync(() =>
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        [info.sessionId]: {
          ...s.sessions[info.sessionId],
          session: { ...s.sessions[info.sessionId].session, cwd: info.cwd },
        },
      },
    })),
  );
  flushSync(() => root.render(<Shell />));
  await settled();
  checks.mainNoImplicitCwd =
    before.extraDirs.length === 0 &&
    document.querySelectorAll('[data-surface="context-directory"]').length ===
      0;
  await click("폴더 추가");
  pickResolve(info.cwd);
  await waitFor(
    () =>
      useChatStore
        .getState()
        .sessions[info.sessionId].session.extraDirs.includes(info.cwd),
    "Main cwd response reaches store",
  );
  checks.mainCwdChip = [
    ...document.querySelectorAll('[data-surface="context-directory"]'),
  ].some((e) => e.textContent.includes("Downloads"));
  await click("폴더 추가");
  pickResolve(info.cwd);
  await waitFor(
    () => !document.querySelector('button[aria-label="폴더 추가"]').disabled,
    "Repeated Main cwd result",
  );
  const loaded = await window.directoryFixture.load();
  checks.mainCwdOnce =
    loaded.extraDirs.length === 1 &&
    loaded.extraDirs[0] === info.cwd &&
    loaded.cwd === before.cwd;
  flushSync(() =>
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        [info.sessionId]: {
          ...s.sessions[info.sessionId],
          session: chatReducer(initialChatState, {
            type: "LOAD_SESSION",
            session: loaded,
          }),
        },
      },
    })),
  );
  await settled();
  checks.mainReloadChip =
    document.querySelectorAll('[data-surface="context-directory"]').length ===
      1 &&
    document
      .querySelector('[data-surface="context-directory"]')
      .textContent.includes("Downloads");
  await click("폴더 추가");
  pickResolve(info.directory);
  await waitFor(
    () =>
      useChatStore
        .getState()
        .sessions[info.sessionId].session.extraDirs.includes(info.directory),
    "Main new folder response",
  );
  checks.mainNewFolder =
    document.querySelectorAll('[data-surface="context-directory"]').length ===
      2 &&
    document
      .querySelector('[data-context="task"]')
      .textContent.includes("References");
  result.directory = {
    info,
    before: before.extraDirs,
    after: (await window.directoryFixture.load()).extraDirs,
  };
  mainDirectory = false;
  for (const [name, ok] of Object.entries(checks))
    assert(ok, "Interaction failed: " + name);
  return result;
};

const contentStage = window.panelStage;
window.panelStage = async (name) => {
  if (name !== "new-landing" && name !== "project-landing")
    return contentStage(name);
  document.documentElement.dataset.theme = "white";
  seed("work", false, "landing");
  flushSync(() =>
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        landing: {
          ...s.sessions.landing,
          session: {
            ...s.sessions.landing.session,
            sessionId: null,
            agentPanelInitialized: false,
          },
        },
      },
    })),
  );
  const route = name === "new-landing" ? "/new" : "/projects/fixture-project";
  flushSync(() =>
    root.render(
      <section className="flex h-full min-w-0">
        <MemoryRouter key={name} initialEntries={[route]}>
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
  await settled();
  assert(
    !document.querySelector('[data-context="task"]'),
    "Landing exposes Work panel",
  );
  const surface =
    document.querySelector("textarea") ||
    document.querySelector('[contenteditable="true"]');
  assert(surface, "Actual landing Composer absent");
  return { name, tiles: [], composer: true, width: innerWidth };
};
window.panelMotion = () => {
  const icon = document.querySelector('[data-context="plan"] svg.animate-spin');
  assert(icon, "Coding progress icon absent");
  return {
    animationName: getComputedStyle(icon).animationName,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
};
