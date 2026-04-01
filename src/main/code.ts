/// <reference types="@figma/plugin-typings" />
import type { UIMessage, PluginMessage, LayerPayload, FrameInfo, Settings } from '../shared/messages';

figma.showUI(__html__, { width: 380, height: 600, themeColors: true });

function isValidKey(name: string): boolean {
  return /^[a-z0-9_]+\.[a-z0-9_]+/.test(name);
}

// Normalize a Figma frame name into a feature/screen suggestion
function normalizeFrameName(name: string): { feature: string; screen: string | null } {
  let clean = name.toLowerCase()
    .replace(/\s*[-–—/|]\s*/g, ' ')   // split on common separators
    .replace(/\b(v\d+|final|copy|backup|old|new|wip|draft|\d+)\b/g, '') // strip version markers
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

  const parts = clean.split(' ').filter(Boolean);
  if (parts.length === 0) return { feature: 'unknown', screen: null };
  if (parts.length === 1) return { feature: parts[0], screen: null };

  const feature = parts[0];
  const screen = parts.slice(1).join('_');
  return { feature, screen: screen || null };
}

// Check if a node is effectively visible (all ancestors visible)
function isEffectivelyVisible(node: SceneNode): boolean {
  let curr: BaseNode | null = node;
  while (curr && curr.type !== 'PAGE') {
    if ('visible' in curr && !curr.visible) return false;
    curr = curr.parent;
  }
  return true;
}

figma.ui.onmessage = async (msg: UIMessage) => {
  if (msg.type === 'GET_SETTINGS') {
    const apiKey = await figma.clientStorage.getAsync('apiKey') || '';
    const provider = await figma.clientStorage.getAsync('provider') || 'openai';
    const rawDict = figma.root.getPluginData('common_dictionary');
    const dictionary = rawDict ? JSON.parse(rawDict) : [
      { text: "done",       key: "common.done.button" },
      { text: "cancel",     key: "common.cancel.button" },
      { text: "back",       key: "common.back.button" },
      { text: "ok",         key: "common.ok.button" },
      { text: "close",      key: "common.close.button" }
    ];
    
    // If no API key, still send dictionary for UI state if needed, but the original logic returns null for settings.
    // We'll return an empty api key but valid provider/dict instead of null, so dictionary is available even if API isn't set up.
    // Wait, let's keep it backward compatible: return settings object if apiKey exists OR we always return settings object now.
    // The UI handles null as "show settings", so we should return settings if apiKey is valid. But what if they just open settings? 
    // Actually, UI handles `settings === null` by forcing state 'S1'. 
    // It's better to always return the object and let the UI check apiKey.
    figma.ui.postMessage({
      type: 'SETTINGS_LOADED',
      settings: apiKey ? { apiKey, provider, dictionary } : { apiKey: '', provider, dictionary }
    });
  }
  
  else if (msg.type === 'SAVE_SETTINGS') {
    await figma.clientStorage.setAsync('apiKey', msg.settings.apiKey);
    await figma.clientStorage.setAsync('provider', msg.settings.provider);
    if (msg.settings.dictionary) {
      figma.root.setPluginData('common_dictionary', JSON.stringify(msg.settings.dictionary));
    }
  }

  else if (msg.type === 'ADD_DICTIONARY_ENTRY') {
    const rawDict = figma.root.getPluginData('common_dictionary');
    const dictionary = rawDict ? JSON.parse(rawDict) : [
      { text: "done",       key: "common.done.button" },
      { text: "cancel",     key: "common.cancel.button" },
      { text: "back",       key: "common.back.button" },
      { text: "ok",         key: "common.ok.button" },
      { text: "close",      key: "common.close.button" }
    ];
    
    const idx = dictionary.findIndex((e: any) => e.text === msg.entry.text);
    if (idx >= 0) {
      dictionary[idx] = msg.entry;
    } else {
      dictionary.push(msg.entry);
    }
    figma.root.setPluginData('common_dictionary', JSON.stringify(dictionary));
  }
  
  else if (msg.type === 'WRITE_KEY') {
    const node = figma.getNodeById(msg.nodeId) as SceneNode;
    if (node) {
      node.name = msg.key;
      figma.ui.postMessage({ type: 'WRITE_CONFIRMED', nodeId: msg.nodeId });
    }
  }
  
  else if (msg.type === 'SKIP_LAYER') {
    const node = figma.getNodeById(msg.nodeId) as SceneNode;
    if (node) {
      node.setPluginData('l10n_skip', 'true');
    }
  }
  
  else if (msg.type === 'UNSKIP_LAYER') {
    const node = figma.getNodeById(msg.nodeId) as SceneNode;
    if (node) {
      node.setPluginData('l10n_skip', '');
    }
  }
  
  else if (msg.type === 'FOCUS_LAYER') {
    const node = figma.getNodeById(msg.nodeId) as SceneNode;
    if (node) {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
    }
  }

  else if (msg.type === 'RESIZE_UI') {
    figma.ui.resize(msg.width, msg.height);
  }
  
  else if (msg.type === 'PROGRESS_UPDATE' as any) {
    figma.ui.postMessage(msg);
  }
  
  else if (msg.type === 'CLOSE_PLUGIN') {
    figma.closePlugin();
  }
  
  else if (msg.type === 'SCAN_REQUEST') {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) return;

    let screenFrames: SceneNode[] = [];
    let fragmentFrames: SceneNode[] = [];
    
    if (selection[0].type === 'SECTION') {
       const section = selection[0] as SectionNode;
       const children = section.children;
       
       for (const child of children) {
         if (child.type === 'FRAME') {
           if (isComponentFragment(child)) {
             fragmentFrames.push(child);
           } else {
             screenFrames.push(child);
           }
         }
       }
       if (msg.scanAll) {
         screenFrames = [...screenFrames, ...fragmentFrames];
         fragmentFrames = [];
       }
    } else {
       screenFrames = selection.filter(n => n.type === 'FRAME' || n.type === 'GROUP' || n.type === 'COMPONENT' || n.type === 'COMPONENT_SET' || n.type === 'INSTANCE') as SceneNode[];
       if (screenFrames.length === 0) screenFrames = [selection[0]];
    }

    if (!msg.scanAll && fragmentFrames.length > 0 && screenFrames.length === 0) {
       figma.ui.postMessage({ type: 'ERROR', message: 'Only component fragments were selected.' });
       return;
    }

    let textNodes: TextNode[] = [];
    let hiddenTextNodes: TextNode[] = [];
    
    for (const frame of screenFrames) {
      const allTexts = (frame as any).findAllWithCriteria ? (frame as any).findAllWithCriteria({ types: ['TEXT'] }) : (frame.type === 'TEXT' ? [frame] : []);
      for (const t of allTexts) {
        if (isEffectivelyVisible(t)) {
          textNodes.push(t);
        } else {
          hiddenTextNodes.push(t);
        }
      }
    }

    const skippedNodes: TextNode[] = [];
    const activeNodes: TextNode[] = [];
    for (const tn of textNodes) {
      if (tn.getPluginData('l10n_skip') === 'true') {
        skippedNodes.push(tn);
      } else {
        activeNodes.push(tn);
      }
    }

    if (activeNodes.length > 150) {
      figma.ui.postMessage({ type: 'ERROR', message: `Selection has ${activeNodes.length} layers, exceeding 150 limit.` });
      return;
    }

    const unnamedLayers: LayerPayload[] = [];
    const namedLayers: LayerPayload[] = [];
    const framesMap = new Map<string, FrameInfo>();
    
    // Load dictionary for this scan
    const rawDict = figma.root.getPluginData('common_dictionary');
    const dictionary = rawDict ? JSON.parse(rawDict) : [
      { text: "done",       key: "common.done.button" },
      { text: "cancel",     key: "common.cancel.button" },
      { text: "back",       key: "common.back.button" },
      { text: "ok",         key: "common.ok.button" },
      { text: "close",      key: "common.close.button" }
    ];

    activeNodes.forEach(node => {
      // Find the top-level screen frame this node lives in
      const topFrame = screenFrames.find(sf =>
        (sf as any).findOne ? (sf as any).findOne((n: any) => n.id === node.id) !== null : sf.id === node.id
      );
      const frameId = topFrame?.id || null;
      const frameName = topFrame?.name || getParentFrameName(node) || null;

      // Build FrameInfo entry for this frame
      if (frameId && !framesMap.has(frameId)) {
        const { feature, screen } = normalizeFrameName(frameName || '');
        framesMap.set(frameId, { frameId, frameName: frameName!, suggestedFeature: feature, suggestedScreen: screen });
      }

      const payload: LayerPayload = {
        nodeId: node.id,
        text: node.characters,
        layerName: node.name,
        parentComponentName: getParentComponentName(node),
        frameName,
        frameId,
        textStyle: '',
        positionInHierarchy: node.parent ? node.parent.name : '',
        existingKey: isValidKey(node.name) ? node.name : null
      };

      if (payload.existingKey) {
        namedLayers.push(payload);
      } else {
        const textToMatch = node.characters.toLowerCase().trim();
        const dictMatch = dictionary.find((entry: any) => entry.text.toLowerCase().trim() === textToMatch);
        if (dictMatch) {
          payload.suggestedKey = dictMatch.key;
          payload.isCommonMatch = true;
        }
        unnamedLayers.push(payload);
      }
    });

    const hiddenLayerKeys = hiddenTextNodes
       .map(n => n.name)
       .filter(name => isValidKey(name));

    figma.ui.postMessage({
       type: 'SCAN_RESULT',
       unnamedLayers,
       namedLayers,
       hiddenLayerKeys,
       frames: [...framesMap.values()],
       skippedLayers: skippedNodes.map(node => ({
        nodeId: node.id, text: node.characters, layerName: node.name,
        parentComponentName: getParentComponentName(node),
        frameName: getParentFrameName(node),
        frameId: screenFrames.find(sf => (sf as any).findOne?.((n: any) => n.id === node.id))?.id || null,
        textStyle: '', positionInHierarchy: '', existingKey: null
       }))
    });
  }
};

figma.on('selectionchange', () => {
  const selection = figma.currentPage.selection;
  let textNodeCount = 0;
  
  if (selection.length > 0) {
     for (const node of selection) {
       const nodes = (node as any).findAllWithCriteria ? (node as any).findAllWithCriteria({ types: ['TEXT'] }) : (node.type === 'TEXT' ? [node] : []);
       textNodeCount += nodes.filter((t: any) => isEffectivelyVisible(t) && t.getPluginData('l10n_skip') !== 'true').length;
     }
  }

  let isFragment = false;
  let fragments: any[] = [];
  if (selection.length === 1 && selection[0].type === 'SECTION') {
    const s = selection[0] as SectionNode;
    fragments = s.children.filter(c => c.type === 'FRAME' && isComponentFragment(c as FrameNode));
    isFragment = fragments.length > 0;
  }

  figma.ui.postMessage({
    type: 'SELECTION_CHANGED',
    hasSelection: selection.length > 0,
    layerCount: textNodeCount,
    isFragment,
    fragments: fragments.map(f => ({ name: f.name, width: f.width, height: f.height }))
  });
});

function isComponentFragment(frame: FrameNode): boolean {
  let signals = 0;
  if (frame.width < 300 || frame.height < 300) signals++;
  const hasStatusBar = !!frame.findOne(n => /status.?bar|statusbar/i.test(n.name));
  const hasNavBar = !!frame.findOne(n => /nav.?bar|bottom.?nav|dockbar|tab.?bar/i.test(n.name));
  if (!hasStatusBar) signals++;
  if (!hasNavBar) signals++;
  return signals >= 2;
}

function getParentFrameName(node: SceneNode): string | null {
  let curr: BaseNode | null = node;
  while (curr && curr.type !== 'FRAME' && curr.type !== 'PAGE') curr = curr.parent;
  return curr?.type === 'FRAME' ? curr.name : null;
}

function getParentComponentName(node: SceneNode): string | null {
  let curr: BaseNode | null = node;
  while (curr && curr.type !== 'COMPONENT' && curr.type !== 'COMPONENT_SET' && curr.type !== 'PAGE') curr = curr.parent;
  return (curr?.type === 'COMPONENT' || curr?.type === 'COMPONENT_SET') ? curr.name : null;
}
