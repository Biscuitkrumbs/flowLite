# Flow

## ✅ Completed

- [x] Project structure
- [x] Google Sheets database
- [x] Apps Script API
- [x] Browser → Apps Script connection
- [x] Stable ID generation

---

## 🚧 Current

- [ ] Live cages

---

## 📋 Planned

- [ ] Live cycles
- [ ] Live events
- [ ] Dashboard from Google Sheets
- [ ] QR scanning
- [ ] Authentication
- [ ] Reporting

## 💡 Future Ideas

- Department heat maps
- Multiple stores
- Mobile offline mode
- Barcode scanning
- Predict workload
- AI flow analysis

# Flow – Project Context, Architecture and Development Notes

## Project Vision

Flow is not a stock management system.

It is a workflow visibility system designed to measure and improve how work flows through a retail store using reusable roll cages.

The purpose is to make invisible work visible so team members and leaders can identify bottlenecks, delays and opportunities for improvement without adding unnecessary workload.

The core philosophy is:

Measure the movement of work, not the people doing it.

The system should help answer:

“Where is today’s work?”

It should not become a tool for judging individual productivity.

---

## Core Architecture

Flow originally used browser LocalStorage as a prototype.

That was useful for proving the interface and workflow, but it is not the permanent architecture.

The project is now moving to:

Browser
    ↓
Apps Script API
    ↓
Google Sheets

Google Apps Script and Google Sheets are the permanent source of truth.

The browser should become a thin client that displays information, collects input and sends requests to the API.

---

## Browser Responsibilities

The browser should:

- scan QR codes
- accept validated Flow QR payloads
- collect user input
- display cage information
- display active workflow information
- display dashboards
- call the FlowAPI methods
- show clear success and error messages

The browser should not:

- generate cage IDs
- decide whether a cage exists
- create cycles independently
- decide whether workflow transitions are allowed
- manipulate spreadsheet rows directly
- contain permanent business rules
- treat LocalStorage as the source of truth

LocalStorage may still temporarily exist while migration is underway, but it should be progressively removed or limited to harmless interface preferences.

---

## Apps Script Responsibilities

Google Apps Script owns:

- cage registration
- cage lookup
- cage validation
- cycle creation
- cycle closing
- cycle status
- workflow transitions
- event recording
- input validation
- QR validation
- dashboard queries
- spreadsheet access
- business rules
- error responses

The server must remain authoritative.

The browser asks Apps Script to perform an action.

Apps Script decides whether that action is valid and returns the result.

---

## Permanent Cage Identity

Every physical roll cage has one permanent identity.

Each cage should have:

- a permanent three-digit Cage ID
- a printed QR code
- a large human-readable number

Example human-readable cage number:

044

QR payload:

FLOW|CAGE|044|V1

The QR payload contains:

FLOW
Application identifier

CAGE
Asset type

044
Permanent cage number

V1
QR format version

The version field allows the QR format to evolve later without breaking existing codes.

The application identifier and asset type help reject unrelated or malformed QR codes.

---

## Internal Cage IDs

Users and physical labels use the three-digit number:

044

The spreadsheet may continue storing the internal ID as:

RC-044

Users should not need to understand or type the RC- prefix.

The browser and API can convert between the public cage number and the internal spreadsheet ID.

Example:

Public Cage ID:
044

Internal record ID:
RC-044

QR payload:
FLOW|CAGE|044|V1

These all refer to the same permanent physical cage.

---

## Cage Opening Rules

The main browser operation is now:

FlowAPI.openCage(request)

QR scan example:

FlowAPI.openCage({
  cageId: "044",
  source: "qr",
  payload: "FLOW|CAGE|044|V1"
});

Apps Script decides what happens next.

---

## Manual Entry Policy

When a user manually enters:

044

Apps Script should:

- validate that it is exactly a valid three-digit cage number
- convert it to the internal ID RC-044
- look for the existing cage
- return the cage if it exists
- reject the request if the cage has not been registered

Manual entry should not silently register a new physical cage.

This prevents typing mistakes from creating permanent cage records.

---

## QR Scan Policy

When a user scans:

FLOW|CAGE|044|V1

Apps Script should:

- validate the complete QR structure
- confirm the application identifier is FLOW
- confirm the asset type is CAGE
- confirm the cage number is three digits
- confirm the QR version is supported
- convert the cage number to RC-044
- open the cage if it already exists
- register the physical cage if it does not exist and QR registration is allowed

This means a correctly printed QR label can act as proof that the physical cage is legitimate.

New cages can therefore be commissioned by scanning their authorised QR code.

---

## Browser QR Parser

The browser QR parser currently follows this format:

const FlowQR = {
  parse(payload) {
    const value = String(payload || "").trim();

    const pattern = /^FLOW\|CAGE\|(\d{3})\|V1$/;
    const match = value.match(pattern);

    if (!match) {
      return {
        valid: false,
        error: "This is not a valid Flow cage code."
      };
    }

    return {
      valid: true,
      type: "CAGE",
      cageId: match[1],
      version: 1,
      payload: value
    };
  }
};

The browser parser improves the user experience by rejecting clearly invalid scans immediately.

Apps Script must still validate the request again because browser validation cannot be trusted as the permanent authority.

---

## API Direction

The old browser API used:

FlowAPI.createCage()

That method represented the old design where the software generated new cage identities.

That design is obsolete because the physical cages already have permanent identities.

The replacement is:

FlowAPI.openCage(request)

The browser sends the known physical cage identity to Apps Script.

Apps Script opens, validates or registers the cage according to the source and business rules.

---

## Obsolete Functions

The following old functions were removed or identified as obsolete:

- getNextCageId()
- createCage()
- testFlowLiteSetup()
- browser-side automatic cage ID generation
- old create-cage test logic

Any remaining references to automatic cage number generation should be removed as the migration continues.

---

## Google Sheets Data Model

The current core sheet structure includes:

Cages
Cycles
Events
Departments

### Cages

Represents permanent physical roll cages.

A cage record should remain in the system across many workflow cycles.

A cage is an asset, not a single delivery or task.

### Cycles

Represents one use of a cage through the workflow.

A physical cage can have many cycles over time.

Opening, filling, moving, unloading and completing a cage should belong to a cycle rather than changing the permanent identity of the cage.

### Events

Represents an append-only history of meaningful workflow actions.

Events should record what happened to a cage or cycle and when it happened.

The purpose is workflow history and measurement, not surveillance of individuals.

### Departments

Represents valid store departments or workflow destinations.

Departments should come from server-controlled data rather than being permanently hard-coded throughout the browser.

---

## Important Data-Modelling Principle

A cage and a cycle are not the same thing.

Cage:

- permanent physical asset
- identity remains the same
- can be reused indefinitely

Cycle:

- one period of work involving that cage
- has a beginning and end
- stores changing workflow information
- may include department, status and timestamps

This distinction is important because the physical cage survives after an individual workflow is completed.

---

## Event Philosophy

Events should preferably be append-only.

Instead of repeatedly overwriting history, record meaningful transitions such as:

- cage registered
- cycle opened
- department assigned
- cage moved
- cage received
- work started
- work completed
- cycle closed

This creates a reliable history for analysing flow and delays.

The exact event names and workflow stages can be refined as the real process becomes clearer.

---

## Dashboard Philosophy

The dashboard is intended to help leaders understand the current movement of work.

It should answer questions such as:

- Where is today’s work?
- Which cages are active?
- Which department currently owns each cage?
- How long has a cage remained at its current stage?
- Where are delays forming?
- Which work is completed?
- Which work still requires attention?

The dashboard should not be designed as an individual performance ranking system.

The system measures work and process flow rather than people.

---

## User Interface Philosophy

The interface should require very little training.

The ideal interaction is:

Scan
    ↓
See cage
    ↓
Tap action
    ↓
Done

The application should avoid:

- unnecessary menus
- long forms
- repeated data entry
- technical internal IDs
- confusing navigation
- requiring users to understand the spreadsheet structure

Buttons should use language that matches the real store workflow.

The interface should feel intentional, calm and practical rather than busy.

---

## Development Philosophy

The project should be built incrementally.

Preferred workflow:

Design
    ↓
Implement
    ↓
Test
    ↓
Refactor
    ↓
Continue

Small, testable changes are preferred over large rewrites.

Each important feature should work reliably before another layer of complexity is added.

When code becomes difficult to read, stop and clean it before continuing.

---

## Coding Style

Readable code is more important than compressed code.

Avoid one-line functions such as:

function test(){return true;}

Use:

function test() {
  return true;
}

Preferred characteristics:

- two-space indentation
- descriptive function names
- small focused functions
- blank lines between logical blocks
- braces on readable lines
- limited nesting
- early returns where useful
- section headers
- comments that explain why, not obvious syntax
- no unnecessary cleverness
- no compressed chained expressions when readability suffers

Recommended section style:

// ======================================================
// Constants
// ======================================================

// ======================================================
// Global State
// ======================================================

// ======================================================
// Utilities
// ======================================================

// ======================================================
// API
// ======================================================

// ======================================================
// Cage Operations
// ======================================================

// ======================================================
// Dashboard
// ======================================================

// ======================================================
// Dialogs
// ======================================================

// ======================================================
// Event Handlers
// ======================================================

// ======================================================
// Startup
// ======================================================

The recently reformatted app.js should be treated as the style direction for the project.

---

## Module Philosophy

Use modules when they provide a clear responsibility.

Do not add abstractions merely because they are fashionable.

A module should have an understandable purpose, such as:

- FlowAPI for communication with Apps Script
- FlowQR for parsing Flow QR codes
- rendering functions for interface updates
- dedicated state or utility modules when the code genuinely requires them

Shared styles, buttons, colours and reusable interface rules should be kept in central locations so future changes do not need to be repeated across many files.

---

## Error Handling Philosophy

Errors shown to users should be clear and useful.

For example:

“This is not a valid Flow cage code.”

is better than:

“Invalid payload.”

Apps Script responses should distinguish between cases such as:

- invalid request
- unsupported action
- invalid cage number
- malformed QR payload
- unsupported QR version
- cage not registered
- cycle already open
- no active cycle
- spreadsheet or server failure

The browser should display the useful message returned by the API without exposing internal implementation details.

---

## Validation Philosophy

Validation should happen in both places for different reasons.

Browser validation:

- gives immediate feedback
- avoids obviously unnecessary requests
- improves the user experience

Server validation:

- protects the data
- owns the permanent rules
- must never assume the browser request is trustworthy

Server validation is always authoritative.

---

## Major Architectural Learning

The biggest design improvement was recognising that the physical cage already has an identity.

The original design generated software IDs such as:

RC-001

That treated the application as the creator of the cage.

In reality, the physical cage already exists and should receive a permanent printed number and QR code.

The improved design uses:

044

and:

FLOW|CAGE|044|V1

The software adapts to the physical operation rather than forcing the physical operation to adapt to an artificial software numbering system.

This was a major shift from “create a cage in the software” to “recognise and open a real cage”.

---

## Another Important Learning

Registering a permanent asset is different from starting work with that asset.

Scanning a new authorised QR code may register the physical cage.

Opening or starting a cycle represents the work currently being performed with that cage.

These should not be treated as the same permanent record.

---

## Current Project Status

Completed or substantially established:

- project concept and workflow philosophy
- LocalStorage prototype
- Google Apps Script project
- Google Sheets schema
- API routing structure
- permanent cage identity
- three-digit cage numbering
- versioned QR format
- browser QR parser
- FlowAPI.openCage() browser direction
- removal of old automatic cage ID functions
- reformatted readable app.js
- coding style direction
- server-authoritative architecture decision

Currently in progress:

- migration from browser LocalStorage to Apps Script
- implementation of the permanent openCage() server operation
- replacement of old browser cage creation logic
- ensuring spreadsheet IDs and physical cage numbers map correctly

---

## Immediate Next Task

Implement and test Apps Script openCage(request).

The operation should:

1. Accept cageId, source and optional payload.
2. Validate source.
3. Validate the three-digit cage number.
4. Validate the full payload for QR requests.
5. Convert 044 to RC-044.
6. Search the Cages sheet.
7. Return the existing cage when found.
8. Register a missing cage only when permitted by a valid QR scan.
9. Reject unknown cages entered manually.
10. Return a structured JSON response.
11. Avoid generating a new cage number.
12. Keep all permanent rules in Apps Script.

After openCage() works:

- connect the browser scan flow to FlowAPI.openCage()
- connect manual entry to FlowAPI.openCage()
- display the returned cage
- remove the equivalent LocalStorage cage-opening logic
- test existing QR cage
- test new authorised QR cage
- test existing manual cage
- test unknown manual cage
- test malformed QR code
- test unsupported QR version

---

## Recommended API Response Shape

A successful response should be predictable.

Example:

{
  "success": true,
  "cage": {
    "cageId": "044",
    "recordId": "RC-044",
    "status": "available"
  },
  "registered": false
}

A newly registered QR cage may return:

{
  "success": true,
  "cage": {
    "cageId": "044",
    "recordId": "RC-044",
    "status": "available"
  },
  "registered": true
}

An error may return:

{
  "success": false,
  "error": "Cage 044 has not been registered."
}

The final response structure can be adjusted to match the existing API conventions, but it should remain consistent across endpoints.

---

## Project Feel

Flow should feel:

- simple
- practical
- calm
- fast
- low-friction
- easy to understand
- grounded in the real workflow
- useful to both team members and leaders
- respectful of employees
- focused on improving systems rather than blaming people

It should not feel:

- corporate for the sake of being corporate
- complicated
- overly technical
- punitive
- surveillance-driven
- cluttered
- slow
- dependent on extensive training

---

## Commercial-Quality Direction

Although Flow currently uses GitHub Pages, Google Apps Script and Google Sheets, the code should be structured as though the project may grow into a more substantial application.

This means:

- clear separation of concerns
- browser independent of spreadsheet details
- API-controlled data access
- stable cage identity
- explicit workflow rules
- predictable responses
- reusable modules
- readable code
- versioned QR formats
- data structures that can migrate later

The current stack should not prevent a later move to another database or backend.

The browser should call a clean API rather than knowing how Google Sheets works internally.

---

## Working Preferences for Future Development Chats

When continuing this project:

- make one clear change at a time
- explain where code should be placed
- avoid assuming the user knows which file or section is meant
- prefer complete replacement functions over vague line-by-line instructions
- preserve working behaviour unless a behaviour change is explicitly discussed
- distinguish formatting changes from logic changes
- test before moving to the next task
- do not generate images unless they are genuinely useful
- package updated project files as ZIP files when returning code
- keep code readable and consistently formatted
- do not reintroduce automatic cage-number generation
- remember that Apps Script is the source of truth
- remember that the system measures workflow, not people

---

## Starting Point for the Next Chat

The next chat should begin by uploading the latest Flow ZIP and including this roadmap.

The next development step is:

Review the latest project files, confirm the current Apps Script API structure, then implement the new server-authoritative openCage(request) operation without changing unrelated behaviour.

The main requirements are:

- permanent three-digit physical cage IDs
- QR payload format FLOW|CAGE|044|V1
- internal spreadsheet IDs such as RC-044
- manual entry opens registered cages only
- valid QR scans may register a missing physical cage
- browser uses FlowAPI.openCage()
- Apps Script owns validation and business rules
- LocalStorage is being progressively removed
- preserve the simple, practical and workflow-focused feel of the project