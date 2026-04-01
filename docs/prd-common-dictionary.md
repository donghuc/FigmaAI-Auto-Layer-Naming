# PRD — Common Key Dictionary
## Feature Addition to AINaming Figma Plugin

**Status:** Ready for development
**Priority:** P1 — builds on top of existing scan pipeline

---

## 1. Problem

The AI cannot reliably detect strings like "Safe", "Risky", "Danger" as `common.*` keys because it lacks the team's institutional knowledge about which strings are intentionally shared across features. Designers end up with inconsistent suggestions like `home.safe.badge` and `family.safe.badge` for what should be a single `common.safe.badge` key.

---

## 2. Solution

A **Common Key Dictionary** — a team-managed mapping of exact text strings to pre-defined `common.*` keys. During a scan, any text layer whose full content exactly matches a dictionary entry skips the AI pipeline and receives the mapped key directly.

---

## 3. How It Works

### 3.1 Dictionary Structure

Each entry is a mapping of:
- **Text** (string): The exact layer text to match against, stored lowercase
- **Key** (string): The `common.*` key to assign, must pass format validation

```json
[
  { "text": "safe",   "key": "common.safe.badge" },
  { "text": "danger", "key": "common.danger.badge" },
  { "text": "risky",  "key": "common.risky.badge" },
  { "text": "done",   "key": "common.done.button" },
  { "text": "cancel", "key": "common.cancel.button" }
]
```

### 3.2 Matching Rule

- **Exact match only** — the entire layer text must equal the dictionary entry (case-insensitive, trimmed of whitespace)
- **No substring matching** — "Keep your family safe" does NOT match the entry "safe"
- This is intentional: short status words and shared action labels are always standalone text

```
layer.text.toLowerCase().trim() === entry.text.toLowerCase()
```

### 3.3 Scan Pipeline — Updated Order

```
For each unnamed text layer:
  1. Check Common Key Dictionary (exact match, case-insensitive)
     → MATCH:    Assign mapped key. Mark row as "Common" (no AI call).
     → NO MATCH: Send to two-phase AI pipeline as before.
```

This runs BEFORE Phase 1 classification. Dictionary matches never consume AI tokens.

### 3.4 Review List Row — "Common" Type

Dictionary-matched layers appear in the New section with a `🔵 Common` badge:

```
[Layer text]   [Frame name, muted]   [🔵 Common badge]
[Key input — pre-filled from dictionary, editable]
[Confirm btn]  [Skip btn]
```

- Key is pre-filled but editable — designer can override if the match was wrong
- If designer edits the key and it no longer starts with `common.`, the badge disappears

---

## 4. Storage

**Location:** `figma.root.setPluginData('common_dictionary', JSON.stringify([...]))`

**Why file-level storage:**
- Dictionary is shared across all team members working on the same Figma file
- Travels with the file when duplicated or shared
- One designer's updates apply to all teammates immediately on next plugin open

**Read on every scan:**
```js
const raw = figma.root.getPluginData('common_dictionary')
const dictionary = raw ? JSON.parse(raw) : []
```

**Write on every Settings save:**
```js
figma.root.setPluginData('common_dictionary', JSON.stringify(dictionary))
```

---

## 5. Settings Screen — Dictionary Management

Add a new section to S1 (Settings) below the API key form.

### UI Structure

```
─── COMMON KEY DICTIONARY ────────────────────────────

  Exact text matches bypass AI and use the mapped key directly.

  [+ Add entry]

  ┌────────────────────────────┬────────────────────────┬───┐
  │ Text (exact match)         │ Key                    │   │
  ├────────────────────────────┼────────────────────────┼───┤
  │ safe                       │ common.safe.badge      │ 🗑 │
  │ danger                     │ common.danger.badge    │ 🗑 │
  │ done                       │ common.done.button     │ 🗑 │
  └────────────────────────────┴────────────────────────┴───┘

  [Save]
```

### Interaction Rules

- **Add entry:** Opens an inline row with two inputs — Text field and Key field. Key field validates format on blur (must start with `common.`, must pass format validator).
- **Delete entry:** Trash icon removes the row immediately (pending Save).
- **Save:** Writes updated dictionary to `figma.root.setPluginData`. Shows confirmation.
- **Duplicate text check:** If designer adds an entry with text already in the dictionary, show inline error: "This text is already mapped to [existing key]."
- **Key validation:** Every key in the dictionary must pass the existing format validator AND must start with `common.`. Keys not starting with `common.` show inline error: "Dictionary keys must start with common."

### Pre-populated defaults (shipped with plugin)

```json
[
  { "text": "done",       "key": "common.done.button" },
  { "text": "cancel",     "key": "common.cancel.button" },
  { "text": "back",       "key": "common.back.button" },
  { "text": "ok",         "key": "common.ok.button" },
  { "text": "close",      "key": "common.close.button" }
]
```

These can be deleted or edited by the designer.

---

## 6. Review List — "Add to Common Dictionary" Action

When a designer confirms any key in the Review List, a secondary action appears:

```
✅ home.safe.badge  confirmed
   [+ Add "safe" → common.safe.badge to dictionary]   ← ghost link, optional
```

Tapping this:
1. Opens a small inline form pre-filled with `text = "safe"`, `key = "common.safe.badge"` (replacing `home.` with `common.` automatically)
2. Designer adjusts if needed
3. Confirms → writes to `figma.root.setPluginData` immediately
4. Confirmation toast: "Added to common dictionary"

This allows the dictionary to grow organically during normal design work without requiring designers to go to Settings.

---

## 7. Edge Cases

| Case | Behavior |
|---|---|
| Dictionary is empty | No matching runs. AI pipeline handles all layers as before. |
| Dictionary entry key fails format validation on load | Skip that entry silently, log warning in console. Do not crash. |
| Two entries map to the same key (different text) | Both are valid — same key applied to different text strings is intentional reuse. |
| Dictionary entry text matches a layer that is already named | Layer goes to Existing section as normal — dictionary not consulted (only unnamed layers are matched). |
| Designer edits a dictionary-matched key to be non-`common.*` | Badge disappears. Key is treated as a normal suggestion. Dictionary entry is NOT updated. |
| figma.root.setPluginData read fails | Fall back to empty dictionary. Show non-blocking warning in Settings. |

---

## 8. Uniqueness Impact

Dictionary-matched keys are subject to the same uniqueness normalization as AI-suggested keys. If two layers in a scan both match "safe" → both receive `common.safe.badge` → plugin does NOT flag this as a duplicate. Two layers sharing the same `common.*` key is the intended behavior.

However, if a dictionary-matched key conflicts with a non-common key on the same scan (e.g., AI suggests `home.safe.badge` for another layer and `common.safe.badge` from dictionary), the uniqueness normalizer will flag these as duplicates since `["home","safe","badge"] ≠ ["common","safe","badge"]`. This is correct — the designer should resolve.

---

## 9. Out of Scope (this sprint)

- Export / import dictionary as JSON file (v2)
- Team-level dictionary shared across multiple Figma files (requires external server)
- Partial text matching or regex patterns (too risky for false positives)
- AI auto-populating the dictionary from scan history (v2)
