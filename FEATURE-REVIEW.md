# Flow feature review - 28 October 2026

Reviewed the original GitHub main revision de2747978c54bf93782abe6e8f8181aa73a7acd0, including the roadmap, page controls, browser modules and supplied Apps Script. This is a source review with targeted isolated browser checks, not a validation of the deployed spreadsheet backend.

## Existing features to preserve

| Feature | Original behaviour |
| --- | --- |
| Label generator | Starting cage plus quantity, preview and browser printing, with up to 100 consecutive labels. No need for a separate numbering screen. |
| QR deep links | A phone-camera scan opens the numbered cage directly through `?cage=RC-044`. A missing cage is registered on opening this link, not during printing. |
| Manual entry | Accepts `8`, `008` and `RC-008`, normalises them and opens existing active cages. Unknown manual IDs are rejected. |
| Alternate QR parser | Accepts `FLOW\|CAGE\|044\|V1` through the input. Printed labels currently use web links, allowing the phone's normal camera to open them. |
| Recent cages | Six recent cages are saved on that device. Tapping a recent cage refreshes shared data before opening. |
| Automatic cycles | Opening a cage with no active cycle starts one and records first_scan. Preserve until the intended start signal is agreed; do not add a new start form by default. |
| Quick status actions | Packed, Being worked, Empty and Needs attention. Empty closes the current cycle and returns to lookup. |
| Packed long press | A 550ms hold opens optional details and offers Save and mark packed. A normal tap records packing immediately. |
| Optional details | Department, packer name, destination aisle and message. Destination, department and message appear on the cage. |
| Stale-cycle recovery | After 24 hours without activity: Extend, Empty, New load and Needs attention. Extend records activity; New load closes the old cycle and opens another. |
| Issue reasons | Packaging, Mixed aisles, Overstock, Wrong location, Damaged stock and Other. |
| Dashboard details | Tiles open lists for active cages, cycle times, attention, friction and hourly completions. Active lists can open the cage. |
| Dashboard measures | Open/complete totals, cycle durations, yesterday and seven-day comparisons, age indicators and issue categories already exist. |
| Shared-data connection | Reads/writes Apps Script, caches locally and displays sync status. Refreshes on returning to the tab or window. |
| Central branding | Name, edition, titles and lookup messages are configured centrally. |

## Gaps and distinctions

1. **History is a details form.** The History button refreshes shared data and opens the editable details dialog. Events are recorded but there is no visible cage event timeline.
2. **Retry wording overpromises.** A failed-save message says tap History to retry. That handler reloads server data; it does not resend a durable queue of unsaved actions. Reloading can replace unsynced local changes.
3. **Shared data exists, but concurrent saves remain unsafe.** Each device sends a complete snapshot; a server lock serialises writes without merging stale snapshots. Refresh and save responses can also replace newer local edits.
4. **The dashboard refreshes its calculations, not its remote data, every minute.** Opening it renders the local snapshot. Remote refresh normally occurs on startup/focus/visibility or certain cage operations.
5. **Attention is an event count today, not an unresolved-issue list.** No resolve action exists. Completed cycles can remain in today's issue counts, while yesterday's unresolved issues drop out.
6. **Demo data is automatic.** Without a local cache, the browser generates example history. An empty server response can cause that data to be uploaded. A real pilot needs explicit separation of demo and real data.
7. **There is no in-app camera scanner.** The phone's normal camera works with printed URL labels. This already meets the simple scan-to-open flow; adding a scanner is optional.
8. **Local cache is not full offline support.** No installed-app/service-worker caching or durable action outbox is supplied.
9. **The supplied server differs from the roadmap.** It stores one JSON snapshot in FlowData rather than separate Cages/Cycles/Events/Departments tables. Server-owned openCage and transition validation are not implemented in this revision.
10. **Setup is destructive if repeated.** setupFlowSheet clears FlowData. Do not rerun it on a populated work sheet.
11. **The supplied API has no authentication check.** Its setup instructions allow Anyone. Access and integrity need addressing before broader use, without adding repeated sign-in steps to every cage action.
12. **Dashboard HTML needs safer text rendering.** Some shared department/issue strings are inserted into innerHTML. Render shared text as textContent when revising it.
13. **No resource-allocation trend yet.** The compact department waiting overview agreed in this chat is a mockup, not yet installed in the app. A growing/clearing queue needs real snapshots or event-based history, not an invented trend.

## Changes in this package

The existing label selection remains. Download PDF replaces the browser print button. PDFs use the official Avery AU L7109 template geometry, 18 positions per A4 page, vector QR codes, and large three-digit numbers. Invalid fractional/empty/out-of-range quantities are rejected. Export reads the current selection and does not register cages or write shared data.

No workflow, backend or dashboard behaviour was changed by the review.

## Verification

- Generated 1, 18, 19 and 100-label exports; 19 labels produced two pages and 100 produced six.
- Rendered and visually inspected the 18-label A4 example; decoded all 18 rendered QR codes and checked their target URLs.
- Tested the download button in a local headless Edge browser, including selection validation and no shared writes during export.
- Checked Packed hold/details, History/details, stale-cycle Extend, and dashboard drill-down in the browser with shared requests intercepted.
- Physical printer alignment and Safari/iPhone download behaviour still need a device check. Print plain paper at Actual size / 100% before using label stock.
