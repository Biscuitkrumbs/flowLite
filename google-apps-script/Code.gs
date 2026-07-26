const FLOW_SHEET_NAME = "FlowData";
const FLOW_DATA_KEY = "shared_state";

function doGet() {
  return jsonResponse_({
    ok: true,
    service: "Flow Lite",
    message: "Flow API is running"
  });
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (request.action === "getData") {
      return jsonResponse_({ ok: true, data: readFlowData_() });
    }

    if (request.action === "saveData") {
      validateFlowData_(request.data);
      const saved = writeFlowData_(request.data);
      return jsonResponse_({ ok: true, data: saved });
    }

    return jsonResponse_({ ok: false, error: "Unknown action." });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error.message || error) });
  }
}

function setupFlowSheet() {
  const sheet = getFlowSheet_();
  sheet.clear();
  sheet.getRange(1, 1, 1, 3).setValues([["Key", "Updated At", "JSON Data"]]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
  return "FlowData sheet is ready.";
}

function getFlowSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(FLOW_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(FLOW_SHEET_NAME);
    sheet.getRange(1, 1, 1, 3).setValues([["Key", "Updated At", "JSON Data"]]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function readFlowData_() {
  const sheet = getFlowSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const row = rows.find(values => values[0] === FLOW_DATA_KEY);
  if (!row || !row[2]) return null;

  return JSON.parse(row[2]);
}

function writeFlowData_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getFlowSheet_();
    const lastRow = sheet.getLastRow();
    let targetRow = 2;

    if (lastRow >= 2) {
      const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      const index = keys.indexOf(FLOW_DATA_KEY);
      targetRow = index >= 0 ? index + 2 : lastRow + 1;
    }

    const cleanData = sanitiseFlowData_(data);
    sheet.getRange(targetRow, 1, 1, 3).setValues([[
      FLOW_DATA_KEY,
      new Date(),
      JSON.stringify(cleanData)
    ]]);

    return cleanData;
  } finally {
    lock.releaseLock();
  }
}

function validateFlowData_(data) {
  if (!data || !Array.isArray(data.cages) || !Array.isArray(data.cycles) || !Array.isArray(data.events)) {
    throw new Error("Invalid Flow data shape.");
  }

  if (data.cages.length > 5000 || data.cycles.length > 50000 || data.events.length > 250000) {
    throw new Error("Flow data exceeds the allowed size.");
  }
}

function sanitiseFlowData_(data) {
  const copy = JSON.parse(JSON.stringify(data));

  copy.cages = copy.cages
    .filter(cage => /^RC-\d{3}$/.test(String(cage.id || "")))
    .map(cage => ({ id: cage.id, active: cage.active !== false }));

  const cageIds = new Set(copy.cages.map(cage => cage.id));

  copy.cycles = copy.cycles.filter(cycle =>
    cageIds.has(cycle.cageId)
    && typeof cycle.id === "string"
    && Number.isFinite(Number(cycle.openedAt))
  );

  const cycleIds = new Set(copy.cycles.map(cycle => cycle.id));

  copy.events = copy.events.filter(event =>
    cycleIds.has(event.cycleId)
    && cageIds.has(event.cageId)
    && typeof event.id === "string"
    && typeof event.type === "string"
    && Number.isFinite(Number(event.timestamp))
  );

  return copy;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
