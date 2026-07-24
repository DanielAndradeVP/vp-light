/**
 * preload.js — Bridge IPC segura (contextBridge)
 *
 * Expõe window.vp.* para o renderer.
 * O renderer NUNCA acessa hardware diretamente — só via estas funções.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vp', {
  closeApp: () => ipcRenderer.invoke('window:closeApp'),
  onWindowCloseRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('window:close-requested', listener);
    return () => ipcRenderer.removeListener('window:close-requested', listener);
  },

  // ─── VISUALIZADOR 3D (janela independente) ─────────────────
  open3DViewer: () => ipcRenderer.invoke('window:open3DViewer'),
  onViewer3DClosed: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('viewer3d:closed', listener);
    return () => ipcRenderer.removeListener('viewer3d:closed', listener);
  },
  onDmxUniverse: (callback) => {
    const listener = (_event, channels) => callback(channels);
    ipcRenderer.on('dmx-universe', listener);
    return () => ipcRenderer.removeListener('dmx-universe', listener);
  },
  onActiveScripts: (callback) => {
    const listener = (_event, names) => callback(names);
    ipcRenderer.on('viewer3d:active-scripts', listener);
    return () => ipcRenderer.removeListener('viewer3d:active-scripts', listener);
  },

  // ─── ENGINE ───────────────────────────────────────────────
  startEngine: () => ipcRenderer.invoke('engine:start'),
  stopEngine:  () => ipcRenderer.invoke('engine:stop'),
  getEngineStatus: () => ipcRenderer.invoke('engine:status'),
  getPerformanceSnapshot: () => ipcRenderer.invoke('performance:getSnapshot'),

  // ─── DMX ──────────────────────────────────────────────────
  /**
   * Ativa uma cena: aplica todos os seus canais no universo de uma vez.
   * @param {Object} channels  Ex: { "1": 255, "4": 128 }
   */
  activateScene: (channels) => ipcRenderer.invoke('dmx:activateScene', channels),

  /**
   * Define um canal individual (usado no SceneEditor para preview ao vivo).
   * @param {number} channel  1–512
   * @param {number} value    0–255
   */
  setChannel: (channel, value) => ipcRenderer.invoke('dmx:setChannel', channel, value),
  setChannelRange: (channels, value) => ipcRenderer.invoke('dmx:setChannelRange', channels, value),
  setFixtureSpeed: (fixtureId, value) => ipcRenderer.invoke('custom:speed', fixtureId, value),
  setMovingHeadSpeed: (fixtureId, value) => ipcRenderer.invoke('custom:speed', fixtureId, value),
  setRibaltaSpeed: (fixtureId, value) => ipcRenderer.invoke('custom:speed', fixtureId, value),

  /**
   * Zera todos os 512 canais imediatamente.
   */
  blackout: () => ipcRenderer.invoke('dmx:blackout'),
  restoreState: (channels) => ipcRenderer.invoke('dmx:restoreState', channels),
  setActiveSceneChannels: (channels, parLedChs) => ipcRenderer.invoke('dmx:setActiveSceneChannels', channels, parLedChs),
  setActiveScenes: (scenesMap) => ipcRenderer.invoke('dmx:setActiveScenes', scenesMap),
  getConflicts: () => ipcRenderer.invoke('dmx:getConflicts'),

  /**
   * Retorna snapshot do universo atual (apenas canais > 0).
   * @returns {Promise<Object>}  Ex: { "1": 255, "4": 128 }
   */
  getUniverse: () => ipcRenderer.invoke('dmx:getUniverse'),

  // Congela/descongela saída Art-Net (UDP). Viewer 3D usa engine.onFrame (IPC), não Art-Net.
  getArtNetFrozen: () => ipcRenderer.invoke('artnet:getFrozen'),
  setArtNetFrozen: (frozen) => ipcRenderer.invoke('artnet:setFrozen', frozen),

  // ─── SHOW ─────────────────────────────────────────────────
  /**
   * Carrega um .show.json. Abre diálogo de arquivo se path não for passado.
   */
  loadShow: (filePath) => ipcRenderer.invoke('show:load', filePath),

  /**
   * Salva o show atual no mesmo arquivo.
   * @param {Object} showData  Estado completo do show vindo do renderer
   */
  saveShow: (showData) => ipcRenderer.invoke('show:save', showData),

  /**
   * Salva como novo arquivo. Abre diálogo de salvar.
   */
  saveShowAs: (showData) => ipcRenderer.invoke('show:saveAs', showData),

  /**
   * Retorna o show em memória (sem ler disco).
   */
  getShow: () => ipcRenderer.invoke('show:get'),

  /**
   * Atualiza uma cena específica em memória.
   */
  updateScene: (pageId, sceneKey, sceneData) =>
    ipcRenderer.invoke('show:updateScene', pageId, sceneKey, sceneData),

  // ─── SCRIPTS ──────────────────────────────────────────────────────────────
  listScripts:   ()           => ipcRenderer.invoke('script:list'),
  createScript:  (pageId, fkey, name, options) => ipcRenderer.invoke('script:create', pageId, fkey, name, options),
  editScript:    (pageId, fkey, filePath) => ipcRenderer.invoke('script:edit', pageId, fkey, filePath),
  clearScript:   (pageId, fkey)       => ipcRenderer.invoke('script:clear', pageId, fkey),
  toggleScript:  (fkey)       => ipcRenderer.invoke('script:toggle', fkey),
  toggleScriptAt: (pageId, slot) => ipcRenderer.invoke('script:toggleAt', pageId, slot),
  getAllScripts:  ()           => ipcRenderer.invoke('script:getAll'),
  stopAllScripts: ()           => ipcRenderer.invoke('script:stopAll'),
  scriptLibraryList: () => ipcRenderer.invoke('scriptLibrary:list'),
  scriptLibraryRegister: (id, entry, meta) => ipcRenderer.invoke('scriptLibrary:register', id, entry, meta),
  scriptLibraryUpdate: (id, patch) => ipcRenderer.invoke('scriptLibrary:update', id, patch),
  scriptLibraryRemove: (id) => ipcRenderer.invoke('scriptLibrary:remove', id),
  scriptLibraryAssociate: (id, pageId, slot) => ipcRenderer.invoke('scriptLibrary:associate', id, pageId, slot),
  scriptLibraryMove: (id, pageId, slot) => ipcRenderer.invoke('scriptLibrary:move', id, pageId, slot),
  scriptLibraryUnassign: (id) => ipcRenderer.invoke('scriptLibrary:unassign', id),
  scriptPagesAdd: (name) => ipcRenderer.invoke('scriptPages:add', name),
  scriptPagesRename: (pageId, name) => ipcRenderer.invoke('scriptPages:rename', pageId, name),
  scriptPagesReorder: (orderedIds) => ipcRenderer.invoke('scriptPages:reorder', orderedIds),
  scriptPagesRemove: (pageId) => ipcRenderer.invoke('scriptPages:remove', pageId),
  onScriptLibraryChanged: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('scriptLibrary:changed', listener);
    return () => ipcRenderer.removeListener('scriptLibrary:changed', listener);
  },
  // Watch em tempo real: o main avisa quando um .js muda no disco.
  // Retorna uma função para remover o listener.
  onScriptsChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('scripts:changed', listener);
    return () => ipcRenderer.removeListener('scripts:changed', listener);
  },

  // ─── PAGE SCRIPTS (teclas de cena com script) ─────────────────────────────
  createPageScript:  (pageId, sceneKey, name) => ipcRenderer.invoke('page_script:create', pageId, sceneKey, name),
  editPageScript:    (pageId, sceneKey)       => ipcRenderer.invoke('page_script:edit',   pageId, sceneKey),
  clearPageScript:   (pageId, sceneKey)       => ipcRenderer.invoke('page_script:clear',  pageId, sceneKey),
  togglePageScript:  (pageId, sceneKey)       => ipcRenderer.invoke('page_script:toggle', pageId, sceneKey),
  getAllPageScripts:  (pageId)                 => ipcRenderer.invoke('page_script:getAll', pageId),

  // ─── MACROS (sequenciador + crossfade — backend Fase 2; UI a fazer) ─────────
  createMacro:   (id, def) => ipcRenderer.invoke('macro:create', id, def),
  updateMacro:   (id, def) => ipcRenderer.invoke('macro:update', id, def),
  startMacro:    (id)      => ipcRenderer.invoke('macro:start', id),
  stopMacro:     (id)      => ipcRenderer.invoke('macro:stop', id),
  nextMacroStep: (id)      => ipcRenderer.invoke('macro:next', id),
  removeMacro:   (id)      => ipcRenderer.invoke('macro:remove', id),
  macroList:     ()        => ipcRenderer.invoke('macro:list'),
  macroStatus:   ()        => ipcRenderer.invoke('macro:status'),

  // ─── FIXTURES ─────────────────────────────────────────────────────────────
  openFixtureTemplate: () => ipcRenderer.invoke('fixture:openTemplate'),
});
