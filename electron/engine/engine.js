/**
 * engine.js — Loop principal DMX a 25fps (40ms por frame)
 *
 * Responsabilidades:
 *   - Chamar sendArtDMX a cada 40ms com o universo atual
 *   - Expor start() / stop() para o main.js controlar via IPC
 *
 * NÃO gerencia estado DMX — isso é responsabilidade do universe.js
 */

const { getUniverse } = require('./universe');
const { sendArtDMX, closeSocket } = require('./artnet');
const compositor    = require('./compositor');
const interpolator  = require('./interpolator');
const ribaltaDebug  = require('./ribaltaDebug');
const ribaltaPhysicalCalib = require('../ribaltaPhysicalCalib');
const perfStats = require('./perfStats');

const FPS = 25;
const INTERVAL_MS = Math.round(1000 / FPS); // 40ms

let intervalId = null;
let frameCount = 0;
const _stageStats = {
  interpolator: perfStats.createStatTracker(),
  compositor: perfStats.createStatTracker(),
  artnet: perfStats.createStatTracker(),
  listeners: perfStats.createStatTracker(),
  total: perfStats.createStatTracker(),
};

// Listeners externos notificados a cada frame, após o universo final estar
// montado (mesmo ciclo de 40ms — nenhum loop novo é criado). Usado pela
// janela do visualizador 3D para receber o universo sem acoplar a engine
// a nada de Electron/BrowserWindow.
const frameListeners = [];

function onFrame(callback) {
  if (typeof callback === 'function') frameListeners.push(callback);
}

function start() {
  if (intervalId) {
    console.log('[engine] já está rodando');
    return;
  }
  frameCount = 0;
  intervalId = setInterval(() => {
    const _frameStart = performance.now();
    ribaltaDebug.tickFrame();

    let _t0 = performance.now();
    try {
      interpolator.tick();         // avança interpolação de pan/tilt (speed virtual)
    } catch (e) {
      console.error('[engine] erro em interpolator.tick:', e.message);
    }
    _stageStats.interpolator.record(performance.now() - _t0);

    _t0 = performance.now();
    try {
      compositor.renderFrame();    // relógio único: compõe as camadas no universo
    } catch (e) {
      console.error('[engine] erro em compositor.renderFrame:', e.message);
    }
    _stageStats.compositor.record(performance.now() - _t0);

    // Art-Net: tilt físico calibrado; onFrame abaixo usa universo lógico (3D inalterado).
    _t0 = performance.now();
    try {
      sendArtDMX(ribaltaPhysicalCalib.getPhysicalUniverseForArtNet(getUniverse()));
    } catch (e) {
      console.error('[engine] erro ao enviar Art-Net:', e.message);
    }
    _stageStats.artnet.record(performance.now() - _t0);

    // Universo final já montado neste ponto — notifica listeners (ex.: viewer 3D).
    const currentUniverse = getUniverse();
    _t0 = performance.now();
    for (const listener of frameListeners) {
      try {
        listener(currentUniverse);
      } catch (e) {
        console.error('[engine] erro em frame listener:', e.message);
      }
    }
    _stageStats.listeners.record(performance.now() - _t0);

    const _totalDuration = performance.now() - _frameStart;
    const _totalResult = _stageStats.total.record(_totalDuration);
    if (_totalDuration >= perfStats.THRESHOLDS.warn && _stageStats.total.shouldWarn(performance.now())) {
      console.warn(
        `[perf] frame lento: ${_totalDuration.toFixed(1)}ms total ` +
        `(interp ${_stageStats.interpolator.snapshot().last.toFixed(1)}ms, ` +
        `compositor ${_stageStats.compositor.snapshot().last.toFixed(1)}ms, ` +
        `artnet ${_stageStats.artnet.snapshot().last.toFixed(1)}ms, ` +
        `listeners ${_stageStats.listeners.snapshot().last.toFixed(1)}ms) — ` +
        `média ${_totalResult.avg.toFixed(1)}ms, ${_totalResult.overruns} estouro(s) registrado(s). ` +
        `Nota: esta medição detecta scripts lentos que RETORNAM; não interrompe nem detecta um loop infinito (while(true)) — isso é limitação estrutural do single-thread, documentada, não um watchdog.`
      );
    }

    frameCount++;
  }, INTERVAL_MS);
  console.log(`[engine] iniciado @ ${FPS}fps (${INTERVAL_MS}ms/frame)`);
}

function stop() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  closeSocket();
  console.log(`[engine] parado após ${frameCount} frames`);
}

function isRunning() {
  return intervalId !== null;
}

function getFrameCount() {
  return frameCount;
}

function getPerformanceSnapshot() {
  const snap = {};
  for (const [stage, tracker] of Object.entries(_stageStats)) snap[stage] = tracker.snapshot();
  return snap;
}

module.exports = { start, stop, isRunning, getFrameCount, onFrame, getPerformanceSnapshot };
