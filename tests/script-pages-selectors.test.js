import { describe, expect, it } from 'vitest';
import {
  EMPTY_SCRIPT_LIBRARY_SNAPSHOT,
  findScriptAssociation,
  getPageActivitySummary,
  getScriptPagesList,
  getScriptsForPage,
} from '../src/store/scriptPagesSelectors.js';

const snapshot = {
  pages: [
    { id: 'page-1', name: 'Página 1', order: 1, slots: {} },
    { id: 'page-2', name: 'Página 2', order: 2, slots: {} },
    { id: 'page-3', name: 'Página 3', order: 3, slots: {} },
  ],
  registered: [
    { id: 'alpha', label: 'Alpha', color: '#112233', associatedPageId: 'page-1', associatedSlot: 'F1', running: true },
    { id: 'beta', label: '', color: '', associatedPageId: 'page-1', associatedSlot: 'F3', running: false, missingFile: true },
    { id: 'gamma', label: 'Gamma', associatedPageId: 'page-2', associatedSlot: 'F2', running: true },
    { id: 'free', label: 'Livre', associatedPageId: null, associatedSlot: null, running: false },
  ],
  unregisteredFiles: [],
};

describe('scriptPagesSelectors', () => {
  it('monta os scripts somente da página informada por slot', () => {
    expect(getScriptsForPage(snapshot, 'page-1')).toEqual({
      F1: {
        scriptId: 'alpha', name: 'Alpha', color: '#112233', running: true,
        missingFile: false, compileError: null, category: '', speed: 'medio', intensity: 'moderado',
        status: 'running', lastError: null,
      },
      F3: {
        scriptId: 'beta', name: 'beta', color: '#000000', running: false,
        missingFile: true, compileError: null, category: '', speed: 'medio', intensity: 'moderado',
        status: 'stopped', lastError: null,
      },
    });
    expect(getScriptsForPage(snapshot, 'page-1')).not.toHaveProperty('F2');
  });

  it('resume atividade por página e mantém páginas inativas com hasActive false', () => {
    expect(getPageActivitySummary(snapshot)).toEqual({
      'page-1': { activeCount: 1, hasActive: true },
      'page-2': { activeCount: 1, hasActive: true },
      'page-3': { activeCount: 0, hasActive: false },
    });
  });

  it('encontra associação e retorna null quando o script está livre ou ausente', () => {
    expect(findScriptAssociation(snapshot, 'gamma')).toEqual({ pageId: 'page-2', slot: 'F2' });
    expect(findScriptAssociation(snapshot, 'free')).toBeNull();
    expect(findScriptAssociation(snapshot, 'unknown')).toBeNull();
  });

  it('lida com snapshot vazio ou malformado sem lançar', () => {
    expect(getScriptPagesList(EMPTY_SCRIPT_LIBRARY_SNAPSHOT)).toEqual([]);
    expect(getScriptPagesList(null)).toEqual([]);
    expect(getScriptPagesList({ pages: {} })).toEqual([]);
    expect(getScriptsForPage(null, 'page-1')).toEqual({});
    expect(getPageActivitySummary(undefined)).toEqual({});
  });
});
