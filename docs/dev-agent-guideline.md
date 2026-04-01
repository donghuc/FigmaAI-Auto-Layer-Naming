# AINaming — Developer Agent Guideline
## Complete Build Specification

> This document is the single source of truth for building the AINaming Figma plugin.
> Cross-reference with: `key-naming-convention.md`, `phase1-handoff.md`, `phase2-handoff.md`, `phase3-spec.md`

---

## 1. Project Overview

**What it is:** A Figma plugin that scans selected frames or sections, uses AI to suggest localization key names for text layers, and writes confirmed keys directly to Figma layer names for downstream Crowdin sync.

**Why it exists:** Designers manually naming layers is slow, error-prone, and produces duplicate/malformed keys that break the Crowdin → translation → production pipeline.

**Key output:** Layer names in Figma that follow the convention `{feature}.[screen].{semantic}.[element].[type]`, ready to be picked up by the Crowdin Figma plugin.

---

## 2. Tech Stack

- **Platform:** Figma Plugin (manifest v3)
- **UI:** HTML + CSS + Vanilla JS (or React if preferred — keep bundle small)
- **Plugin panel size:** 300px wide, variable height (min 400px, max 600px with internal scroll)
- **Storage:**
  - `figma.clientStorage` — API key, provider preference (local to user machine)
  - `node.setPluginData / node.getPluginData` — per-layer skip state, travels with file
- **AI providers:** OpenAI (GPT-4o recommended) and Anthropic (Claude)
- **API calls:** Made from the plugin UI thread (not sandboxed main thread) using `fetch`

---

## 3. Plugin Architecture

```
┌─────────────────────────────────────────────┐
│  Figma Canvas (main thread)                  │
│  - Layer scanning                            │
│  - node.setPluginData read/write             │
│  - Layer name write on confirm               │
│  - figma.viewport.scrollAndZoomIntoView      │
│  - figma.currentPage.selection               │
└─────────────────┬───────────────────────────┘
                  │  postMessage (two-way)
┌─────────────────▼───────────────────────────┐
│  Plugin UI (iframe)                          │
│  - All UI rendering                          │
│  - figma.clientStorage (API key)             │
│  - AI API calls (fetch to OpenAI/Anthropic)  │
│  - Format validation logic                   │
│  - Uniqueness normalization logic            │
└─────────────────────────────────────────────┘
```

**Message protocol between threads:**
```js
// UI → Main
{ type: 'SCAN_REQUEST' }
{ type: 'WRITE_KEY', nodeId: '123:456', key: 'home.todo.header.title' }
{ type: 'SKIP_LAYER', nodeId: '123:456' }
{ type: 'UNSKIP_LAYER', nodeId: '123:456' }
{ type: 'FOCUS_LAYER', nodeId: '123:456' }

// Main → UI
{ type: 'SCAN_RESULT', layers: [...] }
{ type: 'WRITE_CONFIRMED', nodeId: '123:456' }
{ type: 'SELECTION_CHANGED', frameInfo: { name, layerCount } }
```

---

## 4. Screen Inventory & Routes

| Screen ID | Name | Route trigger |
|---|---|---|
| S1 | Settings / BYOK Setup | First launch OR settings icon tapped |
| S2 | Home / No Selection | Plugin open, nothing selected in Figma |
| S3 | Home / Selection Ready | Frame or section selected |
| S4 | Component Fragment Warning | Section contains fragment frames |
| S5 | Loading / Scanning | Run tapped |
| S6 | Review List | Scan complete |
| S7 | Run Complete Summary | All rows resolved |
| S8 | Validation-Only Results | All layers already named (no AI run) |
| S9 | Error State | API failure, quota error, network loss |

---

## 5. Screen-by-Screen Specs

### S1 — Settings / BYOK Setup

**Shown:** First launch (no key in clientStorage) OR settings icon tapped.
**Purpose:** Collect and validate API key before any plugin functionality.

**Elements:**
- Plugin icon (32px) + title "AINaming" + subtitle "Connect your AI provider"
- Provider dropdown: `OpenAI — GPT-4o (Recommended)` | `Anthropic — Claude`
- API key text input (type=password): placeholder changes per provider
  - OpenAI: `sk-...`
  - Anthropic: `sk-ant-...`
- Inline error below input (hidden until blur + validation fail)
- Help link: `How do I get an API key? →`
  - OpenAI: `https://platform.openai.com/api-keys`
  - Anthropic: `https://console.anthropic.com/account/keys`
- CTA button: `Save & Continue` — **disabled** until format + live validation pass
- Trust signals row: `🔒 Stored locally · No proxy · Pay per use`

**Validation logic:**
```
FORMAT CHECK (on input blur):
  OpenAI:    starts with "sk-" or "sk-proj-", length >= 40 chars, no spaces
  Anthropic: starts with "sk-ant-", length >= 80 chars, no spaces

LIVE VALIDATION (on CTA tap, after format passes):
  OpenAI:    POST https://api.openai.com/v1/models
             Header: Authorization: Bearer {key}
             Success: 200 OK
  Anthropic: POST https://api.anthropic.com/v1/messages
             Header: x-api-key: {key}, minimal test payload
             Success: 200 OK

On success: store key + provider in figma.clientStorage, navigate to S3
On failure: show inline error "Key invalid or expired"
```

**Provider switch behavior:** Clears key input field. Resets validation state. Updates placeholder.

---

### S2 — Home / No Selection

**Shown:** Plugin open but no frame/section selected in Figma canvas.

**Elements:**
- Header: `AINaming` title + settings icon (top right, always visible)
- Empty state icon (frame/cursor illustration)
- Message: `Select a frame or section in Figma to begin`

**Behavior:** Plugin listens for `figma.on('selectionchange', ...)`. When a frame/section is selected, auto-navigate to S3.

---

### S3 — Home / Selection Ready

**Shown:** Frame or section is selected in Figma.

**Elements:**
- Header: `AINaming` + settings icon
- Selection card:
  - Icon indicating frame or section type
  - Selection name (trimmed to ~30 chars)
  - Layer count: `~24 text layers detected`
- Run button:
  - **Enabled:** API key exists in clientStorage
  - **Disabled:** No API key. Show hint below: `Add an API key in Settings to enable`
- Settings icon in header routes to S1

**Layer count detection:**
Count all visible, non-hidden text nodes in the selection (see Section 7 for full scan logic). Update live if selection changes.

---

### S4 — Component Fragment Warning

**Shown:** Between S3 and S5, only when section contains frames identified as component fragments.

**Elements:**
- Back button (top left)
- Title: `Fragments detected`
- Info banner: `These frames look like components, not screens. They'll be skipped to avoid naming component-level strings.`
- Fragment list: each row shows frame name + dimensions
- Primary CTA: `Skip fragments & Run`
- Secondary CTA: `Scan everything`

**Component fragment detection heuristics (2 of 3 signals = fragment):**
```
Signal 1: frame.width < 300 OR frame.height < 300
Signal 2: no child/descendant node with name matching /status.?bar|statusbar/i
Signal 3: no child/descendant node with name matching /nav.?bar|bottom.?nav|dockbar|tab.?bar/i
```

If only 1 signal matches → treat as full screen (err toward inclusion).

---

### S5 — Loading / Scanning

**Shown:** After Run is tapped (and fragments handled). No cancel — scan runs to completion.

**Elements:**
- Title: `Scanning...`
- Two-phase step indicator:
  - Phase 1: `Classifying layers` — shows `Batch X of Y` if >50 layers
  - Phase 2: `Generating suggestions`
  - Each phase has a step dot: pending → pulsing (active) → filled (done)

**Progress update:** Main thread sends progress events to UI after each batch completes.

---

### S6 — Review List (Core Screen)

**Shown:** After AI pipeline completes.

**Header:** `Review suggestions` + remaining counter `(18 remaining)`

**Four sections, top to bottom:**

#### 🔴 Issues Section
Always expanded. Never collapsible. Badge shows count.

Row anatomy:
```
[Layer text, max 28 chars, ellipsis]   [Frame name, muted]
[Key input — pre-filled, editable]     [Error badge: "Format error" | "Duplicate"]
[Confirm btn]  [Skip btn — secondary]
```

Error badge colors:
- Format error → red background
- Duplicate → orange background

#### 🆕 New Section
Unnamed layers with AI suggestions.

**Row types:**

**Normal row:**
```
[Layer text]   [Frame name, muted]
[Key input — pre-filled]
[Confirm btn]  [Skip btn]
```

**Partial row:** Same as normal + yellow `Partial` badge in top-right of row.

**Dynamic row:**
```
[Layer text]   [Frame name, muted]   [grey "Dynamic" badge]
[Key input — BLANK, placeholder: "No key needed — override if required"]
[Confirm btn — disabled unless field has value]  [Skip btn]
```

**Grouped shared-content row:**
```
[Layer text]   [X layers share this content]
[Key input — pre-filled shared suggestion]
[Apply to all btn]  [Review individually btn — ghost]
```
"Review individually" expands group into individual rows, each editable.

#### ✅ Existing Valid Section
Collapsed by default. Header: `✅ Existing (X validated)` + `Show` toggle.

Expanded row:
```
[Layer text]   [Frame name, muted]
[Key — read-only]   [✅ valid badge]
```

#### 🔘 Skipped Section
Collapsed by default. Header: `🔘 Skipped (X)` + `Show` toggle.

Expanded row:
```
[Layer text]   [Frame name, muted]
[Un-skip button]
```
Un-skip: clears `node.setPluginData('l10n_skip', '')`, moves layer to New section, triggers AI suggestion for that layer only.

**Row interactions:**
- **Click anywhere on row** → `figma.viewport.scrollAndZoomIntoView([node])` + `figma.currentPage.selection = [node]`
- **Confirm (filled field)** → Write key to layer name → Row stays visible, shows ✅ checked state → Counter decrements
- **Edit confirmed row** → Re-activates Confirm button (removes ✅ state)
- **Confirm (empty field, Dynamic)** → No-op (button is disabled)
- **Skip** → `node.setPluginData('l10n_skip', 'true')` → Row animates out, appears in Skipped section

**Motion:**
- Row confirm: scale(0.98) → fade to ✅ checked state, 150ms ease-out
- Section expand/collapse: height 0→auto, 200ms ease-in-out

---

### S7 — Run Complete Summary

**Shown:** When all rows in Issues + New sections are either confirmed or skipped.

**Elements:**
- ✅ success icon
- Title: `Done!`
- Stats:
  - `✅ X keys written`
  - `🔘 X skipped`
  - `⚫ X dynamic (not named)`
- Primary CTA: `Done` (closes plugin)
- Ghost CTA: `Run on another frame` (returns to S2)

---

### S8 — Validation-Only Results

**Shown:** When all layers in selection are already named (no AI run performed).

**Elements:**
- Header: `Validation complete`
- Subtitle: `No new layers to name`
- Same layout as S6 but only Issues + Existing sections. No New section.

---

### S9 — Error State (3 variants)

| Variant | Title | Body | CTA |
|---|---|---|---|
| API quota | `API quota exceeded` | `Your API account has run out of credits. Top up to continue.` | `Go to [Provider] dashboard →` |
| Network | `Connection lost` | `We couldn't reach the AI provider. Check your connection and try again.` | `Retry` |
| Key invalid | `API key rejected` | `Your key was declined by [Provider]. It may have expired or been revoked.` | `Update key in Settings` |

All variants have a ghost `Cancel` button below the CTA.

---

## 6. Layer Scanning Logic

```
function scanSelection(selection):

  1. If selection is a SECTION:
     - Get all top-level child frames
     - Run fragment detection on each frame
     - Separate into: screenFrames[] and fragmentFrames[]
     - If fragmentFrames.length > 0: show S4 warning
     - After user confirms: scan only screenFrames (or all if "Scan everything")

  2. If selection is a FRAME:
     - Treat as single screenFrames[frame]

  3. For each frame in screenFrames:
     - Traverse all descendant nodes recursively
     - Collect nodes where:
         node.type === 'TEXT'
         AND node.visible === true
         AND node.getPluginData('l10n_skip') !== 'true'

  4. Layer limit check:
     - If total collected text nodes > 150:
       Show error: "This selection has X text layers, which exceeds the 150-layer limit.
       Try scanning individual frames instead."
       STOP.

  5. For each text node, build payload:
     {
       nodeId: node.id,
       text: node.characters,
       layerName: node.name,
       parentComponentName: getParentComponentName(node),
       frameName: getParentFrameName(node),
       textStyle: getTextStyleName(node),
       positionInHierarchy: getHierarchyPath(node),
       existingKey: isValidKey(node.name) ? node.name : null
     }

  6. Split into two buckets:
     - unnamedLayers: payload.existingKey === null
     - namedLayers:   payload.existingKey !== null

  7. namedLayers → local validation only (see Section 8)
  8. unnamedLayers → AI pipeline (see Section 7)

  9. Also collect ALL text nodes (including hidden) for uniqueness check:
     hiddenLayerKeys[] = all hidden text nodes' names that are valid keys
```

---

## 7. AI Pipeline (Two-Phase)

### Phase 1 — Classification

**Goal:** Classify each unnamed layer as `normal`, `partial`, or `dynamic`.

**Batch size:** 50 layers per API call. Run batches sequentially.

**System prompt:**
```
You are a localization expert analyzing Figma design layers.
Classify each text layer as one of:
- "normal": Static UI copy that needs a localization key (labels, buttons, headings, messages)
- "partial": A mix of static template text and runtime data (e.g., "Welcome back, {name}" or "Last seen {time} ago")
- "dynamic": Entirely runtime data — no localization key needed (user names, locations, measurements, counts, timestamps, device names)

Naming convention for context: {feature}.[screen].{semantic}.[element].[type]

Respond with a JSON array only:
[{ "nodeId": "...", "classification": "normal|partial|dynamic" }]
```

**User message:** JSON array of layer payloads (batch of up to 50).

### Phase 2 — Key Suggestion

**Goal:** Suggest a localization key for each `normal` and `partial` layer.

**Batch size:** 50 layers per API call.

**System prompt:**
```
You are a localization key naming expert. Generate a key for each UI text layer following this convention:

Convention: {feature}.[screen].{semantic}.[element].[type]
- feature: REQUIRED. The product feature (e.g., auth, home, settings)
- screen: optional. The specific screen within the feature
- semantic: REQUIRED. The content type or UI state
- element: optional. The UI component type
- type: optional. The copy role within the element

Rules:
- Minimum 2 segments (feature.semantic), maximum 5 segments
- All lowercase, dot-separated
- Multi-word values within a segment use snake_case (underscore)
- No camelCase, no hyphens, no spaces
- For shared/reusable strings use "common" as the feature

Respond with a JSON array only:
[{ "nodeId": "...", "suggestedKey": "feature.semantic" }]
```

**User message:** JSON array of layer payloads for normal + partial layers only.

---

## 8. Local Format Validation

Run on every AI suggestion AND on every manual key edit (on blur or before confirm).

```js
function validateKeyFormat(key):
  const segments = key.split('.')

  // Segment count
  if (segments.length < 2) return { valid: false, error: 'Key needs at least 2 segments (feature.semantic)' }
  if (segments.length > 5) return { valid: false, error: 'Key cannot exceed 5 segments' }

  // Each segment
  for (const segment of segments):
    if (segment.length === 0) return { valid: false, error: 'Empty segment — check for double dots' }
    if (/[A-Z]/.test(segment)) return { valid: false, error: 'Use lowercase only — no uppercase letters' }
    if (/[^a-z0-9_]/.test(segment)) return { valid: false, error: 'Use dots between segments, underscores within segments only' }
    if (segment.startsWith('_') || segment.endsWith('_')) return { valid: false, error: 'Segments cannot start or end with underscore' }

  return { valid: true }
```

---

## 9. Uniqueness Normalization

Two keys are duplicates if their normalized token lists are identical.

```js
function normalizeKey(key):
  // Split on dots, then split each segment on underscores, flatten
  return key.split('.').flatMap(segment => segment.split('_'))

function isDuplicate(keyA, keyB):
  const tokensA = normalizeKey(keyA)
  const tokensB = normalizeKey(keyB)
  return tokensA.length === tokensB.length &&
         tokensA.every((token, i) => token === tokensB[i])
```

**Uniqueness check scope:** All text nodes in the current selection PLUS all hidden text nodes in the same frames (read their current `node.name` values).

```js
function checkUniqueness(allSuggestedKeys, hiddenLayerKeys):
  const allKeys = [...allSuggestedKeys, ...hiddenLayerKeys]
  const duplicates = []

  for (let i = 0; i < allKeys.length; i++):
    for (let j = i + 1; j < allKeys.length; j++):
      if (isDuplicate(allKeys[i].key, allKeys[j].key)):
        duplicates.push(allKeys[i].nodeId, allKeys[j].nodeId)

  return duplicates  // nodeIds of layers with duplicate keys
```

---

## 10. Key Write Logic

```js
// On Confirm button tap in UI:
// UI sends to main thread:
{ type: 'WRITE_KEY', nodeId: '123:456', key: 'home.todo.header.title' }

// Main thread handler:
figma.ui.on('message', msg => {
  if (msg.type === 'WRITE_KEY') {
    const node = figma.getNodeById(msg.nodeId)
    if (node) {
      node.name = msg.key   // Overwrites whatever is there. No re-read. No warning.
      figma.ui.postMessage({ type: 'WRITE_CONFIRMED', nodeId: msg.nodeId })
    }
  }
})
```

**Rule:** Plugin overwrites the layer name on Confirm, no questions asked. Designers must close the plugin before making manual layer edits.

---

## 11. Skip Logic

```js
// Skip a layer (permanent):
node.setPluginData('l10n_skip', 'true')

// Check on scan:
if (node.getPluginData('l10n_skip') === 'true') → exclude from scan

// Un-skip:
node.setPluginData('l10n_skip', '')   // or deletePluginData if API supports it
// Then re-request AI suggestion for this single node
```

Skip state travels with the Figma file (stored in the file, not locally). If a frame is duplicated, skipped layers in the copy remain skipped.

---

## 12. Storage Schema

```js
// figma.clientStorage (async, local to user machine, NOT in file)
await figma.clientStorage.setAsync('apiKey', 'sk-abc123...')
await figma.clientStorage.setAsync('provider', 'openai')  // or 'anthropic'

const apiKey = await figma.clientStorage.getAsync('apiKey')
const provider = await figma.clientStorage.getAsync('provider')

// node.setPluginData (sync, stored in Figma file, travels with file)
node.setPluginData('l10n_skip', 'true')
const isSkipped = node.getPluginData('l10n_skip') === 'true'
```

---

## 13. API Request Formats

### OpenAI
```js
POST https://api.openai.com/v1/chat/completions
Headers:
  Authorization: Bearer {apiKey}
  Content-Type: application/json
Body:
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "{systemPrompt}" },
    { "role": "user", "content": "{batchPayloadJSON}" }
  ],
  "temperature": 0.2,
  "response_format": { "type": "json_object" }
}
```

### Anthropic
```js
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: {apiKey}
  anthropic-version: 2023-06-01
  Content-Type: application/json
Body:
{
  "model": "claude-sonnet-4-5",
  "max_tokens": 1024,
  "system": "{systemPrompt}",
  "messages": [
    { "role": "user", "content": "{batchPayloadJSON}" }
  ]
}
```

**Temperature:** Keep low (0.1–0.2) — we want consistent, deterministic naming, not creative variation.

---

## 14. Error Handling

| Error | Detection | UI response |
|---|---|---|
| No API key | `clientStorage.getAsync('apiKey')` returns null | Disable Run button (S3) |
| API key format invalid | Format regex fails on blur | Inline error in S1 |
| API key expired/rejected | 401 response from provider | S9 variant: Key invalid |
| API quota exceeded | 429 response from provider | S9 variant: Quota exceeded |
| Network timeout | fetch() throws or times out after 30s | S9 variant: Connection lost |
| AI returns malformed JSON | JSON.parse fails | Retry batch once. If still fails → show per-row "Retry" |
| AI suggests invalid key | Format validator fails | Show inline error on that row. Block confirm until fixed. |
| Layer limit exceeded | text node count > 150 | Inline message in S3 or S5 before AI call |
| Fragment-only section | All frames are fragments | Special empty state message |

---

## 15. Figma Plugin Manifest

```json
{
  "name": "AINaming",
  "id": "YOUR_PLUGIN_ID",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "permissions": ["currentuser"],
  "networkAccess": {
    "allowedDomains": [
      "https://api.openai.com",
      "https://api.anthropic.com"
    ]
  },
  "editorType": ["figma"]
}
```

> ⚠️ Network access must be declared in manifest for fetch() calls to external APIs to work in Figma plugins.

---

## 16. MVP Feature Scope (Build This)

| Feature | Priority |
|---|---|
| S1 BYOK settings (OpenAI + Anthropic) with format + live validation | ✅ P0 |
| S2/S3 Home screens with selection detection | ✅ P0 |
| Layer scanner (visible, non-hidden, non-skipped text nodes) | ✅ P0 |
| Fragment frame detection (2-of-3 heuristic) | ✅ P0 |
| 150-layer limit guardrail | ✅ P0 |
| Two-phase AI pipeline (classify → suggest) with batching | ✅ P0 |
| Local format validator | ✅ P0 |
| Uniqueness normalizer (flatten dots + underscores) | ✅ P0 |
| S6 Review list with all row types | ✅ P0 |
| Write key to Figma layer name on Confirm | ✅ P0 |
| Permanent skip via node.setPluginData | ✅ P0 |
| Click-to-focus on Figma canvas | ✅ P0 |
| Inline key editing with re-validation | ✅ P0 |
| Shared content grouping + split | ✅ P0 |
| S7 Run complete summary | ✅ P0 |
| S8 Validation-only results | ✅ P0 |
| S9 Error states | ✅ P0 |

## Not in MVP (V2)

| Feature | Reason |
|---|---|
| Confirm All bulk action | Too risky without undo |
| Delta log / Revert last run | Only valuable at multi-screen scale |
| View skipped layers management panel | Nice to have |
| Dynamic content template rules | Deferred |
| AI auto-apply mode | Future vision |
| Web/desktop frame support | Mobile only for MVP |

---

## 17. Key Conventions Reference

See `key-naming-convention.md` for full details. Summary for AI prompts:

```
Structure:  {feature}.[screen].{semantic}.[element].[type]
Required:   feature + semantic
Optional:   screen, element, type
Min:        2 segments
Max:        5 segments
Format:     lowercase, dot-separated, snake_case within segments
Unique:     normalize by splitting on . then _, compare token list
```
