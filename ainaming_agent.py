#!/usr/bin/env python3
"""
AINaming - Figma Layer Key Scanner & Suggester
Based on: docs/plugin_current_specs.md

Usage:
  python ainaming_agent.py --figma-url <figma_url> --provider openai --api-key sk-...
  python ainaming_agent.py --figma-url <figma_url> --provider openai --api-key sk-... --figma-token <figma_token>
  python ainaming_agent.py --figma-url <figma_url> --provider deepseek --api-key sk-... --figma-token <figma_token>
"""

import argparse
import json
import os
import re
import sys
import urllib.request
import urllib.error
from typing import Optional

# ──────────────────────────────────────────────────────────────────────────────
# COMMON DICTIONARY  (mirrors AINaming plugin's default dictionary)
# ──────────────────────────────────────────────────────────────────────────────
COMMON_DICTIONARY = [
    ("confirm", "common.confirm.button"),
    ("cancel", "common.cancel.button"),
    ("save", "common.save.button"),
    ("next", "common.next.button"),
    ("back", "common.back.button"),
    ("done", "common.done.button"),
    ("skip", "common.skip.action"),
    ("retry", "common.retry.button"),
    ("close", "common.close.button"),
    ("edit", "common.edit.button"),
    ("delete", "common.delete.button"),
    ("remove", "common.remove.button"),
    ("share", "common.share.button"),
    ("submit", "common.submit.button"),
    ("continue", "common.continue.button"),
    ("got it", "common.got_it.button"),
    ("add", "common.add.button"),
    ("create", "common.create.button"),
    ("update", "common.update.button"),
    ("clear", "common.clear.button"),
    ("reset", "common.reset.button"),
    ("apply", "common.apply.button"),
    ("dismiss", "common.dismiss.button"),
    ("try again", "common.try_again.button"),
    ("turn on", "common.turn_on.button"),
    ("turn off", "common.turn_off.button"),
    ("review", "common.review.button"),
    ("learn more", "common.learn_more.button"),
    ("view all", "common.view_all.button"),
    ("see details", "common.see_details.button"),
    ("show less", "common.show_less.button"),
    ("show more", "common.show_more.button"),
    ("accept", "common.accept.button"),
    ("decline", "common.decline.button"),
    ("allow", "common.allow.button"),
    ("sign in", "common.sign_in.button"),
    ("sign out", "common.sign_out.button"),
]

# ──────────────────────────────────────────────────────────────────────────────
# AI SYSTEM PROMPTS  (exact mirrors from src/ui/ai.ts)
# ──────────────────────────────────────────────────────────────────────────────
SYS_CLASSIFY = """You are a localization expert analyzing UI text layers in a Figma design.
Classify each layer as one of:
- "normal": Static UI copy needing a localization key (labels, buttons, headings, error messages)
- "partial": Mix of static template text AND runtime data (e.g. "Welcome, {name}" or "Last seen {time} ago")
- "dynamic": Entirely runtime values — no key needed (user names, counts, device names, timestamps)

Respond with JSON object: {"data": [{"nodeId": "...", "classification": "normal|partial|dynamic"}]}"""

SYS_SUGGEST = """You are a localization key naming expert.

The FEATURE and SCREEN segments of the key are already decided by the designer and provided per layer.
Do NOT change or ignore them. Your ONLY job is to suggest the remaining segments:
  semantic (REQUIRED) + element (optional) + type (optional)

Convention reminder: {feature}.[screen].{semantic}.[element].[type]

SEMANTIC values (the content or state):
  - States: success, error, warning, fail, loading, empty
  - Content: email, password, phone, otp, terms, privacy, name, permission, biometric
  - Or descriptive: speed, heart_rate, location_error, safe, title, subtitle, etc.

ELEMENT values (UI component type — use if clearly identifiable):
  button, input, tab, nav, card, modal, toast, banner, badge, chip, list,
  header, footer, section, link, toggle, label, avatar

TYPE values (copy role within the element — use if clearly identifiable):
  title, subtitle, description, placeholder, hint, label, textlink, loading

== SHARED STRING RULE ==
If the layer is inside a navigation bar, tab bar, or represents a shared action (Done, Cancel, Back, Save),
override the feature to "common" regardless of what the designer provided:
  common.tab.home  common.done.button  common.nav.back

== OUTPUT FORMAT ==
Return ONLY the suffix segments (not the full key). The prefix is prepended automatically.
Examples:
  Layer: "Speed", feature: "home" → suffix: "speed.card.label"
  Layer: "Home" (in tab bar) → suffix: "tab.home"  (override feature to common)
  Layer: "Cancel" (shared CTA) → suffix: "cancel"   (override feature to common)

Respond with JSON object:
{"data": [{"nodeId": "...", "suffix": "semantic or semantic.element or semantic.element.type", "overrideFeature": "common or null"}]}"""

# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────
KEY_PATTERN = re.compile(r'^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$')
DYNAMIC_PATTERN = re.compile(r'\{\{.+?\}\}|\[.+?\]|\{.+?\}')


def is_valid_key(name: str) -> bool:
    return bool(KEY_PATTERN.match(name))


def is_dynamic_text(text: str) -> bool:
    return bool(DYNAMIC_PATTERN.search(text))


def parse_figma_url(url: str):
    """Extract file key and optional node-id from Figma URL."""
    match = re.search(r'figma\.com/(?:file|design)/([a-zA-Z0-9]+)', url)
    if not match:
        raise ValueError(f"Cannot extract Figma file key from URL: {url}")
    file_key = match.group(1)
    node_id = re.search(r'node-id=([^&]+)', url)
    node_id = node_id.group(1).replace('-', ':') if node_id else None
    return file_key, node_id


def figma_get(path: str, token: str) -> dict:
    url = f"https://api.figma.com/v1/{path}"
    req = urllib.request.Request(url, headers={"X-Figma-Token": token})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def figma_put(file_key: str, token: str, node_id: str, new_name: str):
    """Rename a single node via the Figma REST API."""
    url = f"https://api.figma.com/v1/files/{file_key}/nodes"
    # Figma REST doesn't support direct rename; we use the Variables / PUT nodes endpoint.
    # NOTE: The Figma REST API currently does NOT support writing layer names from outside a plugin.
    # This requires the Figma Plugin API running inside the app.
    # We surface this info to the user and skip the write step.
    return False


def ai_call(payload_list: list, system_prompt: str, provider: str, api_key: str) -> list:
    """Send a batch to the LLM and return parsed results."""
    body = json.dumps(payload_list).encode()
    results = []

    CHUNK = 50
    for i in range(0, len(payload_list), CHUNK):
        chunk = payload_list[i:i + CHUNK]
        data_str = json.dumps(chunk)

        try:
            if provider in ('openai', 'deepseek'):
                base_url = (
                    'https://api.deepseek.com/chat/completions'
                    if provider == 'deepseek'
                    else 'https://api.openai.com/v1/chat/completions'
                )
                model = 'deepseek-chat' if provider == 'deepseek' else 'gpt-4o'
                req_body = json.dumps({
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": data_str}
                    ],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                }).encode()
                req = urllib.request.Request(
                    base_url,
                    data=req_body,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    method='POST'
                )
            else:  # anthropic
                req_body = json.dumps({
                    "model": "claude-3-5-sonnet-20240620",
                    "max_tokens": 2048,
                    "temperature": 0.1,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": data_str}]
                }).encode()
                req = urllib.request.Request(
                    'https://api.anthropic.com/v1/messages',
                    data=req_body,
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"
                    },
                    method='POST'
                )

            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read())
                if provider in ('openai', 'deepseek'):
                    content = data['choices'][0]['message']['content']
                else:
                    content = data['content'][0]['text']
                parsed = json.loads(content)
                rows = parsed.get('data', parsed) if isinstance(parsed, dict) else parsed
                results.extend(rows if isinstance(rows, list) else [rows])

        except Exception as e:
            print(f"  ⚠️  AI batch {i//CHUNK + 1} failed: {e}", file=sys.stderr)

    return results


def collect_text_nodes(node: dict, frame_name: str = None, result: list = None, locked_ancestor=False, hidden_ancestor=False):
    """Recursively collect qualifying TEXT nodes (mirrors isEffectivelyVisibleAndUnlocked)."""
    if result is None:
        result = []

    # Propagate hidden/locked state from ancestors
    node_hidden = hidden_ancestor or (not node.get('visible', True))
    node_locked = locked_ancestor or node.get('locked', False)

    if node_hidden or node_locked:
        # Still recurse (child might not be in affected branch)
        # Actually per plugin logic, if ancestor is locked/hidden, all children are skipped too
        return result

    node_type = node.get('type', '')
    name = node.get('name', '')

    # Track the top-level frame name for context
    current_frame = frame_name
    if node_type == 'FRAME' and frame_name is None:
        current_frame = name

    if node_type == 'TEXT':
        result.append({
            'nodeId': node.get('id'),
            'text': node.get('characters', ''),
            'layerName': name,
            'frameName': current_frame,
            'visible': node.get('visible', True),
            'locked': node.get('locked', False),
        })

    for child in node.get('children', []):
        collect_text_nodes(child, current_frame, result, node_locked, node_hidden)

    return result


def compose_suggested_key(layer: dict, suggestion: dict, feature: str, screen: Optional[str]) -> str:
    """Mirrors composeSuggestedKey from ai.ts."""
    suffix = (suggestion.get('suffix') or '').strip().lower()
    override = suggestion.get('overrideFeature')
    if override and override != 'null':
        return f"common.{suffix}"

    safe_feature = (feature or layer.get('frameName', 'unknown') or 'unknown').lower().replace(' ', '_')
    safe_screen = (screen or '').lower().replace(' ', '_')

    prefix = f"{safe_feature}.{safe_screen}" if (safe_screen and safe_screen != safe_feature) else safe_feature
    return f"{prefix}.{suffix}"


def dict_match(text: str) -> Optional[str]:
    t = text.strip().lower()
    for (k, v) in COMMON_DICTIONARY:
        if t == k:
            return v
    return None


def print_table(rows: list):
    if not rows:
        print("No suggestions generated.")
        return

    cols = ['#', 'Text', 'Layer Name', 'Frame', 'Suggested Key', 'Source']
    widths = [len(c) for c in cols]
    data = []
    for i, r in enumerate(rows, 1):
        row = [
            str(i),
            (r.get('text') or '')[:40],
            (r.get('layerName') or '')[:30],
            (r.get('frameName') or '')[:20],
            (r.get('suggestedKey') or '-')[:50],
            r.get('source', 'ai'),
        ]
        for j, cell in enumerate(row):
            widths[j] = max(widths[j], len(cell))
        data.append(row)

    sep = '+' + '+'.join('-' * (w + 2) for w in widths) + '+'
    def fmt_row(cells):
        return '|' + '|'.join(f' {c:<{widths[j]}} ' for j, c in enumerate(cells)) + '|'

    print(sep)
    print(fmt_row(cols))
    print(sep)
    for row in data:
        print(fmt_row(row))
    print(sep)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='AINaming Figma Layer Scanner')
    parser.add_argument('--figma-url',  required=True,  help='Full Figma share/design URL')
    parser.add_argument('--figma-token', default=os.environ.get('FIGMA_TOKEN'), help='Figma personal access token (or set FIGMA_TOKEN env var)')
    parser.add_argument('--provider',   default='openai', choices=['openai', 'anthropic', 'deepseek'])
    parser.add_argument('--api-key',    default=os.environ.get('AI_API_KEY'), help='LLM API key (or set AI_API_KEY env var)')
    parser.add_argument('--feature',    default=None, help='Feature context for key prefix (e.g. "home")')
    parser.add_argument('--screen',     default=None, help='Screen context for key prefix (e.g. "dashboard")')
    parser.add_argument('--write',      action='store_true', help='Write confirmed keys back to Figma (requires Figma token)')
    args = parser.parse_args()

    if not args.api_key:
        print("❌  AI API key required. Pass --api-key or set AI_API_KEY env var.")
        sys.exit(1)

    if not args.figma_token:
        print("⚠️  No Figma token provided. Will scan in read-only mode (no write-back possible).")

    print(f"\n🔍  Parsing Figma URL...")
    file_key, node_id = parse_figma_url(args.figma_url)
    print(f"   File key  : {file_key}")
    print(f"   Node ID   : {node_id or '(entire file)'}")

    if not args.figma_token:
        print("❌  Figma token required to fetch file data.")
        sys.exit(1)

    # ── Fetch file data ────────────────────────────────────────────────────────
    print(f"\n📥  Fetching Figma file data...")
    if node_id:
        data = figma_get(f"files/{file_key}/nodes?ids={node_id.replace(':', '-')}", args.figma_token)
        root_nodes = [n['document'] for n in data.get('nodes', {}).values()]
    else:
        data = figma_get(f"files/{file_key}", args.figma_token)
        root_nodes = data.get('document', {}).get('children', [])

    # ── Collect text nodes ─────────────────────────────────────────────────────
    print(f"\n🔎  Scanning text layers (applying visibility + lock rules)...")
    all_text = []
    for root in root_nodes:
        collect_text_nodes(root, None, all_text)

    # ── Classify into named / unnamed / dynamic ────────────────────────────────
    named_layers    = []  # already have valid localization keys
    unnamed_layers  = []  # need key suggestion
    dynamic_layers  = []  # runtime values, skip

    for node in all_text:
        text = node.get('text', '')
        name = node.get('layerName', '')

        if is_valid_key(name):
            named_layers.append(node)
            continue

        if is_dynamic_text(text):
            dynamic_layers.append(node)
            continue

        # Dictionary intercept
        matched_key = dict_match(text)
        if matched_key:
            node['suggestedKey'] = matched_key
            node['source'] = 'dictionary'
            unnamed_layers.append(node)
        else:
            node['source'] = 'ai'
            unnamed_layers.append(node)

    print(f"   ✅  Already named : {len(named_layers)}")
    print(f"   🗂  Needs naming  : {len(unnamed_layers)}")
    print(f"   ⚡  Dynamic       : {len(dynamic_layers)}")

    if len(unnamed_layers) > 150:
        print(f"\n❌  Too many layers ({len(unnamed_layers)}). Limit is 150. Narrow your Figma selection.")
        sys.exit(1)

    # ── AI: Classify ──────────────────────────────────────────────────────────
    needs_ai = [l for l in unnamed_layers if l.get('source') == 'ai']
    if needs_ai:
        print(f"\n🤖  Classifying {len(needs_ai)} layers via {args.provider}...")
        classify_payload = [{'nodeId': l['nodeId'], 'text': l['text'], 'frame': l.get('frameName')} for l in needs_ai]
        classifications = ai_call(classify_payload, SYS_CLASSIFY, args.provider, args.api_key)

        class_map = {c['nodeId']: c.get('classification', 'normal') for c in classifications}
        for layer in needs_ai:
            layer['classification'] = class_map.get(layer['nodeId'], 'normal')

    # ── AI: Suggest keys ────────────────────────────────────────────────────────
    needs_suggest = [l for l in needs_ai if l.get('classification') in ('normal', 'partial')]
    if needs_suggest:
        feature = args.feature or (needs_suggest[0].get('frameName') or 'unknown').lower().replace(' ', '_')
        screen  = args.screen

        print(f"\n💡  Generating key suggestions for {len(needs_suggest)} layers...")
        suggest_payload = [{
            'nodeId': l['nodeId'],
            'text': l['text'],
            'frameName': l.get('frameName'),
            'parentComponentName': '',
            'positionInHierarchy': '',
            'confirmedFeature': feature,
            'confirmedScreen': screen or '',
        } for l in needs_suggest]

        suggestions = ai_call(suggest_payload, SYS_SUGGEST, args.provider, args.api_key)
        sug_map = {s['nodeId']: s for s in suggestions}

        for layer in needs_suggest:
            sug = sug_map.get(layer['nodeId'])
            if sug:
                layer['suggestedKey'] = compose_suggested_key(layer, sug, feature, screen)

    # ── Collision detection ────────────────────────────────────────────────────
    key_counts: dict = {}
    for l in unnamed_layers:
        k = l.get('suggestedKey')
        if k:
            key_counts[k] = key_counts.get(k, 0) + 1

    for l in unnamed_layers:
        k = l.get('suggestedKey')
        if k and key_counts[k] > 1:
            descriptor = re.sub(r'[^a-z0-9\s]', '', l.get('text', '').lower()).strip().replace(' ', '_')[:24]
            if descriptor:
                l['suggestedKey'] = f"{k}_{descriptor}"

    # ── Build full results table ───────────────────────────────────────────────
    suggestion_rows = [l for l in unnamed_layers if l.get('suggestedKey')]
    skipped_rows    = [l for l in needs_ai if l.get('classification') == 'dynamic']

    print(f"\n{'═'*80}")
    print(f"  📋  SUGGESTION TABLE  ({len(suggestion_rows)} suggestions)")
    print(f"{'═'*80}\n")
    print_table(suggestion_rows)

    if named_layers:
        print(f"\n  ✓  Already valid keys ({len(named_layers)} layers):")
        for l in named_layers:
            print(f"     {l.get('layerName'):<40}  {l.get('text')[:40]}")

    if skipped_rows:
        print(f"\n  ⚡  Dynamic / skipped ({len(skipped_rows)} layers): no key needed")

    # ── Figma write-back ───────────────────────────────────────────────────────
    print(f"\n{'─'*80}")
    print("⚠️   WRITE-BACK NOTE:")
    print("    The Figma REST API does NOT support writing layer names from external scripts.")
    print("    To write key names back to Figma you must use the AINaming Figma Plugin")
    print("    (donghuc/FigmaAI-Auto-Layer-Naming) running inside the Figma desktop app.")

    if args.write:
        print("\n    --write flag detected but write-back is not supported via REST API.")
        print("    Please use the Figma plugin instead to apply these suggestions.")

    # ── Done ──────────────────────────────────────────────────────────────────
    print(f"\n{'═'*80}")
    print(f"  ✅  COMPLETE")
    print(f"     Written    : 0  (run via Figma Plugin to apply)")
    print(f"     Suggested  : {len(suggestion_rows)}")
    print(f"     Skipped    : {len(skipped_rows)}")
    print(f"     Dynamic    : {len(dynamic_layers)}")
    print(f"\n  🔗  Figma file: https://www.figma.com/file/{file_key}")
    print(f"{'═'*80}\n")


if __name__ == '__main__':
    main()
