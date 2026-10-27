// Generated from js/flow-state.js and google-apps-script/server.js.
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

// Build Code.gs with scripts/build-server.cjs. Do not paste this file alone.
const FLOW_API_VERSION = 2;
const FLOW_JOURNAL = "FlowJournalV2";

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function withFlowLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return callback(); }
  finally { lock.releaseLock(); }
}

function getJournal_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(FLOW_JOURNAL);
  if (sheet && sheet.getLastRow() > 0) return sheet;
  if (!sheet) sheet = book.insertSheet(FLOW_JOURNAL);
  // Import once. Never clear or edit the original FlowData tab.
  const rows = [["Action ID", "Recorded at", "JSON"]];
  const legacy = book.getSheetByName("FlowData");
  if (legacy && legacy.getLastRow() >= 2) {
    const values = legacy.getRange(2, 1, legacy.getLastRow() - 1, 3).getValues();
    const saved = values.find(row => row[0] === "shared_state");
    if (saved && saved[2]) {
      const data = JSON.parse(saved[2]);
      if (!data || !["cages", "cycles", "events"].every(key => Array.isArray(data[key]))) throw new Error("Existing Flow data needs checking. Nothing has been replaced.");
      for (const key of ["cages", "cycles", "events"]) {
        data[key].forEach((record, index) => {
          const entry = { id: `import-${key}-${index}`, patch: { [key]: [record] }, aliases: {} };
          rows.push([entry.id, new Date(), JSON.stringify(entry)]);
        });
      }
    }
  }
  if (sheet.getMaxRows() < rows.length) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length - sheet.getMaxRows());
  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  sheet.setFrozenRows(1);
  return sheet;
}

function readJournal_(sheet) {
  const state = FlowState.empty();
  const receipts = new Map();
  const count = sheet.getLastRow() - 1;
  if (count > 0) sheet.getRange(2, 3, count, 1).getValues().forEach(row => {
    const receipt = JSON.parse(row[0]);
    FlowState.applyPatch(state, receipt.patch || {});
    receipts.set(receipt.id, receipt);
  });
  return { state, receipts, revision: count };
}

function flowSnapshot_() {
  return withFlowLock_(() => {
    const snapshot = readJournal_(getJournal_());
    return { ok: true, apiVersion: FLOW_API_VERSION, data: snapshot.state, revision: snapshot.revision };
  });
}

function doGet(e) {
  try {
    if (e?.parameter?.action === "getData") return jsonResponse_(flowSnapshot_());
    return jsonResponse_({ ok: true, service: "Flow Lite", apiVersion: FLOW_API_VERSION });
  } catch (error) { return jsonResponse_({ ok: false, error: String(error.message || error) }); }
}

function doPost(e) {
  try {
    const text = e?.postData?.contents || "{}";
    if (text.length > 12000) throw new Error("This request is too large.");
    const request = JSON.parse(text);
    if (request.action === "getData") return jsonResponse_(flowSnapshot_());
    if (request.action !== "applyAction") return jsonResponse_({ ok: false, code: "UPGRADE_REQUIRED", error: "Reload Flow to use the latest safe shared saving." });
    return jsonResponse_(withFlowLock_(() => {
      const sheet = getJournal_();
      const snapshot = readJournal_(sheet);
      const op = request.operation;
      if (!op || typeof op.id !== "string") throw new Error("Invalid action.");
      let receipt = snapshot.receipts.get(op.id);
      if (!receipt) {
        const timestamp = Date.now();
        const result = FlowState.transition(snapshot.state, op, timestamp);
        receipt = { id: op.id, patch: result.patch, aliases: result.aliases, timestamp };
        // One append is the commit. A retry finds the existing action ID.
        sheet.appendRow([op.id, new Date(timestamp), JSON.stringify(receipt)]);
        FlowState.applyPatch(snapshot.state, receipt.patch);
        snapshot.revision++;
      }
      return { ok: true, apiVersion: FLOW_API_VERSION, actionId: op.id, aliases: receipt.aliases, data: snapshot.state, revision: snapshot.revision };
    }));
  } catch (error) { return jsonResponse_({ ok: false, code: error.code || "SERVER_UNAVAILABLE", error: String(error.message || error) }); }
}

function setupFlowSheet() {
  return withFlowLock_(() => {
    getJournal_();
    return "Flow journal is ready. Existing data has been preserved.";
  });
}
