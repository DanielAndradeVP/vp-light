import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const scriptLibrary = require('../electron/scriptLibrary.js');

function makeLibrary() {
  return {
    alpha: {
      id: 'alpha',
      entry: 'alpha.js',
      label: 'Alpha',
      category: 'movimento',
      speed: 'medio',
      intensity: 'moderado',
      status: 'estavel',
      description: 'Descrição original',
      tags: ['original'],
      color: '#112233',
    },
    beta: {
      id: 'beta',
      entry: 'sub/beta.js',
      label: 'Beta',
      category: '',
      speed: 'lento',
      intensity: 'forte',
      status: 'estavel',
      description: '',
      tags: [],
      color: '#445566',
    },
  };
}

function makePages(slots1 = {}, slots2 = {}) {
  return {
    pages: [
      { id: 'page-1', name: 'Página 1', order: 1, slots: slots1 },
      { id: 'page-2', name: 'Página 2', order: 2, slots: slots2 },
    ],
  };
}

describe('scriptLibrary.registerEntry', () => {
  it('cria uma entrada nova com defaults e metadados informados', () => {
    const original = makeLibrary();
    const next = scriptLibrary.registerEntry(original, 'gamma', 'sub/gamma.js', {
      label: 'Gamma',
      category: 'cor',
      tags: ['novo'],
      color: '#abcdef',
    });

    expect(next.gamma).toEqual({
      id: 'gamma',
      entry: 'sub/gamma.js',
      label: 'Gamma',
      category: 'cor',
      speed: 'medio',
      intensity: 'moderado',
      status: 'estavel',
      description: '',
      tags: ['novo'],
      color: '#abcdef',
    });
    expect(original).not.toHaveProperty('gamma');
  });

  it('rejeita id duplicado', () => {
    expect(() => scriptLibrary.registerEntry(makeLibrary(), 'alpha', 'outra.js'))
      .toThrow('Já existe uma entrada com id "alpha"');
  });

  it('rejeita entry inseguro', () => {
    expect(() => scriptLibrary.registerEntry(makeLibrary(), 'gamma', '../fora.js'))
      .toThrow('entry inseguro ou inválido');
  });
});

describe('scriptLibrary.updateEntry', () => {
  it('atualiza somente os campos enviados e preserva os demais', () => {
    const original = makeLibrary();
    const next = scriptLibrary.updateEntry(original, 'alpha', {
      label: 'Alpha editado',
      color: '#ffffff',
    });

    expect(next.alpha.label).toBe('Alpha editado');
    expect(next.alpha.color).toBe('#ffffff');
    expect(next.alpha.entry).toBe('alpha.js');
    expect(next.alpha.category).toBe('movimento');
    expect(next.alpha.tags).toEqual(['original']);
    expect(original.alpha.label).toBe('Alpha');
  });

  it('rejeita id inexistente', () => {
    expect(() => scriptLibrary.updateEntry(makeLibrary(), 'inexistente', { label: 'X' }))
      .toThrow('não existe na biblioteca');
  });

  it('rejeita novo entry inseguro', () => {
    expect(() => scriptLibrary.updateEntry(makeLibrary(), 'alpha', { entry: '../../fora.js' }))
      .toThrow('entry inseguro ou inválido');
  });
});

describe('scriptLibrary.removeEntry', () => {
  it('remove da biblioteca e limpa todas as referências, mesmo duplicadas entre páginas', () => {
    const pages = makePages(
      { F1: { type: 'script', id: 'alpha' }, F2: { type: 'script', id: 'beta' } },
      { F3: { type: 'script', id: 'alpha' } }
    );

    const result = scriptLibrary.removeEntry(makeLibrary(), pages, 'alpha');

    expect(result.scriptLibrary).not.toHaveProperty('alpha');
    expect(result.scriptLibrary).toHaveProperty('beta');
    expect(result.scriptPages.pages[0].slots).toEqual({ F2: { type: 'script', id: 'beta' } });
    expect(result.scriptPages.pages[1].slots).toEqual({});
  });
});

describe('scriptLibrary.associateEntry', () => {
  it('associa uma entrada livre na página 1', () => {
    const next = scriptLibrary.associateEntry(makeLibrary(), makePages(), 'alpha', 'page-1', 'F1');
    expect(next.pages[0].slots.F1).toEqual({ type: 'script', id: 'alpha' });
  });

  it('é idempotente quando a entrada já está no mesmo slot', () => {
    const pages = makePages({ F1: { type: 'script', id: 'alpha' } });
    const next = scriptLibrary.associateEntry(makeLibrary(), pages, 'alpha', 'page-1', 'F1');
    expect(next.pages[0].slots.F1).toEqual({ type: 'script', id: 'alpha' });
  });

  it('rejeita associação duplicada em outro slot e informa a posição atual', () => {
    const pages = makePages({ F3: { type: 'script', id: 'alpha' } });
    const originalAssociation = structuredClone(pages.pages[0].slots.F3);
    let error;
    try {
      scriptLibrary.associateEntry(makeLibrary(), pages, 'alpha', 'page-1', 'F4');
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).toBe('ALREADY_ASSOCIATED');
    expect(error?.currentPageId).toBe('page-1');
    expect(error?.currentSlot).toBe('F3');
    expect(pages.pages[0].slots.F3).toEqual(originalAssociation);
  });

  it('rejeita slot ocupado por outro script sem substituir a associação', () => {
    const pages = makePages({ F5: { type: 'script', id: 'alpha' } });
    let error;
    try {
      scriptLibrary.associateEntry(makeLibrary(), pages, 'beta', 'page-1', 'F5');
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).toBe('SLOT_OCCUPIED');
    expect(error?.occupiedById).toBe('alpha');
    expect(pages.pages[0].slots.F5).toEqual({ type: 'script', id: 'alpha' });
  });

  it('rejeita páginas diferentes da página 1', () => {
    let error;
    try {
      scriptLibrary.associateEntry(makeLibrary(), makePages(), 'alpha', 'page-2', 'F1');
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).toBe('PAGE_NOT_SUPPORTED');
  });

  it('rejeita slots fora de F1-F12', () => {
    expect(() => scriptLibrary.associateEntry(makeLibrary(), makePages(), 'alpha', 'page-1', 'F13'))
      .toThrow('Slot inválido');
  });

  it('rejeita id inexistente', () => {
    expect(() => scriptLibrary.associateEntry(makeLibrary(), makePages(), 'inexistente', 'page-1', 'F1'))
      .toThrow('não existe na biblioteca');
  });
});

describe('scriptLibrary.moveEntry', () => {
  it('move atomicamente dentro da página 1 sem alterar a biblioteca', () => {
    const library = makeLibrary();
    const librarySnapshot = structuredClone(library);
    const pages = makePages({ F1: { type: 'script', id: 'alpha' } });

    const next = scriptLibrary.moveEntry(library, pages, 'alpha', 'page-1', 'F6');

    expect(next.pages[0].slots).not.toHaveProperty('F1');
    expect(next.pages[0].slots.F6).toEqual({ type: 'script', id: 'alpha' });
    expect(library).toEqual(librarySnapshot);
  });

  it('associa no destino quando ainda não havia associação', () => {
    const next = scriptLibrary.moveEntry(makeLibrary(), makePages(), 'alpha', 'page-1', 'F7');
    expect(next.pages[0].slots.F7).toEqual({ type: 'script', id: 'alpha' });
  });

  it('rejeita destino ocupado por outro script sem limpar a origem', () => {
    const pages = makePages({
      F1: { type: 'script', id: 'alpha' },
      F2: { type: 'script', id: 'beta' },
    });
    let error;
    try {
      scriptLibrary.moveEntry(makeLibrary(), pages, 'beta', 'page-1', 'F1');
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).toBe('SLOT_OCCUPIED');
    expect(error?.occupiedById).toBe('alpha');
    expect(pages.pages[0].slots).toEqual({
      F1: { type: 'script', id: 'alpha' },
      F2: { type: 'script', id: 'beta' },
    });
  });

  it('permite mover para o mesmo slot ocupado pelo próprio id', () => {
    const pages = makePages({ F4: { type: 'script', id: 'alpha' } });
    const next = scriptLibrary.moveEntry(makeLibrary(), pages, 'alpha', 'page-1', 'F4');
    expect(next.pages[0].slots.F4).toEqual({ type: 'script', id: 'alpha' });
  });

  it('rejeita destino fora da página 1', () => {
    let error;
    try {
      scriptLibrary.moveEntry(makeLibrary(), makePages(), 'alpha', 'page-2', 'F1');
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).toBe('PAGE_NOT_SUPPORTED');
  });
});

describe('scriptLibrary.unassignEntry', () => {
  it('limpa a associação sem remover a entrada da biblioteca', () => {
    const library = makeLibrary();
    const pages = makePages({ F2: { type: 'script', id: 'alpha' } });

    const nextPages = scriptLibrary.unassignEntry(library, pages, 'alpha');

    expect(nextPages.pages[0].slots).toEqual({});
    expect(library).toHaveProperty('alpha');
  });
});

describe('scriptLibrary.buildLibraryView', () => {
  it('informa arquivos ausentes, não registrados, associação e execução', () => {
    const pages = makePages({}, { F4: { type: 'script', id: 'beta' } });

    const view = scriptLibrary.buildLibraryView(
      makeLibrary(),
      pages,
      ['alpha.js', 'extra.js'],
      ['beta']
    );

    const alpha = view.registered.find(entry => entry.id === 'alpha');
    const beta = view.registered.find(entry => entry.id === 'beta');
    expect(alpha).toMatchObject({ missingFile: false, associatedPageId: null, associatedSlot: null, running: false });
    expect(beta).toMatchObject({ missingFile: true, associatedPageId: 'page-2', associatedSlot: 'F4', running: true });
    expect(view.unregisteredFiles).toEqual(['extra.js']);
  });
});

describe('scriptLibrary.findAssociation', () => {
  it('encontra a associação em qualquer página', () => {
    const pages = makePages({}, { F8: { type: 'script', id: 'alpha' } });
    expect(scriptLibrary.findAssociation(pages, 'alpha')).toEqual({ pageId: 'page-2', slot: 'F8' });
  });

  it('retorna null quando não há associação', () => {
    expect(scriptLibrary.findAssociation(makePages(), 'alpha')).toBeNull();
  });
});
