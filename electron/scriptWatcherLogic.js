const path = require('path');

function canonicalScriptPath(scriptsDir, absPath) {
  return path.relative(scriptsDir, absPath).split(path.sep).join('/');
}

function correlateRenameCandidate(pendingRemovals, newCanonicalPath, newHash) {
  if (!newHash) return { status: 'no-hash' };
  const matches = (pendingRemovals || []).filter(
    pending => pending && pending.hash && pending.hash === newHash && pending.canonicalPath !== newCanonicalPath
  );
  if (matches.length === 0) return { status: 'none' };
  if (matches.length === 1) return { status: 'matched', oldCanonicalPath: matches[0].canonicalPath };
  return { status: 'ambiguous', candidates: matches.map(match => match.canonicalPath) };
}

module.exports = { canonicalScriptPath, correlateRenameCandidate };
