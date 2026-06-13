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

const universe   = require('./engine/universe');
const engine     = require('./engine/engine');
const compositor = require('./engine/compositor');
const show       = require('./show');

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
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS — ENGINE
// ─────────────────────────────────────────────────────────────

ipcMain.handle('window:closeApp', () => {
  if (!mainWindow) return { ok: false };
  allowWindowClose = true;
  mainWindow.close();
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

ipcMain.handle('engine:status', () => ({
  running: engine.isRunning(),
  frames: engine.getFrameCount(),
}));

// ─────────────────────────────────────────────────────────────
// IPC HANDLERS — DMX
// ─────────────────────────────────────────────────────────────

ipcMain.handle('dmx:activateScene', (_, channels) => {
  universe.applyScene(filterDisabledFixtureChannels(channels));
  return { ok: true };
});

ipcMain.handle('dmx:setChannel', (_, channel, value) => {
  if (!isDmxChannelEnabled(channel)) return { ok: true, ignored: true };
  universe.setChannel(channel, value);
  return { ok: true };
});

ipcMain.handle('dmx:setChannelRange', (_, channels, value) => {
  if (!Array.isArray(channels)) {
    return { ok: false, error: 'channels must be an array' };
  }
  const enabledChannels = channels.filter(channel => isDmxChannelEnabled(channel));
  enabledChannels.forEach((channel) => universe.setChannel(Number(channel), value));
  return { ok: true, count: enabledChannels.length };
});

ipcMain.handle('dmx:blackout', () => {
  stopAllRunningScripts('blackout');
  universe.blackout();
  return { ok: true };
});

ipcMain.handle('dmx:restoreState', (_, channels) => {
  universe.restoreState(filterDisabledFixtureChannels(channels));
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
      scriptMeta[fkey] = { name: meta.name, file };
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
function getFixtureChannel(fixtureId, alias) {
  const current = show.getShow();
  const fixture = current?.fixtures?.find(f => f.id === fixtureId);
  if (!fixture || !isFixtureEnabled(fixture) || !Array.isArray(fixture.channels)) return null;
  const target = normalizeAlias(alias);
  const index = fixture.channels.findIndex(ch => normalizeAlias(ch) === target);
  return index === -1 ? null : fixture.startChannel + index;
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
  console.log('[script:create] fkey=%s name=%s groups=%j fileExists=%s', fkey, name, groups, fs.existsSync(file));

  // Sempre (re)escreve quando grupos foram selecionados — garante injeção do banco.
  // Sem grupos: só cria se o arquivo ainda não existe (comportamento original).
  const shouldWrite = groups.length > 0 || !fs.existsSync(file);

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
    const files = fs.readdirSync(SCRIPTS_DIR)
      .filter(f => f.endsWith('.js'))
      .map(f => ({ name: f.replace('.js', ''), file: path.join(SCRIPTS_DIR, f) }));
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

// def = {
//   steps: [ { name, durationMs|null (null/'infinite' = até trigger), fadeInMs, fadeOutMs, overlapMs } ],
//   mergeMode: 'htp' | 'linear',
//   loop: bool
// }
ipcMain.handle('macro:create', (_, id, def = {}) => {
  try {
    if (!id) return { ok: false, error: 'id da macro obrigatório' };
    const stepsIn = Array.isArray(def.steps) ? def.steps : [];
    const steps = stepsIn.map(s => {
      const file = path.join(SCRIPTS_DIR, `${s.name}.js`);
      const infinite = s.durationMs == null || s.durationMs === 'infinite';
      return {
        makeLayer: () => compileLayer(file),  // compila no momento do disparo (recarrega do disco)
        durationFrames: infinite ? Infinity : Math.max(1, msToFrames(s.durationMs)),
        fadeInFrames: msToFrames(s.fadeInMs),
        fadeOutFrames: msToFrames(s.fadeOutMs),
        overlapFrames: msToFrames(s.overlapMs),
      };
    });
    compositor.createMacro(id, steps, { mergeMode: def.mergeMode, loop: def.loop });
    return { ok: true, steps: steps.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('macro:start',  (_, id) => ({ ok: compositor.startMacro(id) }));
ipcMain.handle('macro:stop',   (_, id) => ({ ok: compositor.stopMacro(id) }));
ipcMain.handle('macro:next',   (_, id) => ({ ok: compositor.triggerNextStep(id) }));
ipcMain.handle('macro:remove', (_, id) => ({ ok: compositor.removeMacro(id) }));

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
      loadScriptMeta(); loadPageScriptMeta();
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
