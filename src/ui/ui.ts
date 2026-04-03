import { UIMessage, PluginMessage, Settings, LayerPayload, FrameInfo } from '../shared/messages';
import { validateKeyFormat, checkUniqueness } from './validator';
import { checkApiKey, runAIClassification, runAISuggestions, composeSuggestedKey } from './ai';

const app = document.getElementById('app')!;
let currentSettings: Settings | null = null;
let scanData: any = {
  unnamedLayers: [],
  namedLayers: [],
  hiddenLayerKeys: [],
  skippedLayers: [],
  groupedLayers: [],
  frames: [] as FrameInfo[],    // per-frame metadata from scan
  confirmedIds: new Set<string>(),
  duplicateIds: new Set(),
  stats: { written: 0, skipped: 0, dynamic: 0 }
};
let uiState: string = 'S5'; 

const SETTINGS_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2a1 1 0 0 1 .97.757l.524 2.094a7.03 7.03 0 0 1 1.734.716l1.89-1.134a1 1 0 0 1 1.22.153l1.414 1.414a1 1 0 0 1 .153 1.22l-1.134 1.89a7.03 7.03 0 0 1 .716 1.734l2.094.524a1 1 0 0 1 .757.97v2a1 1 0 0 1-.757.97l-2.094.524a7.03 7.03 0 0 1-.716 1.734l1.134 1.89a1 1 0 0 1-.153 1.22l-1.414 1.414a1 1 0 0 1-1.22.153l-1.89-1.134a7.03 7.03 0 0 1-1.734.716l-.524 2.094A1 1 0 0 1 12 22h-2a1 1 0 0 1-.97-.757l-.524-2.094a7.03 7.03 0 0 1-1.734-.716l-1.89 1.134a1 1 0 0 1-1.22-.153L2.248 17.9a1 1 0 0 1-.153-1.22l1.134-1.89a7.03 7.03 0 0 1-.716-1.734L.419 12.53A1 1 0 0 1-.338 12v-2a1 1 0 0 1 .757-.97l2.094-.524a7.03 7.03 0 0 1 .716-1.734L2.095 4.882a1 1 0 0 1 .153-1.22L3.662 2.248a1 1 0 0 1 1.22-.153l1.89 1.134a7.03 7.03 0 0 1 1.734-.716L9.03 0.419A1 1 0 0 1 10-.338h2ZM11 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="currentColor"/></svg>`;

function postMessage(msg: UIMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

window.onmessage = async (event) => {
  const msg = event.data.pluginMessage as PluginMessage;
  if (!msg) return;

  switch (msg.type) {
    case 'SETTINGS_LOADED':
      currentSettings = msg.settings;
      if (!currentSettings || !currentSettings.apiKey) switchScreen('S1');
      else switchScreen('S2'); // Go to home — do NOT auto-scan
      break;

    case 'SELECTION_CHANGED':
      // Ignore selection changes during active scans and result review
      if (['S1', 'S5', 'S6', 'S7', 'S8', 'S9'].includes(uiState)) return;
      if (!msg.hasSelection) switchScreen('S2');
      else {
        scanData.isFragment = msg.isFragment;
        scanData.fragments = msg.fragments;
        scanData.layerCount = msg.layerCount;
        // Show S3 (with Scan button) or S4 (fragment warning) — never auto-scan
        if (msg.isFragment) switchScreen('S4');
        else switchScreen('S3');
      }
      break;

    case 'SCAN_RESULT':
      scanData.unnamedLayers = msg.unnamedLayers;
      scanData.namedLayers = msg.namedLayers;
      scanData.hiddenLayerKeys = msg.hiddenLayerKeys;
      scanData.skippedLayers = msg.skippedLayers;
      scanData.frames = msg.frames;
      scanData.stats = { written: 0, skipped: scanData.skippedLayers.length, dynamic: 0 };

      if (scanData.unnamedLayers.length === 0 && scanData.namedLayers.length > 0) {
        switchScreen('S8');
      } else if (scanData.unnamedLayers.length === 0) {
        switchScreen('S2');
      } else {
        // Go to S3b for designer to confirm feature names per frame
        switchScreen('S3b');
      }
      break;

    case 'PROGRESS_UPDATE':
      const phase = document.getElementById('loading-phase');
      const prog = document.getElementById('loading-progress');
      if (phase) phase.innerText = msg.phase;
      if (prog) prog.innerText = msg.progress;
      break;

    case 'ERROR':
      renderErrorScreen('Error occurred', msg.message);
      break;

    case 'WRITE_CONFIRMED':
      scanData.stats.written++;
      scanData.confirmedIds.add(msg.nodeId);
      const row = document.getElementById(`row-${msg.nodeId}`);
      if (row) {
        row.classList.add('confirmed');
        const btn = row.querySelector('.confirm-btn') as HTMLButtonElement;
        if (btn) { btn.textContent = '✅'; btn.disabled = true; }
        const skipBtn = row.querySelector('.skip-btn') as HTMLButtonElement;
        if (skipBtn) skipBtn.disabled = true;
        
        // Show the ghost container if it exists
        const ghost = row.querySelector('.dict-ghost-container') as HTMLElement;
        if (ghost) ghost.style.display = 'block';
      }
      checkAllDone();
      break;
  }
};

async function processAI() {
  switchScreen('S5');
  const phaseEl = document.getElementById('loading-phase')!;
  
  try {
    phaseEl.innerText = "Classifying layers...";
    const needsAI = scanData.unnamedLayers.filter((l: any) => !l.isCommonMatch);
    
    if (needsAI.length > 0) {
      const classifications = await runAIClassification(needsAI, currentSettings!.provider, currentSettings!.apiKey);
      
      const layersMap = new Map();
      needsAI.forEach((l: any) => layersMap.set(l.nodeId, l));
      
      classifications.forEach((c: any) => {
        const id = c.nodeId || c.id;
        const layer = layersMap.get(id);
        if (layer) layer.classification = c.classification;
      });
    }

    const needsNaming = needsAI.filter((l: any) => l.classification === 'normal' || l.classification === 'partial');
    scanData.stats.dynamic = needsAI.length - needsNaming.length;
    
    if (needsNaming.length > 0) {
      phaseEl.innerText = "Suggesting keys...";
      const suggestions = await runAISuggestions(needsNaming, currentSettings!.provider, currentSettings!.apiKey);

      suggestions.forEach((s: any) => {
        const id = s.nodeId || s.id;
        const layer = needsNaming.find((n:any) => n.nodeId === id);
        if (layer) {
          layer.suggestedKey = composeSuggestedKey(layer, s);
        }
      });
    }

    // ── Descriptor resolution ────────────────────────────────────────────────
    // When two+ layers share an identical suggestedKey after AI naming,
    // append _descriptor (normalized from displayed text) to disambiguate.
    // Only applied as last resort — if semantic was correct, keys won't collide.
    const keyGroups = new Map<string, any[]>();
    scanData.unnamedLayers.forEach((l: any) => {
      if (!l.suggestedKey) return;
      if (!keyGroups.has(l.suggestedKey)) keyGroups.set(l.suggestedKey, []);
      keyGroups.get(l.suggestedKey)!.push(l);
    });
    keyGroups.forEach((group) => {
      if (group.length < 2) return; // no collision, leave as-is
      group.forEach((l: any) => {
        const descriptor = l.text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')   // remove special chars
          .trim()
          .replace(/\s+/g, '_')           // spaces → underscores
          .substring(0, 24);             // keep reasonable length
        if (descriptor) {
          l.suggestedKey = `${l.suggestedKey}_${descriptor}`;
        }
      });
    });
    // ─────────────────────────────────────────────────────────────────────────

    // Uniqueness & Grouping
    const aiKeys = scanData.unnamedLayers
       .filter((l: any) => l.suggestedKey)
       .map((l: any) => ({ nodeId: l.nodeId, key: l.suggestedKey }));
    
    scanData.duplicateIds = checkUniqueness(aiKeys, scanData.hiddenLayerKeys);
    
    // Grouping by content
    const groups = new Map();
    scanData.unnamedLayers.forEach((l: any) => {
       if (!groups.has(l.text)) groups.set(l.text, []);
       groups.get(l.text).push(l);
    });
    
    scanData.groupedLayers = [];
    groups.forEach((list, text) => {
       if (list.length > 1) {
          scanData.groupedLayers.push({ text, layers: list, isGroup: true, suggestedKey: list[0].suggestedKey, isCommonMatch: list[0].isCommonMatch });
       } else {
          scanData.groupedLayers.push({ ...list[0], isGroup: false });
       }
    });

    switchScreen('S6');
  } catch(e: any) {
    renderErrorScreen('AI Failure', e.message);
  }
}

function switchScreen(id: string) {
  uiState = id;
  app.innerHTML = renderScreen(id);
  attachListeners(id);
}

function renderScreen(id: string): string {
  const settingsBtn = `<button class="icon-btn" id="settings-btn">${SETTINGS_ICON}</button>`;
  const header = `<div class="header"><h1>✨ AINaming</h1>${settingsBtn}</div>`;

  switch(id) {
    case 'S1': {
      const backBtn = currentSettings
        ? '<button class="icon-btn" id="back-btn" title="Go back" style="font-size:18px; line-height:1; color:var(--text-muted);">&#8592;</button>'
        : '<div style="width:28px;"></div>';
      return `
        <div class="header" style="justify-content:space-between;">
          ${backBtn}
          <h1>Settings</h1>
          <div style="width:28px;"></div>
        </div>
        <div class="container">
          <div class="card">
            <div class="card-title">API Configuration</div>
            <p class="card-meta">Connect your own API key to enable AI suggestions.</p>
            <div style="margin-top:16px;">
              <select id="provider" style="width:100%; padding:10px; background:#252525; border:1px solid var(--border-color); color:white; border-radius:6px; margin-bottom:12px;">
                <option value="openai" ${currentSettings?.provider === 'openai' ? 'selected' : ''}>OpenAI &mdash; GPT-4o</option>
                <option value="anthropic" ${currentSettings?.provider === 'anthropic' ? 'selected' : ''}>Anthropic &mdash; Claude</option>
                <option value="deepseek" ${currentSettings?.provider === 'deepseek' ? 'selected' : ''}>Deepseek</option>
              </select>
              <input type="password" id="api-key" placeholder="Paste API Key (sk-...)" value="${currentSettings?.apiKey || ''}" />
              <div id="api-error" style="color:var(--danger-color); font-size:10px; margin-top:8px; display:none;">Invalid key format</div>
            </div>
            <button id="save-btn" class="btn-primary" style="width:100%; margin-top:8px;" ${currentSettings?.apiKey ? '' : 'disabled'}>Verify &amp; Save</button>
            <p style="font-size:10px; color:var(--text-muted); text-align:center; margin-top:12px;">&#128274; Keys are stored locally on your machine.</p>
          </div>

          <div class="card" style="margin-top:16px;">
            <div class="card-title">COMMON KEY DICTIONARY</div>
            <p class="card-meta">Exact match text bypasses AI and uses these keys.</p>
            
            <table style="width:100%; font-size:11px; margin-top:12px; border-collapse: collapse;">
              <thead>
                <tr style="text-align:left; border-bottom:1px solid var(--border-color); color:var(--text-muted);">
                  <th style="padding-bottom:6px; width:45%;">Text (exact)</th>
                  <th style="padding-bottom:6px; width:50%;">Key</th>
                  <th style="padding-bottom:6px; width:5%;"></th>
                </tr>
              </thead>
              <tbody id="dict-table-body">
                ${currentSettings?.dictionary?.map((d: any, i: number) => `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:8px 0;">${d.text}</td>
                    <td style="padding:8px 0; font-family:var(--font-mono); color:var(--primary-color);">${d.key}</td>
                    <td style="padding:8px 0; text-align:right;">
                      <button class="icon-btn delete-dict-btn" data-idx="${i}" style="color:var(--danger-color); padding:0;">🗑</button>
                    </td>
                  </tr>
                `).join('') || `<tr><td colspan="3" style="padding:8px 0; color:var(--text-muted);">Empty</td></tr>`}
              </tbody>
            </table>

            <div style="display:flex; gap:8px; margin-top:12px; align-items:flex-start;">
              <div style="flex:1;"><input type="text" id="new-dict-text" placeholder="e.g. secure" style="padding:6px 8px; font-size:11px;"></div>
              <div style="flex:1;"><input type="text" id="new-dict-key" placeholder="common.secure.badge" style="padding:6px 8px; font-size:11px; font-family:var(--font-mono);"></div>
              <button id="add-dict-btn" class="btn-primary" style="padding:6px 10px;">Add</button>
            </div>
            <div id="dict-error" style="color:var(--danger-color); font-size:10px; margin-top:4px;"></div>
          </div>
          <div style="height:24px;"></div>
        </div>
      `;
    }
    case 'S2':
      return `${header}<div class="container full-height empty-state"><div style="font-size:40px; margin-bottom:16px;">🔍</div><h3>Ready to scan</h3><p>Select a frame or section in Figma to see layers.</p></div>`;
    case 'S3':
      return `
        ${header}
        <div class="container" style="gap:12px; flex-grow:0;">
          <div class="card">
             <div class="card-title">Selection detected</div>
             <p class="card-meta">${scanData.layerCount} text layers identified</p>
          </div>
          <button id="run-btn" class="btn-primary" style="width:100%; margin-top:4px;" ${!currentSettings ? 'disabled' : ''}>${currentSettings ? '▶ Run AI Naming' : 'Add API key in Settings to run'}</button>
        </div>
      `;
    case 'S3b': {
      const isSingleFrame = scanData.frames.length === 1;
      return `
        <div class="header">
          <button class="icon-btn" id="back-btn" style="font-size:18px; color:var(--text-muted);">&#8592;</button>
          <h1>${isSingleFrame ? 'Confirm feature' : 'Confirm frames'}</h1>
          <div style="width:28px;"></div>
        </div>
        <div class="container">
          <p style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">
            ${isSingleFrame
              ? 'Confirm the feature. Screen is optional. AI fills semantic, element, and type.'
              : 'Each frame may belong to a different feature. Confirm or edit below.'}
          </p>
          ${scanData.frames.map((f: FrameInfo) => `
            <div class="card" style="padding:12px;">
              <div class="card-title" style="font-size:11px; margin-bottom:8px;">&#128250; ${f.frameName}</div>
              <div style="display:flex; gap:8px;">
                <div style="flex:1;">
                  <div style="font-size:9px; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase; letter-spacing:.04em;">Feature <span style="color:var(--danger-color)">*</span></div>
                  <input type="text" class="feature-input" data-frame-id="${f.frameId}"
                    value="${f.suggestedFeature}" placeholder="e.g. home, auth, settings">
                </div>
                <div style="flex:1;">
                  <div style="font-size:9px; color:var(--text-muted); margin-bottom:4px; text-transform:uppercase; letter-spacing:.04em;">Screen <span style="color:var(--text-muted)">(opt.)</span></div>
                  <input type="text" class="screen-input" data-frame-id="${f.frameId}"
                    value="${f.suggestedScreen || ''}" placeholder="e.g. signin, feed">
                </div>
              </div>
            </div>
          `).join('')}
          <div style="background:rgba(24,160,251,0.08); border:1px solid rgba(24,160,251,0.2); border-radius:8px; padding:10px; margin-top:4px;">
            <p style="font-size:10px; color:var(--text-muted); line-height:1.6;">
              &#128274; Feature + screen are locked as prefix. AI only fills <b style="color:var(--text-color)">semantic &bull; element &bull; type</b>.
            </p>
          </div>
          <button id="run-ai-btn" class="btn-primary" style="width:100%; margin-top:8px;">&#9654; Run AI Naming</button>
        </div>
      `;
    }
    case 'S4':
      return `
        <div class="header"><h1>Fragments</h1></div>
        <div class="container">
           <div class="card" style="background: rgba(255,205,41,0.1); border-color: var(--warning-color);">
              <div class="card-title" style="color: var(--warning-color);">Heuristic Warning</div>
              <p style="font-size:11px;">Found ${scanData.fragments.length} frames that look like components. Scanning them might result in duplicate keys across the system.</p>
           </div>
           <button id="skip-run-btn" class="btn-primary" style="margin-bottom:8px">Skip Fragments & Run</button>
           <button id="scan-all-btn" class="btn-secondary">Scan Everything</button>
        </div>
      `;
    case 'S5':
      return `
        <div class="container full-height empty-state" style="justify-content:center;">
           <div class="loading-spinner"></div>
           <h3 id="loading-phase">Processing...</h3>
           <p id="loading-progress" style="margin-top:8px; color:var(--text-muted);"></p>
        </div>
      `;
    case 'S6':
      return renderReviewList();
    case 'S7':
      return `
        <div class="container full-height empty-state" style="justify-content:center; align-items:center;">
           <div style="font-size:48px; margin-bottom:12px;">✅</div>
           <h2 style="margin-bottom:20px;">Done!</h2>
           <div style="background:var(--surface-color); border:1px solid var(--border-color); border-radius:10px; padding:16px; width:200px; margin-bottom:24px;">
              <div style="display:flex; justify-content:space-between; padding: 4px 0; border-bottom:1px solid var(--border-color); margin-bottom:8px;"><span style="color:var(--text-muted)">Written</span> <b style="color:var(--success-color)">${scanData.stats.written}</b></div>
              <div style="display:flex; justify-content:space-between; padding: 4px 0; border-bottom:1px solid var(--border-color); margin-bottom:8px;"><span style="color:var(--text-muted)">Skipped</span> <b>${scanData.stats.skipped}</b></div>
              <div style="display:flex; justify-content:space-between; padding: 4px 0;"><span style="color:var(--text-muted)">Dynamic</span> <b>${scanData.stats.dynamic}</b></div>
           </div>
           <button class="btn-primary" id="reset-btn" style="width:200px;">Process another frame</button>
           <button class="btn-secondary" id="close-btn" style="width:200px; margin-top:8px;">Finish</button>
        </div>
      `;

    case 'S8':
      return `
         <style>
           .focusable-row:hover { background: rgba(255,255,255,0.05); }
           .item-row.confirmed { opacity: 0.6; border-color: rgba(27, 196, 125, 0.35); }
           .item-row.confirmed .confirm-btn, .item-row.confirmed .skip-btn { pointer-events: none; }
         </style>
         <div class="header"><h1>Review List</h1></div>
         <div class="container">
            <div class="card" style="background: rgba(27,196,125,0.1); border-color: var(--success-color);">
               <div class="card-title" style="color: var(--success-color);">All valid</div>
               <p style="font-size:11px;">All layers in this selection already follow the naming convention.</p>
            </div>
            <div class="section-header">Existing Keys</div>
            <div style="flex:1; overflow-y: auto;">
              ${scanData.namedLayers.map((l: any) => `
                <div class="item-row focusable-row" data-id="${l.nodeId}" style="cursor:pointer;">
                  <div class="row-top">
                    <div class="layer-name">${l.text}</div>
                    <div class="context-tag" style="font-size:9px; color:var(--text-muted);">Click to focus</div>
                  </div>
                  <div class="context-tag" style="font-family:monospace; font-size:10px; color:var(--primary-color); margin-top:2px;">${l.layerName}</div>
                </div>
              `).join('')}
            </div>
            <button class="btn-primary" id="reset-btn" style="margin-top:16px; width:100%;">Done</button>
         </div>
      `;
    default: return '';
  }
}

function renderReviewList() {
  const rows: string[] = [];
  const issues: any[] = [];
  const suggestions: any[] = [];
  
  scanData.groupedLayers.forEach((l: any) => {
     if (l.isGroup) {
       suggestions.push(l);
     } else {
       const err = scanData.duplicateIds.has(l.nodeId) ? 'Duplicate' : (l.suggestedKey ? validateKeyFormat(l.suggestedKey).error : null);
       if (err) { l.error = err; issues.push(l); }
       else suggestions.push(l);
     }
  });

  const renderRow = (l: any) => {
    if (l.isGroup) {
       return `
         <div class="item-row group-row">
            <div class="row-top">
               <div class="layer-name" style="color: var(--primary-color)">${l.text}</div>
               <div style="display:flex; gap:6px; align-items:center;">
                  ${l.isCommonMatch ? `<span class="badge common-badge" style="background:rgba(24,160,251,0.1); color:var(--primary-color); border-color:transparent;">🔵 Common</span>` : ''}
                  <div class="badge badge-grey group-expand-toggle" style="cursor:pointer; display:flex; align-items:center; gap:4px; user-select:none;">
                     ${l.layers.length} layers share this <span class="chevron" style="font-size:8px;">▼</span>
                  </div>
               </div>
            </div>
            <div class="group-expand-list" style="display:none; margin:8px 0; background:rgba(255,255,255,0.05); border-radius:4px; padding:8px;">
               ${l.layers.map((child:any) => `
                 <div class="group-child-row" data-id="${child.nodeId}" style="font-size:10px; color:var(--text-muted); padding:4px 0; cursor:pointer; display:flex; justify-content:space-between;">
                    <span style="font-family:var(--font-mono);">${child.parentComponentName || child.layerName}</span> 
                    <span style="opacity:0.5; margin-left:4px;">${child.frameName || ''}</span>
                 </div>
               `).join('')}
            </div>
            <div class="input-container">
               <input type="text" class="key-input group-input" value="${l.suggestedKey || ''}" placeholder="Key for all matching layers">
            </div>
            <div class="row-footer" style="flex-wrap:wrap;">
               <div style="flex:1;"></div>
               <button class="action-link group-confirm">Confirm all</button>
               <button class="action-link secondary group-skip">Skip all</button>
               ${l.suggestedKey && !l.isCommonMatch ? `
                 <div class="dict-ghost-container" style="width:100%; border-top:1px dashed var(--border-color); margin-top:8px; padding-top:8px; text-align:right; display:none;">
                   <button class="action-link secondary add-dict-ghost" data-text="${l.text.replace(/"/g, '&quot;')}" data-key="${l.suggestedKey}">+ Add "${l.text.length > 20 ? l.text.substring(0,20)+'...' : l.text}" &rarr; common.*</button>
                 </div>
               ` : ''}
            </div>
         </div>
       `;
    }
    
    const isDyn = l.classification === 'dynamic';
    const isConfirmed = scanData.confirmedIds.has(l.nodeId);
    return `
      <div class="item-row${isConfirmed ? ' confirmed' : ''}" id="row-${l.nodeId}" data-id="${l.nodeId}">
        <div class="row-top">
          <div class="layer-name">${l.text}</div>
          <div style="display:flex; gap:6px; align-items:center;">
             ${l.isCommonMatch ? `<span class="badge common-badge" style="background:rgba(24,160,251,0.1); color:var(--primary-color); border-color:transparent;">🔵 Common</span>` : ''}
             <div class="context-tag">${l.frameName || ''}</div>
          </div>
        </div>
        <div class="input-container">
          <input type="text" class="key-input" value="${l.suggestedKey || ''}" placeholder="${isDyn ? 'No key needed' : 'Suggested key'}" ${isConfirmed ? 'disabled' : ''}>
          <div style="margin-top:6px; display:flex; gap:6px;">
            ${l.error && !isConfirmed ? `<span class="badge badge-red">${l.error}</span>` : ''}
            ${isConfirmed ? `<span style="color:var(--success-color); font-size:10px;">✅ Applied</span>` : ''}
            ${isDyn && !isConfirmed ? `<span class="badge badge-grey">Dynamic</span>` : ''}
            ${l.classification === 'partial' && !isConfirmed ? `<span class="badge badge-orange">Partial</span>` : ''}
          </div>
        </div>
        <div class="row-footer" style="flex-wrap:wrap;">
           <div style="flex:1;"></div>
           <button class="action-link confirm-btn" ${isConfirmed || (!l.suggestedKey && !isDyn) ? 'disabled' : ''}>${isConfirmed ? '✅' : 'Confirm'}</button>
           <button class="action-link secondary skip-btn" ${isConfirmed ? 'disabled' : ''}>Skip</button>
           ${l.suggestedKey && !l.isCommonMatch ? `
             <div class="dict-ghost-container" style="width:100%; border-top:1px dashed var(--border-color); margin-top:8px; padding-top:8px; text-align:right; display:${isConfirmed ? 'block' : 'none'};">
               <button class="action-link secondary add-dict-ghost" data-text="${l.text.replace(/"/g, '&quot;')}" data-key="${l.suggestedKey}">+ Add "${l.text.length > 20 ? l.text.substring(0,20)+'...' : l.text}" &rarr; common.*</button>
             </div>
           ` : ''}
        </div>
      </div>
    `;
  };

  return `
    <div class="header"><h1>Review suggestions</h1> <span class="badge badge-grey" style="font-size:10px">${issues.length + suggestions.length} remaining</span></div>
    <div class="container" style="padding:0 16px 16px 16px;">
       ${issues.length > 0 ? `<div class="section-header">Critical Issues</div>${issues.map(renderRow).join('')}` : ''}
       <div class="section-header">Suggestions</div>
       ${suggestions.map(renderRow).join('')}
       
       <div class="section-header" style="cursor:pointer" id="toggle-skipped">🔘 Skipped (${scanData.skippedLayers.length})</div>
       <div id="skipped-list" style="display:none;">
          ${scanData.skippedLayers.map((l: any) => `
            <div class="item-row" style="opacity:0.6"><div class="row-top"><div class="layer-name">${l.text}</div><button class="action-link unskip-btn" data-id="${l.nodeId}">Unskip</button></div></div>
          `).join('')}
       </div>
    </div>
    <div class="footer-actions">
       <button class="btn-secondary" id="reset-btn">New Scan</button>
       <button class="btn-primary" id="finish-btn">Done</button>
    </div>
  `;
}

function renderErrorScreen(title: string, body: string) {
  uiState = 'S9';
  app.innerHTML = `
    <div class="container empty-state">
       <div style="font-size:48px; margin-bottom:16px;">⚠️</div>
       <h2 style="color:var(--danger-color)">${title}</h2>
       <p style="margin-top:8px">${body}</p>
       <button class="btn-primary" style="margin-top:32px" id="retry-btn">Back to Selection</button>
    </div>
  `;
  document.getElementById('retry-btn')?.addEventListener('click', () => switchScreen('S2'));
}

function attachListeners(id:string) {
  if (id === 'S1') {
    const pk = document.getElementById('provider') as HTMLSelectElement;
    const ak = document.getElementById('api-key') as HTMLInputElement;
    const sb = document.getElementById('save-btn') as HTMLButtonElement;
    const er = document.getElementById('api-error')!;

    // Initial load sync
    if (currentSettings && currentSettings.dictionary) {
      // already rendered in HTML
    } else if (currentSettings) {
      currentSettings.dictionary = [];
    }

    const validate = () => {
       const v = ak.value.trim();
       const isAnthropic = pk.value === 'anthropic';
       const ok = isAnthropic ? (v.startsWith('sk-ant-') && v.length > 20) : (v.startsWith('sk-') && v.length > 20);
       sb.disabled = !ok;
       er.style.display = (v && !ok) ? 'block' : 'none';
       if (v && !ok) er.innerText = 'Invalid key format for ' + (isAnthropic ? 'Anthropic' : 'OpenAI/Deepseek');
    };

    ak.addEventListener('input', validate);
    pk.addEventListener('change', validate);
    sb.addEventListener('click', async () => {
       sb.innerText = 'Verifying...';
       const ok = await checkApiKey(pk.value as any, ak.value);
       if (ok) {
         if (currentSettings) {
            currentSettings.apiKey = ak.value;
            currentSettings.provider = pk.value as any;
         } else {
            currentSettings = { apiKey: ak.value, provider: pk.value as any, dictionary: [] };
         }
         postMessage({ type: 'SAVE_SETTINGS', settings: currentSettings });
         // Return home rather than forcibly re-scanning, the user might not want to re-scan yet
         postMessage({ type: 'SCAN_REQUEST', scanAll: false });
       } else {
         sb.innerText = 'Verify & Save';
         er.innerText = 'Key verification failed.';
         er.style.display = 'block';
       }
    });

    // Dictionary Management
    const dictText = document.getElementById('new-dict-text') as HTMLInputElement;
    const dictKey = document.getElementById('new-dict-key') as HTMLInputElement;
    const addDictBtn = document.getElementById('add-dict-btn') as HTMLButtonElement;
    const dictErr = document.getElementById('dict-error')!;

    if (dictText && dictKey && addDictBtn) {
      addDictBtn.addEventListener('click', () => {
        const textVal = dictText.value.trim().toLowerCase();
        let keyVal = dictKey.value.trim().toLowerCase();
        
        dictErr.innerText = '';
        if (!textVal || !keyVal) return;
        
        if (!keyVal.startsWith('common.')) {
          dictErr.innerText = 'Dictionary keys must start with common.';
          return;
        }
        
        const validation = validateKeyFormat(keyVal);
        if (!validation.valid) {
          dictErr.innerText = validation.error!;
          return;
        }
        
        if (!currentSettings) currentSettings = { apiKey: '', provider: 'openai', dictionary: [] };
        if (!currentSettings.dictionary) currentSettings.dictionary = [];
        
        const existingIdx = currentSettings.dictionary.findIndex((d: any) => d.text === textVal);
        if (existingIdx !== -1) {
           dictErr.innerText = `This text is already mapped to ${currentSettings.dictionary[existingIdx].key}.`;
           return;
        }

        currentSettings.dictionary.push({ text: textVal, key: keyVal });
        // Save automatically and re-render S1 to show new row
        postMessage({ type: 'SAVE_SETTINGS', settings: currentSettings });
        switchScreen('S1');
      });
    }

    app.querySelectorAll('.delete-dict-btn').forEach((btn: any) => {
      btn.addEventListener('click', () => {
         const idx = parseInt(btn.getAttribute('data-idx')!, 10);
         if (currentSettings && currentSettings.dictionary) {
           currentSettings.dictionary.splice(idx, 1);
           postMessage({ type: 'SAVE_SETTINGS', settings: currentSettings });
           switchScreen('S1');
         }
      });
    });
  }

  // Back button — go back to S3 (selection ready) from S3b, or S2 from S1
  document.getElementById('back-btn')?.addEventListener('click', () => {
    if (uiState === 'S1') switchScreen(currentSettings ? 'S2' : 'S1');
    else if (uiState === 'S3b') switchScreen('S3');
    else switchScreen('S2');
  });

  document.getElementById('settings-btn')?.addEventListener('click', () => switchScreen('S1'));

  if (id === 'S3') {
    document.getElementById('run-btn')?.addEventListener('click', () => postMessage({ type: 'SCAN_REQUEST', scanAll: false }));
  }

  if (id === 'S3b') {
    document.getElementById('run-ai-btn')?.addEventListener('click', async () => {
      // Validate: all feature inputs must be non-empty
      const featureInputs = app.querySelectorAll('.feature-input') as NodeListOf<HTMLInputElement>;
      let hasBlank = false;
      featureInputs.forEach((el: HTMLInputElement) => {
        if (!el.value.trim()) {
          el.style.borderColor = 'var(--danger-color)';
          el.placeholder = 'Feature is required!';
          hasBlank = true;
        } else {
          el.style.borderColor = '';
        }
      });
      if (hasBlank) return;

      // Collect confirmed feature/screen per frameId from inputs
      const frameMap = new Map<string, { feature: string; screen: string | null }>();
      featureInputs.forEach((el: HTMLInputElement) => {
        const frameId = el.getAttribute('data-frame-id')!;
        const feature = el.value.trim().toLowerCase().replace(/\s+/g, '_');
        frameMap.set(frameId, { feature, screen: null });
      });
      app.querySelectorAll('.screen-input').forEach((el: any) => {
        const frameId = el.getAttribute('data-frame-id')!;
        const screen = el.value.trim().toLowerCase().replace(/\s+/g, '_') || null;
        const entry = frameMap.get(frameId);
        if (entry) entry.screen = screen;
      });

      // Enrich each unnamed layer with its frame's confirmed anchors
      scanData.unnamedLayers.forEach((l: any) => {
        const meta = l.frameId ? frameMap.get(l.frameId) : null;
        if (meta) {
          l.confirmedFeature = meta.feature;
          l.confirmedScreen = meta.screen;
        } else {
          // Fallback: use first frame's confirmed values
          const fallback = [...frameMap.values()][0];
          l.confirmedFeature = fallback?.feature || scanData.frames[0]?.suggestedFeature || 'unknown';
          l.confirmedScreen = fallback?.screen || null;
        }
      });

      await processAI();
    });
  }


  if (id === 'S4') {
    document.getElementById('skip-run-btn')?.addEventListener('click', () => postMessage({ type: 'SCAN_REQUEST', scanAll: false }));
    document.getElementById('scan-all-btn')?.addEventListener('click', () => postMessage({ type: 'SCAN_REQUEST', scanAll: true }));
  }

  if (id === 'S6') {
     // Focus layer on row click (but NOT when clicking inputs or buttons)
     app.querySelectorAll('.item-row, .group-row').forEach((row: any) => {
        row.addEventListener('click', (e: any) => {
           if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.group-child-row')) return;
           
           if (row.classList.contains('group-row')) {
              // For groups, focus first layer
              const labelEl = row.querySelector('.layer-name');
              const g = scanData.groupedLayers.find((group:any) => group.text === labelEl?.innerText);
              if (g && g.layers.length > 0) {
                 postMessage({ type: 'FOCUS_LAYER', nodeId: g.layers[0].nodeId });
              }
           } else {
              const nodeId = row.getAttribute('data-id');
              if (nodeId) postMessage({ type: 'FOCUS_LAYER', nodeId });
           }
        });
     });

     // Focus specific child in a group expand list
     app.querySelectorAll('.group-child-row').forEach((row: any) => {
        row.addEventListener('click', (e: any) => {
           e.stopPropagation();
           const nodeId = row.getAttribute('data-id');
           if (nodeId) postMessage({ type: 'FOCUS_LAYER', nodeId });
        });
     });

     app.querySelectorAll('.key-input').forEach((input: any) => {
       input.addEventListener('input', () => {
          const row = input.closest('.item-row');
          const badge = row.querySelector('.common-badge');
          if (badge && !input.value.startsWith('common.')) {
            badge.style.display = 'none'; // hide if user breaks the common prefix
          } else if (badge) {
            badge.style.display = 'inline-block';
          }
       });
     });

     app.querySelectorAll('.confirm-btn').forEach((btn: any) => {
       btn.addEventListener('click', () => {
          const row = btn.closest('.item-row');
          const id = row.getAttribute('data-id');
          const val = row.querySelector('input').value;
          if (id) postMessage({ type: 'WRITE_KEY', nodeId: id, key: val });
       });
     });

     app.querySelectorAll('.add-dict-ghost').forEach((btn: any) => {
       btn.addEventListener('click', () => {
          const container = btn.closest('.dict-ghost-container');
          const text = btn.getAttribute('data-text')!.toLowerCase().trim();
          let suggested = btn.getAttribute('data-key')!;
          
          const parts = suggested.split('.');
          if (parts.length > 1) {
             parts[0] = 'common';
             suggested = parts.join('.');
          } else {
             suggested = 'common.' + suggested;
          }

          container.innerHTML = `
            <div style="display:flex; gap:4px; align-items:center; width:100%;">
               <span style="font-size:10px; color:var(--text-muted);">Text: <b>${text}</b> &rarr;</span>
               <input type="text" class="inline-dict-key-input" value="${suggested}" style="flex:1; padding:4px 6px; font-size:10px; font-family:var(--font-mono); border:1px solid var(--border-color); border-radius:4px; background:#2A2A2A; color:white;">
               <button class="action-link confirm-inline-dict" style="color:var(--success-color);">Save</button>
            </div>
            <div class="inline-dict-err" style="color:var(--danger-color); font-size:9px; text-align:left; margin-top:4px;"></div>
          `;

          container.querySelector('.confirm-inline-dict').addEventListener('click', () => {
             const keyVal = container.querySelector('.inline-dict-key-input').value.trim().toLowerCase();
             const errEl = container.querySelector('.inline-dict-err');
             if (!keyVal.startsWith('common.')) {
               errEl.innerText = 'Must start with common.';
               return;
             }
             const validation = validateKeyFormat(keyVal);
             if (!validation.valid) {
               errEl.innerText = validation.error;
               return;
             }
             postMessage({ type: 'ADD_DICTIONARY_ENTRY', entry: { text, key: keyVal } });
             container.innerHTML = `<span style="color:var(--success-color); font-size:10px;">✅ Added to dictionary</span>`;
             
             // Also add it locally to settings so S1 reflects it
             if (currentSettings) {
                if (!currentSettings.dictionary) currentSettings.dictionary = [];
                const idx = currentSettings.dictionary.findIndex((d:any) => d.text === text);
                if (idx > -1) currentSettings.dictionary[idx] = { text, key: keyVal };
                else currentSettings.dictionary.push({ text, key: keyVal });
             }
          });
       });
     });

     app.querySelectorAll('.skip-btn').forEach((btn: any) => {
       btn.addEventListener('click', () => {
          const row = btn.closest('.item-row') as HTMLElement;
          const id = row?.getAttribute('data-id');
          if (!id) return;

          scanData.stats.skipped++;
          postMessage({ type: 'SKIP_LAYER', nodeId: id });

          // Update data model
          const idx = scanData.groupedLayers.findIndex((l: any) => !l.isGroup && l.nodeId === id);
          if (idx > -1) {
            const [moved] = scanData.groupedLayers.splice(idx, 1);
            scanData.skippedLayers.push(moved);
          }

          // ── In-place DOM update (no scroll reset) ──────────────────────────
          // 1. Fade out and remove the row from its current position
          row.style.transition = 'opacity 0.2s ease';
          row.style.opacity = '0';
          setTimeout(() => row.remove(), 200);

          // 2. Append a compact skipped row to the skipped list (create if collapsed)
          const skippedList = document.getElementById('skipped-list');
          const layerData = scanData.skippedLayers[scanData.skippedLayers.length - 1];
          if (skippedList && layerData) {
            const skippedRow = document.createElement('div');
            skippedRow.className = 'item-row';
            skippedRow.style.opacity = '0.6';
            skippedRow.innerHTML = `
              <div class="row-top">
                <div class="layer-name">${layerData.text}</div>
                <button class="action-link unskip-btn" data-id="${id}">Unskip</button>
              </div>`;
            skippedList.appendChild(skippedRow);

            // Wire up the new unskip button immediately
            skippedRow.querySelector('.unskip-btn')?.addEventListener('click', () => {
              handleUnskip(id, skippedRow);
            });
          }

          // 3. Update the skipped section counter
          const toggle = document.getElementById('toggle-skipped');
          if (toggle) toggle.textContent = `🔘 Skipped (${scanData.skippedLayers.length})`;

          // 4. Auto-expand skipped list so user sees the moved item
          if (skippedList && skippedList.style.display === 'none') {
            skippedList.style.display = 'block';
          }

          checkAllDone();
       });
     });

     function handleUnskip(nodeId: string, rowEl: HTMLElement) {
       postMessage({ type: 'UNSKIP_LAYER', nodeId });

       const idx = scanData.skippedLayers.findIndex((l: any) => l.nodeId === nodeId);
       if (idx > -1) {
         const [moved] = scanData.skippedLayers.splice(idx, 1);
         moved.suggestedKey = '';
         scanData.groupedLayers.push({ ...moved, isGroup: false });
         scanData.stats.skipped = Math.max(0, scanData.stats.skipped - 1);
       }

       // Fade out the skipped row
       rowEl.style.transition = 'opacity 0.2s ease';
       rowEl.style.opacity = '0';
       setTimeout(() => {
         rowEl.remove();
         // Update counter
         const toggle = document.getElementById('toggle-skipped');
         if (toggle) toggle.textContent = `🔘 Skipped (${scanData.skippedLayers.length})`;
       }, 200);

       // Append a fresh suggestion row at the bottom of the suggestions section
       const layer = scanData.groupedLayers[scanData.groupedLayers.length - 1];
       const container = app.querySelector('.container');
       if (layer && container) {
         const newRow = document.createElement('div');
         newRow.className = 'item-row';
         newRow.id = `row-${layer.nodeId}`;
         newRow.setAttribute('data-id', layer.nodeId);
         newRow.style.cursor = 'pointer';
         newRow.style.opacity = '0';
         newRow.innerHTML = `
           <div class="row-top">
             <div class="layer-name">${layer.text}</div>
             <div class="context-tag">${layer.frameName || ''}</div>
           </div>
           <div class="input-container">
             <input type="text" class="key-input" value="" placeholder="Key needed">
           </div>
           <div class="row-footer">
             <button class="action-link confirm-btn" disabled>Confirm</button>
             <button class="action-link secondary skip-btn">Skip</button>
           </div>`;

         // Insert before the skipped section header
         const skippedHeader = document.getElementById('toggle-skipped');
         if (skippedHeader) {
           container.insertBefore(newRow, skippedHeader);
         } else {
           container.appendChild(newRow);
         }

         // Fade in
         requestAnimationFrame(() => {
           newRow.style.transition = 'opacity 0.2s ease';
           newRow.style.opacity = '1';
         });

         // Wire new skip button
         newRow.querySelector('.skip-btn')?.addEventListener('click', () => {
           const skipId = newRow.getAttribute('data-id')!;
           newRow.querySelector('.skip-btn')!.dispatchEvent(new Event('_internal_skip'));
         });
       }
     }

     app.querySelectorAll('.unskip-btn').forEach((btn: any) => {
        btn.addEventListener('click', () => {
           const nodeId = btn.getAttribute('data-id')!;
           handleUnskip(nodeId, btn.closest('.item-row') as HTMLElement);
        });
     });

     document.getElementById('toggle-skipped')?.addEventListener('click', () => {
        const list = document.getElementById('skipped-list')!;
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
     });

     app.querySelectorAll('.group-expand-toggle').forEach((toggle: any) => {
        toggle.addEventListener('click', (e: any) => {
           e.stopPropagation();
           const row = toggle.closest('.group-row');
           const list = row.querySelector('.group-expand-list') as HTMLElement;
           const chevron = toggle.querySelector('.chevron') as HTMLElement;
           if (list.style.display === 'none') {
             list.style.display = 'block';
             chevron.innerText = '▲';
           } else {
             list.style.display = 'none';
             chevron.innerText = '▼';
           }
        });
     });

     app.querySelectorAll('.group-confirm').forEach((btn: any) => {
        btn.addEventListener('click', () => {
           const row = btn.closest('.group-row');
           const val = row.querySelector('input').value;
           const g = scanData.groupedLayers.find((group:any) => group.text === row.querySelector('.layer-name').innerText);
           if (g && val) {
              g.layers.forEach((l:any) => postMessage({ type: 'WRITE_KEY', nodeId: l.nodeId, key: val }));
              
              const input = row.querySelector('input') as HTMLInputElement;
              if (input) input.disabled = true;
              
              btn.innerText = 'Confirmed All';
              btn.disabled = true;
              
              const skipBtn = row.querySelector('.group-skip') as HTMLButtonElement;
              if (skipBtn) skipBtn.disabled = true;
              
              const ghost = row.querySelector('.dict-ghost-container') as HTMLElement;
              if (ghost) ghost.style.display = 'block';
           }
        });
     });

     app.querySelectorAll('.group-skip').forEach((btn: any) => {
        btn.addEventListener('click', () => {
           const row = btn.closest('.group-row') as HTMLElement;
           const nameEl = row.querySelector('.layer-name') as HTMLElement;
           const g = scanData.groupedLayers.find((group:any) => group.text === nameEl.innerText);
           if (g) {
              g.layers.forEach((l:any) => {
                 scanData.stats.skipped++;
                 postMessage({ type: 'SKIP_LAYER', nodeId: l.nodeId });
              });

              // Apply fade out animation just like individual items
              row.style.transition = 'opacity 0.2s ease';
              row.style.opacity = '0';
              setTimeout(() => {
                 row.remove();
                 scanData.skippedLayers.push(g);
                 
                 const skippedList = document.getElementById('skipped-list');
                 if (skippedList) {
                    const skippedRow = document.createElement('div');
                    skippedRow.className = 'item-row';
                    skippedRow.style.opacity = '0.6';
                    skippedRow.innerHTML = `
                      <div class="row-top">
                        <div class="layer-name">${g.text}</div>
                        <div class="badge badge-grey">${g.layers.length} layers</div>
                      </div>`;
                    skippedList.appendChild(skippedRow);
                 }
                 
                 const toggle = document.getElementById('toggle-skipped');
                 if (toggle) {
                    let totalSkipped = 0;
                    scanData.skippedLayers.forEach((item:any) => {
                       if (item.isGroup) totalSkipped += item.layers.length;
                       else totalSkipped += 1;
                    });
                    toggle.innerText = `🔘 Skipped (${totalSkipped})`;
                 }
              }, 200);
           }
        });
     });

     document.getElementById('reset-btn')?.addEventListener('click', () => {
        // New Scan: clear state and go back to home — user re-selects a frame
        scanData.confirmedIds = new Set();
        scanData.groupedLayers = [];
        scanData.skippedLayers = [];
        uiState = 'S2';
        switchScreen('S2');
     });
     document.getElementById('finish-btn')?.addEventListener('click', () => {
        const confirmedIds = scanData.confirmedIds as Set<string>;
        const skippedIds = new Set(scanData.skippedLayers.map((l: any) => l.nodeId));
        const pending = scanData.groupedLayers.filter((l: any) => {
          if (l.isGroup) return true;
          return !confirmedIds.has(l.nodeId) && !skippedIds.has(l.nodeId);
        });

        if (pending.length > 0) {
           if (confirm(`Apply ${pending.length} remaining suggestion(s) and finish?`)) {
             pending.forEach((l: any) => {
                if (l.isGroup) {
                  const groupInput = app.querySelector(`[data-group-text] input`) as HTMLInputElement;
                  if (groupInput?.value) l.layers.forEach((gl: any) => postMessage({ type: 'WRITE_KEY', nodeId: gl.nodeId, key: groupInput.value }));
                } else {
                  const input = app.querySelector(`#row-${l.nodeId} input`) as HTMLInputElement;
                  if (input?.value) postMessage({ type: 'WRITE_KEY', nodeId: l.nodeId, key: input.value });
                }
             });
             switchScreen('S7');
           }
        } else {
           switchScreen('S7');
        }
     });
  }

  if (id === 'S7' || id === 'S8') {
    // S8: focus layer on row click
    app.querySelectorAll('.focusable-row').forEach((row: any) => {
      row.addEventListener('click', (e: any) => {
        if (e.target.closest('button')) return;
        const nodeId = row.getAttribute('data-id');
        if (nodeId) postMessage({ type: 'FOCUS_LAYER', nodeId });
      });
    });
    document.getElementById('reset-btn')?.addEventListener('click', () => {
        uiState = 'S2';
        postMessage({ type: 'GET_SETTINGS' });
    });
    document.getElementById('close-btn')?.addEventListener('click', () => postMessage({ type: 'CLOSE_PLUGIN' }));
  }
}

function checkAllDone() {
  if (uiState !== 'S6') return;
  // Use data model: pending = groupedLayers that are neither confirmed nor skipped
  const confirmedIds = scanData.confirmedIds as Set<string>;
  const skippedIds = new Set(scanData.skippedLayers.map((l: any) => l.nodeId));
  const pending = scanData.groupedLayers.filter((l: any) => {
    if (l.isGroup) return true;
    return !confirmedIds.has(l.nodeId) && !skippedIds.has(l.nodeId);
  });
  if (pending.length === 0) switchScreen('S7');
}

setTimeout(() => postMessage({ type: 'GET_SETTINGS' }), 100);
