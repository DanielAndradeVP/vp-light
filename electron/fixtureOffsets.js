/**
 * Fonte unica de calibracao fisica de offsets.
 * show.js persiste estes valores; main.js usa os mesmos valores no runtime DMX.
 */

// Tabela de calibracao por NOME desativada para teste manual (zero influencia).
// Fonte unica de offset = show.json (campos panOffset/tiltOffset por fixture).
// Os Beams mantem virtualPanTiltSpeed pelo proprio show.json, nao por regra aqui.
const FIXTURE_OFFSET_RULES = {};

// === TESTE MANUAL DE CALIBRACAO ===
// Enquanto true, NENHUM offset e aplicado ao palco (fisico = logico), nao importa
// o que esteja no show.json. Serve para o Dan medir o desalinhamento fisico real
// das ribaltas e dos movs sem nada influenciando. Voltar para false depois de
// calibrar para reativar a leitura de offset do show.json.
const TESTE_ZERO_OFFSET = true;

function normalizeAlias(label) {
  return String(label ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}

function getFixtureOffsetRule(fixture) {
  return FIXTURE_OFFSET_RULES[normalizeAlias(fixture?.name)] || null;
}

function normalizeFixtureOffsets(fixture) {
  const next = { ...fixture };
  const rule = getFixtureOffsetRule(next);
  if (!rule) return next;

  applyOffsetField(next, rule, 'panOffset');
  applyOffsetField(next, rule, 'tiltOffset');

  if (rule.virtualPanTiltSpeed != null && next.virtualPanTiltSpeed == null) {
    next.virtualPanTiltSpeed = rule.virtualPanTiltSpeed;
  }

  return next;
}

function normalizeShowFixtureOffsets(showData) {
  if (!showData || !Array.isArray(showData.fixtures)) return showData;
  return {
    ...showData,
    fixtures: showData.fixtures.map(normalizeFixtureOffsets),
  };
}

function applyOffsetField(fixture, rule, field) {
  if (!Object.prototype.hasOwnProperty.call(rule, field)) return;
  if (rule[field] == null) {
    delete fixture[field];
    return;
  }
  fixture[field] = rule[field];
}

function getFixturePanOffset(fixture) {
  return getFixtureOffsetValue(fixture, 'panOffset');
}

function getFixtureTiltOffset(fixture) {
  return getFixtureOffsetValue(fixture, 'tiltOffset');
}

function getFixtureOffsetValue(fixture, field) {
  const rule = getFixtureOffsetRule(fixture);
  if (rule && Object.prototype.hasOwnProperty.call(rule, field)) {
    return Number.isFinite(Number(rule[field])) ? Number(rule[field]) : 0;
  }

  if (fixture?.[field] == null || fixture?.[field] === '') return 0;
  const value = Number(fixture[field]);
  return Number.isFinite(value) ? value : 0;
}

function buildChannelOffsetMap(fixtures, isFixtureEnabled = () => true) {
  if (TESTE_ZERO_OFFSET) return {}; // teste manual: zero offset no palco
  const map = {};

  for (const fixture of fixtures || []) {
    if (!isFixtureEnabled(fixture)) continue;

    const panOffset = getFixturePanOffset(fixture);
    const tiltOffset = getFixtureTiltOffset(fixture);
    if (!panOffset && !tiltOffset) continue;

    const start = Number(fixture.startChannel) || 1;
    const channels = Array.isArray(fixture.channels) ? fixture.channels : [];

    channels.forEach((alias, index) => {
      const channel = start + index;
      const normalizedAlias = normalizeAlias(alias);
      if (panOffset && normalizedAlias === 'pan') {
        map[channel] = (map[channel] || 0) + panOffset;
      }
      if (tiltOffset && normalizedAlias === 'tilt') {
        map[channel] = (map[channel] || 0) + tiltOffset;
      }
    });
  }

  return map;
}

module.exports = {
  buildChannelOffsetMap,
  getFixturePanOffset,
  getFixtureTiltOffset,
  normalizeAlias,
  normalizeFixtureOffsets,
  normalizeShowFixtureOffsets,
};
