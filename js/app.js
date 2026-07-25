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
// Prototype data and LocalStorage
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
function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return makeSeedData();
}
let data = loadData();
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
function addEvent(cycle, type, details = {}) {
  data.events.push( {
    id: crypto.randomUUID(),
    cycleId: cycle.id,
    cageId: cycle.cageId,
    timestamp: Date.now(),
    type,
    details
  });
  saveData();
}
function openOrCreateCycle(cageId) {
  let cycle = getOpenCycle(cageId);
  if (! cycle) {
    cycle = {
      id: crypto.randomUUID(),
      cageId,
      openedAt: Date.now(),
      closedAt: null,
      details: {}
    };
    data.cycles.push(cycle);
    addEvent(cycle, "first_scan");
  }
  return cycle;
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
function dayStart(offset = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.getTime();
}

// -----------------------------------------------------------------------------
// Cage lookup and workflow
// -----------------------------------------------------------------------------
function rememberCage(cageId) {
  const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter(id => id !== cageId);
  recent.unshift(cageId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 6)));
  renderRecent();
}
function renderRecent() {
  const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
    .filter(cageExists);
  $("recentCages").innerHTML = recent.length
    ? recent.map(id => `<button class="chip" data-cage="${id}">${id.replace("RC-", "")}</button>`).join("")
    : '<span class="muted">No recent cages yet</span>';
  document.querySelectorAll("[data-cage]").forEach(button => button.addEventListener("click",
    () => openKnownCage(button.dataset.cage)));
}
function displayCage(cageId) {
  currentCageId = cageId;
  openOrCreateCycle(cageId);
  rememberCage(cageId);
  renderCage();
  showLookupError("");
  showView("cageView");
}

function openKnownCage(cageId) {
  if (!cageExists(cageId)) {
    showLookupError(CONFIG.messages.cageNotFound);
    return;
  }

  displayCage(cageId);
}

function normaliseTypedCageId(value) {
  const match = String(value || "").trim().toUpperCase().match(/^(?:RC-)?(\d{1,3})$/);
  if (!match) return null;
  return toInternalCageId(match[1].padStart(3, "0"));
}

function openCageFromDeepLink(payload) {
  const cageId = normaliseTypedCageId(payload);

  if (!cageId) {
    showLookupError(CONFIG.messages.invalidCageCode);
    return;
  }

  if (!cageExists(cageId)) {
    data.cages.push({ id: cageId, active: true });
    saveData();
  }

  displayCage(cageId);
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

  if (!cageExists(cageId)) {
    data.cages.push({
      id: cageId,
      active: true,
    });

    saveData();
  }

  $("cageInput").value = "";
  displayCage(cageId);
}


function showLookupError(message) {
  $("lookupError").textContent = message;
}
function renderCage() {
  const cycle = getOpenCycle(currentCageId);
  if (! cycle) return;
  const stale = Date.now() - lastActivity(cycle) >= STALE_MS;
  $("cageName").textContent = currentCageId;
  $("normalActions").classList.toggle("hidden", stale);
  $("recoveryActions").classList.toggle("hidden", ! stale);
  $("packedButton").classList.toggle("hidden", Boolean(cycle.packedAt));
  $("workedButton").classList.toggle("hidden", Boolean(cycle.workedAt));
  if (stale) {
    $("statusPill").textContent = "Check status";
    $("statusText").textContent = `Last updated ${formatClock(lastActivity(cycle))}`;
    $("cycleMeta").textContent = `${formatDuration(Date.now()-cycle.openedAt)} since first scan`;
  } else if (cycle.workedAt) {
    $("statusPill").textContent = "Being worked";
    $("statusText").textContent = `Work started ${formatDuration(Date.now()-cycle.workedAt)} ago`;
    $("cycleMeta").textContent = `First seen ${formatDuration(Date.now()-cycle.openedAt)} ago`;
  } else if (cycle.packedAt) {
    $("statusPill").textContent = "Packed";
    $("statusText").textContent = `Packing completed ${formatDuration(Date.now()-cycle.packedAt)} ago`;
    $("cycleMeta").textContent = `First seen ${formatDuration(Date.now()-cycle.openedAt)} ago`;
  } else {
    $("statusPill").textContent = "First seen";
    $("statusText").textContent = `First scanned ${formatDuration(Date.now()-cycle.openedAt)} ago`;
    $("cycleMeta").textContent = "Waiting is inferred until another event is recorded.";
  }
}
function act(type, message) {
  const cycle = getOpenCycle(currentCageId);
  if (! cycle) return;
  const now = Date.now();
  if (type === "packed") cycle.packedAt = now;
  if (type === "worked") cycle.workedAt = now;
  if (type === "empty") cycle.closedAt = now;
  addEvent(cycle, type);
  saveData();
  toast(message);
  if (type === "empty") {
    showView("lookupView");
    renderRecent();
  } else renderCage();
}
function recoveryNewLoad() {
  const current = getOpenCycle(currentCageId);
  current.closedAt = Date.now();
  current.closeReason = "new_load";
  addEvent(current, "new_load_detected");
  const next = {
    id: crypto.randomUUID(),
    cageId: currentCageId,
    openedAt: Date.now(),
    closedAt: null,
    details: {}
  };
  data.cycles.push(next);
  addEvent(next, "first_scan");
  saveData();
  toast("New load started");
  renderCage();
}
function openDetails() {
  const cycle = getOpenCycle(currentCageId);
  $("departmentInput").value = cycle.details?.department || "";
  $("packerInput").value = cycle.details?.packer || "";
  $("aisleInput").value = cycle.details?.aisle || "";
  $("notesInput").value = cycle.details?.notes || "";
  $("detailsDialog").showModal();
}
function saveDetails() {
  const cycle = getOpenCycle(currentCageId);
  cycle.details = {
    department: $("departmentInput").value,
    packer: $("packerInput").value.trim(),
    aisle: $("aisleInput").value.trim(),
    notes: $("notesInput").value.trim()
  };
  addEvent(cycle, "details_updated", cycle.details);
  saveData();
  toast("Details saved");
}
function addAttention(reason) {
  const cycle = getOpenCycle(currentCageId);
  addEvent(cycle, "needs_attention", {
    reason
  });
  toast(`Attention noted: ${reason}`);
  renderCage();
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
});
$("dashboardBackButton").addEventListener("click", () => showView("lookupView"));
$("qrLabelsButton").addEventListener("click", () => {
  showView("qrLabelsView");
  renderQrLabels();
});
$("qrLabelsBackButton").addEventListener("click", () => showView("lookupView"));
$("generateQrLabelsButton").addEventListener("click", renderQrLabels);
$("printQrLabelsButton").addEventListener("click", () => window.print());
$("packedButton").addEventListener("click", () => act("packed", "Packing complete recorded"));
$("workedButton").addEventListener("click", () => act("worked", "Being worked recorded"));
$("emptyButton").addEventListener("click", () => act("empty", "Cage cycle closed"));
$("extendButton").addEventListener("click", () => act("extended", "Cycle extended"));
$("recoveryEmptyButton").addEventListener("click", () => act("empty", "Cage cycle closed"));
$("newLoadButton").addEventListener("click", recoveryNewLoad);
$("attentionButton").addEventListener("click", () => $("attentionDialog").showModal());
$("recoveryAttentionButton").addEventListener("click", () => $("attentionDialog").showModal());
$("detailsButton").addEventListener("click", openDetails);
$("saveDetailsButton").addEventListener("click", saveDetails);
$("attentionDialog").addEventListener("close", () => {
  if ($("attentionDialog").returnValue && $("attentionDialog").returnValue !== "cancel") addAttention($("attentionDialog").returnValue);
});
document.querySelectorAll("[data-detail]").forEach(button => button.addEventListener("click",
() => showPanelDetail(button.dataset.detail)));
$("closePanelDetail").addEventListener("click", () => $("panelDetailDialog").close());
window.addEventListener("resize", () => {
  if ($("dashboardView").classList.contains("active")) renderDashboard();
});
setInterval(() => {
  if ($("dashboardView").classList.contains("active")) renderDashboard();
}, 60000);

// -----------------------------------------------------------------------------
// Application startup
// -----------------------------------------------------------------------------
const startupParams = new URLSearchParams(location.search);
const cageFromUrl = startupParams.get("cage");

applyBranding();
renderRecent();
saveData();

if (cageFromUrl) {
  openCageFromDeepLink(cageFromUrl);
}
