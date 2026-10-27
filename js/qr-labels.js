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

function selectedQrLabels() {
  const start = normaliseStartingCage($("qrStartInput").value);
  const count = Number($("qrCountInput").value);
  const error = $("qrLabelsError");

  if (start === null || start < 1 || start > 999) {
    error.textContent = "Enter a starting cage between 001 and 999.";
    return null;
  }

  if (!Number.isInteger(count) || count < 1 || count > 100 || start + count - 1 > 999) {
    error.textContent = "Enter 1 to 100 labels, ending at cage 999 or earlier.";
    return null;
  }

  if (typeof qrcode !== "function") {
    error.textContent = "QR codes could not load. Check your connection and reload.";
    return null;
  }

  error.textContent = "";
  return Array.from({ length: count }, (_, index) => {
    const cageId = cageLabelId(start + index);
    return { cageId, url: cageDeepLink(cageId) };
  });
}

function renderQrLabels() {
  const labels = selectedQrLabels();
  const output = $("qrLabelsGrid");

  if (!labels) {
    output.innerHTML = "";
    return;
  }

  output.innerHTML = labels.map(({ cageId, url }) => {
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

function downloadQrLabelsPdf() {
  const labels = selectedQrLabels();
  if (!labels) return;

  try {
    const pdf = FlowLabelPdf.create(labels);
    const objectUrl = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `Flow-labels-${labels[0].cageId}-${labels[labels.length - 1].cageId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    toast("PDF ready - print at Actual size / 100%");
  } catch (error) {
    console.error("Label PDF failed", error);
    $("qrLabelsError").textContent = "The PDF could not be created. Please try again.";
  }
}
