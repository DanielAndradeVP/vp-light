const HISTORY_SIZE = 150; // ~6s de amostras a 25fps

const THRESHOLDS = {
  healthy: 30,   // < 30ms: saudável
  warn: 40,      // 30-40ms: atenção; >=40ms conta como "estouro"
  overrun: 45,   // 40-45ms: frame estourado
  degraded: 100, // 45-100ms: degradação perceptível
};

function classifyDuration(ms) {
  if (ms < THRESHOLDS.healthy) return 'healthy';
  if (ms < THRESHOLDS.warn) return 'warn';
  if (ms < THRESHOLDS.overrun) return 'overrun';
  if (ms < THRESHOLDS.degraded) return 'degraded';
  return 'critical';
}

function createStatTracker(historySize = HISTORY_SIZE, warnRateLimitMs = 3000) {
  const history = [];
  let max = 0;
  let overruns = 0;
  let lastWarnAt = -Infinity;

  function record(durationMs) {
    history.push(durationMs);
    if (history.length > historySize) history.shift();
    if (durationMs > max) max = durationMs;
    if (durationMs >= THRESHOLDS.warn) overruns += 1;
    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    return { avg, max, overruns, last: durationMs, classification: classifyDuration(durationMs) };
  }

  function shouldWarn(now) {
    if (now - lastWarnAt >= warnRateLimitMs) {
      lastWarnAt = now;
      return true;
    }
    return false;
  }

  function snapshot() {
    const avg = history.length ? history.reduce((a, b) => a + b, 0) / history.length : 0;
    return { avg, max, overruns, last: history[history.length - 1] || 0, samples: history.length };
  }

  return { record, shouldWarn, snapshot };
}

module.exports = { classifyDuration, createStatTracker, THRESHOLDS };
