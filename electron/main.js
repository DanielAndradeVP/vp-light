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
  universe.blackout();
  return { ok: true };
});

ipcMain.handle('dmx:restoreState', (_, channels) => {
  universe.applyScene(channels);
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
    loadScriptMeta();
    return { ok: true, show: data, path: targetPath };
  } catch (err) {
    console.error('[main] show:load error:', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('show:save', (_, showData) => {
  try {
    const currentShow = show.getShow();

    console.log('[show:save] showData recebido:', JSON.stringify({ fixtures: showData.fixtures?.length, pages: Object.keys(showData.pages || {}), scripts: showData.scripts }, null, 2));
    console.log('[show:save] scriptMeta atual:', JSON.stringify(scriptMeta, null, 2));

    // Scripts: main process é fonte da verdade — scriptMeta sobrescreve tudo.
    // Base começa com o que está no disco, depois aplica o que o renderer trouxe,
    // depois sobrescreve com scriptMeta (o que o main process realmente conhece).
    const mergedScripts = {
      ...(currentShow?.scripts || {}),
      ...(showData.scripts   || {}),
    };
    for (const [fkey, meta] of Object.entries(scriptMeta)) {
      mergedScripts[fkey] = { name: meta.name, file: meta.file };
    }

    // Páginas: renderer é fonte da verdade para cenas; preserva páginas do
    // currentShow que o renderer não conhece (ex: criadas fora desta sessão).
    const mergedPages = { ...(currentShow?.pages || {}), ...showData.pages };

    const merged = { ...showData, scripts: mergedScripts, pages: mergedPages };
    console.log('[show:save] objeto final para disco:', JSON.stringify({ fixtures: merged.fixtures?.length, pages: Object.keys(merged.pages || {}), scripts: merged.scripts }, null, 2));

    show.saveShow(merged);
    return { ok: true, message: 'Salvo com sucesso' };
  } catch (err) {
    console.error('[main] show:save error:', err.message);
    return { ok: false, error: err.message };
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
  if (runningScripts[fkey]) {
    const { interval, context } = runningScripts[fkey];
    clearInterval(interval);
    if (typeof context.OnTerminate === 'function') {
      try { context.OnTerminate(); } catch (e) {
        console.error(`[script] OnTerminate error ao limpar (${fkey}):`, e.message);
      }
    }
    delete runningScripts[fkey];
  }
  delete scriptMeta[fkey];
  saveScriptMeta();
  return { ok: true };
});

ipcMain.handle('script:toggle', (_, fkey) => {
  if (runningScripts[fkey]) {
    // Parar
    try {
      const { interval, context } = runningScripts[fkey];
      clearInterval(interval);
      if (typeof context.OnTerminate === 'function') context.OnTerminate();
    } catch (e) {}
    delete runningScripts[fkey];
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
  try {
    const fn = new Function('SetChannel', 'ctx', `
      ${code}
      ctx.OnStart = typeof OnStart === 'function' ? OnStart : null;
      ctx.OnExecute = typeof OnExecute === 'function' ? OnExecute : null;
      ctx.OnTerminate = typeof OnTerminate === 'function' ? OnTerminate : null;
    `);
    fn(SetChannel, ctx);
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
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();

  // Carrega show padrão se existir
  if (fs.existsSync(DEFAULT_SHOW)) {
    try {
      show.loadShow(DEFAULT_SHOW);
      console.log('[main] show padrão carregado');
      loadScriptMeta();
      console.log('[main] scripts carregados:', Object.keys(scriptMeta));
    } catch (e) {
      console.warn('[main] falha ao carregar show padrão:', e.message);
    }
  }

  // Inicia engine DMX imediatamente
  engine.start();
  console.log('[main] engine DMX iniciado');
});

app.on('window-all-closed', () => {
  // Encerra todos os scripts antes de parar o engine
  for (const [fkey, { interval, context }] of Object.entries(runningScripts)) {
    clearInterval(interval);
    if (typeof context.OnTerminate === 'function') {
      try { context.OnTerminate(); } catch (e) {
        console.error(`[script] OnTerminate error no shutdown (${fkey}):`, e.message);
      }
    }
  }
  engine.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
