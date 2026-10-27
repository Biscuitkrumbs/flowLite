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
