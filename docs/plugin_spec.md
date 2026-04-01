# AINaming Figma Plugin: Product Specification

## Overview
AINaming is a Figma plugin designed to automate and standardize localization keys across complex design files. It uses AI to analyze text layers and context, enforcing a strict 5-segment naming convention while allowing designers to provide high-level product context (Feature/Screen) to anchor the results.

---

## 1. Naming Convention
The plugin enforces the following hierarchy as defined in `naming_convention.md`:

`{feature}.[screen].{semantic}.[element].[type]_[descriptor]`

- **{feature}**: (Required) The high-level product module (e.g., `auth`, `home`, `settings`).
- **[screen]**: (Optional) Specific screen context (e.g., `signin`, `profile`).
- **{semantic}**: (Required) The meaning of the text (e.g., `error`, `title`, `email`).
- **[element]**: (Optional) The UI component (e.g., `button`, `card`, `toast`).
- **[type]**: (Optional) The role of the text (e.g., `placeholder`, `description`, `label`).
- **[_descriptor]**: (Automatic) An underscore-appended suffix derived from text content to resolve key collisions on the same screen.

### Special Rule: `common.*`
Any element detected within a **Navigation Bar**, **Tab Bar**, or identified as a **Shared Action** (Done, Cancel, Back) is automatically forced into the `common` feature namespace, overriding the designer's input.

---

## 2. User Flow & Screens

### S1: Settings
- **Trigger**: First launch or clicking Cog icon.
- **Inputs**: API Provider (OpenAI/Anthropic) and API Key.
- **Validation**: Basic key format check. Persistent storage via Figma Client Storage.
- **Navigation**: "Back" button available only if a key is already saved.

### S2: Home (Idle)
- **State**: No valid selection in Figma.
- **Display**: Logo, app title, and "Waiting for selection" status.

### S3 & S3b: Selection & Frame Confirmation
- **S3 (Ready)**: Shows selected layer count. Designer clicks "Run Scan".
- **S3b (Metadata Confirmation)**:
    - Lists all unique top-level frames in the selection.
    - **Feature (Required)**: Pre-filled from normalized frame name. Must be non-empty to proceed.
    - **Screen (Optional)**: Pre-filled from frame name suffixes.
    - **Purpose**: These serve as "anchors" for the AI. AI is forbidden from inventing new features/screens once confirmed here.

### S5: Loading
- **Phases**: "Classifying layers..." → "Suggesting keys...".
- **Visual**: Spinner with progress text.

### S6: Review List
- **Logic**: Groups identical layers (same text/context) into a single row to reduce triage effort.
- **Interactions**:
    - **Edit**: Inline input to tweak AI suggestions.
    - **Confirm**: Writes the key to the Figma layer name and marks row as "Applied".
    - **Skip**: Moves the layer to the collapsed "Skipped" section at the bottom. **In-place mutation** preserves scroll position.
    - **Unskip**: Re-activates a skipped layer.
    - **Click Row**: Triggers `FOCUS_LAYER` in Figma to navigate to the element without changing selection state (preventing scan resets).
    - **Split Group**: Explodes a grouped row into individual layers for separate naming.
- **Descriptor Resolution**: If two different rows result in the same key (e.g., two cards with different labels), the plugin automatically appends `_descriptor` (e.g. `_speed`) to disambiguate.

### S7: Done / Summary
- **Trigger**: When all suggestions are confirmed or skipped.
- **Display**: Stats (Applied, Skipped, Dynamic/Hidden skipped).
- **Navigation**: "New Scan" (resets to S2) or "Close".

---

## 3. Technical Implementation Details

### AI Prompting Strategy
- **Two-Pass System**: 
    1. **Classification**: Identifies "normal" (static), "partial" (template + dynamic), and "dynamic" (runtime only) text. Only the first two get keys.
    2. **Suggestion**: AI is provided with the designer's confirmed `feature` and `screen` as absolute anchors. It only suggests the remaining segments (`semantic`, `element`, `type`).
- **Filtering**: Automatically ignores hidden layers and handles "Component Fragments" (stubs used in components) via heuristic detection to avoid system-wide key pollution.

### Performance & Stability
- **In-place DOM Mutation**: To solve "scroll jumping," Skip/Unskip actions directly manipulate the DOM and local state instead of re-rendering the whole UI.
- **Selection Safety**: The plugin "freezes" the scan context. Changes to Figma selection *after* the scan has started do not wipe the current Review List.
- **Persistence**: Remembers which IDs were "Confirmed" during a session, ensuring that re-renders (like splitting a group) don't lose progress.

---
**Status**: Production Ready. Verified against `naming_convention.md`.
