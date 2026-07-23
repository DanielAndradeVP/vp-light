/**
 * show.js — Leitura e escrita do arquivo .show.json
 * Roda APENAS no main process.
 *
 * Campo opcional `adapters` em cada fixture — mapeamentos lógicos → DMX
 * consumidos por electron/adapter.js nos scripts de efeito:
 *
 *   "adapters": {
 *     "<adapterKey>": {
 *       "<valorLogico>": <0-255>,
 *       ...
 *     }
 *   }
 *
 * Ex.: adapters.color.red = 30 no Moving Head 1 (roda de cor no alias color_wheel).
 * adapterKey é extensível (color, gobo, prism, frost, macro, speed, range, …).
 */

const fs = require('fs');
const path = require('path');
const { normalizeFixtureOffsets } = require('./fixtureOffsets');

// Show carregado em memória
let currentShow = null;
let currentShowPath = null;
const FIXTURE_GRID_SIZE = 40;
const MAX_PAGE = 10;
const SCRIPT_SCHEMA_VERSION = 1;
const MIN_SCRIPT_PAGES = 6;

/** Slug estável para id de scriptLibrary. Nunca depende da tecla. */
function slugifyScriptId(name) {
  const base = String(name ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'script';
}

/**
 * Valida que `entry` é um caminho relativo seguro dentro de scripts/.
 * Aceita separadores Windows/Linux na entrada, mas rejeita caminhos absolutos
 * (incluindo drive-relative "C:foo.js" e UNC), traversal, segmentos vazios,
 * bytes nulos e qualquer ":" fora de posição (bloqueia também Alternate Data
 * Streams do NTFS, ex. "foo.js:hidden").
 */
function isSafeRelativeEntry(entry) {
  if (typeof entry !== 'string') return false;
  const trimmed = entry.trim();
  if (!trimmed) return false;
  if (trimmed.includes('\0')) return false;
  if (trimmed.includes(':')) return false; // nomes de script nunca precisam de ":"
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) return false;
  const normalized = trimmed.replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (segments.some(seg => seg === '..' || seg === '.' || seg === '')) return false;
  return true;
}

function createDefaultScriptPages() {
  const pages = [];
  for (let i = 1; i <= MIN_SCRIPT_PAGES; i += 1) {
    pages.push({ id: `page-${i}`, name: `Página ${i}`, order: i, slots: {} });
  }
  return pages;
}

/** Garante ao menos MIN_SCRIPT_PAGES páginas sem truncar páginas extras. */
function normalizeScriptPages(scriptPagesBlock) {
  let pages = Array.isArray(scriptPagesBlock?.pages) ? scriptPagesBlock.pages.slice() : [];
  pages = pages.map((p, idx) => ({
    id: p?.id || `page-${idx + 1}`,
    name: p?.name || `Página ${idx + 1}`,
    order: Number.isFinite(p?.order) ? p.order : idx + 1,
    slots: (p?.slots && typeof p.slots === 'object') ? { ...p.slots } : {},
  }));
  if (pages.length < MIN_SCRIPT_PAGES) {
    const existingIds = new Set(pages.map(p => p.id));
    let nextOrder = pages.length + 1;
    while (pages.length < MIN_SCRIPT_PAGES) {
      let id = `page-${nextOrder}`;
      while (existingIds.has(id)) {
        nextOrder += 1;
        id = `page-${nextOrder}`;
      }
      pages.push({ id, name: `Página ${nextOrder}`, order: nextOrder, slots: {} });
      existingIds.add(id);
      nextOrder += 1;
    }
  }
  return { pages };
}

/**
 * Migra associações legadas F1-F12 para a biblioteca e a primeira página.
 * Função pura: não lê nem escreve no disco.
 */
function migrateLegacyScriptsToLibrary(legacyScripts) {
  const warnings = [];
  const scriptLibrary = {};
  const pages = createDefaultScriptPages();
  const page1 = pages[0];
  const idByName = new Map();

  const orderedFkeys = Object.keys(legacyScripts || {}).sort((a, b) => {
    const na = parseInt(String(a).replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(String(b).replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });

  for (const fkey of orderedFkeys) {
    const meta = legacyScripts[fkey];
    if (!meta || !meta.name) continue;
    const name = String(meta.name);

    if (idByName.has(name)) {
      const existingId = idByName.get(name);
      warnings.push(
        `Associação duplicada detectada na migração: "${fkey}" também aponta para o script "${name}" ` +
        `(já associado via id "${existingId}" a outra tecla). Mantendo a primeira associação; ` +
        `"${fkey}" ficou SEM script — resolva manualmente na biblioteca depois que ela existir.`
      );
      continue;
    }

    const id = slugifyScriptId(name);
    const entry = `${name}.js`;
    if (!isSafeRelativeEntry(entry)) {
      warnings.push(`Script "${name}" (tecla ${fkey}) gerou entry inseguro "${entry}" — ignorado na migração.`);
      continue;
    }

    scriptLibrary[id] = {
      id,
      entry,
      label: name,
      category: '',
      speed: 'medio',
      intensity: 'moderado',
      status: 'estavel',
      description: '',
      tags: [],
      color: meta.color || '#000000',
    };
    idByName.set(name, id);
    page1.slots[fkey] = { type: 'script', id };
  }

  return { scriptLibrary, scriptPages: { pages }, warnings };
}

function createDefaultPages() {
  const pages = {};
  for (let page = 1; page <= MAX_PAGE; page += 1) {
    pages[String(page)] = { name: `Página ${page}`, scenes: {} };
  }
  return pages;
}

function normalizePages(showData) {
  if (!showData || typeof showData !== 'object') return showData;
  const pages = { ...createDefaultPages(), ...(showData.pages || {}) };
  for (const [pageId, pageData] of Object.entries(pages)) {
    pages[pageId] = {
      name: pageData?.name || `Página ${pageId}`,
      scenes: pageData?.scenes || {},
    };
  }
  return { ...showData, pages };
}

function isEmptyScene(sceneData) {
  return !sceneData?.name
    && !sceneData?.color
    && Object.keys(sceneData?.channels || {}).length === 0
    && Object.keys(sceneData?.customFunctions || {}).length === 0;
}

function snapFixtureGridValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number / FIXTURE_GRID_SIZE) * FIXTURE_GRID_SIZE;
}

function normalizeFixturePositions(showData) {
  if (!showData || !Array.isArray(showData.fixtures)) return showData;
  return {
    ...showData,
    fixtures: showData.fixtures.map(fixture => normalizeFixtureOffsets({
      ...fixture,
      posX: snapFixtureGridValue(fixture?.posX),
      posY: snapFixtureGridValue(fixture?.posY),
    })),
  };
}

/**
 * Valida o conjunto de fixtures antes de aceitá-lo no sistema.
 * Roda em qualquer caminho que adicione/atualize fixture (save completo ou,
 * futuramente, IPC de fixture individual). Lança Error descritivo no 1º problema.
 *
 * Regras:
 *  - channelCount deve bater com o tamanho do array channels;
 *  - startChannel deve ser inteiro >= 1 e startChannel + channelCount - 1 <= 512;
 *  - a faixa de canais não pode sobrepor outro fixture já registrado.
 *
 * @param {Array} fixtures
 * @returns {true}
 */
function validateFixtures(fixtures) {
  if (!Array.isArray(fixtures)) {
    throw new Error('Fixtures inválido: "fixtures" deve ser um array.');
  }
  const ranges = []; // { name, start, end }
  for (const fx of fixtures) {
    const label = (fx && (fx.name || fx.id)) || '(sem id)';

    if (!fx || !Array.isArray(fx.channels)) {
      throw new Error(`Fixture "${label}": campo "channels" deve ser um array.`);
    }
    const count = Number(fx.channelCount);
    if (!Number.isInteger(count) || count !== fx.channels.length) {
      throw new Error(
        `Fixture "${label}": channelCount (${fx.channelCount}) não bate com o número de canais (${fx.channels.length}).`
      );
    }
    const start = Number(fx.startChannel);
    if (!Number.isInteger(start) || start < 1) {
      throw new Error(`Fixture "${label}": startChannel (${fx.startChannel}) deve ser um inteiro >= 1.`);
    }
    const end = start + count - 1;
    if (end > 512) {
      throw new Error(`Fixture "${label}": ocupa os canais ${start}–${end}, ultrapassando o limite de 512.`);
    }
    if (fx.enabled === false) continue;
    for (const r of ranges) {
      if (start <= r.end && end >= r.start) {
        throw new Error(
          `Fixture "${label}" (canais ${start}–${end}) sobrepõe "${r.name}" (canais ${r.start}–${r.end}).`
        );
      }
    }
    ranges.push({ name: label, start, end });
  }
  fixtures.forEach(fx => warnInvalidAdapters(fx));
  return true;
}

/**
 * Avisos (não bloqueantes) sobre o campo opcional `fixture.adapters`.
 * Nunca lança exceção nem impede o carregamento do show — um mapeamento
 * semântico malformado não deve derrubar a operação ao vivo; o pior caso é
 * `adapter.resolve`/`adapter.setColor` etc. devolverem null/erro estruturado
 * em runtime, o que já é tratado pelos consumidores.
 */
function warnInvalidAdapters(fx) {
  const label = (fx && (fx.name || fx.id)) || '(sem id)';
  const adapters = fx && fx.adapters;
  if (adapters === undefined) return;
  if (!adapters || typeof adapters !== 'object' || Array.isArray(adapters)) {
    console.warn(`[show] Fixture "${label}": campo "adapters" deveria ser um objeto, recebeu ${typeof adapters}.`);
    return;
  }
  for (const [adapterKey, mapping] of Object.entries(adapters)) {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
      console.warn(`[show] Fixture "${label}": adapters.${adapterKey} deveria ser um objeto de valor lógico → DMX.`);
      continue;
    }
    for (const [logicalValue, dmxValue] of Object.entries(mapping)) {
      const n = Math.round(Number(dmxValue));
      if (!Number.isFinite(n) || n < 0 || n > 255) {
        console.warn(
          `[show] Fixture "${label}": adapters.${adapterKey}.${logicalValue} = ${JSON.stringify(dmxValue)} não é um valor DMX válido (0-255).`
        );
      }
    }
  }
}

/**
 * Carrega um arquivo .show.json do disco.
 * @param {string} filePath  Caminho absoluto para o .show.json
 * @returns {Object} O show carregado
 */
function loadShow(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  let show = JSON.parse(raw);
  if (!show || typeof show !== 'object' ||
      !Array.isArray(show.fixtures) ||
      typeof show.pages !== 'object' || show.pages === null ||
      show.version === undefined) {
    throw new Error(`Arquivo inválido: "${filePath}" não contém version, fixtures e pages obrigatórios`);
  }
  if (show.scriptSchemaVersion !== SCRIPT_SCHEMA_VERSION) {
    if (show.scripts && typeof show.scripts === 'object' && Object.keys(show.scripts).length > 0) {
      const backupPath = `${filePath}.pre-script-migration.bak`;
      try {
        if (!fs.existsSync(backupPath)) {
          fs.writeFileSync(backupPath, raw, 'utf-8');
        }
        const { scriptLibrary, scriptPages, warnings } = migrateLegacyScriptsToLibrary(show.scripts);
        warnings.forEach(w => console.warn(`[show] migração de scripts: ${w}`));

        const migrated = { ...show };
        migrated.scriptLibrary = scriptLibrary;
        migrated.scriptPages = scriptPages;
        migrated.scriptSchemaVersion = SCRIPT_SCHEMA_VERSION;
        delete migrated.scripts;

        try {
          const json = JSON.stringify(migrated, null, 2);
          const tmpPath = filePath + '.tmp';
          fs.writeFileSync(tmpPath, json, 'utf-8');
          fs.renameSync(tmpPath, filePath);
          console.log(`[show] scripts migrados para o novo schema e persistidos: ${filePath} (backup em ${backupPath})`);
        } catch (writeErr) {
          console.error(`[show] migração de scripts calculada, mas FALHOU AO SALVAR no disco (arquivo original preservado): ${writeErr.message}`);
        }

        show = migrated;
      } catch (migErr) {
        console.error(`[show] MIGRAÇÃO DE SCRIPTS FALHOU — mantendo formato legado nesta sessão, arquivo original intacto: ${migErr.message}`);
      }
    } else {
      show.scriptLibrary = show.scriptLibrary && typeof show.scriptLibrary === 'object' ? show.scriptLibrary : {};
      show.scriptPages = normalizeScriptPages(show.scriptPages);
      show.scriptSchemaVersion = SCRIPT_SCHEMA_VERSION;
    }
  } else {
    show.scriptLibrary = show.scriptLibrary && typeof show.scriptLibrary === 'object' ? show.scriptLibrary : {};
    show.scriptPages = normalizeScriptPages(show.scriptPages);
  }
  show = normalizePages(normalizeFixturePositions(show));
  currentShow = show;
  currentShowPath = filePath;
  console.log(`[show] carregado: ${filePath}`);
  console.log(`[show] fixtures: ${show.fixtures?.length ?? 0}`);
  console.log(`[show] páginas: ${Object.keys(show.pages ?? {}).length}`);
  return show;
}

/**
 * Salva o show atual de volta ao mesmo arquivo.
 * @param {Object} [showData]  Se passado, substitui o show em memória antes de salvar
 * @returns {boolean} true se salvou com sucesso
 */
function saveShow(showData) {
  showData = normalizePages(normalizeFixturePositions(showData));
  currentShow = normalizePages(normalizeFixturePositions(currentShow));
  if (showData) showData = { ...showData, scriptPages: normalizeScriptPages(showData.scriptPages) };
  if (currentShow) currentShow = { ...currentShow, scriptPages: normalizeScriptPages(currentShow.scriptPages) };
  // Valida fixtures antes de aceitar — rejeita sem mutar o estado em memória.
  validateFixtures((showData || currentShow)?.fixtures || []);
  if (showData) {
    currentShow = showData;
  }
  if (!currentShow || !currentShowPath) {
    throw new Error('Nenhum show carregado para salvar');
  }
  const json = JSON.stringify(currentShow, null, 2);
  const tmpPath = currentShowPath + '.tmp';
  fs.writeFileSync(tmpPath, json, 'utf-8');
  fs.renameSync(tmpPath, currentShowPath);
  console.log(`[show] salvo: ${currentShowPath}`);
  return true;
}

/**
 * Salva o show em um novo caminho (Salvar Como).
 */
function saveShowAs(filePath, showData) {
  showData = normalizePages(normalizeFixturePositions(showData));
  currentShow = normalizePages(normalizeFixturePositions(currentShow));
  if (showData) showData = { ...showData, scriptPages: normalizeScriptPages(showData.scriptPages) };
  if (currentShow) currentShow = { ...currentShow, scriptPages: normalizeScriptPages(currentShow.scriptPages) };
  // Valida fixtures antes de aceitar — rejeita sem mutar o estado em memória.
  validateFixtures((showData || currentShow)?.fixtures || []);
  if (showData) currentShow = showData;
  if (!currentShow) throw new Error('Nenhum show carregado para salvar');
  const json = JSON.stringify(currentShow, null, 2);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, json, 'utf-8');
  fs.renameSync(tmpPath, filePath);
  currentShowPath = filePath; // só atualiza após confirmação do write
  console.log(`[show] salvo como: ${filePath}`);
  return true;
}

/**
 * Retorna o show em memória (sem ler disco).
 */
function getShow() {
  return currentShow;
}

function normalizeAlias(label) {
  return String(label ?? '').trim().toLowerCase();
}

function getFixtureChannelByAlias(fixture, alias) {
  if (!fixture || !Array.isArray(fixture.channels)) return null;
  const target = normalizeAlias(alias);
  const index = fixture.channels.findIndex(ch => normalizeAlias(ch) === target);
  return index === -1 ? null : (Number(fixture.startChannel) || 1) + index;
}

function getStartupChannels() {
  const fixtures = currentShow?.fixtures || [];
  const startupChannels = {};

  fixtures.forEach((fixture) => {
    if (fixture?.enabled === false) return;
    const channel = getFixtureChannelByAlias(fixture, 'fecho_lampada');
    if (channel) startupChannels[channel] = 255;
  });

  return startupChannels;
}

const DEFAULT_STARTUP_PAGE_ID = '1';
const DEFAULT_STARTUP_SCENE_KEY = 'A';

/**
 * Cena padrão ao iniciar o app: tecla A da página 1.
 * @returns {{ pageId: string, sceneKey: string, name: string, channels: Object } | null}
 */
function getDefaultStartupScene() {
  const scene = currentShow?.pages?.[DEFAULT_STARTUP_PAGE_ID]?.scenes?.[DEFAULT_STARTUP_SCENE_KEY];
  if (!scene?.channels || Object.keys(scene.channels).length === 0) return null;
  return {
    pageId: DEFAULT_STARTUP_PAGE_ID,
    sceneKey: DEFAULT_STARTUP_SCENE_KEY,
    name: scene.name || DEFAULT_STARTUP_SCENE_KEY,
    channels: scene.channels,
  };
}

/**
 * Atualiza uma cena específica em memória.
 * @param {string|number} pageId   ID da página
 * @param {string} sceneKey        Letra da cena (A–N)
 * @param {Object} sceneData       { name, channels }
 */
function updateScene(pageId, sceneKey, sceneData) {
  if (!currentShow) throw new Error('Nenhum show carregado');
  const normalizedPageId = String(Math.max(1, Number.parseInt(pageId, 10) || 1));
  if (!currentShow.pages[normalizedPageId]) {
    currentShow.pages[normalizedPageId] = { name: `Página ${normalizedPageId}`, scenes: {} };
  }
  if (isEmptyScene(sceneData)) {
    delete currentShow.pages[normalizedPageId].scenes[sceneKey];
  } else {
    currentShow.pages[normalizedPageId].scenes[sceneKey] = sceneData;
  }
}

module.exports = {
  loadShow, saveShow, saveShowAs, getShow, getStartupChannels, getDefaultStartupScene, updateScene, validateFixtures,
  SCRIPT_SCHEMA_VERSION, MIN_SCRIPT_PAGES, slugifyScriptId, isSafeRelativeEntry,
  createDefaultScriptPages, normalizeScriptPages, migrateLegacyScriptsToLibrary,
};
