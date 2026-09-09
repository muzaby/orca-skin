// Codex 작성. r5의 실제 페이지/Composer 호스트를 재사용하고 ΔV6 동작만 추가한다.
import "./panel-r5-native-browser";
import { flushSync } from "react-dom";
import { useChatStore } from "@source/renderer/src/features/chat/store/chatStore";
import { useAgentStore } from "@source/renderer/src/shared/stores/agentStore";
import { parseClaudeModels } from "@source/main/features/harnesses/claude/model-parser";

const report = { checks: {}, observations: {} };
window.r6Report = report;
const tick = () => new Promise((resolve) => setTimeout(resolve, 70));
const check = (name, ok) => {
  report.checks[name] = !!ok;
  if (!ok) throw new Error(name);
};
const patch = (value) =>
  flushSync(() =>
    useChatStore.setState((s) => ({
      sessions: {
        ...s.sessions,
        [s.activeKey]: {
          ...s.sessions[s.activeKey],
          session: { ...s.sessions[s.activeKey].session, ...value },
        },
      },
    })),
  );
const toggle = (kind) =>
  flushSync(() =>
    document
      .querySelector(
        `button[aria-label="${kind === "coding" ? "코딩" : "작업"}"]`,
      )
      .click(),
  );
const group = () =>
  document.querySelector('[data-surface="branch-worktree-group"]');
const branch = () =>
  document.querySelector('button[title="브랜치 전환"]') ??
  group()?.querySelector("button");
const repo = (branch = "main") => ({
  isRepo: true,
  root: "C:/fixture",
  branch,
  detached: branch === null,
});

window.r6Landing = async (page) => {
  const calls = [];
  window.orca.git.status = (request) =>
    new Promise((resolve, reject) => calls.push({ request, resolve, reject }));
  await window.panelStage(page);
  patch({ cwd: "C:/fixture" });
  await tick();
  const prefix = page + ":";
  check(prefix + "work-no-query", calls.length === 0 && !group());
  const marks = [
    ...document.querySelectorAll(
      "[data-agent-mode-chevron],[data-agent-mode-separator]",
    ),
  ];
  const fonts = marks.map((el) => {
    const s = getComputedStyle(el);
    return [el.textContent, s.fontFamily, s.fontSize, s.fontWeight];
  });
  report.observations[prefix + "fonts"] = fonts;
  check(
    prefix + "characters",
    marks.map((el) => el.textContent).join("") === "</>",
  );
  check(
    prefix + "same-font",
    fonts.length === 3 &&
      new Set(fonts.map((f) => JSON.stringify(f.slice(1)))).size === 1,
  );
  check(
    prefix + "hero-normal",
    getComputedStyle(document.querySelector("[data-agent-mode-hero]"))
      .fontWeight === "400",
  );
  const input = document.querySelector("textarea");
  const workAdd =
    document.querySelector('button[title="폴더 추가"]') ??
    [...document.querySelectorAll('[data-surface="cwd-panel"] button')].at(-1);
  const workAddLeft = workAdd.getBoundingClientRect().left;
  toggle("coding");
  check(
    prefix + "immediate-dash",
    branch()?.textContent.trim() === "-" && branch().disabled,
  );
  await tick();
  check(prefix + "coding-one-query", calls.length === 1);
  const codingAddLeft = workAdd.getBoundingClientRect().left;
  check(prefix + "add-dir-closes-gap", codingAddLeft > workAddLeft);
  toggle("work");
  check(prefix + "work-hides", !group());
  calls[0].resolve(repo());
  await tick();
  check(
    prefix + "hidden-response-no-extra-query",
    calls.length === 1 && !group(),
  );
  toggle("coding");
  check(
    prefix + "cache-immediate",
    branch()?.textContent.includes("main") && !branch().disabled,
  );
  await tick();
  check(prefix + "cache-no-refetch", calls.length === 1);
  check(
    prefix + "input-preserved",
    document.querySelector("textarea") === input,
  );

  patch({ cwd: "C:/fixture/next" });
  check(prefix + "changed-cwd-dash", branch()?.textContent.trim() === "-");
  await tick();
  patch({ cwd: "C:/fixture/latest" });
  await tick();
  calls.at(-1).resolve(repo("latest"));
  await tick();
  calls.at(-2).resolve(repo("stale"));
  await tick();
  check(
    prefix + "stale-response-ignored",
    branch()?.textContent.includes("latest") &&
      !group().textContent.includes("stale"),
  );
  toggle("work");
  const before = calls.length;
  patch({ cwd: "C:/fixture/nonrepo" });
  await tick();
  check(prefix + "work-cwd-no-query", calls.length === before);
  toggle("coding");
  await tick();
  calls
    .at(-1)
    .resolve({ isRepo: false, root: null, branch: null, detached: false });
  await tick();
  check(prefix + "nonrepo-hides", !group());
  patch({ cwd: "C:/fixture/failure" });
  await tick();
  calls.at(-1).reject(new Error("fixture failure"));
  await tick();
  check(prefix + "failed-query-hides", !group());
  patch({ cwd: "C:/fixture/detached" });
  await tick();
  calls.at(-1).resolve(repo(null));
  await tick();
  check(
    prefix + "detached-not-loading",
    !!branch() && !branch().disabled && branch().textContent.trim() !== "-",
  );

  for (const kind of ["work", "coding"]) {
    toggle(kind);
    await tick();
    for (const family of ["haiku", "sonnet", "opus", "fable"]) {
      for (const [version, isCustom, allowed] of [
        ["4-5", false, false],
        ["4.5", false, false],
        ["4-6", false, true],
        ["4.6", false, true],
        ["4.6", true, false],
      ]) {
        const model = `claude-${family}-${version}`;
        const key = `r6-${family}-${version}-${isCustom}`;
        const agent = {
          key,
          adapter: "claude",
          supported: true,
          models: parseClaudeModels({ env: { ANTHROPIC_MODEL: model } }).map(
            (entry) => ({ ...entry, ...(isCustom ? { isCustom: true } : {}) }),
          ),
        };
        flushSync(() => useAgentStore.setState({ agents: [agent] }));
        patch({ providerKey: key, modelFamily: model, modelAlias: family });
        await tick();
        flushSync(() =>
          document.querySelector('button[title="권한 모드"]').click(),
        );
        await tick();
        const menu = [
          ...document.querySelectorAll('[role="menuitemradio"]'),
        ].map((el) => el.textContent);
        check(
          prefix + `${kind}-${family}-${version}-custom${isCustom}`,
          menu.some((text) =>
            text.includes("Claude가 권한 결정을 처리합니다"),
          ) === allowed,
        );
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        await tick();
      }
    }
  }
  return report;
};

window.r6Nav = async (read = false) => {
  if (!read) {
    const previous = await window.panelR5Nav();
    for (const [name, ok] of Object.entries(previous.checks))
      check("nav-regression:" + name, ok);
  } else {
    flushSync(() =>
      document.querySelector('[data-session-id="nav-work"]').click(),
    );
    await tick();
  }
  const icon = document.querySelector(
    '[data-session-id="nav-work"] [data-context="session-agent-kind"]',
  );
  const svg = icon.querySelector("svg");
  const css = getComputedStyle(svg);
  report.observations[read ? "read" : "unread"] = {
    stroke: css.stroke,
    strokeWidth: css.strokeWidth,
    fill: css.fill,
    state: icon.dataset.state,
  };
  check(
    read ? "nav-read-normal" : "nav-unread-bold",
    read
      ? css.stroke === "none"
      : css.strokeWidth === "40px" && css.stroke !== "none",
  );
  check(
    read ? "nav-read-state" : "nav-unread-blue",
    icon.dataset.state === (read ? "default" : "unseen-complete"),
  );
  return report;
};
