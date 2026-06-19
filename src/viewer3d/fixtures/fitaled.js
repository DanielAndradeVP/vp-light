import * as THREE from 'three';

const STRIP_COLOR = 0xfff27a;
const DIMMER_VISIBLE_THRESHOLD = 5;
const EMISSIVE_MAX_INTENSITY = 2.2;
const OPACITY_MIN = 0.18;
const OPACITY_MAX = 1;

function clamp255(value) {
  return Math.max(0, Math.min(255, value ?? 0));
}

export function update(group, channels) {
  const ch = group.userData.channels;
  if (!ch) return;

  const dimmer = clamp255(channels[ch.dimmer - 1]);
  const t = dimmer / 255;

  const strip = group.getObjectByName('altar_front_led_strip_body');
  const glow = group.getObjectByName('altar_front_led_strip_glow');

  const visible = dimmer > DIMMER_VISIBLE_THRESHOLD;

  if (strip) {
    strip.visible = visible;
    strip.material.color.setHex(STRIP_COLOR);
    strip.material.emissive.setHex(STRIP_COLOR);
    strip.material.emissiveIntensity = t * EMISSIVE_MAX_INTENSITY;
    strip.material.opacity = OPACITY_MIN + (OPACITY_MAX - OPACITY_MIN) * t;
  }

  if (glow) {
    glow.visible = visible;
    glow.material.opacity = 0.18 * t;
  }
}