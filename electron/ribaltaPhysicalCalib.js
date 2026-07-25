/**
 * ribaltaPhysicalCalib.js — Calibracao fisica de tilt das ribaltas motorizadas.
 *
 * Separa valor LOGICO (cena, script, UI, preview 3D via engine.onFrame) do valor
 * FISICO enviado ao Art-Net/SL3000. A tabela fica aqui — nao no vp.show.json.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * POR QUE OFFSET PURO NAO RESOLVE (os 2 problemas que se alternavam):
 *
 *   fisico = clamp(logico + offset)
 *
 *   - offset NEGATIVO (-20): os logicos 0..20 batem todos em fisico 0 (clamp).
 *     => ZONA MORTA embaixo: a ribalta "nao mexe" ate o tilt passar de 20 (delay).
 *   - offset POSITIVO (+20): no repouso (logico 0) o fisico vira 20.
 *     => COMECA DESALINHADA, e a zona morta vai pro topo (235..255 batem em 255).
 *
 *   Sao o MESMO defeito (o clamp) em pontas opostas. Offset constante puro nao
 *   alinha o repouso E mantem movimento continuo ao mesmo tempo, porque a R1
 *   fisicamente NAO alcanca os ~20 de uma das extremidades.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * SOLUCAO (offset com "joelho" / soft-offset):
 *
 *   - Na FAIXA DE TRABALHO aplica o offset constante exato (alinhamento perfeito).
 *   - So na PONTA que estouraria, troca o congelamento por uma RAMPA suave: a
 *     ribalta continua se movendo (em velocidade reduzida) em vez de travar.
 *
 *   Resultado:
 *     1) Repouso (tilt 0) alinhado.                  -> rampa comeca em fisico 0
 *     2) Mexeu no tilt, ela anda na hora (sem delay). -> rampa tem inclinacao > 0
 *     3) Faixa funcional (tilt ~105-110) com offset exato. -> fora do joelho
 *
 *   O unico ponto que "sobra" e o extremo fisico que a R1 nao alcanca de verdade,
 *   agora diluido numa rampa suave (nao um degrau travado).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DOIS TIPOS DE ERRO (precisam de knobs diferentes):
 *
 *   1) Diferenca CONSTANTE ao longo do curso  -> e DESLOCAMENTO -> use `offset`.
 *   2) Diferenca que CRESCE conforme o tilt    -> e ESCALA/VELOCIDADE -> use `gain`.
 *
 *   O sintoma "uma ribalta vai ficando cada vez mais a frente quanto mais o tilt
 *   sobe" e o caso (2): as duas percorrem angulos diferentes por passo de DMX.
 *   Offset sozinho NUNCA corrige isso (ele mantem a diferenca constante). O `gain`
 *   < 1 faz a ribalta percorrer proporcionalmente MENOS, fechando a diferenca que
 *   cresce; o efeito e zero no repouso (tilt 0) e maximo no extremo (tilt 255).
 *
 * FORMULA:
 *   base   = gain * logico               (corrige a diferenca que cresce)
 *   fisico = soft_offset(base, offset)   (corrige a diferenca constante + rampa)
 *
 * ──────────────────────────────────────────────────────────────────────────
 * COMO AJUSTAR (medir no palco):
 *   gain   : 1 = sem escala. < 1 = a ribalta percorre menos (puxa a ponta de
 *            baixo para CIMA, progressivo). Use quando uma fica cada vez mais a
 *            frente que a outra ao subir o tilt. Ex.: 0.92.
 *   offset : deslocamento constante (DMX). tilt 0 = CIMA, 255 = BAIXO.
 *            (-) sobe a ponta, (+) desce. Use quando a diferenca e igual no curso.
 *   knee   : largura da rampa suave na ponta que estouraria (default 2*|offset|).
 *            So atua quando ha offset; tira a zona morta (sem travar).
 */

const { normalizeAlias } = require('./fixtureOffsets');

/**
 * Calibracao de tilt por fixture:
 *   gain   -> escala (corrige diferenca que cresce com o tilt). Default 1.
 *   offset -> deslocamento constante na faixa de trabalho (DMX). Default 0.
 *   knee   -> largura da rampa suave na ponta (opcional; default 2*|offset|).
 *
 * Ribalta_2 recebe gain 0.915 para anular o "ficar cada vez mais a frente" ao
 * subir o tilt (no extremo de baixo ela passa a parar junto com a Ribalta_1).
 */
const PHYSICAL_TILT_CALIBRATION = {
  ribalta_1: { offset: -20, knee: 40 },

  // A R2 estava descendo mais rapido nos primeiros 100 valores.
  // O gain sozinho reduz pouco no inicio, entao aplicamos tambem um offset suave.
  ribalta_2: { gain: 1, offset: -20, knee: 40 },
};
const _ARTNET_BUFFER = new Uint8Array(512);
/** @type {Record<number, string>} canal DMX tilt → chave de calibracao */
let _tiltChannelToCalibKey = {};
/** Liga/desliga a camada inteira (as duas ribaltas juntas). Default: ativa. */
let _enabled = true;

function clamp255(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, n));
}

function isMotorizedRibaltaName(name) {
  const n = normalizeAlias(name);
  return n === 'ribalta_1' || n === 'ribalta_2';
}

/**
 * Remapeia tilt logico → fisico (soft-offset: offset constante + rampa na ponta).
 *
 *   offset < 0  -> estouro embaixo: rampa em [0, knee], offset exato em [knee, 255].
 *   offset > 0  -> estouro em cima: offset exato em [0, 255-knee], rampa no fim.
 *   offset = 0  -> identidade.
 *
 * A rampa e linear e CONTINUA com a regiao de offset exato; inclinacao
 * (knee - |offset|) / knee > 0 garante movimento (sem zona morta).
 *
 * @param {string} calibKey  ex.: 'ribalta_1'
 * @param {number} logicalValue
 */
function mapLogicalToPhysicalTilt(calibKey, logicalValue) {
  const key = normalizeAlias(calibKey);
  const cal = PHYSICAL_TILT_CALIBRATION[key];
  const logical = clamp255(logicalValue);
  if (!cal) return logical;

  // 1) Escala (gain): corrige a diferenca que CRESCE com o tilt.
  const gain = Number.isFinite(Number(cal.gain)) ? Number(cal.gain) : 1;
  const base = gain * logical;

  // 2) Deslocamento (offset) com rampa suave (knee): corrige a diferenca constante.
  const offset = Number(cal.offset) || 0;
  if (offset === 0) return clamp255(base);

  const d = Math.abs(offset);
  const knee = Number.isFinite(Number(cal.knee)) ? Number(cal.knee) : 2 * d;

  // knee invalido (<= |offset|): rampa nao teria inclinacao positiva — cai no
  // offset simples com clamp (comportamento antigo) para nao inventar valores.
  if (!(knee > d)) return clamp255(base + offset);

  if (offset < 0) {
    // Rampa suave de (0,0) ate (knee, knee-d); depois offset exato.
    if (base >= knee) return clamp255(base - d);
    return clamp255(base * (knee - d) / knee);
  }

  // offset > 0: offset exato ate (255-knee); depois rampa suave ate (255,255).
  const start = 255 - knee;
  if (base <= start) return clamp255(base + d);
  return clamp255((start + d) + (base - start) * (knee - d) / knee);
}

/**
 * API publica: calibra por fixtureId ou nome.
 * @param {string} fixtureIdOrName
 * @param {number} logicalValue
 */
function calibratePhysicalTilt(fixtureIdOrName, logicalValue) {
  const normalized = normalizeAlias(fixtureIdOrName);
  if (PHYSICAL_TILT_CALIBRATION[normalized]) {
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
    if (!PHYSICAL_TILT_CALIBRATION[calibKey]) continue;

    const start = Number(fixture.startChannel) || 1;
    const channels = Array.isArray(fixture.channels) ? fixture.channels : [];
    const tiltIndex = channels.findIndex(alias => normalizeAlias(alias) === 'tilt');
    if (tiltIndex < 0) continue;

    _tiltChannelToCalibKey[start + tiltIndex] = calibKey;
  }

  const mapped = Object.entries(_tiltChannelToCalibKey)
    .map(([ch, key]) => {
      const cal = PHYSICAL_TILT_CALIBRATION[key];
      const d = Math.abs(Number(cal.offset) || 0);
      const knee = Number.isFinite(Number(cal.knee)) ? Number(cal.knee) : 2 * d;
      const gain = Number.isFinite(Number(cal.gain)) ? Number(cal.gain) : 1;
      return `${key}→ch${ch} (gain ${gain}, offset ${cal.offset || 0}, knee ${knee})`;
    })
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
  if (!_enabled) return _ARTNET_BUFFER;
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

/** Liga/desliga a calibracao fisica de tilt das duas ribaltas (sempre as duas juntas). */
function setEnabled(enabled) {
  _enabled = !!enabled;
  console.log(`[ribaltaPhysicalCalib] calibração ${_enabled ? 'ATIVA' : 'DESATIVADA (tilt cru)'}`);
}

function isEnabled() {
  return _enabled;
}

module.exports = {
  PHYSICAL_TILT_CALIBRATION,
  calibratePhysicalTilt,
  mapLogicalToPhysicalTilt,
  configureFromFixtures,
  getPhysicalUniverseForArtNet,
  getTiltChannelMap,
  setEnabled,
  isEnabled,
};