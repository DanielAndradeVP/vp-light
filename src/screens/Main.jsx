/**
 * Main.jsx — Tela principal
 * Mesa de aparelhos + painel direito com faders ao vivo + cenas A-M + páginas
 */
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { activeSceneMatches, parseSceneRef, sceneRefId, useShow } from '../store/showStore.js';
import theme from '../theme.js';
import ChatPanel from './ChatPanel.jsx';

const SCENE_KEYS = ['A','S','D','F','G','H','J','K','L','Z','X','C','V'];
const RIGHT_PANEL_MIN_WIDTH = 260;
const RIGHT_PANEL_MAX_WIDTH = 640;
const DESK_MIN_WIDTH = 360;
const MAX_PAGE = 10;
const COLOR_PALETTE = theme.colors.scenePalette;
const DEFAULT_SCRIPT_COLOR = COLOR_PALETTE[0];
const GRID = 40;          // tamanho do quadradinho da grade — o aparelho ocupa exatamente 1 quadrado

function ColorPaletteField({ value, onChange, label = 'Cor' }) {
  return (
    <div>
      <div style={{ fontFamily:theme.typography.fontFamily, fontSize:theme.typography.label.fontSize, fontWeight:400, color:theme.colors.textSecondary, marginBottom:4 }}>
        {label}
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {COLOR_PALETTE.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            style={{
              width:32,
              height:32,
              borderRadius:theme.radius.none,
              background:color,
              cursor:'pointer',
              border:value === color ? theme.borders.strong : theme.borders.soft,
              outline:'none',
              boxShadow:'none',
              padding:0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function snapGridCoord(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number / GRID) * GRID;
}

function getFixtureGridPosition(fixture) {
  return {
    x: snapGridCoord(fixture?.posX),
    y: snapGridCoord(fixture?.posY),
  };
}

function normalizeGridView(value) {
  const zoom = Number(value?.zoom);
  const panX = Number(value?.panX);
  const panY = Number(value?.panY);
  return {
    zoom: Number.isFinite(zoom) ? Math.min(4, Math.max(0.3, zoom)) : 1,
    panX: Number.isFinite(panX) ? panX : 0,
    panY: Number.isFinite(panY) ? panY : 0,
  };
}

function getStoredGridView(showData) {
  const gridView = showData?.meta?.viewport?.grid;
  if (!gridView || typeof gridView !== 'object') return null;
  return normalizeGridView(gridView);
}

function getShowWithGridView(showData, gridView) {
  return {
    ...showData,
    meta: {
      ...(showData?.meta || {}),
      viewport: {
        ...(showData?.meta?.viewport || {}),
        grid: normalizeGridView(gridView),
      },
    },
  };
}

// Funções por modo: Mode 0 usa 'grid', Mode 1 usa 'grid2'
function getStoredGridViewForMode(showData, mode) {
  const key = mode === 1 ? 'grid2' : 'grid';
  const gridView = showData?.meta?.viewport?.[key];
  if (!gridView || typeof gridView !== 'object') return null;
  return normalizeGridView(gridView);
}

function getShowWithGridViewForMode(showData, gridView, mode) {
  const key = mode === 1 ? 'grid2' : 'grid';
  return {
    ...showData,
    meta: {
      ...(showData?.meta || {}),
      viewport: {
        ...(showData?.meta?.viewport || {}),
        [key]: normalizeGridView(gridView),
      },
    },
  };
}

function getFixtureDisplayName(name) {
  return String(name || '').replace(/_/g, ' ');
}

function isFixtureEnabled(fixture) {
  return fixture?.enabled !== false;
}

// Retorna uma string css rgb() baseada nos canais "red"/"green"/"blue"/"dimmer" do fixture
// usando os valores de liveValues. Retorna null se o fixture não tiver esses canais,
// se dimmer for zero, ou se RGB forem todos zero.
function getFixtureLiveColor(fixture, liveValues) {
  if (!fixture?.channels?.length) return null;
  const start = fixture.startChannel || 1;
  let dimmerCh = null, redCh = null, greenCh = null, blueCh = null;
  fixture.channels.forEach((label, i) => {
    const l = String(label || '').toLowerCase();
    const ch = start + i;
    if (l === 'dimmer') dimmerCh = ch;
    if (l === 'red')    redCh    = ch;
    if (l === 'green')  greenCh  = ch;
    if (l === 'blue')   blueCh   = ch;
  });
  if (redCh === null && greenCh === null && blueCh === null) return null;
  if (dimmerCh !== null && (liveValues[dimmerCh] ?? 0) === 0) return null;
  const r = liveValues[redCh]   ?? 0;
  const g = liveValues[greenCh] ?? 0;
  const b = liveValues[blueCh]  ?? 0;
  if (r === 0 && g === 0 && b === 0) return null;
  return `rgb(${r},${g},${b})`;
}

function getFixtureDmxChannelList(fixture) {
  if (!fixture) return [];
  const startChannel = Number(fixture.startChannel) || 1;
  const channelCount = Number(fixture.channelCount ?? (fixture.channels || []).length) || 0;
  return Array.from({ length: channelCount }, (_, i) => startChannel + i);
}

function getDisabledFixtureChannelSet(fixtures) {
  // Um canal só é bloqueado se nenhum fixture HABILITADO o cobre.
  const enabledChannels = new Set();
  (fixtures || []).forEach(fixture => {
    if (isFixtureEnabled(fixture)) {
      getFixtureDmxChannelList(fixture).forEach(ch => enabledChannels.add(ch));
    }
  });
  const disabledChannels = new Set();
  (fixtures || []).forEach(fixture => {
    if (!isFixtureEnabled(fixture)) {
      getFixtureDmxChannelList(fixture).forEach(ch => {
        if (!enabledChannels.has(ch)) disabledChannels.add(ch);
      });
    }
  });
  return disabledChannels;
}

function filterDisabledFixtureChannels(channelMap, disabledChannels) {
  const filtered = {};
  Object.entries(channelMap || {}).forEach(([channel, value]) => {
    if (!disabledChannels.has(Number(channel))) filtered[Number(channel)] = Number(value);
  });
  return filtered;
}

function filterDisabledFixtureChannelList(channels, disabledChannels) {
  return (channels || []).filter(channel => !disabledChannels.has(Number(channel)));
}

const SPEED_OPTIONS = [
  { value: 0.5, label: '½x' },
  { value: 1,   label: '1x' },
  { value: 2,   label: '2x' },
  { value: 3,   label: '3x' },
];

// Ordem de preferência padrão para cada tipo de fixture no painel lateral
const DEFAULT_CHANNEL_PREF_ORDER = {
  moving_head_beam: ['pan', 'tilt', 'fecho_lampada', 'strobo', 'color_wheel', 'gobo_wheel', 'speed', 'frost', 'pan_fine', 'tilt_fine'],
  ribalta: ['dimmer', 'red', 'green', 'blue', 'led_1', 'speed'],
};

const CUSTOM_FUNCTIONS_BY_TYPE = {
  ribalta: [
    { id: 'ribalta_all_on', label: 'ALL ON' },
    { id: 'speed_multiplier', label: 'SPEED', type: 'speed_selector' },
    { id: 'channel_filter', label: 'FILTRO', type: 'filtro_selector' },
  ],
  moving_head_beam: [
    { id: 'tilt_invert', label: 'TILT INVERTIDO' },
    { id: 'speed_multiplier', label: 'SPEED', type: 'speed_selector' },
    { id: 'channel_filter', label: 'FILTRO', type: 'filtro_selector' },
  ],
};

const C = {
  bg: theme.colors.bgDarker, surface: theme.colors.panel, border: theme.colors.borderSoft,
  text: theme.colors.text, textMuted: theme.colors.textMuted, white: theme.colors.text,
  btnBg: theme.colors.buttonSurface, btnBorder: theme.colors.borderSoft,
  rowSelected: theme.colors.selection, fixtureBg: theme.colors.buttonSurface, fixtureSelected: theme.colors.selection,
  sceneActive: theme.colors.selection,
};

export default function Main({ onOpenFixtures, onOpenPainel }) {
  const {
    show, currentPage, setCurrentPage,
    activeScenes, setActiveScenes,
    selectedFixtureId, setSelectedFixtureId,
    selectedFixture, disabledFixtureChannels: storeDisabledFixtureChannels, pages, saveShow, loadShow,
    updateScene, updateFixture, setShow, toggleScene,
  } = useShow();

  const [blackoutActive, setBlackoutActive] = useState(false);
  const [viewer3DActive, setViewer3DActive] = useState(false);
  const [artNetFrozen, setArtNetFrozen] = useState(false);
  const [toast, setToast] = useState(null); // string | null
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitSaving, setExitSaving] = useState(false);
  const disabledFixtureChannels = storeDisabledFixtureChannels || getDisabledFixtureChannelSet(show.fixtures);

  function showSaveFeedback(result) {
    const msg = result?.message || (result?.ok === false ? `Erro: ${result.error}` : null);
    if (msg) {
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function handleSave() {
    const showWithMode2 = {
      ...show,
      mode2: { positions: mode2Positions, titleOffsets: mode2TitleOffsets, layout: mode2Layout, gridMode, channelOrderMode, channelPrefOrder },
    };
    const result = await saveShow(showWithMode2);
    // Sincroniza o estado React com o que foi salvo, para que show.mode2 exista em memória
    // e o useEffect de restauração não precise de uma reabertura do app para funcionar.
    if (result?.ok) setShow(showWithMode2);
    showSaveFeedback(result);
    return result;
  }

  async function handleExitWithSave() {
    if (exitSaving) return;
    setExitSaving(true);
    try {
      const showWithMode2 = { ...show, mode2: { positions: mode2Positions, titleOffsets: mode2TitleOffsets, layout: mode2Layout, gridMode, channelOrderMode, channelPrefOrder } };
      const result = await saveShow(showWithMode2);
      showSaveFeedback(result);
      if (result?.ok) {
        await window.vp.closeApp();
      }
    } catch (err) {
      setToast(`Erro: ${err.message}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setExitSaving(false);
    }
  }

  async function handleExitWithoutSave() {
    await window.vp.closeApp();
  }

  // Resolve o estado do universo DMX a partir das cenas ativas no momento.
  // Reconstrói o universo do zero: limpa todos os canais e reaplica apenas as
  // cenas que continuam ativas. Também sincroniza o mapa de canais bloqueados.
  function resolveUniverseState(nextActiveScenes, nextScripts) {
    const merged = {};
    nextActiveScenes.forEach(activeRef => {
      const { scene: s } = getActiveSceneData(activeRef);
      if (s?.channels) {
        Object.entries(filterDisabledFixtureChannels(s.channels, disabledFixtureChannels)).forEach(([ch, val]) => {
          merged[Number(ch)] = Number(val);
        });
      }
    });
    const parLedChs = [...getParLedChannelSet()];
    window.vp.setActiveSceneChannels(merged, parLedChs);
    // restoreState faz universe.blackout() + reaplica canais de cena sem chamar
    // stopAllRunningScripts — scripts ainda ativos continuam rodando e reescrevem
    // seus canais no próximo tick do compositor (≤40ms).
    window.vp.restoreState(merged);
    return merged;
  }

  function handleActivateScene(key) {
    toggleScene(key);
  }

  function handleBlackout() {
    if (blackoutActive) {
      setBlackoutActive(false);
      if (activeScenes.length > 0) {
        resolveUniverseState(activeScenes, scriptsRef.current);
      }
    } else {
      setBlackoutActive(true);
      window.vp.blackout();
      setScripts(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key]?.running) next[key] = { ...next[key], running: false };
        }
        return next;
      });
      setPageScripts(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key]?.running) next[key] = { ...next[key], running: false };
        }
        return next;
      });
    }
  }

  async function handleToggleArtNetFreeze() {
    const next = !artNetFrozen;
    // Atualiza a UI primeiro: o botão reflete o estado imediatamente (fica
    // vermelho), sem depender do retorno do IPC. Se a ponte falhar, revertemos.
    setArtNetFrozen(next);
    try {
      if (!window.vp?.setArtNetFrozen) throw new Error('window.vp.setArtNetFrozen indisponível (reinicie o app após mudar o preload)');
      const res = await window.vp.setArtNetFrozen(next);
      // Sincroniza com o estado real do main, caso divirja.
      if (res && typeof res.frozen === 'boolean' && res.frozen !== next) {
        setArtNetFrozen(res.frozen);
      }
    } catch (err) {
      console.error('[vp] setArtNetFrozen falhou — revertendo botão:', err);
      setArtNetFrozen(!next); // reverte para não mentir sobre o estado do palco
    }
  }

  function handleDeselectScene() {
    // Botão/atalho "SEM CENA": desmarca TODAS as cenas ativas sem tocar nos scripts.
    // Não passa por toggleScene (que tem a regra "sempre uma cena ativa") — chama
    // setActiveScenes([]) direto, então é possível ficar com zero cenas.
    //
    // Ordem importa:
    //  1. setActiveSceneChannels({}) zera o sceneLock no main → scripts passam a poder
    //     escrever todos os canais (inclusive os que eram da cena).
    //  2. restoreState({}) faz universe.blackout() SEM parar scripts: os canais da cena
    //     vão a 0 (preto) e, no próximo tick (≤40ms), cada script ativo repinta apenas
    //     os seus próprios canais. Resultado: cena some, script continua rodando.
    setActiveScenes([]);
    window.vp.setActiveSceneChannels({});
    window.vp.restoreState({});
  }

  async function handleOpen3DViewer() {
    await window.vp.open3DViewer();
    setViewer3DActive(true);
  }

  useEffect(() => {
    if (!window.vp?.onViewer3DClosed) return;
    const unsubscribe = window.vp.onViewer3DClosed(() => setViewer3DActive(false));
    return unsubscribe;
  }, []);

  const [liveValues, setLiveValues] = useState({});
  const [universeSnapshot, setUniverseSnapshot] = useState({}); // snapshot completo do universo — alimenta cores de todos os fixtures na mesa
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testValues, setTestValues] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState('description');
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [rightPanelResize, setRightPanelResize] = useState(null); // { startX, startWidth }
  const [customFunctionMenuFixtureId, setCustomFunctionMenuFixtureId] = useState(null);
  const [activeCustomFunctionByFixture, setActiveCustomFunctionByFixture] = useState({});
  const [speedMultiplierByFixture, setSpeedMultiplierByFixture] = useState({});
  const speedChannelValuesRef = useRef({}); // { [dmxCh]: dmxValue } — preservado entre resolveSidebarValues para canais de speed virtuais
  const [channelOrderMode, setChannelOrderMode] = useState({}); // { [fixtureType]: 'canal' | 'pref' }
  const [channelPrefOrder, setChannelPrefOrder] = useState({}); // { [fixtureType]: [labelStr, ...] }
  const [testPanelPos, setTestPanelPos] = useState({ x: null, y: 56 });
  const [testPanelDrag, setTestPanelDrag] = useState(null); // { offsetX, offsetY }

  function clampRightPanelWidth(width) {
    const viewportMax = Math.max(RIGHT_PANEL_MIN_WIDTH, window.innerWidth - DESK_MIN_WIDTH);
    const maxWidth = Math.min(RIGHT_PANEL_MAX_WIDTH, viewportMax);
    return Math.min(maxWidth, Math.max(RIGHT_PANEL_MIN_WIDTH, width));
  }

  function handleRightPanelResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    setRightPanelResize({ startX: e.clientX, startWidth: rightPanelWidth });
  }

  function handleTestPanelMouseDown(e) {
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    setTestPanelDrag({ offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top });
  }

  useEffect(() => {
    if (!rightPanelResize) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function handleMove(e) {
      const nextWidth = rightPanelResize.startWidth + (rightPanelResize.startX - e.clientX);
      setRightPanelWidth(clampRightPanelWidth(nextWidth));
    }

    function handleUp() {
      setRightPanelResize(null);
    }

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [rightPanelResize]);

  useEffect(() => {
    function handleResize() {
      setRightPanelWidth(width => clampRightPanelWidth(width));
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!testPanelDrag) return;
    function handleMove(e) {
      setTestPanelPos({ x: e.clientX - testPanelDrag.offsetX, y: e.clientY - testPanelDrag.offsetY });
    }
    function handleUp() { setTestPanelDrag(null); }
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [testPanelDrag]);

  useEffect(() => {
    if (!testPanelOpen) return;
    let active = true;
    const interval = setInterval(async () => {
      const snapshot = await window.vp.getUniverse();
      if (active) setTestValues(snapshot || {});
    }, 100);
    return () => { active = false; clearInterval(interval); };
  }, [testPanelOpen]);

  useEffect(() => {
    if (!selectedFixture) setTestPanelOpen(false);
  }, [selectedFixture]);
  const [dragging, setDragging] = useState(null); // { id, offX, offY } — offset em coords de mundo
  const [selection, setSelection] = useState(null); // { startX, startY, endX, endY } — coords de mundo
  useEffect(() => {
    if (!window.vp?.onWindowCloseRequested) return undefined;
    return window.vp.onWindowCloseRequested(() => setExitModalOpen(true));
  }, []);

  const [multiSelected, setMultiSelected] = useState([]);
  const [gridMode, setGridMode] = useState(0); // 0 = normal, 1 = agrupado por grupo/tipo
  const [layoutAdjustActive, setLayoutAdjustActive] = useState(false); // modo de ajuste de layout no Mode 2
  const [mode2Positions, setMode2Positions] = useState({}); // { [fixtureId]: {x, y} } — posições customizadas no Mode 2
  const [mode2TitleOffsets, setMode2TitleOffsets] = useState({}); // { [groupKey]: {dx, dy} } — offset do grupo inteiro
  const [mode2Layout, setMode2Layout] = useState('padrao'); // 'padrao' | 'grade'
  const mesaRef = useRef(null);
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 }); // zoom/pan da mesa
  const viewRef = useRef(view);
  const gridModeRef = useRef(gridMode);
  const restoredGridViewRef = useRef(null);
  const reEmitOnNextResolveRef = useRef(false); // sinaliza re-emissão de DMX na próxima resolução da barra lateral

  // Atualiza refs de forma síncrona no corpo do componente (antes de qualquer handler),
  // garantindo que handlers assíncronos sempre leiam o valor correto.
  viewRef.current = view;
  gridModeRef.current = gridMode;

  function applyGridView(nextView) {
    const normalizedView = normalizeGridView(nextView);
    const key = `${normalizedView.zoom}|${normalizedView.panX}|${normalizedView.panY}`;
    viewRef.current = normalizedView;
    restoredGridViewRef.current = key;
    setView(normalizedView);
    setShow(prev => getShowWithGridViewForMode(prev, normalizedView, gridMode));
  }

  const autoFitDoneRef = useRef({}); // garante auto-fit apenas 1x por modo por sessão { 0: bool, 1: bool }
  useEffect(() => {
    // Viewport independente por modo: Mode 0 → 'grid', Mode 1 → 'grid2'
    const storedView = getStoredGridViewForMode(show, gridMode);
    if (!storedView) {
      // Sem viewport salvo para este modo: faz ZFit automático UMA vez por modo
      if (!autoFitDoneRef.current[gridMode] && (show.fixtures || []).length > 0 && mesaRef.current) {
        autoFitDoneRef.current = { ...autoFitDoneRef.current, [gridMode]: true };
        // Adia um tick para garantir que o layout do mesaRef já tem dimensões reais
        setTimeout(() => handleFitFixtures(), 0);
      }
      return;
    }
    const key = `${storedView.zoom}|${storedView.panX}|${storedView.panY}`;
    if (restoredGridViewRef.current === key) return;
    restoredGridViewRef.current = key;
    viewRef.current = storedView;
    setView(storedView);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, gridMode]);

  // Zoom com a roda do mouse, seguindo o ponteiro (mantém o ponto sob o cursor fixo).
  useEffect(() => {
    const el = mesaRef.current;
    if (!el) return;
    function onWheel(e) {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const prev = viewRef.current;
      const zoom = Math.min(4, Math.max(0.3, prev.zoom * factor));
      const k = zoom / prev.zoom; // razão real após o clamp
      const newView = { zoom, panX: sx - (sx - prev.panX) * k, panY: sy - (sy - prev.panY) * k };
      const newKey = `${newView.zoom}|${newView.panX}|${newView.panY}`;
      viewRef.current = newView;            // atualiza ref imediatamente (igual ao applyGridView)
      restoredGridViewRef.current = newKey; // evita que o efeito de restore reverta o scroll
      setView(newView);
      setShow(prev => getShowWithGridViewForMode(prev, newView, gridModeRef.current)); // sincroniza show.meta.viewport por modo
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const [scripts, setScripts] = useState({});
  const scriptsRef = useRef(scripts);
  scriptsRef.current = scripts; // sempre fresco: atualizado na render, antes de qualquer await
  const [scriptMenu, setScriptMenu] = useState(null); // { x, y, fkey }
  const [createModal, setCreateModal] = useState(null); // { fkey }
  const [scriptName, setScriptName] = useState('');
  const [createModalTab, setCreateModalTab] = useState('novo');
  const [existingScripts, setExistingScripts] = useState([]);
  const [selectedExisting, setSelectedExisting] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState(new Set());   // seleção de grupo (banco de conhecimento)
  const [selectedFixtures, setSelectedFixtures] = useState(new Set()); // seleção individual de fixture
  const [moveModal, setMoveModal] = useState(null); // { sourceFkey }
  const [pageScripts, setPageScripts] = useState({}); // { [sceneKey]: { name, file, running } }
  const pageScriptsRef = useRef(pageScripts);
  pageScriptsRef.current = pageScripts;
  const [sceneScriptModal, setSceneScriptModal] = useState(null); // { sceneKey }
  const [sceneScriptName, setSceneScriptName] = useState('');
  const [scriptColor, setScriptColor] = useState(DEFAULT_SCRIPT_COLOR);

  const FKEYS = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];
  const FIXTURE_GROUPS = [
    { key: 'par-led',  label: 'Par LEDs',      fixtures: ['ParLed_Deluxe_1','ParLed_Deluxe_2','ParLed_Deluxe_3','ParLed_Deluxe_4','ParLed_Deluxe_5','ParLed_Deluxe_6','ParLed_Deluxe_7','ParLed_Deluxe_8','ParLed_Deluxe_9'] },
    { key: 'ribalta',  label: 'Ribaltas',       fixtures: ['Ribalta_1','Ribalta_2','ribalta-rgb-static_1','ribalta-rgb-static_2','ribalta-rgb-static_3','ribalta-rgb-static_4'] },
    { key: 'moving',   label: 'Moving Heads',   fixtures: ['Moving_01','Moving_07','Moving_08','Moving_Wosh_01','Moving_Wosh_2'] },
    { key: 'brut',     label: 'Bruts',          fixtures: ['Mini_Brut_01','Mini_Brut_02','Mini_Brut_03','Mini_Brut_04'] },
    { key: 'fita-led', label: 'Fita LED',       fixtures: ['Fita_Led'] },
  ];
  const currentPageNumber = Math.max(1, Number.parseInt(currentPage, 10) || 1);
  const currentPageId = String(currentPageNumber);

  function getActiveSceneData(activeRef) {
    const { pageId, sceneKey } = parseSceneRef(activeRef, currentPageId);
    const scene = (pages[pageId] || {}).scenes?.[sceneKey];
    return { pageId, sceneKey, scene };
  }

  useEffect(() => {
    const load = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = await window.vp.getAllScripts();
      setScripts(result);
    };
    load();
  }, []);

  // Watch em tempo real: o main avisa quando um .js de scripts é criado,
  // modificado ou removido — sincroniza o estado local sem reload.
  useEffect(() => {
    if (!window.vp?.onScriptsChanged) return;
    const off = window.vp.onScriptsChanged((updated) => setScripts(updated || {}));
    return off;
  }, []);

  useEffect(() => {
    window.vp.getAllPageScripts(currentPageId).then(result => setPageScripts(result || {}));
  }, [currentPageId]);

  // Ao trocar de página, cenas ativas de outras páginas deixam de valer no DMX.
  const prevPageIdRef = useRef(currentPageId);
  useEffect(() => {
    if (prevPageIdRef.current === currentPageId) return;
    prevPageIdRef.current = currentPageId;
    setActiveScenes(prev => prev.filter(ref => parseSceneRef(ref, currentPageId).pageId === currentPageId));
  }, [currentPageId]);

  // Sincroniza canais bloqueados por cenas com o main process sempre que activeScenes muda
  useEffect(() => {
    const merged = {};
    activeScenes.forEach(activeRef => {
      const { scene: s } = getActiveSceneData(activeRef);
      if (s?.channels) {
        Object.entries(filterDisabledFixtureChannels(s.channels, disabledFixtureChannels)).forEach(([ch, val]) => {
          merged[Number(ch)] = Number(val);
        });
      }
    });
    const parLedChs = [...getParLedChannelSet()];
    window.vp.setActiveSceneChannels(merged, parLedChs);
    window.vp.restoreState(merged);

    // Envia mapa de cenas ativas para detecção de conflito
    const scenesMap = {};
    activeScenes.forEach(activeRef => {
      const { pageId, sceneKey, scene: s } = getActiveSceneData(activeRef);
      if (s?.channels) {
        scenesMap[sceneRefId(pageId, sceneKey)] = { name: s.name || sceneKey, channels: filterDisabledFixtureChannels(s.channels, disabledFixtureChannels) };
      }
    });
    window.vp.setActiveScenes(scenesMap);

    const customFunctions = mergeSceneCustomFunctions(activeScenes);
    if (Object.keys(customFunctions).length > 0) {
      setActiveCustomFunctionByFixture(prev => {
        const next = { ...prev };
        Object.entries(customFunctions).forEach(([fixtureId, values]) => {
          if (typeof values?.tilt_invert !== 'boolean') return;
          if (values.tilt_invert) next[fixtureId] = 'tilt_invert';
          else if (next[fixtureId] === 'tilt_invert') delete next[fixtureId];
        });
        return next;
      });
    }

    // Reset acknowledge quando novas cenas são ativadas
    setConflictAcknowledged(false);
  }, [activeScenes, pages, currentPageId, disabledFixtureChannels]);

  // Polling de conflitos a cada 100ms — SEMPRE ativo
  useEffect(() => {
    let active = true;
    const interval = setInterval(async () => {
      if (active) {
        const conflictsList = await window.vp.getConflicts();
        if (active) setConflicts(conflictsList || []);
      }
    }, 100);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // Quando modal fecha, marca como reconhecido
  useEffect(() => {
    if (!conflictModalOpen) {
      setConflictAcknowledged(true);
    }
  }, [conflictModalOpen]);

  useEffect(() => {
    if (createModalTab !== 'existentes' || !createModal) return;
    window.vp.listScripts().then(r => setExistingScripts(r.ok ? r.files : []));
  }, [createModalTab, createModal]);

  async function handleScriptRightClick(e, fkey) {
    e.preventDefault();
    setScriptMenu({ x: e.clientX, y: e.clientY, fkey });
  }

  async function handleToggleScript(fkey) {
    let result;
    try {
      result = await window.vp.toggleScript(fkey);
    } catch (e) {
      console.error('[vp] toggleScript IPC error:', fkey, e);
      return;
    }
    if (!result?.ok) {
      console.warn('[vp] toggleScript falhou:', fkey, result?.error);
      return;
    }
    setScripts(prev => ({
      ...prev,
      [fkey]: { ...(prev[fkey] || {}), running: result.running }
    }));
    if (!result.running) {
      const nextScripts = { ...scriptsRef.current, [fkey]: { ...(scriptsRef.current[fkey] || {}), running: false } };
      resolveUniverseState(activeScenes, nextScripts);
    }
  }

  async function handleCreateScript() {
    if (!scriptName.trim() || !createModal) return;
    const finalGroups = FIXTURE_GROUPS
      .filter(g => selectedGroups.has(g.key) || g.fixtures.some(f => selectedFixtures.has(f)))
      .map(g => g.key);
    const result = await window.vp.createScript(createModal.fkey, scriptName.trim(), { groups: finalGroups, color: scriptColor });
    if (result.ok) {
      setScripts(prev => ({
        ...prev,
        [createModal.fkey]: { name: result.name, file: result.file, color: result.color || scriptColor, running: false }
      }));
    }
    setCreateModal(null);
    setScriptName('');
    setScriptColor(DEFAULT_SCRIPT_COLOR);
    setSelectedGroups(new Set());
    setSelectedFixtures(new Set());
  }

  async function handleClearScript(fkey) {
    await window.vp.clearScript(fkey);
    setScripts(prev => { const next = { ...prev }; delete next[fkey]; return next; });
    setScriptMenu(null);
  }

  async function handleTogglePageScript(sceneKey) {
    const result = await window.vp.togglePageScript(currentPageId, sceneKey);
    if (result?.ok) {
      setPageScripts(prev => ({ ...prev, [sceneKey]: { ...prev[sceneKey], running: result.running } }));
      if (!result.running) {
        resolveUniverseState(activeScenes, scripts);
      }
    }
  }

  async function handleCreatePageScript() {
    if (!sceneScriptName.trim() || !sceneScriptModal) return;
    // Se a tecla tinha cena ativa, desativa e limpa antes de criar o script
    const key = sceneScriptModal.sceneKey;
    if (scenes[key]) {
      setActiveScenes(prev => prev.filter(activeRef => !activeSceneMatches(activeRef, currentPageId, key)));
      updateScene(currentPageId, key, { name: '', color: '', channels: {} });
    }
    const result = await window.vp.createPageScript(currentPageId, key, sceneScriptName.trim());
    if (result.ok) {
      setPageScripts(prev => ({ ...prev, [key]: { name: result.name, file: result.file, running: false } }));
    }
    setSceneScriptModal(null);
    setSceneScriptName('');
  }

  async function handleClearPageScript(sceneKey) {
    await window.vp.clearPageScript(currentPageId, sceneKey);
    setPageScripts(prev => { const next = { ...prev }; delete next[sceneKey]; return next; });
    setContextMenu(null);
  }

  const [contextMenu, setContextMenu] = useState(null); // { x, y, sceneKey }
  const [saveModal, setSaveModal] = useState(null); // { sceneKey }
  const [sceneMoveModal, setSceneMoveModal] = useState(null); // { sourceKey }
  const [modalName, setModalName] = useState('');
  const [modalColor, setModalColor] = useState('#000000');

  const COLORS = COLOR_PALETTE;

  function handleSceneRightClick(e, key) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sceneKey: key });
  }

  function openSaveModal() {
    if (!contextMenu) return;
    const existing = scenes[contextMenu.sceneKey];
    setModalName(existing?.name || '');
    setModalColor(existing?.color || '#000000');
    setSaveModal({ sceneKey: contextMenu.sceneKey });
    setContextMenu(null);
  }

  async function handleConfirmSave() {
    if (!saveModal) return;
    const channels = {};
    let snapshot = null;
    try { snapshot = await window.vp.getUniverse(); } catch { snapshot = null; }

    Object.entries(snapshot || {}).forEach(([ch, val]) => {
      if (disabledFixtureChannels.has(Number(ch))) return;
      const numericValue = Math.max(0, Math.min(255, Math.round(Number(val) || 0)));
      if (numericValue > 0) channels[Number(ch)] = numericValue;
    });

    Object.entries(liveValues).forEach(([ch, val]) => {
      if (disabledFixtureChannels.has(Number(ch))) return;
      const channel = Number(ch);
      const numericValue = Math.max(0, Math.min(255, Math.round(Number(val) || 0)));
      channels[channel] = numericValue;
    });

    const result = await updateScene(currentPageId, saveModal.sceneKey, {
      name: modalName,
      color: modalColor,
      channels,
      customFunctions: getSceneCustomFunctionsState(),
    });
    if (result?.ok === false) {
      console.warn('[vp] updateScene falhou:', result?.error);
      return;
    }
    setSaveModal(null);
  }

  function handleClearScene() {
    if (!contextMenu) return;
    updateScene(currentPageId, contextMenu.sceneKey, { name: '', color: '', channels: {} });
    setContextMenu(null);
  }

  useEffect(() => {
    function handleClick() { setContextMenu(null); setScriptMenu(null); }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // ─── ORQUESTRADOR DE ESTADO DA BARRA LATERAL ───────────────────────────────
  // Resolve, em tempo de execução, a fonte ativa de cada canal do fixture
  // selecionado. Prioridade: cena ativa (a mais recente sobrescreve) → script
  // ativo (snapshot ao vivo do universo) → 0. Os labels vêm da descrição do
  // fixture; os valores exibidos vêm deste estado resolvido.
  const resolveSidebarValues = useCallback(async () => {
    // Sempre busca o snapshot do universo — alimenta as cores de todas as caixinhas na mesa
    let snapshot = null;
    try { snapshot = await window.vp.getUniverse(); } catch { snapshot = null; }
    if (snapshot) setUniverseSnapshot(snapshot);

    if (!selectedFixture || !isFixtureEnabled(selectedFixture)) { setLiveValues({}); return; }

    const start = selectedFixture.startChannel;
    const count = selectedFixture.channelCount ?? (selectedFixture.channels || []).length;

    // Cenas ativas — mescladas na ordem de ativação: a última (mais recente) vence
    const sceneMerged = {};
    activeScenes.forEach(activeRef => {
      const { scene: s } = getActiveSceneData(activeRef);
      if (s?.channels) {
        Object.entries(filterDisabledFixtureChannels(s.channels, disabledFixtureChannels)).forEach(([ch, val]) => {
          sceneMerged[Number(ch)] = Number(val);
        });
      }
    });

    // Resolve cada canal do fixture pelo universo real. A cena ativa e os faders
    // ja foram aplicados no backend; aqui o snapshot e a fonte da verdade.
    const resolved = {};
    for (let i = 0; i < count; i++) {
      const ch = start + i;
      if (snapshot && snapshot[ch] != null)        resolved[ch] = Number(snapshot[ch]);   // universo real (cena, script ou manual)
      else if (!snapshot && ch in sceneMerged)     resolved[ch] = sceneMerged[ch];        // fallback se IPC falhar
      else                                         resolved[ch] = 0;
    }
    // Canais de speed virtuais não ficam no universo DMX — preserva o último valor enviado pelo fader
    Object.entries(speedChannelValuesRef.current).forEach(([ch, val]) => {
      const numCh = Number(ch);
      if (numCh >= start && numCh < start + count) resolved[numCh] = val;
    });
    setLiveValues(resolved);
    // Re-emite canais ao DMX quando a seleção muda — sem exigir interação com o fader
    if (reEmitOnNextResolveRef.current) {
      reEmitOnNextResolveRef.current = false;
      await Promise.all(
        Object.entries(resolved)
          .filter(([ch]) => !disabledFixtureChannels.has(Number(ch)))
          .map(([ch, val]) => window.vp.setChannel(Number(ch), Number(val)))
      );
    }
  }, [selectedFixture, activeScenes, pages, currentPageId, scripts, disabledFixtureChannels]);

  // Marca re-emissão de DMX quando seleção muda — deve vir antes do effect de resolução
  useEffect(() => {
    reEmitOnNextResolveRef.current = true;
  }, [selectedFixtureId, multiSelected]);

  useEffect(() => {
    const selectedIds = multiSelected.length >= 2
      ? multiSelected
      : (selectedFixtureId ? [selectedFixtureId] : []);
    if (selectedIds.length === 0) return;

    const selectedIdSet = new Set(selectedIds);
    const defaults = (show.fixtures || [])
      .filter(fixture => selectedIdSet.has(fixture.id) && isFixtureEnabled(fixture))
      .map(fixture => ({ fixture, functionId: getDefaultCustomFunctionForFixture(fixture) }))
      .filter(item => item.functionId);

    if (defaults.length === 0) return;

    setActiveCustomFunctionByFixture(prev => {
      let changed = false;
      const next = { ...prev };
      defaults.forEach(({ fixture, functionId }) => {
        if (!next[fixture.id]) {
          next[fixture.id] = functionId;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [selectedFixtureId, multiSelected, show.fixtures]);

  // Dispara resolução imediata: muda fixture selecionado, cenas ativas ou scripts
  useEffect(() => { resolveSidebarValues(); }, [resolveSidebarValues]);

  // Mantém a barra lateral sincronizada em tempo real enquanto houver script ativo
  useEffect(() => {
    const anyScriptRunning = Object.values(scripts).some(s => s?.running);
    if (!anyScriptRunning || !selectedFixture) return;
    let active = true;
    const interval = setInterval(() => { if (active) resolveSidebarValues(); }, 100);
    return () => { active = false; clearInterval(interval); };
  }, [scripts, selectedFixture, resolveSidebarValues]);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key !== 'Escape') return;
      if (exitModalOpen)     { setExitModalOpen(false); return; }
      if (moveModal)         { setMoveModal(null); return; }
      if (sceneMoveModal)    { setSceneMoveModal(null); return; }
      if (sceneScriptModal)  { setSceneScriptModal(null); setSceneScriptName(''); return; }
      if (saveModal)         { setSaveModal(null); return; }
      if (createModal)       { setCreateModal(null); setScriptName(''); setScriptColor(DEFAULT_SCRIPT_COLOR); return; }
      if (contextMenu)       { setContextMenu(null); return; }
      if (scriptMenu)        { setScriptMenu(null); return; }
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [exitModalOpen, moveModal, sceneMoveModal, sceneScriptModal, saveModal, createModal, contextMenu, scriptMenu]);

  const scenes = (pages[currentPageId] || {}).scenes || {};

  const handleKey = useCallback((e) => {
    const target = e.target;
    const tagName = target?.tagName;
    const isEditableTarget =
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      target?.isContentEditable;

    if (isEditableTarget) return;
    if (!e.ctrlKey && !e.altKey && !e.metaKey && /^[0-9]$/.test(e.key)) {
      const pageId = e.key === '0' ? '10' : e.key;
      if (pageId !== currentPageId && pages[pageId]) {
        e.preventDefault();
        setCurrentPage(pageId);
      }
      return;
    }
    const key = e.key.toUpperCase();
    if (SCENE_KEYS.includes(key)) {
      if (pageScriptsRef.current[key]) { handleTogglePageScript(key); }
      else { handleActivateScene(key); }
      return;
    }
    if (e.code === 'Space') { e.preventDefault(); handleBlackout(); return; }
    if (key === 'Q') { e.preventDefault(); handleDeselectScene(); return; }
    if (FKEYS.includes(key)) { e.preventDefault(); handleToggleScript(key); return; }
  }, [currentPageId, handleActivateScene, handleBlackout, handleDeselectScene, handleToggleScript, pages, setCurrentPage]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  function pgUp() {
    setCurrentPage(String(Math.max(1, currentPageNumber - 1)));
  }

  function pgDw() {
    setCurrentPage(String(Math.min(MAX_PAGE, currentPageNumber + 1)));
  }

  async function handleFader(dmxChannel, value) {
    if (disabledFixtureChannels.has(Number(dmxChannel))) return;
    const raw = Number(value);
    const tiltChs = getFixtureTiltChannels(selectedFixture);
    const speedChs = getFixtureSpeedChannels(selectedFixture);
    let val = raw;
    if (selectedFixture && isTiltInvertActive(selectedFixture) && tiltChs.has(Number(dmxChannel))) {
      val = 255 - raw;
    } else if (selectedFixture && speedChs.has(Number(dmxChannel))) {
      val = Math.min(255, Math.round(raw / getFixtureSpeedMultiplier(selectedFixture)));
    }
    setLiveValues(prev => ({ ...prev, [dmxChannel]: val }));
    setUniverseSnapshot(prev => ({ ...prev, [dmxChannel]: val }));
    // Preserva valor de canais de speed — o universo DMX pode não refletir canais virtuais
    if (speedChs.has(Number(dmxChannel))) {
      speedChannelValuesRef.current = { ...speedChannelValuesRef.current, [Number(dmxChannel)]: val };
    }
    await window.vp.setChannel(dmxChannel, val);
  }

  async function handleZeroSelectedFixtureChannels() {
    const targetFixtures = multiSelected.length >= 2
      ? show.fixtures.filter(fixture => multiSelected.includes(fixture.id) && isFixtureEnabled(fixture))
      : (selectedFixture && isFixtureEnabled(selectedFixture) ? [selectedFixture] : []);
    if (targetFixtures.length === 0) return;

    const updates = {};
    targetFixtures.forEach(fixture => {
      getFixtureDmxChannels(fixture).forEach(dmxCh => {
        if (disabledFixtureChannels.has(Number(dmxCh))) return;
        updates[dmxCh] = 0;
      });
    });
    if (Object.keys(updates).length === 0) return;
    setLiveValues(prev => ({ ...prev, ...updates }));
    setUniverseSnapshot(prev => ({ ...prev, ...updates }));
    await Promise.all(
      Object.keys(updates).map(ch => window.vp.setChannel(Number(ch), 0))
    );
  }

  async function handleGroupedFader(entries, value) {
    const raw = Number(value);
    const updates = {};
    entries.forEach(({ dmxCh, fixture }) => {
      if (disabledFixtureChannels.has(Number(dmxCh))) return;
      const tiltChs = getFixtureTiltChannels(fixture);
      const speedChs = getFixtureSpeedChannels(fixture);
      let val = raw;
      if (fixture && isTiltInvertActive(fixture) && tiltChs.has(Number(dmxCh))) {
        val = 255 - raw;
      } else if (fixture && speedChs.has(Number(dmxCh))) {
        val = Math.min(255, Math.round(raw / getFixtureSpeedMultiplier(fixture)));
      }
      updates[dmxCh] = val;
    });
    setLiveValues(prev => ({ ...prev, ...updates }));
    setUniverseSnapshot(prev => ({ ...prev, ...updates }));
    await Promise.all(
      Object.entries(updates).map(([ch, v]) => window.vp.setChannel(Number(ch), v))
    );
  }

  function getFixtureDmxChannels(fixture) {
    if (!fixture) return [];
    const startChannel = fixture.startChannel || 1;
    const channelCount = fixture.channelCount ?? (fixture.channels || []).length;
    return Array.from({ length: channelCount }, (_, i) => startChannel + i);
  }

  function getFixtureType(fixture) {
    return String(fixture?.fixtureType || fixture?.type || '').toLowerCase();
  }

  // Conjunto de canais DMX pertencentes a par_leds habilitados. Usado para
  // liberá-los do lock de cena quando um script está rodando (coexistência
  // cena + script). Set vazio se não houver par_led no show.
  function getParLedChannelSet() {
    const s = new Set();
    (show.fixtures || []).forEach(f => {
      if (!isFixtureEnabled(f)) return;
      if (getFixtureType(f) !== 'par_led') return;
      getFixtureDmxChannels(f).forEach(ch => s.add(ch));
    });
    return s;
  }

  function getRightPanelChannelLabel(fixture, label) {
    const rawLabel = String(label || '');
    const normalizedLabel = rawLabel.toLowerCase();
    if (normalizedLabel === 'virtual_speed') return 'speed';
    return rawLabel;
  }

  function getFixtureCustomFunctions(fixture) {
    return CUSTOM_FUNCTIONS_BY_TYPE[getFixtureType(fixture)] || [];
  }

  function isAutoAllOnRibalta(fixture) {
    const fixtureName = String(fixture?.name || '').toLowerCase().replace(/\s+/g, '_');
    return fixtureName === 'ribalta_1' || fixtureName === 'ribalta_2';
  }

  function getDefaultCustomFunctionForFixture(fixture) {
    if (isAutoAllOnRibalta(fixture)) return 'ribalta_all_on';
    return null;
  }

  function toggleCustomFunctionMenu(fixtureId) {
    setCustomFunctionMenuFixtureId(prev => (prev === fixtureId ? null : fixtureId));
  }

  function selectCustomFunction(fixture, functionId) {
    const available = getFixtureCustomFunctions(fixture);
    if (!available.some(fn => fn.id === functionId)) return;
    setActiveCustomFunctionByFixture(prev => {
      const next = { ...prev };
      if (next[fixture.id] === functionId) delete next[fixture.id];
      else next[fixture.id] = functionId;
      return next;
    });
    setCustomFunctionMenuFixtureId(null);
  }

  function getSceneCustomFunctionsState() {
    const customFunctions = {};
    (show.fixtures || []).forEach(fixture => {
      if (!isFixtureEnabled(fixture)) return;
      if (getFixtureType(fixture) !== 'moving_head_beam') return;
      customFunctions[fixture.id] = {
        tilt_invert: isTiltInvertActive(fixture),
      };
    });
    return customFunctions;
  }

  function mergeSceneCustomFunctions(activeKeys) {
    const merged = {};
    activeKeys.forEach(activeRef => {
      const { scene } = getActiveSceneData(activeRef);
      const sceneCustom = scene?.customFunctions;
      if (!sceneCustom || typeof sceneCustom !== 'object') return;
      Object.entries(sceneCustom).forEach(([fixtureId, values]) => {
        if (!values || typeof values !== 'object') return;
        merged[fixtureId] = { ...(merged[fixtureId] || {}), ...values };
      });
    });
    return merged;
  }

  function getRibaltaLedChannels(fixture) {
    if (getFixtureType(fixture) !== 'ribalta') return [];
    const startChannel = fixture.startChannel || 1;
    return (fixture.channels || [])
      .map((name, i) => ({ name: String(name || '').toLowerCase(), channel: startChannel + i }))
      .filter(item => /^led_?[1-8]$/.test(item.name))
      .map(item => item.channel);
  }

  function isRibaltaAllOnActive(fixture) {
    return getFixtureType(fixture) === 'ribalta'
      && activeCustomFunctionByFixture[fixture.id] === 'ribalta_all_on';
  }

  function isTiltInvertActive(fixture) {
    return getFixtureType(fixture) === 'moving_head_beam'
      && activeCustomFunctionByFixture[fixture.id] === 'tilt_invert';
  }

  // Retorna o Set de canais DMX absolutos classificados como tilt/tilt_fine no fixture
  function getFixtureTiltChannels(fixture) {
    if (!fixture) return new Set();
    const start = fixture.startChannel || 1;
    const result = new Set();
    (fixture.channels || []).forEach((label, i) => {
      const l = String(label || '').toLowerCase();
      if (l === 'tilt' || l === 'tilt_fine') result.add(start + i);
    });
    return result;
  }

  // Retorna o multiplier de speed ativo para o fixture (default 1)
  function getFixtureSpeedMultiplier(fixture) {
    if (!fixture) return 1;
    return speedMultiplierByFixture[fixture.id] ?? 1;
  }

  // Retorna o Set de canais DMX absolutos classificados como 'speed' no fixture
  function getFixtureSpeedChannels(fixture) {
    if (!fixture) return new Set();
    const start = fixture.startChannel || 1;
    const result = new Set();
    (fixture.channels || []).forEach((label, i) => {
      const lbl = String(label || '').toLowerCase();
      if (lbl === 'speed' || lbl === 'virtual_speed') result.add(start + i);
    });
    return result;
  }

  // Define o speed multiplier para um ou mais fixtures (arr)
  function setSpeedMultiplierForFixtures(fixtureArr, multiplier) {
    setSpeedMultiplierByFixture(prev => {
      const next = { ...prev };
      fixtureArr.forEach(fx => { next[fx.id] = multiplier; });
      return next;
    });
  }

  // Move um canal na ordem de preferência (+1 = para baixo, -1 = para cima)
  function movePrefChannel(fixtureType, label, dir) {
    setChannelPrefOrder(prev => {
      const base = prev[fixtureType] || DEFAULT_CHANNEL_PREF_ORDER[fixtureType] || [];
      const order = [...base];
      let idx = order.indexOf(label);
      if (idx === -1) { order.push(label); idx = order.length - 1; }
      const newIdx = Math.max(0, Math.min(order.length - 1, idx + dir));
      if (newIdx === idx) return prev;
      const next = [...order];
      next.splice(idx, 1);
      next.splice(newIdx, 0, label);
      return { ...prev, [fixtureType]: next };
    });
  }

  async function handleRibaltaAllOnFader(fixture, value) {
    if (!isRibaltaAllOnActive(fixture)) return;
    const val = Number(value);
    const channels = filterDisabledFixtureChannelList(getRibaltaLedChannels(fixture), disabledFixtureChannels);
    if (channels.length === 0) return;
    setLiveValues(prev => {
      const next = { ...prev };
      channels.forEach(channel => { next[channel] = val; });
      return next;
    });
    setUniverseSnapshot(prev => {
      const next = { ...prev };
      channels.forEach(channel => { next[channel] = val; });
      return next;
    });
    await window.vp.setChannelRange(channels, val);
  }

  async function handleRibaltaAllOnFaderMulti(fixtures, value) {
    const val = Number(value);
    const allChannels = fixtures.flatMap(fx =>
      filterDisabledFixtureChannelList(getRibaltaLedChannels(fx), disabledFixtureChannels)
    );
    if (allChannels.length === 0) return;
    setLiveValues(prev => {
      const next = { ...prev };
      allChannels.forEach(channel => { next[channel] = val; });
      return next;
    });
    setUniverseSnapshot(prev => {
      const next = { ...prev };
      allChannels.forEach(channel => { next[channel] = val; });
      return next;
    });
    await window.vp.setChannelRange(allChannels, val);
  }

  const GROUP_TITLE_COLORS = ['#00ccff', '#ffcc00', '#ff5555', '#44dd44', '#ff9944', '#bb66ff', '#ff66bb', '#44ffbb'];

  function computeGroupedLayout(customPositions = {}, customTitleOffsets = {}, layoutType = 'padrao') {
    const groupOrder = [];
    const groupMap = {};
    (show.fixtures || []).forEach(f => {
      const g = String(f.group || f.fixtureType || 'Outros');
      if (!groupMap[g]) { groupMap[g] = []; groupOrder.push(g); }
      groupMap[g].push(f);
    });
    const positions = {};
    const titles = [];

    if (layoutType === 'grade') {
      // Layout grade: 2 colunas de grupos lado a lado
      const maxInGroup = Math.max(...groupOrder.map(name => groupMap[name].length), 1);
      const colWidth = maxInGroup * GRID * 2 + GRID * 2; // largura de cada coluna
      const rowHeight = GRID * 3; // título + fixtures + espaço
      let lyLeft = 0, lyRight = 0;
      groupOrder.forEach((name, gi) => {
        const color = GROUP_TITLE_COLORS[gi % GROUP_TITLE_COLORS.length];
        const isRight = gi % 2 === 1;
        const baseX = isRight ? colWidth : 0;
        const baseY = isRight ? lyRight : lyLeft;
        titles.push({ name: name.toUpperCase(), groupKey: name, x: baseX, y: baseY, color });
        groupMap[name].forEach((f, i) => {
          positions[f.id] = { x: baseX + i * GRID * 2, y: baseY + GRID };
        });
        if (isRight) lyRight += rowHeight;
        else lyLeft += rowHeight;
      });
    } else {
      // Layout padrão: grupos empilhados verticalmente
      let y = 0;
      groupOrder.forEach((name, gi) => {
        const color = GROUP_TITLE_COLORS[gi % GROUP_TITLE_COLORS.length];
        titles.push({ name: name.toUpperCase(), groupKey: name, x: 0, y, color });
        y += GRID;
        groupMap[name].forEach((f, i) => {
          positions[f.id] = { x: i * GRID * 2, y };
        });
        y += GRID * 2;
      });
    }

    // Aplica posições customizadas por fixture (sobrescreve layout)
    Object.entries(customPositions).forEach(([id, pos]) => {
      positions[id] = pos;
    });

    // Aplica offsets de grupo nos títulos
    titles.forEach(t => {
      const off = customTitleOffsets[t.groupKey];
      if (off) { t.x += off.dx; t.y += off.dy; }
    });

    return { positions, titles };
  }

  function handleFitFixtures() {
    const rect = mesaRef.current?.getBoundingClientRect();
    const fixtures = show.fixtures || [];
    if (!rect || fixtures.length === 0) {
      applyGridView({ zoom: 1, panX: 0, panY: 0 });
      return;
    }

    const fixturePositions = gridMode === 1
      ? (() => { const layout = computeGroupedLayout(mode2Positions, mode2TitleOffsets, mode2Layout); return fixtures.map(f => layout.positions[f.id] || { x: 0, y: 0 }); })()
      : fixtures.map(getFixtureGridPosition);
    const minX = Math.min(...fixturePositions.map(pos => pos.x));
    const minY = Math.min(...fixturePositions.map(pos => pos.y));
    const maxX = Math.max(...fixturePositions.map(pos => pos.x + GRID));
    const maxY = Math.max(...fixturePositions.map(pos => pos.y + GRID));
    const contentWidth = Math.max(GRID, maxX - minX);
    const contentHeight = Math.max(GRID, maxY - minY);
    const padding = GRID * 2;
    const fitZoom = Math.min(
      1,
      4,
      Math.max(
        0.3,
        Math.min(
          rect.width / (contentWidth + padding),
          rect.height / (contentHeight + padding)
        )
      )
    );

    applyGridView({
      zoom: fitZoom,
      panX: (rect.width - contentWidth * fitZoom) / 2 - minX * fitZoom,
      panY: (rect.height - contentHeight * fitZoom) / 2 - minY * fitZoom,
    });
  }

  // Restaura configurações do Mode 2 quando o show é carregado do disco
  const mode2LoadedIdRef = useRef(null);
  useEffect(() => {
    if (!show.mode2) return;
    const id = JSON.stringify(show.mode2);
    if (id === mode2LoadedIdRef.current) return;
    mode2LoadedIdRef.current = id;
    setMode2Positions(show.mode2.positions || {});
    setMode2TitleOffsets(show.mode2.titleOffsets || {});
    if (show.mode2.layout) setMode2Layout(show.mode2.layout);
    // Restaura o modo ativo (Mode 1 ou Mode 2) salvo no último Salvar
    if (typeof show.mode2.gridMode === 'number') setGridMode(show.mode2.gridMode);
    if (show.mode2.channelOrderMode) setChannelOrderMode(show.mode2.channelOrderMode);
    if (show.mode2.channelPrefOrder) setChannelPrefOrder(show.mode2.channelPrefOrder);
  }, [show.mode2]);

  // Ao voltar ao Mode 0, desativa o ajuste de layout do Mode 2.
  // O viewport é restaurado/ajustado pelo efeito [show, gridMode] acima.
  useEffect(() => {
    if (gridMode === 0) setLayoutAdjustActive(false);
  }, [gridMode]);

  const groupedLayout = gridMode === 1 ? computeGroupedLayout(mode2Positions, mode2TitleOffsets, mode2Layout) : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'#1d2b30', color:'#ffffff', fontFamily:'Arial, Helvetica, sans-serif' }}>
      <style>{`
        @keyframes blink-border {
          0%, 100% { box-shadow: 0 0 0 1px #ff4444; }
          50%       { box-shadow: none; }
        }
      `}</style>

      {/* TOPO */}
      <div style={{ display:'flex', alignItems:'center', gap:4, padding:'0 8px', background:'#24343a', color:'#ffffff', borderBottom:'1px solid #8db8b8', boxShadow:'none', minHeight:48 }}>
        <span style={{ fontWeight:700, fontSize:16, color:'#ffffff', letterSpacing:'1.5px', marginRight:8 }}>VP·LIGHT</span>
        <TopBtn onClick={handleSave}>Salvar</TopBtn>
        <TopBtn onClick={loadShow}>Abrir</TopBtn>
        <TopBtn onClick={onOpenFixtures}>Aparelhos</TopBtn>
        <TopBtn onClick={onOpenPainel}>Painel de Operação</TopBtn>
        <TopBtn onClick={() => setTestPanelOpen(true)} disabled={!selectedFixture}>Painel de Teste</TopBtn>
        <div style={{ flex:1 }} />
        {conflicts.length > 0 && !conflictAcknowledged && (
          <TopBtn onClick={() => setConflictModalOpen(true)} danger active>
            ⚠ {conflicts.length} conflito{conflicts.length !== 1 ? 's' : ''}
          </TopBtn>
        )}
        <TopBtn onClick={handleOpen3DViewer} active={viewer3DActive}>
          {viewer3DActive ? '3D (aberto)' : '3D'}
        </TopBtn>
        <TopBtn onClick={handleToggleArtNetFreeze} active={artNetFrozen} danger={artNetFrozen} title="Congela o envio Art-Net para o palco. O viewer 3D continua funcionando normalmente.">
          {artNetFrozen ? '❄ PALCO CONGELADO' : '❄ CONGELAR PALCO'}
        </TopBtn>
        <TopBtn onClick={handleDeselectScene} active={activeScenes.length === 0} title="Desmarcar cena (Q)">
          SEM CENA
        </TopBtn>
        <TopBtn onClick={handleBlackout} danger active={blackoutActive}>
          {blackoutActive ? 'BLACKOUT ON' : 'BLACKOUT'}
        </TopBtn>
      </div>

      {/* CORPO */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', background:'#000000' }}>

        {/* MESA DE APARELHOS */}
        <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', background:'#000000', color:'#ffffff', borderRight:'1px solid #8db8b8' }}>
          <div style={{ padding:'3px 6px', fontSize:11, color:'#c8dddd', background:'#24343a', borderBottom:'1px solid #5f8588' }}>Aparelhos</div>
          <div
            ref={mesaRef}
            onClick={() => setSelectedFixtureId(null)}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                const rect = e.currentTarget.getBoundingClientRect();
                const wx = (e.clientX - rect.left - view.panX) / view.zoom;
                const wy = (e.clientY - rect.top - view.panY) / view.zoom;
                setSelection({ startX: wx, startY: wy, endX: wx, endY: wy });
                setMultiSelected([]);
              }
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const wx = (e.clientX - rect.left - view.panX) / view.zoom;
              const wy = (e.clientY - rect.top - view.panY) / view.zoom;
              // Drag de grupo inteiro no Mode 2 (arraste pelo título)
              if (dragging?.isGroupDrag) {
                const snapX = Math.round((wx - dragging.offX) / GRID) * GRID;
                const snapY = Math.round((wy - dragging.offY) / GRID) * GRID;
                // newDx = offset correto a partir da posição BASE (sem offset anterior)
                const newDx = snapX - dragging.baseTitleX;
                const newDy = snapY - dragging.baseTitleY;
                // moveDx = quanto os fixtures devem mover em relação à posição no início do drag
                const moveDx = newDx - dragging.prevOffsetDx;
                const moveDy = newDy - dragging.prevOffsetDy;
                setMode2TitleOffsets(prev => ({ ...prev, [dragging.groupKey]: { dx: newDx, dy: newDy } }));
                setMode2Positions(prev => {
                  const next = { ...prev };
                  dragging.fixtures.forEach(item => { next[item.id] = { x: item.x + moveDx, y: item.y + moveDy }; });
                  return next;
                });
                return;
              }
              // Drag individual de fixture no Mode 2 (ajuste ativo)
              if (dragging?.isMode2FixtureDrag) {
                const snapX = Math.round((wx - dragging.offX) / GRID) * GRID;
                const snapY = Math.round((wy - dragging.offY) / GRID) * GRID;
                setMode2Positions(prev => ({ ...prev, [dragging.id]: { x: snapX, y: snapY } }));
                return;
              }
              if (dragging) {
                const rawX = wx - dragging.offX;
                const rawY = wy - dragging.offY;
                // snap: encaixa o aparelho de quadradinho em quadradinho
                const snapX = Math.round(rawX / GRID) * GRID;
                const snapY = Math.round(rawY / GRID) * GRID;
                const deltaX = snapX - dragging.origin.x;
                const deltaY = snapY - dragging.origin.y;
                const movingIds = new Set(dragging.ids);
                const nextPositions = dragging.fixtures.map(item => ({
                  id: item.id,
                  posX: Math.round((item.x + deltaX) / GRID) * GRID,
                  posY: Math.round((item.y + deltaY) / GRID) * GRID,
                }));
                // colisão: 1 aparelho por quadrado — não deixa entrar onde já existe outro
                const overlaps = nextPositions.some(pos => show.fixtures.some(o => {
                  if (movingIds.has(o.id)) return false;
                  if (!isFixtureEnabled(o)) return false;
                  const { x: ox, y: oy } = getFixtureGridPosition(o);
                  return pos.posX < ox + GRID && pos.posX + GRID > ox
                      && pos.posY < oy + GRID && pos.posY + GRID > oy;
                }));
                if (!overlaps) {
                  nextPositions.forEach(pos => updateFixture(pos.id, { posX: pos.posX, posY: pos.posY }));
                }
                return;
              }
              if (selection) {
                setSelection(prev => ({ ...prev, endX: wx, endY: wy }));
              }
            }}
            onMouseUp={() => {
              if (selection) {
                const minX = Math.min(selection.startX, selection.endX);
                const maxX = Math.max(selection.startX, selection.endX);
                const minY = Math.min(selection.startY, selection.endY);
                const maxY = Math.max(selection.startY, selection.endY);
                const layout = gridMode === 1 ? groupedLayout : null;
                const selected = show.fixtures.filter(f => {
                  if (!isFixtureEnabled(f)) return false;
                  const { x, y } = layout ? (layout.positions[f.id] || { x: 0, y: 0 }) : getFixtureGridPosition(f);
                  return x + GRID > minX && x < maxX && y + GRID > minY && y < maxY;
                }).map(f => f.id);
                setMultiSelected(selected);
                setSelection(null);
              }
              setDragging(null);
            }}
            onMouseLeave={() => { setDragging(null); setSelection(null); }}
            style={{
              flex:1, position:'relative', overflow:'hidden', background:'#000000', color:'#ffffff',
              borderTop:'1px solid #5f8588', borderBottom:'1px solid #5f8588',
              // grade: aparece só ao arrastar; escala e desloca junto com o zoom/pan
              backgroundImage: dragging
                ? `linear-gradient(to right, ${theme.colors.gridMesh} 1px, transparent 1px), linear-gradient(to bottom, ${theme.colors.gridMesh} 1px, transparent 1px)`
                : 'none',
              backgroundSize: `${GRID * view.zoom}px ${GRID * view.zoom}px`,
              backgroundPosition: `${view.panX}px ${view.panY}px`,
            }}
          >
            {show.fixtures.length === 0 && (
              <div style={{ color:'#9bb4b7', fontSize:12, padding:16, position:'absolute' }}>Nenhum aparelho. Clique em "Aparelhos" para adicionar.</div>
            )}

            {/* MUNDO — recebe o zoom/pan; aparelhos e seleção escalam juntos */}
            <div style={{ position:'absolute', top:0, left:0, width:0, height:0, transformOrigin:'0 0', transform:`translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})` }}>
              {/* Títulos de grupo (visíveis apenas no modo agrupado) */}
              {groupedLayout && groupedLayout.titles.map(t => (
                <div
                  key={t.name}
                  onMouseDown={layoutAdjustActive ? (e => {
                    e.stopPropagation();
                    const rect = mesaRef.current.getBoundingClientRect();
                    const wx = (e.clientX - rect.left - view.panX) / view.zoom;
                    const wy = (e.clientY - rect.top - view.panY) / view.zoom;
                    const groupFixtures = (show.fixtures || [])
                      .filter(f => isFixtureEnabled(f) && String(f.group || f.fixtureType || 'Outros') === t.groupKey)
                      .map(f => ({ id: f.id, ...(groupedLayout.positions[f.id] || { x: 0, y: 0 }) }));
                    // prevOffset = offset que já estava aplicado quando o drag começou
                    const prevOff = mode2TitleOffsets[t.groupKey] || { dx: 0, dy: 0 };
                    setDragging({
                      isGroupDrag: true,
                      groupKey: t.groupKey,
                      // baseTitle = posição sem nenhum offset (para calcular novo offset corretamente)
                      baseTitleX: t.x - prevOff.dx,
                      baseTitleY: t.y - prevOff.dy,
                      prevOffsetDx: prevOff.dx,
                      prevOffsetDy: prevOff.dy,
                      fixtures: groupFixtures,
                      offX: wx - t.x,
                      offY: wy - t.y,
                    });
                  }) : undefined}
                  onClick={e => {
                    if (layoutAdjustActive) return; // no adjust mode, click selects only after drag
                    e.stopPropagation();
                    const ids = (show.fixtures || [])
                      .filter(f => isFixtureEnabled(f) && String(f.group || f.fixtureType || 'Outros') === t.groupKey)
                      .map(f => f.id);
                    if (ids.length === 0) return;
                    setMultiSelected(ids);
                    setSelectedFixtureId(ids[ids.length - 1]);
                  }}
                  style={{
                    position:'absolute',
                    left: t.x,
                    top: t.y,
                    height: GRID,
                    minWidth: GRID * 4,
                    display:'flex',
                    alignItems:'center',
                    paddingLeft: 4,
                    fontFamily:'Arial, Helvetica, sans-serif',
                    fontSize: 9,
                    fontWeight: 700,
                    color: t.color,
                    borderBottom: `1px solid ${t.color}`,
                    opacity: layoutAdjustActive ? 1 : 0.85,
                    cursor: layoutAdjustActive ? (dragging?.isGroupDrag && dragging?.groupKey === t.groupKey ? 'grabbing' : 'grab') : 'pointer',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    boxShadow: layoutAdjustActive ? `0 0 0 1px ${t.color}44` : 'none',
                  }}
                >
                  {t.name}
                </div>
              ))}
              {show.fixtures.map(f => {
                const fixtureEnabled = isFixtureEnabled(f);
                const isSelected = fixtureEnabled && (f.id === selectedFixtureId || multiSelected.includes(f.id));
                // Fixture selecionado: mescla snapshot + liveValues para feedback em tempo real do fader.
                // Fixture não selecionado: usa apenas o snapshot do universo — preserva a cor ao desmarcar.
                const colorSource = isSelected ? { ...universeSnapshot, ...liveValues } : universeSnapshot;
                const liveColor = fixtureEnabled ? getFixtureLiveColor(f, colorSource) : null;
                const fPos = gridMode === 1
                  ? (groupedLayout?.positions?.[f.id] || { x: 0, y: 0 })
                  : getFixtureGridPosition(f);
                return (
                <div
                  key={f.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (!fixtureEnabled) return;
                    if (gridMode === 1) {
                      if (!layoutAdjustActive) {
                        setSelectedFixtureId(f.id);
                        return;
                      }
                      // Mode 2 com ajuste ativo: permite arrastar fixture individual
                      const rect2 = mesaRef.current.getBoundingClientRect();
                      const wx2 = (e.clientX - rect2.left - view.panX) / view.zoom;
                      const wy2 = (e.clientY - rect2.top - view.panY) / view.zoom;
                      const pos2 = mode2Positions[f.id] || fPos;
                      setDragging({
                        isMode2FixtureDrag: true,
                        id: f.id,
                        ids: [f.id],
                        offX: wx2 - pos2.x,
                        offY: wy2 - pos2.y,
                      });
                      return;
                    }
                    const rect = mesaRef.current.getBoundingClientRect();
                    const wx = (e.clientX - rect.left - view.panX) / view.zoom;
                    const wy = (e.clientY - rect.top - view.panY) / view.zoom;
                    const draggingIds = multiSelected.includes(f.id) ? multiSelected : [f.id];
                    const draggingFixtures = show.fixtures
                      .filter(item => draggingIds.includes(item.id) && isFixtureEnabled(item))
                      .map(item => ({ id: item.id, ...getFixtureGridPosition(item) }));
                    const origin = getFixtureGridPosition(f);
                    setDragging({
                      id: f.id,
                      ids: draggingIds,
                      origin,
                      fixtures: draggingFixtures,
                      offX: wx - origin.x,
                      offY: wy - origin.y,
                    });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!fixtureEnabled) return;
                    setMultiSelected(prev =>
                      prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                    );
                    setSelectedFixtureId(f.id);
                  }}
                  style={{
                    position:'absolute',
                    left: fPos.x,
                    top: fPos.y,
                    width:GRID, height:GRID,
                    boxSizing:'border-box',
                    background: liveColor ?? (fixtureEnabled ? '#233237' : '#1d2b30'),
                    color:'#ffffff',
                    border: fixtureEnabled ? (isSelected ? '2px solid #b7dede' : '1px solid #5f8588') : '1px dashed #6f8588',
                    opacity: fixtureEnabled ? 1 : 0.42,
                    borderRadius:0, boxShadow:'none', cursor: fixtureEnabled ? (gridMode === 1 ? (layoutAdjustActive ? (dragging?.ids?.includes(f.id) ? 'grabbing' : 'grab') : 'pointer') : (dragging?.ids?.includes(f.id) ? 'grabbing' : 'grab')) : 'default',
                    display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center', gap:1,
                    userSelect:'none', overflow:'hidden',
                  }}
                >
                  <div style={{ fontSize:7, color:'#9bb4b7', lineHeight:1 }}>{fixtureEnabled ? `ch ${f.startChannel}` : `OFF ch ${f.startChannel}`}</div>
                  <div
                    title={f.name}
                    style={{
                      fontSize:7,
                      fontWeight:700,
                      color:'#ffffff',
                      textAlign:'center',
                      lineHeight:1.05,
                      padding:'0 2px',
                      overflow:'hidden',
                      maxWidth:GRID - 4,
                      maxHeight:30,
                      whiteSpace:'normal',
                      overflowWrap:'anywhere',
                      wordBreak:'normal',
                    }}
                  >
                    {getFixtureDisplayName(f.name)}
                  </div>
                </div>
                );
              })}
              {selection && (
                <div style={{
                  position:'absolute', pointerEvents:'none',
                  left: Math.min(selection.startX, selection.endX),
                  top: Math.min(selection.startY, selection.endY),
                  width: Math.abs(selection.endX - selection.startX),
                  height: Math.abs(selection.endY - selection.startY),
                  border:'1px solid #888',
                  background:'rgba(255,255,255,0.05)',
                }} />
              )}
            </div>
          </div>
        </div>

        {/* PAINEL DIREITO: CHAT / DESCRIÃ‡ÃƒO */}
        <div style={{ width:rightPanelWidth, minWidth:RIGHT_PANEL_MIN_WIDTH, maxWidth:RIGHT_PANEL_MAX_WIDTH, position:'relative', display:'flex', flexDirection:'column', background:'#35484f', color:'#ffffff', borderLeft:'1px solid #8db8b8', boxShadow:'none', overflow:'hidden', fontFamily:'Arial, Helvetica, sans-serif' }}>
          <div
            onPointerDown={handleRightPanelResizeStart}
            style={{
              position:'absolute',
              top:0,
              bottom:0,
              left:0,
              width:7,
              zIndex:5,
              cursor:'col-resize',
              background:rightPanelResize ? 'rgba(183,222,222,.18)' : 'transparent',
              borderLeft:rightPanelResize ? '1px solid #b7dede' : '1px solid transparent',
            }}
          />
          <div style={{ display:'flex', height:28, minHeight:28, background:'#24343a', borderBottom:'1px solid #8db8b8' }}>
            <button
              onClick={() => setRightPanelTab('chat')}
              style={{
                flex:1,
                textAlign:'center',
                height:28,
                minHeight:28,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                padding:'0 8px',
                background: rightPanelTab === 'chat' ? '#35484f' : '#24343a',
                color: rightPanelTab === 'chat' ? '#ffffff' : '#c8dddd',
                borderLeft: rightPanelTab === 'chat' ? '1px solid #8db8b8' : '1px solid #5f8588',
                borderRight: rightPanelTab === 'chat' ? '1px solid #8db8b8' : '1px solid #5f8588',
                borderTop: rightPanelTab === 'chat' ? '1px solid #8db8b8' : '1px solid #5f8588',
                borderBottom: rightPanelTab === 'chat' ? 'none' : '1px solid #8db8b8',
                borderRadius:0,
                outline:'none',
                boxShadow:'none',
                fontFamily:'Arial, Helvetica, sans-serif',
                fontSize:12,
                fontWeight:700,
                whiteSpace:'nowrap',
                overflow:'hidden',
                textOverflow:'clip',
                cursor:'pointer',
              }}
            >
              Chat
            </button>
            <button
              onClick={() => setRightPanelTab('description')}
              style={{
                flex:1,
                textAlign:'center',
                height:28,
                minHeight:28,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                padding:'0 8px',
                background: rightPanelTab === 'description' ? '#35484f' : '#24343a',
                color: rightPanelTab === 'description' ? '#ffffff' : '#c8dddd',
                borderLeft: rightPanelTab === 'description' ? '1px solid #8db8b8' : '1px solid #5f8588',
                borderRight: rightPanelTab === 'description' ? '1px solid #8db8b8' : '1px solid #5f8588',
                borderTop: rightPanelTab === 'description' ? '1px solid #8db8b8' : '1px solid #5f8588',
                borderBottom: rightPanelTab === 'description' ? 'none' : '1px solid #8db8b8',
                borderRadius:0,
                outline:'none',
                boxShadow:'none',
                fontFamily:'Arial, Helvetica, sans-serif',
                fontSize:12,
                fontWeight:700,
                whiteSpace:'nowrap',
                overflow:'hidden',
                textOverflow:'clip',
                cursor:'pointer',
              }}
            >
              Descrição
            </button>
          </div>
          <div style={{ flex:1, display:'flex', background:'#35484f', overflow:'hidden' }}>
            <div style={{ width:40, minWidth:40, maxWidth:40, background:'#24343a', borderRight:'1px solid #8db8b8', display:'flex', flexDirection:'column', alignItems:'stretch', justifyContent:'flex-start', padding:2, gap:2 }}>
              {[
                ['Z+', 44],
                ['Z-', 44],
                ['ZFit', 70, handleFitFixtures],
                ['BO', 92],
                ['freeZe', 78],
                ['mode', 78, () => { setGridMode(m => m === 0 ? 1 : 0); }, gridMode === 1],
                ...(gridMode === 1 ? [
                  ['ajuste', 78, () => setLayoutAdjustActive(a => !a), layoutAdjustActive, layoutAdjustActive ? '#ff9500' : undefined],
                  [mode2Layout === 'grade' ? 'GRADE' : 'PADRÃO', 78, () => setMode2Layout(l => l === 'padrao' ? 'grade' : 'padrao'), mode2Layout === 'grade'],
                ] : []),
              ].map(([label, height, onClick, isActive, accentColor]) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  style={{
                    width:'100%',
                    height,
                    background: isActive ? (accentColor ? accentColor + '33' : theme.colors.selection) : '#24343a',
                    color: isActive ? (accentColor || theme.colors.accent) : '#ffffff',
                    border: isActive ? `1px solid ${accentColor || theme.colors.borderStrong}` : '1px solid #8db8b8',
                    borderRadius:0,
                    fontFamily:'Arial, Helvetica, sans-serif',
                    fontSize:10,
                    fontWeight:700,
                    lineHeight:1,
                    textAlign:'center',
                    outline:'none',
                    boxShadow:'none',
                    cursor:onClick ? 'pointer' : 'default',
                    padding:0,
                    margin:0,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ flex:1, background:'#35484f', color:'#ffffff', overflow:'auto', position:'relative' }}>
              {rightPanelTab === 'chat' && <ChatPanel />}
              {rightPanelTab === 'description' && multiSelected.length >= 2 && (() => {
                // Painel agrupado: agrupa canais por label entre os fixtures selecionados.
                // Canais com mesmo label em 2+ fixtures → fader único que afeta todos.
                // Label único ou sem label → fader individual do último fixture clicado.
                // Funções personalizadas (ex: ALL ON) aparecem quando todos os fixtures
                // selecionados são do mesmo tipo e esse tipo tem funções registradas.
                const selFixtures = show.fixtures.filter(f => multiSelected.includes(f.id) && isFixtureEnabled(f));
                const lastFx = selFixtures.find(f => f.id === selectedFixtureId) || selFixtures[selFixtures.length - 1];
                if (!lastFx) return null;

                // Funções personalizadas compartilhadas — só exibe se todos do mesmo tipo
                const allSameType = selFixtures.every(f => getFixtureType(f) === getFixtureType(lastFx));
                const sharedFunctions = allSameType ? getFixtureCustomFunctions(lastFx) : [];
                const storedMultiFn = sharedFunctions.length > 0 ? activeCustomFunctionByFixture[lastFx.id] : null;
                const hasActiveSpeedMulti = sharedFunctions.some(fn => fn.type === 'speed_selector') && (speedMultiplierByFixture[lastFx.id] ?? 1) !== 1;
                const activeMultiFn = sharedFunctions.some(fn => fn.id === storedMultiFn) ? storedMultiFn : (hasActiveSpeedMulti ? 'speed_multiplier' : null);
                const multiMenuOpen = customFunctionMenuFixtureId === 'multi';

                // ALL ON para multi-seleção
                const ribaltaAllOnMulti = activeMultiFn === 'ribalta_all_on';
                const allLedChannels = ribaltaAllOnMulti
                  ? selFixtures.flatMap(fx => filterDisabledFixtureChannelList(getRibaltaLedChannels(fx), disabledFixtureChannels))
                  : [];
                const allOnMasterValueMulti = allLedChannels.length
                  ? Math.max(...allLedChannels.map(ch => universeSnapshot[ch] ?? 0))
                  : 0;

                // Mapeia label → [{fixture, dmxCh}] para todos os fixtures selecionados
                const labelMap = {};
                selFixtures.forEach(fx => {
                  const count = fx.channelCount ?? (fx.channels || []).length;
                  for (let i = 0; i < count; i++) {
                    const rawLbl = (fx.channels && fx.channels[i]) || '';
                    const lbl = getRightPanelChannelLabel(fx, rawLbl);
                    if (!lbl) continue;
                    if (!labelMap[lbl]) labelMap[lbl] = [];
                    labelMap[lbl].push({ fixture: fx, dmxCh: (fx.startChannel || 1) + i });
                  }
                });

                // Constrói as linhas usando a ordem de canais do último fixture
                const lastCount = lastFx.channelCount ?? (lastFx.channels || []).length;
                const rows = [];
                const renderedGroupedLabels = new Set();
                for (let i = 0; i < lastCount; i++) {
                  const rawLbl = (lastFx.channels && lastFx.channels[i]) || '';
                  const lbl = getRightPanelChannelLabel(lastFx, rawLbl);
                  const dmxCh = (lastFx.startChannel || 1) + i;
                  if (lbl && labelMap[lbl] && labelMap[lbl].length > 1) {
                    if (renderedGroupedLabels.has(lbl)) continue;
                    renderedGroupedLabels.add(lbl);
                    rows.push({ grouped: true, label: lbl, entries: labelMap[lbl], dmxCh });
                  } else {
                    rows.push({ grouped: false, label: lbl || `Canal ${i + 1}`, entries: [{ fixture: lastFx, dmxCh }], dmxCh });
                  }
                }

                // Aplicar ordenação 'pref' também no modo de multi-seleção
                try {
                  const fxTypeMultiOrder = getFixtureType(lastFx);
                  const orderModeMulti = channelOrderMode[fxTypeMultiOrder] ?? 'canal';
                  if (orderModeMulti === 'pref') {
                    const prefOrder = channelPrefOrder[fxTypeMultiOrder] || DEFAULT_CHANNEL_PREF_ORDER[fxTypeMultiOrder] || [];
                    rows.sort((r1, r2) => {
                      const a = r1.label || '';
                      const b = r2.label || '';
                      const ai = prefOrder.indexOf(a);
                      const bi = prefOrder.indexOf(b);
                      const va = ai === -1 ? 9999 : ai;
                      const vb = bi === -1 ? 9999 : bi;
                      return va - vb;
                    });
                  }
                } catch (e) {
                  // não bloquear render em caso de erro inesperado
                }

                return (
                  <div style={{ paddingTop: 8 }}>
                    <div style={{ position:'relative' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', marginBottom:8, background:theme.colors.panelDark, borderTop:`1px solid ${theme.colors.borderSoft}`, borderBottom:`1px solid ${theme.colors.borderSoft}` }}>
                      {sharedFunctions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCustomFunctionMenuFixtureId(prev => prev === 'multi' ? null : 'multi')}
                          style={{
                            order:2, minWidth:142, maxWidth:142, height:24, padding:'0 8px',
                            background: activeMultiFn ? '#7c4a00' : theme.colors.bgDarker,
                            color: theme.colors.text,
                            border:`1px solid ${activeMultiFn ? '#ff9500' : theme.colors.border}`,
                            borderRadius:0, boxSizing:'border-box',
                            fontFamily:theme.typography.fontFamily, fontSize:10, fontWeight:700, lineHeight:1,
                            display:'flex', alignItems:'center', justifyContent:'center',
                            cursor:'pointer', boxShadow:'none', outline:'none',
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'clip',
                          }}
                        >
                          Funções personalizadas
                        </button>
                      )}
                      <span style={{ order:1, minWidth:0, flex:1, fontFamily:theme.typography.fontFamily, fontSize:13, fontWeight:700, color:theme.colors.text }}>
                        {selFixtures.length} aparelhos selecionados
                      </span>
                      <button
                        type="button"
                        onClick={handleZeroSelectedFixtureChannels}
                        title="Zerar canais dos aparelhos selecionados"
                        style={{
                          order:3,
                          width:58,
                          height:24,
                          padding:'0 6px',
                          background:theme.colors.bgDarker,
                          color:theme.colors.text,
                          border:`1px solid ${theme.colors.warn}`,
                          borderRadius:theme.radius.none,
                          boxSizing:'border-box',
                          fontFamily:theme.typography.fontFamily,
                          fontSize:10,
                          fontWeight:700,
                          lineHeight:1,
                          cursor:'pointer',
                          boxShadow:'none',
                          outline:'none',
                        }}
                      >
                        Zerar
                      </button>
                    </div>

                    {multiMenuOpen && sharedFunctions.length > 0 && (
                      <div style={{ position:'absolute', top:'100%', left:8, right:8, zIndex:20, border:`1px solid ${theme.colors.borderSoft}`, background:theme.colors.panelDark, boxShadow:'0 4px 12px rgba(0,0,0,0.5)' }}>
                        {sharedFunctions.map(fn => {
                          if (fn.type === 'speed_selector') {
                            const currentMult = speedMultiplierByFixture[lastFx.id] ?? 1;
                            return (
                              <div key={fn.id} style={{ borderBottom:`1px solid ${theme.colors.borderSoft}`, background:theme.colors.bgDarker }}>
                                <div style={{ height:34, display:'flex', alignItems:'center', padding:'0 8px', gap:6 }}>
                                  <span style={{ fontFamily:theme.typography.fontFamily, fontSize:11, fontWeight:700, color:theme.colors.text, flex:1 }}>SPEED</span>
                                  <div style={{ display:'flex', gap:3 }}>
                                    {SPEED_OPTIONS.map(opt => {
                                      const isActive = currentMult === opt.value;
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => setSpeedMultiplierForFixtures(selFixtures, opt.value)}
                                          style={{
                                            width:34, height:22, padding:0,
                                            background: isActive ? theme.colors.selection : theme.colors.panel,
                                            color: theme.colors.text,
                                            border:`1px solid ${isActive ? theme.colors.borderStrong : theme.colors.border}`,
                                            borderRadius:0, boxSizing:'border-box',
                                            fontFamily:theme.typography.fontFamily, fontSize:10, fontWeight:700,
                                            cursor:'pointer', outline:'none',
                                          }}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          if (fn.type === 'filtro_selector') {
                            const fxTypeMulti = getFixtureType(lastFx);
                            const currentModeMulti = channelOrderMode[fxTypeMulti] ?? 'canal';
                            return (
                              <div key={fn.id} style={{ borderBottom:`1px solid ${theme.colors.borderSoft}`, background:theme.colors.bgDarker }}>
                                <div style={{ height:34, display:'flex', alignItems:'center', padding:'0 8px', gap:6 }}>
                                  <span style={{ fontFamily:theme.typography.fontFamily, fontSize:11, fontWeight:700, color:theme.colors.text, flex:1 }}>FILTRO</span>
                                  <div style={{ display:'flex', gap:3 }}>
                                    {[{ value:'canal', label:'CANAL' }, { value:'pref', label:'PREF' }].map(opt => {
                                      const isActive = currentModeMulti === opt.value;
                                      return (
                                        <button key={opt.value} type="button"
                                          onClick={() => setChannelOrderMode(prev => ({ ...prev, [fxTypeMulti]: opt.value }))}
                                          style={{ width:46, height:22, padding:0, background: isActive ? theme.colors.selection : theme.colors.panel, color: theme.colors.text, border:`1px solid ${isActive ? theme.colors.borderStrong : theme.colors.border}`, borderRadius:0, boxSizing:'border-box', fontFamily:theme.typography.fontFamily, fontSize:10, fontWeight:700, cursor:'pointer', outline:'none' }}>
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          const active = activeMultiFn === fn.id;
                          return (
                            <button
                              key={fn.id}
                              type="button"
                              onClick={() => {
                                setActiveCustomFunctionByFixture(prev => {
                                  const next = { ...prev };
                                  const allActive = selFixtures.every(f => next[f.id] === fn.id);
                                  selFixtures.forEach(f => { if (allActive) delete next[f.id]; else next[f.id] = fn.id; });
                                  return next;
                                });
                                setCustomFunctionMenuFixtureId(null);
                              }}
                              style={{
                                width:'100%', height:30, padding:'0 8px',
                                background: active ? theme.colors.selection : theme.colors.bgDarker,
                                color: theme.colors.text, border:'none',
                                borderLeft:`3px solid ${active ? theme.colors.borderStrong : theme.colors.bgDarker}`,
                                borderBottom:`1px solid ${theme.colors.borderSoft}`,
                                borderRadius:0, boxSizing:'border-box',
                                fontFamily:theme.typography.fontFamily, fontSize:12, fontWeight:700,
                                textAlign:'left', cursor:'pointer', outline:'none',
                                display:'flex', alignItems:'center',
                              }}
                            >
                              {fn.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    </div>{/* end position:relative wrapper */}

                    {rows.map((row, idx) => {
                      const normalizedLbl = String(row.label || '').toLowerCase();
                      const maskedByAllOn = ribaltaAllOnMulti && /^led_?[2-8]$/.test(normalizedLbl);
                      if (maskedByAllOn) return null;
                      const isAllOnMaster = ribaltaAllOnMulti && /^led_?1$/.test(normalizedLbl);
                      const val = isAllOnMaster ? allOnMasterValueMulti : (universeSnapshot[row.dmxCh] ?? 0);
                      return (
                        <div key={idx} style={{ marginBottom:10, padding:'0 8px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                            <span style={{ display:'flex', gap:4, alignItems:'center', minWidth:0 }}>
                              {row.grouped && !isAllOnMaster && (
                                <span style={{ fontFamily:'Arial, Helvetica, sans-serif', fontSize:9, color:theme.colors.accent, fontWeight:700, flexShrink:0 }}>×{row.entries.length}</span>
                              )}
                              <span style={{ fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, color:'#c8dddd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {isAllOnMaster ? `${row.label} / ALL ON` : row.label}
                              </span>
                            </span>
                            <span style={{ fontFamily:theme.typography.fontFamily, fontSize:theme.typography.sliderThumb.fontSize, fontWeight:theme.typography.sliderThumb.fontWeight, color:theme.colors.primary, minWidth:28, textAlign:'right' }}>{val}</span>
                          </div>
                          <input
                            type="range" min={0} max={255} value={val}
                            onChange={e => {
                              if (isAllOnMaster) handleRibaltaAllOnFaderMulti(selFixtures, e.target.value);
                              else if (row.grouped) handleGroupedFader(row.entries, e.target.value);
                              else handleFader(row.dmxCh, e.target.value);
                            }}
                            style={{ width:'100%', accentColor:theme.colors.primary, cursor:'pointer', height:4 }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {rightPanelTab === 'description' && multiSelected.length < 2 && selectedFixture && (() => {
                const fixtureChannels = getFixtureDmxChannels(selectedFixture);
                const fixtureFunctions = getFixtureCustomFunctions(selectedFixture);
                const storedCustomFunction = activeCustomFunctionByFixture[selectedFixture.id];
                const hasActiveSpeedSingle = fixtureFunctions.some(fn => fn.type === 'speed_selector') && (speedMultiplierByFixture[selectedFixture.id] ?? 1) !== 1;
                const activeCustomFunction = fixtureFunctions.some(fn => fn.id === storedCustomFunction) ? storedCustomFunction : (hasActiveSpeedSingle ? 'speed_multiplier' : null);
                const customFunctionMenuOpen = customFunctionMenuFixtureId === selectedFixture.id;
                const ribaltaAllOnActive = isRibaltaAllOnActive(selectedFixture);
                const ribaltaLedChannels = getRibaltaLedChannels(selectedFixture);
                const ribaltaAllOnValue = ribaltaLedChannels.length
                  ? Math.max(...ribaltaLedChannels.map(channel => liveValues[channel] ?? 0))
                  : 0;
                return (
                  <div style={{ paddingTop:8 }}>
                    <div style={{ position:'relative' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', marginBottom:8, background:theme.colors.panelDark, borderTop:`1px solid ${theme.colors.borderSoft}`, borderBottom:`1px solid ${theme.colors.borderSoft}` }}>
                      <button
                        type="button"
                        onClick={() => toggleCustomFunctionMenu(selectedFixture.id)}
                        title="Funções personalizadas"
                        style={{
                          order:2,
                          minWidth:142,
                          maxWidth:142,
                          height:24,
                          padding:'0 8px',
                          background:activeCustomFunction ? '#7c4a00' : theme.colors.bgDarker,
                          color:theme.colors.text,
                          border:`1px solid ${activeCustomFunction ? '#ff9500' : theme.colors.border}`,
                          borderRadius:0,
                          boxSizing:'border-box',
                          fontFamily:theme.typography.fontFamily,
                          fontSize:10,
                          fontWeight:700,
                          lineHeight:1,
                          display:'flex',
                          alignItems:'center',
                          justifyContent:'center',
                          cursor:'pointer',
                          boxShadow:'none',
                          outline:'none',
                          whiteSpace:'nowrap',
                          overflow:'hidden',
                          textOverflow:'clip',
                        }}
                      >
                        Funções personalizadas
                      </button>
                      <span style={{ order:1, minWidth:0, flex:1, fontFamily:theme.typography.fontFamily, fontSize:13, fontWeight:700, color:theme.colors.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {selectedFixture.name}
                      </span>
                      <button
                        type="button"
                        onClick={handleZeroSelectedFixtureChannels}
                        title="Zerar canais do aparelho"
                        style={{
                          order:3,
                          width:58,
                          height:24,
                          padding:'0 6px',
                          background:theme.colors.bgDarker,
                          color:theme.colors.text,
                          border:`1px solid ${theme.colors.warn}`,
                          borderRadius:theme.radius.none,
                          boxSizing:'border-box',
                          fontFamily:theme.typography.fontFamily,
                          fontSize:10,
                          fontWeight:700,
                          lineHeight:1,
                          cursor:'pointer',
                          boxShadow:'none',
                          outline:'none',
                        }}
                      >
                        Zerar
                      </button>
                    </div>

                    {customFunctionMenuOpen && (
                      <div style={{ position:'absolute', top:'100%', left:8, right:8, zIndex:20, border:`1px solid ${theme.colors.borderSoft}`, background:theme.colors.panelDark, boxShadow:'0 4px 12px rgba(0,0,0,0.5)' }}>
                        {fixtureFunctions.length === 0 && (
                          <div style={{ minHeight:28, display:'flex', alignItems:'center', padding:'0 8px', fontFamily:theme.typography.fontFamily, fontSize:11, color:theme.colors.textMuted, background:theme.colors.bgDarker }}>
                            Nenhuma função para este tipo
                          </div>
                        )}
                        {fixtureFunctions.map(fn => {
                          if (fn.type === 'speed_selector') {
                            const currentMult = speedMultiplierByFixture[selectedFixture.id] ?? 1;
                            return (
                              <div key={fn.id} style={{ borderBottom:`1px solid ${theme.colors.borderSoft}`, background:theme.colors.bgDarker }}>
                                <div style={{ height:34, display:'flex', alignItems:'center', padding:'0 8px', gap:6 }}>
                                  <span style={{ fontFamily:theme.typography.fontFamily, fontSize:11, fontWeight:700, color:theme.colors.text, flex:1 }}>SPEED</span>
                                  <div style={{ display:'flex', gap:3 }}>
                                    {SPEED_OPTIONS.map(opt => {
                                      const isActive = currentMult === opt.value;
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => setSpeedMultiplierForFixtures([selectedFixture], opt.value)}
                                          style={{
                                            width:34, height:22, padding:0,
                                            background: isActive ? theme.colors.selection : theme.colors.panel,
                                            color: theme.colors.text,
                                            border:`1px solid ${isActive ? theme.colors.borderStrong : theme.colors.border}`,
                                            borderRadius:0, boxSizing:'border-box',
                                            fontFamily:theme.typography.fontFamily, fontSize:10, fontWeight:700,
                                            cursor:'pointer', outline:'none',
                                          }}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          if (fn.type === 'filtro_selector') {
                            const fxType = getFixtureType(selectedFixture);
                            const currentMode = channelOrderMode[fxType] ?? 'canal';
                            return (
                              <div key={fn.id} style={{ borderBottom:`1px solid ${theme.colors.borderSoft}`, background:theme.colors.bgDarker }}>
                                <div style={{ height:34, display:'flex', alignItems:'center', padding:'0 8px', gap:6 }}>
                                  <span style={{ fontFamily:theme.typography.fontFamily, fontSize:11, fontWeight:700, color:theme.colors.text, flex:1 }}>FILTRO</span>
                                  <div style={{ display:'flex', gap:3 }}>
                                    {[{ value:'canal', label:'CANAL' }, { value:'pref', label:'PREF' }].map(opt => {
                                      const isActive = currentMode === opt.value;
                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={e => { e.stopPropagation(); setChannelOrderMode(prev => ({ ...prev, [fxType]: opt.value })); }}
                                          style={{
                                            width:46, height:22, padding:0,
                                            background: isActive ? theme.colors.selection : theme.colors.panel,
                                            color: theme.colors.text,
                                            border:`1px solid ${isActive ? theme.colors.borderStrong : theme.colors.border}`,
                                            borderRadius:0, boxSizing:'border-box',
                                            fontFamily:theme.typography.fontFamily, fontSize:10, fontWeight:700,
                                            cursor:'pointer', outline:'none',
                                          }}
                                        >
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          const active = activeCustomFunction === fn.id;
                          return (
                            <button
                              key={fn.id}
                              type="button"
                              onClick={() => selectCustomFunction(selectedFixture, fn.id)}
                              style={{
                                width:'100%',
                                height:30,
                                padding:'0 8px',
                                background:active ? theme.colors.selection : theme.colors.bgDarker,
                                color:theme.colors.text,
                                border:'none',
                                borderLeft:`3px solid ${active ? theme.colors.borderStrong : theme.colors.bgDarker}`,
                                borderBottom:`1px solid ${theme.colors.borderSoft}`,
                                borderRadius:0,
                                boxSizing:'border-box',
                                fontFamily:theme.typography.fontFamily,
                                fontSize:12,
                                fontWeight:700,
                                textAlign:'left',
                                cursor:'pointer',
                                outline:'none',
                                display:'flex',
                                alignItems:'center',
                              }}
                            >
                              {fn.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    </div>{/* end position:relative wrapper */}

                    {(() => {
                      // Ordenação de canais: 'canal' (DMX asc) ou 'pref' (preferência do usuário)
                      const fxType = getFixtureType(selectedFixture);
                      const orderMode = channelOrderMode[fxType] ?? 'canal';
                      const speedChsSet = getFixtureSpeedChannels(selectedFixture);
                      const speedMult = getFixtureSpeedMultiplier(selectedFixture);
                      const chanLabels = selectedFixture.channels || [];
                      let orderedIdx = Array.from({ length: fixtureChannels.length }, (_, k) => k);
                      if (orderMode === 'pref') {
                        const prefOrder = channelPrefOrder[fxType] || DEFAULT_CHANNEL_PREF_ORDER[fxType] || [];
                        orderedIdx = [...orderedIdx].sort((a, b) => {
                          const aLbl = getRightPanelChannelLabel(selectedFixture, chanLabels[a] || '');
                          const bLbl = getRightPanelChannelLabel(selectedFixture, chanLabels[b] || '');
                          const ai = prefOrder.indexOf(aLbl);
                          const bi = prefOrder.indexOf(bLbl);
                          return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
                        });
                      }
                      return orderedIdx.map(i => {
                      const dmxCh = fixtureChannels[i];
                      const rawChanName = (chanLabels[i]) || `Canal ${i+1}`;
                      const chanName = getRightPanelChannelLabel(selectedFixture, rawChanName);
                      const normalizedChanName = String(chanName || '').toLowerCase();
                      const maskedByAllOn = ribaltaAllOnActive && /^led_?[2-8]$/.test(normalizedChanName);
                      if (maskedByAllOn) return null;
                      const isHiddenChannel =
                        (selectedFixture.id === 'fixture_1780805067518_parled_deluxe_1' && i === 0) ||
                        (/^fixture_1780805067518_parled_deluxe_[2-9]$/.test(selectedFixture.id) && i === 7);
                      if (isHiddenChannel) return null;

                      const allOnMaster = ribaltaAllOnActive && /^led_?1$/.test(normalizedChanName);
                      // Para canais de speed: exibe o valor virtual (DMX × multiplicador) — o fader fica na posição certa
                      const rawFaderVal = allOnMaster ? ribaltaAllOnValue : (liveValues[dmxCh] ?? 0);
                      const val = speedChsSet.has(dmxCh) ? Math.min(255, Math.round(rawFaderVal * speedMult)) : rawFaderVal;
                      return (
                        <div key={dmxCh} style={{ marginBottom:10, padding:'0 8px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                            <span style={{ display:'flex', gap:4, minWidth:0, alignItems:'center', flex:1 }}>
                              <span style={{ fontFamily:'Arial, Helvetica, sans-serif', fontSize:11, color:'#9bb4b7', flexShrink:0 }}>{dmxCh}</span>
                              <span style={{ fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, color:'#c8dddd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{allOnMaster ? `${chanName} / ALL ON` : chanName}</span>
                            </span>
                            {orderMode === 'pref' && !maskedByAllOn && (
                              <span style={{ display:'flex', gap:1, flexShrink:0, marginLeft:4 }}>
                                <button onClick={() => movePrefChannel(fxType, chanName, -1)} style={{ width:14, height:14, padding:0, background:'transparent', border:'none', color:theme.colors.textMuted, cursor:'pointer', fontSize:9, lineHeight:1, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>▲</button>
                                <button onClick={() => movePrefChannel(fxType, chanName, 1)} style={{ width:14, height:14, padding:0, background:'transparent', border:'none', color:theme.colors.textMuted, cursor:'pointer', fontSize:9, lineHeight:1, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center' }}>▼</button>
                              </span>
                            )}
                            <span style={{ fontFamily:theme.typography.fontFamily, fontSize:theme.typography.sliderThumb.fontSize, fontWeight:theme.typography.sliderThumb.fontWeight, color:theme.colors.primary, minWidth:28, textAlign:'right', flexShrink:0 }}>{val}</span>
                          </div>
                          <input
                            type="range" min={0} max={255} value={val}
                            onChange={e => {
                              if (allOnMaster) handleRibaltaAllOnFader(selectedFixture, e.target.value);
                              else handleFader(dmxCh, e.target.value);
                            }}
                            style={{ width:'100%', accentColor:theme.colors.primary, cursor:'pointer', height:4 }}
                          />
                        </div>
                      );
                    });
                    })()}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

      </div>

      {/* CENAS — barra inferior */}
      <div style={{ display:'flex', alignItems:'stretch', gap:2, padding:2, background:'#000000', color:'#ffffff', borderTop:'1px solid #8db8b8', minHeight:58 }}>
        <div style={{ display:'flex', alignItems:'center', gap:4, minWidth:128, padding:'0 4px', background:'#24343a', color:'#ffffff', borderRight:'1px solid #5f8588', fontSize:12, fontFamily:'Arial, Helvetica, sans-serif' }}>
          <PageBtn onClick={pgUp}>PgUp</PageBtn>
          <span style={{ fontSize:16, fontWeight:700, color:'#ffffff', minWidth:24, textAlign:'center' }}>{currentPageNumber}</span>
          <PageBtn onClick={pgDw}>PgDw</PageBtn>
        </div>
        <div style={{ width:1, alignSelf:'stretch', background:'#5f8588', margin:'0 4px' }} />
        {SCENE_KEYS.map(key => {
          const scene = scenes[key];
          const ps = pageScripts[key];
          const isActive = !!scene && activeScenes.some(activeRef => activeSceneMatches(activeRef, currentPageId, key));
          const psRunning = ps?.running;
          // Tecla com script segue a MESMA lógica visual da tecla de cena:
          // rodando = borda forte teal (como cena ativa); presente = borda branca.
          const bg = ps ? theme.colors.bgDarker : (scene?.color || '#000000');
          const borderStyle = ps
            ? (psRunning ? `3px solid ${theme.colors.borderStrong}` : `1px solid ${theme.colors.text}`)
            : (isActive ? '3px solid #b7dede' : `1px solid ${scene ? '#ffffff' : '#8db8b8'}`);
          const textColor = ps ? theme.colors.text : (scene ? '#ffffff' : '#9bb4b7');
          return (
            <button
              key={key}
              onClick={() => {
                if (ps) { handleTogglePageScript(key); }
                else if (scene) { handleActivateScene(key); }
              }}
              onContextMenu={(e) => handleSceneRightClick(e, key)}
              style={{
                flex:1,
                fontFamily:'Arial, Helvetica, sans-serif',
                fontSize:12,
                fontWeight:700,
                lineHeight:1.1,
                height:54,
                minHeight:54,
                padding:'4px 6px',
                borderRadius:0,
                cursor:'pointer',
                background: bg,
                border: borderStyle,
                color: textColor,
                boxShadow:'none',
                outline:'none',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:0, minWidth:0,
              }}
            >
              <span style={{ color:'inherit', fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, fontWeight:700 }}>{key}</span>
              {ps && <span style={{ color:'inherit', fontFamily:'Arial, Helvetica, sans-serif', fontSize:10, fontWeight:400, lineHeight:1.1, marginTop:3, overflow:'hidden', maxWidth:'100%', whiteSpace:'normal', textAlign:'center' }}>{ps.name}</span>}
              {!ps && scene && <span style={{ color:'inherit', fontFamily:'Arial, Helvetica, sans-serif', fontSize:10, fontWeight:400, lineHeight:1.1, marginTop:3, overflow:'hidden', maxWidth:'100%', whiteSpace:'normal', textAlign:'center' }}>{scene.name}</span>}
            </button>
          );
        })}
      </div>

      {/* F-KEYS */}
      <div style={{ display:'flex', alignItems:'center', gap:4, padding:4, background:'#000000', color:'#ffffff', borderTop:'1px solid #5f8588', minHeight:42 }}>
        {FKEYS.map(fkey => {
          const script = scripts[fkey];
          const isRunning = script?.running;
          return (
            <button
              key={fkey}
              onClick={(e) => { e.stopPropagation(); handleToggleScript(fkey); }}
              onContextMenu={(e) => handleScriptRightClick(e, fkey)}
              style={{
                flex:1,
                fontFamily:'Arial, Helvetica, sans-serif',
                fontSize:12,
                fontWeight:700,
                lineHeight:1.1,
                height:36,
                minHeight:36,
                padding:'4px 8px',
                borderRadius:0,
                boxSizing:'border-box',
                cursor:'pointer',
                background:script?.color || '#000000',
                border: isRunning ? '3px solid #b7dede' : `1px solid ${script ? '#8db8b8' : '#ffffff'}`,
                color:'#ffffff',
                boxShadow:'none',
                outline:'none',
                display:'flex', flexDirection:'column', alignItems:'center', gap:1, minWidth:0,
              }}
            >
              <span style={{ fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, fontWeight:700, color:'inherit' }}>{fkey}</span>
              {script && <span style={{ fontFamily:'Arial, Helvetica, sans-serif', fontSize:10, fontWeight:400, overflow:'hidden', maxWidth:'100%', color: isRunning ? '#ffffff' : '#c8dddd' }}>{script.name}</span>}
            </button>
          );
        })}
      </div>

      {/* MENU DE CONTEXTO F-KEY */}
      {scriptMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:'fixed',
            top: scriptMenu.y + 110 > window.innerHeight ? scriptMenu.y - 110 : scriptMenu.y,
            left: Math.min(scriptMenu.x, window.innerWidth - 160),
            background:'#2e2e2e', border:'1px solid #444', borderRadius:4,
            zIndex:1000, minWidth:140, boxShadow:'0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
            <div
              onClick={() => {
                const currentScript = scripts[scriptMenu.fkey];
                setCreateModal({ fkey: scriptMenu.fkey });
                setCreateModalTab('novo');
                setSelectedExisting(currentScript || null);
                setScriptName('');
                setScriptColor(currentScript?.color || DEFAULT_SCRIPT_COLOR);
                setScriptMenu(null);
              }}
            style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
            onMouseEnter={e => e.currentTarget.style.background='#383838'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            {scripts[scriptMenu.fkey] ? 'Editar Script' : 'Criar Script'}
          </div>
          <div
            onClick={() => { setMoveModal({ sourceFkey: scriptMenu.fkey }); setScriptMenu(null); }}
            style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
            onMouseEnter={e => e.currentTarget.style.background='#383838'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            Mover para...
          </div>
          <div
            onClick={() => scripts[scriptMenu.fkey] ? handleClearScript(scriptMenu.fkey) : setScriptMenu(null)}
            style={{
              padding:'8px 14px', fontSize:12,
              cursor: scripts[scriptMenu.fkey] ? 'pointer' : 'not-allowed',
              color: scripts[scriptMenu.fkey] ? '#e0e0e0' : '#555',
            }}
            onMouseEnter={e => { if (scripts[scriptMenu.fkey]) e.currentTarget.style.background='#383838'; }}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            Limpar
          </div>
        </div>
      )}

      {/* MODAL CRIAR SCRIPT */}
      {createModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#242424', border:'1px solid #444', borderRadius:6, width:360, fontFamily:'Segoe UI, system-ui, sans-serif', color:'#e0e0e0' }}>

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #383838' }}>
              <span style={{ fontSize:13, fontWeight:600 }}>
                {scripts[createModal.fkey] ? 'Editar Script' : 'Script'} — {createModal.fkey}
              </span>
              <button onClick={() => { setCreateModal(null); setScriptName(''); setScriptColor(DEFAULT_SCRIPT_COLOR); setSelectedExisting(null); setSelectedGroups(new Set()); setSelectedFixtures(new Set()); }} style={{ background:'none', border:'none', color:theme.colors.primary, fontSize:18, cursor:'pointer' }}>✕</button>
            </div>

            {/* Abas */}
            <div style={{ display:'flex', borderBottom:'1px solid #383838' }}>
              {[['novo', 'Novo Script'], ['existentes', 'Scripts Existentes']].map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setCreateModalTab(tab)}
                  style={{
                    flex:1, padding:'7px 0', fontSize:12, cursor:'pointer', border:'none',
                    background: createModalTab === tab ? '#2e2e2e' : '#1e1e1e',
                    color: createModalTab === tab ? '#fff' : '#888',
                    borderBottom: createModalTab === tab ? '2px solid #e0e0e0' : '2px solid transparent',
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Conteúdo — Novo Script */}
            {createModalTab === 'novo' && (
              <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>
                {/* Nome */}
                <div>
                  <div style={{ fontFamily:theme.typography.fontFamily, fontSize:theme.typography.label.fontSize, color:theme.colors.textMuted, marginBottom:4 }}>Nome do script</div>
                  <input
                    value={scripts[createModal.fkey] ? scripts[createModal.fkey].name : scriptName}
                    onChange={e => setScriptName(e.target.value)}
                    disabled={!!scripts[createModal.fkey]}
                    placeholder="Nome do script..."
                    style={{ width:'100%', fontFamily:theme.typography.fontFamily, fontSize:theme.typography.body.fontSize, color: scripts[createModal.fkey] ? theme.colors.textDisabled : theme.colors.text, background:theme.colors.surface, padding:theme.spacing.inputPadding, border:'none', borderBottom:`1px solid ${theme.colors.textSecondary}`, outline:'none', boxSizing:'border-box' }}
                  />
                </div>
                <ColorPaletteField value={scriptColor} onChange={setScriptColor} label="Cor do script" />

                {/* Banco de conhecimento — só exibe para script novo */}
                {!scripts[createModal.fkey] && (
                  <div>
                    <div style={{ fontFamily:theme.typography.fontFamily, fontSize:theme.typography.label.fontSize, color:theme.colors.textMuted, marginBottom:8 }}>Banco de conhecimento</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {FIXTURE_GROUPS.map(group => {
                        const groupActive = selectedGroups.has(group.key);
                        const anyFixture = group.fixtures.some(f => selectedFixtures.has(f));
                        const effective = groupActive || anyFixture;
                        return (
                          <div key={group.key} style={{ border:`1px solid ${effective ? theme.colors.primary : theme.colors.borderSoft}`, borderRadius:theme.radius.md, overflow:'hidden', background: effective ? theme.colors.primaryOverlay : 'transparent', transition:'border-color .15s' }}>
                            {/* Cabeçalho do grupo */}
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 8px', borderBottom:`1px solid ${effective ? theme.colors.primary : theme.colors.borderSoft}` }}>
                              <span style={{ fontFamily:theme.typography.fontFamily, fontSize:theme.typography.toolbar.fontSize, fontWeight:700, color: effective ? theme.colors.primary : theme.colors.text }}>{group.label}</span>
                              <button
                                onClick={() => {
                                  if (groupActive) {
                                    setSelectedGroups(prev => { const s = new Set(prev); s.delete(group.key); return s; });
                                    setSelectedFixtures(prev => { const s = new Set(prev); group.fixtures.forEach(f => s.delete(f)); return s; });
                                  } else {
                                    setSelectedGroups(prev => new Set([...prev, group.key]));
                                    setSelectedFixtures(prev => { const s = new Set(prev); group.fixtures.forEach(f => s.delete(f)); return s; });
                                  }
                                }}
                                style={{ fontFamily:theme.typography.fontFamily, fontSize:10, padding:'2px 8px', borderRadius:theme.radius.sm, border:`1px solid ${groupActive ? theme.colors.primary : theme.colors.borderSoft}`, background: groupActive ? theme.colors.primary : theme.colors.buttonSurface, color: groupActive ? theme.colors.bgDarker : theme.colors.text, cursor:'pointer', fontWeight:700, letterSpacing:'.03em' }}
                              >{groupActive ? '✓ Tudo' : 'Tudo'}</button>
                            </div>
                            {/* Fixtures individuais */}
                            <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:6 }}>
                              {group.fixtures.map(fname => {
                                const isOn = groupActive || selectedFixtures.has(fname);
                                return (
                                  <button
                                    key={fname}
                                    onClick={() => {
                                      if (groupActive) return; // grupo inteiro ativo, chips são visuais
                                      setSelectedFixtures(prev => {
                                        const s = new Set(prev);
                                        if (s.has(fname)) s.delete(fname); else s.add(fname);
                                        return s;
                                      });
                                    }}
                                    style={{ fontFamily:theme.typography.fontFamily, fontSize:9, padding:'2px 6px', borderRadius:theme.radius.sm, border:`1px solid ${isOn ? theme.colors.accent : theme.colors.borderSoft}`, background: isOn ? theme.colors.accentOverlay : theme.colors.buttonSurface, color: isOn ? theme.colors.accent : theme.colors.textMuted, cursor: groupActive ? 'default' : 'pointer', whiteSpace:'nowrap' }}
                                  >{fname.replace(/_/g,' ')}</button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Conteúdo — Scripts Existentes */}
            {createModalTab === 'existentes' && (
              <div style={{ padding:'10px 14px', maxHeight:276, overflowY:'auto', display:'flex', flexDirection:'column', gap:10 }}>
                {existingScripts.length === 0
                  ? <div style={{ fontSize:12, color:'#555', padding:'8px 0' }}>Nenhum script encontrado em /scripts/</div>
                  : (
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {existingScripts.map(s => (
                        <div
                          key={s.file}
                          onClick={() => { setSelectedExisting(s); setScriptColor(s.color || DEFAULT_SCRIPT_COLOR); }}
                          style={{
                            padding:'7px 10px', borderRadius:3, cursor:'pointer', fontSize:12,
                            background: selectedExisting?.file === s.file ? '#383838' : '#1e1e1e',
                            border: `1px solid ${selectedExisting?.file === s.file ? '#555' : '#2a2a2a'}`,
                            color: selectedExisting?.file === s.file ? '#fff' : '#bbb',
                            display:'flex',
                            alignItems:'center',
                            gap:8,
                          }}
                        >
                          <span style={{ width:12, height:12, background:s.color || DEFAULT_SCRIPT_COLOR, border:`1px solid ${theme.colors.borderSoft}`, flexShrink:0 }} />
                          <span style={{ overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
                <ColorPaletteField value={scriptColor} onChange={setScriptColor} label="Cor do script" />
              </div>
            )}

            {/* Footer */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'10px 14px', borderTop:'1px solid #383838' }}>
              <button
                onClick={() => { setCreateModal(null); setScriptName(''); setScriptColor(DEFAULT_SCRIPT_COLOR); setSelectedExisting(null); setSelectedGroups(new Set()); setSelectedFixtures(new Set()); }}
                style={{ minHeight:36, padding:'0 16px', borderRadius:4, cursor:'pointer', fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, background:'transparent', color:theme.colors.primary, border:'none', boxShadow:'none' }}
              >Cancelar</button>

              {createModalTab === 'novo' && (
                <button
                  onClick={async () => {
                    if (scripts[createModal.fkey]) {
                      const colorResult = await window.vp.createScript(createModal.fkey, scripts[createModal.fkey].name, { skipOpenEditor: true, color: scriptColor });
                      if (colorResult?.ok) {
                        setScripts(prev => ({
                          ...prev,
                          [createModal.fkey]: { ...prev[createModal.fkey], color: colorResult.color || scriptColor }
                        }));
                      }
                      await window.vp.editScript(createModal.fkey);
                      setCreateModal(null);
                      setScriptColor(DEFAULT_SCRIPT_COLOR);
                    } else {
                      handleCreateScript();
                    }
                  }}
                  disabled={!scripts[createModal.fkey] && !scriptName.trim()}
                  style={{ minHeight:36, padding:'0 16px', borderRadius:4, fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, cursor: (!scripts[createModal.fkey] && !scriptName.trim()) ? 'default' : 'pointer', background: (!scripts[createModal.fkey] && !scriptName.trim()) ? 'rgba(0,0,0,.12)' : theme.colors.primary, color: (!scripts[createModal.fkey] && !scriptName.trim()) ? theme.colors.textDisabled : '#ffffff', border:'none', boxShadow: (!scripts[createModal.fkey] && !scriptName.trim()) ? 'none' : theme.elevation.z2 }}
                >
                  {scripts[createModal.fkey] ? 'Abrir no VS Code' : 'Criar e Abrir'}
                </button>
              )}

              {createModalTab === 'existentes' && (
                <>
                  <button
                    onClick={async () => {
                      if (!selectedExisting) return;
                      const metaResult = await window.vp.createScript(createModal.fkey, selectedExisting.name, { skipOpenEditor: true, color: scriptColor });
                      if (metaResult?.ok) {
                        setScripts(prev => ({
                          ...prev,
                          [createModal.fkey]: { name: selectedExisting.name, file: selectedExisting.file, color: metaResult.color || scriptColor, running: false }
                        }));
                      }
                      const result = await window.vp.editScript(createModal.fkey, selectedExisting.file);
                      if (!result?.ok) console.warn('[vp] editScript falhou:', result?.error);
                    }}
                    disabled={!selectedExisting}
                    style={{ minHeight:36, padding:'0 16px', borderRadius:4, fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, cursor: selectedExisting ? 'pointer' : 'default', background: selectedExisting ? 'transparent' : 'rgba(0,0,0,.12)', color: selectedExisting ? theme.colors.primary : theme.colors.textDisabled, border:'none', boxShadow:'none' }}
                  >Abrir no VS Code</button>

                  <button
                    onClick={async () => {
                      if (!selectedExisting) return;
                      const result = await window.vp.createScript(createModal.fkey, selectedExisting.name, { skipOpenEditor: true, color: scriptColor });
                      if (result.ok) {
                        setScripts(prev => ({
                          ...prev,
                          [createModal.fkey]: { name: selectedExisting.name, file: selectedExisting.file, color: result.color || scriptColor, running: false }
                        }));
                      }
                      setCreateModal(null);
                      setScriptColor(DEFAULT_SCRIPT_COLOR);
                      setSelectedExisting(null);
                    }}
                    disabled={!selectedExisting}
                    style={{ minHeight:36, padding:'0 16px', borderRadius:4, fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, cursor: selectedExisting ? 'pointer' : 'default', background: selectedExisting ? theme.colors.primary : 'rgba(0,0,0,.12)', color: selectedExisting ? '#ffffff' : theme.colors.textDisabled, border:'none', boxShadow: selectedExisting ? theme.elevation.z2 : 'none' }}
                  >Usar este script</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAINEL DE TESTE — canais ao vivo do fixture selecionado */}
      {testPanelOpen && selectedFixture && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:'fixed',
            top: testPanelPos.y,
            left: testPanelPos.x != null ? testPanelPos.x : undefined,
            right: testPanelPos.x != null ? undefined : 16,
            width:300, maxHeight:'70vh',
            background:'#242424', border:'1px solid #444', borderRadius:6,
            zIndex:1500, boxShadow:'0 4px 16px rgba(0,0,0,0.5)',
            display:'flex', flexDirection:'column', fontFamily:'Segoe UI, system-ui, sans-serif', color:'#e0e0e0',
          }}
        >
          <div
            onMouseDown={handleTestPanelMouseDown}
            style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #383838', cursor:'move', userSelect:'none' }}
          >
            <span style={{ fontSize:13, fontWeight:600 }}>{selectedFixture.name}</span>
            <button onClick={() => setTestPanelOpen(false)} style={{ background:'none', border:'none', color:theme.colors.primary, fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
          </div>
          <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:8, overflowY:'auto' }}>
            {Array.from({ length: selectedFixture.channelCount || 0 }, (_, i) => {
              const dmxChannel = (selectedFixture.startChannel || 1) + i;
              const chName = (selectedFixture.channels && selectedFixture.channels[i]) || `Canal ${i + 1}`;
              const value = testValues[dmxChannel] || 0;
              const active = value > 0;
              return (
                <div key={dmxChannel} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                    <span style={{ color:C.textMuted }}>CH {dmxChannel} — {chName}</span>
                    <span style={{ color: active ? C.white : '#555', fontWeight:600 }}>{value}</span>
                  </div>
                  <div style={{ width:'100%', height:6, borderRadius:3, background:'#1a1a1a', overflow:'hidden' }}>
                    <div style={{ width:`${(value / 255) * 100}%`, height:'100%', background: active ? C.white : '#3a3a3a' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {contextMenu && (() => {
        const ck = contextMenu.sceneKey;
        const hasScene = !!scenes[ck] && Object.keys(scenes[ck].channels || {}).length > 0;
        const hasScript = !!pageScripts[ck];
        return (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position:'fixed',
              top: contextMenu.y + 120 > window.innerHeight ? contextMenu.y - 120 : contextMenu.y,
              left: Math.min(contextMenu.x, window.innerWidth - 160),
              background:'#2e2e2e', border:'1px solid #444', borderRadius:4,
              zIndex:1000, minWidth:150, boxShadow:'0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            {/* Estado: tem SCRIPT — mostra opções de script, sem cena */}
            {hasScript && (
              <>
                <div
                  onClick={async () => { await window.vp.editPageScript(currentPageId, ck); setContextMenu(null); }}
                  style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
                  onMouseEnter={e => e.currentTarget.style.background='#383838'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  Editar Script
                </div>
                <div
                  onClick={() => handleClearPageScript(ck)}
                  style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#ff8888' }}
                  onMouseEnter={e => e.currentTarget.style.background='#383838'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  Remover Script
                </div>
              </>
            )}

            {/* Estado: tem CENA — mostra opções de cena, sem script */}
            {!hasScript && hasScene && (
              <>
                <div
                  onClick={openSaveModal}
                  style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
                  onMouseEnter={e => e.currentTarget.style.background='#383838'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  Salvar Cena...
                </div>
                <div
                  onClick={() => { setSceneMoveModal({ sourceKey: ck }); setContextMenu(null); }}
                  style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
                  onMouseEnter={e => e.currentTarget.style.background='#383838'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  Mover para...
                </div>
                <div
                  onClick={handleClearScene}
                  style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
                  onMouseEnter={e => e.currentTarget.style.background='#383838'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  Limpar Cena
                </div>
              </>
            )}

            {/* Estado: VAZIA — salvar cena e criar script */}
            {!hasScript && !hasScene && (
              <>
                <div
                  onClick={openSaveModal}
                  style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
                  onMouseEnter={e => e.currentTarget.style.background='#383838'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  Salvar Cena...
                </div>
                <div
                  onClick={() => { setSceneScriptModal({ sceneKey: ck }); setSceneScriptName(''); setContextMenu(null); }}
                  style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
                  onMouseEnter={e => e.currentTarget.style.background='#383838'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                >
                  Criar Script
                </div>
                <div
                  style={{ padding:'8px 14px', fontSize:12, cursor:'not-allowed', color:'#555' }}
                >
                  Mover para...
                </div>
              </>
            )}
          </div>
        );
      })()}

      {exitModalOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2200 }}>
          <div style={{ background:theme.components.modal.background, border:theme.components.modal.border, borderRadius:theme.radius.none, width:340, fontFamily:theme.typography.fontFamily, color:theme.components.modal.color, boxShadow:theme.elevation.modal }}>
            <div style={{ padding:'10px 12px', background:theme.colors.panelDark, borderBottom:theme.borders.thin, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight }}>
              Sair do vp-light
            </div>
            <div style={{ padding:14, fontSize:theme.typography.body.fontSize, color:theme.colors.text }}>
              Deseja salvar antes de sair?
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:10, background:theme.colors.panelDark, borderTop:theme.borders.thin }}>
              <button
                onClick={handleExitWithSave}
                disabled={exitSaving}
                style={{ height:28, minWidth:72, padding:'4px 12px', borderRadius:theme.radius.none, cursor:exitSaving ? 'default' : 'pointer', fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, background:theme.colors.buttonBg, color:exitSaving ? theme.colors.textDisabled : theme.colors.text, border:theme.borders.button, outline:'none', boxShadow:'none' }}
              >
                Sim
              </button>
              <button
                onClick={handleExitWithoutSave}
                disabled={exitSaving}
                style={{ height:28, minWidth:72, padding:'4px 12px', borderRadius:theme.radius.none, cursor:exitSaving ? 'default' : 'pointer', fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, background:theme.colors.buttonBg, color:exitSaving ? theme.colors.textDisabled : theme.colors.text, border:theme.borders.button, outline:'none', boxShadow:'none' }}
              >
                N&atilde;o
              </button>
            </div>
          </div>
        </div>
      )}

      {saveModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#26363c', border:'1px solid #8db8b8', borderRadius:0, width:360, fontFamily:'Arial, Helvetica, sans-serif', color:'#ffffff', boxShadow:'0 4px 12px rgba(0,0,0,.65)' }}>

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', background:'#24343a', color:'#ffffff', borderBottom:'1px solid #8db8b8', fontFamily:'Arial, Helvetica, sans-serif' }}>
              <span style={{ fontSize:13, fontWeight:700 }}>Salvar Cena</span>
              <button onClick={() => setSaveModal(null)} style={{ background:'transparent', border:'none', outline:'none', boxShadow:'none', borderRadius:0, color:'#ffffff', fontFamily:'Arial, Helvetica, sans-serif', fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding:10, display:'flex', flexDirection:'column', gap:8, background:'#26363c', color:'#ffffff', fontFamily:'Arial, Helvetica, sans-serif' }}>
              <div>
                <div style={{ fontSize:11, fontWeight:400, color:'#c8dddd', marginBottom:4 }}>Nome da cena</div>
                <input
                  value={modalName}
                  onChange={e => setModalName(e.target.value)}
                  placeholder="Nome da cena..."
                  style={{ width:'100%', height:28, fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, fontWeight:400, color:'#ffffff', background:'#000000', padding:'4px 6px', border:'1px solid #5f8588', borderRadius:0, outline:'none', boxShadow:'none', boxSizing:'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:400, color:'#c8dddd', marginBottom:4 }}>Cor</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {COLORS.map(color => (
                    <div
                      key={color}
                      onClick={() => setModalColor(color)}
                      style={{
                        width:32, height:32, borderRadius:0, background:color, cursor:'pointer',
                        border: modalColor === color ? '2px solid #ffffff' : '1px solid #5f8588',
                        boxShadow:'none',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:8, background:'#24343a', borderTop:'1px solid #8db8b8' }}>
              <button onClick={() => setSaveModal(null)} style={{ height:28, padding:'4px 10px', borderRadius:0, cursor:'pointer', fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, fontWeight:700, background:'#000000', color:'#ffffff', border:'1px solid #8db8b8', outline:'none', boxShadow:'none' }}>
                Cancelar
              </button>
              <button onClick={handleConfirmSave} style={{ height:28, padding:'4px 10px', borderRadius:0, cursor:'pointer', fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, fontWeight:700, background:'#000000', color:'#ffffff', border:'1px solid #b7dede', outline:'none', boxShadow:'none' }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MOVER CENA */}
      {sceneMoveModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#26363c', border:'1px solid #8db8b8', borderRadius:0, width:380, fontFamily:'Arial, Helvetica, sans-serif', color:'#ffffff', boxShadow:'0 4px 12px rgba(0,0,0,.65)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', background:'#24343a', borderBottom:'1px solid #8db8b8' }}>
              <span style={{ fontSize:13, fontWeight:700 }}>Mover cena {sceneMoveModal.sourceKey} para...</span>
              <button onClick={() => setSceneMoveModal(null)} style={{ background:'transparent', border:'none', outline:'none', color:'#ffffff', fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>
            <div style={{ padding:12, display:'flex', flexWrap:'wrap', gap:8 }}>
              {SCENE_KEYS.map(destKey => {
                const isSelf = destKey === sceneMoveModal.sourceKey;
                const destScene = scenes[destKey];
                return (
                  <button
                    key={destKey}
                    disabled={isSelf}
                    onClick={() => {
                      if (isSelf) return;
                      const sourceScene = scenes[sceneMoveModal.sourceKey];
                      updateScene(currentPageId, destKey, { ...sourceScene });
                      updateScene(currentPageId, sceneMoveModal.sourceKey, { name:'', color:'', channels:{} });
                      setActiveScenes(prev => {
                        const wasActive = prev.some(activeRef => activeSceneMatches(activeRef, currentPageId, sceneMoveModal.sourceKey));
                        const next = prev.filter(activeRef => !activeSceneMatches(activeRef, currentPageId, sceneMoveModal.sourceKey));
                        if (wasActive && !next.some(activeRef => activeSceneMatches(activeRef, currentPageId, destKey))) {
                          next.push(sceneRefId(currentPageId, destKey));
                        }
                        return next;
                      });
                      setSceneMoveModal(null);
                    }}
                    style={{
                      width:60, minHeight:48, padding:'6px 4px', borderRadius:0,
                      fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, fontWeight:700,
                      background: isSelf ? '#1a2a2f' : destScene ? '#1a2a2f' : '#000000',
                      border: isSelf ? '1px solid #5f8588' : destScene ? '1px solid #b7dede' : '1px solid #5f8588',
                      color: isSelf ? '#5f8588' : '#ffffff',
                      cursor: isSelf ? 'default' : 'pointer',
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                    }}
                  >
                    <span>{destKey}</span>
                    {destScene && <span style={{ fontSize:8, color:'#c8dddd', overflow:'hidden', maxWidth:54, textAlign:'center', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{destScene.name}</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ padding:'8px 14px', borderTop:'1px solid #8db8b8', background:'#24343a', display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setSceneMoveModal(null)} style={{ height:28, padding:'4px 10px', borderRadius:0, cursor:'pointer', fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, fontWeight:700, background:'#000000', color:'#ffffff', border:'1px solid #8db8b8', outline:'none', boxShadow:'none' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MOVER SCRIPT */}
      {moveModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#242424', border:'1px solid #444', borderRadius:6, width:380, fontFamily:'Segoe UI, system-ui, sans-serif', color:'#e0e0e0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #383838' }}>
              <span style={{ fontSize:13, fontWeight:600 }}>Mover {moveModal.sourceFkey} para...</span>
              <button onClick={() => setMoveModal(null)} style={{ background:'none', border:'none', color:theme.colors.primary, fontSize:18, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ padding:12, display:'flex', flexWrap:'wrap', gap:8 }}>
              {FKEYS.map(fkey => {
                const isSelf = fkey === moveModal.sourceFkey;
                const hasScript = !!scripts[fkey];
                const disabled = isSelf || hasScript;
                return (
                  <button
                    key={fkey}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setScripts(prev => {
                        const next = { ...prev };
                        next[fkey] = { ...prev[moveModal.sourceFkey] };
                        delete next[moveModal.sourceFkey];
                        return next;
                      });
                      window.vp.clearScript(moveModal.sourceFkey).then(() =>
                        window.vp.createScript(fkey, scripts[moveModal.sourceFkey].name, { skipOpenEditor: true, color: scripts[moveModal.sourceFkey].color || DEFAULT_SCRIPT_COLOR })
                      );
                      setMoveModal(null);
                    }}
                    style={{
                      width:60, minHeight:36, padding:'8px 4px', borderRadius:4,
                      fontFamily:theme.typography.fontFamily,
                      fontSize:theme.typography.button.fontSize,
                      fontWeight:theme.typography.button.fontWeight,
                      background: disabled ? 'rgba(0,0,0,.12)' : (scripts[fkey]?.color || 'transparent'),
                      border:'none', boxShadow:'none',
                      color: disabled ? theme.colors.textDisabled : theme.colors.primary,
                      cursor: disabled ? 'default' : 'pointer',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                    }}
                  >
                    <span>{fkey}</span>
                    {scripts[fkey] && <span style={{ fontSize:8, color:'#888', overflow:'hidden', maxWidth:56 }}>{scripts[fkey].name}</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ padding:'8px 14px', borderTop:'1px solid #383838', display:'flex', justifyContent:'flex-end' }}>
              <button onClick={() => setMoveModal(null)} style={{ minHeight:36, padding:'0 16px', borderRadius:4, cursor:'pointer', fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, background:'transparent', color:theme.colors.primary, border:'none', boxShadow:'none' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR SCRIPT DE CENA */}
      {sceneScriptModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#26363c', border:'1px solid #8db8b8', borderRadius:0, width:340, fontFamily:'Arial, Helvetica, sans-serif', color:'#ffffff', boxShadow:'0 4px 12px rgba(0,0,0,.65)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', background:'#24343a', borderBottom:'1px solid #8db8b8' }}>
              <span style={{ fontSize:13, fontWeight:700 }}>Criar Script — Tecla {sceneScriptModal.sceneKey}</span>
              <button onClick={() => { setSceneScriptModal(null); setSceneScriptName(''); }} style={{ background:'transparent', border:'none', outline:'none', color:'#ffffff', fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>
            <div style={{ padding:12, display:'flex', flexDirection:'column', gap:8, background:'#26363c' }}>
              {scenes[sceneScriptModal.sceneKey] && Object.keys(scenes[sceneScriptModal.sceneKey].channels||{}).length > 0 && (
                <div style={{ fontSize:11, color:'#ffaa44', padding:'6px 8px', background:'rgba(255,170,68,.1)', border:'1px solid #ffaa44', borderRadius:0 }}>
                  ⚠ A cena existente nesta tecla será removida ao criar o script.
                </div>
              )}
              <div>
                <div style={{ fontSize:11, color:'#c8dddd', marginBottom:4 }}>Nome do script</div>
                <input
                  autoFocus
                  value={sceneScriptName}
                  onChange={e => setSceneScriptName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreatePageScript(); }}
                  placeholder="Nome do script..."
                  style={{ width:'100%', height:28, fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, color:'#ffffff', background:'#000000', padding:'4px 6px', border:'1px solid #5f8588', borderRadius:0, outline:'none', boxSizing:'border-box' }}
                />
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:8, background:'#24343a', borderTop:'1px solid #8db8b8' }}>
              <button onClick={() => { setSceneScriptModal(null); setSceneScriptName(''); }} style={{ height:28, padding:'4px 10px', borderRadius:0, cursor:'pointer', fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, fontWeight:700, background:'#000000', color:'#ffffff', border:'1px solid #8db8b8', outline:'none', boxShadow:'none' }}>
                Cancelar
              </button>
              <button
                onClick={handleCreatePageScript}
                disabled={!sceneScriptName.trim()}
                style={{ height:28, padding:'4px 10px', borderRadius:0, cursor: sceneScriptName.trim() ? 'pointer' : 'default', fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, fontWeight:700, background: sceneScriptName.trim() ? '#000000' : '#1a2a2f', color: sceneScriptName.trim() ? '#ffffff' : '#5f8588', border:'1px solid #b7dede', outline:'none', boxShadow:'none' }}
              >
                Criar e Abrir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFLITOS */}
      {conflictModalOpen && conflicts.length > 0 && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'#242424', border:'1px solid #ff4444', borderRadius:6, width:420, maxHeight:'60vh', fontFamily:'Segoe UI, system-ui, sans-serif', color:'#e0e0e0', overflow:'hidden', display:'flex', flexDirection:'column' }}>

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #383838', background:'#2a1a1a' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'#ff6666' }}>⚠ {conflicts.length} Conflito{conflicts.length !== 1 ? 's' : ''}</span>
              <button onClick={() => setConflictModalOpen(false)} style={{ background:'none', border:'none', color:theme.colors.primary, fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding:'10px 14px', overflowY:'auto', flex:1 }}>
              {conflicts.map((conflict, idx) => (
                <div key={idx} style={{ marginBottom:12, paddingBottom:12, borderBottom: idx < conflicts.length - 1 ? '1px solid #333' : 'none' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#ffaa88', marginBottom:6 }}>
                    Canal {conflict.channel}
                  </div>
                  <div style={{ fontSize:11, color:'#aaa', display:'flex', flexDirection:'column', gap:4 }}>
                    {conflict.sources.map((src, srcIdx) => (
                      <div key={srcIdx} style={{ paddingLeft:8, borderLeft:'2px solid #555' }}>
                        <span style={{ color:'#e0e0e0', fontWeight:500 }}>{src.name}</span>
                        <span style={{ color:'#666', marginLeft:6 }}>→ {src.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'10px 14px', borderTop:'1px solid #383838' }}>
              <button onClick={() => setConflictModalOpen(false)} style={{ minHeight:36, padding:'0 16px', borderRadius:4, cursor:'pointer', fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, background:'transparent', color:theme.colors.primary, border:'none', boxShadow:'none' }}>
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'#2e2e2e', border:'1px solid #555', borderRadius:4,
          padding:'8px 20px', fontSize:13, color:'#e0e0e0',
          boxShadow:'0 4px 12px rgba(0,0,0,0.5)', zIndex:9999,
          pointerEvents:'none',
        }}>
          {toast}
        </div>
      )}

    </div>
  );
}

function TopBtn({ onClick, children, danger, disabled, active, accentActive }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      minHeight:36, padding:'0 16px', borderRadius:4,
      fontFamily:theme.typography.fontFamily,
      fontSize:theme.typography.button.fontSize,
      fontWeight:theme.typography.button.fontWeight,
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'rgba(0,0,0,.12)' : danger ? theme.colors.warn : accentActive ? theme.colors.accentOverlay : 'transparent',
      color: disabled ? theme.colors.textDisabled : danger ? '#ffffff' : accentActive ? theme.colors.accent : theme.colors.primary,
      border: accentActive ? `1px solid ${theme.colors.accent}` : 'none',
      boxShadow: disabled ? 'none' : danger ? theme.elevation.z2 : 'none',
      animation: active ? 'blink-border 1s step-start infinite' : 'none',
    }}>{children}</button>
  );
}

function PageBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      minHeight:36, padding:'0 16px', borderRadius:4, cursor:'pointer',
      fontFamily:theme.typography.fontFamily,
      fontSize:theme.typography.button.fontSize,
      fontWeight:theme.typography.button.fontWeight,
      background:'transparent', color:theme.colors.primary, border:'none', boxShadow:'none',
    }}>{children}</button>
  );
}
