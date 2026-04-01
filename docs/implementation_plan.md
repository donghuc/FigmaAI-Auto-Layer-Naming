# AINaming Figma Plugin — Implementation Plan

This document outlines the step-by-step implementation plan for the AINaming Figma Plugin based on the Developer Agent Guideline. 

## 1. Project Setup & Tooling

**Goal:** Establish the foundation for a Figma plugin using TypeScript, HTML, and CSS without a heavy framework, keeping the bundle size small.

*   **Initialize Project:**
    *   Initialize a Node.js project (`npm init -y`).
    *   Install TypeScript and Figma plugin typings (`@figma/plugin-typings`).
    *   Set up a bundler (e.g., Vite or Webpack) to compile TypeScript and bundle HTML/CSS/JS into the required single file structure or `ui.html` + `code.js`.
*   **Manifest Configuration (`manifest.json`):**
    *   Define name, ID, api version.
    *   Set `main` to `code.js` and `ui` to `ui.html`.
    *   Add `currentuser` permissions.
    *   Declare `networkAccess` for `api.openai.com` and `api.anthropic.com`.
    *   Set `editorType` to `figma`.
*   **Directory Structure:**
    *   `src/main/` - Code running in Figma sandbox (`code.ts`).
    *   `src/ui/` - Code running in iframe (`ui.html`, `ui.ts`, `styles.css`).
    *   `src/shared/` - Types and constants shared between threads.

## 2. Shared Types & Message Protocol

**Goal:** Strongly type the communication between the Main Thread and the UI Thread.

*   Define interfaces for all messages:
    *   `UI -> Main`: `SCAN_REQUEST`, `WRITE_KEY`, `SKIP_LAYER`, `UNSKIP_LAYER`, `FOCUS_LAYER`, `GET_SETTINGS`, `SAVE_SETTINGS`.
    *   `Main -> UI`: `SETTINGS_LOADED`, `SELECTION_CHANGED`, `SCAN_RESULT`, `WRITE_CONFIRMED`, `PROGRESS_UPDATE`.
*   Define domain models: `LayerPayload`, `ValidationResult`, `AIProviderSettings`.

## 3. Main Thread Implementation (`code.ts`)

**Goal:** Handle all interactions with the Figma document canvas and plugin APIs.

*   **Plugin Initialization:**
    *   Call `figma.showUI` with dynamic sizing constraints (width 300, variable height).
    *   Fetch settings (API keys) via `figma.clientStorage` and send to UI.
*   **Event Listeners:**
    *   Listen to `figma.on('selectionchange')`.
    *   Provide selection summary (Frame count, top-level nodes) to UI.
*   **Layer Scanning Logic `scanSelection()`:**
    *   Identify Frames vs. Sections.
    *   Implement Fragment detection heuristics (dimensions < 300, missing status/nav bars).
    *   Recursive traversal of text nodes.
    *   Filter visible text, exclude skipped nodes via `node.getPluginData('l10n_skip')`.
    *   Enforce 150 node limit.
    *   Extract context (parent frame, font, existing key validity).
*   **Action Handlers:**
    *   Handle `WRITE_KEY`: `figma.getNodeById(id).name = key`.
    *   Handle `FOCUS_LAYER`: `figma.viewport.scrollAndZoomIntoView([node])`, change selection.
    *   Handle `SKIP/UNSKIP`: `node.setPluginData('l10n_skip', 'true' | '')`.

## 4. UI Thread Implementation (`ui.ts` & `ui.html`)

**Goal:** Build the user interface and handle complex logic like AI interactions and string validation.

*   **View Infrastructure:**
    *   Implement a simple router or state manager to switch between Screens S1 to S9.
    *   Develop a minimal CSS system mapping to Figma's UI kit (colors, typography, inputs, buttons).
*   **Format Validation & Uniqueness Logic (`validator.ts`):**
    *   Implement `validateKeyFormat(key)` matching rules (lowercase, dot-separated, snake_case segments, 2-5 segments).
    *   Implement `normalizeKey(key)` and duplicate detection taking into account the whole selection scope including hidden ones.
*   **Screen S1: Settings / BYOK:**
    *   Form for OpenAI / Anthropic key input.
    *   Implement live API validation `fetch` calls before saving.
*   **Screens S2/S3/S4: Home & Preparation:**
    *   React to selection changes.
    *   Display layer counts.
    *   Show component Fragment Warning if Main thread flags fragments.
*   **AI Integration (`ai-service.ts`):**
    *   Implement batched sequential requests (chunk size: 50).
    *   Phase 1 (Classification API Call): Determine `normal`, `partial`, `dynamic`.
    *   Phase 2 (Suggestion API Call): Generate keys based on the Naming Convention artifact.
    *   Handle quotas, timeouts, and malformed JSON errors.
*   **Screen S6: Review List (The Core Engine):**
    *   Render categorised lists: 🔴 Issues, 🆕 New, ✅ Existing, 🔘 Skipped.
    *   Implement interactive rows:
        *   Click -> Focus layer (sends message to Main).
        *   Input -> Live validation -> Unlocks Confirm button (or locks with Format Error badge).
        *   Confirm -> Sends WRITE_KEY, UI goes checkmark.
        *   Skip -> Sends SKIP_LAYER, moves to omitted list.
    *   Handle grouping logic for replicated strings.
*   **Screens S7/S8/S9: Outcomes:**
    *   Render completion summaries or specific error states based on AI pipeline results.

## 5. Development Phases

*   **Phase A: Scaffold & Shell** - Setup Vite/Webpack, Manifest, 2-way messaging, UI routing structure.
*   **Phase B: Main Thread Depth** - Selection traversal, heuristics, pluginData read/write.
*   **Phase C: Validation & AI** - String format and normalization logic. Fetch wrappers for OpenAI/Anthropic.
*   **Phase D: UI Polish** - Build out S1-S9 screens matching Figma's aesthetic, hook up all interactive row behaviors.
*   **Phase E: E2E Testing** - Test with real API keys on sample Figma files to ensure robustness of limits, error boundaries, and token normalization.
