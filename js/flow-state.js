// Shared workflow rules. The browser previews actions; Apps Script validates them again.
const FlowState = {
  empty() {
    return { cages: [], cycles: [], events: [] };
  },

  applyPatch(state, patch) {
    for (const key of ["cages", "cycles", "events"]) {
      for (const record of patch[key] || []) {
        const index = state[key].findIndex(item => item.id === record.id);
        if (index < 0) state[key].push(record);
        else state[key][index] = record;
      }
    }
    return state;
  },

  transition(state, operation, timestamp) {
    const fail = message => { throw Object.assign(new Error(message), { code: "ACTION_REJECTED" }); };
    const op = operation || {};
    if (!/^[a-zA-Z0-9-]{8,100}$/.test(String(op.id || ""))) fail("Invalid action ID.");
    if (!/^RC-(?!000)\d{3}$/.test(String(op.cageId || ""))) fail("Enter a cage number from 001 to 999.");
    if (!Number.isFinite(timestamp)) fail("Invalid action time.");
    const patch = this.empty();
    const cage = state.cages.find(item => item.id === op.cageId && item.active !== false);
    let cycle = [...state.cycles].reverse().find(item => item.cageId === op.cageId && !item.closedAt);
    const result = { patch, aliases: {} };
    let eventIndex = 0;
    const event = (type, details = {}, target = cycle) => {
      patch.events.push({ id: `${op.id}-${eventIndex++}`, operationId: op.id,
        cycleId: target.id, cageId: op.cageId, timestamp, type, details });
    };
    const newCycle = () => {
      if (!/^[a-zA-Z0-9-]{8,100}$/.test(String(op.newCycleId || ""))) fail("Invalid cycle ID.");
      if (state.cycles.some(item => item.id === op.newCycleId)) fail("Cycle ID already exists. Reopen the cage.");
      return { id: op.newCycleId, cageId: op.cageId, openedAt: timestamp, closedAt: null, details: {} };
    };

    if (op.type === "open") {
      if (!["manual", "qr", "label"].includes(op.source)) fail("Invalid cage opening method.");
      if (op.source === "qr" && op.payload !== `FLOW|CAGE|${op.cageId.slice(3)}|V1`) fail("This is not a valid Flow cage code.");
      if (!cage) {
        if (op.source === "manual") fail("Cage not registered. Scan its label first.");
        if (state.cages.some(item => item.id === op.cageId)) fail("This cage is inactive.");
        patch.cages.push({ id: op.cageId, active: true });
      }
      if (cycle) {
        result.aliases[op.newCycleId] = cycle.id;
      } else {
        cycle = newCycle();
        patch.cycles.push(cycle);
        event("first_scan");
      }
      return result;
    }

    if (!cage || !cycle) fail("This cage cycle has closed. Reopen the cage to check its status.");
    if (op.cycleId !== cycle.id) fail("Another phone started a new load. Reopen the cage before updating it.");
    cycle = JSON.parse(JSON.stringify(cycle));

    if (op.type === "details") {
      const values = op.details || {};
      const allowedDepartments = ["", "Hardware", "Tools", "Plumbing", "Paint", "Garden", "Timber", "Other"];
      if (!allowedDepartments.includes(values.department || "")) fail("Choose a valid department.");
      const clean = {};
      for (const [key, limit] of [["department", 40], ["packer", 80], ["aisle", 80], ["notes", 1000]]) {
        if (typeof (values[key] || "") !== "string" || String(values[key] || "").length > limit) fail("One of the details is too long.");
        clean[key] = String(values[key] || "").trim();
      }
      for (const key of Object.keys(clean)) {
        const base = String((op.baseDetails || {})[key] || "");
        const current = String((cycle.details || {})[key] || "");
        if (clean[key] !== base && current !== base && current !== clean[key]) fail("These details changed on another phone. Review the latest details before saving.");
      }
      cycle.details = { ...(cycle.details || {}) };
      for (const key of Object.keys(clean)) {
        if (clean[key] !== String((op.baseDetails || {})[key] || "")) cycle.details[key] = clean[key];
      }
      event("details_updated", cycle.details);
      if (op.markPacked && !cycle.packedAt) {
        if (cycle.workedAt) fail("Work has already started on this cage.");
        cycle.packedAt = timestamp;
        event("packed");
      }
    } else if (op.type === "packed") {
      if (cycle.workedAt) fail("Work has already started on this cage.");
      if (cycle.packedAt) return result;
      cycle.packedAt = timestamp;
      event("packed");
    } else if (op.type === "worked") {
      if (cycle.workedAt) return result;
      cycle.workedAt = timestamp;
      event("worked");
    } else if (op.type === "empty" || op.type === "new_load") {
      cycle.closedAt = timestamp;
      event(op.type === "empty" ? "empty" : "new_load_detected");
      if (op.type === "new_load") {
        cycle.closeReason = "new_load";
        const next = newCycle();
        patch.cycles.push(next);
        event("first_scan", {}, next);
      }
    } else if (op.type === "attention") {
      const reasons = ["Packaging", "Mixed aisles", "Overstock", "Wrong location", "Damaged stock", "Other"];
      if (!reasons.includes(op.reason)) fail("Choose a valid support reason.");
      event("needs_attention", { reason: op.reason });
    } else if (op.type === "resolve_attention") {
      const issue = state.events.find(item => item.id === op.issueId && item.cycleId === cycle.id && item.type === "needs_attention");
      if (!issue) fail("This support request could not be found.");
      if (state.events.some(item => item.type === "attention_resolved" && item.details?.issueId === op.issueId)) return result;
      event("attention_resolved", { issueId: op.issueId });
    } else if (op.type === "extended") {
      event("extended");
    } else {
      fail("This action is not supported. Reload Flow.");
    }

    patch.cycles.push(cycle);
    return result;
  },

  openIssues(state) {
    const activeCycles = new Set(state.cycles.filter(cycle => !cycle.closedAt).map(cycle => cycle.id));
    const resolved = new Set(state.events.filter(event => event.type === "attention_resolved").map(event => event.details?.issueId));
    return state.events.filter(event => event.type === "needs_attention" && activeCycles.has(event.cycleId) && !resolved.has(event.id));
  }
};
