/**
 * main.js — Processo principal do Electron
 *
 * Responsabilidades:
 *   - Cria a janela principal
 *   - Registra todos os handlers IPC
 *   - Inicia o engine DMX automaticamente
 *   - Carrega o show padrão na inicialização
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const chokidar = require('chokidar');
const crypto = require('crypto');
const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const { execFile, spawn } = require('child_process');

const universe     = require('./engine/universe');
const engine       = require('./engine/engine');
const compositor   = require('./engine/compositor');
const artnet       = require('./engine/artnet');
const show         = require('./show');
const scriptLibraryLogic = require('./scriptLibrary');
const scriptWatcherLogic = require('./scriptWatcherLogic');
const interpolator = require('./engine/interpolator');
const {
  buildChannelOffsetMap: buildFixtureChannelOffsetMap,
  normalizeShowFixtureOffsets,
} = require('./fixtureOffsets');
const fixtureAdapter = require('./adapter');
const ribaltaDebug = require('./engine/ribaltaDebug');
const ribaltaPhysicalCalib = require('./ribaltaPhysicalCalib');

const RIBALTA_APPLY_ORDER = [
  'function', 'speed', 'dimmer',
  'led_1', 'led_2', 'led_3', 'led_4', 'led_5', 'led_6', 'led_7', 'led_8',
  'strobo', 'tilt',
];

// Rede de segurança: um erro não previsto em qualquer parte do processo main
// (fora dos try/catch já existentes no loop da engine e no compositor) não pode
// derrubar o app inteiro no meio de um evento ao vivo. Loga e mantém rodando.
process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException — processo continua rodando:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection — processo continua rodando:', reason);
});

const isDev = !app.isPackaged;
const DEFAULT_SHOW = path.join(__dirname, '..', 'shows', 'vp.show.json');

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', 'vp-light');
  app.setDesktopName('vp-light.desktop');
}

app.setName('VP Light');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.vplight.app');
}

const iconPath = process.platform === 'win32'
  ? path.resolve(__dirname, '..', 'assets', 'icons', 'icon.ico')
  : path.resolve(__dirname, '..', 'assets', 'icons', 'icon.png');

const appIcon = nativeImage.createFromPath(iconPath);

console.log('[VP Light] platform:', process.platform);
console.log('[VP Light] iconPath:', iconPath);
console.log('[VP Light] icon exists:', fs.existsSync(iconPath));
console.log('[VP Light] icon empty:', appIcon.isEmpty());

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
    icon: appIcon,
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
    lastViewer3DScriptLabelsKey = '';
    broadcastActiveScriptsToViewer3DIfChanged();
    return viewer3DWindow;
  }

  viewer3DWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    resizable: true,
    title: 'vp-light 3D — Vida e Paz',
    icon: appIcon,
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

  viewer3DWindow.webContents.on('did-finish-load', () => {
    lastViewer3DScriptLabelsKey = '';
    broadcastActiveScriptsToViewer3DIfChanged();
  });

  return viewer3DWindow;
}

// Nomes dos scripts em execução (F-keys, page-scripts, passo atual de macro).
function getActiveScriptLabelsForViewer3D() {
  const labels = [];
  const library = show.getShow()?.scriptLibrary || {};
  for (const [scriptId, running] of Object.entries(runningScripts)) {
    if (running && library[scriptId]?.label) labels.push(library[scriptId].label);
  }
  for (const [k, running] of Object.entries(runningPageScripts)) {
    if (!running) continue;
    const colonIdx = k.indexOf(':');
    const pageId = k.slice(0, colonIdx);
    const sceneKey = k.slice(colonIdx + 1);
    const meta = pageScriptMeta[pageId]?.[sceneKey];
    if (meta?.name) labels.push(meta.name);
  }
  const macroStatus = compositor.getActiveMacroStatus();
  if (macroStatus) {
    const def = macroDefs[macroStatus.id];
    const step = def?.steps?.[macroStatus.stepIndex];
    if (step?.script) labels.push(step.script);
  }
  return [...new Set(labels)];
}

let lastViewer3DScriptLabelsKey = '';

function broadcastActiveScriptsToViewer3DIfChanged() {
  if (!viewer3DWindow || viewer3DWindow.isDestroyed()) return;
  const labels = getActiveScriptLabelsForViewer3D();
  const key = labels.join('\u0001');
  if (key === lastViewer3DScriptLabelsKey) return;
  lastViewer3DScriptLabelsKey = key;
  viewer3DWindow.webContents.send('viewer3d:active-scripts', labels);
}

// Envia o universo DMX (512 canais) para a janela 3D a cada frame da engine.
// Aproveita o ciclo existente de 40ms (engine.onFrame) — nenhum loop novo.
// Se a janela 3D não estiver aberta, ignora silenciosamente.
function broadcastDmxUniverseToViewer3D(universeBuffer) {
  if (!viewer3DWindow || viewer3DWindow.isDestroyed()) return;
  viewer3DWindow.webContents.send('dmx-universe', Array.from(universeBuffer));
  broadcastActiveScriptsToViewer3DIfChanged();
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

ipcMain.handle('performance:getSnapshot', () => {
  return {
    ok: true,
    frame: engine.getPerformanceSnapshot(),
    layers: compositor.getPerformanceSnapshot(),
  };
});

// Retorna as interfaces de rede ativas usadas para envio Art-Net.
// Útil para diagnóstico e seleção manual de interface no renderer.
ipcMain.handle('artnet:getInterfaces', () => artnet.getActiveInterfaces());

// Congela/descongela a saída Art-Net (UDP). Engine/compositor/viewer 3D (IPC) seguem.
ipcMain.handle('artnet:getFrozen', () => ({ frozen: artnet.isFrozen() }));

ipcMain.handle('artnet:setFrozen', (_, frozen) => {
  const wasFrozen = artnet.isFrozen();
  artnet.setFrozen(frozen);
  // Descongelar: envia o universo atual imediatamente — não espera o próximo tick de 40ms
  // e não zera o buffer (diferente de blackout/restoreState).
  if (wasFrozen && !frozen) {
    artnet.flushArtDMX(ribaltaPhysicalCalib.getPhysicalUniverseForArtNet(universe.getUniverse()));
  }
  return { ok: true, frozen: artnet.isFrozen() };
});

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
  emitScriptsChanged();
  return { ok: true };
});

function filterSceneMapByActiveScripts(channelMap) {
  const controlled = compositor.getActiveControlledChannels();
  let skipped = 0;
  const filtered = {};
  for (const [channel, value] of Object.entries(channelMap || {})) {
    const idx = Number(channel) - 1;
    if (idx >= 0 && idx < 512 && controlled[idx]) {
      skipped++;
      continue;
    }
    filtered[channel] = value;
  }
  if (skipped > 0) {
    ribaltaDebug.logRestoreState('restoreState:skip-script-controlled', filtered, { skipped });
  }
  return filtered;
}

ipcMain.handle('dmx:restoreState', (_, channels) => {
  const filtered = filterDisabledFixtureChannels(channels);
  const anyScriptRunning = compositor.hasActiveControlLayers();

  ribaltaDebug.logRestoreState('restoreState:before', filtered, { anyScriptRunning });

  // Com scripts ativos: reaplica cenas sem blackout total — evita apagar o palco
  // enquanto o compositor reescreve os canais dos scripts no próximo tick.
  // Canais ainda controlados por camadas ativas ficam de fora — moving continua
  // após ligar um script de brut ou após parar outro script da mesma família.
  if (anyScriptRunning) {
    applyDmxChannelMap(filterSceneMapByActiveScripts(filtered), 'restoreState/merge');
  } else {
    universe.blackout();
    ribaltaDebug.logRestoreState('restoreState:after-blackout', filtered);
    applyDmxChannelMap(filtered, 'restoreState');
  }
  ribaltaDebug.logRestoreState('restoreState:after', filtered);
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

// Mapa de canais das cenas ativas — usado pelo renderer para restoreState e conflitos.
// color_wheel / prisma do moving com valor ≠ 0 na cena ficam lockados: scripts não sobrescrevem.
let activeSceneChannels = {}; // { [canal]: valor }

ipcMain.handle('dmx:setActiveSceneChannels', (_, channels, _parLedChs) => {
  activeSceneChannels = filterDisabledFixtureChannels(channels);
  _applySceneLock();
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

    // Para F-Keys, page-scripts e macros do show anterior — evita camadas fantasmas
    // do show antigo sobrevivendo sobre o universo do show novo.
    stopAllRunningScripts('show:load');
    const data = show.loadShow(targetPath);
    loadPageScriptMeta();
    loadMacros();
    initializeOffsets();
    const startupChannels = show.getStartupChannels();
    Object.entries(startupChannels).forEach(([ch, value]) => universe.setChannel(Number(ch), value));
    applyDefaultStartupScene();
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
      '| scriptLibrary:', Object.keys(showData.scriptLibrary || {})
    );
    console.log('[show:save] runningScripts no main:', Object.keys(runningScripts));
    console.log('[show:save] currentShow no disco:',
      'fixtures:', currentShow?.fixtures?.length,
      '| páginas:', Object.keys(currentShow?.pages || {}),
      '| scriptLibrary:', Object.keys(currentShow?.scriptLibrary || {})
    );

    // Scripts, páginas, page_scripts e macros: merge via buildMergedShow (fonte runtime do main).
    const merged = buildMergedShow(showData);

    // ── LOG 2: o que vai para o disco ────────────────────────────────────────
    console.log('[show:save] gravando no disco:',
      'fixtures:', merged.fixtures?.length,
      '| páginas:', Object.keys(merged.pages),
      '| cenas por página:', Object.fromEntries(
        Object.entries(merged.pages).map(([k, v]) => [k, Object.keys(v.scenes || {})])
      ),
      '| scriptLibrary:', Object.keys(merged.scriptLibrary || {})
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
    const merged = buildMergedShow(showData);
    show.saveShowAs(filePath, merged);
    loadPageScriptMeta();
    loadMacros();
    initializeOffsets();
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
const runningScripts = {}; // { [scriptId]: { context } }
const scriptReloadErrors = new Map(); // scriptId -> { stage, error, timestamp }

// ─── PAGE SCRIPTS (teclas de cena) ──────────────────────────────────────────
const pageScriptMeta    = {}; // { [pageId]: { [sceneKey]: { name, file } } }
const runningPageScripts = {}; // flat key `${pageId}:${sceneKey}` → { interval, context }

function normalizePageId(pageId) {
  return String(Math.max(1, Number.parseInt(pageId, 10) || 1));
}

function psKey(pageId, sceneKey) { return `${normalizePageId(pageId)}:${sceneKey}`; }

/**
 * Mescla showData do renderer com metadados runtime do main (scripts, page_scripts, páginas, macros).
 * Usado por show:save e show:saveAs.
 */
function buildMergedShow(showData) {
  const currentShow = show.getShow();
  const scriptLibrary = currentShow?.scriptLibrary || {};
  const scriptPages = show.normalizeScriptPages(currentShow?.scriptPages);

  const mergedPages = {};
  const allPageIds = new Set([
    ...Object.keys(currentShow?.pages || {}),
    ...Object.keys(showData?.pages || {}),
  ]);
  for (const pid of allPageIds) {
    const fromMain = currentShow?.pages?.[pid] || {};
    const fromRenderer = showData?.pages?.[pid] || {};
    mergedPages[pid] = {
      name: fromRenderer.name || fromMain.name || `Página ${pid}`,
      scenes: { ...(fromMain.scenes || {}), ...(fromRenderer.scenes || {}) },
    };
  }

  const mergedPageScripts = {};
  for (const [pgId, pgData] of Object.entries(pageScriptMeta)) {
    if (!mergedPageScripts[pgId]) mergedPageScripts[pgId] = {};
    for (const [sceneKey, meta] of Object.entries(pgData)) {
      mergedPageScripts[pgId][sceneKey] = { name: meta.name, file: meta.file };
    }
  }

  const mergedShow = normalizeRuntimeFixtureFields({
    ...showData,
    scriptLibrary,
    scriptPages,
    scriptSchemaVersion: show.SCRIPT_SCHEMA_VERSION,
    pages: mergedPages,
    page_scripts: mergedPageScripts,
    macros: currentShow?.macros ?? showData?.macros ?? [],
  });
  delete mergedShow.scripts;
  return mergedShow;
}

function stopRunningPageScript(pageId, sceneKey, reason) {
  pageId = normalizePageId(pageId);
  const k = psKey(pageId, sceneKey);
  const running = runningPageScripts[k];
  if (!running) return false;
  compositor.stopLayer(`page:${k}`);
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

function stopAllRunningScripts(reason) {
  for (const scriptId of Object.keys(runningScripts)) {
    stopScriptById(scriptId, reason);
  }
  for (const k of Object.keys(runningPageScripts)) {
    const colonIdx = k.indexOf(':');
    stopRunningPageScript(k.slice(0, colonIdx), k.slice(colonIdx + 1), reason);
  }
  compositor.stopAllMacros(); // blackout/shutdown também encerra macros e suas camadas
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
  const current = show.getShow();
  const fixtures = current?.fixtures || [];
  const offsetMap = buildChannelOffsetMap();
  universe.setChannelOffsets(offsetMap);
  interpolator.configure(buildInterpolatorConfig());
  ribaltaPhysicalCalib.configureFromFixtures(fixtures, isFixtureEnabled);
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

function findFixtureOwningChannel(ch, fixtures) {
  const target = Number(ch);
  for (const fixture of fixtures || []) {
    if (!isFixtureEnabled(fixture)) continue;
    const start = Number(fixture.startChannel) || 1;
    const count = Number(fixture.channelCount ?? (fixture.channels || []).length) || 0;
    if (target >= start && target < start + count) return fixture;
  }
  return null;
}

function getChannelAliasAt(fixture, ch) {
  const start = Number(fixture.startChannel) || 1;
  const idx = Number(ch) - start;
  const channels = fixture.channels || [];
  if (idx < 0 || idx >= channels.length) return null;
  return channels[idx];
}

/** Cena com valor ≠ 0 em color_wheel ou prisma do moving head → script não sobrescreve. */
function buildMovingHeadSceneLockState(channelMap) {
  const mask = new Uint8Array(512);
  const values = {};
  const fixtures = show.getShow()?.fixtures || [];

  for (const [channel, value] of Object.entries(channelMap || {})) {
    const ch = Number(channel);
    const v = Number(value);
    if (ch < 1 || ch > 512 || v === 0) continue;

    const fixture = findFixtureOwningChannel(ch, fixtures);
    if (!fixture || getFixtureType(fixture) !== 'moving_head_beam') continue;

    const aliasNorm = normalizeAlias(getChannelAliasAt(fixture, ch));
    if (!aliasNorm) continue;

    const isColor = aliasNorm === 'color_wheel';
    const isPrism = getFixtureAliasCandidates(fixture, 'prism').includes(aliasNorm);
    if (!isColor && !isPrism) continue;

    mask[ch - 1] = 1;
    values[ch] = v;
  }

  return { mask, values };
}

function _applySceneLock() {
  const { mask, values } = buildMovingHeadSceneLockState(activeSceneChannels);
  compositor.setSceneLock(mask, values);
}

function setDmxChannelRuntime(channel, value, origin = 'runtime') {
  const ch = Number(channel);
  if (!isDmxChannelEnabled(ch)) return false;
  if (interpolator.isVirtualChannel(ch)) {
    // Canal de speed virtual — alimenta o interpolador, não vai ao universo DMX
    interpolator.setSpeed(ch, value);
    ribaltaDebug.logSetChannel(origin, ch, value);
    return true;
  }
  if (interpolator.isControlledChannel(ch)) {
    // Canal pan/tilt controlado — define o alvo; interpolador avança no próximo tick
    interpolator.setTarget(ch, value);
    ribaltaDebug.logSetChannel(origin, ch, value);
    return true;
  }
  universe.setChannel(ch, value);
  ribaltaDebug.logSetChannel(origin, ch, value);
  return true;
}

/**
 * Aplica mapa de cena com ordem segura para ribaltas motorizadas:
 * function → speed → demais canais → tilt por último.
 * Garante function=0 (modo DMX manual) quando a cena toca a ribalta mas não inclui function.
 */
function applyDmxChannelMap(channelMap, origin = 'apply') {
  const map = channelMap || {};
  const applied = new Set();

  for (const fixture of getMotorizedRibaltaFixtures()) {
    const start = Number(fixture.startChannel) || 1;
    const aliases = Array.isArray(fixture.channels) ? fixture.channels : [];
    const hasAny = aliases.some((_, index) => channelMapHasKey(map, start + index));
    if (!hasAny) continue;

    for (const alias of RIBALTA_APPLY_ORDER) {
      const ch = getFixtureChannelByAlias(fixture, alias);
      if (!ch) continue;
      if (channelMapHasKey(map, ch)) {
        setDmxChannelRuntime(ch, channelMapGet(map, ch), origin);
        applied.add(ch);
      } else if (alias === 'function') {
        setDmxChannelRuntime(ch, 0, `${origin}/function-baseline`);
        applied.add(ch);
      }
    }
  }

  for (const [channel, value] of Object.entries(map)) {
    const ch = Number(channel);
    if (!applied.has(ch)) setDmxChannelRuntime(ch, value, origin);
  }
}

/** Aplica cena A da página 1 como cena ativa no main (DMX + lock do compositor). */
function applyDefaultStartupScene() {
  const defaultScene = show.getDefaultStartupScene();
  if (!defaultScene) return;
  const channels = filterDisabledFixtureChannels(defaultScene.channels);
  activeSceneChannels = { ...channels };
  _applySceneLock();
  applyDmxChannelMap(channels);
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

function isMotorizedRibaltaFixture(fixture) {
  return isRibaltaSpeedFixture(fixture);
}

function getMotorizedRibaltaFixtures() {
  return (show.getShow()?.fixtures || []).filter(f => isFixtureEnabled(f) && isMotorizedRibaltaFixture(f));
}

function channelMapHasKey(map, ch) {
  return Object.prototype.hasOwnProperty.call(map || {}, ch)
    || Object.prototype.hasOwnProperty.call(map || {}, String(ch));
}

function channelMapGet(map, ch) {
  return map[ch] ?? map[String(ch)];
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

function resolveAdapterValue(fixtureId, alias, adapterKey, logicalValue) {
  return fixtureAdapter.resolve(
    getShowFixture,
    getFixtureChannelByAlias,
    isFixtureEnabled,
    fixtureId,
    alias,
    adapterKey,
    logicalValue,
  );
}

// API exposta na sandbox de scripts ao lado de SetChannel e getChannel.
function buildScriptSandbox(buffer, touched, controlledMask) {
  const SetChannel = (ch, val) => {
    if (compositor.isSceneLockedChannel(ch)) return;
    if (ch < 1 || ch > 512) return;
    const idx = ch - 1;
    buffer[idx] = Math.max(0, Math.min(255, Math.round(Number(val))));
    touched[idx] = 1;
    if (controlledMask) controlledMask[idx] = 1;
  };
  const getChannel = (fixtureId, alias) => getFixtureChannel(fixtureId, alias);
  // Dependencias injetadas na API semantica do adapter (Checkpoint 2/3 do
  // adapter semantico) — reusa exatamente a mesma resolucao de fixture/canal
  // e a mesma SetChannel desta camada, sem duplicar offset/calibracao/
  // interpolador (tudo isso ja acontece depois, no compositor/universe).
  const semanticDeps = {
    getFixture: getShowFixture,
    getChannelByAlias: getFixtureChannelByAlias,
    isEnabled: isFixtureEnabled,
    writeChannel: SetChannel,
  };
  const adapter = {
    resolve: (fixtureId, alias, adapterKey, logicalValue) =>
      resolveAdapterValue(fixtureId, alias, adapterKey, logicalValue),
    setColor: (fixtureId, colorName) =>
      fixtureAdapter.setColor(semanticDeps, fixtureId, colorName),
    setDimmer: (fixtureId, intensity) =>
      fixtureAdapter.setDimmer(semanticDeps, fixtureId, intensity),
    setMovementSpeed: (fixtureId, speed) =>
      fixtureAdapter.setMovementSpeed(semanticDeps, fixtureId, speed),
    setPanTilt: (fixtureId, panTilt) =>
      fixtureAdapter.setPanTilt(semanticDeps, fixtureId, panTilt),
    setStrobe: (fixtureId, intent) =>
      fixtureAdapter.setStrobe(semanticDeps, fixtureId, intent),
    setPrism: (fixtureId, intent) =>
      fixtureAdapter.setPrism(semanticDeps, fixtureId, intent),
    setGobo: (fixtureId, value) =>
      fixtureAdapter.setGobo(semanticDeps, fixtureId, value),
    setFocus: (fixtureId, intent) =>
      fixtureAdapter.setFocus(semanticDeps, fixtureId, intent),
    setFrost: (fixtureId, intent) =>
      fixtureAdapter.setFrost(semanticDeps, fixtureId, intent),
    setPrismRotation: (fixtureId, intent) =>
      fixtureAdapter.setPrismRotation(semanticDeps, fixtureId, intent),
    getCapabilities: (fixtureId) =>
      fixtureAdapter.getCapabilities(semanticDeps, fixtureId),
  };
  return { SetChannel, getChannel, adapter };
}

const MOV_PADRAO_PRESET = path.join(SCRIPTS_DIR, 'mov-preset.js');
const FIRE_BASE_PRESET = path.join(SCRIPTS_DIR, 'fire-base.js');

/** Scripts mov-* (exceto mov-preset.js) concatenam o preset antes de compilar. */
function scriptPrependsMovPreset(filePath) {
  const base = path.basename(filePath);
  if (base === 'mov-preset.js') return false;
  return base.startsWith('mov-') && base.endsWith('.js');
}

/** Scripts fire-* (exceto fire-base.js) concatenam a biblioteca fire-base antes de compilar. */
function scriptPrependsFireBase(filePath) {
  const base = path.basename(filePath);
  if (base === 'fire-base.js') return false;
  return base.startsWith('fire-') && base.endsWith('.js');
}

function readScriptCode(filePath) {
  let code = fs.readFileSync(filePath, 'utf-8');
  if (scriptPrependsMovPreset(filePath)) {
    if (fs.existsSync(MOV_PADRAO_PRESET)) {
      code = fs.readFileSync(MOV_PADRAO_PRESET, 'utf-8') + '\n\n' + code;
    }
  } else if (scriptPrependsFireBase(filePath)) {
    if (fs.existsSync(FIRE_BASE_PRESET)) {
      code = fs.readFileSync(FIRE_BASE_PRESET, 'utf-8') + '\n\n' + code;
    }
  }
  return code;
}

// Orçamento de execução por hook de script, em ms. O frame do engine tem 40ms
// (25fps) — 30ms deixa margem pro resto do trabalho do frame (interpolador,
// compositor, Art-Net). Protege contra `while(true)`/recursão infinita num
// script de usuário: `vm` interrompe JS síncrono nos back-edges de loop e em
// chamadas de função (não interrompe uma única chamada nativa bloqueante, mas
// scripts só chamam SetChannel/getChannel/adapter, tudo síncrono e não-bloqueante).
const SCRIPT_HOOK_TIMEOUT_MS = 30;
// Scripts reutilizáveis só pra invocar o hook já definido no contexto — o timeout
// se aplica à chamada em si, não só à definição inicial do script.
const CALL_ON_START = new vm.Script('OnStart();', { filename: 'vp-light:call-onstart.js' });
const CALL_ON_EXECUTE = new vm.Script('OnExecute();', { filename: 'vp-light:call-onexecute.js' });
const CALL_ON_TERMINATE = new vm.Script('OnTerminate();', { filename: 'vp-light:call-onterminate.js' });

function compileScriptContext(code, buffer, touched, controlledMask) {
  const { SetChannel, getChannel, adapter } = buildScriptSandbox(buffer, touched, controlledMask);
  const context = vm.createContext({ SetChannel, getChannel, adapter });
  const definitionScript = new vm.Script(code, { filename: 'vp-light:script.js' });
  definitionScript.runInContext(context, { timeout: SCRIPT_HOOK_TIMEOUT_MS });

  const ctx = {};
  ctx.OnStart = typeof context.OnStart === 'function'
    ? () => CALL_ON_START.runInContext(context, { timeout: SCRIPT_HOOK_TIMEOUT_MS })
    : null;
  ctx.OnExecute = typeof context.OnExecute === 'function'
    ? () => CALL_ON_EXECUTE.runInContext(context, { timeout: SCRIPT_HOOK_TIMEOUT_MS })
    : null;
  ctx.OnTerminate = typeof context.OnTerminate === 'function'
    ? () => CALL_ON_TERMINATE.runInContext(context, { timeout: SCRIPT_HOOK_TIMEOUT_MS })
    : null;
  return ctx;
}

function checkScriptCompileError(file) {
  try {
    const code = readScriptCode(file);
    // Construído, mas nunca invocado: detecta apenas erros de sintaxe.
    new Function('SetChannel', 'getChannel', 'adapter', 'ctx', `
    ${code}
    ctx.OnStart = typeof OnStart === 'function' ? OnStart : null;
    ctx.OnExecute = typeof OnExecute === 'function' ? OnExecute : null;
    ctx.OnTerminate = typeof OnTerminate === 'function' ? OnTerminate : null;
  `);
    return null;
  } catch (e) {
    return e.message;
  }
}

// Compila um arquivo de script numa CAMADA { buffer, touched, context } pronta para o compositor.
// SetChannel escreve no buffer da camada (guards aplicados na composição). Lança se o arquivo
// não existir ou não compilar. Reutilizado pelas macros (factory por passo).
function compileLayer(filePath) {
  const code = readScriptCode(filePath);
  const buffer = new Uint8Array(512);
  const touched = new Uint8Array(512);
  const controlledMask = new Uint8Array(512);
  const ctx = compileScriptContext(code, buffer, touched, controlledMask);
  if (typeof ctx.OnStart === 'function') { try { ctx.OnStart(); } catch (e) {} }
  return { buffer, touched, controlledMask, context: ctx };
}

ipcMain.handle('script:create', async (_, pageId, fkey, name, options = {}) => {
  if (!show.isSafeRelativeEntry(`${name}.js`)) {
    return { ok: false, error: `Nome de script inválido: "${name}".` };
  }
  const groups = Array.isArray(options.groups) ? options.groups : [];
  if (!groups.every(group => show.isSafeRelativeEntry(`${group}.md`))) {
    return { ok: false, error: 'Grupo de conhecimento inválido.' };
  }
  const file = path.join(SCRIPTS_DIR, `${name}.js`);
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
      `  // adapter.resolve(fixtureId, alias, adapterKey, valorLogico)`,
      `}`,
      ``,
      `function OnTerminate() {`,
      `  // limpeza ao desativar`,
      `}`,
    ].join('\n'), 'utf-8');
  }
  const current = show.getShow();
  if (!current) return { ok: false, error: 'Nenhum show carregado.' };
  const id = show.slugifyScriptId(name);
  let library = current.scriptLibrary || {};
  if (!library[id]) {
    library = scriptLibraryLogic.registerEntry(library, id, `${name}.js`, { label: name, color });
  } else if (color) {
    library = scriptLibraryLogic.updateEntry(library, id, { color });
  }
  const previous = scriptLibraryLogic.resolveScriptSlot(
    library, current.scriptPages, pageId, fkey
  );
  // Evita deixar uma camada DMX órfã quando a associação forçada substitui o slot.
  if (previous && previous.scriptId !== id && runningScripts[previous.scriptId]) {
    stopScriptById(previous.scriptId, 'script:create substituiu o slot');
  }
  let pages;
  try {
    pages = scriptLibraryLogic.forceAssociateEntry(library, current.scriptPages, id, pageId, fkey);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  current.scriptLibrary = library;
  current.scriptPages = pages;
  current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
  show.saveShow(current);
  emitScriptsChanged(); // avisa o renderer na hora — nao depende do fs.watch (que nao dispara se o .js ja existia)
  if (!options.skipOpenEditor && !fileAlreadyExists) { await openScriptInVSCode(file); }
  return { ok: true, name, file, color };
});

ipcMain.handle('script:edit', async (_, pageId, fkey, filePath) => {
  if (filePath) return openScriptInVSCode(filePath);
  const current = show.getShow();
  const resolved = scriptLibraryLogic.resolveScriptSlot(
    current?.scriptLibrary || {}, current?.scriptPages || { pages: [] }, pageId, fkey
  );
  if (!resolved) return { ok: false, error: 'Nenhum script neste botão' };
  return openScriptInVSCode(path.join(SCRIPTS_DIR, resolved.entry.entry));
});

ipcMain.handle('script:clear', (_, pageId, fkey) => {
  const current = show.getShow();
  if (!current) return { ok: true };
  const resolved = scriptLibraryLogic.resolveScriptSlot(
    current.scriptLibrary || {}, current.scriptPages || { pages: [] }, pageId, fkey
  );
  if (!resolved) return { ok: true };
  stopScriptById(resolved.scriptId, 'limpar');
  current.scriptPages = scriptLibraryLogic.unassignEntry(
    current.scriptLibrary || {}, current.scriptPages || { pages: [] }, resolved.scriptId
  );
  current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
  show.saveShow(current);
  emitScriptsChanged();
  return { ok: true };
});

function scriptLayerId(scriptId) {
  return `script:${scriptId}`;
}

function compileScriptForSwap(absPath) {
  let code;
  try {
    code = readScriptCode(absPath);
  } catch (e) {
    return { ok: false, stage: 'read', error: e.message || 'Arquivo não encontrado' };
  }
  const buffer = new Uint8Array(512);
  const touched = new Uint8Array(512);
  const controlledMask = new Uint8Array(512);
  let ctx;
  try {
    ctx = compileScriptContext(code, buffer, touched, controlledMask);
  } catch (e) {
    return { ok: false, stage: 'compile', error: e.message };
  }
  if (!ctx.OnStart && !ctx.OnExecute && !ctx.OnTerminate) {
    return {
      ok: false,
      stage: 'validate',
      error: 'Nenhum hook (OnStart/OnExecute/OnTerminate) definido no script.',
    };
  }
  if (typeof ctx.OnStart === 'function') {
    try {
      ctx.OnStart();
    } catch (e) {
      return { ok: false, stage: 'onstart', error: e.message };
    }
  }
  return { ok: true, buffer, touched, controlledMask, context: ctx };
}

function startScriptById(scriptId) {
  const current = show.getShow();
  const entry = current?.scriptLibrary?.[scriptId];
  if (!entry) return { ok: false, error: 'Script não encontrado na biblioteca.' };
  const file = path.join(SCRIPTS_DIR, entry.entry);
  const compiled = compileScriptForSwap(file);
  if (!compiled.ok) {
    scriptReloadErrors.set(scriptId, {
      stage: compiled.stage,
      error: compiled.error,
      timestamp: Date.now(),
    });
    return { ok: false, error: compiled.error, stage: compiled.stage };
  }
  scriptReloadErrors.delete(scriptId);
  // Registra a camada — o relógio único (engine → compositor) roda o OnExecute por frame.
  const layerId = scriptLayerId(scriptId);
  compositor.addLayer(layerId, {
    buffer: compiled.buffer,
    touched: compiled.touched,
    controlledMask: compiled.controlledMask,
    context: compiled.context,
    onError: () => { delete runningScripts[scriptId]; emitScriptsChanged(); },
  });
  runningScripts[scriptId] = { context: compiled.context };
  return { ok: true, running: true };
}

function swapRunningScript(scriptId, absPath, reason) {
  const compiled = compileScriptForSwap(absPath);
  if (!compiled.ok) {
    scriptReloadErrors.set(scriptId, {
      stage: compiled.stage,
      error: compiled.error,
      timestamp: Date.now(),
    });
    console.error(`[hot-reload] ${scriptId}: falha ao recarregar (${compiled.stage}): ${compiled.error} — mantendo versão anterior em execução.`);
    emitScriptsChanged();
    return false;
  }
  scriptReloadErrors.delete(scriptId);
  // A nova versão já foi validada; stop + add são síncronos e sem frame intermediário.
  stopScriptById(scriptId, reason);
  const layerId = scriptLayerId(scriptId);
  compositor.addLayer(layerId, {
    buffer: compiled.buffer,
    touched: compiled.touched,
    controlledMask: compiled.controlledMask,
    context: compiled.context,
    onError: () => { delete runningScripts[scriptId]; emitScriptsChanged(); },
  });
  runningScripts[scriptId] = { context: compiled.context };
  emitScriptsChanged();
  return true;
}

function stopScriptById(scriptId, reason) {
  const running = runningScripts[scriptId];
  if (!running) return false;
  compositor.stopLayer(scriptLayerId(scriptId));
  delete runningScripts[scriptId];
  return true;
}

function toggleScriptAtSlot(pageId, slot) {
  const current = show.getShow();
  const resolved = scriptLibraryLogic.resolveScriptSlot(
    current?.scriptLibrary || {}, current?.scriptPages || { pages: [] }, pageId, slot
  );
  if (!resolved) return { ok: false, error: 'Slot vazio ou script inválido.' };
  const { scriptId } = resolved;
  let result;
  if (runningScripts[scriptId]) {
    stopScriptById(scriptId, 'toggle');
    result = { ok: true, running: false };
  } else {
    result = startScriptById(scriptId);
  }
  emitScriptsChanged();
  return { ...result, scriptId };
}

ipcMain.handle('script:toggle', (_, fkey) => toggleScriptAtSlot('page-1', fkey));
ipcMain.handle('script:toggleAt', (_, pageId, slot) => toggleScriptAtSlot(pageId, slot));

function collectScripts(dir, relBase, inheritedColorByName) {
  let colorByName = inheritedColorByName;
  if (!colorByName) {
    colorByName = {};
    const current = show.getShow();
    for (const entry of Object.values(current?.scriptLibrary || {})) {
      if (entry?.entry && entry?.color) {
        const key = entry.entry.replace(/\.js$/i, '').replace(/\\/g, '/');
        colorByName[key] = entry.color;
      }
    }
  }
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'backlog') continue;
      const sub = relBase ? `${relBase}/${entry.name}` : entry.name;
      results.push(...collectScripts(path.join(dir, entry.name), sub, colorByName));
    } else if (entry.name.endsWith('.js')) {
      const baseName = entry.name.replace('.js', '');
      const relName = relBase ? `${relBase}/${baseName}` : baseName;
      const file = path.join(dir, entry.name);
      results.push({ name: relName, file, color: colorByName[relName] || colorByName[baseName] || '#000000' });
    }
  }
  return results;
}

function collectDiskScriptEntries() {
  return collectScripts(SCRIPTS_DIR, '').map(file => `${file.name}.js`);
}

ipcMain.handle('script:list', () => {
  try {
    const files = collectScripts(SCRIPTS_DIR, '');
    return { ok: true, files };
  } catch (e) {
    return { ok: false, files: [] };
  }
});

function buildScriptLibrarySnapshot() {
  const current = show.getShow();
  const library = current?.scriptLibrary || {};
  const scriptPages = current?.scriptPages || { pages: [] };
  const diskEntries = collectDiskScriptEntries();
  const runningLibraryIds = Object.keys(runningScripts);
  const view = scriptLibraryLogic.buildLibraryView(library, scriptPages, diskEntries, runningLibraryIds);
  const registered = view.registered.map(entry => {
    const lastError = scriptReloadErrors.get(entry.id) || null;
    const withLastError = entry.missingFile
      ? { ...entry, compileError: null, lastError }
      : { ...entry, compileError: checkScriptCompileError(path.join(SCRIPTS_DIR, entry.entry)), lastError };
    return {
      ...withLastError,
      status: scriptLibraryLogic.computeScriptStatus(withLastError, withLastError.running),
    };
  });
  return { registered, unregisteredFiles: view.unregisteredFiles, pages: scriptPages.pages || [] };
}

ipcMain.handle('scriptLibrary:list', () => {
  try {
    return { ok: true, ...buildScriptLibrarySnapshot() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('scriptLibrary:register', (_, id, entry, meta) => {
  try {
    const current = show.getShow();
    if (!current) throw new Error('Nenhum show carregado.');
    const nextLibrary = scriptLibraryLogic.registerEntry(current.scriptLibrary || {}, id, entry, meta || {});
    const file = path.join(SCRIPTS_DIR, entry);
    if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${entry}`);
    current.scriptLibrary = nextLibrary;
    current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
    show.saveShow(current);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
});

ipcMain.handle('scriptLibrary:update', (_, id, patch) => {
  try {
    const current = show.getShow();
    if (!current) throw new Error('Nenhum show carregado.');
    if (patch?.entry !== undefined) {
      const file = path.join(SCRIPTS_DIR, patch.entry);
      if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${patch.entry}`);
    }
    const nextLibrary = scriptLibraryLogic.updateEntry(current.scriptLibrary || {}, id, patch || {});
    current.scriptLibrary = nextLibrary;
    current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
    show.saveShow(current);
    emitScriptsChanged();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
});

ipcMain.handle('scriptLibrary:remove', (_, id) => {
  try {
    const current = show.getShow();
    if (!current) throw new Error('Nenhum show carregado.');
    if (runningScripts[id]) throw new Error(`Não é possível remover "${id}": está ativo. Pare antes de remover.`);
    const { scriptLibrary: nextLibrary, scriptPages: nextPages } = scriptLibraryLogic.removeEntry(
      current.scriptLibrary || {},
      current.scriptPages || { pages: [] },
      id
    );
    current.scriptLibrary = nextLibrary;
    current.scriptPages = nextPages;
    current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
    show.saveShow(current);
    scriptReloadErrors.delete(id);
    emitScriptsChanged();
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
});

ipcMain.handle('scriptLibrary:associate', (_, id, pageId, slot) => {
  try {
    const current = show.getShow();
    if (!current) throw new Error('Nenhum show carregado.');
    const library = current.scriptLibrary || {};
    const entry = library[id];
    if (!entry) throw new Error(`Script "${id}" não existe na biblioteca.`);
    const file = path.join(SCRIPTS_DIR, entry.entry);
    if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${entry.entry}`);
    const nextPages = scriptLibraryLogic.associateEntry(
      library, current.scriptPages || { pages: [] }, id, pageId, slot
    );
    current.scriptPages = nextPages;
    current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
    show.saveShow(current);
    emitScriptsChanged();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e.message,
      code: e.code,
      currentPageId: e.currentPageId,
      currentSlot: e.currentSlot,
      occupiedById: e.occupiedById,
    };
  }
});

ipcMain.handle('scriptLibrary:move', (_, id, pageId, slot) => {
  try {
    const current = show.getShow();
    if (!current) throw new Error('Nenhum show carregado.');
    const library = current.scriptLibrary || {};
    const entry = library[id];
    if (!entry) throw new Error(`Script "${id}" não existe na biblioteca.`);
    const file = path.join(SCRIPTS_DIR, entry.entry);
    if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${entry.entry}`);
    const nextPages = scriptLibraryLogic.moveEntry(
      library, current.scriptPages || { pages: [] }, id, pageId, slot
    );
    current.scriptPages = nextPages;
    current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
    show.saveShow(current);
    emitScriptsChanged();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code, occupiedById: e.occupiedById };
  }
});

ipcMain.handle('scriptLibrary:unassign', (_, id) => {
  try {
    const current = show.getShow();
    if (!current) throw new Error('Nenhum show carregado.');
    const nextPages = scriptLibraryLogic.unassignEntry(
      current.scriptLibrary || {},
      current.scriptPages || { pages: [] },
      id
    );
    current.scriptPages = nextPages;
    current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
    show.saveShow(current);
    emitScriptsChanged();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
});

ipcMain.handle('scriptPages:add', (_, name) => {
  try {
    const current = show.getShow();
    if (!current) throw new Error('Nenhum show carregado.');
    current.scriptPages = scriptLibraryLogic.addPage(current.scriptPages || { pages: [] }, name);
    current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
    show.saveShow(current);
    emitScriptsChanged();
    return { ok: true, pages: current.scriptPages.pages };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
});

ipcMain.handle('scriptPages:rename', (_, pageId, name) => {
  try {
    const current = show.getShow();
    if (!current) throw new Error('Nenhum show carregado.');
    current.scriptPages = scriptLibraryLogic.renamePage(current.scriptPages || { pages: [] }, pageId, name);
    current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
    show.saveShow(current);
    emitScriptsChanged();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
});

ipcMain.handle('scriptPages:reorder', (_, orderedIds) => {
  try {
    const current = show.getShow();
    if (!current) throw new Error('Nenhum show carregado.');
    current.scriptPages = scriptLibraryLogic.reorderPages(current.scriptPages || { pages: [] }, orderedIds);
    current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
    show.saveShow(current);
    emitScriptsChanged();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
});

ipcMain.handle('scriptPages:remove', (_, pageId) => {
  try {
    const current = show.getShow();
    if (!current) throw new Error('Nenhum show carregado.');
    current.scriptPages = scriptLibraryLogic.removePage(current.scriptPages || { pages: [] }, pageId, {
      minPages: show.MIN_SCRIPT_PAGES,
      runningScriptIds: Object.keys(runningScripts),
    });
    current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
    show.saveShow(current);
    emitScriptsChanged();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
});

// Monta o mapa de scripts F-key com flag running — usado pelo IPC e pelo watch.
function buildAllScripts() {
  const current = show.getShow();
  const view = scriptLibraryLogic.buildPageScriptsView(
    current?.scriptLibrary || {},
    current?.scriptPages || { pages: [] },
    'page-1',
    Object.keys(runningScripts)
  );
  return Object.fromEntries(Object.entries(view).map(([slot, meta]) => [
    slot,
    { ...meta, file: path.join(SCRIPTS_DIR, meta.entry) },
  ]));
}

// Notifica o renderer que o conjunto de scripts mudou (watch em tempo real).
function emitScriptsChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('scripts:changed', buildAllScripts());
    mainWindow.webContents.send('scriptLibrary:changed', buildScriptLibrarySnapshot());
  }
}

ipcMain.handle('script:getAll', () => buildAllScripts());

ipcMain.handle('script:stopAll', () => {
  stopAllRunningScripts('stop-all');
  emitScriptsChanged();
  return { ok: true };
});

// ─── WATCH em tempo real do diretório de scripts ─────────────────────────────
// Reage a criar/modificar/remover .js em SCRIPTS_DIR sem reiniciar o app.
let scriptsWatcher = null;
const RENAME_CORRELATION_WINDOW_MS = 2000;
const scriptFileRegistry = new Map();       // canonicalPath -> { size, mtimeMs, hash }
const scriptGenerationCounters = new Map(); // canonicalPath -> number (infra para o Checkpoint 6)
const pendingRemovals = new Map();           // canonicalPath -> { size, mtimeMs, hash, timer }

function statSafe(absPath) {
  try { return fs.statSync(absPath); } catch (e) { return null; }
}

function hashFileSafe(absPath) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(absPath)).digest('hex'); }
  catch (e) { return null; }
}

function bumpScriptGeneration(canonicalPath) {
  const next = (scriptGenerationCounters.get(canonicalPath) || 0) + 1;
  scriptGenerationCounters.set(canonicalPath, next);
  return next;
}

function updateScriptFileRegistry(canonicalPath, absPath) {
  const stat = statSafe(absPath);
  if (!stat) {
    scriptFileRegistry.delete(canonicalPath);
    return;
  }
  scriptFileRegistry.set(canonicalPath, {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    hash: hashFileSafe(absPath),
  });
}

function seedScriptFileRegistry() {
  scriptFileRegistry.clear();
  for (const script of collectScripts(SCRIPTS_DIR, '')) {
    const canonicalPath = `${script.name}.js`;
    updateScriptFileRegistry(canonicalPath, script.file);
  }
}

function findLibraryEntriesByEntryPath(canonicalPath) {
  const current = show.getShow();
  const library = current?.scriptLibrary || {};
  return Object.values(library).filter(
    entry => (entry.entry || '').replace(/\\/g, '/') === canonicalPath
  );
}

function stopRunningConsumersOfEntry(canonicalPath, reason) {
  const current = show.getShow();
  const library = current?.scriptLibrary || {};
  for (const [id, entry] of Object.entries(library)) {
    const entryPath = (entry.entry || '').replace(/\\/g, '/');
    if (entryPath === canonicalPath && runningScripts[id]) {
      stopScriptById(id, reason);
      scriptReloadErrors.delete(id);
    }
  }
}

function reloadRunningConsumersOfEntry(canonicalPath) {
  const current = show.getShow();
  const library = current?.scriptLibrary || {};
  for (const [id, entry] of Object.entries(library)) {
    const entryPath = (entry.entry || '').replace(/\\/g, '/');
    const file = path.join(SCRIPTS_DIR, entry.entry);
    const isDirectMatch = entryPath === canonicalPath;
    const isPresetCascade = canonicalPath === 'mov-preset.js' && scriptPrependsMovPreset(file);
    const isFireBaseCascade = canonicalPath === 'fire-base.js' && scriptPrependsFireBase(file);
    if ((isDirectMatch || isPresetCascade || isFireBaseCascade) && runningScripts[id]) {
      swapRunningScript(id, file, (isPresetCascade || isFireBaseCascade) ? 'preset modificado' : 'arquivo modificado');
    }
    if (isDirectMatch && !runningScripts[id] && scriptReloadErrors.has(id) && checkScriptCompileError(file) === null) {
      scriptReloadErrors.delete(id);
    }
  }
}

function correlateScriptRename(oldCanonicalPath, newCanonicalPath) {
  if (!show.isSafeRelativeEntry(newCanonicalPath)) return;
  const current = show.getShow();
  if (!current) return;
  const entries = findLibraryEntriesByEntryPath(oldCanonicalPath);
  if (entries.length === 0) return;
  for (const entry of entries) entry.entry = newCanonicalPath;
  current.scriptSchemaVersion = show.SCRIPT_SCHEMA_VERSION;
  show.saveShow(current);
  console.log(`[scripts:watch] rename correlacionado: "${oldCanonicalPath}" -> "${newCanonicalPath}" (${entries.length} entrada(s) atualizada(s))`);
}

function handleScriptAddOrChange(absPath) {
  const canonicalPath = scriptWatcherLogic.canonicalScriptPath(SCRIPTS_DIR, absPath);
  bumpScriptGeneration(canonicalPath);

  // Se o arquivo voltou no mesmo caminho, cancela a remoção anterior antes do reload.
  const stalePending = pendingRemovals.get(canonicalPath);
  if (stalePending) {
    clearTimeout(stalePending.timer);
    pendingRemovals.delete(canonicalPath);
  }

  const newHash = hashFileSafe(absPath);
  const pendingList = [...pendingRemovals.entries()].map(([canonicalPathKey, value]) => ({
    canonicalPath: canonicalPathKey,
    hash: value.hash,
  }));
  const correlation = scriptWatcherLogic.correlateRenameCandidate(pendingList, canonicalPath, newHash);

  let wasRenameCorrelated = false;
  if (correlation.status === 'matched') {
    const pending = pendingRemovals.get(correlation.oldCanonicalPath);
    if (pending) clearTimeout(pending.timer);
    pendingRemovals.delete(correlation.oldCanonicalPath);
    correlateScriptRename(correlation.oldCanonicalPath, canonicalPath);
    wasRenameCorrelated = true;
  } else if (correlation.status === 'ambiguous') {
    console.warn(`[scripts:watch] correlação de rename ambígua para "${canonicalPath}" (${correlation.candidates.length} candidatos) — nenhuma associação automática.`);
  }

  updateScriptFileRegistry(canonicalPath, absPath);

  if (!wasRenameCorrelated) {
    reloadRunningConsumersOfEntry(canonicalPath);
  }

  emitScriptsChanged();
}

function handleScriptUnlink(absPath) {
  const canonicalPath = scriptWatcherLogic.canonicalScriptPath(SCRIPTS_DIR, absPath);
  bumpScriptGeneration(canonicalPath);
  const cached = scriptFileRegistry.get(canonicalPath);
  scriptFileRegistry.delete(canonicalPath);

  if (cached?.hash) {
    const existingPending = pendingRemovals.get(canonicalPath);
    if (existingPending) clearTimeout(existingPending.timer);
    const timer = setTimeout(() => {
      pendingRemovals.delete(canonicalPath);
      // Janela expirou sem correlação de rename — agora sim é remoção genuína.
      stopRunningConsumersOfEntry(canonicalPath, 'arquivo removido');
      emitScriptsChanged();
    }, RENAME_CORRELATION_WINDOW_MS);
    if (timer.unref) timer.unref();
    pendingRemovals.set(canonicalPath, { ...cached, timer });
  } else {
    // Sem hash em cache, não há base para correlacionar rename.
    stopRunningConsumersOfEntry(canonicalPath, 'arquivo removido');
  }

  emitScriptsChanged();
}

function startScriptsWatch() {
  if (scriptsWatcher) return;
  try {
    seedScriptFileRegistry();
    scriptsWatcher = chokidar.watch(SCRIPTS_DIR, {
      ignored: (filePath) => path.relative(SCRIPTS_DIR, filePath).split(path.sep).includes('backlog'),
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });
    scriptsWatcher.on('add', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      try { handleScriptAddOrChange(filePath); }
      catch (e) { console.error('[scripts:watch] erro (add):', e.message); }
    });
    scriptsWatcher.on('change', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      try { handleScriptAddOrChange(filePath); }
      catch (e) { console.error('[scripts:watch] erro (change):', e.message); }
    });
    scriptsWatcher.on('unlink', (filePath) => {
      if (!filePath.endsWith('.js')) return;
      try { handleScriptUnlink(filePath); }
      catch (e) { console.error('[scripts:watch] erro (unlink):', e.message); }
    });
    scriptsWatcher.on('error', (e) => console.error('[scripts:watch] erro do watcher:', e.message));
    console.log('[scripts:watch] monitorando (chokidar)', SCRIPTS_DIR);
  } catch (e) {
    console.error('[scripts:watch] não foi possível iniciar:', e.message);
  }
}

async function stopScriptsWatch() {
  if (!scriptsWatcher) return;
  try {
    await Promise.race([
      scriptsWatcher.close(),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  } catch (e) {
    console.error('[scripts:watch] erro ao fechar:', e.message);
  }
  scriptsWatcher = null;
  for (const pending of pendingRemovals.values()) clearTimeout(pending.timer);
  pendingRemovals.clear();
}

// ─────────────────────────────────────────────────────────────
// LIGA/DESLIGA CALIBRAÇÃO FÍSICA DE TILT DAS RIBALTAS (via tools/ribalta-calib.js)
// ─────────────────────────────────────────────────────────────

const RIBALTA_CALIB_STATE_PATH = path.join(__dirname, 'ribalta-calib-state.json');
let ribaltaCalibWatcher = null;

function applyRibaltaCalibStateFromDisk() {
  try {
    const raw = fs.readFileSync(RIBALTA_CALIB_STATE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    ribaltaPhysicalCalib.setEnabled(data.enabled !== false);
  } catch (e) {
    ribaltaPhysicalCalib.setEnabled(true); // arquivo ausente/inválido → default ativa
  }
}

function startRibaltaCalibWatch() {
  if (ribaltaCalibWatcher) return;
  applyRibaltaCalibStateFromDisk();
  try {
    ribaltaCalibWatcher = chokidar.watch(RIBALTA_CALIB_STATE_PATH, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 25 },
    });
    ribaltaCalibWatcher.on('add', applyRibaltaCalibStateFromDisk);
    ribaltaCalibWatcher.on('change', applyRibaltaCalibStateFromDisk);
    ribaltaCalibWatcher.on('unlink', applyRibaltaCalibStateFromDisk);
    ribaltaCalibWatcher.on('error', (e) => console.error('[ribalta-calib:watch] erro do watcher:', e.message));
    console.log('[ribalta-calib:watch] monitorando (chokidar)', RIBALTA_CALIB_STATE_PATH);
  } catch (e) {
    console.error('[ribalta-calib:watch] não foi possível iniciar:', e.message);
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
  '  // adapter.resolve(fixtureId, alias, adapterKey, valorLogico)',
  '}',
  '',
  'function OnTerminate() {',
  '  // limpeza ao desativar',
  '}',
].join('\n');

ipcMain.handle('page_script:create', async (_, pageId, sceneKey, name) => {
  if (!show.isSafeRelativeEntry(`${name}.js`)) {
    return { ok: false, error: `Nome de script inválido: "${name}".` };
  }
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
  try { code = readScriptCode(meta.file); }
  catch (e) { return { ok: false, error: 'Arquivo nao encontrado' }; }
  const buffer = new Uint8Array(512);
  const touched = new Uint8Array(512);
  const controlledMask = new Uint8Array(512);
  let ctx;
  try {
    ctx = compileScriptContext(code, buffer, touched, controlledMask);
  } catch (e) { return { ok: false, error: `Erro ao compilar: ${e.message}` }; }
  if (typeof ctx.OnStart === 'function') { try { ctx.OnStart(); } catch (e) {} }
  compositor.addLayer(`page:${k}`, {
    buffer, touched, controlledMask, context: ctx,
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
const macroStepErrors = new Map(); // macroId -> {stepIndex, error, timestamp}

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

function validateMacroReferences(norm) {
  const invalidSteps = [];
  norm.steps.forEach((step, index) => {
    // Caminho inseguro (".." / absoluto / etc.) é tratado como referência
    // inválida, igual a script inexistente — impede que um passo de macro
    // aponte pra fora de SCRIPTS_DIR (path traversal via show.json editado
    // à mão ou UI comprometida).
    const safe = show.isSafeRelativeEntry(`${step.script}.js`);
    if (!step.script || !safe || !fs.existsSync(path.join(SCRIPTS_DIR, step.script + '.js'))) {
      invalidSteps.push({ index, script: step.script });
    }
  });
  return { valid: invalidSteps.length === 0, invalidSteps };
}

function saveMacros() {
  const current = show.getShow();
  if (!current) return;
  current.macros = Object.values(macroDefs);
  show.saveShow(current);
}

// Carrega as macros do show na inicialização e as recria no compositor (sem disparar).
function loadMacros() {
  compositor.clearMacros();
  for (const id of Object.keys(macroDefs)) delete macroDefs[id];
  macroStepErrors.clear();
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
    if (macroDefs[id]) return { ok: false, error: 'macro já existe' };
    const norm = normalizeMacroDef(id, def);
    macroDefs[id] = norm;
    instantiateMacro(norm);
    saveMacros();
    return { ok: true, steps: norm.steps.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('macro:update', (_, id, def = {}) => {
  try {
    if (!id || !macroDefs[id]) return { ok: false, error: 'macro não encontrada' };
    macroStepErrors.delete(id);
    compositor.stopMacro(id);
    compositor.removeMacro(id);
    const norm = normalizeMacroDef(id, def);
    macroDefs[id] = norm;
    instantiateMacro(norm);
    saveMacros();
    return { ok: true, steps: norm.steps.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('macro:start', (_, id) => {
  const norm = macroDefs[id];
  if (!norm) return { ok: false, error: 'macro não encontrada' };
  const validation = validateMacroReferences(norm);
  if (!validation.valid) {
    return { ok: false, error: 'Macro com script(s) inexistente(s): ' + validation.invalidSteps.map(s => `passo ${s.index+1} (${s.script||'vazio'})`).join(', ') };
  }
  macroStepErrors.delete(id);
  return compositor.startMacro(id);
});
ipcMain.handle('macro:stop',   (_, id) => ({ ok: compositor.stopMacro(id) }));
ipcMain.handle('macro:next',   (_, id) => ({ ok: compositor.triggerNextStep(id) }));
ipcMain.handle('macro:remove', (_, id) => {
  macroStepErrors.delete(id);
  const ok = compositor.removeMacro(id);
  delete macroDefs[id];
  saveMacros();
  return { ok };
});

// Lista as macros definidas (para a UI) e o status da macro ativa (para polling).
ipcMain.handle('macro:list', () => Object.values(macroDefs).map(def => {
  const v = validateMacroReferences(def);
  return {
    ...def,
    valid: v.valid,
    invalid: !v.valid,
    invalidSteps: v.invalidSteps,
    lastError: macroStepErrors.get(def.id) || null,
  };
}));
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
      loadPageScriptMeta(); loadMacros();
      initializeOffsets();
      const startupChannels = show.getStartupChannels();
      Object.entries(startupChannels).forEach(([ch, value]) => universe.setChannel(Number(ch), value));
      applyDefaultStartupScene();
      console.log('[main] scripts na biblioteca:', Object.keys(show.getShow()?.scriptLibrary || {}).length);
    } catch (e) {
      console.warn('[main] falha ao carregar show padrao:', e.message);
    }
  }

  // Guard de fixture desabilitado aplicado na composição (uma vez por frame).
  compositor.setDisabledChannelsProvider(getDisabledFixtureChannelSet);
  compositor.setMacroStepErrorHandler((macroId, stepIndex, err) => {
    macroStepErrors.set(macroId, { stepIndex, error: err?.message || String(err), timestamp: Date.now() });
  });
  ribaltaDebug.configure({
    getUniverse: () => universe.getUniverse(),
    getFixtureChannel: (fixtureId, alias) => getFixtureChannel(fixtureId, alias),
  });
  if (ribaltaDebug.isEnabled()) {
    console.log('[ribalta2-debug] logging ativo — ligado via VP_RIBALTA_DEBUG=1');
  }

  engine.start();
  console.log('[main] engine DMX iniciado');

  startScriptsWatch();
  startRibaltaCalibWatch();
});

app.on('window-all-closed', async () => {
  await stopScriptsWatch();
  if (ribaltaCalibWatcher) { try { await ribaltaCalibWatcher.close(); } catch (_) {} ribaltaCalibWatcher = null; }
  engine.stop();
  app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
