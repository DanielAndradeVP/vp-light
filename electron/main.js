/**
 * main.js — Processo principal do Electron
 *
 * Responsabilidades:
 *   - Cria a janela principal
 *   - Registra todos os handlers IPC
 *   - Inicia o engine DMX automaticamente
 *   - Carrega o show padrão na inicialização
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { execFile, spawn } = require('child_process');
const fs = require('fs');

const universe     = require('./engine/universe');
const engine       = require('./engine/engine');
const compositor   = require('./engine/compositor');
const artnet       = require('./engine/artnet');
const show         = require('./show');
const interpolator = require('./engine/interpolator');
const {
  buildChannelOffsetMap: buildFixtureChannelOffsetMap,
  normalizeShowFixtureOffsets,
} = require('./fixtureOffsets');

const isDev = !app.isPackaged;
const DEFAULT_SHOW = path.join(__dirname, '..', 'shows', 'vp.show.json');

const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR);
const BANCO_DIR = path.join(__dirname, '..', 'banco-de-conhecimento');

function getVSCodeCandidates() {
  const candidates = ['code', 'code.cmd'];
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env['ProgramFiles(x86)'];

  if (localAppData) {
    candidates.push(path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe'));
  }
  if (programFiles) {
    candidates.push(path.join(programFiles, 'Microsoft VS Code', 'Code.exe'));
  }
  if (programFilesX86) {
    candidates.push(path.join(programFilesX86, 'Microsoft VS Code', 'Code.exe'));
  }

  return candidates;
}

function normalizeScriptFile(filePath) {
  if (!filePath) return null;
  const withExtension = path.extname(filePath) ? filePath : `${filePath}.js`;
  return path.isAbsolute(withExtension)
    ? withExtension
    : path.join(SCRIPTS_DIR, withExtension);
}

function openScriptInVSCode(filePath) {
  const targetFile = normalizeScriptFile(filePath);
  if (!targetFile) {
    console.error('[script:edit] caminho do script nao informado');
    return Promise.resolve({ ok: false, error: 'Caminho do script nao informado' });
  }
  if (!fs.existsSync(targetFile)) {
    console.error('[script:edit] arquivo do script nao encontrado:', targetFile);
    return Promise.resolve({ ok: false, error: `Arquivo do script nao encontrado: ${targetFile}` });
  }

  const candidates = getVSCodeCandidates();
  let index = 0;

  return new Promise(resolve => {
    function tryNext(lastError) {
      if (index >= candidates.length) {
        const message = lastError?.message || 'VSCode nao encontrado';
        console.error('[script:edit] nao foi possivel abrir o script no VSCode:', targetFile);
        console.error('[script:edit] tentei code/code.cmd e caminhos comuns do VSCode. Ultimo erro:', message);
        resolve({ ok: false, error: `Nao foi possivel abrir o VSCode: ${message}`, file: targetFile });
        return;
      }

      const candidate = candidates[index++];
      const isPath = candidate.includes(path.sep);
      if (isPath && !fs.existsSync(candidate)) {
        tryNext(new Error(`VSCode nao encontrado em ${candidate}`));
        return;
      }

      const lowerCandidate = candidate.toLowerCase();
      const isCmd = lowerCandidate.endsWith('.cmd') || lowerCandidate === 'code.cmd';
      const command = isCmd ? (process.env.ComSpec || 'cmd.exe') : candidate;
      const args = isCmd ? ['/d', '/s', '/c', `"${candidate}" "${targetFile}"`] : [targetFile];

      if (isCmd) {
        execFile(command, args, { windowsHide: true }, err => {
          if (err) {
            tryNext(err);
            return;
          }
          console.log('[script:edit] script aberto no VSCode:', targetFile);
          resolve({ ok: true, file: targetFile });
        });
        return;
      }

      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.once('error', err => tryNext(err));
      child.once('spawn', () => {
        child.unref();
        console.log('[script:edit] script aberto no VSCode:', targetFile);
        resolve({ ok: true, file: targetFile });
      });
    }

    tryNext();
  });
}

// ─────────────────────────────────────────────────────────────
// JANELA
// ─────────────────────────────────────────────────────────────

let mainWindow = null;
let allowWindowClose = false;
let viewer3DWindow = null;

function createWindow() {
  allowWindowClose = false;
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'vp-light',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.maximize();

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('close', (event) => {
    if (allowWindowClose) return;
    event.preventDefault();
    mainWindow.webContents.send('window:close-requested');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Janela independente do visualizador 3D (Fase 1: apenas fundo preto, sem fixtures).
// Não tem parent fixo — pode ser movida para outro monitor livremente e fechá-la
// não afeta a janela principal nem a operação DMX em curso.
function createViewer3DWindow() {
  if (viewer3DWindow) {
    viewer3DWindow.focus();
    return viewer3DWindow;
  }

  viewer3DWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    resizable: true,
    title: 'vp-light 3D — Vida e Paz',
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    viewer3DWindow.loadURL('http://localhost:5173/viewer3d.html');
  } else {
    viewer3DWindow.loadFile(path.join(__dirname, '..', 'dist', 'viewer3d.html'));
  }

  viewer3DWindow.on('closed', () => {
    viewer3DWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('viewer3d:closed');
  });

  return viewer3DWindow;
}

// Envia o universo DMX (512 canais) para a janela 3D a cada frame da engine.
// Aproveita o ciclo existente de 40ms (engine.onFrame) — nenhum loop novo.
// Se a janela 3D não estiver aberta, ignora silenciosamente.
function broadcastDmxUniverseToViewer3D(universeBuffer) {
  if (!viewer3DWindow || viewer3DWindow.isDestroyed()) return;
  viewer3DWindow.webContents.send('dmx-universe', Array.from(universeBuffer));
}

engine.onFrame(broadcastDmxUniverseToViewer3D);

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS — ENGINE
// ─────────────────────────────────────────────────────────────

ipcMain.handle('window:closeApp', () => {
  if (!mainWindow) return { ok: false };
  allowWindowClose = true;
  if (viewer3DWindow) viewer3DWindow.close();
  mainWindow.close();
  return { ok: true };
});

ipcMain.handle('window:open3DViewer', () => {
  createViewer3DWindow();
  return { ok: true };
});

ipcMain.handle('engine:start', () => {
  engine.start();
  return { running: true };
});

ipcMain.handle('engine:stop', () => {
  engine.stop();
  return { running: false };
});

// Retorna as interfaces de rede ativas usadas para envio Art-Net.
// Útil para diagnóstico e seleção manual de interface no renderer.
ipcMain.handle('artnet:getInterfaces', () => artnet.getActiveInterfaces());

ipcMain.handle('engine:status', () => ({
  running: engine.isRunning(),
  frames: engine.getFrameCount(),
}));

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS — DMX
// ─────────────────────────────────────────────────────────────

ipcMain.handle('dmx:activateScene', (_, channels) => {
  applyDmxChannelMap(filterDisabledFixtureChannels(channels));
  return { ok: true };
});

ipcMain.handle('dmx:setChannel', (_, channel, value) => {
  setDmxChannelRuntime(channel, value);
  return { ok: true };
});

ipcMain.handle('dmx:setChannelRange', (_, channels, value) => {
  if (!Array.isArray(channels)) {
    return { ok: false, error: 'channels must be an array' };
  }
  const enabledChannels = channels.filter(channel => isDmxChannelEnabled(channel));
  enabledChannels.forEach((channel) => {
    setDmxChannelRuntime(channel, value);
  });
  return { ok: true, count: enabledChannels.length };
});

ipcMain.handle('custom:speed', (_, fixtureId, value) => {
  const fixture = getShowFixture(fixtureId);
  if (!fixture) return { ok: false, error: 'fixture not found' };
  if (!isFixtureEnabled(fixture)) return { ok: true, ignored: true };

  const speedValue = clampDmxValue(value);
  if (isMovingHeadBeamSpeedFixture(fixture)) {
    const speedChannel = getFixtureChannelByAlias(fixture, 'virtual_speed')
      || getFixtureChannelByAlias(fixture, 'speed');
    if (!speedChannel) return { ok: false, error: 'virtual_speed channel not found' };
    interpolator.setSpeed(speedChannel, speedValue);
    return { ok: true, mode: 'virtual', fixtureId: fixture.id, channel: speedChannel, value: speedValue };
  }

  if (isRibaltaSpeedFixture(fixture)) {
    const speedChannel = getFixtureChannelByAlias(fixture, 'speed');
    if (!speedChannel) return { ok: false, error: 'speed channel not found' };
    universe.setChannel(speedChannel, speedValue);
    return { ok: true, mode: 'dmx', fixtureId: fixture.id, channel: speedChannel, value: speedValue };
  }

  return { ok: false, error: 'custom speed is only available for Moving Head Beam 1/2 and Ribalta_1/2' };
});

ipcMain.handle('dmx:blackout', () => {
  stopAllRunningScripts('blackout');
  universe.blackout();
  return { ok: true };
});

ipcMain.handle('dmx:restoreState', (_, channels) => {
  universe.blackout();
  applyDmxChannelMap(filterDisabledFixtureChannels(channels));
  return { ok: true };
});

ipcMain.handle('dmx:getUniverse', () => {
  return universe.getUniverseSnapshot();
});

ipcMain.handle('dmx:setActiveScenes', (_, scenesMap) => {
  universe.setActiveScenes(filterDisabledFixtureScenes(scenesMap));
  return { ok: true };
});

ipcMain.handle('dmx:getConflicts', () => {
  return universe.detectConflicts();
});

// Mapa de canais bloqueados por cenas ativas — atualizado pelo renderer
let activeSceneChannels = {}; // { [canal]: valor } — scripts não sobrescrevem esses canais

ipcMain.handle('dmx:setActiveSceneChannels', (_, channels) => {
  activeSceneChannels = filterDisabledFixtureChannels(channels);
  compositor.setSceneLock(activeSceneChannels); // guard de cena aplicado na composição
  return { ok: true };
});

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS — SHOW
// ─────────────────────────────────────────────────────────────

ipcMain.handle('show:load', async (_, filePath) => {
  try {
    let targetPath = filePath;

    if (!targetPath) {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Abrir Show',
        filters: [{ name: 'vp-light Show', extensions: ['show.json', 'json'] }],
        properties: ['openFile'],
      });
      if (canceled || !filePaths.length) return { ok: false, error: 'Cancelado' };
      targetPath = filePaths[0];
    }

    const data = show.loadShow(targetPath);
    loadScriptMeta(); loadPageScriptMeta();
    initializeOffsets();
    const startupChannels = show.getStartupChannels();
    Object.entries(startupChannels).forEach(([ch, value]) => universe.setChannel(Number(ch), value));
    return { ok: true, show: data, path: targetPath };
  } catch (err) {
    console.error('[main] show:load error:', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('show:save', (_, showData) => {
  try {
    const currentShow = show.getShow();

    // ── LOG 1: o que chegou do renderer ──────────────────────────────────────
    console.log('[show:save] ── INÍCIO SAVE ──');
    console.log('[show:save] renderer enviou:',
      'fixtures:', showData.fixtures?.length,
      '| páginas:', Object.keys(showData.pages || {}),
      '| cenas por página:', Object.fromEntries(
        Object.entries(showData.pages || {}).map(([k, v]) => [k, Object.keys(v.scenes || {})])
      ),
      '| scripts:', Object.keys(showData.scripts || {})
    );
    console.log('[show:save] scriptMeta no main:', Object.keys(scriptMeta));
    console.log('[show:save] currentShow no disco:',
      'fixtures:', currentShow?.fixtures?.length,
      '| páginas:', Object.keys(currentShow?.pages || {}),
      '| scripts:', Object.keys(currentShow?.scripts || {})
    );

    // Scripts: scriptMeta do main é a ÚNICA fonte de verdade.
    // Não herdar do disco nem do renderer — qualquer entrada que não esteja
    // em scriptMeta neste momento foi removida via script:clear e não deve voltar.
    const mergedScripts = {};
    for (const [fkey, meta] of Object.entries(scriptMeta)) {
      mergedScripts[fkey] = { name: meta.name, file: meta.file };
    }

    // Páginas: merge profundo por página.
    // Renderer é a fonte da verdade para intenção do usuário (name + quais cenas existem).
    // currentShow.pages complementa páginas que o renderer não enviou.
    // Dentro de cada página, scenes do renderer vencem — garantindo que limpezas e
    // saves recentes do renderer prevaleçam sobre o que ficou em memória no main.
    const mergedPages = {};
    const _allPageIds = new Set([
      ...Object.keys(currentShow?.pages || {}),
      ...Object.keys(showData.pages || {}),
    ]);
    for (const _pid of _allPageIds) {
      const _fromMain     = currentShow?.pages?.[_pid]  || {};
      const _fromRenderer = showData.pages?.[_pid]      || {};
      mergedPages[_pid] = {
        name:   _fromRenderer.name   || _fromMain.name   || `Página ${_pid}`,
        // Cenas: currentShow (atualizado por show:updateScene em tempo real) como base,
        // renderer sobrescreve — garante que a cena mais recente salva pelo renderer vença.
        scenes: { ...(_fromMain.scenes || {}), ...(_fromRenderer.scenes || {}) },
      };
    }

    // page_scripts: pageScriptMeta do main e a fonte de verdade em runtime.
    // Nao herdar do renderer/disco aqui: entradas removidas via page_script:clear
    // nao podem voltar em saves completos posteriores.
    const mergedPageScripts = {};
    for (const [pgId, pgData] of Object.entries(pageScriptMeta)) {
      if (!mergedPageScripts[pgId]) mergedPageScripts[pgId] = {};
      for (const [sceneKey, meta] of Object.entries(pgData)) {
        mergedPageScripts[pgId][sceneKey] = { name: meta.name, file: meta.file };
      }
    }

    const merged = normalizeRuntimeFixtureFields({
      ...showData,
      scripts:      mergedScripts,
      pages:        mergedPages,
      page_scripts: mergedPageScripts,
    });

    // ── LOG 2: o que vai para o disco ────────────────────────────────────────
    console.log('[show:save] gravando no disco:',
      'fixtures:', merged.fixtures?.length,
      '| páginas:', Object.keys(merged.pages),
      '| cenas por página:', Object.fromEntries(
        Object.entries(merged.pages).map(([k, v]) => [k, Object.keys(v.scenes || {})])
      ),
      '| scripts:', Object.keys(merged.scripts)
    );

    show.saveShow(merged);
    initializeOffsets();

    // ── LOG 3: confirmação ────────────────────────────────────────────────────
    console.log('[show:save] ✓ salvo com sucesso');
    return { ok: true, message: 'Salvo com sucesso' };
  } catch (err) {
    console.error('[show:save] ✗ ERRO:', err.message);
    return { ok: false, error: err.message, message: `Erro ao salvar: ${err.message}` };
  }
});

ipcMain.handle('show:saveAs', async (_, showData) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Show Como',
      filters: [{ name: 'vp-light Show', extensions: ['show.json'] }],
    });
    if (canceled || !filePath) return { ok: false, error: 'Cancelado' };
    show.saveShowAs(filePath, showData);
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('show:get', () => {
  return { ok: true, show: show.getShow() };
});

ipcMain.handle('show:updateScene', (_, pageId, sceneKey, sceneData) => {
  try {
    show.updateScene(pageId, sceneKey, sceneData);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── SCRIPTS ─────────────────────────────────────────────────────────────────
const runningScripts = {}; // { [fkey]: { interval, context } }
const scriptMeta = {};     // { [fkey]: { name, file } }

// ─── PAGE SCRIPTS (teclas de cena) ──────────────────────────────────────────
const pageScriptMeta    = {}; // { [pageId]: { [sceneKey]: { name, file } } }
const runningPageScripts = {}; // flat key `${pageId}:${sceneKey}` → { interval, context }

function normalizePageId(pageId) {
  return String(Math.max(1, Number.parseInt(pageId, 10) || 1));
}

function psKey(pageId, sceneKey) { return `${normalizePageId(pageId)}:${sceneKey}`; }

function stopRunningPageScript(pageId, sceneKey, reason) {
  pageId = normalizePageId(pageId);
  const k = psKey(pageId, sceneKey);
  const running = runningPageScripts[k];
  if (!running) return false;
  compositor.removeLayer(`page:${k}`);
  if (typeof running.context.OnTerminate === 'function') {
    try { running.context.OnTerminate(); } catch (e) {
      console.error(`[page_script] OnTerminate error (${reason}) (${k}):`, e.message);
    }
  }
  delete runningPageScripts[k];
  return true;
}

function loadPageScriptMeta() {
  for (const pageId of Object.keys(pageScriptMeta)) {
    delete pageScriptMeta[pageId];
  }
  const current = show.getShow();
  if (!current?.page_scripts) return;
  for (const [pageId, pageData] of Object.entries(current.page_scripts)) {
    if (!pageScriptMeta[pageId]) pageScriptMeta[pageId] = {};
    for (const [sceneKey, meta] of Object.entries(pageData)) {
      // Resolve o arquivo pelo nome, relativo ao SCRIPTS_DIR desta máquina.
      const file = path.join(SCRIPTS_DIR, `${meta.name}.js`);
      if (fs.existsSync(file)) {
        pageScriptMeta[pageId][sceneKey] = { name: meta.name, file };
      }
    }
  }
}

function savePageScriptMeta() {
  const current = show.getShow();
  if (!current) return;
  const pageScripts = {};
  for (const [pageId, pageData] of Object.entries(pageScriptMeta)) {
    pageScripts[pageId] = {};
    for (const [sceneKey, meta] of Object.entries(pageData)) {
      pageScripts[pageId][sceneKey] = { name: meta.name, file: meta.file };
    }
  }
  current.page_scripts = pageScripts;
  show.saveShow(current);
}

function stopRunningScript(fkey, reason) {
  const running = runningScripts[fkey];
  if (!running) return false;

  compositor.removeLayer(fkey);

  if (typeof running.context.OnTerminate === 'function') {
    try {
      running.context.OnTerminate();
    } catch (e) {
      console.error(`[script] OnTerminate error ao parar (${reason}) (${fkey}):`, e.message);
    }
  }

  delete runningScripts[fkey];
  return true;
}

function stopAllRunningScripts(reason) {
  for (const fkey of Object.keys(runningScripts)) {
    stopRunningScript(fkey, reason);
  }
  for (const k of Object.keys(runningPageScripts)) {
    const colonIdx = k.indexOf(':');
    stopRunningPageScript(k.slice(0, colonIdx), k.slice(colonIdx + 1), reason);
  }
  compositor.stopAllMacros(); // blackout/shutdown também encerra macros e suas camadas
}

function saveScriptMeta() {
  const current = show.getShow();
  if (!current) return;
  current.scripts = {};
  for (const [fkey, meta] of Object.entries(scriptMeta)) {
    current.scripts[fkey] = { name: meta.name, file: meta.file };
    if (meta.color) current.scripts[fkey].color = meta.color;
  }
  show.saveShow(current);
}

function loadScriptMeta() {
  const current = show.getShow();
  if (!current?.scripts) return;
  for (const [fkey, meta] of Object.entries(current.scripts)) {
    // Resolve o arquivo pelo nome, relativo ao SCRIPTS_DIR desta máquina —
    // ignora caminho absoluto salvo no show (portável entre PCs/clones).
    const file = path.join(SCRIPTS_DIR, `${meta.name}.js`);
    if (fs.existsSync(file)) {
      scriptMeta[fkey] = { name: meta.name, file, color: meta.color || '#000000' };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// OFFSETS DE CANAL (panOffset / tiltOffset por fixture)
// ─────────────────────────────────────────────────────────────

/**
 * Constrói mapa { dmxChannel: offsetValue } lendo panOffset/tiltOffset dos fixtures.
 * Exemplo: Moving Head Beam 1 com panOffset:44, canal pan=132 → { 132: 44 }
 */
function normalizeRuntimeFixtureFields(showData) {
  return normalizeShowFixtureOffsets(showData);
}

function buildChannelOffsetMap() {
  const current = show.getShow();
  return buildFixtureChannelOffsetMap(current?.fixtures || [], isFixtureEnabled);
}

/**
 * Aplica o mapa de offsets no universe e inicializa cada canal de offset com
 * valor lógico 0 (o universe grava físico = offset). Chamado após carregar show.
 * Isso garante que o fader aparece em 0 para o operador desde o início,
 * mas o fixture já recebe o offset físico correto via DMX.
 * Também reconfigura o interpolador de speed virtual.
 */
function initializeOffsets() {
  const offsetMap = buildChannelOffsetMap();
  universe.setChannelOffsets(offsetMap);
  interpolator.configure(buildInterpolatorConfig());
}

/**
 * Constrói configuração para o interpolador de speed virtual.
 * Retorna array de { fixtureId, speedChannel, panChannel, tiltChannel }
 * para cada fixture com virtualPanTiltSpeed: true.
 */
function buildInterpolatorConfig() {
  const current  = show.getShow();
  const fixtures = current?.fixtures || [];
  const configs  = [];

  for (const fx of fixtures) {
    if (!isFixtureEnabled(fx)) continue;
    if (!fx.virtualPanTiltSpeed) continue;

    const start    = Number(fx.startChannel) || 1;
    const channels = Array.isArray(fx.channels) ? fx.channels : [];
    let speedChannel = null, panChannel = null, tiltChannel = null;

    channels.forEach((alias, i) => {
      const norm = normalizeAlias(alias);
      const ch   = start + i;
      if (norm === 'virtual_speed') speedChannel = ch;
      if (norm === 'pan')           panChannel   = ch;
      if (norm === 'tilt')          tiltChannel  = ch;
    });

    if (speedChannel) {
      configs.push({ fixtureId: fx.id, speedChannel, panChannel, tiltChannel });
    }
  }

  return configs;
}

// Normaliza um rótulo de canal para comparação: minúsculo, sem acento, sem
// espaços nas pontas. Alinha com o padrão de aliases do sistema (ASCII).
function normalizeAlias(label) {
  return String(label ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}

function isFixtureEnabled(fixture) {
  return fixture?.enabled !== false;
}

function getFixtureDmxChannels(fixture) {
  if (!fixture) return [];
  const startChannel = Number(fixture.startChannel) || 1;
  const channelCount = Number(fixture.channelCount ?? (fixture.channels || []).length) || 0;
  return Array.from({ length: channelCount }, (_, i) => startChannel + i);
}

function getDisabledFixtureChannelSet() {
  // Um canal só é bloqueado se nenhum fixture HABILITADO o cobre.
  const current = show.getShow();
  const fixtures = current?.fixtures || [];
  const enabledChannels = new Set();
  fixtures.forEach(fixture => {
    if (isFixtureEnabled(fixture)) {
      getFixtureDmxChannels(fixture).forEach(ch => enabledChannels.add(ch));
    }
  });
  const disabledChannels = new Set();
  fixtures.forEach(fixture => {
    if (!isFixtureEnabled(fixture)) {
      getFixtureDmxChannels(fixture).forEach(ch => {
        if (!enabledChannels.has(ch)) disabledChannels.add(ch);
      });
    }
  });
  return disabledChannels;
}

function isDmxChannelEnabled(channel) {
  return !getDisabledFixtureChannelSet().has(Number(channel));
}

function filterDisabledFixtureChannels(channelMap) {
  const disabledChannels = getDisabledFixtureChannelSet();
  const filtered = {};
  Object.entries(channelMap || {}).forEach(([channel, value]) => {
    if (!disabledChannels.has(Number(channel))) filtered[channel] = value;
  });
  return filtered;
}

function setDmxChannelRuntime(channel, value) {
  const ch = Number(channel);
  if (!isDmxChannelEnabled(ch)) return false;
  if (interpolator.isVirtualChannel(ch)) {
    // Canal de speed virtual — alimenta o interpolador, não vai ao universo DMX
    interpolator.setSpeed(ch, value);
    return true;
  }
  if (interpolator.isControlledChannel(ch)) {
    // Canal pan/tilt controlado — define o alvo; interpolador avança no próximo tick
    interpolator.setTarget(ch, value);
    return true;
  }
  universe.setChannel(ch, value);
  return true;
}

function applyDmxChannelMap(channelMap) {
  Object.entries(channelMap || {}).forEach(([channel, value]) => {
    setDmxChannelRuntime(channel, value);
  });
}

function filterDisabledFixtureScenes(scenesMap) {
  const filteredScenes = {};
  Object.entries(scenesMap || {}).forEach(([id, scene]) => {
    filteredScenes[id] = {
      ...scene,
      channels: filterDisabledFixtureChannels(scene?.channels || {}),
    };
  });
  return filteredScenes;
}

// Resolve o canal DMX real (1-based) de um alias dentro de um fixture do show
// carregado em memória. Ex.: getFixtureChannel("fixture_123", "strobo") → 2.
// Retorna null se o fixture não existir ou o alias não estiver mapeado.
function clampDmxValue(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function getShowFixture(fixtureIdOrName) {
  const current = show.getShow();
  const target = String(fixtureIdOrName ?? '');
  const normalizedTarget = normalizeAlias(target);
  return current?.fixtures?.find(fixture =>
    fixture.id === target || normalizeAlias(fixture.name) === normalizedTarget
  ) || null;
}

function getFixtureType(fixture) {
  return normalizeAlias(fixture?.fixtureType || fixture?.type);
}

function isMovingHeadBeamSpeedFixture(fixture) {
  const name = normalizeAlias(fixture?.name);
  return getFixtureType(fixture) === 'moving_head_beam'
    && (name === 'moving head beam 1' || name === 'moving head beam 2');
}

function isRibaltaSpeedFixture(fixture) {
  const name = normalizeAlias(fixture?.name);
  return getFixtureType(fixture) === 'ribalta'
    && (name === 'ribalta_1' || name === 'ribalta_2');
}

function getFixtureChannelByAlias(fixture, alias) {
  if (!fixture || !Array.isArray(fixture.channels)) return null;
  const target = normalizeAlias(alias);
  const aliases = getFixtureAliasCandidates(fixture, target);
  const index = fixture.channels.findIndex(ch => aliases.includes(normalizeAlias(ch)));
  return index === -1 ? null : (Number(fixture.startChannel) || 1) + index;
}

function getFixtureAliasCandidates(fixture, target) {
  if (getFixtureType(fixture) !== 'moving_head_beam') return [target];
  const fallbacks = {
    dimmer: ['dimmer', 'fecho_lampada'],
    speed: ['speed', 'virtual_speed'],
    prism: ['prism', 'prism_1'],
    gobo: ['gobo', 'gobo_wheel'],
    strobo_dimmer: ['strobo_dimmer', 'strobo'],
  };
  return fallbacks[target] || [target];
}

// Resolve o canal DMX real (1-based) de um alias dentro de um fixture do show.
function getFixtureChannel(fixtureId, alias) {
  const fixture = getShowFixture(fixtureId);
  if (!fixture || !isFixtureEnabled(fixture)) return null;
  return getFixtureChannelByAlias(fixture, alias);
}

// Compila um arquivo de script numa CAMADA { buffer, touched, context } pronta para o compositor.
// SetChannel escreve no buffer da camada (guards aplicados na composição). Lança se o arquivo
// não existir ou não compilar. Reutilizado pelas macros (factory por passo).
function compileLayer(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  const buffer = new Uint8Array(512);
  const touched = new Uint8Array(512);
  const ctx = {};
  const SetChannel = (ch, val) => {
    if (ch < 1 || ch > 512) return;
    const idx = ch - 1;
    buffer[idx] = Math.max(0, Math.min(255, Math.round(Number(val))));
    touched[idx] = 1;
  };
  const getChannel = (fixtureId, alias) => getFixtureChannel(fixtureId, alias);
  const fn = new Function('SetChannel', 'getChannel', 'ctx', `
    ${code}
    ctx.OnStart = typeof OnStart === 'function' ? OnStart : null;
    ctx.OnExecute = typeof OnExecute === 'function' ? OnExecute : null;
    ctx.OnTerminate = typeof OnTerminate === 'function' ? OnTerminate : null;
  `);
  fn(SetChannel, getChannel, ctx);
  if (typeof ctx.OnStart === 'function') { try { ctx.OnStart(); } catch (e) {} }
  return { buffer, touched, context: ctx };
}

ipcMain.handle('script:create', async (_, fkey, name, options = {}) => {
  const file = path.join(SCRIPTS_DIR, `${name}.js`);
  const groups = Array.isArray(options.groups) ? options.groups : [];
  const color = typeof options.color === 'string' ? options.color : '#000000';
  const fileAlreadyExists = fs.existsSync(file);
  console.log('[script:create] fkey=%s name=%s groups=%j fileExists=%s', fkey, name, groups, fileAlreadyExists);

  // Sempre (re)escreve quando grupos foram selecionados — garante injeção do banco.
  // Sem grupos: só cria se o arquivo ainda não existe (comportamento original).
  const shouldWrite = groups.length > 0 || !fileAlreadyExists;

  if (shouldWrite) {
    let knowledgeBlock = '';
    if (groups.length > 0) {
      const lines = ['// === BANCO DE CONHECIMENTO DOS APARELHOS ==='];
      groups.forEach(group => {
        const mdFile = path.join(BANCO_DIR, `${group}.md`);
        if (fs.existsSync(mdFile)) {
          const mdContent = fs.readFileSync(mdFile, 'utf-8');
          console.log('[script:create] lendo %s (%d bytes)', mdFile, mdContent.length);
          mdContent.split('\n').forEach(line => lines.push(`// ${line}`));
          lines.push('//');
        } else {
          console.warn('[script:create] arquivo não encontrado: %s', mdFile);
        }
      });
      lines.push('// ===========================================');
      knowledgeBlock = lines.join('\n') + '\n\n';
    }
    console.log('[script:create] knowledgeBlock length=%d', knowledgeBlock.length);
    fs.writeFileSync(file, knowledgeBlock + [
      `function OnStart() {`,
      `  // inicialização`,
      `}`,
      ``,
      `function OnExecute() {`,
      `  // chamado a cada 40ms`,
      `  // SetChannel(canal, valor)`,
      `}`,
      ``,
      `function OnTerminate() {`,
      `  // limpeza ao desativar`,
      `}`,
    ].join('\n'), 'utf-8');
  }
  scriptMeta[fkey] = { name, file, color };
  saveScriptMeta();
  if (!options.skipOpenEditor && !fileAlreadyExists) { await openScriptInVSCode(file); }
  return { ok: true, name, file, color };
});

ipcMain.handle('script:edit', async (_, fkey, filePath) => {
  const meta = scriptMeta[fkey];
  if (filePath) return openScriptInVSCode(filePath);
  if (!meta) return { ok: false, error: 'Nenhum script neste botão' };
  return openScriptInVSCode(meta.file);
});

ipcMain.handle('script:clear', (_, fkey) => {
  stopRunningScript(fkey, 'limpar');
  delete scriptMeta[fkey];
  saveScriptMeta();
  return { ok: true };
});

// Inicia (ou reinicia) o script de uma F-key: lê o arquivo do disco, compila e
// agenda o loop de 40ms. Reutilizado pelo toggle e pelo watch (reload em tempo real).
function startScript(fkey) {
  const meta = scriptMeta[fkey];
  if (!meta) return { ok: false, error: 'Nenhum script neste botão' };
  let code;
  try {
    code = fs.readFileSync(meta.file, 'utf-8');
  } catch (e) {
    return { ok: false, error: 'Arquivo não encontrado' };
  }
  // Buffer próprio da camada (pré-alocado, reusado por frame) + máscara de canais tocados.
  const buffer = new Uint8Array(512);
  const touched = new Uint8Array(512);
  const ctx = {};
  // SetChannel escreve no buffer DA CAMADA (não no universo). Os guards de cena ativa
  // e de fixture desabilitado são aplicados pelo compositor sobre o resultado mesclado.
  const SetChannel = (ch, val) => {
    if (ch < 1 || ch > 512) return;
    const idx = ch - 1;
    buffer[idx] = Math.max(0, Math.min(255, Math.round(Number(val))));
    touched[idx] = 1;
  };
  // getChannel: resolve o canal real de um alias do fixture (ex.: getChannel(id, "strobo")).
  const getChannel = (fixtureId, alias) => getFixtureChannel(fixtureId, alias);
  try {
    const fn = new Function('SetChannel', 'getChannel', 'ctx', `
      ${code}
      ctx.OnStart = typeof OnStart === 'function' ? OnStart : null;
      ctx.OnExecute = typeof OnExecute === 'function' ? OnExecute : null;
      ctx.OnTerminate = typeof OnTerminate === 'function' ? OnTerminate : null;
    `);
    fn(SetChannel, getChannel, ctx);
  } catch (e) {
    return { ok: false, error: `Erro ao compilar: ${e.message}` };
  }
  if (typeof ctx.OnStart === 'function') {
    try { ctx.OnStart(); } catch (e) {}
  }
  // Registra a camada — o relógio único (engine → compositor) roda o OnExecute por frame.
  compositor.addLayer(fkey, {
    buffer, touched, context: ctx,
    onError: () => { delete runningScripts[fkey]; emitScriptsChanged(); },
  });
  runningScripts[fkey] = { context: ctx };
  return { ok: true, running: true };
}

ipcMain.handle('script:toggle', (_, fkey) => {
  if (runningScripts[fkey]) {
    // Parar
    stopRunningScript(fkey, 'toggle');
    return { ok: true, running: false };
  }
  return startScript(fkey);
});

ipcMain.handle('script:list', () => {
  try {
    const colorByName = {};
    for (const meta of Object.values(scriptMeta)) {
      if (meta?.name && meta?.color) colorByName[meta.name] = meta.color;
    }
    const files = fs.readdirSync(SCRIPTS_DIR)
      .filter(f => f.endsWith('.js'))
      .map(f => {
        const name = f.replace('.js', '');
        return { name, file: path.join(SCRIPTS_DIR, f), color: colorByName[name] || '#000000' };
      });
    return { ok: true, files };
  } catch (e) {
    return { ok: false, files: [] };
  }
});

// Monta o mapa de scripts F-key com flag running — usado pelo IPC e pelo watch.
function buildAllScripts() {
  const result = {};
  for (const [fkey, meta] of Object.entries(scriptMeta)) {
    result[fkey] = { ...meta, running: !!runningScripts[fkey] };
  }
  return result;
}

// Notifica o renderer que o conjunto de scripts mudou (watch em tempo real).
function emitScriptsChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scripts:changed', buildAllScripts());
  }
}

ipcMain.handle('script:getAll', () => buildAllScripts());

// ─── WATCH em tempo real do diretório de scripts ─────────────────────────────
// Reage a criar/modificar/remover .js em SCRIPTS_DIR sem reiniciar o app.
let scriptsWatcher = null;
const scriptWatchTimers = {};

function handleScriptFileEvent(filename) {
  if (!filename || !filename.endsWith('.js')) return;
  const file = path.join(SCRIPTS_DIR, filename);
  const exists = fs.existsSync(file);

  if (!exists) {
    // REMOÇÃO: para o script se estiver rodando e limpa do scriptMeta.
    let changed = false;
    for (const [fkey, meta] of Object.entries(scriptMeta)) {
      if (path.basename(meta.file) === filename) {
        stopRunningScript(fkey, 'arquivo removido');
        delete scriptMeta[fkey];
        changed = true;
      }
    }
    if (changed) saveScriptMeta();
    emitScriptsChanged();
    return;
  }

  // MODIFICAÇÃO: se algum F-key que aponta para o arquivo está rodando,
  // para, recarrega do disco e reinicia automaticamente.
  for (const [fkey, meta] of Object.entries(scriptMeta)) {
    if (path.basename(meta.file) === filename && runningScripts[fkey]) {
      stopRunningScript(fkey, 'arquivo modificado');
      startScript(fkey);
    }
  }
  // CRIAÇÃO: scriptMeta é indexado por F-key, então um arquivo novo não recebe
  // associação automática (não há F-key) nem sobrescreve associação existente.
  // Apenas notifica o renderer para a lista de scripts existentes refletir.
  emitScriptsChanged();
}

function startScriptsWatch() {
  if (scriptsWatcher) return;
  try {
    scriptsWatcher = fs.watch(SCRIPTS_DIR, (_eventType, filename) => {
      if (!filename) return;
      const key = String(filename);
      // debounce: fs.watch dispara múltiplos eventos por alteração
      clearTimeout(scriptWatchTimers[key]);
      scriptWatchTimers[key] = setTimeout(() => {
        delete scriptWatchTimers[key];
        try { handleScriptFileEvent(key); }
        catch (e) { console.error('[scripts:watch] erro ao processar', key, e.message); }
      }, 150);
    });
    console.log('[scripts:watch] monitorando', SCRIPTS_DIR);
  } catch (e) {
    console.error('[scripts:watch] não foi possível iniciar:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS — PAGE SCRIPTS
// ─────────────────────────────────────────────────────────────

const SCRIPT_TEMPLATE_BODY = [
  'function OnStart() {',
  '  // inicialização',
  '}',
  '',
  'function OnExecute() {',
  '  // chamado a cada 40ms',
  '  // SetChannel(canal, valor)',
  '}',
  '',
  'function OnTerminate() {',
  '  // limpeza ao desativar',
  '}',
].join('\n');

ipcMain.handle('page_script:create', async (_, pageId, sceneKey, name) => {
  pageId = normalizePageId(pageId);
  const file = path.join(SCRIPTS_DIR, `${name}.js`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, SCRIPT_TEMPLATE_BODY, 'utf-8');
  }
  if (!pageScriptMeta[pageId]) pageScriptMeta[pageId] = {};
  pageScriptMeta[pageId][sceneKey] = { name, file };
  savePageScriptMeta();
  await openScriptInVSCode(file);
  return { ok: true, name, file };
});

ipcMain.handle('page_script:edit', async (_, pageId, sceneKey) => {
  pageId = normalizePageId(pageId);
  const meta = pageScriptMeta[pageId]?.[sceneKey];
  if (!meta) return { ok: false, error: 'Nenhum script nesta tecla' };
  return openScriptInVSCode(meta.file);
});

ipcMain.handle('page_script:clear', (_, pageId, sceneKey) => {
  pageId = normalizePageId(pageId);
  stopRunningPageScript(pageId, sceneKey, 'limpar');
  if (pageScriptMeta[pageId]) delete pageScriptMeta[pageId][sceneKey];
  savePageScriptMeta();
  return { ok: true };
});

ipcMain.handle('page_script:toggle', (_, pageId, sceneKey) => {
  pageId = normalizePageId(pageId);
  const k = psKey(pageId, sceneKey);
  if (runningPageScripts[k]) {
    stopRunningPageScript(pageId, sceneKey, 'toggle');
    return { ok: true, running: false };
  }
  const meta = pageScriptMeta[pageId]?.[sceneKey];
  if (!meta) return { ok: false, error: 'Nenhum script nesta tecla' };
  let code;
  try { code = fs.readFileSync(meta.file, 'utf-8'); }
  catch (e) { return { ok: false, error: 'Arquivo nao encontrado' }; }
  const buffer = new Uint8Array(512);
  const touched = new Uint8Array(512);
  const ctx = {};
  // SetChannel escreve no buffer da camada; guards aplicados pelo compositor.
  const SetChannel = (ch, val) => {
    if (ch < 1 || ch > 512) return;
    const idx = ch - 1;
    buffer[idx] = Math.max(0, Math.min(255, Math.round(Number(val))));
    touched[idx] = 1;
  };
  const getChannel = (fixtureId, alias) => getFixtureChannel(fixtureId, alias);
  try {
    const fn = new Function('SetChannel', 'getChannel', 'ctx', `
      ${code}
      ctx.OnStart     = typeof OnStart     === 'function' ? OnStart     : null;
      ctx.OnExecute   = typeof OnExecute   === 'function' ? OnExecute   : null;
      ctx.OnTerminate = typeof OnTerminate === 'function' ? OnTerminate : null;
    `);
    fn(SetChannel, getChannel, ctx);
  } catch (e) { return { ok: false, error: `Erro ao compilar: ${e.message}` }; }
  if (typeof ctx.OnStart === 'function') { try { ctx.OnStart(); } catch (e) {} }
  compositor.addLayer(`page:${k}`, {
    buffer, touched, context: ctx,
    onError: () => { delete runningPageScripts[k]; },
  });
  runningPageScripts[k] = { context: ctx };
  return { ok: true, running: true };
});

ipcMain.handle('page_script:getAll', (_, pageId) => {
  pageId = normalizePageId(pageId);
  const pageMeta = pageScriptMeta[pageId] || {};
  const result = {};
  for (const [sceneKey, meta] of Object.entries(pageMeta)) {
    result[sceneKey] = { ...meta, running: !!runningPageScripts[psKey(pageId, sceneKey)] };
  }
  return result;
});

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS — MACROS (sequenciador com crossfade — Fase 2)
// ─────────────────────────────────────────────────────────────
const FRAME_MS = 40;
function msToFrames(ms) { return Math.max(0, Math.round((Number(ms) || 0) / FRAME_MS)); }

// Registro de definições de macro (serializável — persistido no show.json em `macros`).
// def = { id, name, mergeMode: 'htp'|'linear', loop, steps: [ { script, durationMs|null, fadeInMs, fadeOutMs, overlapMs } ] }
// durationMs null/'infinite' = passo segura até nextMacroStep.
const macroDefs = {};

function normalizeMacroDef(id, def) {
  return {
    id,
    name: def.name || id,
    mergeMode: def.mergeMode === 'linear' ? 'linear' : 'htp',
    loop: !!def.loop,
    steps: (Array.isArray(def.steps) ? def.steps : []).map(s => ({
      script: s.script ?? s.name ?? '',
      durationMs: (s.durationMs == null || s.durationMs === 'infinite') ? null : Number(s.durationMs),
      fadeInMs: Number(s.fadeInMs) || 0,
      fadeOutMs: Number(s.fadeOutMs) || 0,
      overlapMs: Number(s.overlapMs) || 0,
    })),
  };
}

// Recria a macro no compositor a partir da definição (factory compila o script no disparo).
function instantiateMacro(norm) {
  const steps = norm.steps.map(s => {
    const file = path.join(SCRIPTS_DIR, `${s.script}.js`);
    return {
      makeLayer: () => compileLayer(file),
      durationFrames: s.durationMs == null ? Infinity : Math.max(1, msToFrames(s.durationMs)),
      fadeInFrames: msToFrames(s.fadeInMs),
      fadeOutFrames: msToFrames(s.fadeOutMs),
      overlapFrames: msToFrames(s.overlapMs),
    };
  });
  compositor.createMacro(norm.id, steps, { mergeMode: norm.mergeMode, loop: norm.loop });
}

function saveMacros() {
  const current = show.getShow();
  if (!current) return;
  current.macros = Object.values(macroDefs);
  show.saveShow(current);
}

// Carrega as macros do show na inicialização e as recria no compositor (sem disparar).
function loadMacros() {
  const current = show.getShow();
  if (!current || !Array.isArray(current.macros)) return;
  for (const def of current.macros) {
    if (!def || !def.id) continue;
    const norm = normalizeMacroDef(def.id, def);
    macroDefs[def.id] = norm;
    try { instantiateMacro(norm); } catch (e) { console.error('[macro] falha ao recriar', def.id, e.message); }
  }
}

ipcMain.handle('macro:create', (_, id, def = {}) => {
  try {
    if (!id) return { ok: false, error: 'id da macro obrigatório' };
    const norm = normalizeMacroDef(id, def);
    macroDefs[id] = norm;
    instantiateMacro(norm);
    saveMacros();
    return { ok: true, steps: norm.steps.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('macro:start',  (_, id) => ({ ok: compositor.startMacro(id) }));
ipcMain.handle('macro:stop',   (_, id) => ({ ok: compositor.stopMacro(id) }));
ipcMain.handle('macro:next',   (_, id) => ({ ok: compositor.triggerNextStep(id) }));
ipcMain.handle('macro:remove', (_, id) => {
  const ok = compositor.removeMacro(id);
  delete macroDefs[id];
  saveMacros();
  return { ok };
});

// Lista as macros definidas (para a UI) e o status da macro ativa (para polling).
ipcMain.handle('macro:list',   () => Object.values(macroDefs));
ipcMain.handle('macro:status', () => compositor.getActiveMacroStatus());

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS — FIXTURES
// ─────────────────────────────────────────────────────────────

const FIXTURE_TEMPLATE_PATH = path.join(__dirname, '..', 'shows', 'fixture_template.json');

const FIXTURE_TEMPLATE_DEFAULT = JSON.stringify({
  id: 'fixture_novo',
  name: 'Novo Aparelho',
  manufacturer: '',
  model: '',
  startChannel: 1,
  channelCount: 8,
  channels: ['Dimmer', 'Red', 'Green', 'Blue', 'White', 'Strobe', 'Mode', 'Speed'],
  posX: 0,
  posY: 0,
}, null, 2);

ipcMain.handle('fixture:openTemplate', async () => {
  try {
    if (!fs.existsSync(FIXTURE_TEMPLATE_PATH)) {
      fs.writeFileSync(FIXTURE_TEMPLATE_PATH, FIXTURE_TEMPLATE_DEFAULT, 'utf-8');
      console.log('[fixture] template criado em:', FIXTURE_TEMPLATE_PATH);
    }
    await openScriptInVSCode(FIXTURE_TEMPLATE_PATH);
    return { ok: true, file: FIXTURE_TEMPLATE_PATH };
  } catch (err) {
    console.error('[fixture:openTemplate] erro:', err.message);
    return { ok: false, error: err.message };
  }
});

// ─────────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  if (fs.existsSync(DEFAULT_SHOW)) {
    try {
      show.loadShow(DEFAULT_SHOW);
      console.log('[main] show padrao carregado');
      loadScriptMeta(); loadPageScriptMeta(); loadMacros();
      initializeOffsets();
      const startupChannels = show.getStartupChannels();
      Object.entries(startupChannels).forEach(([ch, value]) => universe.setChannel(Number(ch), value));
      console.log('[main] scripts carregados:', Object.keys(scriptMeta));
    } catch (e) {
      console.warn('[main] falha ao carregar show padrao:', e.message);
    }
  }

  // Guard de fixture desabilitado aplicado na composição (uma vez por frame).
  compositor.setDisabledChannelsProvider(getDisabledFixtureChannelSet);

  engine.start();
  console.log('[main] engine DMX iniciado');

  startScriptsWatch();
});

app.on('window-all-closed', () => {
  engine.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
