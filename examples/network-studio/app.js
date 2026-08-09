const appShell = document.querySelector(".app-shell");
const modeOptions = [...document.querySelectorAll("[data-mode-option]")];
const agentOptions = [...document.querySelectorAll("[data-agent]")];
const completionOptions = document.querySelector("#completion-options");
const launchButton = document.querySelector("#launch-button");
const graphStage = document.querySelector("#graph-stage");
const networkState = document.querySelector("#network-state");
const eventStream = document.querySelector("#event-stream");
const contractPreview = document.querySelector("#contract-preview");
const gateProgress = document.querySelector("#gate-progress");
const gateValue = document.querySelector("#gate-value");
const saveBlueprint = document.querySelector("#save-blueprint");

const elements = {
  blueprintKind: document.querySelector("#blueprint-kind"),
  agentPickerTitle: document.querySelector("#agent-picker-title"),
  agentPickerLimit: document.querySelector("#agent-picker-limit"),
  networkTitle: document.querySelector("#network-title"),
  ledgerId: document.querySelector("#ledger-id"),
  metricActive: document.querySelector("#metric-active"),
  metricDelegations: document.querySelector("#metric-delegations"),
  metricScore: document.querySelector("#metric-score"),
  gateCopy: document.querySelector("#gate-copy"),
  rootName: document.querySelector("#node-root-name"),
  rootRole: document.querySelector("#node-root-role"),
  aName: document.querySelector("#node-a-name"),
  aRole: document.querySelector("#node-a-role"),
  bName: document.querySelector("#node-b-name"),
  bRole: document.querySelector("#node-b-role"),
  cName: document.querySelector("#node-c-name"),
  cRole: document.querySelector("#node-c-role"),
  dName: document.querySelector("#node-d-name"),
  dRole: document.querySelector("#node-d-role"),
};

const modes = {
  runtime: {
    blueprintKind: "FIXED ENTRY",
    agentPickerTitle: "First agent",
    agentPickerLimit: "SELECT 1",
    networkTitle: "A fixed lead, elastic execution.",
    gateCopy: "Root result + network quiescence + budget guard",
    selectedAgents: ["Aiko"],
    nodes: [
      ["AIKO", "FIRST AGENT"],
      ["SCOUT", "RESEARCH"],
      ["PLANNER", "DECOMPOSE"],
      ["FORGE", "EXECUTE"],
      ["JUDGE", "VERIFY"],
    ],
    paths: [
      "M120 238 C230 238 245 92 350 92",
      "M120 238 C230 238 245 360 350 360",
      "M350 92 C470 92 470 190 590 190",
      "M350 360 C470 360 470 282 590 282",
      "M590 190 C700 190 700 282 590 282",
    ],
    completion: [
      ["root_submitted", "Root agent submits", "入口 agent 提交结构化最终结果", true],
      ["network_quiet", "Network reaches quiescence", "没有未完成 delegation 或在途调用", true],
      ["budget_guard", "Budget guard", "步数、时间和费用均未超限", true],
      ["external_review", "External approval", "可选：等待人工或外部系统确认", false],
    ],
    events: [
      ["00:01", "Aiko accepted the root objective."],
      ["00:03", "Two scoped delegations dispatched."],
      ["00:05", "Scout returned benchmark evidence."],
      ["00:07", "Forge assembled the execution plan."],
      ["00:09", "Judge verified the final artifact."],
      ["00:10", "Root result accepted; network is quiet."],
    ],
  },
  adaptive: {
    blueprintKind: "TRAINABLE MESH",
    agentPickerTitle: "Seed agents",
    agentPickerLimit: "SELECT 1–4",
    networkTitle: "A network that learns how to win.",
    gateCopy: "Evaluator threshold + quiescence + no-regression guard",
    selectedAgents: ["Aiko", "Scout", "Forge"],
    nodes: [
      ["SYNTH", "DYNAMIC ROUTER"],
      ["SCOUT-A", "EXPLORE"],
      ["SCOUT-B", "DIVERGE"],
      ["SOLVER", "COMPOSE"],
      ["ARENA", "EVALUATE"],
    ],
    paths: [
      "M175 100 C245 100 295 190 380 240",
      "M182 365 C252 365 300 292 380 240",
      "M380 240 C462 190 505 105 585 105",
      "M380 240 C462 292 505 355 578 355",
      "M175 100 C330 42 462 58 585 105",
    ],
    completion: [
      ["score_threshold", "Evaluator score ≥ 0.92", "以隐藏集或任务 judge 的分数验收", true],
      ["network_quiet", "Network reaches quiescence", "没有有效候选仍在运行", true],
      ["no_regression", "No regression across 3 trials", "连续试验保持或提升当前成绩", true],
      ["budget_cap", "Training budget cap", "达到预算时保留最佳网络并停止", true],
    ],
    events: [
      ["00:01", "Three seed agents entered the arena."],
      ["00:03", "Topology mutation created 4 candidates."],
      ["00:06", "Candidate 02 improved task score to 0.86."],
      ["00:09", "Critic removed a low-value delegation edge."],
      ["00:12", "Candidate 04 crossed the 0.92 threshold."],
      ["00:14", "Best network frozen after no-regression checks."],
    ],
  },
};

let activeMode = "runtime";
let selectedAgents = new Set(modes.runtime.selectedAgents);
let runTimers = [];

function renderMode(mode) {
  stopSimulation();
  activeMode = mode;
  const config = modes[mode];
  selectedAgents = new Set(config.selectedAgents);
  appShell.dataset.mode = mode;
  window.history.replaceState({}, "", mode === "runtime" ? "/" : `/?mode=${mode}`);

  for (const option of modeOptions) {
    const isActive = option.dataset.modeOption === mode;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-checked", String(isActive));
  }

  elements.blueprintKind.textContent = config.blueprintKind;
  elements.agentPickerTitle.textContent = config.agentPickerTitle;
  elements.agentPickerLimit.textContent = config.agentPickerLimit;
  elements.networkTitle.textContent = config.networkTitle;
  elements.gateCopy.textContent = config.gateCopy;

  const nodeKeys = ["root", "a", "b", "c", "d"];
  config.nodes.forEach(([name, role], index) => {
    elements[`${nodeKeys[index]}Name`].textContent = name;
    elements[`${nodeKeys[index]}Role`].textContent = role;
  });
  document.querySelectorAll(".edge").forEach((edge, index) => {
    edge.setAttribute("d", config.paths[index]);
  });
  document.querySelector(".pulse-a animateMotion").setAttribute("path", config.paths[0]);
  document.querySelector(".pulse-b animateMotion").setAttribute("path", config.paths[3]);

  renderAgents();
  renderCompletion(config.completion);
  resetLedger();
  updateContract();
}

function renderAgents() {
  for (const option of agentOptions) {
    const isSelected = selectedAgents.has(option.dataset.agent);
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-pressed", String(isSelected));
  }
}

function renderCompletion(rules) {
  completionOptions.replaceChildren(
    ...rules.map(([value, title, description, checked]) => {
      const label = document.createElement("label");
      label.className = "completion-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = value;
      input.checked = checked;
      input.addEventListener("change", updateContract);
      const copy = document.createElement("span");
      copy.innerHTML = `<strong>${title}</strong>${description}`;
      label.append(input, copy);
      return label;
    }),
  );
}

function updateContract() {
  const rules = [...completionOptions.querySelectorAll("input:checked")].map(
    (input) => input.value,
  );
  const agents = [...selectedAgents].map((agent) => `"${agent}"`).join(", ");
  contractPreview.textContent = `{ first_agent: [${agents}], completion_policy: [${rules.length} rules] }`;
  gateValue.textContent = `0 / ${rules.length}`;
  gateProgress.style.width = "0%";
}

function resetLedger() {
  networkState.className = "network-state";
  networkState.querySelector("strong").textContent = "DRAFT";
  graphStage.classList.remove("is-running");
  elements.ledgerId.textContent = "#DRAFT";
  elements.metricActive.textContent = "0";
  elements.metricDelegations.textContent = "0";
  elements.metricScore.textContent = "—";
  eventStream.innerHTML =
    '<div class="event-row"><span>00:00</span><p>Blueprint ready. Waiting to launch.</p></div>';
  launchButton.disabled = false;
  launchButton.querySelector("span").textContent = "Run network";
}

function stopSimulation() {
  runTimers.forEach((timer) => window.clearTimeout(timer));
  runTimers = [];
}

function runSimulation() {
  stopSimulation();
  const config = modes[activeMode];
  const checkedRules = completionOptions.querySelectorAll("input:checked").length;
  graphStage.classList.add("is-running");
  networkState.className = "network-state is-running";
  networkState.querySelector("strong").textContent = "RUNNING";
  elements.ledgerId.textContent = `#${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
  elements.metricActive.textContent = activeMode === "runtime" ? "1" : "3";
  elements.metricDelegations.textContent = "0";
  elements.metricScore.textContent = activeMode === "runtime" ? "—" : "0.41";
  eventStream.replaceChildren();
  launchButton.disabled = true;
  launchButton.querySelector("span").textContent = "Network running";

  config.events.forEach(([time, copy], index) => {
    const timer = window.setTimeout(
      () => {
        const event = document.createElement("div");
        event.className = "event-row";
        event.innerHTML = `<span>${time}</span><p>${copy}</p>`;
        eventStream.prepend(event);
        while (eventStream.children.length > 5) eventStream.lastElementChild.remove();

        const progress = (index + 1) / config.events.length;
        elements.metricDelegations.textContent = String(
          activeMode === "runtime" ? Math.min(index + 1, 4) : Math.min((index + 1) * 2, 9),
        );
        if (activeMode === "adaptive") {
          elements.metricScore.textContent = (0.41 + progress * 0.53).toFixed(2);
        }
        const passedRules = Math.min(checkedRules, Math.floor(progress * checkedRules));
        gateValue.textContent = `${passedRules} / ${checkedRules}`;
        gateProgress.style.width = `${progress * 100}%`;

        if (index === config.events.length - 1) completeSimulation(checkedRules);
      },
      650 + index * 720,
    );
    runTimers.push(timer);
  });
}

function completeSimulation(ruleCount) {
  graphStage.classList.remove("is-running");
  networkState.className = "network-state is-complete";
  networkState.querySelector("strong").textContent = "COMPLETE";
  elements.metricActive.textContent = "0";
  gateValue.textContent = `${ruleCount} / ${ruleCount}`;
  gateProgress.style.width = "100%";
  launchButton.disabled = false;
  launchButton.querySelector("span").textContent = "Run again";
}

modeOptions.forEach((option) => {
  option.addEventListener("click", () => renderMode(option.dataset.modeOption));
});

agentOptions.forEach((option) => {
  option.addEventListener("click", () => {
    const agent = option.dataset.agent;
    if (activeMode === "runtime") {
      selectedAgents = new Set([agent]);
    } else if (selectedAgents.has(agent) && selectedAgents.size > 1) {
      selectedAgents.delete(agent);
    } else {
      selectedAgents.add(agent);
    }
    renderAgents();
    updateContract();
  });
});

document.querySelectorAll("[data-node]").forEach((node) => {
  node.addEventListener("click", () => {
    document.querySelectorAll("[data-node]").forEach((candidate) => {
      candidate.classList.toggle("is-active", candidate === node);
    });
  });
});

saveBlueprint.addEventListener("click", () => {
  const original = saveBlueprint.textContent;
  saveBlueprint.textContent = "Blueprint saved";
  window.setTimeout(() => {
    saveBlueprint.textContent = original;
  }, 1400);
});

launchButton.addEventListener("click", runSimulation);
const requestedMode = new URLSearchParams(window.location.search).get("mode");
renderMode(requestedMode === "adaptive" ? "adaptive" : "runtime");
