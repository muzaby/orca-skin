// Codex 작성. 실제 랜딩/Composer와 Work 출력 목록의 직접 인수.
import "./panel-r5-native-browser";
import { flushSync } from "react-dom";
import { useChatStore } from "@source/renderer/src/features/chat/store/chatStore";
import { useAgentStore } from "@source/renderer/src/shared/stores/agentStore";
import { parseRuntimeModels } from "@source/main/features/harnesses/claude/model-parser";
import { modelIdentity } from "@source/shared/model-identity";

const report = { checks: {}, observations: {} };
window.r6Report = report;
const tick = () => new Promise((resolve) => setTimeout(resolve, 100));
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
const chip = () => document.querySelector('button[title="권한 모드"]');
const close = () =>
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
window.r7Landing = async () => {
  await window.panelStage("new-landing");
  const names = [
    "claudecode-sonnet-5",
    "claudecode-opus-4.8",
    "claudecode-opus-4.8[1m]",
  ];
  const models = parseRuntimeModels({ availableModels: names });
  const agent = {
    key: "r7-claude",
    adapter: "claude",
    supported: true,
    models,
  };
  // 재조회도 같은 카탈로그를 반환하도록 실제 IPC 경계를 고정한다.
  window.orca.agent.list = async () => [agent];
  flushSync(() => useAgentStore.setState({ agents: [agent] }));
  for (const kind of ["work", "coding"]) {
    flushSync(() =>
      document
        .querySelector(
          `button[aria-label="${kind === "work" ? "작업" : "코딩"}"]`,
        )
        .click(),
    );
    for (const name of names) {
      const model = models.find((m) => modelIdentity(m) === name);
      patch({
        providerKey: agent.key,
        modelFamily: name,
        modelAlias: model.alias,
        permissionMode: "default",
      });
      await tick();
      check(
        `${kind}:${name}:identity`,
        useChatStore.getState().sessions[useChatStore.getState().activeKey]
          .session.modelFamily === name,
      );
      flushSync(() => chip().click());
      await tick();
      const items = [...document.querySelectorAll('[role="menuitemradio"]')];
      const label = kind === "work" ? "자동 승인" : "자동";
      const auto = items.find(
        (el) => el.querySelector("span.block")?.textContent === label,
      );
      check(`${kind}:${name}:auto-visible`, !!auto);
      if (kind === "work") {
        flushSync(() => auto.click());
        await tick();
        check(`${name}:auto-chip`, chip().textContent.trim() === "자동 승인");
        flushSync(() => chip().click());
        await tick();
        const manual = [
          ...document.querySelectorAll('[role="menuitemradio"]'),
        ].find(
          (el) => el.querySelector("span.block")?.textContent === "수동 승인",
        );
        check(`${name}:manual-menu`, !!manual);
        flushSync(() => manual.click());
        await tick();
        check(`${name}:manual-chip`, chip().textContent.trim() === "수동 승인");
      } else {
        close();
        await tick();
        check(`${name}:coding-label`, chip().textContent.trim() === "수동");
      }
    }
  }
  // 캡처는 Work 수동 승인 상태.
  flushSync(() => document.querySelector('button[aria-label="작업"]').click());
  await tick();
  return report;
};
window.r7Outputs = async () => {
  const refs = [1, 2, 3].map((id) => ({
    publicationId: `r7-p${id}`,
    artifactFileId: `r7-f${id}`,
    title: `작업 결과 보고서 ${id}`,
    filename: `report-${id}.md`,
    kind: "markdown",
    sizeBytes: 100,
    publishedAt: 1700000000000,
  }));
  window.orca.artifacts.list = async () => structuredClone(refs);
  window.orca.artifacts.status = async ({ publicationIds }) =>
    publicationIds.map((id) => ({
      publicationId: id,
      artifactFileId: refs.find((r) => r.publicationId === id).artifactFileId,
      availability: {
        state: "present",
        sizeBytes: 100,
        modifiedAt: 1700000000000,
      },
    }));
  await window.panelStage("work-full");
  await new Promise((resolve) => setTimeout(resolve, 400));
  const rows = [
    ...document.querySelectorAll('section[aria-label="출력"] article'),
  ];
  check("output:three-rows", rows.length === 3);
  const bounds = rows.map((row) => {
    const r = row.getBoundingClientRect(),
      css = getComputedStyle(row);
    return {
      top: r.top,
      bottom: r.bottom,
      height: r.height,
      left: r.left,
      right: r.right,
      paddingTop: css.paddingTop,
      paddingBottom: css.paddingBottom,
    };
  });
  report.observations.outputRows = bounds;
  check(
    "output:padding-four",
    bounds.every((b) => b.paddingTop === "4px" && b.paddingBottom === "4px"),
  );
  check(
    "output:gap-four",
    bounds.slice(1).every((b, i) => Math.abs(b.top - bounds[i].bottom - 4) < 1),
  );
  check(
    "output:actions",
    rows.every(
      (row) =>
        row.querySelector('button[aria-label="파일 작업"]') ||
        row.querySelector("button[aria-haspopup]"),
    ),
  );
  const menuButton = rows[0].querySelector("button");
  flushSync(() => menuButton.click());
  await tick();
  const menu = document.querySelector('[role="menu"]');
  check("output:menu-opens", !!menu && menu.textContent.includes("휴지통"));
  close();
  await tick();
  return report;
};
