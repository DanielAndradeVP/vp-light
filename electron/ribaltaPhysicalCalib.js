/**
 * ribaltaPhysicalCalib.js — Calibracao fisica de tilt das ribaltas motorizadas.
 *
 * Separa valor LOGICO (cena, script, UI, preview 3D via engine.onFrame) do valor
 * FISICO enviado ao Art-Net/SL3000. A tabela fica aqui — nao no vp.show.json.
 *
 * ALGORITMO: deslocamento aditivo puro (offset). Nada de range/min/max.
 *
 *   fisico = clamp(logico + offset)
 *
 *   Inclinacao 1:1 preservada: cada passo logico (0,1,2,...) gera o mesmo passo
 *   fisico, apenas deslocado pelo offset. Sem zona morta, sem compressao de curso.
 *
 * CALIBRACAO:
 *   tilt 0 = aparelho para CIMA; tilt 255 = para BAIXO.
 *   offset POSITIVO baixa o aparelho; offset NEGATIVO sobe.
 *   Ribalta_2 e a referencia (offset 0). Ribalta_1 esta montada ~20 acima, entao
 *   recebe offset 20 para casar com a Ribalta_2. Ajuste so o numero abaixo.
 */

const { normalizeAlias } = require('./fixtureOffsets');

/** Offset aditivo de tilt por fixture (DMX). 0 = sem alteracao (identidade). */
const PHYSICAL_TILT_OFFSET = {
  ribalta_1: -20,  // + baixa a R1 / - sobe a R1
  ribalta_2: 0,
};

const _ARTNET_BUFFER = new Uint8Array(512);
/** @type {Record<number, string>} canal DMX tilt → chave de calibracao */
let _tiltChannelToCalibKey = {};

function clamp255(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, n));
}

function isMotorizedRibaltaName(name) {
  const n = normalizeAlias(name);
  return n === 'ribalta_1' || n === 'ribalta_2';
}

function getTiltOffset(calibKey) {
  const key = normalizeAlias(calibKey);
  const offset = Number(PHYSICAL_TILT_OFFSET[key]);
  return Number.isFinite(offset) ? offset : 0;
}

/**
 * Remapeia tilt logico → fisico para uma chave de calibracao (offset aditivo puro).
 * @param {string} calibKey  ex.: 'ribalta_1'
 * @param {number} logicalValue
 */
function mapLogicalToPhysicalTilt(calibKey, logicalValue) {
  return clamp255(clamp255(logicalValue) + getTiltOffset(calibKey));
}

/**
 * API publica: calibra por fixtureId ou nome.
 * @param {string} fixtureIdOrName
 * @param {number} logicalValue
 */
function calibratePhysicalTilt(fixtureIdOrName, logicalValue) {
  const normalized = normalizeAlias(fixtureIdOrName);
  if (Object.prototype.hasOwnProperty.call(PHYSICAL_TILT_OFFSET, normalized)) {
    return mapLogicalToPhysicalTilt(normalized, logicalValue);
  }
  if (normalized.includes('ribalta_1')) return mapLogicalToPhysicalTilt('ribalta_1', logicalValue);
  if (normalized.includes('ribalta_2')) return mapLogicalToPhysicalTilt('ribalta_2', logicalValue);
  return clamp255(logicalValue);
}

/**
 * Monta mapa { canalTilt: calibKey } a partir dos fixtures do show carregado.
 * @param {Array} fixtures
 * @param {(fx: object) => boolean} [isFixtureEnabled]
 */
function configureFromFixtures(fixtures, isFixtureEnabled = () => true) {
  _tiltChannelToCalibKey = {};

  for (const fixture of fixtures || []) {
    if (!isFixtureEnabled(fixture)) continue;
    if (normalizeAlias(fixture.fixtureType) !== 'ribalta') continue;
    if (!isMotorizedRibaltaName(fixture.name)) continue;

    const calibKey = normalizeAlias(fixture.name);
    if (!Object.prototype.hasOwnProperty.call(PHYSICAL_TILT_OFFSET, calibKey)) continue;

    const start = Number(fixture.startChannel) || 1;
    const channels = Array.isArray(fixture.channels) ? fixture.channels : [];
    const tiltIndex = channels.findIndex(alias => normalizeAlias(alias) === 'tilt');
    if (tiltIndex < 0) continue;

    _tiltChannelToCalibKey[start + tiltIndex] = calibKey;
  }

  const mapped = Object.entries(_tiltChannelToCalibKey)
    .map(([ch, key]) => `${key}→ch${ch} (offset ${getTiltOffset(key)})`)
    .join(', ');
  console.log(`[ribaltaPhysicalCalib] canais tilt: ${mapped || '(nenhum)'}`);
}

/**
 * Copia o universo logico e aplica calibracao fisica so nos canais tilt mapeados.
 * Usar exclusivamente em sendArtDMX / flushArtDMX — nao no engine.onFrame (3D).
 * @param {Uint8Array} logicalBuffer
 * @returns {Uint8Array} buffer reutilizado (nao muta o universo logico)
 */
function getPhysicalUniverseForArtNet(logicalBuffer) {
  _ARTNET_BUFFER.set(logicalBuffer);
  for (const [channel, calibKey] of Object.entries(_tiltChannelToCalibKey)) {
    const idx = Number(channel) - 1;
    if (idx < 0 || idx >= 512) continue;
    _ARTNET_BUFFER[idx] = mapLogicalToPhysicalTilt(calibKey, logicalBuffer[idx]);
  }
  return _ARTNET_BUFFER;
}

function getTiltChannelMap() {
  return { ..._tiltChannelToCalibKey };
}

module.exports = {
  PHYSICAL_TILT_OFFSET,
  calibratePhysicalTilt,
  mapLogicalToPhysicalTilt,
  configureFromFixtures,
  getPhysicalUniverseForArtNet,
  getTiltChannelMap,
};
