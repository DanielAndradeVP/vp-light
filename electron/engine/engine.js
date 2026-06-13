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
const compositor = require('./compositor');

const FPS = 25;
const INTERVAL_MS = Math.round(1000 / FPS); // 40ms

let intervalId = null;
let frameCount = 0;

function start() {
  if (intervalId) {
    console.log('[engine] já está rodando');
    return;
  }
  frameCount = 0;
  intervalId = setInterval(() => {
    compositor.renderFrame();      // relógio único: compõe as camadas no universo
    sendArtDMX(getUniverse());     // e envia o frame
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

module.exports = { start, stop, isRunning, getFrameCount };
