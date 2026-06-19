/**
 * scene.js — Montagem da cena 3D estática do palco (Fase 2, ajustada
 * visualmente para corresponder à imagem de referência do palco real da
 * Igreja Vida e Paz)
 *
 * Responsabilidade única: construir e renderizar a representação visual
 * do palco físico (palco, treliça, fixtures) usando geometrias primitivas
 * do Three.js. Nenhuma lógica de DMX aqui — a aparência estática é a base
 * sobre a qual os módulos de fixtures/* (Fase 4) atuam a cada frame.
 *
 * Convenção de eixos:
 *   X → esquerda(-)/direita(+) do palco
 *   Y → altura (0 = piso real do palco)
 *   Z → profundidade: negativo = fundo (parede de led), positivo = frente (plateia)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { update as updateParLed } from './fixtures/parled.js';
import { update as updateMovingHeadBeam } from './fixtures/movinghead.js';
import { update as updateRibalta } from './fixtures/ribalta.js';
import { update as updateMiniBrut } from './fixtures/minibrut.js';
import { update as updateFitaLed } from './fixtures/fitaled.js';


// Fase 4 — comportamento por tipo de fixture, despachado a partir de
// group.userData.fixtureType dentro do loop de animação (renderLoop).
// Tipos sem updater (ex.: moving_head_wash, fita_led) permanecem estáticos.
const FIXTURE_UPDATERS = {
  par_led: updateParLed,
  moving_head_beam: updateMovingHeadBeam,
  ribalta: updateRibalta,
  mini_brut: updateMiniBrut,
  fita_led: updateFitaLed,
};

// ─── Paleta de materiais (cores literais do mundo 3D — não são tokens de UI) ──
const COLOR = {
  platform: 0x2b2b2b,      // plataforma elevada, cinza escuro
  skirt: 0x202020,         // saia frontal segmentada da plataforma (painéis)
  stairs: 0x2b2b2b,
  backWall: 0x1a1a1a,
  ledPanel: 0x5a5a5a,       // painel LED, cinza médio
  trussMetal: 0xc9c9c9,     // treliça e corrimãos, metálica clara
  parLedBody: 0x111111,     // par led, cilindro curto preto
  movingHeadBody: 0x1c1c1c,
  movingHeadHead: 0x2a2a2a,
  ribalta: 0x151515,
  miniBrut: 0x202020,
  fitaLed: 0x444444,
  altarLedStrip: 0xffc45a,
};

const PLATFORM = {
  width: 16.0, // antes 9.2
  depth: 4.8,
  height: 0.5,
};

const STAIR = {
  count: 4,
  depth: 0.35,
  width: 1.0,
  railHeight: 0.85,
};

const STAGE_FRONT_Z = PLATFORM.depth / 2;
const STAGE_BACK_Z = -PLATFORM.depth / 2;
const STAIR_FRONT_Z = STAGE_FRONT_Z + STAIR.depth * STAIR.count;

const BACK_WALL_Z = STAGE_BACK_Z - 0.3;

const WALL = {
  sideExtra: 3.0, // aumenta a parede para os lados
  heightExtra: 1.35, // aumenta pouco para cima
  thickness: 0.2,
};


// Grid suspenso.
// A treliça frontal agora vai até a ponta da escada.
const GRID = {
rear: {
  name: 'grid_rear_truss',
  y: 6.35,
  z: STAGE_BACK_Z + 0.25,
  halfSpan: 6.80,
},
front: {
  name: 'grid_front_truss',
  y: 5.35,
  z: STAIR_FRONT_Z - 0.05,
  halfSpan: 8.0,
},
  chordGap: 0.36,
  chordThickness: 0.085,
  laceCount: 16,
  sideInset: 0.35,
  verticalDrops: [-1.45, 1.45],
};

const CEILING = {
  y: GRID.rear.y + GRID.chordGap + 0.85,
  thickness: 0.12,
  frontZ: GRID.front.z + 0.9,
  backZ: BACK_WALL_Z,
};

// Compatibilidade temporária: algumas funções antigas ainda podem ler TRUSS.
const TRUSS = {
  height: GRID.front.y,
  halfSpan: GRID.front.halfSpan,
  z: GRID.front.z,
  chordGap: GRID.chordGap,
  chordThickness: GRID.chordThickness,
  laceCount: GRID.laceCount,
};

const FIXTURE_LAYOUT = {
  q30Rear: {
    // Alturas dos equipamentos na Q30 de trás
    yParLed: GRID.rear.y - 0.22,
    yMoving: GRID.rear.y - 0.28,
    yRibalta: GRID.rear.y - 0.55,

    // Profundidade dos equipamentos na Q30 de trás
    zParLed: GRID.rear.z + 0.12,
    zMoving: GRID.rear.z + 0.48,
    zRibalta: GRID.rear.z + 0.35,

    // Ordem da esquerda para a direita na Q30 traseira
    items: [
      { type: 'parled', n: 1, x: -6.45 }, // ParLed Ch1
      { type: 'moving', beam: 1, x: -5.55 }, // Moving Head 1 Ch123
      { type: 'parled', n: 2, x: -4.65 }, // ParLed Ch9

      { type: 'parled', n: 3, x: -3.75 }, // ParLed Ch17
      { type: 'parled', n: 5, x: -2.85 }, // ParLed Ch33

      // Espaço central para as 2 ribaltas
      { type: 'ribalta', n: 1, x: -0.85 }, // Ribalta_1 esquerda
      { type: 'ribalta', n: 2, x: 0.85 }, // Ribalta_2 direita

      { type: 'parled', n: 7, x: 2.85 }, // ParLed Ch49
      { type: 'parled', n: 8, x: 3.75 }, // ParLed Ch57
      { type: 'parled', n: 9, x: 4.65 }, // ParLed Ch65

      { type: 'moving', beam: 2, x: 5.55 }, // Moving Head 2 Ch203
      { type: 'parled', n: 6, x: 6.45 }, // ParLed Ch74
    ],
  },

  miniBrutFront: {
    // Mini Bruts presos na Q30 da frente
    y: GRID.front.y - 0.22,
    z: GRID.front.z + 0.18,

    // 4 bruts distribuídos de ponta a ponta na treliça da frente
    positions: [
      { fixtureId: 'fixture_1780805067518_mini_brut_01', name: 'Mini_Brut_01', x: -6.30 },
      { fixtureId: 'fixture_1780805067518_mini_brut_02', name: 'Mini_Brut_02', x: -2.10 },
      { fixtureId: 'fixture_1780805067518_mini_brut_03', name: 'Mini_Brut_03', x: 2.10 },
      { fixtureId: 'fixture_1780805067518_mini_brut_04', name: 'Mini_Brut_04', x: 6.30 },
    ],
  },

  speakers: {
    y: GRID.front.y - 0.30,
    z: GRID.front.z - 0.05,
    xOffset: GRID.front.halfSpan - 0.18,
  },
};

/**
 * Cria um material metálico padrão para a treliça/corrimãos.
 */
function trussMaterial() {
  return new THREE.MeshStandardMaterial({
    color: COLOR.trussMetal,
    metalness: 0.85,
    roughness: 0.3,
  });
}

/**
 * Cria uma barra fina (BoxGeometry) ligando dois pontos no espaço —
 * usado para o treliçamento diagonal, os montantes de apoio central da
 * treliça e os corrimãos sloped das escadas.
 */
function addStrut(parent, start, end, thickness, material) {
  const startV = new THREE.Vector3(...start);
  const endV = new THREE.Vector3(...end);
  const dir = new THREE.Vector3().subVectors(endV, startV);
  const length = dir.length();
  if (length < 1e-6) return null;

  const geo = new THREE.BoxGeometry(thickness, length, thickness);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(startV).add(endV).multiplyScalar(0.5);
  const axis = new THREE.Vector3(0, 1, 0);
  mesh.quaternion.setFromUnitVectors(axis, dir.normalize());
  parent.add(mesh);
  return mesh;
}

/**
 * Constrói um segmento de treliça (dois cordões paralelos + treliçamento
 * diagonal em zigue-zague) entre dois pontos 3D — usado para montar cada
 * trecho do grid suspenso (fundo, frente, laterais diagonais).
 */
function buildTrussRun(parent, name, start, end, options = {}) {
  const {
    chordGap = GRID.chordGap,
    chordThickness = GRID.chordThickness,
    laceCount = GRID.laceCount,
  } = options;

  const group = new THREE.Group();
  group.name = name;

  const mat = trussMaterial();

  const startBottom = new THREE.Vector3(...start);
  const endBottom = new THREE.Vector3(...end);

  const startTop = startBottom.clone();
  startTop.y += chordGap;

  const endTop = endBottom.clone();
  endTop.y += chordGap;

  addStrut(group, startBottom.toArray(), endBottom.toArray(), chordThickness, mat);
  addStrut(group, startTop.toArray(), endTop.toArray(), chordThickness, mat);

  for (let i = 0; i < laceCount; i++) {
    const t0 = i / laceCount;
    const t1 = (i + 1) / laceCount;

    const bottomA = startBottom.clone().lerp(endBottom, t0);
    const bottomB = startBottom.clone().lerp(endBottom, t1);
    const topA = startTop.clone().lerp(endTop, t0);
    const topB = startTop.clone().lerp(endTop, t1);

    if (i % 2 === 0) {
      addStrut(group, topA.toArray(), bottomB.toArray(), chordThickness * 0.55, mat);
    } else {
      addStrut(group, bottomA.toArray(), topB.toArray(), chordThickness * 0.55, mat);
    }
  }

  parent.add(group);
  return group;
}

/**
 * Constrói o palco: plataforma elevada com saia frontal segmentada em
 * painéis, escadas laterais com corrimão, e parede de fundo recuada com
 * painel LED centralizado — proporções baseadas na imagem de referência.
 */
function buildStage() {
  const stage = new THREE.Group();
  stage.name = 'stage';
  const railMat = trussMaterial();

  // Deck (topo da plataforma)
  const deckThickness = PLATFORM.height * 0.3;
  const deckGeo = new THREE.BoxGeometry(PLATFORM.width, deckThickness, PLATFORM.depth);
  const deckMat = new THREE.MeshStandardMaterial({ color: COLOR.platform, roughness: 0.9 });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.set(0, PLATFORM.height - deckThickness / 2, 0);
  stage.add(deck);

  // Saia frontal segmentada em painéis (fascia), como na referência
  const skirtPanelCount = 10;
  const skirtGap = 0.02;
  const skirtHeight = PLATFORM.height - deckThickness;
  const panelWidth = PLATFORM.width / skirtPanelCount - skirtGap;
  const skirtMat = new THREE.MeshStandardMaterial({ color: COLOR.skirt, roughness: 0.85 });
  for (let i = 0; i < skirtPanelCount; i++) {
    const panelGeo = new THREE.BoxGeometry(panelWidth, skirtHeight, 0.04);
    const panel = new THREE.Mesh(panelGeo, skirtMat);
    const x = -PLATFORM.width / 2 + panelWidth / 2 + i * (PLATFORM.width / skirtPanelCount);
    panel.position.set(x, skirtHeight / 2, PLATFORM.depth / 2 + 0.02);
    stage.add(panel);
  }

  // Escadas laterais (esquerda e direita) com corrimão, subindo até a
  // borda frontal da plataforma — formato de lance único, como na imagem.
  const stepCount = STAIR.count;
  const stepHeight = PLATFORM.height / stepCount;
  const stepDepth = STAIR.depth;
  const stepWidth = STAIR.width;
  const railHeight = STAIR.railHeight;

  [-1, 1].forEach((side) => {
    const stairGroup = new THREE.Group();
    stairGroup.name = side < 0 ? 'stair_left' : 'stair_right';
    const stairX = side * (PLATFORM.width / 2 - stepWidth / 2 - 0.15);

    for (let i = 0; i < stepCount; i++) {
      const depth = stepDepth * (stepCount - i);
      const stepGeo = new THREE.BoxGeometry(stepWidth, stepHeight, depth);
      const stepMat = new THREE.MeshStandardMaterial({ color: COLOR.stairs, roughness: 0.9 });
      const step = new THREE.Mesh(stepGeo, stepMat);
      const stepY = stepHeight / 2 + i * stepHeight;
      const stepZ = PLATFORM.depth / 2 + depth / 2;
      step.position.set(stairX, stepY, stepZ);
      stairGroup.add(step);
    }

    // Corrimão: postes verticais na base e no topo + 3 travessas inclinadas
    // acompanhando a subida da escada, do lado externo (mais afastado do
    // centro do palco) — réplica do corrimão visto na imagem de referência.
    const outerX = stairX + side * (stepWidth / 2 + 0.03);
    const frontZ = PLATFORM.depth / 2 + stepDepth * stepCount; // base da escada
    const backZ = PLATFORM.depth / 2; // topo, junto à borda da plataforma

    const basePostGeo = new THREE.BoxGeometry(0.04, railHeight, 0.04);
    const basePost = new THREE.Mesh(basePostGeo, railMat);
    basePost.position.set(outerX, railHeight / 2, frontZ);
    stairGroup.add(basePost);

    const topPostGeo = new THREE.BoxGeometry(0.04, railHeight + PLATFORM.height, 0.04);
    const topPost = new THREE.Mesh(topPostGeo, railMat);
    topPost.position.set(outerX, (railHeight + PLATFORM.height) / 2, backZ);
    stairGroup.add(topPost);

    [0.1, 0.42, 0.74].forEach((h) => {
      addStrut(
        stairGroup,
        [outerX, h, frontZ],
        [outerX, PLATFORM.height + h, backZ],
        0.03,
        railMat
      );
    });

    // Pequeno trecho de grade junto à borda da plataforma (continuação do
    // corrimão sobre o deck, como o portãozinho visível na referência).
    // Continuação reta do corrimão pela lateral do palco,
    // sem virar em L para dentro da passagem da escada.
    const sideRailEndZ = STAGE_BACK_Z + 0.25;
    const sideRailMidZ = (backZ + sideRailEndZ) / 2;

    [0.1, 0.42, 0.74].forEach((h) => {
      addStrut(
        stairGroup,
        [outerX, PLATFORM.height + h, backZ],
        [outerX, PLATFORM.height + h, sideRailEndZ],
        0.03,
        railMat
      );
    });

    // Poste no meio da lateral
    const sideMidPostGeo = new THREE.BoxGeometry(0.04, railHeight, 0.04);
    const sideMidPost = new THREE.Mesh(sideMidPostGeo, railMat);
    sideMidPost.position.set(
      outerX,
      PLATFORM.height + railHeight / 2,
      sideRailMidZ
    );
    stairGroup.add(sideMidPost);

    // Poste no final da lateral, perto do fundo/parede
    const sideEndPostGeo = new THREE.BoxGeometry(0.04, railHeight, 0.04);
    const sideEndPost = new THREE.Mesh(sideEndPostGeo, railMat);
    sideEndPost.position.set(
      outerX,
      PLATFORM.height + railHeight / 2,
      sideRailEndZ
    );
    stairGroup.add(sideEndPost);

    // [0.1, 0.42, 0.74].forEach((h) => {
    //   addStrut(
    //     stairGroup,
    //     [outerX, PLATFORM.height + h, backZ],
    //     [outerX - side * 0.6, PLATFORM.height + h, backZ],
    //     0.03,
    //     railMat
    //   );
    // });
    // const gateTopPostGeo = new THREE.BoxGeometry(0.04, railHeight, 0.04);
    // const gateTopPost = new THREE.Mesh(gateTopPostGeo, railMat);
    // gateTopPost.position.set(outerX - side * 0.6, PLATFORM.height + railHeight / 2, backZ);
    // stairGroup.add(gateTopPost);

    stage.add(stairGroup);
  });

  // Parede de fundo recuada, com painel LED centralizado
  const wallWidth = PLATFORM.width + 1.5;
  const wallHeight = GRID.rear.y + GRID.chordGap + 2.0;
  const wallGeo = new THREE.BoxGeometry(wallWidth, wallHeight, 0.2);
  const wallMat = new THREE.MeshStandardMaterial({ color: COLOR.backWall, roughness: 1 });
  const backWall = new THREE.Mesh(wallGeo, wallMat);
  backWall.position.set(0, wallHeight / 2, -PLATFORM.depth / 2 - 0.3);
  stage.add(backWall);

  const ledWidth = wallWidth * 0.75;
  const ledHeight = wallHeight * 0.52;

  const ledGeo = new THREE.PlaneGeometry(ledWidth, ledHeight);

  const ledTexture = new THREE.TextureLoader().load('/viewer3d/led-panel.png');
  ledTexture.colorSpace = THREE.SRGBColorSpace;

  const ledMat = new THREE.MeshBasicMaterial({
    map: ledTexture,
    side: THREE.DoubleSide,
  });

  const ledPanel = new THREE.Mesh(ledGeo, ledMat);

  ledPanel.position.set(
    0,
    PLATFORM.height + ledHeight / 2 + 0.5,
    -PLATFORM.depth / 2 - 0.19
  );

  stage.add(ledPanel);

  return stage;
}

function addAltarFrontLedStrip(parent, fixtureId, name) {
  const group = makeFixtureGroup(fixtureId, name, 'fita_led');

  const stripWidth = PLATFORM.width * 0.96;
  const stripHeight = 0.035;
  const stripDepth = 0.035;

  const stripGeo = new THREE.BoxGeometry(stripWidth, stripHeight, stripDepth);

  const stripMat = new THREE.MeshStandardMaterial({
    color: COLOR.altarLedStrip,
    emissive: COLOR.altarLedStrip,
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0,
    roughness: 0.35,
  });

  const strip = new THREE.Mesh(stripGeo, stripMat);
  strip.name = 'altar_front_led_strip_body';

  strip.position.set(
    0,
    PLATFORM.height + stripHeight / 2 + 0.01,
    PLATFORM.depth / 2 + stripDepth / 2 + 0.01
  );

  group.add(strip);

  const glowGeo = new THREE.BoxGeometry(stripWidth, 0.12, 0.025);

  const glowMat = new THREE.MeshBasicMaterial({
    color: COLOR.altarLedStrip,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.name = 'altar_front_led_strip_glow';

  glow.position.set(
    0,
    PLATFORM.height + 0.03,
    PLATFORM.depth / 2 + 0.055
  );

  group.add(glow);

  group.userData.channels = FITA_LED_CHANNELS[fixtureId];

  parent.add(group);

  return group;
}

/**
 * Constrói o grid suspenso: uma treliça mais alta ao fundo, uma treliça
 * mais baixa à frente, e duas treliças diagonais nas laterais ligando-as
 * — sem pilastras no chão, sem torres verticais, sem segundo andar.
 */
function buildSuspendedGrid() {
  const grid = new THREE.Group();
  grid.name = 'suspended_grid';

  const rearLeft = [-GRID.rear.halfSpan, GRID.rear.y, GRID.rear.z];
  const rearRight = [GRID.rear.halfSpan, GRID.rear.y, GRID.rear.z];

  const frontLeft = [-GRID.front.halfSpan, GRID.front.y, GRID.front.z];
  const frontRight = [GRID.front.halfSpan, GRID.front.y, GRID.front.z];

  buildTrussRun(
    grid,
    GRID.rear.name,
    rearLeft,
    rearRight,
    { laceCount: 16 }
  );

  buildTrussRun(
    grid,
    GRID.front.name,
    frontLeft,
    frontRight,
    { laceCount: 14 }
  );

  buildTrussRun(
    grid,
    'grid_left_diagonal_truss',
    rearLeft,
    frontLeft,
    { laceCount: 5 }
  );

  buildTrussRun(
    grid,
    'grid_right_diagonal_truss',
    rearRight,
    frontRight,
    { laceCount: 5 }
  );

  const mat = trussMaterial();

  GRID.verticalDrops.forEach((x) => {
    addStrut(
      grid,
      [x, GRID.rear.y + GRID.chordGap, GRID.rear.z],
      [x, GRID.front.y, GRID.front.z],
      GRID.chordThickness,
      mat
    );
  });

  return grid;
}

/**
 * Cria um grupo de fixture vazio com fixtureId no userData, para que a
 * fase de integração DMX consiga localizar o grupo pelo id do show.json.
 */
function makeFixtureGroup(fixtureId, name, fixtureType) {
  const group = new THREE.Group();
  group.name = name;
  group.userData.fixtureId = fixtureId;
  group.userData.fixtureType = fixtureType;
  return group;
}

function addParLed(parent, fixtureId, name, x, y, z) {
  const group = makeFixtureGroup(fixtureId, name, 'par_led');

  const bodyMat = new THREE.MeshStandardMaterial({
    color: COLOR.parLedBody,
    roughness: 0.55,
  });

  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    emissive: 0x000000,
    roughness: 0.35,
  });

  const yokeMat = new THREE.MeshStandardMaterial({
    color: 0x080808,
    roughness: 0.65,
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.16, 0.24, 24),
    bodyMat
  );
  body.name = 'body';
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.105, 24),
    lensMat
  );
  lens.name = 'lens';
  lens.position.set(0, 0, 0.125);
  group.add(lens);

  const yoke = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.035, 0.05),
    yokeMat
  );
  yoke.name = 'yoke';
  yoke.position.set(0, 0.15, 0);
  group.add(yoke);

  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function addMovingHead(parent, fixtureId, name, x, y, z, fixtureType) {
  const group = makeFixtureGroup(fixtureId, name, fixtureType);

  const bodyGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.35, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color: COLOR.movingHeadBody, roughness: 0.5 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = 'body';
  group.add(body);

  // headPivot: grupo separado para que o tilt (Fase 4) incline somente a
  // cabeça, mantendo o corpo/yoke fixo. Posição igual à da cabeça original
  // — a aparência estática (rotação 0) permanece idêntica à da Fase 2.
  const headPivot = new THREE.Group();
  headPivot.name = 'headPivot';
  headPivot.position.set(0, -0.26, 0);
  group.add(headPivot);

  const headGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.18, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: COLOR.movingHeadHead, roughness: 0.5 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.name = 'head';
  head.rotation.x = Math.PI / 2;
  headPivot.add(head);

  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function addRibalta(parent, fixtureId, name, x, y, z) {
  const group = makeFixtureGroup(fixtureId, name, 'ribalta');

  const ribaltaWidth = 1.55;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: COLOR.ribalta,
    roughness: 0.6,
  });

  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x0f0f0f,
    roughness: 0.75,
  });

  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    roughness: 0.2,
  });

  // Corpo principal da ribalta
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(ribaltaWidth, 0.12, 0.18),
    bodyMat
  );
  body.name = 'ribalta_body';
  group.add(body);

  // Frente da ribalta
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(ribaltaWidth - 0.12, 0.08, 0.03),
    faceMat
  );
  face.name = 'ribalta_face';
  face.position.set(0, 0, 0.095);
  group.add(face);

  // LEDs visíveis da ribalta
  const ledCount = 8;
  const ledSpacing = 0.17;
  const startX = -((ledCount - 1) * ledSpacing) / 2;

  const emitters = [];

  for (let i = 0; i < ledCount; i++) {
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 14, 14),
      ledMat.clone()
    );

    led.name = `ribalta_led_${i + 1}`;
    led.position.set(startX + i * ledSpacing, 0, 0.115);
    group.add(led);
    emitters.push(led);
  }

  group.userData.ribaltaEmitters = emitters;

  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function addMiniBrut(parent, fixtureId, name, x, y, z) {
  const group = makeFixtureGroup(fixtureId, name, 'mini_brut');

  const bodyMat = new THREE.MeshStandardMaterial({
    color: COLOR.miniBrut,
    roughness: 0.7,
  });

  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x080808,
    roughness: 0.85,
  });

  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffd080,
    emissive: 0xffd080,
    emissiveIntensity: 0,
    roughness: 0.25,
  });

  // Corpo principal do Brut
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.36, 0.16),
    bodyMat
  );
  body.name = 'body';
  group.add(body);

  // Frente preta onde ficam os 4 LEDs/lâmpadas
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(0.39, 0.29, 0.025),
    faceMat
  );
  face.name = 'front_face';
  face.position.set(0, 0, 0.09);
  group.add(face);

  // 4 lâmpadas abertas na frente
  const lampOffsets = [
    [-0.095, 0.075, 0.115],
    [0.095, 0.075, 0.115],
    [-0.095, -0.075, 0.115],
    [0.095, -0.075, 0.115],
  ];

  const lamps = lampOffsets.map(([lx, ly, lz], index) => {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 18, 18),
      lampMat.clone()
    );

    lamp.name = `lamp_${index + 1}`;
    lamp.position.set(lx, ly, lz);
    group.add(lamp);

    return lamp;
  });

  // Luz amarela central do Mini Brut
  const light = new THREE.PointLight(0xffd080, 0, 5, 2);
  light.name = 'mini_brut_light';
  light.position.set(0, 0, 0.22);
  group.add(light);

  // Já deixa pronto para o minibrut.js atualizar sem recriar lâmpadas
  group.userData.minibrutLamps = lamps;
  group.userData.minibrutLight = light;

  group.position.set(x, y, z);
  parent.add(group);

  return group;
}

function addFitaLed(parent, fixtureId, name, x, y, z) {
  const group = makeFixtureGroup(fixtureId, name, 'fita_led');
  const geo = new THREE.BoxGeometry(TRUSS.halfSpan * 2 * 0.4, 0.04, 0.06);
  const mat = new THREE.MeshStandardMaterial({ color: COLOR.fitaLed, roughness: 0.5 });
  const strip = new THREE.Mesh(geo, mat);
  group.add(strip);
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

/**
 * Caixa de som line array — objeto puramente visual (não é fixture DMX,
 * não tem fixtureId/userData de canal).
 */
function addLineArraySpeaker(parent, name, x, y, z, side = 1) {
  const group = new THREE.Group();
  group.name = name;

  const boxMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.75,
  });

  const grillMat = new THREE.MeshStandardMaterial({
    color: 0x050505,
    roughness: 0.9,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.6,
  });

  const moduleCount = 4;

  for (let i = 0; i < moduleCount; i++) {
    const module = new THREE.Group();
    module.name = `${name}_module_${i + 1}`;

    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, 0.28),
      boxMat
    );
    cabinet.position.set(0, -i * 0.24, 0);
    module.add(cabinet);

    const grill = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.16, 0.015),
      grillMat
    );
    grill.position.set(0, -i * 0.24, 0.145);
    module.add(grill);

    module.rotation.z = THREE.MathUtils.degToRad(side * i * 2.5);
    group.add(module);
  }

  const hanger = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.04, 0.08),
    frameMat
  );
  hanger.position.set(0, 0.12, 0);
  group.add(hanger);

  group.position.set(x, y, z);
  group.rotation.y = THREE.MathUtils.degToRad(side * -8);
  parent.add(group);

  return group;
}

/**
 * Posiciona todos os fixtures do show nos pontos descritos na tarefa.
 * fixtureId usa exatamente o `id` correspondente em shows/vp.show.json.
 */
// Fase 4 — canais DMX absolutos (1-based) de cada fixture, resolvidos a
// partir dos aliases declarados em shows/vp.show.json (startChannel +
// índice do alias no array `channels`). Os layouts dos ParLed NÃO são
// uniformes entre instâncias — por isso o mapa é por fixtureId, nunca um
// offset fixo.
const PARLED_CHANNELS = {
  1: { dimmer: 5, red: 6, green: 7, blue: 8 },
  2: { dimmer: 12, red: 13, green: 14, blue: 15 },
  3: { dimmer: 20, red: 21, green: 22, blue: 23 },
  4: { dimmer: 28, red: 29, green: 30, blue: 31 },
  5: { dimmer: 33, red: 37, green: 38, blue: 39 },
  6: { dimmer: 77, red: 78, green: 79, blue: 80 },
  7: { dimmer: 49, red: 53, green: 54, blue: 55 },
  8: { dimmer: 60, red: 61, green: 62, blue: 63 },
  9: { dimmer: 68, red: 69, green: 70, blue: 71 },
};

const MOVING_HEAD_BEAM_CHANNELS = {
  fixture_1780805067518_moving_head_beam_1: { fechoLampada: 125, pan: 132, tilt: 134 },
  fixture_1780805067518_moving_head_beam_2: { fechoLampada: 205, pan: 212, tilt: 214 },
};

const RIBALTA_CHANNELS = {
  fixture_1780805067518_ribalta_1: {
    tilt: 258,
    speed: 259,
    dimmer: 260,
    speed: 269,
  },

  fixture_1780805067518_ribalta_2: {
    tilt: 271,
    speed: 272,
    dimmer: 273,
    speed: 282,
  },
};

const MINI_BRUT_CHANNELS = {
  fixture_1780805067518_mini_brut_01: { dimmer: 400 },
  fixture_1780805067518_mini_brut_02: { dimmer: 402 },
  fixture_1780805067518_mini_brut_03: { dimmer: 401 },
  fixture_1780805067518_mini_brut_04: { dimmer: 410 },
};

const FITA_LED_CHANNELS = {
  fixture_1780805067518_fita_led: { dimmer: 404 },
};


function buildFixtures() {
  const fixtures = new THREE.Group();
  fixtures.name = 'fixtures';
  const registry = {};

  const register = (group) => {
    registry[group.userData.fixtureId] = group;
  };

  // Ordem manual da Q30 traseira, da esquerda para a direita
  FIXTURE_LAYOUT.q30Rear.items.forEach((item) => {
    if (item.type === 'parled') {
      const id = `fixture_1780805067518_parled_deluxe_${item.n}`;

      const group = addParLed(
        fixtures,
        id,
        `ParLed_Deluxe_${item.n}`,
        item.x,
        FIXTURE_LAYOUT.q30Rear.yParLed,
        FIXTURE_LAYOUT.q30Rear.zParLed
      );

      group.userData.channels = PARLED_CHANNELS[item.n];
      register(group);
      return;
    }

    if (item.type === 'moving') {
      const fixtureId =
        item.beam === 1
          ? 'fixture_1780805067518_moving_head_beam_1'
          : 'fixture_1780805067518_moving_head_beam_2';

      const group = addMovingHead(
        fixtures,
        fixtureId,
        `Moving Head Beam ${item.beam}`,
        item.x,
        FIXTURE_LAYOUT.q30Rear.yMoving,
        FIXTURE_LAYOUT.q30Rear.zMoving,
        'moving_head_beam'
      );

      group.userData.channels = MOVING_HEAD_BEAM_CHANNELS[fixtureId];

      if (item.beam === 1) {
        group.userData.panOffsetDeg = 90;
        group.userData.panDirection = 1;
      }

      if (item.beam === 2) {
        group.userData.panDirection = -1;
        group.userData.panOffsetDeg = -90;
      }

      register(group);
      return;
    }

    if (item.type === 'ribalta') {
      const fixtureId = `fixture_1780805067518_ribalta_${item.n}`;

      const group = addRibalta(
        fixtures,
        fixtureId,
        `Ribalta_${item.n}`,
        item.x,
        FIXTURE_LAYOUT.q30Rear.yRibalta,
        FIXTURE_LAYOUT.q30Rear.zRibalta
      );

      group.userData.channels = RIBALTA_CHANNELS[fixtureId];
      register(group);
      return;
    }
  });

  // 4 Mini Bruts na Q30 da frente
  FIXTURE_LAYOUT.miniBrutFront.positions.forEach((item) => {
    const group = addMiniBrut(
      fixtures,
      item.fixtureId,
      item.name,
      item.x,
      FIXTURE_LAYOUT.miniBrutFront.y,
      FIXTURE_LAYOUT.miniBrutFront.z
    );

    group.userData.channels = MINI_BRUT_CHANNELS[item.fixtureId];
    register(group);
  });

  const fitaLed = addAltarFrontLedStrip(
    fixtures,
    'fixture_1780805067518_fita_led',
    'Fita_Led'
  );

  register(fitaLed);

  return { group: fixtures, registry };
}

/**
 * Caixas de som laterais — objetos puramente visuais, não fazem parte do
 * registro de fixtures DMX.
 */
function buildSpeakers() {
  const speakers = new THREE.Group();
  speakers.name = 'speakers';

  const mat = trussMaterial();

  const leftX = -FIXTURE_LAYOUT.speakers.xOffset;
  const rightX = FIXTURE_LAYOUT.speakers.xOffset;

  const speakerY = FIXTURE_LAYOUT.speakers.y;
  const speakerZ = FIXTURE_LAYOUT.speakers.z;

  addLineArraySpeaker(
    speakers,
    'speaker_left',
    leftX,
    speakerY,
    speakerZ,
    -1
  );

  addLineArraySpeaker(
    speakers,
    'speaker_right',
    rightX,
    speakerY,
    speakerZ,
    1
  );

  // Tirantes/cabos visuais prendendo as caixas na treliça frontal.
  // Isso tira a aparência de "caixa flutuando".
  addStrut(
    speakers,
    [leftX, GRID.front.y + GRID.chordGap, GRID.front.z],
    [leftX, speakerY + 0.16, speakerZ],
    0.035,
    mat
  );

  addStrut(
    speakers,
    [rightX, GRID.front.y + GRID.chordGap, GRID.front.z],
    [rightX, speakerY + 0.16, speakerZ],
    0.035,
    mat
  );

  return speakers;
}

/**
 * Cria a iluminação geral da cena (luz de trabalho neutra, NÃO ligada a
 * nenhum fixture/DMX — apenas para tornar a cena 3D visível).
 */
function buildSceneLighting(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.5);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(4, 8, 6);
  scene.add(dir);
}

/**
 * Inicializa a cena 3D completa no canvas informado.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ render: Function, handleResize: Function, dispose: Function, fixtures: Object }}
 */
export function createViewer3DScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  // Câmera inicial frontal, na posição da plateia, olhando para o palco.
camera.position.set(0, 2.3, 17);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2;
  controls.maxDistance = 30;
  controls.update();

  buildSceneLighting(scene);
  scene.add(buildStage());
  scene.add(buildSuspendedGrid());
  scene.add(buildSpeakers());

  const { group: fixturesGroup, registry: fixtures } = buildFixtures();
  scene.add(fixturesGroup);

  function handleResize(width, height) {
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  // Fase 4 — guarda a referência ao universo DMX (512 canais) sem alterar
  // a lógica de recebimento já implementada na Fase 3: Viewer3D.jsx
  // continua fazendo `viewer.dmxUniverseRef = universeRef`, só que agora
  // essa propriedade tem um setter que grava aqui dentro do closure.
  const viewerState = { dmxUniverseRef: null };

  let rafId = null;
  function renderLoop() {
    rafId = requestAnimationFrame(renderLoop);
    controls.update();

    const dmxChannels = viewerState.dmxUniverseRef?.current;
    if (dmxChannels) {
      for (const group of Object.values(fixtures)) {
        const updater = FIXTURE_UPDATERS[group.userData.fixtureType];
        if (updater) updater(group, dmxChannels);
      }
    }

    renderer.render(scene, camera);
  }

  function start() {
    if (rafId === null) renderLoop();
  }

  function dispose() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    controls.dispose();
    renderer.dispose();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  return {
    scene, camera, renderer, controls, fixtures, start, handleResize, dispose,
    // Fase 4: Viewer3D.jsx atribui `viewer.dmxUniverseRef = universeRef`
    // exatamente como na Fase 3 — este setter apenas guarda a referência
    // no closure para que renderLoop possa lê-la a cada frame.
    get dmxUniverseRef() {
      return viewerState.dmxUniverseRef;
    },
    set dmxUniverseRef(value) {
      viewerState.dmxUniverseRef = value;
    },
  };
}
