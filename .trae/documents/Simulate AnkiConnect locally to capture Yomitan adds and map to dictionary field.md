## Feasibility Summary
- Technically feasible to emulate AnkiConnect on `http://127.0.0.1:8765` so Yomitan can "add to Anki" and send payloads to our app.
- Minimal subset of AnkiConnect needed: `version`, `deckNames`, `modelNames`, `modelFieldNames`, `addNote`/`addNotes`, and optionally `storeMediaFile`. Responses must match AnkiConnect schema (`{"result":..., "error": null}`) and version 6.
- CORS/security: Yomitan runs in browser context and calls `fetch` to `127.0.0.1:8765`. Our Electron Koa server can bind to `127.0.0.1:8765`, set `Access-Control-Allow-Origin: *`, and handle JSON requests.
- Data mapping: When Yomitan posts `addNote(s)`, capture `note.fields` and `dictionary` markers, transform into Knowclip card data, append to a new field `dictionary` on current card or to a dictionary store attached to project.

## What We’ll Implement
### 1) Listener Server on 127.0.0.1:8765
- Bind a dedicated HTTP server inside Electron main process (or reuse existing Koa) on `127.0.0.1:8765`.
- Return AnkiConnect-compatible envelopes: `{result: <value>, error: null}` with `version: 6` semantics.
- Endpoints (actions inside POST body):
  - `version`: return `6`.
  - `deckNames`: return configured decks, e.g., `["Knowclip"]`.
  - `modelNames`: return `["KnowclipNote"]`.
  - `modelFieldNames`: return Knowclip supported fields (e.g., `['transcription','meaning','notes','dictionary']`).
  - `addNote`: accept single note; log/store; return a mock note id.
  - `addNotes`: accept array; return array of ids/nulls.
  - Optional `storeMediaFile`: accept base64/URL, store under project media.
  - Optional `requestPermission`: return Yomitan’s expected flags when API key disabled.

### 2) Data Capture and Mapping
- On `addNote(s)`, parse payload:
  - `note.deckName`, `modelName`, `fields`, `tags`, `audio/picture`.
  - Extract glossary or `dictionary` markers from fields (Yomitan templates include `{dictionary}`, `{glossary}`, `{frequencies}` etc.).
- Mapping rules:
  - Create/update Knowclip Flashcard: append a new field `dictionary` with the captured text (glossary + source dictionary alias).
  - Store Yomitan media if present and map to card media.
- Provide feedback to Yomitan: successful result ids; duplicates policy can be `allowDuplicate: true` to simplify.

### 3) UX Integration in Knowclip
- In Subtitles menu, add a toggle "Enable Yomitan AnkiConnect shim" and optional deck/model names.
- Show a small status indicator when requests are received.
- Allow viewing and editing the captured `dictionary` field in card preview.

### 4) Edge Cases & Security
- API key: If Yomitan is configured with API key, support `requestPermission` and validate `key`.
- CORS: Set permissive CORS headers; bind only to `127.0.0.1`.
- Port conflicts: Detect existing Anki; if real AnkiConnect is running, allow switching shim to another port and instruct Yomitan to change server address.

### 5) Testing Steps
- Configure Yomitan to point to `http://127.0.0.1:8765`.
- Use Yomitan’s test buttons to read deck/model names; verify they match.
- Click "Add to Anki" on a dictionary card; verify our server receives `addNote` and Knowclip card gets `dictionary` field filled.
- Validate multi-notes and media attachments.

### 6) Implementation Outline
- Main process: add a small AnkiConnect-compat handler; register routes for actions listed above.
- Reducers/actions: add `dictionary` field support to Flashcard model.
- Settings UI: toggle and configuration fields.
- Logging and telemetry for dev.

### 7) Timeline & Risk
- 0.5 day: server, endpoints, and envelopes.
- 0.5 day: mapping to `dictionary` field, UI toggle.
- 0.5 day: testing with Yomitan; adjust endpoints used by Yomitan (may call `addNotes`, `storeMediaFile`).
- Risks: Port occupied by real Anki; Yomitan expects more endpoints; API key enforcement.

Would you like me to proceed implementing the shim server and the `dictionary` field integration now?"}]]] }