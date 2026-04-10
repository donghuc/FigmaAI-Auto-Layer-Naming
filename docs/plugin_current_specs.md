# AINaming Figma Plugin Specifications

**Repository Profile**: `donghuc/FigmaAI-Auto-Layer-Naming`
**Primary Goal**: A productivity tool designed to automatically parse, classify, and rename text layers in Figma using standardized Design System (DS) or Localization (l10n) naming conventions. It utilizes Large Language Models (LLMs) to construct intelligent suggestions.

---

## 1. Core Architecture
- **Plugin UI**: Pre-bundled iframe utilizing inline HTML, vanilla JavaScript/TypeScript, and CSS (`dist/ui.html`). Built via `vite` (`vite-plugin-singlefile`).
- **Plugin Backend**: Runs exclusively within the Figma runtime (`src/main/code.ts`). Built via `esbuild`.
- **Communication Protocol**: UI and Backend communicate asynchronously via `figma.ui.postMessage` and `onmessage` listeners.

## 2. API Providers & Integrations
The plugin supports multiple AI providers for key suggestion generation. Keys are stored locally on the client's machine (`figma.clientStorage`). Access is constrained via `manifest.json` (`allowedDomains`).
1. **OpenAI** (`gpt-4o`) — Endpoint: `/v1/chat/completions`
2. **Anthropic** (`claude-3-5-sonnet`) — Endpoint: `/v1/messages`
3. **Deepseek** (`deepseek-chat`) — Endpoint: `/chat/completions`

*Note: Real-time UI validation checks verify key format structures (e.g., `sk-...` or `sk-ant-...`).*

## 3. Figma Node Parsing & Rules
When a scan is triggered on a Figma selection, the plugin extracts `TEXT` nodes recursively across standard frames and component fragments with strict boundary rules:
- **Visibility**: Layers that are hidden (`visible: false`), or whose parent containers are hidden, are skipped (`isEffectivelyVisibleAndUnlocked`).
- **Locking**: Layers that are locked manually (`locked: true`), or reside inside a locked parent, are fundamentally ignored.
- **Exclusion Tags**: Layers explicitly tagged via PluginData (`l10n_skip === 'true'`) are skipped.
- **Limitations**: The scanning protocol will forcibly reject operations if the total active editable text node count exceeds `150` nodes to prevent context window saturation and rate limits.

## 4. Name Generation & Categorization
The plugin attempts to organize node names hierarchically: `<feature>.<screen>.<element>.<state>` (or similar DS conventions). 
- **Dictionary Mapping**: The system maintains an offline localized `dictionary` array for common verbs/terms (e.g., `Confirm` -> `common.confirm.button`). It immediately intercepts scanning matches to prevent redundant AI queries and enforce universal consistency.
- **Dynamic Identification**: If text looks like a variable/dynamic placeholder (e.g., `{{username}}`, `[Date]`), the text is classified as `dynamic` and bypassed for strict component naming.
- **Collision Mitigation**: If AI generates duplicate keys for distinct layers on the exact same screen, a deterministic descriptor derived from the layer's literal text is appended to guarantee uniqueness.
- **Group Aggregation**: Instances of identical plaintext across the layout are merged into **Groups**. A single master key is suggested, applying changes in bulk across all identical text nodes.

## 5. User Interface States (Flow)
- **S1 (Settings)**: Setup screen configuring the `provider`, raw API keys, and managing custom dictionary additions/removals.
- **S2 (Home)**: The default empty shell requesting the user to select valid Figma nodes. 
- **S3 / S3b / S4 (Context Constraints)**: Upon selection, prompts the exact feature and screen names applied as context constraints for the AI layer.
- **S5 (Processing Component)**: Loading spinner signaling that `code.ts` is running `runAISuggestions()`.
- **S6 (Naming / Resolution Table)**: The core workspace displaying `groupedLayers`.
    - Features real-time error detection for illegal characters or naming duplications.
    - Users can `Confirm` single lines, `Skip` lines, or `Apply all`.
- **S7 (Done Summary)**: Displays post-op statistics (`Written`, `Skipped`, `Dynamic`). Contains a button to process another frame.
- **S8 (Review / Completed Mode)**: Automatically triggered if all layers in the highlighted selection *already* comply with the naming structure. Features "All Valid" and logs existing keys.
    - *Edit Capability*: Contains an **"Edit Keys"** entry point that pushes the already mapped (`namedLayers`) back into the `S6` resolution table queue for modification.

## 6. Edge Cases Handled
- **Silent Node Rejections**: `figma.getNodeById()` accesses dynamic paths safely using `getNodeByIdAsync()` due to modern Figma `.dynamic-page` manifest permissions.
- **Component ComponentInstance Protection**: Trapping and isolating focus errors caused by variant constraints.
- **Safe Network Checks**: Bypasses immediate network ping testing on unique providers (e.g., Deepseek) directly from Figma to avoid blocking API configurations due to tight CORS limits.
