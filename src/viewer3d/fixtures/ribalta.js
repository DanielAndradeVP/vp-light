/**
 * ribalta.js — Comportamento visual da Ribalta (Painel 3D, Fase 4)
 *
 * Representa 8 LEDs brancos em linha por ribalta.
 *
 * - dimmer controla intensidade dos LEDs e fechos
 * - tilt rotaciona a barra inteira no eixo X
 * - speed controla a velocidade do tilt
 * - gera fechos finos visíveis, estilo ribalta/beam bar
 */

import * as THREE from 'three';

const LED_COUNT = 8;
const LED_SPACING = 0.17;

const LIGHT_MAX_INTENSITY = 2.4;
const EMISSIVE_MAX_INTENSITY = 4.0;

const TILT_MIN_DEG = -135;
const TILT_MAX_DEG = 135;

/**
 * Velocidade base/calibração da ribalta no 3D.
 * Esse é o seu "speed offset" para bater com a velocidade normal da física.
 */
const TILT_BASE_SPEED_DEG_PER_SEC = 180;

/**
 * Influência do canal speed da ribalta.
 *
 * Se speed baixo deve ser lento e speed alto deve ser rápido, deixa false.
 * Se estiver invertido na física, troca para true.
 */
const TILT_SPEED_CHANNEL_INVERTED = true;

const TILT_SPEED_MIN_MULTIPLIER = 0.20;
const TILT_SPEED_MAX_MULTIPLIER = 2.00;

const LED_COLOR = 0xffffff;

const BEAM_RADIUS = 0.018;
const BEAM_SEGMENTS = 12;
const BEAM_MAX_LENGTH = 12.0;
const BEAM_MIN_LENGTH = 0.20;
const BEAM_MAX_OPACITY = 0.22;

// Piso do palco
const STAGE_FLOOR_Y = 0.52;

// Frente da parede/painel do fundo
const BACK_WALL_Z = -2.58;

// Altura máxima visual do fecho da ribalta
const LED_PANEL_TOP_Y = 5.75;

const BEAM_START_Z = 0.13;

const _beamOrigin = new THREE.Vector3();
const _beamDirection = new THREE.Vector3();
const _beamQuaternion = new THREE.Quaternion();

function getLedX(index) {
  const startX = -((LED_COUNT - 1) * LED_SPACING) / 2;
  return startX + index * LED_SPACING;
}

function dmxToDeg(value, minDeg, maxDeg) {
  const t = Math.max(0, Math.min(255, value)) / 255;
  return minDeg + t * (maxDeg - minDeg);
}

function moveTowards(current, target, maxDelta) {
  const diff = target - current;

  if (Math.abs(diff) <= maxDelta) {
    return target;
  }

  return current + Math.sign(diff) * maxDelta;
}

function getTiltSpeedDegPerSec(speedValue) {
  let t = Math.max(0, Math.min(255, speedValue)) / 255;

  if (TILT_SPEED_CHANNEL_INVERTED) {
    t = 1 - t;
  }

  const multiplier =
    TILT_SPEED_MIN_MULTIPLIER +
    t * (TILT_SPEED_MAX_MULTIPLIER - TILT_SPEED_MIN_MULTIPLIER);

  return TILT_BASE_SPEED_DEG_PER_SEC * multiplier;
}

function getBeamLengthUntilSceneLimits(group) {
  group.localToWorld(_beamOrigin.set(0, 0.05, BEAM_START_Z));
  group.getWorldQuaternion(_beamQuaternion);

  // A ribalta aponta para o eixo local Z positivo
  _beamDirection
    .set(0, 0, 1)
    .applyQuaternion(_beamQuaternion)
    .normalize();

  let maxLength = BEAM_MAX_LENGTH;

  // Se o fecho estiver subindo, limita na altura do topo do painel LED
  if (_beamDirection.y > 0.01) {
    const distanceToLedTop =
      (LED_PANEL_TOP_Y - _beamOrigin.y) / _beamDirection.y;

    if (distanceToLedTop > 0) {
      maxLength = Math.min(maxLength, distanceToLedTop);
    }
  }

  // Se o fecho estiver descendo, limita no piso
  if (_beamDirection.y < -0.01) {
    const distanceToFloor =
      (STAGE_FLOOR_Y - _beamOrigin.y) / _beamDirection.y;

    if (distanceToFloor > 0) {
      maxLength = Math.min(maxLength, distanceToFloor);
    }
  }

  // Se o fecho estiver indo para a parede do fundo,
  // corta na parede, mas só se o ponto de impacto estiver abaixo do topo do painel.
  if (_beamDirection.z < -0.01) {
    const distanceToBackWall =
      (BACK_WALL_Z - _beamOrigin.z) / _beamDirection.z;

    if (distanceToBackWall > 0) {
      const hitY = _beamOrigin.y + _beamDirection.y * distanceToBackWall;

      if (hitY <= LED_PANEL_TOP_Y + 0.05) {
        maxLength = Math.min(maxLength, distanceToBackWall);
      }
    }
  }

  return THREE.MathUtils.clamp(
    maxLength,
    BEAM_MIN_LENGTH,
    BEAM_MAX_LENGTH
  );
}

function ensureVisuals(group) {
  if (group.userData.ribaltaVisuals) {
    return group.userData.ribaltaVisuals;
  }

  const emitters = group.userData.ribaltaEmitters ?? [];
  const lights = [];
  const beams = [];

  const beamGeo = new THREE.CylinderGeometry(
    BEAM_RADIUS,
    BEAM_RADIUS,
    1,
    BEAM_SEGMENTS,
    1,
    true
  );

  for (let i = 0; i < LED_COUNT; i++) {
    const x = getLedX(i);

    let emitter = emitters[i];

    if (!emitter) {
      const emitterMat = new THREE.MeshStandardMaterial({
        color: LED_COLOR,
        emissive: LED_COLOR,
        emissiveIntensity: 0,
        roughness: 0.2,
      });

      emitter = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 14, 14),
        emitterMat
      );

      emitter.name = `ribalta_led_${i + 1}`;
      emitter.position.set(x, 0.05, BEAM_START_Z);
      group.add(emitter);
      emitters.push(emitter);
    }

    const light = new THREE.SpotLight(
      LED_COLOR,
      0,
      BEAM_MAX_LENGTH,
      0.08,
      0.25,
      1
    );

    light.name = `ribalta_spot_${i + 1}`;
    light.position.set(x, 0.05, BEAM_START_Z);
    light.target.position.set(x, 0.05, BEAM_START_Z + 1);

    group.add(light);
    group.add(light.target);
    lights.push(light);

    const beamMat = new THREE.MeshBasicMaterial({
      color: LED_COLOR,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.name = `ribalta_beam_${i + 1}`;

    // CylinderGeometry nasce no eixo Y.
    // Essa rotação transforma o cilindro para apontar no eixo Z.
    beam.rotation.x = Math.PI / 2;

    beam.position.set(x, 0.05, BEAM_START_Z + 0.5);
    beam.visible = false;

    group.add(beam);
    beams.push(beam);
  }

  const visuals = {
    emitters,
    lights,
    beams,
  };

  group.userData.ribaltaEmitters = emitters;
  group.userData.ribaltaVisuals = visuals;

  return visuals;
}

// stroboDmx 1–255 → 1Hz a 25Hz
function strobeGate(stroboDmx) {
  const hz = THREE.MathUtils.lerp(1, 25, (stroboDmx - 1) / 254);
  const period = 1000 / hz;
  return (performance.now() % period) < period * 0.5 ? 1 : 0;
}

export function update(group, channels) {
  const ch = group.userData.channels;
  if (!ch) return;

  const dimmer = channels[ch.dimmer - 1] ?? 0;
  let dimmerT = Math.max(0, Math.min(255, dimmer)) / 255;

  const stroboDmx = ch.strobo != null ? (channels[ch.strobo - 1] ?? 0) : 0;
  if (stroboDmx > 0) {
    dimmerT *= strobeGate(stroboDmx);
  }

  // Importante:
  // speed é só velocidade de movimento.
  // Não pode interferir na luz, senão ele pisca a ribalta.
  const speed = ch.speed != null ? (channels[ch.speed - 1] ?? 127) : 127;

  if (ch.tilt != null) {
    const tilt = channels[ch.tilt - 1] ?? 0;

    const now = performance.now();
    const lastUpdateMs = group.userData.lastTiltUpdateMs ?? now;
    const deltaSeconds = Math.min((now - lastUpdateMs) / 1000, 0.1);

    group.userData.lastTiltUpdateMs = now;

    const targetTiltDeg = dmxToDeg(tilt, TILT_MIN_DEG, TILT_MAX_DEG);

    if (group.userData.currentTiltDeg === undefined) {
      group.userData.currentTiltDeg = THREE.MathUtils.radToDeg(group.rotation.x);
    }

    const tiltSpeedDegPerSec = getTiltSpeedDegPerSec(speed);

    group.userData.currentTiltDeg = moveTowards(
      group.userData.currentTiltDeg,
      targetTiltDeg,
      tiltSpeedDegPerSec * deltaSeconds
    );

    group.rotation.x = THREE.MathUtils.degToRad(group.userData.currentTiltDeg);
  }

  const { emitters, lights, beams } = ensureVisuals(group);

  // Canais led_1–led_8 controlam cada LED individualmente.
  // O dimmer é o master: ledT[i] = (led_i / 255) * dimmerT
  // Se o canal led_X não estiver mapeado no fixture, assume 255 (ligado).
  const ledKeys = ['led_1', 'led_2', 'led_3', 'led_4', 'led_5', 'led_6', 'led_7', 'led_8'];
  const ledT = ledKeys.map((key) => {
    if (ch[key] == null) return dimmerT; // canal não mapeado → usa só o dimmer
    const raw = channels[ch[key] - 1] ?? 0;
    return (Math.max(0, Math.min(255, raw)) / 255) * dimmerT;
  });

  emitters.forEach((emitter, index) => {
    if (emitter.material && 'emissiveIntensity' in emitter.material) {
      emitter.material.emissiveIntensity = ledT[index] * EMISSIVE_MAX_INTENSITY;
    }
  });

  lights.forEach((light, index) => {
    light.intensity = ledT[index] * LIGHT_MAX_INTENSITY;
  });

  const beamLength = getBeamLengthUntilSceneLimits(group);

  beams.forEach((beam, index) => {
    const t = ledT[index];

    if (t <= 0.001) {
      beam.visible = false;
      beam.material.opacity = 0;
      return;
    }

    const x = getLedX(index);

    beam.visible = true;
    beam.material.opacity = BEAM_MAX_OPACITY * t;

    beam.scale.set(1, beamLength, 1);
    beam.position.set(x, 0.05, BEAM_START_Z + beamLength / 2);
  });
}