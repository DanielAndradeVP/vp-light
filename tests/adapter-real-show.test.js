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

  it('setColor cobre os 13 pontos medidos fisicamente do Moving Head Beam 1 (canal 123)', () => {
    const { deps } = makeRealDeps();
    const expected = {
      white: 0, red: 10, green: 20, blue_medio: 30, yellow: 40,
      purple_light: 50, blue_light: 60, roxo_claro: 70, laranja_escuro: 80,
      blue_claro: 90, laranja_claro: 110, amber: 120, magenta: 130,
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(adapter.setColor(deps, 'Moving Head Beam 1', name)).toMatchObject({ ok: true, channel: 123, value });
    }
    expect(adapter.setColor(deps, 'Moving Head Beam 1', 'cyan').code).toBe('VALUE_NOT_SUPPORTED');
  });

  it('setStrobe cobre os 4 pontos medidos fisicamente, iguais no MH1 (canal 124) e MH2 (canal 204)', () => {
    const { deps } = makeRealDeps();
    const expected = { lento: 40, medio: 60, rapido: 80, extra_rapido: 100 };
    for (const [name, value] of Object.entries(expected)) {
      expect(adapter.setStrobe(deps, 'Moving Head Beam 1', name)).toMatchObject({ ok: true, channel: 124, value });
      expect(adapter.setStrobe(deps, 'Moving Head Beam 2', name)).toMatchObject({ ok: true, channel: 204, value });
    }
    expect(adapter.setStrobe(deps, 'Moving Head Beam 1', 'estroboscopico').code).toBe('VALUE_NOT_SUPPORTED');
  });

  it('setPrism cobre ligado (150) e desligado (0), iguais no MH1 (canal 127) e MH2 (canal 207)', () => {
    const { deps } = makeRealDeps();
    expect(adapter.setPrism(deps, 'Moving Head Beam 1', 'ligado')).toMatchObject({ ok: true, channel: 127, value: 150 });
    expect(adapter.setPrism(deps, 'Moving Head Beam 2', 'ligado')).toMatchObject({ ok: true, channel: 207, value: 150 });
    expect(adapter.setPrism(deps, 'Moving Head Beam 1', 'desligado')).toMatchObject({ ok: true, channel: 127, value: 0 });
    expect(adapter.setPrism(deps, 'Moving Head Beam 2', 'desligado')).toMatchObject({ ok: true, channel: 207, value: 0 });
    expect(adapter.setPrism(deps, 'Moving Head Beam 1', 'valor_inexistente').code).toBe('VALUE_NOT_SUPPORTED');
  });

  it('setFocus usa o valor medido fisicamente, diferente no MH1 (canal 131, valor 160) e MH2 (canal 211, valor 100)', () => {
    const { deps } = makeRealDeps();
    expect(adapter.setFocus(deps, 'Moving Head Beam 1', 'focado')).toMatchObject({ ok: true, channel: 131, value: 160 });
    expect(adapter.setFocus(deps, 'Moving Head Beam 2', 'focado')).toMatchObject({ ok: true, channel: 211, value: 100 });
  });

  it('setGobo cobre os 5 padrões medidos fisicamente, iguais no MH1 (canal 126) e MH2 (canal 206)', () => {
    const { deps } = makeRealDeps();
    const expected = {
      circulo_bolinhas_finas: 10,
      circulo_bolinhas_medias: 20,
      circulo_bolinhas_grossas: 30,
      varios_l: 35,
      circulo_estrelas: 45,
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(adapter.setGobo(deps, 'Moving Head Beam 1', name)).toMatchObject({ ok: true, channel: 126, value });
      expect(adapter.setGobo(deps, 'Moving Head Beam 2', name)).toMatchObject({ ok: true, channel: 206, value });
    }
    expect(adapter.setGobo(deps, 'Moving Head Beam 1', 'gobo_inexistente').code).toBe('VALUE_NOT_SUPPORTED');
  });

  it('setFrost cobre ligado (255) e desligado (0), iguais no MH1 (canal 130) e MH2 (canal 210)', () => {
    const { deps } = makeRealDeps();
    expect(adapter.setFrost(deps, 'Moving Head Beam 1', 'ligado')).toMatchObject({ ok: true, channel: 130, value: 255 });
    expect(adapter.setFrost(deps, 'Moving Head Beam 2', 'ligado')).toMatchObject({ ok: true, channel: 210, value: 255 });
    expect(adapter.setFrost(deps, 'Moving Head Beam 1', 'desligado')).toMatchObject({ ok: true, channel: 130, value: 0 });
    expect(adapter.setFrost(deps, 'Moving Head Beam 2', 'desligado')).toMatchObject({ ok: true, channel: 210, value: 0 });
  });

  it('setPrismRotation usa os valores medidos fisicamente, com sentido invertido entre MH1 (canal 128) e MH2 (canal 208)', () => {
    const { deps } = makeRealDeps();
    expect(adapter.setPrismRotation(deps, 'Moving Head Beam 1', 'rapido')).toMatchObject({ ok: true, channel: 128, value: 170 });
    expect(adapter.setPrismRotation(deps, 'Moving Head Beam 1', 'medio')).toMatchObject({ ok: true, channel: 128, value: 150 });
    expect(adapter.setPrismRotation(deps, 'Moving Head Beam 1', 'lento')).toMatchObject({ ok: true, channel: 128, value: 135 });
    expect(adapter.setPrismRotation(deps, 'Moving Head Beam 2', 'rapido')).toMatchObject({ ok: true, channel: 208, value: 150 });
    expect(adapter.setPrismRotation(deps, 'Moving Head Beam 2', 'medio')).toMatchObject({ ok: true, channel: 208, value: 165 });
    expect(adapter.setPrismRotation(deps, 'Moving Head Beam 2', 'lento')).toMatchObject({ ok: true, channel: 208, value: 180 });
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
    expect(adapter.getCapabilities(deps, 'Moving Head Beam 1').capabilities.color.status).toBe('ready');
    expect(adapter.getCapabilities(deps, 'Ribalta_1')).toMatchObject({ ok: true, profileId: null, capabilities: {} });
  });

  it('fixture inexistente retorna FIXTURE_NOT_FOUND', () => {
    const { deps } = makeRealDeps();
    expect(adapter.setColor(deps, 'Fixture Que Nao Existe', 'green').code).toBe('FIXTURE_NOT_FOUND');
  });

  it('setDimmer/setMovementSpeed funcionam em Ribalta sem profile registrado (ADR-3)', () => {
    const { deps, writes } = makeRealDeps();
    // Ribalta_1: startChannel 258, channels [tilt,speed,dimmer,...] — speed é canal FISICO real (não virtual_speed).
    expect(adapter.setDimmer(deps, 'Ribalta_1', 1)).toMatchObject({ ok: true, channel: 260, value: 255 });
    expect(adapter.setMovementSpeed(deps, 'Ribalta_1', 0.5)).toMatchObject({ ok: true, channel: 259, value: 128 });
    expect(writes).toEqual([[260, 255], [259, 128]]);
  });

  it('setDimmer funciona em Mini Brut e Fita LED (fixtures de 1 canal, sem profile)', () => {
    const { deps, writes } = makeRealDeps();
    expect(adapter.setDimmer(deps, 'Mini_Brut_01', 1)).toMatchObject({ ok: true, channel: 400, value: 255 });
    expect(adapter.setDimmer(deps, 'Fita_Led', 0.5)).toMatchObject({ ok: true, channel: 404, value: 128 });
    expect(writes).toEqual([[400, 255], [404, 128]]);
  });

  it('setDimmer/setMovementSpeed no Moving_Wosh falham honestamente (sem alias dimmer/speed, tipo diferente de moving_head_beam)', () => {
    const { deps, writes } = makeRealDeps();
    // Moving_Wosh e fixtureType 'moving_head' (nao 'moving_head_beam'), sem alias
    // "dimmer" nem "speed" literal (so "pan_tilt_speed") — os fallbacks de
    // moving_head_beam nao se aplicam. Comportamento correto: falhar de forma
    // explicita, nao inventar um canal. Moving Wosh fica fora do nucleo do P0
    // por decisao do projeto (nao bloqueia esta implementacao).
    expect(adapter.setDimmer(deps, 'Moving_Wosh', 1).code).toBe('CAPABILITY_NOT_SUPPORTED');
    expect(adapter.setMovementSpeed(deps, 'Moving_Wosh', 0.5).code).toBe('CAPABILITY_NOT_SUPPORTED');
    expect(writes).toEqual([]);
  });
});
