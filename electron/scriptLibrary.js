const show = require('./show');

const SLOT_PATTERN = /^F([1-9]|1[0-2])$/;

function findAssociation(scriptPages, id) {
  for (const page of (scriptPages?.pages || [])) {
    for (const [slot, ref] of Object.entries(page.slots || {})) {
      if (ref?.type === 'script' && ref.id === id) return { pageId: page.id, slot };
    }
  }
  return null;
}

function registerEntry(scriptLibrary, id, entry, metaPatch = {}) {
  if (!id || typeof id !== 'string' || !id.trim()) throw new Error('id da biblioteca é obrigatório.');
  if (scriptLibrary[id]) throw new Error(`Já existe uma entrada com id "${id}" na biblioteca.`);
  if (!show.isSafeRelativeEntry(entry)) throw new Error(`entry inseguro ou inválido: "${entry}"`);
  return {
    ...scriptLibrary,
    [id]: {
      id,
      entry,
      label: metaPatch.label || id,
      category: metaPatch.category ?? '',
      speed: metaPatch.speed || 'medio',
      intensity: metaPatch.intensity || 'moderado',
      status: metaPatch.status || 'estavel',
      description: metaPatch.description || '',
      tags: Array.isArray(metaPatch.tags) ? metaPatch.tags : [],
      color: metaPatch.color || '#000000',
    },
  };
}

const EDITABLE_FIELDS = ['label', 'category', 'speed', 'intensity', 'status', 'description', 'tags', 'color', 'entry'];

function updateEntry(scriptLibrary, id, patch = {}) {
  const prev = scriptLibrary[id];
  if (!prev) throw new Error(`Script "${id}" não existe na biblioteca.`);
  if (patch.entry !== undefined && !show.isSafeRelativeEntry(patch.entry)) {
    throw new Error(`entry inseguro ou inválido: "${patch.entry}"`);
  }
  const updated = { ...prev };
  for (const field of EDITABLE_FIELDS) {
    if (patch[field] !== undefined) updated[field] = patch[field];
  }
  return { ...scriptLibrary, [id]: updated };
}

function _clearAssociation(scriptPages, id) {
  return {
    pages: (scriptPages?.pages || []).map(page => {
      const slots = { ...(page.slots || {}) };
      let changed = false;
      for (const [slot, ref] of Object.entries(slots)) {
        if (ref?.type === 'script' && ref.id === id) {
          delete slots[slot];
          changed = true;
        }
      }
      return changed ? { ...page, slots } : page;
    }),
  };
}

function _setSlot(scriptPages, pageId, slot, ref) {
  let found = false;
  const pages = (scriptPages?.pages || []).map(page => {
    if (page.id !== pageId) return page;
    found = true;
    return { ...page, slots: { ...(page.slots || {}), [slot]: ref } };
  });
  if (!found) throw new Error(`Página "${pageId}" não existe.`);
  return { pages };
}

function _slotOccupant(scriptPages, pageId, slot) {
  const page = (scriptPages?.pages || []).find(candidate => candidate.id === pageId);
  const ref = page?.slots?.[slot];
  return ref?.type === 'script' ? ref.id : null;
}

function removeEntry(scriptLibrary, scriptPages, id) {
  if (!scriptLibrary[id]) throw new Error(`Script "${id}" não existe na biblioteca.`);
  const nextLibrary = { ...scriptLibrary };
  delete nextLibrary[id];
  return { scriptLibrary: nextLibrary, scriptPages: _clearAssociation(scriptPages, id) };
}

function assertSlot(slot) {
  if (!SLOT_PATTERN.test(slot)) throw new Error(`Slot inválido: "${slot}" (esperado F1-F12).`);
}

function associateEntry(scriptLibrary, scriptPages, id, pageId, slot) {
  if (!scriptLibrary[id]) throw new Error(`Script "${id}" não existe na biblioteca.`);
  assertSlot(slot);
  const existing = findAssociation(scriptPages, id);
  if (existing && !(existing.pageId === pageId && existing.slot === slot)) {
    const err = new Error(`Script "${id}" já está associado em ${existing.pageId}/${existing.slot}. Use moveEntry para realocar.`);
    err.code = 'ALREADY_ASSOCIATED';
    err.currentPageId = existing.pageId;
    err.currentSlot = existing.slot;
    throw err;
  }
  const occupant = _slotOccupant(scriptPages, pageId, slot);
  if (occupant && occupant !== id) {
    const err = new Error(`Slot ${pageId}/${slot} já está ocupado por "${occupant}". Desassocie-o antes ou escolha outro slot.`);
    err.code = 'SLOT_OCCUPIED';
    err.occupiedById = occupant;
    throw err;
  }
  return _setSlot(scriptPages, pageId, slot, { type: 'script', id });
}

function moveEntry(scriptLibrary, scriptPages, id, toPageId, toSlot) {
  if (!scriptLibrary[id]) throw new Error(`Script "${id}" não existe na biblioteca.`);
  assertSlot(toSlot);
  const occupant = _slotOccupant(scriptPages, toPageId, toSlot);
  if (occupant && occupant !== id) {
    const err = new Error(`Slot ${toPageId}/${toSlot} já está ocupado por "${occupant}". Desassocie-o antes ou escolha outro slot.`);
    err.code = 'SLOT_OCCUPIED';
    err.occupiedById = occupant;
    throw err;
  }
  const cleared = _clearAssociation(scriptPages, id);
  return _setSlot(cleared, toPageId, toSlot, { type: 'script', id });
}

function unassignEntry(scriptLibrary, scriptPages, id) {
  if (!scriptLibrary[id]) throw new Error(`Script "${id}" não existe na biblioteca.`);
  return _clearAssociation(scriptPages, id);
}

function computeScriptStatus(entry, isRunning) {
  if (entry.missingFile) return isRunning ? 'last-valid-running' : 'missing-file';
  if (entry.lastError) {
    if (isRunning) return 'last-valid-running';
    if (entry.lastError.stage === 'onstart') return 'onstart-error';
    if (entry.lastError.stage === 'compile' || entry.lastError.stage === 'validate') return 'compile-error';
    return 'reload-error';
  }
  if (entry.compileError) return isRunning ? 'last-valid-running' : 'compile-error';
  return isRunning ? 'running' : 'stopped';
}

function buildLibraryView(scriptLibrary, scriptPages, diskEntries, runningLibraryIds) {
  const diskSet = new Set((diskEntries || []).map(entry => entry.replace(/\\/g, '/')));
  const registeredSet = new Set(Object.values(scriptLibrary).map(entry => (entry.entry || '').replace(/\\/g, '/')));
  const registered = Object.values(scriptLibrary).map(entry => {
    const assoc = findAssociation(scriptPages, entry.id);
    return {
      ...entry,
      missingFile: !diskSet.has((entry.entry || '').replace(/\\/g, '/')),
      associatedPageId: assoc?.pageId || null,
      associatedSlot: assoc?.slot || null,
      running: (runningLibraryIds || []).includes(entry.id),
    };
  });
  const unregisteredFiles = (diskEntries || []).filter(entry => !registeredSet.has(entry.replace(/\\/g, '/')));
  return { registered, unregisteredFiles };
}

function scriptLayerId(scriptId) {
  return `script:${scriptId}`;
}

function resolveScriptSlot(scriptLibrary, scriptPages, pageId, slot) {
  const page = (scriptPages?.pages || []).find(candidate => candidate.id === pageId);
  const ref = page?.slots?.[slot];
  if (!ref || ref.type !== 'script' || !ref.id) return null;
  const entry = scriptLibrary?.[ref.id];
  if (!entry) return null;
  return { scriptId: ref.id, entry };
}

function forceAssociateEntry(scriptLibrary, scriptPages, id, pageId, slot) {
  if (!scriptLibrary[id]) throw new Error(`Script "${id}" não existe na biblioteca.`);
  assertSlot(slot);
  const clearedSource = _clearAssociation(scriptPages, id);
  const page = clearedSource.pages.find(candidate => candidate.id === pageId);
  if (!page) throw new Error(`Página "${pageId}" não existe.`);
  return _setSlot(clearedSource, pageId, slot, { type: 'script', id });
}

function buildPageScriptsView(scriptLibrary, scriptPages, pageId, runningScriptIds) {
  const page = (scriptPages?.pages || []).find(candidate => candidate.id === pageId);
  const result = {};
  if (!page) return result;
  for (const [slot, ref] of Object.entries(page.slots || {})) {
    if (ref?.type !== 'script' || !ref.id) continue;
    const entry = scriptLibrary?.[ref.id];
    if (!entry) continue;
    result[slot] = {
      name: (entry.entry || '').split('/').pop().replace(/\.js$/i, ''),
      entry: entry.entry,
      color: entry.color || '#000000',
      scriptId: entry.id,
      running: (runningScriptIds || []).includes(entry.id),
    };
  }
  return result;
}

function generatePageId(pages) {
  const existing = new Set(pages.map(page => page.id));
  let n = pages.length + 1;
  let id = `page-${n}`;
  while (existing.has(id)) {
    n += 1;
    id = `page-${n}`;
  }
  return id;
}

function addPage(scriptPages, name) {
  const pages = (scriptPages?.pages || []).slice();
  const maxOrder = pages.reduce((max, page) => Math.max(max, Number(page.order) || 0), 0);
  const id = generatePageId(pages);
  const trimmed = typeof name === 'string' ? name.trim() : '';
  pages.push({ id, name: trimmed || `Página ${pages.length + 1}`, order: maxOrder + 1, slots: {} });
  return { pages };
}

function renamePage(scriptPages, pageId, name) {
  const pages = scriptPages?.pages || [];
  if (!pages.some(page => page.id === pageId)) throw new Error(`Página "${pageId}" não existe.`);
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) throw new Error('Nome da página não pode ser vazio.');
  return { pages: pages.map(page => (page.id === pageId ? { ...page, name: trimmed } : page)) };
}

function reorderPages(scriptPages, orderedIds) {
  const pages = scriptPages?.pages || [];
  if (!Array.isArray(orderedIds) || orderedIds.length !== pages.length) {
    throw new Error('A lista de reordenação precisa conter exatamente as páginas existentes, uma vez cada.');
  }
  const byId = new Map(pages.map(page => [page.id, page]));
  const missing = orderedIds.filter(id => !byId.has(id));
  if (missing.length > 0) throw new Error(`IDs desconhecidos na reordenação: ${missing.join(', ')}`);
  const seen = new Set();
  for (const id of orderedIds) {
    if (seen.has(id)) throw new Error(`ID repetido na reordenação: ${id}`);
    seen.add(id);
  }
  return { pages: orderedIds.map((id, idx) => ({ ...byId.get(id), order: idx + 1 })) };
}

function removePage(scriptPages, pageId, options = {}) {
  const { minPages = 6, runningScriptIds = [] } = options;
  const pages = scriptPages?.pages || [];
  const target = pages.find(page => page.id === pageId);
  if (!target) throw new Error(`Página "${pageId}" não existe.`);
  if (pages.length <= minPages) {
    const err = new Error(`Não é possível remover: é preciso manter ao menos ${minPages} páginas.`);
    err.code = 'MIN_PAGES';
    throw err;
  }
  const runningSet = new Set(runningScriptIds);
  const hasActiveScript = Object.values(target.slots || {}).some(
    ref => ref?.type === 'script' && runningSet.has(ref.id)
  );
  if (hasActiveScript) {
    const err = new Error(`Não é possível remover "${target.name}": há script ativo nesta página. Pare-o antes.`);
    err.code = 'PAGE_HAS_ACTIVE_SCRIPTS';
    throw err;
  }
  return { pages: pages.filter(page => page.id !== pageId).map((page, idx) => ({ ...page, order: idx + 1 })) };
}

module.exports = {
  findAssociation, registerEntry, updateEntry, removeEntry,
  associateEntry, moveEntry, unassignEntry, buildLibraryView,
  scriptLayerId, resolveScriptSlot, forceAssociateEntry, buildPageScriptsView,
  addPage, renamePage, reorderPages, removePage,
  computeScriptStatus,
  SLOT_PATTERN,
};
