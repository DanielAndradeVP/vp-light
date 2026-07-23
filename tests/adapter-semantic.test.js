import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const adapter = require('../electron/adapter.js');

const movingChannels = [
  'color_wheel', 'strobo', 'fecho_lampada', 'gobo_wheel', 'prism_1',
  'prism_1_rotation', 'virtual_speed', 'frost', 'prism_1_rotation_2',
  'pan', 'pan_fine', 'tilt', 'tilt_fine', 'special_random', 'indefinido', 'reset',
];

const FIXTURES = [
  {
    id: 'mh1',
    name: 'Moving Head Beam 1',
    fixtureType: 'moving_head_beam',
    startChannel: 123,
    channels: movingChannels,
    adapters: {},
  },
  {
    id: 'mh2',
    name: 'Moving Head Beam 2',
    fixtureType: 'moving_head_beam',
    startChannel: 123,
    channels: movingChannels,
    adapters: { color: { white: 0, red: 16, green: 112 } },
  },
  {
    id: 'parA',
    fixtureType: 'par_led',
    startChannel: 1,
    channels: ['dimmer', 'strobo', 'macro', 'macro_speed', 'red', 'green', 'blue', 'white'],
  },
  {
    id: 'parB',
    fixtureType: 'par_led',
    startChannel: 9,
    channels: ['macro', 'color_wheel', 'speed', 'dimmer', 'red', 'green', 'blue', ''],
  },
  {
    id: 'rib1',
    fixtureType: 'ribalta',
    startChannel: 258,
    channels: ['tilt', 'speed', 'dimmer'],
  },
];

function makeDeps({ fixtures = FIXTURES, disabledIds = new Set() } = {}) {
  const writes = [];
  return {
    writes,
    deps: {
      getFixture: (fixtureId) => fixtures.find((fixture) => fixture.id === fixtureId) || null,
      isEnabled: (fixture) => !disabledIds.has(fixture.id),
      getChannelByAlias: (fixture, alias) => {
        const index = fixture.channels.indexOf(alias);
        if (index === -1 && alias === 'dimmer') {
          const fallback = fixture.channels.indexOf('fecho_lampada');
          return fallback === -1 ? null : fixture.startChannel + fallback;
        }
        if (index === -1 && alias === 'speed') {
          const fallback = fixture.channels.indexOf('virtual_speed');
          return fallback === -1 ? null : fixture.startChannel + fallback;
        }
        return index === -1 ? null : fixture.startChannel + index;
      },
      writeChannel: (channel, value) => writes.push([channel, value]),
    },
  };
}

describe('semantic fixture adapter', () => {
  it('setColor usa o valor calibrado do moving head 2', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setColor(deps, 'mh2', 'green')).toEqual({
      ok: true,
      fixtureId: 'mh2',
      capability: 'color',
      channel: 123,
      value: 112,
    });
    expect(writes).toEqual([[123, 112]]);
  });

  it('setColor bloqueia a cor do moving head 1 enquanto o profile está incompleto', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setColor(deps, 'mh1', 'green').code).toBe('CAPABILITY_NOT_MAPPED');
    expect(writes).toEqual([]);
  });

  it('setColor não aproxima uma cor ausente na tabela da instância', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setColor(deps, 'mh2', 'cyan').code).toBe('VALUE_NOT_SUPPORTED');
    expect(writes).toEqual([]);
  });

  it('setColor escreve RGBW completo e zera os canais não usados', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setColor(deps, 'parA', 'green')).toMatchObject({
      ok: true,
      channels: { red: 5, green: 6, blue: 7, white: 8 },
      values: { red: 0, green: 255, blue: 0, white: 0 },
    });
    expect(writes).toEqual([[5, 0], [6, 255], [7, 0], [8, 0]]);
  });

  it('setColor usa o branco dedicado no layout RGBW', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setColor(deps, 'parA', 'white')).toMatchObject({
      ok: true,
      values: { red: 0, green: 0, blue: 0, white: 255 },
    });
    expect(writes).toEqual([[5, 0], [6, 0], [7, 0], [8, 255]]);
  });

  it('setColor escreve somente RGB no layout B', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setColor(deps, 'parB', 'green')).toMatchObject({
      ok: true,
      channels: { red: 13, green: 14, blue: 15 },
      values: { red: 0, green: 255, blue: 0 },
    });
    expect(writes).toEqual([[13, 0], [14, 255], [15, 0]]);
  });

  it('setColor mistura RGB para branco quando não há canal white', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setColor(deps, 'parB', 'white')).toMatchObject({
      ok: true,
      values: { red: 255, green: 255, blue: 255 },
    });
    expect(writes).toEqual([[13, 255], [14, 255], [15, 255]]);
  });

  it('setColor retorna FIXTURE_NOT_FOUND para id inexistente', () => {
    const { deps } = makeDeps();
    expect(adapter.setColor(deps, 'nao-existe', 'green').code).toBe('FIXTURE_NOT_FOUND');
  });

  it('retorna FIXTURE_DISABLED para fixture desabilitada, sem escrever nada', () => {
    const { deps, writes } = makeDeps({ disabledIds: new Set(['mh2']) });

    expect(adapter.setColor(deps, 'mh2', 'green').code).toBe('FIXTURE_DISABLED');
    expect(adapter.setDimmer(deps, 'mh2', 1).code).toBe('FIXTURE_DISABLED');
    expect(adapter.setMovementSpeed(deps, 'mh2', 0.5).code).toBe('FIXTURE_DISABLED');
    expect(adapter.setPanTilt(deps, 'mh2', { pan: 10, tilt: 10 }).code).toBe('FIXTURE_DISABLED');
    expect(adapter.getCapabilities(deps, 'mh2').code).toBe('FIXTURE_DISABLED');
    expect(writes).toEqual([]);
  });

  it('setPrism/setGobo retornam CAPABILITY_NOT_SUPPORTED (nao NOT_MAPPED) quando o profile nem declara a capability', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setPrism(deps, 'parA', 'on').code).toBe('CAPABILITY_NOT_SUPPORTED');
    expect(adapter.setGobo(deps, 'parA', 'gobo_1').code).toBe('CAPABILITY_NOT_SUPPORTED');
    expect(writes).toEqual([]);
  });

  it('setDimmer usa o fallback fecho_lampada do moving head', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setDimmer(deps, 'mh1', 1)).toMatchObject({
      ok: true,
      channel: 125,
      value: 255,
    });
    expect(writes).toEqual([[125, 255]]);
  });

  it('setDimmer arredonda 0.5 para 128', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setDimmer(deps, 'mh1', 0.5).value).toBe(128);
    expect(writes).toEqual([[125, 128]]);
  });

  it('setDimmer rejeita valor não numérico', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setDimmer(deps, 'rib1', 'abc').code).toBe('INVALID_VALUE');
    expect(writes).toEqual([]);
  });

  it('setMovementSpeed mantém 0 como rápido', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setMovementSpeed(deps, 'mh1', 0)).toMatchObject({
      ok: true,
      channel: 129,
      value: 0,
    });
    expect(writes).toEqual([[129, 0]]);
  });

  it('setMovementSpeed mantém 1 como lento', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setMovementSpeed(deps, 'mh1', 1)).toMatchObject({
      ok: true,
      channel: 129,
      value: 255,
    });
    expect(writes).toEqual([[129, 255]]);
  });

  it('setPanTilt escreve os valores DMX crus dos dois eixos', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setPanTilt(deps, 'mh1', { pan: 84, tilt: 36 })).toEqual({
      ok: true,
      fixtureId: 'mh1',
      capability: 'panTilt',
      channels: { pan: 132, tilt: 134 },
      values: { pan: 84, tilt: 36 },
    });
    expect(writes).toEqual([[132, 84], [134, 36]]);
  });

  it('setPanTilt rejeita eixo não numérico sem escrever parcialmente', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setPanTilt(deps, 'mh1', { pan: 'x', tilt: 36 }).code).toBe('INVALID_VALUE');
    expect(writes).toEqual([]);
  });

  it('setStrobe, setPrism e setGobo respeitam mapping-incomplete', () => {
    const { deps, writes } = makeDeps();

    expect(adapter.setStrobe(deps, 'mh2', 'fast').code).toBe('CAPABILITY_NOT_MAPPED');
    expect(adapter.setPrism(deps, 'mh2', 'open').code).toBe('CAPABILITY_NOT_MAPPED');
    expect(adapter.setGobo(deps, 'mh2', 'gobo1').code).toBe('CAPABILITY_NOT_MAPPED');
    expect(writes).toEqual([]);
  });

  it('getCapabilities expõe o profile do moving head 2', () => {
    const { deps } = makeDeps();
    const result = adapter.getCapabilities(deps, 'mh2');

    expect(result.ok).toBe(true);
    expect(result.profileId).toBe('moving-head-beam-2');
    expect(result.capabilities.color.status).toBe('ready');
  });

  it('getCapabilities retorna introspecção vazia para fixture sem profile', () => {
    const { deps } = makeDeps();

    expect(adapter.getCapabilities(deps, 'rib1')).toEqual({
      ok: true,
      fixtureId: 'rib1',
      profileId: null,
      capabilities: {},
    });
  });

  it('rate-limita o diagnóstico pela mesma fixture, capability e código', () => {
    const { deps } = makeDeps();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const now = Date.now();
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now + 4001);

    try {
      adapter.setColor(deps, 'mh1', 'green');
      adapter.setColor(deps, 'mh1', 'green');
      adapter.setColor(deps, 'mh1', 'green');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      dateNow.mockRestore();
      warn.mockRestore();
    }
  });
});
