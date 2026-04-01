# Problem Framing Orchestrator

**ID:** `problem_framing_orchestrator`
**Category:** Discovery & Research Architecture

## Overview

The Problem Framing Orchestrator is the **Absolute Step 0** of your design process. Before you write a spec, before you import a design system, and before you generate a UI, you must define the **"Why"** and the **"Who."**

Unlike other skills that are "one-shot" generators, the Orchestrator is an **interactive workflow agent**. It guides you through a multi-stage process of problem definition, user context, and success metrics, ensuring your product has a rigorous logical foundation.

## Key Responsibilities

1. **Structured Discovery**: Guides you through 7 mandatory stages:
   - [ ] Problem Definition
   - [ ] Users & Context
   - [ ] Current State & Pain Points
   - [ ] Desired Outcomes
   - [ ] Solution Directions (high-level only)
   - [ ] Principles & Privacy Validation
   - [ ] Scope Definition (MVP vs later)
2. **Interactive Clarification**: It will *not* proceed until you've answered critical questions. It challenges vague thinking and highlights hidden assumptions.
3. **Strategic Alignment**: Directly incorporates your **Product Strategy** and **Privacy Constraints** into every decision.

## When to Trigger

Trigger this skill **at the very beginning** of a new feature or product. Use it when:
- You have a vague idea but no clear roadmap.
- You need to defend the "Why" to stakeholders.
- You want to ensure accessibility and privacy are considered from the start.

## How to use in the Workflow

1. **Frame (Orchestrator)**: Define & validate the problem.
2. **Strategize (Strategist)**: Convert findings into 3 UX flows/Checklist.
3. **Map (Spec Writer)**: Fetch Design System styles.
4. **Architect (Architect)**: Plan the specific screens.
5. **Build**: Generate/Code the UI.
6. **Audit/Guard**: Review and validate quality and strategy.

## Interaction Example

```json
{
  "skill": "problem_framing_orchestrator",
  "inputs": {
    "initial_idea": "I want to add a family tracking feature to SafeNest",
    "project_foundation": {
      "strategy": "Privacy-first safety for low-income families",
      "principles": ["Trust", "Clarity", "Consent"]
    }
  }
}
```
