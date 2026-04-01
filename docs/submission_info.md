# Figma Plugin Submission Information

### Plugin Name
**AINaming**

### Developer/Company Name
Donghuc (Huynh Vinh)

### Contact Email
[USER'S EMAIL - Placeholder]

### Category
Design Tools, Productivity, Development

### Tagline
✨ Smart, AI-powered localization key naming for Figma designs.

### Description
AINaming is a productivity tool for product designers and localization engineers. It bridges the gap between design and development by automatically suggesting and applying consistent localization keys to text layers.

**Key Features:**
- **AI Classification**: Automatically detects dynamic content (e.g., timestamps, usernames) vs. static labels.
- **Rules-Based Naming**: Enforces a strict `{feature}.[screen].{semantic}.[element].[type]` naming convention.
- **Common Key Dictionary**: Map exact text strings (e.g., "Done", "Cancel") to predefined keys globally to save AI tokens and ensure cross-project consistency.
- **Review List**: A powerful triage interface to confirm, skip, or edit suggestions with support for bulk actions.
- **Metadata Anchoring**: Force a "Feature" or "Screen" context to ensure AI naming stays relevant to your app's structure.

### How it works
1. Select one or more frames or layers in Figma.
2. Initialize a scan.
3. Confirm the Feature and Screen metadata for your selection.
4. Review suggestions in the triage list.
5. Click Confirm to rename the layer in Figma.

### Permissions
- `currentuser`: Needed for unique instance identification and basic plugin functionality.
- `networkAccess`: Access to `api.openai.com` and `api.anthropic.com` for LLM-powered naming suggestions.

---
Created on 2026-04-01
