# UI Design Architect (Adaptive Mode)

**ID:** `ui_design_architect`
**Category:** Design Implementation & Prototyping

## Overview

The UI Design Architect is the **Synthesizer** of the design workflow. It bridges the gap between high-level strategy and implementation-ready plans. 

With the **Adaptive Mode** upgrade, it now supports two distinct phases of the product design cycle: **Phase 3 Rapid Prototyping** (Exploration) and **Phase 4 Spec-Compliant Design** (Production).

## 🛠️ Dual-Mode Logic

### Mode 1: Rapid Prototyping (Phase 3)
*   **Purpose**: Speed and iteration over polish. 
*   **Key Behavior**: Generates 2-3 layout variations and maps essential interaction states (Loading, Error, Empty, Success). 
*   **Constraint**: Relaxed design system enforcement to allow for structural innovation.

### Mode 2: Spec-Compliant Design (Phase 4)
*   **Purpose**: Design system alignment and production-readiness.
*   **Key Behavior**: Strict token mapping to the `ui_spec_guideline`. 
*   **Constraint**: 100% adherence to defined typography, colors, and layout tokens.

---

## ⚡ When to Trigger

Trigger this skill when you are ready to:
- Move from a UX flow into **Screen Layouts**.
- Explore different **Structural variations** for a complex feature.
- Generate a high-fidelity **Stitch** or **V0** prompt that is already strategy-aligned.

## 🔄 How it fits the Workflow

1.  **Strategize**: Get your flows from the **Product Spec Strategist**.
2.  **Architect (Prototyping Mode)**: Plan the screen structure and interaction states.
3.  **Architect (Spec Mode)**: Skin those screens with your design system.
4.  **Build**: Use the output prompt in **Stitch**.
5.  **Audit**: Review your result with the **Heuristic UI Auditor**.

---

> [!TIP]
> Use **Prototyping Mode** during the first few iterations of a new feature to define the "Bones" of the screen before worrying about the "Skin" (Design System).
