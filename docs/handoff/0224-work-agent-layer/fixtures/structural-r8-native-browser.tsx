// Codex 작성. 기대 결과는 명시적 Work/Code 계약이며 production 정책표를 oracle로 복제하지 않는다.
import {
  React,
  flushSync,
  report,
  tick,
  check,
  current,
  patch,
  closeMenu,
  button,
  click,
  setInput,
  ports,
  taskMessages,
  mountLanding,
  mountConversation,
  mountNavigation,
  navItems,
  useChatStore,
  useAgentStore,
  useSessionsStore,
  sessionsActions,
  chatActions,
  ingestChatEvent,
  agentUiPolicy,
} from "./structural-r8-host";
import { parseRuntimeModels } from "@source/main/features/harnesses/claude/model-parser";
import { modelIdentity } from "@source/shared/model-identity";
import { AssistantTurn } from "@source/renderer/src/features/chat/components/transcript/AssistantTurn";
import { AgentTaskRow } from "@source/renderer/src/features/chat/components/transcript/AgentTaskRow";
const modeLabel = { work: "작업", code: "코드" };
const heroText = {
  work: "어떤 작업을 시작할까요?",
  code: "개발, 디버깅을 시작하세요.",
};
const toggle = async (kind) => click(button(modeLabel[kind]));
const gitGroup = () =>
  document.querySelector('[data-surface="branch-worktree-group"]');
const branch = () =>
  document.querySelector('button[title="브랜치 전환"]') ??
  gitGroup()?.querySelector("button");
const repo = (name = "main") => ({
  isRepo: true,
  root: "C:/r8-fixture",
  branch: name,
  detached: name === null,
});
const chip = () => document.querySelector('button[title="권한 모드"]');
const permissionItems = () => [
  ...document.querySelectorAll('[role="menuitemradio"]'),
];
const labels = () =>
  permissionItems().map(
    (item) => item.querySelector("span.block")?.textContent,
  );
const allTiles = () =>
  [...document.querySelectorAll("[data-context]")].filter((element) =>
    ["task", "plan", "subagent", "diff"].includes(element.dataset.context),
  );
async function attach() {
  const trigger = [...document.querySelectorAll("button[aria-haspopup]")].find(
    (element) => element.title !== "권한 모드" && !element.textContent.trim(),
  );
  await click(trigger);
  await click(
    [...document.querySelectorAll('[role="menuitem"]')].find(
      (element) => element.textContent !== "Skill",
    ),
  );
  check(
    "composer:attachment-visible",
    !!document.querySelector('[title="input.md"]'),
  );
}
window.r8Landing = async (page) => {
  const calls = [];
  window.orca.git.status = (request) =>
    new Promise((resolve, reject) => calls.push({ request, resolve, reject }));
  await mountLanding(page);
  const p = `${page}:`,
    input = document.querySelector("textarea");
  check(p + "landing-hides-panel", allTiles().length === 0);
  check(p + "work-no-git-query", calls.length === 0 && !gitGroup());
  const workButton = button("작업"),
    codeButton = button("코드");
  check(
    p + "explicit-code-label",
    !!workButton && !!codeButton && !button("코딩"),
  );
  check(
    p + "icons-distinct",
    workButton.querySelector("svg").innerHTML !==
      codeButton.querySelector("svg").innerHTML,
  );
  check(
    p + "no-toggle-tooltip",
    !workButton.title &&
      !codeButton.title &&
      !document.querySelector('[role="tooltip"]'),
  );
  const marks = [
    ...document.querySelectorAll(
      "[data-agent-mode-chevron],[data-agent-mode-separator]",
    ),
  ];
  check(
    p + "toggle-characters",
    marks.map((element) => element.textContent).join("") === "</>",
  );
  check(
    p + "same-typeface",
    new Set(
      marks.map((element) => {
        const css = getComputedStyle(element);
        return `${css.fontFamily}|${css.fontSize}|${css.fontWeight}`;
      }),
    ).size === 1,
  );
  check(
    p + "hero-normal-weight",
    getComputedStyle(document.querySelector("[data-agent-mode-hero]"))
      .fontWeight === "400",
  );
  await attach();
  flushSync(() => setInput(input, "전환해도 유지되는 초안"));
  input.setSelectionRange(2, 7);
  const dirs = current().extraDirs;
  check(
    p + "work-hero",
    document.querySelector("[data-agent-mode-hero]").textContent ===
      heroText.work,
  );
  await toggle("code");
  check(p + "code-canonical", current().agentKind === "code");
  check(
    p + "code-selected-color",
    codeButton.getAttribute("aria-pressed") === "true" &&
      !!codeButton.querySelector(".text-selected") &&
      workButton.getAttribute("aria-pressed") === "false",
  );
  check(
    p + "code-hero",
    document.querySelector("[data-agent-mode-hero]").textContent ===
      heroText.code,
  );
  check(
    p + "code-pending-dash",
    branch()?.textContent.trim() === "-" &&
      branch().disabled &&
      calls.length === 1,
  );
  await toggle("work");
  check(p + "work-canonical", current().agentKind === "work");
  check(
    p + "work-selected-color",
    workButton.getAttribute("aria-pressed") === "true" &&
      !!workButton.querySelector(".text-selected") &&
      codeButton.getAttribute("aria-pressed") === "false",
  );
  check(p + "pending-hidden", !gitGroup() && calls.length === 1);
  calls[0].resolve(repo());
  await tick();
  check(p + "hidden-result-no-new-query", !gitGroup() && calls.length === 1);
  flushSync(() => codeButton.click());
  check(
    p + "cache-immediate",
    branch()?.textContent.includes("main") && !branch().disabled,
  );
  await tick();
  check(p + "cache-no-refetch", calls.length === 1);
  check(
    p + "composer-dom-preserved",
    document.querySelector("textarea") === input,
  );
  check(
    p + "draft-selection-preserved",
    input.value === "전환해도 유지되는 초안" &&
      input.selectionStart === 2 &&
      input.selectionEnd === 7,
  );
  check(
    p + "attachments-folders-preserved",
    !!document.querySelector('[title="input.md"]') &&
      current().extraDirs === dirs,
  );
  const old = calls.length;
  patch({ cwd: "C:/r8-fixture/older" });
  await tick();
  patch({ cwd: "C:/r8-fixture/newer" });
  await tick();
  check(p + "cwd-query-count", calls.length === old + 2);
  calls.at(-1).resolve(repo("newer"));
  await tick();
  calls.at(-2).resolve(repo("stale"));
  await tick();
  check(
    p + "stale-cwd-rejected",
    branch()?.textContent.includes("newer") &&
      !gitGroup().textContent.includes("stale"),
  );
  await toggle("work");
  const before = calls.length;
  patch({ cwd: "C:/r8-fixture/nonrepo" });
  await tick();
  check(p + "work-cwd-does-not-query", calls.length === before);
  await toggle("code");
  calls
    .at(-1)
    .resolve({ isRepo: false, root: null, branch: null, detached: false });
  await tick();
  check(p + "nonrepo-hidden", !gitGroup());
  patch({ cwd: "C:/r8-fixture/failure" });
  await tick();
  calls.at(-1).reject(new Error("synthetic Git error"));
  await tick();
  check(p + "failed-git-hidden", !gitGroup());
  patch({ cwd: "C:/r8-fixture/detached" });
  await tick();
  calls.at(-1).resolve(repo(null));
  await tick();
  check(
    p + "detached-not-pending",
    !!branch() && !branch().disabled && branch().textContent.trim() !== "-",
  );
  report.observations[p + "git-calls"] = calls.map((call) => call.request);
  window.orca.git.status = async () => repo();
  return report;
};
window.r8Permissions = async () => {
  window.orca.git.status = async () => repo();
  await mountLanding("new");
  const names = [
    "claudecode-sonnet-5",
    "claudecode-opus-4.8",
    "claudecode-opus-4.8[1m]",
  ];
  const runtime = parseRuntimeModels({ availableModels: names });
  const matrix = [
    ...names.map((name) => ({
      name,
      model: runtime.find((model) => modelIdentity(model) === name),
      allowed: true,
    })),
    ...[
      ["claude-sonnet-4-5", false, false],
      ["claude-sonnet-4.5", false, false],
      ["claude-sonnet-4-6", false, true],
      ["claude-sonnet-4.6-20260801", false, true],
      ["claude-sonnet-4-6", true, false],
    ].map(([name, isCustom, allowed]) => ({
      name: `${name}:custom${isCustom}`,
      model: {
        alias: "sonnet",
        model: name,
        isCustom,
        oneMillionContext: false,
        isDefault: true,
      },
      allowed,
    })),
  ];
  for (const kind of ["work", "code"]) {
    await toggle(kind);
    for (const entry of matrix) {
      check(`catalog:${entry.name}:resolved`, !!entry.model);
      const agent = {
        key: "r8-menu-agent",
        adapter: "claude",
        supported: true,
        models: [entry.model],
      };
      ports.catalog = [agent];
      flushSync(() => useAgentStore.setState({ agents: [agent] }));
      patch({
        providerKey: agent.key,
        modelFamily: modelIdentity(entry.model),
        modelAlias: entry.model.alias,
        permissionMode: "default",
      });
      await tick();
      await click(chip());
      const actual = labels();
      const expected =
        kind === "work"
          ? [
              "수동 승인",
              ...(entry.allowed ? ["자동 승인"] : []),
              "모든 승인 건너뛰기",
            ]
          : [
              ...(entry.allowed ? ["자동"] : []),
              "수동",
              "편집 자동 수락",
              "계획",
              "권한 무시",
            ];
      check(
        `permission:${kind}:${entry.name}`,
        JSON.stringify(actual) === JSON.stringify(expected),
      );
      report.observations[`permission:${kind}:${entry.name}`] = actual;
      if (entry.allowed) {
        await click(
          permissionItems().find(
            (item) =>
              item.querySelector("span.block")?.textContent ===
              (kind === "work" ? "자동 승인" : "자동"),
          ),
        );
        check(
          `permission:${kind}:${entry.name}:auto-chip`,
          chip().textContent.trim() ===
            (kind === "work" ? "자동 승인" : "자동") &&
            current().permissionMode === "auto_classified",
        );
        await click(chip());
        await click(
          permissionItems().find(
            (item) =>
              item.querySelector("span.block")?.textContent ===
              (kind === "work" ? "수동 승인" : "수동"),
          ),
        );
        check(
          `permission:${kind}:${entry.name}:manual-chip`,
          chip().textContent.trim() ===
            (kind === "work" ? "수동 승인" : "수동") &&
            current().permissionMode === "default",
        );
      } else await closeMenu();
    }
  }
  await toggle("work");
  return report;
};
window.r8Panel = async (kind) => {
  window.orca.git.status = async () => repo();
  await mountConversation(kind, { messages: taskMessages(24) });
  const p = `panel:${kind}:`,
    selector = kind === "work" ? "task" : "plan",
    overviewSelector =
      kind === "work"
        ? "[data-work-task-overview]"
        : "[data-plan-task-overview]",
    detailSelector =
      kind === "work" ? "[data-work-task-detail]" : "[data-plan-task-detail]";
  const card = document.querySelector(`[data-context="${selector}"]`),
    overview = document.querySelector(overviewSelector);
  check(p + "only-assigned-tile", !!card && allTiles().length === 1);
  const raw = current().rightPanelTiles;
  const rows = [...card.querySelectorAll("[data-task-row]")];
  check(
    p + "actual-task-statuses",
    rows.length === 24 &&
      rows
        .slice(0, 3)
        .map((row) => row.dataset.status)
        .join(",") === "in_progress,completed,pending",
  );
  check(p + "completion-style", !!rows[1].querySelector(".line-through"));
  check(
    p + "numbered-animation",
    rows[0].querySelector("[data-task-status]").textContent.trim() === "1" &&
      !!rows[0].querySelector(".animate-spin"),
  );
  check(p + "blockedBy-kept", rows[0].textContent.includes("#3 완료 필요"));
  const primary = rows[12].querySelector("[data-task-detail-trigger]");
  const scroll =
    kind === "work"
      ? card.querySelector('[data-task-section-scroll="progress"]')
      : overview;
  scroll.scrollTop = 80;
  scroll.dispatchEvent(new Event("scroll"));
  const before = scroll.scrollTop,
    doc = card.querySelector("h1");
  await click(primary);
  check(
    p + "whole-detail",
    overview.hidden &&
      overview.inert &&
      !!document.querySelector(detailSelector),
  );
  check(p + "back-focus", document.activeElement === button("목록으로"));
  check(
    p + "detail-content",
    document.querySelector(detailSelector).textContent.includes("상세 내용 13"),
  );
  await click(button("목록으로"));
  check(
    p + "retained-dom-scroll-focus",
    document.querySelector(overviewSelector) === overview &&
      !overview.hidden &&
      scroll.scrollTop === before &&
      document.activeElement === primary,
  );
  check(p + "raw-columns-retained", current().rightPanelTiles === raw);
  if (kind === "work") {
    check(
      p + "section-order",
      [...card.querySelectorAll("section")]
        .map((section) => section.getAttribute("aria-label"))
        .join(",") === "진행 상황,출력,컨텍스트",
    );
    check(
      p + "no-expansion",
      !card.querySelector('button[title$="넓게 보기"]'),
    );
    check(
      p + "outputs-menu-individual",
      card.querySelectorAll('section[aria-label="출력"] article').length ===
        3 &&
        !card
          .querySelector('section[aria-label="출력"]')
          .textContent.includes("모두 저장"),
    );
    const bounds = card.getBoundingClientRect(),
      available = document
        .querySelector("[data-work-panel-available]")
        .getBoundingClientRect();
    check(
      p + "section-height-caps",
      [...card.querySelectorAll("[data-task-section]")].every(
        (section) =>
          section.getBoundingClientRect().height <= available.height / 3 + 1,
      ),
    );
    const input = document.querySelector("textarea");
    const draft = input.value;
    await click(
      rows[0].querySelector('[data-behavior="action:ask-about-task"]'),
    );
    check(
      p + "question-appends-only",
      input.value.startsWith(draft) &&
        input.value.includes("> 작업 1") &&
        report.sendCalls === 0,
    );
    report.observations[p + "height"] = {
      card: bounds.height,
      available: available.height,
    };
  } else {
    check(
      p + "code-expansion-retained",
      !!card.querySelector('button[title$="넓게 보기"]'),
    );
    check(
      p + "plan-document-retained",
      doc === card.querySelector("h1") && doc.textContent === "R8 계획",
    );
    check(
      p + "question-absent",
      !card.querySelector('[data-behavior="action:ask-about-task"]'),
    );
  }
  // actual header 메뉴의 타일 항목만 관측한다.
  const titleMenu = button("우측 패널 타일");
  if (titleMenu) {
    await click(primary);
    await click(titleMenu);
    const menu = [...document.querySelectorAll('[role="menuitemcheckbox"]')];
    const texts = menu.map((item) => item.textContent.trim());
    const expected =
      kind === "work" ? ["작업"] : ["계획", "백그라운드 작업", "변경사항"];
    check(
      p + "tile-menu-role",
      expected.every((text) => texts.some((actual) => actual.includes(text))) &&
        (kind === "work"
          ? texts.length === 1
          : !texts.some((text) => text === "작업")),
    );
    const target = menu.find((item) =>
      item.textContent.trim().includes(kind === "work" ? "작업" : "계획"),
    );
    await click(target);
    check(
      p + "menu-hides-tile",
      !document.querySelector(`[data-context="${selector}"]`),
    );
    check(
      p + "hidden-selection-retained",
      current().selectedTaskKey === "agent:13",
    );
    await closeMenu();
    await click(titleMenu);
    await click(
      [...document.querySelectorAll('[role="menuitemcheckbox"]')].find((item) =>
        item.textContent.trim().includes(kind === "work" ? "작업" : "계획"),
      ),
    );
    await closeMenu();
    check(
      p + "menu-restores-tile",
      !!document.querySelector(`[data-context="${selector}"]`),
    );
    check(p + "menu-restores-detail", !!document.querySelector(detailSelector));
    const activeKey = useChatStore.getState().activeKey,
      entry = useChatStore.getState().sessions[activeKey];
    const otherKey = activeKey + "-other";
    flushSync(() =>
      useChatStore.setState((state) => ({
        sessions: {
          ...state.sessions,
          [otherKey]: {
            ...entry,
            session: {
              ...entry.session,
              sessionId: otherKey,
              messages: taskMessages(1),
              selectedTaskKey: null,
            },
          },
        },
        activeKey: otherKey,
      })),
    );
    await tick();
    check(
      p + "session-selection-isolated",
      !document.querySelector(detailSelector) &&
        document.querySelectorAll("[data-task-row]").length === 1,
    );
    flushSync(() => useChatStore.setState({ activeKey }));
    await tick();
    check(
      p + "session-cache-detail-restored",
      !!document.querySelector(detailSelector) &&
        current().selectedTaskKey === "agent:13",
    );
    await click(button("목록으로"));
    const restoredCard = document.querySelector(`[data-context="${selector}"]`),
      fullHeight = restoredCard.getBoundingClientRect().height;
    const content = {
      messages: current().messages,
      planContent: current().planContent,
      extraDirs: current().extraDirs,
    };
    patch({ messages: [], planContent: null, extraDirs: [] });
    await tick();
    const emptyHeight = restoredCard.getBoundingClientRect().height;
    check(
      p + "empty-height-contract",
      kind === "work"
        ? emptyHeight < fullHeight - 10
        : Math.abs(emptyHeight - fullHeight) < 1,
    );
    patch(content);
    await tick();
  } else check(p + "actual-header-menu", false);
  return report;
};
window.r8Motion = () => {
  const icon = document.querySelector('[data-context="plan"] .animate-spin');
  return {
    present: !!icon,
    name: icon ? getComputedStyle(icon).animationName : null,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
};
window.r8RecordMotion = (value) => {
  report.observations.motion = value;
  check(
    "panel:code:motion",
    value.normal.present && value.normal.name !== "none",
  );
  check(
    "panel:code:reduced-motion",
    value.reduced.present &&
      value.reduced.name === "none" &&
      value.reduced.reduced,
  );
  return report;
};
window.r8Transcript = async (kind) => {
  const messages = [
    {
      role: "assistant",
      createdAt: 1700000000000,
      parts: [
        { type: "text", text: "상위 응답 문장" },
        {
          type: "tool_call",
          toolRunId: "r8-child",
          toolName: "Task",
          args: { description: "자료 분석", prompt: "분석" },
        },
        {
          type: "tool_result",
          toolRunId: "r8-child",
          isError: false,
          result: "분석 완료",
        },
      ],
    },
  ];
  const policy = agentUiPolicy(kind).transcript;
  const child = (
    <>
      <div data-r8-assistant>
        <AssistantTurn
          turn={{ role: "assistant", messages, startIndex: 0 }}
          transcriptPolicy={policy}
        />
      </div>
      <div data-r8-direct-subagent>
        <AgentTaskRow
          call={{
            toolUseId: "r8-child",
            name: "Task",
            input: { description: "자료 분석", prompt: "분석" },
            result: { output: "분석 완료", isError: false },
          }}
          transcriptPolicy={policy}
        />
      </div>
    </>
  );
  await mountConversation(
    kind,
    {
      messages,
      planContent: "# R8 승인 본문",
      pendingPlanReview: {
        requestId: `r8-review-${kind}`,
        plan: "# R8 승인 본문",
      },
    },
    child,
  );
  const p = `transcript:${kind}:`,
    approval = document.querySelector('[aria-label="계획 승인"]');
  check(p + "actual-approval", !!approval);
  check(
    p + "plan-body-placement",
    kind === "work"
      ? approval.textContent.includes("R8 승인 본문")
      : !approval.textContent.includes("R8 승인 본문") &&
          !!document.querySelector('[data-context="plan"]'),
  );
  check(
    p + "assistant-text",
    document
      .querySelector("[data-r8-assistant]")
      .textContent.includes("상위 응답 문장"),
  );
  const direct = document.querySelector("[data-r8-direct-subagent]");
  await click(
    direct.querySelector('[role="button"]') ?? direct.querySelector("button"),
  );
  check(
    p + "subagent-detail-placement",
    kind === "work"
      ? !!direct.querySelector('[data-subagent-inline="r8-child"]') &&
          !document.querySelector('[data-context="subagent"]')
      : !direct.querySelector("[data-subagent-inline]") &&
          !!document.querySelector('[data-context="subagent"]'),
  );
  return report;
};
window.r8Nav = async () => {
  await mountNavigation();
  const work = document.querySelector('[data-session-id="nav-work"]'),
    code = document.querySelector('[data-session-id="nav-code"]');
  const icon = work.querySelector('[data-context="session-agent-kind"]'),
    codeIcon = code.querySelector('[data-context="session-agent-kind"]');
  check(
    "nav:labels-icons",
    icon.getAttribute("aria-label") === "작업" &&
      codeIcon.getAttribute("aria-label") === "코드" &&
      icon.querySelector("svg").innerHTML !==
        codeIcon.querySelector("svg").innerHTML,
  );
  check(
    "nav:no-trailing-label",
    ![...code.querySelectorAll("span")].some(
      (element) => element.textContent === "코드",
    ),
  );
  const color = getComputedStyle(icon).color;
  flushSync(() =>
    ingestChatEvent({
      type: "message.completed",
      sessionId: "nav-work",
      message: { text: "중간 응답" },
    }),
  );
  await tick();
  check("nav:intermediate-no-completion", icon.dataset.state === "default");
  flushSync(() =>
    ingestChatEvent({ type: "turn.ended", sessionId: "nav-work" }),
  );
  await tick();
  check(
    "nav:unviewed-completion",
    icon.dataset.state === "unseen-complete" &&
      getComputedStyle(icon).color !== color &&
      getComputedStyle(icon.querySelector("svg")).strokeWidth === "40px",
  );
  await sessionsActions.refresh();
  await tick();
  check("nav:refresh-preserves", icon.dataset.state === "unseen-complete");
  await click(work);
  check(
    "nav:read-clears",
    icon.dataset.state === "default" &&
      useSessionsStore.getState().viewedSessionId === "nav-work",
  );
  check(
    "nav:route",
    document.querySelector("[data-r8-route]").dataset.r8Route ===
      "/chat/nav-work",
  );
  flushSync(() =>
    ingestChatEvent({ type: "turn.ended", sessionId: "nav-work" }),
  );
  await tick();
  check("nav:viewed-no-new-dot", icon.dataset.state === "default");
  await click(document.querySelector("[data-r8-route]"));
  check("nav:leave-no-replay", icon.dataset.state === "default");
  check("side-effects:no-send", report.sendCalls === 0);
  return report;
};
