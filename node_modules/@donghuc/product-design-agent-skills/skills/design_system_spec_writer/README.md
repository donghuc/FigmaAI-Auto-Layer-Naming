# Design System Spec Writer

**ID:** `design_system_spec_writer`
**Category:** Design Foundation

## Overview

The Design System Spec Writer is an agent skill that converts raw Figma design data into a cohesive UI Specification Guideline. It acts as the "bridge" between a visual designer's work in Figma and an AI's ability to generate code or review layouts.

By running this skill on a design system file, you create a dedicated document that defines the boundaries and rules for all future design and development work in the project.

> [!NOTE]
> This is the **only skill** in the package that requires a live connection to the Figma API or a Figma MCP server. All other skills in the workflow operate on the text-based guidelines produced by this skill.


## When to Trigger

Trigger this skill when:
- You are starting a new project and need to "import" a design system from Figma.
- The design system has been updated, and you need to refresh the AI's understanding of the tokens.
- You need to generate a formal implementation handoff document.

## Expected Output

The skill produces a Markdown artifact that includes:
- **Color Palettes**: Primary, Secondary, and Semantic tokens.
- **Typography Sets**: Font styles and hierarchy.
- **Component Dictionary**: List of available library components and their variants.
- **Layout Rules**: Spacing, Padding, and Grid logic.

## How to integrate with other skills

The output of this skill (the UI Spec Guideline) should be passed into the `design_system_rules` input of the **UX Strategy Guardian** to enable strict governance.
