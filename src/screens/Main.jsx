/**
 * Main.jsx — Tela principal
 * Mesa de aparelhos + painel direito com faders ao vivo + cenas A-M + páginas
 */
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useShow } from '../store/showStore.js';
import theme from '../theme.js';

const SCENE_KEYS = ['A','S','D','F','G','H','J','K','L','Z','X','C','V'];
const RIGHT_PANEL_MIN_WIDTH = 260;
const RIGHT_PANEL_MAX_WIDTH = 640;
const DESK_MIN_WIDTH = 360;
const MAX_PAGE = 10;

const C = {
  bg: theme.colors.bgDarker, surface: theme.colors.panel, border: theme.colors.borderSoft,
  text: theme.colors.text, textMuted: theme.colors.textMuted, white: theme.colors.text,
  btnBg: theme.colors.buttonSurface, btnBorder: theme.colors.borderSoft,
  rowSelected: theme.colors.selection, fixtureBg: theme.colors.buttonSurface, fixtureSelected: theme.colors.selection,
  sceneActive: theme.colors.selection,
};

export default function Main({ onOpenFixtures }) {
  const {
    show, currentPage, setCurrentPage,
    activeScenes, setActiveScenes,
    selectedFixtureId, setSelectedFixtureId,
    selectedFixture, pages, saveShow, loadShow,
    updateScene, updateFixture,
  } = useShow();

  const [blackoutActive, setBlackoutActive] = useState(false);
  const [toast, setToast] = useState(null); // string | null

  async function handleSave() {
    const result = await saveShow();
    if (result?.message) {
      setToast(result.message);
      setTimeout(() => setToast(null), 2000);
    }
  }

  // Resolve o estado do universo DMX a partir das cenas ativas no momento.
  // Reconstrói o universo do zero: limpa todos os canais e reaplica apenas as
  // cenas que continuam ativas. Também sincroniza o mapa de canais bloqueados.
  function resolveUniverseState(nextActiveScenes, nextScripts) {
    const merged = {};
    nextActiveScenes.forEach(key => {
      const s = scenes[key];
      if (s?.channels) {
        Object.entries(s.channels).forEach(([ch, val]) => {
          merged[Number(ch)] = Number(val);
        });
      }
    });
    window.vp.setActiveSceneChannels(merged);
    // Limpa o universo antes de reaplicar — caso contrário os canais da fonte
    // removida (cena desmarcada ou script desligado) ficariam presos, pois
    // applyScene é aditivo. Scripts ainda ativos voltam a escrever no tick
    // seguinte (loop de 40ms via OnExecute).
    window.vp.blackout();
    if (Object.keys(merged).length > 0) {
      window.vp.restoreState(merged);
    }
    return merged;
  }

  function handleActivateScene(key) {
    const scene = scenes[key];
    if (!scene?.channels || Object.keys(scene.channels).length === 0) return;
    setActiveScenes(prev => {
      if (prev.includes(key)) {
        // desmarcando — usa resolveUniverseState para decidir restore vs blackout
        // o display da barra lateral é resolvido pelo orquestrador (resolveSidebarValues)
        const next = prev.filter(k => k !== key);
        resolveUniverseState(next, scripts);
        return next;
      }
      if (prev.length >= 3) return prev;
      if (scene?.channels) {
        window.vp.activateScene(scene.channels);
        // o display da barra lateral é resolvido pelo orquestrador (resolveSidebarValues)
      }
      return [...prev, key];
    });
  }

  function handleBlackout() {
    if (blackoutActive) {
      setBlackoutActive(false);
      if (activeScenes.length > 0) {
        const merged = {};
        activeScenes.forEach(key => {
          const scene = scenes[key];
          if (scene?.channels) {
            Object.entries(scene.channels).forEach(([ch, val]) => {
              merged[Number(ch)] = Number(val);
            });
          }
        });
        window.vp.restoreState(merged);
      }
    } else {
      setBlackoutActive(true);
      window.vp.blackout();
    }
  }

  const [liveValues, setLiveValues] = useState({});
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testValues, setTestValues] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState('description');
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [rightPanelResize, setRightPanelResize] = useState(null); // { startX, startWidth }
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
  const [dragging, setDragging] = useState(null); // { id, offsetX, offsetY }
  const [selection, setSelection] = useState(null); // { startX, startY, endX, endY }
  const [multiSelected, setMultiSelected] = useState([]);
  const [scripts, setScripts] = useState({});
  const scriptsRef = useRef(scripts);
  scriptsRef.current = scripts; // sempre fresco: atualizado na render, antes de qualquer await
  const [scriptMenu, setScriptMenu] = useState(null); // { x, y, fkey }
  const [createModal, setCreateModal] = useState(null); // { fkey }
  const [scriptName, setScriptName] = useState('');
  const [createModalTab, setCreateModalTab] = useState('novo');
  const [existingScripts, setExistingScripts] = useState([]);
  const [selectedExisting, setSelectedExisting] = useState(null);
  const [moveModal, setMoveModal] = useState(null); // { sourceFkey }

  const FKEYS = ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];
  const currentPageNumber = Math.max(1, Number.parseInt(currentPage, 10) || 1);
  const currentPageId = String(currentPageNumber);

  useEffect(() => {
    const load = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = await window.vp.getAllScripts();
      setScripts(result);
    };
    load();
  }, []);

  // Sincroniza canais bloqueados por cenas com o main process sempre que activeScenes muda
  useEffect(() => {
    const currentScenes = (pages[currentPageId] || {}).scenes || {};
    const merged = {};
    activeScenes.forEach(key => {
      const s = currentScenes[key];
      if (s?.channels) {
        Object.entries(s.channels).forEach(([ch, val]) => {
          if (Number(val) > 0) merged[Number(ch)] = Number(val);
        });
      }
    });
    window.vp.setActiveSceneChannels(merged);

    // Envia mapa de cenas ativas para detecção de conflito
    const scenesMap = {};
    activeScenes.forEach(key => {
      const s = currentScenes[key];
      if (s?.channels) {
        scenesMap[key] = { name: s.name || key, channels: s.channels };
      }
    });
    window.vp.setActiveScenes(scenesMap);

    // Reset acknowledge quando novas cenas são ativadas
    setConflictAcknowledged(false);
  }, [activeScenes, pages]);

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
    const result = await window.vp.createScript(createModal.fkey, scriptName.trim());
    if (result.ok) {
      setScripts(prev => ({
        ...prev,
        [createModal.fkey]: { name: result.name, file: result.file, running: false }
      }));
    }
    setCreateModal(null);
    setScriptName('');
  }

  async function handleClearScript(fkey) {
    await window.vp.clearScript(fkey);
    setScripts(prev => { const next = { ...prev }; delete next[fkey]; return next; });
    setScriptMenu(null);
  }
  const [contextMenu, setContextMenu] = useState(null); // { x, y, sceneKey }
  const [saveModal, setSaveModal] = useState(null); // { sceneKey }
  const [modalName, setModalName] = useState('');
  const [modalColor, setModalColor] = useState('#000000');

  const COLORS = ['#000000','#cc0000','#00aa00','#0000cc','#cccc00','#00cccc','#aa00aa','#cc6600'];

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

  function handleConfirmSave() {
    if (!saveModal) return;
    const channels = {};
    Object.entries(liveValues).forEach(([ch, val]) => {
      channels[Number(ch)] = Number(val);
    });
    updateScene(currentPageId, saveModal.sceneKey, {
      name: modalName,
      color: modalColor,
      channels,
    });
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
    if (!selectedFixture) { setLiveValues({}); return; }

    const start = selectedFixture.startChannel;
    const count = selectedFixture.channelCount ?? (selectedFixture.channels || []).length;

    // Cenas ativas — mescladas na ordem de ativação: a última (mais recente) vence
    const currentScenes = (pages[currentPageId] || {}).scenes || {};
    const sceneMerged = {};
    activeScenes.forEach(key => {
      const s = currentScenes[key];
      if (s?.channels) {
        Object.entries(s.channels).forEach(([ch, val]) => {
          sceneMerged[Number(ch)] = Number(val);
        });
      }
    });

    // Snapshot do universo — só quando há script rodando (valores em tempo real)
    const anyScriptRunning = Object.values(scripts).some(s => s?.running);
    let snapshot = null;
    if (anyScriptRunning) {
      try { snapshot = await window.vp.getUniverse(); } catch { snapshot = null; }
    }

    // Resolve cada canal do fixture por prioridade
    const resolved = {};
    for (let i = 0; i < count; i++) {
      const ch = start + i;
      if (ch in sceneMerged)                       resolved[ch] = sceneMerged[ch];        // cena vence
      else if (snapshot && snapshot[ch] != null)   resolved[ch] = Number(snapshot[ch]);   // script ao vivo
      else                                         resolved[ch] = 0;
    }
    setLiveValues(resolved);
  }, [selectedFixture, activeScenes, pages, currentPageId, scripts]);

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
      if (moveModal)   { setMoveModal(null); return; }
      if (saveModal)   { setSaveModal(null); return; }
      if (createModal) { setCreateModal(null); setScriptName(''); return; }
      if (contextMenu) { setContextMenu(null); return; }
      if (scriptMenu)  { setScriptMenu(null); return; }
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [moveModal, saveModal, createModal, contextMenu, scriptMenu]);

  const scenes = (pages[currentPageId] || {}).scenes || {};

  const handleKey = useCallback((e) => {
    if (e.target.tagName === 'INPUT') return;
    const key = e.key.toUpperCase();
    if (SCENE_KEYS.includes(key)) { handleActivateScene(key); return; }
    if (e.code === 'Space') { e.preventDefault(); handleBlackout(); return; }
    if (FKEYS.includes(key)) { e.preventDefault(); handleToggleScript(key); return; }
  }, [handleActivateScene, handleBlackout, handleToggleScript]);

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
    const val = Number(value);
    setLiveValues(prev => ({ ...prev, [dmxChannel]: val }));
    await window.vp.setChannel(dmxChannel, val);
  }

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
        <TopBtn onClick={() => setTestPanelOpen(true)} disabled={!selectedFixture}>Painel de Teste</TopBtn>
        <div style={{ flex:1 }} />
        {conflicts.length > 0 && !conflictAcknowledged && (
          <TopBtn onClick={() => setConflictModalOpen(true)} danger active>
            ⚠ {conflicts.length} conflito{conflicts.length !== 1 ? 's' : ''}
          </TopBtn>
        )}
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
            onClick={() => setSelectedFixtureId(null)}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setSelection({ startX: x, startY: y, endX: x, endY: y });
                setMultiSelected([]);
              }
            }}
            onMouseMove={(e) => {
              const container = e.currentTarget.getBoundingClientRect();
              if (dragging) {
                const x = e.clientX - container.left - dragging.offsetX;
                const y = e.clientY - container.top - dragging.offsetY;
                updateFixture(dragging.id, { posX: Math.max(0, x), posY: Math.max(0, y) });
                return;
              }
              if (selection) {
                const x = e.clientX - container.left;
                const y = e.clientY - container.top;
                setSelection(prev => ({ ...prev, endX: x, endY: y }));
              }
            }}
            onMouseUp={(e) => {
              if (selection) {
                const minX = Math.min(selection.startX, selection.endX);
                const maxX = Math.max(selection.startX, selection.endX);
                const minY = Math.min(selection.startY, selection.endY);
                const maxY = Math.max(selection.startY, selection.endY);
                const selected = show.fixtures.filter(f => {
                  const x = f.posX ?? 10;
                  const y = f.posY ?? 10;
                  return x + 80 > minX && x < maxX && y + 60 > minY && y < maxY;
                }).map(f => f.id);
                setMultiSelected(selected);
                setSelection(null);
              }
              setDragging(null);
            }}
            onMouseLeave={() => { setDragging(null); setSelection(null); }}
            style={{ flex:1, position:'relative', overflowY:'auto', background:'#000000', color:'#ffffff', borderTop:'1px solid #5f8588', borderBottom:'1px solid #5f8588' }}
          >
            {show.fixtures.length === 0 && (
              <div style={{ color:'#9bb4b7', fontSize:12, padding:16, position:'absolute' }}>Nenhum aparelho. Clique em "Aparelhos" para adicionar.</div>
            )}
            {show.fixtures.map(f => {
              const isSelected = f.id === selectedFixtureId || multiSelected.includes(f.id);
              return (
              <div
                key={f.id}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setDragging({ id: f.id, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top });
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedFixtureId(f.id === selectedFixtureId ? null : f.id); }}
                style={{
                  position:'absolute',
                  left: f.posX ?? 10,
                  top: f.posY ?? 10,
                  width:80, height:60,
                  background:'#233237',
                  color:'#ffffff',
                  border: isSelected ? '2px solid #b7dede' : '1px solid #5f8588',
                  borderRadius:0, boxShadow:'none', cursor: dragging?.id === f.id ? 'grabbing' : 'grab',
                  display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center', gap:2,
                  userSelect:'none',
                }}
              >
                <div style={{ fontSize:10, color:'#9bb4b7' }}>ch {f.startChannel}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#ffffff', textAlign:'center', lineHeight:1.2, padding:'0 4px', overflow:'hidden', maxWidth:76 }}>{f.name}</div>
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
                ['ZFit', 70],
                ['BO', 92],
                ['freeZe', 78],
                ['WPT', 26],
                ['WPTE', 26],
                ['WSeq', 26],
              ].map(([label, height]) => (
                <button
                  key={label}
                  type="button"
                  style={{
                    width:'100%',
                    height,
                    background:'#24343a',
                    color:'#ffffff',
                    border:'1px solid #8db8b8',
                    borderRadius:0,
                    fontFamily:'Arial, Helvetica, sans-serif',
                    fontSize:10,
                    fontWeight:700,
                    lineHeight:1,
                    textAlign:'center',
                    outline:'none',
                    boxShadow:'none',
                    cursor:'default',
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
              {rightPanelTab === 'chat' && (
                <div style={{ background:'#35484f', color:'#c8dddd', padding:8, fontSize:12, fontFamily:'Arial, Helvetica, sans-serif' }}>
                  em desenvolvimento
                </div>
              )}
              {rightPanelTab === 'description' && selectedFixture && (selectedFixture.channels || []).map((chanName, i) => {
                const dmxCh = selectedFixture.startChannel + i;
                const val = liveValues[dmxCh] ?? 0;
                return (
                  <div key={i} style={{ marginBottom:10, padding:'0 8px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ display:'flex', gap:4, minWidth:0 }}>
                        <span style={{ fontFamily:'Arial, Helvetica, sans-serif', fontSize:11, color:'#9bb4b7', flexShrink:0 }}>{dmxCh}</span>
                        <span style={{ fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, color:'#c8dddd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{chanName || `Canal ${i+1}`}</span>
                      </span>
                      <span style={{ fontFamily:theme.typography.fontFamily, fontSize:theme.typography.sliderThumb.fontSize, fontWeight:theme.typography.sliderThumb.fontWeight, color:theme.colors.primary, minWidth:28, textAlign:'right' }}>{val}</span>
                    </div>
                    <input
                      type="range" min={0} max={255} value={val}
                      onChange={e => handleFader(dmxCh, e.target.value)}
                      style={{ width:'100%', accentColor:theme.colors.primary, cursor:'pointer', height:4 }}
                    />
                  </div>
                );
              })}
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
          const isActive = !!scene && activeScenes.includes(key);
          return (
            <button
              key={key}
              onClick={() => scene && handleActivateScene(key)}
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
                background:'#000000',
                border: isActive ? '3px solid #b7dede' : `1px solid ${scene ? '#ffffff' : '#8db8b8'}`,
                color: scene ? '#ffffff' : '#9bb4b7',
                boxShadow:'none',
                outline:'none',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:0, minWidth:0,
              }}
            >
              <span style={{ color:'inherit', fontFamily:'Arial, Helvetica, sans-serif', fontSize:12, fontWeight:700 }}>{key}</span>
              {scene && <span style={{ color:'inherit', fontFamily:'Arial, Helvetica, sans-serif', fontSize:10, fontWeight:400, lineHeight:1.1, marginTop:3, overflow:'hidden', maxWidth:'100%', whiteSpace:'normal', textAlign:'center' }}>{scene.name}</span>}
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
                background:'#000000',
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
            onClick={() => { setCreateModal({ fkey: scriptMenu.fkey }); setCreateModalTab('novo'); setSelectedExisting(null); setScriptName(''); setScriptMenu(null); }}
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
              <button onClick={() => { setCreateModal(null); setScriptName(''); setSelectedExisting(null); }} style={{ background:'none', border:'none', color:theme.colors.primary, fontSize:18, cursor:'pointer' }}>✕</button>
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
              <div style={{ padding:16 }}>
                <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>Nome do script</div>
                <input
                  value={scripts[createModal.fkey] ? scripts[createModal.fkey].name : scriptName}
                  onChange={e => setScriptName(e.target.value)}
                  disabled={!!scripts[createModal.fkey]}
                  placeholder="Nome do script..."
                  style={{ width:'100%', fontFamily:theme.typography.fontFamily, fontSize:theme.typography.body.fontSize, color: scripts[createModal.fkey] ? theme.colors.textDisabled : theme.colors.text, background:theme.colors.surface, padding:theme.spacing.inputPadding, marginTop:theme.spacing.inputMarginTop, border:'none', borderBottom:`1px solid ${theme.colors.textSecondary}`, outline:'none', boxSizing:'border-box' }}
                />
              </div>
            )}

            {/* Conteúdo — Scripts Existentes */}
            {createModalTab === 'existentes' && (
              <div style={{ padding:'10px 14px', maxHeight:220, overflowY:'auto' }}>
                {existingScripts.length === 0
                  ? <div style={{ fontSize:12, color:'#555', padding:'8px 0' }}>Nenhum script encontrado em /scripts/</div>
                  : existingScripts.map(s => (
                    <div
                      key={s.file}
                      onClick={() => setSelectedExisting(s)}
                      style={{
                        padding:'7px 10px', borderRadius:3, marginBottom:4, cursor:'pointer', fontSize:12,
                        background: selectedExisting?.file === s.file ? '#383838' : '#1e1e1e',
                        border: `1px solid ${selectedExisting?.file === s.file ? '#555' : '#2a2a2a'}`,
                        color: selectedExisting?.file === s.file ? '#fff' : '#bbb',
                      }}
                    >{s.name}</div>
                  ))
                }
              </div>
            )}

            {/* Footer */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'10px 14px', borderTop:'1px solid #383838' }}>
              <button
                onClick={() => { setCreateModal(null); setScriptName(''); setSelectedExisting(null); }}
                style={{ minHeight:36, padding:'0 16px', borderRadius:4, cursor:'pointer', fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, background:'transparent', color:theme.colors.primary, border:'none', boxShadow:'none' }}
              >Cancelar</button>

              {createModalTab === 'novo' && (
                <button
                  onClick={async () => {
                    if (scripts[createModal.fkey]) {
                      await window.vp.editScript(createModal.fkey);
                      setCreateModal(null);
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
                      const result = await window.vp.editScript(createModal.fkey, selectedExisting.file);
                      if (!result?.ok) console.warn('[vp] editScript falhou:', result?.error);
                    }}
                    disabled={!selectedExisting}
                    style={{ minHeight:36, padding:'0 16px', borderRadius:4, fontFamily:theme.typography.fontFamily, fontSize:theme.typography.button.fontSize, fontWeight:theme.typography.button.fontWeight, cursor: selectedExisting ? 'pointer' : 'default', background: selectedExisting ? 'transparent' : 'rgba(0,0,0,.12)', color: selectedExisting ? theme.colors.primary : theme.colors.textDisabled, border:'none', boxShadow:'none' }}
                  >Abrir no VS Code</button>

                  <button
                    onClick={async () => {
                      if (!selectedExisting) return;
                      const result = await window.vp.createScript(createModal.fkey, selectedExisting.name);
                      if (result.ok) {
                        setScripts(prev => ({
                          ...prev,
                          [createModal.fkey]: { name: selectedExisting.name, file: selectedExisting.file, running: false }
                        }));
                      }
                      setCreateModal(null);
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

      {contextMenu && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position:'fixed', top: contextMenu.y, left: contextMenu.x,
            background:'#2e2e2e', border:'1px solid #444', borderRadius:4,
            zIndex:1000, minWidth:140, boxShadow:'0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div
            onClick={openSaveModal}
            style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', color:'#e0e0e0' }}
            onMouseEnter={e => e.currentTarget.style.background='#383838'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            Salvar Cena...
          </div>
          <div
            onClick={scenes[contextMenu.sceneKey] ? handleClearScene : undefined}
            style={{
              padding:'8px 14px', fontSize:12,
              cursor: scenes[contextMenu.sceneKey] ? 'pointer' : 'not-allowed',
              color: scenes[contextMenu.sceneKey] ? '#e0e0e0' : '#555',
            }}
            onMouseEnter={e => { if (scenes[contextMenu.sceneKey]) e.currentTarget.style.background='#383838'; }}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            Limpar Cena
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
                        window.vp.createScript(fkey, scripts[moveModal.sourceFkey].name, { skipOpenEditor: true })
                      );
                      setMoveModal(null);
                    }}
                    style={{
                      width:60, minHeight:36, padding:'8px 4px', borderRadius:4,
                      fontFamily:theme.typography.fontFamily,
                      fontSize:theme.typography.button.fontSize,
                      fontWeight:theme.typography.button.fontWeight,
                      background: disabled ? 'rgba(0,0,0,.12)' : 'transparent',
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

function TopBtn({ onClick, children, danger, disabled, active }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      minHeight:36, padding:'0 16px', borderRadius:4,
      fontFamily:theme.typography.fontFamily,
      fontSize:theme.typography.button.fontSize,
      fontWeight:theme.typography.button.fontWeight,
      cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'rgba(0,0,0,.12)' : danger ? theme.colors.warn : 'transparent',
      color: disabled ? theme.colors.textDisabled : danger ? '#ffffff' : theme.colors.primary,
      border:'none',
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
