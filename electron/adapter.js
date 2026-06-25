/**
 * adapter.js — Traduz valores lógicos em DMX específicos por fixture.
 *
 * Fonte dos mapeamentos: campo `adapters` de cada fixture no .show.json.
 *
 * Formato persistido por fixture:
 * {
 *   "adapters": {
 *     "<adapterKey>": {
 *       "<valorLogico>": <valorDMX 0-255>,
 *       ...
 *     },
 *     ...
 *   }
 * }
 *
 * Exemplo (color_wheel dos Moving Heads):
 *   "adapters": {
 *     "color": { "red": 30, "white": 0, "green": 60 }
 *   }
 *
 * adapterKey é genérico — aceita "color", "gobo", "prism", "frost", "macro",
 * "speed", "range" ou presets por equipamento sem mudança estrutural.
 *
 * API exposta aos scripts: adapter.resolve(fixtureId, alias, adapterKey, valorLogico)
 */

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function clampDmx(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(255, n));
}

/**
 * @param {Function} getFixture        (fixtureId) => fixture | null
 * @param {Function} getChannelByAlias (fixture, alias) => number | null
 * @param {Function} isEnabled         (fixture) => boolean
 * @param {string} fixtureId
 * @param {string} alias               alias do canal destino (ex.: color_wheel)
 * @param {string} adapterKey          tipo de adaptação (ex.: color)
 * @param {string|number} logicalValue valor lógico (ex.: red)
 * @returns {number|null} valor DMX pronto para SetChannel, ou null se ausente
 */
function resolve(getFixture, getChannelByAlias, isEnabled, fixtureId, alias, adapterKey, logicalValue) {
  try {
    const fixture = getFixture(fixtureId);
    if (!fixture || !isEnabled(fixture)) return null;
    if (!getChannelByAlias(fixture, alias)) return null;

    const key = normalizeKey(adapterKey);
    const logical = normalizeKey(logicalValue);
    if (!key || !logical) return null;

    const adapters = fixture.adapters;
    if (!adapters || typeof adapters !== 'object') return null;

    const mapping = adapters[key];
    if (!mapping || typeof mapping !== 'object') return null;

    if (!Object.prototype.hasOwnProperty.call(mapping, logical)) return null;

    return clampDmx(mapping[logical]);
  } catch {
    return null;
  }
}

module.exports = { resolve, normalizeKey, clampDmx };
