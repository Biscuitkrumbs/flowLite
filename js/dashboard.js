// -----------------------------------------------------------------------------
// Dashboard calculations and rendering
// -----------------------------------------------------------------------------
function dashboardMetrics() {
  const now = Date.now(), today = dayStart(), tomorrow = dayStart(1), yesterday = dayStart( - 1);
  const open = data.cycles.filter(c => ! c.closedAt);
  const openedToday = data.cycles.filter(c => c.openedAt >= today && c.openedAt < tomorrow);
  const completedToday = data.cycles.filter(c => c.closedAt >= today && c.closedAt < tomorrow);
  const completedYesterday = data.cycles.filter(c => c.closedAt >= yesterday && c.closedAt < today);
  const attention = data.events.filter(e => e.type === "needs_attention" && e.timestamp >= today && e.timestamp < tomorrow);
  const over24 = open.filter(c => now - lastActivity(c) >= STALE_MS);
  const averageMs = completedToday.length ? completedToday.reduce((sum, c) => sum + (c.closedAt - c.openedAt),
  0) / completedToday.length: 0;
  const sevenDay = data.cycles.filter(c => c.closedAt >= dayStart( - 6) && c.closedAt < tomorrow);
  const sevenAverage = sevenDay.length ? sevenDay.reduce((sum, c) => sum + (c.closedAt - c.openedAt),
  0) / sevenDay.length: 0;
  const friction = attention.reduce((map, e) => {
    const reason = e.details?.reason || "Other"; map[reason] = (map[reason] || 0) + 1; return map;
  }, {});
  const hours = Array.from( {
    length: Math.max(8,
    new Date().getHours() + 1)
  }, () => 0);
  completedToday.forEach(c => {
    const hour = new Date(c.closedAt).getHours(); if (hour < hours.length) hours[hour] += 1;
  });
  return {
    now,
    open,
    openedToday,
    completedToday,
    completedYesterday,
    attention,
    over24,
    averageMs,
    sevenAverage,
    friction,
    hours
  };
}
function calculateFlowPulse(metrics, status) {
  const activePenalty = Math.min(18, Math.max(0, metrics.open.length - 8) * 2);
  const overduePenalty = Math.min(30, metrics.over24.length * 10);
  const attentionPenalty = Math.min(18, metrics.attention.length * 3);
  const cyclePenalty = metrics.averageMs
    ? Math.min(18, Math.max(0, Math.round(metrics.averageMs / 60000) - 45) * 0.6)
    : 0;
  const statusPenalty = status === "Congested" ? 8 : status === "Building" ? 3 : 0;

  return Math.max(42, Math.round(100 - activePenalty - overduePenalty - attentionPenalty - cyclePenalty - statusPenalty));
}

function getTodaysStory(metrics, status) {
  if (metrics.over24.length) {
    const oldest = [...metrics.over24].sort((a, b) => a.openedAt - b.openedAt)[0];
    return `${oldest.cageId} is the oldest active cage and needs a status check.`;
  }

  const friction = Object.entries(metrics.friction).sort((a, b) => b[1] - a[1]);
  if (friction.length) {
    return `${friction[0][0]} is today’s most recorded friction point.`;
  }

  if (metrics.completedToday.length >= 8) {
    return `${metrics.completedToday.length} cages have completed a full cycle today.`;
  }

  if (status === "Flowing" && metrics.open.length) {
    return `All ${metrics.open.length} active cages are currently within the 24-hour window.`;
  }

  return "The operation is quiet enough to establish a clean starting baseline.";
}

function setStatusTone(status) {
  const el = $("flowStatus");
  const colour = status === "Congested" ? "var(--danger)": status === "Building" ? "var(--watch)": "var(--success)";
  el.style.color = colour;
}
function renderFlowDots(open) {
  const lane = $("flowLane");
  const sorted = [...open].sort((a, b) => a.openedAt - b.openedAt).slice(0, 12);
  lane.innerHTML = sorted.map((cycle, index) => {
    const age = Math.min(1,
    (Date.now() - cycle.openedAt) / STALE_MS); const progress = Math.max(7,
    Math.min(88,
    12 + (1 - age) * 65 + (index % 3) * 4)); return `<span class="flow-dot" style="left:${progress}%;animation-delay:${index * 0.035}s"></span>`;
  }).join("");
}
function renderBlocks(count, status) {
  const total = 25;
  $("cageBlocks").innerHTML = Array.from( {
    length: total
  }, (_, i) => `<span class="cage-block ${i<Math.min(count,total)?(status==="Flowing"?"filled":"filled watch"):""}"></span>`).join("");
}
function renderAgeDots(open) {
  $("ageDots").innerHTML = [...open].sort((a, b) => a.openedAt - b.openedAt).slice(0, 18).map(c => {
    const age = Date.now() - c.openedAt; return `<span class="age-dot ${age>=STALE_MS?"old":age>=6*60*60*1000?"mid":""}"></span>`;
  }).join("");
}
function renderFriction(friction) {
  const entries = Object.entries(friction).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = Math.max(1, ...entries.map(e => e[1]));
  $("frictionBars").innerHTML = entries.length ? entries.map(([name, count]) => `<div class="friction-row"><span>${name}</span><div class="friction-track"><div class="friction-fill" style="width:${(count/max)*100}%"></div></div><span class="friction-count">${count}</span></div>`).join(""): '<div class="detail-empty">No friction recorded today</div>';
}
function renderActivity(hours) {
  const visible = hours.slice(Math.max(0, hours.length - 12));
  const max = Math.max(1, ...visible);
  $("activityBars").innerHTML = visible.map((count, i) => `<span class="activity-bar" title="${count} completed" style="height:${Math.max(8,(count/max)*100)}%;animation-delay:${i * 0.025}s"></span>`).join("");
}
function renderDashboard() {
  const m = dashboardMetrics();
  const backlog = m.openedToday.length - m.completedToday.length;
  const status = m.over24.length >= 3 || backlog >= 8 ? "Congested": m.over24.length > 0 || backlog >= 4 ||
  m.attention.length >= 5 ? "Building": "Flowing";
  const summary = status === "Congested"
    ? "Work is backing up and needs attention."
    : status === "Building"
      ? "Workload is beginning to accumulate."
      : "Work is moving normally.";
  const pulse = calculateFlowPulse(m, status);

  $("flowStatus").textContent = status;
  $("flowSummary").textContent = summary;
  $("flowPulse").textContent = pulse;
  $("pulseChange").textContent = pulse >= 90 ? "Strong" : pulse >= 75 ? "Steady" : "Watch";
  $("todaysStory").textContent = getTodaysStory(m, status);
  setStatusTone(status);
  $("activeCount").textContent = m.open.length;
  $("workloadNumber").textContent = m.open.length;
  $("openedToday").textContent = m.openedToday.length;
  $("completedToday").textContent = m.completedToday.length;
  $("workloadLabel").textContent = status === "Flowing" ? "Normal": status === "Building" ? "Watch": "High";
  $("over24Count").textContent = m.over24.length;
  $("attentionCount").textContent = m.attention.length;
  $("attentionBadge").textContent = m.over24.length || m.attention.length ? "Review": "Clear";
  $("attentionBadge").style.background = m.over24.length || m.attention.length ? "#fff1e2": "#eaf5ed";
  $("attentionBadge").style.color = m.over24.length || m.attention.length ? "var(--watch)": "var(--success)";
  const avgMinutes = m.averageMs ? Math.round(m.averageMs / 60000): 0;
  $("averageCycle").textContent = avgMinutes || "—";
  $("cycleUnit").textContent = avgMinutes ? "min": "no data";
  const ringProgress = avgMinutes ? Math.min(1, avgMinutes / 90): 0;
  $("cycleRing").style.strokeDashoffset = 301.6 * (1 - ringProgress);
  $("cycleRing").style.stroke = avgMinutes > 75 ? "var(--danger)": avgMinutes > 60 ? "var(--watch)": "var(--success)";
  if (m.sevenAverage && m.averageMs) {
    const diff = Math.round(((m.averageMs - m.sevenAverage) / m.sevenAverage) * 100);
    $("cycleComparison").textContent = diff === 0 ? "On average": `${Math.abs(diff)}% ${diff<0?"faster":"slower"}`;
  } else $("cycleComparison").textContent = "Today";
  const yesterdayDiff = m.completedToday.length - m.completedYesterday.length;
  $("movementComparison").textContent = yesterdayDiff === 0 ? "Same as yesterday": `${yesterdayDiff>0?"+":""}${yesterdayDiff} vs yesterday`;
  $("frictionTotal").textContent = `${m.attention.length} event${m.attention.length===1?"":"s"}`;
  $("statusComparison").textContent = backlog > 0 ? `WIP +${backlog}`: backlog < 0 ? `WIP ${backlog}`: "Balanced";
  renderFlowDots(m.open);
  renderBlocks(m.open.length, status);
  renderAgeDots(m.open);
  renderFriction(m.friction);
  renderActivity(m.hours);
}

// -----------------------------------------------------------------------------
// Dashboard detail dialog
// -----------------------------------------------------------------------------
function detailRow(cycle, button = true) {
  const status = cycle.workedAt
    ? "Being worked"
    : cycle.packedAt
      ? "Packed"
      : "First seen";
  const age = formatDuration(Date.now() - cycle.openedAt);
  const department = cycle.details?.department
    ? ` · ${cycle.details.department}`
    : "";
  const openButton = button
    ? `<button data-detail-open="${cycle.cageId}">Open</button>`
    : "";

  return `<div class="detail-row">
    <div>
      <strong>${cycle.cageId}</strong>
      <small>${status} · ${age}${department}</small>
    </div>
    ${openButton}
  </div>`;
}

function showPanelDetail(type) {
  const m = dashboardMetrics();
  let title = "", summary = "", content = "";
  if (type === "status") {
    title = "Flow status";
    summary = "The balance between work opened, completed and currently active.";
    content = `<div class="detail-row"><div><strong>${m.openedToday.length} opened today</strong><small>New cage cycles recorded</small></div></div><div class="detail-row"><div><strong>${m.completedToday.length} completed today</strong><small>${m.openedToday.length-m.completedToday.length>=0?"Work still accumulating":"More completed than opened"}</small></div></div><div class="detail-row"><div><strong>${m.open.length} active now</strong><small>${m.over24.length} require a status check</small></div></div>`;
  }
  if (type === "active") {
    title = "Active cages";
    summary = "Oldest cages appear first so a leader can decide where to look.";
    content = [...m.open].sort((a, b) => a.openedAt - b.openedAt).map(c => detailRow(c)).join("") || '<div class="detail-empty">No active cages</div>';
  }
  if (type === "cycle") {
    title = "Cycle time";
    summary = "Completed cage cycles from today, longest first.";
    content = [...m.completedToday].sort((a, b) => (b.closedAt - b.openedAt) - (a.closedAt - a.openedAt)).map(c => `<div class="detail-row"><div><strong>${c.cageId}</strong><small>${formatClock(c.closedAt)} completed</small></div><strong>${formatDuration(c.closedAt-c.openedAt)}</strong></div>`).join("") ||
    '<div class="detail-empty">No completed cycles today</div>';
  }
  if (type === "attention") {
    title = "Attention required";
    summary = "Cages over 24 hours and issues recorded today.";
    const old = m.over24.map(c => detailRow(c)).join("");
    const issues = m.attention.map(e => `<div class="detail-row"><div><strong>${e.cageId} · ${e.details?.reason||"Other"}</strong><small>${formatClock(e.timestamp)}</small></div><button data-detail-open="${e.cageId}">Open</button></div>`).join("");
    content = old + issues || '<div class="detail-empty">Nothing currently requires attention</div>';
  }
  if (type === "friction") {
    title = "Friction points";
    summary = "Observed issues only. Flow does not assume the cause.";
    content = Object.entries(m.friction).sort((a, b) => b[1] - a[1]).map(([reason, count]) => `<div class="detail-row"><div><strong>${reason}</strong><small>Recorded today</small></div><strong>${count}</strong></div>`).join("") ||
    '<div class="detail-empty">No friction recorded today</div>';
  }
  if (type === "activity") {
    title = "Movement today";
    summary = "Completed cage cycles by hour.";
    content = m.hours.map((count, hour) => count ? `<div class="detail-row"><div><strong>${String(hour).padStart(2,"0")}:00–${String(hour+1).padStart(2,"0")}:00</strong><small>Completed cage cycles</small></div><strong>${count}</strong></div>`: "").join("") ||
    '<div class="detail-empty">No completed cycles today</div>';
  }
  $("detailTitle").textContent = title;
  $("detailSummary").textContent = summary;
  $("detailContent").innerHTML = content;
  $("panelDetailDialog").showModal();
  document.querySelectorAll("[data-detail-open]").forEach(btn => btn.addEventListener("click",
  () => {
    $("panelDetailDialog").close(); openKnownCage(btn.dataset.detailOpen);
  }));
}

