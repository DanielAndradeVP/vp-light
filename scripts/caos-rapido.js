// caos-rapido — O mais "caótico" dos rápidos: cor, prisma e gobo trocando por fórmulas
// diferentes, pan/tilt somando senoides de frequências distintas (determinístico, baseado
// em tick — sem Math.random). Ribalta em par com strobo alto e tilt errático (sempre igual
// nas duas). Fita piscando. Perfil RÁPIDO (trecho agitado).
// Standalone (não usa mov-preset.js) — arquivo não começa com "mov-".

const MH1  = 'fixture_1780805067518_moving_head_beam_1';
const MH2  = 'fixture_1780805067518_moving_head_beam_2';
const R1   = 'fixture_1780805067518_ribalta_1';
const R2   = 'fixture_1780805067518_ribalta_2';
const FITA = 'fixture_1780805067518_fita_led';

// Constantes físicas calibradas do rig (copiadas de mov-preset.js).
const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };
const MP_MH_GAP = 8;
const MP_RIB = { TILT_LOUVOR: 105, TILT_ALTAR: 145, TILT_LOW: 100, TILT_HIGH: 190, SPEED_SLOW: 190, SPEED_FAST: 20, SPEED_MED: 170, DIM_ON: 255, DIM_WASH: 220 };

const MH_SPEED_FAST = 65; // raw virtual_speed — rastreio rápido

// Cores em comum nos dois beams (ver shows/vp.show.json > adapters.color).
const CORES = ['white', 'red', 'green', 'yellow', 'blue_light', 'purple_light'];
// Gobos em comum nos dois beams.
const GOBOS = ['circulo_bolinhas_finas', 'circulo_bolinhas_medias', 'circulo_bolinhas_grossas', 'varios_l', 'circulo_estrelas'];

let tick = 0;

let mh1Pan, mh1PanFine, mh1Tilt, mh1Speed, mh1Fecho, mh1Strobo, mh1Prism, mh1Gobo;
let mh2Pan, mh2PanFine, mh2Tilt, mh2Speed, mh2Fecho, mh2Strobo, mh2Prism, mh2Gobo;

let r1Tilt, r1Speed, r1Function, r1Strobo, r1Dimmer, r1Leds;
let r2Tilt, r2Speed, r2Function, r2Strobo, r2Dimmer, r2Leds;

let fitaDimmer;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Soma três senoides de frequências/fases diferentes, normalizada pra 0..1.
// Determinística (função pura de t) — reproduzível, sem Math.random.
function chaosWave(t, f1, f2, f3, p2, p3) {
  const v = Math.sin(f1 * t) * 0.5 + Math.sin(f2 * t + p2) * 0.3 + Math.sin(f3 * t + p3) * 0.2;
  return clamp01((v + 1) / 2);
}

function setRibaltaPair(tilt, speed, strobo, dimmer) {
  ch(r1Function, 0); ch(r2Function, 0);
  ch(r1Tilt, tilt);  ch(r2Tilt, tilt);
  ch(r1Speed, speed); ch(r2Speed, speed);
  ch(r1Strobo, strobo); ch(r2Strobo, strobo);
  ch(r1Dimmer, dimmer); ch(r2Dimmer, dimmer);
}

function OnStart() {
  tick = 0;

  mh1Pan     = getChannel(MH1, 'pan');
  mh1PanFine = getChannel(MH1, 'pan_fine');
  mh1Tilt    = getChannel(MH1, 'tilt');
  mh1Speed   = getChannel(MH1, 'virtual_speed');
  mh1Fecho   = getChannel(MH1, 'fecho_lampada');
  mh1Strobo  = getChannel(MH1, 'strobo');
  mh1Prism   = getChannel(MH1, 'prism_1');
  mh1Gobo    = getChannel(MH1, 'gobo_wheel');

  mh2Pan     = getChannel(MH2, 'pan');
  mh2PanFine = getChannel(MH2, 'pan_fine');
  mh2Tilt    = getChannel(MH2, 'tilt');
  mh2Speed   = getChannel(MH2, 'virtual_speed');
  mh2Fecho   = getChannel(MH2, 'fecho_lampada');
  mh2Strobo  = getChannel(MH2, 'strobo');
  mh2Prism   = getChannel(MH2, 'prism_1');
  mh2Gobo    = getChannel(MH2, 'gobo_wheel');

  r1Tilt     = getChannel(R1, 'tilt');
  r1Speed    = getChannel(R1, 'speed');
  r1Function = getChannel(R1, 'function');
  r1Strobo   = getChannel(R1, 'strobo');
  r1Dimmer   = getChannel(R1, 'dimmer');
  r1Leds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => getChannel(R1, 'led_' + n));

  r2Tilt     = getChannel(R2, 'tilt');
  r2Speed    = getChannel(R2, 'speed');
  r2Function = getChannel(R2, 'function');
  r2Strobo   = getChannel(R2, 'strobo');
  r2Dimmer   = getChannel(R2, 'dimmer');
  r2Leds = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => getChannel(R2, 'led_' + n));

  fitaDimmer = getChannel(FITA, 'dimmer');
}

function OnExecute() {
  tick++;

  // Pan/tilt — soma de senoides com frequências diferentes, mesma fase para MH1/MH2
  // (mantém sincronismo/espelho mesmo parecendo caótico).
  const panT = chaosWave(tick, 0.083, 0.211, 0.037, 1.7, 3.1);
  const tiltT = chaosWave(tick + 17, 0.057, 0.19, 0.11, 2.3, 0.6);

  const pan1 = lerp(MP_M1.PAN_L, MP_M1.PAN_R, panT) - MP_MH_GAP;
  const pan2 = lerp(MP_M2.PAN_L, MP_M2.PAN_R, panT) + MP_MH_GAP;
  const tilt1 = lerp(MP_M1.TILT_F, MP_M1.TILT_FLOOR, tiltT);
  const tilt2 = lerp(MP_M2.TILT_F, MP_M2.TILT_FLOOR, tiltT);

  ch(mh1Pan, pan1); ch(mh1PanFine, 0); ch(mh1Tilt, tilt1);
  ch(mh2Pan, pan2); ch(mh2PanFine, 0); ch(mh2Tilt, tilt2);

  ch(mh1Speed, MH_SPEED_FAST);
  ch(mh2Speed, MH_SPEED_FAST);

  ch(mh1Fecho, 255); ch(mh1Strobo, 255);
  ch(mh2Fecho, 255); ch(mh2Strobo, 255);

  // Cor — troca em intervalo determinístico com multiplicador coprimo (parece aleatório,
  // mas é 100% reproduzível a partir do tick).
  const corIndex = (Math.floor(tick / 13) * 7) % CORES.length;
  adapter.setColor(MH1, CORES[corIndex]);
  adapter.setColor(MH2, CORES[corIndex]);

  // Gobo — troca em outro intervalo, decorrelacionado da cor.
  const goboIndex = (Math.floor(tick / 21) * 3) % GOBOS.length;
  adapter.setGobo(MH1, GOBOS[goboIndex]);
  adapter.setGobo(MH2, GOBOS[goboIndex]);

  // Prisma — liga/desliga em ciclos determinísticos (raw pra desligar, sem valor nomeado).
  const prismOn = Math.floor(tick / 20) % 3 === 0;
  if (prismOn) {
    adapter.setPrism(MH1, 'ligado');
    adapter.setPrism(MH2, 'ligado');
  } else {
    ch(mh1Prism, 0);
    ch(mh2Prism, 0);
  }

  // Ribalta em par — strobo alto, tilt errático mas sempre igual nas duas.
  const ribaltaChaosT = chaosWave(tick * 1.7, 0.11, 0.29, 0.053, 0.9, 2.6);
  const ribaltaTilt = lerp(MP_RIB.TILT_LOW, MP_RIB.TILT_HIGH, ribaltaChaosT);
  setRibaltaPair(ribaltaTilt, MP_RIB.SPEED_FAST, 255, MP_RIB.DIM_ON);
  for (const c of r1Leds) ch(c, 255);
  for (const c of r2Leds) ch(c, 255);

  // Fita — pisca com dois períodos coprimos (7 e 11), padrão determinístico e não-óbvio.
  const blinkA = (tick % 7) < 3;
  const blinkB = (tick % 11) < 5;
  ch(fitaDimmer, blinkA !== blinkB ? 255 : 30);
}

function OnTerminate() {
  ch(mh1Fecho, 0); ch(mh1Strobo, 0); ch(mh1Speed, 0); ch(mh1PanFine, 0);
  ch(mh2Fecho, 0); ch(mh2Strobo, 0); ch(mh2Speed, 0); ch(mh2PanFine, 0);
  ch(mh1Tilt, MP_M1.TILT_MID); ch(mh1Pan, MP_M1.PAN_C); ch(mh1Prism, 0); ch(mh1Gobo, 0);
  ch(mh2Tilt, MP_M2.TILT_MID); ch(mh2Pan, MP_M2.PAN_C); ch(mh2Prism, 0); ch(mh2Gobo, 0);

  setRibaltaPair(MP_RIB.TILT_LOW, 0, 0, 0);
  for (const c of (r1Leds || [])) ch(c, 0);
  for (const c of (r2Leds || [])) ch(c, 0);

  ch(fitaDimmer, 0);
}
