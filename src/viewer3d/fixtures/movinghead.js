/**
 * movinghead.js — Comportamento visual do Moving Head Beam (Painel 3D, Fase 4)
 *
 * Perfil: Magic Dazzle MD-MH702, 16 canais (Moving Head Beam 1 e 2).
 * NÃO se aplica ao Moving_Wosh (perfil CMY diferente, sem fecho_lampada).
 *
 * - fecho_lampada: luz só liga quando o valor estiver em 255 (binário).
 * - pan 0-255 → -270°..+270° (rotação do group inteiro, eixo Y).
 * - tilt 0-255 → -135°..+103° visual (calibrado: 255 ≈ limite físico do teto)
 * - canal de random mode (special_random) é completamente ignorado.
 *
 * update(group, channels) é chamado a cada frame do loop de animação de
 * scene.js — não acopla nenhum outro tipo de fixture.
 */

import * as THREE from 'three';

const PAN_MIN_DEG = -270;
const PAN_MAX_DEG = 270;
const TILT_MIN_DEG = -135;
// Máximo visual calibrado: no físico, tilt 255 ≈ limite do teto; no 3D antigo (+135°)
// passava ~30 valores DMX além. 135° − (30/255)×270° ≈ 103°.
const TILT_MAX_DEG = 103;
const DEFAULT_PAN_OFFSET_DEG = 0;

// Velocidade visual do moving no 3D.
// Quanto menor, mais lento.
// Teste: 2.0 lento | 3.0 médio | 4.5 mais rápido
// const MOVEMENT_RESPONSE = 0.1;

// Velocidade máxima visual do moving no 3D.
// Menor = mais lento.
const PAN_SPEED_DEG_PER_SEC = 200;
const TILT_SPEED_DEG_PER_SEC = 200;

const LAMP_OPEN_VALUE = 255;

// color_wheel: 0=branco, 10=vermelho, 20=verde, 30=azul claro, 40=amarelo,
//              50=roxo, 60=azul escuro, 70=rosa, 80=laranja, 90=azul ciano claro
const COLOR_WHEEL_MAP = [
  0xffffff, // 0–9:   branco
  0xff2020, // 10–19: vermelho
  0x00cc44, // 20–29: verde
  0x66ccff, // 30–39: azul claro
  0xffee00, // 40–49: amarelo
  0x9900cc, // 50–59: roxo
  0x0033cc, // 60–69: azul escuro
  0xff66aa, // 70–79: rosa
  0xff6600, // 80–89: laranja
  0x44ddff, // 90+:   azul ciano claro
];

function colorWheelToHex(value) {
  const index = Math.min(Math.floor(value / 10), COLOR_WHEEL_MAP.length - 1);
  return COLOR_WHEEL_MAP[index];
}

const SPOT_INTENSITY = 8;

// Opacidade do raio visual
const BEAM_MAX_OPACITY = 0.32;

// Comprimento máximo quando não está batendo no chão
const BEAM_MAX_LENGTH = 7.0;

// Comprimento máximo quando não está batendo na parede
const BACK_WALL_Z = -2.58;

// Grossura do raio reto
const BEAM_RADIUS = 0.075;

// Quanto maior, mais redondo fica o cilindro
const BEAM_SEGMENTS = 24;

// Altura do piso do palco.
// No scene.js, o topo da plataforma fica em PLATFORM.height = 0.5.
// Deixei 0.52 para o raio parar um pouquinho acima e não atravessar visualmente.
const STAGE_FLOOR_Y = 0.52;

// Evita raio zerado ou bugado quando a cabeça fica quase paralela ao chão
const BEAM_MIN_LENGTH = 0.25;

const _beamOrigin = new THREE.Vector3();
const _beamDirection = new THREE.Vector3();
const _beamQuaternion = new THREE.Quaternion();

function dmxToDeg(value, minDeg, maxDeg) {
  const t = Math.max(0, Math.min(255, value)) / 255;
  return minDeg + t * (maxDeg - minDeg);
}

/**
 * Calcula o comprimento do raio até bater no piso do palco.
 * Se o moving estiver apontando para baixo, o raio para no chão.
 * Se estiver apontando para frente/cima, usa o comprimento máximo.
 */
function getBeamLengthUntilSceneLimits(headPivot) {
  headPivot.getWorldPosition(_beamOrigin);
  headPivot.getWorldQuaternion(_beamQuaternion);

  // O raio sai no eixo local Y negativo da cabeça
  _beamDirection
    .set(0, -1, 0)
    .applyQuaternion(_beamQuaternion)
    .normalize();

  let maxLength = BEAM_MAX_LENGTH;

  // Limite do chão do palco
  if (_beamDirection.y < -0.01) {
    const distanceToFloor = (STAGE_FLOOR_Y - _beamOrigin.y) / _beamDirection.y;

    if (distanceToFloor > 0) {
      maxLength = Math.min(maxLength, distanceToFloor);
    }
  }

  // Limite da parede do fundo
  // Z negativo = fundo do palco
  if (_beamDirection.z < -0.01) {
    const distanceToBackWall = (BACK_WALL_Z - _beamOrigin.z) / _beamDirection.z;

    if (distanceToBackWall > 0) {
      maxLength = Math.min(maxLength, distanceToBackWall);
    }
  }

  return THREE.MathUtils.clamp(
    maxLength,
    BEAM_MIN_LENGTH,
    BEAM_MAX_LENGTH
  );
}

function ensureBeam(headPivot) {
  if (headPivot.userData.beamLight) {
    return {
      light: headPivot.userData.beamLight,
      beam: headPivot.userData.beamCylinder,
    };
  }

  const light = new THREE.SpotLight(0xffffff, 0, BEAM_MAX_LENGTH, 0.08, 0.1, 1);
  light.position.set(0, 0, 0);
  light.target.position.set(0, -1, 0);

  headPivot.add(light);
  headPivot.add(light.target);

  // Raio reto e grosso, não cone.
  // Altura base = 1. Depois escalamos no update() conforme distância até o chão.
  const beamGeo = new THREE.CylinderGeometry(
    BEAM_RADIUS,
    BEAM_RADIUS,
    1,
    BEAM_SEGMENTS,
    1,
    true
  );

  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.name = 'movingBeamCylinder';

  // Começa desligado
  beam.visible = false;

  // O cilindro fica abaixo da cabeça.
  // Como a geometria tem altura 1, no update() ela será escalada e centralizada.
  beam.position.set(0, -0.5, 0);

  headPivot.add(beam);

  headPivot.userData.beamLight = light;
  headPivot.userData.beamCylinder = beam;

  return { light, beam };
}

function moveTowards(current, target, maxDelta) {
  const diff = target - current;

  if (Math.abs(diff) <= maxDelta) {
    return target;
  }

  return current + Math.sign(diff) * maxDelta;
}

export function update(group, channels) {
  const ch = group.userData.channels;
  if (!ch) return;

  const headPivot = group.getObjectByName('headPivot');
  if (!headPivot) return;

  const colorWheelValue = channels[ch.colorWheel - 1] ?? 0;
  const fechoLampada = channels[ch.fechoLampada - 1] ?? 0;
  const pan = channels[ch.pan - 1] ?? 0;
  const tilt = channels[ch.tilt - 1] ?? 0;
  // ch.specialRandom existe no show.json mas é ignorado de propósito.

  const now = performance.now();
  const lastUpdateMs = group.userData.lastUpdateMs ?? now;
  const deltaSeconds = Math.min((now - lastUpdateMs) / 1000, 0.1);

  group.userData.lastUpdateMs = now;

  const panOffsetDeg = group.userData.panOffsetDeg ?? DEFAULT_PAN_OFFSET_DEG;
  const tiltSign = group.userData.tiltSign ?? 1;

  const targetPanDeg =
    dmxToDeg(pan, PAN_MIN_DEG, PAN_MAX_DEG) + panOffsetDeg;
  const targetTiltDeg = dmxToDeg(tilt, TILT_MIN_DEG, TILT_MAX_DEG) * tiltSign;

  if (group.userData.currentPanDeg === undefined) {
    group.userData.currentPanDeg = targetPanDeg;
  }

  if (headPivot.userData.currentTiltDeg === undefined) {
    headPivot.userData.currentTiltDeg = targetTiltDeg;
  }

  group.userData.currentPanDeg = moveTowards(
    group.userData.currentPanDeg,
    targetPanDeg,
    PAN_SPEED_DEG_PER_SEC * deltaSeconds
  );

  headPivot.userData.currentTiltDeg = moveTowards(
    headPivot.userData.currentTiltDeg,
    targetTiltDeg,
    TILT_SPEED_DEG_PER_SEC * deltaSeconds
  );

  group.rotation.y = THREE.MathUtils.degToRad(group.userData.currentPanDeg);

  headPivot.rotation.x = THREE.MathUtils.degToRad(
    headPivot.userData.currentTiltDeg
  );

  const { light, beam } = ensureBeam(headPivot);

  const open = fechoLampada >= LAMP_OPEN_VALUE;

  if (!open) {
    light.intensity = 0;
    beam.visible = false;
    beam.material.opacity = 0;
    return;
  }

  const beamLength = getBeamLengthUntilSceneLimits(headPivot);

  const beamColor = colorWheelToHex(colorWheelValue);
  light.color.setHex(beamColor);
  beam.material.color.setHex(beamColor);

  // Atualiza luz real do SpotLight
  light.intensity = SPOT_INTENSITY;
  light.distance = beamLength;
  light.target.position.set(0, -beamLength, 0);

  // Atualiza raio visual reto
  beam.visible = true;
  beam.material.opacity = BEAM_MAX_OPACITY;

  // Como o cilindro original tem altura 1, scale.y vira o comprimento real.
  beam.scale.set(1, beamLength, 1);

  // Centraliza o cilindro entre a cabeça e o ponto de impacto no chão.
  beam.position.set(0, -beamLength / 2, 0);
}