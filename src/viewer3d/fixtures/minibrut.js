/**
 * minibrut.js — Comportamento visual do Mini Brut (Painel 3D, Fase 4)
 *
 * Representa 4 lâmpadas halógenas amarelo-quentes (Mini_Brut_01..04) com
 * canal único de dimmer controlando uma PointLight amarela centralizada.
 * Fixo — sem movimento, sem RGB.
 *
 * update(group, channels) é chamado a cada frame do loop de animação de
 * scene.js — não acopla nenhum outro tipo de fixture.
 */

import * as THREE from 'three';

const LAMP_COLOR = 0xffd080;
const LAMP_OFFSETS = [
  [-0.07, 0.07, 0],
  [0.07, 0.07, 0],
  [-0.07, -0.07, 0],
  [0.07, -0.07, 0],
];
const LIGHT_MAX_INTENSITY = 7;
const EMISSIVE_MAX_INTENSITY = 6;

function ensureLamps(group) {
  if (group.userData.minibrutLamps) {
    return { lamps: group.userData.minibrutLamps, light: group.userData.minibrutLight };
  }

  const lamps = LAMP_OFFSETS.map(([x, y, z]) => {
    const geo = new THREE.SphereGeometry(0.05, 12, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: LAMP_COLOR,
      emissive: LAMP_COLOR,
      emissiveIntensity: 0,
      roughness: 0.4,
    });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.set(x, y, z);
    group.add(sphere);
    return sphere;
  });

  const light = new THREE.PointLight(LAMP_COLOR, 0, 3, 2);
  group.add(light);

  group.userData.minibrutLamps = lamps;
  group.userData.minibrutLight = light;
  return { lamps, light };
}

export function update(group, channels) {
  const ch = group.userData.channels;
  if (!ch) return;

  const dimmer = channels[ch.dimmer - 1] ?? 0;
  const t = Math.max(0, Math.min(255, dimmer)) / 255;

  const { lamps, light } = ensureLamps(group);
  lamps.forEach((sphere) => {
    sphere.material.emissiveIntensity = t * EMISSIVE_MAX_INTENSITY;
  });
  light.intensity = t * LIGHT_MAX_INTENSITY;
}
