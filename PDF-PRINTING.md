# PDF cage labels

1. Open the label generator using the QR-label button in the top bar.
2. Set Starting cage and Number of labels as before (1-100 labels, up to cage 999).
3. Generate labels to preview, or choose Download PDF to export the current selection directly.
4. Email or transfer the PDF to the work computer.
5. Print A4, portrait, single sided, Actual size / 100%. Disable Fit to page or scaling.
6. Test on plain paper and hold it against an Avery L7109 sheet before printing the labels.

Layout: Avery Australia L7109 / 980013, 62 x 42 mm, 3 columns x 6 rows. Geometry was taken from Avery's official Word template at https://www.averyproducts.com.au/word-template-l7109 .

The QR links use the deployed app's current origin and path. Export from the deployed Flow address for real labels; a localhost preview generates localhost links.

Label export does not create cage records. The existing first-scan registration behaviour is preserved. Existing labels continue to work.

The existing Apps Script does not need to be redeployed for this label-only change. Publish the static files together, including the new js/label-pdf.js and changed index.html, js/app.js and js/qr-labels.js.
