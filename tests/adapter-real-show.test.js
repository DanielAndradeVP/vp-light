import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const adapter = require('../electron/adapter.js');
const show = require('../shows/vp.show.json');

// Reproducao fiel (nao um import) da resolucao de fixture/canal real de
// electron/main.js — main.js nao pode ser importado em teste (require('electron')
// no topo do modulo falha fora do processo Electron real, limitacao estrutural
// ja conhecida do projeto). Mantenha esta logica em sincronia com main.js
// (normalizeAlias, getFixtureAliasCandidates, getFixtureChannelByAlias,
// getShowFixture, isFixtureEnabled) sempre que aquele arquivo mudar essas
// funcoes — o objetivo deste teste e validar o adapter contra os DADOS reais
// do show (shows/vp.show.json), nao reimplementar main.js.
function normalizeAlias(label) {
  return String(label ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase();
}

function getFixtureType(fixture) {
  return normalizeAlias(fixture?.fixtureType || fixture?.type);
}

function getFixtureAliasCandidates(fixture, target) {
  if (getFixtureType(fixture) !== 'moving_head_beam') return [target];
  const fallbacks = {
    dimmer: ['dimmer', 'fecho_lampada'],
    speed: ['speed', 'virtual_speed'],
    prism: ['prism', 'prism_1'],
    gobo: ['gobo', 'gobo_wheel'],
    strobo_dimmer: ['strobo_dimmer', 'strobo'],
  };
  return fallbacks[target] || [target];
}

function isFixtureEnabled(fixture) {
  return fixture?.enabled !== false;
}

function getShowFixture(fixtureIdOrName) {
  const target = String(fixtureIdOrName ?? '');
  const normalizedTarget = normalizeAlias(target);
  return show.fixtures.find(fixture =>
    fixture.id === target || normalizeAlias(fixture.name) === normalizedTarget
  ) || null;
}

function getFixtureChannelByAlias(fixture, alias) {
  if (!fixture || !Array.isArray(fixture.channels)) return null;
  const target = normalizeAlias(alias);
  const aliases = getFixtureAliasCandidates(fixture, target);
  const index = fixture.channels.findIndex(ch => aliases.includes(normalizeAlias(ch)));
  return index === -1 ? null : (Number(fixture.startChannel) || 1) + index;
}

function makeRealDeps() {
  const writes = [];
  return {
    writes,
    deps: {
      getFixture: getShowFixture,
      getChannelByAlias: getFixtureChannelByAlias,
      isEnabled: isFixtureEnabled,
      writeChannel: (channel, value) => writes.push([channel, value]),
    },
  };
}

describe('adapter semântico contra shows/vp.show.json real', () => {
  it('setColor("Moving Head Beam 2", "green") usa o valor NOVO reconciliado (40), não o antigo (112)', () => {
    const { deps, writes } = makeRealDeps();
    const result = adapter.setColor(deps, 'Moving Head Beam 2', 'green');
    expect(result).toMatchObject({ ok: true, channel: 203, value: 40 });
    expect(writes).toEqual([[203, 40]]);
  });

  it('setColor cobre os 15 pontos medidos do Moving 2 sem aproximação', () => {
    const { deps } = makeRealDeps();
    const expected = {
      white: 0, red: 10, yellow: 20, purple_medium: 30, green: 40,
      blue_dark: 50, white_ice: 60, amber_1: 70, white_warm: 80, orange: 90,
      purple_dark: 100, blue_light: 110, amber_2: 120, yellow_2: 130, purple_light: 140,
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(adapter.setColor(deps, 'Moving Head Beam 2', name).value).toBe(value);
    }
    expect(adapter.setColor(deps, 'Moving Head Beam 2', 'cyan').code).toBe('VALUE_NOT_SUPPORTED');
  });

  it('setColor("Moving Head Beam 1", "green") continua recusado (profile mapping-incomplete)', () => {
    const { deps, writes } = makeRealDeps();
    expect(adapter.setColor(deps, 'Moving Head Beam 1', 'green').code).toBe('CAPABILITY_NOT_MAPPED');
    expect(writes).toEqual([]);
  });

  it('setColor no Layout A real (ParLed_Deluxe_1) zera e escreve RGBW nos canais reais', () => {
    const { deps, writes } = makeRealDeps();
    const result = adapter.setColor(deps, 'ParLed_Deluxe_1', 'green');
    expect(result).toMatchObject({
      ok: true,
      channels: { red: 5, green: 6, blue: 7, white: 8 },
      values: { red: 0, green: 255, blue: 0, white: 0 },
    });
    expect(writes).toEqual([[5, 0], [6, 255], [7, 0], [8, 0]]);
  });

  it('setColor no Layout B real (ParLed_Deluxe_2) escreve só RGB nos canais reais', () => {
    const { deps, writes } = makeRealDeps();
    const result = adapter.setColor(deps, 'ParLed_Deluxe_2', 'green');
    expect(result).toMatchObject({
      ok: true,
      channels: { red: 13, green: 14, blue: 15 },
      values: { red: 0, green: 255, blue: 0 },
    });
    expect(writes).toEqual([[13, 0], [14, 255], [15, 0]]);
  });

  it('setColor recusa fixture desabilitada de verdade (ParLed_Deluxe_4, enabled:false)', () => {
    const { deps, writes } = makeRealDeps();
    expect(adapter.setColor(deps, 'ParLed_Deluxe_4', 'green').code).toBe('FIXTURE_DISABLED');
    expect(writes).toEqual([]);
  });

  it('setDimmer("Moving Head Beam 1", 1) usa o fallback real fecho_lampada (canal 125)', () => {
    const { deps, writes } = makeRealDeps();
    expect(adapter.setDimmer(deps, 'Moving Head Beam 1', 1)).toMatchObject({ ok: true, channel: 125, value: 255 });
    expect(writes).toEqual([[125, 255]]);
  });

  it('setMovementSpeed("Moving Head Beam 1", 0) usa o fallback real virtual_speed (canal 129)', () => {
    const { deps, writes } = makeRealDeps();
    expect(adapter.setMovementSpeed(deps, 'Moving Head Beam 1', 0)).toMatchObject({ ok: true, channel: 129, value: 0 });
    expect(writes).toEqual([[129, 0]]);
  });

  it('setPanTilt("Moving Head Beam 2", {pan:84,tilt:32}) escreve nos canais reais 212/214 ("frente" medida no rig)', () => {
    const { deps, writes } = makeRealDeps();
    const result = adapter.setPanTilt(deps, 'Moving Head Beam 2', { pan: 84, tilt: 32 });
    expect(result).toMatchObject({ channels: { pan: 212, tilt: 214 }, values: { pan: 84, tilt: 32 } });
    expect(writes).toEqual([[212, 84], [214, 32]]);
  });

  it('getCapabilities reflete o profile real de cada fixture', () => {
    const { deps } = makeRealDeps();
    expect(adapter.getCapabilities(deps, 'Moving Head Beam 2').capabilities.color.status).toBe('ready');
    expect(adapter.getCapabilities(deps, 'Moving Head Beam 1').capabilities.color.status).toBe('mapping-incomplete');
    expect(adapter.getCapabilities(deps, 'Ribalta_1')).toMatchObject({ ok: true, profileId: null, capabilities: {} });
  });

  it('fixture inexistente retorna FIXTURE_NOT_FOUND', () => {
    const { deps } = makeRealDeps();
    expect(adapter.setColor(deps, 'Fixture Que Nao Existe', 'green').code).toBe('FIXTURE_NOT_FOUND');
  });
});
