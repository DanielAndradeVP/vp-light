// tesoura-rapido — efeito "tesoura": MH1 e MH2 cruzam o pan em direções opostas
// (quando um está na esquerda o outro está na direita, trocam de lado rápido),
// tilt também alternando. Perfil RÁPIDO (trecho agitado da música).
// Standalone (não usa mov-preset.js) — constantes físicas copiadas do briefing.
const MH1 = 'fixture_1780805067518_moving_head_beam_1';
const MH2 = 'fixture_1780805067518_moving_head_beam_2';

const MP_M1 = { PAN_C: 84, PAN_L: 42, PAN_R: 120, TILT_F: 36, TILT_A: 78, TILT_L: 35, TILT_MID: 110, TILT_FLOOR: 144 };
const MP_M2 = { PAN_C: 84, PAN_R: 44, PAN_L: 50, TILT_F: 32, TILT_A: 72, TILT_L: 26, TILT_MID: 100, TILT_FLOOR: 125 };

const MH_SPEED_FRAC = 0.1; // rápido — passo físico do interpolador ≈9 unidades/tick (40ms) neste raw
const CROSS_PERIOD = 50; // ~2s por travessia completa (ida+volta) — era 34 (~1,4s: cada perna com
// só 17 ticks/0,68s pra atravessar ~78 unidades de pan do MH1, pedindo reversão INSTANTÂNEA de
// sentido a cada perna). O passo por tick (9) até dava conta da distância em regime — o problema
// era a onda triangular exigir troca de direção com aceleração infinita nas pontas, que nenhum
// moving head físico consegue seguir sem "emperrar" no giro. 50 ticks + onda senoidal (abaixo)
// dão folga física real na reversão sem perder o perfil "rápido".

let tick = 0;
let mh1Strobo, mh2Strobo;

function ch(c, v) {
  if (c !== null && c !== undefined) SetChannel(c, Math.max(0, Math.min(255, Math.round(v))));
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Onda senoidal 0..1 — velocidade de reversão vai a zero nas pontas (ease-in/ease-out),
// em vez do corte seco da onda triangular, que pedia troca instantânea de sentido do motor.
function wave01(t, period) { return (Math.sin((2 * Math.PI * t) / period) + 1) / 2; }

function OnStart() {
  tick = 0;

  mh1Strobo = getChannel(MH1, 'strobo');
  mh2Strobo = getChannel(MH2, 'strobo');
}

function OnExecute() {
  tick++;

  adapter.setColor(MH1, 'white');
  adapter.setColor(MH2, 'white');
  adapter.setDimmer(MH1, 1);
  adapter.setDimmer(MH2, 1);
  adapter.setMovementSpeed(MH1, MH_SPEED_FRAC);
  adapter.setMovementSpeed(MH2, MH_SPEED_FRAC);

  // t compartilhado — MH1 segue L→R, MH2 segue o mapeamento invertido (R→L),
  // então quando MH1 está à esquerda o MH2 está à direita e vice-versa: o "corte".
  const t = wave01(tick, CROSS_PERIOD);
  adapter.setPanTilt(MH1, {
    pan: lerp(MP_M1.PAN_L, MP_M1.PAN_R, t),
    tilt: lerp(MP_M1.TILT_F, MP_M1.TILT_MID, t),
  });
  adapter.setPanTilt(MH2, {
    pan: lerp(MP_M2.PAN_L, MP_M2.PAN_R, 1 - t),
    tilt: lerp(MP_M2.TILT_F, MP_M2.TILT_MID, 1 - t),
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

  ch(mh1Strobo, 0);
  ch(mh2Strobo, 0);
}
