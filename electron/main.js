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

const universe = require('./engine/universe');
const engine   = require('./engine/engine');
const show     = require('./show');

const isDev = !app.isPackaged;
const DEFAULT_SHOW = path.join(__dirname, '..', 'shows', 'vp.show.json');

const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');
if (!fs.existsSync(SCRIPTS_DIR)) fs.mkdirSync(SCRIPTS_DIR);

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

function createWindow() {
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

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS — ENGINE
// ─────────────────────────────────────────────────────────────

ipcMain.handle('engine:start', () => {
  engine.start();
  return { running: true };
});

ipcMain.handle('engine:stop', () => {
  engine.stop();
  return { running: false };
});

ipcMain.handle('engine:status', () => ({
  running: engine.isRunning(),
  frames: engine.getFrameCount(),
}));

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS — DMX
// ─────────────────────────────────────────────────────────────

ipcMain.handle('dmx:activateScene', (_, channels) => {
  universe.applyScene(channels);
  return { ok: true };
});

ipcMain.handle('dmx:setChannel', (_, channel, value) => {
  universe.setChannel(channel, value);
  return { ok: true };
});

ipcMain.handle('dmx:blackout', () => {
  stopAllRunningScripts('blackout');
  universe.blackout();
  return { ok: true };
});

ipcMain.handle('dmx:restoreState', (_, channels) => {
  universe.restoreState(channels);
  return { ok: true };
});

ipcMain.handle('dmx:getUniverse', () => {
  return universe.getUniverseSnapshot();
});

ipcMain.handle('dmx:setActiveScenes', (_, scenesMap) => {
  universe.setActiveScenes(scenesMap);
  return { ok: true };
});

ipcMain.handle('dmx:getConflicts', () => {
  return universe.detectConflicts();
});

// Mapa de canais bloqueados por cenas ativas — atualizado pelo renderer
let activeSceneChannels = {}; // { [canal]: valor } — scripts não sobrescrevem esses canais

ipcMain.handle('dmx:setActiveSceneChannels', (_, channels) => {
  activeSceneChannels = channels || {};
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

    // Scripts: main process é fonte da verdade — scriptMeta sobrescreve tudo.
    const mergedScripts = {};
    // 1. base do disco
    for (const [k, v] of Object.entries(currentShow?.scripts || {})) mergedScripts[k] = v;
    // 2. o que o renderer mandou (pode ter sido modificado via sync-scripts)
    for (const [k, v] of Object.entries(showData.scripts || {})) mergedScripts[k] = v;
    // 3. scriptMeta do main vence — é a fonte de verdade em runtime
    for (const [fkey, meta] of Object.entries(scriptMeta)) {
      mergedScripts[fkey] = { name: meta.name, file: meta.file };
    }

    // Páginas: renderer é fonte da verdade.
    const mergedPages = { ...(currentShow?.pages || {}), ...showData.pages };

    // page_scripts: pageScriptMeta do main vence (fonte de verdade em runtime).
    const mergedPageScripts = {};
    for (const [pgId, pgData] of Object.entries(currentShow?.page_scripts || {})) {
      mergedPageScripts[pgId] = { ...pgData };
    }
    for (const [pgId, pgData] of Object.entries(showData.page_scripts || {})) {
      if (!mergedPageScripts[pgId]) mergedPageScripts[pgId] = {};
      Object.assign(mergedPageScripts[pgId], pgData);
    }
    for (const [pgId, pgData] of Object.entries(pageScriptMeta)) {
      if (!mergedPageScripts[pgId]) mergedPageScripts[pgId] = {};
      for (const [sceneKey, meta] of Object.entries(pgData)) {
        mergedPageScripts[pgId][sceneKey] = { name: meta.name, file: meta.file };
      }
    }

    const merged = {
      ...showData,
      scripts:      mergedScripts,
      pages:        mergedPages,
      page_scripts: mergedPageScripts,
    };

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

function psKey(pageId, sceneKey) { return `${pageId}:${sceneKey}`; }

function stopRunningPageScript(pageId, sceneKey, reason) {
  const k = psKey(pageId, sceneKey);
  const running = runningPageScripts[k];
  if (!running) return false;
  const { interval, context } = running;
  clearInterval(interval);
  if (typeof context.OnTerminate === 'function') {
    try { context.OnTerminate(); } catch (e) {
      console.error(`[page_script] OnTerminate error (${reason}) (${k}):`, e.message);
    }
  }
  delete runningPageScripts[k];
  return true;
}

function loadPageScriptMeta() {
  const current = show.getShow();
  if (!current?.page_scripts) return;
  for (const [pageId, pageData] of Object.entries(current.page_scripts)) {
    if (!pageScriptMeta[pageId]) pageScriptMeta[pageId] = {};
    for (const [sceneKey, meta] of Object.entries(pageData)) {
      if (fs.existsSync(meta.file)) {
        pageScriptMeta[pageId][sceneKey] = meta;
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

  const { interval, context } = running;
  clearInterval(interval);

  if (typeof context.OnTerminate === 'function') {
    try {
      context.OnTerminate();
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
}

function saveScriptMeta() {
  const current = show.getShow();
  if (!current) return;
  current.scripts = {};
  for (const [fkey, meta] of Object.entries(scriptMeta)) {
    current.scripts[fkey] = { name: meta.name, file: meta.file };
  }
  show.saveShow(current);
}

function loadScriptMeta() {
  const current = show.getShow();
  if (!current?.scripts) return;
  for (const [fkey, meta] of Object.entries(current.scripts)) {
    if (fs.existsSync(meta.file)) {
      scriptMeta[fkey] = meta;
    }
  }
}

// Normaliza um rótulo de canal para comparação: minúsculo, sem acento, sem
// espaços nas pontas. Alinha com o padrão de aliases do sistema (ASCII).
function normalizeAlias(label) {
  return String(label ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}

// Resolve o canal DMX real (1-based) de um alias dentro de um fixture do show
// carregado em memória. Ex.: getFixtureChannel("fixture_123", "strobo") → 2.
// Retorna null se o fixture não existir ou o alias não estiver mapeado.
function getFixtureChannel(fixtureId, alias) {
  const current = show.getShow();
  const fixture = current?.fixtures?.find(f => f.id === fixtureId);
  if (!fixture || !Array.isArray(fixture.channels)) return null;
  const target = normalizeAlias(alias);
  const index = fixture.channels.findIndex(ch => normalizeAlias(ch) === target);
  return index === -1 ? null : fixture.startChannel + index;
}

ipcMain.handle('script:create', async (_, fkey, name, options = {}) => {
  const file = path.join(SCRIPTS_DIR, `${name}.js`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, [
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
  scriptMeta[fkey] = { name, file };
  saveScriptMeta();
  if (!options.skipOpenEditor) { await openScriptInVSCode(file); }
  return { ok: true, name, file };
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

ipcMain.handle('script:toggle', (_, fkey) => {
  if (runningScripts[fkey]) {
    // Parar
    stopRunningScript(fkey, 'toggle');
    return { ok: true, running: false };
  }
  const meta = scriptMeta[fkey];
  if (!meta) return { ok: false, error: 'Nenhum script neste botão' };
  let code;
  try {
    code = fs.readFileSync(meta.file, 'utf-8');
  } catch (e) {
    return { ok: false, error: 'Arquivo não encontrado' };
  }
  // Monta contexto de execução do script
  const ctx = {};
  const SetChannel = (ch, val) => {
    if (ch in activeSceneChannels) return; // canal bloqueado por cena ativa
    universe.setChannel(ch, val);
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
  const interval = setInterval(() => {
    if (typeof ctx.OnExecute === 'function') {
      try { ctx.OnExecute(); } catch (e) {
        clearInterval(interval);
        if (typeof ctx.OnTerminate === 'function') {
          try { ctx.OnTerminate(); } catch (te) {
            console.error(`[script] OnTerminate error (${fkey}):`, te.message);
          }
        }
        delete runningScripts[fkey];
        console.error(`[script] OnExecute error (${fkey}), script parado:`, e.message);
      }
    }
  }, 40);
  runningScripts[fkey] = { interval, context: ctx };
  return { ok: true, running: true };
});

ipcMain.handle('script:list', () => {
  try {
    const files = fs.readdirSync(SCRIPTS_DIR)
      .filter(f => f.endsWith('.js'))
      .map(f => ({ name: f.replace('.js', ''), file: path.join(SCRIPTS_DIR, f) }));
    return { ok: true, files };
  } catch (e) {
    return { ok: false, files: [] };
  }
});

ipcMain.handle('script:getAll', () => {
  const result = {};
  for (const [fkey, meta] of Object.entries(scriptMeta)) {
    result[fkey] = { ...meta, running: !!runningScripts[fkey] };
  }
  return result;
});

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
  const meta = pageScriptMeta[pageId]?.[sceneKey];
  if (!meta) return { ok: false, error: 'Nenhum script nesta tecla' };
  return openScriptInVSCode(meta.file);
});

ipcMain.handle('page_script:clear', (_, pageId, sceneKey) => {
  stopRunningPageScript(pageId, sceneKey, 'limpar');
  if (pageScriptMeta[pageId]) delete pageScriptMeta[pageId][sceneKey];
  savePageScriptMeta();
  return { ok: true };
});

ipcMain.handle('page_script:toggle', (_, pageId, sceneKey) => {
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
  const ctx = {};
  const SetChannel = (ch, val) => {
    if (ch in activeSceneChannels) return;
    universe.setChannel(ch, val);
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
  const interval = setInterval(() => {
    if (typeof ctx.OnExecute === 'function') {
      try { ctx.OnExecute(); } catch (e) {
        clearInterval(interval);
        if (typeof ctx.OnTerminate === 'function') { try { ctx.OnTerminate(); } catch (te) {} }
        delete runningPageScripts[k];
        console.error(`[page_script] script parado (${k}):`, e.message);
      }
    }
  }, 40);
  runningPageScripts[k] = { interval, context: ctx };
  return { ok: true, running: true };
});

ipcMain.handle('page_script:getAll', (_, pageId) => {
  const pageMeta = pageScriptMeta[pageId] || {};
  const result = {};
  for (const [sceneKey, meta] of Object.entries(pageMeta)) {
    result[sceneKey] = { ...meta, running: !!runningPageScripts[psKey(pageId, sceneKey)] };
  }
  return result;
});

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
  posX: 10,
  posY: 10,
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
      loadScriptMeta(); loadPageScriptMeta();
      console.log('[main] scripts carregados:', Object.keys(scriptMeta));
    } catch (e) {
      console.warn('[main] falha ao carregar show padrao:', e.message);
    }
  }

  engine.start();
  console.log('[main] engine DMX iniciado');
});

app.on('window-all-closed', () => {
  engine.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
eta();
      console.log('[main] scripts carregados:', Object.keys(scriptMeta));
    } catch (e) {
      console.warn('[main] falha ao carregar show padrão:', e.message);
    }
  }

  engine.start();
  console.log('[main] engine DMX iniciado');
});

app.on('window-all-closed', () => {
  engine.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
