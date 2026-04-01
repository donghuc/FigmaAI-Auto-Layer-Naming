# Heuristic UI Auditor

**ID:** `heuristic_ui_auditor`
**Category:** Quality Assurance & Governance

## Overview

The Heuristic UI Auditor is a high-performance auditing skill that codifies the logic of the **Heuristic AI** Figma plugin. It acts as a Senior UX Specialist to find friction and accessibility failures before a design is handed off to production.

> [!TIP]
> This skill is based on the [Heuristic AI Figma Plugin](https://www.figma.com/community/plugin/1611243044519322138/ai-ux-audit-auto-review).

## Features

- **4-Pillar Analysis**: Simultaneously audits for Nielsen's Heuristics, WCAG 2.1 AA (Contrast/Touch Targets), Copy Clarity, and Visual Hierarchy.
- **Scoring Engine**: Provides a deterministic score from 0-100 based on weighted deductions.
- **Selective Audit**: Can be focused specifically on one pillar (e.g., "Only run Accessibility check").
- **Figma Context**: Understands the difference between local variables, instances, and semantic layer names.
- **Custom Focus**: Can be told to prioritize specific personas (e.g., "Audit for accessibility for color-blind users").

## Comparison: Heuristic UI Auditor vs. Generic AI

| Feature | Heuristic UI Auditor | Generic AI Prompt |
| :--- | :--- | :--- |
| **Logic** | Weighted Deduction Model | Subjective opinion |
| **Contrast** | Deterministic 4.5:1 ratio check | "Looks dark enough" |
| **Figma Awareness** | Targets Instances for Component fixes | Views everything as flat layers |
| **Governance** | Strict adherence to WCAG 2.1 | General design advice |

## Integration

Use this skill at the **end** of your design workflow:
1. **Spec Writer**: Map the foundations.
2. **Architect**: Build the UI.
3. **Auditor**: Run the Heuristic UI Auditor to find issues.
4. **Guardian**: Approve or Reject based on the Audit Score.

## Example Input

```json
{
  "skill": "heuristic_ui_auditor",
  "inputs": {
    "custom_focus": "Audit for accessibility for elderly users",
    "ruleset_filter": ["accessibility", "heuristic"]
  }
}
```
