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

const FPS = 25;
const INTERVAL_MS = Math.round(1000 / FPS); // 40ms

let intervalId = null;
let frameCount = 0;

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
    ribaltaDebug.tickFrame();
    interpolator.tick();           // avança interpolação de pan/tilt (speed virtual)
    compositor.renderFrame();      // relógio único: compõe as camadas no universo
    // Art-Net: tilt físico calibrado; onFrame abaixo usa universo lógico (3D inalterado).
    sendArtDMX(ribaltaPhysicalCalib.getPhysicalUniverseForArtNet(getUniverse()));

    // Universo final já montado neste ponto — notifica listeners (ex.: viewer 3D).
    const currentUniverse = getUniverse();
    for (const listener of frameListeners) {
      try {
        listener(currentUniverse);
      } catch (e) {
        console.error('[engine] erro em frame listener:', e.message);
      }
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

module.exports = { start, stop, isRunning, getFrameCount, onFrame };
