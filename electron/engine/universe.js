/**
 * universe.js — Estado dos 512 canais DMX
 * Roda APENAS no main process. Nunca importar no renderer.
 */

const universe = new Uint8Array(512); // índice 0 = canal DMX 1

/**
 * Define valor de um canal DMX.
 * @param {number} channel  Canal DMX (1–512)
 * @param {number} value    Valor (0–255)
 */
function setChannel(channel, value) {
  if (channel < 1 || channel > 512) return;
  universe[channel - 1] = Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Aplica um mapa { canal: valor } de uma cena inteira.
 * @param {Object} channelMap  Ex: { "1": 255, "4": 128 }
 */
function applyScene(channelMap) {
  for (const [ch, val] of Object.entries(channelMap)) {
    setChannel(Number(ch), Number(val));
  }
}

/**
 * Zera todos os 512 canais.
 */
function blackout() {
  universe.fill(0);
}

/**
 * Retorna o Uint8Array do universo (referência direta — não copiar desnecessariamente).
 * @returns {Uint8Array}
 */
function getUniverse() {
  return universe;
}

/**
 * Retorna snapshot como objeto { canal: valor } para o renderer.
 * Usado apenas quando o renderer pede (ex: DMXMonitor, SceneEditor).
 * @returns {Object}
 */
function getUniverseSnapshot() {
  const snap = {};
  for (let i = 0; i < 512; i++) {
    if (universe[i] > 0) snap[i + 1] = universe[i];
  }
  return snap;
}

module.exports = { setChannel, applyScene, blackout, getUniverse, getUniverseSnapshot };
