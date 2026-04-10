# AINaming Agent — Usage Guide

A standalone Python script that replicates the full AINaming Figma plugin scanning and naming logic, designed to be invoked by a Product Agent or run from the command line.

## Requirements
- Python 3.8+. Zero dependencies (uses stdlib only).
- A **Figma Personal Access Token** to fetch file data.
- An **LLM API key** (OpenAI, Anthropic, or Deepseek).

## Basic Usage

```bash
# OpenAI
python ainaming_agent.py \
  --figma-url "https://www.figma.com/design/ABC123/MyFile?node-id=0-1" \
  --figma-token "figd_xxx" \
  --provider openai \
  --api-key "sk-xxx" \
  --feature "home" \
  --screen "dashboard"

# Deepseek
python ainaming_agent.py \
  --figma-url "https://www.figma.com/design/ABC123/MyFile" \
  --figma-token "figd_xxx" \
  --provider deepseek \
  --api-key "sk-xxx"

# Using env vars (recommended)
export FIGMA_TOKEN=figd_xxx
export AI_API_KEY=sk-xxx
python ainaming_agent.py --figma-url "..." --provider openai
```

## Arguments

| Flag | Required | Description |
|---|---|---|
| `--figma-url` | ✅ | Full Figma share or design URL |
| `--figma-token` | ✅ | Figma personal access token (or `FIGMA_TOKEN` env var) |
| `--provider` | ✅ | AI provider: `openai`, `anthropic`, `deepseek` |
| `--api-key` | ✅ | LLM API key (or `AI_API_KEY` env var) |
| `--feature` | optional | Feature context prefix (e.g. `home`) |
| `--screen` | optional | Screen context prefix (e.g. `dashboard`) |
| `--write` | optional | Flag to indicate intent to write-back to Figma |

## Scanning Rules Applied
All rules from `plugin_current_specs.md` are faithfully implemented:
- Hidden layers (self or ancestor) are skipped
- Locked layers (self or ancestor) are skipped  
- Layers already following `feature.screen.element.type` convention are reported as "Already Named"
- Common dictionary intercepts are applied before any AI call
- Dynamic text (e.g. `{{name}}`) is classified and skipped automatically
- Duplicate key collision mitigation is applied post-AI
- Hard limit of 150 text nodes enforced

## Write-Back Limitation
The **Figma REST API does not allow external scripts to write layer names** — this is a Figma platform constraint. The `--write` flag is accepted for future compatibility but will inform you to use the Figma Plugin instead.

To apply suggestions, use the **AINaming Figma Plugin** (`donghuc/FigmaAI-Auto-Layer-Naming`) running inside the Figma desktop app.
