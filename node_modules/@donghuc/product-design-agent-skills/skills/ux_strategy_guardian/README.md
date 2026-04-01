# UX Strategy Guardian (MCP-Enhanced)

**ID:** `ux_strategy_guardian`
**Category:** Design Governance & Node-Level Auditing

## Overview

The UX Strategy Guardian is the **Final Gatekeeper** of your design workflow. It acts as a strict validation and audit layer for all UI/UX work produced by other agents or designers. 

With the **MCP-Enhanced** upgrade, it can now perform high-fidelity auditing of actual Figma node structures, ensuring that components aren't just "right-looking" but are correctly implemented as instances, variants, and tokens.

## 🛠️ Dual-Mode Operation

### Mode 1: MCP Mode (High Fidelity)
*   **Trigger**: Use when you have a live Figma connection via MCP.
*   **Key Behavior**: Inspects actual node IDs to detect **detached instances**, **raw shape usage**, and **semantic variant mismatches**.
*   **Design System Awareness**: Automatically detects if a design system is present by inspecting library references and layer naming patterns.

### Mode 2: Non-MCP Mode (Heuristic Fallback)
*   **Trigger**: Use when only screenshots or descriptions are provided.
*   **Key Behavior**: Performs a heuristic "Best-Guess" review of hierarchy, usability, and logic.
*   **Constraint**: Clearly separates facts from assumptions and doesn't claim strict DS compliance.

---

## ⚡ When to Trigger

Trigger this skill at the **end** of your design cycle:
- To perform a **Design System Compliance Audit**.
- To review a **final UI proposal** against product strategy and principles.
- To detect **privacy risks** or usability friction before developer handoff.

## 🔄 How it fits the Workflow

1.  **Map**: Fetches tokens from the **Spec Writer**.
2.  **Architect**: Plans the build.
3.  **Build**: Generates the UI.
4.  **Audit**: Run the **Heuristic UI Auditor** for 0-100 scoring.
5.  **Govern (Guardian)**: **[Current Step]** Run the final MCP-Enhanced strategic review to approve or reject the build for production.

---

> [!IMPORTANT]
> The Guardian's output is a mandatory structured **Audit Report** ending with a clear **PASS/NEEDS FIX** status.
