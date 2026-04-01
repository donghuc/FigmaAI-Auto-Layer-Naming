# Product Spec Strategist

**ID:** `product_spec_strategist`
**Category:** Product Strategy & UX Architecture

## Overview

The Product Spec Strategist is the "Top-of-Funnel" logic engine for your design platform. Its job is to take raw, often messy product requirements and turn them into a rigorous, actionable design roadmap.

It ensures that designers and developers are never working from vague assumptions by clarifying intent, suggesting diverse UX routes, and spotting edge cases before a single pixel is moved.

## Key Responsibilities

1. **Clarification**: Probes the "Why" and "Who" of a feature request to remove ambiguity.
2. **Pathfinding**: Suggests three distinct UX flows (Happy Path, Power Path, and Guided Path) to explore different strategy directions.
3. **Safety & Robustness**: Maps out the "Gotchas," Empty States, and Error conditions required for a resilient product.
4. **Actionable Output**: Generates a ready-to-use checklist that can be fed into the **UI Design Architect**.

## When to Trigger

Trigger this skill **first**, before any UI generation or architecting. It is ideal for:
- Initial feature brainstorming.
- Converting user story briefs into technical/design tasks.
- Stress-testing a new product idea for edge cases.

## How to use in the Workflow

1. **Strategist**: Run this on your raw text spec to get a **Actionable Checklist**.
2. **Architect**: Pass the chosen UX flow from the checklist into the **UI Design Architect** to generate the actual screen prompt.
3. **Build**: Generate the UI.
4. **Audit/Guard**: Review and validate.

## Example Input

```json
{
  "skill": "product_spec_strategist",
  "inputs": {
    "raw_product_spec": "I want a way for users to add their family members to their safety circle via a link or email. It should be fast.",
    "target_platform": "Mobile"
  }
}
```
