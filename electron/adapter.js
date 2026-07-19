const fixtureProfiles = require('./fixtureProfiles');

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

// Cores RGB padrão: definição matemática do espaço de cor aditivo, não dados
// medidos ou calibrados de um equipamento físico específico.
const STANDARD_RGB_COLORS = {
  red:     { r: 255, g: 0,   b: 0   },
  green:   { r: 0,   g: 255, b: 0   },
  blue:    { r: 0,   g: 0,   b: 255 },
  white:   { r: 255, g: 255, b: 255 },
  yellow:  { r: 255, g: 255, b: 0   },
  cyan:    { r: 0,   g: 255, b: 255 },
  magenta: { r: 255, g: 0,   b: 255 },
  // 'purple' é alias intencional de magenta (mesmo par r/b), para casar com o
  // nome já usado nas tabelas de color_wheel dos moving heads ('purple').
  purple:  { r: 255, g: 0,   b: 255 },
};

const _lastDiagnosticAt = new Map();

function diagnostic(fixtureId, capability, code, message) {
  try {
    const key = `${fixtureId}|${capability}|${code}`;
    const now = Date.now();
    const last = _lastDiagnosticAt.get(key);
    if (last === undefined || now - last > 3000) {
      _lastDiagnosticAt.set(key, now);
      console.warn(`[adapter] ${key}: ${message}`);
    }
  } catch {
    // Diagnóstico é apenas efeito colateral; nunca pode impedir o Result.
  }
}

function failure(fixtureId, capability, code, requestedValue, message) {
  const result = {
    ok: false,
    code,
    fixtureId,
    capability,
    requestedValue,
    message,
  };
  diagnostic(fixtureId, capability, code, message);
  return result;
}

function resolveEnabledFixture(deps, fixtureId, capability, requestedValue) {
  const fixture = deps.getFixture(fixtureId);
  if (!fixture) {
    return { error: failure(fixtureId, capability, 'FIXTURE_NOT_FOUND', requestedValue, 'Fixture não encontrada') };
  }
  if (!deps.isEnabled(fixture)) {
    return { error: failure(fixtureId, capability, 'FIXTURE_DISABLED', requestedValue, 'Fixture desabilitada') };
  }
  return { fixture };
}

function resolveProfileCapability(fixture, fixtureId, capability, requestedValue) {
  const profile = fixtureProfiles.resolveProfileForFixture(fixture);
  if (!profile) {
    return { error: failure(fixtureId, capability, 'PROFILE_NOT_FOUND', requestedValue, 'Profile da fixture não encontrado') };
  }

  const capInfo = fixtureProfiles.getCapabilityInfo(profile, capability);
  if (!capInfo) {
    return { error: failure(fixtureId, capability, 'CAPABILITY_NOT_SUPPORTED', requestedValue, `Capability "${capability}" não suportada`) };
  }
  if (capInfo.status === 'mapping-incomplete') {
    return { error: failure(fixtureId, capability, 'CAPABILITY_NOT_MAPPED', requestedValue, `Capability "${capability}" ainda não está mapeada`) };
  }
  return { profile, capInfo };
}

function mappedValueResult(deps, fixture, profile, fixtureId, capability, requestedValue) {
  if (typeof requestedValue !== 'string') {
    return failure(fixtureId, capability, 'INVALID_VALUE', requestedValue, 'O valor deve ser uma string');
  }

  const logical = normalizeKey(requestedValue);
  const mapping = fixture.adapters?.[capability];
  if (!mapping || typeof mapping !== 'object' || !Object.prototype.hasOwnProperty.call(mapping, logical)) {
    return failure(fixtureId, capability, 'VALUE_NOT_SUPPORTED', requestedValue, `Valor "${requestedValue}" não suportado`);
  }

  const channelSpec = fixtureProfiles.getChannelSpec(profile, capability);
  const channel = channelSpec && deps.getChannelByAlias(fixture, channelSpec.alias);
  if (!channel) {
    return failure(fixtureId, capability, 'CHANNEL_NOT_FOUND', requestedValue, `Canal da capability "${capability}" não encontrado`);
  }

  const value = clampDmx(mapping[logical]);
  if (value === null) {
    return failure(fixtureId, capability, 'INVALID_VALUE', requestedValue, `Mapeamento de "${requestedValue}" não é numérico`);
  }

  deps.writeChannel(channel, value);
  return { ok: true, fixtureId, capability, channel, value };
}

function setColor(deps, fixtureId, colorName) {
  const capability = 'color';
  try {
    const resolvedFixture = resolveEnabledFixture(deps, fixtureId, capability, colorName);
    if (resolvedFixture.error) return resolvedFixture.error;

    const resolvedCapability = resolveProfileCapability(resolvedFixture.fixture, fixtureId, capability, colorName);
    if (resolvedCapability.error) return resolvedCapability.error;

    const { fixture } = resolvedFixture;
    const { profile, capInfo } = resolvedCapability;

    if (capInfo.type === 'enumerated') {
      const channelSpec = fixtureProfiles.getChannelSpec(profile, capability);
      const channel = channelSpec && deps.getChannelByAlias(fixture, channelSpec.alias);
      if (!channel) {
        return failure(fixtureId, capability, 'CHANNEL_NOT_FOUND', colorName, 'Canal da roda de cor não encontrado');
      }

      const logical = normalizeKey(colorName);
      const mapping = fixture.adapters?.color;
      if (!mapping || typeof mapping !== 'object' || !Object.prototype.hasOwnProperty.call(mapping, logical)) {
        return failure(fixtureId, capability, 'VALUE_NOT_SUPPORTED', colorName, `Cor "${colorName}" não suportada`);
      }

      const value = clampDmx(mapping[logical]);
      if (value === null) {
        return failure(fixtureId, capability, 'INVALID_VALUE', colorName, `Mapeamento da cor "${colorName}" não é numérico`);
      }

      deps.writeChannel(channel, value);
      return { ok: true, fixtureId, capability, channel, value };
    }

    if (capInfo.type === 'rgb' || capInfo.type === 'rgbw') {
      const logical = normalizeKey(colorName);
      const color = STANDARD_RGB_COLORS[logical];
      if (!color) {
        return failure(fixtureId, capability, 'VALUE_NOT_SUPPORTED', colorName, `Cor "${colorName}" não suportada`);
      }

      const channelNames = capInfo.type === 'rgbw'
        ? ['red', 'green', 'blue', 'white']
        : ['red', 'green', 'blue'];
      const channels = {};
      for (const channelName of channelNames) {
        const channelSpec = fixtureProfiles.getChannelSpec(profile, channelName);
        const channel = channelSpec && deps.getChannelByAlias(fixture, channelSpec.alias);
        if (!channel) {
          return failure(fixtureId, capability, 'CHANNEL_NOT_FOUND', colorName, `Canal RGB "${channelName}" não encontrado`);
        }
        channels[channelName] = channel;
      }

      const values = { red: 0, green: 0, blue: 0 };
      if (capInfo.type === 'rgbw') values.white = 0;
      if (capInfo.type === 'rgbw' && logical === 'white') {
        values.white = 255;
      } else {
        values.red = color.r;
        values.green = color.g;
        values.blue = color.b;
      }

      // Escreve o estado completo de cor em uma passagem: canais não usados
      // recebem zero, evitando resíduo de uma cor anterior.
      for (const channelName of channelNames) {
        deps.writeChannel(channels[channelName], values[channelName]);
      }

      return { ok: true, fixtureId, capability, channels, values };
    }

    return failure(fixtureId, capability, 'CAPABILITY_NOT_SUPPORTED', colorName, `Tipo de capability "${capInfo.type}" não suportado`);
  } catch (error) {
    return failure(fixtureId, capability, 'INVALID_VALUE', colorName, error?.message || 'Valor inválido');
  }
}

function setDimmer(deps, fixtureId, intensity) {
  const capability = 'dimmer';
  try {
    const resolvedFixture = resolveEnabledFixture(deps, fixtureId, capability, intensity);
    if (resolvedFixture.error) return resolvedFixture.error;
    if (!Number.isFinite(intensity)) {
      return failure(fixtureId, capability, 'INVALID_VALUE', intensity, 'A intensidade deve ser um número finito');
    }

    const channel = deps.getChannelByAlias(resolvedFixture.fixture, 'dimmer');
    if (!channel) {
      return failure(fixtureId, capability, 'CAPABILITY_NOT_SUPPORTED', intensity, 'Fixture não possui canal de dimmer');
    }

    const value = Math.max(0, Math.min(255, Math.round(Number(intensity) * 255)));
    deps.writeChannel(channel, value);
    return { ok: true, fixtureId, capability, channel, value };
  } catch (error) {
    return failure(fixtureId, capability, 'INVALID_VALUE', intensity, error?.message || 'Valor inválido');
  }
}

function setMovementSpeed(deps, fixtureId, speed) {
  const capability = 'movementSpeed';
  try {
    const resolvedFixture = resolveEnabledFixture(deps, fixtureId, capability, speed);
    if (resolvedFixture.error) return resolvedFixture.error;
    if (!Number.isFinite(speed)) {
      return failure(fixtureId, capability, 'INVALID_VALUE', speed, 'A velocidade deve ser um número finito');
    }

    const channel = deps.getChannelByAlias(resolvedFixture.fixture, 'speed');
    if (!channel) {
      return failure(fixtureId, capability, 'CAPABILITY_NOT_SUPPORTED', speed, 'Fixture não possui canal de velocidade');
    }

    // Convenção do interpolador: 0 = rápido e 1 = lento; não inverter o valor.
    const value = clampDmx(speed * 255);
    deps.writeChannel(channel, value);
    return { ok: true, fixtureId, capability, channel, value };
  } catch (error) {
    return failure(fixtureId, capability, 'INVALID_VALUE', speed, error?.message || 'Valor inválido');
  }
}

function setPanTilt(deps, fixtureId, panTilt) {
  const capability = 'panTilt';
  try {
    const resolvedFixture = resolveEnabledFixture(deps, fixtureId, capability, panTilt);
    if (resolvedFixture.error) return resolvedFixture.error;

    const isObject = panTilt !== null && typeof panTilt === 'object' && !Array.isArray(panTilt);
    if (!isObject || !Number.isFinite(panTilt.pan) || !Number.isFinite(panTilt.tilt)) {
      return failure(fixtureId, capability, 'INVALID_VALUE', panTilt, 'Pan e tilt devem ser números finitos');
    }

    const panChannel = deps.getChannelByAlias(resolvedFixture.fixture, 'pan');
    const tiltChannel = deps.getChannelByAlias(resolvedFixture.fixture, 'tilt');
    if (!panChannel || !tiltChannel) {
      return failure(fixtureId, capability, 'CAPABILITY_NOT_SUPPORTED', panTilt, 'Fixture não possui canais de pan e tilt');
    }

    const pan = clampDmx(panTilt.pan);
    const tilt = clampDmx(panTilt.tilt);
    deps.writeChannel(panChannel, pan);
    deps.writeChannel(tiltChannel, tilt);
    return {
      ok: true,
      fixtureId,
      capability,
      channels: { pan: panChannel, tilt: tiltChannel },
      values: { pan, tilt },
    };
  } catch (error) {
    return failure(fixtureId, capability, 'INVALID_VALUE', panTilt, error?.message || 'Valor inválido');
  }
}

function setStrobe(deps, fixtureId, intent) {
  const capability = 'strobe';
  try {
    const resolvedFixture = resolveEnabledFixture(deps, fixtureId, capability, intent);
    if (resolvedFixture.error) return resolvedFixture.error;
    const resolvedCapability = resolveProfileCapability(resolvedFixture.fixture, fixtureId, capability, intent);
    if (resolvedCapability.error) return resolvedCapability.error;
    return mappedValueResult(deps, resolvedFixture.fixture, resolvedCapability.profile, fixtureId, capability, intent);
  } catch (error) {
    return failure(fixtureId, capability, 'INVALID_VALUE', intent, error?.message || 'Valor inválido');
  }
}

function setPrism(deps, fixtureId, intent) {
  const capability = 'prism';
  try {
    const resolvedFixture = resolveEnabledFixture(deps, fixtureId, capability, intent);
    if (resolvedFixture.error) return resolvedFixture.error;
    const resolvedCapability = resolveProfileCapability(resolvedFixture.fixture, fixtureId, capability, intent);
    if (resolvedCapability.error) return resolvedCapability.error;
    return mappedValueResult(deps, resolvedFixture.fixture, resolvedCapability.profile, fixtureId, capability, intent);
  } catch (error) {
    return failure(fixtureId, capability, 'INVALID_VALUE', intent, error?.message || 'Valor inválido');
  }
}

function setGobo(deps, fixtureId, value) {
  const capability = 'gobo';
  try {
    const resolvedFixture = resolveEnabledFixture(deps, fixtureId, capability, value);
    if (resolvedFixture.error) return resolvedFixture.error;
    const resolvedCapability = resolveProfileCapability(resolvedFixture.fixture, fixtureId, capability, value);
    if (resolvedCapability.error) return resolvedCapability.error;
    return mappedValueResult(deps, resolvedFixture.fixture, resolvedCapability.profile, fixtureId, capability, value);
  } catch (error) {
    return failure(fixtureId, capability, 'INVALID_VALUE', value, error?.message || 'Valor inválido');
  }
}

function getCapabilities(deps, fixtureId) {
  const capability = 'capabilities';
  try {
    const resolvedFixture = resolveEnabledFixture(deps, fixtureId, capability, undefined);
    if (resolvedFixture.error) return resolvedFixture.error;

    const profile = fixtureProfiles.resolveProfileForFixture(resolvedFixture.fixture);
    if (!profile) {
      return { ok: true, fixtureId, profileId: null, capabilities: {} };
    }
    return { ok: true, fixtureId, profileId: profile.id, capabilities: profile.capabilities };
  } catch (error) {
    return failure(fixtureId, capability, 'INVALID_VALUE', undefined, error?.message || 'Valor inválido');
  }
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

module.exports = {
  resolve,
  normalizeKey,
  clampDmx,
  setColor,
  setDimmer,
  setMovementSpeed,
  setPanTilt,
  setStrobe,
  setPrism,
  setGobo,
  getCapabilities,
};
