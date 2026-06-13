/**
 * compositor.js — Composição por camadas + sequenciador de macro (Fase 2)
 *
 * CAMADAS
 *   Cada script ativo é uma CAMADA com buffer próprio (Uint8Array 512) pré-alocado.
 *   A cada frame (chamado pelo engine a 40ms):
 *     1. avança as macros (pode adicionar / fazer fade-out de camadas)
 *     2. para cada camada: tick do envelope (weight) → buffer.fill(0)+touched.fill(0) → OnExecute
 *     3. mescla as camadas pelos seus weights, só nos canais TOCADOS, aplica guards e escreve
 *     4. remove camadas que terminaram o fade-out (weight chegou a 0)
 *
 * WEIGHT / ENVELOPE
 *   Camada sem envelope (F-keys e page-scripts soltos) nasce com weight=1, phase 'hold' →
 *   comportamento idêntico à Fase 1 (paridade). Camadas de macro têm fadeInFrames/fadeOutFrames
 *   contados em FRAMES (40ms cada), nunca via Date.now() — determinístico e preso ao tick.
 *     fade-in : weight sobe 0→1 ao longo de fadeInFrames
 *     fade-out: weight desce do valor atual→0 ao longo de fadeOutFrames; ao zerar, a camada é removida
 *
 * MESCLA (configurável por macro)
 *   - 'htp' (DEFAULT): out[ch] = max_camadas( buffer[ch] * weight ).
 *       Escolhido como padrão para o crossfade porque o canal mais forte domina, evitando o
 *       "dip" de brilho típico da soma linear no ponto 50/50 — e em looks que ocupam canais
 *       diferentes cada canal simplesmente faz fade pelo weight da sua própria camada.
 *   - 'linear' (opção): out[ch] = clamp( Σ buffer[ch] * weight ) = A·(1-t) + B·t no crossfade.
 *   O modo é global por frame (a macro ativa define ao iniciar; volta a 'htp' ao parar). Para o
 *   uso típico (uma macro por vez + F-keys manuais) isso é suficiente nesta fase.
 *
 * Buffers pré-alocados por camada e reusados (fill por frame) — sem alocação por frame.
 * Roda APENAS no main process.
 */

const universe = require('./universe');

// id -> camada
const _layers = new Map();
// id -> macro (definição + runtime)
const _macros = new Map();

const _EMPTY_SET = new Set();
let _sceneLock = {};                          // { [canal]: valor } — canais travados por cena ativa
let _getDisabledChannels = () => _EMPTY_SET;  // provider injetado pelo main
let _mergeMode = 'htp';                        // 'htp' | 'linear'
let _layerSeq = 0;                             // sequência p/ ids únicos de camadas de macro

// ─── CONFIG / GUARDS ─────────────────────────────────────────────────────────
function setSceneLock(map) { _sceneLock = map || {}; }
function setDisabledChannelsProvider(fn) { if (typeof fn === 'function') _getDisabledChannels = fn; }
function setMergeMode(mode) { _mergeMode = (mode === 'linear') ? 'linear' : 'htp'; }

// ─── CAMADAS ─────────────────────────────────────────────────────────────────
/**
 * Registra/atualiza uma camada.
 * @param {string} id     identificador único ('F1', 'page:1:A', 'macro:...')
 * @param {Object} layer  { buffer, touched, context, fadeInFrames?, fadeOutFrames?, onError?, onDone? }
 */
function addLayer(id, layer) {
  const fadeInFrames  = Math.max(0, layer.fadeInFrames  | 0);
  const fadeOutFrames = Math.max(0, layer.fadeOutFrames | 0);
  _layers.set(id, {
    weight: fadeInFrames > 0 ? 0 : 1,
    phase:  fadeInFrames > 0 ? 'in' : 'hold', // 'in' | 'hold' | 'out' | 'done'
    _inElapsed: 0,
    _outElapsed: 0,
    _releaseFromWeight: 1,
    ...layer,
    fadeInFrames,
    fadeOutFrames,
    _id: id,
  });
}

function removeLayer(id) { return _layers.delete(id); }
function hasLayer(id)    { return _layers.has(id); }
function clearLayers()   { _layers.clear(); }
function layerCount()    { return _layers.size; }

/**
 * Inicia o fade-out de uma camada. Ao zerar o weight, a camada é removida no renderFrame.
 */
function releaseLayer(id, fadeOutFrames) {
  const layer = _layers.get(id);
  if (!layer) return false;
  layer.phase = 'out';
  layer._outElapsed = 0;
  layer._releaseFromWeight = layer.weight;
  if (typeof fadeOutFrames === 'number') layer.fadeOutFrames = Math.max(0, fadeOutFrames | 0);
  return true;
}

function _removeLayerInternal(layer, reason) {
  if (!_layers.has(layer._id)) return;
  _layers.delete(layer._id);
  if (layer.context && typeof layer.context.OnTerminate === 'function') {
    try { layer.context.OnTerminate(); } catch (e) {}
  }
  if (typeof layer.onDone === 'function') { try { layer.onDone(reason); } catch (_) {} }
}

function _tickEnvelope(layer) {
  if (layer.phase === 'in') {
    if (layer.fadeInFrames <= 0) { layer.weight = 1; layer.phase = 'hold'; return; }
    layer._inElapsed++;
    layer.weight = Math.min(1, layer._inElapsed / layer.fadeInFrames);
    if (layer._inElapsed >= layer.fadeInFrames) { layer.weight = 1; layer.phase = 'hold'; }
  } else if (layer.phase === 'out') {
    if (layer.fadeOutFrames <= 0) { layer.weight = 0; layer.phase = 'done'; return; }
    layer._outElapsed++;
    layer.weight = Math.max(0, layer._releaseFromWeight * (1 - layer._outElapsed / layer.fadeOutFrames));
    if (layer._outElapsed >= layer.fadeOutFrames) { layer.weight = 0; layer.phase = 'done'; }
  }
  // 'hold' → weight permanece 1 ; 'done' → weight 0 (aguardando remoção)
}

// ─── FRAME ───────────────────────────────────────────────────────────────────
function renderFrame() {
  // 1. avança macros (pode adicionar/release camadas para este frame)
  if (_macros.size) { for (const macro of _macros.values()) _advanceMacro(macro); }

  if (_layers.size === 0) return;

  const arr = [..._layers.values()];

  // 2. envelope + render isolado de cada camada
  for (const layer of arr) {
    _tickEnvelope(layer);
    layer.buffer.fill(0);
    layer.touched.fill(0);
    const fn = layer.context && layer.context.OnExecute;
    if (typeof fn !== 'function') continue;
    try {
      fn();
    } catch (e) {
      _removeLayerInternal(layer, 'error');
      if (typeof layer.onError === 'function') { try { layer.onError(e); } catch (_) {} }
      console.error(`[compositor] OnExecute error (${layer._id}) — camada removida:`, e.message);
    }
  }

  if (_layers.size === 0) return;

  // 3. mescla (weight + modo) só nos canais tocados + guards + escreve no universe
  const disabled = _getDisabledChannels();
  const linear = _mergeMode === 'linear';
  for (let i = 0; i < 512; i++) {
    let any = false, htp = 0, sum = 0;
    for (const layer of arr) {
      if (!layer.touched[i]) continue;
      any = true;
      const v = layer.buffer[i] * layer.weight;
      if (linear) sum += v; else if (v > htp) htp = v;
    }
    if (!any) continue;                 // canal intocado por todas as camadas → mantém universo
    const ch = i + 1;
    if (disabled.has(ch)) continue;     // fixture desabilitado
    if (ch in _sceneLock) continue;     // canal travado por cena ativa
    let out = linear ? sum : htp;
    if (out > 255) out = 255;
    universe.setChannel(ch, Math.round(out));
  }

  // 4. remove camadas que terminaram o fade-out neste frame
  for (const layer of arr) {
    if (layer.phase === 'done') _removeLayerInternal(layer, 'fade-out');
  }
}

// ─── MACRO (sequenciador) ─────────────────────────────────────────────────────
/**
 * Estrutura de uma macro:
 *   id, mergeMode, loop, steps: [ {
 *     makeLayer: () => ({ buffer, touched, context }),  // factory (compila o script no momento)
 *     durationFrames: number | Infinity,                // hold; Infinity = só avança via triggerNextStep
 *     fadeInFrames, fadeOutFrames, overlapFrames
 *   } ]
 * Runtime: active, index, frameInStep, _triggered, _activeLayerIds(Set)
 */
function createMacro(id, steps, options = {}) {
  _macros.set(id, {
    id,
    steps: (steps || []).map(s => ({
      makeLayer: s.makeLayer,
      durationFrames: (s.durationFrames === Infinity || s.durationFrames == null)
        ? Infinity : Math.max(1, s.durationFrames | 0),
      fadeInFrames:  Math.max(0, s.fadeInFrames  | 0),
      fadeOutFrames: Math.max(0, s.fadeOutFrames | 0),
      overlapFrames: Math.max(0, s.overlapFrames | 0),
      _layerId: null,
    })),
    mergeMode: options.mergeMode === 'linear' ? 'linear' : 'htp',
    loop: !!options.loop,
    active: false,
    index: 0,
    frameInStep: 0,
    _triggered: false,
    _activeLayerIds: new Set(),
  });
  return true;
}

function removeMacro(id) { stopMacro(id); return _macros.delete(id); }

function startMacro(id) {
  const macro = _macros.get(id);
  if (!macro || !macro.steps.length) return false;
  _stopMacroLayers(macro);
  macro.active = true;
  setMergeMode(macro.mergeMode);
  _enterStep(macro, 0);
  return true;
}

function stopMacro(id) {
  const macro = _macros.get(id);
  if (!macro) return false;
  macro.active = false;
  _stopMacroLayers(macro);
  setMergeMode('htp');
  return true;
}

function triggerNextStep(id) {
  const macro = _macros.get(id);
  if (!macro || !macro.active) return false;
  _gotoNextStep(macro);
  return true;
}

function stopAllMacros() {
  for (const macro of _macros.values()) {
    macro.active = false;
    _stopMacroLayers(macro);
  }
  setMergeMode('htp');
}

function _stopMacroLayers(macro) {
  for (const lid of [...macro._activeLayerIds]) {
    const layer = _layers.get(lid);
    if (layer) _removeLayerInternal(layer, 'macro-stop');
  }
  macro._activeLayerIds.clear();
  for (const s of macro.steps) s._layerId = null;
}

function _enterStep(macro, index) {
  macro.index = index;
  macro.frameInStep = 0;
  macro._triggered = false;
  const step = macro.steps[index];
  if (!step) { macro.active = false; return; }
  let layerObj;
  try {
    layerObj = step.makeLayer();
  } catch (e) {
    console.error(`[compositor] macro "${macro.id}" passo ${index}: falha ao compilar:`, e.message);
    macro.active = false;
    return;
  }
  const lid = `macro:${macro.id}:${index}:${++_layerSeq}`;
  step._layerId = lid;
  macro._activeLayerIds.add(lid);
  addLayer(lid, {
    ...layerObj,
    fadeInFrames: step.fadeInFrames,
    fadeOutFrames: step.fadeOutFrames,
    onDone: () => { macro._activeLayerIds.delete(lid); },
  });
}

function _gotoNextStep(macro) {
  const cur = macro.steps[macro.index];
  if (cur && cur._layerId) {
    releaseLayer(cur._layerId, cur.fadeOutFrames); // fade-out da camada que sai (segue rodando no overlap)
    cur._layerId = null;
  }
  let next = macro.index + 1;
  if (next >= macro.steps.length) {
    if (macro.loop) next = 0;
    else { macro.active = false; return; } // último passo faz fade-out e a macro encerra
  }
  _enterStep(macro, next);
}

function _advanceMacro(macro) {
  if (!macro.active) return;
  const step = macro.steps[macro.index];
  if (!step) { macro.active = false; return; }
  macro.frameInStep++;
  if (step.durationFrames === Infinity) return; // avança só via triggerNextStep (manual)
  const triggerAt = Math.max(0, step.durationFrames - step.overlapFrames);
  if (!macro._triggered && macro.frameInStep >= triggerAt) {
    macro._triggered = true;
    _gotoNextStep(macro); // inicia o próximo (fade-in) e libera o atual (fade-out) → overlap/crossfade
  }
}

module.exports = {
  // config
  setSceneLock, setDisabledChannelsProvider, setMergeMode,
  // camadas (Fase 1 — usado por F-keys e page-scripts)
  addLayer, removeLayer, hasLayer, clearLayers, layerCount, releaseLayer,
  // frame
  renderFrame,
  // macro (Fase 2)
  createMacro, removeMacro, startMacro, stopMacro, triggerNextStep, stopAllMacros,
};
