(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/main/code.ts
  var require_code = __commonJS({
    "src/main/code.ts"(exports) {
      figma.showUI(__html__, { width: 450, height: 600, themeColors: true });
      function isValidKey(name) {
        return /^[a-z0-9_]+\.[a-z0-9_]+/.test(name);
      }
      function normalizeFrameName(name) {
        let clean = name.toLowerCase().replace(/\s*[-–—/|]\s*/g, " ").replace(/\b(v\d+|final|copy|backup|old|new|wip|draft|\d+)\b/g, "").replace(/[^a-z0-9 ]/g, "").trim().replace(/\s+/g, " ");
        const parts = clean.split(" ").filter(Boolean);
        if (parts.length === 0) return { feature: "unknown", screen: null };
        if (parts.length === 1) return { feature: parts[0], screen: null };
        const feature = parts[0];
        const screen = parts.slice(1).join("_");
        return { feature, screen: screen || null };
      }
      function isEffectivelyVisible(node) {
        let curr = node;
        while (curr && curr.type !== "PAGE") {
          if ("visible" in curr && !curr.visible) return false;
          curr = curr.parent;
        }
        return true;
      }
      figma.ui.onmessage = (msg) => __async(null, null, function* () {
        if (msg.type === "GET_SETTINGS") {
          const apiKey = (yield figma.clientStorage.getAsync("apiKey")) || "";
          const provider = (yield figma.clientStorage.getAsync("provider")) || "openai";
          const rawDict = figma.root.getPluginData("common_dictionary");
          const dictionary = rawDict ? JSON.parse(rawDict) : [
            { text: "done", key: "common.done.button" },
            { text: "cancel", key: "common.cancel.button" },
            { text: "back", key: "common.back.button" },
            { text: "ok", key: "common.ok.button" },
            { text: "close", key: "common.close.button" }
          ];
          figma.ui.postMessage({
            type: "SETTINGS_LOADED",
            settings: apiKey ? { apiKey, provider, dictionary } : { apiKey: "", provider, dictionary }
          });
        } else if (msg.type === "SAVE_SETTINGS") {
          yield figma.clientStorage.setAsync("apiKey", msg.settings.apiKey);
          yield figma.clientStorage.setAsync("provider", msg.settings.provider);
          if (msg.settings.dictionary) {
            figma.root.setPluginData("common_dictionary", JSON.stringify(msg.settings.dictionary));
          }
        } else if (msg.type === "ADD_DICTIONARY_ENTRY") {
          const rawDict = figma.root.getPluginData("common_dictionary");
          const dictionary = rawDict ? JSON.parse(rawDict) : [
            { text: "done", key: "common.done.button" },
            { text: "cancel", key: "common.cancel.button" },
            { text: "back", key: "common.back.button" },
            { text: "ok", key: "common.ok.button" },
            { text: "close", key: "common.close.button" }
          ];
          const idx = dictionary.findIndex((e) => e.text === msg.entry.text);
          if (idx >= 0) {
            dictionary[idx] = msg.entry;
          } else {
            dictionary.push(msg.entry);
          }
          figma.root.setPluginData("common_dictionary", JSON.stringify(dictionary));
        } else if (msg.type === "WRITE_KEY") {
          const node = figma.getNodeById(msg.nodeId);
          if (node) {
            node.name = msg.key;
            figma.ui.postMessage({ type: "WRITE_CONFIRMED", nodeId: msg.nodeId });
          }
        } else if (msg.type === "SKIP_LAYER") {
          const node = figma.getNodeById(msg.nodeId);
          if (node) {
            node.setPluginData("l10n_skip", "true");
          }
        } else if (msg.type === "UNSKIP_LAYER") {
          const node = figma.getNodeById(msg.nodeId);
          if (node) {
            node.setPluginData("l10n_skip", "");
          }
        } else if (msg.type === "FOCUS_LAYER") {
          const node = figma.getNodeById(msg.nodeId);
          if (node) {
            figma.currentPage.selection = [node];
            figma.viewport.scrollAndZoomIntoView([node]);
          }
        } else if (msg.type === "RESIZE_UI") {
          figma.ui.resize(msg.width, msg.height);
        } else if (msg.type === "PROGRESS_UPDATE") {
          figma.ui.postMessage(msg);
        } else if (msg.type === "CLOSE_PLUGIN") {
          figma.closePlugin();
        } else if (msg.type === "SCAN_REQUEST") {
          const selection = figma.currentPage.selection;
          if (selection.length === 0) return;
          let screenFrames = [];
          let fragmentFrames = [];
          if (selection[0].type === "SECTION") {
            const section = selection[0];
            const children = section.children;
            for (const child of children) {
              if (child.type === "FRAME") {
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
            screenFrames = selection.filter((n) => n.type === "FRAME" || n.type === "GROUP" || n.type === "COMPONENT" || n.type === "COMPONENT_SET" || n.type === "INSTANCE");
            if (screenFrames.length === 0) screenFrames = [selection[0]];
          }
          if (!msg.scanAll && fragmentFrames.length > 0 && screenFrames.length === 0) {
            figma.ui.postMessage({ type: "ERROR", message: "Only component fragments were selected." });
            return;
          }
          let textNodes = [];
          let hiddenTextNodes = [];
          for (const frame of screenFrames) {
            const allTexts = frame.findAllWithCriteria ? frame.findAllWithCriteria({ types: ["TEXT"] }) : frame.type === "TEXT" ? [frame] : [];
            for (const t of allTexts) {
              if (isEffectivelyVisible(t)) {
                textNodes.push(t);
              } else {
                hiddenTextNodes.push(t);
              }
            }
          }
          const skippedNodes = [];
          const activeNodes = [];
          for (const tn of textNodes) {
            if (tn.getPluginData("l10n_skip") === "true") {
              skippedNodes.push(tn);
            } else {
              activeNodes.push(tn);
            }
          }
          if (activeNodes.length > 150) {
            figma.ui.postMessage({ type: "ERROR", message: `Selection has ${activeNodes.length} layers, exceeding 150 limit.` });
            return;
          }
          const unnamedLayers = [];
          const namedLayers = [];
          const framesMap = /* @__PURE__ */ new Map();
          const rawDict = figma.root.getPluginData("common_dictionary");
          const dictionary = rawDict ? JSON.parse(rawDict) : [
            { text: "done", key: "common.done.button" },
            { text: "cancel", key: "common.cancel.button" },
            { text: "back", key: "common.back.button" },
            { text: "ok", key: "common.ok.button" },
            { text: "close", key: "common.close.button" }
          ];
          activeNodes.forEach((node) => {
            const topFrame = screenFrames.find(
              (sf) => sf.findOne ? sf.findOne((n) => n.id === node.id) !== null : sf.id === node.id
            );
            const frameId = (topFrame == null ? void 0 : topFrame.id) || null;
            const frameName = (topFrame == null ? void 0 : topFrame.name) || getParentFrameName(node) || null;
            if (frameId && !framesMap.has(frameId)) {
              const { feature, screen } = normalizeFrameName(frameName || "");
              framesMap.set(frameId, { frameId, frameName, suggestedFeature: feature, suggestedScreen: screen });
            }
            const payload = {
              nodeId: node.id,
              text: node.characters,
              layerName: node.name,
              parentComponentName: getParentComponentName(node),
              frameName,
              frameId,
              textStyle: "",
              positionInHierarchy: node.parent ? node.parent.name : "",
              existingKey: isValidKey(node.name) ? node.name : null
            };
            if (payload.existingKey) {
              namedLayers.push(payload);
            } else {
              const textToMatch = node.characters.toLowerCase().trim();
              const dictMatch = dictionary.find((entry) => entry.text.toLowerCase().trim() === textToMatch);
              if (dictMatch) {
                payload.suggestedKey = dictMatch.key;
                payload.isCommonMatch = true;
              }
              unnamedLayers.push(payload);
            }
          });
          const hiddenLayerKeys = hiddenTextNodes.map((n) => n.name).filter((name) => isValidKey(name));
          figma.ui.postMessage({
            type: "SCAN_RESULT",
            unnamedLayers,
            namedLayers,
            hiddenLayerKeys,
            frames: [...framesMap.values()],
            skippedLayers: skippedNodes.map((node) => {
              var _a;
              return {
                nodeId: node.id,
                text: node.characters,
                layerName: node.name,
                parentComponentName: getParentComponentName(node),
                frameName: getParentFrameName(node),
                frameId: ((_a = screenFrames.find((sf) => {
                  var _a2;
                  return (_a2 = sf.findOne) == null ? void 0 : _a2.call(sf, (n) => n.id === node.id);
                })) == null ? void 0 : _a.id) || null,
                textStyle: "",
                positionInHierarchy: "",
                existingKey: null
              };
            })
          });
        }
      });
      figma.on("selectionchange", () => {
        const selection = figma.currentPage.selection;
        let textNodeCount = 0;
        if (selection.length > 0) {
          for (const node of selection) {
            const nodes = node.findAllWithCriteria ? node.findAllWithCriteria({ types: ["TEXT"] }) : node.type === "TEXT" ? [node] : [];
            textNodeCount += nodes.filter((t) => isEffectivelyVisible(t) && t.getPluginData("l10n_skip") !== "true").length;
          }
        }
        let isFragment = false;
        let fragments = [];
        if (selection.length === 1 && selection[0].type === "SECTION") {
          const s = selection[0];
          fragments = s.children.filter((c) => c.type === "FRAME" && isComponentFragment(c));
          isFragment = fragments.length > 0;
        }
        figma.ui.postMessage({
          type: "SELECTION_CHANGED",
          hasSelection: selection.length > 0,
          layerCount: textNodeCount,
          isFragment,
          fragments: fragments.map((f) => ({ name: f.name, width: f.width, height: f.height }))
        });
      });
      function isComponentFragment(frame) {
        let signals = 0;
        if (frame.width < 300 || frame.height < 300) signals++;
        const hasStatusBar = !!frame.findOne((n) => /status.?bar|statusbar/i.test(n.name));
        const hasNavBar = !!frame.findOne((n) => /nav.?bar|bottom.?nav|dockbar|tab.?bar/i.test(n.name));
        if (!hasStatusBar) signals++;
        if (!hasNavBar) signals++;
        return signals >= 2;
      }
      function getParentFrameName(node) {
        let curr = node;
        while (curr && curr.type !== "FRAME" && curr.type !== "PAGE") curr = curr.parent;
        return (curr == null ? void 0 : curr.type) === "FRAME" ? curr.name : null;
      }
      function getParentComponentName(node) {
        let curr = node;
        while (curr && curr.type !== "COMPONENT" && curr.type !== "COMPONENT_SET" && curr.type !== "PAGE") curr = curr.parent;
        return (curr == null ? void 0 : curr.type) === "COMPONENT" || (curr == null ? void 0 : curr.type) === "COMPONENT_SET" ? curr.name : null;
      }
    }
  });
  require_code();
})();
