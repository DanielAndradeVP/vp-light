const movingHeadBeam1 = require('./movingHeadBeam1.js');
const movingHeadBeam2 = require('./movingHeadBeam2.js');
const parLedDeluxeLayoutA = require('./parLedDeluxeLayoutA.js');
const parLedDeluxeLayoutB = require('./parLedDeluxeLayoutB.js');

const PROFILES = [
  movingHeadBeam1,
  movingHeadBeam2,
  parLedDeluxeLayoutA,
  parLedDeluxeLayoutB,
];

const CAPABILITY_TYPES = new Set(['enumerated', 'continuous', 'range', 'rgb', 'rgbw']);
const CAPABILITY_STATUSES = new Set(['ready', 'mapping-incomplete']);

function normalizeAlias(value) {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase();
}

function listProfiles() {
  return PROFILES;
}

function getProfile(profileId) {
  return PROFILES.find((profile) => profile.id === profileId) || null;
}

function resolveProfileForFixture(fixture) {
  if (!fixture || typeof fixture !== 'object') return null;

  if (Object.prototype.hasOwnProperty.call(fixture, 'profileId')) {
    return getProfile(fixture.profileId);
  }

  const fixtureType = normalizeAlias(fixture.fixtureType || fixture.type);
  const fixtureAliases = Array.isArray(fixture.channels)
    ? fixture.channels.map(normalizeAlias)
    : [];

  return PROFILES.find((profile) => {
    if (normalizeAlias(profile.fixtureType) !== fixtureType) return false;

    const match = profile.match || {};
    if (match.name !== undefined && normalizeAlias(fixture.name) !== match.name) return false;
    if (match.hasAlias !== undefined && !fixtureAliases.includes(normalizeAlias(match.hasAlias))) {
      return false;
    }
    if (match.missingAlias !== undefined && fixtureAliases.includes(normalizeAlias(match.missingAlias))) {
      return false;
    }

    return true;
  }) || null;
}

function getCapabilityInfo(profile, capabilityName) {
  return profile?.capabilities?.[capabilityName] || null;
}

function getChannelSpec(profile, capabilityName) {
  return profile?.channels?.[capabilityName] || null;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasValidAlias(channelSpec) {
  return isObject(channelSpec) && typeof channelSpec.alias === 'string' && channelSpec.alias.trim() !== '';
}

function validateProfile(profile) {
  const errors = [];

  if (typeof profile?.id !== 'string' || profile.id.trim() === '') {
    errors.push('profile.id deve ser uma string não vazia');
  }
  if (typeof profile?.fixtureType !== 'string' || profile.fixtureType.trim() === '') {
    errors.push('profile.fixtureType deve ser uma string não vazia');
  }
  if (!isObject(profile?.channels)) {
    errors.push('profile.channels deve ser um objeto');
  }
  if (!isObject(profile?.capabilities)) {
    errors.push('profile.capabilities deve ser um objeto');
  }

  if (isObject(profile?.capabilities)) {
    for (const [capabilityName, capabilityInfo] of Object.entries(profile.capabilities)) {
      const capInfo = isObject(capabilityInfo) ? capabilityInfo : {};

      if (!CAPABILITY_TYPES.has(capInfo.type)) {
        errors.push(`capability "${capabilityName}": tipo "${capInfo.type}" inválido`);
      }
      if (!CAPABILITY_STATUSES.has(capInfo.status)) {
        errors.push(`capability "${capabilityName}": status "${capInfo.status}" inválido`);
      }

      if (!isObject(profile.channels)) continue;

      const isPending = capInfo.status === 'mapping-incomplete';

      if (capInfo.type === 'rgb' || capInfo.type === 'rgbw') {
        for (const channelName of ['red', 'green', 'blue']) {
          const channelIsPending = profile.channels[channelName] === undefined && isPending;
          if (!channelIsPending && !hasValidAlias(profile.channels[channelName])) {
            errors.push(`capability "${capabilityName}": channel "${channelName}" deve ter alias não vazio`);
          }
        }
        if (capInfo.type === 'rgbw') {
          const whiteIsPending = profile.channels.white === undefined && isPending;
          if (!whiteIsPending && !hasValidAlias(profile.channels.white)) {
            errors.push(`capability "${capabilityName}": channel "white" deve ter alias não vazio`);
          }
        }
      } else {
        const channelSpec = profile.channels[capabilityName];
        const channelIsPending = channelSpec === undefined && isPending;
        if (!channelIsPending && !hasValidAlias(channelSpec)) {
          errors.push(`capability "${capabilityName}": channel correspondente deve ter alias não vazio`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateAllProfiles() {
  const results = listProfiles().map((profile) => {
    const validation = validateProfile(profile);
    return {
      profileId: profile.id,
      valid: validation.valid,
      errors: validation.errors,
    };
  });

  return {
    valid: results.every((result) => result.valid),
    results,
  };
}

module.exports = {
  listProfiles,
  getProfile,
  resolveProfileForFixture,
  getCapabilityInfo,
  getChannelSpec,
  validateProfile,
  validateAllProfiles,
};
