# User Guide: AINaming Figma Plugin

Mastering your localization workflows.

---

### 🧰 Getting Started
To get started with AINaming, you'll need:
1. **Figma Desktop or Web App**.
2. **An API Key** from OpenAI (starting with `sk-`) or Anthropic (starting with `sk-ant-`).

Open the plugin and tap the **⚙️ Settings** icon in the header. Paste your key and select your preferred AI model. Your settings are stored locally.

---

### 🏷️ Naming Convention
AINaming enforces the following structure for every localization key:
`{feature}.[screen].{semantic}.[element].[type]`

- **Feature**: (e.g., `family`, `home`, `safe`)
- **Screen**: (e.g., `card`, `list`, `profile`)
- **Semantic**: (e.g., `speed`, `heart_rate`)
- **Element**: (e.g., `title`, `label`, `action`)
- **Type**: (e.g., `button`, `text`, `icon`)

---

### 📝 Using the Plugin

#### 1. Scan Selection
Select any Frame, Section, or Group with text layers in Figma. Hit **Scan**. 
AINaming will automatically detect unnamed layers, named layers, and hidden layers.

#### 2. Confirm Feature/Screen Context
Type in the **Feature** and **Screen** metadata for the frame(s) you've just scanned. This "anchors" the AI suggestions to the exact part of your app you are currently designing.

#### 3. Review & Triage
Go through the list of suggestions:
- **Confirm**: Directly renames the layer in Figma to match the suggestion.
- **Skip**: Hides the layer from the current scan and stores its "skipped" state in the Figma file.
- **Bulk Actions**: If you have 5 "Confirm" buttons across your frames, AINaming groups them. Choose "Confirm all" to save time!

#### 4. The Common Key Dictionary
If you have global keys that don't change based on screen (e.g., `common_close_button`), add them to the dictionary. Once added, AINaming will bypass the AI and automatically suggest the correct `common.*` key.

---

### 🔧 Troubleshooting
- **API Failure**: Ensure your API key is correctly entered and has enough credit.
- **No Layers Found**: Check that your selected layers are visible and contain Text nodes.

---
© 2026 AINaming Plugin
