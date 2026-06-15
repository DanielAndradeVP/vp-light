// === RIBALTAS — FRENTE FIXA ACESA ===
// Luz branca, apontada para frente/púlpito, sem movimento e sem efeitos.

function OnStart() {
  // Ribalta_1
  SetChannel(259, 90);   // speed
  SetChannel(258, 145);  // tilt apontado para frente/púlpito
  SetChannel(260, 255);  // dimmer mestre
  SetChannel(269, 0);    // strobo off
  SetChannel(270, 0);    // function DMX manual

  for (let ch = 261; ch <= 268; ch++) {
    SetChannel(ch, 255); // led_1 até led_8 branco cheio
  }

  // Ribalta_2
  SetChannel(272, 90);   // speed
  SetChannel(271, 145);  // tilt apontado para frente/púlpito
  SetChannel(273, 255);  // dimmer mestre
  SetChannel(282, 0);    // strobo off
  SetChannel(283, 0);    // function DMX manual

  for (let ch = 274; ch <= 281; ch++) {
    SetChannel(ch, 255); // led_1 até led_8 branco cheio
  }
}

function OnExecute() {
  // Fica parada. Nada de movimento, chase ou efeito.
}

function OnTerminate() {
  // Apaga Ribalta_1
  for (let ch = 258; ch <= 270; ch++) {
    SetChannel(ch, 0);
  }

  // Apaga Ribalta_2
  for (let ch = 271; ch <= 283; ch++) {
    SetChannel(ch, 0);
  }
}