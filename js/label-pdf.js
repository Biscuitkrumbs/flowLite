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
        const x = labelLeft + (index % 3) * columnPitch;
        const top = labelTop + Math.floor(index / 3) * rowPitch;
        const code = qrcode(0, "M");
        code.addData(label.url);
        code.make();

        const count = code.getModuleCount();
        const size = 32 * mm;
        const unit = size / (count + 8);
        const qrX = x + 2 * mm + 4 * unit;
        const qrTop = top + 5 * mm + 4 * unit;

        // A four-module clear margin surrounds every QR code.
        for (let row = 0; row < count; row++) {
          for (let col = 0; col < count; col++) {
            if (code.isDark(row, col)) {
              commands.push(`${number(qrX + col * unit)} ${number(pageHeight - qrTop - (row + 1) * unit)} ${number(unit)} ${number(unit)} re f`);
            }
          }
        }

        const text = (value, font, sizePt, offsetX, baseline) => {
          commands.push(`BT /${font} ${sizePt} Tf ${number(x + offsetX * mm)} ${number(pageHeight - top - baseline * mm)} Td (${value}) Tj ET`);
        };

        text("FLOW", "F1", 9, 37, 11);
        text("CAGE", "F2", 7, 37, 17);
        text(label.cageId.slice(3), "F1", 29, 36, 28);
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
