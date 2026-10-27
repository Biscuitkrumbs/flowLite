// -----------------------------------------------------------------------------
// Configuration and application state
// -----------------------------------------------------------------------------
const STORAGE_KEY = "flowLiteDataV2";
const RECENT_KEY = "flowLiteRecentV1";
const STALE_MS = 24 * 60 * 60 * 1000;
const $ = (id) => document.getElementById(id);
const views = ["lookupView", "cageView", "dashboardView", "qrLabelsView"];
let currentCageId = null;

// -----------------------------------------------------------------------------
// Shared data with LocalStorage cache
// -----------------------------------------------------------------------------
function makeSeedData() {
  const now = Date.now();

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  const day = 24 * 60 * 60 * 1000;
  const min = 60 * 1000;

  const cages = Array.from(
    { length: 5 },
    (_, i) => ({
      id: `RC-${String(i + 1).padStart(3, "0")}`,
      active: true
    })
  );

  const cycles = [];
  const events = [];

  const addCycle = (
    cage,
    openedAgoMin,
    closedAgoMin = null,
    extras = {}
  ) => {
    const cycle = {
      id: crypto.randomUUID(),
      cageId: cage,
      openedAt: now - openedAgoMin * min,
      closedAt:
        closedAgoMin === null
          ? null
          : now - closedAgoMin * min,
      details: extras.details || {}
    };

    if (extras.packedAgo) {
      cycle.packedAt = now - extras.packedAgo * min;
    }

    if (extras.workedAgo) {
      cycle.workedAt = now - extras.workedAgo * min;
    }

    cycles.push(cycle);
    return cycle;
  };

  [
    ["RC-001", 82, null, {}],

    ["RC-002", 31, null, {
      packedAgo: 25,
      details: {
        department: "Hardware"
      }
    }],

    ["RC-003", 1620, null, {
      packedAgo: 1560,
      details: {
        department: "Paint"
      }
    }],

    ["RC-004", 142, null, {
      workedAgo: 38,
      details: {
        department: "Garden"
      }
    }],

    ["RC-005", 54, null, {
      details: {
        department: "Plumbing"
      }
    }]
  ].forEach(args => addCycle(...args));



  const currentHour = new Date().getHours();
  const completedDurations = [39, 52, 44, 61, 47, 35, 58, 49, 42, 55, 46, 51];
  completedDurations.forEach((duration, index) => {
    const hoursAgo = Math.max(0.25,
    Math.min(currentHour - 0.4,
    (completedDurations.length - index)  * 0.62)); const closedAgo = Math.round(hoursAgo * 60); addCycle(`RC-${String(2 + index * 6).padStart(3,"0")}`,
    closedAgo + duration,
    closedAgo,
    {
      details: {
        department: ["Hardware",
        "Paint",
        "Garden",
        "Tools"][index % 4]
      }
    });
  });
  [1, 2, 3, 4, 5, 6].forEach((daysAgo, i) => {
    for (let n = 0; n < 5 + i; n ++) {
      const close = daysAgo * day + (9 + n) * 37 * min; const duration = (42 + ((n * 7 + i * 5) % 27)) * min; cycles.push( {
        id: crypto.randomUUID(),
        cageId: `RC-${String(30+i*7+n).padStart(3,"0")}`,
        openedAt: now - close - duration,
        closedAt: now - close,
        details: {}
      });
    }
  });
  const attentionSeed = [[cycles[2], "Packaging", 95], [cycles[3], "Mixed aisles", 70], [cycles[5],
  "Packaging", 55], [cycles[6], "Overstock", 40], [cycles[7], "Wrong location", 25]];
  attentionSeed.forEach(([cycle, reason, ago]) => events.push( {
    id: crypto.randomUUID(),
    cycleId: cycle.id,
    cageId: cycle.cageId,
    timestamp: now - ago * min,
    type: "needs_attention",
    details: {
      reason
    }
  }));
  return {
    cages,
    cycles,
    events
  };
}
const DEMO_MODE = new URLSearchParams(location.search).get("demo") === "1";
let data = FlowState.empty();
let hasLoadedSharedData = false;
let pendingPackedDetails = false;
let editingCycleId = null;
let editingBaseDetails = {};

function setSyncStatus(message, state = "") {
  for (const id of ["syncStatus", "sharedStatusText"]) {
    const el = $(id);
    if (el) el.textContent = message;
  }
  $("sharedStatus").dataset.state = state;
  $("retrySyncButton").hidden = !["failed", "conflict"].includes(state);
  $("discardPendingButton").hidden = state !== "conflict";
}

function renderSharedState() {
  renderRecent();
  if (currentCageId && $("cageView").classList.contains("active")) renderCage();
  if ($("dashboardView").classList.contains("active")) renderDashboard();
  if ($("historyDialog").open) renderHistory();
}

const sync = new FlowSync({
  demo: DEMO_MODE,
  seed: DEMO_MODE ? makeSeedData() : FlowState.empty(),
  onChange(state) { data = state; renderSharedState(); },
  onStatus: setSyncStatus
});
data = sync.state;

function refreshSharedData() { return sync.synchronize(); }
async function loadSharedData() {
  const ok = await sync.synchronize();
  hasLoadedSharedData = true;
  return ok;
}

function recordAction(operation, message) {
  try {
    sync.enqueue(operation);
    if (message) toast(DEMO_MODE ? message : `${message} · pending sync`);
    return true;
  } catch (error) {
    toast(error.message);
    showLookupError(error.message);
    return false;
  }
}

// -----------------------------------------------------------------------------
// General helpers
// -----------------------------------------------------------------------------

function showView(id) {
  views.forEach((viewId) => $(viewId).classList.toggle("active", viewId === id));
  $("pageTitle").textContent = id === "dashboardView"
    ? CONFIG.brand.dashboardPageTitle
    : CONFIG.brand.defaultPageTitle;
  document.body.classList.toggle("showing-dashboard", id === "dashboardView");
}
function toInternalCageId(cageNumber) {
  return `RC-${cageNumber}`;
}
function cageExists(cageId) {
  return data.cages.some(cage => cage.id === cageId && cage.active);
}
function getOpenCycle(cageId) {
  return [...data.cycles].reverse().find(c => c.cageId === cageId && ! c.closedAt) || null;
}
function cycleEvents(cycle) {
  return data.events.filter(e => e.cycleId === cycle.id);
}
function lastActivity(cycle) {
  return Math.max(cycle.openedAt, cycle.packedAt || 0, cycle.workedAt || 0, ...cycleEvents(cycle).map(e => e.timestamp));
}
function formatDuration(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60), mins = minutes % 60;
  return mins ? `${hours}h ${mins}m`: `${hours}h`;
}
function formatClock(timestamp) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}
function formatTime(timestamp) {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(timestamp);
}
function destinationLabel(details = {}) {
  const aisle = String(details.aisle || "").trim();
  if (!aisle) return "";
  return /^aisle\s+/i.test(aisle) ? aisle : `Aisle ${aisle}`;
}
function dayStart(offset = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.getTime();
}

// -----------------------------------------------------------------------------
// Cage lookup and workflow
// -----------------------------------------------------------------------------
function recentCages() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(value) ? value.filter(id => /^RC-\d{3}$/.test(id)) : [];
  } catch { return []; }
}
function rememberCage(cageId) {
  const recent = recentCages().filter(id => id !== cageId);
  recent.unshift(cageId);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 6))); }
  catch (error) { console.warn("Recent cages could not be saved", error); }
  renderRecent();
}
function renderRecent() {
  const recent = recentCages().filter(cageExists);
  $("recentCages").innerHTML = recent.length
    ? recent.map(id => `<button class="chip" data-cage="${id}">${id.replace("RC-", "")}</button>`).join("")
    : '<span class="muted">No recent cages yet</span>';
  document.querySelectorAll("[data-cage]").forEach(button => button.addEventListener("click",
    () => openKnownCage(button.dataset.cage, { refresh: true })));
}
function displayCage(cageId, source = "manual", payload = "") {
  if (!recordAction({ type: "open", cageId, source, payload, newCycleId: crypto.randomUUID() })) return;
  currentCageId = cageId;
  rememberCage(cageId);
  renderCage();
  showLookupError("");
  showView("cageView");
}

async function openKnownCage(cageId, options = {}) {
  if (options.refresh) {
    await refreshSharedData({ quiet: true });
    renderRecent();
  }

  if (!cageExists(cageId)) {
    showLookupError(CONFIG.messages.cageNotFound);
    return;
  }

  displayCage(cageId);
}

function normaliseTypedCageId(value) {
  const match = String(value || "").trim().toUpperCase().match(/^(?:RC-)?(\d{1,3})$/);
  if (!match) return null;
  return Number(match[1]) > 0 ? toInternalCageId(match[1].padStart(3, "0")) : null;
}

function openCageFromDeepLink(payload) {
  const cageId = normaliseTypedCageId(payload);

  if (!cageId) {
    showLookupError(CONFIG.messages.invalidCageCode);
    return;
  }

  displayCage(cageId, "label");
}

function openCageFromInput(payload) {
  const typedCageId = normaliseTypedCageId(payload);

  if (typedCageId) {
    if (cageExists(typedCageId)) {
      $("cageInput").value = "";
      openKnownCage(typedCageId);
      return;
    }

    showLookupError(CONFIG.messages.cageNotFound);
    return;
  }

  const parsed = FlowQR.parse(payload);

  if (!parsed.valid) {
    showLookupError(CONFIG.messages.invalidCageCode);
    return;
  }

  const cageId = toInternalCageId(parsed.cageId);

  $("cageInput").value = "";
  displayCage(cageId, "qr", parsed.payload);
}


function showLookupError(message) {
  $("lookupError").textContent = message;
}
function renderCage() {
  const cycle = getOpenCycle(currentCageId);
  $("closedCycleNotice").hidden = Boolean(cycle);
  $("cageContent").hidden = !cycle;
  if (!cycle) return;

  const stale = Date.now() - lastActivity(cycle) >= STALE_MS;
  const details = cycle.details || {};
  const destination = destinationLabel(details);
  const department = String(details.department || "").trim();
  const message = String(details.notes || "").trim();

  $("cageName").textContent = currentCageId;
  $("normalActions").classList.toggle("hidden", stale);
  $("recoveryActions").classList.toggle("hidden", !stale);
  $("packedButton").classList.toggle("hidden", Boolean(cycle.packedAt || cycle.workedAt));
  $("workedButton").classList.toggle("hidden", Boolean(cycle.workedAt));

  $("destinationValue").textContent = destination || "Not entered";
  $("destinationValue").classList.toggle("placeholder", !destination);
  $("departmentValue").textContent = department || "Not entered";
  $("departmentValue").classList.toggle("placeholder", !department);
  $("messageSummary").classList.toggle("hidden", !message);
  $("messageValue").textContent = message;

  if (stale) {
    $("statusPill").textContent = "Check status";
    $("statusText").textContent = `Last updated ${formatClock(lastActivity(cycle))}`;
    $("cycleMeta").textContent = `${formatDuration(Date.now() - cycle.openedAt)} since first scan`;
  } else if (cycle.workedAt) {
    $("statusPill").textContent = "Being worked";
    $("statusText").textContent = `Being worked since ${formatTime(cycle.workedAt)}`;
    $("cycleMeta").textContent = `Updated ${formatDuration(Date.now() - cycle.workedAt)} ago`;
  } else if (cycle.packedAt) {
    $("statusPill").textContent = "Packed";
    $("statusText").textContent = `Packed at ${formatTime(cycle.packedAt)}`;
    $("cycleMeta").textContent = `Packed ${formatDuration(Date.now() - cycle.packedAt)} ago`;
  } else {
    $("statusPill").textContent = "First seen";
    $("statusText").textContent = `First scanned at ${formatTime(cycle.openedAt)}`;
    $("cycleMeta").textContent = `${formatDuration(Date.now() - cycle.openedAt)} ago`;
  }
}

function act(type, message) {
  const cycle = getOpenCycle(currentCageId);
  if (!cycle) { toast("This cycle has closed. Reopen the cage."); return; }
  if (!recordAction({ type, cageId: currentCageId, cycleId: cycle.id }, message)) return;
  if (type === "empty") showView("lookupView");
  else renderCage();
}
function recoveryNewLoad() {
  const cycle = getOpenCycle(currentCageId);
  if (!cycle) return;
  recordAction({ type: "new_load", cageId: currentCageId, cycleId: cycle.id,
    newCycleId: crypto.randomUUID() }, "New load started");
}
function openDetails(options = {}) {
  const cycle = getOpenCycle(currentCageId);
  if (!cycle) { toast("This cycle has closed. Reopen the cage."); return; }
  editingCycleId = cycle.id;
  editingBaseDetails = JSON.parse(JSON.stringify(cycle.details || {}));
  pendingPackedDetails = Boolean(options.markPacked);
  for (const [input, key] of [["departmentInput", "department"], ["packerInput", "packer"], ["aisleInput", "aisle"], ["notesInput", "notes"]]) {
    $(input).value = cycle.details?.[key] || "";
  }
  $("saveDetailsButton").textContent = pendingPackedDetails ? "Save and mark packed" : "Save details";
  $("detailsDialog").showModal();
}
function saveDetails(event) {
  event.preventDefault();
  const packed = pendingPackedDetails;
  const ok = recordAction({ type: "details", cageId: currentCageId, cycleId: editingCycleId,
    baseDetails: editingBaseDetails, markPacked: packed,
    details: { department: $("departmentInput").value, packer: $("packerInput").value.trim(),
      aisle: $("aisleInput").value.trim(), notes: $("notesInput").value.trim() }
  }, packed ? "Details and packing recorded" : "Details recorded");
  if (ok) { pendingPackedDetails = false; $("detailsDialog").close(); }
}
function addAttention(reason) {
  const cycle = getOpenCycle(currentCageId);
  if (!cycle) return;
  recordAction({ type: "attention", cageId: currentCageId, cycleId: cycle.id, reason }, "Support request recorded");
}
function resolveAttention(issueId) {
  const issue = data.events.find(event => event.id === issueId);
  if (!issue) return;
  recordAction({ type: "resolve_attention", cageId: issue.cageId, cycleId: issue.cycleId, issueId }, "Support request resolved");
  renderHistory();
}

function renderHistory() {
  const target = $("historyEvents");
  target.replaceChildren();
  const labels = { first_scan: "Cycle started", packed: "Packed", worked: "Being worked", empty: "Empty",
    extended: "Cycle extended", new_load_detected: "New load", details_updated: "Details updated",
    needs_attention: "Support requested", attention_resolved: "Support resolved" };
  const issues = new Set(FlowState.openIssues(data).map(event => event.id));
  const events = data.events.filter(event => event.cageId === currentCageId).sort((a,b) => b.timestamp - a.timestamp);
  $("historyTitle").textContent = `Cage ${currentCageId?.replace("RC-", "")} history`;
  for (const event of events) {
    const row = document.createElement("div");
    row.className = "history-row";
    const title = document.createElement("strong");
    title.textContent = labels[event.type] || "Cage updated";
    const detail = document.createElement("small");
    detail.textContent = `${formatClock(event.timestamp)}${event.details?.reason ? ` · ${event.details.reason}` : ""}`;
    row.append(title, detail);
    if (event.type === "details_updated") {
      const note = document.createElement("p");
      note.textContent = [event.details?.department, destinationLabel(event.details), event.details?.notes].filter(Boolean).join(" · ");
      row.append(note);
    }
    if (issues.has(event.id)) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "secondary-button"; button.textContent = "Mark resolved";
      button.addEventListener("click", () => resolveAttention(event.id));
      row.append(button);
    }
    target.append(row);
  }
  if (!events.length) target.textContent = "No history recorded for this cage yet.";
}

// -----------------------------------------------------------------------------
// User feedback
// -----------------------------------------------------------------------------
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

// -----------------------------------------------------------------------------
// Event listeners
// -----------------------------------------------------------------------------
$("openCageButton").addEventListener("click", () => openCageFromInput($("cageInput").value));
$("cageInput").addEventListener("keydown", event => {
  if (event.key === "Enter") openCageFromInput(event.target.value);
});
$("backButton").addEventListener("click", () => showView("lookupView"));
$("dashboardButton").addEventListener("click", () => {
  renderDashboard(); showView("dashboardView");
  refreshSharedData();
});
$("dashboardBackButton").addEventListener("click", () => showView("lookupView"));
$("qrLabelsButton").addEventListener("click", () => {
  showView("qrLabelsView");
  renderQrLabels();
});
$("qrLabelsBackButton").addEventListener("click", () => showView("lookupView"));
$("generateQrLabelsButton").addEventListener("click", renderQrLabels);
$("printQrLabelsButton").addEventListener("click", downloadQrLabelsPdf);
let packedHoldTimer = null;
let packedLongPressTriggered = false;
const packedButton = $("packedButton");

function startPackedHold() {
  packedLongPressTriggered = false;
  packedButton.classList.add("holding");
  packedHoldTimer = setTimeout(() => {
    packedLongPressTriggered = true;
    packedButton.classList.remove("holding");
    if (navigator.vibrate) navigator.vibrate(25);
    openDetails({ markPacked: true });
  }, 550);
}

function cancelPackedHold() {
  clearTimeout(packedHoldTimer);
  packedButton.classList.remove("holding");
}

packedButton.addEventListener("pointerdown", startPackedHold);
packedButton.addEventListener("pointerup", cancelPackedHold);
packedButton.addEventListener("pointercancel", cancelPackedHold);
packedButton.addEventListener("pointerleave", cancelPackedHold);
packedButton.addEventListener("contextmenu", event => event.preventDefault());
packedButton.addEventListener("click", event => {
  if (packedLongPressTriggered) {
    event.preventDefault();
    packedLongPressTriggered = false;
    return;
  }
  act("packed", "Packing complete recorded");
});
$("workedButton").addEventListener("click", () => act("worked", "Being worked recorded"));
$("emptyButton").addEventListener("click", () => act("empty", "Cage cycle closed"));
$("extendButton").addEventListener("click", () => act("extended", "Cycle extended"));
$("recoveryEmptyButton").addEventListener("click", () => act("empty", "Cage cycle closed"));
$("newLoadButton").addEventListener("click", recoveryNewLoad);
$("attentionButton").addEventListener("click", () => $("attentionDialog").showModal());
$("recoveryAttentionButton").addEventListener("click", () => $("attentionDialog").showModal());
$("detailsButton").addEventListener("click", () => {
  renderHistory();
  $("historyDialog").showModal();
});
$("editDetailsButton").addEventListener("click", () => openDetails());
$("closeHistoryButton").addEventListener("click", () => $("historyDialog").close());
$("retrySyncButton").addEventListener("click", () => sync.synchronize());
$("discardPendingButton").addEventListener("click", () => sync.discardRejected());
$("saveDetailsButton").addEventListener("click", saveDetails);
$("attentionDialog").addEventListener("close", () => {
  if ($("attentionDialog").returnValue && $("attentionDialog").returnValue !== "cancel") addAttention($("attentionDialog").returnValue);
});
document.querySelectorAll("[data-detail]").forEach(button => button.addEventListener("click",
() => showPanelDetail(button.dataset.detail)));
$("closePanelDetail").addEventListener("click", () => $("panelDetailDialog").close());
window.addEventListener("focus", async () => {
  if (!hasLoadedSharedData) return;
  const refreshed = await refreshSharedData({ quiet: true });
  if (refreshed) {
    renderRecent();
    if (currentCageId && $("cageView").classList.contains("active")) renderCage();
  }
});
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !hasLoadedSharedData) return;
  const refreshed = await refreshSharedData({ quiet: true });
  if (refreshed) {
    renderRecent();
    if (currentCageId && $("cageView").classList.contains("active")) renderCage();
  }
});
window.addEventListener("resize", () => {
  if ($("dashboardView").classList.contains("active")) renderDashboard();
});
setInterval(() => {
  if (document.visibilityState === "visible" && !$("detailsDialog").open) refreshSharedData();
}, 30000);
window.addEventListener("online", () => sync.synchronize());

// -----------------------------------------------------------------------------
// Application startup
// -----------------------------------------------------------------------------
const startupParams = new URLSearchParams(location.search);
const cageFromUrl = startupParams.get("cage");

async function startFlow() {
  applyBranding();
  renderRecent();

  await loadSharedData();
  renderRecent();

  if (cageFromUrl) {
    openCageFromDeepLink(cageFromUrl);
  }
}

startFlow();
