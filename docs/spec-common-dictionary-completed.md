# Completed Implementation: Common Key Dictionary

## Overview
The Common Key Dictionary has been fully implemented into the AINaming plugin, allowing teams to map exact semantic text strings to specific `common.*` localization keys without utilizing AI processing. This improves consistency across common interactions and drastically reduces AI token consumption.

## Architecture updates
1. **Figma File Storage**
   - The dictionary is saved specifically to `figma.root` via `setPluginData('common_dictionary')`.
   - This ensures the dictionary is linked to the active Figma file, shared among all designers accessing the file.
   - It is seeded with 5 default entries: `done`, `cancel`, `back`, `ok`, `close`.

2. **Scan Pipeline Hook**
   - In `code.ts`, the pipeline reads the dictionary right before assigning layers to `unnamedLayers`.
   - Instead of immediately passing bare layers, it checks if `node.characters.toLowerCase().trim()` strictly equals any dictionary `text` entry.
   - If a match is found:
     - `payload.suggestedKey` is firmly assigned the dictionary key.
     - `payload.isCommonMatch = true` is flagged.

3. **AI Bypass**
   - In `ui.ts` `processAI()`, any layer possessing the `isCommonMatch` property is actively stripped out before classifying or interacting with the OpenAI API.
   - After AI processing concludes, the dictionary mappings naturally rejoin the pipeline for the final grouping phase (meaning identical texts are correctly squashed together).

## UI Flow & Mechanics
### Setting UI (S1)
- Added a full CRUD interface beneath the API key input.
- Displays current `common_dictionary` mappings.
- Users can delete entries inline via the trash action.
- A new row allows adding strings. This form validates:
  - Both text and key fields must be filled.
  - Key must strictly begin with `common.`.
  - The key must cleanly resolve via `validateKeyFormat()`.
  - The text must not already exist in the table.

### Review List (S6)
- **Blue Badge rendering**: Rows that were matched natively via the dictionary render a distinctive `🔵 Common` badge next to the layer string.
- **Editable with revocation**: While the dictionary key acts as the default, the user retains total control over the input. If the designer alters the value so that it drops the `common.` prefix, the `🔵 Common` badge intelligently vanishes interactively. 
- **Organic Ghost Link**: If an AI-suggested layer (not a dictionary match) is confirmed natively via either individual confirmation or "Apply to all", an inline Ghost Link appears (`+ Add "safe" → common.*`).
- **Inline Save**: Tapping the Ghost Link converts it into an inline editor, swapping the feature prefix to `common.`. Adjusting the string and hitting Save automatically seeds it directly into `figma.root` file data, instantly updating the underlying dictionary without causing a UI reset. 

## Technical Considerations
All dependencies compile seamlessly within `esbuild`. The data model remains durable throughout page manipulation via standard `postMessage` exchanges keeping the `Settings`, `Backend File Storage`, and `Local Memory` accurately synchronized.
