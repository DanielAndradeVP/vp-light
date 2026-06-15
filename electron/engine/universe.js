/**
 * universe.js — Estado dos 512 canais DMX
 * Roda APENAS no main process. Nunca importar no renderer.
 */

// Mapa de offsets por canal DMX: { [canal]: offsetValue }
// Injetado pelo main.js após carregar o show (fixtures com panOffset / tiltOffset).
// setChannel soma o offset antes de gravar (valor físico = lógico + offset, clamped 0–255).
// getUniverseSnapshot subtrai o offset ao retornar (renderer sempre vê valor lógico).
let _channelOffsets = {};

function setChannelOffsets(map) {
  const previousOffsets = _channelOffsets || {};
  const nextOffsets = map || {};
  _universe.rebaseChannelOffsets(previousOffsets, nextOffsets);
  _channelOffsets = nextOffsets;
}

class DmxUniverse {
  constructor() {
    this._buffer = new Uint8Array(512);
  }

  _validateChannel(channel) {
    return Number.isInteger(channel) && channel >= 1 && channel <= 512;
  }

  _toIndex(channel) {
    return channel - 1;
  }

  _normalizeValue(value) {
    return Math.max(0, Math.min(255, Math.round(Number(value))));
  }

  /**
   * Define valor de um canal DMX.
   * @param {number} channel  Canal DMX (1–512)
   * @param {number} value    Valor lógico (0–255); offset físico é aplicado automaticamente.
   */
  setChannel(channel, value) {
    if (!this._validateChannel(channel)) return;
    const offset = _channelOffsets[channel] || 0;
    this._buffer[this._toIndex(channel)] = this._normalizeValue(Number(value) + offset);
  }

  /**
   * Mantém a calibração física ativa quando o estado lógico é zero.
   * Ex.: pan lógico 0 do Beam 1 continua saindo fisicamente como panOffset 44.
   */
  applyOffsetBaselines() {
    for (const [channel, offset] of Object.entries(_channelOffsets)) {
      const ch = Number(channel);
      if (!this._validateChannel(ch)) continue;
      this._buffer[this._toIndex(ch)] = this._normalizeValue(offset);
    }
  }

  /**
   * Troca o mapa de offsets preservando o valor lógico atual de cada canal.
   * Se um canal perde offset, remove do buffer o baseline físico antigo.
   */
  rebaseChannelOffsets(previousOffsets, nextOffsets) {
    const channels = new Set([
      ...Object.keys(previousOffsets || {}),
      ...Object.keys(nextOffsets || {}),
    ]);
    channels.forEach(channel => {
      const ch = Number(channel);
      if (!this._validateChannel(ch)) return;
      const index = this._toIndex(ch);
      const previousOffset = Number(previousOffsets?.[ch] ?? previousOffsets?.[channel] ?? 0) || 0;
      const nextOffset = Number(nextOffsets?.[ch] ?? nextOffsets?.[channel] ?? 0) || 0;
      const logical = Math.max(0, this._buffer[index] - previousOffset);
      this._buffer[index] = this._normalizeValue(logical + nextOffset);
    });
  }

  /**
   * Aplica um mapa { canal: valor } de uma cena inteira.
   * @param {Object} channelMap  Ex: { "1": 255, "4": 128 }
   */
  applyChannelMap(channelMap) {
    for (const [ch, val] of Object.entries(channelMap)) {
      this.setChannel(Number(ch), val);
    }
  }

  /**
   * Zera todos os 512 canais lógicos e reaplica calibrações físicas fixas.
   */
  blackout() {
    this._buffer.fill(0);
    this.applyOffsetBaselines();
  }

  /**
   * Retorna o Uint8Array bruto (referência direta — não copiar desnecessariamente).
   * @returns {Uint8Array}
   */
  getRawBuffer() {
    return this._buffer;
  }

  /**
   * Retorna snapshot como objeto { canal: valor } contendo APENAS canais com valor lógico > 0.
   * Canais com offset têm o offset subtraído antes de retornar — o renderer sempre vê o valor
   * lógico (0–255 do operador), nunca o valor físico com offset.
   * Canais com valor 0 são omitidos intencionalmente — o renderer trata ausência como 0
   * via fallback `testValues[ch] || 0` (Main.jsx). Não alterar para retornar 512 posições:
   * isso quebraria o contrato { canal: valor } e aumentaria o payload IPC sem necessidade.
   * @returns {Object}  Ex: { "1": 255, "5": 128 }
   */
  getUniverseSnapshot() {
    const snap = {};
    for (let i = 0; i < 512; i++) {
      if (this._buffer[i] > 0) {
        const ch = i + 1;
        const offset = _channelOffsets[ch] || 0;
        const logical = Math.max(0, this._buffer[i] - offset);
        if (logical > 0) snap[ch] = logical;
      }
    }
    return snap;
  }
}

const _universe = new DmxUniverse();
let _activeScenesMap = {}; // { sceneId: { name, channels: { "1": 255 } } }

function setChannel(channel, value) {
  _universe.setChannel(channel, value);
}

function applyScene(channelMap) {
  _universe.applyChannelMap(channelMap);
}

function restoreState(channelMap) {
  _universe.blackout();
  _universe.applyChannelMap(channelMap);
}

function blackout() {
  _universe.blackout();
}

function getUniverse() {
  return _universe.getRawBuffer();
}

function getUniverseSnapshot() {
  return _universe.getUniverseSnapshot();
}

function setActiveScenes(scenesMap) {
  _activeScenesMap = { ...(scenesMap || {}) };
}

function detectConflicts() {
  const channelSources = {}; // { "1": [{ id, name, value }] }

  for (const [sceneId, sceneData] of Object.entries(_activeScenesMap)) {
    if (!sceneData.channels) continue;
    for (const [ch, val] of Object.entries(sceneData.channels)) {
      if (!channelSources[ch]) channelSources[ch] = [];
      channelSources[ch].push({
        id: sceneId,
        name: sceneData.name || sceneId,
        value: val,
      });
    }
  }

  const conflicts = [];
  for (const [ch, sources] of Object.entries(channelSources)) {
    if (sources.length > 1) {
      conflicts.push({
        channel: Number(ch),
        sources,
      });
    }
  }

  return conflicts;
}

module.exports = { setChannel, applyScene, restoreState, blackout, getUniverse, getUniverseSnapshot, setActiveScenes, detectConflicts, setChannelOffsets };
