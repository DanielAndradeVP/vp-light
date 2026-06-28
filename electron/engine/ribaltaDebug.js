/**
 * ribaltaDebug.js — Logs temporários de diagnóstico para Ribalta_2.
 * Desligado por padrão; ligar com VP_RIBALTA_DEBUG=1 no ambiente.
 */

const R2_ID = 'fixture_1780805067518_ribalta_2';
const R2_START = 271;
const R2_ALIASES = ['tilt', 'speed', 'dimmer', 'led_1', 'led_2', 'led_3', 'led_4', 'led_5', 'led_6', 'led_7', 'led_8', 'strobo', 'function'];

const ENABLED = process.env.VP_RIBALTA_DEBUG === '1';

let _getUniverse = () => null;
let _getFixtureChannel = () => null;
let _frame = 0;

function configure({ getUniverse, getFixtureChannel }) {
  _getUniverse = getUniverse || _getUniverse;
  _getFixtureChannel = getFixtureChannel || _getFixtureChannel;
}

function tickFrame() {
  _frame++;
}

function isEnabled() {
  return ENABLED;
}

function r2ChannelsFromMap(channelMap) {
  const out = {};
  for (const alias of R2_ALIASES) {
    const ch = _getFixtureChannel(R2_ID, alias);
    if (!ch) continue;
    const val = channelMap?.[ch] ?? channelMap?.[String(ch)];
    if (val != null) out[alias] = { ch, saved: Number(val) };
  }
  return out;
}

function r2SnapshotFromUniverse(getBuffer) {
  const buf = typeof getBuffer === 'function' ? getBuffer() : _getUniverse();
  if (!buf) return {};
  const snap = {};
  for (const alias of R2_ALIASES) {
    const ch = _getFixtureChannel(R2_ID, alias);
    if (!ch) continue;
    const idx = ch - 1;
    snap[alias] = { ch, value: buf[idx] ?? 0 };
  }
  return snap;
}

function log(event, detail = {}) {
  if (!ENABLED) return;
  const snap = r2SnapshotFromUniverse();
  console.log('[ribalta2-debug]', JSON.stringify({
    frame: _frame,
    event,
    ...detail,
    universe: snap,
  }));
}

function logRestoreState(phase, channelMap, extra = {}) {
  if (!ENABLED) return;
  log(phase, {
    origin: 'restoreState',
    sceneTilt: channelMap?.[271] ?? channelMap?.['271'] ?? null,
    r2FromMap: r2ChannelsFromMap(channelMap),
    ...extra,
  });
}

function logSetChannel(origin, channel, value, logicalValue) {
  if (!ENABLED) return;
  const ch = Number(channel);
  if (ch < R2_START || ch > R2_START + 12) return;
  const alias = R2_ALIASES[ch - R2_START] || `ch${ch}`;
  log('setChannel', {
    origin,
    alias,
    channel: ch,
    value: Math.round(Number(value)),
    logical: logicalValue != null ? Math.round(Number(logicalValue)) : undefined,
  });
}

function logCompositorWrite(channel, value) {
  if (!ENABLED) return;
  const ch = Number(channel);
  if (ch < R2_START || ch > R2_START + 12) return;
  log('compositor-write', {
    origin: 'script-layer',
    alias: R2_ALIASES[ch - R2_START],
    channel: ch,
    value: Math.round(Number(value)),
  });
}

function logReEmit(channels) {
  if (!ENABLED) return;
  const r2 = {};
  for (const [ch, val] of channels || []) {
    const n = Number(ch);
    if (n >= R2_START && n <= R2_START + 12) {
      r2[R2_ALIASES[n - R2_START]] = Number(val);
    }
  }
  if (Object.keys(r2).length === 0) return;
  log('sidebar-reEmit', { origin: 'UI/reEmit', channels: r2 });
}

module.exports = {
  configure,
  tickFrame,
  isEnabled,
  log,
  logRestoreState,
  logSetChannel,
  logCompositorWrite,
  logReEmit,
  R2_ID,
};
