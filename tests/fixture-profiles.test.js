import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const fixtureProfiles = require('../electron/fixtureProfiles/index.js');

describe('fixture profiles', () => {
  it('valida todos os profiles reais', () => {
    expect(fixtureProfiles.validateAllProfiles()).toEqual({
      valid: true,
      results: expect.arrayContaining([
        expect.objectContaining({ profileId: 'moving-head-beam-1', valid: true, errors: [] }),
        expect.objectContaining({ profileId: 'moving-head-beam-2', valid: true, errors: [] }),
        expect.objectContaining({ profileId: 'par-led-deluxe-layout-a', valid: true, errors: [] }),
        expect.objectContaining({ profileId: 'par-led-deluxe-layout-b', valid: true, errors: [] }),
      ]),
    });
  });

  it('busca profiles por id', () => {
    expect(fixtureProfiles.getProfile('moving-head-beam-1').id).toBe('moving-head-beam-1');
    expect(fixtureProfiles.getProfile('moving-head-beam-2').id).toBe('moving-head-beam-2');
    expect(fixtureProfiles.getProfile('nao-existe')).toBeNull();
  });

  it('resolve moving heads por tipo e nome normalizado', () => {
    expect(fixtureProfiles.resolveProfileForFixture({
      fixtureType: 'moving_head_beam',
      name: 'Moving Head Beam 1',
    }).id).toBe('moving-head-beam-1');
    expect(fixtureProfiles.resolveProfileForFixture({
      fixtureType: 'moving_head_beam',
      name: 'Moving Head Beam 2',
    }).id).toBe('moving-head-beam-2');
  });

  it('resolve layouts de ParLed por aliases presentes e ausentes', () => {
    expect(fixtureProfiles.resolveProfileForFixture({
      fixtureType: 'par_led',
      channels: ['dimmer', 'strobo', 'macro', 'macro_speed', 'red', 'green', 'blue', 'white'],
    }).id).toBe('par-led-deluxe-layout-a');
    expect(fixtureProfiles.resolveProfileForFixture({
      fixtureType: 'par_led',
      channels: ['macro', 'color_wheel', 'speed', 'dimmer', 'red', 'green', 'blue', ''],
    }).id).toBe('par-led-deluxe-layout-b');
  });

  it('retorna null para tipo desconhecido', () => {
    expect(fixtureProfiles.resolveProfileForFixture({ fixtureType: 'ribalta' })).toBeNull();
  });

  it('prioriza profileId explícito sobre a heurística', () => {
    expect(fixtureProfiles.resolveProfileForFixture({
      profileId: 'moving-head-beam-2',
      fixtureType: 'moving_head_beam',
      name: 'Moving Head Beam 1',
    }).id).toBe('moving-head-beam-2');
    expect(fixtureProfiles.resolveProfileForFixture({
      profileId: 'id-invalido',
      fixtureType: 'moving_head_beam',
      name: 'Moving Head Beam 1',
    })).toBeNull();
  });

  it('retorna erros descritivos para profile inválido', () => {
    const validation = fixtureProfiles.validateProfile({
      id: 'invalid',
      fixtureType: 'test',
      channels: {},
      capabilities: {
        color: { type: 'invalido', status: 'ready' },
        dimmer: { type: 'continuous', status: 'ready' },
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors.join(' ')).toContain('color');
  });

  it('valida os canais RGB obrigatórios', () => {
    const validation = fixtureProfiles.validateProfile({
      id: 'rgb-sem-blue',
      fixtureType: 'test',
      channels: {
        red: { alias: 'red' },
        green: { alias: 'green' },
      },
      capabilities: {
        color: { type: 'rgb', status: 'ready' },
      },
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('blue');
  });

  it('retorna null para capability inexistente', () => {
    const profile = fixtureProfiles.getProfile('par-led-deluxe-layout-a');
    expect(fixtureProfiles.getCapabilityInfo(profile, 'nao-existe')).toBeNull();
    expect(fixtureProfiles.getChannelSpec(profile, 'nao-existe')).toBeNull();
  });

  it('retorna null para fixture nula, indefinida ou sem channels', () => {
    expect(fixtureProfiles.resolveProfileForFixture(null)).toBeNull();
    expect(fixtureProfiles.resolveProfileForFixture(undefined)).toBeNull();
    expect(fixtureProfiles.resolveProfileForFixture({ fixtureType: 'moving_head_beam', name: 'Moving Head Beam 1' /* sem channels */ }).id)
      .toBe('moving-head-beam-1');
    expect(fixtureProfiles.resolveProfileForFixture({ fixtureType: 'par_led' /* sem channels, sem match possível */ })).toBeNull();
  });

  it('permite canal RGB/RGBW ausente apenas quando a capability está mapping-incomplete', () => {
    const pendingRgb = fixtureProfiles.validateProfile({
      id: 'rgb-pendente',
      fixtureType: 'test',
      channels: {},
      capabilities: {
        color: { type: 'rgbw', status: 'mapping-incomplete' },
      },
    });
    expect(pendingRgb.valid).toBe(true);

    const readyRgbSemCanal = fixtureProfiles.validateProfile({
      id: 'rgb-pronto-sem-canal',
      fixtureType: 'test',
      channels: {},
      capabilities: {
        color: { type: 'rgbw', status: 'ready' },
      },
    });
    expect(readyRgbSemCanal.valid).toBe(false);
  });
});
