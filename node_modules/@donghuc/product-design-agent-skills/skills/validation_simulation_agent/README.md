# Validation & Simulation Agent

**ID:** `validation_simulation_agent`
**Category:** Solution Architecture & UX Validation

## Overview

The Validation & Simulation Agent is the **Final Stage** specialized skill of your design process. Its job is to provide a rigorous, persona-driven "Stress Test" of your UX before any code is written.

It helps teams identify usability issues, edge case failures, and misalignment with UX principles by simulating how different personas (impatient, low-skill, first-time) would actually move through the proposed flow.

---

## 🛠️ Key Responsibilities

1. **User Simulation**: Switches between multiple personas (Impatient, Confused, Pro user) to find friction points that a general audit might miss.
2. **Scenario Stress Testing**: Explicitly tests for **Failure Gaps** (Happy Path vs. Error Input vs. Network Fail).
3. **Step-by-Step Walkthrough**: Maps "What the user SEES" vs "What the user THINKS" to identify cognitive load spikes.
4. **Readiness Decision**: Provides the final binary decision: **READY** or **NEEDS ITERATION**.

---

## 🏁 When to Trigger

Trigger this skill **at the very end** of your design cycle, after you have an architected UI or built prototype. Use it when:
- You want a "Fast Validation" without running a real user study.
- You want to ensure your flow is robust against edge cases and errors.
- You need a final usability score before handing off to development.

---

## 🔄 How it fits the Workflow

1.  **Frame**: Define the problem.
2.  **Explore**: Ideate concepts.
3.  **Strategize**: Plan the flow.
4.  **Map**: Fetch styles.
5.  **Architect**: Design the screen.
6.  **Build**: Generate the UI.
7.  **Audit**: Perform a heuristic check.
8.  **Validation (Simulation Agent)**: **[Current Step]** Run the final stress test and behavioral simulation.

---

> [!TIP]
> Use **MCP Mode** with this skill to let the agent actually "walk through" your Figma connections and detect missing transitions across screens.
