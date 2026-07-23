export function getScriptPagesList(scriptLibrarySnapshot) {
  return Array.isArray(scriptLibrarySnapshot?.pages) ? scriptLibrarySnapshot.pages : [];
}

export function getScriptsForPage(scriptLibrarySnapshot, pageId) {
  const result = {};
  const registered = scriptLibrarySnapshot?.registered || [];
  for (const entry of registered) {
    if (entry.associatedPageId === pageId && entry.associatedSlot) {
      result[entry.associatedSlot] = {
        scriptId: entry.id,
        name: entry.label || entry.id,
        color: entry.color || '#000000',
        running: !!entry.running,
        missingFile: !!entry.missingFile,
        compileError: entry.compileError || null,
        category: entry.category || '',
        speed: entry.speed || 'medio',
        intensity: entry.intensity || 'moderado',
        status: entry.status || (entry.running ? 'running' : 'stopped'),
        lastError: entry.lastError || null,
      };
    }
  }
  return result;
}

export function getPageActivitySummary(scriptLibrarySnapshot) {
  const pages = getScriptPagesList(scriptLibrarySnapshot);
  const summary = {};
  for (const page of pages) summary[page.id] = { activeCount: 0, hasActive: false };
  for (const entry of (scriptLibrarySnapshot?.registered || [])) {
    if (entry.running && entry.associatedPageId && summary[entry.associatedPageId]) {
      summary[entry.associatedPageId].activeCount += 1;
      summary[entry.associatedPageId].hasActive = true;
    }
  }
  return summary;
}

export function findScriptAssociation(scriptLibrarySnapshot, scriptId) {
  const entry = (scriptLibrarySnapshot?.registered || []).find(candidate => candidate.id === scriptId);
  if (!entry || !entry.associatedPageId || !entry.associatedSlot) return null;
  return { pageId: entry.associatedPageId, slot: entry.associatedSlot };
}

export const EMPTY_SCRIPT_LIBRARY_SNAPSHOT = { registered: [], unregisteredFiles: [], pages: [] };
