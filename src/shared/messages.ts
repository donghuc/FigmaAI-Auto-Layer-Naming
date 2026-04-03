// Message interfaces for communication between the Figma main thread and the UI iframe.

export interface Settings {
  apiKey: string;
  provider: 'openai' | 'anthropic' | 'deepseek';
  dictionary: { text: string, key: string }[];
}

export interface CommonDictionaryEntry {
  text: string;
  key: string;
}

export interface LayerPayload {
  nodeId: string;
  text: string;
  layerName: string;
  parentComponentName: string | null;
  frameName: string | null;
  frameId: string | null;       // ID of the top-level screen frame this layer belongs to
  textStyle: string | null;
  positionInHierarchy: string;
  existingKey: string | null;
  // Set after designer confirms frame metadata (S3b step)
  confirmedFeature?: string;
  confirmedScreen?: string | null;
  // Set during scan if matched from common dictionary
  isCommonMatch?: boolean;
  suggestedKey?: string;
}

export interface FrameInfo {
  frameId: string;
  frameName: string;
  suggestedFeature: string;   // normalized guess from frame name
  suggestedScreen: string | null;
}

export type UIMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: Settings }
  | { type: 'ADD_DICTIONARY_ENTRY'; entry: CommonDictionaryEntry }
  | { type: 'SCAN_REQUEST'; scanAll: boolean }
  | { type: 'WRITE_KEY'; nodeId: string; key: string }
  | { type: 'SKIP_LAYER'; nodeId: string }
  | { type: 'UNSKIP_LAYER'; nodeId: string }
  | { type: 'FOCUS_LAYER'; nodeId: string }
  | { type: 'CLOSE_PLUGIN' }
  | { type: 'RESIZE_UI'; width: number, height: number };

export type PluginMessage =
  | { type: 'SETTINGS_LOADED'; settings: Settings | null }
  | { type: 'SELECTION_CHANGED'; hasSelection: boolean; layerCount: number; isFragment: boolean; fragments: any[] }
  | { type: 'SCAN_RESULT';
      unnamedLayers: LayerPayload[];
      namedLayers: LayerPayload[];
      hiddenLayerKeys: string[];
      skippedLayers: LayerPayload[];
      frames: FrameInfo[];       // unique top-level frames found in the scan
    }
  | { type: 'WRITE_CONFIRMED'; nodeId: string }
  | { type: 'PROGRESS_UPDATE'; phase: string; progress: string }
  | { type: 'ERROR'; message: string };
