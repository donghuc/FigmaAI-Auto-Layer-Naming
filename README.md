# 🪄 AINaming Figma Plugin

**Automated Localization Key Naming Driven by AI & Rules.**

AINaming is a Figma plugin designed to solve the friction of manual localization key naming. It scans your design layers, identifies their semantic purpose, and suggests structured, developer-friendly keys following a strict naming convention.

---

## ⚡ Features

### 🧠 Smart AI Suggestions
Powered by GPT-4o and Claude, AINaming classifies every text layer:
- **Normal**: Suggested a semantic key like `home.safe.badge.label_secure`.
- **Partial**: Recognizes established keys and suggests refinements.
- **Dynamic**: Skips layers that contain user-generated content (e.g., timestamps, names).

### 🏷️ Rule-Based Naming
Enforces a consistent naming hierarchy:
`{feature}.[screen].{semantic}.[element].[type]`
- **Anchor Context**: Designers select 'Feature' and 'Screen' per frame before AI processing starts to ensure suggestions match your app's architecture.
- **Auto-Descriptors**: If two layers on the same screen have identical semantic names, it automatically appends a unique `_descriptor` derived from the text (e.g., `_speed`, `_heart_rate`).

### 📘 Common Key Dictionary
Map frequently used strings like "Done," "Cancel," or "Back" to specific `common.*` keys.
- **Bypasses AI**: Saves tokens and ensures immediate consistency.
- **Organic Growth**: Add any confirmed key to your file's shared dictionary with one click during the review process.

### 📋 High-Speed Triage
A powerful review list to manage results:
- **Bulk Actions**: Confirm or Skip an entire group of identical layers with one click.
- **Focus Mode**: Click any layer in the list to instantly zoom and center it in the Figma canvas.
- **In-place Mutation**: Confirming or skipping won't reset your scroll position, making it perfect for long lists.

---

## 🚀 Getting Started

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/donghuc/FigmaAI-Auto-Layer-Naming.git
cd FigmaAI-Auto-Layer-Naming
npm install
```

### 2. Development
Run the build script to generate the plugin files:
```bash
npm run build
```
In Figma:
1. `Plugins > Development > Import plugin from manifest...`
2. Select the `manifest.json` in the project root.

### 3. Usage
1. Open the plugin and enter your **OpenAI** or **Anthropic** API key in Settings.
2. Select one or more frames (or a section) in your Figma file.
3. Launch the **Scan**.
4. Set the **Feature** and **Screen** context for the selected frames.
5. Review, edit, and confirm your localization keys!

---

## 🤝 Contribution
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
MIT License. See [LICENSE](LICENSE) for details.

---

## 🔗 Links
- [User Guide](https://donghuc.github.io/FigmaAI-Auto-Layer-Naming/guide.html)
- [Terms of Service](https://donghuc.github.io/FigmaAI-Auto-Layer-Naming/terms.html)
- [Walkthrough](https://donghuc.github.io/FigmaAI-Auto-Layer-Naming/WALKTHROUGH.html)
