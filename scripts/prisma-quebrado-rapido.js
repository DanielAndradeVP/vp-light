// prisma-quebrado-rapido — MHs com prisma ligado girando rápido, pan/tilt em
// varredura LENTA e suave (sem o "quebrado"/nervoso da versão anterior), cor
// fixa em branco.
// Perfil RÁPIDO (trecho agitado da música) — só o movimento do moving é lento.
// Standalone (não usa mov-preset.js) — constantes físicas copiadas do briefing.
const MH1 = 'fixture_1780805067518_moving_head_beam_1';
const MH2 = 'fixture_1780805067518_moving_head_beam_2';

// Posições físicas calibradas (mov-preset.js), copiadas por ser arquivo standalone.
const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_MH_GAP = 8;

const MH_SPEED_FRAC = 0.85; // adapter: 1=lento — movimento suave e vagaroso
const PAN_PERIOD  = 240; // ~9.6s — varredura lenta de pan
const TILT_PERIOD = 240; // mesmo período, defasado em 1/4 de ciclo (ver OnExecute)

let tick = 0;
let mh1Strobo, mh2Strobo, mh1Prism, mh2Prism, mh1PrismRot, mh2PrismRot;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Onda senoidal 0..1 — transição suave e contínua, sem "quebra"/salto de direção.
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function OnStart() {
  tick = 0;

  mh1Strobo = getChannel(MH1, 'strobo');
  mh2Strobo = getChannel(MH2, 'strobo');
  mh1Prism = getChannel(MH1, 'prism_1');
  mh2Prism = getChannel(MH2, 'prism_1');
  mh1PrismRot = getChannel(MH1, 'prism_rotation');
  mh2PrismRot = getChannel(MH2, 'prism_rotation');
}

function OnExecute() {
  tick++;

  adapter.setColor(MH1, 'white');
  adapter.setColor(MH2, 'white');
  adapter.setDimmer(MH1, 1);
  adapter.setDimmer(MH2, 1);
  adapter.setMovementSpeed(MH1, MH_SPEED_FRAC);
  adapter.setMovementSpeed(MH2, MH_SPEED_FRAC);
  adapter.setPrism(MH1, 'ligado');
  adapter.setPrism(MH2, 'ligado');
  adapter.setPrismRotation(MH1, 'rapido');
  adapter.setPrismRotation(MH2, 'rapido');

  const panT = wave01(tick, PAN_PERIOD);
  const tiltT = wave01(tick + TILT_PERIOD / 4, TILT_PERIOD); // defasado 1/4 de ciclo — varredura orgânica
  adapter.setPanTilt(MH1, {
    pan: lerp(MP_M1.PAN_L, MP_M1.PAN_R, panT) - MP_MH_GAP,
    tilt: lerp(MP_M1.TILT_F, MP_M1.TILT_MID, tiltT),
  });
  adapter.setPanTilt(MH2, {
    pan: lerp(MP_M2.PAN_L, MP_M2.PAN_R, panT) + MP_MH_GAP,
    tilt: lerp(MP_M2.TILT_F, MP_M2.TILT_MID, tiltT),
  });

  // Shutter aberto (sem estrobo real no beam) — raw, sem valor "aberto" mapeado.
  ch(mh1Strobo, 255);
  ch(mh2Strobo, 255);
}

function OnTerminate() {
  adapter.setDimmer(MH1, 0);
  adapter.setDimmer(MH2, 0);
  adapter.setMovementSpeed(MH1, 0);
  adapter.setMovementSpeed(MH2, 0);
  adapter.setPanTilt(MH1, { pan: MP_M1.PAN_C, tilt: MP_M1.TILT_MID });
  adapter.setPanTilt(MH2, { pan: MP_M2.PAN_C, tilt: MP_M2.TILT_MID });

  ch(mh1Strobo, 0);
  ch(mh2Strobo, 0);
  ch(mh1Prism, 0);
  ch(mh2Prism, 0);
  ch(mh1PrismRot, 0);
  ch(mh2PrismRot, 0);
}
