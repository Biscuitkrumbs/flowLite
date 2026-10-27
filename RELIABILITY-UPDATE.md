# Reliability update - 28 October 2026

## Behaviour

- Each phone sends one identified cage action. Apps Script validates against current shared state while holding its script lock.
- Each accepted action appends one journal row. A retry uses the same action ID and returns the existing receipt; it does not repeat the event.
- Phones store pending actions before showing them as recorded. Failed connections retain the queue. Retry, online events, foregrounding and a 30-second visible-page refresh attempt sync again.
- Old full-snapshot writes are rejected. Reload older tabs after this update.
- Two phones opening one cage share its active cycle. Canonical cycle IDs are mapped back to queued actions. A stale action cannot change a subsequent load.
- Conflicting edits to the same details field are rejected. Changes to different fields merge. The app offers review/discard for rejected pending changes and retains a recovery copy locally.
- History is an event timeline. Edit details is a separate action. Support requests remain open across midnight and can be resolved from History; closed cycles no longer appear as open support requests.
- Demo mode is explicit (`?demo=1`), visibly labelled and stored separately. It never makes shared API requests. A fresh shared install has no invented history.
- Invalid saved recent-cage preferences no longer prevent startup. Shared text is escaped or rendered as text, including older imported issue text.
- PDFs rotate the original stacked label composition clockwise 90 degrees into the 62 x 42 mm Avery position. QR generation is bundled locally rather than loaded from a third-party CDN.

## Deployment

1. Run `node scripts/build-server.cjs` if workflow rules or server source change. This generates the complete `google-apps-script/Code.gs`.
2. In the existing Flow Lite API Apps Script project, replace Code.gs, save, and edit the existing web-app deployment to use a New version. Retain the current URL, owner and access settings.
3. Do not replace or clear the spreadsheet. The first v2 request creates FlowJournalV2 and imports records from FlowData without editing the original tab. Running setupFlowSheet repeatedly is now safe.
4. Verify `YOUR_EXEC_URL?action=getData` returns `ok: true` and `apiVersion: 2` before publishing the matching static files.
5. Publish all updated static files together, including flow-state.js, sync.js and vendor/qrcode.min.js. Refresh phones using the new versioned link.

After v2 actions have been recorded, do not revert the backend to the old snapshot writer: it cannot read newer journal entries. Keep the journal and pending phone queues when troubleshooting.

## Checks

- `node tests/workflow.cjs` tests action validation, two phones changing different cages, concurrent same-cage opens, duplicate retries, conflicting edits, support resolution, closed-cycle protection, non-destructive setup and legacy migration.
- `node tests/browser.cjs` uses Playwright against the local app and an in-memory Apps Script mock. It tests separate phone contexts, the actual controls, History, escaped text, lost responses, failed-connection reloads, conflict recovery, explicit demo isolation and PDF download. Set FLOW_PLAYWRIGHT_MODULE and FLOW_BROWSER_EXE if using a bundled runtime.
- Render and decode exported QR sheets as well as checking pagination. Physical printer alignment and actual iPhone Safari behaviour still require a device check.

## Scope and limits

- The existing public deployment access policy has not been changed. This update adds data-integrity checks, not staff authentication. QR format validity is not proof of user authorisation.
- Previously saved data is preserved, including any old example records that may already have been saved. The update does not guess which historical records are real or delete them.
- Pending actions survive API outages and page reloads while their browser storage remains intact. This is not a fully cached offline app; loading the app itself still requires its files to be available.
- The pilot journal replays accepted changes and returns a complete read snapshot. It avoids the single-cell growing JSON write but is not intended as the final storage architecture for years of multi-store history.
- Event timestamps are assigned by the server when actions are accepted. A change made during a connection gap appears at its acceptance time.
- The dashboard layout remains the original app layout, with corrected open-support counts. The approved compact redesign is not included in this reliability change.
