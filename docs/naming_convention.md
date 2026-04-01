# UI Copy Key Naming Convention

## Overview
This document defines the key naming convention for all UI copy strings. It ensures designers, developers, and content teams reference the same string identically — across design tools, codebase, and content management systems.

---

## Convention Structure

```
{feature}.[screen].{semantic}.[element].[type]
```

Where `{}` = **required**, `[]` = **optional**.

Keys are built left to right, from broad to specific. The more segments included, the more specific the string. The fewer segments, the more reusable and shared the string.

**Minimum valid key:** `{feature}.{semantic}` — 2 segments
**Maximum valid key:** `{feature}.{screen}.{semantic}.{element}.{type}` — 5 segments

---

## Segment Definitions

| Segment | Required | Description | Examples |
|---|---|---|---|
| `feature` | ✅ Always | The product feature | `auth` `settings` `account` `home` `family_inbox` |
| `screen` | ⚪ Optional | The specific screen within the feature | `signin` `signup` `otp` `profile` `permissions` |
| `semantic` | ✅ Always | The content object or state | `error` `success` `email` `password` `terms` |
| `element` | ⚪ Optional | The UI component carrying the copy | `button` `input` `card` `modal` `banner` `toast` |
| `type` | ⚪ Optional | The copy role within the element | `title` `subtitle` `description` `placeholder` `hintlabel` |

---

## The Semantic Segment — Full Breakdown

`{semantic}` covers two categories: **states** and **content objects**. Both sit in the same position in the key.

### States — condition of the UI at the moment of display

| Value | When to use |
|---|---|
| `success` | Action completed successfully |
| `error` | System or validation failure |
| `warning` | Non-blocking risk or caution |
| `fail` | Hard failure, action could not complete |
| `loading` | A sync process in progress |
| `empty` | No content to display |

### Content Objects — the subject matter of the copy

| Value | When to use |
|---|---|
| `email` | Copy related to email address field or context |
| `password` | Copy related to password field or context |
| `phone` | Copy related to phone number |
| `otp` | Copy related to one-time passcode |
| `terms` | Terms of service references |
| `privacy` | Privacy policy references |
| `name` | User's name field or context |
| `permission` | Device or app permission requests |
| `biometric` | Face ID / fingerprint related copy |

---

## Uniqueness & Duplicate Detection Rule

Two keys are considered **duplicates** if their normalized token lists are identical.

**Normalization algorithm:**
1. Split key on dots (`.`) → get segments
2. Within each segment, split on underscores (`_`) → get sub-tokens
3. Flatten all sub-tokens into a single ordered list
4. Compare lists — equal lists = duplicate

```
auth.error_btn   → ["auth", "error", "btn"]
auth.error.btn   → ["auth", "error", "btn"]   ← DUPLICATE ❌

home.family_inbox.title  → ["home", "family", "inbox", "title"]
home.family.inbox.title  → ["home", "family", "inbox", "title"]  ← DUPLICATE ❌

auth.error_button  → ["auth", "error", "button"]
auth.error.btn     → ["auth", "error", "btn"]   ← NOT duplicate ✅ (different tokens)
```

---

## Specificity Rule

1. **The fewer segments you use, the more general and reusable the key.**
   This is intentional. Shared strings should live at the highest applicable level.
   ```
   common.done.button    → screen-level, shared across all login states
   ```

2. **Use lowercase, dot-separated only** — no camelCase, no snake_case, no spaces
   ```
   auth.otp.success.button
   ```

3. **Compound words & combined names**
   Multi-word values within a single segment use `snake_case` (`_`) as the only permitted separator. All letters are lowercase.
   ```
   ✓  call_protection
   ✓  family_group
   ✗  callProtection
   ✗  family.group
   ✗  family-group
   ```

---

## Segment Full Value List

### Element Segment
UI components that carry copy.

| Value | Description |
|---|---|
| `button` | Primary or secondary button |
| `input` | Text input field |
| `toggle` | On/off switch |
| `checkbox` | Checkbox item |
| `radio` | Radio button option |
| `dropdown` | Select / picker component |
| `card` | Content card |
| `modal` | Dialog or bottom sheet overlay |
| `sheet` | Bottom sheet specifically |
| `toast` | Transient snackbar message |
| `banner` | Persistent inline alert strip |
| `tooltip` | On-demand contextual hint |
| `badge` | Small status indicator label |
| `chip` | Selectable tag or filter item |
| `tab` | Tab bar item label |
| `nav` | Navigation bar item |
| `list` | List row item |
| `avatar` | User avatar label or fallback text |
| `progress` | Progress bar or step indicator label |
| `stepper` | Step counter label (e.g. Step 1 of 3) |
| `empty` | Empty state container |
| `header` | Screen or section header |
| `footer` | Screen or section footer |
| `section` | Named section within a screen |
| `link` | Inline tappable text link |
| `notification` | Push notification |

### Type Segment
The copy role within an element.

| Value | Description | Example copy |
|---|---|---|
| `title` | Primary heading of a screen or component | "Verify phone number" |
| `subtitle` | Supporting line under a title | "Enter your phone number to continue" |
| `subheading` | Section's title | "1. Data to be deleted" |
| `description` | Descriptive paragraph or body copy | "Open Settings and finish the setup to get the code." |
| `placeholder` | Ghost text inside an input field | "Enter your email" |
| `hint` | Helper text below an input | "Use the email you registered with" |
| `label` | Field label above an input | "Email address" |
| `textlink` | Inline text link copy | "Learn more" |
| `loading` | Text shown during async loading | "Verifying..." |

---

## Examples

### From general → specific
```
auth.login.title
→ The main title of the login screen. Shared regardless of state.

auth.login.error.input.hint
→ The hint text inside the input field when login fails.

auth.login.email.input.placeholder
→ The placeholder inside the email input on the login screen.
```

### Across features
```
auth.signup.password.input.hint      → Password hint on the signup screen.
auth.otp.success.toast               → Toast after successful OTP entry.
settings.profile.email.label         → Field label for email in profile settings.
verification.request.warning.banner  → Banner copy for a warning state during a verification request.
```

### Shared / reusable strings (minimal segments)
```
common.done.button                   → used across all states
common.otp.error.invalidCode         → used across all otp states
```

---

## Descriptor (collision resolution)

### When to apply

Add a descriptor **only** when two or more UI elements on the same screen produce an identical key after all segments (`feature`, `screen`, `semantic`, `element`, `type`) have been correctly assigned, but the displayed text differs.

> **Important:** If a collision can be resolved by using a more precise `semantic` value, always prefer that first. The descriptor is a last-resort disambiguator, not a substitute for accurate semantic naming.

### Format

The descriptor is appended to the `type` segment using an underscore:

```
{feature}.[screen].{semantic}.[element].[type]_{descriptor}
```

### Descriptor rules

- Derived from the displayed text of the layer
- Lowercase only
- Remove all special characters (`/`, `.`, `(`, `)`, etc.)
- Replace spaces with `_`
- Keep it short and meaningful — trim common filler words if needed

### Examples

A notification settings screen has multiple section headers that are all structurally `settings.notification.section.title` — semantic, element, and type are genuinely identical:

```
settings.notification.section.title_email   → "Email Notifications"
settings.notification.section.title_push    → "Push Notifications"
settings.notification.section.title_sms     → "SMS Notifications"
```

A family dashboard with multiple stat labels that share the same structure:

```
home.family.stat.card.label_speed           → "Speed"
home.family.stat.card.label_heart_rate      → "Heart Rate"
home.family.stat.card.label_blood_pressure  → "Blood Pressure"
```

> Note: In this case `stat` is the semantic. This is different from `home.family.speed.card.label` — use the latter when each stat maps to a distinct screen section with its own semantic.

### Counter-example (do NOT use descriptor here)

```
✗ home.family.card.label_speed        ← wrong: "speed" is a valid semantic, not a descriptor
✓ home.family.speed.card.label        ← correct: distinct semantic, no collision
```
