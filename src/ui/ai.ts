import { LayerPayload } from '../shared/messages';

export async function checkApiKey(provider: string, apiKey: string): Promise<boolean> {
  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return res.status === 200;
    } else if (provider === 'deepseek') {
      // Bypassing fetch check for deepseek due to lack of CORS-enabled /models checking endpoint
      // The generation endpoint will naturally fail safely if the key is bad anyway.
      return true;
    } else {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'anthropic-dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({ model: 'claude-3-5-sonnet-20240620', max_tokens: 1, messages: [{ role: 'user', content: 'test' }] })
      });
      return res.status !== 401 && res.status !== 403;
    }
  } catch (e) {
    return false;
  }
}

const SYS_CLASSIFY = `You are a localization expert analyzing UI text layers in a Figma design.
Classify each layer as one of:
- "normal": Static UI copy needing a localization key (labels, buttons, headings, error messages)
- "partial": Mix of static template text AND runtime data (e.g. "Welcome, {name}" or "Last seen {time} ago")
- "dynamic": Entirely runtime values — no key needed (user names, counts, device names, timestamps)

Respond with JSON object: {"data": [{"nodeId": "...", "classification": "normal|partial|dynamic"}]}`;

// The feature and screen segments are LOCKED by the designer before this prompt runs.
// AI only needs to determine: semantic, element (optional), type (optional)
const SYS_SUGGEST = `You are a localization key naming expert.

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
{"data": [{"nodeId": "...", "suffix": "semantic" or "semantic.element" or "semantic.element.type", "overrideFeature": "common or null"}]}`;

export async function runAIClassification(layers: LayerPayload[], provider: string, apiKey: string) {
  return _runBatch(layers, provider, apiKey, SYS_CLASSIFY, (payload: any) => ({
    nodeId: payload.nodeId,
    text: payload.text,
    frame: payload.frameName
  }), 'Classifying layers');
}

export async function runAISuggestions(layers: LayerPayload[], provider: string, apiKey: string) {
  return _runBatch(layers, provider, apiKey, SYS_SUGGEST, (payload: any) => ({
    nodeId: payload.nodeId,
    text: payload.text,
    frameName: payload.frameName,
    parentComponentName: payload.parentComponentName,
    positionInHierarchy: payload.positionInHierarchy,
    // Anchors locked by designer — AI must not change these
    confirmedFeature: payload.confirmedFeature || 'unknown',
    confirmedScreen: payload.confirmedScreen || null
  }), 'Suggesting keys');
}

async function _runBatch(layers: LayerPayload[], provider: string, apiKey: string, sysPrompt: string, mapper: any, phaseLabel: string) {
  const results: any[] = [];
  const chunkSize = 50;

  for (let i = 0; i < layers.length; i += chunkSize) {
    const chunk = layers.slice(i, i + chunkSize);
    const payload = JSON.stringify(chunk.map(mapper));
    
    // Notify UI of batch progress
    const batchNum = Math.floor(i / chunkSize) + 1;
    const totalBatches = Math.ceil(layers.length / chunkSize);
    parent.postMessage({ pluginMessage: { 
      type: 'PROGRESS_UPDATE', 
      phase: phaseLabel, 
      progress: `Batch ${batchNum} of ${totalBatches}` 
    }}, '*');

    try {
      if (provider === 'openai' || provider === 'deepseek') {
        const baseUrl = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
        const modelName = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o';
        
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: payload }],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          })
        });

        if (!res.ok) throw new Error(res.status + '');
        const data = await res.json();
        const contentStr = data.choices[0].message.content;
        results.push(..._flexibleParse(contentStr));
      } else {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
            'anthropic-dangerously-allow-browser': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 2048,
            temperature: 0.1,
            system: sysPrompt,
            messages: [{ role: 'user', content: payload }]
          })
        });

        if (!res.ok) throw new Error(res.status + '');
        const data = await res.json();
        const contentStr = data.content?.[0]?.text || '[]';
        results.push(..._flexibleParse(contentStr));
      }
    } catch (e: any) {
       console.error("AI call failed", e);
       throw e;
    }
  }

  return results;
}

function _flexibleParse(str: string): any[] {
  try {
    let parsed = JSON.parse(str);
    if (!Array.isArray(parsed)) {
      if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
      const keys = Object.keys(parsed);
      for (const k of keys) {
        if (Array.isArray(parsed[k])) return parsed[k];
      }
      return [parsed];
    }
    return parsed;
  } catch(e) {
    const match = str.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch(e2) {}
    }
    throw new Error('AI JSON parsing failed');
  }
}

// After AI returns suffix only, compose the full key:
// prefix = confirmedFeature + (confirmedScreen if different from feature)
// If AI signals overrideFeature='common', use 'common' instead
export function composeSuggestedKey(layer: LayerPayload, suggestion: any): string {
  const suffix = (suggestion.suffix || suggestion.suggestedKey || '').trim().toLowerCase();
  const overrideFeature = suggestion.overrideFeature && suggestion.overrideFeature !== 'null' ? suggestion.overrideFeature : null;

  if (overrideFeature === 'common') {
    return `common.${suffix}`;
  }

  // Feature is REQUIRED. Screen is OPTIONAL between feature and suffix.
  // Convention: {feature}.[screen].{semantic}.[element].[type]
  const feature = (layer.confirmedFeature || '').trim().toLowerCase();
  const screen  = (layer.confirmedScreen  || '').trim().toLowerCase();

  // Guard: feature must never be empty — fall back to frame name if cleared
  const safeFeature = feature || (layer.frameName || 'unknown').toLowerCase().replace(/\s+/g, '_');

  const prefix = (screen && screen !== safeFeature)
    ? `${safeFeature}.${screen}`
    : safeFeature;

  return `${prefix}.${suffix}`;
}
