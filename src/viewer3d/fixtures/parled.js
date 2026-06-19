/**
 * parled.js — Comportamento visual do ParLed Deluxe (Painel 3D, Fase 4)
 *
 * Le dimmer/red/green/blue (numeros de canal DMX absolutos, resolvidos
 * pelos aliases do show.json e guardados em group.userData.channels por
 * scene.js) e aplica intensidade + cor numa PointLight dentro do cilindro,
 * alem de um cone de luz suave apontando para baixo, visivel apenas
 * quando o dimmer estiver acima de 10.
 *
 * update(group, channels) é chamado a cada frame do loop de animação de
 * scene.js — não acopla nenhum outro tipo de fixture.
 */

import * as THREE from 'three';

const LIGHT_MAX_INTENSITY = 3;
const BEAM_VISIBLE_THRESHOLD = 10;
const BEAM_MAX_OPACITY = 0.15;

// Mantém a fonte/origem visual do facho no mesmo lugar.
// Antes: ConeGeometry altura 1.2 com position.y = -0.7.
// O topo do cone ficava em: -0.7 + 1.2 / 2 = -0.1.
// Agora o cone é maior, mas o topo continua em -0.1.
// const BEAM_TOP_Y = -0.1;
// const BEAM_HEIGHT = 4.2;
// const BEAM_RADIUS = 0.75;
// const BEAM_SEGMENTS = 24;

const BEAM_TOP_Y = -0.2;
const BEAM_HEIGHT = 5.6;
const BEAM_RADIUS = 1;
const BEAM_SEGMENTS = 24;

const BEAM_FORWARD_TILT_DEG = -18;

function ensureLight(group) {
  if (group.userData.parLight) return group.userData.parLight;

  const light = new THREE.PointLight(0xffffff, 0, 3, 2);
  light.position.set(0, -0.05, 0);

  group.add(light);
  group.userData.parLight = light;

  return light;
}

function ensureBeam(group) {
  if (group.userData.parBeam) return group.userData.parBeam;

  const pivot = new THREE.Group();
  pivot.name = 'parBeamPivot';

  // Origem do facho continua no ParLed.
  pivot.position.set(0, BEAM_TOP_Y, 0);

  // Inclina o facho para frente sem mover a origem.
  pivot.rotation.x = THREE.MathUtils.degToRad(BEAM_FORWARD_TILT_DEG);

  const geo = new THREE.ConeGeometry(
    BEAM_RADIUS,
    BEAM_HEIGHT,
    BEAM_SEGMENTS,
    1,
    true
  );

  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const beam = new THREE.Mesh(geo, mat);

  // O cone fica abaixo do pivot.
  // O pivot é a "boca" do ParLed.
  beam.position.set(0, -BEAM_HEIGHT / 2, 0);

  beam.visible = false;

  pivot.add(beam);
  group.add(pivot);

  group.userData.parBeamPivot = pivot;
  group.userData.parBeam = beam;

  return beam;
}


export function update(group, channels) {
  const ch = group.userData.channels;
  if (!ch) return;

  const dimmer = channels[ch.dimmer - 1] ?? 0;
  const red = channels[ch.red - 1] ?? 0;
  const green = channels[ch.green - 1] ?? 0;
  const blue = channels[ch.blue - 1] ?? 0;

  const r = Math.max(0, Math.min(255, red)) / 255;
  const g = Math.max(0, Math.min(255, green)) / 255;
  const b = Math.max(0, Math.min(255, blue)) / 255;
  const dimmerT = Math.max(0, Math.min(255, dimmer)) / 255;

  const light = ensureLight(group);
  light.intensity = dimmerT * LIGHT_MAX_INTENSITY;
  light.color.setRGB(r, g, b);

  const beam = ensureBeam(group);
  beam.material.color.setRGB(r, g, b);

  if (dimmer > BEAM_VISIBLE_THRESHOLD) {
    beam.visible = true;
    beam.material.opacity = BEAM_MAX_OPACITY * dimmerT;
  } else {
    beam.visible = false;
  }
}