// teste-cor-movings — 5 etapas, 1 cor por etapa, igual nos dois Moving Head Beam.
// Standalone (não usa mov-preset.js) — testa "color" + "panTilt"/"movementSpeed" do adapter.
const MH1 = 'fixture_1780805067518_moving_head_beam_1';
const MH2 = 'fixture_1780805067518_moving_head_beam_2';

// Nomes lógicos de cor que existem nos dois beams (conferido em shows/vp.show.json > adapters.color).
const CORES = ['white', 'red', 'yellow', 'green', 'blue_light'];
const STAGE_TICKS = 75; // 3s por etapa a 25fps
const CYCLE = CORES.length * STAGE_TICKS;

// Posições calibradas do rig (mesmos valores de MP_M1/MP_M2 em mov-preset.js) —
// hardcoded aqui porque este arquivo não começa com "mov-" (sem prepend automático).
const MH1_POS = { PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_MID: 110 };
const MH2_POS = { PAN_L: 50, PAN_R: 44,  TILT_F: 32, TILT_MID: 100 };
const GAP = 8;
const SPEED = 210 / 255; // lento e visível

let tick = 0;

function OnStart() {
  tick = 0;
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function OnExecute() {
  tick++;
  const stage = Math.floor((tick % CYCLE) / STAGE_TICKS);
  const cor = CORES[stage];

  adapter.setColor(MH1, cor);
  adapter.setColor(MH2, cor);
  adapter.setDimmer(MH1, 1);
  adapter.setDimmer(MH2, 1);
  adapter.setMovementSpeed(MH1, SPEED);
  adapter.setMovementSpeed(MH2, SPEED);

  // Varredura lenta de pan/tilt — período de 8s (200 ticks), pra garantir que o
  // feixe passe pelo campo de visão em vez de ficar parado numa posição antiga.
  const panT = wave01(tick, 200);
  const tiltT = wave01(tick + 50, 200); // defasado, movimento menos robótico
  adapter.setPanTilt(MH1, {
    pan: lerp(MH1_POS.PAN_L, MH1_POS.PAN_R, panT) - GAP,
    tilt: lerp(MH1_POS.TILT_F, MH1_POS.TILT_MID, tiltT),
  });
  adapter.setPanTilt(MH2, {
    pan: lerp(MH2_POS.PAN_L, MH2_POS.PAN_R, panT) + GAP,
    tilt: lerp(MH2_POS.TILT_F, MH2_POS.TILT_MID, tiltT),
  });

  // Shutter aberto sem estrobo — não há valor "aberto" calibrado na capability
  // strobe (só velocidades lento/medio/rapido/extra_rapido), então isso fica raw.
  const s1 = getChannel(MH1, 'strobo');
  const s2 = getChannel(MH2, 'strobo');
  if (s1 !== null) SetChannel(s1, 255);
  if (s2 !== null) SetChannel(s2, 255);
}

function OnTerminate() {
  adapter.setDimmer(MH1, 0);
  adapter.setDimmer(MH2, 0);
  adapter.setMovementSpeed(MH1, 0);
  adapter.setMovementSpeed(MH2, 0);
}
