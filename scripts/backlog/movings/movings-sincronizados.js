// CENA: MOVINGS SINCRONIZADOS
// Moving Heads 1 e 2 se movem na mesma direção em todas as fases.
// Cinco fases por ciclo: varrida diagonal lenta L→R (tilt sobe),
// duas varridas rápidas no topo, varrida diagonal R→L (tilt desce),
// e pausa à esquerda com descida do tilt até a posição inicial.

// ─── IDs de fixture ───────────────────────────────────────────────────────────
const ID_MH1 = 'fixture_1780805067518_moving_head_beam_1';
const ID_MH2 = 'fixture_1780805067518_moving_head_beam_2';

// ─── Canais resolvidos ────────────────────────────────────────────────────────
let mh1Fecho, mh1Strobo, mh1ColorWheel, mh1Pan, mh1PanFine, mh1Tilt, mh1Speed;
let mh2Fecho, mh2Strobo, mh2ColorWheel, mh2Pan, mh2PanFine, mh2Tilt, mh2Speed;

let tick = 0;

// ─── Pan / Tilt ───────────────────────────────────────────────────────────────
const MH_PAN_LEFT  = 60;   // limite esquerdo da varrida
const MH_PAN_RIGHT = 196;  // limite direito da varrida
const MH_TILT_LOW  = 145;  // posição baixa (início/fim do ciclo)
const MH_TILT_MID  = 183;  // posição intermediária
const MH_TILT_HIGH = 222;  // posição alta (topo das varridas rápidas)
const MH_GAP       = 8;    // deslocamento de pan entre MH1 e MH2 (distingue visualmente)

// ─── Durações de cada fase (ticks a 40 ms) ───────────────────────────────────
// Fase 0 (0–149):     varrida lenta L→R,  tilt LOW→HIGH  (~6s)
// Fase 1 (150–249):   varrida rápida R→L, tilt HIGH       (~4s)
// Fase 2 (250–349):   varrida rápida L→R, tilt HIGH       (~4s)
// Fase 3 (350–449):   varrida R→L,        tilt HIGH→MID   (~4s)
// Fase 4 (450–599):   pan=L fixo,         tilt MID→LOW    (~6s)
const PH0_DUR = 150;
const PH1_DUR = 100;
const PH2_DUR = 100;
const PH3_DUR = 100;
const PH4_DUR = 150;

const PH1_START = PH0_DUR;
const PH2_START = PH0_DUR + PH1_DUR;
const PH3_START = PH0_DUR + PH1_DUR + PH2_DUR;
const PH4_START = PH0_DUR + PH1_DUR + PH2_DUR + PH3_DUR;
const MH_CYCLE  = PH0_DUR + PH1_DUR + PH2_DUR + PH3_DUR + PH4_DUR; // 600

// ─── OnStart ─────────────────────────────────────────────────────────────────
function OnStart() {
  tick = 0;

  mh1Fecho      = getChannel(ID_MH1, 'fecho_lampada');
  mh1Strobo     = getChannel(ID_MH1, 'strobo');
  mh1ColorWheel = getChannel(ID_MH1, 'color_wheel');
  mh1Pan        = getChannel(ID_MH1, 'pan');
  mh1PanFine    = getChannel(ID_MH1, 'pan_fine');
  mh1Tilt       = getChannel(ID_MH1, 'tilt');
  mh1Speed      = getChannel(ID_MH1, 'virtual_speed');

  mh2Fecho      = getChannel(ID_MH2, 'fecho_lampada');
  mh2Strobo     = getChannel(ID_MH2, 'strobo');
  mh2ColorWheel = getChannel(ID_MH2, 'color_wheel');
  mh2Pan        = getChannel(ID_MH2, 'pan');
  mh2PanFine    = getChannel(ID_MH2, 'pan_fine');
  mh2Tilt       = getChannel(ID_MH2, 'tilt');
  mh2Speed      = getChannel(ID_MH2, 'virtual_speed');

  if (mh1ColorWheel !== null) { SetChannel(mh1ColorWheel, 1); SetChannel(mh1ColorWheel, 0); }
  if (mh2ColorWheel !== null) { SetChannel(mh2ColorWheel, 1); SetChannel(mh2ColorWheel, 0); }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Posição-base compartilhada pelos dois MHs.
// O offset MH_GAP é aplicado no OnExecute: MH1 recebe pan-GAP, MH2 recebe pan+GAP.
// Os dois se movem na mesma direção com separação angular constante.
function mhBasePos(phase) {
  if (phase < PH1_START) {
    // Fase 0: varrida lenta L→R enquanto tilt sobe
    const t = phase / PH0_DUR;
    return { pan: lerp(MH_PAN_LEFT, MH_PAN_RIGHT, t), tilt: lerp(MH_TILT_LOW, MH_TILT_HIGH, t) };
  }
  if (phase < PH2_START) {
    // Fase 1: varrida rápida R→L com tilt alto
    const t = (phase - PH1_START) / PH1_DUR;
    return { pan: lerp(MH_PAN_RIGHT, MH_PAN_LEFT, t), tilt: MH_TILT_HIGH };
  }
  if (phase < PH3_START) {
    // Fase 2: varrida rápida L→R com tilt alto
    const t = (phase - PH2_START) / PH2_DUR;
    return { pan: lerp(MH_PAN_LEFT, MH_PAN_RIGHT, t), tilt: MH_TILT_HIGH };
  }
  if (phase < PH4_START) {
    // Fase 3: varrida R→L enquanto tilt começa a descer
    const t = (phase - PH3_START) / PH3_DUR;
    return { pan: lerp(MH_PAN_RIGHT, MH_PAN_LEFT, t), tilt: lerp(MH_TILT_HIGH, MH_TILT_MID, t) };
  }
  // Fase 4: pan fixo à esquerda, tilt termina a descida até LOW
  const t = (phase - PH4_START) / PH4_DUR;
  return { pan: MH_PAN_LEFT, tilt: lerp(MH_TILT_MID, MH_TILT_LOW, t) };
}

// ─── OnExecute ───────────────────────────────────────────────────────────────
function OnExecute() {
  tick++;
  const mhPhase = tick % MH_CYCLE;
  const s = mhBasePos(mhPhase);

  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      255);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     255);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        s.pan - MH_GAP);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       s.tilt);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      40);

  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      255);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     255);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        s.pan + MH_GAP);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       s.tilt);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      40);
}

// ─── OnTerminate ─────────────────────────────────────────────────────────────
function OnTerminate() {
  if (mh1Fecho      !== null) SetChannel(mh1Fecho,      0);
  if (mh1Strobo     !== null) SetChannel(mh1Strobo,     0);
  if (mh1ColorWheel !== null) SetChannel(mh1ColorWheel, 0);
  if (mh1Pan        !== null) SetChannel(mh1Pan,        MH_PAN_LEFT);
  if (mh1PanFine    !== null) SetChannel(mh1PanFine,    0);
  if (mh1Tilt       !== null) SetChannel(mh1Tilt,       MH_TILT_LOW);
  if (mh1Speed      !== null) SetChannel(mh1Speed,      0);
  if (mh2Fecho      !== null) SetChannel(mh2Fecho,      0);
  if (mh2Strobo     !== null) SetChannel(mh2Strobo,     0);
  if (mh2ColorWheel !== null) SetChannel(mh2ColorWheel, 0);
  if (mh2Pan        !== null) SetChannel(mh2Pan,        MH_PAN_LEFT);
  if (mh2PanFine    !== null) SetChannel(mh2PanFine,    0);
  if (mh2Tilt       !== null) SetChannel(mh2Tilt,       MH_TILT_LOW);
  if (mh2Speed      !== null) SetChannel(mh2Speed,      0);
}
