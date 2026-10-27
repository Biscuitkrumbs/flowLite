// Avery AU L7109 geometry from the official Word template (twips).
// Vector QR modules and standard PDF fonts keep printing sharp and need no PDF library.
const FlowLabelPdf = {
  create(labels) {
    if (!Array.isArray(labels) || labels.length < 1 || labels.length > 100) {
      throw new Error("Choose 1 to 100 cage labels.");
    }

    const mm = 72 / 25.4;
    const pageWidth = 210 * mm;
    const pageHeight = 297 * mm;
    const labelLeft = (522 - 115) / 20;
    const labelTop = 566 / 20;
    const columnPitch = (3514 + 283) / 20;
    const rowPitch = (2381 + 283) / 20;
    const objects = ["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
    const pageIds = [];
    const number = value => value.toFixed(4);

    for (let first = 0; first < labels.length; first += 18) {
      const commands = ["0 g"];

      labels.slice(first, first + 18).forEach((label, index) => {
        if (!/^RC-\d{3}$/.test(label.cageId)) throw new Error("Invalid cage ID.");
        const labelX = labelLeft + (index % 3) * columnPitch;
        const labelY = pageHeight - labelTop - Math.floor(index / 3) * rowPitch;
        // Original portrait composition, rotated clockwise into a 62 x 42 mm label.
        commands.push(`q 0 -1 1 0 ${number(labelX)} ${number(labelY)} cm`);
        const code = qrcode(0, "M");
        code.addData(label.url);
        code.make();

        const count = code.getModuleCount();
        const size = 32 * mm;
        const unit = size / (count + 8);
        const qrX = (42 * mm - size) / 2 + 4 * unit;
        const qrTop = 51 * mm - 4 * unit;

        // A four-module clear margin surrounds every QR code.
        for (let row = 0; row < count; row++) {
          for (let col = 0; col < count; col++) {
            if (code.isDark(row, col)) {
              commands.push(`${number(qrX + col * unit)} ${number(qrTop - (row + 1) * unit)} ${number(unit)} ${number(unit)} re f`);
            }
          }
        }

        const text = (value, font, sizePt, offsetX, baseline) => {
          commands.push(`BT /${font} ${sizePt} Tf ${number(offsetX * mm)} ${number((62 - baseline) * mm)} Td (${value}) Tj ET`);
        };

        // Match the on-screen preview: brand, centred QR, modest ID, asset type.
        // Standard Helvetica widths in em keep each fixed-format line centred.
        const headerWidth = 2.944 * 7.5 + 3 + 1.612 * 5.5;
        const headerX = (42 * mm - headerWidth) / 2;
        text("FLOW", "F1", 7.5, headerX / mm, 7);
        text("Lite", "F2", 5.5, (headerX + 2.944 * 7.5 + 3) / mm, 7);
        text(label.cageId, "F1", 13, (42 * mm - 3.445 * 13) / (2 * mm), 49);
        text("ROLL CAGE", "F2", 6, (42 * mm - 5.502 * 6) / (2 * mm), 54);
        commands.push("Q");
      });

      const stream = commands.join("\n") + "\n";
      const streamId = objects.length + 1;
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
      const pageId = objects.length + 1;
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(pageWidth)} ${number(pageHeight)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
      pageIds.push(pageId);
    }

    objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] >>`;
    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return new TextEncoder().encode(pdf);
  }
};
