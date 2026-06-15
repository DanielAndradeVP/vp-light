/**
 * interpolator.js — Interpolação suave de pan/tilt para fixtures com speed virtual.
 *
 * Fixtures com virtualPanTiltSpeed:true têm um canal "virtual_speed" (ex: CH7) que
 * NÃO vai para o universo DMX — ele alimenta este módulo, que avança pan/tilt
 * suavemente a cada tick (40ms) em direção ao alvo definido pelo operador.
 *
 * Integração:
 *   - engine.js chama interpolator.tick() a cada 40ms (antes de sendArtDMX)
 *   - main.js intercepta dmx:setChannel / dmx:setChannelRange:
 *       canal virtual_speed → interpolator.setSpeed()   (não vai ao universo)
 *       canal pan/tilt controlado → interpolator.setTarget() (não vai direto ao universo)
 *
 * Roda APENAS no main process. Nunca importar no renderer.
 */

const universe = require('./universe');

// Unidades de avanço por tick a speed=128.
// 5 units/tick * 25fps = 125 units/s → curso completo (255) em ~2s.
const UNITS_AT_128 = 5;

/**
 * Estado por fixture:
 * {
 *   speedChannel: number,
 *   panChannel:   number | null,
 *   tiltChannel:  number | null,
 *   speed:        number  (0–255 vindo do fader; 0 = rápido, 255 = lento),
 *   panCurrent:   number  (valor lógico atual interpolado),
 *   panTarget:    number  (valor lógico alvo),
 *   tiltCurrent:  number,
 *   tiltTarget:   number,
 * }
 */
const _fixtures = {};       // fixtureId → state
const _speedChannelMap = {}; // dmxChannel → fixtureId
const _controlledMap   = {}; // dmxChannel → { fixtureId, type: 'pan'|'tilt' }

/**
 * Configura os fixtures com speed virtual. Chamado após carregar/recarregar show.
 * @param {Array<{
 *   fixtureId:     string,
 *   speedChannel:  number,
 *   panChannel:    number | null,
 *   tiltChannel:   number | null,
 * }>} configs
 */
function configure(configs) {
  // Limpar estado anterior
  for (const k of Object.keys(_fixtures))      delete _fixtures[k];
  for (const k of Object.keys(_speedChannelMap)) delete _speedChannelMap[k];
  for (const k of Object.keys(_controlledMap))  delete _controlledMap[k];

  for (const cfg of (configs || [])) {
    _fixtures[cfg.fixtureId] = {
      speedChannel: cfg.speedChannel || null,
      panChannel:   cfg.panChannel   || null,
      tiltChannel:  cfg.tiltChannel  || null,
      speed:        0,
      panCurrent:   0,
      panTarget:    0,
      tiltCurrent:  0,
      tiltTarget:   0,
    };
    if (cfg.speedChannel) _speedChannelMap[cfg.speedChannel] = cfg.fixtureId;
    if (cfg.panChannel)   _controlledMap[cfg.panChannel]  = { fixtureId: cfg.fixtureId, type: 'pan' };
    if (cfg.tiltChannel)  _controlledMap[cfg.tiltChannel] = { fixtureId: cfg.fixtureId, type: 'tilt' };
  }

  console.log(`[interpolator] configurado com ${(configs || []).length} fixture(s) de speed virtual`);
}

/** Retorna true se o canal é um speed virtual (não deve ir ao universo DMX). */
function isVirtualChannel(channel) {
  return !!_speedChannelMap[channel];
}

/** Retorna true se o canal é pan/tilt controlado pelo interpolador. */
function isControlledChannel(channel) {
  return !!_controlledMap[channel];
}

/**
 * Define a velocidade de interpolação para o fixture dono do canal.
 * O valor NUNCA é enviado ao universo DMX — é consumido internamente.
 * @param {number} channel  Canal DMX do virtual_speed
 * @param {number} value    Velocidade (0–255)
 */
function setSpeed(channel, value) {
  const fixtureId = _speedChannelMap[channel];
  if (!fixtureId) return;
  _fixtures[fixtureId].speed = Math.max(0, Math.min(255, Number(value)));
}

/**
 * Define o valor-alvo lógico de um canal pan ou tilt.
 * O interpolador avança current → target a cada tick.
 * @param {number} channel  Canal DMX (pan ou tilt)
 * @param {number} value    Valor lógico alvo (0–255)
 */
function setTarget(channel, value) {
  const entry = _controlledMap[channel];
  if (!entry) return;
  const state = _fixtures[entry.fixtureId];
  if (!state) return;
  const clamped = Math.max(0, Math.min(255, Number(value)));
  if (entry.type === 'pan') {
    state.panTarget = clamped;
  } else {
    state.tiltTarget = clamped;
  }
}

/**
 * Avança a interpolação de todos os fixtures um passo (40ms).
 * Chamado pelo engine.js antes de sendArtDMX.
 * Escreve no universo via universe.setChannel() — o offset físico é aplicado automaticamente.
 */
function tick() {
  for (const state of Object.values(_fixtures)) {
    _advance(state, 'pan');
    _advance(state, 'tilt');
  }
}

function _advance(state, type) {
  const channel = type === 'pan' ? state.panChannel : state.tiltChannel;
  if (!channel) return;

  const current = type === 'pan' ? state.panCurrent : state.tiltCurrent;
  const target  = type === 'pan' ? state.panTarget  : state.tiltTarget;

  let next;
  const effectiveSpeed = 255 - state.speed;
  if (effectiveSpeed >= 255) {
    next = target; // snap imediato
  } else {
    const step = Math.max(1, Math.round(effectiveSpeed * UNITS_AT_128 / 128));
    const diff = target - current;
    if (diff === 0) {
      next = current;
    } else {
      next = current + Math.sign(diff) * Math.min(Math.abs(diff), step);
    }
  }

  if (type === 'pan') state.panCurrent = next;
  else                state.tiltCurrent = next;

  // universe.setChannel aplica o panOffset/tiltOffset físico automaticamente
  universe.setChannel(channel, next);
}

module.exports = { configure, isVirtualChannel, isControlledChannel, setSpeed, setTarget, tick };
