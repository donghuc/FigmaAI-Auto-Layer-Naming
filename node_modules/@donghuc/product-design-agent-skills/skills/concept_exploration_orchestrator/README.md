# Concept Exploration Orchestrator

**ID:** `concept_exploration_orchestrator`
**Category:** Solution Architecture & Ideation

## Overview

The Concept Exploration Orchestrator is the **Stage 2** specialized skill of your design process. Its job is to prevent "Premature Convergent Thinking" by forcing the exploration of multiple, distinct solution directions before you define a single UX flow or UI.

It maps the interaction logic, system behavior, and edge cases for several concepts simultaneously, evaluating them against your core strategy and principles.

## Key Responsibilities

1. **Concept Triangulation**: Generates 3–5 distinct interaction concepts (e.g., proactive vs. reactive, passive vs. real-time).
2. **Interactive Model Mapping**: Defines how the system responds to user intent for each concept.
3. **Stress Testing**: Identifies failure scenarios and recovery paths for every explored route.
4. **Trade-off Evaluation**: Explicitly compares concepts across complexity, usability, and scalability.
5. **Strategic Handoff**: Prepares a consolidated brief to be fed into the **Product Spec Strategist**.

## When to Trigger

Trigger this skill **after** you have a framed problem but **before** you have a specific spec. Use it when:
- You have a clear goal but are unsure of the best interaction pattern.
- You want to compare a traditional "App-based" flow with a "Notification-based" or "AI-first" flow.
- You need to justify a design direction to stakeholders using a trade-off matrix.

## How to use in the Workflow

1. **Frame (Orchestrator)**: Define & validate the problem.
2. **Explore (Concept Exploration)**: **[Current Step]** Explore and select the best concept.
3. **Strategize (Strategist)**: Convert selection into detailed flows/checklist.
4. **Map (Spec Writer)**: Fetch Design System styles.
5. **Architect (Architect)**: Plan the specific screens.
6. **Build**: Generate/Code the UI.
7. **Audit/Guard**: Review and validate quality and strategy.

## Example Input

```json
{
  "skill": "concept_exploration_orchestrator",
  "inputs": {
    "problem_statement": "Users find it too slow to link a child's device during onboarding.",
    "strategy": "Privacy-first safety for low-income families",
    "principles": ["Trust", "Clarity", "Consent"]
  }
}
```
