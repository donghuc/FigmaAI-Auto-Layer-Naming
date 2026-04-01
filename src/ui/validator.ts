export function validateKeyFormat(key: string): { valid: boolean; error?: string } {
  const segments = key.split('.');

  if (segments.length < 2) return { valid: false, error: 'Key needs at least 2 segments (feature.semantic)' };
  if (segments.length > 5) return { valid: false, error: 'Key cannot exceed 5 segments' };

  for (const segment of segments) {
    if (segment.length === 0) return { valid: false, error: 'Empty segment — check for double dots' };
    if (/[A-Z]/.test(segment)) return { valid: false, error: 'Use lowercase only — no uppercase letters' };
    if (/[^a-z0-9_]/.test(segment)) return { valid: false, error: 'Use dots between segments, underscores within segments only' };
    if (segment.startsWith('_') || segment.endsWith('_')) return { valid: false, error: 'Segments cannot start or end with underscore' };
  }

  return { valid: true };
}

export function normalizeKey(key: string): string[] {
  return key.split('.').flatMap(segment => segment.split('_')).filter(Boolean);
}

export function isDuplicate(keyA: string, keyB: string): boolean {
  const tokensA = normalizeKey(keyA);
  const tokensB = normalizeKey(keyB);
  
  if (tokensA.length !== tokensB.length) return false;
  return tokensA.every((token, i) => token === tokensB[i]);
}

// Check against uniqueness
export function checkUniqueness(suggestedKeys: {nodeId: string, key: string}[], hiddenKeys: string[]) {
  const allKeys = [...suggestedKeys, ...hiddenKeys.map(k => ({ nodeId: 'hidden', key: k }))];
  const duplicates = new Set<string>();

  for (let i = 0; i < allKeys.length; i++) {
    for (let j = i + 1; j < allKeys.length; j++) {
      if (allKeys[i].key && allKeys[j].key && isDuplicate(allKeys[i].key, allKeys[j].key)) {
        if (allKeys[i].nodeId !== 'hidden') duplicates.add(allKeys[i].nodeId);
        if (allKeys[j].nodeId !== 'hidden') duplicates.add(allKeys[j].nodeId);
      }
    }
  }

  return duplicates;
}
