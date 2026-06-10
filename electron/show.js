/**
 * show.js — Leitura e escrita do arquivo .show.json
 * Roda APENAS no main process.
 */

const fs = require('fs');
const path = require('path');

// Show carregado em memória
let currentShow = null;
let currentShowPath = null;

/**
 * Carrega um arquivo .show.json do disco.
 * @param {string} filePath  Caminho absoluto para o .show.json
 * @returns {Object} O show carregado
 */
function loadShow(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const show = JSON.parse(raw);
  if (!show || typeof show !== 'object' ||
      !Array.isArray(show.fixtures) ||
      typeof show.pages !== 'object' || show.pages === null ||
      show.version === undefined) {
    throw new Error(`Arquivo inválido: "${filePath}" não contém version, fixtures e pages obrigatórios`);
  }
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
  if (showData) {
    // Fallback defensivo: se showData não trouxer scripts, preserva os do currentShow.
    // Caso normal: main.js já injeta scriptMeta antes de chamar saveShow.
    if (currentShow?.scripts && (!showData.scripts || Object.keys(showData.scripts).length === 0)) {
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

/**
 * Atualiza uma cena específica em memória.
 * @param {string|number} pageId   ID da página
 * @param {string} sceneKey        Letra da cena (A–N)
 * @param {Object} sceneData       { name, channels }
 */
function updateScene(pageId, sceneKey, sceneData) {
  if (!currentShow) throw new Error('Nenhum show carregado');
  if (!currentShow.pages[pageId]) {
    currentShow.pages[pageId] = { name: `Página ${pageId}`, scenes: {} };
  }
  currentShow.pages[pageId].scenes[sceneKey] = sceneData;
}

module.exports = { loadShow, saveShow, saveShowAs, getShow, updateScene };
