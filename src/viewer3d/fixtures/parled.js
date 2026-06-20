/**
 * parled.js — Comportamento visual do ParLed Deluxe (Painel 3D)
 *
 * Lê dimmer/red/green/blue e — quando disponíveis — macro/color_wheel/speed
 * (canais absolutos resolvidos em group.userData.channels por scene.js) e
 * aplica a cor resultante numa PointLight + cone de feixe suave.
 *
 * Lógica de canal macro (par-led.md §A/§B/§C):
 *   0–10          → desligado / RGB direto
 *   11–50 + speed → branco ou cor do color_wheel (§B)
 *   51–100        → sequência §A.1 com fade (speed controla velocidade)
 *   101–200       → sequência §A.2 com fade
 *   201–255       → strobo: cor do color_wheel ou ciclo de cores
 *
 * update(group, channels) é chamado a cada frame pelo renderLoop de scene.js.
 */

import * as THREE from 'three';

const LIGHT_MAX_INTENSITY = 3;
const BEAM_VISIBLE_THRESHOLD = 10;
const BEAM_MAX_OPACITY = 0.15;

const BEAM_TOP_Y = -0.2;
const BEAM_HEIGHT = 5.6;
const BEAM_RADIUS = 1;
const BEAM_SEGMENTS = 24;
const BEAM_FORWARD_TILT_DEG = -18;

// §A.1 — sequência hardcoded do firmware (fade entre cores)
const SEQUENCE_A1 = [
  [1, 0, 0],    // vermelho
  [0, 1, 0],    // verde
  [0, 0, 1],    // azul
  [1, 1, 0],    // amarelo
  [0, 1, 1],    // azul claro
  [0.5, 0, 1],  // roxo
  [1, 1, 1],    // branco
  [1, 1, 0],    // amarelo
  [0.5, 0, 1],  // roxo
  [1, 0, 0],    // vermelho
  [0, 1, 1],    // azul claro
  [0, 1, 0],    // verde
  [0, 0, 0.4],  // azul escuro
  [1, 1, 0],    // amarelo
  [0.5, 0, 1],  // roxo
  [0, 0, 0.4],  // azul escuro
  [1, 1, 1],    // branco
];

// §A.2 — sequência hardcoded do firmware (fade entre cores)
const SEQUENCE_A2 = [
  [0, 1, 1],    // azul claro
  [0.5, 0, 1],  // roxo
  [1, 0, 0],    // vermelho
  [0, 1, 1],    // azul claro
  [0, 0, 0.4],  // azul escuro
  [0.5, 0, 1],  // roxo
  [1, 1, 1],    // branco
  [1, 1, 0],    // amarelo
  [0, 1, 0],    // verde
  [1, 1, 1],    // branco
  [0.5, 0, 1],  // roxo
  [1, 0, 0],    // vermelho
];

// §B — color_wheel: valor DMX → [r, g, b] interpolado entre os pontos auditados
const COLOR_WHEEL_STOPS = [
  { at: 40,  rgb: [1, 0, 0] },
  { at: 50,  rgb: [0, 1, 0] },
  { at: 60,  rgb: [0, 0, 0.4] },
  { at: 70,  rgb: [1, 1, 0] },
  { at: 80,  rgb: [0, 1, 1] },
  { at: 90,  rgb: [0.5, 0, 1] },
  { at: 100, rgb: [1, 1, 1] },
  { at: 110, rgb: [1, 1, 0] },
  { at: 120, rgb: [0.5, 0, 1] },
  { at: 130, rgb: [1, 0.7, 0.7] },
  { at: 140, rgb: [0, 1, 1] },
  { at: 150, rgb: [0.7, 1, 0.7] },
  { at: 160, rgb: [0.7, 0.7, 1] },
];

function colorWheelRGB(value) {
  if (value < 40) return [1, 1, 1];
  for (let i = COLOR_WHEEL_STOPS.length - 1; i >= 0; i--) {
    if (value >= COLOR_WHEEL_STOPS[i].at) {
      const curr = COLOR_WHEEL_STOPS[i];
      const next = COLOR_WHEEL_STOPS[i + 1];
      if (!next) return [...curr.rgb];
      const t = (value - curr.at) / (next.at - curr.at);
      const [r1, g1, b1] = curr.rgb;
      const [r2, g2, b2] = next.rgb;
      return [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t];
    }
  }
  return [1, 1, 1];
}

// speed 1–255 → ms por cor: 4000ms (lento) a 80ms (rápido)
function sequenceColor(seq, speedDmx) {
  const msPerColor = THREE.MathUtils.lerp(4000, 80, (speedDmx - 1) / 254);
  const total = seq.length * msPerColor;
  const pos = (performance.now() % total) / total;
  const raw = pos * seq.length;
  const i = Math.floor(raw) % seq.length;
  const j = (i + 1) % seq.length;
  const blend = raw - Math.floor(raw);
  const [r1, g1, b1] = seq[i];
  const [r2, g2, b2] = seq[j];
  return [r1 + (r2 - r1) * blend, g1 + (g2 - g1) * blend, b1 + (b2 - b1) * blend];
}

// speed 1–255 → 2Hz a 20Hz
function strobeOn(speedDmx) {
  const hz = THREE.MathUtils.lerp(2, 20, (speedDmx - 1) / 254);
  const period = 1000 / hz;
  return (performance.now() % period) < period * 0.5;
}

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
  pivot.position.set(0, BEAM_TOP_Y, 0);
  pivot.rotation.x = THREE.MathUtils.degToRad(BEAM_FORWARD_TILT_DEG);

  const geo = new THREE.ConeGeometry(BEAM_RADIUS, BEAM_HEIGHT, BEAM_SEGMENTS, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const beam = new THREE.Mesh(geo, mat);
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

  const dimmer   = channels[ch.dimmer     - 1] ?? 0;
  const red      = channels[ch.red        - 1] ?? 0;
  const green    = channels[ch.green      - 1] ?? 0;
  const blue     = channels[ch.blue       - 1] ?? 0;
  const macro    = ch.macro       != null ? (channels[ch.macro       - 1] ?? 0) : 0;
  const colorWh  = ch.color_wheel != null ? (channels[ch.color_wheel - 1] ?? 0) : 0;
  const speed    = ch.speed       != null ? (channels[ch.speed       - 1] ?? 0) : 0;

  const dimmerT = Math.max(0, Math.min(255, dimmer)) / 255;

  let r, g, b;

  const macroActive = macro > 10 && speed > 0;

  if (macroActive) {
    if (macro <= 50) {
      // Branco estático ou cor do color_wheel (§B)
      [r, g, b] = colorWh >= 40 ? colorWheelRGB(colorWh) : [1, 1, 1];
    } else if (macro <= 100) {
      // Sequência §A.1 com fade
      [r, g, b] = sequenceColor(SEQUENCE_A1, speed);
    } else if (macro <= 200) {
      // Sequência §A.2 com fade
      [r, g, b] = sequenceColor(SEQUENCE_A2, speed);
    } else {
      // Strobo 201–255: cor específica ou ciclo de cores
      const on = strobeOn(speed);
      let base;
      if (colorWh >= 40) {
        base = colorWheelRGB(colorWh);
      } else {
        // Cicla por §A.1 em velocidade reduzida enquanto stroba
        base = sequenceColor(SEQUENCE_A1, Math.max(1, speed >> 2));
      }
      [r, g, b] = on ? base : [0, 0, 0];
    }
  } else {
    // Modo RGB direto
    r = Math.max(0, Math.min(255, red))   / 255;
    g = Math.max(0, Math.min(255, green)) / 255;
    b = Math.max(0, Math.min(255, blue))  / 255;
  }

  const light = ensureLight(group);
  light.intensity = dimmerT * LIGHT_MAX_INTENSITY;
  light.color.setRGB(r, g, b);

  const beam = ensureBeam(group);
  beam.material.color.setRGB(r, g, b);

  const outputActive = dimmer > BEAM_VISIBLE_THRESHOLD && (r > 0 || g > 0 || b > 0);
  beam.visible = outputActive;
  if (outputActive) {
    beam.material.opacity = BEAM_MAX_OPACITY * dimmerT;
  }
}
