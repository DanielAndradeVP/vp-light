/**
 * show.js — Leitura e escrita do arquivo .show.json
 * Roda APENAS no main process.
 */

const fs = require('fs');
const path = require('path');
const { normalizeFixtureOffsets } = require('./fixtureOffsets');

// Show carregado em memória
let currentShow = null;
let currentShowPath = null;
const FIXTURE_GRID_SIZE = 40;
const MAX_PAGE = 10;

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
  return true;
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
  // Valida fixtures antes de aceitar — rejeita sem mutar o estado em memória.
  validateFixtures((showData || currentShow)?.fixtures || []);
  if (showData) {
    // Fallback defensivo: se showData não trouxer scripts (undefined/null), preserva os do
    // currentShow. Não aplica quando scripts={} — esse é o estado legítimo após script:clear.
    if (currentShow?.scripts && showData.scripts == null) {
      showData = { ...showData, scripts: currentShow.scripts };
    }
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

module.exports = { loadShow, saveShow, saveShowAs, getShow, getStartupChannels, updateScene, validateFixtures };
