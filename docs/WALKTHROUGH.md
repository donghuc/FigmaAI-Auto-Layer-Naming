# AINaming: Walkthrough for Product Designers

### 🔎 Step 1: Scan
1. Open the plugin. 
2. Select one or more **frames** or a **section** in Figma. 
3. Click **Scan**. 
4. If some layers are already named (e.g., using a design system library), AINaming will detect them and skip them during the review list process.

### 📍 Step 2: Metadata Anchoring
Before AI suggestions fire, you must provide context:
- **Feature (Required)**: (e.g., `family`, `home`, `safe`)
- **Screen (Optional)**: (e.g., `card`, `list`, `profile`)

The AI uses these as **prefixes** to ensure the generated keys strictly obey your naming convention.

### 📋 Step 3: TriageSuggestions
Once processed, you'll see a review list:
- **Badge Key Definitions**:
  - `🔵 Common`: String exists in the Common Key Dictionary; no AI used.
  - `🎁 Partial`: Semantic part of the key was intelligently guessed by AI.
  - `🩶 Dynamic`: UI elements that represent data (like a username or timestamp). 
- **Bulk Review**: Identical text strings (like "Speed" and "Altitude") are automatically grouped. Use "Confirm All" or "Skip All" to save time. 

### 📓 Step 4: Context Awareness
Can't remember where a layer is? Simply click on any layer row in the plugin list. Figma will instantly zoom and focus on that layer for you.

### 📕 Step 5: Common Key Dictionary
If you confirm a layer like "Safe" to `common.safe.badge`, you'll see a button: `+ Add to Dictionary`. This saves the mapping globally to the Figma file. Next time "Safe" appears on any screen, it will be automatically suggested as `common.safe.badge`.

### ✅ Step 6: Confirmation
Each confirmed key is renamed exactly in the Figma layer hierarchy. 
When all layers have been either confirmed or skipped, hit **Done** to see a final summary.
---
© 2026 AINaming Plugin
