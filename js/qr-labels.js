const QR_LABEL_BASE_URL = `${location.origin}${location.pathname}`;

function normaliseStartingCage(value) {
  const match = String(value || "").trim().toUpperCase().match(/^(?:RC-)?(\d{1,3})$/);
  if (!match) return null;
  return Number(match[1]);
}

function cageLabelId(number) {
  return `RC-${String(number).padStart(3, "0")}`;
}

function cageDeepLink(cageId) {
  const url = new URL(QR_LABEL_BASE_URL);
  url.searchParams.set("cage", cageId);
  return url.toString();
}

function makeQrDataUrl(text) {
  if (typeof qrcode !== "function") return "";
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createDataURL(7, 4);
}

function renderQrLabels() {
  const start = normaliseStartingCage($("qrStartInput").value);
  const count = Math.max(1, Math.min(100, Number($("qrCountInput").value) || 1));
  const output = $("qrLabelsGrid");
  const error = $("qrLabelsError");

  if (start === null || start < 1 || start > 999 || start + count - 1 > 999) {
    error.textContent = "Enter a starting cage between RC-001 and RC-999.";
    output.innerHTML = "";
    return;
  }

  error.textContent = "";
  output.innerHTML = Array.from({ length: count }, (_, index) => {
    const cageId = cageLabelId(start + index);
    const url = cageDeepLink(cageId);
    const qrImage = makeQrDataUrl(url);

    return `
      <article class="qr-label" aria-label="QR label for ${cageId}">
        <div class="qr-label-brand">
          <strong>${CONFIG.brand.name}</strong>
          <span>${CONFIG.brand.edition}</span>
        </div>
        <div class="qr-image-wrap">
          ${qrImage
            ? `<img src="${qrImage}" alt="QR code opening ${cageId}">`
            : '<div class="qr-unavailable">QR library unavailable</div>'}
        </div>
        <div class="qr-cage-id">${cageId}</div>
        <div class="qr-label-type">ROLL CAGE</div>
      </article>`;
  }).join("");
}
