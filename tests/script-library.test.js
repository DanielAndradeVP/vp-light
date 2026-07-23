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

function makePages(slots1 = {}, slots2 = {}, slots3 = {}) {
  return {
    pages: [
      { id: 'page-1', name: 'Página 1', order: 1, slots: slots1 },
      { id: 'page-2', name: 'Página 2', order: 2, slots: slots2 },
      { id: 'page-3', name: 'Página 3', order: 3, slots: slots3 },
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

  it('aceita qualquer página existente', () => {
    const next = scriptLibrary.associateEntry(makeLibrary(), makePages(), 'alpha', 'page-3', 'F1');
    expect(next.pages[2].slots.F1).toEqual({ type: 'script', id: 'alpha' });
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

  it('aceita destino em qualquer página existente', () => {
    const pages = makePages({ F2: { type: 'script', id: 'alpha' } });
    const next = scriptLibrary.moveEntry(makeLibrary(), pages, 'alpha', 'page-3', 'F1');
    expect(next.pages[0].slots).not.toHaveProperty('F2');
    expect(next.pages[2].slots.F1).toEqual({ type: 'script', id: 'alpha' });
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

describe('scriptLibrary.scriptLayerId', () => {
  it('gera uma identidade de camada estável a partir do id', () => {
    expect(scriptLibrary.scriptLayerId('alpha')).toBe('script:alpha');
  });
});

describe('scriptLibrary.resolveScriptSlot', () => {
  it('resolve página e slot preenchidos', () => {
    const pages = makePages({}, {}, { F9: { type: 'script', id: 'beta' } });
    expect(scriptLibrary.resolveScriptSlot(makeLibrary(), pages, 'page-3', 'F9')).toEqual({
      scriptId: 'beta',
      entry: makeLibrary().beta,
    });
  });

  it('retorna null para slot vazio, id ausente e página ausente', () => {
    const pages = makePages({ F2: { type: 'script', id: 'inexistente' } });
    expect(scriptLibrary.resolveScriptSlot(makeLibrary(), pages, 'page-1', 'F1')).toBeNull();
    expect(scriptLibrary.resolveScriptSlot(makeLibrary(), pages, 'page-1', 'F2')).toBeNull();
    expect(scriptLibrary.resolveScriptSlot(makeLibrary(), pages, 'page-99', 'F1')).toBeNull();
  });
});

describe('scriptLibrary.forceAssociateEntry', () => {
  it('substitui o ocupante do destino e remove a associação anterior do id', () => {
    const pages = makePages(
      { F1: { type: 'script', id: 'alpha' } },
      {},
      { F5: { type: 'script', id: 'beta' } }
    );

    const next = scriptLibrary.forceAssociateEntry(makeLibrary(), pages, 'alpha', 'page-3', 'F5');

    expect(next.pages[0].slots).not.toHaveProperty('F1');
    expect(next.pages[2].slots.F5).toEqual({ type: 'script', id: 'alpha' });
  });

  it('não lança conflitos de associação e valida apenas id, página e slot', () => {
    const pages = makePages({ F1: { type: 'script', id: 'beta' } });
    expect(() => scriptLibrary.forceAssociateEntry(makeLibrary(), pages, 'alpha', 'page-1', 'F1'))
      .not.toThrow();
    expect(() => scriptLibrary.forceAssociateEntry(makeLibrary(), pages, 'ausente', 'page-1', 'F1'))
      .toThrow('não existe na biblioteca');
    expect(() => scriptLibrary.forceAssociateEntry(makeLibrary(), pages, 'alpha', 'page-99', 'F1'))
      .toThrow('não existe');
    expect(() => scriptLibrary.forceAssociateEntry(makeLibrary(), pages, 'alpha', 'page-1', 'F13'))
      .toThrow('Slot inválido');
  });
});

describe('scriptLibrary.buildPageScriptsView', () => {
  it('monta somente a página pedida com metadados e estado running por scriptId', () => {
    const pages = makePages(
      { F1: { type: 'script', id: 'alpha' } },
      { F4: { type: 'script', id: 'beta' } }
    );

    expect(scriptLibrary.buildPageScriptsView(makeLibrary(), pages, 'page-2', ['beta'])).toEqual({
      F4: {
        name: 'beta',
        entry: 'sub/beta.js',
        color: '#445566',
        scriptId: 'beta',
        running: true,
      },
    });
  });
});

describe('scriptLibrary.addPage', () => {
  it('cria página com nome informado e order maior que o máximo existente', () => {
    const pages = { pages: [{ id: 'page-1', name: 'Primeira', order: 8, slots: {} }] };
    const next = scriptLibrary.addPage(pages, '  Nova página  ');

    expect(next.pages.at(-1)).toEqual({ id: 'page-2', name: 'Nova página', order: 9, slots: {} });
  });

  it('usa o nome default Página N quando o nome é vazio ou ausente', () => {
    expect(scriptLibrary.addPage({ pages: [] }, '').pages[0].name).toBe('Página 1');
    expect(scriptLibrary.addPage(makePages()).pages.at(-1).name).toBe('Página 4');
  });

  it('gera id sem colidir mesmo quando o próximo número já existe', () => {
    const pages = {
      pages: [1, 2, 3, 4, 5, 7].map((n, idx) => ({
        id: `page-${n}`, name: `Página ${n}`, order: idx === 5 ? 20 : idx + 1, slots: {},
      })),
    };
    const next = scriptLibrary.addPage(pages, 'Nova');

    expect(next.pages.at(-1)).toMatchObject({ id: 'page-8', order: 21 });
  });
});

describe('scriptLibrary.renamePage', () => {
  it('renomeia a página e remove espaços externos', () => {
    const next = scriptLibrary.renamePage(makePages(), 'page-2', '  Operação  ');
    expect(next.pages[1].name).toBe('Operação');
  });

  it('rejeita página inexistente', () => {
    expect(() => scriptLibrary.renamePage(makePages(), 'page-99', 'Nome')).toThrow('não existe');
  });

  it('rejeita nome vazio ou composto apenas por espaços', () => {
    expect(() => scriptLibrary.renamePage(makePages(), 'page-1', '')).toThrow('não pode ser vazio');
    expect(() => scriptLibrary.renamePage(makePages(), 'page-1', '   ')).toThrow('não pode ser vazio');
  });
});

describe('scriptLibrary.reorderPages', () => {
  it('reordena e atualiza order sequencialmente', () => {
    const next = scriptLibrary.reorderPages(makePages(), ['page-3', 'page-1', 'page-2']);
    expect(next.pages.map(page => [page.id, page.order])).toEqual([
      ['page-3', 1], ['page-1', 2], ['page-2', 3],
    ]);
  });

  it('rejeita lista com tamanho diferente', () => {
    expect(() => scriptLibrary.reorderPages(makePages(), ['page-1', 'page-2']))
      .toThrow('exatamente as páginas existentes');
  });

  it('rejeita id desconhecido', () => {
    expect(() => scriptLibrary.reorderPages(makePages(), ['page-1', 'page-2', 'page-99']))
      .toThrow('IDs desconhecidos');
  });

  it('rejeita id duplicado', () => {
    expect(() => scriptLibrary.reorderPages(makePages(), ['page-1', 'page-2', 'page-2']))
      .toThrow('ID repetido');
  });
});

describe('scriptLibrary.removePage', () => {
  function sevenPages(targetSlots = {}) {
    return {
      pages: Array.from({ length: 7 }, (_, idx) => ({
        id: `page-${idx + 1}`,
        name: `Página ${idx + 1}`,
        order: idx + 1,
        slots: idx === 2 ? targetSlots : {},
      })),
    };
  }

  it('remove uma página do meio e reordena as restantes sequencialmente', () => {
    const next = scriptLibrary.removePage(sevenPages(), 'page-3', { minPages: 6 });

    expect(next.pages.map(page => page.id)).toEqual([
      'page-1', 'page-2', 'page-4', 'page-5', 'page-6', 'page-7',
    ]);
    expect(next.pages.map(page => page.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('rejeita remoção quando já está no mínimo de páginas', () => {
    let error;
    try {
      scriptLibrary.removePage({ pages: sevenPages().pages.slice(0, 6) }, 'page-1', { minPages: 6 });
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).toBe('MIN_PAGES');
  });

  it('rejeita página que contém script ativo', () => {
    const pages = sevenPages({ F4: { type: 'script', id: 'alpha' } });
    let error;
    try {
      scriptLibrary.removePage(pages, 'page-3', { minPages: 6, runningScriptIds: ['alpha'] });
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).toBe('PAGE_HAS_ACTIVE_SCRIPTS');
  });
});

describe('scriptLibrary.computeScriptStatus', () => {
  const status = (entry, running = false) => scriptLibrary.computeScriptStatus(entry, running);

  it('classifica arquivo ausente conforme a execução', () => {
    expect(status({ missingFile: true }, false)).toBe('missing-file');
    expect(status({ missingFile: true }, true)).toBe('last-valid-running');
  });

  it('classifica erros registrados por estágio quando parado', () => {
    expect(status({ lastError: { stage: 'onstart' } })).toBe('onstart-error');
    expect(status({ lastError: { stage: 'compile' } })).toBe('compile-error');
    expect(status({ lastError: { stage: 'validate' } })).toBe('compile-error');
    expect(status({ lastError: { stage: 'read' } })).toBe('reload-error');
  });

  it('preserva o estado last-valid-running quando há erro mas a camada segue ativa', () => {
    expect(status({ lastError: { stage: 'compile' } }, true)).toBe('last-valid-running');
    expect(status({ compileError: 'Erro de sintaxe' }, true)).toBe('last-valid-running');
  });

  it('classifica compileError sem lastError e os estados normais', () => {
    expect(status({ compileError: 'Erro de sintaxe' })).toBe('compile-error');
    expect(status({}, true)).toBe('running');
    expect(status({}, false)).toBe('stopped');
  });
});
