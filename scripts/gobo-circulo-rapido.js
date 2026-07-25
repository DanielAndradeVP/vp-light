// gobo-circulo-rapido — MHs trocando entre os gobos de círculo, prism_rotation
// simulando a "rotação" do gobo (não existe canal de rotação de gobo dedicado),
// varredura de pan/tilt rápida.
// Perfil RÁPIDO (trecho agitado da música).
// Standalone (não usa mov-preset.js) — constantes físicas copiadas do briefing.
const MH1 = 'fixture_1780805067518_moving_head_beam_1';
const MH2 = 'fixture_1780805067518_moving_head_beam_2';

const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_MH_GAP = 8;

// Gobos "de círculo" disponíveis nas duas tabelas (varios_l fica de fora — não é circular).
const GOBOS = ['circulo_bolinhas_finas', 'circulo_bolinhas_medias', 'circulo_bolinhas_grossas', 'circulo_estrelas'];
const GOBO_STAGE_TICKS = 90; // ~3.6s por gobo
// Alterna intensidade da "rotação" (prismRotation) a cada troca de gobo — variação de velocidade.
const ROT_STAGES = ['rapido', 'medio', 'rapido', 'medio'];

const MH_SPEED_FRAC = 0.12; // rápido
const SWEEP_PERIOD = 50; // varredura de pan/tilt rápida, cobrindo curso amplo
const TILT_PHASE_OFFSET = 14; // defasagem pra não parecer robótico

let tick = 0;
let mh1Strobo, mh2Strobo, mh1PrismRot, mh2PrismRot;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function OnStart() {
  tick = 0;

  mh1Strobo = getChannel(MH1, 'strobo');
  mh2Strobo = getChannel(MH2, 'strobo');
  mh1PrismRot = getChannel(MH1, 'prism_rotation');
  mh2PrismRot = getChannel(MH2, 'prism_rotation');
}

function OnExecute() {
  tick++;

  const cycle = GOBOS.length * GOBO_STAGE_TICKS;
  const stage = Math.floor((tick % cycle) / GOBO_STAGE_TICKS);

  adapter.setColor(MH1, 'white');
  adapter.setColor(MH2, 'white');
  adapter.setDimmer(MH1, 1);
  adapter.setDimmer(MH2, 1);
  adapter.setMovementSpeed(MH1, MH_SPEED_FRAC);
  adapter.setMovementSpeed(MH2, MH_SPEED_FRAC);
  adapter.setGobo(MH1, GOBOS[stage]);
  adapter.setGobo(MH2, GOBOS[stage]);
  adapter.setPrismRotation(MH1, ROT_STAGES[stage]);
  adapter.setPrismRotation(MH2, ROT_STAGES[stage]);

  const panT = wave01(tick, SWEEP_PERIOD);
  const tiltT = wave01(tick + TILT_PHASE_OFFSET, SWEEP_PERIOD);
  adapter.setPanTilt(MH1, {
    pan: lerp(MP_M1.PAN_L, MP_M1.PAN_R, panT) - MP_MH_GAP,
    tilt: lerp(MP_M1.TILT_F, MP_M1.TILT_MID, tiltT),
  });
  adapter.setPanTilt(MH2, {
    pan: lerp(MP_M2.PAN_L, MP_M2.PAN_R, panT) + MP_MH_GAP,
    tilt: lerp(MP_M2.TILT_F, MP_M2.TILT_MID, tiltT),
  });

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

  // Sem valor "sem gobo" nomeado — volta ao aberto (0) via raw.
  const mh1Gobo = getChannel(MH1, 'gobo_wheel');
  const mh2Gobo = getChannel(MH2, 'gobo_wheel');
  ch(mh1Gobo, 0);
  ch(mh2Gobo, 0);

  ch(mh1Strobo, 0);
  ch(mh2Strobo, 0);
  ch(mh1PrismRot, 0);
  ch(mh2PrismRot, 0);
}
