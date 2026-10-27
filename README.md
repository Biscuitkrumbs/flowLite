# Flow

A phone-first roll cage workflow app. Scan a permanent cage label, tap a status, and leave optional details for the next person.

## Run
Serve the folder with GitHub Pages or a local static server. The shared app uses the configured Apps Script API v2. See `RELIABILITY-UPDATE.md` before changing the backend.

Use `?demo=1` for a clearly labelled demonstration on one device. Demo records use separate local storage and never contact the shared API. A new shared installation starts empty, without example records.

## Instrument panel
Use the four-square button in the top-right corner. The panel is designed so the important operational state is visible without scrolling. Click any instrument for the detailed layer.

Shared actions are committed to an append-only spreadsheet journal. Pending actions are retained on the phone and retried by ID, avoiding duplicate writes after a lost response. **Do not clear browser storage while changes are pending.**

History shows recorded cage events and supports resolving open support requests. Edit details is separate. Label PDFs use Avery AU L7109 sheets; see `PDF-PRINTING.md`.
